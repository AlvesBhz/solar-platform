-- ════════════════════════════════════════════════════════════════════
--  Exemplos usados no DER (der.html). Roda depois de schema.sql e
--  seed_exemplo.sql, num banco de teste. Os dados são fictícios e
--  passam por todas as regras do banco.
-- ════════════════════════════════════════════════════════════════════

-- Tarifa de Réveillon por cima da padrão (prioridade maior, mínimo 3 noites)
insert into TARIFA (ID_UNIDADE, NM_TARIFA, DT_INI, DT_FIM, NO_PRIORIDADE, VL_NOITE, VL_NOITE_FDS,
                    QTDE_ADULTOS_INCLUSOS, VL_ADULTO_EXTRA, VL_CRIANCA, VL_BEBE, QTDE_MIN_NOITES)
values (1, 'Réveillon 2027', '2026-12-29', '2027-01-02', 10, 2500.00, null, 2, 0.00, 300.00, 0.00, 3);

-- Exceções de um dia só
insert into AJUSTE_DIARIO (ID_UNIDADE, DT_REF, VL_NOITE, QTDE_MIN_NOITES, DS_OBSERVACAO)
values (1, '2026-12-24', 2200.00, 2, 'Véspera de Natal: preço especial e mínimo de 2 noites');
insert into AJUSTE_DIARIO (ID_UNIDADE, DT_REF, SG_SEM_CHEGADA, DS_OBSERVACAO)
values (1, '2027-02-06', true, 'Sábado de Carnaval: ninguém faz check-in neste dia');
insert into AJUSTE_DIARIO (ID_UNIDADE, DT_REF, SG_FECHADO, DS_OBSERVACAO)
values (1, '2027-03-17', true, 'Folga da equipe: noite fora da venda');

insert into HOSPEDE (NM_HOSPEDE, DS_EMAIL, DS_TELEFONE)
values ('Ana Souza', 'ana.souza@exemplo.com', '+55 31 99999-0001'),
       ('Bruno Lima', 'bruno.lima@exemplo.com', '+55 11 98888-0002');

-- 1) Reserva confirmada no site: 23 a 26/12, casal + 1 criança + 1 bebê
insert into RESERVA (CD_RESERVA, ID_UNIDADE, ID_HOSPEDE, DT_CHECKIN, DT_CHECKOUT, QTDE_ADULTOS, QTDE_CRIANCAS, QTDE_BEBES,
                     TP_STATUS, TP_CANAL, VL_HOSPEDAGEM, VL_TAXA_LIMPEZA, VL_SINAL, DS_DETALHE_PRECOS,
                     NO_VERSAO_POLITICA, DT_ACEITE_POLITICA, DT_CRIACAO)
select 'SE-7F3A2C1D', 1, 1, '2026-12-23', '2026-12-26', 2, 1, 1, 'CONFIRMADA', 'SITE',
       vl_hospedagem, vl_taxa_limpeza, vl_sinal, ds_detalhe, 1, '2026-11-18 10:12-03', '2026-11-18 10:12-03'
from consultar_disponibilidade('2026-12-23', '2026-12-26', 2, 1, 1);

-- 2) Pré-reserva aguardando o Pix do sinal (segura as datas por 30 minutos)
insert into RESERVA (CD_RESERVA, ID_UNIDADE, ID_HOSPEDE, DT_CHECKIN, DT_CHECKOUT, QTDE_ADULTOS, QTDE_CRIANCAS, QTDE_BEBES,
                     TP_STATUS, TP_CANAL, VL_HOSPEDAGEM, VL_TAXA_LIMPEZA, VL_SINAL, DS_DETALHE_PRECOS, DT_EXPIRA, DT_CRIACAO)
select 'SE-91B0E4A2', 1, 2, '2027-01-15', '2027-01-17', 2, 0, 0, 'PENDENTE', 'SITE',
       vl_hospedagem, vl_taxa_limpeza, vl_sinal, ds_detalhe, '2026-11-18 14:35-03', '2026-11-18 14:05-03'
from consultar_disponibilidade('2027-01-15', '2027-01-17', 2, 0, 0);

-- Sinal da reserva 1 pago por Pix no site; saldo a receber em dinheiro no check-in
insert into PAGAMENTO (ID_RESERVA, TP_PARCELA, TP_PROVEDOR, TP_METODO, VL_PAGAMENTO, TP_STATUS, CD_EXTERNO, DT_PAGAMENTO, DT_CRIACAO)
values (1, 'SINAL', 'MERCADO_PAGO', 'PIX', 3250.00, 'APROVADO', 'MP-1325849901', '2026-11-18 10:19-03', '2026-11-18 10:13-03');
insert into PAGAMENTO (ID_RESERVA, TP_PARCELA, TP_PROVEDOR, TP_METODO, VL_PAGAMENTO, TP_STATUS, DT_CRIACAO)
values (1, 'SALDO', 'MANUAL', 'DINHEIRO', 3250.00, 'PENDENTE', '2026-11-18 10:19-03');
-- Pix do sinal da pré-reserva 2, ainda não pago
insert into PAGAMENTO (ID_RESERVA, TP_PARCELA, TP_PROVEDOR, TP_METODO, VL_PAGAMENTO, TP_STATUS, CD_EXTERNO, DS_PIX_COPIA_E_COLA, DT_EXPIRA, DT_CRIACAO)
values (2, 'SINAL', 'MERCADO_PAGO', 'PIX', 1700.00, 'PENDENTE', 'MP-1325851177',
        '00020126580014br.gov.bcb.pix0136…6304A1B2', '2026-11-18 14:35-03', '2026-11-18 14:05-03');

insert into CALENDARIO_EXTERNO (ID_UNIDADE, TP_CANAL, DS_URL_IMPORTACAO, DT_ULTIMA_SINCRONIZACAO)
values (1, 'AIRBNB', 'https://www.airbnb.com.br/calendar/ical/000000.ics?s=…', '2026-11-18 14:00-03'),
       (1, 'BOOKING', 'https://admin.booking.com/hotel/hoteladmin/ical.html?t=…', '2026-11-18 14:00-03');

insert into BLOQUEIO (ID_UNIDADE, DT_INI, DT_FIM, TP_MOTIVO, ID_CALENDARIO, CD_EXTERNO, DS_OBSERVACAO)
values (1, '2027-01-20', '2027-01-23', 'CANAL_EXTERNO', 1, 'HMXYZ123@airbnb.com', 'Reserva vinda do Airbnb'),
       (1, '2027-03-01', '2027-03-04', 'MANUTENCAO', null, null, 'Pintura do deck');

-- Datas de cadastro coerentes com a história do exemplo
update PROPRIEDADE set DT_CRIACAO = '2026-11-01 09:00-03';
update UNIDADE     set DT_CRIACAO = '2026-11-01 09:05-03';
update TARIFA      set DT_CRIACAO = case when NO_PRIORIDADE = 0 then timestamptz '2026-11-01 09:10-03' else timestamptz '2026-11-10 16:40-03' end;
update HOSPEDE     set DT_CRIACAO = case when ID_HOSPEDE = 1 then timestamptz '2026-11-18 10:12-03' else timestamptz '2026-11-18 14:05-03' end;
update RESERVA     set DT_ATUALIZACAO = case when ID_RESERVA = 1 then timestamptz '2026-11-18 10:19-03' else DT_CRIACAO end;
update CALENDARIO_EXTERNO set DS_ULTIMO_ERRO = null;
update BLOQUEIO    set DT_CRIACAO = case when ID_BLOQUEIO = 1 then timestamptz '2026-11-18 14:00-03' else timestamptz '2026-11-12 11:30-03' end;
