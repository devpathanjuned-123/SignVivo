-- =====================================================================
-- SignVivo · 0004_storage.sql
-- Private storage bucket `documents` with workspace-scoped RLS.
-- Paths are: {workspace_id}/{document_id}/{filename}
-- The first path segment (workspace_id) drives access control.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400,  -- 25 MB
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Drop pre-existing policies so this migration is idempotent.
drop policy if exists "documents bucket: workspace read"   on storage.objects;
drop policy if exists "documents bucket: workspace insert" on storage.objects;
drop policy if exists "documents bucket: workspace update" on storage.objects;
drop policy if exists "documents bucket: workspace delete" on storage.objects;

create policy "documents bucket: workspace read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "documents bucket: workspace insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "documents bucket: workspace update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'documents'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );

create policy "documents bucket: workspace delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member((storage.foldername(name))[1]::uuid)
  );
