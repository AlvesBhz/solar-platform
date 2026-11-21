import { Icon } from '@iconify/react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Seletor } from '../components/Filtros';
import GestaoShell, { card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { VALIDACOES, listarPropriedades, salvarConfigPropriedade, validarPresenca, type Propriedade } from '../lib/admin';
import { usePerfilPermitido } from '../lib/useAdmin';

const rotuloValidacao = (v: string) => VALIDACOES.find((x) => x.valor === v)?.label ?? v;
const campo = 'min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-[0.875rem] text-fg-1 focus:border-pine focus:outline-none';
const rot = 'flex flex-col gap-1.5 text-[0.75rem] uppercase tracking-[0.06em] text-fg-2';

/** T28 — Pousadas: as do site (o app não cria nem apaga), com a configuração de presença de cada uma. */
export function T28Propriedades() {
  const perfil = usePerfilPermitido(['ADMIN']);
  const [ps, setPs] = useState<Propriedade[] | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => { if (perfil) listarPropriedades().then(setPs).catch(() => setErro('Não foi possível carregar as pousadas.')); }, [perfil]);
  if (!perfil) return null;
  return (
    <GestaoShell eyebrow="Administração" titulo="Pousadas">
      <p className="text-[0.8125rem] text-fg-3">As pousadas e os chalés são cadastrados no site. Aqui você define como a presença do assessor é validada em cada uma.</p>
      {erro && <p role="alert" className="text-sm text-error">{erro}</p>}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3">
        {(ps ?? []).map((p) => (
          <li key={p.id_propriedade} className={`${card} flex flex-col gap-3 p-4`}>
            <div><p className="text-[0.9375rem] font-medium text-fg-1">{p.nm_propriedade}</p><p className="text-[0.75rem] text-fg-3">{p.qtde_unidades} {p.qtde_unidades === 1 ? 'chalé' : 'chalés'}</p></div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.75rem]">
              <dt className="text-fg-3">Validação</dt><dd className="text-fg-1">{rotuloValidacao(p.tp_validacao)}</dd>
              <dt className="text-fg-3">Ponto de GPS</dt><dd className={p.vl_latitude === null ? 'text-warning' : 'text-fg-1'}>{p.vl_latitude === null ? 'não definido' : `${p.vl_latitude}, ${p.vl_longitude}`}</dd>
              <dt className="text-fg-3">Raio</dt><dd className="text-fg-1">{p.qtde_raio_metros} m</dd>
              <dt className="text-fg-3">Tempo mínimo</dt><dd className="text-fg-1">{p.qtde_minutos_min_vistoria} min</dd>
            </dl>
            <Link to={`/admin/propriedades/${p.id_propriedade}`} className="min-h-11 self-start text-[0.75rem] leading-[2.75rem] text-pine underline underline-offset-4">Configurar presença</Link>
          </li>
        ))}
      </ul>
      {ps && ps.length === 0 && <p className="text-sm text-fg-3">Nenhuma pousada visível para o seu usuário.</p>}
    </GestaoShell>
  );
}

/** T29 — Configuração da pousada: validação padrão, ponto de GPS, raio, precisão e tempo mínimo (VST_PROPRIEDADE). Só ADMIN. */
export function T29FormPropriedade() {
  const perfil = usePerfilPermitido(['ADMIN']);
  const navigate = useNavigate();
  const { id } = useParams();
  const [p, setP] = useState<Propriedade | null>(null);
  const [f, setF] = useState({ tp_validacao: 'QR_E_GPS' as Propriedade['tp_validacao'], lat: '', lng: '', raio: '100', precisao: '50', minutos: '10' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (!perfil) return;
    listarPropriedades().then((ps) => {
      const x = ps.find((q) => String(q.id_propriedade) === id);
      if (!x) return setErro('Pousada não encontrada ou sem acesso.');
      setP(x);
      setF({ tp_validacao: x.tp_validacao, lat: x.vl_latitude?.toString() ?? '', lng: x.vl_longitude?.toString() ?? '', raio: String(x.qtde_raio_metros), precisao: String(x.qtde_precisao_max_metros), minutos: String(x.qtde_minutos_min_vistoria) });
    }).catch(() => setErro('Não foi possível carregar a pousada.'));
  }, [perfil, id]);
  if (!perfil) return null;

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  const cfg = { tp_validacao: f.tp_validacao, vl_latitude: num(f.lat), vl_longitude: num(f.lng), qtde_raio_metros: Number(f.raio), qtde_precisao_max_metros: Number(f.precisao), qtde_minutos_min_vistoria: Number(f.minutos) };
  const erros = validarPresenca(cfg);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  function usarPosicao() {
    navigator.geolocation?.getCurrentPosition((pos) => setF((x) => ({ ...x, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })), () => setErro('Não foi possível obter a sua posição.'), { enableHighAccuracy: true, timeout: 15000 });
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!p || erros.length) return;
    setSalvando(true); setErro('');
    const r = await salvarConfigPropriedade(p.id_propriedade, cfg as Parameters<typeof salvarConfigPropriedade>[1]);
    setSalvando(false);
    if (!r.ok) return setErro(r.erro);
    navigate('/admin/propriedades');
  }
  return (
    <GestaoShell eyebrow="Administração" titulo={p ? `Presença · ${p.nm_propriedade}` : 'Presença da pousada'}>
      {erro && <p role="alert" className="text-sm text-error">{erro}</p>}
      {p && (
        <form className={`${card} grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4 p-5 sm:grid-cols-2`} onSubmit={salvar} noValidate>
          <div className="sm:col-span-2"><Seletor rotulo="Validação padrão" valor={f.tp_validacao} onChange={(v) => setF({ ...f, tp_validacao: v })} opcoes={VALIDACOES} /></div>
          <label className={rot}>Latitude<input id="p-lat" inputMode="decimal" className={campo} value={f.lat} onChange={set('lat')} placeholder="-19.084700" /></label>
          <label className={rot}>Longitude<input id="p-lng" inputMode="decimal" className={campo} value={f.lng} onChange={set('lng')} placeholder="-43.596700" /></label>
          <button type="button" className={`${btnSecondary} w-auto sm:col-span-2 sm:justify-self-start`} onClick={usarPosicao}><Icon icon="solar:map-point-linear" width={18} aria-hidden="true" />Usar minha posição atual</button>
          <label className={rot}>Raio aceito (m)<input id="p-raio" inputMode="numeric" className={campo} value={f.raio} onChange={set('raio')} /></label>
          <label className={rot}>Pior precisão de GPS aceita (m)<input id="p-precisao" inputMode="numeric" className={campo} value={f.precisao} onChange={set('precisao')} /></label>
          <label className={rot}>Tempo mínimo de vistoria (min)<input id="p-minutos" inputMode="numeric" className={campo} value={f.minutos} onChange={set('minutos')} /></label>
          {erros.length > 0 && <ul className="flex flex-col gap-1 text-[0.8125rem] text-warning sm:col-span-2" role="alert">{erros.map((x) => <li key={x} className="flex items-center gap-1.5"><Icon icon="solar:danger-circle-linear" width={16} aria-hidden="true" />{x}</li>)}</ul>}
          <p className="text-[0.75rem] text-fg-3 sm:col-span-2">Chalés sem configuração própria herdam estes valores (ajuste por chalé na tela Presença).</p>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="button" className={`${btnSecondary} w-auto`} onClick={() => navigate('/admin/propriedades')}>Cancelar</button>
            <button type="submit" className={`${btnPrimary} w-auto`} disabled={erros.length > 0 || salvando}>{salvando ? 'Salvando…' : 'Salvar configuração'}</button>
          </div>
        </form>
      )}
    </GestaoShell>
  );
}
