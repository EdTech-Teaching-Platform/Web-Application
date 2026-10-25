-- =====================================================================
-- 20261025120700_admin_maintenance.sql
--
-- Purpose
--   Housekeeping for this port's own tables, run by cron (20261025120800):
--     purge_old_admin_auth_events() -> int
--       deletes admin_auth_events older than 180 days and user_sessions that
--       ended more than 90 days ago (same windows as the archived
--       purge_old_auth_events).
--
-- Lead objects read / written
--   None (admin_auth_events and user_sessions are this port's tables).
--
-- Assumptions
--   * No admin check: cron runs without a user. Execute is granted to
--     postgres and service_role only.
--
-- ROLLBACK
--   drop function if exists public.purge_old_admin_auth_events();   -- unschedule the cron job first
-- =====================================================================
set search_path = public, extensions;

create or replace function public.purge_old_admin_auth_events() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  delete from public.admin_auth_events where created_at < now() - interval '180 days';
  get diagnostics n = row_count;
  delete from public.user_sessions where ended_at is not null and ended_at < now() - interval '90 days';
  return n;
end $$;

revoke all on function public.purge_old_admin_auth_events() from public, anon, authenticated;
grant execute on function public.purge_old_admin_auth_events() to postgres, service_role;
