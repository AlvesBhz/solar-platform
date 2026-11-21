// Cadastro de funcionário pelo ADMIN, dentro do app: cria o login no Supabase Auth (com e-mail interno, que o funcionário
// nunca digita) e a linha em VST_USUARIO / VST_USUARIO_PROPRIEDADE (vst_cadastrar_usuario). Se o banco recusar, o login
// recém-criado é apagado. Perfis: ASSESSOR (vistoria), LIMPEZA, MANUTENCAO, GESTOR, ADMIN.
import { type Banco, senhaValida, cpfValido, LOGIN_VALIDO, lerJson, responder } from "../_shared/comum.ts";

export interface Administrador {
  criarLogin(email: string, senha: string): Promise<{ id: string | null; jaExiste?: boolean; erro?: string }>;
  excluirLogin(id: string): Promise<void>;
}
export interface Ambiente {
  origensPermitidas: string[];
  admin: Administrador;
  // perfil do usuário dono do token (vst_perfil, chamada com o login dele); nulo se inativo ou sem cadastro
  perfilDoChamador(token: string): Promise<string | null>;
  dominioEmail?: string;
}

export const PERFIS = ["ASSESSOR", "LIMPEZA", "MANUTENCAO", "GESTOR", "ADMIN"];
const ERROS_DO_BANCO: Record<string, [number, string]> = {
  login_em_uso: [409, "Esse usuário já existe."],
  cpf_em_uso: [409, "Esse CPF já está cadastrado."],
  cpf_invalido: [422, "CPF inválido."],
  perfil_invalido: [422, "Perfil inválido."],
  propriedade_inexistente: [422, "Pousada inexistente."],
  propriedade_obrigatoria: [422, "Escolha ao menos uma pousada para este perfil."],
  dados_invalidos: [422, "Dados inválidos."],
};

export function criarHandler(banco: Banco, amb: Ambiente) {
  const R = (req: Request, status: number, corpo: unknown) => responder(req, amb.origensPermitidas, status, corpo);
  const dominio = amb.dominioEmail ?? "usuarios.inspect.invalid";
  return async (req: Request): Promise<Response> => {
    const origem = req.headers.get("origin");
    if (origem && !amb.origensPermitidas.includes(origem)) return R(req, 403, { erro: "origem_nao_permitida" });
    if (req.method === "OPTIONS") return R(req, 204, null);
    if (req.method !== "POST") return R(req, 405, { erro: "metodo_nao_permitido" });

    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return R(req, 401, { erro: "nao_autenticado" });
    if ((await amb.perfilDoChamador(token)) !== "ADMIN") return R(req, 403, { erro: "sem_permissao", mensagem: "Só o administrador cadastra usuários." });

    const c = await lerJson(req, 4096);
    if (!c) return R(req, 400, { erro: "pedido_invalido" });
    const nome = typeof c.nm_usuario === "string" ? c.nm_usuario.trim() : "";
    const login = typeof c.cd_login === "string" ? c.cd_login.trim().toLowerCase() : "";
    const cpfBruto = typeof c.cd_cpf === "string" ? c.cd_cpf.replace(/\D/g, "") : "";
    const perfil = typeof c.tp_perfil === "string" ? c.tp_perfil : "";
    const senha = typeof c.senha === "string" ? c.senha : "";
    const props = Array.isArray(c.ids_propriedade) ? c.ids_propriedade : [];
    if (nome.length < 3 || nome.length > 80) return R(req, 422, { erro: "nome_invalido", mensagem: "Informe o nome completo." });
    if (!LOGIN_VALIDO.test(login)) return R(req, 422, { erro: "login_invalido", mensagem: "Usuário: 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado, começando por letra." });
    if (cpfBruto && !cpfValido(cpfBruto)) return R(req, 422, { erro: "cpf_invalido", mensagem: "CPF inválido." });
    if (!PERFIS.includes(perfil)) return R(req, 422, { erro: "perfil_invalido", mensagem: "Perfil inválido." });
    if (!senhaValida(senha)) return R(req, 422, { erro: "senha_invalida", mensagem: "A senha precisa ter de 8 a 72 caracteres, com letras e números." });
    if (!props.every((p) => Number.isInteger(p) && p > 0)) return R(req, 422, { erro: "propriedades_invalidas" });

    const criado = await amb.admin.criarLogin(`${login}@${dominio}`, senha);
    if (criado.jaExiste) return R(req, 409, { erro: "login_em_uso", mensagem: "Esse usuário já existe." });
    if (!criado.id) return R(req, 503, { erro: "indisponivel", mensagem: "Não foi possível criar o login agora." });

    const r = await banco.rpc("vst_cadastrar_usuario", {
      p_id_usuario: criado.id, p_nm_usuario: nome, p_cd_login: login, p_cd_cpf: cpfBruto || null, p_tp_perfil: perfil, p_ids_propriedade: props,
    });
    if (r.error) {
      await amb.admin.excluirLogin(criado.id);                                  // não deixa login sem cadastro
      const conhecido = ERROS_DO_BANCO[r.error.message];
      if (conhecido) return R(req, conhecido[0], { erro: r.error.message, mensagem: conhecido[1] });
      return R(req, 500, { erro: "falha_ao_cadastrar" });
    }
    return R(req, 201, { id_usuario: criado.id, login, perfil });
  };
}
