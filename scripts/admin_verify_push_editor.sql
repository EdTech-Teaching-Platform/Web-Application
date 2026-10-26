-- =====================================================================
-- scripts/admin_verify_push_editor.sql   (GENERATED from supabase/migrations/2026*_(admin|student|feedback)_*.sql)
--
-- Supabase SQL editor version of scripts/admin_verify_push.sql. Read-only.
-- The editor shows only the last statement's result, so this is ONE statement
-- returning one row per check: check_name, status ('PASS' / 'FAIL'), detail.
-- Every row must be PASS. For check 9, also compare the md5 in detail with the
-- 'lead_function_def' row of the before-snapshot (admin_snapshot_lead_editor.sql).
-- Needs pg_cron (check 10 reads cron.job).
-- Counts: 34 tables, 6 sequences, 276 function names.
-- =====================================================================
with our_tables(name) as (
  select unnest(array[
      'adm_admin_users', 'admin_auth_events', 'admin_nav_items', 'admin_notes', 'admin_series_enrollments', 
      'ai_generated_questions', 'ai_test_jobs', 'assignment_comments', 'assignment_history', 
      'assignment_notifications', 'assignment_status_progress', 'attempt_proctor_events', 
      'attempt_reports', 'callback_activity', 'educator_admin_state', 'educator_invites', 
      'notification_campaign_events', 'notification_campaigns', 'notification_recipients', 
      'question_similarity_matches', 'quiz_admin', 'quiz_question_admin', 'regions', 'report_runs', 
      'report_types', 'series_requests', 'student_block_history', 'students', 'test_assignments', 
      'test_feedback', 'test_sections', 'test_series_admin', 'user_geo', 'user_sessions'
    ]::text[])
), our_seqs(name) as (
  select unnest(array[
      'adm_assignment_code_seq', 'adm_callback_code_seq', 'adm_educator_code_seq', 'adm_request_code_seq', 
      'adm_series_code_seq', 'adm_student_code_seq'
    ]::text[])
), our_funcs(name) as (
  select unnest(array[
      'add_admin_note', 'add_callback_note', 'adm_actor_role', 'adm_apply_test_fields', 'adm_asg_log', 
      'adm_asg_notify', 'adm_assert_question_type_allowed', 'adm_assignment_rows', 'adm_attempt_deadline', 
      'adm_attempt_question_order', 'adm_audit', 'adm_callback_assign_code', 'adm_callback_rows', 
      'adm_callback_source_key', 'adm_campaign_category', 'adm_campaign_row', 
      'adm_complete_assignments_for_quiz', 'adm_copy_quiz', 'adm_cumulative_counts', 
      'adm_current_session_id', 'adm_delete_quiz', 'adm_detect_repeated_questions', 'adm_educator_base', 
      'adm_educator_verification_key', 'adm_eligible_educators', 'adm_end_user_sessions', 
      'adm_ensure_educator_state', 'adm_ensure_series_admin', 'adm_ensure_student', 'adm_feedback_row', 
      'adm_finalize_attempt', 'adm_grade_matches', 'adm_house_course_id', 'adm_initials', 
      'adm_insert_options', 'adm_insert_question', 'adm_is_account_blocked', 'adm_is_admin_user', 
      'adm_is_platform_admin', 'adm_is_service_role', 'adm_is_subjective_type', 'adm_like', 
      'adm_list_admins', 'adm_live_series', 'adm_map_question_type', 'adm_new_house_series', 
      'adm_norm_text', 'adm_normalize_phone', 'adm_open_assignment_count', 'adm_payments_stub', 
      'adm_phone_display', 'adm_publish_campaign', 'adm_publish_test_series', 'adm_question_is_subjective', 
      'adm_question_json', 'adm_range_options', 'adm_report_bucket', 'adm_report_educators', 
      'adm_report_enrollment', 'adm_report_students', 'adm_report_test_series', 'adm_require_admin', 
      'adm_require_quiz', 'adm_require_series', 'adm_resolve_audience', 'adm_resolve_date_range', 
      'adm_review_match', 'adm_series_card', 'adm_series_educators', 'adm_series_json', 'adm_series_rows', 
      'adm_series_students', 'adm_series_tracker_rows', 'adm_set_series_availability', 'adm_stat_card', 
      'adm_student_is_enrolled', 'adm_student_series', 'adm_student_uid', 'adm_student_writer_uid', 
      'adm_subject_category', 'adm_sync_series_to_lead', 'adm_test_json', 'adm_test_window', 
      'adm_text_answer', 'adm_ticket_rows', 'adm_touch_updated_at', 'adm_tpa_attempts', 'adm_tpa_tests', 
      'adm_ui_question_type', 'adm_validate_campaign', 'adm_validate_quiz_for_publish', 'approve_refund', 
      'archive_notification', 'assign_request', 'assign_support_ticket', 'block_student', 
      'cancel_assignment', 'clear_done_notes', 'create_assignments', 'create_discount', 
      'create_educator_invites', 'create_notification', 'create_question', 'create_question_option', 
      'create_test', 'create_test_section', 'create_test_series', 'delete_admin_note', 
      'delete_draft_notification', 'delete_educator', 'delete_question', 'delete_question_option', 
      'delete_test', 'delete_test_section', 'delete_test_series', 'detect_repeated_questions', 
      'discard_wizard_draft', 'dismiss_match', 'dispatch_due_notifications', 'duplicate_test', 
      'duplicate_test_series', 'estimate_audience', 'export_callback_report', 
      'export_discount_redemptions', 'export_refunds', 'export_report_csv', 'export_tpa_rows', 
      'export_transactions', 'extend_deadline', 'flag_match_confirmed', 'generate_report', 
      'get_admin_dashboard', 'get_admin_me', 'get_admin_nav', 'get_assignment_detail', 
      'get_callback_filter_options', 'get_callback_request', 'get_callback_stats', 'get_dashboard_header', 
      'get_dashboard_revenue', 'get_dashboard_stats', 'get_discount', 'get_discount_analytics', 
      'get_discount_stats', 'get_educator_detail', 'get_educator_stats', 'get_financial_analytics', 
      'get_financial_range_options', 'get_financial_summary', 'get_match_counts', 
      'get_moderation_filter_options', 'get_moderation_item', 'get_moderation_stats', 
      'get_my_unread_notification_count', 'get_notification', 'get_notification_filter_options', 
      'get_notification_stats', 'get_pending_educator_verifications', 'get_refund_stats', 
      'get_regional_filter_options', 'get_regional_summary', 'get_regional_trend', 
      'get_report_builder_options', 'get_report_filter_options', 'get_report_run', 'get_revenue_by_region', 
      'get_revenue_trend', 'get_series_approvals', 'get_series_tracker_detail', 'get_student_detail', 
      'get_student_stats', 'get_students_by_region', 'get_support_ticket', 'get_support_ticket_stats', 
      'get_test_series', 'get_test_series_stats', 'get_top_series', 'get_tpa_filter_options', 
      'get_tpa_leaderboard', 'get_tpa_series_engagement', 'get_tpa_subject_scores', 'get_tpa_summary', 
      'get_tpa_test_comparison', 'get_tracker_stats', 'get_transaction', 'get_transaction_filter_options', 
      'get_transaction_stats', 'global_search', 'list_active_sessions', 'list_assignments', 
      'list_auth_events', 'list_callback_requests', 'list_discount_history', 'list_discounts', 
      'list_educator_documents', 'list_educators', 'list_eligible_educators', 'list_moderation_items', 
      'list_my_notes', 'list_notifications', 'list_pending_refunds', 'list_refund_history', 
      'list_region_comparison', 'list_repeated_matches', 'list_series_options', 'list_series_requests', 
      'list_series_tracker', 'list_students', 'list_support_tickets', 'list_test_series', 
      'list_transactions', 'log_export', 'mark_all_notifications_read', 'mark_match_reviewed', 
      'mark_notification_read', 'mark_payment_paid', 'mark_payment_refunded', 'preview_notification', 
      'public_get_series', 'public_list_series', 'publish_notification', 'purge_expired_report_results', 
      'purge_old_admin_auth_events', 'reassign_educator', 'record_email_results', 'record_login', 
      'record_logout', 'register_educator', 'reject_refund', 'reject_request', 'release_scheduled_series', 
      'reply_support_ticket', 'request_refund', 'review_educator_document', 'review_submission', 
      'revoke_user_sessions', 'save_wizard_draft', 'series_name_exists', 'set_callback_status', 
      'set_discount_status', 'set_educator_account_status', 'set_educator_verification', 
      'set_moderation_status', 'set_support_ticket_priority', 'set_support_ticket_status', 
      'set_test_status', 'sign_out_other_devices', 'start_review', 'student_dashboard', 'student_enroll', 
      'student_get_report', 'student_get_series', 'student_get_stats', 'student_get_test_intro', 
      'student_list_series', 'student_log_proctor_event', 'student_my_feedback', 'student_my_history', 
      'student_my_series', 'student_save_answer', 'student_start_attempt', 'student_submit_attempt', 
      'student_submit_feedback', 'submit_callback_request', 'toggle_admin_note', 'touch_session', 
      'unblock_student', 'update_admin_note', 'update_assignment_requirements', 'update_discount', 
      'update_question', 'update_question_option', 'update_test', 'update_test_section', 
      'update_test_series', 'upsert_test_series_full'
    ]::text[])
), our_procs as (
  select p.oid, p.proname, p.prosecdef, p.proconfig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (select name from our_funcs)
), our_rels as (
  select c.oid, c.relname, c.relrowsecurity
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname in (select name from our_tables)
), checks as (
  select 1 as ord, '1. our tables and sequences exist' as check_name,
         case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
         coalesce(string_agg(x, ', ' order by x), 'ok') as detail
    from (select name from our_tables where to_regclass('public.' || name) is null
           union all select name from our_seqs where to_regclass('public.' || name) is null) s(x)
  union all
  select 2 as ord, '2. our functions exist' as check_name,
         case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
         coalesce(string_agg(x, ', ' order by x), 'ok') as detail
    from (select f.name from our_funcs f where not exists (select 1 from our_procs p where p.proname = f.name)) s(x)
  union all
  select 3 as ord, '3. RLS enabled on our tables' as check_name,
         case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
         coalesce(string_agg(x, ', ' order by x), 'ok') as detail
    from (select relname from our_rels where not relrowsecurity) s(x)
  union all
  select 4 as ord, '4. anon / authenticated have no table privileges on our tables' as check_name,
         case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
         coalesce(string_agg(x, ', ' order by x), 'ok') as detail
    from (select r.relname || ':' || g.role || ':' || v.priv
              from our_rels r
             cross join unnest(array['anon', 'authenticated']) as g(role)
             cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as v(priv)
             where has_table_privilege(g.role, r.oid, v.priv)) s(x)
  union all
  select 5 as ord, '5. anon can execute only submit_callback_request and public_*' as check_name,
         case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
         coalesce(string_agg(x, ', ' order by x), 'ok') as detail
    from (select oid::regprocedure::text from our_procs
             where has_function_privilege('anon', oid, 'execute') and proname not in ('submit_callback_request', 'public_list_series', 'public_get_series')) s(x)
  union all
  select 6 as ord, '6. internal adm_ helpers not executable by authenticated' as check_name,
         case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
         coalesce(string_agg(x, ', ' order by x), 'ok') as detail
    from (select p.oid::regprocedure::text
              from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname like 'adm\_%'
               and p.proname <> all (array[
      'adm_is_platform_admin', 'adm_publish_test_series', 'adm_list_admins'
    ]::text[])
               and has_function_privilege('authenticated', p.oid, 'execute')) s(x)
  union all
  select 7 as ord, '7. server-only functions not executable by authenticated' as check_name,
         case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
         coalesce(string_agg(x, ', ' order by x), 'ok') as detail
    from (select oid::regprocedure::text from our_procs
             where proname = any (array[
      'release_scheduled_series', 'dispatch_due_notifications', 'purge_expired_report_results', 
      'purge_old_admin_auth_events', 'record_email_results', 'register_educator'
    ]::text[])
               and has_function_privilege('authenticated', oid, 'execute')) s(x)
  union all
  select 8.1 as ord, '8a. our functions pin search_path' as check_name,
         case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
         coalesce(string_agg(x, ', ' order by x), 'ok') as detail
    from (select oid::regprocedure::text from our_procs
             where not exists (select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search_path=%')) s(x)
  union all
  select 8.2 as ord, '8b. browser RPCs (non-adm_) are SECURITY DEFINER' as check_name,
         case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
         coalesce(string_agg(x, ', ' order by x), 'ok') as detail
    from (select oid::regprocedure::text from our_procs where proname not like 'adm\_%' and not prosecdef) s(x)
  union all
  select 9, '9. lead publish_test_series(uuid, boolean) present (compare md5 with before-snapshot)',
         case when f.oid is null then 'FAIL' else 'PASS' end,
         case when f.oid is null then 'not found'
              else 'md5=' || md5(pg_get_functiondef(f.oid)) || ' owner=' || pg_get_userbyid(p.proowner)
                   || ' acl=' || coalesce(p.proacl::text, 'default') end
    from (select to_regprocedure('public.publish_test_series(uuid,boolean)')::oid as oid) f
    left join pg_proc p on p.oid = f.oid
  union all
  select 10 as ord, '10. the 5 adm_ cron jobs exist and are active' as check_name,
         case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
         coalesce(string_agg(x, ', ' order by x), 'ok') as detail
    from (select e.name || case when j.jobid is null then ' missing' else ' inactive' end
              from unnest(array[
      'adm_detect_repeated_questions', 'adm_dispatch_due_notifications', 
      'adm_purge_expired_report_results', 'adm_purge_old_admin_auth_events', 
      'adm_release_scheduled_series'
    ]::text[]) as e(name)
              left join cron.job j on j.jobname = e.name
             where j.jobid is null or not j.active) s(x)
  union all
  select 11.1, '11a. house course exists',
         case when count(*) = 1 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(id::text || ' status=' || status::text, ', '), 'not found')
    from public.courses where slug = 'platform-test-series-house'
  union all
  select 11.2, '11b. platform_settings rows exist',
         case when count(*) = 2 then 'PASS' else 'FAIL' end,
         coalesce(string_agg(key, ', ' order by key), 'none') || ' (expect admin_house_course_id, dashboard_quote)'
    from public.platform_settings where key in ('admin_house_course_id', 'dashboard_quote')
  union all
  select 12, 'Summary',
         case when (select count(*) from our_rels) = 34
               and (select count(distinct proname) from our_procs) = 276 then 'PASS' else 'FAIL' end,
         (select count(*) from our_rels) || ' of 34 tables, '
           || (select count(distinct proname) from our_procs) || ' of 276 function names, '
           || (select count(*) from our_procs) || ' overloads'
)
select check_name, status, detail from checks order by ord;
