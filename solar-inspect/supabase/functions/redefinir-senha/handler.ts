// Redefinição de senha de funcionário pelo ADMIN, dentro do app (o funcionário que esqueceu a senha não precisa de e-mail).
// A própria senha qualquer funcionário troca no app (T35) com supabase.auth.updateUser({ password }), logado.
// A senha redefinida é provisória: marca SG_TROCAR_SENHA e o app exige a troca no próximo acesso.
import { type Banco, senhaValida, LOGIN_VALIDO, lerJson, responder } from "../_shared/comum.ts";

export interface Administrador {
  redefinirSenha(idUsuario: string, senha: string): Promise<{ ok: boolean }>;
}
export interface Ambiente {
  origensPermitidas: string[];
  admin: Administrador;
  // perfil do usuário dono do token (vst_perfil, chamada com o login dele); nulo se inativo ou sem cadastro
  perfilDoChamador(token: string): Promise<string | null>;
}

export function criarHandler(banco: Banco, amb: Ambiente) {
  const R = (req: Request, status: number, corpo: unknown) => responder(req, amb.origensPermitidas, status, corpo);
  return async (req: Request): Promise<Response> => {
    const origem = req.headers.get("origin");
    if (origem && !amb.origensPermitidas.includes(origem)) return R(req, 403, { erro: "origem_nao_permitida" });
    if (req.method === "OPTIONS") return R(req, 204, null);
    if (req.method !== "POST") return R(req, 405, { erro: "metodo_nao_permitido" });

    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return R(req, 401, { erro: "nao_autenticado" });
    if ((await amb.perfilDoChamador(token)) !== "ADMIN") return R(req, 403, { erro: "sem_permissao", mensagem: "Só o administrador redefine senhas." });

    const c = await lerJson(req, 1024);
    const login = typeof c?.cd_login === "string" ? c.cd_login.trim().toLowerCase() : "";
    const senha = typeof c?.senha === "string" ? c.senha : "";
    if (!LOGIN_VALIDO.test(login)) return R(req, 422, { erro: "login_invalido", mensagem: "Informe o usuário do funcionário." });
    if (!senhaValida(senha)) return R(req, 422, { erro: "senha_invalida", mensagem: "A senha precisa ter de 10 a 72 caracteres, com letras e números." });

    const r = await banco.rpc("vst_localizar_login", { p_login: login });
    if (r.error) return R(req, 503, { erro: "indisponivel", mensagem: "Tente de novo em instantes." });
    const linha = Array.isArray(r.data) ? r.data[0] : r.data;
    if (!linha) return R(req, 404, { erro: "usuario_inexistente", mensagem: "Usuário não encontrado." });
    const { ok } = await amb.admin.redefinirSenha(linha.id_usuario, senha);
    if (!ok) return R(req, 503, { erro: "indisponivel", mensagem: "Não foi possível redefinir a senha agora." });
    // senha provisória: o funcionário terá de trocá-la no próximo acesso
    const m = await banco.rpc("vst_exigir_troca_senha", { p_id_usuario: linha.id_usuario });
    if (m.error) return R(req, 503, { erro: "indisponivel", mensagem: "Senha redefinida, mas não foi possível exigir a troca. Tente de novo." });
    return R(req, 200, { id_usuario: linha.id_usuario, login });
  };
}
