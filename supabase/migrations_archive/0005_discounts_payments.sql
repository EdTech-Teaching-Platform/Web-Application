set search_path = public, extensions;
set check_function_bodies = off;
-- =====================================================================
-- Universal Learning â€“ Discount Management (Supabase / PostgreSQL)
-- Reuses: profiles, test_series, is_admin(), set_updated_at(), pg_trgm
-- Re-runnable: create ... if not exists / drop ... if exists / create or replace
-- =====================================================================
create extension if not exists pg_trgm;
-- ---------- 1. Enums ----------
do $$ begin create type discount_offer_type as enum ('percentage','fixed');
exception when duplicate_object then null; end $$;
do $$ begin create type discount_scope as enum ('all_test_series','selected_series');
exception when duplicate_object then null; end $$;
-- Stored status = what the admin set. "scheduled" and "expired" are computed (see v_discounts_list).
do $$ begin create type discount_status as enum ('active','inactive','archived');
exception when duplicate_object then null; end $$;
do $$ begin create type discount_event_type as enum
  ('created','edited','activated','deactivated','archived','restored');
exception when duplicate_object then null; end $$;
do $$ begin create type redemption_status as enum ('applied','reversed');
exception when duplicate_object then null; end $$;
-- ---------- 2. Tables ----------
create sequence if not exists discount_code_seq start 1001;     -- DSC-1001, DSC-1002 ...
create table if not exists discounts (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique default ('DSC-' || nextval('discount_code_seq')),
  name              text not null check (char_length(btrim(name)) between 2 and 120),
  description       text,
  coupon_code       text not null
                    check (coupon_code = upper(coupon_code) and coupon_code ~ '^[A-Z0-9_-]{3,20}$'),
  offer_type        discount_offer_type not null,
  value             numeric(10,2) not null check (value > 0),
  max_discount_inr  numeric(10,2) check (max_discount_inr is null or max_discount_inr > 0), -- cap, percentage only
  min_purchase_inr  numeric(10,2) not null default 0 check (min_purchase_inr >= 0),
  usage_limit       int check (usage_limit is null or usage_limit > 0),   -- null = Unlimited
  per_user_limit    int not null default 1 check (per_user_limit > 0),
  used_count        int not null default 0 check (used_count >= 0),       -- maintained by trigger
  starts_at         timestamptz not null default now(),
  expires_at        timestamptz,                                          -- null = never expires
  scope             discount_scope not null default 'all_test_series',
  status            discount_status not null default 'active',
  created_by        uuid references profiles(id) on delete set null,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint discounts_percent_range check (offer_type <> 'percentage' or value <= 100),
  constraint discounts_cap_only_percent check (max_discount_inr is null or offer_type = 'percentage'),
  constraint discounts_dates_ok check (expires_at is null or expires_at > starts_at)
);
create unique index if not exists discounts_coupon_uidx on discounts (coupon_code);  -- reuse blocked, even if archived
-- Which series a "selected_series" discount applies to
create table if not exists discount_series (
  discount_id uuid not null references discounts(id) on delete cascade,
  series_id   uuid not null references test_series(id) on delete cascade,
  primary key (discount_id, series_id)
);
-- Redemption history: never deleted (restrict), refunds flip status to 'reversed'
create table if not exists discount_redemptions (
  id                  uuid primary key default gen_random_uuid(),
  discount_id         uuid not null references discounts(id) on delete restrict,
  coupon_code         text not null,                       -- snapshot
  discount_name       text not null,                       -- snapshot
  offer_type          discount_offer_type not null,        -- snapshot
  offer_value         numeric(10,2) not null,              -- snapshot
  user_id             uuid references profiles(id) on delete set null,
  series_id           uuid references test_series(id) on delete set null,
  payment_id          uuid,                                -- link to your payments/orders table (add FK if you have one)
  order_amount_inr    numeric(10,2) not null check (order_amount_inr >= 0),
  discount_amount_inr numeric(10,2) not null check (discount_amount_inr >= 0),
  final_amount_inr    numeric(10,2) not null check (final_amount_inr >= 0),
  status              redemption_status not null default 'applied',
  redeemed_at         timestamptz not null default now(),
  reversed_at         timestamptz,
  reverse_reason      text
);
create unique index if not exists redemptions_payment_uidx
  on discount_redemptions (payment_id) where payment_id is not null;
-- Audit log: create / edit / activate / deactivate / archive / restore
create table if not exists discount_events (
  id            uuid primary key default gen_random_uuid(),
  discount_id   uuid not null references discounts(id) on delete restrict,
  event_type    discount_event_type not null,
  from_status   discount_status,
  to_status     discount_status,
  changes       jsonb,                                     -- {"value":{"from":10,"to":15}}
  note          text,
  actor_id      uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
-- ---------- 3. Indexes ----------
create index if not exists discounts_status_idx   on discounts (status);
create index if not exists discounts_starts_idx   on discounts (starts_at);
create index if not exists discounts_expires_idx  on discounts (expires_at);
create index if not exists discounts_created_idx  on discounts (created_at desc);
create index if not exists discounts_name_trgm    on discounts using gin (name gin_trgm_ops);
create index if not exists discounts_coupon_trgm  on discounts using gin (coupon_code gin_trgm_ops);
create index if not exists discounts_code_trgm    on discounts using gin (code gin_trgm_ops);
create index if not exists discount_series_series_idx on discount_series (series_id);
create index if not exists redemptions_disc_idx   on discount_redemptions (discount_id, redeemed_at desc);
create index if not exists redemptions_user_idx   on discount_redemptions (user_id, discount_id);
create index if not exists redemptions_time_idx   on discount_redemptions (redeemed_at desc);
create index if not exists redemptions_series_idx on discount_redemptions (series_id);
create index if not exists events_disc_idx        on discount_events (discount_id, created_at desc);
create index if not exists events_time_idx        on discount_events (created_at desc);
-- ---------- 4. Triggers ----------
drop trigger if exists trg_discounts_updated on discounts;
create trigger trg_discounts_updated before update on discounts
  for each row execute function set_updated_at();
create or replace function prevent_discount_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Discounts cannot be deleted. Archive it instead; redemption history is kept.';
end $$;
drop trigger if exists trg_discounts_no_delete on discounts;
create trigger trg_discounts_no_delete before delete on discounts
  for each row execute function prevent_discount_delete();
-- used_count = number of non-reversed redemptions
create or replace function sync_discount_used_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid := coalesce(new.discount_id, old.discount_id);
begin
  update discounts
     set used_count = (select count(*) from discount_redemptions
                        where discount_id = v_id and status = 'applied')
   where id = v_id;
  return null;
end $$;
drop trigger if exists trg_redemptions_count on discount_redemptions;
create trigger trg_redemptions_count after insert or update of status on discount_redemptions
  for each row execute function sync_discount_used_count();
-- ---------- 5. Views ----------
drop view if exists v_discount_history;
drop view if exists v_discounts_list;
create view v_discounts_list with (security_invoker = true) as
select
  d.id, d.code, d.name, d.description, d.coupon_code,
  d.offer_type, d.value, d.max_discount_inr, d.min_purchase_inr,
  d.usage_limit, d.used_count,
  case when d.usage_limit is null then null else greatest(d.usage_limit - d.used_count, 0) end as left_count,
  d.starts_at, d.expires_at, d.scope, d.status as stored_status,
  case
    when d.status = 'archived' then 'archived'
    when d.status = 'inactive' then 'inactive'
    when d.expires_at is not null and d.expires_at <= now() then 'expired'
    when d.usage_limit is not null and d.used_count >= d.usage_limit then 'expired'
    when d.starts_at > now() then 'scheduled'
    else 'active'
  end as display_status,
  case when d.offer_type = 'percentage' then trim(trailing '.' from trim(trailing '0' from d.value::text)) || '%'
       else 'â‚¹' || trim(trailing '.' from trim(trailing '0' from d.value::text)) end as value_label,
  case when d.scope = 'all_test_series' then 'All test series'
       else (select string_agg(ts.title, ', ' order by ts.title)
               from discount_series ds join test_series ts on ts.id = ds.series_id
              where ds.discount_id = d.id) end as applies_to,
  coalesce((select jsonb_agg(ds.series_id) from discount_series ds where ds.discount_id = d.id), '[]'::jsonb) as series_ids,
  d.created_by, d.created_at, d.updated_at, d.archived_at
from discounts d;
-- Feed for "Discount History" tab: admin actions + redemptions in one timeline
create view v_discount_history with (security_invoker = true) as
select e.id, e.discount_id, d.code as discount_code, d.name as discount_name, d.coupon_code,
       e.event_type::text as event_type,
       coalesce(p.full_name, 'System') as actor_name,
       null::text as student_name,
       e.changes as detail, null::numeric as amount, e.note, e.created_at as occurred_at
from discount_events e
join discounts d on d.id = e.discount_id
left join profiles p on p.id = e.actor_id
union all
select r.id, r.discount_id, d.code, r.discount_name, r.coupon_code,
       case r.status when 'applied' then 'redeemed' else 'reversed' end,
       null::text,
       p.full_name,
       jsonb_build_object('series_id', r.series_id, 'order_amount_inr', r.order_amount_inr,
                          'final_amount_inr', r.final_amount_inr),
       r.discount_amount_inr, r.reverse_reason,
       case r.status when 'applied' then r.redeemed_at else coalesce(r.reversed_at, r.redeemed_at) end
from discount_redemptions r
join discounts d on d.id = r.discount_id
left join profiles p on p.id = r.user_id;
-- ---------- 6. Read RPCs (table, cards, tabs) ----------
-- Manage Discounts tab: search + Status / Offer type / Value filters + sort + pagination
create or replace function list_discounts(
  p_search     text default null,
  p_status     text default null,      -- active|scheduled|expired|inactive|archived|null=all
  p_offer_type text default null,      -- percentage|fixed|null=all
  p_value_min  numeric default null,
  p_value_max  numeric default null,
  p_sort       text default 'created_desc',
  p_page       int default 1,
  p_size       int default 8
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select v.* from v_discounts_list v
    where (p_search is null or p_search = ''
           or v.name ilike '%'||p_search||'%'
           or v.coupon_code ilike '%'||p_search||'%'
           or v.code ilike '%'||p_search||'%')
      and (p_status is null or p_status in ('','all') or v.display_status = p_status)
      and (p_offer_type is null or p_offer_type in ('','all') or v.offer_type::text = p_offer_type)
      and (p_value_min is null or v.value >= p_value_min)
      and (p_value_max is null or v.value <= p_value_max)
  )
  select to_jsonb(f), count(*) over ()
  from f
  order by
    case p_sort when 'name_asc'     then f.name end asc,
    case p_sort when 'created_asc'  then f.created_at
                when 'expires_asc'  then f.expires_at end asc nulls last,
    case p_sort when 'created_desc' then f.created_at
                when 'expires_desc' then f.expires_at end desc nulls last,
    case p_sort when 'value_desc'   then f.value
                when 'usage_desc'   then f.used_count end desc,
    f.created_at desc
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- Summary cards on Manage Discounts
create or replace function get_discount_stats() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'total',      count(*) filter (where display_status <> 'archived'),
    'active',     count(*) filter (where display_status = 'active'),
    'scheduled',  count(*) filter (where display_status = 'scheduled'),
    'expired',    count(*) filter (where display_status = 'expired'),
    'inactive',   count(*) filter (where display_status = 'inactive'),
    'archived',   count(*) filter (where display_status = 'archived'),
    'total_redemptions', (select count(*) from discount_redemptions where status='applied'),
    'total_discount_given_inr', (select coalesce(sum(discount_amount_inr),0)
                                   from discount_redemptions where status='applied')
  ) from v_discounts_list;
$$;
-- Edit modal / row details
create or replace function get_discount(p_id uuid) returns jsonb
language sql stable security invoker as $$
  select to_jsonb(v) from v_discounts_list v where v.id = p_id;
$$;
-- Inline duplicate-code check while typing coupon code
create or replace function coupon_code_exists(p_code text, p_exclude uuid default null) returns boolean
language sql stable security invoker as $$
  select exists (select 1 from discounts
                  where coupon_code = upper(btrim(p_code)) and (p_exclude is null or id <> p_exclude));
$$;
-- Analytics & Reports tab
create or replace function get_discount_analytics(
  p_from date default (current_date - 29),
  p_to   date default current_date
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  with x as (
    select * from discount_redemptions
     where status = 'applied'
       and redeemed_at >= p_from and redeemed_at < (p_to + 1)
  )
  select jsonb_build_object(
    'kpis', (select jsonb_build_object(
        'redemptions', count(*),
        'discount_given_inr', coalesce(sum(discount_amount_inr),0),
        'revenue_after_discount_inr', coalesce(sum(final_amount_inr),0),
        'avg_discount_inr', coalesce(round(avg(discount_amount_inr),2),0),
        'unique_students', count(distinct user_id)) from x),
    'active_discounts', (select count(*) from v_discounts_list where display_status='active'),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'redemptions', c, 'discount_inr', s) order by d)
        from (select redeemed_at::date d, count(*) c, sum(discount_amount_inr) s from x group by 1) t), '[]'),
    'top_discounts', coalesce((select jsonb_agg(t) from (
        select discount_id, max(discount_name) as name, max(coupon_code) as coupon_code,
               count(*) redemptions, sum(discount_amount_inr) discount_inr, sum(final_amount_inr) revenue_inr
          from x group by discount_id order by count(*) desc limit 5) t), '[]'),
    'by_series', coalesce((select jsonb_agg(t) from (
        select x.series_id, ts.title, count(*) redemptions, sum(x.discount_amount_inr) discount_inr
          from x left join test_series ts on ts.id = x.series_id
         group by x.series_id, ts.title order by count(*) desc limit 10) t), '[]'),
    'by_offer_type', coalesce((select jsonb_agg(t) from (
        select offer_type, count(*) redemptions, sum(discount_amount_inr) discount_inr
          from x group by offer_type) t), '[]')
  ) into r;
  return r;
end $$;
-- Discount History tab: audit events + redemptions
create or replace function list_discount_history(
  p_search      text default null,
  p_event_type  text default null,     -- created|edited|activated|deactivated|archived|restored|redeemed|reversed
  p_discount_id uuid default null,
  p_from        date default null,
  p_to          date default null,
  p_page        int default 1,
  p_size        int default 10
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select h.* from v_discount_history h
    where (p_search is null or p_search = ''
           or h.discount_name ilike '%'||p_search||'%'
           or h.coupon_code   ilike '%'||p_search||'%'
           or h.discount_code ilike '%'||p_search||'%'
           or h.student_name  ilike '%'||p_search||'%')
      and (p_event_type is null or p_event_type in ('','all') or h.event_type = p_event_type)
      and (p_discount_id is null or h.discount_id = p_discount_id)
      and (p_from is null or h.occurred_at >= p_from)
      and (p_to   is null or h.occurred_at <  p_to + 1)
  )
  select to_jsonb(f), count(*) over () from f
  order by f.occurred_at desc
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- Export CSV (Analytics / History): same filters, no pagination
create or replace function export_discount_redemptions(p_from date default null, p_to date default null)
returns table (code text, name text, coupon_code text, student text, series text,
               order_amount_inr numeric, discount_amount_inr numeric, final_amount_inr numeric,
               status text, redeemed_at timestamptz)
language sql stable security invoker as $$
  select d.code, r.discount_name, r.coupon_code, p.full_name, ts.title,
         r.order_amount_inr, r.discount_amount_inr, r.final_amount_inr, r.status::text, r.redeemed_at
  from discount_redemptions r
  join discounts d on d.id = r.discount_id
  left join profiles p on p.id = r.user_id
  left join test_series ts on ts.id = r.series_id
  where (p_from is null or r.redeemed_at >= p_from) and (p_to is null or r.redeemed_at < p_to + 1)
  order by r.redeemed_at desc;
$$;
-- ---------- 7. Write RPCs (Create / Edit / row menu) ----------
-- "Create discount" button
create or replace function create_discount(
  p_name text, p_coupon_code text, p_offer_type discount_offer_type, p_value numeric,
  p_max_discount_inr numeric default null, p_min_purchase_inr numeric default 0,
  p_usage_limit int default null, p_per_user_limit int default 1,
  p_starts_at timestamptz default now(), p_expires_at timestamptz default null,
  p_scope discount_scope default 'all_test_series', p_series_ids uuid[] default '{}',
  p_description text default null, p_activate boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status discount_status := case when p_activate then 'active' else 'inactive' end;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_scope = 'selected_series' and coalesce(array_length(p_series_ids,1),0) = 0 then
    raise exception 'Select at least one test series.';
  end if;
  if exists (select 1 from discounts where coupon_code = upper(btrim(p_coupon_code))) then
    raise exception 'Coupon code % already exists.', upper(btrim(p_coupon_code));
  end if;
  insert into discounts (name, description, coupon_code, offer_type, value, max_discount_inr,
                         min_purchase_inr, usage_limit, per_user_limit, starts_at, expires_at,
                         scope, status, created_by)
  values (btrim(p_name), p_description, upper(btrim(p_coupon_code)), p_offer_type, p_value,
          p_max_discount_inr, coalesce(p_min_purchase_inr,0), p_usage_limit, coalesce(p_per_user_limit,1),
          coalesce(p_starts_at, now()), p_expires_at, p_scope, v_status, auth.uid())
  returning id into v_id;
  if p_scope = 'selected_series' then
    insert into discount_series (discount_id, series_id)
    select v_id, s from unnest(p_series_ids) s on conflict do nothing;
  end if;
  insert into discount_events (discount_id, event_type, to_status, actor_id)
  values (v_id, 'created', v_status, auth.uid());
  return v_id;
end $$;
-- Row menu â†’ Edit (patch semantics: only keys present are changed; send null to clear expires_at etc.)
create or replace function update_discount(p_id uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare o discounts; n discounts; v_diff jsonb; v_ids uuid[];
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into o from discounts where id = p_id for update;
  if not found then raise exception 'Discount not found.'; end if;
  if o.status = 'archived' then raise exception 'Archived discounts cannot be edited. Restore it first.'; end if;
  if p_patch ? 'coupon_code' and upper(btrim(p_patch->>'coupon_code')) <> o.coupon_code
     and exists (select 1 from discount_redemptions where discount_id = p_id) then
    raise exception 'Coupon code cannot change after it has been redeemed.';
  end if;
  update discounts set
    name             = case when p_patch ? 'name' then btrim(p_patch->>'name') else name end,
    description      = case when p_patch ? 'description' then p_patch->>'description' else description end,
    coupon_code      = case when p_patch ? 'coupon_code' then upper(btrim(p_patch->>'coupon_code')) else coupon_code end,
    offer_type       = case when p_patch ? 'offer_type' then (p_patch->>'offer_type')::discount_offer_type else offer_type end,
    value            = case when p_patch ? 'value' then (p_patch->>'value')::numeric else value end,
    max_discount_inr = case when p_patch ? 'max_discount_inr' then (p_patch->>'max_discount_inr')::numeric else max_discount_inr end,
    min_purchase_inr = case when p_patch ? 'min_purchase_inr' then coalesce((p_patch->>'min_purchase_inr')::numeric,0) else min_purchase_inr end,
    usage_limit      = case when p_patch ? 'usage_limit' then (p_patch->>'usage_limit')::int else usage_limit end,
    per_user_limit   = case when p_patch ? 'per_user_limit' then (p_patch->>'per_user_limit')::int else per_user_limit end,
    starts_at        = case when p_patch ? 'starts_at' then (p_patch->>'starts_at')::timestamptz else starts_at end,
    expires_at       = case when p_patch ? 'expires_at' then (p_patch->>'expires_at')::timestamptz else expires_at end,
    scope            = case when p_patch ? 'scope' then (p_patch->>'scope')::discount_scope else scope end
  where id = p_id
  returning * into n;
  if p_patch ? 'series_ids' then
    select array(select jsonb_array_elements_text(p_patch->'series_ids')::uuid) into v_ids;
    delete from discount_series where discount_id = p_id;
    if n.scope = 'selected_series' then
      if coalesce(array_length(v_ids,1),0) = 0 then raise exception 'Select at least one test series.'; end if;
      insert into discount_series (discount_id, series_id) select p_id, s from unnest(v_ids) s;
    end if;
  elsif n.scope = 'all_test_series' then
    delete from discount_series where discount_id = p_id;
  end if;
  select jsonb_object_agg(a.key, jsonb_build_object('from', a.value, 'to', b.value))
    into v_diff
    from jsonb_each(to_jsonb(o)) a join jsonb_each(to_jsonb(n)) b on a.key = b.key
   where a.value is distinct from b.value and a.key <> 'updated_at';
  insert into discount_events (discount_id, event_type, changes, actor_id)
  values (p_id, 'edited', coalesce(v_diff,'{}'::jsonb), auth.uid());
end $$;
-- Row menu â†’ Activate / Deactivate / Archive (+ Restore from archive)
create or replace function set_discount_status(p_id uuid, p_action text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d discounts; v_to discount_status; v_evt discount_event_type;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into d from discounts where id = p_id for update;
  if not found then raise exception 'Discount not found.'; end if;
  case p_action
    when 'activate' then
      if d.status = 'archived' then raise exception 'Restore the discount before activating it.'; end if;
      if d.expires_at is not null and d.expires_at <= now() then
        raise exception 'This discount has expired. Edit the expiry date first.'; end if;
      v_to := 'active';   v_evt := 'activated';
    when 'deactivate' then
      if d.status = 'archived' then raise exception 'Discount is archived.'; end if;
      v_to := 'inactive'; v_evt := 'deactivated';
    when 'archive' then
      v_to := 'archived'; v_evt := 'archived';
    when 'restore' then
      if d.status <> 'archived' then raise exception 'Discount is not archived.'; end if;
      v_to := 'inactive'; v_evt := 'restored';
    else raise exception 'Unknown action %', p_action;
  end case;
  if d.status = v_to then return; end if;
  update discounts set status = v_to,
         archived_at = case when v_to = 'archived' then now() else null end
   where id = p_id;
  insert into discount_events (discount_id, event_type, from_status, to_status, note, actor_id)
  values (p_id, v_evt, d.status, v_to, p_note, auth.uid());
end $$;
-- ---------- 8. Checkout RPCs (student-facing) ----------
-- internal calculator, not callable by clients
create or replace function _compute_coupon(p_code text, p_series_id uuid, p_amount numeric,
                                           p_user uuid, p_lock boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d discounts; v_disc numeric; v_user_uses int;
begin
  if p_lock then
    select * into d from discounts where coupon_code = upper(btrim(p_code)) for update;
  else
    select * into d from discounts where coupon_code = upper(btrim(p_code));
  end if;
  if not found then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;
  if d.status <> 'active' then return jsonb_build_object('valid', false, 'reason', 'inactive'); end if;
  if d.starts_at > now() then return jsonb_build_object('valid', false, 'reason', 'not_started'); end if;
  if d.expires_at is not null and d.expires_at <= now() then
    return jsonb_build_object('valid', false, 'reason', 'expired'); end if;
  if d.usage_limit is not null and d.used_count >= d.usage_limit then
    return jsonb_build_object('valid', false, 'reason', 'usage_limit_reached'); end if;
  if p_amount < d.min_purchase_inr then
    return jsonb_build_object('valid', false, 'reason', 'below_min_purchase', 'min_purchase_inr', d.min_purchase_inr); end if;
  if d.scope = 'selected_series' and not exists
     (select 1 from discount_series where discount_id = d.id and series_id = p_series_id) then
    return jsonb_build_object('valid', false, 'reason', 'not_applicable'); end if;
  select count(*) into v_user_uses from discount_redemptions
   where discount_id = d.id and user_id = p_user and status = 'applied';
  if v_user_uses >= d.per_user_limit then
    return jsonb_build_object('valid', false, 'reason', 'already_used'); end if;
  v_disc := case d.offer_type
    when 'percentage' then least(round(p_amount * d.value / 100, 2), coalesce(d.max_discount_inr, 'Infinity'::numeric))
    else least(d.value, p_amount) end;
  return jsonb_build_object('valid', true, 'discount_id', d.id,
    'discount_amount_inr', v_disc, 'final_amount_inr', greatest(p_amount - v_disc, 0));
end $$;
revoke all on function _compute_coupon(text, uuid, numeric, uuid, boolean) from public, anon, authenticated;
-- "Apply coupon" box at checkout
create or replace function validate_coupon(p_code text, p_series_id uuid, p_amount numeric) returns jsonb
language sql stable security definer set search_path = public as $$
  select _compute_coupon(p_code, p_series_id, p_amount, auth.uid(), false);
$$;
-- Called by the payment webhook / Edge Function (service_role) after payment success
create or replace function redeem_coupon(p_code text, p_user uuid, p_series_id uuid,
                                         p_amount numeric, p_payment_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare r jsonb; d discounts; v_id uuid;
begin
  r := _compute_coupon(p_code, p_series_id, p_amount, p_user, true);
  if not (r->>'valid')::boolean then raise exception 'Coupon not valid: %', r->>'reason'; end if;
  select * into d from discounts where id = (r->>'discount_id')::uuid;
  insert into discount_redemptions (discount_id, coupon_code, discount_name, offer_type, offer_value,
         user_id, series_id, payment_id, order_amount_inr, discount_amount_inr, final_amount_inr)
  values (d.id, d.coupon_code, d.name, d.offer_type, d.value, p_user, p_series_id, p_payment_id,
          p_amount, (r->>'discount_amount_inr')::numeric, (r->>'final_amount_inr')::numeric)
  returning id into v_id;
  return v_id;
end $$;
-- Refund â†’ frees the usage slot, history stays
create or replace function reverse_redemption(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or auth.role() = 'service_role') then raise exception 'forbidden'; end if;
  update discount_redemptions set status = 'reversed', reversed_at = now(), reverse_reason = p_reason
   where id = p_id and status = 'applied';
end $$;
-- ---------- 9. Grants ----------
revoke all on function redeem_coupon(text, uuid, uuid, numeric, uuid) from public, anon, authenticated;
grant execute on function redeem_coupon(text, uuid, uuid, numeric, uuid) to service_role;
grant execute on function list_discounts(text,text,text,numeric,numeric,text,int,int),
  get_discount_stats(), get_discount(uuid), coupon_code_exists(text,uuid),
  get_discount_analytics(date,date),
  list_discount_history(text,text,uuid,date,date,int,int), export_discount_redemptions(date,date),
  create_discount(text,text,discount_offer_type,numeric,numeric,numeric,int,int,timestamptz,timestamptz,discount_scope,uuid[],text,boolean),
  update_discount(uuid,jsonb), set_discount_status(uuid,text,text),
  validate_coupon(text,uuid,numeric), reverse_redemption(uuid,text)
  to authenticated;
-- ---------- 10. RLS ----------
alter table discounts            enable row level security;
alter table discount_series      enable row level security;
alter table discount_redemptions enable row level security;
alter table discount_events      enable row level security;
drop policy if exists discounts_admin_select on discounts;
create policy discounts_admin_select on discounts for select to authenticated using (is_admin());
drop policy if exists dseries_admin_select on discount_series;
create policy dseries_admin_select on discount_series for select to authenticated using (is_admin());
drop policy if exists dred_admin_select on discount_redemptions;
create policy dred_admin_select on discount_redemptions for select to authenticated using (is_admin());
drop policy if exists dred_own_select on discount_redemptions;
create policy dred_own_select on discount_redemptions for select to authenticated using (user_id = auth.uid());
drop policy if exists devents_admin_select on discount_events;
create policy devents_admin_select on discount_events for select to authenticated using (is_admin());
-- No insert/update/delete policies on purpose: every write goes through the security definer RPCs above.
revoke insert, update, delete on discounts, discount_series, discount_redemptions, discount_events
  from anon, authenticated;
-- =====================================================================
-- Universal Learning â€“ Transaction History (Supabase / PostgreSQL)
-- Reuses: profiles, educators, test_series, is_admin(), set_updated_at(), pg_trgm,
--         discounts / discount_redemptions (from the Discount Management schema)
-- Re-runnable.
-- =====================================================================
create extension if not exists pg_trgm;
-- ---------- 1. Enums ----------
do $$ begin create type payment_status as enum ('created','pending','paid','failed','refunded');
exception when duplicate_object then null; end $$;
alter type payment_status add value if not exists 'refunded';   -- no-op if already present
do $$ begin create type payment_method as enum ('upi','card','netbanking','wallet','emi','other');
exception when duplicate_object then null; end $$;
-- ---------- 2. Educator number (the "1006" inside PAY-EDU-1006-1002) ----------
-- If your educators table already has a numeric/code column, use that in mark_payment_paid() instead.
create sequence if not exists educator_no_seq start 1001;
alter table educators add column if not exists educator_no int default nextval('educator_no_seq');
create unique index if not exists educators_no_uidx on educators (educator_no);
-- Per-educator running counter for the last block of the transaction ID
create table if not exists educator_txn_counters (
  educator_id uuid primary key references educators(id) on delete cascade,
  last_seq    int not null default 1001
);
-- ---------- 3. payments (reuse if you already created it) ----------
create table if not exists payments (
  id                   uuid primary key default gen_random_uuid(),
  txn_code             text unique,                        -- PAY-EDU-1006-1002, set when paid
  user_id              uuid not null references profiles(id) on delete restrict,   -- student
  series_id            uuid references test_series(id) on delete set null,
  educator_id          uuid references educators(id) on delete set null,          -- snapshot at purchase
  status               payment_status not null default 'created',
  currency             text not null default 'INR',
  list_price_inr       numeric(10,2) not null default 0 check (list_price_inr >= 0),
  discount_amount_inr  numeric(10,2) not null default 0 check (discount_amount_inr >= 0),
  amount_inr           numeric(10,2) not null default 0 check (amount_inr >= 0),   -- actually charged
  discount_id          uuid references discounts(id) on delete set null,
  coupon_code          text,                               -- snapshot
  method               payment_method,
  gateway              text not null default 'razorpay',
  gateway_order_id     text,
  gateway_payment_id   text,
  platform_fee_inr     numeric(10,2) not null default 0,
  educator_earning_inr numeric(10,2) not null default 0,
  paid_at              timestamptz,
  failed_reason        text,
  refunded_at          timestamptz,
  refund_amount_inr    numeric(10,2),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- extra columns if payments already existed in an older shape
alter table payments add column if not exists txn_code text;
alter table payments add column if not exists educator_id uuid references educators(id) on delete set null;
alter table payments add column if not exists list_price_inr numeric(10,2) not null default 0;
alter table payments add column if not exists discount_amount_inr numeric(10,2) not null default 0;
alter table payments add column if not exists discount_id uuid references discounts(id) on delete set null;
alter table payments add column if not exists coupon_code text;
alter table payments add column if not exists method payment_method;
alter table payments add column if not exists gateway text not null default 'razorpay';
alter table payments add column if not exists gateway_order_id text;
alter table payments add column if not exists gateway_payment_id text;
alter table payments add column if not exists platform_fee_inr numeric(10,2) not null default 0;
alter table payments add column if not exists educator_earning_inr numeric(10,2) not null default 0;
alter table payments add column if not exists paid_at timestamptz;
alter table payments add column if not exists failed_reason text;
alter table payments add column if not exists refunded_at timestamptz;
alter table payments add column if not exists refund_amount_inr numeric(10,2);
alter table payments add column if not exists updated_at timestamptz not null default now();
create unique index if not exists payments_txn_code_uidx on payments (txn_code) where txn_code is not null;
create unique index if not exists payments_gw_payment_uidx on payments (gateway, gateway_payment_id) where gateway_payment_id is not null;
-- paid transactions can't have a missing code or date
alter table payments drop constraint if exists payments_paid_complete;
alter table payments add constraint payments_paid_complete
  check (status not in ('paid','refunded') or (txn_code is not null and paid_at is not null)) not valid;
-- (run `alter table payments validate constraint payments_paid_complete;` after you've cleaned old rows)
-- Link redemptions to payments now that payments exists
do $$ begin
  alter table discount_redemptions
    add constraint discount_redemptions_payment_fk foreign key (payment_id) references payments(id) on delete set null;
exception when duplicate_object then null; end $$;
-- Gateway / webhook trail shown in the detail drawer
create table if not exists payment_events (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid not null references payments(id) on delete cascade,
  event_type       text not null,                 -- order_created, captured, failed, refunded ...
  gateway_event_id text,
  payload          jsonb,
  created_at       timestamptz not null default now()
);
create unique index if not exists payment_events_gw_uidx on payment_events (payment_id, gateway_event_id) where gateway_event_id is not null;
-- ---------- 4. Indexes ----------
create index if not exists payments_status_paid_idx  on payments (paid_at desc) where status = 'paid';
create index if not exists payments_user_idx         on payments (user_id);
create index if not exists payments_series_idx       on payments (series_id);
create index if not exists payments_educator_idx     on payments (educator_id);
create index if not exists payments_amount_idx       on payments (amount_inr) where status = 'paid';
create index if not exists payments_txn_trgm         on payments using gin (txn_code gin_trgm_ops);
create index if not exists profiles_fullname_trgm    on profiles using gin (full_name gin_trgm_ops);
create index if not exists test_series_title_trgm    on test_series using gin (title gin_trgm_ops);
create index if not exists payment_events_pay_idx    on payment_events (payment_id, created_at);
drop trigger if exists trg_payments_updated on payments;
create trigger trg_payments_updated before update on payments for each row execute function set_updated_at();
-- ---------- 5. View: one row per paid transaction ----------
drop view if exists v_transactions;
create view v_transactions with (security_invoker = true) as
select
  p.id, p.txn_code, p.paid_at,
  p.user_id,     s.full_name as student_name,  s.email as student_email,
  p.series_id,   ts.title    as series_title,
  p.educator_id, ep.full_name as educator_name,
  p.amount_inr, p.list_price_inr, p.discount_amount_inr, p.coupon_code,
  p.method, p.gateway, p.gateway_order_id, p.gateway_payment_id,
  p.platform_fee_inr, p.educator_earning_inr, p.currency, p.created_at
from payments p
join profiles s       on s.id = p.user_id
left join test_series ts on ts.id = p.series_id
left join profiles ep on ep.id = p.educator_id        -- assumes educators.id = profiles.id
where p.status = 'paid';                              -- "Paid transactions only"
-- ---------- 6. Read RPCs ----------
-- Table: search + Filters + sort + pagination.  "Showing 1â€“8 of 8" = total_count
create or replace function list_transactions(
  p_search       text default null,      -- txn id, educator, test series, student
  p_from         date default null,
  p_to           date default null,
  p_educator_id  uuid default null,
  p_series_id    uuid default null,
  p_min_amount   numeric default null,
  p_max_amount   numeric default null,
  p_method       text default null,
  p_sort         text default 'newest',  -- newest | oldest | amount_desc | amount_asc
  p_page         int default 1,
  p_size         int default 10
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select v.* from v_transactions v
    where (p_search is null or p_search = ''
           or v.txn_code      ilike '%'||p_search||'%'
           or v.student_name  ilike '%'||p_search||'%'
           or v.educator_name ilike '%'||p_search||'%'
           or v.series_title  ilike '%'||p_search||'%')
      and (p_from is null or v.paid_at >= p_from)
      and (p_to   is null or v.paid_at <  p_to + 1)
      and (p_educator_id is null or v.educator_id = p_educator_id)
      and (p_series_id   is null or v.series_id   = p_series_id)
      and (p_min_amount  is null or v.amount_inr >= p_min_amount)
      and (p_max_amount  is null or v.amount_inr <= p_max_amount)
      and (p_method is null or p_method in ('','all') or v.method::text = p_method)
  )
  select jsonb_build_object(
           'id', f.id, 'txn_code', f.txn_code, 'paid_at', f.paid_at, 'student_name', f.student_name,
           'series_title', f.series_title, 'educator_name', f.educator_name, 'amount_inr', f.amount_inr),
         count(*) over ()
  from f
  order by
    case p_sort when 'oldest'      then f.paid_at    end asc,
    case p_sort when 'amount_asc'  then f.amount_inr end asc,
    case p_sort when 'amount_desc' then f.amount_inr end desc,
    f.paid_at desc, f.id
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- 3 cards: Total revenue / Total transactions / Avg transaction value
-- Pass the same filters to make the cards follow the table, or no args for all-time.
create or replace function get_transaction_stats(
  p_search text default null, p_from date default null, p_to date default null,
  p_educator_id uuid default null, p_series_id uuid default null,
  p_min_amount numeric default null, p_max_amount numeric default null, p_method text default null
) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'total_revenue_inr',  coalesce(sum(v.amount_inr),0),
    'total_transactions', count(*),
    'avg_value_inr',      coalesce(round(avg(v.amount_inr),2),0))
  from v_transactions v
  where (p_search is null or p_search = ''
         or v.txn_code ilike '%'||p_search||'%' or v.student_name ilike '%'||p_search||'%'
         or v.educator_name ilike '%'||p_search||'%' or v.series_title ilike '%'||p_search||'%')
    and (p_from is null or v.paid_at >= p_from) and (p_to is null or v.paid_at < p_to + 1)
    and (p_educator_id is null or v.educator_id = p_educator_id)
    and (p_series_id   is null or v.series_id   = p_series_id)
    and (p_min_amount  is null or v.amount_inr >= p_min_amount)
    and (p_max_amount  is null or v.amount_inr <= p_max_amount)
    and (p_method is null or p_method in ('','all') or v.method::text = p_method);
$$;
-- Options that populate the "Filters" dropdown
create or replace function get_transaction_filter_options() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'educators', coalesce((select jsonb_agg(jsonb_build_object('id', educator_id, 'name', educator_name) order by educator_name)
                             from (select distinct educator_id, educator_name from v_transactions where educator_id is not null) e), '[]'),
    'series',    coalesce((select jsonb_agg(jsonb_build_object('id', series_id, 'title', series_title) order by series_title)
                             from (select distinct series_id, series_title from v_transactions where series_id is not null) s), '[]'),
    'methods',   coalesce((select jsonb_agg(distinct method::text) from v_transactions where method is not null), '[]'),
    'min_amount_inr', (select min(amount_inr) from v_transactions),
    'max_amount_inr', (select max(amount_inr) from v_transactions),
    'first_date',     (select min(paid_at)::date from v_transactions),
    'last_date',      (select max(paid_at)::date from v_transactions));
$$;
-- Row click â†’ full detail panel
create or replace function get_transaction(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'id', p.id, 'txn_code', p.txn_code, 'status', p.status, 'paid_at', p.paid_at, 'created_at', p.created_at,
    'student', jsonb_build_object('id', s.id, 'name', s.full_name, 'email', s.email),
    'series',  jsonb_build_object('id', ts.id, 'title', ts.title),
    'educator', jsonb_build_object('id', ep.id, 'name', ep.full_name),
    'amounts', jsonb_build_object('list_price_inr', p.list_price_inr, 'discount_inr', p.discount_amount_inr,
                                  'paid_inr', p.amount_inr, 'platform_fee_inr', p.platform_fee_inr,
                                  'educator_earning_inr', p.educator_earning_inr, 'currency', p.currency),
    'coupon', case when p.coupon_code is null then null
                   else jsonb_build_object('code', p.coupon_code, 'discount_id', p.discount_id) end,
    'method', p.method, 'gateway', p.gateway,
    'gateway_order_id', p.gateway_order_id, 'gateway_payment_id', p.gateway_payment_id,
    'refund', case when p.refunded_at is null then null
                   else jsonb_build_object('at', p.refunded_at, 'amount_inr', p.refund_amount_inr) end,
    'events', coalesce((select jsonb_agg(jsonb_build_object('type', e.event_type, 'at', e.created_at) order by e.created_at)
                          from payment_events e where e.payment_id = p.id), '[]'))
  into r
  from payments p
  join profiles s on s.id = p.user_id
  left join test_series ts on ts.id = p.series_id
  left join profiles ep on ep.id = p.educator_id
  where p.id = p_id and p.status = 'paid';
  return r;
end $$;
-- Export CSV (same filters as the table, no pagination)
create or replace function export_transactions(
  p_search text default null, p_from date default null, p_to date default null,
  p_educator_id uuid default null, p_series_id uuid default null,
  p_min_amount numeric default null, p_max_amount numeric default null,
  p_method text default null, p_sort text default 'newest'
) returns table (transaction_id text, paid_at timestamptz, student text, student_email text,
                 test_series text, educator text, list_price_inr numeric, discount_inr numeric,
                 coupon text, amount_inr numeric, method text, gateway_payment_id text)
language sql stable security invoker as $$
  select v.txn_code, v.paid_at, v.student_name, v.student_email, v.series_title, v.educator_name,
         v.list_price_inr, v.discount_amount_inr, v.coupon_code, v.amount_inr, v.method::text, v.gateway_payment_id
  from v_transactions v
  where (p_search is null or p_search = ''
         or v.txn_code ilike '%'||p_search||'%' or v.student_name ilike '%'||p_search||'%'
         or v.educator_name ilike '%'||p_search||'%' or v.series_title ilike '%'||p_search||'%')
    and (p_from is null or v.paid_at >= p_from) and (p_to is null or v.paid_at < p_to + 1)
    and (p_educator_id is null or v.educator_id = p_educator_id)
    and (p_series_id   is null or v.series_id   = p_series_id)
    and (p_min_amount  is null or v.amount_inr >= p_min_amount)
    and (p_max_amount  is null or v.amount_inr <= p_max_amount)
    and (p_method is null or p_method in ('','all') or v.method::text = p_method)
  order by
    case p_sort when 'oldest' then v.paid_at end asc,
    case p_sort when 'amount_asc' then v.amount_inr end asc,
    case p_sort when 'amount_desc' then v.amount_inr end desc,
    v.paid_at desc;
$$;
-- ---------- 7. Write side (called by your payment webhook / Edge Function, service role) ----------
-- Marks a payment as paid and issues PAY-EDU-<educator_no>-<seq>. Idempotent.
create or replace function mark_payment_paid(
  p_payment_id uuid, p_gateway_payment_id text, p_method payment_method default 'other',
  p_paid_at timestamptz default now(), p_platform_fee_inr numeric default 0
) returns text
language plpgsql security definer set search_path = public as $$
declare p payments; v_no int; v_seq int; v_code text;
begin
  select * into p from payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found.'; end if;
  if p.status = 'paid' then return p.txn_code; end if;               -- webhook retry
  if p.educator_id is null then raise exception 'Payment has no educator.'; end if;
  select educator_no into v_no from educators where id = p.educator_id;
  insert into educator_txn_counters as c (educator_id, last_seq) values (p.educator_id, 1002)
  on conflict (educator_id) do update set last_seq = c.last_seq + 1
  returning last_seq into v_seq;
  v_code := 'PAY-EDU-' || v_no || '-' || v_seq;
  update payments set status = 'paid', txn_code = v_code, paid_at = p_paid_at,
         gateway_payment_id = p_gateway_payment_id, method = p_method,
         platform_fee_inr = p_platform_fee_inr,
         educator_earning_inr = greatest(amount_inr - p_platform_fee_inr, 0)
   where id = p_payment_id;
  insert into payment_events (payment_id, event_type, gateway_event_id)
  values (p_payment_id, 'captured', p_gateway_payment_id) on conflict do nothing;
  return v_code;
end $$;
create or replace function mark_payment_refunded(p_payment_id uuid, p_amount numeric default null, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or auth.role() = 'service_role') then raise exception 'forbidden'; end if;
  update payments set status = 'refunded', refunded_at = now(),
         refund_amount_inr = coalesce(p_amount, amount_inr)
   where id = p_payment_id and status = 'paid';
  insert into payment_events (payment_id, event_type, payload)
  values (p_payment_id, 'refunded', jsonb_build_object('reason', p_reason));
  -- frees the coupon slot, history stays
  update discount_redemptions set status = 'reversed', reversed_at = now(), reverse_reason = p_reason
   where payment_id = p_payment_id and status = 'applied';
end $$;
-- ---------- 8. Grants ----------
revoke all on function mark_payment_paid(uuid,text,payment_method,timestamptz,numeric) from public, anon, authenticated;
grant execute on function mark_payment_paid(uuid,text,payment_method,timestamptz,numeric) to service_role;
revoke all on function mark_payment_refunded(uuid,numeric,text) from public, anon;
grant execute on function mark_payment_refunded(uuid,numeric,text) to authenticated, service_role;
grant execute on function
  list_transactions(text,date,date,uuid,uuid,numeric,numeric,text,text,int,int),
  get_transaction_stats(text,date,date,uuid,uuid,numeric,numeric,text),
  get_transaction_filter_options(), get_transaction(uuid),
  export_transactions(text,date,date,uuid,uuid,numeric,numeric,text,text)
  to authenticated;
-- ---------- 9. RLS ----------
alter table payments               enable row level security;
alter table payment_events         enable row level security;
alter table educator_txn_counters  enable row level security;
drop policy if exists payments_admin_select on payments;
create policy payments_admin_select on payments for select to authenticated using (is_admin());
drop policy if exists payments_own_select on payments;
create policy payments_own_select on payments for select to authenticated
  using (user_id = auth.uid() or educator_id = auth.uid());        -- student sees own, educator sees own sales
drop policy if exists pevents_admin_select on payment_events;
create policy pevents_admin_select on payment_events for select to authenticated using (is_admin());
-- educator_txn_counters: no policies (service/definer only)
revoke insert, update, delete on payments, payment_events, educator_txn_counters from anon, authenticated;
-- =====================================================================
-- Universal Learning â€“ Refund Management (Supabase / PostgreSQL)
-- Reuses: profiles, educators, test_series, payments, series_enrollments,
--         discount_redemptions, is_admin(), set_updated_at()
-- Re-runnable.
-- =====================================================================



