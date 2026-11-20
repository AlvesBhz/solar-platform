-- Bucket PRIVADO para as fotos dos documentos dos hóspedes (rodar no Supabase depois do schema.sql).
-- Sem políticas de acesso: o visitante não lê nem grava nada; só a função do site (service_role)
-- grava, e a equipe vê pelo painel (Storage › documentos › <código da reserva>).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'documentos';
