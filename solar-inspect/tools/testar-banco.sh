#!/usr/bin/env bash
# Testa a migração das vistorias num PostgreSQL de teste (NUNCA no Supabase de produção).
# Cria o banco "vistorias_teste", carrega o schema do site, aplica migracao_vistorias.sql duas vezes
# (idempotência), confere que nada do site mudou e roda testes_vistorias.sql.
# Uso: PGHOST=... PGPORT=... PGUSER=... tools/testar-banco.sh      (PGUSER precisa ser superusuário)
set -euo pipefail
AQUI="$(cd "$(dirname "$0")/.." && pwd)"; SITE="$AQUI/../site/database"; DB=vistorias_teste
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
export PGOPTIONS="-c client_min_messages=warning"
P="psql -v ON_ERROR_STOP=1 -q -d $DB"
$P -f "$AQUI/database/simulado_supabase.sql"
$P -f "$SITE/schema.sql" >/dev/null
$P -f "$SITE/seed_exemplo.sql" >/dev/null
# retrato das tabelas e funções do site: tem de ser idêntico depois da migração
SNAP="select md5(string_agg(x, '|' order by x)) from (
        select c.relname || ':' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') as x
          from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
          left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum where n.nspname = 'SE' and c.relkind = 'r' and c.relname like 'SIT\_%'
        union all select 'K:' || conrelid::regclass::text || pg_get_constraintdef(oid) from pg_constraint where connamespace = '\"SE\"'::regnamespace and conrelid::regclass::text like '%SIT\_%'
        union all select 'F:' || p.proname || md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = '\"SE\"'::regnamespace and p.proname !~ '^vst_'
        union all select 'T:' || tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text like '%SIT\_%'
        union all select 'D:' || count(*) from \"SE\".\"SIT_PROPRIEDADE\" union all select 'D:' || count(*) from \"SE\".\"SIT_UNIDADE\") q"
ANTES=$($P -At -c "$SNAP")
$P -f "$AQUI/database/migracao_vistorias.sql" >/dev/null
DEPOIS=$($P -At -c "$SNAP")
[ "$ANTES" = "$DEPOIS" ] || { echo "FALHOU: a migração alterou tabelas ou funções do site"; exit 1; }
echo "ok  nenhuma tabela, função ou gatilho do site foi alterado pela migração"
$P -f "$AQUI/database/migracao_vistorias.sql" >/dev/null
echo "ok  a migração pode ser rodada de novo (idempotente)"
SAIDA=$($P -f "$AQUI/database/testes_vistorias.sql" 2>&1 | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR): +/\1 /') || true
echo "$SAIDA" | grep -E "^(NOTICE ok|──|TODOS)|FALHOU|ERROR" | sed 's/^NOTICE //'
echo "$SAIDA" | grep -q "TODOS OS TESTES PASSARAM" || exit 1
if command -v node >/dev/null; then
  node --experimental-strip-types --no-warnings "$AQUI/supabase/functions/teste.mjs" 2>&1 | grep -E "FALHOU|TODAS|FALHA"
fi
