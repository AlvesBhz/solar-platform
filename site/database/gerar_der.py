# Gera o DER (der.html) a partir da estrutura extraída do banco (schema.json com tabelas, campos e FKs).
# Uso: python3 gerar_der.py schema.json der.html exemplos.json [--completo]
# schema.json: saída de exportar_estrutura.sql · exemplos.json: saída de exportar_exemplos.sql,
# num banco de teste depois de rodar exemplos_der.sql.
import json, sys, html
schema = json.load(open(sys.argv[1]))
out = sys.argv[2]
EX = json.load(open(sys.argv[3]))
# campos em maiúsculas (schema "SE") ou minúsculas: lê tudo do mesmo jeito
EX = {t: [{k.lower(): v for k, v in r.items()} for r in (rows or [])] for t, rows in EX.items()}
COMPLETO = '--completo' in sys.argv
T = {t['name']: t for t in schema['tables']}
W, HDR, RH = 330, 40, 19
C0, C1, C2, C3 = 20, 440, 860, 1280

POS = {
  'SIT_TARIFA': (C0, 20), 'SIT_PROPRIEDADE': (C0, 379), 'SIT_UNIDADE': (C1, 360), 'SIT_AJUSTE_DIARIO': (C1, 680),
  'SIT_RESERVA': (C2, 40), 'SIT_BLOQUEIO': (C2, 595),
  'SIT_PAGAMENTO': (C3, 21), 'SIT_HOSPEDE': (C3, 420), 'SIT_CALENDARIO_EXTERNO': (C3, 690),
}
GROUP = {'SIT_PROPRIEDADE': 'cad', 'SIT_UNIDADE': 'cad', 'SIT_TARIFA': 'pre', 'SIT_AJUSTE_DIARIO': 'pre',
         'SIT_RESERVA': 'ven', 'SIT_HOSPEDE': 'ven', 'SIT_PAGAMENTO': 'ven', 'SIT_CALENDARIO_EXTERNO': 'can', 'SIT_BLOQUEIO': 'can'}
GNAME = {'cad': 'CADASTRO', 'pre': 'PREÇO', 'ven': 'VENDA', 'can': 'CANAIS'}

def idx(t, c):
    return [x['n'] for x in T[t]['cols']].index(c)
def ry(t, c):
    return POS[t][1] + HDR + idx(t, c) * RH + RH / 2
def bottom(t):
    return POS[t][1] + HDR + len(T[t]['cols']) * RH

# ligações: filho.campo -> pai.campo, pontos (porta do filho primeiro), rótulo e posição do rótulo
L = [
  dict(c='SIT_UNIDADE', f='ID_PROPRIEDADE', p='SIT_PROPRIEDADE', pk='ID_PROPRIEDADE', lbl='pertence a', lp=(370, None, 'mid'),
       pts=lambda: [(C1, ry('SIT_UNIDADE','ID_PROPRIEDADE')), (C0+W, ry('SIT_UNIDADE','ID_PROPRIEDADE'))]),
  dict(c='SIT_TARIFA', f='ID_UNIDADE', p='SIT_UNIDADE', pk='ID_UNIDADE', lbl='preço de',
       pts=lambda: [(C0+W, ry('SIT_TARIFA','ID_UNIDADE')), (C1-30, ry('SIT_TARIFA','ID_UNIDADE')), (C1-30, ry('SIT_UNIDADE','ID_UNIDADE')), (C1, ry('SIT_UNIDADE','ID_UNIDADE'))]),
  dict(c='SIT_AJUSTE_DIARIO', f='ID_UNIDADE', p='SIT_UNIDADE', pk='ID_UNIDADE', lbl='exceção de',
       pts=lambda: [(C1+W, ry('SIT_AJUSTE_DIARIO','ID_UNIDADE')), (C1+W+16, ry('SIT_AJUSTE_DIARIO','ID_UNIDADE')), (C1+W+16, ry('SIT_UNIDADE','ID_UNIDADE')), (C1+W, ry('SIT_UNIDADE','ID_UNIDADE'))]),
  dict(c='SIT_RESERVA', f='ID_UNIDADE', p='SIT_UNIDADE', pk='ID_UNIDADE', lbl='reserva',
       pts=lambda: [(C2, ry('SIT_RESERVA','ID_UNIDADE')), (C2-26, ry('SIT_RESERVA','ID_UNIDADE')), (C2-26, ry('SIT_UNIDADE','ID_UNIDADE')), (C1+W, ry('SIT_UNIDADE','ID_UNIDADE'))]),
  dict(c='SIT_BLOQUEIO', f='ID_UNIDADE', p='SIT_UNIDADE', pk='ID_UNIDADE', lbl='bloqueia',
       pts=lambda: [(C2, ry('SIT_BLOQUEIO','ID_UNIDADE')), (C2-46, ry('SIT_BLOQUEIO','ID_UNIDADE')), (C2-46, ry('SIT_UNIDADE','ID_UNIDADE')), (C1+W, ry('SIT_UNIDADE','ID_UNIDADE'))]),
  dict(c='SIT_CALENDARIO_EXTERNO', f='ID_UNIDADE', p='SIT_UNIDADE', pk='ID_UNIDADE', lbl='canal de',
       pts=lambda: [(C3, ry('SIT_CALENDARIO_EXTERNO','ID_UNIDADE')), (C3-40, ry('SIT_CALENDARIO_EXTERNO','ID_UNIDADE')), (C3-40, 852), (C1+W+31, 852), (C1+W+31, ry('SIT_UNIDADE','ID_UNIDADE')), (C1+W, ry('SIT_UNIDADE','ID_UNIDADE'))]),
  dict(c='SIT_BLOQUEIO', f='ID_CALENDARIO', p='SIT_CALENDARIO_EXTERNO', pk='ID_CALENDARIO', lbl='importado de',
       pts=lambda: [(C2+W, ry('SIT_BLOQUEIO','ID_CALENDARIO')), (C3, ry('SIT_BLOQUEIO','ID_CALENDARIO'))]),
  dict(c='SIT_RESERVA', f='ID_HOSPEDE', p='SIT_HOSPEDE', pk='ID_HOSPEDE', lbl='feita por', bridge='SELF',
       pts=lambda: [(C2+W, ry('SIT_RESERVA','ID_HOSPEDE')), (C3-40, ry('SIT_RESERVA','ID_HOSPEDE')), (C3-40, ry('SIT_HOSPEDE','ID_HOSPEDE')), (C3, ry('SIT_HOSPEDE','ID_HOSPEDE'))]),
  dict(c='SIT_PAGAMENTO', f='ID_RESERVA', p='SIT_RESERVA', pk='ID_RESERVA', lbl='paga',
       pts=lambda: [(C3, ry('SIT_PAGAMENTO','ID_RESERVA')), (C2+W, ry('SIT_PAGAMENTO','ID_RESERVA'))]),
  dict(c='SIT_RESERVA', f='ID_RESERVA_ORIGINAL', p='SIT_RESERVA', pk='ID_RESERVA', lbl='remarcada de',
       pts=lambda: [(C2+W, ry('SIT_RESERVA','ID_RESERVA_ORIGINAL')), (C2+W+24, ry('SIT_RESERVA','ID_RESERVA_ORIGINAL')), (C2+W+24, ry('SIT_RESERVA','ID_RESERVA')), (C2+W, ry('SIT_RESERVA','ID_RESERVA'))]),
]
# confere com as FKs reais do banco
real = {(f['from'], f['col'], f['to'], f['tocol']) for f in schema['fks']}
mine = {(l['c'], l['f'], l['p'], l['pk']) for l in L}
assert real == mine, (real ^ mine)

for _t in T.values():
    for _c in _t['cols']:
        if _c['gen']: _c['req'] = True
def nullable(t, c):
    return not T[t]['cols'][idx(t, c)]['req']

def ends(x, y, dx, kind):
    """marcas de cardinalidade na porta (x,y); dx = +1 se a linha sai para a direita"""
    s = []
    if kind == 'many0':   # zero ou muitos (lado filho)
        s.append(f'<path d="M{x+dx*12},{y} L{x},{y-6} M{x+dx*12},{y} L{x},{y} M{x+dx*12},{y} L{x},{y+6}"/>')
        s.append(f'<circle cx="{x+dx*18}" cy="{y}" r="3.5" class="hollow"/>')
    elif kind == 'one':   # exatamente um (lado pai)
        s.append(f'<path d="M{x+dx*7},{y-6} L{x+dx*7},{y+6} M{x+dx*12},{y-6} L{x+dx*12},{y+6}"/>')
    elif kind == 'one0':  # zero ou um
        s.append(f'<path d="M{x+dx*7},{y-6} L{x+dx*7},{y+6}"/>')
        s.append(f'<circle cx="{x+dx*15}" cy="{y}" r="3.5" class="hollow"/>')
    return ''.join(s)

def esc(s): return html.escape(str(s), quote=True)

svg = []
VW, VH = C3 + W + 20, 880
svg.append(f'<svg id="der" viewBox="0 0 {VW} {VH}" role="img" aria-label="Diagrama entidade-relacionamento do banco de reservas: a SIT_UNIDADE (chalé) no centro, ligada à SIT_PROPRIEDADE, às tarifas, ajustes, reservas, bloqueios e calendários externos; a SIT_RESERVA liga hóspede, pagamentos e a reserva original de uma remarcação.">')

# ligações primeiro (ficam atrás das tabelas)
svg.append('<g class="edges">')
for i, l in enumerate(L):
    pts = l['pts']()
    d = 'M' + ' L'.join(f'{x},{y}' for x, y in pts)
    rel = f"{l['c']} {l['p']}"
    svg.append(f'<g class="edge" data-rel="{rel}"><title>FK_{l["c"]}_{l["p"] if l["f"] != "ID_RESERVA_ORIGINAL" else "RESERVA_ORIGINAL"}: {l["c"]}.{l["f"]} → {l["p"]}.{l["pk"]}</title>')
    if l.get('bridge'):
        bx = C2 + W + 24; (x0, y0), (x1, y1) = pts[0], pts[1]
        d = f'M{x0},{y0} L{bx-5},{y0} Q{bx},{y0-8} {bx+5},{y0} L' + ' L'.join(f'{x},{y}' for x, y in pts[1:])
    svg.append(f'<path class="wire" d="{d}"/>')
    (cx, cy), (cx2, _) = pts[0], pts[1]
    dxc = 1 if cx2 > cx else -1
    (px, py), (px2, _) = pts[-1], pts[-2]
    dxp = 1 if px2 > px else -1
    svg.append('<g class="card">' + ends(cx, cy, dxc, 'many0') + ends(px, py, dxp, 'one0' if nullable(l['c'], l['f']) else 'one') + '</g>')
    # rótulo no meio do segmento mais longo
    segs = list(zip(pts, pts[1:]))
    a, b = max(segs, key=lambda s: abs(s[0][0]-s[1][0]) + abs(s[0][1]-s[1][1]))
    mx, my = (a[0]+b[0])/2, (a[1]+b[1])/2
    if a[0] == b[0]:  # vertical
        svg.append(f'<text class="elabel" x="{mx}" y="{my}" transform="rotate(-90 {mx} {my})" dy="-5" text-anchor="middle">{esc(l["lbl"])}</text>')
    else:
        svg.append(f'<text class="elabel" x="{mx}" y="{my}" dy="-6" text-anchor="middle">{esc(l["lbl"])}</text>')
    svg.append('</g>')
svg.append('</g>')

# tabelas
for name, (x, y) in POS.items():
    t = T[name]; h = HDR + len(t['cols']) * RH; g = GROUP[name]
    svg.append(f'<g class="tbl g-{g}" data-t="{name}" tabindex="0" role="button" aria-label="Tabela {name}">')
    svg.append(f'<rect class="box" x="{x}" y="{y}" width="{W}" height="{h}" rx="6"/>')
    svg.append(f'<path class="head" d="M{x},{y+HDR} V{y+6} Q{x},{y} {x+6},{y} H{x+W-6} Q{x+W},{y} {x+W},{y+6} V{y+HDR} Z"/>')
    svg.append(f'<text class="tname" x="{x+12}" y="{y+25}">{name}</text>')
    svg.append(f'<text class="tgroup" x="{x+W-12}" y="{y+25}" text-anchor="end">{GNAME[g]}</text>')
    for i, c in enumerate(t['cols']):
        yy = y + HDR + i * RH
        if i % 2 == 1:
            svg.append(f'<rect class="zebra" x="{x+1}" y="{yy}" width="{W-2}" height="{RH}"/>')
        keys = []
        if c['pk']: keys.append('<tspan class="kpk">PK</tspan>')
        if c['fk']: keys.append('<tspan class="kfk">FK</tspan>')
        if keys:
            svg.append(f'<text class="key" x="{x+10}" y="{yy+13.5}">{" ".join(keys)}</text>')
        cls = 'cname' + ('' if c['req'] else ' opt')
        svg.append(f'<text class="{cls}" x="{x+44}" y="{yy+13.5}">{c["n"]}{"" if c["req"] else "?"}</text>')
        ty = c['ty'].replace('timestamptz', 'timestamptz')
        tag = ' · gerado' if c['gen'] else (' · auto' if c['ident'] else '')
        svg.append(f'<text class="ctype" x="{x+W-10}" y="{yy+13.5}" text-anchor="end">{ty}{tag}</text>')
    svg.append('</g>')
svg.append('</svg>')

PURPOSE = {
 'SIT_PROPRIEDADE': 'A pousada: horários, idade de criança, estadia máxima, sinal, tempo para concluir a reserva no site, remarcação, prazo de arrependimento e versão da política de cancelamento.',
 'SIT_UNIDADE': 'Cada chalé (hoje, só a Casa do Mirante): capacidade, com bebês contando como criança na ocupação, e taxa de limpeza.',
 'SIT_TARIFA': 'Preço por período. Onde duas tarifas cobrem a mesma noite, vale a de maior prioridade.',
 'SIT_AJUSTE_DIARIO': 'Exceção de uma data: preço especial, mínimo de noites, noite fechada, sem chegada ou sem saída.',
 'SIT_HOSPEDE': 'Quem reserva: nome, contato e o documento exigido pela FNRH digital (CPF para brasileiro, passaporte para estrangeiro).',
 'SIT_RESERVA': 'Estadia reservada pelo site (ou por telefone/contato direto), com preço, sinal e saldo gravados no momento da reserva. O site não cobra: depois da confirmação a equipe entra em contato para o pagamento.',
 'SIT_PAGAMENTO': 'Pagamentos da reserva. Hoje a equipe lança o que recebe fora do site (sinal combinado depois da reserva e saldo no check-in); a estrutura já aceita pagamento online (Mercado Pago) no futuro, sem mudar a tabela.',
 'SIT_CALENDARIO_EXTERNO': 'Link iCal do Airbnb e do Booking, lido periodicamente.',
 'SIT_BLOQUEIO': 'Datas fora da venda: reservas dos canais, manutenção e uso próprio.',
}
RULES = {
 'SIT_PROPRIEDADE': ['Idade do bebê menor que a de criança (hoje: bebê até 1 ano, criança até 13).', 'Estadia máxima entre 1 e 365 noites (hoje 7).', 'Sinal entre 0% e 100% (hoje 50%).', 'Pré-reserva entre 5 e 1.440 minutos (hoje 30).', 'Prazo de remarcação ≥ 0 dias e validade do crédito ≥ 1 mês.', 'Prazo de arrependimento ≥ 7 dias (mínimo do CDC, art. 49).'],
 'SIT_UNIDADE': ['CD_UNIDADE único, só letras minúsculas, números e hífen.', 'TP_UNIDADE: CHALE, QUARTO ou SUITE.', 'Capacidades: hóspedes e adultos ≥ 1, crianças ≥ 0. Bebês contam em QTDE_MAX_CRIANCAS e em QTDE_MAX_HOSPEDES.', 'Taxa de limpeza ≥ 0.'],
 'SIT_TARIFA': ['DT_FIM depois de DT_INI.', 'Valores ≥ 0; adultos inclusos e mínimo de noites ≥ 1.', 'VL_BEBE = R$ 0: bebê não paga, mas ocupa vaga de criança.', 'Duas tarifas ativas com a mesma prioridade não cobrem a mesma noite (EX_SIT_TARIFA_SOBREPOSICAO).'],
 'SIT_AJUSTE_DIARIO': ['Chave composta: um ajuste por chalé e data (ID_UNIDADE + DT_REF).', 'Valor ≥ 0 e mínimo de noites ≥ 1.'],
 'SIT_HOSPEDE': ['E-mail único, sem diferenciar maiúsculas de minúsculas.', 'Brasileiro (SG_NACIONALIDADE = BR) exige CD_CPF; estrangeiro exige CD_PASSAPORTE.', 'CPF: 11 dígitos sem pontuação, com dígitos verificadores conferidos; único.', 'Passaporte: 5 a 20 letras maiúsculas e números, sempre com SG_PAIS_PASSAPORTE e DT_VALIDADE_PASSAPORTE; único por país.', 'Validade depois da emissão. Reserva ativa de estrangeiro é recusada se o passaporte vence antes da saída (TG_SIT_RESERVA_PASSAPORTE).', 'O CPF não é a chave: ID_HOSPEDE segue como número interno (estrangeiro não tem CPF; LGPD).'],
 'SIT_RESERVA': ['CD_RESERVA único.', 'DT_CHECKOUT depois de DT_CHECKIN; pelo menos 1 adulto.', 'TP_STATUS: PENDENTE, CONFIRMADA, CANCELADA, EXPIRADA ou REMARCADA.', 'TP_CANAL: SITE, DIRETO ou TELEFONE.', 'Sinal ≤ total.', 'PENDENTE (pré-reserva de 30 minutos enquanto o hóspede preenche a reserva) exige DT_EXPIRA; CONFIRMADA exige hóspede.', 'Reserva do site só fica CONFIRMADA com a política aceita (DT_ACEITE_POLITICA e NO_VERSAO_POLITICA); quem confirma é a função confirmar_reserva.', 'CANCELADA exige TP_MOTIVO_CANCELAMENTO: ARREPENDIMENTO, DESISTENCIA, FORCA_MAIOR, NAO_COMPARECIMENTO, SEM_PAGAMENTO (hóspede não pagou quando a equipe entrou em contato) ou POUSADA.', 'Duas reservas PENDENTE ou CONFIRMADA do mesmo chalé nunca ocupam a mesma noite (EX_SIT_RESERVA_SEM_CONFLITO).', 'Hóspede estrangeiro: o passaporte precisa valer até DT_CHECKOUT (TG_SIT_RESERVA_PASSAPORTE).'],
 'SIT_PAGAMENTO': ['Hoje o site não cobra: só há lançamentos MANUAL, feitos pela equipe depois de receber.', 'TP_PROVEDOR: MANUAL ou MERCADO_PAGO (reservado para o pagamento online futuro).', 'TP_PARCELA: SINAL ou SALDO.', 'TP_METODO: PIX, CARTAO_CREDITO, CARTAO_DEBITO, DINHEIRO ou TRANSFERENCIA; dinheiro e transferência só MANUAL.', 'TP_STATUS: PENDENTE, RECEBIDO, RECUSADO, CANCELADO ou ESTORNADO; MANUAL só RECEBIDO ou ESTORNADO, com NM_REGISTRADO_POR.', 'RECEBIDO e ESTORNADO exigem DT_PAGAMENTO; online exige CD_TRANSACAO, único por provedor.'],
 'SIT_CALENDARIO_EXTERNO': ['TP_CANAL: AIRBNB, BOOKING ou OUTRO.', 'Um calendário por canal em cada chalé.'],
 'SIT_BLOQUEIO': ['DT_FIM depois de DT_INI.', 'TP_MOTIVO: CANAL_EXTERNO, MANUTENCAO, USO_PROPRIO ou OUTRO.', 'Só CANAL_EXTERNO tem ID_CALENDARIO, e ele é obrigatório nesse caso.', 'CD_EXTERNO único por calendário.'],
}
CAMPO = {
 'SIT_PROPRIEDADE': {
  'ID_PROPRIEDADE': 'Número interno da pousada, gerado pelo banco.',
  'NM_PROPRIEDADE': 'Nome da pousada mostrado ao hóspede.',
  'DS_FUSO_HORARIO': 'Fuso usado para "hoje", check-in e prazos (America/Sao_Paulo).',
  'HR_CHECKIN': 'Hora a partir da qual o hóspede pode entrar.',
  'HR_CHECKOUT': 'Hora limite para sair.',
  'NO_IDADE_MAX_BEBE': 'Até esta idade é bebê: não paga, mas ocupa vaga de criança.',
  'NO_IDADE_MAX_CRIANCA': 'Até esta idade é criança; acima disso conta como adulto.',
  'QTDE_MAX_NOITES': 'Estadia máxima vendida pelo site.',
  'VL_PERCENTUAL_SINAL': 'Percentual do total cobrado como sinal; a equipe combina o pagamento depois da reserva.',
  'QTDE_MINUTOS_PRE_RESERVA': 'Tempo que as datas ficam seguras enquanto o hóspede preenche a reserva no site.',
  'QTDE_DIAS_LIMITE_REMARCACAO': 'Remarcação permitida até N dias antes do check-in.',
  'QTDE_MESES_VALIDADE_CREDITO': 'Prazo para usar o crédito do sinal numa nova data.',
  'QTDE_DIAS_ARREPENDIMENTO': 'Dias para desistir com reembolso integral (CDC art. 49).',
  'NO_VERSAO_POLITICA': 'Versão vigente da política de cancelamento; vai para a reserva no aceite.',
  'DT_CRIACAO': 'Quando o cadastro foi criado.',
 },
 'SIT_UNIDADE': {
  'ID_UNIDADE': 'Número interno do chalé; é a chave que as outras tabelas usam.',
  'ID_PROPRIEDADE': 'A pousada dona do chalé.',
  'CD_UNIDADE': 'Código público usado pelo site para consultar e reservar.',
  'NM_UNIDADE': 'Nome mostrado ao hóspede.',
  'TP_UNIDADE': 'Tipo: CHALE, QUARTO ou SUITE.',
  'QTDE_MAX_HOSPEDES': 'Total de pessoas, contando adultos, crianças e bebês.',
  'QTDE_MAX_ADULTOS': 'Máximo de adultos (14 anos ou mais).',
  'QTDE_MAX_CRIANCAS': 'Máximo de crianças e bebês somados (sofá-cama).',
  'VL_TAXA_LIMPEZA': 'Taxa única por estadia; hoje R$ 0 (em avaliação).',
  'SG_ATIVO': 'Se o chalé aparece para venda.',
  'NO_ORDEM': 'Ordem de exibição quando houver mais de um chalé.',
  'DT_CRIACAO': 'Quando o cadastro foi criado.',
 },
 'SIT_TARIFA': {
  'ID_TARIFA': 'Número interno da tarifa.',
  'ID_UNIDADE': 'O chalé a que o preço se aplica.',
  'NM_TARIFA': 'Nome para identificar (ex.: Réveillon 2027); aparece no detalhe do preço.',
  'DT_INI': 'Primeira noite coberta.',
  'DT_FIM': 'Dia seguinte à última noite coberta.',
  'NO_PRIORIDADE': 'Quando duas tarifas cobrem a mesma noite, vale a maior.',
  'VL_NOITE': 'Preço da noite para os adultos inclusos.',
  'VL_NOITE_FDS': 'Preço das noites de sexta e sábado; vazio = VL_NOITE.',
  'QTDE_ADULTOS_INCLUSOS': 'Adultos já cobertos pelo VL_NOITE.',
  'VL_ADULTO_EXTRA': 'Por adulto além dos inclusos, por noite.',
  'VL_CRIANCA': 'Por criança (2 a 13 anos), por noite.',
  'VL_BEBE': 'Por bebê, por noite: R$ 0, bebê não paga.',
  'QTDE_MIN_NOITES': 'Mínimo de noites quando a estadia passa por este período.',
  'SG_ATIVO': 'Desligar sem apagar o histórico.',
  'DT_CRIACAO': 'Quando a tarifa foi cadastrada.',
 },
 'SIT_AJUSTE_DIARIO': {
  'ID_UNIDADE': 'O chalé que recebe a exceção.',
  'DT_REF': 'A noite ajustada (uma linha por chalé e data).',
  'VL_NOITE': 'Valor base desta noite no lugar da tarifa; vazio = usa a tarifa.',
  'QTDE_MIN_NOITES': 'Mínimo de noites para estadias que passam por esta data; vazio = o da tarifa.',
  'SG_FECHADO': 'Noite fora da venda: estadia que a inclua é recusada.',
  'SG_SEM_CHEGADA': 'Ninguém faz check-in nesta data.',
  'SG_SEM_SAIDA': 'Ninguém faz check-out nesta data.',
  'DS_OBSERVACAO': 'Motivo, para a equipe lembrar por que existe o ajuste.',
 },
 'SIT_HOSPEDE': {
  'ID_HOSPEDE': 'Número interno do hóspede.',
  'NM_HOSPEDE': 'Nome completo de quem reserva.',
  'DS_EMAIL': 'E-mail para confirmação; único, sem diferenciar maiúsculas.',
  'DS_TELEFONE': 'Telefone/WhatsApp para contato.',
  'SG_NACIONALIDADE': 'País de nacionalidade, 2 letras (BR, US, AR...). Define qual documento é obrigatório.',
  'CD_CPF': 'CPF só com os 11 dígitos; obrigatório para brasileiro, opcional para estrangeiro.',
  'CD_PASSAPORTE': 'Número do passaporte; obrigatório para estrangeiro.',
  'SG_PAIS_PASSAPORTE': 'País que emitiu o passaporte; obrigatório junto com ele.',
  'DT_EMISSAO_PASSAPORTE': 'Data de emissão do passaporte (opcional).',
  'DT_VALIDADE_PASSAPORTE': 'Data de validade; precisa cobrir a estadia até o dia da saída.',
  'DT_CRIACAO': 'Primeiro contato com a pousada.',
 },
 'SIT_RESERVA': {
  'ID_RESERVA': 'Número interno da reserva.',
  'CD_RESERVA': 'Código mostrado ao hóspede (SE- + 8 caracteres aleatórios).',
  'ID_UNIDADE': 'O chalé reservado.',
  'ID_HOSPEDE': 'Quem reservou; vazio só enquanto a pré-reserva não foi concluída.',
  'DT_CHECKIN': 'Dia de chegada.',
  'DT_CHECKOUT': 'Dia de saída (não é cobrado).',
  'QTDE_ADULTOS': 'Adultos (14 anos ou mais).',
  'QTDE_CRIANCAS': 'Crianças de 2 a 13 anos (pagam VL_CRIANCA).',
  'QTDE_BEBES': 'Bebês até 1 ano: ocupam vaga de criança, não pagam.',
  'TP_STATUS': 'PENDENTE (preenchendo no site) → CONFIRMADA (reserva feita, aguardando contato da equipe); ou CANCELADA, EXPIRADA, REMARCADA.',
  'TP_CANAL': 'Por onde entrou: SITE, DIRETO ou TELEFONE.',
  'VL_HOSPEDAGEM': 'Soma das noites, congelada no momento da reserva.',
  'VL_TAXA_LIMPEZA': 'Taxa de limpeza congelada na reserva.',
  'VL_TOTAL': 'Hospedagem + limpeza (calculado pelo banco).',
  'VL_SINAL': 'Sinal de 50%, combinado e recebido pela equipe depois da reserva.',
  'VL_SALDO': 'Total − sinal, pago no check-in (calculado pelo banco).',
  'DS_DETALHE_PRECOS': 'Preço noite a noite, com tarifa, criança e bebê (JSON).',
  'DS_ACOMPANHANTES': 'Nome e sobrenome dos adultos e nome e idade das crianças e bebês que vão junto (JSON); a reserva exige os adultos.',
  'DT_EXPIRA': 'Até quando a pré-reserva segura as datas (30 minutos para concluir no site).',
  'ID_RESERVA_ORIGINAL': 'Em remarcação, a reserva antiga que deu origem a esta.',
  'TP_MOTIVO_CANCELAMENTO': 'Por que foi cancelada; obrigatório só se CANCELADA.',
  'NO_VERSAO_POLITICA': 'Versão da política que o hóspede aceitou.',
  'DT_ACEITE_POLITICA': 'Quando o hóspede marcou o aceite no site.',
  'DT_CRIACAO': 'Quando a reserva foi criada.',
  'DT_ATUALIZACAO': 'Última mudança (status, pagamento).',
 },
 'SIT_PAGAMENTO': {
  'ID_PAGAMENTO': 'Número interno do pagamento.',
  'ID_RESERVA': 'A reserva paga.',
  'TP_PARCELA': 'SINAL (combinado depois da reserva) ou SALDO (no check-in).',
  'TP_PROVEDOR': 'MANUAL (lançado pela equipe, hoje) ou MERCADO_PAGO (pagamento online, quando for integrado).',
  'TP_METODO': 'PIX, CARTAO_CREDITO, CARTAO_DEBITO, DINHEIRO ou TRANSFERENCIA.',
  'VL_PAGAMENTO': 'Valor do pagamento.',
  'TP_STATUS': 'RECEBIDO ou ESTORNADO no manual; PENDENTE, RECUSADO e CANCELADO servem ao pagamento online.',
  'DT_PAGAMENTO': 'Quando o dinheiro entrou; obrigatório se RECEBIDO.',
  'CD_TRANSACAO': 'Id do Pix, autorização do cartão ou id da transação no provedor.',
  'NM_REGISTRADO_POR': 'Quem da equipe lançou (obrigatório no manual).',
  'DS_OBSERVACAO': 'Anotação da equipe (ex.: combinado por WhatsApp).',
  'DT_CRIACAO': 'Quando o lançamento (ou a cobrança online) foi criado.',
 },
 'SIT_CALENDARIO_EXTERNO': {
  'ID_CALENDARIO': 'Número interno do calendário.',
  'ID_UNIDADE': 'O chalé anunciado no canal.',
  'TP_CANAL': 'AIRBNB, BOOKING ou OUTRO.',
  'DS_URL_IMPORTACAO': 'Link iCal exportado pelo canal.',
  'SG_ATIVO': 'Se a leitura periódica está ligada.',
  'DT_ULTIMA_SINCRONIZACAO': 'Última leitura com sucesso.',
  'DS_ULTIMO_ERRO': 'Erro da última leitura, se houver.',
 },
 'SIT_BLOQUEIO': {
  'ID_BLOQUEIO': 'Número interno do bloqueio.',
  'ID_UNIDADE': 'O chalé bloqueado.',
  'DT_INI': 'Primeira noite bloqueada.',
  'DT_FIM': 'Dia seguinte à última noite bloqueada.',
  'TP_MOTIVO': 'CANAL_EXTERNO, MANUTENCAO, USO_PROPRIO ou OUTRO.',
  'ID_CALENDARIO': 'De qual calendário veio (só CANAL_EXTERNO).',
  'CD_EXTERNO': 'Id do evento no iCal, para não importar duas vezes.',
  'DS_OBSERVACAO': 'Anotação da equipe.',
  'DT_CRIACAO': 'Quando foi criado ou importado.',
 },
}

ORDER = ['SIT_PROPRIEDADE', 'SIT_UNIDADE', 'SIT_TARIFA', 'SIT_AJUSTE_DIARIO', 'SIT_RESERVA', 'SIT_HOSPEDE', 'SIT_PAGAMENTO', 'SIT_CALENDARIO_EXTERNO', 'SIT_BLOQUEIO']
cards = []
for n in ORDER:
    t = T[n]; g = GROUP[n]
    links = sorted({l['p'] for l in L if l['c'] == n} | {l['c'] for l in L if l['p'] == n} - {n})
    cards.append(f'''<article class="tcard g-{g}" id="t-{n}" data-t="{n}">
  <header><h3>{n}</h3><span class="chip">{GNAME[g]}</span></header>
  <p class="purpose">{esc(PURPOSE[n])}</p>
  <p class="meta">{len(t['cols'])} campos · ligada a {', '.join(links)}</p>
  <ul>{''.join(f'<li>{esc(r)}</li>' for r in RULES[n])}</ul>
</article>''')

# ── exemplos ────────────────────────────────────────────────────────
from datetime import datetime, timedelta, timezone
BRT = timezone(timedelta(hours=-3))
def brl(v): return 'R$ ' + f'{v:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
def fmt(col, v):
    if v is None: return '<span class="nul">vazio</span>'
    if isinstance(v, bool): return 'sim' if v else 'não'
    if isinstance(v, list) and col == 'DS_DETALHE_PRECOS':
        return f'{len(v)} noites: ' + ' + '.join(brl(x['vl_noite']).replace('R$ ', '') for x in v)
    if isinstance(v, list):  # ex.: DS_ACOMPANHANTES
        return f'{len(v)} pessoas: ' + ', '.join(esc(x.get('nome', '')) for x in v)
    if col.startswith('VL_PERCENTUAL'): return f'{v:g}%'
    if col.startswith('VL_'): return brl(v)
    if isinstance(v, str):
        if len(v) == 10 and v[4] == '-' and v[7] == '-':
            return f'{v[8:10]}/{v[5:7]}/{v[:4]}'
        if col.startswith('DT_') and 'T' in v:
            return datetime.fromisoformat(v).astimezone(BRT).strftime('%d/%m/%Y %H:%M')
        if col.startswith('HR_'): return v[:5]
    return esc(v)
CAP = {
 'SIT_PROPRIEDADE': ['A pousada'], 'SIT_UNIDADE': ['O chalé'],
 'SIT_TARIFA': ['Vale o ano todo', 'Réveillon: prioridade 10 vence a padrão'],
 'SIT_AJUSTE_DIARIO': ['Preço especial num dia', 'Dia sem chegada', 'Noite fechada'],
 'SIT_HOSPEDE': ['Brasileira, com CPF (reserva 1)', 'Estrangeiro, com passaporte (reserva 2)'],
 'SIT_RESERVA': ['1 · Confirmada no site', '2 · Pré-reserva: hóspede preenchendo (30 min)'],
 'SIT_PAGAMENTO': ['Sinal por Pix, lançado pela equipe (reserva 1)'],
 'SIT_CALENDARIO_EXTERNO': ['Airbnb', 'Booking'],
 'SIT_BLOQUEIO': ['Reserva vinda do Airbnb', 'Manutenção'],
}
LONG = lambda v: ' class="long"' if isinstance(v, list) or (isinstance(v, str) and len(v) > 26) else ''
exs = []
for n in ORDER:
    rows = EX[n]; g = GROUP[n]; cols = [c['n'] for c in T[n]['cols']]
    for r in rows: assert set(k.upper() for k in r) == set(cols), (n, set(cols) ^ set(k.upper() for k in r))
    assert len(CAP[n]) == len(rows), n
    head = ''.join(f'<th scope="col">{esc(c)}</th>' for c in CAP[n])
    body = ''.join('<tr><th scope="row">' + c + '</th>' + ''.join(f'<td{LONG(r[c.lower()])}>{fmt(c, r[c.lower()])}</td>' for r in rows) + '</tr>' for c in cols)
    exs.append(f'<section class="ex g-{g}" id="e-{n}" data-t="{n}">\n  <header><h3>{n}</h3><span class="chip">{GNAME[g]}</span></header>\n'
               f'  <div class="tscroll"><table><thead><tr><th scope="col">Campo</th>{head}</tr></thead><tbody>{body}</tbody></table></div>\n</section>')

# passo a passo do SIT_AJUSTE_DIARIO, a partir da reserva 1 gravada no banco
r1 = EX['SIT_RESERVA'][0]
DOW = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']
aj = {a['dt_ref']: a for a in EX['SIT_AJUSTE_DIARIO']}
linhas = []
for x in r1['ds_detalhe_precos']:
    d = datetime.fromisoformat(x['dt_ref']); a = aj.get(x['dt_ref'])
    fonte = f'<b>SIT_AJUSTE_DIARIO</b> (VL_NOITE {brl(a["vl_noite"])})' if a and a['vl_noite'] is not None else f'SIT_TARIFA “{esc(x["nm_tarifa"])}”'
    hl = ' class="hl"' if a else ''
    linhas.append(f'<tr{hl}><td>{d:%d/%m} {DOW[d.weekday()]}</td><td>{fonte}</td><td>{brl(x["vl_base"])}</td><td>{brl(x["vl_criancas"])}</td><td>{brl(x["vl_bebes"])}</td><td><b>{brl(x["vl_noite"])}</b></td></tr>')
ajuste_html = (
 '<section class="explica" id="como-ajuste">\n'
 '  <h2>Como funciona o SIT_AJUSTE_DIARIO</h2>\n'
 '  <p>A <b>SIT_TARIFA</b> dá o preço de um <b>período</b> (ex.: R$ 1.700 de 01/11/2026 a 31/12/2027). O <b>SIT_AJUSTE_DIARIO</b> é a <b>exceção de um dia só</b>: muda o preço ou a regra de venda daquela data sem criar uma tarifa nova. Os campos vazios não mudam nada. Para cada noite, o banco decide assim:</p>\n'
 '  <ol class="ordem"><li>Existe SIT_AJUSTE_DIARIO para a data com VL_NOITE preenchido? Esse é o valor base.</li><li>Senão, vale a SIT_TARIFA ativa de maior NO_PRIORIDADE que cobre a data.</li><li>Criança (VL_CRIANCA) e bebê (VL_BEBE) vêm sempre da tarifa e somam por cima.</li></ol>\n'
 f'  <h3>Exemplo: reserva {esc(r1["cd_reserva"])}, 23 a 26/12/2026, casal + 1 criança + 1 bebê</h3>\n'
 '  <div class="tscroll"><table class="passo"><thead><tr><th>Noite</th><th>De onde vem o preço</th><th>Valor base</th><th>Criança</th><th>Bebê</th><th>Noite</th></tr></thead>\n'
 f'  <tbody>{"".join(linhas)}</tbody>\n'
 f'  <tfoot><tr><td colspan="5">Total da hospedagem, gravado em SIT_RESERVA.VL_HOSPEDAGEM (sinal de 50%: {brl(r1["vl_sinal"])})</td><td><b>{brl(r1["vl_hospedagem"])}</b></td></tr></tfoot></table></div>\n'
 '  <h3>O que cada campo faz (resultado real da consulta no banco de teste)</h3>\n'
 '  <ul class="fn">\n'
 '    <li><code>VL_NOITE = 2.200 em 24/12</code><span>Troca o valor base só da véspera de Natal. As outras noites seguem a tarifa.</span></li>\n'
 '    <li><code>QTDE_MIN_NOITES = 2 em 24/12</code><span>Pedido só de 24 para 25/12 volta como <i>min_noites</i>: quem passa por esse dia fica pelo menos 2 noites.</span></li>\n'
 '    <li><code>SG_SEM_CHEGADA em 06/02/2027</code><span>Check-in em 06/02 volta como <i>sem_chegada</i>. Quem chegou no dia 05 e continua hospedado não é afetado.</span></li>\n'
 '    <li><code>SG_SEM_SAIDA</code><span>O inverso: ninguém faz check-out nessa data.</span></li>\n'
 '    <li><code>SG_FECHADO em 17/03/2027</code><span>Qualquer estadia que inclua a noite de 17/03 volta como <i>fechado</i>.</span></li>\n'
 '  </ul>\n'
 '  <h3>Quando usar cada tabela</h3>\n'
 '  <div class="tscroll"><table class="passo"><thead><tr><th>Situação</th><th>Use</th></tr></thead><tbody>\n'
 '    <tr><td>Preço de uma temporada inteira (Réveillon, Carnaval, julho)</td><td>SIT_TARIFA com prioridade maior</td></tr>\n'
 '    <tr><td>Preço ou regra diferente num único dia (véspera, feriado no meio da semana)</td><td>SIT_AJUSTE_DIARIO</td></tr>\n'
 '    <tr><td>Chalé indisponível: manutenção, uso próprio ou reserva do Airbnb</td><td>SIT_BLOQUEIO</td></tr>\n'
 '  </tbody></table></div>\n'
 '</section>')

# ── painel de detalhe (aparece abaixo do diagrama ao clicar numa tabela) ──
for _n in ORDER:
    assert set(CAMPO[_n]) == {c['n'] for c in T[_n]['cols']}, (_n, set(CAMPO[_n]) ^ {c['n'] for c in T[_n]['cols']})
COND = {('SIT_HOSPEDE', 'CD_CPF'): 'se brasileiro', ('SIT_HOSPEDE', 'CD_PASSAPORTE'): 'se estrangeiro', ('SIT_HOSPEDE', 'SG_PAIS_PASSAPORTE'): 'com passaporte', ('SIT_HOSPEDE', 'DT_VALIDADE_PASSAPORTE'): 'com passaporte'}
paineis = []
for n in ORDER:
    t = T[n]; g = GROUP[n]; rs = EX[n][:2]; caps = CAP[n][:2]
    linhas = []
    for c in t['cols']:
        kk = ('<span class="k kp">PK</span> ' if c['pk'] else '') + ('<span class="k kf">FK</span> ' if c['fk'] else '')
        ob = 'gerado' if c['gen'] else ('auto' if c['ident'] else ('sim' if c['req'] else 'não'))
        ob = COND.get((n, c['n']), ob)
        linhas.append(f'<tr><th scope="row">{kk}{c["n"]}</th><td class="ty">{esc(c["ty"])}</td><td>{ob}</td><td class="ds">{esc(CAMPO[n][c["n"]])}</td>' + ''.join(f'<td class="exv{" long" if LONG(r[c["n"].lower()]) else ""}" data-l="{esc(cp)}">{fmt(c["n"], r[c["n"].lower()])}</td>' for r, cp in zip(rs, caps)) + '</tr>')
    lig = []
    for l in L:
        if l['c'] == n:
            lig.append(f'<li><code>{l["f"]}</code> → {l["p"]} <i>({esc(l["lbl"])})</i>: cada {n} aponta para {"no máximo" if nullable(n, l["f"]) else "exatamente"} 1 {l["p"]}.</li>')
    for l in L:
        if l['p'] == n and l['c'] != n:
            lig.append(f'<li>{l["c"]}.<code>{l["f"]}</code> <i>({esc(l["lbl"])})</i>: cada {n} pode ter zero ou vários {l["c"]}.</li>')
    extra = '<p class="dlink"><a href="#como-ajuste">Ver o passo a passo do cálculo com o ajuste ↓</a></p>' if n == 'SIT_AJUSTE_DIARIO' else ''
    paineis.append(f'''<template id="d-{n}"><div class="dt g-{g}">
  <header><h3>{n}</h3><span class="chip">{GNAME[g]}</span><span class="dmeta">{len(t['cols'])} campos</span><button type="button" class="dclose" aria-label="Fechar detalhe">Fechar ✕</button></header>
  <p class="purpose">{esc(PURPOSE[n])}</p>{extra}
  <div class="dgrid">
    <div class="tscroll"><table class="dtab"><thead><tr><th>Campo</th><th>Tipo</th><th>Obrigatório</th><th>Para que serve</th>{''.join(f'<th>Exemplo: {esc(cp)}</th>' for cp in caps)}</tr></thead><tbody>{''.join(linhas)}</tbody></table></div>
    <aside><div><h4>Ligações</h4><ul>{''.join(lig)}</ul></div><div><h4>Regras</h4><ul>{''.join(f'<li>{esc(r)}</li>' for r in RULES[n])}</ul></div></aside>
  </div>
</div></template>''')

ncols = sum(len(t['cols']) for t in schema['tables'])
page = f'''<title>DER das Reservas</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
<style>
/* Layout: prancheta de engenharia — cabeçalho curto, o diagrama ocupa a largura, regras por tabela embaixo */
:root {{
  --bg: #f3f5f2; --surface: #ffffff; --fg: #1d2622; --muted: #5e6c65; --line: #c8d0cb; --wire: #6d7b74;
  --zebra: #f6f8f6; --pk: #9a5b0b; --fk: #2d6a8a;
  --cad: #dfe8e2; --pre: #efe6d6; --ven: #dde6ef; --can: #e9e1ec;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --bg: #121614; --surface: #1a201d; --fg: #e3e9e5; --muted: #95a39c; --line: #34403a; --wire: #7f8f87;
  --zebra: #1e2521; --pk: #e2a64c; --fk: #74b6d4;
  --cad: #233229; --pre: #352d1f; --ven: #1f2c38; --can: #2e2533; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --bg: #121614; --surface: #1a201d; --fg: #e3e9e5; --muted: #95a39c; --line: #34403a; --wire: #7f8f87;
  --zebra: #1e2521; --pk: #e2a64c; --fk: #74b6d4;
  --cad: #233229; --pre: #352d1f; --ven: #1f2c38; --can: #2e2533; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{ background: var(--bg); color: var(--fg); font-family: var(--sans); font-size: 15px; line-height: 1.5;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 48px; }}
.wrap {{ max-width: 1600px; margin: 0 auto; display: grid; gap: 22px; }}
header.top {{ display: flex; flex-wrap: wrap; gap: 8px 24px; align-items: baseline; justify-content: space-between; }}
h1 {{ font-size: clamp(1.5rem, 1.2rem + 1.2vw, 2.1rem); margin: 0; letter-spacing: -0.01em; text-wrap: balance; }}
.sub {{ color: var(--muted); margin: 4px 0 0; }}
.stats {{ display: flex; flex-wrap: wrap; gap: 6px 18px; font-family: var(--mono); font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }}
.stats b {{ color: var(--fg); font-weight: 600; }}
.legend {{ display: flex; flex-wrap: wrap; gap: 10px 22px; align-items: center; font-size: 13px; color: var(--muted); }}
.legend .it {{ display: inline-flex; align-items: center; gap: 7px; }}
.legend svg {{ color: var(--wire); }}
.sw {{ width: 14px; height: 14px; border-radius: 3px; border: 1px solid var(--line); display: inline-block; }}
.k {{ font-family: var(--mono); font-size: 11px; font-weight: 600; }}
.kp {{ color: var(--pk); }} .kf {{ color: var(--fk); }}
.hint {{ font-size: 13px; color: var(--muted); margin: 0; }}
figure {{ margin: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px; min-width: 0; }}
.scroll {{ overflow-x: auto; -webkit-overflow-scrolling: touch; }}
#der {{ display: block; width: 100%; min-width: 1080px; height: auto; color: var(--wire); }}
figcaption {{ font-size: 13px; color: var(--muted); padding: 10px 2px 0; max-width: 90ch; }}
/* SVG */
#der .box {{ fill: var(--surface); stroke: var(--line); stroke-width: 1; }}
#der .zebra {{ fill: var(--zebra); }}
#der .g-cad .head {{ fill: var(--cad); }} #der .g-pre .head {{ fill: var(--pre); }}
#der .g-ven .head {{ fill: var(--ven); }} #der .g-can .head {{ fill: var(--can); }}
#der .tname {{ fill: var(--fg); font: 600 13.5px var(--sans); letter-spacing: 0.02em; }}
#der .tgroup {{ fill: var(--muted); font: 500 10px var(--sans); letter-spacing: 0.12em; }}
#der .cname {{ fill: var(--fg); font: 500 11.5px var(--mono); }}
#der .cname.opt {{ fill: var(--muted); font-weight: 400; }}
#der .ctype {{ fill: var(--muted); font: 400 10.5px var(--mono); }}
#der .key {{ font: 600 9.5px var(--mono); }}
#der .kpk {{ fill: var(--pk); }} #der .kfk {{ fill: var(--fk); }}
#der .wire {{ fill: none; stroke: currentColor; stroke-width: 1.4; }}
#der .card path {{ fill: none; stroke: currentColor; stroke-width: 1.4; }}
#der .card .hollow {{ fill: var(--surface); stroke: currentColor; stroke-width: 1.3; }}
#der .elabel {{ fill: var(--muted); font: italic 500 11px var(--sans); paint-order: stroke; stroke: var(--surface); stroke-width: 4px; stroke-linejoin: round; }}
#der .tbl {{ cursor: pointer; outline: none; transition: opacity .15s; }}
#der .tbl:focus-visible .box, #der .tbl.on .box {{ stroke: var(--fk); stroke-width: 2; }}
#der .edge {{ transition: opacity .15s; }}
#der.focus .tbl:not(.near), #der.focus .edge:not(.near) {{ opacity: .18; }}
#der.focus .edge.near {{ color: var(--fk); }}
/* cartões */
.cards {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 14px; }}
.tcard {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px 12px; min-width: 0; scroll-margin-top: 16px; }}
.tcard.on {{ border-color: var(--fk); box-shadow: 0 0 0 1px var(--fk); }}
.tcard header {{ display: flex; justify-content: space-between; align-items: center; gap: 10px; }}
.tcard h3 {{ margin: 0; font-family: var(--mono); font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }}
.chip {{ font-size: 10px; letter-spacing: 0.12em; padding: 2px 8px; border-radius: 99px; color: var(--fg); white-space: nowrap; }}
.g-cad .chip {{ background: var(--cad); }} .g-pre .chip {{ background: var(--pre); }} .g-ven .chip {{ background: var(--ven); }} .g-can .chip {{ background: var(--can); }}
.purpose {{ margin: 8px 0 4px; }}
.meta {{ margin: 0 0 8px; font-size: 12.5px; color: var(--muted); font-family: var(--mono); overflow-wrap: anywhere; }}
.tcard ul {{ margin: 0; padding-left: 18px; font-size: 13.5px; display: grid; gap: 3px; }}
/* painel de detalhe */
#detalhe.has {{ padding-top: 14px; max-width: none; color: var(--fg); }}
.dt header {{ display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }}
.dt h3 {{ margin: 0; font-family: var(--mono); font-size: 15px; font-weight: 600; color: var(--fg); }}
.dmeta {{ font-size: 12.5px; color: var(--muted); }}
.dclose {{ margin-left: auto; font: inherit; font-size: 12.5px; color: var(--fg); background: transparent; border: 1px solid var(--line); border-radius: 6px; padding: 3px 10px; cursor: pointer; }}
.dclose:hover {{ border-color: var(--fk); }}
.dt .purpose {{ color: var(--fg); font-size: 14px; margin: 8px 0 10px; max-width: 100ch; }}
.dlink {{ margin: -4px 0 10px; font-size: 13px; }} .dlink a {{ color: var(--fk); }}
.dgrid {{ display: grid; gap: 16px; }}
.dt aside {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 0 28px; }}
.dtab {{ color: var(--fg); }}
.dtab tbody th {{ font-family: var(--mono); font-size: 11.5px; font-weight: 500; white-space: nowrap; }}
.dtab td {{ white-space: nowrap; }}
.dtab td.ds {{ white-space: normal; min-width: 26ch; color: var(--fg); }}
.dtab td.ty {{ font-family: var(--mono); font-size: 11.5px; color: var(--muted); }}
.dtab td.long {{ white-space: normal; overflow-wrap: anywhere; min-width: 20ch; }}
.dtab thead th {{ white-space: normal; }}
.dtab tbody tr:nth-child(even) {{ background: var(--zebra); }}
.dt aside {{ font-size: 13px; color: var(--fg); }}
@media (max-width: 720px) {{
  .dtab thead {{ display: none; }}
  .dtab, .dtab tbody {{ display: block; }}
  .dtab tr {{ display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; padding: 8px 4px; border-bottom: 1px solid var(--line); }}
  .dtab th, .dtab td {{ border: 0; padding: 0; white-space: normal; }}
  .dtab td:nth-child(3) {{ display: none; }}
  .dtab td.ds, .dtab td.exv {{ grid-column: 1 / -1; min-width: 0; }}
  .dtab td.exv::before {{ content: attr(data-l) ": "; color: var(--muted); }}
}}
.dt aside h4 {{ margin: 0 0 4px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }}
.dt aside ul {{ margin: 0 0 14px; padding-left: 18px; display: grid; gap: 4px; }}
.dt aside code {{ font-family: var(--mono); font-size: 12px; }}
/* exemplos */
.explica, .ex {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; min-width: 0; }}
.explica h2 {{ margin-top: 0; }}
.explica h3 {{ font-size: 0.98rem; margin: 18px 0 8px; }}
.explica p {{ margin: 6px 0; max-width: 95ch; }}
.ordem {{ margin: 6px 0 0; padding-left: 22px; display: grid; gap: 2px; }}
.tscroll {{ overflow-x: auto; -webkit-overflow-scrolling: touch; }}
table {{ border-collapse: collapse; font-size: 13px; width: 100%; font-variant-numeric: tabular-nums; }}
th, td {{ text-align: left; padding: 5px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }}
thead th {{ font-size: 12px; color: var(--muted); font-weight: 600; }}
.passo tr.hl td {{ background: var(--pre); }}
.passo tfoot td {{ border-bottom: 0; font-weight: 500; }}
.exs {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 520px), 1fr)); gap: 14px; align-items: start; }}
.ex {{ scroll-margin-top: 16px; }}
.ex.on {{ border-color: var(--fk); box-shadow: 0 0 0 1px var(--fk); }}
.ex header {{ display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 8px; }}
.ex h3 {{ margin: 0; font-family: var(--mono); font-size: 14px; font-weight: 600; }}
.ex tbody th {{ font-family: var(--mono); font-size: 11.5px; font-weight: 500; white-space: nowrap; }}
.ex td {{ white-space: nowrap; }}
.ex td.long {{ white-space: normal; overflow-wrap: anywhere; min-width: 24ch; }}
.ex thead th {{ min-width: 13ch; }}
.ex tbody tr:nth-child(even) {{ background: var(--zebra); }}
.nul {{ color: var(--muted); font-style: italic; }}
h2 {{ font-size: 1.1rem; margin: 6px 0 0; }}
.fn {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); gap: 10px 14px; margin: 0; padding: 0; list-style: none; font-size: 13.5px; }}
.fn li {{ background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px; }}
.fn code {{ font-family: var(--mono); font-size: 12.5px; font-weight: 600; }}
.fn span {{ display: block; color: var(--muted); }}
@media (prefers-reduced-motion: reduce) {{ #der .tbl, #der .edge {{ transition: none; }} }}
</style>

<div class="wrap">
  <header class="top">
    <div>
      <h1>DER das Reservas</h1>
      <p class="sub">Solar do Espinhaço · Casa do Mirante · PostgreSQL (Supabase), schema "SE" · proposta v3, 18/11/2026 · prefixo SIT_ = tabelas do projeto Site · nomes em maiúsculas (use aspas no SQL)</p>
    </div>
    <div class="stats"><span><b>{len(T)}</b> tabelas</span><span><b>{ncols}</b> campos</span><span><b>{len(L)}</b> ligações</span><span><b>{len(schema['rules'])}</b> regras</span></div>
  </header>

  <div class="legend" aria-label="Legenda">
    <span class="it"><span class="k kp">PK</span> chave primária</span>
    <span class="it"><span class="k kf">FK</span> chave estrangeira</span>
    <span class="it"><span class="k">CAMPO?</span> opcional (aceita vazio)</span>
    <span class="it"><span class="k">gerado · auto</span> preenchido pelo banco</span>
    <span class="it"><svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true"><path d="M2,7 H42 M30,7 L42,1 M30,7 L42,7 M30,7 L42,13" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="24" cy="7" r="3.5" fill="var(--surface)" stroke="currentColor" stroke-width="1.3"/></svg> zero ou muitos</span>
    <span class="it"><svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true"><path d="M2,7 H42 M35,1 V13 M30,1 V13" fill="none" stroke="currentColor" stroke-width="1.4"/></svg> exatamente um</span>
    <span class="it"><svg width="44" height="14" viewBox="0 0 44 14" aria-hidden="true"><path d="M2,7 H42 M35,1 V13" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="27" cy="7" r="3.5" fill="var(--surface)" stroke="currentColor" stroke-width="1.3"/></svg> zero ou um</span>
    <span class="it"><span class="sw" style="background:var(--cad)"></span>cadastro <span class="sw" style="background:var(--pre)"></span>preço <span class="sw" style="background:var(--ven)"></span>venda <span class="sw" style="background:var(--can)"></span>canais</span>
  </div>

  <figure>
    <div class="scroll">
{chr(10).join(svg)}
    </div>
    <figcaption id="detalhe" aria-live="polite">A SIT_UNIDADE (o chalé) é o centro: preço, exceções, reservas, bloqueios e calendários apontam para ela. Cada linha liga o campo FK do filho à chave do pai; passe o mouse numa linha para ver o nome da regra. <b>Clique numa tabela para ver aqui o detalhe dela: cada campo explicado, com exemplo, ligações e regras.</b></figcaption>
{chr(10).join(paineis)}
  </figure>

  <h2>Regras de cada tabela</h2>
  <div class="cards">
{chr(10).join(cards)}
  </div>

{ajuste_html}

  <h2>Exemplos de dados</h2>
  <p class="hint">Linhas fictícias, gravadas num banco de teste e aprovadas por todas as regras (exemplos_der.sql). Os IDs batem entre as tabelas: a reserva 1 é do hóspede 1 e tem os pagamentos 1 e 2. Clique numa tabela do diagrama para destacar o exemplo dela.</p>
  <div class="exs">
{chr(10).join(exs)}
  </div>

  <h2>Funções do banco</h2>
  <ul class="fn">
    <li><code>consultar_disponibilidade</code><span>Pública: o botão "Ver disponibilidade" do site chama esta função; devolve disponibilidade, preço noite a noite, total e sinal, sem expor nenhuma tabela.</span></li>
    <li><code>consultar_precos</code><span>Pública: o calendário do site chama esta função para mostrar o valor de cada noite para os hóspedes escolhidos e marcar as noites ocupadas ou fechadas.</span></li>
    <li><code>criar_pre_reserva</code><span>Segura as datas por 30 minutos enquanto o hóspede preenche a reserva no site; só a Edge Function do Supabase executa.</span></li>
    <li><code>confirmar_reserva</code><span>Conclui a reserva do site: grava o hóspede com o documento (reconhece quem já se hospedou por e-mail, CPF ou passaporte), os acompanhantes e o aceite da política, e deixa a reserva CONFIRMADA. Não cobra nada: a equipe entra em contato para o pagamento.</span></li>
    <li><code>calcular_estadia</code><span>Interna: valida datas e capacidade, soma as noites e verifica reservas e bloqueios.</span></li>
    <li><code>expirar_pre_reservas</code><span>Job periódico (pg_cron) que marca como EXPIRADA a pré-reserva não concluída em 30 minutos.</span></li>
  </ul>
</div>

<script>
(function () {{
  var der = document.getElementById('der');
  var edges = Array.prototype.slice.call(der.querySelectorAll('.edge'));
  var tbls = Array.prototype.slice.call(der.querySelectorAll('.tbl'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.tcard, .ex'));
  var cap = document.getElementById('detalhe'); var capPadrao = cap.innerHTML;
  var current = null;
  function select(name, scroll) {{
    if (current === name) name = null;
    current = name;
    der.classList.toggle('focus', !!name);
    var near = {{}};
    edges.forEach(function (e) {{
      var r = e.getAttribute('data-rel').split(' ');
      var on = !!name && r.indexOf(name) >= 0;
      e.classList.toggle('near', on);
      if (on) {{ near[r[0]] = 1; near[r[1]] = 1; }}
    }});
    if (name) near[name] = 1;
    tbls.forEach(function (t) {{ var n = t.getAttribute('data-t'); t.classList.toggle('near', !!near[n]); t.classList.toggle('on', n === name); }});
    cards.forEach(function (c) {{ c.classList.toggle('on', c.getAttribute('data-t') === name); }});
    var tp = name && document.getElementById('d-' + name);
    cap.innerHTML = tp ? tp.innerHTML : capPadrao; cap.classList.toggle('has', !!tp);
    var bt = cap.querySelector('.dclose'); if (bt) bt.addEventListener('click', function () {{ select(current, false); }});
    if (name && scroll) {{ var el = cap; if (el) el.scrollIntoView({{ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }}); }}
  }}
  tbls.forEach(function (t) {{
    t.addEventListener('click', function () {{ select(t.getAttribute('data-t'), true); }});
    t.addEventListener('keydown', function (e) {{ if (e.key === 'Enter' || e.key === ' ') {{ e.preventDefault(); select(t.getAttribute('data-t'), true); }} }});
  }});
  cards.filter(function (c) {{ return c.classList.contains('tcard'); }}).forEach(function (c) {{ c.addEventListener('click', function () {{ select(c.getAttribute('data-t'), false); der.scrollIntoView({{ block: 'nearest' }}); }}); }});
}})();
</script>
'''
if COMPLETO:
    page = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + page.replace('</style>\n', '</style>\n</head>\n<body>\n', 1) + '\n</body>\n</html>\n')
open(out, 'w', encoding='utf-8').write(page)
print('ok', out, len(page))
