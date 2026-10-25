-- =====================================================================
-- 20261025120100_admin_b3_tables.sql
--
-- Purpose
--   Tables owned by the admin port for Batch 3:
--     report_runs                   Reports Builder snapshots (preview + CSV)
--     notification_campaigns        admin campaign (archived "notifications", D10)
--     notification_recipients       per-recipient delivery / email state
--     notification_campaign_events  campaign audit trail
--     callback_activity             callback timeline (status changes, notes)
--   No money tables (F4, D1).
--
-- Lead objects referenced (FK targets only; nothing on them is altered)
--   profiles, callback_requests, notifications (the lead's inbox row id is
--   stored in notification_recipients.inbox_notification_id without an FK).
--
-- Assumptions
--   * The in-app inbox is the lead's notifications table (fan-out in
--     20261025120400). notification_recipients keeps only delivery state;
--     "opened" is the lead's notifications.is_read.
--   * All access is through SECURITY DEFINER RPCs: RLS on, no policies, no
--     table grants for anon / authenticated. The send-notification-emails
--     Edge Function uses the service role (Batch 4 updates its embed from
--     notifications(...) to notification_campaigns(...) and notification_id
--     to campaign_id).
--   * Enum types of the archive are text + CHECK here.
--
-- ROLLBACK
--   drop table if exists public.callback_activity, public.notification_campaign_events,
--     public.notification_recipients, public.notification_campaigns, public.report_runs;
--   delete from public.notifications where reference_type = 'notification_campaign';   -- fanned-out inbox rows
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- report_runs
create table if not exists public.report_runs (
  id               uuid primary key default gen_random_uuid(),
  report_type      text not null references public.report_types(key),
  range_key        text not null,
  date_from        date not null,
  date_to          date not null,
  filters          jsonb not null default '{}'::jsonb,
  status           text not null default 'running' check (status in ('running', 'completed', 'failed')),
  row_count        int,
  result_rows      jsonb,                    -- snapshot: preview and CSV always match
  error            text,
  requested_by     uuid references public.profiles(id) on delete set null,
  requested_at     timestamptz not null default now(),
  generated_at     timestamptz,
  csv_downloads    int not null default 0,
  last_exported_at timestamptz,
  expires_at       timestamptz not null default (now() + interval '7 days')   -- snapshot cleared after this
);
create index if not exists report_runs_user_idx on public.report_runs (requested_by, requested_at desc);
create index if not exists report_runs_exp_idx  on public.report_runs (expires_at) where result_rows is not null;

-- ------------------------------------------------------ notification_campaigns
create table if not exists public.notification_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null check (char_length(btrim(title)) between 3 and 120),
  body                text not null check (char_length(btrim(body)) between 1 and 2000),
  category            text not null default 'announcement' check (category in ('system', 'policy', 'alert', 'announcement')),
  audience_type       text not null default 'all_users'
                      check (audience_type in ('all_users', 'learners', 'educators', 'admins', 'series_enrolled', 'selected_users')),
  audience_series_ids uuid[] not null default '{}',
  audience_user_ids   uuid[] not null default '{}',
  channels            text[] not null default '{in_app}',
  action_url          text,
  status              text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  scheduled_for       timestamptz,
  published_at        timestamptz,
  edited_at           timestamptz,
  archived_at         timestamptz,
  recipients_total    int not null default 0,
  delivered_count     int not null default 0,
  created_by          uuid references public.profiles(id) on delete set null,
  updated_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint notification_campaigns_channels_ok check (cardinality(channels) >= 1 and channels <@ array['in_app', 'email']),
  constraint notification_campaigns_sched_ok    check (status <> 'scheduled' or scheduled_for is not null),
  constraint notification_campaigns_series_ok   check (audience_type <> 'series_enrolled' or cardinality(audience_series_ids) > 0),
  constraint notification_campaigns_users_ok    check (audience_type <> 'selected_users' or cardinality(audience_user_ids) > 0)
);
create index if not exists notification_campaigns_status_idx on public.notification_campaigns (status, created_at desc);
create index if not exists notification_campaigns_due_idx    on public.notification_campaigns (scheduled_for) where status = 'scheduled';

create table if not exists public.notification_recipients (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid not null references public.notification_campaigns(id) on delete cascade,
  user_id               uuid not null references public.profiles(id) on delete cascade,
  inbox_notification_id uuid,                -- the lead's notifications.id (in_app channel)
  email_status          text not null default 'not_requested' check (email_status in ('not_requested', 'queued', 'sent', 'failed')),
  email_sent_at         timestamptz,
  email_error           text,
  delivery_status       text not null default 'queued' check (delivery_status in ('queued', 'delivered', 'failed')),
  delivered_at          timestamptz,
  created_at            timestamptz not null default now(),
  unique (campaign_id, user_id)
);
create index if not exists notification_recipients_email_idx on public.notification_recipients (campaign_id) where email_status = 'queued';

create table if not exists public.notification_campaign_events (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.notification_campaigns(id) on delete cascade,
  event_type   text not null check (event_type in ('created', 'edited', 'scheduled', 'published', 'archived', 'dispatch_failed')),
  actor_id     uuid references public.profiles(id) on delete set null,
  detail       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists notification_campaign_events_idx on public.notification_campaign_events (campaign_id, created_at);

-- ---------------------------------------------------------- callback_activity
create table if not exists public.callback_activity (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.callback_requests(id) on delete cascade,
  type         text not null check (type in ('created', 'status_changed', 'note', 'assigned', 'repeat_submission')),
  from_status  text check (from_status in ('new', 'contacted', 'closed')),
  to_status    text check (to_status in ('new', 'contacted', 'closed')),
  note         text,
  actor_id     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists callback_activity_idx on public.callback_activity (request_id, created_at);

-- ------------------------------------------------ foreign-key indexes
-- Every column that references a lead table is indexed (FK audit).
create index if not exists notification_campaigns_created_by_idx on public.notification_campaigns (created_by) where created_by is not null;
create index if not exists notification_campaigns_updated_by_idx on public.notification_campaigns (updated_by) where updated_by is not null;
create index if not exists notification_recipients_user_idx      on public.notification_recipients (user_id);
create index if not exists notification_campaign_events_actor_idx on public.notification_campaign_events (actor_id) where actor_id is not null;
create index if not exists callback_activity_actor_idx           on public.callback_activity (actor_id) where actor_id is not null;

-- ------------------------------------------------------------------ triggers
-- (own tables only)
drop trigger if exists trg_notification_campaigns_touch on public.notification_campaigns;
create trigger trg_notification_campaigns_touch before update on public.notification_campaigns
  for each row execute function public.adm_touch_updated_at();

-- ----------------------------------------------------------------------- RLS
alter table public.report_runs                  enable row level security;
alter table public.notification_campaigns       enable row level security;
alter table public.notification_recipients      enable row level security;
alter table public.notification_campaign_events enable row level security;
alter table public.callback_activity            enable row level security;
revoke all on table public.report_runs, public.notification_campaigns, public.notification_recipients,
  public.notification_campaign_events, public.callback_activity from anon, authenticated;
