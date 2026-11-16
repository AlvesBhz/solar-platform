-- ════════════════════════════════════════════════════════════════════
--  Solar do Espinhaço · Reservas — disponibilidade e preços
--  PostgreSQL 15+ (Supabase). Proposta v1 — ver README.md desta pasta.
--
--  Convenções
--  • Estadia = intervalo de NOITES [check-in, check-out): o dia do
--    check-out não é cobrado nem ocupado, então uma reserva que sai no
--    dia 10 não conflita com outra que entra no dia 10.
--  • Datas são `date` no fuso da propriedade (America/Sao_Paulo).
--  • Dinheiro em numeric(10,2); identificadores bigint identity.
--  • O site (visitante anônimo) só enxerga a função
--    consultar_disponibilidade(): nenhuma tabela é exposta.
-- ════════════════════════════════════════════════════════════════════

-- '=' em bigint dentro de constraints EXCLUDE. No Supabase as extensões
-- ficam no schema "extensions" (o comando abaixo também funciona fora dele).
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;


-- ── Propriedade e unidades ──────────────────────────────────────────
-- Mesmo modelo do app de vistorias (solar-inspect): Propriedade → Unidade.

create table propriedades (
  id                 bigint generated always as identity primary key,
  nome               text not null,
  fuso_horario       text not null default 'America/Sao_Paulo',
  horario_checkin    time not null default '14:00',
  horario_checkout   time not null default '12:00',
  idade_max_crianca  smallint not null default 12,   -- crianças pagantes: 2 a 12 anos (abaixo de 2 não contam)
  max_noites         smallint not null default 30 check (max_noites between 1 and 365),
  criado_em          timestamptz not null default now()
);

create table unidades (
  id              bigint generated always as identity primary key,
  propriedade_id  bigint not null references propriedades (id),
  slug            text not null unique check (slug ~ '^[a-z0-9-]+$'),
  nome            text not null,
  tipo            text not null default 'chale' check (tipo in ('chale', 'quarto', 'suite')),
  hospedes_max    smallint not null check (hospedes_max >= 1),
  adultos_max     smallint not null check (adultos_max >= 1),
  criancas_max    smallint not null default 0 check (criancas_max >= 0),
  taxa_limpeza    numeric(10,2) not null default 0 check (taxa_limpeza >= 0),   -- por estadia
  ativa           boolean not null default true,
  ordem           smallint not null default 0,
  criado_em       timestamptz not null default now()
);
create index unidades_propriedade_id_idx on unidades (propriedade_id);


-- ── Preços ──────────────────────────────────────────────────────────
-- Tarifa = regra de preço para um período de noites (temporada).
-- Períodos podem se sobrepor quando a prioridade é diferente: a de
-- maior prioridade vence. Ex.: "Base 2027" (0) < "Alta temporada" (10)
-- < "Réveillon" (20). Na mesma prioridade, sobreposição é proibida.

create table tarifas (
  id                   bigint generated always as identity primary key,
  unidade_id           bigint not null references unidades (id) on delete cascade,
  nome                 text not null,
  periodo              daterange not null,             -- noites cobertas [início, fim)
  prioridade           smallint not null default 0,
  valor_noite          numeric(10,2) not null check (valor_noite >= 0),       -- dom a qui
  valor_noite_fds      numeric(10,2) check (valor_noite_fds >= 0),            -- noites de sex e sáb; vazio = valor_noite
  hospedes_inclusos    smallint not null default 2 check (hospedes_inclusos >= 1),
  valor_adulto_extra   numeric(10,2) not null default 0 check (valor_adulto_extra >= 0),   -- por noite
  valor_crianca_extra  numeric(10,2) not null default 0 check (valor_crianca_extra >= 0),  -- por noite
  min_noites           smallint not null default 1 check (min_noites >= 1),
  ativa                boolean not null default true,
  criado_em            timestamptz not null default now(),
  constraint tarifas_periodo_valido
    check (not isempty(periodo) and not lower_inf(periodo) and not upper_inf(periodo)),
  constraint tarifas_sem_sobreposicao
    exclude using gist (unidade_id with =, prioridade with =, periodo with &&) where (ativa)
);
-- o índice GiST da constraint acima atende a busca "tarifa da noite X"

-- Ajuste de uma data específica, por cima da tarifa: preço especial,
-- mínimo de noites, fechar a venda da noite, ou proibir chegada/saída.
create table ajustes_diarios (
  unidade_id   bigint not null references unidades (id) on delete cascade,
  data         date not null,
  valor_noite  numeric(10,2) check (valor_noite >= 0),   -- vazio = usa a tarifa
  min_noites   smallint check (min_noites >= 1),
  fechado      boolean not null default false,           -- noite não vendida
  sem_chegada  boolean not null default false,           -- não aceita check-in nesta data
  sem_saida    boolean not null default false,           -- não aceita check-out nesta data
  observacao   text,
  primary key (unidade_id, data)
);


-- ── Hóspedes e reservas ─────────────────────────────────────────────

create table hospedes (
  id         bigint generated always as identity primary key,
  nome       text not null,
  email      text not null,
  telefone   text,
  criado_em  timestamptz not null default now()
);
create unique index hospedes_email_uidx on hospedes (lower(email));

create table reservas (
  id                bigint generated always as identity primary key,
  -- código mostrado ao hóspede: não sequencial, para não permitir adivinhar outras reservas
  codigo            text not null unique
                    default 'SE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  unidade_id        bigint not null references unidades (id),
  hospede_id        bigint references hospedes (id),
  periodo           daterange not null,                  -- [check-in, check-out)
  adultos           smallint not null check (adultos >= 1),
  criancas          smallint not null default 0 check (criancas >= 0),
  status            text not null default 'pendente'
                    check (status in ('pendente', 'confirmada', 'cancelada', 'expirada')),
  canal             text not null default 'site'
                    check (canal in ('site', 'direto', 'telefone')),
  valor_hospedagem  numeric(10,2) not null check (valor_hospedagem >= 0),
  taxa_limpeza      numeric(10,2) not null default 0 check (taxa_limpeza >= 0),
  valor_total       numeric(10,2) generated always as (valor_hospedagem + taxa_limpeza) stored,
  detalhe_precos    jsonb not null default '[]',         -- cálculo noite a noite no momento da reserva
  expira_em         timestamptz,                         -- só para 'pendente' (pré-reserva aguardando pagamento)
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  constraint reservas_periodo_valido
    check (not isempty(periodo) and not lower_inf(periodo) and not upper_inf(periodo)),
  constraint reservas_pendente_expira
    check (status <> 'pendente' or expira_em is not null),
  constraint reservas_confirmada_hospede
    check (status <> 'confirmada' or hospede_id is not null),
  -- Última barreira contra overbooking: duas reservas ativas da mesma
  -- unidade nunca ocupam a mesma noite, mesmo com acessos simultâneos.
  constraint reservas_sem_conflito
    exclude using gist (unidade_id with =, periodo with &&)
    where (status in ('pendente', 'confirmada'))
);
create index reservas_hospede_id_idx on reservas (hospede_id);
create index reservas_unidade_periodo_idx on reservas using gist (unidade_id, periodo);
create index reservas_pendentes_expira_idx on reservas (expira_em) where status = 'pendente';


-- ── Bloqueios e calendários externos (Airbnb / Booking) ─────────────
-- O chalé também é vendido no Airbnb e no Booking. Cada canal publica
-- um calendário iCal; um job importa os eventos como bloqueios.
-- Bloqueios ficam fora da constraint de reservas de propósito: o iCal
-- de um canal costuma devolver também as datas que o próprio site já
-- vendeu, e isso não pode impedir a sincronização.

create table calendarios_externos (
  id                    bigint generated always as identity primary key,
  unidade_id            bigint not null references unidades (id) on delete cascade,
  canal                 text not null check (canal in ('airbnb', 'booking', 'outro')),
  url_importacao        text not null,          -- link iCal fornecido pelo canal
  ativo                 boolean not null default true,
  ultima_sincronizacao  timestamptz,
  ultimo_erro           text,
  unique (unidade_id, canal)
);

create table bloqueios (
  id             bigint generated always as identity primary key,
  unidade_id     bigint not null references unidades (id) on delete cascade,
  periodo        daterange not null,
  motivo         text not null check (motivo in ('canal_externo', 'manutencao', 'uso_proprio', 'outro')),
  calendario_id  bigint references calendarios_externos (id) on delete cascade,
  uid_externo    text,                          -- UID do evento iCal: permite atualizar/remover no próximo sync
  observacao     text,
  criado_em      timestamptz not null default now(),
  constraint bloqueios_periodo_valido
    check (not isempty(periodo) and not lower_inf(periodo) and not upper_inf(periodo)),
  constraint bloqueios_origem_canal
    check ((motivo = 'canal_externo') = (calendario_id is not null)),
  unique (calendario_id, uid_externo)
);
create index bloqueios_unidade_periodo_idx on bloqueios using gist (unidade_id, periodo);


-- ════════════════════════════════════════════════════════════════════
--  Cálculo de uma estadia (uso interno)
--  Valida as datas e a ocupação, verifica conflitos e soma o preço
--  noite a noite. Devolve o motivo quando a unidade não está disponível.
--
--  Motivos: datas_invalidas · data_passada · estadia_longa ·
--  unidade_inativa · capacidade · sem_tarifa · fechado · sem_chegada ·
--  sem_saida · min_noites · ocupado
-- ════════════════════════════════════════════════════════════════════

create or replace function calcular_estadia(
  p_unidade_id bigint,
  p_checkin    date,
  p_checkout   date,
  p_adultos    int,
  p_criancas   int default 0
)
returns table (
  disponivel        boolean,
  motivo            text,
  noites            int,
  min_noites        int,
  valor_hospedagem  numeric(10,2),
  taxa_limpeza      numeric(10,2),
  valor_total       numeric(10,2),
  detalhe           jsonb
)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  u        unidades%rowtype;
  p        propriedades%rowtype;
  v_hoje   date;
  v_noites int;
  v_min    int;
  v_total  numeric(10,2);
  v_det    jsonb;
  v_sem_tarifa boolean;
  v_fechado    boolean;
begin
  p_criancas := coalesce(p_criancas, 0);
  select * into u from unidades where id = p_unidade_id;
  if not found then
    return query select false, 'unidade_inativa', 0, 0, 0::numeric(10,2), 0::numeric(10,2), 0::numeric(10,2), '[]'::jsonb;
    return;
  end if;
  select * into p from propriedades where id = u.propriedade_id;

  v_hoje   := (now() at time zone p.fuso_horario)::date;
  v_noites := p_checkout - p_checkin;

  -- 1 · datas e ocupação
  motivo := case
    when p_checkin is null or p_checkout is null or v_noites < 1          then 'datas_invalidas'
    when p_checkin < v_hoje                                                then 'data_passada'
    when v_noites > p.max_noites                                           then 'estadia_longa'
    when not u.ativa                                                       then 'unidade_inativa'
    when coalesce(p_adultos, 0) < 1 or coalesce(p_criancas, 0) < 0
      or p_adultos > u.adultos_max or p_criancas > u.criancas_max
      or p_adultos + p_criancas > u.hospedes_max                           then 'capacidade'
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
           t.nome as tarifa,
           a.fechado,
           greatest(coalesce(a.min_noites, t.min_noites, 1), 1) as min_n,
           coalesce(
             a.valor_noite,
             case when extract(isodow from n.data) in (5, 6)          -- sexta e sábado
                  then coalesce(t.valor_noite_fds, t.valor_noite)
                  else t.valor_noite end
           ) as valor_base,
           -- hóspedes além dos inclusos: adultos ocupam primeiro as vagas incluídas
           greatest(p_adultos - t.hospedes_inclusos, 0) * t.valor_adulto_extra
           + greatest(p_criancas - greatest(t.hospedes_inclusos - p_adultos, 0), 0) * t.valor_crianca_extra
             as extras,
           t.id is null as sem_tarifa
    from noites n
    left join lateral (
      select * from tarifas tr
      where tr.unidade_id = p_unidade_id and tr.ativa and tr.periodo @> n.data
      order by tr.prioridade desc
      limit 1
    ) t on true
    left join ajustes_diarios a on a.unidade_id = p_unidade_id and a.data = n.data
  )
  select bool_or(c.sem_tarifa),
         bool_or(coalesce(c.fechado, false)),
         max(c.min_n),
         sum(c.valor_base + c.extras),
         jsonb_agg(jsonb_build_object(
           'data', c.data, 'tarifa', c.tarifa,
           'valor_base', c.valor_base, 'extras', c.extras,
           'valor', c.valor_base + c.extras) order by c.data)
    into v_sem_tarifa, v_fechado, v_min, v_total, v_det
  from calc c;

  -- 3 · regras de venda
  motivo := case
    when v_sem_tarifa then 'sem_tarifa'                    -- venda ainda não aberta para alguma noite
    when v_fechado    then 'fechado'
    when exists (select 1 from ajustes_diarios a
                 where a.unidade_id = p_unidade_id and a.data = p_checkin and a.sem_chegada)  then 'sem_chegada'
    when exists (select 1 from ajustes_diarios a
                 where a.unidade_id = p_unidade_id and a.data = p_checkout and a.sem_saida)   then 'sem_saida'
    when v_noites < v_min then 'min_noites'                -- vale o maior mínimo entre as noites da estadia
    -- 4 · conflitos: reservas ativas (pré-reserva vencida não conta) e bloqueios
    when exists (select 1 from reservas r
                 where r.unidade_id = p_unidade_id
                   and r.periodo && daterange(p_checkin, p_checkout)
                   and (r.status = 'confirmada' or (r.status = 'pendente' and r.expira_em > now())))
      or exists (select 1 from bloqueios b
                 where b.unidade_id = p_unidade_id
                   and b.periodo && daterange(p_checkin, p_checkout)) then 'ocupado'
  end;

  return query select motivo is null, motivo, v_noites, coalesce(v_min, 1),
                      coalesce(v_total, 0)::numeric(10,2),
                      u.taxa_limpeza,
                      (coalesce(v_total, 0) + u.taxa_limpeza)::numeric(10,2),
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
  p_criancas  int default 0
)
returns table (
  unidade           text,
  nome              text,
  disponivel        boolean,
  motivo            text,
  noites            int,
  min_noites        int,
  valor_hospedagem  numeric(10,2),
  taxa_limpeza      numeric(10,2),
  valor_total       numeric(10,2),
  valor_medio_noite numeric(10,2),
  detalhe           jsonb
)
language sql
stable
security definer                       -- lê as tabelas sem expô-las ao visitante
set search_path = public, pg_temp
as $$
  select u.slug, u.nome, c.disponivel, c.motivo, c.noites, c.min_noites,
         case when c.disponivel then c.valor_hospedagem end,
         case when c.disponivel then c.taxa_limpeza end,
         case when c.disponivel then c.valor_total end,
         case when c.disponivel and c.noites > 0 then round(c.valor_hospedagem / c.noites, 2) end,
         case when c.disponivel then c.detalhe end
  from unidades u
  cross join lateral calcular_estadia(u.id, p_checkin, p_checkout, p_adultos, p_criancas) c
  where u.ativa
  order by c.disponivel desc, c.valor_total, u.ordem;
$$;


-- ════════════════════════════════════════════════════════════════════
--  Pré-reserva: segura as datas por 15 minutos enquanto o hóspede paga
--  Chamar de uma Edge Function (com captcha / limite de tentativas),
--  nunca direto do navegador: por isso só o service_role executa.
-- ════════════════════════════════════════════════════════════════════

create or replace function criar_pre_reserva(
  p_unidade   text,          -- slug da unidade
  p_checkin   date,
  p_checkout  date,
  p_adultos   int,
  p_criancas  int default 0,
  p_validade  interval default interval '15 minutes'
)
returns table (codigo text, expira_em timestamptz, valor_total numeric(10,2))
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_unidade_id bigint;
  c record;
begin
  -- trava a unidade: pedidos simultâneos para o mesmo chalé entram em fila,
  -- o que também protege os bloqueios (que não estão na constraint EXCLUDE)
  select id into v_unidade_id from unidades where slug = p_unidade and ativa for update;
  if v_unidade_id is null then
    raise exception 'unidade_inativa' using errcode = 'P0001';
  end if;

  -- libera pré-reservas vencidas desta unidade antes de verificar
  update reservas r set status = 'expirada', atualizado_em = now()
  where r.unidade_id = v_unidade_id and r.status = 'pendente' and r.expira_em <= now();

  select * into c from calcular_estadia(v_unidade_id, p_checkin, p_checkout, p_adultos, p_criancas);
  if not c.disponivel then
    raise exception '%', c.motivo using errcode = 'P0001';
  end if;

  return query
  insert into reservas as r (unidade_id, periodo, adultos, criancas, status, canal,
                             valor_hospedagem, taxa_limpeza, detalhe_precos, expira_em)
  values (v_unidade_id, daterange(p_checkin, p_checkout), p_adultos, p_criancas, 'pendente', 'site',
          c.valor_hospedagem, c.taxa_limpeza, c.detalhe, now() + p_validade)
  returning r.codigo, r.expira_em, r.valor_total;
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
    update reservas set status = 'expirada', atualizado_em = now()
    where status = 'pendente' and expira_em <= now()
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

alter table propriedades         enable row level security;
alter table unidades             enable row level security;
alter table tarifas              enable row level security;
alter table ajustes_diarios      enable row level security;
alter table hospedes             enable row level security;
alter table reservas             enable row level security;
alter table calendarios_externos enable row level security;
alter table bloqueios            enable row level security;

-- No Supabase as funções do schema public recebem EXECUTE para anon e
-- authenticated por padrão; por isso a revogação é explícita por papel.
revoke all on function calcular_estadia(bigint, date, date, int, int)              from public, anon, authenticated;
revoke all on function consultar_disponibilidade(date, date, int, int)             from public, anon, authenticated;
revoke all on function criar_pre_reserva(text, date, date, int, int, interval)     from public, anon, authenticated;
revoke all on function expirar_pre_reservas()                                      from public, anon, authenticated;

grant execute on function consultar_disponibilidade(date, date, int, int)          to anon, authenticated;
grant execute on function criar_pre_reserva(text, date, date, int, int, interval)  to service_role;
grant execute on function expirar_pre_reservas()                                   to service_role;
