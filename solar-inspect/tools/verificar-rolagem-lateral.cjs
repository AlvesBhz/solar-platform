// Mede cada elemento de todas as telas e acusa qualquer um que passe da borda (celular).
// Uso: npm run build && npx vite preview --port 4173 &  node tools/verificar-rolagem-lateral.cjs   (URL=... para outro endereço)
const { chromium } = require('playwright');
(async () => { const U = process.env.URL || 'http://localhost:4173'; const b = await chromium.launch();
  const rotas = ['/','/login','/permissao-localizacao','/acesso-indisponivel?motivo=inativo','/app/unidades','/app/unidades/chale-sempre-viva','/app/vistorias/nova/chale-candeia','/app/sincronizacao','/app/historico',
    '/gestao','/gestao/unidades','/gestao/unidades/chale-sempre-viva','/gestao/vistorias','/gestao/vistorias/v-1018','/gestao/vistorias/v-1018/relatorio','/gestao/ocorrencias','/gestao/ocorrencias/o-2',
    '/admin/propriedades','/admin/propriedades/nova','/admin/checklists','/admin/tipos','/admin/presenca','/admin/usuarios','/admin/auditoria','/admin/precos','/admin/tarifas','/admin/tarifas/1','/admin/simulador'];
  const fluxo = ['presenca','checklist','item/cama','item/cama/foto','resumo','assinatura'];
  for (const w of [280, 320, 390]) { const p = await b.newPage({ viewport: { width: w, height: 800 } }); const bad = [];
    const medir = async (r) => { await p.waitForTimeout(700);
      const n = await p.evaluate(() => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('body *')].filter(el => {
        if (el.closest('[class*="overflow-x-auto"],[class*="overflow-hidden"],.qr-area,video')) return false; const r = el.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1); }).map(el => el.tagName + '.' + String(el.className).slice(0, 40)).slice(0, 2); });
      if (n.length) bad.push(r + ' → ' + n.join(' | ')); };
    for (const r of rotas) { await p.goto(U + r); await medir(r); }
    await p.evaluate(() => sessionStorage.setItem('solar-inspect:rascunho', JSON.stringify({ id: 'x', unidadeId: 'chale-ipe', tipoId: 'entrada', presenca: {}, inicio: new Date().toISOString(), respostas: {} })));
    for (const f of fluxo) { await p.goto(`${U}/app/vistorias/nova/chale-ipe/${f}`); await medir(f); }
    console.log(w + 'px:', bad.length ? '\n  ' + bad.join('\n  ') : 'nenhum vazamento'); await p.close(); }
  await b.close(); })();
