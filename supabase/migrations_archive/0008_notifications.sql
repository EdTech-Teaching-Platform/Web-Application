set search_path = public, extensions;
set check_function_bodies = off;
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
  recipients_total   int not null default 0,          -- "Delivered 1811 / 1842" â†’ denominator
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
    when 'scheduled' then to_char(n.scheduled_for at time zone 'UTC', 'Mon DD, YYYY Â· HH24:MI "UTC"')
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
-- "Create notification" â†’ Save as draft | Schedule | Publish now
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
-- Universal Learning â€“ Callback Requests (Supabase / PostgreSQL)
-- Reuses: profiles, is_admin(), set_updated_at(), pg_trgm
-- Re-runnable.
-- =====================================================================
create extension if not exists pg_trgm;



