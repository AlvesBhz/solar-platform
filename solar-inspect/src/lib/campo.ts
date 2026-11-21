// Dados das telas de campo (T05–T14): unidades, tipos, checklist, presença e início da vistoria.
// Real: Supabase (funções vst_* e tabelas VST_ com RLS), com cópia no aparelho para abrir sem internet.
// Demonstração (MODO_DEMO): os dados de exemplo de src/mocks.
import { MODO_DEMO, supabase } from './supabase';
import * as mc from '../mocks/checklist';
import * as ms from '../mocks/servidor';
import * as mu from '../mocks/unidades';
import type { Ambiente, Item } from '../mocks/checklist';
import type { ResultadoValidacao } from '../mocks/servidor';
import type { EstadoUnidade, Gravidade, ModoValidacao, Ocorrencia, TipoVistoria, Unidade } from '../mocks/unidades';
import type { Rascunho } from '../mocks/vistoria';

export type { Ambiente, Item, ResultadoValidacao, TipoVistoria, Unidade, Gravidade };
export const REAL = !MODO_DEMO && !!supabase;
const db = () => supabase!;

// ── cópia local (só leitura de apoio; o servidor é a fonte da verdade)
const CACHE = 'inspect.campo.';
export function lerCache<T>(k: string): T | null { try { return JSON.parse(localStorage.getItem(CACHE + k) ?? 'null'); } catch { return null; } }
function gravarCache(k: string, v: unknown) { try { localStorage.setItem(CACHE + k, JSON.stringify(v)); } catch { /* sem espaço */ } }
export function limparCacheCampo() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(CACHE)).forEach((k) => localStorage.removeItem(k)); } catch { /* ok */ }
}

export const ehRede = (e: unknown) => {
  const m = String((e as { message?: string })?.message ?? e) + String((e as { name?: string })?.name ?? '');
  return !navigator.onLine || /fetch|network|Load failed|Failed to fetch|Retryable/i.test(m);
};

/** Mensagens das recusas do banco (raise exception '<codigo>'). */
const ERROS: Record<string, string> = {
  sem_acesso: 'Você não tem acesso a esta unidade.',
  qr_obrigatorio: 'Esta unidade exige a leitura do QR Code.',
  qr_invalido: 'QR Code inválido ou expirado para esta unidade. Leia o código fixado na porta.',
  vistoria_de_outro_usuario: 'Esta vistoria já está com outro vistoriador.',
  vistoria_nao_agendada: 'Esta vistoria não está mais disponível (iniciada por outra pessoa, concluída ou cancelada).',
  vistoria_inexistente: 'Vistoria não encontrada.',
  vistoria_nao_iniciada: 'A vistoria não foi iniciada no servidor.',
  perfil_sem_permissao: 'Seu perfil não faz este tipo de vistoria.',
  tipo_inexistente: 'Este tipo de vistoria foi desativado.',
  data_futura: 'O relógio do aparelho está adiantado. Ajuste a hora e tente de novo.',
  data_invalida: 'Horário de término anterior ao início.',
  itens_pendentes: 'O checklist mudou: há itens novos sem resposta.',
  item_fora_do_checklist: 'O checklist mudou: um item respondido não existe mais.',
  item_duplicado: 'Item respondido duas vezes.',
  observacao_obrigatoria: 'Descreva cada problema encontrado.',
  foto_obrigatoria: 'Falta foto em item que exige foto.',
  foto_de_item_nao_respondido: 'Há foto de item sem resposta.',
  assinatura_obrigatoria: 'Este tipo de vistoria exige assinatura.',
  respostas_obrigatorias: 'Nenhum item respondido.',
  gravidade_invalida: 'Gravidade inválida.',
  usuario_inativo_ou_inexistente: 'Seu acesso foi desativado.',
};
export function mensagemErro(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e);
  const k = Object.keys(ERROS).find((c) => m.includes(c));
  return k ? ERROS[k] : 'Não foi possível concluir agora. Tente de novo.';
}
export const codigoErro = (e: unknown) => Object.keys(ERROS).find((c) => String((e as { message?: string })?.message ?? e).includes(c)) ?? null;

/** Rótulos das sinalizações gravadas pelo banco (DS_SINALIZACOES). */
const SINAIS: Record<string, string> = {
  FORA_RAIO: 'Fora do raio da unidade', GPS_IMPRECISO: 'GPS impreciso', SEM_GPS: 'Sem localização',
  GPS_NAO_CONFIGURADO: 'Ponto GPS não cadastrado', RAPIDA: 'Duração abaixo do mínimo', SEM_ENTRADA: 'Sem vistoria de entrada vinculada',
};
export const rotuloSinal = (c: string) => SINAIS[c] ?? c;

// ── unidades (T05/T06)
type ConfigGps = { lat: number | null; lng: number | null; raio: number; precisaoMax: number };
export type UnidadeCampo = Unidade & { gps?: ConfigGps };

const SITUACAO = (s?: string | null) => (s ?? 'LIBERADO').toLowerCase() as EstadoUnidade;
const VALIDACAO: Record<string, ModoValidacao> = { GPS: 'gps', QR: 'qr', QR_E_GPS: 'gps_qr' };
const TIPO_UNIDADE: Record<string, string> = { CHALE: 'Chalé', SUITE: 'Suíte', QUARTO: 'Quarto' };
const GRAV = (g: string) => g.toLowerCase() as Gravidade;
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function listarUnidades(): Promise<UnidadeCampo[]> {
  if (!REAL) return mu.listarUnidades();
  try {
    const [us, oc, ult, amb] = await Promise.all([
      db().rpc('vst_unidades'),
      db().from('VST_OCORRENCIA').select('ID_OCORRENCIA, ID_UNIDADE, ID_ITEM, TP_GRAVIDADE, DS_OCORRENCIA, DT_ABERTURA').in('TP_STATUS', ['ABERTA', 'EM_TRATAMENTO']),
      db().from('VST_VISTORIA').select('ID_UNIDADE, DT_FIM, DS_SINALIZACOES, VST_TIPO_VISTORIA(NM_TIPO_VISTORIA), VST_USUARIO(NM_USUARIO)')
        .eq('TP_STATUS', 'CONCLUIDA').order('DT_FIM', { ascending: false }).limit(300),
      db().from('VST_AMBIENTE').select('ID_UNIDADE').eq('SG_ATIVO', true),
    ]);
    const erro = us.error ?? oc.error ?? ult.error ?? amb.error;
    if (erro) throw erro;
    // nomes do item e do ambiente de cada ocorrência aberta
    const ids = [...new Set((oc.data ?? []).map((o) => o.ID_ITEM))];
    const itens = ids.length
      ? (await db().from('VST_ITEM').select('ID_ITEM, NM_ITEM, VST_AMBIENTE(NM_AMBIENTE)').in('ID_ITEM', ids)).data ?? []
      : [];
    const nomeAmb = new Map(itens.map((i: any) => [i.ID_ITEM, i.VST_AMBIENTE?.NM_AMBIENTE ?? '']));
    const lista: UnidadeCampo[] = (us.data ?? []).filter((u: any) => u.sg_ativo !== false).map((u: any) => {
      const ultima = (ult.data ?? []).find((v: any) => v.ID_UNIDADE === u.id_unidade) as any;
      return {
        id: String(u.id_unidade), nome: u.nm_unidade, tipo: TIPO_UNIDADE[u.tp_unidade] ?? (u.tp_unidade ? String(u.tp_unidade) : 'Unidade'),
        propriedade: u.nm_propriedade, andar: u.ds_andar ?? undefined, estado: SITUACAO(u.tp_situacao),
        validacao: VALIDACAO[u.tp_validacao] ?? 'gps', ambientes: (amb.data ?? []).filter((a) => a.ID_UNIDADE === u.id_unidade).length,
        ocorrencias: (oc.data ?? []).filter((o) => o.ID_UNIDADE === u.id_unidade).map((o): Ocorrencia => ({
          id: String(o.ID_OCORRENCIA), descricao: o.DS_OCORRENCIA, gravidade: GRAV(o.TP_GRAVIDADE), prazo: o.DT_ABERTURA, ambiente: nomeAmb.get(o.ID_ITEM) ?? '',
        })),
        ultima: ultima ? { tipo: ultima.VST_TIPO_VISTORIA?.NM_TIPO_VISTORIA ?? '', data: ultima.DT_FIM, assessor: ultima.VST_USUARIO?.NM_USUARIO ?? 'Equipe', sinalizada: !!ultima.DS_SINALIZACOES?.length } : undefined,
        gps: { lat: num(u.vl_latitude), lng: num(u.vl_longitude), raio: u.qtde_raio_metros ?? 50, precisaoMax: u.qtde_precisao_max_metros ?? 50 },
      };
    });
    gravarCache('unidades', lista);
    return lista;
  } catch (e) {
    const c = lerCache<UnidadeCampo[]>('unidades');
    if (c && ehRede(e)) return c;
    throw e;
  }
}

/** undefined = não encontrada ou sem acesso (não diferencia, para não revelar dados). */
export async function obterUnidade(id: string): Promise<UnidadeCampo | undefined> {
  if (!REAL) return mu.obterUnidade(id);
  try { return (await listarUnidades()).find((u) => u.id === id); } catch { return lerCache<UnidadeCampo[]>('unidades')?.find((u) => u.id === id); }
}

// ── tipos (T07)
const RESPOSTAS: Record<string, string[]> = {
  ENTRADA: ['OK', 'Problema', 'N/A'], SAIDA: ['Igual', 'Danificado', 'Faltando', 'Com defeito', 'N/A'],
  ROTINA: ['OK', 'Problema', 'N/A'], MANUTENCAO: ['OK', 'Precisa intervenção', 'N/A'],
};
const DESCRICAO: Record<string, string> = {
  ENTRADA: 'Limpeza, enxoval e funcionamento antes da chegada do hóspede.',
  SAIDA: 'Compara o estado atual com a vistoria de entrada da estadia.',
  ROTINA: 'Verificação recorrente, sem depender de estadia.',
  MANUTENCAO: 'Equipamentos e instalações: o que precisa de intervenção.',
};
const dia = (d: string) => d.split('-').reverse().slice(0, 2).join('/');

export async function listarTipos(unidadeId: string): Promise<TipoVistoria[]> {
  if (!REAL) return mu.listarTiposAtivos();
  try {
    const { data, error } = await db().rpc('vst_tipos_unidade', { p_id_unidade: Number(unidadeId) });
    if (error) throw error;
    const tipos = (data ?? []).map((t: any): TipoVistoria => {
      const agenda = t.id_vistoria
        ? (t.tp_status === 'EM_ANDAMENTO' ? ' Em andamento com você: continue de onde parou.' : ` Agendada para ${dia(t.dt_agendada)}${t.cd_reserva ? ` · reserva ${t.cd_reserva}` : ''}.`)
        : '';
      return {
        id: String(t.cd_tipo_vistoria).toLowerCase(), nome: t.nm_tipo_vistoria, descricao: (DESCRICAO[t.tp_comportamento] ?? '') + agenda,
        respostas: RESPOSTAS[t.tp_comportamento] ?? RESPOSTAS.ROTINA, itens: t.qtde_itens, ativo: true, exigeEntrada: t.sg_exige_entrada,
        idTipo: t.id_tipo_vistoria, cd: t.cd_tipo_vistoria, comportamento: t.tp_comportamento, exigeAssinatura: t.sg_exige_assinatura,
        idVistoria: t.id_vistoria ?? undefined, statusVistoria: t.tp_status ?? undefined, dtAgendada: t.dt_agendada ?? undefined,
      };
    });
    gravarCache('tipos.' + unidadeId, tipos);
    // deixa os checklists no aparelho: a vistoria pode começar sem internet
    for (const t of tipos) if (t.itens > 0) carregarChecklist({ id: unidadeId } as Unidade, { idTipo: t.idTipo } as Rascunho).catch(() => undefined);
    return tipos;
  } catch (e) {
    const c = lerCache<TipoVistoria[]>('tipos.' + unidadeId);
    if (c && ehRede(e)) return c;
    throw e;
  }
}

/** Por que um tipo não pode ser escolhido (null = pode). */
export function motivoIndisponivel(t: TipoVistoria, u?: Unidade | null): string | null {
  if (!REAL) return t.exigeEntrada && !u?.entradaVinculadaId ? 'Requer uma vistoria de entrada vinculada (estadia em curso).' : null;
  return t.itens === 0 ? 'Sem itens no checklist desta unidade. Peça ao gestor para cadastrar.' : null;
}

/** Tipo do rascunho em andamento (respostas e regras), mesmo sem internet. */
export async function tipoDoRascunho(r: Rascunho | null): Promise<TipoVistoria | null> {
  if (!r) return null;
  if (!REAL) return (await mu.listarTiposAtivos()).find((t) => t.id === r.tipoId) ?? null;
  const comp = r.comportamento ?? 'ROTINA';
  return { id: r.tipoId, nome: r.nomeTipo ?? r.tipoId, descricao: '', respostas: RESPOSTAS[comp] ?? RESPOSTAS.ROTINA, itens: 0, ativo: true,
    idTipo: r.idTipo, cd: r.cdTipo, comportamento: comp, exigeAssinatura: r.exigeAssinatura };
}

/** Data de hoje no fuso da pousada (Brasília), YYYY-MM-DD. */
export const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

// ── checklist (T10/T11)
const ICONE = (nome: string) => {
  const n = nome.toLowerCase();
  if (/quarto|cama/.test(n)) return 'solar:bed-linear';
  if (/banh|lavabo/.test(n)) return 'solar:bath-linear';
  if (/sala|estar/.test(n)) return 'solar:sofa-linear';
  if (/copa|cozinha/.test(n)) return 'solar:cup-hot-linear';
  return 'solar:home-2-linear';
};

export async function carregarChecklist(u: Unidade, r: Rascunho | null): Promise<Ambiente[]> {
  if (!REAL) return mc.checklistDa(u);
  if (!r?.idTipo) return [];
  const chave = `checklist.${u.id}.${r.idTipo}`;
  try {
    const { data, error } = await db().rpc('vst_checklist', { p_id_unidade: Number(u.id), p_id_tipo_vistoria: r.idTipo });
    if (error) throw error;
    const ambs: Ambiente[] = [];
    for (const l of (data ?? []) as any[]) {
      let a = ambs.find((x) => x.id === String(l.id_ambiente));
      if (!a) ambs.push((a = { id: String(l.id_ambiente), nome: l.nm_ambiente, icon: ICONE(l.nm_ambiente), ref: /^https:\/\//.test(l.ds_foto_referencia ?? '') ? l.ds_foto_referencia : undefined, itens: [] }));
      a.itens.push({ id: String(l.id_item), nome: l.nm_item, critico: l.sg_critico, foto: l.sg_foto_obrigatoria, orientacao: l.ds_orientacao ?? undefined, qtde: l.qtde_esperada ?? undefined });
    }
    gravarCache(chave, ambs);
    return ambs;
  } catch (e) {
    const c = lerCache<Ambiente[]>(chave);
    if (c && ehRede(e)) return c;
    throw e;
  }
}

export function itemDe(ambs: Ambiente[], itemId: string): { item: Item; ambiente: Ambiente } | undefined {
  for (const ambiente of ambs) {
    const item = ambiente.itens.find((i) => i.id === itemId);
    if (item) return { item, ambiente };
  }
}

/** T13: fotos do mesmo item na Entrada vinculada (só online; links assinados por 10 min). */
export async function fotosDaEntrada(vistoriaId: string, itemId: string): Promise<string[]> {
  if (!REAL || !navigator.onLine) return [];
  try {
    const v = await db().from('VST_VISTORIA').select('ID_VISTORIA_ENTRADA').eq('ID_VISTORIA', vistoriaId).maybeSingle();
    const entrada = v.data?.ID_VISTORIA_ENTRADA;
    if (!entrada) return [];
    const f = await db().from('VST_FOTO').select('CD_ARQUIVO').eq('ID_VISTORIA', entrada).eq('ID_ITEM', Number(itemId)).order('DT_CAPTURA');
    const caminhos = (f.data ?? []).map((x) => x.CD_ARQUIVO);
    if (!caminhos.length) return [];
    const s = await db().storage.from('vistorias').createSignedUrls(caminhos, 600);
    return (s.data ?? []).map((x) => x.signedUrl).filter(Boolean) as string[];
  } catch { return []; }
}

// ── presença (T08/T09/T12): prévia no aparelho; o servidor confere de novo ao iniciar (vst_iniciar_vistoria)
export async function validarGps(unidadeId: string, pos: GeolocationCoordinates): Promise<ResultadoValidacao> {
  if (!REAL) return ms.validarGps(unidadeId, pos);
  const u = await obterUnidade(unidadeId);
  const g = u?.gps;
  const em = new Date().toISOString();
  const base = { em, lat: pos.latitude, lng: pos.longitude, precisaoM: Math.round(pos.accuracy) };
  if (!g || g.lat === null || g.lng === null) return { ...base, ok: true, motivo: 'Ponto GPS da unidade não cadastrado: a vistoria será sinalizada.' };
  const distanciaM = Math.round(ms.haversine(pos.latitude, pos.longitude, g.lat, g.lng));
  let motivo: string | undefined;
  if (base.precisaoM > g.precisaoMax) motivo = `Precisão de ${base.precisaoM} m (limite ${g.precisaoMax} m). Vá para um local aberto e tente de novo.`;
  else if (distanciaM > g.raio) motivo = `Você está a ${distanciaM} m da unidade (raio permitido ${g.raio} m).`;
  return { ...base, ok: !motivo, motivo, distanciaM, raioM: g.raio };
}

export const precisaoMaxima = (u?: UnidadeCampo | null) => u?.gps?.precisaoMax ?? 50;

export async function validarQr(unidadeId: string, conteudo: string): Promise<ResultadoValidacao> {
  if (!REAL) return ms.validarQr(unidadeId, conteudo);
  const codigo = conteudo.trim();
  const em = new Date().toISOString();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(codigo)) return { ok: false, em, motivo: 'Código inválido. Use o QR Code fixado na unidade.' };
  if (!navigator.onLine) return { ok: true, em, codigo, pendente: true, motivo: 'Sem internet: o código será conferido no envio.' };
  const { data, error } = await db().rpc('vst_resolver_qr', { p_cd_hash_qr: codigo });
  if (error) return ehRede(error) ? { ok: true, em, codigo, pendente: true, motivo: 'Sem internet: o código será conferido no envio.' } : { ok: false, em, motivo: mensagemErro(error) };
  const achou = (data ?? [])[0] as any;
  if (!achou) return { ok: false, em, motivo: 'QR Code inválido ou expirado. Peça ao gestor a etiqueta atualizada.' };
  if (String(achou.id_unidade) !== unidadeId) return { ok: false, em, motivo: 'Este QR Code pertence a outra unidade.' };
  return { ok: true, em, codigo };
}

/** Cria (avulsa) e inicia a vistoria no servidor. Sem internet, segue no aparelho e o envio faz isso depois. */
export async function iniciarNoServidor(r: Rascunho): Promise<{ ok: true; adiado?: boolean } | { ok: false; erro: string; codigo: string | null }> {
  if (!REAL || r.iniciada) return { ok: true };
  if (!navigator.onLine) return { ok: true, adiado: true };
  try {
    if (r.avulsa) {
      const c = await db().rpc('vst_criar_vistoria', { p_id_unidade: Number(r.unidadeId), p_cd_tipo_vistoria: r.cdTipo, p_dt_agendada: r.dtAgendada ?? hoje(), p_id_vistoria: r.id });
      if (c.error) throw c.error;
    }
    const g = r.presenca.gps;
    const i = await db().rpc('vst_iniciar_vistoria', {
      p_id_vistoria: r.id, p_cd_hash_qr: r.presenca.qr?.codigo ?? null,
      p_vl_latitude: g?.lat ?? null, p_vl_longitude: g?.lng ?? null, p_qtde_precisao_metros: g?.precisaoM ?? null, p_dt_inicio: r.inicio ?? null,
    });
    if (i.error) throw i.error;
    return { ok: true };
  } catch (e) {
    if (ehRede(e)) return { ok: true, adiado: true };
    return { ok: false, erro: mensagemErro(e), codigo: codigoErro(e) };
  }
}
