-- Extrai tabelas, campos, FKs e regras do schema "SE" em JSON (entrada do gerar_der.py).
-- Uso: psql -At -f exportar_estrutura.sql > schema.json
with cols as (
  select c.table_name t, c.ordinal_position o, upper(c.column_name) n,
         case when c.data_type in ('character varying','text') then 'text'
              when c.data_type='character' then 'char('||c.character_maximum_length||')'
              when c.data_type='timestamp with time zone' then 'timestamptz'
              when c.data_type='time without time zone' then 'time'
              when c.data_type='numeric' then 'numeric('||c.numeric_precision||','||c.numeric_scale||')'
              else c.data_type end ty,
         c.is_nullable='NO' req, c.is_generated='ALWAYS' gen, c.is_identity='YES' ident
  from information_schema.columns c where c.table_schema='SE'),
pk as (select tc.table_name t, upper(k.column_name) n from information_schema.table_constraints tc join information_schema.key_column_usage k using (constraint_name, table_schema) where tc.constraint_type='PRIMARY KEY' and tc.table_schema='SE'),
fk as (select upper(cl.relname) t, upper(a.attname) n, upper(cf.relname) rt, upper(af.attname) rn, upper(co.conname) nm
  from pg_constraint co join pg_class cl on cl.oid=co.conrelid join pg_class cf on cf.oid=co.confrelid
  join pg_attribute a on a.attrelid=co.conrelid and a.attnum=co.conkey[1] join pg_attribute af on af.attrelid=co.confrelid and af.attnum=co.confkey[1]
  where co.contype='f' and cl.relnamespace='"SE"'::regnamespace),
ck as (select upper(cl.relname) t, upper(co.conname) nm, pg_get_constraintdef(co.oid) d from pg_constraint co join pg_class cl on cl.oid=co.conrelid where co.contype in ('c','x','u') and cl.relnamespace='"SE"'::regnamespace)
select json_build_object(
 'tables', (select json_agg(json_build_object('name', upper(t), 'cols', (select json_agg(json_build_object('n',n,'ty',ty,'req',req,'gen',gen,'ident',ident,
      'pk', exists(select 1 from pk where pk.t=c2.t and pk.n=c2.n),
      'fk', (select rt from fk where fk.t=upper(c2.t) and fk.n=c2.n limit 1)) order by o) from cols c2 where c2.t=x.t)) order by t) from (select distinct t from cols) x),
 'fks', (select json_agg(json_build_object('from',t,'col',n,'to',rt,'tocol',rn,'name',nm)) from fk),
 'rules', (select json_agg(json_build_object('t',t,'name',nm,'def',d)) from ck));
