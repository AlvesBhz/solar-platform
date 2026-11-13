import { Icon } from '@iconify/react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { comprimirComCarimbo, obterPosicao, uuid } from '../lib/imagem';
import { itemDa } from '../mocks/checklist';
import { salvarFoto } from '../mocks/fotos';
import { validarGps } from '../mocks/servidor';
import { obterUnidade, type Unidade } from '../mocks/unidades';
import { lerRascunho } from '../mocks/vistoria';

type Estado = 'iniciando' | 'camera' | 'processando' | 'previa' | 'sem_camera';
type Previa = { blob: Blob; url: string; em: Date; coords: GeolocationCoordinates | null; foraDoRaio?: boolean; gpsValidado: boolean };

/** T12 — Captura de evidência: câmera ao vivo, referência e prévia. Associa local e hora (carimbo + metadados). */
export default function T12CapturaEvidencia() {
  const { unidadeId = '', itemId = '' } = useParams();
  const navigate = useNavigate();
  const rasc = lerRascunho(unidadeId);
  const volta = `/app/vistorias/nova/${unidadeId}/item/${itemId}${rasc?.tipoId === 'saida' ? '/comparar' : ''}`;

  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);
  const [u, setU] = useState<Unidade | null | undefined>(null);
  const [estado, setEstado] = useState<Estado>('iniciando');
  const [sobrepor, setSobrepor] = useState(false);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => { obterUnidade(unidadeId).then(setU); }, [unidadeId]);

  const pararCamera = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };

  useEffect(() => {
    let ativo = true;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setEstado('sem_camera'); return; }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (!ativo) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); }
        setEstado('camera');
      })
      .catch(() => ativo && setEstado('sem_camera'));
    return () => { ativo = false; pararCamera(); };
  }, [tentativa]);

  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa.url); }, [previa]);

  if (u === undefined || !rasc?.inicio) return <Navigate to={`/app/vistorias/nova/${unidadeId}/presenca`} replace />;
  const ctx = u ? itemDa(u, itemId) : undefined;

  async function processar(fonte: CanvasImageSource, w: number, h: number) {
    setEstado('processando');
    const em = new Date();
    const coords = await obterPosicao();
    const usaGps = u!.validacao !== 'qr';
    // Revalida a posição em cada foto quando a unidade usa GPS (seção 5.2).
    const r = usaGps && coords ? await validarGps(unidadeId, coords) : null;
    const linhas = [
      `${u!.nome} · ${ctx?.ambiente.nome ?? ''} · ${ctx?.item.nome ?? ''}`,
      em.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }),
      coords ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} · ±${Math.round(coords.accuracy)} m` : 'Localização indisponível',
    ];
    const blob = await comprimirComCarimbo(fonte, w, h, linhas);
    setPrevia({ blob, url: URL.createObjectURL(blob), em, coords, foraDoRaio: r ? (r.distanciaM ?? 0) > (r.raioM ?? 0) : undefined, gpsValidado: !!r });
    setEstado('previa');
  }

  function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    processar(v, v.videoWidth, v.videoHeight);
  }

  function deArquivo(f?: File) {
    if (!f) return;
    const img = new Image();
    img.onload = () => { processar(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  }

  async function usarFoto() {
    if (!previa || !rasc) return;
    await salvarFoto({
      id: uuid(), rascunhoId: rasc.id, itemId, blob: previa.blob, em: previa.em.toISOString(),
      lat: previa.coords?.latitude, lng: previa.coords?.longitude, precisaoM: previa.coords ? Math.round(previa.coords.accuracy) : undefined,
      foraDoRaio: previa.foraDoRaio,
    });
    pararCamera();
    navigate(volta, { replace: true });
  }

  function refazer() {
    setPrevia(null);
    setEstado(stream.current ? 'camera' : 'sem_camera');
  }

  return (
    <div className="screen on-dark relative flex flex-col overflow-hidden bg-pine-deep text-white">
      {/* Câmera ao vivo (mantida montada para refazer sem reabrir) */}
      <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${estado === 'previa' ? 'invisible' : ''}`} aria-hidden="true" />
      {sobrepor && ctx?.ambiente.ref && estado === 'camera' && (
        <img src={ctx.ambiente.ref} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35" />
      )}
      {previa && <img src={previa.url} alt="Prévia da evidência com carimbo de data, hora e local" className="absolute inset-0 h-full w-full bg-pine-deep object-contain" />}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(var(--scrim-top), transparent 22%, transparent 70%, var(--scrim-bottom))' }} />

      <header className="relative z-10 flex items-center gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button type="button" onClick={() => { pararCamera(); navigate(volta); }} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10" aria-label="Fechar câmera">
          <Icon icon="solar:close-circle-linear" width={24} aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[0.625rem] uppercase tracking-[0.24em] text-white/70">{ctx ? `${ctx.ambiente.nome} · Evidência` : 'Evidência'}</span>
          <span className="truncate text-[0.9375rem] font-medium">{ctx?.item.nome ?? 'Captura'}</span>
        </div>
        {/* Miniatura da referência: toque para sobrepor ao enquadramento */}
        {ctx?.ambiente.ref && estado === 'camera' && (
          <button
            type="button"
            aria-pressed={sobrepor}
            onClick={() => setSobrepor((s) => !s)}
            className={`relative h-12 w-20 shrink-0 overflow-hidden rounded-md border-2 ${sobrepor ? 'border-white' : 'border-white/40'}`}
            aria-label={sobrepor ? 'Ocultar referência sobreposta' : 'Sobrepor foto de referência'}
          >
            <img src={ctx.ambiente.ref} alt="" width={80} height={48} className="h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 text-[0.5625rem] font-medium uppercase tracking-[0.08em]" style={{ background: 'var(--scrim-top)' }}>Ref.</span>
          </button>
        )}
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        {estado === 'iniciando' && <p className="text-[0.8125rem] text-white/80" role="status">Abrindo a câmera…</p>}
        {estado === 'processando' && (
          <p className="flex items-center gap-2 text-[0.8125rem] text-white/80" role="status">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/25 border-t-white" aria-hidden="true" /> Registrando local e hora…
          </p>
        )}
        {estado === 'sem_camera' && (
          <div className="flex max-w-xs flex-col items-center gap-3 text-center" role="alert">
            <Icon icon="solar:camera-linear" width={32} aria-hidden="true" />
            <p className="text-[0.8125rem] text-white/80">Não foi possível abrir a câmera aqui. Use a câmera do aparelho para tirar a foto agora.</p>
          </div>
        )}
      </div>

      <div className="relative z-10 flex flex-col gap-3 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {estado === 'previa' && previa && (
          <>
            <div className="flex flex-wrap gap-2 text-[0.6875rem]" role="status">
              <Chip icon="solar:clock-circle-linear" texto={previa.em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} />
              <Chip icon="solar:map-point-linear" texto={previa.coords ? `±${Math.round(previa.coords.accuracy)} m` : 'Sem localização'} alerta={!previa.coords} />
              {previa.gpsValidado && (
                <Chip icon={previa.foraDoRaio ? 'solar:shield-warning-linear' : 'solar:shield-check-linear'} texto={previa.foraDoRaio ? 'Fora do raio · será sinalizada' : 'Dentro do raio'} alerta={previa.foraDoRaio} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={refazer} className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/30 text-xs font-semibold uppercase tracking-[0.1em] hover:bg-white/10">
                <Icon icon="solar:refresh-linear" width={18} aria-hidden="true" /> Refazer
              </button>
              <button type="button" onClick={usarFoto} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-white text-xs font-semibold uppercase tracking-[0.1em] text-pine-deep hover:bg-cream">
                <Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" /> Usar foto
              </button>
            </div>
          </>
        )}

        {estado === 'camera' && (
          <div className="flex flex-col items-center gap-2">
            <button type="button" onClick={capturar} className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-4 border-white/70 transition-transform duration-fast active:scale-95" aria-label="Tirar foto">
              <span className="h-14 w-14 rounded-full bg-white" />
            </button>
            <span className="text-[0.6875rem] text-white/70">{sobrepor ? 'Alinhe com a referência sobreposta' : 'Toque na miniatura para sobrepor a referência'}</span>
          </div>
        )}

        {estado === 'sem_camera' && (
          <div className="flex flex-col gap-2">
            <input ref={arquivo} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => deArquivo(e.target.files?.[0])} />
            <button type="button" onClick={() => arquivo.current?.click()} className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-white text-xs font-semibold uppercase tracking-[0.1em] text-pine-deep hover:bg-cream">
              <Icon icon="solar:camera-linear" width={18} aria-hidden="true" /> Abrir câmera do aparelho
            </button>
            <button type="button" onClick={() => setTentativa((n) => n + 1)} className="min-h-11 text-[0.75rem] text-white/80 underline underline-offset-4">
              Tentar câmera ao vivo novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ icon, texto, alerta }: { icon: string; texto: string; alerta?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${alerta ? 'bg-warning-bg text-warning' : 'text-white'}`} style={alerta ? undefined : { background: 'var(--glass-bg-3)', border: '1px solid var(--glass-bd-2)' }}>
      <Icon icon={icon} width={14} aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}
