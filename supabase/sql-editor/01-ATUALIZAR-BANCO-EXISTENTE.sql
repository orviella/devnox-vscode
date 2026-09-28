-- SOMENTE se você JÁ executou a instalação anterior do DevNox.
begin;
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
