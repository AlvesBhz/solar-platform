# Dicionário de dados — Solar Inspect

Proposta enxuta para o Supabase (PostgreSQL), esquema `inspect`: 14 tabelas, 122 campos e 18 relações. O diagrama está em [`der.html`](./der.html).

Gerado por `tools/gerar-der.py` (fonte única do DER e deste dicionário).

## Convenções

| Prefixo | Significado | Tipo no Postgres | Na planilha de referência |
|---|---|---|---|
| `id_` | Identificador (chave primária ou estrangeira) | `bigint ou uuid` | ID_ (190 colunas) |
| `nm_` | Nome | `text` | NM_ (37) |
| `ds_` | Descrição, texto livre ou caminho de arquivo | `text, text[] ou jsonb` | DS_ (18) |
| `cd_` | Código (login, CPF, chave, hash) | `text` | CD_ (8) |
| `tp_` | Tipo ou categoria de uma lista fechada | `text + check` | TP_ (6) |
| `dt_` | Data ou data e hora | `timestamptz ou date` | DT_ (86) |
| `vl_` | Valor numérico medido (coordenada, raio, precisão) | `numeric ou integer` | VL_ (104) |
| `st_` | Estado ou situação (muda ao longo do tempo) | `text + check` | novo; a planilha usa STATUS sem prefixo |
| `fl_` | Sim ou não | `boolean` | novo; a planilha usa varchar(1) S/N em 16 colunas |
| `nr_` | Número de ordem ou versão | `integer` | novo |
| `qt_` | Quantidade | `integer` | novo |

Restrições: `pk_<tabela>`, `fk_<filha>_<pai>`, `ix_<tabela>_<colunas>`, `uq_` (único) e `ck_` (regra de valores). Nomes em minúsculas (o Postgres converte nomes sem aspas).

## `inspect.usuario` (Acesso)

Pessoas que usam o app. Cada linha corresponde a uma conta do Supabase Auth.

- **Telas:** T02, T32
- **Quem acessa (RLS):** Cada usuário lê a própria linha; admin lê e altera todas.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_usuario` | `uuid` | sim | — | PK FK | Identificador; é o mesmo id da conta em auth.users (Supabase Auth). |
| `nm_usuario` | `text` | sim | — | — | Nome completo exibido no app e nos relatórios. |
| `cd_login` | `text` | sim | — | UQ | Nome de usuário para entrar: minúsculas, 3 a 30 caracteres (letras, números, ponto, hífen, sublinhado). |
| `cd_cpf` | `text` | não | — | UQ | CPF com os 11 dígitos, validado pelos dígitos verificadores; alternativa ao login. Sempre exibido mascarado (LGPD). |
| `tp_perfil` | `text` | sim | `'assessor'` | — | Perfil: assessor (campo), gestor (gestão) ou admin (gestão e administração). |
| `fl_ativo` | `boolean` | sim | `true` | — | Pode entrar no app. Desativar bloqueia o acesso sem apagar o histórico. |
| `dt_aceite_lgpd` | `timestamptz` | não | — | — | Quando aceitou o termo de uso de localização e dados (primeiro acesso). |
| `dt_criacao` | `timestamptz` | sim | `now()` | — | Quando o registro foi criado. |
| `dt_atualizacao` | `timestamptz` | sim | `now()` | — | Última alteração; atualizada por gatilho. |

**Chaves, índices e restrições:** `pk_usuario` (id_usuario); `uq_usuario_cd_login` (cd_login); `uq_usuario_cd_cpf` (cd_cpf); `ck_usuario_tp_perfil:` assessor | gestor | admin; `ck_usuario_cd_cpf:` 11 dígitos; `fk_usuario_auth_users:` id_usuario → auth.users(id), on delete cascade

## `inspect.usuario_propriedade` (Acesso)

Quais propriedades cada usuário pode ver e vistoriar. É a base das regras de acesso (RLS) de todas as tabelas.

- **Telas:** T32
- **Quem acessa (RLS):** Cada usuário lê os próprios vínculos; admin gerencia.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_usuario` | `uuid` | sim | — | PK FK | Usuário vinculado. |
| `id_propriedade` | `bigint` | sim | — | PK FK | Propriedade liberada para o usuário. |
| `dt_criacao` | `timestamptz` | sim | `now()` | — | Quando o vínculo foi criado. |

**Chaves, índices e restrições:** `pk_usuario_propriedade` (id_usuario, id_propriedade); `ix_usuario_propriedade_id_propriedade` (id_propriedade); `fk_usuario_propriedade_usuario,` fk_usuario_propriedade_propriedade (on delete cascade)

## `inspect.propriedade` (Cadastro)

Hotéis, pousadas e conjuntos de chalés. Define o padrão de presença herdado pelas unidades.

- **Telas:** T20, T28, T29, T33
- **Quem acessa (RLS):** Leitura por quem tem vínculo; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_propriedade` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `nm_propriedade` | `text` | sim | — | UQ | Nome da propriedade (ex.: Pousada Solar do Espinhaço). |
| `tp_propriedade` | `text` | sim | — | — | Tipo: pousada, hotel ou chales. |
| `tp_validacao` | `text` | sim | `'gps_qr'` | — | Presença padrão das unidades: gps, qr ou gps_qr. |
| `vl_latitude` | `numeric(9,6)` | sim | — | — | Latitude do centro da propriedade, em graus decimais (-90 a 90). |
| `vl_longitude` | `numeric(9,6)` | sim | — | — | Longitude do centro, em graus decimais (-180 a 180). |
| `vl_raio_m` | `integer` | sim | `40` | — | Raio padrão aceito para a presença por GPS, em metros (10 a 500). |
| `fl_ativo` | `boolean` | sim | `true` | — | Desativar esconde a propriedade sem apagar unidades nem histórico. |
| `dt_criacao` | `timestamptz` | sim | `now()` | — | Quando o registro foi criado. |
| `dt_atualizacao` | `timestamptz` | sim | `now()` | — | Última alteração; atualizada por gatilho. |

**Chaves, índices e restrições:** `pk_propriedade` (id_propriedade); `uq_propriedade_nm_propriedade` (nm_propriedade); `ck_propriedade_tp_propriedade:` pousada | hotel | chales; `ck_propriedade_tp_validacao:` gps | qr | gps_qr; `ck_propriedade_vl_raio_m:` 10 a 500

## `inspect.log_evento` (Apoio)

Registro de auditoria e histórico. Guarda as tentativas de presença, os envios, as mudanças de estado, o histórico de cada ocorrência (atribuição, prazo, comentários, cancelamento) e as alterações administrativas. Só recebe inclusões.

- **Telas:** T08, T26, T34
- **Quem acessa (RLS):** Inclusão só por funções do servidor; leitura pelo admin e, para ocorrências, pelo gestor da propriedade.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_log_evento` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `id_usuario` | `uuid` | não | — | FK | Quem executou; vazio para eventos automáticos. |
| `id_propriedade` | `bigint` | não | — | FK | Propriedade relacionada; usada nas regras de acesso. |
| `tp_evento` | `text` | sim | — | — | presenca_gps, presenca_qr, vistoria_enviada, estado_alterado, ocorrencia_atribuida, ocorrencia_comentada, ocorrencia_resolvida, ocorrencia_cancelada, cadastro_alterado, qr_rotacionado, usuario_alterado. |
| `nm_entidade` | `text` | sim | — | — | Tabela afetada (unidade, vistoria, ocorrencia...). |
| `cd_registro` | `text` | sim | — | — | Identificador do registro afetado, em texto (aceita bigint e uuid). |
| `ds_evento` | `text` | sim | — | — | Frase legível, ex.: "Atribuída a Governança". |
| `ds_dados` | `jsonb` | sim | `'{}'` | — | Detalhes sem segredos: coordenadas, precisão, valor anterior e novo, justificativa. |
| `dt_evento` | `timestamptz` | sim | `now()` | — | Quando aconteceu. |

**Chaves, índices e restrições:** `pk_log_evento` (id_log_evento); `ix_log_evento_entidade` (nm_entidade, cd_registro); `ix_log_evento_dt_evento` (dt_evento desc); `ix_log_evento_id_usuario,` ix_log_evento_id_propriedade; `Sem` UPDATE e sem DELETE (gatilho e ausência de políticas)

## `inspect.configuracao` (Apoio)

Parâmetros que a especificação pede configuráveis no banco, em vez de fixos no app.

- **Telas:** T08, T12, T15
- **Quem acessa (RLS):** Leitura por usuários autenticados; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `cd_configuracao` | `text` | sim | — | PK | Chave: duracao_minima_min, precisao_max_m, foto_lado_max_px, foto_qualidade, retencao_fotos_dias. |
| `vl_configuracao` | `numeric` | sim | — | — | Valor numérico (ex.: 4, 50, 1600, 0.8). |
| `ds_configuracao` | `text` | sim | — | — | Para que serve e a unidade de medida. |
| `dt_atualizacao` | `timestamptz` | sim | `now()` | — | Última alteração. |

**Chaves, índices e restrições:** `pk_configuracao` (cd_configuracao)

## `inspect.unidade` (Cadastro)

Chalés, quartos e suítes. Guarda o estado atual e a configuração de presença própria, quando diferente da propriedade.

- **Telas:** T05, T06, T08, T09, T21, T22, T33
- **Quem acessa (RLS):** Leitura por quem tem vínculo com a propriedade; estado alterado pelo envio da vistoria ou pela gestão; cadastro só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_unidade` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `id_propriedade` | `bigint` | sim | — | FK | Propriedade a que pertence. |
| `nm_unidade` | `text` | sim | — | — | Nome (ex.: Chalé Ipê, Quarto 101). Único dentro da propriedade. |
| `tp_unidade` | `text` | sim | — | — | Tipo: chale, quarto ou suite. |
| `ds_andar` | `text` | não | — | — | Andar ou localização (ex.: Térreo, 1º andar). |
| `tp_validacao` | `text` | não | — | — | Presença própria (gps, qr, gps_qr); vazio herda da propriedade. |
| `vl_latitude` | `numeric(9,6)` | não | — | — | Coordenada própria; vazia herda a da propriedade. |
| `vl_longitude` | `numeric(9,6)` | não | — | — | Coordenada própria; vazia herda a da propriedade. |
| `vl_raio_m` | `integer` | não | — | — | Raio próprio em metros; vazio herda o da propriedade. |
| `st_unidade` | `text` | sim | `'em_limpeza'` | — | Estado atual: em_limpeza, liberado, ocupado, bloqueado ou manutencao. |
| `cd_hash_qr` | `text` | não | — | — | Hash SHA-256 do segredo vigente do QR Code. O segredo nunca é gravado nem enviado ao app. |
| `nr_versao_qr` | `integer` | sim | `1` | — | Versão do QR; aumenta a cada rotação, invalidando as anteriores. |
| `fl_ativo` | `boolean` | sim | `true` | — | Desativar retira a unidade das listas sem apagar o histórico. |
| `dt_criacao` | `timestamptz` | sim | `now()` | — | Quando o registro foi criado. |
| `dt_atualizacao` | `timestamptz` | sim | `now()` | — | Última alteração; atualizada por gatilho. |

**Chaves, índices e restrições:** `pk_unidade` (id_unidade); `uq_unidade_nome` (id_propriedade, nm_unidade); `ix_unidade_id_propriedade` (id_propriedade); `ck_unidade_tp_unidade:` chale | quarto | suite; `ck_unidade_st_unidade:` em_limpeza | liberado | ocupado | bloqueado | manutencao; `ck_unidade_tp_validacao:` gps | qr | gps_qr; `fk_unidade_propriedade` (on delete restrict)

## `inspect.ambiente` (Cadastro)

Cômodos da unidade, na ordem física do percurso da vistoria.

- **Telas:** T10, T11, T12, T30
- **Quem acessa (RLS):** Leitura por quem tem vínculo; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_ambiente` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `id_unidade` | `bigint` | sim | — | FK | Unidade a que pertence. |
| `nm_ambiente` | `text` | sim | — | — | Nome (ex.: Varanda, Sala, Copa, Quarto, Banheiro). |
| `nr_ordem` | `integer` | sim | — | — | Posição no percurso (1 = primeiro). |
| `ds_foto_referencia` | `text` | não | — | — | Caminho da foto de referência no Storage (bucket referencias). |
| `fl_ativo` | `boolean` | sim | `true` | — | Desativar retira o ambiente das próximas vistorias sem apagar o histórico. |

**Chaves, índices e restrições:** `pk_ambiente` (id_ambiente); `ix_ambiente_id_unidade` (id_unidade, nr_ordem); `fk_ambiente_unidade` (on delete cascade)

## `inspect.item` (Cadastro)

O que é conferido em cada ambiente.

- **Telas:** T10, T11, T30
- **Quem acessa (RLS):** Leitura por quem tem vínculo; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_item` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `id_ambiente` | `bigint` | sim | — | FK | Ambiente a que pertence. |
| `nm_item` | `text` | sim | — | — | Nome (ex.: Cama arrumada e roupa de cama). |
| `nr_ordem` | `integer` | sim | — | — | Posição dentro do ambiente. |
| `fl_critico` | `boolean` | sim | `false` | — | Problema neste item sugere gravidade crítica e pode bloquear a unidade. |
| `fl_foto_obrigatoria` | `boolean` | sim | `false` | — | Exige foto mesmo com resposta positiva (exceto N/A). |
| `qt_esperada` | `integer` | não | — | — | Quantidade esperada, quando o item é contado (ex.: 4 toalhas). |
| `fl_ativo` | `boolean` | sim | `true` | — | Desativar retira o item das próximas vistorias sem apagar o histórico. |

**Chaves, índices e restrições:** `pk_item` (id_item); `ix_item_id_ambiente` (id_ambiente, nr_ordem); `fk_item_ambiente` (on delete cascade)

## `inspect.vistoria` (Operação)

Registro final de cada vistoria enviada. É imutável: depois de gravada não pode ser alterada nem excluída.

- **Telas:** T08 a T17, T19, T23, T24, T27
- **Quem acessa (RLS):** Inclusão pelo assessor com vínculo, via função de envio; leitura por quem tem vínculo; sem UPDATE e sem DELETE.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_vistoria` | `uuid` | sim | — | PK | Gerado no celular antes da primeira gravação (UUID v7, ordenado pelo tempo). Permite reenviar sem duplicar. |
| `id_vistoria_entrada` | `uuid` | não | — | FK | Na Saída, a vistoria de Entrada da estadia; base da comparação (T13). |
| `id_unidade` | `bigint` | sim | — | FK | Unidade vistoriada. |
| `id_tipo_vistoria` | `bigint` | sim | — | FK | Tipo de vistoria (Entrada, Saída, Preventiva…). |
| `id_usuario` | `uuid` | sim | — | FK | Assessor que executou. |
| `tp_validacao` | `text` | sim | — | — | Presença exigida no momento (gps, qr, gps_qr), congelada para o histórico. |
| `dt_inicio` | `timestamptz` | sim | — | — | Presença validada e checklist aberto. |
| `dt_fim` | `timestamptz` | sim | — | — | Envio confirmado no celular. |
| `dt_recebimento` | `timestamptz` | sim | `now()` | — | Chegada ao servidor; difere de dt_fim quando enviada offline. |
| `vl_latitude` | `numeric(9,6)` | não | — | — | Posição na validação de presença. |
| `vl_longitude` | `numeric(9,6)` | não | — | — | Posição na validação de presença. |
| `vl_precisao_m` | `numeric(6,1)` | não | — | — | Precisão informada pelo GPS, em metros. |
| `vl_distancia_m` | `numeric(7,1)` | não | — | — | Distância até a unidade, calculada no servidor (Haversine). |
| `fl_fora_raio` | `boolean` | sim | `false` | — | Envio fora do raio ou sem localização; gera sinalização. |
| `st_vistoria` | `text` | sim | — | — | enviada ou sinalizada. Rascunho e pendente existem só no celular. |
| `ds_sinalizacoes` | `text[]` | sim | `'{}'` | — | Motivos da sinalização (ex.: duracao_menor_4min, envio_fora_raio). |
| `ds_assinatura` | `text` | não | — | — | Caminho da assinatura (PNG) no Storage. |
| `st_unidade_resultante` | `text` | não | — | — | Estado em que a unidade ficou após este envio. |

**Chaves, índices e restrições:** `pk_vistoria` (id_vistoria); `ix_vistoria_unidade_dt_fim` (id_unidade, dt_fim desc); `ix_vistoria_id_tipo_vistoria,` ix_vistoria_id_usuario, ix_vistoria_id_vistoria_entrada; `ck_vistoria_st_vistoria:` enviada | sinalizada; `ck_vistoria_periodo:` dt_fim >= dt_inicio; `Gatilho` impede UPDATE e DELETE (registro imutável)

## `inspect.resposta` (Operação)

Resposta de cada item em uma vistoria. Uma por item.

- **Telas:** T10, T11, T13
- **Quem acessa (RLS):** Inclusão junto com a vistoria (função de envio); leitura por quem tem vínculo; imutável.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_vistoria` | `uuid` | sim | — | PK FK | Vistoria a que pertence. |
| `id_item` | `bigint` | sim | — | PK FK | Item respondido. |
| `nm_item` | `text` | sim | — | — | Nome do item no momento da vistoria; preserva o histórico se o cadastro mudar. |
| `tp_resposta` | `text` | sim | — | — | ok, problema, na, igual, danificado, faltando, com_defeito ou precisa_intervencao (conforme o tipo). |
| `ds_observacao` | `text` | não | — | — | Observação opcional. |
| `dt_resposta` | `timestamptz` | sim | — | — | Última alteração da resposta no celular. |

**Chaves, índices e restrições:** `pk_resposta` (id_vistoria, id_item); `ix_resposta_id_item` (id_item); `ck_resposta_tp_resposta:` lista acima; `fk_resposta_vistoria` (on delete cascade), fk_resposta_item (on delete restrict)

## `inspect.ocorrencia` (Operação)

Divergência que precisa de tratamento. Nasce de uma resposta negativa no envio e é tratada pela gestão. O histórico fica em log_evento.

- **Telas:** T14, T15, T20, T22, T25, T26
- **Quem acessa (RLS):** Inclusão pela função de envio; leitura por quem tem vínculo; gestor e admin alteram responsável, prazo e status.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_ocorrencia` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `id_vistoria` | `uuid` | sim | — | FK | Vistoria em que foi registrada (FK composta com id_item → resposta). |
| `id_item` | `bigint` | sim | — | FK | Item com problema (FK composta com id_vistoria → resposta). |
| `id_unidade` | `bigint` | sim | — | FK | Repetido da vistoria para as consultas e as regras de acesso. |
| `tp_gravidade` | `text` | sim | — | — | baixa, media ou critica. Crítica pode bloquear a unidade. |
| `ds_ocorrencia` | `text` | não | — | — | Descrição opcional; o padrão é a observação da resposta. |
| `nm_responsavel` | `text` | não | — | — | Pessoa ou equipe responsável (ex.: Governança). |
| `dt_prazo` | `date` | não | — | — | Prazo para resolver. |
| `st_ocorrencia` | `text` | sim | `'aberta'` | — | aberta, em_tratamento, resolvida ou cancelada. Resolver não muda o estado da unidade. |
| `dt_resolucao` | `timestamptz` | não | — | — | Quando foi resolvida ou cancelada. |
| `dt_criacao` | `timestamptz` | sim | `now()` | — | Quando o registro foi criado. |
| `dt_atualizacao` | `timestamptz` | sim | `now()` | — | Última alteração; atualizada por gatilho. |

**Chaves, índices e restrições:** `pk_ocorrencia` (id_ocorrencia); `uq_ocorrencia_resposta` (id_vistoria, id_item): uma por item, sem duplicidade; `ix_ocorrencia_abertas` (id_unidade, tp_gravidade) where st_ocorrencia in (aberta, em_tratamento); `ck_ocorrencia_tp_gravidade,` ck_ocorrencia_st_ocorrencia; `fk_ocorrencia_resposta,` fk_ocorrencia_unidade

## `inspect.tipo_vistoria` (Cadastro)

Tipos de vistoria e suas regras (Entrada, Saída, Manutenção preventiva e personalizados).

- **Telas:** T07, T31
- **Quem acessa (RLS):** Leitura por usuários autenticados; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_tipo_vistoria` | `bigint` | sim | `identity` | PK | Identificador gerado pelo banco. |
| `nm_tipo_vistoria` | `text` | sim | — | UQ | Nome exibido (ex.: Entrada, Conferência de enxoval). |
| `ds_tipo_vistoria` | `text` | não | — | — | Descrição mostrada na escolha do tipo (T07). |
| `tp_comportamento` | `text` | sim | — | — | entrada, saida, preventiva ou personalizada: define as respostas e a regra de estado da unidade. |
| `tp_periodicidade` | `text` | sim | `'por_estadia'` | — | por_estadia, semanal, mensal, trimestral ou sob_demanda. |
| `fl_exige_entrada` | `boolean` | sim | `false` | — | Só pode ser feita com vistoria de Entrada vinculada (caso da Saída). |
| `fl_exige_assinatura` | `boolean` | sim | `true` | — | Exige assinatura antes do envio. |
| `fl_ativo` | `boolean` | sim | `true` | — | Só tipos ativos aparecem; um tipo sem itens não pode ser ativado. |
| `dt_atualizacao` | `timestamptz` | sim | `now()` | — | Última alteração. |

**Chaves, índices e restrições:** `pk_tipo_vistoria` (id_tipo_vistoria); `uq_tipo_vistoria_nm` (nm_tipo_vistoria); `ck_tipo_vistoria_tp_comportamento,` ck_tipo_vistoria_tp_periodicidade

## `inspect.tipo_vistoria_item` (Cadastro)

Itens que compõem cada tipo. Para manter simples: se um tipo não tiver linhas aqui, todos os itens ativos da unidade se aplicam (caso de Entrada e Saída).

- **Telas:** T10, T31
- **Quem acessa (RLS):** Leitura por usuários autenticados; alteração só pelo admin.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_tipo_vistoria` | `bigint` | sim | — | PK FK | Tipo de vistoria. |
| `id_item` | `bigint` | sim | — | PK FK | Item incluído no tipo. |
| `nr_ordem` | `integer` | não | — | — | Ordem própria no tipo; vazio segue a ordem do ambiente. |

**Chaves, índices e restrições:** `pk_tipo_vistoria_item` (id_tipo_vistoria, id_item); `ix_tipo_vistoria_item_id_item` (id_item); `fk_tipo_vistoria_item_tipo_vistoria,` fk_tipo_vistoria_item_item (on delete cascade)

## `inspect.foto` (Operação)

Evidências fotográficas com o carimbo de local e hora. O arquivo fica no Storage; aqui ficam o caminho e os metadados.

- **Telas:** T11, T12, T13, T24, T27
- **Quem acessa (RLS):** Inclusão junto com a vistoria; leitura por quem tem vínculo; imutável. Arquivos em bucket privado com URL assinada.

| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |
|---|---|---|---|---|---|
| `id_foto` | `uuid` | sim | — | PK | Gerado no celular (UUID v7); permite reenviar sem duplicar. |
| `id_vistoria` | `uuid` | sim | — | FK | Vistoria (FK composta com id_item → resposta). |
| `id_item` | `bigint` | sim | — | FK | Item fotografado (FK composta com id_vistoria → resposta). |
| `ds_caminho` | `text` | sim | — | UQ | Caminho no bucket privado vistorias: {id_propriedade}/{id_vistoria}/{id_foto}.jpg. |
| `dt_captura` | `timestamptz` | sim | — | — | Data e hora do carimbo. |
| `vl_latitude` | `numeric(9,6)` | não | — | — | Posição na captura. |
| `vl_longitude` | `numeric(9,6)` | não | — | — | Posição na captura. |
| `vl_precisao_m` | `numeric(6,1)` | não | — | — | Precisão do GPS na captura, em metros. |
| `fl_fora_raio` | `boolean` | sim | `false` | — | Posição revalidada fora do raio na captura. |
| `dt_criacao` | `timestamptz` | sim | `now()` | — | Chegada ao servidor. |

**Chaves, índices e restrições:** `pk_foto` (id_foto); `uq_foto_ds_caminho` (ds_caminho); `ix_foto_resposta` (id_vistoria, id_item); `fk_foto_resposta` (on delete cascade)

## Relações

| Filha | Campo(s) | Pai | Obrigatória |
|---|---|---|---|
| `usuario_propriedade` | `id_usuario` | `usuario` | sim |
| `usuario_propriedade` | `id_propriedade` | `propriedade` | sim |
| `log_evento` | `id_propriedade` | `propriedade` | não |
| `log_evento` | `id_usuario` | `usuario` | não |
| `unidade` | `id_propriedade` | `propriedade` | sim |
| `ambiente` | `id_unidade` | `unidade` | sim |
| `item` | `id_ambiente` | `ambiente` | sim |
| `vistoria` | `id_unidade` | `unidade` | sim |
| `vistoria` | `id_tipo_vistoria` | `tipo_vistoria` | sim |
| `vistoria` | `id_usuario` | `usuario` | sim |
| `vistoria` | `id_vistoria_entrada` | `vistoria` | não |
| `resposta` | `id_vistoria` | `vistoria` | sim |
| `resposta` | `id_item` | `item` | sim |
| `foto` | `id_vistoria, id_item` | `resposta` | sim |
| `ocorrencia` | `id_vistoria, id_item` | `resposta` | sim |
| `ocorrencia` | `id_unidade` | `unidade` | sim |
| `tipo_vistoria_item` | `id_tipo_vistoria` | `tipo_vistoria` | sim |
| `tipo_vistoria_item` | `id_item` | `item` | sim |
| `usuario` | `id_usuario` | `auth.users` (Supabase Auth) | sim |
