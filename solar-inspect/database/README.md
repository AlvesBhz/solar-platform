# Banco de dados das vistorias (Solar Inspect)

As vistorias vivem no **mesmo projeto Supabase e no mesmo schema `"SE"`** das reservas do site (projeto `tnjpyjbqcjrowzjfnuln`).
Tabelas do projeto Vistorias começam com **`VST_`**; as do site, com **`SIT_`**. Nomes em MAIÚSCULAS entre aspas.

| Arquivo | O que é |
|---|---|
| `migracao_vistorias.sql` | A migração. Roda sobre o banco atual, sem alterar nem apagar nada do site; pode ser rodada de novo; tudo numa transação. |
| `testes_vistorias.sql` | 167 verificações (estrutura, contrato com o site, permissões, isolamento, fluxo do app, perfis, login e cadastro, Storage, auditoria). |
| `../supabase/functions/` | Edge Functions `login-vistoria` e `criar-usuario` (44 verificações em `teste.mjs`). |
| `simulado_supabase.sql` | Só para teste local: simula papéis, `auth.users`, `auth.uid()` e Storage. **Não rodar no Supabase.** |
| `der.html` e `dicionario-de-dados.md` | DER navegável e dicionário de dados (gerados por `tools/gerar-der.py`). |

## Como aplicar no Supabase

1. SQL Editor do projeto, colar `migracao_vistorias.sql` e rodar. Pré-requisito: `schema.sql` do site já aplicado (tabelas `SIT_`, função `auditar()`); a migração para com uma mensagem clara se faltar algo.
2. Publicar as duas Edge Functions (seção abaixo) e criar o **primeiro ADMIN** à mão: convidar em Authentication › Users, copiar o `id` e rodar `select "SE".vst_cadastrar_usuario('<id>', 'Nome', 'usuario', '<cpf>', 'ADMIN', '{}')` no SQL Editor. Os demais funcionários o ADMIN cadastra pelo app.
3. Cadastrar ambientes e itens de cada chalé (`"VST_AMBIENTE"`, `"VST_ITEM"`, `"VST_TIPO_VISTORIA_ITEM"`) e, em `"VST_PROPRIEDADE"`/`"VST_UNIDADE"`, o ponto de GPS e o raio.

Conferir também em Project Settings › API que o schema **`SE`** está em *Exposed schemas* (o site já depende disso).

Aplicar por script (confere, aplica, prova que o site não mudou e verifica): `python3 -I tools/aplicar-supabase.py` (veja `APLICAR_NA_SESSAO_SITE.md`). Para só conferir, `verificar_aplicacao.sql` (só lê) ou `--so-conferir`. Edge Functions: `tools/publicar-funcoes.sh`.

Testar antes, num banco descartável (nunca no de produção): `PGHOST=… PGPORT=… PGUSER=… tools/testar-banco.sh`
(o script também prova que tabelas, funções e gatilhos do site ficaram idênticos depois da migração).

## O que a migração cria

12 tabelas, todas com RLS ligado, nada para `anon`, e gatilho `"TG_<TABELA>_AUDITORIA"` gravando em `"SIT_AUDITORIA"`:
`VST_TIPO_VISTORIA` (com `ENTRADA`, `SAIDA`, `ROTINA` e `MANUTENCAO` já cadastrados), `VST_USUARIO`, `VST_USUARIO_PROPRIEDADE`,
`VST_PROPRIEDADE`, `VST_UNIDADE`, `VST_AMBIENTE`, `VST_ITEM`, `VST_TIPO_VISTORIA_ITEM`, `VST_VISTORIA`, `VST_RESPOSTA`, `VST_OCORRENCIA`, `VST_FOTO`.
Mais: funções `vst_*`, o bucket `vistorias` e suas políticas.

### Perfis (`VST_USUARIO.TP_PERFIL`)

| Perfil | Quem é | Pode |
|---|---|---|
| `ASSESSOR` | vistoria | ver a agenda da pousada, fazer vistorias (todos os tipos), criar vistoria avulsa para si, mudar a situação (`EM_LIMPEZA`, `LIBERADO`, `OCUPADO`) |
| `LIMPEZA` | limpeza | o mesmo, mas só nos tipos de vistoria liberados para ela (padrão: Saída e Rotina) |
| `MANUTENCAO` | manutenção | o mesmo, só nos tipos liberados (padrão: Manutenção e Rotina); além disso **trata ocorrências** (`EM_TRATAMENTO` ou `RESOLVIDA`), sem liberar o chalé nem cancelar |
| `GESTOR` | gestão da pousada | tudo do campo, mais agenda (atribuir, remarcar, cancelar), ocorrências, bloqueio, QR, `BLOQUEADO`/`MANUTENCAO`, checklist e GPS das pousadas dele |
| `ADMIN` | administração | tudo, em todas as pousadas; cadastra funcionários |

Quem da equipe de campo faz cada tipo de vistoria fica em `"VST_TIPO_VISTORIA"."DS_PERFIS"` (o ADMIN muda por tipo; gestor e admin fazem todos). Padrão: Entrada só `ASSESSOR`; Saída `ASSESSOR` e `LIMPEZA`; Rotina os três; Manutenção `ASSESSOR` e `MANUTENCAO`. Todos os perfis veem a agenda da pousada, mas só iniciam e criam vistoria dos tipos liberados (erro `perfil_sem_permissao`).

### Colunas propostas em tabelas SIT_

**Nenhuma.** A vistoria não altera `SIT_`: o que ela precisa por pousada e por chalé (validação de presença, GPS, raio, situação, QR, andar)
fica em `"VST_PROPRIEDADE"` e `"VST_UNIDADE"`, com a mesma chave do site (1 para 1; a migração já cria uma linha para cada pousada e chalé existentes).
Se o site preferir ter essas colunas em `SIT_PROPRIEDADE`/`SIT_UNIDADE`, é uma mudança futura e combinada.

### Contrato com a geração automática de vistorias (sessão do site)

- `"VST_TIPO_VISTORIA"."CD_TIPO_VISTORIA"` único; `ENTRADA` e `SAIDA` existem depois da migração.
- `"VST_VISTORIA"`: `ID_VISTORIA` (uuid, tem padrão), `ID_UNIDADE` e `ID_TIPO_VISTORIA` obrigatórios, `ID_RESERVA` opcional (FK sem cascade),
  `ID_VISTORIA_ENTRADA` opcional, `ID_USUARIO` opcional, `DT_AGENDADA` obrigatória, `TP_STATUS` (`AGENDADA`, `EM_ANDAMENTO`, `CONCLUIDA`, `CANCELADA`, padrão `AGENDADA`).
- Índice único parcial `"UQ_VST_VISTORIA_RESERVA_TIPO"` em (`ID_RESERVA`, `ID_TIPO_VISTORIA`) quando `ID_RESERVA` não é vazio.
- `service_role` (o site) tem acesso total às tabelas `VST_`: pode inserir, remarcar e cancelar direto, ou por função do próprio site.
- Gatilho `"TG_VST_VISTORIA_COERENCIA"`: a reserva e a vistoria de entrada têm de ser do mesmo chalé da vistoria. **Na remarcação, se o chalé mudar, troque `ID_RESERVA` e `ID_UNIDADE` no mesmo `UPDATE`.**
- Só `AGENDADA` deve ser mexida pelo site; as `EM_ANDAMENTO` e `CONCLUIDA` já têm respostas e fotos.

## Funções que o app chama

Todas minúsculas, `security definer`, `set search_path = "SE", extensions, pg_temp`; `revoke ... from public, anon, authenticated` e `grant execute` **só para `authenticated`**.
Cada uma lê `auth.uid()`, exige usuário ativo em `"VST_USUARIO"` e acesso à propriedade. Erros voltam com SQLSTATE `P0001` e uma mensagem curta (ex.: `sem_acesso`).

| Função | Parâmetros | Quem pode | Devolve |
|---|---|---|---|
| `vst_unidades()` | — | qualquer usuário ativo | chalés das pousadas dele, com validação, ponto, raio e situação (sem o QR) |
| `vst_agenda(p_dt_ini, p_dt_fim, p_id_unidade?)` | `date`, `date` (fim = dia seguinte), `bigint` | qualquer usuário ativo | vistorias do período com `cd_reserva`, `dt_checkin`, `dt_checkout` (nunca CPF, passaporte, telefone ou e-mail) |
| `vst_checklist(p_id_unidade, p_id_tipo_vistoria)` | `bigint`, `bigint` | quem tem acesso ao chalé | ambientes e itens ativos, na ordem de passagem |
| `vst_resolver_qr(p_cd_hash_qr)` | `text` | qualquer usuário ativo | chalé do QR lido, se tiver acesso |
| `vst_criar_vistoria(p_id_unidade, p_cd_tipo_vistoria, p_dt_agendada, p_id_vistoria?, p_id_reserva?, p_id_usuario?)` | `bigint`, `text`, `date`, `uuid`, `bigint`, `uuid` | assessor (para si, sem reserva); gestor/admin (qualquer responsável e reserva) | `uuid`; reenviar o mesmo id devolve a vistoria existente |
| `vst_atualizar_agenda(p_id_vistoria, p_id_usuario?, p_dt_agendada?, p_cancelar?)` | `uuid`, `uuid`, `date`, `boolean` | gestor, admin | atribui, remarca ou cancela vistoria `AGENDADA` |
| `vst_iniciar_vistoria(p_id_vistoria, p_cd_hash_qr?, p_vl_latitude?, p_vl_longitude?, p_qtde_precisao_metros?, p_dt_inicio?)` | `uuid`, `text`, `numeric`×3, `timestamptz` | assessor da vistoria (ou sem responsável), gestão | `tp_status`, `sg_fora_raio`, `qtde_distancia_metros`, `ds_sinalizacoes` |
| `vst_concluir_vistoria(p_id_vistoria, p_respostas, p_fotos?, p_ds_assinatura?, p_ds_observacao?, p_tp_situacao_resultante?, p_dt_fim?)` | `uuid`, `jsonb`, `jsonb`, `text`, `text`, `text`, `timestamptz` | responsável, gestão | `tp_status`, `ds_sinalizacoes`, `qtde_ocorrencias`, `id_bloqueio`; reenviar não duplica |
| `vst_registrar_foto(p_id_vistoria, p_id_item, p_cd_arquivo, …)` | `uuid`, `bigint`, `text`, lat/lon/precisão, `timestamptz`, `uuid` | responsável, gestão | `uuid` da foto (fotos que chegam depois da conclusão) |
| `vst_resolver_ocorrencia(p_id_ocorrencia, p_tp_status?, p_ds_tratamento?, p_liberar?)` | `bigint`, `text`, `text`, `boolean` | gestor, admin | trata a ocorrência; com `p_liberar` encerra o bloqueio e libera o chalé |
| `vst_bloquear_por_ocorrencia(p_id_ocorrencia, p_dt_fim?)` | `bigint`, `date` | gestor, admin | `id_bloqueio` (ocorrência de gravidade menor que decidiu bloquear) |
| `vst_alterar_situacao_unidade(p_id_unidade, p_tp_situacao)` | `bigint`, `text` | todos; `BLOQUEADO` e `MANUTENCAO` só gestor/admin | — |
| `vst_obter_qr(p_id_unidade)` / `vst_rotacionar_qr(p_id_unidade)` | `bigint` | gestor, admin | `cd_hash_qr`, `no_versao_qr` |

Formato do `p_respostas`: `[{"id_item":1,"tp_resposta":"OK|PROBLEMA|NAO_SE_APLICA","qtde_encontrada":4,"ds_observacao":"…","dt_resposta":"…"}]`.
Formato do `p_fotos`: `[{"id_foto":"uuid?","id_item":1,"cd_arquivo":"<ID_VISTORIA>/foto.jpg","vl_latitude":…,"vl_longitude":…,"qtde_precisao_metros":…,"dt_captura":"…"}]`.

Erros que o app trata: `usuario_inativo_ou_inexistente`, `sem_acesso`, `perfil_sem_permissao`, `vistoria_nao_agendada`, `vistoria_nao_iniciada`, `vistoria_de_outro_usuario`,
`qr_obrigatorio`, `qr_invalido`, `respostas_obrigatorias`, `itens_pendentes`, `item_fora_do_checklist`, `item_duplicado`, `foto_obrigatoria`, `foto_de_item_nao_respondido`,
`observacao_obrigatoria`, `assinatura_obrigatoria`, `ocorrencias_criticas_abertas`, `data_futura`, `periodo_invalido`.

Funções auxiliares (também só `authenticated`, devolvem verdadeiro/falso ou ids; usadas pelas políticas RLS): `vst_perfil`, `vst_tem_acesso`, `vst_pode_gerir`, `vst_tem_acesso_unidade`,
`vst_pode_gerir_unidade`, `vst_unidade_do_ambiente`, `vst_unidade_do_item`, `vst_pode_ver_usuario`, `vst_acesso_arquivo`. As internas (`vst_aplicar_situacao`, `vst_criar_bloqueio_manutencao`, `vst_mudar_situacao`, …) não são executáveis por ninguém de fora.

### Regras de negócio que as funções aplicam

- **Presença:** QR errado ou ausente (quando a validação exige QR) é recusado. GPS fora do raio, impreciso ou ausente **não bloqueia**: a vistoria é sinalizada (`FORA_RAIO`, `GPS_IMPRECISO`, `SEM_GPS`) e a gestão decide. Sem coordenadas cadastradas, registra `GPS_NAO_CONFIGURADO`.
- **Conclusão:** todos os itens do checklist respondidos, foto nos itens com foto obrigatória, assinatura na Saída, observação em cada `PROBLEMA`. Sinaliza `RAPIDA` (menos que o tempo mínimo) e `SEM_ENTRADA`.
- **Situação do chalé (pela vistoria):** Entrada concluída → `OCUPADO`; Saída concluída → `EM_LIMPEZA` (a equipe libera depois da limpeza); item crítico com problema → `MANUTENCAO`. Se quem conclui informar a situação, vale a informada. O padrão nunca tira o chalé de `MANUTENCAO` ou `BLOQUEADO`. O site não usa essa situação para vender: a venda continua por reservas e bloqueios.
- **Ocorrência:** cada `PROBLEMA` abre uma ocorrência (`CRITICA` se o item é crítico, senão `BAIXA`). Item crítico cria `SIT_BLOQUEIO` `MANUTENCAO` (hoje, prazo provisório de 7 dias, sem `ID_CALENDARIO`) e põe o chalé em `MANUTENCAO`.
- **Liberar:** `vst_resolver_ocorrencia(..., p_liberar := true)` encerra o bloqueio (`DT_FIM` = amanhã) e põe o chalé em `LIBERADO`; só se não restar ocorrência crítica aberta. Reserva confirmada que já existe nessas datas não é cancelada.
- **O app nunca escreve em `SIT_BLOQUEIO`** (nem lê reservas ou hóspedes direto): o único caminho é `vst_criar_bloqueio_manutencao`, chamada pelas funções acima.

## Login por usuário ou CPF e cadastro de funcionários (Edge Functions)

O Supabase Auth entra por e-mail; os funcionários não precisam ter e-mail. Cada funcionário recebe um e-mail interno (`<usuario>@usuarios.inspect.invalid`, nunca digitado) criado junto com o cadastro.

| Edge Function | Quem chama | O que faz |
|---|---|---|
| `login-vistoria` (sem JWT) | o app, antes do login | recebe `{login, senha}`; `login` é o usuário ou o CPF (com ou sem pontuação). Acha o funcionário ativo (`vst_localizar_login`), entra no Auth e devolve `{sessao, usuario}`. O app aplica a sessão com `supabase.auth.setSession`. A resposta de erro é a mesma para senha errada, usuário inexistente e inativo; no máximo 10 tentativas por usuário e 40 por IP, por hora (`registrar_tentativa`, do site). |
| `redefinir-senha` (JWT) | o ADMIN logado, no app | recebe `{cd_login, senha}` (8 a 72 caracteres) e define a nova senha do funcionário. Só ADMIN. A própria senha cada funcionário troca logado, com `supabase.auth.updateUser({ password })`. |
| `criar-usuario` (JWT) | o ADMIN logado, no app | recebe `{nm_usuario, cd_login, cd_cpf?, tp_perfil, senha, ids_propriedade}`. Só ADMIN passa. Cria o login no Auth e o cadastro (`vst_cadastrar_usuario`); se o banco recusar, apaga o login criado. Senha de 8 a 72 caracteres. Devolve `201 {id_usuario}` ou `409 login_em_uso`/`cpf_em_uso`, `422` com o motivo. |

Funções SQL só do `service_role` (nenhum usuário logado as executa): `vst_localizar_login(p_login)` e `vst_cadastrar_usuario(p_id_usuario, p_nm_usuario, p_cd_login, p_cd_cpf, p_tp_perfil, p_ids_propriedade)`.

Publicar (a chave secreta é injetada pelo próprio Supabase e não vai ao app nem ao GitHub):

```bash
supabase functions deploy login-vistoria --project-ref tnjpyjbqcjrowzjfnuln --workdir solar-inspect
supabase functions deploy criar-usuario  --project-ref tnjpyjbqcjrowzjfnuln --workdir solar-inspect
supabase secrets set ALLOWED_ORIGINS=https://alvesbhz.github.io --project-ref tnjpyjbqcjrowzjfnuln   # origem(ns) do app, separadas por vírgula
```

**Senha provisória e troca de senha (T35, `/conta/senha`):** quem é cadastrado (`vst_cadastrar_usuario`) ou tem a senha redefinida (`redefinir-senha` chama `vst_exigir_troca_senha`, só service_role) fica com `SG_TROCAR_SENHA = true`, e o app abre T35 antes de qualquer tela, inclusive a administração. A troca confere a senha atual (reautenticação), grava a nova com `supabase.auth.updateUser`, encerra as sessões dos outros aparelhos (`signOut({ scope: 'others' })`) e desmarca com `vst_senha_trocada()`. Regras da tela: 8 a 72 caracteres, letras e números, diferente da atual e sem o usuário. Qualquer perfil troca a própria senha quando quiser, pelo ícone de cadeado.

Esqueceu a senha: o ADMIN redefine pelo app (`redefinir-senha`). Para desligar um funcionário, `SG_ATIVO = false` em `VST_USUARIO`: ele deixa de entrar e de usar as funções na hora.

## Acesso direto às tabelas (RLS)

`authenticated` só **lê** as tabelas `VST_` (por acesso à propriedade: assessor e gestor veem as pousadas de `"VST_USUARIO_PROPRIEDADE"`, ADMIN vê todas) e **cadastra** o checklist (gestor/admin em ambientes, itens e tipos), tipos (ADMIN), equipe (ADMIN) e GPS/andar (gestor/admin).
Escrever vistoria, resposta, ocorrência, foto, situação e QR só pelas funções. `CD_HASH_QR` não tem permissão de leitura (use `vst_resolver_qr`); por isso o app deve **listar colunas** em `select` de `VST_UNIDADE`, ou usar `vst_unidades()`.

## Fotos (Storage)

- Bucket privado **`vistorias`** (o `documentos`, dos hóspedes, não é usado nem tocado): só JPEG, PNG e WEBP, até 5 MB.
- Objeto: `vistorias/<ID_VISTORIA>/<arquivo>`; `"VST_FOTO"."CD_ARQUIVO"` guarda `<ID_VISTORIA>/<arquivo>` (o nome dentro do bucket). A tabela guarda o caminho, não a imagem.
- Políticas em `storage.objects` (papel `authenticated`): **`vistorias_leitura`** (quem tem acesso ao chalé da vistoria) e **`vistorias_envio`** (o responsável ou a gestão, com a vistoria `EM_ANDAMENTO` ou `CONCLUIDA`, nome no formato `<uuid minúsculo>/<arquivo>.jpg|png|webp`). Não há política de alteração nem de exclusão: foto é evidência; quem apaga é o painel do Supabase.
- `anon` não lê nem grava.

## Para a sessão do site (dúvidas e propostas, nada disso foi alterado por aqui)

1. `auditar()` grava só o papel do banco (`authenticated`), não **quem** (`auth.uid()`). Para as vistorias seria útil incluir `auth.uid()` em `SIT_AUDITORIA`; é mudança em função do site, ficou como proposta.
2. A geração automática pode inserir direto em `"VST_VISTORIA"` como `service_role`. Na remarcação que troque de chalé, atualizar `ID_UNIDADE` junto com `ID_RESERVA`.
3. O bloqueio de manutenção nasce com prazo provisório de 7 dias; se o site preferir outro prazo ou um aviso de conflito com reserva confirmada, é só combinar (o painel de gestão faria o aviso).

## Pendências

- **Aplicação:** feita em 21/11/2026 no projeto `tnjpyjbqcjrowzjfnuln`: migração (já com `DS_PERFIS`) aplicada e verificada (16 de 16, nada do site alterado), Edge Functions `login-vistoria`, `criar-usuario` e `redefinir-senha` publicadas. Primeiro ADMIN criado (usuário `admin`, entra também pelo CPF) e login real testado: login por CPF e por usuário, senha errada recusada, `vst_perfil` e `vst_unidades` pelo caminho do app, leitura direta de `SIT_RESERVA` negada. **Senha provisória: trocar no primeiro acesso.**
- **Origem do app (`ALLOWED_ORIGINS`):** o padrão é `https://alvesbhz.github.io`; se o app Inspect for publicado em outro endereço, gravar o segredo.
