-- ════════════════════════════════════════════════════════════════════
--  Dados iniciais do Solar do Espinhaço — valores definidos pelo
--  proprietário em 16 e 17/11/2026. Ver "Pontos para confirmar" no
--  dicionário de dados antes de usar em produção.
-- ════════════════════════════════════════════════════════════════════

insert into PROPRIEDADE (NM_PROPRIEDADE, HR_CHECKIN, HR_CHECKOUT, NO_IDADE_MAX_CRIANCA,
                         QTDE_MAX_NOITES, VL_PERCENTUAL_SINAL, QTDE_MINUTOS_PRE_RESERVA)
values ('Solar do Espinhaço', '15:00', '12:00', 13,
        7, 50, 30);   -- percentual do sinal a confirmar

-- 1 chalé: 2 adultos na suíte + 2 crianças ou bebês no sofá-cama
insert into UNIDADE (ID_PROPRIEDADE, CD_UNIDADE, NM_UNIDADE, TP_UNIDADE,
                     QTDE_MAX_HOSPEDES, QTDE_MAX_ADULTOS, QTDE_MAX_CRIANCAS, VL_TAXA_LIMPEZA)
select ID_PROPRIEDADE, 'casa-do-mirante', 'Casa do Mirante', 'CHALE', 4, 2, 2, 0.00 from PROPRIEDADE;

-- Tarifa padrão: R$ 1.700 a noite para o casal, R$ 300 por criança (2 a 13 anos) por noite.
-- Vale para todas as noites até o fim de 2027. Réveillon, Carnaval e feriados
-- terão preço próprio: entram como tarifas de prioridade maior quando os
-- valores e as datas forem definidos.
insert into TARIFA (ID_UNIDADE, NM_TARIFA, DT_INI, DT_FIM, NO_PRIORIDADE, VL_NOITE, VL_NOITE_FDS,
                    QTDE_ADULTOS_INCLUSOS, VL_ADULTO_EXTRA, VL_CRIANCA, QTDE_MIN_NOITES)
select ID_UNIDADE, 'Tarifa padrão', '2026-11-01', '2028-01-01', 0, 1700.00, null, 2, 0.00, 300.00, 1
from UNIDADE where CD_UNIDADE = 'casa-do-mirante';
