-- ════════════════════════════════════════════════════════════════════
--  Testes da proposta (rodar depois de schema.sql e seed_exemplo.sql,
--  num banco de TESTE: os dados abaixo são criados só para os testes).
--  Valores reais: R$ 1.700 a noite para o casal · R$ 3,00 por criança
--  por noite · sem taxa de limpeza · até 2 adultos e 2 crianças.
-- ════════════════════════════════════════════════════════════════════

-- Dados SÓ PARA TESTE: uma temporada, ajustes, um bloqueio do Airbnb e uma reserva
insert into tarifas (unidade_id, nome, periodo, prioridade, valor_noite, adultos_inclusos, valor_crianca, min_noites)
select id, 'Réveillon (teste)', '[2026-12-29,2027-01-02)', 20, 2500.00, 2, 3.00, 4 from unidades where slug = 'chale-solar';
insert into ajustes_diarios (unidade_id, data, valor_noite, observacao) select id, '2027-04-21', 1900.00, 'Tiradentes (teste)' from unidades where slug = 'chale-solar';
insert into ajustes_diarios (unidade_id, data, fechado)                 select id, '2027-05-12', true from unidades where slug = 'chale-solar';
insert into ajustes_diarios (unidade_id, data, sem_chegada)             select id, '2027-06-04', true from unidades where slug = 'chale-solar';
insert into calendarios_externos (unidade_id, canal, url_importacao)    select id, 'airbnb', 'https://exemplo.invalid/airbnb.ics' from unidades where slug = 'chale-solar';
insert into bloqueios (unidade_id, periodo, motivo, calendario_id, uid_externo)
select u.id, '[2027-03-12,2027-03-15)', 'canal_externo', c.id, 'teste-1' from unidades u join calendarios_externos c on c.unidade_id = u.id;
insert into hospedes (nome, email) values ('Hóspede Teste', 'teste@exemplo.invalid');
insert into reservas (unidade_id, hospede_id, periodo, adultos, status, valor_hospedagem)
select u.id, h.id, '[2027-03-19,2027-03-21)', 2, 'confirmada', 3400.00 from unidades u, hospedes h where u.slug = 'chale-solar';

create or replace function pg_temp.cons(ci date, co date, a int, c int default 0)
returns record language sql as $$
  select (disponivel, motivo, valor_hospedagem, valor_total)
  from consultar_disponibilidade(ci, co, a, c) where unidade = 'chale-solar'
$$;

create or replace function pg_temp.ok(nome text, ci date, co date, a int, c int, esperado_hosp numeric, esperado_total numeric)
returns text language plpgsql as $$
declare r record;
begin
  select * into r from consultar_disponibilidade(ci, co, a, c) where unidade = 'chale-solar';
  if not r.disponivel or r.valor_hospedagem <> esperado_hosp or r.valor_total <> esperado_total then
    raise exception 'FALHOU %: disponivel=% motivo=% hosp=% total=% (esperado % / %)',
      nome, r.disponivel, r.motivo, r.valor_hospedagem, r.valor_total, esperado_hosp, esperado_total;
  end if;
  return format('ok  %-58s R$ %s', nome, r.valor_total);
end $$;

create or replace function pg_temp.nao(nome text, ci date, co date, a int, c int, esperado_motivo text)
returns text language plpgsql as $$
declare r record;
begin
  select * into r from consultar_disponibilidade(ci, co, a, c) where unidade = 'chale-solar';
  if r.disponivel or r.motivo is distinct from esperado_motivo then
    raise exception 'FALHOU %: disponivel=% motivo=% (esperado indisponível por %)', nome, r.disponivel, r.motivo, esperado_motivo;
  end if;
  return format('ok  %-58s indisponível: %s', nome, r.motivo);
end $$;

\echo '── Preços'
select pg_temp.ok ('Casal, 2 noites em dia de semana',                  '2027-03-02','2027-03-04', 2,0, 3400, 3400);
select pg_temp.ok ('Casal, 2 noites no fim de semana (mesmo preço)',    '2027-03-05','2027-03-07', 2,0, 3400, 3400);
select pg_temp.ok ('Casal + 2 crianças (R$ 3 cada por noite)',          '2027-03-02','2027-03-04', 2,2, 3412, 3412);
select pg_temp.ok ('1 adulto + 1 criança (criança paga à parte)',       '2027-03-02','2027-03-04', 1,1, 3406, 3406);
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
select pg_temp.nao('Estadia acima de 30 noites',                        '2027-03-01','2027-04-15', 2,0, 'estadia_longa');
select pg_temp.nao('3 adultos (máximo 2)',                              '2027-03-02','2027-03-04', 3,0, 'capacidade');
select pg_temp.nao('3 crianças (máximo 2)',                             '2027-03-02','2027-03-04', 2,3, 'capacidade');

\echo '── Ocupação'
select pg_temp.nao('Sobrepõe reserva confirmada (19–21/03)',            '2027-03-20','2027-03-22', 2,0, 'ocupado');
select pg_temp.ok ('Entra no dia em que a reserva sai (21/03)',         '2027-03-21','2027-03-23', 2,0, 3400, 3400);
select pg_temp.ok ('Sai no dia em que a reserva entra (19/03)',         '2027-03-17','2027-03-19', 2,0, 3400, 3400);
select pg_temp.nao('Bloqueio importado do Airbnb (12–15/03)',           '2027-03-14','2027-03-16', 2,0, 'ocupado');

\echo '── Pré-reserva e pagamento'
select codigo like 'SE-%' as codigo_ok, valor_total from criar_pre_reserva('chale-solar', '2027-04-06', '2027-04-08', 2, 1);
select pg_temp.nao('Datas seguradas por uma pré-reserva',               '2027-04-06','2027-04-08', 2,0, 'ocupado');
do $$ begin
  perform criar_pre_reserva('chale-solar', '2027-04-07', '2027-04-09', 2, 0);
  raise exception 'FALHOU: segunda pré-reserva nas mesmas noites foi aceita';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'ocupado' then raise; end if;
  raise notice 'ok  Segunda pré-reserva nas mesmas noites é recusada (%)', sqlerrm;
end $$;
-- Pix gerado para a pré-reserva e aprovado pelo Mercado Pago
insert into pagamentos (reserva_id, metodo, valor, id_externo, pix_copia_e_cola, expira_em)
select id, 'pix', valor_total, 'MP-TESTE-1', '00020126...exemplo', now() + interval '30 minutes' from reservas where status = 'pendente';
do $$ begin
  update pagamentos set status = 'aprovado' where id_externo = 'MP-TESTE-1';
  raise exception 'FALHOU: pagamento aprovado sem data de pagamento';
exception when check_violation then raise notice 'ok  Pagamento aprovado exige a data do pagamento';
end $$;
update pagamentos set status = 'aprovado', pago_em = now() where id_externo = 'MP-TESTE-1';
select 'ok  Pagamento registrado: ' || metodo || ' · R$ ' || valor || ' · ' || status from pagamentos;
-- simula o vencimento da pré-reserva de outra estadia
select codigo like 'SE-%' from criar_pre_reserva('chale-solar', '2027-08-10', '2027-08-12', 2, 0);
update reservas set expira_em = now() - interval '1 minute' where status = 'pendente' and periodo = '[2027-08-10,2027-08-12)';
select pg_temp.ok ('Pré-reserva vencida libera as datas',               '2027-08-10','2027-08-12', 2,0, 3400, 3400);

\echo '── Proteção contra overbooking no próprio banco'
do $$ begin
  insert into reservas (unidade_id, periodo, adultos, status, valor_hospedagem, hospede_id)
  select id, '[2027-03-20,2027-03-21)', 2, 'confirmada', 1, (select id from hospedes limit 1) from unidades where slug = 'chale-solar';
  raise exception 'FALHOU: banco aceitou duas reservas na mesma noite';
exception when exclusion_violation then
  raise notice 'ok  Inserção direta sobreposta é barrada pela constraint (exclusion_violation)';
end $$;

\echo '── Detalhe noite a noite (o que o site recebe): casal + 1 criança, 3 noites'
select unidade, disponivel, noites, valor_hospedagem, taxa_limpeza, valor_total, valor_medio_noite, detalhe
from consultar_disponibilidade('2027-03-04', '2027-03-07', 2, 1);
