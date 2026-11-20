-- ════════════════════════════════════════════════════════════════════
--  Todos os dados de uma pré-reserva (ou reserva), numa linha só, para a equipe.
--  Rode no SQL Editor do Supabase. Coloque o código entre as aspas na linha
--  marcada (ex.: 'SE-7F3A2C1D'); deixando vazio (''), mostra a pré-reserva
--  mais recente.
-- ════════════════════════════════════════════════════════════════════

with parametro as (
  select ''::text as codigo                                            -- ← código da reserva
),
alvo as (
  select r.*
  from "SE"."SIT_RESERVA" r, parametro prm
  where r."CD_RESERVA" = prm.codigo
     or (prm.codigo = '' and r."ID_RESERVA" = (select max("ID_RESERVA") from "SE"."SIT_RESERVA" where "TP_STATUS" = 'PENDENTE'))
)
select r."CD_RESERVA"                                   as codigo,
       r."TP_STATUS"                                    as status,
       r."TP_CANAL"                                     as canal,
       u."NM_UNIDADE"                                   as chale,
       to_char(r."DT_CHECKIN", 'DD/MM/YYYY')  || ' ' || to_char(p."HR_CHECKIN", 'HH24:MI')  as check_in,
       to_char(r."DT_CHECKOUT", 'DD/MM/YYYY') || ' ' || to_char(p."HR_CHECKOUT", 'HH24:MI') as check_out,
       r."DT_CHECKOUT" - r."DT_CHECKIN"                 as noites,
       r."QTDE_ADULTOS"                                 as adultos,
       r."QTDE_CRIANCAS_MAIORES"                        as criancas_9_a_13,
       r."QTDE_CRIANCAS"                                as criancas_5_a_8,
       r."QTDE_BEBES"                                   as criancas_ate_4,
       r."VL_HOSPEDAGEM"                                as hospedagem,
       r."VL_TAXA_LIMPEZA"                              as taxa_limpeza,
       r."VL_TOTAL"                                     as total,
       r."VL_SINAL"                                     as sinal,
       r."VL_SALDO"                                     as saldo_no_check_in,
       to_char(r."DT_EXPIRA" at time zone p."DS_FUSO_HORARIO", 'DD/MM/YYYY HH24:MI') as segura_ate,
       case when r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" > now()
            then date_trunc('second', r."DT_EXPIRA" - now()) end as tempo_restante,
       h."NM_HOSPEDE"                                   as titular,          -- vazio enquanto o hóspede não concluiu
       h."DS_EMAIL"                                     as email,
       h."DS_TELEFONE"                                  as telefone,
       h."SG_NACIONALIDADE"                             as nacionalidade,
       h."CD_CPF"                                       as cpf,
       h."CD_PASSAPORTE"                                as passaporte,
       h."SG_PAIS_PASSAPORTE"                           as pais_passaporte,
       h."DT_VALIDADE_PASSAPORTE"                       as validade_passaporte,
       (select string_agg(a->>'nome' || coalesce(' ' || nullif(a->>'sobrenome', ''), '')
                          || case when a->>'tipo' = 'adulto' then ' (adulto)'
                                  else coalesce(' (' || (a->>'idade') || ' anos)', ' (criança)') end, ', ')
        from jsonb_array_elements(coalesce(r."DS_ACOMPANHANTES", '[]')) a) as acompanhantes,
       (select string_agg(to_char((n->>'dt_ref')::date, 'DD/MM') || ' ' || (array['dom','seg','ter','qua','qui','sex','sáb'])[extract(dow from (n->>'dt_ref')::date) + 1] || ': R$ ' || (n->>'vl_noite')
                          || ' (' || coalesce(n->>'nm_tarifa', '') || ')', ' · ' order by n->>'dt_ref')
        from jsonb_array_elements(r."DS_DETALHE_PRECOS") n) as preco_noite_a_noite,
       (select string_agg(pg."TP_PARCELA" || ' ' || pg."TP_METODO" || ' R$ ' || pg."VL_PAGAMENTO" || ' ' || pg."TP_STATUS"
                          || coalesce(' em ' || to_char(pg."DT_PAGAMENTO" at time zone p."DS_FUSO_HORARIO", 'DD/MM HH24:MI'), ''), ' · ')
        from "SE"."SIT_PAGAMENTO" pg where pg."ID_RESERVA" = r."ID_RESERVA") as pagamentos,
       r."NO_VERSAO_POLITICA"                           as versao_politica,
       to_char(r."DT_ACEITE_POLITICA" at time zone p."DS_FUSO_HORARIO", 'DD/MM/YYYY HH24:MI') as aceite_politica,
       to_char(r."DT_CRIACAO" at time zone p."DS_FUSO_HORARIO", 'DD/MM/YYYY HH24:MI')         as criada_em
from alvo r
join "SE"."SIT_UNIDADE" u      on u."ID_UNIDADE" = r."ID_UNIDADE"
join "SE"."SIT_PROPRIEDADE" p  on p."ID_PROPRIEDADE" = u."ID_PROPRIEDADE"
left join "SE"."SIT_HOSPEDE" h on h."ID_HOSPEDE" = r."ID_HOSPEDE";
