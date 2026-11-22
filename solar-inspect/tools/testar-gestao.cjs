// Testa as telas de gestão (T20–T27) no navegador, com o Supabase simulado (nada vai ao banco real).
// Uso: npx vite build && (npx vite preview --port 4173 &) && node tools/testar-gestao.cjs
const { chromium } = require('playwright');
const BASE = process.env.APP_URL || 'http://localhost:4173';
const SUPA = 'https://tnjpyjbqcjrowzjfnuln.supabase.co';
const UID = '00000000-0000-4000-8000-0000000000a2';
const V1 = '11111111-2222-4333-8444-555555555555', V2 = '22222222-2222-4333-8444-555555555555';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let falhas = 0, total = 0; const errosJS = [];
const ok = (c, m) => { total++; if (c) console.log('ok  ' + m); else { falhas++; console.log('FALHOU: ' + m); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const agora = () => Math.floor(Date.now() / 1000);
const sessao = () => ({ access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: UID, role: 'authenticated', exp: agora() + 3600 })}.x`, refresh_token: 'r', expires_in: 3600, expires_at: agora() + 3600, token_type: 'bearer', user: { id: UID, aud: 'authenticated' } });
const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const un = (id, nome, sit) => ({ id_unidade: id, cd_unidade: 'c' + id, nm_unidade: nome, tp_unidade: 'CHALE', sg_ativo: true, id_propriedade: 1, nm_propriedade: 'Solar do Espinhaço', tp_situacao: sit, ds_andar: null, tp_validacao: 'QR_E_GPS', vl_latitude: -19.08, vl_longitude: -43.59, qtde_raio_metros: 60, qtde_precisao_max_metros: 50 });
const oc = (id, unidade, nome, grav, st, extra = {}) => ({ id_ocorrencia: id, id_unidade: unidade, nm_unidade: nome, id_vistoria: V1, nm_tipo_vistoria: 'Saída', dt_vistoria: '2026-11-20T15:00:00Z', nm_autor: 'Ana', id_item: 100 + id, nm_item: 'Item ' + id, nm_ambiente: 'Banheiro', tp_gravidade: grav, tp_status: st, ds_ocorrencia: 'Ocorrência ' + id, ds_tratamento: null, dt_abertura: '2026-11-20T15:00:00Z', dt_resolucao: null, dt_bloqueio_fim: null, ...extra });
const vis = (id, unidade, st, extra = {}) => ({ ID_VISTORIA: id, ID_UNIDADE: unidade, TP_STATUS: st, DT_AGENDADA: HOJE, DT_INICIO: st === 'CONCLUIDA' ? '2026-11-21T10:00:00Z' : null, DT_FIM: st === 'CONCLUIDA' ? '2026-11-21T10:20:00Z' : null, DS_SINALIZACOES: null, TP_SITUACAO_RESULTANTE: st === 'CONCLUIDA' ? 'EM_LIMPEZA' : null, VST_TIPO_VISTORIA: { NM_TIPO_VISTORIA: 'Saída' }, VST_USUARIO: { NM_USUARIO: 'Ana' }, ...extra });

function servidor(page, cen) {
  cen.rpc = {}; cen.urls = [];
  return page.route(SUPA + '/**', async (route) => {
    const req = route.request(), url = decodeURIComponent(req.url()), h = req.headers(), m = req.method();
    cen.urls.push(url);
    const json = (status, corpo, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...extra }, body: corpo === undefined ? '' : JSON.stringify(corpo) });
    const objeto = (h['accept'] || '').includes('vnd.pgrst.object');
    const um = (l) => (objeto ? (l ? json(200, l) : json(406, { code: 'PGRST116' })) : json(200, l ? [l] : []));
    if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/user')) return json(200, { id: UID, aud: 'authenticated', role: 'authenticated' });
    if (url.includes('/rest/v1/VST_USUARIO_PROPRIEDADE')) return json(200, [{ ID_USUARIO: 'u-ana', ID_PROPRIEDADE: 1 }], { 'content-range': '*/1' });
    if (url.includes('/rest/v1/VST_USUARIO') && url.includes('CD_LOGIN')) return json(200, [{ ID_USUARIO: 'u-ana', NM_USUARIO: 'Ana', CD_LOGIN: 'ana', CD_CPF: null, TP_PERFIL: 'ASSESSOR', SG_ATIVO: true }]);
    if (url.includes('/rest/v1/VST_USUARIO')) return um({ NM_USUARIO: 'Gestor', TP_PERFIL: cen.perfil ?? 'GESTOR', SG_ATIVO: true, DT_ACEITE_LGPD: null, SG_TROCAR_SENHA: false });
    const rpc = url.match(/\/rest\/v1\/rpc\/(\w+)/)?.[1];
    if (rpc) {
      const a = JSON.parse(req.postData() || '{}');
      (cen.rpc[rpc] = cen.rpc[rpc] || []).push(a);
      if (rpc === 'vst_unidades') return json(200, [un(7, 'Casa do Mirante', 'MANUTENCAO'), un(8, 'Casa da Serra', 'LIBERADO')]);
      if (rpc === 'vst_ocorrencias') {
        const l = [oc(1, 7, 'Casa do Mirante', 'CRITICA', 'ABERTA', { dt_bloqueio_fim: '2026-11-27', ds_tratamento: '20/11/2026 16:00 · Gestor: Encanador chamado', id_responsavel: 'u-ana', nm_responsavel: 'Ana', dt_prazo: '2026-11-01' }), oc(2, 8, 'Casa da Serra', 'BAIXA', 'ABERTA'), oc(3, 7, 'Casa do Mirante', 'MEDIA', 'RESOLVIDA', { dt_resolucao: '2026-11-21T09:00:00Z' })];
        return json(200, l.filter((o) => (!a.p_id_unidade || o.id_unidade === a.p_id_unidade) && (!a.p_id_vistoria || o.id_vistoria === a.p_id_vistoria)));
      }
      if (rpc === 'vst_alterar_situacao_unidade') return cen.erroSit ? json(400, { code: 'P0001', message: cen.erroSit }) : json(204);
      if (rpc === 'vst_obter_qr' || rpc === 'vst_rotacionar_qr') return json(200, [{ cd_hash_qr: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', no_versao_qr: rpc === 'vst_rotacionar_qr' ? 3 : 2 }]);
      if (rpc === 'vst_auditoria') {
        const l = [
          { id_auditoria: 3, dt_criacao: '2026-11-21T12:00:00Z', id_usuario: 'u-ana', nm_usuario: 'Ana', tp_perfil: 'ASSESSOR', nm_papel: 'authenticated', nm_tabela: 'VST_OCORRENCIA', tp_operacao: 'UPDATE', cd_registro: '1', id_unidade: 7, nm_unidade: 'Casa do Mirante', ds_alteracoes: { TP_STATUS: ['ABERTA', 'EM_TRATAMENTO'] }, qtde_total: 3 },
          { id_auditoria: 2, dt_criacao: '2026-11-21T11:00:00Z', id_usuario: null, nm_usuario: null, tp_perfil: null, nm_papel: 'service_role', nm_tabela: 'VST_VISTORIA', tp_operacao: 'INSERT', cd_registro: V2, id_unidade: 8, nm_unidade: 'Casa da Serra', ds_alteracoes: { ID_VISTORIA: V2, TP_STATUS: 'AGENDADA', DT_AGENDADA: HOJE, ID_UNIDADE: 8 }, qtde_total: 3 },
          { id_auditoria: 1, dt_criacao: '2026-11-21T10:00:00Z', id_usuario: UID, nm_usuario: 'Gestor', tp_perfil: 'GESTOR', nm_papel: 'authenticated', nm_tabela: 'VST_UNIDADE', tp_operacao: 'UPDATE', cd_registro: '7', id_unidade: 7, nm_unidade: 'Casa do Mirante', ds_alteracoes: { CD_HASH_QR: '***', NO_VERSAO_QR: [1, 2], TP_SITUACAO: ['LIBERADO', 'MANUTENCAO'], DS_ANDAR: [null, 'Térreo'] }, qtde_total: 3 }];
        return json(200, l.filter((x) => !a.p_nm_tabela || x.nm_tabela === a.p_nm_tabela).map((x, i, arr) => ({ ...x, qtde_total: arr.length })));
      }
      if (rpc === 'vst_resolver_ocorrencia' || rpc === 'vst_bloquear_por_ocorrencia' || rpc === 'vst_planejar_ocorrencia') return json(200, null);
      return json(404, { message: 'rpc não esperada ' + rpc });
    }
    if (url.includes('/rest/v1/VST_OCORRENCIA')) return json(200, []);
    if (url.includes('/rest/v1/VST_AMBIENTE')) return json(200, [{ ID_UNIDADE: 7 }]);
    if (url.includes('/rest/v1/VST_ITEM')) return json(200, []);
    if (url.includes('/rest/v1/VST_RESPOSTA')) return json(200, [
      { ID_ITEM: 101, TP_RESPOSTA: 'PROBLEMA', DS_OBSERVACAO: 'Torneira pingando', QTDE_ENCONTRADA: null, VST_ITEM: { NM_ITEM: 'Torneira', NO_ORDEM: 1, VST_AMBIENTE: { NM_AMBIENTE: 'Banheiro', NO_ORDEM: 2 } } },
      { ID_ITEM: 102, TP_RESPOSTA: 'OK', DS_OBSERVACAO: null, QTDE_ENCONTRADA: 4, VST_ITEM: { NM_ITEM: 'Toalhas', NO_ORDEM: 2, VST_AMBIENTE: { NM_AMBIENTE: 'Banheiro', NO_ORDEM: 2 } } },
      { ID_ITEM: 103, TP_RESPOSTA: 'OK', DS_OBSERVACAO: null, QTDE_ENCONTRADA: null, VST_ITEM: { NM_ITEM: 'Sofá', NO_ORDEM: 1, VST_AMBIENTE: { NM_AMBIENTE: 'Sala', NO_ORDEM: 1 } } }]);
    if (url.includes('/rest/v1/VST_FOTO')) return json(200, [{ ID_ITEM: 101, CD_ARQUIVO: `${V1}/f1.jpg`, DT_CAPTURA: '2026-11-21T10:05:00Z' }]);
    if (url.includes('/rest/v1/VST_VISTORIA')) {
      const lista = [vis(V1, 7, 'CONCLUIDA', { DS_SINALIZACOES: ['RAPIDA'] }), vis(V2, 8, 'AGENDADA')];
      if (url.includes('ID_VISTORIA=eq.')) { const id = url.match(/ID_VISTORIA=eq\.([0-9a-f-]+)/)[1]; const v = lista.find((x) => x.ID_VISTORIA === id); return um(v && { ...v, DS_ASSINATURA: `${V1}/assinatura.png`, DS_OBSERVACAO: null, TP_VALIDACAO: 'QR_E_GPS', QTDE_DISTANCIA_METROS: 12, QTDE_PRECISAO_METROS: 8, DT_RECEBIMENTO: '2026-11-21T10:21:00Z' }); }
      cen.listaVistorias = url;
      const f = lista.filter((v) => (!url.includes('TP_STATUS=eq.') || url.includes('TP_STATUS=eq.' + v.TP_STATUS)) && (!url.includes('ID_UNIDADE=eq.') || url.includes('ID_UNIDADE=eq.' + v.ID_UNIDADE)) && (!url.includes('DS_SINALIZACOES=not.is.null') || v.DS_SINALIZACOES));
      return json(200, f, { 'content-range': `0-${Math.max(0, f.length - 1)}/${f.length}` });
    }
    if (m === 'POST' && url.includes('/storage/v1/object/sign/vistorias')) {
      const { paths } = JSON.parse(req.postData() || '{}');
      return json(200, paths.map((p) => ({ path: p, signedURL: `/object/sign/vistorias/${p}?token=t`, error: null })));
    }
    if (url.includes('/storage/v1/object/sign/')) return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PNG });
    return json(404, { message: 'endpoint não esperado: ' + url });
  });
}

async function abrir(browser, cen, rota) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errosJS.push(e.message));
  await servidor(page, cen);
  await page.goto(BASE + '/__vazio__');
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('inspect.sessao', JSON.stringify(s)); }, sessao());
  await page.goto(BASE + rota).catch(() => {});
  return { ctx, page };
}
const esperarRota = async (page, caminho, ms = 8000) => { try { await page.waitForURL((u) => u.pathname === caminho, { timeout: ms }); return true; } catch { return false; } };
const esperar = async (f, ms = 6000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await f()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };
const ver = (page, t, o = {}) => page.getByText(t, o).first().waitFor({ timeout: 6000 }).then(() => true, () => false);

(async () => {
  const browser = await chromium.launch();
  const T = async (nome, fn) => { try { await fn(); } catch (e) { falhas++; total++; console.log('FALHOU: ' + nome + ' — ' + e.message.split('\n')[0]); } };

  console.log('── Proteção');
  await T('guarda', async () => {
    const { ctx, page } = await abrir(browser, { perfil: 'ASSESSOR' }, '/gestao');
    ok(await esperarRota(page, '/acesso-indisponivel'), 'assessor não abre o painel de gestão (vai para T04)');
    await ctx.close();
  });

  console.log('── T20 Painel');
  await T('t20', async () => {
    const cen = {};
    const { ctx, page } = await abrir(browser, cen, '/gestao');
    await ver(page, 'Ocorrências prioritárias');
    const ind = await page.locator('dl dd').allInnerTexts();
    ok(ind.slice(0, 4).join('|') === '2|1|2|1/2', 'indicadores do banco: 2 unidades, 1 liberada, 2 ocorrências abertas, 1 de 2 vistorias de hoje concluída');
    const pri = await page.locator('a[href^="/gestao/ocorrencias/"]').allInnerTexts();
    ok(pri.length === 2 && pri[0].includes('Ocorrência 1'), 'ocorrências prioritárias: só as abertas, crítica primeiro');
    ok(await page.locator(`a[href="/gestao/vistorias/${V2}"]`).count() === 1, 'lista as vistorias de hoje com link para o detalhe');
    ok(!(await page.innerText('body')).match(/Mockup|Demo|Chalé Ipê/), 'nenhum dado ou aviso de demonstração na tela');
    await ctx.close();
  });

  console.log('── T21/T22 Unidades, situação e QR');
  await T('t21', async () => {
    const cen = {};
    const { ctx, page } = await abrir(browser, cen, '/gestao/unidades');
    await ver(page, 'Casa da Serra');
    ok(await page.locator('a[href="/gestao/unidades/7"]').count() >= 1, 'T21 lista as unidades do banco');
    await page.locator('a[href="/gestao/unidades/7"]').first().click();
    ok(await esperarRota(page, '/gestao/unidades/7'), 'T21 → T22');
    await ver(page, 'Ocorrência 1');
    ok(cen.rpc.vst_ocorrencias?.some((a) => a.p_id_unidade === 7) && cen.listaVistorias?.includes('ID_UNIDADE=eq.7'), 'T22 busca ocorrências e vistorias só desta unidade');
    await page.getByRole('button', { name: /Nova situação/ }).click();
    await page.getByRole('option', { name: 'Liberado' }).click();
    ok(await ver(page, 'ocorrência crítica aberta', { exact: false }), 'avisa que há ocorrência crítica antes de liberar');
    cen.erroSit = 'ocorrencias_criticas_abertas';
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await page.getByRole('alertdialog', { name: 'Confirmar situação' }).getByRole('button', { name: 'Confirmar' }).click();
    ok(await ver(page, 'Ainda há ocorrência crítica aberta nesta unidade', { exact: false }) && cen.rpc.vst_alterar_situacao_unidade?.[0]?.p_tp_situacao === 'LIBERADO', 'recusa do banco aparece com o motivo');
    cen.erroSit = null;
    await page.getByRole('button', { name: /Nova situação/ }).click();
    await page.getByRole('option', { name: 'Em limpeza' }).click();
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await page.getByRole('alertdialog', { name: 'Confirmar situação' }).getByRole('button', { name: 'Confirmar' }).click();
    ok(await ver(page, 'Situação alterada para Em limpeza') && cen.rpc.vst_alterar_situacao_unidade?.[1]?.p_tp_situacao === 'EM_LIMPEZA', 'muda a situação pela função do banco');
    await page.getByRole('button', { name: /Mostrar QR para imprimir/ }).click();
    ok(await page.locator('img[alt="QR Code de Casa do Mirante"]').waitFor({ timeout: 5000 }).then(() => true, () => false) && await ver(page, 'versão 2', { exact: false }), 'mostra o QR atual para imprimir');
    await page.getByRole('button', { name: /Gerar novo QR/ }).click();
    await page.getByRole('alertdialog', { name: 'Confirmar novo QR' }).getByRole('button', { name: 'Gerar' }).click();
    ok(await ver(page, 'etiquetas antigas deixaram de valer', { exact: false }) && cen.rpc.vst_rotacionar_qr?.[0]?.p_id_unidade === 7, 'gerar novo QR pede confirmação e invalida as etiquetas antigas');
    ok(!(await page.innerText('body')).includes('a1b2c3d4'), 'o código do QR nunca aparece em texto');
    await ctx.close();
  });

  console.log('── T23/T24/T27 Vistorias e relatório');
  await T('t23', async () => {
    const cen = {};
    const { ctx, page } = await abrir(browser, cen, '/gestao/vistorias');
    await ver(page, '2 registros');
    ok(cen.listaVistorias.includes('order=DT_AGENDADA.desc'), 'T23 lista do banco, paginada no servidor e mais recente primeiro');
    await page.getByRole('radio', { name: 'Sinalizadas' }).click();
    ok(await ver(page, '1 registro') && cen.listaVistorias.includes('DS_SINALIZACOES=not.is.null') && cen.listaVistorias.includes('TP_STATUS=eq.CONCLUIDA'), 'filtro "Sinalizadas" consulta o banco');
    const [down] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar CSV/ }).click()]);
    const csv = require('fs').readFileSync(await down.path(), 'utf8');
    ok(csv.includes('Unidade;Tipo;Agendada') && csv.includes('"Casa do Mirante";"Saída"') && csv.includes('Duração abaixo do mínimo'), 'exporta CSV com o filtro aplicado');
    await page.locator(`a[href="/gestao/vistorias/${V1}"]`).first().click();
    ok(await esperarRota(page, `/gestao/vistorias/${V1}`), 'T23 → T24');
    await ver(page, 'Torneira pingando');
    const amb = await page.locator('main h3').allInnerTexts();
    ok(amb.join('|').toLowerCase() === 'sala|banheiro', 'checklist agrupado por ambiente, na ordem de passagem');
    ok(await page.locator('img[alt="Foto 1 de Torneira"]').getAttribute('src').then((s) => s.includes('/object/sign/vistorias/') && s.includes('token=')), 'fotos abrem por link assinado e temporário');
    ok(await page.locator('img[alt="Assinatura do vistoriador"]').count() === 1 && await ver(page, '4 un.'), 'mostra assinatura e quantidade encontrada');
    ok(await page.locator('a[href="/gestao/ocorrencias/1"]').count() === 1, 'liga às ocorrências abertas pela vistoria');
    await page.setViewportSize({ width: 320, height: 720 });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'T24 cabe em 320 px sem rolagem lateral');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('link', { name: /Relatório/ }).click();
    ok(await esperarRota(page, `/gestao/vistorias/${V1}/relatorio`), 'T24 → T27');
    ok(await ver(page, 'Relatório de vistoria', { exact: false }) && await page.getByRole('button', { name: /Imprimir ou salvar PDF/ }).isVisible(), 'T27 com o registro do banco e botão de imprimir/salvar PDF');
    ok(!(await page.innerText('body')).includes('Mockup'), 'relatório sem aviso de demonstração');
    await page.goto(BASE + `/gestao/vistorias/${V2}`);
    await ver(page, 'As respostas aparecem quando a vistoria for concluída');
    ok(await page.getByRole('link', { name: /Relatório/ }).count() === 0, 'vistoria agendada não tem relatório');
    await page.goto(BASE + '/gestao/vistorias/99999999-9999-4999-8999-999999999999');
    ok(await esperarRota(page, '/gestao/vistorias'), 'vistoria inexistente ou sem acesso volta à lista');
    await ctx.close();
  });

  console.log('── T25/T26 Ocorrências: tratar e liberar a unidade');
  await T('t25', async () => {
    const cen = {};
    const { ctx, page } = await abrir(browser, cen, '/gestao/ocorrencias');
    await ver(page, 'Ocorrência 1');
    ok(await page.locator('a[href^="/gestao/ocorrencias/"]').count() === 2 && await ver(page, 'Fora da venda até', { exact: false }), 'T25 mostra as abertas e até quando a unidade está fora da venda');
    ok(await ver(page, 'Atrasada desde', { exact: false }) && await ver(page, 'Ana'), 'T25 mostra o responsável e destaca a ocorrência atrasada');
    await page.getByRole('radio', { name: 'Resolvida' }).click();
    ok(await page.locator('a[href^="/gestao/ocorrencias/"]').count() === 1, 'filtro por situação');
    await page.goto(BASE + '/gestao/ocorrencias/1');
    await ver(page, 'Encanador chamado');
    ok(await ver(page, 'Aberta na vistoria de saída por Ana', { exact: false }) && await ver(page, '20/11/2026 16:00'), 'T26 mostra o histórico gravado pelo banco (origem, data e autor)');
    ok(await ver(page, 'Prazo vencido em', { exact: false }), 'T26 avisa que o prazo venceu');
    await page.getByRole('button', { name: /Responsável/ }).click();
    await page.getByRole('option', { name: 'Sem responsável' }).click();
    await page.getByRole('button', { name: /Responsável/ }).click();
    await page.getByRole('option', { name: /Ana/ }).click();
    const dp = new Date(HOJE + 'T12:00:00'); dp.setDate(dp.getDate() + 5); const novoPrazo = dp.toISOString().slice(0, 10);
    await page.getByLabel('Prazo para resolver').fill(novoPrazo);
    await page.getByRole('button', { name: 'Salvar responsável e prazo' }).click();
    ok(await esperar(() => cen.rpc.vst_planejar_ocorrencia?.[0]?.p_id_responsavel === 'u-ana' && cen.rpc.vst_planejar_ocorrencia[0].p_dt_prazo === novoPrazo), 'T26 define responsável (só quem tem acesso à pousada) e prazo no banco');
    await page.getByLabel('Registro do tratamento').fill('Peça encomendada');
    await page.getByRole('button', { name: 'Registrar andamento' }).click();
    ok(await esperar(() => cen.rpc.vst_resolver_ocorrencia?.[0]?.p_tp_status === 'EM_TRATAMENTO' && cen.rpc.vst_resolver_ocorrencia[0].p_ds_tratamento === 'Peça encomendada'), 'registrar andamento grava no banco (EM_TRATAMENTO)');
    ok(await page.getByRole('checkbox').isChecked(), 'unidade fora da venda: "liberar ao resolver" vem marcado');
    await page.getByRole('button', { name: /Resolver/ }).click();
    ok(await esperar(() => cen.rpc.vst_resolver_ocorrencia?.[1]?.p_tp_status === 'RESOLVIDA' && cen.rpc.vst_resolver_ocorrencia[1].p_liberar === true), 'resolver e liberar a unidade numa só operação');
    ok(await ver(page, 'Ocorrência resolvida e unidade liberada.'), 'confirma o resultado');
    await page.goto(BASE + '/gestao/ocorrencias/2');
    await ver(page, 'Tirar da venda até', { exact: false });
    ok(await page.getByRole('checkbox').count() === 0, 'unidade à venda: não oferece "liberar"');
    await page.setViewportSize({ width: 320, height: 720 });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'T26 cabe em 320 px sem rolagem lateral');
    if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    ok(await page.getByRole('button', { name: /Cancelar/ }).isDisabled(), 'cancelar exige o motivo');
    const d = new Date(HOJE + 'T12:00:00'); d.setDate(d.getDate() + 3); const ate = d.toISOString().slice(0, 10); d.setDate(d.getDate() + 1);
    await page.getByLabel('Tirar da venda até (inclusive)').fill(ate);
    await page.getByRole('button', { name: 'Tirar da venda' }).click();
    ok(await esperar(() => cen.rpc.vst_bloquear_por_ocorrencia?.[0]?.p_dt_fim === d.toISOString().slice(0, 10)), 'tirar da venda até o dia escolhido (o banco recebe o dia seguinte, padrão do site)');
    await ctx.close();
  });

  console.log('── T34 Auditoria');
  await T('t34', async () => {
    let { ctx, page } = await abrir(browser, {}, '/admin/auditoria');
    ok(await esperarRota(page, '/acesso-indisponivel'), 'gestor não abre a auditoria (só ADMIN)');
    await ctx.close();
    const cen = { perfil: 'ADMIN' };
    ({ ctx, page } = await abrir(browser, cen, '/admin/auditoria'));
    await ver(page, '3 registros');
    const a = cen.rpc.vst_auditoria?.[0], d = new Date(HOJE + 'T12:00:00'); d.setDate(d.getDate() - 6);
    ok(a && a.p_dt_fim === HOJE && a.p_dt_ini === d.toISOString().slice(0, 10) && a.p_limite === 50 && a.p_deslocamento === 0, 'T34 consulta o banco: últimos 7 dias, página de 50');
    ok(await ver(page, 'TP_STATUS: ABERTA → EM_TRATAMENTO') && await ver(page, 'alterou ocorrência · Casa do Mirante', { exact: false }), 'mostra quem fez, o quê, onde e o antes → depois');
    ok(await ver(page, 'Site / sistema') && await ver(page, 'criou vistoria', { exact: false }), 'mudança feita pelo site aparece como "Site / sistema"');
    ok(await ver(page, 'Ver todos os 4 campos') && !(await page.innerText('body')).match(/[0-9a-f]{32}/), 'detalhe completo sob demanda; código do QR nunca aparece');
    await page.getByRole('button', { name: /Assunto/ }).click();
    await page.getByRole('option', { name: 'Ocorrência' }).click();
    ok(await ver(page, '1 registro') && cen.rpc.vst_auditoria.at(-1).p_nm_tabela === 'VST_OCORRENCIA', 'filtra por assunto no banco');
    await page.getByRole('button', { name: /Usuário/ }).click();
    await page.getByRole('option', { name: 'Ana' }).click();
    ok(await esperar(() => cen.rpc.vst_auditoria.at(-1).p_id_usuario === 'u-ana'), 'filtra por usuário no banco');
    await page.getByRole('link', { name: /Abrir/ }).first().click();
    ok(await esperarRota(page, '/gestao/ocorrencias/1'), 'abre o registro auditado (ocorrência)');
    await page.goto(BASE + '/admin/auditoria');
    await ver(page, '3 registros');
    await page.setViewportSize({ width: 320, height: 720 });
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= 320), 'T34 cabe em 320 px sem rolagem lateral');
    await ctx.close();
  });

  ok(errosJS.length === 0, 'nenhum erro de JavaScript' + (errosJS.length ? ': ' + errosJS[0] : ''));
  await browser.close();
  console.log(falhas ? `\n${falhas} FALHA(S) em ${total}` : `\nTODAS AS ${total} VERIFICAÇÕES PASSARAM`);
  process.exit(falhas ? 1 : 0);
})();
