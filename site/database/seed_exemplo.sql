-- ════════════════════════════════════════════════════════════════════
--  Dados de EXEMPLO para testar a proposta — valores fictícios.
--  Substituir pelos preços, temporadas e capacidades reais antes de usar.
-- ════════════════════════════════════════════════════════════════════

insert into propriedades (nome, horario_checkin, horario_checkout)
values ('Solar do Espinhaço', '14:00', '12:00');

-- O site apresenta hoje um chalé (suíte 28 m² com cama king, sala 26 m²
-- com sofá-cama, piscina e deck). Capacidade de exemplo: 4 hóspedes.
insert into unidades (propriedade_id, slug, nome, tipo, hospedes_max, adultos_max, criancas_max, taxa_limpeza)
select id, 'chale-solar', 'Chalé Solar', 'chale', 4, 4, 2, 180.00 from propriedades;

-- Temporadas (prioridade maior vence onde os períodos se sobrepõem)
insert into tarifas (unidade_id, nome, periodo, prioridade, valor_noite, valor_noite_fds,
                     hospedes_inclusos, valor_adulto_extra, valor_crianca_extra, min_noites)
select u.id, t.nome, t.periodo::daterange, t.prioridade, t.valor, t.fds, 2, 150.00, 80.00, t.min_n
from unidades u,
(values
  ('Base 2026–2027',      '[2026-11-01,2028-01-01)', 0,   890.00, 1090.00, 1),
  ('Alta temporada julho', '[2027-07-01,2027-08-01)', 10, 1190.00, 1390.00, 2),
  ('Alta temporada verão', '[2026-12-15,2027-03-01)', 10, 1190.00, 1390.00, 2),
  ('Carnaval 2027',        '[2027-02-06,2027-02-11)', 20, 1800.00, null,    4),
  ('Réveillon 2026/27',    '[2026-12-29,2027-01-02)', 20, 2400.00, null,    4)
) as t(nome, periodo, prioridade, valor, fds, min_n)
where u.slug = 'chale-solar';

-- Ajustes pontuais de exemplo
insert into ajustes_diarios (unidade_id, data, valor_noite, observacao)
select id, '2027-04-21', 1290.00, 'Tiradentes' from unidades where slug = 'chale-solar';
insert into ajustes_diarios (unidade_id, data, fechado, observacao)
select id, '2027-05-12', true, 'Dedetização' from unidades where slug = 'chale-solar';
insert into ajustes_diarios (unidade_id, data, sem_chegada, observacao)
select id, '2027-06-04', true, 'Sem check-in na sexta do feriado' from unidades where slug = 'chale-solar';

-- Calendários dos canais (URLs fictícias) e um bloqueio vindo do Airbnb
insert into calendarios_externos (unidade_id, canal, url_importacao)
select id, c.canal, c.url from unidades,
  (values ('airbnb',  'https://www.airbnb.com.br/calendar/ical/EXEMPLO.ics'),
          ('booking', 'https://admin.booking.com/hotel/hoteladmin/ical.html?t=EXEMPLO')) c(canal, url)
where slug = 'chale-solar';

insert into bloqueios (unidade_id, periodo, motivo, calendario_id, uid_externo)
select u.id, '[2027-03-12,2027-03-15)', 'canal_externo', c.id, 'airbnb-EXEMPLO-1'
from unidades u join calendarios_externos c on c.unidade_id = u.id and c.canal = 'airbnb'
where u.slug = 'chale-solar';

-- Uma reserva confirmada feita pelo site
insert into hospedes (nome, email, telefone) values ('Hóspede Exemplo', 'hospede@exemplo.com', '+55 31 90000-0000');
insert into reservas (unidade_id, hospede_id, periodo, adultos, criancas, status, canal, valor_hospedagem, taxa_limpeza)
select u.id, h.id, '[2027-03-19,2027-03-21)', 2, 0, 'confirmada', 'site', 2180.00, 180.00
from unidades u, hospedes h where u.slug = 'chale-solar' and h.email = 'hospede@exemplo.com';
