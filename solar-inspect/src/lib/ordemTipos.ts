/** Ordem de exibição dos tipos de vistoria: Entrada, Saída, Limpeza, Rotina, Manutenção; os criados depois vêm em seguida. */
const ORDEM_TIPOS = ['ENTRADA', 'SAIDA', 'LIMPEZA', 'ROTINA', 'MANUTENCAO'];
export const posTipo = (cd: string) => { const i = ORDEM_TIPOS.indexOf(cd); return i < 0 ? ORDEM_TIPOS.length : i; };
