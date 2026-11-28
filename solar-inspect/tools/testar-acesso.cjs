// Testa as telas de acesso (T01–T04) no navegador, com o Supabase simulado (nada vai ao banco real).
// Uso: npx vite build && (npx vite preview --port 4173 &) && node tools/testar-acesso.cjs
const { chromium } = require('playwright');
const BASE = process.env.APP_URL || 'http://localhost:4173';
const SUPA = 'https://tnjpyjbqcjrowzjfnuln.supabase.co';
const CHAVE = 'sb_publishable_VJqLlw2XZu8v5GSAWWfOfw_qUYdyXDF';
const UID = '00000000-0000-4000-8000-0000000000a1';
let falhas = 0, total = 0; const errosJS = [];
const ok = (c, m) => { total++; if (c) console.log('ok  ' + m); else { falhas++; console.log('FALHOU: ' + m); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (exp) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp })}.assinatura`;
const agora = () => Math.floor(Date.now() / 1000);
const sessao = () => ({ access_token: jwt(agora() + 3600), refresh_token: 'refresh-1', expires_in: 3600, expires_at: agora() + 3600, token_type: 'bearer', user: { id: UID, aud: 'authenticated', email: 'ana@usuarios.inspect.invalid' } });

// cenário do "banco": o que cada endpoint devolve
function servidor(page, cen) {
  const log = [];
  return page.route(SUPA + '/**', async (route) => {
    const req = route.request(), url = req.url(), h = req.headers();
    log.push({ url, metodo: req.method(), apikey: h['apikey'], auth: h['authorization'] });
    page.__log = log;
    const json = (status, corpo, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...extra }, body: corpo === undefined ? '' : JSON.stringify(corpo) });
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/token') && url.includes('grant_type=password')) {
      cen.reauth = JSON.parse(req.postData() || '{}');
      return cen.senhaAtual && cen.reauth.password !== cen.senhaAtual ? json(400, { code: 'invalid_credentials', message: 'Invalid login credentials' }) : json(200, sessao());
    }
    if (url.includes('/auth/v1/user') && req.method() === 'PUT') { cen.novaSenha = JSON.parse(req.postData() || '{}').password; return json(200, { id: UID, aud: 'authenticated', email: 'ana@usuarios.inspect.invalid' }); }
    if (url.includes('/auth/v1/logout')) { cen.logoutUrl = url; if (url.includes('scope=others')) { cen.outros = true; return json(204); } }
    if (url.includes('/rest/v1/rpc/vst_senha_trocada')) { cen.trocou = true; cen.usuario = { ...(cen.usuario || {}), SG_TROCAR_SENHA: false }; return json(204); }
    if (url.includes('/auth/v1/user')) return cen.usuarioValido === false ? json(401, { message: 'invalid JWT' }) : json(200, { id: UID, aud: 'authenticated', role: 'authenticated' });
    if (url.includes('/auth/v1/logout')) { cen.saiu = true; return json(204); }
    if (url.includes('/rest/v1/VST_USUARIO_PROPRIEDADE')) return json(200, [], { 'content-range': `*/${cen.propriedades ?? 1}` });
    if (url.includes('/rest/v1/VST_USUARIO')) {
      const linha = cen.usuario === null ? null : { NM_USUARIO: 'Ana', TP_PERFIL: 'ASSESSOR', SG_ATIVO: true, DT_ACEITE_LGPD: '2026-11-20T12:00:00Z', ...(cen.usuario || {}) };
      const objeto = (h['accept'] || '').includes('vnd.pgrst.object');
      if (objeto) return linha ? json(200, linha) : json(406, { code: 'PGRST116', message: 'no rows' });
      return json(200, linha ? [linha] : []);
    }
    if (url.includes('/rest/v1/rpc/vst_registrar_aceite_lgpd')) { cen.aceitou = (cen.aceitou || 0) + 1; if (!cen.aceiteFalha) cen.usuario = { ...(cen.usuario || {}), DT_ACEITE_LGPD: '2026-11-21T10:00:00Z' }; return cen.aceiteFalha ? json(500, { message: 'x' }) : json(200, '2026-11-21T10:00:00Z'); }
    if (url.includes('/functions/v1/login-vistoria')) {
      cen.corpoLogin = JSON.parse(req.postData() || '{}');
      const r = cen.login || { status: 200 };
      if (r.status === 200) return json(200, { sessao: sessao(), usuario: { id: UID, nome: 'Ana', perfil: 'ASSESSOR' } });
      return json(r.status, r.corpo || { erro: 'x' });
    }
    return json(404, { message: 'endpoint não esperado: ' + url });
  });
}

async function abrir(browser, cen, { comSessao = false, cache = null, offline = false, rota = '/', gps = null } = {}) {
  const ctx = await browser.newContext(gps === true ? { permissions: ['geolocation'], geolocation: { latitude: -19.0849, longitude: -43.5969 } } : {});
  const page = await ctx.newPage();
  const erros = []; page.on('pageerror', (e) => { erros.push(e.message); errosJS.push(e.message); }); page.__erros = erros;
  if (offline) {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false }));
    await page.route(SUPA + '/**', (r) => r.abort('internetdisconnected'));
  } else await servidor(page, cen);
  await page.goto(BASE + '/__vazio__');                       // mesma origem, para preparar o armazenamento
  await page.evaluate(([s, c]) => { localStorage.clear(); if (s) localStorage.setItem('inspect.sessao', JSON.stringify(s)); if (c) localStorage.setItem('inspect.acesso', JSON.stringify(c)); }, [comSessao ? sessao() : null, cache]);
  await page.goto(BASE + rota).catch(() => {});
  return { ctx, page };
}
const caminho = (page) => new URL(page.url()).pathname + new URL(page.url()).search;
const esperarRota = async (page, prefixo, ms = 6000) => { try { await page.waitForURL((u) => (u.pathname + u.search).startsWith(prefixo), { timeout: ms }); return true; } catch { return false; } };
const temSessao = (page) => page.evaluate(() => !!localStorage.getItem('inspect.sessao'));

(async () => {
  const browser = await chromium.launch();
  const T = async (nome, fn) => { try { await fn(); } catch (e) { falhas++; total++; console.log('FALHOU: ' + nome + ' — ' + e.message.split('\n')[0]); } };

  console.log('── T01 Inicialização');
  await T('t01', async () => {
    let { ctx, page } = await abrir(browser, {});
    ok(await esperarRota(page, '/login'), 'sem sessão → login');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, {}, { comSessao: true }));
    ok(await esperarRota(page, '/app/unidades'), 'assessor ativo, com pousada e aceite → Minhas unidades');
    ok(page.__log.every((r) => r.apikey === CHAVE), 'toda chamada ao Supabase usa só a chave publicável');
    ok(page.__log.filter((r) => r.url.includes('/rest/v1/')).every((r) => (r.auth || '').startsWith('Bearer ey')), 'consultas ao banco vão com o token do usuário (RLS)');
    ok(await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('inspect.acesso')); return c && c.perfil === 'ASSESSOR' && !('senha' in c) && !('access_token' in c); }), 'cache guarda só nome, perfil e aceite (sem senha nem token)');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, { usuario: { DT_ACEITE_LGPD: null } }, { comSessao: true }));
    ok(await esperarRota(page, '/permissao-localizacao'), 'sem aceite de localização → T03');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, { usuario: { TP_PERFIL: 'GESTOR', DT_ACEITE_LGPD: null } }, { comSessao: true }));
    ok(await esperarRota(page, '/gestao'), 'gestor → painel de gestão');
    await ctx.close();

    const cenI = { usuario: { SG_ATIVO: false } };
    ({ ctx, page } = await abrir(browser, cenI, { comSessao: true }));
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=inativo'), 'usuário desativado → T04 inativo');
    ok(!(await temSessao(page)), 'usuário desativado: sessão apagada do aparelho');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, { usuario: null }, { comSessao: true }));
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=sem-permissao'), 'login sem cadastro na equipe → T04 sem permissão');
    ok(!(await temSessao(page)), 'sem cadastro: sessão apagada');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, { propriedades: 0 }, { comSessao: true }));
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=sem-permissao'), 'assessor sem pousada → T04 sem permissão');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, { propriedades: 0, usuario: { TP_PERFIL: 'ADMIN' } }, { comSessao: true }));
    ok(await esperarRota(page, '/gestao'), 'ADMIN sem pousada vinculada entra (vê todas)');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, { usuarioValido: false }, { comSessao: true }));
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=sessao-expirada'), 'token recusado pelo servidor → T04 sessão expirada');
    ok(!(await temSessao(page)), 'token recusado: sessão apagada');
    await ctx.close();

    const cache = { uid: UID, nome: 'Ana', perfil: 'ASSESSOR', aceite: true, conferidoEm: Date.now() - 3600e3 };
    ({ ctx, page } = await abrir(browser, {}, { comSessao: true, cache, offline: true }));
    ok(await esperarRota(page, '/app/unidades'), 'sem internet, acesso conferido há 1 h → abre o app');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, {}, { comSessao: true, cache: { ...cache, conferidoEm: Date.now() - 80 * 3600e3 }, offline: true }));
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=offline'), 'sem internet há mais de 72 h → T04 sem conexão');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, {}, { comSessao: true, cache: { ...cache, uid: 'outro' }, offline: true }));
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=offline'), 'cache de outro usuário não vale offline');
    await ctx.close();
  });

  console.log('── T02 Login');
  const entrarCom = async (page, login, senha) => {
    await page.waitForSelector('#login-id');
    await page.fill('#login-id', login); await page.fill('#login-senha', senha);
    await page.click('button[type=submit]');
  };
  const mensagem = async (page) => { try { return (await page.textContent('#login-error', { timeout: 4000 })) || ''; } catch { return ''; } };
  await T('t02', async () => {
    let cen = {}; let { ctx, page } = await abrir(browser, cen, { rota: '/login' });
    ok(await page.getAttribute('#login-senha', 'type') === 'password' && await page.getAttribute('#login-senha', 'autocomplete') === 'current-password', 'senha mascarada e com autocomplete de senha');
    await page.fill('#login-senha', 'abc'); await page.click('button[aria-label="Mostrar senha"]');
    ok(await page.getAttribute('#login-senha', 'type') === 'text', 'botão mostra a senha quando pedido');
    await page.click('button[aria-label="Ocultar senha"]'); await page.fill('#login-senha', '');
    await entrarCom(page, 'ana.souza', 'senha-boa-123');
    ok(await esperarRota(page, '/app/unidades'), 'login por usuário e senha → Minhas unidades');
    ok(cen.corpoLogin && cen.corpoLogin.login === 'ana.souza' && cen.corpoLogin.senha === 'senha-boa-123', 'envia usuário e senha só para a Edge Function login-vistoria');
    ok(await temSessao(page), 'sessão do Supabase gravada no aparelho');
    ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('senha-boa-123') && !page.url().includes('senha'), 'a senha não fica no armazenamento nem no endereço');
    await ctx.close();

    cen = {}; ({ ctx, page } = await abrir(browser, cen, { rota: '/login' }));
    await page.waitForSelector('#login-id'); await page.type('#login-id', '52998224725'); await page.fill('#login-senha', 'senha-boa-123'); await page.click('button[type=submit]');
    ok(await esperarRota(page, '/app/unidades') && cen.corpoLogin.login === '529.982.247-25', 'login pelo CPF (máscara aplicada) funciona');
    await ctx.close();

    cen = { login: { status: 401, corpo: { erro: 'credenciais_invalidas' } } }; ({ ctx, page } = await abrir(browser, cen, { rota: '/login' }));
    await entrarCom(page, 'ana.souza', 'errada-123');
    ok((await mensagem(page)).includes('não conferem'), 'credenciais erradas: mensagem genérica (não diz se o usuário existe)');
    ok(await page.inputValue('#login-senha') === '' && caminho(page).startsWith('/login') && !(await temSessao(page)), 'credenciais erradas: senha apagada, continua no login, sem sessão');
    await ctx.close();

    for (const [st, trecho, nome] of [[429, 'Muitas tentativas', 'limite de tentativas'], [503, 'Não foi possível entrar', 'serviço indisponível'], [500, 'Não foi possível entrar', 'erro inesperado']]) {
      cen = { login: { status: st } }; ({ ctx, page } = await abrir(browser, cen, { rota: '/login' }));
      await entrarCom(page, 'ana.souza', 'x-123456');
      ok((await mensagem(page)).includes(trecho), `${nome} (${st}): mensagem certa`);
      await ctx.close();
    }

    cen = {}; ({ ctx, page } = await abrir(browser, cen, { rota: '/login' }));
    await entrarCom(page, 'ana.souza', '');
    ok((await mensagem(page)).includes('Informe sua senha') && !cen.corpoLogin, 'sem senha: avisa e não chama o servidor');
    await page.fill('#login-id', ''); await page.type('#login-id', '11144477736'); await page.fill('#login-senha', 'x'); await page.click('button[type=submit]');
    ok((await mensagem(page)).includes('CPF inválido') && !cen.corpoLogin, 'CPF inválido: avisa e não chama o servidor');
    await ctx.close();

    cen = { usuario: { SG_ATIVO: false } }; ({ ctx, page } = await abrir(browser, cen, { rota: '/login' }));
    await entrarCom(page, 'ana.souza', 'senha-boa-123');
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=inativo') && !(await temSessao(page)), 'login aceito mas cadastro desativado → T04 inativo, sessão apagada');
    await ctx.close();

    cen = { usuario: { TP_PERFIL: 'GESTOR' } }; ({ ctx, page } = await abrir(browser, cen, { rota: '/login' }));
    await entrarCom(page, 'gestor.um', 'senha-boa-123');
    ok(await esperarRota(page, '/gestao'), 'gestor entra no painel de gestão');
    await ctx.close();

    cen = { usuario: { DT_ACEITE_LGPD: null } }; ({ ctx, page } = await abrir(browser, cen, { rota: '/login' }));
    await entrarCom(page, 'ana.souza', 'senha-boa-123');
    ok(await esperarRota(page, '/permissao-localizacao'), 'primeiro acesso da equipe de campo → T03 (aceite de localização)');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, {}, { rota: '/login', offline: true }));
    await page.waitForSelector('#login-id');
    ok(await page.isDisabled('button[type=submit]'), 'sem internet: botão Entrar desabilitado');
    await ctx.close();
  });

  console.log('── T03 Permissão de localização');
  await T('t03', async () => {
    let cen = { usuario: { DT_ACEITE_LGPD: null } }; let { ctx, page } = await abrir(browser, cen, { comSessao: true, gps: true });
    ok(await esperarRota(page, '/permissao-localizacao'), 'primeiro acesso abre a T03');
    await page.waitForSelector('text=Tudo pronto', { timeout: 5000 });
    ok(await page.isVisible('text=conforme a LGPD'), 'explica o aceite (localização e fotos, LGPD) antes de continuar');
    await page.click('button:has-text("Continuar")');
    ok(await esperarRota(page, '/app/unidades') && cen.aceitou === 1, 'Continuar grava o aceite no banco (1 chamada) e segue para Minhas unidades');
    await ctx.close();

    cen = { usuario: { DT_ACEITE_LGPD: null }, aceiteFalha: true }; ({ ctx, page } = await abrir(browser, cen, { comSessao: true, gps: true, rota: '/permissao-localizacao' }));
    await page.waitForSelector('text=Tudo pronto', { timeout: 5000 }); await page.click('button:has-text("Continuar")');
    await page.waitForSelector('text=Não foi possível registrar o aceite', { timeout: 5000 });
    ok(caminho(page).startsWith('/permissao-localizacao'), 'falha ao gravar o aceite: avisa e não deixa seguir sem registro');
    await ctx.close();

    cen = {}; ({ ctx, page } = await abrir(browser, cen, { comSessao: true, gps: true, rota: '/permissao-localizacao' }));
    await page.waitForSelector('text=Tudo pronto', { timeout: 5000 }); await page.click('button:has-text("Continuar")');
    ok(await esperarRota(page, '/app/unidades') && !cen.aceitou, 'aceite já registrado: segue sem gravar de novo');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, {}, { gps: true, rota: '/permissao-localizacao' }));
    await page.waitForSelector('text=Tudo pronto', { timeout: 5000 }); await page.click('button:has-text("Continuar")');
    ok(await esperarRota(page, '/login'), 'sem sessão: Continuar leva ao login (nada é gravado)');
    await ctx.close();

    cen = { usuario: { SG_ATIVO: false, DT_ACEITE_LGPD: null } }; ({ ctx, page } = await abrir(browser, cen, { comSessao: true, gps: true, rota: '/permissao-localizacao' }));
    await page.waitForSelector('text=Tudo pronto', { timeout: 5000 }); await page.click('button:has-text("Continuar")');
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=inativo') && !cen.aceitou, 'usuário desativado: vai para T04 sem gravar aceite');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, { usuario: { DT_ACEITE_LGPD: null } }, { comSessao: true, rota: '/permissao-localizacao' }));
    await page.waitForSelector('button:has-text("Permitir localização")'); await page.click('button:has-text("Permitir localização")');
    await page.waitForSelector('button:has-text("Não consigo permitir")', { timeout: 20000 });
    await page.click('button:has-text("Não consigo permitir")');
    ok(await esperarRota(page, '/acesso-indisponivel?motivo=sem-localizacao'), 'localização negada → T04 localização necessária');
    await ctx.close();
  });

  console.log('── T04 Acesso indisponível e Sair');
  await T('t04', async () => {
    for (const [motivo, titulo] of [['inativo', 'Usuário inativo'], ['sem-permissao', 'Sem permissão de acesso'], ['sessao-expirada', 'Sessão expirada'], ['offline', 'Sem conexão'], ['sem-localizacao', 'Localização necessária']]) {
      const { ctx, page } = await abrir(browser, {}, { rota: '/acesso-indisponivel?motivo=' + motivo });
      ok(await page.isVisible(`h1:has-text("${titulo}")`), `motivo ${motivo}: mostra "${titulo}"`);
      await ctx.close();
    }
    let cen = {}; let { ctx, page } = await abrir(browser, cen, { comSessao: true, rota: '/acesso-indisponivel?motivo=sessao-expirada' });
    await page.click('button:has-text("Voltar ao login")');
    ok(await esperarRota(page, '/login') && !(await temSessao(page)) && !(await page.evaluate(() => localStorage.getItem('inspect.acesso'))), 'Voltar ao login apaga sessão e cache do aparelho');
    await ctx.close();
    ({ ctx, page } = await abrir(browser, {}, { rota: '/acesso-indisponivel?motivo=offline' }));
    await page.click('button:has-text("Tentar novamente")');
    ok(await esperarRota(page, '/login'), 'Tentar novamente refaz a conferência (T01)');
    await ctx.close();
    ({ ctx, page } = await abrir(browser, {}, { rota: '/acesso-indisponivel?motivo=<script>alert(1)</script>' }));
    ok(await page.isVisible('h1:has-text("Sem permissão de acesso")'), 'motivo desconhecido ou malicioso cai no padrão (nada do endereço é exibido)');
    await ctx.close();
  });

  console.log('── Sair (T05)');
  await T('sair', async () => {
    const cen = {}; const { ctx, page } = await abrir(browser, cen, { comSessao: true });
    await esperarRota(page, '/app/unidades');
    const botao = page.locator('button:has([data-icon="solar:logout-2-linear"]), button[aria-label*="Sair"]').first();
    await botao.click();
    ok(await esperarRota(page, '/login') && !(await temSessao(page)), 'Sair em Minhas unidades apaga a sessão do aparelho');
    await page.goto(BASE + '/');
    ok(await esperarRota(page, '/login'), 'depois de sair, abrir o app volta ao login');
    await ctx.close();
  });

  console.log('── T35 Trocar senha');
  await T('t35', async () => {
    const cen = { usuario: { SG_TROCAR_SENHA: true }, senhaAtual: 'Provisoria-1' };
    let { ctx, page } = await abrir(browser, cen, { comSessao: true });
    ok(await esperarRota(page, '/conta/senha'), 'senha provisória → T35 antes de qualquer tela');
    await page.getByRole('heading', { name: 'Crie sua senha' }).waitFor({ timeout: 5000 });
    ok(await page.getByRole('button', { name: 'Sair' }).isVisible() && !(await page.getByRole('button', { name: 'Cancelar' }).count()), 'troca obrigatória: só salvar ou sair (sem cancelar)');
    await page.setViewportSize({ width: 320, height: 720 });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'T35 cabe em 320 px sem rolagem lateral');
    if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO });
    await page.setViewportSize({ width: 1280, height: 720 });
    const preencher = async (a, n, c) => { await page.fill('#senha-atual', a); await page.fill('#senha-nova', n); await page.fill('#senha-conf', c); await page.click('button[type=submit]'); };
    await preencher('Provisoria-1', 'somenteletras', 'somenteletras');
    await page.getByText('Misture letras e números.').waitFor({ timeout: 3000 });
    ok(!cen.reauth && !cen.novaSenha, 'senha fraca é recusada na tela, sem ir ao servidor');
    await preencher('Provisoria-1', 'curta1', 'curta1');
    ok(await page.getByText('Use pelo menos 10 caracteres.').isVisible(), 'senha curta é recusada');
    await preencher('Provisoria-1', 'NovaSenha22', 'NovaSenha23');
    ok(await page.getByText('As senhas não são iguais.').isVisible() && !cen.novaSenha, 'confirmação diferente é recusada');
    await preencher('Provisoria-1', 'Provisoria-1', 'Provisoria-1');
    await page.getByText('A nova senha precisa ser diferente da atual.').waitFor({ timeout: 3000 });
    ok(!cen.novaSenha, 'nova igual à atual é recusada');
    await preencher('errada-123', 'NovaSenha22', 'NovaSenha22');
    await page.getByText('A senha atual não confere.').waitFor({ timeout: 5000 });
    ok(cen.reauth?.email === 'ana@usuarios.inspect.invalid' && !cen.novaSenha && !cen.trocou, 'senha atual errada: nada muda');
    await preencher('Provisoria-1', 'NovaSenha22', 'NovaSenha22');
    await page.getByRole('heading', { name: 'Senha alterada' }).waitFor({ timeout: 5000 });
    ok(cen.novaSenha === 'NovaSenha22', 'grava a nova senha no Auth do usuário logado');
    ok(cen.outros === true, 'encerra as sessões dos outros aparelhos');
    ok(cen.trocou === true, 'desmarca a senha provisória no banco');
    ok(await page.evaluate(() => !JSON.stringify(localStorage).includes('NovaSenha22') && !JSON.stringify(localStorage).includes('Provisoria-1')), 'nenhuma senha fica guardada no aparelho');
    await page.click('text=Continuar');
    ok(await esperarRota(page, '/app/unidades'), 'depois da troca segue para Minhas unidades');
    await page.goto(BASE + '/');
    ok(await esperarRota(page, '/app/unidades'), 'reabrir o app não pede a troca de novo');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, { usuario: { TP_PERFIL: 'ADMIN', SG_TROCAR_SENHA: true } }, { comSessao: true, rota: '/admin/usuarios' }));
    ok(await esperarRota(page, '/conta/senha'), 'ADMIN com senha provisória não abre a administração');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, {}, { comSessao: true, rota: '/conta/senha' }));
    await page.getByRole('heading', { name: 'Trocar senha' }).waitFor({ timeout: 5000 });
    ok(await page.getByRole('button', { name: 'Cancelar' }).isVisible() && await page.getByText('Senha atual', { exact: true }).isVisible(), 'troca voluntária: pede a senha atual e permite cancelar');
    await ctx.close();

    ({ ctx, page } = await abrir(browser, {}, { rota: '/conta/senha' }));
    ok(await esperarRota(page, '/login'), 'sem sessão, T35 manda para o login');
    await ctx.close();
  });

  ok(errosJS.length === 0, 'nenhum erro de JavaScript em nenhuma tela' + (errosJS.length ? ': ' + errosJS[0] : ''));
  await browser.close();
  console.log(falhas ? `\n${falhas} FALHA(S) em ${total}` : `\nTODAS AS ${total} VERIFICAÇÕES PASSARAM`);
  process.exit(falhas ? 1 : 0);
})();
