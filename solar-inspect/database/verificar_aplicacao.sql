-- Confere se a migração das vistorias está aplicada. SÓ LÊ: pode rodar no Supabase de produção, quantas vezes quiser.
-- Cada linha: o que foi conferido, o valor obtido, o esperado e se bateu. Tudo "true" na coluna ok = aplicada.
select item, obtido, esperado, obtido = esperado as ok from (
  select 1 as n, 'tabelas VST_ no schema "SE"' as item,
         (select count(*) from pg_class c join pg_namespace x on x.oid = c.relnamespace where x.nspname = 'SE' and c.relkind = 'r' and c.relname like 'VST\_%')::int as obtido, 12 as esperado
  union all select 2, 'tabelas VST_ sem RLS',
         (select count(*) from pg_class c join pg_namespace x on x.oid = c.relnamespace where x.nspname = 'SE' and c.relkind = 'r' and c.relname like 'VST\_%' and not c.relrowsecurity)::int, 0
  union all select 3, 'tabelas VST_ fora do schema "SE" ou em minúsculas',
         (select count(*) from pg_class c join pg_namespace x on x.oid = c.relnamespace where c.relkind = 'r' and upper(c.relname) like 'VST\_%' and (x.nspname <> 'SE' or c.relname <> upper(c.relname)))::int, 0
  union all select 4, 'funções vst_*',
         (select count(*) from pg_proc p join pg_namespace x on x.oid = p.pronamespace where x.nspname = 'SE' and p.proname like 'vst\_%')::int, 43
  union all select 5, 'funções vst_* executáveis por anon ou public',
         (select count(*) from pg_proc p join pg_namespace x on x.oid = p.pronamespace where x.nspname = 'SE' and p.proname like 'vst\_%'
            and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute')))::int, 0
  union all select 6, 'funções só do service_role (login, cadastro e senha provisória)',
         (select count(*) from pg_proc p join pg_namespace x on x.oid = p.pronamespace where x.nspname = 'SE' and p.proname like 'vst\_%'
            and has_function_privilege('service_role', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute'))::int, 3
  union all select 7, 'tabelas VST_ com algum direito para anon',
         (select count(*) from pg_class c join pg_namespace x on x.oid = c.relnamespace where x.nspname = 'SE' and c.relkind = 'r' and c.relname like 'VST\_%'
            and has_table_privilege('anon', c.oid, 'select,insert,update,delete'))::int, 0
  union all select 8, 'gatilhos de auditoria TG_<TABELA>_AUDITORIA',
         (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid where c.relname like 'VST\_%' and t.tgname = 'TG_' || c.relname || '_AUDITORIA' and not t.tgisinternal)::int, 12
  union all select 9, 'políticas RLS nas tabelas VST_',
         (select count(*) from pg_policies where schemaname = 'SE' and tablename like 'VST\_%')::int, 30
  union all select 10, 'tipos ENTRADA e SAIDA cadastrados',
         (select count(*) from "SE"."VST_TIPO_VISTORIA" where "CD_TIPO_VISTORIA" in ('ENTRADA', 'SAIDA'))::int, 2
  union all select 11, 'índice único UQ_VST_VISTORIA_RESERVA_TIPO',
         (select count(*) from pg_indexes where schemaname = 'SE' and indexname = 'UQ_VST_VISTORIA_RESERVA_TIPO')::int, 1
  union all select 12, 'perfis LIMPEZA e MANUTENCAO aceitos',
         (select count(*) from pg_constraint where conname = 'CK_VST_USUARIO_TP_PERFIL' and pg_get_constraintdef(oid) like '%LIMPEZA%' and pg_get_constraintdef(oid) like '%MANUTENCAO%')::int, 1
  union all select 16, 'coluna DS_PERFIS (quem faz cada tipo de vistoria)',
         (select count(*) from information_schema.columns where table_schema = 'SE' and table_name = 'VST_TIPO_VISTORIA' and column_name = 'DS_PERFIS')::int, 1
  union all select 17, 'coluna SG_TROCAR_SENHA (senha provisória exige troca)',
         (select count(*) from information_schema.columns where table_schema = 'SE' and table_name = 'VST_USUARIO' and column_name = 'SG_TROCAR_SENHA')::int, 1
  union all select 13, 'chalés do site sem linha de configuração VST_UNIDADE',
         (select count(*) from "SE"."SIT_UNIDADE" u where not exists (select 1 from "SE"."VST_UNIDADE" v where v."ID_UNIDADE" = u."ID_UNIDADE"))::int, 0
  union all select 14, 'bucket vistorias privado (5 MB, JPEG/PNG/WEBP)',
         (select count(*) from storage.buckets where id = 'vistorias' and not public and file_size_limit = 5242880
            and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'])::int, 1
  union all select 15, 'políticas de Storage do bucket vistorias',
         (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname in ('vistorias_leitura', 'vistorias_envio'))::int, 2
) v order by n;
