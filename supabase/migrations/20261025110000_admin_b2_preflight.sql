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
