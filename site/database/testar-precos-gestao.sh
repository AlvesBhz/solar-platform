#!/usr/bin/env bash
# Testa a migração de preços num PostgreSQL de teste (NUNCA no Supabase de produção).
# Cria o banco "precos_teste", monta o site e as vistorias, aplica migracao_precos_gestao.sql duas vezes (idempotência),
# confere que nada do site mudou e roda testes_precos_gestao.sql.
# Uso: PGHOST=... PGPORT=... PGUSER=... site/database/testar-precos-gestao.sh      (PGUSER precisa ser superusuário)
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"; INSPECT="$AQUI/../../solar-inspect/database"; DB=precos_teste
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
export PGOPTIONS="-c client_min_messages=warning"
P="psql -v ON_ERROR_STOP=1 -q -d $DB"
$P -f "$INSPECT/simulado_supabase.sql"
$P -f "$AQUI/schema.sql" >/dev/null
$P -f "$AQUI/seed_exemplo.sql" >/dev/null
$P -f "$INSPECT/migracao_vistorias.sql" >/dev/null
# retrato de tudo o que é do site: tem de ser idêntico depois da migração de preços
SNAP="select md5(string_agg(x, '|' order by x)) from (
        select c.relname || ':' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') as x
          from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
          left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum where n.nspname = 'SE' and c.relkind = 'r' and c.relname like 'SIT\_%'
        union all select 'K:' || conrelid::regclass::text || pg_get_constraintdef(oid) from pg_constraint where connamespace = '\"SE\"'::regnamespace and conrelid::regclass::text like '%SIT\_%'
        union all select 'F:' || p.proname || md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = '\"SE\"'::regnamespace and p.proname !~ '^(vst|prc)_'
        union all select 'V:' || p.proname || md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = '\"SE\"'::regnamespace and p.proname ~ '^vst_'
        union all select 'T:' || tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text like '%SIT\_%' and tgname !~ '_AUTOR\$'
        union all select 'D:' || count(*) from \"SE\".\"SIT_PROPRIEDADE\" union all select 'D:' || count(*) from \"SE\".\"SIT_UNIDADE\"
        union all select 'D:' || count(*) from \"SE\".\"SIT_TARIFA\" union all select 'D:' || count(*) from \"SE\".\"SIT_AJUSTE_DIARIO\") q"
ANTES=$($P -At -c "$SNAP")
$P -f "$AQUI/migracao_precos_gestao.sql" >/dev/null
DEPOIS=$($P -At -c "$SNAP")
[ "$ANTES" = "$DEPOIS" ] || { echo "FALHOU: a migração alterou tabela, função, gatilho ou dado do site (ou função vst_ do Inspect)"; exit 1; }
echo "ok  nenhuma tabela, função, gatilho ou dado do site (nem função vst_ do Inspect) foi alterado"
$P -f "$AQUI/migracao_precos_gestao.sql" >/dev/null
echo "ok  a migração pode ser rodada de novo (idempotente)"
# a migração das vistorias, se rodar de novo depois desta, não pode tirar o acesso das funções de preço
$P -f "$INSPECT/migracao_vistorias.sql" >/dev/null
$P -At -c "select case when count(*) = 0 then 'ok  rodar de novo a migração das vistorias não mexe nas funções prc_' else 'FALHOU: a migração das vistorias mexeu em prc_' end from pg_proc where pronamespace = '\"SE\"'::regnamespace and proname = 'prc_tarifas' and not has_function_privilege('authenticated', oid, 'execute')"
SAIDA=$($P -f "$AQUI/testes_precos_gestao.sql" 2>&1 | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR): +/\1 /') || true
echo "$SAIDA" | grep -E "^(NOTICE ok|──|TODOS)|FALHOU|ERROR" | sed 's/^NOTICE //'
echo "$SAIDA" | grep -q "TODOS OS TESTES PASSARAM" || exit 1
