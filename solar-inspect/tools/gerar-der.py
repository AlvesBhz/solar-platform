# Gera o DER das Vistorias (database/der.html) e o dicionário de dados (database/dicionario-de-dados.md).
# Mesmo modelo visual do DER das Reservas (site/database/gerar_der.py) e integrado ao banco do site:
# SIT_PROPRIEDADE, SIT_UNIDADE, SIT_RESERVA e SIT_BLOQUEIO são lidas de site/database/schema.sql (fonte única).
# Uso (a partir de solar-inspect): python3 -I tools/gerar-der.py
import ast
import html
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SITE_DIR = APP.parent / "site" / "database"
SITE_SQL = SITE_DIR / "schema.sql"
MIGRACAO_SQL = APP / "database" / "migracao_vistorias.sql"
VERSAO = "proposta v3, 20/11/2026"


def esc(s):
    return html.escape(str(s), quote=True)


# ---------------------------------------------------------------- leitura dos .sql (schema do site e migração das vistorias)
def ler_tabelas(caminho):
    """Lê os create table de um .sql (nomes com ou sem aspas) e devolve {tabela: [colunas]}."""
    sql = caminho.read_text(encoding="utf-8")
    out = {}
    for nome, corpo in re.findall(r'create table (?:if not exists )?"?(\w+)"? \((.*?)\n\);', sql, re.S):
        corpo = corpo.replace('"', "")
        cols, pk, fks, uqs = [], set(), set(), set()
        for m in re.finditer(r"constraint PK_\w+ primary key \(([^)]*)\)", corpo):
            pk |= {c.strip() for c in m.group(1).split(",")}
        for m in re.finditer(r"foreign key \(([^)]*)\) references", corpo):
            fks |= {c.strip() for c in m.group(1).split(",")}
        for m in re.finditer(r"constraint UQ_\w+ unique \(([^),]*)\)", corpo):
            uqs.add(m.group(1).strip())
        for ln in corpo.split("\n"):
            m = re.match(r"^  ([A-Z][A-Z0-9_]+)\s+(\w+(?:\(\d+(?:,\d+)?\))?(?:\[\])?)(.*)$", ln)
            if not m:
                continue
            n, ty, resto = m.groups()
            coment = resto.split("--", 1)[1].strip() if "--" in resto else ""
            cols.append(dict(n=n, ty=ty, req="not null" in resto or "generated" in resto,
                             auto="as identity" in resto, gen="generated always as (" in resto, coment=coment))
        for c in cols:
            c["pk"], c["fk"], c["uq"] = c["n"] in pk, c["n"] in fks, c["n"] in uqs
        out[nome] = cols
    return out


SITE = ler_tabelas(SITE_SQL)
MIGRACAO = ler_tabelas(MIGRACAO_SQL)


def ler_campos_site():
    arv = ast.parse((SITE_DIR / "gerar_der.py").read_text(encoding="utf-8"))
    for no in arv.body:
        if isinstance(no, ast.Assign) and any(getattr(t, "id", "") == "CAMPO" for t in no.targets):
            return ast.literal_eval(no.value)
    raise SystemExit("CAMPO não encontrado em site/database/gerar_der.py")


CAMPO_SITE = ler_campos_site()
EX_SITE = json.loads((SITE_DIR / "exemplos_der.json").read_text(encoding="utf-8"))
GRUPOS = {"site": "SITE · COMUM", "ace": "ACESSO", "cad": "CADASTRO", "ope": "OPERAÇÃO", "apo": "APOIO"}


def col(n, ty, req=True, desc="", pk=False, fk=False, uq=False, auto=False):
    return dict(n=n, ty=ty, req=req, desc=desc, pk=pk, fk=fk, uq=uq, auto=auto, gen=False, add=False, mais=False)


def comum(nome, mostrar, descricoes, acrescimos, rotulo_mais):
    """Tabela do site: o diagrama mostra os campos que a vistoria usa, resume o resto e acrescenta os campos propostos (+);
    o detalhe e os exemplos listam todos."""
    base = {c["n"]: c for c in SITE[nome]}

    def completo(n):
        c = base[n]
        return dict(n=n, ty=c["ty"], req=c["req"] or c["pk"], desc=descricoes.get(n) or CAMPO_SITE[nome][n], pk=c["pk"], fk=c["fk"],
                    uq=False, auto=c["auto"], gen=c["gen"], add=False, mais=False)

    cols = [completo(n) for n in mostrar]
    resto = [n for n in base if n not in mostrar]
    if resto:
        cols.append(dict(n=f"… mais {len(resto)} campos {rotulo_mais}", ty="", req=True, desc=", ".join(resto), pk=False,
                         fk=False, uq=False, auto=False, gen=False, add=False, mais=True))
    for c in acrescimos:
        c["add"] = True
        cols.append(c)
    todas = [completo(n) for n in base] + acrescimos
    return dict(grupo="site", cols=cols, todas=todas, nsite=len(base))


VALIDACAO = "QR, GPS ou QR_E_GPS"
T = {}
T["SIT_PROPRIEDADE"] = comum(
    "SIT_PROPRIEDADE", ["ID_PROPRIEDADE", "NM_PROPRIEDADE", "HR_CHECKIN", "HR_CHECKOUT"],
    {"ID_PROPRIEDADE": "Identificador da pousada.", "NM_PROPRIEDADE": "Nome da pousada.",
     "HR_CHECKIN": "Horário de entrada: base da agenda de vistorias de Entrada.",
     "HR_CHECKOUT": "Horário de saída: base da agenda de vistorias de Saída."},
    [], "da política de venda")
T["SIT_UNIDADE"] = comum(
    "SIT_UNIDADE", ["ID_UNIDADE", "ID_PROPRIEDADE", "CD_UNIDADE", "NM_UNIDADE", "TP_UNIDADE", "SG_ATIVO"],
    {"ID_UNIDADE": "Identificador do chalé, quarto ou suíte.", "ID_PROPRIEDADE": "Pousada dona da unidade.",
     "CD_UNIDADE": "Código curto (ex.: casa-do-mirante), também usado no site.", "NM_UNIDADE": "Nome exibido.",
     "TP_UNIDADE": "CHALE, QUARTO ou SUITE.", "SG_ATIVO": "Unidade inativa some da venda e da agenda de vistorias."},
    [], "da venda")
T["SIT_RESERVA"] = comum(
    "SIT_RESERVA", ["ID_RESERVA", "CD_RESERVA", "ID_UNIDADE", "DT_CHECKIN", "DT_CHECKOUT", "TP_STATUS"],
    {"ID_RESERVA": "Identificador da estadia vendida.", "CD_RESERVA": "Código mostrado ao hóspede (SE-XXXXXXXX).",
     "ID_UNIDADE": "Unidade reservada.", "DT_CHECKIN": "Dia da entrada: gera a vistoria de Entrada na agenda.",
     "DT_CHECKOUT": "Dia da saída: gera a vistoria de Saída na agenda.",
     "TP_STATUS": "Só reservas CONFIRMADA geram vistoria (PENDENTE é pré-reserva aguardando o Pix)."},
    [], "da venda")
T["SIT_BLOQUEIO"] = comum(
    "SIT_BLOQUEIO", ["ID_BLOQUEIO", "ID_UNIDADE", "DT_INI", "DT_FIM", "TP_MOTIVO", "DS_OBSERVACAO"],
    {"ID_BLOQUEIO": "Identificador do bloqueio.", "ID_UNIDADE": "Unidade fora da venda.",
     "DT_INI": "Primeira noite bloqueada.", "DT_FIM": "Dia seguinte à última noite; liberar a unidade encerra aqui.",
     "TP_MOTIVO": "A vistoria cria bloqueios MANUTENCAO (sem ID_CALENDARIO); CANAL_EXTERNO são estadias do Airbnb/Booking.",
     "DS_OBSERVACAO": "Resumo da ocorrência que motivou o bloqueio."},
    [], "do canal")

T["VST_USUARIO"] = dict(grupo="ace", cols=[
    col("ID_USUARIO", "uuid", pk=True, fk=True, desc="Mesmo id do login no Supabase Auth (auth.users.id)."),
    col("NM_USUARIO", "text", desc="Nome completo."),
    col("CD_LOGIN", "text", uq=True, desc="Usuário de acesso (ex.: ana.souza), minúsculo."),
    col("CD_CPF", "text", False, uq=True, desc="CPF só com números (dígitos conferidos); também serve para entrar."),
    col("TP_PERFIL", "text", desc="ASSESSOR (vistoria), LIMPEZA ou MANUTENCAO (campo), GESTOR ou ADMIN (gestão)."),
    col("SG_ATIVO", "boolean", desc="Inativo não entra no app (nem pelo login por CPF)."),
    col("DT_ACEITE_LGPD", "timestamptz", False, desc="Aceite do termo de uso de localização e fotos."),
    col("SG_TROCAR_SENHA", "boolean", desc="Senha provisória (criada ou redefinida pelo ADMIN): o app exige a troca antes de seguir."),
    col("DT_CRIACAO", "timestamptz", desc="Cadastro."),
    col("DT_ATUALIZACAO", "timestamptz", desc="Última alteração.")])
T["VST_USUARIO_PROPRIEDADE"] = dict(grupo="ace", cols=[
    col("ID_USUARIO", "uuid", pk=True, fk=True, desc="Usuário."),
    col("ID_PROPRIEDADE", "bigint", pk=True, fk=True, desc="Pousada que ele pode ver."),
    col("DT_CRIACAO", "timestamptz", desc="Quando o acesso foi dado.")])
T["VST_PROPRIEDADE"] = dict(grupo="cad", cols=[
    col("ID_PROPRIEDADE", "bigint", pk=True, fk=True, desc="A pousada (a mesma chave do site)."),
    col("TP_VALIDACAO", "text", desc=f"Como a presença do assessor é validada por padrão: {VALIDACAO}."),
    col("VL_LATITUDE", "numeric(9,6)", False, "Latitude da sede, centro do raio de presença."),
    col("VL_LONGITUDE", "numeric(9,6)", False, "Longitude da sede."),
    col("QTDE_RAIO_METROS", "smallint", desc="Raio aceito em volta do ponto (padrão 100 m)."),
    col("QTDE_PRECISAO_MAX_METROS", "smallint", desc="Pior precisão de GPS aceita (padrão 50 m)."),
    col("QTDE_MINUTOS_MIN_VISTORIA", "smallint", desc="Duração mínima esperada; abaixo disso a vistoria é sinalizada (padrão 10)."),
    col("DT_CRIACAO", "timestamptz", desc="Cadastro."),
    col("DT_ATUALIZACAO", "timestamptz", desc="Última alteração.")])
T["VST_UNIDADE"] = dict(grupo="cad", cols=[
    col("ID_UNIDADE", "bigint", pk=True, fk=True, desc="O chalé (a mesma chave do site)."),
    col("DS_ANDAR", "text", False, "Andar ou bloco, para o assessor se localizar."),
    col("TP_VALIDACAO", "text", False, f"Validação deste chalé ({VALIDACAO}); vazio herda da propriedade."),
    col("VL_LATITUDE", "numeric(9,6)", False, "Ponto do chalé; vazio usa o da propriedade."),
    col("VL_LONGITUDE", "numeric(9,6)", False, "Longitude do chalé."),
    col("QTDE_RAIO_METROS", "smallint", False, "Raio próprio; vazio usa o da propriedade."),
    col("TP_SITUACAO", "text", desc="EM_LIMPEZA, LIBERADO, OCUPADO, BLOQUEADO ou MANUTENCAO."),
    col("CD_HASH_QR", "text", uq=True, desc="Código impresso no QR da porta (o app só o recebe ao ler o QR)."),
    col("NO_VERSAO_QR", "smallint", desc="Versão do QR; rotacionar invalida as etiquetas antigas."),
    col("DT_CRIACAO", "timestamptz", desc="Cadastro."),
    col("DT_ATUALIZACAO", "timestamptz", desc="Última mudança de situação ou de QR.")])
T["VST_AMBIENTE"] = dict(grupo="cad", cols=[
    col("ID_AMBIENTE", "bigint", pk=True, auto=True, desc="Sequencial."),
    col("ID_UNIDADE", "bigint", fk=True, desc="Unidade do cômodo."),
    col("NM_AMBIENTE", "text", desc="Sala, Quarto, Banheiro, Varanda…"),
    col("NO_ORDEM", "smallint", desc="Ordem de passagem no checklist."),
    col("DS_FOTO_REFERENCIA", "text", False, desc="Caminho da foto de como deve ficar."),
    col("SG_ATIVO", "boolean", desc="Inativo sai do checklist."),
    col("DT_CRIACAO", "timestamptz", desc="Cadastro.")])
T["VST_ITEM"] = dict(grupo="cad", cols=[
    col("ID_ITEM", "bigint", pk=True, auto=True, desc="Sequencial."),
    col("ID_AMBIENTE", "bigint", fk=True, desc="Cômodo onde o item é conferido."),
    col("NM_ITEM", "text", desc="Ex.: Toalhas de banho, Frigobar."),
    col("DS_ORIENTACAO", "text", False, desc="Como conferir."),
    col("SG_CRITICO", "boolean", desc="Problema em item crítico abre ocorrência CRITICA e tira o chalé da venda."),
    col("SG_FOTO_OBRIGATORIA", "boolean", desc="Exige foto mesmo quando está OK."),
    col("QTDE_ESPERADA", "smallint", False, desc="Quantidade que deve haver (contagem)."),
    col("NO_ORDEM", "smallint", desc="Ordem dentro do cômodo."),
    col("SG_ATIVO", "boolean", desc="Inativo sai do checklist."),
    col("DT_CRIACAO", "timestamptz", desc="Cadastro.")])
T["VST_TIPO_VISTORIA"] = dict(grupo="apo", cols=[
    col("ID_TIPO_VISTORIA", "bigint", pk=True, auto=True, desc="Sequencial."),
    col("CD_TIPO_VISTORIA", "text", uq=True, desc="Código que o site usa: ENTRADA e SAIDA já vêm cadastrados."),
    col("NM_TIPO_VISTORIA", "text", uq=True, desc="Entrada, Saída, Rotina, Manutenção…"),
    col("TP_COMPORTAMENTO", "text", desc="ENTRADA, SAIDA, ROTINA ou MANUTENCAO: regra que o app aplica."),
    col("TP_PERIODICIDADE", "text", False, desc="DIARIA, SEMANAL ou MENSAL (só rotina)."),
    col("SG_EXIGE_ENTRADA", "boolean", desc="Saída compara com a Entrada da mesma estadia."),
    col("SG_EXIGE_ASSINATURA", "boolean", desc="Pede assinatura no fim."),
    col("SG_ATIVO", "boolean", desc="Inativo some da lista."),
    col("DS_PERFIS", "text[]", desc="Quem da equipe de campo faz este tipo (ASSESSOR, LIMPEZA, MANUTENCAO); gestor e admin fazem todos."),
    col("DT_CRIACAO", "timestamptz", desc="Cadastro.")])
T["VST_TIPO_VISTORIA_ITEM"] = dict(grupo="apo", cols=[
    col("ID_TIPO_VISTORIA", "bigint", pk=True, fk=True, desc="Tipo de vistoria."),
    col("ID_ITEM", "bigint", pk=True, fk=True, desc="Item que entra nesse tipo."),
    col("NO_ORDEM", "smallint", False, desc="Ordem própria do tipo; vazio segue a do item.")])
T["VST_VISTORIA"] = dict(grupo="ope", cols=[
    col("ID_VISTORIA", "uuid", pk=True, desc="uuid gerado pelo banco ou pelo celular (v7): reenviar não duplica."),
    col("ID_VISTORIA_ENTRADA", "uuid", False, fk=True, desc="Na Saída, a Entrada da mesma estadia (comparação)."),
    col("ID_USUARIO", "uuid", False, fk=True, desc="Responsável; vazio até alguém assumir (a vistoria nasce sem responsável)."),
    col("ID_UNIDADE", "bigint", fk=True, desc="Unidade vistoriada."),
    col("ID_TIPO_VISTORIA", "bigint", fk=True, desc="Tipo aplicado."),
    col("ID_RESERVA", "bigint", False, fk=True, desc="Estadia do site; vazio em vistoria avulsa e em estadias de canal."),
    col("DT_AGENDADA", "date", desc="Dia previsto: DT_CHECKIN na Entrada, DT_CHECKOUT na Saída."),
    col("TP_STATUS", "text", desc="AGENDADA, EM_ANDAMENTO, CONCLUIDA ou CANCELADA."),
    col("DT_INICIO", "timestamptz", False, desc="Início no celular."),
    col("DT_FIM", "timestamptz", False, desc="Fim no celular."),
    col("TP_VALIDACAO", "text", False, desc=f"Validação exigida no início: {VALIDACAO}."),
    col("DT_RECEBIMENTO", "timestamptz", False, desc="Chegada ao servidor (pode ser bem depois, se offline)."),
    col("VL_LATITUDE", "numeric(9,6)", False, desc="Posição no início."),
    col("VL_LONGITUDE", "numeric(9,6)", False, desc="Posição no início."),
    col("QTDE_PRECISAO_METROS", "smallint", False, desc="Precisão do GPS."),
    col("QTDE_DISTANCIA_METROS", "integer", False, desc="Distância até o ponto do chalé."),
    col("SG_FORA_RAIO", "boolean", desc="Começou fora do raio aceito."),
    col("DS_SINALIZACOES", "text[]", False, desc="Motivos: FORA_RAIO, GPS_IMPRECISO, SEM_GPS, RAPIDA, SEM_ENTRADA…"),
    col("DS_ASSINATURA", "text", False, desc="Caminho da assinatura."),
    col("TP_SITUACAO_RESULTANTE", "text", False, desc="Situação em que o chalé ficou (LIBERADO, MANUTENCAO…)."),
    col("DS_OBSERVACAO", "text", False, desc="Observação geral."),
    col("DT_CRIACAO", "timestamptz", desc="Quando foi agendada."),
    col("DT_ATUALIZACAO", "timestamptz", desc="Última mudança.")])
T["VST_RESPOSTA"] = dict(grupo="ope", cols=[
    col("ID_VISTORIA", "uuid", pk=True, fk=True, desc="Vistoria."),
    col("ID_ITEM", "bigint", pk=True, fk=True, desc="Item conferido."),
    col("TP_RESPOSTA", "text", desc="OK, PROBLEMA ou NAO_SE_APLICA."),
    col("QTDE_ENCONTRADA", "smallint", False, desc="Contagem, quando o item tem quantidade."),
    col("DS_OBSERVACAO", "text", False, desc="Obrigatória quando PROBLEMA."),
    col("DT_RESPOSTA", "timestamptz", desc="Momento no celular.")])
T["VST_OCORRENCIA"] = dict(grupo="ope", cols=[
    col("ID_OCORRENCIA", "bigint", pk=True, auto=True, desc="Sequencial."),
    col("ID_VISTORIA", "uuid", fk=True, desc="Vistoria de origem."),
    col("ID_ITEM", "bigint", fk=True, desc="Item com problema."),
    col("ID_UNIDADE", "bigint", fk=True, desc="Copiado da vistoria: filtra o painel por unidade."),
    col("ID_BLOQUEIO", "bigint", False, fk=True, desc="Bloqueio MANUTENCAO criado no site, quando houver."),
    col("TP_GRAVIDADE", "text", desc="BAIXA, MEDIA ou CRITICA."),
    col("TP_STATUS", "text", desc="ABERTA, EM_TRATAMENTO, RESOLVIDA ou CANCELADA."),
    col("DS_OCORRENCIA", "text", desc="O que foi encontrado."),
    col("DS_TRATAMENTO", "text", False, desc="O que a gestão fez."),
    col("DT_ABERTURA", "timestamptz", desc="Abertura."),
    col("DT_RESOLUCAO", "timestamptz", False, desc="Exigida quando RESOLVIDA.")])
T["VST_FOTO"] = dict(grupo="ope", cols=[
    col("ID_FOTO", "uuid", pk=True, desc="uuid gerado pelo banco ou pelo celular."),
    col("ID_VISTORIA", "uuid", fk=True, desc="Vistoria (com ID_ITEM, aponta a resposta)."),
    col("ID_ITEM", "bigint", fk=True, desc="Item fotografado."),
    col("CD_ARQUIVO", "text", uq=True, desc="Objeto no bucket privado vistorias: <ID_VISTORIA>/<arquivo> (JPEG, PNG ou WEBP)."),
    col("VL_LATITUDE", "numeric(9,6)", False, desc="Onde foi tirada."),
    col("VL_LONGITUDE", "numeric(9,6)", False, desc="Onde foi tirada."),
    col("QTDE_PRECISAO_METROS", "smallint", False, desc="Precisão do GPS."),
    col("SG_FORA_RAIO", "boolean", desc="Tirada fora do raio."),
    col("DT_CAPTURA", "timestamptz", desc="Momento da câmera, não do envio.")])

# o DER tem de bater com a migração que vai para o Supabase: mesmas colunas, ordem, tipos, obrigatoriedade e chaves
for _n, _t in T.items():
    if _t["grupo"] == "site":
        continue
    _m = MIGRACAO[_n]
    _a = [(c["n"], c["ty"], c["req"] or c["pk"], c["pk"], c["fk"], c["uq"]) for c in _t["cols"]]
    _b = [(c["n"], c["ty"], c["req"] or c["pk"], c["pk"], c["fk"], c["uq"]) for c in _m]
    assert _a == _b, (_n, [x for x in zip(_a, _b) if x[0] != x[1]][:3], len(_a), len(_b))
assert {n for n in MIGRACAO} == {n for n in T if n.startswith("VST_")}, set(MIGRACAO) ^ set(T)

for _t in T.values():
    _t.setdefault("todas", _t["cols"])

# ---------------------------------------------------------------- geometria
W, HDR, RH = 310, 40, 19
X = [56, 496, 936, 1376, 1816]
FUNDO1, FUNDO2 = 1050, 1073
LARG, ALT = X[4] + W + 68, FUNDO2 + 24
POS = {
    "VST_USUARIO": (X[0], 40), "VST_USUARIO_PROPRIEDADE": (X[0], 300),
    "SIT_PROPRIEDADE": (X[1], 40), "VST_PROPRIEDADE": (X[1], 225), "SIT_BLOQUEIO": (X[1], 490), "VST_UNIDADE": (X[1], 720),
    "SIT_RESERVA": (X[2], 40), "SIT_UNIDADE": (X[2], 262), "VST_AMBIENTE": (X[2], 520), "VST_ITEM": (X[2], 740),
    "VST_VISTORIA": (X[3], 40), "VST_RESPOSTA": (X[3], 570), "VST_OCORRENCIA": (X[3], 775),
    "VST_TIPO_VISTORIA": (X[4], 116), "VST_TIPO_VISTORIA_ITEM": (X[4], 380), "VST_FOTO": (X[4], 551),
}
assert set(POS) == set(T)


def ry(t, c):
    return POS[t][1] + HDR + [x["n"] for x in T[t]["cols"]].index(c) * RH + RH / 2


def borda(t, lado):
    return POS[t][0] + (W if lado == "d" else 0)


def lig(filho, f, pai, pk, lane, sf="d", sp="e"):
    """filho.f sai pelo lado sf ('e'/'d'), corre na pista x=lane e entra no pai pelo lado sp."""
    a, b = borda(filho, sf), borda(pai, sp)
    y1, y2 = ry(filho, f), ry(pai, pk)
    return [(a, y1), (lane, y1), (lane, y2), (b, y2)] if y1 != y2 else [(a, y1), (b, y2)]


c01, c12, c23, c34, c4 = (x + W for x in X)
P, U, R, B = "SIT_PROPRIEDADE", "SIT_UNIDADE", "SIT_RESERVA", "SIT_BLOQUEIO"
V, VR, VO, VF, VT, VI, VA = "VST_VISTORIA", "VST_RESPOSTA", "VST_OCORRENCIA", "VST_FOTO", "VST_TIPO_VISTORIA", "VST_ITEM", "VST_AMBIENTE"
VU, VUP, VTI, VP, VUN = "VST_USUARIO", "VST_USUARIO_PROPRIEDADE", "VST_TIPO_VISTORIA_ITEM", "VST_PROPRIEDADE", "VST_UNIDADE"
E = [  # filho, campo, pai, chave, rótulo, pontos (porta do filho primeiro)
    (U, "ID_PROPRIEDADE", P, "ID_PROPRIEDADE", "pertence a", lig(U, "ID_PROPRIEDADE", P, "ID_PROPRIEDADE", c12 + 74, "e", "d")),
    (R, "ID_UNIDADE", U, "ID_UNIDADE", "reserva", lig(R, "ID_UNIDADE", U, "ID_UNIDADE", c23 + 24, "d", "d")),
    (B, "ID_UNIDADE", U, "ID_UNIDADE", "bloqueia", lig(B, "ID_UNIDADE", U, "ID_UNIDADE", c12 + 54, "d", "e")),
    (VO, "ID_BLOQUEIO", B, "ID_BLOQUEIO", "tira da venda",
     [(X[3], ry(VO, "ID_BLOQUEIO")), (c23 + 12, ry(VO, "ID_BLOQUEIO")), (c23 + 12, FUNDO2),
      (c01 + 100, FUNDO2), (c01 + 100, ry(B, "ID_BLOQUEIO")), (X[1], ry(B, "ID_BLOQUEIO"))]),
    (VUP, "ID_USUARIO", VU, "ID_USUARIO", "acessa", lig(VUP, "ID_USUARIO", VU, "ID_USUARIO", X[0] - 26, "e", "e")),
    (VUP, "ID_PROPRIEDADE", P, "ID_PROPRIEDADE", "acesso a", lig(VUP, "ID_PROPRIEDADE", P, "ID_PROPRIEDADE", c01 + 74)),
    (VP, "ID_PROPRIEDADE", P, "ID_PROPRIEDADE", "complementa", lig(VP, "ID_PROPRIEDADE", P, "ID_PROPRIEDADE", X[1] - 10, "e", "e")),
    (VUN, "ID_UNIDADE", U, "ID_UNIDADE", "complementa", lig(VUN, "ID_UNIDADE", U, "ID_UNIDADE", c12 + 34, "d", "e")),
    (VA, "ID_UNIDADE", U, "ID_UNIDADE", "cômodo de", lig(VA, "ID_UNIDADE", U, "ID_UNIDADE", c23 + 36, "d", "d")),
    (VI, "ID_AMBIENTE", VA, "ID_AMBIENTE", "conferido em", lig(VI, "ID_AMBIENTE", VA, "ID_AMBIENTE", X[2] - 30, "e", "e")),
    (VTI, "ID_TIPO_VISTORIA", VT, "ID_TIPO_VISTORIA", "compõe", lig(VTI, "ID_TIPO_VISTORIA", VT, "ID_TIPO_VISTORIA", c4 + 22, "d", "d")),
    (VTI, "ID_ITEM", VI, "ID_ITEM", "inclui",
     [(c4, ry(VTI, "ID_ITEM")), (c4 + 40, ry(VTI, "ID_ITEM")), (c4 + 40, FUNDO1),
      (c23 + 108, FUNDO1), (c23 + 108, ry(VI, "ID_ITEM")), (c23, ry(VI, "ID_ITEM"))]),
    (V, "ID_UNIDADE", U, "ID_UNIDADE", "vistoria de", lig(V, "ID_UNIDADE", U, "ID_UNIDADE", c23 + 72, "e", "d")),
    (V, "ID_TIPO_VISTORIA", VT, "ID_TIPO_VISTORIA", "do tipo", lig(V, "ID_TIPO_VISTORIA", VT, "ID_TIPO_VISTORIA", 0)),
    (V, "ID_USUARIO", VU, "ID_USUARIO", "feita por",
     [(X[3], ry(V, "ID_USUARIO")), (c23 + 104, ry(V, "ID_USUARIO")), (c23 + 104, 16),
      (c01 + 34, 16), (c01 + 34, ry(VU, "ID_USUARIO")), (c01, ry(VU, "ID_USUARIO"))]),
    (V, "ID_VISTORIA_ENTRADA", V, "ID_VISTORIA", "entrada de", lig(V, "ID_VISTORIA_ENTRADA", V, "ID_VISTORIA", c34 + 26, "d", "d")),
    (V, "ID_RESERVA", R, "ID_RESERVA", "da estadia", lig(V, "ID_RESERVA", R, "ID_RESERVA", c23 + 48, "e", "d")),
    (VR, "ID_VISTORIA", V, "ID_VISTORIA", "responde", lig(VR, "ID_VISTORIA", V, "ID_VISTORIA", c34 + 96, "d", "d")),
    (VR, "ID_ITEM", VI, "ID_ITEM", "sobre", lig(VR, "ID_ITEM", VI, "ID_ITEM", c23 + 96, "e", "d")),
    (VF, "ID_ITEM", VR, "ID_ITEM", "evidência de", lig(VF, "ID_ITEM", VR, "ID_ITEM", 0, "e", "d")),
    (VO, "ID_ITEM", VR, "ID_ITEM", "nasce de", lig(VO, "ID_ITEM", VR, "ID_ITEM", c34 + 44, "d", "d")),
    (VO, "ID_UNIDADE", U, "ID_UNIDADE", "na unidade", lig(VO, "ID_UNIDADE", U, "ID_UNIDADE", c23 + 84, "e", "d")),
]
# FKs compostas: a outra coluna segue na mesma linha desenhada; ID_USUARIO de VST_USUARIO referencia auth.users (fora do diagrama)
COMPOSTAS = {(VF, "ID_VISTORIA"), (VO, "ID_VISTORIA")}
FORA_DO_DIAGRAMA = {(VU, "ID_USUARIO")}
UM_PARA_UM = {(VP, "ID_PROPRIEDADE"), (VUN, "ID_UNIDADE")}      # a chave da filha é a própria FK: zero ou um por pai
marcadas = {(t, c["n"]) for t, d in T.items() for c in d["cols"] if c["fk"]}
assert marcadas == {(e[0], e[1]) for e in E} | COMPOSTAS | FORA_DO_DIAGRAMA, marcadas ^ ({(e[0], e[1]) for e in E} | COMPOSTAS | FORA_DO_DIAGRAMA)
for e in E:
    assert any(c["n"] == e[3] and c["pk"] for c in T[e[2]]["cols"]), e
ROTULO_LIVRE = {(V, "ID_VISTORIA_ENTRADA"): (c34 + 32, ry(V, "ID_VISTORIA_ENTRADA") - 6)}
NOMES_FK = {(V, "ID_VISTORIA_ENTRADA"): "FK_VST_VISTORIA_VST_VISTORIA_ENTRADA"}


def obrig(t, c):
    return next(x for x in T[t]["cols"] if x["n"] == c)["req"]


# ---------------------------------------------------------------- SVG
def marcas(x, y, ux, uy, tipo):
    """Cardinalidade na porta (x,y); (ux,uy) aponta da tabela para fora, ao longo da linha."""
    px, py = -uy, ux

    def p(d, o=0):
        return round(x + ux * d + px * o, 1), round(y + uy * d + py * o, 1)

    if tipo == "muitos":
        a, b, c, d = p(12), p(0, -6), p(0, 6), p(18)
        return f'<path d="M{a[0]},{a[1]} L{b[0]},{b[1]} M{a[0]},{a[1]} L{c[0]},{c[1]}"/><circle cx="{d[0]}" cy="{d[1]}" r="3.5" class="hollow"/>'
    if tipo == "um":
        return "".join(f'<path d="M{p(d, -6)[0]},{p(d, -6)[1]} L{p(d, 6)[0]},{p(d, 6)[1]}"/>' for d in (7, 12))
    a, b, c = p(7, -6), p(7, 6), p(15)
    return f'<path d="M{a[0]},{a[1]} L{b[0]},{b[1]}"/><circle cx="{c[0]}" cy="{c[1]}" r="3.5" class="hollow"/>'


def unit(a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = (dx * dx + dy * dy) ** 0.5
    return dx / n, dy / n


def caminho(i, pts):
    """Linha ortogonal com 'pontes' onde um trecho horizontal cruza a vertical de outra ligação."""
    vs = [(a[0], min(a[1], b[1]), max(a[1], b[1])) for j, e in enumerate(E) if j != i
          for a, b in zip(e[5], e[5][1:]) if a[0] == b[0]]
    d = f"M{pts[0][0]},{pts[0][1]}"
    for a, b in zip(pts, pts[1:]):
        if a[1] == b[1]:
            sx = 1 if b[0] > a[0] else -1
            xs = sorted({vx for vx, y0, y1 in vs if y0 < a[1] < y1 and min(a[0], b[0]) + 6 < vx < max(a[0], b[0]) - 6},
                        key=lambda v: v * sx)
            for vx in xs:
                d += f" L{vx - 5 * sx},{a[1]} Q{vx},{a[1] - 8} {vx + 5 * sx},{a[1]}"
        d += f" L{b[0]},{b[1]}"
    return d


def svg():
    s = [f'<svg id="der" viewBox="0 0 {LARG} {ALT}" role="img" aria-label="Diagrama entidade-relacionamento das vistorias integrado ao banco do site: SIT_PROPRIEDADE, SIT_UNIDADE, SIT_RESERVA e SIT_BLOQUEIO são do site; a VST_VISTORIA liga unidade, tipo, assessor e reserva; respostas, fotos e ocorrências saem dela.">']
    s.append('<g class="edges">')
    for i, (f, c, p, pk, rot, pts) in enumerate(E):
        s.append(f'<g class="edge" data-rel="{f} {p}"><title>{NOMES_FK.get((f, c), f"FK_{f}_{p}")}: {f}.{c} → {p}.{pk}</title>')
        s.append(f'<path class="wire" d="{caminho(i, pts)}"/>')
        s.append('<g class="card">' + marcas(*pts[0], *unit(pts[0], pts[1]), "zeroum" if (f, c) in UM_PARA_UM else "muitos") +
                 marcas(*pts[-1], *unit(pts[-1], pts[-2]), "um" if obrig(f, c) else "zeroum") + "</g>")
        a, b = max(zip(pts, pts[1:]), key=lambda g: abs(g[0][0] - g[1][0]) + abs(g[0][1] - g[1][1]))
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        if (f, c) in ROTULO_LIVRE:  # trecho curto: rótulo deitado ao lado da linha
            mx, my = ROTULO_LIVRE[(f, c)]
            s.append(f'<text class="elabel" x="{mx}" y="{my}">{esc(rot)}</text></g>')
            continue
        rot_v = f' transform="rotate(-90 {mx} {my})" dy="-5"' if a[0] == b[0] else ' dy="-6"'
        s.append(f'<text class="elabel" x="{mx}" y="{my}"{rot_v} text-anchor="middle">{esc(rot)}</text></g>')
    s.append("</g>")
    for n, (x, y) in POS.items():
        t, g = T[n], T[n]["grupo"]
        h = HDR + len(t["cols"]) * RH
        s.append(f'<g class="tbl g-{g}" data-t="{n}" tabindex="0" role="button" aria-label="Tabela {n}">')
        s.append(f'<rect class="box" x="{x}" y="{y}" width="{W}" height="{h}" rx="6"/>')
        s.append(f'<path class="head" d="M{x},{y + HDR} V{y + 6} Q{x},{y} {x + 6},{y} H{x + W - 6} Q{x + W},{y} {x + W},{y + 6} V{y + HDR} Z"/>')
        s.append(f'<text class="tname" x="{x + 12}" y="{y + 25}">{n}</text>')
        s.append(f'<text class="tgroup" x="{x + W - 12}" y="{y + 25}" text-anchor="end">{GRUPOS[g]}</text>')
        for i, c in enumerate(t["cols"]):
            yy = y + HDR + i * RH
            if i % 2 == 1:
                s.append(f'<rect class="zebra" x="{x + 1}" y="{yy}" width="{W - 2}" height="{RH}"/>')
            if c["mais"]:
                s.append(f'<text class="mais" x="{x + 44}" y="{yy + 13.5}">{esc(c["n"])}</text>')
                continue
            keys = [k for k, on in (('<tspan class="kpk">PK</tspan>', c["pk"]), ('<tspan class="kfk">FK</tspan>', c["fk"])) if on]
            if c["add"] and not keys:
                keys = ['<tspan class="kadd">+</tspan>']
            if keys:
                s.append(f'<text class="key" x="{x + 10}" y="{yy + 13.5}">{" ".join(keys)}</text>')
            cls = "cname" + ("" if c["req"] else " opt") + (" add" if c["add"] else "")
            s.append(f'<text class="{cls}" x="{x + 44}" y="{yy + 13.5}">{c["n"]}{"" if c["req"] else "?"}</text>')
            tag = " · gerado" if c["gen"] else (" · auto" if c["auto"] else "")
            s.append(f'<text class="ctype" x="{x + W - 10}" y="{yy + 13.5}" text-anchor="end">{c["ty"]}{tag}</text>')
        s.append("</g>")
    s.append("</svg>")
    return "\n".join(s)


# ---------------------------------------------------------------- textos
PROPOSITO = {
    "SIT_PROPRIEDADE": "Tabela do site, só leitura para a vistoria. A pousada: os horários de check-in e check-out montam a agenda. As regras de presença (GPS, raio) ficam em VST_PROPRIEDADE.",
    "SIT_UNIDADE": "Tabela do site, só leitura para a vistoria. O chalé é o elo entre os dois produtos: vendido pelo site e vistoriado pelo app. Situação, QR e ponto de GPS ficam em VST_UNIDADE.",
    "SIT_RESERVA": "Tabela do site, só leitura para a vistoria. Reservas CONFIRMADA viram a agenda de Entrada (check-in) e Saída (check-out).",
    "SIT_BLOQUEIO": "Tabela do site. Uma ocorrência crítica cria aqui um bloqueio MANUTENCAO, que tira as datas da venda no site e nos canais (iCal). Só funções do banco escrevem aqui.",
    "VST_USUARIO": "Os funcionários que usam o app: vistoria (assessor), limpeza, manutenção, gestão e administração. O ADMIN cadastra pelo app; entram por usuário ou CPF e senha. O cadastro aberto do Auth está desligado.",
    "VST_USUARIO_PROPRIEDADE": "Quais pousadas cada usuário vê. É a base das regras de acesso (RLS) de todas as tabelas VST_.",
    "VST_PROPRIEDADE": "Regras de presença da pousada: como o assessor prova que está no local, o raio aceito e o tempo mínimo de uma vistoria. Uma linha por SIT_PROPRIEDADE (1 para 1).",
    "VST_UNIDADE": "Dados do chalé que só a vistoria usa: situação operacional, QR da porta, ponto de GPS e andar. Uma linha por SIT_UNIDADE (1 para 1).",
    "VST_AMBIENTE": "Cômodos de cada unidade, na ordem em que o assessor percorre.",
    "VST_ITEM": "O que se confere em cada cômodo: crítico, foto obrigatória e quantidade esperada.",
    "VST_TIPO_VISTORIA": "Entrada, Saída, Rotina e Manutenção, com as regras de cada uma e quem da equipe pode fazê-las. O site identifica o tipo pelo código (ENTRADA, SAIDA).",
    "VST_TIPO_VISTORIA_ITEM": "Quais itens entram em cada tipo de vistoria (o checklist de cada tipo).",
    "VST_VISTORIA": "Uma vistoria, da agenda à conclusão: nasce AGENDADA (o site cria a Entrada e a Saída da reserva), o assessor assume, inicia e conclui pelo celular.",
    "VST_RESPOSTA": "A resposta de cada item: OK, PROBLEMA ou não se aplica.",
    "VST_OCORRENCIA": "Problema encontrado que precisa de tratamento; se o item é crítico, tira o chalé da venda.",
    "VST_FOTO": "Evidência de uma resposta: guarda o caminho do arquivo no Storage, com local e horário da câmera.",
}
REGRAS = {
    "SIT_PROPRIEDADE": ["A vistoria só lê: horários de check-in e check-out e o fuso.", "Nenhuma coluna foi acrescentada pela vistoria."],
    "SIT_UNIDADE": ["A vistoria só lê o cadastro; TP_UNIDADE e SG_ATIVO valem para os dois produtos.", "Nenhuma coluna foi acrescentada pela vistoria: situação, QR e GPS estão em VST_UNIDADE."],
    "SIT_RESERVA": ["A vistoria só lê: código, datas, unidade e status.", "Só CONFIRMADA gera vistoria; PENDENTE (pré-reserva de 30 minutos) não gera.",
                    "Remarcada: a reserva nova aponta a antiga em ID_RESERVA_ORIGINAL e leva as vistorias AGENDADAS.",
                    "O app nunca lê CPF, passaporte ou telefone: só código e datas, por função."],
    "SIT_BLOQUEIO": ["Ocorrência crítica cria bloqueio MANUTENCAO a partir de hoje, com prazo provisório de 7 dias (DT_FIM precisa ser depois de DT_INI).",
                     "Liberar a unidade encerra o bloqueio (DT_FIM = amanhã).",
                     "Reserva confirmada que já existe não é cancelada: o painel avisa o conflito.",
                     "Só funções security definer escrevem aqui; o vínculo com a ocorrência fica em VST_OCORRENCIA.ID_BLOQUEIO."],
    "VST_USUARIO": ["ID_USUARIO = auth.users.id (login do Supabase Auth).", "CD_LOGIN minúsculo e único; CD_CPF único, com 11 números e dígitos válidos.",
                    "TP_PERFIL: ASSESSOR (vistoria), LIMPEZA, MANUTENCAO, GESTOR ou ADMIN; os três primeiros são equipe de campo, com as mesmas permissões.", "Usuário começa por letra (nunca parece CPF); CPF é opcional e entra no login.", "Inativo não entra (checado no login e em todas as funções e regras de acesso)."],
    "VST_USUARIO_PROPRIEDADE": ["Chave composta: um acesso por usuário e pousada.", "ADMIN vê todas as pousadas; os demais só as listadas aqui."],
    "VST_PROPRIEDADE": ["TP_VALIDACAO: QR, GPS ou QR_E_GPS.", "Raio entre 10 e 1.000 m; precisão máxima entre 5 e 500 m; tempo mínimo entre 0 e 240 minutos.",
                        "Latitude e longitude vêm juntas ou ficam vazias juntas.", "Sem coordenadas, o GPS não é conferido (a vistoria registra GPS_NAO_CONFIGURADO)."],
    "VST_UNIDADE": ["Valores vazios herdam os da propriedade (validação, ponto, raio).", "TP_SITUACAO: EM_LIMPEZA, LIBERADO, OCUPADO, BLOQUEADO ou MANUTENCAO.",
                    "Pela vistoria: Entrada concluída → OCUPADO; Saída concluída → EM_LIMPEZA (a equipe libera depois da limpeza); item crítico com problema → MANUTENCAO. O padrão nunca tira o chalé de MANUTENCAO ou BLOQUEADO.",
                    "Só muda pelas funções vst_alterar_situacao_unidade, vst_concluir_vistoria e vst_resolver_ocorrencia.",
                    "CD_HASH_QR único e invisível ao app; rotacionar soma 1 em NO_VERSAO_QR."],
    "VST_AMBIENTE": ["Nome único por unidade.", "NO_ORDEM define a ordem do checklist."],
    "VST_ITEM": ["Nome único por cômodo.", "QTDE_ESPERADA ≥ 0 quando informada."],
    "VST_TIPO_VISTORIA": ["CD_TIPO_VISTORIA único (ENTRADA e SAIDA vêm da migração; outros tipos podem existir).", "TP_COMPORTAMENTO: ENTRADA, SAIDA, ROTINA ou MANUTENCAO.",
                          "TP_PERIODICIDADE só para ROTINA: DIARIA, SEMANAL ou MENSAL.",
                          "DS_PERFIS: quem da equipe de campo faz o tipo. Padrão: Entrada só ASSESSOR; Saída ASSESSOR e LIMPEZA; Rotina os três; Manutenção ASSESSOR e MANUTENCAO. O ADMIN muda por tipo; gestor e admin fazem todos."],
    "VST_TIPO_VISTORIA_ITEM": ["Chave composta: o item entra uma vez em cada tipo."],
    "VST_VISTORIA": ["TP_STATUS: AGENDADA, EM_ANDAMENTO, CONCLUIDA ou CANCELADA.", "No máximo uma vistoria de cada tipo por reserva (UQ_VST_VISTORIA_RESERVA_TIPO); vistoria avulsa não tem reserva.",
                     "A reserva e a Entrada têm de ser do mesmo chalé da vistoria.", "EM_ANDAMENTO e CONCLUIDA exigem responsável e início; CONCLUIDA exige fim.",
                     "O site cria (AGENDADA), remarca e cancela; o app inicia e conclui por função."],
    "VST_RESPOSTA": ["Chave composta: uma resposta por item na vistoria.", "TP_RESPOSTA: OK, PROBLEMA ou NAO_SE_APLICA.", "PROBLEMA exige DS_OBSERVACAO."],
    "VST_OCORRENCIA": ["Nasce de uma resposta PROBLEMA (FK composta ID_VISTORIA + ID_ITEM); uma por resposta.", "TP_GRAVIDADE: BAIXA, MEDIA ou CRITICA; item crítico abre CRITICA.",
                       "TP_STATUS: ABERTA, EM_TRATAMENTO, RESOLVIDA ou CANCELADA; RESOLVIDA exige DT_RESOLUCAO.",
                       "ID_BLOQUEIO preenchido quando o chalé sai da venda (se o bloqueio for apagado no site, o campo volta a ficar vazio)."],
    "VST_FOTO": ["Aponta a resposta pela FK composta (ID_VISTORIA + ID_ITEM).", "CD_ARQUIVO começa pelo ID_VISTORIA e termina em .jpg, .png ou .webp; único.",
                 "Bucket privado vistorias, até 5 MB; o app não altera nem apaga fotos."],
}
ACESSO = {
    "SIT_PROPRIEDADE": "O app não lê a tabela; recebe o necessário pelas funções.", "SIT_UNIDADE": "O app lê pelas funções vst_unidades e vst_agenda.",
    "SIT_RESERVA": "O app não lê a tabela; vst_agenda devolve só código e datas.", "SIT_BLOQUEIO": "O app nunca escreve aqui: só as funções do banco.",
    "VST_USUARIO": "Cada um lê o próprio; GESTOR lê a equipe das pousadas dele; ADMIN lê e mantém todos.",
    "VST_USUARIO_PROPRIEDADE": "Cada um lê os próprios acessos; GESTOR lê os da pousada dele; ADMIN mantém.",
    "VST_PROPRIEDADE": "Leitura por acesso à pousada; ADMIN altera a configuração.",
    "VST_UNIDADE": "Leitura por acesso ao chalé, sem o código do QR; GESTOR e ADMIN ajustam GPS e andar; situação e QR só pelas funções.",
    "VST_AMBIENTE": "Leitura por acesso ao chalé; GESTOR e ADMIN mantêm.", "VST_ITEM": "Leitura por acesso ao chalé; GESTOR e ADMIN mantêm.",
    "VST_TIPO_VISTORIA": "Todo usuário ativo lê; ADMIN mantém.", "VST_TIPO_VISTORIA_ITEM": "Leitura por acesso ao chalé; GESTOR e ADMIN mantêm.",
    "VST_VISTORIA": "Leitura por acesso ao chalé; escrita só pelas funções do app e pelo site (service_role).",
    "VST_RESPOSTA": "Mesma regra da vistoria.", "VST_OCORRENCIA": "Leitura por acesso ao chalé; GESTOR e ADMIN tratam pela função vst_resolver_ocorrencia.",
    "VST_FOTO": "Mesma regra da vistoria; o arquivo fica no Storage com política própria.",
}
INTEGRACAO = [
    ("Cadastro único", "SIT_PROPRIEDADE e SIT_UNIDADE são as tabelas do site, no mesmo schema \"SE\". A vistoria não acrescenta nenhuma coluna a elas: o que precisa fica em VST_PROPRIEDADE e VST_UNIDADE (1 para 1)."),
    ("Reserva vira agenda", "Quando o site confirma o sinal (confirmar_sinal), cria a vistoria de Entrada (DT_CHECKIN) e a de Saída (DT_CHECKOUT), AGENDADA e sem responsável. Reserva remarcada: as AGENDADAS acompanham a reserva nova. Reserva cancelada: as AGENDADAS viram CANCELADA."),
    ("Saída ligada à estadia", "VST_VISTORIA.ID_RESERVA liga a vistoria à estadia do site. Estadias do Airbnb e do Booking chegam como SIT_BLOQUEIO CANAL_EXTERNO, sem reserva: nesse caso o campo fica vazio."),
    ("Manutenção tira da venda", "Ocorrência crítica cria um SIT_BLOQUEIO MANUTENCAO, só por função security definer. A consultar_disponibilidade do site e o iCal dos canais já respeitam SIT_BLOQUEIO: as datas saem da venda sem mudar nada no site. O bloqueio nasce com prazo provisório de 7 dias e é encurtado quando a unidade é liberada."),
    ("Liberar devolve à venda", "Ao resolver a ocorrência e liberar a unidade, o bloqueio aberto é encerrado (DT_FIM = amanhã) e as datas voltam a ficar disponíveis."),
    ("Acesso e login", "Os funcionários (vistoria, limpeza, manutenção, gestão) entram por usuário ou CPF e senha, pela Edge Function login-vistoria; o ADMIN os cadastra no app pela Edge Function criar-usuario. VST_USUARIO.ID_USUARIO = auth.users.id. O app usa só a chave publicável e a sessão do usuário, e lê reservas e chalés por funções que nunca devolvem CPF, passaporte nem telefone."),
    ("Situação do chalé", "A vistoria mantém a situação sozinha: Entrada concluída → OCUPADO, Saída concluída → EM_LIMPEZA, item crítico com problema → MANUTENCAO. Depois da limpeza, a equipe libera. O site continua decidindo a venda só por reservas e bloqueios."),
    ("Conflito", "Um bloqueio não cancela reserva confirmada que já existe: o painel avisa o gestor para remanejar o hóspede."),
]
FUNCOES = [
    ("vst_unidades()", "Chalés das pousadas do usuário, com a configuração efetiva de presença (sem o QR)."),
    ("vst_agenda(dt_ini, dt_fim, id_unidade?)", "Vistorias do período, com código e datas da reserva; nunca dados do hóspede."),
    ("vst_checklist(id_unidade, id_tipo_vistoria)", "Itens ativos do chalé para o tipo, na ordem de passagem."),
    ("vst_resolver_qr(cd_hash_qr)", "Qual chalé é o do QR lido, se o usuário tem acesso."),
    ("vst_criar_vistoria(…)", "Vistoria avulsa ou de rotina; reenviar o mesmo id não duplica."),
    ("vst_atualizar_agenda(…)", "Gestão: atribui responsável, remarca ou cancela uma vistoria AGENDADA."),
    ("vst_iniciar_vistoria(…)", "Assume a vistoria e valida a presença: QR errado é recusado; GPS fora do raio só sinaliza."),
    ("vst_concluir_vistoria(…)", "Grava respostas e fotos, abre ocorrências, cria o bloqueio se item crítico e atualiza o chalé, numa transação."),
    ("vst_registrar_foto(…)", "Registra foto enviada ao Storage depois da conclusão."),
    ("vst_resolver_ocorrencia(…)", "Gestão: trata a ocorrência e, se pedido, libera o chalé e encerra o bloqueio."),
    ("vst_bloquear_por_ocorrencia(…)", "Gestão: cria o bloqueio de manutenção de uma ocorrência (prazo provisório de 7 dias)."),
    ("vst_alterar_situacao_unidade(…)", "Troca a situação do chalé (BLOQUEADO e MANUTENCAO só para a gestão)."),
    ("vst_obter_qr / vst_rotacionar_qr(id_unidade)", "Gestão: QR para imprimir e rotação que invalida as etiquetas antigas."),
    ("login-vistoria (Edge Function)", "Login por usuário ou CPF e senha: acha o funcionário ativo (vst_localizar_login), entra no Auth e devolve a sessão; resposta igual para qualquer erro e limite de tentativas."),
    ("redefinir-senha (Edge Function)", "Só ADMIN: define nova senha para um funcionário que esqueceu a dele. Cada funcionário troca a própria senha no app, logado."),
    ("criar-usuario (Edge Function)", "Só ADMIN: cria o login no Auth e o cadastro em VST_USUARIO e VST_USUARIO_PROPRIEDADE (vst_cadastrar_usuario) para qualquer perfil."),
    ("consultar_disponibilidade (site)", "Função do site que já exclui as datas com SIT_BLOQUEIO: por isso a manutenção some da venda sem mudar o site."),
]
PREFIXOS = [("ID_", "identificador"), ("NM_", "nome"), ("DS_", "descrição ou texto livre"), ("DT_", "data ou data e hora"),
            ("HR_", "hora"), ("VL_", "valor (dinheiro, coordenada)"), ("QTDE_", "quantidade"), ("NO_", "número (ordem, versão)"),
            ("CD_", "código"), ("TP_", "lista fixa, valores em MAIÚSCULAS"), ("SG_", "sim/não (boolean)")]
ORDEM = ["SIT_UNIDADE", "SIT_PROPRIEDADE", "SIT_RESERVA", "SIT_BLOQUEIO", "VST_VISTORIA", "VST_RESPOSTA", "VST_OCORRENCIA", "VST_FOTO",
         "VST_AMBIENTE", "VST_ITEM", "VST_TIPO_VISTORIA", "VST_TIPO_VISTORIA_ITEM", "VST_PROPRIEDADE", "VST_UNIDADE", "VST_USUARIO", "VST_USUARIO_PROPRIEDADE"]
assert sorted(ORDEM) == sorted(T)


def ligadas_a(n):
    return sorted(({e[2] for e in E if e[0] == n} | {e[0] for e in E if e[2] == n}) - {n})


def chave(c):
    return " ".join(k for k, on in (("PK", c["pk"]), ("FK", c["fk"]), ("UQ", c["uq"])) if on)


def cartao(n):
    t, g = T[n], T[n]["grupo"]
    return f'''<article class="tcard g-{g}" id="t-{n}" data-t="{n}">
  <header><h3>{n}</h3><span class="chip">{GRUPOS[g]}</span></header>
  <p class="purpose">{esc(PROPOSITO[n])}</p>
  <p class="meta">{len(t["todas"])} campos · ligada a {", ".join(ligadas_a(n))}</p>
  <ul>{"".join(f"<li>{esc(r)}</li>" for r in REGRAS[n])}</ul>
</article>'''


# ---------------------------------------------------------------- exemplos de dados (linhas fictícias e coerentes entre si)
BRT = timezone(timedelta(hours=-3))
U1, U2 = "0192f3a0-6c1e-7b3a-9d11-5a2e4c6b8f01", "0192f3a0-6c1e-7b3a-9d11-5a2e4c6b8f02"
V1, V2 = "0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e01", "0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e02"
F1, F2 = "0193c9e8-5f6a-7b7c-8d9e-1f2a3b4c5d01", "0193c9e8-5f6a-7b7c-8d9e-1f2a3b4c5d02"
SITE_TABS = ("SIT_PROPRIEDADE", "SIT_UNIDADE", "SIT_RESERVA", "SIT_BLOQUEIO")
EX = {n: [{k.lower(): v for k, v in r.items()} for r in EX_SITE[n]] for n in SITE_TABS}
EX["SIT_BLOQUEIO"].append(dict(id_bloqueio=3, id_unidade=1, dt_ini="2026-12-26", dt_fim="2027-01-02", tp_motivo="MANUTENCAO",
                               id_calendario=None, cd_externo=None, ds_observacao="Vistoria · ocorrência 1: Torneira pingando sem parar; pia molhada.",
                               dt_criacao="2026-12-26T18:21:40+00:00"))
EX["VST_PROPRIEDADE"] = [dict(id_propriedade=1, tp_validacao="QR_E_GPS", vl_latitude=-19.0847, vl_longitude=-43.5967, qtde_raio_metros=100,
                              qtde_precisao_max_metros=50, qtde_minutos_min_vistoria=10, dt_criacao="2026-11-20T12:00:00+00:00",
                              dt_atualizacao="2026-11-20T12:00:00+00:00")]
EX["VST_UNIDADE"] = [dict(id_unidade=1, ds_andar="Térreo", tp_validacao=None, vl_latitude=-19.0849, vl_longitude=-43.5969, qtde_raio_metros=60,
                          tp_situacao="MANUTENCAO", cd_hash_qr="b7e2c91f4a6d4c3e9a1f8d05c2b6e437", no_versao_qr=1,
                          dt_criacao="2026-11-20T12:00:00+00:00", dt_atualizacao="2026-12-26T18:21:40+00:00")]
EX["VST_USUARIO"] = [
    dict(id_usuario=U1, nm_usuario="Marina Lopes", cd_login="marina.lopes", cd_cpf="39053344705", tp_perfil="ASSESSOR", sg_ativo=True,
         dt_aceite_lgpd="2026-11-20T12:30:00+00:00", sg_trocar_senha=False, dt_criacao="2026-11-20T12:00:00+00:00", dt_atualizacao="2026-11-20T12:30:00+00:00"),
    dict(id_usuario=U2, nm_usuario="Carlos Mendes", cd_login="carlos.mendes", cd_cpf="11144477735", tp_perfil="GESTOR", sg_ativo=True,
         dt_aceite_lgpd=None, sg_trocar_senha=True, dt_criacao="2026-11-20T12:05:00+00:00", dt_atualizacao="2026-11-20T12:05:00+00:00")]
EX["VST_USUARIO_PROPRIEDADE"] = [dict(id_usuario=U1, id_propriedade=1, dt_criacao="2026-11-20T12:10:00+00:00"),
                                 dict(id_usuario=U2, id_propriedade=1, dt_criacao="2026-11-20T12:10:00+00:00")]
EX["VST_AMBIENTE"] = [
    dict(id_ambiente=1, id_unidade=1, nm_ambiente="Sala", no_ordem=1, ds_foto_referencia="ambientes/1/sala.jpg", sg_ativo=True, dt_criacao="2026-11-20T13:00:00+00:00"),
    dict(id_ambiente=2, id_unidade=1, nm_ambiente="Quarto", no_ordem=2, ds_foto_referencia="ambientes/1/quarto.jpg", sg_ativo=True, dt_criacao="2026-11-20T13:02:00+00:00"),
    dict(id_ambiente=3, id_unidade=1, nm_ambiente="Banheiro", no_ordem=3, ds_foto_referencia=None, sg_ativo=True, dt_criacao="2026-11-20T13:04:00+00:00")]
EX["VST_ITEM"] = [
    dict(id_item=1, id_ambiente=1, nm_item="Sofá e almofadas", ds_orientacao="Sem manchas ou rasgos; almofadas no lugar.", sg_critico=False, sg_foto_obrigatoria=False, qtde_esperada=None, no_ordem=1, sg_ativo=True, dt_criacao="2026-11-20T13:10:00+00:00"),
    dict(id_item=2, id_ambiente=2, nm_item="Cama e roupa de cama", ds_orientacao="Cama arrumada, sem manchas.", sg_critico=False, sg_foto_obrigatoria=False, qtde_esperada=None, no_ordem=1, sg_ativo=True, dt_criacao="2026-11-20T13:11:00+00:00"),
    dict(id_item=3, id_ambiente=3, nm_item="Torneira e pia", ds_orientacao="Abrir e fechar; ver se pinga ou vaza.", sg_critico=True, sg_foto_obrigatoria=True, qtde_esperada=None, no_ordem=1, sg_ativo=True, dt_criacao="2026-11-20T13:12:00+00:00"),
    dict(id_item=4, id_ambiente=3, nm_item="Toalhas de banho", ds_orientacao="Contar e ver se estão limpas.", sg_critico=False, sg_foto_obrigatoria=False, qtde_esperada=4, no_ordem=2, sg_ativo=True, dt_criacao="2026-11-20T13:13:00+00:00")]
EX["VST_TIPO_VISTORIA"] = [
    dict(id_tipo_vistoria=1, cd_tipo_vistoria="ENTRADA", nm_tipo_vistoria="Entrada", tp_comportamento="ENTRADA", tp_periodicidade=None, sg_exige_entrada=False, sg_exige_assinatura=False, sg_ativo=True, ds_perfis=["ASSESSOR"], dt_criacao="2026-11-20T12:00:00+00:00"),
    dict(id_tipo_vistoria=2, cd_tipo_vistoria="SAIDA", nm_tipo_vistoria="Saída", tp_comportamento="SAIDA", tp_periodicidade=None, sg_exige_entrada=True, sg_exige_assinatura=True, sg_ativo=True, ds_perfis=["ASSESSOR", "LIMPEZA"], dt_criacao="2026-11-20T12:00:00+00:00"),
    dict(id_tipo_vistoria=3, cd_tipo_vistoria="ROTINA", nm_tipo_vistoria="Rotina", tp_comportamento="ROTINA", tp_periodicidade="SEMANAL", sg_exige_entrada=False, sg_exige_assinatura=False, sg_ativo=True, ds_perfis=["ASSESSOR", "LIMPEZA", "MANUTENCAO"], dt_criacao="2026-11-20T12:00:00+00:00")]
EX["VST_TIPO_VISTORIA_ITEM"] = [dict(id_tipo_vistoria=1, id_item=3, no_ordem=1), dict(id_tipo_vistoria=2, id_item=3, no_ordem=1),
                                dict(id_tipo_vistoria=2, id_item=4, no_ordem=2)]
EX["VST_VISTORIA"] = [
    dict(id_vistoria=V1, id_vistoria_entrada=None, id_usuario=U1, id_unidade=1, id_tipo_vistoria=1, id_reserva=1, dt_agendada="2026-12-23", tp_status="CONCLUIDA",
         dt_inicio="2026-12-23T17:40:00+00:00", dt_fim="2026-12-23T17:52:00+00:00", tp_validacao="QR_E_GPS", dt_recebimento="2026-12-23T17:52:30+00:00",
         vl_latitude=-19.0850, vl_longitude=-43.5970, qtde_precisao_metros=8, qtde_distancia_metros=14, sg_fora_raio=False,
         ds_sinalizacoes=None, ds_assinatura=None, tp_situacao_resultante="OCUPADO", ds_observacao=None,
         dt_criacao="2026-11-18T13:19:00+00:00", dt_atualizacao="2026-12-23T17:52:30+00:00"),
    dict(id_vistoria=V2, id_vistoria_entrada=V1, id_usuario=U1, id_unidade=1, id_tipo_vistoria=2, id_reserva=1, dt_agendada="2026-12-26", tp_status="CONCLUIDA",
         dt_inicio="2026-12-26T18:05:00+00:00", dt_fim="2026-12-26T18:21:00+00:00", tp_validacao="QR_E_GPS", dt_recebimento="2026-12-26T18:21:40+00:00",
         vl_latitude=-19.0851, vl_longitude=-43.5971, qtde_precisao_metros=11, qtde_distancia_metros=22, sg_fora_raio=False,
         ds_sinalizacoes=None, ds_assinatura="assinaturas/2026/12/" + V2 + ".png", tp_situacao_resultante="MANUTENCAO", ds_observacao="Torneira do banheiro vazando.",
         dt_criacao="2026-11-18T13:19:00+00:00", dt_atualizacao="2026-12-26T18:21:40+00:00")]
EX["VST_RESPOSTA"] = [
    dict(id_vistoria=V1, id_item=3, tp_resposta="OK", qtde_encontrada=None, ds_observacao=None, dt_resposta="2026-12-23T17:45:00+00:00"),
    dict(id_vistoria=V2, id_item=3, tp_resposta="PROBLEMA", qtde_encontrada=None, ds_observacao="Torneira pingando sem parar; pia molhada.", dt_resposta="2026-12-26T18:10:00+00:00"),
    dict(id_vistoria=V2, id_item=4, tp_resposta="OK", qtde_encontrada=4, ds_observacao=None, dt_resposta="2026-12-26T18:14:00+00:00")]
EX["VST_OCORRENCIA"] = [
    dict(id_ocorrencia=1, id_vistoria=V2, id_item=3, id_unidade=1, id_bloqueio=3, tp_gravidade="CRITICA", tp_status="EM_TRATAMENTO",
         ds_ocorrencia="Torneira pingando sem parar; pia molhada.", ds_tratamento="Encanador agendado para 28/12.", dt_abertura="2026-12-26T18:21:00+00:00", dt_resolucao=None)]
EX["VST_FOTO"] = [
    dict(id_foto=F1, id_vistoria=V2, id_item=3, cd_arquivo=V2 + "/torneira-1.jpg", vl_latitude=-19.0851, vl_longitude=-43.5971,
         qtde_precisao_metros=9, sg_fora_raio=False, dt_captura="2026-12-26T18:11:00+00:00"),
    dict(id_foto=F2, id_vistoria=V2, id_item=3, cd_arquivo=V2 + "/torneira-2.jpg", vl_latitude=-19.0851, vl_longitude=-43.5971,
         qtde_precisao_metros=9, sg_fora_raio=False, dt_captura="2026-12-26T18:12:00+00:00")]
CAP = {
    "SIT_PROPRIEDADE": ["A pousada"], "SIT_UNIDADE": ["A Casa do Mirante"],
    "SIT_RESERVA": ["1 · Confirmada no site", "2 · Pré-reserva aguardando Pix"],
    "SIT_BLOQUEIO": ["Reserva vinda do Airbnb", "Manutenção marcada pela equipe", "Aberta pela vistoria"],
    "VST_USUARIO": ["Assessora", "Gestor"], "VST_USUARIO_PROPRIEDADE": ["Marina na pousada", "Carlos na pousada"],
    "VST_PROPRIEDADE": ["A pousada"], "VST_UNIDADE": ["A Casa do Mirante"],
    "VST_AMBIENTE": ["Sala", "Quarto", "Banheiro"], "VST_ITEM": ["Item comum", "Item comum", "Item crítico", "Item com contagem"],
    "VST_TIPO_VISTORIA": ["Entrada", "Saída", "Rotina"], "VST_TIPO_VISTORIA_ITEM": ["Entrada confere a torneira", "Saída confere a torneira", "Saída conta as toalhas"],
    "VST_VISTORIA": ["Entrada de 23/12", "Saída de 26/12"],
    "VST_RESPOSTA": ["Torneira OK na entrada", "Torneira com problema na saída", "Toalhas conferidas"],
    "VST_OCORRENCIA": ["Torneira vazando"], "VST_FOTO": ["Foto 1 da torneira", "Foto 2 da torneira"],
}
PAINEL_IDX = {"SIT_BLOQUEIO": [1, 2], "VST_ITEM": [2, 3], "VST_RESPOSTA": [1, 2], "VST_TIPO_VISTORIA_ITEM": [1, 2]}
for _n, _t in T.items():
    _cols = {c["n"].lower() for c in _t["todas"]}
    for _r in EX[_n]:
        assert set(_r) == _cols, (_n, _cols ^ set(_r))
    assert len(CAP[_n]) == len(EX[_n]), _n


def brl(v):
    return "R$ " + f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def fmt(col, v):
    if v is None:
        return '<span class="nul">vazio</span>'
    if isinstance(v, bool):
        return "sim" if v else "não"
    if isinstance(v, list):
        if col == "DS_DETALHE_PRECOS":
            return f"{len(v)} noites: " + " + ".join(brl(x["vl_noite"]).replace("R$ ", "") for x in v)
        if col == "DS_ACOMPANHANTES":
            return f"{len(v)} acompanhantes: " + ", ".join(esc(x.get("nome", "")) for x in v)
        if col == "DS_PERFIS":
            return ", ".join(v)
        return esc(json.dumps(v, ensure_ascii=False))
    if isinstance(v, dict):
        return esc(json.dumps(v, ensure_ascii=False))
    if col in ("VL_LATITUDE", "VL_LONGITUDE"):
        return str(v)
    if col.startswith("VL_PERCENTUAL"):
        return f"{v:g}%"
    if col.startswith("VL_"):
        return brl(v)
    if isinstance(v, str):
        if len(v) == 10 and v[4] == "-" and v[7] == "-":
            return f"{v[8:10]}/{v[5:7]}/{v[:4]}"
        if col.startswith("DT_") and "T" in v:
            return datetime.fromisoformat(v).astimezone(BRT).strftime("%d/%m/%Y %H:%M")
        if col.startswith("HR_"):
            return v[:5]
    return esc(v)


def texto(col, v):
    return html.unescape(re.sub(r"<[^>]+>", "", fmt(col, v)))


def longo(v):
    return ' class="long"' if isinstance(v, (list, dict)) or (isinstance(v, str) and len(v) > 26) else ""


def obrigatorio(c):
    return "gerado" if c["gen"] else ("auto" if c["auto"] else ("sim" if c["req"] else "não"))


def nome_campo(c, html_=True):
    if not html_:
        return c["n"]
    marca = ('<span class="k ka">+</span> ' if c["add"] else "") + ('<span class="k kp">PK</span> ' if c["pk"] else "") + ('<span class="k kf">FK</span> ' if c["fk"] else "")
    return marca + c["n"]


def exemplo(n):
    g, rows, cols = T[n]["grupo"], EX[n], T[n]["todas"]
    cab = "".join(f'<th scope="col">{esc(c)}</th>' for c in CAP[n])
    corpo = "".join(
        f'<tr{" class=add" if c["add"] else ""}><th scope="row">{nome_campo(c)}</th>' +
        "".join(f'<td{longo(r[c["n"].lower()])}>{fmt(c["n"], r[c["n"].lower()])}</td>' for r in rows) + "</tr>" for c in cols)
    return (f'<section class="ex g-{g}" id="e-{n}" data-t="{n}">\n  <header><h3>{n}</h3><span class="chip">{GRUPOS[g]}</span></header>\n'
            f'  <div class="tscroll"><table><thead><tr><th scope="col">Campo</th>{cab}</tr></thead><tbody>{corpo}</tbody></table></div>\n</section>')


def painel(n):
    t, g = T[n], T[n]["grupo"]
    idx = PAINEL_IDX.get(n, [0, 1])[:len(EX[n])]
    rs, caps = [EX[n][i] for i in idx], [CAP[n][i] for i in idx]
    linhas = "".join(
        f'<tr{" class=add" if c["add"] else ""}><th scope="row">{nome_campo(c)}</th><td class="ty">{esc(c["ty"])}</td><td>{obrigatorio(c)}</td><td class="ds">{esc(c["desc"])}</td>' +
        "".join(f'<td class="exv{" long" if longo(r[c["n"].lower()]) else ""}" data-l="{esc(cp)}">{fmt(c["n"], r[c["n"].lower()])}</td>' for r, cp in zip(rs, caps)) + "</tr>"
        for c in t["todas"])
    lig = []
    for f, c, p, pk, rot, _ in E:
        if f == n:
            if (f, c) in UM_PARA_UM:
                lig.append(f'<li><code>{c}</code> → {p} <i>({esc(rot)})</i>: é a própria chave; cada {n} aponta para exatamente 1 {p}.</li>')
                continue
            lig.append(f'<li><code>{c}</code> → {p} <i>({esc(rot)})</i>: cada {n} aponta para {"exatamente" if obrig(f, c) else "no máximo"} 1 {p}.</li>')
    for f, c, p, pk, rot, _ in E:
        if p == n and f != n:
            if (f, c) in UM_PARA_UM:
                lig.append(f'<li>{f}.<code>{c}</code> <i>({esc(rot)})</i>: cada {n} tem zero ou um {f} (1 para 1).</li>')
                continue
            lig.append(f'<li>{f}.<code>{c}</code> <i>({esc(rot)})</i>: cada {n} pode ter zero ou vários {f}.</li>')
    nota = '<p class="dlink">Os demais campos e regras desta tabela estão no DER das Reservas (projeto Site).</p>' if g == "site" else ""
    return f'''<template id="d-{n}"><div class="dt g-{g}">
  <header><h3>{n}</h3><span class="chip">{GRUPOS[g]}</span><span class="dmeta">{len(t["todas"])} campos</span><button type="button" class="dclose" aria-label="Fechar detalhe">Fechar ✕</button></header>
  <p class="purpose">{esc(PROPOSITO[n])}</p>{nota}
  <div class="dgrid">
    <div class="tscroll"><table class="dtab"><thead><tr><th>Campo</th><th>Tipo</th><th>Obrigatório</th><th>Para que serve</th>{"".join(f"<th>Exemplo: {esc(cp)}</th>" for cp in caps)}</tr></thead><tbody>{linhas}</tbody></table></div>
    <aside><div><h4>Ligações</h4><ul>{"".join(lig)}</ul></div><div><h4>Regras</h4><ul>{"".join(f"<li>{esc(r)}</li>" for r in REGRAS[n])}</ul></div><div><h4>Quem acessa</h4><p>{esc(ACESSO[n])}</p></div></aside>
  </div>
</div></template>'''


PASSOS = [
    ("18/11 13:19", "O hóspede paga o sinal e o site confirma a reserva SE-7F3A2C1D. No mesmo momento cria as vistorias de Entrada (DT_AGENDADA = check-in) e de Saída (check-out), AGENDADA e sem responsável.", "SIT_RESERVA 1, VST_VISTORIA 1 e 2", "—"),
    ("23/12 14:40", "Marina assume a Entrada, lê o QR da porta e confere o GPS (14 m do ponto). A vistoria vira CONCLUIDA às 14:52 e o chalé passa a OCUPADO (regra padrão da Entrada).", "VST_VISTORIA 1", "OCUPADO"),
    ("26/12 12:00", "Check-out da reserva. A Saída está na agenda do dia (DT_AGENDADA = DT_CHECKOUT).", "SIT_RESERVA 1", "—"),
    ("26/12 15:05", "Marina inicia a Saída (vst_iniciar_vistoria): QR certo, GPS a 22 m, dentro do raio de 60 m. A vistoria passa a EM_ANDAMENTO e aponta a Entrada (ID_VISTORIA_ENTRADA = 1).", "VST_VISTORIA 2", "—"),
    ("26/12 15:10", "Em “Torneira e pia”, item crítico, responde PROBLEMA, descreve o defeito e tira 2 fotos (foto obrigatória).", "VST_RESPOSTA, VST_FOTO", "—"),
    ("26/12 15:21", "Conclui (vst_concluir_vistoria), com assinatura. A regra padrão da Saída seria EM_LIMPEZA, mas o item crítico manda: o banco abre a ocorrência 1 (CRITICA), cria o bloqueio 3 (MANUTENCAO, 26/12 a 02/01, prazo provisório) e muda o chalé. SIT_AUDITORIA registra cada gravação.", "VST_OCORRENCIA 1, SIT_BLOQUEIO 3", "MANUTENCAO"),
    ("26/12 15:22", "No site, consultar_disponibilidade já devolve essas noites como ocupadas e o iCal leva a mesma janela ao Airbnb e ao Booking. Nada muda no código do site.", "SIT_BLOQUEIO 3", "MANUTENCAO"),
    ("28/12", "O gestor resolve a ocorrência e libera o chalé (vst_resolver_ocorrencia). O bloqueio é encerrado (DT_FIM = 29/12) e as datas voltam à venda.", "VST_OCORRENCIA 1, SIT_BLOQUEIO 3", "LIBERADO"),
]


def passo_a_passo():
    linhas = "".join(f"<tr><td>{a}</td><td>{esc(b)}</td><td><code>{esc(c)}</code></td><td>{d}</td></tr>" for a, b, c, d in PASSOS)
    return ('<section class="explica" id="como-bloqueio">\n  <h2>Como uma vistoria tira o chalé da venda</h2>\n'
            '  <p>É o ponto em que os dois produtos se encontram. A <b>VST_VISTORIA</b> registra o que o assessor viu; se um item crítico está com problema, nasce uma <b>VST_OCORRENCIA</b> e o banco cria um <b>SIT_BLOQUEIO</b> de manutenção. Como o site já consulta os bloqueios antes de vender, não é preciso mudar nada nele. O exemplo abaixo usa as mesmas linhas da seção de exemplos de dados.</p>\n'
            '  <h3>Exemplo: Casa do Mirante, estadia da reserva SE-7F3A2C1D (23 a 26/12/2026)</h3>\n'
            '  <div class="tscroll"><table class="passo"><thead><tr><th>Quando</th><th>O que acontece</th><th>Tabelas</th><th>Situação do chalé</th></tr></thead>\n'
            f'  <tbody>{linhas}</tbody></table></div>\n'
            '  <p>Uma reserva confirmada que já exista nessas datas não é cancelada pelo bloqueio: o painel avisa o gestor para remanejar o hóspede.</p>\n</section>')


CSS = r'''
:root {
  --bg: #f3f5f2; --surface: #ffffff; --fg: #1d2622; --muted: #5e6c65; --line: #c8d0cb; --wire: #6d7b74;
  --zebra: #f6f8f6; --pk: #9a5b0b; --fk: #2d6a8a; --add: #2f7a45;
  --site: #e4e2dc; --ace: #e9e1ec; --cad: #dfe8e2; --ope: #dde6ef; --apo: #efe6d6;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #121614; --surface: #1a201d; --fg: #e3e9e5; --muted: #95a39c; --line: #34403a; --wire: #7f8f87;
  --zebra: #1e2521; --pk: #e2a64c; --fk: #74b6d4; --add: #7ccf94;
  --site: #2c2a26; --ace: #2e2533; --cad: #233229; --ope: #1f2c38; --apo: #352d1f; color-scheme: dark; } }
:root[data-theme="dark"] {
  --bg: #121614; --surface: #1a201d; --fg: #e3e9e5; --muted: #95a39c; --line: #34403a; --wire: #7f8f87;
  --zebra: #1e2521; --pk: #e2a64c; --fk: #74b6d4; --add: #7ccf94;
  --site: #2c2a26; --ace: #2e2533; --cad: #233229; --ope: #1f2c38; --apo: #352d1f; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--fg); font-family: var(--sans); font-size: 15px; line-height: 1.5; margin: 0;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 48px; }
.wrap { max-width: 1600px; margin: 0 auto; display: grid; gap: 22px; min-width: 0; }
.wrap > * { min-width: 0; }
header.top { display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: baseline; justify-content: space-between; }
h1 { font-size: clamp(1.5rem, 1.2rem + 1.2vw, 2.1rem); margin: 0; letter-spacing: -0.01em; text-wrap: balance; }
.sub { color: var(--muted); margin: 4px 0 0; }
.stats { display: flex; flex-wrap: wrap; gap: 6px 18px; font-family: var(--mono); font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.stats b { color: var(--fg); font-weight: 600; }
.legend { display: flex; flex-wrap: wrap; gap: 10px 22px; align-items: center; font-size: 13px; color: var(--muted); }
.legend .it { display: inline-flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.legend svg { color: var(--wire); }
.sw { width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--line); display: inline-block; }
.sw.tr { border: 1.5px dashed var(--wire); }
.k { font-family: var(--mono); font-size: 11px; font-weight: 600; }
.kp { color: var(--pk); } .kf { color: var(--fk); } .ka { color: var(--add); }
.hint { font-size: 13px; color: var(--muted); margin: 0; max-width: 95ch; }
figure { margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px; min-width: 0; }
.fbar { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.fbar p { margin: 0; font-size: 13px; color: var(--muted); flex: 1 1 260px; }
.btn { min-height: 44px; display: inline-flex; align-items: center; gap: 8px; padding: 0 16px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--surface); color: var(--fg); font: 500 14px var(--sans); cursor: pointer; }
.btn:hover { border-color: var(--wire); }
.btn.pri { background: var(--fg); border-color: var(--fg); color: var(--bg); }
button:focus-visible { outline: 2px solid var(--fk); outline-offset: 2px; }
.scroll { overflow: auto; -webkit-overflow-scrolling: touch; max-height: 78svh; }
#der { display: block; height: auto; color: var(--wire); }
.scroll #der { width: 100%; min-width: 1500px; }
figcaption { font-size: 13px; color: var(--muted); padding: 10px 2px 0; max-width: 90ch; }
#der .box { fill: var(--surface); stroke: var(--line); stroke-width: 1; }
#der .g-site .box { stroke: var(--wire); stroke-dasharray: 5 4; stroke-width: 1.3; }
#der .zebra { fill: var(--zebra); }
#der .g-site .head { fill: var(--site); } #der .g-ace .head { fill: var(--ace); } #der .g-cad .head { fill: var(--cad); }
#der .g-ope .head { fill: var(--ope); } #der .g-apo .head { fill: var(--apo); }
#der .tname { fill: var(--fg); font: 600 13.5px var(--sans); letter-spacing: 0.02em; }
#der .tgroup { fill: var(--muted); font: 500 10px var(--sans); letter-spacing: 0.12em; }
#der .cname { fill: var(--fg); font: 500 11.5px var(--mono); }
#der .cname.opt { fill: var(--muted); font-weight: 400; }
#der .cname.add { fill: var(--add); }
#der .mais { fill: var(--muted); font: italic 400 11px var(--sans); }
#der .ctype { fill: var(--muted); font: 400 10.5px var(--mono); }
#der .key { font: 600 9.5px var(--mono); }
#der .kpk { fill: var(--pk); } #der .kfk { fill: var(--fk); } #der .kadd { fill: var(--add); font-size: 12px; }
#der .wire { fill: none; stroke: currentColor; stroke-width: 1.4; }
#der .card path { fill: none; stroke: currentColor; stroke-width: 1.4; }
#der .card .hollow { fill: var(--surface); stroke: currentColor; stroke-width: 1.3; }
#der .elabel { fill: var(--muted); font: italic 500 11px var(--sans); paint-order: stroke; stroke: var(--surface); stroke-width: 4px; stroke-linejoin: round; }
#der .tbl { cursor: pointer; outline: none; transition: opacity .15s; }
#der .tbl:focus-visible .box, #der .tbl.on .box { stroke: var(--fk); stroke-width: 2; stroke-dasharray: none; }
#der .edge { transition: opacity .15s; }
#der.focus .tbl:not(.near), #der.focus .edge:not(.near) { opacity: .18; }
#der.focus .edge.near { color: var(--fk); }
h2 { font-size: 1.1rem; margin: 6px 0 0; }
.integ { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 10px 14px; margin: 0; padding: 0; list-style: none; font-size: 13.5px; }
.integ li { background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--fk); border-radius: 8px; padding: 10px 14px; }
.integ b { display: block; font-size: 14px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 14px; }
.tcard { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px 12px; min-width: 0; scroll-margin-top: 16px; cursor: pointer; }
.tcard.g-site, .ex.g-site, .dt.g-site { border-style: dashed; border-color: var(--wire); }
.tcard.on, .ex.on { border-color: var(--fk); border-style: solid; box-shadow: 0 0 0 1px var(--fk); }
.tcard header, .ex header { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.tcard h3 { margin: 0; font-family: var(--mono); font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.chip { font-size: 10px; letter-spacing: 0.12em; padding: 2px 8px; border-radius: 99px; color: var(--fg); white-space: nowrap; }
.g-site .chip { background: var(--site); } .g-ace .chip { background: var(--ace); } .g-cad .chip { background: var(--cad); }
.g-ope .chip { background: var(--ope); } .g-apo .chip { background: var(--apo); }
.purpose { margin: 8px 0 4px; }
.meta { margin: 0 0 8px; font-size: 12.5px; color: var(--muted); font-family: var(--mono); overflow-wrap: anywhere; }
.tcard ul { margin: 0; padding-left: 18px; font-size: 13.5px; display: grid; gap: 3px; }
/* painel de detalhe */
#detalhe.has { padding-top: 14px; max-width: none; color: var(--fg); }
.dt { border: 0; }
.dt header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.dt h3 { margin: 0; font-family: var(--mono); font-size: 15px; font-weight: 600; color: var(--fg); }
.dmeta { font-size: 12.5px; color: var(--muted); }
.dclose { margin-left: auto; font: inherit; font-size: 12.5px; color: var(--fg); background: transparent; border: 1px solid var(--line); border-radius: 6px; padding: 3px 10px; cursor: pointer; min-height: 32px; }
.dclose:hover { border-color: var(--fk); }
.dt .purpose { color: var(--fg); font-size: 14px; margin: 8px 0 10px; max-width: 100ch; }
.dlink { margin: -4px 0 10px; font-size: 13px; color: var(--muted); }
.dgrid { display: grid; gap: 16px; }
.dt aside { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 0 28px; font-size: 13px; color: var(--fg); }
.dt aside h4 { margin: 0 0 4px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.dt aside ul { margin: 0 0 14px; padding-left: 18px; display: grid; gap: 4px; }
.dt aside p { margin: 0 0 14px; }
.dt aside code { font-family: var(--mono); font-size: 12px; }
.dtab { color: var(--fg); }
.dtab tbody th { font-family: var(--mono); font-size: 11.5px; font-weight: 500; white-space: nowrap; }
.dtab td { white-space: nowrap; }
.dtab td.ds { white-space: normal; min-width: 26ch; color: var(--fg); }
.dtab td.ty { font-family: var(--mono); font-size: 11.5px; color: var(--muted); }
.dtab td.long { white-space: normal; overflow-wrap: anywhere; min-width: 20ch; }
.dtab thead th { white-space: normal; }
.dtab tbody tr:nth-child(even), .ex tbody tr:nth-child(even) { background: var(--zebra); }
tr.add th { color: var(--add); }
@media (max-width: 720px) {
  .dtab thead { display: none; }
  .dtab, .dtab tbody { display: block; }
  .dtab tr { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 8px 4px; border-bottom: 1px solid var(--line); }
  .dtab th, .dtab td { border: 0; padding: 0; white-space: normal; }
  .dtab td:nth-child(3) { display: none; }
  .dtab td.ds, .dtab td.exv { grid-column: 1 / -1; min-width: 0; }
  .dtab td.exv::before { content: attr(data-l) ": "; color: var(--muted); }
}
/* explicação e exemplos */
.explica, .ex { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; min-width: 0; }
.explica h2 { margin-top: 0; }
.explica h3 { font-size: 0.98rem; margin: 18px 0 8px; }
.explica p { margin: 6px 0; max-width: 95ch; }
.tscroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table { border-collapse: collapse; font-size: 13px; width: 100%; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 5px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
thead th { font-size: 12px; color: var(--muted); font-weight: 600; }
.passo td:first-child { white-space: nowrap; }
.passo td:nth-child(3) { min-width: 18ch; } .passo code { font-family: var(--mono); font-size: 12px; }
.exs { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); gap: 14px; align-items: start; }
.ex { scroll-margin-top: 16px; }
.ex header { margin-bottom: 8px; }
.ex h3 { margin: 0; font-family: var(--mono); font-size: 14px; font-weight: 600; }
.ex tbody th { font-family: var(--mono); font-size: 11.5px; font-weight: 500; white-space: nowrap; }
.ex td { white-space: nowrap; }
.ex td.long { white-space: normal; overflow-wrap: anywhere; min-width: 24ch; }
.ex thead th { min-width: 13ch; }
.nul { color: var(--muted); font-style: italic; }
.fn { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 10px 14px; margin: 0; padding: 0; list-style: none; font-size: 13.5px; }
.fn li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; }
.fn code { font-family: var(--mono); font-size: 12.5px; font-weight: 600; }
.fn span { display: block; color: var(--muted); }
.pref { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; font-size: 13px; }
.pref li { background: var(--surface); border: 1px solid var(--line); border-radius: 99px; padding: 4px 12px; }
.pref code { font-family: var(--mono); font-weight: 600; }
p.nota { margin: 0; font-size: 13.5px; color: var(--muted); max-width: 90ch; }
/* tela cheia */
html.travado, html.travado body { overflow: hidden; }
.tela { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; background: var(--bg); }
.tela[hidden] { display: none; }
.tbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--line);
  padding: max(8px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) 8px max(16px, env(safe-area-inset-left)); }
.tbar b { font-size: 16px; } .tbar small { color: var(--muted); margin-left: 8px; font-size: 12px; }
.tbar .grp { display: flex; gap: 6px; }
.tbar .btn { min-width: 44px; justify-content: center; padding: 0 12px; }
.palco { position: relative; flex: 1; overflow: hidden; touch-action: none; cursor: grab; }
.palco.arrastando { cursor: grabbing; }
.palco #der { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
.info { background: var(--surface); border-top: 1px solid var(--line); font-size: 13px; color: var(--muted);
  padding: 10px max(16px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); }
.info .nome { font: 600 14px var(--mono); color: var(--fg); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.info p { margin: 2px 0 8px; color: var(--fg); max-width: 90ch; }
.info .lig { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.chipbtn { min-height: 36px; padding: 0 12px; border: 1px solid var(--line); border-radius: 99px; background: var(--bg); color: var(--fg); font: 500 12px var(--mono); cursor: pointer; }
.info .ver { margin-left: auto; }
@media (max-width: 640px) { .tbar small { display: none; } .info .ver { margin-left: 0; } }
@media (prefers-reduced-motion: reduce) { #der .tbl, #der .edge { transition: none; } }
'''

JS = r'''
(function () {
  var der = document.getElementById('der');
  var edges = [].slice.call(der.querySelectorAll('.edge'));
  var tbls = [].slice.call(der.querySelectorAll('.tbl'));
  var cards = [].slice.call(document.querySelectorAll('.tcard, .ex'));
  var cap = document.getElementById('detalhe'), capPadrao = cap.innerHTML;
  var area = document.getElementById('area'), tela = document.getElementById('tela'), palco = document.getElementById('palco');
  var info = document.getElementById('info'), W = __W__, A = __A__, DADOS = __DADOS__;
  var reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = null, aberto = false;
  function vizinhos(name) {
    var n = {};
    edges.forEach(function (e) { var r = e.getAttribute('data-rel').split(' '); if (r.indexOf(name) >= 0) { n[r[0]] = 1; n[r[1]] = 1; } });
    delete n[name]; return Object.keys(n).sort();
  }
  // Seleciona a tabela: destaca as ligações, mostra o detalhe abaixo do diagrama e realça cartão e exemplo
  function select(name, scroll, forcar) {
    if (current === name && !forcar) name = null;
    current = name;
    der.classList.toggle('focus', !!name);
    var near = {};
    edges.forEach(function (e) {
      var r = e.getAttribute('data-rel').split(' ');
      var on = !!name && r.indexOf(name) >= 0;
      e.classList.toggle('near', on);
      if (on) { near[r[0]] = 1; near[r[1]] = 1; }
    });
    if (name) near[name] = 1;
    tbls.forEach(function (t) { var n = t.getAttribute('data-t'); t.classList.toggle('near', !!near[n]); t.classList.toggle('on', n === name); });
    cards.forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-t') === name); });
    var tp = name && document.getElementById('d-' + name);
    cap.innerHTML = tp ? tp.innerHTML : capPadrao; cap.classList.toggle('has', !!tp);
    var bt = cap.querySelector('.dclose'); if (bt) bt.addEventListener('click', function () { select(current, false); });
    if (aberto) mostrarInfo(name);
    if (name && scroll) cap.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'nearest' });
  }
  tbls.forEach(function (t) {
    t.addEventListener('click', function () { if (!aberto) select(t.getAttribute('data-t'), true); });
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(t.getAttribute('data-t'), !aberto); } });
  });
  // clicar num cartão de regras volta ao diagrama com a tabela destacada e centralizada
  [].slice.call(document.querySelectorAll('.tcard')).forEach(function (c) {
    c.addEventListener('click', function () {
      var n = c.getAttribute('data-t'); select(n, false, true);
      var b = der.querySelector('.tbl[data-t="' + n + '"] .box'), k = der.getBoundingClientRect().width / W;
      area.scrollTo({ left: (+b.getAttribute('x') + 155) * k - area.clientWidth / 2, top: +b.getAttribute('y') * k - 20, behavior: reduz ? 'auto' : 'smooth' });
      area.scrollIntoView({ block: 'nearest', behavior: reduz ? 'auto' : 'smooth' });
    });
  });
  // tela cheia: arrastar move, pinça/roda/botões aproximam, tocar seleciona
  var s = 1, tx = 0, ty = 0, arrastou = false, pinca = null, toques = new Map();
  function desenhar() { der.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')'; }
  function encaixar() { var r = palco.getBoundingClientRect(); s = Math.min(r.width / W, r.height / A) * 0.96; tx = (r.width - W * s) / 2; ty = (r.height - A * s) / 2; desenhar(); }
  function zoomEm(f, cx, cy) { var n = Math.max(0.15, Math.min(4, s * f)); tx = cx - (cx - tx) * n / s; ty = cy - (cy - ty) * n / s; s = n; desenhar(); }
  function centrar(name) {
    var b = der.querySelector('.tbl[data-t="' + name + '"] .box'); if (!b) return;
    var r = palco.getBoundingClientRect(), x = +b.getAttribute('x') + 155, y = +b.getAttribute('y') + (+b.getAttribute('height')) / 2;
    s = Math.max(s, Math.min(1, r.width / 700)); tx = r.width / 2 - x * s; ty = r.height / 2 - y * s; desenhar();
  }
  function mostrarInfo(name) {
    if (!name) { info.innerHTML = '<span>Toque numa tabela para ver para que serve e com quem se liga · Esc fecha</span>'; return; }
    var d = DADOS[name], h = '<div class="nome">' + name + ' <span class="' + d.c + '"><span class="chip">' + d.g + '</span></span></div><p>' + d.p + '</p><div class="lig"><span>Ligada a</span>';
    vizinhos(name).forEach(function (v) { h += '<button type="button" class="chipbtn" data-ir="' + v + '">' + v + '</button>'; });
    info.innerHTML = h + '<button type="button" class="btn pri ver" data-ver="' + name + '">Ver campos, exemplos e regras ›</button></div>';
  }
  info.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ir) { select(b.dataset.ir, false, true); centrar(b.dataset.ir); }
    if (b.dataset.ver) { var n = b.dataset.ver; fechar(); requestAnimationFrame(function () { select(n, true, true); }); }
  });
  var btAbrir = document.getElementById('abrir'), btFechar = document.getElementById('fechar');
  function abrir() {
    aberto = true; tela.hidden = false; document.documentElement.classList.add('travado');
    der.setAttribute('width', W); der.setAttribute('height', A);
    palco.appendChild(der); encaixar(); mostrarInfo(current);
    var fs = document.documentElement.requestFullscreen; if (fs) fs.call(document.documentElement).catch(function () {});
    btFechar.focus();
  }
  function fechar() {
    if (!aberto) return; aberto = false; der.style.transform = ''; der.removeAttribute('width'); der.removeAttribute('height'); area.appendChild(der);
    tela.hidden = true; document.documentElement.classList.remove('travado');
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    btAbrir.focus({ preventScroll: true });
  }
  btAbrir.addEventListener('click', abrir); btFechar.addEventListener('click', fechar);
  document.addEventListener('keydown', function (e) { if (aberto && e.key === 'Escape') fechar(); });
  document.addEventListener('fullscreenchange', function () { if (aberto) setTimeout(encaixar, 60); });
  window.addEventListener('resize', function () { if (aberto) encaixar(); });
  [].forEach.call(document.querySelectorAll('[data-tz]'), function (b) {
    b.addEventListener('click', function () { var d = +b.dataset.tz; if (!d) return encaixar(); var r = palco.getBoundingClientRect(); zoomEm(d > 0 ? 1.3 : 1 / 1.3, r.width / 2, r.height / 2); });
  });
  palco.addEventListener('wheel', function (e) { e.preventDefault(); var r = palco.getBoundingClientRect(); zoomEm(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  palco.addEventListener('pointerdown', function (e) { toques.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY }); if (toques.size === 1) arrastou = false; pinca = null; });
  palco.addEventListener('pointermove', function (e) {
    var t = toques.get(e.pointerId); if (!t) return;
    if (!arrastou && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) > 6) { arrastou = true; palco.classList.add('arrastando'); }
    if (arrastou && !palco.hasPointerCapture(e.pointerId)) palco.setPointerCapture(e.pointerId);
    var dx = e.clientX - t.x, dy = e.clientY - t.y; t.x = e.clientX; t.y = e.clientY;
    if (toques.size === 1 && arrastou) { tx += dx; ty += dy; desenhar(); }
    if (toques.size === 2) {
      var v = Array.from(toques.values()), a = v[0], b = v[1], r = palco.getBoundingClientRect(), d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinca) zoomEm(d / pinca, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); pinca = d;
    }
  });
  function soltar(e) { toques.delete(e.pointerId); if (toques.size < 2) pinca = null; if (!toques.size) palco.classList.remove('arrastando'); }
  palco.addEventListener('pointerup', soltar); palco.addEventListener('pointercancel', soltar);
  palco.addEventListener('click', function (e) {
    if (arrastou) return;
    var t = e.target.closest('.tbl');
    select(t ? t.getAttribute('data-t') : null, false, !!t);
  });
  if (location.hash === '#tela-cheia') abrir();
})();
'''


def pagina():
    ncols = sum(len(t["todas"]) for t in T.values())
    novos = sum(c["add"] for t in T.values() for c in t["todas"])
    dados = {n: {"g": GRUPOS[T[n]["grupo"]], "c": "g-" + T[n]["grupo"], "p": esc(PROPOSITO[n])} for n in T}
    js = JS.replace("__W__", str(LARG)).replace("__A__", str(ALT)).replace("__DADOS__", json.dumps(dados, ensure_ascii=False))
    leg = ('<span class="it"><svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true"><path d="M2,7 H42 M30,7 L42,1 M30,7 L42,13" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="24" cy="7" r="3.5" fill="var(--surface)" stroke="currentColor" stroke-width="1.3"/></svg> zero ou muitos</span>'
           '<span class="it"><svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true"><path d="M2,7 H42 M35,1 V13 M30,1 V13" fill="none" stroke="currentColor" stroke-width="1.4"/></svg> exatamente um</span>'
           '<span class="it"><svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true"><path d="M2,7 H42 M35,1 V13" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="27" cy="7" r="3.5" fill="var(--surface)" stroke="currentColor" stroke-width="1.3"/></svg> zero ou um</span>')
    grupos = "".join(f'<span class="it"><span class="sw{" tr" if g == "site" else ""}" style="background:var(--{g})"></span>{GRUPOS[g].lower()}</span>' for g in GRUPOS)
    return f'''<title>DER das Vistorias</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>{CSS}</style>

<div class="wrap">
  <header class="top">
    <div>
      <h1>DER das Vistorias</h1>
      <p class="sub">Solar do Espinhaço · integrado ao banco de reservas do site · PostgreSQL (Supabase), schema "SE" · {VERSAO} · prefixo VST_ = projeto Vistorias, SIT_ = projeto Site</p>
    </div>
    <div class="stats"><span><b>{len(T)}</b> tabelas</span><span><b>4</b> do site</span><span><b>{ncols}</b> campos</span><span><b>0</b> colunas novas no site</span><span><b>{len(E)}</b> ligações</span></div>
  </header>

  <div class="legend" aria-label="Legenda">
    <span class="it"><span class="k kp">PK</span> chave primária</span>
    <span class="it"><span class="k kf">FK</span> chave estrangeira</span>
    <span class="it"><span class="k">CAMPO?</span> opcional (aceita vazio)</span>
    <span class="it"><span class="k">gerado · auto</span> preenchido pelo banco</span>
    {leg}
    {grupos}
  </div>

  <figure>
    <div class="fbar">
      <p>Tabelas tracejadas são do site (mesmo banco). Clique numa tabela para ver o detalhe dela logo abaixo do diagrama.</p>
      <button type="button" class="btn pri" id="abrir"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Tela cheia</button>
    </div>
    <div class="scroll" id="area">
{svg()}
    </div>
    <figcaption id="detalhe" aria-live="polite">A SIT_UNIDADE é o elo entre os dois produtos: o site a vende, o app a vistoria. A VST_VISTORIA aponta a unidade, o tipo, o assessor e, quando houver, a SIT_RESERVA; respostas, fotos e ocorrências saem dela, e uma ocorrência crítica cria um SIT_BLOQUEIO que tira as datas da venda. Passe o mouse numa linha para ver o nome da FK. <b>Clique numa tabela para ver aqui o detalhe dela: cada campo explicado, com exemplo, ligações e regras.</b></figcaption>
{chr(10).join(painel(n) for n in ORDEM)}
  </figure>

  <div class="tela" id="tela" role="dialog" aria-modal="true" aria-label="DER em tela cheia" hidden>
    <div class="tbar">
      <span><b>DER das Vistorias</b><small>Arraste para mover · pinça ou roda para aproximar</small></span>
      <div class="grp" role="group" aria-label="Zoom">
        <button type="button" class="btn" data-tz="-1" aria-label="Diminuir">−</button><button type="button" class="btn" data-tz="0">Ajustar</button><button type="button" class="btn" data-tz="1" aria-label="Aumentar">+</button><button type="button" class="btn pri" id="fechar">Fechar</button>
      </div>
    </div>
    <div class="palco" id="palco"></div>
    <div class="info" id="info" aria-live="polite"></div>
  </div>

  <h2>Integração com o site</h2>
  <ul class="integ">
    {"".join(f"<li><b>{esc(a)}</b>{esc(b)}</li>" for a, b in INTEGRACAO)}
  </ul>

  <h2>Regras de cada tabela</h2>
  <div class="cards">
{chr(10).join(cartao(n) for n in ORDEM)}
  </div>

{passo_a_passo()}

  <h2>Exemplos de dados</h2>
  <p class="hint">Linhas fictícias que contam uma história só: a Marina faz a Entrada e a Saída da reserva SE-7F3A2C1D, acha uma torneira vazando e o chalé sai da venda. Os IDs batem entre as tabelas (a vistoria 2 aponta a reserva 1, a ocorrência 1 aponta o bloqueio 3). As tabelas do site usam as linhas do DER das Reservas. Clique numa tabela do diagrama para destacar o exemplo dela.</p>
  <div class="exs">
{chr(10).join(exemplo(n) for n in ORDEM)}
  </div>

  <h2>Funções do banco</h2>
  <ul class="fn">
    {"".join(f"<li><code>{esc(a)}</code><span>{esc(b)}</span></li>" for a, b in FUNCOES)}
  </ul>

  <h2>Nomenclatura</h2>
  <p class="nota">Mesmo padrão do banco do site (site/database/README.md): tudo no schema <b>"SE"</b>, em MAIÚSCULAS entre aspas (select * from "SE"."VST_VISTORIA"). Toda tabela do projeto Vistorias começa com <b>VST_</b> e as do projeto Site com <b>SIT_</b>, para separar os projetos no mesmo banco; as funções do app começam com <b>vst_</b>. Tabelas no singular, nomes em MAIÚSCULAS, valores de TP_ em MAIÚSCULAS, restrições com o nome completo da tabela (PK_VST_VISTORIA, FK_&lt;FILHA&gt;_&lt;PAI&gt;, UQ_, CK_, EX_, IX_). Os campos não levam o prefixo da tabela. Ids bigint identity; uuid onde o celular pode criar o registro offline (VST_VISTORIA, VST_FOTO).</p>
  <ul class="pref">{"".join(f"<li><code>{a}</code> {esc(b)}</li>" for a, b in PREFIXOS)}</ul>
</div>

<script>{js}</script>
'''


def markdown():
    l = ["# Dicionário de dados — Vistorias\n",
         f"Integrado ao banco de reservas do site (mesmo Supabase, esquema `public`): {len(T)} tabelas, 4 delas do site (`SIT_`), e {len(E)} ligações. Diagrama em [`der.html`](./der.html). {VERSAO}.\n",
         "Gerado por `tools/gerar-der.py`, que lê as tabelas do site em `site/database/schema.sql` e os textos em `site/database/gerar_der.py`.\n",
         "## Integração com o site\n"]
    l += [f"- **{a}.** {b}" for a, b in INTEGRACAO]
    l += ["", "## Como uma vistoria tira o chalé da venda\n", "| Quando | O que acontece | Tabelas | Situação do chalé |", "|---|---|---|---|"]
    l += [f"| {a} | {b} | `{c}` | {d} |" for a, b, c, d in PASSOS]
    l += ["", "## Nomenclatura\n", "Tabelas do projeto Vistorias começam com `VST_`; as do projeto Site, com `SIT_`. Mesmo padrão do site: " + ", ".join(f"`{a}` {b}" for a, b in PREFIXOS) + ". Restrições com o nome completo da tabela: `PK_VST_VISTORIA`, `FK_<FILHA>_<PAI>`, `UQ_`, `CK_`, `EX_`, `IX_`. Os campos não levam o prefixo da tabela.\n"]
    for n in ORDEM:
        t = T[n]
        l += [f"## `{n}` ({GRUPOS[t['grupo']]})\n", PROPOSITO[n] + "\n", f"- **Ligada a:** {', '.join(ligadas_a(n))}",
              f"- **Acesso (RLS):** {ACESSO[n]}", "- **Regras:** " + " ".join(REGRAS[n]) + "\n",
              f"| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo ({CAP[n][PAINEL_IDX.get(n, [0])[0]]}) |", "|---|---|---|---|---|---|"]
        r = EX[n][PAINEL_IDX.get(n, [0])[0]]
        for c in t["todas"]:
            l.append(f"| `{c['n']}`{' **+ novo**' if c['add'] else ''} | `{c['ty']}` | {obrigatorio(c)} | {chave(c) or '—'} | {c['desc']} | {texto(c['n'], r[c['n'].lower()])} |")
        l.append("")
    l += ["## Ligações\n", "| Filha | Campo | Pai | Obrigatória | Leitura |", "|---|---|---|---|---|"]
    l += [f"| `{f}` | {'`ID_VISTORIA` + ' if (f, 'ID_VISTORIA') in COMPOSTAS else ''}`{c}` | `{p}` | {'sim' if obrig(f, c) else 'não'} | {r} |" for f, c, p, pk, r, _ in E]
    l += ["", "`VST_USUARIO.ID_USUARIO` também referencia `auth.users` (Supabase Auth).", "",
          "## Funções do app\n", "Todas em minúsculas, `security definer`, executáveis só pelo usuário logado (`authenticated`). Detalhes e parâmetros em [`README.md`](./README.md).\n",
          "| Função | Para que serve |", "|---|---|"]
    l += [f"| `{a}` | {b} |" for a, b in FUNCOES]
    l.append("")
    return "\n".join(l)


if __name__ == "__main__":
    (APP / "database").mkdir(exist_ok=True)
    (APP / "database" / "der.html").write_text(pagina(), encoding="utf-8")
    (APP / "database" / "dicionario-de-dados.md").write_text(markdown(), encoding="utf-8")
    print(f"ok: {len(T)} tabelas, {len(E)} ligações")
