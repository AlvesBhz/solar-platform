"""Aplica migracao_precos_gestao.sql no Supabase e confere o resultado. NÃO roda os testes (eles criam dados de teste).

Uso (no ambiente que tem o token do Supabase; a chave é injetada pelo proxy ou vem de SUPABASE_ACCESS_TOKEN):
    python3 -I site/database/aplicar_precos_gestao.py                confere, aplica, prova que o site não mudou e verifica
    python3 -I site/database/aplicar_precos_gestao.py --so-conferir  só lê: diz se já está aplicada, sem alterar nada
Teste local (PostgreSQL comum, nunca produção):
    MODO=local PGDATABASE=banco_de_teste python3 -I site/database/aplicar_precos_gestao.py

Passos: 1) confere o ponto de partida (site, vistorias, calcular_estadia)  2) guarda um retrato do site e das funções vst_
3) aplica a migração (uma transação, pode repetir)  4) compara o retrato (nada do site nem das vistorias pode mudar)
5) verifica permissões e gatilhos. Sai com erro se qualquer passo falhar.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

REF = os.environ.get("SUPABASE_PROJECT_REF", "tnjpyjbqcjrowzjfnuln")
LOCAL = os.environ.get("MODO") == "local"
AQUI = Path(__file__).resolve().parent
URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN") or "sbp_" + "0" * 40   # o proxy troca este valor pelo token real


def falhar(msg):
    print("FALHOU: " + msg)
    sys.exit(1)


def api(sql):
    r = subprocess.run(
        ["curl", "-sS", "-m", "240", "-X", "POST", URL, "-H", "Content-Type: application/json", "-H", "Authorization: Bearer " + TOKEN,
         "--data-binary", "@-", "-w", "\n%{http_code}"],
        input=json.dumps({"query": sql}), capture_output=True, text=True)
    if r.returncode != 0:
        falhar("sem acesso à API do Supabase (" + r.stderr.strip()[-200:] + ")")
    corpo, _, codigo = r.stdout.rpartition("\n")
    if not codigo.startswith("2"):
        falhar(f"a API respondeu {codigo}: {corpo[:600]}")
    return json.loads(corpo) if corpo.strip() else []


def local(sql, arquivo=False):
    base = ["psql", "-v", "ON_ERROR_STOP=1", "-q", "-At"]
    env = {**os.environ, "PGOPTIONS": "-c client_min_messages=warning"}
    if arquivo:
        r = subprocess.run(base + ["-f", sql], capture_output=True, text=True, env=env)
    else:
        r = subprocess.run(base + ["-c", f"select coalesce(json_agg(t), '[]') from ({sql.rstrip().rstrip(';')}) t"], capture_output=True, text=True, env=env)
    if r.returncode:
        falhar(r.stderr.strip()[-800:])
    return [] if arquivo else json.loads(r.stdout.strip() or "[]")


consultar = (lambda q: local(q)) if LOCAL else api
aplicar = (lambda arq: local(str(arq), arquivo=True)) if LOCAL else (lambda arq: api(Path(arq).read_text(encoding="utf-8")))

PARTIDA = """select
  to_regclass('"SE"."SIT_TARIFA"') is not null and to_regclass('"SE"."SIT_AJUSTE_DIARIO"') is not null as precos,
  to_regprocedure('"SE".calcular_estadia(bigint,date,date,integer,integer,integer,integer)') is not null as calculo,
  to_regprocedure('"SE".vst_perfil()') is not null and to_regclass('"SE"."VST_AUDITORIA"') is not null as vistorias,
  (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname like 'prc\\_%')::int as prc"""

# retrato do site e das funções vst_: tem de ser igual antes e depois (os gatilhos *_AUTOR e as funções prc_ são o que esta migração acrescenta)
RETRATO = """select md5(string_agg(x, '|' order by x)) as retrato from (
  select c.relname || ':' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') as x
    from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum where n.nspname = 'SE' and c.relkind = 'r' and c.relname like 'SIT\\_%'
  union all select 'K:' || conrelid::regclass::text || pg_get_constraintdef(oid) from pg_constraint where connamespace = '"SE"'::regnamespace and conrelid::regclass::text like '%SIT\\_%'
  union all select 'F:' || p.proname || md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = '"SE"'::regnamespace and p.proname !~ '^(vst|prc)_' and p.prokind = 'f'
  union all select 'V:' || p.proname || md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = '"SE"'::regnamespace and p.proname ~ '^vst_' and p.prokind = 'f'
  union all select 'T:' || tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text like '%SIT\\_%' and tgname !~ '_AUTOR$'
) q"""
LINHAS = """select 'SIT_PROPRIEDADE' as t, count(*) as n from "SE"."SIT_PROPRIEDADE" union all select 'SIT_UNIDADE', count(*) from "SE"."SIT_UNIDADE"
  union all select 'SIT_RESERVA', count(*) from "SE"."SIT_RESERVA" union all select 'SIT_BLOQUEIO', count(*) from "SE"."SIT_BLOQUEIO"
  union all select 'SIT_HOSPEDE', count(*) from "SE"."SIT_HOSPEDE" union all select 'SIT_PAGAMENTO', count(*) from "SE"."SIT_PAGAMENTO"
  union all select 'SIT_TARIFA', count(*) from "SE"."SIT_TARIFA" union all select 'SIT_AJUSTE_DIARIO', count(*) from "SE"."SIT_AJUSTE_DIARIO"
  union all select 'VST_USUARIO', count(*) from "SE"."VST_USUARIO" order by 1"""

VERIFICACAO = """select 1 as n, 'funções do app (prc_*, exceto a guarda e o gatilho)' as item,
         (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname like 'prc\\_%' and proname not in ('prc_auditar_autor', 'prc_exigir_admin'))::int as obtido, 9 as esperado
  union all select 2, 'funções prc_ executáveis por anon ou public',
         (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname like 'prc\\_%' and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('public', oid, 'execute')))::int, 0
  union all select 3, 'funções do app executáveis por authenticated',
         (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname like 'prc\\_%' and proname not in ('prc_auditar_autor', 'prc_exigir_admin') and has_function_privilege('authenticated', oid, 'execute'))::int, 9
  union all select 4, 'guarda e gatilho (prc_exigir_admin, prc_auditar_autor) chamáveis pelo app',
         (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname in ('prc_auditar_autor', 'prc_exigir_admin') and (has_function_privilege('authenticated', oid, 'execute') or has_function_privilege('anon', oid, 'execute')))::int, 0
  union all select 5, 'gatilhos de autoria nas tabelas de preço',
         (select count(*) from pg_trigger where not tgisinternal and tgname in ('TG_SIT_TARIFA_AUTOR', 'TG_SIT_AJUSTE_DIARIO_AUTOR') and tgfoid = '"SE".prc_auditar_autor()'::regprocedure)::int, 2
  union all select 6, 'gatilhos auditar() do site mantidos nas tabelas de preço',
         (select count(*) from pg_trigger where not tgisinternal and tgname in ('TG_SIT_TARIFA_AUDITORIA', 'TG_SIT_AJUSTE_DIARIO_AUDITORIA'))::int, 2
  union all select 7, 'tabelas de preço com algum direito para anon ou authenticated',
         (select count(*) from information_schema.role_table_grants where table_schema = 'SE' and table_name in ('SIT_TARIFA', 'SIT_AJUSTE_DIARIO') and grantee in ('anon', 'authenticated', 'PUBLIC'))::int, 0
  union all select 8, 'tabelas de preço com RLS ligado',
         (select count(*) from pg_class c where c.relnamespace = '"SE"'::regnamespace and c.relname in ('SIT_TARIFA', 'SIT_AJUSTE_DIARIO') and c.relrowsecurity)::int, 2
  union all select 9, 'consultar_precos e consultar_disponibilidade (site público) ainda executáveis por anon',
         (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname in ('consultar_precos', 'consultar_disponibilidade') and has_function_privilege('anon', oid, 'execute'))::int, 2
  order by 1"""


def main():
    so_conferir = "--so-conferir" in sys.argv
    print(f"Projeto {REF}" if not LOCAL else "Banco local de teste")
    p = consultar(PARTIDA)[0]
    print("1. ponto de partida:", {k: p[k] for k in ("precos", "calculo", "vistorias")}, "· funções prc_ já existentes:", p["prc"])
    if not (p["precos"] and p["calculo"] and p["vistorias"]):
        falhar("faltam as tabelas de preço, calcular_estadia() ou a migração das vistorias: aplique antes o schema.sql do site e a migração das vistorias")
    if so_conferir and p["prc"] == 0:
        print("\nAINDA NÃO APLICADA: nenhuma função prc_ existe no schema SE.")
        sys.exit(1)
    if not so_conferir:
        antes, linhas_antes = consultar(RETRATO)[0]["retrato"], consultar(LINHAS)
        print("2. retrato do site e das vistorias guardado:", antes[:12] + "…")
        aplicar(AQUI / "migracao_precos_gestao.sql")
        print("3. migração aplicada (transação única)")
        if antes != consultar(RETRATO)[0]["retrato"] or linhas_antes != consultar(LINHAS):
            falhar("tabelas, funções ou dados do site (ou funções vst_) mudaram durante a migração: investigar antes de seguir")
        print("4. o site e as vistorias continuam idênticos (colunas, restrições, funções, gatilhos e linhas)")
    print("5. verificação:")
    ruins = 0
    for r in consultar(VERIFICACAO):
        ok = r["obtido"] == r["esperado"]
        ruins += not ok
        print(f"   {'ok  ' if ok else 'ERRO'} {r['item']}: {r['obtido']} (esperado {r['esperado']})")
    if ruins:
        falhar(f"{ruins} item(ns) da verificação não bateram")
    print("\nMIGRAÇÃO APLICADA E VERIFICADA" if not so_conferir else "\nJÁ ESTÁ APLICADA E VERIFICADA")


main()
