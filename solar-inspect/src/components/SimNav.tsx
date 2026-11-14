import { Icon } from '@iconify/react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { salvarRascunho } from '../mocks/vistoria';

// MOCKUP: menu flutuante para pular entre as telas na simulação. Remover na versão real.
const V = '/app/vistorias/nova';
type Tela = { id: string; nome: string; rota: string; rascunho?: { u: string; tipo: string; inicio?: boolean; resp?: Record<string, string> } };

const GRUPOS: { titulo: string; telas: Tela[] }[] = [
  { titulo: 'Acesso', telas: [
    { id: 'T01', nome: 'Inicialização', rota: '/' },
    { id: 'T02', nome: 'Login', rota: '/login' },
    { id: 'T03', nome: 'Permissão de localização', rota: '/permissao-localizacao' },
    { id: 'T04', nome: 'Acesso indisponível', rota: '/acesso-indisponivel?motivo=inativo' },
  ] },
  { titulo: 'Assessor', telas: [
    { id: 'T05', nome: 'Minhas unidades', rota: '/app/unidades' },
    { id: 'T06', nome: 'Detalhe da unidade', rota: '/app/unidades/chale-sempre-viva' },
    { id: 'T07', nome: 'Tipo de vistoria', rota: `${V}/chale-candeia` },
    { id: 'T08', nome: 'Validação de presença', rota: `${V}/chale-ipe/presenca`, rascunho: { u: 'chale-ipe', tipo: 'entrada' } },
    { id: 'T09', nome: 'Leitor QR', rota: `${V}/chale-ipe/qr`, rascunho: { u: 'chale-ipe', tipo: 'entrada' } },
    { id: 'T10', nome: 'Checklist', rota: `${V}/chale-ipe/checklist`, rascunho: { u: 'chale-ipe', tipo: 'entrada', inicio: true } },
    { id: 'T11', nome: 'Detalhe do item', rota: `${V}/chale-ipe/item/cama`, rascunho: { u: 'chale-ipe', tipo: 'entrada', inicio: true } },
    { id: 'T12', nome: 'Captura de evidência', rota: `${V}/chale-ipe/item/cama/foto`, rascunho: { u: 'chale-ipe', tipo: 'entrada', inicio: true } },
    { id: 'T13', nome: 'Comparação entrada × saída', rota: `${V}/chale-candeia/item/sofa/comparar`, rascunho: { u: 'chale-candeia', tipo: 'saida', inicio: true } },
    { id: 'T14', nome: 'Ocorrência', rota: `${V}/chale-candeia/item/sofa/ocorrencia`, rascunho: { u: 'chale-candeia', tipo: 'saida', inicio: true, resp: { sofa: 'Danificado' } } },
    { id: 'T15', nome: 'Resumo', rota: `${V}/chale-candeia/resumo`, rascunho: { u: 'chale-candeia', tipo: 'saida', inicio: true } },
    { id: 'T16', nome: 'Assinatura', rota: `${V}/chale-candeia/assinatura`, rascunho: { u: 'chale-candeia', tipo: 'saida', inicio: true } },
    { id: 'T18', nome: 'Sincronização', rota: '/app/sincronizacao' },
    { id: 'T19', nome: 'Meu histórico', rota: '/app/historico' },
  ] },
];

export default function SimNav() {
  const [aberto, setAberto] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function ir(t: Tela) {
    if (t.rascunho) {
      const { u, tipo, inicio, resp } = t.rascunho;
      salvarRascunho({ id: `sim-${u}-${tipo}`, unidadeId: u, tipoId: tipo, presenca: {}, respostas: resp ?? {}, inicio: inicio ? new Date().toISOString() : undefined });
    }
    setAberto(false);
    navigate(t.rota);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="fixed z-40 flex h-11 w-11 items-center justify-center rounded-full bg-pine-deep text-white opacity-90 shadow-lg" style={{ left: 'calc(env(safe-area-inset-left, 0px) + 0.5rem)', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6.5rem)' }}
        aria-label="Abrir navegação da simulação"
      >
        <Icon icon="solar:layers-minimalistic-linear" width={20} aria-hidden="true" />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Navegação da simulação">
          <button type="button" className="absolute inset-0" style={{ background: 'var(--scrim-top)' }} onClick={() => setAberto(false)} aria-label="Fechar" />
          <nav className="relative flex h-full w-[min(20rem,88vw)] flex-col overflow-y-auto bg-cream pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1rem)] shadow-xl">
            <div className="flex items-center justify-between px-4 pb-3">
              <div className="flex flex-col">
                <span className="text-[0.625rem] uppercase tracking-[0.24em] text-fg-3">Mockup</span>
                <span className="text-[0.9375rem] font-medium text-fg-1">Navegar entre telas</span>
              </div>
              <button type="button" onClick={() => setAberto(false)} className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-white" aria-label="Fechar">
                <Icon icon="solar:close-circle-linear" width={22} aria-hidden="true" />
              </button>
            </div>
            {GRUPOS.map((g) => (
              <section key={g.titulo} className="flex flex-col border-t border-line-1 py-2">
                <h2 className="px-4 py-2 font-sans text-[0.6875rem] font-normal uppercase tracking-[0.08em] text-fg-3">{g.titulo}</h2>
                {g.telas.map((t) => {
                  const atual = pathname === t.rota.split('?')[0];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => ir(t)}
                      aria-current={atual ? 'page' : undefined}
                      className={`flex min-h-11 items-center gap-3 px-4 text-left text-[0.8125rem] transition-colors duration-fast ${atual ? 'bg-white font-medium text-pine' : 'text-fg-1 hover:bg-white'}`}
                    >
                      <span className="w-8 shrink-0 font-mono text-[0.6875rem] text-fg-3">{t.id}</span>
                      {t.nome}
                    </button>
                  );
                })}
              </section>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
