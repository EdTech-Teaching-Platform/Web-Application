-- =====================================================================
-- Universal Learning – Admin Dashboard (incl. sidebar, top bar, widgets)
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
create index if not exists educators_pending_idx    on educators (submitted_at desc) where verification_status::text = 'pending';
create index if not exists assignments_open_idx     on test_assignments (due_date) where status::text not in ('approved','rejected');
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
language plpgsql stable security definer set search_path = public as $$
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
end $$;
-- bottom-left "Admin User / Admin" and top-right profile button
create or replace function get_admin_me() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email, 'avatar_url', p.avatar_url,
                            'initials', _initials(p.full_name), 'role', initcap(p.role::text))
  from profiles p where p.id = auth.uid() and is_admin();
$$;
-- Top search bar: "Search learners, educators, courses…"
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
-- ---------- 8. Platform Revenue (₹8,820 +18%, line chart, hover value) ----------
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
-- Educator Verifications (Review button → /admin/educators/<id>, See all → Educator Management)
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
-- Test Series Approvals (Overdue badge; row click → Assign Educators / Tracker)
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
-- ---------- 10. Top Performing Test Series (View all → Test Performance Analytics) ----------
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
  insert into admin_notes (admin_id, text) values (auth.uid(), btrim(p_text)) returning id into v_id;   -- the send ➤ button
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
-- ---------------------------------------------------------------- ENUMS
create type user_role         as enum ('admin','educator','student','regional_head');
create type series_status     as enum ('draft','scheduled','published','archived');
create type test_status       as enum ('draft','published');
create type start_method      as enum ('scratch','duplicate','csv','ai');
create type pricing_type      as enum ('free','paid');
create type question_type     as enum ('mcq','multi_select','true_false','short_answer','long_answer');
create type difficulty_lvl    as enum ('easy','medium','hard');
create type attempt_status    as enum ('in_progress','submitted','expired');
create type ai_job_status     as enum ('queued','running','completed','failed','saved');
create type ai_gen_mode       as enum ('full','structure_only','questions_for_structure');
create type ai_input_source   as enum ('form','paste_paper');
create type assignment_status as enum ('assigned','in_progress','submitted','under_review',
                                       'revision_requested','approved','rejected','completed','cancelled');
-- --------------------------------------------------------------- HELPERS
create or replace function set_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;
-- -------------------------------------------------------------- PROFILES
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  email      text unique not null,
  role       user_role not null default 'student',
  state      text,
  created_at timestamptz default now()
);
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;
-- -------------------------------------------------------------- SUBJECTS
create table subjects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  icon_key   text,
  is_custom  boolean not null default false,       -- created via "Other..."
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
create unique index uq_subjects_name on subjects (lower(name));
-- ----------------------------------------------------------- TEST SERIES
create table test_series (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique,                           -- TS-1001 (search by ID)
  title              text not null check (char_length(btrim(title)) between 3 and 150),
  about              text,                                  -- rich text
  who_for            text,
  audience           text,                                  -- "JEE Aspirants"
  syllabus           text,                                  -- rich text
  series_type        text not null default 'own' check (series_type = 'own'),
  start_method       start_method,
  pricing            pricing_type not null default 'free',
  price_inr          numeric(10,2) not null default 0 check (price_inr >= 0),
  is_free            boolean generated always as (price_inr = 0) stored,
  grade              text,
  subject_id         uuid references subjects(id),
  exam               text,
  level              text check (level in ('Beginner','Intermediate','Advanced')),
  languages          text[] not null default '{}',
  go_live_mode       text not null default 'now' check (go_live_mode in ('now','schedule')),
  go_live_at         timestamptz,
  availability_mode  text not null default 'always' check (availability_mode in ('always','window')),
  start_date         date,                                  -- list page "Date Range"
  end_date           date,
  monthly_limit      int check (monthly_limit is null or monthly_limit >= 1),   -- null = unlimited
  access_days        int check (access_days   is null or access_days   >= 1),   -- null = lifetime
  late_allowed       boolean not null default false,
  late_grace_minutes int check (late_grace_minutes is null or late_grace_minutes > 0),
  build_deadline     date,
  status             series_status not null default 'draft',
  published_at       timestamptz,
  cover_path         text,
  wizard_state       jsonb,                                 -- draft autosave
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,                           -- soft delete (three dots > Delete)
  constraint chk_paid_price check (pricing = 'free' or price_inr > 0),
  constraint chk_window     check (availability_mode <> 'window' or (start_date is not null and end_date is not null and end_date >= start_date)),
  constraint chk_golive     check (go_live_mode <> 'schedule' or go_live_at is not null),
  constraint chk_late       check (not late_allowed or late_grace_minutes is not null)
);
create trigger trg_series_updated before update on test_series for each row execute function set_updated_at();
create sequence test_series_code_seq start 1001;
create or replace function gen_series_code() returns trigger language plpgsql as
$$ begin if new.code is null then new.code := 'TS-' || nextval('test_series_code_seq'); end if; return new; end $$;
create trigger trg_series_code before insert on test_series for each row execute function gen_series_code();
-- ----------------------------------------------------------------- TESTS
create table tests (
  id                uuid primary key default gen_random_uuid(),
  series_id         uuid not null references test_series(id) on delete cascade,
  position          int  not null default 1,
  title             text not null,
  instructions      text,
  duration_minutes  int  not null default 60 check (duration_minutes > 0),
  total_marks       numeric(8,2) not null default 0,
  passing_percent   numeric(5,2) default 40 check (passing_percent between 0 and 100),
  passing_marks     numeric(8,2),
  attempt_limit     int  not null default 1 check (attempt_limit >= 1),
  window_mode       text not null default 'inherit' check (window_mode in ('inherit','custom')),
  open_at           timestamptz,
  close_at          timestamptz,
  scheduled_at      timestamptz,
  shuffle_questions boolean not null default false,
  shuffle_options   boolean not null default false,
  planned_questions int not null default 0,
  topics            text[] not null default '{}',
  status            test_status not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint chk_test_window check (window_mode <> 'custom' or (open_at is not null and close_at is not null and open_at < close_at)),
  unique (series_id, position) deferrable initially deferred
);
create trigger trg_tests_updated before update on tests for each row execute function set_updated_at();
create table test_sections (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references tests(id) on delete cascade,
  position     int  not null,
  name         text not null,
  instructions text,
  planned_questions int,
  planned_marks     numeric(8,2),
  unique (test_id, position)
);
-- ------------------------------------------------------------- QUESTIONS
create table ai_test_jobs (
  id                      uuid primary key default gen_random_uuid(),
  requested_by            uuid not null references profiles(id),
  input_source            ai_input_source not null default 'form',
  pasted_text             text,
  test_name               text not null,
  subject_id              uuid references subjects(id),
  custom_subject          text,
  topics                  text[] default '{}',
  exam_type               text,
  difficulty              text check (difficulty in ('Easy','Medium','Hard','Mixed')),
  total_marks             int,
  duration_minutes        int,
  num_questions           int check (num_questions between 1 and 300),
  num_sections            int check (num_sections between 1 and 10),
  question_types          text[] default '{mcq}',
  negative_marking        boolean default false,
  negative_mark_value     numeric(4,2) default 1,
  language                text default 'English',
  additional_instructions text,
  generation_mode         ai_gen_mode not null default 'full',
  status                  ai_job_status not null default 'queued',
  structure               jsonb,
  model                   text,
  prompt                  text,
  input_tokens            int default 0,
  output_tokens           int default 0,
  cost_usd                numeric(10,4) default 0,
  attempts                int default 0,
  error                   text,
  series_id               uuid references test_series(id),
  test_id                 uuid references tests(id),
  created_at              timestamptz default now(),
  started_at              timestamptz,
  completed_at            timestamptz
);
create table questions (
  id                  uuid primary key default gen_random_uuid(),
  test_id             uuid not null references tests(id) on delete cascade,
  section_id          uuid references test_sections(id) on delete set null,
  position            int  not null default 1,
  type                question_type not null default 'mcq',
  is_objective        boolean generated always as (type in ('mcq','multi_select','true_false')) stored,
  body                text not null,
  image_path          text,
  marks               numeric(6,2) not null default 4 check (marks >= 0),
  negative_marks      numeric(6,2) not null default 0 check (negative_marks >= 0),
  difficulty          difficulty_lvl not null default 'medium',
  subject             text,
  topic               text,
  explanation         text,
  answer_instructions text,
  source              text not null default 'manual' check (source in ('manual','ai','csv','duplicate','paste')),
  ai_job_id           uuid references ai_test_jobs(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (test_id, position) deferrable initially deferred
);
create trigger trg_questions_updated before update on questions for each row execute function set_updated_at();
create table question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  position    int  not null,
  option_key  text not null check (option_key in ('A','B','C','D','E','F')),
  label       text not null,
  image_path  text,
  is_correct  boolean not null default false,
  unique (question_id, position),
  unique (question_id, option_key)
);
create or replace function sync_test_marks() returns trigger language plpgsql as
$$ declare t uuid := coalesce(new.test_id, old.test_id);
begin
  update tests set total_marks = coalesce((select sum(marks) from questions where test_id = t), 0) where id = t;
  return null;
end $$;
create trigger trg_sync_marks after insert or update or delete on questions for each row execute function sync_test_marks();
-- --------------------------------------------------- AI GENERATED QUESTIONS
create table ai_generated_questions (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references ai_test_jobs(id) on delete cascade,
  section_position    int,
  position            int not null,
  type                question_type not null default 'mcq',
  body                text not null,
  options             jsonb,                         -- [{key:'A', text:'...'}]
  correct_keys        text[] default '{}',
  marks               numeric(6,2) default 4,
  negative_marks      numeric(6,2) default 0,
  difficulty          difficulty_lvl default 'medium',
  subject             text,
  topic               text,
  explanation         text,
  answer_instructions text,
  issues              text[] default '{}',
  review_state        text not null default 'pending' check (review_state in ('pending','accepted','edited','rejected')),
  unique (job_id, position)
);
-- ---------------------------------------------- EDUCATOR ASSIGNMENTS (minimal)
create table test_assignments (
  id          uuid primary key default gen_random_uuid(),
  series_id   uuid not null references test_series(id) on delete cascade,
  educator_id uuid not null references profiles(id),
  test_name   text,
  deadline    date,
  status      assignment_status not null default 'assigned',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
-- ------------------------------------------- ENROLMENTS, ATTEMPTS, ANSWERS
create table series_enrollments (
  id          uuid primary key default gen_random_uuid(),
  series_id   uuid not null references test_series(id) on delete cascade,
  student_id  uuid not null references profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  expires_at  timestamptz,
  amount_paid numeric(10,2) default 0,
  unique (series_id, student_id)
);
create table test_attempts (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references tests(id) on delete cascade,
  series_id    uuid not null references test_series(id) on delete cascade,
  student_id   uuid not null references profiles(id) on delete cascade,
  attempt_no   int  not null default 1,
  status       attempt_status not null default 'in_progress',
  is_late      boolean default false,
  score        numeric(8,2),
  max_score    numeric(8,2),
  percentage   numeric(5,2) generated always as (case when max_score > 0 then round(score / max_score * 100, 2) end) stored,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  unique (test_id, student_id, attempt_no)
);
create table attempt_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references test_attempts(id) on delete cascade,
  question_id         uuid not null references questions(id) on delete cascade,
  selected_option_ids uuid[],
  text_answer         text,
  is_correct          boolean,
  marks_awarded       numeric(6,2),
  graded_by           uuid references profiles(id),
  feedback            text,
  unique (attempt_id, question_id)
);
create or replace function enforce_attempt_limit() returns trigger language plpgsql as
$$ declare lim int; used int; sid uuid;
begin
  select attempt_limit, series_id into lim, sid from tests where id = new.test_id;
  select count(*) into used from test_attempts where test_id = new.test_id and student_id = new.student_id;
  if used >= lim then raise exception 'Attempt limit (%) reached for this test', lim; end if;
  new.series_id := sid; new.attempt_no := used + 1;
  return new;
end $$;
create trigger trg_attempt_limit before insert on test_attempts for each row execute function enforce_attempt_limit();
-- per-test custom window must sit inside the series window
create or replace function check_test_window() returns trigger language plpgsql as
$$ declare s test_series;
begin
  if new.window_mode = 'custom' then
    select * into s from test_series where id = new.series_id;
    if s.availability_mode = 'window' and (new.open_at::date < s.start_date or new.close_at::date > s.end_date) then
      raise exception 'Test window must fall inside the series window (% to %)', s.start_date, s.end_date;
    end if;
  end if;
  return new;
end $$;
create trigger trg_test_window before insert or update on tests for each row execute function check_test_window();
-- ---------------------------------------------------------------- INDEXES
create index idx_series_status   on test_series(status)    where deleted_at is null;
create index idx_series_price    on test_series(price_inr) where deleted_at is null;
create index idx_series_dates    on test_series(start_date, end_date) where deleted_at is null;
create index idx_series_subject  on test_series(subject_id);
create index idx_series_created  on test_series(created_at desc);
create index idx_series_golive   on test_series(go_live_at) where status = 'scheduled';
create index idx_series_title_lc on test_series(lower(title)) where deleted_at is null;
create index idx_series_search   on test_series using gin ((title || ' ' || coalesce(audience,'') || ' ' || coalesce(code,'')) gin_trgm_ops);
create index idx_tests_series    on tests(series_id, position);
create index idx_sections_test   on test_sections(test_id, position);
create index idx_questions_test  on questions(test_id, position);
create index idx_questions_sect  on questions(section_id);
create index idx_options_q       on question_options(question_id);
create index idx_ai_jobs_user    on ai_test_jobs(requested_by, created_at desc);
create index idx_ai_gen_job      on ai_generated_questions(job_id, position);
create index idx_assign_series   on test_assignments(series_id);
create index idx_assign_edu      on test_assignments(educator_id, status);
create index idx_enroll_series   on series_enrollments(series_id);
create index idx_enroll_student  on series_enrollments(student_id);
create index idx_attempts_series on test_attempts(series_id) where status = 'submitted';
create index idx_attempts_test   on test_attempts(test_id);
create index idx_attempts_student on test_attempts(student_id);
create index idx_answers_attempt on attempt_answers(attempt_id);
-- ====================================================================
-- VIEWS + READ FUNCTIONS (summary cards, search, filters, pagination)
-- ====================================================================
create or replace view v_test_series_list with (security_invoker = true) as
select
  s.id, s.code, s.title, s.status, s.pricing, s.price_inr, s.is_free,
  s.start_date, s.end_date, s.availability_mode, s.audience, s.created_at,
  sub.name as subject_name, sub.icon_key,
  coalesce(t.test_count, 0)  as test_count,
  coalesce(e.enrollments, 0) as enrollments,
  coalesce(a.attempts, 0)    as attempts,
  coalesce(a.avg_score, 0)   as avg_score,
  case
    when s.status = 'draft'             then 'unscheduled'
    when s.availability_mode = 'always' then 'ongoing'
    when current_date < s.start_date    then 'upcoming'
    when current_date > s.end_date      then 'ended'
    else 'ongoing'
  end as timeline
from test_series s
left join subjects sub on sub.id = s.subject_id
left join (select series_id, count(*) test_count from tests group by 1) t on t.series_id = s.id
left join (select series_id, count(*) enrollments from series_enrollments group by 1) e on e.series_id = s.id
left join (select series_id, count(*) attempts, round(avg(percentage)) avg_score
           from test_attempts where status = 'submitted' group by 1) a on a.series_id = s.id
where s.deleted_at is null;
create or replace view v_test_structure with (security_invoker = true) as
select t.id as test_id, t.series_id, s.title as series_title, t.title as test_title,
       t.position, t.duration_minutes, t.total_marks, t.status, count(q.id) as question_count
from tests t
join test_series s on s.id = t.series_id and s.deleted_at is null
left join questions q on q.test_id = t.id
group by t.id, s.title;
create or replace function get_test_series_stats()
returns table (total_series bigint, total_enrolled bigint, total_attempts bigint, avg_performance numeric)
language sql stable security invoker as $$
  select count(*), coalesce(sum(enrollments),0), coalesce(sum(attempts),0),
         coalesce(round(avg(avg_score) filter (where attempts > 0)),0)
  from v_test_series_list;
$$;
create or replace function list_test_series(
  p_search text default null, p_status text default null, p_pricing text default null,
  p_timeline text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select * from v_test_series_list v
    where (p_search is null or (v.title || ' ' || coalesce(v.subject_name,'') || ' ' || coalesce(v.audience,'') || ' ' || coalesce(v.code,'')) ilike '%' || p_search || '%')
      and (p_status   is null or v.status::text = p_status)
      and (p_pricing  is null or (p_pricing = 'free' and v.is_free) or (p_pricing = 'paid' and not v.is_free))
      and (p_timeline is null or v.timeline = p_timeline)
  )
  select to_jsonb(f), count(*) over () from f order by created_at desc
  limit p_size offset (greatest(p_page,1) - 1) * p_size;
$$;
-- ====================================================================
-- WRITE FUNCTIONS (Create / Edit / Publish / Duplicate / AI save / autosave)
-- ====================================================================
create or replace function _insert_question(p_test uuid, p_pos int, q jsonb, p_section uuid default null)
returns uuid language plpgsql as $$
declare qid uuid; ty question_type; keys text[]; o jsonb; i int := 0;
begin
  ty := (case q->>'type' when 'objective' then 'mcq' when 'subjective' then 'long_answer' else coalesce(q->>'type','mcq') end)::question_type;
  select coalesce(array_agg(x), '{}') into keys from jsonb_array_elements_text(
    case when q ? 'correctAnswers' then q->'correctAnswers'
         when nullif(q->>'correctAnswer','') is not null then jsonb_build_array(q->>'correctAnswer')
         else '[]'::jsonb end) x;
  insert into questions (test_id, section_id, position, type, body, image_path, marks, negative_marks,
                         difficulty, subject, topic, explanation, answer_instructions, source)
  values (p_test, p_section, p_pos, ty, q->>'text', nullif(q->>'image',''),
          coalesce(nullif(q->>'marks','')::numeric, 4), coalesce(nullif(q->>'negativeMarks','')::numeric, 0),
          coalesce(nullif(q->>'difficulty','')::difficulty_lvl, 'medium'),
          nullif(q->>'subject',''), nullif(q->>'topic',''), nullif(q->>'explanation',''),
          coalesce(nullif(q->>'answerInstructions',''), nullif(q->>'rubric','')),
          coalesce(nullif(q->>'source',''), 'manual'))
  returning id into qid;
  if ty in ('mcq','multi_select','true_false') then
    for o in select * from jsonb_array_elements(coalesce(q->'options','[]'::jsonb)) loop
      i := i + 1;
      continue when coalesce(btrim(o->>'text'),'') = '';
      insert into question_options (question_id, position, option_key, label, is_correct)
      values (qid, i, upper(o->>'key'), o->>'text', upper(o->>'key') = any (keys));
    end loop;
  end if;
  return qid;
end $$;
-- Create Test Series wizard: "Save as draft" (publish=false) and "Publish now / Schedule" (publish=true)
create or replace function upsert_test_series_full(p jsonb, p_publish boolean default false)
returns uuid language plpgsql security invoker as $$
declare
  sid uuid := nullif(p->>'id','')::uuid;
  c jsonb := coalesce(p->'classification','{}'::jsonb);
  a jsonb := coalesce(p->'availability','{}'::jsonb);
  l jsonb := coalesce(p->'lateSubmissions','{}'::jsonb);
  subj uuid; langs text[];
  t jsonb; s jsonb; q jsonb; tid uuid; sec uuid; tpos int := 0; qpos int; spos int;
begin
  if nullif(c->>'subject','') is not null then
    insert into subjects (name, is_custom, created_by) values (c->>'subject', true, auth.uid())
    on conflict (lower(name)) do nothing;
    select id into subj from subjects where lower(name) = lower(c->>'subject');
  end if;
  select coalesce(array_agg(x), '{}') into langs from jsonb_array_elements_text(coalesce(c->'languages','[]'::jsonb)) x;
  if sid is null then
    insert into test_series (title, about, who_for, audience, syllabus, start_method, pricing, price_inr,
        grade, subject_id, exam, level, languages, go_live_mode, go_live_at, availability_mode, start_date, end_date,
        monthly_limit, access_days, late_allowed, late_grace_minutes, build_deadline, wizard_state, created_by)
    values (p->>'name', p->>'about', p->>'whoFor', p->>'audience', p->>'syllabus',
        nullif(p->>'startMethod','')::start_method, coalesce(nullif(p->>'pricing','')::pricing_type,'free'),
        case when p->>'pricing' = 'paid' then coalesce(nullif(p->>'price','')::numeric,0) else 0 end,
        nullif(c->>'grade',''), subj, nullif(c->>'exam',''), nullif(c->>'difficulty',''), langs,
        coalesce(a->>'goLive','now'), nullif(a->>'goLiveAt','')::timestamptz, coalesce(a->>'mode','always'),
        case when a->>'mode' = 'window' then nullif(a->>'openAt','')::date
             else coalesce(nullif(a->>'goLiveAt','')::timestamptz::date, current_date) end,
        case when a->>'mode' = 'window' then nullif(a->>'closeAt','')::date end,
        case when (a->>'monthlyLimited')::boolean then (a->>'monthlyLimit')::int end,
        case when (a->>'accessLimited')::boolean  then (a->>'accessDays')::int  end,
        coalesce((l->>'allowed')::boolean,false),
        case when (l->>'allowed')::boolean then (l->>'graceMinutes')::int end,
        nullif(p->>'buildDeadline','')::date, p->'wizardState', auth.uid())
    returning id into sid;
  else
    if exists (select 1 from test_attempts where series_id = sid) then
      raise exception 'This series already has attempts; edit tests and questions individually instead of replacing them.';
    end if;
    update test_series set
      title = p->>'name', about = p->>'about', who_for = p->>'whoFor', audience = p->>'audience', syllabus = p->>'syllabus',
      pricing = coalesce(nullif(p->>'pricing','')::pricing_type,'free'),
      price_inr = case when p->>'pricing' = 'paid' then coalesce(nullif(p->>'price','')::numeric,0) else 0 end,
      grade = nullif(c->>'grade',''), subject_id = subj, exam = nullif(c->>'exam',''), level = nullif(c->>'difficulty',''), languages = langs,
      go_live_mode = coalesce(a->>'goLive','now'), go_live_at = nullif(a->>'goLiveAt','')::timestamptz,
      availability_mode = coalesce(a->>'mode','always'),
      start_date = case when a->>'mode' = 'window' then nullif(a->>'openAt','')::date
                        else coalesce(nullif(a->>'goLiveAt','')::timestamptz::date, current_date) end,
      end_date   = case when a->>'mode' = 'window' then nullif(a->>'closeAt','')::date end,
      monthly_limit = case when (a->>'monthlyLimited')::boolean then (a->>'monthlyLimit')::int end,
      access_days   = case when (a->>'accessLimited')::boolean  then (a->>'accessDays')::int  end,
      late_allowed = coalesce((l->>'allowed')::boolean,false),
      late_grace_minutes = case when (l->>'allowed')::boolean then (l->>'graceMinutes')::int end,
      build_deadline = nullif(p->>'buildDeadline','')::date, wizard_state = p->'wizardState'
    where id = sid;
    delete from tests where series_id = sid;
  end if;
  for t in select * from jsonb_array_elements(coalesce(p->'tests','[]'::jsonb)) loop
    tpos := tpos + 1;
    insert into tests (series_id, position, title, instructions, duration_minutes, passing_percent, attempt_limit,
                       window_mode, open_at, close_at, planned_questions, topics)
    values (sid, tpos, t->>'name', t->>'instructions', coalesce(nullif(t->>'duration','')::int, 60),
            coalesce(nullif(t->>'passingPercent','')::numeric, 40), coalesce(nullif(t->>'attemptLimit','')::int, 1),
            coalesce(t->'window'->>'mode','inherit'),
            case when t->'window'->>'mode' = 'custom' then nullif(t->'window'->>'openAt','')::timestamptz end,
            case when t->'window'->>'mode' = 'custom' then nullif(t->'window'->>'closeAt','')::timestamptz end,
            coalesce(nullif(t->>'plannedQuestions','')::int, 0),
            coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(t->'topics','[]'::jsonb)) x), '{}'))
    returning id into tid;
    spos := 0;
    for s in select * from jsonb_array_elements(coalesce(t->'sections','[]'::jsonb)) loop
      spos := spos + 1;
      insert into test_sections (test_id, position, name, instructions, planned_questions, planned_marks)
      values (tid, spos, s->>'name', s->>'instructions', nullif(s->>'questionCount','')::int, nullif(s->>'marks','')::numeric);
    end loop;
    qpos := 0;
    for q in select * from jsonb_array_elements(coalesce(t->'questions','[]'::jsonb)) loop
      qpos := qpos + 1;
      sec := (select id from test_sections where test_id = tid and position = nullif(q->>'sectionPosition','')::int);
      perform _insert_question(tid, qpos, q, sec);
    end loop;
  end loop;
  if p_publish then perform publish_test_series(sid); end if;
  return sid;
end $$;
-- Publish now / Schedule go-live (also three dots > Publish)
create or replace function publish_test_series(p_id uuid) returns series_status
language plpgsql security invoker as $$
declare s test_series; new_status series_status; bad int;
begin
  select * into s from test_series where id = p_id and deleted_at is null;
  if not found then raise exception 'Series not found'; end if;
  if s.title is null or btrim(s.title) = '' or s.audience is null then raise exception 'Name and audience are required'; end if;
  if s.grade is null or s.subject_id is null or s.exam is null or s.level is null or coalesce(array_length(s.languages,1),0) = 0 then
    raise exception 'Classification is incomplete (grade, subject, exam, level, language)'; end if;
  if not exists (select 1 from tests where series_id = p_id) then raise exception 'Add at least one test'; end if;
  if exists (select 1 from tests t where t.series_id = p_id and not exists (select 1 from questions q where q.test_id = t.id)) then
    raise exception 'Every test needs at least one question'; end if;
  select count(*) into bad from questions q join tests t on t.id = q.test_id
   where t.series_id = p_id and q.is_objective
     and ( (select count(*) from question_options o where o.question_id = q.id) < 2
           or not exists (select 1 from question_options o where o.question_id = q.id and o.is_correct) );
  if bad > 0 then raise exception '% objective question(s) are missing options or a correct answer', bad; end if;
  new_status := case when s.go_live_mode = 'schedule' and s.go_live_at > now() then 'scheduled' else 'published' end;
  update test_series set status = new_status, published_at = coalesce(published_at, now()) where id = p_id;
  update tests set status = 'published' where series_id = p_id;
  return new_status;
end $$;
-- run from pg_cron every 5 minutes: select cron.schedule('release-series','*/5 * * * *','select release_scheduled_series()');
create or replace function release_scheduled_series() returns int language plpgsql security definer set search_path = public as
$$ declare n int; begin
  update test_series set status = 'published' where status = 'scheduled' and go_live_at <= now();
  get diagnostics n = row_count; return n;
end $$;
-- Wizard autosave and Discard & leave
create or replace function save_wizard_draft(p_id uuid, p_state jsonb) returns uuid
language plpgsql security invoker as $$
declare sid uuid := p_id; nm text := nullif(btrim(p_state->>'name'), '');
begin
  if sid is null then
    insert into test_series (title, status, start_method, wizard_state, created_by)
    values (coalesce(nm, 'Untitled series'), 'draft', nullif(p_state->>'startMethod','')::start_method, p_state, auth.uid())
    returning id into sid;
  else
    update test_series set wizard_state = p_state, title = coalesce(nm, title),
           start_method = coalesce(nullif(p_state->>'startMethod','')::start_method, start_method)
    where id = sid and status = 'draft' and deleted_at is null;
  end if;
  return sid;
end $$;
create or replace function discard_wizard_draft(p_id uuid) returns void language sql security invoker as $$
  update test_series set deleted_at = now() where id = p_id and status = 'draft' and deleted_at is null;
$$;
create or replace function series_name_exists(p_name text, p_exclude uuid default null) returns boolean
language sql stable security invoker as $$
  select exists (select 1 from test_series where lower(btrim(title)) = lower(btrim(p_name))
                 and deleted_at is null and (p_exclude is null or id <> p_exclude));
$$;
-- AI Test Builder: save reviewed questions as a test (new series or existing)
create or replace function save_ai_job_to_series(p_job uuid, p_target text, p_series uuid, p_new jsonb, p_meta jsonb)
returns uuid language plpgsql security invoker as $$
declare j ai_test_jobs; sid uuid; tid uuid; pos int; g record; subj uuid; sec uuid; spos int := 0; s jsonb; qn int := 0;
begin
  select * into j from ai_test_jobs where id = p_job;
  if not found or j.status not in ('completed','saved') then raise exception 'Job is not ready to save'; end if;
  if p_target = 'new' then
    subj := coalesce(j.subject_id, (select id from subjects where lower(name) = lower(p_new->>'subject')));
    insert into test_series (title, subject_id, audience, pricing, price_inr, status, start_method, created_by)
    values (p_new->>'name', subj, p_new->>'audience', coalesce(nullif(p_new->>'pricing','')::pricing_type,'free'),
            case when p_new->>'pricing' = 'paid' then coalesce(nullif(p_new->>'price','')::numeric,0) else 0 end,
            'draft', 'ai', auth.uid())
    returning id into sid;
  else sid := p_series; end if;
  select coalesce(max(position),0) + 1 into pos from tests where series_id = sid;
  insert into tests (series_id, position, title, duration_minutes, passing_marks, attempt_limit, scheduled_at,
                     shuffle_questions, shuffle_options, status)
  values (sid, pos, j.test_name, coalesce(nullif(p_meta->>'duration','')::int, j.duration_minutes, 60),
          nullif(p_meta->>'passingMarks','')::numeric, coalesce(nullif(p_meta->>'attemptLimit','')::int, 1),
          nullif(p_meta->>'scheduledAt','')::timestamptz,
          coalesce((p_meta->>'shuffleQuestions')::boolean,false), coalesce((p_meta->>'shuffleOptions')::boolean,false), 'draft')
  returning id into tid;
  for s in select * from jsonb_array_elements(coalesce(j.structure->'sections','[]'::jsonb)) loop
    spos := spos + 1;
    insert into test_sections (test_id, position, name, instructions, planned_questions, planned_marks)
    values (tid, spos, coalesce(s->>'name','Section ' || spos), s->>'instructions',
            nullif(s->>'questionCount','')::int, nullif(s->>'marks','')::numeric);
  end loop;
  for g in select * from ai_generated_questions where job_id = p_job and review_state <> 'rejected' order by position loop
    qn := qn + 1;
    sec := (select id from test_sections where test_id = tid and position = g.section_position);
    perform _insert_question(tid, qn, jsonb_build_object(
      'type', g.type, 'text', g.body, 'options', coalesce(g.options,'[]'::jsonb),
      'correctAnswers', to_jsonb(g.correct_keys), 'marks', g.marks, 'negativeMarks', g.negative_marks,
      'difficulty', g.difficulty, 'subject', g.subject, 'topic', g.topic, 'explanation', g.explanation,
      'answerInstructions', g.answer_instructions, 'source', 'ai'), sec);
  end loop;
  update questions set ai_job_id = p_job where test_id = tid;
  update ai_test_jobs set status = 'saved', series_id = sid, test_id = tid where id = p_job;
  return tid;
end $$;
-- Three dots > Duplicate (hidden in the UI for now)
create or replace function duplicate_test_series(p_id uuid) returns uuid
language plpgsql security invoker as $$
declare new_id uuid; r record; nt uuid; q record; nq uuid; sm jsonb; sc record; ns uuid;
begin
  insert into test_series (title, about, who_for, audience, syllabus, start_method, pricing, price_inr, grade, subject_id, exam, level,
      languages, availability_mode, start_date, end_date, monthly_limit, access_days, late_allowed, late_grace_minutes, status, created_by)
  select title || ' (Copy)', about, who_for, audience, syllabus, 'duplicate', pricing, price_inr, grade, subject_id, exam, level,
      languages, availability_mode, start_date, end_date, monthly_limit, access_days, late_allowed, late_grace_minutes, 'draft', auth.uid()
  from test_series where id = p_id returning id into new_id;
  for r in select * from tests where series_id = p_id order by position loop
    insert into tests (series_id, position, title, instructions, duration_minutes, passing_percent, passing_marks, attempt_limit,
                       window_mode, open_at, close_at, shuffle_questions, shuffle_options, planned_questions, topics)
    values (new_id, r.position, r.title, r.instructions, r.duration_minutes, r.passing_percent, r.passing_marks, r.attempt_limit,
            r.window_mode, r.open_at, r.close_at, r.shuffle_questions, r.shuffle_options, r.planned_questions, r.topics)
    returning id into nt;
    sm := '{}'::jsonb;
    for sc in select * from test_sections where test_id = r.id loop
      insert into test_sections (test_id, position, name, instructions, planned_questions, planned_marks)
      values (nt, sc.position, sc.name, sc.instructions, sc.planned_questions, sc.planned_marks) returning id into ns;
      sm := sm || jsonb_build_object(sc.id::text, ns);
    end loop;
    for q in select * from questions where test_id = r.id order by position loop
      insert into questions (test_id, section_id, position, type, body, image_path, marks, negative_marks, difficulty, subject, topic,
                             explanation, answer_instructions, source)
      values (nt, nullif(sm->>(q.section_id::text),'')::uuid, q.position, q.type, q.body, q.image_path, q.marks, q.negative_marks,
              q.difficulty, q.subject, q.topic, q.explanation, q.answer_instructions, 'duplicate')
      returning id into nq;
      insert into question_options (question_id, position, option_key, label, image_path, is_correct)
      select nq, position, option_key, label, image_path, is_correct from question_options where question_id = q.id;
    end loop;
  end loop;
  return new_id;
end $$;
-- Students read options through this view only (hides is_correct)
create or replace view v_student_options as
select o.id, o.question_id, o.position, o.option_key, o.label, o.image_path
from question_options o
join questions q on q.id = o.question_id
join tests t on t.id = q.test_id
where t.status = 'published' and is_enrolled(t.series_id);
-- ====================================================================
-- ROW LEVEL SECURITY
-- ====================================================================
create or replace function is_assigned_educator(p_series uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from test_assignments where series_id = p_series and educator_id = auth.uid()
                    and status in ('assigned','in_progress','revision_requested')) $$;
create or replace function is_enrolled(p_series uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from series_enrollments where series_id = p_series and student_id = auth.uid()) $$;
alter table profiles               enable row level security;
alter table subjects               enable row level security;
alter table test_series            enable row level security;
alter table tests                  enable row level security;
alter table test_sections          enable row level security;
alter table questions              enable row level security;
alter table question_options       enable row level security;
alter table ai_test_jobs           enable row level security;
alter table ai_generated_questions enable row level security;
alter table test_assignments       enable row level security;
alter table series_enrollments     enable row level security;
alter table test_attempts          enable row level security;
alter table attempt_answers        enable row level security;
create policy profiles_read  on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_admin on profiles for all using (is_admin()) with check (is_admin());
create policy subjects_read  on subjects for select using (auth.uid() is not null);
create policy subjects_admin on subjects for all using (is_admin()) with check (is_admin());
create policy series_admin    on test_series for all using (is_admin()) with check (is_admin());
create policy series_student  on test_series for select using (status = 'published' and deleted_at is null);
create policy series_educator on test_series for select using (is_assigned_educator(id));
create policy tests_admin    on tests for all using (is_admin()) with check (is_admin());
create policy tests_student  on tests for select using (status = 'published' and is_enrolled(series_id));
create policy tests_educator on tests for all using (is_assigned_educator(series_id)) with check (is_assigned_educator(series_id));
create policy sections_admin   on test_sections for all using (is_admin()) with check (is_admin());
create policy sections_student on test_sections for select
  using (exists (select 1 from tests t where t.id = test_id and t.status = 'published' and is_enrolled(t.series_id)));
create policy questions_admin   on questions for all using (is_admin()) with check (is_admin());
create policy questions_edu     on questions for all
  using (exists (select 1 from tests t where t.id = test_id and is_assigned_educator(t.series_id)))
  with check (exists (select 1 from tests t where t.id = test_id and is_assigned_educator(t.series_id)));
create policy questions_student on questions for select
  using (exists (select 1 from tests t where t.id = test_id and t.status = 'published' and is_enrolled(t.series_id)));
create policy options_admin on question_options for all using (is_admin()) with check (is_admin());
create policy options_edu   on question_options for all
  using (exists (select 1 from questions q join tests t on t.id = q.test_id where q.id = question_id and is_assigned_educator(t.series_id)))
  with check (exists (select 1 from questions q join tests t on t.id = q.test_id where q.id = question_id and is_assigned_educator(t.series_id)));
grant select on v_student_options to authenticated;   -- students get no policy on the table itself
create policy ai_jobs_admin on ai_test_jobs for all using (is_admin()) with check (is_admin());
create policy ai_gen_admin  on ai_generated_questions for all using (is_admin()) with check (is_admin());
create policy assign_admin  on test_assignments for all using (is_admin()) with check (is_admin());
create policy assign_edu_r  on test_assignments for select using (educator_id = auth.uid());
create policy enroll_admin   on series_enrollments for all using (is_admin()) with check (is_admin());
create policy enroll_own     on series_enrollments for select using (student_id = auth.uid());
create policy attempts_admin on test_attempts for select using (is_admin());
create policy attempts_own   on test_attempts for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy answers_admin  on attempt_answers for select using (is_admin());
create policy answers_own    on attempt_answers for all
  using (exists (select 1 from test_attempts a where a.id = attempt_id and a.student_id = auth.uid()))
  with check (exists (select 1 from test_attempts a where a.id = attempt_id and a.student_id = auth.uid()));
-- ---------------------------------------------------------------- STORAGE
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', false, 2097152, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy qimg_admin_write on storage.objects for all
  using (bucket_id = 'question-images' and is_admin()) with check (bucket_id = 'question-images' and is_admin());
create policy qimg_read on storage.objects for select
 using (bucket_id = 'question-images' and auth.uid() is not null);
-- =====================================================================
-- UNIVERSAL LEARNING - ASSIGN EDUCATORS PAGE (Admin) - Supabase SQL
-- =====================================================================
-- ---------------------------------------------------------------- ENUMS
do $$ begin create type assignment_status as enum
  ('assigned','in_progress','submitted','under_review','revision_requested','approved','rejected','completed','cancelled');
exception when duplicate_object then null; end $$;
do $$ begin create type question_mix   as enum ('objective','subjective','mixed');   exception when duplicate_object then null; end $$;
do $$ begin create type request_status as enum ('pending','assigned','rejected');    exception when duplicate_object then null; end $$;
create sequence if not exists assignment_code_seq start 5001;     -- ASG-5001
create sequence if not exists request_code_seq    start 6001;     -- REQ-6001
-- ------------------------------------------------ EDUCATORS (for "Assign To")
create table if not exists educators (
  id            uuid primary key references profiles(id) on delete cascade,
  verify_status text not null default 'pending',          -- pending | approved | rejected
  subjects      text[] default '{}',
  submitted_at  timestamptz default now()
);
alter table educators add column if not exists subjects text[] default '{}';
-- Only verified educators can be assigned or reassigned
create or replace view v_eligible_educators with (security_invoker = true) as
select e.id, p.full_name as name, e.subjects
from educators e join profiles p on p.id = e.id
where e.verify_status::text = 'approved';
-- --------------------------------------- INCOMING SERIES REQUESTS (review section)
create table if not exists series_requests (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique default ('REQ-' || nextval('request_code_seq')),
  series_id          uuid references test_series(id) on delete set null,   -- null = brand-new series
  series_name        text not null,
  subject            text,
  topics             text[] default '{}',
  test_name          text not null,
  sent_by            text,                                 -- "Academic Content Team", partner name
  sent_date          date default current_date,
  question_count     int  check (question_count between 1 and 300),
  question_type_mix  question_mix default 'mixed',
  difficulty         text check (difficulty in ('Easy','Medium','Hard','Mixed')),
  total_marks        numeric(8,2),
  duration_minutes   int check (duration_minutes > 0),
  instructions       text,
  requested_deadline date,
  status             request_status not null default 'pending',
  decision_at        timestamptz,
  decision_reason    text,
  created_at         timestamptz default now()
);
-- -------------------------------------------------------- ASSIGNMENTS (the table rows)
create table if not exists test_assignments (
  id          uuid primary key default gen_random_uuid(),
  series_id   uuid not null references test_series(id) on delete cascade,
  educator_id uuid not null references profiles(id),
  test_name   text,
  deadline    date,
  status      assignment_status not null default 'assigned',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table test_assignments
  add column if not exists code              text unique,                        -- ASG-5001 (shown + searched)
  add column if not exists subject           text,
  add column if not exists topics            text[] default '{}',
  add column if not exists question_count    int  default 20 check (question_count between 1 and 300),
  add column if not exists question_type_mix question_mix default 'mixed',
  add column if not exists difficulty        text default 'Medium' check (difficulty in ('Easy','Medium','Hard','Mixed')),
  add column if not exists total_marks       numeric(8,2) default 100,
  add column if not exists duration_minutes  int default 60 check (duration_minutes > 0),
  add column if not exists instructions      text,
  add column if not exists assigned_date     date default current_date,
  add column if not exists request_id        uuid references series_requests(id) on delete set null,
  add column if not exists test_id           uuid references tests(id) on delete set null,   -- test the educator built
  add column if not exists cancel_reason     text,
  add column if not exists submitted_at      timestamptz,
  add column if not exists overall_feedback  text,
  add column if not exists decision          text check (decision in ('approved','revision_requested','rejected')),
  add column if not exists decision_at       timestamptz,
  add column if not exists decision_reason   text,
  add column if not exists created_by        uuid references profiles(id);
update test_assignments set code = 'ASG-' || nextval('assignment_code_seq') where code is null;
create or replace function gen_assignment_code() returns trigger language plpgsql as
$$ begin if new.code is null then new.code := 'ASG-' || nextval('assignment_code_seq'); end if; return new; end $$;
drop trigger if exists trg_assign_code on test_assignments;
create trigger trg_assign_code before insert on test_assignments for each row execute function gen_assignment_code();
drop trigger if exists trg_assign_updated on test_assignments;
create trigger trg_assign_updated before update on test_assignments for each row execute function set_updated_at();
-- Progress bar % per status (match these to STATUS_PROGRESS in testAssignmentsMock.js)
create table if not exists assignment_status_progress (
  status   assignment_status primary key,
  progress int not null check (progress between 0 and 100)
);
insert into assignment_status_progress values
  ('assigned',5),('in_progress',40),('submitted',75),('under_review',75),('revision_requested',55),
  ('approved',95),('completed',100),('rejected',0),('cancelled',0)
on conflict (status) do update set progress = excluded.progress;
-- Review comments on specific questions
create table if not exists assignment_comments (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references test_assignments(id) on delete cascade,
  question_id   uuid references questions(id) on delete set null,
  question_ref  text,                       -- free text such as "Q5"
  comment       text not null,
  author_id     uuid references profiles(id),
  created_at    timestamptz default now()
);
-- Timeline in the View Details modal
create table if not exists assignment_history (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references test_assignments(id) on delete cascade,
  action        text not null,              -- Assigned, Requirements updated, Reassigned, Deadline extended, Review started, Approved ...
  by_user       uuid references profiles(id),
  note          text,
  at            timestamptz default now()
);
-- Educator notifications (replaces the mock log)
create table if not exists assignment_notifications (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references test_assignments(id) on delete cascade,
  educator_id   uuid not null references profiles(id) on delete cascade,
  type          text not null check (type in ('assigned','updated','deadline_changed','revision_requested','approved','rejected','cancelled')),
  title         text not null,
  message       text,
  is_read       boolean not null default false,
  created_at    timestamptz default now()
);
-- ---------------------------------------------------------------- INDEXES
create index if not exists idx_assign_series      on test_assignments(series_id);
create index if not exists idx_assign_edu         on test_assignments(educator_id, status);
create index if not exists idx_assign_deadline    on test_assignments(deadline);
create index if not exists idx_assign_assigned    on test_assignments(assigned_date desc);
create index if not exists idx_assign_status      on test_assignments(status);
create index if not exists idx_assign_search      on test_assignments using gin ((coalesce(code,'') || ' ' || coalesce(test_name,'')) gin_trgm_ops);
create index if not exists idx_asg_hist           on assignment_history(assignment_id, at);
create index if not exists idx_asg_comments       on assignment_comments(assignment_id);
create index if not exists idx_asg_notif          on assignment_notifications(educator_id, is_read, created_at desc);
create index if not exists idx_requests_status    on series_requests(status, sent_date desc);
-- ====================================================================
-- VIEWS + LIST FUNCTION (search, sort, filters, pagination)
-- ====================================================================
create or replace view v_assignments_list with (security_invoker = true) as
select
  a.id, a.code, a.series_id, s.title as series_name, a.subject, a.topics,
  a.educator_id, p.full_name as educator_name,
  a.test_name, a.question_count, a.question_type_mix, a.difficulty, a.total_marks, a.duration_minutes,
  a.instructions, a.assigned_date, a.deadline, a.status,
  case when a.status not in ('approved','completed','cancelled','rejected')
        and a.deadline is not null and a.deadline < current_date
       then 'overdue' else a.status::text end as display_status,           -- "Overdue" is display-only
  pr.progress,
  a.submitted_at, a.overall_feedback, a.decision, a.decision_at, a.decision_reason,
  a.cancel_reason, a.request_id, a.test_id, a.created_at
from test_assignments a
join test_series s on s.id = a.series_id
left join profiles p on p.id = a.educator_id
left join assignment_status_progress pr on pr.status = a.status;
create or replace function list_assignments(
  p_search text default null,
  p_sort text default 'deadline_asc',        -- deadline_asc | deadline_desc | assigned_desc | progress_desc
  p_subject text default null,
  p_educator uuid default null,
  p_status text default null,                -- any assignment status or 'overdue'
  p_deadline_before date default null,
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select * from v_assignments_list v
    where (p_search is null or (v.code || ' ' || coalesce(v.test_name,'') || ' ' || v.series_name || ' ' || coalesce(v.educator_name,'')) ilike '%' || p_search || '%')
      and (p_subject  is null or v.subject = p_subject)
      and (p_educator is null or v.educator_id = p_educator)
      and (p_status   is null or case when p_status = 'overdue' then v.display_status = 'overdue' else v.status::text = p_status end)
      and (p_deadline_before is null or v.deadline <= p_deadline_before)
  )
  select to_jsonb(f), count(*) over () from f
  order by
    case when p_sort = 'deadline_asc'  then deadline end asc  nulls last,
    case when p_sort = 'deadline_desc' then deadline end desc nulls last,
    case when p_sort = 'assigned_desc' then assigned_date end desc,
    case when p_sort = 'progress_desc' then progress end desc,
    code
  limit p_size offset (greatest(p_page,1) - 1) * p_size;
$$;
-- View Details modal: assignment + timeline + comments + notifications in one call
create or replace function get_assignment_detail(p_id uuid) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'assignment',    to_jsonb(v),
    'history',       (select coalesce(jsonb_agg(to_jsonb(h) order by h.at), '[]') from assignment_history h where h.assignment_id = p_id),
    'comments',      (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]') from assignment_comments c where c.assignment_id = p_id),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]') from assignment_notifications n where n.assignment_id = p_id))
  from v_assignments_list v where v.id = p_id;
$$;
-- Incoming requests list (pending count badge = count where status = 'pending')
create or replace view v_series_requests with (security_invoker = true) as
select r.*, a.id as assignment_id, a.code as assignment_code
from series_requests r left join test_assignments a on a.request_id = r.id;
-- Dashboard "Test Series Approvals" card reads the same table
drop view if exists v_series_approvals;
create view v_series_approvals with (security_invoker = true) as
select id, code, series_name as title, educator_name, status, display_status,
       (display_status = 'overdue') as is_overdue, deadline, created_at
from v_assignments_list;
-- ====================================================================
-- ACTION FUNCTIONS (one per button)
-- ====================================================================
create or replace function _asg_log(p_id uuid, p_action text, p_note text) returns void
language sql security definer set search_path = public as
$$ insert into assignment_history (assignment_id, action, by_user, note) values (p_id, p_action, auth.uid(), p_note) $$;
create or replace function _asg_notify(p_id uuid, p_type text, p_title text, p_msg text) returns void
language sql security definer set search_path = public as
$$ insert into assignment_notifications (assignment_id, educator_id, type, title, message)
   select id, educator_id, p_type, p_title, p_msg from test_assignments where id = p_id $$;
-- [+ New Assignment] > Create / Assign. One assignment per selected educator.
-- p = {seriesMode:'existing'|'new', seriesId, newSeriesName, subject, topics:[], testName, educatorIds:[],
--      questionCount, questionTypeMix, difficulty, totalMarks, duration, deadline, instructions}
create or replace function create_assignments(p jsonb) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare sid uuid; ids uuid[] := '{}'; eid uuid; aid uuid; sname text; subj text := nullif(btrim(p->>'subject'),'');
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if nullif(btrim(p->>'testName'),'') is null then raise exception 'Test / question paper name is required'; end if;
  if subj is null then raise exception 'Subject is required'; end if;
  if nullif(p->>'deadline','') is null or (p->>'deadline')::date < current_date then raise exception 'Deadline must be today or later'; end if;
  if jsonb_array_length(coalesce(p->'educatorIds','[]'::jsonb)) = 0 then raise exception 'Select at least one educator'; end if;
  if p->>'seriesMode' = 'new' then
    sname := btrim(p->>'newSeriesName');
    if sname is null or char_length(sname) < 3 then raise exception 'Enter a name for the new series'; end if;
    insert into test_series (title, status, start_method, created_by) values (sname, 'draft', 'scratch', auth.uid()) returning id into sid;
  else
    sid := nullif(p->>'seriesId','')::uuid;
    if sid is null then raise exception 'Select a test series'; end if;
  end if;
  insert into subjects (name, is_custom, created_by) values (subj, true, auth.uid()) on conflict (lower(name)) do nothing;
  for eid in select x::uuid from jsonb_array_elements_text(p->'educatorIds') x loop
    if not exists (select 1 from v_eligible_educators where id = eid) then raise exception 'Educator is not verified'; end if;
    insert into test_assignments (series_id, educator_id, subject, topics, test_name, question_count, question_type_mix,
                                  difficulty, total_marks, duration_minutes, instructions, deadline, created_by)
    values (sid, eid, subj,
            coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(coalesce(p->'topics','[]'::jsonb)) x where btrim(x) <> ''), '{}'),
            btrim(p->>'testName'), coalesce(nullif(p->>'questionCount','')::int, 20),
            coalesce(nullif(p->>'questionTypeMix','')::question_mix, 'mixed'), coalesce(nullif(p->>'difficulty',''), 'Medium'),
            coalesce(nullif(p->>'totalMarks','')::numeric, 100), coalesce(nullif(p->>'duration','')::int, 60),
            p->>'instructions', (p->>'deadline')::date, auth.uid())
    returning id into aid;
    ids := ids || aid;
    perform _asg_log(aid, 'Assigned', 'Assignment created.');
    perform _asg_notify(aid, 'assigned', 'New test assignment',
      format('You''ve been assigned "%s" (%s). Deadline: %s.', btrim(p->>'testName'), subj, p->>'deadline'));
  end loop;
  return ids;
end $$;
-- Row menu > Edit Requirements
create or replace function update_assignment_requirements(p_id uuid, patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update test_assignments set
    test_name         = coalesce(nullif(btrim(patch->>'testName'),''), test_name),
    subject           = coalesce(nullif(btrim(patch->>'subject'),''), subject),
    topics            = coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(patch->'topics') x where btrim(x) <> ''), topics),
    question_count    = coalesce(nullif(patch->>'questionCount','')::int, question_count),
    question_type_mix = coalesce(nullif(patch->>'questionTypeMix','')::question_mix, question_type_mix),
    difficulty        = coalesce(nullif(patch->>'difficulty',''), difficulty),
    total_marks       = coalesce(nullif(patch->>'totalMarks','')::numeric, total_marks),
    duration_minutes  = coalesce(nullif(patch->>'duration','')::int, duration_minutes),
    deadline          = coalesce(nullif(patch->>'deadline','')::date, deadline),
    instructions      = coalesce(patch->>'instructions', instructions)
  where id = p_id and status not in ('completed','cancelled');
  if not found then raise exception 'Assignment not found or already closed'; end if;
  perform _asg_log(p_id, 'Requirements updated', 'Test requirements were edited.');
  perform _asg_notify(p_id, 'updated', 'Assignment requirements updated', 'Requirements for your assignment were updated. Please review the changes.');
end $$;
-- Row menu > Reassign Educator
create or replace function reassign_educator(p_id uuid, p_educator uuid) returns void
language plpgsql security definer set search_path = public as $$
declare old_name text; new_name text;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if not exists (select 1 from v_eligible_educators where id = p_educator) then raise exception 'Educator is not verified'; end if;
  select p.full_name into old_name from test_assignments a join profiles p on p.id = a.educator_id where a.id = p_id;
  select full_name into new_name from profiles where id = p_educator;
  update test_assignments set educator_id = p_educator where id = p_id and status not in ('completed','cancelled');
  if not found then raise exception 'Assignment not found or already closed'; end if;
  perform _asg_log(p_id, 'Reassigned', format('Reassigned from %s to %s.', old_name, new_name));
  perform _asg_notify(p_id, 'assigned', 'New test assignment', 'You have been assigned a test to build. Check the deadline and requirements.');
end $$;
-- Row menu > Extend Deadline
create or replace function extend_deadline(p_id uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_date is null or p_date < current_date then raise exception 'Pick a date that is today or later'; end if;
  update test_assignments set deadline = p_date where id = p_id and status not in ('completed','cancelled');
  if not found then raise exception 'Assignment not found or already closed'; end if;
  perform _asg_log(p_id, 'Deadline extended', 'New deadline: ' || p_date);
  perform _asg_notify(p_id, 'deadline_changed', 'Deadline updated', 'The deadline for your assignment is now ' || p_date || '.');
end $$;
-- Row menu > Cancel Assignment (reason optional)
create or replace function cancel_assignment(p_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update test_assignments set status = 'cancelled', cancel_reason = p_reason where id = p_id and status not in ('completed','cancelled');
  if not found then raise exception 'Assignment not found or already closed'; end if;
  perform _asg_log(p_id, 'Cancelled', coalesce(nullif(p_reason,''), 'Assignment cancelled.'));
  perform _asg_notify(p_id, 'cancelled', 'Assignment cancelled', 'Your assignment has been cancelled. ' || coalesce(p_reason,''));
end $$;
-- Row menu > Review Submission (opens the modal: submitted -> under_review)
create or replace function start_review(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update test_assignments set status = 'under_review' where id = p_id and status = 'submitted';
  if found then perform _asg_log(p_id, 'Review started', 'Admin opened this submission for review.'); end if;
end $$;
-- Review modal > Approve / Request Revision / Reject
-- p_decision: 'approved' | 'revision' | 'rejected'; p_comments: [{questionRef, comment}]
create or replace function review_submission(p_id uuid, p_decision text, p_feedback text, p_comments jsonb, p_reason text)
returns assignment_status language plpgsql security definer set search_path = public as $$
declare a test_assignments; ns assignment_status; c jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into a from test_assignments where id = p_id for update;
  if not found or a.status not in ('submitted','under_review') then raise exception 'Only submitted assignments can be reviewed'; end if;
  if p_decision not in ('approved','revision','rejected') then raise exception 'Invalid decision'; end if;
  if p_decision in ('revision','rejected') and btrim(coalesce(p_reason,'')) = '' then raise exception 'A reason is required'; end if;
  ns := (case p_decision when 'approved' then 'approved' when 'revision' then 'revision_requested' else 'rejected' end)::assignment_status;
  update test_assignments set status = ns, overall_feedback = p_feedback,
         decision = case p_decision when 'revision' then 'revision_requested' else p_decision end,
         decision_at = now(), decision_reason = p_reason
   where id = p_id;
  for c in select * from jsonb_array_elements(coalesce(p_comments,'[]'::jsonb)) loop
    insert into assignment_comments (assignment_id, question_ref, comment, author_id)
    values (p_id, c->>'questionRef', c->>'comment', auth.uid());
  end loop;
  perform _asg_log(p_id, case p_decision when 'approved' then 'Approved' when 'revision' then 'Revision requested' else 'Rejected' end,
                   coalesce(nullif(p_reason,''), p_feedback));
  perform _asg_notify(p_id,
    case p_decision when 'approved' then 'approved' when 'revision' then 'revision_requested' else 'rejected' end,
    case p_decision when 'approved' then 'Submission approved' when 'revision' then 'Revision requested' else 'Submission rejected' end,
    coalesce(nullif(p_feedback,''), p_reason));
  return ns;
end $$;
-- Incoming request > Assign educator
create or replace function assign_request(p_request uuid, p_educator uuid, p_deadline date, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare r series_requests; sid uuid; aid uuid;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select * into r from series_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'Request is not pending'; end if;
  if not exists (select 1 from v_eligible_educators where id = p_educator) then raise exception 'Educator is not verified'; end if;
  if p_deadline is null or p_deadline < current_date then raise exception 'Pick a deadline that is today or later'; end if;
  sid := r.series_id;
  if sid is null then
    insert into test_series (title, status, start_method, created_by) values (r.series_name, 'draft', 'scratch', auth.uid()) returning id into sid;
  end if;
  insert into test_assignments (series_id, educator_id, subject, topics, test_name, question_count, question_type_mix, difficulty,
                                total_marks, duration_minutes, instructions, deadline, request_id, created_by)
  values (sid, p_educator, r.subject, r.topics, r.test_name, r.question_count, r.question_type_mix, r.difficulty,
          r.total_marks, r.duration_minutes, concat_ws(E'\n\n', r.instructions, p_note), p_deadline, r.id, auth.uid())
  returning id into aid;
  update series_requests set status = 'assigned', decision_at = now(), series_id = sid where id = p_request;
  perform _asg_log(aid, 'Assigned', 'Created from request ' || r.code);
  perform _asg_notify(aid, 'assigned', 'New test assignment', format('You''ve been assigned "%s". Deadline: %s.', r.test_name, p_deadline));
  return aid;
end $$;
-- Incoming request > Reject
create or replace function reject_request(p_request uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update series_requests set status = 'rejected', decision_at = now(), decision_reason = p_reason
   where id = p_request and status = 'pending';
  if not found then raise exception 'Request is not pending'; end if;
end $$;
-- Educator side (their own assignments only)
create or replace function educator_start_assignment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update test_assignments set status = 'in_progress' where id = p_id and educator_id = auth.uid() and status in ('assigned','revision_requested');
  if found then perform _asg_log(p_id, 'In progress', 'Educator started work.'); end if;
end $$;
create or replace function educator_submit_assignment(p_id uuid, p_test uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update test_assignments set status = 'submitted', submitted_at = now(), test_id = coalesce(p_test, test_id)
   where id = p_id and educator_id = auth.uid() and status in ('assigned','in_progress','revision_requested');
  if not found then raise exception 'Cannot submit this assignment'; end if;
  perform _asg_log(p_id, 'Submitted', 'Educator submitted the test for review.');
end $$;
create or replace function mark_notification_read(p_id uuid) returns void
language sql security invoker as $$ update assignment_notifications set is_read = true where id = p_id and educator_id = auth.uid() $$;
-- When the approved test is published in Test Series, the assignment becomes Completed
create or replace function complete_assignment_on_publish() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    with u as (update test_assignments set status = 'completed' where test_id = new.id and status = 'approved' returning id)
    insert into assignment_history (assignment_id, action, note) select id, 'Completed', 'Linked test was published.' from u;
  end if;
  return null;
end $$;
drop trigger if exists trg_assign_complete on tests;
create trigger trg_assign_complete after update of status on tests for each row execute function complete_assignment_on_publish();
-- ====================================================================
-- ROW LEVEL SECURITY
-- ====================================================================
alter table educators                 enable row level security;
alter table series_requests           enable row level security;
alter table test_assignments          enable row level security;
alter table assignment_status_progress enable row level security;
alter table assignment_comments       enable row level security;
alter table assignment_history        enable row level security;
alter table assignment_notifications  enable row level security;
drop policy if exists educators_admin     on educators;
drop policy if exists educators_own       on educators;
drop policy if exists requests_admin      on series_requests;
drop policy if exists assign_admin        on test_assignments;
drop policy if exists assign_edu_r        on test_assignments;
drop policy if exists progress_read       on assignment_status_progress;
drop policy if exists acomm_admin         on assignment_comments;
drop policy if exists acomm_edu           on assignment_comments;
drop policy if exists ahist_admin         on assignment_history;
drop policy if exists ahist_edu           on assignment_history;
drop policy if exists anotif_admin        on assignment_notifications;
drop policy if exists anotif_own          on assignment_notifications;
create policy educators_admin on educators for all using (is_admin()) with check (is_admin());
create policy educators_own   on educators for select using (id = auth.uid());
create policy requests_admin  on series_requests for all using (is_admin()) with check (is_admin());
create policy assign_admin on test_assignments for all using (is_admin()) with check (is_admin());
create policy assign_edu_r on test_assignments for select using (educator_id = auth.uid());   -- educators change status only via the functions above
create policy progress_read on assignment_status_progress for select using (auth.uid() is not null);
create policy acomm_admin on assignment_comments for all using (is_admin()) with check (is_admin());
create policy acomm_edu   on assignment_comments for select
  using (exists (select 1 from test_assignments a where a.id = assignment_id and a.educator_id = auth.uid()));
create policy ahist_admin on assignment_history for all using (is_admin()) with check (is_admin());
create policy ahist_edu   on assignment_history for select
  using (exists (select 1 from test_assignments a where a.id = assignment_id and a.educator_id = auth.uid()));
create policy anotif_admin on assignment_notifications for all using (is_admin()) with check (is_admin());
create policy anotif_own   on assignment_notifications for select using (educator_id = auth.uid());
-- =====================================================================
-- UNIVERSAL LEARNING - TEST SERIES TRACKER PAGE (Admin) - Supabase SQL
-- Depends on: Test Series SQL + Assign Educators SQL
-- =====================================================================
-- ---------------------------------------------------------------- ENUMS
do $$ begin create type match_type   as enum ('exact','high','possible');                    exception when duplicate_object then null; end $$;
do $$ begin create type match_review as enum ('unreviewed','reviewed','dismissed','confirmed'); exception when duplicate_object then null; end $$;
-- ====================================================================
-- 1. TRACKER TABLE: one row per test series with roll-ups from its assignments
-- ====================================================================
create or replace view v_series_tracker with (security_invoker = true) as
with a as (
  select series_id,
    count(*)                                                                             as total_required,
    count(*) filter (where status in ('submitted','under_review','revision_requested','approved','completed')) as tests_created,
    count(*) filter (where status in ('approved','completed'))                           as tests_approved,
    min(deadline)                                                                        as nearest_deadline,
    bool_or(display_status = 'overdue')                                                  as any_overdue,
    bool_or(status = 'revision_requested')                                               as any_revision,
    array_agg(distinct educator_name) filter (where educator_name is not null)           as educators,
    min(subject)                                                                         as assignment_subject
  from v_assignments_list
  group by series_id
)
select
  s.id as series_id, s.code, s.title as series_name,
  coalesce(sub.name, a.assignment_subject)                    as subject,
  coalesce(a.educators, '{}')                                 as educators,          -- "Assigned Educators" column
  coalesce(a.total_required, 0)                               as total_required,     -- Required
  coalesce(a.tests_created, 0)                                as tests_created,      -- Created
  coalesce(a.tests_created, 0)                                as tests_submitted,    -- Submitted (same rule as the UI)
  coalesce(a.tests_approved, 0)                               as tests_approved,     -- Approved
  case when coalesce(a.total_required,0) = 0 then 0
       else round(a.tests_approved::numeric / a.total_required * 100) end as completion_pct,   -- Progress bar
  a.nearest_deadline                                          as deadline,           -- Deadline
  case when a.total_required is null            then 'No Assignments Yet'
       when a.any_overdue                       then 'Overdue'
       when a.tests_approved = a.total_required then 'Complete'
       when a.any_revision                      then 'Needs Revision'
       else 'On Track' end                                    as overall_status,     -- Overall Status badge
  s.status as series_status, s.created_at
from test_series s
left join subjects sub on sub.id = s.subject_id
left join a on a.series_id = s.id
where s.deleted_at is null;
-- Filter dropdown options
create or replace view v_tracker_educators with (security_invoker = true) as
select distinct educator_name as name from v_assignments_list where educator_name is not null order by 1;
-- Search + sort + filters + pagination (8 per page)
-- p_sort: deadline_asc | completion_desc | name_asc
-- p_status: 'On Track' | 'Complete' | 'Needs Revision' | 'Overdue' | 'No Assignments Yet'
create or replace function list_series_tracker(
  p_search text default null, p_sort text default 'deadline_asc',
  p_subject text default null, p_educator text default null, p_status text default null,
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select * from v_series_tracker v
    where (p_search   is null or (v.series_name || ' ' || coalesce(v.subject,'')) ilike '%' || p_search || '%')
      and (p_subject  is null or v.subject = p_subject)
      and (p_educator is null or p_educator = any (v.educators))
      and (p_status   is null or v.overall_status = p_status)
  )
  select to_jsonb(f), count(*) over () from f
  order by
    case when p_sort = 'deadline_asc'    then deadline end asc nulls last,
    case when p_sort = 'completion_desc' then completion_pct end desc,
    case when p_sort = 'name_asc'        then series_name end asc,
    series_name
  limit p_size offset (greatest(p_page,1) - 1) * p_size;
$$;
-- Row click: series detail modal (4 counts + the assignment list)
create or replace function get_series_tracker_detail(p_series uuid) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'series', to_jsonb(t),
    'assignments', (select coalesce(jsonb_agg(to_jsonb(a) order by a.deadline), '[]')
                    from v_assignments_list a where a.series_id = p_series))
  from v_series_tracker t where t.series_id = p_series;
$$;
-- ====================================================================
-- 2. STAT CARDS
-- ====================================================================
create or replace function get_tracker_stats()
returns table (total_series bigint, active_series bigint, total_assignments bigint,
               in_progress bigint, pending_submissions bigint, pending_reviews bigint, completed bigint, overdue bigint)
language sql stable security invoker as $$
  select
    (select count(*) from test_series where deleted_at is null),                          -- Total Test Series
    (select count(*) from test_series where deleted_at is null and status = 'published'), -- Active Test Series
    count(*),                                                                             -- Total Assignments
    count(*) filter (where display_status = 'in_progress'),
    count(*) filter (where status in ('assigned','in_progress')),
    count(*) filter (where status in ('submitted','under_review')),
    count(*) filter (where status = 'completed'),
    count(*) filter (where display_status = 'overdue')
  from v_assignments_list;
$$;
-- ====================================================================
-- 3. REPEATED-QUESTION DETECTION (side-by-side review)
-- ====================================================================
create or replace function norm_text(t text) returns text language sql immutable as
$$ select lower(btrim(regexp_replace(coalesce(t,''), '[^a-zA-Z0-9]+', ' ', 'g'))) $$;
create index if not exists idx_questions_norm_trgm on questions using gin (norm_text(body) gin_trgm_ops);
create table if not exists question_similarity_matches (
  id                 uuid primary key default gen_random_uuid(),
  pair_key           text not null unique,                       -- "<smaller id>::<larger id>"
  question_a_id      uuid not null references questions(id) on delete cascade,   -- original
  question_b_id      uuid not null references questions(id) on delete cascade,   -- matching
  similarity_percent int  not null check (similarity_percent between 0 and 100),
  match_type         match_type not null,                         -- exact >= 97, high >= 75, possible >= 50
  same_series        boolean not null default false,
  same_test          boolean not null default false,
  review_status      match_review not null default 'unreviewed',
  review_note        text,
  reviewed_by        uuid references profiles(id),
  reviewed_at        timestamptz,
  detected_at        timestamptz not null default now(),
  check (question_a_id <> question_b_id)
);
create index if not exists idx_matches_review on question_similarity_matches(review_status, match_type);
create index if not exists idx_matches_qa     on question_similarity_matches(question_a_id);
create index if not exists idx_matches_qb     on question_similarity_matches(question_b_id);
-- Run on page load, after a publish, or nightly via pg_cron. Review decisions are never overwritten.
create or replace function detect_repeated_questions() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare started timestamptz := clock_timestamp(); n int;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  perform set_config('pg_trgm.similarity_threshold', '0.5', true);
  with pairs as (
    select a.id as aid, b.id as bid, ta.id as tida, tb.id as tidb, ta.series_id as sera, tb.series_id as serb,
           similarity(norm_text(a.body), norm_text(b.body)) as sim
    from questions a
    join questions b on a.id < b.id and norm_text(a.body) % norm_text(b.body)
    join tests ta on ta.id = a.test_id
    join tests tb on tb.id = b.test_id
    where norm_text(a.body) <> ''
  )
  insert into question_similarity_matches (pair_key, question_a_id, question_b_id, similarity_percent, match_type, same_series, same_test, detected_at)
  select aid::text || '::' || bid::text, aid, bid, round(sim * 100)::int,
         (case when sim >= 0.97 then 'exact' when sim >= 0.75 then 'high' else 'possible' end)::match_type,
         sera = serb, tida = tidb, clock_timestamp()
  from pairs
  on conflict (pair_key) do update
    set similarity_percent = excluded.similarity_percent, match_type = excluded.match_type,
        same_series = excluded.same_series, same_test = excluded.same_test, detected_at = clock_timestamp();
  -- drop stale pairs nobody reviewed (question edited or deleted so they no longer match)
  delete from question_similarity_matches where review_status = 'unreviewed' and detected_at < started;
  select count(*) into n from question_similarity_matches;
  return n;
end $$;
-- optional nightly: select cron.schedule('detect-dupes', '0 2 * * *', 'select detect_repeated_questions()');
create or replace view v_repeated_matches with (security_invoker = true) as
select m.id, m.pair_key, m.match_type, m.similarity_percent, m.same_series, m.same_test,
       m.review_status, m.review_note, m.reviewed_at, m.detected_at,
       qa.id as original_question_id, qa.body as original_text, qa.type as original_type,
       ta.id as original_test_id, ta.title as original_test_name, sa.id as original_series_id, sa.title as original_series_name,
       coalesce(qa.subject, suba.name) as original_subject,
       qb.id as matching_question_id, qb.body as matching_text, qb.type as matching_type,
       tb.id as matching_test_id, tb.title as matching_test_name, sb.id as matching_series_id, sb.title as matching_series_name,
       coalesce(qb.subject, subb.name) as matching_subject
from question_similarity_matches m
join questions qa on qa.id = m.question_a_id  join tests ta on ta.id = qa.test_id  join test_series sa on sa.id = ta.series_id
left join subjects suba on suba.id = sa.subject_id
join questions qb on qb.id = m.question_b_id  join tests tb on tb.id = qb.test_id  join test_series sb on sb.id = tb.series_id
left join subjects subb on subb.id = sb.subject_id
where sa.deleted_at is null and sb.deleted_at is null;
-- Filters: match type, subject, series, review status
create or replace function list_repeated_matches(
  p_type text default null, p_subject text default null, p_series uuid default null, p_review text default null,
  p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select * from v_repeated_matches v
    where (p_type    is null or v.match_type::text = p_type)
      and (p_subject is null or v.original_subject = p_subject or v.matching_subject = p_subject)
      and (p_series  is null or v.original_series_id = p_series or v.matching_series_id = p_series)
      and (p_review  is null or v.review_status::text = p_review)
  )
  select to_jsonb(f), count(*) over () from f order by similarity_percent desc
  limit p_size offset (greatest(p_page,1) - 1) * p_size;
$$;
-- Side-by-side modal buttons
create or replace function _review_match(p_id uuid, p_status match_review, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  update question_similarity_matches
     set review_status = p_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
end $$;
create or replace function mark_match_reviewed(p_id uuid) returns void language sql security definer set search_path = public as
$$ select _review_match(p_id, 'reviewed', null) $$;
create or replace function dismiss_match(p_id uuid, p_note text default 'Reviewed and judged not a real duplicate.') returns void language sql security definer set search_path = public as
$$ select _review_match(p_id, 'dismissed', p_note) $$;
create or replace function flag_match_confirmed(p_id uuid, p_note text default 'Confirmed duplicate — needs correction.') returns void language sql security definer set search_path = public as
$$ select _review_match(p_id, 'confirmed', p_note) $$;
-- Count of matches still needing review (badge)
create or replace function get_match_counts() returns table (total bigint, needs_review bigint, confirmed bigint)
language sql stable security invoker as $$
  select count(*), count(*) filter (where review_status = 'unreviewed'), count(*) filter (where review_status = 'confirmed')
  from question_similarity_matches;
$$;
-- ====================================================================
-- ROW LEVEL SECURITY (admin only)
-- ====================================================================
alter table question_similarity_matches enable row level security;
drop policy if exists matches_admin on question_similarity_matches;
create policy matches_admin on question_similarity_matches for all using (is_admin()) with check (is_admin());
-- =====================================================================
-- UNIVERSAL LEARNING - TEST PERFORMANCE ANALYTICS PAGE (Admin) - Supabase SQL
-- Depends on: Test Series SQL (test_series, tests, subjects, test_attempts, profiles, is_admin)
--             Assign Educators SQL (test_assignments)
-- =====================================================================
-- ---------------------------------------------------------------- INDEXES
create index if not exists idx_attempts_submitted   on test_attempts(submitted_at) where status = 'submitted';
create index if not exists idx_attempts_series_time on test_attempts(series_id, submitted_at) where status = 'submitted';
create index if not exists idx_attempts_test_time   on test_attempts(test_id, submitted_at) where status = 'submitted';
create index if not exists idx_attempts_student_ser on test_attempts(student_id, series_id) where status = 'submitted';
-- ====================================================================
-- 1. BUILDING BLOCKS
-- ====================================================================
-- Educators attached to a series (from active assignments); empty means "Unassigned"
create or replace view v_series_educators with (security_invoker = true) as
select distinct a.series_id, a.educator_id, p.full_name as educator_name
from test_assignments a join profiles p on p.id = a.educator_id
where a.status not in ('cancelled','rejected');
-- Published tests in published series, with subject and educators
create or replace view v_tpa_tests with (security_invoker = true) as
select t.id as test_id, t.title as test_title, t.position,
       s.id as series_id, s.title as series_title, sub.name as subject,
       coalesce(array_agg(distinct se.educator_id) filter (where se.educator_id is not null), '{}') as educator_ids,
       coalesce(string_agg(distinct se.educator_name, ', '), 'Unassigned') as educator_names
from tests t
join test_series s on s.id = t.series_id and s.deleted_at is null and s.status = 'published'
left join subjects sub on sub.id = s.subject_id
left join v_series_educators se on se.series_id = s.id
where t.status = 'published'
group by t.id, s.id, sub.name;
-- Tests that match the page filters (series / subject / test / educator)
create or replace function _tpa_tests(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null
) returns setof v_tpa_tests language sql stable security invoker as $$
  select * from v_tpa_tests v
  where (p_series   is null or v.series_id = p_series)
    and (p_subject  is null or v.subject = p_subject)
    and (p_test     is null or v.test_id = p_test)
    and (p_educator is null or p_educator = any (v.educator_ids));
$$;
-- Submitted attempts that match all filters, including the From / To date range
create or replace function _tpa_attempts(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (attempt_id uuid, series_id uuid, test_id uuid, student_id uuid,
                 percentage numeric, minutes numeric, submitted_at timestamptz, subject text)
language sql stable security invoker as $$
  select a.id, a.series_id, a.test_id, a.student_id, a.percentage,
         extract(epoch from (a.submitted_at - a.started_at)) / 60.0, a.submitted_at, t.subject
  from test_attempts a
  join _tpa_tests(p_series, p_subject, p_test, p_educator) t on t.test_id = a.test_id
  where a.status = 'submitted'
    and (p_from is null or a.submitted_at::date >= p_from)
    and (p_to   is null or a.submitted_at::date <= p_to);
$$;
-- ====================================================================
-- 2. FILTER DROPDOWNS (All Test Series / All Subjects / All Tests / All Educators)
-- ====================================================================
create or replace function get_tpa_filter_options(p_series uuid default null) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'series',    (select coalesce(jsonb_agg(jsonb_build_object('id', series_id, 'title', series_title) order by series_title), '[]')
                  from (select distinct series_id, series_title from v_tpa_tests) x),
    'subjects',  (select coalesce(jsonb_agg(subject order by subject), '[]')
                  from (select distinct subject from v_tpa_tests where subject is not null) x),
    'tests',     (select coalesce(jsonb_agg(jsonb_build_object('id', test_id, 'title', test_title, 'series_id', series_id) order by series_title, position), '[]')
                  from v_tpa_tests where p_series is null or series_id = p_series),      -- "All Tests" narrows when a series is picked
    'educators', (select coalesce(jsonb_agg(jsonb_build_object('id', educator_id, 'name', educator_name) order by educator_name), '[]')
                  from (select distinct se.educator_id, se.educator_name
                        from v_series_educators se join v_tpa_tests t on t.series_id = se.series_id) x));
$$;
-- ====================================================================
-- 3. SUMMARY CARDS
-- ====================================================================
create or replace function get_tpa_summary(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (total_attempts bigint, avg_score numeric, published_tests bigint, avg_time_minutes numeric)
language sql stable security invoker as $$
  select
    (select count(*) from _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to)),                           -- Total Test Attempts
    (select coalesce(round(avg(percentage)), 0) from _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to)), -- Average Score
    (select count(*) from _tpa_tests(p_series,p_subject,p_test,p_educator)),                                           -- Published Tests (in view)
    (select coalesce(round(avg(minutes)), 0) from _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to));    -- Average Time Taken
$$;
-- ====================================================================
-- 4. SUBJECT-WISE AVERAGE SCORE (line chart)
-- ====================================================================
create or replace function get_tpa_subject_scores(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (subject text, avg_score numeric, attempts bigint)
language sql stable security invoker as $$
  select a.subject, round(avg(a.percentage)), count(*)
  from _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to) a
  where a.subject is not null
  group by a.subject order by 2 desc;
$$;
-- ====================================================================
-- 5. TEST SERIES ENGAGEMENT TABLE
-- ====================================================================
create or replace function get_tpa_series_engagement(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (series_id uuid, series_title text, educators text, subject text, attempts bigint, avg_performance numeric)
language sql stable security invoker as $$
  select s.series_id, s.series_title, s.educator_names, s.subject,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0)
  from (select distinct t.series_id, t.series_title, t.subject, t.educator_names
        from _tpa_tests(p_series,p_subject,p_test,p_educator) t) s
  left join _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to) a on a.series_id = s.series_id
  group by s.series_id, s.series_title, s.educator_names, s.subject
  order by s.series_title;
$$;
-- ====================================================================
-- 6. TEST-WISE SCORE COMPARISON TABLE
-- ====================================================================
create or replace function get_tpa_test_comparison(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (test_id uuid, test_title text, series_title text, educators text,
                 attempts bigint, avg_score numeric, avg_time_minutes numeric)
language sql stable security invoker as $$
  select t.test_id, t.test_title, t.series_title, t.educator_names,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0), coalesce(round(avg(a.minutes)), 0)
  from _tpa_tests(p_series,p_subject,p_test,p_educator) t
  left join _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to) a on a.test_id = t.test_id
  group by t.test_id, t.test_title, t.series_title, t.educator_names, t.position
  order by t.series_title, t.position;
$$;
-- ====================================================================
-- 7. LEADERBOARD & RANKING (own series dropdown; top 3 podium + top 10 table)
-- ====================================================================
-- p_series = null means "All Test Series": each learner's attempt-weighted average across all series.
-- Rank: ties share a rank. Percentile: share of learners scoring strictly below.
create or replace function get_tpa_leaderboard(
  p_series uuid default null, p_from date default null, p_to date default null, p_limit int default 10
) returns table (rank_no bigint, student_id uuid, learner text, score numeric, percentile numeric,
                 attempts bigint, total_learners bigint)
language sql stable security invoker as $$
  with l as (
    select a.student_id, avg(a.percentage) as score, count(*) as attempts
    from _tpa_attempts(p_series, null, null, null, p_from, p_to) a
    group by a.student_id
  ), r as (
    select l.*, count(*) over () as n,
           rank() over (order by score desc) as rk,
           count(*) over (partition by score) as ties
    from l
  )
  select r.rk, r.student_id, p.full_name, round(r.score, 1),
         round(((r.n - (r.rk + r.ties - 1))::numeric / r.n) * 100, 1),
         r.attempts, r.n
  from r join profiles p on p.id = r.student_id
  order by r.rk, p.full_name
  limit p_limit;
$$;
-- Podium = first 3 rows. Footer "Top 8 of 8 learners" = rows returned of total_learners.
create or replace view v_tpa_series_options with (security_invoker = true) as
select distinct series_id as id, series_title as title from v_tpa_tests order by series_title;
-- ====================================================================
-- 8. EXPORT CSV
-- ====================================================================
-- Flat rows for the CSV file (same filters as the page); the browser turns them into a CSV
create or replace function export_tpa_rows(
  p_series uuid default null, p_subject text default null, p_test uuid default null, p_educator uuid default null,
  p_from date default null, p_to date default null
) returns table (series text, subject text, educators text, test text, attempts bigint, avg_score_pct numeric, avg_time_min numeric)
language sql stable security invoker as $$
  select t.series_title, t.subject, t.educator_names, t.test_title,
         count(a.attempt_id), coalesce(round(avg(a.percentage)), 0), coalesce(round(avg(a.minutes)), 0)
  from _tpa_tests(p_series,p_subject,p_test,p_educator) t
  left join _tpa_attempts(p_series,p_subject,p_test,p_educator,p_from,p_to) a on a.test_id = t.test_id
  group by t.series_title, t.subject, t.educator_names, t.test_title, t.position
  order by t.series_title, t.position;
$$;
-- Audit trail of exports (who exported what)
create table if not exists export_log (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references profiles(id),
  page       text not null,                     -- 'test_performance_analytics'
  filters    jsonb,
  row_count  int,
  created_at timestamptz default now()
);
alter table export_log enable row level security;
drop policy if exists export_log_admin on export_log;
create policy export_log_admin on export_log for all using (is_admin()) with check (is_admin());
create or replace function log_export(p_page text, p_filters jsonb, p_rows int) returns void
language sql security invoker as $$
  insert into export_log (admin_id, page, filters, row_count) values (auth.uid(), p_page, p_filters, p_rows);
$$;
-- =====================================================================
-- UNIVERSAL LEARNING - STUDENT MANAGEMENT & DETAILS PAGE (Admin) - Supabase SQL
-- Depends on: Test Series SQL (profiles, test_series, tests, series_enrollments, test_attempts, is_admin)
-- =====================================================================
do $$ begin create type student_status as enum ('active','blocked'); exception when duplicate_object then null; end $$;
create sequence if not exists student_code_seq start 2001;                    -- STU-2001
-- ====================================================================
-- 1. STUDENTS (one row per student; name and email live in profiles)
-- ====================================================================
create table if not exists students (
  id uuid primary key references profiles(id) on delete cascade
);
alter table students
  add column if not exists student_code   text unique default ('STU-' || nextval('student_code_seq')),   -- searchable ID
  add column if not exists phone          text,
  add column if not exists grade          text check (grade in ('Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12')),
  add column if not exists city           text,                                  -- location = city + profiles.state
  add column if not exists registered_at  timestamptz not null default now(),    -- "Registered" column
  add column if not exists last_active_at timestamptz,                           -- "Last active"
  add column if not exists status         student_status not null default 'active',
  add column if not exists blocked_reason text,
  add column if not exists blocked_at     timestamptz,
  add column if not exists blocked_by     uuid references profiles(id),
  add column if not exists onboarded_via  text,                                  -- "Onboarded by" (acquisition channel / partner)
  add column if not exists acquisition_id uuid;                                  -- link to your Student Acquisition table, if any
update students set student_code = 'STU-' || nextval('student_code_seq') where student_code is null;
do $$ begin
  alter table students add constraint chk_blocked_reason check (status <> 'blocked' or nullif(btrim(blocked_reason),'') is not null);
exception when duplicate_object then null; end $$;
create index if not exists idx_students_status     on students(status);
create index if not exists idx_students_grade      on students(grade);
create index if not exists idx_students_registered on students(registered_at desc);
create index if not exists idx_profiles_name_trgm  on profiles using gin ((full_name || ' ' || email) gin_trgm_ops);
create index if not exists idx_students_code_trgm  on students using gin (student_code gin_trgm_ops);
-- Block / unblock history (reason, who, when)
create table if not exists student_block_history (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  action     text not null check (action in ('blocked','unblocked')),
  reason     text,
  by_admin   uuid references profiles(id),
  at         timestamptz not null default now()
);
create index if not exists idx_block_hist on student_block_history(student_id, at desc);
-- ====================================================================
-- 2. LIST VIEW + SEARCH / FILTERS / PAGINATION
-- ====================================================================
create or replace view v_students_list with (security_invoker = true) as
select
  s.id, s.student_code, p.full_name, p.email,
  upper(left(split_part(btrim(p.full_name), ' ', 1), 1) || left(split_part(btrim(p.full_name), ' ', 2), 1)) as initials,   -- avatar chip
  s.grade, s.registered_at, s.status,
  s.phone, s.city, p.state, s.last_active_at,
  s.blocked_reason, s.blocked_at, s.onboarded_via
from students s join profiles p on p.id = s.id;
-- p_status: 'active' | 'blocked' | null (All);  p_grade: 'Grade 10' | null (All)
-- p_sort: registered_desc | registered_asc | name_asc
create or replace function
-- =====================================================================
-- UNIVERSAL LEARNING - EDUCATOR MANAGEMENT PAGE (Admin) - Supabase SQL
-- Depends on: Test Series SQL, Assign Educators SQL (educators, v_series_educators, test_assignments)
-- =====================================================================
do $$ begin create type educator_account      as enum ('active','inactive','suspended');                    exception when duplicate_object then null; end $$;
do $$ begin create type educator_verification as enum ('pending','under_review','verified','rejected');     exception when duplicate_object then null; end $$;
do $$ begin create type doc_status            as enum ('pending','approved','rejected');                    exception when duplicate_object then null; end $$;
create sequence if not exists educator_code_seq start 1001;                                                 -- EDU-1001
-- ====================================================================
-- 1. EDUCATORS (extends the table from the earlier schemas)
-- ====================================================================
alter table educators
  add column if not exists educator_code       text unique default ('EDU-' || nextval('educator_code_seq')),   -- searchable ID
  add column if not exists phone               text,
  add column if not exists gender              text,
  add column if not exists dob                 date,
  add column if not exists qualification       text,
  add column if not exists years_experience    int default 0 check (years_experience between 0 and 60),
  add column if not exists account_status      educator_account      not null default 'active',          -- Account column
  add column if not exists verification_status educator_verification not null default 'pending',         -- Verification column
  add column if not exists status_reason       text,
  add column if not exists suspended_at        timestamptz,
  add column if not exists joined_at           timestamptz not null default now(),                       -- Joined column
  add column if not exists last_active_at      timestamptz,
  add column if not exists onboarded_via       text default 'admin';                                     -- admin | bulk_import | self_signup
update educators set educator_code = 'EDU-' || nextval('educator_code_seq') where educator_code is null;
-- move the old verify_status values into the new column, then retire it
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'educators' and column_name = 'verify_status') then
    execute $q$ update educators set verification_status = (case verify_status::text
        when 'approved' then 'verified' when 'verified' then 'verified' when 'rejected' then 'rejected'
        when 'under_review' then 'under_review' else 'pending' end)::educator_verification $q$;
  end if;
end $$;
drop view if exists v_pending_educators, v_eligible_educators cascade;
alter table educators drop column if exists verify_status;
create index if not exists idx_edu_account      on educators(account_status);
create index if not exists idx_edu_verification on educators(verification_status);
create index if not exists idx_edu_joined       on educators(joined_at desc);
create index if not exists idx_edu_years        on educators(years_experience);
create index if not exists idx_edu_subjects     on educators using gin (subjects);
create index if not exists idx_edu_code_trgm    on educators using gin (educator_code gin_trgm_ops);
-- Verification documents (the "Verification Details" menu item opens the documents tab)
create table if not exists educator_documents (
  id          uuid primary key default gen_random_uuid(),
  educator_id uuid not null references educators(id) on delete cascade,
  doc_type    text not null,                       -- ID proof, Degree certificate, Experience letter ...
  file_path   text,                                -- Storage path in a private 'educator-documents' bucket
  status      doc_status not null default 'pending',
  note        text,
  uploaded_at timestamptz default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz
);
create index if not exists idx_edu_docs on educator_documents(educator_id);
-- Student ratings (Rating column shows the average, or a dash when there are none)
create table if not exists educator_ratings (
  id          uuid primary key default gen_random_uuid(),
  educator_id uuid not null references educators(id) on delete cascade,
  student_id  uuid not null references profiles(id) on delete cascade,
  rating      int not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz default now(),
  unique (educator_id, student_id)
);
create index if not exists idx_edu_ratings on educator_ratings(educator_id);
-- Status history: who suspended, activated, verified, rejected, and why
create table if not exists educator_status_history (
  id          uuid primary key default gen_random_uuid(),
  educator_id uuid not null references educators(id) on delete cascade,
  kind        text not null check (kind in ('account','verification')),
  from_value  text,
  to_value    text not null,
  reason      text,
  by_admin    uuid references profiles(id),
  at          timestamptz default now()
);
create index if not exists idx_edu_hist on educator_status_history(educator_id, at desc);
-- Bulk import: rows from the CSV/Excel upload, then "Send Invites"
create table if not exists educator_invites (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  email       text not null,
  status      text not null default 'pending' check (status in ('pending','sent','accepted','expired','failed')),
  user_id     uuid references profiles(id),
  invited_by  uuid references profiles(id),
  invited_at  timestamptz default now(),
  sent_at     timestamptz,
  accepted_at timestamptz,
  error       text
);
create unique index if not exists uq_invite_email on educator_invites (lower(email)) where status in ('pending','sent');
-- ====================================================================
-- 2. LIST VIEW + SEARCH / FILTERS / SORT / PAGINATION
-- ====================================================================
create or replace view v_educators_list with (security_invoker = true) as
select
  e.id, e.educator_code, p.full_name, p.email, e.phone,
  upper(left(split_part(btrim(p.full_name), ' ', 1), 1) || left(split_part(btrim(p.full_name), ' ', 2), 1)) as initials,
  e.subjects, e.qualification, e.years_experience,
  (select round(avg(r.rating)::numeric, 1) from educator_ratings r where r.educator_id = e.id)  as rating,         -- null shows "—"
  (select count(*) from educator_ratings r where r.educator_id = e.id)                           as ratings_count,
  (select count(distinct en.student_id) from series_enrollments en
     join v_series_educators se on se.series_id = en.series_id and se.educator_id = e.id)        as students_count,   -- "Most students" sort
  e.verification_status,
  case when e.verification_status = 'under_review' then 'pending' else e.verification_status::text end as verification_label,  -- both show as "Pending"
  e.account_status, e.joined_at, e.last_active_at, e.status_reason, e.onboarded_via
from educators e join profiles p on p.id = e.id;
-- p_account: active|inactive|suspended | null;  p_verification: pending|verified|rejected | null ('pending' covers under_review)
-- p_experience: '0-3' | '4-7' | '8-12' | '13+' | null;  p_sort: newest | oldest | rating | students
create or replace function list_educators(
  p_search text default null, p_account text default null, p_verification text default null,
  p_subject text default null, p_experience text default null, p_sort text default 'newest',
  p_page int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select * from v_educators_list v
    where (p_search is null or (v.full_name || ' ' || v.email || ' ' || coalesce(v.educator_code,'')) ilike '%' || p_search || '%')
      and (p_account      is null or v.account_status::text = p_account)
      and (p_verification is null or (p_verification = 'pending' and v.verification_status in ('pending','under_review'))
                                  or v.verification_status::text = p_verification)
      and (p_subject      is null or p_subject = any (v.subjects))
      and (p_experience   is null
           or (p_experience = '0-3'   and v.years_experience <= 3)
           or (p_experience = '4-7'   and v.years_experience between 4 and 7)
           or (p_experience = '8-12'  and v.years_experience between 8 and 12)
           or (p_experience = '13+'   and v.years_experience >= 13))
  )
  select to_jsonb(f), count(*) over () from f
  order by
    case when p_sort = 'newest'   then joined_at end desc,
    case when p_sort = 'oldest'   then joined_at end asc,
    case when p_sort = 'rating'   then rating end desc nulls last,
    case when p_sort = 'students' then students_count end desc,
    full_name
  limit p_size offset (greatest(p_page, 1) - 1) * p_size;
$$;
-- Subject dropdown options
create or replace view v_educator_subject_options with (security_invoker = true) as
select distinct unnest(subjects) as subject from educators order by 1;
-- ====================================================================
-- 3. STAT CARDS (Total / Active / Pending Verification / Suspended)
-- ====================================================================
create or replace function get_educator_stats()
returns table (total_educators bigint, active_educators bigint, pending_verification bigint, suspended_educators bigint)
language sql stable security invoker as $$
  select count(*),
         count(*) filter (where account_status = 'active'),
         count(*) filter (where verification_status in ('pending','under_review')),
         count(*) filter (where account_status = 'suspended')
  from educators;
$$;
-- Re-created dependants (dashboard "Educator Verifications" and Assign Educators dropdown)
create or replace view v_pending_educators with (security_invoker = true) as
select e.id, p.full_name, e.submitted_at
from educators e join profiles p on p.id = e.id
where e.verification_status in ('pending','under_review') order by e.submitted_at desc;
create or replace view v_eligible_educators with (security_invoker = true) as
select e.id, p.full_name as name, e.subjects
from educators e join profiles p on p.id = e.id
where e.verification_status = 'verified' and e.account_status = 'active';
-- ====================================================================
-- 4. ROW ACTIONS
-- ====================================================================
-- Click row / View Details / Verification Details: one call for the educator page header + documents + history
create or replace function get_educator_detail(p_id uuid) returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'educator',  to_jsonb(v),
    'documents', (select coalesce(jsonb_agg(to_jsonb(d) order by d.uploaded_at), '[]') from educator_documents d where d.educator_id = p_id),
    'history',   (select coalesce(jsonb_agg(to_jsonb(h) order by h.at desc), '[]') from educator_status_history h where h.educator_id = p_id))
  from v_educators_list v where v.id = p_id;
$$;
-- Suspend (confirm popup), Activate, Deactivate. Returns how many open assignments the educator still holds.
create or replace function set_educator_account_status(p_id uuid, p_status educator_account, p_reason text default null)
returns int language plpgsql security definer set search_path = public as $$
declare old educator_account;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  select account_status into old from educators where id = p_id for update;
  if not found then raise exception 'Educator not found'; end if;
  if old = p_status then raise exception 'Educator is already %', p_status; end if;
  update educators set account_status = p_status,
         status_reason = case when p_status = 'active' then null else p_reason end,
         suspended_at  = case when p_status = 'suspended' then now() else null end
   where id = p_id;
  insert into educator_status_history (educator_id, kind, from_value, to_value, reason, by_admin)
  values (p_id, 'account', old::text, p_status::text, p_reason, auth.uid());
  return (select count(*) from test_assignments where educator_id = p_id and status in ('assigned','in_progress','revision_requested'));
end $$;
-- Verification decision (used from the Verification Details tab)
create or replace function set_educator_verification(p_id uuid, p_decision educator_verification, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare old educator_verification;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if p_decision = 'rejected' and nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'A reason is required to reject'; end if;
  select verification_status into old from educators where id = p_id for update;
  if not found then raise exception 'Educator not found'; end if;
  update educators set verification_status = p_decision where id = p_id;
  insert into educator_status_history (educator_id, kind, from_value, to_value, reason, by_admin)
  values (p_id, 'verification', old::text, p_decision::text, p_note, auth.uid());
end $$;
-- Delete educator (confirm popup). Refuses if they still own assignments.
create or replace function delete_educator(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if exists (select 1 from test_assignments where educator_id = p_id) then
    raise exception 'This educator has assignments. Reassign or cancel them first.';
  end if;
  delete from profiles where id = p_id and role = 'educator';
  -- remove the login too via an Edge Function: supabase.auth.admin.deleteUser(id)
end $$;
-- Inactive and suspended educators cannot sign in (same enforcement as blocked students)
create or replace function sync_educator_auth_ban() returns trigger
language plpgsql security definer set search_path = public, auth as $$
begin
  if new.account_status is distinct from old.account_status then
    update auth.users set banned_until = case when new.account_status in ('inactive','suspended') then 'infinity'::timestamptz else null end
     where id = new.id;
    if new.account_status in ('inactive','suspended') then delete from auth.sessions where user_id = new.id; end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_edu_auth_ban on educators;
create trigger trg_edu_auth_ban after update of account_status on educators for each row execute function sync_educator_auth_ban();
-- If SQL writes to the auth schema are not allowed in your project, do this in an Edge Function with updateUserById({ ban_duration }).
-- Belt and braces: extend the blocked-account check to educators and apply it to educator-facing tables
create or replace function is_account_active() returns boolean
language sql stable security definer set search_path = public as
$$ select not exists (select 1 from students  where id = auth.uid() and status = 'blocked')
      and not exists (select 1 from educators where id = auth.uid() and account_status <> 'active') $$;
do $$ declare t text; begin
  foreach t in array array['test_assignments','assignment_comments','assignment_history','assignment_notifications'] loop
    execute format('drop policy if exists blocked_deny on %I', t);
    execute format('create policy blocked_deny on %I as restrictive for all to authenticated using (is_account_active())', t);
  end loop;
end $$;
-- ====================================================================
-- 5. ADD TEACHER (modal)  - Individual and Bulk
-- ====================================================================
-- Individual: Edge Function first creates the login (auth.admin.createUser / inviteUserByEmail) and passes its id here.
-- p = {firstName,lastName,email,phone,qualification,yearsExperience,subjects:[],gender,dob,bulk:false}
-- Individual add starts active + verified; bulk (p.bulk = true) starts inactive + pending until the invite is accepted.
create or replace function register_educator(p_user_id uuid, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare em text := lower(btrim(coalesce(p->>'email',''))); bulk boolean := coalesce((p->>'bulk')::boolean, false); subs text[];
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  if em = '' then raise exception 'Email is required.'; end if;
  if nullif(btrim(p->>'firstName'),'') is null or nullif(btrim(p->>'lastName'),'') is null then raise exception 'First and last name are required.'; end if;
  if nullif(btrim(p->>'qualification'),'') is null and not bulk then raise exception 'Qualification is required.'; end if;
  if exists (select 1 from profiles where lower(email) = em) then raise exception 'An educator with this email already exists.'; end if;
  select coalesce(array_agg(x), '{}') into subs from jsonb_array_elements_text(coalesce(p->'subjects','[]'::jsonb)) x;
  insert into profiles (id, full_name, email, role) values (p_user_id, btrim(p->>'firstName') || ' ' || btrim(p->>'lastName'), em, 'educator');
  insert into educators (id, phone, gender, dob, qualification, years_experience, subjects, account_status, verification_status, onboarded_via)
  values (p_user_id, nullif(p->>'phone',''), nullif(p->>'gender',''), nullif(p->>'dob','')::date, nullif(btrim(p->>'qualification'),''),
          coalesce(nullif(p->>'yearsExperience','')::int, 0), subs,
          case when bulk then 'inactive' else 'active' end::educator_account,
          case when bulk then 'pending'  else 'verified' end::educator_verification,
          case when bulk then 'bulk_import' else 'admin' end);
  return p_user_id;
end $$;
-- Bulk mode: rows from the uploaded file {name, phone, email}; duplicates are skipped and reported.
create or replace function create_educator_invites(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; em text; ok int := 0; skipped jsonb := '[]'::jsonb;
begin
  if not is_admin() then raise exception 'Admins only'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    em := lower(btrim(coalesce(r->>'email','')));
    if em = '' or nullif(btrim(r->>'name'),'') is null then
      skipped := skipped || jsonb_build_object('email', em, 'reason', 'Name and email are required');
    elsif exists (select 1 from profiles where lower(email) = em) or exists (select 1 from educator_invites where lower(email) = em and status in ('pending','sent')) then
      skipped := skipped || jsonb_build_object('email', em, 'reason', 'Already exists');
    else
      insert into educator_invites (name, phone, email, invited_by) values (btrim(r->>'name'), nullif(r->>'phone',''), em, auth.uid());
      ok := ok + 1;
    end if;
  end loop;
  return jsonb_build_object('created', ok, 'skipped', skipped);
end $$;
-- "Send Invites": the Edge Function reads status = 'pending' rows, calls auth.admin.inviteUserByEmail, then marks them 'sent'
-- and calls register_educator(user_id, row || {"bulk": true}). When the educator accepts, set status = 'accepted'.
-- Educator side
create or replace function touch_educator_last_active() returns void
language sql security definer set search_path = public as $$ update educators set last_active_at = now() where id = auth.uid() $$;
-- ====================================================================
-- 6. ROW LEVEL SECURITY
-- ====================================================================
alter table educator_documents      enable row level security;
alter table educator_ratings        enable row level security;
alter table educator_status_history enable row level security;
alter table educator_invites        enable row level security;
drop policy if exists edu_docs_admin   on educator_documents;
drop policy if exists edu_docs_own     on educator_documents;
drop policy if exists edu_docs_ins     on educator_documents;
drop policy if exists edu_rate_admin   on educator_ratings;
drop policy if exists edu_rate_own     on educator_ratings;
drop policy if exists edu_hist_admin   on educator_status_history;
drop policy if exists edu_inv_admin    on educator_invites;
create policy edu_docs_admin on educator_documents for all using (is_admin()) with check (is_admin());
create policy edu_docs_own   on educator_documents for select using (educator_id = auth.uid());
create policy edu_docs_ins   on educator_documents for insert with check (educator_id = auth.uid());
create policy edu_rate_admin on educator_ratings for all using (is_admin()) with check (is_admin());
create policy edu_rate_own   on educator_ratings for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy edu_hist_admin on educator_status_history for all using (is_admin()) with check (is_admin());
create policy edu_inv_admin  on educator_invites for all using (is_admin()) with check (is_admin());
-- =====================================================================
-- Universal Learning – Discount Management (Supabase / PostgreSQL)
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
       else '₹' || trim(trailing '.' from trim(trailing '0' from d.value::text)) end as value_label,
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
-- Row menu → Edit (patch semantics: only keys present are changed; send null to clear expires_at etc.)
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
-- Row menu → Activate / Deactivate / Archive (+ Restore from archive)
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
-- Refund → frees the usage slot, history stays
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
-- Universal Learning – Transaction History (Supabase / PostgreSQL)
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
-- Table: search + Filters + sort + pagination.  "Showing 1–8 of 8" = total_count
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
-- Row click → full detail panel
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
-- Universal Learning – Refund Management (Supabase / PostgreSQL)
-- Reuses: profiles, educators, test_series, payments, series_enrollments,
--         discount_redemptions, is_admin(), set_updated_at()
-- Re-runnable.
-- =====================================================================
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
-- Universal Learning – Financial Analytics (Supabase / PostgreSQL)
-- Reuses: payments, refund_requests, educators, profiles, is_admin(), set_updated_at()
-- Re-runnable. Read-only page: only one new table (payouts) is needed.
-- =====================================================================
-- ---------- 1. Payouts (educator money out; reuse your table if you already have one) ----------
do $$ begin create type payout_status as enum ('pending','processing','paid','failed');
exception when duplicate_object then null; end $$;
create table if not exists payouts (
  id                uuid primary key default gen_random_uuid(),
  educator_id       uuid not null references educators(id) on delete restrict,
  period_start      date,
  period_end        date,
  amount_inr        numeric(12,2) not null check (amount_inr >= 0),
  status            payout_status not null default 'pending',
  gateway_payout_id text,
  failure_reason    text,
  paid_at           timestamptz,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint payouts_paid_has_date check (status <> 'paid' or paid_at is not null)
);
alter table payouts add column if not exists paid_at timestamptz;
alter table payouts add column if not exists failure_reason text;
alter table payouts add column if not exists gateway_payout_id text;
drop trigger if exists trg_payouts_updated on payouts;
create trigger trg_payouts_updated before update on payouts for each row execute function set_updated_at();
-- ---------- 2. Indexes (every figure on the page is a date-range aggregate) ----------
create index if not exists payments_paid_at_all_idx    on payments (paid_at) where status in ('paid','refunded');
create index if not exists payments_created_status_idx on payments (created_at, status);
create index if not exists refund_approved_at_idx      on refund_requests (decided_at) where status = 'approved';
create index if not exists payouts_paid_at_idx         on payouts (paid_at) where status = 'paid';
create index if not exists payouts_status_idx          on payouts (status);
create index if not exists payouts_educator_idx        on payouts (educator_id);
-- ---------- 3. Date-range dropdown ("Last 30 days") ----------
create or replace function resolve_date_range(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns table (d_from date, d_to date)
language sql stable as $$
  with today as (select (now() at time zone 'Asia/Kolkata')::date as d)
  select
    case p_range
      when 'last_7_days'  then d - 6
      when 'last_30_days' then d - 29
      when 'last_90_days' then d - 89
      when 'this_month'   then date_trunc('month', d)::date
      when 'last_month'   then (date_trunc('month', d) - interval '1 month')::date
      when 'this_year'    then date_trunc('year', d)::date
      when 'all_time'     then date '2000-01-01'
      when 'custom'       then coalesce(p_from, d - 29)
      else d - 29 end,
    case p_range
      when 'last_month'   then (date_trunc('month', d) - interval '1 day')::date
      when 'custom'       then coalesce(p_to, d)
      else d end
  from today;
$$;
-- ---------- 4. Cards: Gross revenue / Net revenue (+ payout & payment-performance extras) ----------
create or replace function get_financial_summary(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_from date; v_to date; t0 timestamptz; t1 timestamptz;
  v_gross numeric; v_txns int; v_refunds numeric; v_payouts numeric; v_fees numeric;
  v_attempts int; v_ok int; v_failed int; v_pending_payouts numeric;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  t0 := v_from::timestamp at time zone 'Asia/Kolkata';
  t1 := (v_to + 1)::timestamp at time zone 'Asia/Kolkata';
  -- GROSS = everything successfully charged in range (a later-refunded sale still counts as gross)
  select coalesce(sum(amount_inr),0), count(*), coalesce(sum(platform_fee_inr),0)
    into v_gross, v_txns, v_fees
    from payments where status in ('paid','refunded') and paid_at >= t0 and paid_at < t1;
  select coalesce(sum(amount_inr),0) into v_refunds
    from refund_requests where status = 'approved' and decided_at >= t0 and decided_at < t1;
  select coalesce(sum(amount_inr),0) into v_payouts
    from payouts where status = 'paid' and paid_at >= t0 and paid_at < t1;
  select coalesce(sum(amount_inr),0) into v_pending_payouts
    from payouts where status in ('pending','processing');
  select count(*) filter (where status in ('paid','refunded','failed')),
         count(*) filter (where status in ('paid','refunded')),
         count(*) filter (where status = 'failed')
    into v_attempts, v_ok, v_failed
    from payments where created_at >= t0 and created_at < t1;
  return jsonb_build_object(
    'range', jsonb_build_object('key', p_range, 'from', v_from, 'to', v_to),
    'gross_revenue_inr',  v_gross,
    'transactions',       v_txns,                              -- "19 transactions"
    'refunds_inr',        v_refunds,
    'payouts_paid_inr',   v_payouts,
    'net_revenue_inr',    v_gross - v_payouts - v_refunds,     -- "After payouts & refunds"
    'platform_fees_inr',  v_fees,
    'pending_payouts_inr', v_pending_payouts,
    'payment_performance', jsonb_build_object(
        'attempts', v_attempts, 'successful', v_ok, 'failed', v_failed,
        'success_rate_pct', case when v_attempts = 0 then null else round(100.0 * v_ok / v_attempts, 1) end));
end $$;
-- ---------- 5. "Revenue Trend" chart: Revenue line + Refunds line ----------
create or replace function get_revenue_trend(
  p_range text default 'last_30_days', p_from date default null, p_to date default null,
  p_granularity text default 'auto'                       -- auto | day | week | month
) returns table (bucket date, revenue_inr numeric, refunds_inr numeric,
                 payouts_inr numeric, net_inr numeric, transactions int)
language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date; t0 timestamptz; t1 timestamptz; g text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  t0 := v_from::timestamp at time zone 'Asia/Kolkata';
  t1 := (v_to + 1)::timestamp at time zone 'Asia/Kolkata';
  g := case when p_granularity in ('day','week','month') then p_granularity
            when (v_to - v_from) < 92  then 'day'
            when (v_to - v_from) < 400 then 'week'
            else 'month' end;
  return query
  with buckets as (
    select generate_series(date_trunc(g, v_from::timestamp)::date, v_to, ('1 ' || g)::interval)::date as b
  ),
  rev as (
    select date_trunc(g, paid_at at time zone 'Asia/Kolkata')::date b,
           sum(amount_inr) amt, count(*)::int n
      from payments where status in ('paid','refunded') and paid_at >= t0 and paid_at < t1 group by 1),
  ref as (
    select date_trunc(g, decided_at at time zone 'Asia/Kolkata')::date b, sum(amount_inr) amt
      from refund_requests where status = 'approved' and decided_at >= t0 and decided_at < t1 group by 1),
  pay as (
    select date_trunc(g, paid_at at time zone 'Asia/Kolkata')::date b, sum(amount_inr) amt
      from payouts where status = 'paid' and paid_at >= t0 and paid_at < t1 group by 1)
  select bu.b,
         coalesce(rev.amt,0), coalesce(ref.amt,0), coalesce(pay.amt,0),
         coalesce(rev.amt,0) - coalesce(ref.amt,0) - coalesce(pay.amt,0),
         coalesce(rev.n,0)
  from buckets bu
  left join rev on rev.b = bu.b
  left join ref on ref.b = bu.b
  left join pay on pay.b = bu.b
  order by bu.b;
end $$;
-- ---------- 6. One call per page load / dropdown change ----------
create or replace function get_financial_analytics(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns jsonb
language sql stable security invoker as $$
  select get_financial_summary(p_range, p_from, p_to)
         || jsonb_build_object('trend',
              coalesce((select jsonb_agg(to_jsonb(t) order by t.bucket)
                          from get_revenue_trend(p_range, p_from, p_to) t), '[]'::jsonb));
$$;
-- Options for the "Date range" dropdown
create or replace function get_financial_range_options() returns jsonb
language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('key','last_7_days',  'label','Last 7 days'),
    jsonb_build_object('key','last_30_days', 'label','Last 30 days'),
    jsonb_build_object('key','last_90_days', 'label','Last 90 days'),
    jsonb_build_object('key','this_month',   'label','This month'),
    jsonb_build_object('key','last_month',   'label','Last month'),
    jsonb_build_object('key','this_year',    'label','This year'),
    jsonb_build_object('key','all_time',     'label','All time'),
    jsonb_build_object('key','custom',       'label','Custom range'));
$$;
-- ---------- 7. Grants ----------
revoke execute on function get_financial_summary(text,date,date), get_revenue_trend(text,date,date,text),
  get_financial_analytics(text,date,date) from public, anon;
grant execute on function get_financial_summary(text,date,date), get_revenue_trend(text,date,date,text),
  get_financial_analytics(text,date,date), get_financial_range_options(), resolve_date_range(text,date,date)
  to authenticated;
-- ---------- 8. RLS ----------
alter table payouts enable row level security;
drop policy if exists payouts_admin_select on payouts;
create policy payouts_admin_select on payouts for select to authenticated using (is_admin());
drop policy if exists payouts_own_select on payouts;
create policy payouts_own_select on payouts for select to authenticated using (educator_id = auth.uid());
revoke insert, update, delete on payouts from anon, authenticated;   -- writes via your payout RPC / service role
-- =====================================================================
-- Universal Learning – Regional Growth (Supabase / PostgreSQL)
-- Reuses: profiles, payments, is_admin(), resolve_date_range() (from Financial Analytics)
-- Re-runnable.
-- =====================================================================
create extension if not exists pg_trgm;
-- ---------- 1. Reference tables ----------
create table if not exists regions (                       -- Indian states / UTs
  code          text primary key,                          -- 'MH'
  name          text not null unique,                      -- 'Maharashtra'
  primary_city  text,                                      -- fallback city label
  sort_order    int not null default 0,
  is_active     boolean not null default true
);
insert into regions (code, name, primary_city) values
 ('AP','Andhra Pradesh','Visakhapatnam'),('AR','Arunachal Pradesh','Itanagar'),('AS','Assam','Guwahati'),
 ('BR','Bihar','Patna'),('CG','Chhattisgarh','Raipur'),('GA','Goa','Panaji'),('GJ','Gujarat','Ahmedabad'),
 ('HR','Haryana','Gurugram'),('HP','Himachal Pradesh','Shimla'),('JH','Jharkhand','Ranchi'),
 ('KA','Karnataka','Bengaluru'),('KL','Kerala','Kochi'),('MP','Madhya Pradesh','Bhopal'),
 ('MH','Maharashtra','Pune'),('MN','Manipur','Imphal'),('ML','Meghalaya','Shillong'),('MZ','Mizoram','Aizawl'),
 ('NL','Nagaland','Kohima'),('OD','Odisha','Bhubaneswar'),('PB','Punjab','Ludhiana'),('RJ','Rajasthan','Jaipur'),
 ('SK','Sikkim','Gangtok'),('TN','Tamil Nadu','Chennai'),('TG','Telangana','Hyderabad'),('TR','Tripura','Agartala'),
 ('UP','Uttar Pradesh','Lucknow'),('UK','Uttarakhand','Dehradun'),('WB','West Bengal','Kolkata'),
 ('AN','Andaman and Nicobar Islands','Port Blair'),('CH','Chandigarh','Chandigarh'),
 ('DN','Dadra and Nagar Haveli and Daman and Diu','Daman'),('DL','Delhi','Delhi'),
 ('JK','Jammu and Kashmir','Srinagar'),('LA','Ladakh','Leh'),('LD','Lakshadweep','Kavaratti'),
 ('PY','Puducherry','Puducherry')
on conflict (code) do nothing;
create table if not exists institutions (                  -- schools / coaching centres ("14 institutions")
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  state_code  text not null references regions(code),
  city        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- who belongs to which institution, and a snapshot of it on every sale
alter table profiles add column if not exists institution_id uuid references institutions(id) on delete set null;
alter table payments add column if not exists institution_id uuid references institutions(id) on delete set null;
create or replace function set_payment_institution() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.institution_id is null then
    select institution_id into new.institution_id from profiles where id = new.user_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_payment_institution on payments;
create trigger trg_payment_institution before insert on payments for each row execute function set_payment_institution();
-- optional one-time backfill for existing rows:
--   update payments p set institution_id = pr.institution_id
--     from profiles pr where pr.id = p.user_id and p.institution_id is null;
drop trigger if exists trg_institutions_updated on institutions;
create trigger trg_institutions_updated before update on institutions for each row execute function set_updated_at();
-- ---------- 2. Indexes ----------
create index if not exists institutions_state_idx     on institutions (state_code) where is_active;
create index if not exists institutions_city_trgm     on institutions using gin (city gin_trgm_ops);
create index if not exists regions_name_trgm          on regions using gin (name gin_trgm_ops);
create index if not exists profiles_institution_idx   on profiles (institution_id);
create index if not exists payments_inst_paid_idx     on payments (institution_id, paid_at) where status = 'paid';
-- ---------- 3. Internal aggregate (revenue per state for a date window) ----------
create or replace function _regional_revenue(p_from date, p_to date)
returns table (state_code text, revenue numeric, txns int)
language sql stable security definer set search_path = public as $$
  select i.state_code, sum(p.amount_inr), count(*)::int
  from payments p
  join institutions i on i.id = p.institution_id
  where p.status = 'paid'
    and p.paid_at >= p_from::timestamp at time zone 'Asia/Kolkata'
    and p.paid_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
  group by i.state_code;
$$;
revoke all on function _regional_revenue(date,date) from public, anon, authenticated;
-- ---------- 4. Summary cards ----------
create or replace function get_regional_summary(
  p_range text default 'last_30_days', p_from date default null, p_to date default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date; r jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  with cur as (select * from _regional_revenue(v_from, v_to)),
       prv as (select * from _regional_revenue(v_from - (v_to - v_from) - 1, v_from - 1)),
       g as (select c.state_code, c.revenue,
                    case when p.revenue > 0 then (c.revenue - p.revenue) / p.revenue * 100 end as mom
               from cur c left join prv p using (state_code)),
       top as (select g.state_code, g.revenue, rg.name from g join regions rg on rg.code = g.state_code
                order by g.revenue desc limit 1)
  select jsonb_build_object(
    'range', jsonb_build_object('key', p_range, 'from', v_from, 'to', v_to),
    'regions_tracked', (select count(distinct state_code) from institutions where is_active),     -- 8
    'institutions',    (select count(*) from institutions where is_active),                       -- "14 institutions"
    'total_revenue_inr', coalesce((select sum(revenue) from cur), 0),                             -- "Selected time period"
    'top_region', (select jsonb_build_object('code', state_code, 'name', name, 'revenue_inr', revenue) from top),
    'avg_growth_pct', (select round(sum(mom * revenue) / nullif(sum(revenue),0), 1)               -- "Revenue-weighted"
                         from g where mom is not null))
  into r;
  return r;
end $$;
-- ---------- 5. Revenue Growth Trend (line chart; "All India" + time-range dropdowns) ----------
create or replace function get_regional_trend(
  p_range text default 'last_30_days', p_from date default null, p_to date default null,
  p_state_code text default null                                 -- null = All India
) returns table (bucket date, revenue_inr numeric, cumulative_inr numeric, transactions int)
language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date; t0 timestamptz; t1 timestamptz; g text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  t0 := v_from::timestamp at time zone 'Asia/Kolkata';
  t1 := (v_to + 1)::timestamp at time zone 'Asia/Kolkata';
  g := case when (v_to - v_from) < 92 then 'day' when (v_to - v_from) < 400 then 'week' else 'month' end;
  return query
  with buckets as (
    select generate_series(date_trunc(g, v_from::timestamp)::date, v_to, ('1 ' || g)::interval)::date b),
  rev as (
    select date_trunc(g, p.paid_at at time zone 'Asia/Kolkata')::date b, sum(p.amount_inr) amt, count(*)::int n
      from payments p join institutions i on i.id = p.institution_id
     where p.status = 'paid' and p.paid_at >= t0 and p.paid_at < t1
       and (p_state_code is null or p_state_code in ('','all') or i.state_code = p_state_code)
     group by 1)
  select bu.b, coalesce(rev.amt,0),
         sum(coalesce(rev.amt,0)) over (order by bu.b), coalesce(rev.n,0)
  from buckets bu left join rev on rev.b = bu.b
  order by bu.b;
end $$;
-- ---------- 6. Revenue by Region (bar chart) ----------
create or replace function get_revenue_by_region(
  p_range text default 'last_30_days', p_from date default null, p_to date default null, p_limit int default 10
) returns table (state_code text, region text, revenue_inr numeric, pct_of_max numeric, pct_of_total numeric)
language plpgsql stable security definer set search_path = public as $$
declare v_from date; v_to date;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  return query
  with c as (select * from _regional_revenue(v_from, v_to)),
       t as (select coalesce(sum(revenue),0) tot, coalesce(max(revenue),0) mx from c)
  select r.code, r.name, coalesce(c.revenue,0),
         case when t.mx = 0 then 0 else round(coalesce(c.revenue,0) / t.mx * 100, 1) end,     -- bar fill height
         case when t.tot = 0 then 0 else round(coalesce(c.revenue,0) / t.tot * 100, 1) end
  from regions r
  left join c on c.state_code = r.code, t
  where exists (select 1 from institutions i where i.state_code = r.code and i.is_active)
  order by coalesce(c.revenue,0) desc, r.name
  limit greatest(p_limit,1);
end $$;
-- ---------- 7. Region Comparison table: search + sort + pagination ----------
create or replace function list_region_comparison(
  p_range  text default 'last_30_days', p_from date default null, p_to date default null,
  p_search text default null,                          -- state or city
  p_sort   text default 'revenue_desc',                -- revenue_desc | mom_desc | yoy_desc | institutions_desc | name_asc
  p_page   int default 1, p_size int default 8
) returns table (row_data jsonb, total_count bigint)
language sql stable security definer set search_path = public as $$
  with b as (select d_from f, d_to t from resolve_date_range(p_range, p_from, p_to)),
  cur as (select c.* from b, _regional_revenue(b.f, b.t) c),
  prv as (select c.* from b, _regional_revenue(b.f - (b.t - b.f) - 1, b.f - 1) c),            -- MoM comparison window
  yoy as (select c.* from b, _regional_revenue((b.f - interval '1 year')::date, (b.t - interval '1 year')::date) c),
  base as (
    select r.code, r.name,
      (select count(*) from institutions i where i.state_code = r.code and i.is_active)        as inst,
      coalesce(cur.revenue,0) as rev, prv.revenue as prev_rev, yoy.revenue as yoy_rev,
      coalesce((select i.city from institutions i
                 where i.state_code = r.code and i.is_active
                 order by (select coalesce(sum(p.amount_inr),0) from payments p
                            where p.institution_id = i.id and p.status = 'paid'
                              and p.paid_at >= b.f::timestamp at time zone 'Asia/Kolkata'
                              and p.paid_at <  (b.t + 1)::timestamp at time zone 'Asia/Kolkata') desc, i.city
                 limit 1), r.primary_city) as city
    from regions r cross join b
    left join cur on cur.state_code = r.code
    left join prv on prv.state_code = r.code
    left join yoy on yoy.state_code = r.code
    where is_admin()
      and exists (select 1 from institutions i where i.state_code = r.code and i.is_active)
      and (p_search is null or p_search = ''
           or r.name ilike '%'||p_search||'%' or r.primary_city ilike '%'||p_search||'%'
           or exists (select 1 from institutions i where i.state_code = r.code and i.city ilike '%'||p_search||'%'))
  ),
  g as (
    select base.*,
      case when prev_rev > 0 then round((rev - prev_rev) / prev_rev * 100, 1) end as mom,
      case when yoy_rev  > 0 then round((rev - yoy_rev)  / yoy_rev  * 100, 1) end as yoy
    from base
  )
  select jsonb_build_object('state_code', g.code, 'region', g.name, 'city', g.city,
                            'institutions', g.inst, 'revenue_inr', g.rev, 'mom_pct', g.mom, 'yoy_pct', g.yoy),
         count(*) over ()
  from g
  order by
    case p_sort when 'name_asc' then g.name end asc,
    case p_sort when 'mom_desc'          then g.mom end desc nulls last,
    case p_sort when 'yoy_desc'          then g.yoy end desc nulls last,
    case p_sort when 'institutions_desc' then g.inst end desc,
    g.rev desc, g.name
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- ---------- 8. Dropdown options ----------
create or replace function get_regional_filter_options() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'regions', jsonb_build_array(jsonb_build_object('code','all','name','All India'))
               || coalesce((select jsonb_agg(jsonb_build_object('code', r.code, 'name', r.name) order by r.name)
                              from regions r where exists
                               (select 1 from institutions i where i.state_code = r.code and i.is_active)), '[]'::jsonb),
    'ranges',  get_financial_range_options());
$$;
-- ---------- 9. One call for the whole page header + charts (table is separate: search/pagination) ----------
create or replace function get_regional_growth(
  p_range text default 'last_30_days', p_from date default null, p_to date default null,
  p_state_code text default null
) returns jsonb
language sql stable security invoker as $$
  select get_regional_summary(p_range, p_from, p_to)
    || jsonb_build_object(
         'trend',     coalesce((select jsonb_agg(to_jsonb(t) order by t.bucket)
                                  from get_regional_trend(p_range, p_from, p_to, p_state_code) t), '[]'::jsonb),
         'by_region', coalesce((select jsonb_agg(to_jsonb(x)) from get_revenue_by_region(p_range, p_from, p_to) x), '[]'::jsonb));
$$;
-- ---------- 10. Grants ----------
revoke execute on function get_regional_summary(text,date,date), get_regional_trend(text,date,date,text),
  get_revenue_by_region(text,date,date,int), list_region_comparison(text,date,date,text,text,int,int),
  get_regional_growth(text,date,date,text) from public, anon;
grant execute on function get_regional_summary(text,date,date), get_regional_trend(text,date,date,text),
  get_revenue_by_region(text,date,date,int), list_region_comparison(text,date,date,text,text,int,int),
  get_regional_growth(text,date,date,text), get_regional_filter_options() to authenticated;
-- ---------- 11. RLS ----------
alter table regions      enable row level security;
alter table institutions enable row level security;
drop policy if exists regions_read on regions;
create policy regions_read on regions for select to authenticated using (true);
drop policy if exists institutions_admin_all on institutions;
create policy institutions_admin_all on institutions for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists institutions_read_own on institutions;
create policy institutions_read_own on institutions for select to authenticated
  using (id = (select institution_id from profiles where id = auth.uid()));
revoke insert, update, delete on regions from anon, authenticated;
-- =====================================================================
-- Universal Learning – Reports & Analytics (custom report builder)
-- Reuses: profiles, students, educators, test_series, series_enrollments, test_assignments,
--         payments, subjects, regions, is_admin(), resolve_date_range() (Financial Analytics)
-- Re-runnable.
-- =====================================================================
-- ---------- 1. Enum ----------
do $$ begin create type report_run_status as enum ('running','completed','failed');
exception when duplicate_object then null; end $$;
-- ---------- 2. Report catalog: drives the "Report type" dropdown AND the dynamic filters ----------
create table if not exists report_types (
  key          text primary key,                       -- 'enrollment'
  label        text not null,
  description  text,
  date_label   text not null default 'Date',           -- what the date range filters, shown as helper text
  columns      jsonb not null,                         -- [{"key","label"}] = table + CSV column order
  filters      jsonb not null default '[]'::jsonb,     -- [{"key","label","type","options"|"source"}]
  sort_order   int not null default 0,
  is_active    boolean not null default true
);
insert into report_types (key, label, description, date_label, sort_order, columns, filters) values
('enrollment', 'Enrollment report', 'Who enrolled in which test series', 'Enrolled on', 1,
 '[{"key":"enrollment_id","label":"Enrollment ID"},{"key":"student","label":"Student"},{"key":"email","label":"Email"},
   {"key":"test_series","label":"Test series"},{"key":"educator","label":"Educator"},{"key":"enrolled_on","label":"Enrolled on"},
   {"key":"status","label":"Status"},{"key":"amount_paid_inr","label":"Amount paid (INR)"}]',
 '[{"key":"series_id","label":"Test series","type":"select","source":"series"},
   {"key":"educator_id","label":"Educator","type":"select","source":"educators"},
   {"key":"status","label":"Status","type":"select","options":["active","revoked"]}]'),
('test_series', 'Courses / test series report', 'Catalogue, enrollments and revenue per test series', 'Created on', 2,
 '[{"key":"title","label":"Test series"},{"key":"subject","label":"Subject"},{"key":"status","label":"Status"},
   {"key":"pricing","label":"Pricing"},{"key":"price_inr","label":"Price (INR)"},{"key":"educators","label":"Educators"},
   {"key":"created_on","label":"Created on"},{"key":"enrollments","label":"Enrollments"},{"key":"revenue_inr","label":"Revenue (INR)"}]',
 '[{"key":"subject_id","label":"Subject","type":"select","source":"subjects"},
   {"key":"status","label":"Status","type":"select","options":["draft","scheduled","published","archived"]},
   {"key":"pricing","label":"Pricing","type":"select","options":["free","paid"]},
   {"key":"educator_id","label":"Educator","type":"select","source":"educators"}]'),
('educators', 'Educator report', 'Educator status, load and earnings', 'Joined on', 3,
 '[{"key":"educator","label":"Educator"},{"key":"email","label":"Email"},{"key":"verification_status","label":"Verification"},
   {"key":"account_status","label":"Account"},{"key":"joined_on","label":"Joined on"},
   {"key":"series_assigned","label":"Test series assigned"},{"key":"sales","label":"Sales"},{"key":"earnings_inr","label":"Earnings (INR)"}]',
 '[{"key":"verification_status","label":"Verification","type":"select","options":["pending","verified","rejected"]},
   {"key":"account_status","label":"Account status","type":"select","options":["active","suspended","blocked"]}]'),
('students', 'Student report', 'Registrations, enrollments and spend', 'Registered on', 4,
 '[{"key":"student","label":"Student"},{"key":"email","label":"Email"},{"key":"grade","label":"Grade"},
   {"key":"account_status","label":"Account"},{"key":"registered_on","label":"Registered on"},
   {"key":"enrollments","label":"Enrollments"},{"key":"total_spent_inr","label":"Total spent (INR)"}]',
 '[{"key":"grade","label":"Grade","type":"select","source":"grades"},
   {"key":"account_status","label":"Account status","type":"select","options":["active","blocked"]},
   {"key":"has_enrollment","label":"Has enrollment","type":"select","options":["yes","no"]}]')
on conflict (key) do update
  set label = excluded.label, description = excluded.description, date_label = excluded.date_label,
      columns = excluded.columns, filters = excluded.filters, sort_order = excluded.sort_order;
-- ---------- 3. Report runs (powers "Not generated yet" → "Generated …", preview and CSV) ----------
create table if not exists report_runs (
  id               uuid primary key default gen_random_uuid(),
  report_type      text not null references report_types(key),
  range_key        text not null,
  date_from        date not null,
  date_to          date not null,
  filters          jsonb not null default '{}'::jsonb,
  status           report_run_status not null default 'running',
  row_count        int,
  result_rows      jsonb,                                  -- snapshot: preview and CSV always match
  error            text,
  requested_by     uuid references profiles(id) on delete set null,
  requested_at     timestamptz not null default now(),
  generated_at     timestamptz,
  csv_downloads    int not null default 0,
  last_exported_at timestamptz,
  expires_at       timestamptz not null default (now() + interval '7 days')   -- snapshot is cleared after this
);
create index if not exists report_runs_user_idx on report_runs (requested_by, requested_at desc);
create index if not exists report_runs_type_idx on report_runs (report_type, requested_at desc);
create index if not exists report_runs_exp_idx  on report_runs (expires_at) where result_rows is not null;
-- ---------- 4. Per-type queries (internal) – each returns one jsonb object per row ----------
create or replace function _report_enrollment(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enrollment_id', se.id, 'student', pr.full_name, 'email', pr.email, 'test_series', ts.title,
    'educator', (select string_agg(distinct ep.full_name, ', ') from test_assignments ta
                  join profiles ep on ep.id = ta.educator_id where ta.series_id = ts.id),
    'enrolled_on', (se.created_at at time zone 'Asia/Kolkata')::date,
    'status', case when se.revoked_at is not null then 'revoked' else 'active' end,
    'amount_paid_inr', coalesce((select sum(pm.amount_inr) from payments pm
                                  where pm.user_id = se.user_id and pm.series_id = se.series_id and pm.status = 'paid'), 0))
  from series_enrollments se
  join profiles pr on pr.id = se.user_id
  join test_series ts on ts.id = se.series_id
  where se.created_at >= p_from::timestamp at time zone 'Asia/Kolkata'
    and se.created_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
    and (p_f->>'series_id' is null or se.series_id = (p_f->>'series_id')::uuid)
    and (p_f->>'educator_id' is null or exists (select 1 from test_assignments ta
           where ta.series_id = se.series_id and ta.educator_id = (p_f->>'educator_id')::uuid))
    and (p_f->>'status' is null or (case when se.revoked_at is not null then 'revoked' else 'active' end) = p_f->>'status')
  order by se.created_at desc;
$$;
create or replace function _report_test_series(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'title', ts.title, 'subject', sb.name, 'status', ts.status::text,
    'pricing', case when ts.is_free then 'free' else 'paid' end, 'price_inr', ts.price_inr,
    'educators', (select string_agg(distinct ep.full_name, ', ') from test_assignments ta
                   join profiles ep on ep.id = ta.educator_id where ta.series_id = ts.id),
    'created_on', (ts.created_at at time zone 'Asia/Kolkata')::date,
    'enrollments', (select count(*) from series_enrollments se where se.series_id = ts.id),
    'revenue_inr', coalesce((select sum(pm.amount_inr) from payments pm where pm.series_id = ts.id and pm.status = 'paid'), 0))
  from test_series ts
  left join subjects sb on sb.id = ts.subject_id
  where ts.deleted_at is null
    and ts.created_at >= p_from::timestamp at time zone 'Asia/Kolkata'
    and ts.created_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
    and (p_f->>'subject_id' is null or ts.subject_id = (p_f->>'subject_id')::uuid)
    and (p_f->>'status'     is null or ts.status::text = p_f->>'status')
    and (p_f->>'pricing'    is null or (case when ts.is_free then 'free' else 'paid' end) = p_f->>'pricing')
    and (p_f->>'educator_id' is null or exists (select 1 from test_assignments ta
           where ta.series_id = ts.id and ta.educator_id = (p_f->>'educator_id')::uuid))
  order by ts.created_at desc;
$$;
create or replace function _report_educators(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'educator', pr.full_name, 'email', pr.email,
    'verification_status', e.verification_status::text, 'account_status', e.account_status::text,
    'joined_on', (pr.created_at at time zone 'Asia/Kolkata')::date,
    'series_assigned', (select count(distinct ta.series_id) from test_assignments ta where ta.educator_id = e.id),
    'sales',        (select count(*) from payments pm where pm.educator_id = e.id and pm.status = 'paid'),
    'earnings_inr', coalesce((select sum(pm.educator_earning_inr) from payments pm
                               where pm.educator_id = e.id and pm.status = 'paid'), 0))
  from educators e
  join profiles pr on pr.id = e.id
  where pr.created_at >= p_from::timestamp at time zone 'Asia/Kolkata'
    and pr.created_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
    and (p_f->>'verification_status' is null or e.verification_status::text = p_f->>'verification_status')
    and (p_f->>'account_status'      is null or e.account_status::text      = p_f->>'account_status')
  order by pr.created_at desc;
$$;
create or replace function _report_students(p_from date, p_to date, p_f jsonb) returns setof jsonb
language sql stable security definer set search_path = public as $$
  with s as (
    select st.id, pr.full_name, pr.email, st.grade, st.account_status::text as acct, pr.created_at,
           (select count(*) from series_enrollments se where se.user_id = st.id) as enr,
           coalesce((select sum(pm.amount_inr) from payments pm where pm.user_id = st.id and pm.status = 'paid'), 0) as spent
    from students st join profiles pr on pr.id = st.id
    where pr.created_at >= p_from::timestamp at time zone 'Asia/Kolkata'
      and pr.created_at <  (p_to + 1)::timestamp at time zone 'Asia/Kolkata'
      and (p_f->>'grade' is null or st.grade = p_f->>'grade')
      and (p_f->>'account_status' is null or st.account_status::text = p_f->>'account_status')
  )
  select jsonb_build_object('student', full_name, 'email', email, 'grade', grade, 'account_status', acct,
           'registered_on', (created_at at time zone 'Asia/Kolkata')::date,
           'enrollments', enr, 'total_spent_inr', spent)
  from s
  where (p_f->>'has_enrollment' is null
         or (p_f->>'has_enrollment' = 'yes' and enr > 0) or (p_f->>'has_enrollment' = 'no' and enr = 0))
  order by created_at desc;
$$;
revoke all on function _report_enrollment(date,date,jsonb), _report_test_series(date,date,jsonb),
  _report_educators(date,date,jsonb), _report_students(date,date,jsonb) from public, anon, authenticated;
-- ---------- 5. Builder options: report-type dropdown, date-range dropdown ----------
create or replace function get_report_builder_options() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'types',  coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label, 'description', description,
                         'date_label', date_label, 'columns', columns, 'filters', filters) order by sort_order)
                          from report_types where is_active), '[]'::jsonb),
    'ranges', get_financial_range_options());
$$;
-- Fills the "select" filters that come from data ("Select a report type to see its filters")
create or replace function get_report_filter_options(p_type text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'series',    coalesce((select jsonb_agg(jsonb_build_object('value', id, 'label', title) order by title)
                             from test_series where deleted_at is null), '[]'),
    'educators', coalesce((select jsonb_agg(jsonb_build_object('value', e.id, 'label', p.full_name) order by p.full_name)
                             from educators e join profiles p on p.id = e.id), '[]'),
    'subjects',  coalesce((select jsonb_agg(jsonb_build_object('value', id, 'label', name) order by name) from subjects), '[]'),
    'grades',    coalesce((select jsonb_agg(jsonb_build_object('value', g, 'label', g) order by g)
                             from (select distinct grade g from students where grade is not null) x), '[]'));
end $$;
-- ---------- 6. "Generate report" button ----------
create or replace function generate_report(
  p_type text, p_range text, p_from date default null, p_to date default null,
  p_filters jsonb default '{}'::jsonb, p_preview int default 100
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t report_types; v_from date; v_to date; v_run uuid; v_rows jsonb; v_n int; v_f jsonb;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into t from report_types where key = p_type and is_active;
  if not found then raise exception 'Select a report type.'; end if;
  if p_range is null or p_range in ('', 'none') then raise exception 'Select a date range.'; end if;
  select d_from, d_to into v_from, v_to from resolve_date_range(p_range, p_from, p_to);
  if v_from > v_to then raise exception 'Start date must be on or before the end date.'; end if;
  -- drop blank filters so "All" means no filter
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_f
    from jsonb_each(coalesce(p_filters, '{}'::jsonb)) as f(k, v)
   where v <> 'null'::jsonb and v <> '""'::jsonb;
  insert into report_runs (report_type, range_key, date_from, date_to, filters, status, requested_by)
  values (p_type, p_range, v_from, v_to, v_f, 'running', auth.uid())
  returning id into v_run;
  begin
    select coalesce(jsonb_agg(x.r), '[]'::jsonb), count(*) into v_rows, v_n
    from (
      select r from (
        select r from _report_enrollment(v_from, v_to, v_f) r   where p_type = 'enrollment'
        union all
        select r from _report_test_series(v_from, v_to, v_f) r  where p_type = 'test_series'
        union all
        select r from _report_educators(v_from, v_to, v_f) r    where p_type = 'educators'
        union all
        select r from _report_students(v_from, v_to, v_f) r     where p_type = 'students'
      ) u
      limit 10001
    ) x;
    if v_n > 10000 then raise exception 'More than 10,000 rows. Narrow the date range or add filters.'; end if;
    update report_runs set status = 'completed', row_count = v_n, result_rows = v_rows, generated_at = now()
     where id = v_run;
  exception when others then
    update report_runs set status = 'failed', error = sqlerrm where id = v_run;
    return jsonb_build_object('ok', false, 'run_id', v_run, 'error', sqlerrm);
  end;
  return jsonb_build_object(
    'ok', true, 'run_id', v_run, 'type', p_type, 'label', t.label,
    'range', jsonb_build_object('key', p_range, 'from', v_from, 'to', v_to),
    'filters', v_f, 'columns', t.columns, 'row_count', v_n, 'generated_at', now(),
    'rows', (select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
               from jsonb_array_elements(v_rows) with ordinality as a(e, i) where i <= greatest(p_preview, 1)));
end $$;
-- Re-open / page through a generated report (preview table)
create or replace function get_report_run(p_run_id uuid, p_page int default 1, p_size int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r report_runs; t report_types;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from report_runs where id = p_run_id;
  if not found then raise exception 'Report not found.'; end if;
  select * into t from report_types where key = r.report_type;
  if r.result_rows is null then raise exception 'This report has expired. Generate it again.'; end if;
  return jsonb_build_object(
    'run_id', r.id, 'type', r.report_type, 'label', t.label, 'status', r.status,
    'range', jsonb_build_object('key', r.range_key, 'from', r.date_from, 'to', r.date_to),
    'filters', r.filters, 'columns', t.columns, 'row_count', r.row_count, 'generated_at', r.generated_at,
    'rows', (select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
               from jsonb_array_elements(r.result_rows) with ordinality as a(e, i)
              where i > (greatest(p_page,1)-1) * greatest(p_size,1) and i <= greatest(p_page,1) * greatest(p_size,1)));
end $$;
-- ---------- 7. "CSV" button ----------
create or replace function export_report_csv(p_run_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r report_runs; t report_types; v_head text; v_body text;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from report_runs where id = p_run_id and status = 'completed';
  if not found then raise exception 'Generate a report first.'; end if;
  if r.result_rows is null then raise exception 'This report has expired. Generate it again.'; end if;
  select * into t from report_types where key = r.report_type;
  select string_agg('"' || replace(c->>'label', '"', '""') || '"', ',' order by o) into v_head
    from jsonb_array_elements(t.columns) with ordinality as cc(c, o);
  select coalesce(string_agg(line, E'\n' order by ord), '') into v_body
  from (
    select rr.ord,
           (select string_agg('"' || replace(
                      case when coalesce(rr.r->>(c->>'key'),'') ~ '^[=+\-@]'          -- spreadsheet formula guard
                           then '''' || (rr.r->>(c->>'key')) else coalesce(rr.r->>(c->>'key'),'') end,
                      '"', '""') || '"', ',' order by o)
              from jsonb_array_elements(t.columns) with ordinality as cc(c, o)) as line
    from jsonb_array_elements(r.result_rows) with ordinality as rr(r, ord)
  ) z;
  update report_runs set csv_downloads = csv_downloads + 1, last_exported_at = now() where id = p_run_id;
  return jsonb_build_object(
    'filename', r.report_type || '-report-' || to_char(r.generated_at at time zone 'Asia/Kolkata', 'YYYYMMDD-HH24MI') || '.csv',
    'content', E'\ufeff' || v_head || E'\n' || v_body);                                 -- BOM so Excel reads ₹/UTF-8 correctly
end $$;
-- ---------- 8. Recent runs ----------
create or replace function list_report_runs(p_page int default 1, p_size int default 10)
returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  select jsonb_build_object('id', r.id, 'report_type', r.report_type, 'label', t.label,
           'range_key', r.range_key, 'date_from', r.date_from, 'date_to', r.date_to, 'filters', r.filters,
           'status', r.status, 'row_count', r.row_count, 'generated_at', r.generated_at,
           'requested_at', r.requested_at, 'can_reopen', (r.result_rows is not null)),
         count(*) over ()
  from report_runs r join report_types t on t.key = r.report_type
  where r.requested_by = auth.uid() or is_admin()
  order by r.requested_at desc
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- Housekeeping: clears expired snapshots but keeps the run record.
create or replace function purge_expired_report_results() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update report_runs set result_rows = null where result_rows is not null and expires_at < now();
  get diagnostics n = row_count; return n;
end $$;
-- select cron.schedule('purge-report-results', '30 2 * * *', $$select purge_expired_report_results()$$);
-- ---------- 9. Grants ----------
revoke all on function generate_report(text,text,date,date,jsonb,int), get_report_run(uuid,int,int),
  export_report_csv(uuid), get_report_filter_options(text), purge_expired_report_results() from public, anon;
grant execute on function get_report_builder_options(), get_report_filter_options(text),
  generate_report(text,text,date,date,jsonb,int), get_report_run(uuid,int,int),
  export_report_csv(uuid), list_report_runs(int,int) to authenticated;
revoke all on function purge_expired_report_results() from authenticated;
-- ---------- 10. RLS ----------
alter table report_types enable row level security;
alter table report_runs  enable row level security;
drop policy if exists report_types_admin_read on report_types;
create policy report_types_admin_read on report_types for select to authenticated using (is_admin());
drop policy if exists report_runs_select on report_runs;
create policy report_runs_select on report_runs for select to authenticated
  using (is_admin() or requested_by = auth.uid());
revoke insert, update, delete on report_types, report_runs from anon, authenticated;   -- writes via RPCs only
-- =====================================================================
-- Universal Learning – Publish Notifications (Supabase / PostgreSQL)
-- Reuses: profiles, students, educators, series_enrollments, test_series, is_admin(), set_updated_at(), pg_trgm
-- Re-runnable.
-- =====================================================================
create extension if not exists pg_trgm;
-- ---------- 1. Enums ----------
do $$ begin create type notification_category as enum ('system','policy','alert','announcement');
exception when duplicate_object then null; end $$;
do $$ begin create type notification_status as enum ('draft','scheduled','published','archived');
exception when duplicate_object then null; end $$;
do $$ begin create type notification_audience as enum
  ('all_users','learners','educators','admins','series_enrolled','selected_users');
exception when duplicate_object then null; end $$;
do $$ begin create type notification_channel as enum ('in_app','email');
exception when duplicate_object then null; end $$;
do $$ begin create type email_delivery_status as enum ('not_requested','queued','sent','failed');
exception when duplicate_object then null; end $$;
do $$ begin create type recipient_delivery_status as enum ('queued','delivered','failed');
exception when duplicate_object then null; end $$;
do $$ begin create type notification_event_type as enum ('created','edited','scheduled','published','archived');
exception when duplicate_object then null; end $$;
-- ---------- 2. Tables ----------
create table if not exists notifications (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null check (char_length(btrim(title)) between 3 and 120),
  body               text not null check (char_length(btrim(body)) between 1 and 2000),
  category           notification_category not null default 'announcement',
  audience_type      notification_audience not null default 'all_users',
  audience_series_ids uuid[] not null default '{}',                   -- for series_enrolled
  audience_user_ids   uuid[] not null default '{}',                   -- for selected_users
  channels           notification_channel[] not null default '{in_app}',   -- {in_app} | {email,in_app}
  action_url         text,                                            -- optional "open" link in the feed
  status             notification_status not null default 'draft',
  scheduled_for      timestamptz,
  published_at       timestamptz,
  edited_at          timestamptz,
  archived_at        timestamptz,
  recipients_total   int not null default 0,          -- "Delivered 1811 / 1842" → denominator
  delivered_count    int not null default 0,          -- numerator
  opened_count       int not null default 0,          -- "Opened 1236"
  created_by         uuid references profiles(id) on delete set null,
  updated_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint notif_channels_ok  check (cardinality(channels) >= 1),
  constraint notif_sched_ok     check (status <> 'scheduled' or scheduled_for is not null),
  constraint notif_series_ok    check (audience_type <> 'series_enrolled' or cardinality(audience_series_ids) > 0),
  constraint notif_users_ok     check (audience_type <> 'selected_users'  or cardinality(audience_user_ids) > 0)
);
-- one row per recipient (fan-out) = the in-app inbox + delivery/open tracking
create table if not exists notification_recipients (
  id               uuid primary key default gen_random_uuid(),
  notification_id  uuid not null references notifications(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  in_app           boolean not null default true,
  email_status     email_delivery_status not null default 'not_requested',
  email_sent_at    timestamptz,
  email_error      text,
  delivery_status  recipient_delivery_status not null default 'queued',
  delivered_at     timestamptz,
  read_at          timestamptz,                                       -- "Opened"
  created_at       timestamptz not null default now(),
  unique (notification_id, user_id)
);
create table if not exists notification_events (
  id               uuid primary key default gen_random_uuid(),
  notification_id  uuid not null references notifications(id) on delete cascade,
  event_type       notification_event_type not null,
  actor_id         uuid references profiles(id) on delete set null,
  detail           jsonb,
  created_at       timestamptz not null default now()
);
-- ---------- 3. Indexes ----------
create index if not exists notif_status_idx     on notifications (status, created_at desc);
create index if not exists notif_category_idx   on notifications (category);
create index if not exists notif_audience_idx   on notifications (audience_type);
create index if not exists notif_due_idx        on notifications (scheduled_for) where status = 'scheduled';
create index if not exists notif_title_trgm     on notifications using gin (title gin_trgm_ops);
create index if not exists notif_body_trgm      on notifications using gin (body  gin_trgm_ops);
create index if not exists nrec_notif_idx       on notification_recipients (notification_id);
create index if not exists nrec_inbox_idx       on notification_recipients (user_id, delivered_at desc) where in_app;
create index if not exists nrec_unread_idx      on notification_recipients (user_id) where read_at is null and in_app;
create index if not exists nrec_email_queue_idx on notification_recipients (notification_id) where email_status = 'queued';
create index if not exists nevents_idx          on notification_events (notification_id, created_at);
drop trigger if exists trg_notifications_updated on notifications;
create trigger trg_notifications_updated before update on notifications for each row execute function set_updated_at();
-- ---------- 4. Counters (kept in sync by statement-level triggers, so fan-out of 1,800 rows = 1 update) ----------
create or replace function nrec_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update notifications n
     set recipients_total = n.recipients_total + s.c,
         delivered_count  = n.delivered_count  + s.d,
         opened_count     = n.opened_count     + s.o
    from (select notification_id, count(*) c,
                 count(*) filter (where delivery_status = 'delivered') d,
                 count(*) filter (where read_at is not null) o
            from new_rows group by 1) s
   where n.id = s.notification_id;
  return null;
end $$;
drop trigger if exists trg_nrec_ins on notification_recipients;
create trigger trg_nrec_ins after insert on notification_recipients
  referencing new table as new_rows for each statement execute function nrec_after_insert();
create or replace function nrec_after_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update notifications n
     set delivered_count = n.delivered_count + s.dd,
         opened_count    = n.opened_count    + s.dro
    from (select nw.notification_id,
                 sum((nw.delivery_status = 'delivered')::int - (od.delivery_status = 'delivered')::int) dd,
                 sum((nw.read_at is not null)::int - (od.read_at is not null)::int) dro
            from new_rows nw join old_rows od on od.id = nw.id group by 1) s
   where n.id = s.notification_id and (s.dd <> 0 or s.dro <> 0);
  return null;
end $$;
drop trigger if exists trg_nrec_upd on notification_recipients;
create trigger trg_nrec_upd after update on notification_recipients
  referencing old table as old_rows new table as new_rows for each statement execute function nrec_after_update();
-- ---------- 5. Audience resolution ----------
-- ASSUMES: profiles.role = 'admin' marks admins; students/educators have account_status.
create or replace function _resolve_audience(p_type notification_audience, p_series uuid[], p_users uuid[])
returns setof uuid language sql stable security definer set search_path = public as $$
  select st.id from students st where p_type in ('all_users','learners') and st.account_status::text = 'active'
  union
  select e.id  from educators e where p_type in ('all_users','educators') and e.account_status::text = 'active'
  union
  select p.id  from profiles p  where p_type in ('all_users','admins') and p.role::text = 'admin'
  union
  select se.user_id from series_enrollments se
   where p_type = 'series_enrolled' and se.series_id = any(p_series) and se.revoked_at is null
  union
  select u from unnest(p_users) u where p_type = 'selected_users';
$$;
revoke all on function _resolve_audience(notification_audience, uuid[], uuid[]) from public, anon, authenticated;
-- "this will reach N people" in the Create/Edit modal
create or replace function estimate_audience(p_type notification_audience, p_series_ids uuid[] default '{}', p_user_ids uuid[] default '{}')
returns int language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return (select count(*) from _resolve_audience(p_type, p_series_ids, p_user_ids));
end $$;
-- ---------- 6. List view + read RPCs ----------
drop view if exists v_notifications_list;
create view v_notifications_list with (security_invoker = true) as
select
  n.id, n.title, n.body, n.category, initcap(n.category::text) as category_label,
  n.audience_type,
  case n.audience_type
    when 'all_users' then 'All users' when 'learners' then 'All learners' when 'educators' then 'Educators'
    when 'admins' then 'Admins'
    when 'series_enrolled' then 'Enrolled in ' || cardinality(n.audience_series_ids) || ' series'
    else cardinality(n.audience_user_ids) || ' selected users' end as audience_label,
  n.channels,
  case when 'email' = any(n.channels) and 'in_app' = any(n.channels) then 'Email + In-app'
       when 'email' = any(n.channels) then 'Email' else 'In-app' end as channels_label,
  n.status, n.scheduled_for, n.published_at, n.created_at,
  case n.status
    when 'published' then 'Sent ' || to_char(n.published_at at time zone 'UTC', 'Mon DD, YYYY')
    when 'scheduled' then to_char(n.scheduled_for at time zone 'UTC', 'Mon DD, YYYY · HH24:MI "UTC"')
    else 'Not scheduled' end as when_label,
  n.recipients_total, n.delivered_count, n.opened_count,
  n.created_by, p.full_name as created_by_name
from notifications n
left join profiles p on p.id = n.created_by
where n.status <> 'archived';
-- Table: search + the three "All" filters + pagination
create or replace function list_notifications(
  p_search text default null, p_status text default null, p_category text default null,
  p_audience text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  select to_jsonb(v), count(*) over ()
  from v_notifications_list v
  where (p_search is null or p_search = '' or v.title ilike '%'||p_search||'%' or v.body ilike '%'||p_search||'%')
    and (p_status   is null or p_status   in ('','all') or v.status::text        = p_status)
    and (p_category is null or p_category in ('','all') or v.category::text      = p_category)
    and (p_audience is null or p_audience in ('','all') or v.audience_type::text = p_audience)
  order by v.created_at desc, v.id
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- Cards: Total / Published / Drafts
create or replace function get_notification_stats() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'total',     count(*) filter (where status <> 'archived'),
    'published', count(*) filter (where status = 'published'),
    'drafts',    count(*) filter (where status = 'draft'),
    'scheduled', count(*) filter (where status = 'scheduled'),
    'delivered', coalesce(sum(delivered_count) filter (where status = 'published'), 0),
    'opened',    coalesce(sum(opened_count)    filter (where status = 'published'), 0))
  from notifications;
$$;
-- Dropdown options for the three filters
create or replace function get_notification_filter_options() returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'statuses',   jsonb_build_array('draft','scheduled','published'),
    'categories', jsonb_build_array('system','policy','alert','announcement'),
    'audiences',  jsonb_build_array('all_users','learners','educators','admins','series_enrolled','selected_users'),
    'channels',   jsonb_build_array('in_app','email'));
$$;
-- Edit modal
create or replace function get_notification(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n notifications;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into n from notifications where id = p_id;
  if not found then raise exception 'Notification not found.'; end if;
  return to_jsonb(n) || jsonb_build_object(
    'audience_estimate', (select count(*) from _resolve_audience(n.audience_type, n.audience_series_ids, n.audience_user_ids)));
end $$;
-- "Preview" button: works for a saved row (p_id) or an unsaved form (pass fields; they override the row)
create or replace function preview_notification(
  p_id uuid default null, p_title text default null, p_body text default null,
  p_category notification_category default null, p_audience_type notification_audience default null,
  p_series_ids uuid[] default null, p_user_ids uuid[] default null,
  p_channels notification_channel[] default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n notifications;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_id is not null then select * into n from notifications where id = p_id; end if;
  n.title         := coalesce(p_title, n.title, '');
  n.body          := coalesce(p_body, n.body, '');
  n.category      := coalesce(p_category, n.category, 'announcement');
  n.audience_type := coalesce(p_audience_type, n.audience_type, 'all_users');
  n.audience_series_ids := coalesce(p_series_ids, n.audience_series_ids, '{}');
  n.audience_user_ids   := coalesce(p_user_ids, n.audience_user_ids, '{}');
  n.channels      := coalesce(p_channels, n.channels, '{in_app}');
  return jsonb_build_object(
    'in_app', case when 'in_app' = any(n.channels)
                   then jsonb_build_object('title', n.title, 'body', n.body, 'category', n.category) end,
    'email',  case when 'email' = any(n.channels)
                   then jsonb_build_object('subject', n.title, 'body', n.body) end,
    'audience_type', n.audience_type,
    'estimated_recipients', (select count(*) from _resolve_audience(n.audience_type, n.audience_series_ids, n.audience_user_ids)));
end $$;
-- ---------- 7. Write RPCs: Create / Edit / Publish ----------
-- "Create notification" → Save as draft | Schedule | Publish now
create or replace function create_notification(
  p_title text, p_body text, p_category notification_category,
  p_audience_type notification_audience, p_channels notification_channel[] default '{in_app}',
  p_series_ids uuid[] default '{}', p_user_ids uuid[] default '{}',
  p_scheduled_for timestamptz default null, p_action text default 'draft',      -- draft | schedule | publish
  p_action_url text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_action = 'schedule' and (p_scheduled_for is null or p_scheduled_for <= now()) then
    raise exception 'Pick a future date and time to schedule.'; end if;
  insert into notifications (title, body, category, audience_type, audience_series_ids, audience_user_ids,
                             channels, action_url, status, scheduled_for, created_by, updated_by)
  values (btrim(p_title), btrim(p_body), p_category, p_audience_type, coalesce(p_series_ids,'{}'), coalesce(p_user_ids,'{}'),
          p_channels, p_action_url, case when p_action = 'schedule' then 'scheduled' else 'draft' end::notification_status,
          case when p_action = 'schedule' then p_scheduled_for end, auth.uid(), auth.uid())
  returning id into v_id;
  insert into notification_events (notification_id, event_type, actor_id) values (v_id, 'created', auth.uid());
  if p_action = 'schedule' then
    insert into notification_events (notification_id, event_type, actor_id, detail)
    values (v_id, 'scheduled', auth.uid(), jsonb_build_object('at', p_scheduled_for));
  end if;
  if p_action = 'publish' then perform _publish_notification(v_id, auth.uid()); end if;
  return v_id;
end $$;
-- "Edit" button (draft/scheduled: everything; published: wording only so recipients aren't changed after the fact)
create or replace function update_notification(p_id uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare o notifications; v_locked text[] := array['audience_type','series_ids','user_ids','channels','scheduled_for'];
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into o from notifications where id = p_id for update;
  if not found then raise exception 'Notification not found.'; end if;
  if o.status = 'archived' then raise exception 'Archived notifications cannot be edited.'; end if;
  if o.status = 'published' and exists (select 1 from jsonb_object_keys(p_patch) k where k = any(v_locked)) then
    raise exception 'Audience, channels and schedule can''t change after publishing. Edit the wording, or create a new notification.';
  end if;
  update notifications set
    title         = case when p_patch ? 'title' then btrim(p_patch->>'title') else title end,
    body          = case when p_patch ? 'body' then btrim(p_patch->>'body') else body end,
    category      = case when p_patch ? 'category' then (p_patch->>'category')::notification_category else category end,
    action_url    = case when p_patch ? 'action_url' then p_patch->>'action_url' else action_url end,
    audience_type = case when p_patch ? 'audience_type' then (p_patch->>'audience_type')::notification_audience else audience_type end,
    audience_series_ids = case when p_patch ? 'series_ids'
        then coalesce(array(select jsonb_array_elements_text(p_patch->'series_ids')::uuid), '{}') else audience_series_ids end,
    audience_user_ids = case when p_patch ? 'user_ids'
        then coalesce(array(select jsonb_array_elements_text(p_patch->'user_ids')::uuid), '{}') else audience_user_ids end,
    channels      = case when p_patch ? 'channels'
        then array(select jsonb_array_elements_text(p_patch->'channels')::notification_channel) else channels end,
    scheduled_for = case when p_patch ? 'scheduled_for' then (p_patch->>'scheduled_for')::timestamptz else scheduled_for end,
    status        = case when o.status in ('draft','scheduled') and p_patch ? 'scheduled_for'
                         then (case when p_patch->>'scheduled_for' is null then 'draft' else 'scheduled' end)::notification_status
                         else status end,
    edited_at = now(), updated_by = auth.uid()
  where id = p_id;
  insert into notification_events (notification_id, event_type, actor_id, detail)
  values (p_id, 'edited', auth.uid(), p_patch);
end $$;
-- internal: fan-out to recipients and flip to published
create or replace function _publish_notification(p_id uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n notifications; v_in boolean; v_mail boolean; v_cnt int;
begin
  select * into n from notifications where id = p_id for update;
  if not found then raise exception 'Notification not found.'; end if;
  if n.status not in ('draft','scheduled') then raise exception 'Notification is already %.', n.status; end if;
  v_in   := 'in_app' = any(n.channels);
  v_mail := 'email'  = any(n.channels);
  insert into notification_recipients (notification_id, user_id, in_app, email_status, delivery_status, delivered_at)
  select n.id, a, v_in,
         case when v_mail then 'queued' else 'not_requested' end::email_delivery_status,
         case when v_in then 'delivered' else 'queued' end::recipient_delivery_status,
         case when v_in then now() end
  from _resolve_audience(n.audience_type, n.audience_series_ids, n.audience_user_ids) a
  on conflict (notification_id, user_id) do nothing;
  get diagnostics v_cnt = row_count;
  if v_cnt = 0 then raise exception 'No recipients match this audience.'; end if;
  update notifications set status = 'published', published_at = now(), updated_by = p_actor where id = p_id;
  insert into notification_events (notification_id, event_type, actor_id, detail)
  values (p_id, 'published', p_actor, jsonb_build_object('recipients', v_cnt));
  -- if email is selected, an Edge Function sends rows where email_status = 'queued' then calls record_email_results()
  return jsonb_build_object('id', p_id, 'recipients', v_cnt, 'email_queued', case when v_mail then v_cnt else 0 end);
end $$;
revoke all on function _publish_notification(uuid, uuid) from public, anon, authenticated;
-- "Publish" button
create or replace function publish_notification(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return _publish_notification(p_id, auth.uid());
end $$;
-- scheduled notifications go out via pg_cron every minute
create or replace function dispatch_due_notifications() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id from notifications where status = 'scheduled' and scheduled_for <= now() for update skip locked loop
    begin perform _publish_notification(r.id, null); n := n + 1;
    exception when others then
      update notifications set status = 'draft' where id = r.id;       -- fell through (e.g. empty audience): back to draft
      insert into notification_events (notification_id, event_type, detail)
      values (r.id, 'edited', jsonb_build_object('dispatch_error', sqlerrm));
    end;
  end loop;
  return n;
end $$;
-- select cron.schedule('dispatch-notifications', '* * * * *', $$select dispatch_due_notifications()$$);
-- optional extras: remove an unpublished draft, archive a published one
create or replace function delete_draft_notification(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  delete from notifications where id = p_id and status in ('draft','scheduled');
  if not found then raise exception 'Only drafts and scheduled notifications can be deleted.'; end if;
end $$;
create or replace function archive_notification(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  update notifications set status = 'archived', archived_at = now(), updated_by = auth.uid()
   where id = p_id and status = 'published';
  if not found then raise exception 'Only published notifications can be archived.'; end if;
  insert into notification_events (notification_id, event_type, actor_id) values (p_id, 'archived', auth.uid());
end $$;
-- email worker callback (service role): [{"user_id": "...", "ok": true, "error": null}, ...]
create or replace function record_email_results(p_notification_id uuid, p_results jsonb) returns void
language sql security definer set search_path = public as $$
  update notification_recipients nr
     set email_status    = case when x.ok then 'sent' else 'failed' end::email_delivery_status,
         email_sent_at   = case when x.ok then now() end,
         email_error     = case when x.ok then null else x.error end,
         delivery_status = case when nr.delivery_status = 'delivered' then nr.delivery_status
                                when x.ok then 'delivered' else 'failed' end::recipient_delivery_status,
         delivered_at    = coalesce(nr.delivered_at, case when x.ok then now() end)
    from jsonb_to_recordset(p_results) as x(user_id uuid, ok boolean, error text)
   where nr.notification_id = p_notification_id and nr.user_id = x.user_id;
$$;
-- ---------- 8. Recipient side (in-app bell/inbox; this is what makes "Opened" count) ----------
create or replace function list_my_notifications(p_unread_only boolean default false, p_page int default 1, p_size int default 20)
returns table (row_data jsonb, total_count bigint)
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'category', n.category,
           'action_url', n.action_url, 'delivered_at', nr.delivered_at, 'read', nr.read_at is not null),
         count(*) over ()
  from notification_recipients nr join notifications n on n.id = nr.notification_id
  where nr.user_id = auth.uid() and nr.in_app and n.status = 'published'
    and (not p_unread_only or nr.read_at is null)
  order by nr.delivered_at desc
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
create or replace function get_my_unread_notification_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from notification_recipients nr join notifications n on n.id = nr.notification_id
   where nr.user_id = auth.uid() and nr.in_app and nr.read_at is null and n.status = 'published';
$$;
create or replace function mark_notification_read(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update notification_recipients set read_at = now()
   where notification_id = p_id and user_id = auth.uid() and read_at is null;
$$;
create or replace function mark_all_notifications_read() returns void
language sql security definer set search_path = public as $$
  update notification_recipients set read_at = now() where user_id = auth.uid() and read_at is null and in_app;
$$;
-- ---------- 9. Grants ----------
revoke all on function record_email_results(uuid, jsonb), dispatch_due_notifications() from public, anon, authenticated;
grant execute on function record_email_results(uuid, jsonb), dispatch_due_notifications() to service_role;
grant execute on function
  list_notifications(text,text,text,text,int,int), get_notification_stats(), get_notification_filter_options(),
  get_notification(uuid), preview_notification(uuid,text,text,notification_category,notification_audience,uuid[],uuid[],notification_channel[]),
  estimate_audience(notification_audience,uuid[],uuid[]),
  create_notification(text,text,notification_category,notification_audience,notification_channel[],uuid[],uuid[],timestamptz,text,text),
  update_notification(uuid,jsonb), publish_notification(uuid), delete_draft_notification(uuid), archive_notification(uuid),
  list_my_notifications(boolean,int,int), get_my_unread_notification_count(), mark_notification_read(uuid), mark_all_notifications_read()
  to authenticated;
-- ---------- 10. RLS ----------
alter table notifications           enable row level security;
alter table notification_recipients enable row level security;
alter table notification_events     enable row level security;
drop policy if exists notif_admin_select on notifications;
create policy notif_admin_select on notifications for select to authenticated using (is_admin());
drop policy if exists notif_recipient_select on notifications;
create policy notif_recipient_select on notifications for select to authenticated
  using (status = 'published' and exists (select 1 from notification_recipients r
                                           where r.notification_id = notifications.id and r.user_id = auth.uid()));
drop policy if exists nrec_admin_select on notification_recipients;
create policy nrec_admin_select on notification_recipients for select to authenticated using (is_admin());
drop policy if exists nrec_own_select on notification_recipients;
create policy nrec_own_select on notification_recipients for select to authenticated using (user_id = auth.uid());
drop policy if exists nevents_admin_select on notification_events;
create policy nevents_admin_select on notification_events for select to authenticated using (is_admin());
revoke insert, update, delete on notifications, notification_recipients, notification_events from anon, authenticated;
-- Realtime: lets the bell update the moment a notification is published
-- alter publication supabase_realtime add table notification_recipients;
-- =====================================================================
-- Universal Learning – Callback Requests (Supabase / PostgreSQL)
-- Reuses: profiles, is_admin(), set_updated_at(), pg_trgm
-- Re-runnable.
-- =====================================================================
create extension if not exists pg_trgm;
-- ---------- 1. Enums ----------
do $$ begin create type callback_status as enum ('new','contacted','closed');
exception when duplicate_object then null; end $$;
do $$ begin create type callback_source as enum
  ('website_visitor','prospective_institution','prospective_educator','other');
exception when duplicate_object then null; end $$;
do $$ begin create type callback_activity_type as enum ('created','status_changed','note','assigned','repeat_submission');
exception when duplicate_object then null; end $$;
-- ---------- 2. Tables ----------
create sequence if not exists callback_code_seq start 1001;
create table if not exists callback_requests (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique default ('CB-' || nextval('callback_code_seq')),
  name          text not null check (char_length(btrim(name)) between 2 and 120),     -- person or organisation
  phone         text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),                  -- stored normalised: +919845012233
  phone_digits  text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  email         text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  organization  text,
  source        callback_source not null default 'website_visitor',
  message       text not null check (char_length(btrim(message)) between 3 and 1000),
  status        callback_status not null default 'new',
  assigned_to   uuid references profiles(id) on delete set null,
  contacted_at  timestamptz,
  contacted_by  uuid references profiles(id) on delete set null,
  closed_at     timestamptz,
  closed_by     uuid references profiles(id) on delete set null,
  submitted_from text,                                   -- page URL the form was on
  ip_hash       text,                                    -- set by your Edge Function (never store raw IPs)
  user_agent    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- timeline shown in "View": status changes, internal notes, assignment
create table if not exists callback_activity (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references callback_requests(id) on delete cascade,
  type         callback_activity_type not null,
  from_status  callback_status,
  to_status    callback_status,
  note         text,
  actor_id     uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
-- ---------- 3. Indexes ----------
create index if not exists cb_status_idx     on callback_requests (status, created_at desc);
create index if not exists cb_source_idx     on callback_requests (source);
create index if not exists cb_created_idx    on callback_requests (created_at desc);
create index if not exists cb_phone_idx      on callback_requests (phone_digits);
create index if not exists cb_assigned_idx   on callback_requests (assigned_to) where assigned_to is not null;
create index if not exists cb_name_trgm      on callback_requests using gin (name gin_trgm_ops);
create index if not exists cb_email_trgm     on callback_requests using gin (email gin_trgm_ops);
create index if not exists cb_message_trgm   on callback_requests using gin (message gin_trgm_ops);
create index if not exists cb_activity_idx   on callback_activity (request_id, created_at);
drop trigger if exists trg_cb_updated on callback_requests;
create trigger trg_cb_updated before update on callback_requests for each row execute function set_updated_at();
-- ---------- 4. Helpers ----------
-- "98450 12233" / "+91 98450 12233" / "09845012233"  ->  "+919845012233"
create or replace function _normalize_phone(p text) returns text language sql immutable as $$
  with d as (select regexp_replace(coalesce(p,''), '[^0-9+]', '', 'g') as s)
  select case
    when s ~ '^\+[1-9][0-9]{7,14}$'        then s                        -- already international
    when s ~ '^(\+?91)?0?[6-9][0-9]{9}$'   then '+91' || right(regexp_replace(s, '\D', '', 'g'), 10)
    else null end
  from d;
$$;
create or replace function _phone_display(p text) returns text language sql immutable as $$
  select case when p ~ '^\+91[6-9][0-9]{9}$'
              then '+91 ' || substr(p, 4, 5) || ' ' || substr(p, 9, 5) else p end;
$$;
-- ---------- 5. Public form ("captured from the site") ----------
-- Called by the website's callback form (anon). Validation, honeypot, throttling, duplicate merge.
create or replace function submit_callback_request(
  p_name text, p_phone text, p_source callback_source, p_message text,
  p_email text default null, p_organization text default null,
  p_page_url text default null, p_honeypot text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_phone text := _normalize_phone(p_phone); v_id uuid; v_open uuid;
begin
  if coalesce(btrim(p_honeypot),'') <> '' then return gen_random_uuid(); end if;      -- bot: pretend success, store nothing
  if char_length(btrim(coalesce(p_name,''))) < 2 then raise exception 'Please enter your name.'; end if;
  if v_phone is null then raise exception 'Please enter a valid phone number.'; end if;
  if char_length(btrim(coalesce(p_message,''))) < 3 then raise exception 'Please tell us how we can help.'; end if;
  -- same person already waiting? add to their existing request instead of creating a duplicate
  select id into v_open from callback_requests
   where phone = v_phone and status in ('new','contacted') and created_at > now() - interval '7 days'
   order by created_at desc limit 1;
  if v_open is not null then
    insert into callback_activity (request_id, type, note) values (v_open, 'repeat_submission', left(btrim(p_message), 1000));
    return v_open;
  end if;
  if (select count(*) from callback_requests where phone = v_phone and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'We already have your requests. Our team will call you soon.';
  end if;
  insert into callback_requests (name, phone, email, organization, source, message, submitted_from)
  values (btrim(p_name), v_phone, nullif(btrim(p_email),''), nullif(btrim(p_organization),''),
          p_source, btrim(p_message), left(p_page_url, 500))
  returning id into v_id;
  insert into callback_activity (request_id, type, to_status) values (v_id, 'created', 'new');
  return v_id;
end $$;
-- ---------- 6. View ----------
drop view if exists v_callback_requests;
create view v_callback_requests with (security_invoker = true) as
select r.id, r.code, r.name, r.phone, _phone_display(r.phone) as phone_display, r.phone_digits,
       r.email, r.organization, r.source,
       case r.source when 'website_visitor' then 'Website Visitor'
                     when 'prospective_institution' then 'Prospective Institution'
                     when 'prospective_educator' then 'Prospective Educator' else 'Other' end as source_label,
       r.message, r.status, initcap(r.status::text) as status_label,
       r.assigned_to, ap.full_name as assigned_to_name,
       r.contacted_at, r.closed_at, r.created_at, r.updated_at
from callback_requests r
left join profiles ap on ap.id = r.assigned_to;
-- ---------- 7. Read RPCs ----------
-- Cards: Total / New / Contacted / Closed
create or replace function get_callback_stats() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'total',     count(*),                                           -- "Captured from the site"
    'new',       count(*) filter (where status = 'new'),             -- "Not yet contacted"
    'contacted', count(*) filter (where status = 'contacted'),       -- "Follow-up in progress"
    'closed',    count(*) filter (where status = 'closed'),          -- "Resolved leads"
    'avg_first_response_hours',
        round((extract(epoch from avg(contacted_at - created_at) filter (where contacted_at is not null)) / 3600)::numeric, 1))
  from callback_requests;
$$;
-- Table: search + Status + Source filters + pagination
create or replace function list_callback_requests(
  p_search text default null,            -- name, phone, email or message
  p_status text default null,            -- new | contacted | closed | null = all
  p_source text default null,            -- website_visitor | prospective_institution | prospective_educator | other
  p_sort   text default 'newest',        -- newest | oldest | status
  p_page   int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with q as (select btrim(coalesce(p_search,'')) s, regexp_replace(coalesce(p_search,''), '\D', '', 'g') digits),
  f as (
    select v.* from v_callback_requests v, q
    where (q.s = '' or v.name ilike '%'||q.s||'%' or v.email ilike '%'||q.s||'%' or v.message ilike '%'||q.s||'%'
           or v.organization ilike '%'||q.s||'%'
           or (char_length(q.digits) >= 3 and v.phone_digits like '%'||q.digits||'%'))
      and (p_status is null or p_status in ('','all') or v.status::text = p_status)
      and (p_source is null or p_source in ('','all') or v.source::text = p_source)
  )
  select jsonb_build_object(
           'id', f.id, 'code', f.code, 'name', f.name, 'phone', f.phone, 'phone_display', f.phone_display,
           'email', f.email, 'source', f.source, 'source_label', f.source_label, 'message', f.message,
           'status', f.status, 'status_label', f.status_label, 'assigned_to_name', f.assigned_to_name,
           'created_at', f.created_at),
         count(*) over ()
  from f
  order by
    case p_sort when 'oldest' then f.created_at end asc,
    case p_sort when 'status' then (case f.status when 'new' then 1 when 'contacted' then 2 else 3 end) end asc,
    f.created_at desc, f.id
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- "Status: All" and "Source: All" dropdowns (with counts)
create or replace function get_callback_filter_options() returns jsonb
language sql stable security invoker as $$
  select jsonb_build_object(
    'statuses', (select jsonb_agg(jsonb_build_object('key', k, 'label', initcap(k),
                         'count', (select count(*) from callback_requests where status::text = k)))
                   from unnest(array['new','contacted','closed']) k),
    'sources',  (select jsonb_agg(jsonb_build_object('key', k,
                         'label', case k when 'website_visitor' then 'Website Visitor'
                                         when 'prospective_institution' then 'Prospective Institution'
                                         when 'prospective_educator' then 'Prospective Educator' else 'Other' end,
                         'count', (select count(*) from callback_requests where source::text = k)))
                   from unnest(array['website_visitor','prospective_institution','prospective_educator','other']) k));
$$;
-- "View" button
create or replace function get_callback_request(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v v_callback_requests;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into v from v_callback_requests where id = p_id;
  if not found then raise exception 'Callback request not found.'; end if;
  return to_jsonb(v) || jsonb_build_object(
    'submitted_from', (select submitted_from from callback_requests where id = p_id),
    'first_response_minutes', case when v.contacted_at is not null
         then round(extract(epoch from (v.contacted_at - v.created_at)) / 60) end,
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'type', a.type, 'from_status', a.from_status,
               'to_status', a.to_status, 'note', a.note, 'actor', p.full_name, 'at', a.created_at) order by a.created_at desc)
        from callback_activity a left join profiles p on p.id = a.actor_id where a.request_id = p_id), '[]'::jsonb));
end $$;
-- "Export Callback Report"
create or replace function export_callback_report(
  p_search text default null, p_status text default null, p_source text default null,
  p_from date default null, p_to date default null
) returns table (request_id text, name text, phone text, email text, organization text, source text, message text,
                 status text, assigned_to text, received_at timestamptz, contacted_at timestamptz, closed_at timestamptz,
                 first_response_hours numeric)
language sql stable security invoker as $$
  select v.code, v.name, v.phone_display, v.email, v.organization, v.source_label, v.message,
         v.status_label, v.assigned_to_name, v.created_at, v.contacted_at, v.closed_at,
         case when v.contacted_at is not null
              then round((extract(epoch from (v.contacted_at - v.created_at)) / 3600)::numeric, 1) end
  from v_callback_requests v
  where (p_search is null or p_search = '' or v.name ilike '%'||p_search||'%' or v.email ilike '%'||p_search||'%'
         or v.message ilike '%'||p_search||'%'
         or (char_length(regexp_replace(p_search, '\D', '', 'g')) >= 3
             and v.phone_digits like '%'||regexp_replace(p_search, '\D', '', 'g')||'%'))
    and (p_status is null or p_status in ('','all') or v.status::text = p_status)
    and (p_source is null or p_source in ('','all') or v.source::text = p_source)
    and (p_from is null or v.created_at >= p_from) and (p_to is null or v.created_at < p_to + 1)
  order by v.created_at desc;
$$;
-- ---------- 8. Actions inside "View" ----------
-- Mark as New / Contacted / Closed
create or replace function set_callback_status(p_id uuid, p_status callback_status, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r callback_requests;
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  select * into r from callback_requests where id = p_id for update;
  if not found then raise exception 'Callback request not found.'; end if;
  if r.status = p_status then return; end if;
  update callback_requests set
    status       = p_status,
    contacted_at = case when p_status in ('contacted','closed') then coalesce(contacted_at, now()) else contacted_at end,
    contacted_by = case when p_status in ('contacted','closed') then coalesce(contacted_by, auth.uid()) else contacted_by end,
    closed_at    = case when p_status = 'closed' then now() else null end,
    closed_by    = case when p_status = 'closed' then auth.uid() else null end,
    assigned_to  = coalesce(assigned_to, case when p_status <> 'new' then auth.uid() end)
  where id = p_id;
  insert into callback_activity (request_id, type, from_status, to_status, note, actor_id)
  values (p_id, 'status_changed', r.status, p_status, nullif(btrim(p_note),''), auth.uid());
end $$;
create or replace function add_callback_note(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if char_length(btrim(coalesce(p_note,''))) = 0 then raise exception 'Note is empty.'; end if;
  insert into callback_activity (request_id, type, note, actor_id) values (p_id, 'note', btrim(p_note), auth.uid());
  update callback_requests set updated_at = now() where id = p_id;
end $$;
create or replace function assign_callback(p_id uuid, p_admin_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  if p_admin_id is not null and not exists (select 1 from profiles where id = p_admin_id and role::text = 'admin') then
    raise exception 'Assignee must be an admin.'; end if;
  update callback_requests set assigned_to = p_admin_id where id = p_id;
  insert into callback_activity (request_id, type, note, actor_id)
  values (p_id, 'assigned', (select full_name from profiles where id = p_admin_id), auth.uid());
end $$;
-- for the sidebar badge on the Dashboard (replaces the old status='pending' check with 'new')
create or replace function get_new_callback_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from callback_requests where status = 'new' and is_admin();
$$;
-- ---------- 9. Grants ----------
revoke all on function submit_callback_request(text,text,callback_source,text,text,text,text,text) from public;
grant execute on function submit_callback_request(text,text,callback_source,text,text,text,text,text) to anon, authenticated;
revoke execute on function get_callback_request(uuid), set_callback_status(uuid,callback_status,text),
  add_callback_note(uuid,text), assign_callback(uuid,uuid), get_new_callback_count(),
  list_callback_requests(text,text,text,text,int,int), get_callback_stats(), get_callback_filter_options(),
  export_callback_report(text,text,text,date,date) from public, anon;
grant execute on function get_callback_request(uuid), set_callback_status(uuid,callback_status,text),
  add_callback_note(uuid,text), assign_callback(uuid,uuid), get_new_callback_count(),
  list_callback_requests(text,text,text,text,int,int), get_callback_stats(), get_callback_filter_options(),
  export_callback_report(text,text,text,date,date) to authenticated;
-- ---------- 10. RLS ----------
alter table callback_requests enable row level security;
alter table callback_activity enable row level security;
drop policy if exists cb_admin_select on callback_requests;
create policy cb_admin_select on callback_requests for select to authenticated using (is_admin());
drop policy if exists cba_admin_select on callback_activity;
create policy cba_admin_select on callback_activity for select to authenticated using (is_admin());
-- no client writes at all: the public form goes through submit_callback_request(), admins through the RPCs above
revoke all on callback_requests, callback_activity from anon;
revoke insert, update, delete on callback_requests, callback_activity from authenticated;
-- live badge / new-request toasts (optional)
-- alter publication supabase_realtime add table callback_requests;
LOGOUT:
-- =====================================================================
-- Universal Learning – Log out / session tracking / back to Login
-- Reuses: profiles, students, educators (account_status), is_admin(), get_admin_me() (Dashboard schema)
-- Re-runnable.
-- =====================================================================
-- ---------- 1. Enums ----------
do $$ begin create type auth_event_type as enum ('login','logout','logout_all','session_revoked','login_blocked');
exception when duplicate_object then null; end $$;
do $$ begin create type session_end_reason as enum ('logout','logout_all','revoked','expired');
exception when duplicate_object then null; end $$;
-- ---------- 2. Tables ----------
-- One row per signed-in browser/device (session_id = the "session_id" claim in the Supabase JWT)
create table if not exists user_sessions (
  session_id    uuid primary key,
  user_id       uuid not null references profiles(id) on delete cascade,
  role          text,                                   -- snapshot: admin | educator | student
  user_agent    text,
  ip_hash       text,                                   -- hash only, never the raw IP (set by your Edge Function if you want it)
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended_at      timestamptz,
  end_reason    session_end_reason
);
-- Audit trail of sign-ins and sign-outs
create table if not exists auth_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id) on delete set null,
  session_id  uuid,
  event_type  auth_event_type not null,
  role        text,
  user_agent  text,
  ip_hash     text,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists user_sessions_user_idx   on user_sessions (user_id) where ended_at is null;
create index if not exists user_sessions_seen_idx   on user_sessions (last_seen_at desc);
create index if not exists auth_events_user_idx     on auth_events (user_id, created_at desc);
create index if not exists auth_events_type_idx     on auth_events (event_type, created_at desc);
-- ---------- 3. Helpers ----------
create or replace function _current_session_id() returns uuid
language sql stable as $$ select nullif(auth.jwt() ->> 'session_id', '')::uuid $$;
create or replace function _is_account_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from students  where id = p_user and account_status::text in ('blocked','suspended'))
      or exists (select 1 from educators where id = p_user and account_status::text in ('blocked','suspended'));
$$;
revoke all on function _is_account_blocked(uuid) from public, anon, authenticated;
-- ---------- 4. After sign-in: allowed? where should they land? ----------
-- Call right after supabase.auth.signInWithPassword / OTP verify.
-- ok=false  ->  client runs supabase.auth.signOut() and shows the reason on the login page.
create or replace function record_login(p_user_agent text default null, p_ip_hash text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role text; v_sid uuid := _current_session_id();
begin
  if v_uid is null then raise exception 'Not signed in.'; end if;
  select role::text into v_role from profiles where id = v_uid;
  if v_role is null then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;
  if _is_account_blocked(v_uid) then
    insert into auth_events (user_id, session_id, event_type, role, user_agent, ip_hash, meta)
    values (v_uid, v_sid, 'login_blocked', v_role, p_user_agent, p_ip_hash, jsonb_build_object('reason','account_blocked'));
    return jsonb_build_object('ok', false, 'reason', 'account_blocked');
  end if;
  if v_sid is not null then
    insert into user_sessions (session_id, user_id, role, user_agent, ip_hash)
    values (v_sid, v_uid, v_role, left(p_user_agent, 300), p_ip_hash)
    on conflict (session_id) do update set last_seen_at = now();
  end if;
  insert into auth_events (user_id, session_id, event_type, role, user_agent, ip_hash)
  values (v_uid, v_sid, 'login', v_role, left(p_user_agent, 300), p_ip_hash);
  return jsonb_build_object('ok', true, 'role', v_role,
    'redirect_to', case v_role when 'admin' then '/admin' when 'educator' then '/educator' else '/student' end);
end $$;
-- ---------- 5. "Log out" button in the confirmation dialog ----------
-- ORDER MATTERS: call this FIRST (it needs the live token), then supabase.auth.signOut(), then go to /login.
create or replace function record_logout(p_scope text default 'local') returns void       -- 'local' | 'global'
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_sid uuid := _current_session_id(); v_role text;
begin
  if v_uid is null then return; end if;                       -- already signed out: nothing to log, never error
  select role::text into v_role from profiles where id = v_uid;
  if p_scope = 'global' then
    update user_sessions set ended_at = now(), end_reason = 'logout_all' where user_id = v_uid and ended_at is null;
  else
    update user_sessions set ended_at = now(), end_reason = 'logout' where session_id = v_sid and ended_at is null;
  end if;
  insert into auth_events (user_id, session_id, event_type, role, meta)
  values (v_uid, v_sid, case when p_scope = 'global' then 'logout_all' else 'logout' end::auth_event_type,
          v_role, jsonb_build_object('scope', p_scope));
end $$;
-- optional heartbeat (e.g. every 5 min) – gives you "last active" and lets you add an idle timeout later
create or replace function touch_session() returns void
language sql security definer set search_path = public as $$
  update user_sessions set last_seen_at = now()
   where session_id = _current_session_id() and ended_at is null and last_seen_at < now() - interval '1 minute';
$$;
-- ---------- 6. Forced sign-out (blocked / suspended users, "sign out other devices") ----------
create or replace function _revoke_sessions(p_user uuid, p_reason text, p_except uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  -- deleting the Supabase auth session also kills its refresh tokens: the browser is bounced to login at its next refresh
  delete from auth.sessions where user_id = p_user and (p_except is null or id <> p_except);
  get diagnostics n = row_count;
  update user_sessions set ended_at = now(), end_reason = 'revoked'
   where user_id = p_user and ended_at is null and (p_except is null or session_id <> p_except);
  insert into auth_events (user_id, event_type, meta)
  values (p_user, 'session_revoked', jsonb_build_object('reason', p_reason, 'sessions', n));
  return n;
end $$;
revoke all on function _revoke_sessions(uuid, text, uuid) from public, anon, authenticated;
-- admin forces a user out (used by Block / Suspend on the Student & Educator pages)
create or replace function revoke_user_sessions(p_user_id uuid, p_reason text default 'admin_action') returns int
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'forbidden'; end if;
  return _revoke_sessions(p_user_id, p_reason);
end $$;
-- "sign out of all other devices" (keeps the current one)
create or replace function sign_out_other_devices() returns int
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;
  return _revoke_sessions(auth.uid(), 'user_requested', _current_session_id());
end $$;
-- automatic: the moment an account is blocked/suspended, every session of theirs is ended
create or replace function trg_revoke_on_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform _revoke_sessions(new.id, 'account_' || new.account_status::text);
  return new;
end $$;
drop trigger if exists trg_students_block_revoke on students;
create trigger trg_students_block_revoke after update of account_status on students
  for each row when (new.account_status::text in ('blocked','suspended') and old.account_status is distinct from new.account_status)
  execute function trg_revoke_on_block();
drop trigger if exists trg_educators_block_revoke on educators;
create trigger trg_educators_block_revoke after update of account_status on educators
  for each row when (new.account_status::text in ('blocked','suspended') and old.account_status is distinct from new.account_status)
  execute function trg_revoke_on_block();
-- ---------- 7. Reads ----------
-- Footer menu "Admin User / admin@…  ·  Sign out": get_admin_me()  (already in the Dashboard schema)
-- Admin: who signed in/out and when
create or replace function list_auth_events(p_user_id uuid default null, p_event text default null,
                                            p_page int default 1, p_size int default 20)
returns table (row_data jsonb, total_count bigint)
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', e.id, 'user', p.full_name, 'email', p.email, 'role', e.role,
           'event_type', e.event_type, 'user_agent', e.user_agent, 'meta', e.meta, 'at', e.created_at),
         count(*) over ()
  from auth_events e left join profiles p on p.id = e.user_id
  where is_admin()
    and (p_user_id is null or e.user_id = p_user_id)
    and (p_event is null or p_event in ('','all') or e.event_type::text = p_event)
  order by e.created_at desc
  limit greatest(p_size,1) offset (greatest(p_page,1)-1) * greatest(p_size,1);
$$;
-- housekeeping
create or replace function purge_old_auth_events() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from auth_events where created_at < now() - interval '180 days';
  get diagnostics n = row_count;
  delete from user_sessions where ended_at < now() - interval '90 days';
  return n;
end $$;
-- select cron.schedule('purge-auth-events', '15 3 * * *', $$select purge_old_auth_events()$$);
-- ---------- 8. Grants ----------
revoke execute on function record_login(text,text), record_logout(text), touch_session(),
  revoke_user_sessions(uuid,text), sign_out_other_devices(), list_auth_events(uuid,text,int,int),
  purge_old_auth_events() from public, anon;
grant execute on function record_login(text,text), record_logout(text), touch_session(),
  sign_out_other_devices() to authenticated;
grant execute on function revoke_user_sessions(uuid,text), list_auth_events(uuid,text,int,int) to authenticated;  -- admin-checked inside
revoke execute on function purge_old_auth_events() from authenticated;
-- ---------- 9. RLS ----------
alter table user_sessions enable row level security;
alter table auth_events   enable row level security;
drop policy if exists user_sessions_own_or_admin on user_sessions;
create policy user_sessions_own_or_admin on user_sessions for select to authenticated
  using (user_id = auth.uid() or is_admin());
drop policy if exists auth_events_own_or_admin on auth_events;
create policy auth_events_own_or_admin on auth_events for select to authenticated
  using (user_id = auth.uid() or is_admin());
revoke insert, update, delete on user_sessions, auth_events from anon, authenticated;   -- written only by the functions above
