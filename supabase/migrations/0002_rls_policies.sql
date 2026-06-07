-- =====================================================================
-- SignVivo · 0002_rls_policies.sql
-- Row-Level Security: every domain table is workspace-scoped.
-- Signers (anonymous) NEVER hit these policies — server signer routes
-- use the service role and validate signing_token in application code.
-- =====================================================================

-- Profiles -----------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own row"   on public.profiles;
drop policy if exists "profiles: insert own row" on public.profiles;
drop policy if exists "profiles: update own row" on public.profiles;

create policy "profiles: read own row"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles: insert own row"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles: update own row"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Workspaces ---------------------------------------------------------
alter table public.workspaces enable row level security;

drop policy if exists "workspaces: members select" on public.workspaces;
drop policy if exists "workspaces: owner update"   on public.workspaces;
drop policy if exists "workspaces: auth insert"    on public.workspaces;

create policy "workspaces: members select"
  on public.workspaces for select
  to authenticated
  using (public.is_workspace_member(id));

create policy "workspaces: auth insert"
  on public.workspaces for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "workspaces: owner update"
  on public.workspaces for update
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members m
       where m.workspace_id = id
         and m.user_id = auth.uid()
         and m.role in ('owner','admin')
    )
  );

-- Workspace members --------------------------------------------------
alter table public.workspace_members enable row level security;

drop policy if exists "members: read own memberships"   on public.workspace_members;
drop policy if exists "members: read same workspace"    on public.workspace_members;
drop policy if exists "members: owner insert"           on public.workspace_members;
drop policy if exists "members: owner update"           on public.workspace_members;
drop policy if exists "members: owner delete"           on public.workspace_members;

-- A user can see their own membership rows, and the membership rows of any
-- workspace they themselves belong to (for member-list UI).
create policy "members: read same workspace"
  on public.workspace_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id)
  );

create policy "members: owner insert"
  on public.workspace_members for insert
  to authenticated
  with check (
    exists (
      select 1 from public.workspace_members m
       where m.workspace_id = workspace_id
         and m.user_id = auth.uid()
         and m.role in ('owner','admin')
    )
  );

create policy "members: owner update"
  on public.workspace_members for update
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members m
       where m.workspace_id = workspace_members.workspace_id
         and m.user_id = auth.uid()
         and m.role in ('owner','admin')
    )
  );

create policy "members: owner delete"
  on public.workspace_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.workspace_members m
       where m.workspace_id = workspace_members.workspace_id
         and m.user_id = auth.uid()
         and m.role in ('owner','admin')
    )
  );

-- Documents ----------------------------------------------------------
alter table public.documents enable row level security;

drop policy if exists "documents: workspace read"   on public.documents;
drop policy if exists "documents: workspace insert" on public.documents;
drop policy if exists "documents: workspace update" on public.documents;
drop policy if exists "documents: workspace delete" on public.documents;

create policy "documents: workspace read"
  on public.documents for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "documents: workspace insert"
  on public.documents for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
  );

create policy "documents: workspace update"
  on public.documents for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "documents: workspace delete"
  on public.documents for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- Recipients (scoped through parent document) ------------------------
alter table public.recipients enable row level security;

drop policy if exists "recipients: workspace read"   on public.recipients;
drop policy if exists "recipients: workspace insert" on public.recipients;
drop policy if exists "recipients: workspace update" on public.recipients;
drop policy if exists "recipients: workspace delete" on public.recipients;

create policy "recipients: workspace read"
  on public.recipients for select
  to authenticated
  using (public.is_workspace_member(public.document_workspace(document_id)));

create policy "recipients: workspace insert"
  on public.recipients for insert
  to authenticated
  with check (public.is_workspace_member(public.document_workspace(document_id)));

create policy "recipients: workspace update"
  on public.recipients for update
  to authenticated
  using (public.is_workspace_member(public.document_workspace(document_id)))
  with check (public.is_workspace_member(public.document_workspace(document_id)));

create policy "recipients: workspace delete"
  on public.recipients for delete
  to authenticated
  using (public.is_workspace_member(public.document_workspace(document_id)));

-- Fields (scoped through parent document) ----------------------------
alter table public.fields enable row level security;

drop policy if exists "fields: workspace read"   on public.fields;
drop policy if exists "fields: workspace insert" on public.fields;
drop policy if exists "fields: workspace update" on public.fields;
drop policy if exists "fields: workspace delete" on public.fields;

create policy "fields: workspace read"
  on public.fields for select
  to authenticated
  using (public.is_workspace_member(public.document_workspace(document_id)));

create policy "fields: workspace insert"
  on public.fields for insert
  to authenticated
  with check (public.is_workspace_member(public.document_workspace(document_id)));

create policy "fields: workspace update"
  on public.fields for update
  to authenticated
  using (public.is_workspace_member(public.document_workspace(document_id)))
  with check (public.is_workspace_member(public.document_workspace(document_id)));

create policy "fields: workspace delete"
  on public.fields for delete
  to authenticated
  using (public.is_workspace_member(public.document_workspace(document_id)));

-- Audit events (workspace read; writes happen via service role) ------
alter table public.audit_events enable row level security;

drop policy if exists "audit: workspace read" on public.audit_events;

create policy "audit: workspace read"
  on public.audit_events for select
  to authenticated
  using (public.is_workspace_member(public.document_workspace(document_id)));

-- No INSERT/UPDATE/DELETE policies for authenticated role on audit_events.
-- All audit writes go through the service-role client in app server code,
-- which bypasses RLS by design.
