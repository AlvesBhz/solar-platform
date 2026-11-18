# Dicionário de dados — Vistorias

Integrado ao banco de reservas do site (mesmo Supabase, esquema `public`): 15 tabelas, 4 delas do site, e 22 ligações. Diagrama em [`der.html`](./der.html). proposta v2, 18/11/2026.

Gerado por `tools/gerar-der.py`, que lê as tabelas do site em `site/database/schema.sql`.

## Integração com o site

- **Cadastro único.** PROPRIEDADE e UNIDADE são as mesmas tabelas do site, no mesmo esquema public. O chalé cadastrado para a venda é o mesmo que o assessor vistoria; a vistoria só acrescenta campos (marcados com +).
- **Manutenção tira da venda.** Ocorrência crítica cria um BLOQUEIO MANUTENCAO. A consultar_disponibilidade do site e o iCal dos canais já respeitam BLOQUEIO: as datas saem da venda sem mudar nada no site.
- **Liberar devolve à venda.** Ao liberar a unidade, o bloqueio aberto é encerrado (DT_FIM = amanhã) e as datas voltam a ficar disponíveis.
- **Reserva vira agenda.** Reservas CONFIRMADA geram a vistoria de Entrada no DT_CHECKIN e a de Saída no DT_CHECKOUT.
- **Saída ligada à estadia.** VISTORIA.ID_RESERVA liga a vistoria à estadia do site. Estadias do Airbnb e do Booking chegam como BLOQUEIO CANAL_EXTERNO, sem reserva: nesse caso o campo fica vazio.
- **Mesma equipe.** USUARIO e USUARIO_PROPRIEDADE servem também ao painel do site: um login para os dois produtos.
- **Conflito.** Um bloqueio não cancela reserva confirmada que já existe: o painel avisa o gestor para remanejar o hóspede.

## Nomenclatura

Mesmo padrão do site: `ID_` identificador, `NM_` nome, `DS_` descrição ou texto livre, `DT_` data ou data e hora, `HR_` hora, `VL_` valor (dinheiro, coordenada), `QTDE_` quantidade, `NO_` número (ordem, versão), `CD_` código, `TP_` lista fixa, valores em MAIÚSCULAS, `SG_` sim/não (boolean). Restrições `PK_`, `FK_<FILHA>_<PAI>`, `UQ_`, `CK_`, `IX_`.

## `UNIDADE` (SITE · COMUM)

Tabela do site. O chalé é o elo entre os dois produtos: vendido pelo site e vistoriado pelo app. Os campos novos (+) guardam a situação operacional, o QR da porta e o ponto de GPS.

- **Ligada a:** AMBIENTE, BLOQUEIO, OCORRENCIA, PROPRIEDADE, RESERVA, VISTORIA
- **Acesso (RLS):** Leitura por acesso à pousada; situação muda só pela função; GESTOR e ADMIN cadastram.
- **Regras:** Campos novos (+) acrescentados à tabela do site; TP_UNIDADE e SG_ATIVO valem para os dois produtos. TP_SITUACAO: EM_LIMPEZA, LIBERADO, OCUPADO, BLOQUEADO ou MANUTENCAO. Só muda pela função alterar_situacao_unidade (grava LOG_EVENTO). CD_HASH_QR único; rotacionar soma 1 em NO_VERSAO_QR. Latitude e longitude vêm juntas ou ficam vazias juntas.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_UNIDADE` | `bigint` | sim | PK | Identificador do chalé, quarto ou suíte. |
| `ID_PROPRIEDADE` | `bigint` | sim | FK | Pousada dona da unidade. |
| `CD_UNIDADE` | `text` | sim | — | Código curto (ex.: casa-do-mirante), também usado no site. |
| `NM_UNIDADE` | `text` | sim | — | Nome exibido. |
| `TP_UNIDADE` | `text` | sim | — | CHALE, QUARTO ou SUITE. |
| `SG_ATIVO` | `boolean` | sim | — | Unidade inativa some da venda e da agenda de vistorias. |
| _… mais 6 campos da venda_ | | | | QTDE_MAX_HOSPEDES, QTDE_MAX_ADULTOS, QTDE_MAX_CRIANCAS, VL_TAXA_LIMPEZA, NO_ORDEM, DT_CRIACAO |
| `DS_ANDAR` **+ novo** | `text` | não | — | Andar ou bloco, para o assessor se localizar. |
| `TP_VALIDACAO` **+ novo** | `text` | não | — | Validação desta unidade (QR, GPS ou QR_E_GPS); vazio herda da propriedade. |
| `VL_LATITUDE` **+ novo** | `numeric(9,6)` | não | — | Ponto da unidade; vazio usa o da propriedade. |
| `VL_LONGITUDE` **+ novo** | `numeric(9,6)` | não | — | Longitude da unidade. |
| `QTDE_RAIO_METROS` **+ novo** | `smallint` | não | — | Raio próprio; vazio usa o da propriedade. |
| `TP_SITUACAO` **+ novo** | `text` | sim | — | EM_LIMPEZA, LIBERADO, OCUPADO, BLOQUEADO ou MANUTENCAO. |
| `CD_HASH_QR` **+ novo** | `text` | sim | UQ | Hash do código impresso no QR da porta. |
| `NO_VERSAO_QR` **+ novo** | `smallint` | sim | — | Versão do QR; rotacionar invalida as etiquetas antigas. |
| `DT_ATUALIZACAO` **+ novo** | `timestamptz` | sim | — | Última mudança de situação ou de QR. |

## `PROPRIEDADE` (SITE · COMUM)

Tabela do site. A pousada: os horários de check-in e check-out montam a agenda; os campos novos (+) guardam a regra de presença (QR, GPS, raio).

- **Ligada a:** LOG_EVENTO, UNIDADE, USUARIO_PROPRIEDADE
- **Acesso (RLS):** Todos leem as pousadas a que têm acesso; ADMIN altera.
- **Regras:** Campos novos (+) são acrescentados à tabela do site; nada existente muda. TP_VALIDACAO: QR, GPS ou QR_E_GPS. Raio entre 10 e 1.000 m; precisão máxima entre 5 e 500 m. Substitui a antiga tabela CONFIGURACAO: os parâmetros ficam na pousada.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_PROPRIEDADE` | `bigint` | sim | PK | Identificador da pousada. |
| `NM_PROPRIEDADE` | `text` | sim | — | Nome da pousada. |
| `HR_CHECKIN` | `time` | sim | — | Horário de entrada: base da agenda de vistorias de Entrada. |
| `HR_CHECKOUT` | `time` | sim | — | Horário de saída: base da agenda de vistorias de Saída. |
| _… mais 11 campos da política de venda_ | | | | DS_FUSO_HORARIO, NO_IDADE_MAX_BEBE, NO_IDADE_MAX_CRIANCA, QTDE_MAX_NOITES, VL_PERCENTUAL_SINAL, QTDE_MINUTOS_PRE_RESERVA, QTDE_DIAS_LIMITE_REMARCACAO, QTDE_MESES_VALIDADE_CREDITO, QTDE_DIAS_ARREPENDIMENTO, NO_VERSAO_POLITICA, DT_CRIACAO |
| `TP_VALIDACAO` **+ novo** | `text` | sim | — | Como a presença do assessor é validada por padrão: QR, GPS ou QR_E_GPS. |
| `VL_LATITUDE` **+ novo** | `numeric(9,6)` | não | — | Latitude da sede, centro do raio de presença. |
| `VL_LONGITUDE` **+ novo** | `numeric(9,6)` | não | — | Longitude da sede. |
| `QTDE_RAIO_METROS` **+ novo** | `smallint` | sim | — | Raio aceito em volta do ponto (padrão 100 m). |
| `QTDE_PRECISAO_MAX_METROS` **+ novo** | `smallint` | sim | — | Pior precisão de GPS aceita (padrão 50 m). |
| `QTDE_MINUTOS_MIN_VISTORIA` **+ novo** | `smallint` | sim | — | Duração mínima esperada; abaixo disso a vistoria é sinalizada. |

## `RESERVA` (SITE · COMUM)

Tabela do site, só leitura para a vistoria. Reservas CONFIRMADA viram a agenda de Entrada (check-in) e Saída (check-out).

- **Ligada a:** UNIDADE, VISTORIA
- **Acesso (RLS):** Leitura para GESTOR e ADMIN e para o assessor na agenda do dia; escrita só do site.
- **Regras:** A vistoria só lê: status, datas e unidade. Entrada no dia DT_CHECKIN, Saída no dia DT_CHECKOUT. Estadias do Airbnb e do Booking não estão aqui: chegam como BLOQUEIO CANAL_EXTERNO.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_RESERVA` | `bigint` | sim | PK | Identificador da estadia vendida. |
| `CD_RESERVA` | `text` | sim | — | Código mostrado ao hóspede (SE-XXXXXXXX). |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade reservada. |
| `DT_CHECKIN` | `date` | sim | — | Dia da entrada: gera a vistoria de Entrada na agenda. |
| `DT_CHECKOUT` | `date` | sim | — | Dia da saída: gera a vistoria de Saída na agenda. |
| `TP_STATUS` | `text` | sim | — | Só reservas CONFIRMADA entram na agenda de vistorias. |
| _… mais 18 campos da venda_ | | | | ID_HOSPEDE, QTDE_ADULTOS, QTDE_CRIANCAS, QTDE_BEBES, TP_CANAL, VL_HOSPEDAGEM, VL_TAXA_LIMPEZA, VL_TOTAL, VL_SINAL, VL_SALDO, DS_DETALHE_PRECOS, DT_EXPIRA, ID_RESERVA_ORIGINAL, TP_MOTIVO_CANCELAMENTO, NO_VERSAO_POLITICA, DT_ACEITE_POLITICA, DT_CRIACAO, DT_ATUALIZACAO |

## `BLOQUEIO` (SITE · COMUM)

Tabela do site. Uma ocorrência crítica cria aqui um bloqueio MANUTENCAO, que tira as datas da venda no site e nos canais (iCal).

- **Ligada a:** OCORRENCIA, UNIDADE
- **Acesso (RLS):** Leitura por acesso à pousada; criado e encerrado pelas funções da vistoria.
- **Regras:** Ocorrência crítica cria bloqueio MANUTENCAO de hoje até a liberação. Liberar a unidade encerra o bloqueio (DT_FIM = amanhã). Reserva confirmada que já existe não é cancelada: o painel avisa o conflito. Nenhum campo novo: o vínculo fica em OCORRENCIA.ID_BLOQUEIO.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_BLOQUEIO` | `bigint` | sim | PK | Identificador do bloqueio. |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade fora da venda. |
| `DT_INI` | `date` | sim | — | Primeira noite bloqueada. |
| `DT_FIM` | `date` | sim | — | Dia seguinte à última noite; liberar a unidade encerra aqui. |
| `TP_MOTIVO` | `text` | sim | — | A vistoria cria bloqueios MANUTENCAO; CANAL_EXTERNO são estadias do Airbnb/Booking. |
| `DS_OBSERVACAO` | `text` | não | — | Resumo da ocorrência que motivou o bloqueio. |
| _… mais 3 campos do canal_ | | | | ID_CALENDARIO, CD_EXTERNO, DT_CRIACAO |

## `VISTORIA` (OPERAÇÃO)

Uma vistoria feita no celular: quem, onde, quando, presença validada, reserva e situação em que a unidade ficou.

- **Ligada a:** RESERVA, RESPOSTA, TIPO_VISTORIA, UNIDADE, USUARIO
- **Acesso (RLS):** Assessor lê as próprias; GESTOR e ADMIN leem as da pousada; insere só enviar_vistoria.
- **Regras:** Id uuid v7 gerado no celular: reenviar não duplica. DT_FIM ≥ DT_INICIO. TP_STATUS: ENVIADA ou SINALIZADA; SINALIZADA exige DS_SINALIZACOES. Saída com SG_EXIGE_ENTRADA aponta a Entrada em ID_VISTORIA_ENTRADA. ID_RESERVA só aceita reserva da mesma unidade. Gravada só pela função enviar_vistoria.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_VISTORIA` | `uuid` | sim | PK | uuid v7 gerado no celular: funciona offline sem duplicar. |
| `ID_VISTORIA_ENTRADA` | `uuid` | não | FK | Na Saída, a Entrada da mesma estadia (comparação). |
| `ID_USUARIO` | `uuid` | sim | FK | Assessor que fez. |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade vistoriada. |
| `ID_TIPO_VISTORIA` | `bigint` | sim | FK | Tipo aplicado. |
| `ID_RESERVA` | `bigint` | não | FK | Estadia do site; vazio em rotina e em estadias de canal. |
| `TP_VALIDACAO` | `text` | sim | — | Validação usada: QR, GPS ou QR_E_GPS. |
| `DT_INICIO` | `timestamptz` | sim | — | Início no celular. |
| `DT_FIM` | `timestamptz` | sim | — | Fim no celular. |
| `DT_RECEBIMENTO` | `timestamptz` | sim | — | Chegada ao servidor (pode ser bem depois, se offline). |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | Posição no início. |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | Posição no início. |
| `QTDE_PRECISAO_METROS` | `smallint` | não | — | Precisão do GPS. |
| `QTDE_DISTANCIA_METROS` | `integer` | não | — | Distância até o ponto da unidade. |
| `SG_FORA_RAIO` | `boolean` | sim | — | Começou fora do raio aceito. |
| `TP_STATUS` | `text` | sim | — | ENVIADA ou SINALIZADA (algo fora do padrão). |
| `DS_SINALIZACOES` | `text[]` | não | — | Motivos: FORA_RAIO, RAPIDA, GPS_IMPRECISO, SEM_ENTRADA… |
| `DS_ASSINATURA` | `text` | não | — | Caminho no Storage da assinatura. |
| `TP_SITUACAO_RESULTANTE` | `text` | sim | — | Situação em que a unidade ficou (LIBERADO, MANUTENCAO…). |
| `DS_OBSERVACAO` | `text` | não | — | Observação geral. |

## `RESPOSTA` (OPERAÇÃO)

A resposta de cada item: OK, PROBLEMA ou não se aplica.

- **Ligada a:** FOTO, ITEM, OCORRENCIA, VISTORIA
- **Acesso (RLS):** Mesma regra da vistoria.
- **Regras:** Chave composta: uma resposta por item na vistoria. TP_RESPOSTA: OK, PROBLEMA ou NAO_SE_APLICA. PROBLEMA exige DS_OBSERVACAO.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_VISTORIA` | `uuid` | sim | PK FK | Vistoria. |
| `ID_ITEM` | `bigint` | sim | PK FK | Item conferido. |
| `TP_RESPOSTA` | `text` | sim | — | OK, PROBLEMA ou NAO_SE_APLICA. |
| `QTDE_ENCONTRADA` | `smallint` | não | — | Contagem, quando o item tem quantidade. |
| `DS_OBSERVACAO` | `text` | não | — | Obrigatória quando PROBLEMA. |
| `DT_RESPOSTA` | `timestamptz` | sim | — | Momento no celular. |

## `OCORRENCIA` (OPERAÇÃO)

Problema encontrado que precisa de tratamento; pode tirar a unidade da venda.

- **Ligada a:** BLOQUEIO, RESPOSTA, UNIDADE
- **Acesso (RLS):** Leitura por acesso à pousada; GESTOR e ADMIN tratam.
- **Regras:** Nasce de uma resposta PROBLEMA (FK composta ID_VISTORIA + ID_ITEM). TP_GRAVIDADE: BAIXA, MEDIA ou CRITICA; item crítico abre CRITICA. TP_STATUS: ABERTA, EM_TRATAMENTO, RESOLVIDA ou CANCELADA; RESOLVIDA exige DT_RESOLUCAO. ID_BLOQUEIO preenchido quando a unidade sai da venda.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_OCORRENCIA` | `bigint` | sim | PK | Sequencial. |
| `ID_VISTORIA` | `uuid` | sim | FK | Vistoria de origem. |
| `ID_ITEM` | `bigint` | sim | FK | Item com problema. |
| `ID_UNIDADE` | `bigint` | sim | FK | Copiado da vistoria: filtra o painel por unidade. |
| `ID_BLOQUEIO` | `bigint` | não | FK | Bloqueio MANUTENCAO criado no site, quando houver. |
| `TP_GRAVIDADE` | `text` | sim | — | BAIXA, MEDIA ou CRITICA. |
| `TP_STATUS` | `text` | sim | — | ABERTA, EM_TRATAMENTO, RESOLVIDA ou CANCELADA. |
| `DS_OCORRENCIA` | `text` | sim | — | O que foi encontrado. |
| `DS_TRATAMENTO` | `text` | não | — | O que a gestão fez. |
| `DT_ABERTURA` | `timestamptz` | sim | — | Abertura. |
| `DT_RESOLUCAO` | `timestamptz` | não | — | Exigida quando RESOLVIDA. |

## `FOTO` (OPERAÇÃO)

Evidência de uma resposta, com local e horário da câmera.

- **Ligada a:** RESPOSTA
- **Acesso (RLS):** Mesma regra da vistoria; o arquivo sai por link assinado.
- **Regras:** Aponta a resposta pela FK composta (ID_VISTORIA + ID_ITEM). Arquivo em bucket privado; CD_ARQUIVO único.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_FOTO` | `uuid` | sim | PK | uuid v7 gerado no celular. |
| `ID_VISTORIA` | `uuid` | sim | FK | Vistoria (com ID_ITEM, aponta a resposta). |
| `ID_ITEM` | `bigint` | sim | FK | Item fotografado. |
| `CD_ARQUIVO` | `text` | sim | UQ | Caminho no Storage (bucket privado). |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | Onde foi tirada. |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | Onde foi tirada. |
| `QTDE_PRECISAO_METROS` | `smallint` | não | — | Precisão do GPS. |
| `SG_FORA_RAIO` | `boolean` | sim | — | Tirada fora do raio. |
| `DT_CAPTURA` | `timestamptz` | sim | — | Momento da câmera, não do envio. |

## `AMBIENTE` (CADASTRO)

Cômodos de cada unidade, na ordem em que o assessor percorre.

- **Ligada a:** ITEM, UNIDADE
- **Acesso (RLS):** Leitura por acesso à pousada; GESTOR e ADMIN mantêm.
- **Regras:** Nome único por unidade. NO_ORDEM define a ordem do checklist.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_AMBIENTE` | `bigint` | sim | PK | Sequencial. |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade do cômodo. |
| `NM_AMBIENTE` | `text` | sim | — | Sala, Quarto, Banheiro, Varanda… |
| `NO_ORDEM` | `smallint` | sim | — | Ordem de passagem no checklist. |
| `DS_FOTO_REFERENCIA` | `text` | não | — | Caminho no Storage da foto de como deve ficar. |
| `SG_ATIVO` | `boolean` | sim | — | Inativo sai do checklist. |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. |

## `ITEM` (CADASTRO)

O que se confere em cada cômodo: crítico, foto obrigatória e quantidade esperada.

- **Ligada a:** AMBIENTE, RESPOSTA, TIPO_VISTORIA_ITEM
- **Acesso (RLS):** Leitura por acesso à pousada; GESTOR e ADMIN mantêm.
- **Regras:** Nome único por cômodo. QTDE_ESPERADA ≥ 0 quando informada.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_ITEM` | `bigint` | sim | PK | Sequencial. |
| `ID_AMBIENTE` | `bigint` | sim | FK | Cômodo onde o item é conferido. |
| `NM_ITEM` | `text` | sim | — | Ex.: Toalhas de banho, Frigobar. |
| `DS_ORIENTACAO` | `text` | não | — | Como conferir. |
| `SG_CRITICO` | `boolean` | sim | — | Problema em item crítico abre ocorrência CRITICA. |
| `SG_FOTO_OBRIGATORIA` | `boolean` | sim | — | Exige foto mesmo quando está OK. |
| `QTDE_ESPERADA` | `smallint` | não | — | Quantidade que deve haver (contagem). |
| `NO_ORDEM` | `smallint` | sim | — | Ordem dentro do cômodo. |
| `SG_ATIVO` | `boolean` | sim | — | Inativo sai do checklist. |

## `TIPO_VISTORIA` (APOIO)

Entrada, Saída, Rotina e Manutenção, com as regras de cada uma.

- **Ligada a:** TIPO_VISTORIA_ITEM, VISTORIA
- **Acesso (RLS):** Todos leem; ADMIN mantém.
- **Regras:** TP_COMPORTAMENTO: ENTRADA, SAIDA, ROTINA ou MANUTENCAO. TP_PERIODICIDADE só para ROTINA: DIARIA, SEMANAL ou MENSAL.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_TIPO_VISTORIA` | `bigint` | sim | PK | Sequencial. |
| `NM_TIPO_VISTORIA` | `text` | sim | UQ | Entrada, Saída, Rotina, Manutenção… |
| `TP_COMPORTAMENTO` | `text` | sim | — | ENTRADA, SAIDA, ROTINA ou MANUTENCAO: regra que o app aplica. |
| `TP_PERIODICIDADE` | `text` | não | — | DIARIA, SEMANAL ou MENSAL (só rotina). |
| `SG_EXIGE_ENTRADA` | `boolean` | sim | — | Saída exige a vistoria de Entrada da mesma estadia. |
| `SG_EXIGE_ASSINATURA` | `boolean` | sim | — | Pede assinatura no fim. |
| `SG_ATIVO` | `boolean` | sim | — | Inativo some da lista. |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. |

## `TIPO_VISTORIA_ITEM` (APOIO)

Quais itens entram em cada tipo de vistoria (o checklist de cada tipo).

- **Ligada a:** ITEM, TIPO_VISTORIA
- **Acesso (RLS):** Todos leem; GESTOR e ADMIN mantêm.
- **Regras:** Chave composta: o item entra uma vez em cada tipo.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_TIPO_VISTORIA` | `bigint` | sim | PK FK | Tipo de vistoria. |
| `ID_ITEM` | `bigint` | sim | PK FK | Item que entra nesse tipo. |
| `NO_ORDEM` | `smallint` | não | — | Ordem própria do tipo; vazio segue a do item. |

## `USUARIO` (ACESSO)

Quem usa o sistema: assessores no app, gestores e administradores no painel. O mesmo cadastro serve à gestão do site.

- **Ligada a:** LOG_EVENTO, USUARIO_PROPRIEDADE, VISTORIA
- **Acesso (RLS):** Cada um lê o próprio; GESTOR lê a equipe; ADMIN cadastra.
- **Regras:** ID_USUARIO = auth.users.id (login do Supabase Auth). CD_LOGIN e CD_CPF únicos; CPF com 11 números e dígitos válidos. TP_PERFIL: ASSESSOR, GESTOR ou ADMIN. Inativo não entra (checado no login e nas regras de acesso).

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_USUARIO` | `uuid` | sim | PK | Mesmo id do login no Supabase Auth (auth.users). |
| `NM_USUARIO` | `text` | sim | — | Nome completo. |
| `CD_LOGIN` | `text` | sim | UQ | Usuário de acesso (ex.: ana.souza), minúsculo. |
| `CD_CPF` | `text` | não | UQ | CPF só com números; também serve para entrar. |
| `TP_PERFIL` | `text` | sim | — | ASSESSOR (campo), GESTOR ou ADMIN (gestão). |
| `SG_ATIVO` | `boolean` | sim | — | Inativo não entra no app. |
| `DT_ACEITE_LGPD` | `timestamptz` | não | — | Aceite do termo de uso de localização e fotos. |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. |
| `DT_ATUALIZACAO` | `timestamptz` | sim | — | Última alteração. |

## `USUARIO_PROPRIEDADE` (ACESSO)

Quais pousadas cada usuário vê. É a base das regras de acesso (RLS) de todas as tabelas.

- **Ligada a:** PROPRIEDADE, USUARIO
- **Acesso (RLS):** ADMIN mantém; cada um lê os próprios acessos.
- **Regras:** Chave composta: um acesso por usuário e pousada. ADMIN vê todas; os demais só as listadas aqui.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_USUARIO` | `uuid` | sim | PK FK | Usuário. |
| `ID_PROPRIEDADE` | `bigint` | sim | PK FK | Pousada que ele pode ver. |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando o acesso foi dado. |

## `LOG_EVENTO` (ACESSO)

Auditoria: quem fez o quê e quando (login, envio, mudança de situação, rotação de QR, cadastros).

- **Ligada a:** PROPRIEDADE, USUARIO
- **Acesso (RLS):** GESTOR e ADMIN leem; só funções inserem.
- **Regras:** Só inserção: ninguém altera nem apaga. Gravado pelas funções do banco, não pelo app.

| Campo | Tipo | Obrigatório | Chave | Descrição |
|---|---|---|---|---|
| `ID_LOG_EVENTO` | `bigint` | sim | PK | Sequencial. |
| `ID_USUARIO` | `uuid` | não | FK | Quem fez; vazio para eventos do sistema. |
| `ID_PROPRIEDADE` | `bigint` | não | FK | Pousada afetada. |
| `TP_EVENTO` | `text` | sim | — | LOGIN, VISTORIA_ENVIADA, SITUACAO_ALTERADA, QR_ROTACIONADO, CADASTRO… |
| `NM_ENTIDADE` | `text` | não | — | Tabela afetada. |
| `CD_REGISTRO` | `text` | não | — | Id do registro afetado. |
| `DS_EVENTO` | `text` | sim | — | Frase legível para a tela de auditoria. |
| `DS_DADOS` | `jsonb` | não | — | Antes e depois, quando houver. |
| `DT_EVENTO` | `timestamptz` | sim | — | Momento do evento. |

## Ligações

| Filha | Campo | Pai | Obrigatória | Leitura |
|---|---|---|---|---|
| `UNIDADE` | `ID_PROPRIEDADE` | `PROPRIEDADE` | sim | pertence a |
| `RESERVA` | `ID_UNIDADE` | `UNIDADE` | sim | reserva |
| `BLOQUEIO` | `ID_UNIDADE` | `UNIDADE` | sim | bloqueia |
| `OCORRENCIA` | `ID_VISTORIA` + `ID_BLOQUEIO` | `BLOQUEIO` | não | tira da venda |
| `USUARIO_PROPRIEDADE` | `ID_USUARIO` | `USUARIO` | sim | acessa |
| `USUARIO_PROPRIEDADE` | `ID_PROPRIEDADE` | `PROPRIEDADE` | sim | acesso a |
| `AMBIENTE` | `ID_UNIDADE` | `UNIDADE` | sim | cômodo de |
| `ITEM` | `ID_AMBIENTE` | `AMBIENTE` | sim | conferido em |
| `TIPO_VISTORIA_ITEM` | `ID_TIPO_VISTORIA` | `TIPO_VISTORIA` | sim | compõe |
| `TIPO_VISTORIA_ITEM` | `ID_ITEM` | `ITEM` | sim | inclui |
| `VISTORIA` | `ID_UNIDADE` | `UNIDADE` | sim | vistoria de |
| `VISTORIA` | `ID_TIPO_VISTORIA` | `TIPO_VISTORIA` | sim | do tipo |
| `VISTORIA` | `ID_USUARIO` | `USUARIO` | sim | feita por |
| `VISTORIA` | `ID_VISTORIA_ENTRADA` | `VISTORIA` | não | entrada de |
| `VISTORIA` | `ID_RESERVA` | `RESERVA` | não | da estadia |
| `RESPOSTA` | `ID_VISTORIA` | `VISTORIA` | sim | responde |
| `RESPOSTA` | `ID_ITEM` | `ITEM` | sim | sobre |
| `FOTO` | `ID_VISTORIA` + `ID_ITEM` | `RESPOSTA` | sim | evidência de |
| `OCORRENCIA` | `ID_VISTORIA` + `ID_ITEM` | `RESPOSTA` | sim | nasce de |
| `OCORRENCIA` | `ID_VISTORIA` + `ID_UNIDADE` | `UNIDADE` | sim | na unidade |
| `LOG_EVENTO` | `ID_USUARIO` | `USUARIO` | não | por |
| `LOG_EVENTO` | `ID_PROPRIEDADE` | `PROPRIEDADE` | não | em |

`USUARIO.ID_USUARIO` também referencia `auth.users` (Supabase Auth).
