/* Solar do Espinhaço — scripts do site (extraído dos <script> inline) */

/* Experiências — Caderno de Campo da Serra */
/* ── EXPERIÊNCIAS · Caderno de Campo da Serra ── */
(function () {
  var track    = document.getElementById('expTrack');
  var btnPrev  = document.getElementById('expPrev');
  var btnNext  = document.getElementById('expNext');
  var counter  = document.getElementById('expCounter');
  var progress = document.getElementById('expProgress');
  if (!track || !btnPrev || !btnNext) return;

  var cards = track.querySelectorAll('.exp-card');
  var TOTAL = cards.length;
  var GAP   = 28; /* 1.75rem ≈ 28px */

  function cardWidth() {
    return cards[0] ? cards[0].offsetWidth + GAP : 300;
  }

  function currentIndex() {
    return Math.round(track.scrollLeft / cardWidth());
  }

  function updateUI() {
    var idx = currentIndex();
    var cur = String(Math.min(idx + 1, TOTAL)).padStart(2, '0');
    var tot = String(TOTAL).padStart(2, '0');
    counter.textContent = cur + ' — ' + tot;
    btnPrev.disabled = idx <= 0;
    btnNext.disabled = idx >= TOTAL - 1;
    if (progress) {
      var max = track.scrollWidth - track.clientWidth;
      var pct = max > 0 ? track.scrollLeft / max : 0;
      /* Mapeia 0→1/TOTAL até 1→1 para que o ponto de partida mostre a fatia do card 1 */
      var fill = (1 / TOTAL) + pct * ((TOTAL - 1) / TOTAL);
      progress.style.transform = 'scaleX(' + fill.toFixed(4) + ')';
    }
  }

  /* Setas */
  btnPrev.addEventListener('click', function () {
    track.scrollBy({ left: -cardWidth(), behavior: 'smooth' });
  });
  btnNext.addEventListener('click', function () {
    track.scrollBy({ left: cardWidth(), behavior: 'smooth' });
  });

  /* Teclado (quando o trilho está focado) */
  track.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left:  cardWidth(), behavior: 'smooth' }); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); track.scrollBy({ left: -cardWidth(), behavior: 'smooth' }); }
  });

  /* Scroll listener */
  track.addEventListener('scroll', updateUI, { passive: true });

  /* Drag-to-scroll com inércia */
  var dragging = false, startX, startScroll, velX = 0, lastX, lastT, rafId;

  track.addEventListener('pointerdown', function (e) {
    dragging = true; startX = e.clientX; startScroll = track.scrollLeft;
    lastX = e.clientX; lastT = Date.now(); velX = 0;
    track.classList.add('is-dragging');
    track.setPointerCapture(e.pointerId);
    cancelAnimationFrame(rafId);
  });

  track.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var now = Date.now(), dt = now - lastT || 1;
    velX = (e.clientX - lastX) / dt;
    lastX = e.clientX; lastT = now;
    track.scrollLeft = startScroll - (e.clientX - startX);
  });

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');
    (function glide() {
      if (Math.abs(velX) < 0.3) return;
      track.scrollLeft -= velX * 14;
      velX *= 0.88;
      rafId = requestAnimationFrame(glide);
    })();
  }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  /* Previne click após drag */
  track.addEventListener('click', function (e) {
    if (Math.abs(track.scrollLeft - startScroll) > 6) e.stopPropagation();
  }, true);

  updateUI();
})();

/* ── HERO: título some, frase surge ── */
(function () {
  const title  = document.getElementById('heroTitle');
  const phrase = document.getElementById('heroPhrase');
  const scroll = document.getElementById('heroScroll');
  if (!title || !phrase) return;

  // fadeIn completa em 1.5 s (delay 0.3 + duração 1.2)
  // fade-out inicia imediatamente após
  setTimeout(function () {

    // 1 · inicia fade-out gradual (9 s, apaga suavemente)
    title.classList.add('fade-out');
    if (scroll) scroll.style.opacity = '0';

    // 2 · texto some e frase surge aos ~4.1 s totais (2.6 s após fade-out iniciar)
    setTimeout(function () {
      title.style.display = 'none';
      phrase.classList.add('is-visible');
    }, 2600);

  }, 1500);
})();

/* ── NAV: transparente no topo, pine glass ao rolar ── */
(function () {
  const nav = document.getElementById('siteNav');
  function onScroll() {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // estado inicial
})();

/* ── BOOKING DYNAMICS ── */
const Booking = (() => {
  const TODAY  = new Date(); TODAY.setHours(0,0,0,0);
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const WDAYS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  // placeholders para evitar erros de referência das variáveis antigas
  const PT_M = MONTHS, EN_M = MONTHS, ES_M = MONTHS;
  const PT_D = WDAYS,  EN_D = WDAYS,  ES_D = WDAYS;

  /* ── Estado ── */
  let s = {
    checkin:   null,
    checkout:  null,
    adults:    2,
    children:  1,
    active:    null,
    selecting: false,
    start:     null,
    hover:     null,
    cy: TODAY.getFullYear(),
    cm: TODAY.getMonth(),
    blocked:   [],
  };

  /* helpers */
  const same = (a, b) => !!(a && b && a.getTime() === b.getTime());
  const fmt  = d => d ? `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.getFullYear()}` : '';
  const nts  = () => (s.checkin && s.checkout)
    ? Math.round((s.checkout - s.checkin) / 864e5) : 0;

  /* ── Atualiza barra ── */
  function updateDisplays() {
    const ci = document.getElementById('checkinDisplay');
    const co = document.getElementById('checkoutDisplay');
    if (!ci || !co) return;
    ci.textContent = fmt(s.checkin)  || 'Selecionar data';
    co.textContent = fmt(s.checkout) || 'Selecionar data';
    const g = document.getElementById('guestsDisplay');
    if (g) {
      const aw = s.adults   === 1 ? 'Adulto'  : 'Adultos';
      const cw = s.children === 1 ? 'Criança' : 'Crianças';
      g.textContent = s.children === 0
        ? `${s.adults} ${aw}`
        : `${s.adults} ${aw}, ${s.children} ${cw}`;
    }
  }

  /* ── Fecha popovers ── */
  function close() {
    document.querySelectorAll('.bk-pop').forEach(p => p.remove());
    s.active    = null;
    s.selecting = false;
    s.start     = null;
    s.hover     = null;
  }

  /* ── Hover preview sem rebuild ── */
  function applyHover() {
    document.querySelectorAll('.bk-pop-cal .cal-d').forEach(cell => {
      const d = cell._date;
      cell.classList.remove('cal-prev', 'cal-prev-end');
      if (!d || !s.selecting || !s.start || !s.hover || s.hover <= s.start) return;
      if (d > s.start && d < s.hover) cell.classList.add('cal-prev');
      if (same(d, s.hover))           cell.classList.add('cal-prev', 'cal-prev-end');
    });
  }

  /* ── Seleciona data ── */
  function pickDay(date) {
    if (!s.selecting) {
      s.start     = date;
      s.selecting = true;
      s.checkin   = null;
      s.checkout  = null;
      s.hover     = null;
      updateDisplays();
      refresh();
    } else {
      if (date <= s.start) {
        s.start = date;
        s.hover = null;
        refresh();
      } else {
        s.checkin   = s.start;
        s.checkout  = date;
        s.selecting = false;
        s.start     = null;
        s.hover     = null;
        updateDisplays();
        refresh();
        setTimeout(close, 440);
      }
    }
  }

  /* ── Constrói calendário ── */
  function buildCal() {
    const firstWd = new Date(s.cy, s.cm, 1).getDay();
    const daysInM = new Date(s.cy, s.cm + 1, 0).getDate();
    const pop = document.createElement('div');
    pop.className = 'bk-pop bk-pop-cal';

    const hdr = document.createElement('div');
    hdr.className = 'cal-head';
    hdr.innerHTML = `
      <button class="cal-arrow" id="calPrev" type="button">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span class="cal-month">${MONTHS[s.cm]} ${s.cy}</span>
      <button class="cal-arrow" id="calNext" type="button">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>`;
    pop.appendChild(hdr);

    const wdRow = document.createElement('div');
    wdRow.className = 'cal-wdays';
    WDAYS.forEach(d => {
      const wd = document.createElement('div');
      wd.className = 'cal-wd';
      wd.textContent = d;
      wdRow.appendChild(wd);
    });
    pop.appendChild(wdRow);

    const grid = document.createElement('div');
    grid.className = 'cal-grid';

    for (let i = 0; i < firstWd; i++) {
      const e = document.createElement('div');
      e.className = 'cal-d cal-empty';
      grid.appendChild(e);
    }

    for (let day = 1; day <= daysInM; day++) {
      const date = new Date(s.cy, s.cm, day);
      const cell = document.createElement('div');
      cell.className  = 'cal-d';
      cell.textContent = day;
      cell._date = date;

      const isPast = date < TODAY;
      const isBlk  = s.blocked.some(b => same(b, date));

      if (isPast || isBlk) {
        cell.classList.add(isBlk ? 'cal-blocked' : 'cal-off');
      } else {
        if (same(date, TODAY)) cell.classList.add('cal-today');

        if (!s.selecting) {
          const isCi  = same(date, s.checkin);
          const isCo  = same(date, s.checkout);
          const inRng = s.checkin && s.checkout && date > s.checkin && date < s.checkout;
          if (isCi || isCo) {
            cell.classList.add('cal-sel');
            if (isCi && s.checkout) cell.classList.add('cal-rs');
            if (isCo && s.checkin)  cell.classList.add('cal-re');
          }
          if (inRng) cell.classList.add('cal-range');
        }

        if (s.selecting && same(date, s.start)) cell.classList.add('cal-sel');

        cell.addEventListener('mouseenter', () => {
          if (!s.selecting) return;
          s.hover = date;
          applyHover();
        });
        cell.addEventListener('click', e => {
          e.stopPropagation();
          pickDay(date);
        });
      }
      grid.appendChild(cell);
    }
    pop.appendChild(grid);

    pop.addEventListener('mouseleave', () => {
      if (!s.selecting) return;
      s.hover = null;
      applyHover();
    });

    const footer = document.createElement('div');
    footer.className = 'cal-footer';
    const n = nts();
    if (n > 0 && !s.selecting) {
      const ni = document.createElement('span');
      ni.className = 'cal-nights';
      ni.textContent = `${n} ${n === 1 ? 'noite' : 'noites'}`;
      footer.appendChild(ni);
      const cl = document.createElement('button');
      cl.className = 'cal-clear'; cl.type = 'button'; cl.textContent = 'Limpar';
      cl.addEventListener('click', e => {
        e.stopPropagation();
        s.checkin = null; s.checkout = null;
        s.selecting = false; s.start = null; s.hover = null;
        updateDisplays(); refresh();
      });
      footer.appendChild(cl);
    } else {
      const hint = document.createElement('span');
      hint.className = 'cal-hint';
      hint.textContent = s.selecting ? 'Selecione a data de saída' : 'Selecione o período desejado';
      footer.appendChild(hint);
    }
    pop.appendChild(footer);
    return pop;
  }

  function refresh() {
    const old = document.querySelector('.bk-pop-cal');
    if (!old) return;
    const savedLeft = old.style.left;
    const cal = buildCal();
    if (savedLeft) cal.style.left = savedLeft;
    old.replaceWith(cal);
    attachCalNav();
  }

  function attachCalNav() {
    const p = document.getElementById('calPrev');
    const n = document.getElementById('calNext');
    if (p) p.addEventListener('click', e => {
      e.stopPropagation(); s.cm--; if (s.cm < 0) { s.cm = 11; s.cy--; } refresh();
    });
    if (n) n.addEventListener('click', e => {
      e.stopPropagation(); s.cm++; if (s.cm > 11) { s.cm = 0; s.cy++; } refresh();
    });
  }

  /* ── Hóspedes ── */
  function buildGuests() {
    const pop = document.createElement('div');
    pop.className = 'bk-pop bk-pop-guests';
    function row(label, sub, key, min) {
      const r = document.createElement('div'); r.className = 'gst-row';
      r.innerHTML = `
        <div>
          <div class="gst-title">${label}</div>
          <div class="gst-sub">${sub}</div>
        </div>
        <div class="gst-ctrl">
          <button class="gst-btn" id="gm-${key}" type="button" ${s[key]<=min?'disabled':''}>−</button>
          <span class="gst-n" id="gn-${key}">${s[key]}</span>
          <button class="gst-btn" id="gp-${key}" type="button">+</button>
        </div>`;
      r.querySelector(`#gm-${key}`).addEventListener('click', e => {
        e.stopPropagation();
        if (s[key] > min) { s[key]--; r.querySelector(`#gn-${key}`).textContent=s[key]; r.querySelector(`#gm-${key}`).disabled=s[key]<=min; updateDisplays(); }
      });
      r.querySelector(`#gp-${key}`).addEventListener('click', e => {
        e.stopPropagation();
        s[key]++; r.querySelector(`#gn-${key}`).textContent=s[key]; r.querySelector(`#gm-${key}`).disabled=false; updateDisplays();
      });
      return r;
    }
    pop.appendChild(row('Adultos', '13+ anos', 'adults', 1));
    pop.appendChild(row('Crianças', '2–12 anos', 'children', 0));
    return pop;
  }

  /* ── API pública ── */
  function open(type) {
    if (s.active === type) { close(); return; }
    close();
    s.active = type;
    const anchor = document.getElementById('bookingAnchor');
    if (type === 'checkin' || type === 'checkout') {
      s.hover = null;
      if (type === 'checkout' && s.checkin) {
        s.start     = s.checkin;
        s.selecting = true;
        s.cy = s.checkin.getFullYear();
        s.cm = s.checkin.getMonth();
      } else {
        s.start     = null;
        s.selecting = false;
        s.cy = TODAY.getFullYear();
        s.cm = TODAY.getMonth();
      }
      const cal = buildCal();
      anchor.appendChild(cal);
      const field = anchor.querySelector('[data-field="' + type + '"]');
      if (field) cal.style.left = field.offsetLeft + 'px';
      attachCalNav();
    } else {
      anchor.appendChild(buildGuests());
    }
  }

  document.addEventListener('click', e => {
    if (!s.active) return;
    const pop = document.querySelector('.bk-pop');
    const bar = document.getElementById('bookingBar');
    if (pop && !pop.contains(e.target) && bar && !bar.contains(e.target)) close();
  });

  updateDisplays();
  return { open, close, updateDisplays, getState: () => s };
})();

/* ── LANGUAGE COMBO BOX ── */
window._lang = 'pt'; // padrão: português

function setLang(l) {
  window._lang = l;
  // atualiza label do trigger
  const label = document.getElementById('langComboLabel');
  if (label) label.textContent = l.toUpperCase();
  // mostra apenas os idiomas que NÃO estão selecionados
  document.querySelectorAll('.lang-combo-option').forEach(opt => {
    opt.style.display = opt.dataset.lang === l ? 'none' : 'flex';
  });
  Booking.updateDisplays();
}

// inicializa PT como padrão após o DOM estar pronto
document.addEventListener('DOMContentLoaded', () => setLang('pt'));

/* hover inline do botão Reservar */
(function () {
  const btn = document.getElementById('navReserveBtn');
  if (!btn) return;
  btn.addEventListener('mouseenter', () => {
    btn.style.background    = 'rgba(255,255,255,0.18)';
    btn.style.borderColor   = 'rgba(255,255,255,0.38)';
    btn.style.transform     = 'translateY(-2px)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background    = 'rgba(255,255,255,0.10)';
    btn.style.borderColor   = 'rgba(255,255,255,0.22)';
    btn.style.transform     = 'translateY(0)';
  });
})();

/* ── LANG INLINE · estado ativo ── */
(function () {
  const btns = document.querySelectorAll('.lang-inline-btn');
  btns.forEach(btn => btn.addEventListener('click', () => {
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }));
})();

/* ── SITE MENU (burger toggle) ── */
(function () {
  const burger = document.getElementById('menuBurger');
  const menu   = document.getElementById('siteMenu');

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
  menu.querySelectorAll('a').forEach(l => l.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* Fecha automaticamente ao retirar o mouse da zona do menu */
  const menuZone = document.getElementById('menuZone');
  if (menuZone) menuZone.addEventListener('mouseleave', closeMenu);
})();

/* ── SCROLL REVEAL ── */
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const delay = parseFloat(entry.target.dataset.delay || 0);
      setTimeout(() => entry.target.classList.add('visible'), delay * 1000);
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal, .reveal-left, .reveal-scale').forEach((el, i) => {
  el.dataset.delay = (i % 5) * 0.08;
  io.observe(el);
});

/* ── CHALÉ MOSAIC REVEAL ── */
(function () {
  const heads = document.querySelectorAll('.chale-head-reveal');
  const wraps = document.querySelectorAll('.chale-wrap');

  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var delay = parseInt(entry.target.dataset.chaleDelay || '0', 10);
      setTimeout(function () {
        entry.target.classList.add('is-visible');
      }, delay);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -60px 0px' });

  heads.forEach(function (el) { io.observe(el); });
  wraps.forEach(function (el) { io.observe(el); });
})();

/* ── NAV LOGO INTRO ANIMATION ── */
(function () {
  const nav      = document.getElementById('siteNav');
  const disc     = document.getElementById('navLogoDisc');
  const expand   = document.getElementById('navLogoExpand');
  const wordmark = document.getElementById('navLogoWordmark');
  const menuZone = document.getElementById('menuZone');
  const navRight = document.getElementById('navRight');
  if (!disc || !expand || !menuZone || !navRight) return;

  /* Estado inicial: só o disco visível, centrado */
  disc.style.opacity = '0';
  menuZone.style.opacity = '0';
  menuZone.style.transition = 'none';
  menuZone.style.pointerEvents = 'none';
  navRight.style.opacity = '0';
  navRight.style.transition = 'none';
  navRight.style.pointerEvents = 'none';

  /* Fase 1 · 0 → 1.2s: disco + menu + direita surgem juntos */
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

  /* Fases 3+4 · 4.1s: logo, menu e direita surgem juntos ao aparecer a frase */
  setTimeout(function () {
    /* FLIP — captura posição do disco antes da mudança de layout */
    var before = disc.getBoundingClientRect();

    /* Expande layout imediatamente (sem transição) */
    expand.style.transition = 'none';
    expand.style.maxWidth = '240px';

    /* Força reflow e captura nova posição do disco */
    void expand.offsetWidth;
    var after = disc.getBoundingClientRect();
    var dx = before.left - after.left;

    /* Aplica transformação inversa: disco permanece visualmente no centro */
    disc.style.transition = 'none';
    if (dx !== 0) disc.style.transform = 'translateX(' + dx + 'px)';
    void disc.offsetWidth;

    /* Anima disco deslizando suavemente para a posição final */
    disc.style.transition = 'transform 1s cubic-bezier(0.65, 0, 0.35, 1)';
    disc.style.transform = 'translateX(0)';

    /* Revela divider + wordmark: fade in + slide horizontal */
    expand.style.transition = 'opacity 0.8s ease 0.3s';
    expand.style.opacity = '1';
    if (wordmark) {
      wordmark.style.transition = 'transform 0.9s cubic-bezier(0.65, 0, 0.35, 1) 0.3s';
      wordmark.style.transform = 'translateX(0)';
    }

  }, 4100);

  /* Fase 5 · 6.5s: sincroniza estado de scroll */
  setTimeout(function () {
    nav.classList.toggle('is-scrolled', window.scrollY > 40);
  }, 6500);
})();

/* ── BOOKING POPUP ── */
function openBkPopup(e) {
  if (e) e.stopPropagation();
  document.getElementById('bkPopup').classList.add('is-open');
  document.body.style.overflow = 'hidden';
  Booking.updateDisplays();
}
function closeBkPopup() {
  document.getElementById('bkPopup').classList.remove('is-open');
  document.body.style.overflow = '';
  Booking.close();
}
document.addEventListener('click', function(e) {
  var popup = document.getElementById('bkPopup');
  if (!popup || !popup.classList.contains('is-open')) return;
  // Se o target foi removido do DOM (ex: célula do calendário ao fechar),
  // o clique foi dentro do popup — não fechar.
  if (!e.target.isConnected) return;
  var bar = document.getElementById('bookingBar');
  if (bar && !bar.contains(e.target)) closeBkPopup();
});
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeBkPopup(); });

/* ── D2 SLIDESHOWS — escopo por container (suporta múltiplas seções) ── */
(function () {
  document.querySelectorAll('.d2-slideshow').forEach(function (container) {
    var slides = container.querySelectorAll('.d2-slide');
    var dots   = container.querySelectorAll('.d2-dot');
    if (slides.length < 2) return;
    var current = 0;
    var timer;
    function goTo(idx) {
      slides[current].classList.remove('is-active');
      if (dots[current]) dots[current].classList.remove('is-active');
      current = (idx + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      if (dots[current]) dots[current].classList.add('is-active');
    }
    function startTimer() {
      clearInterval(timer);
      timer = setInterval(function () { goTo(current + 1); }, 5000);
    }
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); startTimer(); });
    });
    startTimer();
  });
})();

/* ── CHALÉ SLIDESHOWS — controlador independente por container ── */
(function () {
  document.querySelectorAll('.chale-slideshow').forEach(function (container) {
    var slides = container.querySelectorAll('.chale-slide');
    var dots   = container.querySelectorAll('.chale-dot-main');
    if (slides.length < 2) return;
    var current = 0;
    var timer;

    function goTo(idx) {
      slides[current].classList.remove('is-active');
      if (dots[current]) dots[current].classList.remove('is-active');
      current = (idx + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      if (dots[current]) dots[current].classList.add('is-active');
    }

    function startTimer() {
      clearInterval(timer);
      timer = setInterval(function () { goTo(current + 1); }, 6000);
    }

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { goTo(i); startTimer(); });
    });

    startTimer();
  });
})();

/* CTA final — parallax, reveals e filtro de Passeios Privativos */
/* ── PARALLAX: move fundo da serra no scroll ── */
(function () {
  const bg  = document.getElementById('ctaBg');
  const sec = document.getElementById('cta-final');
  if (!bg || !sec || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      const rect     = sec.getBoundingClientRect();
      const progress = -rect.top / (window.innerHeight + rect.height);
      bg.style.transform = 'scale(1.12) translateY(' + (progress * 8) + '%)';
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ── REVEAL · Passeios Privativos ── */
(function () {
  var sec = document.getElementById('passeios-priv');
  if (!sec) return;
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('sv'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  ['sxEyebrow','sxHeading','sxSubtext'].forEach(function (id) {
    var el = document.getElementById(id); if (el) obs.observe(el);
  });
  sec.querySelectorAll('.sx-card__heading, .sx-card__subheading, .sx-card__excerpt, .sx-card__action-link')
     .forEach(function (el) { obs.observe(el); });
})();

/* ── FILTRO · Passeios Privativos ── */
(function () {
  var wrap = document.getElementById('sxFilterWrap');
  var btn  = document.getElementById('sxFilterBtn');
  var grid = document.getElementById('sxCardsGrid');
  if (!wrap || !btn || !grid) return;

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = wrap.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', function () {
    wrap.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  });

  wrap.querySelectorAll('.sx-filter-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var filter = item.dataset.filter;
      wrap.querySelectorAll('.sx-filter-item').forEach(function (i) { i.classList.remove('is-active'); });
      item.classList.add('is-active');
      btn.childNodes[0].textContent = (filter === 'todos' ? 'Filtrar por tipo' : item.textContent) + ' +';
      grid.querySelectorAll('.sx-card').forEach(function (card) {
        card.style.display = (filter === 'todos' || card.dataset.type === filter) ? '' : 'none';
      });
      wrap.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
})();

/* ── REVEAL EM CASCATA: eyebrow → headline → sub ── */
(function () {
  const ids = ['ctaEyebrow', 'ctaHeadline', 'ctaSub'];
  const obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  ids.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) obs.observe(el);
  });
})();
