import { useEffect, useState } from 'react';
import { type Ambiente, type Item } from '../mocks/checklist';
import { DURACAO_MINIMA_MIN } from '../mocks/envios';
import { contarFotosPorItem } from '../mocks/fotos';
import { REAL, carregarChecklist, obterUnidade, tipoDoRascunho, type Gravidade, type TipoVistoria, type Unidade } from './campo';
import { lerRascunho, type Rascunho } from '../mocks/vistoria';
import { divergente, itemCompleto } from './evidencia';

export type OcorrenciaPrevista = { item: Item; ambiente: Ambiente; gravidade: Gravidade; descricao: string };

/** Consolida o rascunho: pendências, divergências, ocorrências previstas, duração e sinalizações. */
export function useResumo(unidadeId: string) {
  const [u, setU] = useState<Unidade | null | undefined>(null);
  const [tipo, setTipo] = useState<TipoVistoria | null>(null);
  const [rasc] = useState<Rascunho | null>(() => lerRascunho(unidadeId));
  const [nFotos, setNFotos] = useState<Record<string, number> | null>(null);

  const [ambientes, setAmbientes] = useState<Ambiente[] | null>(null);
  useEffect(() => {
    obterUnidade(unidadeId).then(setU);
    tipoDoRascunho(rasc).then(setTipo);
    if (rasc) contarFotosPorItem(rasc.id).then(setNFotos);
  }, [unidadeId, rasc]);
  useEffect(() => { if (u) carregarChecklist(u, rasc).then(setAmbientes).catch(() => setAmbientes([])); }, [u, rasc]);

  const pronto = !!u && !!tipo && !!rasc && !!nFotos && !!ambientes?.length;
  const itens = (ambientes ?? []).flatMap((ambiente) => ambiente.itens.map((item) => ({ item, ambiente })));
  const resp = (id: string) => rasc?.respostas[id];
  const pendentes = itens.filter(({ item }) => !itemCompleto(item, resp(item.id), rasc?.obs?.[item.id], nFotos?.[item.id] ?? 0));
  const ocorrencias: OcorrenciaPrevista[] = itens
    .filter(({ item }) => divergente(resp(item.id)))
    .map(({ item, ambiente }) => {
      const o = rasc?.ocorrencias?.[item.id];
      return { item, ambiente, gravidade: item.critico ? 'critica' : o?.gravidade ?? 'media', descricao: o?.descricao || rasc?.obs?.[item.id] || '' };
    });
  const totalFotos = Object.values(nFotos ?? {}).reduce((a, b) => a + b, 0);
  const minutos = rasc?.inicio ? Math.max(0, Math.round((Date.now() - new Date(rasc.inicio).getTime()) / 60000)) : 0;
  // prévia: o banco recalcula as sinalizações no envio (duração mínima, GPS, entrada vinculada)
  const g = rasc?.presenca.gps;
  const sinalizacoes = REAL
    ? [...(g?.aceito ? [g.distanciaM !== undefined ? 'Fora do raio da unidade' : 'Sem localização'] : []), ...(rasc?.presenca.qr?.pendente ? ['QR Code conferido no envio'] : [])]
    : [...(minutos < DURACAO_MINIMA_MIN ? [`Duração abaixo de ${DURACAO_MINIMA_MIN} min`] : [])];

  return { u, tipo, rasc, pronto, itens, pendentes, ocorrencias, totalFotos, minutos, sinalizacoes, ambientes: ambientes ?? [] };
}
