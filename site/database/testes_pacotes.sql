-- Testes dos pacotes de datas especiais (banco de TESTE, nunca produção).
-- Ordem: simulado_supabase.sql (Inspect), schema.sql, seed_exemplo.sql, migracao_vistorias.sql (Inspect), migracao_precos_gestao.sql, migracao_pacotes.sql, este.
-- Os dados abaixo são criados só para os testes. Qualquer falha aborta.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;
set search_path = "SE", extensions, public;

create schema teste;
grant usage on schema teste to public;
create function teste.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FALHOU: %', p_msg; end if;
  raise notice 'ok  %', p_msg;
end $$;
create function teste.erro(p_sql text, p_esperado text, p_msg text) returns void language plpgsql as $$
declare v_m text; v_s text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_m = message_text, v_s = returned_sqlstate;
    if v_m = p_esperado or v_s = p_esperado then raise notice 'ok  % (%)', p_msg, p_esperado; return; end if;
    raise exception 'FALHOU: % — esperava %, veio % (%)', p_msg, p_esperado, v_m, v_s;
  end;
  raise exception 'FALHOU: % — deveria ter dado erro %', p_msg, p_esperado;
end $$;
grant execute on all functions in schema teste to public;

\set dono       'reset role;'
\set como_anon  'reset role; set role anon;'
\set como_ana   'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}'', false); reset role; set role authenticated;'
\set como_gesto 'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}'', false); reset role; set role authenticated;'
\set como_admin 'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}'', false); reset role; set role authenticated;'

:dono
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ana@exemplo.invalid'), ('00000000-0000-4000-8000-0000000000a3', 'admin@exemplo.invalid') on conflict do nothing;
insert into "VST_USUARIO" ("ID_USUARIO", "NM_USUARIO", "CD_LOGIN", "CD_CPF", "TP_PERFIL", "SG_ATIVO") values
  ('00000000-0000-4000-8000-0000000000a1', 'Ana (teste)', 'ana.teste', '52998224725', 'ASSESSOR', true),
  ('00000000-0000-4000-8000-0000000000a3', 'Admin (teste)', 'admin.teste', null, 'ADMIN', true) on conflict do nothing;
select "ID_UNIDADE" as ua from "SIT_UNIDADE" where "CD_UNIDADE" = 'casa-do-mirante' \gset
-- tarifa de teste no fim de 2027: R$ 800 todas as noites, mínimo 2 noites (prioridade alta para não depender do seed)
:como_admin
select "SE".prc_salvar_tarifa(null, :ua, 'Fim de ano (teste)', date '2027-12-01', date '2028-01-15', 9, 800, null, 2, 0, 30, 100, 0, 2, true) as tf \gset

\echo '── Cadastro dos pacotes (só ADMIN, com validações)'
select "SE".prc_salvar_pacote(null, :ua, 'Natal (teste)', date '2027-12-24', 3, 2400) as p3 \gset
select "SE".prc_salvar_pacote(null, :ua, 'Natal (teste)', date '2027-12-24', 4, 2900) as p4 \gset
select teste.ok((select count(*) = 2 and bool_and(sg_ativo) from "SE".prc_pacotes(:ua) where nm_pacote = 'Natal (teste)'), 'ADMIN cria as opções de 3 e 4 noites do Natal');
select teste.ok((select dt_checkout = date '2027-12-28' from "SE".prc_pacotes(:ua) where id_pacote = :p4), 'o check-out sai do check-in + noites (24/12 + 4 = 28/12)');
select teste.erro(format($q$select "SE".prc_salvar_pacote(null, %s, 'Natal', date '2027-12-24', 3, 2500)$q$, :ua), 'pacote_repetido', 'a mesma combinação não se repete');
select teste.erro(format($q$select "SE".prc_salvar_pacote(null, %s, 'Outro', date '2027-12-25', 2, 1500)$q$, :ua), 'pacote_sobreposto', 'opções com check-in diferente não se sobrepõem');
select teste.erro(format($q$select "SE".prc_salvar_pacote(null, %s, 'Natal', date '2027-12-24', 5, 0)$q$, :ua), 'valor_invalido', 'preço zero é recusado');
select teste.erro(format($q$select "SE".prc_salvar_pacote(null, %s, 'Natal', date '2027-12-24', 31, 9000)$q$, :ua), 'noites_invalidas', 'mais de 30 noites é recusado');
select teste.erro(format($q$select "SE".prc_salvar_pacote(null, %s, 'Natal', current_date - 3, 3, 2400)$q$, :ua), 'data_passada', 'check-in no passado é recusado');
select teste.erro(format($q$select "SE".prc_salvar_pacote(null, %s, 'N', date '2027-11-10', 3, 2400)$q$, :ua), 'nome_invalido', 'nome curto é recusado');
:como_ana
select teste.erro(format($q$select "SE".prc_salvar_pacote(null, %s, 'Natal', date '2027-12-10', 3, 2400)$q$, :ua), 'perfil_sem_permissao', 'assessor não cadastra pacote (só ADMIN)');
:como_anon
select teste.erro(format($q$select * from "SE".prc_pacotes(%s)$q$, :ua), '42501', 'anon não lista pacotes da gestão');
select teste.erro($q$select * from "SE"."SIT_PACOTE"$q$, '42501', 'ninguém lê a tabela direto');

\echo '── Preço: estadia igual ao pacote paga o preço final'
:dono
select teste.ok((select disponivel and motivo is null and vl_hospedagem = 2400 and qtde_noites = 3 from calcular_estadia(:ua, date '2027-12-24', date '2027-12-27', 2)), 'Natal 3 noites (24 → 27): R$ 2.400');
select teste.ok((select disponivel and vl_hospedagem = 2900 from calcular_estadia(:ua, date '2027-12-24', date '2027-12-28', 2)), 'Natal 4 noites (24 → 28): R$ 2.900');
select teste.ok((select (select sum((x ->> 'vl_noite')::numeric) from jsonb_array_elements(ds_detalhe) x) = vl_hospedagem
                        and ds_detalhe -> 0 ->> 'nm_pacote' = 'Natal (teste)' from calcular_estadia(:ua, date '2027-12-24', date '2027-12-28', 2)), 'o detalhe noite a noite soma o preço do pacote e diz o nome');
select teste.ok((select vl_total = vl_hospedagem + vl_taxa_limpeza from calcular_estadia(:ua, date '2027-12-24', date '2027-12-27', 2)), 'a taxa de limpeza continua à parte');
select teste.ok((select disponivel and vl_hospedagem > 2400 from calcular_estadia(:ua, date '2027-12-24', date '2027-12-27', 2, 1)), 'criança paga por noite, além do pacote');
:como_admin
select "SE".prc_salvar_ajustes(:ua, array[date '2027-12-24'], null, 6, false, false, false, null);
:dono
select teste.ok((select disponivel from calcular_estadia(:ua, date '2027-12-24', date '2027-12-27', 2)), 'o pacote vale mesmo com mínimo de noites maior no dia (o pacote define a estadia)');
:como_admin
select "SE".prc_remover_ajustes(:ua, array[date '2027-12-24']);

\echo '── Datas de pacote: só se vende pacote'
:dono
select teste.ok((select not disponivel and motivo = 'pacote' from calcular_estadia(:ua, date '2027-12-25', date '2027-12-27', 2)), '25 → 27 (dentro do pacote, outra combinação): motivo pacote');
select teste.ok((select not disponivel and motivo = 'pacote' from calcular_estadia(:ua, date '2027-12-21', date '2027-12-25', 2)), '21 → 25 (encosta no pacote): motivo pacote');
select teste.ok((select disponivel and vl_hospedagem = 2400 from calcular_estadia(:ua, date '2027-12-20', date '2027-12-23', 2)), 'fora do pacote (20 → 23): diária normal, 3 × R$ 800');
select teste.ok((select disponivel and vl_hospedagem = 1600 from calcular_estadia(:ua, date '2027-12-28', date '2027-12-30', 2)), 'logo depois do pacote (28 → 30): diária normal');

\echo '── O que o site consulta'
:como_anon
select teste.ok((select count(*) = 2 and bool_and(nm_pacote = 'Natal (teste)') and min(qtde_noites) = 3 and max(dt_checkout) = date '2027-12-28'
                 from "SE".consultar_pacotes(date '2027-12-01', date '2028-01-01')), 'site lista as opções do Natal (consultar_pacotes, anon)');
select teste.ok((select count(*) = 0 from "SE".consultar_pacotes(date '2027-11-01', date '2027-11-30')), 'fora do período, nenhuma opção');
select teste.ok((select disponivel and vl_hospedagem = 2900 and vl_sinal > 0 from "SE".consultar_disponibilidade(date '2027-12-24', date '2027-12-28', 2) where cd_unidade = 'casa-do-mirante'), 'consultar_disponibilidade devolve o preço do pacote e o sinal');
select teste.ok((select not disponivel and motivo = 'pacote' from "SE".consultar_disponibilidade(date '2027-12-25', date '2027-12-27', 2) where cd_unidade = 'casa-do-mirante'), 'consultar_disponibilidade devolve o motivo pacote');
select teste.ok((select bool_and(livre) from "SE".consultar_precos(date '2027-12-24', date '2027-12-28', 2) ), 'no calendário do site as noites do pacote aparecem livres');

\echo '── Pré-reserva grava o preço do pacote'
:dono
select vl_total as pr_total from "SE".criar_pre_reserva('casa-do-mirante', date '2027-12-24', date '2027-12-28', 2) \gset
select teste.ok(:pr_total = (select vl_total from calcular_estadia(:ua, date '2027-12-24', date '2027-12-28', 2)), 'a pré-reserva grava o mesmo total do pacote mostrado no site');
delete from "SIT_RESERVA" where "ID_UNIDADE" = :ua and "DT_CHECKIN" = date '2027-12-24';

\echo '── Desativar'
:como_admin
select "SE".prc_salvar_pacote(:p4, :ua, 'Natal (teste)', date '2027-12-24', 4, 2900, false);
:dono
select teste.ok((select not disponivel and motivo = 'pacote' from calcular_estadia(:ua, date '2027-12-24', date '2027-12-28', 2)), 'sem a opção de 4 noites, 24 → 28 deixa de ser vendido (só a de 3)');
:como_admin
select "SE".prc_salvar_pacote(:p3, :ua, 'Natal (teste)', date '2027-12-24', 3, 2400, false);
:dono
select teste.ok((select disponivel and vl_hospedagem <> 2900 and ds_detalhe -> 0 ->> 'nm_pacote' is null and ds_detalhe -> 0 ->> 'nm_tarifa' = 'Fim de ano (teste)'
                 from calcular_estadia(:ua, date '2027-12-24', date '2027-12-28', 2)), 'sem pacotes ativos, volta o preço da tarifa noite a noite');
select teste.ok((select count(*) = 2 from "SIT_PACOTE" where "ID_UNIDADE" = :ua and not "SG_ATIVO"), 'desativar não apaga (histórico)');
select teste.ok((select count(*) > 0 from "SIT_AUDITORIA" where "NM_TABELA" = 'SIT_PACOTE'), 'mudanças nos pacotes ficam na auditoria');

\echo '── Faixas de idade das crianças (por pousada)'
:como_admin
select teste.ok((select no_idade_max_bebe = 4 and no_idade_max_crianca_menor = 8 and no_idade_max_crianca = 13 from "SE".prc_idades(:ua)), 'faixas de hoje: até 4, até 8 e até 13 anos');
select "SE".prc_salvar_idades(:ua, 3, 7, 12);
select teste.ok((select no_idade_max_bebe = 3 and no_idade_max_crianca_menor = 7 and no_idade_max_crianca = 12 from "SE".prc_idades(:ua)), 'o administrador muda as faixas');
select teste.erro(format($q$select "SE".prc_salvar_idades(%s, 8, 5, 12)$q$, :ua), 'idades_invalidas', 'faixas fora de ordem são recusadas');
select teste.erro(format($q$select "SE".prc_salvar_idades(%s, 3, 7, 18)$q$, :ua), 'idades_invalidas', 'acima de 17 já é adulto: recusado');
:dono
set role anon;
select teste.ok((select no_idade_max_bebe = 3 and no_idade_max_crianca = 12 from consultar_regras_hospedes()), 'o site lê as faixas (anon)');
reset role;
:como_admin
select "SE".prc_salvar_idades(:ua, 4, 8, 13);

\echo '── Dias da semana do segundo valor (NO_DIAS_FDS)'
:como_admin
select teste.ok((select no_dias_fds = '{5,6,7}' from "SE".prc_tarifas(:ua) where id_tarifa = :tf), 'tarifa salva sem informar os dias: sexta, sábado e domingo (como antes)');
select "SE".prc_salvar_tarifa(:tf, :ua, 'Fim de ano (teste)', date '2027-12-01', date '2028-01-15', 9, 800, 1000, 2, 0, 30, 100, 0, 2, true, '{3,3}');
select teste.ok((select no_dias_fds = '{3}' from "SE".prc_tarifas(:ua) where id_tarifa = :tf), 'dias gravados sem repetição');
:dono
select teste.ok((select vl_hospedagem = 3400 from calcular_estadia(:ua, date '2028-01-10', date '2028-01-14', 2)), 'seg a qui com quarta no segundo valor: 800 + 800 + 1000 + 800 = 3400');
select teste.ok((select vl_noite = 800 from consultar_precos(date '2028-01-08', date '2028-01-09', 2) where dt_ref = date '2028-01-08'), 'sábado fora dos dias marcados usa o primeiro valor (site)');
:como_admin
select teste.erro(format($q$select "SE".prc_salvar_tarifa(%s, %s, 'Fim de ano (teste)', date '2027-12-01', date '2028-01-15', 9, 800, 1000, 2, 0, 30, 100, 0, 2, true, '{8}')$q$, :tf, :ua), 'tarifa_invalida', 'dia da semana fora de 1 a 7 é recusado');
:dono
delete from "SIT_PACOTE" where "ID_UNIDADE" = :ua and "NM_PACOTE" = 'Natal (teste)';
update "SIT_TARIFA" set "SG_ATIVO" = false where "ID_TARIFA" = :tf;
drop schema teste cascade;
\echo 'TODOS OS TESTES PASSARAM'
