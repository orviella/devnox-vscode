-- Primeiro crie uma conta pelo site e confirme seu e-mail.
-- Consulte Authentication > Users e substitua o UUID abaixo.
-- Use o mesmo UUID em INTEGRATION_OWNER_ID nas Edge Function Secrets.
insert into public.dispatch_account(singleton,user_id)
values (true,'COLE_AQUI_O_UUID_DO_SEU_USUARIO'::uuid)
on conflict(singleton) do update set user_id=excluded.user_id;
