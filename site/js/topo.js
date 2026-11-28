/* Refresh sempre abre no topo: desliga a restauração automática de
     rolagem do navegador e remove o #âncora do endereço (senão o
     refresh pula direto para a seção e as animações de abertura
     acontecem fora da tela). Precisa rodar antes do resto da página. */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
