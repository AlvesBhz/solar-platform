-- ════════════════════════════════════════════════════════════════════
--  Gestão de preços pelo Solar Inspect (T38–T41) — 27/11/2026
--  Rodar DEPOIS de schema.sql, seed_exemplo.sql e da migração das vistorias
--  (solar-inspect/database/migracao_vistorias.sql). Não altera tabela nem
--  função do site: só cria funções prc_* e dois gatilhos de autoria. Pode
--  rodar de novo (idempotente) e tudo acontece numa transação.
--
--  Quem pode: só o ADMIN do Inspect (vst_perfil() = 'ADMIN'). Nada é liberado
--  para anon e as tabelas SIT_TARIFA e SIT_AJUSTE_DIARIO continuam sem acesso
--  direto: o app lê e grava só por estas funções (security definer).
--
--  Funções (prefixo prc_, para a migração das vistorias nunca mexer nelas):
--    prc_unidades()                  chalés e limites que o simulador precisa
--    prc_tarifas(unidade)            tarifas por período
--    prc_salvar_tarifa(...)          cria ou altera; recusa período sobreposto na mesma prioridade
--    prc_alternar_tarifa(id, ativo)  ativa ou desativa (nunca apaga)
--    prc_ajustes(unidade, ini, fim)  exceções de um dia
--    prc_salvar_ajustes(...)         grava o ajuste em várias noites de uma vez
--    prc_remover_ajustes(...)        volta a valer a tarifa
--    prc_ocupacao(unidade, ini, fim) reservas e bloqueios que cobrem o período (sem dados do hóspede)
--    prc_calcular(...)               a mesma conta do site (calcular_estadia), para o simulador
--
--  Auditoria: SIT_TARIFA e SIT_AJUSTE_DIARIO já têm o gatilho auditar() do site.
--  Aqui entra também o gatilho de autoria das vistorias, para a T34 mostrar quem
--  mudou o preço (VST_AUDITORIA).
-- ════════════════════════════════════════════════════════════════════

begin;
set local search_path = "SE", extensions, pg_temp;

do $$ begin
  if to_regclass('"SE"."SIT_TARIFA"') is null or to_regclass('"SE"."SIT_AJUSTE_DIARIO"') is null
     or to_regprocedure('"SE".calcular_estadia(bigint,date,date,integer,integer,integer,integer)') is null then
    raise exception 'Rode antes o schema.sql do site (tarifas, ajustes e calcular_estadia).';
  end if;
  if to_regprocedure('"SE".vst_perfil()') is null or to_regclass('"SE"."VST_AUDITORIA"') is null then
    raise exception 'Rode antes a migração das vistorias (vst_perfil e VST_AUDITORIA).';
  end if;
end $$;

-- ── guarda comum: só o administrador ─────────────────────────────────
create or replace function prc_exigir_admin()
returns void language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  if "SE".vst_perfil() is distinct from 'ADMIN' then raise exception 'perfil_sem_permissao' using errcode = 'P0001'; end if;
end;
$$;

create or replace function prc_unidades()
returns table (id_unidade bigint, cd_unidade text, nm_unidade text, qtde_max_adultos int, qtde_max_criancas int, qtde_max_hospedes int,
               qtde_max_noites int, vl_taxa_limpeza numeric, vl_percentual_sinal numeric)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".prc_exigir_admin();
  return query
  select u."ID_UNIDADE", u."CD_UNIDADE", u."NM_UNIDADE", u."QTDE_MAX_ADULTOS"::int, u."QTDE_MAX_CRIANCAS"::int, u."QTDE_MAX_HOSPEDES"::int,
         p."QTDE_MAX_NOITES"::int, u."VL_TAXA_LIMPEZA", p."VL_PERCENTUAL_SINAL"
  from "SIT_UNIDADE" u join "SIT_PROPRIEDADE" p on p."ID_PROPRIEDADE" = u."ID_PROPRIEDADE"
  where u."SG_ATIVO"
  order by u."NO_ORDEM", u."NM_UNIDADE";
end;
$$;

create or replace function prc_tarifas(p_id_unidade bigint)
returns table (id_tarifa bigint, nm_tarifa text, dt_ini date, dt_fim date, no_prioridade int, vl_noite numeric, vl_noite_fds numeric,
               qtde_adultos_inclusos int, vl_adulto_extra numeric, pc_crianca numeric, pc_crianca_maior numeric, pc_bebe numeric,
               qtde_min_noites int, sg_ativo boolean)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".prc_exigir_admin();
  return query
  select t."ID_TARIFA", t."NM_TARIFA", t."DT_INI", t."DT_FIM", t."NO_PRIORIDADE"::int, t."VL_NOITE", t."VL_NOITE_FDS", t."QTDE_ADULTOS_INCLUSOS"::int,
         t."VL_ADULTO_EXTRA", t."PC_CRIANCA", t."PC_CRIANCA_MAIOR", t."PC_BEBE", t."QTDE_MIN_NOITES"::int, t."SG_ATIVO"
  from "SIT_TARIFA" t
  where t."ID_UNIDADE" = p_id_unidade
  order by t."NO_PRIORIDADE" desc, t."DT_INI", t."ID_TARIFA";
end;
$$;

create or replace function prc_salvar_tarifa(
  p_id_tarifa bigint, p_id_unidade bigint, p_nm_tarifa text, p_dt_ini date, p_dt_fim date, p_no_prioridade int,
  p_vl_noite numeric, p_vl_noite_fds numeric, p_qtde_adultos_inclusos int, p_vl_adulto_extra numeric,
  p_pc_crianca numeric, p_pc_crianca_maior numeric, p_pc_bebe numeric, p_qtde_min_noites int, p_sg_ativo boolean)
returns bigint language plpgsql security definer set search_path = "SE", extensions, pg_temp as $$
declare v_id bigint;
begin
  perform "SE".prc_exigir_admin();
  if not exists (select 1 from "SIT_UNIDADE" where "ID_UNIDADE" = p_id_unidade) then raise exception 'unidade_inexistente' using errcode = 'P0001'; end if;
  if nullif(btrim(p_nm_tarifa), '') is null or length(p_nm_tarifa) > 80 then raise exception 'tarifa_invalida' using errcode = 'P0001'; end if;
  if p_id_tarifa is not null and not exists (select 1 from "SIT_TARIFA" where "ID_TARIFA" = p_id_tarifa and "ID_UNIDADE" = p_id_unidade) then
    raise exception 'tarifa_inexistente' using errcode = 'P0001';
  end if;
  begin
    if p_id_tarifa is null then
      insert into "SIT_TARIFA" ("ID_UNIDADE", "NM_TARIFA", "DT_INI", "DT_FIM", "NO_PRIORIDADE", "VL_NOITE", "VL_NOITE_FDS", "QTDE_ADULTOS_INCLUSOS",
                                "VL_ADULTO_EXTRA", "PC_CRIANCA", "PC_CRIANCA_MAIOR", "PC_BEBE", "QTDE_MIN_NOITES", "SG_ATIVO")
      values (p_id_unidade, btrim(p_nm_tarifa), p_dt_ini, p_dt_fim, p_no_prioridade, p_vl_noite, p_vl_noite_fds, p_qtde_adultos_inclusos,
              p_vl_adulto_extra, p_pc_crianca, p_pc_crianca_maior, p_pc_bebe, p_qtde_min_noites, coalesce(p_sg_ativo, true))
      returning "ID_TARIFA" into v_id;
    else
      update "SIT_TARIFA" set "NM_TARIFA" = btrim(p_nm_tarifa), "DT_INI" = p_dt_ini, "DT_FIM" = p_dt_fim, "NO_PRIORIDADE" = p_no_prioridade,
             "VL_NOITE" = p_vl_noite, "VL_NOITE_FDS" = p_vl_noite_fds, "QTDE_ADULTOS_INCLUSOS" = p_qtde_adultos_inclusos,
             "VL_ADULTO_EXTRA" = p_vl_adulto_extra, "PC_CRIANCA" = p_pc_crianca, "PC_CRIANCA_MAIOR" = p_pc_crianca_maior, "PC_BEBE" = p_pc_bebe,
             "QTDE_MIN_NOITES" = p_qtde_min_noites, "SG_ATIVO" = coalesce(p_sg_ativo, true)
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

create or replace function prc_alternar_tarifa(p_id_tarifa bigint, p_sg_ativo boolean)
returns void language plpgsql security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".prc_exigir_admin();
  begin
    update "SIT_TARIFA" set "SG_ATIVO" = coalesce(p_sg_ativo, false) where "ID_TARIFA" = p_id_tarifa;
  exception when exclusion_violation then raise exception 'tarifa_sobreposta' using errcode = 'P0001';
  end;
  if not found then raise exception 'tarifa_inexistente' using errcode = 'P0001'; end if;
end;
$$;

create or replace function prc_ajustes(p_id_unidade bigint, p_dt_ini date, p_dt_fim date)
returns table (dt_ref date, vl_noite numeric, qtde_min_noites int, sg_fechado boolean, sg_sem_chegada boolean, sg_sem_saida boolean, ds_observacao text)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".prc_exigir_admin();
  if p_dt_ini is null or p_dt_fim is null or p_dt_fim < p_dt_ini or p_dt_fim - p_dt_ini > 400 then raise exception 'periodo_invalido' using errcode = 'P0001'; end if;
  return query
  select a."DT_REF", a."VL_NOITE", a."QTDE_MIN_NOITES"::int, a."SG_FECHADO", a."SG_SEM_CHEGADA", a."SG_SEM_SAIDA", a."DS_OBSERVACAO"
  from "SIT_AJUSTE_DIARIO" a
  where a."ID_UNIDADE" = p_id_unidade and a."DT_REF" between p_dt_ini and p_dt_fim
  order by a."DT_REF";
end;
$$;

-- grava o mesmo ajuste em várias noites (vazio em valor e mínimo = usa a tarifa); noites que já passaram não se ajustam
create or replace function prc_salvar_ajustes(
  p_id_unidade bigint, p_datas date[], p_vl_noite numeric, p_qtde_min_noites int,
  p_sg_fechado boolean, p_sg_sem_chegada boolean, p_sg_sem_saida boolean, p_ds_observacao text)
returns int language plpgsql security definer set search_path = "SE", extensions, pg_temp as $$
declare v_hoje date; v_n int;
begin
  perform "SE".prc_exigir_admin();
  if not exists (select 1 from "SIT_UNIDADE" where "ID_UNIDADE" = p_id_unidade) then raise exception 'unidade_inexistente' using errcode = 'P0001'; end if;
  if p_datas is null or cardinality(p_datas) = 0 or cardinality(p_datas) > 62 then raise exception 'periodo_invalido' using errcode = 'P0001'; end if;
  select (now() at time zone p."DS_FUSO_HORARIO")::date into v_hoje
    from "SIT_UNIDADE" u join "SIT_PROPRIEDADE" p on p."ID_PROPRIEDADE" = u."ID_PROPRIEDADE" where u."ID_UNIDADE" = p_id_unidade;
  if exists (select 1 from unnest(p_datas) d where d is null or d < v_hoje) then raise exception 'data_passada' using errcode = 'P0001'; end if;
  begin
    insert into "SIT_AJUSTE_DIARIO" ("ID_UNIDADE", "DT_REF", "VL_NOITE", "QTDE_MIN_NOITES", "SG_FECHADO", "SG_SEM_CHEGADA", "SG_SEM_SAIDA", "DS_OBSERVACAO")
    select p_id_unidade, d, p_vl_noite, p_qtde_min_noites, coalesce(p_sg_fechado, false), coalesce(p_sg_sem_chegada, false),
           coalesce(p_sg_sem_saida, false), nullif(btrim(p_ds_observacao), '')
    from (select distinct unnest(p_datas) as d) x
    on conflict ("ID_UNIDADE", "DT_REF") do update
      set "VL_NOITE" = excluded."VL_NOITE", "QTDE_MIN_NOITES" = excluded."QTDE_MIN_NOITES", "SG_FECHADO" = excluded."SG_FECHADO",
          "SG_SEM_CHEGADA" = excluded."SG_SEM_CHEGADA", "SG_SEM_SAIDA" = excluded."SG_SEM_SAIDA", "DS_OBSERVACAO" = excluded."DS_OBSERVACAO";
    get diagnostics v_n = row_count;
  exception when check_violation or numeric_value_out_of_range then raise exception 'ajuste_invalido' using errcode = 'P0001';
  end;
  return v_n;
end;
$$;

create or replace function prc_remover_ajustes(p_id_unidade bigint, p_datas date[])
returns int language plpgsql security definer set search_path = "SE", extensions, pg_temp as $$
declare v_n int;
begin
  perform "SE".prc_exigir_admin();
  if p_datas is null or cardinality(p_datas) = 0 or cardinality(p_datas) > 62 then raise exception 'periodo_invalido' using errcode = 'P0001'; end if;
  delete from "SIT_AJUSTE_DIARIO" where "ID_UNIDADE" = p_id_unidade and "DT_REF" = any (p_datas);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- o que ocupa o chalé no período: reserva confirmada, pré-reserva ainda dentro do prazo e bloqueio. Sem nome nem dado do hóspede.
create or replace function prc_ocupacao(p_id_unidade bigint, p_dt_ini date, p_dt_fim date)
returns table (dt_ini date, dt_fim date, tp_ocupacao text, ds_rotulo text)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".prc_exigir_admin();
  if p_dt_ini is null or p_dt_fim is null or p_dt_fim < p_dt_ini or p_dt_fim - p_dt_ini > 400 then raise exception 'periodo_invalido' using errcode = 'P0001'; end if;
  return query
  select r."DT_CHECKIN", r."DT_CHECKOUT", case r."TP_STATUS" when 'CONFIRMADA' then 'reserva' else 'pre-reserva' end,
         case r."TP_STATUS" when 'CONFIRMADA' then 'Reserva confirmada' else 'Pré-reserva · aguardando o sinal' end
  from "SIT_RESERVA" r
  where r."ID_UNIDADE" = p_id_unidade and r."DT_CHECKIN" <= p_dt_fim and r."DT_CHECKOUT" > p_dt_ini
    and (r."TP_STATUS" = 'CONFIRMADA' or (r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" > now()))
  union all
  select b."DT_INI", b."DT_FIM", 'bloqueio', 'Bloqueio · ' || lower(replace(b."TP_MOTIVO", '_', ' '))
  from "SIT_BLOQUEIO" b
  where b."ID_UNIDADE" = p_id_unidade and b."DT_INI" <= p_dt_fim and b."DT_FIM" > p_dt_ini
  order by 1;
end;
$$;

create or replace function prc_calcular(
  p_id_unidade bigint, p_checkin date, p_checkout date, p_adultos int, p_criancas int default 0, p_bebes int default 0, p_criancas_maiores int default 0)
returns table (disponivel boolean, motivo text, qtde_noites int, qtde_min_noites int, vl_hospedagem numeric, vl_taxa_limpeza numeric, vl_total numeric,
               vl_percentual_sinal numeric, ds_detalhe jsonb)
language plpgsql stable security definer set search_path = "SE", extensions, pg_temp as $$
begin
  perform "SE".prc_exigir_admin();
  return query
  select c.disponivel, c.motivo, c.qtde_noites, c.qtde_min_noites, c.vl_hospedagem, c.vl_taxa_limpeza, c.vl_total, p."VL_PERCENTUAL_SINAL", c.ds_detalhe
  from "SIT_UNIDADE" u
  join "SIT_PROPRIEDADE" p on p."ID_PROPRIEDADE" = u."ID_PROPRIEDADE"
  cross join lateral "SE".calcular_estadia(u."ID_UNIDADE", p_checkin, p_checkout, p_adultos, p_criancas, p_bebes, p_criancas_maiores) c
  where u."ID_UNIDADE" = p_id_unidade;
end;
$$;

-- ── autoria: quem mudou o preço aparece na Auditoria do Inspect (T34) ──
create or replace function prc_auditar_autor()
returns trigger language plpgsql security definer set search_path = "SE", extensions, pg_temp as $$
declare v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
        v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
        v_reg jsonb; v_dif jsonb;
begin
  v_reg := coalesce(v_new, v_old);
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_array(o.value, n.value)), '{}'::jsonb) into v_dif
    from jsonb_each(v_new) n left join jsonb_each(v_old) o on o.key = n.key
    where n.value is distinct from o.value and n.key <> 'DT_ATUALIZACAO';
    if v_dif = '{}'::jsonb then return null; end if;
  else
    v_dif := v_reg - 'DT_CRIACAO' - 'DT_ATUALIZACAO';
  end if;
  insert into "VST_AUDITORIA" ("ID_USUARIO", "NM_PAPEL", "NM_TABELA", "TP_OPERACAO", "CD_REGISTRO", "ID_UNIDADE", "DS_ALTERACOES")
  values ((select auth.uid()),
          coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', session_user::text),
          tg_table_name, tg_op,
          case tg_table_name when 'SIT_AJUSTE_DIARIO' then (v_reg ->> 'ID_UNIDADE') || '/' || (v_reg ->> 'DT_REF') else v_reg ->> 'ID_TARIFA' end,
          (v_reg ->> 'ID_UNIDADE')::bigint, v_dif);
  return null;
end;
$$;

drop trigger if exists "TG_SIT_TARIFA_AUTOR" on "SIT_TARIFA";
create trigger "TG_SIT_TARIFA_AUTOR" after insert or update or delete on "SIT_TARIFA" for each row execute function prc_auditar_autor();
drop trigger if exists "TG_SIT_AJUSTE_DIARIO_AUTOR" on "SIT_AJUSTE_DIARIO";
create trigger "TG_SIT_AJUSTE_DIARIO_AUTOR" after insert or update or delete on "SIT_AJUSTE_DIARIO" for each row execute function prc_auditar_autor();

-- ── permissões: nada para anon; as funções do app só para o usuário logado (e elas conferem o ADMIN) ──
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p where p.pronamespace = '"SE"'::regnamespace and p.proname like 'prc\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not in ('prc_auditar_autor', 'prc_exigir_admin') then execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;

commit;

-- Conferência: deve mostrar 9 funções do app, 2 gatilhos de autoria e nenhuma função prc_ liberada para anon
select (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname like 'prc\_%' and proname not in ('prc_auditar_autor', 'prc_exigir_admin')) as funcoes,
       (select count(*) from pg_trigger where not tgisinternal and tgname in ('TG_SIT_TARIFA_AUTOR', 'TG_SIT_AJUSTE_DIARIO_AUTOR')) as gatilhos,
       (select count(*) from pg_proc where pronamespace = '"SE"'::regnamespace and proname like 'prc\_%' and has_function_privilege('anon', oid, 'execute')) as liberadas_para_anon;
