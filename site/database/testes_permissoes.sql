-- Executado como o papel "anon" (visitante do site), com as permissões padrão do Supabase.
\echo '── Permissões do visitante (anon)'
set search_path = "SE", extensions, public;
set role anon;
select 'ok  anon consulta disponibilidade: ' || count(*) || ' unidade(s)' from consultar_disponibilidade('2027-03-02','2027-03-04',2,0);
select 'ok  anon consulta preços do calendário: ' || count(*) || ' noite(s)' from consultar_precos('2027-03-01','2027-04-01',2,1,0);
-- no schema "SE" o visitante não tem nem permissão de leitura nas tabelas (além do RLS)
do $$ declare t text; n int; begin
  foreach t in array array['SIT_RESERVA', 'SIT_HOSPEDE', 'SIT_PAGAMENTO'] loop
    begin
      execute format('select count(*) from "SE".%I', t) into n;
      if n > 0 then raise exception 'FALHOU: anon leu % linha(s) de %', n, t; end if;
      raise notice 'ok  anon lê %: 0 linhas (RLS)', t;
    exception when insufficient_privilege then
      raise notice 'ok  anon não tem acesso a % (sem permissão no schema SE)', t;
    end;
  end loop;
end $$;
do $$ begin
  perform criar_pre_reserva('casa-do-mirante','2027-09-21','2027-09-23',2,0);
  raise exception 'FALHOU: anon conseguiu criar pré-reserva';
exception when insufficient_privilege then raise notice 'ok  anon não pode criar pré-reserva (só a Edge Function)';
end $$;
do $$ begin
  perform confirmar_reserva('SE-00000000','X','x@exemplo.invalid',null,'BR','52998224725');
  raise exception 'FALHOU: anon conseguiu confirmar reserva';
exception when insufficient_privilege then raise notice 'ok  anon não pode confirmar reserva (só a Edge Function)';
end $$;
do $$ begin
  perform * from calcular_estadia(1,'2027-08-10','2027-08-12',2,0);
  raise exception 'FALHOU: anon executou calcular_estadia';
exception when insufficient_privilege then raise notice 'ok  anon não executa a função interna calcular_estadia';
end $$;
do $$ begin
  insert into "SIT_RESERVA" ("ID_UNIDADE", "DT_CHECKIN", "DT_CHECKOUT", "QTDE_ADULTOS", "TP_STATUS", "VL_HOSPEDAGEM") values (1,'2027-08-10','2027-08-12',2,'CONFIRMADA',1);
  raise exception 'FALHOU: anon inseriu reserva';
exception when insufficient_privilege then raise notice 'ok  anon não grava reservas (RLS)';
end $$;
reset role;
