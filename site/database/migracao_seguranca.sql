-- Migração de segurança (20/11/2026) para o banco JÁ criado: não apaga dados.
-- Rode uma vez no SQL Editor; quem recriar com schema.sql já recebe tudo isto. Depois rode storage.sql.
set search_path = "SE", extensions, pg_temp;
begin;
drop function if exists confirmar_sinal(text, text, text, numeric, text);
create or replace function confirmar_sinal(
  p_cd_reserva     text,
  p_registrado_por text,
  p_cd_transacao   text,                     -- id do Pix (E2E) que aparece no extrato do banco
  p_vl_pago        numeric,                  -- valor que entrou no extrato
  p_metodo         text default 'PIX'
)
returns table (cd_reserva text, tp_status text, vl_sinal numeric(10,2), vl_saldo numeric(10,2))
language plpgsql
volatile
security definer
set search_path = "SE", extensions, pg_temp
as $$
declare
  v "SIT_RESERVA"%rowtype;
begin
  select r.* into v from "SIT_RESERVA" r where r."CD_RESERVA" = p_cd_reserva for update;
  if not found then
    raise exception 'reserva_inexistente' using errcode = 'P0001';
  end if;
  if v."TP_STATUS" not in ('PENDENTE', 'EXPIRADA') then
    raise exception 'reserva_nao_pendente' using errcode = 'P0001';
  end if;
  if v."ID_HOSPEDE" is null then
    raise exception 'cadastro_incompleto' using errcode = 'P0001';     -- o hóspede não terminou o formulário
  end if;
  if nullif(btrim(p_registrado_por), '') is null then
    raise exception 'responsavel_obrigatorio' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_cd_transacao, ''))) < 6 then
    raise exception 'transacao_obrigatoria' using errcode = 'P0001';   -- sem o id do Pix do extrato não confirma
  end if;
  if p_vl_pago is null or p_vl_pago < v."VL_SINAL" then
    raise exception 'valor_menor_que_sinal' using errcode = 'P0001';
  end if;
  if (v."TP_STATUS" = 'EXPIRADA' or v."DT_EXPIRA" <= now()) and (
       exists (select 1 from "SIT_RESERVA" r
               where r."ID_UNIDADE" = v."ID_UNIDADE" and r."ID_RESERVA" <> v."ID_RESERVA"
                 and daterange(r."DT_CHECKIN", r."DT_CHECKOUT") && daterange(v."DT_CHECKIN", v."DT_CHECKOUT")
                 and (r."TP_STATUS" = 'CONFIRMADA' or (r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" > now())))
    or exists (select 1 from "SIT_BLOQUEIO" b
               where b."ID_UNIDADE" = v."ID_UNIDADE"
                 and daterange(b."DT_INI", b."DT_FIM") && daterange(v."DT_CHECKIN", v."DT_CHECKOUT"))) then
    raise exception 'ocupado' using errcode = 'P0001';                 -- pagou depois do prazo e as datas já foram vendidas
  end if;

  insert into "SIT_PAGAMENTO" ("ID_RESERVA", "TP_PARCELA", "TP_PROVEDOR", "TP_METODO", "VL_PAGAMENTO", "TP_STATUS",
                               "DT_PAGAMENTO", "CD_TRANSACAO", "NM_REGISTRADO_POR")
  values (v."ID_RESERVA", 'SINAL', 'MANUAL', p_metodo, p_vl_pago, 'RECEBIDO',
          now(), btrim(p_cd_transacao), btrim(p_registrado_por));

  return query
  update "SIT_RESERVA" r set "TP_STATUS" = 'CONFIRMADA', "DT_EXPIRA" = null, "DT_ATUALIZACAO" = now()
  where r."ID_RESERVA" = v."ID_RESERVA"
  returning r."CD_RESERVA", r."TP_STATUS", r."VL_SINAL", r."VL_SALDO";
end;
$$;
revoke all on function confirmar_sinal(text, text, text, numeric, text) from public, anon, authenticated;
grant execute on function confirmar_sinal(text, text, text, numeric, text) to service_role;

-- ════════════════════════════════════════════════════════════════════
--  Segurança (20/11/2026)
-- ════════════════════════════════════════════════════════════════════

-- ── SIT_TENTATIVA: limite de pedidos de reserva por visitante ───────────
-- A função do site grava aqui cada pedido (IP do visitante só como hash, LGPD).
-- O limite fica no banco porque a função roda em várias cópias ao mesmo tempo.
create table "SIT_TENTATIVA" (
  "ID_TENTATIVA"  bigint generated always as identity,
  "DS_CHAVE"      text not null,                 -- sha-256 do IP
  "DT_CRIACAO"    timestamptz not null default now(),
  constraint "PK_SIT_TENTATIVA" primary key ("ID_TENTATIVA")
);
create index "IX_SIT_TENTATIVA_CHAVE" on "SIT_TENTATIVA" ("DS_CHAVE", "DT_CRIACAO");
alter table "SIT_TENTATIVA" enable row level security;

-- Conta o pedido e diz se o visitante ainda pode tentar (até p_limite pedidos por hora por IP).
create or replace function registrar_tentativa(p_chave text, p_limite int default 6)
returns boolean
language plpgsql
volatile
security definer
set search_path = "SE", extensions, pg_temp
as $$
declare n int;
begin
  delete from "SIT_TENTATIVA" where "DT_CRIACAO" < now() - interval '1 day';
  select count(*) into n from "SIT_TENTATIVA" where "DS_CHAVE" = p_chave and "DT_CRIACAO" > now() - interval '1 hour';
  if n >= p_limite then
    return false;
  end if;
  insert into "SIT_TENTATIVA" ("DS_CHAVE") values (p_chave);
  return true;
end;
$$;
revoke all on function registrar_tentativa(text, int) from public, anon, authenticated;
grant execute on function registrar_tentativa(text, int) to service_role;

-- O mesmo e-mail, CPF ou passaporte já segura outras datas sem ter pago o sinal?
create or replace function pre_reserva_em_aberto(p_email text, p_cpf text default null, p_passaporte text default null)
returns boolean
language sql
stable
security definer
set search_path = "SE", extensions, pg_temp
as $$
  select exists (select 1 from "SIT_RESERVA" r join "SIT_HOSPEDE" h using ("ID_HOSPEDE")
                 where r."TP_STATUS" = 'PENDENTE' and r."DT_EXPIRA" > now()
                   and (lower(h."DS_EMAIL") = lower(p_email)
                        or (p_cpf is not null and h."CD_CPF" = p_cpf)
                        or (p_passaporte is not null and h."CD_PASSAPORTE" = p_passaporte)))
$$;
revoke all on function pre_reserva_em_aberto(text, text, text) from public, anon, authenticated;
grant execute on function pre_reserva_em_aberto(text, text, text) to service_role;


-- ── SIT_DOCUMENTO: fotos dos documentos enviadas no cadastro ────────────
-- As imagens ficam no Storage do Supabase, no bucket PRIVADO "documentos"
-- (storage.sql), em documentos/<código da reserva>/<arquivo>. Aqui fica o
-- registro: de quem é, que documento, onde está. Só a equipe acessa (painel
-- do Supabase › Storage). LGPD: guardar só pelo tempo necessário.
create table "SIT_DOCUMENTO" (
  "ID_DOCUMENTO"   bigint generated always as identity,
  "ID_RESERVA"     bigint not null,
  "ID_HOSPEDE"     bigint,
  "NM_PESSOA"      text not null,                 -- titular ou acompanhante
  "TP_PESSOA"      text not null default 'TITULAR',
  "TP_LADO"        text not null default 'FRENTE',
  "DS_CAMINHO"     text not null,                 -- caminho no bucket "documentos"
  "DS_MIME"        text not null,
  "NO_BYTES"       int not null,
  "DT_CRIACAO"     timestamptz not null default now(),
  constraint "PK_SIT_DOCUMENTO" primary key ("ID_DOCUMENTO"),
  constraint "FK_SIT_DOCUMENTO_SIT_RESERVA" foreign key ("ID_RESERVA") references "SIT_RESERVA" ("ID_RESERVA") on delete cascade,
  constraint "FK_SIT_DOCUMENTO_SIT_HOSPEDE" foreign key ("ID_HOSPEDE") references "SIT_HOSPEDE" ("ID_HOSPEDE"),
  constraint "UQ_SIT_DOCUMENTO_CAMINHO" unique ("DS_CAMINHO"),
  constraint "CK_SIT_DOCUMENTO_TP_PESSOA" check ("TP_PESSOA" in ('TITULAR', 'ACOMPANHANTE')),
  constraint "CK_SIT_DOCUMENTO_TP_LADO" check ("TP_LADO" in ('FRENTE', 'VERSO')),
  constraint "CK_SIT_DOCUMENTO_MIME" check ("DS_MIME" in ('image/jpeg', 'image/png', 'image/webp')),
  constraint "CK_SIT_DOCUMENTO_TAMANHO" check ("NO_BYTES" between 1 and 5242880)
);
create index "IX_SIT_DOCUMENTO_ID_RESERVA" on "SIT_DOCUMENTO" ("ID_RESERVA");
alter table "SIT_DOCUMENTO" enable row level security;

-- Registra as fotos já gravadas no Storage pela função do site.
-- p_documentos: [{"pessoa": "Maria Souza", "tipo": "TITULAR", "lado": "FRENTE", "caminho": "...", "mime": "image/jpeg", "bytes": 123}]
create or replace function registrar_documentos(p_cd_reserva text, p_documentos jsonb)
returns int
language plpgsql
volatile
security definer
set search_path = "SE", extensions, pg_temp
as $$
declare v "SIT_RESERVA"%rowtype; n int;
begin
  select r.* into v from "SIT_RESERVA" r where r."CD_RESERVA" = p_cd_reserva;
  if not found then
    raise exception 'reserva_inexistente' using errcode = 'P0001';
  end if;
  insert into "SIT_DOCUMENTO" ("ID_RESERVA", "ID_HOSPEDE", "NM_PESSOA", "TP_PESSOA", "TP_LADO", "DS_CAMINHO", "DS_MIME", "NO_BYTES")
  select v."ID_RESERVA", case when d->>'tipo' = 'TITULAR' then v."ID_HOSPEDE" end, d->>'pessoa', d->>'tipo', d->>'lado',
         d->>'caminho', d->>'mime', (d->>'bytes')::int
  from jsonb_array_elements(coalesce(p_documentos, '[]')) d
  where (d->>'caminho') like p_cd_reserva || '/%';                 -- só aceita arquivos da pasta desta reserva
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function registrar_documentos(text, jsonb) from public, anon, authenticated;
grant execute on function registrar_documentos(text, jsonb) to service_role;


-- ── SIT_AUDITORIA: quem mudou o quê, quando e qual era o valor anterior ─
-- Preenchida sozinha por gatilhos nas tabelas de preço, regras e reservas,
-- inclusive quando a mudança é feita à mão no SQL Editor.
create table "SIT_AUDITORIA" (
  "ID_AUDITORIA"  bigint generated always as identity,
  "NM_TABELA"     text not null,
  "TP_OPERACAO"   text not null,                  -- INSERT, UPDATE ou DELETE
  "DS_ANTES"      jsonb,
  "DS_DEPOIS"     jsonb,
  "NM_USUARIO"    text not null,                  -- papel do banco que fez a mudança (postgres = SQL Editor, service_role = site)
  "DT_CRIACAO"    timestamptz not null default now(),
  constraint "PK_SIT_AUDITORIA" primary key ("ID_AUDITORIA")
);
create index "IX_SIT_AUDITORIA_TABELA" on "SIT_AUDITORIA" ("NM_TABELA", "DT_CRIACAO");
alter table "SIT_AUDITORIA" enable row level security;

create or replace function auditar()
returns trigger
language plpgsql
security definer
set search_path = "SE", extensions, pg_temp
as $$
begin
  insert into "SIT_AUDITORIA" ("NM_TABELA", "TP_OPERACAO", "DS_ANTES", "DS_DEPOIS", "NM_USUARIO")
  values (tg_table_name, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end,
          coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
                   nullif(current_setting('request.jwt.claim.role', true), ''), session_user::text));
  return coalesce(new, old);
end;
$$;
revoke all on function auditar() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['SIT_PROPRIEDADE', 'SIT_UNIDADE', 'SIT_TARIFA', 'SIT_AJUSTE_DIARIO', 'SIT_BLOQUEIO',
                           'SIT_RESERVA', 'SIT_PAGAMENTO', 'SIT_DOCUMENTO'] loop
    execute format('drop trigger if exists %I on %I', 'TG_' || t || '_AUDITORIA', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function auditar()',
                   'TG_' || t || '_AUDITORIA', t);
  end loop;
end $$;

-- nenhuma tabela do schema fica acessível ao visitante, mesmo as criadas depois
alter default privileges in schema "SE" revoke all on tables from anon, authenticated;
alter default privileges in schema "SE" revoke all on functions from public, anon, authenticated;

commit;
