-- Execute manualmente após publicar as funções e substituir os exemplos no guia.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Crie no Vault do Supabase dois segredos, UMA vez:
-- devnox_project_url = https://wxvyyjkrmkfvvswxzhua.supabase.co
-- devnox_worker_secret = mesmo WORKER_SECRET configurado nas Edge Functions
-- Use o Dashboard para não versionar valores reais neste arquivo.

do $$ begin
 if not exists(select 1 from vault.decrypted_secrets where name='devnox_project_url') or
    not exists(select 1 from vault.decrypted_secrets where name='devnox_worker_secret' and length(decrypted_secret)>=32)
 then raise exception 'Crie devnox_project_url e devnox_worker_secret no Vault antes de ativar o Cron'; end if;
end $$;
select cron.schedule('devnox-dispatch-every-minute','* * * * *', $cron$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='devnox_project_url') || '/functions/v1/dispatch-worker',
  headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='devnox_worker_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
 );
$cron$);
