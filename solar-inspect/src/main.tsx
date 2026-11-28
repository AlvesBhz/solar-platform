import { StrictMode, Suspense, lazy, useEffect, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { addCollection } from '@iconify/react';
import solar from './icons/solar-subset.json';
import SimNav from './components/SimNav';
import './index.css';
import { marcarAtividade, sair, sessaoVencida } from './lib/acesso';

// iPhone/iPad: o Safari dá zoom sozinho ao tocar num campo com texto menor que 16px. maximum-scale=1 desliga só esse zoom
// automático; no iOS a pinça para ampliar continua funcionando (o Safari ignora o limite para o usuário). No Android não se aplica.
if (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
  document.querySelector('meta[name=viewport]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
}
// o app não abre dentro de outra página (proteção contra clique enganado); a demonstração em arquivo único roda em quadro de propósito
if (import.meta.env.MODE !== 'artifact' && window.top !== window.self) {
  document.documentElement.style.display = 'none';
  try { window.top!.location.href = window.location.href; } catch { /* outro domínio: a página fica em branco */ }
}
// validade da sessão: uso do app conta como atividade; ao voltar para o app depois do limite, pede login de novo
['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => marcarAtividade(), { passive: true }));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && sessaoVencida()) void sair().then(() => location.replace(import.meta.env.BASE_URL + 'login'));
});
// teclado do celular aberto (foco num campo de texto, em tela de toque): marca o body para a barra das áreas sair da frente
if (typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches) {
  const ehTexto = (el: EventTarget | null) => el instanceof HTMLElement && (el.matches('textarea, select, [contenteditable]') || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'file', 'button', 'submit'].includes(el.type)));
  document.addEventListener('focusin', (e) => { if (ehTexto(e.target)) document.body.classList.add('teclado-aberto'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!ehTexto(document.activeElement)) document.body.classList.remove('teclado-aberto'); }, 50));
}

// Telas carregadas só quando a rota abre (o login e a entrada ficam no pacote inicial): a primeira visita baixa uma fração do código
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tela = <T extends Record<string, any>>(carregar: () => Promise<T>, nome: keyof T) => lazy(() => carregar().then((m) => ({ default: m[nome] as ComponentType<any> })));

addCollection(solar);

// No link publicado (artifact) não há rotas de URL: a navegação fica em memória.
const Router = import.meta.env.MODE === 'artifact' ? MemoryRouter : BrowserRouter;
import T01Inicializacao from './screens/T01Inicializacao';
import T02Login from './screens/T02Login';
const T03PermissaoLocalizacao = lazy(() => import('./screens/T03PermissaoLocalizacao'));
import T04AcessoIndisponivel from './screens/T04AcessoIndisponivel';
const T05MinhasUnidades = lazy(() => import('./screens/T05MinhasUnidades'));
const T06DetalheUnidade = lazy(() => import('./screens/T06DetalheUnidade'));
const T07TipoVistoria = lazy(() => import('./screens/T07TipoVistoria'));
const T08ValidacaoPresenca = lazy(() => import('./screens/T08ValidacaoPresenca'));
const T09LeitorQr = lazy(() => import('./screens/T09LeitorQr'));
const T10Checklist = lazy(() => import('./screens/T10Checklist'));
const T11DetalheItem = lazy(() => import('./screens/T11DetalheItem'));
const T12CapturaEvidencia = lazy(() => import('./screens/T12CapturaEvidencia'));
const T13Comparacao = lazy(() => import('./screens/T13Comparacao'));
const T14Ocorrencia = lazy(() => import('./screens/T14Ocorrencia'));
const T15Resumo = lazy(() => import('./screens/T15Resumo'));
const T16Assinatura = lazy(() => import('./screens/T16Assinatura'));
const T17Confirmacao = lazy(() => import('./screens/T17Confirmacao'));
const T18Sincronizacao = lazy(() => import('./screens/T18Sincronizacao'));
const T19MeuHistorico = lazy(() => import('./screens/T19MeuHistorico'));
const T20Dashboard = tela(() => import('./screens/Gestao'), 'T20Dashboard');
const T42Pendencias = tela(() => import('./screens/Gestao'), 'T42Pendencias');
const T43Cadastros = tela(() => import('./screens/Gestao'), 'T43Cadastros');
const T21Unidades = tela(() => import('./screens/Gestao'), 'T21Unidades');
const T22DetalheUnidade = tela(() => import('./screens/Gestao'), 'T22DetalheUnidade');
const T23Vistorias = tela(() => import('./screens/Gestao'), 'T23Vistorias');
const T24DetalheVistoria = tela(() => import('./screens/Gestao'), 'T24DetalheVistoria');
const T25Ocorrencias = tela(() => import('./screens/Gestao'), 'T25Ocorrencias');
const T26Tratamento = tela(() => import('./screens/Gestao'), 'T26Tratamento');
const T27Relatorio = tela(() => import('./screens/Gestao'), 'T27Relatorio');
const T34Auditoria = tela(() => import('./screens/Admin'), 'T34Auditoria');
const T31Tipos = tela(() => import('./screens/T31Tipos'), 'T31Tipos');
const T30Ambientes = tela(() => import('./screens/T30Ambientes'), 'T30Ambientes');
const T33Presenca = tela(() => import('./screens/T33Presenca'), 'T33Presenca');
const T35TrocarSenha = lazy(() => import('./screens/T35TrocarSenha'));
const T36Ocorrencias = tela(() => import('./screens/T36Ocorrencias'), 'T36Ocorrencias');
const T37TratarOcorrencia = tela(() => import('./screens/T36Ocorrencias'), 'T37TratarOcorrencia');
import ProtegeCampo from './lib/ProtegeCampo';
import type { Perfil } from './lib/acesso';
const GESTAO: Perfil[] = ['GESTOR', 'ADMIN'];
const MANUTENCAO: Perfil[] = ['MANUTENCAO', 'GESTOR', 'ADMIN'];
const T32Usuarios = tela(() => import('./screens/T32Usuarios'), 'T32Usuarios');
const T28Propriedades = tela(() => import('./screens/T28Propriedades'), 'T28Propriedades');
const T29FormPropriedade = tela(() => import('./screens/T28Propriedades'), 'T29FormPropriedade');
const T38Calendario = tela(() => import('./screens/Precos'), 'T38Calendario');
const T40Simulador = tela(() => import('./screens/Precos'), 'T40Simulador');
const T44Pacotes = tela(() => import('./screens/Precos'), 'T44Pacotes');
const T39Tarifas = tela(() => import('./screens/Tarifas'), 'T39Tarifas');
const T41FormTarifa = tela(() => import('./screens/Tarifas'), 'T41FormTarifa');


// O campo (vistoria) funciona sem internet: ao entrar numa tela do campo, as demais telas dele baixam em segundo plano,
// para a sessão não depender da rede no meio de uma vistoria. Quem só usa a gestão não paga esse peso.
const telasDoCampo = [
  () => import('./screens/T03PermissaoLocalizacao'),
  () => import('./screens/T05MinhasUnidades'),
  () => import('./screens/T06DetalheUnidade'),
  () => import('./screens/T07TipoVistoria'),
  () => import('./screens/T08ValidacaoPresenca'),
  () => import('./screens/T09LeitorQr'),
  () => import('./screens/T10Checklist'),
  () => import('./screens/T11DetalheItem'),
  () => import('./screens/T12CapturaEvidencia'),
  () => import('./screens/T13Comparacao'),
  () => import('./screens/T14Ocorrencia'),
  () => import('./screens/T15Resumo'),
  () => import('./screens/T16Assinatura'),
  () => import('./screens/T17Confirmacao'),
  () => import('./screens/T18Sincronizacao'),
  () => import('./screens/T19MeuHistorico'),
  () => import('./screens/T36Ocorrencias'),
];
function PreCarregarCampo() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!pathname.startsWith('/app') || (window as unknown as { __campoPronto?: boolean }).__campoPronto) return;
    (window as unknown as { __campoPronto?: boolean }).__campoPronto = true;
    const t = setTimeout(() => telasDoCampo.forEach((c) => c().catch(() => { (window as unknown as { __campoPronto?: boolean }).__campoPronto = false; })), 0);
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router basename={import.meta.env.MODE === 'artifact' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      {import.meta.env.MODE === 'artifact' && <SimNav />}
      <PreCarregarCampo />
      <Suspense fallback={<div className="screen bg-cream" aria-busy="true" aria-label="Carregando" />}>
      <Routes>
        <Route path="/" element={<T01Inicializacao />} />
        <Route path="/login" element={<T02Login />} />
        <Route path="/permissao-localizacao" element={<T03PermissaoLocalizacao />} />
        <Route path="/acesso-indisponivel" element={<T04AcessoIndisponivel />} />
        <Route path="/app/unidades" element={<ProtegeCampo><T05MinhasUnidades /></ProtegeCampo>} />
        <Route path="/app/unidades/:id" element={<ProtegeCampo><T06DetalheUnidade /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId" element={<ProtegeCampo><T07TipoVistoria /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId/presenca" element={<ProtegeCampo><T08ValidacaoPresenca /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId/qr" element={<ProtegeCampo><T09LeitorQr /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId/checklist" element={<ProtegeCampo><T10Checklist /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId/item/:itemId" element={<ProtegeCampo><T11DetalheItem /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId/item/:itemId/foto" element={<ProtegeCampo><T12CapturaEvidencia /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId/item/:itemId/comparar" element={<ProtegeCampo><T13Comparacao /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId/item/:itemId/ocorrencia" element={<ProtegeCampo><T14Ocorrencia /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId/resumo" element={<ProtegeCampo><T15Resumo /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId/assinatura" element={<ProtegeCampo><T16Assinatura /></ProtegeCampo>} />
        <Route path="/app/vistorias/nova/:unidadeId/confirmacao" element={<ProtegeCampo><T17Confirmacao /></ProtegeCampo>} />
        <Route path="/app/sincronizacao" element={<ProtegeCampo><T18Sincronizacao /></ProtegeCampo>} />
        <Route path="/app/historico" element={<ProtegeCampo><T19MeuHistorico /></ProtegeCampo>} />
        <Route path="/gestao" element={<ProtegeCampo perfis={GESTAO}><T42Pendencias /></ProtegeCampo>} />
        <Route path="/gestao/painel" element={<ProtegeCampo perfis={GESTAO}><T20Dashboard /></ProtegeCampo>} />
        <Route path="/admin" element={<ProtegeCampo perfis={GESTAO}><T43Cadastros /></ProtegeCampo>} />
        <Route path="/admin/site" element={<ProtegeCampo perfis={GESTAO}><T43Cadastros /></ProtegeCampo>} />
        <Route path="/admin/pacotes" element={<T44Pacotes />} />
        <Route path="/gestao/unidades" element={<ProtegeCampo perfis={GESTAO}><T21Unidades /></ProtegeCampo>} />
        <Route path="/gestao/unidades/:id" element={<ProtegeCampo perfis={GESTAO}><T22DetalheUnidade /></ProtegeCampo>} />
        <Route path="/gestao/vistorias" element={<ProtegeCampo perfis={GESTAO}><T23Vistorias /></ProtegeCampo>} />
        <Route path="/gestao/vistorias/:id" element={<ProtegeCampo perfis={GESTAO}><T24DetalheVistoria /></ProtegeCampo>} />
        <Route path="/gestao/vistorias/:id/relatorio" element={<ProtegeCampo perfis={GESTAO}><T27Relatorio /></ProtegeCampo>} />
        <Route path="/gestao/ocorrencias" element={<ProtegeCampo perfis={GESTAO}><T25Ocorrencias /></ProtegeCampo>} />
        <Route path="/gestao/ocorrencias/:id" element={<ProtegeCampo perfis={GESTAO}><T26Tratamento /></ProtegeCampo>} />
        <Route path="/admin/propriedades" element={<T28Propriedades />} />
        <Route path="/admin/propriedades/:id" element={<T29FormPropriedade />} />
        <Route path="/admin/checklists" element={<T30Ambientes />} />
        <Route path="/admin/tipos" element={<T31Tipos />} />
        <Route path="/admin/presenca" element={<T33Presenca />} />
        <Route path="/admin/usuarios" element={<T32Usuarios />} />
        <Route path="/admin/auditoria" element={<T34Auditoria />} />
        <Route path="/admin/precos" element={<T38Calendario />} />
        <Route path="/admin/tarifas" element={<T39Tarifas />} />
        <Route path="/admin/tarifas/:id" element={<T41FormTarifa />} />
        <Route path="/admin/simulador" element={<T40Simulador />} />
        <Route path="/app/ocorrencias" element={<ProtegeCampo perfis={MANUTENCAO}><T36Ocorrencias /></ProtegeCampo>} />
        <Route path="/app/ocorrencias/:id" element={<ProtegeCampo perfis={MANUTENCAO}><T37TratarOcorrencia /></ProtegeCampo>} />
        <Route path="/conta/senha" element={<T35TrocarSenha />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </Router>
  </StrictMode>,
);

// service worker: guarda o app no aparelho (abre na hora e sem internet). Só no app publicado.
if (import.meta.env.PROD && import.meta.env.MODE !== 'artifact' && 'serviceWorker' in navigator) {
  addEventListener('load', () => { void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL }).catch(() => undefined); });
}
