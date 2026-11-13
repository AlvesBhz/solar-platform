import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { addCollection } from '@iconify/react';
import solar from './icons/solar-subset.json';
import './index.css';

addCollection(solar);
import T01Inicializacao from './screens/T01Inicializacao';
import T02Login from './screens/T02Login';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<T01Inicializacao />} />
        <Route path="/login" element={<T02Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
