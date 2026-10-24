set search_path = public, extensions;
set check_function_bodies = off;
-- ---------- 1. Enums ----------
do $$ begin create type refund_status as enum ('pending','approved','rejected','cancelled');
exception when duplicate_object then null; end $$;
do $$ begin create type refund_reason as enum
  ('duplicate_charge','technical_issue','not_as_described','accidental_purchase','other');
exception when duplicate_object then null; end $$;
do $$ begin create type refund_requester_role as enum ('student','educator','admin');
exception when duplicate_object then null; end $$;
do $$ begin create type refund_item_type as enum ('test_series','course');
exception when duplicate_object then null; end $$;
-- state of the actual money movement at the gateway (after an admin approves)
do $$ begin create type refund_gateway_status as enum ('not_started','pending','processed','failed');
exception when duplicate_object then null; end $$;
do $$ begin create type refund_event_type as enum
  ('requested','approved','rejected','cancelled','gateway_processed','gateway_failed','gateway_retry');
exception when duplicate_object then null; end $$;
-- ---------- 2. Tables ----------
create sequence if not exists refund_code_seq start 1001;
create table if not exists refund_settings (            -- single row, editable by admins
  singleton       boolean primary key default true check (singleton),
  window_days     int not null default 7 check (window_days >= 0),   -- refund allowed within N days of payment
  updated_at      timestamptz not null default now()
);
insert into refund_settings (singleton) values (true) on conflict do nothing;
create table if not exists refund_requests (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique default ('RFD-' || nextval('refund_code_seq')),
  payment_id         uuid not null references payments(id) on delete restrict,
  student_id         uuid not null references profiles(id) on delete restrict,
  educator_id        uuid references educators(id) on delete set null,          -- snapshot
  item_type          refund_item_type not null default 'test_series',
  series_id          uuid references test_series(id) on delete set null,
  course_id          uuid,                                                      -- only if courses are ever enabled
  item_title         text not null,                                             -- snapshot (shown even if series is renamed)
  requested_by       uuid references profiles(id) on delete set null,
  requested_by_role  refund_requester_role not null default 'student',
  amount_inr         numeric(10,2) not null check (amount_inr > 0),
  reason_code        refund_reason not null default 'other',
  reason_text        text,                                                      -- "Reason: Duplicate charge"
  status             refund_status not null default 'pending',
  decided_by         uuid references profiles(id) on delete set null,
  decided_at         timestamptz,
  decision_note      text,                                                      -- "Note" column
  gateway_status     refund_gateway_status not null default 'not_started',
  gateway_refund_id  text,
  gateway_error      text,
  processed_at       timestamptz,
  requested_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint refund_decided_ok check (status in ('pending','cancelled') or decided_at is not null),
  constraint refund_reject_note check (status <> 'rejected' or char_length(btrim(coalesce(decision_note,''))) >= 3)
);
alter table refund_requests add column if not exists gateway_status refund_gateway_status not null default 'not_started';
alter table refund_requests add column if not exists gateway_refund_id text;
alter table refund_requests add column if not exists gateway_error text;
alter table refund_requests add column if not exists processed_at timestamptz;
-- only one open request per payment
create unique index if not exists refund_one_pending_per_payment on refund_requests (payment_id) where status = 'pending';
create table if not exists refund_events (
  id          uuid primary key default gen_random_uuid(),
  refund_id   uuid not null references refund_requests(id) on delete restrict,
  event_type  refund_event_type not null,
  actor_id    uuid references profiles(id) on delete set null,
  note        text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);
-- enrollment access is removed on a full refund (add these two columns if you don't have equivalents)
alter table series_enrollments add column if not exists revoked_at timestamptz;
alter table series_enrollments add column if not exists revoke_reason text;
-- ---------- 3. Indexes ----------
create index if not exists refund_status_idx     on refund_requests (status, requested_at);
create index if not exists refund_decided_idx    on refund_requests (decided_at desc) where status in ('approved','rejected');
create index if not exists refund_student_idx    on refund_requests (student_id);
create index if not exists refund_educator_idx   on refund_requests (educator_id);
create index if not exists refund_payment_idx    on refund_requests (payment_id);
create index if not exists refund_events_idx     on refund_events (refund_id, created_at);
-- ---------- 4. Triggers ----------
drop trigger if exists trg_refund_updated on refund_requests;
create trigger trg_refund_updated before update on refund_requests for each row execute function set_updated_at();
create or replace function prevent_refund_delete() returns trigger language plpgsql as $$
begin raise exception 'Refund records are permanent.'; end $$;
drop trigger if exists trg_refund_no_delete on refund_requests;
create trigger trg_refund_no_delete before delete on refund_requests for each row execute function prevent_refund_delete();
-- ---------- 5. View ----------
drop view if exists v_refund_requests;
create view v_refund_requests with (security_invoker = true) as
select
  r.id, r.code, r.payment_id, p.txn_code,
  r.student_id,  s.full_name as student_name,
  r.educator_id, e.full_name as educator_name,
  r.item_type, r.item_title, r.series_id,
  r.requested_by, r.requested_by_role, rb.full_name as requested_by_name,
  r.amount_inr, p.amount_inr as payment_amount_inr,
  r.reason_code,
  case r.reason_code when 'duplicate_charge' then 'Duplicate charge'
                     when 'technical_issue' then 'Technical/access issues'
                     when 'not_as_described' then 'Not as described'
                     when 'accidental_purchase' then 'Accidental purchase'
                     else 'Other' end as reason_label,
  r.reason_text, r.status,
  r.decided_by, d.full_name as decided_by_name, r.decided_at, r.decision_note,
  r.gateway_status, r.gateway_refund_id, r.gateway_error, r.processed_at,
  r.requested_at
from refund_requests r
join payments p       on p.id = r.payment_id
join profiles s       on s.id = r.student_id
left join profiles e  on e.id = r.educator_id
left join profiles rb on rb.id = r.requested_by
left join profiles d  on d.id = r.decided_by;
-- ---------- 6. Read RPCs ----------
-- Top table: pending requests (oldest first), Approve / Reject buttons act on `id`
create or replace function list_pending_refunds(p_page int default 1, p_size int default 20)
returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  select jsonb_build_object(
           'id', v.id, 'code', v.code, 'student_name', v.student_name, 'item_type', v.item_type,
           'item_title', v.item_title, 'reason', coalesce(v.reason_text, v.reason_label),
           'educator_name', v.educator_name, 'amount_inr', v.amount_inr, 'requested_at', v.requested_at),
         count(*) over ()
  from v_refund_requests v
  where v.status = 'pending'
  order by v.requested_at asc
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- Refund History: approved + rejected
create or replace function list_refund_history(
  p_status text default null,        -- approved | rejected | null = both
  p_from date default null, p_to date default null,
  p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  select jsonb_build_object(
           'id', v.id, 'code', v.code, 'item_title', v.item_title, 'item_type', v.item_type,
           'requested_by_role', v.requested_by_role, 'requested_by_name', v.requested_by_name,
           'amount_inr', v.amount_inr, 'requested_at', v.requested_at, 'decided_at', v.decided_at,
           'decided_by_name', v.decided_by_name, 'status', v.status, 'note', v.decision_note,
           'gateway_status', v.gateway_status),
         count(*) over ()
  from v_refund_requests v
  where v.status in ('approved','rejected')
    and (p_status is null or p_status in ('','all') or v.status::text = p_status)
    and (p_from is null or v.decided_at >= p_from)
    and (p_to   is null or v.decided_at <  p_to + 1)
  order by v.decided_at desc, v.id
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- counts for sidebar badge / headers
create or replace function get_refund_stats() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'pending_count',      count(*) filter (where status = 'pending'),
    'pending_amount_inr', coalesce(sum(amount_inr) filter (where status = 'pending'),0),
    'approved_count',     count(*) filter (where status = 'approved'),
    'approved_amount_inr',coalesce(sum(amount_inr) filter (where status = 'approved'),0),
    'rejected_count',     count(*) filter (where status = 'rejected'),
    'gateway_failed',     count(*) filter (where status = 'approved' and gateway_status = 'failed'))
  from refund_requests;
$$;
-- "Export Refunds"
create or replace function export_refunds(p_status text default null, p_from date default null, p_to date default null)
returns table (refund_id text, transaction_id text, student text, item_type text, item text, educator text,
               amount_inr numeric, reason text, requested_by text, requested_at timestamptz,
               status text, decided_by text, decided_at timestamptz, note text, gateway_status text)
language sql stable security invoker as $$
  select v.code, v.txn_code, v.student_name, v.item_type::text, v.item_title, v.educator_name,
         v.amount_inr, coalesce(v.reason_text, v.reason_label), v.requested_by_role::text, v.requested_at,
         v.status::text, v.decided_by_name, v.decided_at, v.decision_note, v.gateway_status::text
  from v_refund_requests v
  where (p_status is null or p_status in ('','all') or v.status::text = p_status)
    and (p_from is null or v.requested_at >= p_from) and (p_to is null or v.requested_at < p_to + 1)
  order by v.requested_at desc;
$$;
-- ---------- 7. Student / educator side ----------
create or replace function request_refund(
  p_payment_id uuid, p_reason_code refund_reason default 'other',
  p_reason_text text default null, p_amount numeric default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare p payments; v_role refund_requester_role; v_win int; v_id uuid; v_left numeric; v_title text;
begin
  select * into p from payments where id = p_payment_id;
  if not found or p.status <> 'paid' then raise exception 'Only paid transactions can be refunded.'; end if;
  v_role := case when p.user_id = auth.uid() then 'student'
                 when p.educator_id = auth.uid() then 'educator'
                 when is_admin() then 'admin' end;
  if v_role is null then raise exception 'forbidden'; end if;
  select window_days into v_win from refund_settings;
  if v_role = 'student' and p.paid_at < now() - make_interval(days => v_win) then
    raise exception 'Refund window of % days has passed.', v_win;
  end if;
  v_left := p.amount_inr - coalesce(p.refund_amount_inr,0);
  if coalesce(p_amount, v_left) <= 0 or coalesce(p_amount, v_left) > v_left then
    raise exception 'Invalid refund amount (max %).', v_left;
  end if;
  if exists (select 1 from refund_requests where payment_id = p_payment_id and status = 'pending') then
    raise exception 'A refund request is already pending for this payment.';
  end if;
  select title into v_title from test_series where id = p.series_id;
  insert into refund_requests (payment_id, student_id, educator_id, item_type, series_id, item_title,
                               requested_by, requested_by_role, amount_inr, reason_code, reason_text)
  values (p.id, p.user_id, p.educator_id, 'test_series', p.series_id, coalesce(v_title,'Test series'),
          auth.uid(), v_role, coalesce(p_amount, v_left), p_reason_code, p_reason_text)
  returning id into v_id;
  insert into refund_events (refund_id, event_type, actor_id) values (v_id, 'requested', auth.uid());
  return v_id;
end $$;
create or replace function cancel_refund_request(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update refund_requests set status = 'cancelled', decided_at = now(), decided_by = auth.uid()
   where id = p_id and status = 'pending' and (requested_by = auth.uid() or is_admin());
  if not found then raise exception 'Nothing to cancel.'; end if;
  insert into refund_events (refund_id, event_type, actor_id) values (p_id, 'cancelled', auth.uid());
end $$;
-- ---------- 8. Admin actions: Approve / Reject buttons ----------
create or replace function approve_refund(p_id uuid, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r refund_requests; p payments; v_total numeric; v_full boolean;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from refund_requests where id = p_id for update;
  if not found then raise exception 'Refund request not found.'; end if;
  if r.status <> 'pending' then raise exception 'Request is already %.', r.status; end if;
  select * into p from payments where id = r.payment_id for update;
  if p.status <> 'paid' then raise exception 'Payment is not in a refundable state.'; end if;
  v_total := coalesce(p.refund_amount_inr,0) + r.amount_inr;
  if v_total > p.amount_inr then raise exception 'Refund exceeds the amount paid.'; end if;
  v_full := v_total >= p.amount_inr;
  update refund_requests
     set status = 'approved', decided_by = auth.uid(), decided_at = now(),
         decision_note = p_note, gateway_status = 'pending'
   where id = p_id;
  update payments
     set refund_amount_inr = v_total, refunded_at = now(),
         status = case when v_full then 'refunded' else status end
   where id = p.id;
  if v_full then
    -- free the coupon slot (history stays) and remove access
    update discount_redemptions set status = 'reversed', reversed_at = now(), reverse_reason = 'Refund ' || r.code
     where payment_id = p.id and status = 'applied';
    update series_enrollments set revoked_at = now(), revoke_reason = 'refund'
     where user_id = r.student_id and series_id = r.series_id and revoked_at is null;
  end if;
  insert into refund_events (refund_id, event_type, actor_id, note) values (p_id, 'approved', auth.uid(), p_note);
  -- An Edge Function (DB webhook on refund_requests where gateway_status='pending') calls the gateway,
  -- then record_refund_gateway_result().
  return jsonb_build_object('id', p_id, 'status', 'approved', 'full_refund', v_full);
end $$;
create or replace function reject_refund(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if char_length(btrim(coalesce(p_note,''))) < 3 then raise exception 'Please add a note explaining the rejection.'; end if;
  update refund_requests
     set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = btrim(p_note)
   where id = p_id and status = 'pending';
  if not found then raise exception 'Request not found or already decided.'; end if;
  insert into refund_events (refund_id, event_type, actor_id, note) values (p_id, 'rejected', auth.uid(), btrim(p_note));
end $$;
-- gateway callback (Edge Function / webhook, service role)
create or replace function record_refund_gateway_result(p_id uuid, p_ok boolean,
                                                        p_gateway_refund_id text default null, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update refund_requests
     set gateway_status = case when p_ok then 'processed' else 'failed' end,
         gateway_refund_id = coalesce(p_gateway_refund_id, gateway_refund_id),
         gateway_error = case when p_ok then null else p_error end,
         processed_at = case when p_ok then now() else processed_at end
   where id = p_id and status = 'approved';
  insert into refund_events (refund_id, event_type, note)
  values (p_id, case when p_ok then 'gateway_processed' else 'gateway_failed' end, p_error);
end $$;
create or replace function retry_refund_gateway(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update refund_requests set gateway_status = 'pending', gateway_error = null
   where id = p_id and status = 'approved' and gateway_status = 'failed';
  if not found then raise exception 'Nothing to retry.'; end if;
  insert into refund_events (refund_id, event_type, actor_id) values (p_id, 'gateway_retry', auth.uid());
end $$;
-- ---------- 9. Grants ----------
revoke all on function record_refund_gateway_result(uuid,boolean,text,text) from public, anon, authenticated;
grant execute on function record_refund_gateway_result(uuid,boolean,text,text) to service_role;
grant execute on function
  list_pending_refunds(int,int), list_refund_history(text,date,date,int,int), get_refund_stats(),
  export_refunds(text,date,date), request_refund(uuid,refund_reason,text,numeric),
  cancel_refund_request(uuid), approve_refund(uuid,text), reject_refund(uuid,text), retry_refund_gateway(uuid)
  to authenticated;
-- ---------- 10. RLS ----------
alter table refund_requests enable row level security;
alter table refund_events   enable row level security;
alter table refund_settings enable row level security;
drop policy if exists refund_admin_select on refund_requests;
create policy refund_admin_select on refund_requests for select to authenticated using (is_admin());
drop policy if exists refund_party_select on refund_requests;
create policy refund_party_select on refund_requests for select to authenticated
  using (student_id = auth.uid() or requested_by = auth.uid() or educator_id = auth.uid());
drop policy if exists refund_events_admin_select on refund_events;
create policy refund_events_admin_select on refund_events for select to authenticated using (is_admin());
drop policy if exists refund_settings_admin_all on refund_settings;
create policy refund_settings_admin_all on refund_settings for all to authenticated
  using (is_admin()) with check (is_admin());
revoke insert, update, delete on refund_requests, refund_events from anon, authenticated;
-- =====================================================================
-- Universal Learning â€“ Financial Analytics (Supabase / PostgreSQL)
-- Reuses: payments, refund_requests, educators, profiles, is_admin(), set_updated_at()
-- Re-runnable. Read-only page: only one new table (payouts) is needed.
-- =====================================================================



