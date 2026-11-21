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
    unidades: [{ id_unidade: 1, cd_unidade: 'casa-do-mirante', nm_unidade: 'Casa do Mirante', id_propriedade: 1, nm_propriedade: 'Solar do Espinhaço', tp_situacao: 'LIBERADO', ds_andar: null, tp_validacao: 'QR_E_GPS', vl_latitude: -19.08, vl_longitude: -43.59, qtde_raio_metros: 100 },
               { id_unidade: 2, cd_unidade: 'chale-novo', nm_unidade: 'Chalé Novo', id_propriedade: 2, nm_propriedade: 'Hotel Lapinha', tp_situacao: 'LIBERADO', ds_andar: null, tp_validacao: 'QR', vl_latitude: null, vl_longitude: null, qtde_raio_metros: 100 }],
    vstUnidade: [{ ID_UNIDADE: 1, DS_ANDAR: null, TP_VALIDACAO: null, VL_LATITUDE: null, VL_LONGITUDE: null, QTDE_RAIO_METROS: null, NO_VERSAO_QR: 1 }],
    ambientes: [], itens: [], seq: 100,
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
    if (caminho === 'rpc/vst_unidades') return json(200, db.unidades);
    for (const [tab, chave, lista] of [['VST_AMBIENTE', 'ID_AMBIENTE', 'ambientes'], ['VST_ITEM', 'ID_ITEM', 'itens']]) {
      if (caminho !== tab) continue;
      if (m === 'GET') return json(200, db[lista]);
      if (m === 'POST') {
        const nomeCampo = tab === 'VST_AMBIENTE' ? 'NM_AMBIENTE' : 'NM_ITEM';
        if (db[lista].some((x) => x[nomeCampo] === corpo[nomeCampo])) return json(409, { code: '23505', message: `duplicate key value violates unique constraint "UQ_${tab}_${nomeCampo}"` });
        const novo = { SG_ATIVO: true, ...corpo, [chave]: ++db.seq }; db[lista].push(novo); return json(201, [{ [chave]: novo[chave] }]);
      }
      if (m === 'PATCH') { const id = Number(url.searchParams.get(chave).slice(3)); const r = db[lista].find((x) => x[chave] === id); Object.assign(r, corpo); return json(200, [{ [chave]: id }]); }
      if (m === 'DELETE') return json(405, { message: 'não deveria apagar' });
    }
    if (caminho === 'VST_UNIDADE' && m === 'GET') return json(200, db.vstUnidade);
    if (caminho === 'VST_UNIDADE' && m === 'PATCH') { const id = Number(url.searchParams.get('ID_UNIDADE').slice(3)); const r = db.vstUnidade.find((x) => x.ID_UNIDADE === id); if (!r) return json(200, []); Object.assign(r, corpo); return json(200, [{ ID_UNIDADE: id }]); }
    if (caminho === 'rpc/vst_obter_qr') { const id = corpo.p_id_unidade; if (!db.vstUnidade.find((x) => x.ID_UNIDADE === id)) db.vstUnidade.push({ ID_UNIDADE: id, NO_VERSAO_QR: 1 }); return json(200, [{ cd_hash_qr: 'hash-' + id, no_versao_qr: 1 }]); }
    if (caminho === 'rpc/vst_rotacionar_qr') return json(200, [{ cd_hash_qr: 'hash-novo', no_versao_qr: 2 }]);
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

  console.log('── T33 Presença por chalé');
  await T('t33', async () => {
    let db = novoBanco('ASSESSOR'); let { ctx, page } = await abrir(browser, db, '/admin/presenca');
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=sem-permissao'), 'assessor não entra na T33');
    await ctx.close();
    db = novoBanco('GESTOR'); ({ ctx, page } = await abrir(browser, db, '/admin/presenca'));
    await page.waitForSelector('text=Casa do Mirante');
    ok(await page.isVisible('text=Validação') && (await page.content()).includes('(pousada)'), 'gestor entra; mostra o que vem da pousada');
    await page.locator('li:has-text("Casa do Mirante") button:has-text("Editar presença")').click();
    await page.fill('#c-lat', '-19.0849');
    ok((await texto(page, 'form [role=alert]')).includes('juntas') && await page.isDisabled('form button[type=submit]'), 'latitude sem longitude: avisa e bloqueia');
    await page.fill('#c-lng', '-43.5969'); await page.fill('#c-raio', '60'); await page.fill('#c-andar', 'Térreo');
    await page.click('form button[type=submit]');
    await page.waitForSelector('text=Presença de Casa do Mirante salva');
    const pt = ultima(db, 'PATCH', 'VST_UNIDADE');
    ok(pt && pt.corpo.VL_LATITUDE === -19.0849 && pt.corpo.QTDE_RAIO_METROS === 60 && pt.corpo.DS_ANDAR === 'Térreo' && pt.corpo.TP_VALIDACAO === null && !('CD_HASH_QR' in pt.corpo) && !('TP_SITUACAO' in pt.corpo), 'salva ponto, raio e andar; "igual à pousada" grava vazio; nunca mexe em QR nem situação');
    await page.locator('li:has-text("Chalé Novo") button:has-text("Editar presença")').click();
    await escolher(page, 'Validação', 'Só GPS');
    ok((await texto(page, 'form [role=alert]')).includes('defina o ponto'), 'GPS sem ponto no chalé nem na pousada: avisa');
    await escolher(page, 'Validação', 'Só QR'); await page.fill('#c-andar', 'Bloco B');
    await page.click('form button[type=submit]');
    await page.waitForSelector('text=Presença de Chalé Novo salva');
    ok(db.chamadas.filter((c) => c.caminho === 'VST_UNIDADE' && c.m === 'PATCH' && c.busca.includes('eq.2')).length === 2 && ultima(db, 'POST', 'rpc/vst_obter_qr'), 'chalé novo do site sem configuração: cria a linha (vst_obter_qr) e salva');
    await page.locator('li:has-text("Casa do Mirante") button:has-text("QR da porta")').click();
    await page.waitForSelector('img[alt^="QR da porta"]');
    ok((await page.getAttribute('img[alt^="QR da porta"]', 'src')).startsWith('data:image/png') && !(await page.content()).includes('hash-1'), 'mostra o QR para imprimir sem exibir o código em texto');
    await page.click('button:has-text("Rotacionar QR")');
    ok(!ultima(db, 'POST', 'rpc/vst_rotacionar_qr'), 'rotacionar pede confirmação antes');
    await page.click('button:has-text("Confirmar: invalidar")');
    await page.waitForSelector('text=etiquetas antigas deixaram de valer');
    ok(!!ultima(db, 'POST', 'rpc/vst_rotacionar_qr'), 'confirmado: rotaciona pela função (invalida a etiqueta antiga)');
    await ctx.close();
  });

  console.log('── T30 Ambientes e itens');
  await T('t30', async () => {
    let db = novoBanco('ASSESSOR'); let { ctx, page } = await abrir(browser, db, '/admin/checklists');
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=sem-permissao'), 'assessor não entra na T30');
    await ctx.close();
    db = novoBanco('GESTOR'); ({ ctx, page } = await abrir(browser, db, '/admin/checklists'));
    await page.waitForSelector('text=ainda não tem ambientes');
    ok(true, 'gestor entra; chalé sem ambientes mostra como começar');
    await page.click('button:has-text("Novo ambiente")'); await page.fill('#a-nome', 'B'); await page.click('form[aria-label=Ambiente] button[type=submit]');
    ok((await texto(page, '[role=alert]')).includes('2 a 80') && !ultima(db, 'POST', 'VST_AMBIENTE'), 'nome curto: avisa e não grava');
    await page.fill('#a-nome', 'Banheiro'); await page.click('form[aria-label=Ambiente] button[type=submit]');
    await page.waitForSelector('[data-ambiente="Banheiro"]');
    const pa = ultima(db, 'POST', 'VST_AMBIENTE');
    ok(pa && pa.corpo.ID_UNIDADE === 1 && pa.corpo.NM_AMBIENTE === 'Banheiro' && pa.corpo.NO_ORDEM === 1, 'inclui o ambiente no chalé escolhido, com a ordem');
    await page.click('button:has-text("Novo ambiente")'); await page.fill('#a-nome', 'Banheiro'); await page.click('form[aria-label=Ambiente] button[type=submit]');
    ok((await texto(page, '[role=alert]')).includes('Já existe'), 'nome repetido no chalé: o banco recusa e a tela explica');
    await page.fill('#a-nome', 'Sala'); await page.click('form[aria-label=Ambiente] button[type=submit]');
    await page.waitForSelector('[data-ambiente="Sala"]');
    await page.click('button[aria-label="Descer Banheiro"]');
    await page.waitForSelector('text=Ordem salva');
    const patches = db.chamadas.filter((c) => c.m === 'PATCH' && c.caminho === 'VST_AMBIENTE');
    ok(patches.length === 2 && patches[0].corpo.NO_ORDEM === 2 && patches[1].corpo.NO_ORDEM === 1, 'mudar a ordem troca a posição dos dois ambientes');
    await page.locator('[data-ambiente="Banheiro"] button:has-text("+ Item")').click();
    await page.fill('#i-nome', 'Toalhas de banho'); await page.fill('#i-qtde', '-1'); await page.click('form[aria-label=Item] button[type=submit]');
    ok((await texto(page, '[role=alert]')).includes('0 a 999') && !ultima(db, 'POST', 'VST_ITEM'), 'quantidade negativa: avisa e não grava');
    await page.fill('#i-qtde', '4'); await page.check('text=Item crítico'); await page.check('text=Foto obrigatória');
    await page.click('form[aria-label=Item] button[type=submit]');
    await page.waitForSelector('[data-item="Toalhas de banho"]');
    const pi = ultima(db, 'POST', 'VST_ITEM');
    ok(pi && pi.corpo.QTDE_ESPERADA === 4 && pi.corpo.SG_CRITICO === true && pi.corpo.SG_FOTO_OBRIGATORIA === true && pi.corpo.ID_AMBIENTE === db.ambientes.find((a) => a.NM_AMBIENTE === 'Banheiro').ID_AMBIENTE, 'inclui o item no ambiente certo, com crítico, foto e quantidade');
    ok((await page.content()).includes('inclua-o nos tipos de vistoria'), 'lembra de incluir o item novo nos tipos de vistoria');
    await page.locator('[data-item="Toalhas de banho"] button:has-text("Desativar")').click();
    await page.waitForSelector('text=Item desativado');
    ok(ultima(db, 'PATCH', 'VST_ITEM').corpo.SG_ATIVO === false && !db.chamadas.some((c) => c.m === 'DELETE' && c.caminho.startsWith('VST_')), 'desativar não apaga (histórico das vistorias preservado)');
    await ctx.close();
  });

  ok(errosJS.length === 0, 'nenhum erro de JavaScript' + (errosJS[0] ? ': ' + errosJS[0] : ''));
  await browser.close();
  console.log(falhas ? `\n${falhas} FALHA(S) em ${total}` : `\nTODAS AS ${total} VERIFICAÇÕES PASSARAM`);
  process.exit(falhas ? 1 : 0);
})();
