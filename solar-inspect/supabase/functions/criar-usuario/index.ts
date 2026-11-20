// Entrada da função no Supabase. O token de quem chama vem no cabeçalho Authorization; só o perfil ADMIN passa.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { criarHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const chaveSecreta = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const banco = createClient(url, chaveSecreta, { db: { schema: "SE" }, auth: { persistSession: false } });

Deno.serve(criarHandler(banco, {
  origensPermitidas: (Deno.env.get("ALLOWED_ORIGINS") ?? "https://alvesbhz.github.io").split(",").map((s) => s.trim()),
  dominioEmail: Deno.env.get("INSPECT_EMAIL_DOMAIN") || undefined,
  async perfilDoChamador(token) {
    // chamada com o login de quem pediu (não com a chave secreta): vst_perfil lê auth.uid() e devolve o perfil se estiver ativo
    const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      db: { schema: "SE" }, auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await comoUsuario.rpc("vst_perfil");
    return error || typeof data !== "string" ? null : data;
  },
  admin: {
    async criarLogin(email, senha) {
      const { data, error } = await banco.auth.admin.createUser({ email, password: senha, email_confirm: true });
      if (error) return { id: null, jaExiste: /already|registered|exists/i.test(error.message), erro: error.message };
      return { id: data.user.id };
    },
    async excluirLogin(id) { await banco.auth.admin.deleteUser(id); },
  },
}));
