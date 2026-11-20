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
      '<span class="bka-seta" aria-label="' + t('Pesquisar novamente') + '"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg></span>';
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
    var st = Booking.getState();
    var urlReserva = 'reserva.html?ci=' + iso(st.checkin) + '&co=' + iso(st.checkout) + '&a=' + st.adults + '&c=' + st.children + '&b=' + st.babies;
    mostrar(
      '<div class="bkr-head is-ok"><iconify-icon icon="solar:check-circle-linear" width="16"></iconify-icon>' +
      '<span>' + t('Disponível') + ' · ' + r.nm_unidade + '</span></div>' +
      '<details class="bkr-noites" open><summary>' + qtd + ' · ' + t('ver valor de cada noite') + '</summary><ul>' + noites + '</ul></details>' +
      '<dl class="bkr-valores">' +
        '<div class="bkr-total"><dt>' + t('Total da estadia') + '</dt><dd>' + moeda(r.vl_total) + '</dd></div>' +
        '<div><dt>' + t('Sinal para reservar (50%)') + '</dt><dd>' + moeda(r.vl_sinal) + '</dd></div>' +
        '<div><dt>' + t('Saldo no check-in') + '</dt><dd>' + moeda(saldo) + '</dd></div>' +
      '</dl>' +
      '<p class="bkr-nota">' + t('Bebês até 1 ano não pagam. Valores consultados agora; as datas só ficam garantidas ao concluir a reserva.') + '</p>' +
      '<a class="bkr-cta" href="' + urlReserva + '">' + t('Realizar reserva') +
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

  /* Preço de cada noite no calendário, para os hóspedes escolhidos (cache por mês e hóspedes). */
  var cachePrecos = {};
  function precosDoMes(ano, mes0) {
    var s = Booking.getState(), ini = new Date(ano, mes0, 1), fim = new Date(ano, mes0 + 1, 1);
    var chave = [iso(ini), s.adults, s.children, s.babies].join('|');
    if (!cachePrecos[chave]) {
      cachePrecos[chave] = fetch(CONFIG.url + '/rest/v1/rpc/consultar_precos', {
        method: 'POST',
        headers: { apikey: CONFIG.chave, 'Content-Type': 'application/json', 'Content-Profile': CONFIG.schema },
        body: JSON.stringify({ p_inicio: iso(ini), p_fim: iso(fim), p_adultos: s.adults, p_criancas: s.children, p_bebes: s.babies })
      }).then(function (r) {
          if (r.status === 404) return precosPorDisponibilidade(ini, fim, s); // banco ainda sem consultar_precos
          if (!r.ok) throw new Error(); return r.json();
        })
        .then(function (l) { var m = {}; l.forEach(function (x) { m[x.dt_ref] = x; }); return m; })
        .catch(function () { delete cachePrecos[chave]; return null; });
    }
    return cachePrecos[chave];
  }
  /* Alternativa enquanto consultar_precos não existe no banco: usa consultar_disponibilidade em blocos de
     até 7 noites; num bloco indisponível, consulta noite a noite para saber quais estão livres. */
  function rpcDisp(ci, co, s) {
    return fetch(CONFIG.url + '/rest/v1/rpc/consultar_disponibilidade', {
      method: 'POST',
      headers: { apikey: CONFIG.chave, 'Content-Type': 'application/json', 'Content-Profile': CONFIG.schema },
      body: JSON.stringify({ p_checkin: iso(ci), p_checkout: iso(co), p_adultos: s.adults, p_criancas: s.children, p_bebes: s.babies })
    }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (l) { return l[0] || null; });
  }
  function soma(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function precosPorDisponibilidade(ini, fim, s) {
    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var d = ini < hoje ? hoje : ini, blocos = [];
    for (; d < fim; d = soma(d, 7)) blocos.push([d, soma(d, 7) < fim ? soma(d, 7) : fim]);
    function noites(r, a, b, livre) {
      var det = {}; ((r && r.ds_detalhe) || []).forEach(function (x) { det[x.dt_ref] = x.vl_noite; });
      var out = [];
      for (var x = a; x < b; x = soma(x, 1)) out.push({ dt_ref: iso(x), vl_noite: det[iso(x)] != null ? det[iso(x)] : null, livre: livre && det[iso(x)] != null });
      return out;
    }
    return Promise.all(blocos.map(function (bl) {
      return rpcDisp(bl[0], bl[1], s).then(function (r) {
        if (r && r.disponivel) return noites(r, bl[0], bl[1], true);
        var um = [];
        for (var x = bl[0]; x < bl[1]; x = soma(x, 1)) um.push(x);
        return Promise.all(um.map(function (x) {
          return rpcDisp(x, soma(x, 1), s).then(function (r1) {
            var ok = r1 && (r1.disponivel || r1.motivo === 'min_noites');
            return noites(r1, x, soma(x, 1), !!ok)[0];
          });
        }));
      });
    })).then(function (ls) { return [].concat.apply([], ls); });
  }
  function curto(v) { return Math.round(v).toLocaleString('pt-BR'); }
  function precosNoCalendario(cal, ano, mes0) {
    precosDoMes(ano, mes0).then(function (m) {
      if (!m) return;
      var achou = false;
      cal.querySelectorAll('.cal-d').forEach(function (c) {
        var x = c._date && m[iso(c._date)];
        if (!x || c.classList.contains('cal-off')) return;
        if (x.livre && x.vl_noite != null) {
          var p = document.createElement('span'); p.className = 'cal-p'; p.textContent = curto(Number(x.vl_noite));
          c.title = moeda(x.vl_noite) + ' / ' + t('noite'); c.appendChild(p); achou = true;
        } else c.classList.add('cal-ocu');
      });
      if (achou && !cal.querySelector('.cal-pnota')) {
        var n = document.createElement('div'); n.className = 'cal-pnota';
        n.textContent = t('Valor por noite') + ' · ' + document.getElementById('guestsDisplay').textContent;
        cal.appendChild(n);
      }
    });
  }

  /* Datas ou hóspedes mudaram: o resultado mostrado deixa de valer. */
  function estadoMudou() {
    if (ultimo && ultimo.chave !== chaveDe(Booking.getState())) esconder();
  }
  /* Troca de idioma: redesenha o resultado no idioma novo. */
  function idiomaMudou() { if (ultimo) renderizar(ultimo.resposta); }

  return { precosNoCalendario: precosNoCalendario, consultar: consultar, estadoMudou: estadoMudou, idiomaMudou: idiomaMudou, esconder: esconder };
})();
