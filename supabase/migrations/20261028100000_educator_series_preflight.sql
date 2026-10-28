-- =====================================================================
-- 20261028100000_educator_series_preflight.sql
--
-- Purpose
--   Read-only checks before 20261028100100..100400 (educators on the shared
--   test series RPCs). Collects every problem and raises once. Writes nothing.
--     * the educator onboarding files (20261028090*) and the fast publish
--       file (20261027110000) are applied;
--     * the functions 20261028100200 replaces exist (ours);
--     * our tables / columns used exist, the status CHECK name is the one we
--       replace, the new columns don't exist yet;
--     * none of the new function names exist.
--
-- ROLLBACK
--   Nothing to roll back.
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare
  v_problems text[] := '{}';
  v_list     text[];
begin
  select coalesce(array_agg(x.sig order by x.sig), '{}') into v_list
    from unnest(array[
      -- prerequisites
      'public.adm_is_verified_educator()', 'public.adm_require_verified_educator()', 'public.adm_is_platform_admin()',
      'public.adm_require_admin()', 'public.adm_audit(text,text,uuid,jsonb,jsonb,text)', 'public.adm_series_rows()',
      'public.adm_series_publish_problem(uuid)', 'public.adm_question_options(text,jsonb)', 'public.adm_question_is_subjective(uuid)',
      'public.adm_report_bucket(jsonb)', 'public.adm_assignment_rows()', 'public.adm_asg_log(uuid,text,text)',
      'public.adm_test_json(uuid)', 'public.adm_question_json(uuid)', 'public.adm_series_students()',
      'public.adm_sync_series_to_lead(uuid)', 'public.adm_educator_validate(jsonb,integer)', 'public.adm_educator_clean(jsonb,integer)',
      -- replaced by 20261028100200
      'public.get_test_series_stats()', 'public.list_test_series(text,text,text,text,integer,integer)',
      'public.get_test_series(uuid)', 'public.series_name_exists(text,uuid)', 'public.create_test_series(jsonb)',
      'public.update_test_series(uuid,jsonb)', 'public.delete_test_series(uuid)', 'public.duplicate_test_series(uuid)',
      'public.save_wizard_draft(uuid,jsonb)', 'public.discard_wizard_draft(uuid)', 'public.upsert_test_series_full(jsonb,boolean)',
      'public.set_test_status(uuid,text)', 'public.create_test(uuid,jsonb)', 'public.update_test(uuid,jsonb)',
      'public.delete_test(uuid)', 'public.duplicate_test(uuid)', 'public.create_test_section(uuid,jsonb)',
      'public.update_test_section(uuid,jsonb)', 'public.delete_test_section(uuid)', 'public.create_question(uuid,jsonb)',
      'public.update_question(uuid,jsonb)', 'public.delete_question(uuid)', 'public.create_question_option(uuid,jsonb)',
      'public.update_question_option(uuid,jsonb)', 'public.delete_question_option(uuid)',
      'public.adm_new_house_series(text,text,text)', 'public.adm_publish_test_series(uuid,boolean)'
    ]) as x(sig)
   where to_regprocedure(x.sig) is null;
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing functions (apply 20261027110000 and 20261028090* first?): ' || array_to_string(v_list, ', '));
  end if;

  select coalesce(array_agg(x.t || '.' || x.c order by x.t, x.c), '{}') into v_list
    from (values ('test_series_admin', 'created_by'), ('test_series_admin', 'status'), ('test_series_admin', 'deleted_at'),
                 ('test_assignments', 'educator_id'), ('test_assignments', 'series_id'), ('test_assignments', 'test_id'),
                 ('test_assignments', 'status'), ('assignment_comments', 'question_id'), ('assignment_history', 'note'),
                 ('attempt_reports', 'report'), ('quiz_answers', 'selected_option_ids'), ('quiz_answers', 'points_earned'),
                 ('test_feedback', 'rating'), ('notifications', 'reference_type')) as x(t, c)
   where not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = x.t and column_name = x.c);
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('missing columns: ' || array_to_string(v_list, ', '));
  end if;

  if not exists (select 1 from pg_constraint where conrelid = to_regclass('public.test_series_admin')
                    and conname = 'test_series_admin_status_check') then
    v_problems := v_problems || 'missing constraint test_series_admin_status_check'::text;
  end if;
  select coalesce(array_agg(c order by c), '{}') into v_list
    from unnest(array['origin', 'rejection_reason', 'submitted_at', 'approved_by', 'approved_at']) c
   where exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'test_series_admin' and column_name = c);
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('test_series_admin columns already exist: ' || array_to_string(v_list, ', '));
  end if;

  select coalesce(array_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' order by p.proname), '{}')
    into v_list
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in (
       'adm_actor_kind', 'adm_educator_series_ids', 'adm_can_create_series', 'adm_can_manage_series', 'adm_require_author',
       'adm_require_series_access', 'adm_require_series_access_or_new', 'adm_require_series_owner',
       'adm_series_is_independent_educator', 'adm_attempt_latest_answers', 'adm_question_grading_key',
       'adm_rebuild_attempt_report', 'adm_regrade_quiz', 'adm_update_options_in_place', 'adm_quiz_series',
       'adm_publish_series_core', 'adm_series_content_problem', 'adm_notify_series_decision', 'adm_educator_assignment_json',
       'educator_submit_series_for_approval', 'list_pending_series_approvals', 'approve_educator_series',
       'reject_educator_series', 'educator_list_assignments', 'educator_get_assignment', 'educator_start_assignment',
       'educator_add_assignment_comment', 'educator_get_profile', 'educator_update_profile', 'educator_get_stats',
       'educator_get_dashboard');
  if cardinality(v_list) > 0 then
    v_problems := v_problems || ('functions already exist: ' || array_to_string(v_list, ', '));
  end if;

  if cardinality(v_problems) > 0 then
    raise exception 'Educator series preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;
