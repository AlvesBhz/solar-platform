# Solar do Espinhaço · skill para Echo Show

Abertura animada da marca para rodar **nativa** no Echo Show, como uma skill Alexa com tela em APL. Reproduz `echo-show/abertura.html`.

**Responsiva:** a foto e o fundo ocupam a tela inteira. O conteúdo fica num palco com as proporções do HTML (1280×800), que escala para caber em qualquer Echo Show (5, 8, 10, 15, 21, paisagem ou retrato) sem cortar e sempre centralizado. Cada medida do desenho é multiplicada por `min(largura/1280, altura/800)`.

Falar **"Alexa, abrir solar marca"** mostra:

1. Página 1: o efeito do hero do site. O disco com a folha aparece no topo, o nome transparente surge e some, entra a frase "O espinhaço te conecta com a natureza." e o disco desliza para revelar o wordmark.
2. Transição: o wordmark recolhe, a foto escurece e o disco desce ao centro e vira o selo.
3. Página 2: fundo escuro, selo claro (disco bone) e a linha "LAPINHA DA SERRA · MG". Um toque na tela repete tudo.

## Arquivos

| Arquivo | Para quê |
| --- | --- |
| `lambda/index.js` | Código da skill, com a tela APL já embutida |
| `lambda/package.json` | Dependências |
| `skill-package/interactionModels/custom/pt-BR.json` | Modelo de fala (nome de invocação "solar marca") |
| `assets/serra-hero.jpg` | Foto de fundo (1600×1000, JPEG), recortada da foto do site |
| `build_skill.py` | Gera `index.js` e o modelo de fala. Edite a tela aqui e rode `python3 build_skill.py` |

## Instalar (uma vez só)

Pré-requisito: a skill já criada no Alexa Developer Console como **Custom + Alexa-hosted (Node.js)**, idioma **Português (Brasil)**, com o mesmo login Amazon do Echo Show.

1. **Aba Build, menu da esquerda → Invocations → Skill Invocation Name:** troque para `solar marca`. Salve.
2. **Aba Build, menu da esquerda → Interfaces** (depois de *Tasks*): ligue **Alexa Presentation Language** (sem isso a tela não aparece). Salve.
3. **Aba Build, menu da esquerda → Interaction Model → JSON Editor:** cole o conteúdo de `pt-BR.json`. Clique em **Save** e depois em **Build skill**.
4. **Aba Code → botão S3 Storage → Buckets de uso geral → bucket da skill → pasta `Media` → Carregar:** envie `assets/serra-hero.jpg`, com esse nome exato. A foto fica privada e a skill gera um link temporário sozinha, então não é preciso copiar URL.
5. **Aba Code:**
   - substitua `lambda/index.js` pelo arquivo deste repositório;
   - substitua `lambda/package.json` pelo deste repositório (inclui o `aws-sdk`, usado para assinar o link da foto);
   - clique em **Deploy**.
6. **Aba Test:** mude para **Development**, escolha o dispositivo **Echo Show 8** no simulador e digite `abrir solar marca`.
7. **No Echo Show 8:** diga "Alexa, abrir solar marca". O idioma do aparelho precisa ser Português (Brasil).

Uma skill em desenvolvimento aparece sozinha nos aparelhos da conta que a criou. Não precisa enviar para certificação.

## Se algo não aparecer como esperado

Este pacote foi escrito sem acesso à documentação do APL e **ainda não foi testado em aparelho**. Se o simulador reclamar, confira primeiro estes pontos, que eram os mais incertos:

- **Fontes.** O aparelho não carrega fontes próprias, então Cormorant e Inter foram trocadas por `noto-serif` e `amazon-ember`. Se o nome não existir, use outro da lista de fontes do APL.
- **`letterSpacing` e `fontWeight`.** Se o simulador acusar propriedade inválida, remova.
- **Degradês.** O ângulo `0` deveria ir de cima para baixo. Se o escurecimento vier de lado, troque para `90`.
- **Estado final das animações.** Cada animação é seguida de um `SetValue` com o valor final, para o caso de o aparelho voltar ao valor inicial.
- **Duração da tela.** A abertura é silenciosa (a Alexa recusa fala só com pausas). O documento APL tem `idleTimeout` de 5 minutos para a tela continuar no aparelho depois da animação. Se a tela sumir antes, ajuste esse valor.

## Diferenças em relação ao HTML

- **Fontes:** o APL usa as fontes do aparelho. No lugar de Cormorant e Inter entram a serifada e a sem serifa nativas, então o desenho das letras é diferente; tamanhos, espaçamentos e posições seguem o HTML.
- **Efeitos:** o nome transparente (`mix-blend-overlay`) e o desfoque não existem no APL. O nome usa branco semitransparente, a foto só escurece e os brilhos em pine são degradês radiais.
- **APL não tem `margin`:** os espaços entre elementos usam `spacing`.
