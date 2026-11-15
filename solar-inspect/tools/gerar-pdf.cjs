// Gera o PDF da especificação a partir de docs/ESPECIFICACAO.md (capa da marca, fontes Cormorant e Inter).
// Uso: node tools/gerar-pdf.cjs [saida.pdf]
const fs = require('fs'); const path = require('path'); const { marked } = require('marked'); const { chromium } = require('playwright');
const os = require('os'); const app = path.resolve(__dirname, '..'); // pasta solar-inspect
const md = fs.readFileSync(`${app}/docs/ESPECIFICACAO.md`, 'utf8');
const corpo = md.split('\n').slice(md.split('\n').findIndex((l) => l.startsWith('> Versão')) ).join('\n'); // descarta título e cabeçalho (vão na capa)
const intro = md.match(/^> Versão.*$/m)[0].replace(/^> /, '');
const folha = JSON.parse(fs.readFileSync(`${app}/src/icons/solar-subset.json`, 'utf8')).icons['leaf-linear'].body;
const font = (f, w, file, fam) => `@font-face{font-family:'${fam}';font-weight:${w};src:url('file://${app}/node_modules/${file}') format('woff2')}`;
const fonts = [font('i', 400, '@fontsource/inter/files/inter-latin-400-normal.woff2', 'Inter'), font('i', 500, '@fontsource/inter/files/inter-latin-500-normal.woff2', 'Inter'), font('i', 600, '@fontsource/inter/files/inter-latin-600-normal.woff2', 'Inter'), font('c', 500, '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2', 'Cormorant Garamond')].join('\n');
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Especificação Técnica — Aplicação de Vistorias Solar do Espinhaço</title><style>
${fonts}
@page { size: A4; margin: 18mm 16mm 20mm; }
:root { --pine:#2C3E35; --deep:#1C2922; --cream:#FAFAF9; --s200:#E7E5E4; --s500:#78716C; --s600:#57534E; --s900:#1C1917; --warn:#B45309; }
* { box-sizing: border-box; }
body { font-family: Inter, sans-serif; font-size: 9.6pt; line-height: 1.55; color: var(--s600); margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.capa { height: 244mm; border-radius: 6mm; background: linear-gradient(160deg,#1C2922,#2C3E35 55%,#3D5547); color: #FAFAF9; display: flex; flex-direction: column; justify-content: space-between; padding: 20mm 18mm; break-after: page; }
.capa svg { width: 22mm; height: 22mm; color: #FAFAF9; }
.capa .eyebrow { font-size: 8.5pt; letter-spacing: .32em; text-transform: uppercase; opacity: .75; margin-bottom: 8mm; }
.capa h1 { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 40pt; line-height: 1.02; margin: 0 0 6mm; letter-spacing: -.01em; color: #FAFAF9; }
.capa p { font-size: 11pt; max-width: 120mm; opacity: .85; margin: 0; }
.capa .rodape { font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; opacity: .7; border-top: .3mm solid rgba(255,255,255,.25); padding-top: 5mm; }
h2 { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 20pt; line-height: 1.1; color: var(--deep); margin: 9mm 0 3mm; padding-bottom: 2mm; border-bottom: .3mm solid var(--s200); break-after: avoid; }
h3 { font-size: 10.5pt; font-weight: 600; color: var(--pine); margin: 6mm 0 2mm; break-after: avoid; }
p { margin: 0 0 2.6mm; } strong { color: var(--s900); font-weight: 600; }
ul, ol { margin: 0 0 3mm; padding-left: 5mm; } li { margin-bottom: 1.2mm; }
ul:has(input) { list-style: none; padding-left: 0; } ul input { margin: 0 2mm 0 0; vertical-align: -1px; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 8.4pt; background: #F5F5F4; padding: .2mm 1mm; border-radius: 1mm; color: var(--deep); }
blockquote { margin: 0 0 4mm; padding: 3mm 4mm; background: var(--cream); border-left: 1mm solid var(--pine); color: var(--s600); font-size: 9pt; } blockquote p { margin: 0 0 1mm; }
table { width: 100%; border-collapse: collapse; margin: 1mm 0 4mm; font-size: 8.8pt; line-height: 1.4; }
th { background: var(--cream); color: var(--s500); font-size: 7.8pt; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; text-align: left; padding: 2mm 2.4mm; border-bottom: .4mm solid var(--s200); }
td { padding: 1.9mm 2.4mm; border-bottom: .25mm solid var(--s200); vertical-align: top; } tr { break-inside: avoid; } td.id { white-space: nowrap; font-family: ui-monospace, Menlo, monospace; font-size: 8pt; color: var(--deep); } thead { display: table-header-group; }
hr { border: 0; border-top: .3mm solid var(--s200); margin: 4mm 0; }
</style></head><body>
<section class="capa"><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">${folha}</svg></div>
<div><div class="eyebrow">Especificação técnica</div><h1>Aplicação de Vistorias<br>Solar do Espinhaço</h1><p>Especificação funcional, técnica e catálogo de telas do MVP, atualizada com o protótipo navegável (T01–T34).</p></div>
<div class="rodape">${intro.split(' · ').slice(0, 2).join(' · ')} · Solar do Espinhaço</div></section>
${marked.parse(corpo.replace(/^---$/m, ''), { gfm: true }).replace(/<td>((?:CA-|T)\d+)<\/td>/g, '<td class="id">$1</td>')}
</body></html>`;
const tmp = path.join(os.tmpdir(), 'spec-vistorias.html');
fs.writeFileSync(tmp, html);
(async () => { const b = await chromium.launch(); const p = await b.newPage(); await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready);
  await p.pdf({ path: process.argv[2] || `${app}/docs/Especificacao_Tecnica_App_Vistorias_Solar_do_Espinhaco.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-family:sans-serif;font-size:7.5px;color:#78716C;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>Solar do Espinhaço | Especificação técnica com catálogo de telas</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' });
  await b.close(); })();
