-- Data de nascimento do titular (20/11/2026), para o banco JÁ criado: não apaga dados.
-- Quem recriar com schema.sql já recebe isto.
set search_path = "SE", extensions, pg_temp;
begin;
alter table "SIT_HOSPEDE" add column if not exists "DT_NASCIMENTO" date;
alter table "SIT_HOSPEDE" drop constraint if exists "CK_SIT_HOSPEDE_NASCIMENTO";
alter table "SIT_HOSPEDE" add constraint "CK_SIT_HOSPEDE_NASCIMENTO" check ("DT_NASCIMENTO" is null or "DT_NASCIMENTO" > date '1900-01-01');
drop function if exists confirmar_reserva(text, text, text, text, char, text, text, char, date, date, jsonb);
create or replace function confirmar_reserva(
  p_cd_reserva            text,
  p_nome                  text,
  p_email                 text,
  p_telefone              text,
  p_nacionalidade         char(2) default 'BR',
  p_cpf                   text default null,
  p_passaporte            text default null,
  p_pais_passaporte       char(2) default null,
  p_validade_passaporte   date default null,
  p_emissao_passaporte    date default null,
  p_acompanhantes         jsonb default null,
  p_nascimento            date default null
)
returns table (cd_reserva text, vl_total numeric(10,2), vl_sinal numeric(10,2), dt_expira timestamptz)
language plpgsql
volatile
security definer
set search_path = "SE", extensions, pg_temp
as $$
declare
  v_reserva  "SIT_RESERVA"%rowtype;
  v_hospede  bigint;
  v_versao   smallint;
begin
  select r.* into v_reserva from "SIT_RESERVA" r where r."CD_RESERVA" = p_cd_reserva for update;
  if not found then
    raise exception 'reserva_inexistente' using errcode = 'P0001';
  end if;
  if v_reserva."TP_STATUS" <> 'PENDENTE' then
    raise exception 'reserva_nao_pendente' using errcode = 'P0001';   -- já confirmada, cancelada ou expirada
  end if;
  if v_reserva."DT_EXPIRA" <= now() then
    raise exception 'pre_reserva_expirada' using errcode = 'P0001';   -- passou dos 30 minutos: consultar de novo
  end if;
  if v_reserva."ID_HOSPEDE" is not null then
    raise exception 'reserva_ja_cadastrada' using errcode = 'P0001';  -- o cadastro já foi enviado; agora falta o sinal
  end if;
  if p_nascimento is not null and (p_nascimento > v_reserva."DT_CHECKIN" - interval '18 years' or p_nascimento < date '1900-01-02') then
    raise exception 'titular_menor_de_idade' using errcode = 'P0001'; -- quem contrata precisa ter 18 anos no check-in
  end if;

  -- reconhece quem já se hospedou pelo e-mail, pelo CPF ou pelo passaporte (o que casar primeiro)
  select h."ID_HOSPEDE" into v_hospede from "SIT_HOSPEDE" h
  where lower(h."DS_EMAIL") = lower(p_email)
     or (p_cpf is not null and h."CD_CPF" = p_cpf)
     or (p_passaporte is not null and h."CD_PASSAPORTE" = p_passaporte and h."SG_PAIS_PASSAPORTE" = p_pais_passaporte)
  order by (lower(h."DS_EMAIL") = lower(p_email)) desc
  limit 1;
  if v_hospede is null then
    insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "DS_TELEFONE", "SG_NACIONALIDADE", "CD_CPF", "CD_PASSAPORTE",
                             "SG_PAIS_PASSAPORTE", "DT_VALIDADE_PASSAPORTE", "DT_EMISSAO_PASSAPORTE", "DT_NASCIMENTO")
    values (p_nome, p_email, p_telefone, p_nacionalidade, p_cpf, p_passaporte,
            p_pais_passaporte, p_validade_passaporte, p_emissao_passaporte, p_nascimento)
    returning "ID_HOSPEDE" into v_hospede;
  else  -- hóspede que volta: atualiza contato e documento com o que digitou agora
    update "SIT_HOSPEDE" set "NM_HOSPEDE" = p_nome, "DS_EMAIL" = p_email, "DS_TELEFONE" = coalesce(p_telefone, "DS_TELEFONE"),
           "SG_NACIONALIDADE" = p_nacionalidade, "CD_CPF" = coalesce(p_cpf, "CD_CPF"),
           "CD_PASSAPORTE" = coalesce(p_passaporte, "CD_PASSAPORTE"),
           "SG_PAIS_PASSAPORTE" = coalesce(p_pais_passaporte, "SG_PAIS_PASSAPORTE"),
           "DT_VALIDADE_PASSAPORTE" = coalesce(p_validade_passaporte, "DT_VALIDADE_PASSAPORTE"),
           "DT_EMISSAO_PASSAPORTE" = coalesce(p_emissao_passaporte, "DT_EMISSAO_PASSAPORTE"),
           "DT_NASCIMENTO" = coalesce(p_nascimento, "DT_NASCIMENTO")
    where "ID_HOSPEDE" = v_hospede;
  end if;

  select p."NO_VERSAO_POLITICA" into v_versao
  from "SIT_UNIDADE" u join "SIT_PROPRIEDADE" p on p."ID_PROPRIEDADE" = u."ID_PROPRIEDADE"
  where u."ID_UNIDADE" = v_reserva."ID_UNIDADE";

  -- a reserva segue PENDENTE, segurando as datas até DT_EXPIRA, enquanto o hóspede paga o sinal por Pix;
  -- a equipe confere o Pix e confirma com confirmar_sinal. Sem sinal no prazo, as datas voltam a ficar livres.
  return query
  update "SIT_RESERVA" r set "ID_HOSPEDE" = v_hospede,
         "NO_VERSAO_POLITICA" = v_versao, "DT_ACEITE_POLITICA" = now(), "DT_ATUALIZACAO" = now(),
         "DS_ACOMPANHANTES" = p_acompanhantes
  where r."ID_RESERVA" = v_reserva."ID_RESERVA"
  returning r."CD_RESERVA", r."VL_TOTAL", r."VL_SINAL", r."DT_EXPIRA";
end;
$$;
revoke all on function confirmar_reserva(text, text, text, text, char, text, text, char, date, date, jsonb, date) from public, anon, authenticated;
grant execute on function confirmar_reserva(text, text, text, text, char, text, text, char, date, date, jsonb, date) to service_role;
commit;
