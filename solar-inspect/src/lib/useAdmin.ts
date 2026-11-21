import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verificarAcesso, type Perfil } from './acesso';
import { MODO_DEMO } from './supabase';

/** Telas de administração: só para os perfis indicados (padrão: ADMIN). Sem sessão → login; outro perfil → T04. O RLS é a segunda barreira. */
export function usePerfilPermitido(permitidos: Perfil[] = ['ADMIN']): Perfil | null {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<Perfil | null>(MODO_DEMO ? 'ADMIN' : null);
  useEffect(() => {
    if (MODO_DEMO) return;
    let vivo = true;
    verificarAcesso().then((a) => {
      if (!vivo) return;
      if (a.estado === 'sem-sessao') navigate('/login', { replace: true });
      else if (a.estado === 'bloqueado') navigate(`/acesso-indisponivel?motivo=${a.motivo}`, { replace: true });
      else if (!permitidos.includes(a.perfil)) navigate('/acesso-indisponivel?motivo=sem-permissao', { replace: true });
      else setPerfil(a.perfil);
    });
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return perfil;
}
