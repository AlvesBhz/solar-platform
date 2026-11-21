/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SIMULADO } from './sim';

// Projeto Supabase compartilhado com o site (schema "SE"). A chave publicável é pública por desenho:
// quem protege os dados é o RLS. A chave secreta nunca entra no app.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://tnjpyjbqcjrowzjfnuln.supabase.co';
export const SUPABASE_CHAVE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_VJqLlw2XZu8v5GSAWWfOfw_qUYdyXDF';

// No link publicado (modo artifact) não há banco: o app usa os dados de demonstração.
export const MODO_DEMO = SIMULADO;

export const supabase: SupabaseClient<any, "SE", any> | null = MODO_DEMO
  ? null
  : createClient(SUPABASE_URL, SUPABASE_CHAVE, {
      db: { schema: 'SE' },
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'inspect.sessao' },
    });
