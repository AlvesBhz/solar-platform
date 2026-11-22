// Dados das telas de gestão (T20–T27). Real: Supabase (vst_* e tabelas VST_ com RLS). Demonstração: src/mocks.
import { MODO_DEMO, supabase } from './supabase';
import * as mg from '../mocks/gestao';
import { listarEnvios as enviosDemo } from '../mocks/envios';
import { hoje, listarUnidades, mensagemErro, rotuloSinal, type UnidadeCampo } from './campo';
import type { EstadoUnidade, Gravidade } from '../mocks/unidades';

const REAL = !MODO_DEMO && !!supabase;
const db = () => supabase!;
export type Resultado = { ok: true } | { ok: false; erro: string };
const ERROS_GESTAO: Record<string, string> = {
  ocorrencias_criticas_abertas: 'Ainda há ocorrência crítica aberta nesta unidade: resolva-a antes de liberar.',
  ocorrencia_encerrada: 'Esta ocorrência já foi encerrada.',
  status_invalido: 'Para liberar a unidade, a ocorrência precisa estar resolvida ou cancelada.',
  data_fim_invalida: 'A data final do bloqueio precisa ser depois de hoje.',
  responsavel_invalido: 'Esse responsável não está ativo ou não tem acesso a esta pousada.',
  prazo_invalido: 'O prazo não pode estar no passado.',
  situacao_invalida: 'Situação inválida.',
};
const erro = (e: unknown): string => {
  const m = String((e as { message?: string })?.message ?? e);
  const k = Object.keys(ERROS_GESTAO).find((c) => m.includes(c));
  return k ? ERROS_GESTAO[k] : mensagemErro(e);
};
async function rpc(nome: string, args: Record<string, unknown>): Promise<Resultado> {
  try { const { error } = await db().rpc(nome, args); return error ? { ok: false, erro: erro(error) } : { ok: true }; }
  catch (e) { return { ok: false, erro: erro(e) }; }
}
const minusculo = <T extends string>(s?: string | null) => (s ? s.toLowerCase() : undefined) as T | undefined;

// ── unidades e situação (T21/T22)
export const unidadesGestao = (): Promise<UnidadeCampo[]> => (REAL ? listarUnidades() : mg.unidadesGestao());

/** Muda a situação da unidade. LIBERADO encerra o bloqueio de manutenção e só vale sem ocorrência crítica aberta. */
export async function alterarSituacao(unidadeId: string, s: EstadoUnidade): Promise<Resultado> {
  if (!REAL) { mg.alterarEstado(unidadeId, s, 'demonstração'); return { ok: true }; }
  return rpc('vst_alterar_situacao_unidade', { p_id_unidade: Number(unidadeId), p_tp_situacao: s.toUpperCase() });
}

// ── ocorrências (T20/T22/T25/T26)
export type StatusOc = 'aberta' | 'em_tratamento' | 'resolvida' | 'cancelada';
export type Registro = { quando: string; texto: string };
export type OcorrenciaG = {
  id: string; unidadeId: string; unidade: string; ambiente: string; item: string; descricao: string; gravidade: Gravidade; status: StatusOc;
  abertura: string; resolucao?: string; bloqueioAte?: string; vistoriaId?: string; origem: string; historico: Registro[];
  responsavelId?: string; responsavel?: string; prazo?: string;
};
export const emAberto = (o: OcorrenciaG) => o.status === 'aberta' || o.status === 'em_tratamento';
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export async function listarOcorrencias(f: { unidadeId?: string; vistoriaId?: string } = {}): Promise<OcorrenciaG[]> {
  if (!REAL) {
    return (await mg.listarOcorrencias()).filter((o) => !f.unidadeId || o.unidadeId === f.unidadeId).map((o) => ({
      id: o.id, unidadeId: o.unidadeId, unidade: o.unidade, ambiente: o.ambiente, item: '', descricao: o.descricao, gravidade: o.gravidade,
      status: o.status, abertura: o.historico[0]?.em ?? o.prazo, origem: o.historico[0]?.texto ?? 'Vistoria',
      historico: o.historico.map((h) => ({ quando: dataHora(h.em), texto: h.texto })),
    }));
  }
  const { data, error } = await db().rpc('vst_ocorrencias', { p_id_unidade: f.unidadeId ? Number(f.unidadeId) : null, p_id_vistoria: f.vistoriaId ?? null });
  if (error) throw error;
  return (data ?? []).map((o: any): OcorrenciaG => {
    const origem = `Aberta na vistoria de ${String(o.nm_tipo_vistoria).toLowerCase()}${o.nm_autor ? ` por ${o.nm_autor}` : ''}`;
    const tratamento = String(o.ds_tratamento ?? '').split('\n').filter(Boolean).map((l): Registro => {
      const [quando, ...resto] = l.split(' · ');
      return resto.length ? { quando, texto: resto.join(' · ') } : { quando: '', texto: l };
    });
    const fim = o.tp_status === 'RESOLVIDA' && o.dt_resolucao ? [{ quando: dataHora(o.dt_resolucao), texto: 'Ocorrência resolvida' }] : [];
    return {
      id: String(o.id_ocorrencia), unidadeId: String(o.id_unidade), unidade: o.nm_unidade, ambiente: o.nm_ambiente, item: o.nm_item,
      descricao: o.ds_ocorrencia, gravidade: minusculo<Gravidade>(o.tp_gravidade)!, status: minusculo<StatusOc>(o.tp_status)!,
      abertura: o.dt_abertura, resolucao: o.dt_resolucao ?? undefined, bloqueioAte: o.dt_bloqueio_fim ?? undefined, vistoriaId: o.id_vistoria, origem,
      responsavelId: o.id_responsavel ?? undefined, responsavel: o.nm_responsavel ?? undefined, prazo: o.dt_prazo ?? undefined,
      historico: [{ quando: dataHora(o.dt_abertura), texto: `${origem}: ${o.ds_ocorrencia}` }, ...tratamento, ...fim],
    };
  });
}

/** Trata a ocorrência: comentário/andamento (EM_TRATAMENTO), resolver ou cancelar; liberar = devolve a unidade à venda. */
export async function tratarOcorrencia(id: string, status: 'em_tratamento' | 'resolvida' | 'cancelada', texto: string, liberar = false): Promise<Resultado> {
  if (!REAL) { await mg.atualizarOcorrencia(id, { status }, texto || status); return { ok: true }; }
  return rpc('vst_resolver_ocorrencia', { p_id_ocorrencia: Number(id), p_tp_status: status.toUpperCase(), p_ds_tratamento: texto.trim() || null, p_liberar: liberar });
}

/** Gestão: define quem cuida da ocorrência e até quando (vazio = sem responsável / sem prazo). */
export async function planejarOcorrencia(id: string, responsavelId: string | null, prazo: string | null): Promise<Resultado> {
  if (!REAL) return { ok: true };
  return rpc('vst_planejar_ocorrencia', { p_id_ocorrencia: Number(id), p_id_responsavel: responsavelId, p_dt_prazo: prazo });
}
/** Prazo vencido de ocorrência em aberto. */
export const atrasada = (o: OcorrenciaG) => emAberto(o) && !!o.prazo && o.prazo < hoje();

/** Tira a unidade da venda por causa da ocorrência, até o dia informado (inclusive). */
export async function bloquearPorOcorrencia(id: string, ateDia: string): Promise<Resultado> {
  if (!REAL) return { ok: true };
  const d = new Date(ateDia + 'T12:00:00'); d.setDate(d.getDate() + 1);   // SIT_BLOQUEIO.DT_FIM = dia seguinte ao último
  return rpc('vst_bloquear_por_ocorrencia', { p_id_ocorrencia: Number(id), p_dt_fim: d.toISOString().slice(0, 10) });
}

// ── vistorias (T20/T23/T24/T27)
export type StatusV = 'agendada' | 'em_andamento' | 'concluida' | 'cancelada';
export type VistoriaG = {
  id: string; unidadeId: string; unidade: string; tipo: string; status: StatusV; agendada: string; inicio?: string; fim?: string;
  responsavel?: string; sinalizacoes: string[]; situacao?: EstadoUnidade;
};
export type Resposta = { ambiente: string; item: string; resposta: 'OK' | 'PROBLEMA' | 'NAO_SE_APLICA'; observacao?: string; qtde?: number; fotos: string[] };
export type DetalheV = VistoriaG & {
  respostas: Resposta[]; ocorrencias: OcorrenciaG[]; assinatura?: string; observacao?: string; validacao?: string;
  distancia?: number; precisao?: number; recebimento?: string;
};
const SEL = 'ID_VISTORIA, ID_UNIDADE, TP_STATUS, DT_AGENDADA, DT_INICIO, DT_FIM, DS_SINALIZACOES, TP_SITUACAO_RESULTANTE, VST_TIPO_VISTORIA(NM_TIPO_VISTORIA), VST_USUARIO(NM_USUARIO)';
const nomesUnidades = async () => new Map((await unidadesGestao().catch(() => [] as UnidadeCampo[])).map((u) => [u.id, u.nome]));
const paraVistoria = (v: any, nomes: Map<string, string>): VistoriaG => ({
  id: v.ID_VISTORIA, unidadeId: String(v.ID_UNIDADE), unidade: nomes.get(String(v.ID_UNIDADE)) ?? `Unidade ${v.ID_UNIDADE}`,
  tipo: v.VST_TIPO_VISTORIA?.NM_TIPO_VISTORIA ?? '', status: minusculo<StatusV>(v.TP_STATUS)!, agendada: v.DT_AGENDADA,
  inicio: v.DT_INICIO ?? undefined, fim: v.DT_FIM ?? undefined, responsavel: v.VST_USUARIO?.NM_USUARIO ?? undefined,
  sinalizacoes: (v.DS_SINALIZACOES ?? []).map(rotuloSinal), situacao: minusculo<EstadoUnidade>(v.TP_SITUACAO_RESULTANTE),
});
function demoVistorias(): VistoriaG[] {
  return enviosDemo().map((e) => ({ id: e.id, unidadeId: e.unidadeId, unidade: e.unidade, tipo: e.tipo, status: e.status === 'pendente' ? 'em_andamento' : 'concluida',
    agendada: e.inicio.slice(0, 10), inicio: e.inicio, fim: e.fim, sinalizacoes: e.sinalizacoes, situacao: e.novoEstado }));
}

export type FiltroV = { status?: StatusV | 'sinalizada' | ''; unidadeId?: string; de?: string; ate?: string };
/** Lista paginada no servidor; período pela data agendada (de/até inclusive). */
export async function listarVistorias(f: FiltroV, pagina = 0, por = 20): Promise<{ lista: VistoriaG[]; total: number }> {
  if (!REAL) {
    const l = demoVistorias().filter((v) => (!f.status || (f.status === 'sinalizada' ? v.sinalizacoes.length > 0 : v.status === f.status)) && (!f.unidadeId || v.unidadeId === f.unidadeId));
    return { lista: l.slice(pagina * por, pagina * por + por), total: l.length };
  }
  let q = db().from('VST_VISTORIA').select(SEL, { count: 'exact' });
  if (f.status === 'sinalizada') q = q.eq('TP_STATUS', 'CONCLUIDA').not('DS_SINALIZACOES', 'is', null);
  else if (f.status) q = q.eq('TP_STATUS', f.status.toUpperCase());
  if (f.unidadeId) q = q.eq('ID_UNIDADE', Number(f.unidadeId));
  if (f.de) q = q.gte('DT_AGENDADA', f.de);
  if (f.ate) q = q.lte('DT_AGENDADA', f.ate);
  const [r, nomes] = await Promise.all([
    q.order('DT_AGENDADA', { ascending: false }).order('DT_FIM', { ascending: false, nullsFirst: false }).range(pagina * por, pagina * por + por - 1),
    nomesUnidades(),
  ]);
  if (r.error) throw r.error;
  return { lista: (r.data ?? []).map((v) => paraVistoria(v, nomes)), total: r.count ?? 0 };
}

/** T20: vistorias com data de hoje (agendadas, em andamento e concluídas) nas unidades visíveis. */
export async function vistoriasDeHoje(): Promise<VistoriaG[]> {
  if (!REAL) return demoVistorias().filter((v) => v.agendada === new Date().toISOString().slice(0, 10));
  return (await listarVistorias({ de: hoje(), ate: hoje() }, 0, 200)).lista;
}

async function urlsAssinadas(caminhos: string[]): Promise<Map<string, string>> {
  if (!caminhos.length) return new Map();
  const s = await db().storage.from('vistorias').createSignedUrls(caminhos, 900);
  return new Map((s.data ?? []).filter((x) => x.signedUrl).map((x) => [x.path ?? '', x.signedUrl]));
}

/** T24/T27: registro completo da vistoria (respostas, fotos, ocorrências e assinatura). undefined = inexistente ou sem acesso. */
export async function detalheVistoria(id: string): Promise<DetalheV | undefined> {
  if (!REAL) {
    const v = demoVistorias().find((x) => x.id === id);
    return v && { ...v, respostas: [], ocorrencias: (await listarOcorrencias({ unidadeId: v.unidadeId })) };
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  const [v, resp, fotos, nomes] = await Promise.all([
    db().from('VST_VISTORIA').select(SEL + ', DS_ASSINATURA, DS_OBSERVACAO, TP_VALIDACAO, QTDE_DISTANCIA_METROS, QTDE_PRECISAO_METROS, DT_RECEBIMENTO').eq('ID_VISTORIA', id).maybeSingle(),
    db().from('VST_RESPOSTA').select('ID_ITEM, TP_RESPOSTA, DS_OBSERVACAO, QTDE_ENCONTRADA, VST_ITEM(NM_ITEM, NO_ORDEM, VST_AMBIENTE(NM_AMBIENTE, NO_ORDEM))').eq('ID_VISTORIA', id),
    db().from('VST_FOTO').select('ID_ITEM, CD_ARQUIVO, DT_CAPTURA').eq('ID_VISTORIA', id).order('DT_CAPTURA'),
    nomesUnidades(),
  ]);
  if (v.error || resp.error || fotos.error) throw v.error ?? resp.error ?? fotos.error;
  if (!v.data) return undefined;
  const d: any = v.data;
  const urls = await urlsAssinadas([...(fotos.data ?? []).map((f) => f.CD_ARQUIVO), ...(d.DS_ASSINATURA ? [d.DS_ASSINATURA] : [])]);
  const respostas: Resposta[] = (resp.data ?? []).map((r: any) => ({
    ambiente: r.VST_ITEM?.VST_AMBIENTE?.NM_AMBIENTE ?? '', item: r.VST_ITEM?.NM_ITEM ?? '', resposta: r.TP_RESPOSTA,
    observacao: r.DS_OBSERVACAO ?? undefined, qtde: r.QTDE_ENCONTRADA ?? undefined,
    fotos: (fotos.data ?? []).filter((f) => f.ID_ITEM === r.ID_ITEM).map((f) => urls.get(f.CD_ARQUIVO)).filter(Boolean) as string[],
    _o: [r.VST_ITEM?.VST_AMBIENTE?.NO_ORDEM ?? 0, r.VST_ITEM?.NO_ORDEM ?? 0],
  })).sort((a: any, b: any) => a._o[0] - b._o[0] || a.ambiente.localeCompare(b.ambiente) || a._o[1] - b._o[1]).map(({ _o, ...r }: any) => r);
  return {
    ...paraVistoria(d, nomes), respostas, ocorrencias: await listarOcorrencias({ vistoriaId: id }),
    assinatura: d.DS_ASSINATURA ? urls.get(d.DS_ASSINATURA) : undefined, observacao: d.DS_OBSERVACAO ?? undefined, validacao: d.TP_VALIDACAO ?? undefined,
    distancia: d.QTDE_DISTANCIA_METROS ?? undefined, precisao: d.QTDE_PRECISAO_METROS ?? undefined, recebimento: d.DT_RECEBIMENTO ?? undefined,
  };
}

/** T23: CSV (separador ;) para abrir no Excel. */
export function csvVistorias(l: VistoriaG[]): string {
  const c = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  return '﻿' + ['Unidade;Tipo;Agendada;Início;Conclusão;Status;Responsável;Sinalizações;Situação resultante',
    ...l.map((v) => [v.unidade, v.tipo, v.agendada, v.inicio ?? '', v.fim ?? '', v.status, v.responsavel ?? '', v.sinalizacoes.join(' | '), v.situacao ?? ''].map(c).join(';'))].join('\n');
}

// ── auditoria (T34, só ADMIN): VST_AUDITORIA pela função vst_auditoria
export const TABELAS_AUDITADAS: Record<string, string> = {
  VST_VISTORIA: 'Vistoria', VST_RESPOSTA: 'Resposta do checklist', VST_OCORRENCIA: 'Ocorrência', VST_FOTO: 'Foto',
  VST_UNIDADE: 'Unidade (situação, GPS, QR)', VST_USUARIO: 'Usuário', VST_USUARIO_PROPRIEDADE: 'Acesso a pousada',
  VST_PROPRIEDADE: 'Configuração da pousada', VST_AMBIENTE: 'Ambiente', VST_ITEM: 'Item do checklist',
  VST_TIPO_VISTORIA: 'Tipo de vistoria', VST_TIPO_VISTORIA_ITEM: 'Item do tipo de vistoria',
};
export type EventoAud = {
  id: string; em: string; usuario: string; perfil?: string; tabela: string; acao: 'criou' | 'alterou' | 'removeu';
  registro?: string; unidade?: string; detalhe: string; campos: [string, string][]; link?: string;
};
const valorAud = (v: unknown) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 120);
const ACAO = { INSERT: 'criou', UPDATE: 'alterou', DELETE: 'removeu' } as const;
function linkAud(t: string, reg?: string): string | undefined {
  if (!reg) return undefined;
  if (t === 'VST_VISTORIA') return `/gestao/vistorias/${reg}`;
  if (t === 'VST_RESPOSTA') return `/gestao/vistorias/${reg.split('/')[0]}`;
  if (t === 'VST_OCORRENCIA') return `/gestao/ocorrencias/${reg}`;
  if (t === 'VST_UNIDADE') return `/gestao/unidades/${reg}`;
  if (t === 'VST_USUARIO' || t === 'VST_USUARIO_PROPRIEDADE') return '/admin/usuarios';
  return undefined;
}

export async function listarAuditoria(f: { de: string; ate: string; tabela?: string; usuario?: string }, pagina = 0, por = 50): Promise<{ lista: EventoAud[]; total: number }> {
  if (!REAL) {
    const l = mg.listarAuditoria().map((e, i): EventoAud => ({ id: String(i), em: e.em, usuario: e.usuario, tabela: e.acao, acao: 'alterou', detalhe: e.detalhe, campos: [] }));
    return { lista: l, total: l.length };
  }
  const { data, error } = await db().rpc('vst_auditoria', {
    p_dt_ini: f.de, p_dt_fim: f.ate, p_nm_tabela: f.tabela || null, p_id_usuario: f.usuario || null, p_limite: por, p_deslocamento: pagina * por,
  });
  if (error) throw error;
  const lista = (data ?? []).map((a: any): EventoAud => {
    const alt = (a.ds_alteracoes ?? {}) as Record<string, unknown>;
    const campos: [string, string][] = a.tp_operacao === 'UPDATE'
      ? Object.entries(alt).map(([k, v]) => [k, Array.isArray(v) ? `${valorAud(v[0])} → ${valorAud(v[1])}` : valorAud(v)])
      : Object.entries(alt).filter(([, v]) => v !== null).map(([k, v]) => [k, valorAud(v)]);
    const chave = a.tp_operacao === 'UPDATE' ? campos : campos.filter(([k]) => /^(TP_|NM_|DS_OCORRENCIA|DT_AGENDADA|SG_ATIVO|CD_LOGIN)/.test(k));
    return {
      id: String(a.id_auditoria), em: a.dt_criacao, perfil: a.tp_perfil ?? undefined,
      usuario: a.nm_usuario ?? (a.nm_papel === 'service_role' ? 'Site / sistema' : a.nm_papel === 'postgres' ? 'SQL Editor' : 'Sistema'),
      tabela: TABELAS_AUDITADAS[a.nm_tabela] ?? a.nm_tabela, acao: ACAO[a.tp_operacao as keyof typeof ACAO], registro: a.cd_registro ?? undefined,
      unidade: a.nm_unidade ?? undefined, detalhe: chave.slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · '), campos, link: linkAud(a.nm_tabela, a.cd_registro ?? undefined),
    };
  });
  return { lista, total: Number((data ?? [])[0]?.qtde_total ?? 0) };
}
