// Testa a função "reservar" (handler.ts) contra um PostgreSQL de TESTE que tenha o schema "SE" e o seed.
// Uso (Node 22+, na pasta com `npm i pg`): node --experimental-strip-types teste.mjs
// Ajuste host/porta/banco logo abaixo. Nunca aponte para o banco de produção: ele grava reservas de teste.
import pg from 'pg';
import { criarHandler } from './handler.ts';

const c = new pg.Client({ host: '/tmp', port: 5550, database: 'f', user: 'postgres' });
await c.connect();
await c.query('set search_path = "SE", extensions, public');

// o mesmo contrato do supabase-js: rpc(nome, argumentos nomeados) -> { data, error }
const banco = {
  async rpc(nome, args) {
    const chaves = Object.keys(args);
    const sql = `select * from "SE".${nome}(${chaves.map((k, i) => `${k} => $${i + 1}`).join(', ')})`;
    try {
      const r = await c.query(sql, chaves.map(k => (args[k] !== null && typeof args[k] === 'object' ? JSON.stringify(args[k]) : args[k])));
      return { data: r.rows, error: null };
    } catch (e) { return { data: null, error: { message: e.message, code: e.code } }; }
  },
};

let agora = Date.now();
const h = criarHandler(banco, { origensPermitidas: ['https://alvesbhz.github.io'], limitePorHora: 6, agora: () => agora });
const ORIGEM = 'https://alvesbhz.github.io';
let nip = 0; const post = (corpo, ip = '10.0.0.' + (++nip), origem = ORIGEM) => h(new Request('https://x/functions/v1/reservar', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: origem, 'x-forwarded-for': ip }, body: JSON.stringify(corpo) }));
const base = () => ({
  reserva: { checkin: '2027-03-09', checkout: '2027-03-12', adultos: 2, criancas: 1, bebes: 0 },
  titular: { nome: 'Maria Souza', email: 'Maria@Exemplo.com', telefone: '31 99999-0001', nacionalidade: 'BR', cpf: '529.982.247-25' },
  acompanhantes: [{ tipo: 'adulto', nome: 'Joao', sobrenome: 'Souza' }, { tipo: 'crianca', nome: 'Lia', idade: 6 }],
});
let falhas = 0;
const ok = (nome, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FALHOU ') + nome + (extra ? ' · ' + extra : '')); if (!cond) falhas++; };
const j = async r => ({ s: r.status, b: r.status === 204 ? null : await r.json() });

let r = await j(await post(base()));
ok('reserva válida concluída', r.s === 200 && r.b.ok && /^SE-/.test(r.b.cd_reserva), `${r.s} ${JSON.stringify(r.b)}`);
const cd = r.b.cd_reserva;
const linha = (await c.query(`select r."TP_STATUS" st, r."DT_EXPIRA" ex, r."DS_ACOMPANHANTES" ac, r."DT_ACEITE_POLITICA" ap, h."NM_HOSPEDE" nm, h."DS_EMAIL" em, h."CD_CPF" cpf
  from "SIT_RESERVA" r join "SIT_HOSPEDE" h using ("ID_HOSPEDE") where r."CD_RESERVA" = $1`, [cd])).rows[0];
ok('reserva ficou PENDENTE aguardando o sinal, com prazo e aceite', linha.st === 'PENDENTE' && linha.ex !== null && linha.ap !== null && !!r.b.dt_expira);
ok('hóspede gravado com e-mail minúsculo e CPF só dígitos', linha.nm === 'Maria Souza' && linha.em === 'maria@exemplo.com' && linha.cpf === '52998224725');
ok('acompanhantes gravados', Array.isArray(linha.ac) && linha.ac.length === 2 && linha.ac[0].sobrenome === 'Souza');

r = await j(await post(base()));
ok('mesmas datas de novo: recusa por ocupado', r.s === 409 && r.b.motivo === 'ocupado', r.b.mensagem);
r = await j(await post({ ...base(), reserva: { ...base().reserva, checkin: '2027-04-06', checkout: '2027-04-07' } }));
ok('1 noite: recusa por mínimo de noites', r.s === 409 && r.b.motivo === 'min_noites', r.b.mensagem);
r = await j(await post({ ...base(), reserva: { ...base().reserva, checkin: '2027-04-06', checkout: '2027-04-16' } }));
ok('mais de 7 noites: recusa', r.s === 422, JSON.stringify(r.b.campos));
r = await j(await post({ ...base(), titular: { ...base().titular, cpf: '11111111111' } }));
ok('CPF inválido: recusa', r.s === 422 && r.b.campos.includes('CPF'));
r = await j(await post({ ...base(), reserva: { ...base().reserva, checkin: '2027-05-04', checkout: '2027-05-07' }, titular: { nome: 'John Miller', email: 'j@x.com', telefone: '+1 415 555 0102', nacionalidade: 'US', passaporte: 'x12345678', paisPassaporte: 'US', validadePassaporte: '2027-05-05' } }));
ok('passaporte vence antes da saída: recusa', r.s === 422, JSON.stringify(r.b.campos));
r = await j(await post({ ...base(), reserva: { ...base().reserva, checkin: '2027-05-04', checkout: '2027-05-07' }, titular: { nome: 'John Miller', email: 'j@x.com', telefone: '+1 415 555 0102', nacionalidade: 'US', passaporte: 'x12345678', paisPassaporte: 'US', validadePassaporte: '2030-01-01' }, acompanhantes: [{ tipo: 'adulto', nome: 'Anna', sobrenome: 'Miller' }] }));
ok('estrangeiro com passaporte válido: concluída', r.s === 200, JSON.stringify(r.b));
r = await j(await post({ ...base(), reserva: { ...base().reserva, checkin: '2027-06-08', checkout: '2027-06-10' }, acompanhantes: [{ tipo: 'adulto', nome: 'Joao', sobrenome: '' }] }));
ok('adulto sem sobrenome: recusa', r.s === 422 && r.b.campos.includes('nome e sobrenome dos adultos'));
r = await j(await post({ ...base(), reserva: { ...base().reserva, adultos: 3 } }));
ok('3 adultos: recusa', r.s === 422);
r = await j(await post({ ...base(), reserva: { ...base().reserva, checkin: '2027-08-03', checkout: '2027-08-05', criancas: 1, criancasMaiores: 1 }, acompanhantes: [{ tipo: 'adulto', nome: 'Joao', sobrenome: 'Souza' }] }));
ok('criança de 9 a 13 anos: paga 100% do valor por pessoa', r.s === 200 && r.b.vl_total === 2640, JSON.stringify(r.b));
r = await j(await post({ ...base(), reserva: { ...base().reserva, criancas: 1, criancasMaiores: 1, bebes: 1 } }));
ok('3 crianças somando as faixas: recusa', r.s === 422);
const antes = (await c.query('select count(*) n from "SIT_RESERVA"')).rows[0].n;
r = await j(await post({ ...base(), site: 'http://spam', reserva: { ...base().reserva, checkin: '2027-07-06', checkout: '2027-07-08' } }, '2.2.2.2'));
ok('robô (campo escondido): responde 200 sem gravar nada', r.s === 200 && (await c.query('select count(*) n from "SIT_RESERVA"')).rows[0].n === antes);
r = await j(await post(base(), '3.3.3.3', 'https://outro-site.com'));
ok('origem não autorizada: 403', r.s === 403);
r = await h(new Request('https://x', { method: 'OPTIONS', headers: { origin: ORIGEM } }));
ok('preflight CORS: 204 com a origem liberada', r.status === 204 && r.headers.get('access-control-allow-origin') === ORIGEM);
r = await h(new Request('https://x', { method: 'GET', headers: { origin: ORIGEM } }));
ok('GET: 405', r.status === 405);
let ult;
for (let i = 0; i < 7; i++) ult = await j(await post({ ...base(), reserva: { ...base().reserva, adultos: 3 } }, '9.9.9.9'));
ok('limite por IP: a 7ª tentativa na hora é barrada (429)', ult.s === 429);
agora += 3_700_000;
r = await j(await post({ ...base(), reserva: { ...base().reserva, adultos: 3 } }, '9.9.9.9'));
ok('passada 1 hora o IP volta a poder tentar', r.s === 422);
const sobra = (await c.query(`select count(*) n from "SIT_RESERVA" where "TP_STATUS" = 'PENDENTE' and "ID_HOSPEDE" is null`)).rows[0].n;
ok('nenhuma pré-reserva ficou sem cadastro por erro de validação', sobra === '0', 'pendentes: ' + sobra);
await c.end();
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTodos os testes passaram');
process.exit(falhas ? 1 : 0);
