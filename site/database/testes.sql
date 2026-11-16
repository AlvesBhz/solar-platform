-- ════════════════════════════════════════════════════════════════════
--  Testes da proposta (rodar depois de schema.sql e seed_exemplo.sql).
--  Cada cenário compara o resultado com o valor calculado à mão e para
--  com erro se algo divergir. Datas em 2027 para estarem no futuro.
--  Tarifa base de exemplo: R$ 890 (dom–qui) · R$ 1.090 (sex–sáb) ·
--  2 hóspedes inclusos · adulto extra R$ 150 · criança extra R$ 80 ·
--  limpeza R$ 180 por estadia.
-- ════════════════════════════════════════════════════════════════════

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
select pg_temp.ok ('2 noites em dia de semana, 2 adultos',              '2027-03-02','2027-03-04', 2,0, 1780, 1960);
select pg_temp.ok ('2 noites no fim de semana (sex e sáb)',             '2027-03-05','2027-03-07', 2,0, 2180, 2360);
select pg_temp.ok ('3 adultos + 1 criança (1 adulto e 1 criança extras)','2027-03-02','2027-03-04', 3,1, 2240, 2420);
select pg_temp.ok ('2 adultos + 2 crianças (2 crianças extras)',        '2027-03-02','2027-03-04', 2,2, 2100, 2280);
select pg_temp.ok ('Réveillon com 4 noites (R$ 2.400/noite)',           '2026-12-29','2027-01-02', 2,0, 9600, 9780);
select pg_temp.ok ('Alta temporada + Réveillon na mesma estadia',       '2026-12-27','2026-12-31', 2,0, 7180, 7360);
select pg_temp.ok ('Ajuste de preço no feriado de Tiradentes',          '2027-04-20','2027-04-22', 2,0, 2180, 2360);

\echo '── Regras de venda'
select pg_temp.nao('Réveillon com 3 noites (mínimo 4)',                 '2026-12-29','2027-01-01', 2,0, 'min_noites');
select pg_temp.nao('Estadia que encosta no Carnaval herda o mínimo',    '2027-02-05','2027-02-07', 2,0, 'min_noites');
select pg_temp.nao('Noite fechada (dedetização)',                       '2027-05-11','2027-05-13', 2,0, 'fechado');
select pg_temp.nao('Check-in em data sem chegada',                      '2027-06-04','2027-06-06', 2,0, 'sem_chegada');
select pg_temp.ok ('…mas atravessar essa data é permitido',             '2027-06-03','2027-06-05', 2,0, 890+1090, 890+1090+180);
select pg_temp.nao('Datas sem tarifa cadastrada (venda não aberta)',    '2028-01-05','2028-01-07', 2,0, 'sem_tarifa');

\echo '── Validações'
select pg_temp.nao('Check-out igual ao check-in',                       '2027-03-02','2027-03-02', 2,0, 'datas_invalidas');
select pg_temp.nao('Data no passado',                                   '2026-01-10','2026-01-12', 2,0, 'data_passada');
select pg_temp.nao('Estadia acima de 30 noites',                        '2027-03-01','2027-04-15', 2,0, 'estadia_longa');
select pg_temp.nao('5 adultos (máximo 4 hóspedes)',                     '2027-03-02','2027-03-04', 5,0, 'capacidade');
select pg_temp.nao('3 crianças (máximo 2)',                             '2027-03-02','2027-03-04', 1,3, 'capacidade');

\echo '── Ocupação'
select pg_temp.nao('Sobrepõe reserva confirmada (19–21/03)',            '2027-03-20','2027-03-22', 2,0, 'ocupado');
select pg_temp.ok ('Entra no dia em que a reserva sai (21/03)',         '2027-03-21','2027-03-23', 2,0, 1780, 1960);
select pg_temp.ok ('Sai no dia em que a reserva entra (19/03)',         '2027-03-17','2027-03-19', 2,0, 1780, 1960);
select pg_temp.nao('Bloqueio importado do Airbnb (12–15/03)',           '2027-03-14','2027-03-16', 2,0, 'ocupado');

\echo '── Pré-reserva (15 min para pagar)'
select codigo like 'SE-%' as codigo_ok, valor_total from criar_pre_reserva('chale-solar', '2027-04-06', '2027-04-08', 2, 0);
select pg_temp.nao('Datas seguradas por uma pré-reserva',               '2027-04-06','2027-04-08', 2,0, 'ocupado');
do $$ begin
  perform criar_pre_reserva('chale-solar', '2027-04-07', '2027-04-09', 2, 0);
  raise exception 'FALHOU: segunda pré-reserva nas mesmas noites foi aceita';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'ocupado' then raise; end if;
  raise notice 'ok  Segunda pré-reserva nas mesmas noites é recusada (%)', sqlerrm;
end $$;
-- simula o vencimento dos 15 minutos
update reservas set expira_em = now() - interval '1 minute' where status = 'pendente';
select pg_temp.ok ('Pré-reserva vencida libera as datas',               '2027-04-06','2027-04-08', 2,0, 1780, 1960);
select codigo like 'SE-%' as nova_pre_reserva_ok from criar_pre_reserva('chale-solar', '2027-04-06', '2027-04-08', 2, 0);
select status, count(*) from reservas group by status order by status;

\echo '── Proteção contra overbooking no próprio banco'
do $$ begin
  insert into reservas (unidade_id, periodo, adultos, status, valor_hospedagem, hospede_id)
  select id, '[2027-03-20,2027-03-21)', 2, 'confirmada', 1, (select id from hospedes limit 1) from unidades where slug = 'chale-solar';
  raise exception 'FALHOU: banco aceitou duas reservas na mesma noite';
exception when exclusion_violation then
  raise notice 'ok  Inserção direta sobreposta é barrada pela constraint (exclusion_violation)';
end $$;

\echo '── Detalhe noite a noite (o que o site recebe)'
select unidade, disponivel, noites, valor_hospedagem, taxa_limpeza, valor_total, valor_medio_noite,
       jsonb_pretty(detalhe) as detalhe
from consultar_disponibilidade('2027-03-04', '2027-03-07', 3, 0);
