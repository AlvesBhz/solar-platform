-- ════════════════════════════════════════════════════════════════════
--  Todos os cadastros de hóspedes, com o resumo das reservas de cada um.
--  Rode no SQL Editor do Supabase. Mais recentes primeiro.
-- ════════════════════════════════════════════════════════════════════

select h."ID_HOSPEDE"                                   as id,
       h."NM_HOSPEDE"                                   as nome,
       h."DS_EMAIL"                                     as email,
       h."DS_TELEFONE"                                  as telefone,
       h."SG_NACIONALIDADE"                             as nacionalidade,
       h."CD_CPF"                                       as cpf,
       h."CD_PASSAPORTE"                                as passaporte,
       h."SG_PAIS_PASSAPORTE"                           as pais_passaporte,
       to_char(h."DT_VALIDADE_PASSAPORTE", 'DD/MM/YYYY') as validade_passaporte,
       count(r."ID_RESERVA")                                               as reservas,
       count(r."ID_RESERVA") filter (where r."TP_STATUS" = 'CONFIRMADA')   as confirmadas,
       count(r."ID_RESERVA") filter (where r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" > now()) as aguardando_sinal,
       coalesce(sum(r."VL_TOTAL") filter (where r."TP_STATUS" = 'CONFIRMADA'), 0) as total_confirmado,
       to_char(max(r."DT_CHECKIN"), 'DD/MM/YYYY')                         as ultimo_check_in,
       string_agg(r."CD_RESERVA" || ' (' || r."TP_STATUS" || ')', ', ' order by r."DT_CHECKIN" desc) as codigos,
       to_char(h."DT_CRIACAO" at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as cadastrado_em
from "SE"."SIT_HOSPEDE" h
left join "SE"."SIT_RESERVA" r on r."ID_HOSPEDE" = h."ID_HOSPEDE"
group by h."ID_HOSPEDE"
order by h."DT_CRIACAO" desc;
