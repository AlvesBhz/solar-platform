// MOCKUP da fila de envio e do histórico (versão real: IndexedDB + RPC idempotente no Supabase).
import type { EstadoUnidade, Gravidade } from './unidades';

export type StatusEnvio = 'pendente' | 'enviada' | 'sinalizada';
export type Envio = {
  id: string; // UUID do rascunho: reenvio não duplica
  unidadeId: string;
  unidade: string;
  tipo: string;
  inicio: string;
  fim: string;
  status: StatusEnvio;
  sinalizacoes: string[];
  ocorrencias: number;
  novoEstado?: EstadoUnidade;
  tentativas: number;
  ultimoErro?: string;
};

const KEY = 'solar-inspect:envios';
const EXEMPLOS: Envio[] = [
  { id: 'v-1021', unidadeId: 'chale-candeia', unidade: 'Chalé Candeia', tipo: 'Entrada', inicio: '2026-11-12T13:48:00', fim: '2026-11-12T14:05:00', status: 'enviada', sinalizacoes: [], ocorrencias: 1, tentativas: 1 },
  { id: 'v-1018', unidadeId: 'chale-sempre-viva', unidade: 'Chalé Sempre-viva', tipo: 'Entrada', inicio: '2026-11-13T09:07:00', fim: '2026-11-13T09:10:00', status: 'sinalizada', sinalizacoes: ['Duração abaixo de 4 min'], ocorrencias: 2, tentativas: 1 },
  { id: 'v-1009', unidadeId: 'chale-arnica', unidade: 'Chalé Arnica', tipo: 'Saída', inicio: '2026-11-13T11:02:00', fim: '2026-11-13T11:20:00', status: 'enviada', sinalizacoes: [], ocorrencias: 0, tentativas: 2 },
];

export function listarEnvios(): Envio[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? EXEMPLOS; } catch { return EXEMPLOS; }
}
function gravar(l: Envio[]) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* memória */ } }

/** Upsert por id: o mesmo UUID nunca gera dois registros. */
export function registrarEnvio(e: Envio) {
  gravar([e, ...listarEnvios().filter((x) => x.id !== e.id)]);
}

/** Processa a fila: online → confirma no "servidor"; offline → registra tentativa e erro. */
export async function sincronizar(): Promise<Envio[]> {
  await new Promise((r) => setTimeout(r, 700));
  const l = listarEnvios().map((e) => {
    if (e.status !== 'pendente') return e;
    if (!navigator.onLine) return { ...e, tentativas: e.tentativas + 1, ultimoErro: 'Sem conexão' };
    return { ...e, tentativas: e.tentativas + 1, ultimoErro: undefined, status: (e.sinalizacoes.length ? 'sinalizada' : 'enviada') as StatusEnvio };
  });
  gravar(l);
  return l;
}

/** Regras da seção 9 (no real ficam no banco). */
export function proximoEstado(tipoId: string, atual: EstadoUnidade, gravidades: Gravidade[], divergencias: number): EstadoUnidade {
  const critica = gravidades.includes('critica');
  if (tipoId === 'entrada') return critica ? 'bloqueado' : 'liberado';
  if (tipoId === 'saida') return divergencias > 0 ? 'manutencao' : 'em_limpeza';
  if (tipoId === 'preventiva') return critica ? 'manutencao' : atual;
  return atual;
}

export const DURACAO_MINIMA_MIN = 4; // configurável no banco na versão real
