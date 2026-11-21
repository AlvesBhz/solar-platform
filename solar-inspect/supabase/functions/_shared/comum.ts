// Peças comuns das funções do Solar Inspect. Só usa Request/Response: roda no Supabase (Deno) e nos testes (Node).

export interface Banco {
  rpc(nome: string, args: Record<string, unknown>): Promise<{ data: any; error: { message: string; code?: string } | null }>;
}

export function cpfValido(cpf: string): boolean {
  const s = cpf.replace(/\D/g, "");
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(s[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(s[t])) return false;
  }
  return true;
}

// usuário de acesso: começa por letra (nunca se confunde com CPF), minúsculo, 3 a 40 caracteres
export const LOGIN_VALIDO = /^[a-z][a-z0-9._-]{2,39}$/;

export async function hash(texto: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("inspect:" + texto));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function ipDe(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";
}

// valor de função escalar: o supabase-js devolve o valor; outros clientes, uma linha
export const escalar = (d: any) => (Array.isArray(d) ? Object.values(d[0] ?? {})[0] : d && typeof d === "object" ? Object.values(d)[0] : d);

export function cabecalhos(req: Request, origensPermitidas: string[]): Record<string, string> {
  const h: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "origin",
  };
  const origem = req.headers.get("origin");
  if (origem && origensPermitidas.includes(origem)) {
    h["access-control-allow-origin"] = origem;
    h["access-control-allow-headers"] = "authorization, content-type, apikey, x-client-info";
    h["access-control-allow-methods"] = "POST, OPTIONS";
    h["access-control-max-age"] = "600";
  }
  return h;
}

export function responder(req: Request, origens: string[], status: number, corpo: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(corpo), { status, headers: cabecalhos(req, origens) });
}

// lê o corpo JSON com limite de tamanho; devolve null se não for um objeto válido
export async function lerJson(req: Request, maxBytes = 4096): Promise<Record<string, unknown> | null> {
  try {
    const bruto = await req.text();
    if (bruto.length > maxBytes) return null;
    const v = JSON.parse(bruto);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** Senha (provisória ou nova): 8 a 72 bytes, com letras e números. A mesma regra das telas. */
export const senhaValida = (s: string) => s.length >= 8 && new TextEncoder().encode(s).length <= 72 && /[A-Za-zÀ-ÿ]/.test(s) && /\d/.test(s);
