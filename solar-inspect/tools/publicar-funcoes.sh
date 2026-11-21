#!/usr/bin/env bash
# Publica as Edge Functions do Inspect (login-vistoria e criar-usuario) pela CLI do Supabase, pela API (sem Docker).
# Roda onde houver o token do Supabase (injetado pelo proxy ou em SUPABASE_ACCESS_TOKEN). Se a CLI não rodar aí,
# publique pelo painel (Edge Functions › Deploy) ou numa máquina com a CLI: o comando está no database/README.md.
# Opcional: ALLOWED_ORIGINS="https://origem-do-app,..." grava o segredo de origens permitidas (padrão do código: https://alvesbhz.github.io).
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-tnjpyjbqcjrowzjfnuln}"
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-sbp_$(printf '0%.0s' $(seq 40))}"   # valor de enchimento no formato esperado; o proxy troca pelo token real
cd "$(dirname "$0")/.."                                    # solar-inspect (tem supabase/config.toml e supabase/functions)
CLI="npx --yes supabase"
$CLI functions deploy login-vistoria --project-ref "$REF" --use-api --no-verify-jwt
$CLI functions deploy criar-usuario  --project-ref "$REF" --use-api
$CLI functions deploy redefinir-senha --project-ref "$REF" --use-api
if [ -n "${ALLOWED_ORIGINS:-}" ]; then $CLI secrets set "ALLOWED_ORIGINS=$ALLOWED_ORIGINS" --project-ref "$REF"; fi
$CLI functions list --project-ref "$REF"
echo "Edge Functions publicadas. Teste: criar o primeiro ADMIN (database/README.md) e entrar pelo app."
