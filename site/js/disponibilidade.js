/* ═══════════════════════════════════════════════════════════════════
   DISPONIBILIDADE — liga o botão "Ver disponibilidade" ao banco (Supabase)
   O site só CONSULTA: chama a função pública consultar_disponibilidade do
   schema "SE". A chave abaixo é a chave pública (publishable) do Supabase,
   feita para ficar no navegador: ela não lê nenhuma tabela nem grava nada.
   Nunca coloque aqui a chave secreta (service_role / secret).
═══════════════════════════════════════════════════════════════════ */
window.Disponibilidade = (function () {
  var CONFIG = {
    url:    'https://tnjpyjbqcjrowzjfnuln.supabase.co',
    chave:  'sb_publishable_VJqLlw2XZu8v5GSAWWfOfw_qUYdyXDF',
    schema: 'SE',
    contato: 'reservas@solardoespinhaco.com.br'
  };

  var ultimo = null;      /* { chave, resposta } da última consulta exibida */
  var pedido = 0;         /* descarta respostas antigas se o hóspede clicar de novo */

  var t = function (s) { return I18N.t(s); };

  function iso(d) {
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dia = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + dia;
  }
  function deIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function moeda(v) {
    var loc = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }[I18N.lang()] || 'pt-BR';
    return Number(v).toLocaleString(loc, { style: 'currency', currency: 'BRL' });
  }
  function chaveDe(s) {
    return [s.checkin && iso(s.checkin), s.checkout && iso(s.checkout), s.adults, s.children, s.babies].join('|');
  }
  function barra() {
    var el = document.getElementById('bkAgain');
    if (!el) {
      el = document.createElement('button');
      el.id = 'bkAgain'; el.type = 'button';
      el.className = 'glass-panel rounded-2xl';
      el.setAttribute('data-i18n-skip', '');
      el.onclick = function () { esconder(); };
      document.getElementById('bkPopup').insertBefore(el, document.getElementById('bkPopup').firstChild);
    }
    return el;
  }
  /* depois da busca: recolhe a barra e deixa um resumo com seta verde para pesquisar de novo */
  function colapsar() {
    var d = function (id) { return document.getElementById(id).textContent; };
    var el = barra();
    el.innerHTML = '<span class="bka-resumo">' + d('checkinDisplay') + ' → ' + d('checkoutDisplay') + ' · ' + d('guestsDisplay') + '</span>' +
      '<span class="bka-seta" aria-label="' + t('Pesquisar novamente') + '"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15l7-7 7 7"/></svg></span>';
    el.setAttribute('aria-label', t('Pesquisar novamente'));
    el.classList.add('is-on');
    document.getElementById('bkPopup').classList.add('bk-collapsed');
  }
  function painel() {
    var el = document.getElementById('bkResult');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bkResult';
      el.className = 'glass-panel rounded-2xl';
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('data-i18n-skip', '');
      document.getElementById('bkPopup').appendChild(el);
    }
    return el;
  }
  function destacar(campo) {
    var el = document.querySelector('[data-field="' + campo + '"]');
    if (!el) return;
    el.classList.remove('bk-need');
    void el.offsetWidth;                 /* reinicia a animação se clicar de novo */
    el.classList.add('bk-need');
    setTimeout(function () { el.classList.remove('bk-need'); }, 1800);
  }
  function esconder() {
    var el = document.getElementById('bkResult');
    if (el) { el.classList.remove('is-on'); el.innerHTML = ''; }
    var ag = document.getElementById('bkAgain');
    if (ag) ag.classList.remove('is-on');
    document.getElementById('bkPopup').classList.remove('bk-collapsed');
    ultimo = null;
  }
  function mostrar(html, tipo) {
    var el = painel();
    el.className = 'glass-panel rounded-2xl is-on ' + (tipo || '');
    el.innerHTML = '<button type="button" class="bkr-close" onclick="closeBkPopup()" aria-label="' + t('Fechar') + '"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' + html;
  }

  var MOTIVOS = {
    datas_invalidas: 'O check-out precisa ser depois do check-in.',
    data_passada:    'Escolha uma data de check-in a partir de hoje.',
    estadia_longa:   'A estadia passa do máximo de noites permitido. Escolha um período menor.',
    unidade_inativa: 'O chalé não está disponível para reserva no momento.',
    capacidade:      'O chalé recebe até 2 adultos e 2 crianças ou bebês.',
    sem_tarifa:      'Ainda não abrimos a agenda para essas datas.',
    fechado:         'Uma das noites escolhidas não está disponível.',
    sem_chegada:     'Não há check-in nesse dia. Escolha outra data de chegada.',
    sem_saida:       'Não há check-out nesse dia. Escolha outra data de saída.',
    ocupado:         'Essas datas já estão reservadas. Tente outras datas.'
  };

  function renderizar(r) {
    if (!r.disponivel) {
      var msg = r.motivo === 'min_noites'
        ? t('Para essas datas, a estadia mínima é de {n} noites.').replace('{n}', r.qtde_min_noites)
        : t(MOTIVOS[r.motivo] || 'Essas datas não estão disponíveis.');
      mostrar(
        '<div class="bkr-head"><iconify-icon icon="solar:calendar-minimalistic-linear" width="16"></iconify-icon>' +
        '<span>' + t('Indisponível') + '</span></div>' +
        '<p class="bkr-msg">' + msg + '</p>', 'is-off');
      colapsar();
      return;
    }
    var noites = (r.ds_detalhe || []).map(function (n) {
      return '<li><span>' + I18N.date(deIso(n.dt_ref)) + '</span><span>' + moeda(n.vl_noite) + '</span></li>';
    }).join('');
    var saldo = Number(r.vl_total) - Number(r.vl_sinal);
    var qtd = r.qtde_noites + ' ' + t(r.qtde_noites === 1 ? 'noite' : 'noites');
    var corpo = t('Olá! Quero reservar a {chale}. Check-in: {ci}. Check-out: {co}. Hóspedes: {h}. Total: {total}.')
      .replace('{chale}', r.nm_unidade).replace('{ci}', document.getElementById('checkinDisplay').textContent)
      .replace('{co}', document.getElementById('checkoutDisplay').textContent).replace('{h}', document.getElementById('guestsDisplay').textContent)
      .replace('{total}', moeda(r.vl_total));
    var assunto = encodeURIComponent(t('Reserva') + ' ' + r.nm_unidade) + '&body=' + encodeURIComponent(corpo);
    mostrar(
      '<div class="bkr-head is-ok"><iconify-icon icon="solar:check-circle-linear" width="16"></iconify-icon>' +
      '<span>' + t('Disponível') + ' · ' + r.nm_unidade + '</span></div>' +
      '<details class="bkr-noites"><summary>' + qtd + ' · ' + t('ver valor de cada noite') + '</summary><ul>' + noites + '</ul></details>' +
      '<dl class="bkr-valores">' +
        '<div class="bkr-total"><dt>' + t('Total da estadia') + '</dt><dd>' + moeda(r.vl_total) + '</dd></div>' +
        '<div><dt>' + t('Sinal para reservar (50%)') + '</dt><dd>' + moeda(r.vl_sinal) + '</dd></div>' +
        '<div><dt>' + t('Saldo no check-in') + '</dt><dd>' + moeda(saldo) + '</dd></div>' +
      '</dl>' +
      '<p class="bkr-nota">' + t('Bebês até 1 ano não pagam. Valores consultados agora; as datas só ficam garantidas ao concluir a reserva.') + '</p>' +
      '<a class="bkr-cta" href="mailto:' + CONFIG.contato + '?subject=' + assunto + '">' + t('Realizar reserva') +
      ' <iconify-icon icon="solar:arrow-right-linear" width="12"></iconify-icon></a>', 'is-ok');
    colapsar();
  }

  function consultar() {
    var s = Booking.getState();
    if (!s.checkin || !s.checkout) {
      /* faltam datas: abre o calendário do campo que falta (sem fechar se já estiver aberto)
         e destaca o campo, em vez de uma mensagem por cima do calendário */
      esconder();
      var campo = !s.checkin ? 'checkin' : 'checkout';
      if (s.active !== campo) Booking.open(campo);
      destacar(campo);
      return;
    }
    var chave = chaveDe(s);
    var meu = ++pedido;
    mostrar('<p class="bkr-msg bkr-load">' + t('Consultando disponibilidade…') + '</p>');
    fetch(CONFIG.url + '/rest/v1/rpc/consultar_disponibilidade', {
      method: 'POST',
      headers: {
        apikey: CONFIG.chave,
        'Content-Type': 'application/json',
        'Content-Profile': CONFIG.schema
      },
      body: JSON.stringify({
        p_checkin: iso(s.checkin), p_checkout: iso(s.checkout),
        p_adultos: s.adults, p_criancas: s.children, p_bebes: s.babies
      })
    })
      .then(function (resp) { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
      .then(function (lista) {
        if (meu !== pedido) return;
        var r = lista && lista[0];
        if (!r) throw new Error('sem resposta');
        ultimo = { chave: chave, resposta: r };
        renderizar(r);
      })
      .catch(function () {
        if (meu !== pedido) return;
        ultimo = null;
        mostrar('<p class="bkr-msg">' + t('Não foi possível consultar agora. Tente de novo em instantes.') + '</p>', 'is-off');
      });
  }

  /* Datas ou hóspedes mudaram: o resultado mostrado deixa de valer. */
  function estadoMudou() {
    if (ultimo && ultimo.chave !== chaveDe(Booking.getState())) esconder();
  }
  /* Troca de idioma: redesenha o resultado no idioma novo. */
  function idiomaMudou() { if (ultimo) renderizar(ultimo.resposta); }

  return { consultar: consultar, estadoMudou: estadoMudou, idiomaMudou: idiomaMudou, esconder: esconder };
})();
