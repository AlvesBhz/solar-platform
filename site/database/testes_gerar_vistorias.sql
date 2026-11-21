-- Testes da geração automática de vistorias (banco de TESTE, nunca produção).
-- Ordem: supabase_simulado.sql, schema.sql, seed_exemplo.sql, migracao_vistorias.sql (Inspect), migracao_gerar_vistorias.sql, este.
set search_path = "SE", extensions, public;
\echo '── Geração automática de vistorias'
create or replace function pg_temp.vist(cd text)
returns table (tipo text, status text, dia date, unidade bigint, liga_entrada boolean) language sql as $$
  select t."CD_TIPO_VISTORIA", v."TP_STATUS", v."DT_AGENDADA", v."ID_UNIDADE",
         v."ID_VISTORIA_ENTRADA" is not null and exists (select 1 from "VST_VISTORIA" e where e."ID_VISTORIA" = v."ID_VISTORIA_ENTRADA" and e."ID_RESERVA" = v."ID_RESERVA")
  from "VST_VISTORIA" v join "VST_TIPO_VISTORIA" t using ("ID_TIPO_VISTORIA") join "SIT_RESERVA" r using ("ID_RESERVA")
  where r."CD_RESERVA" = cd order by t."CD_TIPO_VISTORIA"
$$;
do $$ declare cd text; n int; r record; begin
  -- pré-reserva e cadastro: ainda sem vistoria
  select c.cd_reserva into cd from criar_pre_reserva('casa-do-mirante', '2027-06-08', '2027-06-10', 2, 0) c;
  perform confirmar_reserva(cd, 'Vistoria Teste', 'vistoria@exemplo.invalid', null, 'BR', '52998224725', null, null, null, null, null, date '1985-01-01');
  select count(*) into n from pg_temp.vist(cd);
  if n <> 0 then raise exception 'FALHOU: pré-reserva sem sinal gerou % vistoria(s)', n; end if;
  -- sinal confirmado: ENTRADA no check-in e SAÍDA no check-out, ligada à entrada
  perform confirmar_sinal(cd, 'Equipe (teste)', 'E2E-VIST-0001', 9999);
  select count(*) into n from pg_temp.vist(cd) where status = 'AGENDADA'
    and ((tipo = 'ENTRADA' and dia = '2027-06-08') or (tipo = 'SAIDA' and dia = '2027-06-10' and liga_entrada));
  if n <> 2 then raise exception 'FALHOU: confirmação não gerou ENTRADA e SAÍDA certas: %', (select json_agg(x) from pg_temp.vist(cd) x); end if;
  raise notice 'ok  Pré-reserva não gera vistoria; ao confirmar o sinal nascem ENTRADA (08/06) e SAÍDA (10/06) ligada à entrada';
  -- de novo a mesma reserva: não duplica
  update "SIT_RESERVA" set "TP_STATUS" = "TP_STATUS" where "CD_RESERVA" = cd;
  select count(*) into n from pg_temp.vist(cd);
  if n <> 2 then raise exception 'FALHOU: duplicou vistorias (%)', n; end if;
  -- datas mudam: AGENDADAS acompanham
  update "SIT_RESERVA" set "DT_CHECKIN" = '2027-06-09', "DT_CHECKOUT" = '2027-06-11' where "CD_RESERVA" = cd;
  select count(*) into n from pg_temp.vist(cd) where (tipo = 'ENTRADA' and dia = '2027-06-09') or (tipo = 'SAIDA' and dia = '2027-06-11');
  if n <> 2 then raise exception 'FALHOU: vistorias não acompanharam as novas datas'; end if;
  raise notice 'ok  Não duplica; mudança de datas move as vistorias agendadas';
end $$;
do $$ declare cd_old text; cd_new text; n int; begin
  -- remarcação: reserva nova (com ID_RESERVA_ORIGINAL) leva as vistorias AGENDADAS
  select "CD_RESERVA" into cd_old from "SIT_RESERVA" where "DT_CHECKIN" = '2027-06-09';
  with antiga as (
    update "SIT_RESERVA" set "TP_STATUS" = 'REMARCADA', "DT_ATUALIZACAO" = now() where "CD_RESERVA" = cd_old returning *)
  insert into "SIT_RESERVA" ("ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "TP_CANAL", "VL_HOSPEDAGEM", "VL_SINAL",
                             "ID_RESERVA_ORIGINAL", "NO_VERSAO_POLITICA", "DT_ACEITE_POLITICA", "DS_DETALHE_PRECOS")
  select "ID_UNIDADE", "ID_HOSPEDE", '2027-07-20', '2027-07-22', "QTDE_ADULTOS", 'CONFIRMADA', 'SITE', "VL_HOSPEDAGEM", "VL_SINAL",
         "ID_RESERVA", "NO_VERSAO_POLITICA", "DT_ACEITE_POLITICA", "DS_DETALHE_PRECOS" from antiga
  returning "CD_RESERVA" into cd_new;
  select count(*) into n from pg_temp.vist(cd_old);
  if n <> 0 then raise exception 'FALHOU: vistorias ficaram na reserva remarcada'; end if;
  select count(*) into n from pg_temp.vist(cd_new) where status = 'AGENDADA' and ((tipo = 'ENTRADA' and dia = '2027-07-20') or (tipo = 'SAIDA' and dia = '2027-07-22' and liga_entrada));
  if n <> 2 then raise exception 'FALHOU: remarcação não levou as vistorias: %', (select json_agg(x) from pg_temp.vist(cd_new) x); end if;
  raise notice 'ok  Remarcação leva as 2 vistorias agendadas para a reserva nova, nas novas datas';
  -- cancelamento: AGENDADAS viram CANCELADA; uma já iniciada não muda
  update "VST_VISTORIA" set "TP_STATUS" = 'EM_ANDAMENTO', "DT_INICIO" = now(),
         "ID_USUARIO" = (select "ID_USUARIO" from "VST_USUARIO" limit 1)
   where "ID_RESERVA" = (select "ID_RESERVA" from "SIT_RESERVA" where "CD_RESERVA" = cd_new)
     and "ID_TIPO_VISTORIA" = (select "ID_TIPO_VISTORIA" from "VST_TIPO_VISTORIA" where "CD_TIPO_VISTORIA" = 'ENTRADA')
     and exists (select 1 from "VST_USUARIO");
  update "SIT_RESERVA" set "TP_STATUS" = 'CANCELADA', "TP_MOTIVO_CANCELAMENTO" = 'ARREPENDIMENTO' where "CD_RESERVA" = cd_new;
  select count(*) into n from pg_temp.vist(cd_new) where status = 'AGENDADA';
  if n <> 0 then raise exception 'FALHOU: cancelamento deixou vistoria agendada'; end if;
  select count(*) into n from pg_temp.vist(cd_new) where status = 'CANCELADA' and tipo = 'SAIDA';
  if n <> 1 then raise exception 'FALHOU: SAÍDA não foi cancelada'; end if;
  raise notice 'ok  Cancelamento cancela as vistorias agendadas (as já iniciadas ficam como estão)';
end $$;
do $$ declare cd text; n int; begin
  -- pré-reserva que vence: nada a cancelar, nada criado
  select c.cd_reserva into cd from criar_pre_reserva('casa-do-mirante', '2027-08-24', '2027-08-26', 2, 0) c;
  update "SIT_RESERVA" set "TP_STATUS" = 'EXPIRADA' where "CD_RESERVA" = cd;
  select count(*) into n from pg_temp.vist(cd);
  if n <> 0 then raise exception 'FALHOU: pré-reserva vencida gerou vistoria'; end if;
  raise notice 'ok  Pré-reserva vencida não gera vistoria';
end $$;
