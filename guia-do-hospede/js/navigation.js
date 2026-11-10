/* ══════════════════════════════════════════════════════════
   NAVIGATION — roteamento entre telas, histórico do navegador
   (botão voltar físico/gesto funciona) e bottom navigation.
═══════════════════════════════════════════════════════════ */
'use strict';

const Nav = (() => {
  const LIGHT_SCREENS = new Set([
    'wifi', 'checkin', 'chale', 'cafe', 'serra', 'restaurantes',
    'compras', 'lapinha', 'regras', 'transporte', 'servicos',
    'emergencia', 'avaliacao'
  ]);

  // Mapa: id de tela → item ativo correspondente no bottom nav
  // (bottom nav tem 4 atalhos fixos: Início / Wi-Fi / Serra / Emergência —
  // as demais telas ficam sob "Início", já que se chega a elas pelo menu)
  const NAV_MAP = {
    cover: 'home', menu: 'home',
    checkin: 'home', chale: 'home', cafe: 'home',
    restaurantes: 'home', compras: 'home', lapinha: 'home',
    regras: 'home', transporte: 'home', servicos: 'home', avaliacao: 'home',
    wifi: 'wifi',
    serra: 'trilhas',
    emergencia: 'emergencia'
  };

  let stack = ['cover'];

  function currentId() {
    const el = document.querySelector('.screen.active');
    return el ? el.id : null;
  }

  function applyScreen(id, { pushHistory = true } = {}) {
    const next = document.getElementById(id);
    if (!next) return false;
    const cur = document.querySelector('.screen.active');

    // Só mexe nas telas se de fato for uma troca — mas os efeitos
    // "globais" (classe do body, sincronia da bottom nav) precisam
    // rodar sempre, inclusive na primeira chamada do carregamento da
    // página, quando a tela inicial já nasce com a classe "active" no
    // HTML e cur === next.
    if (cur !== next) {
      if (cur) cur.classList.remove('active');
      next.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    document.body.classList.toggle('on-light-screen', LIGHT_SCREENS.has(id));
    // A tela de abertura (Hero) não mostra a navegação inferior — o
    // hambúrguer e o botão "Abrir o guia" já dão acesso ao conteúdo.
    document.body.classList.toggle('on-cover', id === 'cover');

    syncBottomNav(id);

    if (pushHistory && cur !== next) {
      if (stack[stack.length - 1] !== id) stack.push(id);
      history.pushState({ screen: id }, '', '#' + id);
    }

    if (window.Components) window.Components.observeReveals();
    return true;
  }

  function openScreen(id) {
    applyScreen(id, { pushHistory: true });
  }

  function goBack() {
    if (stack.length > 1) {
      stack.pop();
      const prev = stack[stack.length - 1];
      history.back();
      return prev;
    }
    return currentId();
  }

  function syncBottomNav(id) {
    const target = NAV_MAP[id] || 'home';
    document.querySelectorAll('.bn-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.target === target);
    });
  }

  function initHistory() {
    // Estado inicial: se a URL já trouxer um hash válido, abre direto nele
    const initial = (location.hash || '').replace('#', '');
    const startId = document.getElementById(initial) ? initial : 'cover';
    history.replaceState({ screen: startId }, '', startId === 'cover' ? '#' : '#' + startId);
    applyScreen(startId, { pushHistory: false });

    window.addEventListener('popstate', (ev) => {
      const id = (ev.state && ev.state.screen) || 'cover';
      if (stack[stack.length - 1] !== id) {
        // sincroniza a pilha interna com o histórico do navegador
        const idx = stack.lastIndexOf(id);
        if (idx >= 0) stack = stack.slice(0, idx + 1);
        else stack.push(id);
      }
      applyScreen(id, { pushHistory: false });
    });
  }

  function initBottomNav() {
    document.querySelectorAll('.bn-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const screenId = btn.dataset.screen;
        if (screenId) openScreen(screenId);
      });
    });
  }

  function initBackButtons() {
    document.addEventListener('click', (ev) => {
      const back = ev.target.closest('[data-back]');
      if (back) goBack();
    });
  }

  function init() {
    initHistory();
    initBottomNav();
    initBackButtons();
  }

  return { init, openScreen, goBack, currentId };
})();

window.Nav = Nav;
window.openScreen = Nav.openScreen; // compatível com onclick="openScreen('id')" no HTML
