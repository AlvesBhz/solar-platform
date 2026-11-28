/* eslint-disable @typescript-eslint/no-explicit-any */
// Preços do site (T38–T41).
// Real: Supabase, só pelas funções prc_* (security definer; só o ADMIN passa lá dentro — site/database/migracao_precos_gestao.sql).
// Demonstração (link publicado, sem banco): dados de exemplo em memória; a conta é a de calcular_estadia() do site.
import { hoje } from './campo';
import { mensagem } from './admin';
import { MODO_DEMO, supabase } from './supabase';

export type Unidade = {
  id: number; codigo: string; nome: string; maxAdultos: number; maxCriancas: number; maxHospedes: number; maxNoites: number; taxaLimpeza: number; percentualSinal: number;
};
export type Tarifa = {
  id: number; nome: string; ini: string; fim: string; // fim = dia seguinte à última noite (igual ao banco)
  prioridade: number; valorNoite: number; valorFds: number | null; adultosInclusos: number; adultoExtra: number;
  pcCrianca: number; pcCriancaMaior: number; pcBebe: number; minNoites: number; ativo: boolean;
  diasFds: number[]; // dias da semana (ISO: 1 = segunda … 7 = domingo) que usam valorFds; os demais usam valorNoite
};
export type Ajuste = { data: string; valor: number | null; minNoites: number | null; fechado: boolean; semChegada: boolean; semSaida: boolean; obs: string };
export type Ocupacao = { ini: string; fim: string; tipo: 'reserva' | 'pre-reserva' | 'bloqueio'; rotulo: string }; // fim = dia seguinte à última noite
export type Resultado = { ok: true } | { ok: false; erro: string };
/** Pacote: preço final fechado para um check-in e um número de noites (ex.: Natal 24/12 + 3 noites = R$ 2.400). Nas noites de um pacote o site só vende os pacotes. */
export type Pacote = { id: number; nome: string; checkin: string; noites: number; total: number; ativo: boolean };

/** true = o app fala com o banco; false = demonstração em memória */
export const REAL = !MODO_DEMO && !!supabase;

// ── datas (texto AAAA-MM-DD, sem fuso)
export const noon = (iso: string) => new Date(iso + 'T12:00:00');
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const somar = (s: string, n: number) => { const d = noon(s); d.setDate(d.getDate() + n); return iso(d); };
export const noites = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / 86400000);
export const DIAS_PADRAO = [5, 6, 7];                                                 // sexta, sábado e domingo
export const diaIso = (s: string) => noon(s).getDay() || 7;                            // 1 = segunda … 7 = domingo
/** A noite usa o segundo valor da tarifa (valorFds)? Depende dos dias marcados na tarifa. */
export const usaValor2 = (t: Pick<Tarifa, 'diasFds'>, s: string) => t.diasFds.includes(diaIso(s));
/** Semana começando no domingo, como no calendário. */
export const SEMANA_ISO = [{ iso: 7, curto: 'D', nome: 'domingo' }, { iso: 1, curto: 'S', nome: 'segunda' }, { iso: 2, curto: 'T', nome: 'terça' },
  { iso: 3, curto: 'Q', nome: 'quarta' }, { iso: 4, curto: 'Q', nome: 'quinta' }, { iso: 5, curto: 'S', nome: 'sexta' }, { iso: 6, curto: 'S', nome: 'sábado' }];
const ABREV: Record<number, string> = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sáb', 7: 'dom' };
/** "sex a dom", "dom a qui", "qua" ou "seg, qua e sex" (sequência que vira a semana também conta). */
export function rotuloDias(dias: number[]): string {
  const d = [...new Set(dias)].sort((a, b) => a - b);
  if (!d.length) return 'nenhum dia';
  if (d.length === 7) return 'todos os dias';
  const tem = (x: number) => d.includes(((x - 1 + 7) % 7) + 1);
  const ini = d.find((x) => !tem(x - 1));                                             // começo de uma sequência
  if (ini !== undefined && d.length > 1) {
    let n = 0; while (tem(ini + n)) n++;
    if (n === d.length) return `${ABREV[ini]} a ${ABREV[((ini + n - 2) % 7) + 1]}`;
  }
  const ordem = SEMANA_ISO.map((x) => x.iso).filter((x) => d.includes(x)).map((x) => ABREV[x]);
  return ordem.length === 1 ? ordem[0] : `${ordem.slice(0, -1).join(', ')} e ${ordem[ordem.length - 1]}`;
}
export const diaSemana = (s: string) => noon(s).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
export const dataCurta = (s: string) => noon(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
export const dataLonga = (s: string) => noon(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const mesAno = (s: string) => noon(s).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
export const primeiroDoMes = (s: string) => `${s.slice(0, 8)}01`;
export const ultimoDoMes = (s: string) => { const d = noon(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)); };

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: v % 1 ? 2 : 0 });
/** Como no calendário do site: 1.700 → 1,7k */
export const brlCurto = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : String(v));

// ── memória: na demonstração é a "base"; no real guarda o que a tela carregou (tarifas, ajustes e ocupação do mês aberto)
const DEMO_UNIDADE: Unidade = { id: 1, codigo: 'casa-do-mirante', nome: 'Casa do Mirante', maxAdultos: 2, maxCriancas: 2, maxHospedes: 4, maxNoites: 7, taxaLimpeza: 0, percentualSinal: 50 };
const dados: { tarifas: Tarifa[]; tarifasDe: number | null; tarifasEm: number; ajustes: Map<string, Ajuste>; ocupacoes: Ocupacao[]; pacotes: Pacote[]; seq: number } = (() => {
  if (REAL) return { tarifas: [], tarifasDe: null, tarifasEm: 0, ajustes: new Map(), ocupacoes: [], pacotes: [], seq: 0 };
  const h = hoje();
  const aj = new Map<string, Ajuste>();
  const feriados: [string, string, number, string][] = [
    ['2026-12-24', '2026-12-27', 3, 'Natal 2026'], ['2026-12-30', '2027-01-03', 4, 'Réveillon 2027'], ['2027-02-05', '2027-02-09', 4, 'Carnaval 2027'],
    ['2027-03-25', '2027-03-28', 3, 'Semana Santa 2027'], ['2027-05-27', '2027-05-30', 3, 'Corpus Christi 2027'], ['2027-09-04', '2027-09-07', 3, 'Independência 2027'],
    ['2027-10-09', '2027-10-12', 3, 'Nossa Senhora Aparecida 2027'], ['2027-10-30', '2027-11-02', 3, 'Finados 2027'], ['2027-11-12', '2027-11-15', 3, 'Proclamação da República 2027'],
    ['2027-12-24', '2027-12-27', 3, 'Natal 2027'], ['2027-12-30', '2028-01-03', 4, 'Réveillon 2028'],
  ];
  feriados.forEach(([a, b, min, obs]) => { for (let d = a; d < b; d = somar(d, 1)) aj.set(d, { data: d, valor: 1700, minNoites: min, fechado: false, semChegada: false, semSaida: false, obs }); });
  return {
    seq: 3, tarifasDe: null, tarifasEm: 0,
    tarifas: [
      { id: 1, nome: 'Tarifa padrão', ini: '2026-11-01', fim: '2029-01-01', prioridade: 0, valorNoite: 800, valorFds: 1700, adultosInclusos: 2, adultoExtra: 0, pcCrianca: 30, pcCriancaMaior: 100, pcBebe: 0, minNoites: 2, ativo: true, diasFds: [5, 6, 7] },
      // exemplo desativado: mostra a situação "Inativa" sem mexer nos preços do calendário
      { id: 2, nome: 'Alta temporada de julho (exemplo)', ini: '2027-07-01', fim: '2027-08-01', prioridade: 1, valorNoite: 1100, valorFds: 2000, adultosInclusos: 2, adultoExtra: 0, pcCrianca: 30, pcCriancaMaior: 100, pcBebe: 0, minNoites: 3, ativo: false, diasFds: [5, 6, 7] },
    ],
    ajustes: aj,
    pacotes: [
      { id: 1, nome: 'Natal 2026', checkin: '2026-12-24', noites: 3, total: 2400, ativo: true },
      { id: 2, nome: 'Natal 2026', checkin: '2026-12-24', noites: 4, total: 2900, ativo: true },
    ],
    ocupacoes: [
      { ini: somar(h, 3), fim: somar(h, 5), tipo: 'pre-reserva', rotulo: 'Pré-reserva · aguardando o sinal' },
      { ini: somar(h, 9), fim: somar(h, 12), tipo: 'reserva', rotulo: 'Reserva confirmada' },
      { ini: somar(h, 16), fim: somar(h, 19), tipo: 'bloqueio', rotulo: 'Bloqueio · manutenção' },
    ],
  };
})();

const espera = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), REAL ? 0 : 120));
const falha = (e: { message?: string } | null | undefined): Resultado => ({ ok: false, erro: mensagem(e?.message) });
const rpc = async (nome: string, args: Record<string, unknown>) => {
  const { data, error } = await supabase!.rpc(nome, args);
  if (error) throw error;
  return data;
};

// ── chalés
// os chalés quase não mudam: uma consulta por 5 minutos serve as quatro telas (o banco confere o perfil toda vez que chamado)
let unidadesEm = 0, unidadesP: Promise<Unidade[]> | null = null;
export async function listarUnidades(): Promise<Unidade[]> {
  if (!REAL) return espera([DEMO_UNIDADE]);
  if (!unidadesP || Date.now() - unidadesEm > 300000) {
    unidadesEm = Date.now();
    unidadesP = rpc('prc_unidades', {}).then((l) => (l as any[]).map((u): Unidade => ({
      id: Number(u.id_unidade), codigo: u.cd_unidade, nome: u.nm_unidade, maxAdultos: u.qtde_max_adultos, maxCriancas: u.qtde_max_criancas, maxHospedes: u.qtde_max_hospedes,
      maxNoites: u.qtde_max_noites, taxaLimpeza: Number(u.vl_taxa_limpeza), percentualSinal: Number(u.vl_percentual_sinal),
    }))).catch((e) => { unidadesP = null; throw e; });
  }
  return unidadesP;
}

// ── tarifas
const ordenar = (l: Tarifa[]) => [...l].sort((a, b) => b.prioridade - a.prioridade || a.ini.localeCompare(b.ini) || a.id - b.id);
export async function listarTarifas(unidade: number): Promise<Tarifa[]> {
  if (REAL) {
    dados.tarifasDe = unidade; dados.tarifasEm = Date.now();
    dados.tarifas = ((await rpc('prc_tarifas', { p_id_unidade: unidade })) as any[]).map((t): Tarifa => ({
      id: Number(t.id_tarifa), nome: t.nm_tarifa, ini: t.dt_ini, fim: t.dt_fim, prioridade: t.no_prioridade, valorNoite: Number(t.vl_noite),
      valorFds: t.vl_noite_fds === null ? null : Number(t.vl_noite_fds), adultosInclusos: t.qtde_adultos_inclusos, adultoExtra: Number(t.vl_adulto_extra),
      pcCrianca: Number(t.pc_crianca), pcCriancaMaior: Number(t.pc_crianca_maior), pcBebe: Number(t.pc_bebe), minNoites: t.qtde_min_noites, ativo: t.sg_ativo,
      diasFds: Array.isArray(t.no_dias_fds) ? t.no_dias_fds.map(Number) : DIAS_PADRAO,   // banco sem a coluna: o padrão de antes
    }));
  }
  return espera(ordenar(dados.tarifas));
}
export const obterTarifa = (id: number) => dados.tarifas.find((t) => t.id === id) ?? null;

/** Conferência rápida na tela (o banco confere de novo). */
export function validarTarifa(t: Omit<Tarifa, 'id'> & { id?: number }): string[] {
  const e: string[] = [];
  if (!t.nome.trim()) e.push('Dê um nome à tarifa.');
  if (!t.ini || !t.fim) e.push('Informe a primeira e a última noite.');
  else if (t.fim <= t.ini) e.push('A última noite não pode ser antes da primeira.');
  if (!(t.valorNoite >= 0)) e.push('Informe o valor da noite de domingo a quinta.');
  if (t.valorFds !== null && !(t.valorFds >= 0)) e.push('Valor de fim de semana inválido.');
  if (!(t.adultosInclusos >= 1)) e.push('Os adultos inclusos no valor precisam ser ao menos 1.');
  if (![t.pcCrianca, t.pcCriancaMaior, t.pcBebe].every((p) => p >= 0 && p <= 100)) e.push('Os percentuais das crianças vão de 0 a 100.');
  if (!(t.minNoites >= 1)) e.push('O mínimo de noites é 1 ou mais.');
  if (t.ativo && t.ini && t.fim > t.ini) {
    const outra = dados.tarifas.find((o) => o.id !== t.id && o.ativo && o.prioridade === t.prioridade && o.ini < t.fim && t.ini < o.fim);
    if (outra) e.push(`O período se sobrepõe a “${outra.nome}” na mesma prioridade. Mude a prioridade ou as datas.`);
  }
  return e;
}

export async function salvarTarifa(unidade: number, t: Omit<Tarifa, 'id'> & { id?: number }): Promise<Resultado> {
  const e = validarTarifa(t);
  if (e.length) return { ok: false, erro: e[0] };
  if (REAL) {
    const { error } = await supabase!.rpc('prc_salvar_tarifa', {
      p_id_tarifa: t.id ?? null, p_id_unidade: unidade, p_nm_tarifa: t.nome.trim(), p_dt_ini: t.ini, p_dt_fim: t.fim, p_no_prioridade: t.prioridade,
      p_vl_noite: t.valorNoite, p_vl_noite_fds: t.valorFds, p_qtde_adultos_inclusos: t.adultosInclusos, p_vl_adulto_extra: t.adultoExtra,
      p_pc_crianca: t.pcCrianca, p_pc_crianca_maior: t.pcCriancaMaior, p_pc_bebe: t.pcBebe, p_qtde_min_noites: t.minNoites, p_sg_ativo: t.ativo,
      // só envia os dias quando mudam do padrão: assim funciona também com o banco anterior à coluna NO_DIAS_FDS
      ...([...t.diasFds].sort().join() === DIAS_PADRAO.join() ? {} : { p_no_dias_fds: [...new Set(t.diasFds)].sort() }),
    });
    dados.tarifasEm = 0;
    return error ? falha(error) : { ok: true };
  }
  if (t.id) dados.tarifas = dados.tarifas.map((o) => (o.id === t.id ? { ...(t as Tarifa) } : o));
  else dados.tarifas.push({ ...t, id: ++dados.seq });
  return espera({ ok: true });
}

export async function alternarTarifa(id: number): Promise<Resultado> {
  const t = dados.tarifas.find((o) => o.id === id);
  if (!t) return { ok: false, erro: 'Tarifa não encontrada.' };
  const novo = { ...t, ativo: !t.ativo };
  const e = novo.ativo ? validarTarifa(novo) : [];
  if (e.length) return { ok: false, erro: e[0] };
  if (REAL) {
    const { error } = await supabase!.rpc('prc_alternar_tarifa', { p_id_tarifa: id, p_sg_ativo: novo.ativo });
    dados.tarifasEm = 0;
    return error ? falha(error) : { ok: true };
  }
  dados.tarifas = dados.tarifas.map((o) => (o.id === id ? novo : o));
  return espera({ ok: true });
}

/** Tarifa que vale numa noite: a ativa de maior prioridade. */
export const tarifaDe = (data: string) =>
  dados.tarifas.filter((t) => t.ativo && data >= t.ini && data < t.fim).sort((a, b) => b.prioridade - a.prioridade)[0] ?? null;

// ── ajustes de um dia
export const ajusteDe = (data: string) => dados.ajustes.get(data) ?? null;
export async function salvarAjustes(unidade: number, datas: string[], a: Omit<Ajuste, 'data'>): Promise<Resultado> {
  if (a.valor !== null && !(a.valor >= 0)) return { ok: false, erro: 'Valor da noite inválido.' };
  if (a.minNoites !== null && !(a.minNoites >= 1)) return { ok: false, erro: 'O mínimo de noites é 1 ou mais.' };
  if (REAL) {
    const { error } = await supabase!.rpc('prc_salvar_ajustes', {
      p_id_unidade: unidade, p_datas: datas, p_vl_noite: a.valor, p_qtde_min_noites: a.minNoites, p_sg_fechado: a.fechado, p_sg_sem_chegada: a.semChegada,
      p_sg_sem_saida: a.semSaida, p_ds_observacao: a.obs || null,
    });
    return error ? falha(error) : { ok: true };
  }
  datas.forEach((d) => dados.ajustes.set(d, { ...a, data: d }));
  return espera({ ok: true });
}
export async function removerAjustes(unidade: number, datas: string[]): Promise<Resultado> {
  if (REAL) {
    const { error } = await supabase!.rpc('prc_remover_ajustes', { p_id_unidade: unidade, p_datas: datas });
    return error ? falha(error) : { ok: true };
  }
  datas.forEach((d) => dados.ajustes.delete(d));
  return espera({ ok: true });
}

// ── faixas de idade das crianças (por pousada): até `bebe` anos, até `menor`, até `crianca`; acima disso, adulto
export type Idades = { bebe: number; menor: number; crianca: number };
export const IDADES_PADRAO: Idades = { bebe: 4, menor: 8, crianca: 13 };
let idadesDemo: Idades = { ...IDADES_PADRAO };
/** Rótulos das faixas: "até 4 anos", "5 a 8 anos", "9 a 13 anos" e "14+ anos". */
export const faixas = (i: Idades) => ({ bebe: `até ${i.bebe} anos`, menor: `${i.bebe + 1} a ${i.menor} anos`, crianca: `${i.menor + 1} a ${i.crianca} anos`, adulto: `${i.crianca + 1}+ anos` });
export async function carregarIdades(unidade: number): Promise<{ idades: Idades; editavel: boolean }> {
  if (!REAL) return espera({ idades: { ...idadesDemo }, editavel: true });
  try {
    const r = ((await rpc('prc_idades', { p_id_unidade: unidade })) as any[])[0];
    return r ? { idades: { bebe: r.no_idade_max_bebe, menor: r.no_idade_max_crianca_menor, crianca: r.no_idade_max_crianca }, editavel: true } : { idades: IDADES_PADRAO, editavel: false };
  } catch { return { idades: IDADES_PADRAO, editavel: false }; }        // banco ainda sem a função: mostra as faixas de sempre
}
export function validarIdades(i: Idades): string | null {
  return i.bebe >= 0 && i.bebe < i.menor && i.menor < i.crianca && i.crianca <= 17 ? null : 'As faixas de idade precisam crescer (ex.: até 4, até 8, até 13) e ir no máximo até 17 anos.';
}
export async function salvarIdades(unidade: number, i: Idades): Promise<Resultado> {
  const e = validarIdades(i);
  if (e) return { ok: false, erro: e };
  if (REAL) {
    const { error } = await supabase!.rpc('prc_salvar_idades', { p_id_unidade: unidade, p_bebe: i.bebe, p_menor: i.menor, p_crianca: i.crianca });
    return error ? falha(error) : { ok: true };
  }
  idadesDemo = { ...i };
  return espera({ ok: true });
}

// ── pacotes
export const fimPacote = (p: Pacote) => somar(p.checkin, p.noites);
const ordenarPacotes = (l: Pacote[]) => [...l].sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.checkin.localeCompare(b.checkin) || a.noites - b.noites);
export async function listarPacotes(unidade: number): Promise<Pacote[]> {
  if (REAL) {
    dados.pacotes = ((await rpc('prc_pacotes', { p_id_unidade: unidade })) as any[]).map((p): Pacote => ({
      id: Number(p.id_pacote), nome: p.nm_pacote, checkin: p.dt_checkin, noites: p.qtde_noites, total: Number(p.vl_total), ativo: p.sg_ativo,
    }));
  }
  return espera(ordenarPacotes(dados.pacotes));
}
/** Pacotes ativos cujas noites incluem a data (todas as opções do mesmo check-in). */
export const pacotesDe = (data: string) => dados.pacotes.filter((p) => p.ativo && data >= p.checkin && data < fimPacote(p));

/** Conferência rápida na tela (o banco confere de novo). */
export function validarPacote(p: Omit<Pacote, 'id'> & { id?: number }): string | null {
  const nome = p.nome.trim();
  if (nome.length < 2 || nome.length > 60) return 'Dê um nome ao pacote (2 a 60 letras).';
  if (!p.checkin) return 'Informe a data de check-in.';
  if (!(p.noites >= 1 && p.noites <= 30)) return 'O pacote tem de 1 a 30 noites.';
  if (!(p.total > 0)) return 'Informe o valor total do pacote.';
  if (!p.ativo) return null;
  if (p.checkin < hoje()) return 'O check-in já passou.';
  const fim = somar(p.checkin, p.noites);
  const outros = dados.pacotes.filter((o) => o.ativo && o.id !== p.id);
  if (outros.some((o) => o.checkin === p.checkin && o.noites === p.noites)) return 'Já existe um pacote ativo com esse check-in e esse número de noites.';
  if (outros.some((o) => o.checkin !== p.checkin && o.checkin < fim && p.checkin < fimPacote(o))) return 'As noites se sobrepõem a outro pacote com check-in diferente. Opções do mesmo pacote precisam ter o mesmo check-in.';
  return null;
}
export async function salvarPacote(unidade: number, p: Omit<Pacote, 'id'> & { id?: number }): Promise<Resultado> {
  const e = validarPacote(p);
  if (e) return { ok: false, erro: e };
  if (REAL) {
    const { error } = await supabase!.rpc('prc_salvar_pacote', {
      p_id_pacote: p.id ?? null, p_id_unidade: unidade, p_nm_pacote: p.nome.trim(), p_dt_checkin: p.checkin, p_qtde_noites: p.noites, p_vl_total: p.total, p_sg_ativo: p.ativo,
    });
    return error ? falha(error) : { ok: true };
  }
  if (p.id) dados.pacotes = dados.pacotes.map((o) => (o.id === p.id ? { ...(p as Pacote) } : o));
  else dados.pacotes.push({ ...p, nome: p.nome.trim(), id: ++dados.seq });
  return espera({ ok: true });
}

// ── ocupação (reservas e bloqueios)
export const ocupacaoDe = (data: string) => dados.ocupacoes.find((o) => data >= o.ini && data < o.fim) ?? null;

/** Traz para a memória o que o calendário do mês precisa: tarifas, ajustes e ocupação. */
export async function carregarMes(unidade: number, mes: string): Promise<void> {
  if (!REAL) return espera(undefined);
  const ini = primeiroDoMes(mes), fim = ultimoDoMes(mes);
  // pacotes: se o banco não responder a função, o calendário funciona igual, sem pacotes
  const tarifasFrescas = dados.tarifasDe === unidade && Date.now() - dados.tarifasEm < 30000;       // virar o mês não precisa buscar as tarifas de novo
  const [t, a, o] = await Promise.all([(tarifasFrescas ? Promise.resolve() : listarTarifas(unidade)).then(async (x) => { await listarPacotes(unidade).catch(() => { dados.pacotes = []; }); return x; }), rpc('prc_ajustes', { p_id_unidade: unidade, p_dt_ini: ini, p_dt_fim: fim }), rpc('prc_ocupacao', { p_id_unidade: unidade, p_dt_ini: ini, p_dt_fim: fim })]);
  void t;
  dados.ajustes = new Map((a as any[]).map((x): [string, Ajuste] => [x.dt_ref, {
    data: x.dt_ref, valor: x.vl_noite === null ? null : Number(x.vl_noite), minNoites: x.qtde_min_noites, fechado: x.sg_fechado, semChegada: x.sg_sem_chegada,
    semSaida: x.sg_sem_saida, obs: x.ds_observacao ?? '',
  }]));
  dados.ocupacoes = (o as any[]).map((x): Ocupacao => ({ ini: x.dt_ini, fim: x.dt_fim, tipo: x.tp_ocupacao, rotulo: x.ds_rotulo }));
}

/** Situação de uma noite, como o calendário do site a vê (1 casal). */
export type Dia = {
  data: string; valor: number | null; minNoites: number; tarifa: string | null; fechado: boolean; semChegada: boolean; semSaida: boolean;
  ajustado: boolean; obs: string; ocupacao: Ocupacao | null; pacotes: Pacote[];
};
export function diaDe(data: string): Dia {
  const t = tarifaDe(data), a = ajusteDe(data);
  const base = t ? (usaValor2(t, data) ? t.valorFds ?? t.valorNoite : t.valorNoite) : null;
  return {
    data, valor: a?.valor ?? base, minNoites: Math.max(a?.minNoites ?? t?.minNoites ?? 1, 1), tarifa: t?.nome ?? null,
    fechado: !!a?.fechado, semChegada: !!a?.semChegada, semSaida: !!a?.semSaida, ajustado: !!a, obs: a?.obs ?? '', ocupacao: ocupacaoDe(data), pacotes: pacotesDe(data),
  };
}

// ── simulador
export const MOTIVOS: Record<string, string> = {
  datas_invalidas: 'Datas inválidas: a saída precisa ser depois da entrada.', data_passada: 'A entrada já passou.',
  estadia_longa: 'Acima do máximo de noites por reserva do site.',
  capacidade: 'Acima da capacidade do chalé (bebês também ocupam vaga).',
  sem_tarifa: 'Alguma noite ainda não tem tarifa: a venda não está aberta para esse período.', fechado: 'Alguma noite está fechada para venda.',
  sem_chegada: 'Esse dia não aceita chegada.', sem_saida: 'Esse dia não aceita saída.', min_noites: 'Abaixo do mínimo de noites do período.', ocupado: 'As datas já estão ocupadas por reserva ou bloqueio.',
  pacote: 'Essas noites são vendidas só em pacote: escolha o check-in e o número de noites de um dos pacotes.',
  unidade_inativa: 'Chalé inativo.',
};
export type Hospedes = { adultos: number; criancas: number; criancasMaiores: number; bebes: number };
export type Noite = { data: string; tarifa: string | null; base: number; extras: number; total: number; ajustada: boolean; obs: string };
export type Estadia = { disponivel: boolean; motivo: string | null; noites: number; minNoites: number; hospedagem: number; taxaLimpeza: number; total: number; sinal: number; detalhe: Noite[] };

/** Demonstração: a mesma conta de calcular_estadia(), no navegador. No real o simulador chama o servidor. */
function calcularLocal(u: Unidade, checkin: string, checkout: string, h: Hospedes): Estadia {
  const n = checkin && checkout ? noites(checkin, checkout) : 0;
  const vazio = (motivo: string): Estadia => ({ disponivel: false, motivo, noites: Math.max(n, 0), minNoites: 0, hospedagem: 0, taxaLimpeza: 0, total: 0, sinal: 0, detalhe: [] });
  if (!checkin || !checkout || n < 1) return vazio('datas_invalidas');
  if (checkin < hoje()) return vazio('data_passada');
  if (n > u.maxNoites) return vazio('estadia_longa');
  if (h.adultos < 1 || h.adultos > u.maxAdultos || h.criancas + h.criancasMaiores + h.bebes > u.maxCriancas || h.adultos + h.criancas + h.criancasMaiores + h.bebes > u.maxHospedes) return vazio('capacidade');

  const detalhe: Noite[] = [];
  let semTarifa = false, fechado = false, min = 1;
  for (let d = checkin; d < checkout; d = somar(d, 1)) {
    const t = tarifaDe(d), a = ajusteDe(d);
    if (!t) semTarifa = true;
    if (a?.fechado) fechado = true;
    min = Math.max(min, a?.minNoites ?? t?.minNoites ?? 1);
    const base = a?.valor ?? (t ? (usaValor2(t, d) ? t.valorFds ?? t.valorNoite : t.valorNoite) : 0);
    const inc = t?.adultosInclusos ?? 1;
    const extras = t
      ? Math.max(h.adultos - inc, 0) * t.adultoExtra
        + Math.round((base / inc) * (h.criancas * t.pcCrianca + h.criancasMaiores * t.pcCriancaMaior)) / 100
        + Math.round((base / inc) * h.bebes * t.pcBebe) / 100
      : 0;
    detalhe.push({ data: d, tarifa: t?.nome ?? null, base, extras: Math.round(extras * 100) / 100, total: Math.round((base + extras) * 100) / 100, ajustada: !!a, obs: a?.obs ?? '' });
  }
  // pacote: check-in e noites iguais a uma opção ativa → valor fechado (extras de criança/adulto continuam por noite)
  const pac = semTarifa ? null : dados.pacotes.find((p) => p.ativo && p.checkin === checkin && p.noites === n) ?? null;
  const toca = !pac && dados.pacotes.some((p) => p.ativo && p.checkin < checkout && checkin < fimPacote(p));
  if (pac) {
    const cada = Math.floor((pac.total / n) * 100) / 100;
    detalhe.forEach((x, i) => {
      x.base = i === n - 1 ? Math.round((pac.total - cada * (n - 1)) * 100) / 100 : cada;
      x.total = Math.round((x.base + x.extras) * 100) / 100; x.tarifa = `Pacote ${pac.nome}`;
    });
    min = n;
  }
  const hospedagem = Math.round(detalhe.reduce((s, x) => s + x.total, 0) * 100) / 100;
  const motivo = semTarifa ? 'sem_tarifa' : fechado ? 'fechado'
    : ajusteDe(checkin)?.semChegada ? 'sem_chegada' : ajusteDe(checkout)?.semSaida ? 'sem_saida' : toca ? 'pacote' : n < min ? 'min_noites'
    : detalhe.some((x) => ocupacaoDe(x.data)) ? 'ocupado' : null;
  const total = hospedagem + u.taxaLimpeza;
  return { disponivel: motivo === null, motivo, noites: n, minNoites: min, hospedagem, taxaLimpeza: u.taxaLimpeza, total, sinal: Math.round(total * u.percentualSinal) / 100, detalhe };
}

export async function calcularEstadia(u: Unidade, checkin: string, checkout: string, h: Hospedes): Promise<Estadia> {
  if (!REAL) return espera(calcularLocal(u, checkin, checkout, h));
  if (!checkin || !checkout) return calcularLocal(u, '', '', h);                // datas em branco: não chama o servidor
  const linhas = (await rpc('prc_calcular', {
    p_id_unidade: u.id, p_checkin: checkin, p_checkout: checkout, p_adultos: h.adultos, p_criancas: h.criancas, p_bebes: h.bebes, p_criancas_maiores: h.criancasMaiores,
  })) as any[];
  const r = linhas[0];
  if (!r) return calcularLocal(u, '', '', h);
  // marca no resultado as noites que têm ajuste do dia (o cálculo do servidor não diz qual noite foi ajustada)
  const aj = r.ds_detalhe?.length ? ((await rpc('prc_ajustes', { p_id_unidade: u.id, p_dt_ini: checkin, p_dt_fim: somar(checkout, -1) })) as any[]) : [];
  const porData = new Map(aj.map((x) => [x.dt_ref as string, x]));
  const detalhe: Noite[] = (r.ds_detalhe ?? []).map((d: any): Noite => ({
    data: d.dt_ref, tarifa: d.nm_tarifa ?? null, base: Number(d.vl_base), extras: Number(d.vl_extras), total: Number(d.vl_noite),
    ajustada: porData.has(d.dt_ref), obs: porData.get(d.dt_ref)?.ds_observacao ?? '',
  }));
  const total = Number(r.vl_total);
  return {
    disponivel: !!r.disponivel, motivo: r.motivo ?? null, noites: r.qtde_noites, minNoites: r.qtde_min_noites, hospedagem: Number(r.vl_hospedagem),
    taxaLimpeza: Number(r.vl_taxa_limpeza), total, sinal: Math.round(total * Number(r.vl_percentual_sinal)) / 100, detalhe,
  };
}
