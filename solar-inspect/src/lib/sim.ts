// No link publicado o navegador bloqueia GPS e câmera: a posição é simulada.
export const SIMULADO = import.meta.env.MODE === 'artifact';
export const POSICAO_SIMULADA = { latitude: -19.10, longitude: -43.60, accuracy: 8 } as GeolocationCoordinates;
