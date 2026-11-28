// Site (index.html e reserva.html) com pacotes, no navegador: as chamadas rpc do Supabase são respondidas por um
// PostgreSQL de TESTE (banco "site_e2e", montado aqui com o schema, o seed e as migrações), como o papel anon. Nada vai à produção.
// Uso (na pasta site): (python3 -m http.server 8090 &) && PGUSER=... node database/testar-site-pacotes.cjs   · FOTO=/pasta salva imagens
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const R = path.resolve(__dirname, '../..');
execFileSync('psql', ['-qd', 'postgres', '-c', 'drop database if exists site_e2e', '-c', 'create database site_e2e'], { env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } });
for (const f of ['solar-inspect/database/simulado_supabase.sql', 'site/database/schema.sql', 'site/database/seed_exemplo.sql', 'solar-inspect/database/migracao_vistorias.sql', 'site/database/migracao_precos_gestao.sql', 'site/database/migracao_pacotes.sql'])
  execFileSync('psql', ['-qd', 'site_e2e', '-v', 'ON_ERROR_STOP=1', '-f', path.join(R, f)], { env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' }, stdio: ['ignore', 'ignore', 'inherit'] });
execFileSync('psql', ['-qd', 'site_e2e', '-c', `insert into "SE"."SIT_PACOTE" ("ID_UNIDADE", "NM_PACOTE", "DT_CHECKIN", "QTDE_NOITES", "VL_TOTAL")
  select "ID_UNIDADE", 'Natal 2026', '2026-12-24', n, v from "SE"."SIT_UNIDADE", (values (3, 2400), (4, 2900)) x(n, v) where "CD_UNIDADE" = 'casa-do-mirante';
  update "SE"."SIT_PROPRIEDADE" set "NO_IDADE_MAX_BEBE" = 3, "NO_IDADE_MAX_CRIANCA_MENOR" = 7, "NO_IDADE_MAX_CRIANCA" = 12`]);   // faixas mudadas no Inspect
const BASE = 'http://localhost:8090', FOTO = process.env.FOTO;
let f = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok  ' : 'FALHOU: ') + m); if (!c) f++; };
const lit = (v) => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
function rpc(fn, corpo) {
  const args = Object.entries(corpo).filter(([, v]) => v !== undefined).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
  const out = execFileSync('psql', ['-qAt', '-d', 'site_e2e', '-c', `set role anon; select coalesce(jsonb_agg(to_jsonb(t)), '[]') from "SE".${fn}(${args}) t`], { encoding: 'utf8' });
  return out.trim().split('\n').pop();
}
(async () => {
  const b = await chromium.launch();
  for (const w of [1280, 390]) {
    const p = await b.newPage({ viewport: { width: w, height: 860 } });
    const erros = []; p.on('pageerror', (e) => erros.push(String(e)));
    await p.route('https://tnjpyjbqcjrowzjfnuln.supabase.co/**', (r) => {
      const fn = new URL(r.request().url()).pathname.split('/').pop();
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: rpc(fn, JSON.parse(r.request().postData() || '{}')) });
    });
    await p.goto(BASE + '/index.html'); await p.waitForTimeout(800);
    await p.evaluate(() => openBkPopup(new Event('click'))); await p.waitForTimeout(300);
    await p.evaluate(() => Booking.open('guests')); await p.waitForTimeout(300);
    const gst = await p.locator('.bk-pop-guests').innerText();
    ok(/13\+/.test(gst) && /8 a 12/.test(gst) && /4 a 7/.test(gst) && /3/.test(gst), `${w}px: seletor de hóspedes mostra as faixas do banco (até 3, 4 a 7, 8 a 12, 13+)`);
    await p.evaluate(() => Booking.close()); await p.waitForTimeout(200);
    await p.locator('[data-field="checkin"]').first().click(); await p.waitForTimeout(300);
    await p.locator('#calNext').click(); await p.waitForTimeout(1200);
    const dia = (d) => ({
      at: async () => p.locator('.bk-pop-cal .cal-d').nth(await p.evaluate((d) => [...document.querySelectorAll('.bk-pop-cal .cal-d')].findIndex((c) => c._date && c._date.getMonth() === 11 && c._date.getDate() === d), d)),
      click: async function () { return (await this.at()).click(); }, evaluate: async function (fn) { return (await this.at()).evaluate(fn); },
    });
    ok(await dia(25).evaluate((c) => c.classList.contains('cal-pac')), `${w}px: dias do pacote marcados no calendário`);
    await dia(25).click(); await p.waitForTimeout(150); await dia(27).click(); await p.waitForTimeout(300);
    const aviso = await p.locator('.bk-pop-cal .cal-aviso').innerText().catch(() => '');
    ok(/Só pacotes: check-in 24\/12, 3 ou 4 noites/i.test(aviso), `${w}px: 25→27 recusado no calendário com aviso (“${aviso}”)`);
    await dia(24).click(); await p.waitForTimeout(150); await dia(27).click(); await p.waitForTimeout(700);
    await p.locator('#bkSearchBtn').click(); await p.waitForTimeout(1500);
    let txt = await p.locator('#bkResult').innerText();
    ok(/Pacote Natal 2026/i.test(txt) && /R\$\s?2\.400/.test(txt), `${w}px: 24→27 mostra o pacote de R$ 2.400`);
    ok(/Por mais R\$\s?500,00, fique até/.test(txt) && /Fico 4 noites/i.test(txt), `${w}px: oferta "Por mais R$ 500, fique até 28/12" com "Fico 4 noites"`);
    if (FOTO) await p.screenshot({ path: `${FOTO}/site-oferta-${w}.png` });
    await p.locator('#bkResult .bkr-oferta button').click(); await p.waitForTimeout(1500);
    txt = await p.locator('#bkResult').innerText();
    ok(/R\$\s?2\.900/.test(txt) && !/Fico 4 noites/i.test(txt), `${w}px: "Fico 4 noites" troca para o pacote de R$ 2.900`);
    ok(/ci=2026-12-24&co=2026-12-28/.test(await p.locator('#bkResult .bkr-cta').getAttribute('href')), `${w}px: link da reserva com 24→28`);
    // datas que só tocam o pacote, escolhidas sem o calendário (ex.: link antigo): o resultado lista as opções
    await p.evaluate(() => { const s = Booking.getState(); s.checkin = new Date(2026, 11, 26); s.checkout = new Date(2026, 11, 29); Booking.updateDisplays(); Disponibilidade.consultar(); });
    await p.waitForTimeout(1500);
    txt = await p.locator('#bkResult').innerText();
    ok(/só pacotes/.test(txt) && (await p.locator('#bkResult .bkr-pacotes button').count()) === 2, `${w}px: 26→29 mostra as duas opções de pacote`);
    if (FOTO) await p.screenshot({ path: `${FOTO}/site-opcoes-${w}.png` });
    ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, `${w}px: sem rolagem lateral`);
    ok(erros.length === 0, `${w}px: sem erros de JavaScript ${erros[0] || ''}`);
    await p.close();
  }
  // reserva.html com o pacote
  const p = await b.newPage({ viewport: { width: 390, height: 860 } });
  await p.route('https://tnjpyjbqcjrowzjfnuln.supabase.co/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: rpc(new URL(r.request().url()).pathname.split('/').pop(), JSON.parse(r.request().postData() || '{}')) }));
  await p.goto(BASE + '/reserva.html?ci=2026-12-24&co=2026-12-28&a=2&c=0&m=0&b=0'); await p.waitForTimeout(1500);
  ok(await p.locator('#fxM').innerText() === '8 a 12 anos' && /até 3 anos, 4 a 7 anos e 8 a 12 anos/.test(await p.locator('#fxContrato').innerText()), 'reserva.html: faixas e contrato com as idades do banco');
  ok(/4 · Pacote Natal 2026/.test(await p.locator('#rN').innerText()) && /R\$\s?2\.900/.test(await p.locator('#rT').innerText()), 'reserva.html: 24→28 mostra o pacote e R$ 2.900');
  await p.goto(BASE + '/reserva.html?ci=2026-12-25&co=2026-12-27&a=2&c=0&m=0&b=0'); await p.waitForTimeout(1500);
  ok(/só pacotes/.test(await p.locator('#resEstado').innerText()), 'reserva.html: 25→27 explica que só há pacotes');
  await b.close();
  console.log(`${n - f}/${n} ok`); process.exit(f ? 1 : 0);
})();
