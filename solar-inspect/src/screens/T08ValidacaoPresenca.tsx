import { Icon } from '@iconify/react';
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { btnSecondary } from '../components/ScreenShell';
import { VALIDACAO } from '../components/Status';
import { POSICAO_SIMULADA, SIMULADO } from '../lib/sim';
import { iniciarNoServidor, obterUnidade, precisaoMaxima, validarGps, type ResultadoValidacao, type UnidadeCampo } from '../lib/campo';
import { descartarRascunho, lerRascunho, salvarRascunho, type Rascunho } from '../mocks/vistoria';

/** T08 — Validação de presença: GPS, QR ou ambos. O checklist só é liberado após sucesso (CA-02). */
export default function T08ValidacaoPresenca() {
  const { unidadeId = '' } = useParams();
  const navigate = useNavigate();
  const [u, setU] = useState<UnidadeCampo | null | undefined>(null);
  const [erroInicio, setErroInicio] = useState<{ msg: string; fatal: boolean } | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [rasc, setRasc] = useState<Rascunho | null>(() => lerRascunho(unidadeId));
  const [lendoGps, setLendoGps] = useState(false);

  const iniciou = useRef(false);

  useEffect(() => { obterUnidade(unidadeId).then(setU); }, [unidadeId]);

  const precisaGps = u?.validacao !== 'qr';
  const precisaQr = u?.validacao !== 'gps';
  const gps = rasc?.presenca.gps;
  const qr = rasc?.presenca.qr;
  // GPS reprovado não impede (o banco só sinaliza), mas exige que o vistoriador assuma; QR errado impede.
  const aprovado = !!u && !!rasc && (!precisaGps || !!gps?.ok || !!gps?.aceito) && (!precisaQr || !!qr?.ok);

  // Ao abrir a tela, a localização já é verificada (o navegador pede a permissão aqui, durante a vistoria).
  useEffect(() => {
    if (u && rasc && precisaGps && !gps && !iniciou.current) { iniciou.current = true; verificarGps(); }
  }, [u]); // eslint-disable-line react-hooks/exhaustive-deps

  // Presença completa (GPS e/ou QR conforme a unidade): segue sozinho para o checklist.
  useEffect(() => {
    if (!aprovado) return;
    // Vistoria já iniciada (ex.: botão Voltar do navegador a partir do checklist): sai em vez de reabrir o checklist.
    if (rasc?.inicio) { navigate(`/app/unidades/${unidadeId}`, { replace: true }); return; }
    const t = setTimeout(iniciarChecklist, 1100);
    return () => clearTimeout(t);
  }, [aprovado]); // eslint-disable-line react-hooks/exhaustive-deps

  if (u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;
  if (!rasc) return <Navigate to={`/app/vistorias/nova/${unidadeId}`} replace />; // sem tipo escolhido

  function atualizar(parcial: Partial<Rascunho['presenca']>) {
    setRasc((r) => salvarRascunho({ ...r!, presenca: { ...r!.presenca, ...parcial } }));
  }

  function verificarGps() {
    setLendoGps(true);
    const falha = (motivo: string) => { atualizar({ gps: { ok: false, motivo, em: new Date().toISOString() } }); setLendoGps(false); };
    if (SIMULADO) { validarGps(unidadeId, POSICAO_SIMULADA).then((gps) => { atualizar({ gps }); setLendoGps(false); }); return; }
    if (!('geolocation' in navigator)) return falha('GPS indisponível neste aparelho.');
    // Leitura única, alta precisão, 15 s (sem acompanhamento em segundo plano).
    navigator.geolocation.getCurrentPosition(
      async (p) => { atualizar({ gps: await validarGps(unidadeId, p.coords) }); setLendoGps(false); },
      (e) => falha(e.code === e.PERMISSION_DENIED ? 'Permissão de localização negada.' : 'Não foi possível obter a posição em 15 segundos.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  // Assume a vistoria no servidor (cria a avulsa e inicia). Sem internet, segue e o envio faz isso depois.
  async function iniciarChecklist() {
    setErroInicio(null);
    setIniciando(true);
    const r = salvarRascunho({ ...rasc!, inicio: rasc!.inicio ?? new Date().toISOString() });
    const res = await iniciarNoServidor(r);
    setIniciando(false);
    if (!res.ok) {
      const fatal = ['vistoria_nao_agendada', 'vistoria_de_outro_usuario', 'perfil_sem_permissao', 'tipo_inexistente', 'sem_acesso', 'vistoria_inexistente'].includes(res.codigo ?? '');
      // não começou: volta a não ter início; QR recusado precisa ser lido de novo
      setRasc(salvarRascunho({ ...r, inicio: undefined, presenca: res.codigo === 'qr_invalido' ? { ...r.presenca, qr: { ok: false, motivo: res.erro, em: new Date().toISOString() } } : r.presenca }));
      setErroInicio({ msg: res.erro, fatal });
      return;
    }
    salvarRascunho({ ...r, iniciada: r.iniciada || !res.adiado });
    navigate(`/app/vistorias/nova/${unidadeId}/checklist`, { replace: true });
  }

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back={`/app/vistorias/nova/${unidadeId}`} eyebrow={u?.nome ?? 'Nova vistoria'} title="Validação de presença" />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Presença</span>
          <h1 className="screen-title">Confirme que você está na unidade</h1>
          {u && (
            <p className="flex items-center gap-1.5 text-[0.8125rem] text-fg-2">
              <Icon icon={VALIDACAO[u.validacao].icon} width={16} className="text-pine" aria-hidden="true" />
              Exigido nesta unidade: <strong className="font-medium text-fg-1">{VALIDACAO[u.validacao].label}</strong>
            </p>
          )}
        </div>

        {!u ? (
          <div className="h-40 animate-pulse rounded-xl border border-line-1 bg-white" aria-busy="true" />
        ) : (
          <ol className="flex flex-col gap-3">
            {precisaGps && (
              <Etapa icon="solar:gps-linear" titulo="Localização (GPS)" r={gps} carregando={lendoGps}>
                {gps?.distanciaM !== undefined && (
                  <dl className="grid grid-cols-2 gap-2 text-[0.75rem]">
                    <Medida label="Distância" valor={`${gps.distanciaM} m`} limite={`raio ${gps.raioM} m`} ok={gps.distanciaM <= (gps.raioM ?? 0)} />
                    <Medida label="Precisão" valor={`${gps.precisaoM} m`} limite={`limite ${precisaoMaxima(u)} m`} ok={(gps.precisaoM ?? 999) <= precisaoMaxima(u)} />
                  </dl>
                )}
                {!gps?.ok && (
                  <button type="button" className={btnSecondary} onClick={verificarGps} disabled={lendoGps}>
                    <Icon icon={gps ? 'solar:refresh-linear' : 'solar:gps-linear'} width={18} aria-hidden="true" />
                    {lendoGps ? 'Obtendo posição' : gps ? 'Tentar novamente' : 'Verificar localização'}
                  </button>
                )}
                {gps && !gps.ok && !gps.aceito && !lendoGps && (
                  <button type="button" className="min-h-11 text-center text-[0.8125rem] text-fg-2 underline underline-offset-4" onClick={() => atualizar({ gps: { ...gps, aceito: true } })}>
                    Continuar mesmo assim (a vistoria vai sinalizada para a gestão)
                  </button>
                )}
                {gps?.aceito && <p className="text-[0.75rem] text-warning">Você seguiu sem a localização aprovada: a vistoria será sinalizada.</p>}
                {gps?.motivo?.startsWith('Permissão') && (
                  <Link to="/permissao-localizacao" className="text-center text-[0.75rem] text-pine underline underline-offset-4">Revisar permissão de localização</Link>
                )}
              </Etapa>
            )}
            {precisaQr && (
              <Etapa icon="solar:qr-code-linear" titulo="QR Code da unidade" r={qr}>
                {!qr?.ok && (
                  <button type="button" className={btnSecondary} onClick={() => navigate(`/app/vistorias/nova/${unidadeId}/qr`)}>
                    <Icon icon="solar:camera-linear" width={18} aria-hidden="true" /> {qr ? 'Ler novamente' : 'Ler QR Code'}
                  </button>
                )}
              </Etapa>
            )}
          </ol>
        )}

        {erroInicio && (
          <div role="alert" className="flex flex-col gap-3 rounded-xl border border-error bg-white p-4 text-[0.8125rem] text-error">
            <p className="flex items-start gap-2"><Icon icon="solar:danger-circle-linear" width={18} className="mt-px shrink-0" aria-hidden="true" />{erroInicio.msg}</p>
            {!erroInicio.fatal && aprovado && (
              <button type="button" className={btnSecondary} disabled={iniciando} onClick={iniciarChecklist}>Tentar de novo</button>
            )}
            {erroInicio.fatal && (
              <button type="button" className={btnSecondary} onClick={() => { descartarRascunho(); navigate(`/app/vistorias/nova/${unidadeId}`, { replace: true }); }}>
                Escolher outra vistoria
              </button>
            )}
          </div>
        )}

        <p className="flex items-start gap-2 text-[0.75rem] text-fg-3">
          <Icon icon="solar:shield-check-linear" width={16} className="mt-px shrink-0" aria-hidden="true" />
          Cada tentativa é registrada para auditoria, com horário, posição e precisão.
        </p>
      </main>

      <BottomBar>
        {aprovado && !erroInicio ? (
          <p className="flex items-center justify-center gap-2 py-1 text-[0.8125rem] font-medium text-available" role="status">
            <Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" /> {iniciando ? 'Registrando o início no servidor…' : 'Presença validada · abrindo o checklist'}
          </p>
        ) : (
          <p className="py-1 text-center text-[0.75rem] text-fg-3">O checklist abre automaticamente quando a presença for validada.</p>
        )}
      </BottomBar>
    </div>
  );
}

function Etapa({ icon, titulo, r, carregando, children }: { icon: string; titulo: string; r?: ResultadoValidacao; carregando?: boolean; children?: React.ReactNode }) {
  const st = carregando
    ? { txt: 'Verificando…', cls: 'text-fg-3', ic: 'solar:clock-circle-linear', borda: 'border-line-1' }
    : !r
      ? { txt: 'Pendente', cls: 'text-fg-3', ic: 'solar:clock-circle-linear', borda: 'border-line-1' }
      : r.ok
        ? { txt: 'Aprovado', cls: 'text-available', ic: 'solar:check-circle-linear', borda: 'border-available' }
        : { txt: 'Não aprovado', cls: 'text-error', ic: 'solar:close-circle-linear', borda: 'border-error' };
  return (
    <li className={`flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm ${st.borda}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-pine">
          <Icon icon={icon} width={20} aria-hidden="true" />
        </span>
        <span className="flex-1 text-[0.9375rem] font-medium text-fg-1">{titulo}</span>
        <span className={`inline-flex items-center gap-1 text-[0.75rem] font-medium ${st.cls}`} role="status">
          <Icon icon={st.ic} width={16} aria-hidden="true" /> {st.txt}
        </span>
      </div>
      {r && !r.ok && !carregando && <p className="text-[0.8125rem] text-error" role="alert">{r.motivo}</p>}
      {children}
    </li>
  );
}

function Medida({ label, valor, limite, ok }: { label: string; valor: string; limite: string; ok: boolean }) {
  return (
    <div className="rounded-md bg-cream p-2.5">
      <dt className="text-[0.625rem] uppercase tracking-[0.08em] text-fg-3">{label}</dt>
      <dd className={`font-mono text-[0.8125rem] font-medium ${ok ? 'text-fg-1' : 'text-error'}`}>{valor}</dd>
      <dd className="text-fg-3">{limite}</dd>
    </div>
  );
}
