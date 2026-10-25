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
