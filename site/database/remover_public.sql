-- ════════════════════════════════════════════════════════════════════
--  Apaga a primeira versão do banco de reservas, criada no schema public
--  (tabelas SIT_..., funções e o agendamento do pg_cron). Rode UMA vez,
--  antes do schema.sql novo, que cria tudo no schema "SE".
--  Apaga também os dados gravados nessas tabelas (pousada, chalé, tarifa).
--  Não mexe em mais nada do public nem no schema "SE".
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

-- 2. tabelas (cascade leva junto FKs, índices, regras e o gatilho do passaporte)
drop table if exists public.sit_pagamento          cascade;
drop table if exists public.sit_bloqueio           cascade;
drop table if exists public.sit_calendario_externo cascade;
drop table if exists public.sit_reserva            cascade;
drop table if exists public.sit_hospede            cascade;
drop table if exists public.sit_ajuste_diario      cascade;
drop table if exists public.sit_tarifa             cascade;
drop table if exists public.sit_unidade            cascade;
drop table if exists public.sit_propriedade        cascade;

-- 3. funções
drop function if exists public.consultar_disponibilidade(date, date, int, int, int);
drop function if exists public.criar_pre_reserva(text, date, date, int, int, int);
drop function if exists public.confirmar_reserva(text, text, text, text, char, text, text, char, date, date);
drop function if exists public.expirar_pre_reservas();
drop function if exists public.calcular_estadia(bigint, date, date, int, int, int);
drop function if exists public.verificar_passaporte_reserva();
drop function if exists public.cpf_valido(text);

-- 4. conferência: as duas contagens devem dar 0
select (select count(*) from information_schema.tables
        where table_schema = 'public' and table_name like 'sit\_%') as tabelas_sit_no_public,
       (select count(*) from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname in ('consultar_disponibilidade','criar_pre_reserva','confirmar_reserva','expirar_pre_reservas',
                          'calcular_estadia','verificar_passaporte_reserva','cpf_valido')) as funcoes_no_public;
