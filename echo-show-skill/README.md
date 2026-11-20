# Solar do Espinhaço · skill para Echo Show

Duas coisas na mesma skill ("Alexa, abrir solar marca"):

1. **Abertura da marca** em vídeo, em loop (`assets/abertura.mp4`, gravado de `echo-show/abertura.html`).
2. **Itens da casa**: o hóspede pergunta por voz onde fica um item e o Echo Show responde com um vídeo curto.

## Itens da casa por voz

Exemplos de frases (a skill aceita artigo, "o", "a", ou sem artigo):

- "Alexa, **pergunte ao solar marca onde fica o cofre**" (direto, sem abrir a skill antes)
- Com a skill aberta: "**onde fica o cofre?**", "**cadê a cafeteira?**", "**me mostre o frigobar**", "**onde encontro o Wi-Fi?**"
- "**Quais itens você mostra?**" abre o menu de itens (também se toca nele).

Ao pedir um item: a Alexa diz "Aqui está o cofre." (mais a frase de onde ele fica, se estiver preenchida) e toca o vídeo. Quando o vídeo termina, aparece o menu para escolher outro item.

### Lista de itens (o que você preenche)

`content/itens.json` tem os 10 itens sugeridos: cofre, ar-condicionado, TV e streaming, banheira de imersão, frigobar, cafeteira, fechadura digital, Wi-Fi, piscina aquecida e aspirador robô.

Para cada item:

| Campo | Para quê |
| --- | --- |
| `nome`, `artigo` | Como a Alexa fala ("a banheira de imersão") |
| `sinonimos` | Outras palavras que o hóspede pode dizer ("geladeira" para o frigobar) |
| `onde` | **Frase de onde fica**, dita pela Alexa e escrita no cartão. Ex.: `"no closet, na prateleira de cima."`. Vazio = a Alexa diz só "Aqui está o cofre." |
| `icone` | Ícone do cartão (`solar:*` ou os ícones próprios da marca) |

Para tirar um item, apague o bloco dele. Para incluir um, copie um bloco e troque o `id`, o `nome` e os sinônimos. Depois rode `python3 build_skill.py` (gera o código e o modelo de fala) e, se mudou texto ou ícone dos cartões, `tools/gerar_cartoes.py` (veja abaixo).

### Vídeos dos itens

Os vídeos atuais em `assets/itens/<id>.mp4` são **cartões animados** na identidade da marca: logo no topo, selo bone com o ícone, o nome do item e, se houver, a frase de onde fica (1280×720, ~9 s, começam e terminam em preto, sem áudio).

**Para mostrar o lugar de verdade, grave você mesmo** um clipe curto (10 a 20 s) de cada item e troque o arquivo com o mesmo nome. A skill não muda. Dicas: celular na horizontal, plano estável, termine em um quadro parado. H.264 em MP4, 1080p ou 720p, até ~10 MB.

Os arquivos vão para o bucket em `Media/itens/` (pasta `itens` dentro de `Media`), com o nome `<id>.mp4` (por exemplo `Media/itens/cofre.mp4`).

## Arquivos

| Arquivo | Para quê |
| --- | --- |
| `content/itens.json` | **Lista de itens, sinônimos e frases de onde ficam** (é o que você edita) |
| `assets/abertura.mp4` | Vídeo da abertura (1920×1080, H.264, ~22 s, em loop) |
| `assets/itens/*.mp4` | Um vídeo por item da casa |
| `lambda/index.js`, `lambda/package.json` | Código da skill (gerados por `build_skill.py`) |
| `skill-package/interactionModels/custom/pt-BR.json` | Modelo de fala (frases, itens e sinônimos; invocação "solar marca") |
| `build_skill.py` | Gera o código e o modelo de fala a partir de `content/itens.json` |
| `tools/gerar_cartoes.py`, `tools/cartao_item.html` | Geram os cartões animados (um vídeo por item) |
| `tools/capture.js` | Grava uma página HTML em quadros (Playwright) |

## Instalar (uma vez só)

Pré-requisito: skill criada no Alexa Developer Console como **Custom + Alexa-hosted (Node.js)**, idioma **Português (Brasil)**.

1. **Build → Invocations → Skill Invocation Name:** `solar marca`.
2. **Build → Interfaces:** ligue **Alexa Presentation Language**.
3. **Build → Interaction Model → JSON Editor:** cole `pt-BR.json`, **Save** e **Build skill**. (O modelo mudou: tem os itens e as frases novas.)
4. **Code → S3 Storage → Buckets de uso geral → bucket da skill → pasta `Media` → Carregar:** envie `abertura.mp4`. Crie a pasta `itens` dentro de `Media` e envie os 10 vídeos de `assets/itens/` para lá, com os mesmos nomes.
5. **Code:** substitua `lambda/index.js` e `lambda/package.json` pelos deste repositório e clique em **Deploy**.
6. **Test:** ative **Development**, escolha **Echo Show 8** e digite `abrir solar marca`, depois `onde fica o cofre`.
7. No aparelho: "Alexa, abrir solar marca" (idioma do Echo Show em Português do Brasil).

## Gerar os cartões de novo

1. Pasta de trabalho com `fonts/` (woff2 de Cormorant Garamond 400/500 e Inter 300/400 do `@fontsource`), `design-system/` (cópia de `colors_and_type.css`), `capture.js` e `ic/` (npm `@iconify-json/solar`).
2. `python3 tools/gerar_cartoes.py <pasta_de_trabalho> [id ...]` regrava todos os cartões, ou só os `id` listados.

## Pontos a conferir no aparelho

- **O que ainda não foi testado:** a skill, o reconhecimento das frases e a reprodução dos vídeos no Echo Show. Os pedidos foram simulados no computador.
- **Estado do vídeo na tela:** enquanto `DEBUG = True` em `build_skill.py`, aparece no canto um texto pequeno (Abrindo, Vídeo pronto, Tocando, Falha). Ponha `False` e rode o script quando tudo funcionar.
- **Logs:** `CloudWatch Logs` registra `Vídeo:`, `Item:`, `Erro da tela (APL):` e `O player não conseguiu abrir o vídeo:`.
- **Itens sem vídeo no bucket:** o player mostra "Falha ao abrir o vídeo" e o menu fica disponível ao tocar.
- **Em 16:10** (Echo Show 8 e 10) o vídeo corta cerca de 5% de cada lado, onde só há fundo. Em retrato não corta e deixa faixas escuras.
