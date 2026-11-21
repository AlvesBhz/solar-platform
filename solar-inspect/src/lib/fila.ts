// Fila de envio (T17/T18) e histórico (T19). A vistoria confirmada vira um envio guardado no aparelho;
// sincronizar = criar (avulsa) → iniciar → enviar fotos e assinatura ao Storage → vst_concluir_vistoria.
// Cada passo é idempotente pelo UUID da vistoria e pelo caminho do arquivo: reenviar nunca duplica.
import { MODO_DEMO, supabase } from './supabase';
import * as me from '../mocks/envios';
import { listarFotosDaVistoria, removerFotosDaVistoria } from '../mocks/fotos';
import type { Envio } from '../mocks/envios';
import type { EstadoUnidade } from '../mocks/unidades';
import type { Rascunho } from '../mocks/vistoria';
import type { Ambiente } from '../mocks/checklist';
import { RESPOSTAS_OK } from '../mocks/checklist';
import { codigoErro, ehRede, lerCache, mensagemErro, rotuloSinal, type UnidadeCampo } from './campo';

export type { Envio };
const REAL = !MODO_DEMO && !!supabase;
const db = () => supabase!;
const KEY = 'inspect.envios';

type Dados = {
  unidadeId: number; cdTipo?: string; avulsa?: boolean; dtAgendada?: string; iniciada?: boolean;
  qr?: string | null; lat?: number | null; lng?: number | null; precisao?: number | null;
  respostas: Record<string, unknown>[]; assinatura?: string | null; observacao?: string | null;
};
export type EnvioReal = Envio & { uid?: string; dados?: Dados };

function lerFila(): EnvioReal[] { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } }
function gravarFila(l: EnvioReal[]) { try { localStorage.setItem(KEY, JSON.stringify(l.slice(0, 200))); } catch { /* sem espaço */ } }

export function listarEnvios(): Envio[] {
  return REAL ? lerFila() : me.listarEnvios();
}
export const temPendentes = () => listarEnvios().some((e) => e.status === 'pendente');

/** Resposta da tela → linha de VST_RESPOSTA. PROBLEMA sempre leva descrição (o banco exige). */
function respostaDoItem(rot: string, obs: string | undefined, oc: { gravidade: string; descricao: string } | undefined, critico?: boolean) {
  const texto = (oc?.descricao || obs || '').trim();
  if (rot === 'N/A') return { tp_resposta: 'NAO_SE_APLICA', ds_observacao: texto || null };
  if (RESPOSTAS_OK.includes(rot)) return { tp_resposta: 'OK', ds_observacao: texto || null };
  const desc = texto ? (['Problema'].includes(rot) ? texto : `${rot}: ${texto}`) : rot;
  return { tp_resposta: 'PROBLEMA', ds_observacao: desc.slice(0, 2000), tp_gravidade: critico ? 'CRITICA' : (oc?.gravidade ?? 'media').toUpperCase() };
}

/** T17: grava o envio na fila (idempotente pelo UUID) e já tenta enviar se houver internet. */
export async function registrarEnvio(r: Rascunho, ambs: Ambiente[], resumo: { unidade: string; tipo: string; ocorrencias: number; sinalizacoes: string[]; novoEstado?: EstadoUnidade }, uid?: string): Promise<Envio> {
  const fim = new Date().toISOString();
  const base: Envio = {
    id: r.id, unidadeId: r.unidadeId, unidade: resumo.unidade, tipo: resumo.tipo, inicio: r.inicio!, fim, status: 'pendente',
    sinalizacoes: resumo.sinalizacoes, ocorrencias: resumo.ocorrencias, novoEstado: resumo.novoEstado, tentativas: 0,
  };
  if (!REAL) {
    const e: Envio = { ...base, status: !navigator.onLine ? 'pendente' : resumo.sinalizacoes.length ? 'sinalizada' : 'enviada', tentativas: navigator.onLine ? 1 : 0, ultimoErro: navigator.onLine ? undefined : 'Sem conexão' };
    me.registrarEnvio(e);
    return e;
  }
  const respostas = ambs.flatMap((a) => a.itens).filter((i) => r.respostas[i.id]).map((i) => ({
    id_item: Number(i.id), ...respostaDoItem(r.respostas[i.id], r.obs?.[i.id], r.ocorrencias?.[i.id], i.critico),
  }));
  const g = r.presenca.gps;
  const e: EnvioReal = {
    ...base, novoEstado: undefined, uid,
    dados: {
      unidadeId: Number(r.unidadeId), cdTipo: r.cdTipo, avulsa: r.avulsa, dtAgendada: r.dtAgendada, iniciada: r.iniciada,
      qr: r.presenca.qr?.codigo ?? null, lat: g?.lat ?? null, lng: g?.lng ?? null, precisao: g?.precisaoM ?? null,
      respostas, assinatura: r.assinatura ?? null,
    },
  };
  gravarFila([e, ...lerFila().filter((x) => x.id !== e.id)]);
  if (navigator.onLine) return (await sincronizar([e.id])).find((x) => x.id === e.id) ?? e;
  return { ...e, ultimoErro: 'Sem conexão' };
}

const dataUrlParaBlob = async (u: string) => (await fetch(u)).blob();

async function enviarArquivo(caminho: string, blob: Blob, tipo: string) {
  const { error } = await db().storage.from('vistorias').upload(caminho, blob, { contentType: tipo, upsert: false });
  if (error && !/exists|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) throw error;
}

async function enviarUm(e: EnvioReal): Promise<EnvioReal> {
  const d = e.dados!;
  // 1) cria (avulsa) e inicia, com a hora real do início (pode ter sido offline)
  if (!d.iniciada) {
    if (d.avulsa) {
      const c = await db().rpc('vst_criar_vistoria', { p_id_unidade: d.unidadeId, p_cd_tipo_vistoria: d.cdTipo, p_dt_agendada: d.dtAgendada, p_id_vistoria: e.id });
      if (c.error) throw c.error;
    }
    const i = await db().rpc('vst_iniciar_vistoria', { p_id_vistoria: e.id, p_cd_hash_qr: d.qr, p_vl_latitude: d.lat, p_vl_longitude: d.lng, p_qtde_precisao_metros: d.precisao, p_dt_inicio: e.inicio });
    if (i.error) throw i.error;
    d.iniciada = true;
  }
  // 2) fotos e assinatura no Storage: vistorias/<ID_VISTORIA>/<arquivo>
  const fotos = await listarFotosDaVistoria(e.id);
  const pFotos = [];
  for (const f of fotos) {
    const caminho = `${e.id}/${f.id}.jpg`;
    await enviarArquivo(caminho, f.blob, 'image/jpeg');
    pFotos.push({ id_foto: f.id, id_item: Number(f.itemId), cd_arquivo: caminho, vl_latitude: f.lat ?? null, vl_longitude: f.lng ?? null, qtde_precisao_metros: f.precisaoM ?? null, dt_captura: f.em });
  }
  let assinatura: string | null = null;
  if (d.assinatura?.startsWith('data:image/png')) {
    assinatura = `${e.id}/assinatura.png`;
    await enviarArquivo(assinatura, await dataUrlParaBlob(d.assinatura), 'image/png');
  }
  // 3) conclui numa transação (respostas, fotos, ocorrências, bloqueio e situação do chalé)
  const respondidos = new Set(d.respostas.map((x) => x.id_item));
  const c = await db().rpc('vst_concluir_vistoria', {
    p_id_vistoria: e.id, p_respostas: d.respostas, p_fotos: pFotos.filter((f) => respondidos.has(f.id_item)),
    p_ds_assinatura: assinatura, p_ds_observacao: d.observacao ?? null, p_dt_fim: e.fim,
  });
  if (c.error) throw c.error;
  const res = (c.data ?? [])[0] ?? {};
  const v = await db().from('VST_VISTORIA').select('TP_SITUACAO_RESULTANTE').eq('ID_VISTORIA', e.id).maybeSingle();
  await removerFotosDaVistoria(e.id);
  const sinais: string[] = (res.ds_sinalizacoes ?? []).map(rotuloSinal);
  return {
    ...e, dados: undefined, status: sinais.length ? 'sinalizada' : 'enviada', sinalizacoes: sinais, ocorrencias: res.qtde_ocorrencias ?? e.ocorrencias,
    novoEstado: v.data?.TP_SITUACAO_RESULTANTE ? (String(v.data.TP_SITUACAO_RESULTANTE).toLowerCase() as EstadoUnidade) : undefined,
    tentativas: e.tentativas + 1, ultimoErro: undefined,
  };
}

let rodando: Promise<Envio[]> | null = null;
/** T18: envia os pendentes do usuário logado, um por vez. Falha de rede mantém na fila; recusa do banco mostra o motivo. */
export function sincronizar(ids?: string[]): Promise<Envio[]> {
  if (!REAL) return me.sincronizar();
  if (rodando) return rodando;
  rodando = (async () => {
    const { data } = await db().auth.getSession();
    const uid = data.session?.user.id;
    for (const e of lerFila()) {
      if (e.status !== 'pendente' || !e.dados || (ids && !ids.includes(e.id)) || (e.uid && e.uid !== uid)) continue;
      let novo: EnvioReal;
      try {
        if (!uid) throw new Error('sessao');
        novo = await enviarUm({ ...e, dados: { ...e.dados } });
      } catch (err) {
        novo = { ...e, tentativas: e.tentativas + 1, ultimoErro: !uid ? 'Entre de novo para enviar' : ehRede(err) ? 'Sem conexão' : mensagemErro(err) };
        if (codigoErro(err) && e.dados && !e.dados.iniciada && ['vistoria_nao_agendada', 'vistoria_de_outro_usuario'].includes(codigoErro(err)!)) novo.ultimoErro += ' Fale com o gestor.';
      }
      gravarFila(lerFila().map((x) => (x.id === novo.id ? novo : x)));
    }
    return lerFila();
  })().finally(() => { rodando = null; });
  return rodando;
}

// envio automático quando a conexão volta
if (REAL && typeof window !== 'undefined') window.addEventListener('online', () => { if (temPendentes()) sincronizar(); });

/** T19: vistorias concluídas por mim (servidor) + as que ainda estão na fila deste aparelho. */
export async function historico(): Promise<Envio[]> {
  if (!REAL) return me.listarEnvios();
  const locais = lerFila();
  try {
    const { data: s } = await db().auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return locais;
    const { data, error } = await db().from('VST_VISTORIA')
      .select('ID_VISTORIA, ID_UNIDADE, DT_INICIO, DT_FIM, DS_SINALIZACOES, TP_SITUACAO_RESULTANTE, VST_TIPO_VISTORIA(NM_TIPO_VISTORIA)')
      .eq('ID_USUARIO', uid).eq('TP_STATUS', 'CONCLUIDA').order('DT_FIM', { ascending: false }).limit(100);
    if (error) throw error;
    const ids = (data ?? []).map((v) => v.ID_VISTORIA);
    const oc = ids.length ? (await db().from('VST_OCORRENCIA').select('ID_VISTORIA').in('ID_VISTORIA', ids)).data ?? [] : [];
    const nomes = new Map((lerCache<UnidadeCampo[]>('unidades') ?? []).map((u) => [u.id, u.nome]));
    const servidor: Envio[] = (data ?? []).map((v: any) => ({
      id: v.ID_VISTORIA, unidadeId: String(v.ID_UNIDADE), unidade: nomes.get(String(v.ID_UNIDADE)) ?? `Unidade ${v.ID_UNIDADE}`,
      tipo: v.VST_TIPO_VISTORIA?.NM_TIPO_VISTORIA ?? '', inicio: v.DT_INICIO, fim: v.DT_FIM, tentativas: 1,
      status: v.DS_SINALIZACOES?.length ? 'sinalizada' : 'enviada', sinalizacoes: (v.DS_SINALIZACOES ?? []).map(rotuloSinal),
      ocorrencias: oc.filter((o) => o.ID_VISTORIA === v.ID_VISTORIA).length,
      novoEstado: v.TP_SITUACAO_RESULTANTE ? String(v.TP_SITUACAO_RESULTANTE).toLowerCase() as EstadoUnidade : undefined,
    }));
    const vistos = new Set(servidor.map((x) => x.id));
    return [...locais.filter((l) => l.status === 'pendente' && !vistos.has(l.id)), ...servidor];
  } catch {
    return locais;
  }
}
