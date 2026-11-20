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
  "DT_CRIACAO"          timestamptz not null default now(),
  constraint "PK_VST_TIPO_VISTORIA" primary key ("ID_TIPO_VISTORIA"),
  constraint "UQ_VST_TIPO_VISTORIA_CD_TIPO_VISTORIA" unique ("CD_TIPO_VISTORIA"),
  constraint "UQ_VST_TIPO_VISTORIA_NM_TIPO_VISTORIA" unique ("NM_TIPO_VISTORIA"),
  constraint "CK_VST_TIPO_VISTORIA_CD_TIPO_VISTORIA" check ("CD_TIPO_VISTORIA" ~ '^[A-Z0-9_]+$'),
  constraint "CK_VST_TIPO_VISTORIA_TP_COMPORTAMENTO" check ("TP_COMPORTAMENTO" in ('ENTRADA', 'SAIDA', 'ROTINA', 'MANUTENCAO')),
  constraint "CK_VST_TIPO_VISTORIA_TP_PERIODICIDADE" check ("TP_PERIODICIDADE" in ('DIARIA', 'SEMANAL', 'MENSAL')),
  constraint "CK_VST_TIPO_VISTORIA_ROTINA" check ("TP_COMPORTAMENTO" = 'ROTINA' or "TP_PERIODICIDADE" is null)
);

insert into "VST_TIPO_VISTORIA" ("CD_TIPO_VISTORIA", "NM_TIPO_VISTORIA", "TP_COMPORTAMENTO", "SG_EXIGE_ENTRADA", "SG_EXIGE_ASSINATURA") values
  ('ENTRADA',    'Entrada',    'ENTRADA',    false, false),
  ('SAIDA',      'Saída',      'SAIDA',      true,  true),
  ('ROTINA',     'Rotina',     'ROTINA',     false, false),
  ('MANUTENCAO', 'Manutenção', 'MANUTENCAO', false, false)
on conflict ("CD_TIPO_VISTORIA") do nothing;


-- ── VST_USUARIO: equipe (assessores, gestores, administradores) ─────────
-- ID_USUARIO = auth.users.id. Os usuários são convidados pela equipe
-- (Authentication › Users › Invite); o cadastro aberto do Auth fica desligado.
create table if not exists "VST_USUARIO" (
  "ID_USUARIO"      uuid not null,
  "NM_USUARIO"      text not null,
  "CD_LOGIN"        text not null,                         -- usuário de acesso (minúsculo)
  "CD_CPF"          text,                                  -- só números; também serve para entrar
  "TP_PERFIL"       text not null,
  "SG_ATIVO"        boolean not null default true,
  "DT_ACEITE_LGPD"  timestamptz,                           -- aceite do termo de localização e fotos
  "DT_CRIACAO"      timestamptz not null default now(),
  "DT_ATUALIZACAO"  timestamptz not null default now(),
  constraint "PK_VST_USUARIO" primary key ("ID_USUARIO"),
  constraint "FK_VST_USUARIO_AUTH_USERS" foreign key ("ID_USUARIO") references auth.users ("id"),
  constraint "UQ_VST_USUARIO_CD_LOGIN" unique ("CD_LOGIN"),
  constraint "UQ_VST_USUARIO_CD_CPF" unique ("CD_CPF"),
  constraint "CK_VST_USUARIO_CD_LOGIN" check ("CD_LOGIN" ~ '^[a-z0-9._-]{3,40}$'),
  constraint "CK_VST_USUARIO_CD_CPF" check ("CD_CPF" is null or "SE".cpf_valido("CD_CPF")),
  constraint "CK_VST_USUARIO_TP_PERFIL" check ("TP_PERFIL" in ('ASSESSOR', 'GESTOR', 'ADMIN'))
);

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
  constraint "PK_VST_OCORRENCIA" primary key ("ID_OCORRENCIA"),
  constraint "FK_VST_OCORRENCIA_VST_RESPOSTA" foreign key ("ID_VISTORIA", "ID_ITEM") references "VST_RESPOSTA" ("ID_VISTORIA", "ID_ITEM") on delete cascade,
  constraint "FK_VST_OCORRENCIA_SIT_UNIDADE" foreign key ("ID_UNIDADE") references "SIT_UNIDADE" ("ID_UNIDADE"),
  constraint "FK_VST_OCORRENCIA_SIT_BLOQUEIO" foreign key ("ID_BLOQUEIO") references "SIT_BLOQUEIO" ("ID_BLOQUEIO") on delete set null,
  constraint "UQ_VST_OCORRENCIA_RESPOSTA" unique ("ID_VISTORIA", "ID_ITEM"),
  constraint "CK_VST_OCORRENCIA_TP_GRAVIDADE" check ("TP_GRAVIDADE" in ('BAIXA', 'MEDIA', 'CRITICA')),
  constraint "CK_VST_OCORRENCIA_TP_STATUS" check ("TP_STATUS" in ('ABERTA', 'EM_TRATAMENTO', 'RESOLVIDA', 'CANCELADA')),
  constraint "CK_VST_OCORRENCIA_RESOLUCAO" check ("TP_STATUS" <> 'RESOLVIDA' or "DT_RESOLUCAO" is not null)
);
create index if not exists "IX_VST_OCORRENCIA_ID_UNIDADE_STATUS" on "VST_OCORRENCIA" ("ID_UNIDADE", "TP_STATUS");
create index if not exists "IX_VST_OCORRENCIA_ID_ITEM" on "VST_OCORRENCIA" ("ID_ITEM");
create index if not exists "IX_VST_OCORRENCIA_ID_BLOQUEIO" on "VST_OCORRENCIA" ("ID_BLOQUEIO") where "ID_BLOQUEIO" is not null;

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

create or replace function vst_tem_acesso_unidade(p_id_unidade bigint)
returns boolean language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select "SE".vst_tem_acesso("SE".vst_propriedade_da_unidade(p_id_unidade))
$$;

create or replace function vst_pode_gerir_unidade(p_id_unidade bigint)
returns boolean language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select "SE".vst_pode_gerir("SE".vst_propriedade_da_unidade(p_id_unidade))
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
  where "SE".vst_tem_acesso(u."ID_PROPRIEDADE")
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
    and "SE".vst_tem_acesso(u."ID_PROPRIEDADE")
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

-- Qual chalé é o do QR lido (só se o usuário tiver acesso)
create or replace function vst_resolver_qr(p_cd_hash_qr text)
returns table (id_unidade bigint, cd_unidade text, nm_unidade text)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".vst_usuario_atual();
  return query
  select u."ID_UNIDADE", u."CD_UNIDADE", u."NM_UNIDADE"
  from "VST_UNIDADE" vu join "SIT_UNIDADE" u on u."ID_UNIDADE" = vu."ID_UNIDADE"
  where vu."CD_HASH_QR" = p_cd_hash_qr and "SE".vst_tem_acesso(u."ID_PROPRIEDADE");
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
  if p_dt_agendada is null then raise exception 'data_obrigatoria' using errcode = 'P0001'; end if;
  if u."TP_PERFIL" = 'ASSESSOR' then
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
       select 1 from "VST_USUARIO" x where x."ID_USUARIO" = p_id_usuario and x."SG_ATIVO"
         and (x."TP_PERFIL" = 'ADMIN' or exists (select 1 from "VST_USUARIO_PROPRIEDADE" up
                                                 where up."ID_USUARIO" = x."ID_USUARIO" and up."ID_PROPRIEDADE" = "SE".vst_propriedade_da_unidade(v."ID_UNIDADE")))) then
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
  if v."ID_USUARIO" is not null and v."ID_USUARIO" <> u."ID_USUARIO" and u."TP_PERFIL" = 'ASSESSOR' then
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
--  p_respostas: [{"id_item":1,"tp_resposta":"OK|PROBLEMA|NAO_SE_APLICA","qtde_encontrada":4,"ds_observacao":"…","dt_resposta":"…"}]
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
  if v."ID_USUARIO" <> u."ID_USUARIO" and u."TP_PERFIL" = 'ASSESSOR' then raise exception 'vistoria_de_outro_usuario' using errcode = 'P0001'; end if;
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
             where k.sg_foto_obrigatoria and not exists (select 1 from jsonb_to_recordset(p_fotos) as f(id_item bigint) where f.id_item = k.id_item)) then
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
  for rec in
    select x.id_item, nullif(btrim(x.ds_observacao), '') as ds, i."SG_CRITICO"
    from jsonb_to_recordset(p_respostas) as x(id_item bigint, tp_resposta text, ds_observacao text)
    join "VST_ITEM" i on i."ID_ITEM" = x.id_item
    where x.tp_resposta = 'PROBLEMA'
  loop
    insert into "VST_OCORRENCIA" ("ID_VISTORIA", "ID_ITEM", "ID_UNIDADE", "TP_GRAVIDADE", "DS_OCORRENCIA", "DT_ABERTURA")
    values (p_id_vistoria, rec.id_item, v."ID_UNIDADE", case when rec."SG_CRITICO" then 'CRITICA' else 'BAIXA' end, rec.ds, v_fim)
    returning "ID_OCORRENCIA" into v_oc;
    v_n := v_n + 1;
    if rec."SG_CRITICO" then v_bloq := "SE".vst_criar_bloqueio_manutencao(v_oc); end if;
  end loop;

  -- situação do chalé: ocorrência crítica manda; senão vale a escolha do assessor
  v_situacao := case when v_bloq is not null then 'MANUTENCAO' else p_tp_situacao_resultante end;
  if v_bloq is null and p_tp_situacao_resultante is not null then
    perform "SE".vst_mudar_situacao(v."ID_UNIDADE", p_tp_situacao_resultante, u."TP_PERFIL");
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
  if v."ID_USUARIO" <> u."ID_USUARIO" and u."TP_PERFIL" = 'ASSESSOR' then raise exception 'vistoria_de_outro_usuario' using errcode = 'P0001'; end if;
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
  if not "SE".vst_pode_gerir_unidade(o."ID_UNIDADE") then raise exception 'perfil_sem_permissao' using errcode = 'P0001'; end if;
  if p_tp_status not in ('EM_TRATAMENTO', 'RESOLVIDA', 'CANCELADA') then raise exception 'status_invalido' using errcode = 'P0001'; end if;
  update "VST_OCORRENCIA"
  set "TP_STATUS" = p_tp_status, "DS_TRATAMENTO" = coalesce(nullif(btrim(p_ds_tratamento), ''), "DS_TRATAMENTO"),
      "DT_RESOLUCAO" = case when p_tp_status = 'RESOLVIDA' then now() else "DT_RESOLUCAO" end
  where "ID_OCORRENCIA" = p_id_ocorrencia;
  if p_liberar then
    if p_tp_status not in ('RESOLVIDA', 'CANCELADA') then raise exception 'status_invalido' using errcode = 'P0001'; end if;
    perform "SE".vst_mudar_situacao(o."ID_UNIDADE", 'LIBERADO', u."TP_PERFIL");
  end if;
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

do $$ declare t text; begin
  foreach t in array array['VST_TIPO_VISTORIA', 'VST_USUARIO', 'VST_USUARIO_PROPRIEDADE', 'VST_PROPRIEDADE', 'VST_UNIDADE', 'VST_AMBIENTE',
                           'VST_ITEM', 'VST_TIPO_VISTORIA_ITEM', 'VST_VISTORIA', 'VST_RESPOSTA', 'VST_OCORRENCIA', 'VST_FOTO'] loop
    execute format('alter table "SE".%I enable row level security', t);
    execute format('revoke all on "SE".%I from public, anon, authenticated', t);
    execute format('grant all on "SE".%I to service_role', t);
    execute format('drop trigger if exists %I on "SE".%I', 'TG_' || t || '_AUDITORIA', t);
    execute format('create trigger %I after insert or update or delete on "SE".%I for each row execute function "SE".auditar()',
                   'TG_' || t || '_AUDITORIA', t);
  end loop;
end $$;
grant usage, select on all sequences in schema "SE" to service_role;

-- o app (authenticated) lê o catálogo e os registros; escrever só pelas funções, exceto cadastros da gestão
grant select on "VST_TIPO_VISTORIA", "VST_USUARIO", "VST_USUARIO_PROPRIEDADE", "VST_PROPRIEDADE", "VST_AMBIENTE", "VST_ITEM",
                "VST_TIPO_VISTORIA_ITEM", "VST_VISTORIA", "VST_RESPOSTA", "VST_OCORRENCIA", "VST_FOTO" to authenticated;
grant select ("ID_UNIDADE", "DS_ANDAR", "TP_VALIDACAO", "VL_LATITUDE", "VL_LONGITUDE", "QTDE_RAIO_METROS", "TP_SITUACAO",
              "NO_VERSAO_QR", "DT_CRIACAO", "DT_ATUALIZACAO") on "VST_UNIDADE" to authenticated;      -- sem CD_HASH_QR
grant insert, update, delete on "VST_AMBIENTE", "VST_ITEM", "VST_TIPO_VISTORIA_ITEM" to authenticated;
grant insert, update on "VST_TIPO_VISTORIA", "VST_USUARIO" to authenticated;
grant insert, delete on "VST_USUARIO_PROPRIEDADE" to authenticated;
grant update ("TP_VALIDACAO", "VL_LATITUDE", "VL_LONGITUDE", "QTDE_RAIO_METROS", "QTDE_PRECISAO_MAX_METROS", "QTDE_MINUTOS_MIN_VISTORIA", "DT_ATUALIZACAO")
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

-- configuração por propriedade e por chalé
create policy "VST_PROPRIEDADE_SELECT" on "VST_PROPRIEDADE" for select to authenticated using ("SE".vst_tem_acesso("ID_PROPRIEDADE"));
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
                     'vst_bloquear_por_ocorrencia', 'vst_alterar_situacao_unidade', 'vst_obter_qr', 'vst_rotacionar_qr') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
revoke all on function vst_coerencia_vistoria() from public, anon, authenticated;


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
