-- SOMENTE se você ainda NÃO executou a instalação anterior do DevNox.
-- Execute inteiro no SQL Editor. A transação impede instalação parcial.
begin;
-- DevNox: execute em um projeto Supabase novo. Dados separados por usuário.
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 name text not null default '', phone text not null default '', avatar_path text,
 city text not null default '', state text not null default '', neighborhood text not null default '', street text not null default ''
);
create function public.create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id,name,phone) values(new.id,coalesce(new.raw_user_meta_data->>'name',''),coalesce(new.raw_user_meta_data->>'phone','')); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
insert into public.profiles(id,name,phone) select id,coalesce(raw_user_meta_data->>'name',''),coalesce(raw_user_meta_data->>'phone','') from auth.users on conflict do nothing;
create table public.contacts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), company text not null default '',
 phone text not null default '' check(phone='' or phone ~ '^\+[1-9][0-9]{7,14}$'),
 telegram_chat_id text not null default '' check(telegram_chat_id='' or telegram_chat_id ~ '^-?[0-9]+$'),
 link text not null default '', consent boolean not null default false, consent_at timestamptz,
 created_at timestamptz not null default now()
);
create function public.contact_consent() returns trigger language plpgsql set search_path='' as $$
begin
 if not new.consent then new.consent_at=null;
 elsif TG_OP='INSERT' then new.consent_at=now();
 elsif not old.consent then new.consent_at=now();
 else new.consent_at=old.consent_at; end if;
 return new;
end; $$;
create trigger contact_consent before insert or update on public.contacts for each row execute function public.contact_consent();
create index contacts_user_idx on public.contacts(user_id);
create table public.campaigns (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100), channel text not null check(channel in ('telegram','whatsapp')),
 body text not null default '', template_name text not null default '', template_language text not null default 'pt_BR', template_params jsonb not null default '[]' check(jsonb_typeof(template_params)='array'),
 media_path text, media_type text, contact_ids uuid[] not null default '{}',
 interval_seconds integer not null default 5 check(interval_seconds between 5 and 3600), scheduled_at timestamptz,
 status text not null default 'draft' check(status in ('draft','queued','running','completed','cancelled')),
 created_at timestamptz not null default now()
);
create index campaigns_user_idx on public.campaigns(user_id);
create table public.deliveries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 campaign_id uuid not null references public.campaigns on delete cascade, contact_id uuid references public.contacts on delete set null,
 recipient_name text not null, recipient_company text not null default '', recipient_link text not null default '', destination text not null,
 status text not null default 'pending' check(status in ('pending','sending','accepted','delivered','read','failed','unknown','cancelled')),
 provider_id text, error text, started_at timestamptz, updated_at timestamptz not null default now(),
 unique(campaign_id,contact_id)
);
create index deliveries_pending_idx on public.deliveries(status,campaign_id);
create index deliveries_user_idx on public.deliveries(user_id);
create index deliveries_provider_idx on public.deliveries(provider_id);
-- Uma instalação pertence a uma conta de envio. Apenas SQL/admin pode autorizar essa conta.
create table public.dispatch_account (
 singleton boolean primary key default true check(singleton), user_id uuid not null references auth.users on delete cascade,
 next_send_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.campaigns enable row level security;
alter table public.deliveries enable row level security;
alter table public.dispatch_account enable row level security;
create policy own_profile_select on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy own_contacts on public.contacts for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_campaigns on public.campaigns for select to authenticated using(user_id=(select auth.uid()));
create policy own_deliveries on public.deliveries for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.profiles,public.contacts,public.campaigns,public.deliveries,public.dispatch_account from anon,authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update,delete on public.contacts to authenticated;
grant select on public.campaigns,public.deliveries to authenticated;
grant all on public.profiles,public.contacts,public.campaigns,public.deliveries,public.dispatch_account to service_role;

create function public.save_campaign(payload jsonb, recipient_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; st text; ch text:=payload->>'channel'; mp text:=nullif(payload->>'media_path','');
begin
 if uid is null then raise exception 'Login obrigatório'; end if;
 if cardinality(recipient_ids)>500 then raise exception 'Máximo de 500 contatos por campanha nesta versão'; end if;
 if exists(select 1 from unnest(recipient_ids) r where not exists(select 1 from public.contacts c where c.id=r and c.user_id=uid)) then raise exception 'Contato inválido'; end if;
 if mp is not null and (split_part(mp,'/',1)<>uid::text or not exists(select 1 from storage.objects where bucket_id='campaign-assets' and name=mp)) then raise exception 'Anexo inválido'; end if;
 if length(coalesce(payload->>'body',''))>10000 or jsonb_array_length(coalesce(payload->'template_params','[]'::jsonb))>20 then raise exception 'Conteúdo muito grande'; end if;
 cid:=nullif(payload->>'id','')::uuid;
 if cid is not null then
   select status into st from public.campaigns where id=cid and user_id=uid for update;
   if st is distinct from 'draft' then raise exception 'Somente rascunhos próprios podem ser alterados'; end if;
 else
   insert into public.campaigns(user_id,name,channel) values(uid,payload->>'name',ch) returning id into cid;
 end if;
 update public.campaigns set name=payload->>'name',channel=ch,body=coalesce(payload->>'body',''),template_name=coalesce(payload->>'template_name',''),template_language=coalesce(payload->>'template_language','pt_BR'),template_params=coalesce(payload->'template_params','[]'::jsonb),media_path=mp,media_type=payload->>'media_type',interval_seconds=(payload->>'interval_seconds')::integer,scheduled_at=nullif(payload->>'scheduled_at','')::timestamptz,contact_ids=array(select distinct unnest(recipient_ids)) where id=cid;
 return cid;
end; $$;

create function public.enqueue_campaign(campaign_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.campaigns; count_valid integer;
begin
 select * into c from public.campaigns where id=campaign_id and user_id=auth.uid() for update;
 if c.id is null or c.status<>'draft' then raise exception 'Campanha não disponível para envio'; end if;
 if not exists(select 1 from public.dispatch_account where user_id=auth.uid()) then raise exception 'Conta não autorizada para os canais desta instalação'; end if;
 if cardinality(c.contact_ids)=0 then raise exception 'Selecione contatos'; end if;
 if c.scheduled_at is not null and c.scheduled_at<=now() then raise exception 'Escolha um horário futuro'; end if;
 select count(*) into count_valid from public.contacts p where p.id=any(c.contact_ids) and p.user_id=c.user_id and p.consent and case c.channel when 'whatsapp' then p.phone<>'' else p.telegram_chat_id<>'' end;
 if count_valid<>cardinality(c.contact_ids) then raise exception 'Destinatário sem autorização ou destino'; end if;
 if c.channel='telegram' and (length(trim(c.body))=0 or length(c.body)>4096) then raise exception 'Mensagem Telegram inválida'; end if;
 if c.channel='whatsapp' and (c.template_name !~ '^[a-z0-9_]+$' or c.template_language !~ '^[a-z]{2,3}(_[A-Z]{2})?$' or c.media_path is not null) then raise exception 'Use um template de texto aprovado e idioma válido'; end if;
 -- Cada destino recebe uma única mensagem, mesmo com contatos duplicados.
 insert into public.deliveries(user_id,campaign_id,contact_id,recipient_name,recipient_company,recipient_link,destination)
 select distinct on (case c.channel when 'whatsapp' then p.phone else p.telegram_chat_id end) c.user_id,c.id,p.id,p.name,p.company,p.link,case c.channel when 'whatsapp' then p.phone else p.telegram_chat_id end from public.contacts p where p.id=any(c.contact_ids) and p.user_id=c.user_id order by case c.channel when 'whatsapp' then p.phone else p.telegram_chat_id end,p.id;
 update public.campaigns set status='queued' where id=c.id;
end; $$;

create function public.cancel_campaign(campaign_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.campaigns where id=campaign_id and user_id=auth.uid() and status in ('draft','queued','running') for update;
 if not found then raise exception 'Campanha indisponível'; end if;
 update public.campaigns set status='cancelled' where id=campaign_id;
 update public.deliveries set status='cancelled',updated_at=now() where deliveries.campaign_id=cancel_campaign.campaign_id and status='pending';
end; $$;

-- Claim atômico + trava global da conta: workers concorrentes não repetem um envio.
create function public.claim_delivery(owner_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.deliveries; c public.campaigns; a public.dispatch_account;
begin
 select * into a from public.dispatch_account where user_id=owner_id for update skip locked;
 if a.user_id is null or a.next_send_at>clock_timestamp() then return null; end if;
 update public.deliveries set status='unknown',error='Processamento interrompido. Verifique no canal antes de reenviar.',updated_at=now() where user_id=owner_id and status='sending' and started_at<now()-interval '5 minutes';
 update public.campaigns x set status='completed' where x.user_id=owner_id and x.status in ('queued','running') and not exists(select 1 from public.deliveries y where y.campaign_id=x.id and y.status in ('pending','sending'));
 select x.* into c from public.campaigns x where x.user_id=owner_id and x.status in ('queued','running') and coalesce(x.scheduled_at,x.created_at)<=now() and exists(select 1 from public.deliveries y where y.campaign_id=x.id and y.status='pending') order by coalesce(x.scheduled_at,x.created_at) limit 1 for update skip locked;
 if c.id is null then return null; end if;
 select * into d from public.deliveries where campaign_id=c.id and status='pending' order by id limit 1 for update skip locked;
 if d.id is null then return null; end if;
 update public.deliveries set status='sending',started_at=now(),updated_at=now() where id=d.id;
 update public.campaigns set status='running' where id=c.id;
 update public.dispatch_account set next_send_at=clock_timestamp()+make_interval(secs=>c.interval_seconds) where singleton=true;
 return jsonb_build_object('delivery',to_jsonb(d),'campaign',to_jsonb(c));
end; $$;
revoke all on function public.create_profile(),public.contact_consent(),public.save_campaign(jsonb,uuid[]),public.enqueue_campaign(uuid),public.cancel_campaign(uuid),public.claim_delivery(uuid) from public,anon,authenticated;
grant execute on function public.save_campaign(jsonb,uuid[]),public.enqueue_campaign(uuid),public.cancel_campaign(uuid) to authenticated;
grant execute on function public.claim_delivery(uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('campaign-assets','campaign-assets',false,5242880,array['image/jpeg','image/png','video/mp4','application/pdf']);
create policy own_asset_select on storage.objects for select to authenticated using(bucket_id='campaign-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy own_asset_insert on storage.objects for insert to authenticated with check(bucket_id='campaign-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Sem UPDATE/DELETE pelo navegador: anexos já enfileirados permanecem disponíveis.

-- Atualização segura da versão anterior: preserva contatos, perfil e histórico.
-- Pausa/cancela pendências do canal removido. Não reenvia mensagens em processamento.
update public.deliveries d set status='cancelled',updated_at=now()
from public.campaigns c where d.campaign_id=c.id and c.channel<>'telegram' and d.status='pending';
update public.campaigns set status='cancelled' where channel<>'telegram' and status in ('draft','queued','running');
create or replace function public.save_campaign(payload jsonb, recipient_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; st text; ch text:=payload->>'channel'; mp text:=nullif(payload->>'media_path','');
begin
 if ch is distinct from 'telegram' then raise exception 'Somente Telegram está habilitado'; end if;
 if uid is null then raise exception 'Login obrigatório'; end if;
 if recipient_ids is null then raise exception 'Lista de contatos inválida'; end if;
 if cardinality(recipient_ids)>500 then raise exception 'Máximo de 500 contatos por campanha nesta versão'; end if;
 if exists(select 1 from unnest(recipient_ids) r where not exists(select 1 from public.contacts c where c.id=r and c.user_id=uid)) then raise exception 'Contato inválido'; end if;
 if mp is not null and (split_part(mp,'/',1)<>uid::text or not exists(select 1 from storage.objects where bucket_id='campaign-assets' and name=mp)) then raise exception 'Anexo inválido'; end if;
 if length(coalesce(payload->>'body',''))>10000 or jsonb_array_length(coalesce(payload->'template_params','[]'::jsonb))>20 then raise exception 'Conteúdo muito grande'; end if;
 cid:=nullif(payload->>'id','')::uuid;
 if cid is not null then
   select status into st from public.campaigns where id=cid and user_id=uid for update;
   if st is distinct from 'draft' then raise exception 'Somente rascunhos próprios podem ser alterados'; end if;
 else
   insert into public.campaigns(user_id,name,channel) values(uid,payload->>'name',ch) returning id into cid;
 end if;
 update public.campaigns set name=payload->>'name',channel=ch,body=coalesce(payload->>'body',''),template_name=coalesce(payload->>'template_name',''),template_language=coalesce(payload->>'template_language','pt_BR'),template_params=coalesce(payload->'template_params','[]'::jsonb),media_path=mp,media_type=payload->>'media_type',interval_seconds=(payload->>'interval_seconds')::integer,scheduled_at=nullif(payload->>'scheduled_at','')::timestamptz,contact_ids=array(select distinct unnest(recipient_ids)) where id=cid;
 return cid;
end; $$;

create or replace function public.enqueue_campaign(campaign_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare c public.campaigns; count_valid integer;
begin
 select * into c from public.campaigns where id=campaign_id and user_id=auth.uid() for update;
 if c.id is null or c.status<>'draft' then raise exception 'Campanha não disponível para envio'; end if;
 if c.channel<>'telegram' then raise exception 'Somente Telegram está habilitado'; end if;
 if not exists(select 1 from public.dispatch_account where user_id=auth.uid()) then raise exception 'Conta não autorizada para este bot'; end if;
 if cardinality(c.contact_ids)=0 then raise exception 'Selecione contatos'; end if;
 if c.scheduled_at is not null and c.scheduled_at<=now() then raise exception 'Escolha um horário futuro'; end if;
 select count(*) into count_valid from public.contacts p where p.id=any(c.contact_ids) and p.user_id=c.user_id and p.consent and p.telegram_chat_id<>'';
 if count_valid<>cardinality(c.contact_ids) then raise exception 'Destinatário sem autorização ou destino'; end if;
 if length(trim(c.body))=0 or length(c.body)>4096 then raise exception 'Mensagem Telegram inválida'; end if;
 -- Cada chat recebe uma mensagem. Nome, empresa e link são snapshots próprios de cada contato.
 insert into public.deliveries(user_id,campaign_id,contact_id,recipient_name,recipient_company,recipient_link,destination)
 select distinct on (p.telegram_chat_id) c.user_id,c.id,p.id,p.name,p.company,p.link,p.telegram_chat_id
 from public.contacts p where p.id=any(c.contact_ids) and p.user_id=c.user_id order by p.telegram_chat_id,p.id;
 update public.campaigns set status='queued' where id=c.id;
end; $$;
create or replace function public.claim_delivery(owner_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.deliveries; c public.campaigns; a public.dispatch_account;
begin
 select * into a from public.dispatch_account where user_id=owner_id for update skip locked;
 if a.user_id is null or a.next_send_at>clock_timestamp() then return null; end if;
 update public.deliveries set status='unknown',error='Processamento interrompido. Verifique no canal antes de reenviar.',updated_at=now() where user_id=owner_id and status='sending' and started_at<now()-interval '5 minutes';
 update public.campaigns x set status='completed' where x.user_id=owner_id and x.channel='telegram' and x.status in ('queued','running') and not exists(select 1 from public.deliveries y where y.campaign_id=x.id and y.status in ('pending','sending'));
 select x.* into c from public.campaigns x where x.user_id=owner_id and x.channel='telegram' and x.status in ('queued','running') and coalesce(x.scheduled_at,x.created_at)<=now() and exists(select 1 from public.deliveries y where y.campaign_id=x.id and y.status='pending') order by coalesce(x.scheduled_at,x.created_at) limit 1 for update skip locked;
 if c.id is null then return null; end if;
 select * into d from public.deliveries where campaign_id=c.id and status='pending' order by id limit 1 for update skip locked;
 if d.id is null then return null; end if;
 update public.deliveries set status='sending',started_at=now(),updated_at=now() where id=d.id;
 update public.campaigns set status='running' where id=c.id;
 update public.dispatch_account set next_send_at=clock_timestamp()+make_interval(secs=>c.interval_seconds) where singleton=true;
 return jsonb_build_object('delivery',to_jsonb(d),'campaign',to_jsonb(c));
end; $$;

revoke all on function public.save_campaign(jsonb,uuid[]), public.enqueue_campaign(uuid), public.claim_delivery(uuid) from public,anon,authenticated;
grant execute on function public.save_campaign(jsonb,uuid[]), public.enqueue_campaign(uuid) to authenticated;
grant execute on function public.claim_delivery(uuid) to service_role;

commit;
