// Pendências da gestão: só o que pede ação de quem gere (gestor ou administrador), montado a partir do que já existe
// (ocorrências, situação das unidades e vistorias). O acesso por pousada continua sendo do banco (RLS).
import { hoje } from './campo';
import { atrasada, emAberto, listarOcorrencias, listarVistorias, unidadesGestao } from './gestao';
import { somar } from './precos';

export type Pendencia = {
  chave: string; nivel: 'urgente' | 'atencao' | 'conferir'; icone: string; titulo: string; detalhe: string; qtd: number; link: string;
};
const FORA_DA_VENDA = ['bloqueado', 'manutencao'];
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export async function listarPendencias(): Promise<Pendencia[]> {
  const [us, ocs, vs] = await Promise.all([unidadesGestao(), listarOcorrencias(), listarVistorias({ status: 'sinalizada', de: somar(hoje(), -7) }, 0, 50)]);
  const abertas = ocs.filter(emAberto);
  const semResp = abertas.filter((o) => !o.responsavelId);
  const criticas = semResp.filter((o) => o.gravidade === 'critica');
  const outras = semResp.filter((o) => o.gravidade !== 'critica');
  const atrasadas = abertas.filter(atrasada);
  const criticaAberta = new Set(abertas.filter((o) => o.gravidade === 'critica').map((o) => o.unidadeId));
  const liberar = us.filter((u) => FORA_DA_VENDA.includes(u.estado) && !criticaAberta.has(u.id));
  const um = <T extends { id: string }>(l: T[], base: string, lista: string) => (l.length === 1 ? `${base}/${l[0].id}` : lista);
  const desc = (l: typeof abertas) => (l.length === 1 ? `${l[0].unidade} · ${l[0].ambiente} · ${l[0].descricao}` : [...new Set(l.map((o) => o.unidade))].join(', '));
  return [
    { chave: 'criticas', nivel: 'urgente', icone: 'solar:danger-triangle-linear', titulo: criticas.length === 1 ? 'Crítica sem responsável' : 'Críticas sem responsável',
      detalhe: criticas.length ? desc(criticas) : 'Todas as críticas têm responsável', qtd: criticas.length, link: um(criticas, '/gestao/ocorrencias', '/gestao/ocorrencias') },
    { chave: 'liberar', nivel: 'atencao', icone: 'solar:check-circle-linear', titulo: 'Unidade fora da venda, sem crítica aberta',
      detalhe: liberar.length ? `${liberar.map((u) => u.nome).join(', ')}: confira e libere` : 'Nenhuma unidade esperando liberação', qtd: liberar.length, link: um(liberar, '/gestao/unidades', '/gestao/unidades') },
    { chave: 'atrasadas', nivel: 'atencao', icone: 'solar:clock-circle-linear', titulo: 'Ocorrências atrasadas',
      detalhe: atrasadas.length ? desc(atrasadas) : 'Nenhuma no momento', qtd: atrasadas.length, link: um(atrasadas, '/gestao/ocorrencias', '/gestao/ocorrencias') },
    { chave: 'sem-resp', nivel: 'atencao', icone: 'solar:user-rounded-linear', titulo: 'Ocorrências sem responsável',
      detalhe: outras.length ? desc(outras) : 'Todas têm responsável', qtd: outras.length, link: um(outras, '/gestao/ocorrencias', '/gestao/ocorrencias') },
    { chave: 'sinalizadas', nivel: 'conferir', icone: 'solar:clipboard-check-linear', titulo: 'Vistorias com sinalização (7 dias)',
      detalhe: vs.lista.length ? vs.lista.slice(0, 2).map((v) => `${v.unidade} · ${v.tipo}`).join(', ') + (vs.total > 2 ? ` e mais ${vs.total - 2}` : '') : 'Nenhuma vistoria sinalizada',
      qtd: vs.total, link: vs.lista.length === 1 ? `/gestao/vistorias/${vs.lista[0].id}` : '/gestao/vistorias?status=sinalizada' },
  ];
}

// contador da barra de navegação: guarda por 1 minuto para não consultar o banco a cada troca de tela
let cache: { quando: number; qtd: Promise<number> } | null = null;
export function contarPendencias(forcar = false): Promise<number> {
  if (!forcar && cache && Date.now() - cache.quando < 60_000) return cache.qtd;
  const qtd = listarPendencias().then((l) => l.reduce((s, p) => s + p.qtd, 0)).catch(() => { cache = null; return 0; });
  cache = { quando: Date.now(), qtd };
  return qtd;
}
export const resumoPendencias = (n: number) => (n ? plural(n, 'pendência', 'pendências') : 'Nada pendente');
