/* ══════════════════════════════════════════════════════════
   SITE NAV — réplica do comportamento do nav-top do index.html
   (transparente no topo, vidro pine ao rolar; hambúrguer abre
   o menu inline; seletor de idioma cosmético; logo com animação
   de entrada — disco que se expande no wordmark completo).
   Vive na tela "cover" (Hero) do guia.
═══════════════════════════════════════════════════════════ */
'use strict';

(function () {
  const nav = document.getElementById('siteNav');
  if (!nav) return;

  function onScroll() {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = document.getElementById('menuBurger');
  const menu = document.getElementById('siteMenu');
  const menuZone = document.getElementById('menuZone');
  if (burger && menu) {
    function openMenu() {
      menu.classList.add('is-open');
      burger.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
    }
    function closeMenu() {
      menu.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    }
    burger.addEventListener('click', () =>
      menu.classList.contains('is-open') ? closeMenu() : openMenu()
    );
    menu.querySelectorAll('a').forEach((l) => l.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
    if (menuZone) menuZone.addEventListener('mouseleave', closeMenu);
  }
})();

/* Seletor de idioma — cosmético, mesmo padrão visual do index.html
   (o conteúdo do guia permanece em pt-BR; troca real de idioma
   exigiria traduzir todo o conteúdo, fora do escopo desta réplica visual) */
function setLang(lang) {
  document.querySelectorAll('.lang-inline-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

/* ── NAV LOGO INTRO ANIMATION — idêntica ao index.html ──
   Fase 1 (80ms): disco + menu + idioma surgem com fade.
   Fase 2 (4100ms): disco desliza (FLIP) e o wordmark
   "Solar do Espinhaço" se revela ao lado dele. */
(function () {
  const disc     = document.getElementById('navLogoDisc');
  const expand   = document.getElementById('navLogoExpand');
  const wordmark = document.getElementById('navLogoWordmark');
  const menuZone = document.getElementById('menuZone');
  const navRight = document.getElementById('navRight');
  if (!disc || !expand || !menuZone || !navRight) return;

  disc.style.opacity = '0';
  menuZone.style.opacity = '0';
  menuZone.style.transition = 'none';
  menuZone.style.pointerEvents = 'none';
  navRight.style.opacity = '0';
  navRight.style.transition = 'none';
  navRight.style.pointerEvents = 'none';

  setTimeout(function () {
    disc.style.transition = 'opacity 1.2s ease';
    disc.style.opacity = '1';
    menuZone.style.transition = 'opacity 1.2s ease';
    menuZone.style.opacity = '1';
    menuZone.style.pointerEvents = 'auto';
    navRight.style.transition = 'opacity 1.2s ease';
    navRight.style.opacity = '1';
    navRight.style.pointerEvents = 'auto';
  }, 80);

  setTimeout(function () {
    const before = disc.getBoundingClientRect();

    expand.style.transition = 'none';
    expand.style.maxWidth = '240px';

    void expand.offsetWidth;
    const after = disc.getBoundingClientRect();
    const dx = before.left - after.left;

    disc.style.transition = 'none';
    if (dx !== 0) disc.style.transform = 'translateX(' + dx + 'px)';
    void disc.offsetWidth;

    disc.style.transition = 'transform 1s cubic-bezier(0.65, 0, 0.35, 1)';
    disc.style.transform = 'translateX(0)';

    expand.style.transition = 'opacity 0.8s ease 0.3s';
    expand.style.opacity = '1';
    if (wordmark) {
      wordmark.style.transition = 'transform 0.9s cubic-bezier(0.65, 0, 0.35, 1) 0.3s';
      wordmark.style.transform = 'translateX(0)';
    }
  }, 4100);
})();
