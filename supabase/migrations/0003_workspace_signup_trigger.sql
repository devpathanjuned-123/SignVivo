-- =====================================================================
-- SignVivo · 0003_workspace_signup_trigger.sql
-- When a user is created in auth.users:
--   1. create a row in public.profiles
--   2. create a personal workspace
--   3. add them as the owner of that workspace
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name       text;
  v_slug       text;
  v_ws_id      uuid;
  v_local      text;
  v_suffix     text;
begin
  -- Best-effort full name from auth metadata, falling back to email local-part.
  v_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, v_name)
  on conflict (id) do nothing;

  -- Build a unique workspace slug from the email local-part.
  v_local  := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9]+', '-', 'g');
  v_local  := nullif(trim(both '-' from v_local), '');
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
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper RPC: return the calling user's first workspace id.
-- Useful for the dashboard's "where am I?" lookup.
create or replace function public.my_default_workspace()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
    from public.workspace_members
   where user_id = auth.uid()
   order by created_at asc
   limit 1;
$$;

grant execute on function public.my_default_workspace() to authenticated;
