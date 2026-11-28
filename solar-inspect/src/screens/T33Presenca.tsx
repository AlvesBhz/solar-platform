import { Icon } from '@iconify/react';
import QRCode from 'qrcode';
import { FormEvent, useEffect, useState } from 'react';
import { Seletor } from '../components/Filtros';
import AvisoFixo from '../components/AvisoFixo';
import GestaoShell, { card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { VALIDACOES, listarPropriedades, listarUnidadesPresenca, qrDaUnidade, salvarPresencaUnidade, validarPresencaUnidade, type Herdavel, type Propriedade, type UnidadePresenca } from '../lib/admin';
import { usePerfilPermitido } from '../lib/useAdmin';

const campo = 'ui-campo';
const rot = 'ui-rotulo';
const OPCOES = [{ valor: 'HERDAR', label: 'Igual à pousada' }, ...VALIDACOES] as { valor: string; label: string }[];
const rotulo = (v: string) => VALIDACOES.find((x) => x.valor === v)?.label ?? v;
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/** T33 — Presença por chalé: validação, ponto de GPS, raio e andar (vazio herda da pousada) e QR da porta com rotação. Gestor e ADMIN. */
export function T33Presenca() {
  const perfil = usePerfilPermitido(['ADMIN', 'GESTOR']);
  const [us, setUs] = useState<UnidadePresenca[]>([]);
  const [ps, setPs] = useState<Propriedade[]>([]);
  const [ed, setEd] = useState<{ u: UnidadePresenca; tp: string; lat: string; lng: string; raio: string; andar: string } | null>(null);
  const [qr, setQr] = useState<{ u: UnidadePresenca; codigo: string; versao: number; img: string; confirmar: boolean } | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const carregar = () => Promise.all([listarUnidadesPresenca(), listarPropriedades()]).then(([u, p]) => { setUs(u); setPs(p); }).catch(() => setErro('Não foi possível carregar os chalés.'));
  useEffect(() => { if (perfil) carregar(); }, [perfil]);
  if (!perfil) return null;

  const pousadaDe = (u: UnidadePresenca) => ps.find((p) => p.id_propriedade === u.idPropriedade);
  const cfg = ed && { tp_validacao: (ed.tp === 'HERDAR' ? null : ed.tp) as Herdavel, vl_latitude: num(ed.lat), vl_longitude: num(ed.lng), qtde_raio_metros: num(ed.raio) };
  const erros = ed && cfg ? validarPresencaUnidade(cfg, pousadaDe(ed.u)) : [];
  const limpar = () => { setErro(''); setAviso(''); };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!ed || !cfg || erros.length) return;
    const r = await salvarPresencaUnidade(ed.u.id, cfg, ed.andar);
    if (!r.ok) return setErro(r.erro);
    setAviso(`Presença de ${ed.u.nome} salva.`); setEd(null); carregar();
  }
  async function abrirQr(u: UnidadePresenca, rotacionar = false) {
    limpar(); setEd(null);
    const r = await qrDaUnidade(u.id, rotacionar);
    if (!r.ok) return setErro(r.erro);
    const img = await QRCode.toDataURL(r.codigo, { margin: 2, width: 320, errorCorrectionLevel: 'M' });
    setQr({ u, codigo: r.codigo, versao: r.versao, img, confirmar: false });
    if (rotacionar) { setAviso(`QR de ${u.nome} rotacionado: as etiquetas antigas deixaram de valer. Imprima e troque a etiqueta da porta.`); carregar(); }
  }

  return (
    <GestaoShell eyebrow="Administração" titulo="Presença por chalé">
      <p className="text-[0.8125rem] text-fg-3">Campos vazios usam a configuração da pousada. O QR da porta prova que o assessor está no chalé.</p>
      {erro && <p role="alert" className="rounded-md border border-error bg-white p-3 text-sm text-error">{erro}</p>}
      {aviso && <AvisoFixo texto={aviso} onFechar={() => setAviso('')} />}

      {ed && (
        <form onSubmit={salvar} className={`${card} grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4 p-5 sm:grid-cols-2`} noValidate aria-label="Presença do chalé">
          <p className="text-[0.9375rem] font-medium text-fg-1 sm:col-span-2">{ed.u.nome}</p>
          <div className="sm:col-span-2"><Seletor rotulo="Validação" valor={ed.tp} onChange={(v) => setEd({ ...ed, tp: v })} opcoes={OPCOES} /></div>
          <label className={rot}>Latitude<input id="c-lat" inputMode="decimal" className={campo} value={ed.lat} onChange={(e) => setEd({ ...ed, lat: e.target.value })} placeholder="da pousada" /></label>
          <label className={rot}>Longitude<input id="c-lng" inputMode="decimal" className={campo} value={ed.lng} onChange={(e) => setEd({ ...ed, lng: e.target.value })} placeholder="da pousada" /></label>
          <label className={rot}>Raio (m)<input id="c-raio" inputMode="numeric" className={campo} value={ed.raio} onChange={(e) => setEd({ ...ed, raio: e.target.value })} placeholder={`${pousadaDe(ed.u)?.qtde_raio_metros ?? 100} (da pousada)`} /></label>
          <label className={rot}>Andar ou bloco<input id="c-andar" className={campo} maxLength={60} value={ed.andar} onChange={(e) => setEd({ ...ed, andar: e.target.value })} /></label>
          <button type="button" className={`${btnSecondary} w-auto sm:col-span-2 sm:justify-self-start`} onClick={() => navigator.geolocation?.getCurrentPosition((p) => setEd((x) => x && { ...x, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }), () => setErro('Não foi possível obter a sua posição.'), { enableHighAccuracy: true, timeout: 15000 })}>
            <Icon icon="solar:map-point-linear" width={18} aria-hidden="true" />Usar minha posição (na porta do chalé)</button>
          {erros.length > 0 && <ul role="alert" className="flex flex-col gap-1 text-[0.8125rem] text-warning sm:col-span-2">{erros.map((x) => <li key={x}>{x}</li>)}</ul>}
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="button" className={`${btnSecondary} w-auto`} onClick={() => setEd(null)}>Cancelar</button>
            <button type="submit" className={`${btnPrimary} w-auto`} disabled={erros.length > 0}>Salvar</button>
          </div>
        </form>
      )}

      {qr && (
        <section className={`${card} flex max-w-md flex-col items-center gap-3 p-5 text-center`} aria-label="QR da porta">
          <p className="text-[0.9375rem] font-medium text-fg-1">QR da porta · {qr.u.nome}</p>
          <img src={qr.img} alt={`QR da porta do chalé ${qr.u.nome}`} width={240} height={240} />
          <p className="text-[0.75rem] text-fg-3">Versão {qr.versao}. Não divulgue esta imagem fora da etiqueta.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={`${btnSecondary} w-auto`} onClick={() => window.print()}><Icon icon="solar:printer-linear" width={18} aria-hidden="true" />Imprimir</button>
            {qr.confirmar
              ? <button type="button" className={`${btnPrimary} w-auto`} onClick={() => abrirQr(qr.u, true)}>Confirmar: invalidar a etiqueta atual</button>
              : <button type="button" className={`${btnSecondary} w-auto`} onClick={() => setQr({ ...qr, confirmar: true })}>Rotacionar QR</button>}
            <button type="button" className={`${btnSecondary} w-auto`} onClick={() => setQr(null)}>Fechar</button>
          </div>
        </section>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3">
        {us.map((u) => (
          <li key={u.id} className={`${card} flex flex-col gap-3 p-4`}>
            <div><p className="text-[0.9375rem] font-medium text-fg-1">{u.nome}</p><p className="text-[0.75rem] text-fg-3">{u.pousada}{u.andar ? ` · ${u.andar}` : ''}</p></div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.75rem]">
              <dt className="text-fg-3">Validação</dt><dd className="text-fg-1">{rotulo(u.efetivo.tp_validacao)}{u.proprio.tp_validacao ? '' : ' (pousada)'}</dd>
              <dt className="text-fg-3">Ponto de GPS</dt><dd className={u.efetivo.vl_latitude === null ? 'text-warning' : 'text-fg-1'}>{u.efetivo.vl_latitude === null ? 'não definido' : `${u.efetivo.vl_latitude}, ${u.efetivo.vl_longitude}${u.proprio.vl_latitude === null ? ' (pousada)' : ''}`}</dd>
              <dt className="text-fg-3">Raio</dt><dd className="text-fg-1">{u.efetivo.qtde_raio_metros} m{u.proprio.qtde_raio_metros === null ? ' (pousada)' : ''}</dd>
              <dt className="text-fg-3">QR</dt><dd className="text-fg-1">versão {u.versaoQr}</dd>
            </dl>
            <span className="flex flex-wrap gap-3">
              <button type="button" className="min-h-11 text-[0.75rem] text-pine underline underline-offset-4" onClick={() => { limpar(); setQr(null); setEd({ u, tp: u.proprio.tp_validacao ?? 'HERDAR', lat: u.proprio.vl_latitude?.toString() ?? '', lng: u.proprio.vl_longitude?.toString() ?? '', raio: u.proprio.qtde_raio_metros?.toString() ?? '', andar: u.andar ?? '' }); }}>Editar presença</button>
              <button type="button" className="min-h-11 text-[0.75rem] text-pine underline underline-offset-4" onClick={() => abrirQr(u)}>QR da porta</button>
            </span>
          </li>
        ))}
      </ul>
    </GestaoShell>
  );
}
