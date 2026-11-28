-- Auditoria de segurança e desempenho (28/11/2026): ajustes do banco apontados pelos avisos do Supabase.
-- Idempotente. Não muda dados.
begin;
-- chave estrangeira sem índice: documentos por hóspede (consulta e exclusão em cascata ficam rápidas)
create index if not exists "IX_SIT_DOCUMENTO_ID_HOSPEDE" on "SE"."SIT_DOCUMENTO" ("ID_HOSPEDE");
commit;
