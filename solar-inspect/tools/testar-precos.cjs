// Testa as telas de preços (T38 calendário, T39 tarifas, T40 simulador, T41 formulário de tarifa) no navegador.
// São protótipos com dados de exemplo em memória: nada vai ao Supabase. O Supabase é simulado só para o login.
// Uso: npx vite build && (npx vite preview --port 4173 &) && node tools/testar-precos.cjs
// Com FOTO=/pasta salva uma imagem de cada tela (desktop e celular).
const { chromium } = require('playwright');
const BASE = process.env.APP_URL || 'http://localhost:4173';
const SUPA = 'https://tnjpyjbqcjrowzjfnuln.supabase.co';
const UIDS = { GESTOR: '00000000-0000-4000-8000-0000000000a2', ADMIN: '00000000-0000-4000-8000-0000000000a3' };
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (c) console.log('ok  ' + m); else { falhas++; console.log('FALHOU: ' + m); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const agora = () => Math.floor(Date.now() / 1000);
const sessao = (uid) => ({ access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: uid, role: 'authenticated', exp: agora() + 3600 })}.x`, refresh_token: 'r', expires_in: 3600, expires_at: agora() + 3600, token_type: 'bearer', user: { id: uid, aud: 'authenticated', email: 'x@usuarios.inspect.invalid' } });
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const somar = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function servidor(page, perfil, perdidos) {
  return page.route(SUPA + '/**', async (route) => {
    const req = route.request(), url = decodeURIComponent(req.url()), h = req.headers(), m = req.method();
    const json = (s, c, extra = {}) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...extra }, body: JSON.stringify(c) });
    const objeto = (h['accept'] || '').includes('vnd.pgrst.object');
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/user')) return json(200, { id: UIDS[perfil], aud: 'authenticated' });
    if (url.includes('/rest/v1/VST_USUARIO_PROPRIEDADE')) return json(200, [{ ID_USUARIO: UIDS[perfil], ID_PROPRIEDADE: 1 }], { 'content-range': '0-0/1' });
    if (url.includes('/rest/v1/VST_USUARIO')) {
      const eu = { ID_USUARIO: UIDS[perfil], NM_USUARIO: 'Teste', CD_LOGIN: 'teste', CD_CPF: null, TP_PERFIL: perfil, SG_ATIVO: true, DT_ACEITE_LGPD: '2026-11-20T12:00:00Z', SG_TROCAR_SENHA: false };
      return objeto ? json(200, eu) : json(200, [eu]);
    }
    if (url.includes('/rest/v1/rpc/') || url.includes('/rest/v1/VST_')) return json(200, [], { 'content-range': '*/0' });
    perdidos.push(m + ' ' + url.split('?')[0]);
    return json(404, { message: 'não esperado' });
  });
}

(async () => {
  const browser = await chromium.launch();
  const novo = async (perfil, largura = 1280) => {
    const ctx = await browser.newContext({ viewport: { width: largura, height: 900 } });
    const page = await ctx.newPage();
    const erros = [], perdidos = [];
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
    await servidor(page, perfil, perdidos);
    await page.goto(BASE + '/__vazio__');
    await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('inspect.sessao', JSON.stringify(s)); }, sessao(UIDS[perfil]));
    return { ctx, page, erros, perdidos };
  };
  const abrir = async (page, rota) => { await page.goto(BASE + rota); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(400); };
  const foto = async (page, nome) => { if (process.env.FOTO) await page.screenshot({ path: `${process.env.FOTO}/${nome}.png`, fullPage: true }); };

  // ── só o ADMIN abre (preços são dados do site)
  console.log('── Acesso');
  {
    const g = await novo('GESTOR');
    for (const r of ['/admin/precos', '/admin/tarifas', '/admin/tarifas/1', '/admin/simulador']) {
      await abrir(g.page, r);
      ok(new URL(g.page.url()).pathname === '/acesso-indisponivel', `GESTOR não abre ${r}`);
    }
    await g.ctx.close();
  }
  const A = await novo('ADMIN');
  const p = A.page;
  await abrir(p, '/gestao');
  const links = await p.locator('nav[aria-label="Gestão"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  ok(['/admin/precos', '/admin/tarifas', '/admin/simulador'].every((l) => links.includes(l)), 'ADMIN vê Calendário de preços, Tarifas e Simulador no menu');

  // ── T38 · calendário
  console.log('── T38 Calendário de preços');
  const alvo = somar(hoje(), 40);                       // um dia futuro qualquer
  const mes = alvo.slice(0, 7), dia = String(Number(alvo.slice(8)));
  await abrir(p, `/admin/precos?mes=${mes}`);
  const celula = () => p.locator('[role=gridcell]').filter({ has: p.locator(`span:text-is("${dia}")`) }).first();
  const rotulo = async () => (await celula().getAttribute('aria-label')) || '';
  ok((await p.locator('h1').innerText()).includes('Calendário de preços'), 'título da tela');
  ok(await p.getByText('Protótipo.').isVisible(), 'aviso de protótipo visível');
  const antes = await rotulo();
  ok(/R\$\s?(800|1\.700)/.test(antes), `dia ${alvo} mostra o valor da tarifa padrão (${antes.match(/R\$[^,]*/)?.[0]})`);
  await celula().click();
  ok(await p.getByRole('button', { name: 'Salvar ajuste' }).isVisible(), 'clicar no dia abre o painel de ajuste');
  await p.getByPlaceholder(/usar a tarifa · R\$/).first().fill('950');
  await foto(p, 'T38-ajuste');
  await p.getByRole('button', { name: 'Salvar ajuste' }).click();
  await p.waitForTimeout(300);
  ok(/R\$\s?950/.test(await rotulo()) && /com ajuste/.test(await rotulo()), 'ajuste de R$ 950 aparece no calendário, marcado como ajuste');
  await p.getByRole('button', { name: 'Remover ajuste' }).click();
  await p.waitForTimeout(300);
  ok(await rotulo() === antes, 'remover o ajuste devolve o valor da tarifa');
  await p.getByLabel('Fechar para venda').check();
  await p.getByRole('button', { name: 'Salvar ajuste' }).click();
  await p.waitForTimeout(300);
  ok(/fechado para venda/.test(await rotulo()), 'dia fechado fica marcado como fechado para venda');
  await p.getByRole('button', { name: 'Remover ajuste' }).click();
  await p.getByRole('radio', { name: 'Intervalo' }).click();
  await celula().click();
  await p.locator('[role=gridcell]').filter({ has: p.locator(`span:text-is("${Number(dia) + 2}")`) }).first().click().catch(() => {});
  ok(/3 noites/.test(await p.locator('aside[aria-label="Ajuste do dia"]').innerText()), 'modo intervalo: dois toques selecionam 3 noites');
  // feriado de exemplo: ajuste com mínimo de 3 noites já marcado
  await abrir(p, '/admin/precos?mes=2027-12');
  const natal = p.locator('[role=gridcell]').filter({ has: p.locator('span:text-is("24")') }).first();
  ok(/mínimo 3 noites/.test(await natal.getAttribute('aria-label')) && /com ajuste/.test(await natal.getAttribute('aria-label')), 'Natal 2027 aparece com ajuste e mínimo de 3 noites');
  await foto(p, 'T38-desktop');

  // ── T40 · simulador
  console.log('── T40 Simulador de preço');
  await abrir(p, '/admin/simulador');
  const datas = p.locator('input[type=date]');
  await datas.nth(0).fill('2027-12-24'); await datas.nth(1).fill('2027-12-27');
  await p.waitForTimeout(200);
  let txt = await p.locator('section[aria-label=Resultado]').innerText();
  ok(/Venda liberada/.test(txt) && /R\$\s?5\.100/.test(txt), 'Natal 2027, casal, 3 noites: R$ 5.100');
  ok(/Sinal pelo Pix \(50%\)\s*R\$\s?2\.550/.test(txt.replace(/\n/g, ' ')), 'sinal de 50% = R$ 2.550');
  await p.getByRole('button', { name: /Mais crianças de 5 a 8 anos/i }).click();
  txt = await p.locator('section[aria-label=Resultado]').innerText();
  await foto(p, 'T40-natal');
  ok(/R\$\s?5\.865/.test(txt), 'com 1 criança de 5 a 8 anos (30% do valor por pessoa): R$ 5.865');
  await datas.nth(1).fill('2027-12-26');
  txt = await p.locator('section[aria-label=Resultado]').innerText();
  ok(/não vende/.test(txt) && /mínimo de noites/i.test(txt), 'duas noites no Natal: abaixo do mínimo, o site não vende');
  await datas.nth(0).fill('2027-12-20'); await datas.nth(1).fill('2027-12-22');
  await p.waitForTimeout(200);
  txt = await p.locator('section[aria-label=Resultado]').innerText();
  ok(/Venda liberada/.test(txt) && /R\$\s?1\.840/.test(txt), 'segunda e terça com 1 criança de 5 a 8 anos: 2 × (R$ 800 + R$ 120) = R$ 1.840');
  await datas.nth(0).fill('2030-01-05'); await datas.nth(1).fill('2030-01-07');
  txt = await p.locator('section[aria-label=Resultado]').innerText();
  ok(/Alguma noite ainda não tem tarifa/.test(txt), 'depois do fim das tarifas: sem tarifa, venda não aberta');
  await foto(p, 'T40-desktop');

  // ── T39/T41 · tarifas
  console.log('── T39 Tarifas e T41 Formulário');
  await abrir(p, '/admin/tarifas');
  txt = await p.locator('main').innerText();
  ok(/Tarifa padrão/.test(txt) && /vale hoje/.test(txt) && /Alta temporada de julho/.test(txt), 'lista mostra a tarifa padrão (vale hoje) e a de exemplo');
  await p.getByRole('radio', { name: 'Inativas' }).click();
  ok(!/Tarifa padrão/.test(await p.locator('main').innerText()), 'filtro Inativas esconde as ativas');
  await p.getByRole('radio', { name: 'Todas' }).click();
  await foto(p, 'T39-desktop');
  await p.getByRole('link', { name: /Nova tarifa/ }).click();
  await p.waitForTimeout(300);
  await p.getByPlaceholder(/Alta temporada de julho/).fill('Teste de sobreposição');
  const inputs = p.locator('input[type=date]');
  await inputs.nth(0).fill('2027-02-01'); await inputs.nth(1).fill('2027-02-10');
  const prio = p.locator('label', { hasText: 'Prioridade' }).locator('input');
  await prio.fill('0');
  ok(/se sobrepõe a “Tarifa padrão”/.test(await p.locator('main').innerText()) && await p.getByRole('button', { name: /Salvar tarifa/ }).isDisabled(), 'mesma prioridade e período: avisa a sobreposição e bloqueia salvar');
  await prio.fill('3');
  ok(await p.getByRole('button', { name: /Salvar tarifa/ }).isEnabled(), 'prioridade diferente: pode salvar');
  await p.getByRole('button', { name: /Salvar tarifa/ }).click();
  await p.waitForTimeout(400);
  ok(new URL(p.url()).pathname === '/admin/tarifas' && /Teste de sobreposição/.test(await p.locator('main').innerText()), 'tarifa salva volta para a lista');
  await abrir(p, '/admin/tarifas/2');
  await foto(p, 'T41-desktop');
  ok(/exemplo de conta/i.test(await p.locator('main').innerText()), 'formulário de edição abre com o exemplo de conta');

  // ── celular (280 px é o menor aparelho que o app atende)
  console.log('── Celular (280, 320 e 390 px)');
  await A.ctx.close();
  const M = await novo('ADMIN', 390);
  for (const w of [280, 320, 390]) {
    await M.page.setViewportSize({ width: w, height: 800 });
    for (const [rota, nome] of [['/admin/precos', 'T38'], ['/admin/tarifas', 'T39'], ['/admin/simulador', 'T40'], ['/admin/tarifas/1', 'T41']]) {
      await abrir(M.page, rota);
      const extra = await M.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(extra <= 0, `${nome} sem rolagem lateral em ${w} px`);
      if (w === 390 && nome === 'T38') { await M.page.locator('[role=gridcell]:not([disabled])').last().click(); await M.page.waitForTimeout(700); }
      if (w === 390) await foto(M.page, `${nome}-celular`);
    }
  }
  ok(A.erros.length === 0 && M.erros.length === 0, 'sem erros de JavaScript' + (A.erros[0] ? ' — ' + A.erros[0].slice(0, 120) : ''));
  ok(A.perdidos.length === 0 && M.perdidos.length === 0, 'nenhuma consulta ao banco fora do esperado' + (A.perdidos[0] ? ' — ' + A.perdidos[0] : ''));
  await browser.close();
  console.log(`\n${total - falhas}/${total} verificações ok`);
  process.exit(falhas ? 1 : 0);
})();
