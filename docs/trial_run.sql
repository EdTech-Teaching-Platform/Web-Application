begin;
-- =====================================================================
-- 20261025100000_admin_preflight.sql
--
-- Purpose
--   Read-only assertions that run before any admin-port object is created
--   (Batch 1). The run aborts if the live database differs from what the
--   port assumes. This file creates nothing and changes no data.
--
-- Lead objects read
--   information_schema.columns, pg_constraint / pg_class / pg_namespace,
--   pg_proc, public.profiles (count of admin rows only).
--
-- Assumptions
--   * CHECK definitions are compared byte-for-byte with the output of
--     pg_get_constraintdef() recorded in docs/db_inspection/constraints.csv.
--   * Later batches add their own preflight file (run before that batch's
--     objects) for the names they create.
--
-- ROLLBACK
--   Nothing to roll back: no DDL, no data changes.
-- =====================================================================
set search_path = public, extensions;

-- 1. Lead tables and columns the port reads or writes ---------------------
do $$
declare
  v_missing text[] := '{}';
  r record;
begin
  for r in
    select * from (values
      ('profiles','id'), ('profiles','role'), ('profiles','full_name'), ('profiles','email'),
      ('profiles','phone'), ('profiles','location'), ('profiles','created_at'), ('profiles','avatar_url'),
      ('student_profiles','user_id'), ('student_profiles','grade'), ('student_profiles','school_name'),
      ('educator_profiles','user_id'), ('educator_profiles','full_name'), ('educator_profiles','phone'),
      ('educator_profiles','location'), ('educator_profiles','verification_status'), ('educator_profiles','created_at'),
      ('educator_profiles','bio'), ('educator_profiles','photo_url'), ('educator_profiles','qualifications'),
      ('educator_profiles','experience_years'), ('educator_profiles','subjects'), ('educator_profiles','languages'),
      ('educator_profiles','rejected_reason'), ('educator_profiles','verified_at'), ('educator_profiles','verified_by'),
      ('educator_profiles','rating_avg'), ('educator_profiles','total_students'), ('educator_profiles','total_courses'),
      ('educator_verification_docs','id'), ('educator_verification_docs','educator_id'),
      ('educator_verification_docs','doc_type'), ('educator_verification_docs','doc_url'),
      ('educator_verification_docs','doc_name'), ('educator_verification_docs','is_verified'),
      ('educator_verification_docs','verified_at'), ('educator_verification_docs','created_at'),
      ('institutions','id'), ('institutions','name'), ('institutions','city'), ('institutions','state'),
      ('institutions','is_active'),
      ('callback_requests','id'), ('callback_requests','name'), ('callback_requests','email'),
      ('callback_requests','phone'), ('callback_requests','message'), ('callback_requests','source'),
      ('callback_requests','status'), ('callback_requests','created_at'),
      ('platform_settings','key'), ('platform_settings','value'), ('platform_settings','description'),
      ('platform_settings','updated_by'), ('platform_settings','updated_at'),
      ('audit_logs','id'), ('audit_logs','actor_id'), ('audit_logs','actor_role'), ('audit_logs','action'),
      ('audit_logs','target_type'), ('audit_logs','target_id'), ('audit_logs','before_state'),
      ('audit_logs','after_state'), ('audit_logs','reason'), ('audit_logs','created_at'),
      ('courses','id'), ('courses','educator_id'), ('courses','category_id'), ('courses','title'),
      ('courses','slug'), ('courses','status'), ('courses','created_at'),
      ('enrollments','id'), ('enrollments','student_id'), ('enrollments','course_id'),
      ('enrollments','enrolled_at'), ('enrollments','completed_at'), ('enrollments','is_active'),
      ('lessons','id'), ('lessons','course_id'),
      ('lesson_progress','student_id'), ('lesson_progress','course_id'), ('lesson_progress','status'),
      ('course_reviews','course_id'), ('course_reviews','rating'), ('course_reviews','is_visible'),
      ('categories','id'), ('categories','name'),
      ('test_series','id'), ('test_series','course_id'), ('test_series','title'), ('test_series','is_active'),
      ('test_series','is_published'), ('test_series','created_at'),
      ('quizzes','id'), ('quizzes','series_id'), ('quizzes','course_id'),
      ('quiz_attempts','id'), ('quiz_attempts','quiz_id'), ('quiz_attempts','student_id'),
      ('quiz_attempts','percentage'), ('quiz_attempts','status'),
      ('moderation_reports','status'), ('support_tickets','status')
    ) as t(tbl, col)
  loop
    if not exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col) then
      v_missing := v_missing || (r.tbl || '.' || r.col);
    end if;
  end loop;
  if cardinality(v_missing) > 0 then
    raise exception 'Admin port preflight: expected lead columns are missing: %', array_to_string(v_missing, ', ')
      using errcode = 'P0001';
  end if;
end $$;

-- 2. CHECK constraints must match the verified facts F1 / F5 / F6 / F7 ------
do $$
declare
  v_bad text[] := '{}';
  v_def text;
  r record;
begin
  for r in
    select * from (values
      ('profiles', 'profiles_role_check',
       'CHECK ((role = ANY (ARRAY[''student''::text, ''educator''::text, ''head_teacher''::text, ''regional_head''::text, ''admin''::text, ''super_admin''::text, ''parent''::text])))'),
      ('quiz_questions', 'quiz_questions_question_type_check',
       'CHECK ((question_type = ANY (ARRAY[''multiple_choice''::text, ''true_false''::text, ''fill_in_blank''::text, ''short_answer''::text])))'),
      ('quiz_attempts', 'quiz_attempts_status_check',
       'CHECK ((status = ANY (ARRAY[''in_progress''::text, ''submitted''::text, ''timed_out''::text, ''abandoned''::text])))'),
      ('quizzes', 'quizzes_show_answers_after_check',
       'CHECK ((show_answers_after = ANY (ARRAY[''submission''::text, ''passing''::text, ''never''::text])))'),
      ('notifications', 'notifications_category_check',
       'CHECK ((category = ANY (ARRAY[''course_update''::text, ''assignment_reminder''::text, ''assessment_result''::text, ''booking_confirmation''::text, ''booking_reminder''::text, ''payment''::text, ''refund''::text, ''payout''::text, ''verification''::text, ''moderation''::text, ''announcement''::text, ''broadcast''::text, ''certificate''::text, ''parent_report''::text, ''system''::text, ''support_ticket''::text])))'),
      ('callback_requests', 'callback_requests_status_check',
       'CHECK ((status = ANY (ARRAY[''new''::text, ''contacted''::text, ''closed''::text])))'),
      ('courses', 'courses_status_check',
       'CHECK ((status = ANY (ARRAY[''draft''::text, ''pending_review''::text, ''published''::text, ''archived''::text, ''rejected''::text])))'),
      ('educator_verification_docs', 'educator_verification_docs_doc_type_check',
       'CHECK ((doc_type = ANY (ARRAY[''government_id''::text, ''degree_certificate''::text, ''teaching_license''::text, ''experience_letter''::text, ''subject_certificate''::text, ''other''::text])))'),
      ('support_tickets', 'support_tickets_status_check',
       'CHECK ((status = ANY (ARRAY[''open''::text, ''in_progress''::text, ''waiting_on_user''::text, ''resolved''::text, ''closed''::text])))')
    ) as t(tbl, conname, expected)
  loop
    select pg_get_constraintdef(c.oid) into v_def
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = r.tbl and c.conname = r.conname;
    if v_def is distinct from r.expected then
      v_bad := v_bad || (r.tbl || '.' || r.conname || ' = ' || coalesce(v_def, '<missing>'));
    end if;
  end loop;
  if cardinality(v_bad) > 0 then
    raise exception 'Admin port preflight: CHECK constraints differ from the verified facts: %', array_to_string(v_bad, ' | ')
      using errcode = 'P0001';
  end if;
end $$;

-- 3. At least one admin account must exist (needed by later batches, D2) ----
do $$
begin
  if not exists (select 1 from public.profiles where role in ('admin', 'super_admin')) then
    raise exception 'Admin port preflight: no profile with role admin or super_admin exists. Create the first admin account (see README) with the lead''s approval, then re-run.'
      using errcode = 'P0001';
  end if;
end $$;

-- 4. Nothing this batch creates may already exist ---------------------------
do $$
declare
  v_taken text[] := '{}';
  v_name text;
  r record;
begin
  -- tables, views and sequences
  foreach v_name in array array[
    'regions', 'admin_nav_items', 'report_types',
    'students', 'student_block_history', 'educator_admin_state', 'educator_invites',
    'user_geo', 'admin_auth_events', 'user_sessions', 'admin_notes',
    'adm_student_code_seq', 'adm_educator_code_seq', 'adm_callback_code_seq'
  ] loop
    if to_regclass('public.' || v_name) is not null then
      v_taken := v_taken || v_name;
    end if;
  end loop;

  -- functions: every overload in public with one of these names (pg_proc +
  -- pg_namespace, not to_regproc), reported with its signature
  for r in
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = any (array[
    'adm_is_platform_admin', 'adm_require_admin', 'adm_is_service_role', 'adm_actor_role', 'adm_audit',
    'adm_touch_updated_at', 'adm_initials', 'adm_like', 'adm_current_session_id', 'adm_normalize_phone',
    'adm_phone_display', 'adm_resolve_date_range', 'adm_educator_verification_key',
    'adm_ensure_student', 'adm_ensure_educator_state', 'adm_is_account_blocked', 'adm_end_user_sessions',
    'adm_open_assignment_count', 'adm_cumulative_counts', 'adm_stat_card', 'adm_grade_matches',
    'adm_educator_base',
    'get_admin_me', 'record_login', 'record_logout', 'touch_session', 'get_admin_nav', 'global_search',
    'list_my_notes', 'add_admin_note', 'toggle_admin_note', 'update_admin_note', 'delete_admin_note',
    'clear_done_notes', 'get_admin_dashboard', 'get_dashboard_header', 'get_dashboard_stats',
    'get_dashboard_revenue', 'get_pending_educator_verifications', 'get_series_approvals',
    'get_top_series', 'get_students_by_region',
    'get_student_stats', 'list_students', 'get_student_detail', 'block_student', 'unblock_student',
    'list_educators', 'get_educator_stats', 'get_educator_detail', 'set_educator_verification',
    'set_educator_account_status', 'delete_educator', 'register_educator', 'create_educator_invites',
    'list_educator_documents', 'review_educator_document',
    'revoke_user_sessions', 'sign_out_other_devices', 'list_auth_events', 'list_active_sessions'
       ])
     order by 1
  loop
    v_taken := v_taken || ('function ' || r.sig);
  end loop;

  -- columns this batch adds to lead tables must not exist yet
  for r in
    select * from (values
      ('callback_requests','code'), ('callback_requests','organization'), ('callback_requests','assigned_to'),
      ('callback_requests','contacted_at'), ('callback_requests','contacted_by'), ('callback_requests','closed_at'),
      ('callback_requests','closed_by'), ('callback_requests','submitted_from'), ('callback_requests','ip_hash'),
      ('callback_requests','user_agent'), ('callback_requests','updated_at'),
      ('institutions','state_code'),
      ('educator_verification_docs','review_note'), ('educator_verification_docs','verified_by')
    ) as t(tbl, col)
  loop
    if exists (select 1 from information_schema.columns c
                where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col) then
      v_taken := v_taken || (r.tbl || '.' || r.col);
    end if;
  end loop;

  if cardinality(v_taken) > 0 then
    raise exception 'Admin port preflight: these names already exist and would be overwritten or reused: %', array_to_string(v_taken, ', ')
      using errcode = 'P0001';
  end if;
end $$;

-- =====================================================================
-- 20261025100100_admin_helpers.sql
--
-- Purpose
--   Internal adm_* helper functions and code sequences used by every admin
--   RPC. None of these names exist in the lead's database (proved by the
--   preflight). The lead's is_admin() is neither replaced nor called (D5).
--
-- Lead objects read
--   public.profiles (id, role, full_name), public.audit_logs (insert only,
--   through adm_audit).
--
-- Assumptions
--   * auth.uid() and auth.jwt() exist (standard Supabase).
--   * The PostgREST JWT role is readable from request.jwt.claims.
--
-- ROLLBACK
--   drop function if exists public.adm_resolve_date_range(text, date, date);
--   drop function if exists public.adm_phone_display(text);
--   drop function if exists public.adm_normalize_phone(text);
--   drop function if exists public.adm_current_session_id();
--   drop function if exists public.adm_like(text);
--   drop function if exists public.adm_initials(text);
--   drop function if exists public.adm_educator_verification_key(text, text);
--   drop function if exists public.adm_touch_updated_at();
--   drop function if exists public.adm_audit(text, text, uuid, jsonb, jsonb, text);
--   drop function if exists public.adm_actor_role();
--   drop function if exists public.adm_is_service_role();
--   drop function if exists public.adm_require_admin();
--   drop function if exists public.adm_is_platform_admin();
--   drop sequence if exists public.adm_callback_code_seq;
--   drop sequence if exists public.adm_educator_code_seq;
--   drop sequence if exists public.adm_student_code_seq;
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- sequences
create sequence if not exists public.adm_student_code_seq start 2001;    -- STU-2001
create sequence if not exists public.adm_educator_code_seq start 1001;   -- EDU-1001
create sequence if not exists public.adm_callback_code_seq start 1001;   -- CB-1001

-- ------------------------------------------------------------ access checks
-- D5: platform admin = admin or super_admin. Own function; the lead's
-- is_admin() is never replaced or relied on.
create or replace function public.adm_is_platform_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin'));
$$;

create or replace function public.adm_require_admin() returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.adm_is_platform_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
end $$;

-- True when the request was made with the service-role key (Edge Functions).
create or replace function public.adm_is_service_role() returns boolean
language sql stable set search_path = public, extensions as $$
  select coalesce(
    coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
             nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role',
    false);
$$;

create or replace function public.adm_actor_role() returns text
language sql stable security definer set search_path = public, extensions as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ------------------------------------------------------------- audit trail
-- Business actions go to the lead's audit_logs (D9). actor_id and actor_role
-- are NOT NULL there, so calls without a signed-in profile (service role)
-- are skipped rather than failing the action.
create or replace function public.adm_audit(
  p_action text, p_target_type text, p_target_id uuid,
  p_before jsonb default null, p_after jsonb default null, p_reason text default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_role text;
begin
  if auth.uid() is null then return; end if;
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then return; end if;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, before_state, after_state, reason)
  values (auth.uid(), v_role, p_action, p_target_type, p_target_id, p_before, p_after, p_reason);
end $$;

-- ------------------------------------------------------------ small helpers
create or replace function public.adm_touch_updated_at() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- D7: the lead stores only pending / verified / rejected; finer states live
-- in educator_admin_state.review_state. Returns the key the UI expects
-- (src/portals/admin/utils/statusMaps.js). Unknown lead values pass through.
create or replace function public.adm_educator_verification_key(p_lead text, p_review text) returns text
language sql immutable set search_path = public, extensions as $$
  select case
    when p_lead = 'verified' then 'verified'
    when p_lead = 'rejected' then 'rejected'
    when p_review in ('under_review', 'changes_requested') then p_review
    when p_lead is null or p_lead = 'pending' then 'pending'
    else p_lead
  end;
$$;

-- "Dr. Asha Rao" -> "AR"
create or replace function public.adm_initials(p_name text) returns text
language sql immutable set search_path = public, extensions as $$
  with n as (
    select regexp_split_to_array(btrim(regexp_replace(coalesce(p_name, ''), '^(dr|mr|mrs|ms|prof)\.?\s+', '', 'i')), '\s+') as a
  )
  select upper(left(a[1], 1) || case when array_length(a, 1) > 1 then left(a[array_length(a, 1)], 1) else '' end) from n;
$$;

-- Search text -> ILIKE pattern with %, _ and \ escaped; null when blank.
create or replace function public.adm_like(p_search text) returns text
language sql immutable set search_path = public, extensions as $$
  select case when nullif(btrim(coalesce(p_search, '')), '') is null then null
              else '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
$$;

-- session_id claim of the Supabase JWT (one per signed-in browser).
create or replace function public.adm_current_session_id() returns uuid
language sql stable set search_path = public, extensions as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

-- "98450 12233" / "+91 98450 12233" / "09845012233" -> "+919845012233"
create or replace function public.adm_normalize_phone(p text) returns text
language sql immutable set search_path = public, extensions as $$
  with d as (select regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g') as s)
  select case
    when s ~ '^\+[1-9][0-9]{7,14}$'      then s
    when s ~ '^(\+?91)?0?[6-9][0-9]{9}$' then '+91' || right(regexp_replace(s, '\D', '', 'g'), 10)
    else null end
  from d;
$$;

create or replace function public.adm_phone_display(p text) returns text
language sql immutable set search_path = public, extensions as $$
  select case when p ~ '^\+91[6-9][0-9]{9}$'
              then '+91 ' || substr(p, 4, 5) || ' ' || substr(p, 9, 5) else p end;
$$;

-- Date-range dropdown keys -> [from, to] in Asia/Kolkata.
create or replace function public.adm_resolve_date_range(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns table (d_from date, d_to date)
language sql stable set search_path = public, extensions as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d)
  select
    case p_range
      when 'last_7_days'  then d - 6
      when 'last_30_days' then d - 29
      when 'last_90_days' then d - 89
      when 'this_month'   then date_trunc('month', d)::date
      when 'last_month'   then (date_trunc('month', d) - interval '1 month')::date
      when 'this_year'    then date_trunc('year', d)::date
      when 'all_time'     then date '2000-01-01'
      when 'custom'       then coalesce(p_from, d - 29)
      else d - 29 end,
    case p_range
      when 'last_month'   then (date_trunc('month', d) - interval '1 day')::date
      when 'custom'       then coalesce(p_to, d)
      else d end
  from today;
$$;

-- ------------------------------------------------------------------ grants
-- Internal helpers are not callable from the browser. adm_is_platform_admin
-- stays callable by signed-in users (harmless, and usable in RLS policies on
-- this port's own tables).
revoke all on function public.adm_is_platform_admin() from public, anon;
grant execute on function public.adm_is_platform_admin() to authenticated;
revoke all on function public.adm_require_admin() from public, anon, authenticated;
revoke all on function public.adm_is_service_role() from public, anon, authenticated;
revoke all on function public.adm_actor_role() from public, anon, authenticated;
revoke all on function public.adm_audit(text, text, uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.adm_touch_updated_at() from public, anon, authenticated;
revoke all on function public.adm_educator_verification_key(text, text) from public, anon, authenticated;
revoke all on function public.adm_initials(text) from public, anon, authenticated;
revoke all on function public.adm_like(text) from public, anon, authenticated;
revoke all on function public.adm_current_session_id() from public, anon, authenticated;
revoke all on function public.adm_normalize_phone(text) from public, anon, authenticated;
revoke all on function public.adm_phone_display(text) from public, anon, authenticated;
revoke all on function public.adm_resolve_date_range(text, date, date) from public, anon, authenticated;
revoke all on sequence public.adm_student_code_seq, public.adm_educator_code_seq, public.adm_callback_code_seq
  from public, anon, authenticated;

-- =====================================================================
-- 20261025100200_admin_lookups.sql
--
-- Purpose
--   Lookup tables owned by the admin port: regions (Indian states/UTs),
--   admin_nav_items (sidebar badges, routes from src/portals/admin/routes.jsx)
--   and report_types (Reports Builder catalogue). Seeds the dashboard quote in
--   the lead's platform_settings without overwriting an existing value.
--
-- Lead objects read / written
--   public.platform_settings: one insert ... on conflict (key) do nothing.
--
-- Assumptions
--   * platform_settings.key is its primary key (existing_Schema.sql).
--   * All access to these tables goes through SECURITY DEFINER RPCs, so RLS
--     is enabled with no policies (deny-by-default for browser roles).
--
-- ROLLBACK
--   delete from public.platform_settings where key = 'dashboard_quote' and updated_by is null
--     and value = to_jsonb('Empowering educators. Enabling learners. Building brighter futures.'::text);
--   drop table if exists public.report_types;
--   drop table if exists public.admin_nav_items;
--   drop table if exists public.regions;   -- only after 0300 (institutions.state_code) and user_geo are gone
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------------------------ regions
create table if not exists public.regions (
  code          text primary key,                  -- 'MH'
  name          text not null unique,              -- 'Maharashtra'
  primary_city  text,
  sort_order    int  not null default 0,
  is_active     boolean not null default true
);

insert into public.regions (code, name, primary_city) values
 ('AP','Andhra Pradesh','Visakhapatnam'),('AR','Arunachal Pradesh','Itanagar'),('AS','Assam','Guwahati'),
 ('BR','Bihar','Patna'),('CG','Chhattisgarh','Raipur'),('GA','Goa','Panaji'),('GJ','Gujarat','Ahmedabad'),
 ('HR','Haryana','Gurugram'),('HP','Himachal Pradesh','Shimla'),('JH','Jharkhand','Ranchi'),
 ('KA','Karnataka','Bengaluru'),('KL','Kerala','Kochi'),('MP','Madhya Pradesh','Bhopal'),
 ('MH','Maharashtra','Pune'),('MN','Manipur','Imphal'),('ML','Meghalaya','Shillong'),('MZ','Mizoram','Aizawl'),
 ('NL','Nagaland','Kohima'),('OD','Odisha','Bhubaneswar'),('PB','Punjab','Ludhiana'),('RJ','Rajasthan','Jaipur'),
 ('SK','Sikkim','Gangtok'),('TN','Tamil Nadu','Chennai'),('TG','Telangana','Hyderabad'),('TR','Tripura','Agartala'),
 ('UP','Uttar Pradesh','Lucknow'),('UK','Uttarakhand','Dehradun'),('WB','West Bengal','Kolkata'),
 ('AN','Andaman and Nicobar Islands','Port Blair'),('CH','Chandigarh','Chandigarh'),
 ('DN','Dadra and Nagar Haveli and Daman and Diu','Daman'),('DL','Delhi','Delhi'),
 ('JK','Jammu and Kashmir','Srinagar'),('LA','Ladakh','Leh'),('LD','Lakshadweep','Kavaratti'),
 ('PY','Puducherry','Puducherry')
on conflict (code) do nothing;

-- ---------------------------------------------------------- admin_nav_items
-- route values match src/portals/admin/routes.jsx (and AdminSidebar.jsx, which
-- looks badges up by route). badge_key names a count computed in get_admin_nav().
create table if not exists public.admin_nav_items (
  key        text primary key,
  section    text not null check (section in ('overview','test_series','management','finance','system')),
  label      text not null,
  route      text not null,
  icon       text,
  badge_key  text check (badge_key in ('educator_verifications','series_approvals','refunds','callbacks','moderation')),
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

insert into public.admin_nav_items (key, section, label, route, icon, badge_key, sort_order) values
 ('dashboard',             'overview',    'Dashboard',                  '/admin/logindashboard',                    'layout-dashboard', null,                     10),
 ('create_test_series',    'test_series', 'Create Test Series',         '/admin/testseries',                        'file-plus',        null,                     20),
 ('assign_educators',      'test_series', 'Assign Educators',           '/admin/testseries/assign-educators',       'user-check',       'series_approvals',       30),
 ('test_series_tracker',   'test_series', 'Test Series Tracker',        '/admin/testseries/tracker',                'list-checks',      null,                     40),
 ('test_performance',      'test_series', 'Test Performance Analytics', '/admin/testseries/performance-analytics',  'bar-chart',        null,                     50),
 ('student_management',    'management',  'Student Management',         '/admin/usermanagement',                    'graduation-cap',   null,                     60),
 ('educator_management',   'management',  'Educator Management',        '/admin/educatorverification',              'users',            'educator_verifications', 70),
 ('discount_management',   'management',  'Discount Management',        '/admin/discounts',                         'percent',          null,                     80),
 ('transaction_history',   'finance',     'Transaction History',        '/admin/transactionhistory',                'credit-card',      null,                     90),
 ('refund_management',     'finance',     'Refund Management',          '/admin/paymentoversight',                  'rotate-ccw',       'refunds',               100),
 ('financial_analytics',   'finance',     'Financial Analytics',        '/admin/financialanalytics',                'line-chart',       null,                    110),
 ('regional_growth',       'finance',     'Regional Growth',            '/admin/regionalanalytics',                 'map',              null,                    120),
 ('reports_builder',       'finance',     'Reports Builder',            '/admin/reportsbuilder',                    'file-text',        null,                    130),
 ('content_moderation',    'system',      'Content Moderation',         '/admin/contentmoderation',                 'shield',           'moderation',            140),
 ('publish_notifications', 'system',      'Publish Notifications',      '/admin/notifications',                     'bell',             null,                    150),
 ('audit_logs',            'system',      'Audit Logs',                 '/admin/auditlogs',                         'history',          null,                    155),
 ('callback_request',      'system',      'Callback Request',           '/admin/supporttickets',                    'phone',            'callbacks',             160)
on conflict (key) do nothing;

-- ------------------------------------------------------------- report_types
-- Column keys are unchanged from the archived catalogue (the Reports Builder
-- renders them); filter options are rewritten to the values the lead's data
-- and this port actually store.
create table if not exists public.report_types (
  key          text primary key,
  label        text not null,
  description  text,
  date_label   text not null default 'Date',
  columns      jsonb not null,
  filters      jsonb not null default '[]'::jsonb,
  sort_order   int  not null default 0,
  is_active    boolean not null default true
);

insert into public.report_types (key, label, description, date_label, sort_order, columns, filters) values
('enrollment', 'Enrollment report', 'Who enrolled in which test series', 'Enrolled on', 1,
 '[{"key":"enrollment_id","label":"Enrollment ID"},{"key":"student","label":"Student"},{"key":"email","label":"Email"},
   {"key":"test_series","label":"Test series"},{"key":"educator","label":"Educator"},{"key":"enrolled_on","label":"Enrolled on"},
   {"key":"status","label":"Status"},{"key":"amount_paid_inr","label":"Amount paid (INR)"}]',
 '[{"key":"series_id","label":"Test series","type":"select","source":"series"},
   {"key":"educator_id","label":"Educator","type":"select","source":"educators"},
   {"key":"status","label":"Status","type":"select","options":["active","revoked"]}]'),
('test_series', 'Courses / test series report', 'Catalogue, enrollments and revenue per test series', 'Created on', 2,
 '[{"key":"title","label":"Test series"},{"key":"subject","label":"Subject"},{"key":"status","label":"Status"},
   {"key":"pricing","label":"Pricing"},{"key":"price_inr","label":"Price (INR)"},{"key":"educators","label":"Educators"},
   {"key":"created_on","label":"Created on"},{"key":"enrollments","label":"Enrollments"},{"key":"revenue_inr","label":"Revenue (INR)"}]',
 '[{"key":"subject_id","label":"Subject","type":"select","source":"subjects"},
   {"key":"status","label":"Status","type":"select","options":["draft","scheduled","published","archived"]},
   {"key":"pricing","label":"Pricing","type":"select","options":["free","paid"]},
   {"key":"educator_id","label":"Educator","type":"select","source":"educators"}]'),
('educators', 'Educator report', 'Educator status, load and earnings', 'Joined on', 3,
 '[{"key":"educator","label":"Educator"},{"key":"email","label":"Email"},{"key":"verification_status","label":"Verification"},
   {"key":"account_status","label":"Account"},{"key":"joined_on","label":"Joined on"},
   {"key":"series_assigned","label":"Test series assigned"},{"key":"sales","label":"Sales"},{"key":"earnings_inr","label":"Earnings (INR)"}]',
 '[{"key":"verification_status","label":"Verification","type":"select","options":["pending","verified","rejected"]},
   {"key":"account_status","label":"Account status","type":"select","options":["active","inactive","suspended"]}]'),
('students', 'Student report', 'Registrations, enrollments and spend', 'Registered on', 4,
 '[{"key":"student","label":"Student"},{"key":"email","label":"Email"},{"key":"grade","label":"Grade"},
   {"key":"account_status","label":"Account"},{"key":"registered_on","label":"Registered on"},
   {"key":"enrollments","label":"Enrollments"},{"key":"total_spent_inr","label":"Total spent (INR)"}]',
 '[{"key":"grade","label":"Grade","type":"select","source":"grades"},
   {"key":"account_status","label":"Account status","type":"select","options":["active","blocked"]},
   {"key":"has_enrollment","label":"Has enrollment","type":"select","options":["yes","no"]}]')
on conflict (key) do nothing;

-- ------------------------------------------------- platform_settings (lead)
insert into public.platform_settings (key, value, description)
values ('dashboard_quote',
        to_jsonb('Empowering educators. Enabling learners. Building brighter futures.'::text),
        'Admin dashboard welcome quote')
on conflict (key) do nothing;

-- -------------------------------------------------------------------- RLS
-- RPC-only tables: RLS on, no policies, no direct grants for browser roles.
alter table public.regions         enable row level security;
alter table public.admin_nav_items enable row level security;
alter table public.report_types    enable row level security;
revoke all on table public.regions, public.admin_nav_items, public.report_types from anon, authenticated;

-- =====================================================================
-- 20261025100300_admin_extend_lead_tables.sql
--
-- Purpose
--   The only DDL this port runs on lead tables (doc sections 2.3, 2.5, 2.15):
--   nullable columns with no default (no table rewrite), plus two documented
--   backfills. No constraints, defaults, foreign keys, indexes or triggers are
--   added to lead tables; integrity is enforced inside the RPCs. Indexes on
--   these columns are in scripts/admin_indexes_concurrently.sql.
--
-- Lead objects touched
--   public.callback_requests       + code, organization, assigned_to, contacted_at,
--                                    contacted_by, closed_at, closed_by, submitted_from,
--                                    ip_hash, user_agent, updated_at
--                                    backfill: code = 'CB-<n>' in created_at order
--   public.institutions            + state_code
--                                    backfill: matched to regions by name or code
--   public.educator_verification_docs + review_note, verified_by
--
-- Assumptions
--   * The preflight proved none of these columns existed.
--   * Each ADD COLUMN takes a brief ACCESS EXCLUSIVE lock; the tables are small.
--   * Rows inserted later by the lead's own code get code = NULL; the callback
--     RPCs (Batch 3) display a fallback and assign a code on first admin action.
--
-- ROLLBACK (removes the columns and their data; take a backup first)
--   alter table public.educator_verification_docs drop column if exists verified_by;
--   alter table public.educator_verification_docs drop column if exists review_note;
--   alter table public.institutions drop column if exists state_code;
--   alter table public.callback_requests
--     drop column if exists updated_at, drop column if exists user_agent, drop column if exists ip_hash,
--     drop column if exists submitted_from, drop column if exists closed_by, drop column if exists closed_at,
--     drop column if exists contacted_by, drop column if exists contacted_at, drop column if exists assigned_to,
--     drop column if exists organization, drop column if exists code;
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------- callback_requests (2.5)
alter table public.callback_requests add column if not exists code           text;
alter table public.callback_requests add column if not exists organization   text;
alter table public.callback_requests add column if not exists assigned_to    uuid;   -- profiles.id, checked in RPCs
alter table public.callback_requests add column if not exists contacted_at   timestamptz;
alter table public.callback_requests add column if not exists contacted_by   uuid;   -- profiles.id
alter table public.callback_requests add column if not exists closed_at      timestamptz;
alter table public.callback_requests add column if not exists closed_by      uuid;   -- profiles.id
alter table public.callback_requests add column if not exists submitted_from text;
alter table public.callback_requests add column if not exists ip_hash        text;
alter table public.callback_requests add column if not exists user_agent     text;
alter table public.callback_requests add column if not exists updated_at     timestamptz;

-- Backfill human codes CB-1001, CB-1002 ... in submission order, then move the
-- sequence past the highest code so new codes never collide.
do $$
begin
  update public.callback_requests c
     set code = 'CB-' || (1000 + o.rn)::text
    from (select id, row_number() over (order by created_at, id) as rn
            from public.callback_requests where code is null) o
   where c.id = o.id;
  perform setval('public.adm_callback_code_seq',
                 greatest(1000, coalesce((select max(substring(code from 4)::bigint)
                                            from public.callback_requests where code ~ '^CB-[0-9]+$'), 1000)),
                 true);
end $$;

-- ------------------------------------------------------ institutions (2.3)
alter table public.institutions add column if not exists state_code text;   -- regions.code, checked in RPCs

update public.institutions i
   set state_code = r.code
  from public.regions r
 where i.state_code is null
   and i.state is not null
   and (lower(btrim(i.state)) = lower(r.name) or upper(btrim(i.state)) = r.code);

-- ---------------------------------------- educator_verification_docs (2.15)
alter table public.educator_verification_docs add column if not exists review_note text;
alter table public.educator_verification_docs add column if not exists verified_by uuid;   -- profiles.id of the reviewer

-- =====================================================================
-- 20261025100400_admin_people_tables.sql
--
-- Purpose
--   Admin-only state about people, kept beside the lead's profile tables
--   (doc sections 2.13 / 2.14 / 2.17, decisions D6 / D8 / D9):
--     students               app-level block state + human code (STU-2001)
--     student_block_history  block / unblock trail
--     educator_admin_state   account status, finer review state, human code
--     educator_invites       bulk / individual invite queue
--     user_geo               student state / institution link
--     admin_auth_events      admin sign-in / sign-out trail (not audit_logs)
--     user_sessions          one row per signed-in admin browser
--     admin_notes            dashboard scratchpad
--   plus helpers that need these tables (adm_ensure_*, adm_is_account_blocked,
--   adm_end_user_sessions, adm_open_assignment_count).
--
-- Lead objects read
--   public.profiles (FK target, role), public.institutions (FK target).
--   No lead table is altered; there are no triggers on lead tables (D8).
--
-- Assumptions
--   * Rows are created by a one-time backfill (next file) and lazily by RPCs;
--     a missing students / educator_admin_state row means "active".
--   * All access is through SECURITY DEFINER RPCs: RLS on, no policies.
--   * test_assignments is created in Batch 2; adm_open_assignment_count checks
--     for it at run time and returns 0 until it exists.
--
-- ROLLBACK
--   drop function if exists public.adm_open_assignment_count(uuid, text[]);
--   drop function if exists public.adm_end_user_sessions(uuid, text, uuid);
--   drop function if exists public.adm_is_account_blocked(uuid);
--   drop function if exists public.adm_ensure_educator_state(uuid);
--   drop function if exists public.adm_ensure_student(uuid);
--   drop table if exists public.admin_notes, public.user_sessions, public.admin_auth_events,
--     public.user_geo, public.educator_invites, public.educator_admin_state,
--     public.student_block_history, public.students;
-- =====================================================================
set search_path = public, extensions;

-- ----------------------------------------------------------------- students
create table if not exists public.students (
  id              uuid primary key references public.profiles(id) on delete cascade,
  student_code    text not null unique default ('STU-' || nextval('public.adm_student_code_seq')),
  account_status  text not null default 'active' check (account_status in ('active', 'blocked')),
  blocked_reason  text,
  blocked_at      timestamptz,
  blocked_by      uuid references public.profiles(id) on delete set null,
  last_active_at  timestamptz,
  onboarded_via   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint students_blocked_reason_chk
    check (account_status <> 'blocked' or nullif(btrim(blocked_reason), '') is not null)
);
create index if not exists students_account_status_idx on public.students (account_status);

create table if not exists public.student_block_history (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  action      text not null check (action in ('blocked', 'unblocked')),
  reason      text,
  by_admin    uuid references public.profiles(id) on delete set null,
  at          timestamptz not null default now()
);
create index if not exists student_block_history_student_idx on public.student_block_history (student_id, at desc);

-- ----------------------------------------------------- educator_admin_state
create table if not exists public.educator_admin_state (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  educator_code   text not null unique default ('EDU-' || nextval('public.adm_educator_code_seq')),
  account_status  text not null default 'active'
                  check (account_status in ('active', 'inactive', 'suspended', 'deleted')),
  status_reason   text,
  suspended_at    timestamptz,
  deleted_at      timestamptz,
  review_state    text check (review_state in ('under_review', 'changes_requested')),   -- D7
  review_note     text,
  gender          text,
  dob             date,
  last_active_at  timestamptz,
  onboarded_via   text not null default 'self',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists educator_admin_state_account_idx on public.educator_admin_state (account_status);

create table if not exists public.educator_invites (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  phone             text,
  email             text not null,
  qualification     text,
  years_experience  int check (years_experience is null or years_experience between 0 and 60),
  subjects          text[] not null default '{}',
  status            text not null default 'pending' check (status in ('pending', 'sent', 'accepted', 'expired', 'failed')),
  user_id           uuid references public.profiles(id) on delete set null,
  invited_by        uuid references public.profiles(id) on delete set null,
  invited_at        timestamptz not null default now(),
  sent_at           timestamptz,
  accepted_at       timestamptz,
  error             text
);
create unique index if not exists educator_invites_open_email_uidx
  on public.educator_invites (lower(email)) where status in ('pending', 'sent');

-- ----------------------------------------------------------------- user_geo
create table if not exists public.user_geo (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  state_code      text references public.regions(code),
  institution_id  uuid references public.institutions(id) on delete set null,
  source          text not null default 'admin' check (source in ('admin', 'self', 'import', 'derived')),
  updated_at      timestamptz not null default now()
);
create index if not exists user_geo_state_idx on public.user_geo (state_code);

-- -------------------------------------------------------- admin_auth_events
create table if not exists public.admin_auth_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  session_id  uuid,
  event_type  text not null check (event_type in ('login', 'logout', 'logout_all', 'session_revoked', 'login_blocked')),
  role        text,
  user_agent  text,
  ip_hash     text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists admin_auth_events_user_idx on public.admin_auth_events (user_id, created_at desc);
create index if not exists admin_auth_events_type_idx on public.admin_auth_events (event_type, created_at desc);

-- ------------------------------------------------------------ user_sessions
create table if not exists public.user_sessions (
  session_id    uuid primary key,                 -- session_id claim of the Supabase JWT
  user_id       uuid not null references public.profiles(id) on delete cascade,
  role          text,
  user_agent    text,
  ip_hash       text,
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended_at      timestamptz,
  end_reason    text check (end_reason in ('logout', 'logout_all', 'revoked', 'expired'))
);
create index if not exists user_sessions_open_idx on public.user_sessions (user_id) where ended_at is null;
create index if not exists user_sessions_seen_idx on public.user_sessions (last_seen_at desc);

-- -------------------------------------------------------------- admin_notes
create table if not exists public.admin_notes (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles(id) on delete cascade,
  text        text not null check (char_length(btrim(text)) between 1 and 500),
  is_done     boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists admin_notes_admin_idx on public.admin_notes (admin_id, created_at);

-- ------------------------------------------------ foreign-key indexes
-- Every column that references a lead table is indexed (FK audit), so a
-- delete on the lead table never scans these tables.
create index if not exists students_blocked_by_idx              on public.students (blocked_by) where blocked_by is not null;
create index if not exists student_block_history_by_admin_idx   on public.student_block_history (by_admin) where by_admin is not null;
create index if not exists educator_invites_user_idx            on public.educator_invites (user_id) where user_id is not null;
create index if not exists educator_invites_invited_by_idx      on public.educator_invites (invited_by) where invited_by is not null;
create index if not exists user_geo_institution_idx             on public.user_geo (institution_id) where institution_id is not null;
create index if not exists user_sessions_user_idx               on public.user_sessions (user_id);

-- --------------------------------------------------- updated_at triggers
-- (own tables only; nothing is attached to lead tables)
drop trigger if exists trg_students_touch on public.students;
create trigger trg_students_touch before update on public.students
  for each row execute function public.adm_touch_updated_at();
drop trigger if exists trg_educator_admin_state_touch on public.educator_admin_state;
create trigger trg_educator_admin_state_touch before update on public.educator_admin_state
  for each row execute function public.adm_touch_updated_at();
drop trigger if exists trg_user_geo_touch on public.user_geo;
create trigger trg_user_geo_touch before update on public.user_geo
  for each row execute function public.adm_touch_updated_at();
drop trigger if exists trg_admin_notes_touch on public.admin_notes;
create trigger trg_admin_notes_touch before update on public.admin_notes
  for each row execute function public.adm_touch_updated_at();

-- ------------------------------------------------------------------ helpers
-- D8: lazy creation of the side rows.
create or replace function public.adm_ensure_student(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.students (id)
  select p.id from public.profiles p where p.id = p_id and p.role = 'student'
  on conflict (id) do nothing;
$$;

create or replace function public.adm_ensure_educator_state(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.educator_admin_state (user_id)
  select p.id from public.profiles p where p.id = p_id and p.role = 'educator'
  on conflict (user_id) do nothing;
$$;

-- D6: blocking is app-level only.
create or replace function public.adm_is_account_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.students where id = p_user and account_status = 'blocked')
      or exists (select 1 from public.educator_admin_state
                  where user_id = p_user and account_status in ('inactive', 'suspended', 'deleted'));
$$;

-- Marks a user's open sessions as ended and records one event. App-level only:
-- the auth schema is never touched from SQL (D6); the Edge Function in Batch 4
-- revokes the real refresh tokens through the Admin API.
create or replace function public.adm_end_user_sessions(p_user uuid, p_reason text, p_except uuid default null)
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  update public.user_sessions
     set ended_at = now(), end_reason = 'revoked'
   where user_id = p_user and ended_at is null
     and (p_except is null or session_id <> p_except);
  get diagnostics n = row_count;
  insert into public.admin_auth_events (user_id, event_type, role, meta)
  values (p_user, 'session_revoked', (select role from public.profiles where id = p_user),
          jsonb_build_object('reason', p_reason, 'sessions', n, 'by', auth.uid()));
  return n;
end $$;

-- Open test assignments held by an educator. test_assignments arrives in
-- Batch 2, so the table is looked up at run time.
create or replace function public.adm_open_assignment_count(p_educator uuid, p_statuses text[]) returns int
language plpgsql stable security definer set search_path = public, extensions as $$
declare n int := 0;
begin
  if to_regclass('public.test_assignments') is not null then
    execute 'select count(*)::int from public.test_assignments where educator_id = $1 and status = any ($2)'
       into n using p_educator, p_statuses;
  end if;
  return n;
end $$;

revoke all on function public.adm_ensure_student(uuid) from public, anon, authenticated;
revoke all on function public.adm_ensure_educator_state(uuid) from public, anon, authenticated;
revoke all on function public.adm_is_account_blocked(uuid) from public, anon, authenticated;
revoke all on function public.adm_end_user_sessions(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.adm_open_assignment_count(uuid, text[]) from public, anon, authenticated;

-- -------------------------------------------------------------------- RLS
alter table public.students              enable row level security;
alter table public.student_block_history enable row level security;
alter table public.educator_admin_state  enable row level security;
alter table public.educator_invites      enable row level security;
alter table public.user_geo              enable row level security;
alter table public.admin_auth_events     enable row level security;
alter table public.user_sessions         enable row level security;
alter table public.admin_notes           enable row level security;
revoke all on table public.students, public.student_block_history, public.educator_admin_state,
  public.educator_invites, public.user_geo, public.admin_auth_events, public.user_sessions, public.admin_notes
  from anon, authenticated;

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

-- =====================================================================
-- 20261025100600_admin_rpc_shell_dashboard.sql
--
-- Purpose
--   RPCs behind the admin login, sidebar, top bar, notepad and dashboard.
--   Names, parameters and JSON keys match src/portals/admin/services/adminApi.js,
--   AdminLogin.jsx, AuthContext.jsx, AdminSidebar.jsx, AdminTopbar.jsx and
--   LoginDashboard.jsx. Revenue is stubbed with zeros (D1).
--
-- Lead objects read
--   profiles, student_profiles, educator_profiles, test_series, quizzes,
--   quiz_attempts, institutions, callback_requests, moderation_reports,
--   platform_settings. Nothing on lead tables is written here.
--
-- Assumptions
--   * "Published series" = test_series.is_published and is_active. Batch 2's
--     soft delete must also set test_series.is_active = false so search and
--     counts here stay correct without replacing these functions.
--   * test_assignments (Batch 2) is looked up at run time; until it exists the
--     approvals card and badge are empty.
--   * Fixes from the doc appendix: callbacks badge counts status 'new' (not
--     'pending'); moderation counts the lead's moderation_reports; approvals use
--     test_assignments.deadline (not due_date).
--
-- ROLLBACK
--   drop function if exists public.get_admin_dashboard(int);
--   drop function if exists public.get_students_by_region(int);
--   drop function if exists public.get_top_series(int, int);
--   drop function if exists public.get_series_approvals(int);
--   drop function if exists public.get_pending_educator_verifications(int);
--   drop function if exists public.get_dashboard_revenue(int, text);
--   drop function if exists public.get_dashboard_stats();
--   drop function if exists public.adm_stat_card(text);
--   drop function if exists public.adm_cumulative_counts(text, int);
--   drop function if exists public.get_dashboard_header();
--   drop function if exists public.clear_done_notes();
--   drop function if exists public.delete_admin_note(uuid);
--   drop function if exists public.update_admin_note(uuid, text);
--   drop function if exists public.toggle_admin_note(uuid, boolean);
--   drop function if exists public.add_admin_note(text);
--   drop function if exists public.list_my_notes();
--   drop function if exists public.global_search(text, int);
--   drop function if exists public.get_admin_nav();
--   drop function if exists public.touch_session();
--   drop function if exists public.record_logout(text);
--   drop function if exists public.record_login(text, text);
--   drop function if exists public.get_admin_me();
-- =====================================================================
set search_path = public, extensions;

-- =============================================================== session
create or replace function public.get_admin_me() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public.adm_require_admin();
  select jsonb_build_object(
           'id', p.id, 'name', p.full_name, 'email', p.email, 'avatar_url', p.avatar_url,
           'initials', public.adm_initials(p.full_name),
           'role', case p.role when 'super_admin' then 'Super Admin' else 'Admin' end,
           'role_key', p.role)
    into r
    from public.profiles p where p.id = auth.uid();
  return r;
end $$;

-- Called by AdminLogin.jsx right after signInWithPassword.
create or replace function public.record_login(p_user_agent text default null, p_ip_hash text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_sid  uuid := public.adm_current_session_id();
  v_role text;
begin
  perform public.adm_require_admin();
  select role into v_role from public.profiles where id = v_uid;

  if public.adm_is_account_blocked(v_uid) then
    insert into public.admin_auth_events (user_id, session_id, event_type, role, user_agent, ip_hash, meta)
    values (v_uid, v_sid, 'login_blocked', v_role, left(p_user_agent, 300), p_ip_hash,
            jsonb_build_object('reason', 'account_blocked'));
    return jsonb_build_object('ok', false, 'reason', 'account_blocked');
  end if;

  if v_sid is not null then
    insert into public.user_sessions (session_id, user_id, role, user_agent, ip_hash)
    values (v_sid, v_uid, v_role, left(p_user_agent, 300), p_ip_hash)
    on conflict (session_id) do update set last_seen_at = now();
  end if;

  insert into public.admin_auth_events (user_id, session_id, event_type, role, user_agent, ip_hash)
  values (v_uid, v_sid, 'login', v_role, left(p_user_agent, 300), p_ip_hash);

  return jsonb_build_object('ok', true, 'role', v_role, 'redirect_to', '/admin/logindashboard');
end $$;

-- Called by AuthContext.logout() for EVERY role before signOut(), so it must
-- never fail for students or educators. Events are recorded for admins only.
create or replace function public.record_logout(p_scope text default 'local') returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_sid  uuid := public.adm_current_session_id();
  v_role text;
  v_global boolean := coalesce(p_scope, 'local') = 'global';
begin
  if v_uid is null then return; end if;

  if v_global then
    update public.user_sessions set ended_at = now(), end_reason = 'logout_all'
     where user_id = v_uid and ended_at is null;
  elsif v_sid is not null then
    update public.user_sessions set ended_at = now(), end_reason = 'logout'
     where session_id = v_sid and ended_at is null;
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role in ('admin', 'super_admin') then
    insert into public.admin_auth_events (user_id, session_id, event_type, role, meta)
    values (v_uid, v_sid, case when v_global then 'logout_all' else 'logout' end, v_role,
            jsonb_build_object('scope', coalesce(p_scope, 'local')));
  end if;
end $$;

-- Heartbeat from AdminLogin.jsx (every 5 minutes while signed in).
create or replace function public.touch_session() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_sid uuid := public.adm_current_session_id();
begin
  perform public.adm_require_admin();
  if v_sid is null then return; end if;
  insert into public.user_sessions as us (session_id, user_id, role)
  values (v_sid, auth.uid(), public.adm_actor_role())
  on conflict (session_id) do update set last_seen_at = now()
   where us.ended_at is null
     and us.last_seen_at < now() - interval '1 minute';
end $$;

-- ================================================================ shell
-- Sidebar: [{key, section, label, route, icon, badge}] (AdminSidebar matches by route).
create or replace function public.get_admin_nav() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_series int := 0;
  v_counts jsonb;
begin
  perform public.adm_require_admin();
  if to_regclass('public.test_assignments') is not null then
    execute $q$select count(*)::int from public.test_assignments
               where status not in ('approved', 'completed', 'cancelled', 'rejected')$q$ into v_series;
  end if;
  v_counts := jsonb_build_object(
    'educator_verifications', (select count(*) from public.educator_profiles ep
                                 join public.profiles p on p.id = ep.user_id and p.role = 'educator'
                                 left join public.educator_admin_state st on st.user_id = ep.user_id
                                where ep.verification_status = 'pending'
                                  and coalesce(st.account_status, 'active') <> 'deleted'),
    'series_approvals', v_series,
    'refunds', 0,                                                                  -- STUB: needs payments model (F4)
    'callbacks', (select count(*) from public.callback_requests where status = 'new'),
    'moderation', (select count(*) from public.moderation_reports where status = 'pending'));
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'key', n.key, 'section', n.section, 'label', n.label, 'route', n.route, 'icon', n.icon,
             'badge', nullif((v_counts ->> n.badge_key)::int, 0)) order by n.sort_order)
      from public.admin_nav_items n where n.is_active), '[]'::jsonb);
end $$;

-- Top bar search: {students:[], educators:[], series:[]} of {id, label, sublabel}.
create or replace function public.global_search(p_q text, p_limit int default 5) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like  text := public.adm_like(p_q);
  v_limit int  := least(greatest(coalesce(p_limit, 5), 1), 20);
begin
  perform public.adm_require_admin();
  if v_like is null or char_length(btrim(p_q)) < 2 then
    return jsonb_build_object('students', '[]'::jsonb, 'educators', '[]'::jsonb, 'series', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.full_name, 'sublabel', x.email))
                            from (select p.id, p.full_name, p.email from public.profiles p
                                   where p.role = 'student' and (p.full_name ilike v_like or p.email ilike v_like)
                                   order by p.full_name limit v_limit) x), '[]'::jsonb),
    'educators', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.full_name, 'sublabel', x.email))
                             from (select p.id, p.full_name, p.email from public.profiles p
                                     left join public.educator_admin_state st on st.user_id = p.id
                                    where p.role = 'educator' and coalesce(st.account_status, 'active') <> 'deleted'
                                      and (p.full_name ilike v_like or p.email ilike v_like)
                                    order by p.full_name limit v_limit) x), '[]'::jsonb),
    'series', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.title,
                                 'sublabel', case when x.is_published then 'published' else 'draft' end))
                          from (select t.id, t.title, t.is_published from public.test_series t
                                 where t.is_active and t.title ilike v_like
                                 order by t.title limit v_limit) x), '[]'::jsonb));
end $$;

-- ============================================================== notepad
create or replace function public.list_my_notes() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'text', n.text, 'is_done', n.is_done,
                                                       'created_at', n.created_at) order by n.created_at)
                     from public.admin_notes n where n.admin_id = auth.uid()), '[]'::jsonb);
end $$;

create or replace function public.add_admin_note(p_text text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  perform public.adm_require_admin();
  if nullif(btrim(coalesce(p_text, '')), '') is null then
    raise exception 'Note is empty.' using errcode = '22023';
  end if;
  if (select count(*) from public.admin_notes where admin_id = auth.uid()) >= 100 then
    raise exception 'Notepad is full (100 notes). Clear some completed notes first.' using errcode = '54000';
  end if;
  insert into public.admin_notes (admin_id, text) values (auth.uid(), left(btrim(p_text), 500)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.toggle_admin_note(p_id uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.admin_notes
     set is_done = coalesce(p_done, false), done_at = case when p_done then now() end
   where id = p_id and admin_id = auth.uid();
end $$;

create or replace function public.update_admin_note(p_id uuid, p_text text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  if nullif(btrim(coalesce(p_text, '')), '') is null then
    raise exception 'Note is empty.' using errcode = '22023';
  end if;
  update public.admin_notes set text = left(btrim(p_text), 500) where id = p_id and admin_id = auth.uid();
end $$;

create or replace function public.delete_admin_note(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  delete from public.admin_notes where id = p_id and admin_id = auth.uid();
end $$;

create or replace function public.clear_done_notes() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform public.adm_require_admin();
  delete from public.admin_notes where admin_id = auth.uid() and is_done;
  get diagnostics n = row_count;
  return n;
end $$;

-- ============================================================ dashboard
create or replace function public.get_dashboard_header() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public.adm_require_admin();
  select jsonb_build_object(
           'name', coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Admin'),
           'today', (now() at time zone 'Asia/Kolkata')::date,
           'quote', (select s.value #>> '{}' from public.platform_settings s where s.key = 'dashboard_quote'))
    into r
    from public.profiles p where p.id = auth.uid();
  return r;
end $$;

-- Running totals per day for the stat-card sparklines.
create or replace function public.adm_cumulative_counts(p_kind text, p_days int default 31)
returns table (day date, total bigint)
language sql stable security definer set search_path = public, extensions as $$
  with src as (
    select p.created_at as ts from public.profiles p where p_kind = 'students'  and p.role = 'student'
    union all
    select p.created_at        from public.profiles p where p_kind = 'educators' and p.role = 'educator'
    union all
    select t.created_at        from public.test_series t where p_kind = 'series' and t.is_published and t.is_active
  ), days as (
    select gs::date as d
      from generate_series(((now() at time zone 'Asia/Kolkata')::date - (greatest(p_days, 1) - 1))::timestamp,
                           (now() at time zone 'Asia/Kolkata')::date::timestamp, interval '1 day') gs
  )
  select days.d, (select count(*) from src where (src.ts at time zone 'Asia/Kolkata')::date <= days.d)
    from days order by days.d;
$$;

create or replace function public.adm_stat_card(p_kind text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with s as (select * from public.adm_cumulative_counts(p_kind, 31)),
       f as (select total from s order by day asc  limit 1),
       l as (select total from s order by day desc limit 1)
  select jsonb_build_object(
    'total',      (select total from l),
    'previous',   (select total from f),
    'growth_pct', (select case when f.total > 0 then round((l.total - f.total)::numeric / f.total * 100) end from f, l),
    'sparkline',  (select jsonb_agg(total order by day) from s));
$$;

create or replace function public.get_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object('students', public.adm_stat_card('students'),
                            'educators', public.adm_stat_card('educators'),
                            'test_series', public.adm_stat_card('series'));
end $$;

-- STUB: needs payments model (F4). No payments table exists (D1). Same keys as the archived RPC,
-- zero-valued buckets so the chart renders.
create or replace function public.get_dashboard_revenue(p_days int default 60, p_granularity text default 'week')
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  g      text := case when p_granularity in ('day', 'week', 'month') then p_granularity else 'week' end;
  v_to   date := (now() at time zone 'Asia/Kolkata')::date;
  v_from date := v_to - (greatest(coalesce(p_days, 60), 1) - 1);
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'total_inr', 0, 'previous_inr', 0, 'change_pct', null::numeric,
    'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', gs::date, 'revenue_inr', 0) order by gs)
                          from generate_series(date_trunc(g, v_from::timestamp), v_to::timestamp, ('1 ' || g)::interval) gs),
                       '[]'::jsonb));
end $$;

-- Educator Verifications card: {total_pending, items:[{id,name,initials,submitted_at,submitted_label}]}
create or replace function public.get_pending_educator_verifications(p_limit int default 3) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with pending as (
      select ep.user_id as id, coalesce(ep.full_name, p.full_name) as full_name,
             coalesce(ep.created_at, p.created_at) as submitted_at
        from public.educator_profiles ep
        join public.profiles p on p.id = ep.user_id and p.role = 'educator'
        left join public.educator_admin_state st on st.user_id = ep.user_id
       where ep.verification_status = 'pending' and coalesce(st.account_status, 'active') <> 'deleted'
    )
    select jsonb_build_object(
      'total_pending', (select count(*) from pending),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', x.id, 'name', x.full_name, 'initials', public.adm_initials(x.full_name),
                 'submitted_at', x.submitted_at,
                 'submitted_label', 'Submitted ' || to_char(x.submitted_at at time zone 'Asia/Kolkata', 'Mon FMDD'))
               order by x.submitted_at desc)
          from (select * from pending order by submitted_at desc
                 limit least(greatest(coalesce(p_limit, 3), 1), 50)) x), '[]'::jsonb)));
end $$;

-- Test Series Approvals card. LoginDashboard.jsx reads seriesName / testName /
-- educatorName / status / is_overdue, so those camelCase keys are included next
-- to the archived snake_case ones.
create or replace function public.get_series_approvals(p_limit int default 3) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public.adm_require_admin();
  if to_regclass('public.test_assignments') is null then
    return jsonb_build_object('total_pending', 0, 'total_overdue', 0, 'items', '[]'::jsonb);
  end if;
  execute $q$
    with open_rows as (
      select a.id, a.series_id, s.title, a.test_name, ep.full_name as educator_name, a.status::text as status,
             a.deadline, (a.deadline is not null and a.deadline < current_date) as is_overdue
        from public.test_assignments a
        join public.test_series s on s.id = a.series_id
        left join public.profiles ep on ep.id = a.educator_id
       where a.status::text not in ('approved', 'completed', 'cancelled', 'rejected')
    )
    select jsonb_build_object(
      'total_pending', (select count(*) from open_rows),
      'total_overdue', (select count(*) from open_rows where is_overdue),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', x.id, 'series_id', x.series_id, 'title', x.title, 'educator_name', x.educator_name,
                 'status', x.status, 'deadline', x.deadline, 'is_overdue', x.is_overdue,
                 'seriesName', x.title, 'testName', x.test_name, 'educatorName', x.educator_name)
               order by x.is_overdue desc, x.deadline nulls last)
          from (select * from open_rows order by is_overdue desc, deadline nulls last limit $1) x), '[]'::jsonb))
  $q$ into r using least(greatest(coalesce(p_limit, 3), 1), 50);
  return r;
end $$;

-- Top Performing Test Series: [{id, title, avg_score, attempts}]
create or replace function public.get_top_series(p_limit int default 4, p_min_attempts int default 1) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.avg_score desc, x.attempts desc)
      from (select s.id, s.title, round(avg(a.percentage), 1) as avg_score, count(*) as attempts
              from public.test_series s
              join public.quizzes q on q.series_id = s.id
              join public.quiz_attempts a on a.quiz_id = q.id and a.status = 'submitted' and a.percentage is not null
             where s.is_published and s.is_active
             group by s.id, s.title
            having count(*) >= greatest(coalesce(p_min_attempts, 1), 1)
             order by avg(a.percentage) desc, count(*) desc
             limit least(greatest(coalesce(p_limit, 4), 1), 50)) x), '[]'::jsonb);
end $$;

-- Students by Region: {total_students, regions_count, legend, regions:[{id,state_code,name,students,bucket}]}
-- Source: user_geo.state_code, else the linked institution's state_code.
create or replace function public.get_students_by_region(p_limit int default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with s as (
      select coalesce(g.state_code, i.state_code) as sc
        from public.profiles p
        left join public.user_geo g on g.user_id = p.id
        left join public.institutions i on i.id = g.institution_id
       where p.role = 'student'
    ), c as (
      select sc, count(*) as n from s where sc is not null group by sc
    )
    select jsonb_build_object(
      'total_students', (select coalesce(sum(n), 0) from c),
      'regions_count',  (select count(*) from c),
      'legend', jsonb_build_array('2000+', '500-2000', '100-500', '<100'),
      'regions', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', x.sc, 'state_code', x.sc, 'name', x.name, 'students', x.n,
                 'bucket', case when x.n >= 2000 then '2000+' when x.n >= 500 then '500-2000'
                                when x.n >= 100 then '100-500' else '<100' end) order by x.n desc, x.name)
          from (select c.sc, rg.name, c.n from c join public.regions rg on rg.code = c.sc
                 order by c.n desc, rg.name limit least(greatest(coalesce(p_limit, 1000), 1), 1000)) x), '[]'::jsonb)));
end $$;

-- One call for the whole dashboard page.
create or replace function public.get_admin_dashboard(p_revenue_days int default 60) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'header',                 public.get_dashboard_header(),
    'stats',                  public.get_dashboard_stats(),
    'revenue',                public.get_dashboard_revenue(p_revenue_days),
    'educator_verifications', public.get_pending_educator_verifications(3),
    'series_approvals',       public.get_series_approvals(3),
    'top_series',             public.get_top_series(4),
    'students_by_region',     public.get_students_by_region(6));
end $$;

-- ================================================================ grants
revoke all on function public.adm_cumulative_counts(text, int) from public, anon, authenticated;
revoke all on function public.adm_stat_card(text) from public, anon, authenticated;

revoke all on function public.get_admin_me() from public, anon;
revoke all on function public.record_login(text, text) from public, anon;
revoke all on function public.record_logout(text) from public, anon;
revoke all on function public.touch_session() from public, anon;
revoke all on function public.get_admin_nav() from public, anon;
revoke all on function public.global_search(text, int) from public, anon;
revoke all on function public.list_my_notes() from public, anon;
revoke all on function public.add_admin_note(text) from public, anon;
revoke all on function public.toggle_admin_note(uuid, boolean) from public, anon;
revoke all on function public.update_admin_note(uuid, text) from public, anon;
revoke all on function public.delete_admin_note(uuid) from public, anon;
revoke all on function public.clear_done_notes() from public, anon;
revoke all on function public.get_dashboard_header() from public, anon;
revoke all on function public.get_dashboard_stats() from public, anon;
revoke all on function public.get_dashboard_revenue(int, text) from public, anon;
revoke all on function public.get_pending_educator_verifications(int) from public, anon;
revoke all on function public.get_series_approvals(int) from public, anon;
revoke all on function public.get_top_series(int, int) from public, anon;
revoke all on function public.get_students_by_region(int) from public, anon;
revoke all on function public.get_admin_dashboard(int) from public, anon;

grant execute on function public.get_admin_me() to authenticated;
grant execute on function public.record_login(text, text) to authenticated;
grant execute on function public.record_logout(text) to authenticated;
grant execute on function public.touch_session() to authenticated;
grant execute on function public.get_admin_nav() to authenticated;
grant execute on function public.global_search(text, int) to authenticated;
grant execute on function public.list_my_notes() to authenticated;
grant execute on function public.add_admin_note(text) to authenticated;
grant execute on function public.toggle_admin_note(uuid, boolean) to authenticated;
grant execute on function public.update_admin_note(uuid, text) to authenticated;
grant execute on function public.delete_admin_note(uuid) to authenticated;
grant execute on function public.clear_done_notes() to authenticated;
grant execute on function public.get_dashboard_header() to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;
grant execute on function public.get_dashboard_revenue(int, text) to authenticated;
grant execute on function public.get_pending_educator_verifications(int) to authenticated;
grant execute on function public.get_series_approvals(int) to authenticated;
grant execute on function public.get_top_series(int, int) to authenticated;
grant execute on function public.get_students_by_region(int) to authenticated;
grant execute on function public.get_admin_dashboard(int) to authenticated;

-- =====================================================================
-- 20261025100700_admin_rpc_students.sql
--
-- Purpose
--   Student Management RPCs (D4). These replace the direct table reads and
--   writes that src/portals/admin/services/studentsApi.js made against
--   students / v_students_list / series_enrollments / student_block_history.
--     get_student_stats()                         -> {total, active, blocked}
--     list_students(p_search, p_status, p_grade, p_sort, p_page, p_size)
--                                                 -> table(row_data jsonb, total_count bigint)
--     get_student_detail(p_id)                    -> row + enrolled_courses + enrolled_series
--     block_student(p_id, p_reason) / unblock_student(p_id)
--
-- Lead objects read
--   profiles (role 'student'), student_profiles (grade), enrollments, courses,
--   lessons, lesson_progress, test_series. Writes: audit_logs (via adm_audit).
--
-- Assumptions
--   * Block state is app-level only (D6): students.account_status. Open
--     user_sessions rows are ended; auth tokens are revoked by the Edge
--     Function in Batch 4.
--   * student_profiles.grade is free text; the 'Grade 6'..'Grade 12' UI filter
--     compares the digits (adm_grade_matches).
--   * Fixes from the doc appendix: no series_enrollments.user_id. Series
--     enrolments are read from admin_series_enrollments (Batch 2) when that
--     table exists, looked up at run time.
--
-- ROLLBACK
--   drop function if exists public.unblock_student(uuid);
--   drop function if exists public.block_student(uuid, text);
--   drop function if exists public.get_student_detail(uuid);
--   drop function if exists public.list_students(text, text, text, text, int, int);
--   drop function if exists public.get_student_stats();
--   drop function if exists public.adm_grade_matches(text, text);
-- =====================================================================
set search_path = public, extensions;

create or replace function public.adm_grade_matches(p_grade text, p_filter text) returns boolean
language sql immutable set search_path = public, extensions as $$
  select case
    when p_filter is null or btrim(p_filter) in ('', 'all') then true
    when regexp_replace(p_filter, '\D', '', 'g') <> ''
      then regexp_replace(coalesce(p_grade, ''), '\D', '', 'g') = regexp_replace(p_filter, '\D', '', 'g')
    else lower(btrim(coalesce(p_grade, ''))) = lower(btrim(p_filter))
  end;
$$;

-- ------------------------------------------------------------------ stats
create or replace function public.get_student_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_total bigint; v_blocked bigint;
begin
  perform public.adm_require_admin();
  select count(*) into v_total from public.profiles where role = 'student';
  select count(*) into v_blocked
    from public.students s join public.profiles p on p.id = s.id and p.role = 'student'
   where s.account_status = 'blocked';
  return jsonb_build_object('total', v_total, 'active', v_total - v_blocked, 'blocked', v_blocked);
end $$;

-- ------------------------------------------------------------------- list
-- p_status: active | blocked | all/null.  p_sort: registered_desc | registered_asc | name_asc
create or replace function public.list_students(
  p_search text default null, p_status text default null, p_grade text default null,
  p_sort text default 'registered_desc', p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 8), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with base as (
    select p.id, s.student_code, p.full_name, p.email, p.phone, p.location as city, sp.grade,
           p.created_at as registered_at, coalesce(s.account_status, 'active') as account_status,
           s.blocked_reason, s.blocked_at, s.last_active_at, s.onboarded_via
      from public.profiles p
      left join public.student_profiles sp on sp.user_id = p.id
      left join public.students s on s.id = p.id
     where p.role = 'student'
  ), f as (
    select b.* from base b
     where (v_like is null or b.full_name ilike v_like or b.email ilike v_like
            or coalesce(b.student_code, '') ilike v_like)
       and (p_status is null or p_status in ('', 'all') or b.account_status = p_status)
       and public.adm_grade_matches(b.grade, p_grade)
  )
  select jsonb_build_object(
           'id', f.id, 'student_code', f.student_code, 'full_name', f.full_name, 'email', f.email,
           'initials', public.adm_initials(f.full_name), 'grade', f.grade, 'registered_at', f.registered_at,
           'status', f.account_status, 'phone', f.phone, 'city', f.city, 'state', null::text,
           'last_active_at', f.last_active_at, 'blocked_reason', f.blocked_reason, 'blocked_at', f.blocked_at,
           'onboarded_via', f.onboarded_via),
         count(*) over ()
    from f
   order by case when p_sort = 'name_asc'       then f.full_name end asc,
            case when p_sort = 'registered_asc' then f.registered_at end asc,
            f.registered_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- ----------------------------------------------------------------- detail
create or replace function public.get_student_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  r        jsonb;
  v_series jsonb := '[]'::jsonb;
begin
  perform public.adm_require_admin();

  select jsonb_build_object(
           'id', p.id, 'student_code', s.student_code, 'full_name', p.full_name, 'email', p.email,
           'initials', public.adm_initials(p.full_name), 'grade', sp.grade, 'school_name', sp.school_name,
           'registered_at', p.created_at, 'status', coalesce(s.account_status, 'active'),
           'phone', p.phone, 'city', p.location, 'state', g.state_code,
           'last_active_at', s.last_active_at, 'blocked_reason', s.blocked_reason, 'blocked_at', s.blocked_at,
           'onboarded_via', s.onboarded_via)
    into r
    from public.profiles p
    left join public.student_profiles sp on sp.user_id = p.id
    left join public.students s on s.id = p.id
    left join public.user_geo g on g.user_id = p.id
   where p.id = p_id and p.role = 'student';
  if r is null then return null; end if;

  -- Course enrolments (the lead's model) with lesson completion %.
  r := r || jsonb_build_object('enrolled_courses', coalesce((
    select jsonb_agg(jsonb_build_object(
             'course_id', c.id, 'title', c.title, 'enrolled_at', e.enrolled_at, 'is_active', e.is_active,
             'progress', coalesce((
               select round(100.0 * count(*) filter (where lp.status = 'completed')
                            / nullif((select count(*) from public.lessons l where l.course_id = c.id), 0))
                 from public.lesson_progress lp
                where lp.student_id = p_id and lp.course_id = c.id), 0))
           order by e.enrolled_at desc)
      from public.enrollments e
      join public.courses c on c.id = e.course_id
     where e.student_id = p_id), '[]'::jsonb));

  -- Admin-sold test series enrolments (Batch 2 table), when present.
  if to_regclass('public.admin_series_enrollments') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('series_id', ase.series_id, 'title', ts.title,
                                                   'enrolled_at', ase.enrolled_at, 'progress', 0)
                                order by ase.enrolled_at desc), '[]'::jsonb)
        from public.admin_series_enrollments ase
        join public.test_series ts on ts.id = ase.series_id
       where ase.student_id = $1
    $q$ into v_series using p_id;
  end if;
  return r || jsonb_build_object('enrolled_series', v_series);
end $$;

-- ----------------------------------------------------------- block/unblock
create or replace function public.block_student(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_before jsonb;
begin
  perform public.adm_require_admin();
  if not exists (select 1 from public.profiles where id = p_id and role = 'student') then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Please give a reason for blocking this student.' using errcode = '22023';
  end if;
  perform public.adm_ensure_student(p_id);
  select jsonb_build_object('status', account_status) into v_before from public.students where id = p_id for update;
  if v_before ->> 'status' = 'blocked' then
    raise exception 'This student is already blocked.' using errcode = '22023';
  end if;

  update public.students
     set account_status = 'blocked', blocked_reason = btrim(p_reason), blocked_at = now(), blocked_by = auth.uid()
   where id = p_id;
  insert into public.student_block_history (student_id, action, reason, by_admin)
  values (p_id, 'blocked', btrim(p_reason), auth.uid());
  perform public.adm_end_user_sessions(p_id, 'account_blocked');
  perform public.adm_audit('student.block', 'student', p_id, v_before,
                           jsonb_build_object('status', 'blocked'), btrim(p_reason));
end $$;

create or replace function public.unblock_student(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_before jsonb;
begin
  perform public.adm_require_admin();
  if not exists (select 1 from public.profiles where id = p_id and role = 'student') then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;
  perform public.adm_ensure_student(p_id);
  select jsonb_build_object('status', account_status, 'blocked_reason', blocked_reason)
    into v_before from public.students where id = p_id for update;
  if v_before ->> 'status' <> 'blocked' then
    raise exception 'This student is not blocked.' using errcode = '22023';
  end if;

  update public.students
     set account_status = 'active', blocked_reason = null, blocked_at = null, blocked_by = null
   where id = p_id;
  insert into public.student_block_history (student_id, action, by_admin) values (p_id, 'unblocked', auth.uid());
  perform public.adm_audit('student.unblock', 'student', p_id, v_before, jsonb_build_object('status', 'active'), null);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_grade_matches(text, text) from public, anon, authenticated;

revoke all on function public.get_student_stats() from public, anon;
revoke all on function public.list_students(text, text, text, text, int, int) from public, anon;
revoke all on function public.get_student_detail(uuid) from public, anon;
revoke all on function public.block_student(uuid, text) from public, anon;
revoke all on function public.unblock_student(uuid) from public, anon;

grant execute on function public.get_student_stats() to authenticated;
grant execute on function public.list_students(text, text, text, text, int, int) to authenticated;
grant execute on function public.get_student_detail(uuid) to authenticated;
grant execute on function public.block_student(uuid, text) to authenticated;
grant execute on function public.unblock_student(uuid) to authenticated;

-- =====================================================================
-- 20261025100800_admin_rpc_educators.sql
--
-- Purpose
--   Educator Management RPCs (D4, D7, D8). Names and parameters match
--   src/portals/admin/services/educatorsApi.js:
--     list_educators(p_search, p_account, p_verification, p_subject, p_experience, p_sort, p_page, p_size)
--     get_educator_stats()                -> {total_educators, active_educators, pending_verification, suspended_educators}
--     get_educator_detail(p_id)           -> {educator, documents, history, courses}
--     set_educator_verification(p_id, p_decision, p_note)
--     set_educator_account_status(p_id, p_status, p_reason) -> open assignment count
--     delete_educator(p_id)               -> soft delete (account_status 'deleted')
--     create_educator_invites(p_rows)     -> {created, skipped}
--     register_educator(p_user_id, p)     -> service role only (Edge Function)
--     list_educator_documents(p_educator_id)
--     review_educator_document(p_educator_id, p_document_id, p_status, p_note)
--
-- Lead objects read
--   profiles, educator_profiles, educator_verification_docs, courses,
--   course_reviews, enrollments, audit_logs.
-- Lead objects written (runtime, through these RPCs only)
--   educator_profiles.verification_status / verified_at / verified_by / rejected_reason;
--   educator_verification_docs.is_verified / verified_at / verified_by / review_note;
--   register_educator inserts one profiles row (role 'educator') and one
--   educator_profiles row (D8); audit_logs via adm_audit.
--
-- Assumptions
--   * educator_profiles.verification_status has no CHECK (F2). Only pending /
--     verified / rejected are written; under_review / changes_requested live in
--     educator_admin_state.review_state (D7).
--   * educator_profiles.subjects / languages are text-compatible arrays
--     (the dump shows only "ARRAY"); they are read as text[].
--   * Educators are never hard-deleted: lead rows reference profiles.
--   * Document file paths are returned as stored (doc_url); signed URLs come
--     from an Edge Function in Batch 4.
--
-- ROLLBACK
--   drop function if exists public.review_educator_document(uuid, uuid, text, text);
--   drop function if exists public.list_educator_documents(uuid);
--   drop function if exists public.register_educator(uuid, jsonb);
--   drop function if exists public.create_educator_invites(jsonb);
--   drop function if exists public.delete_educator(uuid);
--   drop function if exists public.set_educator_account_status(uuid, text, text);
--   drop function if exists public.set_educator_verification(uuid, text, text);
--   drop function if exists public.get_educator_detail(uuid);
--   drop function if exists public.get_educator_stats();
--   drop function if exists public.list_educators(text, text, text, text, text, text, int, int);
--   drop function if exists public.adm_educator_base();
-- =====================================================================
set search_path = public, extensions;

-- One row per (non-deleted) educator profile. Missing side rows read as
-- active / pending.
create or replace function public.adm_educator_base()
returns table (
  id uuid, educator_code text, full_name text, email text, phone text, subjects text[],
  qualification text, years_experience int, rating numeric, ratings_count bigint, students_count int,
  courses_count int, verification_status text, account_status text, joined_at timestamptz,
  last_active_at timestamptz, status_reason text, onboarded_via text, location text, bio text,
  photo_url text, languages text[], gender text, dob date, review_note text, verified_at timestamptz,
  rejected_reason text, has_profile boolean
)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, st.educator_code,
         coalesce(ep.full_name, p.full_name), p.email, coalesce(nullif(ep.phone, ''), p.phone),
         coalesce(ep.subjects::text[], '{}'::text[]), ep.qualifications, coalesce(ep.experience_years, 0),
         round(ep.rating_avg, 1),
         (select count(*) from public.course_reviews r join public.courses c on c.id = r.course_id
           where c.educator_id = p.id and r.is_visible),
         coalesce(ep.total_students, 0), coalesce(ep.total_courses, 0),
         public.adm_educator_verification_key(ep.verification_status, st.review_state),
         coalesce(st.account_status, 'active'),
         coalesce(ep.created_at, p.created_at), st.last_active_at, st.status_reason,
         coalesce(st.onboarded_via, 'self'), coalesce(ep.location, p.location), ep.bio, ep.photo_url,
         coalesce(ep.languages::text[], '{}'::text[]), st.gender, st.dob, st.review_note, ep.verified_at,
         ep.rejected_reason, ep.user_id is not null
    from public.profiles p
    left join public.educator_profiles ep on ep.user_id = p.id
    left join public.educator_admin_state st on st.user_id = p.id
   where p.role = 'educator'
     and coalesce(st.account_status, 'active') <> 'deleted';
$$;

-- ------------------------------------------------------------------- list
-- p_account: active | inactive | suspended.  p_verification: pending (covers
-- under_review / changes_requested) | under_review | verified | rejected.
-- p_experience: 0-3 | 4-7 | 8-12 | 13+.  p_sort: newest | oldest | rating | students
create or replace function public.list_educators(
  p_search text default null, p_account text default null, p_verification text default null,
  p_subject text default null, p_experience text default null, p_sort text default 'newest',
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 8), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select b.* from public.adm_educator_base() b
     where (v_like is null or b.full_name ilike v_like or b.email ilike v_like
            or coalesce(b.educator_code, '') ilike v_like)
       and (p_account is null or p_account in ('', 'all') or b.account_status = p_account)
       and (p_verification is null or p_verification in ('', 'all')
            or (p_verification in ('pending', 'under_review')
                and b.verification_status in ('pending', 'under_review', 'changes_requested'))
            or b.verification_status = p_verification)
       and (p_subject is null or p_subject in ('', 'all') or p_subject = any (b.subjects))
       and (p_experience is null or p_experience in ('', 'all')
            or (p_experience = '0-3'  and b.years_experience <= 3)
            or (p_experience = '4-7'  and b.years_experience between 4 and 7)
            or (p_experience = '8-12' and b.years_experience between 8 and 12)
            or (p_experience = '13+'  and b.years_experience >= 13))
  )
  select to_jsonb(f) || jsonb_build_object(
           'initials', public.adm_initials(f.full_name),
           'verification_label', case when f.verification_status in ('under_review', 'changes_requested')
                                      then 'pending' else f.verification_status end),
         count(*) over ()
    from f
   order by case when p_sort = 'oldest'   then f.joined_at end asc,
            case when p_sort = 'rating'   then f.rating end desc nulls last,
            case when p_sort = 'students' then f.students_count end desc,
            case when coalesce(p_sort, 'newest') = 'newest' then f.joined_at end desc,
            f.full_name, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- ------------------------------------------------------------------ stats
-- Returns an object (the archived version returned a one-row table, which
-- EducatorVerification.jsx could not read).
create or replace function public.get_educator_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (select jsonb_build_object(
            'total_educators',      count(*),
            'active_educators',     count(*) filter (where b.account_status = 'active'),
            'pending_verification', count(*) filter (where b.verification_status in ('pending', 'under_review', 'changes_requested')),
            'suspended_educators',  count(*) filter (where b.account_status = 'suspended'))
            from public.adm_educator_base() b);
end $$;

-- ---------------------------------------------------------------- documents
create or replace function public.list_educator_documents(p_educator_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'educator_id', d.educator_id, 'doc_type', d.doc_type, 'doc_name', d.doc_name,
             'file_path', d.doc_url,
             'status', case d.is_verified when true then 'approved' when false then 'rejected' else 'pending' end,
             'note', d.review_note, 'uploaded_at', d.created_at,
             'reviewed_by', d.verified_by, 'reviewed_at', d.verified_at)
           order by d.created_at)
      from public.educator_verification_docs d where d.educator_id = p_educator_id), '[]'::jsonb);
end $$;

-- p_status: approved | rejected | pending (pending = "request a replacement")
create or replace function public.review_educator_document(
  p_educator_id uuid, p_document_id uuid, p_status text, p_note text default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_before jsonb;
begin
  perform public.adm_require_admin();
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Unknown document status: %', p_status using errcode = '22023';
  end if;
  if p_status = 'rejected' and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'A reason is required to reject a document.' using errcode = '22023';
  end if;
  select jsonb_build_object('is_verified', d.is_verified, 'review_note', d.review_note)
    into v_before
    from public.educator_verification_docs d
   where d.id = p_document_id and d.educator_id = p_educator_id
   for update;
  if v_before is null then
    raise exception 'Document not found for this educator.' using errcode = 'P0002';
  end if;

  update public.educator_verification_docs
     set is_verified = case p_status when 'approved' then true when 'rejected' then false else null end,
         verified_at = case when p_status = 'pending' then null else now() end,
         verified_by = case when p_status = 'pending' then null else auth.uid() end,
         review_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_document_id;
  perform public.adm_audit('educator.document_review', 'educator_document', p_document_id, v_before,
                           jsonb_build_object('status', p_status, 'educator_id', p_educator_id), p_note);
end $$;

-- ----------------------------------------------------------------- detail
create or replace function public.get_educator_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_educator jsonb;
begin
  perform public.adm_require_admin();
  select to_jsonb(b) || jsonb_build_object('initials', public.adm_initials(b.full_name))
    into v_educator
    from public.adm_educator_base() b where b.id = p_id;
  if v_educator is null then return null; end if;

  return jsonb_build_object(
    'educator', v_educator,
    'documents', public.list_educator_documents(p_id),
    -- Same shape as the archived educator_status_history rows; now read from audit_logs (D9).
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', a.id,
               'kind', case a.action when 'educator.account_status' then 'account' else 'verification' end,
               'from_value', a.before_state ->> 'value', 'to_value', a.after_state ->> 'value',
               'reason', a.reason, 'by_admin', a.actor_id, 'at', a.created_at)
             order by a.created_at desc)
        from public.audit_logs a
       where a.target_type = 'educator' and a.target_id = p_id
         and a.action in ('educator.account_status', 'educator.verification')), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'title', c.title, 'status', c.status,
               'students', (select count(*) from public.enrollments e where e.course_id = c.id and e.is_active),
               'completion_rate', coalesce((select round(100.0 * count(*) filter (where e.completed_at is not null)
                                                         / nullif(count(*), 0))
                                              from public.enrollments e where e.course_id = c.id), 0),
               'rating', coalesce((select round(avg(r.rating), 1) from public.course_reviews r
                                    where r.course_id = c.id and r.is_visible), 0))
             order by c.created_at desc)
        from public.courses c where c.educator_id = p_id), '[]'::jsonb));
end $$;

-- ----------------------------------------------------------- verification
-- p_decision: verified (or approved) | rejected | pending | under_review | changes_requested
create or replace function public.set_educator_verification(p_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_lead     text;
  v_review   text;
  v_old      text;
  v_new      text;
begin
  perform public.adm_require_admin();
  if v_decision = 'approved' then v_decision := 'verified'; end if;
  if v_decision not in ('verified', 'rejected', 'pending', 'under_review', 'changes_requested') then
    raise exception 'Unknown verification decision: %', p_decision using errcode = '22023';
  end if;
  if v_decision in ('rejected', 'changes_requested') and v_note is null then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;

  select ep.verification_status into v_lead
    from public.educator_profiles ep where ep.user_id = p_id for update;
  if not found then
    raise exception 'This educator has not completed their profile yet.' using errcode = 'P0002';
  end if;
  perform public.adm_ensure_educator_state(p_id);
  select st.review_state into v_review from public.educator_admin_state st where st.user_id = p_id for update;
  v_old := public.adm_educator_verification_key(v_lead, v_review);

  if v_decision = 'verified' then
    update public.educator_profiles
       set verification_status = 'verified', verified_at = now(), verified_by = auth.uid(), rejected_reason = null
     where user_id = p_id;
    update public.educator_admin_state set review_state = null, review_note = v_note where user_id = p_id;
  elsif v_decision = 'rejected' then
    update public.educator_profiles set verification_status = 'rejected', rejected_reason = v_note where user_id = p_id;
    update public.educator_admin_state set review_state = null, review_note = v_note where user_id = p_id;
  elsif v_decision = 'pending' then
    update public.educator_profiles set verification_status = 'pending' where user_id = p_id;
    update public.educator_admin_state set review_state = null, review_note = v_note where user_id = p_id;
  else  -- under_review | changes_requested: lead value stays 'pending' (D7)
    update public.educator_profiles set verification_status = 'pending' where user_id = p_id;
    update public.educator_admin_state set review_state = v_decision, review_note = v_note where user_id = p_id;
  end if;

  v_new := v_decision;   -- equals adm_educator_verification_key() of the row just written
  perform public.adm_audit('educator.verification', 'educator', p_id,
                           jsonb_build_object('value', v_old), jsonb_build_object('value', v_new), v_note);
end $$;

-- ---------------------------------------------------------- account status
-- p_status: active | inactive | suspended. Returns the educator's open
-- assignment count (0 until Batch 2 creates test_assignments).
create or replace function public.set_educator_account_status(p_id uuid, p_status text, p_reason text default null)
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  if p_status not in ('active', 'inactive', 'suspended') then
    raise exception 'Unknown account status: %', p_status using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_id and role = 'educator') then
    raise exception 'Educator not found.' using errcode = 'P0002';
  end if;
  perform public.adm_ensure_educator_state(p_id);
  select account_status into v_old from public.educator_admin_state where user_id = p_id for update;
  if v_old = 'deleted' then
    raise exception 'This educator has been deleted.' using errcode = '22023';
  end if;
  if v_old = p_status then
    raise exception 'Educator is already %.', p_status using errcode = '22023';
  end if;

  update public.educator_admin_state
     set account_status = p_status,
         status_reason  = case when p_status = 'active' then null else nullif(btrim(coalesce(p_reason, '')), '') end,
         suspended_at   = case when p_status = 'suspended' then now() else null end
   where user_id = p_id;
  if p_status <> 'active' then
    perform public.adm_end_user_sessions(p_id, 'account_' || p_status);
  end if;
  perform public.adm_audit('educator.account_status', 'educator', p_id,
                           jsonb_build_object('value', v_old), jsonb_build_object('value', p_status), p_reason);
  return public.adm_open_assignment_count(p_id, array['assigned', 'in_progress', 'revision_requested']);
end $$;

-- Soft delete: lead tables reference profiles, so nothing is removed.
create or replace function public.delete_educator(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  if not exists (select 1 from public.profiles where id = p_id and role = 'educator') then
    raise exception 'Educator not found.' using errcode = 'P0002';
  end if;
  if public.adm_open_assignment_count(p_id, array['assigned', 'in_progress', 'submitted', 'under_review', 'revision_requested', 'approved']) > 0 then
    raise exception 'This educator has assignments. Reassign or cancel them first.' using errcode = '23503';
  end if;
  perform public.adm_ensure_educator_state(p_id);
  select account_status into v_old from public.educator_admin_state where user_id = p_id for update;
  if v_old = 'deleted' then return; end if;

  update public.educator_admin_state
     set account_status = 'deleted', deleted_at = now(), status_reason = 'Deleted by admin'
   where user_id = p_id;
  perform public.adm_end_user_sessions(p_id, 'account_deleted');
  perform public.adm_audit('educator.account_status', 'educator', p_id,
                           jsonb_build_object('value', v_old), jsonb_build_object('value', 'deleted'), 'Deleted by admin');
end $$;

-- ------------------------------------------------------------------ invites
-- DB part of "Add teacher" (individual and bulk). The create-educator-invites
-- Edge Function calls this with the admin's JWT, then creates the auth users
-- and calls register_educator with the service role (D8).
-- p_rows: [{name, email, phone?, qualification?, yearsExperience?, subjects?}]
create or replace function public.create_educator_invites(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  r jsonb; v_email text; v_name text; v_years int;
  v_ok int := 0; v_skipped jsonb := '[]'::jsonb;
begin
  perform public.adm_require_admin();
  if jsonb_typeof(coalesce(p_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'Expected an array of invite rows.' using errcode = '22023';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_email := lower(btrim(coalesce(r ->> 'email', '')));
    v_name  := btrim(coalesce(r ->> 'name', ''));
    v_years := case when coalesce(r ->> 'yearsExperience', '') ~ '^\d{1,2}$' then (r ->> 'yearsExperience')::int end;
    if v_email = '' or v_name = '' then
      v_skipped := v_skipped || jsonb_build_object('email', v_email, 'reason', 'Name and email are required');
    elsif v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_skipped := v_skipped || jsonb_build_object('email', v_email, 'reason', 'Invalid email');
    elsif exists (select 1 from public.profiles where lower(email) = v_email)
       or exists (select 1 from public.educator_invites where lower(email) = v_email and status in ('pending', 'sent')) then
      v_skipped := v_skipped || jsonb_build_object('email', v_email, 'reason', 'Already exists');
    else
      insert into public.educator_invites (name, phone, email, qualification, years_experience, subjects, invited_by)
      values (v_name, nullif(btrim(coalesce(r ->> 'phone', '')), ''), v_email,
              nullif(btrim(coalesce(r ->> 'qualification', '')), ''), v_years,
              coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(
                          case when jsonb_typeof(r -> 'subjects') = 'array' then r -> 'subjects' else '[]'::jsonb end) x
                         where btrim(x) <> ''), '{}'),
              auth.uid());
      v_ok := v_ok + 1;
    end if;
  end loop;
  perform public.adm_audit('educator.invites_created', 'educator_invite', null, null,
                           jsonb_build_object('created', v_ok, 'skipped', jsonb_array_length(v_skipped)), null);
  return jsonb_build_object('created', v_ok, 'skipped', v_skipped);
end $$;

-- Service role only (Edge Function, after auth.admin.inviteUserByEmail).
-- Inserts the lead's profiles + educator_profiles rows and our side row (D8).
-- p: {firstName, lastName | name, email, phone, location, qualification,
--     yearsExperience, subjects[], gender, dob, bulk}
create or replace function public.register_educator(p_user_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email    text := lower(btrim(coalesce(p ->> 'email', '')));
  v_bulk     boolean := coalesce((p ->> 'bulk')::boolean, false);
  v_name     text;
  v_existing text;
  v_subjects text[];
begin
  if not (public.adm_is_service_role() or public.adm_is_platform_admin()) then
    raise exception 'Service role or admin access required.' using errcode = '42501';
  end if;
  if p_user_id is null then raise exception 'A user id is required.' using errcode = '22023'; end if;
  if v_email = '' then raise exception 'Email is required.' using errcode = '22023'; end if;

  v_name := coalesce(nullif(btrim(concat_ws(' ', nullif(btrim(p ->> 'firstName'), ''), nullif(btrim(p ->> 'lastName'), ''))), ''),
                     nullif(btrim(p ->> 'name'), ''),
                     split_part(v_email, '@', 1));

  select role into v_existing from public.profiles where id = p_user_id;
  if v_existing is not null and v_existing <> 'educator' then
    raise exception 'This user already exists with role %.', v_existing using errcode = '23505';
  end if;
  if v_existing is null then
    if exists (select 1 from public.profiles where lower(email) = v_email and id <> p_user_id) then
      raise exception 'An account with this email already exists.' using errcode = '23505';
    end if;
    insert into public.profiles (id, role, full_name, email, phone)
    values (p_user_id, 'educator', v_name, v_email, nullif(btrim(coalesce(p ->> 'phone', '')), ''));
  end if;

  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}') into v_subjects
    from jsonb_array_elements_text(case when jsonb_typeof(p -> 'subjects') = 'array' then p -> 'subjects' else '[]'::jsonb end) x;

  insert into public.educator_profiles
    (user_id, full_name, phone, location, verification_status, qualifications, experience_years,
     subjects, total_students, total_courses)
  values
    (p_user_id, v_name, coalesce(nullif(btrim(coalesce(p ->> 'phone', '')), ''), ''),
     coalesce(nullif(btrim(coalesce(p ->> 'location', '')), ''), 'Not provided'), 'pending',
     nullif(btrim(coalesce(p ->> 'qualification', '')), ''),
     case when coalesce(p ->> 'yearsExperience', '') ~ '^\d{1,2}$' then (p ->> 'yearsExperience')::int end,
     v_subjects, 0, 0)
  on conflict (user_id) do nothing;

  insert into public.educator_admin_state (user_id, gender, dob, onboarded_via)
  values (p_user_id, nullif(btrim(coalesce(p ->> 'gender', '')), ''),
          case when coalesce(p ->> 'dob', '') ~ '^\d{4}-\d{2}-\d{2}$' then (p ->> 'dob')::date end,
          case when v_bulk then 'bulk_import' else 'admin_invite' end)
  on conflict (user_id) do nothing;

  update public.educator_invites set user_id = p_user_id
   where lower(email) = v_email and user_id is null and status in ('pending', 'sent');

  perform public.adm_audit('educator.register', 'educator', p_user_id, null,
                           jsonb_build_object('email', v_email, 'bulk', v_bulk), null);
  return p_user_id;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_educator_base() from public, anon, authenticated;

revoke all on function public.list_educators(text, text, text, text, text, text, int, int) from public, anon;
revoke all on function public.get_educator_stats() from public, anon;
revoke all on function public.get_educator_detail(uuid) from public, anon;
revoke all on function public.set_educator_verification(uuid, text, text) from public, anon;
revoke all on function public.set_educator_account_status(uuid, text, text) from public, anon;
revoke all on function public.delete_educator(uuid) from public, anon;
revoke all on function public.create_educator_invites(jsonb) from public, anon;
revoke all on function public.list_educator_documents(uuid) from public, anon;
revoke all on function public.review_educator_document(uuid, uuid, text, text) from public, anon;
revoke all on function public.register_educator(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.list_educators(text, text, text, text, text, text, int, int) to authenticated;
grant execute on function public.get_educator_stats() to authenticated;
grant execute on function public.get_educator_detail(uuid) to authenticated;
grant execute on function public.set_educator_verification(uuid, text, text) to authenticated;
grant execute on function public.set_educator_account_status(uuid, text, text) to authenticated;
grant execute on function public.delete_educator(uuid) to authenticated;
grant execute on function public.create_educator_invites(jsonb) to authenticated;
grant execute on function public.list_educator_documents(uuid) to authenticated;
grant execute on function public.review_educator_document(uuid, uuid, text, text) to authenticated;
grant execute on function public.register_educator(uuid, jsonb) to service_role;

-- =====================================================================
-- 20261025100900_admin_rpc_security.sql
--
-- Purpose
--   Security Center and Audit Logs RPCs (securityApi.js):
--     list_active_sessions()                          (replaces a direct user_sessions read, D4)
--     revoke_user_sessions(p_user_id, p_reason)       DB part; Batch 4 Edge Function revokes tokens
--     sign_out_other_devices()                        DB part
--     list_auth_events(p_user_id, p_event, p_page, p_size)
--
-- Lead objects read
--   profiles. The auth schema is never read or written (D6).
--
-- Assumptions
--   * These RPCs only mark user_sessions rows as ended and record events in
--     admin_auth_events. Real refresh-token revocation happens in the
--     revoke-user-sessions Edge Function through the Admin API (Batch 4).
--
-- ROLLBACK
--   drop function if exists public.list_auth_events(uuid, text, int, int);
--   drop function if exists public.sign_out_other_devices();
--   drop function if exists public.revoke_user_sessions(uuid, text);
--   drop function if exists public.list_active_sessions();
-- =====================================================================
set search_path = public, extensions;

-- [{session_id, user_id, user_name, email, role, user_agent, started_at, last_seen_at, ended_at, end_reason, is_current}]
create or replace function public.list_active_sessions() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_sid uuid := public.adm_current_session_id();
begin
  perform public.adm_require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'session_id', s.session_id, 'user_id', s.user_id, 'user_name', p.full_name, 'email', p.email,
             'role', s.role, 'user_agent', s.user_agent, 'started_at', s.started_at,
             'last_seen_at', s.last_seen_at, 'ended_at', s.ended_at, 'end_reason', s.end_reason,
             'is_current', s.session_id = v_sid)
           order by s.last_seen_at desc)
      from (select * from public.user_sessions where ended_at is null order by last_seen_at desc limit 200) s
      left join public.profiles p on p.id = s.user_id), '[]'::jsonb);
end $$;

create or replace function public.revoke_user_sessions(p_user_id uuid, p_reason text default 'admin_action') returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform public.adm_require_admin();
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  n := public.adm_end_user_sessions(p_user_id, coalesce(nullif(btrim(p_reason), ''), 'admin_action'));
  perform public.adm_audit('auth.sessions_revoked', 'user', p_user_id, null,
                           jsonb_build_object('sessions', n), p_reason);
  return n;
end $$;

create or replace function public.sign_out_other_devices() returns int
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return public.adm_end_user_sessions(auth.uid(), 'user_requested', public.adm_current_session_id());
end $$;

-- Rows: {id, user, email, role, event_type, user_agent, meta, at}
create or replace function public.list_auth_events(
  p_user_id uuid default null, p_event text default null, p_page int default 1, p_size int default 20
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_size int := least(greatest(coalesce(p_size, 20), 1), 100);
  v_page int := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  select jsonb_build_object('id', e.id, 'user', p.full_name, 'email', p.email, 'role', e.role,
                            'event_type', e.event_type, 'user_agent', e.user_agent, 'meta', e.meta,
                            'at', e.created_at),
         count(*) over ()
    from public.admin_auth_events e
    left join public.profiles p on p.id = e.user_id
   where (p_user_id is null or e.user_id = p_user_id)
     and (p_event is null or p_event in ('', 'all') or e.event_type = p_event)
   order by e.created_at desc, e.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

revoke all on function public.list_active_sessions() from public, anon;
revoke all on function public.revoke_user_sessions(uuid, text) from public, anon;
revoke all on function public.sign_out_other_devices() from public, anon;
revoke all on function public.list_auth_events(uuid, text, int, int) from public, anon;

grant execute on function public.list_active_sessions() to authenticated;
grant execute on function public.revoke_user_sessions(uuid, text) to authenticated;
grant execute on function public.sign_out_other_devices() to authenticated;
grant execute on function public.list_auth_events(uuid, text, int, int) to authenticated;

-- =====================================================================
-- 20261025110000_admin_b2_preflight.sql
--
-- Purpose
--   Read-only assertions for Batch 2 (test authoring). Aborts if Batch 1 is
--   missing, if a lead column the authoring RPCs map onto is missing, or if no
--   admin profile exists. Then collects EVERY clash in one pass and raises a
--   single error listing all of them: any public function with a name this
--   batch creates (every overload, shown with its signature), any table /
--   sequence name taken, the house-course slug or setting, and the
--   question-images bucket or its policy names.
--
-- Lead objects read
--   information_schema.columns, pg_proc / pg_namespace, pg_class, pg_policies,
--   storage.buckets, public.courses (slug lookup), public.platform_settings
--   (key lookup), public.profiles (count of admin rows only).
--
-- Assumptions
--   * Batch 1 has been applied (adm_is_platform_admin etc. exist).
--   * Function clashes are found by name in pg_proc joined to pg_namespace
--     (not to_regproc / to_regprocedure), so overloads with any argument list
--     are reported. Example: the lead's publish_test_series(uuid, boolean) is
--     why our publish RPC is named adm_publish_test_series.
--   * The function list below must name every function created by the
--     20261025110100..20261025110900 files (checked offline; see
--     docs/PORT_PROGRESS.md).
--
-- ROLLBACK
--   Nothing to roll back: no DDL, no data changes.
-- =====================================================================
set search_path = public, extensions;

-- 1. Batch 1 present; lead columns used by the authoring mapping (D3) and the
--    house course (D2) exist; an admin profile exists to own the house course
do $$
declare
  v_missing text[] := '{}';
  r record;
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'adm_is_platform_admin') then
    raise exception 'Admin port Batch 2 preflight: Batch 1 is not applied (adm_is_platform_admin missing).'
      using errcode = 'P0001';
  end if;
  for r in
    select * from (values
      ('test_series','id'), ('test_series','course_id'), ('test_series','title'), ('test_series','description'),
      ('test_series','instructions'), ('test_series','is_active'), ('test_series','is_published'),
      ('test_series','available_from'), ('test_series','available_until'), ('test_series','created_at'),
      ('test_series','updated_at'),
      ('quizzes','id'), ('quizzes','course_id'), ('quizzes','lesson_id'), ('quizzes','series_id'),
      ('quizzes','series_sort_order'), ('quizzes','title'), ('quizzes','description'), ('quizzes','time_limit_mins'),
      ('quizzes','max_attempts'), ('quizzes','passing_score'), ('quizzes','shuffle_questions'),
      ('quizzes','created_at'), ('quizzes','updated_at'), ('quizzes','is_required'),
      ('quizzes','show_answers_after'), ('quizzes','is_proctored'),
      ('quiz_questions','created_at'), ('quiz_questions','id'), ('quiz_questions','quiz_id'), ('quiz_questions','question_text'),
      ('quiz_questions','question_type'), ('quiz_questions','points'), ('quiz_questions','explanation'),
      ('quiz_questions','sort_order'),
      ('quiz_question_options','id'), ('quiz_question_options','question_id'), ('quiz_question_options','option_text'),
      ('quiz_question_options','is_correct'), ('quiz_question_options','sort_order'),
      ('quiz_attempts','id'), ('quiz_attempts','quiz_id'), ('quiz_attempts','student_id'), ('quiz_attempts','score'),
      ('quiz_attempts','max_score'), ('quiz_attempts','percentage'), ('quiz_attempts','status'),
      ('quiz_attempts','started_at'), ('quiz_attempts','submitted_at'), ('quiz_attempts','time_taken_secs'),
      ('quiz_answers','id'), ('quiz_answers','attempt_id'), ('quiz_answers','question_id'),
      ('courses','id'), ('courses','educator_id'), ('courses','org_unit_id'), ('courses','category_id'),
      ('courses','title'), ('courses','slug'), ('courses','short_description'), ('courses','description'),
      ('courses','language'), ('courses','level'), ('courses','price'), ('courses','currency'), ('courses','status'),
      ('courses','completion_criteria'), ('courses','video_completion_threshold'), ('courses','allow_resubmission'),
      ('courses','is_featured'), ('courses','join_policy'), ('courses','created_at'), ('courses','updated_at'),
      ('categories','id'), ('categories','name'),
      ('enrollments','student_id'), ('enrollments','course_id'), ('enrollments','is_active'), ('enrollments','enrolled_at')
    ) as t(tbl, col)
  loop
    if not exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col) then
      v_missing := v_missing || (r.tbl || '.' || r.col);
    end if;
  end loop;
  if cardinality(v_missing) > 0 then
    raise exception 'Admin port Batch 2 preflight: expected lead columns are missing: %', array_to_string(v_missing, ', ')
      using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where role in ('admin', 'super_admin')) then
    raise exception 'Admin port Batch 2 preflight: no admin or super_admin profile exists to own the house course.'
      using errcode = 'P0001';
  end if;
  if to_regclass('storage.buckets') is null then
    raise exception 'Admin port Batch 2 preflight: storage.buckets not found.' using errcode = 'P0001';
  end if;
end $$;

-- 2. Every clash, collected and reported in one error
do $$
declare
  v_taken text[] := '{}';
  v_add   text[];
begin
  -- tables and sequences
  select coalesce(array_agg('relation ' || x.name order by x.name), '{}') into v_add
    from unnest(array[
      'test_series_admin', 'quiz_admin', 'quiz_question_admin', 'test_sections', 'ai_test_jobs',
      'ai_generated_questions', 'question_similarity_matches', 'series_requests', 'test_assignments',
      'assignment_status_progress', 'assignment_comments', 'assignment_history', 'assignment_notifications',
      'admin_series_enrollments',
      'adm_series_code_seq', 'adm_assignment_code_seq', 'adm_request_code_seq'
    ]) as x(name)
   where to_regclass('public.' || x.name) is not null;
  v_taken := v_taken || v_add;

  -- functions: every overload in public that has one of these names
  select coalesce(array_agg('function ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
                            order by p.proname, pg_get_function_identity_arguments(p.oid)), '{}') into v_add
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any (array[
       -- helpers
       'adm_house_course_id', 'adm_norm_text', 'adm_map_question_type', 'adm_ui_question_type',
       'adm_series_rows', 'adm_series_students', 'adm_series_educators', 'adm_series_json',
       'adm_question_json', 'adm_test_json', 'adm_insert_question', 'adm_insert_options', 'adm_text_answer',
       'adm_apply_test_fields',
       'adm_delete_quiz', 'adm_copy_quiz', 'adm_sync_series_to_lead', 'adm_set_series_availability',
       'adm_ensure_series_admin', 'adm_require_series', 'adm_require_quiz', 'adm_subject_category',
       'adm_validate_quiz_for_publish', 'adm_complete_assignments_for_quiz', 'adm_eligible_educators',
       'adm_assignment_rows', 'adm_asg_log', 'adm_asg_notify', 'adm_new_house_series', 'adm_series_tracker_rows',
       'adm_tpa_tests', 'adm_tpa_attempts', 'adm_review_match', 'adm_detect_repeated_questions',
       -- test series (publish is adm_publish_test_series: the lead owns publish_test_series)
       'get_test_series_stats', 'list_test_series', 'get_test_series', 'create_test_series', 'update_test_series',
       'delete_test_series', 'adm_publish_test_series', 'release_scheduled_series', 'duplicate_test_series', 'save_wizard_draft',
       'discard_wizard_draft', 'series_name_exists', 'upsert_test_series_full',
       -- tests / sections / questions / options
       'create_test', 'update_test', 'delete_test', 'duplicate_test', 'set_test_status',
       'create_test_section', 'update_test_section', 'delete_test_section',
       'create_question', 'update_question', 'delete_question',
       'create_question_option', 'update_question_option', 'delete_question_option',
       -- assignments
       'list_assignments', 'get_assignment_detail', 'list_series_requests', 'list_eligible_educators',
       'list_series_options', 'create_assignments', 'update_assignment_requirements', 'reassign_educator',
       'extend_deadline', 'cancel_assignment', 'start_review', 'review_submission', 'assign_request', 'reject_request',
       -- tracker / similarity
       'get_tracker_stats', 'list_series_tracker', 'get_series_tracker_detail', 'detect_repeated_questions',
       'list_repeated_matches', 'get_match_counts', 'mark_match_reviewed', 'dismiss_match', 'flag_match_confirmed',
       -- analytics
       'get_tpa_filter_options', 'get_tpa_summary', 'get_tpa_subject_scores', 'get_tpa_series_engagement',
       'get_tpa_test_comparison', 'get_tpa_leaderboard', 'export_tpa_rows', 'log_export'
     ]);
  v_taken := v_taken || v_add;

  -- house course (D2)
  if exists (select 1 from public.courses where slug = 'platform-test-series-house') then
    v_taken := v_taken || 'courses.slug platform-test-series-house'::text;
  end if;
  if exists (select 1 from public.platform_settings where key = 'admin_house_course_id') then
    v_taken := v_taken || 'platform_settings key admin_house_course_id'::text;
  end if;

  -- storage bucket and its policies
  if exists (select 1 from storage.buckets where id = 'question-images') then
    v_taken := v_taken || 'storage bucket question-images'::text;
  end if;
  select coalesce(array_agg('storage.objects policy ' || pol.policyname order by pol.policyname), '{}') into v_add
    from pg_policies pol
   where pol.schemaname = 'storage' and pol.tablename = 'objects'
     and pol.policyname in ('adm_question_images_admin_write', 'adm_question_images_read');
  v_taken := v_taken || v_add;

  if cardinality(v_taken) > 0 then
    raise exception 'Admin port Batch 2 preflight: % name(s) already exist: %',
      cardinality(v_taken), array_to_string(v_taken, '; ')
      using errcode = 'P0001';
  end if;
end $$;

-- =====================================================================
-- 20261025110100_admin_b2_authoring_tables.sql
--
-- Purpose
--   1:1 extension tables for the lead's authoring tables (D3), plus admin-only
--   authoring tables:
--     test_series_admin    (series_id  -> test_series.id)
--     quiz_admin           (quiz_id    -> quizzes.id)
--     test_sections        (quiz_id    -> quizzes.id)
--     ai_test_jobs, ai_generated_questions
--     quiz_question_admin  (question_id -> quiz_questions.id)
--     question_similarity_matches
--     admin_series_enrollments (series_id, student_id, enrolled_at, amount_paid)
--   and the question-images storage bucket with policies for that bucket only.
--
-- Lead objects referenced (FK targets only; nothing on them is altered)
--   test_series, quizzes, quiz_questions, categories, profiles.
--
-- Assumptions
--   * Extension tables hold only what the lead's tables lack. Series title,
--     description (wizard "about"), instructions, availability window
--     (available_from / available_until), is_published and is_active live in
--     test_series; test title, instructions (quizzes.description), duration,
--     attempt limit, pass percent, shuffle questions, order and show-answers
--     live in quizzes. test_series_admin keeps code, status, pricing,
--     price_inr, subject_category_id / subject_label, grade, exam, level,
--     languages, who_for, audience, syllabus, start_method, go-live scheduling,
--     monthly / access / late limits, build_deadline, cover_path, wizard_state,
--     published_at, created_by and deleted_at.
--   * Extension rows are deleted with their lead row (on delete cascade).
--     Lead FKs between quizzes / quiz_questions / options do NOT cascade, so
--     the RPCs delete in child-first order.
--   * Storage policies on storage.objects are created only for
--     bucket_id = 'question-images'.
--
-- ROLLBACK
--   drop policy if exists adm_question_images_read on storage.objects;
--   drop policy if exists adm_question_images_admin_write on storage.objects;
--   delete from storage.buckets where id = 'question-images';   -- only if it holds no objects
--   drop table if exists public.admin_series_enrollments, public.question_similarity_matches,
--     public.quiz_question_admin, public.ai_generated_questions, public.ai_test_jobs,
--     public.test_sections, public.quiz_admin, public.test_series_admin;
--   drop sequence if exists public.adm_series_code_seq;
-- =====================================================================
set search_path = public, extensions;

create sequence if not exists public.adm_series_code_seq start 1001;   -- TS-1001

-- ---------------------------------------------------------- test_series_admin
create table if not exists public.test_series_admin (
  series_id            uuid primary key references public.test_series(id) on delete cascade,
  code                 text not null unique default ('TS-' || nextval('public.adm_series_code_seq')),
  status               text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  who_for              text,
  audience             text,
  syllabus             text,
  start_method         text check (start_method in ('scratch', 'duplicate', 'csv', 'ai', 'manual')),
  pricing              text not null default 'free' check (pricing in ('free', 'paid')),
  price_inr            numeric(10,2) not null default 0 check (price_inr >= 0),
  subject_category_id  uuid references public.categories(id) on delete set null,
  subject_label        text,                      -- subject text when no category matches (D9: categories are read-only)
  grade                text,
  exam                 text,
  level                text,
  languages            text[] not null default '{}',
  go_live_mode        text not null default 'now' check (go_live_mode in ('now', 'schedule')),
  go_live_at           timestamptz,
  monthly_limit        int check (monthly_limit is null or monthly_limit >= 1),
  access_days          int check (access_days is null or access_days >= 1),
  late_allowed         boolean not null default false,
  late_grace_minutes   int check (late_grace_minutes is null or late_grace_minutes > 0),
  build_deadline       date,
  cover_path           text,
  wizard_state         jsonb,
  published_at         timestamptz,
  created_by           uuid references public.profiles(id) on delete set null,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint test_series_admin_paid_price check (pricing = 'free' or price_inr > 0),
  constraint test_series_admin_golive check (go_live_mode <> 'schedule' or go_live_at is not null),
  constraint test_series_admin_late check (not late_allowed or late_grace_minutes is not null)
);
create index if not exists test_series_admin_status_idx on public.test_series_admin (status) where deleted_at is null;

-- ------------------------------------------------------------------ quiz_admin
create table if not exists public.quiz_admin (
  quiz_id              uuid primary key references public.quizzes(id) on delete cascade,
  status               text not null default 'draft' check (status in ('draft', 'published')),
  total_marks_planned  numeric(8,2),
  passing_marks        numeric(8,2),
  shuffle_options      boolean not null default false,
  window_mode          text not null default 'inherit' check (window_mode in ('inherit', 'custom')),
  open_at              timestamptz,
  close_at             timestamptz,
  scheduled_at         timestamptz,
  planned_questions    int not null default 0,
  topics               text[] not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint quiz_admin_window check (window_mode <> 'custom' or (open_at is not null and close_at is not null and open_at < close_at))
);

create table if not exists public.test_sections (
  id                 uuid primary key default gen_random_uuid(),
  quiz_id            uuid not null references public.quizzes(id) on delete cascade,
  position           int  not null,
  name               text not null,
  instructions       text,
  planned_questions  int,
  planned_marks      numeric(8,2),
  unique (quiz_id, position)
);

-- ---------------------------------------------------------------- AI builder
create table if not exists public.ai_test_jobs (
  id                      uuid primary key default gen_random_uuid(),
  requested_by            uuid not null references public.profiles(id) on delete cascade,
  input_source            text not null default 'form' check (input_source in ('form', 'paste_paper')),
  pasted_text             text,
  test_name               text not null,
  subject_id              uuid references public.categories(id) on delete set null,
  custom_subject          text,
  topics                  text[] not null default '{}',
  exam_type               text,
  difficulty              text check (difficulty in ('Easy', 'Medium', 'Hard', 'Mixed')),
  total_marks             int,
  duration_minutes        int,
  num_questions           int check (num_questions between 1 and 300),
  num_sections            int check (num_sections between 1 and 10),
  question_types          text[] not null default '{mcq}',
  negative_marking        boolean not null default false,
  negative_mark_value     numeric(4,2) not null default 1,
  language                text not null default 'English',
  additional_instructions text,
  generation_mode         text not null default 'full' check (generation_mode in ('full', 'structure_only', 'questions_for_structure')),
  status                  text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'saved')),
  structure               jsonb,
  model                   text,
  prompt                  text,
  input_tokens            int not null default 0,
  output_tokens           int not null default 0,
  cost_usd                numeric(10,4) not null default 0,
  attempts                int not null default 0,
  error                   text,
  series_id               uuid references public.test_series(id) on delete set null,
  test_id                 uuid references public.quizzes(id) on delete set null,
  created_at              timestamptz not null default now(),
  started_at              timestamptz,
  completed_at            timestamptz
);
create index if not exists ai_test_jobs_user_idx on public.ai_test_jobs (requested_by, created_at desc);

create table if not exists public.ai_generated_questions (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.ai_test_jobs(id) on delete cascade,
  section_position    int,
  position            int not null,
  type                text not null default 'mcq',
  body                text not null,
  options             jsonb,
  correct_keys        text[] not null default '{}',
  marks               numeric(6,2) not null default 4,
  negative_marks      numeric(6,2) not null default 0,
  difficulty          text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  subject             text,
  topic               text,
  explanation         text,
  answer_instructions text,
  issues              text[] not null default '{}',
  review_state        text not null default 'pending' check (review_state in ('pending', 'accepted', 'edited', 'rejected')),
  unique (job_id, position)
);

-- -------------------------------------------------------- quiz_question_admin
-- admin_type keeps the UI / archived type (objective, subjective, mcq, mcq_multi,
-- multi_select, true_false, numerical, fill_blank, short_answer, long_answer);
-- quiz_questions.question_type holds the lead's mapped value (D3, F5).
create table if not exists public.quiz_question_admin (
  question_id           uuid primary key references public.quiz_questions(id) on delete cascade,
  admin_type            text not null,
  needs_manual_grading  boolean not null default false,
  section_id            uuid references public.test_sections(id) on delete set null,
  negative_marks        numeric(6,2) not null default 0 check (negative_marks >= 0),
  difficulty            text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  subject               text,
  topic                 text,
  image_path            text,
  answer_instructions   text,
  source                text not null default 'manual' check (source in ('manual', 'ai', 'csv', 'duplicate', 'paste')),
  ai_job_id             uuid references public.ai_test_jobs(id) on delete set null,
  updated_at            timestamptz not null default now()
);
create index if not exists quiz_question_admin_section_idx on public.quiz_question_admin (section_id);

-- ------------------------------------------------- question_similarity_matches
create table if not exists public.question_similarity_matches (
  id                 uuid primary key default gen_random_uuid(),
  pair_key           text not null unique,                        -- "<smaller id>::<larger id>"
  question_a_id      uuid not null references public.quiz_questions(id) on delete cascade,
  question_b_id      uuid not null references public.quiz_questions(id) on delete cascade,
  similarity_percent int  not null check (similarity_percent between 0 and 100),
  match_type         text not null check (match_type in ('exact', 'high', 'possible')),
  same_series        boolean not null default false,
  same_test          boolean not null default false,
  review_status      text not null default 'unreviewed' check (review_status in ('unreviewed', 'reviewed', 'dismissed', 'confirmed')),
  review_note        text,
  reviewed_by        uuid references public.profiles(id) on delete set null,
  reviewed_at        timestamptz,
  detected_at        timestamptz not null default now(),
  check (question_a_id <> question_b_id)
);
create index if not exists qsm_review_idx on public.question_similarity_matches (review_status, match_type);

-- --------------------------------------------------- admin_series_enrollments
-- Direct enrolment in an admin-sold series (the lead grants access by course
-- enrolment). Filled by the payments port later (D1); read by analytics now.
create table if not exists public.admin_series_enrollments (
  id             uuid primary key default gen_random_uuid(),
  series_id      uuid not null references public.test_series(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  enrolled_at    timestamptz not null default now(),
  expires_at     timestamptz,
  amount_paid    numeric(10,2) not null default 0 check (amount_paid >= 0),
  revoked_at     timestamptz,
  revoke_reason  text,
  unique (series_id, student_id)
);
create index if not exists admin_series_enrollments_student_idx on public.admin_series_enrollments (student_id);

-- ------------------------------------------------ foreign-key indexes
-- Every column that references a lead table is indexed (FK audit).
create index if not exists test_series_admin_subject_idx    on public.test_series_admin (subject_category_id) where subject_category_id is not null;
create index if not exists test_series_admin_created_by_idx on public.test_series_admin (created_by) where created_by is not null;
create index if not exists ai_test_jobs_subject_idx         on public.ai_test_jobs (subject_id) where subject_id is not null;
create index if not exists ai_test_jobs_series_idx          on public.ai_test_jobs (series_id) where series_id is not null;
create index if not exists ai_test_jobs_test_idx            on public.ai_test_jobs (test_id) where test_id is not null;
create index if not exists quiz_question_admin_ai_job_idx   on public.quiz_question_admin (ai_job_id) where ai_job_id is not null;
create index if not exists qsm_question_a_idx               on public.question_similarity_matches (question_a_id);
create index if not exists qsm_question_b_idx               on public.question_similarity_matches (question_b_id);
create index if not exists qsm_reviewed_by_idx              on public.question_similarity_matches (reviewed_by) where reviewed_by is not null;

-- ------------------------------------------------------------------ triggers
drop trigger if exists trg_test_series_admin_touch on public.test_series_admin;
create trigger trg_test_series_admin_touch before update on public.test_series_admin
  for each row execute function public.adm_touch_updated_at();
drop trigger if exists trg_quiz_admin_touch on public.quiz_admin;
create trigger trg_quiz_admin_touch before update on public.quiz_admin
  for each row execute function public.adm_touch_updated_at();
drop trigger if exists trg_quiz_question_admin_touch on public.quiz_question_admin;
create trigger trg_quiz_question_admin_touch before update on public.quiz_question_admin
  for each row execute function public.adm_touch_updated_at();

-- ----------------------------------------------------------------------- RLS
alter table public.test_series_admin           enable row level security;
alter table public.quiz_admin                  enable row level security;
alter table public.test_sections               enable row level security;
alter table public.ai_test_jobs                enable row level security;
alter table public.ai_generated_questions      enable row level security;
alter table public.quiz_question_admin         enable row level security;
alter table public.question_similarity_matches enable row level security;
alter table public.admin_series_enrollments    enable row level security;
revoke all on table public.test_series_admin, public.quiz_admin, public.test_sections, public.ai_test_jobs,
  public.ai_generated_questions, public.quiz_question_admin, public.question_similarity_matches,
  public.admin_series_enrollments from anon, authenticated;
revoke all on sequence public.adm_series_code_seq from public, anon, authenticated;

-- ------------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', false, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists adm_question_images_admin_write on storage.objects;
create policy adm_question_images_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'question-images' and public.adm_is_platform_admin())
  with check (bucket_id = 'question-images' and public.adm_is_platform_admin());

drop policy if exists adm_question_images_read on storage.objects;
create policy adm_question_images_read on storage.objects for select to authenticated
  using (bucket_id = 'question-images');

-- =====================================================================
-- 20261025110200_admin_b2_house_course.sql
--
-- Purpose
--   D2: one hidden "house course" that every admin-created test series is
--   attached to, because test_series.course_id is NOT NULL (F8) and is not
--   altered. Its id is stored in platform_settings 'admin_house_course_id'.
--
-- Lead objects written
--   public.courses           one row (slug 'platform-test-series-house', status 'draft'),
--                            guarded by WHERE NOT EXISTS.
--   public.platform_settings one row (key 'admin_house_course_id'), ON CONFLICT DO NOTHING.
--
-- Assumptions
--   * Every NOT NULL column of courses is filled explicitly (values equal to the
--     lead's DDL defaults): educator_id, title, slug, language, price, currency,
--     status, completion_criteria, video_completion_threshold, allow_resubmission,
--     is_featured, join_policy, created_at, updated_at.
--   * educator_id = the oldest admin / super_admin profile. That account will see
--     this draft course if it ever opens the teacher portal.
--   * status 'draft' keeps the course (and its series) out of the lead's
--     student catalogue, as far as the lead's app filters on status.
--
-- ROLLBACK (only after every series on the house course has been removed)
--   delete from public.platform_settings where key = 'admin_house_course_id';
--   delete from public.courses where slug = 'platform-test-series-house'
--     and not exists (select 1 from public.test_series where course_id = courses.id);
-- =====================================================================
set search_path = public, extensions;

do $$
declare
  v_owner  uuid;
  v_course uuid;
begin
  select p.id into v_owner
    from public.profiles p
   where p.role in ('admin', 'super_admin')
   order by p.created_at, p.id
   limit 1;
  if v_owner is null then
    raise exception 'House course: no admin or super_admin profile exists.' using errcode = 'P0001';
  end if;

  insert into public.courses
    (educator_id, org_unit_id, category_id, title, slug, short_description, description,
     language, level, price, currency, status, completion_criteria, video_completion_threshold,
     allow_resubmission, is_featured, join_policy, created_at, updated_at)
  select v_owner, null, null,
         'Platform test series (internal)', 'platform-test-series-house',
         'Internal container for admin-created test series. Do not publish.',
         'Created by the admin portal. Every standalone test series created by platform admins is attached here because test_series.course_id is required.',
         'English', 'all_levels', 0, 'INR', 'draft',
         '{"required_assessments": true, "min_lesson_completion": 100}'::jsonb, 90.0,
         true, false, 'approval', now(), now()
   where not exists (select 1 from public.courses where slug = 'platform-test-series-house');

  select id into v_course from public.courses where slug = 'platform-test-series-house';

  insert into public.platform_settings (key, value, description)
  values ('admin_house_course_id', to_jsonb(v_course::text),
          'courses.id that admin-created test series are attached to (admin portal, D2)')
  on conflict (key) do nothing;
end $$;

-- =====================================================================
-- 20261025110300_admin_b2_assignment_tables.sql
--
-- Purpose
--   Assign Educators tables in their final, merged shape (archived 0002 and
--   0003 defined test_assignments twice):
--     series_requests, test_assignments, assignment_status_progress (+seed),
--     assignment_comments, assignment_history, assignment_notifications.
--   Column names honour the Batch 1 contract read dynamically by
--   get_admin_nav / get_series_approvals / adm_open_assignment_count:
--   id, series_id, educator_id, test_name, deadline (date), status (text).
--
-- Lead objects referenced (FK targets only)
--   test_series, quizzes, quiz_questions, profiles.
--
-- Assumptions
--   * Educator-side transitions (assigned -> in_progress -> submitted) belong
--     to the teacher portal and are not part of this port.
--
-- ROLLBACK
--   drop table if exists public.assignment_notifications, public.assignment_history,
--     public.assignment_comments, public.test_assignments, public.assignment_status_progress,
--     public.series_requests;
--   drop sequence if exists public.adm_assignment_code_seq, public.adm_request_code_seq;
-- =====================================================================
set search_path = public, extensions;

create sequence if not exists public.adm_assignment_code_seq start 5001;   -- ASG-5001
create sequence if not exists public.adm_request_code_seq    start 6001;   -- REQ-6001

create table if not exists public.series_requests (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique default ('REQ-' || nextval('public.adm_request_code_seq')),
  series_id          uuid references public.test_series(id) on delete set null,   -- null = brand-new series
  series_name        text not null,
  subject            text,
  topics             text[] not null default '{}',
  test_name          text not null,
  sent_by            text,
  sent_date          date not null default current_date,
  question_count     int check (question_count between 1 and 300),
  question_type_mix  text not null default 'mixed' check (question_type_mix in ('objective', 'subjective', 'mixed')),
  difficulty         text check (difficulty in ('Easy', 'Medium', 'Hard', 'Mixed')),
  total_marks        numeric(8,2),
  duration_minutes   int check (duration_minutes > 0),
  instructions       text,
  requested_deadline date,
  status             text not null default 'pending' check (status in ('pending', 'assigned', 'rejected')),
  decision_at        timestamptz,
  decision_reason    text,
  created_at         timestamptz not null default now()
);
create index if not exists series_requests_status_idx on public.series_requests (status, sent_date desc);

create table if not exists public.test_assignments (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique default ('ASG-' || nextval('public.adm_assignment_code_seq')),
  series_id         uuid not null references public.test_series(id) on delete cascade,
  educator_id       uuid not null references public.profiles(id) on delete cascade,
  test_name         text,
  subject           text,
  topics            text[] not null default '{}',
  question_count    int not null default 20 check (question_count between 1 and 300),
  question_type_mix text not null default 'mixed' check (question_type_mix in ('objective', 'subjective', 'mixed')),
  difficulty        text not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard', 'Mixed')),
  total_marks       numeric(8,2) not null default 100,
  duration_minutes  int not null default 60 check (duration_minutes > 0),
  instructions      text,
  assigned_date     date not null default current_date,
  deadline          date,
  status            text not null default 'assigned'
                    check (status in ('assigned', 'in_progress', 'submitted', 'under_review', 'revision_requested',
                                      'approved', 'rejected', 'completed', 'cancelled')),
  request_id        uuid references public.series_requests(id) on delete set null,
  test_id           uuid references public.quizzes(id) on delete set null,   -- the test the educator built
  cancel_reason     text,
  submitted_at      timestamptz,
  overall_feedback  text,
  decision          text check (decision in ('approved', 'revision_requested', 'rejected')),
  decision_at       timestamptz,
  decision_reason   text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists test_assignments_series_idx   on public.test_assignments (series_id);
create index if not exists test_assignments_educator_idx on public.test_assignments (educator_id, status);
create index if not exists test_assignments_deadline_idx on public.test_assignments (deadline);
create index if not exists test_assignments_status_idx   on public.test_assignments (status);
create index if not exists test_assignments_test_idx     on public.test_assignments (test_id) where test_id is not null;

create table if not exists public.assignment_status_progress (
  status   text primary key,
  progress int not null check (progress between 0 and 100)
);
insert into public.assignment_status_progress (status, progress) values
  ('assigned', 5), ('in_progress', 40), ('submitted', 75), ('under_review', 75), ('revision_requested', 55),
  ('approved', 95), ('completed', 100), ('rejected', 0), ('cancelled', 0)
on conflict (status) do nothing;

create table if not exists public.assignment_comments (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.test_assignments(id) on delete cascade,
  question_id   uuid references public.quiz_questions(id) on delete set null,
  question_ref  text,
  comment       text not null,
  author_id     uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists assignment_comments_idx on public.assignment_comments (assignment_id);

create table if not exists public.assignment_history (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.test_assignments(id) on delete cascade,
  action        text not null,
  by_user       uuid references public.profiles(id) on delete set null,
  note          text,
  at            timestamptz not null default now()
);
create index if not exists assignment_history_idx on public.assignment_history (assignment_id, at);

create table if not exists public.assignment_notifications (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.test_assignments(id) on delete cascade,
  educator_id   uuid not null references public.profiles(id) on delete cascade,
  type          text not null check (type in ('assigned', 'updated', 'deadline_changed', 'revision_requested',
                                              'approved', 'rejected', 'cancelled')),
  title         text not null,
  message       text,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists assignment_notifications_idx on public.assignment_notifications (educator_id, is_read, created_at desc);

-- foreign-key indexes (FK audit): every column referencing a lead table
create index if not exists series_requests_series_idx        on public.series_requests (series_id) where series_id is not null;
create index if not exists test_assignments_request_idx      on public.test_assignments (request_id) where request_id is not null;
create index if not exists test_assignments_created_by_idx   on public.test_assignments (created_by) where created_by is not null;
create index if not exists assignment_comments_question_idx  on public.assignment_comments (question_id) where question_id is not null;
create index if not exists assignment_comments_author_idx    on public.assignment_comments (author_id) where author_id is not null;
create index if not exists assignment_history_by_user_idx    on public.assignment_history (by_user) where by_user is not null;

drop trigger if exists trg_test_assignments_touch on public.test_assignments;
create trigger trg_test_assignments_touch before update on public.test_assignments
  for each row execute function public.adm_touch_updated_at();

alter table public.series_requests            enable row level security;
alter table public.test_assignments           enable row level security;
alter table public.assignment_status_progress enable row level security;
alter table public.assignment_comments        enable row level security;
alter table public.assignment_history         enable row level security;
alter table public.assignment_notifications   enable row level security;
revoke all on table public.series_requests, public.test_assignments, public.assignment_status_progress,
  public.assignment_comments, public.assignment_history, public.assignment_notifications from anon, authenticated;
revoke all on sequence public.adm_assignment_code_seq, public.adm_request_code_seq from public, anon, authenticated;

-- =====================================================================
-- 20261025110400_admin_b2_authoring_helpers.sql
--
-- Purpose
--   Internal adm_* helpers for test authoring (D3): read models that merge the
--   lead's rows with this port's extension rows, the question-type mapping,
--   question / option writers, copy / delete helpers and the series->lead sync.
--   None of these are callable from the browser.
--
-- Lead objects read
--   test_series, quizzes, quiz_questions, quiz_question_options, quiz_attempts,
--   courses, categories, enrollments, profiles, educator_profiles, platform_settings.
-- Lead objects written (only when an RPC calls these helpers)
--   test_series (title, description, is_published, is_active, available_from,
--   available_until, updated_at), quizzes, quiz_questions, quiz_question_options.
--
-- Question type mapping (D3; the UI / archived type is kept in
-- quiz_question_admin.admin_type and returned to the UI unchanged):
--   objective, mcq, mcq_single, single  -> multiple_choice  (one correct option)
--   mcq_multi, multi_select              -> multiple_choice  (several correct options)  LOSSY
--   true_false                           -> true_false
--   numerical, numeric, fill_blank       -> fill_in_blank                                LOSSY (numerical)
--   short_answer                         -> short_answer
--   subjective, long_answer, descriptive -> short_answer + needs_manual_grading          LOSSY
--
-- Assumptions
--   * Series data the lead has a column for is written to that column, never
--     copied into test_series_admin: about -> description, instructions,
--     availability -> available_from / available_until, status -> is_published,
--     archived / soft-deleted -> is_active = false. Test fields map to quizzes:
--     instructions -> description, duration -> time_limit_mins, attempt limit ->
--     max_attempts, pass percent -> passing_score, shuffle -> shuffle_questions,
--     order -> series_sort_order, show answers -> show_answers_after.
--   * available_from / available_until hold only the access window. Go-live is
--     test_series_admin.go_live_at: a series with a future go-live is
--     'scheduled' with is_published = false until release_scheduled_series()
--     (cron, every 5 minutes, Batch 3) publishes it.
--   * Every text-answer question (fill_in_blank / short_answer, including the
--     manually graded types) carries exactly one correct option, so the lead's
--     publish rule always passes for it (adm_text_answer).
--   * Publish validation uses the lead's publish_test_series messages
--     (adm_validate_quiz_for_publish), so both apps accept the same series.
--
-- ROLLBACK
--   drop function if exists public.adm_assignment_rows(), public.adm_eligible_educators(),
--     public.adm_asg_notify(uuid, text, text, text), public.adm_asg_log(uuid, text, text),
--     public.adm_complete_assignments_for_quiz(uuid), public.adm_validate_quiz_for_publish(uuid),
--     public.adm_copy_quiz(uuid, uuid, int, text), public.adm_delete_quiz(uuid),
--     public.adm_apply_test_fields(uuid, jsonb), public.adm_insert_question(uuid, int, jsonb, uuid, text),
--     public.adm_insert_options(uuid, text, jsonb), public.adm_text_answer(jsonb), public.adm_series_json(uuid), public.adm_test_json(uuid),
--     public.adm_question_json(uuid), public.adm_new_house_series(text, text, text),
--     public.adm_set_series_availability(uuid, date, date),
--     public.adm_sync_series_to_lead(uuid), public.adm_ensure_series_admin(uuid),
--     public.adm_require_quiz(uuid), public.adm_require_series(uuid), public.adm_series_educators(),
--     public.adm_series_students(), public.adm_series_rows(), public.adm_subject_category(text),
--     public.adm_ui_question_type(text), public.adm_map_question_type(text), public.adm_norm_text(text),
--     public.adm_house_course_id();
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------------------ small helpers
create or replace function public.adm_house_course_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select nullif(value #>> '{}', '')::uuid from public.platform_settings where key = 'admin_house_course_id';
$$;

create or replace function public.adm_norm_text(t text) returns text
language sql immutable set search_path = public, extensions as $$
  select lower(btrim(regexp_replace(coalesce(t, ''), '[^a-zA-Z0-9]+', ' ', 'g')));
$$;

-- UI / archived type -> lead quiz_questions.question_type (F5). Null = unsupported.
create or replace function public.adm_map_question_type(p_type text) returns text
language sql immutable set search_path = public, extensions as $$
  select case lower(btrim(coalesce(p_type, '')))
    when 'objective' then 'multiple_choice' when 'mcq' then 'multiple_choice'
    when 'mcq_single' then 'multiple_choice' when 'single' then 'multiple_choice'
    when 'mcq_multi' then 'multiple_choice' when 'multi_select' then 'multiple_choice'
    when 'multiple_choice' then 'multiple_choice'
    when 'true_false' then 'true_false' when 'truefalse' then 'true_false'
    when 'numerical' then 'fill_in_blank' when 'numeric' then 'fill_in_blank'
    when 'fill_blank' then 'fill_in_blank' when 'fill_in_blank' then 'fill_in_blank'
    when 'short_answer' then 'short_answer'
    when 'subjective' then 'short_answer' when 'long_answer' then 'short_answer' when 'descriptive' then 'short_answer'
    else null end;
$$;

-- Lead type -> UI type, for questions written by the lead's own app (no admin row).
create or replace function public.adm_ui_question_type(p_lead text) returns text
language sql immutable set search_path = public, extensions as $$
  select case p_lead
    when 'multiple_choice' then 'mcq' when 'true_false' then 'true_false'
    when 'fill_in_blank' then 'fill_blank' when 'short_answer' then 'short_answer'
    else coalesce(p_lead, 'mcq') end;
$$;

-- D9: subjects are the lead's categories, matched by name, read-only.
create or replace function public.adm_subject_category(p_name text) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select c.id from public.categories c
   where nullif(btrim(coalesce(p_name, '')), '') is not null and lower(c.name) = lower(btrim(p_name))
   order by c.is_active desc, c.created_at
   limit 1;
$$;

-- ------------------------------------------------------------ read models
-- One row per non-deleted test series (lead row + optional admin row).
-- The availability window is read from the lead's columns; start_date /
-- end_date are their dates in Asia/Kolkata.
create or replace function public.adm_series_rows()
returns table (
  id uuid, code text, title text, about text, instructions text, who_for text, audience text, syllabus text,
  status text, pricing text, price_inr numeric, is_free boolean,
  subject_category_id uuid, subject_name text, grade text, exam text, level text, languages text[],
  availability_mode text, start_date date, end_date date, go_live_mode text, go_live_at timestamptz,
  monthly_limit int, access_days int, late_allowed boolean, late_grace_minutes int, build_deadline date,
  start_method text, cover_path text, wizard_state jsonb,
  course_id uuid, course_title text, course_educator_id uuid, is_house_course boolean, has_admin_row boolean,
  published_at timestamptz, created_by uuid, created_at timestamptz, updated_at timestamptz, timeline text
)
language sql stable security definer set search_path = public, extensions as $$
  with h as (select public.adm_house_course_id() as house_id)
  select s.id, sa.code, s.title, s.description, s.instructions, sa.who_for, sa.audience, sa.syllabus,
         st.status, pr.pricing, pr.price_inr, pr.price_inr = 0,
         coalesce(sa.subject_category_id, c.category_id), coalesce(cat.name, sa.subject_label),
         sa.grade, sa.exam, coalesce(sa.level, initcap(nullif(c.level, 'all_levels'))),
         case when coalesce(cardinality(sa.languages), 0) > 0 then sa.languages
              when c.language is not null then array[c.language] else '{}'::text[] end,
         case when s.available_until is not null then 'window' else 'always' end,
         (s.available_from at time zone 'Asia/Kolkata')::date, (s.available_until at time zone 'Asia/Kolkata')::date,
         coalesce(sa.go_live_mode, 'now'), sa.go_live_at,
         sa.monthly_limit, sa.access_days, coalesce(sa.late_allowed, false), sa.late_grace_minutes, sa.build_deadline,
         sa.start_method, sa.cover_path, sa.wizard_state,
         s.course_id, c.title, c.educator_id, coalesce(s.course_id = h.house_id, false), sa.series_id is not null,
         sa.published_at, sa.created_by, s.created_at, greatest(s.updated_at, sa.updated_at),
         case when st.status in ('draft', 'archived') then 'unscheduled'
              when s.available_from is not null and now() < s.available_from then 'upcoming'
              when s.available_until is not null and now() > s.available_until then 'ended'
              else 'ongoing' end
    from public.test_series s
    cross join h
    left join public.test_series_admin sa on sa.series_id = s.id
    left join public.courses c on c.id = s.course_id
    left join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
    cross join lateral (select case
        when sa.series_id is not null then sa.status   -- 'scheduled' until release_scheduled_series() runs
        when not s.is_active then 'archived'
        when s.is_published then 'published'
        else 'draft' end as status) st
    cross join lateral (select
        coalesce(sa.pricing,
                 case when s.course_id is distinct from h.house_id and coalesce(c.price, 0) > 0 then 'paid' else 'free' end) as pricing,
        coalesce(sa.price_inr,
                 case when s.course_id is distinct from h.house_id then coalesce(c.price, 0) else 0 end)::numeric as price_inr) pr
   where sa.deleted_at is null;
$$;

-- Students with access to a series: admin-sold enrolments plus, for series on a
-- real (non-house) course, active course enrolments (the lead's access model).
create or replace function public.adm_series_students()
returns table (series_id uuid, student_id uuid, enrolled_at timestamptz, source text)
language sql stable security definer set search_path = public, extensions as $$
  select ase.series_id, ase.student_id, ase.enrolled_at, 'admin'::text
    from public.admin_series_enrollments ase where ase.revoked_at is null
  union all
  select s.id, e.student_id, e.enrolled_at, 'course'::text
    from public.test_series s
    join public.enrollments e on e.course_id = s.course_id and e.is_active
   where s.course_id is distinct from public.adm_house_course_id();
$$;

-- Educators attached to a series: active assignments, plus the course educator
-- for series on a real course.
create or replace function public.adm_series_educators()
returns table (series_id uuid, educator_id uuid, educator_name text)
language sql stable security definer set search_path = public, extensions as $$
  select distinct x.series_id, x.educator_id, p.full_name
    from (select a.series_id, a.educator_id from public.test_assignments a
           where a.status not in ('cancelled', 'rejected')
          union
          select s.id, c.educator_id from public.test_series s join public.courses c on c.id = s.course_id
           where s.course_id is distinct from public.adm_house_course_id()) x
    join public.profiles p on p.id = x.educator_id;
$$;

-- ----------------------------------------------------------- JSON builders
create or replace function public.adm_question_json(p_question uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', qq.id, 'test_id', qq.quiz_id, 'position', qq.sort_order,
           'type', coalesce(qa.admin_type, public.adm_ui_question_type(qq.question_type)),
           'lead_type', qq.question_type, 'body', qq.question_text, 'marks', qq.points,
           'negative_marks', coalesce(qa.negative_marks, 0), 'difficulty', coalesce(qa.difficulty, 'medium'),
           'subject', qa.subject, 'topic', qa.topic, 'explanation', qq.explanation,
           'answer_instructions', qa.answer_instructions, 'image_path', qa.image_path,
           'source', coalesce(qa.source, 'manual'), 'section_id', qa.section_id,
           'needs_manual_grading', coalesce(qa.needs_manual_grading, false),
           'options', coalesce((
             select jsonb_agg(jsonb_build_object('id', o.id, 'option_key', chr(64 + o.rn::int), 'label', o.option_text,
                                                 'is_correct', o.is_correct, 'position', o.sort_order) order by o.rn)
               from (select x.*, row_number() over (order by x.sort_order, x.id) as rn
                       from public.quiz_question_options x where x.question_id = qq.id) o), '[]'::jsonb))
    from public.quiz_questions qq
    left join public.quiz_question_admin qa on qa.question_id = qq.id
   where qq.id = p_question;
$$;

create or replace function public.adm_test_json(p_quiz uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', q.id, 'series_id', q.series_id, 'position', q.series_sort_order, 'title', q.title,
           'instructions', q.description, 'duration_minutes', coalesce(q.time_limit_mins, 60),
           'total_marks', coalesce(nullif(m.marks_sum, 0), qa.total_marks_planned, 0),
           'passing_percent', q.passing_score, 'passing_marks', qa.passing_marks,
           'attempt_limit', q.max_attempts, 'scheduled_at', qa.scheduled_at,
           'shuffle_questions', q.shuffle_questions, 'shuffle_options', coalesce(qa.shuffle_options, false),
           'show_answers_after', q.show_answers_after,
           'window_mode', coalesce(qa.window_mode, 'inherit'), 'open_at', qa.open_at, 'close_at', qa.close_at,
           'planned_questions', coalesce(qa.planned_questions, 0), 'topics', to_jsonb(coalesce(qa.topics, '{}'::text[])),
           'status', coalesce(qa.status, case when s.is_published then 'published' else 'draft' end),
           'question_count', m.n,
           'attempts', (select count(*) from public.quiz_attempts a where a.quiz_id = q.id),
           'created_at', q.created_at,
           'sections', coalesce((select jsonb_agg(to_jsonb(ts) order by ts.position)
                                   from public.test_sections ts where ts.quiz_id = q.id), '[]'::jsonb),
           'questions', coalesce((select jsonb_agg(public.adm_question_json(qq.id) order by qq.sort_order, qq.created_at)
                                    from public.quiz_questions qq where qq.quiz_id = q.id), '[]'::jsonb))
    from public.quizzes q
    left join public.quiz_admin qa on qa.quiz_id = q.id
    left join public.test_series s on s.id = q.series_id
    cross join lateral (select count(*) as n, coalesce(sum(x.points), 0) as marks_sum
                          from public.quiz_questions x where x.quiz_id = q.id) m
   where q.id = p_quiz;
$$;

-- One series row with the list counters (same keys as the archived v_test_series_list).
create or replace function public.adm_series_json(p_series uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select to_jsonb(r) || jsonb_build_object(
           'icon_key', null::text,
           'test_count', (select count(*) from public.quizzes q where q.series_id = r.id),
           'enrollments', (select count(distinct st.student_id) from public.adm_series_students() st where st.series_id = r.id),
           'attempts', (select count(*) from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                         where q.series_id = r.id and a.status in ('submitted', 'timed_out')),
           'avg_score', coalesce((select round(avg(a.percentage)) from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                                   where q.series_id = r.id and a.status in ('submitted', 'timed_out')), 0))
    from public.adm_series_rows() r where r.id = p_series;
$$;

-- ---------------------------------------------------------------- guards
create or replace function public.adm_require_series(p_id uuid) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_id is null or not exists (select 1 from public.test_series s
                                   left join public.test_series_admin sa on sa.series_id = s.id
                                  where s.id = p_id and sa.deleted_at is null) then
    raise exception 'Test series not found.' using errcode = 'P0002';
  end if;
end $$;

-- Returns the quiz's series id; raises when the quiz or its series is gone.
create or replace function public.adm_require_quiz(p_id uuid) returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_series uuid;
begin
  select q.series_id into v_series
    from public.quizzes q
    left join public.test_series_admin sa on sa.series_id = q.series_id
   where q.id = p_id and q.series_id is not null and sa.deleted_at is null;
  if v_series is null then
    raise exception 'Test not found.' using errcode = 'P0002';
  end if;
  return v_series;
end $$;

-- ------------------------------------------------------ series admin rows
-- Lazily creates the admin row for a series the lead's app created, seeded
-- from its current state so nothing visible changes.
create or replace function public.adm_ensure_series_admin(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.test_series_admin
    (series_id, status, pricing, price_inr, go_live_mode, go_live_at, start_method)
  select r.id, r.status, r.pricing, r.price_inr, 'now', null::timestamptz, 'manual'
    from public.adm_series_rows() r
   where r.id = p_id
  on conflict (series_id) do nothing;
$$;

-- Pushes the admin status to the lead's flags (D3): only 'published' ->
-- is_published (a 'scheduled' series stays unpublished until
-- release_scheduled_series() flips it); archived or soft-deleted ->
-- is_active = false.
create or replace function public.adm_sync_series_to_lead(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  update public.test_series s
     set is_published = sa.status = 'published' and sa.deleted_at is null,
         is_active    = sa.deleted_at is null and sa.status <> 'archived',
         updated_at   = now()
    from public.test_series_admin sa
   where sa.series_id = s.id and s.id = p_id;
$$;

-- Writes the access window to the lead's available_from / available_until
-- (dates are Asia/Kolkata days; the close day is inclusive). These columns
-- hold only the access window; go-live lives in test_series_admin.go_live_at.
create or replace function public.adm_set_series_availability(p_id uuid, p_open date, p_close date) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_from  timestamptz := p_open::timestamp at time zone 'Asia/Kolkata';
  v_until timestamptz := ((p_close + 1)::timestamp at time zone 'Asia/Kolkata') - interval '1 second';
begin
  if v_from is not null and v_until is not null and v_until <= v_from then
    raise exception 'The closing time must be after the opening time.' using errcode = '22023';
  end if;
  update public.test_series
     set available_from = v_from, available_until = v_until, updated_at = now()
   where id = p_id;
end $$;

-- New series on the house course (D2) with its admin row.
create or replace function public.adm_new_house_series(p_title text, p_about text, p_start_method text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_house uuid := public.adm_house_course_id();
  v_id    uuid;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if v_house is null then
    raise exception 'The admin house course is not configured (platform_settings admin_house_course_id).' using errcode = 'P0001';
  end if;
  if v_title is null then
    raise exception 'Series name is required.' using errcode = '22023';
  end if;
  insert into public.test_series (course_id, title, description, is_active, is_published)
  values (v_house, left(v_title, 150), nullif(p_about, ''), true, false)
  returning id into v_id;
  insert into public.test_series_admin (series_id, status, start_method, created_by)
  values (v_id, 'draft',
          case when p_start_method in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then p_start_method end,
          auth.uid());
  return v_id;
end $$;

-- ------------------------------------------------- question / option writers
-- The single correct option of a text-answer question: accepted answer
-- (correctAnswer / answer / correctAnswers[0]), else the model answer
-- (modelAnswer / model_answer), else a placeholder. Never null.
create or replace function public.adm_text_answer(q jsonb) returns text
language sql immutable set search_path = public, extensions as $$
  select coalesce(nullif(btrim(coalesce(q ->> 'correctAnswer', '')), ''),
                  nullif(btrim(coalesce(q ->> 'answer', '')), ''),
                  nullif(btrim(coalesce(q -> 'correctAnswers' ->> 0, '')), ''),
                  nullif(btrim(coalesce(q ->> 'modelAnswer', '')), ''),
                  nullif(btrim(coalesce(q ->> 'model_answer', '')), ''),
                  'Manual grading: see rubric');
$$;

-- q accepts the wizard shape {options:[{key,text}], correctAnswers:[...]}, the
-- editor shape {optionA..optionF, correctAnswer} or {options:[{label,is_correct}]}.
create or replace function public.adm_insert_options(p_question uuid, p_lead text, q jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_opts jsonb;
  v_keys text[];
  o      jsonb;
  i      int := 0;
  v_key  text;
  v_text text;
begin
  -- Text answers: the lead's publish rule needs a correct option on every
  -- question, so every fill_in_blank / short_answer question (including the
  -- manually graded subjective / long_answer / descriptive ones) gets exactly
  -- one correct option: the accepted answer, else the model answer, else the
  -- placeholder 'Manual grading: see rubric'. needs_manual_grading stays in
  -- quiz_question_admin.
  if p_lead in ('fill_in_blank', 'short_answer') then
    v_text := public.adm_text_answer(q);
    insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
    values (p_question, v_text, true, 1);
    return 1;
  end if;
  if p_lead not in ('multiple_choice', 'true_false') then return 0; end if;

  if jsonb_typeof(q -> 'options') = 'array' then
    v_opts := q -> 'options';
  else
    select coalesce(jsonb_agg(jsonb_build_object('key', k, 'text', q ->> ('option' || k)) order by k), '[]'::jsonb)
      into v_opts
      from unnest(array['A', 'B', 'C', 'D', 'E', 'F']) as k
     where q ? ('option' || k);
  end if;

  select coalesce(array_agg(upper(btrim(x))), '{}') into v_keys
    from jsonb_array_elements_text(
           case when jsonb_typeof(q -> 'correctAnswers') = 'array' then q -> 'correctAnswers'
                when nullif(btrim(coalesce(q ->> 'correctAnswer', '')), '') is not null then jsonb_build_array(q ->> 'correctAnswer')
                else '[]'::jsonb end) x;

  if p_lead = 'true_false' and jsonb_array_length(v_opts) = 0 then
    v_opts := '[{"key":"A","text":"True"},{"key":"B","text":"False"}]'::jsonb;
  end if;

  for o in select * from jsonb_array_elements(v_opts) loop
    v_text := nullif(btrim(coalesce(o ->> 'text', o ->> 'label', '')), '');
    continue when v_text is null;
    i := i + 1;
    v_key := upper(coalesce(nullif(o ->> 'key', ''), nullif(o ->> 'option_key', ''), chr(64 + i)));
    insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
    values (p_question, v_text,
            v_key = any (v_keys) or upper(v_text) = any (v_keys)
              or coalesce((o ->> 'is_correct')::boolean, (o ->> 'isCorrect')::boolean, false),
            i);
  end loop;
  return i;
end $$;

-- Returns null (and writes nothing) when the question text is blank.
create or replace function public.adm_insert_question(
  p_quiz uuid, p_pos int, q jsonb, p_section uuid default null, p_source text default 'manual'
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_text   text := coalesce(nullif(btrim(coalesce(q ->> 'text', '')), ''), nullif(btrim(coalesce(q ->> 'body', '')), ''));
  v_type   text := lower(coalesce(nullif(btrim(coalesce(q ->> 'type', '')), ''), 'objective'));
  v_diff   text := lower(coalesce(nullif(btrim(coalesce(q ->> 'difficulty', '')), ''), 'medium'));
  v_source text := coalesce(nullif(q ->> 'source', ''), p_source, 'manual');
  v_lead   text;
  v_qid    uuid;
begin
  if v_text is null then return null; end if;
  v_lead := public.adm_map_question_type(v_type);
  if v_lead is null then
    raise exception 'Unsupported question type: %', v_type using errcode = '22023';
  end if;
  if v_diff not in ('easy', 'medium', 'hard') then v_diff := 'medium'; end if;
  if v_source not in ('manual', 'ai', 'csv', 'duplicate', 'paste') then v_source := 'manual'; end if;

  insert into public.quiz_questions (quiz_id, question_text, question_type, points, explanation, sort_order)
  values (p_quiz, v_text, v_lead, coalesce(nullif(q ->> 'marks', '')::numeric, 4),
          nullif(btrim(coalesce(q ->> 'explanation', '')), ''), coalesce(p_pos, 0))
  returning id into v_qid;

  insert into public.quiz_question_admin
    (question_id, admin_type, needs_manual_grading, section_id, negative_marks, difficulty, subject, topic,
     image_path, answer_instructions, source, ai_job_id)
  values
    (v_qid, v_type, v_type in ('subjective', 'long_answer', 'descriptive'), p_section,
     greatest(coalesce(nullif(q ->> 'negativeMarks', '')::numeric, nullif(q ->> 'negative_marks', '')::numeric, 0), 0),
     v_diff, nullif(btrim(coalesce(q ->> 'subject', '')), ''), nullif(btrim(coalesce(q ->> 'topic', '')), ''),
     nullif(coalesce(q ->> 'image', q ->> 'image_path', ''), ''),
     coalesce(nullif(q ->> 'answerInstructions', ''), nullif(q ->> 'rubric', ''), nullif(q ->> 'answer_instructions', '')),
     v_source, nullif(q ->> 'aiJobId', '')::uuid);

  perform public.adm_insert_options(v_qid, v_lead, q);
  return v_qid;
end $$;

-- Applies the test form fields present in p (create and update share this).
create or replace function public.adm_apply_test_fields(p_quiz uuid, p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_total      numeric := case when p ? 'totalMarks' then nullif(p ->> 'totalMarks', '')::numeric end;
  v_pass_marks numeric := case when p ? 'passingMarks' then nullif(p ->> 'passingMarks', '')::numeric end;
  v_pass_pct   numeric;
  v_win        jsonb := case when jsonb_typeof(p -> 'window') = 'object' then p -> 'window' end;
  v_show       text  := nullif(btrim(coalesce(p ->> 'showAnswersAfter', '')), '');
begin
  if p ? 'name' and nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Test name is required.' using errcode = '22023';
  end if;
  if v_show is not null and v_show not in ('submission', 'passing', 'never') then
    raise exception 'Unknown show-answers setting: %', v_show using errcode = '22023';
  end if;
  v_pass_pct := case
    when nullif(p ->> 'passingPercent', '') is not null then (p ->> 'passingPercent')::numeric
    when v_pass_marks is not null and coalesce(v_total, 0) > 0 then round(v_pass_marks / v_total * 100, 2)
  end;

  update public.quizzes set
    title             = case when p ? 'name' then left(btrim(p ->> 'name'), 200) else title end,
    description       = case when p ? 'instructions' then nullif(p ->> 'instructions', '') else description end,
    time_limit_mins   = case when p ? 'duration' then nullif(round(nullif(p ->> 'duration', '')::numeric)::int, 0) else time_limit_mins end,
    max_attempts      = case when p ? 'attemptLimit' then greatest(coalesce(round(nullif(p ->> 'attemptLimit', '')::numeric)::int, 1), 1) else max_attempts end,
    passing_score     = coalesce(least(greatest(v_pass_pct, 0), 100), passing_score),
    shuffle_questions = case when p ? 'shuffleQuestions' then coalesce((p ->> 'shuffleQuestions')::boolean, false) else shuffle_questions end,
    series_sort_order = case when nullif(p ->> 'position', '') is not null then round((p ->> 'position')::numeric)::int else series_sort_order end,
    show_answers_after = coalesce(v_show, show_answers_after),
    updated_at        = now()
  where id = p_quiz;

  insert into public.quiz_admin (quiz_id) values (p_quiz) on conflict (quiz_id) do nothing;
  update public.quiz_admin set
    total_marks_planned = case when p ? 'totalMarks' then v_total else total_marks_planned end,
    passing_marks       = case when p ? 'passingMarks' then v_pass_marks else passing_marks end,
    shuffle_options     = case when p ? 'shuffleOptions' then coalesce((p ->> 'shuffleOptions')::boolean, false) else shuffle_options end,
    scheduled_at        = case when p ? 'scheduledAt' then nullif(p ->> 'scheduledAt', '')::timestamptz else scheduled_at end,
    window_mode         = case when v_win is not null then coalesce(nullif(v_win ->> 'mode', ''), 'inherit') else window_mode end,
    open_at             = case when v_win is not null then case when v_win ->> 'mode' = 'custom' then nullif(v_win ->> 'openAt', '')::timestamptz end else open_at end,
    close_at            = case when v_win is not null then case when v_win ->> 'mode' = 'custom' then nullif(v_win ->> 'closeAt', '')::timestamptz end else close_at end,
    planned_questions   = case when p ? 'plannedQuestions' then coalesce(round(nullif(p ->> 'plannedQuestions', '')::numeric)::int, 0) else planned_questions end,
    topics              = case when jsonb_typeof(p -> 'topics') = 'array'
                               then coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(p -> 'topics') x where btrim(x) <> ''), '{}')
                               else topics end
  where quiz_id = p_quiz;
end $$;

-- ------------------------------------------------------ delete / copy quiz
-- Lead FKs do not cascade: options -> questions -> quiz, in that order.
create or replace function public.adm_delete_quiz(p_quiz uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from public.quiz_attempts where quiz_id = p_quiz) then
    raise exception 'This test already has student attempts and cannot be deleted or replaced.' using errcode = '23503';
  end if;
  delete from public.quiz_question_options o using public.quiz_questions qq
   where o.question_id = qq.id and qq.quiz_id = p_quiz;
  delete from public.quiz_questions where quiz_id = p_quiz;
  delete from public.quizzes where id = p_quiz;
end $$;

create or replace function public.adm_copy_quiz(p_src uuid, p_series uuid, p_pos int, p_title text default null) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_new    uuid;
  v_course uuid;
  v_map    jsonb := '{}'::jsonb;
  v_ns     uuid;
  v_nq     uuid;
  sec      record;
  qq       record;
begin
  select course_id into v_course from public.test_series where id = p_series;
  insert into public.quizzes (course_id, series_id, series_sort_order, title, description, time_limit_mins,
                              max_attempts, passing_score, shuffle_questions, is_required, show_answers_after, is_proctored)
  select v_course, p_series, p_pos, left(coalesce(p_title, q.title), 200), q.description, q.time_limit_mins,
         q.max_attempts, q.passing_score, q.shuffle_questions, q.is_required, q.show_answers_after, q.is_proctored
    from public.quizzes q where q.id = p_src
  returning id into v_new;
  if v_new is null then raise exception 'Test not found.' using errcode = 'P0002'; end if;

  insert into public.quiz_admin (quiz_id, status, total_marks_planned, passing_marks, shuffle_options, window_mode,
                                 open_at, close_at, scheduled_at, planned_questions, topics)
  select v_new, 'draft', total_marks_planned, passing_marks, shuffle_options, window_mode,
         open_at, close_at, scheduled_at, planned_questions, topics
    from public.quiz_admin where quiz_id = p_src;
  insert into public.quiz_admin (quiz_id) values (v_new) on conflict (quiz_id) do nothing;

  for sec in select * from public.test_sections where quiz_id = p_src order by position loop
    insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
    values (v_new, sec.position, sec.name, sec.instructions, sec.planned_questions, sec.planned_marks)
    returning id into v_ns;
    v_map := v_map || jsonb_build_object(sec.id::text, v_ns);
  end loop;

  for qq in
    select x.id, x.question_text, x.question_type, x.points, x.explanation, x.sort_order,
           qa.admin_type, qa.needs_manual_grading, qa.section_id, qa.negative_marks, qa.difficulty,
           qa.subject, qa.topic, qa.image_path, qa.answer_instructions
      from public.quiz_questions x
      left join public.quiz_question_admin qa on qa.question_id = x.id
     where x.quiz_id = p_src
     order by x.sort_order, x.created_at
  loop
    insert into public.quiz_questions (quiz_id, question_text, question_type, points, explanation, sort_order)
    values (v_new, qq.question_text, qq.question_type, qq.points, qq.explanation, qq.sort_order)
    returning id into v_nq;
    insert into public.quiz_question_admin (question_id, admin_type, needs_manual_grading, section_id, negative_marks,
                                            difficulty, subject, topic, image_path, answer_instructions, source)
    values (v_nq, coalesce(qq.admin_type, public.adm_ui_question_type(qq.question_type)),
            coalesce(qq.needs_manual_grading, false),
            case when qq.section_id is not null then nullif(v_map ->> qq.section_id::text, '')::uuid end,
            coalesce(qq.negative_marks, 0), coalesce(qq.difficulty, 'medium'), qq.subject, qq.topic,
            qq.image_path, qq.answer_instructions, 'duplicate');
    insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
    select v_nq, o.option_text, o.is_correct, o.sort_order
      from public.quiz_question_options o where o.question_id = qq.id;
    -- A text-answer source without a correct option (e.g. one written by the
    -- lead's app) gets the placeholder, so the copy stays publishable.
    if qq.question_type in ('fill_in_blank', 'short_answer')
       and not exists (select 1 from public.quiz_question_options o where o.question_id = v_nq and o.is_correct) then
      insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
      values (v_nq, public.adm_text_answer('{}'::jsonb), true,
              coalesce((select max(o.sort_order) from public.quiz_question_options o where o.question_id = v_nq), 0) + 1);
    end if;
  end loop;
  return v_new;
end $$;

-- ------------------------------------------------------- publish helpers
-- Same rule and messages as the lead's publish_test_series(uuid, boolean):
-- every quiz needs a question, and every question a correct option.
create or replace function public.adm_validate_quiz_for_publish(p_quiz uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case
    when m.total = 0 then format('"%s" has no questions.', q.title)
    when m.no_correct > 0 then format('"%s" has %s question(s) without a correct answer.', q.title, m.no_correct)
    else null end
    from public.quizzes q
    cross join lateral (
      select count(*) as total,
             count(*) filter (where not exists (select 1 from public.quiz_question_options o
                                                  where o.question_id = qq.id and o.is_correct)) as no_correct
        from public.quiz_questions qq where qq.quiz_id = q.id) m
   where q.id = p_quiz;
$$;

-- An approved assignment whose test is published becomes completed.
create or replace function public.adm_complete_assignments_for_quiz(p_quiz uuid) returns void
language sql security definer set search_path = public, extensions as $$
  with u as (
    update public.test_assignments set status = 'completed'
     where test_id = p_quiz and status = 'approved'
    returning id
  )
  insert into public.assignment_history (assignment_id, action, by_user, note)
  select id, 'Completed', auth.uid(), 'Linked test was published.' from u;
$$;

-- -------------------------------------------------------- assignments
create or replace function public.adm_asg_log(p_id uuid, p_action text, p_note text) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.assignment_history (assignment_id, action, by_user, note) values (p_id, p_action, auth.uid(), p_note);
$$;

create or replace function public.adm_asg_notify(p_id uuid, p_type text, p_title text, p_msg text) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.assignment_notifications (assignment_id, educator_id, type, title, message)
  select id, educator_id, p_type, p_title, p_msg from public.test_assignments where id = p_id;
$$;

-- Verified (lead value) and active (admin state) educators.
create or replace function public.adm_eligible_educators()
returns table (id uuid, name text, subjects text[])
language sql stable security definer set search_path = public, extensions as $$
  select p.id, coalesce(ep.full_name, p.full_name), coalesce(ep.subjects::text[], '{}'::text[])
    from public.profiles p
    join public.educator_profiles ep on ep.user_id = p.id
    left join public.educator_admin_state st on st.user_id = p.id
   where p.role = 'educator' and ep.verification_status = 'verified'
     and coalesce(st.account_status, 'active') = 'active';
$$;

-- Same columns as the archived v_assignments_list.
create or replace function public.adm_assignment_rows()
returns table (
  id uuid, code text, series_id uuid, series_name text, subject text, topics text[],
  educator_id uuid, educator_name text, test_name text, question_count int, question_type_mix text,
  difficulty text, total_marks numeric, duration_minutes int, instructions text, assigned_date date,
  deadline date, status text, display_status text, progress int, submitted_at timestamptz,
  overall_feedback text, decision text, decision_at timestamptz, decision_reason text, cancel_reason text,
  request_id uuid, test_id uuid, created_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select a.id, a.code, a.series_id, s.title, a.subject, a.topics, a.educator_id, p.full_name, a.test_name,
         a.question_count, a.question_type_mix, a.difficulty, a.total_marks, a.duration_minutes, a.instructions,
         a.assigned_date, a.deadline, a.status,
         case when a.status not in ('approved', 'completed', 'cancelled', 'rejected')
               and a.deadline is not null and a.deadline < current_date then 'overdue' else a.status end,
         coalesce(pr.progress, 0), a.submitted_at, a.overall_feedback, a.decision, a.decision_at,
         a.decision_reason, a.cancel_reason, a.request_id, a.test_id, a.created_at
    from public.test_assignments a
    join public.test_series s on s.id = a.series_id
    left join public.test_series_admin sa on sa.series_id = s.id
    left join public.profiles p on p.id = a.educator_id
    left join public.assignment_status_progress pr on pr.status = a.status
   where sa.deleted_at is null;
$$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_house_course_id() from public, anon, authenticated;
revoke all on function public.adm_norm_text(text) from public, anon, authenticated;
revoke all on function public.adm_map_question_type(text) from public, anon, authenticated;
revoke all on function public.adm_ui_question_type(text) from public, anon, authenticated;
revoke all on function public.adm_subject_category(text) from public, anon, authenticated;
revoke all on function public.adm_series_rows() from public, anon, authenticated;
revoke all on function public.adm_series_students() from public, anon, authenticated;
revoke all on function public.adm_series_educators() from public, anon, authenticated;
revoke all on function public.adm_question_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_test_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_series_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_require_series(uuid) from public, anon, authenticated;
revoke all on function public.adm_require_quiz(uuid) from public, anon, authenticated;
revoke all on function public.adm_ensure_series_admin(uuid) from public, anon, authenticated;
revoke all on function public.adm_sync_series_to_lead(uuid) from public, anon, authenticated;
revoke all on function public.adm_set_series_availability(uuid, date, date) from public, anon, authenticated;
revoke all on function public.adm_new_house_series(text, text, text) from public, anon, authenticated;
revoke all on function public.adm_text_answer(jsonb) from public, anon, authenticated;
revoke all on function public.adm_insert_options(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.adm_insert_question(uuid, int, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.adm_apply_test_fields(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.adm_delete_quiz(uuid) from public, anon, authenticated;
revoke all on function public.adm_copy_quiz(uuid, uuid, int, text) from public, anon, authenticated;
revoke all on function public.adm_validate_quiz_for_publish(uuid) from public, anon, authenticated;
revoke all on function public.adm_complete_assignments_for_quiz(uuid) from public, anon, authenticated;
revoke all on function public.adm_asg_log(uuid, text, text) from public, anon, authenticated;
revoke all on function public.adm_asg_notify(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.adm_eligible_educators() from public, anon, authenticated;
revoke all on function public.adm_assignment_rows() from public, anon, authenticated;

-- =====================================================================
-- 20261025110500_admin_rpc_test_series.sql
--
-- Purpose
--   Test series RPCs used by testSeriesApi.js (D3 / D4). Every read and write
--   of series goes through these SECURITY DEFINER functions (F9: the lead's
--   RLS gives admins read-only access to test_series).
--     get_test_series_stats()                 -> {total_series, total_enrolled, total_attempts, avg_performance}
--     list_test_series(p_search, p_status, p_pricing, p_timeline, p_page, p_size)
--     get_test_series(p_id)                   -> series + tests + sections + questions + options (one call)
--     create_test_series(p) / update_test_series(p_id, p) / delete_test_series(p_id)
--     adm_publish_test_series(p_id, p_publish default true)
--                                             -> {series_id, is_published, tests, status}
--     release_scheduled_series()              -> int (cron only: postgres / service_role)
--     duplicate_test_series(p_id)             -> new id
--     save_wizard_draft(p_id, p_state) / discard_wizard_draft(p_id)
--     series_name_exists(p_name, p_exclude)
--     upsert_test_series_full(p, p_publish)   -> wizard save / publish
--
-- Lead objects read / written
--   test_series (insert on the house course; title, description, flags, dates),
--   quizzes / quiz_questions / quiz_question_options (wizard replace mode),
--   quiz_attempts, courses, categories, enrollments; audit_logs via adm_audit.
--
-- Assumptions
--   * New series are always attached to the house course (D2).
--   * The wizard's replace mode only runs on house-course series without
--     attempts; series that live on a real course are edited test by test.
--   * The lead owns publish_test_series(uuid, boolean); it is never created or
--     replaced here. Our publish is adm_publish_test_series and applies the
--     lead's checks and messages (closing after opening, every test has a
--     question, every question has a correct option, at least one test). The
--     archived extra rules (audience / grade / exam / level / language, two
--     options per objective question) are dropped.
--   * Lead columns are the source of truth: about / description ->
--     test_series.description, instructions -> test_series.instructions,
--     access window -> test_series.available_from / available_until (only the
--     window; go-live is test_series_admin.go_live_at and is never written
--     into available_from).
--   * Scheduled go-live depends on cron: Batch 3's cron file must schedule
--     release_scheduled_series() every 5 minutes. Without it, scheduled series
--     stay unpublished.
--   * Soft delete sets test_series_admin.deleted_at and, through the sync, the
--     lead's test_series.is_active = false and is_published = false
--     (Batch 1 contract).
--   * get_test_series_stats returns an object (the archived one returned a
--     one-row table that TestSeries.jsx could not read).
--
-- ROLLBACK
--   drop function if exists public.upsert_test_series_full(jsonb, boolean);
--   drop function if exists public.series_name_exists(text, uuid);
--   drop function if exists public.discard_wizard_draft(uuid);
--   drop function if exists public.save_wizard_draft(uuid, jsonb);
--   drop function if exists public.duplicate_test_series(uuid);
--   drop function if exists public.release_scheduled_series();   -- unschedule the Batch 3 cron job first
--   drop function if exists public.adm_publish_test_series(uuid, boolean);   -- never the lead's publish_test_series(uuid, boolean)
--   drop function if exists public.delete_test_series(uuid);
--   drop function if exists public.update_test_series(uuid, jsonb);
--   drop function if exists public.create_test_series(jsonb);
--   drop function if exists public.get_test_series(uuid);
--   drop function if exists public.list_test_series(text, text, text, text, int, int);
--   drop function if exists public.get_test_series_stats();
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------------------------- reads
create or replace function public.get_test_series_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with r as (select x.id from public.adm_series_rows() x),
         att as (select q.series_id, a.percentage
                   from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                   join r on r.id = q.series_id
                  where a.status in ('submitted', 'timed_out'))
    select jsonb_build_object(
      'total_series',    (select count(*) from r),
      'total_enrolled',  (select count(*) from (select distinct st.series_id, st.student_id
                                                  from public.adm_series_students() st join r on r.id = st.series_id) e),
      'total_attempts',  (select count(*) from att),
      'avg_performance', coalesce((select round(avg(sa)) from (select avg(att.percentage) as sa from att group by att.series_id) z), 0)));
end $$;

-- p_status: draft | scheduled | published | archived. p_pricing: free | paid.
-- p_timeline: unscheduled | upcoming | ongoing | ended.
create or replace function public.list_test_series(
  p_search text default null, p_status text default null, p_pricing text default null,
  p_timeline text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with base as (select b.* from public.adm_series_rows() b),
       cnt as (select q.series_id, count(*) as n from public.quizzes q where q.series_id is not null group by q.series_id),
       enr as (select st.series_id, count(distinct st.student_id) as n from public.adm_series_students() st group by st.series_id),
       att as (select q.series_id, count(*) as n, round(avg(a.percentage)) as av
                 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                where a.status in ('submitted', 'timed_out') group by q.series_id),
       f as (
         select b.*, coalesce(cnt.n, 0) as test_count, coalesce(enr.n, 0) as enrollments,
                coalesce(att.n, 0) as attempts, coalesce(att.av, 0) as avg_score
           from base b
           left join cnt on cnt.series_id = b.id
           left join enr on enr.series_id = b.id
           left join att on att.series_id = b.id
          where (v_like is null
                 or (b.title || ' ' || coalesce(b.subject_name, '') || ' ' || coalesce(b.audience, '') || ' ' || coalesce(b.code, '')) ilike v_like)
            and (p_status is null or p_status in ('', 'all') or b.status = p_status)
            and (p_pricing is null or p_pricing in ('', 'all')
                 or (p_pricing = 'free' and b.is_free) or (p_pricing = 'paid' and not b.is_free))
            and (p_timeline is null or p_timeline in ('', 'all') or b.timeline = p_timeline)
       )
  select (to_jsonb(f) - 'wizard_state') || jsonb_build_object('icon_key', null::text),
         count(*) over ()
    from f
   order by f.created_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

-- Series + tests + sections + questions + options in one call.
create or replace function public.get_test_series(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform public.adm_require_admin();
  v := public.adm_series_json(p_id);
  if v is null then return null; end if;
  return v || jsonb_build_object('tests', coalesce((
    select jsonb_agg(public.adm_test_json(q.id) order by q.series_sort_order, q.created_at)
      from public.quizzes q where q.series_id = p_id), '[]'::jsonb));
end $$;

create or replace function public.series_name_exists(p_name text, p_exclude uuid default null) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return exists (select 1 from public.adm_series_rows() r
                  where lower(btrim(r.title)) = lower(btrim(coalesce(p_name, '')))
                    and (p_exclude is null or r.id <> p_exclude));
end $$;

-- --------------------------------------------------------------- publish
-- Named adm_publish_test_series because the lead already owns
-- publish_test_series(uuid, boolean); that function is never replaced. This
-- one applies the same checks with the same messages, in the same order:
--   series exists ('Test series not found.'), available_until > available_from,
--   every quiz has a question, every question has a correct option, at least
--   one quiz. It then sets the status in test_series_admin and
--   test_series.is_published: true for 'published'; false for 'draft' and for
--   'scheduled' (future go_live_at) until release_scheduled_series() runs.
--   Unlike the lead's version it inserts no 'course_update' notifications
--   (nobody is enrolled in the house course).
-- Returns the lead's shape {series_id, is_published, tests} plus status.
create or replace function public.adm_publish_test_series(p_id uuid, p_publish boolean default true) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  s         public.test_series;
  v_publish boolean;
  v_live    boolean;
  v_status  text;
  v_msg     text;
  v_tests   int;
  r         record;
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_id);
  perform public.adm_ensure_series_admin(p_id);
  select * into s from public.test_series where id = p_id for update;
  v_publish := coalesce(p_publish, true);
  select count(*) into v_tests from public.quizzes where series_id = p_id;

  if v_publish then
    if s.available_from is not null and s.available_until is not null and s.available_until <= s.available_from then
      raise exception 'The closing time must be after the opening time.' using errcode = '22023';
    end if;
    for r in select q.id from public.quizzes q where q.series_id = p_id order by q.series_sort_order, q.created_at loop
      v_msg := public.adm_validate_quiz_for_publish(r.id);
      if v_msg is not null then raise exception '%', v_msg using errcode = '22023'; end if;
    end loop;
    if v_tests = 0 then
      raise exception 'Add at least one test before publishing.' using errcode = '22023';
    end if;
    select case when sa.go_live_mode = 'schedule' and sa.go_live_at > now() then 'scheduled' else 'published' end
      into v_status from public.test_series_admin sa where sa.series_id = p_id;
  else
    v_status := 'draft';
  end if;

  -- A future go-live keeps the lead's is_published = false ('scheduled');
  -- release_scheduled_series() flips it once go_live_at has passed.
  v_live := v_status = 'published';
  update public.test_series_admin
     set status = v_status,
         published_at = case when v_live then coalesce(published_at, now()) else published_at end
   where series_id = p_id;
  update public.test_series set is_published = v_live, updated_at = now() where id = p_id;

  if v_publish then
    insert into public.quiz_admin (quiz_id) select q.id from public.quizzes q where q.series_id = p_id
    on conflict (quiz_id) do nothing;
    update public.quiz_admin set status = 'published'
     where quiz_id in (select q.id from public.quizzes q where q.series_id = p_id);
  end if;
  if v_live then
    perform public.adm_complete_assignments_for_quiz(q.id) from public.quizzes q where q.series_id = p_id;
  end if;

  perform public.adm_audit(case when v_status = 'scheduled' then 'test_series.schedule'
                                when v_publish then 'test_series.publish' else 'test_series.unpublish' end,
                           'test_series', p_id, jsonb_build_object('is_published', s.is_published),
                           jsonb_build_object('is_published', v_live, 'status', v_status), null);
  return jsonb_build_object('series_id', p_id, 'is_published', v_live, 'tests', v_tests, 'status', v_status);
end $$;

-- Cron job (Batch 3 schedules it every 5 minutes): publishes every
-- 'scheduled' series whose go_live_at has passed. No admin check, because
-- cron runs without a user; execute is granted only to postgres and
-- service_role. Returns the number of series released.
create or replace function public.release_scheduled_series() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ids uuid[];
begin
  with u as (
    update public.test_series_admin
       set status = 'published', published_at = coalesce(published_at, go_live_at, now())
     where status = 'scheduled' and deleted_at is null
       and go_live_at is not null and go_live_at <= now()
    returning series_id
  )
  select coalesce(array_agg(series_id), '{}') into v_ids from u;
  if cardinality(v_ids) = 0 then return 0; end if;

  update public.test_series set is_published = true, updated_at = now() where id = any (v_ids);
  perform public.adm_complete_assignments_for_quiz(q.id) from public.quizzes q where q.series_id = any (v_ids);
  return cardinality(v_ids);
end $$;

-- ------------------------------------------------------ create / update
-- p: {name, description, instructions, subject, audience, pricing, price, startDate, endDate, status}
-- (status is ignored here: publishing goes through adm_publish_test_series).
-- description -> test_series.description, instructions -> test_series.instructions,
-- startDate / endDate -> test_series.available_from / available_until.
create or replace function public.create_test_series(p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id      uuid;
  v_name    text := nullif(btrim(coalesce(p ->> 'name', '')), '');
  v_subject text := nullif(btrim(coalesce(p ->> 'subject', '')), '');
  v_pricing text := case when p ->> 'pricing' = 'paid' then 'paid' else 'free' end;
  v_price   numeric;
begin
  perform public.adm_require_admin();
  if v_name is null then raise exception 'Series name is required.' using errcode = '22023'; end if;
  if exists (select 1 from public.adm_series_rows() r where lower(btrim(r.title)) = lower(v_name)) then
    raise exception 'A test series with this name already exists.' using errcode = '23505';
  end if;
  v_price := case when v_pricing = 'paid' then coalesce(nullif(p ->> 'price', '')::numeric, 0) else 0 end;
  if v_pricing = 'paid' and v_price <= 0 then
    raise exception 'Enter a price for a paid series.' using errcode = '22023';
  end if;

  v_id := public.adm_new_house_series(v_name, p ->> 'description', 'manual');
  update public.test_series set instructions = nullif(p ->> 'instructions', '') where id = v_id;
  update public.test_series_admin
     set audience            = nullif(btrim(coalesce(p ->> 'audience', '')), ''),
         pricing             = v_pricing,
         price_inr           = v_price,
         subject_category_id = public.adm_subject_category(v_subject),
         subject_label       = v_subject
   where series_id = v_id;

  perform public.adm_set_series_availability(v_id, nullif(p ->> 'startDate', '')::date, nullif(p ->> 'endDate', '')::date);
  perform public.adm_sync_series_to_lead(v_id);
  perform public.adm_audit('test_series.create', 'test_series', v_id, null, jsonb_build_object('title', v_name), null);
  return public.adm_series_json(v_id);
end $$;

-- Patch semantics: only keys present in p change. status 'draft' on a
-- published / scheduled series unpublishes it.
create or replace function public.update_test_series(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  cur        public.test_series_admin;
  v_before   jsonb;
  v_name     text;
  v_subject  text;
  v_pricing  text;
  v_price    numeric;
  v_start    date;
  v_end      date;
  v_dates    boolean := p ? 'startDate' or p ? 'endDate';
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_id);
  perform public.adm_ensure_series_admin(p_id);
  select * into cur from public.test_series_admin where series_id = p_id for update;
  v_before := public.adm_series_json(p_id);

  if p ? 'name' then
    v_name := nullif(btrim(coalesce(p ->> 'name', '')), '');
    if v_name is null then raise exception 'Series name is required.' using errcode = '22023'; end if;
    if exists (select 1 from public.adm_series_rows() r where lower(btrim(r.title)) = lower(v_name) and r.id <> p_id) then
      raise exception 'A test series with this name already exists.' using errcode = '23505';
    end if;
    update public.test_series set title = left(v_name, 150), updated_at = now() where id = p_id;
  end if;
  if p ? 'description' then
    update public.test_series set description = nullif(p ->> 'description', ''), updated_at = now() where id = p_id;
  end if;
  if p ? 'instructions' then
    update public.test_series set instructions = nullif(p ->> 'instructions', ''), updated_at = now() where id = p_id;
  end if;

  v_pricing := case when p ? 'pricing' then case when p ->> 'pricing' = 'paid' then 'paid' else 'free' end else cur.pricing end;
  v_price   := case when v_pricing = 'free' then 0
                    when p ? 'price' then coalesce(nullif(p ->> 'price', '')::numeric, 0)
                    else cur.price_inr end;
  if v_pricing = 'paid' and v_price <= 0 then
    raise exception 'Enter a price for a paid series.' using errcode = '22023';
  end if;
  select case when p ? 'startDate' then nullif(p ->> 'startDate', '')::date else r.start_date end,
         case when p ? 'endDate' then nullif(p ->> 'endDate', '')::date else r.end_date end
    into v_start, v_end
    from public.adm_series_rows() r where r.id = p_id;
  v_subject := nullif(btrim(coalesce(p ->> 'subject', '')), '');

  update public.test_series_admin
     set audience            = case when p ? 'audience' then nullif(btrim(coalesce(p ->> 'audience', '')), '') else audience end,
         subject_category_id = case when p ? 'subject' then public.adm_subject_category(v_subject) else subject_category_id end,
         subject_label       = case when p ? 'subject' then v_subject else subject_label end,
         pricing             = v_pricing,
         price_inr           = v_price,
         status              = case when p ->> 'status' = 'draft' and status in ('published', 'scheduled') then 'draft' else status end
   where series_id = p_id;

  if v_dates then
    perform public.adm_set_series_availability(p_id, v_start, v_end);
  end if;
  perform public.adm_sync_series_to_lead(p_id);
  perform public.adm_audit(case when p ->> 'status' = 'draft' and cur.status in ('published', 'scheduled')
                                then 'test_series.unpublish' else 'test_series.update' end,
                           'test_series', p_id, v_before, public.adm_series_json(p_id), null);
  return public.adm_series_json(p_id);
end $$;

create or replace function public.delete_test_series(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_id);
  perform public.adm_ensure_series_admin(p_id);
  update public.test_series_admin set deleted_at = now() where series_id = p_id;
  perform public.adm_sync_series_to_lead(p_id);   -- is_active = false, is_published = false
  perform public.adm_audit('test_series.delete', 'test_series', p_id, null, null, null);
end $$;

create or replace function public.duplicate_test_series(p_id uuid) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  src   record;
  v_new uuid;
  q     record;
  v_n   int := 0;
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_id);
  select r.* into src from public.adm_series_rows() r where r.id = p_id;

  v_new := public.adm_new_house_series(left(src.title || ' (Copy)', 150), src.about, 'duplicate');
  update public.test_series set instructions = src.instructions where id = v_new;
  update public.test_series_admin
     set who_for = src.who_for, audience = src.audience, syllabus = src.syllabus,
         pricing = src.pricing, price_inr = src.price_inr,
         subject_category_id = src.subject_category_id, subject_label = src.subject_name,
         grade = src.grade, exam = src.exam, level = src.level, languages = coalesce(src.languages, '{}'),
         monthly_limit = src.monthly_limit, access_days = src.access_days,
         late_allowed = coalesce(src.late_allowed, false) and src.late_grace_minutes is not null,
         late_grace_minutes = src.late_grace_minutes
   where series_id = v_new;

  for q in select x.id from public.quizzes x where x.series_id = p_id order by x.series_sort_order, x.created_at loop
    v_n := v_n + 1;
    perform public.adm_copy_quiz(q.id, v_new, v_n, null);
  end loop;

  -- Copy the source window unless it is invalid (then the copy is undated).
  update public.test_series n
     set available_from = o.available_from, available_until = o.available_until
    from public.test_series o
   where n.id = v_new and o.id = p_id
     and (o.available_from is null or o.available_until is null or o.available_until > o.available_from);
  perform public.adm_sync_series_to_lead(v_new);
  perform public.adm_audit('test_series.duplicate', 'test_series', v_new, null, jsonb_build_object('source', p_id), null);
  return v_new;
end $$;

-- --------------------------------------------------------------- wizard
create or replace function public.save_wizard_draft(p_id uuid, p_state jsonb) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id     uuid := p_id;
  v_name   text := nullif(btrim(coalesce(p_state ->> 'name', '')), '');
  v_method text := nullif(p_state ->> 'startMethod', '');
begin
  perform public.adm_require_admin();
  if v_method not in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then v_method := null; end if;
  if v_id is null then
    v_id := public.adm_new_house_series(coalesce(v_name, 'Untitled series'), nullif(p_state ->> 'about', ''), v_method);
    update public.test_series_admin set wizard_state = p_state where series_id = v_id;
  else
    perform public.adm_require_series(v_id);
    perform public.adm_ensure_series_admin(v_id);
    update public.test_series_admin
       set wizard_state = p_state, start_method = coalesce(v_method, start_method)
     where series_id = v_id and status = 'draft';
    if found and v_name is not null then
      update public.test_series set title = left(v_name, 150), updated_at = now() where id = v_id;
    end if;
  end if;
  return v_id;
end $$;

create or replace function public.discard_wizard_draft(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.test_series_admin set deleted_at = now()
   where series_id = p_id and status = 'draft' and deleted_at is null;
  if found then
    perform public.adm_sync_series_to_lead(p_id);
  end if;
end $$;

-- Wizard "Save as draft" (p_publish = false) and "Publish now / Schedule".
-- Replaces the tests of a house-course series; refuses when attempts exist.
create or replace function public.upsert_test_series_full(p jsonb, p_publish boolean default false) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  sid       uuid := nullif(p ->> 'id', '')::uuid;
  c         jsonb := coalesce(p -> 'classification', '{}'::jsonb);
  a         jsonb := coalesce(p -> 'availability', '{}'::jsonb);
  l         jsonb := coalesce(p -> 'lateSubmissions', '{}'::jsonb);
  v_name    text := nullif(btrim(coalesce(p ->> 'name', '')), '');
  v_subject text := nullif(btrim(coalesce(c ->> 'subject', '')), '');
  v_method  text := nullif(p ->> 'startMethod', '');
  v_pricing text := case when p ->> 'pricing' = 'paid' then 'paid' else 'free' end;
  v_price   numeric;
  v_mode    text := case when a ->> 'mode' = 'window' then 'window' else 'always' end;
  v_golive  text := case when a ->> 'goLive' = 'schedule' then 'schedule' else 'now' end;
  v_source  text;
  v_langs   text[];
  v_course  uuid;
  v_quiz    uuid;
  v_sec     uuid;
  t         jsonb;
  s         jsonb;
  q         jsonb;
  tpos      int := 0;
  spos      int;
  qpos      int;
begin
  perform public.adm_require_admin();
  if v_name is null then raise exception 'Series name is required.' using errcode = '22023'; end if;
  if v_method not in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then v_method := null; end if;
  v_source := case v_method when 'csv' then 'csv' when 'ai' then 'ai' when 'duplicate' then 'duplicate' else 'manual' end;
  v_price := case when v_pricing = 'paid' then coalesce(nullif(p ->> 'price', '')::numeric, 0) else 0 end;
  if v_pricing = 'paid' and v_price <= 0 then
    raise exception 'Enter a price for a paid series.' using errcode = '22023';
  end if;
  if exists (select 1 from public.adm_series_rows() r
              where lower(btrim(r.title)) = lower(v_name) and (sid is null or r.id <> sid)) then
    raise exception 'A test series with this name already exists.' using errcode = '23505';
  end if;
  select coalesce(array_agg(btrim(x)) filter (where btrim(x) <> ''), '{}') into v_langs
    from jsonb_array_elements_text(case when jsonb_typeof(c -> 'languages') = 'array' then c -> 'languages' else '[]'::jsonb end) x;

  if sid is null then
    sid := public.adm_new_house_series(v_name, p ->> 'about', v_method);
  else
    perform public.adm_require_series(sid);
    select course_id into v_course from public.test_series where id = sid;
    if v_course is distinct from public.adm_house_course_id() then
      raise exception 'This series belongs to a course; edit its tests individually instead of replacing them.' using errcode = '22023';
    end if;
    if exists (select 1 from public.quiz_attempts qat join public.quizzes qz on qz.id = qat.quiz_id where qz.series_id = sid) then
      raise exception 'This series already has attempts; edit tests and questions individually instead of replacing them.' using errcode = '22023';
    end if;
    perform public.adm_ensure_series_admin(sid);
    update public.test_series set title = left(v_name, 150), description = nullif(p ->> 'about', ''), updated_at = now()
     where id = sid;
    perform public.adm_delete_quiz(qz.id) from public.quizzes qz where qz.series_id = sid;
  end if;
  if p ? 'instructions' then
    update public.test_series set instructions = nullif(p ->> 'instructions', '') where id = sid;
  end if;

  update public.test_series_admin set
    who_for             = nullif(p ->> 'whoFor', ''),
    audience            = nullif(btrim(coalesce(p ->> 'audience', '')), ''),
    syllabus            = nullif(p ->> 'syllabus', ''),
    start_method        = coalesce(v_method, start_method),
    pricing             = v_pricing,
    price_inr           = v_price,
    subject_category_id = public.adm_subject_category(v_subject),
    subject_label       = v_subject,
    grade               = nullif(c ->> 'grade', ''),
    exam                = nullif(c ->> 'exam', ''),
    level               = nullif(c ->> 'difficulty', ''),
    languages           = v_langs,
    go_live_mode        = v_golive,
    go_live_at          = case when v_golive = 'schedule' then nullif(a ->> 'goLiveAt', '')::timestamptz end,
    monthly_limit      = case when coalesce((a ->> 'monthlyLimited')::boolean, false) then nullif(a ->> 'monthlyLimit', '')::int end,
    access_days         = case when coalesce((a ->> 'accessLimited')::boolean, false) then nullif(a ->> 'accessDays', '')::int end,
    late_allowed        = coalesce((l ->> 'allowed')::boolean, false),
    late_grace_minutes  = case when coalesce((l ->> 'allowed')::boolean, false) then nullif(l ->> 'graceMinutes', '')::int end,
    build_deadline      = nullif(p ->> 'buildDeadline', '')::date,
    wizard_state        = p -> 'wizardState'
  where series_id = sid;
  -- Window dates go to test_series.available_from / available_until (after
  -- go_live_* is saved, which can push available_from later).
  perform public.adm_set_series_availability(sid,
    case when v_mode = 'window' then nullif(a ->> 'openAt', '')::date end,
    case when v_mode = 'window' then nullif(a ->> 'closeAt', '')::date end);

  select course_id into v_course from public.test_series where id = sid;
  for t in select * from jsonb_array_elements(case when jsonb_typeof(p -> 'tests') = 'array' then p -> 'tests' else '[]'::jsonb end) loop
    tpos := tpos + 1;
    insert into public.quizzes (course_id, series_id, series_sort_order, title)
    values (v_course, sid, tpos, left(coalesce(nullif(btrim(coalesce(t ->> 'name', '')), ''), 'Test ' || tpos), 200))
    returning id into v_quiz;
    perform public.adm_apply_test_fields(v_quiz, t - 'name');

    spos := 0;
    for s in select * from jsonb_array_elements(case when jsonb_typeof(t -> 'sections') = 'array' then t -> 'sections' else '[]'::jsonb end) loop
      spos := spos + 1;
      insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
      values (v_quiz, spos, coalesce(nullif(btrim(coalesce(s ->> 'name', '')), ''), 'Section ' || spos), s ->> 'instructions',
              nullif(s ->> 'questionCount', '')::int, nullif(s ->> 'marks', '')::numeric);
    end loop;

    qpos := 0;
    for q in select * from jsonb_array_elements(case when jsonb_typeof(t -> 'questions') = 'array' then t -> 'questions' else '[]'::jsonb end) loop
      v_sec := (select ts.id from public.test_sections ts
                 where ts.quiz_id = v_quiz and ts.position = nullif(q ->> 'sectionPosition', '')::int);
      if public.adm_insert_question(v_quiz, qpos + 1, q, v_sec, v_source) is not null then
        qpos := qpos + 1;
      end if;
    end loop;
  end loop;

  perform public.adm_sync_series_to_lead(sid);
  perform public.adm_audit('test_series.wizard_save', 'test_series', sid, null,
                           jsonb_build_object('tests', tpos, 'publish', coalesce(p_publish, false)), null);
  if coalesce(p_publish, false) then
    perform public.adm_publish_test_series(sid, true);
  end if;
  return sid;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.get_test_series_stats() from public, anon;
revoke all on function public.list_test_series(text, text, text, text, int, int) from public, anon;
revoke all on function public.get_test_series(uuid) from public, anon;
revoke all on function public.series_name_exists(text, uuid) from public, anon;
revoke all on function public.adm_publish_test_series(uuid, boolean) from public, anon;
revoke all on function public.create_test_series(jsonb) from public, anon;
revoke all on function public.update_test_series(uuid, jsonb) from public, anon;
revoke all on function public.delete_test_series(uuid) from public, anon;
revoke all on function public.duplicate_test_series(uuid) from public, anon;
revoke all on function public.save_wizard_draft(uuid, jsonb) from public, anon;
revoke all on function public.discard_wizard_draft(uuid) from public, anon;
revoke all on function public.upsert_test_series_full(jsonb, boolean) from public, anon;

grant execute on function public.get_test_series_stats() to authenticated;
grant execute on function public.list_test_series(text, text, text, text, int, int) to authenticated;
grant execute on function public.get_test_series(uuid) to authenticated;
grant execute on function public.series_name_exists(text, uuid) to authenticated;
grant execute on function public.adm_publish_test_series(uuid, boolean) to authenticated;

revoke all on function public.release_scheduled_series() from public, anon, authenticated;
grant execute on function public.release_scheduled_series() to postgres, service_role;
grant execute on function public.create_test_series(jsonb) to authenticated;
grant execute on function public.update_test_series(uuid, jsonb) to authenticated;
grant execute on function public.delete_test_series(uuid) to authenticated;
grant execute on function public.duplicate_test_series(uuid) to authenticated;
grant execute on function public.save_wizard_draft(uuid, jsonb) to authenticated;
grant execute on function public.discard_wizard_draft(uuid) to authenticated;
grant execute on function public.upsert_test_series_full(jsonb, boolean) to authenticated;

-- =====================================================================
-- 20261025110600_admin_rpc_tests_questions.sql
--
-- Purpose
--   Test (quiz), section, question and option CRUD for testSeriesApi.js (D3/D4):
--     create_test(p_series_id, p) / update_test(p_id, p) / delete_test(p_id)
--     duplicate_test(p_id) / set_test_status(p_id, p_status)  (publish / unpublish)
--     create_test_section(p_test_id, p) / update_test_section(p_id, p) / delete_test_section(p_id)
--     create_question(p_test_id, p) / update_question(p_id, p) / delete_question(p_id)
--     create_question_option(p_question_id, p) / update_question_option(p_id, p) / delete_question_option(p_id)
--   Tests and questions return the JSON built by adm_test_json / adm_question_json.
--
-- Lead objects written
--   quizzes, quiz_questions, quiz_question_options (through these RPCs only).
-- Lead objects read
--   quiz_attempts, quiz_answers (to refuse destructive edits once students
--   have answered), test_series.
--
-- Assumptions
--   * Per-test status (draft / published) lives only in quiz_admin. The lead's
--     quizzes table has no status, so the lead's student app sees every quiz of
--     a published series regardless of this flag (reported as a gap).
--   * Questions with student answers cannot change type, be deleted, or have
--     their options replaced or their correct flags changed.
--   * Test fields are stored in the lead's quizzes columns (instructions ->
--     description, duration -> time_limit_mins, attemptLimit -> max_attempts,
--     passingPercent -> passing_score, shuffleQuestions -> shuffle_questions,
--     position -> series_sort_order, showAnswersAfter -> show_answers_after).
--   * Text-answer questions (short_answer, fill_in_blank, subjective,
--     long_answer) are saved with one correct option: the accepted answer,
--     else the model answer, else 'Manual grading: see rubric'.
--   * set_test_status('published') applies the lead's publish checks and
--     messages ('"<title>" has no questions.', '"<title>" has N question(s)
--     without a correct answer.').
--
-- ROLLBACK
--   drop function if exists public.delete_question_option(uuid), public.update_question_option(uuid, jsonb),
--     public.create_question_option(uuid, jsonb), public.delete_question(uuid), public.update_question(uuid, jsonb),
--     public.create_question(uuid, jsonb), public.delete_test_section(uuid), public.update_test_section(uuid, jsonb),
--     public.create_test_section(uuid, jsonb), public.set_test_status(uuid, text), public.duplicate_test(uuid),
--     public.delete_test(uuid), public.update_test(uuid, jsonb), public.create_test(uuid, jsonb);
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- status
create or replace function public.set_test_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_msg text;
  v_old text;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_id);
  if p_status not in ('draft', 'published') then
    raise exception 'Unknown test status: %', p_status using errcode = '22023';
  end if;
  if p_status = 'published' then
    v_msg := public.adm_validate_quiz_for_publish(p_id);
    if v_msg is not null then raise exception '%', v_msg using errcode = '22023'; end if;
  end if;
  insert into public.quiz_admin (quiz_id) values (p_id) on conflict (quiz_id) do nothing;
  select status into v_old from public.quiz_admin where quiz_id = p_id for update;
  update public.quiz_admin set status = p_status where quiz_id = p_id;
  if p_status = 'published' then
    perform public.adm_complete_assignments_for_quiz(p_id);
  end if;
  perform public.adm_audit('test.' || case when p_status = 'published' then 'publish' else 'unpublish' end,
                           'quiz', p_id, jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), null);
  return public.adm_test_json(p_id);
end $$;

-- ------------------------------------------------------------------ tests
-- p: {name, instructions, duration, totalMarks, passingMarks | passingPercent,
--     attemptLimit, scheduledAt, shuffleQuestions, shuffleOptions, window,
--     plannedQuestions, topics, showAnswersAfter, status, questions[]}
create or replace function public.create_test(p_series_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_course uuid;
  v_pos    int;
  v_quiz   uuid;
  q        jsonb;
  qpos     int := 0;
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_series_id);
  if nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Test name is required.' using errcode = '22023';
  end if;
  select course_id into v_course from public.test_series where id = p_series_id;
  select coalesce(max(series_sort_order), 0) + 1 into v_pos from public.quizzes where series_id = p_series_id;

  insert into public.quizzes (course_id, series_id, series_sort_order, title)
  values (v_course, p_series_id, v_pos, left(btrim(p ->> 'name'), 200))
  returning id into v_quiz;
  perform public.adm_apply_test_fields(v_quiz, p - 'status' - 'questions');

  for q in select * from jsonb_array_elements(case when jsonb_typeof(p -> 'questions') = 'array' then p -> 'questions' else '[]'::jsonb end) loop
    if public.adm_insert_question(v_quiz, qpos + 1, q - 'id', null, 'manual') is not null then
      qpos := qpos + 1;
    end if;
  end loop;

  perform public.adm_audit('test.create', 'quiz', v_quiz, null, jsonb_build_object('series_id', p_series_id, 'title', p ->> 'name'), null);
  if p ->> 'status' = 'published' then
    return public.set_test_status(v_quiz, 'published');
  end if;
  return public.adm_test_json(v_quiz);
end $$;

-- Questions are not replaced here (edit them with the question RPCs).
create or replace function public.update_test(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_id);
  perform public.adm_apply_test_fields(p_id, p - 'status' - 'questions');
  select coalesce(qa.status, 'draft') into v_old from public.quiz_admin qa where qa.quiz_id = p_id;
  perform public.adm_audit('test.update', 'quiz', p_id, null, p - 'questions', null);
  if p ->> 'status' in ('draft', 'published') and p ->> 'status' is distinct from v_old then
    return public.set_test_status(p_id, p ->> 'status');
  end if;
  return public.adm_test_json(p_id);
end $$;

create or replace function public.delete_test(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_series uuid;
begin
  perform public.adm_require_admin();
  v_series := public.adm_require_quiz(p_id);
  perform public.adm_delete_quiz(p_id);
  perform public.adm_audit('test.delete', 'quiz', p_id, jsonb_build_object('series_id', v_series), null, null);
end $$;

create or replace function public.duplicate_test(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_series uuid;
  v_pos    int;
  v_title  text;
  v_new    uuid;
begin
  perform public.adm_require_admin();
  v_series := public.adm_require_quiz(p_id);
  select coalesce(max(series_sort_order), 0) + 1 into v_pos from public.quizzes where series_id = v_series;
  select title || ' (Copy)' into v_title from public.quizzes where id = p_id;
  v_new := public.adm_copy_quiz(p_id, v_series, v_pos, v_title);
  perform public.adm_audit('test.duplicate', 'quiz', v_new, null, jsonb_build_object('source', p_id), null);
  return public.adm_test_json(v_new);
end $$;

-- --------------------------------------------------------------- sections
-- p accepts snake_case (table shape) or camelCase keys.
create or replace function public.create_test_section(p_test_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pos int;
  r     public.test_sections;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_test_id);
  if nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Section name is required.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(position), 0) + 1 from public.test_sections where quiz_id = p_test_id));
  insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
  values (p_test_id, v_pos, btrim(p ->> 'name'), nullif(p ->> 'instructions', ''),
          coalesce(nullif(p ->> 'planned_questions', ''), nullif(p ->> 'plannedQuestions', ''))::int,
          coalesce(nullif(p ->> 'planned_marks', ''), nullif(p ->> 'plannedMarks', ''))::numeric)
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.update_test_section(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.test_sections;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz((select quiz_id from public.test_sections where id = p_id));
  if p ? 'name' and nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Section name is required.' using errcode = '22023';
  end if;
  update public.test_sections set
    name              = case when p ? 'name' then btrim(p ->> 'name') else name end,
    instructions      = case when p ? 'instructions' then nullif(p ->> 'instructions', '') else instructions end,
    position          = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, position) else position end,
    planned_questions = case when p ? 'planned_questions' then nullif(p ->> 'planned_questions', '')::int
                             when p ? 'plannedQuestions' then nullif(p ->> 'plannedQuestions', '')::int else planned_questions end,
    planned_marks     = case when p ? 'planned_marks' then nullif(p ->> 'planned_marks', '')::numeric
                             when p ? 'plannedMarks' then nullif(p ->> 'plannedMarks', '')::numeric else planned_marks end
  where id = p_id
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.delete_test_section(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz((select quiz_id from public.test_sections where id = p_id));
  delete from public.test_sections where id = p_id;   -- questions keep their rows; section_id becomes null
end $$;

-- -------------------------------------------------------------- questions
-- p: the editor shape {type, text, optionA..D, correctAnswer, marks, negativeMarks,
--    difficulty, subject, topic, explanation, answerInstructions, image, position, sectionId}
--    or the table shape {type, body, marks, negative_marks, ..., options[]}.
create or replace function public.create_question(p_test_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pos     int;
  v_section uuid := coalesce(nullif(p ->> 'section_id', ''), nullif(p ->> 'sectionId', ''))::uuid;
  v_id      uuid;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_test_id);
  if v_section is not null and not exists (select 1 from public.test_sections where id = v_section and quiz_id = p_test_id) then
    raise exception 'Section does not belong to this test.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(sort_order), 0) + 1 from public.quiz_questions where quiz_id = p_test_id));
  v_id := public.adm_insert_question(p_test_id, v_pos, p, v_section, 'manual');
  if v_id is null then raise exception 'Question text is required.' using errcode = '22023'; end if;
  perform public.adm_audit('question.create', 'quiz_question', v_id, null, jsonb_build_object('test_id', p_test_id), null);
  return public.adm_question_json(v_id);
end $$;

create or replace function public.update_question(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_quiz        uuid;
  v_cur_lead    text;
  v_type        text;
  v_lead        text;
  v_answered    boolean;
  v_text        text;
  v_has_options boolean := jsonb_typeof(p -> 'options') = 'array' or p ? 'optionA' or p ? 'optionB';
  v_before      jsonb;
begin
  perform public.adm_require_admin();
  select quiz_id, question_type into v_quiz, v_cur_lead from public.quiz_questions where id = p_id for update;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  v_answered := exists (select 1 from public.quiz_answers where question_id = p_id);
  v_before := public.adm_question_json(p_id);

  if p ? 'type' then
    v_type := lower(btrim(coalesce(p ->> 'type', '')));
    v_lead := public.adm_map_question_type(v_type);
    if v_lead is null then raise exception 'Unsupported question type: %', v_type using errcode = '22023'; end if;
    if v_answered and v_lead <> v_cur_lead then
      raise exception 'Students have answered this question; its type cannot change.' using errcode = '22023';
    end if;
  end if;
  if p ? 'text' or p ? 'body' then
    v_text := nullif(btrim(coalesce(p ->> 'text', p ->> 'body', '')), '');
    if v_text is null then raise exception 'Question text is required.' using errcode = '22023'; end if;
  end if;

  update public.quiz_questions set
    question_text = coalesce(v_text, question_text),
    question_type = coalesce(v_lead, question_type),
    points        = case when p ? 'marks' then coalesce(nullif(p ->> 'marks', '')::numeric, points) else points end,
    explanation   = case when p ? 'explanation' then nullif(btrim(coalesce(p ->> 'explanation', '')), '') else explanation end,
    sort_order    = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, sort_order) else sort_order end
  where id = p_id;

  insert into public.quiz_question_admin (question_id, admin_type)
  values (p_id, public.adm_ui_question_type(v_cur_lead)) on conflict (question_id) do nothing;
  update public.quiz_question_admin set
    admin_type           = coalesce(v_type, admin_type),
    needs_manual_grading = case when v_type is not null then v_type in ('subjective', 'long_answer', 'descriptive') else needs_manual_grading end,
    negative_marks       = case when p ? 'negativeMarks' then greatest(coalesce(nullif(p ->> 'negativeMarks', '')::numeric, 0), 0)
                                when p ? 'negative_marks' then greatest(coalesce(nullif(p ->> 'negative_marks', '')::numeric, 0), 0)
                                else negative_marks end,
    difficulty           = case when lower(coalesce(p ->> 'difficulty', '')) in ('easy', 'medium', 'hard') then lower(p ->> 'difficulty') else difficulty end,
    subject              = case when p ? 'subject' then nullif(btrim(coalesce(p ->> 'subject', '')), '') else subject end,
    topic                = case when p ? 'topic' then nullif(btrim(coalesce(p ->> 'topic', '')), '') else topic end,
    image_path           = case when p ? 'image' then nullif(p ->> 'image', '')
                                when p ? 'image_path' then nullif(p ->> 'image_path', '') else image_path end,
    answer_instructions  = case when p ? 'answerInstructions' then nullif(p ->> 'answerInstructions', '')
                                when p ? 'rubric' then nullif(p ->> 'rubric', '')
                                when p ? 'answer_instructions' then nullif(p ->> 'answer_instructions', '') else answer_instructions end,
    section_id           = case when p ? 'section_id' then nullif(p ->> 'section_id', '')::uuid
                                when p ? 'sectionId' then nullif(p ->> 'sectionId', '')::uuid else section_id end
  where question_id = p_id;

  -- Options are replaced only when the payload carries option texts, when the
  -- question is (or became) a text-answer type, or when its accepted / model
  -- answer changed. Text-answer questions always get exactly one correct
  -- option (accepted answer, model answer or the manual-grading placeholder;
  -- see adm_insert_options), so they stay publishable under the lead's rule.
  if v_has_options or (v_lead is not null and v_lead not in ('multiple_choice', 'true_false'))
     or ((p ? 'correctAnswer' or p ? 'answer' or p ? 'modelAnswer' or p ? 'model_answer')
         and coalesce(v_lead, v_cur_lead) in ('fill_in_blank', 'short_answer')) then
    if v_answered then
      raise exception 'Students have answered this question; edit its options one by one instead.' using errcode = '22023';
    end if;
    delete from public.quiz_question_options where question_id = p_id;
    perform public.adm_insert_options(p_id, (select question_type from public.quiz_questions where id = p_id),
                                      p || jsonb_build_object('type', (select admin_type from public.quiz_question_admin
                                                                        where question_id = p_id)));
  end if;

  perform public.adm_audit('question.update', 'quiz_question', p_id, v_before, public.adm_question_json(p_id), null);
  return public.adm_question_json(p_id);
end $$;

create or replace function public.delete_question(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_quiz uuid;
begin
  perform public.adm_require_admin();
  select quiz_id into v_quiz from public.quiz_questions where id = p_id;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  if exists (select 1 from public.quiz_answers where question_id = p_id) then
    raise exception 'Students have answered this question; it cannot be deleted.' using errcode = '23503';
  end if;
  delete from public.quiz_question_options where question_id = p_id;
  delete from public.quiz_questions where id = p_id;
  perform public.adm_audit('question.delete', 'quiz_question', p_id, jsonb_build_object('test_id', v_quiz), null, null);
end $$;

-- ---------------------------------------------------------------- options
-- Returned shape: {id, question_id, option_key, label, is_correct, position}
create or replace function public.create_question_option(p_question_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_quiz  uuid;
  v_label text := nullif(btrim(coalesce(p ->> 'label', p ->> 'text', p ->> 'option_text', '')), '');
  v_pos   int;
  v_id    uuid;
begin
  perform public.adm_require_admin();
  select quiz_id into v_quiz from public.quiz_questions where id = p_question_id;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  if v_label is null then raise exception 'Option text is required.' using errcode = '22023'; end if;
  if exists (select 1 from public.quiz_answers where question_id = p_question_id) then
    raise exception 'Students have answered this question; options cannot be added.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(sort_order), 0) + 1 from public.quiz_question_options where question_id = p_question_id));
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (p_question_id, v_label, coalesce((p ->> 'is_correct')::boolean, (p ->> 'isCorrect')::boolean, false), v_pos)
  returning id into v_id;
  return (select o.v from jsonb_array_elements(public.adm_question_json(p_question_id) -> 'options') as o(v)
           where o.v ->> 'id' = v_id::text);
end $$;

create or replace function public.update_question_option(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_question uuid;
  v_correct  boolean;
  v_new      boolean := coalesce((p ->> 'is_correct')::boolean, (p ->> 'isCorrect')::boolean);
begin
  perform public.adm_require_admin();
  select question_id, is_correct into v_question, v_correct from public.quiz_question_options where id = p_id for update;
  if v_question is null then raise exception 'Option not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz((select quiz_id from public.quiz_questions where id = v_question));
  if v_new is not null and v_new is distinct from v_correct
     and exists (select 1 from public.quiz_answers where question_id = v_question) then
    raise exception 'Students have answered this question; the correct answer cannot change.' using errcode = '22023';
  end if;
  if (p ? 'label' or p ? 'text') and nullif(btrim(coalesce(p ->> 'label', p ->> 'text', '')), '') is null then
    raise exception 'Option text is required.' using errcode = '22023';
  end if;
  if v_new is false and (select question_type from public.quiz_questions where id = v_question) in ('fill_in_blank', 'short_answer') then
    raise exception 'A text-answer question keeps its answer option marked correct; edit its text instead.' using errcode = '22023';
  end if;
  update public.quiz_question_options set
    option_text = coalesce(nullif(btrim(coalesce(p ->> 'label', p ->> 'text', '')), ''), option_text),
    is_correct  = coalesce(v_new, is_correct),
    sort_order  = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, sort_order) else sort_order end
  where id = p_id;
  return (select o.v from jsonb_array_elements(public.adm_question_json(v_question) -> 'options') as o(v)
           where o.v ->> 'id' = p_id::text);
end $$;

create or replace function public.delete_question_option(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_question uuid;
begin
  perform public.adm_require_admin();
  select question_id into v_question from public.quiz_question_options where id = p_id;
  if v_question is null then raise exception 'Option not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz((select quiz_id from public.quiz_questions where id = v_question));
  if exists (select 1 from public.quiz_answers where question_id = v_question) then
    raise exception 'Students have answered this question; options cannot be removed.' using errcode = '23503';
  end if;
  if (select question_type from public.quiz_questions where id = v_question) in ('fill_in_blank', 'short_answer')
     and (select count(*) from public.quiz_question_options where question_id = v_question and is_correct and id <> p_id) = 0 then
    raise exception 'A text-answer question needs its answer option; edit it instead of deleting it.' using errcode = '22023';
  end if;
  delete from public.quiz_question_options where id = p_id;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.set_test_status(uuid, text) from public, anon;
revoke all on function public.create_test(uuid, jsonb) from public, anon;
revoke all on function public.update_test(uuid, jsonb) from public, anon;
revoke all on function public.delete_test(uuid) from public, anon;
revoke all on function public.duplicate_test(uuid) from public, anon;
revoke all on function public.create_test_section(uuid, jsonb) from public, anon;
revoke all on function public.update_test_section(uuid, jsonb) from public, anon;
revoke all on function public.delete_test_section(uuid) from public, anon;
revoke all on function public.create_question(uuid, jsonb) from public, anon;
revoke all on function public.update_question(uuid, jsonb) from public, anon;
revoke all on function public.delete_question(uuid) from public, anon;
revoke all on function public.create_question_option(uuid, jsonb) from public, anon;
revoke all on function public.update_question_option(uuid, jsonb) from public, anon;
revoke all on function public.delete_question_option(uuid) from public, anon;

grant execute on function public.set_test_status(uuid, text) to authenticated;
grant execute on function public.create_test(uuid, jsonb) to authenticated;
grant execute on function public.update_test(uuid, jsonb) to authenticated;
grant execute on function public.delete_test(uuid) to authenticated;
grant execute on function public.duplicate_test(uuid) to authenticated;
grant execute on function public.create_test_section(uuid, jsonb) to authenticated;
grant execute on function public.update_test_section(uuid, jsonb) to authenticated;
grant execute on function public.delete_test_section(uuid) to authenticated;
grant execute on function public.create_question(uuid, jsonb) to authenticated;
grant execute on function public.update_question(uuid, jsonb) to authenticated;
grant execute on function public.delete_question(uuid) to authenticated;
grant execute on function public.create_question_option(uuid, jsonb) to authenticated;
grant execute on function public.update_question_option(uuid, jsonb) to authenticated;
grant execute on function public.delete_question_option(uuid) to authenticated;

-- =====================================================================
-- 20261025110700_admin_rpc_assignments.sql
--
-- Purpose
--   Assign Educators RPCs (assignmentsApi.js). Names and parameters match the
--   archived contract; three new read RPCs replace direct view / table reads
--   (D4): list_series_requests (was v_series_requests), list_eligible_educators
--   (was v_eligible_educators), list_series_options (was test_series select).
--     list_assignments(p_search, p_sort, p_subject, p_educator, p_status, p_deadline_before, p_page, p_size)
--     get_assignment_detail(p_id)
--     create_assignments(p) -> uuid[]
--     update_assignment_requirements(p_id, patch) / reassign_educator(p_id, p_educator)
--     extend_deadline(p_id, p_date) / cancel_assignment(p_id, p_reason)
--     start_review(p_id) / review_submission(p_id, p_decision, p_feedback, p_comments, p_reason) -> text
--     assign_request(p_request, p_educator, p_deadline, p_note) -> uuid / reject_request(p_request, p_reason)
--
-- Lead objects read
--   test_series, profiles, educator_profiles (verified = eligible).
--   "New series" from the form is created on the house course (D2).
--
-- Assumptions
--   * Subjects are free text on assignments (categories are read-only, D9).
--   * Business decisions (create, reassign, cancel, review) are also written to
--     audit_logs (D9).
--
-- ROLLBACK
--   drop function if exists public.reject_request(uuid, text), public.assign_request(uuid, uuid, date, text),
--     public.review_submission(uuid, text, text, jsonb, text), public.start_review(uuid),
--     public.cancel_assignment(uuid, text), public.extend_deadline(uuid, date), public.reassign_educator(uuid, uuid),
--     public.update_assignment_requirements(uuid, jsonb), public.create_assignments(jsonb),
--     public.list_series_options(), public.list_eligible_educators(), public.list_series_requests(),
--     public.get_assignment_detail(uuid),
--     public.list_assignments(text, text, text, uuid, text, date, int, int);
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------------------------ reads
-- p_sort: deadline_asc | deadline_desc | assigned_desc | progress_desc
-- p_status: any assignment status or 'overdue'
create or replace function public.list_assignments(
  p_search text default null, p_sort text default 'deadline_asc', p_subject text default null,
  p_educator uuid default null, p_status text default null, p_deadline_before date default null,
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 8), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select v.* from public.adm_assignment_rows() v
     where (v_like is null or (v.code || ' ' || coalesce(v.test_name, '') || ' ' || v.series_name || ' '
                               || coalesce(v.educator_name, '')) ilike v_like)
       and (p_subject is null or p_subject in ('', 'all') or v.subject = p_subject)
       and (p_educator is null or v.educator_id = p_educator)
       and (p_status is null or p_status in ('', 'all')
            or case when p_status = 'overdue' then v.display_status = 'overdue' else v.status = p_status end)
       and (p_deadline_before is null or v.deadline <= p_deadline_before)
  )
  select to_jsonb(f), count(*) over ()
    from f
   order by case when p_sort = 'deadline_asc'  then f.deadline end asc nulls last,
            case when p_sort = 'deadline_desc' then f.deadline end desc nulls last,
            case when p_sort = 'assigned_desc' then f.assigned_date end desc,
            case when p_sort = 'progress_desc' then f.progress end desc,
            f.code
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_assignment_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'assignment',    to_jsonb(v),
      'history',       (select coalesce(jsonb_agg(to_jsonb(h) order by h.at), '[]'::jsonb)
                          from public.assignment_history h where h.assignment_id = p_id),
      'comments',      (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]'::jsonb)
                          from public.assignment_comments c where c.assignment_id = p_id),
      'notifications', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]'::jsonb)
                          from public.assignment_notifications n where n.assignment_id = p_id))
      from public.adm_assignment_rows() v where v.id = p_id);
end $$;

-- Same keys as the archived v_series_requests (r.* + assignment_id, assignment_code).
create or replace function public.list_series_requests() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(r) || jsonb_build_object('assignment_id', a.id, 'assignment_code', a.code)
                     order by r.sent_date desc, r.created_at desc)
      from public.series_requests r
      left join public.test_assignments a on a.request_id = r.id), '[]'::jsonb);
end $$;

-- [{id, name, subjects}] ordered by name (was v_eligible_educators).
create or replace function public.list_eligible_educators() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((select jsonb_agg(to_jsonb(e) order by e.name) from public.adm_eligible_educators() e), '[]'::jsonb);
end $$;

-- [{id, title}] of non-deleted series (was test_series select ... deleted_at is null).
create or replace function public.list_series_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'status', r.status) order by r.title)
                     from public.adm_series_rows() r), '[]'::jsonb);
end $$;

-- ----------------------------------------------------------------- writes
-- p = {seriesMode:'existing'|'new', seriesId, newSeriesName, subject, topics:[], testName,
--      educatorIds:[], questionCount, questionTypeMix, difficulty, totalMarks, duration,
--      deadline, instructions}. One assignment per educator.
create or replace function public.create_assignments(p jsonb) returns uuid[]
language plpgsql security definer set search_path = public, extensions as $$
declare
  sid    uuid;
  ids    uuid[] := '{}';
  eid    uuid;
  aid    uuid;
  sname  text;
  subj   text := nullif(btrim(coalesce(p ->> 'subject', '')), '');
  tname  text := nullif(btrim(coalesce(p ->> 'testName', '')), '');
  mix    text := coalesce(nullif(p ->> 'questionTypeMix', ''), 'mixed');
  diff   text := coalesce(nullif(p ->> 'difficulty', ''), 'Medium');
begin
  perform public.adm_require_admin();
  if tname is null then raise exception 'Test / question paper name is required.' using errcode = '22023'; end if;
  if subj is null then raise exception 'Subject is required.' using errcode = '22023'; end if;
  if nullif(p ->> 'deadline', '') is null or (p ->> 'deadline')::date < current_date then
    raise exception 'Deadline must be today or later.' using errcode = '22023';
  end if;
  if jsonb_typeof(p -> 'educatorIds') <> 'array' or jsonb_array_length(p -> 'educatorIds') = 0 then
    raise exception 'Select at least one educator.' using errcode = '22023';
  end if;
  if mix not in ('objective', 'subjective', 'mixed') then raise exception 'Unknown question type mix: %', mix using errcode = '22023'; end if;
  if diff not in ('Easy', 'Medium', 'Hard', 'Mixed') then raise exception 'Unknown difficulty: %', diff using errcode = '22023'; end if;

  if p ->> 'seriesMode' = 'new' then
    sname := nullif(btrim(coalesce(p ->> 'newSeriesName', '')), '');
    if sname is null or char_length(sname) < 3 then raise exception 'Enter a name for the new series.' using errcode = '22023'; end if;
    if exists (select 1 from public.adm_series_rows() r where lower(btrim(r.title)) = lower(sname)) then
      raise exception 'A test series with this name already exists.' using errcode = '23505';
    end if;
    sid := public.adm_new_house_series(sname, null, 'scratch');
  else
    sid := nullif(p ->> 'seriesId', '')::uuid;
    if sid is null then raise exception 'Select a test series.' using errcode = '22023'; end if;
    perform public.adm_require_series(sid);
  end if;

  for eid in select x::uuid from jsonb_array_elements_text(p -> 'educatorIds') x loop
    if not exists (select 1 from public.adm_eligible_educators() e where e.id = eid) then
      raise exception 'Educator is not verified or not active.' using errcode = '22023';
    end if;
    insert into public.test_assignments (series_id, educator_id, subject, topics, test_name, question_count,
                                         question_type_mix, difficulty, total_marks, duration_minutes,
                                         instructions, deadline, created_by)
    values (sid, eid, subj,
            coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(
                        case when jsonb_typeof(p -> 'topics') = 'array' then p -> 'topics' else '[]'::jsonb end) x
                       where btrim(x) <> ''), '{}'),
            tname, coalesce(nullif(p ->> 'questionCount', '')::int, 20), mix, diff,
            coalesce(nullif(p ->> 'totalMarks', '')::numeric, 100), coalesce(nullif(p ->> 'duration', '')::int, 60),
            nullif(p ->> 'instructions', ''), (p ->> 'deadline')::date, auth.uid())
    returning id into aid;
    ids := ids || aid;
    perform public.adm_asg_log(aid, 'Assigned', 'Assignment created.');
    perform public.adm_asg_notify(aid, 'assigned', 'New test assignment',
      format('You''ve been assigned "%s" (%s). Deadline: %s.', tname, subj, p ->> 'deadline'));
  end loop;
  perform public.adm_audit('assignment.create', 'test_series', sid, null,
                           jsonb_build_object('assignments', to_jsonb(ids), 'test_name', tname), null);
  return ids;
end $$;

-- Row menu > Edit Requirements (patch keys are the create keys; seriesId may change).
create or replace function public.update_assignment_requirements(p_id uuid, patch jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_series uuid := nullif(patch ->> 'seriesId', '')::uuid;
begin
  perform public.adm_require_admin();
  if v_series is not null then perform public.adm_require_series(v_series); end if;
  if patch ? 'questionTypeMix' and patch ->> 'questionTypeMix' not in ('objective', 'subjective', 'mixed') then
    raise exception 'Unknown question type mix.' using errcode = '22023';
  end if;
  if patch ? 'difficulty' and patch ->> 'difficulty' not in ('Easy', 'Medium', 'Hard', 'Mixed') then
    raise exception 'Unknown difficulty.' using errcode = '22023';
  end if;
  update public.test_assignments set
    series_id         = coalesce(v_series, series_id),
    test_name         = coalesce(nullif(btrim(coalesce(patch ->> 'testName', '')), ''), test_name),
    subject           = coalesce(nullif(btrim(coalesce(patch ->> 'subject', '')), ''), subject),
    topics            = case when jsonb_typeof(patch -> 'topics') = 'array'
                             then coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(patch -> 'topics') x where btrim(x) <> ''), '{}')
                             else topics end,
    question_count    = coalesce(nullif(patch ->> 'questionCount', '')::int, question_count),
    question_type_mix = coalesce(nullif(patch ->> 'questionTypeMix', ''), question_type_mix),
    difficulty        = coalesce(nullif(patch ->> 'difficulty', ''), difficulty),
    total_marks       = coalesce(nullif(patch ->> 'totalMarks', '')::numeric, total_marks),
    duration_minutes  = coalesce(nullif(patch ->> 'duration', '')::int, duration_minutes),
    deadline          = coalesce(nullif(patch ->> 'deadline', '')::date, deadline),
    instructions      = case when patch ? 'instructions' then nullif(patch ->> 'instructions', '') else instructions end
  where id = p_id and status not in ('completed', 'cancelled');
  if not found then raise exception 'Assignment not found or already closed.' using errcode = 'P0002'; end if;
  perform public.adm_asg_log(p_id, 'Requirements updated', 'Test requirements were edited.');
  perform public.adm_asg_notify(p_id, 'updated', 'Assignment requirements updated',
                                'Requirements for your assignment were updated. Please review the changes.');
end $$;

create or replace function public.reassign_educator(p_id uuid, p_educator uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old uuid; v_old_name text; v_new_name text;
begin
  perform public.adm_require_admin();
  if not exists (select 1 from public.adm_eligible_educators() e where e.id = p_educator) then
    raise exception 'Educator is not verified or not active.' using errcode = '22023';
  end if;
  select a.educator_id, p.full_name into v_old, v_old_name
    from public.test_assignments a left join public.profiles p on p.id = a.educator_id where a.id = p_id;
  select full_name into v_new_name from public.profiles where id = p_educator;
  update public.test_assignments set educator_id = p_educator
   where id = p_id and status not in ('completed', 'cancelled');
  if not found then raise exception 'Assignment not found or already closed.' using errcode = 'P0002'; end if;
  perform public.adm_asg_log(p_id, 'Reassigned', format('Reassigned from %s to %s.', coalesce(v_old_name, '—'), coalesce(v_new_name, '—')));
  perform public.adm_asg_notify(p_id, 'assigned', 'New test assignment',
                                'You have been assigned a test to build. Check the deadline and requirements.');
  perform public.adm_audit('assignment.reassign', 'test_assignment', p_id,
                           jsonb_build_object('educator_id', v_old), jsonb_build_object('educator_id', p_educator), null);
end $$;

create or replace function public.extend_deadline(p_id uuid, p_date date) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  if p_date is null or p_date < current_date then
    raise exception 'Pick a date that is today or later.' using errcode = '22023';
  end if;
  update public.test_assignments set deadline = p_date where id = p_id and status not in ('completed', 'cancelled');
  if not found then raise exception 'Assignment not found or already closed.' using errcode = 'P0002'; end if;
  perform public.adm_asg_log(p_id, 'Deadline extended', 'New deadline: ' || p_date);
  perform public.adm_asg_notify(p_id, 'deadline_changed', 'Deadline updated',
                                'The deadline for your assignment is now ' || p_date || '.');
end $$;

create or replace function public.cancel_assignment(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  select status into v_old from public.test_assignments where id = p_id for update;
  update public.test_assignments set status = 'cancelled', cancel_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_id and status not in ('completed', 'cancelled');
  if not found then raise exception 'Assignment not found or already closed.' using errcode = 'P0002'; end if;
  perform public.adm_asg_log(p_id, 'Cancelled', coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Assignment cancelled.'));
  perform public.adm_asg_notify(p_id, 'cancelled', 'Assignment cancelled',
                                'Your assignment has been cancelled. ' || coalesce(p_reason, ''));
  perform public.adm_audit('assignment.cancel', 'test_assignment', p_id,
                           jsonb_build_object('status', v_old), jsonb_build_object('status', 'cancelled'), p_reason);
end $$;

-- Review modal open: submitted -> under_review (no-op otherwise).
create or replace function public.start_review(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.test_assignments set status = 'under_review' where id = p_id and status = 'submitted';
  if found then perform public.adm_asg_log(p_id, 'Review started', 'Admin opened this submission for review.'); end if;
end $$;

-- p_decision: approved | revision | rejected; p_comments: [{questionRef, comment}]
create or replace function public.review_submission(
  p_id uuid, p_decision text, p_feedback text, p_comments jsonb, p_reason text
) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_old text;
  v_new text;
  c     jsonb;
begin
  perform public.adm_require_admin();
  select status into v_old from public.test_assignments where id = p_id for update;
  if v_old is null or v_old not in ('submitted', 'under_review') then
    raise exception 'Only submitted assignments can be reviewed.' using errcode = '22023';
  end if;
  if p_decision not in ('approved', 'revision', 'rejected') then
    raise exception 'Invalid decision.' using errcode = '22023';
  end if;
  if p_decision in ('revision', 'rejected') and btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A reason is required.' using errcode = '22023';
  end if;
  v_new := case p_decision when 'approved' then 'approved' when 'revision' then 'revision_requested' else 'rejected' end;

  update public.test_assignments
     set status = v_new, overall_feedback = p_feedback, decision = v_new, decision_at = now(), decision_reason = p_reason
   where id = p_id;
  for c in select * from jsonb_array_elements(case when jsonb_typeof(p_comments) = 'array' then p_comments else '[]'::jsonb end) loop
    continue when nullif(btrim(coalesce(c ->> 'comment', '')), '') is null;
    insert into public.assignment_comments (assignment_id, question_ref, comment, author_id)
    values (p_id, c ->> 'questionRef', btrim(c ->> 'comment'), auth.uid());
  end loop;

  perform public.adm_asg_log(p_id, case p_decision when 'approved' then 'Approved' when 'revision' then 'Revision requested' else 'Rejected' end,
                             coalesce(nullif(p_reason, ''), p_feedback));
  perform public.adm_asg_notify(p_id, v_new,
    case p_decision when 'approved' then 'Submission approved' when 'revision' then 'Revision requested' else 'Submission rejected' end,
    coalesce(nullif(p_feedback, ''), p_reason));
  perform public.adm_audit('assignment.review', 'test_assignment', p_id,
                           jsonb_build_object('status', v_old), jsonb_build_object('status', v_new), p_reason);
  return v_new;
end $$;

-- Incoming request > Assign educator.
create or replace function public.assign_request(p_request uuid, p_educator uuid, p_deadline date, p_note text default null)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  r   public.series_requests;
  sid uuid;
  aid uuid;
begin
  perform public.adm_require_admin();
  select * into r from public.series_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'Request is not pending.' using errcode = '22023'; end if;
  if not exists (select 1 from public.adm_eligible_educators() e where e.id = p_educator) then
    raise exception 'Educator is not verified or not active.' using errcode = '22023';
  end if;
  if p_deadline is null or p_deadline < current_date then
    raise exception 'Pick a deadline that is today or later.' using errcode = '22023';
  end if;

  sid := r.series_id;
  if sid is not null and not exists (select 1 from public.adm_series_rows() x where x.id = sid) then
    sid := null;   -- the series was deleted since the request arrived
  end if;
  if sid is null then
    sid := public.adm_new_house_series(r.series_name, null, 'scratch');
  end if;

  insert into public.test_assignments (series_id, educator_id, subject, topics, test_name, question_count,
                                       question_type_mix, difficulty, total_marks, duration_minutes,
                                       instructions, deadline, request_id, created_by)
  values (sid, p_educator, r.subject, r.topics, r.test_name, coalesce(r.question_count, 20), r.question_type_mix,
          coalesce(r.difficulty, 'Medium'), coalesce(r.total_marks, 100), coalesce(r.duration_minutes, 60),
          concat_ws(E'\n\n', r.instructions, nullif(p_note, '')), p_deadline, r.id, auth.uid())
  returning id into aid;
  update public.series_requests set status = 'assigned', decision_at = now(), series_id = sid where id = p_request;
  perform public.adm_asg_log(aid, 'Assigned', 'Created from request ' || r.code);
  perform public.adm_asg_notify(aid, 'assigned', 'New test assignment',
                                format('You''ve been assigned "%s". Deadline: %s.', r.test_name, p_deadline));
  perform public.adm_audit('assignment.create_from_request', 'series_request', p_request, null,
                           jsonb_build_object('assignment_id', aid), null);
  return aid;
end $$;

create or replace function public.reject_request(p_request uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.series_requests set status = 'rejected', decision_at = now(), decision_reason = p_reason
   where id = p_request and status = 'pending';
  if not found then raise exception 'Request is not pending.' using errcode = '22023'; end if;
  perform public.adm_audit('series_request.reject', 'series_request', p_request, null, null, p_reason);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.list_assignments(text, text, text, uuid, text, date, int, int) from public, anon;
revoke all on function public.get_assignment_detail(uuid) from public, anon;
revoke all on function public.list_series_requests() from public, anon;
revoke all on function public.list_eligible_educators() from public, anon;
revoke all on function public.list_series_options() from public, anon;
revoke all on function public.create_assignments(jsonb) from public, anon;
revoke all on function public.update_assignment_requirements(uuid, jsonb) from public, anon;
revoke all on function public.reassign_educator(uuid, uuid) from public, anon;
revoke all on function public.extend_deadline(uuid, date) from public, anon;
revoke all on function public.cancel_assignment(uuid, text) from public, anon;
revoke all on function public.start_review(uuid) from public, anon;
revoke all on function public.review_submission(uuid, text, text, jsonb, text) from public, anon;
revoke all on function public.assign_request(uuid, uuid, date, text) from public, anon;
revoke all on function public.reject_request(uuid, text) from public, anon;

grant execute on function public.list_assignments(text, text, text, uuid, text, date, int, int) to authenticated;
grant execute on function public.get_assignment_detail(uuid) to authenticated;
grant execute on function public.list_series_requests() to authenticated;
grant execute on function public.list_eligible_educators() to authenticated;
grant execute on function public.list_series_options() to authenticated;
grant execute on function public.create_assignments(jsonb) to authenticated;
grant execute on function public.update_assignment_requirements(uuid, jsonb) to authenticated;
grant execute on function public.reassign_educator(uuid, uuid) to authenticated;
grant execute on function public.extend_deadline(uuid, date) to authenticated;
grant execute on function public.cancel_assignment(uuid, text) to authenticated;
grant execute on function public.start_review(uuid) to authenticated;
grant execute on function public.review_submission(uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.assign_request(uuid, uuid, date, text) to authenticated;
grant execute on function public.reject_request(uuid, text) to authenticated;

-- =====================================================================
-- 20261025110800_admin_rpc_tracker.sql
--
-- Purpose
--   Test Series Tracker and repeated-question detection (trackerApi.js):
--     get_tracker_stats()                         -> object (archived returned a table the page could not read)
--     list_series_tracker(p_search, p_sort, p_subject, p_educator, p_status, p_page, p_size)
--     get_series_tracker_detail(p_series)         -> {series, assignments}
--     detect_repeated_questions()                 -> int (pairs stored)
--     list_repeated_matches(p_type, p_subject, p_series, p_review, p_page, p_size)
--     get_match_counts()                          -> table(total, needs_review, confirmed)
--     mark_match_reviewed(p_id) / dismiss_match(p_id, p_note) / flag_match_confirmed(p_id, p_note)
--
-- Lead objects read
--   test_series, quizzes, quiz_questions (via adm_series_rows / adm_assignment_rows).
--
-- Assumptions
--   * Tracker rows include every non-deleted series (lead-owned ones show
--     "No Assignments Yet"). Rows carry a seriesId key because
--     TestSeriesTracker.jsx looks rows up by g.seriesId.
--   * Detection compares questions of series quizzes only (quizzes.series_id
--     not null), needs pg_trgm, and is O(n^2) without the trigram index in
--     scripts/admin_indexes_concurrently.sql.
--
-- ROLLBACK
--   drop function if exists public.flag_match_confirmed(uuid, text), public.dismiss_match(uuid, text),
--     public.mark_match_reviewed(uuid), public.adm_review_match(uuid, text, text), public.get_match_counts(),
--     public.list_repeated_matches(text, text, uuid, text, int, int), public.detect_repeated_questions(),
--     public.adm_detect_repeated_questions(),   -- unschedule the Batch 3 cron job first
--     public.get_series_tracker_detail(uuid), public.list_series_tracker(text, text, text, text, text, int, int),
--     public.get_tracker_stats(), public.adm_series_tracker_rows();
-- =====================================================================
set search_path = public, extensions;

create or replace function public.adm_series_tracker_rows()
returns table (
  series_id uuid, code text, series_name text, subject text, educators text[], total_required bigint,
  tests_created bigint, tests_submitted bigint, tests_approved bigint, completion_pct numeric, deadline date,
  overall_status text, series_status text, created_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  with a as (
    select v.series_id,
           count(*) as total_required,
           count(*) filter (where v.status in ('submitted', 'under_review', 'revision_requested', 'approved', 'completed')) as tests_created,
           count(*) filter (where v.status in ('approved', 'completed')) as tests_approved,
           min(v.deadline) filter (where v.status not in ('approved', 'completed', 'cancelled', 'rejected')) as nearest_deadline,
           bool_or(v.display_status = 'overdue') as any_overdue,
           bool_or(v.status = 'revision_requested') as any_revision,
           array_agg(distinct v.educator_name) filter (where v.educator_name is not null) as educators,
           min(v.subject) as assignment_subject
      from public.adm_assignment_rows() v
     where v.status <> 'cancelled'
     group by v.series_id
  )
  select r.id, r.code, r.title, coalesce(r.subject_name, a.assignment_subject), coalesce(a.educators, '{}'),
         coalesce(a.total_required, 0), coalesce(a.tests_created, 0), coalesce(a.tests_created, 0),
         coalesce(a.tests_approved, 0),
         case when coalesce(a.total_required, 0) = 0 then 0
              else round(a.tests_approved::numeric / a.total_required * 100) end,
         a.nearest_deadline,
         case when a.total_required is null            then 'No Assignments Yet'
              when a.any_overdue                       then 'Overdue'
              when a.tests_approved = a.total_required then 'Complete'
              when a.any_revision                      then 'Needs Revision'
              else 'On Track' end,
         r.status, r.created_at
    from public.adm_series_rows() r
    left join a on a.series_id = r.id;
$$;

create or replace function public.get_tracker_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'total_series',        (select count(*) from public.adm_series_rows()),
      'active_series',       (select count(*) from public.adm_series_rows() r where r.status = 'published'),
      'total_assignments',   count(*),
      'in_progress',         count(*) filter (where v.display_status = 'in_progress'),
      'pending_submissions', count(*) filter (where v.status in ('assigned', 'in_progress')),
      'pending_reviews',     count(*) filter (where v.status in ('submitted', 'under_review')),
      'completed',           count(*) filter (where v.status = 'completed'),
      'overdue',             count(*) filter (where v.display_status = 'overdue'))
      from public.adm_assignment_rows() v);
end $$;

-- p_sort: deadline_asc | completion_desc | name_asc.
-- p_status: On Track | Complete | Needs Revision | Overdue | No Assignments Yet.
-- p_educator: educator name (the page builds the filter from names).
create or replace function public.list_series_tracker(
  p_search text default null, p_sort text default 'deadline_asc', p_subject text default null,
  p_educator text default null, p_status text default null, p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 8), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select t.* from public.adm_series_tracker_rows() t
     where (v_like is null or (t.series_name || ' ' || coalesce(t.subject, '')) ilike v_like)
       and (p_subject is null or p_subject in ('', 'all') or t.subject = p_subject)
       and (p_educator is null or p_educator in ('', 'all') or p_educator = any (t.educators))
       and (p_status is null or p_status in ('', 'all') or t.overall_status = p_status)
  )
  select to_jsonb(f) || jsonb_build_object('seriesId', f.series_id), count(*) over ()
    from f
   order by case when p_sort = 'deadline_asc'    then f.deadline end asc nulls last,
            case when p_sort = 'completion_desc' then f.completion_pct end desc,
            case when p_sort = 'name_asc'        then f.series_name end asc,
            f.series_name, f.series_id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_series_tracker_detail(p_series uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'series', to_jsonb(t) || jsonb_build_object('seriesId', t.series_id),
      'assignments', (select coalesce(jsonb_agg(to_jsonb(a) order by a.deadline nulls last, a.code), '[]'::jsonb)
                        from public.adm_assignment_rows() a where a.series_id = p_series))
      from public.adm_series_tracker_rows() t where t.series_id = p_series);
end $$;

-- ------------------------------------------------- repeated questions
-- The detection itself, without an admin check, so the daily cron job
-- (20261025120800) can run it. Execute: postgres / service_role only.
create or replace function public.adm_detect_repeated_questions() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_started timestamptz := clock_timestamp();
  n int;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    raise exception 'The pg_trgm extension is required for repeated-question detection.' using errcode = '0A000';
  end if;
  perform set_config('pg_trgm.similarity_threshold', '0.5', true);

  with qs as (
    select qq.id, qq.quiz_id, q.series_id, public.adm_norm_text(qq.question_text) as nt
      from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      left join public.test_series_admin sa on sa.series_id = q.series_id
     where q.series_id is not null and sa.deleted_at is null
  ), pairs as (
    select a.id as aid, b.id as bid, a.quiz_id as qa, b.quiz_id as qb, a.series_id as sera, b.series_id as serb,
           similarity(a.nt, b.nt) as sim
      from qs a join qs b on a.id < b.id and a.nt % b.nt
     where a.nt <> ''
  )
  insert into public.question_similarity_matches
    (pair_key, question_a_id, question_b_id, similarity_percent, match_type, same_series, same_test, detected_at)
  select aid::text || '::' || bid::text, aid, bid, least(round(sim * 100)::int, 100),
         case when sim >= 0.97 then 'exact' when sim >= 0.75 then 'high' else 'possible' end,
         sera = serb, qa = qb, clock_timestamp()
    from pairs
  on conflict (pair_key) do update
    set similarity_percent = excluded.similarity_percent, match_type = excluded.match_type,
        same_series = excluded.same_series, same_test = excluded.same_test, detected_at = clock_timestamp();

  -- unreviewed pairs that no longer match are dropped; review decisions are kept
  delete from public.question_similarity_matches where review_status = 'unreviewed' and detected_at < v_started;
  select count(*) into n from public.question_similarity_matches;
  return n;
end $$;

-- "Run detection" button (admins).
create or replace function public.detect_repeated_questions() returns int
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return public.adm_detect_repeated_questions();
end $$;

-- Rows keep the archived v_repeated_matches keys.
create or replace function public.list_repeated_matches(
  p_type text default null, p_subject text default null, p_series uuid default null, p_review text default null,
  p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_size int := least(greatest(coalesce(p_size, 10), 1), 200);
  v_page int := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with sr as (select r.id, r.title, r.subject_name from public.adm_series_rows() r),
  v as (
    select m.id, m.pair_key, m.match_type, m.similarity_percent, m.same_series, m.same_test,
           m.review_status, m.review_note, m.reviewed_at, m.detected_at,
           qa.id as original_question_id, qa.question_text as original_text,
           coalesce(qaa.admin_type, public.adm_ui_question_type(qa.question_type)) as original_type,
           ta.id as original_test_id, ta.title as original_test_name,
           sa.id as original_series_id, sa.title as original_series_name,
           coalesce(qaa.subject, sa.subject_name) as original_subject,
           qb.id as matching_question_id, qb.question_text as matching_text,
           coalesce(qba.admin_type, public.adm_ui_question_type(qb.question_type)) as matching_type,
           tb.id as matching_test_id, tb.title as matching_test_name,
           sb.id as matching_series_id, sb.title as matching_series_name,
           coalesce(qba.subject, sb.subject_name) as matching_subject
      from public.question_similarity_matches m
      join public.quiz_questions qa on qa.id = m.question_a_id
      left join public.quiz_question_admin qaa on qaa.question_id = qa.id
      join public.quizzes ta on ta.id = qa.quiz_id
      join sr sa on sa.id = ta.series_id
      join public.quiz_questions qb on qb.id = m.question_b_id
      left join public.quiz_question_admin qba on qba.question_id = qb.id
      join public.quizzes tb on tb.id = qb.quiz_id
      join sr sb on sb.id = tb.series_id
  )
  select to_jsonb(v), count(*) over ()
    from v
   where (p_type is null or p_type in ('', 'all') or v.match_type = p_type)
     and (p_subject is null or p_subject in ('', 'all') or v.original_subject = p_subject or v.matching_subject = p_subject)
     and (p_series is null or v.original_series_id = p_series or v.matching_series_id = p_series)
     and (p_review is null or p_review in ('', 'all') or v.review_status = p_review)
   order by v.similarity_percent desc, v.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_match_counts() returns table (total bigint, needs_review bigint, confirmed bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  select count(*), count(*) filter (where m.review_status = 'unreviewed'), count(*) filter (where m.review_status = 'confirmed')
    from public.question_similarity_matches m;
end $$;

create or replace function public.adm_review_match(p_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.question_similarity_matches
     set review_status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  if not found then raise exception 'Match not found.' using errcode = 'P0002'; end if;
end $$;

create or replace function public.mark_match_reviewed(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_review_match(p_id, 'reviewed', null);
end $$;

create or replace function public.dismiss_match(p_id uuid, p_note text default 'Reviewed and judged not a real duplicate.') returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_review_match(p_id, 'dismissed', p_note);
end $$;

create or replace function public.flag_match_confirmed(p_id uuid, p_note text default 'Confirmed duplicate - needs correction.') returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_review_match(p_id, 'confirmed', p_note);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_series_tracker_rows() from public, anon, authenticated;
revoke all on function public.adm_review_match(uuid, text, text) from public, anon, authenticated;

revoke all on function public.get_tracker_stats() from public, anon;
revoke all on function public.list_series_tracker(text, text, text, text, text, int, int) from public, anon;
revoke all on function public.get_series_tracker_detail(uuid) from public, anon;
revoke all on function public.adm_detect_repeated_questions() from public, anon, authenticated;
grant execute on function public.adm_detect_repeated_questions() to postgres, service_role;
revoke all on function public.detect_repeated_questions() from public, anon;
revoke all on function public.list_repeated_matches(text, text, uuid, text, int, int) from public, anon;
revoke all on function public.get_match_counts() from public, anon;
revoke all on function public.mark_match_reviewed(uuid) from public, anon;
revoke all on function public.dismiss_match(uuid, text) from public, anon;
revoke all on function public.flag_match_confirmed(uuid, text) from public, anon;

grant execute on function public.get_tracker_stats() to authenticated;
grant execute on function public.list_series_tracker(text, text, text, text, text, int, int) to authenticated;
grant execute on function public.get_series_tracker_detail(uuid) to authenticated;
grant execute on function public.detect_repeated_questions() to authenticated;
grant execute on function public.list_repeated_matches(text, text, uuid, text, int, int) to authenticated;
grant execute on function public.get_match_counts() to authenticated;
grant execute on function public.mark_match_reviewed(uuid) to authenticated;
grant execute on function public.dismiss_match(uuid, text) to authenticated;
grant execute on function public.flag_match_confirmed(uuid, text) to authenticated;

-- =====================================================================
-- 20261025110900_admin_rpc_performance.sql
--
-- Purpose
--   Test Performance Analytics (performanceApi.js) over the lead's quiz data:
--     get_tpa_filter_options(p_series)
--     get_tpa_summary(...)          -> object {total_attempts, avg_score, published_tests, avg_time_minutes}
--     get_tpa_subject_scores(...)   -> table(subject, avg_score, attempts)
--     get_tpa_series_engagement(...)-> table(series_id, series_title, educators, subject, attempts, avg_performance)
--     get_tpa_test_comparison(...)  -> table(test_id, test_title, series_title, educators, attempts, avg_score, avg_time_minutes)
--     get_tpa_leaderboard(p_series, p_from, p_to, p_limit)
--     export_tpa_rows(...)          -> table(series, subject, educators, test, attempts, avg_score_pct, avg_time_min)
--     log_export(p_page, p_filters, p_rows)  -> audit_logs (action 'export')
--   Shared filter params: p_series uuid, p_subject text, p_test uuid,
--   p_educator text (an educator id OR name: the page sends names), p_from, p_to.
--
-- Lead objects read
--   quizzes, quiz_attempts, test_series, profiles, courses (through adm_* helpers).
--
-- Assumptions
--   * An attempt counts when quiz_attempts.status is 'submitted' or 'timed_out'
--     and percentage is not null (F5 statuses; archived counted 'submitted').
--   * Minutes = time_taken_secs / 60, else submitted_at - started_at.
--   * "Published test" = quiz of a published series whose admin status is
--     published (or that has no admin row).
--   * get_tpa_summary returns an object (archived returned a table the page
--     could not read). p_educator changed from uuid to text; callers still send
--     a string, so no client change is needed.
--
-- ROLLBACK
--   drop function if exists public.log_export(text, jsonb, int),
--     public.export_tpa_rows(uuid, text, uuid, text, date, date),
--     public.get_tpa_leaderboard(uuid, date, date, int),
--     public.get_tpa_test_comparison(uuid, text, uuid, text, date, date),
--     public.get_tpa_series_engagement(uuid, text, uuid, text, date, date),
--     public.get_tpa_subject_scores(uuid, text, uuid, text, date, date),
--     public.get_tpa_summary(uuid, text, uuid, text, date, date),
--     public.get_tpa_filter_options(uuid),
--     public.adm_tpa_attempts(uuid, text, uuid, text, date, date),
--     public.adm_tpa_tests(uuid, text, uuid, text);
-- =====================================================================
set search_path = public, extensions;

create or replace function public.adm_tpa_tests(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null
) returns table (test_id uuid, test_title text, test_position int, series_id uuid, series_title text, subject text,
                 educator_ids uuid[], educator_names text)
language sql stable security definer set search_path = public, extensions as $$
  with e as (
    select se.series_id, array_agg(distinct se.educator_id) as ids,
           string_agg(distinct se.educator_name, ', ') as names
      from public.adm_series_educators() se group by se.series_id
  )
  select q.id, q.title, q.series_sort_order, r.id, r.title, r.subject_name,
         coalesce(e.ids, '{}'::uuid[]), coalesce(e.names, 'Unassigned')
    from public.quizzes q
    join public.adm_series_rows() r on r.id = q.series_id
    left join public.quiz_admin qa on qa.quiz_id = q.id
    left join e on e.series_id = r.id
   where r.status = 'published' and coalesce(qa.status, 'published') = 'published'
     and (p_series is null or r.id = p_series)
     and (p_subject is null or p_subject in ('', 'all') or r.subject_name = p_subject)
     and (p_test is null or q.id = p_test)
     and (p_educator is null or p_educator in ('', 'all')
          or exists (select 1 from public.adm_series_educators() se
                      where se.series_id = r.id and (se.educator_id::text = p_educator or se.educator_name = p_educator)));
$$;

create or replace function public.adm_tpa_attempts(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns table (attempt_id uuid, series_id uuid, test_id uuid, student_id uuid, percentage numeric,
                 minutes numeric, submitted_at timestamptz, subject text)
language sql stable security definer set search_path = public, extensions as $$
  select a.id, t.series_id, t.test_id, a.student_id, a.percentage,
         coalesce(a.time_taken_secs / 60.0, (extract(epoch from (a.submitted_at - a.started_at)) / 60.0)::numeric),
         a.submitted_at, t.subject
    from public.quiz_attempts a
    join public.adm_tpa_tests(p_series, p_subject, p_test, p_educator) t on t.test_id = a.quiz_id
   where a.status in ('submitted', 'timed_out') and a.percentage is not null
     and (p_from is null or (a.submitted_at at time zone 'Asia/Kolkata')::date >= p_from)
     and (p_to   is null or (a.submitted_at at time zone 'Asia/Kolkata')::date <= p_to);
$$;

-- {series:[{id,title}], subjects:[], tests:[{id,title,series_id}], educators:[{id,name}]}
create or replace function public.get_tpa_filter_options(p_series uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with t as (select * from public.adm_tpa_tests())
    select jsonb_build_object(
      'series',    (select coalesce(jsonb_agg(jsonb_build_object('id', x.series_id, 'title', x.series_title) order by x.series_title), '[]'::jsonb)
                      from (select distinct t.series_id, t.series_title from t) x),
      'subjects',  (select coalesce(jsonb_agg(x.subject order by x.subject), '[]'::jsonb)
                      from (select distinct t.subject from t where t.subject is not null) x),
      'tests',     (select coalesce(jsonb_agg(jsonb_build_object('id', t.test_id, 'title', t.test_title, 'series_id', t.series_id)
                                              order by t.series_title, t.test_position), '[]'::jsonb)
                      from t where p_series is null or t.series_id = p_series),
      'educators', (select coalesce(jsonb_agg(jsonb_build_object('id', x.educator_id, 'name', x.educator_name) order by x.educator_name), '[]'::jsonb)
                      from (select distinct se.educator_id, se.educator_name
                              from public.adm_series_educators() se
                             where se.series_id in (select t.series_id from t)) x)));
end $$;

create or replace function public.get_tpa_summary(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with a as (select * from public.adm_tpa_attempts(p_series, p_subject, p_test, p_educator, p_from, p_to))
    select jsonb_build_object(
      'total_attempts',   (select count(*) from a),
      'avg_score',        (select coalesce(round(avg(a.percentage)), 0) from a),
      'published_tests',  (select count(*) from public.adm_tpa_tests(p_series, p_subject, p_test, p_educator)),
      'avg_time_minutes', (select coalesce(round(avg(a.minutes)), 0) from a)));
end $$;

create or replace function public.get_tpa_subject_scores(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns table (subject text, avg_score numeric, attempts bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  select a.subject, round(avg(a.percentage)), count(*)
    from public.adm_tpa_attempts(p_series, p_subject, p_test, p_educator, p_from, p_to) a
   where a.subject is not null
   group by a.subject
   order by 2 desc;
end $$;

create or replace function public.get_tpa_series_engagement(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns table (series_id uuid, series_title text, educators text, subject text, attempts bigint, avg_performance numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  select s.series_id, s.series_title, s.educator_names, s.subject,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0)
    from (select distinct t.series_id, t.series_title, t.subject, t.educator_names
            from public.adm_tpa_tests(p_series, p_subject, p_test, p_educator) t) s
    left join public.adm_tpa_attempts(p_series, p_subject, p_test, p_educator, p_from, p_to) a on a.series_id = s.series_id
   group by s.series_id, s.series_title, s.educator_names, s.subject
   order by s.series_title;
end $$;

create or replace function public.get_tpa_test_comparison(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns table (test_id uuid, test_title text, series_title text, educators text, attempts bigint,
                 avg_score numeric, avg_time_minutes numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  select t.test_id, t.test_title, t.series_title, t.educator_names,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0), coalesce(round(avg(a.minutes)), 0)
    from public.adm_tpa_tests(p_series, p_subject, p_test, p_educator) t
    left join public.adm_tpa_attempts(p_series, p_subject, p_test, p_educator, p_from, p_to) a on a.test_id = t.test_id
   group by t.test_id, t.test_title, t.series_title, t.educator_names, t.test_position
   order by t.series_title, t.test_position;
end $$;

-- p_series null = all series: each learner's attempt-weighted average.
-- Ties share a rank; percentile = share of learners scoring strictly below.
create or replace function public.get_tpa_leaderboard(
  p_series uuid default null, p_from date default null, p_to date default null, p_limit int default 10
) returns table (rank_no bigint, student_id uuid, learner text, score numeric, percentile numeric,
                 attempts bigint, total_learners bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  with l as (
    select a.student_id as sid, avg(a.percentage) as sc, count(*) as n
      from public.adm_tpa_attempts(p_series, null, null, null, p_from, p_to) a
     group by a.student_id
  ), r as (
    select l.*, count(*) over () as total, rank() over (order by l.sc desc) as rk,
           count(*) over (partition by l.sc) as ties
      from l
  )
  select r.rk, r.sid, p.full_name, round(r.sc, 1),
         round(((r.total - (r.rk + r.ties - 1))::numeric / r.total) * 100, 1),
         r.n, r.total
    from r join public.profiles p on p.id = r.sid
   order by r.rk, p.full_name
   limit least(greatest(coalesce(p_limit, 10), 1), 100);
end $$;

create or replace function public.export_tpa_rows(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator text default null,
  p_from date default null, p_to date default null
) returns table (series text, subject text, educators text, test text, attempts bigint, avg_score_pct numeric, avg_time_min numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return query
  select t.series_title, t.subject, t.educator_names, t.test_title,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0), coalesce(round(avg(a.minutes)), 0)
    from public.adm_tpa_tests(p_series, p_subject, p_test, p_educator) t
    left join public.adm_tpa_attempts(p_series, p_subject, p_test, p_educator, p_from, p_to) a on a.test_id = t.test_id
   group by t.series_title, t.subject, t.educator_names, t.test_title, t.test_position
   order by t.series_title, t.test_position;
end $$;

-- Export trail goes to the lead's audit_logs (D9; replaces the archived export_log table).
create or replace function public.log_export(p_page text, p_filters jsonb, p_rows int) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_audit('export', left(coalesce(nullif(btrim(p_page), ''), 'unknown'), 100), null, null,
                           jsonb_build_object('filters', p_filters, 'row_count', p_rows), null);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_tpa_tests(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.adm_tpa_attempts(uuid, text, uuid, text, date, date) from public, anon, authenticated;

revoke all on function public.get_tpa_filter_options(uuid) from public, anon;
revoke all on function public.get_tpa_summary(uuid, text, uuid, text, date, date) from public, anon;
revoke all on function public.get_tpa_subject_scores(uuid, text, uuid, text, date, date) from public, anon;
revoke all on function public.get_tpa_series_engagement(uuid, text, uuid, text, date, date) from public, anon;
revoke all on function public.get_tpa_test_comparison(uuid, text, uuid, text, date, date) from public, anon;
revoke all on function public.get_tpa_leaderboard(uuid, date, date, int) from public, anon;
revoke all on function public.export_tpa_rows(uuid, text, uuid, text, date, date) from public, anon;
revoke all on function public.log_export(text, jsonb, int) from public, anon;

grant execute on function public.get_tpa_filter_options(uuid) to authenticated;
grant execute on function public.get_tpa_summary(uuid, text, uuid, text, date, date) to authenticated;
grant execute on function public.get_tpa_subject_scores(uuid, text, uuid, text, date, date) to authenticated;
grant execute on function public.get_tpa_series_engagement(uuid, text, uuid, text, date, date) to authenticated;
grant execute on function public.get_tpa_test_comparison(uuid, text, uuid, text, date, date) to authenticated;
grant execute on function public.get_tpa_leaderboard(uuid, date, date, int) to authenticated;
grant execute on function public.export_tpa_rows(uuid, text, uuid, text, date, date) to authenticated;
grant execute on function public.log_export(text, jsonb, int) to authenticated;

-- =====================================================================
-- 20261025120000_admin_b3_preflight.sql
--
-- Purpose
--   Read-only assertions for Batch 3 (commerce stubs, reports, notification
--   campaigns, callbacks, support tickets, maintenance, cron). Aborts if
--   Batches 1-2 are missing, if a lead column or CHECK these RPCs rely on
--   differs, or if pg_cron is not enabled. Then collects EVERY clash in one
--   pass (each overload of a taken function name with its signature, and
--   taken table names) and raises one error listing all of them.
--
-- Lead objects read
--   information_schema.columns, pg_constraint / pg_class / pg_namespace,
--   pg_proc, pg_extension.
--
-- Assumptions
--   * Function clashes are found by name in pg_proc joined to pg_namespace
--     (not to_regproc), so any overload is reported.
--   * The function list below names every function created by
--     20261025120100..20261025120800 (checked offline; see docs/PORT_PROGRESS.md).
--
-- ROLLBACK
--   Nothing to roll back: no DDL, no data changes.
-- =====================================================================
set search_path = public, extensions;

-- 1. Prerequisites: earlier batches, lead columns, CHECKs, pg_cron
do $$
declare
  v_missing text[] := '{}';
  v_def     text;
  r record;
begin
  select coalesce(array_agg(x.name order by x.name), '{}') into v_missing
    from unnest(array['adm_is_platform_admin', 'adm_resolve_date_range', 'adm_series_rows', 'adm_series_students',
                      'adm_series_educators', 'adm_educator_base', 'adm_publish_test_series', 'release_scheduled_series',
                      'adm_detect_repeated_questions', 'log_export']) as x(name)
   where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = x.name);
  if cardinality(v_missing) > 0 then
    raise exception 'Admin port Batch 3 preflight: Batches 1-2 are not applied (missing: %).', array_to_string(v_missing, ', ')
      using errcode = 'P0001';
  end if;
  if to_regclass('public.report_types') is null or to_regclass('public.admin_series_enrollments') is null then
    raise exception 'Admin port Batch 3 preflight: report_types / admin_series_enrollments are missing (Batches 1-2).'
      using errcode = 'P0001';
  end if;

  for r in
    select * from (values
      ('notifications','id'), ('notifications','user_id'), ('notifications','category'), ('notifications','title'),
      ('notifications','body'), ('notifications','action_url'), ('notifications','is_read'), ('notifications','read_at'),
      ('notifications','reference_type'), ('notifications','reference_id'), ('notifications','created_at'),
      ('notification_preferences','user_id'), ('notification_preferences','category'),
      ('notification_preferences','in_app'), ('notification_preferences','email'),
      ('support_tickets','id'), ('support_tickets','submitted_by'), ('support_tickets','assigned_to'),
      ('support_tickets','category'), ('support_tickets','subject'), ('support_tickets','description'),
      ('support_tickets','priority'), ('support_tickets','status'), ('support_tickets','reference_type'),
      ('support_tickets','reference_id'), ('support_tickets','resolved_at'), ('support_tickets','created_at'),
      ('support_tickets','updated_at'),
      ('support_ticket_replies','id'), ('support_ticket_replies','ticket_id'), ('support_ticket_replies','author_id'),
      ('support_ticket_replies','content'), ('support_ticket_replies','is_internal'),
      ('support_ticket_replies','attachment_url'), ('support_ticket_replies','created_at'),
      ('callback_requests','id'), ('callback_requests','name'), ('callback_requests','email'), ('callback_requests','phone'),
      ('callback_requests','message'), ('callback_requests','source'), ('callback_requests','status'),
      ('callback_requests','created_at'), ('callback_requests','code'), ('callback_requests','organization'),
      ('callback_requests','assigned_to'), ('callback_requests','contacted_at'), ('callback_requests','contacted_by'),
      ('callback_requests','closed_at'), ('callback_requests','closed_by'), ('callback_requests','submitted_from'),
      ('callback_requests','updated_at'),
      ('enrollments','id'), ('enrollments','student_id'), ('enrollments','course_id'), ('enrollments','enrolled_at'),
      ('enrollments','is_active'),
      ('student_profiles','user_id'), ('student_profiles','grade'),
      ('categories','id'), ('categories','name'), ('categories','is_active'),
      ('profiles','id'), ('profiles','role'), ('profiles','full_name'), ('profiles','email'), ('profiles','created_at')
    ) as t(tbl, col)
  loop
    if not exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = r.tbl and c.column_name = r.col) then
      v_missing := v_missing || (r.tbl || '.' || r.col);
    end if;
  end loop;
  if cardinality(v_missing) > 0 then
    raise exception 'Admin port Batch 3 preflight: expected lead columns are missing: %', array_to_string(v_missing, ', ')
      using errcode = 'P0001';
  end if;

  -- support_tickets category / priority CHECKs (status and notifications.category
  -- are re-checked in the Batch 1 preflight)
  for r in
    select * from (values
      ('support_tickets', 'support_tickets_priority_check',
       'CHECK ((priority = ANY (ARRAY[''low''::text, ''medium''::text, ''high''::text, ''urgent''::text])))'),
      ('support_tickets', 'support_tickets_category_check',
       'CHECK ((category = ANY (ARRAY[''technical''::text, ''billing''::text, ''course_content''::text, ''verification''::text, ''account''::text, ''booking''::text, ''refund''::text, ''other''::text])))')
    ) as t(tbl, conname, expected)
  loop
    select pg_get_constraintdef(c.oid) into v_def
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = r.tbl and c.conname = r.conname;
    if v_def is distinct from r.expected then
      v_missing := v_missing || (r.conname || ' = ' || coalesce(v_def, '<missing>'));
    end if;
  end loop;
  if cardinality(v_missing) > 0 then
    raise exception 'Admin port Batch 3 preflight: CHECK constraints differ: %', array_to_string(v_missing, ' | ')
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'Admin port Batch 3 preflight: pg_cron is not enabled; the cron file (20261025120800) needs it. Enable it with the lead''s approval, then re-run.'
      using errcode = 'P0001';
  end if;
end $$;

-- 2. Every clash, collected and reported in one error
do $$
declare
  v_taken text[] := '{}';
  v_add   text[];
begin
  select coalesce(array_agg('relation ' || x.name order by x.name), '{}') into v_add
    from unnest(array['report_runs', 'notification_campaigns', 'notification_recipients',
                      'notification_campaign_events', 'callback_activity']) as x(name)
   where to_regclass('public.' || x.name) is not null;
  v_taken := v_taken || v_add;

  select coalesce(array_agg('function ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
                            order by p.proname, pg_get_function_identity_arguments(p.oid)), '{}') into v_add
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any (array[
       -- commerce stubs (D1)
       'adm_payments_stub', 'adm_range_options',
       'list_discounts', 'get_discount_stats', 'get_discount', 'get_discount_analytics', 'create_discount',
       'update_discount', 'set_discount_status', 'list_discount_history', 'export_discount_redemptions',
       'list_transactions', 'get_transaction_stats', 'get_transaction_filter_options', 'get_transaction',
       'export_transactions', 'mark_payment_paid', 'mark_payment_refunded',
       'list_pending_refunds', 'list_refund_history', 'get_refund_stats', 'export_refunds', 'request_refund',
       'approve_refund', 'reject_refund',
       'get_financial_range_options', 'get_financial_summary', 'get_revenue_trend', 'get_financial_analytics',
       'get_regional_summary', 'get_regional_trend', 'get_revenue_by_region', 'list_region_comparison',
       'get_regional_filter_options',
       -- reports
       'adm_report_enrollment', 'adm_report_test_series', 'adm_report_educators', 'adm_report_students',
       'get_report_builder_options', 'get_report_filter_options', 'generate_report', 'get_report_run',
       'export_report_csv', 'purge_expired_report_results',
       -- notification campaigns (D10)
       'adm_campaign_category', 'adm_resolve_audience', 'adm_validate_campaign', 'adm_campaign_row',
       'adm_publish_campaign', 'list_notifications', 'get_notification_stats', 'get_notification_filter_options',
       'get_notification', 'preview_notification', 'estimate_audience', 'create_notification',
       'publish_notification', 'archive_notification', 'delete_draft_notification', 'mark_notification_read',
       'mark_all_notifications_read', 'get_my_unread_notification_count', 'dispatch_due_notifications',
       'record_email_results',
       -- callbacks
       'adm_callback_source_key', 'adm_callback_assign_code', 'adm_callback_rows', 'get_callback_stats',
       'list_callback_requests', 'get_callback_filter_options', 'get_callback_request', 'export_callback_report',
       'set_callback_status', 'add_callback_note', 'submit_callback_request',
       -- support tickets (D11)
       'adm_ticket_rows', 'get_support_ticket_stats', 'list_support_tickets', 'get_support_ticket',
       'set_support_ticket_status', 'set_support_ticket_priority', 'assign_support_ticket', 'reply_support_ticket',
       -- maintenance
       'purge_old_admin_auth_events'
     ]);
  v_taken := v_taken || v_add;

  if cardinality(v_taken) > 0 then
    raise exception 'Admin port Batch 3 preflight: % name(s) already exist: %',
      cardinality(v_taken), array_to_string(v_taken, '; ')
      using errcode = 'P0001';
  end if;
end $$;

-- =====================================================================
-- 20261025120100_admin_b3_tables.sql
--
-- Purpose
--   Tables owned by the admin port for Batch 3:
--     report_runs                   Reports Builder snapshots (preview + CSV)
--     notification_campaigns        admin campaign (archived "notifications", D10)
--     notification_recipients       per-recipient delivery / email state
--     notification_campaign_events  campaign audit trail
--     callback_activity             callback timeline (status changes, notes)
--   No money tables (F4, D1).
--
-- Lead objects referenced (FK targets only; nothing on them is altered)
--   profiles, callback_requests, notifications (the lead's inbox row id is
--   stored in notification_recipients.inbox_notification_id without an FK).
--
-- Assumptions
--   * The in-app inbox is the lead's notifications table (fan-out in
--     20261025120400). notification_recipients keeps only delivery state;
--     "opened" is the lead's notifications.is_read.
--   * All access is through SECURITY DEFINER RPCs: RLS on, no policies, no
--     table grants for anon / authenticated. The send-notification-emails
--     Edge Function uses the service role (Batch 4 updates its embed from
--     notifications(...) to notification_campaigns(...) and notification_id
--     to campaign_id).
--   * Enum types of the archive are text + CHECK here.
--
-- ROLLBACK
--   drop table if exists public.callback_activity, public.notification_campaign_events,
--     public.notification_recipients, public.notification_campaigns, public.report_runs;
--   delete from public.notifications where reference_type = 'notification_campaign';   -- fanned-out inbox rows
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- report_runs
create table if not exists public.report_runs (
  id               uuid primary key default gen_random_uuid(),
  report_type      text not null references public.report_types(key),
  range_key        text not null,
  date_from        date not null,
  date_to          date not null,
  filters          jsonb not null default '{}'::jsonb,
  status           text not null default 'running' check (status in ('running', 'completed', 'failed')),
  row_count        int,
  result_rows      jsonb,                    -- snapshot: preview and CSV always match
  error            text,
  requested_by     uuid references public.profiles(id) on delete set null,
  requested_at     timestamptz not null default now(),
  generated_at     timestamptz,
  csv_downloads    int not null default 0,
  last_exported_at timestamptz,
  expires_at       timestamptz not null default (now() + interval '7 days')   -- snapshot cleared after this
);
create index if not exists report_runs_user_idx on public.report_runs (requested_by, requested_at desc);
create index if not exists report_runs_exp_idx  on public.report_runs (expires_at) where result_rows is not null;

-- ------------------------------------------------------ notification_campaigns
create table if not exists public.notification_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(btrim(title)) between 3 and 120),
  body                text not null check (char_length(btrim(body)) between 1 and 2000),
  category            text not null default 'announcement' check (category in ('system', 'policy', 'alert', 'announcement')),
  audience_type       text not null default 'all_users'
                      check (audience_type in ('all_users', 'learners', 'educators', 'admins', 'series_enrolled', 'selected_users')),
  audience_series_ids uuid[] not null default '{}',
  audience_user_ids   uuid[] not null default '{}',
  channels            text[] not null default '{in_app}',
  action_url          text,
  status              text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  scheduled_for       timestamptz,
  published_at        timestamptz,
  edited_at           timestamptz,
  archived_at         timestamptz,
  recipients_total    int not null default 0,
  delivered_count     int not null default 0,
  created_by          uuid references public.profiles(id) on delete set null,
  updated_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint notification_campaigns_channels_ok check (cardinality(channels) >= 1 and channels <@ array['in_app', 'email']),
  constraint notification_campaigns_sched_ok    check (status <> 'scheduled' or scheduled_for is not null),
  constraint notification_campaigns_series_ok   check (audience_type <> 'series_enrolled' or cardinality(audience_series_ids) > 0),
  constraint notification_campaigns_users_ok    check (audience_type <> 'selected_users' or cardinality(audience_user_ids) > 0)
);
create index if not exists notification_campaigns_status_idx on public.notification_campaigns (status, created_at desc);
create index if not exists notification_campaigns_due_idx    on public.notification_campaigns (scheduled_for) where status = 'scheduled';

create table if not exists public.notification_recipients (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid not null references public.notification_campaigns(id) on delete cascade,
  user_id               uuid not null references public.profiles(id) on delete cascade,
  inbox_notification_id uuid,                -- the lead's notifications.id (in_app channel)
  email_status          text not null default 'not_requested' check (email_status in ('not_requested', 'queued', 'sent', 'failed')),
  email_sent_at         timestamptz,
  email_error           text,
  delivery_status       text not null default 'queued' check (delivery_status in ('queued', 'delivered', 'failed')),
  delivered_at          timestamptz,
  created_at            timestamptz not null default now(),
  unique (campaign_id, user_id)
);
create index if not exists notification_recipients_email_idx on public.notification_recipients (campaign_id) where email_status = 'queued';

create table if not exists public.notification_campaign_events (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.notification_campaigns(id) on delete cascade,
  event_type   text not null check (event_type in ('created', 'edited', 'scheduled', 'published', 'archived', 'dispatch_failed')),
  actor_id     uuid references public.profiles(id) on delete set null,
  detail       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists notification_campaign_events_idx on public.notification_campaign_events (campaign_id, created_at);

-- ---------------------------------------------------------- callback_activity
create table if not exists public.callback_activity (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.callback_requests(id) on delete cascade,
  type         text not null check (type in ('created', 'status_changed', 'note', 'assigned', 'repeat_submission')),
  from_status  text check (from_status in ('new', 'contacted', 'closed')),
  to_status    text check (to_status in ('new', 'contacted', 'closed')),
  note         text,
  actor_id     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists callback_activity_idx on public.callback_activity (request_id, created_at);

-- ------------------------------------------------ foreign-key indexes
-- Every column that references a lead table is indexed (FK audit).
create index if not exists notification_campaigns_created_by_idx on public.notification_campaigns (created_by) where created_by is not null;
create index if not exists notification_campaigns_updated_by_idx on public.notification_campaigns (updated_by) where updated_by is not null;
create index if not exists notification_recipients_user_idx      on public.notification_recipients (user_id);
create index if not exists notification_campaign_events_actor_idx on public.notification_campaign_events (actor_id) where actor_id is not null;
create index if not exists callback_activity_actor_idx           on public.callback_activity (actor_id) where actor_id is not null;

-- ------------------------------------------------------------------ triggers
-- (own tables only)
drop trigger if exists trg_notification_campaigns_touch on public.notification_campaigns;
create trigger trg_notification_campaigns_touch before update on public.notification_campaigns
  for each row execute function public.adm_touch_updated_at();

-- ----------------------------------------------------------------------- RLS
alter table public.report_runs                  enable row level security;
alter table public.notification_campaigns       enable row level security;
alter table public.notification_recipients      enable row level security;
alter table public.notification_campaign_events enable row level security;
alter table public.callback_activity            enable row level security;
revoke all on table public.report_runs, public.notification_campaigns, public.notification_recipients,
  public.notification_campaign_events, public.callback_activity from anon, authenticated;

-- =====================================================================
-- 20261025120200_admin_rpc_commerce_stubs.sql
--
-- Purpose
--   D1 stubs for every commerce RPC the admin frontend calls
--   (discountsApi.js, transactionsApi.js, refundsApi.js, financialApi.js,
--   regionalApi.js). The lead's database has no payments, discounts, refunds
--   or payouts tables (F4), so:
--     * reads return exactly the archived JSON keys / table columns with zeros,
--       nulls and empty arrays;
--     * writes raise SQLSTATE 0A000 ("feature not supported") with a clear
--       message, because nothing can be created without a payments model.
--   Every stub carries the comment "STUB: needs payments model (F4)".
--   Parameter names match the services; archived enum parameters are text.
--
-- Lead objects read
--   None. The only query is the admin check (adm_require_admin reads
--   profiles for the caller). Date ranges come from adm_resolve_date_range
--   (pure date arithmetic).
--
-- Assumptions
--   * The dashboard revenue card (get_dashboard_revenue) and the sidebar
--     refunds badge (get_admin_nav) were stubbed in Batch 1
--     (20261025100600) and are marked there too.
--   * The process-refund / payment-webhook Edge Functions stay placeholders
--     (Batch 4); approve/reject here raise before any gateway call.
--   * When the payments model exists, each stub is replaced by a real
--     implementation with the same signature (create or replace of our own
--     function, after a fresh preflight).
--
-- ROLLBACK
--   drop function if exists
--     public.get_regional_filter_options(), public.list_region_comparison(text, date, date, text, text, int, int),
--     public.get_revenue_by_region(text, date, date, int), public.get_regional_trend(text, date, date, text),
--     public.get_regional_summary(text, date, date),
--     public.get_financial_analytics(text, date, date), public.get_revenue_trend(text, date, date, text),
--     public.get_financial_summary(text, date, date), public.get_financial_range_options(),
--     public.reject_refund(uuid, text), public.approve_refund(uuid, text),
--     public.request_refund(uuid, text, text, numeric), public.export_refunds(text, date, date),
--     public.get_refund_stats(), public.list_refund_history(text, date, date, int, int),
--     public.list_pending_refunds(int, int),
--     public.mark_payment_refunded(uuid, numeric, text), public.mark_payment_paid(uuid, text, text, timestamptz, numeric),
--     public.export_transactions(text, date, date, uuid, uuid, numeric, numeric, text, text),
--     public.get_transaction(uuid), public.get_transaction_filter_options(),
--     public.get_transaction_stats(text, date, date, uuid, uuid, numeric, numeric, text),
--     public.list_transactions(text, date, date, uuid, uuid, numeric, numeric, text, text, int, int),
--     public.export_discount_redemptions(date, date),
--     public.list_discount_history(text, text, uuid, date, date, int, int),
--     public.set_discount_status(uuid, text, text), public.update_discount(uuid, jsonb),
--     public.create_discount(text, text, text, numeric, numeric, numeric, int, int, timestamptz, timestamptz, text, uuid[], text, boolean),
--     public.get_discount_analytics(date, date), public.get_discount(uuid), public.get_discount_stats(),
--     public.list_discounts(text, text, text, numeric, numeric, text, int, int),
--     public.adm_range_options(), public.adm_payments_stub(text);
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- helpers
-- STUB: needs payments model (F4). Raised by every commerce write.
create or replace function public.adm_payments_stub(p_what text) returns void
language plpgsql set search_path = public, extensions as $$
begin
  raise exception '% is not available yet: the platform has no payments model (F4).', p_what
    using errcode = '0A000';
end $$;

-- Options for the "Date range" dropdowns (financial, regional, reports).
create or replace function public.adm_range_options() returns jsonb
language sql immutable set search_path = public, extensions as $$
  select jsonb_build_array(
    jsonb_build_object('key', 'last_7_days',  'label', 'Last 7 days'),
    jsonb_build_object('key', 'last_30_days', 'label', 'Last 30 days'),
    jsonb_build_object('key', 'last_90_days', 'label', 'Last 90 days'),
    jsonb_build_object('key', 'this_month',   'label', 'This month'),
    jsonb_build_object('key', 'last_month',   'label', 'Last month'),
    jsonb_build_object('key', 'this_year',    'label', 'This year'),
    jsonb_build_object('key', 'all_time',     'label', 'All time'),
    jsonb_build_object('key', 'custom',       'label', 'Custom range'));
$$;

-- ============================================================== discounts
-- STUB: needs payments model (F4)
create or replace function public.list_discounts(
  p_search text default null, p_status text default null, p_offer_type text default null,
  p_value_min numeric default null, p_value_max numeric default null, p_sort text default 'created_desc',
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.get_discount_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object('total', 0, 'active', 0, 'scheduled', 0, 'expired', 0, 'inactive', 0, 'archived', 0,
                            'total_redemptions', 0, 'total_discount_given_inr', 0);
end $$;

-- STUB: needs payments model (F4)
create or replace function public.get_discount(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return null;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.get_discount_analytics(
  p_from date default (current_date - 29), p_to date default current_date
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'kpis', jsonb_build_object('redemptions', 0, 'discount_given_inr', 0, 'revenue_after_discount_inr', 0,
                               'avg_discount_inr', 0, 'unique_students', 0),
    'active_discounts', 0,
    'daily', '[]'::jsonb, 'top_discounts', '[]'::jsonb, 'by_series', '[]'::jsonb, 'by_offer_type', '[]'::jsonb);
end $$;

-- STUB: needs payments model (F4)
create or replace function public.create_discount(
  p_name text, p_coupon_code text, p_offer_type text, p_value numeric,
  p_max_discount_inr numeric default null, p_min_purchase_inr numeric default 0,
  p_usage_limit int default null, p_per_user_limit int default 1,
  p_starts_at timestamptz default null, p_expires_at timestamptz default null,
  p_scope text default 'all_test_series', p_series_ids uuid[] default '{}',
  p_description text default null, p_activate boolean default true
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_payments_stub('Creating discounts');
  return null;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.update_discount(p_id uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_payments_stub('Editing discounts');
end $$;

-- STUB: needs payments model (F4)
create or replace function public.set_discount_status(p_id uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_payments_stub('Changing discount status');
end $$;

-- STUB: needs payments model (F4)
create or replace function public.list_discount_history(
  p_search text default null, p_event_type text default null, p_discount_id uuid default null,
  p_from date default null, p_to date default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.export_discount_redemptions(p_from date default null, p_to date default null)
returns table (code text, name text, coupon_code text, student text, series text,
               order_amount_inr numeric, discount_amount_inr numeric, final_amount_inr numeric,
               status text, redeemed_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return;
end $$;

-- =========================================================== transactions
-- STUB: needs payments model (F4)
create or replace function public.list_transactions(
  p_search text default null, p_from date default null, p_to date default null,
  p_educator_id uuid default null, p_series_id uuid default null,
  p_min_amount numeric default null, p_max_amount numeric default null, p_method text default null,
  p_sort text default 'newest', p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.get_transaction_stats(
  p_search text default null, p_from date default null, p_to date default null,
  p_educator_id uuid default null, p_series_id uuid default null,
  p_min_amount numeric default null, p_max_amount numeric default null, p_method text default null
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object('total_revenue_inr', 0, 'total_transactions', 0, 'avg_value_inr', 0);
end $$;

-- STUB: needs payments model (F4)
create or replace function public.get_transaction_filter_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object('educators', '[]'::jsonb, 'series', '[]'::jsonb, 'methods', '[]'::jsonb,
                            'min_amount_inr', null, 'max_amount_inr', null, 'first_date', null, 'last_date', null);
end $$;

-- STUB: needs payments model (F4)
create or replace function public.get_transaction(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return null;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.export_transactions(
  p_search text default null, p_from date default null, p_to date default null,
  p_educator_id uuid default null, p_series_id uuid default null,
  p_min_amount numeric default null, p_max_amount numeric default null,
  p_method text default null, p_sort text default 'newest'
) returns table (transaction_id text, paid_at timestamptz, student text, student_email text,
                 test_series text, educator text, list_price_inr numeric, discount_inr numeric,
                 coupon text, amount_inr numeric, method text, gateway_payment_id text)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.mark_payment_paid(
  p_payment_id uuid, p_gateway_payment_id text, p_method text default 'other',
  p_paid_at timestamptz default now(), p_platform_fee_inr numeric default 0
) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_payments_stub('Marking a payment as paid');
  return null;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.mark_payment_refunded(p_payment_id uuid, p_amount numeric default null, p_reason text default null)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_payments_stub('Marking a payment as refunded');
end $$;

-- ================================================================ refunds
-- STUB: needs payments model (F4)
create or replace function public.list_pending_refunds(p_page int default 1, p_size int default 20)
returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.list_refund_history(
  p_status text default null, p_from date default null, p_to date default null,
  p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.get_refund_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object('pending_count', 0, 'pending_amount_inr', 0, 'approved_count', 0,
                            'approved_amount_inr', 0, 'rejected_count', 0, 'gateway_failed', 0);
end $$;

-- STUB: needs payments model (F4)
create or replace function public.export_refunds(p_status text default null, p_from date default null, p_to date default null)
returns table (refund_id text, transaction_id text, student text, item_type text, item text, educator text,
               amount_inr numeric, reason text, requested_by text, requested_at timestamptz,
               status text, decided_by text, decided_at timestamptz, note text, gateway_status text)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.request_refund(
  p_payment_id uuid, p_reason_code text default 'other', p_reason_text text default null, p_amount numeric default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_payments_stub('Requesting a refund');
  return null;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.approve_refund(p_id uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_payments_stub('Approving a refund');
  return null;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.reject_refund(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_payments_stub('Rejecting a refund');
end $$;

-- ============================================================== financial
-- Static list; not money data, but part of financialApi.js.
create or replace function public.get_financial_range_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return public.adm_range_options();
end $$;

-- STUB: needs payments model (F4)
create or replace function public.get_financial_summary(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_from date; v_to date;
begin
  perform public.adm_require_admin();
  select d_from, d_to into v_from, v_to from public.adm_resolve_date_range(p_range, p_from, p_to);
  return jsonb_build_object(
    'range', jsonb_build_object('key', p_range, 'from', v_from, 'to', v_to),
    'gross_revenue_inr', 0, 'transactions', 0, 'refunds_inr', 0, 'payouts_paid_inr', 0,
    'net_revenue_inr', 0, 'platform_fees_inr', 0, 'pending_payouts_inr', 0,
    'payment_performance', jsonb_build_object('attempts', 0, 'successful', 0, 'failed', 0, 'success_rate_pct', null));
end $$;

-- STUB: needs payments model (F4). Zero-valued buckets so the chart renders.
create or replace function public.get_revenue_trend(
  p_range text default 'last_30_days', p_from date default null, p_to date default null,
  p_granularity text default 'auto'
) returns table (bucket date, revenue_inr numeric, refunds_inr numeric,
                 payouts_inr numeric, net_inr numeric, transactions int)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_from date; v_to date; g text;
begin
  perform public.adm_require_admin();
  select d_from, d_to into v_from, v_to from public.adm_resolve_date_range(p_range, p_from, p_to);
  g := case when p_granularity in ('day', 'week', 'month') then p_granularity
            when (v_to - v_from) < 92  then 'day'
            when (v_to - v_from) < 400 then 'week'
            else 'month' end;
  return query
  select gs::date, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0
    from generate_series(date_trunc(g, v_from::timestamp), v_to::timestamp, ('1 ' || g)::interval) gs
   order by 1;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.get_financial_analytics(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return public.get_financial_summary(p_range, p_from, p_to)
         || jsonb_build_object('trend', coalesce((select jsonb_agg(to_jsonb(t) order by t.bucket)
                                                    from public.get_revenue_trend(p_range, p_from, p_to) t), '[]'::jsonb));
end $$;

-- =============================================================== regional
-- STUB: needs payments model (F4)
create or replace function public.get_regional_summary(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_from date; v_to date;
begin
  perform public.adm_require_admin();
  select d_from, d_to into v_from, v_to from public.adm_resolve_date_range(p_range, p_from, p_to);
  return jsonb_build_object(
    'range', jsonb_build_object('key', p_range, 'from', v_from, 'to', v_to),
    'regions_tracked', 0, 'institutions', 0, 'total_revenue_inr', 0,
    'top_region', null, 'avg_growth_pct', null);
end $$;

-- STUB: needs payments model (F4). Zero-valued buckets so the chart renders.
create or replace function public.get_regional_trend(
  p_range text default 'last_30_days', p_from date default null, p_to date default null,
  p_state_code text default null
) returns table (bucket date, revenue_inr numeric, cumulative_inr numeric, transactions int)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_from date; v_to date; g text;
begin
  perform public.adm_require_admin();
  select d_from, d_to into v_from, v_to from public.adm_resolve_date_range(p_range, p_from, p_to);
  g := case when (v_to - v_from) < 92 then 'day' when (v_to - v_from) < 400 then 'week' else 'month' end;
  return query
  select gs::date, 0::numeric, 0::numeric, 0
    from generate_series(date_trunc(g, v_from::timestamp), v_to::timestamp, ('1 ' || g)::interval) gs
   order by 1;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.get_revenue_by_region(
  p_range text default 'last_30_days', p_from date default null, p_to date default null, p_limit int default 10
) returns table (state_code text, region text, revenue_inr numeric, pct_of_max numeric, pct_of_total numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return;
end $$;

-- STUB: needs payments model (F4)
create or replace function public.list_region_comparison(
  p_range text default 'last_30_days', p_from date default null, p_to date default null,
  p_search text default null, p_sort text default 'revenue_desc', p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return;
end $$;

-- STUB: needs payments model (F4). Only "All India" until revenue exists.
create or replace function public.get_regional_filter_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object('regions', jsonb_build_array(jsonb_build_object('code', 'all', 'name', 'All India')),
                            'ranges', public.adm_range_options());
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_payments_stub(text) from public, anon, authenticated;
revoke all on function public.adm_range_options() from public, anon, authenticated;

revoke all on function public.list_discounts(text, text, text, numeric, numeric, text, int, int) from public, anon;
revoke all on function public.get_discount_stats() from public, anon;
revoke all on function public.get_discount(uuid) from public, anon;
revoke all on function public.get_discount_analytics(date, date) from public, anon;
revoke all on function public.create_discount(text, text, text, numeric, numeric, numeric, int, int, timestamptz, timestamptz, text, uuid[], text, boolean) from public, anon;
revoke all on function public.update_discount(uuid, jsonb) from public, anon;
revoke all on function public.set_discount_status(uuid, text, text) from public, anon;
revoke all on function public.list_discount_history(text, text, uuid, date, date, int, int) from public, anon;
revoke all on function public.export_discount_redemptions(date, date) from public, anon;
revoke all on function public.list_transactions(text, date, date, uuid, uuid, numeric, numeric, text, text, int, int) from public, anon;
revoke all on function public.get_transaction_stats(text, date, date, uuid, uuid, numeric, numeric, text) from public, anon;
revoke all on function public.get_transaction_filter_options() from public, anon;
revoke all on function public.get_transaction(uuid) from public, anon;
revoke all on function public.export_transactions(text, date, date, uuid, uuid, numeric, numeric, text, text) from public, anon;
revoke all on function public.mark_payment_paid(uuid, text, text, timestamptz, numeric) from public, anon;
revoke all on function public.mark_payment_refunded(uuid, numeric, text) from public, anon;
revoke all on function public.list_pending_refunds(int, int) from public, anon;
revoke all on function public.list_refund_history(text, date, date, int, int) from public, anon;
revoke all on function public.get_refund_stats() from public, anon;
revoke all on function public.export_refunds(text, date, date) from public, anon;
revoke all on function public.request_refund(uuid, text, text, numeric) from public, anon;
revoke all on function public.approve_refund(uuid, text) from public, anon;
revoke all on function public.reject_refund(uuid, text) from public, anon;
revoke all on function public.get_financial_range_options() from public, anon;
revoke all on function public.get_financial_summary(text, date, date) from public, anon;
revoke all on function public.get_revenue_trend(text, date, date, text) from public, anon;
revoke all on function public.get_financial_analytics(text, date, date) from public, anon;
revoke all on function public.get_regional_summary(text, date, date) from public, anon;
revoke all on function public.get_regional_trend(text, date, date, text) from public, anon;
revoke all on function public.get_revenue_by_region(text, date, date, int) from public, anon;
revoke all on function public.list_region_comparison(text, date, date, text, text, int, int) from public, anon;
revoke all on function public.get_regional_filter_options() from public, anon;

grant execute on function public.list_discounts(text, text, text, numeric, numeric, text, int, int) to authenticated;
grant execute on function public.get_discount_stats() to authenticated;
grant execute on function public.get_discount(uuid) to authenticated;
grant execute on function public.get_discount_analytics(date, date) to authenticated;
grant execute on function public.create_discount(text, text, text, numeric, numeric, numeric, int, int, timestamptz, timestamptz, text, uuid[], text, boolean) to authenticated;
grant execute on function public.update_discount(uuid, jsonb) to authenticated;
grant execute on function public.set_discount_status(uuid, text, text) to authenticated;
grant execute on function public.list_discount_history(text, text, uuid, date, date, int, int) to authenticated;
grant execute on function public.export_discount_redemptions(date, date) to authenticated;
grant execute on function public.list_transactions(text, date, date, uuid, uuid, numeric, numeric, text, text, int, int) to authenticated;
grant execute on function public.get_transaction_stats(text, date, date, uuid, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.get_transaction_filter_options() to authenticated;
grant execute on function public.get_transaction(uuid) to authenticated;
grant execute on function public.export_transactions(text, date, date, uuid, uuid, numeric, numeric, text, text) to authenticated;
grant execute on function public.mark_payment_paid(uuid, text, text, timestamptz, numeric) to authenticated;
grant execute on function public.mark_payment_refunded(uuid, numeric, text) to authenticated;
grant execute on function public.list_pending_refunds(int, int) to authenticated;
grant execute on function public.list_refund_history(text, date, date, int, int) to authenticated;
grant execute on function public.get_refund_stats() to authenticated;
grant execute on function public.export_refunds(text, date, date) to authenticated;
grant execute on function public.request_refund(uuid, text, text, numeric) to authenticated;
grant execute on function public.approve_refund(uuid, text) to authenticated;
grant execute on function public.reject_refund(uuid, text) to authenticated;
grant execute on function public.get_financial_range_options() to authenticated;
grant execute on function public.get_financial_summary(text, date, date) to authenticated;
grant execute on function public.get_revenue_trend(text, date, date, text) to authenticated;
grant execute on function public.get_financial_analytics(text, date, date) to authenticated;
grant execute on function public.get_regional_summary(text, date, date) to authenticated;
grant execute on function public.get_regional_trend(text, date, date, text) to authenticated;
grant execute on function public.get_revenue_by_region(text, date, date, int) to authenticated;
grant execute on function public.list_region_comparison(text, date, date, text, text, int, int) to authenticated;
grant execute on function public.get_regional_filter_options() to authenticated;

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

-- =====================================================================
-- 20261025120400_admin_rpc_notifications.sql
--
-- Purpose
--   Publish Notifications (D10). Campaigns live in notification_campaigns; on
--   publish each recipient gets one inbox row in the lead's notifications
--   table (reference_type = 'notification_campaign', reference_id = campaign
--   id) and one delivery row in notification_recipients. RPCs, as called by
--   notificationsApi.js / NotificationsPanel.jsx / AdminTopbar.jsx:
--     list_notifications, get_notification_stats, get_notification_filter_options,
--     get_notification, preview_notification, estimate_audience,
--     create_notification, publish_notification, archive_notification,
--     delete_draft_notification,
--     mark_notification_read(p_id = campaign id), mark_all_notifications_read,
--     get_my_unread_notification_count
--   plus, for cron / the email Edge Function only (postgres / service_role):
--     dispatch_due_notifications(), record_email_results(p_notification_id, p_results)
--
-- Lead objects read
--   profiles, notification_preferences, students / educator_admin_state (our tables, for active users),
--   adm_series_students (test_series, enrollments, admin_series_enrollments).
-- Lead objects written (runtime, through these RPCs only)
--   notifications: insert (fan-out); update is_read / read_at of the caller's
--   own campaign rows (bell).
--
-- Category mapping (F6, D10): announcement -> announcement;
--   system, policy, alert -> system. The campaign keeps its own category.
--
-- Assumptions
--   * Audiences: learners = students not blocked; educators = educators whose
--     admin account_status is active; admins = admin + super_admin;
--     series_enrolled = adm_series_students; selected_users = existing profiles.
--   * The lead's notification_preferences (user_id, category, in_app, email)
--     are honoured at fan-out: 'announcement' in-app delivery skips users with
--     in_app = false; 'system' notices (system / policy / alert) are always
--     delivered in-app; email follows the email column for both. A missing
--     row means the defaults (true). send-notification-emails re-checks email
--     at send time.
--   * "Opened" = the lead's notifications.is_read on the campaign's rows.
--   * The admin bell lists campaigns (list_notifications) with the caller's
--     own read_at; mark_all_notifications_read only touches campaign rows.
--   * Archiving a campaign hides it from the admin list and the bell count;
--     recipients' inbox rows stay (the lead owns the inbox).
--   * Scheduled campaigns are sent by dispatch_due_notifications(), run every
--     minute by the cron file (20261025120700).
--
-- ROLLBACK
--   drop function if exists public.record_email_results(uuid, jsonb), public.dispatch_due_notifications(),
--     public.get_my_unread_notification_count(), public.mark_all_notifications_read(),
--     public.mark_notification_read(uuid), public.delete_draft_notification(uuid),
--     public.archive_notification(uuid), public.publish_notification(uuid),
--     public.create_notification(text, text, text, text, text[], uuid[], uuid[], timestamptz, text, text),
--     public.estimate_audience(text, uuid[], uuid[]),
--     public.preview_notification(uuid, text, text, text, text, uuid[], uuid[], text[]),
--     public.get_notification(uuid), public.get_notification_filter_options(), public.get_notification_stats(),
--     public.list_notifications(text, text, text, text, int, int),
--     public.adm_publish_campaign(uuid, uuid), public.adm_campaign_row(uuid),
--     public.adm_validate_campaign(text, text, text[]), public.adm_resolve_audience(text, uuid[], uuid[]),
--     public.adm_campaign_category(text);
--   delete from public.notifications where reference_type = 'notification_campaign';   -- inbox rows (data)
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- helpers
create or replace function public.adm_campaign_category(p_category text) returns text
language sql immutable set search_path = public, extensions as $$
  select case when p_category = 'announcement' then 'announcement' else 'system' end;
$$;

create or replace function public.adm_resolve_audience(p_type text, p_series uuid[], p_users uuid[])
returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select p.id from public.profiles p left join public.students st on st.id = p.id
   where p_type in ('all_users', 'learners') and p.role = 'student' and coalesce(st.account_status, 'active') = 'active'
  union
  select p.id from public.profiles p left join public.educator_admin_state es on es.user_id = p.id
   where p_type in ('all_users', 'educators') and p.role = 'educator' and coalesce(es.account_status, 'active') = 'active'
  union
  select p.id from public.profiles p
   where p_type in ('all_users', 'admins') and p.role in ('admin', 'super_admin')
  union
  select st.student_id from public.adm_series_students() st
   where p_type = 'series_enrolled' and st.series_id = any (coalesce(p_series, '{}'))
  union
  select p.id from public.profiles p
   where p_type = 'selected_users' and p.id = any (coalesce(p_users, '{}'));
$$;

-- Clear messages before the table CHECKs fire.
create or replace function public.adm_validate_campaign(p_category text, p_audience text, p_channels text[]) returns void
language plpgsql immutable set search_path = public, extensions as $$
begin
  if p_category is null or p_category not in ('system', 'policy', 'alert', 'announcement') then
    raise exception 'Unknown notification category: %', p_category using errcode = '22023';
  end if;
  if p_audience is null or p_audience not in ('all_users', 'learners', 'educators', 'admins', 'series_enrolled', 'selected_users') then
    raise exception 'Unknown audience: %', p_audience using errcode = '22023';
  end if;
  if coalesce(cardinality(p_channels), 0) = 0 or not (p_channels <@ array['in_app', 'email']) then
    raise exception 'Choose in-app and/or email.' using errcode = '22023';
  end if;
end $$;

-- One list row (archived v_notifications_list keys) plus the caller's read_at.
create or replace function public.adm_campaign_row(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', c.id, 'title', c.title, 'body', c.body, 'category', c.category, 'category_label', initcap(c.category),
           'audience_type', c.audience_type,
           'audience_label', case c.audience_type
               when 'all_users' then 'All users' when 'learners' then 'All learners' when 'educators' then 'Educators'
               when 'admins' then 'Admins'
               when 'series_enrolled' then 'Enrolled in ' || cardinality(c.audience_series_ids) || ' series'
               else cardinality(c.audience_user_ids) || ' selected users' end,
           'channels', to_jsonb(c.channels),
           'channels_label', case when 'email' = any (c.channels) and 'in_app' = any (c.channels) then 'Email + In-app'
                                  when 'email' = any (c.channels) then 'Email' else 'In-app' end,
           'action_url', c.action_url, 'status', c.status, 'scheduled_for', c.scheduled_for,
           'published_at', c.published_at, 'created_at', c.created_at,
           'when_label', case c.status
               when 'published' then 'Sent ' || to_char(c.published_at at time zone 'UTC', 'Mon DD, YYYY')
               when 'scheduled' then to_char(c.scheduled_for at time zone 'UTC', 'Mon DD, YYYY · HH24:MI "UTC"')
               else 'Not scheduled' end,
           'recipients_total', c.recipients_total, 'delivered_count', c.delivered_count,
           'opened_count', (select count(*) from public.notifications n
                             where n.reference_type = 'notification_campaign' and n.reference_id = c.id and n.is_read),
           'read_at', (select n.read_at from public.notifications n
                        where n.reference_type = 'notification_campaign' and n.reference_id = c.id
                          and n.user_id = auth.uid() order by n.created_at desc limit 1),
           'created_by', c.created_by, 'created_by_name', p.full_name)
    from public.notification_campaigns c
    left join public.profiles p on p.id = c.created_by
   where c.id = p_id;
$$;

-- Fan-out and flip to published. p_actor is null when cron sends it.
create or replace function public.adm_publish_campaign(p_id uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  c           public.notification_campaigns;
  v_in        boolean;
  v_mail      boolean;
  v_cat       text;
  v_cnt       int;
  v_delivered int;
  v_queued    int;
begin
  select * into c from public.notification_campaigns where id = p_id for update;
  if not found then raise exception 'Notification not found.' using errcode = 'P0002'; end if;
  if c.status not in ('draft', 'scheduled') then
    raise exception 'Notification is already %.', c.status using errcode = '22023';
  end if;
  v_in   := 'in_app' = any (c.channels);
  v_mail := 'email'  = any (c.channels);
  v_cat  := public.adm_campaign_category(c.category);

  -- Preferences (the lead's notification_preferences, keyed by user_id + category;
  -- a missing row means the column defaults: in_app = true, email = true):
  --   in-app: 'announcement' campaigns skip users with in_app = false;
  --           'system' notices (system / policy / alert) are always delivered.
  --   email:  follows notification_preferences.email for both categories.
  -- Users left with no channel get no recipient row.
  with aud as (
    select distinct a as uid from public.adm_resolve_audience(c.audience_type, c.audience_series_ids, c.audience_user_ids) a
  ), pref as (
    select aud.uid,
           v_in and (v_cat = 'system' or coalesce(np.in_app, true)) as want_in,
           v_mail and coalesce(np.email, true)                     as want_mail
      from aud
      left join public.notification_preferences np on np.user_id = aud.uid and np.category = v_cat
  ), inbox as (
    insert into public.notifications (user_id, category, title, body, action_url, reference_type, reference_id)
    select pref.uid, v_cat, c.title, c.body, c.action_url, 'notification_campaign', c.id
      from pref where pref.want_in
    returning id, user_id
  )
  insert into public.notification_recipients (campaign_id, user_id, inbox_notification_id, email_status, delivery_status, delivered_at)
  select c.id, pref.uid, inbox.id,
         case when pref.want_mail then 'queued' else 'not_requested' end,
         case when pref.want_in then 'delivered' else 'queued' end,
         case when pref.want_in then now() end
    from pref left join inbox on inbox.user_id = pref.uid
   where pref.want_in or pref.want_mail
  on conflict (campaign_id, user_id) do nothing;
  get diagnostics v_cnt = row_count;
  if v_cnt = 0 then
    raise exception 'No recipients match this audience (after notification preferences).' using errcode = '22023';
  end if;

  select count(*) filter (where nr.delivery_status = 'delivered'), count(*) filter (where nr.email_status = 'queued')
    into v_delivered, v_queued
    from public.notification_recipients nr where nr.campaign_id = p_id;
  update public.notification_campaigns
     set status = 'published', published_at = now(), updated_by = p_actor,
         recipients_total = v_cnt, delivered_count = v_delivered
   where id = p_id;
  insert into public.notification_campaign_events (campaign_id, event_type, actor_id, detail)
  values (p_id, 'published', p_actor, jsonb_build_object('recipients', v_cnt, 'in_app', v_delivered, 'email_queued', v_queued));
  return jsonb_build_object('id', p_id, 'recipients', v_cnt, 'email_queued', v_queued);
end $$;

-- ------------------------------------------------------------- admin reads
create or replace function public.list_notifications(
  p_search text default null, p_status text default null, p_category text default null,
  p_audience text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select c.id, c.created_at from public.notification_campaigns c
     where c.status <> 'archived'
       and (v_like is null or c.title ilike v_like or c.body ilike v_like)
       and (p_status is null or p_status in ('', 'all') or c.status = p_status)
       and (p_category is null or p_category in ('', 'all') or c.category = p_category)
       and (p_audience is null or p_audience in ('', 'all') or c.audience_type = p_audience)
  )
  select public.adm_campaign_row(f.id), count(*) over ()
    from f
   order by f.created_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_notification_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'total',     count(*) filter (where c.status <> 'archived'),
      'published', count(*) filter (where c.status = 'published'),
      'drafts',    count(*) filter (where c.status = 'draft'),
      'scheduled', count(*) filter (where c.status = 'scheduled'),
      'delivered', coalesce(sum(c.delivered_count) filter (where c.status = 'published'), 0),
      'opened',    (select count(*) from public.notifications n
                     join public.notification_campaigns x on x.id = n.reference_id and x.status = 'published'
                    where n.reference_type = 'notification_campaign' and n.is_read))
      from public.notification_campaigns c);
end $$;

create or replace function public.get_notification_filter_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'statuses',   jsonb_build_array('draft', 'scheduled', 'published'),
    'categories', jsonb_build_array('system', 'policy', 'alert', 'announcement'),
    'audiences',  jsonb_build_array('all_users', 'learners', 'educators', 'admins', 'series_enrolled', 'selected_users'),
    'channels',   jsonb_build_array('in_app', 'email'));
end $$;

create or replace function public.get_notification(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.notification_campaigns;
begin
  perform public.adm_require_admin();
  select * into c from public.notification_campaigns where id = p_id;
  if not found then raise exception 'Notification not found.' using errcode = 'P0002'; end if;
  return to_jsonb(c) || jsonb_build_object(
    'audience_estimate', (select count(*) from public.adm_resolve_audience(c.audience_type, c.audience_series_ids, c.audience_user_ids)));
end $$;

-- Works for a saved campaign (p_id) or an unsaved form (fields override the row).
create or replace function public.preview_notification(
  p_id uuid default null, p_title text default null, p_body text default null,
  p_category text default null, p_audience_type text default null,
  p_series_ids uuid[] default null, p_user_ids uuid[] default null, p_channels text[] default null
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  c          public.notification_campaigns;
  v_title    text;
  v_body     text;
  v_category text;
  v_audience text;
  v_series   uuid[];
  v_users    uuid[];
  v_channels text[];
begin
  perform public.adm_require_admin();
  if p_id is not null then select * into c from public.notification_campaigns where id = p_id; end if;
  v_title    := coalesce(p_title, c.title, '');
  v_body     := coalesce(p_body, c.body, '');
  v_category := coalesce(p_category, c.category, 'announcement');
  v_audience := coalesce(p_audience_type, c.audience_type, 'all_users');
  v_series   := coalesce(p_series_ids, c.audience_series_ids, '{}');
  v_users    := coalesce(p_user_ids, c.audience_user_ids, '{}');
  v_channels := coalesce(p_channels, c.channels, '{in_app}');
  return jsonb_build_object(
    'in_app', case when 'in_app' = any (v_channels)
                   then jsonb_build_object('title', v_title, 'body', v_body, 'category', v_category) end,
    'email',  case when 'email' = any (v_channels) then jsonb_build_object('subject', v_title, 'body', v_body) end,
    'audience_type', v_audience,
    'estimated_recipients', (select count(*) from public.adm_resolve_audience(v_audience, v_series, v_users)));
end $$;

create or replace function public.estimate_audience(p_type text, p_series_ids uuid[] default '{}', p_user_ids uuid[] default '{}')
returns int
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (select count(*)::int from public.adm_resolve_audience(p_type, p_series_ids, p_user_ids));
end $$;

-- ------------------------------------------------------------ admin writes
-- p_action: draft | schedule | publish
create or replace function public.create_notification(
  p_title text, p_body text, p_category text, p_audience_type text, p_channels text[] default '{in_app}',
  p_series_ids uuid[] default '{}', p_user_ids uuid[] default '{}',
  p_scheduled_for timestamptz default null, p_action text default 'draft', p_action_url text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id     uuid;
  v_action text := coalesce(nullif(p_action, ''), 'draft');
begin
  perform public.adm_require_admin();
  if v_action not in ('draft', 'schedule', 'publish') then
    raise exception 'Unknown action: %', p_action using errcode = '22023';
  end if;
  perform public.adm_validate_campaign(p_category, p_audience_type, coalesce(p_channels, '{in_app}'));
  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 120 then
    raise exception 'Title must be 3 to 120 characters.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'Message must be 1 to 2000 characters.' using errcode = '22023';
  end if;
  if p_audience_type = 'series_enrolled' and coalesce(cardinality(p_series_ids), 0) = 0 then
    raise exception 'Select at least one test series.' using errcode = '22023';
  end if;
  if p_audience_type = 'selected_users' and coalesce(cardinality(p_user_ids), 0) = 0 then
    raise exception 'Select at least one user.' using errcode = '22023';
  end if;
  if v_action = 'schedule' and (p_scheduled_for is null or p_scheduled_for <= now()) then
    raise exception 'Pick a future date and time to schedule.' using errcode = '22023';
  end if;

  insert into public.notification_campaigns
    (title, body, category, audience_type, audience_series_ids, audience_user_ids, channels, action_url,
     status, scheduled_for, created_by, updated_by)
  values (btrim(p_title), btrim(p_body), p_category, p_audience_type, coalesce(p_series_ids, '{}'),
          coalesce(p_user_ids, '{}'), coalesce(p_channels, '{in_app}'), nullif(btrim(coalesce(p_action_url, '')), ''),
          case when v_action = 'schedule' then 'scheduled' else 'draft' end,
          case when v_action = 'schedule' then p_scheduled_for end, auth.uid(), auth.uid())
  returning id into v_id;
  insert into public.notification_campaign_events (campaign_id, event_type, actor_id) values (v_id, 'created', auth.uid());
  if v_action = 'schedule' then
    insert into public.notification_campaign_events (campaign_id, event_type, actor_id, detail)
    values (v_id, 'scheduled', auth.uid(), jsonb_build_object('at', p_scheduled_for));
  end if;
  perform public.adm_audit('notification.create', 'notification_campaign', v_id, null,
                           jsonb_build_object('action', v_action, 'audience', p_audience_type), null);
  if v_action = 'publish' then
    perform public.adm_publish_campaign(v_id, auth.uid());
    perform public.adm_audit('notification.publish', 'notification_campaign', v_id, null, null, null);
  end if;
  return v_id;
end $$;

create or replace function public.publish_notification(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public.adm_require_admin();
  r := public.adm_publish_campaign(p_id, auth.uid());
  perform public.adm_audit('notification.publish', 'notification_campaign', p_id, null, r, null);
  return r;
end $$;

create or replace function public.archive_notification(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.notification_campaigns
     set status = 'archived', archived_at = now(), updated_by = auth.uid()
   where id = p_id and status = 'published';
  if not found then raise exception 'Only published notifications can be archived.' using errcode = '22023'; end if;
  insert into public.notification_campaign_events (campaign_id, event_type, actor_id) values (p_id, 'archived', auth.uid());
  perform public.adm_audit('notification.archive', 'notification_campaign', p_id, null, null, null);
end $$;

create or replace function public.delete_draft_notification(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  delete from public.notification_campaigns where id = p_id and status in ('draft', 'scheduled');
  if not found then
    raise exception 'Only drafts and scheduled notifications can be deleted.' using errcode = '22023';
  end if;
  perform public.adm_audit('notification.delete', 'notification_campaign', p_id, null, null, null);
end $$;

-- ------------------------------------------------------------- admin bell
-- p_id is the CAMPAIGN id (NotificationsPanel passes list_notifications ids).
create or replace function public.mark_notification_read(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.notifications
     set is_read = true, read_at = now()
   where user_id = auth.uid() and reference_type = 'notification_campaign' and reference_id = p_id and not is_read;
end $$;

create or replace function public.mark_all_notifications_read() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.notifications
     set is_read = true, read_at = now()
   where user_id = auth.uid() and reference_type = 'notification_campaign' and not is_read;
end $$;

create or replace function public.get_my_unread_notification_count() returns int
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (select count(*)::int
            from public.notifications n
            join public.notification_campaigns c on c.id = n.reference_id and c.status = 'published'
           where n.user_id = auth.uid() and n.reference_type = 'notification_campaign' and not n.is_read);
end $$;

-- --------------------------------------------------- cron / Edge Function
-- Cron (every minute). No admin check: cron runs without a user. A campaign
-- that fails (e.g. empty audience) goes back to draft with an event.
create or replace function public.dispatch_due_notifications() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  n int := 0;
begin
  for r in select c.id from public.notification_campaigns c
            where c.status = 'scheduled' and c.scheduled_for <= now()
            order by c.scheduled_for
            for update skip locked
  loop
    begin
      perform public.adm_publish_campaign(r.id, null);
      n := n + 1;
    exception when others then
      update public.notification_campaigns set status = 'draft', scheduled_for = null where id = r.id;
      insert into public.notification_campaign_events (campaign_id, event_type, detail)
      values (r.id, 'dispatch_failed', jsonb_build_object('error', sqlerrm));
    end;
  end loop;
  return n;
end $$;

-- Email worker callback (service role): [{"user_id": "...", "ok": true, "error": null}, ...]
create or replace function public.record_email_results(p_notification_id uuid, p_results jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.notification_recipients nr
     set email_status    = case when x.ok then 'sent' else 'failed' end,
         email_sent_at   = case when x.ok then now() end,
         email_error     = case when x.ok then null else x.error end,
         delivery_status = case when nr.delivery_status = 'delivered' then nr.delivery_status
                                when x.ok then 'delivered' else 'failed' end,
         delivered_at    = coalesce(nr.delivered_at, case when x.ok then now() end)
    from jsonb_to_recordset(case when jsonb_typeof(p_results) = 'array' then p_results else '[]'::jsonb end)
         as x(user_id uuid, ok boolean, error text)
   where nr.campaign_id = p_notification_id and nr.user_id = x.user_id;
  update public.notification_campaigns c
     set delivered_count = (select count(*) from public.notification_recipients nr
                             where nr.campaign_id = c.id and nr.delivery_status = 'delivered')
   where c.id = p_notification_id;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_campaign_category(text) from public, anon, authenticated;
revoke all on function public.adm_resolve_audience(text, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.adm_validate_campaign(text, text, text[]) from public, anon, authenticated;
revoke all on function public.adm_campaign_row(uuid) from public, anon, authenticated;
revoke all on function public.adm_publish_campaign(uuid, uuid) from public, anon, authenticated;

revoke all on function public.list_notifications(text, text, text, text, int, int) from public, anon;
revoke all on function public.get_notification_stats() from public, anon;
revoke all on function public.get_notification_filter_options() from public, anon;
revoke all on function public.get_notification(uuid) from public, anon;
revoke all on function public.preview_notification(uuid, text, text, text, text, uuid[], uuid[], text[]) from public, anon;
revoke all on function public.estimate_audience(text, uuid[], uuid[]) from public, anon;
revoke all on function public.create_notification(text, text, text, text, text[], uuid[], uuid[], timestamptz, text, text) from public, anon;
revoke all on function public.publish_notification(uuid) from public, anon;
revoke all on function public.archive_notification(uuid) from public, anon;
revoke all on function public.delete_draft_notification(uuid) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
revoke all on function public.get_my_unread_notification_count() from public, anon;

grant execute on function public.list_notifications(text, text, text, text, int, int) to authenticated;
grant execute on function public.get_notification_stats() to authenticated;
grant execute on function public.get_notification_filter_options() to authenticated;
grant execute on function public.get_notification(uuid) to authenticated;
grant execute on function public.preview_notification(uuid, text, text, text, text, uuid[], uuid[], text[]) to authenticated;
grant execute on function public.estimate_audience(text, uuid[], uuid[]) to authenticated;
grant execute on function public.create_notification(text, text, text, text, text[], uuid[], uuid[], timestamptz, text, text) to authenticated;
grant execute on function public.publish_notification(uuid) to authenticated;
grant execute on function public.archive_notification(uuid) to authenticated;
grant execute on function public.delete_draft_notification(uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.get_my_unread_notification_count() to authenticated;

revoke all on function public.dispatch_due_notifications() from public, anon, authenticated;
grant execute on function public.dispatch_due_notifications() to postgres, service_role;
revoke all on function public.record_email_results(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_email_results(uuid, jsonb) to service_role;

-- =====================================================================
-- 20261025120500_admin_rpc_callbacks.sql
--
-- Purpose
--   Callback Requests (callbacksApi.js, page /admin/supporttickets) over the
--   lead's callback_requests, extended in Batch 1 (20261025100300):
--     get_callback_stats, get_callback_filter_options, list_callback_requests,
--     get_callback_request, export_callback_report, set_callback_status,
--     add_callback_note
--   and the public website form:
--     submit_callback_request(...)   -> anon + authenticated, no admin check
--
-- Lead objects read / written
--   callback_requests: read; runtime insert (public form) and update of status /
--   contact / close columns and code (admin actions). profiles (names).
--   callback_activity (our table) holds the timeline.
--
-- Assumptions
--   * Status values are the lead's CHECK (F7): new, contacted, closed.
--   * source is free text in the lead's table; the four archived keys
--     (website_visitor, prospective_institution, prospective_educator, other)
--     are recognised and anything else reads as 'other'.
--   * Rows the lead's own site inserts get code = null. They show the fallback
--     'CB-NEW-xxxx' until the first admin action assigns a real CB-<n> code
--     (Batch 1 contract). The public form assigns a code immediately.
--   * The lead's phone column is free text: phone search compares digits, and
--     display formatting only applies to +91 numbers.
--
-- ROLLBACK
--   drop function if exists public.submit_callback_request(text, text, text, text, text, text, text, text),
--     public.add_callback_note(uuid, text), public.set_callback_status(uuid, text, text),
--     public.export_callback_report(text, text, text, date, date), public.get_callback_request(uuid),
--     public.list_callback_requests(text, text, text, text, int, int), public.get_callback_filter_options(),
--     public.get_callback_stats(), public.adm_callback_rows(), public.adm_callback_assign_code(uuid),
--     public.adm_callback_source_key(text);
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- helpers
create or replace function public.adm_callback_source_key(p_source text) returns text
language sql immutable set search_path = public, extensions as $$
  select case when p_source in ('website_visitor', 'prospective_institution', 'prospective_educator', 'other')
              then p_source else 'other' end;
$$;

-- Assigns CB-<n> to a lead-inserted row on its first admin action.
create or replace function public.adm_callback_assign_code(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  update public.callback_requests
     set code = 'CB-' || nextval('public.adm_callback_code_seq')
   where id = p_id and code is null;
$$;

-- Same columns as the archived v_callback_requests.
create or replace function public.adm_callback_rows()
returns table (
  id uuid, code text, name text, phone text, phone_display text, phone_digits text, email text,
  organization text, source text, source_label text, message text, status text, status_label text,
  assigned_to uuid, assigned_to_name text, contacted_at timestamptz, closed_at timestamptz,
  submitted_from text, created_at timestamptz, updated_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select r.id,
         coalesce(r.code, 'CB-NEW-' || upper(left(r.id::text, 4))),
         r.name, r.phone, public.adm_phone_display(r.phone), regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'),
         r.email, r.organization, public.adm_callback_source_key(r.source),
         case public.adm_callback_source_key(r.source)
           when 'website_visitor' then 'Website Visitor' when 'prospective_institution' then 'Prospective Institution'
           when 'prospective_educator' then 'Prospective Educator' else 'Other' end,
         r.message, r.status, initcap(r.status),
         r.assigned_to, ap.full_name, r.contacted_at, r.closed_at, r.submitted_from,
         r.created_at, coalesce(r.updated_at, r.created_at)
    from public.callback_requests r
    left join public.profiles ap on ap.id = r.assigned_to;
$$;

-- ------------------------------------------------------------------ reads
create or replace function public.get_callback_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'total',     count(*),
      'new',       count(*) filter (where r.status = 'new'),
      'contacted', count(*) filter (where r.status = 'contacted'),
      'closed',    count(*) filter (where r.status = 'closed'),
      'avg_first_response_hours',
        round((extract(epoch from avg(r.contacted_at - r.created_at) filter (where r.contacted_at is not null)) / 3600)::numeric, 1))
      from public.callback_requests r);
end $$;

-- p_status: new | contacted | closed | all. p_source: one of the four keys | all.
-- p_sort: newest | oldest | status
create or replace function public.list_callback_requests(
  p_search text default null, p_status text default null, p_source text default null,
  p_sort text default 'newest', p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like   text := public.adm_like(p_search);
  v_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  v_size   int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page   int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select v.* from public.adm_callback_rows() v
     where (v_like is null or v.name ilike v_like or v.email ilike v_like or v.message ilike v_like
            or v.organization ilike v_like or v.code ilike v_like
            or (char_length(v_digits) >= 3 and v.phone_digits like '%' || v_digits || '%'))
       and (p_status is null or p_status in ('', 'all') or v.status = p_status)
       and (p_source is null or p_source in ('', 'all') or v.source = p_source)
  )
  select jsonb_build_object(
           'id', f.id, 'code', f.code, 'name', f.name, 'phone', f.phone, 'phone_display', f.phone_display,
           'email', f.email, 'source', f.source, 'source_label', f.source_label, 'message', f.message,
           'status', f.status, 'status_label', f.status_label, 'assigned_to_name', f.assigned_to_name,
           'created_at', f.created_at),
         count(*) over ()
    from f
   order by case when p_sort = 'oldest' then f.created_at end asc,
            case when p_sort = 'status' then case f.status when 'new' then 1 when 'contacted' then 2 else 3 end end asc,
            f.created_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_callback_filter_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'statuses', (select jsonb_agg(jsonb_build_object('key', k, 'label', initcap(k),
                                  'count', (select count(*) from public.callback_requests r where r.status = k)) order by o)
                   from unnest(array['new', 'contacted', 'closed']) with ordinality as s(k, o)),
    'sources',  (select jsonb_agg(jsonb_build_object('key', k,
                                  'label', case k when 'website_visitor' then 'Website Visitor'
                                                  when 'prospective_institution' then 'Prospective Institution'
                                                  when 'prospective_educator' then 'Prospective Educator' else 'Other' end,
                                  'count', (select count(*) from public.callback_requests r
                                             where public.adm_callback_source_key(r.source) = k)) order by o)
                   from unnest(array['website_visitor', 'prospective_institution', 'prospective_educator', 'other'])
                        with ordinality as s(k, o)));
end $$;

create or replace function public.get_callback_request(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform public.adm_require_admin();
  select to_jsonb(x) || jsonb_build_object(
           'first_response_minutes', case when x.contacted_at is not null
                                          then round(extract(epoch from (x.contacted_at - x.created_at)) / 60) end,
           'activity', coalesce((
             select jsonb_agg(jsonb_build_object('id', a.id, 'type', a.type, 'from_status', a.from_status,
                                                 'to_status', a.to_status, 'note', a.note, 'actor', p.full_name,
                                                 'at', a.created_at) order by a.created_at desc)
               from public.callback_activity a left join public.profiles p on p.id = a.actor_id
              where a.request_id = x.id), '[]'::jsonb))
    into v
    from public.adm_callback_rows() x where x.id = p_id;
  if v is null then raise exception 'Callback request not found.' using errcode = 'P0002'; end if;
  return v;
end $$;

create or replace function public.export_callback_report(
  p_search text default null, p_status text default null, p_source text default null,
  p_from date default null, p_to date default null
) returns table (request_id text, name text, phone text, email text, organization text, source text, message text,
                 status text, assigned_to text, received_at timestamptz, contacted_at timestamptz, closed_at timestamptz,
                 first_response_hours numeric)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare
  v_like   text := public.adm_like(p_search);
  v_digits text := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');
  v_rows   int;
begin
  perform public.adm_require_admin();
  return query
  select v.code, v.name, v.phone_display, v.email, v.organization, v.source_label, v.message,
         v.status_label, v.assigned_to_name, v.created_at, v.contacted_at, v.closed_at,
         case when v.contacted_at is not null
              then round((extract(epoch from (v.contacted_at - v.created_at)) / 3600)::numeric, 1) end
    from public.adm_callback_rows() v
   where (v_like is null or v.name ilike v_like or v.email ilike v_like or v.message ilike v_like
          or (char_length(v_digits) >= 3 and v.phone_digits like '%' || v_digits || '%'))
     and (p_status is null or p_status in ('', 'all') or v.status = p_status)
     and (p_source is null or p_source in ('', 'all') or v.source = p_source)
     and (p_from is null or v.created_at >= p_from::timestamp at time zone 'Asia/Kolkata')
     and (p_to is null or v.created_at < (p_to + 1)::timestamp at time zone 'Asia/Kolkata')
   order by v.created_at desc;
  get diagnostics v_rows = row_count;
  perform public.log_export('callback_requests',
                            jsonb_build_object('search', p_search, 'status', p_status, 'source', p_source), v_rows);
end $$;

-- ----------------------------------------------------------------- writes
create or replace function public.set_callback_status(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  if p_status is null or p_status not in ('new', 'contacted', 'closed') then
    raise exception 'Unknown callback status: %', p_status using errcode = '22023';
  end if;
  select status into v_old from public.callback_requests where id = p_id for update;
  if not found then raise exception 'Callback request not found.' using errcode = 'P0002'; end if;
  perform public.adm_callback_assign_code(p_id);
  if v_old = p_status then
    if nullif(btrim(coalesce(p_note, '')), '') is not null then
      insert into public.callback_activity (request_id, type, note, actor_id) values (p_id, 'note', btrim(p_note), auth.uid());
    end if;
    return;
  end if;

  update public.callback_requests set
    status       = p_status,
    contacted_at = case when p_status in ('contacted', 'closed') then coalesce(contacted_at, now()) else contacted_at end,
    contacted_by = case when p_status in ('contacted', 'closed') then coalesce(contacted_by, auth.uid()) else contacted_by end,
    closed_at    = case when p_status = 'closed' then now() end,
    closed_by    = case when p_status = 'closed' then auth.uid() end,
    assigned_to  = coalesce(assigned_to, case when p_status <> 'new' then auth.uid() end),
    updated_at   = now()
  where id = p_id;
  insert into public.callback_activity (request_id, type, from_status, to_status, note, actor_id)
  values (p_id, 'status_changed', v_old, p_status, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  perform public.adm_audit('callback.status', 'callback_request', p_id,
                           jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), p_note);
end $$;

create or replace function public.add_callback_note(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  if nullif(btrim(coalesce(p_note, '')), '') is null then raise exception 'Note is empty.' using errcode = '22023'; end if;
  if not exists (select 1 from public.callback_requests where id = p_id) then
    raise exception 'Callback request not found.' using errcode = 'P0002';
  end if;
  perform public.adm_callback_assign_code(p_id);
  insert into public.callback_activity (request_id, type, note, actor_id) values (p_id, 'note', left(btrim(p_note), 2000), auth.uid());
  update public.callback_requests set updated_at = now() where id = p_id;
end $$;

-- --------------------------------------------------------- public form
-- Website callback form (anon). No admin check by design. Honeypot, phone
-- validation, duplicate merge (same phone still open within 7 days) and a
-- 3-per-24h throttle per phone.
create or replace function public.submit_callback_request(
  p_name text, p_phone text, p_source text, p_message text,
  p_email text default null, p_organization text default null,
  p_page_url text default null, p_honeypot text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_phone  text := public.adm_normalize_phone(p_phone);
  v_email  text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_open   uuid;
  v_id     uuid;
begin
  if nullif(btrim(coalesce(p_honeypot, '')), '') is not null then
    return gen_random_uuid();   -- bot: pretend success, store nothing
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'Please enter your name.' using errcode = '22023';
  end if;
  if v_phone is null then raise exception 'Please enter a valid phone number.' using errcode = '22023'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) not between 3 and 1000 then
    raise exception 'Please tell us how we can help (3 to 1000 characters).' using errcode = '22023';
  end if;

  select r.id into v_open
    from public.callback_requests r
   where (r.phone = v_phone or public.adm_normalize_phone(r.phone) = v_phone)
     and r.status in ('new', 'contacted') and r.created_at > now() - interval '7 days'
   order by r.created_at desc limit 1;
  if v_open is not null then
    insert into public.callback_activity (request_id, type, note) values (v_open, 'repeat_submission', left(btrim(p_message), 1000));
    return v_open;
  end if;
  if (select count(*) from public.callback_requests r
       where (r.phone = v_phone or public.adm_normalize_phone(r.phone) = v_phone)
         and r.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'We already have your requests. Our team will call you soon.' using errcode = '54000';
  end if;

  insert into public.callback_requests (name, phone, email, organization, source, message, status, code,
                                        submitted_from, updated_at)
  values (btrim(p_name), v_phone, v_email, nullif(btrim(coalesce(p_organization, '')), ''),
          public.adm_callback_source_key(coalesce(nullif(btrim(p_source), ''), 'website_visitor')),
          btrim(p_message), 'new', 'CB-' || nextval('public.adm_callback_code_seq'), left(p_page_url, 500), now())
  returning id into v_id;
  insert into public.callback_activity (request_id, type, to_status) values (v_id, 'created', 'new');
  return v_id;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_callback_source_key(text) from public, anon, authenticated;
revoke all on function public.adm_callback_assign_code(uuid) from public, anon, authenticated;
revoke all on function public.adm_callback_rows() from public, anon, authenticated;

revoke all on function public.get_callback_stats() from public, anon;
revoke all on function public.list_callback_requests(text, text, text, text, int, int) from public, anon;
revoke all on function public.get_callback_filter_options() from public, anon;
revoke all on function public.get_callback_request(uuid) from public, anon;
revoke all on function public.export_callback_report(text, text, text, date, date) from public, anon;
revoke all on function public.set_callback_status(uuid, text, text) from public, anon;
revoke all on function public.add_callback_note(uuid, text) from public, anon;

grant execute on function public.get_callback_stats() to authenticated;
grant execute on function public.list_callback_requests(text, text, text, text, int, int) to authenticated;
grant execute on function public.get_callback_filter_options() to authenticated;
grant execute on function public.get_callback_request(uuid) to authenticated;
grant execute on function public.export_callback_report(text, text, text, date, date) to authenticated;
grant execute on function public.set_callback_status(uuid, text, text) to authenticated;
grant execute on function public.add_callback_note(uuid, text) to authenticated;

-- The public form is the one anon-callable RPC.
revoke all on function public.submit_callback_request(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_callback_request(text, text, text, text, text, text, text, text) to anon, authenticated;

-- =====================================================================
-- 20261025120600_admin_rpc_support_tickets.sql
--
-- Purpose
--   D11: admin RPCs over the lead's support_tickets / support_ticket_replies,
--   exposed through the new service src/portals/admin/services/supportTicketsApi.js:
--     get_support_ticket_stats()
--     list_support_tickets(p_search, p_status, p_category, p_priority, p_assigned_to, p_sort, p_page, p_size)
--     get_support_ticket(p_id)                     -> ticket + thread (internal notes included)
--     set_support_ticket_status(p_id, p_status, p_note)
--     set_support_ticket_priority(p_id, p_priority)
--     assign_support_ticket(p_id, p_admin_id)      -> null unassigns
--     reply_support_ticket(p_id, p_content, p_internal)
--
-- Lead objects read / written
--   support_tickets: read; runtime update of status, priority, assigned_to,
--   resolved_at, updated_at. support_ticket_replies: read; runtime insert.
--   profiles: names / roles.
--
-- Assumptions
--   * Status values are the lead's CHECK (F7): open, in_progress,
--     waiting_on_user, resolved, closed. Category and priority use the lead's
--     CHECK values (technical .. other; low, medium, high, urgent).
--   * resolved_at is set when a ticket moves to resolved or closed and cleared
--     when it is reopened.
--   * No ticket UI changes: /admin/supporttickets keeps showing callback
--     requests. A second "Support tickets" tab needs a page change and is listed
--     in docs/ADMIN_BACKEND_TODO.md (D11).
--   * Submitters are not notified from here (the lead's app owns ticket
--     notifications, if any); listed as a follow-up.
--
-- ROLLBACK
--   drop function if exists public.reply_support_ticket(uuid, text, boolean),
--     public.assign_support_ticket(uuid, uuid), public.set_support_ticket_priority(uuid, text),
--     public.set_support_ticket_status(uuid, text, text), public.get_support_ticket(uuid),
--     public.list_support_tickets(text, text, text, text, uuid, text, int, int),
--     public.get_support_ticket_stats(), public.adm_ticket_rows();
-- =====================================================================
set search_path = public, extensions;

create or replace function public.adm_ticket_rows()
returns table (
  id uuid, subject text, category text, priority text, status text,
  submitted_by uuid, submitter_name text, submitter_email text, submitter_role text,
  assigned_to uuid, assigned_to_name text, reference_type text, reference_id uuid,
  reply_count bigint, last_reply_at timestamptz, created_at timestamptz, updated_at timestamptz,
  resolved_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select t.id, t.subject, t.category, t.priority, t.status,
         t.submitted_by, sp.full_name, sp.email, sp.role,
         t.assigned_to, ap.full_name, t.reference_type, t.reference_id,
         (select count(*) from public.support_ticket_replies r where r.ticket_id = t.id),
         (select max(r.created_at) from public.support_ticket_replies r where r.ticket_id = t.id),
         t.created_at, t.updated_at, t.resolved_at
    from public.support_tickets t
    left join public.profiles sp on sp.id = t.submitted_by
    left join public.profiles ap on ap.id = t.assigned_to;
$$;

create or replace function public.get_support_ticket_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'total',           count(*),
      'open',            count(*) filter (where t.status = 'open'),
      'in_progress',     count(*) filter (where t.status = 'in_progress'),
      'waiting_on_user', count(*) filter (where t.status = 'waiting_on_user'),
      'resolved',        count(*) filter (where t.status = 'resolved'),
      'closed',          count(*) filter (where t.status = 'closed'),
      'urgent_open',     count(*) filter (where t.priority = 'urgent' and t.status in ('open', 'in_progress', 'waiting_on_user')),
      'unassigned',      count(*) filter (where t.assigned_to is null and t.status in ('open', 'in_progress', 'waiting_on_user')))
      from public.support_tickets t);
end $$;

-- p_sort: newest | oldest | priority | updated
create or replace function public.list_support_tickets(
  p_search text default null, p_status text default null, p_category text default null,
  p_priority text default null, p_assigned_to uuid default null, p_sort text default 'newest',
  p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select v.* from public.adm_ticket_rows() v
     where (v_like is null or v.subject ilike v_like or v.submitter_name ilike v_like or v.submitter_email ilike v_like
            or exists (select 1 from public.support_tickets t where t.id = v.id and t.description ilike v_like))
       and (p_status is null or p_status in ('', 'all') or v.status = p_status)
       and (p_category is null or p_category in ('', 'all') or v.category = p_category)
       and (p_priority is null or p_priority in ('', 'all') or v.priority = p_priority)
       and (p_assigned_to is null or v.assigned_to = p_assigned_to)
  )
  select to_jsonb(f), count(*) over ()
    from f
   order by case when p_sort = 'oldest' then f.created_at end asc,
            case when p_sort = 'priority' then case f.priority when 'urgent' then 1 when 'high' then 2
                                                               when 'medium' then 3 else 4 end end asc,
            case when p_sort = 'updated' then f.updated_at end desc,
            f.created_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_support_ticket(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform public.adm_require_admin();
  select to_jsonb(x) || jsonb_build_object(
           'description', (select t.description from public.support_tickets t where t.id = x.id),
           'replies', coalesce((
             select jsonb_agg(jsonb_build_object('id', r.id, 'author_id', r.author_id, 'author_name', p.full_name,
                                                 'author_role', p.role, 'content', r.content, 'is_internal', r.is_internal,
                                                 'attachment_url', r.attachment_url, 'created_at', r.created_at)
                              order by r.created_at)
               from public.support_ticket_replies r left join public.profiles p on p.id = r.author_id
              where r.ticket_id = x.id), '[]'::jsonb))
    into v
    from public.adm_ticket_rows() x where x.id = p_id;
  if v is null then raise exception 'Support ticket not found.' using errcode = 'P0002'; end if;
  return v;
end $$;

create or replace function public.set_support_ticket_status(p_id uuid, p_status text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  if p_status is null or p_status not in ('open', 'in_progress', 'waiting_on_user', 'resolved', 'closed') then
    raise exception 'Unknown ticket status: %', p_status using errcode = '22023';
  end if;
  select status into v_old from public.support_tickets where id = p_id for update;
  if not found then raise exception 'Support ticket not found.' using errcode = 'P0002'; end if;
  update public.support_tickets
     set status      = p_status,
         resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) end,
         updated_at  = now()
   where id = p_id;
  if nullif(btrim(coalesce(p_note, '')), '') is not null then
    insert into public.support_ticket_replies (ticket_id, author_id, content, is_internal)
    values (p_id, auth.uid(), btrim(p_note), true);
  end if;
  perform public.adm_audit('support_ticket.status', 'support_ticket', p_id,
                           jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), p_note);
  return public.get_support_ticket(p_id);
end $$;

create or replace function public.set_support_ticket_priority(p_id uuid, p_priority text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  if p_priority is null or p_priority not in ('low', 'medium', 'high', 'urgent') then
    raise exception 'Unknown priority: %', p_priority using errcode = '22023';
  end if;
  select priority into v_old from public.support_tickets where id = p_id for update;
  if not found then raise exception 'Support ticket not found.' using errcode = 'P0002'; end if;
  update public.support_tickets set priority = p_priority, updated_at = now() where id = p_id;
  perform public.adm_audit('support_ticket.priority', 'support_ticket', p_id,
                           jsonb_build_object('priority', v_old), jsonb_build_object('priority', p_priority), null);
end $$;

create or replace function public.assign_support_ticket(p_id uuid, p_admin_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old uuid;
begin
  perform public.adm_require_admin();
  if p_admin_id is not null
     and not exists (select 1 from public.profiles where id = p_admin_id and role in ('admin', 'super_admin')) then
    raise exception 'Assignee must be an admin.' using errcode = '22023';
  end if;
  select assigned_to into v_old from public.support_tickets where id = p_id for update;
  if not found then raise exception 'Support ticket not found.' using errcode = 'P0002'; end if;
  update public.support_tickets set assigned_to = p_admin_id, updated_at = now() where id = p_id;
  perform public.adm_audit('support_ticket.assign', 'support_ticket', p_id,
                           jsonb_build_object('assigned_to', v_old), jsonb_build_object('assigned_to', p_admin_id), null);
end $$;

-- p_internal = true writes an internal note (hidden from the submitter by the lead's is_internal flag).
create or replace function public.reply_support_ticket(p_id uuid, p_content text, p_internal boolean default false) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_reply uuid;
begin
  perform public.adm_require_admin();
  if nullif(btrim(coalesce(p_content, '')), '') is null then
    raise exception 'Reply is empty.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.support_tickets where id = p_id) then
    raise exception 'Support ticket not found.' using errcode = 'P0002';
  end if;
  insert into public.support_ticket_replies (ticket_id, author_id, content, is_internal)
  values (p_id, auth.uid(), left(btrim(p_content), 10000), coalesce(p_internal, false))
  returning id into v_reply;
  update public.support_tickets set updated_at = now() where id = p_id;
  perform public.adm_audit(case when coalesce(p_internal, false) then 'support_ticket.note' else 'support_ticket.reply' end,
                           'support_ticket', p_id, null, jsonb_build_object('reply_id', v_reply), null);
  return public.get_support_ticket(p_id);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_ticket_rows() from public, anon, authenticated;

revoke all on function public.get_support_ticket_stats() from public, anon;
revoke all on function public.list_support_tickets(text, text, text, text, uuid, text, int, int) from public, anon;
revoke all on function public.get_support_ticket(uuid) from public, anon;
revoke all on function public.set_support_ticket_status(uuid, text, text) from public, anon;
revoke all on function public.set_support_ticket_priority(uuid, text) from public, anon;
revoke all on function public.assign_support_ticket(uuid, uuid) from public, anon;
revoke all on function public.reply_support_ticket(uuid, text, boolean) from public, anon;

grant execute on function public.get_support_ticket_stats() to authenticated;
grant execute on function public.list_support_tickets(text, text, text, text, uuid, text, int, int) to authenticated;
grant execute on function public.get_support_ticket(uuid) to authenticated;
grant execute on function public.set_support_ticket_status(uuid, text, text) to authenticated;
grant execute on function public.set_support_ticket_priority(uuid, text) to authenticated;
grant execute on function public.assign_support_ticket(uuid, uuid) to authenticated;
grant execute on function public.reply_support_ticket(uuid, text, boolean) to authenticated;

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

rollback;
