-- =====================================================================
-- SignVivo · 0001_init_schema.sql
-- Core domain schema: workspaces, documents, recipients, fields, audit.
-- Auth users live in auth.users (Supabase Auth). We reference them by uuid.
-- =====================================================================

-- Extensions ---------------------------------------------------------
create extension if not exists "pgcrypto";       -- gen_random_uuid, gen_random_bytes
create extension if not exists "uuid-ossp";

-- Enums --------------------------------------------------------------
do $$ begin
  create type public.document_status as enum ('DRAFT', 'SENT', 'COMPLETED', 'VOIDED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.recipient_status as enum ('PENDING', 'VIEWED', 'SIGNED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.field_type as enum ('SIGNATURE', 'DATE', 'TEXT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.audit_event_type as enum (
    'CREATED', 'SENT', 'VIEWED', 'SIGNED', 'COMPLETED', 'DOWNLOADED', 'VOIDED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

-- Profiles -----------------------------------------------------------
-- Mirrors auth.users for app-side joins and to store a display name.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Workspaces ---------------------------------------------------------
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_by  uuid not null references auth.users(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.workspace_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);

-- Documents ----------------------------------------------------------
create table if not exists public.documents (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  created_by         uuid not null references auth.users(id) on delete restrict,
  title              text not null check (char_length(title) between 1 and 200),
  status             public.document_status not null default 'DRAFT',
  original_pdf_path  text not null,
  signed_pdf_path    text,
  audit_pdf_path     text,
  created_at         timestamptz not null default now(),
  sent_at            timestamptz,
  completed_at       timestamptz
);

create index if not exists documents_workspace_idx on public.documents(workspace_id);
create index if not exists documents_status_idx    on public.documents(status);
create index if not exists documents_created_at_idx on public.documents(created_at desc);

-- Recipients ---------------------------------------------------------
create table if not exists public.recipients (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references public.documents(id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 120),
  email             text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  signing_token     text not null unique
                    default encode(gen_random_bytes(32), 'hex'),
  token_expires_at  timestamptz not null default (now() + interval '30 days'),
  ord               integer not null default 0,
  status            public.recipient_status not null default 'PENDING',
  viewed_at         timestamptz,
  signed_at         timestamptz
);

create index if not exists recipients_document_idx on public.recipients(document_id);
create index if not exists recipients_token_idx    on public.recipients(signing_token);

-- Fields -------------------------------------------------------------
create table if not exists public.fields (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  recipient_id uuid not null references public.recipients(id) on delete cascade,
  type         public.field_type not null,
  page         integer not null check (page >= 1),
  x_pct        double precision not null check (x_pct between 0 and 100),
  y_pct        double precision not null check (y_pct between 0 and 100),
  width_pct    double precision not null check (width_pct  between 0.1 and 100),
  height_pct   double precision not null check (height_pct between 0.1 and 100),
  value        text
);

create index if not exists fields_document_idx  on public.fields(document_id);
create index if not exists fields_recipient_idx on public.fields(recipient_id);

-- Audit events -------------------------------------------------------
create table if not exists public.audit_events (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  recipient_id uuid references public.recipients(id) on delete set null,
  type         public.audit_event_type not null,
  ip           inet,
  user_agent   text,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists audit_events_document_idx on public.audit_events(document_id);
create index if not exists audit_events_type_idx     on public.audit_events(type);

-- Helper: is the current auth user a member of this workspace? -------
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.workspace_members m
     where m.workspace_id = ws
       and m.user_id = auth.uid()
  );
$$;

grant execute on function public.is_workspace_member(uuid) to authenticated;

-- Helper: lookup a document's workspace (used by recipient/field RLS)
create or replace function public.document_workspace(doc uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from public.documents where id = doc;
$$;

grant execute on function public.document_workspace(uuid) to authenticated;
