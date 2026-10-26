-- =====================================================================
-- 20261027100000_feedback_preflight.sql
--
-- Purpose
--   Read-only preflight for test feedback / moderation (20261027100100 ..
--   100300). Collects every problem, then raises once:
--     1. lead and port columns the feedback RPCs read or write;
--     2. helpers they call (Batch 1 + student port);
--     3. clashes: table test_feedback and every new function name (any overload).
--   The optional student notification needs notifications.category to allow
--   'support_ticket'; when it doesn't, the RPC simply skips the notification
--   (a NOTICE says so here), it is not an error.
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
begin
  select coalesce(array_agg(t.tbl || '.' || t.col order by t.tbl, t.col), '{}') into v_list
    from (values
      ('profiles', 'id'), ('profiles', 'full_name'), ('profiles', 'email'), ('profiles', 'role'),
      ('test_series', 'id'), ('test_series', 'title'),
      ('quizzes', 'id'), ('quizzes', 'series_id'), ('quizzes', 'title'),
      ('quiz_questions', 'id'), ('quiz_questions', 'quiz_id'), ('quiz_questions', 'question_text'),
      ('quiz_attempts', 'id'), ('quiz_attempts', 'quiz_id'), ('quiz_attempts', 'student_id'),
      ('quiz_attempts', 'status'), ('quiz_attempts', 'score'), ('quiz_attempts', 'max_score'),
      ('quiz_attempts', 'percentage'), ('quiz_attempts', 'submitted_at'), ('quiz_attempts', 'attempt_number'),
      ('notifications', 'user_id'), ('notifications', 'category'), ('notifications', 'title'),
      ('notifications', 'body'), ('notifications', 'action_url'), ('notifications', 'reference_type'),
      ('notifications', 'reference_id'),
      ('audit_logs', 'actor_id'), ('audit_logs', 'action'), ('audit_logs', 'target_type'),
      ('audit_logs', 'target_id'), ('audit_logs', 'before_state'), ('audit_logs', 'after_state'),
      ('audit_logs', 'reason'), ('audit_logs', 'created_at')
    ) as t(tbl, col)
   where not exists (select 1 from information_schema.columns c
                      where c.table_schema = 'public' and c.table_name = t.tbl and c.column_name = t.col);
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing columns: ' || array_to_string(v_list, ', '));
  end if;

  select coalesce(array_agg(x.sig order by x.sig), '{}') into v_list
    from unnest(array['public.adm_require_admin()', 'public.adm_audit(text,text,uuid,jsonb,jsonb,text)',
                      'public.adm_like(text)', 'public.adm_student_uid()', 'public.adm_student_writer_uid()',
                      'public.adm_question_json(uuid)']) as x(sig)
   where to_regprocedure(x.sig) is null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing functions (admin or student port not applied?): ' || array_to_string(v_list, ', '));
  end if;

  if to_regclass('public.test_feedback') is not null then
    v_problems := v_problems || 'relation public.test_feedback already exists'::text;
  end if;
  select coalesce(array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by p.proname), '{}')
    into v_list
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('student_submit_feedback', 'student_my_feedback', 'list_moderation_items', 'get_moderation_stats',
                       'get_moderation_item', 'set_moderation_status', 'get_moderation_filter_options',
                       'adm_feedback_row');
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('functions already exist: ' || array_to_string(v_list, ', '));
  end if;

  if cardinality(v_problems) > 0 then
    raise exception 'Feedback preflight: %', array_to_string(v_problems, '; ');
  end if;

  select string_agg(pg_get_constraintdef(co.oid), ' ') into v_def
    from pg_constraint co
   where co.conrelid = to_regclass('public.notifications') and co.contype = 'c'
     and pg_get_constraintdef(co.oid) ilike '%category%';
  if v_def is not null and position('''support_ticket''' in v_def) = 0 then
    raise notice 'Feedback preflight: notifications.category does not allow support_ticket; resolved feedback will not notify the student.';
  end if;
end $pre$;
