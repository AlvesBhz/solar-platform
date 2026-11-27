// Preços do site (T38–T41). PROTÓTIPO: dados de exemplo em memória, nada vai ao banco.
// A regra de cálculo é a mesma de calcular_estadia() do site (site/database/schema.sql):
//   ajuste do dia > tarifa de maior prioridade; sexta, sábado e domingo usam o valor de fim de semana;
//   criança paga um percentual do valor por pessoa (valor da noite ÷ adultos inclusos).
// Na versão real, estas funções passam a chamar o Supabase (SIT_TARIFA e SIT_AJUSTE_DIARIO, com RLS só para gestão e ADMIN)
// e o simulador chama calcular_estadia() no servidor. As telas não mudam.
import { hoje } from './campo';

export type Tarifa = {
  id: number; nome: string; ini: string; fim: string; // fim = dia seguinte à última noite (igual ao banco)
  prioridade: number; valorNoite: number; valorFds: number | null; adultosInclusos: number; adultoExtra: number;
  pcCrianca: number; pcCriancaMaior: number; pcBebe: number; minNoites: number; ativo: boolean;
};
export type Ajuste = { data: string; valor: number | null; minNoites: number | null; fechado: boolean; semChegada: boolean; semSaida: boolean; obs: string };
export type Ocupacao = { ini: string; fim: string; tipo: 'reserva' | 'pre-reserva' | 'bloqueio'; rotulo: string }; // fim = dia seguinte à última noite

export type Resultado = { ok: true } | { ok: false; erro: string };

// ── datas (texto AAAA-MM-DD, sem fuso)
export const noon = (iso: string) => new Date(iso + 'T12:00:00');
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const somar = (s: string, n: number) => { const d = noon(s); d.setDate(d.getDate() + n); return iso(d); };
export const noites = (a: string, b: string) => Math.round((noon(b).getTime() - noon(a).getTime()) / 86400000);
export const fimDeSemana = (s: string) => [0, 5, 6].includes(noon(s).getDay()); // sexta, sábado e domingo
export const diaSemana = (s: string) => noon(s).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
export const dataCurta = (s: string) => noon(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
export const dataLonga = (s: string) => noon(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const mesAno = (s: string) => noon(s).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: v % 1 ? 2 : 0 });
/** Como no calendário do site: 1.700 → 1,7k */
export const brlCurto = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : String(v));

// ── a pousada e o chalé de exemplo (SIT_PROPRIEDADE / SIT_UNIDADE)
export const UNIDADE = {
  codigo: 'casa-do-mirante', nome: 'Casa do Mirante', maxAdultos: 2, maxCriancas: 2, maxHospedes: 4, maxNoites: 7, taxaLimpeza: 0, percentualSinal: 50,
};

// ── dados de exemplo
const dados: { tarifas: Tarifa[]; ajustes: Map<string, Ajuste>; ocupacoes: Ocupacao[]; seq: number } = (() => {
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
    seq: 3,
    tarifas: [
      { id: 1, nome: 'Tarifa padrão', ini: '2026-11-01', fim: '2029-01-01', prioridade: 0, valorNoite: 800, valorFds: 1700, adultosInclusos: 2, adultoExtra: 0, pcCrianca: 30, pcCriancaMaior: 100, pcBebe: 0, minNoites: 2, ativo: true },
      // exemplo desativado: mostra a situação "Inativa" sem mexer nos preços do calendário
      { id: 2, nome: 'Alta temporada de julho (exemplo)', ini: '2027-07-01', fim: '2027-08-01', prioridade: 1, valorNoite: 1100, valorFds: 2000, adultosInclusos: 2, adultoExtra: 0, pcCrianca: 30, pcCriancaMaior: 100, pcBebe: 0, minNoites: 3, ativo: false },
    ],
    ajustes: aj,
    ocupacoes: [
      { ini: somar(h, 3), fim: somar(h, 5), tipo: 'pre-reserva', rotulo: 'Pré-reserva · aguardando o sinal' },
      { ini: somar(h, 9), fim: somar(h, 12), tipo: 'reserva', rotulo: 'Reserva confirmada' },
      { ini: somar(h, 16), fim: somar(h, 19), tipo: 'bloqueio', rotulo: 'Bloqueio · manutenção' },
    ],
  };
})();

const espera = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));

// ── tarifas
export const listarTarifas = () => espera([...dados.tarifas].sort((a, b) => b.prioridade - a.prioridade || a.ini.localeCompare(b.ini)));
export const obterTarifa = (id: number) => espera(dados.tarifas.find((t) => t.id === id) ?? null);

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

export async function salvarTarifa(t: Omit<Tarifa, 'id'> & { id?: number }): Promise<Resultado> {
  const e = validarTarifa(t);
  if (e.length) return { ok: false, erro: e[0] };
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
  dados.tarifas = dados.tarifas.map((o) => (o.id === id ? novo : o));
  return espera({ ok: true });
}

/** Tarifa que vale numa noite: a ativa de maior prioridade. */
export const tarifaDe = (data: string) =>
  dados.tarifas.filter((t) => t.ativo && data >= t.ini && data < t.fim).sort((a, b) => b.prioridade - a.prioridade)[0] ?? null;

// ── ajustes de um dia
export const ajusteDe = (data: string) => dados.ajustes.get(data) ?? null;
export async function salvarAjustes(datas: string[], a: Omit<Ajuste, 'data'>): Promise<Resultado> {
  if (a.valor !== null && !(a.valor >= 0)) return { ok: false, erro: 'Valor da noite inválido.' };
  if (a.minNoites !== null && !(a.minNoites >= 1)) return { ok: false, erro: 'O mínimo de noites é 1 ou mais.' };
  datas.forEach((d) => dados.ajustes.set(d, { ...a, data: d }));
  return espera({ ok: true });
}
export async function removerAjustes(datas: string[]): Promise<Resultado> {
  datas.forEach((d) => dados.ajustes.delete(d));
  return espera({ ok: true });
}

// ── ocupação (reservas e bloqueios)
export const ocupacaoDe = (data: string) => dados.ocupacoes.find((o) => data >= o.ini && data < o.fim) ?? null;

/** Situação de uma noite, como o calendário do site a vê (1 casal). */
export type Dia = {
  data: string; valor: number | null; minNoites: number; tarifa: string | null; fechado: boolean; semChegada: boolean; semSaida: boolean;
  ajustado: boolean; obs: string; ocupacao: Ocupacao | null;
};
export function diaDe(data: string): Dia {
  const t = tarifaDe(data), a = ajusteDe(data);
  const base = t ? (fimDeSemana(data) ? t.valorFds ?? t.valorNoite : t.valorNoite) : null;
  return {
    data, valor: a?.valor ?? base, minNoites: Math.max(a?.minNoites ?? t?.minNoites ?? 1, 1), tarifa: t?.nome ?? null,
    fechado: !!a?.fechado, semChegada: !!a?.semChegada, semSaida: !!a?.semSaida, ajustado: !!a, obs: a?.obs ?? '', ocupacao: ocupacaoDe(data),
  };
}

// ── simulador: mesma conta de calcular_estadia()
export const MOTIVOS: Record<string, string> = {
  datas_invalidas: 'Datas inválidas: a saída precisa ser depois da entrada.', data_passada: 'A entrada já passou.',
  estadia_longa: `O site aceita no máximo ${UNIDADE.maxNoites} noites por reserva.`,
  capacidade: `Acima da capacidade: até ${UNIDADE.maxAdultos} adultos, ${UNIDADE.maxCriancas} crianças e ${UNIDADE.maxHospedes} hóspedes (bebês também ocupam vaga).`,
  sem_tarifa: 'Alguma noite ainda não tem tarifa: a venda não está aberta para esse período.', fechado: 'Alguma noite está fechada para venda.',
  sem_chegada: 'Esse dia não aceita chegada.', sem_saida: 'Esse dia não aceita saída.', min_noites: 'Abaixo do mínimo de noites do período.', ocupado: 'As datas já estão ocupadas por reserva ou bloqueio.',
};
export type Hospedes = { adultos: number; criancas: number; criancasMaiores: number; bebes: number };
export type Noite = { data: string; tarifa: string | null; base: number; extras: number; total: number; ajustada: boolean; obs: string };
export type Estadia = { disponivel: boolean; motivo: string | null; noites: number; minNoites: number; hospedagem: number; taxaLimpeza: number; total: number; sinal: number; detalhe: Noite[] };

export function calcularEstadia(checkin: string, checkout: string, h: Hospedes): Estadia {
  const n = checkin && checkout ? noites(checkin, checkout) : 0;
  const vazio = (motivo: string): Estadia => ({ disponivel: false, motivo, noites: Math.max(n, 0), minNoites: 0, hospedagem: 0, taxaLimpeza: 0, total: 0, sinal: 0, detalhe: [] });
  if (!checkin || !checkout || n < 1) return vazio('datas_invalidas');
  if (checkin < hoje()) return vazio('data_passada');
  if (n > UNIDADE.maxNoites) return vazio('estadia_longa');
  if (h.adultos < 1 || h.adultos > UNIDADE.maxAdultos || h.criancas + h.criancasMaiores + h.bebes > UNIDADE.maxCriancas || h.adultos + h.criancas + h.criancasMaiores + h.bebes > UNIDADE.maxHospedes) return vazio('capacidade');

  const detalhe: Noite[] = [];
  let semTarifa = false, fechado = false, min = 1;
  for (let d = checkin; d < checkout; d = somar(d, 1)) {
    const t = tarifaDe(d), a = ajusteDe(d);
    if (!t) semTarifa = true;
    if (a?.fechado) fechado = true;
    min = Math.max(min, a?.minNoites ?? t?.minNoites ?? 1);
    const base = a?.valor ?? (t ? (fimDeSemana(d) ? t.valorFds ?? t.valorNoite : t.valorNoite) : 0);
    const inc = t?.adultosInclusos ?? 1;
    const extras = t
      ? Math.max(h.adultos - inc, 0) * t.adultoExtra
        + Math.round((base / inc) * (h.criancas * t.pcCrianca + h.criancasMaiores * t.pcCriancaMaior)) / 100
        + Math.round((base / inc) * h.bebes * t.pcBebe) / 100
      : 0;
    detalhe.push({ data: d, tarifa: t?.nome ?? null, base, extras: Math.round(extras * 100) / 100, total: Math.round((base + extras) * 100) / 100, ajustada: !!a, obs: a?.obs ?? '' });
  }
  const hospedagem = Math.round(detalhe.reduce((s, x) => s + x.total, 0) * 100) / 100;
  const motivo = semTarifa ? 'sem_tarifa' : fechado ? 'fechado'
    : ajusteDe(checkin)?.semChegada ? 'sem_chegada' : ajusteDe(checkout)?.semSaida ? 'sem_saida' : n < min ? 'min_noites'
    : detalhe.some((x) => ocupacaoDe(x.data)) ? 'ocupado' : null;
  return { disponivel: motivo === null, motivo, noites: n, minNoites: min, hospedagem, taxaLimpeza: UNIDADE.taxaLimpeza, total: hospedagem + UNIDADE.taxaLimpeza, sinal: Math.round(((hospedagem + UNIDADE.taxaLimpeza) * UNIDADE.percentualSinal)) / 100, detalhe };
}
