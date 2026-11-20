-- ════════════════════════════════════════════════════════════════════
--  Todas as reservas (inclusive pré-reservas, canceladas e vencidas), com
--  hóspede, valores, situação do sinal e prazo. Rode no SQL Editor do Supabase.
--  Ordem: próximas estadias primeiro. Para só as ativas, troque o "where true"
--  por: where r."TP_STATUS" = 'CONFIRMADA' or (r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" > now())
-- ════════════════════════════════════════════════════════════════════

select r."CD_RESERVA"                                   as codigo,
       case when r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" <= now() then 'VENCIDA (sem sinal)'
            when r."TP_STATUS" = 'PENDENTE' and r."ID_HOSPEDE" is null then 'PENDENTE (sem cadastro)'
            when r."TP_STATUS" = 'PENDENTE' then 'AGUARDANDO SINAL'
            else r."TP_STATUS" end                      as situacao,
       r."TP_CANAL"                                     as canal,
       to_char(r."DT_CHECKIN", 'DD/MM/YYYY')            as check_in,
       to_char(r."DT_CHECKOUT", 'DD/MM/YYYY')           as check_out,
       r."DT_CHECKOUT" - r."DT_CHECKIN"                 as noites,
       r."QTDE_ADULTOS"                                 as adultos,
       r."QTDE_CRIANCAS_MAIORES" + r."QTDE_CRIANCAS" + r."QTDE_BEBES" as criancas,
       h."NM_HOSPEDE"                                   as titular,
       h."DS_TELEFONE"                                  as telefone,
       h."DS_EMAIL"                                     as email,
       coalesce(h."CD_CPF", h."CD_PASSAPORTE")          as documento,
       r."VL_TOTAL"                                     as total,
       r."VL_SINAL"                                     as sinal,
       coalesce(pg.sinal_pago, 0)                       as sinal_pago,
       coalesce(pg.saldo_pago, 0)                       as saldo_pago,
       r."VL_TOTAL" - coalesce(pg.sinal_pago, 0) - coalesce(pg.saldo_pago, 0) as falta_receber,
       case when r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" > now()
            then date_trunc('second', r."DT_EXPIRA" - now()) end as tempo_para_pagar,
       r."TP_MOTIVO_CANCELAMENTO"                       as motivo_cancelamento,
       to_char(r."DT_CRIACAO" at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') as criada_em
from "SE"."SIT_RESERVA" r
left join "SE"."SIT_HOSPEDE" h on h."ID_HOSPEDE" = r."ID_HOSPEDE"
left join lateral (
  select sum(p."VL_PAGAMENTO") filter (where p."TP_PARCELA" = 'SINAL') as sinal_pago,
         sum(p."VL_PAGAMENTO") filter (where p."TP_PARCELA" = 'SALDO') as saldo_pago
  from "SE"."SIT_PAGAMENTO" p
  where p."ID_RESERVA" = r."ID_RESERVA" and p."TP_STATUS" = 'RECEBIDO'
) pg on true
where true
order by (r."DT_CHECKIN" < current_date), r."DT_CHECKIN", r."DT_CRIACAO";
