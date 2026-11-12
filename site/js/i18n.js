/* ══════════════════════════════════════════════════════════
   I18N — troca de idioma do site (PT · EN · ES)

   Como funciona: o HTML continua escrito em português. Este
   arquivo guarda, para cada texto em português, a versão em
   inglês e em espanhol. Ao trocar o idioma, todos os textos da
   página (e os alt / aria-label) são substituídos; voltar para
   PT restaura o original.

   NÃO são traduzidos, por regra do projeto: nome da pousada,
   cidade, estado, nomes dos locais (cachoeiras, poços, picos,
   serras, rios) e endereços. Eles simplesmente não entram no
   dicionário — texto sem entrada fica como está.

   Para traduzir um texto novo: acrescente uma linha em DICT,
   usando o texto em português exatamente como está no HTML.
   Textos gerados por script (calendário, hóspedes, filtro)
   chamam I18N.t('texto em português').
═══════════════════════════════════════════════════════════ */
'use strict';

window.I18N = (function () {
  /* 'português': ['english', 'español'] */
  var DICT = {
    /* ── Navegação ── */
    'O Chalé': ['The Chalet', 'El Chalet'],
    'Experiências': ['Experiences', 'Experiencias'],
    'Contato': ['Contact', 'Contacto'],
    'Reservar': ['Book', 'Reservar'],
    'Abrir menu': ['Open menu', 'Abrir menú'],
    'Menu': ['Menu', 'Menú'],
    'Idioma': ['Language', 'Idioma'],
    'Ir para o início': ['Back to top', 'Ir al inicio'],
    'Fazer reserva': ['Make a reservation', 'Hacer una reserva'],
    'Slide 1': ['Slide 1', 'Imagen 1'],
    'Slide 2': ['Slide 2', 'Imagen 2'],
    'Slide 3': ['Slide 3', 'Imagen 3'],

    /* ── Hero ── */
    'Chalé Boutique · Lapinha da Serra · Minas Gerais': ['Boutique Chalet · Lapinha da Serra · Minas Gerais', 'Chalet Boutique · Lapinha da Serra · Minas Gerais'],
    'O espinhaço te conecta com a natureza.': ['The Espinhaço connects you with nature.', 'El Espinhaço te conecta con la naturaleza.'],
    'Explorar': ['Explore', 'Explorar'],

    /* ── Ambientes ── */
    'Ambientes · Chalé Boutique': ['Spaces · Boutique Chalet', 'Ambientes · Chalet Boutique'],
    'Conforto que respira,': ['Comfort that breathes,', 'Confort que respira,'],
    'natureza que abraça': ['nature that embraces', 'naturaleza que abraza'],

    'Suíte': ['Suite', 'Suite'],
    'A suíte é um refúgio de linhas serenas e materiais nobres, onde o desenho do espaço privilegia o descanso e a vista para a Serra do Espinhaço. Cada elemento foi selecionado para oferecer conforto duradouro e uma estadia em absoluta tranquilidade.': [
      'The suite is a retreat of serene lines and noble materials, where the design of the space favors rest and the view of the Serra do Espinhaço. Every element was chosen to offer lasting comfort and a stay in absolute tranquility.',
      'La suite es un refugio de líneas serenas y materiales nobles, donde el diseño del espacio privilegia el descanso y la vista a la Serra do Espinhaço. Cada elemento fue seleccionado para ofrecer un confort duradero y una estadía en absoluta tranquilidad.'],
    'O banheiro, revestido em pedra natural e com acabamentos precisos, traduz a atmosfera de um spa privativo. Um espaço concebido para transformar o banho em um momento de bem-estar e contemplação.': [
      'The bathroom, clad in natural stone and finished with precision, conveys the atmosphere of a private spa. A space conceived to turn bathing into a moment of well-being and contemplation.',
      'El baño, revestido en piedra natural y con acabados precisos, transmite la atmósfera de un spa privado. Un espacio concebido para transformar el baño en un momento de bienestar y contemplación.'],
    'Quarto 28 m²': ['Bedroom 28 m²', 'Habitación 28 m²'],
    'Vista Panorâmica': ['Panoramic View', 'Vista Panorámica'],
    'Ar Quente e Frio': ['Heating & Cooling', 'Aire Frío y Calor'],
    'Banheira de Imersão': ['Soaking Tub', 'Bañera de Inmersión'],
    'Cama King Size': ['King Size Bed', 'Cama King Size'],
    'Roupa de Cama 600 Fios': ['600-Thread-Count Linens', 'Ropa de Cama de 600 Hilos'],
    'Closet & Roupão': ['Closet & Bathrobe', 'Vestidor y Bata'],
    'Toalhas Algodão Egípcio': ['Egyptian Cotton Towels', 'Toallas de Algodón Egipcio'],
    'Ducha Dupla': ['Double Shower', 'Ducha Doble'],
    'Box até o Teto': ['Floor-to-Ceiling Shower Glass', 'Mampara hasta el Techo'],

    'Sala Integrada': ['Open-Plan Living Room', 'Sala Integrada'],
    'A sala com cozinha integrada foi pensada como o coração da estadia: um ambiente fluido, de marcenaria sob medida e madeiras nobres, onde os espaços conversam entre si. Portas de correr abrem o ambiente por completo para o deck, e a Cordilheira do Espinhaço passa a fazer parte da sala — do preparo de uma refeição ao descanso no fim do dia.': [
      'The living room with its integrated kitchen was designed as the heart of the stay: a flowing space of custom joinery and noble woods, where the rooms speak to one another. Sliding doors open the space entirely onto the deck, and the Cordilheira do Espinhaço becomes part of the room — from preparing a meal to unwinding at the end of the day.',
      'La sala con cocina integrada fue pensada como el corazón de la estadía: un ambiente fluido, de carpintería a medida y maderas nobles, donde los espacios dialogan entre sí. Las puertas corredizas abren el ambiente por completo hacia el deck, y la Cordilheira do Espinhaço pasa a formar parte de la sala — desde la preparación de una comida hasta el descanso al final del día.'],
    'Sala 26 m²': ['Living Room 26 m²', 'Sala 26 m²'],
    'Cozinha Completa': ['Fully Equipped Kitchen', 'Cocina Completa'],
    'Sofá Cama': ['Sofa Bed', 'Sofá Cama'],

    'Piscina e Deck': ['Pool & Deck', 'Piscina y Deck'],
    'A área externa é onde a hospedagem encontra a paisagem. Sob o pergolado envidraçado, o deck em cumaru convida à permanência em qualquer estação — do almoço ao ar livre às noites de inverno junto ao calor do fogo. Poucos passos adiante, a piscina de borda infinita aquecida se desenha em frente à serra, dissolvendo o limite entre a água e o horizonte.': [
      'The outdoor area is where the stay meets the landscape. Beneath the glazed pergola, the cumaru-wood deck invites you to linger in any season — from open-air lunches to winter nights by the warmth of the fire. A few steps away, the heated infinity pool stretches out before the mountains, dissolving the line between water and horizon.',
      'El área exterior es donde el hospedaje se encuentra con el paisaje. Bajo la pérgola acristalada, el deck de madera de cumarú invita a quedarse en cualquier estación — del almuerzo al aire libre a las noches de invierno junto al calor del fuego. A pocos pasos, la piscina climatizada de borde infinito se dibuja frente a la sierra, disolviendo el límite entre el agua y el horizonte.'],
    'Piscina Aquecida': ['Heated Pool', 'Piscina Climatizada'],
    'Deck de Madeira': ['Wooden Deck', 'Deck de Madera'],
    'Espreguiçadeiras': ['Sun Loungers', 'Tumbonas'],
    'Iluminação Noturna': ['Night Lighting', 'Iluminación Nocturna'],
    'Área Privativa': ['Private Area', 'Área Privada'],
    'Toalhas de Piscina': ['Pool Towels', 'Toallas de Piscina'],
    'Paisagismo Nativo': ['Native Landscaping', 'Paisajismo Nativo'],
    'Hidromassagem': ['Hot Tub', 'Hidromasaje'],

    /* ── Passeios ── */
    'Lapinha da Serra · Passeios Exclusivos': ['Lapinha da Serra · Exclusive Tours', 'Lapinha da Serra · Paseos Exclusivos'],
    'Crie seu próprio caminho com': ['Chart your own path with', 'Crea tu propio camino con'],
    'passeios privativos.': ['private tours.', 'paseos privados.'],
    'O Solar do Espinhaço organiza roteiros exclusivos para que cada hóspede explore a Serra no seu próprio ritmo, conectando-se de forma genuína com a natureza, a história e a hospitalidade de Lapinha da Serra.': [
      'Solar do Espinhaço arranges exclusive itineraries so that each guest can explore the mountains at their own pace, connecting genuinely with the nature, history and hospitality of Lapinha da Serra.',
      'Solar do Espinhaço organiza itinerarios exclusivos para que cada huésped explore la sierra a su propio ritmo, conectándose de forma genuina con la naturaleza, la historia y la hospitalidad de Lapinha da Serra.'],
    'Filtrar por tipo': ['Filter by type', 'Filtrar por tipo'],
    'Todos': ['All', 'Todos'],
    'Cachoeiras': ['Waterfalls', 'Cascadas'],
    'Poços': ['Natural Pools', 'Pozas'],
    'Trilhas & Picos': ['Trails & Peaks', 'Senderos y Picos'],
    'Aquático': ['On the Water', 'Acuático'],

    'A Cachoeira do Lajeado destaca-se por sua imponente queda de cerca de quarenta metros sobre um paredão de pedra, que forma, ao pé do salto, um amplo poço de águas verdes e cristalinas. Considerada um dos melhores pontos de mergulho da região, pode ser alcançada a pé, a cavalo ou de caiaque, conforme o nível das águas e a sua preferência.': [
      'Cachoeira do Lajeado stands out for its imposing drop of about forty meters down a rock wall, which forms a wide pool of clear green water at its base. Considered one of the best swimming spots in the region, it can be reached on foot, on horseback or by kayak, depending on the water level and your preference.',
      'La Cachoeira do Lajeado destaca por su imponente caída de unos cuarenta metros sobre un paredón de piedra, que forma, al pie del salto, una amplia poza de aguas verdes y cristalinas. Considerada uno de los mejores puntos para bañarse de la región, se puede llegar a pie, a caballo o en kayak, según el nivel del agua y su preferencia.'],
    'Inserido em uma área de preservação alimentada pelo Rio das Pedras, o Bicame oferece uma piscina natural funda e de águas esverdeadas, emoldurada pela vegetação nativa. Com visitação limitada a poucas pessoas por dia, garante exclusividade e silêncio. O acesso pode ser feito pela trilha ou, quando a lagoa está cheia, por um agradável trajeto de canoa.': [
      'Set within a conservation area fed by the Rio das Pedras, Bicame offers a deep natural pool of greenish water framed by native vegetation. With visits limited to a few people a day, it guarantees exclusivity and silence. Access is by trail or, when the lagoon is full, by a pleasant canoe ride.',
      'Ubicado en un área de preservación alimentada por el Rio das Pedras, el Bicame ofrece una piscina natural profunda de aguas verdosas, enmarcada por la vegetación nativa. Con visitas limitadas a pocas personas por día, garantiza exclusividad y silencio. El acceso puede hacerse por el sendero o, cuando la laguna está llena, en un agradable trayecto en canoa.'],
    'Reservado aos que apreciam o desafio, o Poço do Soberbo é alcançado por uma trilha longa, de cerca de dezessete quilômetros, que exige preparo físico. Afastado do movimento, recompensa o esforço com isolamento, silêncio e a satisfação de um mergulho verdadeiramente conquistado.': [
      'Reserved for those who enjoy a challenge, Poço do Soberbo is reached by a long trail of about seventeen kilometers that demands physical fitness. Far from the crowds, it rewards the effort with seclusion, silence and the satisfaction of a truly earned swim.',
      'Reservado para quienes aprecian el desafío, el Poço do Soberbo se alcanza por un sendero largo, de unos diecisiete kilómetros, que exige preparación física. Alejado del movimiento, recompensa el esfuerzo con aislamiento, silencio y la satisfacción de un baño verdaderamente conquistado.'],
    'A poucos passos do vilarejo, a Cachoeira do Rapel reúne, em um mesmo cenário, o descanso e a aventura. Suas águas convidam ao banho tranquilo, enquanto o paredão serve de palco para a prática de rapel, conduzida com total segurança. Uma excursão versátil, que se adapta ao ritmo e ao interesse de cada visitante.': [
      'A short walk from the village, Cachoeira do Rapel brings rest and adventure together in a single setting. Its waters invite a calm swim, while the rock wall is the stage for rappelling, conducted in complete safety. A versatile outing that adapts to the pace and interests of each visitor.',
      'A pocos pasos del pueblo, la Cachoeira do Rapel reúne, en un mismo escenario, el descanso y la aventura. Sus aguas invitan a un baño tranquilo, mientras el paredón sirve de escenario para la práctica de rápel, realizada con total seguridad. Una excursión versátil, que se adapta al ritmo y al interés de cada visitante.'],
    'Reservada e de acesso discreto, a Cachoeira do Paraíso surge a partir de um desvio no caminho do Pico da Lapinha. Com cerca de vinte metros de queda e raras presenças por perto, é um refúgio para quem busca privacidade e contemplação — um convite a desacelerar diante da água.': [
      'Secluded and discreetly accessed, Cachoeira do Paraíso appears along a detour on the way to Pico da Lapinha. With a drop of about twenty meters and rarely anyone nearby, it is a refuge for those seeking privacy and contemplation — an invitation to slow down by the water.',
      'Reservada y de acceso discreto, la Cachoeira do Paraíso aparece a partir de un desvío en el camino al Pico da Lapinha. Con unos veinte metros de caída y casi nadie alrededor, es un refugio para quien busca privacidad y contemplación — una invitación a bajar el ritmo frente al agua.'],
    'O mais acessível e procurado dos poços da Lapinha, a apenas quinze minutos de caminhada do centro. Suas águas escuras e cristalinas, com até vinte metros de profundidade, são abraçadas por um pequeno desfiladeiro de pedra que forma uma ducha natural. Refrescante o ano inteiro, é ideal para visitantes de todas as idades.': [
      'The most accessible and popular of Lapinha’s natural pools, just a fifteen-minute walk from the center. Its dark, crystal-clear waters, up to twenty meters deep, are embraced by a small stone gorge that forms a natural shower. Refreshing all year round, it is ideal for visitors of all ages.',
      'La más accesible y visitada de las pozas de Lapinha, a solo quince minutos a pie del centro. Sus aguas oscuras y cristalinas, de hasta veinte metros de profundidad, están abrazadas por un pequeño desfiladero de piedra que forma una ducha natural. Refrescante todo el año, es ideal para visitantes de todas las edades.'],
    'Travessia Lapinha – Tabuleiro': ['Lapinha – Tabuleiro Trek', 'Travesía Lapinha – Tabuleiro'],
    'Uma das travessias mais clássicas do montanhismo brasileiro, percorre a Serra do Espinhaço ao longo de dois a três dias, com pernoites em meio à serra. Tem como destino a Cachoeira do Tabuleiro, a mais alta de Minas Gerais, com 273 metros de queda. Indicada a caminhantes preparados, é sempre realizada com guia credenciado.': [
      'One of the classic treks of Brazilian mountaineering, it crosses the Serra do Espinhaço over two to three days, with nights spent in the mountains. Its destination is Cachoeira do Tabuleiro, the tallest waterfall in Minas Gerais, with a 273-meter drop. Recommended for well-prepared hikers, it is always undertaken with a licensed guide.',
      'Una de las travesías más clásicas del montañismo brasileño, recorre la Serra do Espinhaço a lo largo de dos o tres días, con pernoctes en plena sierra. Su destino es la Cachoeira do Tabuleiro, la más alta de Minas Gerais, con 273 metros de caída. Indicada para caminantes preparados, se realiza siempre con guía acreditado.'],
    'Pinturas Rupestres': ['Rock Paintings', 'Pinturas Rupestres'],
    'Ao pé do Pico do Breu, um paredão rochoso guarda pinturas rupestres de quase sete mil anos, produzidas com pigmentos naturais de ferro e manganês. Alcançado de barco ou por trilha, sempre com guia, é um patrimônio frágil e protegido — uma autêntica viagem no tempo, indicada a quem aprecia história, cultura e a dimensão ancestral da serra.': [
      'At the foot of Pico do Breu, a rock wall holds cave paintings almost seven thousand years old, made with natural iron and manganese pigments. Reached by boat or by trail, always with a guide, it is a fragile and protected heritage site — a true journey through time, for those who appreciate history, culture and the ancestral dimension of the mountains.',
      'Al pie del Pico do Breu, un paredón rocoso guarda pinturas rupestres de casi siete mil años, realizadas con pigmentos naturales de hierro y manganeso. Se llega en barco o por sendero, siempre con guía; es un patrimonio frágil y protegido — un auténtico viaje en el tiempo, indicado para quien aprecia la historia, la cultura y la dimensión ancestral de la sierra.'],
    'Stand Up e Caiaque': ['Stand-Up Paddle & Kayak', 'Stand Up y Kayak'],
    'Sobre as águas calmas da represa, o stand-up paddle e o caiaque permitem explorar enseadas escondidas e pequenas praias. Ao entardecer, a superfície se transforma em espelho e o sol doura as montanhas — cenário das remadas guiadas ao pôr do sol e, em datas especiais, sob a lua cheia. Atividade adequada a iniciantes e experientes.': [
      'On the calm waters of the reservoir, stand-up paddle and kayak let you explore hidden coves and small beaches. At dusk the surface turns into a mirror and the sun gilds the mountains — the setting for guided sunset paddles and, on special dates, paddles under the full moon. Suitable for beginners and experienced paddlers alike.',
      'Sobre las aguas tranquilas del embalse, el stand-up paddle y el kayak permiten explorar ensenadas escondidas y pequeñas playas. Al atardecer, la superficie se vuelve espejo y el sol dora las montañas — escenario de las remadas guiadas al atardecer y, en fechas especiales, bajo la luna llena. Actividad apta para principiantes y experimentados.'],
    'Segundo ponto mais alto da Serra do Cipó, com cerca de 1.647 metros, o Pico da Lapinha recompensa a subida íngreme com uma vista soberana do vilarejo e da lagoa. É um dos mirantes naturais mais memoráveis da região, indicado a quem tem disposição para a caminhada.': [
      'The second-highest point in the Serra do Cipó, at about 1,647 meters, Pico da Lapinha rewards the steep climb with a commanding view of the village and the lagoon. It is one of the most memorable natural lookouts in the region, for those up for the hike.',
      'Segundo punto más alto de la Serra do Cipó, con unos 1.647 metros, el Pico da Lapinha recompensa la empinada subida con una vista soberana del pueblo y de la laguna. Es uno de los miradores naturales más memorables de la región, indicado para quien tiene ánimo para la caminata.'],
    'O ponto mais alto da região, a cerca de 1.687 metros. Sua trilha exigente, recomendada a caminhantes experientes e acompanhados de guia, conduz a um cume de onde se descortina um verdadeiro mar de montanhas, que alcança, em dias claros, a região do Pico do Itambé.': [
      'The highest point in the region, at about 1,687 meters. Its demanding trail, recommended for experienced hikers accompanied by a guide, leads to a summit that reveals a true sea of mountains, reaching, on clear days, as far as the Pico do Itambé region.',
      'El punto más alto de la región, a unos 1.687 metros. Su exigente sendero, recomendado para caminantes experimentados y acompañados de guía, conduce a una cumbre desde donde se abre un verdadero mar de montañas que alcanza, en días claros, la región del Pico do Itambé.'],

    /* ── Contato / rodapé ── */
    'Sua estadia na serra': ['Your stay in the mountains', 'Tu estadía en la sierra'],
    'começa aqui.': ['begins here.', 'comienza aquí.'],
    'O Solar do Espinhaço reserva para você um espaço onde o tempo desacelera e a natureza volta a fazer sentido.': [
      'Solar do Espinhaço holds a place for you where time slows down and nature makes sense again.',
      'Solar do Espinhaço reserva para ti un espacio donde el tiempo se desacelera y la naturaleza vuelve a tener sentido.'],
    'Uma pousada boutique na Serra do Espinhaço. Silêncio, paisagem e hospitalidade em Lapinha da Serra.': [
      'A boutique inn in the Serra do Espinhaço. Silence, scenery and hospitality in Lapinha da Serra.',
      'Una posada boutique en la Serra do Espinhaço. Silencio, paisaje y hospitalidad en Lapinha da Serra.'],
    'Telefone · +55 31 9 9755-5245': ['Phone · +55 31 9 9755-5245', 'Teléfono · +55 31 9 9755-5245'],
    'Localização': ['Location', 'Ubicación'],
    'Ver no mapa →': ['View on map →', 'Ver en el mapa →'],
    'Informações': ['Information', 'Información'],
    'Check-in 15h · Check-out 12h': ['Check-in 3 pm · Check-out 12 pm', 'Check-in 15 h · Check-out 12 h'],
    'Reservas direto pelo site': ['Book directly on the website', 'Reservas directas en el sitio'],
    '© 2026 Solar do Espinhaço. Todos os direitos reservados.': ['© 2026 Solar do Espinhaço. All rights reserved.', '© 2026 Solar do Espinhaço. Todos los derechos reservados.'],
    'Política de Privacidade': ['Privacy Policy', 'Política de Privacidad'],
    'Termos de Uso': ['Terms of Use', 'Términos de Uso'],

    /* ── Reserva (popup, calendário, hóspedes) ── */
    'Hóspedes': ['Guests', 'Huéspedes'],
    'Selecionar data': ['Select date', 'Seleccionar fecha'],
    'Ver disponibilidade': ['Check availability', 'Ver disponibilidad'],
    'Adulto': ['Adult', 'Adulto'],
    'Adultos': ['Adults', 'Adultos'],
    'Criança': ['Child', 'Niño'],
    'Crianças': ['Children', 'Niños'],
    '13+ anos': ['Ages 13+', '13+ años'],
    '2–12 anos': ['Ages 2–12', '2–12 años'],
    'noite': ['night', 'noche'],
    'noites': ['nights', 'noches'],
    'Limpar': ['Clear', 'Borrar'],
    'Selecione a data de saída': ['Select your check-out date', 'Selecciona la fecha de salida'],
    'Selecione o período desejado': ['Select your dates', 'Selecciona el período deseado'],

    /* ── Textos alternativos das imagens ── */
    'Solar do Espinhaço | Lapinha da Serra': ['Solar do Espinhaço | Lapinha da Serra', 'Solar do Espinhaço | Lapinha da Serra'],
    'Suíte — Solar do Espinhaço': ['Suite — Solar do Espinhaço', 'Suite — Solar do Espinhaço'],
    'Suíte 2 — Solar do Espinhaço': ['Suite 2 — Solar do Espinhaço', 'Suite 2 — Solar do Espinhaço'],
    'Suíte 3 — Solar do Espinhaço': ['Suite 3 — Solar do Espinhaço', 'Suite 3 — Solar do Espinhaço'],
    'Sala integrada — Solar do Espinhaço': ['Open-plan living room — Solar do Espinhaço', 'Sala integrada — Solar do Espinhaço'],
    'Sala — Solar do Espinhaço': ['Living room — Solar do Espinhaço', 'Sala — Solar do Espinhaço'],
    'Sala 2 — Solar do Espinhaço': ['Living room 2 — Solar do Espinhaço', 'Sala 2 — Solar do Espinhaço'],
    'Piscina — Solar do Espinhaço': ['Pool — Solar do Espinhaço', 'Piscina — Solar do Espinhaço'],
    'Piscina noturna — Solar do Espinhaço': ['Pool at night — Solar do Espinhaço', 'Piscina de noche — Solar do Espinhaço'],
    'Trilha pela Serra do Espinhaço': ['Trail through the Serra do Espinhaço', 'Sendero por la Serra do Espinhaço']
  };

  var MONTHS = {
    pt: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    es: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  };
  var WDAYS = {
    pt: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  };
  var HTML_LANG = { pt: 'pt-BR', en: 'en', es: 'es' };
  var ATTRS = ['alt', 'aria-label', 'title', 'placeholder'];
  var STORE_KEY = 'solar-lang';

  var lang = 'pt';
  var textOrig = new WeakMap();   /* nó de texto → original em português */

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  /* Traduz um texto em português para o idioma atual. */
  function t(pt) {
    if (lang === 'pt') return pt;
    var e = DICT[pt];
    return e ? e[lang === 'en' ? 0 : 1] : pt;
  }

  /* Trechos controlados por script marcam data-i18n-skip e se
     redesenham sozinhos chamando I18N.t(). */
  function skipped(el) {
    return !!(el && el.closest && el.closest('script, style, [data-i18n-skip], .bk-pop'));
  }

  function translateTextNode(node) {
    if (skipped(node.parentElement)) return;
    var orig = textOrig.get(node);
    if (orig === undefined) {
      if (!norm(node.nodeValue)) return;
      orig = node.nodeValue;
      textOrig.set(node, orig);
    }
    var key = norm(orig);
    var out = t(key);
    /* preserva os espaços/quebras ao redor do texto original */
    var lead = orig.match(/^\s*/)[0], trail = orig.match(/\s*$/)[0];
    var next = (out === key) ? orig : lead + out + trail;
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function translateAttrs(el) {
    if (skipped(el)) return;
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var store = 'data-i18n-' + a;
      if (!el.hasAttribute(store)) el.setAttribute(store, el.getAttribute(a));
      var out = t(norm(el.getAttribute(store)));
      if (el.getAttribute(a) !== out) el.setAttribute(a, out);
    });
  }

  function apply(next) {
    if (!MONTHS[next]) next = 'pt';
    lang = next;
    document.documentElement.lang = HTML_LANG[lang];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) translateTextNode(n);
    document.querySelectorAll('[alt], [aria-label], [title], [placeholder]').forEach(translateAttrs);
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) { /* armazenamento indisponível */ }
  }

  function saved() {
    try { var v = localStorage.getItem(STORE_KEY); return MONTHS[v] ? v : 'pt'; }
    catch (e) { return 'pt'; }
  }

  return {
    t: t,
    apply: apply,
    saved: saved,
    lang: function () { return lang; },
    months: function () { return MONTHS[lang]; },
    wdays: function () { return WDAYS[lang]; },
    /* data por extenso: "28 Novembro, 2026" · "November 28, 2026" */
    date: function (d) {
      var m = MONTHS[lang][d.getMonth()];
      return lang === 'en' ? m + ' ' + d.getDate() + ', ' + d.getFullYear()
                           : d.getDate() + ' ' + m + ', ' + d.getFullYear();
    }
  };
})();
