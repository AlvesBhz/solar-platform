// Rascunho da vistoria em andamento, guardado no aparelho (localStorage): sobrevive a fechar o app e à falta de internet.
// As fotos ficam no IndexedDB (mocks/fotos.ts). Ao confirmar, vira um envio na fila (lib/fila.ts).
import type { ResultadoValidacao } from './servidor';

export type Rascunho = {
  id: string; // UUID da vistoria: o da agendada pelo site ou gerado no aparelho (avulsa); reenviar não duplica
  unidadeId: string;
  tipoId: string;
  uid?: string;          // dono do rascunho (outro login no aparelho não o reaproveita)
  idTipo?: number;       // VST_TIPO_VISTORIA.ID_TIPO_VISTORIA
  cdTipo?: string;
  nomeTipo?: string;
  comportamento?: string;
  exigeAssinatura?: boolean;
  avulsa?: boolean;      // true: o app cria a vistoria (vst_criar_vistoria) antes de iniciar
  dtAgendada?: string;   // YYYY-MM-DD
  iniciada?: boolean;    // vst_iniciar_vistoria já aceito pelo servidor
  presenca: { gps?: ResultadoValidacao; qr?: ResultadoValidacao };
  inicio?: string;
  respostas: Record<string, string>;
  obs?: Record<string, string>;
  ocorrencias?: Record<string, { gravidade: 'baixa' | 'media' | 'critica'; descricao: string }>; // 1 por item (sem duplicidade)
  assinatura?: string;
  ambAtual?: string; // ambiente em avaliação (volta do detalhe reposiciona aqui)
  ultimoItem?: string;
  avancou?: Record<string, boolean>; // ambientes já concluídos que avançaram sozinhos
  salvoEm?: string;
};

const KEY = 'solar-inspect:rascunho';
const armazem = (): Storage => { try { return localStorage; } catch { return sessionStorage; } };
let memoria: Rascunho | null = null;

function uuid() {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}

export function lerRascunho(unidadeId: string): Rascunho | null {
  if (!memoria) {
    try { memoria = JSON.parse(armazem().getItem(KEY) ?? 'null'); } catch { memoria = null; }
  }
  return memoria && memoria.unidadeId === unidadeId ? memoria : null;
}

export function salvarRascunho(r: Rascunho): Rascunho {
  memoria = { ...r, salvoEm: new Date().toISOString() };
  try { armazem().setItem(KEY, JSON.stringify(memoria)); } catch { /* segue em memória */ }
  return memoria;
}

export function novoRascunho(unidadeId: string, tipoId: string, extra: Partial<Rascunho> = {}): Rascunho {
  return salvarRascunho({ id: uuid(), unidadeId, tipoId, presenca: {}, respostas: {}, ...extra });
}

export function descartarRascunho() {
  memoria = null;
  try { armazem().removeItem(KEY); } catch { /* ok */ }
}

/** Rascunho guardado, de qualquer unidade (há um por aparelho). */
export function rascunhoAtual(): Rascunho | null {
  if (!memoria) { try { memoria = JSON.parse(armazem().getItem(KEY) ?? 'null'); } catch { memoria = null; } }
  return memoria;
}
