// Testa as telas de preços (T38 calendário, T39 tarifas, T40 simulador, T41 formulário) no navegador, ponta a ponta:
// o app conversa com um "Supabase" simulado cujas funções prc_* são executadas de verdade num PostgreSQL de TESTE
// (banco "precos_e2e", montado aqui com o schema do site, as vistorias e migracao_precos_gestao.sql). Nada vai à produção.
// Uso: npx vite build && (npx vite preview --port 4173 &) && PGUSER=... node tools/testar-precos.cjs   (PGUSER superusuário; padrão do ambiente)
// Com FOTO=/pasta salva uma imagem de cada tela (desktop e celular).
const { chromium } = require('playwright');
const { execFileSync, execFile } = require('node:child_process');
const path = require('node:path');
const BASE = process.env.APP_URL || 'http://localhost:4173';
const SUPA = 'https://tnjpyjbqcjrowzjfnuln.supabase.co';
const DB = 'precos_e2e';
const SITE = path.resolve(__dirname, '../../site/database'), INSPECT = path.resolve(__dirname, '../database');
const UIDS = { GESTOR: '00000000-0000-4000-8000-0000000000a2', ADMIN: '00000000-0000-4000-8000-0000000000a3' };
let falhas = 0, total = 0;
const ok = (c, m) => { total++; if (c) console.log('ok  ' + m); else { falhas++; console.log('FALHOU: ' + m); } };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const agora = () => Math.floor(Date.now() / 1000);
const sessao = (uid) => ({ access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: uid, role: 'authenticated', exp: agora() + 3600 })}.x`, refresh_token: 'r', expires_in: 3600, expires_at: agora() + 3600, token_type: 'bearer', user: { id: uid, aud: 'authenticated', email: 'x@usuarios.inspect.invalid' } });
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const somar = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// ── banco de teste
const psql = (args, input) => execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-q', '-At', ...args], { input, encoding: 'utf8', env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } });
function montarBanco() {
  psql(['-d', 'postgres', '-c', `drop database if exists ${DB}`, '-c', `create database ${DB}`]);
  for (const f of [`${INSPECT}/simulado_supabase.sql`, `${SITE}/schema.sql`, `${SITE}/seed_exemplo.sql`, `${INSPECT}/migracao_vistorias.sql`, `${SITE}/migracao_precos_gestao.sql`, `${SITE}/migracao_pacotes.sql`]) psql(['-d', DB, '-f', f]);
  psql(['-d', DB], `
    insert into auth.users (id, email) values ('${UIDS.GESTOR}', 'g@x.invalid'), ('${UIDS.ADMIN}', 'a@x.invalid');
    insert into "SE"."VST_USUARIO" ("ID_USUARIO", "NM_USUARIO", "CD_LOGIN", "TP_PERFIL", "SG_ATIVO") values
      ('${UIDS.GESTOR}', 'Gestor (teste)', 'gestor.teste', 'GESTOR', true), ('${UIDS.ADMIN}', 'Admin (teste)', 'admin.teste', 'ADMIN', true);
    insert into "SE"."SIT_BLOQUEIO" ("ID_UNIDADE", "DT_INI", "DT_FIM", "TP_MOTIVO")
      select "ID_UNIDADE", (now() at time zone 'America/Sao_Paulo')::date + 3, (now() at time zone 'America/Sao_Paulo')::date + 5, 'MANUTENCAO' from "SE"."SIT_UNIDADE" where "CD_UNIDADE" = 'casa-do-mirante';`);
}
const lit = (v) => v === null || v === undefined ? 'NULL' : Array.isArray(v) ? `ARRAY[${v.map(lit).join(',')}]::${typeof v[0] === 'number' ? 'smallint' : 'date'}[]` : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
const TABELA = new Set(['prc_unidades', 'prc_tarifas', 'prc_ajustes', 'prc_ocupacao', 'prc_calcular', 'prc_pacotes', 'prc_idades']);
function chamarRpc(perfil, fn, corpo) {
  const args = Object.entries(corpo || {}).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
  const chamada = `"SE".${fn}(${args})`;
  const sql = `begin; select set_config('request.jwt.claims', '{"sub":"${UIDS[perfil]}","role":"authenticated"}', true); set local role authenticated;
    select ${TABELA.has(fn) ? `coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from ${chamada} t` : `coalesce(to_jsonb(${chamada})::text, 'null')`}; commit;`;
  return new Promise((res) => execFile('psql', ['-v', 'ON_ERROR_STOP=1', '-q', '-At', '-d', DB, '-c', sql], { encoding: 'utf8', env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } },
    (err, out, errOut) => {
      if (err) { const m = /ERROR:\s+(.*)/.exec(errOut || ''); const msg = (m ? m[1] : 'erro').trim(); return res({ status: /permission denied/.test(msg) ? 403 : 400, corpo: { code: /permission denied/.test(msg) ? '42501' : 'P0001', message: msg, details: null, hint: null } }); }
      const linha = out.trim().split('\n').filter((l) => l && !/^(BEGIN|COMMIT|SET|\{"sub|set_config)/.test(l)).pop();
      res({ status: 200, corpo: JSON.parse(linha === undefined || linha === '' ? 'null' : linha) });
    }));
}

function servidor(page, perfil, perdidos, chamadas) {
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
    const rpc = url.match(/\/rest\/v1\/rpc\/(\w+)/)?.[1];
    if (rpc && rpc.startsWith('prc_')) {
      const corpo = req.postData() ? JSON.parse(req.postData()) : {};
      chamadas.push(rpc);
      const r = await chamarRpc(perfil, rpc, corpo);
      return json(r.status, r.corpo);
    }
    if (rpc) return json(200, [], { 'content-range': '*/0' });
    if (url.includes('/rest/v1/VST_')) return json(200, [], { 'content-range': '*/0' });
    perdidos.push(m + ' ' + url.split('?')[0]);
    return json(404, { message: 'não esperado' });
  });
}

(async () => {
  montarBanco();
  const browser = await chromium.launch();
  const novo = async (perfil, largura = 1280) => {
    const ctx = await browser.newContext({ viewport: { width: largura, height: 900 } });
    const page = await ctx.newPage();
    const erros = [], perdidos = [], chamadas = [];
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
    await servidor(page, perfil, perdidos, chamadas);
    await page.goto(BASE + '/__vazio__');
    await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('inspect.sessao', JSON.stringify(s)); }, sessao(UIDS[perfil]));
    return { ctx, page, erros, perdidos, chamadas };
  };
  const abrir = async (page, rota) => { await page.goto(BASE + rota); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(500); };
  const foto = async (page, nome) => { if (process.env.FOTO) await page.screenshot({ path: `${process.env.FOTO}/${nome}.png`, fullPage: true }); };
  const sql = (q) => psql(['-d', DB], q).trim();
  const bloqueio = sql(`select "DT_INI"::text from "SE"."SIT_BLOQUEIO" order by 1 limit 1`);   // a data vem do banco (o fuso do banco pode estar um dia à frente do de São Paulo)

  // ── só o ADMIN abre (preços são dados do site)
  console.log('── Acesso');
  {
    const g = await novo('GESTOR');
    for (const r of ['/admin/precos', '/admin/tarifas', '/admin/tarifas/1', '/admin/simulador']) {
      await abrir(g.page, r);
      ok(new URL(g.page.url()).pathname === '/acesso-indisponivel', `GESTOR não abre ${r}`);
    }
    ok(g.chamadas.length === 0, 'GESTOR: nenhuma função de preço chega a ser chamada');
    await g.ctx.close();
  }
  const A = await novo('ADMIN');
  const p = A.page;
  await abrir(p, '/gestao');
  const links = await p.locator('nav[aria-label="Menu"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  ok(links.includes('/admin/precos') && !links.includes('/admin/tarifas'), 'ADMIN vê uma entrada só, Preços, no menu');

  // ── T38 · calendário (dados do banco)
  console.log('── T38 Calendário de preços');
  const alvo = somar(hoje(), 40);
  const mes = alvo.slice(0, 7), dia = String(Number(alvo.slice(8)));
  await abrir(p, `/admin/precos?mes=${mes}`);
  const celula = () => p.locator('[role=gridcell]').filter({ has: p.locator(`span:text-is("${dia}")`) }).first();
  const rotulo = async () => (await celula().getAttribute('aria-label')) || '';
  ok((await p.locator('h1').innerText()).includes('Preços') && (await p.locator('nav[aria-label="Preços"] a').allInnerTexts()).join('|') === 'Calendário|Tarifas|Pacotes|Simulador', 'Preços com abas Calendário · Tarifas · Pacotes · Simulador');
  ok(!(await p.getByText('Protótipo.').isVisible().catch(() => false)), 'ligado ao banco: a faixa "Protótipo" não aparece');
  ok(A.chamadas.includes('prc_unidades') && A.chamadas.includes('prc_tarifas') && A.chamadas.includes('prc_ajustes') && A.chamadas.includes('prc_ocupacao'), 'o calendário lê unidades, tarifas, ajustes e ocupação do banco');
  const antes = await rotulo();
  ok(/R\$\s?(800|1\.700)/.test(antes), `dia ${alvo} mostra o valor da tarifa padrão do banco (${antes.match(/R\$[^,]*/)?.[0]})`);
  const ocupado = p.locator('[role=gridcell]').filter({ hasText: /bloq\./ });
  await abrir(p, `/admin/precos?mes=${bloqueio.slice(0, 7)}`);
  ok(await p.locator('[role=gridcell]').filter({ hasText: /bloq\./ }).count() >= 1, 'o bloqueio que existe no banco aparece no calendário');
  void ocupado;
  await abrir(p, `/admin/precos?mes=${mes}`);
  await celula().click();
  await p.getByLabel('Diária (R$)').fill('950');
  await foto(p, 'T38-ajuste');
  await p.getByRole('button', { name: 'Salvar', exact: true }).click();
  await p.waitForTimeout(500);
  ok(/^Salvo\. 1 noite atualizada/.test(await p.locator('aside [role=status]').innerText()), 'depois de salvar aparece a mensagem "Salvo"');
  ok(/R\$\s?950/.test(await rotulo()) && /com ajuste/.test(await rotulo()), 'ajuste de R$ 950 gravado no banco e aparece no calendário');
  ok(Number(sql(`select count(*) from "SE"."SIT_AJUSTE_DIARIO" where "DT_REF" = '${alvo}' and "VL_NOITE" = 950`)) === 1, 'a linha do ajuste existe em SIT_AJUSTE_DIARIO');
  ok(Number(sql(`select count(*) from "SE"."VST_AUDITORIA" where "NM_TABELA" = 'SIT_AJUSTE_DIARIO' and "ID_USUARIO" = '${UIDS.ADMIN}'`)) >= 1, 'a Auditoria do Inspect registra o administrador como autor do ajuste');
  await p.getByRole('button', { name: 'Remover ajuste' }).click();
  await p.waitForTimeout(500);
  ok(await rotulo() === antes && Number(sql(`select count(*) from "SE"."SIT_AJUSTE_DIARIO" where "DT_REF" = '${alvo}'`)) === 0, 'remover o ajuste apaga a linha e devolve o valor da tarifa');
  await p.getByRole('button', { name: /Mais opções/ }).click();
  await p.getByLabel('Fechar para venda').check();
  await p.getByRole('button', { name: 'Salvar', exact: true }).click();
  await p.waitForTimeout(500);
  ok(/fechado para venda/.test(await rotulo()), 'dia fechado fica marcado como fechado para venda');
  await p.getByRole('button', { name: 'Remover ajuste' }).click();
  await p.waitForTimeout(400);
  // dias avulsos: cada toque marca ou desmarca um dia; os marcados recebem a diária e o mínimo juntos
  await p.getByRole('button', { name: 'Fechar painel' }).click();
  const cel = (n) => p.locator('[role=gridcell]').filter({ has: p.locator(`span:text-is("${n}")`) }).first();
  const d2 = Number(somar(alvo, 4).slice(8)), d3 = Number(somar(alvo, 6).slice(8));
  if (somar(alvo, 6).slice(0, 7) === mes) {
    await celula().click(); await cel(d2).click(); await cel(d3).click(); await cel(d3).click();
    ok(/2 noites selecionadas/.test(await p.locator('aside[aria-label="Ajuste dos dias"]').innerText()), 'dias avulsos: tocar marca, tocar de novo desmarca (2 noites)');
    await p.getByLabel('Diária (R$)').fill('1234'); await p.getByLabel('Mínimo de noites').fill('4');
    await p.getByRole('button', { name: 'Salvar', exact: true }).click();
    await p.waitForTimeout(500);
    ok(Number(sql(`select count(*) from "SE"."SIT_AJUSTE_DIARIO" where "VL_NOITE" = 1234 and "QTDE_MIN_NOITES" = 4 and "DT_REF" in ('${alvo}', '${somar(alvo, 4)}')`)) === 2, 'dias avulsos gravam diária e mínimo só nos dias marcados');
    ok(/Salvo\. 2 noites atualizadas/.test(await p.locator('aside [role=status]').innerText()), 'mensagem "Salvo" com o número de noites');
    sql(`delete from "SE"."SIT_AJUSTE_DIARIO" where "VL_NOITE" = 1234`);
    await abrir(p, `/admin/precos?mes=${mes}`);
  }
  await p.getByRole('radio', { name: 'Intervalo' }).click();
  await celula().click();
  await p.locator('[role=gridcell]').filter({ has: p.locator(`span:text-is("${Number(dia) + 2}")`) }).first().click().catch(() => {});
  ok(/3 noites/.test(await p.locator('aside[aria-label="Ajuste dos dias"]').innerText()), 'modo intervalo: dois toques selecionam 3 noites');
  await p.getByLabel('Diária (R$)').fill('1000');
  await p.getByRole('button', { name: 'Salvar', exact: true }).click();
  await p.waitForTimeout(500);
  ok(Number(sql(`select count(*) from "SE"."SIT_AJUSTE_DIARIO" where "DT_REF" between '${alvo}' and '${somar(alvo, 2)}' and "VL_NOITE" = 1000`)) === 3, 'ajuste em intervalo grava as 3 noites de uma vez');
  sql(`delete from "SE"."SIT_AJUSTE_DIARIO" where "DT_REF" between '${alvo}' and '${somar(alvo, 2)}'`);
  await abrir(p, '/admin/precos?mes=2027-12');
  const natal = p.locator('[role=gridcell]').filter({ has: p.locator('span:text-is("24")') }).first();
  ok(/mínimo 3 noites/.test(await natal.getAttribute('aria-label')) && /com ajuste/.test(await natal.getAttribute('aria-label')), 'Natal 2027 (do banco) aparece com ajuste e mínimo de 3 noites');
  await foto(p, 'T38-desktop');

  // ── T40 · simulador (a conta é do servidor)
  console.log('── T40 Simulador de preço');
  await abrir(p, '/admin/simulador');
  const datas = p.locator('input[type=date]');
  const resultado = async () => { await p.waitForTimeout(700); return p.locator('section[aria-label=Resultado]').innerText(); };
  await datas.nth(0).fill('2027-12-24'); await datas.nth(1).fill('2027-12-27');
  let txt = await resultado();
  ok(/Venda liberada/.test(txt) && /R\$\s?5\.100/.test(txt), 'Natal 2027, casal, 3 noites: R$ 5.100 (calculado no banco)');
  ok(/Sinal pelo Pix \(50%\)\s*R\$\s?2\.550/.test(txt.replace(/\n/g, ' ')), 'sinal de 50% = R$ 2.550');
  ok(/Natal 2027/.test(txt), 'as noites com ajuste vêm marcadas com a observação do ajuste');
  await p.getByRole('button', { name: /Mais crianças de 5 a 8 anos/i }).click();
  txt = await resultado();
  await foto(p, 'T40-natal');
  ok(/R\$\s?5\.865/.test(txt), 'com 1 criança de 5 a 8 anos (30% do valor por pessoa): R$ 5.865');
  await datas.nth(1).fill('2027-12-26');
  txt = await resultado();
  ok(/não vende/.test(txt) && /mínimo de noites/i.test(txt), 'duas noites no Natal: abaixo do mínimo, o site não vende');
  await datas.nth(0).fill('2027-12-20'); await datas.nth(1).fill('2027-12-22');
  txt = await resultado();
  ok(/Venda liberada/.test(txt) && /R\$\s?1\.840/.test(txt), 'segunda e terça com 1 criança de 5 a 8 anos: 2 × (R$ 800 + R$ 120) = R$ 1.840');
  await datas.nth(0).fill('2030-01-05'); await datas.nth(1).fill('2030-01-07');
  txt = await resultado();
  ok(/Alguma noite ainda não tem tarifa/.test(txt), 'depois do fim das tarifas: sem tarifa, venda não aberta');
  await datas.nth(0).fill(bloqueio); await datas.nth(1).fill(somar(bloqueio, 2));
  txt = await resultado();
  ok(/já estão ocupadas/.test(txt), 'datas do bloqueio que existe no banco: ocupado');
  await foto(p, 'T40-desktop');

  // ── Pacotes: Natal 2027 com check-in 24/12, 3 noites R$ 2.400 e 4 noites R$ 2.900
  console.log('── Pacotes');
  await abrir(p, '/admin/pacotes');
  for (const [n, v] of [['3', '2400'], ['4', '2900']]) {
    await p.getByRole('button', { name: 'Novo pacote' }).click();
    const f = p.locator('form[aria-label="Novo pacote"]');
    await f.getByLabel('Nome').fill('Natal 2027'); await f.getByLabel('Check-in').fill('2027-12-24');
    await f.getByLabel('Noites').fill(n); await f.getByLabel('Valor total (R$)').fill(v);
    await f.getByRole('button', { name: 'Salvar pacote' }).click();
    await p.waitForTimeout(600);
  }
  ok(sql(`select string_agg("QTDE_NOITES" || '=' || "VL_TOTAL"::int, ',' order by "QTDE_NOITES") from "SE"."SIT_PACOTE" where "SG_ATIVO"`) === '3=2400,4=2900', 'os dois pacotes do Natal ficam gravados no banco');
  ok(/Pacote salvo/.test(await p.locator('section[aria-label=Pacotes] [role=status]').innerText()), 'mensagem "Pacote salvo"');
  const lista = await p.locator('section[aria-label=Pacotes]').innerText();
  ok(/Natal 2027/.test(lista) && /R\$\s?2\.400/.test(lista) && /R\$\s?2\.900/.test(lista) && /\+ R\$\s?500/.test(lista), 'a lista mostra as duas opções e a diferença de R$ 500');
  await abrir(p, '/admin/precos?mes=2027-12');
  ok(/só pacote Natal 2027/.test(await natal.getAttribute('aria-label')), 'as noites do pacote ficam marcadas no calendário');
  await abrir(p, '/admin/pacotes');
  await p.getByRole('button', { name: 'Novo pacote' }).click();
  { const f = p.locator('form[aria-label="Novo pacote"]');
    await f.getByLabel('Nome').fill('Repetido'); await f.getByLabel('Check-in').fill('2027-12-24'); await f.getByLabel('Noites').fill('3'); await f.getByLabel('Valor total (R$)').fill('100');
    await f.getByRole('button', { name: 'Salvar pacote' }).click(); await p.waitForTimeout(300);
    ok(/Já existe um pacote ativo/.test(await p.getByRole('alert').first().innerText()), 'mesmo check-in e mesmas noites: recusado com mensagem');
    await f.getByRole('button', { name: 'Cancelar' }).click(); }
  await foto(p, 'T38-pacotes');
  await abrir(p, '/admin/simulador');
  await datas.nth(0).fill('2027-12-24'); await datas.nth(1).fill('2027-12-27');
  txt = await resultado();
  ok(/Venda liberada/.test(txt) && /R\$\s?2\.400/.test(txt) && /Pacote Natal 2027/.test(txt), 'simulador: 24 a 27/12 cobra o pacote de 3 noites, R$ 2.400');
  await datas.nth(1).fill('2027-12-28');
  txt = await resultado();
  ok(/R\$\s?2\.900/.test(txt), 'simulador: 24 a 28/12 cobra o pacote de 4 noites, R$ 2.900');
  await datas.nth(0).fill('2027-12-25');
  txt = await resultado();
  ok(/não vende/.test(txt) && /só em pacote/.test(txt), 'simulador: estadia que não é um dos pacotes não é vendida');
  await abrir(p, '/admin/pacotes');
  for (let i = 0; i < 2; i++) { await p.locator('section[aria-label=Pacotes]').getByRole('button', { name: 'Desativar' }).first().click(); await p.waitForTimeout(600); }
  ok(Number(sql(`select count(*) from "SE"."SIT_PACOTE" where "SG_ATIVO"`)) === 0, 'Desativar tira os pacotes da venda');

  // ── T39/T41 · tarifas
  console.log('── T39 Tarifas e T41 Formulário');
  await abrir(p, '/admin/tarifas');
  txt = await p.locator('main').innerText();
  ok(/Tarifa padrão/.test(txt) && /vale hoje/.test(txt), 'a lista mostra a tarifa padrão do banco, marcada como "vale hoje"');
  await foto(p, 'T39-desktop');
  await p.getByRole('link', { name: /Nova tarifa/ }).click();
  await p.waitForTimeout(500);
  await p.getByPlaceholder(/Alta temporada de julho/).fill('Teste de sobreposição');
  const inputs = p.locator('input[type=date]');
  await inputs.nth(0).fill('2027-02-01'); await inputs.nth(1).fill('2027-02-10');
  const prio = p.locator('label', { hasText: 'Prioridade' }).locator('select');
  ok(await p.getByText('Data início').isVisible() && await p.getByText('Data fim').isVisible(), 'período com Data início e Data fim');
  await prio.selectOption('0');
  ok(/se sobrepõe a “Tarifa padrão”/.test(await p.locator('main').innerText()) && await p.getByRole('button', { name: /Salvar tarifa/ }).isDisabled(), 'mesma prioridade e período: avisa a sobreposição e bloqueia salvar');
  await prio.selectOption('3');
  // dias da semana: quarta passa para o segundo valor (sexta, sábado e domingo já estão lá)
  await p.locator('[role=group][aria-label="dias do valor 1"] label[title=quarta]').click();
  ok(await p.locator('[role=group][aria-label="dias do valor 2"] input[aria-label^=quarta]').isChecked() && /seg, ter e qui/.test(await p.locator('form').innerText()), 'tocar num dia passa ele para o outro valor e os rótulos se ajustam');
  await p.getByRole('button', { name: /Salvar tarifa/ }).click();
  await p.waitForTimeout(700);
  ok(new URL(p.url()).pathname === '/admin/tarifas' && /Teste de sobreposição/.test(await p.locator('main').innerText()), 'tarifa salva no banco volta para a lista');
  ok(Number(sql(`select count(*) from "SE"."SIT_TARIFA" where "NM_TARIFA" = 'Teste de sobreposição' and "NO_PRIORIDADE" = 3`)) === 1, 'a tarifa existe em SIT_TARIFA');
  ok(sql(`select "NO_DIAS_FDS"::text from "SE"."SIT_TARIFA" where "NM_TARIFA" = 'Teste de sobreposição'`) === '{3,5,6,7}', 'os dias do segundo valor ficam gravados (quarta, sexta, sábado e domingo)');
  ok(Number(sql(`select count(*) from "SE"."VST_AUDITORIA" where "NM_TABELA" = 'SIT_TARIFA' and "TP_OPERACAO" = 'INSERT' and "ID_USUARIO" = '${UIDS.ADMIN}'`)) === 1, 'a Auditoria do Inspect mostra quem criou a tarifa');
  // desativa e reativa pelo botão da lista
  await p.getByRole('row', { name: /Teste de sobreposição/ }).getByRole('button', { name: 'Desativar' }).click();
  await p.waitForTimeout(600);
  ok(sql(`select "SG_ATIVO"::text from "SE"."SIT_TARIFA" where "NM_TARIFA" = 'Teste de sobreposição'`) === 'false', 'Desativar grava no banco (a tarifa continua na lista)');
  await p.getByRole('radio', { name: 'Inativas' }).click();
  ok(/Teste de sobreposição/.test(await p.locator('main').innerText()) && !/Tarifa padrão/.test(await p.locator('main').innerText()), 'filtro Inativas mostra só as desativadas');
  await p.getByRole('radio', { name: 'Todas' }).click();
  await p.getByRole('row', { name: /Teste de sobreposição/ }).getByRole('button', { name: 'Ativar' }).click();
  await p.waitForTimeout(600);
  ok(sql(`select "SG_ATIVO"::text from "SE"."SIT_TARIFA" where "NM_TARIFA" = 'Teste de sobreposição'`) === 'true', 'Ativar grava no banco');
  // a regra do servidor também vale: o banco recusa sobreposição mesmo se a tela deixasse passar
  const id = sql(`select "ID_TARIFA" from "SE"."SIT_TARIFA" where "NM_TARIFA" = 'Teste de sobreposição'`);
  await abrir(p, `/admin/tarifas/${id}`);
  ok(/exemplo de conta/i.test(await p.locator('main').innerText()), 'formulário de edição abre com o exemplo de conta');
  await foto(p, 'T41-desktop');
  // simula outra pessoa criando uma tarifa na mesma prioridade enquanto a tela estava aberta
  sql(`insert into "SE"."SIT_TARIFA" ("ID_UNIDADE", "NM_TARIFA", "DT_INI", "DT_FIM", "NO_PRIORIDADE", "VL_NOITE") select "ID_UNIDADE", 'Criada por outra pessoa', '2027-02-01', '2027-02-10', 7, 900 from "SE"."SIT_UNIDADE" limit 1`);
  await p.locator('label', { hasText: 'Prioridade' }).locator('select').selectOption('7');
  await p.getByRole('button', { name: /Salvar tarifa/ }).click();
  await p.waitForTimeout(700);
  ok(/se sobrepõe a outra tarifa ativa na mesma prioridade/.test(await p.locator('main').innerText()) && new URL(p.url()).pathname === `/admin/tarifas/${id}`, 'sobreposição criada por outra pessoa: o banco recusa e a tela mostra a mensagem');
  ok(sql(`select "NO_PRIORIDADE"::text from "SE"."SIT_TARIFA" where "ID_TARIFA" = ${id}`) === '3', 'a tarifa não foi alterada pelo salvamento recusado');

  // faixas de idade das crianças (por pousada): caixa de seleção no formulário
  await abrir(p, `/admin/tarifas/${id}`);
  await p.getByLabel('Bebês: idade máxima').selectOption('3');
  ok(/De 4 até/.test(await p.locator('form').innerText()) && /novas faixas valem para todas as tarifas/.test(await p.locator('form').innerText()), 'mudar a idade dos bebês ajusta a faixa seguinte e avisa que vale para todas as tarifas');
  await p.getByRole('button', { name: /Salvar tarifa/ }).click();
  await p.waitForTimeout(700);
  ok(sql(`select "NO_IDADE_MAX_BEBE" || '-' || "NO_IDADE_MAX_CRIANCA_MENOR" || '-' || "NO_IDADE_MAX_CRIANCA" from "SE"."SIT_PROPRIEDADE" limit 1`) === '3-8-13', 'as faixas ficam gravadas na pousada');
  sql(`update "SE"."SIT_PROPRIEDADE" set "NO_IDADE_MAX_BEBE" = 4`);

  // ── celular (280 px é o menor aparelho que o app atende)
  console.log('── Celular (280, 320 e 390 px)');
  await A.ctx.close();
  const M = await novo('ADMIN', 390);
  for (const w of [280, 320, 390]) {
    await M.page.setViewportSize({ width: w, height: 800 });
    for (const [rota, nome] of [['/admin/precos', 'T38'], ['/admin/tarifas', 'T39'], ['/admin/simulador', 'T40'], [`/admin/tarifas/${id}`, 'T41']]) {
      await abrir(M.page, rota);
      const extra = await M.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(extra <= 0, `${nome} sem rolagem lateral em ${w} px`);
      if (w === 390 && nome === 'T38') {
        await abrir(M.page, `/admin/precos?mes=${somar(hoje(), 35).slice(0, 7)}`);
        await M.page.evaluate(() => scrollTo(0, 250)); await M.page.waitForTimeout(200);
        const y0 = await M.page.evaluate(() => scrollY);
        await M.page.locator('[role=gridcell]:not([disabled])').nth(10).click(); await M.page.waitForTimeout(700);
        ok(Math.abs((await M.page.evaluate(() => scrollY)) - y0) < 2, 'celular: tocar no dia não tira o calendário do lugar');
        const caixa = await M.page.locator('aside[aria-label="Ajuste dos dias"]').boundingBox();
        ok(caixa && caixa.y + caixa.height <= 801 && caixa.y > 300, 'celular: o painel abre por baixo, sobre a tela, com Diária e Salvar');
        ok(await M.page.getByRole('button', { name: 'Salvar', exact: true }).isVisible(), 'celular: botão Salvar visível sem rolar');
        if (process.env.FOTO) await M.page.screenshot({ path: `${process.env.FOTO}/T38-celular-painel.png` });
      }
      if (w === 390) await foto(M.page, `${nome}-celular`);
    }
  }
  ok(A.erros.length === 0 && M.erros.length === 0, 'sem erros de JavaScript' + (A.erros[0] ? ' — ' + A.erros[0].slice(0, 120) : ''));
  ok(A.perdidos.length === 0 && M.perdidos.length === 0, 'nenhuma consulta ao banco fora do esperado' + (A.perdidos[0] ? ' — ' + A.perdidos[0] : ''));
  await browser.close();
  console.log(`\n${total - falhas}/${total} verificações ok`);
  process.exit(falhas ? 1 : 0);
})();
