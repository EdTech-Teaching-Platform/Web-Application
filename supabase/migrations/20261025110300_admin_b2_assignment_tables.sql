-- =====================================================================
-- 20261025110300_admin_b2_assignment_tables.sql
--
-- Purpose
--   Assign Educators tables in their final, merged shape (archived 0002 and
--   0003 defined test_assignments twice):
--     series_requests, test_assignments, assignment_status_progress (+seed),
--     assignment_comments, assignment_history, assignment_notifications.
--   Column names honour the Batch 1 contract read dynamically by
--   get_admin_nav / get_series_approvals / adm_open_assignment_count:
--   id, series_id, educator_id, test_name, deadline (date), status (text).
--
-- Lead objects referenced (FK targets only)
--   test_series, quizzes, quiz_questions, profiles.
--
-- Assumptions
--   * Educator-side transitions (assigned -> in_progress -> submitted) belong
--     to the teacher portal and are not part of this port.
--
-- ROLLBACK
--   drop table if exists public.assignment_notifications, public.assignment_history,
--     public.assignment_comments, public.test_assignments, public.assignment_status_progress,
--     public.series_requests;
--   drop sequence if exists public.adm_assignment_code_seq, public.adm_request_code_seq;
-- =====================================================================
set search_path = public, extensions;

create sequence if not exists public.adm_assignment_code_seq start 5001;   -- ASG-5001
create sequence if not exists public.adm_request_code_seq    start 6001;   -- REQ-6001

create table if not exists public.series_requests (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique default ('REQ-' || nextval('public.adm_request_code_seq')),
  series_id          uuid references public.test_series(id) on delete set null,   -- null = brand-new series
  series_name        text not null,
  subject            text,
  topics             text[] not null default '{}',
  test_name          text not null,
  sent_by            text,
  sent_date          date not null default current_date,
  question_count     int check (question_count between 1 and 300),
  question_type_mix  text not null default 'mixed' check (question_type_mix in ('objective', 'subjective', 'mixed')),
  difficulty         text check (difficulty in ('Easy', 'Medium', 'Hard', 'Mixed')),
  total_marks        numeric(8,2),
  duration_minutes   int check (duration_minutes > 0),
  instructions       text,
  requested_deadline date,
  status             text not null default 'pending' check (status in ('pending', 'assigned', 'rejected')),
  decision_at        timestamptz,
  decision_reason    text,
  created_at         timestamptz not null default now()
);
create index if not exists series_requests_status_idx on public.series_requests (status, sent_date desc);

create table if not exists public.test_assignments (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique default ('ASG-' || nextval('public.adm_assignment_code_seq')),
  series_id         uuid not null references public.test_series(id) on delete cascade,
  educator_id       uuid not null references public.profiles(id) on delete cascade,
  test_name         text,
  subject           text,
  topics            text[] not null default '{}',
  question_count    int not null default 20 check (question_count between 1 and 300),
  question_type_mix text not null default 'mixed' check (question_type_mix in ('objective', 'subjective', 'mixed')),
  difficulty        text not null default 'Medium' check (difficulty in ('Easy', 'Medium', 'Hard', 'Mixed')),
  total_marks       numeric(8,2) not null default 100,
  duration_minutes  int not null default 60 check (duration_minutes > 0),
  instructions      text,
  assigned_date     date not null default current_date,
  deadline          date,
  status            text not null default 'assigned'
                    check (status in ('assigned', 'in_progress', 'submitted', 'under_review', 'revision_requested',
                                      'approved', 'rejected', 'completed', 'cancelled')),
  request_id        uuid references public.series_requests(id) on delete set null,
  test_id           uuid references public.quizzes(id) on delete set null,   -- the test the educator built
  cancel_reason     text,
  submitted_at      timestamptz,
  overall_feedback  text,
  decision          text check (decision in ('approved', 'revision_requested', 'rejected')),
  decision_at       timestamptz,
  decision_reason   text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists test_assignments_series_idx   on public.test_assignments (series_id);
create index if not exists test_assignments_educator_idx on public.test_assignments (educator_id, status);
create index if not exists test_assignments_deadline_idx on public.test_assignments (deadline);
create index if not exists test_assignments_status_idx   on public.test_assignments (status);
create index if not exists test_assignments_test_idx     on public.test_assignments (test_id) where test_id is not null;

create table if not exists public.assignment_status_progress (
  status   text primary key,
  progress int not null check (progress between 0 and 100)
);
insert into public.assignment_status_progress (status, progress) values
  ('assigned', 5), ('in_progress', 40), ('submitted', 75), ('under_review', 75), ('revision_requested', 55),
  ('approved', 95), ('completed', 100), ('rejected', 0), ('cancelled', 0)
on conflict (status) do nothing;

create table if not exists public.assignment_comments (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.test_assignments(id) on delete cascade,
  question_id   uuid references public.quiz_questions(id) on delete set null,
  question_ref  text,
  comment       text not null,
  author_id     uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists assignment_comments_idx on public.assignment_comments (assignment_id);

create table if not exists public.assignment_history (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.test_assignments(id) on delete cascade,
  action        text not null,
  by_user       uuid references public.profiles(id) on delete set null,
  note          text,
  at            timestamptz not null default now()
);
create index if not exists assignment_history_idx on public.assignment_history (assignment_id, at);

create table if not exists public.assignment_notifications (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.test_assignments(id) on delete cascade,
  educator_id   uuid not null references public.profiles(id) on delete cascade,
  type          text not null check (type in ('assigned', 'updated', 'deadline_changed', 'revision_requested',
                                              'approved', 'rejected', 'cancelled')),
  title         text not null,
  message       text,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists assignment_notifications_idx on public.assignment_notifications (educator_id, is_read, created_at desc);

-- foreign-key indexes (FK audit): every column referencing a lead table
create index if not exists series_requests_series_idx        on public.series_requests (series_id) where series_id is not null;
create index if not exists test_assignments_request_idx      on public.test_assignments (request_id) where request_id is not null;
create index if not exists test_assignments_created_by_idx   on public.test_assignments (created_by) where created_by is not null;
create index if not exists assignment_comments_question_idx  on public.assignment_comments (question_id) where question_id is not null;
create index if not exists assignment_comments_author_idx    on public.assignment_comments (author_id) where author_id is not null;
create index if not exists assignment_history_by_user_idx    on public.assignment_history (by_user) where by_user is not null;

drop trigger if exists trg_test_assignments_touch on public.test_assignments;
create trigger trg_test_assignments_touch before update on public.test_assignments
  for each row execute function public.adm_touch_updated_at();

alter table public.series_requests            enable row level security;
alter table public.test_assignments           enable row level security;
alter table public.assignment_status_progress enable row level security;
alter table public.assignment_comments        enable row level security;
alter table public.assignment_history         enable row level security;
alter table public.assignment_notifications   enable row level security;
revoke all on table public.series_requests, public.test_assignments, public.assignment_status_progress,
  public.assignment_comments, public.assignment_history, public.assignment_notifications from anon, authenticated;
revoke all on sequence public.adm_assignment_code_seq, public.adm_request_code_seq from public, anon, authenticated;
