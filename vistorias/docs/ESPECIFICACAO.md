# Especificação Técnica — Aplicação de Vistorias Solar do Espinhaço

> Documento de referência para desenvolvimento do MVP.
> Versão revisada — 13 nov 2026. Original em PDF: [`Especificacao_Tecnica_App_Vistorias_Solar_do_Espinhaco.pdf`](./Especificacao_Tecnica_App_Vistorias_Solar_do_Espinhaco.pdf).

**Objetivo do documento:** definir o comportamento esperado do produto, as regras de negócio, a arquitetura e os critérios verificáveis de aceite. Este documento não contém cronograma, orçamento ou estimativas comerciais.

---

## 1. Visão do produto

A aplicação será uma PWA instalável em celular, voltada ao registro de vistorias em chalés, quartos e outras unidades de hospedagem. O sistema comprovará a presença do assessor na unidade, conduzirá o checklist por ambiente, registrará evidências fotográficas e transformará divergências em ocorrências rastreáveis.

### 1.1 Objetivos

- Impedir a liberação de uma unidade sem que os itens obrigatórios tenham sido conferidos.
- Registrar evidências de data, hora, unidade e localização das fotos.
- Comparar o estado da unidade entre a entrada e a saída do hóspede.
- Controlar pendências, danos, faltas e defeitos por meio de ocorrências.
- Permitir acompanhamento do status das unidades e consulta do histórico de vistorias.
- Operar temporariamente sem internet e sincronizar os dados quando a conexão retornar.

### 1.2 Escopo do MVP

| Incluído | Não incluído nesta versão |
|---|---|
| Autenticação e controle de acesso | Integração com channel manager ou sistema de reservas |
| Cadastro de propriedades, unidades, ambientes, itens e tipos de vistoria | Cobrança automática de danos ao hóspede |
| Validação por GPS, QR Code ou ambos | Integração com fechadura Intelbras ou Echo Show |
| Checklists, fotos, assinatura e envio | Aplicativos nativos publicados nas lojas |
| Ocorrências, painel, histórico e relatório PDF | Contagem automática por visão computacional |
| Modo offline com sincronização | Automações externas não explicitadas nesta especificação |

## 2. Perfis e permissões

| Perfil | Responsabilidades principais |
|---|---|
| Assessor | Executar vistorias nas propriedades autorizadas; registrar respostas, fotos, observações e assinatura. |
| Gestor | Consultar unidades, vistorias, relatórios e ocorrências; acompanhar e tratar pendências. |
| Administrador | Gerenciar usuários, propriedades, unidades, ambientes, itens, tipos de vistoria e configurações de validação. |

> **Regra de acesso:** todo acesso deve ser limitado por perfil e pelas propriedades associadas ao usuário. O banco aplicará essas restrições com Row Level Security (RLS).

## 3. Conceitos e estados

### 3.1 Hierarquia de cadastro

**Propriedade → Unidade → Ambiente → Item.** O cadastro é reutilizado por todas as vistorias. Um hotel é uma propriedade; cada quarto é uma unidade. Uma pousada pode possuir vários chalés, cada um representado como unidade.

### 3.2 Estados da unidade

| Estado | Significado |
|---|---|
| Em limpeza | Unidade aguardando limpeza e preparação. |
| Liberado | Vistoria de entrada concluída sem pendência crítica. |
| Ocupado | Unidade em uso pelo hóspede. |
| Bloqueado | Existe impedimento crítico para entrega. |
| Manutenção | Existe ocorrência que exige intervenção técnica. |

Fluxo padrão: **Em limpeza → Liberado → Ocupado → Em limpeza**. Bloqueado e Manutenção são estados excepcionais e retornam ao fluxo padrão após a resolução das pendências.

### 3.3 Estados da vistoria

| Estado | Regra |
|---|---|
| Rascunho | Pode ser alterada pelo assessor e permanece local ou sincronizada. |
| Pendente de sincronização | Concluída no dispositivo, mas ainda não confirmada pelo servidor. |
| Enviada | Registro final e imutável. Alterações e exclusões devem ser bloqueadas. |
| Sinalizada | Enviada com alguma condição de revisão, como duração muito curta ou envio fora do raio. |

## 4. Tipos de vistoria

O administrador poderá criar, ativar e desativar tipos de vistoria. A desativação impede novas seleções, mas não remove vistorias já realizadas. Cada tipo define nome, descrição, checklist aplicável, periodicidade e vínculo ou não com uma estadia.

| Tipo inicial | Finalidade | Respostas possíveis |
|---|---|---|
| Entrada | Validar limpeza, organização, enxoval, artes e funcionamento antes da chegada. | OK / Problema / N/A |
| Saída | Comparar o estado atual com a vistoria de entrada vinculada. | Igual / Danificado / Faltando / Com defeito |
| Manutenção preventiva | Executar verificações recorrentes sem depender de estadia. | OK / Precisa intervenção / N/A |
| Personalizada | Atender a um processo configurado pelo administrador. | Definidas pelo comportamento do tipo ou pelo checklist |

### 4.1 Regras comuns

- A unidade só pode apresentar tipos ativos e aplicáveis a ela.
- Cada item pode ser obrigatório, crítico, exigir foto e possuir foto de referência.
- Uma resposta de problema ou intervenção deve exigir observação e pelo menos uma foto.
- O envio deve validar todos os itens obrigatórios antes de concluir a vistoria.
- O tipo usado deve ser gravado na vistoria para preservar o histórico mesmo após alterações futuras no cadastro.

## 5. Fluxos funcionais

### 5.1 Início da vistoria

1. Usuário autentica no sistema.
2. Seleciona uma unidade à qual possui acesso.
3. Seleciona um tipo de vistoria ativo.
4. O sistema valida a presença conforme a configuração efetiva da unidade.
5. Após validação, o checklist é liberado e a hora de início é registrada.

### 5.2 Execução do checklist

- Exibir os ambientes na ordem física configurada.
- Exibir os itens de cada ambiente com status, criticidade, obrigatoriedade de foto e referência visual.
- Salvar cada resposta localmente assim que for informada.
- Ao marcar problema, intervenção, dano, falta ou defeito, exigir observação e foto.
- Revalidar a localização nas fotos quando GPS estiver ativo.
- Exibir o progresso da vistoria e os itens pendentes.

### 5.3 Envio

- Validar itens obrigatórios, fotos obrigatórias e campos associados a divergências.
- Exibir resumo final, ocorrências que serão criadas e campo de assinatura.
- Revalidar a presença no envio.
- Gravar a vistoria como enviada, tornando-a imutável.
- Criar ocorrências e atualizar o estado da unidade conforme as regras do tipo de vistoria.
- Se não houver conexão, manter o envio em fila local e sincronizar automaticamente.

### 5.4 Vistoria de entrada

Ao concluir sem pendência crítica, a unidade passa para **Liberado**. Se houver pendência crítica, passa para **Bloqueado**. Problemas não críticos geram ocorrência, mas não bloqueiam automaticamente a liberação.

### 5.5 Vistoria de saída

A vistoria deve ser vinculada à entrada correspondente e exibir, quando disponível, a foto anterior do item. Sem divergências, a unidade passa para **Em limpeza**. Com ocorrência que demande intervenção, passa para **Manutenção**.

### 5.6 Manutenção preventiva

As respostas com intervenção necessária geram ocorrência com gravidade e prazo. Uma ocorrência crítica altera a unidade para **Manutenção**; ocorrências de menor gravidade não mudam o estado automaticamente.

## 6. Validação de presença

A propriedade define o modo padrão e a unidade pode sobrescrevê-lo. A configuração efetiva nunca pode ficar vazia.

| Modo | Validação |
|---|---|
| GPS | O dispositivo precisa estar dentro do raio cadastrado e informar precisão aceitável. |
| QR Code | O código identifica a unidade e contém um segredo vigente validado no servidor. |
| GPS + QR Code | As duas validações devem ser aprovadas na mesma abertura da vistoria. |

### 6.1 Regras do GPS

- Solicitar localização com alta precisão e tempo limite de 15 segundos.
- Aceitar quando a distância calculada pelo servidor for menor ou igual ao raio da unidade e a precisão informada for de até 50 m.
- Calcular a distância no servidor usando a fórmula de Haversine.
- Se apenas GPS estiver ativo e mais de uma unidade contiver a posição, solicitar seleção explícita da unidade.
- Revalidar a posição em cada foto e no envio final.

### 6.2 Regras do QR Code

- O QR deve conter identificador da unidade e segredo rotacionável.
- O servidor deve validar se a unidade pertence a uma propriedade permitida ao usuário.
- A leitura deve ocorrer pela câmera ao vivo.
- O painel deve permitir trocar o segredo e invalidar códigos anteriores.

### 6.3 Falhas e auditoria

Em caso de falha, o checklist não deve ser exibido. A interface informará o motivo e permitirá nova tentativa. Toda tentativa deve gerar evento de auditoria com usuário, unidade, resultado, coordenadas, precisão e horário.

> **Sinalização:** vistorias concluídas em menos de 4 minutos ou enviadas fora do raio serão aceitas apenas conforme a política definida, mas sempre marcadas para revisão. A regra deve ser configurável no banco, evitando valor fixo no front-end.

## 7. Requisitos funcionais do MVP

| ID | Funcionalidade | Especificação |
|---|---|---|
| RF-01 | Autenticação | Login por e-mail e método seguro suportado pelo Supabase Auth. A sessão poderá permanecer no dispositivo por até 30 dias. |
| RF-02 | Controle de acesso | Aplicar permissões por perfil e propriedade. |
| RF-03 | Cadastros | Gerenciar propriedades, unidades, ambientes, itens, usuários e tipos de vistoria. |
| RF-04 | Presença | Validar GPS, QR Code ou ambos antes de liberar o checklist. |
| RF-05 | Checklist | Apresentar itens agrupados e ordenados por ambiente. |
| RF-06 | Evidências | Capturar fotos pela câmera, associar coordenadas e registrar carimbo na exibição e nos metadados. |
| RF-07 | Referência visual | Exibir foto de referência do ambiente ou item durante a captura. |
| RF-08 | Offline | Persistir vistoria e fotos no dispositivo e sincronizar posteriormente. |
| RF-09 | Comparação | Vincular saída à entrada e exibir evidência anterior por item. |
| RF-10 | Ocorrências | Criar e tratar ocorrências com gravidade, responsável, prazo e estado. |
| RF-11 | Assinatura | Coletar assinatura e exibir resumo antes do envio. |
| RF-12 | Imutabilidade | Impedir alteração ou exclusão de vistoria enviada. |
| RF-13 | Painel | Exibir estado das unidades, vistorias, histórico e ocorrências abertas. |
| RF-14 | Relatório | Gerar PDF de uma vistoria com respostas, evidências e ocorrências. |
| RF-15 | Auditoria | Registrar eventos relevantes de autenticação, validação, envio e alteração cadastral. |

## 8. Requisitos não funcionais

| ID | Tema | Requisito |
|---|---|---|
| RNF-01 | Mobile-first | Telas do assessor devem funcionar a partir de 320 px e ter alvos de toque de pelo menos 44 × 44 px. |
| RNF-02 | PWA | A aplicação deve ser instalável e utilizar Service Worker para cache do shell e fila de sincronização. |
| RNF-03 | Segurança | Todo tráfego deve usar HTTPS. Fotos devem ficar em bucket privado e ser acessadas por URL assinada. |
| RNF-04 | Privacidade | Coletar localização apenas durante a vistoria, nunca em segundo plano, e registrar aceite no primeiro acesso. |
| RNF-05 | Integridade | Validações críticas devem ocorrer no servidor; o cliente não é fonte única de verdade. |
| RNF-06 | Desempenho | Comprimir imagens antes do envio. O limite de dimensão e qualidade será configurável, com valor inicial de 1600 px e qualidade 80%. |
| RNF-07 | Usabilidade | Fluxo linear, progresso visível, mensagens de erro acionáveis e confirmação antes do envio. |
| RNF-08 | Observabilidade | Falhas de sincronização e validação devem ser registradas com dados suficientes para diagnóstico, sem armazenar segredos. |
| RNF-09 | Acessibilidade | Controles com rótulos, contraste adequado, foco visível e operação sem depender apenas de cor. |

## 9. Regras de ocorrência e atualização de estado

| Condição | Resultado |
|---|---|
| Entrada sem pendência crítica | Unidade → Liberado. |
| Entrada com pendência crítica | Criar ocorrência; unidade → Bloqueado. |
| Saída sem divergência | Unidade → Em limpeza. |
| Saída com divergência que exige intervenção | Criar ocorrência; unidade → Manutenção. |
| Manutenção preventiva com ocorrência crítica | Criar ocorrência; unidade → Manutenção. |
| Problema não crítico | Criar ocorrência; estado só muda se a regra do tipo determinar. |
| Ocorrência resolvida | Registrar responsável e data. A mudança de estado deve ocorrer por ação explícita ou regra validada, nunca apenas pela resolução isolada. |

- **Gravidades iniciais:** baixa, média e crítica.
- **Estados da ocorrência:** aberta, em tratamento, resolvida e cancelada. O cancelamento deve exigir justificativa e permanecer no histórico.

## 10. Arquitetura definida

| Camada | Tecnologia | Responsabilidade |
|---|---|---|
| Front-end | TypeScript, React, Vite e Tailwind CSS | PWA, telas, componentes, validações de interface e integração com serviços. |
| Roteamento | React Router | Navegação SPA e rotas protegidas. |
| Back-end/BaaS | Supabase com PostgreSQL | Auth, banco, Storage, RLS, RPC e Edge Functions. |
| Fotos | Supabase Storage privado | Armazenamento protegido e acesso por URL assinada. |
| QR Code | html5-qrcode | Leitura pela câmera do navegador. |
| Offline | IndexedDB com Dexie.js + Service Worker | Persistência local, fila de envio e retomada. |
| Hospedagem | Cloudflare Pages | Entrega do front-end por HTTPS e automação de deploy. |

### 10.1 Princípios de implementação

- Todas as alterações de esquema devem ser versionadas por migrations.
- Tipos TypeScript devem ser gerados a partir do schema do Supabase.
- Regras críticas de estado, presença, imutabilidade e ocorrência devem ficar no banco ou em funções server-side.
- O front-end deve tratar operações como idempotentes para evitar duplicidade durante a sincronização.
- Segredos de QR e chaves de serviço nunca devem ser expostos no bundle do navegador.

## 11. Modelo de dados

| Tabela | Campos principais | Observação |
|---|---|---|
| `usuarios` | id, nome, email, perfil, ativo, aceite_lgpd_em | O vínculo com propriedades deve usar tabela associativa. |
| `usuario_propriedades` | usuario_id, propriedade_id | Permissões por propriedade. |
| `propriedades` | id, nome, tipo, modo_validacao, latitude, longitude, raio_m | Configuração padrão de presença. |
| `unidades` | id, propriedade_id, nome, tipo, andar, coordenadas, raio_m, qr_secret, modo_validacao, status | Pode herdar a validação da propriedade. |
| `ambientes` | id, unidade_id, nome, ordem, foto_referencia_url | Ordem física do percurso. |
| `itens` | id, ambiente_id, nome, tipo, ordem, foto_obrigatoria, critico, quantidade_esperada, foto_referencia_url | Cadastro reutilizável. |
| `tipos_vistoria` | id, propriedade_id, nome, descricao, periodicidade, vincula_estadia, ativo | Define comportamento geral. |
| `tipo_vistoria_itens` | tipo_vistoria_id, item_id, obrigatorio, foto_obrigatoria, ordem | Checklist normalizado por tipo. |
| `vistorias` | id, unidade_id, usuario_id, tipo_vistoria_id, vistoria_entrada_id, modo_usado, inicio, fim, coordenadas, precisao_m, distancia_m, fora_do_local, assinatura_url, status | Registro principal. |
| `respostas` | id, vistoria_id, item_id, status, observacao | Uma resposta por item. |
| `fotos` | id, vistoria_id, resposta_id, url, coordenadas, precisao_m, carimbo, criado_em | Bucket privado. |
| `ocorrencias` | id, vistoria_id, resposta_id, unidade_id, gravidade, descricao, responsavel_id, prazo, status, resolvida_em | Rastreabilidade da pendência. |
| `eventos_log` | id, entidade, registro_id, acao, usuario_id, payload, criado_em | Auditoria sem segredos. |

> **Ajuste da versão anterior:** o checklist padrão em JSONB foi substituído pela tabela `tipo_vistoria_itens`. A estrutura relacional facilita validação, histórico, filtros e evolução do cadastro. JSONB pode existir apenas para snapshots ou configurações auxiliares.

## 12. Operação offline e sincronização

- Cada vistoria deve receber um UUID no dispositivo antes da primeira gravação.
- Respostas e fotos são persistidas no IndexedDB de forma incremental.
- A fila deve registrar tentativas, último erro e próxima tentativa.
- O servidor deve aceitar reenvio do mesmo UUID sem duplicar vistoria, resposta, foto ou ocorrência.
- Após confirmação do servidor, os arquivos locais podem ser limpos conforme política de retenção.
- Conflitos cadastrais devem bloquear o envio e apresentar orientação clara; uma vistoria enviada nunca será mesclada silenciosamente.
- O usuário deve visualizar o estado de sincronização e poder tentar novamente.

## 13. Interface e navegação

### 13.1 Assessor

- Login
- Lista de unidades permitidas e estado atual
- Seleção do tipo de vistoria
- Validação de presença
- Checklist por ambiente
- Captura de evidência com referência visual
- Resumo, assinatura e envio
- Fila de sincronização e histórico próprio

### 13.2 Gestor e administrador

- Dashboard de unidades
- Cadastros de propriedade, unidade, ambiente, item e tipo de vistoria
- Lista e detalhe de vistorias
- Gestão de ocorrências
- Relatório PDF
- Gestão de usuários e permissões
- Configuração e rotação de QR Code
- Consulta de auditoria conforme perfil

### 13.3 Identidade visual

Utilizar os tokens existentes do Solar (ver [`design-system/colors_and_type.css`](../../design-system/colors_and_type.css)):

| Token | Cor |
|---|---|
| Pine | `#2C3E35` |
| Pine Deep | `#1C2922` |
| Pine Mid | `#3D5547` |
| Cream | `#FAFAF9` |
| Sucesso | `#059669` |
| Atenção | `#B45309` |
| Erro | `#B91C1C` |

Títulos podem usar **Cormorant Garamond** e o corpo **Inter**. O módulo deve permanecer isolado em sua própria pasta e consumir, sem alterar, o Design System existente.

## 14. Critérios de aceite do MVP

| ID | Critério verificável |
|---|---|
| CA-01 | Usuário sem acesso à propriedade não consegue listar nem consultar suas unidades. |
| CA-02 | Checklist não é exibido quando a validação de presença falha. |
| CA-03 | GPS é recalculado no servidor e rejeita distância ou precisão fora dos limites configurados. |
| CA-04 | QR inválido, expirado ou de outra unidade é rejeitado e auditado. |
| CA-05 | Item obrigatório ou foto obrigatória pendente impede o envio. |
| CA-06 | Divergência exige foto e observação e gera ocorrência correspondente. |
| CA-07 | Vistoria enviada não pode ser alterada ou excluída por API nem pelo banco. |
| CA-08 | Saída exibe a evidência da entrada vinculada quando ela existir. |
| CA-09 | Vistoria offline sobrevive ao fechamento do app e sincroniza sem duplicar dados. |
| CA-10 | Mudanças de estado da unidade seguem as regras descritas na seção 9. |
| CA-11 | Relatório PDF contém identificação, respostas, fotos, assinatura e ocorrências da vistoria. |
| CA-12 | Localização não é coletada fora do fluxo de vistoria. |
| CA-13 | Painel apresenta estado atual, histórico e ocorrências abertas de cada unidade. |
| CA-14 | Logs registram tentativas de presença, envios e alterações administrativas relevantes. |

## 15. Decisões pendentes antes da implementação

- [ ] Definir como uma estadia será representada no MVP sem integração com reservas: seleção manual, código informado pelo gestor ou ausência de entidade estadia.
- [ ] Definir se o gestor pode liberar manualmente uma unidade bloqueada e qual justificativa será obrigatória.
- [ ] Definir política de retenção de fotos no dispositivo após sincronização.
- [ ] Definir limites iniciais de raio por propriedade e se o assessor poderá prosseguir com vistoria sinalizada quando o GPS estiver indisponível.
- [ ] Definir método final de autenticação: magic link, OTP por e-mail ou outro fluxo suportado. Não implementar PIN próprio sem mecanismo seguro de emissão, expiração e bloqueio.
- [ ] Definir se assinatura é obrigatória para todos os tipos ou configurável.
- [ ] Definir destinatários e canal das notificações críticas quando essa funcionalidade entrar no escopo.

## 16. Ordem técnica recomendada

Esta seção indica dependências de implementação, não datas ou estimativas.

1. Schema, migrations, perfis, vínculos e RLS.
2. Cadastros estruturais e tipos de vistoria.
3. Autenticação e navegação protegida.
4. Validação de presença e auditoria.
5. Checklist, respostas, câmera e evidências.
6. Envio imutável, ocorrências e atualização de estado.
7. Modo offline e sincronização idempotente.
8. Painel, histórico e relatório PDF.
9. Testes automatizados de regras, RLS, sincronização e fluxos críticos.
