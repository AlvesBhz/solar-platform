"""Aplica a migração das vistorias no Supabase e confere o resultado. NÃO roda os testes (eles criam dados de teste).

Uso (na sessão que tem o token do Supabase; a chave é injetada pelo proxy ou vem de SUPABASE_ACCESS_TOKEN):
    python3 -I solar-inspect/tools/aplicar-supabase.py              confere, aplica, prova que o site não mudou e verifica
    python3 -I solar-inspect/tools/aplicar-supabase.py --so-conferir   só lê: diz se já está aplicada, sem alterar nada
Teste local (PostgreSQL comum, nunca produção):
    MODO=local PGDATABASE=banco_de_teste python3 -I solar-inspect/tools/aplicar-supabase.py

Passos: 1) confere o ponto de partida (tabelas do site, auditar(), Auth)  2) guarda um retrato do site
3) aplica database/migracao_vistorias.sql (uma transação, pode repetir)  4) compara o retrato (nada do site pode mudar)
5) roda database/verificar_aplicacao.sql e exige tudo "true". Sai com erro se qualquer passo falhar.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

REF = os.environ.get("SUPABASE_PROJECT_REF", "tnjpyjbqcjrowzjfnuln")
LOCAL = os.environ.get("MODO") == "local"
BANCO = Path(__file__).resolve().parent.parent / "database"
URL = f"https://api.supabase.com/v1/projects/{REF}/database/query"
# o proxy do ambiente troca este cabeçalho pelo token real; com SUPABASE_ACCESS_TOKEN definido, usa o dele
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN") or "sbp_" + "0" * 40


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
    if arquivo:
        r = subprocess.run(base + ["-f", sql], capture_output=True, text=True, env={**os.environ, "PGOPTIONS": "-c client_min_messages=warning"})
        if r.returncode:
            falhar(r.stderr.strip()[-800:])
        return []
    r = subprocess.run(base + ["-c", f"select coalesce(json_agg(t), '[]') from ({sql.rstrip().rstrip(';')}) t"], capture_output=True, text=True)
    if r.returncode:
        falhar(r.stderr.strip()[-800:])
    return json.loads(r.stdout.strip() or "[]")


def consultar(sql):
    return local(sql) if LOCAL else api(sql)


def aplicar(arquivo):
    return local(str(arquivo), arquivo=True) if LOCAL else api(Path(arquivo).read_text(encoding="utf-8"))


PARTIDA = """select
  to_regclass('"SE"."SIT_UNIDADE"') is not null and to_regclass('"SE"."SIT_RESERVA"') is not null
  and to_regclass('"SE"."SIT_BLOQUEIO"') is not null and to_regclass('"SE"."SIT_PROPRIEDADE"') is not null as site,
  to_regprocedure('"SE".auditar()') is not null as auditar,
  to_regclass('auth.users') is not null as auth,
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'SE' and c.relkind = 'r' and c.relname like 'VST\\_%')::int as vst"""

# retrato do site: colunas, restrições, funções e gatilhos das tabelas SIT_ + contagem de linhas. Tem de ser igual antes e depois.
RETRATO = """select md5(string_agg(x, '|' order by x)) as retrato from (
  select c.relname || ':' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') as x
    from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum where n.nspname = 'SE' and c.relkind = 'r' and c.relname like 'SIT\\_%'
  union all select 'K:' || conrelid::regclass::text || pg_get_constraintdef(oid) from pg_constraint where connamespace = '"SE"'::regnamespace and conrelid::regclass::text like '%SIT\\_%'
  union all select 'F:' || p.proname || md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = '"SE"'::regnamespace and p.proname !~ '^vst_' and p.prokind = 'f'
  union all select 'T:' || tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text like '%SIT\\_%'

) q"""
LINHAS = """select 'SIT_PROPRIEDADE' as t, count(*) as n from "SE"."SIT_PROPRIEDADE" union all select 'SIT_UNIDADE', count(*) from "SE"."SIT_UNIDADE"
  union all select 'SIT_RESERVA', count(*) from "SE"."SIT_RESERVA" union all select 'SIT_BLOQUEIO', count(*) from "SE"."SIT_BLOQUEIO"
  union all select 'SIT_HOSPEDE', count(*) from "SE"."SIT_HOSPEDE" union all select 'SIT_PAGAMENTO', count(*) from "SE"."SIT_PAGAMENTO" order by 1"""


def main():
    so_conferir = "--so-conferir" in sys.argv
    print(f"Projeto {REF}" if not LOCAL else "Banco local de teste")

    p = consultar(PARTIDA)[0]
    print("1. ponto de partida:", {k: p[k] for k in ("site", "auditar", "auth")}, "· tabelas VST_ já existentes:", p["vst"])
    if not (p["site"] and p["auditar"] and p["auth"]):
        falhar("faltam as tabelas SIT_, a função auditar() ou o Auth: aplique antes o schema.sql do site")

    if so_conferir and p["vst"] == 0:
        print("\nAINDA NÃO APLICADA: nenhuma tabela VST_ existe no schema SE.")
        sys.exit(1)
    if not so_conferir:
        antes = consultar(RETRATO)[0]["retrato"]
        linhas_antes = consultar(LINHAS)
        print("2. retrato do site guardado:", antes[:12] + "…")
        aplicar(BANCO / "migracao_vistorias.sql")
        print("3. migração aplicada (transação única)")
        depois = consultar(RETRATO)[0]["retrato"]
        if antes != depois or linhas_antes != consultar(LINHAS):
            falhar("tabelas, funções ou dados do site mudaram durante a migração: investigar antes de seguir")
        print("4. o site continua idêntico (colunas, restrições, funções, gatilhos e linhas)")

    resultado = consultar((BANCO / "verificar_aplicacao.sql").read_text(encoding="utf-8").rstrip().rstrip(";"))
    print("5. verificação:")
    ruins = 0
    for r in resultado:
        ok = r["ok"] is True
        ruins += not ok
        print(f"   {'ok  ' if ok else 'ERRO'} {r['item']}: {r['obtido']} (esperado {r['esperado']})")
    if ruins:
        falhar(f"{ruins} item(ns) da verificação não bateram")
    print("\nMIGRAÇÃO APLICADA E VERIFICADA" if not so_conferir else "\nJÁ ESTÁ APLICADA E VERIFICADA")


main()
