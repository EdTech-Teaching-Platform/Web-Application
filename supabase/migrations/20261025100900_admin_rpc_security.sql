-- =====================================================================
-- 20261025100900_admin_rpc_security.sql
--
-- Purpose
--   Security Center and Audit Logs RPCs (securityApi.js):
--     list_active_sessions()                          (replaces a direct user_sessions read, D4)
--     revoke_user_sessions(p_user_id, p_reason)       DB part; Batch 4 Edge Function revokes tokens
--     sign_out_other_devices()                        DB part
--     list_auth_events(p_user_id, p_event, p_page, p_size)
--
-- Lead objects read
--   profiles. The auth schema is never read or written (D6).
--
-- Assumptions
--   * These RPCs only mark user_sessions rows as ended and record events in
--     admin_auth_events. Real refresh-token revocation happens in the
--     revoke-user-sessions Edge Function through the Admin API (Batch 4).
--
-- ROLLBACK
--   drop function if exists public.list_auth_events(uuid, text, int, int);
--   drop function if exists public.sign_out_other_devices();
--   drop function if exists public.revoke_user_sessions(uuid, text);
--   drop function if exists public.list_active_sessions();
-- =====================================================================
set search_path = public, extensions;

-- [{session_id, user_id, user_name, email, role, user_agent, started_at, last_seen_at, ended_at, end_reason, is_current}]
create or replace function public.list_active_sessions() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_sid uuid := public.adm_current_session_id();
begin
  perform public.adm_require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'session_id', s.session_id, 'user_id', s.user_id, 'user_name', p.full_name, 'email', p.email,
             'role', s.role, 'user_agent', s.user_agent, 'started_at', s.started_at,
             'last_seen_at', s.last_seen_at, 'ended_at', s.ended_at, 'end_reason', s.end_reason,
             'is_current', s.session_id = v_sid)
           order by s.last_seen_at desc)
      from (select * from public.user_sessions where ended_at is null order by last_seen_at desc limit 200) s
      left join public.profiles p on p.id = s.user_id), '[]'::jsonb);
end $$;

create or replace function public.revoke_user_sessions(p_user_id uuid, p_reason text default 'admin_action') returns int
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  perform public.adm_require_admin();
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;
  n := public.adm_end_user_sessions(p_user_id, coalesce(nullif(btrim(p_reason), ''), 'admin_action'));
  perform public.adm_audit('auth.sessions_revoked', 'user', p_user_id, null,
                           jsonb_build_object('sessions', n), p_reason);
  return n;
end $$;

create or replace function public.sign_out_other_devices() returns int
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return public.adm_end_user_sessions(auth.uid(), 'user_requested', public.adm_current_session_id());
end $$;

-- Rows: {id, user, email, role, event_type, user_agent, meta, at}
create or replace function public.list_auth_events(
  p_user_id uuid default null, p_event text default null, p_page int default 1, p_size int default 20
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_size int := least(greatest(coalesce(p_size, 20), 1), 100);
  v_page int := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  select jsonb_build_object('id', e.id, 'user', p.full_name, 'email', p.email, 'role', e.role,
                            'event_type', e.event_type, 'user_agent', e.user_agent, 'meta', e.meta,
                            'at', e.created_at),
         count(*) over ()
    from public.admin_auth_events e
    left join public.profiles p on p.id = e.user_id
   where (p_user_id is null or e.user_id = p_user_id)
     and (p_event is null or p_event in ('', 'all') or e.event_type = p_event)
   order by e.created_at desc, e.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

revoke all on function public.list_active_sessions() from public, anon;
revoke all on function public.revoke_user_sessions(uuid, text) from public, anon;
revoke all on function public.sign_out_other_devices() from public, anon;
revoke all on function public.list_auth_events(uuid, text, int, int) from public, anon;

grant execute on function public.list_active_sessions() to authenticated;
grant execute on function public.revoke_user_sessions(uuid, text) to authenticated;
grant execute on function public.sign_out_other_devices() to authenticated;
grant execute on function public.list_auth_events(uuid, text, int, int) to authenticated;
