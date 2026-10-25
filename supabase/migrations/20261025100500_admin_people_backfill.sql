-- =====================================================================
-- 20261025100500_admin_people_backfill.sql
--
-- Purpose
--   One-time backfill (D8) of the side rows for every existing student and
--   educator profile. Codes are issued in sign-up order. New sign-ups get
--   their rows lazily from the RPCs that need them.
--
-- Lead objects read
--   public.profiles (id, role, created_at). Nothing on lead tables is written.
--
-- Assumptions
--   * Every row starts "active" and unreviewed; the lead's single 'verified'
--     educator keeps reading as verified because verification is read from
--     educator_profiles.verification_status (D7).
--
-- ROLLBACK
--   delete from public.educator_admin_state where onboarded_via = 'self' and status_reason is null
--     and review_state is null and account_status = 'active';
--   delete from public.students where account_status = 'active' and blocked_at is null;
--   (or drop the tables; see 20261025100400)
-- =====================================================================
set search_path = public, extensions;

insert into public.students (id)
select p.id from public.profiles p
 where p.role = 'student'
 order by p.created_at, p.id
on conflict (id) do nothing;

insert into public.educator_admin_state (user_id)
select p.id from public.profiles p
 where p.role = 'educator'
 order by p.created_at, p.id
on conflict (user_id) do nothing;
