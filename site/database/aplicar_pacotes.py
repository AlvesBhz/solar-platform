"""Aplica migracao_pacotes.sql no Supabase e confere o resultado. NÃO roda os testes (eles criam dados de teste).

Uso (no ambiente que tem o token do Supabase; a chave é injetada pelo proxy ou vem de SUPABASE_ACCESS_TOKEN):
    python3 -I site/database/aplicar_pacotes.py                confere, aplica, prova que o site não mudou e verifica
    python3 -I site/database/aplicar_pacotes.py --so-conferir  só lê: diz se já está aplicada, sem alterar nada
Teste local (PostgreSQL comum, nunca produção):
    MODO=local PGDATABASE=banco_de_teste python3 -I site/database/aplicar_pacotes.py

Passos: 1) confere o ponto de partida (site, preços da gestão)  2) guarda um retrato do site (tirando calcular_estadia e consultar_precos, que esta migração reescreve) e o RESULTADO do cálculo de preço em 180 estadias
3) aplica a migração (uma transação, pode repetir)  4) compara o retrato e o resultado do cálculo: sem pacotes cadastrados, TODOS os preços têm de sair iguais
5) verifica permissões, gatilhos e a nova tabela. Sai com erro se qualquer passo falhar.
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
  to_regprocedure('"SE".prc_exigir_admin()') is not null as gestao,
  (select count(*) from pg_class where relnamespace = '"SE"'::regnamespace and relname = 'SIT_PACOTE')::int as pacote,
  (select count(*) from "SE"."SIT_RESERVA")::int as reservas"""

# retrato do site e das funções vst_: tem de ser igual antes e depois (os gatilhos *_AUTOR e as funções prc_ são o que esta migração acrescenta)
RETRATO = """select md5(string_agg(x, '|' order by x)) as retrato from (
  select c.relname || ':' || a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text || ':' || coalesce(pg_get_expr(d.adbin, d.adrelid), '') as x
    from pg_class c join pg_namespace n on n.oid = c.relnamespace join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum where n.nspname = 'SE' and c.relkind = 'r' and c.relname like 'SIT\\_%' and c.relname <> 'SIT_PACOTE'
  union all select 'K:' || conrelid::regclass::text || pg_get_constraintdef(oid) from pg_constraint where connamespace = '"SE"'::regnamespace and conrelid::regclass::text like '%SIT\\_%' and conrelid::regclass::text not like '%SIT_PACOTE%'
  union all select 'F:' || p.proname || md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = '"SE"'::regnamespace and p.proname !~ '^(vst|prc)_' and p.proname not in ('calcular_estadia', 'consultar_precos', 'consultar_pacotes') and p.prokind = 'f'
  union all select 'V:' || p.proname || md5(pg_get_functiondef(p.oid)) from pg_proc p where p.pronamespace = '"SE"'::regnamespace and p.proname ~ '^vst_' and p.prokind = 'f'
  union all select 'T:' || tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text like '%SIT\\_%' and tgrelid::regclass::text not like '%SIT_PACOTE%' and tgname !~ '_AUTOR$'
) q"""
LINHAS = """select 'SIT_PROPRIEDADE' as t, count(*) as n from "SE"."SIT_PROPRIEDADE" union all select 'SIT_UNIDADE', count(*) from "SE"."SIT_UNIDADE"
  union all select 'SIT_RESERVA', count(*) from "SE"."SIT_RESERVA" union all select 'SIT_BLOQUEIO', count(*) from "SE"."SIT_BLOQUEIO"
  union all select 'SIT_HOSPEDE', count(*) from "SE"."SIT_HOSPEDE" union all select 'SIT_PAGAMENTO', count(*) from "SE"."SIT_PAGAMENTO"
  union all select 'SIT_TARIFA', count(*) from "SE"."SIT_TARIFA" union all select 'SIT_AJUSTE_DIARIO', count(*) from "SE"."SIT_AJUSTE_DIARIO"
  union all select 'VST_USUARIO', count(*) from "SE"."VST_USUARIO" order by 1"""

# 300 estadias (datas x hóspedes x duração): o resultado completo do cálculo, antes e depois. Sem pacote cadastrado, tem de ser idêntico.
COMPORTAMENTO = """select md5(string_agg(x, '|' order by x)) as c, count(*)::int as n from (
  select d::text || ':' || a || ':' || k || ':' || n || ':' || coalesce((select string_agg(coalesce(c.motivo, 'ok') || ',' || c.vl_hospedagem || ',' || c.qtde_min_noites || ',' || c.ds_detalhe::text, ';')
         from "SE".calcular_estadia(1, d, d + n, a, k, 0, 0) c), '') as x
  from generate_series(date '2026-12-01', date '2028-01-20', interval '47 days') g(d0), lateral (select d0::date as d) q,
       generate_series(1, 2) a, generate_series(0, 1) k, generate_series(1, 5) n
) t"""

VERIFICACAO = """select 1 as n, 'tabela SIT_PACOTE criada' as item,
         (select count(*) from pg_class where relnamespace = '"SE"'::regnamespace and relname = 'SIT_PACOTE')::int as obtido, 1 as esperado
  union all select 2, 'SIT_PACOTE com RLS e sem direito para anon/authenticated',
         ((select count(*) from pg_class where relnamespace = '"SE"'::regnamespace and relname = 'SIT_PACOTE' and relrowsecurity)
          + (select count(*) from information_schema.role_table_grants where table_schema = 'SE' and table_name = 'SIT_PACOTE' and grantee in ('anon', 'authenticated', 'PUBLIC')))::int, 1
  union all select 3, 'consultar_pacotes executável pelo site (anon)',
         (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname = 'consultar_pacotes' and has_function_privilege('anon', oid, 'execute'))::int, 1
  union all select 4, 'prc_pacotes e prc_salvar_pacote só para o app logado (nunca anon)',
         (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname in ('prc_pacotes', 'prc_salvar_pacote') and has_function_privilege('authenticated', oid, 'execute') and not has_function_privilege('anon', oid, 'execute'))::int, 2
  union all select 5, 'consultar_precos e consultar_disponibilidade ainda executáveis por anon',
         (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname in ('consultar_precos', 'consultar_disponibilidade') and has_function_privilege('anon', oid, 'execute'))::int, 2
  union all select 6, 'gatilho de auditoria na tabela de pacotes',
         (select count(*) from pg_trigger where not tgisinternal and tgname = 'TG_SIT_PACOTE_AUDITORIA')::int, 1
  union all select 7, 'funções prc_ do app executáveis por anon',
         (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname like 'prc\\_%' and has_function_privilege('anon', oid, 'execute'))::int, 0
  order by 1"""


def main():
    so_conferir = "--so-conferir" in sys.argv
    print(f"Projeto {REF}" if not LOCAL else "Banco local de teste")
    p = consultar(PARTIDA)[0]
    print("1. ponto de partida:", {k: p[k] for k in ("precos", "calculo", "gestao")}, "· SIT_PACOTE existe:", bool(p["pacote"]), "· reservas:", p["reservas"])
    if not (p["precos"] and p["calculo"] and p["gestao"]):
        falhar("faltam as tabelas de preço, calcular_estadia() ou a migração da gestão de preços (migracao_precos_gestao.sql)")
    if so_conferir and not p["pacote"]:
        print("\nAINDA NÃO APLICADA: a tabela SIT_PACOTE não existe.")
        sys.exit(1)
    if not so_conferir:
        antes, linhas_antes, comp_antes = consultar(RETRATO)[0]["retrato"], consultar(LINHAS), consultar(COMPORTAMENTO)[0]
        print("2. retrato do site guardado:", antes[:12] + "…", "· cálculo de preço guardado em", comp_antes["n"], "estadias:", comp_antes["c"][:12] + "…")
        aplicar(AQUI / "migracao_pacotes.sql")
        print("3. migração aplicada (transação única)")
        if antes != consultar(RETRATO)[0]["retrato"] or linhas_antes != consultar(LINHAS):
            falhar("tabelas, funções (fora as duas reescritas) ou dados do site mudaram durante a migração: investigar antes de seguir")
        comp_depois = consultar(COMPORTAMENTO)[0]
        if comp_depois != comp_antes:
            falhar("o cálculo de preço MUDOU em estadias comuns (sem pacote): " + str(comp_antes) + " → " + str(comp_depois) + ". Reverter a migração antes de seguir")
        print("4. o site continua idêntico e o cálculo de preço deu o MESMO resultado nas", comp_depois["n"], "estadias (sem pacotes cadastrados)")
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
