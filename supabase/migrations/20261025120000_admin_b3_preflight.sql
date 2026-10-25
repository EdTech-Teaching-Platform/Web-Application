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
