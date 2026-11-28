/* Reserva (reserva.html): consulta, formulário e envio. Fora do HTML para a CSP não precisar de 'unsafe-inline'. */
(function () {
  var API = { url: 'https://tnjpyjbqcjrowzjfnuln.supabase.co', chave: 'sb_publishable_VJqLlw2XZu8v5GSAWWfOfw_qUYdyXDF', schema: 'SE' };
  var ENDPOINT = API.url + '/functions/v1/reservar';   /* função do Supabase; se ainda não estiver publicada, o envio cai no e-mail */
  var TURNSTILE_SITEKEY = '';  /* chave pública do captcha Cloudflare Turnstile (opcional) */
  var CONTATO = 'reservas@solardoespinhaco.com.br';
  var WHATSAPP = '5531997555245';
  var WA_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.2.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>';
  var PIX = { chave: 'solardoespinhaco@gmail.com', nome: 'SOLAR DO ESPINHACO', cidade: 'LAPINHA SERRA' }; // nome até 25 e cidade até 15 caracteres
  function pixCampo(id, v) { return id + String(v.length).padStart(2, '0') + v; }
  function pixCrc(s) { // CRC16-CCITT (0x1021, início 0xFFFF)
    var c = 0xFFFF;
    for (var i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8; for (var k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; }
    return c.toString(16).toUpperCase().padStart(4, '0');
  }
  function pixCodigo(valor, txid) {
    var s = pixCampo('00', '01') +
      pixCampo('26', pixCampo('00', 'br.gov.bcb.pix') + pixCampo('01', PIX.chave)) +
      pixCampo('52', '0000') + pixCampo('53', '986') + pixCampo('54', Number(valor).toFixed(2)) + pixCampo('58', 'BR') +
      pixCampo('59', PIX.nome.slice(0, 25)) + pixCampo('60', PIX.cidade.slice(0, 15)) +
      pixCampo('62', pixCampo('05', txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***')) + '6304';
    return s + pixCrc(s);
  }
  var VERSAO_TERMOS = 'v1 · 19/11/2026';
  var $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var P = { ci: q.get('ci'), co: q.get('co'), a: +q.get('a') || 2, c: +q.get('c') || 0, m: +q.get('m') || 0, b: +q.get('b') || 0 };
  var R = null;               /* resposta da consulta */

  var PAISES = [['BR','Brasil'],['AR','Argentina'],['BO','Bolívia'],['CL','Chile'],['CO','Colômbia'],['PY','Paraguai'],['PE','Peru'],['UY','Uruguai'],['VE','Venezuela'],['US','Estados Unidos'],['CA','Canadá'],['MX','México'],['PT','Portugal'],['ES','Espanha'],['FR','França'],['DE','Alemanha'],['IT','Itália'],['GB','Reino Unido'],['IE','Irlanda'],['NL','Países Baixos'],['BE','Bélgica'],['CH','Suíça'],['AT','Áustria'],['SE','Suécia'],['NO','Noruega'],['DK','Dinamarca'],['PL','Polônia'],['JP','Japão'],['CN','China'],['KR','Coreia do Sul'],['IL','Israel'],['AU','Austrália'],['NZ','Nova Zelândia'],['ZA','África do Sul']];
  function paises() {
    var dn = null; try { dn = I18N.lang() === 'pt' ? null : new Intl.DisplayNames([I18N.lang()], { type: 'region' }); } catch (e) { dn = null; }
    var nomes = PAISES.filter(function (p) { return p[0] !== 'BR'; }).map(function (p) { return [p[0], (dn && dn.of(p[0])) || p[1]]; });
    if (I18N.lang() !== 'pt') nomes.sort(function (a, b) { return a[1].localeCompare(b[1], I18N.lang()); });
    var opt = nomes.map(function (p) { return '<option value="' + p[0] + '">' + p[1] + '</option>'; }).join('');
    ['pais', 'ppPais'].forEach(function (id) { var v = $(id).value; $(id).innerHTML = opt; if (v) $(id).value = v; });
  }

  /* idioma: T() traduz (com {chaves}); valores, datas e países seguem o idioma escolhido */
  function T(s, o) { var r = I18N.t(s); if (o) for (var k in o) r = r.split('{' + k + '}').join(o[k]); return r; }
  function brl(v) { return I18N.lang() === 'en' ? 'R$ ' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function dt(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dataExt(s) { return dt(s).toLocaleDateString(I18N.locale(), { day: 'numeric', month: 'long', year: 'numeric' }); }
  function dataCurta(d) { var m = I18N.months()[d.getMonth()].slice(0, 3); m = I18N.lang() === 'pt' || I18N.lang() === 'es' ? m.toLowerCase() : m; return I18N.lang() === 'en' ? m + ' ' + d.getDate() : d.getDate() + ' ' + m; }
  function hospedes() {
    var f = function (n, s, p) { return n + ' ' + T(n === 1 ? s : p); };
    var t = [f(P.a, 'adulto', 'adultos')];
    if (P.m) t.push(f(P.m, 'criança', 'crianças') + ' ' + T('de {a} a {b} anos', { a: REG.m + 1, b: REG.c }));
    if (P.c) t.push(f(P.c, 'criança', 'crianças') + ' ' + T('de {a} a {b} anos', { a: REG.b + 1, b: REG.m }));
    if (P.b) t.push(f(P.b, 'criança', 'crianças') + ' ' + T('até {n} anos', { n: REG.b }));
    return t.join(', ');
  }
  function estado(txt, ruim) { var e = $('resEstado'); e.className = 'state' + (ruim ? ' bad' : ''); e.textContent = T(txt); e.classList.remove('hide'); $('resCorpo').classList.add('hide'); }
  var MOTIVOS = { pacote: 'Nessas datas vendemos só pacotes. Volte ao site e escolha uma das opções.', datas_invalidas: 'O check-out precisa ser depois do check-in.', data_passada: 'A data de check-in já passou.', estadia_longa: 'A estadia passa do máximo de 7 noites.', capacidade: 'O chalé recebe até 2 adultos e 2 crianças.', sem_tarifa: 'A agenda ainda não está aberta para essas datas.', fechado: 'Uma das noites escolhidas não está disponível.', sem_chegada: 'Não há check-in nesse dia.', sem_saida: 'Não há check-out nesse dia.', ocupado: 'Essas datas já estão reservadas.', unidade_inativa: 'O chalé não está disponível no momento.', pendente_em_aberto: 'Você já tem uma pré-reserva aguardando o Pix do sinal. Pague o Pix dela ou aguarde 30 minutos para fazer outra.' };
  /* mensagem do servidor: em português fica como veio; em EN/ES troca pelo código do erro */
  function msgServidor(j) {
    if (I18N.lang() === 'pt') return j.mensagem;
    var m = { validacao: 'Confira os dados informados e tente de novo.', limite: 'Muitas tentativas. Tente de novo mais tarde ou fale com a pousada.', captcha: 'Não foi possível validar que você não é um robô. Atualize a página e tente de novo.', expirada: 'O tempo para concluir passou. Consulte as datas de novo.', indisponivel: MOTIVOS[j.motivo] || 'Essas datas não estão disponíveis.' };
    return T(m[j.erro] || 'Não foi possível concluir agora. Tente de novo em instantes.');
  }

  /* faixas de idade e percentuais das crianças (definidos no Inspect, por pousada); sem resposta, as de sempre */
  var REG = { b: 4, m: 8, c: 13, pcB: 0, pcC: 30, pcM: 100 };
  function pctTxt(v) { return v ? String(Math.round(v * 100) / 100).replace('.', ',') + '%' : T('Grátis'); }
  function faixasNaTela() {
    $('fxM').textContent = T('{a} a {b} anos', { a: REG.m + 1, b: REG.c }); $('pcM').textContent = pctTxt(REG.pcM);
    $('fxC').textContent = T('{a} a {b} anos', { a: REG.b + 1, b: REG.m }); $('pcC').textContent = pctTxt(REG.pcC);
    $('fxB').textContent = T('Até {n} anos', { n: REG.b }); $('pcB').textContent = pctTxt(REG.pcB);
    $('fxContrato').textContent = 'até ' + REG.b + ' anos, ' + (REG.b + 1) + ' a ' + REG.m + ' anos e ' + (REG.m + 1) + ' a ' + REG.c + ' anos';   // contrato: sempre em português
    if (P.ci && P.co && $('rH').textContent) $('rH').textContent = hospedes();
  }
  fetch(API.url + '/rest/v1/rpc/consultar_regras_hospedes', { method: 'POST', headers: { apikey: API.chave, 'Content-Type': 'application/json', 'Content-Profile': API.schema }, body: '{}' })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (l) {
      var x = l && l[0]; if (!x) return;
      REG = { b: x.no_idade_max_bebe, m: x.no_idade_max_crianca_menor, c: x.no_idade_max_crianca,
        pcB: x.pc_bebe == null ? REG.pcB : Number(x.pc_bebe), pcC: x.pc_crianca == null ? REG.pcC : Number(x.pc_crianca), pcM: x.pc_crianca_maior == null ? REG.pcM : Number(x.pc_crianca_maior) };
      faixasNaTela();
    }).catch(function () {});

  /* acompanhantes e fotos dos documentos: pedidos depois da confirmação do pagamento do sinal */

  /* consulta de preço e disponibilidade */
  function consultar() {
    var ok = /^\d{4}-\d{2}-\d{2}$/.test(P.ci || '') && /^\d{4}-\d{2}-\d{2}$/.test(P.co || '');
    if (!ok) { estado('Escolha as datas no site para ver os valores.', true); $('enviar').disabled = true; return; }
    $('rCi').textContent = dataExt(P.ci); $('rCo').textContent = dataExt(P.co); $('rH').textContent = hospedes();
    fetch(API.url + '/rest/v1/rpc/consultar_disponibilidade', {
      method: 'POST', headers: { apikey: API.chave, 'Content-Type': 'application/json', 'Content-Profile': API.schema },
      body: JSON.stringify({ p_checkin: P.ci, p_checkout: P.co, p_adultos: P.a, p_criancas: P.c, p_bebes: P.b, p_criancas_maiores: P.m || undefined })
    }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (l) {
      var r = l && l[0]; if (!r) throw 0; R = r;
      if (!r.disponivel) {
        $('resEstado').dataset.k = ''; estado(r.motivo === 'min_noites' ? T('Para essas datas, a estadia mínima é de {n} noites.', { n: r.qtde_min_noites }) : (MOTIVOS[r.motivo] || 'Essas datas não estão disponíveis.'), true);
        $('enviar').disabled = true; return;
      }
      $('resEstado').classList.add('hide'); $('resCorpo').classList.remove('hide');
      $('rN').textContent = r.qtde_noites;
      var pac = r.ds_detalhe && r.ds_detalhe[0] && r.ds_detalhe[0].nm_pacote; if (pac) $('rN').textContent = r.qtde_noites + ' · ' + T('Pacote {nome}', { nome: pac });
      $('rNoites').innerHTML = (r.ds_detalhe || []).map(function (n) { var d = dt(n.dt_ref); return '<li><span>' + dataCurta(d) + '</span><span>' + brl(n.vl_noite) + '</span></li>'; }).join('');
      $('rT').textContent = brl(r.vl_total); $('rS').textContent = brl(r.vl_sinal); $('rSd').textContent = brl(Number(r.vl_total) - Number(r.vl_sinal));
    }).catch(function () { estado('Não foi possível consultar os valores agora. Atualize a página em instantes.', true); });
  }

  /* nacionalidade */
  function nac() { return document.querySelector('input[name=nac]:checked').value; }
  document.querySelectorAll('input[name=nac]').forEach(function (r) { r.addEventListener('change', function () {
    $('blBR').classList.toggle('hide', nac() !== 'BR'); $('blEX').classList.toggle('hide', nac() === 'BR');
    var t = $('tel');
    if (nac() === 'BR') { if (t.value && t.value.indexOf('+55') !== 0) t.value = ''; else if (t.value) formatarTel(); t.placeholder = '+55 (00) 00000-0000'; }
    else { if (/^\+55/.test(t.value)) t.value = ''; t.placeholder = '+1 000 000 0000'; }
  }); });
  function formatarTel() {
    var t = $('tel'), v = t.value;
    if (nac() !== 'BR') { t.value = '+' + v.replace(/[^\d ]/g, '').replace(/^\s+/, '').slice(0, 18); return; }
    var d = v.replace(/\D/g, ''); if (d.indexOf('55') === 0) d = d.slice(2); d = d.slice(0, 11);
    var o = '+55 ';
    if (d.length) o += '(' + d.slice(0, 2);
    if (d.length >= 2) o += ') ' + d.slice(2, d.length > 10 ? 7 : 6);
    if (d.length > 6) o += '-' + d.slice(d.length > 10 ? 7 : 6);
    t.value = o;
  }
  $('tel').addEventListener('input', formatarTel);
  /* datas digitadas como dd/mm/aaaa (o iPhone mostra o campo de data no formato dele) */
  document.querySelectorAll('[data-data]').forEach(function (e) {
    e.addEventListener('input', function () {
      var d = e.value.replace(/\D/g, '').slice(0, 8);
      e.value = d.length > 4 ? d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4) : d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
    });
  });
  function isoDe(v) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || ''); if (!m) return '';
    var d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getFullYear() === +m[3] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[1] ? m[3] + '-' + m[2] + '-' + m[1] : '';
  }
  $('tel').addEventListener('focus', function () { if (!this.value) this.value = nac() === 'BR' ? '+55 ' : '+'; });
  $('tel').addEventListener('blur', function () { if (/^\+(55)?\s*$/.test(this.value)) this.value = ''; });  // vazio volta a mostrar o formato
  $('cpf').addEventListener('input', function () {
    var d = this.value.replace(/\D/g, '').slice(0, 11), o = d;
    if (d.length > 9) o = d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9);
    else if (d.length > 6) o = d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
    else if (d.length > 3) o = d.slice(0, 3) + '.' + d.slice(3);
    this.value = o;
  });
  function cpfOk(s) {
    s = s.replace(/\D/g, ''); if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
    for (var t = 9; t < 11; t++) { var soma = 0; for (var i = 0; i < t; i++) soma += +s[i] * (t + 1 - i); if ((soma * 10 % 11) % 10 !== +s[t]) return false; }
    return true;
  }

  /* validação */
  function erro(id, txt) { var m = document.querySelector('[data-m="' + id + '"]'); if (m) m.textContent = txt || ''; var e = $(id); if (e) e.classList.toggle('err', !!txt); return !txt; }
  function validar() {
    var bom = true, primeiro = null;
    function v(id, cond, txt) { var ok = erro(id, cond ? '' : txt); if (!ok) { bom = false; primeiro = primeiro || $(id); } }
    v('nome', $('nome').value.trim().length >= 2, T('Informe o nome.'));
    v('sobrenome', $('sobrenome').value.trim().length >= 2, T('Informe o sobrenome.'));
    v('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($('email').value.trim()), T('Informe um e-mail válido.'));
    var tel = $('tel').value.replace(/\D/g, '');
    if (nac() === 'BR') v('tel', /^55\d{10,11}$/.test(tel), T('Informe o celular com DDD: +55 (31) 99999-9999.'));
    else v('tel', tel.length >= 8 && tel.length <= 15, T('Informe o telefone com o código do país, ex.: +1 415 555 0102.'));
    var nasc = isoDe($('nasc').value), lim = P.ci ? (Number(P.ci.slice(0, 4)) - 18) + P.ci.slice(4) : '';
    v('nasc', !!nasc && nasc >= '1900-01-02' && (!lim || nasc <= lim), nasc && lim && nasc > lim ? T('O titular precisa ter 18 anos no check-in.') : T('Informe a data de nascimento (dd/mm/aaaa).'));
    if (nac() === 'BR') v('cpf', cpfOk($('cpf').value), T('Informe um CPF válido.'));
    else {
      v('pp', /^[A-Z0-9]{5,20}$/.test($('pp').value.trim().toUpperCase()), T('Informe o número do passaporte (letras e números).'));
      var val = isoDe($('ppVal').value);
      v('ppVal', !!val && val >= P.co, T('O passaporte precisa valer até {data}.', { data: P.co ? dataExt(P.co) : T('o dia da saída') }));
    }
    document.querySelectorAll('[data-doc]').forEach(function (e) {
      var f = e.files[0]; if (f) v(e.id, /^image\//.test(f.type) && f.size <= 20 * 1024 * 1024, 'Envie uma foto (imagem de até 20 MB).');
    });
    var ac = $('aceite').checked; $('aceiteBox').classList.toggle('err', !ac); erro('aceite', ac ? '' : T('Para continuar, aceite a política de cancelamento e os termos.'));
    if (!ac) { bom = false; primeiro = primeiro || $('aceite'); }
    if (primeiro) primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return bom;
  }

  /* envio */
  function dados() {
    var br = nac() === 'BR', ac = [];
    return {
      titular: { nome: $('nome').value.trim() + ' ' + $('sobrenome').value.trim(), email: $('email').value.trim(), telefone: $('tel').value.trim(), nascimento: isoDe($('nasc').value),
        nacionalidade: br ? 'BR' : $('pais').value, cpf: br ? $('cpf').value.replace(/\D/g, '') : null,
        passaporte: br ? null : $('pp').value.trim().toUpperCase(), paisPassaporte: br ? null : $('ppPais').value, validadePassaporte: br ? null : isoDe($('ppVal').value) },
      acompanhantes: ac, reserva: { checkin: P.ci, checkout: P.co, adultos: P.a, criancas: P.c, criancasMaiores: P.m, bebes: P.b },
      aceite: { termos: VERSAO_TERMOS, em: new Date().toISOString() },
      site: $('site').value, token: (window.turnstile && TURNSTILE_SITEKEY) ? window.turnstile.getResponse() : undefined
    };
  }
  function textoEmail(d) {
    var t = d.titular, l = ['SOLICITAÇÃO DE RESERVA · Casa do Mirante', '',
      'Check-in: ' + dataExt(P.ci) + ' (a partir das 15h)', 'Check-out: ' + dataExt(P.co) + ' (até as 12h)', 'Hóspedes: ' + hospedes()];
    if (R && R.disponivel) l.push('Total: ' + brl(R.vl_total) + ' · Sinal (50%): ' + brl(R.vl_sinal) + ' · Saldo no check-in: ' + brl(Number(R.vl_total) - Number(R.vl_sinal)));
    l.push('', 'TITULAR', 'Nome: ' + t.nome, 'E-mail: ' + t.email, 'Telefone: ' + t.telefone, 'Nascimento: ' + (t.nascimento ? t.nascimento.split('-').reverse().join('/') : ''));
    l.push(t.cpf ? 'CPF: ' + t.cpf : 'Passaporte: ' + t.passaporte + ' (' + t.paisPassaporte + ') · validade ' + t.validadePassaporte + ' · nacionalidade ' + t.nacionalidade);
    if (d.acompanhantes.length) l.push('', 'ACOMPANHANTES'), d.acompanhantes.forEach(function (a) { l.push((a.tipo === 'adulto' ? 'Adulto: ' + a.nome + ' ' + a.sobrenome : a.tipo === 'crianca' ? 'Criança: ' + a.nome + (a.idade ? ' (' + a.idade + ' anos)' : '') : 'Criança: ' + a.nome + (a.idade != null ? ' (' + a.idade + ' anos)' : ''))); });
    l.push('', 'Li e aceito a Política de cancelamento e os Termos e condições de uso (' + d.aceite.termos + ').');
    return l.join('\n');
  }
  function concluir(html, href, rotulo, titulo, tag) {
    $('form').classList.add('hide'); $('feito').classList.remove('hide');
    $('feitoTxt').innerHTML = html;
    $('feitoSmall').textContent = T(tag || 'Quase pronto'); $('feitoH').textContent = T(titulo || 'Enviar solicitação');
    var b = $('feitoBtn'); if (href) { b.href = href; b.textContent = T(rotulo || 'Abrir e-mail com a solicitação'); if (/wa\.me/.test(href)) b.insertAdjacentHTML('afterbegin', WA_SVG); b.classList.remove('hide'); } else b.classList.add('hide');
    $('feito').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('feito').focus();
  }
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!R || !R.disponivel) { estado('Escolha datas disponíveis no site para continuar.', true); return; }
    if (!validar()) return;
    var d = dados();
    $('erroEnvio').textContent = '';
    if (!ENDPOINT) return porEmail(d);
    var btn = $('enviar'), rotulo = btn.textContent;
    var liberar = function () { btn.disabled = false; btn.textContent = rotulo; };
    btn.disabled = true; btn.textContent = T('Enviando…');
    montarEnvio(d).then(function (corpo) { return fetch(ENDPOINT, { method: 'POST', body: corpo }); })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }, function () { return { s: r.status, j: null }; }); })
      .then(function (x) {
        liberar();
        if (x.s === 200 && x.j && x.j.ok) return registrada(x.j, d);
        if (x.j && x.j.mensagem && x.s >= 400 && x.s < 500) { $('erroEnvio').textContent = msgServidor(x.j); $('erroEnvio').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        porEmail(d);                      /* função indisponível ou erro do servidor */
      })
      .catch(function () { liberar(); porEmail(d); });
  });
  /* fotos: reduz para no máximo 1600 px e envia como JPEG (menos dados no celular, tipo conferido no servidor) */
  function reduzir(file) {
    return new Promise(function (ok, falha) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : falha(new Error('foto')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('foto')); };
      img.src = url;
    });
  }
  function montarEnvio(d) {
    var fd = new FormData(); fd.append('dados', JSON.stringify(d));
    var campos = Array.prototype.filter.call(document.querySelectorAll('[data-doc]'), function (e) { return e.files[0]; });
    return Promise.all(campos.map(function (e) {
      return reduzir(e.files[0]).then(function (b) { fd.append(e.getAttribute('data-doc'), b, e.getAttribute('data-doc') + '.jpg'); });
    })).then(function () { return fd; });
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function registrada(j, d) {
    var limite = j.dt_expira ? new Date(j.dt_expira) : new Date(Date.now() + 30 * 60000);
    var hora = limite.toLocaleTimeString(I18N.locale(), { hour: '2-digit', minute: '2-digit' });
    var codigo = pixCodigo(j.vl_sinal, j.cd_reserva);
    var wa = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Olá! Paguei o sinal de ' + brl(j.vl_sinal) + ' da reserva ' + j.cd_reserva + ' (' + dataExt(P.ci) + ' a ' + dataExt(P.co) + '). Segue o comprovante.');
    var qr = '';
    try { var q = window.qrcode(0, 'M'); q.addData(codigo); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) { qr = ''; }
    concluir(T('As datas estão seguradas em seu nome. Código da reserva:') + ' <b style="font-size:20px;letter-spacing:.06em">' + j.cd_reserva + '</b>' +
      '<div class="pix">' +
        '<div class="valor">' + T('Sinal:') + ' ' + brl(j.vl_sinal) + '</div>' +
        '<div class="prazo">' + T('Pague até <b>{hora}</b> · faltam <b id="pixFalta">30:00</b>', { hora: hora }) + '</div>' +
        (qr ? '<div class="qr" aria-label="QR Code Pix">' + qr + '</div>' : '') +
        '<div class="prazo">' + T('Abra o app do banco, escolha Pix › Ler QR Code, ou copie o código abaixo (Pix copia e cola).') + '</div>' +
        '<textarea id="pixCodigo" readonly aria-label="Pix copia e cola">' + codigo + '</textarea>' +
        '<button type="button" class="btn copiar" id="pixCopiar">' + T('Copiar código Pix') + '</button>' +
      '</div>' +
      T('Depois de pagar, envie o comprovante pelo WhatsApp. A equipe confere o pagamento e confirma a reserva pelo e-mail <b>{email}</b>. Sem o sinal até {hora}, as datas voltam a ficar disponíveis. O saldo de {saldo} é pago no check-in.', { email: esc(d.titular.email), hora: hora, saldo: brl(j.vl_total - j.vl_sinal) }),
      wa, 'Enviar comprovante', 'Pague o sinal por Pix', 'Pré-reserva registrada');
    $('pixCopiar').addEventListener('click', function () {
      var t = $('pixCodigo'), b = this;
      function feito() { b.textContent = T('Código copiado'); setTimeout(function () { b.textContent = T('Copiar código Pix'); }, 2500); }
      if (navigator.clipboard) navigator.clipboard.writeText(codigo).then(feito, function () { t.select(); document.execCommand('copy'); feito(); });
      else { t.select(); document.execCommand('copy'); feito(); }
    });
    (function contar() {
      var f = $('pixFalta'); if (!f) return;
      var ms = limite - Date.now();
      if (ms <= 0) { f.textContent = T('prazo encerrado'); f.parentNode.innerHTML = T('O prazo de 30 minutos terminou. Se já pagou, envie o comprovante pelo WhatsApp: a equipe confirma se as datas continuarem livres.'); return; }
      var m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000);
      f.textContent = m + ':' + String(s).padStart(2, '0');
      setTimeout(contar, 1000);
    })();
  }
  function porEmail(d) {
    var mailto = 'mailto:' + CONTATO + '?subject=' + encodeURIComponent('Reserva Casa do Mirante · ' + dataExt(P.ci)) + '&body=' + encodeURIComponent(textoEmail(d));
    concluir(T('Não conseguimos registrar a reserva automaticamente agora. Toque no botão abaixo para enviar a solicitação por e-mail para a nossa equipe, que responde combinando o pagamento do sinal de <b>{sinal}</b>. As datas só ficam garantidas depois do sinal.', { sinal: brl(R.vl_sinal) }), mailto);
  }
  document.querySelectorAll('input,select').forEach(function (e) { e.addEventListener('input', function () { if (e.classList.contains('err')) { e.classList.remove('err'); var m = document.querySelector('[data-m="' + e.id + '"]'); if (m) m.textContent = ''; } }); });

  if (TURNSTILE_SITEKEY) {
    var sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=iniciaCaptcha'; sc.async = true;
    window.iniciaCaptcha = function () { window.turnstile.render('#captcha', { sitekey: TURNSTILE_SITEKEY, theme: 'dark' }); };
    document.head.appendChild(sc);
  }
  /* idioma da página (o mesmo escolhido no site; o seletor do cabeçalho troca na hora) */
  var IH_PT = {};
  function aplicarIdioma(l) {
    I18N.apply(l); l = I18N.lang();
    document.querySelectorAll('[data-ih]').forEach(function (e) {
      var k = e.getAttribute('data-ih'); if (!(k in IH_PT)) IH_PT[k] = e.innerHTML;
      e.innerHTML = l === 'pt' ? IH_PT[k] : window.I18N_IH[k][l === 'en' ? 0 : 1];
    });
    paises();
    faixasNaTela();
    document.title = T('Realizar reserva · Solar do Espinhaço');
    var n = $('notaIdioma'); n.classList.toggle('hide', l === 'pt'); n.textContent = l === 'pt' ? '' : T('Aviso: o texto do contrato abaixo está em português, que é a versão com validade jurídica. Se precisar de uma tradução, fale com a nossa equipe por e-mail ou WhatsApp antes de reservar.');
    document.querySelectorAll('.idiomas button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-l') === l); b.setAttribute('aria-pressed', b.getAttribute('data-l') === l); });
    document.querySelectorAll('[data-m]').forEach(function (m) { m.textContent = ''; }); document.querySelectorAll('.err').forEach(function (e) { e.classList.remove('err'); });
    $('erroEnvio').textContent = '';
  }
  document.querySelectorAll('.idiomas button').forEach(function (b) { b.addEventListener('click', function () { aplicarIdioma(b.getAttribute('data-l')); if ($('feito').classList.contains('hide')) consultar(); }); });
  aplicarIdioma(I18N.saved());
  consultar();
})();
