# Especificação Técnica — Aplicação de Vistorias Solar do Espinhaço

> Versão 3 · 15 nov 2026 · Especificação funcional, técnica e catálogo de telas do MVP, atualizada com o protótipo navegável (T01–T34).
> Esta versão substitui as anteriores (o histórico está no Git). Código do protótipo: pasta `solar-inspect/`.

**Objetivo:** orientar diretamente o desenvolvimento da aplicação, sem cronograma, orçamento ou estimativas comerciais. Onde o protótipo simula o servidor, a regra está marcada como **[servidor]** e deve ser reimplementada no banco ou em funções server-side.

---

## 1. Visão e escopo

PWA mobile-first para vistorias de unidades de hospedagem, com validação de presença, checklist por ambiente, evidências fotográficas, comparação entrada × saída, ocorrências, operação offline e painel de gestão.

| Incluído no MVP | Fora do MVP |
|---|---|
| Autenticação, perfis e propriedades | Integrações com reservas, fechaduras e cobrança |
| GPS, QR Code e auditoria | Aplicativos nativos publicados nas lojas |
| Checklists, fotos, assinatura e envio | Visão computacional e automações não especificadas |
| Ocorrências, histórico, dashboard e PDF | Cronograma, preços e escopo comercial |

**Estado atual:** as 34 telas existem como protótipo navegável com dados fictícios, sem banco de dados. O protótipo valida fluxos, regras de interface e navegação; a segurança, a persistência e o PDF dependem da implementação com Supabase.

## 2. Perfis e acesso

| Perfil | Responsabilidade | Área |
|---|---|---|
| Assessor | Executar vistorias, registrar respostas, fotos e assinatura. | Campo (`/app`) |
| Gestor | Acompanhar unidades, vistorias, relatórios e ocorrências; tratar pendências. | Gestão (`/gestao`) |
| Administrador | Tudo do gestor, mais cadastros, usuários, permissões e configurações de presença. | Gestão e administração (`/admin`) |

- **Login por e-mail.** No protótipo, o e-mail válido entra direto, sem etapa intermediária de confirmação. O método real (link mágico ou código por e-mail) está pendente (seção 13).
- **Destino após o login:** assessor vai para Minhas unidades (T05); gestor e administrador vão para o Dashboard (T20). Usuário inativo é barrado no próprio login; acesso negado leva à T04.
- **Localização não é pedida no login.** A permissão é solicitada na vistoria, na validação de presença (T08). A T03 só serve de ajuda quando o GPS está bloqueado.
- **Regra de acesso:** todo acesso é limitado por perfil e pelas propriedades vinculadas ao usuário, aplicado no banco com Row Level Security (RLS) **[servidor]**. Unidade inexistente ou sem acesso leva à T04 sem revelar dados.
- **Contas de teste do protótipo:** `assessor@solar.dev` (campo), `gestor@solar.dev` e `admin@solar.dev` (gestão), `inativo@solar.dev` (bloqueado).

## 3. Regras centrais

### 3.1 Hierarquia e estados

**Propriedade → Unidade → Ambiente → Item.** Um hotel é uma propriedade e cada quarto, uma unidade; uma pousada tem vários chalés, cada um uma unidade.

| Estado da unidade | Significado |
|---|---|
| Em limpeza | Aguardando limpeza e preparação. |
| Liberado | Vistoria de entrada concluída sem pendência crítica. |
| Ocupado | Em uso pelo hóspede (definido pela gestão; sem integração com reservas no MVP). |
| Bloqueado | Impedimento crítico para entrega. |
| Manutenção | Ocorrência que exige intervenção técnica. |

Fluxo padrão: Em limpeza → Liberado → Ocupado → Em limpeza. Bloqueado e Manutenção são excepcionais e voltam ao fluxo após a resolução.

| Estado da vistoria | Regra |
|---|---|
| Rascunho | Editável pelo assessor, salvo no aparelho a cada resposta. |
| Pendente de sincronização | Concluída no aparelho, ainda não confirmada pelo servidor. |
| Enviada | Registro final e imutável: alteração e exclusão bloqueadas. |
| Sinalizada | Enviada com condição de revisão (ver 3.3). |

### 3.2 Regras de ocorrência e de estado da unidade

| Condição | Resultado |
|---|---|
| Entrada sem ocorrência crítica | Unidade → Liberado. |
| Entrada com ocorrência crítica | Cria ocorrência; unidade → Bloqueado. |
| Entrada com problema não crítico | Cria ocorrência; unidade → Liberado. |
| Saída sem divergência | Unidade → Em limpeza. |
| Saída com divergência | Cria ocorrência; unidade → Manutenção. |
| Manutenção preventiva com ocorrência crítica | Cria ocorrência; unidade → Manutenção. |
| Manutenção preventiva com ocorrência não crítica | Cria ocorrência; estado não muda. |
| Ocorrência resolvida | Registra responsável e data; **não muda o estado da unidade** sozinha. |
| Mudança manual de estado (gestor/admin, T22) | Permitida com justificativa obrigatória, registrada na auditoria. |

- **Gravidades:** baixa, média e crítica. A crítica é a escolhida na ocorrência; item marcado como crítico no cadastro já vem com "Crítica" sugerida.
- **Status da ocorrência:** aberta, em tratamento, resolvida e cancelada. Atribuir responsável move para "em tratamento". O cancelamento exige justificativa e permanece no histórico.

### 3.3 Sinalização e imutabilidade

- Vistoria concluída em menos de **4 minutos** é aceita, mas sempre sinalizada para revisão. O envio fora do raio ou sem localização também é sinalizado. Os limites devem ser configuráveis no banco, nunca fixos no front-end **[servidor]**.
- Depois do envio, o rascunho local é descartado e o registro não pode ser alterado nem excluído, nem pela API, nem pelo banco **[servidor]**.

## 4. Tipos de vistoria

| Tipo | Respostas | Comportamento |
|---|---|---|
| Entrada | OK / Problema / N/A | Valida preparação e liberação. |
| Saída | Igual / Danificado / Faltando / Com defeito | Compara com a entrada vinculada à estadia. |
| Manutenção preventiva | OK / Precisa intervenção / N/A | Gera ocorrências com gravidade; sem estadia. |
| Personalizada | Configurável | Usa checklist definido pelo administrador (ex.: Conferência de enxoval). |

- A unidade só oferece tipos **ativos** e aplicáveis. **Saída** só fica disponível com vistoria de entrada vinculada (estadia em curso); caso contrário aparece desabilitada com a explicação.
- Cada item pode ser obrigatório, crítico, exigir foto e ter foto de referência (a referência é do ambiente).
- **Regra de evidência (alterada na v3):** a resposta negativa (Problema, Precisa intervenção, Danificado, Faltando, Com defeito) exige **gravidade e pelo menos uma foto**. A **observação é opcional.** Item com "foto obrigatória" exige foto quando a resposta não é N/A.
- Um item está **completo** quando tem resposta e as evidências exigidas. O envio só é liberado com todos os itens completos.
- O tipo usado é gravado na vistoria, preservando o histórico mesmo após alterações no cadastro. Desativar um tipo não remove vistorias feitas; um tipo sem itens não pode ser ativado.

## 5. Fluxo da vistoria (assessor)

Login (T02) → Minhas unidades (T05) → Unidade (T06) → Tipo (T07) → Presença (T08/T09) → Checklist (T10) → Detalhe, Câmera, Comparação e Ocorrência (T11–T14) → Resumo (T15) → Assinatura (T16) → Confirmação (T17) → Fila e Histórico (T18/T19).

### 5.1 Presença (T08, T09)

A propriedade define o modo padrão e a unidade pode sobrescrevê-lo; a configuração efetiva nunca fica vazia.

| Modo | Validação |
|---|---|
| GPS | Dentro do raio cadastrado, com precisão aceitável. |
| QR Code | Código com identificador da unidade e segredo vigente, validado no servidor. |
| GPS + QR Code | As duas validações na mesma abertura da vistoria. |

- **GPS:** localização com alta precisão e tempo limite de 15 s; aprovada quando a distância calculada **no servidor** (Haversine) é menor ou igual ao raio da unidade (protótipo: 40 m nos chalés, 25 m nos quartos) e a precisão é de até 50 m **[servidor]**. A leitura é pontual, nunca em segundo plano.
- **Início automático:** ao abrir a T08, a verificação do GPS começa sozinha, quando a unidade exige GPS; é nesse momento que o navegador pede a permissão.
- **QR Code:** lido pela câmera ao vivo (T09), com conteúdo `SOLAR:<unidade>:<segredo>`. É rejeitado se for inválido, de outra unidade ou expirado. O painel de administração rotaciona o segredo e invalida os anteriores; o segredo nunca vai ao navegador do assessor **[servidor]**.
- **Avanço automático:** concluídas as validações exigidas pela unidade, a T08 mostra "Presença validada" e abre o checklist em cerca de 1 s, sem botão.
- **Falhas:** o checklist não é exibido; a tela informa o motivo (distância, precisão, QR) e permite nova tentativa. Toda tentativa gera evento de auditoria com usuário, unidade, resultado, coordenadas, precisão e horário.
- A presença é revalidada em cada foto (T12) e no envio final (T17), quando o GPS está ativo.

### 5.2 Checklist (T10)

- Cabeçalho: contagem "x/N itens completos", barra de progresso, indicação "Salvo no aparelho" e abas por ambiente (ícone, nome e contagem; check verde quando completo). Abaixo, o nome do ambiente ("Ambiente n de N") e o botão **Tudo OK**.
- Cada item é uma linha com botões circulares, na ordem **✓ verde, ✗ vermelho e N/A**, com área de toque de 44 px. Também é possível **deslizar a linha para a direita (OK) ou para a esquerda (problema)**; a rolagem vertical continua livre.
- **Tudo OK** marca de uma vez os itens ainda sem resposta do ambiente; itens com foto obrigatória ficam com a etiqueta "Tirar foto obrigatória".
- Pendências aparecem como etiqueta na própria linha: "Tirar foto obrigatória" (abre a câmera) ou "Detalhar problema: gravidade e foto" (abre o detalhe).
- Na Saída, o ✗ abre a comparação (T13) para escolher entre Danificado, Faltando e Com defeito.
- Cada resposta é gravada no aparelho na hora. O botão **Revisar e enviar** só libera com todos os itens completos.

### 5.3 Detalhe do item (T11) e comparação (T13)

- A T11 mostra a foto de referência do ambiente, o nome do item e a resposta no mesmo padrão ✓ ✗ N/A.
- **Se for problema:** a tela mostra apenas a etiqueta do problema, as três caixas de **Gravidade da ocorrência** (Baixa, Média, Crítica), as fotos e, opcionalmente, "Adicionar observação". Não há seletor de resposta; há o atalho "Não é problema: marcar OK".
- Item crítico exibe aviso de que pode bloquear a unidade. **Concluir item** só libera com as evidências exigidas.
- A T13 (vistorias de Saída) mostra a foto da entrada ao lado da foto atual, com o estado do item. Exige entrada vinculada; sem ela, informa que a comparação está indisponível. No protótipo, a foto da entrada é simulada pela referência do ambiente.

### 5.4 Evidências (T12)

- Câmera ao vivo com a miniatura da referência, que pode ser **sobreposta** ao enquadramento. Quando a câmera ao vivo não está disponível, oferece a câmera do aparelho.
- Cada foto recebe **carimbo** gravado na imagem (unidade, ambiente, item, data e hora, coordenadas e precisão) e os mesmos dados nos metadados.
- Compressão antes do envio: lado maior de até 1600 px e qualidade 80% (configuráveis). Fotos ficam no aparelho (IndexedDB) até a sincronização e, no servidor, em bucket privado com URL assinada **[servidor]**.
- A posição é revalidada a cada foto; foto fora do raio é marcada "Fora do raio" e a vistoria será sinalizada.

### 5.5 Ocorrência, resumo, assinatura e envio (T14–T17)

- **T14 Ocorrência:** edita gravidade, descrição (opcional) e fotos de uma ocorrência. Há uma ocorrência por item, sem duplicidade.
- **T15 Resumo:** itens completos, divergências, fotos e duração; lista de pendências com atalho para resolver; ocorrências que serão criadas; aviso quando a vistoria será sinalizada.
- **T16 Assinatura:** área de desenho com limpar e confirmar (obrigatória para todos os tipos no protótipo).
- **T17 Confirmação:** resumo, aviso de que o registro será imutável e confirmação em duas etapas. Revalida a presença, grava a vistoria, cria as ocorrências e mostra o **novo estado da unidade** conforme a seção 3.2.

### 5.6 Offline e sincronização

- Cada vistoria recebe um UUID no aparelho antes da primeira gravação; o servidor aceita reenvio do mesmo UUID sem duplicar vistoria, resposta, foto ou ocorrência **[servidor]**.
- Sem conexão, o envio fica na fila ("Salva na fila de envio"); a T18 mostra pendentes, tentativas, último erro e o botão **Tentar agora**. Conflitos cadastrais bloqueiam o envio com orientação clara; vistoria enviada nunca é mesclada em silêncio.
- A T19 lista as vistorias do próprio assessor, com filtros por unidade, tipo e status.

## 6. Navegação automática e comportamentos de interface

| Gatilho | Comportamento |
|---|---|
| E-mail válido no login | Entra direto: assessor em T05, gestor/admin em T20. |
| Abrir a T08 | Verifica o GPS sozinha (quando exigido). |
| Presença completa | Mostra "Presença validada" e abre o checklist em ~1 s. |
| Resposta negativa no checklist | Abre o detalhe do item (T11, ou T13 na saída). |
| Resposta positiva em item com foto obrigatória | Abre a câmera; após "Usar foto", volta ao checklist. |
| Todos os itens do ambiente completos | Aviso "concluída · seguindo…" e salto em ~0,6 s para o **próximo ambiente com pendência**; sem pendências, abre o resumo. Ocorre uma vez por ambiente. |
| Voltar do detalhe ou da câmera | Reabre o ambiente e rola até o item que estava sendo avaliado. |
| Botão voltar do navegador no checklist | Leva à unidade (não repete a validação). |
| Deslizar a linha do item | Para a direita marca ✓; para a esquerda marca ✗. |
| Menu superior da gestão (celular) | O item selecionado fica centralizado, para escolher o anterior ou o próximo. |
| Tabelas da gestão em tela estreita (< 768 px) | Cada linha vira um cartão, sem rolagem lateral. |
| Unidade sem acesso ou inexistente | Vai à T04 sem exibir dados. |

## 7. Gestão e administração

Telas responsivas: menu lateral no computador e no tablet; barra superior rolável no celular.

| Tela | Regras principais |
|---|---|
| T20 Dashboard | Indicadores (unidades, liberadas, ocorrências abertas, vistorias do dia), barra com o estado das unidades, ocorrências prioritárias e filtro por propriedade. |
| T21 Unidades | Busca e filtro por estado; tabela (cartões no celular). |
| T22 Detalhe da unidade | Cadastro, ocorrências, vistorias e **alteração manual de estado com justificativa** (mín. 5 caracteres), registrada na auditoria. |
| T23 Vistorias | Filtro por status, paginação de 10 registros e exportação em CSV (no protótipo, copia para a área de transferência). |
| T24 Detalhe da vistoria | Metadados e sinalizações, somente leitura; atalho para o relatório. |
| T25 Ocorrências | Abertas por padrão; ordenadas por gravidade e prazo; críticas em destaque. |
| T26 Tratamento | Atribuir responsável, prazo, comentários, resolver (exige responsável) e cancelar (com justificativa); histórico completo. |
| T27 Relatório | Prévia do PDF com identificação, respostas, ocorrências e assinatura; o arquivo é gerado no servidor **[servidor]**. |
| T28 Propriedades | Lista com unidades; desativar e reativar sem apagar; botão Nova. |
| T29 Formulário de propriedade | Nome (mín. 3), tipo, validação padrão, latitude (-90 a 90), longitude (-180 a 180) e raio (10 a 500 m). |
| T30 Ambientes e itens | Por unidade: reordenar ambientes, **criar ambiente**, adicionar item, marcar crítico e foto; "Salvar nova versão" preserva o histórico. |
| T31 Tipos de vistoria | Ativar e desativar (sem itens não ativa) e periodicidade. |
| T32 Usuários e permissões | Perfil, propriedades e status ativo; menor privilégio e RLS. |
| T33 Configuração GPS/QR | Modo, raio (10 a 500 m) e **rotação do segredo** (invalida os códigos anteriores; o segredo não é exibido). |
| T34 Auditoria | Eventos por usuário, ação e detalhe, somente leitura, com filtro. |

## 8. Requisitos de interface e identidade visual

- **Assessor:** mobile-first a partir de 320 px; alvos de toque de pelo menos 44 × 44 px; campos de texto com 16 px (evita zoom no iPhone). **Gestão:** responsiva para desktop, tablet e celular.
- **Sem rolagem horizontal** em nenhuma largura (verificado de 280 a 2560 px, inclusive celular deitado); conteúdo largo fica contido no próprio bloco.
- Toda consulta prevê carregando, vazio, sucesso, erro e sem permissão. A operação informa online, offline, salvo no aparelho, sincronizando e falha.
- Ações irreversíveis exigem confirmação. Validação no cliente e novamente no servidor **[servidor]**.
- **Identidade:** tokens do Design System do Solar (Pine #2C3E35, Pine Deep #1C2922, Pine Mid #3D5547, Cream #FAFAF9; sucesso #059669, atenção #B45309, erro #B91C1C), consumidos sem alterar a pasta `design-system/`. Títulos em Cormorant Garamond e corpo em Inter; ícones da coleção Solar (linear), embutidos no aplicativo para funcionar offline.
- **Logos:** selo SE na abertura (T01) e no painel lateral do login em telas largas; selo SE menor com "Vistorias" no login do celular; logo horizontal "Solar do Espinhaço" no menu da gestão.
- **Tipografia:** títulos de tela de 26 a 32 px e textos de apoio de 13 px. Status sempre com cor, ícone e texto. Animações apenas de feedback (150 a 300 ms) e respeito a "reduzir movimento".

## 9. Arquitetura e dados

| Camada | Tecnologia |
|---|---|
| Front-end | TypeScript, React, Vite, Tailwind CSS e React Router |
| Back-end | Supabase: PostgreSQL, Auth, Storage, RLS, RPC e Edge Functions |
| Offline | IndexedDB com Dexie.js (fotos e fila) e Service Worker |
| QR Code | html5-qrcode |
| Hospedagem | Cloudflare Pages |

**Princípios:** migrations versionadas; tipos TypeScript gerados do schema; regras críticas de presença, estado, imutabilidade e ocorrência no banco ou em funções server-side; operações idempotentes; segredos de QR e chaves de serviço nunca no navegador.

| Tabela | Campos principais | Observação |
|---|---|---|
| `usuarios` | id, nome, email, perfil, ativo, aceite_lgpd_em | Vínculo com propriedades por tabela associativa. |
| `usuario_propriedades` | usuario_id, propriedade_id | Permissões por propriedade. |
| `propriedades` | id, nome, tipo, modo_validacao, latitude, longitude, raio_m, ativo | Configuração padrão de presença. |
| `unidades` | id, propriedade_id, nome, tipo, andar, coordenadas, raio_m, qr_secret, modo_validacao, status | Pode herdar a validação da propriedade. |
| `ambientes` | id, unidade_id, nome, ordem, foto_referencia_url | Ordem física do percurso. |
| `itens` | id, ambiente_id, nome, tipo, ordem, foto_obrigatoria, critico, quantidade_esperada | Cadastro reutilizável. |
| `tipos_vistoria` | id, propriedade_id, nome, descricao, periodicidade, vincula_estadia, ativo | Comportamento geral. |
| `tipo_vistoria_itens` | tipo_vistoria_id, item_id, obrigatorio, foto_obrigatoria, ordem | Checklist normalizado por tipo. |
| `vistorias` | id (UUID do aparelho), unidade_id, usuario_id, tipo_vistoria_id, vistoria_entrada_id, modo_usado, inicio, fim, coordenadas, precisao_m, distancia_m, fora_do_local, assinatura_url, status, sinalizacoes | Registro principal e imutável. |
| `respostas` | id, vistoria_id, item_id, status, observacao (opcional) | Uma resposta por item. |
| `fotos` | id, vistoria_id, resposta_id, url, coordenadas, precisao_m, carimbo, fora_do_raio, criado_em | Bucket privado. |
| `ocorrencias` | id, vistoria_id, resposta_id, unidade_id, gravidade, descricao (opcional), responsavel_id, prazo, status, resolvida_em, historico | Rastreabilidade da pendência. |
| `eventos_log` | id, entidade, registro_id, acao, usuario_id, payload, criado_em | Auditoria sem segredos. |

## 10. Catálogo de telas

Todas as telas estão prototipadas. Use os IDs em rotas, histórias, testes e pull requests.

| ID | Tela | Perfil | Rota |
|---|---|---|---|
| T01 | Inicialização | Todos | `/` |
| T02 | Login | Todos | `/login` |
| T03 | Permissão de localização (apoio) | Assessor | `/permissao-localizacao` |
| T04 | Acesso indisponível | Todos | `/acesso-indisponivel?motivo=…` |
| T05 | Minhas unidades | Assessor | `/app/unidades` |
| T06 | Detalhe da unidade | Assessor | `/app/unidades/:id` |
| T07 | Tipo de vistoria | Assessor | `/app/vistorias/nova/:unidadeId` |
| T08 | Validação de presença | Assessor | `…/presenca` |
| T09 | Leitor QR | Assessor | `…/qr` |
| T10 | Checklist | Assessor | `…/checklist` |
| T11 | Detalhe do item | Assessor | `…/item/:itemId` |
| T12 | Captura de evidência | Assessor | `…/item/:itemId/foto` |
| T13 | Comparação entrada × saída | Assessor | `…/item/:itemId/comparar` |
| T14 | Ocorrência | Assessor | `…/item/:itemId/ocorrencia` |
| T15 | Resumo | Assessor | `…/resumo` |
| T16 | Assinatura | Assessor | `…/assinatura` |
| T17 | Confirmação | Assessor | `…/confirmacao` |
| T18 | Sincronização | Assessor | `/app/sincronizacao` |
| T19 | Meu histórico | Assessor | `/app/historico` |
| T20 | Dashboard | Gestor/Admin | `/gestao` |
| T21 | Gestão de unidades | Gestor/Admin | `/gestao/unidades` |
| T22 | Detalhe da unidade | Gestor/Admin | `/gestao/unidades/:id` |
| T23 | Lista de vistorias | Gestor/Admin | `/gestao/vistorias` |
| T24 | Detalhe da vistoria | Gestor/Admin | `/gestao/vistorias/:id` |
| T25 | Lista de ocorrências | Gestor/Admin | `/gestao/ocorrencias` |
| T26 | Tratamento da ocorrência | Gestor/Admin | `/gestao/ocorrencias/:id` |
| T27 | Relatório | Gestor/Admin | `/gestao/vistorias/:id/relatorio` |
| T28 | Propriedades | Admin | `/admin/propriedades` |
| T29 | Formulário de propriedade | Admin | `/admin/propriedades/nova` |
| T30 | Ambientes e itens | Admin | `/admin/checklists` |
| T31 | Tipos de vistoria | Admin | `/admin/tipos` |
| T32 | Usuários e permissões | Admin | `/admin/usuarios` |
| T33 | Configuração GPS/QR | Admin | `/admin/presenca` |
| T34 | Auditoria | Admin | `/admin/auditoria` |

Motivos da T04: `sem-permissao`, `inativo`, `sessao-expirada`, `offline`, `sem-localizacao`. As rotas das telas T08 a T17 ficam sob `/app/vistorias/nova/:unidadeId/`.

## 11. Critérios de aceite

| ID | Critério | Protótipo |
|---|---|---|
| CA-01 | Usuário sem acesso à propriedade não lista nem consulta suas unidades. | Interface ok; RLS pendente |
| CA-02 | Checklist não abre quando a presença falha. | Ok |
| CA-03 | GPS é recalculado no servidor e rejeita distância ou precisão fora dos limites. | Simulado; servidor pendente |
| CA-04 | QR inválido, expirado ou de outra unidade é rejeitado e auditado. | Simulado; servidor pendente |
| CA-05 | Item obrigatório ou foto obrigatória pendente impede o envio. | Ok |
| CA-06 | Problema exige gravidade e foto e gera a ocorrência correspondente (observação opcional). | Ok |
| CA-07 | Vistoria enviada não pode ser alterada nem excluída por API nem pelo banco. | Interface ok; banco pendente |
| CA-08 | Saída exibe a evidência da entrada vinculada quando existir. | Ok (foto simulada) |
| CA-09 | Vistoria offline sobrevive ao fechamento do app e sincroniza sem duplicar. | Parcial; fila e rascunho a mover para IndexedDB |
| CA-10 | Mudanças de estado da unidade seguem a seção 3.2. | Ok |
| CA-11 | Relatório PDF contém identificação, respostas, fotos, assinatura e ocorrências. | Prévia; PDF pendente |
| CA-12 | Localização não é coletada fora do fluxo de vistoria. | Ok (T08, T12 e T17) |
| CA-13 | Painel mostra estado atual, histórico e ocorrências abertas de cada unidade. | Ok |
| CA-14 | Logs registram tentativas de presença, envios e alterações administrativas. | Parcial; ver seção 13 |
| CA-15 | Login válido entra direto, sem etapa intermediária e sem pedir localização. | Ok |
| CA-16 | Presença completa abre o checklist sozinha, sem botão. | Ok |
| CA-17 | Ambiente completo avança para o próximo com pendência ou para o resumo. | Ok |
| CA-18 | Voltar do detalhe reabre o ambiente e rola até o item avaliado. | Ok |
| CA-19 | Nenhuma tela tem rolagem horizontal de 280 a 2560 px; tabelas viram cartões abaixo de 768 px. | Ok |

## 12. O que mudou em relação à versão anterior

- **Entrada no app:** removidas a confirmação por e-mail e a permissão de localização após o login; a presença (GPS e QR) acontece na vistoria.
- **Presença (T08):** GPS automático ao abrir e avanço automático ao validar.
- **Checklist (T10):** linhas compactas com ✓ ✗ N/A, deslizar para responder, Tudo OK, etiquetas de pendência, abas por ambiente e avanço automático para o próximo ambiente com pendência.
- **Evidência:** item com foto obrigatória abre a câmera; voltar do detalhe reposiciona no item avaliado.
- **Problema (T11):** apenas gravidade e foto; **observação passou a ser opcional** (antes era obrigatória).
- **Gestão e administração:** menu superior centraliza o item selecionado; tabelas viram cartões no celular; T30 permite criar ambiente; T22 permite alterar o estado com justificativa.
- **Protótipo:** link navegável com menu de simulação, câmera e GPS reais no celular em modo HTTPS e correções de responsividade.

## 13. Pendências e decisões em aberto

- [ ] Definir como uma estadia é representada sem integração com reservas (seleção manual, código do gestor ou ausência de entidade).
- [ ] Confirmar se o gestor pode liberar manualmente uma unidade bloqueada (o protótipo permite, com justificativa e auditoria).
- [ ] Definir a política de retenção das fotos no aparelho após a sincronização.
- [ ] Definir os raios iniciais por propriedade e se o assessor pode prosseguir com vistoria sinalizada quando o GPS falha (hoje a T08 bloqueia o checklist).
- [ ] Definir o método final de autenticação (link mágico, código por e-mail ou outro). Não implementar PIN próprio sem emissão, expiração e bloqueio seguros.
- [ ] Definir se a assinatura é obrigatória para todos os tipos ou configurável.
- [ ] Confirmar a observação opcional na divergência (decisão do protótipo; a versão anterior exigia observação).
- [ ] Separar as telas de gestor e administrador por perfil (hoje ambos veem as mesmas).
- [ ] Registrar na auditoria os eventos de presença e envio (hoje só as ações administrativas aparecem na T34).
- [ ] Definir destinatários e canal das notificações críticas.

**Ordem técnica recomendada (dependências, sem datas):** schema, migrations, perfis e RLS; autenticação e rotas protegidas; cadastros e tipos de vistoria; presença e auditoria no servidor; checklist, câmera e armazenamento de fotos; envio imutável, ocorrências e estado; fila offline idempotente; painel e PDF; testes automatizados de regras, RLS, sincronização e fluxos críticos.

## 14. Ambiente de simulação

- **Link navegável:** versão em arquivo único publicada no claude.ai, com menu flutuante para pular entre as telas T01 a T34. Câmera e GPS são simulados nessa versão.
- **No celular, com câmera e GPS reais:** `npm run dev:celular` na pasta `solar-inspect` (HTTPS local) e abrir o endereço de rede mostrado.
- **Dados:** fictícios e locais ao navegador; nenhuma conexão com banco. Parâmetros de teste: `?simular=erro`, `vazio`, `lento` (T05) e `fora`, `precisao` (T08).
