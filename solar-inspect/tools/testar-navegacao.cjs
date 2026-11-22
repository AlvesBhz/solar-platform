// Percorre TODAS as rotas do app com cada perfil (Supabase simulado) e procura navegação quebrada:
// erro de JavaScript ou no console, tela em branco, redirecionamento inesperado ou em laço, consulta não atendida,
// link do menu que leva a "sem permissão" e rolagem lateral no celular.
// Uso: npx vite build && (npx vite preview --port 4173 &) && node tools/testar-navegacao.cjs
const { chromium } = require('playwright');
const BASE = process.env.APP_URL || 'http://localhost:4173';
const SUPA = 'https://tnjpyjbqcjrowzjfnuln.supabase.co';
const V1 = '11111111-2222-4333-8444-555555555555';
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (c) console.log('ok  ' + m); else { falhas++; console.log('FALHOU: ' + m); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const agora = () => Math.floor(Date.now() / 1000);
const UIDS = { ASSESSOR: '00000000-0000-4000-8000-0000000000a1', GESTOR: '00000000-0000-4000-8000-0000000000a2', ADMIN: '00000000-0000-4000-8000-0000000000a3' };
const sessao = (uid) => ({ access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: uid, role: 'authenticated', exp: agora() + 3600 })}.x`, refresh_token: 'r', expires_in: 3600, expires_at: agora() + 3600, token_type: 'bearer', user: { id: uid, aud: 'authenticated', email: 'x@usuarios.inspect.invalid' } });
const UN = { id_unidade: 7, cd_unidade: 'cm', nm_unidade: 'Casa do Mirante', tp_unidade: 'CHALE', sg_ativo: true, id_propriedade: 1, nm_propriedade: 'Solar do Espinhaço', tp_situacao: 'LIBERADO', ds_andar: null, tp_validacao: 'GPS', vl_latitude: -19.0849, vl_longitude: -43.5969, qtde_raio_metros: 60, qtde_precisao_max_metros: 50 };

function servidor(page, perfil, perdidos, est = { aceite: true }) {
  return page.route(SUPA + '/**', async (route) => {
    const req = route.request(), url = decodeURIComponent(req.url()), h = req.headers(), m = req.method();
    const json = (s, c, extra = {}) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...extra }, body: c === undefined ? '' : JSON.stringify(c) });
    const objeto = (h['accept'] || '').includes('vnd.pgrst.object');
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/user')) return json(200, { id: UIDS[perfil], aud: 'authenticated' });
    if (url.includes('/rest/v1/VST_USUARIO_PROPRIEDADE')) return json(200, [{ ID_USUARIO: UIDS[perfil], ID_PROPRIEDADE: 1 }], { 'content-range': '0-0/1' });
    if (url.includes('/rest/v1/VST_USUARIO')) {
      const eu = { ID_USUARIO: UIDS[perfil], NM_USUARIO: 'Teste', CD_LOGIN: 'teste', CD_CPF: null, TP_PERFIL: perfil, SG_ATIVO: true, DT_ACEITE_LGPD: est.aceite ? '2026-11-20T12:00:00Z' : null, SG_TROCAR_SENHA: false };
      return objeto ? json(200, eu) : json(200, [eu]);
    }
    const rpc = url.match(/\/rest\/v1\/rpc\/(\w+)/)?.[1];
    if (rpc) {
      if (rpc === 'vst_registrar_aceite_lgpd') { est.aceite = true; return json(200, '2026-11-21T12:00:00Z'); }
      if (rpc === 'vst_unidades') return json(200, [UN]);
      if (rpc === 'vst_tipos_unidade') return json(200, [{ id_tipo_vistoria: 1, cd_tipo_vistoria: 'ENTRADA', nm_tipo_vistoria: 'Entrada', tp_comportamento: 'ENTRADA', sg_exige_entrada: false, sg_exige_assinatura: false, qtde_itens: 1, id_vistoria: null, dt_agendada: null, tp_status: null, cd_reserva: null }]);
      if (rpc === 'vst_checklist') return json(200, [{ id_ambiente: 10, nm_ambiente: 'Sala', ds_foto_referencia: null, id_item: 101, nm_item: 'Sofá', ds_orientacao: null, sg_critico: false, sg_foto_obrigatoria: false, qtde_esperada: null }]);
      if (rpc === 'vst_ocorrencias') return json(200, [{ id_ocorrencia: 1, id_unidade: 7, nm_unidade: 'Casa do Mirante', id_vistoria: V1, nm_tipo_vistoria: 'Saída', dt_vistoria: null, nm_autor: 'Ana', id_item: 101, nm_item: 'Sofá', nm_ambiente: 'Sala', tp_gravidade: 'MEDIA', tp_status: 'ABERTA', ds_ocorrencia: 'Mancha', ds_tratamento: null, dt_abertura: '2026-11-20T10:00:00Z', dt_resolucao: null, dt_bloqueio_fim: null }]);
      if (rpc === 'vst_propriedades') return json(200, [{ id_propriedade: 1, nm_propriedade: 'Solar do Espinhaço', qtde_unidades: 1 }]);
      return json(200, []);
    }
    if (url.includes('/rest/v1/VST_VISTORIA') && url.includes('ID_VISTORIA=eq.')) {
      const v = { ID_VISTORIA: V1, ID_UNIDADE: 7, TP_STATUS: 'CONCLUIDA', DT_AGENDADA: '2026-11-20', DT_INICIO: '2026-11-20T10:00:00Z', DT_FIM: '2026-11-20T10:20:00Z', DS_SINALIZACOES: null, TP_SITUACAO_RESULTANTE: 'EM_LIMPEZA', VST_TIPO_VISTORIA: { NM_TIPO_VISTORIA: 'Saída' }, VST_USUARIO: { NM_USUARIO: 'Ana' }, DS_ASSINATURA: null, ID_VISTORIA_ENTRADA: null };
      return objeto ? json(200, v) : json(200, [v]);
    }
    if (url.includes('/rest/v1/VST_')) return json(200, [], { 'content-range': '*/0' });        // tabelas sem dados: a tela tem de lidar
    if (url.includes('/storage/v1/')) return json(200, []);
    perdidos.push(m + ' ' + url.split('?')[0]);
    return json(404, { message: 'não esperado' });
  });
}

const ROTAS = {
  ASSESSOR: ['/', '/app/unidades', '/app/unidades/7', '/app/vistorias/nova/7', '/app/vistorias/nova/7/presenca', '/app/vistorias/nova/7/checklist', '/app/vistorias/nova/7/resumo',
    '/app/sincronizacao', '/app/historico', '/conta/senha', '/permissao-localizacao', '/rota-que-nao-existe'],
  GESTOR: ['/', '/gestao', '/gestao/unidades', '/gestao/unidades/7', '/gestao/vistorias', `/gestao/vistorias/${V1}`, `/gestao/vistorias/${V1}/relatorio`, '/gestao/ocorrencias', '/gestao/ocorrencias/1',
    '/admin/checklists', '/admin/presenca', '/app/unidades', '/conta/senha'],
  ADMIN: ['/', '/gestao', '/admin/propriedades', '/admin/propriedades/1', '/admin/checklists', '/admin/tipos', '/admin/presenca', '/admin/usuarios', '/admin/auditoria'],
};
// destino esperado quando a rota redireciona de propósito
const ESPERADO = {
  '/': { ASSESSOR: '/app/unidades', GESTOR: '/gestao', ADMIN: '/gestao' },
  '/app/vistorias/nova/7/presenca': '/app/vistorias/nova/7', '/app/vistorias/nova/7/checklist': '/app/vistorias/nova/7', '/app/vistorias/nova/7/resumo': '/app/vistorias/nova/7',
  '/rota-que-nao-existe': '/app/unidades',
};
const NEGADAS = { ASSESSOR: ['/gestao', '/admin/auditoria', '/app/ocorrencias'], GESTOR: ['/admin/propriedades', '/admin/tipos', '/admin/usuarios', '/admin/auditoria'] };

(async () => {
  const browser = await chromium.launch();
  for (const perfil of Object.keys(ROTAS)) {
    console.log(`── ${perfil}: todas as rotas`);
    const ctx = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: -19.0849, longitude: -43.5969, accuracy: 8 } });
    const page = await ctx.newPage();
    const erros = [], perdidos = [];
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
    await servidor(page, perfil, perdidos);
    await page.goto(BASE + '/__vazio__');
    await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('inspect.sessao', JSON.stringify(s)); }, sessao(UIDS[perfil]));
    for (const rota of ROTAS[perfil]) {
      erros.length = 0; perdidos.length = 0;
      const caminhos = [];
      const ouvir = (f) => { if (f === page.mainFrame()) caminhos.push(new URL(page.url()).pathname); };
      page.on('framenavigated', ouvir);
      await page.goto(BASE + rota).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(700);
      page.off('framenavigated', ouvir);
      const fim = new URL(page.url()).pathname;
      const esp = ESPERADO[rota]?.[perfil] ?? (typeof ESPERADO[rota] === 'string' ? ESPERADO[rota] : rota);
      const texto = (await page.innerText('body').catch(() => '')).trim();
      const problemas = [];
      if (fim !== esp) problemas.push(`terminou em ${fim} (esperado ${esp})`);
      if (texto.length < 40) problemas.push('tela em branco');
      if (/sem permissão|Acesso indisponível/i.test(texto) && !fim.startsWith('/acesso')) problemas.push('mensagem de sem permissão');
      const semDica = await page.evaluate(() => [...document.querySelectorAll('a, button')]
        .filter((e) => !e.innerText.trim() && e.getAttribute('aria-label') && !e.title && !e.className.toString().includes('inset-0') && e.offsetParent !== null)
        .map((e) => e.getAttribute('aria-label')));
      if (semDica.length) problemas.push('botão só de ícone sem dica ao passar o mouse: ' + semDica.join(', '));
      if (erros.length) problemas.push('erro: ' + erros[0].slice(0, 140));
      if (perdidos.length) problemas.push('consulta não atendida: ' + perdidos[0]);
      if (await page.evaluate(() => document.querySelector('[aria-busy="true"]') !== null && document.body.innerText.trim().length < 80)) problemas.push('carregando para sempre');
      ok(!problemas.length, `${perfil} ${rota}${problemas.length ? ' — ' + problemas.join('; ') : ''}`);
    }
    // menu da gestão: todo link visível abre a tela (nunca "sem permissão")
    if (perfil !== 'ASSESSOR') {
      await page.goto(BASE + '/gestao'); await page.waitForLoadState('networkidle').catch(() => {});
      const links = await page.locator('nav[aria-label="Gestão"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
      const ruins = [];
      for (const l of links) {
        await page.locator(`nav[aria-label="Gestão"] a[href="${l}"]`).first().click();
        await page.waitForTimeout(900);
        const p = new URL(page.url()).pathname;
        if (p.startsWith('/acesso-indisponivel') || p !== l) ruins.push(l + (p !== l ? ` (foi para ${p})` : ''));
        if (!p.startsWith('/gestao') && !p.startsWith('/admin')) { await page.goto(BASE + '/gestao'); await page.waitForLoadState('networkidle').catch(() => {}); }
      }
      ok(links.length > 3 && !ruins.length, `${perfil}: menu da gestão com ${links.length} links, todos abrem a tela certa${ruins.length ? ' — quebrados: ' + ruins.join(', ') : ''}`);
      await page.setViewportSize({ width: 320, height: 720 });
      for (const r of ['/gestao', '/gestao/ocorrencias/1', perfil === 'ADMIN' ? '/admin/auditoria' : '/gestao/unidades/7']) {
        await page.goto(BASE + r); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(400);
        ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), `${perfil} ${r} cabe em 320 px`);
      }
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    // rotas que este perfil NÃO pode abrir vão para T04, sem erro
    for (const r of NEGADAS[perfil] ?? []) {
      await page.goto(BASE + r); await page.waitForTimeout(1200);
      ok(new URL(page.url()).pathname === '/acesso-indisponivel', `${perfil} ${r} é negada com aviso (T04)`);
    }
    await ctx.close();
  }
  console.log('── Gestor indo fazer vistoria (sem aceite de localização ainda)');
  {
    const ctx = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: -19.0849, longitude: -43.5969, accuracy: 8 } });
    const page = await ctx.newPage(); const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await servidor(page, 'GESTOR', [], { aceite: false });
    await page.goto(BASE + '/__vazio__');
    await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('inspect.sessao', JSON.stringify(s)); }, sessao(UIDS.GESTOR));
    await page.goto(BASE + '/gestao'); await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('nav[aria-label="Gestão"] a[href="/app/unidades"]').first().click();
    await page.waitForURL((u) => u.pathname === '/permissao-localizacao', { timeout: 6000 }).catch(() => {});
    ok(new URL(page.url()).searchParams.get('volta') === '/app/unidades', 'menu "Fazer vistoria" pede o aceite de localização (T03) guardando a volta');
    await page.getByRole('button', { name: /Continuar/ }).click();
    await page.waitForURL((u) => u.pathname === '/app/unidades', { timeout: 6000 }).catch(() => {});
    ok(new URL(page.url()).pathname === '/app/unidades', 'depois do aceite volta ao app de campo (não à gestão)');
    await page.getByText('Casa do Mirante').first().waitFor({ timeout: 6000 }).catch(() => {});
    ok(new URL(page.url()).pathname === '/app/unidades', 'fica em Minhas unidades (sem voltar à T03 em laço)');
    if (process.env.DEPURAR) console.log(await page.evaluate(() => [localStorage.getItem('inspect.acesso'), [...document.querySelectorAll('[aria-label]')].map((x) => x.getAttribute('aria-label')).join('|'), location.pathname]));
    await page.locator('a[aria-label="Voltar à gestão"]').click({ timeout: 8000 });
    await page.waitForURL((u) => u.pathname === '/gestao', { timeout: 6000 }).catch(() => {});
    ok(new URL(page.url()).pathname === '/gestao' && !erros.length, 'de Minhas unidades o gestor volta à gestão' + (erros.length ? ' — ' + erros[0] : ''));
    await ctx.close();
  }
  await browser.close();
  console.log(falhas ? `\n${falhas} FALHA(S) em ${total}` : `\nTODAS AS ${total} VERIFICAÇÕES PASSARAM`);
  process.exit(falhas ? 1 : 0);
})();
