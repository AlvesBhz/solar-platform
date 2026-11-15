import { Icon } from '@iconify/react';
import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QR_EXPIRADO, qrDaUnidade, validarQr } from '../mocks/servidor';
import { lerRascunho, salvarRascunho } from '../mocks/vistoria';

type Estado = 'iniciando' | 'lendo' | 'validando' | 'erro_camera' | 'rejeitado';

/** T09 — Leitor QR: câmera ao vivo, enquadramento e erro. A validação acontece no servidor. */
export default function T09LeitorQr() {
  const { unidadeId = '' } = useParams();
  const navigate = useNavigate();
  const voltar = `/app/vistorias/nova/${unidadeId}/presenca`;
  const scanner = useRef<Html5Qrcode | null>(null);
  const [estado, setEstado] = useState<Estado>('iniciando');
  const [msg, setMsg] = useState('');
  const [tentativa, setTentativa] = useState(0);

  async function parar() {
    const s = scanner.current;
    scanner.current = null;
    try { if (s?.isScanning) await s.stop(); s?.clear(); } catch { /* já parado */ }
  }

  async function processar(conteudo: string) {
    await parar();
    setEstado('validando');
    const r = await validarQr(unidadeId, conteudo);
    const rasc = lerRascunho(unidadeId);
    if (rasc) salvarRascunho({ ...rasc, presenca: { ...rasc.presenca, qr: r } });
    if (r.ok) navigate(voltar, { replace: true });
    else { setMsg(r.motivo ?? 'Código rejeitado.'); setEstado('rejeitado'); }
  }

  useEffect(() => {
    let ativo = true;
    if (!window.isSecureContext) {
      setMsg('A câmera só funciona em conexão segura (HTTPS).');
      setEstado('erro_camera');
      return;
    }
    const s = new Html5Qrcode('qr-leitor', { verbose: false });
    scanner.current = s;
    setEstado('iniciando');
    s.start({ facingMode: 'environment' }, { fps: 10 }, (txt) => { if (ativo) processar(txt); }, () => {})
      .then(() => ativo && setEstado('lendo'))
      .catch((e: unknown) => {
        if (!ativo) return;
        const nome = String((e as { name?: string })?.name ?? e);
        setMsg(nome.includes('NotAllowed') ? 'Permissão da câmera negada. Libere a câmera nas configurações do navegador.' : 'Nenhuma câmera disponível neste aparelho.');
        setEstado('erro_camera');
      });
    return () => { ativo = false; parar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa]);

  return (
    <div className="screen on-dark relative flex flex-col overflow-hidden bg-pine-deep text-white">
      {/* Câmera */}
      {/* html5-qrcode força position:relative no elemento; por isso o posicionamento fica no invólucro */}
      <div className="absolute inset-0" aria-hidden="true">
        <div id="qr-leitor" className="qr-area h-full w-full" />
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(var(--scrim-top), transparent 30%, transparent 65%, var(--scrim-bottom))' }} />

      <header className="relative z-10 flex items-center gap-3 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button
          type="button"
          onClick={() => navigate(voltar)}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-white hover:bg-white/10"
          aria-label="Fechar leitor"
        >
          <Icon icon="solar:close-circle-linear" width={24} aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-col">
          <span className="text-[0.625rem] uppercase tracking-[0.24em] text-white/70">Presença</span>
          <span className="text-[0.9375rem] font-medium">Leitor de QR Code</span>
        </div>
      </header>

      {/* Enquadramento */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-6">
        <div className="relative aspect-square w-[min(72vw,16rem,52svh)]" aria-hidden="true">
          {['left-0 top-0 border-l-2 border-t-2 rounded-tl-xl', 'right-0 top-0 border-r-2 border-t-2 rounded-tr-xl', 'left-0 bottom-0 border-l-2 border-b-2 rounded-bl-xl', 'right-0 bottom-0 border-r-2 border-b-2 rounded-br-xl'].map((c) => (
            <span key={c} className={`absolute h-10 w-10 ${estado === 'rejeitado' ? 'border-white/40' : 'border-white'} ${c}`} />
          ))}
          {estado === 'validando' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
            </span>
          )}
        </div>
        <p className="text-center text-[0.8125rem] text-white/80" role="status" aria-live="polite">
          {estado === 'iniciando' && 'Abrindo a câmera…'}
          {estado === 'lendo' && 'Aponte para o QR Code fixado na unidade'}
          {estado === 'validando' && 'Validando código…'}
        </p>
      </div>

      {/* Painel inferior: erro ou simulação */}
      <div className="relative z-10 flex flex-col gap-3 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {(estado === 'erro_camera' || estado === 'rejeitado') && (
          <div className="flex flex-col gap-3 rounded-xl border border-white/15 bg-pine-deep p-4" role="alert">
            <p className="flex items-start gap-2 text-[0.8125rem]">
              <Icon icon="solar:danger-circle-linear" width={18} className="mt-px shrink-0" aria-hidden="true" />
              {msg}
            </p>
            <button
              type="button"
              onClick={() => setTentativa((n) => n + 1)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-xs font-semibold uppercase tracking-[0.1em] text-pine-deep transition-colors duration-base hover:bg-cream"
            >
              <Icon icon="solar:refresh-linear" width={18} aria-hidden="true" /> Ler novamente
            </button>
          </div>
        )}

        {estado !== 'validando' && (
          <details className="rounded-xl border border-white/15 bg-pine-deep text-[0.75rem] text-white/80">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4">
              <Icon icon="solar:info-circle-linear" width={16} aria-hidden="true" /> Mockup · simular leitura
            </summary>
            <div className="grid grid-cols-1 gap-2 px-4 pb-4 min-[360px]:grid-cols-3">
              {[
                { l: 'Válido', v: qrDaUnidade(unidadeId) },
                { l: 'Outra unidade', v: qrDaUnidade('chale-outro') },
                { l: 'Expirado', v: QR_EXPIRADO(unidadeId) },
              ].map((b) => (
                <button key={b.l} type="button" onClick={() => processar(b.v)} className="min-h-11 rounded-md border border-white/20 px-2 hover:bg-white/10">
                  {b.l}
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
