// Testa as telas de administração (T28–T33) no navegador, com o Supabase simulado em memória (nada vai ao banco real).
// Uso: npx vite build && (npx vite preview --port 4173 &) && node tools/testar-admin.cjs
const { chromium } = require('playwright');
const BASE = process.env.APP_URL || 'http://localhost:4173';
const SUPA = 'https://tnjpyjbqcjrowzjfnuln.supabase.co';
const UID = '00000000-0000-4000-8000-0000000000a3';
let falhas = 0, total = 0; const errosJS = [];
const ok = (c, m) => { total++; if (c) console.log('ok  ' + m); else { falhas++; console.log('FALHOU: ' + m); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const agora = () => Math.floor(Date.now() / 1000);
const sessao = () => ({ access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: UID, role: 'authenticated', exp: agora() + 3600 })}.x`, refresh_token: 'r', expires_in: 3600, expires_at: agora() + 3600, token_type: 'bearer', user: { id: UID } });

// banco em memória
function novoBanco(eu = 'ADMIN') {
  return {
    eu, chamadas: [],
    usuarios: [
      { ID_USUARIO: UID, NM_USUARIO: 'Admin', CD_LOGIN: 'admin', CD_CPF: '06103387655', TP_PERFIL: eu, SG_ATIVO: true, DT_ACEITE_LGPD: null },
      { ID_USUARIO: 'u-ana', NM_USUARIO: 'Ana Souza', CD_LOGIN: 'ana.souza', CD_CPF: '52998224725', TP_PERFIL: 'ASSESSOR', SG_ATIVO: true, DT_ACEITE_LGPD: null },
    ],
    up: [{ ID_USUARIO: 'u-ana', ID_PROPRIEDADE: 1 }],
    props: [{ id_propriedade: 1, nm_propriedade: 'Solar do Espinhaço', qtde_unidades: 1, tp_validacao: 'QR_E_GPS', vl_latitude: -19.08, vl_longitude: -43.59, qtde_raio_metros: 100, qtde_precisao_max_metros: 50, qtde_minutos_min_vistoria: 10 },
            { id_propriedade: 2, nm_propriedade: 'Hotel Lapinha', qtde_unidades: 0, tp_validacao: 'QR', vl_latitude: null, vl_longitude: null, qtde_raio_metros: 100, qtde_precisao_max_metros: 50, qtde_minutos_min_vistoria: 10 }],
    respostas: {},  // sobrescreve: { 'PATCH VST_USUARIO': {status, corpo} }
  };
}
function rotas(page, db) {
  return page.route(SUPA + '/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), m = req.method(), h = req.headers();
    const caminho = url.pathname.replace('/rest/v1/', '').replace('/functions/v1/', 'fn:');
    const corpo = req.postData() ? JSON.parse(req.postData()) : null;
    db.chamadas.push({ m, caminho, busca: url.search, corpo, auth: h.authorization });
    const json = (status, b, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...extra }, body: b === undefined ? '' : JSON.stringify(b) });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const forcado = db.respostas[`${m} ${caminho}`];
    if (forcado) return json(forcado.status, forcado.corpo);
    if (url.pathname.endsWith('/auth/v1/user')) return json(200, { id: UID });
    if (caminho === 'VST_USUARIO' && m === 'GET') {
      if (url.search.includes('ID_USUARIO=eq.')) { const eu = db.usuarios[0]; return (h.accept || '').includes('object') ? json(200, eu) : json(200, [eu]); }
      return json(200, db.usuarios);
    }
    if (caminho === 'VST_USUARIO' && m === 'PATCH') { const id = url.searchParams.get('ID_USUARIO').slice(3); db.usuarios = db.usuarios.map((u) => (u.ID_USUARIO === id ? { ...u, ...corpo } : u)); return json(204); }
    if (caminho === 'VST_USUARIO_PROPRIEDADE' && m === 'HEAD') return json(200, undefined, { 'content-range': '*/1' });
    if (caminho === 'VST_USUARIO_PROPRIEDADE' && m === 'GET') return json(200, db.up);
    if (caminho === 'VST_USUARIO_PROPRIEDADE' && m === 'POST') { db.up.push(...corpo); return json(201); }
    if (caminho === 'VST_USUARIO_PROPRIEDADE' && m === 'DELETE') { return json(204); }
    if (caminho === 'rpc/vst_propriedades') return json(200, db.props);
    if (caminho === 'VST_PROPRIEDADE' && m === 'POST') { db.props = db.props.map((p) => (p.id_propriedade === corpo.ID_PROPRIEDADE ? { ...p, tp_validacao: corpo.TP_VALIDACAO, qtde_raio_metros: corpo.QTDE_RAIO_METROS, vl_latitude: corpo.VL_LATITUDE, vl_longitude: corpo.VL_LONGITUDE } : p)); return json(201); }
    if (caminho === 'fn:criar-usuario') return json(201, { id_usuario: 'novo', login: corpo.cd_login });
    if (caminho === 'fn:redefinir-senha') return json(200, { id_usuario: 'u-ana' });
    return json(404, { message: 'não esperado ' + m + ' ' + caminho });
  });
}
async function abrir(browser, db, rota) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errosJS.push(e.message));
  await rotas(page, db);
  await page.goto(BASE + '/__vazio__');
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('inspect.sessao', JSON.stringify(s)); }, sessao());
  await page.goto(BASE + rota);
  return { ctx, page };
}
const esperarRota = async (page, prefixo) => { try { await page.waitForURL((u) => (u.pathname + u.search).startsWith(prefixo), { timeout: 6000 }); return true; } catch { return false; } };
const texto = async (page, sel) => { try { return (await page.textContent(sel, { timeout: 4000 })) || ''; } catch { return ''; } };
const escolher = async (page, rotulo, opcao) => { await page.click(`button[aria-label^="${rotulo}:"]`); await page.click(`[role=option]:has-text("${opcao}")`); };
const ultima = (db, m, caminho) => [...db.chamadas].reverse().find((c) => c.m === m && c.caminho === caminho);
const T = async (nome, fn) => { try { await fn(); } catch (e) { falhas++; total++; console.log('FALHOU: ' + nome + ' — ' + e.message.split('\n')[0]); } };

module.exports = { ok, abrir, novoBanco, esperarRota, texto, escolher, ultima, T, errosJS, BASE };

if (require.main === module) (async () => {
  const browser = await chromium.launch();

  console.log('── T32 Usuários');
  await T('t32', async () => {
    let db = novoBanco('GESTOR'); let { ctx, page } = await abrir(browser, db, '/admin/usuarios');
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=sem-permissao'), 'gestor não entra na T32 (só ADMIN)');
    await ctx.close();

    db = novoBanco(); ({ ctx, page } = await abrir(browser, db, '/admin/usuarios'));
    await page.waitForSelector('text=Ana Souza');
    const html = await page.content();
    ok(html.includes('•••.982.247-••') && !html.includes('52998224725'), 'lista a equipe com CPF mascarado (nunca o CPF inteiro na tela)');
    ok(html.includes('Solar do Espinhaço') && html.includes('Todas'), 'mostra as pousadas de cada um (ADMIN: todas)');

    await page.click('button:has-text("Novo usuário")');
    await page.fill('#u-nome', 'Maria Limpeza'); await page.fill('#u-login', 'maria.limpeza');
    await page.click('button[type=submit]:has-text("Salvar")');
    ok((await texto(page, '[role=alert]')).includes('ao menos uma pousada') && !ultima(db, 'POST', 'fn:criar-usuario'), 'campo sem pousada: avisa e não chama o servidor');
    await page.fill('#u-login', '1maria'); await page.check('text=Solar do Espinhaço');
    await page.click('button[type=submit]:has-text("Salvar")');
    ok((await texto(page, '[role=alert]')).includes('começando por letra') && !ultima(db, 'POST', 'fn:criar-usuario'), 'usuário que começa por número: avisa e não chama o servidor');
    await page.fill('#u-login', 'maria.limpeza'); await page.fill('#u-cpf', '11144477736');
    await page.click('button[type=submit]:has-text("Salvar")');
    ok((await texto(page, '[role=alert]')).includes('CPF inválido'), 'CPF inválido: avisa');
    await page.fill('#u-cpf', ''); await page.type('#u-cpf', '11144477735'); await escolher(page, 'Perfil', 'Limpeza');
    const senha = await page.inputValue('#u-senha');
    await page.click('button[type=submit]:has-text("Salvar")');
    await page.waitForSelector('text=criado. Senha inicial', { timeout: 6000 });
    const c = ultima(db, 'POST', 'fn:criar-usuario');
    ok(c && c.corpo.cd_login === 'maria.limpeza' && c.corpo.cd_cpf === '11144477735' && c.corpo.tp_perfil === 'LIMPEZA' && c.corpo.ids_propriedade[0] === 1 && c.corpo.senha === senha, 'cria pela Edge Function criar-usuario: login, CPF só números, perfil Limpeza e pousada');
    ok((c.auth || '').startsWith('Bearer ey'), 'a criação vai com o login do ADMIN (a função confere o perfil)');
    ok(senha.length >= 12 && (await texto(page, 'p:has-text("Senha inicial")')).includes(senha), 'senha inicial gerada (12 caracteres) e mostrada uma vez para passar ao funcionário');

    db.respostas['POST fn:criar-usuario'] = { status: 409, corpo: { erro: 'login_em_uso', mensagem: 'Esse usuário já existe.' } };
    await page.click('button:has-text("Novo usuário")');
    await page.fill('#u-nome', 'Outra Pessoa'); await page.fill('#u-login', 'ana.souza'); await page.check('text=Solar do Espinhaço');
    await page.click('button[type=submit]:has-text("Salvar")');
    ok((await texto(page, '[role=alert]')).includes('já existe'), 'usuário repetido: mensagem do servidor');
    delete db.respostas['POST fn:criar-usuario'];
    await page.click('button:has-text("Cancelar")');

    await page.locator('tr:has-text("Ana Souza") button:has-text("Editar")').click();
    await escolher(page, 'Perfil', 'Gestor'); await page.check('text=Hotel Lapinha'); await page.uncheck('text=Solar do Espinhaço');
    await page.click('button[type=submit]:has-text("Salvar")');
    await page.waitForSelector('text=Alterações salvas', { timeout: 6000 });
    const p = ultima(db, 'PATCH', 'VST_USUARIO'), ins = ultima(db, 'POST', 'VST_USUARIO_PROPRIEDADE'), del = ultima(db, 'DELETE', 'VST_USUARIO_PROPRIEDADE');
    ok(p && p.corpo.TP_PERFIL === 'GESTOR' && p.busca.includes('ID_USUARIO=eq.u-ana'), 'editar: grava o novo perfil só daquele usuário');
    ok(ins && ins.corpo[0].ID_PROPRIEDADE === 2 && del && del.busca.includes('ID_PROPRIEDADE=in.%281%29'), 'editar: inclui a pousada nova e retira só a removida');

    db.respostas['PATCH VST_USUARIO'] = { status: 400, corpo: { code: 'P0001', message: 'ultimo_admin' } };
    await page.locator('tr:has-text("admin") button:has-text("Editar")').first().click();
    await page.uncheck('text=Ativo');
    await page.click('button[type=submit]:has-text("Salvar")');
    ok((await texto(page, '[role=alert]')).includes('ao menos um administrador'), 'tentar desativar o último ADMIN: o banco recusa e a tela explica');
    delete db.respostas['PATCH VST_USUARIO'];
    await page.click('button:has-text("Cancelar")');

    await page.locator('tr:has-text("Ana Souza") button:has-text("Redefinir senha")').click();
    const nova = await page.inputValue('#u-nova-senha');
    await page.click('button[type=submit]:has-text("Redefinir senha")');
    await page.waitForSelector('text=Nova senha de ana.souza:', { timeout: 6000 });
    const r = ultima(db, 'POST', 'fn:redefinir-senha');
    ok(r && r.corpo.cd_login === 'ana.souza' && r.corpo.senha === nova && nova.length >= 12, 'redefinir senha pela Edge Function, com senha gerada');
    await ctx.close();
  });

  console.log('── T28/T29 Pousadas');
  await T('t28', async () => {
    let db = novoBanco('ASSESSOR'); let { ctx, page } = await abrir(browser, db, '/admin/propriedades');
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=sem-permissao'), 'assessor não entra na T28');
    await ctx.close();
    db = novoBanco(); ({ ctx, page } = await abrir(browser, db, '/admin/propriedades'));
    await page.waitForSelector('text=Hotel Lapinha');
    ok(await page.isVisible('text=não definido') && await page.isVisible('text=-19.08, -43.59'), 'lista as pousadas com validação, ponto de GPS (ou "não definido") e raio');
    ok(!(await page.isVisible('text=Nova')), 'sem botão de criar pousada (pousadas são do site)');
    await page.locator('li:has-text("Hotel Lapinha") a:has-text("Configurar presença")').click();
    ok(await esperarRota(page, '/admin/propriedades/2'), 'abre a configuração da pousada (T29)');
    await page.waitForSelector('#p-raio');
    await escolher(page, 'Validação padrão', 'QR e GPS');
    ok((await texto(page, '[role=alert]')).includes('informe o ponto') && await page.isDisabled('button:has-text("Salvar configuração")'), 'GPS sem ponto: avisa e não deixa salvar');
    await page.fill('#p-lat', '-19.0847');
    ok((await texto(page, '[role=alert]')).includes('juntas'), 'latitude sem longitude: avisa');
    await page.fill('#p-lng', '-43.5967'); await page.fill('#p-raio', '5');
    ok((await texto(page, '[role=alert]')).includes('10 e 1.000'), 'raio fora da faixa: avisa');
    await page.fill('#p-raio', '80');
    await page.click('button:has-text("Salvar configuração")');
    ok(await page.waitForURL((u) => u.pathname === '/admin/propriedades', { timeout: 6000 }).then(() => true, () => false), 'salva e volta para a lista');
    const c = ultima(db, 'POST', 'VST_PROPRIEDADE');
    ok(c && c.corpo.ID_PROPRIEDADE === 2 && c.corpo.TP_VALIDACAO === 'QR_E_GPS' && c.corpo.QTDE_RAIO_METROS === 80 && c.corpo.VL_LATITUDE === -19.0847 && c.corpo.VL_LONGITUDE === -43.5967 && c.busca.includes('on_conflict=ID_PROPRIEDADE'), 'grava em VST_PROPRIEDADE por upsert (cria a linha se faltar), com os valores numéricos');
    await ctx.close();
    db = novoBanco(); ({ ctx, page } = await abrir(browser, db, '/admin/propriedades/999'));
    ok((await texto(page, '[role=alert]')).includes('não encontrada'), 'pousada inexistente ou sem acesso: avisa');
    await ctx.close();
  });

  ok(errosJS.length === 0, 'nenhum erro de JavaScript' + (errosJS[0] ? ': ' + errosJS[0] : ''));
  await browser.close();
  console.log(falhas ? `\n${falhas} FALHA(S) em ${total}` : `\nTODAS AS ${total} VERIFICAÇÕES PASSARAM`);
  process.exit(falhas ? 1 : 0);
})();
