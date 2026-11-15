# Solar do Espinhaço · skill para Echo Show

Abertura animada da marca para rodar **nativa** no Echo Show 8 (tela de 1280×800), como uma skill Alexa com tela em APL.

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

1. **Aba Build → Invocations → Skill Invocation Name:** troque para `solar marca`. Salve.
2. **Aba Build → Interfaces:** ligue **Alexa Presentation Language** (sem isso a tela não aparece). Salve.
3. **Aba Build → JSON Editor:** cole o conteúdo de `pt-BR.json`. Clique em **Save** e depois em **Build**.
4. **Aba Code → Media storage:** envie `assets/serra-hero.jpg`. Copie o endereço do arquivo.
5. **Aba Code:**
   - substitua `lambda/index.js` pelo arquivo deste repositório;
   - substitua `lambda/package.json` pelo deste repositório;
   - na primeira linha de código do `index.js`, troque `COLE_AQUI_O_ENDERECO_DA_FOTO` pelo endereço copiado no passo 4;
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
- **Duração da sessão.** O texto falado tem duas pausas de 9 s para manter a skill aberta durante a animação (cerca de 17 s).

## Diferenças em relação ao teste em navegador

O nome transparente (`mix-blend-overlay`) e o desfoque da foto não existem no APL. O nome usa branco semitransparente, e a foto só escurece.
