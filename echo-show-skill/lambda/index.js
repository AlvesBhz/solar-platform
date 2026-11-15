/* Solar do Espinhaço · skill para Echo Show (vídeo em tela cheia)
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

const DOCUMENT = {
 "type": "APL",
 "version": "2023.3",
 "theme": "dark",
 "settings": {
  "idleTimeout": 300000
 },
 "onMount": [
  {
   "type": "ControlMedia",
   "componentId": "abertura",
   "command": "play",
   "delay": 700
  }
 ],
 "mainTemplate": {
  "parameters": [
   "payload"
  ],
  "items": [
   {
    "type": "Container",
    "width": "100vw",
    "height": "100vh",
    "items": [
     {
      "type": "Frame",
      "position": "absolute",
      "width": "100vw",
      "height": "100vh",
      "backgroundColor": "#1C1917"
     },
     {
      "type": "Video",
      "id": "abertura",
      "position": "absolute",
      "width": "100vw",
      "height": "100vh",
      "scale": "${viewport.width >= viewport.height ? 'best-fill' : 'best-fit'}",
      "autoplay": true,
      "audioTrack": "none",
      "source": "${payload.data.video}",
      "onEnd": [
       {
        "type": "ControlMedia",
        "componentId": "abertura",
        "command": "rewind"
       },
       {
        "type": "ControlMedia",
        "componentId": "abertura",
        "command": "play"
       }
      ],
      "onFail": [
       {
        "type": "SendEvent",
        "arguments": [
         "videoFail",
         "${event.errorCode}",
         "${event.error}"
        ]
       }
      ]
     },
     {
      "type": "TouchWrapper",
      "position": "absolute",
      "width": "100vw",
      "height": "100vh",
      "onPress": [
       {
        "type": "ControlMedia",
        "componentId": "abertura",
        "command": "rewind"
       },
       {
        "type": "ControlMedia",
        "componentId": "abertura",
        "command": "play"
       }
      ]
     }
    ]
   }
  ]
 }
};

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

/* O Alexa avisa a skill quando a tela (APL) dá erro de execução, por exemplo vídeo que não abre. Fica no CloudWatch. */
const RuntimeErrorHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'Alexa.Presentation.APL.RuntimeError',
  handle(h) {
    console.log('Erro da tela (APL):', JSON.stringify(h.requestEnvelope.request.errors));
    return h.responseBuilder.getResponse();
  },
};

const VideoFailHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'Alexa.Presentation.APL.UserEvent'
    && (h.requestEnvelope.request.arguments || [])[0] === 'videoFail',
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
  .addRequestHandlers(LaunchRequestHandler, RuntimeErrorHandler, VideoFailHandler, ReplayIntentHandler, HelpHandler, StopHandler, FallbackHandler, SessionEndedHandler, CatchAllHandler)
  .addErrorHandlers(ErrorHandler)
  .lambda();
