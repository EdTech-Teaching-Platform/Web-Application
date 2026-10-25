-- =====================================================================
-- 20261025110100_admin_b2_authoring_tables.sql
--
-- Purpose
--   1:1 extension tables for the lead's authoring tables (D3), plus admin-only
--   authoring tables:
--     test_series_admin    (series_id  -> test_series.id)
--     quiz_admin           (quiz_id    -> quizzes.id)
--     test_sections        (quiz_id    -> quizzes.id)
--     ai_test_jobs, ai_generated_questions
--     quiz_question_admin  (question_id -> quiz_questions.id)
--     question_similarity_matches
--     admin_series_enrollments (series_id, student_id, enrolled_at, amount_paid)
--   and the question-images storage bucket with policies for that bucket only.
--
-- Lead objects referenced (FK targets only; nothing on them is altered)
--   test_series, quizzes, quiz_questions, categories, profiles.
--
-- Assumptions
--   * Extension tables hold only what the lead's tables lack. Series title,
--     description (wizard "about"), instructions, availability window
--     (available_from / available_until), is_published and is_active live in
--     test_series; test title, instructions (quizzes.description), duration,
--     attempt limit, pass percent, shuffle questions, order and show-answers
--     live in quizzes. test_series_admin keeps code, status, pricing,
--     price_inr, subject_category_id / subject_label, grade, exam, level,
--     languages, who_for, audience, syllabus, start_method, go-live scheduling,
--     monthly / access / late limits, build_deadline, cover_path, wizard_state,
--     published_at, created_by and deleted_at.
--   * Extension rows are deleted with their lead row (on delete cascade).
--     Lead FKs between quizzes / quiz_questions / options do NOT cascade, so
--     the RPCs delete in child-first order.
--   * Storage policies on storage.objects are created only for
--     bucket_id = 'question-images'.
--
-- ROLLBACK
--   drop policy if exists adm_question_images_read on storage.objects;
--   drop policy if exists adm_question_images_admin_write on storage.objects;
--   delete from storage.buckets where id = 'question-images';   -- only if it holds no objects
--   drop table if exists public.admin_series_enrollments, public.question_similarity_matches,
--     public.quiz_question_admin, public.ai_generated_questions, public.ai_test_jobs,
--     public.test_sections, public.quiz_admin, public.test_series_admin;
--   drop sequence if exists public.adm_series_code_seq;
-- =====================================================================
set search_path = public, extensions;

create sequence if not exists public.adm_series_code_seq start 1001;   -- TS-1001

-- ---------------------------------------------------------- test_series_admin
create table if not exists public.test_series_admin (
  series_id            uuid primary key references public.test_series(id) on delete cascade,
  code                 text not null unique default ('TS-' || nextval('public.adm_series_code_seq')),
  status               text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  who_for              text,
  audience             text,
  syllabus             text,
  start_method         text check (start_method in ('scratch', 'duplicate', 'csv', 'ai', 'manual')),
  pricing              text not null default 'free' check (pricing in ('free', 'paid')),
  price_inr            numeric(10,2) not null default 0 check (price_inr >= 0),
  subject_category_id  uuid references public.categories(id) on delete set null,
  subject_label        text,                      -- subject text when no category matches (D9: categories are read-only)
  grade                text,
  exam                 text,
  level                text,
  languages            text[] not null default '{}',
  go_live_mode        text not null default 'now' check (go_live_mode in ('now', 'schedule')),
  go_live_at           timestamptz,
  monthly_limit        int check (monthly_limit is null or monthly_limit >= 1),
  access_days          int check (access_days is null or access_days >= 1),
  late_allowed         boolean not null default false,
  late_grace_minutes   int check (late_grace_minutes is null or late_grace_minutes > 0),
  build_deadline       date,
  cover_path           text,
  wizard_state         jsonb,
  published_at         timestamptz,
  created_by           uuid references public.profiles(id) on delete set null,
  deleted_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint test_series_admin_paid_price check (pricing = 'free' or price_inr > 0),
  constraint test_series_admin_golive check (go_live_mode <> 'schedule' or go_live_at is not null),
  constraint test_series_admin_late check (not late_allowed or late_grace_minutes is not null)
);
create index if not exists test_series_admin_status_idx on public.test_series_admin (status) where deleted_at is null;

-- ------------------------------------------------------------------ quiz_admin
create table if not exists public.quiz_admin (
  quiz_id              uuid primary key references public.quizzes(id) on delete cascade,
  status               text not null default 'draft' check (status in ('draft', 'published')),
  total_marks_planned  numeric(8,2),
  passing_marks        numeric(8,2),
  shuffle_options      boolean not null default false,
  window_mode          text not null default 'inherit' check (window_mode in ('inherit', 'custom')),
  open_at              timestamptz,
  close_at             timestamptz,
  scheduled_at         timestamptz,
  planned_questions    int not null default 0,
  topics               text[] not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint quiz_admin_window check (window_mode <> 'custom' or (open_at is not null and close_at is not null and open_at < close_at))
);

create table if not exists public.test_sections (
  id                 uuid primary key default gen_random_uuid(),
  quiz_id            uuid not null references public.quizzes(id) on delete cascade,
  position           int  not null,
  name               text not null,
  instructions       text,
  planned_questions  int,
  planned_marks      numeric(8,2),
  unique (quiz_id, position)
);

-- ---------------------------------------------------------------- AI builder
create table if not exists public.ai_test_jobs (
  id                      uuid primary key default gen_random_uuid(),
  requested_by            uuid not null references public.profiles(id) on delete cascade,
  input_source            text not null default 'form' check (input_source in ('form', 'paste_paper')),
  pasted_text             text,
  test_name               text not null,
  subject_id              uuid references public.categories(id) on delete set null,
  custom_subject          text,
  topics                  text[] not null default '{}',
  exam_type               text,
  difficulty              text check (difficulty in ('Easy', 'Medium', 'Hard', 'Mixed')),
  total_marks             int,
  duration_minutes        int,
  num_questions           int check (num_questions between 1 and 300),
  num_sections            int check (num_sections between 1 and 10),
  question_types          text[] not null default '{mcq}',
  negative_marking        boolean not null default false,
  negative_mark_value     numeric(4,2) not null default 1,
  language                text not null default 'English',
  additional_instructions text,
  generation_mode         text not null default 'full' check (generation_mode in ('full', 'structure_only', 'questions_for_structure')),
  status                  text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'saved')),
  structure               jsonb,
  model                   text,
  prompt                  text,
  input_tokens            int not null default 0,
  output_tokens           int not null default 0,
  cost_usd                numeric(10,4) not null default 0,
  attempts                int not null default 0,
  error                   text,
  series_id               uuid references public.test_series(id) on delete set null,
  test_id                 uuid references public.quizzes(id) on delete set null,
  created_at              timestamptz not null default now(),
  started_at              timestamptz,
  completed_at            timestamptz
);
create index if not exists ai_test_jobs_user_idx on public.ai_test_jobs (requested_by, created_at desc);

create table if not exists public.ai_generated_questions (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.ai_test_jobs(id) on delete cascade,
  section_position    int,
  position            int not null,
  type                text not null default 'mcq',
  body                text not null,
  options             jsonb,
  correct_keys        text[] not null default '{}',
  marks               numeric(6,2) not null default 4,
  negative_marks      numeric(6,2) not null default 0,
  difficulty          text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  subject             text,
  topic               text,
  explanation         text,
  answer_instructions text,
  issues              text[] not null default '{}',
  review_state        text not null default 'pending' check (review_state in ('pending', 'accepted', 'edited', 'rejected')),
  unique (job_id, position)
);

-- -------------------------------------------------------- quiz_question_admin
-- admin_type keeps the UI / archived type (objective, subjective, mcq, mcq_multi,
-- multi_select, true_false, numerical, fill_blank, short_answer, long_answer);
-- quiz_questions.question_type holds the lead's mapped value (D3, F5).
create table if not exists public.quiz_question_admin (
  question_id           uuid primary key references public.quiz_questions(id) on delete cascade,
  admin_type            text not null,
  needs_manual_grading  boolean not null default false,
  section_id            uuid references public.test_sections(id) on delete set null,
  negative_marks        numeric(6,2) not null default 0 check (negative_marks >= 0),
  difficulty            text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  subject               text,
  topic                 text,
  image_path            text,
  answer_instructions   text,
  source                text not null default 'manual' check (source in ('manual', 'ai', 'csv', 'duplicate', 'paste')),
  ai_job_id             uuid references public.ai_test_jobs(id) on delete set null,
  updated_at            timestamptz not null default now()
);
create index if not exists quiz_question_admin_section_idx on public.quiz_question_admin (section_id);

-- ------------------------------------------------- question_similarity_matches
create table if not exists public.question_similarity_matches (
  id                 uuid primary key default gen_random_uuid(),
  pair_key           text not null unique,                        -- "<smaller id>::<larger id>"
  question_a_id      uuid not null references public.quiz_questions(id) on delete cascade,
  question_b_id      uuid not null references public.quiz_questions(id) on delete cascade,
  similarity_percent int  not null check (similarity_percent between 0 and 100),
  match_type         text not null check (match_type in ('exact', 'high', 'possible')),
  same_series        boolean not null default false,
  same_test          boolean not null default false,
  review_status      text not null default 'unreviewed' check (review_status in ('unreviewed', 'reviewed', 'dismissed', 'confirmed')),
  review_note        text,
  reviewed_by        uuid references public.profiles(id) on delete set null,
  reviewed_at        timestamptz,
  detected_at        timestamptz not null default now(),
  check (question_a_id <> question_b_id)
);
create index if not exists qsm_review_idx on public.question_similarity_matches (review_status, match_type);

-- --------------------------------------------------- admin_series_enrollments
-- Direct enrolment in an admin-sold series (the lead grants access by course
-- enrolment). Filled by the payments port later (D1); read by analytics now.
create table if not exists public.admin_series_enrollments (
  id             uuid primary key default gen_random_uuid(),
  series_id      uuid not null references public.test_series(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  enrolled_at    timestamptz not null default now(),
  expires_at     timestamptz,
  amount_paid    numeric(10,2) not null default 0 check (amount_paid >= 0),
  revoked_at     timestamptz,
  revoke_reason  text,
  unique (series_id, student_id)
);
create index if not exists admin_series_enrollments_student_idx on public.admin_series_enrollments (student_id);

-- ------------------------------------------------ foreign-key indexes
-- Every column that references a lead table is indexed (FK audit).
create index if not exists test_series_admin_subject_idx    on public.test_series_admin (subject_category_id) where subject_category_id is not null;
create index if not exists test_series_admin_created_by_idx on public.test_series_admin (created_by) where created_by is not null;
create index if not exists ai_test_jobs_subject_idx         on public.ai_test_jobs (subject_id) where subject_id is not null;
create index if not exists ai_test_jobs_series_idx          on public.ai_test_jobs (series_id) where series_id is not null;
create index if not exists ai_test_jobs_test_idx            on public.ai_test_jobs (test_id) where test_id is not null;
create index if not exists quiz_question_admin_ai_job_idx   on public.quiz_question_admin (ai_job_id) where ai_job_id is not null;
create index if not exists qsm_question_a_idx               on public.question_similarity_matches (question_a_id);
create index if not exists qsm_question_b_idx               on public.question_similarity_matches (question_b_id);
create index if not exists qsm_reviewed_by_idx              on public.question_similarity_matches (reviewed_by) where reviewed_by is not null;

-- ------------------------------------------------------------------ triggers
drop trigger if exists trg_test_series_admin_touch on public.test_series_admin;
create trigger trg_test_series_admin_touch before update on public.test_series_admin
  for each row execute function public.adm_touch_updated_at();
drop trigger if exists trg_quiz_admin_touch on public.quiz_admin;
create trigger trg_quiz_admin_touch before update on public.quiz_admin
  for each row execute function public.adm_touch_updated_at();
drop trigger if exists trg_quiz_question_admin_touch on public.quiz_question_admin;
create trigger trg_quiz_question_admin_touch before update on public.quiz_question_admin
  for each row execute function public.adm_touch_updated_at();

-- ----------------------------------------------------------------------- RLS
alter table public.test_series_admin           enable row level security;
alter table public.quiz_admin                  enable row level security;
alter table public.test_sections               enable row level security;
alter table public.ai_test_jobs                enable row level security;
alter table public.ai_generated_questions      enable row level security;
alter table public.quiz_question_admin         enable row level security;
alter table public.question_similarity_matches enable row level security;
alter table public.admin_series_enrollments    enable row level security;
revoke all on table public.test_series_admin, public.quiz_admin, public.test_sections, public.ai_test_jobs,
  public.ai_generated_questions, public.quiz_question_admin, public.question_similarity_matches,
  public.admin_series_enrollments from anon, authenticated;
revoke all on sequence public.adm_series_code_seq from public, anon, authenticated;

-- ------------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', false, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists adm_question_images_admin_write on storage.objects;
create policy adm_question_images_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'question-images' and public.adm_is_platform_admin())
  with check (bucket_id = 'question-images' and public.adm_is_platform_admin());

drop policy if exists adm_question_images_read on storage.objects;
create policy adm_question_images_read on storage.objects for select to authenticated
  using (bucket_id = 'question-images');
