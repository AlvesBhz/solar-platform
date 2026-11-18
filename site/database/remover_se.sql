-- ════════════════════════════════════════════════════════════════════
--  Apaga o banco de reservas do site: o schema "SE" inteiro (tabelas,
--  dados, funções, regras) e o agendamento do pg_cron.
--  Use para recriar do zero: depois rode schema.sql e seed_exemplo.sql.
--  ATENÇÃO: apaga também todas as reservas, hóspedes e pagamentos gravados.
--  Não mexe em outros schemas (public, extensions, auth...).
-- ════════════════════════════════════════════════════════════════════

-- 1. agendamento de vencimento das pré-reservas (se o pg_cron estiver ativo e o job existir)
do $$
declare tem boolean := false;
begin
  if to_regclass('cron.job') is not null then
    execute $q$select exists (select 1 from cron.job where jobname = 'expirar-pre-reservas')$q$ into tem;
    if tem then
      execute $q$select cron.unschedule('expirar-pre-reservas')$q$;
    end if;
  end if;
end $$;

-- 2. o schema com tudo dentro
drop schema if exists "SE" cascade;

-- 3. conferência: deve mostrar 0
select count(*) as schema_se_existe from pg_namespace where nspname = 'SE';
