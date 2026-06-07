# SignVivo on Supabase — Deployment Guide

This document walks through everything required to take SignVivo from
zero to a working Supabase + Vercel deployment.

> The app uses Supabase as the **single backend platform** — Postgres,
> Authentication, Storage, and Row-Level Security all live there. No
> Neon, no Vercel Blob, no NextAuth.

---

## 1. Create the Supabase project

1. Sign up / log in at https://supabase.com
2. **New project** → choose a name (e.g. `signvivo-dev`), a strong DB
   password, and a region close to your users.
3. Wait for the project to provision (~2 minutes).
4. From the project dashboard collect:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
     *(Settings → API → Project API keys)*

> The service-role key bypasses RLS. **Never** check it into the repo or
> expose it to the browser. It is only used by Route Handlers running on
> the server.

---

## 2. Run the SQL migrations

The migrations live in [supabase/migrations/](supabase/migrations/) and
must be applied **in numeric order**.

### Option A — Supabase SQL Editor (fastest for first deploy)

1. Open the project → **SQL Editor → New query**.
2. Paste the contents of each file in order, clicking **Run** after each:
   1. `0001_init_schema.sql` — tables, enums, indexes, helper functions.
   2. `0002_rls_policies.sql` — RLS on every domain table.
   3. `0003_workspace_signup_trigger.sql` — auto-create workspace on signup.
   4. `0004_storage.sql` — `documents` bucket + storage RLS.
   5. `0005_hardening.sql` — audit immutability triggers + privilege revokes.
3. Verify the **Table editor** now shows `profiles`, `workspaces`,
   `workspace_members`, `documents`, `recipients`, `fields`,
   `audit_events`.

### Option B — Supabase CLI

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

The CLI applies every file under `supabase/migrations/` in alphabetical
order (which matches the numeric prefix).

### Verify

In the SQL editor run:

```sql
select table_name from information_schema.tables
 where table_schema = 'public' order by table_name;

select policyname, tablename from pg_policies
 where schemaname = 'public' order by tablename, policyname;
```

You should see all 7 tables and ~25 policies.

---

## 3. Configure Auth

1. **Authentication → Providers**: confirm **Email** is enabled (it is
   by default). No password is needed — we use magic links only.
2. **Authentication → URL configuration**:
   - **Site URL**: `http://localhost:3000` for dev, your prod URL later.
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` and
     your prod equivalent (e.g. `https://signvivo.example.com/auth/callback`).
3. (Optional) **Authentication → Email Templates → Magic Link**:
   customize the "{{ .ConfirmationURL }}" mail. The default works fine.

The signup trigger (migration `0003`) handles workspace creation
automatically — no extra config required.

---

## 4. (Optional) Configure custom email sender

Supabase Auth uses its own SMTP for magic-link delivery. SignVivo uses
[Resend](https://resend.com) for outbound **sign-request** and
**completion** emails to recipients.

1. Sign up at resend.com and create an API key → `RESEND_API_KEY`.
2. Verify a sending domain → set `EMAIL_FROM="SignVivo <noreply@yourdomain.com>"`.
3. (If `RESEND_API_KEY` is unset in dev, outgoing emails are logged to
   the server console instead of sent — handy when iterating locally.)

---

## 5. Configure the local app

```bash
cp .env.example .env.local
```

Fill in:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
RESEND_API_KEY=re_xxx               # optional in dev
EMAIL_FROM="SignVivo <noreply@yourdomain.com>"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then:

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

---

## 6. End-to-end test

1. Click **Get started** → enter your email → check inbox for magic
   link → click it.
2. You land on `/dashboard`. The signup trigger has created your
   workspace and added you as the owner.
3. **Upload PDF** — pick any PDF.
4. In the editor: add a recipient (name + email), click **Signature**,
   then click on the page to place a field. Add a **Date** field too.
5. Click **Send for signature**.
6. Open the recipient email's link in an incognito window.
7. Draw a signature, type the date, click **Finish signing**.
8. Back on the sender dashboard the document moves to **COMPLETED** and
   has links to the signed PDF + audit log.

---

## 7. Deploy to Vercel

1. Push the repo to GitHub.
2. **Vercel → New Project** → import the repo.
3. **Environment Variables** → add all six from `.env.example`. Set
   `NEXT_PUBLIC_APP_URL` to your production URL.
4. **Deploy**.
5. Back in Supabase **Authentication → URL configuration**, append your
   production callback to the redirect URL list.

That's it — no migrations need to run on Vercel; Supabase already holds
the schema.

---

## 8. Useful operational queries

```sql
-- Active documents per workspace
select w.name, count(d.id) as docs
  from public.workspaces w
  left join public.documents d on d.workspace_id = w.id
 group by w.id, w.name;

-- Slow signers: viewed > 24h ago but not signed
select r.email, r.viewed_at, d.title
  from public.recipients r
  join public.documents d on d.id = r.document_id
 where r.status = 'VIEWED'
   and r.viewed_at < now() - interval '1 day';

-- Full audit trail for a document
select type, created_at, ip, user_agent
  from public.audit_events
 where document_id = '...'
 order by created_at;
```

---

## 9. Reset / teardown

For dev only — wipe everything:

```sql
drop table if exists public.audit_events cascade;
drop table if exists public.fields cascade;
drop table if exists public.recipients cascade;
drop table if exists public.documents cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.profiles cascade;

drop type if exists public.document_status;
drop type if exists public.recipient_status;
drop type if exists public.field_type;
drop type if exists public.audit_event_type;
drop type if exists public.workspace_role;

drop function if exists public.handle_new_user();
drop function if exists public.is_workspace_member(uuid);
drop function if exists public.document_workspace(uuid);
drop function if exists public.my_default_workspace();

drop trigger if exists on_auth_user_created on auth.users;
```

Then storage:

```sql
delete from storage.objects where bucket_id = 'documents';
delete from storage.buckets where id = 'documents';
```

Re-run the migrations to start fresh.
