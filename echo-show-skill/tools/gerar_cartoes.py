"""Gera um vídeo animado por item (assets/itens/<id>.mp4) a partir de content/itens.json.
Uso:  python3 tools/gerar_cartoes.py <pasta_de_trabalho>
A pasta de trabalho precisa ter: fonts/ (woff2 da marca), design-system/ (cópia de colors_and_type.css) e capture.js.
Cada vídeo: 1280x720, H.264, ~9 s, começa e termina em preto, sem áudio."""
import json, os, subprocess, sys, html
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # echo-show-skill/
W = sys.argv[1]
ICONS = json.load(open(os.path.join(W, 'ic/node_modules/@iconify-json/solar/icons.json')))['icons']
LEAF = 'm12 9l4.5-4.5m-4.5 10L18.5 8M12 19.5l7.5-7.5M12 22c4.418 0 8-3.646 8-8.143c0-4.462-2.553-9.67-6.537-11.531A3.45 3.45 0 0 0 12 2m0 20c-4.418 0-8-3.646-8-8.143c0-4.462 2.553-9.67 6.537-11.531A3.45 3.45 0 0 1 12 2m0 20V2'
# ícones próprios da marca (brand/icons/index.html): banheira de imersão e piscina
SVG = {
 'banheira': '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 10 Q3.5 7.5 7 7 L17 7 Q20.5 7.5 20.5 10 L20.5 17 Q20.5 19.5 12 19.5 Q3.5 19.5 3.5 17 Z"/><path d="M3.5 10 Q3.5 8.5 7 8.5 L17 8.5 Q20.5 8.5 20.5 10"/><line x1="10" y1="7" x2="10" y2="5"/><path d="M10 5 Q10 4 11.5 4 L13 4"/><path d="M13 4 Q14.5 4 14.5 5 L14.5 7"/><line x1="7" y1="19.5" x2="6" y2="22"/><line x1="17" y1="19.5" x2="18" y2="22"/></g>',
 'piscina': '<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="7" r="2"/><path d="M15 9 L10 11.5 L6 9.5"/><line x1="17" y1="9" x2="16" y2="14"/><path d="M2 17.5 Q5.5 15 9 17.5 Q12.5 20 16 17.5 Q19.5 15 22 17.5"/><path d="M2 21 Q5.5 19 9 21 Q12.5 23 16 21 Q19.5 19 22 21"/></g>',
}
FACES = [('Cormorant Garamond', w, 'normal', f'cormorant-garamond-latin-{w}-normal.woff2') for w in (400, 500)] + \
        [('Inter', w, 'normal', f'inter-latin-{w}-normal.woff2') for w in (300, 400)]
FONTS = '<style>' + ''.join(f"@font-face{{font-family:'{f}';font-weight:{w};font-style:{s};src:url('../fonts/{n}') format('woff2')}}\n" for f, w, s, n in FACES) + '</style>'
tpl = open(os.path.join(R, 'tools/cartao_item.html')).read()
itens = json.load(open(os.path.join(R, 'content/itens.json')))['itens']
only = set(sys.argv[2:])            # opcional: ids a gerar
os.makedirs(os.path.join(R, 'assets/itens'), exist_ok=True)
os.makedirs(os.path.join(W, 'echo-show'), exist_ok=True)

for it in itens:
    if only and it['id'] not in only: continue
    ic = it['icone']
    icon = SVG[ic['svg']] if 'svg' in ic else ICONS[ic['solar']]['body']
    onde = f'<div class="onde">{html.escape(it["onde"].strip())}</div>' if it.get('onde', '').strip() else ''
    page = (tpl.replace('__FONTS__', FONTS).replace('__LEAF__', LEAF).replace('__ICON__', icon)
               .replace('__ONDE__', onde).replace('__NOME__', html.escape(it['nome'][0].upper() + it['nome'][1:] if it['nome'].islower() else it['nome'])))
    path = os.path.join(W, 'echo-show', f'item_{it["id"]}.html')
    open(path, 'w').write(page)
    fr = os.path.join(W, 'frames_item')
    subprocess.run(['node', os.path.join(W, 'capture.js'), fr, '10.5', '1920', path], check=True, capture_output=True)
    ts = json.load(open(os.path.join(fr, 'ts.json'))); t0 = ts[0]; rel = [t - t0 for t in ts]
    lum = []
    for i in range(len(ts)):
        d = list(Image.open(os.path.join(fr, f'f{i:05d}.jpg')).convert('L').resize((32, 18)).getdata()); lum.append(sum(d) / len(d))
    # termina no preto do fim do cartão (depois do último quadro claro)
    last = max(i for i in range(len(rel)) if lum[i] > 2)
    end = rel[last] + 0.5
    with open(os.path.join(W, 'concat_item.txt'), 'w') as f:
        for i, t in enumerate(rel):
            d = (rel[i + 1] if i + 1 < len(rel) else rel[-1] + 0.1) - t
            f.write(f"file '{fr}/f{i:05d}.jpg'\nduration {max(d, 0.001):.4f}\n")
        f.write(f"file '{fr}/f{len(rel) - 1:05d}.jpg'\n")
    out = os.path.join(R, 'assets/itens', f'{it["id"]}.mp4')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', os.path.join(W, 'concat_item.txt'),
                    '-t', f'{end:.2f}', '-vf', 'scale=1280:720:flags=lanczos,minterpolate=fps=30:mi_mode=blend,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1',
                    '-preset', 'slow', '-crf', '24', '-r', '30', '-g', '60', '-an', '-movflags', '+faststart', out], check=True)
    print(it['id'], f'{end:.1f}s', os.path.getsize(out) // 1024, 'KB')
