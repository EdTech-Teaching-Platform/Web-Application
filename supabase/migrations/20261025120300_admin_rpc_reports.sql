-- =====================================================================
-- 20261025120300_admin_rpc_reports.sql
--
-- Purpose
--   Reports Builder RPCs (reportsApi.js), names and parameters as archived:
--     get_report_builder_options()                 -> {types, ranges}
--     get_report_filter_options(p_type)            -> {series, educators, subjects, grades}
--     generate_report(p_type, p_range, p_from, p_to, p_filters, p_preview)
--     get_report_run(p_run_id, p_page, p_size)
--     export_report_csv(p_run_id)                  -> {filename, content}
--     purge_expired_report_results()               -> cron only (postgres / service_role)
--   Report rows come from the lead's real tables and this port's tables:
--     enrollment   admin_series_enrollments + the lead's enrollments for series
--                  on a real course (same access model as adm_series_students)
--     test_series  adm_series_rows (test_series + test_series_admin + courses + categories)
--     educators    adm_educator_base (profiles + educator_profiles + educator_admin_state)
--                  + test_assignments
--     students     profiles + student_profiles + students + enrollments + admin_series_enrollments
--   Revenue columns (amount_paid_inr, revenue_inr, sales, earnings_inr,
--   total_spent_inr) are 0: there is no payments model (F4, D1).
--
-- Lead objects read
--   profiles, student_profiles, enrollments, test_series, courses, categories,
--   educator_profiles (through the adm_* read models). Nothing on lead tables
--   is written.
--
-- Assumptions
--   * Column keys are the report_types catalogue seeded in Batch 1
--     (20261025100200); the page renders them unchanged.
--   * A course enrolment gives access to every series on that course, so the
--     enrollment report has one row per (enrolment, series); enrollment_id
--     repeats when a course has several series.
--   * Snapshots expire after 7 days (report_runs.expires_at); the cron job in
--     20261025120700 clears them daily at 02:30.
--
-- ROLLBACK
--   drop function if exists public.purge_expired_report_results(), public.export_report_csv(uuid),
--     public.get_report_run(uuid, int, int), public.generate_report(text, text, date, date, jsonb, int),
--     public.get_report_filter_options(text), public.get_report_builder_options(),
--     public.adm_report_students(date, date, jsonb), public.adm_report_educators(date, date, jsonb),
--     public.adm_report_test_series(date, date, jsonb), public.adm_report_enrollment(date, date, jsonb);
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------------- per-type queries
create or replace function public.adm_report_enrollment(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public, extensions as $$
  with e as (
    select ase.id, ase.series_id, ase.student_id, ase.enrolled_at, ase.revoked_at is null as active
      from public.admin_series_enrollments ase
    union all
    select en.id, s.id, en.student_id, en.enrolled_at, en.is_active
      from public.test_series s
      join public.enrollments en on en.course_id = s.course_id
     where s.course_id is distinct from public.adm_house_course_id()
  ), ed as (
    select se.series_id, string_agg(distinct se.educator_name, ', ') as names, array_agg(se.educator_id) as ids
      from public.adm_series_educators() se group by se.series_id
  )
  select jsonb_build_object(
           'enrollment_id', e.id, 'student', p.full_name, 'email', p.email, 'test_series', r.title,
           'educator', ed.names,
           'enrolled_on', (e.enrolled_at at time zone 'Asia/Kolkata')::date,
           'status', case when e.active then 'active' else 'revoked' end,
           'amount_paid_inr', 0)
    from e
    join public.profiles p on p.id = e.student_id
    join public.adm_series_rows() r on r.id = e.series_id
    left join ed on ed.series_id = e.series_id
   where e.enrolled_at >= p_from::timestamp at time zone 'Asia/Kolkata'
     and e.enrolled_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
     and (p_f ->> 'series_id' is null or e.series_id = (p_f ->> 'series_id')::uuid)
     and (p_f ->> 'educator_id' is null or (p_f ->> 'educator_id')::uuid = any (coalesce(ed.ids, '{}')))
     and (p_f ->> 'status' is null or (case when e.active then 'active' else 'revoked' end) = p_f ->> 'status')
   order by e.enrolled_at desc;
$$;

create or replace function public.adm_report_test_series(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public, extensions as $$
  with ed as (
    select se.series_id, string_agg(distinct se.educator_name, ', ') as names, array_agg(se.educator_id) as ids
      from public.adm_series_educators() se group by se.series_id
  ), enr as (
    select st.series_id, count(distinct st.student_id) as n from public.adm_series_students() st group by st.series_id
  )
  select jsonb_build_object(
           'title', r.title, 'subject', r.subject_name, 'status', r.status, 'pricing', r.pricing,
           'price_inr', r.price_inr, 'educators', ed.names,
           'created_on', (r.created_at at time zone 'Asia/Kolkata')::date,
           'enrollments', coalesce(enr.n, 0), 'revenue_inr', 0)
    from public.adm_series_rows() r
    left join ed on ed.series_id = r.id
    left join enr on enr.series_id = r.id
   where r.created_at >= p_from::timestamp at time zone 'Asia/Kolkata'
     and r.created_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
     and (p_f ->> 'subject_id' is null or r.subject_category_id = (p_f ->> 'subject_id')::uuid)
     and (p_f ->> 'status' is null or r.status = p_f ->> 'status')
     and (p_f ->> 'pricing' is null or r.pricing = p_f ->> 'pricing')
     and (p_f ->> 'educator_id' is null or (p_f ->> 'educator_id')::uuid = any (coalesce(ed.ids, '{}')))
   order by r.created_at desc;
$$;

create or replace function public.adm_report_educators(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public, extensions as $$
  with b as (
    select x.*, case when x.verification_status in ('under_review', 'changes_requested') then 'pending'
                     else x.verification_status end as verification
      from public.adm_educator_base() x
  )
  select jsonb_build_object(
           'educator', b.full_name, 'email', b.email, 'verification_status', b.verification,
           'account_status', b.account_status, 'joined_on', (b.joined_at at time zone 'Asia/Kolkata')::date,
           'series_assigned', (select count(distinct a.series_id) from public.test_assignments a
                                where a.educator_id = b.id and a.status not in ('cancelled', 'rejected')),
           'sales', 0, 'earnings_inr', 0)
    from b
   where b.joined_at >= p_from::timestamp at time zone 'Asia/Kolkata'
     and b.joined_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
     and (p_f ->> 'verification_status' is null or b.verification = p_f ->> 'verification_status')
     and (p_f ->> 'account_status' is null or b.account_status = p_f ->> 'account_status')
   order by b.joined_at desc;
$$;

create or replace function public.adm_report_students(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public, extensions as $$
  with s as (
    select p.id, p.full_name, p.email, sp.grade, coalesce(st.account_status, 'active') as acct, p.created_at,
           (select count(*) from public.enrollments en where en.student_id = p.id)
           + (select count(*) from public.admin_series_enrollments ase where ase.student_id = p.id) as enr
      from public.profiles p
      left join public.student_profiles sp on sp.user_id = p.id
      left join public.students st on st.id = p.id
     where p.role = 'student'
       and p.created_at >= p_from::timestamp at time zone 'Asia/Kolkata'
       and p.created_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
       and (p_f ->> 'grade' is null or sp.grade = p_f ->> 'grade')
       and (p_f ->> 'account_status' is null or coalesce(st.account_status, 'active') = p_f ->> 'account_status')
  )
  select jsonb_build_object('student', s.full_name, 'email', s.email, 'grade', s.grade, 'account_status', s.acct,
                            'registered_on', (s.created_at at time zone 'Asia/Kolkata')::date,
                            'enrollments', s.enr, 'total_spent_inr', 0)
    from s
   where p_f ->> 'has_enrollment' is null
      or (p_f ->> 'has_enrollment' = 'yes' and s.enr > 0)
      or (p_f ->> 'has_enrollment' = 'no' and s.enr = 0)
   order by s.created_at desc;
$$;

-- ------------------------------------------------------------ builder RPCs
create or replace function public.get_report_builder_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'types', coalesce((select jsonb_agg(jsonb_build_object('key', t.key, 'label', t.label, 'description', t.description,
                                                           'date_label', t.date_label, 'columns', t.columns,
                                                           'filters', t.filters) order by t.sort_order)
                         from public.report_types t where t.is_active), '[]'::jsonb),
    'ranges', public.adm_range_options());
end $$;

-- Fills the data-sourced "select" filters: {series, educators, subjects, grades} of {value, label}.
create or replace function public.get_report_filter_options(p_type text default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'series',    coalesce((select jsonb_agg(jsonb_build_object('value', r.id, 'label', r.title) order by r.title)
                             from public.adm_series_rows() r), '[]'::jsonb),
    'educators', coalesce((select jsonb_agg(jsonb_build_object('value', b.id, 'label', b.full_name) order by b.full_name)
                             from public.adm_educator_base() b), '[]'::jsonb),
    'subjects',  coalesce((select jsonb_agg(jsonb_build_object('value', c.id, 'label', c.name) order by c.name)
                             from public.categories c where c.is_active), '[]'::jsonb),
    'grades',    coalesce((select jsonb_agg(jsonb_build_object('value', g, 'label', g) order by g)
                             from (select distinct sp.grade as g from public.student_profiles sp
                                     join public.profiles p on p.id = sp.user_id and p.role = 'student'
                                    where nullif(btrim(sp.grade), '') is not null) x), '[]'::jsonb));
end $$;

create or replace function public.generate_report(
  p_type text, p_range text, p_from date default null, p_to date default null,
  p_filters jsonb default '{}'::jsonb, p_preview int default 100
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  t      public.report_types;
  v_from date;
  v_to   date;
  v_run  uuid;
  v_rows jsonb;
  v_n    int;
  v_f    jsonb;
begin
  perform public.adm_require_admin();
  select * into t from public.report_types where key = p_type and is_active;
  if not found then raise exception 'Select a report type.' using errcode = '22023'; end if;
  if p_range is null or p_range in ('', 'none') then raise exception 'Select a date range.' using errcode = '22023'; end if;
  select d_from, d_to into v_from, v_to from public.adm_resolve_date_range(p_range, p_from, p_to);
  if v_from > v_to then raise exception 'Start date must be on or before the end date.' using errcode = '22023'; end if;

  -- blank filters mean "All"
  select coalesce(jsonb_object_agg(f.k, f.v), '{}'::jsonb) into v_f
    from jsonb_each(case when jsonb_typeof(p_filters) = 'object' then p_filters else '{}'::jsonb end) as f(k, v)
   where f.v <> 'null'::jsonb and f.v <> '""'::jsonb and f.v <> '"all"'::jsonb;

  insert into public.report_runs (report_type, range_key, date_from, date_to, filters, status, requested_by)
  values (p_type, p_range, v_from, v_to, v_f, 'running', auth.uid())
  returning id into v_run;

  begin
    select coalesce(jsonb_agg(x.r), '[]'::jsonb), count(*) into v_rows, v_n
      from (select u.r from (
              select r from public.adm_report_enrollment(v_from, v_to, v_f) r  where p_type = 'enrollment'
              union all
              select r from public.adm_report_test_series(v_from, v_to, v_f) r where p_type = 'test_series'
              union all
              select r from public.adm_report_educators(v_from, v_to, v_f) r   where p_type = 'educators'
              union all
              select r from public.adm_report_students(v_from, v_to, v_f) r    where p_type = 'students'
            ) u limit 10001) x;
    if v_n > 10000 then
      raise exception 'More than 10,000 rows. Narrow the date range or add filters.' using errcode = '54000';
    end if;
    update public.report_runs set status = 'completed', row_count = v_n, result_rows = v_rows, generated_at = now()
     where id = v_run;
  exception when others then
    update public.report_runs set status = 'failed', error = sqlerrm where id = v_run;
    return jsonb_build_object('ok', false, 'run_id', v_run, 'error', sqlerrm);
  end;

  perform public.adm_audit('report.generate', 'report_run', v_run, null,
                           jsonb_build_object('type', p_type, 'range', p_range, 'rows', v_n), null);
  return jsonb_build_object(
    'ok', true, 'run_id', v_run, 'type', p_type, 'label', t.label,
    'range', jsonb_build_object('key', p_range, 'from', v_from, 'to', v_to),
    'filters', v_f, 'columns', t.columns, 'row_count', v_n, 'generated_at', now(),
    'rows', (select coalesce(jsonb_agg(a.e order by a.i), '[]'::jsonb)
               from jsonb_array_elements(v_rows) with ordinality as a(e, i)
              where a.i <= greatest(coalesce(p_preview, 100), 1)));
end $$;

create or replace function public.get_report_run(p_run_id uuid, p_page int default 1, p_size int default 50) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  r      public.report_runs;
  t      public.report_types;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_size, 50), 1), 500);
begin
  perform public.adm_require_admin();
  select * into r from public.report_runs where id = p_run_id;
  if not found then raise exception 'Report not found.' using errcode = 'P0002'; end if;
  if r.result_rows is null then raise exception 'This report has expired. Generate it again.' using errcode = '22023'; end if;
  select * into t from public.report_types where key = r.report_type;
  return jsonb_build_object(
    'run_id', r.id, 'type', r.report_type, 'label', t.label, 'status', r.status,
    'range', jsonb_build_object('key', r.range_key, 'from', r.date_from, 'to', r.date_to),
    'filters', r.filters, 'columns', t.columns, 'row_count', r.row_count, 'generated_at', r.generated_at,
    'rows', (select coalesce(jsonb_agg(a.e order by a.i), '[]'::jsonb)
               from jsonb_array_elements(r.result_rows) with ordinality as a(e, i)
              where a.i > (v_page - 1) * v_size and a.i <= v_page * v_size));
end $$;

-- CSV with a BOM; cells starting with = + - @ are prefixed with ' (formula guard).
create or replace function public.export_report_csv(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  r      public.report_runs;
  t      public.report_types;
  v_head text;
  v_body text;
begin
  perform public.adm_require_admin();
  select * into r from public.report_runs where id = p_run_id and status = 'completed';
  if not found then raise exception 'Generate a report first.' using errcode = 'P0002'; end if;
  if r.result_rows is null then raise exception 'This report has expired. Generate it again.' using errcode = '22023'; end if;
  select * into t from public.report_types where key = r.report_type;

  select string_agg('"' || replace(cc.c ->> 'label', '"', '""') || '"', ',' order by cc.o) into v_head
    from jsonb_array_elements(t.columns) with ordinality as cc(c, o);
  select coalesce(string_agg(z.line, E'\n' order by z.ord), '') into v_body
    from (select rr.ord,
                 (select string_agg('"' || replace(
                           case when coalesce(rr.r ->> (cc.c ->> 'key'), '') ~ '^[=+\-@]'
                                then '''' || (rr.r ->> (cc.c ->> 'key')) else coalesce(rr.r ->> (cc.c ->> 'key'), '') end,
                           '"', '""') || '"', ',' order by cc.o)
                    from jsonb_array_elements(t.columns) with ordinality as cc(c, o)) as line
            from jsonb_array_elements(r.result_rows) with ordinality as rr(r, ord)) z;

  update public.report_runs set csv_downloads = csv_downloads + 1, last_exported_at = now() where id = p_run_id;
  perform public.log_export('reports_builder', jsonb_build_object('run_id', p_run_id, 'type', r.report_type), r.row_count);
  return jsonb_build_object(
    'filename', r.report_type || '-report-' || to_char(r.generated_at at time zone 'Asia/Kolkata', 'YYYYMMDD-HH24MI') || '.csv',
    'content', E'﻿' || v_head || E'\n' || v_body);
end $$;

-- Cron job (20261025120700, daily 02:30). No admin check: cron runs without a
-- user. Clears expired snapshots, keeps the run record.
create or replace function public.purge_expired_report_results() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  update public.report_runs set result_rows = null where result_rows is not null and expires_at < now();
  get diagnostics n = row_count;
  return n;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_report_enrollment(date, date, jsonb) from public, anon, authenticated;
revoke all on function public.adm_report_test_series(date, date, jsonb) from public, anon, authenticated;
revoke all on function public.adm_report_educators(date, date, jsonb) from public, anon, authenticated;
revoke all on function public.adm_report_students(date, date, jsonb) from public, anon, authenticated;

revoke all on function public.get_report_builder_options() from public, anon;
revoke all on function public.get_report_filter_options(text) from public, anon;
revoke all on function public.generate_report(text, text, date, date, jsonb, int) from public, anon;
revoke all on function public.get_report_run(uuid, int, int) from public, anon;
revoke all on function public.export_report_csv(uuid) from public, anon;

grant execute on function public.get_report_builder_options() to authenticated;
grant execute on function public.get_report_filter_options(text) to authenticated;
grant execute on function public.generate_report(text, text, date, date, jsonb, int) to authenticated;
grant execute on function public.get_report_run(uuid, int, int) to authenticated;
grant execute on function public.export_report_csv(uuid) to authenticated;

revoke all on function public.purge_expired_report_results() from public, anon, authenticated;
grant execute on function public.purge_expired_report_results() to postgres, service_role;
