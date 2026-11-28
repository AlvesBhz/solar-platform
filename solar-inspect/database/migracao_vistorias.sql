-- ════════════════════════════════════════════════════════════════════
--  Solar Inspect · Vistorias — migração para o banco de reservas do site
--  PostgreSQL 15+ (Supabase), schema "SE" (o mesmo das reservas).
--
--  • Roda sobre o banco atual, sem apagar nem alterar nada do site: só cria
--    tabelas VST_, funções vst_*, políticas e o bucket "vistorias". Pode ser
--    rodada mais de uma vez (idempotente) e tudo acontece numa transação.
--  • Pré-requisito: schema.sql do site já aplicado (tabelas SIT_, auditar()).
--  • Nomes em MAIÚSCULAS entre aspas; tabelas do projeto começam com VST_.
--    Em SQL escrito à mão use sempre aspas: select * from "SE"."VST_VISTORIA";
--  • As colunas de que a vistoria precisa por propriedade e por chalé (GPS,
--    raio, situação, QR) ficam em VST_PROPRIEDADE e VST_UNIDADE (1 para 1
--    com as tabelas do site): nenhuma coluna é acrescentada a tabelas SIT_.
-- ════════════════════════════════════════════════════════════════════

begin;
set local search_path = "SE", extensions, pg_temp;

do $$ begin
  if to_regclass('"SE"."SIT_UNIDADE"') is null or to_regclass('"SE"."SIT_RESERVA"') is null
     or to_regclass('"SE"."SIT_BLOQUEIO"') is null or to_regclass('"SE"."SIT_PROPRIEDADE"') is null then
    raise exception 'Rode antes o schema.sql do site: as tabelas SIT_ do schema "SE" não existem.';
  end if;
  if to_regprocedure('"SE".auditar()') is null then
    raise exception 'A função auditar() do site não existe (schema.sql do site).';
  end if;
  if to_regclass('auth.users') is null then
    raise exception 'auth.users não existe: o projeto precisa do Supabase Auth.';
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════
--  1. TABELAS
-- ════════════════════════════════════════════════════════════════════

-- ── VST_TIPO_VISTORIA: Entrada, Saída, Rotina, Manutenção… ──────────────
create table if not exists "VST_TIPO_VISTORIA" (
  "ID_TIPO_VISTORIA"    bigint generated always as identity,
  "CD_TIPO_VISTORIA"    text not null,                     -- código usado pelo site (ENTRADA, SAIDA…)
  "NM_TIPO_VISTORIA"    text not null,
  "TP_COMPORTAMENTO"    text not null,                     -- regra que o app aplica
  "TP_PERIODICIDADE"    text,                              -- só rotina
  "SG_EXIGE_ENTRADA"    boolean not null default false,    -- saída compara com a entrada da mesma estadia
  "SG_EXIGE_ASSINATURA" boolean not null default false,
  "SG_ATIVO"            boolean not null default true,
  "DS_PERFIS"           text[] not null default array['ASSESSOR', 'LIMPEZA', 'MANUTENCAO'],   -- quem da equipe de campo faz este tipo (gestão faz todos)
  "DT_CRIACAO"          timestamptz not null default now(),
  constraint "PK_VST_TIPO_VISTORIA" primary key ("ID_TIPO_VISTORIA"),
  constraint "UQ_VST_TIPO_VISTORIA_CD_TIPO_VISTORIA" unique ("CD_TIPO_VISTORIA"),
  constraint "UQ_VST_TIPO_VISTORIA_NM_TIPO_VISTORIA" unique ("NM_TIPO_VISTORIA"),
  constraint "CK_VST_TIPO_VISTORIA_CD_TIPO_VISTORIA" check ("CD_TIPO_VISTORIA" ~ '^[A-Z0-9_]+$'),
  constraint "CK_VST_TIPO_VISTORIA_TP_COMPORTAMENTO" check ("TP_COMPORTAMENTO" in ('ENTRADA', 'SAIDA', 'ROTINA', 'MANUTENCAO')),
  constraint "CK_VST_TIPO_VISTORIA_TP_PERIODICIDADE" check ("TP_PERIODICIDADE" in ('DIARIA', 'SEMANAL', 'MENSAL')),
  constraint "CK_VST_TIPO_VISTORIA_ROTINA" check ("TP_COMPORTAMENTO" = 'ROTINA' or "TP_PERIODICIDADE" is null)
);

-- banco que já tinha a tabela sem DS_PERFIS: a coluna entra antes do seed, depois é preenchida e só então passa a ser obrigatória
alter table "VST_TIPO_VISTORIA" add column if not exists "DS_PERFIS" text[];
insert into "VST_TIPO_VISTORIA" ("CD_TIPO_VISTORIA", "NM_TIPO_VISTORIA", "TP_COMPORTAMENTO", "SG_EXIGE_ENTRADA", "SG_EXIGE_ASSINATURA", "DS_PERFIS") values
  ('ENTRADA',    'Entrada',    'ENTRADA',    false, false, array['ASSESSOR']),
  ('SAIDA',      'Saída',      'SAIDA',      true,  true,  array['ASSESSOR', 'LIMPEZA']),
  ('LIMPEZA',    'Limpeza',    'ROTINA',     false, false, array['ASSESSOR', 'LIMPEZA']),       -- controle das limpezas
  ('ROTINA',     'Rotina',     'ROTINA',     false, false, array['ASSESSOR', 'LIMPEZA', 'MANUTENCAO']),
  ('MANUTENCAO', 'Manutenção', 'MANUTENCAO', false, false, array['ASSESSOR', 'MANUTENCAO'])
on conflict ("CD_TIPO_VISTORIA") do nothing;

-- preenche DS_PERFIS dos tipos que já existiam (padrão de cada tipo) e só então exige valor
update "VST_TIPO_VISTORIA" set "DS_PERFIS" = case "CD_TIPO_VISTORIA"
    when 'ENTRADA' then array['ASSESSOR'] when 'SAIDA' then array['ASSESSOR', 'LIMPEZA'] when 'MANUTENCAO' then array['ASSESSOR', 'MANUTENCAO']
    else array['ASSESSOR', 'LIMPEZA', 'MANUTENCAO'] end
  where "DS_PERFIS" is null;
alter table "VST_TIPO_VISTORIA" alter column "DS_PERFIS" set default array['ASSESSOR', 'LIMPEZA', 'MANUTENCAO'], alter column "DS_PERFIS" set not null;
alter table "VST_TIPO_VISTORIA" drop constraint if exists "CK_VST_TIPO_VISTORIA_DS_PERFIS";
alter table "VST_TIPO_VISTORIA" add constraint "CK_VST_TIPO_VISTORIA_DS_PERFIS"
  check (cardinality("DS_PERFIS") >= 1 and "DS_PERFIS" <@ array['ASSESSOR', 'LIMPEZA', 'MANUTENCAO']);


-- ── VST_USUARIO: equipe (assessores, gestores, administradores) ─────────
-- ID_USUARIO = auth.users.id. Os usuários são convidados pela equipe
-- (Authentication › Users › Invite); o cadastro aberto do Auth fica desligado.
create table if not exists "VST_USUARIO" (
  "ID_USUARIO"      uuid not null,
  "NM_USUARIO"      text not null,
  "CD_LOGIN"        text not null,                         -- usuário de acesso (minúsculo)
  "CD_CPF"          text,                                  -- só números; também serve para entrar
  "TP_PERFIL"       text not null,                         -- ASSESSOR, LIMPEZA, MANUTENCAO, GESTOR ou ADMIN
  "SG_ATIVO"        boolean not null default true,
  "DT_ACEITE_LGPD"  timestamptz,                           -- aceite do termo de localização e fotos
  "SG_TROCAR_SENHA" boolean not null default false,         -- senha provisória: o app exige a troca (T35)
  "DT_CRIACAO"      timestamptz not null default now(),
  "DT_ATUALIZACAO"  timestamptz not null default now(),
  constraint "PK_VST_USUARIO" primary key ("ID_USUARIO"),
  constraint "FK_VST_USUARIO_AUTH_USERS" foreign key ("ID_USUARIO") references auth.users ("id"),
  constraint "UQ_VST_USUARIO_CD_LOGIN" unique ("CD_LOGIN"),
  constraint "UQ_VST_USUARIO_CD_CPF" unique ("CD_CPF"),
  constraint "CK_VST_USUARIO_CD_LOGIN" check ("CD_LOGIN" ~ '^[a-z][a-z0-9._-]{2,39}$'),   -- começa por letra: nunca se confunde com CPF
  constraint "CK_VST_USUARIO_CD_CPF" check ("CD_CPF" is null or "SE".cpf_valido("CD_CPF")),
  constraint "CK_VST_USUARIO_TP_PERFIL" check ("TP_PERFIL" in ('ASSESSOR', 'LIMPEZA', 'MANUTENCAO', 'GESTOR', 'ADMIN'))
);
-- perfis: ASSESSOR (vistoria), LIMPEZA e MANUTENCAO (equipe de campo, mesmas permissões do assessor), GESTOR e ADMIN (gestão)
alter table "VST_USUARIO" drop constraint if exists "CK_VST_USUARIO_TP_PERFIL";
alter table "VST_USUARIO" add constraint "CK_VST_USUARIO_TP_PERFIL" check ("TP_PERFIL" in ('ASSESSOR', 'LIMPEZA', 'MANUTENCAO', 'GESTOR', 'ADMIN'));
alter table "VST_USUARIO" drop constraint if exists "CK_VST_USUARIO_CD_LOGIN";
alter table "VST_USUARIO" add constraint "CK_VST_USUARIO_CD_LOGIN" check ("CD_LOGIN" ~ '^[a-z][a-z0-9._-]{2,39}$');
-- SG_TROCAR_SENHA: senha provisória (criada ou redefinida pelo ADMIN); o app exige a troca antes de seguir.
-- Ao criar a coluna, quem já existe fica marcado: todos receberam senha provisória.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'SE' and table_name = 'VST_USUARIO' and column_name = 'SG_TROCAR_SENHA') then
    alter table "SE"."VST_USUARIO" add column "SG_TROCAR_SENHA" boolean not null default false;
    update "SE"."VST_USUARIO" set "SG_TROCAR_SENHA" = true;
  end if;
end $$;

-- ── VST_USUARIO_PROPRIEDADE: quais pousadas cada usuário vê ─────────────
create table if not exists "VST_USUARIO_PROPRIEDADE" (
  "ID_USUARIO"      uuid not null,
  "ID_PROPRIEDADE"  bigint not null,
  "DT_CRIACAO"      timestamptz not null default now(),
  constraint "PK_VST_USUARIO_PROPRIEDADE" primary key ("ID_USUARIO", "ID_PROPRIEDADE"),
  constraint "FK_VST_USUARIO_PROPRIEDADE_VST_USUARIO" foreign key ("ID_USUARIO") references "VST_USUARIO" ("ID_USUARIO") on delete cascade,
  constraint "FK_VST_USUARIO_PROPRIEDADE_SIT_PROPRIEDADE" foreign key ("ID_PROPRIEDADE") references "SIT_PROPRIEDADE" ("ID_PROPRIEDADE") on delete cascade
);
create index if not exists "IX_VST_USUARIO_PROPRIEDADE_ID_PROPRIEDADE" on "VST_USUARIO_PROPRIEDADE" ("ID_PROPRIEDADE");

-- ── VST_USUARIO_UNIDADE: restringe o acesso a alguns chalés da pousada ──────
-- Sem linha para uma pousada, o usuário vê todos os chalés dela (como antes). Com linhas, só os chalés marcados.
create table if not exists "VST_USUARIO_UNIDADE" (
  "ID_USUARIO"  uuid   not null,
  "ID_UNIDADE"  bigint not null,
  "DT_CRIACAO"  timestamptz not null default now(),
  constraint "PK_VST_USUARIO_UNIDADE" primary key ("ID_USUARIO", "ID_UNIDADE"),
  constraint "FK_VST_USUARIO_UNIDADE_VST_USUARIO" foreign key ("ID_USUARIO") references "VST_USUARIO" ("ID_USUARIO") on delete cascade,
  constraint "FK_VST_USUARIO_UNIDADE_SIT_UNIDADE" foreign key ("ID_UNIDADE") references "SIT_UNIDADE" ("ID_UNIDADE") on delete cascade
);
create index if not exists "IX_VST_USUARIO_UNIDADE_ID_UNIDADE" on "VST_USUARIO_UNIDADE" ("ID_UNIDADE");

-- ── VST_PROPRIEDADE: regras de presença da pousada (1 para 1 com SIT_PROPRIEDADE) ──
create table if not exists "VST_PROPRIEDADE" (
  "ID_PROPRIEDADE"            bigint not null,
  "TP_VALIDACAO"              text not null default 'QR_E_GPS',   -- como a presença é validada por padrão
  "VL_LATITUDE"               numeric(9,6),                        -- centro do raio de presença
  "VL_LONGITUDE"              numeric(9,6),
  "QTDE_RAIO_METROS"          smallint not null default 100,
  "QTDE_PRECISAO_MAX_METROS"  smallint not null default 50,        -- pior precisão de GPS aceita
  "QTDE_MINUTOS_MIN_VISTORIA" smallint not null default 10,        -- abaixo disso a vistoria é sinalizada
  "DT_CRIACAO"                timestamptz not null default now(),
  "DT_ATUALIZACAO"            timestamptz not null default now(),
  constraint "PK_VST_PROPRIEDADE" primary key ("ID_PROPRIEDADE"),
  constraint "FK_VST_PROPRIEDADE_SIT_PROPRIEDADE" foreign key ("ID_PROPRIEDADE") references "SIT_PROPRIEDADE" ("ID_PROPRIEDADE") on delete cascade,
  constraint "CK_VST_PROPRIEDADE_TP_VALIDACAO" check ("TP_VALIDACAO" in ('QR', 'GPS', 'QR_E_GPS')),
  constraint "CK_VST_PROPRIEDADE_GPS" check (("VL_LATITUDE" is null) = ("VL_LONGITUDE" is null)
                                            and ("VL_LATITUDE" is null or ("VL_LATITUDE" between -90 and 90 and "VL_LONGITUDE" between -180 and 180))),
  constraint "CK_VST_PROPRIEDADE_RAIO" check ("QTDE_RAIO_METROS" between 10 and 1000),
  constraint "CK_VST_PROPRIEDADE_PRECISAO" check ("QTDE_PRECISAO_MAX_METROS" between 5 and 500),
  constraint "CK_VST_PROPRIEDADE_MINUTOS" check ("QTDE_MINUTOS_MIN_VISTORIA" between 0 and 240)
);

-- ── VST_UNIDADE: situação, QR e ponto de GPS do chalé (1 para 1 com SIT_UNIDADE) ──
create table if not exists "VST_UNIDADE" (
  "ID_UNIDADE"      bigint not null,
  "DS_ANDAR"        text,                                  -- andar ou bloco, para o assessor se localizar
  "TP_VALIDACAO"    text,                                  -- vazio herda da propriedade
  "VL_LATITUDE"     numeric(9,6),                          -- vazio usa o ponto da propriedade
  "VL_LONGITUDE"    numeric(9,6),
  "QTDE_RAIO_METROS" smallint,                             -- vazio usa o raio da propriedade
  "TP_SITUACAO"     text not null default 'LIBERADO',      -- só muda pelas funções vst_*
  "CD_HASH_QR"      text not null default replace(gen_random_uuid()::text, '-', ''),   -- código impresso no QR da porta
  "NO_VERSAO_QR"    smallint not null default 1,           -- rotacionar invalida as etiquetas antigas
  "DT_CRIACAO"      timestamptz not null default now(),
  "DT_ATUALIZACAO"  timestamptz not null default now(),
  constraint "PK_VST_UNIDADE" primary key ("ID_UNIDADE"),
  constraint "FK_VST_UNIDADE_SIT_UNIDADE" foreign key ("ID_UNIDADE") references "SIT_UNIDADE" ("ID_UNIDADE") on delete cascade,
  constraint "UQ_VST_UNIDADE_CD_HASH_QR" unique ("CD_HASH_QR"),
  constraint "CK_VST_UNIDADE_TP_VALIDACAO" check ("TP_VALIDACAO" in ('QR', 'GPS', 'QR_E_GPS')),
  constraint "CK_VST_UNIDADE_TP_SITUACAO" check ("TP_SITUACAO" in ('EM_LIMPEZA', 'LIBERADO', 'OCUPADO', 'BLOQUEADO', 'MANUTENCAO')),
  constraint "CK_VST_UNIDADE_GPS" check (("VL_LATITUDE" is null) = ("VL_LONGITUDE" is null)
                                        and ("VL_LATITUDE" is null or ("VL_LATITUDE" between -90 and 90 and "VL_LONGITUDE" between -180 and 180))),
  constraint "CK_VST_UNIDADE_RAIO" check ("QTDE_RAIO_METROS" between 10 and 1000)
);

-- Uma linha de configuração para cada propriedade e chalé que já existem
insert into "VST_PROPRIEDADE" ("ID_PROPRIEDADE") select "ID_PROPRIEDADE" from "SIT_PROPRIEDADE" on conflict do nothing;
insert into "VST_UNIDADE" ("ID_UNIDADE") select "ID_UNIDADE" from "SIT_UNIDADE" on conflict do nothing;

-- ── VST_AMBIENTE e VST_ITEM: o que se confere em cada chalé ─────────────
create table if not exists "VST_AMBIENTE" (
  "ID_AMBIENTE"         bigint generated always as identity,
  "ID_UNIDADE"          bigint not null,
  "NM_AMBIENTE"         text not null,                     -- Sala, Quarto, Banheiro, Varanda…
  "NO_ORDEM"            smallint not null default 0,
  "DS_FOTO_REFERENCIA"  text,                              -- caminho da foto de como deve ficar
  "SG_ATIVO"            boolean not null default true,
  "DT_CRIACAO"          timestamptz not null default now(),
  constraint "PK_VST_AMBIENTE" primary key ("ID_AMBIENTE"),
  constraint "FK_VST_AMBIENTE_SIT_UNIDADE" foreign key ("ID_UNIDADE") references "SIT_UNIDADE" ("ID_UNIDADE"),
  constraint "UQ_VST_AMBIENTE_NM_AMBIENTE" unique ("ID_UNIDADE", "NM_AMBIENTE"),
  constraint "CK_VST_AMBIENTE_NO_ORDEM" check ("NO_ORDEM" >= 0)
);

create table if not exists "VST_ITEM" (
  "ID_ITEM"              bigint generated always as identity,
  "ID_AMBIENTE"          bigint not null,
  "NM_ITEM"              text not null,
  "DS_ORIENTACAO"        text,                             -- como conferir
  "SG_CRITICO"           boolean not null default false,   -- problema aqui abre ocorrência CRITICA
  "SG_FOTO_OBRIGATORIA"  boolean not null default false,   -- exige foto mesmo quando está OK
  "QTDE_ESPERADA"        smallint,                         -- contagem esperada
  "NO_ORDEM"             smallint not null default 0,
  "SG_ATIVO"             boolean not null default true,
  "DT_CRIACAO"           timestamptz not null default now(),
  constraint "PK_VST_ITEM" primary key ("ID_ITEM"),
  constraint "FK_VST_ITEM_VST_AMBIENTE" foreign key ("ID_AMBIENTE") references "VST_AMBIENTE" ("ID_AMBIENTE"),
  constraint "UQ_VST_ITEM_NM_ITEM" unique ("ID_AMBIENTE", "NM_ITEM"),
  constraint "CK_VST_ITEM_QTDE_ESPERADA" check ("QTDE_ESPERADA" >= 0),
  constraint "CK_VST_ITEM_NO_ORDEM" check ("NO_ORDEM" >= 0)
);

create table if not exists "VST_TIPO_VISTORIA_ITEM" (
  "ID_TIPO_VISTORIA"  bigint not null,
  "ID_ITEM"           bigint not null,
  "NO_ORDEM"          smallint,                            -- ordem própria do tipo; vazio segue a do item
  constraint "PK_VST_TIPO_VISTORIA_ITEM" primary key ("ID_TIPO_VISTORIA", "ID_ITEM"),
  constraint "FK_VST_TIPO_VISTORIA_ITEM_VST_TIPO_VISTORIA" foreign key ("ID_TIPO_VISTORIA") references "VST_TIPO_VISTORIA" ("ID_TIPO_VISTORIA") on delete cascade,
  constraint "FK_VST_TIPO_VISTORIA_ITEM_VST_ITEM" foreign key ("ID_ITEM") references "VST_ITEM" ("ID_ITEM") on delete cascade
);
create index if not exists "IX_VST_TIPO_VISTORIA_ITEM_ID_ITEM" on "VST_TIPO_VISTORIA_ITEM" ("ID_ITEM");

-- ── VST_VISTORIA: uma vistoria, da agenda até a conclusão ───────────────
-- Nasce AGENDADA (o site cria Entrada e Saída quando a reserva é CONFIRMADA)
-- e, sem responsável; o assessor inicia, conclui e envia pelo celular.
create table if not exists "VST_VISTORIA" (
  "ID_VISTORIA"            uuid not null default gen_random_uuid(),   -- o celular pode gerar o id (uuid v7) e reenviar sem duplicar
  "ID_VISTORIA_ENTRADA"    uuid,                                      -- na Saída, a Entrada da mesma estadia
  "ID_USUARIO"             uuid,                                      -- responsável (vazio até alguém assumir)
  "ID_UNIDADE"             bigint not null,
  "ID_TIPO_VISTORIA"       bigint not null,
  "ID_RESERVA"             bigint,                                    -- vazio na vistoria avulsa
  "DT_AGENDADA"            date not null,
  "TP_STATUS"              text not null default 'AGENDADA',
  "DT_INICIO"              timestamptz,
  "DT_FIM"                 timestamptz,
  "TP_VALIDACAO"           text,                                      -- validação exigida no início
  "DT_RECEBIMENTO"         timestamptz,                               -- chegada ao servidor (pode ser bem depois, se offline)
  "VL_LATITUDE"            numeric(9,6),
  "VL_LONGITUDE"           numeric(9,6),
  "QTDE_PRECISAO_METROS"   smallint,
  "QTDE_DISTANCIA_METROS"  integer,                                   -- distância até o ponto do chalé
  "SG_FORA_RAIO"           boolean not null default false,
  "DS_SINALIZACOES"        text[],                                    -- FORA_RAIO, GPS_IMPRECISO, SEM_GPS, RAPIDA, SEM_ENTRADA…
  "DS_ASSINATURA"          text,                                      -- caminho da assinatura
  "TP_SITUACAO_RESULTANTE" text,                                      -- situação em que o chalé ficou
  "DS_OBSERVACAO"          text,
  "DT_CRIACAO"             timestamptz not null default now(),
  "DT_ATUALIZACAO"         timestamptz not null default now(),
  constraint "PK_VST_VISTORIA" primary key ("ID_VISTORIA"),
  constraint "FK_VST_VISTORIA_VST_VISTORIA_ENTRADA" foreign key ("ID_VISTORIA_ENTRADA") references "VST_VISTORIA" ("ID_VISTORIA"),
  constraint "FK_VST_VISTORIA_VST_USUARIO" foreign key ("ID_USUARIO") references "VST_USUARIO" ("ID_USUARIO"),
  constraint "FK_VST_VISTORIA_SIT_UNIDADE" foreign key ("ID_UNIDADE") references "SIT_UNIDADE" ("ID_UNIDADE"),
  constraint "FK_VST_VISTORIA_VST_TIPO_VISTORIA" foreign key ("ID_TIPO_VISTORIA") references "VST_TIPO_VISTORIA" ("ID_TIPO_VISTORIA"),
  constraint "FK_VST_VISTORIA_SIT_RESERVA" foreign key ("ID_RESERVA") references "SIT_RESERVA" ("ID_RESERVA"),
  constraint "CK_VST_VISTORIA_TP_STATUS" check ("TP_STATUS" in ('AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA')),
  constraint "CK_VST_VISTORIA_TP_VALIDACAO" check ("TP_VALIDACAO" in ('QR', 'GPS', 'QR_E_GPS')),
  constraint "CK_VST_VISTORIA_TP_SITUACAO_RESULTANTE" check ("TP_SITUACAO_RESULTANTE" in ('EM_LIMPEZA', 'LIBERADO', 'OCUPADO', 'BLOQUEADO', 'MANUTENCAO')),
  constraint "CK_VST_VISTORIA_PERIODO" check ("DT_FIM" is null or ("DT_INICIO" is not null and "DT_FIM" >= "DT_INICIO")),
  constraint "CK_VST_VISTORIA_ANDAMENTO" check ("TP_STATUS" <> 'EM_ANDAMENTO' or ("DT_INICIO" is not null and "ID_USUARIO" is not null)),
  constraint "CK_VST_VISTORIA_CONCLUIDA" check ("TP_STATUS" <> 'CONCLUIDA' or ("DT_INICIO" is not null and "DT_FIM" is not null and "ID_USUARIO" is not null)),
  constraint "CK_VST_VISTORIA_GPS" check (("VL_LATITUDE" is null) = ("VL_LONGITUDE" is null)),
  constraint "CK_VST_VISTORIA_ENTRADA" check ("ID_VISTORIA_ENTRADA" is null or "ID_VISTORIA_ENTRADA" <> "ID_VISTORIA")
);
-- no máximo uma vistoria de cada tipo por reserva (vistoria avulsa não tem reserva)
create unique index if not exists "UQ_VST_VISTORIA_RESERVA_TIPO" on "VST_VISTORIA" ("ID_RESERVA", "ID_TIPO_VISTORIA") where "ID_RESERVA" is not null;
create index if not exists "IX_VST_VISTORIA_ID_UNIDADE_DT_AGENDADA" on "VST_VISTORIA" ("ID_UNIDADE", "DT_AGENDADA");
create index if not exists "IX_VST_VISTORIA_ID_USUARIO" on "VST_VISTORIA" ("ID_USUARIO") where "ID_USUARIO" is not null;
create index if not exists "IX_VST_VISTORIA_ID_TIPO_VISTORIA" on "VST_VISTORIA" ("ID_TIPO_VISTORIA");
create index if not exists "IX_VST_VISTORIA_ID_VISTORIA_ENTRADA" on "VST_VISTORIA" ("ID_VISTORIA_ENTRADA") where "ID_VISTORIA_ENTRADA" is not null;
create index if not exists "IX_VST_VISTORIA_AGENDA" on "VST_VISTORIA" ("DT_AGENDADA") where "TP_STATUS" in ('AGENDADA', 'EM_ANDAMENTO');

-- Coerência que um CHECK não alcança: a reserva e a entrada têm de ser do mesmo chalé.
-- Na remarcação, troque ID_RESERVA e ID_UNIDADE no mesmo UPDATE se o chalé mudar.
create or replace function vst_coerencia_vistoria()
returns trigger
language plpgsql
security definer
set search_path = "SE", extensions, pg_temp
as $$
begin
  if new."ID_RESERVA" is not null and not exists (
       select 1 from "SIT_RESERVA" r where r."ID_RESERVA" = new."ID_RESERVA" and r."ID_UNIDADE" = new."ID_UNIDADE") then
    raise exception 'reserva_de_outra_unidade' using errcode = 'P0001';
  end if;
  if new."ID_VISTORIA_ENTRADA" is not null and not exists (
       select 1 from "VST_VISTORIA" e join "VST_TIPO_VISTORIA" t on t."ID_TIPO_VISTORIA" = e."ID_TIPO_VISTORIA"
       where e."ID_VISTORIA" = new."ID_VISTORIA_ENTRADA" and e."ID_UNIDADE" = new."ID_UNIDADE" and t."TP_COMPORTAMENTO" = 'ENTRADA') then
    raise exception 'entrada_invalida' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then new."DT_ATUALIZACAO" := now(); end if;
  return new;
end;
$$;
drop trigger if exists "TG_VST_VISTORIA_COERENCIA" on "VST_VISTORIA";
create trigger "TG_VST_VISTORIA_COERENCIA" before insert or update on "VST_VISTORIA"
  for each row execute function vst_coerencia_vistoria();

-- ── VST_RESPOSTA: a resposta de cada item ───────────────────────────────
create table if not exists "VST_RESPOSTA" (
  "ID_VISTORIA"      uuid not null,
  "ID_ITEM"          bigint not null,
  "TP_RESPOSTA"      text not null,
  "QTDE_ENCONTRADA"  smallint,
  "DS_OBSERVACAO"    text,
  "DT_RESPOSTA"      timestamptz not null default now(),
  constraint "PK_VST_RESPOSTA" primary key ("ID_VISTORIA", "ID_ITEM"),
  constraint "FK_VST_RESPOSTA_VST_VISTORIA" foreign key ("ID_VISTORIA") references "VST_VISTORIA" ("ID_VISTORIA") on delete cascade,
  constraint "FK_VST_RESPOSTA_VST_ITEM" foreign key ("ID_ITEM") references "VST_ITEM" ("ID_ITEM"),
  constraint "CK_VST_RESPOSTA_TP_RESPOSTA" check ("TP_RESPOSTA" in ('OK', 'PROBLEMA', 'NAO_SE_APLICA')),
  constraint "CK_VST_RESPOSTA_QTDE_ENCONTRADA" check ("QTDE_ENCONTRADA" >= 0),
  constraint "CK_VST_RESPOSTA_PROBLEMA_OBSERVACAO" check ("TP_RESPOSTA" <> 'PROBLEMA' or nullif(btrim("DS_OBSERVACAO"), '') is not null)
);
create index if not exists "IX_VST_RESPOSTA_ID_ITEM" on "VST_RESPOSTA" ("ID_ITEM");

-- ── VST_OCORRENCIA: problema que precisa de tratamento ──────────────────
create table if not exists "VST_OCORRENCIA" (
  "ID_OCORRENCIA"   bigint generated always as identity,
  "ID_VISTORIA"     uuid not null,
  "ID_ITEM"         bigint not null,
  "ID_UNIDADE"      bigint not null,                       -- copiado da vistoria: filtra o painel por chalé
  "ID_BLOQUEIO"     bigint,                                -- bloqueio MANUTENCAO criado no site, quando houver
  "TP_GRAVIDADE"    text not null,
  "TP_STATUS"       text not null default 'ABERTA',
  "DS_OCORRENCIA"   text not null,
  "DS_TRATAMENTO"   text,
  "DT_ABERTURA"     timestamptz not null default now(),
  "DT_RESOLUCAO"    timestamptz,
  "ID_RESPONSAVEL"  uuid,                                  -- quem cuida do tratamento (gestão define)
  "DT_PRAZO"        date,                                  -- até quando resolver
  constraint "PK_VST_OCORRENCIA" primary key ("ID_OCORRENCIA"),
  constraint "FK_VST_OCORRENCIA_VST_RESPOSTA" foreign key ("ID_VISTORIA", "ID_ITEM") references "VST_RESPOSTA" ("ID_VISTORIA", "ID_ITEM") on delete cascade,
  constraint "FK_VST_OCORRENCIA_SIT_UNIDADE" foreign key ("ID_UNIDADE") references "SIT_UNIDADE" ("ID_UNIDADE"),
  constraint "FK_VST_OCORRENCIA_SIT_BLOQUEIO" foreign key ("ID_BLOQUEIO") references "SIT_BLOQUEIO" ("ID_BLOQUEIO") on delete set null,
  constraint "FK_VST_OCORRENCIA_VST_USUARIO" foreign key ("ID_RESPONSAVEL") references "VST_USUARIO" ("ID_USUARIO"),
  constraint "UQ_VST_OCORRENCIA_RESPOSTA" unique ("ID_VISTORIA", "ID_ITEM"),
  constraint "CK_VST_OCORRENCIA_TP_GRAVIDADE" check ("TP_GRAVIDADE" in ('BAIXA', 'MEDIA', 'CRITICA')),
  constraint "CK_VST_OCORRENCIA_TP_STATUS" check ("TP_STATUS" in ('ABERTA', 'EM_TRATAMENTO', 'RESOLVIDA', 'CANCELADA')),
  constraint "CK_VST_OCORRENCIA_RESOLUCAO" check ("TP_STATUS" <> 'RESOLVIDA' or "DT_RESOLUCAO" is not null)
);
create index if not exists "IX_VST_OCORRENCIA_ID_UNIDADE_STATUS" on "VST_OCORRENCIA" ("ID_UNIDADE", "TP_STATUS");
create index if not exists "IX_VST_OCORRENCIA_ID_ITEM" on "VST_OCORRENCIA" ("ID_ITEM");
create index if not exists "IX_VST_OCORRENCIA_ID_BLOQUEIO" on "VST_OCORRENCIA" ("ID_BLOQUEIO") where "ID_BLOQUEIO" is not null;
-- responsável e prazo (acrescentados depois: em banco já existente, entram no fim da tabela)
alter table "VST_OCORRENCIA" add column if not exists "ID_RESPONSAVEL" uuid;
alter table "VST_OCORRENCIA" add column if not exists "DT_PRAZO" date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'FK_VST_OCORRENCIA_VST_USUARIO') then
    alter table "SE"."VST_OCORRENCIA" add constraint "FK_VST_OCORRENCIA_VST_USUARIO" foreign key ("ID_RESPONSAVEL") references "SE"."VST_USUARIO" ("ID_USUARIO");
  end if;
end $$;
create index if not exists "IX_VST_OCORRENCIA_ID_RESPONSAVEL" on "VST_OCORRENCIA" ("ID_RESPONSAVEL") where "ID_RESPONSAVEL" is not null;

-- ── VST_FOTO: guarda o caminho no Storage, não a imagem ─────────────────
-- CD_ARQUIVO = nome do objeto no bucket "vistorias": <ID_VISTORIA>/<arquivo>
-- (caminho completo: vistorias/<ID_VISTORIA>/<arquivo>).
create table if not exists "VST_FOTO" (
  "ID_FOTO"               uuid not null default gen_random_uuid(),
  "ID_VISTORIA"           uuid not null,
  "ID_ITEM"               bigint not null,
  "CD_ARQUIVO"            text not null,
  "VL_LATITUDE"           numeric(9,6),
  "VL_LONGITUDE"          numeric(9,6),
  "QTDE_PRECISAO_METROS"  smallint,
  "SG_FORA_RAIO"          boolean not null default false,
  "DT_CAPTURA"            timestamptz not null default now(),   -- momento da câmera, não do envio
  constraint "PK_VST_FOTO" primary key ("ID_FOTO"),
  constraint "FK_VST_FOTO_VST_RESPOSTA" foreign key ("ID_VISTORIA", "ID_ITEM") references "VST_RESPOSTA" ("ID_VISTORIA", "ID_ITEM") on delete cascade,
  constraint "UQ_VST_FOTO_CD_ARQUIVO" unique ("CD_ARQUIVO"),
  constraint "CK_VST_FOTO_CD_ARQUIVO" check ("CD_ARQUIVO" like "ID_VISTORIA"::text || '/%'
                                            and "CD_ARQUIVO" ~* '^[0-9a-f-]{36}/[A-Za-z0-9._-]+\.(jpe?g|png|webp)$'),
  constraint "CK_VST_FOTO_GPS" check (("VL_LATITUDE" is null) = ("VL_LONGITUDE" is null))
);
create index if not exists "IX_VST_FOTO_RESPOSTA" on "VST_FOTO" ("ID_VISTORIA", "ID_ITEM");

-- ── VST_AUDITORIA: QUEM (usuário do app) mudou o quê nas tabelas VST_ ─
-- Complementa SIT_AUDITORIA, que grava só o papel do banco (authenticated). Escrita só pelo gatilho
-- vst_auditar_autor(); ninguém altera nem apaga. Leitura só do ADMIN, pela função vst_auditoria (T34).
-- Sem gatilho auditar() nesta tabela: auditar o próprio log duplicaria cada registro em SIT_AUDITORIA.
create table if not exists "VST_AUDITORIA" (
  "ID_AUDITORIA"   bigint generated always as identity,
  "ID_USUARIO"     uuid,                                   -- auth.uid(); vazio = site, service_role ou SQL Editor
  "NM_PAPEL"       text not null,                          -- papel do banco: authenticated, service_role, postgres…
  "NM_TABELA"      text not null,
  "TP_OPERACAO"    text not null,
  "CD_REGISTRO"    text,                                   -- chave do registro alterado
  "ID_UNIDADE"     bigint,                                 -- unidade envolvida, quando a linha tem uma
  "DS_ALTERACOES"  jsonb not null,                         -- INSERT/DELETE: campos; UPDATE: só os alterados {campo: [antes, depois]}; CPF e QR mascarados
  "DT_CRIACAO"     timestamptz not null default now(),
  constraint "PK_VST_AUDITORIA" primary key ("ID_AUDITORIA"),
  constraint "CK_VST_AUDITORIA_TP_OPERACAO" check ("TP_OPERACAO" in ('INSERT', 'UPDATE', 'DELETE'))
);
create index if not exists "IX_VST_AUDITORIA_DT_CRIACAO" on "VST_AUDITORIA" ("DT_CRIACAO");
create index if not exists "IX_VST_AUDITORIA_ID_USUARIO" on "VST_AUDITORIA" ("ID_USUARIO", "DT_CRIACAO");


-- ════════════════════════════════════════════════════════════════════
--  2. FUNÇÕES AUXILIARES (acesso por usuário e propriedade)
--  Chamadas pelas políticas RLS; devolvem só verdadeiro/falso ou ids.
-- ════════════════════════════════════════════════════════════════════

create or replace function vst_perfil()
returns text language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select u."TP_PERFIL" from "VST_USUARIO" u where u."ID_USUARIO" = (select auth.uid()) and u."SG_ATIVO"
$$;

create or replace function vst_tem_acesso(p_id_propriedade bigint)
returns boolean language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select exists (select 1 from "VST_USUARIO" u
                 where u."ID_USUARIO" = (select auth.uid()) and u."SG_ATIVO"
                   and (u."TP_PERFIL" = 'ADMIN'
                        or exists (select 1 from "VST_USUARIO_PROPRIEDADE" up
                                   where up."ID_USUARIO" = u."ID_USUARIO" and up."ID_PROPRIEDADE" = p_id_propriedade)))
$$;

create or replace function vst_pode_gerir(p_id_propriedade bigint)
returns boolean language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select exists (select 1 from "VST_USUARIO" u
                 where u."ID_USUARIO" = (select auth.uid()) and u."SG_ATIVO" and u."TP_PERFIL" in ('GESTOR', 'ADMIN')
                   and (u."TP_PERFIL" = 'ADMIN'
                        or exists (select 1 from "VST_USUARIO_PROPRIEDADE" up
                                   where up."ID_USUARIO" = u."ID_USUARIO" and up."ID_PROPRIEDADE" = p_id_propriedade)))
$$;

create or replace function vst_propriedade_da_unidade(p_id_unidade bigint)
returns bigint language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select "ID_PROPRIEDADE" from "SIT_UNIDADE" where "ID_UNIDADE" = p_id_unidade
$$;

-- o usuário alcança o chalé? ADMIN: todos. Demais: a pousada precisa estar vinculada e, se houver chalés marcados
-- para ele nessa pousada (VST_USUARIO_UNIDADE), o chalé precisa ser um deles.
create or replace function vst_alcanca_unidade(p_id_usuario uuid, p_id_unidade bigint)
returns boolean language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select exists (
    select 1 from "VST_USUARIO" u join "SIT_UNIDADE" su on su."ID_UNIDADE" = p_id_unidade
    where u."ID_USUARIO" = p_id_usuario and u."SG_ATIVO"
      and (u."TP_PERFIL" = 'ADMIN'
           or (exists (select 1 from "VST_USUARIO_PROPRIEDADE" up where up."ID_USUARIO" = u."ID_USUARIO" and up."ID_PROPRIEDADE" = su."ID_PROPRIEDADE")
               and (not exists (select 1 from "VST_USUARIO_UNIDADE" uu join "SIT_UNIDADE" x on x."ID_UNIDADE" = uu."ID_UNIDADE"
                                where uu."ID_USUARIO" = u."ID_USUARIO" and x."ID_PROPRIEDADE" = su."ID_PROPRIEDADE")
                    or exists (select 1 from "VST_USUARIO_UNIDADE" uu where uu."ID_USUARIO" = u."ID_USUARIO" and uu."ID_UNIDADE" = p_id_unidade)))))
$$;

create or replace function vst_tem_acesso_unidade(p_id_unidade bigint)
returns boolean language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select "SE".vst_alcanca_unidade((select auth.uid()), p_id_unidade)
$$;

create or replace function vst_pode_gerir_unidade(p_id_unidade bigint)
returns boolean language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select "SE".vst_pode_gerir("SE".vst_propriedade_da_unidade(p_id_unidade)) and "SE".vst_alcanca_unidade((select auth.uid()), p_id_unidade)
$$;

create or replace function vst_unidade_do_ambiente(p_id_ambiente bigint)
returns bigint language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select "ID_UNIDADE" from "VST_AMBIENTE" where "ID_AMBIENTE" = p_id_ambiente
$$;

create or replace function vst_unidade_do_item(p_id_item bigint)
returns bigint language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select a."ID_UNIDADE" from "VST_ITEM" i join "VST_AMBIENTE" a on a."ID_AMBIENTE" = i."ID_AMBIENTE" where i."ID_ITEM" = p_id_item
$$;

-- gestor vê a equipe das pousadas dele; ADMIN vê todos
create or replace function vst_pode_ver_usuario(p_id_usuario uuid)
returns boolean language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select exists (select 1 from "VST_USUARIO" me
                 where me."ID_USUARIO" = (select auth.uid()) and me."SG_ATIVO"
                   and (me."TP_PERFIL" = 'ADMIN'
                        or (me."TP_PERFIL" = 'GESTOR'
                            and exists (select 1 from "VST_USUARIO_PROPRIEDADE" a
                                        join "VST_USUARIO_PROPRIEDADE" b on b."ID_PROPRIEDADE" = a."ID_PROPRIEDADE"
                                        where a."ID_USUARIO" = me."ID_USUARIO" and b."ID_USUARIO" = p_id_usuario))))
$$;

-- acesso a um arquivo do bucket "vistorias" pelo nome: <ID_VISTORIA>/<arquivo>
create or replace function vst_acesso_arquivo(p_nome text, p_gravar boolean)
returns boolean language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
declare v_id uuid;
begin
  if p_nome !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$' then return false; end if;
  v_id := split_part(p_nome, '/', 1)::uuid;
  if p_gravar and p_nome !~* '\.(jpe?g|png|webp)$' then return false; end if;
  return exists (select 1 from "VST_VISTORIA" v
                 where v."ID_VISTORIA" = v_id and "SE".vst_tem_acesso_unidade(v."ID_UNIDADE")
                   and (not p_gravar
                        or (v."TP_STATUS" in ('EM_ANDAMENTO', 'CONCLUIDA')
                            and (v."ID_USUARIO" = (select auth.uid()) or "SE".vst_pode_gerir_unidade(v."ID_UNIDADE")))));
end;
$$;

-- distância em metros entre dois pontos (haversine)
create or replace function vst_distancia_metros(p_lat1 numeric, p_lon1 numeric, p_lat2 numeric, p_lon2 numeric)
returns integer language sql immutable strict set search_path = "SE", extensions, pg_temp as $$
  select round(2 * 6371000 * asin(sqrt(
           sin(radians((p_lat2 - p_lat1)::float8) / 2) ^ 2
           + cos(radians(p_lat1::float8)) * cos(radians(p_lat2::float8)) * sin(radians((p_lon2 - p_lon1)::float8) / 2) ^ 2)))::integer
$$;

-- configuração efetiva de presença de um chalé (chalé > propriedade > padrão)
create or replace function vst_config_unidade(p_id_unidade bigint)
returns table (id_propriedade bigint, tp_validacao text, vl_latitude numeric, vl_longitude numeric, qtde_raio_metros int,
               qtde_precisao_max_metros int, qtde_minutos_min_vistoria int, ds_fuso_horario text, cd_hash_qr text, tp_situacao text)
language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select u."ID_PROPRIEDADE",
         coalesce(vu."TP_VALIDACAO", vp."TP_VALIDACAO", 'QR_E_GPS'),
         case when vu."VL_LATITUDE" is not null then vu."VL_LATITUDE" else vp."VL_LATITUDE" end,
         case when vu."VL_LATITUDE" is not null then vu."VL_LONGITUDE" else vp."VL_LONGITUDE" end,
         coalesce(vu."QTDE_RAIO_METROS", vp."QTDE_RAIO_METROS", 100)::int,
         coalesce(vp."QTDE_PRECISAO_MAX_METROS", 50)::int,
         coalesce(vp."QTDE_MINUTOS_MIN_VISTORIA", 10)::int,
         p."DS_FUSO_HORARIO", vu."CD_HASH_QR", coalesce(vu."TP_SITUACAO", 'LIBERADO')
  from "SIT_UNIDADE" u
  join "SIT_PROPRIEDADE" p on p."ID_PROPRIEDADE" = u."ID_PROPRIEDADE"
  left join "VST_PROPRIEDADE" vp on vp."ID_PROPRIEDADE" = u."ID_PROPRIEDADE"
  left join "VST_UNIDADE" vu on vu."ID_UNIDADE" = u."ID_UNIDADE"
  where u."ID_UNIDADE" = p_id_unidade
$$;

create or replace function vst_hoje(p_id_unidade bigint)
returns date language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select (now() at time zone p."DS_FUSO_HORARIO")::date
  from "SIT_UNIDADE" u join "SIT_PROPRIEDADE" p on p."ID_PROPRIEDADE" = u."ID_PROPRIEDADE" where u."ID_UNIDADE" = p_id_unidade
$$;

-- a equipe de campo só faz os tipos de vistoria listados em DS_PERFIS; gestor e admin fazem todos
create or replace function vst_perfil_pode_tipo(p_perfil text, p_id_tipo bigint)
returns boolean language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select p_perfil in ('GESTOR', 'ADMIN')
         or exists (select 1 from "VST_TIPO_VISTORIA" t where t."ID_TIPO_VISTORIA" = p_id_tipo and p_perfil = any(t."DS_PERFIS"))
$$;

-- usuário da sessão; erro se não existir ou estiver inativo
create or replace function vst_usuario_atual()
returns "VST_USUARIO" language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
declare u "VST_USUARIO"%rowtype;
begin
  select * into u from "VST_USUARIO" where "ID_USUARIO" = (select auth.uid()) and "SG_ATIVO";
  if not found then raise exception 'usuario_inativo_ou_inexistente' using errcode = 'P0001'; end if;
  return u;
end;
$$;

-- grava a situação do chalé (cria a linha de configuração se faltar)
create or replace function vst_aplicar_situacao(p_id_unidade bigint, p_tp_situacao text)
returns void language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
begin
  insert into "VST_UNIDADE" ("ID_UNIDADE") select p_id_unidade where exists (select 1 from "SIT_UNIDADE" where "ID_UNIDADE" = p_id_unidade) on conflict do nothing;
  update "VST_UNIDADE" set "TP_SITUACAO" = p_tp_situacao, "DT_ATUALIZACAO" = now() where "ID_UNIDADE" = p_id_unidade;
end;
$$;

-- Cria (ou reaproveita) o bloqueio de manutenção que tira o chalé da venda.
-- ÚNICO caminho de escrita em SIT_BLOQUEIO a partir das vistorias.
create or replace function vst_criar_bloqueio_manutencao(p_id_ocorrencia bigint, p_dt_fim date default null)
returns bigint language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare o "VST_OCORRENCIA"%rowtype; v_hoje date; v_fim date; v_bloq bigint;
begin
  select * into o from "VST_OCORRENCIA" where "ID_OCORRENCIA" = p_id_ocorrencia for update;
  if not found then raise exception 'ocorrencia_inexistente' using errcode = 'P0001'; end if;
  if o."ID_BLOQUEIO" is not null then return o."ID_BLOQUEIO"; end if;
  v_hoje := "SE".vst_hoje(o."ID_UNIDADE");
  v_fim := coalesce(p_dt_fim, v_hoje + 7);                     -- prazo provisório de 7 dias; liberar a unidade encurta
  if v_fim <= v_hoje then raise exception 'data_fim_invalida' using errcode = 'P0001'; end if;
  select b."ID_BLOQUEIO" into v_bloq from "SIT_BLOQUEIO" b
  where b."ID_UNIDADE" = o."ID_UNIDADE" and b."TP_MOTIVO" = 'MANUTENCAO' and b."DT_INI" <= v_hoje and b."DT_FIM" > v_hoje
    and exists (select 1 from "VST_OCORRENCIA" x where x."ID_BLOQUEIO" = b."ID_BLOQUEIO")
  order by b."DT_FIM" desc limit 1;
  if v_bloq is null then
    insert into "SIT_BLOQUEIO" ("ID_UNIDADE", "DT_INI", "DT_FIM", "TP_MOTIVO", "DS_OBSERVACAO")
    values (o."ID_UNIDADE", v_hoje, v_fim, 'MANUTENCAO', left('Vistoria · ocorrência ' || o."ID_OCORRENCIA" || ': ' || o."DS_OCORRENCIA", 300))
    returning "ID_BLOQUEIO" into v_bloq;
  elsif p_dt_fim is not null then
    update "SIT_BLOQUEIO" set "DT_FIM" = greatest("DT_FIM", p_dt_fim) where "ID_BLOQUEIO" = v_bloq;
  end if;
  update "VST_OCORRENCIA" set "ID_BLOQUEIO" = v_bloq where "ID_OCORRENCIA" = p_id_ocorrencia;
  perform "SE".vst_aplicar_situacao(o."ID_UNIDADE", 'MANUTENCAO');
  return v_bloq;
end;
$$;

-- Login por usuário ou CPF: a Edge Function (chave secreta, nunca no app) acha o e-mail do funcionário ativo.
-- Só service_role executa. O e-mail é interno (criado junto com o usuário), o funcionário nunca o digita.
create or replace function vst_localizar_login(p_login text)
returns table (id_usuario uuid, ds_email text, sg_ativo boolean, tp_perfil text, nm_usuario text)
language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select u."ID_USUARIO", a.email::text, u."SG_ATIVO", u."TP_PERFIL", u."NM_USUARIO"
  from "VST_USUARIO" u join auth.users a on a.id = u."ID_USUARIO"
  where u."CD_LOGIN" = lower(btrim(p_login)) or u."CD_CPF" = regexp_replace(p_login, '\D', '', 'g')
$$;

-- Cadastro de funcionário (a Edge Function criar-usuario cria o login no Auth e chama esta função).
create or replace function vst_cadastrar_usuario(p_id_usuario uuid, p_nm_usuario text, p_cd_login text, p_cd_cpf text,
                                                 p_tp_perfil text, p_ids_propriedade bigint[] default '{}')
returns uuid language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare v_cpf text := nullif(regexp_replace(coalesce(p_cd_cpf, ''), '\D', '', 'g'), '');
begin
  if p_tp_perfil is null or p_tp_perfil not in ('ASSESSOR', 'LIMPEZA', 'MANUTENCAO', 'GESTOR', 'ADMIN') then
    raise exception 'perfil_invalido' using errcode = 'P0001';
  end if;
  if v_cpf is not null and not "SE".cpf_valido(v_cpf) then raise exception 'cpf_invalido' using errcode = 'P0001'; end if;
  if exists (select 1 from unnest(coalesce(p_ids_propriedade, '{}')) i where not exists (select 1 from "SIT_PROPRIEDADE" p where p."ID_PROPRIEDADE" = i)) then
    raise exception 'propriedade_inexistente' using errcode = 'P0001';
  end if;
  if p_tp_perfil <> 'ADMIN' and coalesce(cardinality(p_ids_propriedade), 0) = 0 then
    raise exception 'propriedade_obrigatoria' using errcode = 'P0001';
  end if;
  begin
    insert into "VST_USUARIO" ("ID_USUARIO", "NM_USUARIO", "CD_LOGIN", "CD_CPF", "TP_PERFIL", "SG_TROCAR_SENHA")
    values (p_id_usuario, btrim(p_nm_usuario), lower(btrim(p_cd_login)), v_cpf, p_tp_perfil, true);
  exception
    when unique_violation then
      if exists (select 1 from "VST_USUARIO" where "CD_LOGIN" = lower(btrim(p_cd_login))) then raise exception 'login_em_uso' using errcode = 'P0001'; end if;
      if v_cpf is not null and exists (select 1 from "VST_USUARIO" where "CD_CPF" = v_cpf) then raise exception 'cpf_em_uso' using errcode = 'P0001'; end if;
      raise exception 'usuario_ja_cadastrado' using errcode = 'P0001';
    when check_violation then raise exception 'dados_invalidos' using errcode = 'P0001';
  end;
  insert into "VST_USUARIO_PROPRIEDADE" ("ID_USUARIO", "ID_PROPRIEDADE") select p_id_usuario, i from unnest(coalesce(p_ids_propriedade, '{}')) i on conflict do nothing;
  return p_id_usuario;
end;
$$;

-- Troca de situação com as regras de perfil. LIBERADO encerra o bloqueio de manutenção
-- (DT_FIM = amanhã) e só vale sem ocorrência crítica aberta.
create or replace function vst_mudar_situacao(p_id_unidade bigint, p_tp_situacao text, p_perfil text, p_ignorar_ocorrencia bigint default null)
returns void language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare v_hoje date;
begin
  if p_tp_situacao is null or p_tp_situacao not in ('EM_LIMPEZA', 'LIBERADO', 'OCUPADO', 'BLOQUEADO', 'MANUTENCAO') then
    raise exception 'situacao_invalida' using errcode = 'P0001';
  end if;
  if p_tp_situacao in ('BLOQUEADO', 'MANUTENCAO') and p_perfil not in ('GESTOR', 'ADMIN') then
    raise exception 'perfil_sem_permissao' using errcode = 'P0001';
  end if;
  if p_tp_situacao = 'LIBERADO' then
    if exists (select 1 from "VST_OCORRENCIA" o
               where o."ID_UNIDADE" = p_id_unidade and o."TP_GRAVIDADE" = 'CRITICA' and o."TP_STATUS" in ('ABERTA', 'EM_TRATAMENTO')
                 and o."ID_OCORRENCIA" is distinct from p_ignorar_ocorrencia) then
      raise exception 'ocorrencias_criticas_abertas' using errcode = 'P0001';
    end if;
    v_hoje := "SE".vst_hoje(p_id_unidade);
    update "SIT_BLOQUEIO" b set "DT_FIM" = greatest(v_hoje + 1, b."DT_INI" + 1)
    where b."ID_UNIDADE" = p_id_unidade and b."TP_MOTIVO" = 'MANUTENCAO' and b."DT_FIM" > v_hoje + 1
      and exists (select 1 from "VST_OCORRENCIA" o where o."ID_BLOQUEIO" = b."ID_BLOQUEIO");
  end if;
  perform "SE".vst_aplicar_situacao(p_id_unidade, p_tp_situacao);
end;
$$;


-- ════════════════════════════════════════════════════════════════════
--  3. FUNÇÕES DO APP (chamadas pelo usuário logado: papel authenticated)
--  Todas leem auth.uid(), exigem usuário ativo e acesso à propriedade.
--  Erros voltam como mensagem curta (ex.: 'sem_acesso') com SQLSTATE P0001.
-- ════════════════════════════════════════════════════════════════════

-- Chalés das propriedades do usuário, com a configuração efetiva de presença (sem o QR)
create or replace function vst_unidades()
returns table (id_unidade bigint, cd_unidade text, nm_unidade text, tp_unidade text, sg_ativo boolean, id_propriedade bigint,
               nm_propriedade text, tp_situacao text, ds_andar text, tp_validacao text, vl_latitude numeric, vl_longitude numeric,
               qtde_raio_metros int, qtde_precisao_max_metros int)
language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select u."ID_UNIDADE", u."CD_UNIDADE", u."NM_UNIDADE", u."TP_UNIDADE", u."SG_ATIVO", u."ID_PROPRIEDADE", p."NM_PROPRIEDADE",
         c.tp_situacao, vu."DS_ANDAR", c.tp_validacao, c.vl_latitude, c.vl_longitude, c.qtde_raio_metros, c.qtde_precisao_max_metros
  from "SIT_UNIDADE" u
  join "SIT_PROPRIEDADE" p on p."ID_PROPRIEDADE" = u."ID_PROPRIEDADE"
  left join "VST_UNIDADE" vu on vu."ID_UNIDADE" = u."ID_UNIDADE"
  cross join lateral "SE".vst_config_unidade(u."ID_UNIDADE") c
  where "SE".vst_tem_acesso_unidade(u."ID_UNIDADE")
  order by u."ID_PROPRIEDADE", u."NO_ORDEM", u."NM_UNIDADE"
$$;

-- Agenda: vistorias com data de DT_INI até a véspera de DT_FIM, com código e datas da reserva (nunca dados do hóspede)
create or replace function vst_agenda(p_dt_ini date, p_dt_fim date, p_id_unidade bigint default null)
returns table (id_vistoria uuid, id_unidade bigint, cd_unidade text, nm_unidade text, id_tipo_vistoria bigint, cd_tipo_vistoria text,
               nm_tipo_vistoria text, dt_agendada date, tp_status text, id_usuario uuid, nm_usuario text, id_reserva bigint,
               cd_reserva text, dt_checkin date, dt_checkout date, id_vistoria_entrada uuid, dt_inicio timestamptz, dt_fim timestamptz)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".vst_usuario_atual();
  if p_dt_ini is null or p_dt_fim is null or p_dt_fim <= p_dt_ini or p_dt_fim - p_dt_ini > 366 then
    raise exception 'periodo_invalido' using errcode = 'P0001';
  end if;
  return query
  select v."ID_VISTORIA", v."ID_UNIDADE", u."CD_UNIDADE", u."NM_UNIDADE", v."ID_TIPO_VISTORIA", t."CD_TIPO_VISTORIA", t."NM_TIPO_VISTORIA",
         v."DT_AGENDADA", v."TP_STATUS", v."ID_USUARIO", us."NM_USUARIO", v."ID_RESERVA", r."CD_RESERVA", r."DT_CHECKIN", r."DT_CHECKOUT",
         v."ID_VISTORIA_ENTRADA", v."DT_INICIO", v."DT_FIM"
  from "VST_VISTORIA" v
  join "SIT_UNIDADE" u on u."ID_UNIDADE" = v."ID_UNIDADE"
  join "VST_TIPO_VISTORIA" t on t."ID_TIPO_VISTORIA" = v."ID_TIPO_VISTORIA"
  left join "VST_USUARIO" us on us."ID_USUARIO" = v."ID_USUARIO"
  left join "SIT_RESERVA" r on r."ID_RESERVA" = v."ID_RESERVA"
  where v."DT_AGENDADA" >= p_dt_ini and v."DT_AGENDADA" < p_dt_fim
    and (p_id_unidade is null or v."ID_UNIDADE" = p_id_unidade)
    and "SE".vst_tem_acesso_unidade(u."ID_UNIDADE")
  order by v."DT_AGENDADA", u."NM_UNIDADE", t."CD_TIPO_VISTORIA";
end;
$$;

-- Checklist de um chalé para um tipo de vistoria (itens ativos, na ordem de passagem)
create or replace function vst_checklist(p_id_unidade bigint, p_id_tipo_vistoria bigint)
returns table (id_ambiente bigint, nm_ambiente text, ds_foto_referencia text, id_item bigint, nm_item text, ds_orientacao text,
               sg_critico boolean, sg_foto_obrigatoria boolean, qtde_esperada smallint)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".vst_usuario_atual();
  if not "SE".vst_tem_acesso_unidade(p_id_unidade) then raise exception 'sem_acesso' using errcode = 'P0001'; end if;
  return query
  select a."ID_AMBIENTE", a."NM_AMBIENTE", a."DS_FOTO_REFERENCIA", i."ID_ITEM", i."NM_ITEM", i."DS_ORIENTACAO",
         i."SG_CRITICO", i."SG_FOTO_OBRIGATORIA", i."QTDE_ESPERADA"
  from "VST_TIPO_VISTORIA_ITEM" ti
  join "VST_ITEM" i on i."ID_ITEM" = ti."ID_ITEM" and i."SG_ATIVO"
  join "VST_AMBIENTE" a on a."ID_AMBIENTE" = i."ID_AMBIENTE" and a."SG_ATIVO" and a."ID_UNIDADE" = p_id_unidade
  where ti."ID_TIPO_VISTORIA" = p_id_tipo_vistoria
  order by a."NO_ORDEM", a."ID_AMBIENTE", coalesce(ti."NO_ORDEM", i."NO_ORDEM"), i."ID_ITEM";
end;
$$;

-- T07: tipos que o usuário pode fazer neste chalé, com a quantidade de itens do checklist e a vistoria a retomar:
-- a minha EM_ANDAMENTO ou a AGENDADA mais recente até hoje (livre ou minha; a gestão vê também as de outros).
create or replace function vst_tipos_unidade(p_id_unidade bigint)
returns table (id_tipo_vistoria bigint, cd_tipo_vistoria text, nm_tipo_vistoria text, tp_comportamento text,
               sg_exige_entrada boolean, sg_exige_assinatura boolean, qtde_itens int,
               id_vistoria uuid, dt_agendada date, tp_status text, cd_reserva text)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
declare u "VST_USUARIO"%rowtype; v_hoje date;
begin
  u := "SE".vst_usuario_atual();
  if not "SE".vst_tem_acesso_unidade(p_id_unidade) then raise exception 'sem_acesso' using errcode = 'P0001'; end if;
  v_hoje := "SE".vst_hoje(p_id_unidade);
  return query
  select t."ID_TIPO_VISTORIA", t."CD_TIPO_VISTORIA", t."NM_TIPO_VISTORIA", t."TP_COMPORTAMENTO", t."SG_EXIGE_ENTRADA", t."SG_EXIGE_ASSINATURA",
         (select count(*)::int from "SE".vst_checklist(p_id_unidade, t."ID_TIPO_VISTORIA")),
         a."ID_VISTORIA", a."DT_AGENDADA", a."TP_STATUS", r."CD_RESERVA"
  from "VST_TIPO_VISTORIA" t
  left join lateral (
    select v."ID_VISTORIA", v."DT_AGENDADA", v."TP_STATUS", v."ID_RESERVA" from "VST_VISTORIA" v
    where v."ID_UNIDADE" = p_id_unidade and v."ID_TIPO_VISTORIA" = t."ID_TIPO_VISTORIA"
      and ((v."TP_STATUS" = 'EM_ANDAMENTO' and v."ID_USUARIO" = u."ID_USUARIO")
           or (v."TP_STATUS" = 'AGENDADA' and v."DT_AGENDADA" <= v_hoje
               and (v."ID_USUARIO" is null or v."ID_USUARIO" = u."ID_USUARIO" or u."TP_PERFIL" in ('GESTOR', 'ADMIN'))))
    order by (v."TP_STATUS" = 'EM_ANDAMENTO') desc, v."DT_AGENDADA" desc limit 1) a on true
  left join "SIT_RESERVA" r on r."ID_RESERVA" = a."ID_RESERVA"
  where t."SG_ATIVO" and "SE".vst_perfil_pode_tipo(u."TP_PERFIL", t."ID_TIPO_VISTORIA")
  order by case t."TP_COMPORTAMENTO" when 'ENTRADA' then 1 when 'SAIDA' then 2 when 'ROTINA' then 3 else 4 end, t."NM_TIPO_VISTORIA";
end;
$$;

-- Qual chalé é o do QR lido (só se o usuário tiver acesso)
create or replace function vst_resolver_qr(p_cd_hash_qr text)
returns table (id_unidade bigint, cd_unidade text, nm_unidade text)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".vst_usuario_atual();
  return query
  select u."ID_UNIDADE", u."CD_UNIDADE", u."NM_UNIDADE"
  from "VST_UNIDADE" vu join "SIT_UNIDADE" u on u."ID_UNIDADE" = vu."ID_UNIDADE"
  where vu."CD_HASH_QR" = p_cd_hash_qr and "SE".vst_tem_acesso_unidade(u."ID_UNIDADE");
end;
$$;

-- Vistoria avulsa (ou de rotina). Assessor cria para si; gestor/admin podem escolher o responsável e a reserva.
-- Reenviar o mesmo p_id_vistoria (uuid gerado no celular) devolve a vistoria existente.
create or replace function vst_criar_vistoria(p_id_unidade bigint, p_cd_tipo_vistoria text, p_dt_agendada date,
                                              p_id_vistoria uuid default null, p_id_reserva bigint default null, p_id_usuario uuid default null)
returns uuid language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare u "VST_USUARIO"%rowtype; v_tipo bigint; v_id uuid; v_resp uuid;
begin
  u := "SE".vst_usuario_atual();
  if not "SE".vst_tem_acesso_unidade(p_id_unidade) then raise exception 'sem_acesso' using errcode = 'P0001'; end if;
  if p_id_vistoria is not null and exists (select 1 from "VST_VISTORIA" where "ID_VISTORIA" = p_id_vistoria) then
    if not exists (select 1 from "VST_VISTORIA" where "ID_VISTORIA" = p_id_vistoria and "SE".vst_tem_acesso_unidade("ID_UNIDADE")) then
      raise exception 'sem_acesso' using errcode = 'P0001';
    end if;
    return p_id_vistoria;
  end if;
  select "ID_TIPO_VISTORIA" into v_tipo from "VST_TIPO_VISTORIA" where "CD_TIPO_VISTORIA" = p_cd_tipo_vistoria and "SG_ATIVO";
  if v_tipo is null then raise exception 'tipo_inexistente' using errcode = 'P0001'; end if;
  if not "SE".vst_perfil_pode_tipo(u."TP_PERFIL", v_tipo) then raise exception 'perfil_sem_permissao' using errcode = 'P0001'; end if;
  if p_dt_agendada is null then raise exception 'data_obrigatoria' using errcode = 'P0001'; end if;
  if u."TP_PERFIL" not in ('GESTOR', 'ADMIN') then
    if p_id_reserva is not null or (p_id_usuario is not null and p_id_usuario <> u."ID_USUARIO") then
      raise exception 'perfil_sem_permissao' using errcode = 'P0001';
    end if;
    v_resp := u."ID_USUARIO";
  else
    v_resp := p_id_usuario;
    if v_resp is not null and not exists (select 1 from "VST_USUARIO" x where x."ID_USUARIO" = v_resp and x."SG_ATIVO") then
      raise exception 'responsavel_invalido' using errcode = 'P0001';
    end if;
  end if;
  insert into "VST_VISTORIA" ("ID_VISTORIA", "ID_UNIDADE", "ID_TIPO_VISTORIA", "ID_RESERVA", "ID_USUARIO", "DT_AGENDADA")
  values (coalesce(p_id_vistoria, gen_random_uuid()), p_id_unidade, v_tipo, p_id_reserva, v_resp, p_dt_agendada)
  returning "ID_VISTORIA" into v_id;
  return v_id;
end;
$$;

-- Gestão da agenda: atribuir responsável, remarcar a data ou cancelar (só vistoria AGENDADA)
create or replace function vst_atualizar_agenda(p_id_vistoria uuid, p_id_usuario uuid default null, p_dt_agendada date default null, p_cancelar boolean default false)
returns void language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare u "VST_USUARIO"%rowtype; v "VST_VISTORIA"%rowtype;
begin
  u := "SE".vst_usuario_atual();
  select * into v from "VST_VISTORIA" where "ID_VISTORIA" = p_id_vistoria for update;
  if not found then raise exception 'vistoria_inexistente' using errcode = 'P0001'; end if;
  if not "SE".vst_pode_gerir_unidade(v."ID_UNIDADE") then raise exception 'perfil_sem_permissao' using errcode = 'P0001'; end if;
  if v."TP_STATUS" <> 'AGENDADA' then raise exception 'vistoria_nao_agendada' using errcode = 'P0001'; end if;
  if p_id_usuario is not null and not exists (
       select 1 from "VST_USUARIO" x where x."ID_USUARIO" = p_id_usuario and x."SG_ATIVO" and "SE".vst_alcanca_unidade(x."ID_USUARIO", v."ID_UNIDADE")) then
    raise exception 'responsavel_invalido' using errcode = 'P0001';
  end if;
  update "VST_VISTORIA"
  set "ID_USUARIO" = coalesce(p_id_usuario, "ID_USUARIO"),
      "DT_AGENDADA" = coalesce(p_dt_agendada, "DT_AGENDADA"),
      "TP_STATUS" = case when p_cancelar then 'CANCELADA' else "TP_STATUS" end
  where "ID_VISTORIA" = p_id_vistoria;
end;
$$;

-- Começa a vistoria: assume a responsabilidade e valida a presença.
--  QR errado ou ausente (quando exigido) é recusado; GPS fora do raio, impreciso ou ausente só sinaliza.
create or replace function vst_iniciar_vistoria(p_id_vistoria uuid, p_cd_hash_qr text default null, p_vl_latitude numeric default null,
                                                p_vl_longitude numeric default null, p_qtde_precisao_metros numeric default null,
                                                p_dt_inicio timestamptz default null)
returns table (tp_status text, sg_fora_raio boolean, qtde_distancia_metros int, ds_sinalizacoes text[])
language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare u "VST_USUARIO"%rowtype; v "VST_VISTORIA"%rowtype; c record; v_sin text[] := '{}'; v_dist int; v_fora boolean := false;
        v_ini timestamptz; v_entrada uuid;
begin
  u := "SE".vst_usuario_atual();
  select * into v from "VST_VISTORIA" where "ID_VISTORIA" = p_id_vistoria for update;
  if not found then raise exception 'vistoria_inexistente' using errcode = 'P0001'; end if;
  if not "SE".vst_tem_acesso_unidade(v."ID_UNIDADE") then raise exception 'sem_acesso' using errcode = 'P0001'; end if;
  if v."TP_STATUS" = 'EM_ANDAMENTO' and v."ID_USUARIO" = u."ID_USUARIO" then          -- reenvio: devolve o que já foi gravado
    return query select v."TP_STATUS", v."SG_FORA_RAIO", v."QTDE_DISTANCIA_METROS", v."DS_SINALIZACOES";
    return;
  end if;
  if v."TP_STATUS" <> 'AGENDADA' then raise exception 'vistoria_nao_agendada' using errcode = 'P0001'; end if;
  if not "SE".vst_perfil_pode_tipo(u."TP_PERFIL", v."ID_TIPO_VISTORIA") then raise exception 'perfil_sem_permissao' using errcode = 'P0001'; end if;
  if v."ID_USUARIO" is not null and v."ID_USUARIO" <> u."ID_USUARIO" and u."TP_PERFIL" not in ('GESTOR', 'ADMIN') then
    raise exception 'vistoria_de_outro_usuario' using errcode = 'P0001';
  end if;
  v_ini := coalesce(p_dt_inicio, now());
  if v_ini > now() + interval '5 minutes' then raise exception 'data_futura' using errcode = 'P0001'; end if;

  select * into c from "SE".vst_config_unidade(v."ID_UNIDADE");
  if c.tp_validacao in ('QR', 'QR_E_GPS') then
    if nullif(btrim(p_cd_hash_qr), '') is null then raise exception 'qr_obrigatorio' using errcode = 'P0001'; end if;
    if p_cd_hash_qr is distinct from c.cd_hash_qr then raise exception 'qr_invalido' using errcode = 'P0001'; end if;
  end if;
  if c.tp_validacao in ('GPS', 'QR_E_GPS') then
    if c.vl_latitude is null then
      v_sin := array_append(v_sin, 'GPS_NAO_CONFIGURADO'::text);
    elsif p_vl_latitude is null or p_vl_longitude is null then
      v_sin := array_append(v_sin, 'SEM_GPS'::text);
    else
      v_dist := "SE".vst_distancia_metros(p_vl_latitude, p_vl_longitude, c.vl_latitude, c.vl_longitude);
      if v_dist > c.qtde_raio_metros then v_fora := true; v_sin := array_append(v_sin, 'FORA_RAIO'::text); end if;
      if p_qtde_precisao_metros is not null and p_qtde_precisao_metros > c.qtde_precisao_max_metros then v_sin := array_append(v_sin, 'GPS_IMPRECISO'::text); end if;
    end if;
  end if;
  -- Saída: aponta para a Entrada concluída da mesma estadia, se o site ainda não ligou
  v_entrada := v."ID_VISTORIA_ENTRADA";
  if v_entrada is null and v."ID_RESERVA" is not null then
    select e."ID_VISTORIA" into v_entrada
    from "VST_VISTORIA" e join "VST_TIPO_VISTORIA" te on te."ID_TIPO_VISTORIA" = e."ID_TIPO_VISTORIA"
    join "VST_TIPO_VISTORIA" ts on ts."ID_TIPO_VISTORIA" = v."ID_TIPO_VISTORIA"
    where e."ID_RESERVA" = v."ID_RESERVA" and te."TP_COMPORTAMENTO" = 'ENTRADA' and ts."TP_COMPORTAMENTO" = 'SAIDA' and e."TP_STATUS" = 'CONCLUIDA'
    order by e."DT_FIM" desc limit 1;
  end if;
  update "VST_VISTORIA"
  set "TP_STATUS" = 'EM_ANDAMENTO', "ID_USUARIO" = u."ID_USUARIO", "DT_INICIO" = v_ini, "TP_VALIDACAO" = c.tp_validacao,
      "VL_LATITUDE" = p_vl_latitude, "VL_LONGITUDE" = case when p_vl_latitude is null then null else p_vl_longitude end,
      "QTDE_PRECISAO_METROS" = least(p_qtde_precisao_metros, 32767)::smallint, "QTDE_DISTANCIA_METROS" = v_dist,
      "SG_FORA_RAIO" = v_fora, "DS_SINALIZACOES" = nullif(v_sin, '{}'), "ID_VISTORIA_ENTRADA" = v_entrada
  where "ID_VISTORIA" = p_id_vistoria;
  return query select 'EM_ANDAMENTO'::text, v_fora, v_dist, nullif(v_sin, '{}');
end;
$$;

-- Conclui e envia a vistoria numa só transação: grava respostas e fotos, abre ocorrências, cria o bloqueio de
-- manutenção se algum item crítico estiver com problema e atualiza a situação do chalé.
--  p_respostas: [{"id_item":1,"tp_resposta":"OK|PROBLEMA|NAO_SE_APLICA","qtde_encontrada":4,"ds_observacao":"…","tp_gravidade":"BAIXA|MEDIA|CRITICA","dt_resposta":"…"}]
--  p_fotos:     [{"id_foto":"uuid?","id_item":1,"cd_arquivo":"<ID_VISTORIA>/foto.jpg","vl_latitude":…,"vl_longitude":…,"qtde_precisao_metros":…,"dt_captura":"…"}]
-- Reenviar uma vistoria já concluída devolve o resultado sem gravar de novo.
create or replace function vst_concluir_vistoria(p_id_vistoria uuid, p_respostas jsonb, p_fotos jsonb default '[]'::jsonb,
                                                 p_ds_assinatura text default null, p_ds_observacao text default null,
                                                 p_tp_situacao_resultante text default null, p_dt_fim timestamptz default null)
returns table (tp_status text, ds_sinalizacoes text[], qtde_ocorrencias int, id_bloqueio bigint)
language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare u "VST_USUARIO"%rowtype; v "VST_VISTORIA"%rowtype; t "VST_TIPO_VISTORIA"%rowtype; c record; rec record;
        v_sin text[]; v_fim timestamptz; v_oc bigint; v_n int := 0; v_bloq bigint; v_situacao text;
begin
  u := "SE".vst_usuario_atual();
  select * into v from "VST_VISTORIA" where "ID_VISTORIA" = p_id_vistoria for update;
  if not found then raise exception 'vistoria_inexistente' using errcode = 'P0001'; end if;
  if not "SE".vst_tem_acesso_unidade(v."ID_UNIDADE") then raise exception 'sem_acesso' using errcode = 'P0001'; end if;
  if v."TP_STATUS" = 'CONCLUIDA' then
    return query select v."TP_STATUS", v."DS_SINALIZACOES",
      (select count(*)::int from "VST_OCORRENCIA" o where o."ID_VISTORIA" = v."ID_VISTORIA"),
      (select max(o."ID_BLOQUEIO") from "VST_OCORRENCIA" o where o."ID_VISTORIA" = v."ID_VISTORIA");
    return;
  end if;
  if v."TP_STATUS" <> 'EM_ANDAMENTO' then raise exception 'vistoria_nao_iniciada' using errcode = 'P0001'; end if;
  if v."ID_USUARIO" <> u."ID_USUARIO" and u."TP_PERFIL" not in ('GESTOR', 'ADMIN') then raise exception 'vistoria_de_outro_usuario' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_respostas) is distinct from 'array' or jsonb_array_length(p_respostas) = 0 then
    raise exception 'respostas_obrigatorias' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_fotos, '[]'::jsonb)) <> 'array' then raise exception 'fotos_invalidas' using errcode = 'P0001'; end if;
  select * into t from "VST_TIPO_VISTORIA" where "ID_TIPO_VISTORIA" = v."ID_TIPO_VISTORIA";
  select * into c from "SE".vst_config_unidade(v."ID_UNIDADE");
  v_fim := coalesce(p_dt_fim, now());
  if v_fim > now() + interval '5 minutes' then raise exception 'data_futura' using errcode = 'P0001'; end if;
  if v_fim < v."DT_INICIO" then raise exception 'data_invalida' using errcode = 'P0001'; end if;

  -- respostas: só itens do checklist, sem repetir, todos respondidos
  if (select count(distinct x.id_item) <> count(*) from jsonb_to_recordset(p_respostas) as x(id_item bigint)) then
    raise exception 'item_duplicado' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_respostas) as x(id_item bigint)
             where x.id_item is null or x.id_item not in (select k.id_item from "SE".vst_checklist(v."ID_UNIDADE", v."ID_TIPO_VISTORIA") k)) then
    raise exception 'item_fora_do_checklist' using errcode = 'P0001';
  end if;
  if exists (select 1 from "SE".vst_checklist(v."ID_UNIDADE", v."ID_TIPO_VISTORIA") k
             where k.id_item not in (select x.id_item from jsonb_to_recordset(p_respostas) as x(id_item bigint))) then
    raise exception 'itens_pendentes' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_respostas) as x(tp_resposta text, ds_observacao text)
             where x.tp_resposta = 'PROBLEMA' and nullif(btrim(x.ds_observacao), '') is null) then
    raise exception 'observacao_obrigatoria' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_fotos) as f(id_item bigint)
             where f.id_item is null or f.id_item not in (select x.id_item from jsonb_to_recordset(p_respostas) as x(id_item bigint))) then
    raise exception 'foto_de_item_nao_respondido' using errcode = 'P0001';
  end if;
  if exists (select 1 from "SE".vst_checklist(v."ID_UNIDADE", v."ID_TIPO_VISTORIA") k
             where k.sg_foto_obrigatoria and not exists (select 1 from jsonb_to_recordset(p_fotos) as f(id_item bigint) where f.id_item = k.id_item)
               and not exists (select 1 from jsonb_to_recordset(p_respostas) as x(id_item bigint, tp_resposta text)
                               where x.id_item = k.id_item and x.tp_resposta = 'NAO_SE_APLICA')) then   -- "não se aplica" dispensa a foto
    raise exception 'foto_obrigatoria' using errcode = 'P0001';
  end if;
  if t."SG_EXIGE_ASSINATURA" and nullif(btrim(p_ds_assinatura), '') is null then
    raise exception 'assinatura_obrigatoria' using errcode = 'P0001';
  end if;

  insert into "VST_RESPOSTA" ("ID_VISTORIA", "ID_ITEM", "TP_RESPOSTA", "QTDE_ENCONTRADA", "DS_OBSERVACAO", "DT_RESPOSTA")
  select p_id_vistoria, x.id_item, x.tp_resposta, x.qtde_encontrada, nullif(btrim(x.ds_observacao), ''), coalesce(x.dt_resposta, v_fim)
  from jsonb_to_recordset(p_respostas) as x(id_item bigint, tp_resposta text, qtde_encontrada smallint, ds_observacao text, dt_resposta timestamptz);

  insert into "VST_FOTO" ("ID_FOTO", "ID_VISTORIA", "ID_ITEM", "CD_ARQUIVO", "VL_LATITUDE", "VL_LONGITUDE", "QTDE_PRECISAO_METROS", "SG_FORA_RAIO", "DT_CAPTURA")
  select coalesce(f.id_foto, gen_random_uuid()), p_id_vistoria, f.id_item, f.cd_arquivo, f.vl_latitude,
         case when f.vl_latitude is null then null else f.vl_longitude end, least(f.qtde_precisao_metros, 32767)::smallint,
         coalesce(c.vl_latitude is not null and f.vl_latitude is not null
                  and "SE".vst_distancia_metros(f.vl_latitude, f.vl_longitude, c.vl_latitude, c.vl_longitude) > c.qtde_raio_metros, false),
         coalesce(f.dt_captura, v_fim)
  from jsonb_to_recordset(p_fotos) as f(id_foto uuid, id_item bigint, cd_arquivo text, vl_latitude numeric, vl_longitude numeric,
                                        qtde_precisao_metros numeric, dt_captura timestamptz)
  on conflict ("CD_ARQUIVO") do nothing;

  -- problema vira ocorrência; item crítico (gravidade CRITICA) tira o chalé da venda
  -- gravidade: a escolhida no app (BAIXA, MEDIA ou CRITICA; vazio = BAIXA); item crítico é sempre CRITICA
  if exists (select 1 from jsonb_to_recordset(p_respostas) as x(tp_resposta text, tp_gravidade text)
             where x.tp_resposta = 'PROBLEMA' and x.tp_gravidade is not null and x.tp_gravidade not in ('BAIXA', 'MEDIA', 'CRITICA')) then
    raise exception 'gravidade_invalida' using errcode = 'P0001';
  end if;
  for rec in
    select x.id_item, nullif(btrim(x.ds_observacao), '') as ds,
           case when i."SG_CRITICO" then 'CRITICA' else coalesce(x.tp_gravidade, 'BAIXA') end as gravidade
    from jsonb_to_recordset(p_respostas) as x(id_item bigint, tp_resposta text, ds_observacao text, tp_gravidade text)
    join "VST_ITEM" i on i."ID_ITEM" = x.id_item
    where x.tp_resposta = 'PROBLEMA'
  loop
    insert into "VST_OCORRENCIA" ("ID_VISTORIA", "ID_ITEM", "ID_UNIDADE", "TP_GRAVIDADE", "DS_OCORRENCIA", "DT_ABERTURA")
    values (p_id_vistoria, rec.id_item, v."ID_UNIDADE", rec.gravidade, rec.ds, v_fim)
    returning "ID_OCORRENCIA" into v_oc;
    v_n := v_n + 1;
    if rec.gravidade = 'CRITICA' then v_bloq := "SE".vst_criar_bloqueio_manutencao(v_oc); end if;
  end loop;

  -- situação do chalé: ocorrência crítica manda (MANUTENCAO); senão vale a escolha de quem concluiu; senão o padrão do tipo:
  -- Entrada concluída → OCUPADO, Saída concluída → EM_LIMPEZA (a equipe libera depois da limpeza).
  -- O padrão nunca tira o chalé de MANUTENCAO ou BLOQUEADO.
  v_situacao := case when v_bloq is not null then 'MANUTENCAO' else p_tp_situacao_resultante end;
  if v_bloq is null and p_tp_situacao_resultante is not null then
    perform "SE".vst_mudar_situacao(v."ID_UNIDADE", p_tp_situacao_resultante, u."TP_PERFIL");
  elsif v_bloq is null then
    v_situacao := case t."TP_COMPORTAMENTO" when 'ENTRADA' then 'OCUPADO' when 'SAIDA' then 'EM_LIMPEZA' end;
    if v_situacao is not null and c.tp_situacao not in ('MANUTENCAO', 'BLOQUEADO') then
      perform "SE".vst_mudar_situacao(v."ID_UNIDADE", v_situacao, u."TP_PERFIL");
    else
      v_situacao := null;
    end if;
  end if;

  v_sin := coalesce(v."DS_SINALIZACOES", '{}');
  if c.qtde_minutos_min_vistoria > 0 and v_fim - v."DT_INICIO" < make_interval(mins => c.qtde_minutos_min_vistoria) then v_sin := array_append(v_sin, 'RAPIDA'::text); end if;
  if t."SG_EXIGE_ENTRADA" and v."ID_VISTORIA_ENTRADA" is null then v_sin := array_append(v_sin, 'SEM_ENTRADA'::text); end if;
  v_sin := array(select distinct e from unnest(v_sin) e order by e);

  update "VST_VISTORIA"
  set "TP_STATUS" = 'CONCLUIDA', "DT_FIM" = v_fim, "DT_RECEBIMENTO" = now(), "DS_SINALIZACOES" = nullif(v_sin, '{}'),
      "DS_ASSINATURA" = nullif(btrim(p_ds_assinatura), ''), "DS_OBSERVACAO" = nullif(btrim(p_ds_observacao), ''),
      "TP_SITUACAO_RESULTANTE" = v_situacao
  where "ID_VISTORIA" = p_id_vistoria;
  return query select 'CONCLUIDA'::text, nullif(v_sin, '{}'), v_n, v_bloq;
end;
$$;

-- Registra uma foto já enviada ao Storage (para fotos que chegam depois da conclusão, p.ex. offline)
create or replace function vst_registrar_foto(p_id_vistoria uuid, p_id_item bigint, p_cd_arquivo text, p_vl_latitude numeric default null,
                                              p_vl_longitude numeric default null, p_qtde_precisao_metros numeric default null,
                                              p_dt_captura timestamptz default null, p_id_foto uuid default null)
returns uuid language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare u "VST_USUARIO"%rowtype; v "VST_VISTORIA"%rowtype; c record; v_id uuid;
begin
  u := "SE".vst_usuario_atual();
  select * into v from "VST_VISTORIA" where "ID_VISTORIA" = p_id_vistoria;
  if not found then raise exception 'vistoria_inexistente' using errcode = 'P0001'; end if;
  if not "SE".vst_tem_acesso_unidade(v."ID_UNIDADE") then raise exception 'sem_acesso' using errcode = 'P0001'; end if;
  if v."TP_STATUS" not in ('EM_ANDAMENTO', 'CONCLUIDA') then raise exception 'vistoria_nao_iniciada' using errcode = 'P0001'; end if;
  if v."ID_USUARIO" <> u."ID_USUARIO" and u."TP_PERFIL" not in ('GESTOR', 'ADMIN') then raise exception 'vistoria_de_outro_usuario' using errcode = 'P0001'; end if;
  if not exists (select 1 from "VST_RESPOSTA" where "ID_VISTORIA" = p_id_vistoria and "ID_ITEM" = p_id_item) then
    raise exception 'foto_de_item_nao_respondido' using errcode = 'P0001';
  end if;
  select * into c from "SE".vst_config_unidade(v."ID_UNIDADE");
  insert into "VST_FOTO" ("ID_FOTO", "ID_VISTORIA", "ID_ITEM", "CD_ARQUIVO", "VL_LATITUDE", "VL_LONGITUDE", "QTDE_PRECISAO_METROS", "SG_FORA_RAIO", "DT_CAPTURA")
  values (coalesce(p_id_foto, gen_random_uuid()), p_id_vistoria, p_id_item, p_cd_arquivo, p_vl_latitude,
          case when p_vl_latitude is null then null else p_vl_longitude end, least(p_qtde_precisao_metros, 32767)::smallint,
          coalesce(c.vl_latitude is not null and p_vl_latitude is not null
                   and "SE".vst_distancia_metros(p_vl_latitude, p_vl_longitude, c.vl_latitude, c.vl_longitude) > c.qtde_raio_metros, false),
          coalesce(p_dt_captura, now()))
  on conflict ("CD_ARQUIVO") do nothing;
  select "ID_FOTO" into v_id from "VST_FOTO" where "CD_ARQUIVO" = p_cd_arquivo;
  return v_id;
end;
$$;

-- Gestão: trata uma ocorrência; com p_liberar encerra o bloqueio e libera o chalé (se não restar crítica aberta)
create or replace function vst_resolver_ocorrencia(p_id_ocorrencia bigint, p_tp_status text default 'RESOLVIDA',
                                                   p_ds_tratamento text default null, p_liberar boolean default false)
returns void language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare u "VST_USUARIO"%rowtype; o "VST_OCORRENCIA"%rowtype;
begin
  u := "SE".vst_usuario_atual();
  select * into o from "VST_OCORRENCIA" where "ID_OCORRENCIA" = p_id_ocorrencia for update;
  if not found then raise exception 'ocorrencia_inexistente' using errcode = 'P0001'; end if;
  if not "SE".vst_pode_gerir_unidade(o."ID_UNIDADE") then
    -- a equipe de manutenção trata a ocorrência (EM_TRATAMENTO ou RESOLVIDA); quem libera o chalé e cancela é a gestão
    if not (u."TP_PERFIL" = 'MANUTENCAO' and "SE".vst_tem_acesso_unidade(o."ID_UNIDADE") and not p_liberar and p_tp_status in ('EM_TRATAMENTO', 'RESOLVIDA')) then
      raise exception 'perfil_sem_permissao' using errcode = 'P0001';
    end if;
  end if;
  if p_tp_status not in ('EM_TRATAMENTO', 'RESOLVIDA', 'CANCELADA') then raise exception 'status_invalido' using errcode = 'P0001'; end if;
  -- encerrada (resolvida/cancelada) não volta nem recebe comentário; só pode liberar o chalé, mantendo o status
  if o."TP_STATUS" in ('RESOLVIDA', 'CANCELADA') and (p_tp_status <> o."TP_STATUS" or not p_liberar or nullif(btrim(p_ds_tratamento), '') is not null) then
    raise exception 'ocorrencia_encerrada' using errcode = 'P0001';
  end if;
  -- histórico do tratamento: cada registro ganha data/hora (Brasília) e autor, gravados pelo servidor; nada é sobrescrito
  update "VST_OCORRENCIA"
  set "TP_STATUS" = p_tp_status,
      "DS_TRATAMENTO" = case when nullif(btrim(p_ds_tratamento), '') is null then "DS_TRATAMENTO"
                             else left(concat_ws(E'\n', "DS_TRATAMENTO", to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || u."NM_USUARIO" || ': ' || btrim(p_ds_tratamento)), 20000) end,
      "DT_RESOLUCAO" = case when p_tp_status = 'RESOLVIDA' then now() else "DT_RESOLUCAO" end
  where "ID_OCORRENCIA" = p_id_ocorrencia;
  if p_liberar then
    if p_tp_status not in ('RESOLVIDA', 'CANCELADA') then raise exception 'status_invalido' using errcode = 'P0001'; end if;
    perform "SE".vst_mudar_situacao(o."ID_UNIDADE", 'LIBERADO', u."TP_PERFIL");
  end if;
end;
$$;

-- Gestão (T20/T22/T25/T26): ocorrências com unidade, item, ambiente, vistoria de origem e fim do bloqueio (sem ler SIT_BLOQUEIO)
drop function if exists vst_ocorrencias(bigint, uuid);   -- o retorno ganhou colunas (responsável e prazo)
create or replace function vst_ocorrencias(p_id_unidade bigint default null, p_id_vistoria uuid default null)
returns table (id_ocorrencia bigint, id_unidade bigint, nm_unidade text, id_vistoria uuid, nm_tipo_vistoria text, dt_vistoria timestamptz,
               nm_autor text, id_item bigint, nm_item text, nm_ambiente text, tp_gravidade text, tp_status text, ds_ocorrencia text,
               ds_tratamento text, dt_abertura timestamptz, dt_resolucao timestamptz, dt_bloqueio_fim date,
               id_responsavel uuid, nm_responsavel text, dt_prazo date)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".vst_usuario_atual();
  return query
  select o."ID_OCORRENCIA", o."ID_UNIDADE", u."NM_UNIDADE", o."ID_VISTORIA", t."NM_TIPO_VISTORIA", v."DT_FIM", us."NM_USUARIO",
         o."ID_ITEM", i."NM_ITEM", a."NM_AMBIENTE", o."TP_GRAVIDADE", o."TP_STATUS", o."DS_OCORRENCIA", o."DS_TRATAMENTO",
         o."DT_ABERTURA", o."DT_RESOLUCAO", case when b."DT_FIM" is not null then b."DT_FIM" - 1 end,
         o."ID_RESPONSAVEL", rs."NM_USUARIO", o."DT_PRAZO"
  from "VST_OCORRENCIA" o
  join "SIT_UNIDADE" u on u."ID_UNIDADE" = o."ID_UNIDADE"
  join "VST_VISTORIA" v on v."ID_VISTORIA" = o."ID_VISTORIA"
  join "VST_TIPO_VISTORIA" t on t."ID_TIPO_VISTORIA" = v."ID_TIPO_VISTORIA"
  left join "VST_USUARIO" us on us."ID_USUARIO" = v."ID_USUARIO"
  join "VST_ITEM" i on i."ID_ITEM" = o."ID_ITEM"
  join "VST_AMBIENTE" a on a."ID_AMBIENTE" = i."ID_AMBIENTE"
  left join "SIT_BLOQUEIO" b on b."ID_BLOQUEIO" = o."ID_BLOQUEIO"
  left join "VST_USUARIO" rs on rs."ID_USUARIO" = o."ID_RESPONSAVEL"
  where "SE".vst_tem_acesso_unidade(u."ID_UNIDADE")
    and (p_id_unidade is null or o."ID_UNIDADE" = p_id_unidade)
    and (p_id_vistoria is null or o."ID_VISTORIA" = p_id_vistoria)
  order by (o."TP_STATUS" in ('ABERTA', 'EM_TRATAMENTO')) desc,
           case o."TP_GRAVIDADE" when 'CRITICA' then 0 when 'MEDIA' then 1 else 2 end, o."DT_ABERTURA" desc
  limit 500;
end;
$$;

-- T34: auditoria das vistorias (só ADMIN), do mais recente ao mais antigo, paginada; período em dias de Brasília
create or replace function vst_auditoria(p_dt_ini date, p_dt_fim date, p_nm_tabela text default null, p_id_usuario uuid default null,
                                         p_limite int default 50, p_deslocamento int default 0)
returns table (id_auditoria bigint, dt_criacao timestamptz, id_usuario uuid, nm_usuario text, tp_perfil text, nm_papel text,
               nm_tabela text, tp_operacao text, cd_registro text, id_unidade bigint, nm_unidade text, ds_alteracoes jsonb, qtde_total bigint)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  if "SE".vst_perfil() is distinct from 'ADMIN' then raise exception 'perfil_sem_permissao' using errcode = 'P0001'; end if;
  if p_dt_ini is null or p_dt_fim is null or p_dt_fim < p_dt_ini or p_dt_fim - p_dt_ini > 366 then
    raise exception 'periodo_invalido' using errcode = 'P0001';
  end if;
  return query
  select a."ID_AUDITORIA", a."DT_CRIACAO", a."ID_USUARIO", u."NM_USUARIO", u."TP_PERFIL", a."NM_PAPEL", a."NM_TABELA", a."TP_OPERACAO",
         a."CD_REGISTRO", a."ID_UNIDADE", su."NM_UNIDADE", a."DS_ALTERACOES", count(*) over ()
  from "VST_AUDITORIA" a
  left join "VST_USUARIO" u on u."ID_USUARIO" = a."ID_USUARIO"
  left join "SIT_UNIDADE" su on su."ID_UNIDADE" = a."ID_UNIDADE"
  where a."DT_CRIACAO" >= (p_dt_ini::timestamp at time zone 'America/Sao_Paulo')
    and a."DT_CRIACAO" < ((p_dt_fim + 1)::timestamp at time zone 'America/Sao_Paulo')
    and (p_nm_tabela is null or a."NM_TABELA" = p_nm_tabela)
    and (p_id_usuario is null or a."ID_USUARIO" = p_id_usuario)
  order by a."DT_CRIACAO" desc, a."ID_AUDITORIA" desc
  limit least(greatest(coalesce(p_limite, 50), 1), 200) offset greatest(coalesce(p_deslocamento, 0), 0);
end;
$$;

-- Gestão (T26): define quem cuida da ocorrência e até quando (vazio = sem responsável / sem prazo). Fica no histórico.
create or replace function vst_planejar_ocorrencia(p_id_ocorrencia bigint, p_id_responsavel uuid default null, p_dt_prazo date default null)
returns void language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare u "VST_USUARIO"%rowtype; o "VST_OCORRENCIA"%rowtype; v_nome text;
begin
  u := "SE".vst_usuario_atual();
  select * into o from "VST_OCORRENCIA" where "ID_OCORRENCIA" = p_id_ocorrencia for update;
  if not found then raise exception 'ocorrencia_inexistente' using errcode = 'P0001'; end if;
  if not "SE".vst_pode_gerir_unidade(o."ID_UNIDADE") then raise exception 'perfil_sem_permissao' using errcode = 'P0001'; end if;
  if o."TP_STATUS" in ('RESOLVIDA', 'CANCELADA') then raise exception 'ocorrencia_encerrada' using errcode = 'P0001'; end if;
  if p_id_responsavel is not null then
    select x."NM_USUARIO" into v_nome from "VST_USUARIO" x
    where x."ID_USUARIO" = p_id_responsavel and x."SG_ATIVO" and "SE".vst_alcanca_unidade(x."ID_USUARIO", o."ID_UNIDADE");
    if v_nome is null then raise exception 'responsavel_invalido' using errcode = 'P0001'; end if;
  end if;
  if p_dt_prazo is not null and p_dt_prazo < "SE".vst_hoje(o."ID_UNIDADE") then raise exception 'prazo_invalido' using errcode = 'P0001'; end if;
  update "VST_OCORRENCIA"
  set "ID_RESPONSAVEL" = p_id_responsavel, "DT_PRAZO" = p_dt_prazo,
      "TP_STATUS" = case when p_id_responsavel is not null and "TP_STATUS" = 'ABERTA' then 'EM_TRATAMENTO' else "TP_STATUS" end,
      "DS_TRATAMENTO" = left(concat_ws(E'\n', "DS_TRATAMENTO", to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') || ' · ' || u."NM_USUARIO" || ': '
                        || 'Responsável: ' || coalesce(v_nome, 'ninguém') || ' · prazo: ' || coalesce(to_char(p_dt_prazo, 'DD/MM/YYYY'), 'sem prazo')), 20000)
  where "ID_OCORRENCIA" = p_id_ocorrencia;
end;
$$;

-- Bloqueio manual a partir de uma ocorrência (gestão); p_dt_fim vazio = 7 dias (provisório)
create or replace function vst_bloquear_por_ocorrencia(p_id_ocorrencia bigint, p_dt_fim date default null)
returns bigint language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare o "VST_OCORRENCIA"%rowtype;
begin
  perform "SE".vst_usuario_atual();
  select * into o from "VST_OCORRENCIA" where "ID_OCORRENCIA" = p_id_ocorrencia;
  if not found then raise exception 'ocorrencia_inexistente' using errcode = 'P0001'; end if;
  if not "SE".vst_pode_gerir_unidade(o."ID_UNIDADE") then raise exception 'perfil_sem_permissao' using errcode = 'P0001'; end if;
  if o."TP_STATUS" in ('RESOLVIDA', 'CANCELADA') then raise exception 'ocorrencia_encerrada' using errcode = 'P0001'; end if;
  return "SE".vst_criar_bloqueio_manutencao(p_id_ocorrencia, p_dt_fim);
end;
$$;

-- Muda a situação do chalé (EM_LIMPEZA, LIBERADO, OCUPADO para todos; BLOQUEADO e MANUTENCAO só gestão)
create or replace function vst_alterar_situacao_unidade(p_id_unidade bigint, p_tp_situacao text)
returns void language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare u "VST_USUARIO"%rowtype;
begin
  u := "SE".vst_usuario_atual();
  if not "SE".vst_tem_acesso_unidade(p_id_unidade) then raise exception 'sem_acesso' using errcode = 'P0001'; end if;
  perform "SE".vst_mudar_situacao(p_id_unidade, p_tp_situacao, u."TP_PERFIL");
end;
$$;

-- Pousadas que o usuário vê, com a configuração de presença (T28, T29, T32, T33). As pousadas são do site: o app não cria nem apaga.
create or replace function vst_propriedades()
returns table (id_propriedade bigint, nm_propriedade text, qtde_unidades int, tp_validacao text, vl_latitude numeric, vl_longitude numeric,
               qtde_raio_metros int, qtde_precisao_max_metros int, qtde_minutos_min_vistoria int)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".vst_usuario_atual();
  return query
  select p."ID_PROPRIEDADE", p."NM_PROPRIEDADE", (select count(*)::int from "SIT_UNIDADE" u where u."ID_PROPRIEDADE" = p."ID_PROPRIEDADE"),
         coalesce(vp."TP_VALIDACAO", 'QR_E_GPS'), vp."VL_LATITUDE", vp."VL_LONGITUDE", coalesce(vp."QTDE_RAIO_METROS", 100)::int,
         coalesce(vp."QTDE_PRECISAO_MAX_METROS", 50)::int, coalesce(vp."QTDE_MINUTOS_MIN_VISTORIA", 10)::int
  from "SIT_PROPRIEDADE" p left join "VST_PROPRIEDADE" vp on vp."ID_PROPRIEDADE" = p."ID_PROPRIEDADE"
  where "SE".vst_tem_acesso(p."ID_PROPRIEDADE")
  order by p."NM_PROPRIEDADE";
end;
$$;

-- Integridade da equipe: sempre resta ao menos um ADMIN ativo (ninguém tranca o sistema por engano).
create or replace function vst_protege_ultimo_admin()
returns trigger language plpgsql security definer set search_path = "SE", extensions, pg_temp as $$
begin
  if old."TP_PERFIL" = 'ADMIN' and old."SG_ATIVO" and (tg_op = 'DELETE' or new."TP_PERFIL" <> 'ADMIN' or not new."SG_ATIVO")
     and not exists (select 1 from "VST_USUARIO" where "TP_PERFIL" = 'ADMIN' and "SG_ATIVO" and "ID_USUARIO" <> old."ID_USUARIO") then
    raise exception 'ultimo_admin' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then new."DT_ATUALIZACAO" := now(); return new; end if;
  return old;
end;
$$;
drop trigger if exists "TG_VST_USUARIO_ULTIMO_ADMIN" on "VST_USUARIO";
create trigger "TG_VST_USUARIO_ULTIMO_ADMIN" before update or delete on "VST_USUARIO" for each row execute function vst_protege_ultimo_admin();

-- Integridade com o site: ENTRADA e SAIDA (usados pela geração automática) não mudam de código nem de comportamento e não são desativados.
create or replace function vst_protege_tipos_do_site()
returns trigger language plpgsql security definer set search_path = "SE", extensions, pg_temp as $$
begin
  if old."CD_TIPO_VISTORIA" in ('ENTRADA', 'SAIDA') and (tg_op = 'DELETE' or new."CD_TIPO_VISTORIA" <> old."CD_TIPO_VISTORIA"
       or new."TP_COMPORTAMENTO" <> old."TP_COMPORTAMENTO" or not new."SG_ATIVO") then
    raise exception 'tipo_do_site' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists "TG_VST_TIPO_VISTORIA_SITE" on "VST_TIPO_VISTORIA";
create trigger "TG_VST_TIPO_VISTORIA_SITE" before update or delete on "VST_TIPO_VISTORIA" for each row execute function vst_protege_tipos_do_site();

-- T03: o funcionário aceita o uso da localização e das fotos nas vistorias (LGPD). Guarda a primeira data; repetir não muda.
create or replace function vst_registrar_aceite_lgpd()
returns timestamptz language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare v timestamptz;
begin
  update "VST_USUARIO" set "DT_ACEITE_LGPD" = now(), "DT_ATUALIZACAO" = now()
  where "ID_USUARIO" = (select auth.uid()) and "SG_ATIVO" and "DT_ACEITE_LGPD" is null;
  select "DT_ACEITE_LGPD" into v from "VST_USUARIO" where "ID_USUARIO" = (select auth.uid()) and "SG_ATIVO";
  if v is null then raise exception 'usuario_inativo_ou_inexistente' using errcode = 'P0001'; end if;
  return v;
end;
$$;

-- Senha provisória: a Edge Function redefinir-senha (service_role) marca a troca obrigatória;
-- o próprio funcionário desmarca depois de trocar a senha no app (supabase.auth.updateUser).
create or replace function vst_exigir_troca_senha(p_id_usuario uuid)
returns void language sql volatile security definer set search_path = "SE", extensions, pg_temp as $$
  update "VST_USUARIO" set "SG_TROCAR_SENHA" = true, "DT_ATUALIZACAO" = now() where "ID_USUARIO" = p_id_usuario
$$;
create or replace function vst_senha_trocada()
returns void language sql volatile security definer set search_path = "SE", extensions, pg_temp as $$
  update "VST_USUARIO" set "SG_TROCAR_SENHA" = false, "DT_ATUALIZACAO" = now()
  where "ID_USUARIO" = (select auth.uid()) and "SG_TROCAR_SENHA"
$$;

-- QR do chalé para imprimir (gestão) e rotação (invalida as etiquetas antigas)
create or replace function vst_obter_qr(p_id_unidade bigint)
returns table (cd_hash_qr text, no_versao_qr smallint)
language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".vst_usuario_atual();
  if not "SE".vst_pode_gerir_unidade(p_id_unidade) then raise exception 'perfil_sem_permissao' using errcode = 'P0001'; end if;
  insert into "VST_UNIDADE" ("ID_UNIDADE") select p_id_unidade where exists (select 1 from "SIT_UNIDADE" where "ID_UNIDADE" = p_id_unidade) on conflict do nothing;
  return query select vu."CD_HASH_QR", vu."NO_VERSAO_QR" from "VST_UNIDADE" vu where vu."ID_UNIDADE" = p_id_unidade;
end;
$$;

create or replace function vst_rotacionar_qr(p_id_unidade bigint)
returns table (cd_hash_qr text, no_versao_qr smallint)
language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".vst_usuario_atual();
  if not "SE".vst_pode_gerir_unidade(p_id_unidade) then raise exception 'perfil_sem_permissao' using errcode = 'P0001'; end if;
  insert into "VST_UNIDADE" ("ID_UNIDADE") select p_id_unidade where exists (select 1 from "SIT_UNIDADE" where "ID_UNIDADE" = p_id_unidade) on conflict do nothing;
  return query
  update "VST_UNIDADE" vu set "CD_HASH_QR" = replace(gen_random_uuid()::text, '-', ''), "NO_VERSAO_QR" = vu."NO_VERSAO_QR" + 1, "DT_ATUALIZACAO" = now()
  where vu."ID_UNIDADE" = p_id_unidade
  returning vu."CD_HASH_QR", vu."NO_VERSAO_QR";
end;
$$;


-- ════════════════════════════════════════════════════════════════════
--  4. PERMISSÕES, RLS E AUDITORIA
--  Nada para anon. O schema revoga tudo por padrão: cada permissão é concedida aqui.
-- ════════════════════════════════════════════════════════════════════

-- Autor de cada mudança (VST_AUDITORIA): usuário do app, só os campos alterados, sem CPF nem código do QR
create or replace function vst_auditar_autor()
returns trigger language plpgsql security definer set search_path = "SE", extensions, pg_temp as $$
declare v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
        v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
        v_reg jsonb; v_dif jsonb; k text;
begin
  v_reg := coalesce(v_new, v_old);
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_array(o.value, n.value)), '{}'::jsonb) into v_dif
    from jsonb_each(v_new) n left join jsonb_each(v_old) o on o.key = n.key
    where n.value is distinct from o.value and n.key <> 'DT_ATUALIZACAO';
    if v_dif = '{}'::jsonb then return null; end if;          -- só mudou a data de atualização
  else
    v_dif := v_reg - 'DT_CRIACAO' - 'DT_ATUALIZACAO';
  end if;
  foreach k in array array['CD_CPF', 'CD_HASH_QR'] loop
    if v_dif ? k then v_dif := jsonb_set(v_dif, array[k], '"***"'::jsonb); end if;
  end loop;
  insert into "VST_AUDITORIA" ("ID_USUARIO", "NM_PAPEL", "NM_TABELA", "TP_OPERACAO", "CD_REGISTRO", "ID_UNIDADE", "DS_ALTERACOES")
  values ((select auth.uid()),
          coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', session_user::text),
          tg_table_name, tg_op,
          case tg_table_name
            when 'VST_RESPOSTA' then (v_reg ->> 'ID_VISTORIA') || '/' || (v_reg ->> 'ID_ITEM')
            when 'VST_USUARIO_PROPRIEDADE' then (v_reg ->> 'ID_USUARIO') || '/' || (v_reg ->> 'ID_PROPRIEDADE')
            when 'VST_USUARIO_UNIDADE' then (v_reg ->> 'ID_USUARIO') || '/' || (v_reg ->> 'ID_UNIDADE')
            when 'VST_TIPO_VISTORIA_ITEM' then (v_reg ->> 'ID_TIPO_VISTORIA') || '/' || (v_reg ->> 'ID_ITEM')
            else v_reg ->> ('ID_' || substr(tg_table_name, 5)) end,
          (v_reg ->> 'ID_UNIDADE')::bigint, v_dif);
  return null;
end;
$$;

alter table "VST_AUDITORIA" enable row level security;          -- sem política: nenhum acesso direto, só pela função
revoke all on "VST_AUDITORIA" from public, anon, authenticated;
grant select on "VST_AUDITORIA" to service_role;

do $$ declare t text; begin
  foreach t in array array['VST_TIPO_VISTORIA', 'VST_USUARIO', 'VST_USUARIO_PROPRIEDADE', 'VST_USUARIO_UNIDADE', 'VST_PROPRIEDADE', 'VST_UNIDADE', 'VST_AMBIENTE',
                           'VST_ITEM', 'VST_TIPO_VISTORIA_ITEM', 'VST_VISTORIA', 'VST_RESPOSTA', 'VST_OCORRENCIA', 'VST_FOTO'] loop
    execute format('drop trigger if exists %I on "SE".%I', 'TG_' || t || '_AUTOR', t);
    execute format('create trigger %I after insert or update or delete on "SE".%I for each row execute function "SE".vst_auditar_autor()',
                   'TG_' || t || '_AUTOR', t);
    execute format('alter table "SE".%I enable row level security', t);
    execute format('revoke all on "SE".%I from public, anon, authenticated', t);
    execute format('grant all on "SE".%I to service_role', t);
    execute format('drop trigger if exists %I on "SE".%I', 'TG_' || t || '_AUDITORIA', t);
    execute format('create trigger %I after insert or update or delete on "SE".%I for each row execute function "SE".auditar()',
                   'TG_' || t || '_AUDITORIA', t);
  end loop;
end $$;
grant usage on schema "SE" to authenticated, service_role;      -- o site já concede; repetir não faz mal
grant usage, select on all sequences in schema "SE" to service_role;

-- o app (authenticated) lê o catálogo e os registros; escrever só pelas funções, exceto cadastros da gestão
grant select on "VST_TIPO_VISTORIA", "VST_USUARIO", "VST_USUARIO_PROPRIEDADE", "VST_USUARIO_UNIDADE", "VST_PROPRIEDADE", "VST_AMBIENTE", "VST_ITEM",
                "VST_TIPO_VISTORIA_ITEM", "VST_VISTORIA", "VST_RESPOSTA", "VST_OCORRENCIA", "VST_FOTO" to authenticated;
grant select ("ID_UNIDADE", "DS_ANDAR", "TP_VALIDACAO", "VL_LATITUDE", "VL_LONGITUDE", "QTDE_RAIO_METROS", "TP_SITUACAO",
              "NO_VERSAO_QR", "DT_CRIACAO", "DT_ATUALIZACAO") on "VST_UNIDADE" to authenticated;      -- sem CD_HASH_QR
grant insert, update, delete on "VST_AMBIENTE", "VST_ITEM", "VST_TIPO_VISTORIA_ITEM" to authenticated;
grant insert, update on "VST_TIPO_VISTORIA", "VST_USUARIO" to authenticated;
grant insert, delete on "VST_USUARIO_PROPRIEDADE", "VST_USUARIO_UNIDADE" to authenticated;
grant insert ("ID_PROPRIEDADE", "TP_VALIDACAO", "VL_LATITUDE", "VL_LONGITUDE", "QTDE_RAIO_METROS", "QTDE_PRECISAO_MAX_METROS", "QTDE_MINUTOS_MIN_VISTORIA"),
      update ("TP_VALIDACAO", "VL_LATITUDE", "VL_LONGITUDE", "QTDE_RAIO_METROS", "QTDE_PRECISAO_MAX_METROS", "QTDE_MINUTOS_MIN_VISTORIA", "DT_ATUALIZACAO")
  on "VST_PROPRIEDADE" to authenticated;
grant update ("DS_ANDAR", "TP_VALIDACAO", "VL_LATITUDE", "VL_LONGITUDE", "QTDE_RAIO_METROS", "DT_ATUALIZACAO") on "VST_UNIDADE" to authenticated;

do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'SE' and tablename like 'VST\_%' loop
    execute format('drop policy %I on "SE".%I', p.policyname, p.tablename);
  end loop;
end $$;

-- catálogo: todo usuário ativo lê; o ADMIN mantém os tipos
create policy "VST_TIPO_VISTORIA_SELECT" on "VST_TIPO_VISTORIA" for select to authenticated using ((select "SE".vst_perfil()) is not null);
create policy "VST_TIPO_VISTORIA_INSERT" on "VST_TIPO_VISTORIA" for insert to authenticated with check ((select "SE".vst_perfil()) = 'ADMIN');
create policy "VST_TIPO_VISTORIA_UPDATE" on "VST_TIPO_VISTORIA" for update to authenticated
  using ((select "SE".vst_perfil()) = 'ADMIN') with check ((select "SE".vst_perfil()) = 'ADMIN');

-- equipe: cada um vê a si, o gestor vê as pousadas dele, o ADMIN vê e mantém tudo
create policy "VST_USUARIO_SELECT" on "VST_USUARIO" for select to authenticated
  using ("ID_USUARIO" = (select auth.uid()) or "SE".vst_pode_ver_usuario("ID_USUARIO"));
create policy "VST_USUARIO_INSERT" on "VST_USUARIO" for insert to authenticated with check ((select "SE".vst_perfil()) = 'ADMIN');
create policy "VST_USUARIO_UPDATE" on "VST_USUARIO" for update to authenticated
  using ((select "SE".vst_perfil()) = 'ADMIN') with check ((select "SE".vst_perfil()) = 'ADMIN');
create policy "VST_USUARIO_PROPRIEDADE_SELECT" on "VST_USUARIO_PROPRIEDADE" for select to authenticated
  using ("ID_USUARIO" = (select auth.uid()) or "SE".vst_pode_gerir("ID_PROPRIEDADE"));
create policy "VST_USUARIO_PROPRIEDADE_INSERT" on "VST_USUARIO_PROPRIEDADE" for insert to authenticated with check ((select "SE".vst_perfil()) = 'ADMIN');
create policy "VST_USUARIO_PROPRIEDADE_DELETE" on "VST_USUARIO_PROPRIEDADE" for delete to authenticated using ((select "SE".vst_perfil()) = 'ADMIN');
create policy "VST_USUARIO_UNIDADE_SELECT" on "VST_USUARIO_UNIDADE" for select to authenticated
  using ("ID_USUARIO" = (select auth.uid()) or "SE".vst_pode_gerir_unidade("ID_UNIDADE"));
create policy "VST_USUARIO_UNIDADE_INSERT" on "VST_USUARIO_UNIDADE" for insert to authenticated with check ((select "SE".vst_perfil()) = 'ADMIN');
create policy "VST_USUARIO_UNIDADE_DELETE" on "VST_USUARIO_UNIDADE" for delete to authenticated using ((select "SE".vst_perfil()) = 'ADMIN');

-- configuração por propriedade e por chalé
create policy "VST_PROPRIEDADE_SELECT" on "VST_PROPRIEDADE" for select to authenticated using ("SE".vst_tem_acesso("ID_PROPRIEDADE"));
create policy "VST_PROPRIEDADE_INSERT" on "VST_PROPRIEDADE" for insert to authenticated with check ((select "SE".vst_perfil()) = 'ADMIN');
create policy "VST_PROPRIEDADE_UPDATE" on "VST_PROPRIEDADE" for update to authenticated
  using ((select "SE".vst_perfil()) = 'ADMIN') with check ((select "SE".vst_perfil()) = 'ADMIN');
create policy "VST_UNIDADE_SELECT" on "VST_UNIDADE" for select to authenticated using ("SE".vst_tem_acesso_unidade("ID_UNIDADE"));
create policy "VST_UNIDADE_UPDATE" on "VST_UNIDADE" for update to authenticated
  using ("SE".vst_pode_gerir_unidade("ID_UNIDADE")) with check ("SE".vst_pode_gerir_unidade("ID_UNIDADE"));

-- checklist: leitura por acesso ao chalé; cadastro pela gestão
create policy "VST_AMBIENTE_SELECT" on "VST_AMBIENTE" for select to authenticated using ("SE".vst_tem_acesso_unidade("ID_UNIDADE"));
create policy "VST_AMBIENTE_INSERT" on "VST_AMBIENTE" for insert to authenticated with check ("SE".vst_pode_gerir_unidade("ID_UNIDADE"));
create policy "VST_AMBIENTE_UPDATE" on "VST_AMBIENTE" for update to authenticated
  using ("SE".vst_pode_gerir_unidade("ID_UNIDADE")) with check ("SE".vst_pode_gerir_unidade("ID_UNIDADE"));
create policy "VST_AMBIENTE_DELETE" on "VST_AMBIENTE" for delete to authenticated using ("SE".vst_pode_gerir_unidade("ID_UNIDADE"));
create policy "VST_ITEM_SELECT" on "VST_ITEM" for select to authenticated using ("SE".vst_tem_acesso_unidade("SE".vst_unidade_do_ambiente("ID_AMBIENTE")));
create policy "VST_ITEM_INSERT" on "VST_ITEM" for insert to authenticated with check ("SE".vst_pode_gerir_unidade("SE".vst_unidade_do_ambiente("ID_AMBIENTE")));
create policy "VST_ITEM_UPDATE" on "VST_ITEM" for update to authenticated
  using ("SE".vst_pode_gerir_unidade("SE".vst_unidade_do_ambiente("ID_AMBIENTE"))) with check ("SE".vst_pode_gerir_unidade("SE".vst_unidade_do_ambiente("ID_AMBIENTE")));
create policy "VST_ITEM_DELETE" on "VST_ITEM" for delete to authenticated using ("SE".vst_pode_gerir_unidade("SE".vst_unidade_do_ambiente("ID_AMBIENTE")));
create policy "VST_TIPO_VISTORIA_ITEM_SELECT" on "VST_TIPO_VISTORIA_ITEM" for select to authenticated using ("SE".vst_tem_acesso_unidade("SE".vst_unidade_do_item("ID_ITEM")));
create policy "VST_TIPO_VISTORIA_ITEM_INSERT" on "VST_TIPO_VISTORIA_ITEM" for insert to authenticated with check ("SE".vst_pode_gerir_unidade("SE".vst_unidade_do_item("ID_ITEM")));
create policy "VST_TIPO_VISTORIA_ITEM_UPDATE" on "VST_TIPO_VISTORIA_ITEM" for update to authenticated
  using ("SE".vst_pode_gerir_unidade("SE".vst_unidade_do_item("ID_ITEM"))) with check ("SE".vst_pode_gerir_unidade("SE".vst_unidade_do_item("ID_ITEM")));
create policy "VST_TIPO_VISTORIA_ITEM_DELETE" on "VST_TIPO_VISTORIA_ITEM" for delete to authenticated using ("SE".vst_pode_gerir_unidade("SE".vst_unidade_do_item("ID_ITEM")));

-- vistorias e o que sai delas: só leitura por acesso ao chalé (a escrita é das funções vst_*)
create policy "VST_VISTORIA_SELECT" on "VST_VISTORIA" for select to authenticated using ("SE".vst_tem_acesso_unidade("ID_UNIDADE"));
create policy "VST_RESPOSTA_SELECT" on "VST_RESPOSTA" for select to authenticated
  using (exists (select 1 from "VST_VISTORIA" v where v."ID_VISTORIA" = "VST_RESPOSTA"."ID_VISTORIA"));
create policy "VST_OCORRENCIA_SELECT" on "VST_OCORRENCIA" for select to authenticated using ("SE".vst_tem_acesso_unidade("ID_UNIDADE"));
create policy "VST_FOTO_SELECT" on "VST_FOTO" for select to authenticated
  using (exists (select 1 from "VST_VISTORIA" v where v."ID_VISTORIA" = "VST_FOTO"."ID_VISTORIA"));

-- funções: nada para anon; as auxiliares e as do app só para o usuário logado
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'SE' and (p.proname like 'vst\_%') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname in ('vst_perfil', 'vst_tem_acesso', 'vst_pode_gerir', 'vst_tem_acesso_unidade', 'vst_pode_gerir_unidade', 'vst_unidade_do_ambiente',
                     'vst_unidade_do_item', 'vst_pode_ver_usuario', 'vst_acesso_arquivo',
                     'vst_unidades', 'vst_agenda', 'vst_checklist', 'vst_resolver_qr', 'vst_criar_vistoria', 'vst_atualizar_agenda',
                     'vst_iniciar_vistoria', 'vst_concluir_vistoria', 'vst_registrar_foto', 'vst_resolver_ocorrencia',
                     'vst_bloquear_por_ocorrencia', 'vst_alterar_situacao_unidade', 'vst_obter_qr', 'vst_rotacionar_qr',
                     'vst_registrar_aceite_lgpd', 'vst_propriedades', 'vst_senha_trocada', 'vst_tipos_unidade', 'vst_ocorrencias', 'vst_auditoria', 'vst_planejar_ocorrencia') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
revoke all on function vst_coerencia_vistoria() from public, anon, authenticated;
grant execute on function vst_localizar_login(text) to service_role;
grant execute on function vst_cadastrar_usuario(uuid, text, text, text, text, bigint[]) to service_role;
grant execute on function vst_exigir_troca_senha(uuid) to service_role;


-- ════════════════════════════════════════════════════════════════════
--  5. STORAGE: bucket privado "vistorias" (o bucket "documentos" não é usado)
--  Objeto: vistorias/<ID_VISTORIA>/<arquivo> — só JPEG, PNG e WEBP, até 5 MB.
--  Ler: quem tem acesso ao chalé da vistoria. Gravar: o responsável (ou gestão)
--  com a vistoria em andamento ou concluída. Sem alterar nem apagar: foto é evidência.
-- ════════════════════════════════════════════════════════════════════

do $$ begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Storage não encontrado: bucket e políticas ignorados.';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('vistorias', 'vistorias', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "vistorias_leitura" on storage.objects';
  execute 'drop policy if exists "vistorias_envio" on storage.objects';
  execute $p$create policy "vistorias_leitura" on storage.objects for select to authenticated
             using (bucket_id = 'vistorias' and (select "SE".vst_acesso_arquivo(name, false)))$p$;
  execute $p$create policy "vistorias_envio" on storage.objects for insert to authenticated
             with check (bucket_id = 'vistorias' and (select "SE".vst_acesso_arquivo(name, true)))$p$;
end $$;

commit;
