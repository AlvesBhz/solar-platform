# Banco de dados de reservas — proposta v2

Estrutura para o site responder, ao clicar em **Ver disponibilidade**, se o chalé está livre nas datas escolhidas e quanto custa a estadia, noite a noite.

**Situação:** proposta em validação, ainda não ligada ao site. O schema roda num PostgreSQL 16 e passou em todos os testes desta pasta. Os dados iniciais usam os valores definidos em 16 e 17/11/2026: chalé Casa do Mirante, check-in 15h, R$ 1.700 a noite para o casal, R$ 300 por criança (2 a 13 anos) por noite, bebê não paga mas ocupa vaga, até 2 adultos e 2 crianças, até 7 noites, sinal não reembolsável com remarcação, pagamento por Pix e Mercado Pago, 30 minutos para pagar.

| Arquivo | Conteúdo |
|---|---|
| `schema.sql` | Tabelas, regras, funções e segurança |
| `seed_exemplo.sql` | Dados iniciais reais: a pousada, o chalé e a tarifa padrão |
| `testes.sql` | 28 cenários de preço, regras de venda, ocupação, pré-reserva e pagamento (cria os próprios dados de teste) |
| `testes_permissoes.sql` | O que o visitante anônimo pode e não pode fazer |
| `supabase_simulado.sql` | Recria as permissões padrão do Supabase num PostgreSQL comum, só para os testes |

---

## Por que Supabase

O app de vistorias (`solar-inspect`) já especifica Supabase (PostgreSQL, Auth, RLS, RPC e Edge Functions). Usar o mesmo banco evita duas bases para a mesma pousada, e a proposta reaproveita o modelo **Propriedade → Unidade** de lá. Assim, quando a vistoria bloquear um chalé por manutenção, esse bloqueio pode tirar as datas da venda no site.

O site continua estático no GitHub Pages: ele chama o banco direto pela API do Supabase.

O Supabase roda **PostgreSQL**, não Microsoft SQL Server. Os dois usam a linguagem SQL, mas o schema desta pasta usa recursos próprios do PostgreSQL: intervalos de datas (`daterange`) e a constraint que impede duas reservas na mesma noite. Em SQL Server essas duas partes teriam de ser reescritas com triggers.

## Modelo

Nomes no mesmo padrão dos outros projetos (esquema IBP): tabelas e campos em MAIÚSCULAS, tabelas no singular e prefixo pelo tipo do campo (`ID_` identificador, `NM_` nome, `DS_` descrição, `DT_` data, `HR_` hora, `VL_` valor, `QTDE_` quantidade, `NO_` número, `CD_` código, `TP_` tipo de lista fixa, `SG_` sim/não). Restrições: `PK_<TABELA>`, `FK_<FILHA>_<PAI>`, `UQ_`, `CK_`, `EX_`, `IX_`. O PostgreSQL guarda os nomes em minúsculas por dentro, mas aceita escrevê-los em maiúsculas nas consultas.

```mermaid
erDiagram
    PROPRIEDADE ||--o{ UNIDADE : tem
    UNIDADE ||--o{ TARIFA : "preço por período"
    UNIDADE ||--o{ AJUSTE_DIARIO : "exceções por data"
    UNIDADE ||--o{ RESERVA : recebe
    UNIDADE ||--o{ BLOQUEIO : tem
    UNIDADE ||--o{ CALENDARIO_EXTERNO : "Airbnb / Booking"
    CALENDARIO_EXTERNO ||--o{ BLOQUEIO : importa
    HOSPEDE ||--o{ RESERVA : faz
    RESERVA ||--o{ PAGAMENTO : recebe
    RESERVA ||--o| RESERVA : "remarcada de"
```

| Tabela | Para que serve |
|---|---|
| `PROPRIEDADE` | A pousada: fuso, horários de check-in/out, idade máxima de criança, estadia máxima, percentual do sinal, minutos para pagar e regra de remarcação |
| `UNIDADE` | Cada chalé: capacidade (hóspedes, adultos, crianças + bebês) e taxa de limpeza |
| `TARIFA` | Preço por período (`DT_INI`/`DT_FIM`): valor da noite, valor de sexta/sábado, adultos inclusos, adulto extra, valor por criança, mínimo de noites. Períodos podem se sobrepor; vale o maior `NO_PRIORIDADE` |
| `AJUSTE_DIARIO` | Exceção de um dia (`DT_REF`): preço especial, mínimo de noites, noite fechada, sem chegada ou sem saída |
| `RESERVA` | Reservas do site, telefone ou contato direto, com o preço, o sinal (pago no site) e o saldo (pago no check-in) gravados no momento da reserva |
| `PAGAMENTO` | Tentativas de pagamento de cada parcela (`TP_PARCELA`: SINAL no site, SALDO no check-in): Pix ou cartão via Mercado Pago, ou Pix manual. Nenhum dado de cartão é guardado |
| `BLOQUEIO` | Datas indisponíveis que não são reservas do site: manutenção, uso próprio e reservas do Airbnb/Booking |
| `CALENDARIO_EXTERNO` | Links iCal do Airbnb e do Booking, importados periodicamente para `BLOQUEIO` |
| `HOSPEDE` | Nome, e-mail e telefone; só o necessário (LGPD) |

## Como a disponibilidade e o preço são calculados

A estadia são as **noites** de `DT_CHECKIN` até a véspera de `DT_CHECKOUT`. A noite do dia de saída não é cobrada nem ocupada, então quem sai no dia 21 libera o chalé para quem entra no dia 21.

Para cada noite da estadia:

1. **Preço da noite:** o ajuste do dia, se houver. Senão, a tarifa de maior prioridade que cobre a noite: valor de sexta/sábado nas noites de sexta e sábado, valor normal nas demais.
2. **Hóspedes:** o valor da noite cobre os adultos inclusos (o casal). Cada criança de 2 a 13 anos soma o valor de criança por noite, e cada adulto além dos inclusos soma o valor de adulto extra. Bebês abaixo de 2 anos não pagam, mas ocupam uma vaga de criança.
3. **Total:** soma das noites + taxa de limpeza (uma vez por estadia).

A unidade fica **indisponível** quando ocorre qualquer um destes motivos, que voltam para o site mostrar a mensagem certa:

| Motivo | Quando |
|---|---|
| `datas_invalidas` | Check-out igual ou anterior ao check-in |
| `data_passada` | Check-in antes de hoje (fuso de São Paulo) |
| `estadia_longa` | Mais noites que o máximo da propriedade (7) |
| `capacidade` | Mais hóspedes, adultos ou crianças + bebês que o chalé comporta |
| `sem_tarifa` | Alguma noite sem tarifa cadastrada (venda ainda não aberta) |
| `fechado` | Alguma noite marcada como fechada |
| `sem_chegada` / `sem_saida` | Check-in ou check-out numa data que não permite |
| `min_noites` | Menos noites que o mínimo. Vale o **maior** mínimo entre as noites da estadia: quem entra antes do Réveillon e atravessa a virada também cumpre o mínimo do Réveillon |
| `ocupado` | Sobrepõe reserva confirmada, pré-reserva ainda válida ou bloqueio |

## Como o site usa

### 1. Consultar (botão "Ver disponibilidade")

Função pública `consultar_disponibilidade(check-in, check-out, adultos, crianças, bebês)`, chamada direto do navegador:

```js
const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consultar_disponibilidade`, {
  method: 'POST',
  headers: {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ p_checkin: '2027-03-04', p_checkout: '2027-03-07', p_adultos: 2, p_criancas: 1, p_bebes: 0 }),
});
const [chale] = await resp.json();
```

Resposta de exemplo, gerada pelos testes (casal + 1 criança, 3 noites de qui a dom):

```json
{
  "cd_unidade": "casa-do-mirante", "nm_unidade": "Casa do Mirante",
  "disponivel": true, "motivo": null, "qtde_noites": 3, "qtde_min_noites": 1,
  "vl_hospedagem": 6000.00, "vl_taxa_limpeza": 0.00, "vl_total": 6000.00,
  "vl_medio_noite": 2000.00, "vl_sinal": 3000.00,
  "ds_detalhe": [
    { "dt_ref": "2027-03-04", "nm_tarifa": "Tarifa padrão", "vl_base": 1700.00, "vl_extras": 300.00, "vl_noite": 2000.00 },
    { "dt_ref": "2027-03-05", "nm_tarifa": "Tarifa padrão", "vl_base": 1700.00, "vl_extras": 300.00, "vl_noite": 2000.00 },
    { "dt_ref": "2027-03-06", "nm_tarifa": "Tarifa padrão", "vl_base": 1700.00, "vl_extras": 300.00, "vl_noite": 2000.00 }
  ]
}
```

Quando a unidade está indisponível, os valores vêm vazios e `motivo` explica o porquê. A API devolve os nomes em minúsculas (é assim que o PostgreSQL os guarda). A chave `anon` do Supabase é pública por natureza; a proteção está no banco (ver Segurança).

### 2. Reservar

`criar_pre_reserva(unidade, check-in, check-out, adultos, crianças, bebês)` segura as datas por **30 minutos** enquanto o hóspede paga o **sinal** (50% do total, a confirmar), e devolve o código da reserva (ex.: `SE-C1D82CDD`), o total e o sinal. Ela é chamada por uma **Edge Function** do Supabase, nunca direto do navegador, para que a função possa aplicar captcha e limite de tentativas antes de segurar datas. O pagamento é feito pelo Mercado Pago (Pix ou cartão) e registrado em `PAGAMENTO`; quando o Mercado Pago avisa a aprovação (webhook), a Edge Function grava o hóspede e muda a reserva para `confirmada`.

Se o pagamento não acontecer, a pré-reserva vence sozinha: a consulta já ignora pré-reservas vencidas, e um job (`expirar_pre_reservas`, via pg_cron) só atualiza o status.

### 3. Airbnb e Booking

O chalé também é vendido nesses canais, então os três calendários precisam conversar:

- **Entrada:** um job (Edge Function agendada, a cada 15–30 min) lê o iCal de cada canal em `CALENDARIO_EXTERNO` e grava as datas em `BLOQUEIO`. O UID de cada evento permite atualizar ou remover o bloqueio quando o canal cancela.
- **Saída:** o site publica o próprio iCal (reservas confirmadas + bloqueios manuais) para ser importado no Airbnb e no Booking.

O iCal tem atraso de minutos a horas, então ainda existe um risco pequeno de vender a mesma data em dois canais nesse intervalo. Eliminar esse risco por completo exige um channel manager (integração por API).

## Garantias contra overbooking

- **No banco:** uma constraint impede duas reservas ativas do mesmo chalé na mesma noite, mesmo com acessos simultâneos.
- **Na pré-reserva:** a função trava o chalé durante a verificação, então pedidos simultâneos entram em fila. Testado com duas sessões ao mesmo tempo: a segunda esperou a primeira e foi recusada com `ocupado`.
- **Bloqueios fora da constraint:** ficam de fora de propósito, porque o iCal de um canal costuma devolver também as datas que o próprio site vendeu, e isso não pode quebrar a sincronização. A trava da pré-reserva cobre esse caso.

## Segurança

- **RLS em todas as tabelas,** sem nenhuma política para visitante: o navegador não lê nem grava tabela alguma. Testado como `anon`: 0 linhas em `RESERVA`, `HOSPEDE` e `PAGAMENTO`, inserção recusada.
- **Uma única porta para o visitante:** `consultar_disponibilidade`, que não devolve dados de hóspedes nem de outras reservas.
- **Revogação explícita:** no Supabase as funções novas recebem permissão de execução para `anon` e `authenticated` por padrão, então o schema revoga essa permissão papel a papel. A pré-reserva e a função interna de cálculo só rodam com `service_role`.
- **Equipe:** as políticas de acesso do painel (para cadastrar tarifas e ver reservas) entram junto com o login do Supabase, no mesmo modelo de perfis do `solar-inspect`.

## Decisões

Definidas em 16 e 17/11/2026 e já aplicadas: chalé Casa do Mirante; check-in às 15h e check-out às 12h; R$ 1.700 a noite para o casal; R$ 300 por criança (2 a 13 anos) por noite; adulto a partir de 14 anos; bebê até 1 ano não paga, mas ocupa uma das 2 vagas de criança; até 2 adultos e 2 crianças; sem taxa de limpeza; até 7 noites; datas especiais com mínimo de 2 noites; sinal de 50% pago no site (Pix ou Mercado Pago), não reembolsável, com possibilidade de remarcação; saldo pago no check-in, antes de entrar; 30 minutos para pagar o sinal.

Proposta aguardando aprovação: remarcar até 7 dias antes do check-in (`QTDE_DIAS_LIMITE_REMARCACAO`), crédito válido por 12 meses (`QTDE_MESES_VALIDADE_CREDITO`), diferença paga se a nova data for mais cara e não devolvida se for mais barata.

Ainda em aberto: datas, preços e tipos das datas especiais; meio de pagamento do saldo no check-in; consulta jurídica sobre o art. 49 do CDC.

Diagrama: `der.html` nesta pasta (abre no navegador).

## Como testar localmente

Com PostgreSQL 15+ e um banco vazio:

```bash
psql -d solar -v ON_ERROR_STOP=1 -f supabase_simulado.sql -f schema.sql -f seed_exemplo.sql
```

```bash
psql -d solar -v ON_ERROR_STOP=1 -f testes.sql -f testes_permissoes.sql
```

Cada cenário imprime `ok` ou interrompe com `FALHOU` mostrando o valor obtido e o esperado.

## Como aplicar no Supabase

1. No painel do projeto, abra **SQL Editor › New query**.
2. Cole o conteúdo de `schema.sql` e clique em **Run**.
3. Opcional: rode `seed_exemplo.sql` para ter dados de teste, e depois `testes.sql`.
4. Para expirar pré-reservas automaticamente, ative a extensão **pg_cron** (Database › Extensions) e rode:
   `select cron.schedule('expirar-pre-reservas', '* * * * *', 'select expirar_pre_reservas()');`

Não rode `supabase_simulado.sql` no Supabase: os papéis `anon`, `authenticated` e `service_role` já existem lá.

## Próximos passos sugeridos

1. Fechar as decisões em aberto e substituir os dados de exemplo.
2. Criar o projeto no Supabase (ou usar o do `solar-inspect`) e aplicar o schema.
3. Ligar o botão "Ver disponibilidade" do site à consulta e mostrar preço ou motivo.
4. Edge Functions: pré-reserva + pagamento, importação dos iCal, exportação do iCal do site.
5. Painel da equipe para tarifas, ajustes e reservas.
