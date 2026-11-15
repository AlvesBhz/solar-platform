"""Gera lambda/index.js (com a tela APL embutida) e o modelo de fala.
Rode:  python3 build_skill.py
Tela pensada para o Echo Show 8 (1280x800 dp). Tudo em dp, convertido do desenho 1920x1080 (x 0,667)."""
import json

LEAF='m12 9l4.5-4.5m-4.5 10L18.5 8M12 19.5l7.5-7.5M12 22c4.418 0 8-3.646 8-8.143c0-4.462-2.553-9.67-6.537-11.531A3.45 3.45 0 0 0 12 2m0 20c-4.418 0-8-3.646-8-8.143c0-4.462 2.553-9.67 6.537-11.531A3.45 3.45 0 0 1 12 2m0 20V2'
def avg(color,w=1.5):
    return {"type":"AVG","version":"1.2","width":24,"height":24,"viewportWidth":24,"viewportHeight":24,
            "items":[{"type":"path","pathData":LEAF,"stroke":color,"strokeWidth":w,"strokeLineCap":"round","strokeLineJoin":"round"}]}

# cores do design system (tokens): cream, stone-900, pine, pine-deep e bone (sistema de logo)
CREAM='#FAFAF9'; S900='#1C1917'; PINE='#2C3E35'; PINE_DEEP='#1C2922'; BONE='#EAE5D9'
SERIF='noto-serif, bookerly, serif'      # fonte nativa do aparelho no lugar do Cormorant (não dá para carregar fonte própria)
SANS='amazon-ember, sans-serif'          # no lugar do Inter

def T(id_,text,size,color,**kw):
    d={"type":"Text","id":id_,"text":text,"fontSize":f"{size}dp","color":color,"fontFamily":kw.pop('font',SANS)}
    d.update(kw); return d

def ANIM(id_,delay,dur,props,easing="ease-in-out"):
    return {"type":"AnimateItem","componentId":id_,"delay":delay,"duration":dur,"easing":easing,"value":props}
def SET(id_,delay,prop,val):
    return {"type":"SetValue","componentId":id_,"delay":delay,"property":prop,"value":val}
def fade(id_,delay,dur,a,b,easing="ease-in-out"):
    """anima e fixa o valor final (garante o estado mesmo se o aparelho voltar ao valor inicial)."""
    return {"type":"Sequential","commands":[
        ANIM(id_,delay,dur,[{"property":"opacity","from":a,"to":b}],easing),
        SET(id_,0,"opacity",b)]}

DISC_DX=155   # (largura do grupo 380 / 2) - (disco 70 / 2): o disco nasce centralizado e desliza para a esquerda

hero={"type":"Container","id":"hero","position":"absolute","width":"100vw","height":"100vh","items":[
  {"type":"Image","id":"heroImg","source":"${payload.data.image}","scale":"best-fill","width":"100vw","height":"100vh","opacity":0.55,"position":"absolute"},
  {"type":"Frame","width":"100vw","height":"100vh","position":"absolute","backgroundColor":{"type":"linear","angle":0,"colorRange":["rgba(0,0,0,0.5)","rgba(0,0,0,0)","rgba(0,0,0,0.8)"],"inputRange":[0,0.5,1]}},
  {"type":"Container","id":"logo","position":"absolute","top":"43dp","left":"450dp","width":"380dp","direction":"row","alignItems":"center","items":[
     {"type":"Container","id":"disc","width":"70dp","height":"70dp","opacity":0,"alignItems":"center","justifyContent":"center","transform":[{"translateX":f"{DISC_DX}dp"}],"items":[
        {"type":"Frame","position":"absolute","width":"70dp","height":"70dp","borderRadius":"35dp","borderWidth":"1dp","borderColor":"rgba(255,255,255,0.55)"},
        {"type":"AlexaVectorGraphic","source":"leafLight","width":"39dp","height":"39dp"}]},
     {"type":"Container","id":"expand","direction":"row","alignItems":"center","opacity":0,"items":[
        {"type":"Frame","width":"1dp","height":"70dp","marginLeft":"24dp","backgroundColor":"rgba(255,255,255,0.22)"},
        {"type":"Container","marginLeft":"24dp","items":[
           T("wm1","SOLAR DO",11,"rgba(255,255,255,0.6)",letterSpacing="4dp"),
           T("wm2","ESPINHAÇO",31,"rgba(255,255,255,0.93)",font=SERIF,letterSpacing="2dp",fontWeight="500",spacing="4dp"),
           T("wm3","LAPINHA · MINAS GERAIS",10,"rgba(255,255,255,0.55)",letterSpacing="3dp",spacing="8dp")]}]}]},
  {"type":"Container","id":"title","position":"absolute","left":"110dp","top":"230dp","opacity":0,"items":[
     T("t0","CHALÉ BOUTIQUE · LAPINHA DA SERRA · MINAS GERAIS",13,"rgba(255,255,255,0.55)",letterSpacing="4dp"),
     T("t1","SOLAR DO",170,"rgba(255,255,255,0.80)",font=SERIF,fontWeight="500",lineHeight=0.9,spacing="22dp"),
     T("t2","ESPINHAÇO",90,"rgba(245,245,244,0.72)",font=SERIF,fontWeight="300",lineHeight=0.9,spacing="6dp",paddingLeft="100dp")]},
  {"type":"Container","id":"phrase","position":"absolute","width":"100vw","height":"100vh","justifyContent":"center","alignItems":"center","opacity":0,"items":[
     T("ph","O espinhaço te conecta com a natureza.",48,"rgba(255,255,255,0.93)",font=SERIF,fontStyle="italic")]}
]}

SEAL=267  # 400px do desenho web
final={"type":"Container","id":"final","position":"absolute","width":"100vw","height":"100vh","opacity":0,"items":[
  {"type":"Frame","width":"100vw","height":"100vh","position":"absolute","backgroundColor":S900},
  {"type":"Frame","position":"absolute","left":"240dp","top":"-40dp","width":"800dp","height":"800dp","borderRadius":"400dp",
     "backgroundColor":{"type":"radial","colorRange":["rgba(44,62,53,0.62)","rgba(44,62,53,0)"],"inputRange":[0,0.7]}},
  {"type":"Container","id":"seal","position":"absolute","left":f"{(1280-SEAL)//2}dp","top":"250dp","width":f"{SEAL}dp","height":f"{SEAL}dp","opacity":0,"items":[
     {"type":"Frame","id":"sealFill","position":"absolute","width":f"{SEAL}dp","height":f"{SEAL}dp","borderRadius":f"{SEAL//2}dp","backgroundColor":BONE,"transform":[{"scale":0}]},
     {"type":"Frame","id":"sealEdge","position":"absolute","width":f"{SEAL}dp","height":f"{SEAL}dp","borderRadius":f"{SEAL//2}dp","borderWidth":"1.5dp","borderColor":"rgba(255,255,255,0.55)"},
     {"type":"Frame","id":"sealRing","position":"absolute","left":"21dp","top":"21dp","width":"225dp","height":"225dp","borderRadius":"112dp","borderWidth":"0.8dp","borderColor":"rgba(28,41,34,0.28)","opacity":0},
     {"type":"Container","id":"leafBox","position":"absolute","left":"90dp","top":"60dp","width":"87dp","height":"87dp","transform":[{"translateY":"15dp"},{"scale":1.72}],"items":[
        {"type":"AlexaVectorGraphic","id":"leafPine","position":"absolute","source":"leafPine","width":"87dp","height":"87dp","opacity":0},
        {"type":"AlexaVectorGraphic","id":"leafWhite","position":"absolute","source":"leafLight","width":"87dp","height":"87dp"}]},
     T("sealSE","SE",48,PINE_DEEP,font=SERIF,position="absolute",top="156dp",width=f"{SEAL}dp",textAlign="center",letterSpacing="9dp",opacity=0)]},
  {"type":"Container","id":"labelRow","position":"absolute","top":"560dp","width":"100vw","direction":"row","justifyContent":"center","alignItems":"center","opacity":0,"items":[
     {"type":"Frame","width":"90dp","height":"1dp","backgroundColor":"rgba(255,255,255,0.3)"},
     T("lab","LAPINHA DA SERRA · MG",19,"rgba(255,255,255,0.78)",letterSpacing="8dp",marginLeft="32dp",marginRight="32dp"),
     {"type":"Frame","width":"90dp","height":"1dp","backgroundColor":"rgba(255,255,255,0.3)"}]}
]}

# ── linha do tempo (ms) — mesma do efeito do site ──
SEAL_DY=-322; SEAL_S=0.262   # disco do topo (centro y=78dp) -> centro do selo (400dp), escala 70/267
START=11100                   # a foto escurece e o disco desce
LAND=START+1750
cmds=[
 fade("disc",80,1200,0,1),                                                        # fase 1: disco surge
 {"type":"Sequential","commands":[ANIM("title",300,1200,[{"property":"opacity","from":0,"to":1}],"ease"),
                                  SET("title",0,"opacity",1),
                                  ANIM("title",0,2500,[{"property":"opacity","from":1,"to":0}],"linear"),
                                  SET("title",0,"opacity",0)]},                    # nome aparece (0,3 s) e some devagar (1,5 s)
 {"type":"Sequential","commands":[{"type":"Idle","delay":4100},
                                  ANIM("phrase",0,2400,[{"property":"opacity","from":0,"to":1},{"property":"transform","from":[{"translateY":"16dp"}],"to":[{"translateY":0}]}],"ease-out"),
                                  SET("phrase",0,"opacity",1)]},                   # frase entra (4,1 s)
 {"type":"Sequential","commands":[{"type":"Idle","delay":4220},
                                  ANIM("disc",0,1000,[{"property":"transform","from":[{"translateX":f"{DISC_DX}dp"}],"to":[{"translateX":0}]}]),
                                  SET("disc",0,"transform",[{"translateX":0}])]},  # disco desliza para a esquerda
 {"type":"Sequential","commands":[{"type":"Idle","delay":4520},
                                  ANIM("expand",0,800,[{"property":"opacity","from":0,"to":1}],"ease"),
                                  SET("expand",0,"opacity",1)]},                   # wordmark aparece
 {"type":"Sequential","commands":[{"type":"Idle","delay":10000},                    # transição: wordmark recolhe, disco volta ao centro
                                  {"type":"Parallel","commands":[
                                    ANIM("expand",0,500,[{"property":"opacity","from":1,"to":0}],"ease"),
                                    ANIM("disc",150,900,[{"property":"transform","from":[{"translateX":0}],"to":[{"translateX":f"{DISC_DX}dp"}]}])]},
                                  SET("expand",0,"opacity",0),SET("disc",0,"transform",[{"translateX":f"{DISC_DX}dp"}])]},
 {"type":"Sequential","commands":[{"type":"Idle","delay":START},
                                  SET("disc",0,"opacity",0),                       # o selo assume o lugar do disco
                                  SET("seal",0,"opacity",1),
                                  {"type":"Parallel","commands":[
                                    ANIM("hero",0,2800,[{"property":"opacity","from":1,"to":0}]),
                                    ANIM("final",0,2200,[{"property":"opacity","from":0,"to":1}]),
                                    ANIM("seal",0,2000,[{"property":"transform","from":[{"translateY":f"{SEAL_DY}dp"},{"scale":SEAL_S}],"to":[{"translateY":0},{"scale":1}]}])]},
                                  SET("hero",0,"opacity",0),SET("final",0,"opacity",1),
                                  SET("seal",0,"transform",[{"translateY":0},{"scale":1}])]},
 {"type":"Sequential","commands":[{"type":"Idle","delay":LAND},                     # pouso: bone preenche, folha escurece, SE surge
                                  {"type":"Parallel","commands":[
                                    ANIM("sealFill",0,1200,[{"property":"transform","from":[{"scale":0}],"to":[{"scale":1}]}],"ease-out"),
                                    ANIM("sealEdge",0,700,[{"property":"opacity","from":1,"to":0}],"ease"),
                                    ANIM("sealRing",400,900,[{"property":"opacity","from":0,"to":1}],"ease"),
                                    ANIM("leafBox",0,1200,[{"property":"transform","from":[{"translateY":"15dp"},{"scale":1.72}],"to":[{"translateY":0},{"scale":1}]}]),
                                    ANIM("leafWhite",150,700,[{"property":"opacity","from":1,"to":0}],"ease"),
                                    ANIM("leafPine",150,700,[{"property":"opacity","from":0,"to":1}],"ease"),
                                    ANIM("sealSE",650,900,[{"property":"opacity","from":0,"to":1}],"ease-out"),
                                    ANIM("labelRow",1100,1800,[{"property":"opacity","from":0,"to":1}],"ease-out")]},
                                  SET("sealFill",0,"transform",[{"scale":1}]),SET("sealEdge",0,"opacity",0),SET("sealRing",0,"opacity",1),
                                  SET("leafBox",0,"transform",[{"translateY":0},{"scale":1}]),SET("leafWhite",0,"opacity",0),SET("leafPine",0,"opacity",1),
                                  SET("sealSE",0,"opacity",1),SET("labelRow",0,"opacity",1)]},
 {"type":"Sequential","commands":[ANIM("heroImg",0,14000,[{"property":"transform","from":[{"scale":1.06}],"to":[{"scale":1}]}],"ease-in-out")]},  # zoom lento da foto
]

doc={"type":"APL","version":"2023.3","theme":"dark","settings":{"idleTimeout":300000},
 "graphics":{"leafLight":avg("#FFFFFF",1.5),"leafPine":avg(PINE_DEEP,1.5)},
 "onMount":[{"type":"Parallel","commands":cmds}],
 "mainTemplate":{"parameters":["payload"],"items":[
   {"type":"Container","width":"100vw","height":"100vh","items":[
      {"type":"Frame","width":"100vw","height":"100vh","position":"absolute","backgroundColor":S900},
      hero, final,
      {"type":"TouchWrapper","position":"absolute","width":"100vw","height":"100vh","onPress":{"type":"SendEvent","arguments":["replay"]}}]}]}}

doc_js=json.dumps(doc,ensure_ascii=False,indent=1)

INDEX=r'''/* Solar do Espinhaço · skill para Echo Show (APL)
   Hospedagem: Alexa-hosted (Node.js). Cole este arquivo como lambda/index.js.
   A foto fica privada no bucket da skill (pasta Media). A skill assina um link temporário a cada abertura,
   então não é preciso copiar nenhuma URL. O arquivo precisa se chamar serra-hero.jpg e estar em Media/. */
const Alexa = require('ask-sdk-core');
const AWS = require('aws-sdk');

const IMAGE_KEY = 'Media/serra-hero.jpg';
const s3 = new AWS.S3({ signatureVersion: 'v4', region: process.env.S3_PERSISTENCE_REGION });
function imageUrl() {
  try {
    return s3.getSignedUrl('getObject', { Bucket: process.env.S3_PERSISTENCE_BUCKET, Key: IMAGE_KEY, Expires: 900 });
  } catch (e) {
    console.log('Falha ao assinar a foto:', e);
    return '';   // sem foto: o fundo fica escuro e o resto da animação segue
  }
}

const DOCUMENT = __DOC__;

const TOKEN = 'abertura';
const supportsAPL = (h) => {
  const i = Alexa.getSupportedInterfaces(h.requestEnvelope);
  return !!(i && i['Alexa.Presentation.APL']);
};
const render = (h) => h.responseBuilder.addDirective({
  type: 'Alexa.Presentation.APL.RenderDocument',
  token: TOKEN,
  document: DOCUMENT,
  datasources: { payload: { data: { image: imageUrl() } } },
});

/* A abertura é silenciosa: nenhuma fala, só a tela. O documento APL tem idleTimeout longo (5 min),
   então a tela continua no aparelho depois que a animação termina. */

const LaunchRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  handle(h) {
    if (!supportsAPL(h)) {
      return h.responseBuilder.speak('Solar do Espinhaço. Esta skill foi feita para a tela do Echo Show.').getResponse();
    }
    return render(h).withShouldEndSession(false).getResponse();
  },
};

/* toque na tela repete a abertura */
const ReplayHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'Alexa.Presentation.APL.UserEvent'
    && (h.requestEnvelope.request.arguments || [])[0] === 'replay',
  handle: (h) => render(h).withShouldEndSession(false).getResponse(),
};

const ReplayIntentHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
    && Alexa.getIntentName(h.requestEnvelope) === 'ReplayIntent',
  handle: (h) => render(h).withShouldEndSession(false).getResponse(),
};

const HelpHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
    && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent',
  handle: (h) => render(h).speak('Toque na tela para ver a abertura de novo, ou diga parar para sair.')
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
  handle: (h) => render(h).speak('Toque na tela para ver a abertura de novo.').reprompt('Toque na tela.').getResponse(),
};

const SessionEndedHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
  handle: (h) => h.responseBuilder.getResponse(),
};

const ErrorHandler = {
  canHandle: () => true,
  handle(h, error) {
    console.log('Erro:', error && error.stack ? error.stack : error);
    return h.responseBuilder.speak('Desculpe, algo deu errado.').getResponse();
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(LaunchRequestHandler, ReplayHandler, ReplayIntentHandler, HelpHandler, StopHandler, FallbackHandler, SessionEndedHandler)
  .addErrorHandlers(ErrorHandler)
  .lambda();
'''
open('lambda/index.js','w').write(INDEX.replace('__DOC__',doc_js))
open('lambda/package.json','w').write(json.dumps({"name":"solar-do-espinhaco-echo-show","version":"1.0.0","description":"Abertura Solar do Espinhaço para Echo Show","main":"index.js","dependencies":{"ask-sdk-core":"^2.14.0","ask-sdk-model":"^1.86.0","aws-sdk":"^2.1692.0"}},indent=2)+'\n')
open('skill-package/interactionModels/custom/pt-BR.json','w').write(json.dumps({"interactionModel":{"languageModel":{
  "invocationName":"solar marca",
  "intents":[{"name":"AMAZON.CancelIntent","samples":[]},{"name":"AMAZON.HelpIntent","samples":[]},
             {"name":"AMAZON.StopIntent","samples":[]},{"name":"AMAZON.NavigateHomeIntent","samples":[]},
             {"name":"AMAZON.FallbackIntent","samples":[]},
             {"name":"ReplayIntent","slots":[],"samples":["de novo","repetir","repita","mostrar de novo","mostre de novo","começar de novo","ver de novo","passar de novo"]}],"types":[]}}},ensure_ascii=False,indent=2)+'\n')
print('ok',len(doc_js))
