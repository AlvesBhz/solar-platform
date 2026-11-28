import { Icon } from '@iconify/react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { GravidadeTag } from '../components/Status';
import { uidAtual } from '../lib/acesso';
import { atrasada, emAberto, listarOcorrencias, tratarOcorrencia, type OcorrenciaG } from '../lib/gestao';

const ORD = { critica: 0, media: 1, baixa: 2 };
const dia = (d: string) => new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

function useOcorrencias() {
  const [l, setL] = useState<OcorrenciaG[] | null>(null);
  const [erro, setErro] = useState(false);
  const carregar = useCallback(() => { setErro(false); listarOcorrencias().then(setL).catch(() => setErro(true)); }, []);
  useEffect(carregar, [carregar]);
  return { l, erro, carregar };
}

/** T36 — Ocorrências (equipe de manutenção): as em aberto das minhas pousadas; as atribuídas a mim primeiro, depois atrasadas e críticas. */
export function T36Ocorrencias() {
  const { l, erro, carregar } = useOcorrencias();
  const eu = uidAtual();
  const abertas = (l ?? []).filter(emAberto).sort((a, b) =>
    Number(b.responsavelId === eu) - Number(a.responsavelId === eu) || Number(atrasada(b)) - Number(atrasada(a)) || ORD[a.gravidade] - ORD[b.gravidade] || (a.prazo ?? '9').localeCompare(b.prazo ?? '9'));
  const minhas = abertas.filter((o) => o.responsavelId === eu).length;
  const resolvida = (useLocation().state as { aviso?: string } | null)?.aviso === 'resolvida';
  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back="/app/unidades" eyebrow="Manutenção" title="Ocorrências" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        {resolvida && <p role="status" className="rounded-md border border-line-1 bg-white p-3 text-[0.8125rem] text-available">Ocorrência resolvida. A gestão confere e libera a unidade.</p>}
        {erro ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-error bg-white p-4 text-[0.8125rem] text-error">
            Não foi possível carregar as ocorrências. Verifique a conexão.
            <button type="button" className={`${btnSecondary} w-auto`} onClick={carregar}>Tentar de novo</button>
          </div>
        ) : !l ? (
          <div className="h-40 animate-pulse rounded-xl border border-line-1 bg-white" aria-busy="true" />
        ) : abertas.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-line-1 bg-white p-4 text-sm text-fg-2">
            <Icon icon="solar:check-circle-linear" width={20} className="text-available" aria-hidden="true" /> Nenhuma ocorrência em aberto.
          </p>
        ) : (
          <>
            <p className="text-[0.8125rem] text-fg-2">{abertas.length} em aberto{minhas ? ` · ${minhas} com você` : ''}</p>
            <ul className="flex flex-col gap-2">
              {abertas.map((o) => (
                <li key={o.id}>
                  <Link to={`/app/ocorrencias/${o.id}`} className={`flex flex-col gap-1.5 rounded-xl border bg-white p-4 shadow-sm ${o.gravidade === 'critica' || atrasada(o) ? 'border-error' : 'border-line-1'}`}>
                    <span className="flex flex-wrap items-center gap-2">
                      <GravidadeTag g={o.gravidade} />
                      {o.responsavelId === eu && <span className="inline-flex items-center gap-1 rounded-full bg-pine px-2 py-0.5 text-[0.6875rem] font-medium text-white"><Icon icon="solar:user-rounded-linear" width={12} aria-hidden="true" />Com você</span>}
                    </span>
                    <span className="text-[0.9375rem] font-medium text-fg-1">{o.descricao}</span>
                    <span className="text-[0.75rem] text-fg-3">{o.unidade} · {o.ambiente} · {o.item}</span>
                    <span className="flex flex-wrap gap-x-3 text-[0.75rem] text-fg-2">
                      {o.prazo && <span className={atrasada(o) ? 'font-medium text-error' : ''}>{atrasada(o) ? 'Atrasada desde' : 'Prazo'} {dia(o.prazo)}</span>}
                      {o.responsavel && o.responsavelId !== eu && <span>Com {o.responsavel}</span>}
                      {o.status === 'em_tratamento' && <span className="text-pine">Em tratamento</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}

/** T37 — Tratar ocorrência (manutenção): registrar andamento ou marcar como resolvida. Liberar a unidade fica com a gestão. */
export function T37TratarOcorrencia() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { l, erro, carregar } = useOcorrencias();
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);
  const o = l?.find((x) => x.id === id);
  if (l && !o) return <Navigate to="/app/ocorrencias" replace />;

  async function fazer(status: 'em_tratamento' | 'resolvida') {
    setOcupado(true); setMsg(null);
    const r = await tratarOcorrencia(id, status, texto);
    setOcupado(false);
    if (!r.ok) return setMsg({ t: r.erro, erro: true });
    setTexto('');
    if (status === 'resolvida') return navigate('/app/ocorrencias', { replace: true, state: { aviso: 'resolvida' } });
    setMsg({ t: 'Andamento registrado.' }); carregar();
  }
  const aberta = !!o && emAberto(o);
  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back="/app/ocorrencias" eyebrow={o ? `${o.unidade} · ${o.ambiente}` : 'Ocorrência'} title={o?.item ?? 'Ocorrência'} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        {erro && <p role="alert" className="text-sm text-error">Não foi possível carregar. Verifique a conexão.</p>}
        {!o ? <div className="h-40 animate-pulse rounded-xl border border-line-1 bg-white" aria-busy="true" /> : (
          <>
            <section className="flex flex-col gap-2 rounded-xl border border-line-1 bg-white p-4">
              <GravidadeTag g={o.gravidade} />
              <h1 className="text-[1.0625rem] font-medium text-fg-1">{o.descricao}</h1>
              <p className="text-[0.75rem] text-fg-3">
                {o.responsavel ? `Responsável: ${o.responsavel}` : 'Sem responsável'}{o.prazo ? ` · ${atrasada(o) ? 'atrasada desde' : 'prazo'} ${dia(o.prazo)}` : ''}
              </p>
              {o.gravidade === 'critica' && <p className="text-[0.75rem] text-fg-2">A unidade está fora da venda. Depois de resolver, a gestão confere e libera.</p>}
            </section>
            {msg && <p role={msg.erro ? 'alert' : 'status'} className={`rounded-md border bg-white p-3 text-[0.8125rem] ${msg.erro ? 'border-error text-error' : 'border-line-1 text-available'}`}>{msg.t}</p>}
            <section className="flex flex-col gap-2">
              <h2 className="ui-secao">Histórico</h2>
              <ol className="flex flex-col gap-3 rounded-xl border border-line-1 bg-white p-4">
                {o.historico.map((h, i) => (
                  <li key={i} className="flex gap-3 text-[0.8125rem]"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-pine" /><div className="min-w-0"><p className="text-fg-1 [overflow-wrap:anywhere]">{h.texto}</p>{h.quando && <p className="text-[0.75rem] text-fg-3">{h.quando}</p>}</div></li>
                ))}
              </ol>
            </section>
            {aberta && (
              <label className="ui-rotulo">O que foi feito
                <textarea rows={3} maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: troquei o reparo da torneira"
                  className="rounded-md border border-line-2 bg-white p-3 text-[0.875rem] normal-case tracking-normal text-fg-1 focus:border-pine focus:outline-none" aria-label="O que foi feito" />
              </label>
            )}
          </>
        )}
      </main>
      {aberta && (
        <BottomBar>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" className={btnSecondary} disabled={ocupado || texto.trim().length < 3} onClick={() => fazer('em_tratamento')}>Registrar andamento</button>
            <button type="button" className={btnPrimary} disabled={ocupado} onClick={() => fazer('resolvida')}>
              <Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" />Resolvida
            </button>
          </div>
        </BottomBar>
      )}
    </div>
  );
}
