set search_path = public, extensions;
set check_function_bodies = off;
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
-- optional heartbeat (e.g. every 5 min) â€“ gives you "last active" and lets you add an idle timeout later
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
-- Footer menu "Admin User / admin@â€¦  Â·  Sign out": get_admin_me()  (already in the Dashboard schema)
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



