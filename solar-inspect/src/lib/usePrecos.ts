import { useEffect, useState } from 'react';
import type { Opcao } from '../components/Filtros';
import { listarUnidades, type Unidade } from './precos';

let lembrada: number | null = null; // o chalé escolhido vale para as telas de preço enquanto o app está aberto

/** Chalés de preço (prc_unidades). Só carrega quando `ativo` (perfil já liberado). */
export function useUnidades(ativo: boolean) {
  const [lista, setLista] = useState<Unidade[] | null>(null);
  const [erro, setErro] = useState(false);
  const [id, setId] = useState<number | null>(lembrada);
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    setErro(false);
    listarUnidades()
      .then((l) => { setLista(l); setId((atual) => (atual !== null && l.some((u) => u.id === atual) ? atual : l[0]?.id ?? null)); })
      .catch(() => setErro(true));
  }, [ativo, vez]);
  const escolher = (valor: string) => { lembrada = Number(valor); setId(lembrada); };
  const opcoes: Opcao[] = (lista ?? []).map((u) => ({ valor: String(u.id), label: u.nome }));
  return { lista, erro, atual: lista?.find((u) => u.id === id) ?? null, escolher, opcoes, tentarDeNovo: () => setVez((n) => n + 1) };
}
