# Solar do Espinhaço · skill para Echo Show

Abertura da marca em **vídeo**, tocada em tela cheia no Echo Show por uma skill Alexa (APL, componente `Video`).

Falar **"Alexa, abrir solar marca"** toca `assets/abertura.mp4`: o efeito do hero do site, a transição em que o disco do topo vira o selo e a página final com o selo claro sobre o fundo escuro. A abertura roda em **loop**: depois da pausa no selo a tela escurece e recomeça do início. Um toque na tela também volta ao início.

O vídeo é a gravação de `echo-show/abertura.html`, por isso ele é idêntico ao HTML (fonte Cormorant, nome transparente, desfoque e brilhos). Foi a saída para o que o APL não consegue reproduzir.

## Arquivos

| Arquivo | Para quê |
| --- | --- |
| `assets/abertura.mp4` | Vídeo: H.264 High nível 4.1, 1920×1080, 30 fps, 21,7 s, sem áudio, ~4,6 MB (começa e termina em preto, para o loop não piscar) |
| `lambda/index.js` | Código da skill (gera um link temporário do vídeo e abre o player) |
| `lambda/package.json` | Dependências (inclui `aws-sdk`) |
| `skill-package/interactionModels/custom/pt-BR.json` | Modelo de fala (invocação "solar marca") |
| `build_skill.py` | Gera `index.js` e o modelo de fala |
| `tools/capture.js` | Grava o HTML em quadros (Playwright), para montar o vídeo de novo |

## Instalar

Pré-requisito: skill criada no Alexa Developer Console como **Custom + Alexa-hosted (Node.js)**, idioma **Português (Brasil)**.

1. **Build → Invocations → Skill Invocation Name:** `solar marca`.
2. **Build → Interfaces:** ligue **Alexa Presentation Language**.
3. **Build → Interaction Model → JSON Editor:** cole `pt-BR.json`, **Save** e **Build skill**.
4. **Code → S3 Storage → Buckets de uso geral → bucket da skill → pasta `Media` → Carregar:** envie `assets/abertura.mp4`, com esse nome exato.
5. **Code:** substitua `lambda/index.js` e `lambda/package.json` pelos deste repositório e clique em **Deploy**.
6. **Test:** ative **Development**, escolha **Echo Show 8** e digite `abrir solar marca`.
7. No aparelho: "Alexa, abrir solar marca" (idioma do Echo Show em Português do Brasil).

## Como o vídeo foi gerado

1. Copiar `echo-show/abertura.html`, `design-system/` e a foto para uma pasta de trabalho, trocando as fontes do Google por `@fontsource/cormorant-garamond`, `@fontsource/inter` e `@fontsource/instrument-serif` locais.
2. `node tools/capture.js <pasta_de_quadros> 24 1920 <caminho>/abertura.html` grava os quadros pelo Chromium (screencast), com os horários de cada quadro.
3. `ffmpeg` monta os quadros em 30 fps (`minterpolate` em modo blend para suavizar), H.264 High nível 4.1, `-crf 22 -an -movflags +faststart`, cortado entre os dois momentos de tela preta (início e fim do ciclo).

## Pontos a conferir no aparelho

- **O vídeo precisa estar em `Media/abertura.mp4`** (M maiúsculo). Se a tela ficar escura, veja no CloudWatch a linha `Vídeo:` e as mensagens `Falha ao assinar o vídeo:` ou `Sessão encerrada com erro:`.
- **Loop:** ao terminar, o player volta ao início sozinho (`onEnd`). Se parar no fim, me avise.
- **Em 16:10** (Echo Show 8 e 10) o vídeo corta cerca de 5% de cada lado, onde só há fundo. Em retrato ele não corta e deixa faixas escuras.
