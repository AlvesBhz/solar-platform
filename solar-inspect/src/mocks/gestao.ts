// MOCKUP da gestão: ocorrências tratáveis e mudança manual de estado (versão real: tabelas + RLS).
import { listarUnidades, type EstadoUnidade, type Gravidade, type Unidade } from './unidades';

export type StatusOc = 'aberta' | 'em_tratamento' | 'resolvida' | 'cancelada';
export type OcorrenciaG = {
  id: string; unidadeId: string; unidade: string; ambiente: string; descricao: string; gravidade: Gravidade;
  prazo: string; status: StatusOc; responsavel?: string; historico: { em: string; texto: string }[];
};

const K_OC = 'solar-inspect:ocorrencias';
const K_EST = 'solar-inspect:estados';
const ler = <T,>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch { return d; } };
const gravar = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* memória */ } };

export const RESPONSAVEIS = ['Equipe de manutenção', 'Governança', 'Carla Dias', 'Bruno Lima'];

export async function unidadesGestao(): Promise<Unidade[]> {
  const est = ler<Record<string, EstadoUnidade>>(K_EST, {});
  return (await listarUnidades()).map((u) => ({ ...u, estado: est[u.id] ?? u.estado }));
}

/** Mudança manual de estado exige justificativa (registrada na auditoria). */
export function alterarEstado(unidadeId: string, estado: EstadoUnidade, justificativa: string) {
  gravar(K_EST, { ...ler(K_EST, {}), [unidadeId]: estado });
  registrarAuditoria('Estado alterado manualmente', `${unidadeId} → ${estado}: ${justificativa}`);
}

export async function listarOcorrencias(): Promise<OcorrenciaG[]> {
  const salvas = ler<OcorrenciaG[] | null>(K_OC, null);
  if (salvas) return salvas;
  const us = await listarUnidades();
  const seed = us.flatMap((u) => u.ocorrencias.map((o) => ({
    id: o.id, unidadeId: u.id, unidade: u.nome, ambiente: o.ambiente, descricao: o.descricao, gravidade: o.gravidade,
    prazo: o.prazo, status: 'aberta' as StatusOc, historico: [{ em: u.ultima?.data ?? new Date().toISOString(), texto: `Criada na vistoria (${u.ultima?.tipo ?? '—'})` }],
  })));
  gravar(K_OC, seed);
  return seed;
}

export async function atualizarOcorrencia(id: string, mud: Partial<OcorrenciaG>, texto: string) {
  const l = (await listarOcorrencias()).map((o) => o.id === id ? { ...o, ...mud, historico: [...o.historico, { em: new Date().toISOString(), texto }] } : o);
  gravar(K_OC, l);
  registrarAuditoria('Ocorrência atualizada', `${id}: ${texto}`);
  return l.find((o) => o.id === id)!;
}

export type EventoAud = { em: string; usuario: string; acao: string; detalhe: string };
const K_AUD = 'solar-inspect:auditoria';
const AUD_SEED: EventoAud[] = [
  { em: '2026-11-13T09:01:00', usuario: 'Bruno Lima', acao: 'Presença GPS', detalhe: 'Chalé Sempre-viva · aprovado · 14 m / ±9 m' },
  { em: '2026-11-13T09:02:00', usuario: 'Bruno Lima', acao: 'Presença QR', detalhe: 'Chalé Sempre-viva · aprovado' },
  { em: '2026-11-13T09:10:00', usuario: 'Bruno Lima', acao: 'Vistoria enviada', detalhe: 'Chalé Sempre-viva · Entrada · sinalizada (duração)' },
  { em: '2026-11-12T13:40:00', usuario: 'Ana Souza', acao: 'Presença QR', detalhe: 'Chalé Candeia · rejeitado (QR expirado)' },
  { em: '2026-11-11T18:20:00', usuario: 'Admin Demo', acao: 'QR rotacionado', detalhe: 'Quarto 101 · códigos anteriores invalidados' },
];
export const listarAuditoria = () => ler<EventoAud[]>(K_AUD, AUD_SEED);
export function registrarAuditoria(acao: string, detalhe: string) {
  gravar(K_AUD, [{ em: new Date().toISOString(), usuario: 'Gestor Demo', acao, detalhe }, ...listarAuditoria()]);
}
