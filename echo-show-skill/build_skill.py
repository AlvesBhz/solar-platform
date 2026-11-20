"""Gera lambda/index.js e o modelo de fala da skill.
 - Abertura: assets/abertura.mp4 (gravado de echo-show/abertura.html), em tela cheia e em loop.
 - Itens da casa: um vídeo curto por item (assets/itens/<id>.mp4), chamado por voz ("onde fica o cofre?")
   ou pelo toque no menu. A lista vem de content/itens.json.
Rode:  python3 build_skill.py"""
import json, copy

DEBUG = True     # mostra no canto da tela o estado do vídeo; ponha False quando estiver funcionando
S900 = '#1C1917'  # --bg-dark-1 do design system
CREAM = '#FAFAF9'
SERIF = 'noto-serif, bookerly, serif'

itens = json.load(open('content/itens.json'))['itens']
cap = lambda s: s[0].upper() + s[1:] if s[:1].islower() else s

def video_doc(on_end):
    """Documento com o vídeo em tela cheia. on_end: comandos quando o vídeo termina."""
    return {"type":"APL","version":"2023.3","theme":"dark","settings":{"idleTimeout":300000},
     # o vídeo começa em preto por ~0,5 s; este comando garante o play caso o autoplay seja bloqueado
     "onMount":[{"type":"ControlMedia","componentId":"video","command":"play","delay":700}],
     "mainTemplate":{"parameters":["payload"],"items":[
      {"type":"Container","width":"100vw","height":"100vh","items":[
        {"type":"Frame","position":"absolute","width":"100vw","height":"100vh","backgroundColor":S900},
        # best-fill cobre a tela (em 16:10 corta ~5% de cada lado); em retrato usa best-fit para não cortar
        {"type":"Video","id":"video","position":"absolute","width":"100vw","height":"100vh",
         "scale":"${viewport.width >= viewport.height ? 'best-fill' : 'best-fit'}",
         "autoplay":True,"audioTrack":"none","source":"${payload.data.video}",
         "onEnd":on_end,
         "onTrackReady":[{"type":"SetValue","componentId":"status","property":"text","value":"Vídeo pronto"}],
         "onPlay":[{"type":"SetValue","componentId":"status","property":"text","value":"Tocando"}],
         "onTrackFail":[{"type":"SetValue","componentId":"status","property":"text","value":"Falha ao abrir o vídeo"},
                        {"type":"SendEvent","arguments":["videoFail","${event.trackIndex}"]}]},
        {"type":"Text","id":"status","position":"absolute","left":"16dp","bottom":"12dp","fontSize":"14dp","color":"rgba(255,255,255,0.7)",
         "text":"Abrindo o vídeo…","opacity":1 if DEBUG else 0},
        # toque na tela: volta ao início e toca de novo
        {"type":"TouchWrapper","position":"absolute","width":"100vw","height":"100vh",
         "onPress":[{"type":"ControlMedia","componentId":"video","command":"rewind"},
                    {"type":"ControlMedia","componentId":"video","command":"play"}]}]}]}}

DOC_ABERTURA = video_doc([{"type":"ControlMedia","componentId":"video","command":"rewind"},
                          {"type":"ControlMedia","componentId":"video","command":"play"}])   # loop
DOC_ITEM = video_doc([{"type":"SendEvent","arguments":["menu"]}])                            # ao fim, abre o menu de itens

DOC_MENU = {"type":"APL","version":"2023.3","theme":"dark","settings":{"idleTimeout":300000},
 "mainTemplate":{"parameters":["payload"],"items":[
  {"type":"Container","width":"100vw","height":"100vh","items":[
    {"type":"Frame","position":"absolute","width":"100vw","height":"100vh","backgroundColor":"#000000"},
    {"type":"Container","width":"100vw","height":"100vh","paddingLeft":"4vw","paddingRight":"4vw","paddingTop":"5vh","items":[
      {"type":"Text","text":"Qual item você quer ver?","fontFamily":SERIF,"fontSize":"6.5vh","color":CREAM},
      {"type":"Text","text":"Toque em um item, ou diga: onde fica o cofre?","fontSize":"2.6vh","color":"rgba(255,255,255,0.6)","spacing":"1.2vh"},
      {"type":"GridSequence","width":"92vw","height":"72vh","spacing":"3vh","scrollDirection":"vertical",
       "childWidth":"30.6vw","childHeight":"17vh","data":"${payload.data.itens}",
       "items":[{"type":"TouchWrapper","padding":"0.8vh",
                 "onPress":[{"type":"SendEvent","arguments":["item","${data.id}"]}],
                 "item":{"type":"Frame","width":"100%","height":"100%","borderWidth":"1dp","borderColor":"rgba(250,250,249,0.35)","borderRadius":"8dp",
                         "item":{"type":"Text","width":"100%","height":"100%","text":"${data.nome}","fontFamily":SERIF,"fontSize":"3.8vh","color":CREAM,
                                 "textAlign":"center","textAlignVertical":"center"}}}]}]}]}]}}

INDEX = r'''/* Solar do Espinhaço · skill para Echo Show
   - "Alexa, abrir solar marca": abertura da marca em vídeo, em loop.
   - "onde fica o cofre?" (e os outros itens da casa): vídeo curto do item, por voz ou pelo toque no menu.
   Hospedagem: Alexa-hosted (Node.js). Cole este arquivo como lambda/index.js.
   Os vídeos ficam privados no bucket da skill, na pasta Media (Media/abertura.mp4 e Media/itens/<id>.mp4).
   A skill assina um link temporário a cada pedido, então não é preciso copiar nenhuma URL. */
const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({ signatureVersion: 'v4', region: process.env.S3_PERSISTENCE_REGION });
function videoUrl(key) {
  try {
    return s3.getSignedUrl('getObject', { Bucket: process.env.S3_PERSISTENCE_BUCKET, Key: key, Expires: 3600 });
  } catch (e) {
    console.log('Falha ao assinar o vídeo:', key, e);
    return '';
  }
}

/* Itens da casa (vêm de content/itens.json). "onde" vazio: a skill só diz "Aqui está ...". */
const ITENS = __ITENS__;

const DOC_ABERTURA = __DOC_ABERTURA__;
const DOC_ITEM = __DOC_ITEM__;
const DOC_MENU = __DOC_MENU__;

const supportsAPL = (h) => {
  const i = Alexa.getSupportedInterfaces(h.requestEnvelope);
  return !!(i && i['Alexa.Presentation.APL']);
};
const draw = (h, token, document, data) => h.responseBuilder.addDirective({
  type: 'Alexa.Presentation.APL.RenderDocument', token, document, datasources: { payload: { data } },
});

const showOpening = (h) => {
  const video = videoUrl('Media/abertura.mp4');
  console.log('Vídeo:', video ? video.split('?')[0] : '(sem vídeo)');
  return draw(h, 'abertura', DOC_ABERTURA, { video });
};
const showMenu = (h) => draw(h, 'menu', DOC_MENU, { itens: ITENS.map((i) => ({ id: i.id, nome: i.nomeExibir })) });
const showItem = (h, item) => {
  const video = videoUrl('Media/itens/' + item.id + '.mp4');
  console.log('Item:', item.id, video ? video.split('?')[0] : '(sem vídeo)');
  const fala = 'Aqui está ' + item.artigo + ' ' + item.nome + '.' + (item.onde ? ' ' + item.onde : '');
  return draw(h, 'item', DOC_ITEM, { video }).speak(fala);
};

const isReq = (h, t) => Alexa.getRequestType(h.requestEnvelope) === t;
const isIntent = (h, n) => isReq(h, 'IntentRequest') && Alexa.getIntentName(h.requestEnvelope) === n;
const isEvent = (h, a) => isReq(h, 'Alexa.Presentation.APL.UserEvent') && (h.requestEnvelope.request.arguments || [])[0] === a;

/* Item pedido por voz: usa a resolução do tipo de slot (id do item) */
function itemFromSlot(h) {
  const s = Alexa.getSlot(h.requestEnvelope, 'item');
  const auth = s && s.resolutions && s.resolutions.resolutionsPerAuthority;
  const ok = auth && auth.find((a) => a.status && a.status.code === 'ER_SUCCESS_MATCH');
  const id = ok && ok.values && ok.values[0] && ok.values[0].value && ok.values[0].value.id;
  return ITENS.find((i) => i.id === id);
}

const LaunchRequestHandler = {
  canHandle: (h) => isReq(h, 'LaunchRequest'),
  handle(h) {
    if (!supportsAPL(h)) return h.responseBuilder.speak('Solar do Espinhaço. Esta skill foi feita para a tela do Echo Show.').getResponse();
    return showOpening(h).withShouldEndSession(false).getResponse();
  },
};

const ItemIntentHandler = {
  canHandle: (h) => isIntent(h, 'ItemIntent'),
  handle(h) {
    if (!supportsAPL(h)) return h.responseBuilder.speak('Esta skill precisa da tela do Echo Show.').getResponse();
    const item = itemFromSlot(h);
    if (!item) {
      return showMenu(h).speak('Não encontrei esse item. Toque em um deles na tela, ou diga, por exemplo: onde fica o cofre?')
        .reprompt('Qual item você quer ver?').withShouldEndSession(false).getResponse();
    }
    return showItem(h, item).withShouldEndSession(false).getResponse();
  },
};

const ListaItensIntentHandler = {
  canHandle: (h) => isIntent(h, 'ListaItensIntent'),
  handle: (h) => showMenu(h).speak('Posso mostrar ' + ITENS.map((i) => i.artigo + ' ' + i.nome).join(', ') + '. Toque em um item ou diga, por exemplo: onde fica o cofre?')
    .reprompt('Qual item você quer ver?').withShouldEndSession(false).getResponse(),
};

/* Toque num item do menu */
const ItemEventHandler = {
  canHandle: (h) => isEvent(h, 'item'),
  handle(h) {
    const id = h.requestEnvelope.request.arguments[1];
    const item = ITENS.find((i) => i.id === id);
    return (item ? showItem(h, item) : showMenu(h)).withShouldEndSession(false).getResponse();
  },
};

/* O vídeo do item terminou: volta ao menu */
const MenuEventHandler = {
  canHandle: (h) => isEvent(h, 'menu'),
  handle: (h) => showMenu(h).withShouldEndSession(false).getResponse(),
};

const ReplayIntentHandler = {
  canHandle: (h) => isIntent(h, 'ReplayIntent'),
  handle: (h) => showOpening(h).withShouldEndSession(false).getResponse(),
};

const HelpHandler = {
  canHandle: (h) => isIntent(h, 'AMAZON.HelpIntent'),
  handle: (h) => showMenu(h).speak('Pergunte onde fica um item da casa, por exemplo: onde fica o cofre? Ou toque em um item na tela.')
    .reprompt('Qual item você quer ver?').getResponse(),
};

const StopHandler = {
  canHandle: (h) => ['AMAZON.CancelIntent', 'AMAZON.StopIntent', 'AMAZON.NavigateHomeIntent'].some((n) => isIntent(h, n)),
  handle: (h) => h.responseBuilder.getResponse(),
};

const FallbackHandler = {
  canHandle: (h) => isIntent(h, 'AMAZON.FallbackIntent'),
  handle: (h) => showMenu(h).speak('Não entendi. Toque em um item na tela, ou diga, por exemplo: onde fica o cofre?')
    .reprompt('Qual item você quer ver?').getResponse(),
};

const SessionEndedHandler = {
  canHandle: (h) => isReq(h, 'SessionEndedRequest'),
  handle(h) {
    const r = h.requestEnvelope.request;
    if (r.reason === 'ERROR') console.log('Sessão encerrada com erro:', JSON.stringify(r.error));
    return h.responseBuilder.getResponse();
  },
};

/* O Alexa avisa a skill quando a tela (APL) dá erro de execução, por exemplo vídeo que não abre. Fica no CloudWatch. */
const RuntimeErrorHandler = {
  canHandle: (h) => isReq(h, 'Alexa.Presentation.APL.RuntimeError'),
  handle(h) {
    console.log('Erro da tela (APL):', JSON.stringify(h.requestEnvelope.request.errors));
    return h.responseBuilder.getResponse();
  },
};

const VideoFailHandler = {
  canHandle: (h) => isEvent(h, 'videoFail'),
  handle(h) {
    console.log('O player não conseguiu abrir o vídeo:', JSON.stringify(h.requestEnvelope.request.arguments));
    return h.responseBuilder.getResponse();
  },
};

const CatchAllHandler = {
  canHandle: () => true,
  handle(h) {
    const r = h.requestEnvelope.request;
    console.log('Pedido sem tratamento:', r.type, JSON.stringify(r.arguments || r.intent || ''));
    return h.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle: () => true,
  handle(h, error) {
    console.log('Erro:', error && error.stack ? error.stack : error);
    return h.responseBuilder.speak('Desculpe, algo deu errado.').getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(LaunchRequestHandler, ItemIntentHandler, ListaItensIntentHandler, ItemEventHandler, MenuEventHandler,
    RuntimeErrorHandler, VideoFailHandler, ReplayIntentHandler, HelpHandler, StopHandler, FallbackHandler, SessionEndedHandler, CatchAllHandler)
  .addErrorHandlers(ErrorHandler)
  .lambda();
'''

dados = [{"id": i['id'], "artigo": i['artigo'], "nome": i['nome'], "nomeExibir": cap(i['nome']), "onde": i.get('onde', '').strip()} for i in itens]
js = (INDEX.replace('__ITENS__', json.dumps(dados, ensure_ascii=False, indent=1))
           .replace('__DOC_ABERTURA__', json.dumps(DOC_ABERTURA, ensure_ascii=False, indent=1))
           .replace('__DOC_ITEM__', json.dumps(DOC_ITEM, ensure_ascii=False, indent=1))
           .replace('__DOC_MENU__', json.dumps(DOC_MENU, ensure_ascii=False, indent=1)))
open('lambda/index.js', 'w').write(js)
open('lambda/package.json', 'w').write(json.dumps({"name":"solar-do-espinhaco-echo-show","version":"3.0.0","description":"Solar do Espinhaço para Echo Show: abertura e itens da casa em vídeo","main":"index.js","dependencies":{"ask-sdk-core":"^2.14.0","ask-sdk-model":"^1.86.0","aws-sdk":"^2.1692.0"}}, indent=2) + '\n')

# ── modelo de fala (pt-BR) ──
artigos = ['', 'o ', 'a ', 'os ', 'as ']
verbos = ['onde fica', 'onde está', 'onde encontro', 'cadê', 'me mostre', 'mostre', 'mostrar', 'como é']
amostras = sorted({f"{v} {a}{{item}}" for v in verbos for a in artigos})
valores = [{"id": i['id'], "name": {"value": i['nome'], "synonyms": i.get('sinonimos', [])}} for i in itens]
modelo = {"interactionModel": {"languageModel": {
  "invocationName": "solar marca",
  "intents": [
    {"name":"AMAZON.CancelIntent","samples":[]},{"name":"AMAZON.HelpIntent","samples":[]},
    {"name":"AMAZON.StopIntent","samples":[]},{"name":"AMAZON.NavigateHomeIntent","samples":[]},
    {"name":"AMAZON.FallbackIntent","samples":[]},
    {"name":"ReplayIntent","slots":[],"samples":["de novo","repetir","repita","mostrar de novo","mostre de novo","começar de novo","ver de novo","passar de novo"]},
    {"name":"ItemIntent","slots":[{"name":"item","type":"ITEM_CASA"}],"samples":amostras},
    {"name":"ListaItensIntent","slots":[],"samples":["quais itens","quais itens você mostra","o que você mostra","lista de itens","o que posso ver","o que tem na casa","mostrar os itens","me mostre os itens","menu","menu de itens"]}],
  "types": [{"name":"ITEM_CASA","values":valores}]}}}
open('skill-package/interactionModels/custom/pt-BR.json', 'w').write(json.dumps(modelo, ensure_ascii=False, indent=2) + '\n')
print('ok', len(itens), 'itens', len(amostras), 'frases')
