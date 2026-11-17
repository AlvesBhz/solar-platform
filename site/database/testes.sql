-- ════════════════════════════════════════════════════════════════════
--  Testes da proposta (rodar depois de schema.sql e seed_exemplo.sql,
--  num banco de TESTE: os dados abaixo são criados só para os testes).
--  Valores reais: R$ 1.700 a noite para o casal · R$ 300 por criança
--  (2 a 13 anos) por noite · bebê não paga mas ocupa vaga · sem taxa de
--  limpeza · até 2 adultos e 2 crianças/bebês · até 7 noites · sinal 50%.
-- ════════════════════════════════════════════════════════════════════

-- Dados SÓ PARA TESTE: uma temporada, ajustes, um bloqueio do Airbnb e uma reserva
insert into TARIFA (ID_UNIDADE, NM_TARIFA, DT_INI, DT_FIM, NO_PRIORIDADE, VL_NOITE, QTDE_ADULTOS_INCLUSOS, VL_CRIANCA, QTDE_MIN_NOITES)
select ID_UNIDADE, 'Réveillon (teste)', '2026-12-29', '2027-01-02', 20, 2500.00, 2, 300.00, 4 from UNIDADE where CD_UNIDADE = 'casa-do-mirante';
insert into AJUSTE_DIARIO (ID_UNIDADE, DT_REF, VL_NOITE, DS_OBSERVACAO) select ID_UNIDADE, '2027-04-21', 1900.00, 'Tiradentes (teste)' from UNIDADE where CD_UNIDADE = 'casa-do-mirante';
insert into AJUSTE_DIARIO (ID_UNIDADE, DT_REF, SG_FECHADO)             select ID_UNIDADE, '2027-05-12', true from UNIDADE where CD_UNIDADE = 'casa-do-mirante';
insert into AJUSTE_DIARIO (ID_UNIDADE, DT_REF, SG_SEM_CHEGADA)         select ID_UNIDADE, '2027-06-04', true from UNIDADE where CD_UNIDADE = 'casa-do-mirante';
insert into CALENDARIO_EXTERNO (ID_UNIDADE, TP_CANAL, DS_URL_IMPORTACAO) select ID_UNIDADE, 'AIRBNB', 'https://exemplo.invalid/airbnb.ics' from UNIDADE where CD_UNIDADE = 'casa-do-mirante';
insert into BLOQUEIO (ID_UNIDADE, DT_INI, DT_FIM, TP_MOTIVO, ID_CALENDARIO, CD_EXTERNO)
select u.ID_UNIDADE, '2027-03-12', '2027-03-15', 'CANAL_EXTERNO', c.ID_CALENDARIO, 'teste-1' from UNIDADE u join CALENDARIO_EXTERNO c on c.ID_UNIDADE = u.ID_UNIDADE;
insert into HOSPEDE (NM_HOSPEDE, DS_EMAIL) values ('Hóspede Teste', 'teste@exemplo.invalid');
insert into RESERVA (ID_UNIDADE, ID_HOSPEDE, DT_CHECKIN, DT_CHECKOUT, QTDE_ADULTOS, TP_STATUS, TP_CANAL, VL_HOSPEDAGEM)
select u.ID_UNIDADE, h.ID_HOSPEDE, '2027-03-19', '2027-03-21', 2, 'CONFIRMADA', 'TELEFONE', 3400.00 from UNIDADE u, HOSPEDE h where u.CD_UNIDADE = 'casa-do-mirante';

create or replace function pg_temp.cons(ci date, co date, a int, c int default 0)
returns record language sql as $$
  select (disponivel, motivo, vl_hospedagem, vl_total)
  from consultar_disponibilidade(ci, co, a, c) where cd_unidade = 'casa-do-mirante'
$$;

create or replace function pg_temp.ok(nome text, ci date, co date, a int, c int, esperado_hosp numeric, esperado_total numeric)
returns text language plpgsql as $$
declare r record;
begin
  select * into r from consultar_disponibilidade(ci, co, a, c) where cd_unidade = 'casa-do-mirante';
  if not r.disponivel or r.vl_hospedagem <> esperado_hosp or r.vl_total <> esperado_total then
    raise exception 'FALHOU %: disponivel=% motivo=% hosp=% total=% (esperado % / %)',
      nome, r.disponivel, r.motivo, r.vl_hospedagem, r.vl_total, esperado_hosp, esperado_total;
  end if;
  return format('ok  %-58s R$ %s', nome, r.vl_total);
end $$;

create or replace function pg_temp.nao(nome text, ci date, co date, a int, c int, esperado_motivo text)
returns text language plpgsql as $$
declare r record;
begin
  select * into r from consultar_disponibilidade(ci, co, a, c) where cd_unidade = 'casa-do-mirante';
  if r.disponivel or r.motivo is distinct from esperado_motivo then
    raise exception 'FALHOU %: disponivel=% motivo=% (esperado indisponível por %)', nome, r.disponivel, r.motivo, esperado_motivo;
  end if;
  return format('ok  %-58s indisponível: %s', nome, r.motivo);
end $$;

\echo '── Preços'
select pg_temp.ok ('Casal, 2 noites em dia de semana',                  '2027-03-02','2027-03-04', 2,0, 3400, 3400);
select pg_temp.ok ('Casal, 2 noites no fim de semana (mesmo preço)',    '2027-03-05','2027-03-07', 2,0, 3400, 3400);
select pg_temp.ok ('Casal + 2 crianças (R$ 300 cada por noite)',        '2027-03-02','2027-03-04', 2,2, 4600, 4600);
select pg_temp.ok ('1 adulto + 1 criança (criança paga à parte)',       '2027-03-02','2027-03-04', 1,1, 4000, 4000);
select pg_temp.ok ('Temporada de teste: Réveillon 4 noites a R$ 2.500', '2026-12-29','2027-01-02', 2,0, 10000, 10000);
select pg_temp.ok ('Ajuste de preço numa data (R$ 1.900)',              '2027-04-20','2027-04-22', 2,0, 3600, 3600);

\echo '── Regras de venda'
select pg_temp.nao('Réveillon com 3 noites (mínimo 4)',                 '2026-12-29','2027-01-01', 2,0, 'min_noites');
select pg_temp.nao('Noite fechada',                                     '2027-05-11','2027-05-13', 2,0, 'fechado');
select pg_temp.nao('Check-in em data sem chegada',                      '2027-06-04','2027-06-06', 2,0, 'sem_chegada');
select pg_temp.ok ('…mas atravessar essa data é permitido',             '2027-06-03','2027-06-05', 2,0, 3400, 3400);
select pg_temp.nao('Datas sem tarifa cadastrada (venda não aberta)',    '2028-01-05','2028-01-07', 2,0, 'sem_tarifa');

\echo '── Validações'
select pg_temp.nao('Check-out igual ao check-in',                       '2027-03-02','2027-03-02', 2,0, 'datas_invalidas');
select pg_temp.nao('Data no passado',                                   '2026-01-10','2026-01-12', 2,0, 'data_passada');
select pg_temp.nao('Estadia acima de 7 noites',                         '2027-03-01','2027-03-09', 2,0, 'estadia_longa');
select pg_temp.ok ('Estadia de exatamente 7 noites',                    '2027-03-01','2027-03-08', 2,0, 11900, 11900);
select pg_temp.nao('3 adultos (máximo 2)',                              '2027-03-02','2027-03-04', 3,0, 'capacidade');
select pg_temp.nao('3 crianças (máximo 2)',                             '2027-03-02','2027-03-04', 2,3, 'capacidade');
do $$ declare r record; begin
  select * into r from consultar_disponibilidade('2027-03-02','2027-03-04', 2, 2, 1);
  if r.disponivel or r.motivo <> 'capacidade' then raise exception 'FALHOU: 2 adultos + 2 crianças + 1 bebê foi aceito'; end if;
  raise notice 'ok  2 adultos + 2 crianças + 1 bebê (bebê ocupa vaga)                indisponível: capacidade';
  select * into r from consultar_disponibilidade('2027-03-02','2027-03-04', 2, 1, 1);
  if not r.disponivel or r.vl_total <> 4000 then raise exception 'FALHOU: casal + 1 criança + 1 bebê = %', r.vl_total; end if;
  raise notice 'ok  Casal + 1 criança + 1 bebê (bebê não paga)                       R$ %', r.vl_total;
  if (r.ds_detalhe->0->>'qtde_bebes')::int <> 1 or (r.ds_detalhe->0->>'vl_bebes')::numeric <> 0
     or (r.ds_detalhe->0->>'vl_criancas')::numeric <> 300 then
    raise exception 'FALHOU: detalhe da noite não separa criança e bebê: %', r.ds_detalhe->0;
  end if;
  raise notice 'ok  Detalhe da noite: 1 criança R$ %, 1 bebê R$ %', r.ds_detalhe->0->>'vl_criancas', r.ds_detalhe->0->>'vl_bebes';
  select * into r from consultar_disponibilidade('2027-03-02','2027-03-04', 2, 0, 2);
  if not r.disponivel or r.vl_total <> 3400 then raise exception 'FALHOU: casal + 2 bebês = %', r.vl_total; end if;
  raise notice 'ok  Casal + 2 bebês (ocupam as 2 vagas de criança, não pagam)        R$ %', r.vl_total;
  select * into r from consultar_disponibilidade('2027-03-02','2027-03-04', 2, 0, 3);
  if r.disponivel or r.motivo <> 'capacidade' then raise exception 'FALHOU: 3 bebês aceitos'; end if;
  raise notice 'ok  Casal + 3 bebês                                                 indisponível: capacidade';
end $$;

\echo '── Ocupação'
select pg_temp.nao('Sobrepõe reserva confirmada (19–21/03)',            '2027-03-20','2027-03-22', 2,0, 'ocupado');
select pg_temp.ok ('Entra no dia em que a reserva sai (21/03)',         '2027-03-21','2027-03-23', 2,0, 3400, 3400);
select pg_temp.ok ('Sai no dia em que a reserva entra (19/03)',         '2027-03-17','2027-03-19', 2,0, 3400, 3400);
select pg_temp.nao('Bloqueio importado do Airbnb (12–15/03)',           '2027-03-14','2027-03-16', 2,0, 'ocupado');

\echo '── Pré-reserva e pagamento'
select cd_reserva like 'SE-%' as codigo_ok, vl_total, vl_sinal,
       dt_expira between now() + interval '29 minutes' and now() + interval '31 minutes' as segura_30_min
from criar_pre_reserva('casa-do-mirante', '2027-04-06', '2027-04-08', 2, 1);
select pg_temp.nao('Datas seguradas por uma pré-reserva',               '2027-04-06','2027-04-08', 2,0, 'ocupado');
do $$ begin
  perform criar_pre_reserva('casa-do-mirante', '2027-04-07', '2027-04-09', 2, 0);
  raise exception 'FALHOU: segunda pré-reserva nas mesmas noites foi aceita';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'ocupado' then raise; end if;
  raise notice 'ok  Segunda pré-reserva nas mesmas noites é recusada (%)', sqlerrm;
end $$;
-- Pix gerado para a pré-reserva e aprovado pelo Mercado Pago
insert into PAGAMENTO (ID_RESERVA, TP_METODO, VL_PAGAMENTO, CD_EXTERNO, DS_PIX_COPIA_E_COLA, DT_EXPIRA)
select ID_RESERVA, 'PIX', VL_SINAL, 'MP-TESTE-1', '00020126...exemplo', now() + interval '30 minutes' from RESERVA where TP_STATUS = 'PENDENTE';
do $$ begin
  update PAGAMENTO set TP_STATUS = 'APROVADO' where CD_EXTERNO = 'MP-TESTE-1';
  raise exception 'FALHOU: pagamento aprovado sem data de pagamento';
exception when check_violation then raise notice 'ok  Pagamento aprovado exige a data do pagamento';
end $$;
update PAGAMENTO set TP_STATUS = 'APROVADO', DT_PAGAMENTO = now() where CD_EXTERNO = 'MP-TESTE-1';
select 'ok  Pagamento registrado: ' || TP_PARCELA || ' · ' || TP_METODO || ' · R$ ' || VL_PAGAMENTO || ' · ' || TP_STATUS from PAGAMENTO;
select 'ok  Saldo a pagar no check-in: R$ ' || VL_SALDO || ' (total R$ ' || VL_TOTAL || ' − sinal R$ ' || VL_SINAL || ')' from RESERVA where DT_CHECKIN = '2027-04-06';
-- saldo pago no check-in, direto na pousada, em dinheiro
insert into PAGAMENTO (ID_RESERVA, TP_PARCELA, TP_PROVEDOR, TP_METODO, VL_PAGAMENTO, TP_STATUS, DT_PAGAMENTO)
select ID_RESERVA, 'SALDO', 'MANUAL', 'DINHEIRO', VL_SALDO, 'APROVADO', now() from RESERVA where DT_CHECKIN = '2027-04-06';
do $$ begin
  insert into PAGAMENTO (ID_RESERVA, TP_PARCELA, TP_PROVEDOR, TP_METODO, VL_PAGAMENTO) select ID_RESERVA, 'SALDO', 'MERCADO_PAGO', 'DINHEIRO', 1 from RESERVA limit 1;
  raise exception 'FALHOU: dinheiro aceito pelo Mercado Pago';
exception when check_violation then raise notice 'ok  Dinheiro só como pagamento manual na pousada';
end $$;
select 'ok  Total quitado: R$ ' || sum(VL_PAGAMENTO) || ' em ' || count(*) || ' parcelas (sinal + saldo)' from PAGAMENTO where TP_STATUS = 'APROVADO';
do $$ begin
  insert into PAGAMENTO (ID_RESERVA, TP_PARCELA, TP_METODO, VL_PAGAMENTO) select ID_RESERVA, 'ENTRADA', 'PIX', 1 from RESERVA limit 1;
  raise exception 'FALHOU: parcela fora da lista foi aceita';
exception when check_violation then raise notice 'ok  Parcela só aceita SINAL ou SALDO';
end $$;
-- simula o vencimento da pré-reserva de outra estadia
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-08-10', '2027-08-12', 2, 0);
update RESERVA set DT_EXPIRA = now() - interval '1 minute' where TP_STATUS = 'PENDENTE' and DT_CHECKIN = '2027-08-10';
select pg_temp.ok ('Pré-reserva vencida libera as datas',               '2027-08-10','2027-08-12', 2,0, 3400, 3400);

\echo '── Remarcação (o sinal não é devolvido, vira crédito)'
-- reserva do site não confirma sem o aceite da política
do $$ begin
  update RESERVA set TP_STATUS = 'CONFIRMADA', ID_HOSPEDE = (select ID_HOSPEDE from HOSPEDE limit 1), DT_EXPIRA = null
  where DT_CHECKIN = '2027-04-06' and TP_STATUS = 'PENDENTE';
  raise exception 'FALHOU: reserva do site confirmada sem aceite da política';
exception when check_violation then raise notice 'ok  Reserva do site só confirma com a política aceita';
end $$;
-- confirma a pré-reserva paga (com o aceite) e depois remarca para outra data
update RESERVA set TP_STATUS = 'CONFIRMADA', ID_HOSPEDE = (select ID_HOSPEDE from HOSPEDE limit 1), DT_EXPIRA = null,
                   NO_VERSAO_POLITICA = 1, DT_ACEITE_POLITICA = now()
where DT_CHECKIN = '2027-04-06' and TP_STATUS = 'PENDENTE';
with antiga as (
  update RESERVA set TP_STATUS = 'REMARCADA', DT_ATUALIZACAO = now()
  where DT_CHECKIN = '2027-04-06' and TP_STATUS = 'CONFIRMADA'
  returning *
)
insert into RESERVA (ID_UNIDADE, ID_HOSPEDE, DT_CHECKIN, DT_CHECKOUT, QTDE_ADULTOS, QTDE_CRIANCAS, TP_STATUS, VL_HOSPEDAGEM, VL_SINAL, ID_RESERVA_ORIGINAL, NO_VERSAO_POLITICA, DT_ACEITE_POLITICA)
select ID_UNIDADE, ID_HOSPEDE, '2027-05-18', '2027-05-20', QTDE_ADULTOS, QTDE_CRIANCAS, 'CONFIRMADA', VL_HOSPEDAGEM, VL_SINAL, ID_RESERVA, NO_VERSAO_POLITICA, DT_ACEITE_POLITICA from antiga;
select pg_temp.ok ('Datas antigas liberadas após a remarcação',         '2027-04-06','2027-04-08', 2,0, 3400, 3400);
select pg_temp.nao('Novas datas ocupadas pela reserva remarcada',       '2027-05-18','2027-05-20', 2,0, 'ocupado');
select 'ok  Crédito na nova reserva: R$ ' || sum(pg.VL_PAGAMENTO) || ' de sinal pago na reserva original'
from RESERVA nova join PAGAMENTO pg on pg.ID_RESERVA = nova.ID_RESERVA_ORIGINAL and pg.TP_STATUS = 'APROVADO' and pg.TP_PARCELA = 'SINAL'
where nova.DT_CHECKIN = '2027-05-18';

\echo '── Cancelamento por arrependimento (CDC art. 49)'
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-10-05', '2027-10-07', 2, 0);
do $$ begin
  update RESERVA set TP_STATUS = 'CANCELADA' where DT_CHECKIN = '2027-10-05';
  raise exception 'FALHOU: cancelamento sem motivo aceito';
exception when check_violation then raise notice 'ok  Cancelamento exige o motivo';
end $$;
update RESERVA set TP_STATUS = 'CANCELADA', TP_MOTIVO_CANCELAMENTO = 'ARREPENDIMENTO', DT_ATUALIZACAO = now() where DT_CHECKIN = '2027-10-05';
select pg_temp.ok ('Cancelada por arrependimento libera as datas',      '2027-10-05','2027-10-07', 2,0, 3400, 3400);

\echo '── Proteção contra overbooking no próprio banco'
do $$ begin
  insert into RESERVA (ID_UNIDADE, DT_CHECKIN, DT_CHECKOUT, QTDE_ADULTOS, TP_STATUS, TP_CANAL, VL_HOSPEDAGEM, ID_HOSPEDE)
  select ID_UNIDADE, '2027-03-20', '2027-03-21', 2, 'CONFIRMADA', 'TELEFONE', 1, (select ID_HOSPEDE from HOSPEDE limit 1) from UNIDADE where CD_UNIDADE = 'casa-do-mirante';
  raise exception 'FALHOU: banco aceitou duas reservas na mesma noite';
exception when exclusion_violation then
  raise notice 'ok  Inserção direta sobreposta é barrada pela constraint (exclusion_violation)';
end $$;

\echo '── Detalhe noite a noite (o que o site recebe): casal + 1 criança, 3 noites'
select cd_unidade, disponivel, qtde_noites, vl_hospedagem, vl_taxa_limpeza, vl_total, vl_medio_noite, vl_sinal, ds_detalhe
from consultar_disponibilidade('2027-03-04', '2027-03-07', 2, 1);
