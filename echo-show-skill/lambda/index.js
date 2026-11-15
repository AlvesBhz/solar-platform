/* Solar do Espinhaço · skill para Echo Show (APL)
   Hospedagem: Alexa-hosted (Node.js). Cole este arquivo como lambda/index.js.
   ⚠ Antes de publicar, preencha IMAGE_URL com o endereço da foto no "Media storage" da aba Code. */
const Alexa = require('ask-sdk-core');

const IMAGE_URL = 'COLE_AQUI_O_ENDERECO_DA_FOTO';   // ex.: https://<bucket>.s3.amazonaws.com/Media/serra-hero.jpg

const DOCUMENT = {
 "type": "APL",
 "version": "2023.3",
 "theme": "dark",
 "graphics": {
  "leafLight": {
   "type": "AVG",
   "version": "1.2",
   "width": 24,
   "height": 24,
   "viewportWidth": 24,
   "viewportHeight": 24,
   "items": [
    {
     "type": "path",
     "pathData": "m12 9l4.5-4.5m-4.5 10L18.5 8M12 19.5l7.5-7.5M12 22c4.418 0 8-3.646 8-8.143c0-4.462-2.553-9.67-6.537-11.531A3.45 3.45 0 0 0 12 2m0 20c-4.418 0-8-3.646-8-8.143c0-4.462 2.553-9.67 6.537-11.531A3.45 3.45 0 0 1 12 2m0 20V2",
     "stroke": "#FFFFFF",
     "strokeWidth": 1.5,
     "strokeLineCap": "round",
     "strokeLineJoin": "round"
    }
   ]
  },
  "leafPine": {
   "type": "AVG",
   "version": "1.2",
   "width": 24,
   "height": 24,
   "viewportWidth": 24,
   "viewportHeight": 24,
   "items": [
    {
     "type": "path",
     "pathData": "m12 9l4.5-4.5m-4.5 10L18.5 8M12 19.5l7.5-7.5M12 22c4.418 0 8-3.646 8-8.143c0-4.462-2.553-9.67-6.537-11.531A3.45 3.45 0 0 0 12 2m0 20c-4.418 0-8-3.646-8-8.143c0-4.462 2.553-9.67 6.537-11.531A3.45 3.45 0 0 1 12 2m0 20V2",
     "stroke": "#1C2922",
     "strokeWidth": 1.5,
     "strokeLineCap": "round",
     "strokeLineJoin": "round"
    }
   ]
  }
 },
 "onMount": [
  {
   "type": "Parallel",
   "commands": [
    {
     "type": "Sequential",
     "commands": [
      {
       "type": "AnimateItem",
       "componentId": "disc",
       "delay": 80,
       "duration": 1200,
       "easing": "ease-in-out",
       "value": [
        {
         "property": "opacity",
         "from": 0,
         "to": 1
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "disc",
       "delay": 0,
       "property": "opacity",
       "value": 1
      }
     ]
    },
    {
     "type": "Sequential",
     "commands": [
      {
       "type": "AnimateItem",
       "componentId": "title",
       "delay": 300,
       "duration": 1200,
       "easing": "ease",
       "value": [
        {
         "property": "opacity",
         "from": 0,
         "to": 1
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "title",
       "delay": 0,
       "property": "opacity",
       "value": 1
      },
      {
       "type": "AnimateItem",
       "componentId": "title",
       "delay": 0,
       "duration": 2500,
       "easing": "linear",
       "value": [
        {
         "property": "opacity",
         "from": 1,
         "to": 0
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "title",
       "delay": 0,
       "property": "opacity",
       "value": 0
      }
     ]
    },
    {
     "type": "Sequential",
     "commands": [
      {
       "type": "Idle",
       "delay": 4100
      },
      {
       "type": "AnimateItem",
       "componentId": "phrase",
       "delay": 0,
       "duration": 2400,
       "easing": "ease-out",
       "value": [
        {
         "property": "opacity",
         "from": 0,
         "to": 1
        },
        {
         "property": "transform",
         "from": [
          {
           "translateY": "16dp"
          }
         ],
         "to": [
          {
           "translateY": 0
          }
         ]
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "phrase",
       "delay": 0,
       "property": "opacity",
       "value": 1
      }
     ]
    },
    {
     "type": "Sequential",
     "commands": [
      {
       "type": "Idle",
       "delay": 4220
      },
      {
       "type": "AnimateItem",
       "componentId": "disc",
       "delay": 0,
       "duration": 1000,
       "easing": "ease-in-out",
       "value": [
        {
         "property": "transform",
         "from": [
          {
           "translateX": "155dp"
          }
         ],
         "to": [
          {
           "translateX": 0
          }
         ]
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "disc",
       "delay": 0,
       "property": "transform",
       "value": [
        {
         "translateX": 0
        }
       ]
      }
     ]
    },
    {
     "type": "Sequential",
     "commands": [
      {
       "type": "Idle",
       "delay": 4520
      },
      {
       "type": "AnimateItem",
       "componentId": "expand",
       "delay": 0,
       "duration": 800,
       "easing": "ease",
       "value": [
        {
         "property": "opacity",
         "from": 0,
         "to": 1
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "expand",
       "delay": 0,
       "property": "opacity",
       "value": 1
      }
     ]
    },
    {
     "type": "Sequential",
     "commands": [
      {
       "type": "Idle",
       "delay": 10000
      },
      {
       "type": "Parallel",
       "commands": [
        {
         "type": "AnimateItem",
         "componentId": "expand",
         "delay": 0,
         "duration": 500,
         "easing": "ease",
         "value": [
          {
           "property": "opacity",
           "from": 1,
           "to": 0
          }
         ]
        },
        {
         "type": "AnimateItem",
         "componentId": "disc",
         "delay": 150,
         "duration": 900,
         "easing": "ease-in-out",
         "value": [
          {
           "property": "transform",
           "from": [
            {
             "translateX": 0
            }
           ],
           "to": [
            {
             "translateX": "155dp"
            }
           ]
          }
         ]
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "expand",
       "delay": 0,
       "property": "opacity",
       "value": 0
      },
      {
       "type": "SetValue",
       "componentId": "disc",
       "delay": 0,
       "property": "transform",
       "value": [
        {
         "translateX": "155dp"
        }
       ]
      }
     ]
    },
    {
     "type": "Sequential",
     "commands": [
      {
       "type": "Idle",
       "delay": 11100
      },
      {
       "type": "SetValue",
       "componentId": "disc",
       "delay": 0,
       "property": "opacity",
       "value": 0
      },
      {
       "type": "SetValue",
       "componentId": "seal",
       "delay": 0,
       "property": "opacity",
       "value": 1
      },
      {
       "type": "Parallel",
       "commands": [
        {
         "type": "AnimateItem",
         "componentId": "hero",
         "delay": 0,
         "duration": 2800,
         "easing": "ease-in-out",
         "value": [
          {
           "property": "opacity",
           "from": 1,
           "to": 0
          }
         ]
        },
        {
         "type": "AnimateItem",
         "componentId": "final",
         "delay": 0,
         "duration": 2200,
         "easing": "ease-in-out",
         "value": [
          {
           "property": "opacity",
           "from": 0,
           "to": 1
          }
         ]
        },
        {
         "type": "AnimateItem",
         "componentId": "seal",
         "delay": 0,
         "duration": 2000,
         "easing": "ease-in-out",
         "value": [
          {
           "property": "transform",
           "from": [
            {
             "translateY": "-322dp"
            },
            {
             "scale": 0.262
            }
           ],
           "to": [
            {
             "translateY": 0
            },
            {
             "scale": 1
            }
           ]
          }
         ]
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "hero",
       "delay": 0,
       "property": "opacity",
       "value": 0
      },
      {
       "type": "SetValue",
       "componentId": "final",
       "delay": 0,
       "property": "opacity",
       "value": 1
      },
      {
       "type": "SetValue",
       "componentId": "seal",
       "delay": 0,
       "property": "transform",
       "value": [
        {
         "translateY": 0
        },
        {
         "scale": 1
        }
       ]
      }
     ]
    },
    {
     "type": "Sequential",
     "commands": [
      {
       "type": "Idle",
       "delay": 12850
      },
      {
       "type": "Parallel",
       "commands": [
        {
         "type": "AnimateItem",
         "componentId": "sealFill",
         "delay": 0,
         "duration": 1200,
         "easing": "ease-out",
         "value": [
          {
           "property": "transform",
           "from": [
            {
             "scale": 0
            }
           ],
           "to": [
            {
             "scale": 1
            }
           ]
          }
         ]
        },
        {
         "type": "AnimateItem",
         "componentId": "sealEdge",
         "delay": 0,
         "duration": 700,
         "easing": "ease",
         "value": [
          {
           "property": "opacity",
           "from": 1,
           "to": 0
          }
         ]
        },
        {
         "type": "AnimateItem",
         "componentId": "sealRing",
         "delay": 400,
         "duration": 900,
         "easing": "ease",
         "value": [
          {
           "property": "opacity",
           "from": 0,
           "to": 1
          }
         ]
        },
        {
         "type": "AnimateItem",
         "componentId": "leafBox",
         "delay": 0,
         "duration": 1200,
         "easing": "ease-in-out",
         "value": [
          {
           "property": "transform",
           "from": [
            {
             "translateY": "15dp"
            },
            {
             "scale": 1.72
            }
           ],
           "to": [
            {
             "translateY": 0
            },
            {
             "scale": 1
            }
           ]
          }
         ]
        },
        {
         "type": "AnimateItem",
         "componentId": "leafWhite",
         "delay": 150,
         "duration": 700,
         "easing": "ease",
         "value": [
          {
           "property": "opacity",
           "from": 1,
           "to": 0
          }
         ]
        },
        {
         "type": "AnimateItem",
         "componentId": "leafPine",
         "delay": 150,
         "duration": 700,
         "easing": "ease",
         "value": [
          {
           "property": "opacity",
           "from": 0,
           "to": 1
          }
         ]
        },
        {
         "type": "AnimateItem",
         "componentId": "sealSE",
         "delay": 650,
         "duration": 900,
         "easing": "ease-out",
         "value": [
          {
           "property": "opacity",
           "from": 0,
           "to": 1
          }
         ]
        },
        {
         "type": "AnimateItem",
         "componentId": "labelRow",
         "delay": 1100,
         "duration": 1800,
         "easing": "ease-out",
         "value": [
          {
           "property": "opacity",
           "from": 0,
           "to": 1
          }
         ]
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "sealFill",
       "delay": 0,
       "property": "transform",
       "value": [
        {
         "scale": 1
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "sealEdge",
       "delay": 0,
       "property": "opacity",
       "value": 0
      },
      {
       "type": "SetValue",
       "componentId": "sealRing",
       "delay": 0,
       "property": "opacity",
       "value": 1
      },
      {
       "type": "SetValue",
       "componentId": "leafBox",
       "delay": 0,
       "property": "transform",
       "value": [
        {
         "translateY": 0
        },
        {
         "scale": 1
        }
       ]
      },
      {
       "type": "SetValue",
       "componentId": "leafWhite",
       "delay": 0,
       "property": "opacity",
       "value": 0
      },
      {
       "type": "SetValue",
       "componentId": "leafPine",
       "delay": 0,
       "property": "opacity",
       "value": 1
      },
      {
       "type": "SetValue",
       "componentId": "sealSE",
       "delay": 0,
       "property": "opacity",
       "value": 1
      },
      {
       "type": "SetValue",
       "componentId": "labelRow",
       "delay": 0,
       "property": "opacity",
       "value": 1
      }
     ]
    },
    {
     "type": "Sequential",
     "commands": [
      {
       "type": "AnimateItem",
       "componentId": "heroImg",
       "delay": 0,
       "duration": 14000,
       "easing": "ease-in-out",
       "value": [
        {
         "property": "transform",
         "from": [
          {
           "scale": 1.06
          }
         ],
         "to": [
          {
           "scale": 1
          }
         ]
        }
       ]
      }
     ]
    }
   ]
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
      "width": "100vw",
      "height": "100vh",
      "position": "absolute",
      "backgroundColor": "#1C1917"
     },
     {
      "type": "Container",
      "id": "hero",
      "position": "absolute",
      "width": "100vw",
      "height": "100vh",
      "items": [
       {
        "type": "Image",
        "id": "heroImg",
        "source": "${payload.data.image}",
        "scale": "best-fill",
        "width": "100vw",
        "height": "100vh",
        "opacity": 0.55,
        "position": "absolute"
       },
       {
        "type": "Frame",
        "width": "100vw",
        "height": "100vh",
        "position": "absolute",
        "backgroundColor": {
         "type": "linear",
         "angle": 0,
         "colorRange": [
          "rgba(0,0,0,0.5)",
          "rgba(0,0,0,0)",
          "rgba(0,0,0,0.8)"
         ],
         "inputRange": [
          0,
          0.5,
          1
         ]
        }
       },
       {
        "type": "Container",
        "id": "logo",
        "position": "absolute",
        "top": "43dp",
        "left": "450dp",
        "width": "380dp",
        "direction": "row",
        "alignItems": "center",
        "items": [
         {
          "type": "Container",
          "id": "disc",
          "width": "70dp",
          "height": "70dp",
          "opacity": 0,
          "alignItems": "center",
          "justifyContent": "center",
          "transform": [
           {
            "translateX": "155dp"
           }
          ],
          "items": [
           {
            "type": "Frame",
            "position": "absolute",
            "width": "70dp",
            "height": "70dp",
            "borderRadius": "35dp",
            "borderWidth": "1dp",
            "borderColor": "rgba(255,255,255,0.55)"
           },
           {
            "type": "AlexaVectorGraphic",
            "source": "leafLight",
            "width": "39dp",
            "height": "39dp"
           }
          ]
         },
         {
          "type": "Container",
          "id": "expand",
          "direction": "row",
          "alignItems": "center",
          "opacity": 0,
          "items": [
           {
            "type": "Frame",
            "width": "1dp",
            "height": "70dp",
            "marginLeft": "24dp",
            "backgroundColor": "rgba(255,255,255,0.22)"
           },
           {
            "type": "Container",
            "marginLeft": "24dp",
            "items": [
             {
              "type": "Text",
              "id": "wm1",
              "text": "SOLAR DO",
              "fontSize": "11dp",
              "color": "rgba(255,255,255,0.6)",
              "fontFamily": "amazon-ember, sans-serif",
              "letterSpacing": "4dp"
             },
             {
              "type": "Text",
              "id": "wm2",
              "text": "ESPINHAÇO",
              "fontSize": "31dp",
              "color": "rgba(255,255,255,0.93)",
              "fontFamily": "noto-serif, bookerly, serif",
              "letterSpacing": "2dp",
              "fontWeight": "500",
              "spacing": "4dp"
             },
             {
              "type": "Text",
              "id": "wm3",
              "text": "LAPINHA · MINAS GERAIS",
              "fontSize": "10dp",
              "color": "rgba(255,255,255,0.55)",
              "fontFamily": "amazon-ember, sans-serif",
              "letterSpacing": "3dp",
              "spacing": "8dp"
             }
            ]
           }
          ]
         }
        ]
       },
       {
        "type": "Container",
        "id": "title",
        "position": "absolute",
        "left": "110dp",
        "top": "230dp",
        "opacity": 0,
        "items": [
         {
          "type": "Text",
          "id": "t0",
          "text": "CHALÉ BOUTIQUE · LAPINHA DA SERRA · MINAS GERAIS",
          "fontSize": "13dp",
          "color": "rgba(255,255,255,0.55)",
          "fontFamily": "amazon-ember, sans-serif",
          "letterSpacing": "4dp"
         },
         {
          "type": "Text",
          "id": "t1",
          "text": "SOLAR DO",
          "fontSize": "170dp",
          "color": "rgba(255,255,255,0.80)",
          "fontFamily": "noto-serif, bookerly, serif",
          "fontWeight": "500",
          "lineHeight": 0.9,
          "spacing": "22dp"
         },
         {
          "type": "Text",
          "id": "t2",
          "text": "ESPINHAÇO",
          "fontSize": "90dp",
          "color": "rgba(245,245,244,0.72)",
          "fontFamily": "noto-serif, bookerly, serif",
          "fontWeight": "300",
          "lineHeight": 0.9,
          "spacing": "6dp",
          "paddingLeft": "100dp"
         }
        ]
       },
       {
        "type": "Container",
        "id": "phrase",
        "position": "absolute",
        "width": "100vw",
        "height": "100vh",
        "justifyContent": "center",
        "alignItems": "center",
        "opacity": 0,
        "items": [
         {
          "type": "Text",
          "id": "ph",
          "text": "O espinhaço te conecta com a natureza.",
          "fontSize": "48dp",
          "color": "rgba(255,255,255,0.93)",
          "fontFamily": "noto-serif, bookerly, serif",
          "fontStyle": "italic"
         }
        ]
       }
      ]
     },
     {
      "type": "Container",
      "id": "final",
      "position": "absolute",
      "width": "100vw",
      "height": "100vh",
      "opacity": 0,
      "items": [
       {
        "type": "Frame",
        "width": "100vw",
        "height": "100vh",
        "position": "absolute",
        "backgroundColor": "#1C1917"
       },
       {
        "type": "Frame",
        "position": "absolute",
        "left": "240dp",
        "top": "-40dp",
        "width": "800dp",
        "height": "800dp",
        "borderRadius": "400dp",
        "backgroundColor": {
         "type": "radial",
         "colorRange": [
          "rgba(44,62,53,0.62)",
          "rgba(44,62,53,0)"
         ],
         "inputRange": [
          0,
          0.7
         ]
        }
       },
       {
        "type": "Container",
        "id": "seal",
        "position": "absolute",
        "left": "506dp",
        "top": "250dp",
        "width": "267dp",
        "height": "267dp",
        "opacity": 0,
        "items": [
         {
          "type": "Frame",
          "id": "sealFill",
          "position": "absolute",
          "width": "267dp",
          "height": "267dp",
          "borderRadius": "133dp",
          "backgroundColor": "#EAE5D9",
          "transform": [
           {
            "scale": 0
           }
          ]
         },
         {
          "type": "Frame",
          "id": "sealEdge",
          "position": "absolute",
          "width": "267dp",
          "height": "267dp",
          "borderRadius": "133dp",
          "borderWidth": "1.5dp",
          "borderColor": "rgba(255,255,255,0.55)"
         },
         {
          "type": "Frame",
          "id": "sealRing",
          "position": "absolute",
          "left": "21dp",
          "top": "21dp",
          "width": "225dp",
          "height": "225dp",
          "borderRadius": "112dp",
          "borderWidth": "0.8dp",
          "borderColor": "rgba(28,41,34,0.28)",
          "opacity": 0
         },
         {
          "type": "Container",
          "id": "leafBox",
          "position": "absolute",
          "left": "90dp",
          "top": "60dp",
          "width": "87dp",
          "height": "87dp",
          "transform": [
           {
            "translateY": "15dp"
           },
           {
            "scale": 1.72
           }
          ],
          "items": [
           {
            "type": "AlexaVectorGraphic",
            "id": "leafPine",
            "position": "absolute",
            "source": "leafPine",
            "width": "87dp",
            "height": "87dp",
            "opacity": 0
           },
           {
            "type": "AlexaVectorGraphic",
            "id": "leafWhite",
            "position": "absolute",
            "source": "leafLight",
            "width": "87dp",
            "height": "87dp"
           }
          ]
         },
         {
          "type": "Text",
          "id": "sealSE",
          "text": "SE",
          "fontSize": "48dp",
          "color": "#1C2922",
          "fontFamily": "noto-serif, bookerly, serif",
          "position": "absolute",
          "top": "156dp",
          "width": "267dp",
          "textAlign": "center",
          "letterSpacing": "9dp",
          "opacity": 0
         }
        ]
       },
       {
        "type": "Container",
        "id": "labelRow",
        "position": "absolute",
        "top": "560dp",
        "width": "100vw",
        "direction": "row",
        "justifyContent": "center",
        "alignItems": "center",
        "opacity": 0,
        "items": [
         {
          "type": "Frame",
          "width": "90dp",
          "height": "1dp",
          "backgroundColor": "rgba(255,255,255,0.3)"
         },
         {
          "type": "Text",
          "id": "lab",
          "text": "LAPINHA DA SERRA · MG",
          "fontSize": "19dp",
          "color": "rgba(255,255,255,0.78)",
          "fontFamily": "amazon-ember, sans-serif",
          "letterSpacing": "8dp",
          "marginLeft": "32dp",
          "marginRight": "32dp"
         },
         {
          "type": "Frame",
          "width": "90dp",
          "height": "1dp",
          "backgroundColor": "rgba(255,255,255,0.3)"
         }
        ]
       }
      ]
     },
     {
      "type": "TouchWrapper",
      "position": "absolute",
      "width": "100vw",
      "height": "100vh",
      "onPress": {
       "type": "SendEvent",
       "arguments": [
        "replay"
       ]
      }
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
const render = (h) => h.responseBuilder.addDirective({
  type: 'Alexa.Presentation.APL.RenderDocument',
  token: TOKEN,
  document: DOCUMENT,
  datasources: { payload: { data: { image: IMAGE_URL } } },
});

/* A animação dura ~17 s. Pausas de até 10 s por tag mantêm a sessão aberta enquanto a tela roda. */
const HOLD = '<speak><break time="9s"/><break time="9s"/></speak>';

const LaunchRequestHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
  handle(h) {
    if (!supportsAPL(h)) {
      return h.responseBuilder.speak('Solar do Espinhaço. Esta skill foi feita para a tela do Echo Show.').getResponse();
    }
    return render(h).speak(HOLD).withShouldEndSession(false).getResponse();
  },
};

/* toque na tela repete a abertura */
const ReplayHandler = {
  canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'Alexa.Presentation.APL.UserEvent'
    && (h.requestEnvelope.request.arguments || [])[0] === 'replay',
  handle: (h) => render(h).speak(HOLD).withShouldEndSession(false).getResponse(),
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
  .addRequestHandlers(LaunchRequestHandler, ReplayHandler, HelpHandler, StopHandler, FallbackHandler, SessionEndedHandler)
  .addErrorHandlers(ErrorHandler)
  .lambda();
