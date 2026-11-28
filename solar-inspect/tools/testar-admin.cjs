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
    ambientes: [], itens: [], seq: 100, tipoItens: [],
    tipos: [{ ID_TIPO_VISTORIA: 1, CD_TIPO_VISTORIA: 'ENTRADA', NM_TIPO_VISTORIA: 'Entrada', TP_COMPORTAMENTO: 'ENTRADA', TP_PERIODICIDADE: null, SG_EXIGE_ENTRADA: false, SG_EXIGE_ASSINATURA: false, SG_ATIVO: true, DS_PERFIS: ['ASSESSOR'] },
            { ID_TIPO_VISTORIA: 2, CD_TIPO_VISTORIA: 'SAIDA', NM_TIPO_VISTORIA: 'Saída', TP_COMPORTAMENTO: 'SAIDA', TP_PERIODICIDADE: null, SG_EXIGE_ENTRADA: true, SG_EXIGE_ASSINATURA: true, SG_ATIVO: true, DS_PERFIS: ['ASSESSOR', 'LIMPEZA'] }],
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
    if (caminho === 'VST_TIPO_VISTORIA_ITEM') {
      if (m === 'GET') { const f = url.searchParams.get('ID_TIPO_VISTORIA'); return json(200, f ? db.tipoItens.filter((x) => x.ID_TIPO_VISTORIA === Number(f.slice(3))) : db.tipoItens); }
      if (m === 'POST') {
        const l = Array.isArray(corpo) ? corpo : [corpo];
        for (const x of l) if (!db.tipoItens.some((y) => y.ID_TIPO_VISTORIA === x.ID_TIPO_VISTORIA && y.ID_ITEM === x.ID_ITEM)) db.tipoItens.push(x);
        return json(201, l.map((x) => ({ ID_ITEM: x.ID_ITEM })));
      }
      if (m === 'DELETE') { const t = Number(url.searchParams.get('ID_TIPO_VISTORIA').slice(3)), i = Number(url.searchParams.get('ID_ITEM').slice(3)); db.tipoItens = db.tipoItens.filter((x) => !(x.ID_TIPO_VISTORIA === t && x.ID_ITEM === i)); return json(200, [{ ID_ITEM: i }]); }
    }
    for (const [tab, chave, lista] of [['VST_AMBIENTE', 'ID_AMBIENTE', 'ambientes'], ['VST_ITEM', 'ID_ITEM', 'itens'], ['VST_TIPO_VISTORIA', 'ID_TIPO_VISTORIA', 'tipos']]) {
      if (caminho !== tab) continue;
      if (m === 'GET') return json(200, [...db[lista]].sort((x, y) => (x.NO_ORDEM ?? 0) - (y.NO_ORDEM ?? 0)));   // como o banco: order=NO_ORDEM
      if (m === 'POST') {
        const nomeCampo = { VST_AMBIENTE: 'NM_AMBIENTE', VST_ITEM: 'NM_ITEM', VST_TIPO_VISTORIA: 'CD_TIPO_VISTORIA' }[tab];
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
const esperar = async (cond, ms = 4000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (cond()) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
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
    await page.fill('#u-nome', 'Laís Nardy de Magalhães');
    ok(await page.inputValue('#u-login') === 'lais.magalhaes', 'usuário sai sozinho do nome: primeiro e último, sem acento nem "de"');
    await page.fill('#u-nome', 'Ana Souza');
    ok(await page.inputValue('#u-login') === 'ana.souza2', 'nome de quem já existe ganha número (ana.souza2), sem conflito');
    await page.fill('#u-nome', 'Maria Limpeza');
    ok(await page.inputValue('#u-login') === 'maria.limpeza', 'a sugestão acompanha o nome enquanto o usuário não é editado');
    if (process.env.FOTO) { await page.fill('#u-nome', 'Laís Nardy de Magalhães'); await page.locator('form[aria-label]').first().screenshot({ path: process.env.FOTO }); await page.fill('#u-nome', 'Maria Limpeza'); }
    await page.click('button[type=submit]:has-text("Salvar")');
    ok((await texto(page, '[role=alert]')).includes('ao menos uma pousada') && !ultima(db, 'POST', 'fn:criar-usuario'), 'campo sem pousada: avisa e não chama o servidor');
    await page.fill('#u-login', '1Maria Júlia');
    ok(await page.inputValue('#u-login') === 'maria.julia', 'usuário digitado é ajustado na hora (minúsculo, sem acento, espaço vira ponto, começa por letra)');
    await page.check('text=Solar do Espinhaço');
    await page.fill('#u-senha', 'somenteletras');
    ok((await texto(page, 'label:has(#u-senha)')).includes('Misture letras e números'), 'regra da senha aparece enquanto digita');
    await page.click('button[type=submit]:has-text("Salvar")');
    ok((await texto(page, '[role=alert]')).includes('Misture letras e números') && !ultima(db, 'POST', 'fn:criar-usuario'), 'senha provisória fraca: avisa e não chama o servidor');
    await page.click('button[aria-label="Gerar outra senha"]');
    await page.fill('#u-login', 'maria.limpeza'); await page.fill('#u-cpf', '11144477736');
    await page.click('button[type=submit]:has-text("Salvar")');
    ok((await texto(page, '[role=alert]')).includes('CPF inválido'), 'CPF inválido: avisa');
    await page.fill('#u-cpf', ''); await page.type('#u-cpf', '11144477735'); await escolher(page, 'Perfil', 'Limpeza');
    const senha = await page.inputValue('#u-senha');
    await page.click('button[type=submit]:has-text("Salvar")');
    await page.waitForSelector('text=criado. Senha provisória', { timeout: 6000 });
    const c = ultima(db, 'POST', 'fn:criar-usuario');
    ok(c && c.corpo.cd_login === 'maria.limpeza' && c.corpo.cd_cpf === '11144477735' && c.corpo.tp_perfil === 'LIMPEZA' && c.corpo.ids_propriedade[0] === 1 && c.corpo.senha === senha, 'cria pela Edge Function criar-usuario: login, CPF só números, perfil Limpeza e pousada');
    ok((c.auth || '').startsWith('Bearer ey'), 'a criação vai com o login do ADMIN (a função confere o perfil)');
    ok(senha.length >= 12 && (await texto(page, 'p:has-text("Senha provisória")')).includes(senha), 'senha inicial gerada (12 caracteres) e mostrada uma vez para passar ao funcionário');

    db.respostas['POST fn:criar-usuario'] = { status: 409, corpo: { erro: 'login_em_uso', mensagem: 'Esse usuário já existe.' } };
    await page.click('button:has-text("Novo usuário")');
    await page.fill('#u-nome', 'Outra Pessoa'); await page.fill('#u-login', 'ana.souza'); await page.check('text=Solar do Espinhaço');
    await page.click('button[type=submit]:has-text("Salvar")');
    ok((await texto(page, '[role=alert]')).includes('já existe') && (await texto(page, '[role=alert]')).includes('outra.pessoa'), 'usuário repetido: avisa antes do servidor e sugere outro');
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
    ok(await page.locator('button[aria-label^="Subir"], button[aria-label^="Descer"]').count() === 0, 'sem botões de subir e descer: a ordem muda arrastando');
    // arrastar Banheiro (1º) para baixo de Sala (2º) pela alça
    const h = await page.locator('[data-ambiente="Banheiro"] [data-alca]').first().boundingBox();
    const alvo = await page.locator('[data-ambiente="Sala"]').boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2, alvo.y + alvo.height * 0.8, { steps: 8 }); await page.mouse.up();
    await page.waitForSelector('text=Ordem salva');
    let patches = db.chamadas.filter((c) => c.m === 'PATCH' && c.caminho === 'VST_AMBIENTE');
    ok(patches.length === 2 && patches.some((x) => x.corpo.NO_ORDEM === 1) && patches.some((x) => x.corpo.NO_ORDEM === 2)
      && (await page.locator('[data-ambiente]').evaluateAll((l) => l.map((x) => x.getAttribute('data-ambiente')).join(','))) === 'Sala,Banheiro', 'arrastar pela alça muda a ordem e grava');
    // teclado: seta para cima na alça devolve Banheiro ao topo
    await page.locator('[data-ambiente="Banheiro"] [data-alca]').first().focus(); await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(600);
    ok((await page.locator('[data-ambiente]').evaluateAll((l) => l.map((x) => x.getAttribute('data-ambiente')).join(','))) === 'Banheiro,Sala', 'no teclado, setas na alça também mudam a ordem');
    await page.locator('[data-ambiente="Banheiro"] button:has-text("Adicionar item")').click();
    await page.fill('#i-nome', 'Toalhas de banho'); await page.fill('#i-qtde', '-1'); await page.click('form[aria-label=Item] button[type=submit]');
    ok((await texto(page, '[role=alert]')).includes('0 a 999') && !ultima(db, 'POST', 'VST_ITEM'), 'quantidade negativa: avisa e não grava');
    await page.fill('#i-qtde', '4'); await page.check('text=Item crítico'); await page.check('text=Foto obrigatória');
    await page.click('form[aria-label=Item] button[type=submit]');
    await page.waitForSelector('[data-item="Toalhas de banho"]');
    const pi = ultima(db, 'POST', 'VST_ITEM');
    ok(pi && pi.corpo.QTDE_ESPERADA === 4 && pi.corpo.SG_CRITICO === true && pi.corpo.SG_FOTO_OBRIGATORIA === true && pi.corpo.ID_AMBIENTE === db.ambientes.find((a) => a.NM_AMBIENTE === 'Banheiro').ID_AMBIENTE, 'inclui o item no ambiente certo, com crítico, foto e quantidade');
    const idToalhas = db.itens.find((x) => x.NM_ITEM === 'Toalhas de banho').ID_ITEM, ativos = db.tipos.filter((t) => t.SG_ATIVO).map((t) => t.ID_TIPO_VISTORIA);
    ok(ativos.length >= 2 && ativos.every((t) => db.tipoItens.some((x) => x.ID_ITEM === idToalhas && x.ID_TIPO_VISTORIA === t)), 'item novo já entra em todas as vistorias ativas (um passo só, sem ir à T31)');
    ok((await texto(page, '[data-aviso]')).includes('incluído e usado em'), 'avisa em quais vistorias o item passou a valer');
    const banheiro = await texto(page, '[data-ambiente="Banheiro"]');
    ok(!/\d+ ite(m|ns)\b/.test(banheiro) && ['Crítico', 'Foto', '4', 'Entrada'].every((t) => banheiro.includes(t)), 'ambiente sem a contagem de itens; o item mostra etiquetas (crítico, foto, quantidade, vistorias)');
    await page.click('button[aria-label="Editar Toalhas de banho"]');
    ok(await page.locator('[data-item="Toalhas de banho"] form[aria-label=Item]').count() === 1 && (await texto(page, 'form[aria-label=Item]')).includes('Editando: Toalhas de banho · Banheiro'), 'editar abre o formulário junto do item, dizendo o que está sendo editado');
    await page.click('form[aria-label=Item] button:has-text("Cancelar")');
    await page.click('button[aria-label="Renomear Banheiro"]');
    ok(await page.locator('[data-ambiente="Banheiro"] form[aria-label=Ambiente]').count() === 1 && (await texto(page, 'form[aria-label=Ambiente]')).includes('Renomeando: Banheiro'), 'renomear abre o formulário dentro do próprio ambiente');
    await page.click('form[aria-label=Ambiente] button:has-text("Cancelar")');
    if (process.env.FOTO2) { await page.setViewportSize({ width: 390, height: 900 }); await page.locator('[data-ambiente="Banheiro"]').screenshot({ path: process.env.FOTO2 }); await page.setViewportSize({ width: 1280, height: 720 }); }
    // item sem nenhum tipo marcado: não chega ao vistoriador, e a tela avisa com botão para corrigir
    await page.locator('[data-ambiente="Sala"] button:has-text("Adicionar item")').click();
    await page.fill('#i-nome', 'Sofá');
    for (const c of await page.locator('fieldset:has(legend:has-text("Usar nas vistorias")) input[type=checkbox]').all()) await c.uncheck();
    ok((await texto(page, 'fieldset:has(legend:has-text("Usar nas vistorias"))')).includes('não aparece em vistoria nenhuma'), 'sem tipo marcado: avisa que o item não aparece');
    await page.setViewportSize({ width: 320, height: 720 });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'formulário do item com a escolha das vistorias cabe em 320 px');
    if (process.env.FOTO) await page.locator('form[aria-label=Item]').screenshot({ path: process.env.FOTO });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.click('form[aria-label=Item] button[type=submit]');
    await page.waitForSelector('text=1 item ainda não está em nenhuma vistoria');
    const idSofa = db.itens.find((x) => x.NM_ITEM === 'Sofá').ID_ITEM;
    ok(!db.tipoItens.some((x) => x.ID_ITEM === idSofa), 'item sem tipo marcado não é ligado a nenhum tipo');
    // filtro por tipo de vistoria: só os itens que entram nela; sem alça (a ordem muda só em Todas)
    await page.getByRole('radio', { name: 'Entrada' }).click(); await page.waitForTimeout(300);
    ok(await page.locator('[data-item="Toalhas de banho"]').count() === 1 && await page.locator('[data-item="Sofá"]').count() === 0
      && (await texto(page, 'main')).includes('1 item entra na vistoria de Entrada') && await page.locator('[data-item] [data-alca]').count() === 0, 'filtro Entrada mostra só os itens dessa vistoria');
    ok((await texto(page, '[data-ambiente="Sala"]')).includes('Nenhum item deste ambiente entra nesta vistoria'), 'ambiente sem itens no filtro explica');
    await page.getByRole('radio', { name: 'Todas' }).click(); await page.waitForTimeout(300);
    ok(await page.locator('[data-item="Sofá"]').count() === 1, 'Todas volta a mostrar todos os itens');
    await page.click('button:has-text("Incluir em todas as vistorias")');
    await page.waitForSelector('text=1 item incluído em todas as vistorias');
    ok(ativos.every((t) => db.tipoItens.some((x) => x.ID_ITEM === idSofa && x.ID_TIPO_VISTORIA === t)) && await page.locator('text=ainda não está em nenhuma vistoria').count() === 0, 'um clique liga o item solto a todas as vistorias e a faixa de alerta some');
    ok(await page.locator('button[aria-label="Ocultar Toalhas de banho"] svg').count() === 1, 'olho aberto: o item aparece nas vistorias');
    await page.click('button[aria-label="Ocultar Toalhas de banho"]');
    await page.waitForSelector('text=Item oculto');
    ok(await page.locator('button[aria-label="Mostrar Toalhas de banho"][aria-pressed=true] svg').count() === 2, 'oculto: o olho ganha um x e o botão passa a mostrar de novo');
    ok(ultima(db, 'PATCH', 'VST_ITEM').corpo.SG_ATIVO === false && !db.chamadas.some((c) => c.m === 'DELETE' && c.caminho.startsWith('VST_')), 'desativar não apaga (histórico das vistorias preservado)');
    await ctx.close();
  });

  console.log('── T31 Tipos de vistoria');
  await T('t31', async () => {
    let db = novoBanco('GESTOR'); let { ctx, page } = await abrir(browser, db, '/admin/tipos');
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=sem-permissao'), 'gestor não entra na T31 (só ADMIN)');
    await ctx.close();
    db = novoBanco();
    db.ambientes = [{ ID_AMBIENTE: 10, ID_UNIDADE: 1, NM_AMBIENTE: 'Banheiro', NO_ORDEM: 1, SG_ATIVO: true }];
    db.itens = [{ ID_ITEM: 20, ID_AMBIENTE: 10, NM_ITEM: 'Torneira', DS_ORIENTACAO: null, SG_CRITICO: true, SG_FOTO_OBRIGATORIA: true, QTDE_ESPERADA: null, NO_ORDEM: 1, SG_ATIVO: true },
                { ID_ITEM: 21, ID_AMBIENTE: 10, NM_ITEM: 'Toalhas', DS_ORIENTACAO: null, SG_CRITICO: false, SG_FOTO_OBRIGATORIA: false, QTDE_ESPERADA: 4, NO_ORDEM: 2, SG_ATIVO: false }];
    ({ ctx, page } = await abrir(browser, db, '/admin/tipos'));
    await page.waitForSelector('[data-tipo="ENTRADA"]');
    ok(await page.isVisible('[data-tipo="ENTRADA"] >> text=usado pelo site') && !(await page.isVisible('[data-tipo="ENTRADA"] button:has-text("Desativar")')), 'Entrada e Saída aparecem como do site, sem opção de desativar');
    await page.locator('[data-tipo="SAIDA"] button:has-text("Editar")').click();
    ok(await page.isDisabled('#t-codigo') && await page.isDisabled('button[aria-label^="Comportamento:"]'), 'Saída: código e comportamento travados na tela');
    db.respostas['PATCH VST_TIPO_VISTORIA'] = { status: 400, corpo: { code: 'P0001', message: 'tipo_do_site' } };
    await page.click('button:has-text("Salvar tipo")');
    ok((await texto(page, '[role=alert]')).includes('usadas pelo site'), 'se o banco recusar mudança em tipo do site, a tela explica');
    delete db.respostas['PATCH VST_TIPO_VISTORIA'];
    await page.click('button:has-text("Cancelar")');
    await page.click('button:has-text("Novo tipo")');
    await page.fill('#t-codigo', 'rotina mensal'); await page.fill('#t-nome', 'Rotina mensal');
    ok(await page.inputValue('#t-codigo') === 'ROTINA_MENSAL', 'código vira MAIÚSCULAS com _ enquanto digita');
    await page.uncheck('form >> text=Vistoria');
    ok((await texto(page, 'form [role=alert]')).includes('ao menos um perfil') && await page.isDisabled('button:has-text("Salvar tipo")'), 'sem perfil: avisa e não salva');
    await page.check('form >> text=Limpeza'); await escolher(page, 'Periodicidade', 'Mensal');
    await page.click('button:has-text("Salvar tipo")');
    await page.waitForSelector('[data-tipo="ROTINA_MENSAL"]');
    const pt = ultima(db, 'POST', 'VST_TIPO_VISTORIA');
    ok(pt && pt.corpo.CD_TIPO_VISTORIA === 'ROTINA_MENSAL' && pt.corpo.TP_PERIODICIDADE === 'MENSAL' && JSON.stringify(pt.corpo.DS_PERFIS) === '["LIMPEZA"]', 'cria o tipo com código, periodicidade e perfis');
    await page.locator('[data-tipo="ROTINA_MENSAL"] button:has-text("Desativar")').click(); await page.waitForSelector('text=Tipo desativado');
    await page.locator('[data-tipo="ROTINA_MENSAL"] button:has-text("Ativar")').click();
    ok((await texto(page, '[role=alert]')).includes('ao menos um item'), 'não ativa tipo sem itens no checklist');
    await page.locator('[data-tipo="ROTINA_MENSAL"] button:has-text("Itens do checklist")').click();
    await page.waitForSelector('section[aria-label="Itens do tipo"] >> text=Torneira');
    ok(!(await page.isVisible('section[aria-label="Itens do tipo"] >> text=Toalhas')), 'só itens ativos podem entrar no checklist');
    await page.check('section[aria-label="Itens do tipo"] >> text=Torneira');
    await page.waitForSelector('text=1 de 1 itens');
    const idNovo = db.tipos.find((t) => t.CD_TIPO_VISTORIA === 'ROTINA_MENSAL').ID_TIPO_VISTORIA;
    ok(await esperar(() => db.tipoItens.some((x) => x.ID_TIPO_VISTORIA === idNovo && x.ID_ITEM === 20)), 'marcar inclui o item no tipo');
    await page.locator('[data-tipo="ROTINA_MENSAL"] button:has-text("Ativar")').click(); await page.waitForSelector('text=Tipo ativado');
    ok(ultima(db, 'PATCH', 'VST_TIPO_VISTORIA').corpo.SG_ATIVO === true, 'com itens, o tipo é ativado');
    await page.uncheck('section[aria-label="Itens do tipo"] >> text=Torneira');
    await page.waitForSelector('text=0 de 1 itens');
    ok(await esperar(() => !db.tipoItens.some((x) => x.ID_TIPO_VISTORIA === idNovo)), 'desmarcar retira o item do tipo');
    await ctx.close();
  });

  ok(errosJS.length === 0, 'nenhum erro de JavaScript' + (errosJS[0] ? ': ' + errosJS[0] : ''));
  await browser.close();
  console.log(falhas ? `\n${falhas} FALHA(S) em ${total}` : `\nTODAS AS ${total} VERIFICAÇÕES PASSARAM`);
  process.exit(falhas ? 1 : 0);
})();
