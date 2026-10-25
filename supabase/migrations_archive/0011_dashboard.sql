set search_path = public, extensions;
set check_function_bodies = off;
-- =====================================================================
-- Universal Learning â€“ Admin Dashboard (incl. sidebar, top bar, widgets)
-- Reuses: profiles, students, educators, test_series, test_assignments, test_attempts, payments,
--         series_enrollments, regions, institutions, notification_recipients/notifications,
--         is_admin(), set_updated_at(), pg_trgm
-- Re-runnable.
-- =====================================================================
create extension if not exists pg_trgm;
-- ---------- 1. Security helpers ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role::text = 'admin') $$;
-- stop users promoting themselves
revoke update (role) on profiles from authenticated;
-- ---------- 2. Small additions to existing tables ----------
alter table profiles  add column if not exists avatar_url text;
alter table profiles  add column if not exists state_code text references regions(code);   -- Students by Region
alter table educators add column if not exists submitted_at timestamptz default now();      -- "Submitted Sep 12"
update educators set submitted_at = coalesce(submitted_at, now()) where submitted_at is null;
create index if not exists profiles_created_idx     on profiles (created_at);
create index if not exists profiles_state_idx       on profiles (state_code);
create index if not exists profiles_name_trgm       on profiles using gin (full_name gin_trgm_ops);
create index if not exists profiles_email_trgm      on profiles using gin (email gin_trgm_ops);
create index if not exists test_series_title_trgm2  on test_series using gin (title gin_trgm_ops);
create index if not exists educators_pending_idx    on educators (submitted_at desc) where verification_status = 'pending'::educator_verification;
create index if not exists assignments_open_idx     on test_assignments (deadline) where status not in ('approved'::assignment_status, 'rejected'::assignment_status);
create index if not exists payments_paid_idx2       on payments (paid_at) where status = 'paid';
-- ---------- 3. Dashboard-only tables ----------
create table if not exists app_settings (                 -- welcome quote, illustration, etc.
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into app_settings (key, value) values
  ('dashboard_quote', '"Empowering educators. Enabling learners. Building brighter futures."')
on conflict (key) do nothing;
create table if not exists admin_notes (                  -- Scratchpad / "My Notepad"
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references profiles(id) on delete cascade,
  text       text not null check (char_length(btrim(text)) between 1 and 500),
  is_done    boolean not null default false,
  done_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table admin_notes add column if not exists done_at timestamptz;
alter table admin_notes add column if not exists updated_at timestamptz not null default now();
create index if not exists admin_notes_admin_idx on admin_notes (admin_id, created_at);
drop trigger if exists trg_admin_notes_updated on admin_notes;
create trigger trg_admin_notes_updated before update on admin_notes for each row execute function set_updated_at();
create table if not exists admin_nav_items (              -- left sidebar, data-driven
  key        text primary key,
  section    text not null,                               -- overview | test_series | management | finance | system
  label      text not null,
  route      text not null,
  icon       text,
  badge_key  text,                                        -- which pending-count to show, if any
  sort_order int not null default 0,
  is_active  boolean not null default true
);
insert into admin_nav_items (key, section, label, route, icon, badge_key, sort_order) values
 ('dashboard',          'overview',    'Dashboard',                 '/admin',                      'layout-dashboard', null, 10),
 ('create_test_series', 'test_series', 'Create Test Series',        '/admin/test-series',          'file-plus',        null, 20),
 ('assign_educators',   'test_series', 'Assign Educators',          '/admin/assign-educators',     'user-check',       'series_approvals', 30),
 ('test_series_tracker','test_series', 'Test Series Tracker',       '/admin/test-series-tracker',  'list-checks',      null, 40),
 ('test_performance',   'test_series', 'Test Performance Analytics','/admin/test-performance',     'bar-chart',        null, 50),
 ('student_management', 'management',  'Student Management',       '/admin/students',             'graduation-cap',   null, 60),
 ('educator_management','management',  'Educator Management',      '/admin/educators',            'users',            'educator_verifications', 70),
 ('discount_management','management',  'Discount Management',      '/admin/discounts',            'percent',          null, 80),
 ('transaction_history','finance',     'Transaction History',      '/admin/transactions',         'credit-card',      null, 90),
 ('refund_management',  'finance',     'Refund Management',        '/admin/refunds',              'rotate-ccw',       'refunds', 100),
 ('financial_analytics','finance',     'Financial Analytics',      '/admin/financial-analytics',  'line-chart',       null, 110),
 ('regional_growth',    'finance',     'Regional Growth',          '/admin/regional-growth',      'map',              null, 120),
 ('reports_builder',    'finance',     'Reports Builder',          '/admin/reports',              'file-text',        null, 130),
 ('content_moderation', 'system',      'Content Moderation',       '/admin/moderation',           'shield',           'moderation', 140),
 ('publish_notifications','system',    'Publish Notifications',    '/admin/notifications',        'bell',             null, 150),
 ('callback_request',   'system',      'Callback Request',         '/admin/callback-requests',    'phone',            'callbacks', 160)
on conflict (key) do update set label = excluded.label, route = excluded.route, section = excluded.section,
  icon = excluded.icon, badge_key = excluded.badge_key, sort_order = excluded.sort_order;
-- ---------- 4. Small helpers ----------
create or replace function _initials(p_name text) returns text language sql immutable as $$
  with n as (select regexp_split_to_array(btrim(regexp_replace(coalesce(p_name,''), '^(dr|mr|mrs|ms|prof)\.?\s+', '', 'i')), '\s+') a)
  select upper(left(a[1],1) || case when array_length(a,1) > 1 then left(a[array_length(a,1)],1) else '' end) from n;
$$;
-- count rows in a table that may not exist yet (Callback Request / Content Moderation / Refunds pages)
create or replace function _count_if_exists(p_table text, p_where text) returns int
language plpgsql stable security definer set search_path = public as $$
declare n int := 0;
begin
  if to_regclass('public.' || p_table) is not null then
    execute format('select count(*) from public.%I where %s', p_table, p_where) into n;
  end if;
  return n;
end $$;
revoke all on function _count_if_exists(text,text) from public, anon, authenticated;
-- ---------- 5. Left panel + top bar ----------
-- Sidebar (sections, links, optional pending badges)
create or replace function get_admin_nav() returns jsonb
language plpgsql stable security definer set search_path = public as $admin_nav$
declare v_counts jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  v_counts := jsonb_build_object(
    'educator_verifications', (select count(*) from educators where verification_status::text = 'pending'),
    'series_approvals',      (select count(*) from test_assignments where status::text not in ('approved','rejected')),
    'refunds',               _count_if_exists('refund_requests', $$status = 'pending'$$),
    'callbacks',             _count_if_exists('callback_requests', $$status = 'pending'$$),
    'moderation',            _count_if_exists('content_reports', $$status = 'pending'$$));
  return coalesce((
    select jsonb_agg(jsonb_build_object('key', key, 'section', section, 'label', label, 'route', route, 'icon', icon,
             'badge', nullif((v_counts->>badge_key)::int, 0)) order by sort_order)
      from admin_nav_items where is_active), '[]'::jsonb);
end $admin_nav$;
-- bottom-left "Admin User / Admin" and top-right profile button
create or replace function get_admin_me() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email, 'avatar_url', p.avatar_url,
                            'initials', _initials(p.full_name), 'role', initcap(p.role::text))
  from profiles p where p.id = auth.uid() and is_admin();
$$;
-- Top search bar: "Search learners, educators, coursesâ€¦"
create or replace function global_search(p_q text, p_limit int default 5) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q text := btrim(coalesce(p_q,''));
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if char_length(q) < 2 then return jsonb_build_object('students','[]','educators','[]','series','[]'); end if;
  return jsonb_build_object(
    'students',  coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.full_name, 'sublabel', p.email))
                  from (select pr.* from students s join profiles pr on pr.id = s.id
                         where pr.full_name ilike '%'||q||'%' or pr.email ilike '%'||q||'%'
                         order by pr.full_name limit p_limit) p), '[]'),
    'educators', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'label', p.full_name, 'sublabel', p.email))
                  from (select pr.* from educators e join profiles pr on pr.id = e.id
                         where pr.full_name ilike '%'||q||'%' or pr.email ilike '%'||q||'%'
                         order by pr.full_name limit p_limit) p), '[]'),
    'series',    coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'label', t.title, 'sublabel', t.status::text))
                  from (select id, title, status from test_series
                         where deleted_at is null and title ilike '%'||q||'%' order by title limit p_limit) t), '[]'));
end $$;
-- Bell icon (with dot): uses the in-app inbox from Publish Notifications
--   get_my_unread_notification_count(), list_my_notifications(), mark_notification_read(), mark_all_notifications_read()
-- ---------- 6. Welcome card ----------
create or replace function get_dashboard_header() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', coalesce(split_part(p.full_name, ' ', 1), 'Admin'),
    'today', (now() at time zone 'Asia/Kolkata')::date,                 -- "TODAY 14 Oct 2026"
    'quote', (select value #>> '{}' from app_settings where key = 'dashboard_quote'))
  from profiles p where p.id = auth.uid() and is_admin();
$$;
-- ---------- 7. Stat cards: Total Students / Educators / Test Series (+ % vs last month + sparkline) ----------
create or replace function _cumulative_series(p_kind text, p_days int default 31)
returns table (day date, total bigint) language sql stable security definer set search_path = public as $$
  with src as (
    select pr.created_at as ts from students st join profiles pr on pr.id = st.id where p_kind = 'students'
    union all
    select pr.created_at from educators e join profiles pr on pr.id = e.id where p_kind = 'educators'
    union all
    select t.created_at from test_series t where p_kind = 'series' and t.status::text = 'published' and t.deleted_at is null
  ), days as (
    select generate_series((now() at time zone 'Asia/Kolkata')::date - (p_days - 1),
                           (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date d)
  select d, (select count(*) from src where (ts at time zone 'Asia/Kolkata')::date <= d) from days order by d;
$$;
revoke all on function _cumulative_series(text,int) from public, anon, authenticated;
create or replace function _stat_card(p_kind text) returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (select * from _cumulative_series(p_kind, 31))
  select jsonb_build_object(
    'total',      (select total from s order by day desc limit 1),
    'previous',   (select total from s order by day asc limit 1),
    'growth_pct', (select case when f.total > 0 then round((l.total - f.total)::numeric / f.total * 100) end
                     from (select total from s order by day asc limit 1) f,
                          (select total from s order by day desc limit 1) l),
    'sparkline',  (select jsonb_agg(total order by day) from s));
$$;
revoke all on function _stat_card(text) from public, anon, authenticated;
create or replace function get_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object('students', _stat_card('students'), 'educators', _stat_card('educators'),
                            'test_series', _stat_card('series'));
end $$;
-- ---------- 8. Platform Revenue (â‚¹8,820 +18%, line chart, hover value) ----------
create or replace function get_dashboard_revenue(p_days int default 60, p_granularity text default 'week')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare g text := case when p_granularity in ('day','week','month') then p_granularity else 'week' end;
        v_to date := (now() at time zone 'Asia/Kolkata')::date;
        v_from date; t0 timestamptz; t1 timestamptz; cur numeric; prv numeric;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  v_from := v_to - (p_days - 1);
  t0 := v_from::timestamp at time zone 'Asia/Kolkata';
  t1 := (v_to + 1)::timestamp at time zone 'Asia/Kolkata';
  select coalesce(sum(amount_inr) filter (where paid_at >= t0 and paid_at < t1), 0),
         coalesce(sum(amount_inr) filter (where paid_at >= t0 - make_interval(days => p_days) and paid_at < t0), 0)
    into cur, prv
    from payments where status = 'paid' and paid_at >= t0 - make_interval(days => p_days);
  return jsonb_build_object(
    'total_inr', cur, 'previous_inr', prv,
    'change_pct', case when prv > 0 then round((cur - prv) / prv * 100) end,
    'series', coalesce((
      with b as (select generate_series(date_trunc(g, v_from::timestamp)::date, v_to, ('1 ' || g)::interval)::date d),
           r as (select date_trunc(g, paid_at at time zone 'Asia/Kolkata')::date d, sum(amount_inr) amt
                   from payments where status = 'paid' and paid_at >= t0 and paid_at < t1 group by 1)
      select jsonb_agg(jsonb_build_object('bucket', b.d, 'revenue_inr', coalesce(r.amt, 0)) order by b.d)
        from b left join r on r.d = b.d), '[]'::jsonb));
end $$;
-- ---------- 9. High-priority approvals ----------
-- Educator Verifications (Review button â†’ /admin/educators/<id>, See all â†’ Educator Management)
create or replace function get_pending_educator_verifications(p_limit int default 3) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'total_pending', (select count(*) from educators where verification_status::text = 'pending'),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'name', x.full_name, 'initials', _initials(x.full_name),
               'submitted_at', x.submitted_at,
               'submitted_label', 'Submitted ' || to_char(x.submitted_at at time zone 'Asia/Kolkata', 'Mon FMDD')) order by x.submitted_at desc)
        from (select e.id, p.full_name, coalesce(e.submitted_at, p.created_at) as submitted_at
                from educators e join profiles p on p.id = e.id
               where e.verification_status::text = 'pending'
               order by coalesce(e.submitted_at, p.created_at) desc limit p_limit) x), '[]'::jsonb));
end $$;
-- Test Series Approvals (Overdue badge; row click â†’ Assign Educators / Tracker)
create or replace function get_series_approvals(p_limit int default 3) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'total_pending', (select count(*) from test_assignments where status::text not in ('approved','rejected')),
    'total_overdue', (select count(*) from test_assignments
                       where status::text not in ('approved','rejected') and due_date < current_date),
    'items', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.is_overdue desc, x.due_date nulls last)
        from (select a.id, a.series_id, s.title, ep.full_name as educator_name, a.status::text as status, a.due_date,
                     (a.due_date is not null and a.due_date < current_date) as is_overdue
                from test_assignments a
                join test_series s on s.id = a.series_id
                left join profiles ep on ep.id = a.educator_id
               where a.status::text not in ('approved','rejected') and s.deleted_at is null
               order by (a.due_date < current_date) desc nulls last, a.due_date nulls last
               limit p_limit) x), '[]'::jsonb));
end $$;
-- ---------- 10. Top Performing Test Series (View all â†’ Test Performance Analytics) ----------
create or replace function get_top_series(p_limit int default 4, p_min_attempts int default 1) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.avg_score desc, x.attempts desc)
      from (select s.id, s.title, round(avg(t.percentage), 1) as avg_score, count(*) as attempts
              from test_series s join test_attempts t on t.series_id = s.id
             where s.status::text = 'published' and s.deleted_at is null
             group by s.id, s.title
            having count(*) >= p_min_attempts
             order by avg(t.percentage) desc, count(*) desc limit p_limit) x), '[]'::jsonb);
end $$;
-- ---------- 11. Students by Region (list + map legend + "5,548 students across 8 regions") ----------
create or replace function get_students_by_region(p_limit int default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  with s as (
    select coalesce(pr.state_code, i.state_code) as sc
      from students st
      join profiles pr on pr.id = st.id
      left join institutions i on i.id = pr.institution_id),
  c as (select sc, count(*) n from s where sc is not null group by sc)
  select jsonb_build_object(
    'total_students', (select coalesce(sum(n), 0) from c),
    'regions_count',  (select count(*) from c),
    'legend', jsonb_build_array('2000+','500-2000','100-500','<100'),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('state_code', x.sc, 'name', x.name, 'students', x.n,
               'bucket', case when x.n >= 2000 then '2000+' when x.n >= 500 then '500-2000'
                              when x.n >= 100 then '100-500' else '<100' end) order by x.n desc, x.name)
        from (select c.sc, rg.name, c.n from c join regions rg on rg.code = c.sc
               order by c.n desc, rg.name limit coalesce(p_limit, 1000)) x), '[]'::jsonb))
  into r;
  return r;
end $$;
-- ---------- 12. One call for the whole page ----------
create or replace function get_admin_dashboard(p_revenue_days int default 60) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'header',                 get_dashboard_header(),
    'stats',                  get_dashboard_stats(),
    'revenue',                get_dashboard_revenue(p_revenue_days),
    'educator_verifications', get_pending_educator_verifications(3),
    'series_approvals',       get_series_approvals(3),
    'top_series',             get_top_series(4),
    'students_by_region',     get_students_by_region(6));      -- the map uses the full list: get_students_by_region()
end $$;
-- ---------- 13. Scratchpad / "My Notepad" ----------
create or replace function list_my_notes() returns jsonb
language sql stable security invoker as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'text', text, 'is_done', is_done, 'created_at', created_at)
                            order by created_at), '[]'::jsonb)
  from admin_notes where admin_id = auth.uid();
$$;
create or replace function add_admin_note(p_text text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if (select count(*) from admin_notes where admin_id = auth.uid()) >= 100 then
    raise exception 'Notepad is full (100 notes). Clear some completed notes first.'; end if;
  insert into admin_notes (admin_id, text) values (auth.uid(), btrim(p_text)) returning id into v_id;   -- the send âž¤ button
  return v_id;
end $$;
create or replace function toggle_admin_note(p_id uuid, p_done boolean) returns void
language sql security invoker as $$
  update admin_notes set is_done = p_done, done_at = case when p_done then now() end
   where id = p_id and admin_id = auth.uid();
$$;
create or replace function update_admin_note(p_id uuid, p_text text) returns void
language sql security invoker as $$
  update admin_notes set text = btrim(p_text) where id = p_id and admin_id = auth.uid();
$$;
create or replace function delete_admin_note(p_id uuid) returns void
language sql security invoker as $$
  delete from admin_notes where id = p_id and admin_id = auth.uid();
$$;
create or replace function clear_done_notes() returns int
language plpgsql security invoker as $$
declare n int;
begin
  delete from admin_notes where admin_id = auth.uid() and is_done;
  get diagnostics n = row_count; return n;
end $$;
-- ---------- 14. Grants ----------
revoke execute on function get_admin_nav(), get_admin_me(), global_search(text,int), get_dashboard_header(),
  get_dashboard_stats(), get_dashboard_revenue(int,text), get_pending_educator_verifications(int),
  get_series_approvals(int), get_top_series(int,int), get_students_by_region(int), get_admin_dashboard(int),
  add_admin_note(text) from public, anon;
grant execute on function get_admin_nav(), get_admin_me(), global_search(text,int), get_dashboard_header(),
  get_dashboard_stats(), get_dashboard_revenue(int,text), get_pending_educator_verifications(int),
  get_series_approvals(int), get_top_series(int,int), get_students_by_region(int), get_admin_dashboard(int),
  list_my_notes(), add_admin_note(text), toggle_admin_note(uuid,boolean), update_admin_note(uuid,text),
  delete_admin_note(uuid), clear_done_notes() to authenticated;
-- ---------- 15. RLS ----------
alter table admin_notes     enable row level security;
alter table app_settings    enable row level security;
alter table admin_nav_items enable row level security;
drop policy if exists admin_notes_own on admin_notes;
create policy admin_notes_own on admin_notes for all to authenticated
  using (admin_id = auth.uid() and is_admin()) with check (admin_id = auth.uid() and is_admin());
drop policy if exists app_settings_read on app_settings;
create policy app_settings_read on app_settings for select to authenticated using (true);
drop policy if exists app_settings_admin_write on app_settings;
create policy app_settings_admin_write on app_settings for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists nav_admin_read on admin_nav_items;
create policy nav_admin_read on admin_nav_items for select to authenticated using (is_admin());
revoke insert, update, delete on admin_nav_items from anon, authenticated;
-- =====================================================================
-- UNIVERSAL LEARNING - TEST SERIES PAGE (Admin) - Supabase SQL
-- =====================================================================
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;
