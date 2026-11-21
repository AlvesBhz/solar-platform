-- ════════════════════════════════════════════════════════════════════
--  Geração automática das vistorias a partir das reservas (21/11/2026)
--  Rodar DEPOIS de schema.sql, seed_exemplo.sql e da migração do Solar
--  Inspect (solar-inspect/database/migracao_vistorias.sql). Não apaga dados
--  e pode rodar de novo.
--
--  Quando a reserva fica CONFIRMADA (sinal pago, confirmar_sinal):
--    · nasce a vistoria de ENTRADA no dia do check-in e a de SAÍDA no dia do
--      check-out (ligada à de entrada), AGENDADAS e sem responsável;
--    · numa remarcação (reserva nova com ID_RESERVA_ORIGINAL), as vistorias
--      ainda AGENDADAS passam para a reserva nova, com as novas datas e o
--      chalé dela (ID_RESERVA e ID_UNIDADE no mesmo UPDATE, como pede o
--      gatilho de coerência do Inspect);
--    · se as datas ou o chalé de uma reserva confirmada mudarem, as AGENDADAS
--      acompanham.
--  Quando a reserva é CANCELADA ou EXPIRADA, as vistorias AGENDADAS viram
--  CANCELADA. Vistorias EM_ANDAMENTO ou CONCLUIDA nunca são mexidas.
--  Pré-reserva PENDENTE não gera vistoria.
-- ════════════════════════════════════════════════════════════════════

set search_path = "SE", extensions, pg_temp;
begin;

create or replace function gerar_vistorias()
returns trigger
language plpgsql
security definer
set search_path = "SE", extensions, pg_temp
as $$
declare
  v_entrada_tipo bigint := (select "ID_TIPO_VISTORIA" from "VST_TIPO_VISTORIA" where "CD_TIPO_VISTORIA" = 'ENTRADA');
  v_saida_tipo   bigint := (select "ID_TIPO_VISTORIA" from "VST_TIPO_VISTORIA" where "CD_TIPO_VISTORIA" = 'SAIDA');
  v_entrada      uuid;
  v_era_confirmada boolean := tg_op = 'UPDATE' and old."TP_STATUS" = 'CONFIRMADA';
begin
  if v_entrada_tipo is null or v_saida_tipo is null then
    return new;                                   -- tipos ainda não cadastrados: não bloqueia a reserva
  end if;

  -- cancelamento ou vencimento: as AGENDADAS deixam de valer
  if new."TP_STATUS" in ('CANCELADA', 'EXPIRADA') then
    update "VST_VISTORIA" set "TP_STATUS" = 'CANCELADA', "DT_ATUALIZACAO" = now()
    where "ID_RESERVA" = new."ID_RESERVA" and "TP_STATUS" = 'AGENDADA';
    return new;
  end if;

  if new."TP_STATUS" <> 'CONFIRMADA' then
    return new;                                   -- PENDENTE e REMARCADA não mexem (a reserva nova da remarcação leva as vistorias)
  end if;

  -- remarcação: traz as vistorias AGENDADAS da reserva original para esta
  if new."ID_RESERVA_ORIGINAL" is not null and not v_era_confirmada then
    update "VST_VISTORIA" v
       set "ID_RESERVA" = new."ID_RESERVA", "ID_UNIDADE" = new."ID_UNIDADE",
           "DT_AGENDADA" = case when v."ID_TIPO_VISTORIA" = v_entrada_tipo then new."DT_CHECKIN" else new."DT_CHECKOUT" end,
           "DT_ATUALIZACAO" = now()
     where v."ID_RESERVA" = new."ID_RESERVA_ORIGINAL" and v."TP_STATUS" = 'AGENDADA'
       and v."ID_TIPO_VISTORIA" in (v_entrada_tipo, v_saida_tipo)
       and not exists (select 1 from "VST_VISTORIA" x where x."ID_RESERVA" = new."ID_RESERVA" and x."ID_TIPO_VISTORIA" = v."ID_TIPO_VISTORIA");
  end if;

  -- reserva confirmada que mudou de datas ou de chalé: as AGENDADAS acompanham
  if v_era_confirmada and (new."DT_CHECKIN", new."DT_CHECKOUT", new."ID_UNIDADE") is distinct from (old."DT_CHECKIN", old."DT_CHECKOUT", old."ID_UNIDADE") then
    update "VST_VISTORIA" v
       set "ID_UNIDADE" = new."ID_UNIDADE",
           "DT_AGENDADA" = case when v."ID_TIPO_VISTORIA" = v_entrada_tipo then new."DT_CHECKIN" else new."DT_CHECKOUT" end,
           "DT_ATUALIZACAO" = now()
     where v."ID_RESERVA" = new."ID_RESERVA" and v."TP_STATUS" = 'AGENDADA' and v."ID_TIPO_VISTORIA" in (v_entrada_tipo, v_saida_tipo);
  end if;

  -- garante a ENTRADA e a SAÍDA desta reserva (uma de cada; o índice único do Inspect impede duplicar)
  select "ID_VISTORIA" into v_entrada from "VST_VISTORIA"
   where "ID_RESERVA" = new."ID_RESERVA" and "ID_TIPO_VISTORIA" = v_entrada_tipo;
  if v_entrada is null then
    insert into "VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "ID_RESERVA", "DT_AGENDADA")
    values (new."ID_UNIDADE", v_entrada_tipo, new."ID_RESERVA", new."DT_CHECKIN")
    returning "ID_VISTORIA" into v_entrada;
  end if;
  if not exists (select 1 from "VST_VISTORIA" where "ID_RESERVA" = new."ID_RESERVA" and "ID_TIPO_VISTORIA" = v_saida_tipo) then
    insert into "VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "ID_RESERVA", "DT_AGENDADA", "ID_VISTORIA_ENTRADA")
    values (new."ID_UNIDADE", v_saida_tipo, new."ID_RESERVA", new."DT_CHECKOUT", v_entrada);
  end if;
  return new;
end;
$$;
revoke all on function gerar_vistorias() from public, anon, authenticated;

drop trigger if exists "TG_SIT_RESERVA_VISTORIAS" on "SIT_RESERVA";
create trigger "TG_SIT_RESERVA_VISTORIAS"
  after insert or update of "TP_STATUS", "DT_CHECKIN", "DT_CHECKOUT", "ID_UNIDADE" on "SIT_RESERVA"
  for each row execute function gerar_vistorias();

-- reservas já confirmadas e ainda por acontecer: cria as vistorias que faltam
update "SIT_RESERVA" set "TP_STATUS" = "TP_STATUS"
 where "TP_STATUS" = 'CONFIRMADA' and "DT_CHECKOUT" >= current_date;

commit;

select (select count(*) from "VST_VISTORIA" where "ID_RESERVA" is not null) as vistorias_de_reservas,
       (select count(*) from "SIT_RESERVA" where "TP_STATUS" = 'CONFIRMADA' and "DT_CHECKOUT" >= current_date) as reservas_confirmadas_futuras;
