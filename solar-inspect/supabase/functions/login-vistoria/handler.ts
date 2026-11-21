// Login do app Inspect por USUÁRIO ou CPF (funcionários) e senha.
// O Supabase Auth entra por e-mail; esta função acha o e-mail do funcionário ativo (vst_localizar_login) e faz o login
// com o e-mail interno. O app nunca vê o e-mail nem a chave secreta, e a resposta é a mesma para "não existe",
// "inativo" e "senha errada". Tentativas limitadas por IP e por usuário (registrar_tentativa, do banco do site).
import { type Banco, cpfValido, escalar, hash, ipDe, LOGIN_VALIDO, lerJson, responder } from "../_shared/comum.ts";

export interface Sessao { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; token_type?: string }
export interface Autenticador {
  // login no Supabase Auth com e-mail e senha; sessao nula se a senha estiver errada
  entrar(email: string, senha: string): Promise<{ sessao: Sessao | null }>;
}
export interface Ambiente {
  origensPermitidas: string[];
  autenticador: Autenticador;
  limitePorIp?: number;        // tentativas por IP e por hora
  limitePorLogin?: number;     // tentativas por usuário/CPF e por hora
}

const INVALIDO = { erro: "credenciais_invalidas", mensagem: "Usuário ou CPF e senha não conferem." };

export function criarHandler(banco: Banco, amb: Ambiente) {
  const R = (req: Request, status: number, corpo: unknown) => responder(req, amb.origensPermitidas, status, corpo);
  return async (req: Request): Promise<Response> => {
    const origem = req.headers.get("origin");
    if (origem && !amb.origensPermitidas.includes(origem)) return R(req, 403, { erro: "origem_nao_permitida" });
    if (req.method === "OPTIONS") return R(req, 204, null);
    if (req.method !== "POST") return R(req, 405, { erro: "metodo_nao_permitido" });

    const corpo = await lerJson(req, 1024);
    const login = typeof corpo?.login === "string" ? corpo.login.trim() : "";
    const senha = typeof corpo?.senha === "string" ? corpo.senha : "";
    if (!login || login.length > 60 || !senha || senha.length > 128) return R(req, 400, { erro: "pedido_invalido", mensagem: "Informe usuário ou CPF e a senha." });

    // CPF (com ou sem pontuação) ou usuário; formato inválido conta como tentativa e recebe a mesma resposta genérica
    const ehCpf = /^[\d.\-\s]+$/.test(login);
    const chave = ehCpf ? login.replace(/\D/g, "") : login.toLowerCase();
    const formatoOk = ehCpf ? cpfValido(chave) : LOGIN_VALIDO.test(chave);

    const ip = await banco.rpc("registrar_tentativa", { p_chave: await hash("login-ip:" + ipDe(req)), p_limite: amb.limitePorIp ?? 40 });
    const usr = await banco.rpc("registrar_tentativa", { p_chave: await hash("login-usuario:" + chave), p_limite: amb.limitePorLogin ?? 10 });
    if (ip.error || usr.error) return R(req, 503, { erro: "indisponivel", mensagem: "Tente de novo em instantes." });
    if (escalar(ip.data) === false || escalar(usr.data) === false) {
      return R(req, 429, { erro: "muitas_tentativas", mensagem: "Muitas tentativas. Aguarde um pouco e tente de novo." });
    }

    let funcionario: { id_usuario: string; ds_email: string; sg_ativo: boolean; tp_perfil: string; nm_usuario: string } | null = null;
    if (formatoOk) {
      const r = await banco.rpc("vst_localizar_login", { p_login: chave });
      if (r.error) return R(req, 503, { erro: "indisponivel", mensagem: "Tente de novo em instantes." });
      const linha = Array.isArray(r.data) ? r.data[0] : r.data;
      if (linha && linha.sg_ativo) funcionario = linha;
    }
    // sem funcionário (ou inativo) faz um login falso: o tempo de resposta não revela quem existe
    const { sessao } = await amb.autenticador.entrar(funcionario?.ds_email ?? "inexistente@usuarios.inspect.invalid", senha);
    if (!funcionario || !sessao) return R(req, 401, INVALIDO);

    return R(req, 200, {
      sessao: { access_token: sessao.access_token, refresh_token: sessao.refresh_token, expires_in: sessao.expires_in, expires_at: sessao.expires_at, token_type: sessao.token_type ?? "bearer" },
      usuario: { id: funcionario.id_usuario, nome: funcionario.nm_usuario, perfil: funcionario.tp_perfil },
    });
  };
}
