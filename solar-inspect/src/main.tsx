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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <SimNav />
      <Routes>
        <Route path="/" element={<T01Inicializacao />} />
        <Route path="/login" element={<T02Login />} />
        <Route path="/permissao-localizacao" element={<T03PermissaoLocalizacao />} />
        <Route path="/acesso-indisponivel" element={<T04AcessoIndisponivel />} />
        <Route path="/app/unidades" element={<T05MinhasUnidades />} />
        <Route path="/app/unidades/:id" element={<T06DetalheUnidade />} />
        <Route path="/app/vistorias/nova/:unidadeId" element={<T07TipoVistoria />} />
        <Route path="/app/vistorias/nova/:unidadeId/presenca" element={<T08ValidacaoPresenca />} />
        <Route path="/app/vistorias/nova/:unidadeId/qr" element={<T09LeitorQr />} />
        <Route path="/app/vistorias/nova/:unidadeId/checklist" element={<T10Checklist />} />
        <Route path="/app/vistorias/nova/:unidadeId/item/:itemId" element={<T11DetalheItem />} />
        <Route path="/app/vistorias/nova/:unidadeId/item/:itemId/foto" element={<T12CapturaEvidencia />} />
        <Route path="/app/vistorias/nova/:unidadeId/item/:itemId/comparar" element={<T13Comparacao />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  </StrictMode>,
);
