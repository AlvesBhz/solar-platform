-- ════════════════════════════════════════════════════════════════════
--  Solar do Espinhaço · Reservas — disponibilidade e preços
--  PostgreSQL 15+ (Supabase). Proposta v2 — ver README.md desta pasta.
--
--  Padrão de nomes (o mesmo dos outros projetos, ex.: IBP)
--  • Tabelas e campos em MAIÚSCULAS, em português, tabelas no singular.
--  • Prefixo pelo tipo do campo:
--      ID_   identificador          NM_   nome
--      DS_   descrição / texto      DT_   data ou data e hora
--      VL_   valor (R$ ou %)        QTDE_ quantidade
--      NO_   número                 CD_   código
--      TP_   tipo (lista fixa)      SG_   indicador sim/não
--      HR_   hora do dia (novo: não havia no IBP)
--  • Chave primária = ID_<TABELA>, repetida com o mesmo nome nas filhas.
--  • Restrições: PK_<TABELA>, FK_<FILHA>_<PAI>, UQ_ (única), CK_ (regra),
--    EX_ (exclusão), IX_ (índice).
--  • O PostgreSQL guarda nomes sem aspas em minúsculas por dentro; escrever
--    em maiúsculas nas consultas funciona igual (SELECT VL_TOTAL FROM RESERVA).
--
--  Convenções de reserva
--  • Estadia = noites de DT_CHECKIN até a véspera de DT_CHECKOUT: quem sai
--    no dia 10 libera o chalé para quem entra no dia 10.
--  • Datas no fuso da propriedade (America/Sao_Paulo); dinheiro em
--    numeric(10,2); identificadores bigint gerados pelo banco.
--  • O site (visitante anônimo) só enxerga a função
--    consultar_disponibilidade(): nenhuma tabela é exposta.
-- ════════════════════════════════════════════════════════════════════

-- '=' em bigint dentro de restrições EXCLUDE. No Supabase as extensões
-- ficam no schema "extensions" (o comando também funciona fora dele).
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;


-- ── PROPRIEDADE: a pousada ──────────────────────────────────────────

create table PROPRIEDADE (
  ID_PROPRIEDADE           bigint generated always as identity,
  NM_PROPRIEDADE           text not null,
  DS_FUSO_HORARIO          text not null default 'America/Sao_Paulo',
  HR_CHECKIN               time not null default '15:00',
  HR_CHECKOUT              time not null default '12:00',
  NO_IDADE_MAX_BEBE        smallint not null default 1,           -- bebês: até 1 ano (abaixo de 2); não pagam, mas ocupam vaga de criança
  NO_IDADE_MAX_CRIANCA     smallint not null default 13,          -- crianças: 2 a 13 anos; a partir de 14, adulto
  QTDE_MAX_NOITES          smallint not null default 7,
  VL_PERCENTUAL_SINAL      numeric(5,2) not null default 50,      -- % do total pago na reserva
  QTDE_MINUTOS_PRE_RESERVA smallint not null default 30,          -- tempo para pagar o sinal
  QTDE_DIAS_LIMITE_REMARCACAO smallint not null default 7,        -- remarcar até N dias antes do check-in (proposta)
  QTDE_MESES_VALIDADE_CREDITO smallint not null default 12,       -- prazo para usar o crédito do sinal (proposta)
  QTDE_DIAS_ARREPENDIMENTO smallint not null default 7,           -- CDC art. 49: desistência com reembolso integral
  NO_VERSAO_POLITICA       smallint not null default 1,           -- versão vigente da política de cancelamento
  DT_CRIACAO               timestamptz not null default now(),
  constraint PK_PROPRIEDADE primary key (ID_PROPRIEDADE),
  constraint CK_PROPRIEDADE_REMARCACAO check (QTDE_DIAS_LIMITE_REMARCACAO >= 0 and QTDE_MESES_VALIDADE_CREDITO >= 1),
  constraint CK_PROPRIEDADE_ARREPENDIMENTO check (QTDE_DIAS_ARREPENDIMENTO >= 7),     -- o mínimo é o da lei
  constraint CK_PROPRIEDADE_MAX_NOITES check (QTDE_MAX_NOITES between 1 and 365),
  constraint CK_PROPRIEDADE_IDADES check (NO_IDADE_MAX_BEBE >= 0 and NO_IDADE_MAX_BEBE < NO_IDADE_MAX_CRIANCA),
  constraint CK_PROPRIEDADE_SINAL check (VL_PERCENTUAL_SINAL between 0 and 100),
  constraint CK_PROPRIEDADE_PRE_RESERVA check (QTDE_MINUTOS_PRE_RESERVA between 5 and 1440)
);


-- ── UNIDADE: cada chalé ─────────────────────────────────────────────

create table UNIDADE (
  ID_UNIDADE         bigint generated always as identity,
  ID_PROPRIEDADE     bigint not null,
  CD_UNIDADE         text not null,                   -- código curto usado pelo site (ex.: casa-do-mirante)
  NM_UNIDADE         text not null,
  TP_UNIDADE         text not null default 'CHALE',
  QTDE_MAX_HOSPEDES  smallint not null,
  QTDE_MAX_ADULTOS   smallint not null,
  QTDE_MAX_CRIANCAS  smallint not null default 0,     -- crianças + bebês
  VL_TAXA_LIMPEZA    numeric(10,2) not null default 0,
  SG_ATIVO           boolean not null default true,
  NO_ORDEM           smallint not null default 0,
  DT_CRIACAO         timestamptz not null default now(),
  constraint PK_UNIDADE primary key (ID_UNIDADE),
  constraint FK_UNIDADE_PROPRIEDADE foreign key (ID_PROPRIEDADE) references PROPRIEDADE (ID_PROPRIEDADE),
  constraint UQ_UNIDADE_CD_UNIDADE unique (CD_UNIDADE),
  constraint CK_UNIDADE_CD_UNIDADE check (CD_UNIDADE ~ '^[a-z0-9-]+$'),
  constraint CK_UNIDADE_TP_UNIDADE check (TP_UNIDADE in ('CHALE', 'QUARTO', 'SUITE')),
  constraint CK_UNIDADE_CAPACIDADE check (QTDE_MAX_HOSPEDES >= 1 and QTDE_MAX_ADULTOS >= 1 and QTDE_MAX_CRIANCAS >= 0),
  constraint CK_UNIDADE_TAXA_LIMPEZA check (VL_TAXA_LIMPEZA >= 0)
);
create index IX_UNIDADE_ID_PROPRIEDADE on UNIDADE (ID_PROPRIEDADE);


-- ── TARIFA: preço por período ───────────────────────────────────────
-- Períodos podem se sobrepor quando a prioridade é diferente: vale o
-- maior NO_PRIORIDADE (ex.: Réveillon por cima da tarifa padrão). Na
-- mesma prioridade a sobreposição é recusada.

create table TARIFA (
  ID_TARIFA               bigint generated always as identity,
  ID_UNIDADE              bigint not null,
  NM_TARIFA               text not null,
  DT_INI                  date not null,                -- primeira noite
  DT_FIM                  date not null,                -- dia seguinte à última noite
  NO_PRIORIDADE           smallint not null default 0,
  VL_NOITE                numeric(10,2) not null,       -- cobre os adultos inclusos
  VL_NOITE_FDS            numeric(10,2),                -- noites de sex e sáb; vazio = VL_NOITE
  QTDE_ADULTOS_INCLUSOS   smallint not null default 2,
  VL_ADULTO_EXTRA         numeric(10,2) not null default 0,   -- por adulto além dos inclusos, por noite
  VL_CRIANCA              numeric(10,2) not null default 0,   -- por criança (2 a 13 anos), por noite
  VL_BEBE                 numeric(10,2) not null default 0,   -- por bebê (até 1 ano), por noite: R$ 0, bebê não paga
  QTDE_MIN_NOITES         smallint not null default 1,
  SG_ATIVO                boolean not null default true,
  DT_CRIACAO              timestamptz not null default now(),
  constraint PK_TARIFA primary key (ID_TARIFA),
  constraint FK_TARIFA_UNIDADE foreign key (ID_UNIDADE) references UNIDADE (ID_UNIDADE) on delete cascade,
  constraint CK_TARIFA_PERIODO check (DT_FIM > DT_INI),
  constraint CK_TARIFA_VALORES check (VL_NOITE >= 0 and coalesce(VL_NOITE_FDS, 0) >= 0
                                      and VL_ADULTO_EXTRA >= 0 and VL_CRIANCA >= 0 and VL_BEBE >= 0),
  constraint CK_TARIFA_QUANTIDADES check (QTDE_ADULTOS_INCLUSOS >= 1 and QTDE_MIN_NOITES >= 1),
  constraint EX_TARIFA_SOBREPOSICAO exclude using gist
    (ID_UNIDADE with =, NO_PRIORIDADE with =, daterange(DT_INI, DT_FIM) with &&) where (SG_ATIVO)
);
create index IX_TARIFA_PERIODO on TARIFA using gist (ID_UNIDADE, daterange(DT_INI, DT_FIM));


-- ── AJUSTE_DIARIO: exceção de uma data ──────────────────────────────

create table AJUSTE_DIARIO (
  ID_UNIDADE       bigint not null,
  DT_REF           date not null,                 -- a noite ajustada
  VL_NOITE         numeric(10,2),                 -- vazio = usa a tarifa
  QTDE_MIN_NOITES  smallint,
  SG_FECHADO       boolean not null default false,
  SG_SEM_CHEGADA   boolean not null default false,
  SG_SEM_SAIDA     boolean not null default false,
  DS_OBSERVACAO    text,
  constraint PK_AJUSTE_DIARIO primary key (ID_UNIDADE, DT_REF),
  constraint FK_AJUSTE_DIARIO_UNIDADE foreign key (ID_UNIDADE) references UNIDADE (ID_UNIDADE) on delete cascade,
  constraint CK_AJUSTE_DIARIO_VALORES check (coalesce(VL_NOITE, 0) >= 0 and coalesce(QTDE_MIN_NOITES, 1) >= 1)
);


-- ── HOSPEDE: quem reserva ───────────────────────────────────────────

-- Documento do hóspede (FNRH digital, obrigatória desde 20/04/2026):
-- brasileiro informa CPF; estrangeiro informa passaporte e o país que o
-- emitiu. O CPF NÃO é a chave: estrangeiro não tem CPF, a pré-reserva
-- nasce antes do documento e a chave se espalha pelas FKs (LGPD).
create or replace function cpf_valido(p_cpf text)
returns boolean
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  -- 11 dígitos, não todos iguais, e os 2 dígitos verificadores corretos
  select p_cpf ~ '^[0-9]{11}$'
     and p_cpf !~ '^(.)\1{10}$'
     and (select (sum(substr(p_cpf, i, 1)::int * (11 - i)) * 10 % 11) % 10 from generate_series(1, 9) i)
         = substr(p_cpf, 10, 1)::int
     and (select (sum(substr(p_cpf, i, 1)::int * (12 - i)) * 10 % 11) % 10 from generate_series(1, 10) i)
         = substr(p_cpf, 11, 1)::int
$$;

create table HOSPEDE (
  ID_HOSPEDE          bigint generated always as identity,
  NM_HOSPEDE          text not null,
  DS_EMAIL            text not null,
  DS_TELEFONE         text,
  SG_NACIONALIDADE    char(2) not null default 'BR',  -- ISO 3166-1: BR, US, AR...
  CD_CPF              text,                          -- só os 11 dígitos, sem pontos
  CD_PASSAPORTE       text,                          -- letras maiúsculas e números
  SG_PAIS_PASSAPORTE  char(2),                       -- país que emitiu o passaporte
  DT_CRIACAO          timestamptz not null default now(),
  constraint PK_HOSPEDE primary key (ID_HOSPEDE),
  constraint CK_HOSPEDE_NACIONALIDADE check (SG_NACIONALIDADE ~ '^[A-Z]{2}$'),
  constraint CK_HOSPEDE_CPF check (CD_CPF is null or cpf_valido(CD_CPF)),
  constraint CK_HOSPEDE_PASSAPORTE check (CD_PASSAPORTE is null or CD_PASSAPORTE ~ '^[A-Z0-9]{5,20}$'),
  -- passaporte e país andam juntos
  constraint CK_HOSPEDE_PAIS_PASSAPORTE check ((CD_PASSAPORTE is null) = (SG_PAIS_PASSAPORTE is null)
                                               and (SG_PAIS_PASSAPORTE is null or SG_PAIS_PASSAPORTE ~ '^[A-Z]{2}$')),
  -- brasileiro: CPF obrigatório; estrangeiro: passaporte obrigatório
  constraint CK_HOSPEDE_DOCUMENTO check (case when SG_NACIONALIDADE = 'BR' then CD_CPF is not null
                                              else CD_PASSAPORTE is not null end),
  constraint UQ_HOSPEDE_CPF unique (CD_CPF),
  constraint UQ_HOSPEDE_PASSAPORTE unique (SG_PAIS_PASSAPORTE, CD_PASSAPORTE)
);
create unique index UQ_HOSPEDE_DS_EMAIL on HOSPEDE (lower(DS_EMAIL));


-- ── RESERVA: estadias vendidas ──────────────────────────────────────
-- Política: o sinal não é devolvido; o hóspede pode só remarcar. A
-- remarcação cria uma reserva nova com ID_RESERVA_ORIGINAL apontando
-- para a antiga (que fica REMARCADA), e o que foi pago vale como crédito.

create table RESERVA (
  ID_RESERVA           bigint generated always as identity,
  CD_RESERVA           text not null                 -- mostrado ao hóspede; aleatório
                       default 'SE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  ID_UNIDADE           bigint not null,
  ID_HOSPEDE           bigint,
  DT_CHECKIN           date not null,
  DT_CHECKOUT          date not null,
  QTDE_ADULTOS         smallint not null,
  QTDE_CRIANCAS        smallint not null default 0,  -- 2 a 13 anos
  QTDE_BEBES           smallint not null default 0,  -- abaixo de 2 anos: não pagam, mas ocupam vaga
  TP_STATUS            text not null default 'PENDENTE',
  TP_CANAL             text not null default 'SITE',
  VL_HOSPEDAGEM        numeric(10,2) not null,
  VL_TAXA_LIMPEZA      numeric(10,2) not null default 0,
  VL_TOTAL             numeric(10,2) generated always as (VL_HOSPEDAGEM + VL_TAXA_LIMPEZA) stored,
  VL_SINAL             numeric(10,2) not null default 0,   -- pago na reserva; não reembolsável
  VL_SALDO             numeric(10,2) generated always as (VL_HOSPEDAGEM + VL_TAXA_LIMPEZA - VL_SINAL) stored,  -- pago no check-in
  DS_DETALHE_PRECOS    jsonb not null default '[]',        -- cálculo noite a noite no momento da reserva
  DT_EXPIRA            timestamptz,                         -- só para PENDENTE
  ID_RESERVA_ORIGINAL  bigint,
  TP_MOTIVO_CANCELAMENTO text,                       -- só quando CANCELADA
  NO_VERSAO_POLITICA   smallint,                     -- versão da política aceita
  DT_ACEITE_POLITICA   timestamptz,                  -- quando o hóspede aceitou a política
  DT_CRIACAO           timestamptz not null default now(),
  DT_ATUALIZACAO       timestamptz not null default now(),
  constraint PK_RESERVA primary key (ID_RESERVA),
  constraint UQ_RESERVA_CD_RESERVA unique (CD_RESERVA),
  constraint FK_RESERVA_UNIDADE foreign key (ID_UNIDADE) references UNIDADE (ID_UNIDADE),
  constraint FK_RESERVA_HOSPEDE foreign key (ID_HOSPEDE) references HOSPEDE (ID_HOSPEDE),
  constraint FK_RESERVA_RESERVA_ORIGINAL foreign key (ID_RESERVA_ORIGINAL) references RESERVA (ID_RESERVA),
  constraint CK_RESERVA_PERIODO check (DT_CHECKOUT > DT_CHECKIN),
  constraint CK_RESERVA_OCUPACAO check (QTDE_ADULTOS >= 1 and QTDE_CRIANCAS >= 0 and QTDE_BEBES >= 0),
  constraint CK_RESERVA_TP_STATUS check (TP_STATUS in ('PENDENTE', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA', 'REMARCADA')),
  constraint CK_RESERVA_TP_CANAL check (TP_CANAL in ('SITE', 'DIRETO', 'TELEFONE')),
  constraint CK_RESERVA_VALORES check (VL_HOSPEDAGEM >= 0 and VL_TAXA_LIMPEZA >= 0 and VL_SINAL >= 0
                                       and VL_SINAL <= VL_HOSPEDAGEM + VL_TAXA_LIMPEZA),
  constraint CK_RESERVA_PENDENTE_EXPIRA check (TP_STATUS <> 'PENDENTE' or DT_EXPIRA is not null),
  constraint CK_RESERVA_CONFIRMADA_HOSPEDE check (TP_STATUS <> 'CONFIRMADA' or ID_HOSPEDE is not null),
  constraint CK_RESERVA_TP_MOTIVO_CANCELAMENTO check (TP_MOTIVO_CANCELAMENTO in
    ('ARREPENDIMENTO', 'DESISTENCIA', 'FORCA_MAIOR', 'NAO_COMPARECIMENTO', 'POUSADA')),
  constraint CK_RESERVA_CANCELADA_MOTIVO check ((TP_STATUS = 'CANCELADA') = (TP_MOTIVO_CANCELAMENTO is not null)),
  -- reserva do site só é confirmada com a política aceita (dever de informação, CDC)
  constraint CK_RESERVA_SITE_ACEITE check (TP_CANAL <> 'SITE' or TP_STATUS <> 'CONFIRMADA'
                                           or (DT_ACEITE_POLITICA is not null and NO_VERSAO_POLITICA is not null)),
  -- Última barreira contra overbooking: duas reservas ativas da mesma
  -- unidade nunca ocupam a mesma noite, mesmo com acessos simultâneos.
  constraint EX_RESERVA_SEM_CONFLITO exclude using gist
    (ID_UNIDADE with =, daterange(DT_CHECKIN, DT_CHECKOUT) with &&)
    where (TP_STATUS in ('PENDENTE', 'CONFIRMADA'))
);
create index IX_RESERVA_ID_HOSPEDE on RESERVA (ID_HOSPEDE);
create index IX_RESERVA_ID_RESERVA_ORIGINAL on RESERVA (ID_RESERVA_ORIGINAL);
create index IX_RESERVA_PERIODO on RESERVA using gist (ID_UNIDADE, daterange(DT_CHECKIN, DT_CHECKOUT));
create index IX_RESERVA_PENDENTE_EXPIRA on RESERVA (DT_EXPIRA) where TP_STATUS = 'PENDENTE';


-- ── PAGAMENTO: Pix e Mercado Pago ───────────────────────────────────
-- Duas parcelas por reserva: o SINAL, pago no site para confirmar, e o
-- SALDO, pago no check-in, antes de entrar (Pix ou dinheiro). Cada parcela pode ter mais de
-- uma tentativa (ex.: o Pix venceu e o hóspede gerou outro). O status é
-- atualizado pelo aviso (webhook) que o Mercado Pago envia.
-- MANUAL = Pix recebido direto e conferido pela equipe.

create table PAGAMENTO (
  ID_PAGAMENTO          bigint generated always as identity,
  ID_RESERVA            bigint not null,
  TP_PARCELA            text not null default 'SINAL',
  TP_PROVEDOR           text not null default 'MERCADO_PAGO',
  TP_METODO             text not null,
  VL_PAGAMENTO          numeric(10,2) not null,
  TP_STATUS             text not null default 'PENDENTE',
  CD_EXTERNO            text,                 -- número do pagamento no Mercado Pago
  DS_PIX_COPIA_E_COLA   text,                 -- código Pix que o hóspede cola no app do banco
  DT_EXPIRA             timestamptz,          -- validade do código Pix
  DT_PAGAMENTO          timestamptz,
  DT_CRIACAO            timestamptz not null default now(),
  constraint PK_PAGAMENTO primary key (ID_PAGAMENTO),
  constraint FK_PAGAMENTO_RESERVA foreign key (ID_RESERVA) references RESERVA (ID_RESERVA),
  constraint UQ_PAGAMENTO_CD_EXTERNO unique (CD_EXTERNO),
  constraint CK_PAGAMENTO_TP_PARCELA check (TP_PARCELA in ('SINAL', 'SALDO')),
  constraint CK_PAGAMENTO_TP_PROVEDOR check (TP_PROVEDOR in ('MERCADO_PAGO', 'MANUAL')),
  constraint CK_PAGAMENTO_TP_METODO check (TP_METODO in ('PIX', 'CARTAO_CREDITO', 'DINHEIRO')),
  constraint CK_PAGAMENTO_DINHEIRO_MANUAL check (TP_METODO <> 'DINHEIRO' or TP_PROVEDOR = 'MANUAL'),
  constraint CK_PAGAMENTO_TP_STATUS check (TP_STATUS in ('PENDENTE', 'APROVADO', 'RECUSADO', 'CANCELADO', 'ESTORNADO')),
  constraint CK_PAGAMENTO_VALOR check (VL_PAGAMENTO > 0),
  constraint CK_PAGAMENTO_APROVADO_DATA check (TP_STATUS <> 'APROVADO' or DT_PAGAMENTO is not null)
);
create index IX_PAGAMENTO_ID_RESERVA on PAGAMENTO (ID_RESERVA);


-- ── CALENDARIO_EXTERNO e BLOQUEIO: datas fora da venda ──────────────
-- O chalé também é vendido no Airbnb e no Booking. Um job lê o iCal de
-- cada canal e grava as datas como BLOQUEIO. Bloqueios ficam fora da
-- restrição EX_RESERVA_SEM_CONFLITO de propósito: o iCal de um canal
-- costuma devolver também as datas que o próprio site já vendeu.

create table CALENDARIO_EXTERNO (
  ID_CALENDARIO            bigint generated always as identity,
  ID_UNIDADE               bigint not null,
  TP_CANAL                 text not null,
  DS_URL_IMPORTACAO        text not null,       -- link iCal fornecido pelo canal
  SG_ATIVO                 boolean not null default true,
  DT_ULTIMA_SINCRONIZACAO  timestamptz,
  DS_ULTIMO_ERRO           text,
  constraint PK_CALENDARIO_EXTERNO primary key (ID_CALENDARIO),
  constraint FK_CALENDARIO_EXTERNO_UNIDADE foreign key (ID_UNIDADE) references UNIDADE (ID_UNIDADE) on delete cascade,
  constraint UQ_CALENDARIO_EXTERNO_CANAL unique (ID_UNIDADE, TP_CANAL),
  constraint CK_CALENDARIO_EXTERNO_TP_CANAL check (TP_CANAL in ('AIRBNB', 'BOOKING', 'OUTRO'))
);

create table BLOQUEIO (
  ID_BLOQUEIO     bigint generated always as identity,
  ID_UNIDADE      bigint not null,
  DT_INI          date not null,              -- primeira noite bloqueada
  DT_FIM          date not null,              -- dia seguinte à última noite
  TP_MOTIVO       text not null,
  ID_CALENDARIO   bigint,
  CD_EXTERNO      text,                       -- UID do evento iCal: permite atualizar/remover no próximo sync
  DS_OBSERVACAO   text,
  DT_CRIACAO      timestamptz not null default now(),
  constraint PK_BLOQUEIO primary key (ID_BLOQUEIO),
  constraint FK_BLOQUEIO_UNIDADE foreign key (ID_UNIDADE) references UNIDADE (ID_UNIDADE) on delete cascade,
  constraint FK_BLOQUEIO_CALENDARIO_EXTERNO foreign key (ID_CALENDARIO) references CALENDARIO_EXTERNO (ID_CALENDARIO) on delete cascade,
  constraint UQ_BLOQUEIO_CD_EXTERNO unique (ID_CALENDARIO, CD_EXTERNO),
  constraint CK_BLOQUEIO_PERIODO check (DT_FIM > DT_INI),
  constraint CK_BLOQUEIO_TP_MOTIVO check (TP_MOTIVO in ('CANAL_EXTERNO', 'MANUTENCAO', 'USO_PROPRIO', 'OUTRO')),
  constraint CK_BLOQUEIO_ORIGEM_CANAL check ((TP_MOTIVO = 'CANAL_EXTERNO') = (ID_CALENDARIO is not null))
);
create index IX_BLOQUEIO_PERIODO on BLOQUEIO using gist (ID_UNIDADE, daterange(DT_INI, DT_FIM));


-- ════════════════════════════════════════════════════════════════════
--  Cálculo de uma estadia (uso interno)
--  Valida datas e ocupação, verifica conflitos e soma o preço noite a
--  noite. Devolve o motivo quando a unidade não está disponível.
--
--  Motivos: datas_invalidas · data_passada · estadia_longa ·
--  unidade_inativa · capacidade · sem_tarifa · fechado · sem_chegada ·
--  sem_saida · min_noites · ocupado
-- ════════════════════════════════════════════════════════════════════

create or replace function calcular_estadia(
  p_id_unidade bigint,
  p_checkin    date,
  p_checkout   date,
  p_adultos    int,
  p_criancas   int default 0,
  p_bebes      int default 0
)
returns table (
  disponivel        boolean,
  motivo            text,
  qtde_noites       int,
  qtde_min_noites   int,
  vl_hospedagem     numeric(10,2),
  vl_taxa_limpeza   numeric(10,2),
  vl_total          numeric(10,2),
  ds_detalhe        jsonb
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  u        UNIDADE%rowtype;
  p        PROPRIEDADE%rowtype;
  v_hoje   date;
  v_noites int;
  v_min    int;
  v_total  numeric(10,2);
  v_det    jsonb;
  v_sem_tarifa boolean;
  v_fechado    boolean;
begin
  p_criancas := coalesce(p_criancas, 0);
  p_bebes    := coalesce(p_bebes, 0);
  select * into u from UNIDADE where ID_UNIDADE = p_id_unidade;
  if not found then
    return query select false, 'unidade_inativa', 0, 0, 0::numeric(10,2), 0::numeric(10,2), 0::numeric(10,2), '[]'::jsonb;
    return;
  end if;
  select * into p from PROPRIEDADE where ID_PROPRIEDADE = u.ID_PROPRIEDADE;

  v_hoje   := (now() at time zone p.DS_FUSO_HORARIO)::date;
  v_noites := p_checkout - p_checkin;

  -- 1 · datas e ocupação
  motivo := case
    when p_checkin is null or p_checkout is null or v_noites < 1          then 'datas_invalidas'
    when p_checkin < v_hoje                                                then 'data_passada'
    when v_noites > p.QTDE_MAX_NOITES                                      then 'estadia_longa'
    when not u.SG_ATIVO                                                    then 'unidade_inativa'
    when coalesce(p_adultos, 0) < 1 or p_criancas < 0 or p_bebes < 0
      or p_adultos > u.QTDE_MAX_ADULTOS
      or p_criancas + p_bebes > u.QTDE_MAX_CRIANCAS                        -- bebês ocupam vaga de criança
      or p_adultos + p_criancas + p_bebes > u.QTDE_MAX_HOSPEDES            then 'capacidade'
  end;
  if motivo is not null then
    return query select false, motivo, greatest(coalesce(v_noites, 0), 0), 0,
                        0::numeric(10,2), 0::numeric(10,2), 0::numeric(10,2), '[]'::jsonb;
    return;
  end if;

  -- 2 · preço noite a noite: ajuste do dia > tarifa de maior prioridade
  with noites as (
    select gs::date as data
    from generate_series(p_checkin::timestamp, (p_checkout - 1)::timestamp, interval '1 day') gs
  ),
  calc as (
    select n.data,
           t.NM_TARIFA as tarifa,
           a.SG_FECHADO as fechado,
           greatest(coalesce(a.QTDE_MIN_NOITES, t.QTDE_MIN_NOITES, 1), 1) as min_n,
           coalesce(
             a.VL_NOITE,
             case when extract(isodow from n.data) in (5, 6)          -- sexta e sábado
                  then coalesce(t.VL_NOITE_FDS, t.VL_NOITE)
                  else t.VL_NOITE end
           ) as valor_base,
           -- o valor da noite cobre os adultos inclusos; cada criança paga à parte;
           -- bebês ocupam vaga de criança (checado acima) mas pagam VL_BEBE, hoje R$ 0
           greatest(p_adultos - t.QTDE_ADULTOS_INCLUSOS, 0) * t.VL_ADULTO_EXTRA as vl_adultos_extra,
           p_criancas * t.VL_CRIANCA as vl_criancas,
           p_bebes * t.VL_BEBE as vl_bebes,
           greatest(p_adultos - t.QTDE_ADULTOS_INCLUSOS, 0) * t.VL_ADULTO_EXTRA
           + p_criancas * t.VL_CRIANCA + p_bebes * t.VL_BEBE as extras,
           t.ID_TARIFA is null as sem_tarifa
    from noites n
    left join lateral (
      select * from TARIFA tr
      where tr.ID_UNIDADE = p_id_unidade and tr.SG_ATIVO
        and n.data >= tr.DT_INI and n.data < tr.DT_FIM
      order by tr.NO_PRIORIDADE desc
      limit 1
    ) t on true
    left join AJUSTE_DIARIO a on a.ID_UNIDADE = p_id_unidade and a.DT_REF = n.data
  )
  select bool_or(c.sem_tarifa),
         bool_or(coalesce(c.fechado, false)),
         max(c.min_n),
         sum(c.valor_base + c.extras),
         jsonb_agg(jsonb_build_object(
           'dt_ref', c.data, 'nm_tarifa', c.tarifa,
           'vl_base', c.valor_base,
           'qtde_criancas', p_criancas, 'vl_criancas', c.vl_criancas,
           'qtde_bebes', p_bebes, 'vl_bebes', c.vl_bebes,
           'vl_adultos_extra', c.vl_adultos_extra,
           'vl_extras', c.extras,
           'vl_noite', c.valor_base + c.extras) order by c.data)
    into v_sem_tarifa, v_fechado, v_min, v_total, v_det
  from calc c;

  -- 3 · regras de venda
  motivo := case
    when v_sem_tarifa then 'sem_tarifa'                    -- venda ainda não aberta para alguma noite
    when v_fechado    then 'fechado'
    when exists (select 1 from AJUSTE_DIARIO a
                 where a.ID_UNIDADE = p_id_unidade and a.DT_REF = p_checkin and a.SG_SEM_CHEGADA)   then 'sem_chegada'
    when exists (select 1 from AJUSTE_DIARIO a
                 where a.ID_UNIDADE = p_id_unidade and a.DT_REF = p_checkout and a.SG_SEM_SAIDA)    then 'sem_saida'
    when v_noites < v_min then 'min_noites'                -- vale o maior mínimo entre as noites da estadia
    -- 4 · conflitos: reservas ativas (pré-reserva vencida não conta) e bloqueios
    when exists (select 1 from RESERVA r
                 where r.ID_UNIDADE = p_id_unidade
                   and daterange(r.DT_CHECKIN, r.DT_CHECKOUT) && daterange(p_checkin, p_checkout)
                   and (r.TP_STATUS = 'CONFIRMADA' or (r.TP_STATUS = 'PENDENTE' and r.DT_EXPIRA > now())))
      or exists (select 1 from BLOQUEIO b
                 where b.ID_UNIDADE = p_id_unidade
                   and daterange(b.DT_INI, b.DT_FIM) && daterange(p_checkin, p_checkout)) then 'ocupado'
  end;

  return query select motivo is null, motivo, v_noites, coalesce(v_min, 1),
                      coalesce(v_total, 0)::numeric(10,2),
                      u.VL_TAXA_LIMPEZA,
                      (coalesce(v_total, 0) + u.VL_TAXA_LIMPEZA)::numeric(10,2),
                      coalesce(v_det, '[]'::jsonb);
end;
$$;


-- ════════════════════════════════════════════════════════════════════
--  API pública do site: consultar disponibilidade e preço
--  Chamada pelo botão "Ver disponibilidade" (RPC do Supabase).
--  Devolve uma linha por unidade ativa; não expõe dados de hóspedes.
-- ════════════════════════════════════════════════════════════════════

create or replace function consultar_disponibilidade(
  p_checkin   date,
  p_checkout  date,
  p_adultos   int,
  p_criancas  int default 0,
  p_bebes     int default 0
)
returns table (
  cd_unidade        text,
  nm_unidade        text,
  disponivel        boolean,
  motivo            text,
  qtde_noites       int,
  qtde_min_noites   int,
  vl_hospedagem     numeric(10,2),
  vl_taxa_limpeza   numeric(10,2),
  vl_total          numeric(10,2),
  vl_medio_noite    numeric(10,2),
  vl_sinal          numeric(10,2),
  ds_detalhe        jsonb
)
language sql
stable
security definer                       -- lê as tabelas sem expô-las ao visitante
set search_path = public, pg_temp
as $$
  select u.CD_UNIDADE, u.NM_UNIDADE, c.disponivel, c.motivo, c.qtde_noites, c.qtde_min_noites,
         case when c.disponivel then c.vl_hospedagem end,
         case when c.disponivel then c.vl_taxa_limpeza end,
         case when c.disponivel then c.vl_total end,
         case when c.disponivel and c.qtde_noites > 0 then round(c.vl_hospedagem / c.qtde_noites, 2) end,
         case when c.disponivel then round(c.vl_total * p.VL_PERCENTUAL_SINAL / 100, 2) end,
         case when c.disponivel then c.ds_detalhe end
  from UNIDADE u
  join PROPRIEDADE p on p.ID_PROPRIEDADE = u.ID_PROPRIEDADE
  cross join lateral calcular_estadia(u.ID_UNIDADE, p_checkin, p_checkout, p_adultos, p_criancas, p_bebes) c
  where u.SG_ATIVO
  order by c.disponivel desc, c.vl_total, u.NO_ORDEM;
$$;


-- ════════════════════════════════════════════════════════════════════
--  Pré-reserva: segura as datas enquanto o hóspede paga o sinal
--  (PROPRIEDADE.QTDE_MINUTOS_PRE_RESERVA, hoje 30 min). Chamar de uma
--  Edge Function (com captcha / limite de tentativas), nunca direto do
--  navegador: por isso só o service_role executa.
-- ════════════════════════════════════════════════════════════════════

create or replace function criar_pre_reserva(
  p_cd_unidade text,
  p_checkin    date,
  p_checkout   date,
  p_adultos    int,
  p_criancas   int default 0,
  p_bebes      int default 0
)
returns table (cd_reserva text, dt_expira timestamptz, vl_total numeric(10,2), vl_sinal numeric(10,2))
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_id_unidade bigint;
  v_minutos    int;
  v_percentual numeric;
  c record;
begin
  -- trava a unidade: pedidos simultâneos para o mesmo chalé entram em fila,
  -- o que também protege os bloqueios (que não estão na restrição EXCLUDE)
  select u.ID_UNIDADE, p.QTDE_MINUTOS_PRE_RESERVA, p.VL_PERCENTUAL_SINAL
    into v_id_unidade, v_minutos, v_percentual
  from UNIDADE u join PROPRIEDADE p on p.ID_PROPRIEDADE = u.ID_PROPRIEDADE
  where u.CD_UNIDADE = p_cd_unidade and u.SG_ATIVO
  for update of u;
  if v_id_unidade is null then
    raise exception 'unidade_inativa' using errcode = 'P0001';
  end if;

  -- libera pré-reservas vencidas desta unidade antes de verificar
  update RESERVA r set TP_STATUS = 'EXPIRADA', DT_ATUALIZACAO = now()
  where r.ID_UNIDADE = v_id_unidade and r.TP_STATUS = 'PENDENTE' and r.DT_EXPIRA <= now();

  select * into c from calcular_estadia(v_id_unidade, p_checkin, p_checkout, p_adultos, p_criancas, p_bebes);
  if not c.disponivel then
    raise exception '%', c.motivo using errcode = 'P0001';
  end if;

  return query
  insert into RESERVA as r (ID_UNIDADE, DT_CHECKIN, DT_CHECKOUT, QTDE_ADULTOS, QTDE_CRIANCAS, QTDE_BEBES,
                            TP_STATUS, TP_CANAL, VL_HOSPEDAGEM, VL_TAXA_LIMPEZA, VL_SINAL,
                            DS_DETALHE_PRECOS, DT_EXPIRA)
  values (v_id_unidade, p_checkin, p_checkout, p_adultos, p_criancas, p_bebes,
          'PENDENTE', 'SITE', c.vl_hospedagem, c.vl_taxa_limpeza,
          round(c.vl_total * v_percentual / 100, 2),
          c.ds_detalhe, now() + make_interval(mins => v_minutos))
  returning r.CD_RESERVA, r.DT_EXPIRA, r.VL_TOTAL, r.VL_SINAL;
end;
$$;

-- Job periódico (pg_cron no Supabase): marca como expiradas as pré-reservas
-- vencidas. A consulta de disponibilidade já ignora as vencidas; o job só
-- mantém o status coerente para relatórios.
create or replace function expirar_pre_reservas()
returns int
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  with x as (
    update RESERVA set TP_STATUS = 'EXPIRADA', DT_ATUALIZACAO = now()
    where TP_STATUS = 'PENDENTE' and DT_EXPIRA <= now()
    returning 1
  )
  select count(*)::int from x;
$$;
-- select cron.schedule('expirar-pre-reservas', '* * * * *', 'select expirar_pre_reservas()');


-- ════════════════════════════════════════════════════════════════════
--  Segurança
--  RLS ligado em todas as tabelas e nenhuma política para anon /
--  authenticated: o visitante não lê nem grava tabela nenhuma. As
--  políticas da equipe (painel) entram junto com o login do Supabase,
--  no mesmo modelo de perfis do solar-inspect.
-- ════════════════════════════════════════════════════════════════════

alter table PROPRIEDADE        enable row level security;
alter table UNIDADE            enable row level security;
alter table TARIFA             enable row level security;
alter table AJUSTE_DIARIO      enable row level security;
alter table HOSPEDE            enable row level security;
alter table RESERVA            enable row level security;
alter table PAGAMENTO          enable row level security;
alter table CALENDARIO_EXTERNO enable row level security;
alter table BLOQUEIO           enable row level security;

-- No Supabase as funções do schema public recebem EXECUTE para anon e
-- authenticated por padrão; por isso a revogação é explícita por papel.
revoke all on function calcular_estadia(bigint, date, date, int, int, int)      from public, anon, authenticated;
revoke all on function consultar_disponibilidade(date, date, int, int, int)     from public, anon, authenticated;
revoke all on function criar_pre_reserva(text, date, date, int, int, int)       from public, anon, authenticated;
revoke all on function expirar_pre_reservas()                                   from public, anon, authenticated;

grant execute on function consultar_disponibilidade(date, date, int, int, int)  to anon, authenticated;
grant execute on function criar_pre_reserva(text, date, date, int, int, int)    to service_role;
grant execute on function expirar_pre_reservas()                                to service_role;
