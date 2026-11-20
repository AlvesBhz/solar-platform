-- Acrescenta ao banco já criado a consulta de preço por noite usada pelo calendário do site.
-- Rode uma vez no SQL Editor do Supabase (não apaga nada). Quem recriar o banco com schema.sql já a recebe.

-- ════════════════════════════════════════════════════════════════════
--  Preço de cada noite para o calendário do site: valor da noite para a
--  quantidade de hóspedes escolhida e se a noite está livre. Pública (anon).
-- ════════════════════════════════════════════════════════════════════
create or replace function consultar_precos(
  p_inicio date, p_fim date, p_adultos int, p_criancas int default 0, p_bebes int default 0,
  p_cd_unidade text default 'casa-do-mirante')
returns table (dt_ref date, vl_noite numeric(10,2), livre boolean)
language sql
stable
security definer
set search_path = "SE", extensions, pg_temp
as $$
  select d.data::date,
         case when t."ID_TARIFA" is null then null::numeric else
           (coalesce(a."VL_NOITE", case when extract(isodow from d.data) in (5, 6) then coalesce(t."VL_NOITE_FDS", t."VL_NOITE") else t."VL_NOITE" end)
            + greatest(p_adultos - t."QTDE_ADULTOS_INCLUSOS", 0) * t."VL_ADULTO_EXTRA"
            + p_criancas * t."VL_CRIANCA" + p_bebes * t."VL_BEBE")::numeric(10,2) end,
         (t."ID_TARIFA" is not null and not coalesce(a."SG_FECHADO", false)
          and d.data::date >= (now() at time zone pr."DS_FUSO_HORARIO")::date
          and not exists (select 1 from "SIT_RESERVA" r
                          where r."ID_UNIDADE" = u."ID_UNIDADE" and d.data::date >= r."DT_CHECKIN" and d.data::date < r."DT_CHECKOUT"
                            and (r."TP_STATUS" = 'CONFIRMADA' or (r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" > now())))
          and not exists (select 1 from "SIT_BLOQUEIO" b
                          where b."ID_UNIDADE" = u."ID_UNIDADE" and d.data::date >= b."DT_INI" and d.data::date < b."DT_FIM"))
  from "SIT_UNIDADE" u
  join "SIT_PROPRIEDADE" pr on pr."ID_PROPRIEDADE" = u."ID_PROPRIEDADE"
  cross join lateral generate_series(p_inicio::timestamp, (p_fim - 1)::timestamp, interval '1 day') d(data)
  left join lateral (select * from "SIT_TARIFA" tr
                     where tr."ID_UNIDADE" = u."ID_UNIDADE" and tr."SG_ATIVO" and d.data::date >= tr."DT_INI" and d.data::date < tr."DT_FIM"
                     order by tr."NO_PRIORIDADE" desc limit 1) t on true
  left join "SIT_AJUSTE_DIARIO" a on a."ID_UNIDADE" = u."ID_UNIDADE" and a."DT_REF" = d.data::date
  where u."CD_UNIDADE" = p_cd_unidade and u."SG_ATIVO" and p_fim > p_inicio and p_fim - p_inicio <= 62
    and p_adultos between 1 and u."QTDE_MAX_ADULTOS" and p_criancas >= 0 and p_bebes >= 0
    and p_criancas + p_bebes <= u."QTDE_MAX_CRIANCAS" and p_adultos + p_criancas + p_bebes <= u."QTDE_MAX_HOSPEDES"
  order by d.data
$$;
revoke all on function consultar_precos(date, date, int, int, int, text) from public, anon, authenticated;
grant execute on function consultar_precos(date, date, int, int, int, text) to anon, authenticated;

