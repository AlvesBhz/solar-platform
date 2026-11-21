import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODO_DEMO, type AcessoOk, verificarAcesso } from './acesso';

// Conferência do acesso reaproveitada por 5 min entre as telas de campo (evita ida ao servidor a cada toque).
let ultima: { em: number; a: Awaited<ReturnType<typeof verificarAcesso>> } | null = null;
export const esquecerAcessoCampo = () => { ultima = null; };

/** Telas de campo (/app/*): sem sessão → login; bloqueado → T04; senha provisória → T35; sem aceite de localização → T03. */
export default function ProtegeCampo({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [ok, setOk] = useState<AcessoOk | null>(null);
  useEffect(() => {
    if (MODO_DEMO) { setOk({ estado: 'ok', nome: '', perfil: 'ASSESSOR', aceiteLocalizacao: true, offline: false }); return; }
    let vivo = true;
    try { if (!localStorage.getItem('inspect.sessao')) ultima = null; } catch { ultima = null; }   // saiu: confere de novo
    const conferir = ultima && Date.now() - ultima.em < 300_000 ? Promise.resolve(ultima.a) : verificarAcesso();
    conferir.then((a) => {
      if (!vivo) return;
      ultima = a.estado === 'ok' ? { em: Date.now(), a } : null;
      if (a.estado === 'sem-sessao') navigate('/login', { replace: true });
      else if (a.estado === 'bloqueado') navigate(`/acesso-indisponivel?motivo=${a.motivo}`, { replace: true });
      else if (a.trocarSenha) navigate('/conta/senha', { replace: true });
      else if (!a.aceiteLocalizacao) navigate('/permissao-localizacao', { replace: true });
      else setOk(a);
    });
    return () => { vivo = false; };
  }, [navigate]);
  if (!ok) return <div className="screen bg-cream" aria-busy="true" />;
  return <>{children}</>;
}
