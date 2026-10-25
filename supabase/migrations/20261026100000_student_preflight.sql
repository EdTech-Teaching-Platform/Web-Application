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
