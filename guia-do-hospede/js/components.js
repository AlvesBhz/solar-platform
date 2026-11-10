/* ══════════════════════════════════════════════════════════
   COMPONENTS — microinterações reutilizáveis: toast,
   copiar-para-área-de-transferência e reveal on scroll.
═══════════════════════════════════════════════════════════ */
'use strict';

const Components = (() => {
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  let toastTimer;
  function toast(msg) {
    let t = $('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    t.innerHTML = '<iconify-icon icon="solar:check-circle-bold"></iconify-icon><span></span>';
    t.querySelector('span').textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function copyText(text, btn) {
    const doCopy = navigator.clipboard
      ? navigator.clipboard.writeText(text)
      : Promise.reject(new Error('Clipboard indisponível'));

    doCopy
      .then(() => {
        if (btn) {
          btn.classList.add('done');
          const orig = btn.innerHTML;
          btn.innerHTML = '<iconify-icon icon="solar:check-circle-bold"></iconify-icon>';
          setTimeout(() => { btn.classList.remove('done'); btn.innerHTML = orig; }, 1600);
        }
        toast('Copiado!');
      })
      .catch(() => toast('Não foi possível copiar — copie manualmente'));
  }

  let revealObserver;
  function observeReveals() {
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    }
    $$('.reveal:not(.visible)').forEach((el) => revealObserver.observe(el));
  }

  function initCopyButtons(root = document) {
    $$('[data-copy]', root).forEach((btn) => {
      if (btn.dataset.copyBound) return;
      btn.dataset.copyBound = '1';
      btn.addEventListener('click', () => copyText(btn.dataset.copy, btn));
    });
  }

  return { toast, copyText, observeReveals, initCopyButtons, $, $$ };
})();

window.Components = Components;
