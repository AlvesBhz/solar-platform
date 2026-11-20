# Integração Solar Inspect (vistorias) ↔ banco de reservas do site

Briefing para a sessão do projeto **Solar Inspect**. Estado do banco do site em **20/11/2026**.
O objetivo final é um banco único: as vistorias vivem no mesmo projeto Supabase e no mesmo schema das reservas.

## 1. Onde fica

- **Supabase:** projeto `tnjpyjbqcjrowzjfnuln` (https://tnjpyjbqcjrowzjfnuln.supabase.co).
- **Schema:** `"SE"` — o mesmo das reservas. O DER das Vistorias v2 (18/11) foi desenhado no schema `public` e com uma versão antiga das tabelas do site: **precisa ser adaptado ao schema `"SE"` e às colunas atuais listadas abaixo**.
- **Prefixo:** tabelas do projeto vistoria começam com **`VST_`**; as do site com **`SIT_`**.

## 2. Convenções obrigatórias (as mesmas do site)

- Tabelas, campos, restrições e índices **em MAIÚSCULAS entre aspas** (`"VST_VISTORIA"`, `"DT_AGENDADA"`). Em SQL escrito à mão sempre com aspas.
- Prefixos de campo: `ID_` chave, `CD_` código, `NM_` nome, `DS_` descrição/JSON, `DT_` data/hora, `HR_` hora, `TP_` tipo/situação (texto com CHECK), `SG_` sim/não (boolean), `QTDE_` quantidade, `VL_` valor, `NO_` número/ordem.
- Restrições: `PK_<TABELA>`, `FK_<FILHA>_<PAI>`, `CK_<TABELA>_<REGRA>`, `UQ_<TABELA>_<CAMPOS>`, índices `IX_<TABELA>_<CAMPOS>`.
- Períodos com `DT_INI` / `DT_FIM` (fim = dia seguinte ao último dia).
- Funções chamadas pela API em **minúsculas** (`criar_vistoria`), com `security definer` e `set search_path = "SE", extensions, pg_temp`; depois `revoke all ... from public, anon, authenticated` e `grant execute` só para quem precisa.
- **RLS ligado em toda tabela VST_.** Nenhuma permissão para `anon`. O schema já tem `alter default privileges ... revoke all ... from anon, authenticated`: toda permissão precisa ser concedida explicitamente.
- **Auditoria:** acrescentar as tabelas VST_ ao gatilho existente, com
  `create trigger "TG_<TABELA>_AUDITORIA" after insert or update or delete on "<TABELA>" for each row execute function auditar();`
  (grava em `"SIT_AUDITORIA"` quem mudou, quando, antes e depois).
- Entregar como **um arquivo de migração** (ex.: `migracao_vistorias.sql`) que roda no banco já existente **sem apagar dados**, mais um arquivo de testes.

## 3. Tabelas do site que as vistorias usam (somente leitura)

**Não alterar, renomear ou apagar colunas, restrições ou funções SIT_.** Se precisar de campo novo numa tabela SIT_ (ex.: latitude/longitude e QR do chalé, previstos no DER v2), proponha como coluna **nova, opcional (aceita vazio) ou com valor padrão**, para eu revisar antes — as funções do site não podem quebrar.

| Tabela | Colunas atuais (`?` = aceita vazio) |
|---|---|
| `SIT_PROPRIEDADE` | ID_PROPRIEDADE, NM_PROPRIEDADE, DS_FUSO_HORARIO (America/Sao_Paulo), HR_CHECKIN (15:00), HR_CHECKOUT (12:00), NO_IDADE_MAX_BEBE, NO_IDADE_MAX_CRIANCA_MENOR, NO_IDADE_MAX_CRIANCA, QTDE_MAX_NOITES, VL_PERCENTUAL_SINAL, QTDE_MINUTOS_PRE_RESERVA, QTDE_DIAS_LIMITE_REMARCACAO, QTDE_MESES_VALIDADE_CREDITO, QTDE_DIAS_ARREPENDIMENTO, NO_VERSAO_POLITICA, DT_CRIACAO |
| `SIT_UNIDADE` (chalé; hoje só `casa-do-mirante`) | ID_UNIDADE, ID_PROPRIEDADE, CD_UNIDADE, NM_UNIDADE, TP_UNIDADE, QTDE_MAX_HOSPEDES, QTDE_MAX_ADULTOS, QTDE_MAX_CRIANCAS, VL_TAXA_LIMPEZA, SG_ATIVO, NO_ORDEM, DT_CRIACAO |
| `SIT_RESERVA` | ID_RESERVA, CD_RESERVA (ex.: SE-7F3A2C1D), ID_UNIDADE, ID_HOSPEDE?, DT_CHECKIN, DT_CHECKOUT, QTDE_ADULTOS, QTDE_CRIANCAS, QTDE_CRIANCAS_MAIORES, QTDE_BEBES, TP_STATUS, TP_CANAL, VL_HOSPEDAGEM, VL_TAXA_LIMPEZA, VL_TOTAL?, VL_SINAL, VL_SALDO?, DS_DETALHE_PRECOS, DS_ACOMPANHANTES?, DT_EXPIRA?, ID_RESERVA_ORIGINAL?, TP_MOTIVO_CANCELAMENTO?, NO_VERSAO_POLITICA?, DT_ACEITE_POLITICA?, DT_CRIACAO, DT_ATUALIZACAO |
| `SIT_HOSPEDE` (dados pessoais, LGPD) | ID_HOSPEDE, NM_HOSPEDE, DS_EMAIL, DS_TELEFONE?, SG_NACIONALIDADE, CD_CPF?, CD_PASSAPORTE?, SG_PAIS_PASSAPORTE?, DT_EMISSAO_PASSAPORTE?, DT_VALIDADE_PASSAPORTE?, DT_NASCIMENTO?, DT_CRIACAO |
| `SIT_BLOQUEIO` (datas fora da venda) | ID_BLOQUEIO, ID_UNIDADE, DT_INI, DT_FIM, TP_MOTIVO, ID_CALENDARIO?, CD_EXTERNO?, DS_OBSERVACAO?, DT_CRIACAO |

Regras do site que importam para as vistorias:
- `SIT_RESERVA.TP_STATUS`: `PENDENTE` (pré-reserva aguardando o Pix do sinal, 30 min — **não gera vistoria**), `CONFIRMADA` (sinal pago — **gera vistoria**), `CANCELADA`, `EXPIRADA`, `REMARCADA` (a reserva nova aponta para a antiga em `ID_RESERVA_ORIGINAL`).
- A reserva só fica `CONFIRMADA` pela função `confirmar_sinal` (equipe confere o Pix).
- `SIT_BLOQUEIO.TP_MOTIVO`: `CANAL_EXTERNO`, `MANUTENCAO`, `USO_PROPRIO`, `OUTRO`. Só `CANAL_EXTERNO` tem `ID_CALENDARIO` (obrigatório nesse caso). Ocorrência de vistoria que tira o chalé da venda usa **`MANUTENCAO`** com `ID_CALENDARIO` vazio.
- A vistoria **não lê dados pessoais do hóspede** além do necessário (nome do titular, se preciso); nunca CPF/passaporte no app.

## 4. Contrato para a geração automática (eu faço depois que as tabelas existirem)

Depois que você criar as tabelas, eu crio no banco a geração automática: **quando uma reserva passa a `CONFIRMADA`**, nascem duas vistorias agendadas; remarcação move as datas; cancelamento cancela as pendentes. Para isso as tabelas precisam ter, no mínimo:

**`VST_TIPO_VISTORIA`**
- `CD_TIPO_VISTORIA` texto **único**, com estes dois códigos já cadastrados pela migração: **`ENTRADA`** (antes do check-in) e **`SAIDA`** (depois do check-out). Pode haver outros tipos (preventiva, manutenção…).

**`VST_VISTORIA`**
- `ID_VISTORIA` (PK), `ID_UNIDADE` → `SIT_UNIDADE` (obrigatório), `ID_TIPO_VISTORIA` → `VST_TIPO_VISTORIA` (obrigatório).
- `ID_RESERVA` → `SIT_RESERVA` (**aceita vazio**: vistorias avulsas não têm reserva). `on delete` sem cascade.
- `ID_VISTORIA_ENTRADA` → `VST_VISTORIA` (aceita vazio; a de SAÍDA aponta para a de ENTRADA da mesma estadia).
- `ID_USUARIO` → `VST_USUARIO` (**aceita vazio**: a vistoria nasce sem responsável; a equipe atribui depois).
- `DT_AGENDADA` (date, obrigatória). Hora sugerida: entrada até `HR_CHECKIN`, saída a partir de `HR_CHECKOUT` (da `SIT_PROPRIEDADE`).
- `TP_STATUS` com CHECK: **`AGENDADA`**, `EM_ANDAMENTO`, `CONCLUIDA`, **`CANCELADA`** (outros valores podem existir, mas esses quatro com esses nomes).
- `DT_INICIO?`, `DT_FIM?` (execução), `DT_CRIACAO`, `DT_ATUALIZACAO`.
- **Único:** uma vistoria por reserva e tipo — `UQ_VST_VISTORIA_RESERVA_TIPO` em (`ID_RESERVA`, `ID_TIPO_VISTORIA`) quando `ID_RESERVA` não é vazio (índice único parcial).

Comportamento que vou implementar (não precisa fazer, só não conflitar):
- `CONFIRMADA` → cria ENTRADA em `DT_CHECKIN` e SAÍDA em `DT_CHECKOUT` (status `AGENDADA`, sem responsável).
- `REMARCADA` → as vistorias `AGENDADA` passam para a reserva nova e as novas datas.
- `CANCELADA` → vistorias `AGENDADA` da reserva viram `CANCELADA`. Vistorias já iniciadas/concluídas não mudam.

**`VST_OCORRENCIA`** (se mantiver do DER v2)
- `ID_BLOQUEIO` → `SIT_BLOQUEIO` (aceita vazio). Quando a ocorrência exigir tirar o chalé da venda, criar o `SIT_BLOQUEIO` (`TP_MOTIVO = 'MANUTENCAO'`) **por uma função `security definer`** (ex.: `bloquear_por_ocorrencia`), nunca dando ao app permissão direta de escrita em `SIT_BLOQUEIO`. O calendário do site passa a mostrar essas datas riscadas automaticamente.

## 5. Acesso do aplicativo (login)

- O **cadastro aberto do Supabase Auth está DESLIGADO** (decisão de segurança do site). Usuários do Solar Inspect são criados pela equipe: convite pelo painel (Authentication › Users › Invite) ou pela API de administração, nunca por auto-cadastro.
- `VST_USUARIO.ID_USUARIO` = `auth.users.id` (uuid). Perfil em `TP_PERFIL` e acesso por propriedade em `VST_USUARIO_PROPRIEDADE`.
- O app usa só a **chave publicável** (`sb_publishable_...`) e o login do usuário (papel `authenticated`). A chave secreta/service_role **nunca** vai para o app.
- Permissões: `grant` em `"SE"` só nas tabelas VST_ necessárias para `authenticated`, com **políticas RLS por usuário/propriedade** (ex.: só vê vistorias de propriedades em que está em `VST_USUARIO_PROPRIEDADE`). Leitura de `SIT_UNIDADE`/`SIT_RESERVA` pelo app de preferência via **funções** que devolvem só o necessário (datas, chalé, código da reserva), sem abrir as tabelas SIT_.
- O schema `"SE"` já está exposto na API (Settings › API › Exposed schemas).

## 6. Fotos das vistorias

- Bucket **privado** próprio, ex.: `vistorias` (não usar o bucket `documentos`, que guarda documentos de hóspedes).
- Caminho `vistorias/<ID_VISTORIA>/<arquivo>`; tipos `image/jpeg|png|webp`; limite de tamanho; políticas de Storage para o vistoriador só gravar/ler as vistorias que pode acessar.
- O registro da foto (`VST_FOTO`) guarda o caminho, não a imagem.

## 7. O que entregar para eu integrar

1. `migracao_vistorias.sql` (schema `"SE"`, VST_, RLS, grants, auditoria, tipos ENTRADA/SAIDA cadastrados) e os testes (`testes_vistorias.sql`), rodando sobre o banco atual sem apagar dados.
2. A lista de qualquer coluna nova proposta em tabela SIT_ (para revisão).
3. As funções que o app chama (nomes, parâmetros e quem pode executar).
4. O bucket e as políticas de Storage.
5. Avisar quando aplicado: então eu crio a geração automática (seção 4) e atualizo o DER único (site + vistorias).

## 8. O que não fazer

- Não criar tabelas em `public` nem nomes em minúsculas.
- Não alterar/renomear/apagar nada SIT_ nem as funções do site (`consultar_disponibilidade`, `consultar_precos`, `criar_pre_reserva`, `confirmar_reserva`, `confirmar_sinal`, `calcular_estadia`, `registrar_tentativa`, `pre_reserva_em_aberto`, `registrar_documentos`, `auditar`).
- Não religar o cadastro aberto do Auth.
- Não dar permissão a `anon` em nada; não expor CPF/passaporte/telefone de hóspede no app.
- Não rodar `remover_se.sql` (apaga o schema inteiro, com as reservas reais).
