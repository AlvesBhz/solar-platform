// MOCKUP do servidor (futuro RPC/Edge Function no Supabase). As regras ficam aqui, fora das telas,
// porque na versão real o cliente NÃO é fonte de verdade (RNF-05).

export type ResultadoValidacao = {
  ok: boolean;
  motivo?: string;
  distanciaM?: number;
  precisaoM?: number;
  raioM?: number;
  em: string;
};

const PRECISAO_MAX_M = 50;
const RAIO_M: Record<string, number> = { 'quarto-101': 25, 'quarto-102': 25, 'suite-201': 25 };
const QR_SEGREDO_VIGENTE = 'k2';
const QR_SEGREDO_ANTIGO = 'k1';

const eventos: unknown[] = [];
/** Auditoria (eventos_log): toda tentativa é registrada, com sucesso ou falha. */
export function registrarEvento(acao: string, payload: Record<string, unknown>) {
  const ev = { acao, payload, criado_em: new Date().toISOString() };
  eventos.push(ev);
  console.info('[auditoria mock]', ev);
}

/** Distância em metros entre dois pontos (fórmula de Haversine). */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sim = () => new URLSearchParams(location.search).get('simular');

/**
 * Valida GPS. MOCK: como você não está no chalé, o "cadastro" da unidade é posicionado a ~18 m
 * da sua posição real. Teste falhas com ?simular=fora (240 m) ou ?simular=precisao (85 m).
 */
export async function validarGps(unidadeId: string, pos: GeolocationCoordinates): Promise<ResultadoValidacao> {
  await wait(600);
  const raioM = RAIO_M[unidadeId] ?? 40;
  const deslocM = sim() === 'fora' ? 240 : 18;
  const centroLat = pos.latitude + deslocM / 111320;
  const distanciaM = Math.round(haversine(pos.latitude, pos.longitude, centroLat, pos.longitude));
  const precisaoM = Math.round(sim() === 'precisao' ? 85 : Math.min(pos.accuracy, 12));

  let motivo: string | undefined;
  if (precisaoM > PRECISAO_MAX_M) motivo = `Precisão de ${precisaoM} m (limite ${PRECISAO_MAX_M} m). Vá para um local aberto e tente de novo.`;
  else if (distanciaM > raioM) motivo = `Você está a ${distanciaM} m da unidade (raio permitido ${raioM} m).`;

  const r = { ok: !motivo, motivo, distanciaM, precisaoM, raioM, em: new Date().toISOString() };
  registrarEvento('presenca_gps', { unidadeId, ...r, lat: pos.latitude, lng: pos.longitude });
  return r;
}

/** Conteúdo esperado do QR: SOLAR:<unidadeId>:<segredo>. */
export function qrDaUnidade(unidadeId: string, segredo = QR_SEGREDO_VIGENTE) {
  return `SOLAR:${unidadeId}:${segredo}`;
}
export const QR_EXPIRADO = (unidadeId: string) => qrDaUnidade(unidadeId, QR_SEGREDO_ANTIGO);

export async function validarQr(unidadeId: string, conteudo: string): Promise<ResultadoValidacao> {
  await wait(500);
  const [prefixo, id, segredo] = conteudo.trim().split(':');
  let motivo: string | undefined;
  if (prefixo !== 'SOLAR' || !id || !segredo) motivo = 'Código inválido. Use o QR Code fixado na unidade.';
  else if (id !== unidadeId) motivo = 'Este QR Code pertence a outra unidade.';
  else if (segredo !== QR_SEGREDO_VIGENTE) motivo = 'QR Code expirado. Peça ao gestor o código atualizado.';

  const r = { ok: !motivo, motivo, em: new Date().toISOString() };
  registrarEvento('presenca_qr', { unidadeId, ...r });
  return r;
}
