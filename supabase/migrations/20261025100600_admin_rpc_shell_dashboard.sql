-- =====================================================================
-- 20261025100600_admin_rpc_shell_dashboard.sql
--
-- Purpose
--   RPCs behind the admin login, sidebar, top bar, notepad and dashboard.
--   Names, parameters and JSON keys match src/portals/admin/services/adminApi.js,
--   AdminLogin.jsx, AuthContext.jsx, AdminSidebar.jsx, AdminTopbar.jsx and
--   LoginDashboard.jsx. Revenue is stubbed with zeros (D1).
--
-- Lead objects read
--   profiles, student_profiles, educator_profiles, test_series, quizzes,
--   quiz_attempts, institutions, callback_requests, moderation_reports,
--   platform_settings. Nothing on lead tables is written here.
--
-- Assumptions
--   * "Published series" = test_series.is_published and is_active. Batch 2's
--     soft delete must also set test_series.is_active = false so search and
--     counts here stay correct without replacing these functions.
--   * test_assignments (Batch 2) is looked up at run time; until it exists the
--     approvals card and badge are empty.
--   * Fixes from the doc appendix: callbacks badge counts status 'new' (not
--     'pending'); moderation counts the lead's moderation_reports; approvals use
--     test_assignments.deadline (not due_date).
--
-- ROLLBACK
--   drop function if exists public.get_admin_dashboard(int);
--   drop function if exists public.get_students_by_region(int);
--   drop function if exists public.get_top_series(int, int);
--   drop function if exists public.get_series_approvals(int);
--   drop function if exists public.get_pending_educator_verifications(int);
--   drop function if exists public.get_dashboard_revenue(int, text);
--   drop function if exists public.get_dashboard_stats();
--   drop function if exists public.adm_stat_card(text);
--   drop function if exists public.adm_cumulative_counts(text, int);
--   drop function if exists public.get_dashboard_header();
--   drop function if exists public.clear_done_notes();
--   drop function if exists public.delete_admin_note(uuid);
--   drop function if exists public.update_admin_note(uuid, text);
--   drop function if exists public.toggle_admin_note(uuid, boolean);
--   drop function if exists public.add_admin_note(text);
--   drop function if exists public.list_my_notes();
--   drop function if exists public.global_search(text, int);
--   drop function if exists public.get_admin_nav();
--   drop function if exists public.touch_session();
--   drop function if exists public.record_logout(text);
--   drop function if exists public.record_login(text, text);
--   drop function if exists public.get_admin_me();
-- =====================================================================
set search_path = public, extensions;

-- =============================================================== session
create or replace function public.get_admin_me() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public.adm_require_admin();
  select jsonb_build_object(
           'id', p.id, 'name', p.full_name, 'email', p.email, 'avatar_url', p.avatar_url,
           'initials', public.adm_initials(p.full_name),
           'role', case p.role when 'super_admin' then 'Super Admin' else 'Admin' end,
           'role_key', p.role)
    into r
    from public.profiles p where p.id = auth.uid();
  return r;
end $$;

-- Called by AdminLogin.jsx right after signInWithPassword.
create or replace function public.record_login(p_user_agent text default null, p_ip_hash text default null)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_sid  uuid := public.adm_current_session_id();
  v_role text;
begin
  perform public.adm_require_admin();
  select role into v_role from public.profiles where id = v_uid;

  if public.adm_is_account_blocked(v_uid) then
    insert into public.admin_auth_events (user_id, session_id, event_type, role, user_agent, ip_hash, meta)
    values (v_uid, v_sid, 'login_blocked', v_role, left(p_user_agent, 300), p_ip_hash,
            jsonb_build_object('reason', 'account_blocked'));
    return jsonb_build_object('ok', false, 'reason', 'account_blocked');
  end if;

  if v_sid is not null then
    insert into public.user_sessions (session_id, user_id, role, user_agent, ip_hash)
    values (v_sid, v_uid, v_role, left(p_user_agent, 300), p_ip_hash)
    on conflict (session_id) do update set last_seen_at = now();
  end if;

  insert into public.admin_auth_events (user_id, session_id, event_type, role, user_agent, ip_hash)
  values (v_uid, v_sid, 'login', v_role, left(p_user_agent, 300), p_ip_hash);

  return jsonb_build_object('ok', true, 'role', v_role, 'redirect_to', '/admin/logindashboard');
end $$;

-- Called by AuthContext.logout() for EVERY role before signOut(), so it must
-- never fail for students or educators. Events are recorded for admins only.
create or replace function public.record_logout(p_scope text default 'local') returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid  uuid := auth.uid();
  v_sid  uuid := public.adm_current_session_id();
  v_role text;
  v_global boolean := coalesce(p_scope, 'local') = 'global';
begin
  if v_uid is null then return; end if;

  if v_global then
    update public.user_sessions set ended_at = now(), end_reason = 'logout_all'
     where user_id = v_uid and ended_at is null;
  elsif v_sid is not null then
    update public.user_sessions set ended_at = now(), end_reason = 'logout'
     where session_id = v_sid and ended_at is null;
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role in ('admin', 'super_admin') then
    insert into public.admin_auth_events (user_id, session_id, event_type, role, meta)
    values (v_uid, v_sid, case when v_global then 'logout_all' else 'logout' end, v_role,
            jsonb_build_object('scope', coalesce(p_scope, 'local')));
  end if;
end $$;

-- Heartbeat from AdminLogin.jsx (every 5 minutes while signed in).
create or replace function public.touch_session() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_sid uuid := public.adm_current_session_id();
begin
  perform public.adm_require_admin();
  if v_sid is null then return; end if;
  insert into public.user_sessions as us (session_id, user_id, role)
  values (v_sid, auth.uid(), public.adm_actor_role())
  on conflict (session_id) do update set last_seen_at = now()
   where us.ended_at is null
     and us.last_seen_at < now() - interval '1 minute';
end $$;

-- ================================================================ shell
-- Sidebar: [{key, section, label, route, icon, badge}] (AdminSidebar matches by route).
create or replace function public.get_admin_nav() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_series int := 0;
  v_counts jsonb;
begin
  perform public.adm_require_admin();
  if to_regclass('public.test_assignments') is not null then
    execute $q$select count(*)::int from public.test_assignments
               where status not in ('approved', 'completed', 'cancelled', 'rejected')$q$ into v_series;
  end if;
  v_counts := jsonb_build_object(
    'educator_verifications', (select count(*) from public.educator_profiles ep
                                 join public.profiles p on p.id = ep.user_id and p.role = 'educator'
                                 left join public.educator_admin_state st on st.user_id = ep.user_id
                                where ep.verification_status = 'pending'
                                  and coalesce(st.account_status, 'active') <> 'deleted'),
    'series_approvals', v_series,
    'refunds', 0,                                                                  -- STUB: needs payments model (F4)
    'callbacks', (select count(*) from public.callback_requests where status = 'new'),
    'moderation', (select count(*) from public.moderation_reports where status = 'pending'));
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'key', n.key, 'section', n.section, 'label', n.label, 'route', n.route, 'icon', n.icon,
             'badge', nullif((v_counts ->> n.badge_key)::int, 0)) order by n.sort_order)
      from public.admin_nav_items n where n.is_active), '[]'::jsonb);
end $$;

-- Top bar search: {students:[], educators:[], series:[]} of {id, label, sublabel}.
create or replace function public.global_search(p_q text, p_limit int default 5) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like  text := public.adm_like(p_q);
  v_limit int  := least(greatest(coalesce(p_limit, 5), 1), 20);
begin
  perform public.adm_require_admin();
  if v_like is null or char_length(btrim(p_q)) < 2 then
    return jsonb_build_object('students', '[]'::jsonb, 'educators', '[]'::jsonb, 'series', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.full_name, 'sublabel', x.email))
                            from (select p.id, p.full_name, p.email from public.profiles p
                                   where p.role = 'student' and (p.full_name ilike v_like or p.email ilike v_like)
                                   order by p.full_name limit v_limit) x), '[]'::jsonb),
    'educators', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.full_name, 'sublabel', x.email))
                             from (select p.id, p.full_name, p.email from public.profiles p
                                     left join public.educator_admin_state st on st.user_id = p.id
                                    where p.role = 'educator' and coalesce(st.account_status, 'active') <> 'deleted'
                                      and (p.full_name ilike v_like or p.email ilike v_like)
                                    order by p.full_name limit v_limit) x), '[]'::jsonb),
    'series', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'label', x.title,
                                 'sublabel', case when x.is_published then 'published' else 'draft' end))
                          from (select t.id, t.title, t.is_published from public.test_series t
                                 where t.is_active and t.title ilike v_like
                                 order by t.title limit v_limit) x), '[]'::jsonb));
end $$;

-- ============================================================== notepad
create or replace function public.list_my_notes() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'text', n.text, 'is_done', n.is_done,
                                                       'created_at', n.created_at) order by n.created_at)
                     from public.admin_notes n where n.admin_id = auth.uid()), '[]'::jsonb);
end $$;

create or replace function public.add_admin_note(p_text text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  perform public.adm_require_admin();
  if nullif(btrim(coalesce(p_text, '')), '') is null then
    raise exception 'Note is empty.' using errcode = '22023';
  end if;
  if (select count(*) from public.admin_notes where admin_id = auth.uid()) >= 100 then
    raise exception 'Notepad is full (100 notes). Clear some completed notes first.' using errcode = '54000';
  end if;
  insert into public.admin_notes (admin_id, text) values (auth.uid(), left(btrim(p_text), 500)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.toggle_admin_note(p_id uuid, p_done boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.admin_notes
     set is_done = coalesce(p_done, false), done_at = case when p_done then now() end
   where id = p_id and admin_id = auth.uid();
end $$;

create or replace function public.update_admin_note(p_id uuid, p_text text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  if nullif(btrim(coalesce(p_text, '')), '') is null then
    raise exception 'Note is empty.' using errcode = '22023';
  end if;
  update public.admin_notes set text = left(btrim(p_text), 500) where id = p_id and admin_id = auth.uid();
end $$;

create or replace function public.delete_admin_note(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  delete from public.admin_notes where id = p_id and admin_id = auth.uid();
end $$;

create or replace function public.clear_done_notes() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform public.adm_require_admin();
  delete from public.admin_notes where admin_id = auth.uid() and is_done;
  get diagnostics n = row_count;
  return n;
end $$;

-- ============================================================ dashboard
create or replace function public.get_dashboard_header() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public.adm_require_admin();
  select jsonb_build_object(
           'name', coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Admin'),
           'today', (now() at time zone 'Asia/Kolkata')::date,
           'quote', (select s.value #>> '{}' from public.platform_settings s where s.key = 'dashboard_quote'))
    into r
    from public.profiles p where p.id = auth.uid();
  return r;
end $$;

-- Running totals per day for the stat-card sparklines.
create or replace function public.adm_cumulative_counts(p_kind text, p_days int default 31)
returns table (day date, total bigint)
language sql stable security definer set search_path = public, extensions as $$
  with src as (
    select p.created_at as ts from public.profiles p where p_kind = 'students'  and p.role = 'student'
    union all
    select p.created_at        from public.profiles p where p_kind = 'educators' and p.role = 'educator'
    union all
    select t.created_at        from public.test_series t where p_kind = 'series' and t.is_published and t.is_active
  ), days as (
    select gs::date as d
      from generate_series(((now() at time zone 'Asia/Kolkata')::date - (greatest(p_days, 1) - 1))::timestamp,
                           (now() at time zone 'Asia/Kolkata')::date::timestamp, interval '1 day') gs
  )
  select days.d, (select count(*) from src where (src.ts at time zone 'Asia/Kolkata')::date <= days.d)
    from days order by days.d;
$$;

create or replace function public.adm_stat_card(p_kind text) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with s as (select * from public.adm_cumulative_counts(p_kind, 31)),
       f as (select total from s order by day asc  limit 1),
       l as (select total from s order by day desc limit 1)
  select jsonb_build_object(
    'total',      (select total from l),
    'previous',   (select total from f),
    'growth_pct', (select case when f.total > 0 then round((l.total - f.total)::numeric / f.total * 100) end from f, l),
    'sparkline',  (select jsonb_agg(total order by day) from s));
$$;

create or replace function public.get_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object('students', public.adm_stat_card('students'),
                            'educators', public.adm_stat_card('educators'),
                            'test_series', public.adm_stat_card('series'));
end $$;

-- STUB: needs payments model (F4). No payments table exists (D1). Same keys as the archived RPC,
-- zero-valued buckets so the chart renders.
create or replace function public.get_dashboard_revenue(p_days int default 60, p_granularity text default 'week')
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  g      text := case when p_granularity in ('day', 'week', 'month') then p_granularity else 'week' end;
  v_to   date := (now() at time zone 'Asia/Kolkata')::date;
  v_from date := v_to - (greatest(coalesce(p_days, 60), 1) - 1);
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'total_inr', 0, 'previous_inr', 0, 'change_pct', null::numeric,
    'series', coalesce((select jsonb_agg(jsonb_build_object('bucket', gs::date, 'revenue_inr', 0) order by gs)
                          from generate_series(date_trunc(g, v_from::timestamp), v_to::timestamp, ('1 ' || g)::interval) gs),
                       '[]'::jsonb));
end $$;

-- Educator Verifications card: {total_pending, items:[{id,name,initials,submitted_at,submitted_label}]}
create or replace function public.get_pending_educator_verifications(p_limit int default 3) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with pending as (
      select ep.user_id as id, coalesce(ep.full_name, p.full_name) as full_name,
             coalesce(ep.created_at, p.created_at) as submitted_at
        from public.educator_profiles ep
        join public.profiles p on p.id = ep.user_id and p.role = 'educator'
        left join public.educator_admin_state st on st.user_id = ep.user_id
       where ep.verification_status = 'pending' and coalesce(st.account_status, 'active') <> 'deleted'
    )
    select jsonb_build_object(
      'total_pending', (select count(*) from pending),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', x.id, 'name', x.full_name, 'initials', public.adm_initials(x.full_name),
                 'submitted_at', x.submitted_at,
                 'submitted_label', 'Submitted ' || to_char(x.submitted_at at time zone 'Asia/Kolkata', 'Mon FMDD'))
               order by x.submitted_at desc)
          from (select * from pending order by submitted_at desc
                 limit least(greatest(coalesce(p_limit, 3), 1), 50)) x), '[]'::jsonb)));
end $$;

-- Test Series Approvals card. LoginDashboard.jsx reads seriesName / testName /
-- educatorName / status / is_overdue, so those camelCase keys are included next
-- to the archived snake_case ones.
create or replace function public.get_series_approvals(p_limit int default 3) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public.adm_require_admin();
  if to_regclass('public.test_assignments') is null then
    return jsonb_build_object('total_pending', 0, 'total_overdue', 0, 'items', '[]'::jsonb);
  end if;
  execute $q$
    with open_rows as (
      select a.id, a.series_id, s.title, a.test_name, ep.full_name as educator_name, a.status::text as status,
             a.deadline, (a.deadline is not null and a.deadline < current_date) as is_overdue
        from public.test_assignments a
        join public.test_series s on s.id = a.series_id
        left join public.profiles ep on ep.id = a.educator_id
       where a.status::text not in ('approved', 'completed', 'cancelled', 'rejected')
    )
    select jsonb_build_object(
      'total_pending', (select count(*) from open_rows),
      'total_overdue', (select count(*) from open_rows where is_overdue),
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', x.id, 'series_id', x.series_id, 'title', x.title, 'educator_name', x.educator_name,
                 'status', x.status, 'deadline', x.deadline, 'is_overdue', x.is_overdue,
                 'seriesName', x.title, 'testName', x.test_name, 'educatorName', x.educator_name)
               order by x.is_overdue desc, x.deadline nulls last)
          from (select * from open_rows order by is_overdue desc, deadline nulls last limit $1) x), '[]'::jsonb))
  $q$ into r using least(greatest(coalesce(p_limit, 3), 1), 50);
  return r;
end $$;

-- Top Performing Test Series: [{id, title, avg_score, attempts}]
create or replace function public.get_top_series(p_limit int default 4, p_min_attempts int default 1) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.avg_score desc, x.attempts desc)
      from (select s.id, s.title, round(avg(a.percentage), 1) as avg_score, count(*) as attempts
              from public.test_series s
              join public.quizzes q on q.series_id = s.id
              join public.quiz_attempts a on a.quiz_id = q.id and a.status = 'submitted' and a.percentage is not null
             where s.is_published and s.is_active
             group by s.id, s.title
            having count(*) >= greatest(coalesce(p_min_attempts, 1), 1)
             order by avg(a.percentage) desc, count(*) desc
             limit least(greatest(coalesce(p_limit, 4), 1), 50)) x), '[]'::jsonb);
end $$;

-- Students by Region: {total_students, regions_count, legend, regions:[{id,state_code,name,students,bucket}]}
-- Source: user_geo.state_code, else the linked institution's state_code.
create or replace function public.get_students_by_region(p_limit int default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    with s as (
      select coalesce(g.state_code, i.state_code) as sc
        from public.profiles p
        left join public.user_geo g on g.user_id = p.id
        left join public.institutions i on i.id = g.institution_id
       where p.role = 'student'
    ), c as (
      select sc, count(*) as n from s where sc is not null group by sc
    )
    select jsonb_build_object(
      'total_students', (select coalesce(sum(n), 0) from c),
      'regions_count',  (select count(*) from c),
      'legend', jsonb_build_array('2000+', '500-2000', '100-500', '<100'),
      'regions', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', x.sc, 'state_code', x.sc, 'name', x.name, 'students', x.n,
                 'bucket', case when x.n >= 2000 then '2000+' when x.n >= 500 then '500-2000'
                                when x.n >= 100 then '100-500' else '<100' end) order by x.n desc, x.name)
          from (select c.sc, rg.name, c.n from c join public.regions rg on rg.code = c.sc
                 order by c.n desc, rg.name limit least(greatest(coalesce(p_limit, 1000), 1), 1000)) x), '[]'::jsonb)));
end $$;

-- One call for the whole dashboard page.
create or replace function public.get_admin_dashboard(p_revenue_days int default 60) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'header',                 public.get_dashboard_header(),
    'stats',                  public.get_dashboard_stats(),
    'revenue',                public.get_dashboard_revenue(p_revenue_days),
    'educator_verifications', public.get_pending_educator_verifications(3),
    'series_approvals',       public.get_series_approvals(3),
    'top_series',             public.get_top_series(4),
    'students_by_region',     public.get_students_by_region(6));
end $$;

-- ================================================================ grants
revoke all on function public.adm_cumulative_counts(text, int) from public, anon, authenticated;
revoke all on function public.adm_stat_card(text) from public, anon, authenticated;

revoke all on function public.get_admin_me() from public, anon;
revoke all on function public.record_login(text, text) from public, anon;
revoke all on function public.record_logout(text) from public, anon;
revoke all on function public.touch_session() from public, anon;
revoke all on function public.get_admin_nav() from public, anon;
revoke all on function public.global_search(text, int) from public, anon;
revoke all on function public.list_my_notes() from public, anon;
revoke all on function public.add_admin_note(text) from public, anon;
revoke all on function public.toggle_admin_note(uuid, boolean) from public, anon;
revoke all on function public.update_admin_note(uuid, text) from public, anon;
revoke all on function public.delete_admin_note(uuid) from public, anon;
revoke all on function public.clear_done_notes() from public, anon;
revoke all on function public.get_dashboard_header() from public, anon;
revoke all on function public.get_dashboard_stats() from public, anon;
revoke all on function public.get_dashboard_revenue(int, text) from public, anon;
revoke all on function public.get_pending_educator_verifications(int) from public, anon;
revoke all on function public.get_series_approvals(int) from public, anon;
revoke all on function public.get_top_series(int, int) from public, anon;
revoke all on function public.get_students_by_region(int) from public, anon;
revoke all on function public.get_admin_dashboard(int) from public, anon;

grant execute on function public.get_admin_me() to authenticated;
grant execute on function public.record_login(text, text) to authenticated;
grant execute on function public.record_logout(text) to authenticated;
grant execute on function public.touch_session() to authenticated;
grant execute on function public.get_admin_nav() to authenticated;
grant execute on function public.global_search(text, int) to authenticated;
grant execute on function public.list_my_notes() to authenticated;
grant execute on function public.add_admin_note(text) to authenticated;
grant execute on function public.toggle_admin_note(uuid, boolean) to authenticated;
grant execute on function public.update_admin_note(uuid, text) to authenticated;
grant execute on function public.delete_admin_note(uuid) to authenticated;
grant execute on function public.clear_done_notes() to authenticated;
grant execute on function public.get_dashboard_header() to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;
grant execute on function public.get_dashboard_revenue(int, text) to authenticated;
grant execute on function public.get_pending_educator_verifications(int) to authenticated;
grant execute on function public.get_series_approvals(int) to authenticated;
grant execute on function public.get_top_series(int, int) to authenticated;
grant execute on function public.get_students_by_region(int) to authenticated;
grant execute on function public.get_admin_dashboard(int) to authenticated;
