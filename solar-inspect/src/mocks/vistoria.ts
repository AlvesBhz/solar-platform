// MOCKUP do rascunho da vistoria. Na versão real: IndexedDB (Dexie) + fila de sincronização.
import type { ResultadoValidacao } from './servidor';

export type Rascunho = {
  id: string; // UUID gerado no aparelho antes da primeira gravação
  unidadeId: string;
  tipoId: string;
  presenca: { gps?: ResultadoValidacao; qr?: ResultadoValidacao };
  inicio?: string;
  respostas: Record<string, string>;
  obs?: Record<string, string>;
  salvoEm?: string;
};

const KEY = 'solar-inspect:rascunho';
let memoria: Rascunho | null = null;

function uuid() {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

export function lerRascunho(unidadeId: string): Rascunho | null {
  if (!memoria) {
    try { memoria = JSON.parse(sessionStorage.getItem(KEY) ?? 'null'); } catch { memoria = null; }
  }
  return memoria && memoria.unidadeId === unidadeId ? memoria : null;
}

export function salvarRascunho(r: Rascunho): Rascunho {
  memoria = { ...r, salvoEm: new Date().toISOString() };
  try { sessionStorage.setItem(KEY, JSON.stringify(memoria)); } catch { /* segue em memória */ }
  return memoria;
}

export function novoRascunho(unidadeId: string, tipoId: string): Rascunho {
  return salvarRascunho({ id: uuid(), unidadeId, tipoId, presenca: {}, respostas: {} });
}
