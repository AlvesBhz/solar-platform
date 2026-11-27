import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { addCollection } from '@iconify/react';
import solar from './icons/solar-subset.json';
import SimNav from './components/SimNav';
import './index.css';

addCollection(solar);

// No link publicado (artifact) não há rotas de URL: a navegação fica em memória.
const Router = import.meta.env.MODE === 'artifact' ? MemoryRouter : BrowserRouter;
import T01Inicializacao from './screens/T01Inicializacao';
import T02Login from './screens/T02Login';
import T03PermissaoLocalizacao from './screens/T03PermissaoLocalizacao';
import T04AcessoIndisponivel from './screens/T04AcessoIndisponivel';
import T05MinhasUnidades from './screens/T05MinhasUnidades';
import T06DetalheUnidade from './screens/T06DetalheUnidade';
import T07TipoVistoria from './screens/T07TipoVistoria';
import T08ValidacaoPresenca from './screens/T08ValidacaoPresenca';
import T09LeitorQr from './screens/T09LeitorQr';
import T10Checklist from './screens/T10Checklist';
import T11DetalheItem from './screens/T11DetalheItem';
import T12CapturaEvidencia from './screens/T12CapturaEvidencia';
import T13Comparacao from './screens/T13Comparacao';
import T14Ocorrencia from './screens/T14Ocorrencia';
import T15Resumo from './screens/T15Resumo';
import T16Assinatura from './screens/T16Assinatura';
import T17Confirmacao from './screens/T17Confirmacao';
import T18Sincronizacao from './screens/T18Sincronizacao';
import T19MeuHistorico from './screens/T19MeuHistorico';
import { T20Dashboard, T21Unidades, T22DetalheUnidade, T23Vistorias, T24DetalheVistoria, T25Ocorrencias, T26Tratamento, T27Relatorio } from './screens/Gestao';
import { T34Auditoria } from './screens/Admin';
import { T31Tipos } from './screens/T31Tipos';
import { T30Ambientes } from './screens/T30Ambientes';
import { T33Presenca } from './screens/T33Presenca';
import T35TrocarSenha from './screens/T35TrocarSenha';
import { T36Ocorrencias, T37TratarOcorrencia } from './screens/T36Ocorrencias';
import ProtegeCampo from './lib/ProtegeCampo';
import type { Perfil } from './lib/acesso';
const GESTAO: Perfil[] = ['GESTOR', 'ADMIN'];
const MANUTENCAO: Perfil[] = ['MANUTENCAO', 'GESTOR', 'ADMIN'];
import { T32Usuarios } from './screens/T32Usuarios';
import { T28Propriedades, T29FormPropriedade } from './screens/T28Propriedades';
import { T38Calendario, T40Simulador } from './screens/Precos';
import { T39Tarifas, T41FormTarifa } from './screens/Tarifas';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router basename={import.meta.env.MODE === 'artifact' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      {import.meta.env.MODE === 'artifact' && <SimNav />}
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
        <Route path="/gestao" element={<ProtegeCampo perfis={GESTAO}><T20Dashboard /></ProtegeCampo>} />
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
    </Router>
  </StrictMode>,
);
