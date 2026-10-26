-- =====================================================================
-- 20261027100100_feedback_tables.sql
--
-- Purpose
--   test_feedback: feedback, queries and issue reports a student sends about
--   a submitted attempt. Reachable only through RPCs (RLS on, no policies, no
--   grants to anon / authenticated).
--
-- Lead tables referenced (FK targets only; nothing on them is altered)
--   profiles (student_id CASCADE, reviewed_by SET NULL), test_series (CASCADE),
--   quizzes (SET NULL), quiz_attempts (SET NULL), quiz_questions (SET NULL).
--   Every FK column is indexed.
--
-- ROLLBACK
--   drop table if exists public.test_feedback;   -- drops its indexes too
-- =====================================================================
set search_path = public, extensions;

create table if not exists public.test_feedback (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  series_id    uuid not null references public.test_series (id) on delete cascade,
  test_id      uuid references public.quizzes (id) on delete set null,
  attempt_id   uuid references public.quiz_attempts (id) on delete set null,
  kind         text not null check (kind in ('feedback', 'query', 'issue')),
  rating       int check (rating between 1 and 5),
  category     text check (category in ('wrong_answer', 'unclear_question', 'technical_problem', 'other')),
  question_id  uuid references public.quiz_questions (id) on delete set null,
  message      text not null check (char_length(message) between 5 and 2000),
  status       text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'dismissed')),
  admin_note   text check (admin_note is null or char_length(admin_note) <= 2000),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint test_feedback_rating_required check (kind <> 'feedback' or rating is not null)
);
comment on table public.test_feedback is
  'Student feedback / queries / issue reports on submitted attempts (admin port). RPC access only.';

-- FK indexes (+ the daily limit lookup and the moderation list order).
create index if not exists test_feedback_student_series_idx on public.test_feedback (student_id, series_id, created_at desc);
create index if not exists test_feedback_series_idx        on public.test_feedback (series_id);
create index if not exists test_feedback_test_idx          on public.test_feedback (test_id) where test_id is not null;
create index if not exists test_feedback_attempt_idx       on public.test_feedback (attempt_id) where attempt_id is not null;
create index if not exists test_feedback_question_idx      on public.test_feedback (question_id) where question_id is not null;
create index if not exists test_feedback_reviewed_by_idx   on public.test_feedback (reviewed_by) where reviewed_by is not null;
create index if not exists test_feedback_status_idx        on public.test_feedback (status, created_at desc);

alter table public.test_feedback enable row level security;
revoke all on table public.test_feedback from anon, authenticated;
