# Solar do Espinhaço · skill para Echo Show

Abertura da marca em **vídeo**, tocada em tela cheia no Echo Show por uma skill Alexa (APL, componente `Video`).

Falar **"Alexa, abrir solar marca"** toca `assets/abertura.mp4`: o efeito do hero do site, a transição em que o disco do topo vira o selo e a página final com o selo claro sobre o fundo escuro. Um toque na tela repete.

O vídeo é a gravação de `echo-show/abertura.html`, por isso ele é idêntico ao HTML (fonte Cormorant, nome transparente, desfoque e brilhos). Foi a saída para o que o APL não consegue reproduzir.

## Arquivos

| Arquivo | Para quê |
| --- | --- |
| `assets/abertura.mp4` | Vídeo: H.264 High nível 4.1, 1920×1080, 30 fps, 20,5 s, sem áudio, ~4 MB |
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
3. `ffmpeg` monta os quadros em 30 fps, H.264 High nível 4.1, `-crf 23 -an -movflags +faststart`, cortado em 20,5 s.

## Pontos a conferir no aparelho

- **O vídeo precisa estar em `Media/abertura.mp4`** (M maiúsculo). Se a tela ficar escura, veja no CloudWatch a linha `Vídeo:` e as mensagens `Falha ao assinar o vídeo:` ou `Sessão encerrada com erro:`.
- **Ao fim do vídeo** a tela deve ficar no último quadro (o selo). Se ficar preta, o jeito é gravar o vídeo em loop ou tocar de novo no fim.
- **Em 16:10** (Echo Show 8 e 10) o vídeo corta cerca de 5% de cada lado, onde só há fundo. Em retrato ele não corta e deixa faixas escuras.
