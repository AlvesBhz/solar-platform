-- Extrai as linhas de exemplo de cada tabela em JSON (entrada do gerar_der.py).
-- Uso, num banco de teste depois de exemplos_der.sql: psql -At -f exportar_exemplos.sql > exemplos_der.json
select jsonb_object_agg(t, rows) from (
  select 'PROPRIEDADE' t, jsonb_agg(to_jsonb(x)) rows from PROPRIEDADE x union all
  select 'UNIDADE', jsonb_agg(to_jsonb(x)) from UNIDADE x union all
  select 'TARIFA', jsonb_agg(to_jsonb(x) order by x.ID_TARIFA) from TARIFA x union all
  select 'AJUSTE_DIARIO', jsonb_agg(to_jsonb(x) order by x.DT_REF) from AJUSTE_DIARIO x union all
  select 'HOSPEDE', jsonb_agg(to_jsonb(x) order by x.ID_HOSPEDE) from HOSPEDE x union all
  select 'RESERVA', jsonb_agg(to_jsonb(x) order by x.ID_RESERVA) from RESERVA x union all
  select 'PAGAMENTO', jsonb_agg(to_jsonb(x) order by x.ID_PAGAMENTO) from PAGAMENTO x union all
  select 'CALENDARIO_EXTERNO', jsonb_agg(to_jsonb(x) order by x.ID_CALENDARIO) from CALENDARIO_EXTERNO x union all
  select 'BLOQUEIO', jsonb_agg(to_jsonb(x) order by x.ID_BLOQUEIO) from BLOQUEIO x) s;
