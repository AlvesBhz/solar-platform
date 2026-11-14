// MOCKUP: dados fictícios em memória. Substituir por consultas Supabase (com RLS) nas próximas etapas.

export type EstadoUnidade = 'em_limpeza' | 'liberado' | 'ocupado' | 'bloqueado' | 'manutencao';
export type Gravidade = 'baixa' | 'media' | 'critica';
export type ModoValidacao = 'gps' | 'qr' | 'gps_qr';

export type Ocorrencia = { id: string; descricao: string; gravidade: Gravidade; prazo: string; ambiente: string };
export type UltimaVistoria = { tipo: string; data: string; assessor: string; sinalizada: boolean };

export type Unidade = {
  id: string;
  nome: string;
  tipo: 'Chalé' | 'Quarto' | 'Suíte';
  propriedade: string;
  andar?: string;
  estado: EstadoUnidade;
  validacao: ModoValidacao;
  ambientes: number;
  entradaVinculadaId?: string; // existe quando há estadia em curso (habilita a vistoria de saída)
  ocorrencias: Ocorrencia[];
  ultima?: UltimaVistoria;
};

export type TipoVistoria = {
  id: string;
  nome: string;
  descricao: string;
  respostas: string[];
  itens: number;
  ativo: boolean;
  exigeEntrada?: boolean;
};

const UNIDADES: Unidade[] = [
  {
    id: 'chale-ipe', nome: 'Chalé Ipê', tipo: 'Chalé', propriedade: 'Pousada Solar do Espinhaço', estado: 'liberado',
    validacao: 'gps_qr', ambientes: 5, ocorrencias: [],
    ultima: { tipo: 'Entrada', data: '2026-11-13T10:42:00', assessor: 'Ana Souza', sinalizada: false },
  },
  {
    id: 'chale-candeia', nome: 'Chalé Candeia', tipo: 'Chalé', propriedade: 'Pousada Solar do Espinhaço', estado: 'ocupado',
    validacao: 'gps', ambientes: 4, entradaVinculadaId: 'v-1021',
    ocorrencias: [{ id: 'o-1', descricao: 'Lâmpada do abajur queimada', gravidade: 'baixa', prazo: '2026-11-16', ambiente: 'Quarto' }],
    ultima: { tipo: 'Entrada', data: '2026-11-12T14:05:00', assessor: 'Ana Souza', sinalizada: false },
  },
  {
    id: 'chale-arnica', nome: 'Chalé Arnica', tipo: 'Chalé', propriedade: 'Pousada Solar do Espinhaço', estado: 'em_limpeza',
    validacao: 'qr', ambientes: 4, ocorrencias: [],
    ultima: { tipo: 'Saída', data: '2026-11-13T11:20:00', assessor: 'Bruno Lima', sinalizada: false },
  },
  {
    id: 'chale-sempre-viva', nome: 'Chalé Sempre-viva', tipo: 'Chalé', propriedade: 'Pousada Solar do Espinhaço', estado: 'bloqueado',
    validacao: 'gps_qr', ambientes: 5,
    ocorrencias: [
      { id: 'o-2', descricao: 'Vazamento na ducha do banheiro', gravidade: 'critica', prazo: '2026-11-14', ambiente: 'Banheiro' },
      { id: 'o-3', descricao: 'Toalha de rosto faltando', gravidade: 'media', prazo: '2026-11-15', ambiente: 'Banheiro' },
    ],
    ultima: { tipo: 'Entrada', data: '2026-11-13T09:10:00', assessor: 'Bruno Lima', sinalizada: true },
  },
  {
    id: 'quarto-101', nome: 'Quarto 101', tipo: 'Quarto', propriedade: 'Hotel Lapinha', andar: 'Térreo', estado: 'manutencao',
    validacao: 'qr', ambientes: 2,
    ocorrencias: [{ id: 'o-4', descricao: 'Ar-condicionado sem refrigerar', gravidade: 'critica', prazo: '2026-11-14', ambiente: 'Quarto' }],
    ultima: { tipo: 'Manutenção preventiva', data: '2026-11-11T16:30:00', assessor: 'Carla Dias', sinalizada: false },
  },
  {
    id: 'quarto-102', nome: 'Quarto 102', tipo: 'Quarto', propriedade: 'Hotel Lapinha', andar: 'Térreo', estado: 'liberado',
    validacao: 'qr', ambientes: 2, ocorrencias: [],
    ultima: { tipo: 'Entrada', data: '2026-11-13T08:15:00', assessor: 'Carla Dias', sinalizada: false },
  },
  {
    id: 'suite-201', nome: 'Suíte 201', tipo: 'Suíte', propriedade: 'Hotel Lapinha', andar: '1º andar', estado: 'ocupado',
    validacao: 'gps_qr', ambientes: 3, entradaVinculadaId: 'v-1030', ocorrencias: [],
    ultima: { tipo: 'Entrada', data: '2026-11-12T12:00:00', assessor: 'Carla Dias', sinalizada: false },
  },
];

const TIPOS: TipoVistoria[] = [
  { id: 'entrada', nome: 'Entrada', descricao: 'Valida limpeza, organização, enxoval e funcionamento antes da chegada do hóspede.', respostas: ['OK', 'Problema', 'N/A'], itens: 32, ativo: true },
  { id: 'saida', nome: 'Saída', descricao: 'Compara o estado atual com a vistoria de entrada vinculada à estadia.', respostas: ['Igual', 'Danificado', 'Faltando', 'Com defeito'], itens: 32, ativo: true, exigeEntrada: true },
  { id: 'preventiva', nome: 'Manutenção preventiva', descricao: 'Verificações recorrentes de equipamentos e instalações, sem depender de estadia.', respostas: ['OK', 'Precisa intervenção', 'N/A'], itens: 18, ativo: true },
  { id: 'enxoval', nome: 'Conferência de enxoval', descricao: 'Processo personalizado: contagem de roupa de cama, banho e amenities.', respostas: ['OK', 'Problema', 'N/A'], itens: 12, ativo: true },
  { id: 'dedetizacao', nome: 'Dedetização', descricao: 'Tipo desativado pelo administrador.', respostas: [], itens: 0, ativo: false },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Simulações para testar estados da UI: ?simular=erro | vazio | lento */
function simulacao(): string | null {
  return new URLSearchParams(location.search).get('simular');
}

export async function listarUnidades(): Promise<Unidade[]> {
  const sim = simulacao();
  await wait(sim === 'lento' ? 2500 : 450);
  if (sim === 'erro') throw new Error('Falha ao carregar unidades');
  if (sim === 'vazio') return [];
  return UNIDADES;
}

/** undefined = não encontrada ou sem acesso (não diferenciar, para não revelar dados). */
export async function obterUnidade(id: string): Promise<Unidade | undefined> {
  await wait(300);
  return UNIDADES.find((u) => u.id === id);
}

/** Só tipos ativos aparecem para seleção. */
export async function listarTiposAtivos(): Promise<TipoVistoria[]> {
  await wait(300);
  return TIPOS.filter((t) => t.ativo);
}

/** Admin: todos os tipos, inclusive inativos. */
export async function listarTipos(): Promise<TipoVistoria[]> {
  await wait(200);
  return TIPOS.map((t) => ({ ...t }));
}
