-- ════════════════════════════════════════════════════════════════════
--  Testes da proposta (rodar depois de schema.sql e seed_exemplo.sql,
--  num banco de TESTE: os dados abaixo são criados só para os testes).
--  Valores reais: casal R$ 800 de segunda a quinta e R$ 1.700 sexta,
--  sábado e domingo · criança de 5 a 8 anos 30% e de 9 a 13 anos 100% do valor por
--  pessoa · até 4 anos não paga mas ocupa vaga · feriados R$ 1.700 com
--  mínimo de 3 noites (Réveillon e Carnaval, 4) · até 7 noites · sinal 50%.
-- ════════════════════════════════════════════════════════════════════

-- Dados SÓ PARA TESTE: uma temporada, ajustes, um bloqueio do Airbnb e uma reserva
set search_path = "SE", extensions, public;   -- tabelas do site ficam no schema "SE"

insert into "SIT_TARIFA" ("ID_UNIDADE", "NM_TARIFA", "DT_INI", "DT_FIM", "NO_PRIORIDADE", "VL_NOITE", "QTDE_ADULTOS_INCLUSOS", "QTDE_MIN_NOITES")
select "ID_UNIDADE", 'Julho (teste)', '2027-07-05', '2027-07-09', 20, 2500.00, 2, 4 from "SIT_UNIDADE" where "CD_UNIDADE" = 'casa-do-mirante';
insert into "SIT_AJUSTE_DIARIO" ("ID_UNIDADE", "DT_REF", "VL_NOITE", "DS_OBSERVACAO") select "ID_UNIDADE", '2027-04-21', 1900.00, 'Tiradentes (teste)' from "SIT_UNIDADE" where "CD_UNIDADE" = 'casa-do-mirante';
insert into "SIT_AJUSTE_DIARIO" ("ID_UNIDADE", "DT_REF", "SG_FECHADO")             select "ID_UNIDADE", '2027-05-12', true from "SIT_UNIDADE" where "CD_UNIDADE" = 'casa-do-mirante';
insert into "SIT_AJUSTE_DIARIO" ("ID_UNIDADE", "DT_REF", "SG_SEM_CHEGADA")         select "ID_UNIDADE", '2027-06-04', true from "SIT_UNIDADE" where "CD_UNIDADE" = 'casa-do-mirante';
insert into "SIT_CALENDARIO_EXTERNO" ("ID_UNIDADE", "TP_CANAL", "DS_URL_IMPORTACAO") select "ID_UNIDADE", 'AIRBNB', 'https://exemplo.invalid/airbnb.ics' from "SIT_UNIDADE" where "CD_UNIDADE" = 'casa-do-mirante';
insert into "SIT_BLOQUEIO" ("ID_UNIDADE", "DT_INI", "DT_FIM", "TP_MOTIVO", "ID_CALENDARIO", "CD_EXTERNO")
select u."ID_UNIDADE", '2027-03-12', '2027-03-15', 'CANAL_EXTERNO', c."ID_CALENDARIO", 'teste-1' from "SIT_UNIDADE" u join "SIT_CALENDARIO_EXTERNO" c on c."ID_UNIDADE" = u."ID_UNIDADE";
insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "CD_CPF") values ('Hóspede Teste', 'teste@exemplo.invalid', '11144477735');
insert into "SIT_RESERVA" ("ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "TP_CANAL", "VL_HOSPEDAGEM")
select u."ID_UNIDADE", h."ID_HOSPEDE", '2027-03-19', '2027-03-21', 2, 'CONFIRMADA', 'TELEFONE', 3400.00 from "SIT_UNIDADE" u, "SIT_HOSPEDE" h where u."CD_UNIDADE" = 'casa-do-mirante';

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
select pg_temp.ok ('Casal, 2 noites em dia de semana (R$ 800)',         '2027-03-02','2027-03-04', 2,0, 1600, 1600);
select pg_temp.ok ('Casal, 2 noites no fim de semana (R$ 1.700)',       '2027-03-05','2027-03-07', 2,0, 3400, 3400);
select pg_temp.ok ('Casal, domingo e segunda (domingo R$ 1.700)',       '2027-03-07','2027-03-09', 2,0, 2500, 2500);
select pg_temp.ok ('Casal + 2 crianças de 5 a 8 (30% de R$ 400 cada)',  '2027-03-02','2027-03-04', 2,2, 2080, 2080);
select pg_temp.ok ('1 adulto + 1 criança de 5 a 8',                     '2027-03-02','2027-03-04', 1,1, 1840, 1840);
select pg_temp.ok ('Temporada de teste: 4 noites a R$ 2.500',           '2027-07-05','2027-07-09', 2,0, 10000, 10000);
select pg_temp.ok ('Ajuste de preço numa data (R$ 1.900)',              '2027-04-20','2027-04-22', 2,0, 2700, 2700);
select pg_temp.ok ('Réveillon: 4 noites a R$ 1.700',                    '2026-12-30','2027-01-03', 2,0, 6800, 6800);
select pg_temp.ok ('Feriado (Semana Santa): 3 noites a R$ 1.700',       '2027-03-25','2027-03-28', 2,0, 5100, 5100);
do $$ declare r record; begin
  select * into r from consultar_disponibilidade('2027-03-02','2027-03-04', 2, 0, 0, 1);
  if not r.disponivel or r.vl_total <> 2400 then raise exception 'FALHOU: casal + criança de 9 a 13 na semana = %', r.vl_total; end if;
  select * into r from consultar_disponibilidade('2027-03-05','2027-03-07', 2, 1, 0, 1);
  if not r.disponivel or r.vl_total <> 5610 then raise exception 'FALHOU: casal + 5 a 8 + 9 a 13 no fim de semana = %', r.vl_total; end if;
  if (r.ds_detalhe->0->>'vl_criancas')::numeric <> 1105 or (r.ds_detalhe->0->>'qtde_criancas_maiores')::int <> 1 then
    raise exception 'FALHOU: detalhe da noite com crianças: %', r.ds_detalhe->0; end if;
  select * into r from consultar_disponibilidade('2027-03-02','2027-03-04', 2, 1, 1, 1);
  if r.disponivel or r.motivo <> 'capacidade' then raise exception 'FALHOU: 3 crianças de idades diferentes aceitas'; end if;
  raise notice 'ok  Criança de 9 a 13 paga 100%% (R$ 400 na semana, R$ 850 no fim de semana); as 3 faixas somam na capacidade';
end $$;

\echo '── Regras de venda'
select pg_temp.nao('Réveillon com 3 noites (mínimo 4)',                 '2026-12-30','2027-01-02', 2,0, 'min_noites');
select pg_temp.nao('Temporada de teste com 3 noites (mínimo 4)',        '2027-07-05','2027-07-08', 2,0, 'min_noites');
select pg_temp.nao('Feriado com 2 noites (mínimo 3)',                   '2027-03-25','2027-03-27', 2,0, 'min_noites');
select pg_temp.nao('Atravessa 1 noite de feriado: vale o mínimo dele',  '2027-03-24','2027-03-26', 2,0, 'min_noites');
select pg_temp.nao('1 noite em dia de semana (mínimo 2)',               '2027-03-02','2027-03-03', 2,0, 'min_noites');
select pg_temp.nao('Noite fechada',                                     '2027-05-11','2027-05-13', 2,0, 'fechado');
select pg_temp.nao('Check-in em data sem chegada',                      '2027-06-04','2027-06-06', 2,0, 'sem_chegada');
select pg_temp.ok ('…mas atravessar essa data é permitido',             '2027-06-03','2027-06-05', 2,0, 2500, 2500);
select pg_temp.nao('Datas sem tarifa cadastrada (venda não aberta)',    '2029-01-05','2029-01-07', 2,0, 'sem_tarifa');

\echo '── Validações'
select pg_temp.nao('Check-out igual ao check-in',                       '2027-03-02','2027-03-02', 2,0, 'datas_invalidas');
select pg_temp.nao('Data no passado',                                   '2026-01-10','2026-01-12', 2,0, 'data_passada');
select pg_temp.nao('Estadia acima de 7 noites',                         '2027-03-01','2027-03-09', 2,0, 'estadia_longa');
select pg_temp.ok ('Estadia de exatamente 7 noites',                    '2027-03-01','2027-03-08', 2,0, 8300, 8300);
select pg_temp.nao('3 adultos (máximo 2)',                              '2027-03-02','2027-03-04', 3,0, 'capacidade');
select pg_temp.nao('3 crianças (máximo 2)',                             '2027-03-02','2027-03-04', 2,3, 'capacidade');
do $$ declare r record; begin
  select * into r from consultar_disponibilidade('2027-03-02','2027-03-04', 2, 2, 1);
  if r.disponivel or r.motivo <> 'capacidade' then raise exception 'FALHOU: 2 adultos + 2 crianças + 1 bebê foi aceito'; end if;
  raise notice 'ok  2 adultos + 2 crianças + 1 bebê (bebê ocupa vaga)                indisponível: capacidade';
  select * into r from consultar_disponibilidade('2027-03-02','2027-03-04', 2, 1, 1);
  if not r.disponivel or r.vl_total <> 1840 then raise exception 'FALHOU: casal + 1 criança + 1 bebê = %', r.vl_total; end if;
  raise notice 'ok  Casal + 1 criança + 1 bebê (bebê não paga)                       R$ %', r.vl_total;
  if (r.ds_detalhe->0->>'qtde_bebes')::int <> 1 or (r.ds_detalhe->0->>'vl_bebes')::numeric <> 0
     or (r.ds_detalhe->0->>'vl_criancas')::numeric <> 120 then
    raise exception 'FALHOU: detalhe da noite não separa criança e bebê: %', r.ds_detalhe->0;
  end if;
  raise notice 'ok  Detalhe da noite: 1 criança R$ %, 1 bebê R$ %', r.ds_detalhe->0->>'vl_criancas', r.ds_detalhe->0->>'vl_bebes';
  select * into r from consultar_disponibilidade('2027-03-02','2027-03-04', 2, 0, 2);
  if not r.disponivel or r.vl_total <> 1600 then raise exception 'FALHOU: casal + 2 bebês = %', r.vl_total; end if;
  raise notice 'ok  Casal + 2 bebês (ocupam as 2 vagas de criança, não pagam)        R$ %', r.vl_total;
  select * into r from consultar_disponibilidade('2027-03-02','2027-03-04', 2, 0, 3);
  if r.disponivel or r.motivo <> 'capacidade' then raise exception 'FALHOU: 3 bebês aceitos'; end if;
  raise notice 'ok  Casal + 3 bebês                                                 indisponível: capacidade';
end $$;

\echo '── Ocupação'
select pg_temp.nao('Sobrepõe reserva confirmada (19–21/03)',            '2027-03-20','2027-03-22', 2,0, 'ocupado');
select pg_temp.ok ('Entra no dia em que a reserva sai (21/03)',         '2027-03-21','2027-03-23', 2,0, 2500, 2500);
select pg_temp.ok ('Sai no dia em que a reserva entra (19/03)',         '2027-03-17','2027-03-19', 2,0, 1600, 1600);
select pg_temp.nao('Bloqueio importado do Airbnb (12–15/03)',           '2027-03-14','2027-03-16', 2,0, 'ocupado');

\echo '── Pré-reserva, confirmação no site e pagamento lançado pela equipe'
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
-- reserva do site não confirma sem o aceite da política (nem por update direto)
do $$ begin
  update "SIT_RESERVA" set "TP_STATUS" = 'CONFIRMADA', "ID_HOSPEDE" = (select "ID_HOSPEDE" from "SIT_HOSPEDE" limit 1), "DT_EXPIRA" = null
  where "DT_CHECKIN" = '2027-04-06' and "TP_STATUS" = 'PENDENTE';
  raise exception 'FALHOU: reserva do site confirmada sem aceite da política';
exception when check_violation then raise notice 'ok  Reserva do site só confirma com a política aceita';
end $$;
-- o hóspede termina o formulário: o site confirma com os dados e o aceite
select 'ok  Cadastro concluído pelo site: ' || cd_reserva || ' · total R$ ' || vl_total || ' · sinal R$ ' || vl_sinal
from confirmar_reserva((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-04-06' and "TP_STATUS" = 'PENDENTE'),
                       'Maria Teste', 'maria@exemplo.invalid', '+55 31 90000-0000', 'BR', '52998224725');
do $$ declare r record; begin
  select r2."TP_STATUS", r2."DT_EXPIRA", r2."DT_ACEITE_POLITICA", r2."NO_VERSAO_POLITICA", h."NM_HOSPEDE" into r
  from "SIT_RESERVA" r2 join "SIT_HOSPEDE" h using ("ID_HOSPEDE") where r2."DT_CHECKIN" = '2027-04-06';
  if r."TP_STATUS" <> 'PENDENTE' or r."DT_EXPIRA" is null or r."DT_ACEITE_POLITICA" is null or r."NO_VERSAO_POLITICA" is null or r."NM_HOSPEDE" <> 'Maria Teste' then
    raise exception 'FALHOU: cadastro não gravou hóspede ou aceite, ou não seguiu aguardando o sinal: %', r;
  end if;
  raise notice 'ok  Cadastro grava o hóspede e o aceite (versão %) e segue PENDENTE até o sinal', r."NO_VERSAO_POLITICA";
end $$;
select pg_temp.nao('Aguardando o sinal: datas seguem seguradas',        '2027-04-06','2027-04-08', 2,0, 'ocupado');
do $$ begin
  perform confirmar_reserva((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-04-06'), 'Outra', 'outra@exemplo.invalid', null, 'BR', '11144477735');
  raise exception 'FALHOU: cadastro enviado duas vezes';
exception when sqlstate 'P0001' then raise notice 'ok  Cadastro não é enviado de novo (%)', sqlerrm;
end $$;
-- a equipe confere o Pix do sinal e confirma
select 'ok  Sinal confirmado pela equipe: ' || cd_reserva || ' · ' || tp_status || ' · saldo R$ ' || vl_saldo
from confirmar_sinal((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-04-06'), 'Equipe (teste)', 'E0000TESTE1', (select "VL_SINAL" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-04-06'));
do $$ declare r record; begin
  select r2."TP_STATUS", r2."DT_EXPIRA", (select count(*) from "SIT_PAGAMENTO" p where p."ID_RESERVA" = r2."ID_RESERVA" and p."TP_PARCELA" = 'SINAL' and p."TP_STATUS" = 'RECEBIDO') n
    into r from "SIT_RESERVA" r2 where r2."DT_CHECKIN" = '2027-04-06';
  if r."TP_STATUS" <> 'CONFIRMADA' or r."DT_EXPIRA" is not null or r.n <> 1 then raise exception 'FALHOU: confirmar_sinal: %', r; end if;
  raise notice 'ok  Sinal lançado (Pix) e reserva CONFIRMADA, sem prazo';
end $$;
select pg_temp.nao('Reserva confirmada continua ocupando as datas',     '2027-04-06','2027-04-08', 2,0, 'ocupado');
do $$ begin
  perform confirmar_sinal((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-04-06'), 'Equipe (teste)', 'E0000TESTE9', 9999);
  raise exception 'FALHOU: sinal confirmado duas vezes';
exception when sqlstate 'P0001' then raise notice 'ok  Sinal não é confirmado duas vezes (%)', sqlerrm;
end $$;
-- pagou depois do prazo: confirma se as datas seguem livres; recusa se alguém segurou as datas no meio
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-09-21', '2027-09-23', 2, 0);
select cd_reserva like 'SE-%' from confirmar_reserva((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-09-21'), 'Tardio', 'tardio@exemplo.invalid', null, 'BR', '12345678909');
update "SIT_RESERVA" set "DT_EXPIRA" = now() - interval '1 minute' where "DT_CHECKIN" = '2027-09-21';
-- travas contra comprovante falso: sem id do Pix, valor menor que o sinal ou id repetido não confirma
do $$ declare cd text := (select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-09-21'); begin
  begin perform confirmar_sinal(cd, 'Equipe (teste)', null, 9999); raise exception 'FALHOU: confirmou sem id do Pix';
  exception when sqlstate 'P0001' then if sqlerrm <> 'transacao_obrigatoria' then raise; end if; end;
  begin perform confirmar_sinal(cd, 'Equipe (teste)', 'E0000TESTE2', 1); raise exception 'FALHOU: confirmou com valor menor que o sinal';
  exception when sqlstate 'P0001' then if sqlerrm <> 'valor_menor_que_sinal' then raise; end if; end;
  begin perform confirmar_sinal(cd, 'Equipe (teste)', 'E0000TESTE1', 9999); raise exception 'FALHOU: aceitou id de Pix já usado em outra reserva';
  exception when unique_violation then null; end;
  raise notice 'ok  Sinal só confirma com id do Pix novo e valor ≥ sinal (sem id, valor menor e id repetido recusados)';
end $$;
select 'ok  Pix depois do prazo, datas livres: ' || tp_status from confirmar_sinal((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-09-21'), 'Equipe (teste)', 'E0000TESTE3', 9999);
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-09-28', '2027-09-30', 2, 0);
select cd_reserva like 'SE-%' from confirmar_reserva((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-09-28'), 'Tardio Dois', 'tardio2@exemplo.invalid', null, 'BR', '98765432100');
update "SIT_RESERVA" set "DT_EXPIRA" = now() - interval '1 minute' where "DT_CHECKIN" = '2027-09-28';
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-09-28', '2027-09-30', 2, 0);
do $$ begin
  perform confirmar_sinal((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-09-28' and "ID_HOSPEDE" is not null), 'Equipe (teste)', 'E0000TESTE4', 9999);
  raise exception 'FALHOU: confirmou sinal atrasado com as datas já seguradas por outro';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'ocupado' then raise; end if;
  raise notice 'ok  Pix depois do prazo com as datas já seguradas por outro: recusado (ocupado)';
end $$;
do $$ begin
  perform confirmar_sinal((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-09-28' and "ID_HOSPEDE" is null), 'Equipe (teste)', 'E0000TESTE5', 9999);
  raise exception 'FALHOU: confirmou sinal sem cadastro';
exception when sqlstate 'P0001' then raise notice 'ok  Sinal sem o cadastro do hóspede: recusado (%)', sqlerrm;
end $$;
-- pré-reserva que venceu antes de o hóspede terminar
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-09-14', '2027-09-16', 2, 0);
update "SIT_RESERVA" set "DT_EXPIRA" = now() - interval '1 minute' where "TP_STATUS" = 'PENDENTE' and "DT_CHECKIN" = '2027-09-14';
do $$ begin
  perform confirmar_reserva((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-09-14'), 'Atrasado', 'atrasado@exemplo.invalid', null, 'BR', '12345678909');
  raise exception 'FALHOU: pré-reserva vencida foi confirmada';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'pre_reserva_expirada' then raise; end if;
  raise notice 'ok  Pré-reserva vencida não confirma: o hóspede consulta de novo (%)', sqlerrm;
end $$;
-- o sinal lançado pelo confirmar_sinal aparece no SIT_PAGAMENTO
select 'ok  Pagamento lançado pela equipe: ' || "TP_PARCELA" || ' · ' || "TP_METODO" || ' · R$ ' || "VL_PAGAMENTO" || ' · ' || p."TP_STATUS"
from "SIT_PAGAMENTO" p join "SIT_RESERVA" r using ("ID_RESERVA") where r."DT_CHECKIN" = '2027-04-06';
do $$ begin
  insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_METODO", "VL_PAGAMENTO", "NM_REGISTRADO_POR") select "ID_RESERVA", 'PIX', 10, 'Equipe (teste)' from "SIT_RESERVA" limit 1;
  raise exception 'FALHOU: pagamento sem data aceito';
exception when check_violation then raise notice 'ok  Pagamento recebido exige a data em que o dinheiro entrou';
end $$;
do $$ begin
  insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_METODO", "VL_PAGAMENTO", "DT_PAGAMENTO") select "ID_RESERVA", 'PIX', 10, now() from "SIT_RESERVA" limit 1;
  raise exception 'FALHOU: pagamento sem responsável aceito';
exception when check_violation then raise notice 'ok  Lançamento manual exige quem da equipe lançou';
end $$;
do $$ begin
  insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_METODO", "VL_PAGAMENTO", "DT_PAGAMENTO", "NM_REGISTRADO_POR") select "ID_RESERVA", 'BOLETO', 10, now(), 'Equipe (teste)' from "SIT_RESERVA" limit 1;
  raise exception 'FALHOU: método fora da lista aceito';
exception when check_violation then raise notice 'ok  Método só PIX, CARTAO_CREDITO, CARTAO_DEBITO, DINHEIRO ou TRANSFERENCIA';
end $$;
select 'ok  Saldo a pagar no check-in: R$ ' || "VL_SALDO" || ' (total R$ ' || "VL_TOTAL" || ' − sinal R$ ' || "VL_SINAL" || ')' from "SIT_RESERVA" where "DT_CHECKIN" = '2027-04-06';
-- saldo pago no check-in, direto na pousada, em dinheiro
insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_PARCELA", "TP_METODO", "VL_PAGAMENTO", "DT_PAGAMENTO", "NM_REGISTRADO_POR")
select "ID_RESERVA", 'SALDO', 'DINHEIRO', "VL_SALDO", now(), 'Recepção (teste)' from "SIT_RESERVA" where "DT_CHECKIN" = '2027-04-06';
select 'ok  Total quitado: R$ ' || sum("VL_PAGAMENTO") || ' em ' || count(*) || ' parcelas (sinal + saldo)' from "SIT_PAGAMENTO" p join "SIT_RESERVA" r using ("ID_RESERVA") where p."TP_STATUS" = 'RECEBIDO' and r."DT_CHECKIN" = '2027-04-06';
-- pronto para pagamento online depois: cobrança do Mercado Pago nasce PENDENTE e o aviso (webhook) a confirma
insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_PARCELA", "TP_PROVEDOR", "TP_METODO", "VL_PAGAMENTO", "TP_STATUS", "CD_TRANSACAO")
select "ID_RESERVA", 'SINAL', 'MERCADO_PAGO', 'PIX', 1700.00, 'PENDENTE', 'MP-TESTE-1' from "SIT_RESERVA" where "DT_CHECKIN" = '2027-03-19';
update "SIT_PAGAMENTO" set "TP_STATUS" = 'RECEBIDO', "DT_PAGAMENTO" = now() where "CD_TRANSACAO" = 'MP-TESTE-1';
select 'ok  Estrutura pronta para Mercado Pago: cobrança PENDENTE → RECEBIDO pelo aviso do provedor' from "SIT_PAGAMENTO" where "CD_TRANSACAO" = 'MP-TESTE-1' and "TP_STATUS" = 'RECEBIDO';
do $$ begin
  insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_PROVEDOR", "TP_METODO", "VL_PAGAMENTO", "TP_STATUS") select "ID_RESERVA", 'MERCADO_PAGO', 'PIX', 10, 'PENDENTE' from "SIT_RESERVA" limit 1;
  raise exception 'FALHOU: cobrança online sem id da transação aceita';
exception when check_violation then raise notice 'ok  Cobrança online exige o id da transação no provedor';
end $$;
do $$ begin
  insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_PROVEDOR", "TP_METODO", "VL_PAGAMENTO", "TP_STATUS", "CD_TRANSACAO") select "ID_RESERVA", 'MERCADO_PAGO', 'DINHEIRO', 10, 'PENDENTE', 'MP-X' from "SIT_RESERVA" limit 1;
  raise exception 'FALHOU: dinheiro pelo provedor online aceito';
exception when check_violation then raise notice 'ok  Dinheiro e transferência só como lançamento manual';
end $$;
do $$ begin
  insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_METODO", "VL_PAGAMENTO", "TP_STATUS", "NM_REGISTRADO_POR") select "ID_RESERVA", 'PIX', 10, 'PENDENTE', 'Equipe (teste)' from "SIT_RESERVA" limit 1;
  raise exception 'FALHOU: lançamento manual pendente aceito';
exception when check_violation then raise notice 'ok  Lançamento manual é sempre de valor já recebido';
end $$;
do $$ begin
  insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_PARCELA", "TP_METODO", "VL_PAGAMENTO", "DT_PAGAMENTO", "NM_REGISTRADO_POR") select "ID_RESERVA", 'ENTRADA', 'PIX', 1, now(), 'Equipe (teste)' from "SIT_RESERVA" limit 1;
  raise exception 'FALHOU: parcela fora da lista foi aceita';
exception when check_violation then raise notice 'ok  Parcela só aceita SINAL ou SALDO';
end $$;
-- simula o vencimento da pré-reserva de outra estadia
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-08-10', '2027-08-12', 2, 0);
update "SIT_RESERVA" set "DT_EXPIRA" = now() - interval '1 minute' where "TP_STATUS" = 'PENDENTE' and "DT_CHECKIN" = '2027-08-10';
select pg_temp.ok ('Pré-reserva vencida libera as datas',               '2027-08-10','2027-08-12', 2,0, 1600, 1600);

\echo '── Remarcação (o sinal não é devolvido, vira crédito)'
-- a reserva confirmada e com sinal recebido é remarcada para outra data
with antiga as (
  update "SIT_RESERVA" set "TP_STATUS" = 'REMARCADA', "DT_ATUALIZACAO" = now()
  where "DT_CHECKIN" = '2027-04-06' and "TP_STATUS" = 'CONFIRMADA'
  returning *
)
insert into "SIT_RESERVA" ("ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "QTDE_CRIANCAS", "TP_STATUS", "VL_HOSPEDAGEM", "VL_SINAL", "ID_RESERVA_ORIGINAL", "NO_VERSAO_POLITICA", "DT_ACEITE_POLITICA")
select "ID_UNIDADE", "ID_HOSPEDE", '2027-05-18', '2027-05-20', "QTDE_ADULTOS", "QTDE_CRIANCAS", 'CONFIRMADA', "VL_HOSPEDAGEM", "VL_SINAL", "ID_RESERVA", "NO_VERSAO_POLITICA", "DT_ACEITE_POLITICA" from antiga;
select pg_temp.ok ('Datas antigas liberadas após a remarcação',         '2027-04-06','2027-04-08', 2,0, 1600, 1600);
select pg_temp.nao('Novas datas ocupadas pela reserva remarcada',       '2027-05-18','2027-05-20', 2,0, 'ocupado');
select 'ok  Crédito na nova reserva: R$ ' || sum(pg."VL_PAGAMENTO") || ' de sinal pago na reserva original'
from "SIT_RESERVA" nova join "SIT_PAGAMENTO" pg on pg."ID_RESERVA" = nova."ID_RESERVA_ORIGINAL" and pg."TP_STATUS" = 'RECEBIDO' and pg."TP_PARCELA" = 'SINAL'
where nova."DT_CHECKIN" = '2027-05-18';

\echo '── Cancelamento por arrependimento (CDC art. 49)'
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-10-05', '2027-10-07', 2, 0);
do $$ begin
  update "SIT_RESERVA" set "TP_STATUS" = 'CANCELADA' where "DT_CHECKIN" = '2027-10-05';
  raise exception 'FALHOU: cancelamento sem motivo aceito';
exception when check_violation then raise notice 'ok  Cancelamento exige o motivo';
end $$;
update "SIT_RESERVA" set "TP_STATUS" = 'CANCELADA', "TP_MOTIVO_CANCELAMENTO" = 'ARREPENDIMENTO', "DT_ATUALIZACAO" = now() where "DT_CHECKIN" = '2027-10-05';
select pg_temp.ok ('Cancelada por arrependimento libera as datas',      '2027-10-05','2027-10-07', 2,0, 1600, 1600);
-- hóspede confirmou no site, mas não pagou quando a equipe entrou em contato
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-10-19', '2027-10-21', 2, 0);
select cd_reserva like 'SE-%' from confirmar_reserva((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-10-19'),
       'Sem Pagar', 'sempagar@exemplo.invalid', null, 'BR', '12345678909');
update "SIT_RESERVA" set "TP_STATUS" = 'CANCELADA', "TP_MOTIVO_CANCELAMENTO" = 'SEM_PAGAMENTO', "DT_ATUALIZACAO" = now() where "DT_CHECKIN" = '2027-10-19';
select pg_temp.ok ('Cancelada sem pagamento pela equipe libera as datas', '2027-10-19','2027-10-21', 2,0, 1600, 1600);

\echo '── Documento do hóspede: CPF para brasileiro, passaporte para estrangeiro'
do $$ begin
  if not cpf_valido('52998224725') or cpf_valido('52998224724') or cpf_valido('11111111111') or cpf_valido('529.982.247-25') then
    raise exception 'FALHOU: validação de CPF';
  end if;
  raise notice 'ok  CPF: dígitos verificadores conferidos; repetido e com pontuação recusados';
end $$;
do $$ begin
  insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL") values ('Sem CPF', 'semcpf@exemplo.invalid');
  raise exception 'FALHOU: brasileiro sem CPF aceito';
exception when check_violation then raise notice 'ok  Brasileiro sem CPF é recusado';
end $$;
do $$ begin
  insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "CD_CPF") values ('CPF errado', 'cpferrado@exemplo.invalid', '52998224724');
  raise exception 'FALHOU: CPF inválido aceito';
exception when check_violation then raise notice 'ok  CPF com dígito verificador errado é recusado';
end $$;
do $$ begin
  insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "CD_CPF") values ('CPF repetido', 'repetido@exemplo.invalid', '11144477735');
  raise exception 'FALHOU: CPF repetido aceito';
exception when unique_violation then raise notice 'ok  O mesmo CPF não é cadastrado duas vezes';
end $$;
do $$ begin
  insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "SG_NACIONALIDADE") values ('Foreigner', 'foreigner@exemplo.invalid', 'US');
  raise exception 'FALHOU: estrangeiro sem passaporte aceito';
exception when check_violation then raise notice 'ok  Estrangeiro sem passaporte é recusado';
end $$;
do $$ begin
  insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "SG_NACIONALIDADE", "CD_PASSAPORTE") values ('Sem país', 'sempais@exemplo.invalid', 'US', 'A1234567');
  raise exception 'FALHOU: passaporte sem país aceito';
exception when check_violation then raise notice 'ok  Passaporte exige o país que o emitiu';
end $$;
do $$ begin
  insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "SG_NACIONALIDADE", "CD_PASSAPORTE", "SG_PAIS_PASSAPORTE") values ('Sem validade', 'semval@exemplo.invalid', 'US', 'B7654321', 'US');
  raise exception 'FALHOU: passaporte sem validade aceito';
exception when check_violation then raise notice 'ok  Passaporte exige a data de validade';
end $$;
do $$ begin
  insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "SG_NACIONALIDADE", "CD_PASSAPORTE", "SG_PAIS_PASSAPORTE", "DT_EMISSAO_PASSAPORTE", "DT_VALIDADE_PASSAPORTE")
  values ('Datas trocadas', 'datas@exemplo.invalid', 'US', 'B7654321', 'US', '2030-01-01', '2020-01-01');
  raise exception 'FALHOU: validade antes da emissão aceita';
exception when check_violation then raise notice 'ok  Validade do passaporte depois da emissão';
end $$;
insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "SG_NACIONALIDADE", "CD_PASSAPORTE", "SG_PAIS_PASSAPORTE", "DT_EMISSAO_PASSAPORTE", "DT_VALIDADE_PASSAPORTE")
values ('John Test', 'john@exemplo.invalid', 'US', 'A1234567', 'US', '2020-03-10', '2030-03-09');
insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "SG_NACIONALIDADE", "CD_PASSAPORTE", "SG_PAIS_PASSAPORTE", "DT_VALIDADE_PASSAPORTE")
values ('Juan Test', 'juan@exemplo.invalid', 'AR', 'A1234567', 'AR', '2027-07-31');
select 'ok  Estrangeiro com passaporte e país é aceito; mesmo número em país diferente também';
do $$ begin
  insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "SG_NACIONALIDADE", "CD_PASSAPORTE", "SG_PAIS_PASSAPORTE", "DT_VALIDADE_PASSAPORTE") values ('Duplicado', 'dup@exemplo.invalid', 'US', 'A1234567', 'US', '2031-01-01');
  raise exception 'FALHOU: passaporte repetido no mesmo país aceito';
exception when unique_violation then raise notice 'ok  O mesmo passaporte do mesmo país não é cadastrado duas vezes';
end $$;
do $$ begin
  -- passaporte do Juan vence em 31/07/2027: estadia até 02/08 é recusada
  insert into "SIT_RESERVA" ("ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "TP_CANAL", "VL_HOSPEDAGEM")
  select u."ID_UNIDADE", h."ID_HOSPEDE", '2027-07-30', '2027-08-02', 2, 'CONFIRMADA', 'TELEFONE', 5100.00
  from "SIT_UNIDADE" u, "SIT_HOSPEDE" h where u."CD_UNIDADE" = 'casa-do-mirante' and h."DS_EMAIL" = 'juan@exemplo.invalid';
  raise exception 'FALHOU: reserva com passaporte vencido aceita';
exception when check_violation then raise notice 'ok  Reserva recusada se o passaporte vence antes da saída (%)', sqlerrm;
end $$;
insert into "SIT_RESERVA" ("ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "TP_CANAL", "VL_HOSPEDAGEM")
select u."ID_UNIDADE", h."ID_HOSPEDE", '2027-07-27', '2027-07-30', 2, 'CONFIRMADA', 'TELEFONE', 5100.00
from "SIT_UNIDADE" u, "SIT_HOSPEDE" h where u."CD_UNIDADE" = 'casa-do-mirante' and h."DS_EMAIL" = 'juan@exemplo.invalid';
select 'ok  Reserva aceita quando o passaporte vale até a saída';
-- pelo site: estrangeiro com passaporte vencendo antes da saída não confirma
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-11-08', '2027-11-11', 2, 0);
do $$ begin
  perform confirmar_reserva((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-11-08'), 'Peter Test', 'peter@exemplo.invalid', null,
                            'GB', null, 'P9988776', 'GB', '2027-11-09');
  raise exception 'FALHOU: confirmação com passaporte vencido aceita';
exception when check_violation then raise notice 'ok  Site não confirma reserva de estrangeiro com passaporte vencendo antes da saída';
end $$;

-- acompanhantes gravados e hóspede que volta reconhecido pelo CPF (mesmo com outro e-mail)
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-11-22', '2027-11-24', 2, 1);
select 'ok  Hóspede que volta é reconhecido pelo CPF: ' || (select count(*) from "SIT_HOSPEDE" where "CD_CPF" = '52998224725') || ' cadastro'
from confirmar_reserva((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-11-22'), 'Maria Teste', 'maria.nova@exemplo.invalid', null, 'BR', '52998224725', null, null, null, null,
     '[{"tipo":"adulto","nome":"Pedro","sobrenome":"Teste"},{"tipo":"crianca","nome":"Lia","idade":6}]'::jsonb);
do $$ declare n int; a jsonb; begin
  select count(*) into n from "SIT_HOSPEDE" where "CD_CPF" = '52998224725';
  select "DS_ACOMPANHANTES" into a from "SIT_RESERVA" where "DT_CHECKIN" = '2027-11-22';
  if n <> 1 then raise exception 'FALHOU: CPF repetido gerou % cadastros', n; end if;
  if a is null or jsonb_array_length(a) <> 2 then raise exception 'FALHOU: acompanhantes não gravados: %', a; end if;
  if not exists (select 1 from "SIT_HOSPEDE" where "CD_CPF" = '52998224725' and lower("DS_EMAIL") = 'maria.nova@exemplo.invalid') then
    raise exception 'FALHOU: e-mail novo não foi atualizado no cadastro';
  end if;
  raise notice 'ok  Acompanhantes gravados (%) e e-mail atualizado no cadastro do hóspede', jsonb_array_length(a);
end $$;

\echo '── Preço por noite para o calendário'
do $$ declare r record; n int; begin
  select * into r from consultar_precos('2027-03-02', '2027-03-03', 2, 1, 0);
  if r.vl_noite <> 920 or not r.livre then raise exception 'FALHOU: casal + criança = % livre=%', r.vl_noite, r.livre; end if;
  select * into r from consultar_precos('2027-03-02', '2027-03-03', 2, 1, 1);
  if r.vl_noite <> 920 then raise exception 'FALHOU: bebê não pode cobrar: %', r.vl_noite; end if;
  select * into r from consultar_precos('2027-03-05', '2027-03-06', 2, 0, 0, 1);
  if r.vl_noite <> 2550 then raise exception 'FALHOU: sexta com criança de 9 a 13 = %', r.vl_noite; end if;
  select * into r from consultar_precos('2027-03-02', '2027-03-03', 1, 0, 0);
  if r.vl_noite <> 800 then raise exception 'FALHOU: 1 adulto = %', r.vl_noite; end if;
  select * into r from consultar_precos('2027-07-06', '2027-07-07', 2, 1, 0);
  if r.vl_noite <> 2875 or not r.livre then raise exception 'FALHOU: tarifa de maior prioridade = % livre=%', r.vl_noite, r.livre; end if;
  select * into r from consultar_precos('2027-04-21', '2027-04-22', 2, 1, 0);
  if r.vl_noite <> 2185 then raise exception 'FALHOU: ajuste do dia = %', r.vl_noite; end if;
  select * into r from consultar_precos('2026-12-31', '2027-01-01', 2, 0, 0);
  if r.vl_noite <> 1700 or not r.livre then raise exception 'FALHOU: noite de Réveillon = % livre=%', r.vl_noite, r.livre; end if;
  select count(*) into n from consultar_precos('2027-03-12', '2027-03-20', 2, 0, 0) where not livre;
  if n <> 4 then raise exception 'FALHOU: bloqueio (3 noites) + reserva (noite 19) deveriam dar 4 ocupadas, deu %', n; end if;
  select count(*) into n from consultar_precos('2027-05-12', '2027-05-13', 2, 0, 0) where not livre;
  if n <> 1 then raise exception 'FALHOU: noite fechada deve aparecer ocupada'; end if;
  select count(*) into n from consultar_precos('2027-03-02', '2027-03-09', 3, 0, 0);
  if n <> 0 then raise exception 'FALHOU: 3 adultos devolveu preço'; end if;
  select count(*) into n from consultar_precos('2027-03-01', '2027-04-01', 2, 0, 0);
  if n <> 31 then raise exception 'FALHOU: mês deveria ter 31 noites, veio %', n; end if;
  raise notice 'ok  Preço por noite: criança paga, bebê não, tarifa de prioridade e ajuste valem, ocupadas e fechadas aparecem, excesso de hóspedes não devolve preço';
end $$;

\echo '── Proteção contra overbooking no próprio banco'
do $$ begin
  insert into "SIT_RESERVA" ("ID_UNIDADE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "TP_CANAL", "VL_HOSPEDAGEM", "ID_HOSPEDE")
  select "ID_UNIDADE", '2027-03-20', '2027-03-21', 2, 'CONFIRMADA', 'TELEFONE', 1, (select "ID_HOSPEDE" from "SIT_HOSPEDE" limit 1) from "SIT_UNIDADE" where "CD_UNIDADE" = 'casa-do-mirante';
  raise exception 'FALHOU: banco aceitou duas reservas na mesma noite';
exception when exclusion_violation then
  raise notice 'ok  Inserção direta sobreposta é barrada pela constraint (exclusion_violation)';
end $$;

\echo '── Detalhe noite a noite (o que o site recebe): casal + 1 criança, 3 noites'
select cd_unidade, disponivel, qtde_noites, vl_hospedagem, vl_taxa_limpeza, vl_total, vl_medio_noite, vl_sinal, ds_detalhe
from consultar_disponibilidade('2027-03-04', '2027-03-07', 2, 1);

\echo '── Segurança: limites, documentos e auditoria'
do $$ declare i int; begin
  for i in 1..6 loop if not registrar_tentativa('ip-teste') then raise exception 'FALHOU: pedido % do mesmo IP bloqueado', i; end if; end loop;
  if registrar_tentativa('ip-teste') then raise exception 'FALHOU: 7º pedido do mesmo IP na hora passou'; end if;
  update "SIT_TENTATIVA" set "DT_CRIACAO" = now() - interval '2 hours' where "DS_CHAVE" = 'ip-teste';
  if not registrar_tentativa('ip-teste') then raise exception 'FALHOU: IP não voltou após 1 hora'; end if;
  raise notice 'ok  Limite por visitante no banco: 6 pedidos por hora; depois de 1 hora volta a poder';
end $$;
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-10-26', '2027-10-28', 2, 0);
select cd_reserva like 'SE-%' from confirmar_reserva((select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-10-26'), 'Pendente Aberta', 'aberta@exemplo.invalid', null, 'BR', '86288366757');
do $$ begin
  if not pre_reserva_em_aberto('ABERTA@exemplo.invalid') or not pre_reserva_em_aberto('outro2@exemplo.invalid', '86288366757')
     or pre_reserva_em_aberto('ninguem@exemplo.invalid', '11144477735') then
    raise exception 'FALHOU: mesmo e-mail/CPF com pré-reserva aberta não foi barrado';
  end if;
  raise notice 'ok  Mesmo e-mail ou CPF com pré-reserva sem sinal não segura outras datas';
end $$;
do $$ declare cd text := (select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-10-26'); n int; begin
  n := registrar_documentos(cd, jsonb_build_array(
         jsonb_build_object('pessoa', 'Pendente Aberta', 'tipo', 'TITULAR', 'lado', 'FRENTE', 'caminho', cd || '/titular-frente.jpg', 'mime', 'image/jpeg', 'bytes', 120000),
         jsonb_build_object('pessoa', 'Intruso', 'tipo', 'TITULAR', 'lado', 'FRENTE', 'caminho', 'SE-OUTRA/x.jpg', 'mime', 'image/jpeg', 'bytes', 1)));
  if n <> 1 then raise exception 'FALHOU: registrou % documento(s), esperado 1 (o de outra pasta deve ser ignorado)', n; end if;
  if (select "ID_HOSPEDE" from "SIT_DOCUMENTO" where "DS_CAMINHO" = cd || '/titular-frente.jpg') is null then raise exception 'FALHOU: documento do titular sem hóspede'; end if;
  begin
    perform registrar_documentos(cd, jsonb_build_array(jsonb_build_object('pessoa', 'X', 'tipo', 'TITULAR', 'lado', 'FRENTE', 'caminho', cd || '/a.pdf', 'mime', 'application/pdf', 'bytes', 10)));
    raise exception 'FALHOU: aceitou arquivo que não é imagem';
  exception when check_violation then null; end;
  raise notice 'ok  Documentos: registra a foto do titular, ignora caminho de outra reserva e recusa o que não é imagem';
end $$;
do $$ declare n int; begin
  update "SIT_TARIFA" set "VL_NOITE" = "VL_NOITE" where "NM_TARIFA" = 'Tarifa padrão';
  select count(*) into n from "SIT_AUDITORIA" where "NM_TABELA" = 'SIT_TARIFA' and "TP_OPERACAO" = 'UPDATE' and "DS_ANTES" ? 'VL_NOITE';
  if n < 1 then raise exception 'FALHOU: alteração de tarifa não ficou na auditoria'; end if;
  select count(*) into n from "SIT_AUDITORIA" where "NM_TABELA" = 'SIT_RESERVA';
  if n < 1 then raise exception 'FALHOU: reservas não aparecem na auditoria'; end if;
  raise notice 'ok  Auditoria: alteração de tarifa e de reservas registrada com o valor anterior e quem mudou';
end $$;

\echo '── Data de nascimento do titular'
select cd_reserva like 'SE-%' from criar_pre_reserva('casa-do-mirante', '2027-11-30', '2027-12-02', 2, 0);
do $$ declare cd text := (select "CD_RESERVA" from "SIT_RESERVA" where "DT_CHECKIN" = '2027-11-30'); begin
  begin
    perform confirmar_reserva(cd, 'Menor', 'menor@exemplo.invalid', null, 'BR', '39053344705', null, null, null, null, null, date '2010-05-01');
    raise exception 'FALHOU: titular menor de idade aceito';
  exception when sqlstate 'P0001' then if sqlerrm <> 'titular_menor_de_idade' then raise; end if; end;
  perform confirmar_reserva(cd, 'Adulta', 'adulta@exemplo.invalid', null, 'BR', '39053344705', null, null, null, null, null, date '1990-05-01');
  if (select "DT_NASCIMENTO" from "SIT_HOSPEDE" where "DS_EMAIL" = 'adulta@exemplo.invalid') <> date '1990-05-01' then raise exception 'FALHOU: nascimento não gravado'; end if;
  raise notice 'ok  Nascimento do titular gravado; menor de 18 anos no check-in é recusado';
end $$;

\echo '── Calendário: mínimo de noites de cada dia'
do $$ declare r record; begin
  select * into r from consultar_precos('2027-03-02', '2027-03-03', 2, 0, 0);
  if r.min_noites <> 2 then raise exception 'FALHOU: dia comum deveria pedir 2 noites, pede %', r.min_noites; end if;
  select * into r from consultar_precos('2027-03-26', '2027-03-27', 2, 0, 0);
  if r.min_noites <> 3 then raise exception 'FALHOU: Semana Santa deveria pedir 3 noites, pede %', r.min_noites; end if;
  select * into r from consultar_precos('2026-12-31', '2027-01-01', 2, 0, 0);
  if r.min_noites <> 4 then raise exception 'FALHOU: Réveillon deveria pedir 4 noites, pede %', r.min_noites; end if;
  select * into r from consultar_precos('2027-03-07', '2027-03-08', 2, 0, 0);
  if r.vl_noite <> 1700 then raise exception 'FALHOU: domingo deveria custar 1700, custa %', r.vl_noite; end if;
  raise notice 'ok  Calendário recebe o mínimo de cada dia (2; feriado 3; Réveillon 4) e o domingo a R$ 1.700';
end $$;
