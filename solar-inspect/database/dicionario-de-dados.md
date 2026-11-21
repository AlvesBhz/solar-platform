# Dicionário de dados — Vistorias

Integrado ao banco de reservas do site (mesmo Supabase, esquema `public`): 16 tabelas, 4 delas do site (`SIT_`), e 22 ligações. Diagrama em [`der.html`](./der.html). proposta v3, 20/11/2026.

Gerado por `tools/gerar-der.py`, que lê as tabelas do site em `site/database/schema.sql` e os textos em `site/database/gerar_der.py`.

## Integração com o site

- **Cadastro único.** SIT_PROPRIEDADE e SIT_UNIDADE são as tabelas do site, no mesmo schema "SE". A vistoria não acrescenta nenhuma coluna a elas: o que precisa fica em VST_PROPRIEDADE e VST_UNIDADE (1 para 1).
- **Reserva vira agenda.** Quando o site confirma o sinal (confirmar_sinal), cria a vistoria de Entrada (DT_CHECKIN) e a de Saída (DT_CHECKOUT), AGENDADA e sem responsável. Reserva remarcada: as AGENDADAS acompanham a reserva nova. Reserva cancelada: as AGENDADAS viram CANCELADA.
- **Saída ligada à estadia.** VST_VISTORIA.ID_RESERVA liga a vistoria à estadia do site. Estadias do Airbnb e do Booking chegam como SIT_BLOQUEIO CANAL_EXTERNO, sem reserva: nesse caso o campo fica vazio.
- **Manutenção tira da venda.** Ocorrência crítica cria um SIT_BLOQUEIO MANUTENCAO, só por função security definer. A consultar_disponibilidade do site e o iCal dos canais já respeitam SIT_BLOQUEIO: as datas saem da venda sem mudar nada no site. O bloqueio nasce com prazo provisório de 7 dias e é encurtado quando a unidade é liberada.
- **Liberar devolve à venda.** Ao resolver a ocorrência e liberar a unidade, o bloqueio aberto é encerrado (DT_FIM = amanhã) e as datas voltam a ficar disponíveis.
- **Acesso e login.** Os funcionários (vistoria, limpeza, manutenção, gestão) entram por usuário ou CPF e senha, pela Edge Function login-vistoria; o ADMIN os cadastra no app pela Edge Function criar-usuario. VST_USUARIO.ID_USUARIO = auth.users.id. O app usa só a chave publicável e a sessão do usuário, e lê reservas e chalés por funções que nunca devolvem CPF, passaporte nem telefone.
- **Situação do chalé.** A vistoria mantém a situação sozinha: Entrada concluída → OCUPADO, Saída concluída → EM_LIMPEZA, item crítico com problema → MANUTENCAO. Depois da limpeza, a equipe libera. O site continua decidindo a venda só por reservas e bloqueios.
- **Conflito.** Um bloqueio não cancela reserva confirmada que já existe: o painel avisa o gestor para remanejar o hóspede.

## Como uma vistoria tira o chalé da venda

| Quando | O que acontece | Tabelas | Situação do chalé |
|---|---|---|---|
| 18/11 13:19 | O hóspede paga o sinal e o site confirma a reserva SE-7F3A2C1D. No mesmo momento cria as vistorias de Entrada (DT_AGENDADA = check-in) e de Saída (check-out), AGENDADA e sem responsável. | `SIT_RESERVA 1, VST_VISTORIA 1 e 2` | — |
| 23/12 14:40 | Marina assume a Entrada, lê o QR da porta e confere o GPS (14 m do ponto). A vistoria vira CONCLUIDA às 14:52 e o chalé passa a OCUPADO (regra padrão da Entrada). | `VST_VISTORIA 1` | OCUPADO |
| 26/12 12:00 | Check-out da reserva. A Saída está na agenda do dia (DT_AGENDADA = DT_CHECKOUT). | `SIT_RESERVA 1` | — |
| 26/12 15:05 | Marina inicia a Saída (vst_iniciar_vistoria): QR certo, GPS a 22 m, dentro do raio de 60 m. A vistoria passa a EM_ANDAMENTO e aponta a Entrada (ID_VISTORIA_ENTRADA = 1). | `VST_VISTORIA 2` | — |
| 26/12 15:10 | Em “Torneira e pia”, item crítico, responde PROBLEMA, descreve o defeito e tira 2 fotos (foto obrigatória). | `VST_RESPOSTA, VST_FOTO` | — |
| 26/12 15:21 | Conclui (vst_concluir_vistoria), com assinatura. A regra padrão da Saída seria EM_LIMPEZA, mas o item crítico manda: o banco abre a ocorrência 1 (CRITICA), cria o bloqueio 3 (MANUTENCAO, 26/12 a 02/01, prazo provisório) e muda o chalé. SIT_AUDITORIA registra cada gravação. | `VST_OCORRENCIA 1, SIT_BLOQUEIO 3` | MANUTENCAO |
| 26/12 15:22 | No site, consultar_disponibilidade já devolve essas noites como ocupadas e o iCal leva a mesma janela ao Airbnb e ao Booking. Nada muda no código do site. | `SIT_BLOQUEIO 3` | MANUTENCAO |
| 28/12 | O gestor resolve a ocorrência e libera o chalé (vst_resolver_ocorrencia). O bloqueio é encerrado (DT_FIM = 29/12) e as datas voltam à venda. | `VST_OCORRENCIA 1, SIT_BLOQUEIO 3` | LIBERADO |

## Nomenclatura

Tabelas do projeto Vistorias começam com `VST_`; as do projeto Site, com `SIT_`. Mesmo padrão do site: `ID_` identificador, `NM_` nome, `DS_` descrição ou texto livre, `DT_` data ou data e hora, `HR_` hora, `VL_` valor (dinheiro, coordenada), `QTDE_` quantidade, `NO_` número (ordem, versão), `CD_` código, `TP_` lista fixa, valores em MAIÚSCULAS, `SG_` sim/não (boolean). Restrições com o nome completo da tabela: `PK_VST_VISTORIA`, `FK_<FILHA>_<PAI>`, `UQ_`, `CK_`, `EX_`, `IX_`. Os campos não levam o prefixo da tabela.

## `SIT_UNIDADE` (SITE · COMUM)

Tabela do site, só leitura para a vistoria. O chalé é o elo entre os dois produtos: vendido pelo site e vistoriado pelo app. Situação, QR e ponto de GPS ficam em VST_UNIDADE.

- **Ligada a:** SIT_BLOQUEIO, SIT_PROPRIEDADE, SIT_RESERVA, VST_AMBIENTE, VST_OCORRENCIA, VST_UNIDADE, VST_VISTORIA
- **Acesso (RLS):** O app lê pelas funções vst_unidades e vst_agenda.
- **Regras:** A vistoria só lê o cadastro; TP_UNIDADE e SG_ATIVO valem para os dois produtos. Nenhuma coluna foi acrescentada pela vistoria: situação, QR e GPS estão em VST_UNIDADE.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (A Casa do Mirante) |
|---|---|---|---|---|---|
| `ID_UNIDADE` | `bigint` | auto | PK | Identificador do chalé, quarto ou suíte. | 1 |
| `ID_PROPRIEDADE` | `bigint` | sim | FK | Pousada dona da unidade. | 1 |
| `CD_UNIDADE` | `text` | sim | — | Código curto (ex.: casa-do-mirante), também usado no site. | casa-do-mirante |
| `NM_UNIDADE` | `text` | sim | — | Nome exibido. | Casa do Mirante |
| `TP_UNIDADE` | `text` | sim | — | CHALE, QUARTO ou SUITE. | CHALE |
| `QTDE_MAX_HOSPEDES` | `smallint` | sim | — | Total de pessoas, contando adultos e crianças de todas as idades. | 4 |
| `QTDE_MAX_ADULTOS` | `smallint` | sim | — | Máximo de adultos (14 anos ou mais). | 2 |
| `QTDE_MAX_CRIANCAS` | `smallint` | sim | — | Máximo de crianças somadas, de qualquer idade (sofá-cama). | 2 |
| `VL_TAXA_LIMPEZA` | `numeric(10,2)` | sim | — | Taxa única por estadia; hoje R$ 0 (em avaliação). | R$ 0,00 |
| `SG_ATIVO` | `boolean` | sim | — | Unidade inativa some da venda e da agenda de vistorias. | sim |
| `NO_ORDEM` | `smallint` | sim | — | Ordem de exibição quando houver mais de um chalé. | 0 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando o cadastro foi criado. | 01/11/2026 09:05 |

## `SIT_PROPRIEDADE` (SITE · COMUM)

Tabela do site, só leitura para a vistoria. A pousada: os horários de check-in e check-out montam a agenda. As regras de presença (GPS, raio) ficam em VST_PROPRIEDADE.

- **Ligada a:** SIT_UNIDADE, VST_PROPRIEDADE, VST_USUARIO_PROPRIEDADE
- **Acesso (RLS):** O app não lê a tabela; recebe o necessário pelas funções.
- **Regras:** A vistoria só lê: horários de check-in e check-out e o fuso. Nenhuma coluna foi acrescentada pela vistoria.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (A pousada) |
|---|---|---|---|---|---|
| `ID_PROPRIEDADE` | `bigint` | auto | PK | Identificador da pousada. | 1 |
| `NM_PROPRIEDADE` | `text` | sim | — | Nome da pousada. | Solar do Espinhaço |
| `DS_FUSO_HORARIO` | `text` | sim | — | Fuso usado para "hoje", check-in e prazos (America/Sao_Paulo). | America/Sao_Paulo |
| `HR_CHECKIN` | `time` | sim | — | Horário de entrada: base da agenda de vistorias de Entrada. | 15:00 |
| `HR_CHECKOUT` | `time` | sim | — | Horário de saída: base da agenda de vistorias de Saída. | 12:00 |
| `NO_IDADE_MAX_BEBE` | `smallint` | sim | — | Até esta idade a criança não paga (PC_BEBE), mas ocupa vaga. Hoje 4. | 4 |
| `NO_IDADE_MAX_CRIANCA_MENOR` | `smallint` | sim | — | Até esta idade paga PC_CRIANCA (hoje 5 a 8 anos). | 8 |
| `NO_IDADE_MAX_CRIANCA` | `smallint` | sim | — | Até esta idade é criança; acima disso conta como adulto. | 13 |
| `QTDE_MAX_NOITES` | `smallint` | sim | — | Estadia máxima vendida pelo site. | 7 |
| `VL_PERCENTUAL_SINAL` | `numeric(5,2)` | sim | — | Percentual do total cobrado como sinal; a equipe combina o pagamento depois da reserva. | 50% |
| `QTDE_MINUTOS_PRE_RESERVA` | `smallint` | sim | — | Tempo que as datas ficam seguras enquanto o hóspede preenche a reserva no site. | 30 |
| `QTDE_DIAS_LIMITE_REMARCACAO` | `smallint` | sim | — | Remarcação permitida até N dias antes do check-in. | 7 |
| `QTDE_MESES_VALIDADE_CREDITO` | `smallint` | sim | — | Prazo para usar o crédito do sinal numa nova data. | 12 |
| `QTDE_DIAS_ARREPENDIMENTO` | `smallint` | sim | — | Dias para desistir com reembolso integral (CDC art. 49). | 7 |
| `NO_VERSAO_POLITICA` | `smallint` | sim | — | Versão vigente da política de cancelamento; vai para a reserva no aceite. | 1 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando o cadastro foi criado. | 01/11/2026 09:00 |

## `SIT_RESERVA` (SITE · COMUM)

Tabela do site, só leitura para a vistoria. Reservas CONFIRMADA viram a agenda de Entrada (check-in) e Saída (check-out).

- **Ligada a:** SIT_UNIDADE, VST_VISTORIA
- **Acesso (RLS):** O app não lê a tabela; vst_agenda devolve só código e datas.
- **Regras:** A vistoria só lê: código, datas, unidade e status. Só CONFIRMADA gera vistoria; PENDENTE (pré-reserva de 30 minutos) não gera. Remarcada: a reserva nova aponta a antiga em ID_RESERVA_ORIGINAL e leva as vistorias AGENDADAS. O app nunca lê CPF, passaporte ou telefone: só código e datas, por função.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (1 · Confirmada no site) |
|---|---|---|---|---|---|
| `ID_RESERVA` | `bigint` | auto | PK | Identificador da estadia vendida. | 1 |
| `CD_RESERVA` | `text` | sim | — | Código mostrado ao hóspede (SE-XXXXXXXX). | SE-7F3A2C1D |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade reservada. | 1 |
| `ID_HOSPEDE` | `bigint` | não | FK | Quem reservou; vazio só enquanto a pré-reserva não foi concluída. | 1 |
| `DT_CHECKIN` | `date` | sim | — | Dia da entrada: gera a vistoria de Entrada na agenda. | 23/12/2026 |
| `DT_CHECKOUT` | `date` | sim | — | Dia da saída: gera a vistoria de Saída na agenda. | 26/12/2026 |
| `QTDE_ADULTOS` | `smallint` | sim | — | Adultos (14 anos ou mais). | 2 |
| `QTDE_CRIANCAS` | `smallint` | sim | — | Crianças de 5 a 8 anos (pagam PC_CRIANCA). | 1 |
| `QTDE_CRIANCAS_MAIORES` | `smallint` | sim | — | Crianças de 9 a 13 anos (pagam PC_CRIANCA_MAIOR). | 0 |
| `QTDE_BEBES` | `smallint` | sim | — | Crianças até 4 anos: ocupam vaga, não pagam. | 1 |
| `TP_STATUS` | `text` | sim | — | Só reservas CONFIRMADA geram vistoria (PENDENTE é pré-reserva aguardando o Pix). | CONFIRMADA |
| `TP_CANAL` | `text` | sim | — | Por onde entrou: SITE, DIRETO ou TELEFONE. | SITE |
| `VL_HOSPEDAGEM` | `numeric(10,2)` | sim | — | Soma das noites, congelada no momento da reserva. | R$ 4.830,00 |
| `VL_TAXA_LIMPEZA` | `numeric(10,2)` | sim | — | Taxa de limpeza congelada na reserva. | R$ 0,00 |
| `VL_TOTAL` | `numeric(10,2)` | gerado | — | Hospedagem + limpeza (calculado pelo banco). | R$ 4.830,00 |
| `VL_SINAL` | `numeric(10,2)` | sim | — | Sinal de 50%, combinado e recebido pela equipe depois da reserva. | R$ 2.415,00 |
| `VL_SALDO` | `numeric(10,2)` | gerado | — | Total − sinal, pago no check-in (calculado pelo banco). | R$ 2.415,00 |
| `DS_DETALHE_PRECOS` | `jsonb` | sim | — | Preço noite a noite, com tarifa e crianças por faixa de idade (JSON). | 3 noites: 920,00 + 1.955,00 + 1.955,00 |
| `DS_ACOMPANHANTES` | `jsonb` | não | — | Nome e sobrenome dos adultos e nome e idade das crianças que vão junto (JSON); a reserva exige os adultos. | 3 acompanhantes: Pedro, Lia, Theo |
| `DT_EXPIRA` | `timestamptz` | não | — | Até quando a pré-reserva segura as datas (30 minutos para concluir no site). | vazio |
| `ID_RESERVA_ORIGINAL` | `bigint` | não | FK | Em remarcação, a reserva antiga que deu origem a esta. | vazio |
| `TP_MOTIVO_CANCELAMENTO` | `text` | não | — | Por que foi cancelada; obrigatório só se CANCELADA. | vazio |
| `NO_VERSAO_POLITICA` | `smallint` | não | — | Versão da política que o hóspede aceitou. | 1 |
| `DT_ACEITE_POLITICA` | `timestamptz` | não | — | Quando o hóspede marcou o aceite no site. | 18/11/2026 10:12 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando a reserva foi criada. | 18/11/2026 10:12 |
| `DT_ATUALIZACAO` | `timestamptz` | sim | — | Última mudança (status, pagamento). | 18/11/2026 10:19 |

## `SIT_BLOQUEIO` (SITE · COMUM)

Tabela do site. Uma ocorrência crítica cria aqui um bloqueio MANUTENCAO, que tira as datas da venda no site e nos canais (iCal). Só funções do banco escrevem aqui.

- **Ligada a:** SIT_UNIDADE, VST_OCORRENCIA
- **Acesso (RLS):** O app nunca escreve aqui: só as funções do banco.
- **Regras:** Ocorrência crítica cria bloqueio MANUTENCAO a partir de hoje, com prazo provisório de 7 dias (DT_FIM precisa ser depois de DT_INI). Liberar a unidade encerra o bloqueio (DT_FIM = amanhã). Reserva confirmada que já existe não é cancelada: o painel avisa o conflito. Só funções security definer escrevem aqui; o vínculo com a ocorrência fica em VST_OCORRENCIA.ID_BLOQUEIO.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Manutenção marcada pela equipe) |
|---|---|---|---|---|---|
| `ID_BLOQUEIO` | `bigint` | auto | PK | Identificador do bloqueio. | 2 |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade fora da venda. | 1 |
| `DT_INI` | `date` | sim | — | Primeira noite bloqueada. | 01/03/2027 |
| `DT_FIM` | `date` | sim | — | Dia seguinte à última noite; liberar a unidade encerra aqui. | 04/03/2027 |
| `TP_MOTIVO` | `text` | sim | — | A vistoria cria bloqueios MANUTENCAO (sem ID_CALENDARIO); CANAL_EXTERNO são estadias do Airbnb/Booking. | MANUTENCAO |
| `ID_CALENDARIO` | `bigint` | não | FK | De qual calendário veio (só CANAL_EXTERNO). | vazio |
| `CD_EXTERNO` | `text` | não | — | Id do evento no iCal, para não importar duas vezes. | vazio |
| `DS_OBSERVACAO` | `text` | não | — | Resumo da ocorrência que motivou o bloqueio. | Pintura do deck |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando foi criado ou importado. | 12/11/2026 11:30 |

## `VST_VISTORIA` (OPERAÇÃO)

Uma vistoria, da agenda à conclusão: nasce AGENDADA (o site cria a Entrada e a Saída da reserva), o assessor assume, inicia e conclui pelo celular.

- **Ligada a:** SIT_RESERVA, SIT_UNIDADE, VST_RESPOSTA, VST_TIPO_VISTORIA, VST_USUARIO
- **Acesso (RLS):** Leitura por acesso ao chalé; escrita só pelas funções do app e pelo site (service_role).
- **Regras:** TP_STATUS: AGENDADA, EM_ANDAMENTO, CONCLUIDA ou CANCELADA. No máximo uma vistoria de cada tipo por reserva (UQ_VST_VISTORIA_RESERVA_TIPO); vistoria avulsa não tem reserva. A reserva e a Entrada têm de ser do mesmo chalé da vistoria. EM_ANDAMENTO e CONCLUIDA exigem responsável e início; CONCLUIDA exige fim. O site cria (AGENDADA), remarca e cancela; o app inicia e conclui por função.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Entrada de 23/12) |
|---|---|---|---|---|---|
| `ID_VISTORIA` | `uuid` | sim | PK | uuid gerado pelo banco ou pelo celular (v7): reenviar não duplica. | 0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e01 |
| `ID_VISTORIA_ENTRADA` | `uuid` | não | FK | Na Saída, a Entrada da mesma estadia (comparação). | vazio |
| `ID_USUARIO` | `uuid` | não | FK | Responsável; vazio até alguém assumir (a vistoria nasce sem responsável). | 0192f3a0-6c1e-7b3a-9d11-5a2e4c6b8f01 |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade vistoriada. | 1 |
| `ID_TIPO_VISTORIA` | `bigint` | sim | FK | Tipo aplicado. | 1 |
| `ID_RESERVA` | `bigint` | não | FK | Estadia do site; vazio em vistoria avulsa e em estadias de canal. | 1 |
| `DT_AGENDADA` | `date` | sim | — | Dia previsto: DT_CHECKIN na Entrada, DT_CHECKOUT na Saída. | 23/12/2026 |
| `TP_STATUS` | `text` | sim | — | AGENDADA, EM_ANDAMENTO, CONCLUIDA ou CANCELADA. | CONCLUIDA |
| `DT_INICIO` | `timestamptz` | não | — | Início no celular. | 23/12/2026 14:40 |
| `DT_FIM` | `timestamptz` | não | — | Fim no celular. | 23/12/2026 14:52 |
| `TP_VALIDACAO` | `text` | não | — | Validação exigida no início: QR, GPS ou QR_E_GPS. | QR_E_GPS |
| `DT_RECEBIMENTO` | `timestamptz` | não | — | Chegada ao servidor (pode ser bem depois, se offline). | 23/12/2026 14:52 |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | Posição no início. | -19.085 |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | Posição no início. | -43.597 |
| `QTDE_PRECISAO_METROS` | `smallint` | não | — | Precisão do GPS. | 8 |
| `QTDE_DISTANCIA_METROS` | `integer` | não | — | Distância até o ponto do chalé. | 14 |
| `SG_FORA_RAIO` | `boolean` | sim | — | Começou fora do raio aceito. | não |
| `DS_SINALIZACOES` | `text[]` | não | — | Motivos: FORA_RAIO, GPS_IMPRECISO, SEM_GPS, RAPIDA, SEM_ENTRADA… | vazio |
| `DS_ASSINATURA` | `text` | não | — | Caminho da assinatura. | vazio |
| `TP_SITUACAO_RESULTANTE` | `text` | não | — | Situação em que o chalé ficou (LIBERADO, MANUTENCAO…). | OCUPADO |
| `DS_OBSERVACAO` | `text` | não | — | Observação geral. | vazio |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando foi agendada. | 18/11/2026 10:19 |
| `DT_ATUALIZACAO` | `timestamptz` | sim | — | Última mudança. | 23/12/2026 14:52 |

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

Problema encontrado que precisa de tratamento; se o item é crítico, tira o chalé da venda.

- **Ligada a:** SIT_BLOQUEIO, SIT_UNIDADE, VST_RESPOSTA
- **Acesso (RLS):** Leitura por acesso ao chalé; GESTOR e ADMIN tratam pela função vst_resolver_ocorrencia.
- **Regras:** Nasce de uma resposta PROBLEMA (FK composta ID_VISTORIA + ID_ITEM); uma por resposta. TP_GRAVIDADE: BAIXA, MEDIA ou CRITICA; item crítico abre CRITICA. TP_STATUS: ABERTA, EM_TRATAMENTO, RESOLVIDA ou CANCELADA; RESOLVIDA exige DT_RESOLUCAO. ID_BLOQUEIO preenchido quando o chalé sai da venda (se o bloqueio for apagado no site, o campo volta a ficar vazio).

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Torneira vazando) |
|---|---|---|---|---|---|
| `ID_OCORRENCIA` | `bigint` | auto | PK | Sequencial. | 1 |
| `ID_VISTORIA` | `uuid` | sim | FK | Vistoria de origem. | 0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e02 |
| `ID_ITEM` | `bigint` | sim | FK | Item com problema. | 3 |
| `ID_UNIDADE` | `bigint` | sim | FK | Copiado da vistoria: filtra o painel por unidade. | 1 |
| `ID_BLOQUEIO` | `bigint` | não | FK | Bloqueio MANUTENCAO criado no site, quando houver. | 3 |
| `TP_GRAVIDADE` | `text` | sim | — | BAIXA, MEDIA ou CRITICA. | CRITICA |
| `TP_STATUS` | `text` | sim | — | ABERTA, EM_TRATAMENTO, RESOLVIDA ou CANCELADA. | EM_TRATAMENTO |
| `DS_OCORRENCIA` | `text` | sim | — | O que foi encontrado. | Torneira pingando sem parar; pia molhada. |
| `DS_TRATAMENTO` | `text` | não | — | O que a gestão fez. | Encanador agendado para 28/12. |
| `DT_ABERTURA` | `timestamptz` | sim | — | Abertura. | 26/12/2026 15:21 |
| `DT_RESOLUCAO` | `timestamptz` | não | — | Exigida quando RESOLVIDA. | vazio |

## `VST_FOTO` (OPERAÇÃO)

Evidência de uma resposta: guarda o caminho do arquivo no Storage, com local e horário da câmera.

- **Ligada a:** VST_RESPOSTA
- **Acesso (RLS):** Mesma regra da vistoria; o arquivo fica no Storage com política própria.
- **Regras:** Aponta a resposta pela FK composta (ID_VISTORIA + ID_ITEM). CD_ARQUIVO começa pelo ID_VISTORIA e termina em .jpg, .png ou .webp; único. Bucket privado vistorias, até 5 MB; o app não altera nem apaga fotos.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Foto 1 da torneira) |
|---|---|---|---|---|---|
| `ID_FOTO` | `uuid` | sim | PK | uuid gerado pelo banco ou pelo celular. | 0193c9e8-5f6a-7b7c-8d9e-1f2a3b4c5d01 |
| `ID_VISTORIA` | `uuid` | sim | FK | Vistoria (com ID_ITEM, aponta a resposta). | 0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e02 |
| `ID_ITEM` | `bigint` | sim | FK | Item fotografado. | 3 |
| `CD_ARQUIVO` | `text` | sim | UQ | Objeto no bucket privado vistorias: <ID_VISTORIA>/<arquivo> (JPEG, PNG ou WEBP). | 0193c9e0-1a2b-7c3d-8e4f-0a1b2c3d4e02/torneira-1.jpg |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | Onde foi tirada. | -19.0851 |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | Onde foi tirada. | -43.5971 |
| `QTDE_PRECISAO_METROS` | `smallint` | não | — | Precisão do GPS. | 9 |
| `SG_FORA_RAIO` | `boolean` | sim | — | Tirada fora do raio. | não |
| `DT_CAPTURA` | `timestamptz` | sim | — | Momento da câmera, não do envio. | 26/12/2026 15:11 |

## `VST_AMBIENTE` (CADASTRO)

Cômodos de cada unidade, na ordem em que o assessor percorre.

- **Ligada a:** SIT_UNIDADE, VST_ITEM
- **Acesso (RLS):** Leitura por acesso ao chalé; GESTOR e ADMIN mantêm.
- **Regras:** Nome único por unidade. NO_ORDEM define a ordem do checklist.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Sala) |
|---|---|---|---|---|---|
| `ID_AMBIENTE` | `bigint` | auto | PK | Sequencial. | 1 |
| `ID_UNIDADE` | `bigint` | sim | FK | Unidade do cômodo. | 1 |
| `NM_AMBIENTE` | `text` | sim | — | Sala, Quarto, Banheiro, Varanda… | Sala |
| `NO_ORDEM` | `smallint` | sim | — | Ordem de passagem no checklist. | 1 |
| `DS_FOTO_REFERENCIA` | `text` | não | — | Caminho da foto de como deve ficar. | ambientes/1/sala.jpg |
| `SG_ATIVO` | `boolean` | sim | — | Inativo sai do checklist. | sim |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. | 20/11/2026 10:00 |

## `VST_ITEM` (CADASTRO)

O que se confere em cada cômodo: crítico, foto obrigatória e quantidade esperada.

- **Ligada a:** VST_AMBIENTE, VST_RESPOSTA, VST_TIPO_VISTORIA_ITEM
- **Acesso (RLS):** Leitura por acesso ao chalé; GESTOR e ADMIN mantêm.
- **Regras:** Nome único por cômodo. QTDE_ESPERADA ≥ 0 quando informada.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Item crítico) |
|---|---|---|---|---|---|
| `ID_ITEM` | `bigint` | auto | PK | Sequencial. | 3 |
| `ID_AMBIENTE` | `bigint` | sim | FK | Cômodo onde o item é conferido. | 3 |
| `NM_ITEM` | `text` | sim | — | Ex.: Toalhas de banho, Frigobar. | Torneira e pia |
| `DS_ORIENTACAO` | `text` | não | — | Como conferir. | Abrir e fechar; ver se pinga ou vaza. |
| `SG_CRITICO` | `boolean` | sim | — | Problema em item crítico abre ocorrência CRITICA e tira o chalé da venda. | sim |
| `SG_FOTO_OBRIGATORIA` | `boolean` | sim | — | Exige foto mesmo quando está OK. | sim |
| `QTDE_ESPERADA` | `smallint` | não | — | Quantidade que deve haver (contagem). | vazio |
| `NO_ORDEM` | `smallint` | sim | — | Ordem dentro do cômodo. | 1 |
| `SG_ATIVO` | `boolean` | sim | — | Inativo sai do checklist. | sim |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. | 20/11/2026 10:12 |

## `VST_TIPO_VISTORIA` (APOIO)

Entrada, Saída, Rotina e Manutenção, com as regras de cada uma e quem da equipe pode fazê-las. O site identifica o tipo pelo código (ENTRADA, SAIDA).

- **Ligada a:** VST_TIPO_VISTORIA_ITEM, VST_VISTORIA
- **Acesso (RLS):** Todo usuário ativo lê; ADMIN mantém.
- **Regras:** CD_TIPO_VISTORIA único (ENTRADA e SAIDA vêm da migração; outros tipos podem existir). TP_COMPORTAMENTO: ENTRADA, SAIDA, ROTINA ou MANUTENCAO. TP_PERIODICIDADE só para ROTINA: DIARIA, SEMANAL ou MENSAL. DS_PERFIS: quem da equipe de campo faz o tipo. Padrão: Entrada só ASSESSOR; Saída ASSESSOR e LIMPEZA; Rotina os três; Manutenção ASSESSOR e MANUTENCAO. O ADMIN muda por tipo; gestor e admin fazem todos.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Entrada) |
|---|---|---|---|---|---|
| `ID_TIPO_VISTORIA` | `bigint` | auto | PK | Sequencial. | 1 |
| `CD_TIPO_VISTORIA` | `text` | sim | UQ | Código que o site usa: ENTRADA e SAIDA já vêm cadastrados. | ENTRADA |
| `NM_TIPO_VISTORIA` | `text` | sim | UQ | Entrada, Saída, Rotina, Manutenção… | Entrada |
| `TP_COMPORTAMENTO` | `text` | sim | — | ENTRADA, SAIDA, ROTINA ou MANUTENCAO: regra que o app aplica. | ENTRADA |
| `TP_PERIODICIDADE` | `text` | não | — | DIARIA, SEMANAL ou MENSAL (só rotina). | vazio |
| `SG_EXIGE_ENTRADA` | `boolean` | sim | — | Saída compara com a Entrada da mesma estadia. | não |
| `SG_EXIGE_ASSINATURA` | `boolean` | sim | — | Pede assinatura no fim. | não |
| `SG_ATIVO` | `boolean` | sim | — | Inativo some da lista. | sim |
| `DS_PERFIS` | `text[]` | sim | — | Quem da equipe de campo faz este tipo (ASSESSOR, LIMPEZA, MANUTENCAO); gestor e admin fazem todos. | ASSESSOR |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. | 20/11/2026 09:00 |

## `VST_TIPO_VISTORIA_ITEM` (APOIO)

Quais itens entram em cada tipo de vistoria (o checklist de cada tipo).

- **Ligada a:** VST_ITEM, VST_TIPO_VISTORIA
- **Acesso (RLS):** Leitura por acesso ao chalé; GESTOR e ADMIN mantêm.
- **Regras:** Chave composta: o item entra uma vez em cada tipo.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Saída confere a torneira) |
|---|---|---|---|---|---|
| `ID_TIPO_VISTORIA` | `bigint` | sim | PK FK | Tipo de vistoria. | 2 |
| `ID_ITEM` | `bigint` | sim | PK FK | Item que entra nesse tipo. | 3 |
| `NO_ORDEM` | `smallint` | não | — | Ordem própria do tipo; vazio segue a do item. | 1 |

## `VST_PROPRIEDADE` (CADASTRO)

Regras de presença da pousada: como o assessor prova que está no local, o raio aceito e o tempo mínimo de uma vistoria. Uma linha por SIT_PROPRIEDADE (1 para 1).

- **Ligada a:** SIT_PROPRIEDADE
- **Acesso (RLS):** Leitura por acesso à pousada; ADMIN altera a configuração.
- **Regras:** TP_VALIDACAO: QR, GPS ou QR_E_GPS. Raio entre 10 e 1.000 m; precisão máxima entre 5 e 500 m; tempo mínimo entre 0 e 240 minutos. Latitude e longitude vêm juntas ou ficam vazias juntas. Sem coordenadas, o GPS não é conferido (a vistoria registra GPS_NAO_CONFIGURADO).

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (A pousada) |
|---|---|---|---|---|---|
| `ID_PROPRIEDADE` | `bigint` | sim | PK FK | A pousada (a mesma chave do site). | 1 |
| `TP_VALIDACAO` | `text` | sim | — | Como a presença do assessor é validada por padrão: QR, GPS ou QR_E_GPS. | QR_E_GPS |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | Latitude da sede, centro do raio de presença. | -19.0847 |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | Longitude da sede. | -43.5967 |
| `QTDE_RAIO_METROS` | `smallint` | sim | — | Raio aceito em volta do ponto (padrão 100 m). | 100 |
| `QTDE_PRECISAO_MAX_METROS` | `smallint` | sim | — | Pior precisão de GPS aceita (padrão 50 m). | 50 |
| `QTDE_MINUTOS_MIN_VISTORIA` | `smallint` | sim | — | Duração mínima esperada; abaixo disso a vistoria é sinalizada (padrão 10). | 10 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. | 20/11/2026 09:00 |
| `DT_ATUALIZACAO` | `timestamptz` | sim | — | Última alteração. | 20/11/2026 09:00 |

## `VST_UNIDADE` (CADASTRO)

Dados do chalé que só a vistoria usa: situação operacional, QR da porta, ponto de GPS e andar. Uma linha por SIT_UNIDADE (1 para 1).

- **Ligada a:** SIT_UNIDADE
- **Acesso (RLS):** Leitura por acesso ao chalé, sem o código do QR; GESTOR e ADMIN ajustam GPS e andar; situação e QR só pelas funções.
- **Regras:** Valores vazios herdam os da propriedade (validação, ponto, raio). TP_SITUACAO: EM_LIMPEZA, LIBERADO, OCUPADO, BLOQUEADO ou MANUTENCAO. Pela vistoria: Entrada concluída → OCUPADO; Saída concluída → EM_LIMPEZA (a equipe libera depois da limpeza); item crítico com problema → MANUTENCAO. O padrão nunca tira o chalé de MANUTENCAO ou BLOQUEADO. Só muda pelas funções vst_alterar_situacao_unidade, vst_concluir_vistoria e vst_resolver_ocorrencia. CD_HASH_QR único e invisível ao app; rotacionar soma 1 em NO_VERSAO_QR.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (A Casa do Mirante) |
|---|---|---|---|---|---|
| `ID_UNIDADE` | `bigint` | sim | PK FK | O chalé (a mesma chave do site). | 1 |
| `DS_ANDAR` | `text` | não | — | Andar ou bloco, para o assessor se localizar. | Térreo |
| `TP_VALIDACAO` | `text` | não | — | Validação deste chalé (QR, GPS ou QR_E_GPS); vazio herda da propriedade. | vazio |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | Ponto do chalé; vazio usa o da propriedade. | -19.0849 |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | Longitude do chalé. | -43.5969 |
| `QTDE_RAIO_METROS` | `smallint` | não | — | Raio próprio; vazio usa o da propriedade. | 60 |
| `TP_SITUACAO` | `text` | sim | — | EM_LIMPEZA, LIBERADO, OCUPADO, BLOQUEADO ou MANUTENCAO. | MANUTENCAO |
| `CD_HASH_QR` | `text` | sim | UQ | Código impresso no QR da porta (o app só o recebe ao ler o QR). | b7e2c91f4a6d4c3e9a1f8d05c2b6e437 |
| `NO_VERSAO_QR` | `smallint` | sim | — | Versão do QR; rotacionar invalida as etiquetas antigas. | 1 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. | 20/11/2026 09:00 |
| `DT_ATUALIZACAO` | `timestamptz` | sim | — | Última mudança de situação ou de QR. | 26/12/2026 15:21 |

## `VST_USUARIO` (ACESSO)

Os funcionários que usam o app: vistoria (assessor), limpeza, manutenção, gestão e administração. O ADMIN cadastra pelo app; entram por usuário ou CPF e senha. O cadastro aberto do Auth está desligado.

- **Ligada a:** VST_USUARIO_PROPRIEDADE, VST_VISTORIA
- **Acesso (RLS):** Cada um lê o próprio; GESTOR lê a equipe das pousadas dele; ADMIN lê e mantém todos.
- **Regras:** ID_USUARIO = auth.users.id (login do Supabase Auth). CD_LOGIN minúsculo e único; CD_CPF único, com 11 números e dígitos válidos. TP_PERFIL: ASSESSOR (vistoria), LIMPEZA, MANUTENCAO, GESTOR ou ADMIN; os três primeiros são equipe de campo, com as mesmas permissões. Usuário começa por letra (nunca parece CPF); CPF é opcional e entra no login. Inativo não entra (checado no login e em todas as funções e regras de acesso).

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Assessora) |
|---|---|---|---|---|---|
| `ID_USUARIO` | `uuid` | sim | PK FK | Mesmo id do login no Supabase Auth (auth.users.id). | 0192f3a0-6c1e-7b3a-9d11-5a2e4c6b8f01 |
| `NM_USUARIO` | `text` | sim | — | Nome completo. | Marina Lopes |
| `CD_LOGIN` | `text` | sim | UQ | Usuário de acesso (ex.: ana.souza), minúsculo. | marina.lopes |
| `CD_CPF` | `text` | não | UQ | CPF só com números (dígitos conferidos); também serve para entrar. | 39053344705 |
| `TP_PERFIL` | `text` | sim | — | ASSESSOR (vistoria), LIMPEZA ou MANUTENCAO (campo), GESTOR ou ADMIN (gestão). | ASSESSOR |
| `SG_ATIVO` | `boolean` | sim | — | Inativo não entra no app (nem pelo login por CPF). | sim |
| `DT_ACEITE_LGPD` | `timestamptz` | não | — | Aceite do termo de uso de localização e fotos. | 20/11/2026 09:30 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Cadastro. | 20/11/2026 09:00 |
| `DT_ATUALIZACAO` | `timestamptz` | sim | — | Última alteração. | 20/11/2026 09:30 |

## `VST_USUARIO_PROPRIEDADE` (ACESSO)

Quais pousadas cada usuário vê. É a base das regras de acesso (RLS) de todas as tabelas VST_.

- **Ligada a:** SIT_PROPRIEDADE, VST_USUARIO
- **Acesso (RLS):** Cada um lê os próprios acessos; GESTOR lê os da pousada dele; ADMIN mantém.
- **Regras:** Chave composta: um acesso por usuário e pousada. ADMIN vê todas as pousadas; os demais só as listadas aqui.

| Campo | Tipo | Obrigatório | Chave | Descrição | Exemplo (Marina na pousada) |
|---|---|---|---|---|---|
| `ID_USUARIO` | `uuid` | sim | PK FK | Usuário. | 0192f3a0-6c1e-7b3a-9d11-5a2e4c6b8f01 |
| `ID_PROPRIEDADE` | `bigint` | sim | PK FK | Pousada que ele pode ver. | 1 |
| `DT_CRIACAO` | `timestamptz` | sim | — | Quando o acesso foi dado. | 20/11/2026 09:10 |

## Ligações

| Filha | Campo | Pai | Obrigatória | Leitura |
|---|---|---|---|---|
| `SIT_UNIDADE` | `ID_PROPRIEDADE` | `SIT_PROPRIEDADE` | sim | pertence a |
| `SIT_RESERVA` | `ID_UNIDADE` | `SIT_UNIDADE` | sim | reserva |
| `SIT_BLOQUEIO` | `ID_UNIDADE` | `SIT_UNIDADE` | sim | bloqueia |
| `VST_OCORRENCIA` | `ID_VISTORIA` + `ID_BLOQUEIO` | `SIT_BLOQUEIO` | não | tira da venda |
| `VST_USUARIO_PROPRIEDADE` | `ID_USUARIO` | `VST_USUARIO` | sim | acessa |
| `VST_USUARIO_PROPRIEDADE` | `ID_PROPRIEDADE` | `SIT_PROPRIEDADE` | sim | acesso a |
| `VST_PROPRIEDADE` | `ID_PROPRIEDADE` | `SIT_PROPRIEDADE` | sim | complementa |
| `VST_UNIDADE` | `ID_UNIDADE` | `SIT_UNIDADE` | sim | complementa |
| `VST_AMBIENTE` | `ID_UNIDADE` | `SIT_UNIDADE` | sim | cômodo de |
| `VST_ITEM` | `ID_AMBIENTE` | `VST_AMBIENTE` | sim | conferido em |
| `VST_TIPO_VISTORIA_ITEM` | `ID_TIPO_VISTORIA` | `VST_TIPO_VISTORIA` | sim | compõe |
| `VST_TIPO_VISTORIA_ITEM` | `ID_ITEM` | `VST_ITEM` | sim | inclui |
| `VST_VISTORIA` | `ID_UNIDADE` | `SIT_UNIDADE` | sim | vistoria de |
| `VST_VISTORIA` | `ID_TIPO_VISTORIA` | `VST_TIPO_VISTORIA` | sim | do tipo |
| `VST_VISTORIA` | `ID_USUARIO` | `VST_USUARIO` | não | feita por |
| `VST_VISTORIA` | `ID_VISTORIA_ENTRADA` | `VST_VISTORIA` | não | entrada de |
| `VST_VISTORIA` | `ID_RESERVA` | `SIT_RESERVA` | não | da estadia |
| `VST_RESPOSTA` | `ID_VISTORIA` | `VST_VISTORIA` | sim | responde |
| `VST_RESPOSTA` | `ID_ITEM` | `VST_ITEM` | sim | sobre |
| `VST_FOTO` | `ID_VISTORIA` + `ID_ITEM` | `VST_RESPOSTA` | sim | evidência de |
| `VST_OCORRENCIA` | `ID_VISTORIA` + `ID_ITEM` | `VST_RESPOSTA` | sim | nasce de |
| `VST_OCORRENCIA` | `ID_VISTORIA` + `ID_UNIDADE` | `SIT_UNIDADE` | sim | na unidade |

`VST_USUARIO.ID_USUARIO` também referencia `auth.users` (Supabase Auth).

## Funções do app

Todas em minúsculas, `security definer`, executáveis só pelo usuário logado (`authenticated`). Detalhes e parâmetros em [`README.md`](./README.md).

| Função | Para que serve |
|---|---|
| `vst_unidades()` | Chalés das pousadas do usuário, com a configuração efetiva de presença (sem o QR). |
| `vst_agenda(dt_ini, dt_fim, id_unidade?)` | Vistorias do período, com código e datas da reserva; nunca dados do hóspede. |
| `vst_checklist(id_unidade, id_tipo_vistoria)` | Itens ativos do chalé para o tipo, na ordem de passagem. |
| `vst_resolver_qr(cd_hash_qr)` | Qual chalé é o do QR lido, se o usuário tem acesso. |
| `vst_criar_vistoria(…)` | Vistoria avulsa ou de rotina; reenviar o mesmo id não duplica. |
| `vst_atualizar_agenda(…)` | Gestão: atribui responsável, remarca ou cancela uma vistoria AGENDADA. |
| `vst_iniciar_vistoria(…)` | Assume a vistoria e valida a presença: QR errado é recusado; GPS fora do raio só sinaliza. |
| `vst_concluir_vistoria(…)` | Grava respostas e fotos, abre ocorrências, cria o bloqueio se item crítico e atualiza o chalé, numa transação. |
| `vst_registrar_foto(…)` | Registra foto enviada ao Storage depois da conclusão. |
| `vst_resolver_ocorrencia(…)` | Gestão: trata a ocorrência e, se pedido, libera o chalé e encerra o bloqueio. |
| `vst_bloquear_por_ocorrencia(…)` | Gestão: cria o bloqueio de manutenção de uma ocorrência (prazo provisório de 7 dias). |
| `vst_alterar_situacao_unidade(…)` | Troca a situação do chalé (BLOQUEADO e MANUTENCAO só para a gestão). |
| `vst_obter_qr / vst_rotacionar_qr(id_unidade)` | Gestão: QR para imprimir e rotação que invalida as etiquetas antigas. |
| `login-vistoria (Edge Function)` | Login por usuário ou CPF e senha: acha o funcionário ativo (vst_localizar_login), entra no Auth e devolve a sessão; resposta igual para qualquer erro e limite de tentativas. |
| `redefinir-senha (Edge Function)` | Só ADMIN: define nova senha para um funcionário que esqueceu a dele. Cada funcionário troca a própria senha no app, logado. |
| `criar-usuario (Edge Function)` | Só ADMIN: cria o login no Auth e o cadastro em VST_USUARIO e VST_USUARIO_PROPRIEDADE (vst_cadastrar_usuario) para qualquer perfil. |
| `consultar_disponibilidade (site)` | Função do site que já exclui as datas com SIT_BLOQUEIO: por isso a manutenção some da venda sem mudar o site. |
