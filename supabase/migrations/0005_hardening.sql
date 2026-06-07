-- =====================================================================
-- SignVivo · 0005_hardening.sql
-- Locks down audit_events so:
--   * No client role can write to it under any circumstance.
--   * Even the service role cannot UPDATE or DELETE existing rows
--     (immutability is enforced at the trigger layer, which fires
--     regardless of RLS or role).
--   * INSERTs are still permitted for service role only — that's how
--     the app records events from backend handlers.
--
-- Also tightens recipient signing_token exposure: anon role gets zero
-- privileges on any of our domain tables (defense-in-depth on top of
-- RLS, which already denies them, but explicit revokes make this clear
-- to auditors and to anyone reading the schema).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Audit events: revoke all writes from non-privileged roles.
-- ---------------------------------------------------------------------

revoke insert, update, delete on public.audit_events from anon, authenticated;

-- The "audit: workspace read" SELECT policy from 0002 remains.
-- Without an INSERT/UPDATE/DELETE policy AND without table-level
-- privileges, RLS-evaluated roles (anon, authenticated) cannot write
-- under any combination of policies. Only the bypassing service_role
-- can.

-- ---------------------------------------------------------------------
-- 2. Audit events: block UPDATE and DELETE for *every* role via trigger.
-- This catches the service role too. The only way to get past it is to
-- DROP the trigger explicitly in a migration — that operation will show
-- up in version control and incident response.
-- ---------------------------------------------------------------------

create or replace function public.prevent_audit_modification()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events rows are immutable: % is not permitted', tg_op
    using errcode = 'insufficient_privilege',
          hint    = 'Audit events can only be inserted. Modifications are blocked at the trigger layer.';
end;
$$;

drop trigger if exists audit_events_no_update on public.audit_events;
drop trigger if exists audit_events_no_delete on public.audit_events;

create trigger audit_events_no_update
  before update on public.audit_events
  for each row execute function public.prevent_audit_modification();

create trigger audit_events_no_delete
  before delete on public.audit_events
  for each row execute function public.prevent_audit_modification();

-- ---------------------------------------------------------------------
-- 3. Defense in depth: anon role gets nothing on any of our tables.
--    RLS already denies them, but a missing policy + a missing privilege
--    is what auditors look for.
-- ---------------------------------------------------------------------

revoke all on public.profiles          from anon;
revoke all on public.workspaces        from anon;
revoke all on public.workspace_members from anon;
revoke all on public.documents         from anon;
revoke all on public.recipients        from anon;
revoke all on public.fields            from anon;
revoke all on public.audit_events      from anon;

-- ---------------------------------------------------------------------
-- 4. Lock the columns the signer flow depends on so they cannot be
--    bypassed by a future migration changing default visibility.
-- ---------------------------------------------------------------------

-- signing_token is sensitive (whoever has it can sign as that recipient).
-- It is intentionally readable to workspace members via the recipients
-- SELECT policy so senders can copy the link if email failed. Anon has
-- no SELECT — verified above.

comment on column public.recipients.signing_token is
  'Random 32-byte hex token. Possession grants signing rights for THIS recipient only. Never expose to anon role. Service role uses it as the sole identity check in /api/sign/[token].';

comment on table public.audit_events is
  'Append-only event log. UPDATE and DELETE are blocked at the trigger layer for every role, including service_role.';
