-- =====================================================================
-- SignVivo · 0006_signup_trigger_fix.sql
--
-- Fixes "Database error saving new user" during magic-link sign-in.
--
-- Root cause:
--   `handle_new_user()` was defined with `set search_path = public`.
--   Supabase installs pgcrypto in the `extensions` schema, not `public`,
--   so `gen_random_bytes(3)` inside the trigger fails with
--   "function gen_random_bytes(integer) does not exist". The exception
--   aborts the auth.users INSERT and Supabase Auth surfaces the generic
--   "Database error saving new user" to the client.
--
-- This migration:
--   1. Extends search_path to include `extensions`.
--   2. Wraps the body in EXCEPTION WHEN OTHERS so a future provisioning
--      bug never blocks sign-up — the user lands on /dashboard, sees a
--      "no workspace" hint, and can be backfilled by an admin.
--   3. Belt-and-suspenders: grants the auth admin role direct write
--      privilege on the three provisioning tables. Not strictly needed
--      while SECURITY DEFINER is in effect, but a known-good guard in
--      community-reported Supabase configurations.
--   4. Backfills profiles + workspaces for any user that signed in
--      between 0003 and this migration (i.e. the user who hit the bug).
-- =====================================================================

-- 1 + 2: reinstall the trigger function ------------------------------
create or replace function public.handle_new_user()

returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name   text;
  v_slug   text;
  v_ws_id  uuid;
  v_local  text;
  v_suffix text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, v_name)
  on conflict (id) do nothing;

  v_local := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]+', '-', 'g');
  v_local := nullif(trim(both '-' from v_local), '');
  if v_local is null then
    v_local := 'workspace';
  end if;

  v_suffix := substr(encode(gen_random_bytes(3), 'hex'), 1, 6);
  v_slug   := v_local || '-' || v_suffix;

  insert into public.workspaces (name, slug, created_by)
  values (v_name || '''s workspace', v_slug, new.id)
  returning id into v_ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws_id, new.id, 'owner');

  return new;
exception when others then
  -- Never block auth.users inserts. The user can sign in; the dashboard
  -- will detect the missing workspace and the backfill block below (or
  -- an admin) can repair it.
  raise warning 'handle_new_user failed for %: % (%)', new.email, sqlerrm, sqlstate;
  return new;
end;
$$;

-- The trigger itself was created in 0003 and points to the function
-- name. Reinstalling the function is enough; no need to drop/recreate
-- the trigger.

-- 3: defensive grants for the auth admin role ------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant usage on schema public to supabase_auth_admin';
    execute 'grant insert, select on public.profiles          to supabase_auth_admin';
    execute 'grant insert, select on public.workspaces        to supabase_auth_admin';
    execute 'grant insert, select on public.workspace_members to supabase_auth_admin';
  end if;
end $$;

-- 4: backfill any users created before this fix -----------------------
-- For every auth.users row that has NO matching profile, run the
-- provisioning logic manually. Safe to run multiple times (uses ON
-- CONFLICT and skips users that already have a workspace).
do $$
declare
  u         record;
  v_name    text;
  v_local   text;
  v_suffix  text;
  v_slug    text;
  v_ws_id   uuid;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
      from auth.users au
      left join public.workspace_members m on m.user_id = au.id
     where m.user_id is null
  loop
    v_name := coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name',
      split_part(u.email, '@', 1)
    );

    insert into public.profiles (id, email, full_name)
    values (u.id, u.email, v_name)
    on conflict (id) do nothing;

    v_local := regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9]+', '-', 'g');
    v_local := nullif(trim(both '-' from v_local), '');
    if v_local is null then
      v_local := 'workspace';
    end if;
    v_suffix := substr(encode(extensions.gen_random_bytes(3), 'hex'), 1, 6);
    v_slug   := v_local || '-' || v_suffix;

    insert into public.workspaces (name, slug, created_by)
    values (v_name || '''s workspace', v_slug, u.id)
    returning id into v_ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_ws_id, u.id, 'owner')
    on conflict do nothing;
  end loop;
end $$;
