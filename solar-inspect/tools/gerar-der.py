# Gera o DER das Vistorias (database/der.html) e o dicionário de dados (database/dicionario-de-dados.md).
# Mesmo modelo visual do DER das Reservas (site/database/gerar_der.py) e integrado ao banco do site:
# PROPRIEDADE, UNIDADE, RESERVA e BLOQUEIO são lidas de site/database/schema.sql (fonte única).
# Uso (a partir de solar-inspect): python3 -I tools/gerar-der.py
import html
import json
import re
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
SITE_SQL = APP.parent / "site" / "database" / "schema.sql"
VERSAO = "proposta v2, 18/11/2026"


def esc(s):
    return html.escape(str(s), quote=True)


# ---------------------------------------------------------------- tabelas do site (lidas do schema.sql)
def ler_site():
    sql = SITE_SQL.read_text(encoding="utf-8")
    out = {}
    for nome, corpo in re.findall(r"create table (\w+) \((.*?)\n\);", sql, re.S):
        cols, pk, fks = [], set(), set()
        for m in re.finditer(r"constraint PK_\w+ primary key \(([^)]*)\)", corpo):
            pk |= {c.strip() for c in m.group(1).split(",")}
        for m in re.finditer(r"foreign key \((\w+)\) references", corpo):
            fks.add(m.group(1))
        for ln in corpo.split("\n"):
            m = re.match(r"^  ([A-Z][A-Z0-9_]+)\s+(\w+(?:\(\d+(?:,\d+)?\))?(?:\[\])?)(.*)$", ln)
            if not m:
                continue
            n, ty, resto = m.groups()
            coment = resto.split("--", 1)[1].strip() if "--" in resto else ""
            cols.append(dict(n=n, ty=ty, req="not null" in resto or "generated" in resto,
                             auto="as identity" in resto, gen="generated always as (" in resto, coment=coment))
        for c in cols:
            c["pk"], c["fk"] = c["n"] in pk, c["n"] in fks
        out[nome] = cols
    return out


SITE = ler_site()
GRUPOS = {"site": "SITE · COMUM", "ace": "ACESSO", "cad": "CADASTRO", "ope": "OPERAÇÃO", "apo": "APOIO"}


def col(n, ty, req=True, desc="", pk=False, fk=False, uq=False, auto=False):
    return dict(n=n, ty=ty, req=req, desc=desc, pk=pk, fk=fk, uq=uq, auto=auto, gen=False, add=False, mais=False)


def comum(nome, mostrar, descricoes, acrescimos, rotulo_mais):
    """Tabela do site: mostra os campos que a vistoria usa, resume o resto e acrescenta os campos propostos (+)."""
    base = {c["n"]: c for c in SITE[nome]}
    cols = []
    for n in mostrar:
        c = base[n]
        cols.append(dict(n=n, ty=c["ty"], req=c["req"] or c["pk"], desc=descricoes.get(n, c["coment"]), pk=c["pk"],
                         fk=c["fk"], uq=False, auto=c["auto"], gen=c["gen"], add=False, mais=False))
    resto = [n for n in base if n not in mostrar]
    if resto:
        cols.append(dict(n=f"… mais {len(resto)} campos {rotulo_mais}", ty="", req=True, desc=", ".join(resto), pk=False,
                         fk=False, uq=False, auto=False, gen=False, add=False, mais=True))
    for c in acrescimos:
        c["add"] = True
        cols.append(c)
    return dict(grupo="site", cols=cols, nsite=len(base))


VALIDACAO = "QR, GPS ou QR_E_GPS"
T = {}
T["PROPRIEDADE"] = comum(
    "PROPRIEDADE", ["ID_PROPRIEDADE", "NM_PROPRIEDADE", "HR_CHECKIN", "HR_CHECKOUT"],
    {"ID_PROPRIEDADE": "Identificador da pousada.", "NM_PROPRIEDADE": "Nome da pousada.",
     "HR_CHECKIN": "Horário de entrada: base da agenda de vistorias de Entrada.",
     "HR_CHECKOUT": "Horário de saída: base da agenda de vistorias de Saída."},
    [col("TP_VALIDACAO", "text", desc=f"Como a presença do assessor é validada por padrão: {VALIDACAO}."),
     col("VL_LATITUDE", "numeric(9,6)", False, "Latitude da sede, centro do raio de presença."),
     col("VL_LONGITUDE", "numeric(9,6)", False, "Longitude da sede."),
     col("QTDE_RAIO_METROS", "smallint", desc="Raio aceito em volta do ponto (padrão 100 m)."),
     col("QTDE_PRECISAO_MAX_METROS", "smallint", desc="Pior precisão de GPS aceita (padrão 50 m)."),
     col("QTDE_MINUTOS_MIN_VISTORIA", "smallint", desc="Duração mínima esperada; abaixo disso a vistoria é sinalizada.")],
    "da política de venda")
T["UNIDADE"] = comum(
    "UNIDADE", ["ID_UNIDADE", "ID_PROPRIEDADE", "CD_UNIDADE", "NM_UNIDADE", "TP_UNIDADE", "SG_ATIVO"],
    {"ID_UNIDADE": "Identificador do chalé, quarto ou suíte.", "ID_PROPRIEDADE": "Pousada dona da unidade.",
     "CD_UNIDADE": "Código curto (ex.: casa-do-mirante), também usado no site.", "NM_UNIDADE": "Nome exibido.",
     "TP_UNIDADE": "CHALE, QUARTO ou SUITE.", "SG_ATIVO": "Unidade inativa some da venda e da agenda de vistorias."},
    [col("DS_ANDAR", "text", False, "Andar ou bloco, para o assessor se localizar."),
     col("TP_VALIDACAO", "text", False, f"Validação desta unidade ({VALIDACAO}); vazio herda da propriedade."),
     col("VL_LATITUDE", "numeric(9,6)", False, "Ponto da unidade; vazio usa o da propriedade."),
     col("VL_LONGITUDE", "numeric(9,6)", False, "Longitude da unidade."),
     col("QTDE_RAIO_METROS", "smallint", False, "Raio próprio; vazio usa o da propriedade."),
     col("TP_SITUACAO", "text", desc="EM_LIMPEZA, LIBERADO, OCUPADO, BLOQUEADO ou MANUTENCAO."),
     col("CD_HASH_QR", "text", uq=True, desc="Hash do código impresso no QR da porta."),
     col("NO_VERSAO_QR", "smallint", desc="Versão do QR; rotacionar invalida as etiquetas antigas."),
     col("DT_ATUALIZACAO", "timestamptz", desc="Última mudança de situação ou de QR.")],
    "da venda")
T["RESERVA"] = comum(
    "RESERVA", ["ID_RESERVA", "CD_RESERVA", "ID_UNIDADE", "DT_CHECKIN", "DT_CHECKOUT", "TP_STATUS"],
    {"ID_RESERVA": "Identificador da estadia vendida.", "CD_RESERVA": "Código mostrado ao hóspede (SE-XXXXXXXX).",
     "ID_UNIDADE": "Unidade reservada.", "DT_CHECKIN": "Dia da entrada: gera a vistoria de Entrada na agenda.",
     "DT_CHECKOUT": "Dia da saída: gera a vistoria de Saída na agenda.",
     "TP_STATUS": "Só reservas CONFIRMADA entram na agenda de vistorias."},
    [], "da venda")
T["BLOQUEIO"] = comum(
    "BLOQUEIO", ["ID_BLOQUEIO", "ID_UNIDADE", "DT_INI", "DT_FIM", "TP_MOTIVO", "DS_OBSERVACAO"],
    {"ID_BLOQUEIO": "Identificador do bloqueio.", "ID_UNIDADE": "Unidade fora da venda.",
     "DT_INI": "Primeira noite bloqueada.", "DT_FIM": "Dia seguinte à última noite; liberar a unidade encerra aqui.",
     "TP_MOTIVO": "A vistoria cria bloqueios MANUTENCAO; CANAL_EXTERNO são estadias do Airbnb/Booking.",
     "DS_OBSERVACAO": "Resumo da ocorrência que motivou o bloqueio."},
    [], "do canal")

T["VST_USUARIO"] = dict(grupo="ace", cols=[
    col("ID_USUARIO", "uuid", pk=True, desc="Mesmo id do login no Supabase Auth (auth.users)."),
    col("NM_USUARIO", "text", desc="Nome completo."),
    col("CD_LOGIN", "text", uq=True, desc="Usuário de acesso (ex.: ana.souza), minúsculo."),
    col("CD_CPF", "text", False, uq=True, desc="CPF só com números; também serve para entrar."),
    col("TP_PERFIL", "text", desc="ASSESSOR (campo), GESTOR ou ADMIN (gestão)."),
    col("SG_ATIVO", "boolean", desc="Inativo não entra no app."),
    col("DT_ACEITE_LGPD", "timestamptz", False, desc="Aceite do termo de uso de localização e fotos."),
    col("DT_CRIACAO", "timestamptz", desc="Cadastro."),
    col("DT_ATUALIZACAO", "timestamptz", desc="Última alteração.")])
T["VST_USUARIO_PROPRIEDADE"] = dict(grupo="ace", cols=[
    col("ID_USUARIO", "uuid", pk=True, fk=True, desc="Usuário."),
    col("ID_PROPRIEDADE", "bigint", pk=True, fk=True, desc="Pousada que ele pode ver."),
    col("DT_CRIACAO", "timestamptz", desc="Quando o acesso foi dado.")])
T["VST_LOG_EVENTO"] = dict(grupo="ace", cols=[
    col("ID_LOG_EVENTO", "bigint", pk=True, auto=True, desc="Sequencial."),
    col("ID_USUARIO", "uuid", False, fk=True, desc="Quem fez; vazio para eventos do sistema."),
    col("ID_PROPRIEDADE", "bigint", False, fk=True, desc="Pousada afetada."),
    col("TP_EVENTO", "text", desc="LOGIN, VISTORIA_ENVIADA, SITUACAO_ALTERADA, QR_ROTACIONADO, CADASTRO…"),
    col("NM_ENTIDADE", "text", False, desc="Tabela afetada."),
    col("CD_REGISTRO", "text", False, desc="Id do registro afetado."),
    col("DS_EVENTO", "text", desc="Frase legível para a tela de auditoria."),
    col("DS_DADOS", "jsonb", False, desc="Antes e depois, quando houver."),
    col("DT_EVENTO", "timestamptz", desc="Momento do evento.")])
T["VST_AMBIENTE"] = dict(grupo="cad", cols=[
    col("ID_AMBIENTE", "bigint", pk=True, auto=True, desc="Sequencial."),
    col("ID_UNIDADE", "bigint", fk=True, desc="Unidade do cômodo."),
    col("NM_AMBIENTE", "text", desc="Sala, Quarto, Banheiro, Varanda…"),
    col("NO_ORDEM", "smallint", desc="Ordem de passagem no checklist."),
    col("DS_FOTO_REFERENCIA", "text", False, desc="Caminho no Storage da foto de como deve ficar."),
    col("SG_ATIVO", "boolean", desc="Inativo sai do checklist."),
    col("DT_CRIACAO", "timestamptz", desc="Cadastro.")])
T["VST_ITEM"] = dict(grupo="cad", cols=[
    col("ID_ITEM", "bigint", pk=True, auto=True, desc="Sequencial."),
    col("ID_AMBIENTE", "bigint", fk=True, desc="Cômodo onde o item é conferido."),
    col("NM_ITEM", "text", desc="Ex.: Toalhas de banho, Frigobar."),
    col("DS_ORIENTACAO", "text", False, desc="Como conferir."),
    col("SG_CRITICO", "boolean", desc="Problema em item crítico abre ocorrência CRITICA."),
    col("SG_FOTO_OBRIGATORIA", "boolean", desc="Exige foto mesmo quando está OK."),
    col("QTDE_ESPERADA", "smallint", False, desc="Quantidade que deve haver (contagem)."),
    col("NO_ORDEM", "smallint", desc="Ordem dentro do cômodo."),
    col("SG_ATIVO", "boolean", desc="Inativo sai do checklist.")])
T["VST_TIPO_VISTORIA"] = dict(grupo="apo", cols=[
    col("ID_TIPO_VISTORIA", "bigint", pk=True, auto=True, desc="Sequencial."),
    col("NM_TIPO_VISTORIA", "text", uq=True, desc="Entrada, Saída, Rotina, Manutenção…"),
    col("TP_COMPORTAMENTO", "text", desc="ENTRADA, SAIDA, ROTINA ou MANUTENCAO: regra que o app aplica."),
    col("TP_PERIODICIDADE", "text", False, desc="DIARIA, SEMANAL ou MENSAL (só rotina)."),
    col("SG_EXIGE_ENTRADA", "boolean", desc="Saída exige a vistoria de Entrada da mesma estadia."),
    col("SG_EXIGE_ASSINATURA", "boolean", desc="Pede assinatura no fim."),
    col("SG_ATIVO", "boolean", desc="Inativo some da lista."),
    col("DT_CRIACAO", "timestamptz", desc="Cadastro.")])
T["VST_TIPO_VISTORIA_ITEM"] = dict(grupo="apo", cols=[
    col("ID_TIPO_VISTORIA", "bigint", pk=True, fk=True, desc="Tipo de vistoria."),
    col("ID_ITEM", "bigint", pk=True, fk=True, desc="Item que entra nesse tipo."),
    col("NO_ORDEM", "smallint", False, desc="Ordem própria do tipo; vazio segue a do item.")])
T["VST_VISTORIA"] = dict(grupo="ope", cols=[
    col("ID_VISTORIA", "uuid", pk=True, desc="uuid v7 gerado no celular: funciona offline sem duplicar."),
    col("ID_VISTORIA_ENTRADA", "uuid", False, fk=True, desc="Na Saída, a Entrada da mesma estadia (comparação)."),
    col("ID_USUARIO", "uuid", fk=True, desc="Assessor que fez."),
    col("ID_UNIDADE", "bigint", fk=True, desc="Unidade vistoriada."),
    col("ID_TIPO_VISTORIA", "bigint", fk=True, desc="Tipo aplicado."),
    col("ID_RESERVA", "bigint", False, fk=True, desc="Estadia do site; vazio em rotina e em estadias de canal."),
    col("TP_VALIDACAO", "text", desc=f"Validação usada: {VALIDACAO}."),
    col("DT_INICIO", "timestamptz", desc="Início no celular."),
    col("DT_FIM", "timestamptz", desc="Fim no celular."),
    col("DT_RECEBIMENTO", "timestamptz", desc="Chegada ao servidor (pode ser bem depois, se offline)."),
    col("VL_LATITUDE", "numeric(9,6)", False, desc="Posição no início."),
    col("VL_LONGITUDE", "numeric(9,6)", False, desc="Posição no início."),
    col("QTDE_PRECISAO_METROS", "smallint", False, desc="Precisão do GPS."),
    col("QTDE_DISTANCIA_METROS", "integer", False, desc="Distância até o ponto da unidade."),
    col("SG_FORA_RAIO", "boolean", desc="Começou fora do raio aceito."),
    col("TP_STATUS", "text", desc="ENVIADA ou SINALIZADA (algo fora do padrão)."),
    col("DS_SINALIZACOES", "text[]", False, desc="Motivos: FORA_RAIO, RAPIDA, GPS_IMPRECISO, SEM_ENTRADA…"),
    col("DS_ASSINATURA", "text", False, desc="Caminho no Storage da assinatura."),
    col("TP_SITUACAO_RESULTANTE", "text", desc="Situação em que a unidade ficou (LIBERADO, MANUTENCAO…)."),
    col("DS_OBSERVACAO", "text", False, desc="Observação geral.")])
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
    col("ID_FOTO", "uuid", pk=True, desc="uuid v7 gerado no celular."),
    col("ID_VISTORIA", "uuid", fk=True, desc="Vistoria (com ID_ITEM, aponta a resposta)."),
    col("ID_ITEM", "bigint", fk=True, desc="Item fotografado."),
    col("CD_ARQUIVO", "text", uq=True, desc="Caminho no Storage (bucket privado)."),
    col("VL_LATITUDE", "numeric(9,6)", False, desc="Onde foi tirada."),
    col("VL_LONGITUDE", "numeric(9,6)", False, desc="Onde foi tirada."),
    col("QTDE_PRECISAO_METROS", "smallint", False, desc="Precisão do GPS."),
    col("SG_FORA_RAIO", "boolean", desc="Tirada fora do raio."),
    col("DT_CAPTURA", "timestamptz", desc="Momento da câmera, não do envio.")])

# ---------------------------------------------------------------- geometria
W, HDR, RH = 310, 40, 19
X = [56, 496, 936, 1376, 1816]
FUNDO1, FUNDO2 = 1085, 1108
LARG, ALT = X[4] + W + 68, FUNDO2 + 24
POS = {
    "VST_USUARIO": (X[0], 40), "VST_USUARIO_PROPRIEDADE": (X[0], 300), "VST_LOG_EVENTO": (X[0], 446),
    "PROPRIEDADE": (X[1], 40), "BLOQUEIO": (X[1], 380),
    "RESERVA": (X[2], 40), "UNIDADE": (X[2], 262), "VST_AMBIENTE": (X[2], 655), "VST_ITEM": (X[2], 858),
    "VST_VISTORIA": (X[3], 40), "VST_RESPOSTA": (X[3], 490), "VST_OCORRENCIA": (X[3], 693),
    "VST_TIPO_VISTORIA": (X[4], 116), "VST_TIPO_VISTORIA_ITEM": (X[4], 330), "VST_FOTO": (X[4], 471),
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
E = [  # filho, campo, pai, chave, rótulo, pontos (porta do filho primeiro)
    ("UNIDADE", "ID_PROPRIEDADE", "PROPRIEDADE", "ID_PROPRIEDADE", "pertence a", lig("UNIDADE", "ID_PROPRIEDADE", "PROPRIEDADE", "ID_PROPRIEDADE", c12 + 74, "e", "d")),
    ("RESERVA", "ID_UNIDADE", "UNIDADE", "ID_UNIDADE", "reserva", lig("RESERVA", "ID_UNIDADE", "UNIDADE", "ID_UNIDADE", c23 + 24, "d", "d")),
    ("BLOQUEIO", "ID_UNIDADE", "UNIDADE", "ID_UNIDADE", "bloqueia", lig("BLOQUEIO", "ID_UNIDADE", "UNIDADE", "ID_UNIDADE", c12 + 54, "d", "e")),
    ("VST_OCORRENCIA", "ID_BLOQUEIO", "BLOQUEIO", "ID_BLOQUEIO", "tira da venda",
     [(X[3], ry("VST_OCORRENCIA", "ID_BLOQUEIO")), (c23 + 12, ry("VST_OCORRENCIA", "ID_BLOQUEIO")), (c23 + 12, FUNDO2),
      (c01 + 100, FUNDO2), (c01 + 100, ry("BLOQUEIO", "ID_BLOQUEIO")), (X[1], ry("BLOQUEIO", "ID_BLOQUEIO"))]),
    ("VST_USUARIO_PROPRIEDADE", "ID_USUARIO", "VST_USUARIO", "ID_USUARIO", "acessa", lig("VST_USUARIO_PROPRIEDADE", "ID_USUARIO", "VST_USUARIO", "ID_USUARIO", X[0] - 26, "e", "e")),
    ("VST_USUARIO_PROPRIEDADE", "ID_PROPRIEDADE", "PROPRIEDADE", "ID_PROPRIEDADE", "acesso a", lig("VST_USUARIO_PROPRIEDADE", "ID_PROPRIEDADE", "PROPRIEDADE", "ID_PROPRIEDADE", c01 + 74)),
    ("VST_AMBIENTE", "ID_UNIDADE", "UNIDADE", "ID_UNIDADE", "cômodo de", lig("VST_AMBIENTE", "ID_UNIDADE", "UNIDADE", "ID_UNIDADE", c23 + 36, "d", "d")),
    ("VST_ITEM", "ID_AMBIENTE", "VST_AMBIENTE", "ID_AMBIENTE", "conferido em", lig("VST_ITEM", "ID_AMBIENTE", "VST_AMBIENTE", "ID_AMBIENTE", X[2] - 30, "e", "e")),
    ("VST_TIPO_VISTORIA_ITEM", "ID_TIPO_VISTORIA", "VST_TIPO_VISTORIA", "ID_TIPO_VISTORIA", "compõe", lig("VST_TIPO_VISTORIA_ITEM", "ID_TIPO_VISTORIA", "VST_TIPO_VISTORIA", "ID_TIPO_VISTORIA", c4 + 22, "d", "d")),
    ("VST_TIPO_VISTORIA_ITEM", "ID_ITEM", "VST_ITEM", "ID_ITEM", "inclui",
     [(c4, ry("VST_TIPO_VISTORIA_ITEM", "ID_ITEM")), (c4 + 40, ry("VST_TIPO_VISTORIA_ITEM", "ID_ITEM")), (c4 + 40, FUNDO1),
      (c23 + 108, FUNDO1), (c23 + 108, ry("VST_ITEM", "ID_ITEM")), (c23, ry("VST_ITEM", "ID_ITEM"))]),
    ("VST_VISTORIA", "ID_UNIDADE", "UNIDADE", "ID_UNIDADE", "vistoria de", lig("VST_VISTORIA", "ID_UNIDADE", "UNIDADE", "ID_UNIDADE", c23 + 72, "e", "d")),
    ("VST_VISTORIA", "ID_TIPO_VISTORIA", "VST_TIPO_VISTORIA", "ID_TIPO_VISTORIA", "do tipo", lig("VST_VISTORIA", "ID_TIPO_VISTORIA", "VST_TIPO_VISTORIA", "ID_TIPO_VISTORIA", 0)),
    ("VST_VISTORIA", "ID_USUARIO", "VST_USUARIO", "ID_USUARIO", "feita por",
     [(X[3], ry("VST_VISTORIA", "ID_USUARIO")), (c23 + 104, ry("VST_VISTORIA", "ID_USUARIO")), (c23 + 104, 16),
      (c01 + 34, 16), (c01 + 34, ry("VST_USUARIO", "ID_USUARIO")), (c01, ry("VST_USUARIO", "ID_USUARIO"))]),
    ("VST_VISTORIA", "ID_VISTORIA_ENTRADA", "VST_VISTORIA", "ID_VISTORIA", "entrada de", lig("VST_VISTORIA", "ID_VISTORIA_ENTRADA", "VST_VISTORIA", "ID_VISTORIA", c34 + 26, "d", "d")),
    ("VST_VISTORIA", "ID_RESERVA", "RESERVA", "ID_RESERVA", "da estadia", lig("VST_VISTORIA", "ID_RESERVA", "RESERVA", "ID_RESERVA", c23 + 48, "e", "d")),
    ("VST_RESPOSTA", "ID_VISTORIA", "VST_VISTORIA", "ID_VISTORIA", "responde", lig("VST_RESPOSTA", "ID_VISTORIA", "VST_VISTORIA", "ID_VISTORIA", c34 + 96, "d", "d")),
    ("VST_RESPOSTA", "ID_ITEM", "VST_ITEM", "ID_ITEM", "sobre", lig("VST_RESPOSTA", "ID_ITEM", "VST_ITEM", "ID_ITEM", c23 + 96, "e", "d")),
    ("VST_FOTO", "ID_ITEM", "VST_RESPOSTA", "ID_ITEM", "evidência de", lig("VST_FOTO", "ID_ITEM", "VST_RESPOSTA", "ID_ITEM", 0, "e", "d")),
    ("VST_OCORRENCIA", "ID_ITEM", "VST_RESPOSTA", "ID_ITEM", "nasce de", lig("VST_OCORRENCIA", "ID_ITEM", "VST_RESPOSTA", "ID_ITEM", c34 + 44, "d", "d")),
    ("VST_OCORRENCIA", "ID_UNIDADE", "UNIDADE", "ID_UNIDADE", "na unidade", lig("VST_OCORRENCIA", "ID_UNIDADE", "UNIDADE", "ID_UNIDADE", c23 + 84, "e", "d")),
    ("VST_LOG_EVENTO", "ID_USUARIO", "VST_USUARIO", "ID_USUARIO", "por", lig("VST_LOG_EVENTO", "ID_USUARIO", "VST_USUARIO", "ID_USUARIO", X[0] - 42, "e", "e")),
    ("VST_LOG_EVENTO", "ID_PROPRIEDADE", "PROPRIEDADE", "ID_PROPRIEDADE", "em", lig("VST_LOG_EVENTO", "ID_PROPRIEDADE", "PROPRIEDADE", "ID_PROPRIEDADE", c01 + 90)),
]
# FKs compostas: a outra coluna segue na mesma linha desenhada
COMPOSTAS = {("VST_FOTO", "ID_VISTORIA"), ("VST_OCORRENCIA", "ID_VISTORIA")}
marcadas = {(t, c["n"]) for t, d in T.items() for c in d["cols"] if c["fk"]}
assert marcadas == {(e[0], e[1]) for e in E} | COMPOSTAS, marcadas ^ ({(e[0], e[1]) for e in E} | COMPOSTAS)
for e in E:
    assert any(c["n"] == e[3] and c["pk"] for c in T[e[2]]["cols"]), e
ROTULO_LIVRE = {("VST_VISTORIA", "ID_VISTORIA_ENTRADA"): (c34 + 32, ry("VST_VISTORIA", "ID_VISTORIA_ENTRADA") - 6)}
NOMES_FK = {("VST_VISTORIA", "ID_VISTORIA_ENTRADA"): "FK_VST_VISTORIA_VISTORIA_ENTRADA"}


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
    s = [f'<svg id="der" viewBox="0 0 {LARG} {ALT}" role="img" aria-label="Diagrama entidade-relacionamento das vistorias integrado ao banco do site: PROPRIEDADE, UNIDADE, RESERVA e BLOQUEIO são do site; a VST_VISTORIA liga unidade, tipo, assessor e reserva; respostas, fotos e ocorrências saem dela.">']
    s.append('<g class="edges">')
    for i, (f, c, p, pk, rot, pts) in enumerate(E):
        s.append(f'<g class="edge" data-rel="{f} {p}"><title>{NOMES_FK.get((f, c), f"FK_{f}_{p}")}: {f}.{c} → {p}.{pk}</title>')
        s.append(f'<path class="wire" d="{caminho(i, pts)}"/>')
        s.append('<g class="card">' + marcas(*pts[0], *unit(pts[0], pts[1]), "muitos") +
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
    "PROPRIEDADE": "Tabela do site. A pousada: os horários de check-in e check-out montam a agenda; os campos novos (+) guardam a regra de presença (QR, GPS, raio).",
    "UNIDADE": "Tabela do site. O chalé é o elo entre os dois produtos: vendido pelo site e vistoriado pelo app. Os campos novos (+) guardam a situação operacional, o QR da porta e o ponto de GPS.",
    "RESERVA": "Tabela do site, só leitura para a vistoria. Reservas CONFIRMADA viram a agenda de Entrada (check-in) e Saída (check-out).",
    "BLOQUEIO": "Tabela do site. Uma ocorrência crítica cria aqui um bloqueio MANUTENCAO, que tira as datas da venda no site e nos canais (iCal).",
    "VST_USUARIO": "Quem usa o sistema: assessores no app, gestores e administradores no painel. O mesmo cadastro serve à gestão do site.",
    "VST_USUARIO_PROPRIEDADE": "Quais pousadas cada usuário vê. É a base das regras de acesso (RLS) de todas as tabelas.",
    "VST_LOG_EVENTO": "Auditoria: quem fez o quê e quando (login, envio, mudança de situação, rotação de QR, cadastros).",
    "VST_AMBIENTE": "Cômodos de cada unidade, na ordem em que o assessor percorre.",
    "VST_ITEM": "O que se confere em cada cômodo: crítico, foto obrigatória e quantidade esperada.",
    "VST_TIPO_VISTORIA": "Entrada, Saída, Rotina e Manutenção, com as regras de cada uma.",
    "VST_TIPO_VISTORIA_ITEM": "Quais itens entram em cada tipo de vistoria (o checklist de cada tipo).",
    "VST_VISTORIA": "Uma vistoria feita no celular: quem, onde, quando, presença validada, reserva e situação em que a unidade ficou.",
    "VST_RESPOSTA": "A resposta de cada item: OK, PROBLEMA ou não se aplica.",
    "VST_OCORRENCIA": "Problema encontrado que precisa de tratamento; pode tirar a unidade da venda.",
    "VST_FOTO": "Evidência de uma resposta, com local e horário da câmera.",
}
REGRAS = {
    "PROPRIEDADE": ["Campos novos (+) são acrescentados à tabela do site; nada existente muda.",
                    f"TP_VALIDACAO: {VALIDACAO}.", "Raio entre 10 e 1.000 m; precisão máxima entre 5 e 500 m.",
                    "Substitui a antiga tabela CONFIGURACAO: os parâmetros ficam na pousada."],
    "UNIDADE": ["Campos novos (+) acrescentados à tabela do site; TP_UNIDADE e SG_ATIVO valem para os dois produtos.",
                "TP_SITUACAO: EM_LIMPEZA, LIBERADO, OCUPADO, BLOQUEADO ou MANUTENCAO.",
                "Só muda pela função alterar_situacao_unidade (grava VST_LOG_EVENTO).",
                "CD_HASH_QR único; rotacionar soma 1 em NO_VERSAO_QR.",
                "Latitude e longitude vêm juntas ou ficam vazias juntas."],
    "RESERVA": ["A vistoria só lê: status, datas e unidade.", "Entrada no dia DT_CHECKIN, Saída no dia DT_CHECKOUT.",
                "Estadias do Airbnb e do Booking não estão aqui: chegam como BLOQUEIO CANAL_EXTERNO."],
    "BLOQUEIO": ["Ocorrência crítica cria bloqueio MANUTENCAO de hoje até a liberação.",
                 "Liberar a unidade encerra o bloqueio (DT_FIM = amanhã).",
                 "Reserva confirmada que já existe não é cancelada: o painel avisa o conflito.",
                 "Nenhum campo novo: o vínculo fica em VST_OCORRENCIA.ID_BLOQUEIO."],
    "VST_USUARIO": ["ID_USUARIO = auth.users.id (login do Supabase Auth).", "CD_LOGIN e CD_CPF únicos; CPF com 11 números e dígitos válidos.",
                "TP_PERFIL: ASSESSOR, GESTOR ou ADMIN.", "Inativo não entra (checado no login e nas regras de acesso)."],
    "VST_USUARIO_PROPRIEDADE": ["Chave composta: um acesso por usuário e pousada.", "ADMIN vê todas; os demais só as listadas aqui."],
    "VST_LOG_EVENTO": ["Só inserção: ninguém altera nem apaga.", "Gravado pelas funções do banco, não pelo app."],
    "VST_AMBIENTE": ["Nome único por unidade.", "NO_ORDEM define a ordem do checklist."],
    "VST_ITEM": ["Nome único por cômodo.", "QTDE_ESPERADA ≥ 0 quando informada."],
    "VST_TIPO_VISTORIA": ["TP_COMPORTAMENTO: ENTRADA, SAIDA, ROTINA ou MANUTENCAO.", "TP_PERIODICIDADE só para ROTINA: DIARIA, SEMANAL ou MENSAL."],
    "VST_TIPO_VISTORIA_ITEM": ["Chave composta: o item entra uma vez em cada tipo."],
    "VST_VISTORIA": ["Id uuid v7 gerado no celular: reenviar não duplica.", "DT_FIM ≥ DT_INICIO.",
                 "TP_STATUS: ENVIADA ou SINALIZADA; SINALIZADA exige DS_SINALIZACOES.",
                 "Saída com SG_EXIGE_ENTRADA aponta a Entrada em ID_VISTORIA_ENTRADA.",
                 "ID_RESERVA só aceita reserva da mesma unidade.", "Gravada só pela função enviar_vistoria."],
    "VST_RESPOSTA": ["Chave composta: uma resposta por item na vistoria.", "TP_RESPOSTA: OK, PROBLEMA ou NAO_SE_APLICA.",
                 "PROBLEMA exige DS_OBSERVACAO."],
    "VST_OCORRENCIA": ["Nasce de uma resposta PROBLEMA (FK composta ID_VISTORIA + ID_ITEM).", "TP_GRAVIDADE: BAIXA, MEDIA ou CRITICA; item crítico abre CRITICA.",
                   "TP_STATUS: ABERTA, EM_TRATAMENTO, RESOLVIDA ou CANCELADA; RESOLVIDA exige DT_RESOLUCAO.",
                   "ID_BLOQUEIO preenchido quando a unidade sai da venda."],
    "VST_FOTO": ["Aponta a resposta pela FK composta (ID_VISTORIA + ID_ITEM).", "Arquivo em bucket privado; CD_ARQUIVO único."],
}
ACESSO = {
    "PROPRIEDADE": "Todos leem as pousadas a que têm acesso; ADMIN altera.",
    "UNIDADE": "Leitura por acesso à pousada; situação muda só pela função; GESTOR e ADMIN cadastram.",
    "RESERVA": "Leitura para GESTOR e ADMIN e para o assessor na agenda do dia; escrita só do site.",
    "BLOQUEIO": "Leitura por acesso à pousada; criado e encerrado pelas funções da vistoria.",
    "VST_USUARIO": "Cada um lê o próprio; GESTOR lê a equipe; ADMIN cadastra.",
    "VST_USUARIO_PROPRIEDADE": "ADMIN mantém; cada um lê os próprios acessos.",
    "VST_LOG_EVENTO": "GESTOR e ADMIN leem; só funções inserem.",
    "VST_AMBIENTE": "Leitura por acesso à pousada; GESTOR e ADMIN mantêm.",
    "VST_ITEM": "Leitura por acesso à pousada; GESTOR e ADMIN mantêm.",
    "VST_TIPO_VISTORIA": "Todos leem; ADMIN mantém.",
    "VST_TIPO_VISTORIA_ITEM": "Todos leem; GESTOR e ADMIN mantêm.",
    "VST_VISTORIA": "Assessor lê as próprias; GESTOR e ADMIN leem as da pousada; insere só enviar_vistoria.",
    "VST_RESPOSTA": "Mesma regra da vistoria.",
    "VST_OCORRENCIA": "Leitura por acesso à pousada; GESTOR e ADMIN tratam.",
    "VST_FOTO": "Mesma regra da vistoria; o arquivo sai por link assinado.",
}
INTEGRACAO = [
    ("Cadastro único", "PROPRIEDADE e UNIDADE são as mesmas tabelas do site, no mesmo esquema public. O chalé cadastrado para a venda é o mesmo que o assessor vistoria; a vistoria só acrescenta campos (marcados com +)."),
    ("Manutenção tira da venda", "Ocorrência crítica cria um BLOQUEIO MANUTENCAO. A consultar_disponibilidade do site e o iCal dos canais já respeitam BLOQUEIO: as datas saem da venda sem mudar nada no site."),
    ("Liberar devolve à venda", "Ao liberar a unidade, o bloqueio aberto é encerrado (DT_FIM = amanhã) e as datas voltam a ficar disponíveis."),
    ("Reserva vira agenda", "Reservas CONFIRMADA geram a vistoria de Entrada no DT_CHECKIN e a de Saída no DT_CHECKOUT."),
    ("Saída ligada à estadia", "VST_VISTORIA.ID_RESERVA liga a vistoria à estadia do site. Estadias do Airbnb e do Booking chegam como BLOQUEIO CANAL_EXTERNO, sem reserva: nesse caso o campo fica vazio."),
    ("Mesma equipe", "VST_USUARIO e VST_USUARIO_PROPRIEDADE servem também ao painel do site: um login para os dois produtos."),
    ("Conflito", "Um bloqueio não cancela reserva confirmada que já existe: o painel avisa o gestor para remanejar o hóspede."),
]
FUNCOES = [
    ("enviar_vistoria", "Recebe a vistoria do celular (com respostas e fotos), valida presença e regras, abre ocorrências, cria o bloqueio se preciso e muda a situação da unidade. Reenviar o mesmo id não duplica."),
    ("validar_presenca", "Calcula a distância até o ponto da unidade e diz se está dentro do raio e com precisão aceitável."),
    ("alterar_situacao_unidade", "Única porta para mudar TP_SITUACAO; liberar encerra o bloqueio de manutenção. Grava VST_LOG_EVENTO."),
    ("rotacionar_qr", "Gera novo CD_HASH_QR e soma 1 em NO_VERSAO_QR: etiquetas antigas deixam de valer."),
    ("consultar_disponibilidade (site)", "Função do site que já exclui as datas com BLOQUEIO: por isso a manutenção some da venda sem mudar o site."),
]
PREFIXOS = [("ID_", "identificador"), ("NM_", "nome"), ("DS_", "descrição ou texto livre"), ("DT_", "data ou data e hora"),
            ("HR_", "hora"), ("VL_", "valor (dinheiro, coordenada)"), ("QTDE_", "quantidade"), ("NO_", "número (ordem, versão)"),
            ("CD_", "código"), ("TP_", "lista fixa, valores em MAIÚSCULAS"), ("SG_", "sim/não (boolean)")]
ORDEM = ["UNIDADE", "PROPRIEDADE", "RESERVA", "BLOQUEIO", "VST_VISTORIA", "VST_RESPOSTA", "VST_OCORRENCIA", "VST_FOTO",
         "VST_AMBIENTE", "VST_ITEM", "VST_TIPO_VISTORIA", "VST_TIPO_VISTORIA_ITEM", "VST_USUARIO", "VST_USUARIO_PROPRIEDADE", "VST_LOG_EVENTO"]
assert sorted(ORDEM) == sorted(T)


def ligadas_a(n):
    return sorted(({e[2] for e in E if e[0] == n} | {e[0] for e in E if e[2] == n}) - {n})


def chave(c):
    return " ".join(k for k, on in (("PK", c["pk"]), ("FK", c["fk"]), ("UQ", c["uq"])) if on)


def cartao(n):
    t, g = T[n], T[n]["grupo"]
    proprias = [c for c in t["cols"] if not c["mais"]]
    linhas = "".join(
        f'<tr{" class=add" if c["add"] else ""}><td><code>{c["n"]}</code>{" <b class=novo>+ novo</b>" if c["add"] else ""}</td>'
        f'<td><code>{c["ty"]}</code></td><td>{"sim" if c["req"] else "não"}</td><td>{chave(c) or "—"}</td><td>{esc(c["desc"])}</td></tr>'
        for c in proprias)
    mais = next((c for c in t["cols"] if c["mais"]), None)
    nota = f'<p class="meta">Outros campos do site: {esc(mais["desc"])}. Ver o DER das Reservas.</p>' if mais else ""
    qtd = f'{t["nsite"]} campos no site + {sum(c["add"] for c in proprias)} novos' if g == "site" else f'{len(proprias)} campos'
    return f'''<article class="tcard g-{g}" id="t-{n}" data-t="{n}">
  <header><h3>{n}</h3><span class="chip">{GRUPOS[g]}</span></header>
  <p class="purpose">{esc(PROPOSITO[n])}</p>
  <p class="meta">{qtd} · ligada a {", ".join(ligadas_a(n))}</p>
  <ul>{"".join(f"<li>{esc(r)}</li>" for r in REGRAS[n])}</ul>
  <p class="acesso"><b>Acesso:</b> {esc(ACESSO[n])}</p>
  <details><summary>Campos e descrições</summary>
    <table><thead><tr><th>Campo</th><th>Tipo</th><th>Obrig.</th><th>Chave</th><th>Descrição</th></tr></thead><tbody>{linhas}</tbody></table>{nota}
  </details>
</article>'''


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
figure { margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px; min-width: 0; }
.fbar { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.fbar p { margin: 0; font-size: 13px; color: var(--muted); flex: 1 1 260px; }
.btn { min-height: 44px; display: inline-flex; align-items: center; gap: 8px; padding: 0 16px; border: 1px solid var(--line); border-radius: 8px;
  background: var(--surface); color: var(--fg); font: 500 14px var(--sans); cursor: pointer; }
.btn:hover { border-color: var(--wire); }
.btn.pri { background: var(--fg); border-color: var(--fg); color: var(--bg); }
button:focus-visible, summary:focus-visible { outline: 2px solid var(--fk); outline-offset: 2px; }
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
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 14px; align-items: start; }
.tcard { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px 12px; min-width: 0; scroll-margin-top: 16px; }
.tcard.g-site { border-style: dashed; border-color: var(--wire); }
.tcard.on { border-color: var(--fk); border-style: solid; box-shadow: 0 0 0 1px var(--fk); }
.tcard header { display: flex; justify-content: space-between; align-items: center; gap: 10px; cursor: pointer; }
.tcard h3 { margin: 0; font-family: var(--mono); font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.chip { font-size: 10px; letter-spacing: 0.12em; padding: 2px 8px; border-radius: 99px; color: var(--fg); white-space: nowrap; }
.g-site .chip { background: var(--site); } .g-ace .chip { background: var(--ace); } .g-cad .chip { background: var(--cad); }
.g-ope .chip { background: var(--ope); } .g-apo .chip { background: var(--apo); }
.purpose { margin: 8px 0 4px; }
.meta { margin: 0 0 8px; font-size: 12.5px; color: var(--muted); font-family: var(--mono); overflow-wrap: anywhere; }
.tcard ul { margin: 0; padding-left: 18px; font-size: 13.5px; display: grid; gap: 3px; }
.acesso { margin: 8px 0 0; font-size: 13px; color: var(--muted); } .acesso b { color: var(--fg); font-weight: 600; }
details { margin-top: 4px; font-size: 13px; }
summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; color: var(--fk); font-weight: 500; }
table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
th { text-align: left; font-weight: 500; font-size: 11px; letter-spacing: 0.06em; color: var(--muted); padding: 6px 8px; border-bottom: 1px solid var(--line); }
td { padding: 6px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
td code { font-family: var(--mono); font-size: 11.5px; overflow-wrap: anywhere; }
tr.add td:first-child code { color: var(--add); }
.novo { font: 600 10px var(--sans); color: var(--add); white-space: nowrap; }
@media (max-width: 640px) {
  table, thead, tbody, tr, td { display: block; } thead { display: none; }
  tr { padding: 6px 0; border-bottom: 1px solid var(--line); } td { border: 0; padding: 1px 0; }
  td:nth-child(2)::before { content: "tipo: "; color: var(--muted); } td:nth-child(3)::before { content: "obrigatório: "; color: var(--muted); }
  td:nth-child(4)::before { content: "chave: "; color: var(--muted); }
}
.fn { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 10px 14px; margin: 0; padding: 0; list-style: none; font-size: 13.5px; }
.fn li { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; }
.fn code { font-family: var(--mono); font-size: 12.5px; font-weight: 600; }
.fn span { display: block; color: var(--muted); }
.pref { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; font-size: 13px; }
.pref li { background: var(--surface); border: 1px solid var(--line); border-radius: 99px; padding: 4px 12px; }
.pref code { font-family: var(--mono); font-weight: 600; }
p.nota { margin: 0; font-size: 13.5px; color: var(--muted); max-width: 90ch; }
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
  var cards = [].slice.call(document.querySelectorAll('.tcard'));
  var area = document.getElementById('area'), tela = document.getElementById('tela'), palco = document.getElementById('palco');
  var info = document.getElementById('info'), W = __W__, A = __A__, DADOS = __DADOS__;
  var reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var current = null, aberto = false;
  function vizinhos(name) {
    var n = {};
    edges.forEach(function (e) { var r = e.getAttribute('data-rel').split(' '); if (r.indexOf(name) >= 0) { n[r[0]] = 1; n[r[1]] = 1; } });
    delete n[name]; return Object.keys(n).sort();
  }
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
    if (aberto) mostrarInfo(name);
    if (name && scroll) irPara(name);
  }
  function irPara(name) {
    var el = document.getElementById('t-' + name);
    if (el) el.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' });
  }
  tbls.forEach(function (t) {
    t.addEventListener('click', function () { if (!aberto) select(t.getAttribute('data-t'), true); });
    t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(t.getAttribute('data-t'), !aberto); } });
  });
  // clicar no título do cartão destaca a tabela no diagrama
  cards.forEach(function (c) {
    c.querySelector('header').addEventListener('click', function () {
      var n = c.getAttribute('data-t'); select(n, false, true); area.scrollIntoView({ block: 'nearest', behavior: reduz ? 'auto' : 'smooth' });
      var b = der.querySelector('.tbl[data-t="' + n + '"] .box'), k = der.getBoundingClientRect().width / W;
      area.scrollTo({ left: (+b.getAttribute('x') + 155) * k - area.clientWidth / 2, top: +b.getAttribute('y') * k - 20, behavior: reduz ? 'auto' : 'smooth' });
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
    info.innerHTML = h + '<button type="button" class="btn pri ver" data-ver="' + name + '">Ver campos e regras ›</button></div>';
  }
  info.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ir) { select(b.dataset.ir, false, true); centrar(b.dataset.ir); }
    if (b.dataset.ver) {
      var n = b.dataset.ver, c = document.getElementById('t-' + n); fechar();
      if (c) c.querySelector('details').open = true;
      requestAnimationFrame(function () { irPara(n); });
    }
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
    ncols = sum(1 for t in T.values() for c in t["cols"] if not c["mais"])
    novos = sum(c["add"] for t in T.values() for c in t["cols"])
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
      <p class="sub">Solar do Espinhaço · integrado ao banco de reservas do site · PostgreSQL (Supabase), esquema public · {VERSAO}</p>
    </div>
    <div class="stats"><span><b>{len(T)}</b> tabelas</span><span><b>4</b> do site</span><span><b>{ncols}</b> campos</span><span><b>{novos}</b> novos no site</span><span><b>{len(E)}</b> ligações</span></div>
  </header>

  <div class="legend" aria-label="Legenda">
    <span class="it"><span class="k kp">PK</span> chave primária</span>
    <span class="it"><span class="k kf">FK</span> chave estrangeira</span>
    <span class="it"><span class="k">CAMPO?</span> opcional</span>
    <span class="it"><span class="k ka">+ CAMPO</span> novo numa tabela do site</span>
    <span class="it"><span class="k">auto · gerado</span> preenchido pelo banco</span>
    {leg}
    {grupos}
  </div>

  <figure>
    <div class="fbar">
      <p>Tabelas tracejadas são do site (mesmo banco). Clique numa tabela para destacar as ligações e ir às regras dela.</p>
      <button type="button" class="btn pri" id="abrir"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>Tela cheia</button>
    </div>
    <div class="scroll" id="area">
{svg()}
    </div>
    <figcaption>A UNIDADE é o elo entre os dois produtos: o site a vende, o app a vistoria. A VST_VISTORIA aponta a unidade, o tipo, o assessor e, quando houver, a RESERVA; respostas, fotos e ocorrências saem dela. Uma ocorrência crítica cria um BLOQUEIO, que tira as datas da venda. Passe o mouse numa linha para ver o nome da FK.</figcaption>
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

  <h2>Regras e campos de cada tabela</h2>
  <div class="cards">
{chr(10).join(cartao(n) for n in ORDEM)}
  </div>

  <h2>Funções do banco</h2>
  <ul class="fn">
    {"".join(f"<li><code>{esc(a)}</code><span>{esc(b)}</span></li>" for a, b in FUNCOES)}
  </ul>

  <h2>Nomenclatura</h2>
  <p class="nota">Mesmo padrão do banco do site (site/database/README.md): tabelas da vistoria com o prefixo VST_ (as do site ficam sem prefixo), tabelas no singular, nomes em MAIÚSCULAS, valores de TP_ em MAIÚSCULAS, restrições PK_, FK_&lt;FILHA&gt;_&lt;PAI&gt;, UQ_, CK_ e IX_. Ids bigint identity; uuid v7 onde o celular cria o registro offline (VST_VISTORIA, VST_FOTO).</p>
  <ul class="pref">{"".join(f"<li><code>{a}</code> {esc(b)}</li>" for a, b in PREFIXOS)}</ul>
</div>

<script>{js}</script>
'''


def markdown():
    l = ["# Dicionário de dados — Vistorias\n",
         f"Integrado ao banco de reservas do site (mesmo Supabase, esquema `public`): {len(T)} tabelas, 4 delas do site, e {len(E)} ligações. Diagrama em [`der.html`](./der.html). {VERSAO}.\n",
         "Gerado por `tools/gerar-der.py`, que lê as tabelas do site em `site/database/schema.sql`.\n",
         "## Integração com o site\n"]
    l += [f"- **{a}.** {b}" for a, b in INTEGRACAO]
    l += ["", "## Nomenclatura\n", "Tabelas da vistoria levam o prefixo `VST_` (ex.: `VST_VISTORIA`); as do site (`PROPRIEDADE`, `UNIDADE`, `RESERVA`, `BLOQUEIO`) ficam sem prefixo. Mesmo padrão do site: " + ", ".join(f"`{a}` {b}" for a, b in PREFIXOS) + ". Restrições `PK_`, `FK_<FILHA>_<PAI>`, `UQ_`, `CK_`, `IX_`.\n"]
    for n in ORDEM:
        t = T[n]
        l += [f"## `{n}` ({GRUPOS[t['grupo']]})\n", PROPOSITO[n] + "\n", f"- **Ligada a:** {', '.join(ligadas_a(n))}",
              f"- **Acesso (RLS):** {ACESSO[n]}", "- **Regras:** " + " ".join(REGRAS[n]) + "\n",
              "| Campo | Tipo | Obrigatório | Chave | Descrição |", "|---|---|---|---|---|"]
        for c in t["cols"]:
            if c["mais"]:
                l.append(f"| _{c['n']}_ | | | | {c['desc']} |")
            else:
                l.append(f"| `{c['n']}`{' **+ novo**' if c['add'] else ''} | `{c['ty']}` | {'sim' if c['req'] else 'não'} | {chave(c) or '—'} | {c['desc']} |")
        l.append("")
    l += ["## Ligações\n", "| Filha | Campo | Pai | Obrigatória | Leitura |", "|---|---|---|---|---|"]
    l += [f"| `{f}` | {'`ID_VISTORIA` + ' if (f, 'ID_VISTORIA') in COMPOSTAS else ''}`{c}` | `{p}` | {'sim' if obrig(f, c) else 'não'} | {r} |" for f, c, p, pk, r, _ in E]
    l += ["", "`VST_USUARIO.ID_USUARIO` também referencia `auth.users` (Supabase Auth).", ""]
    return "\n".join(l)


if __name__ == "__main__":
    (APP / "database").mkdir(exist_ok=True)
    (APP / "database" / "der.html").write_text(pagina(), encoding="utf-8")
    (APP / "database" / "dicionario-de-dados.md").write_text(markdown(), encoding="utf-8")
    print(f"ok: {len(T)} tabelas, {len(E)} ligações")
