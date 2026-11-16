-- Executado como o papel "anon" (visitante do site), com as permissões padrão do Supabase.
\echo '── Permissões do visitante (anon)'
set role anon;
select 'ok  anon consulta disponibilidade: ' || count(*) || ' unidade(s)' from consultar_disponibilidade('2027-03-02','2027-03-04',2,0);
select 'ok  anon lê reservas: ' || count(*) || ' linhas (RLS)' from reservas;
select 'ok  anon lê hóspedes: ' || count(*) || ' linhas (RLS)' from hospedes;
select 'ok  anon lê pagamentos: ' || count(*) || ' linhas (RLS)' from pagamentos;
do $$ begin
  perform criar_pre_reserva('chale-solar','2027-09-21','2027-09-23',2,0);
  raise exception 'FALHOU: anon conseguiu criar pré-reserva';
exception when insufficient_privilege then raise notice 'ok  anon não pode criar pré-reserva (só a Edge Function)';
end $$;
do $$ begin
  perform * from calcular_estadia(1,'2027-08-10','2027-08-12',2,0);
  raise exception 'FALHOU: anon executou calcular_estadia';
exception when insufficient_privilege then raise notice 'ok  anon não executa a função interna calcular_estadia';
end $$;
do $$ begin
  insert into reservas (unidade_id, periodo, adultos, status, valor_hospedagem) values (1,'[2027-08-10,2027-08-12)',2,'confirmada',1);
  raise exception 'FALHOU: anon inseriu reserva';
exception when insufficient_privilege then raise notice 'ok  anon não grava reservas (RLS)';
end $$;
reset role;
