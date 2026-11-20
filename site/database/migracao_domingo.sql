-- Domingo a R$ 1.700 (sexta, sábado e domingo) e mínimo de noites por dia no calendário (20/11/2026).
-- Para o banco JÁ criado: não apaga dados. Quem recriar com schema.sql já recebe isto.
set search_path = "SE", extensions, pg_temp;
begin;
create or replace function calcular_estadia(
  p_id_unidade bigint,
  p_checkin    date,
  p_checkout   date,
  p_adultos    int,
  p_criancas   int default 0,
  p_bebes      int default 0,
  p_criancas_maiores int default 0
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
set search_path = "SE", extensions, pg_temp
as $$
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
             case when extract(isodow from n.data) in (5, 6, 7)       -- sexta, sábado e domingo
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

  -- 3 · regras de venda
  motivo := case
    when v_sem_tarifa then 'sem_tarifa'                    -- venda ainda não aberta para alguma noite
    when v_fechado    then 'fechado'
    when exists (select 1 from "SIT_AJUSTE_DIARIO" a
                 where a."ID_UNIDADE" = p_id_unidade and a."DT_REF" = p_checkin and a."SG_SEM_CHEGADA")   then 'sem_chegada'
    when exists (select 1 from "SIT_AJUSTE_DIARIO" a
                 where a."ID_UNIDADE" = p_id_unidade and a."DT_REF" = p_checkout and a."SG_SEM_SAIDA")    then 'sem_saida'
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
$$;

drop function if exists consultar_precos(date, date, int, int, int, int, text);
create or replace function consultar_precos(
  p_inicio date, p_fim date, p_adultos int, p_criancas int default 0, p_bebes int default 0,
  p_criancas_maiores int default 0, p_cd_unidade text default 'casa-do-mirante')
returns table (dt_ref date, vl_noite numeric(10,2), livre boolean, min_noites int)
language sql
stable
security definer
set search_path = "SE", extensions, pg_temp
as $$
  -- cada noite é calculada como uma estadia de 1 noite; "livre" ignora as regras que dependem da
  -- estadia inteira (mínimo de noites, dia sem chegada ou sem saída) e confere reservas e bloqueios
  select d.data::date,
         (c.ds_detalhe -> 0 ->> 'vl_noite')::numeric(10,2),
         coalesce(c.motivo, '') in ('', 'min_noites', 'sem_chegada', 'sem_saida')
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
$$;
revoke all on function consultar_precos(date, date, int, int, int, int, text) from public, anon, authenticated;
grant execute on function consultar_precos(date, date, int, int, int, int, text) to anon, authenticated;
comment on column "SIT_TARIFA"."VL_NOITE_FDS" is 'Noites de sexta, sábado e domingo; vazio = VL_NOITE';
commit;
