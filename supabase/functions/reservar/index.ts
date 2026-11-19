// Entrada da função no Supabase. Usa a chave de serviço, que o próprio Supabase injeta (SUPABASE_SERVICE_ROLE_KEY):
// ela nunca aparece no site nem no GitHub.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { criarHandler } from "./handler.ts";

const banco = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  db: { schema: "SE" },
  auth: { persistSession: false },
});

Deno.serve(criarHandler(banco, {
  origensPermitidas: (Deno.env.get("ALLOWED_ORIGINS") ?? "https://alvesbhz.github.io").split(",").map((s) => s.trim()),
  turnstileSecret: Deno.env.get("TURNSTILE_SECRET") || undefined,
}));
