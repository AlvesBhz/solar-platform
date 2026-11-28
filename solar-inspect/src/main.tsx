import { StrictMode, Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
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
if (typeof window !== 'undefined') {
  ['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => marcarAtividade(), { passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && sessaoVencida()) void sair().then(() => location.replace(import.meta.env.BASE_URL + 'login'));
  });
}
// teclado do celular aberto (foco num campo de texto, em tela de toque): marca o body para a barra das áreas sair da frente
if (typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches) {
  const ehTexto = (el: EventTarget | null) => el instanceof HTMLElement && (el.matches('textarea, select, [contenteditable]') || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'file', 'button', 'submit'].includes(el.type)));
  document.addEventListener('focusin', (e) => { if (ehTexto(e.target)) document.body.classList.add('teclado-aberto'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!ehTexto(document.activeElement)) document.body.classList.remove('teclado-aberto'); }, 50));
}

addCollection(solar);

// No link publicado (artifact) não há rotas de URL: a navegação fica em memória.
const Router = import.meta.env.MODE === 'artifact' ? MemoryRouter : BrowserRouter;
import T01Inicializacao from './screens/T01Inicializacao';
import T02Login from './screens/T02Login';
import T03PermissaoLocalizacao from './screens/T03PermissaoLocalizacao';
import T04AcessoIndisponivel from './screens/T04AcessoIndisponivel';
import ProtegeCampo from './lib/ProtegeCampo';
// Telas carregadas sob demanda (o login abre sem baixar o app inteiro); depois do primeiro desenho, o resto vem em segundo plano
// e fica no cache do service worker, para a vistoria funcionar sem sinal.
const telas: (() => Promise<unknown>)[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function carregar(f: () => Promise<any>, nome?: string): LazyExoticComponent<ComponentType<any>> {
  telas.push(f);
  return lazy(() => f().then((m) => ({ default: nome ? m[nome] : m.default })));
}
const T05MinhasUnidades = carregar(() => import('./screens/T05MinhasUnidades'));
const T06DetalheUnidade = carregar(() => import('./screens/T06DetalheUnidade'));
const T07TipoVistoria = carregar(() => import('./screens/T07TipoVistoria'));
const T08ValidacaoPresenca = carregar(() => import('./screens/T08ValidacaoPresenca'));
const T09LeitorQr = carregar(() => import('./screens/T09LeitorQr'));
const T10Checklist = carregar(() => import('./screens/T10Checklist'));
const T11DetalheItem = carregar(() => import('./screens/T11DetalheItem'));
const T12CapturaEvidencia = carregar(() => import('./screens/T12CapturaEvidencia'));
const T13Comparacao = carregar(() => import('./screens/T13Comparacao'));
const T14Ocorrencia = carregar(() => import('./screens/T14Ocorrencia'));
const T15Resumo = carregar(() => import('./screens/T15Resumo'));
const T16Assinatura = carregar(() => import('./screens/T16Assinatura'));
const T17Confirmacao = carregar(() => import('./screens/T17Confirmacao'));
const T18Sincronizacao = carregar(() => import('./screens/T18Sincronizacao'));
const T19MeuHistorico = carregar(() => import('./screens/T19MeuHistorico'));
const T20Dashboard = carregar(() => import('./screens/Gestao'), 'T20Dashboard');
const T42Pendencias = carregar(() => import('./screens/Gestao'), 'T42Pendencias');
const T43Cadastros = carregar(() => import('./screens/Gestao'), 'T43Cadastros');
const T21Unidades = carregar(() => import('./screens/Gestao'), 'T21Unidades');
const T22DetalheUnidade = carregar(() => import('./screens/Gestao'), 'T22DetalheUnidade');
const T23Vistorias = carregar(() => import('./screens/Gestao'), 'T23Vistorias');
const T24DetalheVistoria = carregar(() => import('./screens/Gestao'), 'T24DetalheVistoria');
const T25Ocorrencias = carregar(() => import('./screens/Gestao'), 'T25Ocorrencias');
const T26Tratamento = carregar(() => import('./screens/Gestao'), 'T26Tratamento');
const T27Relatorio = carregar(() => import('./screens/Gestao'), 'T27Relatorio');
const T34Auditoria = carregar(() => import('./screens/Admin'), 'T34Auditoria');
const T31Tipos = carregar(() => import('./screens/T31Tipos'), 'T31Tipos');
const T30Ambientes = carregar(() => import('./screens/T30Ambientes'), 'T30Ambientes');
const T33Presenca = carregar(() => import('./screens/T33Presenca'), 'T33Presenca');
const T35TrocarSenha = carregar(() => import('./screens/T35TrocarSenha'));
const T36Ocorrencias = carregar(() => import('./screens/T36Ocorrencias'), 'T36Ocorrencias');
const T37TratarOcorrencia = carregar(() => import('./screens/T36Ocorrencias'), 'T37TratarOcorrencia');
const T32Usuarios = carregar(() => import('./screens/T32Usuarios'), 'T32Usuarios');
const T28Propriedades = carregar(() => import('./screens/T28Propriedades'), 'T28Propriedades');
const T29FormPropriedade = carregar(() => import('./screens/T28Propriedades'), 'T29FormPropriedade');
const T38Calendario = carregar(() => import('./screens/Precos'), 'T38Calendario');
const T40Simulador = carregar(() => import('./screens/Precos'), 'T40Simulador');
const T44Pacotes = carregar(() => import('./screens/Precos'), 'T44Pacotes');
const T39Tarifas = carregar(() => import('./screens/Tarifas'), 'T39Tarifas');
const T41FormTarifa = carregar(() => import('./screens/Tarifas'), 'T41FormTarifa');
import type { Perfil } from './lib/acesso';
const GESTAO: Perfil[] = ['GESTOR', 'ADMIN'];
const MANUTENCAO: Perfil[] = ['MANUTENCAO', 'GESTOR', 'ADMIN'];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router basename={import.meta.env.MODE === 'artifact' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      {import.meta.env.MODE === 'artifact' && <SimNav />}
      <Suspense fallback={<div className="screen bg-cream" aria-busy="true" />}>
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

// em segundo plano, quando o aparelho estiver livre: baixa as demais telas (navegação instantânea e uso sem sinal)
const ocioso = (f: () => void) => ('requestIdleCallback' in window ? (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(f) : setTimeout(f, 1500));
addEventListener('load', () => setTimeout(() => ocioso(() => { telas.forEach((f) => { void f().catch(() => undefined); }); }), 1200));

// service worker: guarda o app no aparelho (abre na hora e sem internet). Só no app publicado.
if (import.meta.env.PROD && import.meta.env.MODE !== 'artifact' && 'serviceWorker' in navigator) {
  addEventListener('load', () => { void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL }).catch(() => undefined); });
}
