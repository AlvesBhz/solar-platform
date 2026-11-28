-- Testes da gestão de preços (banco de TESTE, nunca produção).
-- Ordem: simulado_supabase.sql (Inspect), schema.sql, seed_exemplo.sql, migracao_vistorias.sql (Inspect), migracao_precos_gestao.sql, este.
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
  ('00000000-0000-4000-8000-0000000000a1', 'ana@exemplo.invalid'), ('00000000-0000-4000-8000-0000000000a2', 'gestor@exemplo.invalid'),
  ('00000000-0000-4000-8000-0000000000a3', 'admin@exemplo.invalid');
insert into "VST_USUARIO" ("ID_USUARIO", "NM_USUARIO", "CD_LOGIN", "CD_CPF", "TP_PERFIL", "SG_ATIVO") values
  ('00000000-0000-4000-8000-0000000000a1', 'Ana (teste)', 'ana.teste', '52998224725', 'ASSESSOR', true),
  ('00000000-0000-4000-8000-0000000000a2', 'Gestor (teste)', 'gestor.teste', null, 'GESTOR', true),
  ('00000000-0000-4000-8000-0000000000a3', 'Admin (teste)', 'admin.teste', null, 'ADMIN', true);
select "ID_UNIDADE" as ua from "SIT_UNIDADE" where "CD_UNIDADE" = 'casa-do-mirante' \gset

\echo '── 1. Quem pode'
:como_anon
select teste.erro(format('select * from "SE".prc_tarifas(%s)', :ua), '42501', 'anon não chama prc_tarifas');
select teste.erro('select * from "SE".prc_unidades()', '42501', 'anon não chama prc_unidades');
select teste.erro(format('select * from "SE".prc_calcular(%s, current_date + 5, current_date + 7, 2)', :ua), '42501', 'anon não chama prc_calcular');
select teste.erro('select "SE".prc_exigir_admin()', '42501', 'anon não chama a guarda');
:como_ana
select teste.erro('select * from "SE".prc_unidades()', 'perfil_sem_permissao', 'assessor não vê as unidades de preço');
select teste.erro(format('select * from "SE".prc_tarifas(%s)', :ua), 'perfil_sem_permissao', 'assessor não lê as tarifas');
select teste.erro(format($q$select "SE".prc_salvar_ajustes(%s, array[current_date + 3], 900, null, false, false, false, 'x')$q$, :ua), 'perfil_sem_permissao', 'assessor não ajusta preço');
:como_gesto
select teste.erro(format('select * from "SE".prc_tarifas(%s)', :ua), 'perfil_sem_permissao', 'gestor não lê as tarifas (só o administrador)');
select teste.erro(format($q$select "SE".prc_remover_ajustes(%s, array[current_date + 3])$q$, :ua), 'perfil_sem_permissao', 'gestor não remove ajuste');
select teste.erro(format('select * from "SE".prc_calcular(%s, current_date + 5, current_date + 7, 2)', :ua), 'perfil_sem_permissao', 'gestor não usa o simulador');
:como_admin
select teste.erro('select count(*) from "SE"."SIT_TARIFA"', '42501', 'nem o administrador lê a tabela direto (só pelas funções)');
select teste.erro('update "SE"."SIT_AJUSTE_DIARIO" set "VL_NOITE" = 1', '42501', 'nem o administrador altera a tabela direto');

\echo '── 2. Leitura'
:como_admin
select teste.ok((select count(*) = 1 from "SE".prc_unidades() where cd_unidade = 'casa-do-mirante' and qtde_max_adultos = 2 and qtde_max_hospedes = 4 and qtde_max_noites = 7 and vl_percentual_sinal = 50), 'prc_unidades devolve o chalé e os limites');
select teste.ok((select count(*) = 1 from "SE".prc_tarifas(:ua) where nm_tarifa = 'Tarifa padrão' and vl_noite = 800 and vl_noite_fds = 1700 and qtde_min_noites = 2 and sg_ativo), 'prc_tarifas devolve a tarifa padrão');
select teste.ok((select count(*) = 3 from "SE".prc_ajustes(:ua, date '2026-12-24', date '2026-12-26') where vl_noite = 1700 and qtde_min_noites = 3), 'prc_ajustes devolve o Natal 2026 (3 noites, mínimo 3)');
select teste.erro(format('select * from "SE".prc_ajustes(%s, date ''2026-12-30'', date ''2026-12-01'')', :ua), 'periodo_invalido', 'período invertido é recusado');

\echo '── 3. Tarifas'
:como_admin
select "SE".prc_salvar_tarifa(null, :ua, 'Alta temporada (teste)', date '2027-07-01', date '2027-08-01', 1, 1100, 2000, 2, 0, 30, 100, 0, 3, true) as t1 \gset
select teste.ok(:t1 > 0, 'cria tarifa e devolve o id');
select teste.ok((select vl_noite = 1100 and vl_noite_fds = 2000 and qtde_min_noites = 3 from "SE".prc_tarifas(:ua) where id_tarifa = :t1), 'a tarifa nova aparece na lista');
select teste.erro(format($q$select "SE".prc_salvar_tarifa(null, %s, 'Conflito', date '2027-07-10', date '2027-07-20', 1, 900, null, 2, 0, 30, 100, 0, 2, true)$q$, :ua), 'tarifa_sobreposta', 'mesma prioridade e período sobreposto é recusado');
select "SE".prc_salvar_tarifa(null, :ua, 'Por cima (teste)', date '2027-07-10', date '2027-07-20', 2, 1500, null, 2, 0, 30, 100, 0, 2, true) as t2 \gset
select teste.ok(:t2 > 0, 'prioridade diferente pode se sobrepor');
select teste.erro(format($q$select "SE".prc_salvar_tarifa(%s, %s, 'Por cima (teste)', date '2027-07-10', date '2027-07-20', 1, 1500, null, 2, 0, 30, 100, 0, 2, true)$q$, :t2, :ua), 'tarifa_sobreposta', 'alterar a prioridade para a de outra tarifa no mesmo período é recusado');
select teste.erro(format($q$select "SE".prc_salvar_tarifa(null, %s, 'Datas trocadas', date '2028-03-10', date '2028-03-01', 3, 900, null, 2, 0, 30, 100, 0, 2, true)$q$, :ua), 'tarifa_invalida', 'fim antes do início é recusado');
select teste.erro(format($q$select "SE".prc_salvar_tarifa(null, %s, 'Percentual', date '2028-03-01', date '2028-03-10', 3, 900, null, 2, 0, 130, 100, 0, 2, true)$q$, :ua), 'tarifa_invalida', 'percentual de criança acima de 100 é recusado');
select teste.erro(format($q$select "SE".prc_salvar_tarifa(null, %s, '   ', date '2028-03-01', date '2028-03-10', 3, 900, null, 2, 0, 30, 100, 0, 2, true)$q$, :ua), 'tarifa_invalida', 'nome vazio é recusado');
select teste.erro($q$select "SE".prc_salvar_tarifa(null, 999999, 'x', date '2028-03-01', date '2028-03-10', 3, 900, null, 2, 0, 30, 100, 0, 2, true)$q$, 'unidade_inexistente', 'unidade que não existe é recusada');
select "SE".prc_alternar_tarifa(:t2, false);
select teste.ok((select not sg_ativo from "SE".prc_tarifas(:ua) where id_tarifa = :t2), 'desativa a tarifa sem apagar');
select teste.ok((select count(*) from "SE".prc_tarifas(:ua) where id_tarifa = :t2) = 1, 'a tarifa desativada continua na lista');
select "SE".prc_salvar_tarifa(:t2, :ua, 'Por cima (teste)', date '2027-07-10', date '2027-07-20', 1, 1500, null, 2, 0, 30, 100, 0, 2, false);
select teste.erro(format('select "SE".prc_alternar_tarifa(%s, true)', :t2), 'tarifa_sobreposta', 'reativar uma tarifa que passaria a sobrepor outra é recusado');
select "SE".prc_salvar_tarifa(:t2, :ua, 'Por cima (teste)', date '2027-07-10', date '2027-07-20', 2, 1500, null, 2, 0, 30, 100, 0, 2, true);
select teste.erro('select "SE".prc_alternar_tarifa(999999, true)', 'tarifa_inexistente', 'alternar tarifa que não existe é recusado');

\echo '── 4. Ajustes de um dia'
:como_admin
select teste.ok("SE".prc_salvar_ajustes(:ua, array[current_date + 40, current_date + 41, current_date + 40], 950, 3, false, false, false, ' Teste de preço ') = 2, 'grava o ajuste em 2 noites (data repetida conta uma vez)');
select teste.ok((select count(*) = 2 and bool_and(vl_noite = 950 and qtde_min_noites = 3 and ds_observacao = 'Teste de preço') from "SE".prc_ajustes(:ua, current_date + 40, current_date + 41)), 'os ajustes aparecem com valor, mínimo e observação');
select "SE".prc_salvar_ajustes(:ua, array[current_date + 40], null, null, true, true, false, null);
select teste.ok((select sg_fechado and sg_sem_chegada and not sg_sem_saida and vl_noite is null and qtde_min_noites is null and ds_observacao is null
                 from "SE".prc_ajustes(:ua, current_date + 40, current_date + 40)), 'salvar de novo substitui (fechado, sem chegada, valor e mínimo vazios)');
select teste.erro(format($q$select "SE".prc_salvar_ajustes(%s, array[(now() at time zone 'America/Sao_Paulo')::date - 1], 900, null, false, false, false, null)$q$, :ua), 'data_passada', 'noite que já passou não se ajusta');
select teste.erro(format($q$select "SE".prc_salvar_ajustes(%s, array[current_date + 50], -5, null, false, false, false, null)$q$, :ua), 'ajuste_invalido', 'valor negativo é recusado');
select teste.erro(format($q$select "SE".prc_salvar_ajustes(%s, array[current_date + 50], 900, 0, false, false, false, null)$q$, :ua), 'ajuste_invalido', 'mínimo de noites zero é recusado');
select teste.erro(format($q$select "SE".prc_salvar_ajustes(%s, array[]::date[], 900, null, false, false, false, null)$q$, :ua), 'periodo_invalido', 'lista de datas vazia é recusada');
select teste.erro(format($q$select "SE".prc_salvar_ajustes(%s, (select array_agg(current_date + g) from generate_series(1, 63) g), 900, null, false, false, false, null)$q$, :ua), 'periodo_invalido', 'mais de 62 noites de uma vez é recusado');
select teste.ok("SE".prc_remover_ajustes(:ua, array[current_date + 40, current_date + 41]) = 2, 'remove os ajustes e conta quantos');
select teste.ok((select count(*) = 0 from "SE".prc_ajustes(:ua, current_date + 40, current_date + 41)), 'depois de remover, volta a valer a tarifa');

\echo '── 5. Ocupação'
:dono
insert into "SIT_BLOQUEIO" ("ID_UNIDADE", "DT_INI", "DT_FIM", "TP_MOTIVO") values (:ua, current_date + 100, current_date + 103, 'MANUTENCAO');
insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "CD_CPF", "SG_NACIONALIDADE") values ('Hóspede Sigiloso (teste)', 'sigilo@exemplo.invalid', '52998224725', 'BR');
insert into "SIT_RESERVA" ("ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "VL_HOSPEDAGEM", "VL_SINAL", "NO_VERSAO_POLITICA", "DT_ACEITE_POLITICA")
  select :ua, "ID_HOSPEDE", current_date + 110, current_date + 112, 2, 'CONFIRMADA', 1600, 800, 1, now() from "SIT_HOSPEDE" where "CD_CPF" = '52998224725';
insert into "SIT_RESERVA" ("ID_UNIDADE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "DT_EXPIRA", "VL_HOSPEDAGEM", "VL_SINAL")
  values (:ua, current_date + 120, current_date + 122, 2, 'PENDENTE', now() + interval '20 minutes', 1600, 800),
         (:ua, current_date + 130, current_date + 132, 2, 'PENDENTE', now() - interval '1 minute', 1600, 800);
:como_admin
select teste.ok((select count(*) = 3 from "SE".prc_ocupacao(:ua, current_date + 95, current_date + 140)), 'ocupação mostra bloqueio, reserva confirmada e pré-reserva (a vencida não conta)');
select teste.ok((select string_agg(tp_ocupacao, ',' order by dt_ini) = 'bloqueio,reserva,pre-reserva' from "SE".prc_ocupacao(:ua, current_date + 95, current_date + 140)), 'os três tipos vêm na ordem das datas');
select teste.ok((select not exists (select 1 from "SE".prc_ocupacao(:ua, current_date + 95, current_date + 140) o where o.ds_rotulo ~* 'sigiloso|sigilo@|52998224725')), 'a ocupação não traz nome, e-mail nem CPF do hóspede');
select teste.ok((select count(*) = 0 from "SE".prc_ocupacao(:ua, current_date + 150, current_date + 160)), 'período livre não devolve nada');

\echo '── 6. Simulador (calcular_estadia no servidor)'
:como_admin
select teste.ok((select disponivel and vl_hospedagem = 5100 and qtde_noites = 3 and qtde_min_noites = 3 and vl_percentual_sinal = 50 from "SE".prc_calcular(:ua, date '2027-12-24', date '2027-12-27', 2)), 'Natal 2027, casal, 3 noites: R$ 5.100, mínimo 3, sinal 50%');
select teste.ok((select vl_hospedagem = 5865 from "SE".prc_calcular(:ua, date '2027-12-24', date '2027-12-27', 2, 1)), 'com 1 criança de 5 a 8 anos: R$ 5.865');
select teste.ok((select not disponivel and motivo = 'min_noites' from "SE".prc_calcular(:ua, date '2027-12-24', date '2027-12-26', 2)), 'duas noites no Natal: abaixo do mínimo');
select teste.ok((select not disponivel and motivo = 'sem_tarifa' from "SE".prc_calcular(:ua, date '2030-01-05', date '2030-01-07', 2)), 'depois do fim das tarifas: sem tarifa');
select teste.ok((select not disponivel and motivo = 'ocupado' from "SE".prc_calcular(:ua, current_date + 110, current_date + 112, 2)), 'datas com reserva confirmada: ocupado');
select teste.ok((select not disponivel and motivo = 'capacidade' from "SE".prc_calcular(:ua, current_date + 5, current_date + 7, 3)), 'três adultos: acima da capacidade');
select teste.ok((select count(*) = 3 and sum((d ->> 'vl_noite')::numeric) = 5100 from "SE".prc_calcular(:ua, date '2027-12-24', date '2027-12-27', 2) c, jsonb_array_elements(c.ds_detalhe) d), 'o detalhe noite a noite fecha com o total');

\echo '── 7. Auditoria (quem mudou o preço)'
:dono
select teste.ok((select count(*) >= 3 from "VST_AUDITORIA" where "NM_TABELA" = 'SIT_TARIFA' and "ID_USUARIO" = '00000000-0000-4000-8000-0000000000a3'), 'as mudanças de tarifa ficam na auditoria do Inspect com o administrador como autor');
select teste.ok((select count(*) >= 3 from "VST_AUDITORIA" where "NM_TABELA" = 'SIT_AJUSTE_DIARIO' and "ID_USUARIO" = '00000000-0000-4000-8000-0000000000a3' and "CD_REGISTRO" ~ '^[0-9]+/[0-9]{4}-[0-9]{2}-[0-9]{2}$'), 'as mudanças de ajuste também, com unidade/data como registro');
select teste.ok((select count(*) >= 3 from "SIT_AUDITORIA" where "NM_TABELA" = 'SIT_TARIFA'), 'a auditoria do site (auditar) continua registrando as tarifas');
:como_admin
select teste.ok((select count(*) >= 3 from "SE".vst_auditoria(current_date - 1, current_date, 'SIT_TARIFA')), 'a T34 (vst_auditoria) enxerga as mudanças de tarifa');
:como_gesto
select teste.erro('select count(*) from "SE".vst_auditoria(current_date - 1, current_date, ''SIT_TARIFA'')', 'perfil_sem_permissao', 'gestor continua sem ver a auditoria');

\echo '── 8. O que não pode mudar'
:dono
select teste.ok((select count(*) = 9 from pg_proc where pronamespace = '"SE"'::regnamespace and proname like 'prc\_%' and proname not in ('prc_auditar_autor', 'prc_exigir_admin', 'prc_pacotes', 'prc_salvar_pacote', 'prc_idades', 'prc_salvar_idades')), '9 funções do app (as dos pacotes estão em testes_pacotes.sql)');
select teste.ok((select count(*) = 0 from pg_proc where pronamespace = '"SE"'::regnamespace and proname like 'prc\_%' and has_function_privilege('anon', oid, 'execute')), 'nenhuma função prc_ liberada para anon');
select teste.ok((select count(*) = 0 from pg_proc where pronamespace = '"SE"'::regnamespace and proname in ('prc_auditar_autor', 'prc_exigir_admin') and has_function_privilege('authenticated', oid, 'execute')), 'a guarda e o gatilho não são chamáveis pelo app');
select teste.ok(not has_table_privilege('authenticated', '"SE"."SIT_TARIFA"', 'select') and not has_table_privilege('authenticated', '"SE"."SIT_AJUSTE_DIARIO"', 'update'), 'as tabelas de preço seguem sem acesso direto');

\echo '── limpeza'
:dono
delete from "SIT_RESERVA" where "ID_UNIDADE" = :ua and "DT_CHECKIN" >= current_date + 100;
delete from "SIT_HOSPEDE" where "CD_CPF" = '52998224725';
delete from "SIT_BLOQUEIO" where "ID_UNIDADE" = :ua and "DT_INI" >= current_date + 100;
drop schema teste cascade;
\echo 'TODOS OS TESTES PASSARAM'
