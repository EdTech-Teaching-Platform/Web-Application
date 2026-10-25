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
