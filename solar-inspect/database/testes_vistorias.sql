-- ════════════════════════════════════════════════════════════════════
--  Testes da migração das vistorias (rodar depois de migracao_vistorias.sql,
--  num banco de TESTE com o schema.sql e o seed_exemplo.sql do site:
--  os dados abaixo são criados só para os testes). Qualquer falha aborta.
--  Uso: tools/testar-banco.sh
-- ════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;
set search_path = "SE", extensions, public;

-- ajudantes (schema só de teste, removido no fim)
create schema teste;
grant usage on schema teste to public;
create function teste.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is not true then raise exception 'FALHOU: %', p_msg; end if;
  raise notice 'ok  %', p_msg;
end $$;
-- executa o comando como o papel atual e confere a mensagem do erro (ou o SQLSTATE)
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
create function teste.conta(p_sql text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || p_sql || ') q' into n; return n; end $$;
grant execute on all functions in schema teste to public;

\set dono       'reset role;'
\set servico    'reset role; set role service_role;'
\set como_anon  'reset role; set role anon;'
\set como_ana   'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}'', false); reset role; set role authenticated;'
\set como_gesto 'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}'', false); reset role; set role authenticated;'
\set como_admin 'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}'', false); reset role; set role authenticated;'
\set como_bia   'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}'', false); reset role; set role authenticated;'
\set como_inat  'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}'', false); reset role; set role authenticated;'
\set como_lia  'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000a4","role":"authenticated"}'', false); reset role; set role authenticated;'
\set como_beto 'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000a5","role":"authenticated"}'', false); reset role; set role authenticated;'
\set como_ninguem 'select set_config(''request.jwt.claims'', ''{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}'', false); reset role; set role authenticated;'

\echo '── 1. Estrutura'
:dono
select teste.ok((select count(*) = 13 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'SE' and c.relkind = 'r' and c.relname like 'VST\_%'), '13 tabelas VST_ em MAIÚSCULAS no schema "SE" (12 de dados + VST_AUDITORIA)');
select teste.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'public' and c.relkind = 'r' and upper(c.relname) like 'VST\_%'), 'nenhuma tabela VST_ em public');
select teste.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'SE' and c.relkind = 'r' and c.relname like 'vst%'), 'nenhuma tabela em minúsculas');
select teste.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'SE' and c.relkind = 'r' and c.relname like 'VST\_%' and not c.relrowsecurity), 'RLS ligado em toda tabela VST_');
select teste.ok(not exists (select 1 from information_schema.columns where table_schema = 'SE' and table_name like 'VST\_%' and column_name <> upper(column_name)),
                'todas as colunas em MAIÚSCULAS');
select teste.ok(not exists (select 1 from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'SE' and c.relname like 'VST\_%'
                              and not (k.conname ~ ('^(PK|FK|UQ|CK)_' || c.relname || '(_|$)') or k.conname ~ '^(PK|FK|UQ|CK)_VST_')),
                'restrições seguem PK_/FK_/UQ_/CK_ com o nome da tabela');
select teste.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'SE' and c.relkind = 'i' and c.relname ~ '^(IX|UQ)' = false
                              and c.relname !~ '^(PK_|UQ_)' and exists (select 1 from pg_index i join pg_class t on t.oid = i.indrelid
                                                                       where i.indexrelid = c.oid and t.relname like 'VST\_%')),
                'índices IX_/UQ_/PK_');
select teste.ok((select count(*) = 12 from pg_trigger tg join pg_class c on c.oid = tg.tgrelid
                 where c.relname like 'VST\_%' and tg.tgname = 'TG_' || c.relname || '_AUDITORIA' and not tg.tgisinternal),
                'gatilho TG_<TABELA>_AUDITORIA nas 12 tabelas');
select teste.ok((select count(*) = 2 from "VST_TIPO_VISTORIA" where "CD_TIPO_VISTORIA" in ('ENTRADA', 'SAIDA')), 'tipos ENTRADA e SAIDA cadastrados pela migração');
select teste.ok((select count(*) from "VST_UNIDADE") = (select count(*) from "SIT_UNIDADE"), 'uma linha VST_UNIDADE para cada chalé do site');
select teste.ok(not exists (
  select 1 from pg_constraint k join pg_class c on c.oid = k.conrelid join pg_namespace n on n.oid = c.relnamespace
  where k.contype = 'f' and n.nspname = 'SE' and c.relname like 'VST\_%'
    and not exists (select 1 from pg_index i where i.indrelid = c.oid and i.indisvalid
                    and (select array_agg(x order by x) from unnest((i.indkey::int2[])[0:cardinality(k.conkey) - 1]) x)
                      = (select array_agg(x order by x) from unnest(k.conkey) x))), 'toda chave estrangeira VST_ tem índice');
select teste.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'SE' and p.proname like 'vst\_%' and p.proname <> 'vst_distancia_metros' and (not p.prosecdef or p.proconfig is null
                              or not (p.proconfig @> array['search_path="SE", extensions, pg_temp']))),
                'funções vst_* são security definer com search_path fixo (exceto a distância, função pura)');
select teste.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'SE' and p.proname like 'vst\_%'
                              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute'))),
                'nenhuma função vst_* executável por anon ou public');
select teste.ok(not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                            where n.nspname = 'SE' and c.relname like 'VST\_%' and c.relkind = 'r'
                              and (has_table_privilege('anon', c.oid, 'select,insert,update,delete')
                                   or has_table_privilege('public', c.oid, 'select,insert,update,delete'))), 'anon sem nenhum direito nas tabelas VST_');
select teste.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                            where n.nspname = 'SE' and p.proname = 'vst_agenda' and p.pronargs > 0
                              and p.proargnames::text ~* '(cpf|passaporte|telefone|email|hospede)'
                              and exists (select 1 from unnest(p.proargnames) a where a ~* '(cpf|passaporte|telefone|email|hospede)')),
                'vst_agenda não devolve dados pessoais do hóspede');

-- ── dados de teste
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ana@exemplo.invalid'), ('00000000-0000-4000-8000-0000000000a2', 'gestor@exemplo.invalid'),
  ('00000000-0000-4000-8000-0000000000a3', 'admin@exemplo.invalid'), ('00000000-0000-4000-8000-0000000000b1', 'bia@exemplo.invalid'),
  ('00000000-0000-4000-8000-0000000000c1', 'inativo@exemplo.invalid'), ('00000000-0000-4000-8000-0000000000d1', 'ninguem@exemplo.invalid');
insert into "SIT_PROPRIEDADE" ("NM_PROPRIEDADE") values ('Outra pousada (teste)');
insert into "SIT_UNIDADE" ("ID_PROPRIEDADE", "CD_UNIDADE", "NM_UNIDADE", "QTDE_MAX_HOSPEDES", "QTDE_MAX_ADULTOS")
  select "ID_PROPRIEDADE", 'chale-b', 'Chalé B (teste)', 2, 2 from "SIT_PROPRIEDADE" where "NM_PROPRIEDADE" = 'Outra pousada (teste)';
select "ID_PROPRIEDADE" as pa from "SIT_PROPRIEDADE" where "NM_PROPRIEDADE" <> 'Outra pousada (teste)' order by 1 limit 1 \gset
select "ID_PROPRIEDADE" as pb from "SIT_PROPRIEDADE" where "NM_PROPRIEDADE" = 'Outra pousada (teste)' \gset
select "ID_UNIDADE" as ua from "SIT_UNIDADE" where "CD_UNIDADE" = 'casa-do-mirante' \gset
select "ID_UNIDADE" as ub from "SIT_UNIDADE" where "CD_UNIDADE" = 'chale-b' \gset
insert into "VST_USUARIO" ("ID_USUARIO", "NM_USUARIO", "CD_LOGIN", "CD_CPF", "TP_PERFIL", "SG_ATIVO") values
  ('00000000-0000-4000-8000-0000000000a1', 'Ana (teste)', 'ana.teste', '52998224725', 'ASSESSOR', true),
  ('00000000-0000-4000-8000-0000000000a2', 'Gestor (teste)', 'gestor.teste', null, 'GESTOR', true),
  ('00000000-0000-4000-8000-0000000000a3', 'Admin (teste)', 'admin.teste', null, 'ADMIN', true),
  ('00000000-0000-4000-8000-0000000000b1', 'Bia (teste)', 'bia.teste', null, 'ASSESSOR', true),
  ('00000000-0000-4000-8000-0000000000c1', 'Inativo (teste)', 'inativo.teste', null, 'ASSESSOR', false);
insert into "VST_USUARIO_PROPRIEDADE" ("ID_USUARIO", "ID_PROPRIEDADE") values
  ('00000000-0000-4000-8000-0000000000a1', :pa), ('00000000-0000-4000-8000-0000000000a2', :pa),
  ('00000000-0000-4000-8000-0000000000b1', :pb), ('00000000-0000-4000-8000-0000000000c1', :pa);
-- chalé A com ponto de GPS e raio de 60 m; chalé B sem GPS (só QR)
update "VST_UNIDADE" set "VL_LATITUDE" = -19.0849, "VL_LONGITUDE" = -43.5969, "QTDE_RAIO_METROS" = 60 where "ID_UNIDADE" = :ua;
update "VST_UNIDADE" set "TP_VALIDACAO" = 'QR' where "ID_UNIDADE" = :ub;
insert into "VST_AMBIENTE" ("ID_UNIDADE", "NM_AMBIENTE", "NO_ORDEM") values (:ua, 'Sala', 1), (:ua, 'Banheiro', 2), (:ub, 'Quarto B', 1);
insert into "VST_ITEM" ("ID_AMBIENTE", "NM_ITEM", "SG_CRITICO", "SG_FOTO_OBRIGATORIA", "QTDE_ESPERADA", "NO_ORDEM")
  select a."ID_AMBIENTE", x.n, x.c, x.f, x.q, x.o from "VST_AMBIENTE" a join (values
    ('Sala', 'Sofá', false, false, null::int, 1), ('Banheiro', 'Torneira', true, true, null, 1), ('Banheiro', 'Toalhas', false, false, 4, 2)) x(a, n, c, f, q, o)
    on x.a = a."NM_AMBIENTE" and a."ID_UNIDADE" = :ua;
insert into "VST_ITEM" ("ID_AMBIENTE", "NM_ITEM") select "ID_AMBIENTE", 'Cama B' from "VST_AMBIENTE" where "ID_UNIDADE" = :ub;
insert into "VST_TIPO_VISTORIA_ITEM" ("ID_TIPO_VISTORIA", "ID_ITEM")
  select t."ID_TIPO_VISTORIA", i."ID_ITEM" from "VST_TIPO_VISTORIA" t cross join "VST_ITEM" i
  where (t."CD_TIPO_VISTORIA" = 'SAIDA') or (t."CD_TIPO_VISTORIA" = 'ENTRADA' and i."NM_ITEM" in ('Torneira', 'Cama B'));
select "ID_ITEM" as i_sofa from "VST_ITEM" where "NM_ITEM" = 'Sofá' \gset
select "ID_ITEM" as i_torneira from "VST_ITEM" where "NM_ITEM" = 'Torneira' \gset
select "ID_ITEM" as i_toalhas from "VST_ITEM" where "NM_ITEM" = 'Toalhas' \gset
select "ID_TIPO_VISTORIA" as t_ent from "VST_TIPO_VISTORIA" where "CD_TIPO_VISTORIA" = 'ENTRADA' \gset
select "ID_TIPO_VISTORIA" as t_sai from "VST_TIPO_VISTORIA" where "CD_TIPO_VISTORIA" = 'SAIDA' \gset
select "CD_HASH_QR" as qr_a from "VST_UNIDADE" where "ID_UNIDADE" = :ua \gset
insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "CD_CPF") values ('Hóspede Vistoria (teste)', 'vistoria@exemplo.invalid', '11144477735');
insert into "SIT_RESERVA" ("ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "TP_CANAL", "VL_HOSPEDAGEM")
  select :ua, "ID_HOSPEDE", current_date + 30, current_date + 32, 2, 'CONFIRMADA', 'TELEFONE', 3400 from "SIT_HOSPEDE" where "DS_EMAIL" = 'vistoria@exemplo.invalid';
insert into "SIT_RESERVA" ("ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "TP_CANAL", "VL_HOSPEDAGEM")
  select :ua, "ID_HOSPEDE", current_date + 40, current_date + 42, 2, 'CONFIRMADA', 'TELEFONE', 3400 from "SIT_HOSPEDE" where "DS_EMAIL" = 'vistoria@exemplo.invalid';
insert into "SIT_RESERVA" ("ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "TP_CANAL", "VL_HOSPEDAGEM")
  select :ub, "ID_HOSPEDE", current_date + 30, current_date + 32, 2, 'CONFIRMADA', 'TELEFONE', 3400 from "SIT_HOSPEDE" where "DS_EMAIL" = 'vistoria@exemplo.invalid';
select "ID_RESERVA" as r1 from "SIT_RESERVA" where "ID_UNIDADE" = :ua and "DT_CHECKIN" = current_date + 30 \gset
select "ID_RESERVA" as r2 from "SIT_RESERVA" where "ID_UNIDADE" = :ua and "DT_CHECKIN" = current_date + 40 \gset
select "ID_RESERVA" as rb from "SIT_RESERVA" where "ID_UNIDADE" = :ub \gset

\echo '── 2. Contrato com o site (a sessão do site grava como service_role)'
:servico
-- reserva CONFIRMADA: o site cria Entrada em DT_CHECKIN e Saída em DT_CHECKOUT, AGENDADAS e sem responsável
insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "ID_RESERVA", "DT_AGENDADA")
  select r."ID_UNIDADE", :t_ent, r."ID_RESERVA", r."DT_CHECKIN" from "SE"."SIT_RESERVA" r where r."ID_RESERVA" = :r1;
insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "ID_RESERVA", "DT_AGENDADA")
  select r."ID_UNIDADE", :t_sai, r."ID_RESERVA", r."DT_CHECKOUT" from "SE"."SIT_RESERVA" r where r."ID_RESERVA" = :r1;
select "ID_VISTORIA" as v_ent from "SE"."VST_VISTORIA" where "ID_RESERVA" = :r1 and "ID_TIPO_VISTORIA" = :t_ent \gset
select "ID_VISTORIA" as v_sai from "SE"."VST_VISTORIA" where "ID_RESERVA" = :r1 and "ID_TIPO_VISTORIA" = :t_sai \gset
select teste.ok((select "TP_STATUS" = 'AGENDADA' and "ID_USUARIO" is null from "SE"."VST_VISTORIA" where "ID_VISTORIA" = :'v_ent'), 'vistoria nasce AGENDADA e sem responsável');
select teste.erro(format($q$insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "ID_RESERVA", "DT_AGENDADA") values (%s, %s, %s, current_date)$q$, :ua, :t_ent, :r1),
                  '23505', 'UQ_VST_VISTORIA_RESERVA_TIPO: segunda Entrada da mesma reserva é recusada');
insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "DT_AGENDADA") values (:ua, :t_ent, current_date + 5), (:ua, :t_ent, current_date + 5);
select teste.ok(true, 'vistorias avulsas (sem reserva) do mesmo tipo e dia são permitidas');
select teste.erro(format($q$insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "DT_AGENDADA") values (%s, %s, null)$q$, :ua, :t_ent), '23502', 'DT_AGENDADA é obrigatória');
select teste.erro(format($q$insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "DT_AGENDADA", "TP_STATUS") values (%s, %s, current_date, 'ENVIADA')$q$, :ua, :t_ent), '23514', 'TP_STATUS fora da lista é recusado');
select teste.erro(format($q$insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "ID_RESERVA", "DT_AGENDADA") values (%s, %s, %s, current_date)$q$, :ua, :t_ent, :rb),
                  'reserva_de_outra_unidade', 'reserva de outro chalé é recusada');
select teste.erro(format($q$delete from "SE"."SIT_RESERVA" where "ID_RESERVA" = %s$q$, :r1), '23503', 'FK para SIT_RESERVA não tem cascade (apagar a reserva é barrado)');
-- reserva REMARCADA: as AGENDADAS passam para a reserva nova e as novas datas
update "SE"."VST_VISTORIA" set "ID_RESERVA" = :r2, "DT_AGENDADA" = (select "DT_CHECKIN" from "SE"."SIT_RESERVA" where "ID_RESERVA" = :r2) where "ID_VISTORIA" = :'v_ent';
select teste.ok((select "ID_RESERVA" = :r2 from "SE"."VST_VISTORIA" where "ID_VISTORIA" = :'v_ent'), 'remarcação: vistoria agendada passa para a reserva nova');
update "SE"."VST_VISTORIA" set "ID_RESERVA" = :r1, "DT_AGENDADA" = (select "DT_CHECKIN" from "SE"."SIT_RESERVA" where "ID_RESERVA" = :r1) where "ID_VISTORIA" = :'v_ent';
-- reserva CANCELADA: as AGENDADAS viram CANCELADA
insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "ID_RESERVA", "DT_AGENDADA", "ID_VISTORIA_ENTRADA")
  select :ua, :t_ent, :r2, current_date + 40, null;
update "SE"."VST_VISTORIA" set "TP_STATUS" = 'CANCELADA' where "ID_RESERVA" = :r2 and "TP_STATUS" = 'AGENDADA';
select teste.ok((select count(*) = 1 from "SE"."VST_VISTORIA" where "ID_RESERVA" = :r2 and "TP_STATUS" = 'CANCELADA'), 'cancelamento: vistoria agendada vira CANCELADA');
update "SE"."VST_VISTORIA" set "ID_VISTORIA_ENTRADA" = :'v_ent' where "ID_VISTORIA" = :'v_sai';
select teste.ok((select "ID_VISTORIA_ENTRADA" = :'v_ent' from "SE"."VST_VISTORIA" where "ID_VISTORIA" = :'v_sai'), 'a Saída aponta para a Entrada');
select teste.erro(format($q$update "SE"."VST_VISTORIA" set "ID_VISTORIA_ENTRADA" = "ID_VISTORIA" where "ID_VISTORIA" = '%s'$q$, :'v_sai'), 'entrada_invalida', 'vistoria não pode ser a própria entrada');
select teste.erro(format($q$update "SE"."VST_VISTORIA" set "TP_STATUS" = 'CONCLUIDA' where "ID_VISTORIA" = '%s'$q$, :'v_sai'), '23514', 'CONCLUIDA exige início, fim e responsável');
select teste.ok((select count(*) = 0 from "SE"."SIT_BLOQUEIO" where "TP_MOTIVO" = 'MANUTENCAO'), 'o site não ganhou bloqueio de manutenção até aqui');

\echo '── 3. Permissões'
:como_anon
select teste.erro($q$select * from "SE"."VST_VISTORIA"$q$, '42501', 'anon não lê VST_VISTORIA');
select teste.erro($q$insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "DT_AGENDADA") values (1, 1, current_date)$q$, '42501', 'anon não grava vistoria');
select teste.erro($q$select * from "SE".vst_agenda(current_date, current_date + 7)$q$, '42501', 'anon não executa vst_agenda');
select teste.erro($q$select "SE".vst_tem_acesso(1)$q$, '42501', 'anon não executa as funções auxiliares');
:como_ninguem
select teste.ok(teste.conta($q$select 1 from "SE"."VST_VISTORIA"$q$) = 0, 'login sem cadastro de equipe não vê vistorias');
select teste.erro($q$select * from "SE".vst_agenda(current_date, current_date + 7)$q$, 'usuario_inativo_ou_inexistente', 'login sem cadastro de equipe não usa a agenda');
:como_inat
select teste.erro($q$select * from "SE".vst_agenda(current_date, current_date + 7)$q$, 'usuario_inativo_ou_inexistente', 'usuário inativo é barrado');
select teste.ok(teste.conta($q$select 1 from "SE"."VST_VISTORIA"$q$) = 0, 'usuário inativo não lê vistorias');
:como_ana
select teste.erro($q$select * from "SE"."SIT_RESERVA"$q$, '42501', 'assessor não lê SIT_RESERVA direto (só por função)');
select teste.erro($q$select * from "SE"."SIT_HOSPEDE"$q$, '42501', 'assessor não lê SIT_HOSPEDE (CPF, passaporte, telefone)');
select teste.erro($q$insert into "SE"."SIT_BLOQUEIO" ("ID_UNIDADE", "DT_INI", "DT_FIM", "TP_MOTIVO") values (1, current_date, current_date + 1, 'MANUTENCAO')$q$, '42501', 'app nunca escreve direto em SIT_BLOQUEIO');
select teste.erro($q$update "SE"."SIT_UNIDADE" set "NM_UNIDADE" = 'x'$q$, '42501', 'app não altera tabelas SIT_');
select teste.erro($q$insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "DT_AGENDADA") values (1, 1, current_date)$q$, '42501', 'assessor não insere vistoria direto (só por vst_criar_vistoria)');
select teste.erro($q$update "SE"."VST_VISTORIA" set "TP_STATUS" = 'CANCELADA'$q$, '42501', 'assessor não altera vistoria direto');
select teste.erro($q$select "CD_HASH_QR" from "SE"."VST_UNIDADE"$q$, '42501', 'assessor não lê o código do QR');
select teste.erro($q$update "SE"."VST_UNIDADE" set "TP_SITUACAO" = 'LIBERADO'$q$, '42501', 'situação do chalé não muda por UPDATE direto');
select teste.erro($q$insert into "SE"."VST_AMBIENTE" ("ID_UNIDADE", "NM_AMBIENTE") values (1, 'x')$q$, '42501', 'assessor não cadastra ambiente') ;
select teste.erro($q$select * from "SE"."SIT_AUDITORIA"$q$, '42501', 'assessor não lê SIT_AUDITORIA');

\echo '── 4. Isolamento por propriedade'
:como_ana
select teste.ok(teste.conta(format($q$select 1 from "SE"."VST_VISTORIA" where "ID_UNIDADE" = %s$q$, :ua)) > 0, 'Ana vê as vistorias do chalé da pousada dela');
select teste.ok(teste.conta(format($q$select 1 from "SE"."VST_VISTORIA" where "ID_UNIDADE" = %s$q$, :ub)) = 0, 'Ana não vê vistorias da outra pousada');
select teste.ok((select count(*) = 1 from "SE".vst_unidades()), 'vst_unidades devolve só o chalé da pousada da Ana');
select teste.ok((select count(*) = 5 and count(*) filter (where tp_status = 'CANCELADA') = 1 from "SE".vst_agenda(current_date, current_date + 60) where id_unidade = :ua),
                 'vst_agenda lista as vistorias do chalé A (2 da reserva, 2 avulsas e 1 cancelada)');
select teste.ok((select count(*) = 0 from "SE".vst_agenda(current_date, current_date + 60) where id_unidade = :ub), 'vst_agenda não mostra o chalé B');
select teste.ok((select cd_reserva is not null and dt_checkin is not null from "SE".vst_agenda(current_date, current_date + 60) where id_vistoria = :'v_sai'), 'agenda traz código e datas da reserva');
select teste.erro(format($q$select * from "SE".vst_checklist(%s, %s)$q$, :ub, :t_sai), 'sem_acesso', 'checklist de chalé sem acesso é recusado');
select teste.erro(format($q$select "SE".vst_criar_vistoria(%s, 'ROTINA', current_date)$q$, :ub), 'sem_acesso', 'não cria vistoria em chalé sem acesso');
select teste.ok(teste.conta($q$select 1 from "SE"."VST_USUARIO"$q$) = 1, 'assessor vê só o próprio cadastro');
:como_bia
select teste.ok(teste.conta(format($q$select 1 from "SE"."VST_VISTORIA" where "ID_UNIDADE" = %s$q$, :ua)) = 0, 'Bia não vê a pousada A');
select teste.ok((select count(*) = 1 from "SE".vst_unidades() where id_unidade = :ub), 'Bia vê o chalé B');
select teste.erro(format($q$select "SE".vst_iniciar_vistoria('%s')$q$, :'v_sai'), 'sem_acesso', 'Bia não inicia vistoria da pousada A');
:como_gesto
select teste.ok(teste.conta($q$select 1 from "SE"."VST_USUARIO"$q$) = 3, 'gestor vê a equipe da pousada dele (Ana, ele e o inativo)');
:como_admin
select teste.ok((select count(*) = 2 from "SE".vst_unidades()), 'ADMIN vê os chalés de todas as pousadas');
select teste.ok(teste.conta($q$select 1 from "SE"."VST_USUARIO"$q$) = 5, 'ADMIN vê toda a equipe');

\echo '── 5. Fluxo do app: iniciar, concluir, ocorrência e bloqueio'
:como_ana
select teste.erro(format($q$select * from "SE".vst_iniciar_vistoria('%s')$q$, :'v_sai'), 'qr_obrigatorio', 'chalé A exige QR (herdado da propriedade)');
select teste.erro(format($q$select * from "SE".vst_iniciar_vistoria('%s', 'qr-errado')$q$, :'v_sai'), 'qr_invalido', 'QR de outro chalé é recusado');
select teste.ok((select count(*) = 1 from "SE".vst_resolver_qr(:'qr_a')), 'vst_resolver_qr acha o chalé pelo QR');
select teste.ok((select count(*) = 0 from "SE".vst_resolver_qr('inexistente')), 'QR desconhecido não devolve nada');
-- GPS a ~1,1 km do ponto: fora do raio de 60 m → inicia, mas sinaliza
select teste.ok((select sg_fora_raio and 'FORA_RAIO' = any(ds_sinalizacoes) and qtde_distancia_metros > 1000
                 from "SE".vst_iniciar_vistoria(:'v_sai', :'qr_a', -19.0749, -43.5969, 10)), 'GPS fora do raio inicia e sinaliza FORA_RAIO');
select teste.ok((select "TP_STATUS" = 'EM_ANDAMENTO' and "ID_USUARIO" = '00000000-0000-4000-8000-0000000000a1' and "ID_VISTORIA_ENTRADA" = :'v_ent'
                 from "SE"."VST_VISTORIA" where "ID_VISTORIA" = :'v_sai'), 'Ana assumiu a vistoria; Entrada ligada');
select teste.ok((select tp_status = 'EM_ANDAMENTO' from "SE".vst_iniciar_vistoria(:'v_sai', :'qr_a', -19.0749, -43.5969, 10)), 'reenviar o início não duplica nem falha');
:como_bia
select teste.erro(format($q$select "SE".vst_registrar_foto('%s', %s, '%s/x.jpg')$q$, :'v_sai', :i_torneira, :'v_sai'), 'sem_acesso', 'Bia não registra foto em vistoria da pousada A');
:como_gesto
select teste.erro(format($q$select * from "SE".vst_iniciar_vistoria('%s', '%s')$q$, :'v_sai', :'qr_a'), 'vistoria_nao_agendada', 'não se inicia vistoria já em andamento por outro');
:como_ana
select teste.erro(format($q$select * from "SE".vst_concluir_vistoria('%s', '[]'::jsonb)$q$, :'v_sai'), 'respostas_obrigatorias', 'concluir sem respostas é recusado');
select teste.erro(format($q$select * from "SE".vst_concluir_vistoria('%s', '[{"id_item":%s,"tp_resposta":"OK"}]'::jsonb)$q$, :'v_sai', :i_sofa), 'itens_pendentes', 'faltam itens do checklist');
select teste.erro(format($q$select * from "SE".vst_concluir_vistoria('%s', '[{"id_item":999999,"tp_resposta":"OK"}]'::jsonb)$q$, :'v_sai'), 'item_fora_do_checklist', 'item fora do checklist é recusado');
select format('[{"id_item":%s,"tp_resposta":"OK"},{"id_item":%s,"tp_resposta":"PROBLEMA","ds_observacao":"Torneira pingando"},{"id_item":%s,"tp_resposta":"OK","qtde_encontrada":4}]',
              :i_sofa, :i_torneira, :i_toalhas) as resp \gset
select format('[{"id_item":%s,"cd_arquivo":"%s/torneira-1.jpg","vl_latitude":-19.0849,"vl_longitude":-43.5969}]', :i_torneira, :'v_sai') as fotos \gset
select teste.erro(format($q$select * from "SE".vst_concluir_vistoria('%s', '%s'::jsonb, '[]'::jsonb, 'assinatura.png')$q$, :'v_sai', :'resp'), 'foto_obrigatoria', 'item com foto obrigatória sem foto é recusado');
select teste.erro(format($q$select * from "SE".vst_concluir_vistoria('%s', '%s'::jsonb, '%s'::jsonb)$q$, :'v_sai', :'resp', :'fotos'), 'assinatura_obrigatoria', 'Saída exige assinatura');
select teste.erro(format($q$select * from "SE".vst_concluir_vistoria('%s', '[{"id_item":%s,"tp_resposta":"OK"},{"id_item":%s,"tp_resposta":"PROBLEMA"},{"id_item":%s,"tp_resposta":"OK"}]'::jsonb, '%s'::jsonb, 'a.png')$q$,
                         :'v_sai', :i_sofa, :i_torneira, :i_toalhas, :'fotos'), 'observacao_obrigatoria', 'PROBLEMA exige observação');
select teste.ok(teste.conta(format($q$select 1 from "SE"."VST_RESPOSTA" where "ID_VISTORIA" = '%s'$q$, :'v_sai')) = 0, 'recusas não deixam respostas pela metade');
select teste.erro(format($q$select * from "SE".vst_atualizar_agenda('%s', null, current_date + 3, false)$q$, :'v_ent'), 'perfil_sem_permissao', 'assessor não mexe na agenda');
select tp_status as r_status, ds_sinalizacoes as r_sin, qtde_ocorrencias as r_oc, id_bloqueio as r_bloq
  from "SE".vst_concluir_vistoria(:'v_sai', :'resp', :'fotos', 'assinaturas/x.png', 'Torneira vazando', 'EM_LIMPEZA') \gset
select teste.ok(:'r_status' = 'CONCLUIDA' and :r_oc = 1 and :'r_bloq' <> '', 'conclui: 1 ocorrência e 1 bloqueio');
select teste.ok(:'r_sin' like '%FORA_RAIO%' and :'r_sin' like '%RAPIDA%', 'sinalizações FORA_RAIO e RAPIDA registradas');
select tp_status = 'CONCLUIDA' as reenvio_ok, id_bloqueio::text = :'r_bloq' as mesmo_bloqueio from "SE".vst_concluir_vistoria(:'v_sai', :'resp', :'fotos', 'assinaturas/x.png') \gset
select teste.ok(:'reenvio_ok' = 't' and :'mesmo_bloqueio' = 't', 'reenviar a conclusão não duplica nada');
select teste.ok((select count(*) = 1 from "SE"."VST_OCORRENCIA" where "ID_VISTORIA" = :'v_sai') and (select count(*) = 3 from "SE"."VST_RESPOSTA" where "ID_VISTORIA" = :'v_sai')
                and (select count(*) = 1 from "SE"."VST_FOTO" where "ID_VISTORIA" = :'v_sai'), 'sem duplicatas após o reenvio');
select teste.ok((select "TP_GRAVIDADE" = 'CRITICA' and "ID_BLOQUEIO" = :r_bloq from "SE"."VST_OCORRENCIA" where "ID_VISTORIA" = :'v_sai'), 'item crítico gera ocorrência CRITICA ligada ao bloqueio');
select teste.ok((select "TP_SITUACAO_RESULTANTE" = 'MANUTENCAO' from "SE"."VST_VISTORIA" where "ID_VISTORIA" = :'v_sai'), 'ocorrência crítica manda na situação do chalé');
:dono
select teste.ok((select b."TP_MOTIVO" = 'MANUTENCAO' and b."ID_CALENDARIO" is null and b."DT_INI" = (now() at time zone 'America/Sao_Paulo')::date and b."DT_FIM" = (now() at time zone 'America/Sao_Paulo')::date + 7
                 from "SIT_BLOQUEIO" b where b."ID_BLOQUEIO" = :r_bloq), 'bloqueio MANUTENCAO de hoje por 7 dias, sem ID_CALENDARIO');
select teste.ok((select "TP_SITUACAO" = 'MANUTENCAO' from "VST_UNIDADE" where "ID_UNIDADE" = :ua), 'chalé em MANUTENCAO');
-- o site já respeita BLOQUEIO: a consulta de disponibilidade recusa essas noites
select teste.ok((select not disponivel and motivo = 'ocupado' from consultar_disponibilidade(current_date + 2, current_date + 4, 2, 0) where cd_unidade = 'casa-do-mirante'),
                'consultar_disponibilidade do site recusa as noites bloqueadas (motivo ocupado)');
-- foto registrada depois da conclusão
:como_ana
select "SE".vst_registrar_foto(:'v_sai', :i_torneira, :'v_sai' || '/torneira-2.png', -19.0849, -43.5969, 8) as f2 \gset
select teste.ok((select count(*) = 2 from "SE"."VST_FOTO" where "ID_VISTORIA" = :'v_sai'), 'vst_registrar_foto grava foto tardia');
select teste.erro(format($q$select "SE".vst_registrar_foto('%s', %s, 'outra-pasta/x.jpg')$q$, :'v_sai', :i_torneira), '23514', 'foto fora da pasta da vistoria é recusada');
select teste.erro(format($q$select "SE".vst_registrar_foto('%s', %s, '%s/x.gif')$q$, :'v_sai', :i_torneira, :'v_sai'), '23514', 'foto que não é JPEG, PNG ou WEBP é recusada');
-- situação do chalé
select teste.erro(format($q$select "SE".vst_alterar_situacao_unidade(%s, 'MANUTENCAO')$q$, :ua), 'perfil_sem_permissao', 'assessor não coloca o chalé em MANUTENCAO');
select teste.erro(format($q$select "SE".vst_alterar_situacao_unidade(%s, 'LIBERADO')$q$, :ua), 'ocorrencias_criticas_abertas', 'não libera com ocorrência crítica aberta');
select teste.erro(format($q$select "SE".vst_rotacionar_qr(%s)$q$, :ua), 'perfil_sem_permissao', 'assessor não rotaciona o QR');
:como_gesto
select "ID_OCORRENCIA" as oc from "SE"."VST_OCORRENCIA" where "ID_VISTORIA" = :'v_sai' \gset
:como_ana
select teste.erro(format($q$select "SE".vst_resolver_ocorrencia(%s)$q$, :oc), 'perfil_sem_permissao', 'assessor não resolve ocorrência');
:como_bia
select teste.erro(format($q$select "SE".vst_resolver_ocorrencia(%s)$q$, :oc), 'perfil_sem_permissao', 'gestão de outra pousada não vale');
:como_gesto
select "SE".vst_resolver_ocorrencia(:oc, 'EM_TRATAMENTO', 'Encanador chamado');
select teste.erro(format($q$select "SE".vst_resolver_ocorrencia(%s, 'EM_TRATAMENTO', null, true)$q$, :oc), 'status_invalido', 'só libera quando a ocorrência está resolvida');
select "SE".vst_resolver_ocorrencia(:oc, 'RESOLVIDA', 'Encanador trocou o reparo', true);
:dono
select teste.ok((select "TP_STATUS" = 'RESOLVIDA' and "DT_RESOLUCAO" is not null from "VST_OCORRENCIA" where "ID_OCORRENCIA" = :oc), 'ocorrência resolvida com data');
select teste.ok((select "TP_SITUACAO" = 'LIBERADO' from "VST_UNIDADE" where "ID_UNIDADE" = :ua), 'chalé liberado');
select teste.ok((select "DT_FIM" = (now() at time zone 'America/Sao_Paulo')::date + 1 from "SIT_BLOQUEIO" where "ID_BLOQUEIO" = :r_bloq), 'liberar encerra o bloqueio: DT_FIM = amanhã (data da pousada)');
select teste.ok((select coalesce(motivo, '') <> 'ocupado' from consultar_disponibilidade(current_date + 2, current_date + 4, 2, 0) where cd_unidade = 'casa-do-mirante'),
                'o site volta a vender as noites depois da liberação');
select teste.ok((select "DS_TRATAMENTO" ~ '^\d{2}/\d{2}/\d{4} \d{2}:\d{2} · .+: Encanador chamado\n\d{2}/\d{2}/\d{4} \d{2}:\d{2} · .+: Encanador trocou o reparo$' from "VST_OCORRENCIA" where "ID_OCORRENCIA" = :oc),
                'o tratamento acumula o histórico com data, hora e autor (nada é sobrescrito)');
:como_gesto
select teste.erro(format($q$select "SE".vst_resolver_ocorrencia(%s, 'EM_TRATAMENTO', 'reabrir')$q$, :oc), 'ocorrencia_encerrada', 'ocorrência resolvida não reabre nem recebe comentário');
select teste.ok((select count(*) = 1 and bool_and(nm_item = 'Torneira' and nm_ambiente = 'Banheiro' and nm_unidade is not null and nm_tipo_vistoria = 'Saída'
                    and dt_bloqueio_fim = (now() at time zone 'America/Sao_Paulo')::date and tp_status = 'RESOLVIDA')
                 from "SE".vst_ocorrencias(:ua) where id_ocorrencia = :oc), 'vst_ocorrencias traz item, ambiente, vistoria e o último dia do bloqueio');
:como_bia
select teste.ok((select count(*) = 0 from "SE".vst_ocorrencias(:ua)), 'vst_ocorrencias não mostra ocorrências de outra pousada');
:como_anon
select teste.erro($q$select * from "SE".vst_ocorrencias()$q$, '42501', 'anon não lista ocorrências');
-- QR
:como_gesto
select "SE".vst_obter_qr(:ua) as qr_v1 \gset
select cd_hash_qr as qr_novo, no_versao_qr as qr_ver from "SE".vst_rotacionar_qr(:ua) \gset
select teste.ok(:'qr_novo' <> :'qr_a' and :qr_ver = 2, 'rotacionar gera novo código e soma 1 na versão');
:como_ana
select teste.ok((select count(*) = 0 from "SE".vst_resolver_qr(:'qr_a')), 'QR antigo deixa de valer');
select teste.ok((select count(*) = 1 from "SE".vst_resolver_qr(:'qr_novo')), 'QR novo vale');
-- ── situação do chalé pela vistoria (Entrada → OCUPADO, Saída → EM_LIMPEZA, nunca tira de MANUTENCAO)
:como_ana
select "SE".vst_criar_vistoria(:ua, 'ENTRADA', current_date) as v_e2 \gset
select "SE".vst_criar_vistoria(:ua, 'ENTRADA', current_date) as v_e3 \gset
select format('[{"id_item":%s,"tp_resposta":"OK"}]', :i_torneira) as resp_e \gset
select format('[{"id_item":%s,"cd_arquivo":"%s/t.jpg"}]', :i_torneira, :'v_e2') as fotos_e2 \gset
select format('[{"id_item":%s,"cd_arquivo":"%s/t.jpg"}]', :i_torneira, :'v_e3') as fotos_e3 \gset
select tp_status from "SE".vst_iniciar_vistoria(:'v_e2', :'qr_novo', -19.0849, -43.5969, 8) \gset
select tp_status as e2_status, qtde_ocorrencias as e2_oc from "SE".vst_concluir_vistoria(:'v_e2', :'resp_e', :'fotos_e2') \gset
:dono
select teste.ok((select "TP_SITUACAO" = 'OCUPADO' from "VST_UNIDADE" where "ID_UNIDADE" = :ua)
                 and (select "TP_SITUACAO_RESULTANTE" = 'OCUPADO' from "VST_VISTORIA" where "ID_VISTORIA" = :'v_e2'), 'Entrada concluída põe o chalé em OCUPADO');
:servico
insert into "SE"."VST_VISTORIA" ("ID_UNIDADE", "ID_TIPO_VISTORIA", "ID_RESERVA", "DT_AGENDADA") values (:ua, :t_sai, :r2, current_date);
select "ID_VISTORIA" as v_s2 from "SE"."VST_VISTORIA" where "ID_RESERVA" = :r2 and "ID_TIPO_VISTORIA" = :t_sai \gset
:como_ana
select format('[{"id_item":%s,"tp_resposta":"OK"},{"id_item":%s,"tp_resposta":"OK"},{"id_item":%s,"tp_resposta":"OK","qtde_encontrada":4}]', :i_sofa, :i_torneira, :i_toalhas) as resp_s \gset
select format('[{"id_item":%s,"cd_arquivo":"%s/t.jpg"}]', :i_torneira, :'v_s2') as fotos_s2 \gset
select tp_status from "SE".vst_iniciar_vistoria(:'v_s2', :'qr_novo', -19.0849, -43.5969, 8) \gset
select tp_status from "SE".vst_concluir_vistoria(:'v_s2', :'resp_s', :'fotos_s2', 'assinaturas/s2.png') \gset
:dono
select teste.ok((select "TP_SITUACAO" = 'EM_LIMPEZA' from "VST_UNIDADE" where "ID_UNIDADE" = :ua), 'Saída concluída sem problema põe o chalé em EM_LIMPEZA (a equipe libera depois)');
:como_gesto
select "SE".vst_alterar_situacao_unidade(:ua, 'MANUTENCAO');
:como_ana
select tp_status from "SE".vst_iniciar_vistoria(:'v_e3', :'qr_novo', -19.0849, -43.5969, 8) \gset
select tp_status from "SE".vst_concluir_vistoria(:'v_e3', :'resp_e', :'fotos_e3') \gset
:dono
select teste.ok((select "TP_SITUACAO" = 'MANUTENCAO' from "VST_UNIDADE" where "ID_UNIDADE" = :ua), 'a regra padrão nunca tira o chalé de MANUTENCAO');
:como_gesto
select "SE".vst_alterar_situacao_unidade(:ua, 'LIBERADO');
:dono
select teste.ok((select "TP_SITUACAO" = 'LIBERADO' from "VST_UNIDADE" where "ID_UNIDADE" = :ua), 'gestor libera o chalé depois da limpeza');
-- ── T07: tipos do chalé e vistoria a retomar; gravidade escolhida no app
:como_ana
select "SE".vst_criar_vistoria(:ua, 'ENTRADA', (now() at time zone 'America/Sao_Paulo')::date) as v_na \gset
select tp_status from "SE".vst_iniciar_vistoria(:'v_na', :'qr_novo', -19.0849, -43.5969, 8) \gset
select teste.ok((select tp_status = 'CONCLUIDA' from "SE".vst_concluir_vistoria(:'v_na', format('[{"id_item":%s,"tp_resposta":"NAO_SE_APLICA"}]', :i_torneira)::jsonb)),
                'item com foto obrigatória marcado "não se aplica" conclui sem foto');
:como_gesto
select "SE".vst_alterar_situacao_unidade(:ua, 'LIBERADO');
:como_ana
select "SE".vst_criar_vistoria(:ua, 'SAIDA', (now() at time zone 'America/Sao_Paulo')::date) as v_s3 \gset
select teste.ok((select count(*) filter (where cd_tipo_vistoria = 'ENTRADA' and qtde_itens = 1) = 1
                    and count(*) filter (where cd_tipo_vistoria = 'SAIDA' and qtde_itens = 3) = 1 from "SE".vst_tipos_unidade(:ua)), 'vst_tipos_unidade traz os tipos com a quantidade de itens do chalé');
select teste.ok((select id_vistoria = :'v_s3' and tp_status = 'AGENDADA' from "SE".vst_tipos_unidade(:ua) where cd_tipo_vistoria = 'SAIDA'), 'oferece a Saída agendada para hoje');
select tp_status from "SE".vst_iniciar_vistoria(:'v_s3', :'qr_novo', -19.0849, -43.5969, 8) \gset
select teste.ok((select id_vistoria = :'v_s3' and tp_status = 'EM_ANDAMENTO' from "SE".vst_tipos_unidade(:ua) where cd_tipo_vistoria = 'SAIDA'), 'retoma a minha vistoria em andamento');
:como_bia
select teste.erro(format($q$select * from "SE".vst_tipos_unidade(%s)$q$, :ua), 'sem_acesso', 'tipos de chalé sem acesso são recusados');
:como_ana
select format('[{"id_item":%s,"tp_resposta":"PROBLEMA","ds_observacao":"Sofá rasgado","tp_gravidade":"%%s"},{"id_item":%s,"tp_resposta":"OK"},{"id_item":%s,"tp_resposta":"OK"}]', :i_sofa, :i_torneira, :i_toalhas) as resp_g \gset
select format('[{"id_item":%s,"cd_arquivo":"%s/t.jpg"}]', :i_torneira, :'v_s3') as fotos_s3 \gset
select teste.erro(format($q$select * from "SE".vst_concluir_vistoria('%s', '%s'::jsonb, '%s'::jsonb, 'x.png')$q$, :'v_s3', format(:'resp_g', 'URGENTE'), :'fotos_s3'), 'gravidade_invalida', 'gravidade fora da lista é recusada');
select qtde_ocorrencias as g_oc, id_bloqueio is null as g_sem_bloq from "SE".vst_concluir_vistoria(:'v_s3', format(:'resp_g', 'MEDIA')::jsonb, :'fotos_s3'::jsonb, 'x.png') \gset
:dono
select teste.ok(:g_oc = 1 and :'g_sem_bloq' = 't' and (select "TP_GRAVIDADE" = 'MEDIA' from "VST_OCORRENCIA" where "ID_VISTORIA" = :'v_s3'), 'a gravidade escolhida no app (MEDIA) é gravada e não bloqueia');
:como_ana
select "SE".vst_criar_vistoria(:ua, 'SAIDA', (now() at time zone 'America/Sao_Paulo')::date) as v_s4 \gset
select tp_status from "SE".vst_iniciar_vistoria(:'v_s4', :'qr_novo', -19.0849, -43.5969, 8) \gset
select format('[{"id_item":%s,"cd_arquivo":"%s/t.jpg"}]', :i_torneira, :'v_s4') as fotos_s4 \gset
select id_bloqueio is not null as g_bloq from "SE".vst_concluir_vistoria(:'v_s4', format(:'resp_g', 'CRITICA')::jsonb, :'fotos_s4'::jsonb, 'x.png') \gset
:dono
select teste.ok(:'g_bloq' = 't' and (select "TP_SITUACAO" = 'MANUTENCAO' from "VST_UNIDADE" where "ID_UNIDADE" = :ua), 'gravidade CRITICA escolhida no app bloqueia o chalé (MANUTENCAO)');
:como_gesto
select o."ID_OCORRENCIA" as oc_s4 from "SE"."VST_OCORRENCIA" o where o."ID_VISTORIA" = :'v_s4' \gset
select "SE".vst_resolver_ocorrencia(:oc_s4, 'RESOLVIDA', 'Sofá trocado', true);
-- ── responsável e prazo (T26)
select o."ID_OCORRENCIA" as oc_s3 from "SE"."VST_OCORRENCIA" o where o."ID_VISTORIA" = :'v_s3' \gset
select teste.erro(format($q$select "SE".vst_planejar_ocorrencia(%s, '00000000-0000-4000-8000-0000000000b1')$q$, :oc_s3), 'responsavel_invalido', 'responsável sem acesso à pousada é recusado');
select teste.erro(format($q$select "SE".vst_planejar_ocorrencia(%s, null, current_date - 2)$q$, :oc_s3), 'prazo_invalido', 'prazo no passado é recusado');
select teste.erro(format($q$select "SE".vst_planejar_ocorrencia(%s, '00000000-0000-4000-8000-0000000000a1')$q$, :oc_s4), 'ocorrencia_encerrada', 'ocorrência encerrada não recebe responsável');
select "SE".vst_planejar_ocorrencia(:oc_s3, '00000000-0000-4000-8000-0000000000a1', current_date + 3);
select teste.ok((select nm_responsavel = 'Ana (teste)' and dt_prazo = current_date + 3 and tp_status = 'EM_TRATAMENTO' and ds_tratamento like '%Responsável: Ana (teste) · prazo:%'
                 from "SE".vst_ocorrencias(:ua) where id_ocorrencia = :oc_s3), 'define responsável e prazo, põe em tratamento e registra no histórico');
:como_ana
select teste.erro(format($q$select "SE".vst_planejar_ocorrencia(%s, null, null)$q$, :oc_s3), 'perfil_sem_permissao', 'assessor não define responsável nem prazo (só a gestão)');
select teste.ok((select count(*) = 1 from "SE".vst_ocorrencias(:ua) where id_ocorrencia = :oc_s3 and id_responsavel = '00000000-0000-4000-8000-0000000000a1'), 'o responsável vê a ocorrência atribuída a ele');
:como_gesto

-- ── perfis de campo: limpeza e manutenção
:dono
select teste.erro($q$insert into "VST_USUARIO" ("ID_USUARIO", "NM_USUARIO", "CD_LOGIN", "TP_PERFIL") values ('00000000-0000-4000-8000-0000000000a4', 'x', 'zelador.x', 'ZELADOR')$q$, '23514', 'perfil fora da lista é recusado');
select teste.erro($q$insert into "VST_USUARIO" ("ID_USUARIO", "NM_USUARIO", "CD_LOGIN", "TP_PERFIL") values ('00000000-0000-4000-8000-0000000000a4', 'x', '12345678901', 'LIMPEZA')$q$, '23514', 'usuário que começa por número (pareceria CPF) é recusado');
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000a4', 'lia@exemplo.invalid'), ('00000000-0000-4000-8000-0000000000a5', 'beto@exemplo.invalid');
insert into "VST_USUARIO" ("ID_USUARIO", "NM_USUARIO", "CD_LOGIN", "TP_PERFIL") values
  ('00000000-0000-4000-8000-0000000000a4', 'Lia (limpeza)', 'lia.limpeza', 'LIMPEZA'), ('00000000-0000-4000-8000-0000000000a5', 'Beto (manutenção)', 'beto.manut', 'MANUTENCAO');
insert into "VST_USUARIO_PROPRIEDADE" ("ID_USUARIO", "ID_PROPRIEDADE") values ('00000000-0000-4000-8000-0000000000a4', :pa), ('00000000-0000-4000-8000-0000000000a5', :pa);
:como_lia
select teste.ok((select count(*) > 0 from "SE".vst_agenda(current_date, current_date + 60) where id_unidade = :ua), 'limpeza vê a agenda da pousada dela');
select teste.erro(format($q$select "SE".vst_atualizar_agenda('%s', null, current_date + 3)$q$, :'v_e2'), 'perfil_sem_permissao', 'limpeza não mexe na agenda');
select teste.erro(format($q$select "SE".vst_alterar_situacao_unidade(%s, 'MANUTENCAO')$q$, :ua), 'perfil_sem_permissao', 'limpeza não coloca o chalé em MANUTENCAO');
select teste.erro(format($q$select "SE".vst_resolver_ocorrencia(%s)$q$, :oc), 'perfil_sem_permissao', 'limpeza não resolve ocorrência');
select teste.erro($q$select "CD_HASH_QR" from "SE"."VST_UNIDADE"$q$, '42501', 'limpeza não lê o código do QR');
select "SE".vst_alterar_situacao_unidade(:ua, 'EM_LIMPEZA') as _ \gset
select "SE".vst_alterar_situacao_unidade(:ua, 'LIBERADO') as _ \gset
select teste.ok(true, 'limpeza marca EM_LIMPEZA e LIBERADO');
select "SE".vst_criar_vistoria(:ua, 'ROTINA', current_date) as v_lia \gset
select teste.ok((select "ID_USUARIO" = '00000000-0000-4000-8000-0000000000a4' from "SE"."VST_VISTORIA" where "ID_VISTORIA" = :'v_lia'), 'limpeza cria vistoria avulsa para si');
:como_beto
select teste.erro(format($q$select "SE".vst_resolver_ocorrencia(%s, 'CANCELADA')$q$, :oc), 'perfil_sem_permissao', 'manutenção não cancela ocorrência (só a gestão)');
select teste.erro(format($q$select "SE".vst_resolver_ocorrencia(%s, 'RESOLVIDA', null, true)$q$, :oc), 'perfil_sem_permissao', 'manutenção não libera o chalé (só a gestão)');
select teste.erro(format($q$select "SE".vst_resolver_ocorrencia(%s, 'RESOLVIDA')$q$, :oc + 999), 'ocorrencia_inexistente', 'ocorrência inexistente');
:dono
update "VST_OCORRENCIA" set "TP_STATUS" = 'ABERTA', "DT_RESOLUCAO" = null where "ID_OCORRENCIA" = :oc;
:como_beto
select "SE".vst_resolver_ocorrencia(:oc, 'EM_TRATAMENTO', 'Encanador chamado pela manutenção') as _ \gset
select "SE".vst_resolver_ocorrencia(:oc, 'RESOLVIDA', 'Reparo feito pela manutenção') as _ \gset
:dono
select teste.ok((select "TP_STATUS" = 'RESOLVIDA' and "DS_TRATAMENTO" like '%manutenção%' from "VST_OCORRENCIA" where "ID_OCORRENCIA" = :oc), 'manutenção trata e resolve a ocorrência (sem liberar o chalé)');
:como_beto
-- tipos que cada perfil de campo pode fazer (VST_TIPO_VISTORIA.DS_PERFIS)
select teste.ok("SE".vst_criar_vistoria(:ua, 'MANUTENCAO', current_date) is not null, 'manutenção cria vistoria do tipo MANUTENCAO');
select teste.erro(format($q$select "SE".vst_criar_vistoria(%s, 'SAIDA', current_date)$q$, :ua), 'perfil_sem_permissao', 'manutenção não faz Saída');
select teste.erro(format($q$select "SE".vst_criar_vistoria(%s, 'ENTRADA', current_date)$q$, :ua), 'perfil_sem_permissao', 'manutenção não faz Entrada');
:como_lia
select teste.ok("SE".vst_criar_vistoria(:ua, 'SAIDA', current_date) is not null, 'limpeza cria vistoria de Saída');
select teste.erro(format($q$select "SE".vst_criar_vistoria(%s, 'ENTRADA', current_date)$q$, :ua), 'perfil_sem_permissao', 'limpeza não faz Entrada');
select teste.erro(format($q$select "SE".vst_criar_vistoria(%s, 'MANUTENCAO', current_date)$q$, :ua), 'perfil_sem_permissao', 'limpeza não faz vistoria de manutenção');
select teste.erro(format($q$select * from "SE".vst_iniciar_vistoria('%s', '%s')$q$, :'v_ent', :'qr_novo'), 'perfil_sem_permissao', 'limpeza não inicia a Entrada gerada pelo site');
:como_gesto
select teste.ok("SE".vst_criar_vistoria(:ua, 'ENTRADA', current_date) is not null, 'gestor faz qualquer tipo, mesmo fora de DS_PERFIS');
:dono
select teste.erro($q$update "VST_TIPO_VISTORIA" set "DS_PERFIS" = array['ZELADOR'] where "CD_TIPO_VISTORIA" = 'ROTINA'$q$, '23514', 'DS_PERFIS só aceita perfis de campo');
select teste.erro($q$update "VST_TIPO_VISTORIA" set "DS_PERFIS" = '{}' where "CD_TIPO_VISTORIA" = 'ROTINA'$q$, '23514', 'DS_PERFIS não pode ficar vazio');
select teste.ok((select "DS_PERFIS" = array['ASSESSOR'] from "VST_TIPO_VISTORIA" where "CD_TIPO_VISTORIA" = 'ENTRADA'), 'padrão: Entrada só para o assessor de vistoria');

:como_beto
select teste.erro(format($q$select * from "SE".vst_iniciar_vistoria('%s', '%s')$q$, :'v_lia', :'qr_novo'), 'vistoria_de_outro_usuario', 'manutenção não assume a vistoria de outra pessoa');
select teste.ok((select count(*) = 1 from "SE".vst_unidades()), 'manutenção vê só os chalés da pousada dela');

-- gestão da agenda e vistoria avulsa
:como_gesto
select "SE".vst_atualizar_agenda(:'v_ent', '00000000-0000-4000-8000-0000000000a1', current_date + 31) as _ \gset
select teste.ok((select "ID_USUARIO" = '00000000-0000-4000-8000-0000000000a1' and "DT_AGENDADA" = current_date + 31 from "SE"."VST_VISTORIA" where "ID_VISTORIA" = :'v_ent'), 'gestor atribui responsável e remarca');
select teste.erro(format($q$select "SE".vst_atualizar_agenda('%s', '00000000-0000-4000-8000-0000000000b1')$q$, :'v_ent'), 'responsavel_invalido', 'responsável de outra pousada é recusado');
select teste.erro(format($q$select "SE".vst_atualizar_agenda('%s', null, null, true)$q$, :'v_sai'), 'vistoria_nao_agendada', 'não cancela vistoria concluída');
:como_ana
select "SE".vst_criar_vistoria(:ua, 'ROTINA', current_date, '0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4eaa') as v_av \gset
select teste.ok(:'v_av' = '0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4eaa', 'vistoria avulsa usa o id gerado no celular');
select teste.ok("SE".vst_criar_vistoria(:ua, 'ROTINA', current_date, '0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4eaa') = '0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4eaa', 'reenviar a criação devolve a mesma vistoria');
select teste.ok((select "ID_USUARIO" = '00000000-0000-4000-8000-0000000000a1' and "ID_RESERVA" is null from "SE"."VST_VISTORIA" where "ID_VISTORIA" = :'v_av'), 'assessor cria a avulsa para si, sem reserva');
select teste.erro(format($q$select "SE".vst_criar_vistoria(%s, 'NAO_EXISTE', current_date)$q$, :ua), 'tipo_inexistente', 'tipo inexistente é recusado');
select teste.erro(format($q$select "SE".vst_criar_vistoria(%s, 'ROTINA', current_date, null, %s)$q$, :ua, :r1), 'perfil_sem_permissao', 'assessor não liga vistoria a reserva');

\echo '── 6. Storage (bucket vistorias)'
:dono
select teste.ok((select not public and file_size_limit = 5242880 and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] from storage.buckets where id = 'vistorias'),
                'bucket vistorias privado, 5 MB, só JPEG/PNG/WEBP');
select teste.ok(not exists (select 1 from storage.buckets where id = 'documentos'), 'o bucket documentos não foi tocado nem criado pela migração');
:como_ana
insert into storage.objects (bucket_id, name) values ('vistorias', :'v_sai' || '/storage-1.jpg');
select teste.ok(true, 'Ana grava foto na pasta da vistoria dela');
select teste.erro(format($q$insert into storage.objects (bucket_id, name) values ('vistorias', '%s/x.gif')$q$, :'v_sai'), '42501', 'extensão fora de JPEG/PNG/WEBP é recusada');
select teste.erro($q$insert into storage.objects (bucket_id, name) values ('vistorias', 'qualquer/x.jpg')$q$, '42501', 'pasta que não é o id de uma vistoria é recusada');
select teste.erro($q$insert into storage.objects (bucket_id, name) values ('documentos', 'x.jpg')$q$, '42501', 'ninguém grava no bucket documentos');
select teste.ok(teste.conta($q$select 1 from storage.objects where bucket_id = 'vistorias'$q$) = 1, 'Ana lê a foto');
do $$ declare n int; begin
  update storage.objects set name = name || 'x' where bucket_id = 'vistorias'; get diagnostics n = row_count;
  perform teste.ok(n = 0, 'foto não pode ser alterada pelo app (nenhuma linha atualizada)');
  delete from storage.objects where bucket_id = 'vistorias'; get diagnostics n = row_count;
  perform teste.ok(n = 0, 'foto não pode ser apagada pelo app (nenhuma linha removida)');
end $$;
:como_bia
select teste.ok(teste.conta($q$select 1 from storage.objects where bucket_id = 'vistorias'$q$) = 0, 'Bia (outra pousada) não vê as fotos da pousada A');
select teste.erro(format($q$insert into storage.objects (bucket_id, name) values ('vistorias', '%s/bia.jpg')$q$, :'v_sai'), '42501', 'Bia não grava na pasta de vistoria da pousada A');
:como_anon
select teste.ok(teste.conta($q$select 1 from storage.objects where bucket_id = 'vistorias'$q$) = 0, 'anon não lê o bucket vistorias');
select teste.erro(format($q$insert into storage.objects (bucket_id, name) values ('vistorias', '%s/anon.jpg')$q$, :'v_sai'), '42501', 'anon não grava no bucket vistorias');

\echo '── 6a. Aceite de localização (T03)'
:como_anon
select teste.erro($q$select "SE".vst_registrar_aceite_lgpd()$q$, '42501', 'anon não registra aceite');
:como_inat
select teste.erro($q$select "SE".vst_registrar_aceite_lgpd()$q$, 'usuario_inativo_ou_inexistente', 'usuário inativo não registra aceite');
:como_ninguem
select teste.erro($q$select "SE".vst_registrar_aceite_lgpd()$q$, 'usuario_inativo_ou_inexistente', 'login sem cadastro não registra aceite');
:como_bia
select "SE".vst_registrar_aceite_lgpd() as aceite1 \gset
select "SE".vst_registrar_aceite_lgpd() as aceite2 \gset
select teste.ok(:'aceite1' <> '' and :'aceite1' = :'aceite2', 'aceite gravado; repetir mantém a primeira data');
select teste.ok((select "DT_ACEITE_LGPD" is not null from "SE"."VST_USUARIO" where "CD_LOGIN" = 'bia.teste'), 'o funcionário lê o próprio aceite (RLS)');
:dono
select teste.ok((select count(*) = 1 from "VST_USUARIO" where "DT_ACEITE_LGPD" is not null and "CD_LOGIN" in ('bia.teste', 'ana.teste', 'gestor.teste') ), 'aceite de um não marca os outros');

\echo '── 6b. Login por usuário ou CPF e cadastro de funcionários (Edge Functions, service_role)'
:como_anon
select teste.erro($q$select * from "SE".vst_localizar_login('ana.teste')$q$, '42501', 'anon não localiza login');
select teste.erro($q$select "SE".vst_cadastrar_usuario(gen_random_uuid(), 'x', 'xyz', null, 'ASSESSOR', array[1])$q$, '42501', 'anon não cadastra usuário');
:como_admin
select teste.erro($q$select * from "SE".vst_localizar_login('ana.teste')$q$, '42501', 'nem o ADMIN logado localiza login pelo app (só a Edge Function)');
select teste.erro($q$select "SE".vst_cadastrar_usuario(gen_random_uuid(), 'x', 'xyz', null, 'ASSESSOR', array[1])$q$, '42501', 'nem o ADMIN logado cadastra pelo banco (só a Edge Function criar-usuario)');
:servico
select teste.ok((select count(*) = 1 and bool_and(sg_ativo and tp_perfil = 'ASSESSOR' and ds_email = 'ana@exemplo.invalid') from "SE".vst_localizar_login('ana.teste')), 'localiza pelo usuário');
select teste.ok((select count(*) = 1 from "SE".vst_localizar_login('  ANA.Teste ')), 'usuário não diferencia maiúsculas nem espaços');
select teste.ok((select count(*) = 1 and bool_and(nm_usuario = 'Ana (teste)') from "SE".vst_localizar_login('529.982.247-25')), 'localiza pelo CPF com pontuação');
select teste.ok((select count(*) = 1 from "SE".vst_localizar_login('52998224725')), 'localiza pelo CPF só com números');
select teste.ok((select count(*) = 0 from "SE".vst_localizar_login('ninguem.assim')), 'login inexistente não devolve nada');
select teste.ok((select count(*) = 0 from "SE".vst_localizar_login('')), 'login vazio não devolve nada');
select teste.ok((select sg_ativo is false from "SE".vst_localizar_login('inativo.teste')), 'usuário inativo vem marcado como inativo (a função recusa o login)');
:dono
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000e1', 'novo1@exemplo.invalid'), ('00000000-0000-4000-8000-0000000000e2', 'novo2@exemplo.invalid');
:servico
select "SE".vst_cadastrar_usuario('00000000-0000-4000-8000-0000000000e1', '  Maria Limpeza ', ' Maria.Limpeza ', '111.444.777-35', 'LIMPEZA', array[:pa]::bigint[]) as _ \gset
select teste.ok((select "NM_USUARIO" = 'Maria Limpeza' and "CD_LOGIN" = 'maria.limpeza' and "CD_CPF" = '11144477735' and "TP_PERFIL" = 'LIMPEZA' and "SG_ATIVO"
                 from "SE"."VST_USUARIO" where "ID_USUARIO" = '00000000-0000-4000-8000-0000000000e1'), 'cadastra o funcionário (login minúsculo, CPF só com números, ativo)');
select teste.ok((select count(*) = 1 from "SE"."VST_USUARIO_PROPRIEDADE" where "ID_USUARIO" = '00000000-0000-4000-8000-0000000000e1' and "ID_PROPRIEDADE" = :pa), 'liga o funcionário à pousada');
select teste.ok((select count(*) = 1 from "SE".vst_localizar_login('111.444.777-35')), 'o funcionário novo já entra pelo CPF');
select teste.erro(format($q$select "SE".vst_cadastrar_usuario('00000000-0000-4000-8000-0000000000e2', 'Outro', 'maria.limpeza', null, 'ASSESSOR', array[%s]::bigint[])$q$, :pa), 'login_em_uso', 'usuário repetido é recusado');
select teste.erro(format($q$select "SE".vst_cadastrar_usuario('00000000-0000-4000-8000-0000000000e2', 'Outro', 'outro.func', '11144477735', 'ASSESSOR', array[%s]::bigint[])$q$, :pa), 'cpf_em_uso', 'CPF repetido é recusado');
select teste.erro(format($q$select "SE".vst_cadastrar_usuario('00000000-0000-4000-8000-0000000000e2', 'Outro', 'outro.func', '11144477736', 'ASSESSOR', array[%s]::bigint[])$q$, :pa), 'cpf_invalido', 'CPF com dígito errado é recusado');
select teste.erro(format($q$select "SE".vst_cadastrar_usuario('00000000-0000-4000-8000-0000000000e2', 'Outro', 'outro.func', null, 'ZELADOR', array[%s]::bigint[])$q$, :pa), 'perfil_invalido', 'perfil inexistente é recusado');
select teste.erro($q$select "SE".vst_cadastrar_usuario('00000000-0000-4000-8000-0000000000e2', 'Outro', 'outro.func', null, 'ASSESSOR', array[999999]::bigint[])$q$, 'propriedade_inexistente', 'pousada inexistente é recusada');
select teste.erro($q$select "SE".vst_cadastrar_usuario('00000000-0000-4000-8000-0000000000e2', 'Outro', 'outro.func', null, 'MANUTENCAO', '{}'::bigint[])$q$, 'propriedade_obrigatoria', 'funcionário de campo precisa de ao menos uma pousada');
select teste.erro($q$select "SE".vst_cadastrar_usuario('00000000-0000-4000-8000-0000000000e2', 'Outro', '12345678901', null, 'ADMIN', '{}'::bigint[])$q$, 'dados_invalidos', 'usuário que parece CPF é recusado');
select "SE".vst_cadastrar_usuario('00000000-0000-4000-8000-0000000000e2', 'Admin Novo', 'admin.novo', null, 'ADMIN', '{}'::bigint[]) as _ \gset
select teste.ok((select count(*) = 1 from "SE"."VST_USUARIO" where "CD_LOGIN" = 'admin.novo'), 'ADMIN pode ser cadastrado sem pousada (vê todas)');
:dono

\echo '── 6b2. Senha provisória (troca obrigatória)'
:dono
select teste.ok((select "SG_TROCAR_SENHA" from "VST_USUARIO" where "CD_LOGIN" = 'maria.limpeza'), 'funcionário cadastrado começa com senha provisória');
update "VST_USUARIO" set "SG_TROCAR_SENHA" = false where "CD_LOGIN" = 'bia.teste';
:como_bia
select teste.erro($q$select "SE".vst_exigir_troca_senha('00000000-0000-4000-8000-0000000000b1')$q$, '42501', 'o app não marca senha provisória (só a Edge Function)');
:como_anon
select teste.erro($q$select "SE".vst_senha_trocada()$q$, '42501', 'anon não desmarca a troca de senha');
:servico
select "SE".vst_exigir_troca_senha('00000000-0000-4000-8000-0000000000b1') as _ \gset
:dono
select teste.ok((select "SG_TROCAR_SENHA" from "VST_USUARIO" where "CD_LOGIN" = 'bia.teste'), 'redefinir a senha marca a troca obrigatória');
:como_bia
select "SE".vst_senha_trocada() as _ \gset
:dono
select teste.ok((select not "SG_TROCAR_SENHA" from "VST_USUARIO" where "CD_LOGIN" = 'bia.teste'), 'o funcionário desmarca a própria troca depois de trocar a senha');
select teste.ok((select "SG_TROCAR_SENHA" from "VST_USUARIO" where "CD_LOGIN" = 'maria.limpeza'), 'desmarcar a própria troca não afeta os outros');

\echo '── 6c. T32 usuários e pousadas'
:como_ana
select teste.ok((select count(*) = 1 and bool_and(qtde_unidades = 1) from "SE".vst_propriedades()), 'vst_propriedades: assessor vê só a pousada dele, com a contagem de chalés');
select teste.erro($q$update "SE"."VST_USUARIO" set "TP_PERFIL" = 'ADMIN' where "CD_LOGIN" = 'ana.teste'$q$, '0', 'assessor não se promove a ADMIN') where false;
do $$ declare n int; begin update "SE"."VST_USUARIO" set "TP_PERFIL" = 'ADMIN' where "CD_LOGIN" = 'ana.teste'; get diagnostics n = row_count;
  perform teste.ok(n = 0, 'assessor não se promove a ADMIN (nenhuma linha alterada)'); end $$;
:como_admin
select teste.ok((select count(*) >= 2 from "SE".vst_propriedades()), 'vst_propriedades: ADMIN vê todas as pousadas');
:como_anon
select teste.erro($q$select * from "SE".vst_propriedades()$q$, '42501', 'anon não lista pousadas');
:dono
update "VST_USUARIO" set "SG_ATIVO" = false where "TP_PERFIL" = 'ADMIN' and "CD_LOGIN" <> 'admin.teste';
select teste.erro($q$update "VST_USUARIO" set "SG_ATIVO" = false where "CD_LOGIN" = 'admin.teste'$q$, 'ultimo_admin', 'não desativa o último ADMIN ativo');
select teste.erro($q$update "VST_USUARIO" set "TP_PERFIL" = 'GESTOR' where "CD_LOGIN" = 'admin.teste'$q$, 'ultimo_admin', 'não rebaixa o último ADMIN ativo');
select teste.erro($q$delete from "VST_USUARIO" where "CD_LOGIN" = 'admin.teste'$q$, 'ultimo_admin', 'não apaga o último ADMIN ativo');
update "VST_USUARIO" set "SG_ATIVO" = true where "CD_LOGIN" = 'admin.novo';
update "VST_USUARIO" set "SG_ATIVO" = false where "CD_LOGIN" = 'admin.teste';
select teste.ok(true, 'com outro ADMIN ativo, desativar um ADMIN é permitido');
update "VST_USUARIO" set "SG_ATIVO" = true where "CD_LOGIN" = 'admin.teste';

\echo '── 6d. T28/T29 configuração da pousada'
:como_gesto
do $$ declare n int; begin update "SE"."VST_PROPRIEDADE" set "QTDE_RAIO_METROS" = 200; get diagnostics n = row_count;
  perform teste.ok(n = 0, 'gestor não altera a configuração da pousada (só ADMIN)'); end $$;
:como_admin
update "SE"."VST_PROPRIEDADE" set "QTDE_RAIO_METROS" = 150, "VL_LATITUDE" = -19.08, "VL_LONGITUDE" = -43.59 where "ID_PROPRIEDADE" = :pa;
select teste.ok((select "QTDE_RAIO_METROS" = 150 from "SE"."VST_PROPRIEDADE" where "ID_PROPRIEDADE" = :pa), 'ADMIN ajusta raio e ponto da pousada');
select teste.erro(format($q$update "SE"."VST_PROPRIEDADE" set "QTDE_RAIO_METROS" = 5 where "ID_PROPRIEDADE" = %s$q$, :pa), '23514', 'raio fora de 10 a 1.000 m é recusado');
select teste.erro(format($q$update "SE"."VST_PROPRIEDADE" set "VL_LATITUDE" = null where "ID_PROPRIEDADE" = %s$q$, :pa), '23514', 'latitude sem longitude é recusada');
select teste.erro(format($q$update "SE"."VST_PROPRIEDADE" set "TP_VALIDACAO" = 'NFC' where "ID_PROPRIEDADE" = %s$q$, :pa), '23514', 'validação fora da lista é recusada');
:dono
delete from "VST_PROPRIEDADE" where "ID_PROPRIEDADE" = :pb;
:como_admin
insert into "SE"."VST_PROPRIEDADE" ("ID_PROPRIEDADE", "TP_VALIDACAO") values (:pb, 'QR')
  on conflict ("ID_PROPRIEDADE") do update set "TP_VALIDACAO" = excluded."TP_VALIDACAO";
select teste.ok((select "TP_VALIDACAO" = 'QR' from "SE"."VST_PROPRIEDADE" where "ID_PROPRIEDADE" = :pb), 'ADMIN cria a configuração que faltava (upsert)');
:como_gesto
select teste.erro(format($q$insert into "SE"."VST_PROPRIEDADE" ("ID_PROPRIEDADE") values (%s)$q$, :pb), '42501', 'gestor não cria configuração de pousada');
:dono

\echo '── 6e. T31 tipos de vistoria'
:como_admin
select teste.erro($q$update "SE"."VST_TIPO_VISTORIA" set "SG_ATIVO" = false where "CD_TIPO_VISTORIA" = 'ENTRADA'$q$, 'tipo_do_site', 'ENTRADA não pode ser desativado (o site gera vistorias com ele)');
select teste.erro($q$update "SE"."VST_TIPO_VISTORIA" set "CD_TIPO_VISTORIA" = 'CHEGADA' where "CD_TIPO_VISTORIA" = 'SAIDA'$q$, 'tipo_do_site', 'SAIDA não muda de código');
select teste.erro($q$update "SE"."VST_TIPO_VISTORIA" set "TP_COMPORTAMENTO" = 'ROTINA' where "CD_TIPO_VISTORIA" = 'SAIDA'$q$, 'tipo_do_site', 'SAIDA não muda de comportamento');
update "SE"."VST_TIPO_VISTORIA" set "NM_TIPO_VISTORIA" = 'Saída do hóspede', "DS_PERFIS" = array['ASSESSOR'] where "CD_TIPO_VISTORIA" = 'SAIDA';
select teste.ok((select "NM_TIPO_VISTORIA" = 'Saída do hóspede' from "SE"."VST_TIPO_VISTORIA" where "CD_TIPO_VISTORIA" = 'SAIDA'), 'nome e perfis de SAIDA podem mudar');
insert into "SE"."VST_TIPO_VISTORIA" ("CD_TIPO_VISTORIA", "NM_TIPO_VISTORIA", "TP_COMPORTAMENTO", "TP_PERIODICIDADE", "DS_PERFIS") values ('ROTINA_MENSAL', 'Rotina mensal', 'ROTINA', 'MENSAL', array['LIMPEZA']);
update "SE"."VST_TIPO_VISTORIA" set "SG_ATIVO" = false where "CD_TIPO_VISTORIA" = 'ROTINA_MENSAL';
select teste.ok(true, 'ADMIN cria e desativa um tipo próprio');
select teste.erro($q$insert into "SE"."VST_TIPO_VISTORIA" ("CD_TIPO_VISTORIA", "NM_TIPO_VISTORIA", "TP_COMPORTAMENTO", "TP_PERIODICIDADE") values ('X1', 'Entrada extra', 'ENTRADA', 'MENSAL')$q$, '23514', 'periodicidade só em rotina');
select teste.erro($q$insert into "SE"."VST_TIPO_VISTORIA" ("CD_TIPO_VISTORIA", "NM_TIPO_VISTORIA", "TP_COMPORTAMENTO") values ('x minúsculo', 'Tipo x', 'ROTINA')$q$, '23514', 'código só em MAIÚSCULAS, números e _');
:como_gesto
do $$ declare n int; begin update "SE"."VST_TIPO_VISTORIA" set "NM_TIPO_VISTORIA" = 'x' where "CD_TIPO_VISTORIA" = 'ROTINA'; get diagnostics n = row_count;
  perform teste.ok(n = 0, 'gestor não altera tipos (só ADMIN)'); end $$;
:dono
update "VST_TIPO_VISTORIA" set "NM_TIPO_VISTORIA" = 'Saída', "DS_PERFIS" = array['ASSESSOR', 'LIMPEZA'] where "CD_TIPO_VISTORIA" = 'SAIDA';

\echo '── 6f. Autor das mudanças (VST_AUDITORIA) e T34'
:dono
select teste.ok((select count(*) > 0 from "VST_AUDITORIA" where "ID_USUARIO" = '00000000-0000-4000-8000-0000000000a1' and "NM_TABELA" = 'VST_VISTORIA' and "NM_PAPEL" = 'authenticated'),
                'cada mudança feita pelo app grava QUEM fez (usuário do app)');
select teste.ok(not exists (select 1 from "VST_AUDITORIA" a join "VST_USUARIO" u on u."CD_CPF" is not null and a."DS_ALTERACOES"::text like '%' || u."CD_CPF" || '%'), 'o CPF nunca vai para o log');
select teste.ok(not exists (select 1 from "VST_AUDITORIA" a join "VST_UNIDADE" u on a."DS_ALTERACOES"::text like '%' || u."CD_HASH_QR" || '%')
                and exists (select 1 from "VST_AUDITORIA" where "NM_TABELA" = 'VST_UNIDADE' and "DS_ALTERACOES" ->> 'CD_HASH_QR' = '***'), 'o código do QR nunca vai para o log (só que mudou)');
select teste.ok(exists (select 1 from "VST_AUDITORIA" where "NM_TABELA" = 'VST_OCORRENCIA' and "TP_OPERACAO" = 'UPDATE' and "DS_ALTERACOES" ? 'TP_STATUS' and not "DS_ALTERACOES" ? 'DS_OCORRENCIA'),
                'UPDATE guarda só os campos alterados, com antes e depois');
select teste.ok((select count(*) = 0 from "VST_AUDITORIA" where "NM_TABELA" = 'VST_AUDITORIA'), 'o log não audita a si mesmo');
:como_admin
select teste.ok((select count(*) > 0 and bool_and(qtde_total >= count_lin) from (select qtde_total, count(*) over () as count_lin from "SE".vst_auditoria(current_date - 1, current_date + 1, null, null, 200)) x),
                'ADMIN consulta a auditoria paginada, com o total');
select teste.ok((select count(*) > 0 and bool_and(nm_usuario = 'Ana (teste)' and tp_perfil = 'ASSESSOR')
                 from "SE".vst_auditoria(current_date - 1, current_date + 1, 'VST_VISTORIA', '00000000-0000-4000-8000-0000000000a1', 200)), 'filtra por tabela e por usuário, com nome e perfil');
select teste.ok((select count(*) <= 5 from "SE".vst_auditoria(current_date - 1, current_date + 1, null, null, 5)), 'respeita o limite da página');
select teste.erro($q$select * from "SE".vst_auditoria(current_date, current_date - 1)$q$, 'periodo_invalido', 'período invertido é recusado');
select teste.erro($q$select * from "SE"."VST_AUDITORIA"$q$, '42501', 'nem o ADMIN lê a tabela direto (só pela função)');
select teste.erro($q$insert into "SE"."VST_AUDITORIA" ("NM_PAPEL", "NM_TABELA", "TP_OPERACAO", "DS_ALTERACOES") values ('x', 'x', 'INSERT', '{}')$q$, '42501', 'ninguém escreve no log pelo app');
:como_gesto
select teste.erro($q$select * from "SE".vst_auditoria(current_date, current_date)$q$, 'perfil_sem_permissao', 'gestor não consulta a auditoria (só ADMIN)');
:como_anon
select teste.erro($q$select * from "SE".vst_auditoria(current_date, current_date)$q$, '42501', 'anon não consulta a auditoria');

\echo '── 7. Auditoria (SIT_AUDITORIA)'
:dono
select teste.ok((select count(distinct "NM_TABELA") >= 6 from "SIT_AUDITORIA" where "NM_TABELA" like 'VST\_%'), 'as tabelas VST_ gravam em SIT_AUDITORIA');
select teste.ok((select count(*) > 0 from "SIT_AUDITORIA" where "NM_TABELA" = 'VST_VISTORIA' and "TP_OPERACAO" = 'UPDATE' and "DS_ANTES" is not null), 'UPDATE em VST_VISTORIA guarda o valor anterior');
select teste.ok((select count(*) > 0 from "SIT_AUDITORIA" where "NM_TABELA" = 'SIT_BLOQUEIO' and "TP_OPERACAO" = 'INSERT'), 'o bloqueio criado pela vistoria também é auditado');

\echo '── 8. Limpeza dos ajudantes'
drop schema teste cascade;
reset role;
\echo 'TODOS OS TESTES PASSARAM'
