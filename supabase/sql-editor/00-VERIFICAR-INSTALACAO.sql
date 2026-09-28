-- Apenas consulta. Se os cinco resultados forem NULL, use 01-INSTALAR-BANCO-NOVO.sql.
-- Se já houver as cinco tabelas DevNox da versão anterior, use 01-ATUALIZAR-BANCO-EXISTENTE.sql.
-- Se houver apenas algumas, verifique a instalação antes de continuar.
select to_regclass('public.profiles') as profiles,
to_regclass('public.contacts') as contacts,
to_regclass('public.campaigns') as campaigns,
to_regclass('public.deliveries') as deliveries,
to_regclass('public.dispatch_account') as dispatch_account;
