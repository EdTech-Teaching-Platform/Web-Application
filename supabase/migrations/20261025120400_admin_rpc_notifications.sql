-- =====================================================================
-- 20261025120400_admin_rpc_notifications.sql
--
-- Purpose
--   Publish Notifications (D10). Campaigns live in notification_campaigns; on
--   publish each recipient gets one inbox row in the lead's notifications
--   table (reference_type = 'notification_campaign', reference_id = campaign
--   id) and one delivery row in notification_recipients. RPCs, as called by
--   notificationsApi.js / NotificationsPanel.jsx / AdminTopbar.jsx:
--     list_notifications, get_notification_stats, get_notification_filter_options,
--     get_notification, preview_notification, estimate_audience,
--     create_notification, publish_notification, archive_notification,
--     delete_draft_notification,
--     mark_notification_read(p_id = campaign id), mark_all_notifications_read,
--     get_my_unread_notification_count
--   plus, for cron / the email Edge Function only (postgres / service_role):
--     dispatch_due_notifications(), record_email_results(p_notification_id, p_results)
--
-- Lead objects read
--   profiles, notification_preferences, students / educator_admin_state (our tables, for active users),
--   adm_series_students (test_series, enrollments, admin_series_enrollments).
-- Lead objects written (runtime, through these RPCs only)
--   notifications: insert (fan-out); update is_read / read_at of the caller's
--   own campaign rows (bell).
--
-- Category mapping (F6, D10): announcement -> announcement;
--   system, policy, alert -> system. The campaign keeps its own category.
--
-- Assumptions
--   * Audiences: learners = students not blocked; educators = educators whose
--     admin account_status is active; admins = admin + super_admin;
--     series_enrolled = adm_series_students; selected_users = existing profiles.
--   * The lead's notification_preferences (user_id, category, in_app, email)
--     are honoured at fan-out: 'announcement' in-app delivery skips users with
--     in_app = false; 'system' notices (system / policy / alert) are always
--     delivered in-app; email follows the email column for both. A missing
--     row means the defaults (true). send-notification-emails re-checks email
--     at send time.
--   * "Opened" = the lead's notifications.is_read on the campaign's rows.
--   * The admin bell lists campaigns (list_notifications) with the caller's
--     own read_at; mark_all_notifications_read only touches campaign rows.
--   * Archiving a campaign hides it from the admin list and the bell count;
--     recipients' inbox rows stay (the lead owns the inbox).
--   * Scheduled campaigns are sent by dispatch_due_notifications(), run every
--     minute by the cron file (20261025120700).
--
-- ROLLBACK
--   drop function if exists public.record_email_results(uuid, jsonb), public.dispatch_due_notifications(),
--     public.get_my_unread_notification_count(), public.mark_all_notifications_read(),
--     public.mark_notification_read(uuid), public.delete_draft_notification(uuid),
--     public.archive_notification(uuid), public.publish_notification(uuid),
--     public.create_notification(text, text, text, text, text[], uuid[], uuid[], timestamptz, text, text),
--     public.estimate_audience(text, uuid[], uuid[]),
--     public.preview_notification(uuid, text, text, text, text, uuid[], uuid[], text[]),
--     public.get_notification(uuid), public.get_notification_filter_options(), public.get_notification_stats(),
--     public.list_notifications(text, text, text, text, int, int),
--     public.adm_publish_campaign(uuid, uuid), public.adm_campaign_row(uuid),
--     public.adm_validate_campaign(text, text, text[]), public.adm_resolve_audience(text, uuid[], uuid[]),
--     public.adm_campaign_category(text);
--   delete from public.notifications where reference_type = 'notification_campaign';   -- inbox rows (data)
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- helpers
create or replace function public.adm_campaign_category(p_category text) returns text
language sql immutable set search_path = public, extensions as $$
  select case when p_category = 'announcement' then 'announcement' else 'system' end;
$$;

create or replace function public.adm_resolve_audience(p_type text, p_series uuid[], p_users uuid[])
returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select p.id from public.profiles p left join public.students st on st.id = p.id
   where p_type in ('all_users', 'learners') and p.role = 'student' and coalesce(st.account_status, 'active') = 'active'
  union
  select p.id from public.profiles p left join public.educator_admin_state es on es.user_id = p.id
   where p_type in ('all_users', 'educators') and p.role = 'educator' and coalesce(es.account_status, 'active') = 'active'
  union
  select p.id from public.profiles p
   where p_type in ('all_users', 'admins') and p.role in ('admin', 'super_admin')
  union
  select st.student_id from public.adm_series_students() st
   where p_type = 'series_enrolled' and st.series_id = any (coalesce(p_series, '{}'))
  union
  select p.id from public.profiles p
   where p_type = 'selected_users' and p.id = any (coalesce(p_users, '{}'));
$$;

-- Clear messages before the table CHECKs fire.
create or replace function public.adm_validate_campaign(p_category text, p_audience text, p_channels text[]) returns void
language plpgsql immutable set search_path = public, extensions as $$
begin
  if p_category is null or p_category not in ('system', 'policy', 'alert', 'announcement') then
    raise exception 'Unknown notification category: %', p_category using errcode = '22023';
  end if;
  if p_audience is null or p_audience not in ('all_users', 'learners', 'educators', 'admins', 'series_enrolled', 'selected_users') then
    raise exception 'Unknown audience: %', p_audience using errcode = '22023';
  end if;
  if coalesce(cardinality(p_channels), 0) = 0 or not (p_channels <@ array['in_app', 'email']) then
    raise exception 'Choose in-app and/or email.' using errcode = '22023';
  end if;
end $$;

-- One list row (archived v_notifications_list keys) plus the caller's read_at.
create or replace function public.adm_campaign_row(p_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', c.id, 'title', c.title, 'body', c.body, 'category', c.category, 'category_label', initcap(c.category),
           'audience_type', c.audience_type,
           'audience_label', case c.audience_type
               when 'all_users' then 'All users' when 'learners' then 'All learners' when 'educators' then 'Educators'
               when 'admins' then 'Admins'
               when 'series_enrolled' then 'Enrolled in ' || cardinality(c.audience_series_ids) || ' series'
               else cardinality(c.audience_user_ids) || ' selected users' end,
           'channels', to_jsonb(c.channels),
           'channels_label', case when 'email' = any (c.channels) and 'in_app' = any (c.channels) then 'Email + In-app'
                                  when 'email' = any (c.channels) then 'Email' else 'In-app' end,
           'action_url', c.action_url, 'status', c.status, 'scheduled_for', c.scheduled_for,
           'published_at', c.published_at, 'created_at', c.created_at,
           'when_label', case c.status
               when 'published' then 'Sent ' || to_char(c.published_at at time zone 'UTC', 'Mon DD, YYYY')
               when 'scheduled' then to_char(c.scheduled_for at time zone 'UTC', 'Mon DD, YYYY · HH24:MI "UTC"')
               else 'Not scheduled' end,
           'recipients_total', c.recipients_total, 'delivered_count', c.delivered_count,
           'opened_count', (select count(*) from public.notifications n
                             where n.reference_type = 'notification_campaign' and n.reference_id = c.id and n.is_read),
           'read_at', (select n.read_at from public.notifications n
                        where n.reference_type = 'notification_campaign' and n.reference_id = c.id
                          and n.user_id = auth.uid() order by n.created_at desc limit 1),
           'created_by', c.created_by, 'created_by_name', p.full_name)
    from public.notification_campaigns c
    left join public.profiles p on p.id = c.created_by
   where c.id = p_id;
$$;

-- Fan-out and flip to published. p_actor is null when cron sends it.
create or replace function public.adm_publish_campaign(p_id uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  c           public.notification_campaigns;
  v_in        boolean;
  v_mail      boolean;
  v_cat       text;
  v_cnt       int;
  v_delivered int;
  v_queued    int;
begin
  select * into c from public.notification_campaigns where id = p_id for update;
  if not found then raise exception 'Notification not found.' using errcode = 'P0002'; end if;
  if c.status not in ('draft', 'scheduled') then
    raise exception 'Notification is already %.', c.status using errcode = '22023';
  end if;
  v_in   := 'in_app' = any (c.channels);
  v_mail := 'email'  = any (c.channels);
  v_cat  := public.adm_campaign_category(c.category);

  -- Preferences (the lead's notification_preferences, keyed by user_id + category;
  -- a missing row means the column defaults: in_app = true, email = true):
  --   in-app: 'announcement' campaigns skip users with in_app = false;
  --           'system' notices (system / policy / alert) are always delivered.
  --   email:  follows notification_preferences.email for both categories.
  -- Users left with no channel get no recipient row.
  with aud as (
    select distinct a as uid from public.adm_resolve_audience(c.audience_type, c.audience_series_ids, c.audience_user_ids) a
  ), pref as (
    select aud.uid,
           v_in and (v_cat = 'system' or coalesce(np.in_app, true)) as want_in,
           v_mail and coalesce(np.email, true)                     as want_mail
      from aud
      left join public.notification_preferences np on np.user_id = aud.uid and np.category = v_cat
  ), inbox as (
    insert into public.notifications (user_id, category, title, body, action_url, reference_type, reference_id)
    select pref.uid, v_cat, c.title, c.body, c.action_url, 'notification_campaign', c.id
      from pref where pref.want_in
    returning id, user_id
  )
  insert into public.notification_recipients (campaign_id, user_id, inbox_notification_id, email_status, delivery_status, delivered_at)
  select c.id, pref.uid, inbox.id,
         case when pref.want_mail then 'queued' else 'not_requested' end,
         case when pref.want_in then 'delivered' else 'queued' end,
         case when pref.want_in then now() end
    from pref left join inbox on inbox.user_id = pref.uid
   where pref.want_in or pref.want_mail
  on conflict (campaign_id, user_id) do nothing;
  get diagnostics v_cnt = row_count;
  if v_cnt = 0 then
    raise exception 'No recipients match this audience (after notification preferences).' using errcode = '22023';
  end if;

  select count(*) filter (where nr.delivery_status = 'delivered'), count(*) filter (where nr.email_status = 'queued')
    into v_delivered, v_queued
    from public.notification_recipients nr where nr.campaign_id = p_id;
  update public.notification_campaigns
     set status = 'published', published_at = now(), updated_by = p_actor,
         recipients_total = v_cnt, delivered_count = v_delivered
   where id = p_id;
  insert into public.notification_campaign_events (campaign_id, event_type, actor_id, detail)
  values (p_id, 'published', p_actor, jsonb_build_object('recipients', v_cnt, 'in_app', v_delivered, 'email_queued', v_queued));
  return jsonb_build_object('id', p_id, 'recipients', v_cnt, 'email_queued', v_queued);
end $$;

-- ------------------------------------------------------------- admin reads
create or replace function public.list_notifications(
  p_search text default null, p_status text default null, p_category text default null,
  p_audience text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 10), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  perform public.adm_require_admin();
  return query
  with f as (
    select c.id, c.created_at from public.notification_campaigns c
     where c.status <> 'archived'
       and (v_like is null or c.title ilike v_like or c.body ilike v_like)
       and (p_status is null or p_status in ('', 'all') or c.status = p_status)
       and (p_category is null or p_category in ('', 'all') or c.category = p_category)
       and (p_audience is null or p_audience in ('', 'all') or c.audience_type = p_audience)
  )
  select public.adm_campaign_row(f.id), count(*) over ()
    from f
   order by f.created_at desc, f.id
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.get_notification_stats() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (
    select jsonb_build_object(
      'total',     count(*) filter (where c.status <> 'archived'),
      'published', count(*) filter (where c.status = 'published'),
      'drafts',    count(*) filter (where c.status = 'draft'),
      'scheduled', count(*) filter (where c.status = 'scheduled'),
      'delivered', coalesce(sum(c.delivered_count) filter (where c.status = 'published'), 0),
      'opened',    (select count(*) from public.notifications n
                     join public.notification_campaigns x on x.id = n.reference_id and x.status = 'published'
                    where n.reference_type = 'notification_campaign' and n.is_read))
      from public.notification_campaigns c);
end $$;

create or replace function public.get_notification_filter_options() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return jsonb_build_object(
    'statuses',   jsonb_build_array('draft', 'scheduled', 'published'),
    'categories', jsonb_build_array('system', 'policy', 'alert', 'announcement'),
    'audiences',  jsonb_build_array('all_users', 'learners', 'educators', 'admins', 'series_enrolled', 'selected_users'),
    'channels',   jsonb_build_array('in_app', 'email'));
end $$;

create or replace function public.get_notification(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.notification_campaigns;
begin
  perform public.adm_require_admin();
  select * into c from public.notification_campaigns where id = p_id;
  if not found then raise exception 'Notification not found.' using errcode = 'P0002'; end if;
  return to_jsonb(c) || jsonb_build_object(
    'audience_estimate', (select count(*) from public.adm_resolve_audience(c.audience_type, c.audience_series_ids, c.audience_user_ids)));
end $$;

-- Works for a saved campaign (p_id) or an unsaved form (fields override the row).
create or replace function public.preview_notification(
  p_id uuid default null, p_title text default null, p_body text default null,
  p_category text default null, p_audience_type text default null,
  p_series_ids uuid[] default null, p_user_ids uuid[] default null, p_channels text[] default null
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  c          public.notification_campaigns;
  v_title    text;
  v_body     text;
  v_category text;
  v_audience text;
  v_series   uuid[];
  v_users    uuid[];
  v_channels text[];
begin
  perform public.adm_require_admin();
  if p_id is not null then select * into c from public.notification_campaigns where id = p_id; end if;
  v_title    := coalesce(p_title, c.title, '');
  v_body     := coalesce(p_body, c.body, '');
  v_category := coalesce(p_category, c.category, 'announcement');
  v_audience := coalesce(p_audience_type, c.audience_type, 'all_users');
  v_series   := coalesce(p_series_ids, c.audience_series_ids, '{}');
  v_users    := coalesce(p_user_ids, c.audience_user_ids, '{}');
  v_channels := coalesce(p_channels, c.channels, '{in_app}');
  return jsonb_build_object(
    'in_app', case when 'in_app' = any (v_channels)
                   then jsonb_build_object('title', v_title, 'body', v_body, 'category', v_category) end,
    'email',  case when 'email' = any (v_channels) then jsonb_build_object('subject', v_title, 'body', v_body) end,
    'audience_type', v_audience,
    'estimated_recipients', (select count(*) from public.adm_resolve_audience(v_audience, v_series, v_users)));
end $$;

create or replace function public.estimate_audience(p_type text, p_series_ids uuid[] default '{}', p_user_ids uuid[] default '{}')
returns int
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (select count(*)::int from public.adm_resolve_audience(p_type, p_series_ids, p_user_ids));
end $$;

-- ------------------------------------------------------------ admin writes
-- p_action: draft | schedule | publish
create or replace function public.create_notification(
  p_title text, p_body text, p_category text, p_audience_type text, p_channels text[] default '{in_app}',
  p_series_ids uuid[] default '{}', p_user_ids uuid[] default '{}',
  p_scheduled_for timestamptz default null, p_action text default 'draft', p_action_url text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id     uuid;
  v_action text := coalesce(nullif(p_action, ''), 'draft');
begin
  perform public.adm_require_admin();
  if v_action not in ('draft', 'schedule', 'publish') then
    raise exception 'Unknown action: %', p_action using errcode = '22023';
  end if;
  perform public.adm_validate_campaign(p_category, p_audience_type, coalesce(p_channels, '{in_app}'));
  if char_length(btrim(coalesce(p_title, ''))) not between 3 and 120 then
    raise exception 'Title must be 3 to 120 characters.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'Message must be 1 to 2000 characters.' using errcode = '22023';
  end if;
  if p_audience_type = 'series_enrolled' and coalesce(cardinality(p_series_ids), 0) = 0 then
    raise exception 'Select at least one test series.' using errcode = '22023';
  end if;
  if p_audience_type = 'selected_users' and coalesce(cardinality(p_user_ids), 0) = 0 then
    raise exception 'Select at least one user.' using errcode = '22023';
  end if;
  if v_action = 'schedule' and (p_scheduled_for is null or p_scheduled_for <= now()) then
    raise exception 'Pick a future date and time to schedule.' using errcode = '22023';
  end if;

  insert into public.notification_campaigns
    (title, body, category, audience_type, audience_series_ids, audience_user_ids, channels, action_url,
     status, scheduled_for, created_by, updated_by)
  values (btrim(p_title), btrim(p_body), p_category, p_audience_type, coalesce(p_series_ids, '{}'),
          coalesce(p_user_ids, '{}'), coalesce(p_channels, '{in_app}'), nullif(btrim(coalesce(p_action_url, '')), ''),
          case when v_action = 'schedule' then 'scheduled' else 'draft' end,
          case when v_action = 'schedule' then p_scheduled_for end, auth.uid(), auth.uid())
  returning id into v_id;
  insert into public.notification_campaign_events (campaign_id, event_type, actor_id) values (v_id, 'created', auth.uid());
  if v_action = 'schedule' then
    insert into public.notification_campaign_events (campaign_id, event_type, actor_id, detail)
    values (v_id, 'scheduled', auth.uid(), jsonb_build_object('at', p_scheduled_for));
  end if;
  perform public.adm_audit('notification.create', 'notification_campaign', v_id, null,
                           jsonb_build_object('action', v_action, 'audience', p_audience_type), null);
  if v_action = 'publish' then
    perform public.adm_publish_campaign(v_id, auth.uid());
    perform public.adm_audit('notification.publish', 'notification_campaign', v_id, null, null, null);
  end if;
  return v_id;
end $$;

create or replace function public.publish_notification(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r jsonb;
begin
  perform public.adm_require_admin();
  r := public.adm_publish_campaign(p_id, auth.uid());
  perform public.adm_audit('notification.publish', 'notification_campaign', p_id, null, r, null);
  return r;
end $$;

create or replace function public.archive_notification(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.notification_campaigns
     set status = 'archived', archived_at = now(), updated_by = auth.uid()
   where id = p_id and status = 'published';
  if not found then raise exception 'Only published notifications can be archived.' using errcode = '22023'; end if;
  insert into public.notification_campaign_events (campaign_id, event_type, actor_id) values (p_id, 'archived', auth.uid());
  perform public.adm_audit('notification.archive', 'notification_campaign', p_id, null, null, null);
end $$;

create or replace function public.delete_draft_notification(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  delete from public.notification_campaigns where id = p_id and status in ('draft', 'scheduled');
  if not found then
    raise exception 'Only drafts and scheduled notifications can be deleted.' using errcode = '22023';
  end if;
  perform public.adm_audit('notification.delete', 'notification_campaign', p_id, null, null, null);
end $$;

-- ------------------------------------------------------------- admin bell
-- p_id is the CAMPAIGN id (NotificationsPanel passes list_notifications ids).
create or replace function public.mark_notification_read(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.notifications
     set is_read = true, read_at = now()
   where user_id = auth.uid() and reference_type = 'notification_campaign' and reference_id = p_id and not is_read;
end $$;

create or replace function public.mark_all_notifications_read() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  update public.notifications
     set is_read = true, read_at = now()
   where user_id = auth.uid() and reference_type = 'notification_campaign' and not is_read;
end $$;

create or replace function public.get_my_unread_notification_count() returns int
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  return (select count(*)::int
            from public.notifications n
            join public.notification_campaigns c on c.id = n.reference_id and c.status = 'published'
           where n.user_id = auth.uid() and n.reference_type = 'notification_campaign' and not n.is_read);
end $$;

-- --------------------------------------------------- cron / Edge Function
-- Cron (every minute). No admin check: cron runs without a user. A campaign
-- that fails (e.g. empty audience) goes back to draft with an event.
create or replace function public.dispatch_due_notifications() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  r record;
  n int := 0;
begin
  for r in select c.id from public.notification_campaigns c
            where c.status = 'scheduled' and c.scheduled_for <= now()
            order by c.scheduled_for
            for update skip locked
  loop
    begin
      perform public.adm_publish_campaign(r.id, null);
      n := n + 1;
    exception when others then
      update public.notification_campaigns set status = 'draft', scheduled_for = null where id = r.id;
      insert into public.notification_campaign_events (campaign_id, event_type, detail)
      values (r.id, 'dispatch_failed', jsonb_build_object('error', sqlerrm));
    end;
  end loop;
  return n;
end $$;

-- Email worker callback (service role): [{"user_id": "...", "ok": true, "error": null}, ...]
create or replace function public.record_email_results(p_notification_id uuid, p_results jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.notification_recipients nr
     set email_status    = case when x.ok then 'sent' else 'failed' end,
         email_sent_at   = case when x.ok then now() end,
         email_error     = case when x.ok then null else x.error end,
         delivery_status = case when nr.delivery_status = 'delivered' then nr.delivery_status
                                when x.ok then 'delivered' else 'failed' end,
         delivered_at    = coalesce(nr.delivered_at, case when x.ok then now() end)
    from jsonb_to_recordset(case when jsonb_typeof(p_results) = 'array' then p_results else '[]'::jsonb end)
         as x(user_id uuid, ok boolean, error text)
   where nr.campaign_id = p_notification_id and nr.user_id = x.user_id;
  update public.notification_campaigns c
     set delivered_count = (select count(*) from public.notification_recipients nr
                             where nr.campaign_id = c.id and nr.delivery_status = 'delivered')
   where c.id = p_notification_id;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_campaign_category(text) from public, anon, authenticated;
revoke all on function public.adm_resolve_audience(text, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.adm_validate_campaign(text, text, text[]) from public, anon, authenticated;
revoke all on function public.adm_campaign_row(uuid) from public, anon, authenticated;
revoke all on function public.adm_publish_campaign(uuid, uuid) from public, anon, authenticated;

revoke all on function public.list_notifications(text, text, text, text, int, int) from public, anon;
revoke all on function public.get_notification_stats() from public, anon;
revoke all on function public.get_notification_filter_options() from public, anon;
revoke all on function public.get_notification(uuid) from public, anon;
revoke all on function public.preview_notification(uuid, text, text, text, text, uuid[], uuid[], text[]) from public, anon;
revoke all on function public.estimate_audience(text, uuid[], uuid[]) from public, anon;
revoke all on function public.create_notification(text, text, text, text, text[], uuid[], uuid[], timestamptz, text, text) from public, anon;
revoke all on function public.publish_notification(uuid) from public, anon;
revoke all on function public.archive_notification(uuid) from public, anon;
revoke all on function public.delete_draft_notification(uuid) from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
revoke all on function public.get_my_unread_notification_count() from public, anon;

grant execute on function public.list_notifications(text, text, text, text, int, int) to authenticated;
grant execute on function public.get_notification_stats() to authenticated;
grant execute on function public.get_notification_filter_options() to authenticated;
grant execute on function public.get_notification(uuid) to authenticated;
grant execute on function public.preview_notification(uuid, text, text, text, text, uuid[], uuid[], text[]) to authenticated;
grant execute on function public.estimate_audience(text, uuid[], uuid[]) to authenticated;
grant execute on function public.create_notification(text, text, text, text, text[], uuid[], uuid[], timestamptz, text, text) to authenticated;
grant execute on function public.publish_notification(uuid) to authenticated;
grant execute on function public.archive_notification(uuid) to authenticated;
grant execute on function public.delete_draft_notification(uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.get_my_unread_notification_count() to authenticated;

revoke all on function public.dispatch_due_notifications() from public, anon, authenticated;
grant execute on function public.dispatch_due_notifications() to postgres, service_role;
revoke all on function public.record_email_results(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_email_results(uuid, jsonb) to service_role;
