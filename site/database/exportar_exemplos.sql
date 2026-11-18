-- Extrai as linhas de exemplo de cada tabela em JSON (entrada do gerar_der.py).
-- Uso, num banco de teste depois de exemplos_der.sql: psql -At -f exportar_exemplos.sql > exemplos_der.json
select jsonb_object_agg(t, rows) from (
  select 'SIT_PROPRIEDADE' t, jsonb_agg(to_jsonb(x)) rows from SIT_PROPRIEDADE x union all
  select 'SIT_UNIDADE', jsonb_agg(to_jsonb(x)) from SIT_UNIDADE x union all
  select 'SIT_TARIFA', jsonb_agg(to_jsonb(x) order by x.ID_TARIFA) from SIT_TARIFA x union all
  select 'SIT_AJUSTE_DIARIO', jsonb_agg(to_jsonb(x) order by x.DT_REF) from SIT_AJUSTE_DIARIO x union all
  select 'SIT_HOSPEDE', jsonb_agg(to_jsonb(x) order by x.ID_HOSPEDE) from SIT_HOSPEDE x union all
  select 'SIT_RESERVA', jsonb_agg(to_jsonb(x) order by x.ID_RESERVA) from SIT_RESERVA x union all
  select 'SIT_PAGAMENTO', jsonb_agg(to_jsonb(x) order by x.ID_PAGAMENTO) from SIT_PAGAMENTO x union all
  select 'SIT_CALENDARIO_EXTERNO', jsonb_agg(to_jsonb(x) order by x.ID_CALENDARIO) from SIT_CALENDARIO_EXTERNO x union all
  select 'SIT_BLOQUEIO', jsonb_agg(to_jsonb(x) order by x.ID_BLOQUEIO) from SIT_BLOQUEIO x) s;
