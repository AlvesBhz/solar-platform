-- ════════════════════════════════════════════════════════════════════
--  Exemplos usados no DER (der.html). Roda depois de schema.sql e
--  seed_exemplo.sql, num banco de teste. Os dados são fictícios e
--  passam por todas as regras do banco.
-- ════════════════════════════════════════════════════════════════════

-- Tarifa de férias de julho por cima da padrão (prioridade maior, mínimo 3 noites)
set search_path = "SE", extensions, public;   -- tabelas do site ficam no schema "SE"

insert into "SIT_TARIFA" ("ID_UNIDADE", "NM_TARIFA", "DT_INI", "DT_FIM", "NO_PRIORIDADE", "VL_NOITE", "VL_NOITE_FDS",
                    "QTDE_ADULTOS_INCLUSOS", "VL_ADULTO_EXTRA", "PC_CRIANCA", "PC_CRIANCA_MAIOR", "PC_BEBE", "QTDE_MIN_NOITES")
values (1, 'Férias de julho 2027', '2027-07-01', '2027-08-01', 10, 1000.00, 1900.00, 2, 0.00, 30, 100, 0, 3);

-- Exceções de um dia só
-- (os feriados do seed já trazem noites com preço próprio e mínimo de 3 ou 4 noites, como o Natal de 24/12)
insert into "SIT_AJUSTE_DIARIO" ("ID_UNIDADE", "DT_REF", "SG_SEM_CHEGADA", "DS_OBSERVACAO")
values (1, '2027-02-06', true, 'Sábado de Carnaval: ninguém faz check-in neste dia')
on conflict ("ID_UNIDADE", "DT_REF") do update set "SG_SEM_CHEGADA" = true, "DS_OBSERVACAO" = excluded."DS_OBSERVACAO";
insert into "SIT_AJUSTE_DIARIO" ("ID_UNIDADE", "DT_REF", "SG_FECHADO", "DS_OBSERVACAO")
values (1, '2027-03-17', true, 'Folga da equipe: noite fora da venda');

-- Brasileira com CPF e estrangeiro com passaporte (números fictícios)
insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "DS_TELEFONE", "SG_NACIONALIDADE", "CD_CPF")
values ('Ana Souza', 'ana.souza@exemplo.com', '+55 31 99999-0001', 'BR', '52998224725');
insert into "SIT_HOSPEDE" ("NM_HOSPEDE", "DS_EMAIL", "DS_TELEFONE", "SG_NACIONALIDADE", "CD_PASSAPORTE", "SG_PAIS_PASSAPORTE",
                     "DT_EMISSAO_PASSAPORTE", "DT_VALIDADE_PASSAPORTE")
values ('John Miller', 'john.miller@exemplo.com', '+1 415 555-0102', 'US', 'X12345678', 'US', '2020-03-10', '2030-03-09');

-- 1) Reserva confirmada no site: 23 a 26/12, casal + 1 criança + 1 bebê
insert into "SIT_RESERVA" ("CD_RESERVA", "ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "QTDE_CRIANCAS", "QTDE_BEBES",
                     "TP_STATUS", "TP_CANAL", "VL_HOSPEDAGEM", "VL_TAXA_LIMPEZA", "VL_SINAL", "DS_DETALHE_PRECOS",
                     "NO_VERSAO_POLITICA", "DT_ACEITE_POLITICA", "DT_CRIACAO")
select 'SE-7F3A2C1D', 1, 1, '2026-12-23', '2026-12-26', 2, 1, 1, 'CONFIRMADA', 'SITE',
       vl_hospedagem, vl_taxa_limpeza, vl_sinal, ds_detalhe, 1, '2026-11-18 10:12-03', '2026-11-18 10:12-03'
from consultar_disponibilidade('2026-12-23', '2026-12-26', 2, 1, 1);

-- 2) Pré-reserva: o hóspede ainda está preenchendo a reserva no site (segura as datas por 30 minutos)
insert into "SIT_RESERVA" ("CD_RESERVA", "ID_UNIDADE", "ID_HOSPEDE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "QTDE_CRIANCAS", "QTDE_BEBES",
                     "TP_STATUS", "TP_CANAL", "VL_HOSPEDAGEM", "VL_TAXA_LIMPEZA", "VL_SINAL", "DS_DETALHE_PRECOS", "DT_EXPIRA", "DT_CRIACAO")
select 'SE-91B0E4A2', 1, 2, '2027-01-15', '2027-01-17', 2, 0, 0, 'PENDENTE', 'SITE',
       vl_hospedagem, vl_taxa_limpeza, vl_sinal, ds_detalhe, '2026-11-18 14:35-03', '2026-11-18 14:05-03'
from consultar_disponibilidade('2027-01-15', '2027-01-17', 2, 0, 0);

-- A reserva 1 foi concluída no site; a equipe entrou em contato e lançou o sinal recebido por Pix.
-- O saldo será pago no check-in. A reserva 2 ainda está sendo preenchida (sem pagamento).
insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_PARCELA", "TP_PROVEDOR", "TP_METODO", "VL_PAGAMENTO", "TP_STATUS", "DT_PAGAMENTO", "CD_TRANSACAO",
                           "NM_REGISTRADO_POR", "DS_OBSERVACAO", "DT_CRIACAO")
values (1, 'SINAL', 'MANUAL', 'PIX', 3250.00, 'RECEBIDO', '2026-11-18 16:40-03', 'E18236120202611181940s0a1b2c3d4',
        'Carla (recepção)', 'Combinado por WhatsApp; Pix na chave da pousada', '2026-11-18 16:45-03');

insert into "SIT_CALENDARIO_EXTERNO" ("ID_UNIDADE", "TP_CANAL", "DS_URL_IMPORTACAO", "DT_ULTIMA_SINCRONIZACAO")
values (1, 'AIRBNB', 'https://www.airbnb.com.br/calendar/ical/000000.ics?s=…', '2026-11-18 14:00-03'),
       (1, 'BOOKING', 'https://admin.booking.com/hotel/hoteladmin/ical.html?t=…', '2026-11-18 14:00-03');

insert into "SIT_BLOQUEIO" ("ID_UNIDADE", "DT_INI", "DT_FIM", "TP_MOTIVO", "ID_CALENDARIO", "CD_EXTERNO", "DS_OBSERVACAO")
values (1, '2027-01-20', '2027-01-23', 'CANAL_EXTERNO', 1, 'HMXYZ123@airbnb.com', 'Reserva vinda do Airbnb'),
       (1, '2027-03-01', '2027-03-04', 'MANUTENCAO', null, null, 'Pintura do deck');

-- Datas de cadastro coerentes com a história do exemplo
update "SIT_PROPRIEDADE" set "DT_CRIACAO" = '2026-11-01 09:00-03';
update "SIT_UNIDADE"     set "DT_CRIACAO" = '2026-11-01 09:05-03';
update "SIT_TARIFA"      set "DT_CRIACAO" = case when "NO_PRIORIDADE" = 0 then timestamptz '2026-11-01 09:10-03' else timestamptz '2026-11-10 16:40-03' end;
update "SIT_HOSPEDE"     set "DT_CRIACAO" = case when "ID_HOSPEDE" = 1 then timestamptz '2026-11-18 10:12-03' else timestamptz '2026-11-18 14:05-03' end;
update "SIT_RESERVA"     set "DT_ATUALIZACAO" = case when "ID_RESERVA" = 1 then timestamptz '2026-11-18 10:19-03' else "DT_CRIACAO" end;
update "SIT_CALENDARIO_EXTERNO" set "DS_ULTIMO_ERRO" = null;
update "SIT_BLOQUEIO"    set "DT_CRIACAO" = case when "ID_BLOQUEIO" = 1 then timestamptz '2026-11-18 14:00-03' else timestamptz '2026-11-12 11:30-03' end;

-- Acompanhantes da reserva 1: adulto com sobrenome, criança com idade e bebê
update "SE"."SIT_RESERVA" set "DS_ACOMPANHANTES" = '[{"tipo":"adulto","nome":"Pedro","sobrenome":"Souza"},{"tipo":"crianca","nome":"Lia","idade":6},{"tipo":"bebe","nome":"Theo"}]'::jsonb
where "ID_RESERVA" = 1;
