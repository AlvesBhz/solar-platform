# Gera o DER (der.html) a partir da estrutura extraída do banco (schema.json com tabelas, campos e FKs).
# Uso: python3 gerar_der.py schema.json der.html
import json, sys, html
schema = json.load(open(sys.argv[1]))
out = sys.argv[2]
T = {t['name']: t for t in schema['tables']}
W, HDR, RH = 330, 40, 19
C0, C1, C2, C3 = 20, 440, 860, 1280

POS = {
  'TARIFA': (C0, 20), 'PROPRIEDADE': (C0, 379), 'UNIDADE': (C1, 360), 'AJUSTE_DIARIO': (C1, 680),
  'RESERVA': (C2, 40), 'BLOQUEIO': (C2, 560),
  'PAGAMENTO': (C3, 21), 'HOSPEDE': (C3, 420), 'CALENDARIO_EXTERNO': (C3, 655),
}
GROUP = {'PROPRIEDADE': 'cad', 'UNIDADE': 'cad', 'TARIFA': 'pre', 'AJUSTE_DIARIO': 'pre',
         'RESERVA': 'ven', 'HOSPEDE': 'ven', 'PAGAMENTO': 'ven', 'CALENDARIO_EXTERNO': 'can', 'BLOQUEIO': 'can'}
GNAME = {'cad': 'CADASTRO', 'pre': 'PREÇO', 'ven': 'VENDA', 'can': 'CANAIS'}

def idx(t, c):
    return [x['n'] for x in T[t]['cols']].index(c)
def ry(t, c):
    return POS[t][1] + HDR + idx(t, c) * RH + RH / 2
def bottom(t):
    return POS[t][1] + HDR + len(T[t]['cols']) * RH

# ligações: filho.campo -> pai.campo, pontos (porta do filho primeiro), rótulo e posição do rótulo
L = [
  dict(c='UNIDADE', f='ID_PROPRIEDADE', p='PROPRIEDADE', pk='ID_PROPRIEDADE', lbl='pertence a', lp=(370, None, 'mid'),
       pts=lambda: [(C1, ry('UNIDADE','ID_PROPRIEDADE')), (C0+W, ry('UNIDADE','ID_PROPRIEDADE'))]),
  dict(c='TARIFA', f='ID_UNIDADE', p='UNIDADE', pk='ID_UNIDADE', lbl='preço de',
       pts=lambda: [(C0+W, ry('TARIFA','ID_UNIDADE')), (C1-30, ry('TARIFA','ID_UNIDADE')), (C1-30, ry('UNIDADE','ID_UNIDADE')), (C1, ry('UNIDADE','ID_UNIDADE'))]),
  dict(c='AJUSTE_DIARIO', f='ID_UNIDADE', p='UNIDADE', pk='ID_UNIDADE', lbl='exceção de',
       pts=lambda: [(C1+W, ry('AJUSTE_DIARIO','ID_UNIDADE')), (C1+W+16, ry('AJUSTE_DIARIO','ID_UNIDADE')), (C1+W+16, ry('UNIDADE','ID_UNIDADE')), (C1+W, ry('UNIDADE','ID_UNIDADE'))]),
  dict(c='RESERVA', f='ID_UNIDADE', p='UNIDADE', pk='ID_UNIDADE', lbl='reserva',
       pts=lambda: [(C2, ry('RESERVA','ID_UNIDADE')), (C2-26, ry('RESERVA','ID_UNIDADE')), (C2-26, ry('UNIDADE','ID_UNIDADE')), (C1+W, ry('UNIDADE','ID_UNIDADE'))]),
  dict(c='BLOQUEIO', f='ID_UNIDADE', p='UNIDADE', pk='ID_UNIDADE', lbl='bloqueia',
       pts=lambda: [(C2, ry('BLOQUEIO','ID_UNIDADE')), (C2-46, ry('BLOQUEIO','ID_UNIDADE')), (C2-46, ry('UNIDADE','ID_UNIDADE')), (C1+W, ry('UNIDADE','ID_UNIDADE'))]),
  dict(c='CALENDARIO_EXTERNO', f='ID_UNIDADE', p='UNIDADE', pk='ID_UNIDADE', lbl='canal de',
       pts=lambda: [(C3, ry('CALENDARIO_EXTERNO','ID_UNIDADE')), (C3-40, ry('CALENDARIO_EXTERNO','ID_UNIDADE')), (C3-40, 852), (C1+W+31, 852), (C1+W+31, ry('UNIDADE','ID_UNIDADE')), (C1+W, ry('UNIDADE','ID_UNIDADE'))]),
  dict(c='BLOQUEIO', f='ID_CALENDARIO', p='CALENDARIO_EXTERNO', pk='ID_CALENDARIO', lbl='importado de',
       pts=lambda: [(C2+W, ry('BLOQUEIO','ID_CALENDARIO')), (C3, ry('BLOQUEIO','ID_CALENDARIO'))]),
  dict(c='RESERVA', f='ID_HOSPEDE', p='HOSPEDE', pk='ID_HOSPEDE', lbl='feita por', bridge='SELF',
       pts=lambda: [(C2+W, ry('RESERVA','ID_HOSPEDE')), (C3-40, ry('RESERVA','ID_HOSPEDE')), (C3-40, ry('HOSPEDE','ID_HOSPEDE')), (C3, ry('HOSPEDE','ID_HOSPEDE'))]),
  dict(c='PAGAMENTO', f='ID_RESERVA', p='RESERVA', pk='ID_RESERVA', lbl='paga',
       pts=lambda: [(C3, ry('PAGAMENTO','ID_RESERVA')), (C2+W, ry('PAGAMENTO','ID_RESERVA'))]),
  dict(c='RESERVA', f='ID_RESERVA_ORIGINAL', p='RESERVA', pk='ID_RESERVA', lbl='remarcada de',
       pts=lambda: [(C2+W, ry('RESERVA','ID_RESERVA_ORIGINAL')), (C2+W+24, ry('RESERVA','ID_RESERVA_ORIGINAL')), (C2+W+24, ry('RESERVA','ID_RESERVA')), (C2+W, ry('RESERVA','ID_RESERVA'))]),
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
svg.append(f'<svg id="der" viewBox="0 0 {VW} {VH}" role="img" aria-label="Diagrama entidade-relacionamento do banco de reservas: a UNIDADE (chalé) no centro, ligada à PROPRIEDADE, às tarifas, ajustes, reservas, bloqueios e calendários externos; a RESERVA liga hóspede, pagamentos e a reserva original de uma remarcação.">')

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
 'PROPRIEDADE': 'A pousada: horários, idade de criança, estadia máxima, sinal, tempo para pagar e regra de remarcação.',
 'UNIDADE': 'Cada chalé (hoje, só a Casa do Mirante): capacidade e taxa de limpeza.',
 'TARIFA': 'Preço por período. Onde duas tarifas cobrem a mesma noite, vale a de maior prioridade.',
 'AJUSTE_DIARIO': 'Exceção de uma data: preço especial, mínimo de noites, noite fechada, sem chegada ou sem saída.',
 'HOSPEDE': 'Quem reserva: só nome, e-mail e telefone (LGPD).',
 'RESERVA': 'Estadia vendida, com preço, sinal e saldo gravados no momento da reserva.',
 'PAGAMENTO': 'Tentativas de pagamento de cada parcela: sinal no site e saldo no check-in.',
 'CALENDARIO_EXTERNO': 'Link iCal do Airbnb e do Booking, lido periodicamente.',
 'BLOQUEIO': 'Datas fora da venda: reservas dos canais, manutenção e uso próprio.',
}
RULES = {
 'PROPRIEDADE': ['Estadia máxima entre 1 e 365 noites (hoje 7).', 'Sinal entre 0% e 100% (hoje 50%).', 'Pré-reserva entre 5 e 1.440 minutos (hoje 30).', 'Prazo de remarcação ≥ 0 dias e validade do crédito ≥ 1 mês.'],
 'UNIDADE': ['CD_UNIDADE único, só letras minúsculas, números e hífen.', 'TP_UNIDADE: CHALE, QUARTO ou SUITE.', 'Capacidades: hóspedes e adultos ≥ 1, crianças ≥ 0.', 'Taxa de limpeza ≥ 0.'],
 'TARIFA': ['DT_FIM depois de DT_INI.', 'Valores ≥ 0; adultos inclusos e mínimo de noites ≥ 1.', 'Duas tarifas ativas com a mesma prioridade não cobrem a mesma noite (EX_TARIFA_SOBREPOSICAO).'],
 'AJUSTE_DIARIO': ['Chave composta: um ajuste por chalé e data (ID_UNIDADE + DT_REF).', 'Valor ≥ 0 e mínimo de noites ≥ 1.'],
 'HOSPEDE': ['E-mail único, sem diferenciar maiúsculas de minúsculas.'],
 'RESERVA': ['CD_RESERVA único.', 'DT_CHECKOUT depois de DT_CHECKIN; pelo menos 1 adulto.', 'TP_STATUS: PENDENTE, CONFIRMADA, CANCELADA, EXPIRADA ou REMARCADA.', 'TP_CANAL: SITE, DIRETO ou TELEFONE.', 'Sinal ≤ total.', 'PENDENTE exige DT_EXPIRA; CONFIRMADA exige hóspede.', 'Duas reservas PENDENTE ou CONFIRMADA do mesmo chalé nunca ocupam a mesma noite (EX_RESERVA_SEM_CONFLITO).'],
 'PAGAMENTO': ['TP_PARCELA: SINAL ou SALDO.', 'TP_PROVEDOR: MERCADO_PAGO ou MANUAL.', 'TP_METODO: PIX ou CARTAO_CREDITO.', 'TP_STATUS: PENDENTE, APROVADO, RECUSADO, CANCELADO ou ESTORNADO.', 'Valor > 0; APROVADO exige DT_PAGAMENTO; CD_EXTERNO único.'],
 'CALENDARIO_EXTERNO': ['TP_CANAL: AIRBNB, BOOKING ou OUTRO.', 'Um calendário por canal em cada chalé.'],
 'BLOQUEIO': ['DT_FIM depois de DT_INI.', 'TP_MOTIVO: CANAL_EXTERNO, MANUTENCAO, USO_PROPRIO ou OUTRO.', 'Só CANAL_EXTERNO tem ID_CALENDARIO, e ele é obrigatório nesse caso.', 'CD_EXTERNO único por calendário.'],
}
ORDER = ['PROPRIEDADE', 'UNIDADE', 'TARIFA', 'AJUSTE_DIARIO', 'RESERVA', 'HOSPEDE', 'PAGAMENTO', 'CALENDARIO_EXTERNO', 'BLOQUEIO']
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
      <p class="sub">Solar do Espinhaço · Casa do Mirante · PostgreSQL (Supabase) · proposta v2, 17/11/2026</p>
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
    <figcaption>A UNIDADE (o chalé) é o centro: preço, exceções, reservas, bloqueios e calendários apontam para ela. Cada linha liga o campo FK do filho à chave do pai; passe o mouse numa linha para ver o nome da regra. Clique numa tabela para destacar as ligações dela e ver as regras abaixo.</figcaption>
  </figure>

  <h2>Regras de cada tabela</h2>
  <div class="cards">
{chr(10).join(cards)}
  </div>

  <h2>Funções do banco</h2>
  <ul class="fn">
    <li><code>consultar_disponibilidade</code><span>Pública: o botão "Ver disponibilidade" do site chama esta função; devolve disponibilidade, preço noite a noite, total e sinal, sem expor nenhuma tabela.</span></li>
    <li><code>criar_pre_reserva</code><span>Segura as datas por 30 minutos enquanto o hóspede paga o sinal; só a Edge Function do Supabase executa.</span></li>
    <li><code>calcular_estadia</code><span>Interna: valida datas e capacidade, soma as noites e verifica reservas e bloqueios.</span></li>
    <li><code>expirar_pre_reservas</code><span>Job periódico (pg_cron) que marca como EXPIRADA a pré-reserva não paga.</span></li>
  </ul>
</div>

<script>
(function () {{
  var der = document.getElementById('der');
  var edges = Array.prototype.slice.call(der.querySelectorAll('.edge'));
  var tbls = Array.prototype.slice.call(der.querySelectorAll('.tbl'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.tcard'));
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
    if (name && scroll) {{ var el = document.getElementById('t-' + name); if (el) el.scrollIntoView({{ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }}); }}
  }}
  tbls.forEach(function (t) {{
    t.addEventListener('click', function () {{ select(t.getAttribute('data-t'), true); }});
    t.addEventListener('keydown', function (e) {{ if (e.key === 'Enter' || e.key === ' ') {{ e.preventDefault(); select(t.getAttribute('data-t'), true); }} }});
  }});
  cards.forEach(function (c) {{ c.addEventListener('click', function () {{ select(c.getAttribute('data-t'), false); der.scrollIntoView({{ block: 'nearest' }}); }}); }});
}})();
</script>
'''
open(out, 'w', encoding='utf-8').write(page)
print('ok', out, len(page))
