-- ════════════════════════════════════════════════════════════════════
--  Dados iniciais do Solar do Espinhaço — valores definidos pelo
--  proprietário em 16 e 17/11/2026. Ver "Pontos para confirmar" no
--  dicionário de dados antes de usar em produção.
--  Pode rodar mais de uma vez: o que já existe não é gravado de novo.
-- ════════════════════════════════════════════════════════════════════

-- A pousada (regra de remarcação: proposta, aguardando aprovação)
insert into "SE"."SIT_PROPRIEDADE" ("NM_PROPRIEDADE", "HR_CHECKIN", "HR_CHECKOUT", "NO_IDADE_MAX_BEBE", "NO_IDADE_MAX_CRIANCA_MENOR", "NO_IDADE_MAX_CRIANCA",
                                  "QTDE_MAX_NOITES", "VL_PERCENTUAL_SINAL", "QTDE_MINUTOS_PRE_RESERVA",
                                  "QTDE_DIAS_LIMITE_REMARCACAO", "QTDE_MESES_VALIDADE_CREDITO")
select 'Solar do Espinhaço', '15:00', '12:00', 4, 8, 13,
       7, 50, 30,
       7, 12
where not exists (select 1 from "SE"."SIT_PROPRIEDADE" where "NM_PROPRIEDADE" = 'Solar do Espinhaço');

-- 1 chalé: 2 adultos na suíte + 2 crianças ou bebês no sofá-cama
insert into "SE"."SIT_UNIDADE" ("ID_PROPRIEDADE", "CD_UNIDADE", "NM_UNIDADE", "TP_UNIDADE",
                              "QTDE_MAX_HOSPEDES", "QTDE_MAX_ADULTOS", "QTDE_MAX_CRIANCAS", "VL_TAXA_LIMPEZA")
select "ID_PROPRIEDADE", 'casa-do-mirante', 'Casa do Mirante', 'CHALE', 4, 2, 2, 0.00
from "SE"."SIT_PROPRIEDADE" where "NM_PROPRIEDADE" = 'Solar do Espinhaço'
on conflict ("CD_UNIDADE") do nothing;

-- Tarifa padrão (20/11/2026): noites de segunda a quinta R$ 800 para o casal; noites de sexta, sábado e
-- domingo R$ 1.700. Criança paga um percentual do valor por pessoa da noite (valor ÷ 2 adultos):
-- até 4 anos não paga (mas ocupa vaga), 5 a 8 anos 30%, 9 a 13 anos 100%; a partir de 14, adulto.
-- Mínimo de 2 noites. Vale até o fim de 2028.
insert into "SE"."SIT_TARIFA" ("ID_UNIDADE", "NM_TARIFA", "DT_INI", "DT_FIM", "NO_PRIORIDADE", "VL_NOITE", "VL_NOITE_FDS",
                             "QTDE_ADULTOS_INCLUSOS", "VL_ADULTO_EXTRA", "PC_CRIANCA", "PC_CRIANCA_MAIOR", "PC_BEBE", "QTDE_MIN_NOITES")
select u."ID_UNIDADE", 'Tarifa padrão', '2026-11-01', '2029-01-01', 0, 800.00, 1700.00, 2, 0.00, 30, 100, 0, 2
from "SE"."SIT_UNIDADE" u
where u."CD_UNIDADE" = 'casa-do-mirante'
  and not exists (select 1 from "SE"."SIT_TARIFA" t where t."ID_UNIDADE" = u."ID_UNIDADE" and t."NM_TARIFA" = 'Tarifa padrão');

-- Feriados: as noites do feriado prolongado custam como fim de semana (R$ 1.700) e pedem mínimo de
-- 3 noites; Réveillon e Carnaval, 4. Quem atravessa qualquer uma dessas noites cumpre o mínimo dela.
insert into "SE"."SIT_AJUSTE_DIARIO" ("ID_UNIDADE", "DT_REF", "VL_NOITE", "QTDE_MIN_NOITES", "DS_OBSERVACAO")
select u."ID_UNIDADE", f.noite::date, 1700.00, f.min_noites, f.feriado
from "SE"."SIT_UNIDADE" u
cross join lateral (values
  ('2026-12-24', '2026-12-27', 3, 'Natal 2026'),
  ('2026-12-30', '2027-01-03', 4, 'Réveillon 2027'),
  ('2027-02-05', '2027-02-09', 4, 'Carnaval 2027'),
  ('2027-03-25', '2027-03-28', 3, 'Semana Santa 2027'),
  ('2027-05-27', '2027-05-30', 3, 'Corpus Christi 2027'),
  ('2027-09-04', '2027-09-07', 3, 'Independência 2027'),
  ('2027-10-09', '2027-10-12', 3, 'Nossa Senhora Aparecida 2027'),
  ('2027-10-30', '2027-11-02', 3, 'Finados 2027'),
  ('2027-11-12', '2027-11-15', 3, 'Proclamação da República 2027'),
  ('2027-12-24', '2027-12-27', 3, 'Natal 2027'),
  ('2027-12-30', '2028-01-03', 4, 'Réveillon 2028')
) v(ini, fim, min_noites, feriado)
cross join lateral (select gs as noite, v.min_noites, v.feriado
                    from generate_series(v.ini::date, v.fim::date - 1, interval '1 day') gs) f
where u."CD_UNIDADE" = 'casa-do-mirante'
on conflict ("ID_UNIDADE", "DT_REF") do nothing;

-- Conferência: deve mostrar 1 | 1 | 1
select (select count(*) from "SE"."SIT_PROPRIEDADE") as propriedades,
       (select count(*) from "SE"."SIT_UNIDADE")     as chales,
       (select count(*) from "SE"."SIT_TARIFA")      as tarifas;
