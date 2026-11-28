#!/usr/bin/env bash
# Testa os pacotes de datas especiais num PostgreSQL de teste (NUNCA no Supabase de produção).
# Monta site + vistorias + gestão de preços, aplica migracao_pacotes.sql duas vezes (idempotente) e roda:
# testes_precos_gestao.sql (nada do que já existia quebrou), testes_pacotes.sql e testes.sql do site (cálculo fora dos pacotes).
# Uso: PGHOST=... PGPORT=... PGUSER=... site/database/testar-pacotes.sh      (PGUSER precisa ser superusuário)
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"; INSPECT="$AQUI/../../solar-inspect/database"; DB=pacotes_teste
export PGOPTIONS="-c client_min_messages=warning"
montar() {
  psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
  P="psql -v ON_ERROR_STOP=1 -q -d $DB"
  $P -f "$INSPECT/simulado_supabase.sql" >/dev/null; $P -f "$AQUI/schema.sql" >/dev/null; $P -f "$AQUI/seed_exemplo.sql" >/dev/null
  $P -f "$INSPECT/migracao_vistorias.sql" >/dev/null; $P -f "$AQUI/migracao_precos_gestao.sql" >/dev/null
}
rodar() { # $1 = arquivo de testes; passa se o psql terminar sem erro e nenhuma linha disser FALHOU
  local S rc=0; S=$(PGOPTIONS="" psql -v ON_ERROR_STOP=1 -q -d $DB -f "$1" 2>&1) || rc=$?
  echo "$S" | grep -E "FALHOU|ERROR" | head -3 || true
  echo "$(echo "$S" | grep -c 'ok  ') verificações em $(basename "$1")"
  [ $rc -eq 0 ] && ! echo "$S" | grep -q "FALHOU\|ERROR" || { echo "FALHOU: $(basename "$1")"; exit 1; }
}
montar
psql -v ON_ERROR_STOP=1 -q -d $DB -f "$AQUI/migracao_pacotes.sql" >/dev/null
psql -v ON_ERROR_STOP=1 -q -d $DB -f "$AQUI/migracao_pacotes.sql" >/dev/null && echo "ok  migracao_pacotes.sql pode ser rodada de novo (idempotente)"
rodar "$AQUI/testes_precos_gestao.sql"
rodar "$AQUI/testes_pacotes.sql"
montar; psql -v ON_ERROR_STOP=1 -q -d $DB -f "$AQUI/migracao_pacotes.sql" >/dev/null
rodar "$AQUI/testes.sql"
echo "TUDO OK"
