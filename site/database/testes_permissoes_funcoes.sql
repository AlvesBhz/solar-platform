-- Permissões das funções (auditoria de segurança): quem não é administrador não executa nenhuma função prc_* (preços e
-- cadastros do site), e sem login só as consultas públicas do site funcionam. Roda num banco de TESTE (testar-pacotes.sh).
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = notice;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-0000000000b1', 'perm.gestor@exemplo.invalid') on conflict do nothing;
insert into "SE"."VST_USUARIO" ("ID_USUARIO", "NM_USUARIO", "CD_LOGIN", "TP_PERFIL", "SG_ATIVO")
values ('00000000-0000-4000-8000-0000000000b1', 'Gestor (permissões)', 'perm.gestor', 'GESTOR', true) on conflict do nothing;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', false);
set role authenticated;
do $$
declare f record; n int := 0; falhas text[] := '{}';
begin
  for f in select p.proname, p.pronargs from pg_proc p join pg_namespace s on s.oid = p.pronamespace
           where s.nspname = 'SE' and p.proname like 'prc\_%' and p.proname not in ('prc_auditar_autor', 'prc_exigir_admin')
             and has_function_privilege('authenticated', p.oid, 'execute') order by 1 loop
    n := n + 1;
    begin
      execute format('select "SE".%I(%s)', f.proname, array_to_string(array_fill('null'::text, array[f.pronargs]), ', '));
      falhas := falhas || f.proname;                                   -- executou sem ser administrador: falha
    exception when others then
      if sqlerrm not in ('perfil_sem_permissao', 'sem_permissao') then falhas := falhas || (f.proname || ': ' || sqlerrm); end if;
    end;
  end loop;
  if n < 10 then raise exception 'FALHOU: esperava ao menos 10 funções prc_*, achou %', n; end if;
  if cardinality(falhas) > 0 then raise exception 'FALHOU: funções prc_* executadas por gestor: %', falhas; end if;
  raise notice 'ok  % funções prc_* recusam quem não é administrador', n;
end $$;
reset role;

do $$
declare livres text[];
begin
  select array_agg(p.proname::text order by p.proname) into livres from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname = 'SE' and has_function_privilege('anon', p.oid, 'execute');
  if livres is distinct from array['consultar_disponibilidade', 'consultar_pacotes', 'consultar_precos', 'consultar_regras_hospedes', 'cpf_valido']::text[]
     and not (livres <@ array['consultar_disponibilidade', 'consultar_pacotes', 'consultar_precos', 'consultar_regras_hospedes', 'cpf_valido', 'criar_pre_reserva', 'confirmar_reserva']::text[]) then
    raise exception 'FALHOU: funções liberadas sem login fora do esperado: %', livres;
  end if;
  raise notice 'ok  sem login, só as consultas públicas do site: %', livres;
end $$;
select 'TODOS OS TESTES PASSARAM';
