# Dicionário de dados — Solar Inspect

Proposta enxuta para o Supabase (PostgreSQL), esquema `INSPECT`: 14 tabelas, 122 campos e 18 relações. O diagrama está em [`der.html`](./der.html).

Gerado por `tools/gerar-der.py` (fonte única do DER e deste dicionário).

## Convenções

| Prefixo | Significado | Tipo no Postgres | Na planilha de referência |
|---|---|---|---|
| `ID_` | Identificador (chave primária ou estrangeira) | `bigint ou uuid` | ID_ (190 colunas) |
| `NM_` | Nome | `text` | NM_ (37) |
| `DS_` | Descrição, texto livre ou caminho de arquivo | `text, text[] ou jsonb` | DS_ (18) |
| `CD_` | Código (login, CPF, chave, hash) | `text` | CD_ (8) |
| `TP_` | Tipo ou categoria de uma lista fechada | `text + check` | TP_ (6) |
| `DT_` | Data ou data e hora | `timestamptz ou date` | DT_ (86) |
| `VL_` | Valor numérico medido (coordenada, raio, precisão) | `numeric ou integer` | VL_ (104) |
| `ST_` | Estado ou situação (muda ao longo do tempo) | `text + check` | novo; a planilha usa STATUS sem prefixo |
| `FL_` | Sim ou não | `boolean` | novo; a planilha usa varchar(1) S/N em 16 colunas |
| `NR_` | Número de ordem ou versão | `integer` | novo |
| `QT_` | Quantidade | `integer` | novo |

Restrições: `PK_<TABELA>`, `FK_<FILHA>_<PAI>`, `IX_<TABELA>_<COLUNAS>`, `UQ_` (único) e `CK_` (regra de valores). Nomes em MAIÚSCULAS, escritos sem aspas no SQL (o Postgres guarda em minúsculas internamente, como o painel do Supabase exibe).

## `INSPECT.USUARIO` (Acesso)

Pessoas que usam o app. Cada linha corresponde a uma conta do Supabase Auth.

- **Telas:** T02, T32
- **Quem acessa (RLS):** Cada usuário lê a própria linha; admin lê e altera todas.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_USUARIO` | `uuid` | sim | — | PK FK | Identificador; é o mesmo id da conta em AUTH.USERS (Supabase Auth). |
| `NM_USUARIO` | `text` | sim | — | — | Nome completo exibido no app e nos relatórios. |
| `CD_LOGIN` | `text` | sim | — | UQ | Nome de usuário para entrar: minúsculas, 3 a 30 caracteres (letras, números, ponto, hífen, sublinhado). |
| `CD_CPF` | `text` | não | — | UQ | CPF com os 11 dígitos, validado pelos dígitos verificadores; alternativa ao login. Sempre exibido mascarado (LGPD). |
| `TP_PERFIL` | `text` | sim | `'assessor'` | — | Perfil: assessor (campo), gestor (gestão) ou admin (gestão e administração). |
| `FL_ATIVO` | `boolean` | sim | `true` | — | Pode entrar no app. Desativar bloqueia o acesso sem apagar o histórico. |
| `DT_ACEITE_LGPD` | `timestamptz` | não | — | — | Quando aceitou o termo de uso de localização e dados (primeiro acesso). |
| `DT_CRIACAO` | `timestamptz` | sim | `now()` | — | Quando o registro foi criado. |
| `DT_ATUALIZACAO` | `timestamptz` | sim | `now()` | — | Última alteração; atualizada por gatilho. |

**Chaves, índices e restrições:** `PK_USUARIO` (ID_USUARIO); `UQ_USUARIO_CD_LOGIN` (CD_LOGIN); `UQ_USUARIO_CD_CPF` (CD_CPF); `CK_USUARIO_TP_PERFIL:` assessor | gestor | admin; `CK_USUARIO_CD_CPF:` 11 dígitos; `FK_USUARIO_AUTH_USERS:` ID_USUARIO → AUTH.USERS(id), on delete cascade

## `INSPECT.USUARIO_PROPRIEDADE` (Acesso)

Quais propriedades cada usuário pode ver e vistoriar. É a base das regras de acesso (RLS) de todas as tabelas.

- **Telas:** T32
- **Quem acessa (RLS):** Cada usuário lê os próprios vínculos; admin gerencia.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_USUARIO` | `uuid` | sim | — | PK FK | Usuário vinculado. |
| `ID_PROPRIEDADE` | `bigint` | sim | — | PK FK | Propriedade liberada para o usuário. |
| `DT_CRIACAO` | `timestamptz` | sim | `now()` | — | Quando o vínculo foi criado. |

**Chaves, índices e restrições:** `PK_USUARIO_PROPRIEDADE` (ID_USUARIO, ID_PROPRIEDADE); `IX_USUARIO_PROPRIEDADE_ID_PROPRIEDADE` (ID_PROPRIEDADE); `FK_USUARIO_PROPRIEDADE_USUARIO,` FK_USUARIO_PROPRIEDADE_PROPRIEDADE (on delete cascade)

## `INSPECT.PROPRIEDADE` (Cadastro)

Hotéis, pousadas e conjuntos de chalés. Define o padrão de presença herdado pelas unidades.

- **Telas:** T20, T28, T29, T33
- **Quem acessa (RLS):** Leitura por quem tem vínculo; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_PROPRIEDADE` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `NM_PROPRIEDADE` | `text` | sim | — | UQ | Nome da propriedade (ex.: Pousada Solar do Espinhaço). |
| `TP_PROPRIEDADE` | `text` | sim | — | — | Tipo: pousada, hotel ou chales. |
| `TP_VALIDACAO` | `text` | sim | `'gps_qr'` | — | Presença padrão das unidades: gps, qr ou gps_qr. |
| `VL_LATITUDE` | `numeric(9,6)` | sim | — | — | Latitude do centro da propriedade, em graus decimais (-90 a 90). |
| `VL_LONGITUDE` | `numeric(9,6)` | sim | — | — | Longitude do centro, em graus decimais (-180 a 180). |
| `VL_RAIO_M` | `integer` | sim | `40` | — | Raio padrão aceito para a presença por GPS, em metros (10 a 500). |
| `FL_ATIVO` | `boolean` | sim | `true` | — | Desativar esconde a propriedade sem apagar unidades nem histórico. |
| `DT_CRIACAO` | `timestamptz` | sim | `now()` | — | Quando o registro foi criado. |
| `DT_ATUALIZACAO` | `timestamptz` | sim | `now()` | — | Última alteração; atualizada por gatilho. |

**Chaves, índices e restrições:** `PK_PROPRIEDADE` (ID_PROPRIEDADE); `UQ_PROPRIEDADE_NM_PROPRIEDADE` (NM_PROPRIEDADE); `CK_PROPRIEDADE_TP_PROPRIEDADE:` pousada | hotel | chales; `CK_PROPRIEDADE_TP_VALIDACAO:` gps | qr | gps_qr; `CK_PROPRIEDADE_VL_RAIO_M:` 10 a 500

## `INSPECT.LOG_EVENTO` (Apoio)

Registro de auditoria e histórico. Guarda as tentativas de presença, os envios, as mudanças de estado, o histórico de cada ocorrência (atribuição, prazo, comentários, cancelamento) e as alterações administrativas. Só recebe inclusões.

- **Telas:** T08, T26, T34
- **Quem acessa (RLS):** Inclusão só por funções do servidor; leitura pelo admin e, para ocorrências, pelo gestor da propriedade.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_LOG_EVENTO` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `ID_USUARIO` | `uuid` | não | — | FK | Quem executou; vazio para eventos automáticos. |
| `ID_PROPRIEDADE` | `bigint` | não | — | FK | Propriedade relacionada; usada nas regras de acesso. |
| `TP_EVENTO` | `text` | sim | — | — | presenca_gps, presenca_qr, vistoria_enviada, estado_alterado, ocorrencia_atribuida, ocorrencia_comentada, ocorrencia_resolvida, ocorrencia_cancelada, cadastro_alterado, qr_rotacionado, usuario_alterado. |
| `NM_ENTIDADE` | `text` | sim | — | — | Tabela afetada (unidade, vistoria, ocorrencia...). |
| `CD_REGISTRO` | `text` | sim | — | — | Identificador do registro afetado, em texto (aceita bigint e uuid). |
| `DS_EVENTO` | `text` | sim | — | — | Frase legível, ex.: "Atribuída a Governança". |
| `DS_DADOS` | `jsonb` | sim | `'{}'` | — | Detalhes sem segredos: coordenadas, precisão, valor anterior e novo, justificativa. |
| `DT_EVENTO` | `timestamptz` | sim | `now()` | — | Quando aconteceu. |

**Chaves, índices e restrições:** `PK_LOG_EVENTO` (ID_LOG_EVENTO); `IX_LOG_EVENTO_ENTIDADE` (NM_ENTIDADE, CD_REGISTRO); `IX_LOG_EVENTO_DT_EVENTO` (DT_EVENTO desc); `IX_LOG_EVENTO_ID_USUARIO,` IX_LOG_EVENTO_ID_PROPRIEDADE; `Sem` UPDATE e sem DELETE (gatilho e ausência de políticas)

## `INSPECT.CONFIGURACAO` (Apoio)

Parâmetros que a especificação pede configuráveis no banco, em vez de fixos no app.

- **Telas:** T08, T12, T15
- **Quem acessa (RLS):** Leitura por usuários autenticados; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `CD_CONFIGURACAO` | `text` | sim | — | PK | Chave: duracao_minima_min, precisao_max_m, foto_lado_max_px, foto_qualidade, retencao_fotos_dias. |
| `VL_CONFIGURACAO` | `numeric` | sim | — | — | Valor numérico (ex.: 4, 50, 1600, 0.8). |
| `DS_CONFIGURACAO` | `text` | sim | — | — | Para que serve e a unidade de medida. |
| `DT_ATUALIZACAO` | `timestamptz` | sim | `now()` | — | Última alteração. |

**Chaves, índices e restrições:** `PK_CONFIGURACAO` (CD_CONFIGURACAO)

## `INSPECT.UNIDADE` (Cadastro)

Chalés, quartos e suítes. Guarda o estado atual e a configuração de presença própria, quando diferente da propriedade.

- **Telas:** T05, T06, T08, T09, T21, T22, T33
- **Quem acessa (RLS):** Leitura por quem tem vínculo com a propriedade; estado alterado pelo envio da vistoria ou pela gestão; cadastro só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_UNIDADE` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `ID_PROPRIEDADE` | `bigint` | sim | — | FK | Propriedade a que pertence. |
| `NM_UNIDADE` | `text` | sim | — | — | Nome (ex.: Chalé Ipê, Quarto 101). Único dentro da propriedade. |
| `TP_UNIDADE` | `text` | sim | — | — | Tipo: chale, quarto ou suite. |
| `DS_ANDAR` | `text` | não | — | — | Andar ou localização (ex.: Térreo, 1º andar). |
| `TP_VALIDACAO` | `text` | não | — | — | Presença própria (gps, qr, gps_qr); vazio herda da propriedade. |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | — | Coordenada própria; vazia herda a da propriedade. |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | — | Coordenada própria; vazia herda a da propriedade. |
| `VL_RAIO_M` | `integer` | não | — | — | Raio próprio em metros; vazio herda o da propriedade. |
| `ST_UNIDADE` | `text` | sim | `'em_limpeza'` | — | Estado atual: em_limpeza, liberado, ocupado, bloqueado ou manutencao. |
| `CD_HASH_QR` | `text` | não | — | — | Hash SHA-256 do segredo vigente do QR Code. O segredo nunca é gravado nem enviado ao app. |
| `NR_VERSAO_QR` | `integer` | sim | `1` | — | Versão do QR; aumenta a cada rotação, invalidando as anteriores. |
| `FL_ATIVO` | `boolean` | sim | `true` | — | Desativar retira a unidade das listas sem apagar o histórico. |
| `DT_CRIACAO` | `timestamptz` | sim | `now()` | — | Quando o registro foi criado. |
| `DT_ATUALIZACAO` | `timestamptz` | sim | `now()` | — | Última alteração; atualizada por gatilho. |

**Chaves, índices e restrições:** `PK_UNIDADE` (ID_UNIDADE); `UQ_UNIDADE_NOME` (ID_PROPRIEDADE, NM_UNIDADE); `IX_UNIDADE_ID_PROPRIEDADE` (ID_PROPRIEDADE); `CK_UNIDADE_TP_UNIDADE:` chale | quarto | suite; `CK_UNIDADE_ST_UNIDADE:` em_limpeza | liberado | ocupado | bloqueado | manutencao; `CK_UNIDADE_TP_VALIDACAO:` gps | qr | gps_qr; `FK_UNIDADE_PROPRIEDADE` (on delete restrict)

## `INSPECT.AMBIENTE` (Cadastro)

Cômodos da unidade, na ordem física do percurso da vistoria.

- **Telas:** T10, T11, T12, T30
- **Quem acessa (RLS):** Leitura por quem tem vínculo; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_AMBIENTE` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `ID_UNIDADE` | `bigint` | sim | — | FK | Unidade a que pertence. |
| `NM_AMBIENTE` | `text` | sim | — | — | Nome (ex.: Varanda, Sala, Copa, Quarto, Banheiro). |
| `NR_ORDEM` | `integer` | sim | — | — | Posição no percurso (1 = primeiro). |
| `DS_FOTO_REFERENCIA` | `text` | não | — | — | Caminho da foto de referência no Storage (bucket referencias). |
| `FL_ATIVO` | `boolean` | sim | `true` | — | Desativar retira o ambiente das próximas vistorias sem apagar o histórico. |

**Chaves, índices e restrições:** `PK_AMBIENTE` (ID_AMBIENTE); `IX_AMBIENTE_ID_UNIDADE` (ID_UNIDADE, NR_ORDEM); `FK_AMBIENTE_UNIDADE` (on delete cascade)

## `INSPECT.ITEM` (Cadastro)

O que é conferido em cada ambiente.

- **Telas:** T10, T11, T30
- **Quem acessa (RLS):** Leitura por quem tem vínculo; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_ITEM` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `ID_AMBIENTE` | `bigint` | sim | — | FK | Ambiente a que pertence. |
| `NM_ITEM` | `text` | sim | — | — | Nome (ex.: Cama arrumada e roupa de cama). |
| `NR_ORDEM` | `integer` | sim | — | — | Posição dentro do ambiente. |
| `FL_CRITICO` | `boolean` | sim | `false` | — | Problema neste item sugere gravidade crítica e pode bloquear a unidade. |
| `FL_FOTO_OBRIGATORIA` | `boolean` | sim | `false` | — | Exige foto mesmo com resposta positiva (exceto N/A). |
| `QT_ESPERADA` | `integer` | não | — | — | Quantidade esperada, quando o item é contado (ex.: 4 toalhas). |
| `FL_ATIVO` | `boolean` | sim | `true` | — | Desativar retira o item das próximas vistorias sem apagar o histórico. |

**Chaves, índices e restrições:** `PK_ITEM` (ID_ITEM); `IX_ITEM_ID_AMBIENTE` (ID_AMBIENTE, NR_ORDEM); `FK_ITEM_AMBIENTE` (on delete cascade)

## `INSPECT.VISTORIA` (Operação)

Registro final de cada vistoria enviada. É imutável: depois de gravada não pode ser alterada nem excluída.

- **Telas:** T08 a T17, T19, T23, T24, T27
- **Quem acessa (RLS):** Inclusão pelo assessor com vínculo, via função de envio; leitura por quem tem vínculo; sem UPDATE e sem DELETE.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_VISTORIA` | `uuid` | sim | — | PK | Gerado no celular antes da primeira gravação (UUID v7, ordenado pelo tempo). Permite reenviar sem duplicar. |
| `ID_VISTORIA_ENTRADA` | `uuid` | não | — | FK | Na Saída, a vistoria de Entrada da estadia; base da comparação (T13). |
| `ID_UNIDADE` | `bigint` | sim | — | FK | Unidade vistoriada. |
| `ID_TIPO_VISTORIA` | `bigint` | sim | — | FK | Tipo de vistoria (Entrada, Saída, Preventiva…). |
| `ID_USUARIO` | `uuid` | sim | — | FK | Assessor que executou. |
| `TP_VALIDACAO` | `text` | sim | — | — | Presença exigida no momento (gps, qr, gps_qr), congelada para o histórico. |
| `DT_INICIO` | `timestamptz` | sim | — | — | Presença validada e checklist aberto. |
| `DT_FIM` | `timestamptz` | sim | — | — | Envio confirmado no celular. |
| `DT_RECEBIMENTO` | `timestamptz` | sim | `now()` | — | Chegada ao servidor; difere de DT_FIM quando enviada offline. |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | — | Posição na validação de presença. |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | — | Posição na validação de presença. |
| `VL_PRECISAO_M` | `numeric(6,1)` | não | — | — | Precisão informada pelo GPS, em metros. |
| `VL_DISTANCIA_M` | `numeric(7,1)` | não | — | — | Distância até a unidade, calculada no servidor (Haversine). |
| `FL_FORA_RAIO` | `boolean` | sim | `false` | — | Envio fora do raio ou sem localização; gera sinalização. |
| `ST_VISTORIA` | `text` | sim | — | — | enviada ou sinalizada. Rascunho e pendente existem só no celular. |
| `DS_SINALIZACOES` | `text[]` | sim | `'{}'` | — | Motivos da sinalização (ex.: duracao_menor_4min, envio_fora_raio). |
| `DS_ASSINATURA` | `text` | não | — | — | Caminho da assinatura (PNG) no Storage. |
| `ST_UNIDADE_RESULTANTE` | `text` | não | — | — | Estado em que a unidade ficou após este envio. |

**Chaves, índices e restrições:** `PK_VISTORIA` (ID_VISTORIA); `IX_VISTORIA_UNIDADE_DT_FIM` (ID_UNIDADE, DT_FIM desc); `IX_VISTORIA_ID_TIPO_VISTORIA,` IX_VISTORIA_ID_USUARIO, IX_VISTORIA_ID_VISTORIA_ENTRADA; `CK_VISTORIA_ST_VISTORIA:` enviada | sinalizada; `CK_VISTORIA_PERIODO:` DT_FIM >= DT_INICIO; `Gatilho` impede UPDATE e DELETE (registro imutável)

## `INSPECT.RESPOSTA` (Operação)

Resposta de cada item em uma vistoria. Uma por item.

- **Telas:** T10, T11, T13
- **Quem acessa (RLS):** Inclusão junto com a vistoria (função de envio); leitura por quem tem vínculo; imutável.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_VISTORIA` | `uuid` | sim | — | PK FK | Vistoria a que pertence. |
| `ID_ITEM` | `bigint` | sim | — | PK FK | Item respondido. |
| `NM_ITEM` | `text` | sim | — | — | Nome do item no momento da vistoria; preserva o histórico se o cadastro mudar. |
| `TP_RESPOSTA` | `text` | sim | — | — | ok, problema, na, igual, danificado, faltando, com_defeito ou precisa_intervencao (conforme o tipo). |
| `DS_OBSERVACAO` | `text` | não | — | — | Observação opcional. |
| `DT_RESPOSTA` | `timestamptz` | sim | — | — | Última alteração da resposta no celular. |

**Chaves, índices e restrições:** `PK_RESPOSTA` (ID_VISTORIA, ID_ITEM); `IX_RESPOSTA_ID_ITEM` (ID_ITEM); `CK_RESPOSTA_TP_RESPOSTA:` lista acima; `FK_RESPOSTA_VISTORIA` (on delete cascade), FK_RESPOSTA_ITEM (on delete restrict)

## `INSPECT.OCORRENCIA` (Operação)

Divergência que precisa de tratamento. Nasce de uma resposta negativa no envio e é tratada pela gestão. O histórico fica em LOG_EVENTO.

- **Telas:** T14, T15, T20, T22, T25, T26
- **Quem acessa (RLS):** Inclusão pela função de envio; leitura por quem tem vínculo; gestor e admin alteram responsável, prazo e status.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_OCORRENCIA` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `ID_VISTORIA` | `uuid` | sim | — | FK | Vistoria em que foi registrada (FK composta com ID_ITEM → RESPOSTA). |
| `ID_ITEM` | `bigint` | sim | — | FK | Item com problema (FK composta com ID_VISTORIA → RESPOSTA). |
| `ID_UNIDADE` | `bigint` | sim | — | FK | Repetido da vistoria para as consultas e as regras de acesso. |
| `TP_GRAVIDADE` | `text` | sim | — | — | baixa, media ou critica. Crítica pode bloquear a unidade. |
| `DS_OCORRENCIA` | `text` | não | — | — | Descrição opcional; o padrão é a observação da resposta. |
| `NM_RESPONSAVEL` | `text` | não | — | — | Pessoa ou equipe responsável (ex.: Governança). |
| `DT_PRAZO` | `date` | não | — | — | Prazo para resolver. |
| `ST_OCORRENCIA` | `text` | sim | `'aberta'` | — | aberta, em_tratamento, resolvida ou cancelada. Resolver não muda o estado da unidade. |
| `DT_RESOLUCAO` | `timestamptz` | não | — | — | Quando foi resolvida ou cancelada. |
| `DT_CRIACAO` | `timestamptz` | sim | `now()` | — | Quando o registro foi criado. |
| `DT_ATUALIZACAO` | `timestamptz` | sim | `now()` | — | Última alteração; atualizada por gatilho. |

**Chaves, índices e restrições:** `PK_OCORRENCIA` (ID_OCORRENCIA); `UQ_OCORRENCIA_RESPOSTA` (ID_VISTORIA, ID_ITEM): uma por item, sem duplicidade; `IX_OCORRENCIA_ABERTAS` (ID_UNIDADE, TP_GRAVIDADE) where ST_OCORRENCIA in (aberta, em_tratamento); `CK_OCORRENCIA_TP_GRAVIDADE,` CK_OCORRENCIA_ST_OCORRENCIA; `FK_OCORRENCIA_RESPOSTA,` FK_OCORRENCIA_UNIDADE

## `INSPECT.TIPO_VISTORIA` (Cadastro)

Tipos de vistoria e suas regras (Entrada, Saída, Manutenção preventiva e personalizados).

- **Telas:** T07, T31
- **Quem acessa (RLS):** Leitura por usuários autenticados; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_TIPO_VISTORIA` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `NM_TIPO_VISTORIA` | `text` | sim | — | UQ | Nome exibido (ex.: Entrada, Conferência de enxoval). |
| `DS_TIPO_VISTORIA` | `text` | não | — | — | Descrição mostrada na escolha do tipo (T07). |
| `TP_COMPORTAMENTO` | `text` | sim | — | — | entrada, saida, preventiva ou personalizada: define as respostas e a regra de estado da unidade. |
| `TP_PERIODICIDADE` | `text` | sim | `'por_estadia'` | — | por_estadia, semanal, mensal, trimestral ou sob_demanda. |
| `FL_EXIGE_ENTRADA` | `boolean` | sim | `false` | — | Só pode ser feita com vistoria de Entrada vinculada (caso da Saída). |
| `FL_EXIGE_ASSINATURA` | `boolean` | sim | `true` | — | Exige assinatura antes do envio. |
| `FL_ATIVO` | `boolean` | sim | `true` | — | Só tipos ativos aparecem; um tipo sem itens não pode ser ativado. |
| `DT_ATUALIZACAO` | `timestamptz` | sim | `now()` | — | Última alteração. |

**Chaves, índices e restrições:** `PK_TIPO_VISTORIA` (ID_TIPO_VISTORIA); `UQ_TIPO_VISTORIA_NM` (NM_TIPO_VISTORIA); `CK_TIPO_VISTORIA_TP_COMPORTAMENTO,` CK_TIPO_VISTORIA_TP_PERIODICIDADE

## `INSPECT.TIPO_VISTORIA_ITEM` (Cadastro)

Itens que compõem cada tipo. Para manter simples: se um tipo não tiver linhas aqui, todos os itens ativos da unidade se aplicam (caso de Entrada e Saída).

- **Telas:** T10, T31
- **Quem acessa (RLS):** Leitura por usuários autenticados; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_TIPO_VISTORIA` | `bigint` | sim | — | PK FK | Tipo de vistoria. |
| `ID_ITEM` | `bigint` | sim | — | PK FK | Item incluído no tipo. |
| `NR_ORDEM` | `integer` | não | — | — | Ordem própria no tipo; vazio segue a ordem do ambiente. |

**Chaves, índices e restrições:** `PK_TIPO_VISTORIA_ITEM` (ID_TIPO_VISTORIA, ID_ITEM); `IX_TIPO_VISTORIA_ITEM_ID_ITEM` (ID_ITEM); `FK_TIPO_VISTORIA_ITEM_TIPO_VISTORIA,` FK_TIPO_VISTORIA_ITEM_ITEM (on delete cascade)

## `INSPECT.FOTO` (Operação)

Evidências fotográficas com o carimbo de local e hora. O arquivo fica no Storage; aqui ficam o caminho e os metadados.

- **Telas:** T11, T12, T13, T24, T27
- **Quem acessa (RLS):** Inclusão junto com a vistoria; leitura por quem tem vínculo; imutável. Arquivos em bucket privado com URL assinada.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `ID_FOTO` | `uuid` | sim | — | PK | Gerado no celular (UUID v7); permite reenviar sem duplicar. |
| `ID_VISTORIA` | `uuid` | sim | — | FK | Vistoria (FK composta com ID_ITEM → RESPOSTA). |
| `ID_ITEM` | `bigint` | sim | — | FK | Item fotografado (FK composta com ID_VISTORIA → RESPOSTA). |
| `DS_CAMINHO` | `text` | sim | — | UQ | Caminho no bucket privado vistorias: {ID_PROPRIEDADE}/{ID_VISTORIA}/{ID_FOTO}.jpg. |
| `DT_CAPTURA` | `timestamptz` | sim | — | — | Data e hora do carimbo. |
| `VL_LATITUDE` | `numeric(9,6)` | não | — | — | Posição na captura. |
| `VL_LONGITUDE` | `numeric(9,6)` | não | — | — | Posição na captura. |
| `VL_PRECISAO_M` | `numeric(6,1)` | não | — | — | Precisão do GPS na captura, em metros. |
| `FL_FORA_RAIO` | `boolean` | sim | `false` | — | Posição revalidada fora do raio na captura. |
| `DT_CRIACAO` | `timestamptz` | sim | `now()` | — | Chegada ao servidor. |

**Chaves, índices e restrições:** `PK_FOTO` (ID_FOTO); `UQ_FOTO_DS_CAMINHO` (DS_CAMINHO); `IX_FOTO_RESPOSTA` (ID_VISTORIA, ID_ITEM); `FK_FOTO_RESPOSTA` (on delete cascade)

## Relações

| Filha | Campo(s) | Pai | Obrigatória |
|---|---|---|---|
| `USUARIO_PROPRIEDADE` | `ID_USUARIO` | `USUARIO` | sim |
| `USUARIO_PROPRIEDADE` | `ID_PROPRIEDADE` | `PROPRIEDADE` | sim |
| `LOG_EVENTO` | `ID_PROPRIEDADE` | `PROPRIEDADE` | não |
| `LOG_EVENTO` | `ID_USUARIO` | `USUARIO` | não |
| `UNIDADE` | `ID_PROPRIEDADE` | `PROPRIEDADE` | sim |
| `AMBIENTE` | `ID_UNIDADE` | `UNIDADE` | sim |
| `ITEM` | `ID_AMBIENTE` | `AMBIENTE` | sim |
| `VISTORIA` | `ID_UNIDADE` | `UNIDADE` | sim |
| `VISTORIA` | `ID_TIPO_VISTORIA` | `TIPO_VISTORIA` | sim |
| `VISTORIA` | `ID_USUARIO` | `USUARIO` | sim |
| `VISTORIA` | `ID_VISTORIA_ENTRADA` | `VISTORIA` | não |
| `RESPOSTA` | `ID_VISTORIA` | `VISTORIA` | sim |
| `RESPOSTA` | `ID_ITEM` | `ITEM` | sim |
| `FOTO` | `ID_VISTORIA, ID_ITEM` | `RESPOSTA` | sim |
| `OCORRENCIA` | `ID_VISTORIA, ID_ITEM` | `RESPOSTA` | sim |
| `OCORRENCIA` | `ID_UNIDADE` | `UNIDADE` | sim |
| `TIPO_VISTORIA_ITEM` | `ID_TIPO_VISTORIA` | `TIPO_VISTORIA` | sim |
| `TIPO_VISTORIA_ITEM` | `ID_ITEM` | `ITEM` | sim |
| `USUARIO` | `ID_USUARIO` | `AUTH.USERS` (Supabase Auth) | sim |
