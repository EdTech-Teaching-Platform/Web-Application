-- =====================================================================
-- 20261025120800_admin_cron.sql
--
-- Purpose
--   pg_cron jobs for the admin port. Safe to run twice: each job is
--   unscheduled by name (only if it exists) and scheduled again.
--     adm_release_scheduled_series     */5 * * * *  release_scheduled_series()      (required: scheduled go-live, Batch 2)
--     adm_dispatch_due_notifications   * * * * *    dispatch_due_notifications()    (scheduled campaigns)
--     adm_detect_repeated_questions    0 2 * * *    adm_detect_repeated_questions() (repeated-question scan)
--     adm_purge_expired_report_results 30 2 * * *   purge_expired_report_results()  (report snapshots > 7 days)
--     adm_purge_old_admin_auth_events  0 3 * * *    purge_old_admin_auth_events()   (auth events > 180 days)
--
-- Lead objects read / written
--   cron.job: reads; unschedules / schedules ONLY the five job names above
--   (all prefixed adm_). No other job is looked at or changed.
--
-- Assumptions
--   * The pg_cron extension is already enabled (the Batch 3 preflight
--     aborts otherwise). This file does not create extensions.
--   * Times are in pg_cron's time zone (cron.timezone, GMT by default on
--     Supabase): 02:00 / 02:30 / 03:00 GMT = 07:30 / 08:00 / 08:30 IST.
--   * Jobs run as the migration role (postgres), which holds execute on
--     every function scheduled here; the functions have no admin check.
--
-- ROLLBACK
--   select cron.unschedule(j.jobid) from cron.job j
--    where j.jobname in ('adm_release_scheduled_series', 'adm_dispatch_due_notifications',
--                        'adm_detect_repeated_questions', 'adm_purge_expired_report_results',
--                        'adm_purge_old_admin_auth_events');
-- =====================================================================
set search_path = public, extensions;

do $$
declare
  r record;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'Admin port cron: the pg_cron extension is not enabled. Enable it (with the lead''s approval), then re-run.'
      using errcode = 'P0001';
  end if;

  for r in
    select * from (values
      ('adm_release_scheduled_series',     '*/5 * * * *', 'select public.release_scheduled_series()'),
      ('adm_dispatch_due_notifications',   '* * * * *',   'select public.dispatch_due_notifications()'),
      ('adm_detect_repeated_questions',    '0 2 * * *',   'select public.adm_detect_repeated_questions()'),
      ('adm_purge_expired_report_results', '30 2 * * *',  'select public.purge_expired_report_results()'),
      ('adm_purge_old_admin_auth_events',  '0 3 * * *',   'select public.purge_old_admin_auth_events()')
    ) as t(jobname, schedule, command)
  loop
    perform cron.unschedule(j.jobid) from cron.job j where j.jobname = r.jobname;
    perform cron.schedule(r.jobname, r.schedule, r.command);
  end loop;
end $$;
