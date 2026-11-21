// Entrada da função no Supabase. O token de quem chama vem no cabeçalho Authorization; só o perfil ADMIN passa.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { criarHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const banco = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { db: { schema: "SE" }, auth: { persistSession: false } });

Deno.serve(criarHandler(banco, {
  origensPermitidas: (Deno.env.get("ALLOWED_ORIGINS") ?? "https://alvesbhz.github.io").split(",").map((s) => s.trim()),
  async perfilDoChamador(token) {
    const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      db: { schema: "SE" }, auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await comoUsuario.rpc("vst_perfil");
    return error || typeof data !== "string" ? null : data;
  },
  admin: {
    async redefinirSenha(idUsuario, senha) {
      const { error } = await banco.auth.admin.updateUserById(idUsuario, { password: senha });
      return { ok: !error };
    },
  },
}));
