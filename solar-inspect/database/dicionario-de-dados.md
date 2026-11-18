# Dicionário de dados — Vistorias

Integrado ao banco de reservas do site (mesmo Supabase, esquema `public`): 15 tabelas, 4 delas do site (`SIT_`), e 22 ligações. Diagrama em [`der.html`](./der.html). proposta v2, 18/11/2026.

Gerado por `tools/gerar-der.py`, que lê as tabelas do site em `site/database/schema.sql` e os textos em `site/database/gerar_der.py`.

## Integração com o site

- **Cadastro único.** SIT_PROPRIEDADE e SIT_UNIDADE são as mesmas tabelas do site, no mesmo esquema public. O chalé cadastrado para a venda é o mesmo que o assessor vistoria; a vistoria só acrescenta campos (marcados com +).
- **Manutenção tira da venda.** Ocorrência crítica cria um SIT_BLOQUEIO MANUTENCAO. A consultar_disponibilidade do site e o iCal dos canais já respeitam SIT_BLOQUEIO: as datas saem da venda sem mudar nada no site. O bloqueio nasce com prazo provisório de 7 dias e é encurtado quando a unidade é liberada.
- **Liberar devolve à venda.** Ao liberar a unidade, o bloqueio aberto é encerrado (DT_FIM = amanhã) e as datas voltam a ficar disponíveis.
- **Reserva vira agenda.** Reservas CONFIRMADA geram a vistoria de Entrada no DT_CHECKIN e a de Saída no DT_CHECKOUT.
- **Saída ligada à estadia.** VST_VISTORIA.ID_RESERVA liga a vistoria à estadia do site. Estadias do Airbnb e do Booking chegam como SIT_BLOQUEIO CANAL_EXTERNO, sem reserva: nesse caso o campo fica vazio.
- **Mesma equipe.** VST_USUARIO e VST_USUARIO_PROPRIEDADE servem também ao painel do site: um login para os dois produtos.
- **Conflito.** Um bloqueio não cancela reserva confirmada que já existe: o painel avisa o gestor para remanejar o hóspede.

## Como uma vistoria tira o chalé da venda

| Quando | O que acontece | Tabelas | Situação do chalé |
|---|---|---|---|
| 23/12 14:40 | Marina faz a vistoria de Entrada antes de a hóspede chegar, com QR e GPS a 14 m da casa. | `VST_VISTORIA 1` | OCUPADO |
| 26/12 12:00 | Check-out da reserva SE-7F3A2C1D. A Saída aparece na agenda a partir do DT_CHECKOUT. | `SIT_RESERVA 1` | — |
| 26/12 15:05 | Marina começa a Saída. A vistoria aponta a Entrada (ID_VISTORIA_ENTRADA = 1) e a estadia (ID_RESERVA = 1). GPS a 22 m, dentro do raio de 60 m. | `VST_VISTORIA 2` | — |
| 26/12 15:10 | Em “Torneira e pia”, item crítico, responde PROBLEMA, descreve o defeito e tira 2 fotos (foto obrigatória). | `VST_RESPOSTA, VST_FOTO` | — |
| 26/12 15:21 | Envia. A função enviar_vistoria grava tudo, abre a ocorrência 1 (CRITICA), cria o bloqueio 3 (MANUTENCAO, 26/12 a 02/01, prazo provisório) e muda a unidade. O log registra. | `VST_OCORRENCIA 1, SIT_BLOQUEIO 3, VST_LOG_EVENTO` | MANUTENCAO |
| 26/12 15:22 | No site, consultar_disponibilidade já devolve essas noites como bloqueadas e o iCal leva a mesma janela ao Airbnb e ao Booking. Nada muda no código do site. | `SIT_BLOQUEIO 3` | MANUTENCAO |
| 28/12 | O gestor marca a ocorrência como RESOLVIDA e libera a unidade. O bloqueio é encerrado (DT_FIM = 29/12) e as datas voltam à venda. | `VST_OCORRENCIA 1, SIT_BLOQUEIO 3` | LIBERADO |

## Nomenclatura

Tabelas do projeto Vistorias começam com `VST_`; as do projeto Site, com `SIT_`. Mesmo padrão do site: `ID_` identificador, `NM_` nome, `DS_` descrição ou texto livre, `DT_` data ou data e hora, `HR_` hora, `VL_` valor (dinheiro, coordenada), `QTDE_` quantidade, `NO_` número (ordem, versão), `CD_` código, `TP_` lista fixa, valores em MAIÚSCULAS, `SG_` sim/não (boolean). Restrições com o nome completo da tabela: `PK_VST_VISTORIA`, `FK_<FILHA>_<PAI>`, `UQ_`, `CK_`, `EX_`, `IX_`. Os campos não levam o prefixo da tabela.

## `SIT_UNIDADE` (SITE · COMUM)

Tabela do site. O chalé é o elo entre os dois produtos: vendido pelo site e vistoriado pelo app. Os campos novos (+) guardam a situação operacional, o QR da porta e o ponto de GPS.

- **Ligada a:** SIT_BLOQUEIO, SIT_PROPRIEDADE, SIT_RESERVA, VST_AMBIENTE, VST_OCORRENCIA, VST_VISTORIA
- **Acesso (RLS):** Leitura por acesso à pousada; situação muda só pela função; GESTOR e ADMIN cadastram.
- **Regras:** Campos novos (+) acrescentados à tabela do site; TP_UNIDADE e SG_ATIVO valem para os dois produtos. TP_SITUACAO: EM_LIMPEZA, LIBERADO, OCUPADO, BLOQUEADO ou MANUTENCAO. Só muda pela função alterar_situacao_unidade (grava VST_LOG_EVENTO). CD_HASH_QR único; rotacionar soma 1 em NO_VERSAO_QR. Latitude e longitude vêm juntas ou ficam vazias juntas.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (A Casa do Mirante) |
|---|---|---|---|---|---|
| `ID_UNIDADE` | `bigint` | auto | PK | Identificador do chalé, quarto ou suíte. | 1 |
| `ID_PROPRIEDADE` | `bigint` | sim | FK | Pousada dona da unidade. | 1 |
| `CD_UNIDADE` | `text` | sim | — | Código curto (ex.: casa-do-mirante), também usado no site. | casa-do-mirante |
| `NM_UNIDADE` | `text` | sim | — | Nome exibido. | Casa do Mirante |
| `TP_UNIDADE` | `text` | sim | — | CHALE, QUARTO ou SUITE. | CHALE |
| `QTDE_MAX_HOSPEDES` | `smallint` | sim | — | Total de pessoas, contando adultos, crianças e bebês. | 4 |
| `QTDE_MAX_ADULTOS` | `smallint` | sim | — | Máximo de adultos (14 anos ou mais). | 2 |
| `QTDE_MAX_CRIANCAS` | `smallint` | sim | — | Máximo de crianças e bebês somados (sofá-cama). | 2 |
| `VL_TAXA_LIMPEZA` | `numeric(10,2)` | sim | — | Taxa única por estadia; hoje R$ 0 (em avaliação). | R$ 0,00 |
| `SG_ATIVO` | `boolean` | sim | — | Unidade inativa some da venda e da agenda de vistorias. | sim |
| `NO_ORDEM` | `smallint` | sim | — | Ordem de exibição quando houver mais de um chalé. | 0 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando o cadastro foi criado. | 01/11/2026 09:05 |
| `DS_ANDAR` **+ novo** | `text` | não | — | Andar ou bloco, para o assessor se localizar. | Térreo |
| `TP_VALIDACAO` **+ novo** | `text` | não | — | Validação desta unidade (QR, GPS ou QR_E_GPS); vazio herda da propriedade. | vazio |
| `VL_LATITUDE` **+ novo** | `numeric(9,6)` | não | — | Ponto da unidade; vazio usa o da propriedade. | -19.0849 |
| `VL_LONGITUDE` **+ novo** | `numeric(9,6)` | não | — | Longitude da unidade. | -43.5969 |
| `QTDE_RAIO_METROS` **+ novo** | `smallint` | não | — | Raio próprio; vazio usa o da propriedade. | 60 |
| `TP_SITUACAO` **+ novo** | `text` | sim | — | EM_LIMPEZA, LIBERADO, OCUPADO, BLOQUEADO ou MANUTENCAO. | MANUTENCAO |
| `CD_HASH_QR` **+ novo** | `text` | sim | UQ | Hash do código impresso no QR da porta. | b7e2c91f4a6d |
| `NO_VERSAO_QR` **+ novo** | `smallint` | sim | — | Versão do QR; rotacionar invalida as etiquetas antigas. | 1 |
| `DT_ATUALIZACAO` **+ novo** | `timestamptz` | sim | — | Última mudança de situação ou de QR. | 26/12/2026 15:21 |

## `SIT_PROPRIEDADE` (SITE · COMUM)

Tabela do site. A pousada: os horários de check-in e check-out montam a agenda; os campos novos (+) guardam a regra de presença (QR, GPS, raio).

- **Ligada a:** SIT_UNIDADE, VST_LOG_EVENTO, VST_USUARIO_PROPRIEDADE
- **Acesso (RLS):** Todos leem as pousadas a que têm acesso; ADMIN altera.
- **Regras:** Campos novos (+) são acrescentados à tabela do site; nada existente muda. TP_VALIDACAO: QR, GPS ou QR_E_GPS. Raio entre 10 e 1.000 m; precisão máxima entre 5 e 500 m. Substitui a antiga tabela CONFIGURACAO: os parâmetros ficam na pousada.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (A pousada) |
|---|---|---|---|---|---|
| `ID_PROPRIEDADE` | `bigint` | auto | PK | Identificador da pousada. | 1 |
| `NM_PROPRIEDADE` | `text` | sim | — | Nome da pousada. | Solar do Espinhaço |
| `DS_FUSO_HORARIO` | `text` | sim | — | Fuso usado para "hoje", check-in e prazos (America/Sao_Paulo). | America/Sao_Paulo |
| `HR_CHECKIN` | `time` | sim | — | Horário de entrada: base da agenda de vistorias de Entrada. | 15:00 |
| `HR_CHECKOUT` | `time` | sim | — | Horário de saída: base da agenda de vistorias de Saída. | 12:00 |
| `NO_IDADE_MAX_BEBE` | `smallint` | sim | — | Até esta idade é bebê: não paga, mas ocupa vaga de criança. | 1 |
| `NO_IDADE_MAX_CRIANCA` | `smallint` | sim | — | Até esta idade é criança; acima disso conta como adulto. | 13 |
| `QTDE_MAX_NOITES` | `smallint` | sim | — | Estadia máxima vendida pelo site. | 7 |
| `VL_PERCENTUAL_SINAL` | `numeric(5,2)` | sim | — | Percentual do total pago na hora de reservar. | 50% |
| `QTDE_MINUTOS_PRE_RESERVA` | `smallint` | sim | — | Tempo que as datas ficam seguras enquanto o hóspede paga o sinal. | 30 |
| `QTDE_DIAS_LIMITE_REMARCACAO` | `smallint` | sim | — | Remarcação permitida até N dias antes do check-in. | 7 |
| `QTDE_MESES_VALIDADE_CREDITO` | `smallint` | sim | — | Prazo para usar o crédito do sinal numa nova data. | 12 |
| `QTDE_DIAS_ARREPENDIMENTO` | `smallint` | sim | — | Dias para desistir com reembolso integral (CDC art. 49). | 7 |
| `NO_VERSAO_POLITICA` | `smallint` | sim | — | Versão vigente da política de cancelamento; vai para a reserva no aceite. | 1 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando o cadastro foi criado. | 01/11/2026 09:00 |
| `TP_VALIDACAO` **+ novo** | `text` | sim | — | Como a presença do assessor é validada por padrão: QR, GPS ou QR_E_GPS. | QR_E_GPS |
| `VL_LATITUDE` **+ novo** | `numeric(9,6)` | não | — | Latitude da sede, centro do raio de presença. | -19.0847 |
| `VL_LONGITUDE` **+ novo** | `numeric(9,6)` | não | — | Longitude da sede. | -43.5967 |
| `QTDE_RAIO_METROS` **+ novo** | `smallint` | sim | — | Raio aceito em volta do ponto (padrão 100 m). | 100 |
| `QTDE_PRECISAO_MAX_METROS` **+ novo** | `smallint` | sim | — | Pior precisão de GPS aceita (padrão 50 m). | 50 |
| `QTDE_MINUTOS_MIN_VISTORIA` **+ novo** | `smallint` | sim | — | Duração mínima esperada; abaixo disso a vistoria é sinalizada. | 10 |

## `SIT_RESERVA` (SITE · COMUM)

Tabela do site, só leitura para a vistoria. Reservas CONFIRMADA viram a agenda de Entrada (check-in) e Saída (check-out).

- **Ligada a:** SIT_UNIDADE, VST_VISTORIA
- **Acesso (RLS):** Leitura para GESTOR e ADMIN e para o assessor na agenda do dia; escrita só do site.
- **Regras:** A vistoria só lê: status, datas e unidade. Entrada no dia DT_CHECKIN, Saída no dia DT_CHECKOUT. Estadias do Airbnb e do Booking não estão aqui: chegam como SIT_BLOQUEIO CANAL_EXTERNO.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (1 · Confirmada no site) |
|---|---|---|---|---|---|
| `ID_RESERVA` | `bigint` | auto | PK | Identificador da estadia vendida. | 1 |
| `CD_RESERVA` | `text` | sim | — | Código mostrado ao hóspede (SE-XXXXXXXX). | SE-7F3A2C1D |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade reservada. | 1 |
| `ID_HOSPEDE` | `bigint` | não | FK | Quem reservou; vazio só enquanto a pré-reserva não foi paga. | 1 |
| `DT_CHECKIN` | `date` | sim | — | Dia da entrada: gera a vistoria de Entrada na agenda. | 23/12/2026 |
| `DT_CHECKOUT` | `date` | sim | — | Dia da saída: gera a vistoria de Saída na agenda. | 26/12/2026 |
| `QTDE_ADULTOS` | `smallint` | sim | — | Adultos (14 anos ou mais). | 2 |
| `QTDE_CRIANCAS` | `smallint` | sim | — | Crianças de 2 a 13 anos (pagam VL_CRIANCA). | 1 |
| `QTDE_BEBES` | `smallint` | sim | — | Bebês até 1 ano: ocupam vaga de criança, não pagam. | 1 |
| `TP_STATUS` | `text` | sim | — | Só reservas CONFIRMADA entram na agenda de vistorias. | CONFIRMADA |
| `TP_CANAL` | `text` | sim | — | Por onde entrou: SITE, DIRETO ou TELEFONE. | SITE |
| `VL_HOSPEDAGEM` | `numeric(10,2)` | sim | — | Soma das noites, congelada no momento da reserva. | R$ 6.500,00 |
| `VL_TAXA_LIMPEZA` | `numeric(10,2)` | sim | — | Taxa de limpeza congelada na reserva. | R$ 0,00 |
| `VL_TOTAL` | `numeric(10,2)` | gerado | — | Hospedagem + limpeza (calculado pelo banco). | R$ 6.500,00 |
| `VL_SINAL` | `numeric(10,2)` | sim | — | Parte paga ao reservar (50%). | R$ 3.250,00 |
| `VL_SALDO` | `numeric(10,2)` | gerado | — | Total − sinal, pago no check-in (calculado pelo banco). | R$ 3.250,00 |
| `DS_DETALHE_PRECOS` | `jsonb` | sim | — | Preço noite a noite, com tarifa, criança e bebê (JSON). | 3 noites: 2.000,00 + 2.500,00 + 2.000,00 |
| `DT_EXPIRA` | `timestamptz` | não | — | Até quando a pré-reserva segura as datas. | vazio |
| `ID_RESERVA_ORIGINAL` | `bigint` | não | FK | Em remarcação, a reserva antiga que deu origem a esta. | vazio |
| `TP_MOTIVO_CANCELAMENTO` | `text` | não | — | Por que foi cancelada; obrigatório só se CANCELADA. | vazio |
| `NO_VERSAO_POLITICA` | `smallint` | não | — | Versão da política que o hóspede aceitou. | 1 |
| `DT_ACEITE_POLITICA` | `timestamptz` | não | — | Quando o hóspede marcou o aceite no site. | 18/11/2026 10:12 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando a reserva foi criada. | 18/11/2026 10:12 |
| `DT_ATUALIZACAO` | `timestamptz` | sim | — | Última mudança (status, pagamento). | 18/11/2026 10:19 |

## `SIT_BLOQUEIO` (SITE · COMUM)

Tabela do site. Uma ocorrência crítica cria aqui um bloqueio MANUTENCAO, que tira as datas da venda no site e nos canais (iCal).

- **Ligada a:** SIT_UNIDADE, VST_OCORRENCIA
- **Acesso (RLS):** Leitura por acesso à pousada; criado e encerrado pelas funções da vistoria.
- **Regras:** Ocorrência crítica cria bloqueio MANUTENCAO a partir de hoje, com prazo provisório de 7 dias (DT_FIM precisa ser depois de DT_INI). Liberar a unidade encerra o bloqueio (DT_FIM = amanhã). Reserva confirmada que já existe não é cancelada: o painel avisa o conflito. Nenhum campo novo: o vínculo fica em VST_OCORRENCIA.ID_BLOQUEIO.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Manutenção marcada pela equipe) |
|---|---|---|---|---|---|
| `ID_BLOQUEIO` | `bigint` | auto | PK | Identificador do bloqueio. | 2 |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade fora da venda. | 1 |
| `DT_INI` | `date` | sim | — | Primeira noite bloqueada. | 01/03/2027 |
| `DT_FIM` | `date` | sim | — | Dia seguinte à última noite; liberar a unidade encerra aqui. | 04/03/2027 |
| `TP_MOTIVO` | `text` | sim | — | A vistoria cria bloqueios MANUTENCAO; CANAL_EXTERNO são estadias do Airbnb/Booking. | MANUTENCAO |
| `ID_CALENDARIO` | `bigint` | não | FK | De qual calendário veio (só CANAL_EXTERNO). | vazio |
| `CD_EXTERNO` | `text` | não | — | Id do evento no iCal, para não importar duas vezes. | vazio |
| `DS_OBSERVACAO` | `text` | não | — | Resumo da ocorrência que motivou o bloqueio. | Pintura do deck |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando foi criado ou importado. | 12/11/2026 11:30 |

## `VST_VISTORIA` (OPERAÇÃO)

Uma vistoria feita no celular: quem, onde, quando, presença validada, reserva e situação em que a unidade ficou.

- **Ligada a:** SIT_RESERVA, SIT_UNIDADE, VST_RESPOSTA, VST_TIPO_VISTORIA, VST_USUARIO
- **Acesso (RLS):** Assessor lê as próprias; GESTOR e ADMIN leem as da pousada; insere só enviar_vistoria.
- **Regras:** Id uuid v7 gerado no celular: reenviar não duplica. DT_FIM ≥ DT_INICIO. TP_STATUS: ENVIADA ou SINALIZADA; SINALIZADA exige DS_SINALIZACOES. Saída com SG_EXIGE_ENTRADA aponta a Entrada em ID_VISTORIA_ENTRADA. ID_RESERVA só aceita reserva da mesma unidade. Gravada só pela função enviar_vistoria.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Entrada de 23/12) |
|---|---|---|---|---|---|
| `ID_VISTORIA` | `uuid` | sim | PK | uuid v7 gerado no celular: funciona offline sem duplicar. | 0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e01 |
| `ID_VISTORIA_ENTRADA` | `uuid` | não | FK | Na Saída, a Entrada da mesma estadia (comparação). | vazio |
| `ID_USUARIO` | `uuid` | sim | FK | Assessor que fez. | 0192f3a0-6c1e-7b3a-9d11-5a2e4c6b8f01 |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade vistoriada. | 1 |
| `ID_TIPO_VISTORIA` | `bigint` | sim | FK | Tipo aplicado. | 1 |
| `ID_RESERVA` | `bigint` | não | FK | Estadia do site; vazio em rotina e em estadias de canal. | 1 |
| `TP_VALIDACAO` | `text` | sim | — | Validação usada: QR, GPS ou QR_E_GPS. | QR_E_GPS |
| `DT_INICIO` | `timestamptz` | sim | — | Início no celular. | 23/12/2026 14:40 |
| `DT_FIM` | `timestamptz` | sim | — | Fim no celular. | 23/12/2026 14:52 |
| `DT_RECEBIMENTO` | `timestamptz` | sim | — | Chegada ao servidor (pode ser bem depois, se offline). | 23/12/2026 14:52 |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | Posição no início. | -19.085 |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | Posição no início. | -43.597 |
| `QTDE_PRECISAO_METROS` | `smallint` | não | — | Precisão do GPS. | 8 |
| `QTDE_DISTANCIA_METROS` | `integer` | não | — | Distância até o ponto da unidade. | 14 |
| `SG_FORA_RAIO` | `boolean` | sim | — | Começou fora do raio aceito. | não |
| `TP_STATUS` | `text` | sim | — | ENVIADA ou SINALIZADA (algo fora do padrão). | ENVIADA |
| `DS_SINALIZACOES` | `text[]` | não | — | Motivos: FORA_RAIO, RAPIDA, GPS_IMPRECISO, SEM_ENTRADA… | vazio |
| `DS_ASSINATURA` | `text` | não | — | Caminho no Storage da assinatura. | vazio |
| `TP_SITUACAO_RESULTANTE` | `text` | sim | — | Situação em que a unidade ficou (LIBERADO, MANUTENCAO…). | OCUPADO |
| `DS_OBSERVACAO` | `text` | não | — | Observação geral. | vazio |

## `VST_RESPOSTA` (OPERAÇÃO)

A resposta de cada item: OK, PROBLEMA ou não se aplica.

- **Ligada a:** VST_FOTO, VST_ITEM, VST_OCORRENCIA, VST_VISTORIA
- **Acesso (RLS):** Mesma regra da vistoria.
- **Regras:** Chave composta: uma resposta por item na vistoria. TP_RESPOSTA: OK, PROBLEMA ou NAO_SE_APLICA. PROBLEMA exige DS_OBSERVACAO.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Torneira com problema na saída) |
|---|---|---|---|---|---|
| `ID_VISTORIA` | `uuid` | sim | PK FK | Vistoria. | 0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e02 |
| `ID_ITEM` | `bigint` | sim | PK FK | Item conferido. | 3 |
| `TP_RESPOSTA` | `text` | sim | — | OK, PROBLEMA ou NAO_SE_APLICA. | PROBLEMA |
| `QTDE_ENCONTRADA` | `smallint` | não | — | Contagem, quando o item tem quantidade. | vazio |
| `DS_OBSERVACAO` | `text` | não | — | Obrigatória quando PROBLEMA. | Torneira pingando sem parar; pia molhada. |
| `DT_RESPOSTA` | `timestamptz` | sim | — | Momento no celular. | 26/12/2026 15:10 |

## `VST_OCORRENCIA` (OPERAÇÃO)

Problema encontrado que precisa de tratamento; pode tirar a unidade da venda.

- **Ligada a:** SIT_BLOQUEIO, SIT_UNIDADE, VST_RESPOSTA
- **Acesso (RLS):** Leitura por acesso à pousada; GESTOR e ADMIN tratam.
- **Regras:** Nasce de uma resposta PROBLEMA (FK composta ID_VISTORIA + ID_ITEM). TP_GRAVIDADE: BAIXA, MEDIA ou CRITICA; item crítico abre CRITICA. TP_STATUS: ABERTA, EM_TRATAMENTO, RESOLVIDA ou CANCELADA; RESOLVIDA exige DT_RESOLUCAO. ID_BLOQUEIO preenchido quando a unidade sai da venda.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Torneira vazando) |
|---|---|---|---|---|---|
| `ID_OCORRENCIA` | `bigint` | auto | PK | Sequencial. | 1 |
| `ID_VISTORIA` | `uuid` | sim | FK | Vistoria de origem. | 0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e02 |
| `ID_ITEM` | `bigint` | sim | FK | Item com problema. | 3 |
| `ID_UNIDADE` | `bigint` | sim | FK | Copiado da vistoria: filtra o painel por unidade. | 1 |
| `ID_BLOQUEIO` | `bigint` | não | FK | Bloqueio MANUTENCAO criado no site, quando houver. | 3 |
| `TP_GRAVIDADE` | `text` | sim | — | BAIXA, MEDIA ou CRITICA. | CRITICA |
| `TP_STATUS` | `text` | sim | — | ABERTA, EM_TRATAMENTO, RESOLVIDA ou CANCELADA. | EM_TRATAMENTO |
| `DS_OCORRENCIA` | `text` | sim | — | O que foi encontrado. | Torneira do banheiro vazando. |
| `DS_TRATAMENTO` | `text` | não | — | O que a gestão fez. | Encanador agendado para 28/12. |
| `DT_ABERTURA` | `timestamptz` | sim | — | Abertura. | 26/12/2026 15:21 |
| `DT_RESOLUCAO` | `timestamptz` | não | — | Exigida quando RESOLVIDA. | vazio |

## `VST_FOTO` (OPERAÇÃO)

Evidência de uma resposta, com local e horário da câmera.

- **Ligada a:** VST_RESPOSTA
- **Acesso (RLS):** Mesma regra da vistoria; o arquivo sai por link assinado.
- **Regras:** Aponta a resposta pela FK composta (ID_VISTORIA + ID_ITEM). Arquivo em bucket privado; CD_ARQUIVO único.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Foto 1 da torneira) |
|---|---|---|---|---|---|
| `ID_FOTO` | `uuid` | sim | PK | uuid v7 gerado no celular. | 0193c9e8-5f6a-7b7c-8d9e-1f2a3b4c5d01 |
| `ID_VISTORIA` | `uuid` | sim | FK | Vistoria (com ID_ITEM, aponta a resposta). | 0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e02 |
| `ID_ITEM` | `bigint` | sim | FK | Item fotografado. | 3 |
| `CD_ARQUIVO` | `text` | sim | UQ | Caminho no Storage (bucket privado). | vistorias/2026/12/0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e02/torneira-1.jpg |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | Onde foi tirada. | -19.0851 |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | Onde foi tirada. | -43.5971 |
| `QTDE_PRECISAO_METROS` | `smallint` | não | — | Precisão do GPS. | 9 |
| `SG_FORA_RAIO` | `boolean` | sim | — | Tirada fora do raio. | não |
| `DT_CAPTURA` | `timestamptz` | sim | — | Momento da câmera, não do envio. | 26/12/2026 15:11 |

## `VST_AMBIENTE` (CADASTRO)

Cômodos de cada unidade, na ordem em que o assessor percorre.

- **Ligada a:** SIT_UNIDADE, VST_ITEM
- **Acesso (RLS):** Leitura por acesso à pousada; GESTOR e ADMIN mantêm.
- **Regras:** Nome único por unidade. NO_ORDEM define a ordem do checklist.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Sala) |
|---|---|---|---|---|---|
| `ID_AMBIENTE` | `bigint` | auto | PK | Sequencial. | 1 |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade do cômodo. | 1 |
| `NM_AMBIENTE` | `text` | sim | — | Sala, Quarto, Banheiro, Varanda… | Sala |
| `NO_ORDEM` | `smallint` | sim | — | Ordem de passagem no checklist. | 1 |
| `DS_FOTO_REFERENCIA` | `text` | não | — | Caminho no Storage da foto de como deve ficar. | ambientes/1/sala.jpg |
| `SG_ATIVO` | `boolean` | sim | — | Inativo sai do checklist. | sim |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. | 20/11/2026 10:00 |

## `VST_ITEM` (CADASTRO)

O que se confere em cada cômodo: crítico, foto obrigatória e quantidade esperada.

- **Ligada a:** VST_AMBIENTE, VST_RESPOSTA, VST_TIPO_VISTORIA_ITEM
- **Acesso (RLS):** Leitura por acesso à pousada; GESTOR e ADMIN mantêm.
- **Regras:** Nome único por cômodo. QTDE_ESPERADA ≥ 0 quando informada.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Item crítico) |
|---|---|---|---|---|---|
| `ID_ITEM` | `bigint` | auto | PK | Sequencial. | 3 |
| `ID_AMBIENTE` | `bigint` | sim | FK | Cômodo onde o item é conferido. | 3 |
| `NM_ITEM` | `text` | sim | — | Ex.: Toalhas de banho, Frigobar. | Torneira e pia |
| `DS_ORIENTACAO` | `text` | não | — | Como conferir. | Abrir e fechar; ver se pinga ou vaza. |
| `SG_CRITICO` | `boolean` | sim | — | Problema em item crítico abre ocorrência CRITICA. | sim |
| `SG_FOTO_OBRIGATORIA` | `boolean` | sim | — | Exige foto mesmo quando está OK. | sim |
| `QTDE_ESPERADA` | `smallint` | não | — | Quantidade que deve haver (contagem). | vazio |
| `NO_ORDEM` | `smallint` | sim | — | Ordem dentro do cômodo. | 1 |
| `SG_ATIVO` | `boolean` | sim | — | Inativo sai do checklist. | sim |

## `VST_TIPO_VISTORIA` (APOIO)

Entrada, Saída, Rotina e Manutenção, com as regras de cada uma.

- **Ligada a:** VST_TIPO_VISTORIA_ITEM, VST_VISTORIA
- **Acesso (RLS):** Todos leem; ADMIN mantém.
- **Regras:** TP_COMPORTAMENTO: ENTRADA, SAIDA, ROTINA ou MANUTENCAO. TP_PERIODICIDADE só para ROTINA: DIARIA, SEMANAL ou MENSAL.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Entrada) |
|---|---|---|---|---|---|
| `ID_TIPO_VISTORIA` | `bigint` | auto | PK | Sequencial. | 1 |
| `NM_TIPO_VISTORIA` | `text` | sim | UQ | Entrada, Saída, Rotina, Manutenção… | Entrada |
| `TP_COMPORTAMENTO` | `text` | sim | — | ENTRADA, SAIDA, ROTINA ou MANUTENCAO: regra que o app aplica. | ENTRADA |
| `TP_PERIODICIDADE` | `text` | não | — | DIARIA, SEMANAL ou MENSAL (só rotina). | vazio |
| `SG_EXIGE_ENTRADA` | `boolean` | sim | — | Saída exige a vistoria de Entrada da mesma estadia. | não |
| `SG_EXIGE_ASSINATURA` | `boolean` | sim | — | Pede assinatura no fim. | não |
| `SG_ATIVO` | `boolean` | sim | — | Inativo some da lista. | sim |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. | 20/11/2026 10:10 |

## `VST_TIPO_VISTORIA_ITEM` (APOIO)

Quais itens entram em cada tipo de vistoria (o checklist de cada tipo).

- **Ligada a:** VST_ITEM, VST_TIPO_VISTORIA
- **Acesso (RLS):** Todos leem; GESTOR e ADMIN mantêm.
- **Regras:** Chave composta: o item entra uma vez em cada tipo.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Saída confere a torneira) |
|---|---|---|---|---|---|
| `ID_TIPO_VISTORIA` | `bigint` | sim | PK FK | Tipo de vistoria. | 2 |
| `ID_ITEM` | `bigint` | sim | PK FK | Item que entra nesse tipo. | 3 |
| `NO_ORDEM` | `smallint` | não | — | Ordem própria do tipo; vazio segue a do item. | 1 |

## `VST_USUARIO` (ACESSO)

Quem usa o sistema: assessores no app, gestores e administradores no painel. O mesmo cadastro serve à gestão do site.

- **Ligada a:** VST_LOG_EVENTO, VST_USUARIO_PROPRIEDADE, VST_VISTORIA
- **Acesso (RLS):** Cada um lê o próprio; GESTOR lê a equipe; ADMIN cadastra.
- **Regras:** ID_USUARIO = auth.users.id (login do Supabase Auth). CD_LOGIN e CD_CPF únicos; CPF com 11 números e dígitos válidos. TP_PERFIL: ASSESSOR, GESTOR ou ADMIN. Inativo não entra (checado no login e nas regras de acesso).

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Assessora) |
|---|---|---|---|---|---|
| `ID_USUARIO` | `uuid` | sim | PK | Mesmo id do login no Supabase Auth (auth.users). | 0192f3a0-6c1e-7b3a-9d11-5a2e4c6b8f01 |
| `NM_USUARIO` | `text` | sim | — | Nome completo. | Marina Lopes |
| `CD_LOGIN` | `text` | sim | UQ | Usuário de acesso (ex.: ana.souza), minúsculo. | marina.lopes |
| `CD_CPF` | `text` | não | UQ | CPF só com números; também serve para entrar. | 39053344705 |
| `TP_PERFIL` | `text` | sim | — | ASSESSOR (campo), GESTOR ou ADMIN (gestão). | ASSESSOR |
| `SG_ATIVO` | `boolean` | sim | — | Inativo não entra no app. | sim |
| `DT_ACEITE_LGPD` | `timestamptz` | não | — | Aceite do termo de uso de localização e fotos. | 20/11/2026 09:30 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. | 20/11/2026 09:00 |
| `DT_ATUALIZACAO` | `timestamptz` | sim | — | Última alteração. | 20/11/2026 09:30 |

## `VST_USUARIO_PROPRIEDADE` (ACESSO)

Quais pousadas cada usuário vê. É a base das regras de acesso (RLS) de todas as tabelas.

- **Ligada a:** SIT_PROPRIEDADE, VST_USUARIO
- **Acesso (RLS):** ADMIN mantém; cada um lê os próprios acessos.
- **Regras:** Chave composta: um acesso por usuário e pousada. ADMIN vê todas; os demais só as listadas aqui.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Marina na pousada) |
|---|---|---|---|---|---|
| `ID_USUARIO` | `uuid` | sim | PK FK | Usuário. | 0192f3a0-6c1e-7b3a-9d11-5a2e4c6b8f01 |
| `ID_PROPRIEDADE` | `bigint` | sim | PK FK | Pousada que ele pode ver. | 1 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando o acesso foi dado. | 20/11/2026 09:10 |

## `VST_LOG_EVENTO` (ACESSO)

Auditoria: quem fez o quê e quando (login, envio, mudança de situação, rotação de QR, cadastros).

- **Ligada a:** SIT_PROPRIEDADE, VST_USUARIO
- **Acesso (RLS):** GESTOR e ADMIN leem; só funções inserem.
- **Regras:** Só inserção: ninguém altera nem apaga. Gravado pelas funções do banco, não pelo app.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Envio de vistoria) |
|---|---|---|---|---|---|
| `ID_LOG_EVENTO` | `bigint` | auto | PK | Sequencial. | 1 |
| `ID_USUARIO` | `uuid` | não | FK | Quem fez; vazio para eventos do sistema. | 0192f3a0-6c1e-7b3a-9d11-5a2e4c6b8f01 |
| `ID_PROPRIEDADE` | `bigint` | não | FK | Pousada afetada. | 1 |
| `TP_EVENTO` | `text` | sim | — | LOGIN, VISTORIA_ENVIADA, SITUACAO_ALTERADA, QR_ROTACIONADO, CADASTRO… | VISTORIA_ENVIADA |
| `NM_ENTIDADE` | `text` | não | — | Tabela afetada. | VST_VISTORIA |
| `CD_REGISTRO` | `text` | não | — | Id do registro afetado. | 0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e02 |
| `DS_EVENTO` | `text` | sim | — | Frase legível para a tela de auditoria. | Marina Lopes enviou a vistoria de Saída da Casa do Mirante |
| `DS_DADOS` | `jsonb` | não | — | Antes e depois, quando houver. | vazio |
| `DT_EVENTO` | `timestamptz` | sim | — | Momento do evento. | 26/12/2026 15:21 |

## Ligações

| Filha | Campo | Pai | Obrigatória | Leitura |
|---|---|---|---|---|
| `SIT_UNIDADE` | `ID_PROPRIEDADE` | `SIT_PROPRIEDADE` | sim | pertence a |
| `SIT_RESERVA` | `ID_UNIDADE` | `SIT_UNIDADE` | sim | reserva |
| `SIT_BLOQUEIO` | `ID_UNIDADE` | `SIT_UNIDADE` | sim | bloqueia |
| `VST_OCORRENCIA` | `ID_VISTORIA` + `ID_BLOQUEIO` | `SIT_BLOQUEIO` | não | tira da venda |
| `VST_USUARIO_PROPRIEDADE` | `ID_USUARIO` | `VST_USUARIO` | sim | acessa |
| `VST_USUARIO_PROPRIEDADE` | `ID_PROPRIEDADE` | `SIT_PROPRIEDADE` | sim | acesso a |
| `VST_AMBIENTE` | `ID_UNIDADE` | `SIT_UNIDADE` | sim | cômodo de |
| `VST_ITEM` | `ID_AMBIENTE` | `VST_AMBIENTE` | sim | conferido em |
| `VST_TIPO_VISTORIA_ITEM` | `ID_TIPO_VISTORIA` | `VST_TIPO_VISTORIA` | sim | compõe |
| `VST_TIPO_VISTORIA_ITEM` | `ID_ITEM` | `VST_ITEM` | sim | inclui |
| `VST_VISTORIA` | `ID_UNIDADE` | `SIT_UNIDADE` | sim | vistoria de |
| `VST_VISTORIA` | `ID_TIPO_VISTORIA` | `VST_TIPO_VISTORIA` | sim | do tipo |
| `VST_VISTORIA` | `ID_USUARIO` | `VST_USUARIO` | sim | feita por |
| `VST_VISTORIA` | `ID_VISTORIA_ENTRADA` | `VST_VISTORIA` | não | entrada de |
| `VST_VISTORIA` | `ID_RESERVA` | `SIT_RESERVA` | não | da estadia |
| `VST_RESPOSTA` | `ID_VISTORIA` | `VST_VISTORIA` | sim | responde |
| `VST_RESPOSTA` | `ID_ITEM` | `VST_ITEM` | sim | sobre |
| `VST_FOTO` | `ID_VISTORIA` + `ID_ITEM` | `VST_RESPOSTA` | sim | evidência de |
| `VST_OCORRENCIA` | `ID_VISTORIA` + `ID_ITEM` | `VST_RESPOSTA` | sim | nasce de |
| `VST_OCORRENCIA` | `ID_VISTORIA` + `ID_UNIDADE` | `SIT_UNIDADE` | sim | na unidade |
| `VST_LOG_EVENTO` | `ID_USUARIO` | `VST_USUARIO` | não | por |
| `VST_LOG_EVENTO` | `ID_PROPRIEDADE` | `SIT_PROPRIEDADE` | não | em |

`VST_USUARIO.ID_USUARIO` também referencia `auth.users` (Supabase Auth).
