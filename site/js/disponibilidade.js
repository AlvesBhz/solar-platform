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
    return [s.checkin && iso(s.checkin), s.checkout && iso(s.checkout), s.adults, s.children, s.older, s.babies].join('|');
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
    capacidade:      'O chalé recebe até 2 adultos e 2 crianças.',
    sem_tarifa:      'Ainda não abrimos a agenda para essas datas.',
    fechado:         'Uma das noites escolhidas não está disponível.',
    sem_chegada:     'Não há check-in nesse dia. Escolha outra data de chegada.',
    sem_saida:       'Não há check-out nesse dia. Escolha outra data de saída.',
    ocupado:         'Essas datas já estão reservadas. Tente outras datas.'
  };

  /* ── Faixas de idade das crianças e percentuais (definidos no Inspect, por pousada): rótulos do seletor de hóspedes.
     Enquanto o banco não responde (ou não tem a função), valem as faixas de sempre. */
  var REGRAS = { b: 4, m: 8, c: 13, pcB: 0, pcC: 30, pcM: 100 };
  fetch(CONFIG.url + '/rest/v1/rpc/consultar_regras_hospedes', {
    method: 'POST', headers: { apikey: CONFIG.chave, 'Content-Type': 'application/json', 'Content-Profile': CONFIG.schema }, body: '{}'
  }).then(function (r) { return r.ok ? r.json() : []; }).then(function (l) {
    var x = l && l[0]; if (!x) return;
    REGRAS = { b: x.no_idade_max_bebe, m: x.no_idade_max_crianca_menor, c: x.no_idade_max_crianca,
      pcB: x.pc_bebe == null ? REGRAS.pcB : Number(x.pc_bebe), pcC: x.pc_crianca == null ? REGRAS.pcC : Number(x.pc_crianca), pcM: x.pc_crianca_maior == null ? REGRAS.pcM : Number(x.pc_crianca_maior) };
  }).catch(function () {});
  function tpl(s, o) { var r = t(s); Object.keys(o).forEach(function (k) { r = r.split('{' + k + '}').join(o[k]); }); return r; }
  function pct(v) { return String(Math.round(v * 100) / 100).replace('.', I18N.lang() === 'en' ? '.' : ','); }
  /* rótulo da faixa no seletor de hóspedes: adults · older (crianças maiores) · children · babies */
  function rotuloFaixa(k) {
    var R = REGRAS;
    if (k === 'adults') return tpl('{n}+ anos', { n: R.c + 1 });
    if (k === 'older') return tpl('{a} a {b} anos · {pc}%', { a: R.m + 1, b: R.c, pc: pct(R.pcM) });
    if (k === 'children') return tpl('{a} a {b} anos · {pc}%', { a: R.b + 1, b: R.m, pc: pct(R.pcC) });
    return R.pcB ? tpl('até {n} anos · {pc}%', { n: R.b, pc: pct(R.pcB) }) : tpl('até {n} anos · não paga', { n: R.b });
  }

  /* ── Pacotes de datas especiais (ex.: Natal 24/12 · 3 noites R$ 2.400 · 4 noites R$ 2.900).
     Nas noites de um pacote só se vende uma das opções; o preço é sempre o do banco (calcular_estadia). */
  var cachePac = {}, pacotes = {};                    /* pacotes: "checkin|noites" → pacote, dos meses já consultados */
  function rpcPacotes(ini, fim) {
    var k = iso(ini) + '|' + iso(fim);
    if (!cachePac[k]) {
      var guardados = doNavegador('pac|' + k);                          // mesma validade (2 min) dos preços
      if (guardados) { guardados.forEach(function (p) { pacotes[p.dt_checkin + '|' + p.qtde_noites] = p; }); return (cachePac[k] = Promise.resolve(guardados)); }
      cachePac[k] = fetch(CONFIG.url + '/rest/v1/rpc/consultar_pacotes', {
        method: 'POST',
        headers: { apikey: CONFIG.chave, 'Content-Type': 'application/json', 'Content-Profile': CONFIG.schema },
        body: JSON.stringify({ p_inicio: iso(ini), p_fim: iso(fim) })
      }).then(function (r) { if (r.status === 404) return []; if (!r.ok) throw new Error(); return r.json(); })  // 404: banco ainda sem pacotes
        .then(function (l) { l.forEach(function (p) { pacotes[p.dt_checkin + '|' + p.qtde_noites] = p; }); paraNavegador('pac|' + k, l); return l; })
        .catch(function () { delete cachePac[k]; return []; });
    }
    return cachePac[k];
  }
  function listaPacotes() { return Object.keys(pacotes).map(function (k) { return pacotes[k]; }); }
  /* opções (do mesmo check-in) do pacote que toca a estadia [ini, fim) */
  function opcoesQueTocam(ini, fim) {
    var a = iso(ini), b = iso(fim);
    var toca = listaPacotes().filter(function (p) { return p.dt_checkin < b && a < p.dt_checkout; })[0];
    if (!toca) return [];
    return listaPacotes().filter(function (p) { return p.dt_checkin === toca.dt_checkin; })
      .sort(function (x, y) { return x.qtde_noites - y.qtde_noites; });
  }
  function dataBr(s) { return I18N.date(deIso(s)); }
  function escolherDatas(ci, co) {
    var st = Booking.getState();
    st.checkin = deIso(ci); st.checkout = deIso(co); st.selecting = false; st.start = null;
    Booking.updateDisplays(); consultar();
  }
  function botoesPacote(ops) {
    return '<ul class="bkr-pacotes">' + ops.map(function (p) {
      return '<li><span>' + p.qtde_noites + ' ' + t('noites') + ' · ' + dataBr(p.dt_checkin) + ' → ' + dataBr(p.dt_checkout) + '</span>' +
        '<button type="button" class="bkr-op" data-ci="' + p.dt_checkin + '" data-co="' + p.dt_checkout + '">' + moeda(p.vl_total) + '</button></li>';
    }).join('') + '</ul>';
  }
  function ligarBotoes() {
    document.querySelectorAll('#bkResult [data-ci]').forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); escolherDatas(b.getAttribute('data-ci'), b.getAttribute('data-co')); };
    });
  }

  function renderizar(r) {
    var st0 = Booking.getState();
    if (!r.disponivel && r.motivo === 'pacote') {
      var ops = opcoesQueTocam(st0.checkin, st0.checkout);
      mostrar(
        '<div class="bkr-head"><iconify-icon icon="solar:ticket-linear" width="16"></iconify-icon>' +
        '<span>' + (ops[0] ? t('Pacote {nome}').replace('{nome}', ops[0].nm_pacote) : t('Pacote')) + '</span></div>' +
        '<p class="bkr-msg">' + t('Nessas datas vendemos só pacotes. Escolha uma das opções:') + '</p>' + botoesPacote(ops), 'is-off');
      ligarBotoes();
      colapsar();
      return;
    }
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
    var pac = r.ds_detalhe && r.ds_detalhe[0] && r.ds_detalhe[0].nm_pacote;
    var urlReserva = 'reserva.html?ci=' + iso(st.checkin) + '&co=' + iso(st.checkout) + '&a=' + st.adults + '&c=' + st.children + '&m=' + st.older + '&b=' + st.babies;
    mostrar(
      '<div class="bkr-head is-ok"><iconify-icon icon="solar:check-circle-linear" width="16"></iconify-icon>' +
      '<span>' + t('Disponível') + ' · ' + (pac ? t('Pacote {nome}').replace('{nome}', pac) : r.nm_unidade) + '</span></div>' +
      (pac ? '<div id="bkOferta"></div>' : '') +
      '<details class="bkr-noites" open><summary>' + qtd + ' · ' + t('ver valor de cada noite') + '</summary><ul>' + noites + '</ul></details>' +
      '<dl class="bkr-valores">' +
        '<div class="bkr-total"><dt>' + t('Total da estadia') + '</dt><dd>' + moeda(r.vl_total) + '</dd></div>' +
        '<div><dt>' + t('Sinal para reservar (50%)') + '</dt><dd>' + moeda(r.vl_sinal) + '</dd></div>' +
        '<div><dt>' + t('Saldo no check-in') + '</dt><dd>' + moeda(saldo) + '</dd></div>' +
      '</dl>' +
      '<p class="bkr-nota">' + t('Crianças até 4 anos não pagam. Valores consultados agora; as datas só ficam garantidas ao concluir a reserva.') + '</p>' +
      '<a class="bkr-cta" href="' + urlReserva + '">' + t('Realizar reserva') +
      ' <iconify-icon icon="solar:arrow-right-linear" width="12"></iconify-icon></a>', 'is-ok');
    colapsar();
    if (pac) ofertaMaisNoites(r, st);
  }

  /* Pacote escolhido e há opção mais longa no mesmo check-in: "Por mais R$ 500, fique até 28/12" + "Fico 4 noites".
     A diferença vem do banco (consulta da opção longa com os mesmos hóspedes), então já inclui crianças e extras. */
  function ofertaMaisNoites(r, st) {
    var ci = iso(st.checkin), chave = chaveDe(st);
    rpcPacotes(st.checkin, soma(st.checkin, 1)).then(function () {
      var maior = listaPacotes().filter(function (p) { return p.dt_checkin === ci && p.qtde_noites > r.qtde_noites; })
        .sort(function (x, y) { return x.qtde_noites - y.qtde_noites; })[0];
      if (!maior) return null;
      return rpcDisp(st.checkin, deIso(maior.dt_checkout), st).then(function (r2) { return r2 && r2.disponivel ? { p: maior, r: r2 } : null; });
    }).then(function (o) {
      var el = document.getElementById('bkOferta');
      if (!o || !el || chave !== chaveDe(Booking.getState())) return;
      var dif = Number(o.r.vl_total) - Number(r.vl_total);
      el.className = 'bkr-oferta';
      el.innerHTML = '<p>' + t('Por mais {v}, fique até {d}.').replace('{v}', moeda(dif)).replace('{d}', dataBr(o.p.dt_checkout)) + '</p>' +
        '<button type="button" class="bkr-op" data-ci="' + o.p.dt_checkin + '" data-co="' + o.p.dt_checkout + '">' + t('Fico {n} noites').replace('{n}', o.p.qtde_noites) + '</button>';
      ligarBotoes();
    }).catch(function () {});
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
        p_adultos: s.adults, p_criancas: s.children, p_bebes: s.babies, p_criancas_maiores: s.older || undefined
      })
    })
      .then(function (resp) { if (!resp.ok) throw new Error('HTTP ' + resp.status); return resp.json(); })
      .then(function (lista) {
        if (meu !== pedido) return;
        var r = lista && lista[0];
        if (!r) throw new Error('sem resposta');
        ultimo = { chave: chave, resposta: r };
        if (r.motivo === 'pacote') return rpcPacotes(soma(s.checkin, -31), soma(s.checkout, 31)).then(function () { if (meu === pedido) renderizar(r); });
        renderizar(r);
      })
      .catch(function () {
        if (meu !== pedido) return;
        ultimo = null;
        mostrar('<p class="bkr-msg">' + t('Não foi possível consultar agora. Tente de novo em instantes.') + '</p>', 'is-off');
      });
  }

  /* Preço de cada noite no calendário, para os hóspedes escolhidos.
     Uma única consulta traz o mês pedido e o seguinte; o resultado fica na memória e na aba (2 min), com tempo limite
     e uma segunda tentativa. A página também pede o mês atual em segundo plano, antes de o calendário abrir. */
  var cachePrecos = {};
  var VALIDADE_MS = 120000, LIMITE_MS = 8000;
  function chaveMes(ini, s) { return [iso(ini), s.adults, s.children, s.older, s.babies].join('|'); }
  function doNavegador(k) {
    try { var x = JSON.parse(sessionStorage.getItem('pr:' + k) || 'null'); return x && Date.now() - x.t < VALIDADE_MS ? x.l : null; } catch (e) { return null; }
  }
  function paraNavegador(k, l) { try { sessionStorage.setItem('pr:' + k, JSON.stringify({ t: Date.now(), l: l })); } catch (e) { /* aba cheia ou bloqueada: segue sem */ } }
  function comLimite(url, opcoes) {
    var c = window.AbortController ? new AbortController() : null, t = setTimeout(function () { if (c) c.abort(); }, LIMITE_MS);
    if (c) opcoes.signal = c.signal;
    return fetch(url, opcoes).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  function pedirPrecos(ini, fim, s) {
    var corpo = JSON.stringify({ p_inicio: iso(ini), p_fim: iso(fim), p_adultos: s.adults, p_criancas: s.children, p_bebes: s.babies, p_criancas_maiores: s.older || undefined });
    function uma() {
      return comLimite(CONFIG.url + '/rest/v1/rpc/consultar_precos', {
        method: 'POST', headers: { apikey: CONFIG.chave, 'Content-Type': 'application/json', 'Content-Profile': CONFIG.schema }, body: corpo
      }).then(function (r) {
        if (r.status === 404) return precosPorDisponibilidade(ini, fim, s); // banco ainda sem consultar_precos
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }
    return uma().catch(function () { return new Promise(function (ok) { setTimeout(ok, 500); }).then(uma); });   // uma segunda tentativa
  }
  function porMes(lista, ini) {
    var pref = iso(ini).slice(0, 7), m = {};
    lista.forEach(function (x) { if (String(x.dt_ref).slice(0, 7) === pref) m[x.dt_ref] = x; });
    return m;
  }
  function precosDoMes(ano, mes0) {
    var s = Booking.getState(), ini = new Date(ano, mes0, 1), prox = new Date(ano, mes0 + 1, 1), fim = new Date(ano, mes0 + 2, 1);
    var k0 = chaveMes(ini, s), k1 = chaveMes(prox, s);
    if (!cachePrecos[k0]) {
      var guardada = doNavegador(k0);
      var req = guardada ? Promise.resolve(guardada) : pedirPrecos(ini, fim, s).then(function (l) { paraNavegador(k0, l); return l; });
      cachePrecos[k0] = req.then(function (l) { return porMes(l, ini); }).catch(function () { delete cachePrecos[k0]; delete cachePrecos[k1]; return null; });
      if (!cachePrecos[k1]) cachePrecos[k1] = req.then(function (l) { return porMes(l, prox); }).catch(function () { delete cachePrecos[k1]; return null; });
      setTimeout(function () { delete cachePrecos[k0]; delete cachePrecos[k1]; }, VALIDADE_MS);   // dados do banco mudam: a memória também vence
    }
    return cachePrecos[k0];
  }
  /* Em segundo plano, quando a página fica ociosa: o calendário já abre com os valores na mão. */
  function aquecer() {
    var h = new Date();
    try {
      precosDoMes(h.getFullYear(), h.getMonth());
      rpcPacotes(new Date(h.getFullYear(), h.getMonth(), 1), new Date(h.getFullYear(), h.getMonth() + 2, 1));   // pacotes de datas especiais dos mesmos 2 meses
    } catch (e) { /* o calendário pede de novo quando abrir */ }
  }
  (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(aquecer, { timeout: 4000 });
  /* Alternativa enquanto consultar_precos não existe no banco: usa consultar_disponibilidade em blocos de
     até 7 noites; num bloco indisponível, consulta noite a noite para saber quais estão livres. */
  function rpcDisp(ci, co, s) {
    return fetch(CONFIG.url + '/rest/v1/rpc/consultar_disponibilidade', {
      method: 'POST',
      headers: { apikey: CONFIG.chave, 'Content-Type': 'application/json', 'Content-Profile': CONFIG.schema },
      body: JSON.stringify({ p_checkin: iso(ci), p_checkout: iso(co), p_adultos: s.adults, p_criancas: s.children, p_bebes: s.babies, p_criancas_maiores: s.older || undefined })
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
  function curto(v) { return v >= 1000 ? (Math.round(v / 100) / 10) + 'k' : String(Math.round(v)); } // 2k · 1.8k · 920
  /* noites já consultadas (dos meses abertos), para o calendário validar a seleção:
     dia ocupado não vira check-in, e a saída precisa cumprir o mínimo de noites e não atravessar dia ocupado */
  var noites = {};
  function registrar(m) { Object.keys(m || {}).forEach(function (k) { noites[k] = m[k]; }); }
  function noiteOcupada(d) { var x = noites[iso(d)]; return !!x && (!x.livre || x.vl_noite == null); }
  function saidaValida(ini, fim) {
    var min = 2, n = Math.round((fim - ini) / 864e5);
    if (pacotes[iso(ini) + '|' + n]) return { ok: true, min: n };          // é exatamente um dos pacotes
    var ops = opcoesQueTocam(ini, fim);
    if (ops.length) return { ok: false, motivo: 'pacote', opcoes: ops };    // toca um pacote sem ser um deles
    for (var d = new Date(ini); d < fim; d.setDate(d.getDate() + 1)) {
      var x = noites[iso(d)];
      if (!x) continue;                                    // ainda não consultada: o banco confere ao reservar
      if (!x.livre || x.vl_noite == null) return { ok: false, motivo: 'ocupado' };
      min = Math.max(min, Number(x.min_noites) || 2);
    }
    return n >= min ? { ok: true, min: min } : { ok: false, motivo: 'min', min: min };
  }
  function marcarSelecao(cal) {
    var st = Booking.getState();
    cal.querySelectorAll('.cal-d').forEach(function (c) {
      c.classList.remove('cal-nao', 'cal-saida');
      if (!st.selecting || !st.start || !c._date || c.classList.contains('cal-off') || c._date <= st.start) return;
      var v = saidaValida(st.start, c._date);
      if (!v.ok) c.classList.add('cal-nao');
      else if (c.classList.contains('cal-ocu')) c.classList.add('cal-saida');   // dá para sair na manhã do dia ocupado
    });
  }
  function precosNoCalendario(cal, ano, mes0) {
    var velha = cal.querySelector('.cal-pnota'); if (velha) velha.remove();
    var meuMes = cal._pmes = ano + '-' + mes0;                                            // mês que esta tela mostra (o usuário pode já ter virado a página)
    var nota = document.createElement('div'); nota.className = 'cal-pnota cal-pcarrega';
    nota.textContent = t('Carregando valores…'); cal.appendChild(nota);
    var atual = precosDoMes(ano, mes0);                                                   // traz este mês e o seguinte numa consulta só
    precosDoMes(mes0 + 1 > 11 ? ano + 1 : ano, (mes0 + 1) % 12).then(registrar);          // mês seguinte: estadias que viram o mês (já está na memória)
    rpcPacotes(new Date(ano, mes0, 1), new Date(ano, mes0 + 2, 1)).then(function () { marcarSelecao(cal); });                                         // pacotes de datas especiais (valem para a seleção de saída)
    atual.then(function (m) {
      if (cal._pmes !== meuMes) return;
      nota.classList.remove('cal-pcarrega');
      if (!m) { nota.textContent = t('Não foi possível carregar os valores agora. Feche e abra o calendário para tentar de novo.'); nota.classList.add('cal-perro'); return; }
      registrar(m);
      var achou = false;
      cal.querySelectorAll('.cal-d').forEach(function (c) {
        var x = c._date && m[iso(c._date)];
        if (!x || c.classList.contains('cal-off')) return;
        if (x.livre && x.vl_noite != null) {
          var p = document.createElement('span'); p.className = 'cal-p'; p.textContent = curto(Number(x.vl_noite));
          c.title = moeda(x.vl_noite) + ' / ' + t('noite'); c.appendChild(p); achou = true;
          var pk = opcoesQueTocam(c._date, soma(c._date, 1))[0];
          if (pk) { c.classList.add('cal-pac'); c.title = t('Pacote {nome}').replace('{nome}', pk.nm_pacote); }
        } else c.classList.add('cal-ocu');
      });
      if (achou) nota.textContent = t('Valor por noite') + ' · ' + document.getElementById('guestsDisplay').textContent;
      else nota.remove();
      marcarSelecao(cal);
    });
  }

  /* Datas ou hóspedes mudaram: o resultado mostrado deixa de valer. */
  function estadoMudou() {
    if (ultimo && ultimo.chave !== chaveDe(Booking.getState())) esconder();
  }
  /* Troca de idioma: redesenha o resultado no idioma novo. */
  function idiomaMudou() { if (ultimo) renderizar(ultimo.resposta); }

  return { rotuloFaixa: rotuloFaixa, precosNoCalendario: precosNoCalendario, noiteOcupada: noiteOcupada, saidaValida: saidaValida, consultar: consultar, estadoMudou: estadoMudou, idiomaMudou: idiomaMudou, esconder: esconder };
})();
