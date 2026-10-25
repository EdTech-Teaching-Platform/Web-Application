set search_path = public, extensions;
set check_function_bodies = off;
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
-- =====================================================================
-- Universal Learning â€“ Log out / session tracking / back to Login
-- Reuses: profiles, students, educators (account_status), is_admin(), get_admin_me() (Dashboard schema)
-- Re-runnable.
-- =====================================================================


