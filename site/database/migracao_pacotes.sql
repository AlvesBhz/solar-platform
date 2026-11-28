-- Pacotes de datas especiais (Natal, Réveillon, Carnaval…): preço final por combinação de check-in e noites.
-- Ex.: Natal na Casa do Mirante: 24/12 + 3 noites = R$ 2.400; 24/12 + 4 noites = R$ 2.900.
-- Regras (calcular_estadia, a mesma conta do site, da pré-reserva e do Pix):
--   • estadia igual a um pacote ativo (mesmo check-in e mesmas noites) paga o preço do pacote (adultos inclusos);
--     adulto extra e crianças seguem por noite, como na tarifa; a taxa de limpeza não muda;
--   • estadia que só toca o período de um pacote não é vendida: motivo 'pacote' (o site mostra as opções);
--   • fora dos pacotes, nada muda.
-- Dias da semana do segundo valor da tarifa (NO_DIAS_FDS): antes fixos em sexta, sábado e domingo; agora a tarifa diz quais
-- dias (ISO: 1 = segunda … 7 = domingo) usam VL_NOITE_FDS. O padrão {5,6,7} mantém os preços de hoje.
-- Idempotente e transacional. Pré-requisitos: schema.sql do site e migracao_precos_gestao.sql (prc_exigir_admin).
-- Base: calcular_estadia e consultar_precos copiadas de produção em 28/11/2026, com as mudanças marcadas "2b" e 'pacote'.
begin;
set local search_path = "SE", extensions, pg_temp;

do $$ begin
  if to_regprocedure('"SE".prc_exigir_admin()') is null or to_regprocedure('"SE".calcular_estadia(bigint,date,date,integer,integer,integer,integer)') is null then
    raise exception 'Rode antes o schema.sql do site e a migracao_precos_gestao.sql';
  end if;
end $$;

-- ── SIT_PACOTE: uma linha por opção do pacote (ex.: Natal 3 noites; Natal 4 noites) ─────────────────
create table if not exists "SIT_PACOTE" (
  "ID_PACOTE"     bigint generated always as identity,
  "ID_UNIDADE"    bigint not null,
  "NM_PACOTE"     text not null,                         -- Natal, Réveillon…
  "DT_CHECKIN"    date not null,
  "QTDE_NOITES"   smallint not null,                     -- check-out = DT_CHECKIN + QTDE_NOITES
  "VL_TOTAL"      numeric(10,2) not null,                -- preço final da hospedagem dos adultos inclusos
  "SG_ATIVO"      boolean not null default true,
  "DT_CRIACAO"    timestamptz not null default now(),
  constraint "PK_SIT_PACOTE" primary key ("ID_PACOTE"),
  constraint "FK_SIT_PACOTE_SIT_UNIDADE" foreign key ("ID_UNIDADE") references "SIT_UNIDADE" ("ID_UNIDADE") on delete cascade,
  constraint "CK_SIT_PACOTE_NOITES" check ("QTDE_NOITES" between 1 and 30),
  constraint "CK_SIT_PACOTE_VALOR" check ("VL_TOTAL" > 0),
  constraint "CK_SIT_PACOTE_NOME" check (length(btrim("NM_PACOTE")) between 2 and 60)
);
create unique index if not exists "UQ_SIT_PACOTE_OPCAO" on "SIT_PACOTE" ("ID_UNIDADE", "DT_CHECKIN", "QTDE_NOITES") where "SG_ATIVO";
create index if not exists "IX_SIT_PACOTE_PERIODO" on "SIT_PACOTE" using gist ("ID_UNIDADE", daterange("DT_CHECKIN", "DT_CHECKIN" + "QTDE_NOITES")) where "SG_ATIVO";
alter table "SIT_PACOTE" enable row level security;                -- sem política: só pelas funções
revoke all on "SIT_PACOTE" from public, anon, authenticated;
grant all on "SIT_PACOTE" to service_role;
drop trigger if exists "TG_SIT_PACOTE_AUDITORIA" on "SIT_PACOTE";
create trigger "TG_SIT_PACOTE_AUDITORIA" after insert or update or delete on "SIT_PACOTE" for each row execute function auditar();
do $$ begin
  if to_regprocedure('"SE".prc_auditar_autor()') is not null then
    execute 'drop trigger if exists "TG_SIT_PACOTE_AUTOR" on "SE"."SIT_PACOTE"';
    execute 'create trigger "TG_SIT_PACOTE_AUTOR" after insert or update or delete on "SE"."SIT_PACOTE" for each row execute function "SE".prc_auditar_autor()';
  end if;
end $$;

-- ── SIT_TARIFA: dias da semana que usam o segundo valor (VL_NOITE_FDS) ───────────────────────────────
alter table "SIT_TARIFA" add column if not exists "NO_DIAS_FDS" smallint[] not null default '{5,6,7}';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'CK_SIT_TARIFA_DIAS_FDS') then
    alter table "SE"."SIT_TARIFA" add constraint "CK_SIT_TARIFA_DIAS_FDS" check ("NO_DIAS_FDS" <@ '{1,2,3,4,5,6,7}'::smallint[]);
  end if;
end $$;
comment on column "SIT_TARIFA"."NO_DIAS_FDS" is 'Dias da semana (ISO: 1 = segunda … 7 = domingo) que usam VL_NOITE_FDS; os demais usam VL_NOITE';

-- ── calcular_estadia: + pacote (passo 2b e motivo 'pacote') ────────────────────────────────────────
CREATE OR REPLACE FUNCTION "SE".calcular_estadia(p_id_unidade bigint, p_checkin date, p_checkout date, p_adultos integer, p_criancas integer DEFAULT 0, p_bebes integer DEFAULT 0, p_criancas_maiores integer DEFAULT 0)
 RETURNS TABLE(disponivel boolean, motivo text, qtde_noites integer, qtde_min_noites integer, vl_hospedagem numeric, vl_taxa_limpeza numeric, vl_total numeric, ds_detalhe jsonb)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'SE', 'extensions', 'pg_temp'
AS $function$
declare
  u        "SIT_UNIDADE"%rowtype;
  p        "SIT_PROPRIEDADE"%rowtype;
  v_hoje   date;
  v_noites int;
  v_min    int;
  v_total  numeric(10,2);
  v_det    jsonb;
  v_sem_tarifa boolean;
  v_fechado    boolean;
  v_pac        "SIT_PACOTE"%rowtype;
  v_toca       boolean := false;
begin
  p_criancas := coalesce(p_criancas, 0);
  p_bebes    := coalesce(p_bebes, 0);
  p_criancas_maiores := coalesce(p_criancas_maiores, 0);
  select * into u from "SIT_UNIDADE" where "ID_UNIDADE" = p_id_unidade;
  if not found then
    return query select false, 'unidade_inativa', 0, 0, 0::numeric(10,2), 0::numeric(10,2), 0::numeric(10,2), '[]'::jsonb;
    return;
  end if;
  select * into p from "SIT_PROPRIEDADE" where "ID_PROPRIEDADE" = u."ID_PROPRIEDADE";

  v_hoje   := (now() at time zone p."DS_FUSO_HORARIO")::date;
  v_noites := p_checkout - p_checkin;

  -- 1 · datas e ocupação
  motivo := case
    when p_checkin is null or p_checkout is null or v_noites < 1          then 'datas_invalidas'
    when p_checkin < v_hoje                                                then 'data_passada'
    when v_noites > p."QTDE_MAX_NOITES"                                      then 'estadia_longa'
    when not u."SG_ATIVO"                                                    then 'unidade_inativa'
    when coalesce(p_adultos, 0) < 1 or p_criancas < 0 or p_bebes < 0 or p_criancas_maiores < 0
      or p_adultos > u."QTDE_MAX_ADULTOS"
      or p_criancas + p_criancas_maiores + p_bebes > u."QTDE_MAX_CRIANCAS"   -- até 4 anos também ocupa vaga
      or p_adultos + p_criancas + p_criancas_maiores + p_bebes > u."QTDE_MAX_HOSPEDES" then 'capacidade'
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
  base as (
    select n.data,
           t."NM_TARIFA" as tarifa,
           a."SG_FECHADO" as fechado,
           greatest(coalesce(a."QTDE_MIN_NOITES", t."QTDE_MIN_NOITES", 1), 1) as min_n,
           coalesce(
             a."VL_NOITE",
             case when extract(isodow from n.data)::smallint = any(t."NO_DIAS_FDS")   -- dias do segundo valor (padrão: sexta a domingo)
                  then coalesce(t."VL_NOITE_FDS", t."VL_NOITE")
                  else t."VL_NOITE" end
           ) as valor_base,
           t."QTDE_ADULTOS_INCLUSOS" as inclusos, t."VL_ADULTO_EXTRA" as vl_adulto_extra,
           t."PC_CRIANCA" as pc_crianca, t."PC_CRIANCA_MAIOR" as pc_maior, t."PC_BEBE" as pc_bebe,
           t."ID_TARIFA" is null as sem_tarifa
    from noites n
    left join lateral (
      select * from "SIT_TARIFA" tr
      where tr."ID_UNIDADE" = p_id_unidade and tr."SG_ATIVO"
        and n.data >= tr."DT_INI" and n.data < tr."DT_FIM"
      order by tr."NO_PRIORIDADE" desc
      limit 1
    ) t on true
    left join "SIT_AJUSTE_DIARIO" a on a."ID_UNIDADE" = p_id_unidade and a."DT_REF" = n.data
  ),
  -- o valor da noite cobre os adultos inclusos; cada criança paga um percentual do valor por pessoa
  -- (valor da noite ÷ adultos inclusos): 5 a 8 anos PC_CRIANCA, 9 a 13 PC_CRIANCA_MAIOR, até 4 PC_BEBE (hoje 0)
  calc0 as (
    select b.*,
           greatest(p_adultos - b.inclusos, 0) * b.vl_adulto_extra as vl_adultos_extra,
           round(b.valor_base / b.inclusos * (p_criancas * b.pc_crianca + p_criancas_maiores * b.pc_maior) / 100, 2) as vl_criancas,
           round(b.valor_base / b.inclusos * p_bebes * b.pc_bebe / 100, 2) as vl_bebes
    from base b
  ),
  calc as (select c0.*, c0.vl_adultos_extra + c0.vl_criancas + c0.vl_bebes as extras from calc0 c0)
  select bool_or(c.sem_tarifa),
         bool_or(coalesce(c.fechado, false)),
         max(c.min_n),
         sum(c.valor_base + c.extras),
         jsonb_agg(jsonb_build_object(
           'dt_ref', c.data, 'nm_tarifa', c.tarifa,
           'vl_base', c.valor_base,
           'qtde_criancas', p_criancas, 'qtde_criancas_maiores', p_criancas_maiores, 'vl_criancas', c.vl_criancas,
           'qtde_bebes', p_bebes, 'vl_bebes', c.vl_bebes,
           'vl_adultos_extra', c.vl_adultos_extra,
           'vl_extras', c.extras,
           'vl_noite', c.valor_base + c.extras) order by c.data)
    into v_sem_tarifa, v_fechado, v_min, v_total, v_det
  from calc c;

  -- 2b · pacote de data especial: a estadia que coincide com um pacote ativo (mesmo check-in e mesmas noites)
  --      paga o preço final dele, que cobre a hospedagem dos adultos inclusos; adulto extra e crianças seguem
  --      por noite, como na tarifa. A estadia que só toca o período de um pacote não é vendida (motivo 'pacote').
  select * into v_pac from "SIT_PACOTE" pk
  where pk."ID_UNIDADE" = p_id_unidade and pk."SG_ATIVO" and pk."DT_CHECKIN" = p_checkin and pk."QTDE_NOITES" = v_noites
  limit 1;
  if v_pac."ID_PACOTE" is not null and not coalesce(v_sem_tarifa, false) then
    select sum(n.vl_base_pac + coalesce((e.x ->> 'vl_extras')::numeric, 0)),
           jsonb_agg(e.x || jsonb_build_object('nm_tarifa', 'Pacote ' || v_pac."NM_PACOTE", 'nm_pacote', v_pac."NM_PACOTE",
                                               'vl_base', n.vl_base_pac,
                                               'vl_noite', n.vl_base_pac + coalesce((e.x ->> 'vl_extras')::numeric, 0)) order by e.i)
      into v_total, v_det
    from jsonb_array_elements(v_det) with ordinality e(x, i)
    cross join lateral (select case when e.i < v_noites then round(v_pac."VL_TOTAL" / v_noites, 2)
                                    else v_pac."VL_TOTAL" - round(v_pac."VL_TOTAL" / v_noites, 2) * (v_noites - 1) end as vl_base_pac) n;
    v_min := v_noites;                                     -- o pacote define a estadia: o mínimo por dia não se aplica
  else
    v_toca := exists (select 1 from "SIT_PACOTE" pk
                      where pk."ID_UNIDADE" = p_id_unidade and pk."SG_ATIVO"
                        and daterange(pk."DT_CHECKIN", pk."DT_CHECKIN" + pk."QTDE_NOITES") && daterange(p_checkin, p_checkout));
  end if;

  -- 3 · regras de venda
  motivo := case
    when v_sem_tarifa then 'sem_tarifa'                    -- venda ainda não aberta para alguma noite
    when v_fechado    then 'fechado'
    when exists (select 1 from "SIT_AJUSTE_DIARIO" a
                 where a."ID_UNIDADE" = p_id_unidade and a."DT_REF" = p_checkin and a."SG_SEM_CHEGADA")   then 'sem_chegada'
    when exists (select 1 from "SIT_AJUSTE_DIARIO" a
                 where a."ID_UNIDADE" = p_id_unidade and a."DT_REF" = p_checkout and a."SG_SEM_SAIDA")    then 'sem_saida'
    when v_toca then 'pacote'                              -- nas datas de pacote, só se vende pacote
    when v_noites < v_min then 'min_noites'                -- vale o maior mínimo entre as noites da estadia
    -- 4 · conflitos: reservas ativas (pré-reserva vencida não conta) e bloqueios
    when exists (select 1 from "SIT_RESERVA" r
                 where r."ID_UNIDADE" = p_id_unidade
                   and daterange(r."DT_CHECKIN", r."DT_CHECKOUT") && daterange(p_checkin, p_checkout)
                   and (r."TP_STATUS" = 'CONFIRMADA' or (r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" > now())))
      or exists (select 1 from "SIT_BLOQUEIO" b
                 where b."ID_UNIDADE" = p_id_unidade
                   and daterange(b."DT_INI", b."DT_FIM") && daterange(p_checkin, p_checkout)) then 'ocupado'
  end;

  return query select motivo is null, motivo, v_noites, coalesce(v_min, 1),
                      coalesce(v_total, 0)::numeric(10,2),
                      u."VL_TAXA_LIMPEZA",
                      (coalesce(v_total, 0) + u."VL_TAXA_LIMPEZA")::numeric(10,2),
                      coalesce(v_det, '[]'::jsonb);
end;
$function$;

-- ── consultar_precos: noite de pacote aparece livre no calendário do site (a combinação é conferida na estadia)
CREATE OR REPLACE FUNCTION "SE".consultar_precos(p_inicio date, p_fim date, p_adultos integer, p_criancas integer DEFAULT 0, p_bebes integer DEFAULT 0, p_criancas_maiores integer DEFAULT 0, p_cd_unidade text DEFAULT 'casa-do-mirante'::text)
 RETURNS TABLE(dt_ref date, vl_noite numeric, livre boolean, min_noites integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'SE', 'extensions', 'pg_temp'
AS $function$
  -- cada noite é calculada como uma estadia de 1 noite; "livre" ignora as regras que dependem da
  -- estadia inteira (mínimo de noites, dia sem chegada ou sem saída) e confere reservas e bloqueios
  select d.data::date,
         (c.ds_detalhe -> 0 ->> 'vl_noite')::numeric(10,2),
         coalesce(c.motivo, '') in ('', 'min_noites', 'sem_chegada', 'sem_saida', 'pacote')
         and not exists (select 1 from "SIT_RESERVA" r
                         where r."ID_UNIDADE" = u."ID_UNIDADE" and d.data >= r."DT_CHECKIN" and d.data < r."DT_CHECKOUT"
                           and (r."TP_STATUS" = 'CONFIRMADA' or (r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" > now())))
         and not exists (select 1 from "SIT_BLOQUEIO" b
                         where b."ID_UNIDADE" = u."ID_UNIDADE" and d.data >= b."DT_INI" and d.data < b."DT_FIM"),
         c.qtde_min_noites                       -- mínimo de noites de uma estadia que passe por esta noite
  from "SIT_UNIDADE" u
  cross join lateral generate_series(p_inicio::timestamp, (p_fim - 1)::timestamp, interval '1 day') d(data)
  cross join lateral calcular_estadia(u."ID_UNIDADE", d.data::date, d.data::date + 1,
                                      p_adultos, p_criancas, p_bebes, p_criancas_maiores) c
  where u."CD_UNIDADE" = p_cd_unidade and u."SG_ATIVO" and p_fim > p_inicio and p_fim - p_inicio <= 62
    and c.motivo is distinct from 'capacidade'
  order by d.data
$function$;

-- ── API pública do site: pacotes ativos que tocam o período (para marcar o calendário, mostrar as opções e a oferta)
create or replace function consultar_pacotes(p_inicio date, p_fim date, p_cd_unidade text default 'casa-do-mirante')
returns table (nm_pacote text, dt_checkin date, dt_checkout date, qtde_noites int, vl_total numeric)
language sql stable security definer set search_path = "SE", extensions, pg_temp as $$
  select pk."NM_PACOTE", pk."DT_CHECKIN", pk."DT_CHECKIN" + pk."QTDE_NOITES", pk."QTDE_NOITES"::int, pk."VL_TOTAL"
  from "SIT_PACOTE" pk join "SIT_UNIDADE" u on u."ID_UNIDADE" = pk."ID_UNIDADE"
  where u."CD_UNIDADE" = p_cd_unidade and u."SG_ATIVO" and pk."SG_ATIVO"
    and p_fim > p_inicio and p_fim - p_inicio <= 400
    and daterange(pk."DT_CHECKIN", pk."DT_CHECKIN" + pk."QTDE_NOITES") && daterange(p_inicio, p_fim)
  order by pk."DT_CHECKIN", pk."QTDE_NOITES"
$$;
revoke all on function consultar_pacotes(date, date, text) from public;
grant execute on function consultar_pacotes(date, date, text) to anon, authenticated;

-- ── Gestão (Calendário de preços, só ADMIN) ──────────────────────────────────────────────────────
create or replace function prc_pacotes(p_id_unidade bigint)
returns table (id_pacote bigint, nm_pacote text, dt_checkin date, dt_checkout date, qtde_noites int, vl_total numeric, sg_ativo boolean)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".prc_exigir_admin();
  return query
  select pk."ID_PACOTE", pk."NM_PACOTE", pk."DT_CHECKIN", pk."DT_CHECKIN" + pk."QTDE_NOITES", pk."QTDE_NOITES"::int, pk."VL_TOTAL", pk."SG_ATIVO"
  from "SIT_PACOTE" pk where pk."ID_UNIDADE" = p_id_unidade
  order by pk."SG_ATIVO" desc, pk."DT_CHECKIN", pk."QTDE_NOITES";
end;
$$;

-- Inclui (p_id_pacote vazio) ou altera uma opção de pacote. Opções ativas da unidade só podem se sobrepor se tiverem o
-- mesmo check-in (ex.: Natal 3 e 4 noites a partir de 24/12); a mesma combinação não se repete.
create or replace function prc_salvar_pacote(p_id_pacote bigint, p_id_unidade bigint, p_nm_pacote text, p_dt_checkin date,
                                             p_qtde_noites int, p_vl_total numeric, p_sg_ativo boolean default true)
returns bigint language plpgsql volatile security definer set search_path = "SE", extensions, pg_temp as $$
declare v_id bigint; v_hoje date;
begin
  perform "SE".prc_exigir_admin();
  select (now() at time zone pr."DS_FUSO_HORARIO")::date into v_hoje
  from "SIT_UNIDADE" u join "SIT_PROPRIEDADE" pr on pr."ID_PROPRIEDADE" = u."ID_PROPRIEDADE" where u."ID_UNIDADE" = p_id_unidade;
  if v_hoje is null then raise exception 'unidade_inexistente' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_nm_pacote, ''))) not between 2 and 60 then raise exception 'nome_invalido' using errcode = 'P0001'; end if;
  if p_dt_checkin is null then raise exception 'data_invalida' using errcode = 'P0001'; end if;
  if p_qtde_noites is null or p_qtde_noites not between 1 and 30 then raise exception 'noites_invalidas' using errcode = 'P0001'; end if;
  if p_vl_total is null or p_vl_total <= 0 or p_vl_total > 1000000 then raise exception 'valor_invalido' using errcode = 'P0001'; end if;
  if coalesce(p_sg_ativo, true) then
    if p_dt_checkin < v_hoje then raise exception 'data_passada' using errcode = 'P0001'; end if;
    if exists (select 1 from "SIT_PACOTE" o where o."ID_UNIDADE" = p_id_unidade and o."SG_ATIVO" and o."ID_PACOTE" is distinct from p_id_pacote
                 and o."DT_CHECKIN" = p_dt_checkin and o."QTDE_NOITES" = p_qtde_noites) then
      raise exception 'pacote_repetido' using errcode = 'P0001';
    end if;
    if exists (select 1 from "SIT_PACOTE" o where o."ID_UNIDADE" = p_id_unidade and o."SG_ATIVO" and o."ID_PACOTE" is distinct from p_id_pacote
                 and o."DT_CHECKIN" <> p_dt_checkin
                 and daterange(o."DT_CHECKIN", o."DT_CHECKIN" + o."QTDE_NOITES") && daterange(p_dt_checkin, p_dt_checkin + p_qtde_noites)) then
      raise exception 'pacote_sobreposto' using errcode = 'P0001';
    end if;
  end if;
  if p_id_pacote is null then
    insert into "SIT_PACOTE" ("ID_UNIDADE", "NM_PACOTE", "DT_CHECKIN", "QTDE_NOITES", "VL_TOTAL", "SG_ATIVO")
    values (p_id_unidade, btrim(p_nm_pacote), p_dt_checkin, p_qtde_noites, p_vl_total, coalesce(p_sg_ativo, true))
    returning "ID_PACOTE" into v_id;
  else
    update "SIT_PACOTE" set "NM_PACOTE" = btrim(p_nm_pacote), "DT_CHECKIN" = p_dt_checkin, "QTDE_NOITES" = p_qtde_noites,
                            "VL_TOTAL" = p_vl_total, "SG_ATIVO" = coalesce(p_sg_ativo, true)
    where "ID_PACOTE" = p_id_pacote and "ID_UNIDADE" = p_id_unidade
    returning "ID_PACOTE" into v_id;
    if v_id is null then raise exception 'pacote_inexistente' using errcode = 'P0001'; end if;
  end if;
  return v_id;
end;
$$;
revoke all on function prc_pacotes(bigint) from public, anon, authenticated;
revoke all on function prc_salvar_pacote(bigint, bigint, text, date, int, numeric, boolean) from public, anon, authenticated;
grant execute on function prc_pacotes(bigint) to authenticated;
grant execute on function prc_salvar_pacote(bigint, bigint, text, date, int, numeric, boolean) to authenticated;

-- ── tarifas no Inspect: + dias da semana do segundo valor (assinaturas mudam: recria) ─────────────────
drop function if exists prc_tarifas(bigint);
create function prc_tarifas(p_id_unidade bigint)
returns table (id_tarifa bigint, nm_tarifa text, dt_ini date, dt_fim date, no_prioridade int, vl_noite numeric, vl_noite_fds numeric,
               qtde_adultos_inclusos int, vl_adulto_extra numeric, pc_crianca numeric, pc_crianca_maior numeric, pc_bebe numeric,
               qtde_min_noites int, sg_ativo boolean, no_dias_fds smallint[])
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".prc_exigir_admin();
  return query
  select t."ID_TARIFA", t."NM_TARIFA", t."DT_INI", t."DT_FIM", t."NO_PRIORIDADE"::int, t."VL_NOITE", t."VL_NOITE_FDS", t."QTDE_ADULTOS_INCLUSOS"::int,
         t."VL_ADULTO_EXTRA", t."PC_CRIANCA", t."PC_CRIANCA_MAIOR", t."PC_BEBE", t."QTDE_MIN_NOITES"::int, t."SG_ATIVO", t."NO_DIAS_FDS"
  from "SIT_TARIFA" t
  where t."ID_UNIDADE" = p_id_unidade
  order by t."NO_PRIORIDADE" desc, t."DT_INI", t."ID_TARIFA";
end;
$$;

drop function if exists prc_salvar_tarifa(bigint, bigint, text, date, date, int, numeric, numeric, int, numeric, numeric, numeric, numeric, int, boolean);
drop function if exists prc_salvar_tarifa(bigint, bigint, text, date, date, int, numeric, numeric, int, numeric, numeric, numeric, numeric, int, boolean, smallint[]);
create function prc_salvar_tarifa(
  p_id_tarifa bigint, p_id_unidade bigint, p_nm_tarifa text, p_dt_ini date, p_dt_fim date, p_no_prioridade int,
  p_vl_noite numeric, p_vl_noite_fds numeric, p_qtde_adultos_inclusos int, p_vl_adulto_extra numeric,
  p_pc_crianca numeric, p_pc_crianca_maior numeric, p_pc_bebe numeric, p_qtde_min_noites int, p_sg_ativo boolean,
  p_no_dias_fds smallint[] default '{5,6,7}')
returns bigint language plpgsql security definer set search_path = "SE", extensions, pg_temp as $$
declare v_id bigint; v_dias smallint[];
begin
  perform "SE".prc_exigir_admin();
  if not exists (select 1 from "SIT_UNIDADE" where "ID_UNIDADE" = p_id_unidade) then raise exception 'unidade_inexistente' using errcode = 'P0001'; end if;
  if nullif(btrim(p_nm_tarifa), '') is null or length(p_nm_tarifa) > 80 then raise exception 'tarifa_invalida' using errcode = 'P0001'; end if;
  if p_id_tarifa is not null and not exists (select 1 from "SIT_TARIFA" where "ID_TARIFA" = p_id_tarifa and "ID_UNIDADE" = p_id_unidade) then
    raise exception 'tarifa_inexistente' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct d order by d), '{}') into v_dias from unnest(coalesce(p_no_dias_fds, '{5,6,7}')) d;   -- sem repetição, em ordem
  begin
    if p_id_tarifa is null then
      insert into "SIT_TARIFA" ("ID_UNIDADE", "NM_TARIFA", "DT_INI", "DT_FIM", "NO_PRIORIDADE", "VL_NOITE", "VL_NOITE_FDS", "QTDE_ADULTOS_INCLUSOS",
                                "VL_ADULTO_EXTRA", "PC_CRIANCA", "PC_CRIANCA_MAIOR", "PC_BEBE", "QTDE_MIN_NOITES", "SG_ATIVO", "NO_DIAS_FDS")
      values (p_id_unidade, btrim(p_nm_tarifa), p_dt_ini, p_dt_fim, p_no_prioridade, p_vl_noite, p_vl_noite_fds, p_qtde_adultos_inclusos,
              p_vl_adulto_extra, p_pc_crianca, p_pc_crianca_maior, p_pc_bebe, p_qtde_min_noites, coalesce(p_sg_ativo, true), v_dias)
      returning "ID_TARIFA" into v_id;
    else
      update "SIT_TARIFA" set "NM_TARIFA" = btrim(p_nm_tarifa), "DT_INI" = p_dt_ini, "DT_FIM" = p_dt_fim, "NO_PRIORIDADE" = p_no_prioridade,
             "VL_NOITE" = p_vl_noite, "VL_NOITE_FDS" = p_vl_noite_fds, "QTDE_ADULTOS_INCLUSOS" = p_qtde_adultos_inclusos,
             "VL_ADULTO_EXTRA" = p_vl_adulto_extra, "PC_CRIANCA" = p_pc_crianca, "PC_CRIANCA_MAIOR" = p_pc_crianca_maior, "PC_BEBE" = p_pc_bebe,
             "QTDE_MIN_NOITES" = p_qtde_min_noites, "SG_ATIVO" = coalesce(p_sg_ativo, true), "NO_DIAS_FDS" = v_dias
       where "ID_TARIFA" = p_id_tarifa
      returning "ID_TARIFA" into v_id;
    end if;
  exception
    when exclusion_violation then raise exception 'tarifa_sobreposta' using errcode = 'P0001';
    when check_violation or not_null_violation or numeric_value_out_of_range then raise exception 'tarifa_invalida' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;
revoke all on function prc_tarifas(bigint) from public, anon, authenticated;
revoke all on function prc_salvar_tarifa(bigint, bigint, text, date, date, int, numeric, numeric, int, numeric, numeric, numeric, numeric, int, boolean, smallint[]) from public, anon, authenticated;
grant execute on function prc_tarifas(bigint) to authenticated;
grant execute on function prc_salvar_tarifa(bigint, bigint, text, date, date, int, numeric, numeric, int, numeric, numeric, numeric, numeric, int, boolean, smallint[]) to authenticated;

commit;
