"""Gera lambda/index.js e o modelo de fala da skill de vídeo.
A abertura é o vídeo assets/abertura.mp4 (gravado de echo-show/abertura.html), tocado em tela cheia pelo componente Video do APL.
Rode:  python3 build_skill.py
O vídeo dura ~21,7 s: abertura, selo com pausa de ~4 s, escurece e termina em preto; começa também em preto, então o loop não pisca."""
import json

S900='#1C1917'   # --bg-dark-1 do design system: fundo atrás do vídeo

doc={"type":"APL","version":"2023.3","theme":"dark","settings":{"idleTimeout":300000},
 "mainTemplate":{"parameters":["payload"],"items":[
  {"type":"Container","width":"100vw","height":"100vh","items":[
    {"type":"Frame","position":"absolute","width":"100vw","height":"100vh","backgroundColor":S900},
    # best-fill cobre a tela (em 16:10 corta ~5% de cada lado, onde só há fundo); em retrato usa best-fit para não cortar
    {"type":"Video","id":"abertura","position":"absolute","width":"100vw","height":"100vh",
     "scale":"${viewport.width >= viewport.height ? 'best-fill' : 'best-fit'}",
     "autoplay":True,"audioTrack":"none","source":"${payload.data.video}",
     # ao terminar (o vídeo acaba em preto, depois da pausa no selo) volta ao início e toca de novo
     "onEnd":[{"type":"ControlMedia","componentId":"abertura","command":"rewind"},
              {"type":"ControlMedia","componentId":"abertura","command":"play"}]},
    # toque na tela: volta ao início e toca de novo
    {"type":"TouchWrapper","position":"absolute","width":"100vw","height":"100vh",
     "onPress":[{"type":"ControlMedia","componentId":"abertura","command":"rewind"},
                {"type":"ControlMedia","componentId":"abertura","command":"play"}]}]}]}}

INDEX=r'''/* Solar do Espinhaço · skill para Echo Show (vídeo em tela cheia)
   Hospedagem: Alexa-hosted (Node.js). Cole este arquivo como lambda/index.js.
   O vídeo (abertura.mp4) fica privado no bucket da skill, na pasta Media. A skill assina um link temporário
   a cada abertura, então não é preciso copiar nenhuma URL. O arquivo precisa se chamar abertura.mp4. */
const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');

const VIDEO_KEY = 'Media/abertura.mp4';
const s3 = new AWS.S3({ signatureVersion: 'v4', region: process.env.S3_PERSISTENCE_REGION });
function videoUrl() {
  try {
    return s3.getSignedUrl('getObject', { Bucket: process.env.S3_PERSISTENCE_BUCKET, Key: VIDEO_KEY, Expires: 3600 });
  } catch (e) {
    console.log('Falha ao assinar o vídeo:', e);
    return '';
  }
}

const DOCUMENT = __DOC__;

const TOKEN = 'abertura';
const supportsAPL = (h) => {
  const i = Alexa.getSupportedInterfaces(h.requestEnvelope);
  return !!(i && i['Alexa.Presentation.APL']);
};
const render = (h) => {
  const video = videoUrl();
  console.log('Vídeo:', video ? video.split('?')[0] : '(sem vídeo)');
  return h.responseBuilder.addDirective({
    type: 'Alexa.Presentation.APL.RenderDocument',
    token: TOKEN,
    document: DOCUMENT,
    datasources: { payload: { data: { video } } },
  });
};

/* A abertura é silenciosa: nenhuma fala, só o vídeo. */
const LaunchRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  handle(h) {
    if (!supportsAPL(h)) {
      return h.responseBuilder.speak('Solar do Espinhaço. Esta skill foi feita para a tela do Echo Show.').getResponse();
    }
    return render(h).withShouldEndSession(false).getResponse();
  },
};

const ReplayIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
    && Alexa.getIntentName(h.requestEnvelope) === 'ReplayIntent',
  handle: (h) => render(h).withShouldEndSession(false).getResponse(),
};

const HelpHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
    && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent',
  handle: (h) => render(h).speak('Toque na tela ou diga de novo para rever a abertura, ou diga parar para sair.')
    .reprompt('Toque na tela ou diga parar.').getResponse(),
};

const StopHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
    && ['AMAZON.CancelIntent', 'AMAZON.StopIntent', 'AMAZON.NavigateHomeIntent'].includes(Alexa.getIntentName(h.requestEnvelope)),
  handle: (h) => h.responseBuilder.getResponse(),
};

const FallbackHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
    && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.FallbackIntent',
  handle: (h) => render(h).speak('Toque na tela para rever a abertura.').reprompt('Toque na tela.').getResponse(),
};

const SessionEndedHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
  handle(h) {
    const r = h.requestEnvelope.request;
    if (r.reason === 'ERROR') console.log('Sessão encerrada com erro:', JSON.stringify(r.error));
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
  .addRequestHandlers(LaunchRequestHandler, ReplayIntentHandler, HelpHandler, StopHandler, FallbackHandler, SessionEndedHandler)
  .addErrorHandlers(ErrorHandler)
  .lambda();
'''
open('lambda/index.js','w').write(INDEX.replace('__DOC__',json.dumps(doc,ensure_ascii=False,indent=1)))
open('lambda/package.json','w').write(json.dumps({"name":"solar-do-espinhaco-echo-show","version":"2.0.0","description":"Abertura Solar do Espinhaço para Echo Show (vídeo)","main":"index.js","dependencies":{"ask-sdk-core":"^2.14.0","ask-sdk-model":"^1.86.0","aws-sdk":"^2.1692.0"}},indent=2)+'\n')
open('skill-package/interactionModels/custom/pt-BR.json','w').write(json.dumps({"interactionModel":{"languageModel":{
  "invocationName":"solar marca",
  "intents":[{"name":"AMAZON.CancelIntent","samples":[]},{"name":"AMAZON.HelpIntent","samples":[]},
             {"name":"AMAZON.StopIntent","samples":[]},{"name":"AMAZON.NavigateHomeIntent","samples":[]},
             {"name":"AMAZON.FallbackIntent","samples":[]},
             {"name":"ReplayIntent","slots":[],"samples":["de novo","repetir","repita","mostrar de novo","mostre de novo","começar de novo","ver de novo","passar de novo"]}],"types":[]}}},ensure_ascii=False,indent=2)+'\n')
print('ok')
