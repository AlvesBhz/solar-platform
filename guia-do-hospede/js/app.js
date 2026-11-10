/* ══════════════════════════════════════════════════════════
   APP — ponto de entrada. Inicializa navegação, componentes,
   dados e o service worker (PWA).
═══════════════════════════════════════════════════════════ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  Nav.init();
  Components.observeReveals();
  Components.initCopyButtons();
  GuideData.init();
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      /* PWA é um extra — se falhar (ex.: aberto via file://), o app
         continua funcionando normalmente sem cache offline. */
    });
  });
}
