-- ════════════════════════════════════════════════════════════════════
--  Dados iniciais do Solar do Espinhaço — valores definidos pelo
--  proprietário em 16/11/2026. Ver a seção "Pontos para confirmar"
--  do dicionário de dados antes de usar em produção.
-- ════════════════════════════════════════════════════════════════════

insert into propriedades (nome, horario_checkin, horario_checkout)
values ('Solar do Espinhaço', '15:00', '12:00');

-- 1 chalé: 2 adultos na suíte + 2 crianças no sofá-cama
insert into unidades (propriedade_id, slug, nome, tipo, hospedes_max, adultos_max, criancas_max, taxa_limpeza)
select id, 'chale-solar', 'Chalé Solar', 'chale', 4, 2, 2, 0.00 from propriedades;

-- Tarifa única: R$ 1.700 a noite para o casal, R$ 3,00 por criança por noite.
-- Vale para todas as noites até o fim de 2027; temporadas podem ser
-- acrescentadas depois com prioridade maior.
insert into tarifas (unidade_id, nome, periodo, prioridade, valor_noite, valor_noite_fds,
                     adultos_inclusos, valor_adulto_extra, valor_crianca, min_noites)
select id, 'Tarifa padrão', '[2026-11-01,2028-01-01)', 0, 1700.00, null, 2, 0.00, 3.00, 1
from unidades where slug = 'chale-solar';
