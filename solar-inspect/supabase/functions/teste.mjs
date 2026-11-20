// Testa login-vistoria e criar-usuario (handler.ts) com o banco e o Auth simulados em memória.
// O contrato das funções SQL (vst_localizar_login, vst_cadastrar_usuario, registrar_tentativa) é testado em database/testes_vistorias.sql.
// Uso (Node 22+): node --experimental-strip-types supabase/functions/teste.mjs
import { criarHandler as criarLogin } from './login-vistoria/handler.ts';
import { criarHandler as criarCriar, PERFIS } from './criar-usuario/handler.ts';
import { cpfValido } from './_shared/comum.ts';

let falhas = 0, total = 0;
const ok = (cond, msg) => { total++; if (cond) console.log('ok  ' + msg); else { falhas++; console.log('FALHOU: ' + msg); } };
const ORIGEM = 'https://alvesbhz.github.io';

// ── banco simulado: mesmas regras das funções SQL
const usuarios = [
  { id_usuario: 'u1', ds_email: 'ana@usuarios.inspect.invalid', sg_ativo: true, tp_perfil: 'ASSESSOR', nm_usuario: 'Ana', cd_login: 'ana.souza', cd_cpf: '52998224725' },
  { id_usuario: 'u2', ds_email: 'velho@usuarios.inspect.invalid', sg_ativo: false, tp_perfil: 'LIMPEZA', nm_usuario: 'Velho', cd_login: 'velho.func', cd_cpf: '11144477735' },
];
const senhas = { 'ana@usuarios.inspect.invalid': 'senha-da-ana', 'velho@usuarios.inspect.invalid': 'senha-do-velho' };
let tentativas = new Map(); let chamadasBanco = [];
function novoBanco({ falhaLocalizar = false, falhaCadastro = null } = {}) {
  return {
    async rpc(nome, args) {
      chamadasBanco.push([nome, args]);
      if (nome === 'registrar_tentativa') {
        const n = (tentativas.get(args.p_chave) ?? 0); if (n >= args.p_limite) return { data: false, error: null };
        tentativas.set(args.p_chave, n + 1); return { data: true, error: null };
      }
      if (nome === 'vst_localizar_login') {
        if (falhaLocalizar) return { data: null, error: { message: 'boom' } };
        const l = args.p_login.toLowerCase().trim(), d = args.p_login.replace(/\D/g, '');
        return { data: usuarios.filter(u => u.cd_login === l || u.cd_cpf === d), error: null };
      }
      if (nome === 'vst_cadastrar_usuario') {
        if (falhaCadastro) return { data: null, error: { message: falhaCadastro } };
        usuarios.push({ id_usuario: args.p_id_usuario, ds_email: '', sg_ativo: true, tp_perfil: args.p_tp_perfil, nm_usuario: args.p_nm_usuario, cd_login: args.p_cd_login, cd_cpf: args.p_cd_cpf });
        return { data: args.p_id_usuario, error: null };
      }
      return { data: null, error: { message: 'rpc_desconhecida' } };
    },
  };
}
const autenticador = { async entrar(email, senha) {
  return senhas[email] === senha ? { sessao: { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, expires_at: 1, token_type: 'bearer' } } : { sessao: null }; } };

// ── login-vistoria
let ipn = 0;
const pedir = (h, corpo, { ip = '10.0.0.' + (++ipn), origem = ORIGEM, metodo = 'POST', bruto } = {}) =>
  h(new Request('https://x/functions/v1/login-vistoria', { method: metodo, headers: { 'content-type': 'application/json', origin: origem, 'x-forwarded-for': ip }, body: metodo === 'POST' ? (bruto ?? JSON.stringify(corpo)) : undefined }));
const lerj = async (r) => ({ status: r.status, corpo: await r.json() });
{
  const h = criarLogin(novoBanco(), { origensPermitidas: [ORIGEM], autenticador, limitePorIp: 50, limitePorLogin: 4 });
  let r = await lerj(await pedir(h, { login: 'ana.souza', senha: 'senha-da-ana' }));
  ok(r.status === 200 && r.corpo.sessao.access_token === 'AT' && r.corpo.usuario.perfil === 'ASSESSOR' && r.corpo.usuario.nome === 'Ana', 'entra pelo usuário e devolve a sessão e o perfil');
  ok(!JSON.stringify(r.corpo).includes('@'), 'a resposta nunca traz o e-mail interno');
  r = await lerj(await pedir(h, { login: '529.982.247-25', senha: 'senha-da-ana' }));
  ok(r.status === 200 && r.corpo.usuario.id === 'u1', 'entra pelo CPF com pontuação');
  r = await lerj(await pedir(h, { login: '52998224725', senha: 'senha-da-ana' }));
  ok(r.status === 200, 'entra pelo CPF só com números');
  r = await lerj(await pedir(h, { login: '  ANA.Souza ', senha: 'senha-da-ana' }));
  ok(r.status === 200, 'usuário não diferencia maiúsculas nem espaços');

  const h2 = criarLogin(novoBanco(), { origensPermitidas: [ORIGEM], autenticador, limitePorIp: 500, limitePorLogin: 500 });
  const erradas = [
    await lerj(await pedir(h2, { login: 'ana.souza', senha: 'errada' })),
    await lerj(await pedir(h2, { login: 'nao.existe', senha: 'senha-da-ana' })),
    await lerj(await pedir(h2, { login: 'velho.func', senha: 'senha-do-velho' })),         // inativo, mesmo com a senha certa
    await lerj(await pedir(h2, { login: '11144477735', senha: 'senha-do-velho' })),         // inativo, pelo CPF
    await lerj(await pedir(h2, { login: '111.444.777-36', senha: 'x' })),                   // CPF inválido
    await lerj(await pedir(h2, { login: '12ab', senha: 'x' })),                              // usuário em formato inválido
  ];
  ok(erradas.every(e => e.status === 401 && e.corpo.erro === 'credenciais_invalidas'), 'senha errada, usuário inexistente, inativo e formato inválido recebem 401');
  ok(new Set(erradas.map(e => JSON.stringify(e.corpo))).size === 1, 'a resposta de erro é idêntica nos seis casos (não revela quem existe)');

  // limite por usuário: 4 tentativas por hora
  const h3 = criarLogin(novoBanco(), { origensPermitidas: [ORIGEM], autenticador, limitePorIp: 500, limitePorLogin: 4 });
  const seq = []; for (let i = 0; i < 6; i++) seq.push((await pedir(h3, { login: 'robo.teste', senha: 'x' })).status);
  ok(seq.slice(0, 4).every(s => s === 401) && seq[4] === 429 && seq[5] === 429, 'a quinta tentativa do mesmo usuário vira 429');
  r = await lerj(await pedir(h3, { login: 'ana.souza', senha: 'senha-da-ana' }));
  ok(r.status === 200, 'o bloqueio de um usuário não atrapalha os outros');
  // limite por IP
  const h4 = criarLogin(novoBanco(), { origensPermitidas: [ORIGEM], autenticador, limitePorIp: 3, limitePorLogin: 500 });
  const ips = []; for (let i = 0; i < 5; i++) ips.push((await pedir(h4, { login: 'u' + 'ab' + i, senha: 'x' }, { ip: '9.9.9.9' })).status);
  ok(ips[3] === 429 && ips[4] === 429, 'muitas tentativas do mesmo IP viram 429');
  ok(chamadasBanco.filter(c => c[0] === 'registrar_tentativa').every(c => /^[0-9a-f]{64}$/.test(c[1].p_chave)), 'o banco só recebe hash das chaves de limite (nunca CPF nem IP)');

  ok((await pedir(h, { login: 'a', senha: 'b' }, { origem: 'https://malvado.exemplo' })).status === 403, 'origem não permitida é recusada');
  const op = await pedir(h, null, { metodo: 'OPTIONS' });
  ok(op.status === 204 && op.headers.get('access-control-allow-origin') === ORIGEM, 'OPTIONS responde com CORS só para a origem permitida');
  ok((await pedir(h, null, { metodo: 'GET' })).status === 405, 'GET é recusado');
  ok((await pedir(h, null, { bruto: '{ruim' })).status === 400, 'JSON inválido é 400');
  ok((await pedir(h, { login: 'ana.souza' })).status === 400, 'sem senha é 400');
  ok((await pedir(h, { login: 'a'.repeat(100), senha: 'x' })).status === 400, 'login enorme é 400');
  ok((await pedir(h, null, { bruto: JSON.stringify({ login: 'ana.souza', senha: 'x'.repeat(2000) }) })).status === 400, 'corpo enorme é 400');
  const h5 = criarLogin(novoBanco({ falhaLocalizar: true }), { origensPermitidas: [ORIGEM], autenticador, limitePorIp: 500, limitePorLogin: 500 });
  ok((await pedir(h5, { login: 'ana.souza', senha: 'senha-da-ana' })).status === 503, 'falha do banco é 503, nunca login liberado');
}

// ── criar-usuario
const excluidos = []; let ids = 0; const criados = [];
const admin = {
  async criarLogin(email, senha) { if (email.startsWith('existe@')) return { id: null, jaExiste: true }; const id = 'novo-' + (++ids); criados.push({ id, email, senha }); return { id }; },
  async excluirLogin(id) { excluidos.push(id); },
};
const perfis = { 'tok-admin': 'ADMIN', 'tok-gestor': 'GESTOR', 'tok-assessor': 'ASSESSOR' };
const ambiente = { origensPermitidas: [ORIGEM], admin, perfilDoChamador: async (t) => perfis[t] ?? null };
const base = { nm_usuario: 'Maria Limpeza', cd_login: 'maria.limpeza', cd_cpf: '111.444.777-35', tp_perfil: 'LIMPEZA', senha: 'segredo123', ids_propriedade: [1] };
const criar = (h, corpo, token = 'tok-admin') => h(new Request('https://x/functions/v1/criar-usuario', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGEM, ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(corpo) }));
{
  let h = criarCriar(novoBanco(), ambiente);
  ok((await criar(h, base, null)).status === 401, 'sem token é 401');
  ok((await criar(h, base, 'tok-gestor')).status === 403 && (await criar(h, base, 'tok-assessor')).status === 403 && (await criar(h, base, 'tok-invalido')).status === 403, 'só o ADMIN cadastra (gestor, assessor e token inválido recebem 403)');
  ok(criados.length === 0, 'nenhum login é criado sem permissão');
  chamadasBanco = [];
  let r = await lerj(await criar(h, base));
  const cad = chamadasBanco.find(c => c[0] === 'vst_cadastrar_usuario')[1];
  ok(r.status === 201 && r.corpo.id_usuario === 'novo-1' && r.corpo.perfil === 'LIMPEZA', 'ADMIN cadastra funcionário de limpeza');
  ok(criados[0].email === 'maria.limpeza@usuarios.inspect.invalid' && criados[0].senha === 'segredo123', 'o login do Auth usa o e-mail interno derivado do usuário');
  ok(cad.p_cd_cpf === '11144477735' && cad.p_cd_login === 'maria.limpeza' && cad.p_tp_perfil === 'LIMPEZA' && cad.p_ids_propriedade[0] === 1, 'o banco recebe CPF só com números, login e perfil');
  ok(!JSON.stringify(r.corpo).includes('segredo123'), 'a resposta nunca devolve a senha');
  for (const p of PERFIS) {
    r = await lerj(await criar(h, { ...base, cd_login: 'func.' + p.toLowerCase(), cd_cpf: '', tp_perfil: p }));
    ok(r.status === 201, 'perfil ' + p + ' é aceito');
  }
  ok(PERFIS.includes('LIMPEZA') && PERFIS.includes('MANUTENCAO') && PERFIS.includes('ASSESSOR'), 'perfis de limpeza, manutenção e vistoria existem');
  const invalidos = [
    [{ ...base, nm_usuario: 'Al' }, 'nome_invalido'], [{ ...base, cd_login: '1maria' }, 'login_invalido'], [{ ...base, cd_login: 'Maria Limpeza' }, 'login_invalido'],
    [{ ...base, cd_cpf: '11144477736' }, 'cpf_invalido'], [{ ...base, tp_perfil: 'ZELADOR' }, 'perfil_invalido'], [{ ...base, senha: 'curta' }, 'senha_invalida'],
    [{ ...base, ids_propriedade: ['x'] }, 'propriedades_invalidas'],
  ];
  for (const [corpo, erro] of invalidos) { const e = await lerj(await criar(h, corpo)); ok(e.status === 422 && e.corpo.erro === erro, 'recusa ' + erro); }
  r = await lerj(await criar(h, { ...base, cd_login: 'existe' }));
  ok(r.status === 409 && r.corpo.erro === 'login_em_uso', 'usuário que já tem login no Auth é 409');
  const antes = excluidos.length;
  h = criarCriar(novoBanco({ falhaCadastro: 'cpf_em_uso' }), ambiente);
  r = await lerj(await criar(h, { ...base, cd_login: 'outra.pessoa' }));
  ok(r.status === 409 && r.corpo.erro === 'cpf_em_uso' && excluidos.length === antes + 1, 'CPF repetido: 409 e o login recém-criado é apagado');
  h = criarCriar(novoBanco({ falhaCadastro: 'erro_estranho' }), ambiente);
  r = await lerj(await criar(h, { ...base, cd_login: 'outra.pessoa2' }));
  ok(r.status === 500 && excluidos.length === antes + 2, 'erro desconhecido do banco: 500 e o login é apagado (nunca fica login sem cadastro)');
  ok((await criarCriar(novoBanco(), ambiente)(new Request('https://x/', { method: 'POST', headers: { origin: 'https://malvado.exemplo', authorization: 'Bearer tok-admin' }, body: '{}' }))).status === 403, 'origem não permitida é recusada');
}
ok(cpfValido('11144477735') && !cpfValido('11111111111') && !cpfValido('123'), 'validação de CPF');
console.log(falhas ? `\n${falhas} FALHA(S) em ${total} verificações` : `\nTODAS AS ${total} VERIFICAÇÕES PASSARAM`);
process.exit(falhas ? 1 : 0);
