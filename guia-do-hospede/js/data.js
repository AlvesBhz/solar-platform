/* ══════════════════════════════════════════════════════════
   DATA — carrega database/guide.json e injeta o conteúdo
   dinâmico (menu da Home, listas de lugares, emergência,
   contatos) no HTML estático. Mantém o texto editorial
   (cards de narrativa, citações) direto no HTML — só o que é
   genuinamente repetitivo/tabular vem do JSON.

   Robustez: quando o app é aberto direto do disco (file://),
   fetch() de um arquivo local é bloqueado por CORS em vários
   navegadores. Por isso, se o fetch falhar, caímos de volta
   para uma cópia idêntica embutida em <script id="guide-data">
   no próprio index.html — o app nunca fica com telas vazias,
   mesmo sem servidor.
═══════════════════════════════════════════════════════════ */
'use strict';

const GuideData = (() => {
  const $  = Components.$;
  const $$ = Components.$$;

  async function load() {
    try {
      const res = await fetch('database/guide.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      const inline = document.getElementById('guide-data');
      if (inline) {
        try { return JSON.parse(inline.textContent); } catch (e) { /* segue para erro */ }
      }
      throw err;
    }
  }

  /* ── Preenche contatos/textos repetidos a partir de data-bind-* ── */
  function applyBindings(data) {
    const p = data.property;
    $$('[data-bind-wa]').forEach((el) => { el.href = 'https://wa.me/' + p.whatsapp; });
    $$('[data-bind-tel]').forEach((el) => { el.href = 'tel:+' + p.phone.replace(/\D/g, ''); });
    $$('[data-bind-tel-text]').forEach((el) => { el.textContent = p.phoneDisplay; });
    $$('[data-bind-ig]').forEach((el) => { el.href = 'https://instagram.com/' + p.instagram; });
    $$('[data-bind-ig-text]').forEach((el) => { el.textContent = '@' + p.instagram; });
    $$('[data-bind-maps]').forEach((el) => { el.href = p.mapsUrl; });
    $$('[data-bind-mail]').forEach((el) => { el.href = 'mailto:' + p.email; });
    $$('[data-bind-address]').forEach((el) => { el.textContent = p.address; });
    $$('[data-bind-checkin]').forEach((el) => { el.textContent = p.checkin; });
    $$('[data-bind-checkout]').forEach((el) => { el.textContent = p.checkout; });

    const wifi = data.wifi;
    const netEl = $('#wifiNetwork'); if (netEl) netEl.textContent = wifi.network;
    const pwdEl = $('#wifiPassword'); if (pwdEl) pwdEl.textContent = wifi.password;
    const bandEl = $('#wifiBand'); if (bandEl) bandEl.textContent = wifi.band;
    const netCopyBtn = $('#wifiNetworkCopy'); if (netCopyBtn) netCopyBtn.dataset.copy = wifi.network;
    const pwdCopyBtn = $('#wifiPasswordCopy'); if (pwdCopyBtn) pwdCopyBtn.dataset.copy = wifi.password;
    Components.initCopyButtons();
  }

  /* ── Números nacionais de emergência ── */
  function renderEmergency(data) {
    const list = $('#emergencyNationalList');
    if (!list) return;
    list.innerHTML = data.emergencyNational.map((item) => `
      <a href="tel:${item.tel}" class="emerg-btn">
        <span class="lbl-row"><iconify-icon icon="${item.icon}"></iconify-icon><span>${escapeHtml(item.label)}</span></span>
        <span class="num">${item.tel}</span>
      </a>
    `).join('');
  }

  /* ── Grade de tiles da Home, agrupada ── */
  function tileMarkup(item) {
    if (item.kind === 'pinned') {
      return `
        <button class="pinned tile-burst" onclick="openScreen('${item.id}')" data-search="${escapeAttr(item.label)}">
          <div class="pinned-ic"><iconify-icon icon="${item.icon}"></iconify-icon></div>
          <span class="pinned-lbl">${escapeHtml(item.label)}</span>
          <span class="pinned-val">${escapeHtml(item.value)}</span>
          <span class="pinned-foot">${escapeHtml(item.foot)}</span>
        </button>`;
    }
    if (item.kind === 'util') {
      return `
        <button class="util-tile" onclick="openScreen('${item.id}')" data-search="${escapeAttr(item.label)}">
          <iconify-icon icon="${item.icon}"></iconify-icon>
          <span class="ut-lbl">${escapeHtml(item.label)}</span>
        </button>`;
    }
    // kind === 'tile'
    const classes = ['menu-tile', 'tile-burst'];
    if (item.wide) classes.push('wide');
    if (item.solid) classes.push('solid');
    const photo = item.solid
      ? `<div class="photo"><iconify-icon icon="${item.icon}" width="${item.wide ? 40 : 30}"></iconify-icon></div>`
      : `<div class="photo" style="background-image:url('${item.image}')"></div>`;
    const iconDiscSize = item.wide ? 'width:44px;height:44px;' : '';
    const iconWidth = item.wide ? 22 : undefined;
    return `
      <button class="${classes.join(' ')}" onclick="openScreen('${item.id}')" data-search="${escapeAttr(stripTags(item.title))}">
        ${photo}
        <div class="ic-disc" style="${iconDiscSize}"><iconify-icon icon="${item.icon}"${iconWidth ? ` width="${iconWidth}"` : ''}></iconify-icon></div>
        <div class="body">
          <span class="num">${escapeHtml(item.num)}</span>
          <span class="title">${item.title}</span>
        </div>
      </button>`;
  }

  function renderHome(data) {
    const root = $('#homeMenuGroups');
    if (!root) return;

    const byGroup = {};
    data.menu.forEach((item) => {
      (byGroup[item.group] = byGroup[item.group] || []).push(item);
    });

    const order = Object.keys(data.groups).sort();
    root.innerHTML = order.map((g) => {
      const meta = data.groups[g];
      const items = byGroup[g] || [];
      const pinned = items.filter((i) => i.kind === 'pinned');
      const tiles  = items.filter((i) => i.kind === 'tile');
      const utils  = items.filter((i) => i.kind === 'util');

      let rows = '';
      if (pinned.length) rows += `<div class="grid grid-cols-2 gap-2.5 mb-3 reveal">${pinned.map(tileMarkup).join('')}</div>`;
      if (tiles.length)  rows += `<div class="grid grid-cols-2 gap-2.5 reveal">${tiles.map(tileMarkup).join('')}</div>`;
      if (utils.length)  rows += `<div class="grid grid-cols-4 gap-2 reveal">${utils.map(tileMarkup).join('')}</div>`;

      return `
        <div class="h-group reveal" data-group="${g}">
          <span class="n">${g} ·</span><h3>${escapeHtml(meta.title)}</h3>
          <div class="rule"></div><span class="tag">${escapeHtml(meta.tag)}</span>
        </div>
        ${rows}
      `;
    }).join('');

    Components.observeReveals();
  }

  /* ── Listas de lugares (serra, restaurantes, compras, saúde) ── */
  function placeMarkup(p) {
    const img = p.icon
      ? `<div class="place-img solid"><iconify-icon icon="${p.icon}"></iconify-icon></div>`
      : `<div class="place-img solid"><iconify-icon icon="solar:map-point-linear"></iconify-icon></div>`;
    const diff = p.diff ? `<span class="diff ${p.diff}"><span class="pip"></span>${escapeHtml(p.diffLabel)}</span>` : '';
    const meta = (p.meta || []).map((m) => `<span><iconify-icon icon="${m.icon}"></iconify-icon> ${escapeHtml(m.text)}</span>`).join('');
    return `
      <div class="place">
        ${img}
        <div class="place-body">
          <h4>${escapeHtml(p.title)}</h4>
          <p>${escapeHtml(p.text)}</p>
          <div class="place-meta">${diff}${meta}</div>
        </div>
      </div>`;
  }

  function renderPlaceLists(data) {
    Object.keys(data.places).forEach((key) => {
      const el = document.getElementById('places-' + key);
      if (!el) return;
      el.innerHTML = data.places[key].map(placeMarkup).join('');
    });
  }

  /* ── Busca (Home) ── */
  function initSearch() {
    const input = $('#guideSearchInput');
    const bar   = $('#guideSearchBar');
    const clear = $('#guideSearchClear');
    const empty = $('#guideSearchEmpty');
    if (!input) return;

    function run() {
      const q = input.value.trim().toLowerCase();
      bar.classList.toggle('has-value', !!q);
      const tiles = $$('[data-search]');
      let visibleCount = 0;
      tiles.forEach((el) => {
        const match = !q || el.dataset.search.toLowerCase().includes(q);
        el.style.display = match ? '' : 'none';
        if (match) visibleCount++;
      });
      $$('.h-group').forEach((group) => {
        const grid = group.nextElementSibling;
        let anyVisible = false;
        let node = grid;
        while (node && !node.classList.contains('h-group')) {
          if (node.querySelectorAll) {
            anyVisible = anyVisible || Array.from(node.querySelectorAll('[data-search]')).some((el) => el.style.display !== 'none');
          }
          node = node.nextElementSibling;
        }
        group.style.display = (!q || anyVisible) ? '' : 'none';
        if (grid) grid.style.display = (!q || anyVisible) ? '' : 'none';
      });
      empty.classList.toggle('show', !!q && visibleCount === 0);
    }

    input.addEventListener('input', run);
    clear.addEventListener('click', () => { input.value = ''; run(); input.focus(); });
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str) { return escapeHtml(str); }
  function stripTags(str) { return String(str ?? '').replace(/<[^>]*>/g, ''); }

  function showLoading(isLoading) {
    const skel = $('#homeSkeleton');
    const root = $('#homeMenuGroups');
    if (skel) skel.style.display = isLoading ? '' : 'none';
    if (root) root.style.display = isLoading ? 'none' : '';
  }

  function showError(retryFn) {
    const err = $('#homeError');
    if (!err) return;
    err.style.display = '';
    const btn = err.querySelector('button');
    if (btn) btn.onclick = retryFn;
  }
  function hideError() {
    const err = $('#homeError');
    if (err) err.style.display = 'none';
  }

  async function init() {
    showLoading(true);
    hideError();
    try {
      const data = await load();
      applyBindings(data);
      renderEmergency(data);
      renderHome(data);
      renderPlaceLists(data);
      initSearch();
      showLoading(false);
    } catch (err) {
      showLoading(false);
      showError(init);
      console.error('[GuideData] Falha ao carregar database/guide.json:', err);
    }
  }

  return { init };
})();

window.GuideData = GuideData;
