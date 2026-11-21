// Testa o fluxo de campo (T05–T19) no navegador, com o Supabase simulado (nada vai ao banco real).
// Uso: npx vite build && (npx vite preview --port 4173 &) && node tools/testar-campo.cjs
const { chromium } = require('playwright');
const BASE = process.env.APP_URL || 'http://localhost:4173';
const SUPA = 'https://tnjpyjbqcjrowzjfnuln.supabase.co';
const CHAVE = 'sb_publishable_VJqLlw2XZu8v5GSAWWfOfw_qUYdyXDF';
const UID = '00000000-0000-4000-8000-0000000000a1';
const AGENDADA = '11111111-2222-4333-8444-555555555555';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let falhas = 0, total = 0; const errosJS = [];
const ok = (c, m) => { total++; if (c) console.log('ok  ' + m); else { falhas++; console.log('FALHOU: ' + m); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const agora = () => Math.floor(Date.now() / 1000);
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, role: 'authenticated', exp: agora() + 3600 })}.assinatura`;
const sessao = () => ({ access_token: jwt(), refresh_token: 'r1', expires_in: 3600, expires_at: agora() + 3600, token_type: 'bearer', user: { id: UID, aud: 'authenticated', email: 'ana@usuarios.inspect.invalid' } });
const UVA = { id_unidade: 7, cd_unidade: 'CM', nm_unidade: 'Casa do Mirante', tp_unidade: 'CHALE', sg_ativo: true, id_propriedade: 1, nm_propriedade: 'Solar do Espinhaço',
  tp_situacao: 'LIBERADO', ds_andar: null, tp_validacao: 'GPS', vl_latitude: -19.0849, vl_longitude: -43.5969, qtde_raio_metros: 60, qtde_precisao_max_metros: 50 };
const CHECKLIST = [
  { id_ambiente: 10, nm_ambiente: 'Sala', ds_foto_referencia: null, id_item: 101, nm_item: 'Sofá', ds_orientacao: null, sg_critico: false, sg_foto_obrigatoria: false, qtde_esperada: null },
  { id_ambiente: 10, nm_ambiente: 'Sala', ds_foto_referencia: null, id_item: 102, nm_item: 'TV', ds_orientacao: null, sg_critico: false, sg_foto_obrigatoria: false, qtde_esperada: null },
  { id_ambiente: 11, nm_ambiente: 'Banheiro', ds_foto_referencia: null, id_item: 103, nm_item: 'Torneira', ds_orientacao: null, sg_critico: true, sg_foto_obrigatoria: true, qtde_esperada: null },
];
const TIPOS = [
  { id_tipo_vistoria: 1, cd_tipo_vistoria: 'ENTRADA', nm_tipo_vistoria: 'Entrada', tp_comportamento: 'ENTRADA', sg_exige_entrada: false, sg_exige_assinatura: false, qtde_itens: 3, id_vistoria: AGENDADA, dt_agendada: '2026-11-21', tp_status: 'AGENDADA', cd_reserva: 'R-1001' },
  { id_tipo_vistoria: 3, cd_tipo_vistoria: 'ROTINA', nm_tipo_vistoria: 'Rotina', tp_comportamento: 'ROTINA', sg_exige_entrada: false, sg_exige_assinatura: false, qtde_itens: 3, id_vistoria: null, dt_agendada: null, tp_status: null, cd_reserva: null },
  { id_tipo_vistoria: 4, cd_tipo_vistoria: 'MANUTENCAO', nm_tipo_vistoria: 'Manutenção', tp_comportamento: 'MANUTENCAO', sg_exige_entrada: false, sg_exige_assinatura: false, qtde_itens: 0, id_vistoria: null, dt_agendada: null, tp_status: null, cd_reserva: null },
];

function servidor(page, cen) {
  cen.rpc = {}; cen.uploads = []; cen.log = [];
  return page.route(SUPA + '/**', async (route) => {
    const req = route.request(), url = decodeURIComponent(req.url()), h = req.headers(), m = req.method();
    cen.log.push({ url, apikey: h['apikey'], auth: h['authorization'] });
    const json = (status, corpo, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...extra }, body: corpo === undefined ? '' : JSON.stringify(corpo) });
    const objeto = (h['accept'] || '').includes('vnd.pgrst.object');
    const um = (linha) => (objeto ? json(200, linha) : json(200, [linha]));
    const recusa = (codigo) => json(400, { code: 'P0001', message: codigo, details: null, hint: null });
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/user')) return json(200, { id: UID, aud: 'authenticated', role: 'authenticated' });
    if (url.includes('/rest/v1/VST_USUARIO_PROPRIEDADE')) return json(200, [], { 'content-range': '*/1' });
    if (url.includes('/rest/v1/VST_USUARIO')) return um({ NM_USUARIO: 'Ana', TP_PERFIL: 'ASSESSOR', SG_ATIVO: true, DT_ACEITE_LGPD: '2026-11-20T12:00:00Z', SG_TROCAR_SENHA: false, ...(cen.usuario || {}) });
    const rpc = url.match(/\/rest\/v1\/rpc\/(\w+)/)?.[1];
    if (rpc) {
      const a = JSON.parse(req.postData() || '{}');
      (cen.rpc[rpc] = cen.rpc[rpc] || []).push(a);
      if (rpc === 'vst_unidades') return json(200, [{ ...UVA, ...(cen.unidade || {}) }]);
      if (rpc === 'vst_tipos_unidade') return json(200, TIPOS);
      if (rpc === 'vst_checklist') return json(200, CHECKLIST);
      if (rpc === 'vst_criar_vistoria') return json(200, a.p_id_vistoria);
      if (rpc === 'vst_iniciar_vistoria') return cen.iniciarErro ? recusa(cen.iniciarErro) : json(200, [{ tp_status: 'EM_ANDAMENTO', sg_fora_raio: false, qtde_distancia_metros: 5, ds_sinalizacoes: null }]);
      if (rpc === 'vst_concluir_vistoria') {
        cen.situacao = 'OCUPADO';
        return json(200, [{ tp_status: 'CONCLUIDA', ds_sinalizacoes: cen.sinais ?? null, qtde_ocorrencias: a.p_respostas.filter((r) => r.tp_resposta === 'PROBLEMA').length, id_bloqueio: null }]);
      }
      return json(404, { message: 'rpc não esperada ' + rpc });
    }
    if (url.includes('/rest/v1/VST_OCORRENCIA')) return json(200, url.includes('ID_VISTORIA=in.') ? [] : [{ ID_OCORRENCIA: 1, ID_UNIDADE: 7, ID_ITEM: 101, TP_GRAVIDADE: 'MEDIA', DS_OCORRENCIA: 'Mancha no sofá', DT_ABERTURA: '2026-11-20T10:00:00Z' }]);
    if (url.includes('/rest/v1/VST_ITEM')) return json(200, [{ ID_ITEM: 101, NM_ITEM: 'Sofá', VST_AMBIENTE: { NM_AMBIENTE: 'Sala' } }]);
    if (url.includes('/rest/v1/VST_AMBIENTE')) return json(200, [{ ID_UNIDADE: 7 }, { ID_UNIDADE: 7 }]);
    if (url.includes('/rest/v1/VST_VISTORIA')) {
      if (url.includes('TP_SITUACAO_RESULTANTE') && url.includes('ID_VISTORIA=eq.')) return um({ TP_SITUACAO_RESULTANTE: cen.situacao ?? null });
      if (url.includes('ID_VISTORIA_ENTRADA')) return um({ ID_VISTORIA_ENTRADA: null });
      if (url.includes('ID_USUARIO=eq.')) return json(200, cen.historico ?? []);
      return json(200, [{ ID_UNIDADE: 7, DT_FIM: '2026-11-20T15:00:00Z', DS_SINALIZACOES: null, VST_TIPO_VISTORIA: { NM_TIPO_VISTORIA: 'Saída' }, VST_USUARIO: { NM_USUARIO: 'Ana' } }]);
    }
    if (url.includes('/storage/v1/object/vistorias/')) { cen.uploads.push(url.split('/storage/v1/object/vistorias/')[1]); return json(200, { Key: 'ok' }); }
    return json(404, { message: 'endpoint não esperado: ' + url });
  });
}

async function abrir(browser, cen, { comSessao = true, rota = '/app/unidades', longe = false } = {}) {
  const ctx = await browser.newContext({ permissions: ['geolocation'], geolocation: { latitude: longe ? -19.10 : -19.0849, longitude: -43.5969, accuracy: 8 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errosJS.push(e.message));
  await servidor(page, cen);
  await page.goto(BASE + '/__vazio__');
  await page.evaluate((s) => { localStorage.clear(); if (s) localStorage.setItem('inspect.sessao', JSON.stringify(s)); }, comSessao ? sessao() : null);
  await page.goto(BASE + rota).catch(() => {});
  return { ctx, page };
}
const esperarRota = async (page, caminho, ms = 8000) => { try { await page.waitForURL((u) => u.pathname === caminho || u.pathname.startsWith(caminho + '?'), { timeout: ms }); return true; } catch { return false; } };
const esperar = async (f, ms = 6000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await f()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };
const local = (page, k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);
const BASEV = '/app/vistorias/nova/7';

async function responder(page, item, rotulo) { await page.locator(`[role=radiogroup][aria-label="Resposta para ${item}"] [aria-label="${rotulo}"]`).first().click(); }
async function fotografar(page) {
  await page.locator('input[type=file]').waitFor({ state: 'attached', timeout: 6000 });
  await page.setInputFiles('input[type=file]', { name: 'f.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Usar foto' }).click();
}
async function assinarEnviar(page) {
  await page.getByRole('button', { name: /Assinar/ }).click();
  const c = page.locator('[aria-label="Área de assinatura"]'); await c.waitFor();
  const b = await c.boundingBox();
  await page.mouse.move(b.x + 20, b.y + 20); await page.mouse.down(); await page.mouse.move(b.x + 120, b.y + 60, { steps: 5 }); await page.mouse.up();
  await page.getByRole('button', { name: /Confirmar/ }).click();
  await page.getByRole('button', { name: /Enviar definitivamente/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar' }).click();
}

(async () => {
  const browser = await chromium.launch();
  const T = async (nome, fn) => { try { await fn(); } catch (e) { falhas++; total++; console.log('FALHOU: ' + nome + ' — ' + e.message.split('\n')[0]); } };

  console.log('── Proteção das rotas de campo');
  await T('guarda', async () => {
    let { ctx, page } = await abrir(browser, {}, { comSessao: false });
    ok(await esperarRota(page, '/login'), 'sem sessão, /app/unidades vai para o login');
    await ctx.close();
    ({ ctx, page } = await abrir(browser, { usuario: { SG_TROCAR_SENHA: true } }, { rota: BASEV + '/checklist' }));
    ok(await esperarRota(page, '/conta/senha'), 'senha provisória: nenhuma tela de campo abre antes da troca');
    await ctx.close();
    ({ ctx, page } = await abrir(browser, { usuario: { DT_ACEITE_LGPD: null } }, { rota: '/app/historico' }));
    ok(await esperarRota(page, '/permissao-localizacao'), 'sem aceite de localização: vai para T03');
    await ctx.close();
  });

  console.log('── T05 → T17: Entrada agendada pelo site, online');
  await T('fluxo', async () => {
    const cen = {};
    const { ctx, page } = await abrir(browser, cen);
    await page.getByText('Casa do Mirante').first().waitFor({ timeout: 8000 });
    ok(await page.getByText('Solar do Espinhaço').first().isVisible(), 'T05 lista a unidade do banco (vst_unidades) com a pousada');
    ok(cen.log.every((r) => r.apikey === CHAVE) && cen.log.filter((r) => r.url.includes('/rest/v1/')).every((r) => (r.auth || '').startsWith('Bearer ey')), 'só chave publicável + token do usuário (RLS)');
    await page.locator('a[href$="/app/unidades/7"]').first().click();
    ok(await esperarRota(page, '/app/unidades/7'), 'T05 → T06');
    await page.getByText('Mancha no sofá').waitFor({ timeout: 5000 });
    ok(await page.getByText('Sala', { exact: false }).first().isVisible(), 'T06 mostra a ocorrência aberta com o ambiente');
    await page.getByRole('button', { name: /Iniciar vistoria/ }).click();
    ok(await esperarRota(page, BASEV), 'T06 → T07');
    await page.getByText('Agendada para 21/11 · reserva R-1001', { exact: false }).waitFor({ timeout: 5000 });
    ok(true, 'T07 mostra a Entrada agendada pelo site com a reserva');
    ok(await page.getByText('Sem itens no checklist desta unidade', { exact: false }).isVisible() && await page.locator('input[value=manutencao]').isDisabled(), 'tipo sem itens fica indisponível');
    await page.locator('label', { hasText: 'Entrada' }).first().click();
    await page.getByRole('button', { name: /Validar presença/ }).click();
    const r = await local(page, 'solar-inspect:rascunho');
    ok(r && r.id === AGENDADA && r.avulsa === false && r.cdTipo === 'ENTRADA', 'o rascunho usa o UUID da vistoria agendada (não cria outra)');
    ok(await esperarRota(page, BASEV + '/checklist', 10000), 'T08 valida o GPS e abre o checklist');
    const ini = cen.rpc.vst_iniciar_vistoria?.[0];
    ok(ini && ini.p_id_vistoria === AGENDADA && ini.p_vl_latitude === -19.0849 && ini.p_dt_inicio && !cen.rpc.vst_criar_vistoria, 'T08 inicia a vistoria agendada no servidor com a posição (sem criar avulsa)');
    // T10/T11/T12
    await page.getByText('Sofá').first().waitFor({ timeout: 5000 });
    await responder(page, 'Sofá', 'OK');
    await responder(page, 'TV', 'Problema');
    ok(await esperarRota(page, BASEV + '/item/102'), 'Problema abre o detalhe do item (T11)');
    if (process.env.DEPURAR) console.log((await page.innerText('body')).slice(0, 900));
    await page.locator('label', { hasText: 'Média' }).click();
    await page.getByText('Adicionar foto').click();
    await fotografar(page);
    ok(await esperarRota(page, BASEV + '/item/102'), 'T12 guarda a foto e volta ao item');
    await page.getByRole('button', { name: /Concluir item/ }).click();
    ok(await esperarRota(page, BASEV + '/checklist'), 'T11 → checklist');
    await page.getByText('Torneira').first().waitFor({ timeout: 5000 });
    await responder(page, 'Torneira', 'OK');
    ok(await esperarRota(page, BASEV + '/item/103/foto'), 'item com foto obrigatória abre a câmera');
    await fotografar(page);
    ok(await esperarRota(page, BASEV + '/resumo', 10000), 'checklist completo abre o resumo (T15)');
    // T15/T16/T17
    await page.getByText('Torneira', { exact: false }).first().waitFor({ timeout: 3000 }).catch(() => {});
    await assinarEnviar(page);
    await page.getByRole('heading', { name: 'Vistoria enviada' }).waitFor({ timeout: 10000 });
    const c = cen.rpc.vst_concluir_vistoria?.[0];
    const resp = Object.fromEntries((c?.p_respostas || []).map((x) => [x.id_item, x]));
    ok(c && c.p_id_vistoria === AGENDADA && resp[101]?.tp_resposta === 'OK' && resp[103]?.tp_resposta === 'OK', 'T17 conclui no banco com todas as respostas');
    ok(resp[102]?.tp_resposta === 'PROBLEMA' && resp[102]?.tp_gravidade === 'MEDIA' && resp[102]?.ds_observacao, 'problema vai com a gravidade escolhida e descrição (o banco exige)');
    const fotos = c?.p_fotos || [];
    ok(fotos.length === 2 && fotos.every((f) => f.cd_arquivo.startsWith(AGENDADA + '/') && /\.jpg$/.test(f.cd_arquivo)) && fotos.map((f) => f.id_item).sort().join() === '102,103', 'fotos vão no caminho vistorias/<ID_VISTORIA>/<foto>.jpg ligadas aos itens');
    ok(cen.uploads.length === 3 && cen.uploads.includes(AGENDADA + '/assinatura.png') && c.p_ds_assinatura === AGENDADA + '/assinatura.png', 'fotos e assinatura sobem ao Storage antes de concluir');
    ok(await page.getByText('Ocupado').isVisible(), 'mostra a situação em que o banco deixou a unidade (OCUPADO)');
    ok(await page.getByText('1 ocorrência criada', { exact: false }).isVisible(), 'mostra as ocorrências criadas pelo banco');
    const fila = await local(page, 'inspect.envios');
    ok(!(await local(page, 'solar-inspect:rascunho')) && fila?.[0]?.status === 'enviada' && !fila[0].dados, 'rascunho apagado e envio marcado como enviado, sem guardar a carga');
    ok(await page.evaluate(() => new Promise((ok) => { const r = indexedDB.open('solar-inspect'); r.onsuccess = () => { const t = r.result.transaction('fotos').objectStore('fotos').count(); t.onsuccess = () => ok(t.result === 0); }; })), 'fotos apagadas do aparelho depois do envio');
    // T19
    cen.historico = [{ ID_VISTORIA: AGENDADA, ID_UNIDADE: 7, DT_INICIO: '2026-11-21T10:00:00Z', DT_FIM: '2026-11-21T10:20:00Z', DS_SINALIZACOES: ['RAPIDA'], TP_SITUACAO_RESULTANTE: 'OCUPADO', VST_TIPO_VISTORIA: { NM_TIPO_VISTORIA: 'Entrada' } }];
    await page.getByRole('link', { name: /Ver meu histórico/ }).click();
    await page.getByText('Casa do Mirante · Entrada').waitFor({ timeout: 6000 });
    ok(await page.getByText('Duração abaixo do mínimo').isVisible(), 'T19 lista as minhas vistorias do banco com as sinalizações');
    await ctx.close();
  });

  console.log('── Admin sem itens no checklist: a tela leva ao cadastro');
  await T('semitens', async () => {
    const { ctx, page } = await abrir(browser, { usuario: { TP_PERFIL: 'ADMIN' } }, { rota: BASEV });
    await page.getByRole('link', { name: 'Cadastrar o checklist' }).waitFor({ timeout: 8000 });
    ok(await page.getByRole('link', { name: 'Cadastrar o checklist' }).getAttribute('href').then((h) => h.endsWith('/admin/checklists')) && !(await page.innerText('body')).includes('Peça ao gestor'), 'admin: em vez de "peça ao gestor", o link leva direto ao cadastro do checklist');
    await page.getByRole('link', { name: 'Cadastrar o checklist' }).click();
    ok(await esperarRota(page, '/admin/checklists'), 'o link abre Ambientes e itens');
    await ctx.close();
  });

  console.log('── Vistoria avulsa feita sem internet e enviada quando a conexão volta');
  await T('offline', async () => {
    const cen = {};
    const { ctx, page } = await abrir(browser, cen, { rota: BASEV });
    await page.locator('label', { hasText: 'Rotina' }).first().waitFor({ timeout: 8000 });
    ok(await esperar(async () => (cen.rpc.vst_checklist || []).length >= 2), 'T07 baixa os checklists para uso sem internet');
    await page.locator('label', { hasText: 'Rotina' }).first().click();
    await ctx.setOffline(true);
    await page.getByRole('button', { name: /Validar presença/ }).click();
    ok(await esperarRota(page, BASEV + '/checklist', 10000), 'sem internet a presença por GPS segue e o checklist abre da cópia do aparelho');
    ok(!cen.rpc.vst_iniciar_vistoria, 'sem internet não tenta iniciar (fica para o envio)');
    await page.getByText('Sofá').first().waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: /Tudo OK/ }).click();
    await page.getByText('Torneira').first().waitFor({ timeout: 5000 });
    await responder(page, 'Torneira', 'OK');
    await fotografar(page);
    ok(await esperarRota(page, BASEV + '/resumo', 10000), 'checklist concluído offline');
    await assinarEnviar(page);
    await page.getByRole('heading', { name: 'Salva na fila de envio' }).waitFor({ timeout: 8000 });
    const id = (await local(page, 'inspect.envios'))?.[0]?.id;
    ok(id && !cen.rpc.vst_concluir_vistoria && cen.uploads.length === 0, 'sem internet fica na fila, nada enviado');
    await ctx.setOffline(false);
    ok(await esperar(async () => (await local(page, 'inspect.envios'))?.[0]?.status === 'enviada', 10000), 'a conexão volta e a fila envia sozinha');
    const cr = cen.rpc.vst_criar_vistoria?.[0], ini = cen.rpc.vst_iniciar_vistoria?.[0];
    ok(cr && cr.p_id_vistoria === id && cr.p_cd_tipo_vistoria === 'ROTINA' && ini?.p_id_vistoria === id && ini.p_dt_inicio && cen.rpc.vst_concluir_vistoria?.[0]?.p_dt_fim, 'avulsa: cria com o UUID do aparelho, inicia com a hora real e conclui');
    await page.getByRole('link', { name: /Voltar às unidades/ }).click();
    await page.locator('a[aria-label="Sincronização"]').click();
    await page.getByText('Tudo sincronizado').waitFor({ timeout: 5000 });
    ok(true, 'T18 mostra a fila vazia');
    await ctx.close();
  });

  console.log('── Celular compartilhado: cada funcionário vê só a própria fila');
  await T('compartilhado', async () => {
    const cen = {};
    const envio = (id, uid, unidade, status) => ({ id, uid, unidadeId: '7', unidade, tipo: 'Rotina', inicio: '2026-11-21T10:00:00Z', fim: '2026-11-21T10:20:00Z', status, sinalizacoes: [], ocorrencias: 0, tentativas: 0,
      ...(status === 'pendente' ? { dados: { unidadeId: 7, cdTipo: 'ROTINA', avulsa: true, dtAgendada: '2026-11-21', iniciada: false, respostas: [{ id_item: 101, tp_resposta: 'OK' }] } } : {}) });
    const { ctx, page } = await abrir(browser, cen, { rota: '/app/unidades' });
    await page.getByText('Casa do Mirante').first().waitFor({ timeout: 8000 });
    const OUTRO = '00000000-0000-4000-8000-0000000000ff';
    await page.evaluate(([a, b]) => localStorage.setItem('inspect.envios', JSON.stringify([a, b])), [envio('aaaaaaaa-0000-4000-8000-000000000001', OUTRO, 'Chalé do Outro', 'pendente'), envio('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a1', 'Casa do Mirante', 'enviada')]);
    await page.goto(BASE + '/app/sincronizacao');
    await page.getByText('Tudo sincronizado').waitFor({ timeout: 8000 });
    const texto = await page.innerText('body');
    ok(!texto.includes('Chalé do Outro') && texto.includes('Casa do Mirante'), 'T18 não mostra o envio de outro funcionário e mostra o meu');
    ok(!cen.rpc.vst_criar_vistoria && !cen.rpc.vst_concluir_vistoria, 'o envio do outro não é enviado pela minha conta');
    ok((await local(page, 'inspect.envios')).some((e) => e.uid === OUTRO && e.status === 'pendente' && e.dados), 'o envio pendente do outro continua guardado no aparelho (não se perde)');
    await page.goto(BASE + '/app/historico');
    await page.getByText('Casa do Mirante · Rotina').waitFor({ timeout: 8000 }).catch(() => {});
    ok(!(await page.innerText('body')).includes('Chalé do Outro'), 'T19 também não mostra o envio de outro funcionário');
    await page.goto(BASE + '/');
    ok(await esperarRota(page, '/app/unidades'), 'o pendente do outro não me desvia para a fila ao entrar');
    await ctx.close();
  });

  console.log('── Recusas do servidor e GPS fora do raio');
  await T('recusa', async () => {
    const cen = { iniciarErro: 'vistoria_de_outro_usuario' };
    const { ctx, page } = await abrir(browser, cen, { rota: BASEV, longe: true });
    await page.locator('label', { hasText: 'Entrada' }).first().click();
    await page.getByRole('button', { name: /Validar presença/ }).click();
    await page.getByText(/Você está a \d+ m da unidade/).waitFor({ timeout: 8000 });
    ok(!cen.rpc.vst_iniciar_vistoria, 'fora do raio não inicia sem o vistoriador assumir');
    await page.getByRole('button', { name: /Continuar mesmo assim/ }).click();
    await page.getByText('Esta vistoria já está com outro vistoriador.').waitFor({ timeout: 8000 });
    ok(cen.rpc.vst_iniciar_vistoria?.[0]?.p_vl_latitude === -19.1, 'segue fora do raio e manda a posição real (o banco sinaliza)');
    ok(!(await page.url()).includes('/checklist'), 'recusa do servidor não abre o checklist');
    await page.setViewportSize({ width: 320, height: 700 });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'T08 com alerta cabe em 320 px sem rolagem lateral');
    if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO, fullPage: true });
    await page.getByRole('button', { name: 'Escolher outra vistoria' }).click();
    ok(await esperarRota(page, BASEV) && !(await local(page, 'solar-inspect:rascunho')), 'volta para a escolha do tipo e descarta o rascunho');
    await ctx.close();
  });

  ok(errosJS.length === 0, 'nenhum erro de JavaScript' + (errosJS.length ? ': ' + errosJS[0] : ''));
  await browser.close();
  console.log(falhas ? `\n${falhas} FALHA(S) em ${total}` : `\nTODAS AS ${total} VERIFICAÇÕES PASSARAM`);
  process.exit(falhas ? 1 : 0);
})();
