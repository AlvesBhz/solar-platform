/* Solar do Espinhaço · skill para Echo Show (APL)
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

const DOCUMENT = {
 "type": "APL",
 "version": "2023.3",
 "theme": "dark",
 "settings": {
  "idleTimeout": 300000
 },
 "graphics": {
  "leafLight": {
   "type": "AVG",
   "version": "1.0",
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
   "version": "1.0",
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
           "translateY": "${Math.min(viewport.width/1280,viewport.height/800)*16}dp"
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
           "translateX": "${Math.min(viewport.width/1280,viewport.height/800)*190}dp"
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
             "translateX": "${Math.min(viewport.width/1280,viewport.height/800)*190}dp"
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
         "translateX": "${Math.min(viewport.width/1280,viewport.height/800)*190}dp"
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
             "translateY": "${Math.min(viewport.width/1280,viewport.height/800)*-246.5}dp"
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
             "translateY": "${Math.min(viewport.width/1280,viewport.height/800)*15}dp"
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
        "type": "Frame",
        "width": "100vw",
        "height": "100vh",
        "position": "absolute",
        "backgroundColor": {
         "type": "linear",
         "angle": 90,
         "colorRange": [
          "rgba(0,0,0,0.35)",
          "rgba(0,0,0,0)"
         ],
         "inputRange": [
          0,
          0.6
         ]
        }
       },
       {
        "type": "Frame",
        "position": "absolute",
        "left": "${Math.min(viewport.width/1280,viewport.height/800)*706}dp",
        "top": "${Math.min(viewport.width/1280,viewport.height/800)*-147}dp",
        "width": "${Math.min(viewport.width/1280,viewport.height/800)*667}dp",
        "height": "${Math.min(viewport.width/1280,viewport.height/800)*667}dp",
        "borderRadius": "${Math.min(viewport.width/1280,viewport.height/800)*334}dp",
        "backgroundColor": {
         "type": "radial",
         "colorRange": [
          "rgba(44,62,53,0.4)",
          "rgba(44,62,53,0)"
         ],
         "inputRange": [
          0,
          0.7
         ]
        }
       },
       {
        "type": "Frame",
        "position": "absolute",
        "left": "${Math.min(viewport.width/1280,viewport.height/800)*-107}dp",
        "top": "${Math.min(viewport.width/1280,viewport.height/800)*253}dp",
        "width": "${Math.min(viewport.width/1280,viewport.height/800)*507}dp",
        "height": "${Math.min(viewport.width/1280,viewport.height/800)*507}dp",
        "borderRadius": "${Math.min(viewport.width/1280,viewport.height/800)*254}dp",
        "backgroundColor": {
         "type": "radial",
         "colorRange": [
          "rgba(44,62,53,0.28)",
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
        "width": "${Math.min(viewport.width/1280,viewport.height/800)*1280}dp",
        "height": "${Math.min(viewport.width/1280,viewport.height/800)*800}dp",
        "items": [
         {
          "type": "Container",
          "position": "absolute",
          "top": "${Math.min(viewport.width/1280,viewport.height/800)*43}dp",
          "width": "100%",
          "alignItems": "center",
          "items": [
           {
            "type": "Container",
            "id": "logo",
            "width": "${Math.min(viewport.width/1280,viewport.height/800)*450}dp",
            "direction": "row",
            "alignItems": "center",
            "items": [
             {
              "type": "Container",
              "id": "disc",
              "width": "${Math.min(viewport.width/1280,viewport.height/800)*70}dp",
              "height": "${Math.min(viewport.width/1280,viewport.height/800)*70}dp",
              "opacity": 0,
              "alignItems": "center",
              "justifyContent": "center",
              "transform": [
               {
                "translateX": "${Math.min(viewport.width/1280,viewport.height/800)*190}dp"
               }
              ],
              "items": [
               {
                "type": "Frame",
                "position": "absolute",
                "width": "${Math.min(viewport.width/1280,viewport.height/800)*70}dp",
                "height": "${Math.min(viewport.width/1280,viewport.height/800)*70}dp",
                "borderRadius": "${Math.min(viewport.width/1280,viewport.height/800)*35}dp",
                "borderWidth": "${Math.min(viewport.width/1280,viewport.height/800)*1}dp",
                "borderColor": "rgba(255,255,255,0.55)"
               },
               {
                "type": "AlexaVectorGraphic",
                "source": "leafLight",
                "width": "${Math.min(viewport.width/1280,viewport.height/800)*39}dp",
                "height": "${Math.min(viewport.width/1280,viewport.height/800)*39}dp",
                "scale": "best-fit"
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
                "width": "${Math.min(viewport.width/1280,viewport.height/800)*1}dp",
                "height": "${Math.min(viewport.width/1280,viewport.height/800)*70}dp",
                "spacing": "${Math.min(viewport.width/1280,viewport.height/800)*24}dp",
                "backgroundColor": "rgba(255,255,255,0.22)"
               },
               {
                "type": "Container",
                "spacing": "${Math.min(viewport.width/1280,viewport.height/800)*24}dp",
                "items": [
                 {
                  "type": "Text",
                  "id": "wm1",
                  "text": "SOLAR DO",
                  "fontSize": "${Math.min(viewport.width/1280,viewport.height/800)*13}dp",
                  "color": "rgba(255,255,255,0.6)",
                  "fontFamily": "amazon-ember, sans-serif",
                  "letterSpacing": "${Math.min(viewport.width/1280,viewport.height/800)*5}dp"
                 },
                 {
                  "type": "Text",
                  "id": "wm2",
                  "text": "ESPINHAÇO",
                  "fontSize": "${Math.min(viewport.width/1280,viewport.height/800)*45}dp",
                  "color": "rgba(255,255,255,0.93)",
                  "fontFamily": "noto-serif, bookerly, serif",
                  "letterSpacing": "${Math.min(viewport.width/1280,viewport.height/800)*3.6}dp",
                  "fontWeight": "500",
                  "spacing": "${Math.min(viewport.width/1280,viewport.height/800)*7}dp"
                 },
                 {
                  "type": "Text",
                  "id": "wm3",
                  "text": "LAPINHA · MINAS GERAIS",
                  "fontSize": "${Math.min(viewport.width/1280,viewport.height/800)*10}dp",
                  "color": "rgba(255,255,255,0.55)",
                  "fontFamily": "amazon-ember, sans-serif",
                  "letterSpacing": "${Math.min(viewport.width/1280,viewport.height/800)*3.4}dp",
                  "spacing": "${Math.min(viewport.width/1280,viewport.height/800)*9}dp"
                 }
                ]
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
          "left": "${Math.min(viewport.width/1280,viewport.height/800)*120}dp",
          "top": "${Math.min(viewport.width/1280,viewport.height/800)*248}dp",
          "opacity": 0,
          "items": [
           {
            "type": "Text",
            "id": "t0",
            "text": "CHALÉ BOUTIQUE · LAPINHA DA SERRA · MINAS GERAIS",
            "fontSize": "${Math.min(viewport.width/1280,viewport.height/800)*13}dp",
            "color": "rgba(255,255,255,0.55)",
            "fontFamily": "amazon-ember, sans-serif",
            "letterSpacing": "${Math.min(viewport.width/1280,viewport.height/800)*4}dp"
           },
           {
            "type": "Text",
            "id": "t1",
            "text": "SOLAR DO",
            "fontSize": "${Math.min(viewport.width/1280,viewport.height/800)*180}dp",
            "color": "rgba(255,255,255,0.80)",
            "fontFamily": "noto-serif, bookerly, serif",
            "fontWeight": "500",
            "lineHeight": 1.0,
            "spacing": "${Math.min(viewport.width/1280,viewport.height/800)*24}dp"
           },
           {
            "type": "Text",
            "id": "t2",
            "text": "ESPINHAÇO",
            "fontSize": "${Math.min(viewport.width/1280,viewport.height/800)*92}dp",
            "color": "rgba(245,245,244,0.72)",
            "fontFamily": "noto-serif, bookerly, serif",
            "fontWeight": "300",
            "lineHeight": 1.1,
            "spacing": "${Math.min(viewport.width/1280,viewport.height/800)*8}dp",
            "paddingLeft": "${Math.min(viewport.width/1280,viewport.height/800)*100}dp"
           }
          ]
         },
         {
          "type": "Container",
          "id": "phrase",
          "position": "absolute",
          "width": "100%",
          "height": "100%",
          "justifyContent": "center",
          "alignItems": "center",
          "opacity": 0,
          "items": [
           {
            "type": "Text",
            "id": "ph",
            "text": "O espinhaço te conecta com a natureza.",
            "fontSize": "${Math.min(viewport.width/1280,viewport.height/800)*48}dp",
            "color": "rgba(255,255,255,0.93)",
            "fontFamily": "noto-serif, bookerly, serif",
            "fontStyle": "italic"
           }
          ]
         }
        ]
       }
      ],
      "alignItems": "center",
      "justifyContent": "center"
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
        "type": "Container",
        "width": "${Math.min(viewport.width/1280,viewport.height/800)*1280}dp",
        "height": "${Math.min(viewport.width/1280,viewport.height/800)*800}dp",
        "items": [
         {
          "type": "Container",
          "position": "absolute",
          "top": "${Math.min(viewport.width/1280,viewport.height/800)*-40}dp",
          "width": "100%",
          "alignItems": "center",
          "items": [
           {
            "type": "Frame",
            "width": "${Math.min(viewport.width/1280,viewport.height/800)*800}dp",
            "height": "${Math.min(viewport.width/1280,viewport.height/800)*800}dp",
            "borderRadius": "${Math.min(viewport.width/1280,viewport.height/800)*400}dp",
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
           }
          ]
         },
         {
          "type": "Container",
          "position": "absolute",
          "top": "${Math.min(viewport.width/1280,viewport.height/800)*191}dp",
          "width": "100%",
          "alignItems": "center",
          "items": [
           {
            "type": "Container",
            "id": "seal",
            "width": "${Math.min(viewport.width/1280,viewport.height/800)*267}dp",
            "height": "${Math.min(viewport.width/1280,viewport.height/800)*267}dp",
            "opacity": 0,
            "items": [
             {
              "type": "Frame",
              "id": "sealFill",
              "position": "absolute",
              "width": "${Math.min(viewport.width/1280,viewport.height/800)*267}dp",
              "height": "${Math.min(viewport.width/1280,viewport.height/800)*267}dp",
              "borderRadius": "${Math.min(viewport.width/1280,viewport.height/800)*133}dp",
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
              "width": "${Math.min(viewport.width/1280,viewport.height/800)*267}dp",
              "height": "${Math.min(viewport.width/1280,viewport.height/800)*267}dp",
              "borderRadius": "${Math.min(viewport.width/1280,viewport.height/800)*133}dp",
              "borderWidth": "${Math.min(viewport.width/1280,viewport.height/800)*1.5}dp",
              "borderColor": "rgba(255,255,255,0.55)"
             },
             {
              "type": "Frame",
              "id": "sealRing",
              "position": "absolute",
              "left": "${Math.min(viewport.width/1280,viewport.height/800)*21}dp",
              "top": "${Math.min(viewport.width/1280,viewport.height/800)*21}dp",
              "width": "${Math.min(viewport.width/1280,viewport.height/800)*225}dp",
              "height": "${Math.min(viewport.width/1280,viewport.height/800)*225}dp",
              "borderRadius": "${Math.min(viewport.width/1280,viewport.height/800)*112}dp",
              "borderWidth": "${Math.min(viewport.width/1280,viewport.height/800)*0.8}dp",
              "borderColor": "rgba(28,41,34,0.28)",
              "opacity": 0
             },
             {
              "type": "Container",
              "id": "leafBox",
              "position": "absolute",
              "left": "${Math.min(viewport.width/1280,viewport.height/800)*90}dp",
              "top": "${Math.min(viewport.width/1280,viewport.height/800)*60}dp",
              "width": "${Math.min(viewport.width/1280,viewport.height/800)*87}dp",
              "height": "${Math.min(viewport.width/1280,viewport.height/800)*87}dp",
              "transform": [
               {
                "translateY": "${Math.min(viewport.width/1280,viewport.height/800)*15}dp"
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
                "width": "${Math.min(viewport.width/1280,viewport.height/800)*87}dp",
                "height": "${Math.min(viewport.width/1280,viewport.height/800)*87}dp",
                "scale": "best-fit",
                "opacity": 0
               },
               {
                "type": "AlexaVectorGraphic",
                "id": "leafWhite",
                "position": "absolute",
                "source": "leafLight",
                "width": "${Math.min(viewport.width/1280,viewport.height/800)*87}dp",
                "height": "${Math.min(viewport.width/1280,viewport.height/800)*87}dp",
                "scale": "best-fit"
               }
              ]
             },
             {
              "type": "Text",
              "id": "sealSE",
              "text": "SE",
              "fontSize": "${Math.min(viewport.width/1280,viewport.height/800)*48}dp",
              "color": "#1C2922",
              "fontFamily": "noto-serif, bookerly, serif",
              "position": "absolute",
              "top": "${Math.min(viewport.width/1280,viewport.height/800)*156}dp",
              "width": "${Math.min(viewport.width/1280,viewport.height/800)*267}dp",
              "textAlign": "center",
              "letterSpacing": "${Math.min(viewport.width/1280,viewport.height/800)*9}dp",
              "opacity": 0
             }
            ]
           }
          ]
         },
         {
          "type": "Container",
          "id": "labelRow",
          "position": "absolute",
          "top": "${Math.min(viewport.width/1280,viewport.height/800)*506}dp",
          "width": "100%",
          "direction": "row",
          "justifyContent": "center",
          "alignItems": "center",
          "opacity": 0,
          "items": [
           {
            "type": "Frame",
            "width": "${Math.min(viewport.width/1280,viewport.height/800)*93}dp",
            "height": "${Math.min(viewport.width/1280,viewport.height/800)*1}dp",
            "backgroundColor": "rgba(255,255,255,0.3)"
           },
           {
            "type": "Text",
            "id": "lab",
            "text": "LAPINHA DA SERRA · MG",
            "fontSize": "${Math.min(viewport.width/1280,viewport.height/800)*19}dp",
            "color": "rgba(255,255,255,0.78)",
            "fontFamily": "amazon-ember, sans-serif",
            "letterSpacing": "${Math.min(viewport.width/1280,viewport.height/800)*8}dp",
            "spacing": "${Math.min(viewport.width/1280,viewport.height/800)*32}dp"
           },
           {
            "type": "Frame",
            "width": "${Math.min(viewport.width/1280,viewport.height/800)*93}dp",
            "height": "${Math.min(viewport.width/1280,viewport.height/800)*1}dp",
            "spacing": "${Math.min(viewport.width/1280,viewport.height/800)*32}dp",
            "backgroundColor": "rgba(255,255,255,0.3)"
           }
          ]
         }
        ]
       }
      ],
      "alignItems": "center",
      "justifyContent": "center"
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
const render = (h) => {
  const image = imageUrl();
  console.log('Foto:', image ? image.split('?')[0] : '(sem foto)');
  return h.responseBuilder.addDirective({
  type: 'Alexa.Presentation.APL.RenderDocument',
  token: TOKEN,
  document: DOCUMENT,
  datasources: { payload: { data: { image } } },
  });
};

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
