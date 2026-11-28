/* Cliques da página por data-acao (no lugar de onclick= no HTML): a CSP fica sem 'unsafe-inline' nos scripts. */
document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-acao]');
  if (!el) return;
  var a = el.getAttribute('data-acao');
  if (a === 'idioma') setLang(el.getAttribute('data-l'));
  else if (a === 'topo') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  else if (a === 'reservar') openBkPopup(e);
  else if (a === 'data') Booking.open(el.getAttribute('data-campo'));
  else if (a === 'consultar') Disponibilidade.consultar();
  else if (a === 'fechar') closeBkPopup();
});
