-- =====================================================================
-- 20261107090000_student_notifications.sql
--
-- Purpose (QA, 07 Nov: "Student not notified when an admin resolves a
-- CMS-reported issue")
--   set_moderation_status (20261027100300) already writes one row to the
--   lead's notifications table when an admin resolves a student's report
--   (category 'support_ticket', reference_type 'test_feedback', action_url
--   '/student/test-series/<series id>'). The student portal never read that
--   table: its Notifications page was sample data. These three RPCs give the
--   student portal a real inbox (the bell badge, the Notifications page and
--   the "your report was resolved" popup on the dashboard):
--
--     student_list_notifications(p_unread_only boolean default false,
--                                p_limit int default 30) -> jsonb
--       {rows: [{id, category, title, body, action_url, reference_type,
--                reference_id, is_read, read_at, created_at}], unread: n}
--       The caller's own rows only, newest first; p_limit 1..100.
--       action_url is returned only when it is a /student/ path (else null).
--     student_mark_notification_read(p_id uuid) -> int   (rows changed: 0 / 1)
--     student_mark_all_notifications_read() -> int       (rows changed)
--
--   All three take the caller from adm_student_uid() (20261102090000), so a
--   blocked student is refused like every other student RPC. They read and
--   update only the caller's own rows (user_id = the caller) and only the
--   is_read / read_at columns, the same columns mark_notification_read
--   (20261025120400) already updates.
--
-- Lead objects
--   notifications: select (own rows), update is_read / read_at (own rows).
--   No table, column, constraint, trigger, RLS or policy change.
--
-- ROLLBACK
--   scripts/rollback_20261107090000_student_notifications.sql
-- =====================================================================
set search_path = public, extensions;

-- --------------------------------------------------------------- preflight
do $pre$
declare
  v_problems text[] := '{}';
  v_sig      text;
  v_col      text;
begin
  if to_regprocedure('public.adm_student_uid()') is null then
    v_problems := v_problems || 'missing public.adm_student_uid() (apply 20261102090000 first)'::text;
  end if;
  foreach v_sig in array array['student_list_notifications', 'student_mark_notification_read', 'student_mark_all_notifications_read'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = v_sig) then
      v_problems := v_problems || format('function public.%s already exists', v_sig);
    end if;
  end loop;
  if to_regclass('public.notifications') is null then
    v_problems := v_problems || 'missing public.notifications'::text;
  else
    foreach v_col in array array['id', 'user_id', 'category', 'title', 'body', 'action_url', 'reference_type',
                                 'reference_id', 'is_read', 'read_at', 'created_at'] loop
      if not exists (select 1 from information_schema.columns
                      where table_schema = 'public' and table_name = 'notifications' and column_name = v_col) then
        v_problems := v_problems || format('notifications.%s is missing', v_col);
      end if;
    end loop;
  end if;
  if cardinality(v_problems) > 0 then
    raise exception 'Student notifications preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- ---------------------------------------------------------------- the RPCs
create or replace function public.student_list_notifications(
  p_unread_only boolean default false, p_limit int default 30
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := public.adm_student_uid();
  v_limit int := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_rows  jsonb;
  v_unread int;
begin
  select coalesce(jsonb_agg(x.j order by x.created_at desc, x.id), '[]'::jsonb) into v_rows
    from (
      select n.created_at, n.id,
             jsonb_build_object(
               'id', n.id, 'category', n.category, 'title', n.title, 'body', n.body,
               'action_url', case when n.action_url like '/student/%' then n.action_url end,
               'reference_type', n.reference_type, 'reference_id', n.reference_id,
               'is_read', coalesce(n.is_read, false), 'read_at', n.read_at, 'created_at', n.created_at) as j
        from public.notifications n
       where n.user_id = v_uid
         and (not coalesce(p_unread_only, false) or not coalesce(n.is_read, false))
       order by n.created_at desc, n.id
       limit v_limit
    ) x;
  select count(*) into v_unread
    from public.notifications n
   where n.user_id = v_uid and not coalesce(n.is_read, false);
  return jsonb_build_object('rows', v_rows, 'unread', v_unread);
end $$;

create or replace function public.student_mark_notification_read(p_id uuid) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := public.adm_student_uid();
  v_n   int;
begin
  update public.notifications
     set is_read = true, read_at = now()
   where id = p_id and user_id = v_uid and not coalesce(is_read, false);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.student_mark_all_notifications_read() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := public.adm_student_uid();
  v_n   int;
begin
  update public.notifications
     set is_read = true, read_at = now()
   where user_id = v_uid and not coalesce(is_read, false);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.student_list_notifications(boolean, int) from public, anon;
revoke all on function public.student_mark_notification_read(uuid) from public, anon;
revoke all on function public.student_mark_all_notifications_read() from public, anon;
grant execute on function public.student_list_notifications(boolean, int) to authenticated;
grant execute on function public.student_mark_notification_read(uuid) to authenticated;
grant execute on function public.student_mark_all_notifications_read() to authenticated;
