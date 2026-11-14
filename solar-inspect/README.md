# Solar Inspect — App de Vistorias (mockup)

Mockup inicial das telas **T01 Inicialização**, **T02 Login**, **T03 Permissão de localização**, **T04 Acesso indisponível**, **T05 Minhas unidades**, **T06 Detalhe da unidade**, **T07 Tipo de vistoria**, **T08 Validação de presença**, **T09 Leitor QR**, **T10 Checklist**, **T11 Detalhe do item**, **T12 Captura de evidência** , **T13 Comparação entrada × saída**, **T14 Ocorrência**, **T15 Resumo**, **T16 Assinatura**, **T17 Confirmação**, **T18 Sincronização** e **T19 Meu histórico** da [especificação](../vistorias/docs/ESPECIFICACAO.md). Sem banco de dados: autenticação, unidades, validação de presença (servidor) e rascunho da vistoria são simulados em `src/mocks/`.

**Stack:** TypeScript · React · Vite · Tailwind CSS · React Router · html5-qrcode · Dexie (IndexedDB, fotos no aparelho) · Iconify (coleção `solar`, empacotada localmente).
Os tokens vêm de `../design-system/colors_and_type.css`, importado sem alteração e espelhado em `tailwind.config.js`.

## Rodar

```bash
npm install
npm run dev
```

## Testar no celular

Com o computador e o celular **no mesmo Wi-Fi**:

```bash
npm run dev
```

O terminal mostra um endereço `Network`, por exemplo `http://192.168.0.10:5173`. Abra no celular e acrescente a rota (ex.: `/login`).

**Câmera (T09) e GPS (T03/T08) exigem HTTPS no celular.** Para testá-los use:

```bash
npm run dev:celular
```

Abra o endereço `https://…` mostrado. O navegador vai avisar que o certificado não é confiável (é local): toque em *Avançado → Continuar*.

Para publicar (Cloudflare Pages): comando de build `npm run build`, pasta de saída `dist`, diretório raiz `solar-inspect`. O arquivo `public/_redirects` garante que as rotas abram direto.

## Navegação da simulação

Em qualquer tela, o botão verde redondo no canto inferior esquerdo abre o menu **Navegar entre telas** (T01–T34). Para as telas que dependem de uma vistoria em andamento (T08–T13), o menu cria o rascunho necessário antes de abrir. É só do mockup: remover na versão real (`src/components/SimNav.tsx`).

## Rotas

| Rota | Tela |
|---|---|
| `/` | T01 Inicialização (verifica sessão/sincronização → `/login`) |
| `/login` | T02 Login |
| `/permissao-localizacao` | T03 Permissão de localização (usa o GPS real do navegador, leitura única) |
| `/app/unidades` | T05 Minhas unidades — teste estados com `?simular=erro`, `vazio` ou `lento` |
| `/app/unidades/:id` | T06 Detalhe da unidade (ex.: `chale-sempre-viva`) |
| `/app/vistorias/nova/:unidadeId` | T07 Tipo de vistoria (Saída só habilitada com estadia em curso, ex.: `chale-candeia`) |
| `/app/vistorias/nova/:unidadeId/presenca` | T08 Validação de presença — falhas com `?simular=fora` ou `?simular=precisao` |
| `/app/vistorias/nova/:unidadeId/qr` | T09 Leitor QR (câmera ao vivo; painel *Mockup · simular leitura*: válido, outra unidade, expirado) |
| `/app/vistorias/nova/:unidadeId/checklist` | T10 Checklist (só abre após presença validada) |
| `/app/vistorias/nova/:unidadeId/item/:itemId` | T11 Detalhe do item (referência, resposta, observação, evidências) |
| `/app/vistorias/nova/:unidadeId/item/:itemId/foto` | T12 Captura de evidência (câmera, referência sobreposta, carimbo de local e hora) |
| `/app/vistorias/nova/:unidadeId/item/:itemId/comparar` | T13 Comparação entrada × saída (vistoria de Saída, ex.: `chale-candeia`) |
| `…/item/:itemId/ocorrencia` | T14 Ocorrência (gravidade, descrição, fotos; uma por item) |
| `…/resumo` · `…/assinatura` · `…/confirmacao` | T15 Resumo · T16 Assinatura · T17 Confirmação (envio definitivo, novo estado da unidade) |
| `/app/sincronizacao` | T18 Sincronização (fila offline, tentar agora) |
| `/app/historico` | T19 Meu histórico (filtros por unidade, tipo, status) |
| `/gestao` … | T20 Dashboard · T21/T22 Unidades · T23/T24 Vistorias · T25/T26 Ocorrências · T27 Relatório (login `gestor@solar.dev` ou `admin@solar.dev`) |
| `/admin/propriedades` · `/admin/propriedades/nova` | T28 Propriedades · T29 Formulário |
| `/admin/checklists` · `/admin/tipos` · `/admin/presenca` | T30 Ambientes e itens · T31 Tipos de vistoria · T33 GPS e QR Code |
| `/admin/usuarios` · `/admin/auditoria` | T32 Usuários e permissões · T34 Auditoria |
| `/acesso-indisponivel?motivo=…` | T04 Acesso indisponível — `sem-permissao`, `inativo`, `sessao-expirada`, `offline`, `sem-localizacao` |

## Contas de teste (mock)

| E-mail | Resultado |
|---|---|
| `assessor@solar.dev` / `gestor@solar.dev` | Link enviado → "Simular clique no link" segue para T03 → T05 |
| `inativo@solar.dev` | Bloqueado (usuário inativo) |
| qualquer outro | E-mail não cadastrado |

## Fotos de referência

As imagens em `public/referencias/` são cópias reduzidas de `site/assets/images/` (originais intactos). O banheiro ainda não tem foto de referência.

## Link de simulação

`npm run build:artifact` gera `dist-artifact/solar-inspect.html` (arquivo único, navegação em memória, GPS simulado; câmera substituída por envio de foto), publicado como link no claude.ai.
