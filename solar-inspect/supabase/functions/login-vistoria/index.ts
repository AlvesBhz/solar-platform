// Entrada da função no Supabase. A chave secreta (SUPABASE_SERVICE_ROLE_KEY) é injetada pelo próprio Supabase:
// nunca aparece no app nem no GitHub. ALLOWED_ORIGINS (opcional): origens do app, separadas por vírgula.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { criarHandler } from "./handler.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const banco = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { db: { schema: "SE" }, auth: { persistSession: false } });
const publico = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(criarHandler(banco, {
  origensPermitidas: (Deno.env.get("ALLOWED_ORIGINS") ?? "https://alvesbhz.github.io").split(",").map((s) => s.trim()),
  autenticador: {
    async entrar(email, senha) {
      const { data, error } = await publico.auth.signInWithPassword({ email, password: senha });
      return { sessao: error || !data.session ? null : data.session };
    },
  },
}));
