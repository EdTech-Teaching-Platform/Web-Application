-- docs/trial_run.sql: trial for the STUDENT migrations only (20261026100000 .. 100400).
-- The 29 admin files (20261025*) are applied; the allowlist has its own trial
-- (docs/trial_run_20261026090000.sql). Paste all of this into the SQL editor and run:
-- expect "Success. No rows returned". Everything is rolled back.
begin;

-- >>> 20261026100000_student_preflight.sql <<<
-- =====================================================================
-- 20261026100000_student_preflight.sql
--
-- Purpose
--   Read-only preflight for the student test-series port
--   (20261026100100 .. 20261026100400). Collects EVERY problem in one pass
--   and raises a single error listing all of them:
--     1. lead and admin-port columns the student RPCs read or write;
--     2. Batch 1-2 helpers they call;
--     3. the lead's quiz_attempts.status CHECK must allow in_progress,
--        submitted and timed_out;
--     4. clashes: the new tables, every new function name (any overload), and
--        the two quiz_admin columns if they already exist with another type.
--
-- Lead objects read
--   information_schema.columns, pg_proc, pg_namespace, pg_constraint.
--
-- ROLLBACK
--   Nothing to roll back: no DDL, no data changes.
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare
  v_problems text[] := '{}';
  v_list     text[];
  v_def      text;
  v_type     text;
  r          record;
begin
  -- 1. Columns read or written by the student RPCs.
  select coalesce(array_agg(t.tbl || '.' || t.col order by t.tbl, t.col), '{}') into v_list
    from (values
      ('test_series', 'id'), ('test_series', 'course_id'), ('test_series', 'title'),
      ('test_series', 'description'), ('test_series', 'instructions'), ('test_series', 'is_published'),
      ('test_series', 'is_active'), ('test_series', 'available_from'), ('test_series', 'available_until'),
      ('test_series', 'created_at'),
      ('quizzes', 'id'), ('quizzes', 'course_id'), ('quizzes', 'series_id'), ('quizzes', 'title'),
      ('quizzes', 'description'), ('quizzes', 'time_limit_mins'), ('quizzes', 'max_attempts'),
      ('quizzes', 'passing_score'), ('quizzes', 'shuffle_questions'), ('quizzes', 'show_answers_after'),
      ('quizzes', 'is_proctored'), ('quizzes', 'series_sort_order'),
      ('quiz_questions', 'id'), ('quiz_questions', 'quiz_id'), ('quiz_questions', 'question_text'),
      ('quiz_questions', 'question_type'), ('quiz_questions', 'points'), ('quiz_questions', 'explanation'),
      ('quiz_questions', 'sort_order'), ('quiz_questions', 'created_at'),
      ('quiz_question_options', 'id'), ('quiz_question_options', 'question_id'),
      ('quiz_question_options', 'option_text'), ('quiz_question_options', 'is_correct'),
      ('quiz_question_options', 'sort_order'),
      ('quiz_attempts', 'id'), ('quiz_attempts', 'quiz_id'), ('quiz_attempts', 'student_id'),
      ('quiz_attempts', 'attempt_number'), ('quiz_attempts', 'score'), ('quiz_attempts', 'max_score'),
      ('quiz_attempts', 'percentage'), ('quiz_attempts', 'passed'), ('quiz_attempts', 'started_at'),
      ('quiz_attempts', 'submitted_at'), ('quiz_attempts', 'time_taken_secs'), ('quiz_attempts', 'status'),
      ('quiz_answers', 'id'), ('quiz_answers', 'attempt_id'), ('quiz_answers', 'question_id'),
      ('quiz_answers', 'answer_text'), ('quiz_answers', 'selected_option_ids'),
      ('quiz_answers', 'is_correct'), ('quiz_answers', 'points_earned'),
      ('profiles', 'id'), ('categories', 'id'), ('categories', 'name'),
      ('courses', 'id'), ('courses', 'category_id'),
      ('enrollments', 'student_id'), ('enrollments', 'course_id'), ('enrollments', 'is_active'),
      ('enrollments', 'enrolled_at'), ('enrollments', 'expiry_date'),
      ('test_series_admin', 'series_id'), ('test_series_admin', 'status'), ('test_series_admin', 'pricing'),
      ('test_series_admin', 'price_inr'), ('test_series_admin', 'subject_category_id'),
      ('test_series_admin', 'subject_label'), ('test_series_admin', 'level'), ('test_series_admin', 'exam'),
      ('test_series_admin', 'cover_path'), ('test_series_admin', 'access_days'),
      ('test_series_admin', 'deleted_at'),
      ('quiz_admin', 'quiz_id'), ('quiz_admin', 'status'), ('quiz_admin', 'shuffle_options'),
      ('quiz_admin', 'window_mode'), ('quiz_admin', 'open_at'), ('quiz_admin', 'close_at'),
      ('quiz_question_admin', 'question_id'), ('quiz_question_admin', 'admin_type'),
      ('quiz_question_admin', 'needs_manual_grading'), ('quiz_question_admin', 'negative_marks'),
      ('quiz_question_admin', 'difficulty'), ('quiz_question_admin', 'topic'),
      ('quiz_question_admin', 'section_id'), ('quiz_question_admin', 'image_path'),
      ('quiz_question_admin', 'answer_instructions'),
      ('test_sections', 'id'), ('test_sections', 'name'), ('test_sections', 'position'),
      ('admin_series_enrollments', 'series_id'), ('admin_series_enrollments', 'student_id'),
      ('admin_series_enrollments', 'enrolled_at'), ('admin_series_enrollments', 'expires_at'),
      ('admin_series_enrollments', 'amount_paid'), ('admin_series_enrollments', 'revoked_at')
    ) as t(tbl, col)
   where not exists (select 1 from information_schema.columns c
                      where c.table_schema = 'public' and c.table_name = t.tbl and c.column_name = t.col);
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing columns: ' || array_to_string(v_list, ', '));
  end if;

  -- quiz_answers.selected_option_ids must be an array (the RPCs write text[] into it).
  select data_type into v_type from information_schema.columns
   where table_schema = 'public' and table_name = 'quiz_answers' and column_name = 'selected_option_ids';
  if v_type is not null and v_type <> 'ARRAY' then
    v_problems := v_problems || ('quiz_answers.selected_option_ids is ' || v_type || ', expected an array');
  end if;

  -- 2. Batch 1-2 helpers.
  select coalesce(array_agg(x.sig order by x.sig), '{}') into v_list
    from unnest(array['public.adm_is_account_blocked(uuid)', 'public.adm_house_course_id()',
                      'public.adm_like(text)']) as x(sig)
   where to_regprocedure(x.sig) is null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing functions (Batches 1-2 not applied?): ' || array_to_string(v_list, ', '));
  end if;

  -- 3. quiz_attempts.status values.
  select string_agg(pg_get_constraintdef(co.oid), ' ') into v_def
    from pg_constraint co
   where co.conrelid = to_regclass('public.quiz_attempts') and co.contype = 'c'
     and pg_get_constraintdef(co.oid) ilike '%status%';
  if v_def is not null then
    foreach v_type in array array['in_progress', 'submitted', 'timed_out'] loop
      if position('''' || v_type || '''' in v_def) = 0 then
        v_problems := v_problems || ('quiz_attempts.status CHECK does not allow ' || v_type);
      end if;
    end loop;
  end if;

  -- 4a. Relation clashes.
  select coalesce(array_agg('public.' || x.name order by x.name), '{}') into v_list
    from unnest(array['attempt_proctor_events', 'attempt_reports']) as x(name)
   where to_regclass('public.' || x.name) is not null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('relations already exist: ' || array_to_string(v_list, ', '));
  end if;

  -- 4b. Function clashes: every overload of every new name.
  select coalesce(array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
                            order by p.proname), '{}') into v_list
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = any (array[
       -- internal helpers
       'adm_student_uid', 'adm_student_writer_uid', 'adm_student_series', 'adm_student_is_enrolled',
       'adm_live_series', 'adm_series_card', 'adm_attempt_deadline', 'adm_test_window',
       'adm_attempt_question_order', 'adm_report_bucket', 'adm_finalize_attempt',
       -- browser RPCs
       'student_list_series', 'student_get_series', 'student_enroll', 'student_my_series',
       'student_my_history', 'student_get_test_intro', 'student_start_attempt', 'student_save_answer',
       'student_log_proctor_event', 'student_submit_attempt', 'student_get_report', 'student_get_stats',
       'student_dashboard', 'public_list_series', 'public_get_series']);
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('functions already exist: ' || array_to_string(v_list, ', '));
  end if;

  -- 4c. quiz_admin columns that already exist with a different type.
  for r in select * from (values ('max_violations', 'integer'), ('instructions_extra', 'text')) as t(col, typ) loop
    select data_type into v_type from information_schema.columns
     where table_schema = 'public' and table_name = 'quiz_admin' and column_name = r.col;
    if v_type is not null and v_type <> r.typ then
      v_problems := v_problems || format('quiz_admin.%s exists as %s, expected %s', r.col, v_type, r.typ);
    end if;
  end loop;

  if cardinality(v_problems) > 0 then
    raise exception 'Student port preflight: % problem(s): %', cardinality(v_problems),
      array_to_string(v_problems, '; ');
  end if;
end $pre$;


-- >>> 20261026100100_student_tables.sql <<<
-- =====================================================================
-- 20261026100100_student_tables.sql
--
-- Purpose
--   Creates exam taking and proctoring support tables and extends our
--   own quiz_admin table:
--     1. attempt_proctor_events: stores client-side and server-side proctoring
--        events (tab switch, fullscreen exits, etc.). Reachable only via RPCs.
--     2. attempt_reports: snapshot of the final graded performance report
--        for completed quiz attempts. Reachable only via RPCs.
--     3. quiz_admin extension columns: max_violations (default 3),
--        instructions_extra (supplementary test instructions).
--
-- Lead tables referenced (FK targets only; nothing on them is altered)
--   public.quiz_attempts (id)
--
-- Assumptions & Safety
--   - Additive only: no modifications to lead tables.
--   - FKs to lead tables are ON DELETE CASCADE and indexed.
--   - RLS is enabled on new tables with no browser policies; access is
--     restricted to SECURITY DEFINER functions.
--   - Table privileges are explicitly revoked from anon and authenticated.
--
-- ROLLBACK
--   alter table if exists public.quiz_admin
--     drop column if exists instructions_extra,
--     drop column if exists max_violations;
--   drop table if exists public.attempt_reports;
--   drop table if exists public.attempt_proctor_events;   -- also drops its index
-- =====================================================================
set search_path = public, extensions;

-- -------------------------------------------------- attempt_proctor_events
create table if not exists public.attempt_proctor_events (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references public.quiz_attempts(id) on delete cascade,
  event_type   text not null,
  occurred_at  timestamptz not null default now(),
  meta         jsonb not null default '{}'::jsonb
);

-- Covers the FK (attempt_id is the leading column) and the per-attempt
-- violation count / debounce lookups.
create index if not exists attempt_proctor_events_attempt_idx
  on public.attempt_proctor_events (attempt_id, occurred_at);
comment on column public.attempt_proctor_events.meta is
  'Client details (truncated to 4 KB) plus "counted": whether the event counted as a violation.';

-- --------------------------------------------------------- attempt_reports
create table if not exists public.attempt_reports (
  attempt_id    uuid primary key references public.quiz_attempts(id) on delete cascade,
  report        jsonb not null,
  generated_at  timestamptz not null default now()
);

-- ----------------------------------------------------- quiz_admin columns
-- Add columns only to our own extension table.
alter table public.quiz_admin
  add column if not exists max_violations int not null default 3 check (max_violations >= 0),
  add column if not exists instructions_extra text;

-- --------------------------------------------------------------------- RLS
alter table public.attempt_proctor_events enable row level security;
alter table public.attempt_reports        enable row level security;

revoke all on table public.attempt_proctor_events from anon, authenticated;
revoke all on table public.attempt_reports        from anon, authenticated;


-- >>> 20261026100200_student_rpc_series.sql <<<
-- =====================================================================
-- 20261026100200_student_rpc_series.sql
--
-- Purpose
--   Student-side access to test series: internal helpers, the two anon
--   catalogue RPCs, and the student series RPCs.
--
--   Internal helpers (revoked from every browser role):
--     adm_student_uid()            caller of every student_* RPC (42501 if signed out)
--     adm_student_writer_uid()     + a profiles row and an unblocked account
--     adm_student_series(uuid)     a student's ACTIVE series access, one row per series:
--                                  direct (admin_series_enrollments, not revoked, not
--                                  expired) or through a lead course enrolment
--                                  (enrollments.is_active, not expired; never the
--                                  hidden house course)
--     adm_student_is_enrolled(uuid, uuid)
--     adm_live_series()            series a student may discover: published, active,
--                                  admin status published (or no admin row), not
--                                  deleted, availability not ended
--     adm_series_card(uuid, uuid)  the shared series JSON (see docs/STUDENT_RPC_CONTRACT.md)
--
--   Browser RPCs:
--     public_list_series(int), public_get_series(uuid)   anon + authenticated
--     student_list_series(text, uuid, int, int), student_get_series(uuid),
--     student_enroll(uuid), student_my_series()          authenticated
--
--   Admin-created series live on the hidden draft house course (B2-A1). They are
--   NOT visible in the lead's catalogue; these RPCs are the student path to them.
--
-- Security
--   SECURITY DEFINER, search_path = public, extensions. The student is always
--   auth.uid(), never a parameter. Tests and series are returned without
--   questions or answers.
--
-- Lead objects read
--   test_series, quizzes, quiz_questions, courses, categories, enrollments, profiles.
-- Lead objects written
--   None (enrolments go to our admin_series_enrollments).
--
-- ROLLBACK
--   drop function if exists public.student_my_series();
--   drop function if exists public.student_enroll(uuid);
--   drop function if exists public.student_get_series(uuid);
--   drop function if exists public.student_list_series(text, uuid, int, int);
--   drop function if exists public.public_get_series(uuid);
--   drop function if exists public.public_list_series(int);
--   drop function if exists public.adm_series_card(uuid, uuid);
--   drop function if exists public.adm_live_series();
--   drop function if exists public.adm_student_is_enrolled(uuid, uuid);
--   drop function if exists public.adm_student_series(uuid);
--   drop function if exists public.adm_student_writer_uid();
--   drop function if exists public.adm_student_uid();
-- =====================================================================
set search_path = public, extensions;

-- ================================================================ helpers
create or replace function public.adm_student_uid() returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to continue.' using errcode = '42501';
  end if;
  return v_uid;
end $$;

-- Writers need a profile (quiz_attempts.student_id references profiles) and
-- an account that is not blocked by an admin.
create or replace function public.adm_student_writer_uid() returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := public.adm_student_uid();
begin
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'Your profile is not set up yet. Sign out and sign in again.' using errcode = 'P0001';
  end if;
  if public.adm_is_account_blocked(v_uid) then
    raise exception 'Your account is blocked. Contact support.' using errcode = '42501';
  end if;
  return v_uid;
end $$;

create or replace function public.adm_student_series(p_student uuid)
returns table (series_id uuid, enrolled_at timestamptz, expires_at timestamptz, source text)
language sql stable security definer set search_path = public, extensions as $$
  select distinct on (x.sid) x.sid, x.enrolled_at, x.expires_at, x.source
    from (
      select e.series_id as sid, e.enrolled_at, e.expires_at, 'direct'::text as source
        from public.admin_series_enrollments e
       where e.student_id = p_student
         and e.revoked_at is null
         and (e.expires_at is null or e.expires_at > now())
      union all
      select s.id, en.enrolled_at, en.expiry_date, 'course'::text
        from public.enrollments en
        join public.test_series s on s.course_id = en.course_id
       where en.student_id = p_student
         and en.is_active
         and (en.expiry_date is null or en.expiry_date > now())
         and s.course_id is distinct from public.adm_house_course_id()
    ) x
   order by x.sid, x.enrolled_at;
$$;

create or replace function public.adm_student_is_enrolled(p_series_id uuid, p_student_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.adm_student_series(p_student_id) a where a.series_id = p_series_id);
$$;

create or replace function public.adm_live_series() returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select s.id
    from public.test_series s
    left join public.test_series_admin sa on sa.series_id = s.id
   where s.is_published
     and s.is_active
     and coalesce(sa.status, 'published') = 'published'
     and sa.deleted_at is null
     and (s.available_until is null or s.available_until > now());
$$;

-- Shared series JSON. p_student null = public view (no enrolment keys).
-- Counts cover published tests only (quiz_admin.status, or no admin row).
create or replace function public.adm_series_card(p_series_id uuid, p_student uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', s.id,
           'title', s.title,
           'description', s.description,
           'subject', coalesce(cat.name, sa.subject_label),
           'category_id', cat.id,
           'level', sa.level,
           'exam', sa.exam,
           'pricing', coalesce(sa.pricing, 'free'),
           'price_inr', coalesce(sa.price_inr, 0),
           'is_free', coalesce(sa.pricing, 'free') = 'free' or coalesce(sa.price_inr, 0) = 0,
           'cover_path', sa.cover_path,
           'available_from', s.available_from,
           'available_until', s.available_until,
           'access_days', sa.access_days,
           'tests_count', coalesce(t.cnt, 0),
           'questions_count', coalesce(t.questions, 0),
           'total_duration_mins', coalesce(t.mins, 0))
         || case when p_student is null then '{}'::jsonb else jsonb_build_object(
           'is_enrolled', public.adm_student_is_enrolled(s.id, p_student),
           'attempts_count', (select count(*) from public.quiz_attempts a
                                join public.quizzes q on q.id = a.quiz_id
                               where q.series_id = s.id and a.student_id = p_student)) end
    from public.test_series s
    left join public.test_series_admin sa on sa.series_id = s.id
    left join public.courses c on c.id = s.course_id
    left join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
    left join lateral (
      select count(*) as cnt, sum(q.time_limit_mins) as mins, sum(qc.n) as questions
        from public.quizzes q
        left join public.quiz_admin qa on qa.quiz_id = q.id
        left join lateral (select count(*) as n from public.quiz_questions qq where qq.quiz_id = q.id) qc on true
       where q.series_id = s.id and coalesce(qa.status, 'published') = 'published'
    ) t on true
   where s.id = p_series_id;
$$;

-- ============================================================ anon catalogue
create or replace function public.public_list_series(p_limit int default 10) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(public.adm_series_card(s.id, null) order by s.created_at desc, s.id), '[]'::jsonb)
    from (select s.id, s.created_at
            from public.test_series s
           where s.id in (select public.adm_live_series())
           order by s.created_at desc, s.id
           limit least(greatest(coalesce(p_limit, 10), 1), 50)) s;
$$;

create or replace function public.public_get_series(p_series_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_card jsonb;
begin
  if p_series_id is null or p_series_id not in (select public.adm_live_series()) then
    raise exception 'Test series not found.' using errcode = 'P0002';
  end if;
  v_card := public.adm_series_card(p_series_id, null);
  return v_card || jsonb_build_object(
    'instructions', (select instructions from public.test_series where id = p_series_id),
    'tests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'title', q.title, 'description', q.description,
               'position', q.series_sort_order, 'time_limit_mins', q.time_limit_mins,
               'questions_count', (select count(*) from public.quiz_questions qq where qq.quiz_id = q.id),
               'total_marks', (select coalesce(sum(qq.points), 0) from public.quiz_questions qq where qq.quiz_id = q.id),
               'max_attempts', q.max_attempts, 'passing_percentage', q.passing_score)
             order by q.series_sort_order, q.created_at, q.id)
        from public.quizzes q
        left join public.quiz_admin qa on qa.quiz_id = q.id
       where q.series_id = p_series_id and coalesce(qa.status, 'published') = 'published'), '[]'::jsonb));
end $$;

-- ============================================================ student series
create or replace function public.student_list_series(
  p_search   text default null,
  p_category uuid default null,
  p_page     int  default 1,
  p_size     int  default 12
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := public.adm_student_uid();
  v_like   text := public.adm_like(p_search);
  v_page   int  := greatest(coalesce(p_page, 1), 1);
  v_size   int  := least(greatest(coalesce(p_size, 12), 1), 50);
  v_total  int := 0;
  v_items  jsonb;
begin
  with matches as (
    select s.id, s.created_at
      from public.test_series s
      left join public.test_series_admin sa on sa.series_id = s.id
      left join public.courses c on c.id = s.course_id
      left join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
     where s.id in (select l.id from public.adm_live_series() l(id))
       and (p_category is null or cat.id = p_category)
       and (v_like is null or s.title ilike v_like or s.description ilike v_like
            or sa.subject_label ilike v_like or sa.exam ilike v_like or cat.name ilike v_like)
  ), page as (
    select m.id, m.created_at, count(*) over () as total
      from matches m
     order by m.created_at desc, m.id
     limit v_size offset (v_page - 1) * v_size
  )
  select coalesce(jsonb_agg(public.adm_series_card(p.id, v_uid) order by p.created_at desc, p.id), '[]'::jsonb),
         coalesce(max(p.total), 0)
    into v_items, v_total
    from page p;

  -- A page past the end has no rows to carry the window count.
  if v_total = 0 then
    select count(*) into v_total
      from public.test_series s
      left join public.test_series_admin sa on sa.series_id = s.id
      left join public.courses c on c.id = s.course_id
      left join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
     where s.id in (select l.id from public.adm_live_series() l(id))
       and (p_category is null or cat.id = p_category)
       and (v_like is null or s.title ilike v_like or s.description ilike v_like
            or sa.subject_label ilike v_like or sa.exam ilike v_like or cat.name ilike v_like);
  end if;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'size', v_size,
    'total_pages', greatest(ceil(v_total::numeric / v_size)::int, 1),
    'categories', coalesce((
      select jsonb_agg(distinct jsonb_build_object('id', cat.id, 'name', cat.name))
        from public.test_series s
        left join public.test_series_admin sa on sa.series_id = s.id
        left join public.courses c on c.id = s.course_id
        join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
       where s.id in (select public.adm_live_series())), '[]'::jsonb));
end $$;

-- Visible when the series is live, or when the caller is enrolled (so an
-- enrolled student keeps read access after the series ends).
create or replace function public.student_get_series(p_series_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := public.adm_student_uid();
  v_access record;
begin
  select a.* into v_access from public.adm_student_series(v_uid) a where a.series_id = p_series_id;
  if p_series_id is null
     or not (p_series_id in (select public.adm_live_series())
             or (v_access.series_id is not null and exists (
                   select 1 from public.test_series s
                     left join public.test_series_admin sa on sa.series_id = s.id
                    where s.id = p_series_id and s.is_active and sa.deleted_at is null))) then
    raise exception 'Test series not found.' using errcode = 'P0002';
  end if;

  return public.adm_series_card(p_series_id, v_uid) || jsonb_build_object(
    'instructions', (select instructions from public.test_series where id = p_series_id),
    'enrollment', case when v_access.series_id is null then null else jsonb_build_object(
                    'enrolled_at', v_access.enrolled_at, 'expires_at', v_access.expires_at,
                    'source', v_access.source) end,
    'tests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'title', q.title, 'description', q.description,
               'position', q.series_sort_order, 'time_limit_mins', q.time_limit_mins,
               'is_proctored', q.is_proctored,
               'questions_count', st.questions, 'total_marks', st.marks,
               'passing_percentage', q.passing_score,
               'opens_at', w.opens_at, 'closes_at', w.closes_at,
               'attempts_used', coalesce(att.used, 0),
               'attempts_allowed', q.max_attempts,
               'attempts_remaining', greatest(q.max_attempts - coalesce(att.used, 0), 0),
               'best_score', att.best_score,
               'best_percentage', att.best_pct,
               'passed', coalesce(att.passed, false),
               'latest_attempt_id', att.latest_id,
               'latest_status', att.latest_status,
               'in_progress_attempt_id', att.in_progress_id)
             order by q.series_sort_order, q.created_at, q.id)
        from public.quizzes q
        left join public.quiz_admin qa on qa.quiz_id = q.id
        cross join lateral public.adm_test_window(q.id) w
        cross join lateral (select count(*) as questions, coalesce(sum(qq.points), 0) as marks
                              from public.quiz_questions qq where qq.quiz_id = q.id) st
        left join lateral (
          select count(*) as used,
                 max(a.score) filter (where a.status in ('submitted', 'timed_out')) as best_score,
                 max(a.percentage) filter (where a.status in ('submitted', 'timed_out')) as best_pct,
                 bool_or(a.passed) as passed,
                 (array_agg(a.id order by a.started_at desc))[1] as latest_id,
                 (array_agg(a.status order by a.started_at desc))[1] as latest_status,
                 (array_agg(a.id order by a.started_at desc) filter (where a.status = 'in_progress'))[1] as in_progress_id
            from public.quiz_attempts a
           where a.quiz_id = q.id and a.student_id = v_uid
        ) att on true
       where q.series_id = p_series_id and coalesce(qa.status, 'published') = 'published'), '[]'::jsonb));
end $$;

-- Idempotent. Free series: direct enrolment (expires after access_days when
-- set). Paid series: STUB: needs payments model (F4) -> 0A000.
create or replace function public.student_enroll(p_series_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := public.adm_student_writer_uid();
  v_pricing text;
  v_price   numeric;
  v_days    int;
  v_access  record;
begin
  if p_series_id is null or p_series_id not in (select public.adm_live_series()) then
    raise exception 'Test series not found.' using errcode = 'P0002';
  end if;

  select a.* into v_access from public.adm_student_series(v_uid) a where a.series_id = p_series_id;
  if v_access.series_id is not null then
    return jsonb_build_object('series_id', p_series_id, 'enrolled', true, 'already_enrolled', true,
                              'enrolled_at', v_access.enrolled_at, 'expires_at', v_access.expires_at);
  end if;

  if exists (select 1 from public.admin_series_enrollments
              where series_id = p_series_id and student_id = v_uid and revoked_at is not null) then
    raise exception 'Your access to this series was revoked. Contact support.' using errcode = '42501';
  end if;

  select coalesce(sa.pricing, 'free'), coalesce(sa.price_inr, 0), sa.access_days
    into v_pricing, v_price, v_days
    from public.test_series s left join public.test_series_admin sa on sa.series_id = s.id
   where s.id = p_series_id;

  if v_pricing = 'paid' and v_price > 0 then
    -- STUB: needs payments model (F4)
    raise exception 'Paid test series cannot be bought yet.' using errcode = '0A000';
  end if;

  -- An expired direct enrolment is renewed; a revoked one was refused above.
  insert into public.admin_series_enrollments (series_id, student_id, enrolled_at, expires_at, amount_paid)
  values (p_series_id, v_uid, now(), case when v_days is not null then now() + make_interval(days => v_days) end, 0)
  on conflict (series_id, student_id) do update
     set enrolled_at = excluded.enrolled_at, expires_at = excluded.expires_at
   where admin_series_enrollments.revoked_at is null;

  return jsonb_build_object('series_id', p_series_id, 'enrolled', true, 'already_enrolled', false,
                            'enrolled_at', now(),
                            'expires_at', case when v_days is not null then now() + make_interval(days => v_days) end);
end $$;

-- Enrolled series (active access only) with progress over published tests.
create or replace function public.student_my_series() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := public.adm_student_uid();
begin
  return (
  select coalesce(jsonb_agg(
           public.adm_series_card(a.series_id, v_uid) || jsonb_build_object(
             'enrolled_at', a.enrolled_at,
             'expires_at', a.expires_at,
             'source', a.source,
             'tests_attempted', coalesce(p.tests_attempted, 0),
             'progress_percentage', case when coalesce(t.cnt, 0) = 0 then 0
                                         else round(coalesce(p.tests_attempted, 0) * 100.0 / t.cnt, 1) end,
             'best_score', p.best_score,
             'best_percentage', p.best_pct,
             'latest_score', p.latest_score,
             'latest_percentage', p.latest_pct,
             'latest_attempt_at', p.latest_at)
           order by a.enrolled_at desc, a.series_id), '[]'::jsonb)
    from public.adm_student_series(v_uid) a
    join public.test_series s on s.id = a.series_id and s.is_active
    left join public.test_series_admin sa on sa.series_id = s.id
    left join lateral (
      select count(*) as cnt from public.quizzes q
        left join public.quiz_admin qa on qa.quiz_id = q.id
       where q.series_id = s.id and coalesce(qa.status, 'published') = 'published'
    ) t on true
    left join lateral (
      select count(distinct att.quiz_id) as tests_attempted,
             max(att.score) as best_score,
             max(att.percentage) as best_pct,
             (array_agg(att.score order by att.submitted_at desc nulls last))[1] as latest_score,
             (array_agg(att.percentage order by att.submitted_at desc nulls last))[1] as latest_pct,
             max(att.submitted_at) as latest_at
        from public.quiz_attempts att
        join public.quizzes q on q.id = att.quiz_id
       where q.series_id = s.id
         and att.student_id = v_uid
         and att.status in ('submitted', 'timed_out')
    ) p on true
   where sa.deleted_at is null);
end $$;

-- ================================================================== grants
revoke all on function public.adm_student_uid() from public, anon, authenticated;
revoke all on function public.adm_student_writer_uid() from public, anon, authenticated;
revoke all on function public.adm_student_series(uuid) from public, anon, authenticated;
revoke all on function public.adm_student_is_enrolled(uuid, uuid) from public, anon, authenticated;
revoke all on function public.adm_live_series() from public, anon, authenticated;
revoke all on function public.adm_series_card(uuid, uuid) from public, anon, authenticated;

revoke all on function public.public_list_series(int) from public;
grant execute on function public.public_list_series(int) to anon, authenticated;
revoke all on function public.public_get_series(uuid) from public;
grant execute on function public.public_get_series(uuid) to anon, authenticated;

revoke all on function public.student_list_series(text, uuid, int, int) from public, anon;
grant execute on function public.student_list_series(text, uuid, int, int) to authenticated;
revoke all on function public.student_get_series(uuid) from public, anon;
grant execute on function public.student_get_series(uuid) to authenticated;
revoke all on function public.student_enroll(uuid) from public, anon;
grant execute on function public.student_enroll(uuid) to authenticated;
revoke all on function public.student_my_series() from public, anon;
grant execute on function public.student_my_series() to authenticated;


-- >>> 20261026100300_student_rpc_exam.sql <<<
-- =====================================================================
-- 20261026100300_student_rpc_exam.sql
--
-- Purpose
--   Taking a test: intro, start / resume, autosave, proctoring, server-side
--   scoring, the stored report.
--
--   Internal helpers (revoked from every browser role):
--     adm_attempt_deadline(timestamptz, int)  started_at + time limit (null = untimed)
--     adm_test_window(uuid)                   opens_at / closes_at: the series
--                                             availability window, narrowed by a custom
--                                             quiz_admin window
--     adm_attempt_question_order(uuid)        question order for one attempt: shuffled
--                                             deterministically per attempt when
--                                             quizzes.shuffle_questions, else sort_order
--     adm_finalize_attempt(uuid, text)        grades an in_progress attempt, writes
--                                             quiz_answers + quiz_attempts, stores the
--                                             report snapshot, returns it
--
--   Browser RPCs (authenticated): student_get_test_intro, student_start_attempt,
--   student_save_answer, student_log_proctor_event, student_submit_attempt,
--   student_get_report.
--
-- Rules
--   * Questions are returned without correct answers. Options are returned only
--     for multiple_choice / true_false: for fill_in_blank and short_answer the
--     options ARE the accepted / model answers.
--   * Deadline = started_at + quizzes.time_limit_mins, on the server clock.
--     Saves get a 10-second grace for network latency; a submit more than
--     15 seconds after the deadline is recorded as timed_out.
--   * Scoring (adm_finalize_attempt): points = quiz_questions.points; wrong
--     answers lose quiz_question_admin.negative_marks (default 0); unanswered = 0,
--     no penalty. multiple_choice / true_false: the selected set must equal the
--     correct set (all-or-nothing). fill_in_blank: trimmed, case-insensitive match
--     against any is_correct option. short_answer (incl. long answer / subjective)
--     or needs_manual_grading: "pending", not scored and left out of max_score /
--     percentage until graded. passed = percentage >= quizzes.passing_score.
--   * Correct answers and explanations in the report follow the lead's
--     quizzes.show_answers_after: 'submission' = always, 'passing' = only when
--     passed, 'never' = hidden.
--   * Proctoring: events in the violation list count, except one arriving
--     within 3 seconds of the previous counted one (a tab switch fires both
--     blur and visibilitychange). Violations > quiz_admin.max_violations
--     (default 3) auto-submit the attempt.
--
-- Lead objects written
--   quiz_attempts (insert; score, max_score, percentage, passed, submitted_at,
--   time_taken_secs, status), quiz_answers (insert / update / delete own rows).
--
-- ROLLBACK
--   drop function if exists public.student_get_report(uuid);
--   drop function if exists public.student_submit_attempt(uuid);
--   drop function if exists public.student_log_proctor_event(uuid, text, jsonb);
--   drop function if exists public.student_save_answer(uuid, uuid, jsonb);
--   drop function if exists public.student_start_attempt(uuid);
--   drop function if exists public.student_get_test_intro(uuid);
--   drop function if exists public.adm_finalize_attempt(uuid, text);
--   drop function if exists public.adm_report_bucket(jsonb);
--   drop function if exists public.adm_attempt_question_order(uuid);
--   drop function if exists public.adm_test_window(uuid);
--   drop function if exists public.adm_attempt_deadline(timestamptz, int);
-- =====================================================================
set search_path = public, extensions;

-- ================================================================ helpers
create or replace function public.adm_attempt_deadline(p_started_at timestamptz, p_minutes int) returns timestamptz
language sql immutable set search_path = public, extensions as $$
  select case when coalesce(p_minutes, 0) > 0 then p_started_at + make_interval(mins => p_minutes) end;
$$;

create or replace function public.adm_test_window(p_test_id uuid)
returns table (opens_at timestamptz, closes_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select greatest(s.available_from, case when qa.window_mode = 'custom' then qa.open_at end),
         least(s.available_until, case when qa.window_mode = 'custom' then qa.close_at end)
    from public.quizzes q
    left join public.test_series s on s.id = q.series_id
    left join public.quiz_admin qa on qa.quiz_id = q.id
   where q.id = p_test_id;
$$;

create or replace function public.adm_attempt_question_order(p_attempt_id uuid)
returns table (question_id uuid, seq int)
language sql stable security definer set search_path = public, extensions as $$
  select qq.id,
         (row_number() over (order by case when q.shuffle_questions then md5(a.id::text || qq.id::text) end,
                                      qq.sort_order, qq.created_at, qq.id))::int
    from public.quiz_attempts a
    join public.quizzes q on q.id = a.quiz_id
    join public.quiz_questions qq on qq.quiz_id = q.id
   where a.id = p_attempt_id;
$$;

-- One breakdown bucket from graded report rows (a jsonb array). accuracy =
-- correct / graded answers (pending and skipped are not graded answers).
create or replace function public.adm_report_bucket(p_rows jsonb) returns jsonb
language sql immutable set search_path = public, extensions as $$
  select jsonb_build_object(
           'total', count(*),
           'attempted', count(*) filter (where r ->> 'status' <> 'skipped'),
           'correct', count(*) filter (where r ->> 'status' = 'correct'),
           'incorrect', count(*) filter (where r ->> 'status' = 'incorrect'),
           'skipped', count(*) filter (where r ->> 'status' = 'skipped'),
           'pending', count(*) filter (where r ->> 'status' = 'pending'),
           'graded', count(*) filter (where r ->> 'status' in ('correct', 'incorrect')),
           'accuracy', coalesce(round(count(*) filter (where r ->> 'status' = 'correct') * 100.0
                                      / nullif(count(*) filter (where r ->> 'status' in ('correct', 'incorrect')), 0), 1), 0),
           'marks_earned', coalesce(sum((r ->> 'points_earned')::numeric), 0),
           'marks_possible', coalesce(sum((r ->> 'points')::numeric) filter (where r ->> 'status' <> 'pending'), 0))
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
$$;

-- Grades an in_progress attempt and stores the report. No auth check: callers
-- (student_submit_attempt, student_log_proctor_event, student_start_attempt,
-- student_get_report) verify ownership first. p_reason: 'student' | 'proctor_limit'
-- | 'time_up'. Returns the stored report if one exists; refuses attempts that
-- were finished outside this port (no report, not in_progress) rather than
-- regrading them.
create or replace function public.adm_finalize_attempt(p_attempt_id uuid, p_reason text default 'student')
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_att        record;
  v_quiz       record;
  v_report     jsonb;
  v_deadline   timestamptz;
  v_status     text;
  v_end        timestamptz;
  v_reveal     boolean;
  v_rows       jsonb := '[]'::jsonb;
  v_row        jsonb;
  q            record;
  v_ans        record;
  v_sel        text[];
  v_correct    text[];
  v_state      text;
  v_earned     numeric;
  v_score      numeric := 0;
  v_max        numeric := 0;
  v_total      numeric := 0;
  v_pct        numeric := 0;
  v_passed     boolean;
  v_pending    int := 0;
  v_violations int;
  v_limit      int;
  v_cmp        record;
  v_rank       int;
  v_lower      int;
begin
  select a.* into v_att from public.quiz_attempts a where a.id = p_attempt_id for update;
  if v_att.id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  select r.report into v_report from public.attempt_reports r where r.attempt_id = p_attempt_id;
  if v_report is not null then
    return v_report;
  end if;
  if v_att.status <> 'in_progress' then
    raise exception 'No detailed report is available for this attempt.' using errcode = 'P0002';
  end if;

  select q2.id, q2.title, q2.time_limit_mins, q2.passing_score, q2.show_answers_after, q2.series_id,
         s.title as series_title, coalesce(qa.max_violations, 3) as max_violations
    into v_quiz
    from public.quizzes q2
    left join public.quiz_admin qa on qa.quiz_id = q2.id
    left join public.test_series s on s.id = q2.series_id
   where q2.id = v_att.quiz_id;

  v_deadline := public.adm_attempt_deadline(v_att.started_at, v_quiz.time_limit_mins);
  if v_deadline is not null and now() > v_deadline + interval '15 seconds' then
    v_status := 'timed_out';
    v_end    := v_deadline;
  else
    v_status := 'submitted';
    v_end    := least(now(), coalesce(v_deadline, now()));
  end if;

  select count(*) into v_violations
    from public.attempt_proctor_events e
   where e.attempt_id = p_attempt_id and coalesce((e.meta ->> 'counted')::boolean, false);
  v_limit := v_quiz.max_violations;

  -- ------------------------------------------------------------- grading
  for q in
    select o.seq as position, qq.id, qq.question_text, qq.question_type, qq.points, qq.explanation,
           qqa.admin_type,
           coalesce(qqa.negative_marks, 0) as negative_marks,
           coalesce(qqa.needs_manual_grading, false) or qq.question_type = 'short_answer' as manual,
           coalesce(nullif(btrim(qqa.topic), ''), 'General') as topic,
           coalesce(qqa.difficulty, 'unrated') as difficulty,
           coalesce(sec.name, 'General') as section,
           coalesce(sec.position, 0) as section_position
      from public.adm_attempt_question_order(p_attempt_id) o
      join public.quiz_questions qq on qq.id = o.question_id
      left join public.quiz_question_admin qqa on qqa.question_id = qq.id
      left join public.test_sections sec on sec.id = qqa.section_id
     order by o.seq
  loop
    v_total := v_total + q.points;

    select ans.id, ans.answer_text,
           (select array_agg(distinct x::text) from unnest(ans.selected_option_ids) x) as sel
      into v_ans
      from public.quiz_answers ans
     where ans.attempt_id = p_attempt_id and ans.question_id = q.id
     order by ans.created_at desc
     limit 1;
    v_sel := coalesce(v_ans.sel, '{}');

    select coalesce(array_agg(o.id::text), '{}') into v_correct
      from public.quiz_question_options o where o.question_id = q.id and o.is_correct;

    if cardinality(v_sel) = 0 and nullif(btrim(coalesce(v_ans.answer_text, '')), '') is null then
      v_state := 'skipped';  v_earned := 0;
    elsif q.manual then
      v_state := 'pending';  v_earned := null;
    elsif q.question_type in ('multiple_choice', 'true_false') then
      v_state := case when cardinality(v_correct) > 0 and v_sel @> v_correct and v_correct @> v_sel
                      then 'correct' else 'incorrect' end;
    elsif q.question_type = 'fill_in_blank' then
      v_state := case when exists (select 1 from public.quiz_question_options o
                                    where o.question_id = q.id and o.is_correct
                                      and lower(btrim(o.option_text)) = lower(btrim(v_ans.answer_text)))
                      then 'correct' else 'incorrect' end;
    else
      v_state := 'pending';  v_earned := null;   -- unknown type: leave for a human
    end if;

    if v_state = 'correct' then
      v_earned := q.points;
    elsif v_state = 'incorrect' then
      v_earned := -q.negative_marks;
    end if;

    if v_state = 'pending' then
      v_pending := v_pending + 1;
    else
      v_max   := v_max + q.points;
      v_score := v_score + v_earned;
    end if;

    -- quiz_answers: one graded row per question (skipped rows record 0).
    if v_ans.id is not null then
      update public.quiz_answers
         set is_correct = case v_state when 'correct' then true when 'pending' then null else false end,
             points_earned = v_earned
       where id = v_ans.id;
    else
      insert into public.quiz_answers (attempt_id, question_id, is_correct, points_earned)
      values (p_attempt_id, q.id, false, 0);
    end if;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'position', q.position,
      'question_id', q.id,
      'text', q.question_text,
      'type', q.question_type,
      'ui_type', coalesce(q.admin_type, q.question_type),
      'section', q.section,
      'section_position', q.section_position,
      'topic', q.topic,
      'difficulty', q.difficulty,
      'status', v_state,
      'student_answer', case when cardinality(v_sel) > 0 then
                          (select string_agg(o.option_text, ', ' order by o.sort_order, o.id)
                             from public.quiz_question_options o
                            where o.question_id = q.id and o.id::text = any (v_sel))
                        else nullif(btrim(coalesce(v_ans.answer_text, '')), '') end,
      'selected_option_ids', to_jsonb(v_sel),
      '_correct_answer', case
                           when q.question_type in ('multiple_choice', 'true_false') then
                             (select string_agg(o.option_text, ', ' order by o.sort_order, o.id)
                                from public.quiz_question_options o where o.question_id = q.id and o.is_correct)
                           when q.question_type = 'fill_in_blank' then
                             (select string_agg(o.option_text, ' / ' order by o.sort_order, o.id)
                                from public.quiz_question_options o where o.question_id = q.id and o.is_correct)
                           else
                             (select string_agg(o.option_text, ' / ' order by o.sort_order, o.id)
                                from public.quiz_question_options o
                               where o.question_id = q.id and o.is_correct
                                 and o.option_text <> 'Manual grading: see rubric')
                         end,
      '_options', case when q.question_type in ('multiple_choice', 'true_false') then
                    (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'text', o.option_text,
                                                                  'selected', o.id::text = any (v_sel),
                                                                  'is_correct', o.is_correct)
                                               order by o.sort_order, o.id), '[]'::jsonb)
                       from public.quiz_question_options o where o.question_id = q.id)
                  else '[]'::jsonb end,
      'points', q.points,
      'negative_marks', q.negative_marks,
      'points_earned', v_earned,
      '_explanation', q.explanation,
      'time_spent_secs', null));
  end loop;

  v_pct    := case when v_max > 0 then greatest(round(v_score * 100.0 / v_max, 2), 0) else 0 end;
  v_passed := v_pct >= coalesce(v_quiz.passing_score, 0);
  v_reveal := case coalesce(v_quiz.show_answers_after, 'submission')
                when 'never' then false when 'passing' then v_passed else true end;

  update public.quiz_attempts
     set status = v_status,
         score = v_score,
         max_score = v_max,
         percentage = v_pct,
         passed = v_passed,
         submitted_at = v_end,
         time_taken_secs = greatest(extract(epoch from (v_end - v_att.started_at))::int, 0)
   where id = p_attempt_id;

  -- Comparison with every finished attempt of this test (this one included).
  -- Aggregates only: no other student's identity is read into the report.
  select count(*) as n, round(avg(a.percentage), 2) as avg_pct, max(a.percentage) as top_pct,
         round(avg(a.score), 2) as avg_score, max(a.score) as top_score
    into v_cmp
    from public.quiz_attempts a
   where a.quiz_id = v_att.quiz_id and a.status in ('submitted', 'timed_out') and a.percentage is not null;
  select count(*) filter (where a.percentage > v_pct) + 1, count(*) filter (where a.percentage < v_pct)
    into v_rank, v_lower
    from public.quiz_attempts a
   where a.quiz_id = v_att.quiz_id and a.status in ('submitted', 'timed_out') and a.percentage is not null;

  -- Breakdowns over the graded rows.
  v_report := jsonb_build_object(
    'version', 1,
    'attempt_id', p_attempt_id,
    'test_id', v_quiz.id,
    'test_title', v_quiz.title,
    'series_id', v_quiz.series_id,
    'series_title', v_quiz.series_title,
    'summary', jsonb_build_object(
      'status', v_status,
      'attempt_number', v_att.attempt_number,
      'started_at', v_att.started_at,
      'submitted_at', v_end,
      'time_taken_secs', greatest(extract(epoch from (v_end - v_att.started_at))::int, 0),
      'time_limit_mins', v_quiz.time_limit_mins,
      'score', v_score,
      'max_score', v_max,
      'total_marks', v_total,
      'percentage', v_pct,
      'passing_percentage', v_quiz.passing_score,
      'passed', v_passed,
      'provisional', v_pending > 0,
      'correct_count', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'status' = 'correct'),
      'incorrect_count', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'status' = 'incorrect'),
      'skipped_count', (select count(*) from jsonb_array_elements(v_rows) r where r ->> 'status' = 'skipped'),
      'pending_count', v_pending,
      'pending_marks', (select coalesce(sum((r ->> 'points')::numeric), 0) from jsonb_array_elements(v_rows) r
                         where r ->> 'status' = 'pending'),
      'rank', v_rank,
      'total_attempts', v_cmp.n,
      'percentile', case when v_cmp.n > 1 then round(v_lower * 100.0 / (v_cmp.n - 1), 1) else 100 end,
      'class_average', coalesce(v_cmp.avg_pct, 0),
      'topper_percentage', coalesce(v_cmp.top_pct, 0),
      'violations_count', v_violations,
      'violation_limit', v_limit,
      'auto_submitted', p_reason in ('proctor_limit', 'time_up') or v_status = 'timed_out',
      'auto_submit_reason', case when p_reason = 'proctor_limit' then 'proctor_limit'
                                 when p_reason = 'time_up' or v_status = 'timed_out' then 'time_up' end,
      'answers_hidden', not v_reveal),
    'questions', (select coalesce(jsonb_agg(
                    (r - '_correct_answer' - '_options' - '_explanation') || jsonb_build_object(
                      'correct_answer', case when v_reveal then r -> '_correct_answer' else 'null'::jsonb end,
                      'explanation', case when v_reveal then r -> '_explanation' else 'null'::jsonb end,
                      'options', case when v_reveal then r -> '_options'
                                      else (select coalesce(jsonb_agg(o - 'is_correct'), '[]'::jsonb)
                                              from jsonb_array_elements(r -> '_options') o) end)
                    order by (r ->> 'position')::int), '[]'::jsonb)
                    from jsonb_array_elements(v_rows) r),
    'breakdowns', jsonb_build_object(
      'by_section', (select coalesce(jsonb_agg(b order by (b ->> 'position')::int, b ->> 'name'), '[]'::jsonb) from (
                       select jsonb_build_object('name', r ->> 'section', 'position', min((r ->> 'section_position')::int))
                              || public.adm_report_bucket(jsonb_agg(r)) as b
                         from jsonb_array_elements(v_rows) r group by r ->> 'section') x),
      'by_topic', (select coalesce(jsonb_agg(b order by b ->> 'name'), '[]'::jsonb) from (
                     select jsonb_build_object('name', r ->> 'topic') || public.adm_report_bucket(jsonb_agg(r)) as b
                       from jsonb_array_elements(v_rows) r group by r ->> 'topic') x),
      'by_difficulty', (select coalesce(jsonb_agg(b order by case b ->> 'name' when 'easy' then 1 when 'medium' then 2
                                                                                 when 'hard' then 3 else 4 end), '[]'::jsonb) from (
                          select jsonb_build_object('name', r ->> 'difficulty') || public.adm_report_bucket(jsonb_agg(r)) as b
                            from jsonb_array_elements(v_rows) r group by r ->> 'difficulty') x)),
    'comparison', jsonb_build_object(
      'your_percentage', v_pct,
      'average_percentage', coalesce(v_cmp.avg_pct, 0),
      'topper_percentage', coalesce(v_cmp.top_pct, 0),
      'your_score', v_score,
      'average_score', coalesce(v_cmp.avg_score, 0),
      'topper_score', coalesce(v_cmp.top_score, 0),
      'difference_from_average', round(v_pct - coalesce(v_cmp.avg_pct, 0), 2),
      'difference_from_topper', round(v_pct - coalesce(v_cmp.top_pct, 0), 2)));

  -- Strengths / weaknesses: topics with at least one graded answer.
  v_report := v_report || jsonb_build_object(
    'strengths', (select coalesce(jsonb_agg(jsonb_build_object('topic', t ->> 'name', 'accuracy', (t ->> 'accuracy')::numeric)
                                            order by (t ->> 'accuracy')::numeric desc, t ->> 'name'), '[]'::jsonb)
                    from (select t from jsonb_array_elements(v_report #> '{breakdowns,by_topic}') t
                           where (t ->> 'graded')::int > 0 and (t ->> 'accuracy')::numeric >= 60
                           order by (t ->> 'accuracy')::numeric desc, t ->> 'name' limit 3) s),
    'weaknesses', (select coalesce(jsonb_agg(jsonb_build_object('topic', t ->> 'name', 'accuracy', (t ->> 'accuracy')::numeric)
                                             order by (t ->> 'accuracy')::numeric, t ->> 'name'), '[]'::jsonb)
                     from (select t from jsonb_array_elements(v_report #> '{breakdowns,by_topic}') t
                            where (t ->> 'graded')::int > 0 and (t ->> 'accuracy')::numeric < 60
                            order by (t ->> 'accuracy')::numeric, t ->> 'name' limit 3) s));

  insert into public.attempt_reports (attempt_id, report, generated_at)
  values (p_attempt_id, v_report, now())
  on conflict (attempt_id) do nothing;

  return v_report;
end $$;

-- ========================================================== student RPCs
-- Enrolment is required. Never returns questions.
create or replace function public.student_get_test_intro(p_test_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := public.adm_student_uid();
  v_test   record;
  v_win    record;
  v_stats  record;
  v_used   int;
  v_prog   record;
  v_reason text;
begin
  select q.*, s.title as series_title, s.instructions as series_instructions,
         qa.instructions_extra, coalesce(qa.max_violations, 3) as max_violations
    into v_test
    from public.quizzes q
    left join public.quiz_admin qa on qa.quiz_id = q.id
    left join public.test_series s on s.id = q.series_id
   where q.id = p_test_id
     and coalesce(qa.status, 'published') = 'published'
     and q.series_id in (select l.id from public.adm_live_series() l(id));
  if v_test.id is null then
    raise exception 'Test not found.' using errcode = 'P0002';
  end if;
  if not public.adm_student_is_enrolled(v_test.series_id, v_uid) then
    raise exception 'Enrol in this test series to take its tests.' using errcode = '42501';
  end if;

  select w.* into v_win from public.adm_test_window(p_test_id) w;
  select count(*) as questions, coalesce(sum(qq.points), 0) as marks,
         coalesce(max(qqa.negative_marks), 0) as max_negative
    into v_stats
    from public.quiz_questions qq
    left join public.quiz_question_admin qqa on qqa.question_id = qq.id
   where qq.quiz_id = p_test_id;
  select count(*) into v_used from public.quiz_attempts where quiz_id = p_test_id and student_id = v_uid;
  select a.id, public.adm_attempt_deadline(a.started_at, v_test.time_limit_mins) as deadline
    into v_prog
    from public.quiz_attempts a
   where a.quiz_id = p_test_id and a.student_id = v_uid and a.status = 'in_progress'
   order by a.started_at desc limit 1;

  v_reason := case
    when v_prog.id is not null and (v_prog.deadline is null or v_prog.deadline > now()) then null   -- resume
    when v_stats.questions = 0 then 'no_questions'
    when v_win.opens_at is not null and v_win.opens_at > now() then 'not_open_yet'
    when v_win.closes_at is not null and v_win.closes_at <= now() then 'closed'
    when v_used >= v_test.max_attempts then 'attempts_exhausted'
    else null end;

  return jsonb_build_object(
    'test_id', v_test.id,
    'test_title', v_test.title,
    'series_id', v_test.series_id,
    'series_title', v_test.series_title,
    'series_instructions', v_test.series_instructions,
    'test_instructions', v_test.description,
    'instructions_extra', v_test.instructions_extra,
    'duration_mins', v_test.time_limit_mins,
    'questions_count', v_stats.questions,
    'total_marks', v_stats.marks,
    'negative_marking', v_stats.max_negative > 0,
    'max_negative_marks', v_stats.max_negative,
    'passing_percentage', v_test.passing_score,
    'attempts_used', v_used,
    'attempts_allowed', v_test.max_attempts,
    'attempts_remaining', greatest(v_test.max_attempts - v_used, 0),
    'violation_limit', v_test.max_violations,
    'is_proctored', v_test.is_proctored,
    'show_answers_after', v_test.show_answers_after,
    'opens_at', v_win.opens_at,
    'closes_at', v_win.closes_at,
    'in_progress_attempt_id', case when v_prog.id is not null and (v_prog.deadline is null or v_prog.deadline > now())
                                   then v_prog.id end,
    'can_start', v_reason is null,
    'blocked_reason', v_reason,
    'server_now', now(),
    'sections', coalesce((select jsonb_agg(jsonb_build_object('name', sec.name, 'questions', sec.n)
                                           order by sec.position)
                            from (select coalesce(ts.name, 'General') as name, coalesce(ts.position, 0) as position,
                                         count(*) as n
                                    from public.quiz_questions qq
                                    left join public.quiz_question_admin qqa on qqa.question_id = qq.id
                                    left join public.test_sections ts on ts.id = qqa.section_id
                                   where qq.quiz_id = p_test_id
                                   group by ts.name, ts.position) sec), '[]'::jsonb));
end $$;

create or replace function public.student_start_attempt(p_test_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid        uuid := public.adm_student_writer_uid();
  v_test       record;
  v_win        record;
  v_prog       record;
  v_used       int;
  v_last_num   int;
  v_attempt_id uuid;
  v_attempt    record;
  v_resumed    boolean := false;
  v_deadline   timestamptz;
begin
  select q.*, coalesce(qa.shuffle_options, false) as shuffle_options, coalesce(qa.max_violations, 3) as max_violations
    into v_test
    from public.quizzes q
    left join public.quiz_admin qa on qa.quiz_id = q.id
   where q.id = p_test_id
     and coalesce(qa.status, 'published') = 'published'
     and q.series_id in (select l.id from public.adm_live_series() l(id));
  if v_test.id is null then
    raise exception 'Test not found.' using errcode = 'P0002';
  end if;
  if not public.adm_student_is_enrolled(v_test.series_id, v_uid) then
    raise exception 'Enrol in this test series to take its tests.' using errcode = '42501';
  end if;

  -- One start at a time per student and test (attempt limit under concurrency).
  perform pg_advisory_xact_lock(hashtextextended(p_test_id::text || ':' || v_uid::text, 0));

  -- Resume an unexpired attempt; grade an expired one first.
  select a.* into v_prog
    from public.quiz_attempts a
   where a.quiz_id = p_test_id and a.student_id = v_uid and a.status = 'in_progress'
   order by a.started_at desc limit 1;
  if v_prog.id is not null then
    v_deadline := public.adm_attempt_deadline(v_prog.started_at, v_test.time_limit_mins);
    if v_deadline is null or v_deadline > now() then
      v_attempt_id := v_prog.id;
      v_resumed    := true;
    else
      perform public.adm_finalize_attempt(v_prog.id, 'time_up');
    end if;
  end if;

  if v_attempt_id is null then
    select w.* into v_win from public.adm_test_window(p_test_id) w;
    if v_win.opens_at is not null and v_win.opens_at > now() then
      raise exception 'This test opens at %.', to_char(v_win.opens_at at time zone 'Asia/Kolkata', 'DD Mon YYYY HH24:MI "IST"')
        using errcode = 'P0001';
    end if;
    if v_win.closes_at is not null and v_win.closes_at <= now() then
      raise exception 'This test has closed.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.quiz_questions where quiz_id = p_test_id) then
      raise exception 'This test has no questions yet.' using errcode = 'P0001';
    end if;
    select count(*), coalesce(max(attempt_number), 0) into v_used, v_last_num
      from public.quiz_attempts where quiz_id = p_test_id and student_id = v_uid;
    if v_used >= v_test.max_attempts then
      raise exception 'You have used all % attempts for this test.', v_test.max_attempts using errcode = 'P0001';
    end if;
    insert into public.quiz_attempts (quiz_id, student_id, attempt_number, status, started_at)
    values (p_test_id, v_uid, greatest(v_used, v_last_num) + 1, 'in_progress', now())
    returning id into v_attempt_id;
  end if;

  select a.* into v_attempt from public.quiz_attempts a where a.id = v_attempt_id;
  v_deadline := public.adm_attempt_deadline(v_attempt.started_at, v_test.time_limit_mins);

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'test_id', p_test_id,
    'test_title', v_test.title,
    'series_id', v_test.series_id,
    'attempt_number', v_attempt.attempt_number,
    'resumed', v_resumed,
    'started_at', v_attempt.started_at,
    'deadline', v_deadline,
    'server_now', now(),
    'duration_mins', v_test.time_limit_mins,
    'is_proctored', v_test.is_proctored,
    'violation_limit', v_test.max_violations,
    'violations_count', (select count(*) from public.attempt_proctor_events e
                          where e.attempt_id = v_attempt.id and coalesce((e.meta ->> 'counted')::boolean, false)),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', qq.id,
               'position', o.seq,
               'text', qq.question_text,
               'type', qq.question_type,
               'ui_type', coalesce(qqa.admin_type, qq.question_type),
               'multi_select', qq.question_type = 'multiple_choice'
                               and (select count(*) from public.quiz_question_options c
                                     where c.question_id = qq.id and c.is_correct) > 1,
               'points', qq.points,
               'negative_marks', coalesce(qqa.negative_marks, 0),
               'section', coalesce(sec.name, 'General'),
               'section_position', coalesce(sec.position, 0),
               'topic', qqa.topic,
               'difficulty', qqa.difficulty,
               'image_path', qqa.image_path,
               'answer_instructions', qqa.answer_instructions,
               'options', case when qq.question_type in ('multiple_choice', 'true_false') then (
                            select coalesce(jsonb_agg(jsonb_build_object('id', op.id, 'text', op.option_text)
                                                      order by case when v_test.shuffle_options
                                                                    then md5(v_attempt.id::text || op.id::text) end,
                                                               op.sort_order, op.id), '[]'::jsonb)
                              from public.quiz_question_options op where op.question_id = qq.id)
                          else '[]'::jsonb end)
             order by o.seq), '[]'::jsonb)
        from public.adm_attempt_question_order(v_attempt.id) o
        join public.quiz_questions qq on qq.id = o.question_id
        left join public.quiz_question_admin qqa on qqa.question_id = qq.id
        left join public.test_sections sec on sec.id = qqa.section_id),
    'saved_answers', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'question_id', ans.question_id,
               'answer_text', ans.answer_text,
               'selected_option_ids', coalesce(to_jsonb(ans.selected_option_ids), '[]'::jsonb))), '[]'::jsonb)
        from public.quiz_answers ans where ans.attempt_id = v_attempt.id));
end $$;

-- p_answer: {"selected_option_ids": [uuid, ...]} for multiple_choice / true_false,
-- {"answer_text": "..."} otherwise; null, {} or an empty value clears the answer.
create or replace function public.student_save_answer(p_attempt_id uuid, p_question_id uuid, p_answer jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid      uuid := public.adm_student_writer_uid();
  v_att      record;
  v_deadline timestamptz;
  v_type     text;
  v_sel      text[];
  v_text     text;
  v_ans_id   uuid;
begin
  select a.id, a.student_id, a.status, a.started_at, a.quiz_id, q.time_limit_mins
    into v_att
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
   where a.id = p_attempt_id
   for update of a;
  if v_att.id is null or v_att.student_id <> v_uid then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  if v_att.status <> 'in_progress' then
    raise exception 'This attempt has already been submitted.' using errcode = 'P0001';
  end if;
  v_deadline := public.adm_attempt_deadline(v_att.started_at, v_att.time_limit_mins);
  if v_deadline is not null and now() > v_deadline + interval '10 seconds' then
    raise exception 'Time is up for this attempt.' using errcode = 'P0001';
  end if;

  select question_type into v_type from public.quiz_questions where id = p_question_id and quiz_id = v_att.quiz_id;
  if v_type is null then
    raise exception 'Question is not part of this test.' using errcode = '22023';
  end if;

  if v_type in ('multiple_choice', 'true_false') then
    if jsonb_typeof(p_answer -> 'selected_option_ids') = 'array' then
      -- Only ids of this question's options are kept.
      select array_agg(distinct o.id::text) into v_sel
        from public.quiz_question_options o
       where o.question_id = p_question_id
         and o.id::text in (select jsonb_array_elements_text(p_answer -> 'selected_option_ids'));
      if jsonb_array_length(p_answer -> 'selected_option_ids') > 0 and v_sel is null then
        raise exception 'Unknown option for this question.' using errcode = '22023';
      end if;
    end if;
  else
    v_text := left(nullif(btrim(coalesce(p_answer ->> 'answer_text', '')), ''), 20000);
  end if;

  select id into v_ans_id from public.quiz_answers
   where attempt_id = p_attempt_id and question_id = p_question_id
   order by created_at desc limit 1;

  if v_sel is null and v_text is null then
    delete from public.quiz_answers where attempt_id = p_attempt_id and question_id = p_question_id;
  -- v_sel holds validated option ids. ::uuid[] writes into the column whether
  -- the lead declared it uuid[] or text[] (uuid -> text is an assignment cast,
  -- text -> uuid is not).
  elsif v_ans_id is not null then
    update public.quiz_answers set answer_text = v_text, selected_option_ids = v_sel::uuid[] where id = v_ans_id;
  else
    insert into public.quiz_answers (attempt_id, question_id, answer_text, selected_option_ids)
    values (p_attempt_id, p_question_id, v_text, v_sel::uuid[]);
  end if;

  return jsonb_build_object('saved', true, 'cleared', v_sel is null and v_text is null,
                            'question_id', p_question_id, 'saved_at', now(), 'server_now', now(),
                            'deadline', v_deadline);
end $$;

-- Violation types: visibility_hidden, window_blur, fullscreen_exit, copy, cut,
-- paste, contextmenu, print, devtools. Informational (recorded, never counted):
-- fullscreen_enter, attempt_resumed, warning_acknowledged.
create or replace function public.student_log_proctor_event(p_attempt_id uuid, p_event_type text, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid      uuid := public.adm_student_uid();
  v_att      record;
  v_deadline timestamptz;
  v_type     text := lower(btrim(coalesce(p_event_type, '')));
  v_counted  boolean;
  v_count    int;
  v_meta     jsonb := coalesce(p_meta, '{}'::jsonb);
  v_auto     boolean := false;
  v_reason   text;
begin
  if v_type not in ('visibility_hidden', 'window_blur', 'fullscreen_exit', 'copy', 'cut', 'paste', 'contextmenu',
                    'print', 'devtools', 'fullscreen_enter', 'attempt_resumed', 'warning_acknowledged') then
    raise exception 'Unknown proctor event: %', left(p_event_type, 40) using errcode = '22023';
  end if;

  select a.id, a.student_id, a.status, a.started_at, q.time_limit_mins, coalesce(qa.max_violations, 3) as max_violations
    into v_att
    from public.quiz_attempts a
    join public.quizzes q on q.id = a.quiz_id
    left join public.quiz_admin qa on qa.quiz_id = q.id
   where a.id = p_attempt_id
   for update of a;
  if v_att.id is null or v_att.student_id <> v_uid then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  if v_att.status = 'in_progress' then
    v_deadline := public.adm_attempt_deadline(v_att.started_at, v_att.time_limit_mins);
    if v_deadline is not null and now() > v_deadline + interval '10 seconds' then
      perform public.adm_finalize_attempt(p_attempt_id, 'time_up');
      v_auto := true;
      v_reason := 'time_up';
    else
      v_counted := v_type not in ('fullscreen_enter', 'attempt_resumed', 'warning_acknowledged')
                   and not exists (select 1 from public.attempt_proctor_events e
                                    where e.attempt_id = p_attempt_id
                                      and coalesce((e.meta ->> 'counted')::boolean, false)
                                      and e.occurred_at > now() - interval '3 seconds');
      if pg_column_size(v_meta) > 4096 or jsonb_typeof(v_meta) <> 'object' then
        v_meta := jsonb_build_object('truncated', true);
      end if;
      insert into public.attempt_proctor_events (attempt_id, event_type, occurred_at, meta)
      values (p_attempt_id, v_type, now(), v_meta || jsonb_build_object('counted', v_counted));
    end if;
  end if;

  select count(*) into v_count
    from public.attempt_proctor_events e
   where e.attempt_id = p_attempt_id and coalesce((e.meta ->> 'counted')::boolean, false);

  if not v_auto and v_att.status = 'in_progress' and v_count > v_att.max_violations then
    perform public.adm_finalize_attempt(p_attempt_id, 'proctor_limit');
    v_auto := true;
    v_reason := 'proctor_limit';
  end if;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'recorded', v_att.status = 'in_progress' and v_reason is distinct from 'time_up',
    'counted', coalesce(v_counted, false),
    'violations_count', v_count,
    'violation_limit', v_att.max_violations,
    'remaining', greatest(v_att.max_violations - v_count, 0),
    'auto_submitted', v_auto,
    'auto_submit_reason', v_reason,
    'status', (select status from public.quiz_attempts where id = p_attempt_id));
end $$;

-- Idempotent: a second call returns the stored report.
create or replace function public.student_submit_attempt(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := public.adm_student_uid();
  v_owner uuid;
begin
  select student_id into v_owner from public.quiz_attempts where id = p_attempt_id for update;
  if v_owner is null or v_owner <> v_uid then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  return public.adm_finalize_attempt(p_attempt_id, 'student');
end $$;

-- The stored report for the caller's own attempt. An in_progress attempt past
-- its deadline is graded first (time_up); one still running is refused.
create or replace function public.student_get_report(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := public.adm_student_uid();
  v_att    record;
  v_report jsonb;
begin
  select a.id, a.student_id, a.status, a.started_at, q.time_limit_mins
    into v_att
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
   where a.id = p_attempt_id;
  if v_att.id is null or v_att.student_id <> v_uid then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;

  select report into v_report from public.attempt_reports where attempt_id = p_attempt_id;
  if v_report is not null then
    return v_report;
  end if;

  if v_att.status = 'in_progress' then
    if coalesce(public.adm_attempt_deadline(v_att.started_at, v_att.time_limit_mins) + interval '10 seconds', 'infinity') > now() then
      raise exception 'This attempt has not been submitted yet.' using errcode = 'P0001';
    end if;
    return public.adm_finalize_attempt(p_attempt_id, 'time_up');
  end if;
  raise exception 'No detailed report is available for this attempt.' using errcode = 'P0002';
end $$;

-- ================================================================== grants
revoke all on function public.adm_attempt_deadline(timestamptz, int) from public, anon, authenticated;
revoke all on function public.adm_test_window(uuid) from public, anon, authenticated;
revoke all on function public.adm_attempt_question_order(uuid) from public, anon, authenticated;
revoke all on function public.adm_report_bucket(jsonb) from public, anon, authenticated;
revoke all on function public.adm_finalize_attempt(uuid, text) from public, anon, authenticated;

revoke all on function public.student_get_test_intro(uuid) from public, anon;
grant execute on function public.student_get_test_intro(uuid) to authenticated;
revoke all on function public.student_start_attempt(uuid) from public, anon;
grant execute on function public.student_start_attempt(uuid) to authenticated;
revoke all on function public.student_save_answer(uuid, uuid, jsonb) from public, anon;
grant execute on function public.student_save_answer(uuid, uuid, jsonb) to authenticated;
revoke all on function public.student_log_proctor_event(uuid, text, jsonb) from public, anon;
grant execute on function public.student_log_proctor_event(uuid, text, jsonb) to authenticated;
revoke all on function public.student_submit_attempt(uuid) from public, anon;
grant execute on function public.student_submit_attempt(uuid) to authenticated;
revoke all on function public.student_get_report(uuid) from public, anon;
grant execute on function public.student_get_report(uuid) to authenticated;


-- >>> 20261026100400_student_rpc_dashboard.sql <<<
-- =====================================================================
-- 20261026100400_student_rpc_dashboard.sql
--
-- Purpose
--   Student history, account stats and the dashboard feed:
--     student_my_history(int, int), student_get_stats(), student_dashboard()
--
-- Definitions
--   * finished attempt: status submitted or timed_out.
--   * tests_taken / tests_passed: distinct tests with a finished / passed attempt.
--   * accuracy: correct answers / graded answers (pending review and
--     unanswered questions are not graded answers).
--   * streak: consecutive calendar days (Asia/Kolkata) with a finished attempt,
--     counted back from today, or from yesterday when today has none yet.
--   * an in_progress attempt past its deadline is reported with is_expired =
--     true; the first student_get_report / student_start_attempt call grades it.
--
-- Security
--   SECURITY DEFINER, search_path = public, extensions; the student is auth.uid().
--
-- ROLLBACK
--   drop function if exists public.student_dashboard();
--   drop function if exists public.student_get_stats();
--   drop function if exists public.student_my_history(int, int);
-- =====================================================================
set search_path = public, extensions;

create or replace function public.student_my_history(p_page int default 1, p_size int default 20) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := public.adm_student_uid();
  v_page  int  := greatest(coalesce(p_page, 1), 1);
  v_size  int  := least(greatest(coalesce(p_size, 20), 1), 100);
  v_total int;
begin
  select count(*) into v_total from public.quiz_attempts where student_id = v_uid;

  return jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'size', v_size,
    'total_pages', greatest(ceil(v_total::numeric / v_size)::int, 1),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'attempt_id', x.id,
               'test_id', x.quiz_id,
               'test_title', x.test_title,
               'series_id', x.series_id,
               'series_title', x.series_title,
               'attempt_number', x.attempt_number,
               'status', x.status,
               'is_expired', x.status = 'in_progress' and x.deadline is not null and x.deadline < now(),
               'deadline', x.deadline,
               'score', x.score,
               'max_score', x.max_score,
               'percentage', x.percentage,
               'passed', x.passed,
               'started_at', x.started_at,
               'submitted_at', x.submitted_at,
               'time_taken_secs', x.time_taken_secs,
               'time_limit_mins', x.time_limit_mins,
               'has_report', x.has_report)
             order by coalesce(x.submitted_at, x.started_at) desc, x.id)
        from (select a.*, q.title as test_title, q.series_id, s.title as series_title, q.time_limit_mins,
                     public.adm_attempt_deadline(a.started_at, q.time_limit_mins) as deadline,
                     exists (select 1 from public.attempt_reports r where r.attempt_id = a.id) as has_report
                from public.quiz_attempts a
                join public.quizzes q on q.id = a.quiz_id
                left join public.test_series s on s.id = q.series_id
               where a.student_id = v_uid
               order by coalesce(a.submitted_at, a.started_at) desc, a.id
               limit v_size offset (v_page - 1) * v_size) x), '[]'::jsonb));
end $$;

create or replace function public.student_get_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid    uuid := public.adm_student_uid();
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
  v_att    record;
  v_acc    numeric;
  v_anchor date;
  v_streak int := 0;
begin
  select count(*) as attempts,
         count(distinct quiz_id) as tests,
         count(distinct quiz_id) filter (where passed) as passed,
         round(avg(percentage), 1) as avg_pct,
         max(percentage) as best_pct,
         coalesce(sum(time_taken_secs), 0) as secs
    into v_att
    from public.quiz_attempts
   where student_id = v_uid and status in ('submitted', 'timed_out');

  select round(count(*) filter (where ans.is_correct) * 100.0 / nullif(count(*), 0), 1)
    into v_acc
    from public.quiz_answers ans
    join public.quiz_attempts a on a.id = ans.attempt_id
   where a.student_id = v_uid and a.status in ('submitted', 'timed_out')
     and ans.is_correct is not null
     and (nullif(btrim(coalesce(ans.answer_text, '')), '') is not null
          or coalesce(cardinality(ans.selected_option_ids), 0) > 0);

  -- Streak: count days back from the anchor while they are consecutive.
  with days as (
    select distinct (submitted_at at time zone 'Asia/Kolkata')::date as d
      from public.quiz_attempts
     where student_id = v_uid and status in ('submitted', 'timed_out') and submitted_at is not null
  )
  select case when exists (select 1 from days where d = v_today) then v_today
              when exists (select 1 from days where d = v_today - 1) then v_today - 1 end
    into v_anchor;
  if v_anchor is not null then
    with days as (
      select distinct (submitted_at at time zone 'Asia/Kolkata')::date as d
        from public.quiz_attempts
       where student_id = v_uid and status in ('submitted', 'timed_out') and submitted_at is not null
    )
    select count(*) into v_streak
      from (select d, row_number() over (order by d desc) as rn from days where d <= v_anchor) x
     where x.d = v_anchor - (x.rn - 1)::int;
  end if;

  return jsonb_build_object(
    'tests_taken', v_att.tests,
    'attempts_taken', v_att.attempts,
    'tests_passed', v_att.passed,
    'series_enrolled', (select count(*) from public.adm_student_series(v_uid)),
    'average_percentage', coalesce(v_att.avg_pct, 0),
    'best_percentage', coalesce(v_att.best_pct, 0),
    'total_time_secs', v_att.secs,
    'current_streak', v_streak,
    'accuracy_percentage', coalesce(v_acc, 0));
end $$;

create or replace function public.student_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := public.adm_student_uid();
  v_stats jsonb := public.student_get_stats();
begin
  return jsonb_build_object(
    -- Unexpired in_progress attempts.
    'continue_learning', coalesce((
      select jsonb_agg(jsonb_build_object(
               'attempt_id', x.id, 'test_id', x.quiz_id, 'test_title', x.title,
               'series_id', x.series_id, 'series_title', x.series_title,
               'attempt_number', x.attempt_number, 'started_at', x.started_at, 'deadline', x.deadline,
               'answered', x.answered, 'questions_count', x.questions)
             order by x.started_at desc)
        from (select a.id, a.quiz_id, a.attempt_number, a.started_at, q.title, q.series_id, s.title as series_title,
                     public.adm_attempt_deadline(a.started_at, q.time_limit_mins) as deadline,
                     (select count(*) from public.quiz_answers ans where ans.attempt_id = a.id) as answered,
                     (select count(*) from public.quiz_questions qq where qq.quiz_id = a.quiz_id) as questions
                from public.quiz_attempts a
                join public.quizzes q on q.id = a.quiz_id
                left join public.test_series s on s.id = q.series_id
               where a.student_id = v_uid and a.status = 'in_progress'
                 and coalesce(public.adm_attempt_deadline(a.started_at, q.time_limit_mins), 'infinity') > now()
               order by a.started_at desc limit 5) x), '[]'::jsonb),
    -- Up to 6 enrolled series with progress (same shape as student_my_series items).
    'enrolled_series', coalesce((
      select jsonb_agg(e order by (e ->> 'enrolled_at') desc)
        from (select e from jsonb_array_elements(public.student_my_series()) e
               order by (e ->> 'enrolled_at') desc limit 6) y), '[]'::jsonb),
    -- Last 5 finished attempts.
    'recent_history', coalesce((
      select jsonb_agg(jsonb_build_object(
               'attempt_id', x.id, 'test_id', x.quiz_id, 'test_title', x.title,
               'series_id', x.series_id, 'series_title', x.series_title,
               'attempt_number', x.attempt_number, 'status', x.status, 'score', x.score, 'max_score', x.max_score,
               'percentage', x.percentage, 'passed', x.passed, 'submitted_at', x.submitted_at,
               'time_taken_secs', x.time_taken_secs, 'has_report', x.has_report)
             order by x.submitted_at desc nulls last)
        from (select a.*, q.title, q.series_id, s.title as series_title,
                     exists (select 1 from public.attempt_reports r where r.attempt_id = a.id) as has_report
                from public.quiz_attempts a
                join public.quizzes q on q.id = a.quiz_id
                left join public.test_series s on s.id = q.series_id
               where a.student_id = v_uid and a.status in ('submitted', 'timed_out')
               order by a.submitted_at desc nulls last limit 5) x), '[]'::jsonb),
    'stats', jsonb_build_object(
      'tests_taken', v_stats -> 'tests_taken',
      'tests_passed', v_stats -> 'tests_passed',
      'average_percentage', v_stats -> 'average_percentage',
      'current_streak', v_stats -> 'current_streak',
      'series_enrolled', v_stats -> 'series_enrolled'),
    -- Live series the caller is not enrolled in; same subject first.
    'recommended_series', coalesce((
      select jsonb_agg(public.adm_series_card(r.id, v_uid) order by r.same_subject desc, r.created_at desc)
        from (select s.id, s.created_at,
                     coalesce(coalesce(sa.subject_category_id, c.category_id) in (
                       select coalesce(sa2.subject_category_id, c2.category_id)
                         from public.adm_student_series(v_uid) m
                         join public.test_series s2 on s2.id = m.series_id
                         left join public.test_series_admin sa2 on sa2.series_id = s2.id
                         left join public.courses c2 on c2.id = s2.course_id), false) as same_subject
                from public.test_series s
                left join public.test_series_admin sa on sa.series_id = s.id
                left join public.courses c on c.id = s.course_id
               where s.id in (select l.id from public.adm_live_series() l(id))
                 and not public.adm_student_is_enrolled(s.id, v_uid)
               order by 3 desc, s.created_at desc
               limit 6) r), '[]'::jsonb));
end $$;

revoke all on function public.student_my_history(int, int) from public, anon;
grant execute on function public.student_my_history(int, int) to authenticated;
revoke all on function public.student_get_stats() from public, anon;
grant execute on function public.student_get_stats() to authenticated;
revoke all on function public.student_dashboard() from public, anon;
grant execute on function public.student_dashboard() to authenticated;

rollback;
