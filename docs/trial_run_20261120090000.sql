-- Trial for supabase/migrations/20261120090000_admin_written_answers.sql ONLY (needs 20261111090000 .. 20261118090000 applied).
-- Paste all of it into the SQL editor and run: expect "Success. No rows returned".
-- Everything is rolled back (the last line of this file is "rollback;").
begin;

-- =====================================================================
-- 20261120090000_admin_written_answers.sql
--
-- Written answers: typed OR uploaded (photos / PDF of the answer sheet), and
-- marked by the teacher (client, 20 Nov). Decisions: teacher-only marking
-- (no AI), uploads per question (up to 5 files), uploads open during the
-- test and for 15 minutes after it ends, and the series' educator plus
-- admins mark (adm_can_manage_series). Needs 20261115090000 (the report's
-- 'partial' status in adm_report_bucket).
--
-- Storage
--   * bucket answer-uploads: PRIVATE, 10 MB per file, JPEG / PNG / WebP / PDF.
--     No storage policies: the answer-uploads Edge Function creates signed
--     upload URLs and 10-minute signed view URLs with the service role, after
--     the checks below (run with the caller's JWT).
--
-- New tables (ours; RLS on, no policies, no grants)
--   answer_uploads          one row per uploaded file (attempt, question, path)
--   answer_upload_requests  rate limit (60 upload URLs per student per hour)
--   written_answer_grades   the teacher's marks + feedback per written question
--   written_evaluations     per attempt: draft / published, overall feedback
--
-- Student
--   student_answer_upload_slot(attempt, question, content_type, size)
--       for the Edge Function: may this student upload now? (own attempt,
--       written question of that test, window open, < 5 files, rate limit)
--   student_register_answer_upload(attempt, question, path, file_name, content_type, size)
--       after the PUT: checks the path shape and that the object exists.
--   student_remove_answer_upload(upload_id)   while the window is open
--   student_list_answer_uploads(attempt)      {window_closes_at, can_upload, uploads}
-- Teacher (series educator) and admins
--   grading_list_attempts(status, search, series, page, size) -> (row_data, total_count)
--   grading_get_attempt(attempt)    questions, typed answers, uploads, marks so far
--   grading_save(attempt, grades, overall_feedback, publish)
--       saves a draft; publish applies the marks to the attempt and its report
--       (score, pass / fail, breakdowns), and notifies the student.
--       Publishing waits until the upload window has closed.
-- Both
--   adm_answer_upload_access(upload_id)   (Edge Function, caller's JWT): the
--       owner or a grader of that test; returns the storage path to sign.
--
-- Report
--   * A written answer that was only uploaded (no typed text) was finalised as
--     'skipped'. A trigger on attempt_reports (ours) re-marks it 'pending'
--     when the report is written, and adm_written_sync_report does the same
--     for uploads during the 15-minute grace window. Score and max score
--     leave pending answers out, as before.
--   * Published marks set each written row's status (correct / partial /
--     incorrect), points_earned and teacher_evaluation {marks_awarded,
--     feedback, evaluated_at}, plus report.teacher {status, overall_feedback,
--     evaluated_at}.
--
-- Also (a 15 Nov leftover): adm_series_content_problem, used when an educator
-- submits a series for approval, still refused written questions ("coming
-- soon"). Replaced without that check (verbatim from
-- 20261028100300_educator_series_approval.sql otherwise).
--
-- Lead objects: quiz_answers (update is_correct / points_earned of written
-- rows), quiz_attempts (score, max_score, percentage, passed: the columns
-- adm_finalize_attempt writes), notifications (insert, category
-- assessment_result), storage.buckets (insert), storage.objects (read).
-- FKs to quiz_attempts / quiz_questions / profiles cascade or set null and
-- are indexed. No lead table, column, constraint, trigger, RLS or policy change.
--
-- ROLLBACK
--   scripts/rollback_20261120090000_admin_written_answers.sql
-- =====================================================================
set search_path = public, extensions;

-- --------------------------------------------------------------- preflight
do $pre$
declare
  v_problems text[] := '{}';
  v_sig      text;
begin
  foreach v_sig in array array[
    'public.adm_student_uid()', 'public.adm_student_writer_uid()', 'public.adm_question_is_subjective(uuid)',
    'public.adm_is_subjective_type(text)', 'public.adm_attempt_deadline(timestamp with time zone,integer)',
    'public.adm_can_manage_series(uuid)', 'public.adm_is_platform_admin()', 'public.adm_report_bucket(jsonb)',
    'public.adm_audit(text,text,uuid,jsonb,jsonb,text)', 'public.adm_like(text)', 'public.adm_series_content_problem(uuid)',
    'public.adm_series_publish_problem(uuid)', 'public.adm_ai_eval_complete(uuid,jsonb,text,integer,integer)']
  loop
    if to_regprocedure(v_sig) is null then
      v_problems := v_problems || format('missing %s (apply the earlier migrations first)', v_sig);
    end if;
  end loop;
  foreach v_sig in array array['adm_answer_upload_grace', 'adm_answer_upload_window', 'adm_answer_upload_problem',
                               'adm_written_question', 'adm_written_recompute', 'adm_written_sync_rows',
                               'adm_written_sync_report', 'adm_written_report_trigger', 'adm_answer_upload_access',
                               'adm_require_attempt_grader', 'adm_grading_candidate', 'adm_answer_upload_json',
                               'student_answer_upload_slot', 'student_register_answer_upload',
                               'student_remove_answer_upload', 'student_list_answer_uploads',
                               'grading_list_attempts', 'grading_get_attempt', 'grading_save'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = v_sig) then
      v_problems := v_problems || format('function public.%s already exists', v_sig);
    end if;
  end loop;
  foreach v_sig in array array['answer_uploads', 'answer_upload_requests', 'written_answer_grades', 'written_evaluations'] loop
    if to_regclass('public.' || v_sig) is not null then
      v_problems := v_problems || format('table public.%s already exists', v_sig);
    end if;
  end loop;
  if to_regclass('public.attempt_reports') is null then
    v_problems := v_problems || 'missing public.attempt_reports'::text;
  end if;
  if exists (select 1 from storage.buckets where id = 'answer-uploads' and public) then
    v_problems := v_problems || 'bucket answer-uploads exists and is PUBLIC (answer sheets must be private)'::text;
  end if;
  if cardinality(v_problems) > 0 then
    raise exception 'Written answers preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- ------------------------------------------------------------------ bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('answer-uploads', 'answer-uploads', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ------------------------------------------------------------------ tables
create table public.answer_uploads (
  id            uuid primary key default gen_random_uuid(),
  attempt_id    uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id   uuid not null references public.quiz_questions(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  path          text not null unique,
  file_name     text not null check (char_length(file_name) between 1 and 120),
  content_type  text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes    int not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at    timestamptz not null default now()
);
create index answer_uploads_attempt_idx on public.answer_uploads (attempt_id, question_id, created_at);
create index answer_uploads_question_idx on public.answer_uploads (question_id);
create index answer_uploads_student_idx on public.answer_uploads (student_id);

create table public.answer_upload_requests (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index answer_upload_requests_user_idx on public.answer_upload_requests (user_id, created_at desc);

create table public.written_answer_grades (
  attempt_id   uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id  uuid not null references public.quiz_questions(id) on delete cascade,
  marks        numeric not null check (marks >= 0),
  feedback     text check (char_length(feedback) <= 3000),
  graded_by    uuid references public.profiles(id) on delete set null,
  graded_at    timestamptz not null default now(),
  primary key (attempt_id, question_id)
);
create index written_answer_grades_question_idx on public.written_answer_grades (question_id);
create index written_answer_grades_graded_by_idx on public.written_answer_grades (graded_by);

create table public.written_evaluations (
  attempt_id        uuid primary key references public.quiz_attempts(id) on delete cascade,
  status            text not null default 'draft' check (status in ('draft', 'published')),
  overall_feedback  text check (char_length(overall_feedback) <= 3000),
  graded_by         uuid references public.profiles(id) on delete set null,
  updated_at        timestamptz not null default now(),
  published_at      timestamptz
);
create index written_evaluations_graded_by_idx on public.written_evaluations (graded_by);
create index written_evaluations_status_idx on public.written_evaluations (status);

alter table public.answer_uploads enable row level security;
alter table public.answer_upload_requests enable row level security;
alter table public.written_answer_grades enable row level security;
alter table public.written_evaluations enable row level security;
revoke all on table public.answer_uploads, public.answer_upload_requests,
                    public.written_answer_grades, public.written_evaluations from public, anon, authenticated;
revoke all on sequence public.answer_upload_requests_id_seq from public, anon, authenticated;

-- ----------------------------------------------------------------- helpers
create or replace function public.adm_answer_upload_grace() returns interval
language sql immutable set search_path = public, extensions as $$ select interval '15 minutes' $$;

-- When uploads close for an attempt: 15 minutes after the deadline while it
-- is still open (no time limit: never), 15 minutes after it ended otherwise.
create or replace function public.adm_answer_upload_window(p_attempt uuid) returns timestamptz
language sql stable security definer set search_path = public, extensions as $$
  select case
           when a.status = 'in_progress' then
             coalesce(public.adm_attempt_deadline(a.started_at, q.time_limit_mins) + public.adm_answer_upload_grace(), 'infinity'::timestamptz)
           when a.status in ('submitted', 'timed_out') then
             coalesce(a.submitted_at, a.started_at) + public.adm_answer_upload_grace()
           else '-infinity'::timestamptz end
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
   where a.id = p_attempt;
$$;

-- A written (subjective) question of this attempt's test?
create or replace function public.adm_written_question(p_attempt uuid, p_question uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.quiz_attempts a join public.quiz_questions qq on qq.quiz_id = a.quiz_id
                  where a.id = p_attempt and qq.id = p_question)
         and public.adm_question_is_subjective(p_question);
$$;

-- Why this student can't add a file to this answer now, or null.
create or replace function public.adm_answer_upload_problem(p_attempt uuid, p_question uuid, p_student uuid) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare a record;
begin
  select x.id, x.student_id, x.status into a from public.quiz_attempts x where x.id = p_attempt;
  if a.id is null or a.student_id is distinct from p_student then return 'Attempt not found.'; end if;
  if not public.adm_written_question(p_attempt, p_question) then
    return 'Answer sheets can be uploaded only for written questions.';
  end if;
  if exists (select 1 from public.written_evaluations e where e.attempt_id = p_attempt and e.status = 'published') then
    return 'This test has already been evaluated.';
  end if;
  if now() > public.adm_answer_upload_window(p_attempt) then
    return 'The time to upload answer sheets for this test is over.';
  end if;
  return null;
end $$;

-- ------------------------------------------------------- report recompute
-- Score, pass / fail, counts, breakdowns, comparison and strengths from the
-- question rows (as adm_ai_eval_complete does); writes the attempt's score.
create or replace function public.adm_written_recompute(p_attempt uuid, p_report jsonb, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_att    record;
  v_score  numeric;
  v_max    numeric;
  v_pct    numeric;
  v_pass   numeric;
  v_passed boolean;
  v_cmp    record;
  v_rank   int;
  v_lower  int;
  v_report jsonb;
begin
  select a.* into v_att from public.quiz_attempts a where a.id = p_attempt;
  select coalesce(sum(coalesce((x ->> 'points_earned')::numeric, 0)) filter (where x ->> 'status' <> 'pending'), 0),
         coalesce(sum((x ->> 'points')::numeric) filter (where x ->> 'status' <> 'pending'), 0)
    into v_score, v_max
    from jsonb_array_elements(p_rows) x;
  v_pass   := coalesce((p_report #>> '{summary,passing_percentage}')::numeric, 0);
  v_pct    := case when v_max > 0 then greatest(round(v_score * 100.0 / v_max, 2), 0) else 0 end;
  v_passed := v_pct >= v_pass;

  update public.quiz_attempts set score = v_score, max_score = v_max, percentage = v_pct, passed = v_passed
   where id = p_attempt;

  select count(*) as n, round(avg(a.percentage), 2) as avg_pct, max(a.percentage) as top_pct,
         round(avg(a.score), 2) as avg_score, max(a.score) as top_score
    into v_cmp
    from public.quiz_attempts a
   where a.quiz_id = v_att.quiz_id and a.status in ('submitted', 'timed_out') and a.percentage is not null;
  select count(*) filter (where a.percentage > v_pct) + 1, count(*) filter (where a.percentage < v_pct)
    into v_rank, v_lower
    from public.quiz_attempts a
   where a.quiz_id = v_att.quiz_id and a.status in ('submitted', 'timed_out') and a.percentage is not null;

  v_report := p_report || jsonb_build_object(
    'questions', p_rows,
    'summary', coalesce(p_report -> 'summary', '{}'::jsonb) || jsonb_build_object(
      'score', v_score, 'max_score', v_max, 'percentage', v_pct, 'passed', v_passed,
      'correct_count', (select count(*) from jsonb_array_elements(p_rows) x where x ->> 'status' = 'correct'),
      'incorrect_count', (select count(*) from jsonb_array_elements(p_rows) x where x ->> 'status' = 'incorrect'),
      'partial_count', (select count(*) from jsonb_array_elements(p_rows) x where x ->> 'status' = 'partial'),
      'skipped_count', (select count(*) from jsonb_array_elements(p_rows) x where x ->> 'status' = 'skipped'),
      'pending_count', (select count(*) from jsonb_array_elements(p_rows) x where x ->> 'status' = 'pending'),
      'pending_marks', (select coalesce(sum((x ->> 'points')::numeric), 0) from jsonb_array_elements(p_rows) x where x ->> 'status' = 'pending'),
      'provisional', exists (select 1 from jsonb_array_elements(p_rows) x where x ->> 'status' = 'pending'),
      'rank', v_rank,
      'total_attempts', v_cmp.n,
      'percentile', case when v_cmp.n > 1 then round(v_lower * 100.0 / (v_cmp.n - 1), 1) else 100 end,
      'class_average', coalesce(v_cmp.avg_pct, 0),
      'topper_percentage', coalesce(v_cmp.top_pct, 0)),
    'breakdowns', jsonb_build_object(
      'by_section', (select coalesce(jsonb_agg(b order by (b ->> 'position')::int, b ->> 'name'), '[]'::jsonb) from (
                       select jsonb_build_object('name', x ->> 'section', 'position', min((x ->> 'section_position')::int))
                              || public.adm_report_bucket(jsonb_agg(x)) as b
                         from jsonb_array_elements(p_rows) x group by x ->> 'section') s),
      'by_topic', (select coalesce(jsonb_agg(b order by b ->> 'name'), '[]'::jsonb) from (
                     select jsonb_build_object('name', x ->> 'topic') || public.adm_report_bucket(jsonb_agg(x)) as b
                       from jsonb_array_elements(p_rows) x group by x ->> 'topic') s),
      'by_difficulty', (select coalesce(jsonb_agg(b order by case b ->> 'name' when 'easy' then 1 when 'medium' then 2
                                                                                 when 'hard' then 3 else 4 end), '[]'::jsonb) from (
                          select jsonb_build_object('name', x ->> 'difficulty') || public.adm_report_bucket(jsonb_agg(x)) as b
                            from jsonb_array_elements(p_rows) x group by x ->> 'difficulty') s)),
    'comparison', coalesce(p_report -> 'comparison', '{}'::jsonb) || jsonb_build_object(
      'your_percentage', v_pct,
      'average_percentage', coalesce(v_cmp.avg_pct, 0),
      'topper_percentage', coalesce(v_cmp.top_pct, 0),
      'your_score', v_score,
      'average_score', coalesce(v_cmp.avg_score, 0),
      'topper_score', coalesce(v_cmp.top_score, 0),
      'difference_from_average', round(v_pct - coalesce(v_cmp.avg_pct, 0), 2),
      'difference_from_topper', round(v_pct - coalesce(v_cmp.top_pct, 0), 2)));

  return v_report || jsonb_build_object(
    'strengths', (select coalesce(jsonb_agg(jsonb_build_object('topic', t ->> 'name', 'accuracy', (t ->> 'accuracy')::numeric)
                                            order by (t ->> 'accuracy')::numeric desc, t ->> 'name'), '[]'::jsonb)
                    from (select t from jsonb_array_elements(v_report #> '{breakdowns,by_topic}') t
                           where (t ->> 'graded')::int > 0 and (t ->> 'accuracy')::numeric >= 60
                           order by (t ->> 'accuracy')::numeric desc, t ->> 'name' limit 3) s),
    'weaknesses', (select coalesce(jsonb_agg(jsonb_build_object('topic', t ->> 'name', 'accuracy', (t ->> 'accuracy')::numeric)
                                             order by (t ->> 'accuracy')::numeric, t ->> 'name'), '[]'::jsonb)
                     from (select t from jsonb_array_elements(v_report #> '{breakdowns,by_topic}') t
                            where (t ->> 'graded')::int > 0 and (t ->> 'accuracy')::numeric < 60
                            order by (t ->> 'accuracy')::numeric, t ->> 'name' limit 3) s));
end $$;

-- Written rows not yet marked by the teacher: 'pending' when there is a typed
-- answer or an upload, 'skipped' when there is neither. Written rows with
-- uploads carry upload_count. The report is untouched when there are no
-- uploads, and the score is recomputed only when a status changed.
create or replace function public.adm_written_sync_rows(p_attempt uuid, p_report jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_rows    jsonb := '[]'::jsonb;
  r         jsonb;
  v_qid     uuid;
  v_text    boolean;
  v_uploads int;
  v_want    text;
  v_changed boolean := false;
  v_status  boolean := false;
begin
  if p_report is null or jsonb_typeof(p_report -> 'questions') <> 'array' then return p_report; end if;
  for r in select x from jsonb_array_elements(p_report -> 'questions') x loop
    v_qid := (r ->> 'question_id')::uuid;
    if v_qid is not null and public.adm_question_is_subjective(v_qid) then
      select count(*) into v_uploads from public.answer_uploads u where u.attempt_id = p_attempt and u.question_id = v_qid;
      if v_uploads > 0 and coalesce((r ->> 'upload_count')::int, -1) <> v_uploads then
        r := r || jsonb_build_object('upload_count', v_uploads);
        v_changed := true;
      elsif v_uploads = 0 and r ? 'upload_count' then
        r := r - 'upload_count';
        v_changed := true;
      end if;
      if r ->> 'status' in ('pending', 'skipped') and not (r ? 'teacher_evaluation') then
        select exists (select 1 from public.quiz_answers ans
                        where ans.attempt_id = p_attempt and ans.question_id = v_qid
                          and nullif(btrim(coalesce(ans.answer_text, '')), '') is not null) into v_text;
        v_want := case when v_text or v_uploads > 0 then 'pending' else 'skipped' end;
        if v_want <> r ->> 'status' then
          r := r || jsonb_build_object('status', v_want,
                                       'points_earned', case when v_want = 'pending' then 'null'::jsonb else to_jsonb(0) end);
          update public.quiz_answers
             set is_correct = case when v_want = 'pending' then null else false end,
                 points_earned = case when v_want = 'pending' then null else 0 end
           where attempt_id = p_attempt and question_id = v_qid;
          v_changed := true;
          v_status := true;
        end if;
      end if;
    end if;
    v_rows := v_rows || jsonb_build_array(r);
  end loop;
  if not v_changed then return p_report; end if;
  if not v_status then return p_report || jsonb_build_object('questions', v_rows); end if;
  return public.adm_written_recompute(p_attempt, p_report, v_rows);
end $$;

-- After the report exists (uploads in the grace window, removals).
create or replace function public.adm_written_sync_report(p_attempt uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_report jsonb;
begin
  select report into v_report from public.attempt_reports where attempt_id = p_attempt for update;
  if v_report is null then return; end if;
  update public.attempt_reports set report = public.adm_written_sync_rows(p_attempt, v_report)
   where attempt_id = p_attempt;
end $$;

-- attempt_reports (ours): every new report, whichever path finalised the
-- attempt (submit, time up, proctor limit), gets the upload-aware statuses.
create or replace function public.adm_written_report_trigger() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  new.report := public.adm_written_sync_rows(new.attempt_id, new.report);
  return new;
end $$;
create trigger attempt_reports_written_answers
  before insert on public.attempt_reports
  for each row execute function public.adm_written_report_trigger();

-- adm_series_content_problem: from 20261028100300_educator_series_approval.sql
-- The publish checks without publishing: window, every test has questions,
-- every question has a correct answer, at least one test. Null when the
-- series can be published. 20261120090000: written questions are allowed.
create or replace function public.adm_series_content_problem(p_series uuid) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  s     public.test_series;
  v_msg text;
begin
  select * into s from public.test_series where id = p_series;
  if s.available_from is not null and s.available_until is not null and s.available_until <= s.available_from then
    return 'The closing time must be after the opening time.';
  end if;
  v_msg := public.adm_series_publish_problem(p_series);
  if v_msg is not null then return v_msg; end if;
  if not exists (select 1 from public.quizzes where series_id = p_series) then
    return 'Add at least one test before publishing.';
  end if;
  return null;   -- 20261120090000: the "coming soon" check for written questions is gone
end $$;

-- ----------------------------------------------------------------- student
-- Edge Function answer-uploads (action "upload"), with the student's JWT.
-- {allowed, error?, status?, retry_after_seconds?, student_id}
create or replace function public.student_answer_upload_slot(
  p_attempt_id uuid, p_question_id uuid, p_content_type text, p_size bigint
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := public.adm_student_writer_uid();
  v_problem text;
  v_recent  int;
begin
  v_problem := public.adm_answer_upload_problem(p_attempt_id, p_question_id, v_uid);
  if v_problem is not null then
    return jsonb_build_object('allowed', false, 'error', v_problem,
                              'status', case when v_problem = 'Attempt not found.' then 404 else 409 end);
  end if;
  if lower(coalesce(p_content_type, '')) not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    return jsonb_build_object('allowed', false, 'error', 'Upload a photo (JPG, PNG, WebP) or a PDF.', 'status', 400);
  end if;
  if coalesce(p_size, 0) <= 0 or p_size > 10485760 then
    return jsonb_build_object('allowed', false, 'error', 'Each file can be up to 10 MB.', 'status', 400);
  end if;
  if (select count(*) from public.answer_uploads u where u.attempt_id = p_attempt_id and u.question_id = p_question_id) >= 5 then
    return jsonb_build_object('allowed', false, 'error', 'You can upload up to 5 files for one answer. Remove one first.', 'status', 409);
  end if;
  select count(*) into v_recent from public.answer_upload_requests
   where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 60 then
    return jsonb_build_object('allowed', false, 'error', 'Too many uploads. Try again later.', 'status', 429,
                              'retry_after_seconds', 600);
  end if;
  insert into public.answer_upload_requests (user_id) values (v_uid);
  return jsonb_build_object('allowed', true, 'student_id', v_uid);
end $$;

create or replace function public.adm_answer_upload_json(p_attempt uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'question_id', u.question_id, 'file_name', u.file_name,
                                               'content_type', u.content_type, 'size_bytes', u.size_bytes,
                                               'created_at', u.created_at) order by u.created_at, u.id), '[]'::jsonb)
    from public.answer_uploads u where u.attempt_id = p_attempt;
$$;

-- After the PUT to the signed URL. Returns student_list_answer_uploads.
create or replace function public.student_register_answer_upload(
  p_attempt_id uuid, p_question_id uuid, p_path text, p_file_name text, p_content_type text, p_size bigint
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := public.adm_student_writer_uid();
  v_problem text;
  v_size    bigint;
  v_ext     text;
begin
  v_problem := public.adm_answer_upload_problem(p_attempt_id, p_question_id, v_uid);
  if v_problem = 'Attempt not found.' then raise exception '%', v_problem using errcode = 'P0002'; end if;
  if v_problem is not null then raise exception '%', v_problem using errcode = '22023'; end if;
  v_ext := case lower(coalesce(p_content_type, '')) when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
                when 'image/webp' then 'webp' when 'application/pdf' then 'pdf' end;
  if v_ext is null or coalesce(p_path, '') !~ ('^' || v_uid || '/' || p_attempt_id || '/' || p_question_id
                                                || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.' || v_ext || '$') then
    raise exception 'That upload doesn''t belong to this answer.' using errcode = '22023';
  end if;
  select coalesce((o.metadata ->> 'size')::bigint, p_size) into v_size
    from storage.objects o where o.bucket_id = 'answer-uploads' and o.name = p_path;
  if not found then
    raise exception 'The file didn''t arrive. Please upload it again.' using errcode = '22023';
  end if;
  if coalesce(v_size, 0) <= 0 or v_size > 10485760 then
    raise exception 'Each file can be up to 10 MB.' using errcode = '22023';
  end if;
  if (select count(*) from public.answer_uploads u where u.attempt_id = p_attempt_id and u.question_id = p_question_id) >= 5 then
    raise exception 'You can upload up to 5 files for one answer.' using errcode = '22023';
  end if;
  insert into public.answer_uploads (attempt_id, question_id, student_id, path, file_name, content_type, size_bytes)
  values (p_attempt_id, p_question_id, v_uid, p_path,
          coalesce(nullif(left(btrim(regexp_replace(coalesce(p_file_name, ''), '^.*[\\/]', '')), 120), ''), 'answer.' || v_ext),
          lower(p_content_type), v_size)
  on conflict (path) do nothing;
  perform public.adm_written_sync_report(p_attempt_id);   -- grace window: report already written
  return public.student_list_answer_uploads(p_attempt_id);
end $$;

create or replace function public.student_remove_answer_upload(p_upload_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := public.adm_student_writer_uid();
  u         public.answer_uploads%rowtype;
  v_problem text;
begin
  select * into u from public.answer_uploads where id = p_upload_id and student_id = v_uid;
  if u.id is null then raise exception 'File not found.' using errcode = 'P0002'; end if;
  v_problem := public.adm_answer_upload_problem(u.attempt_id, u.question_id, v_uid);
  if v_problem is not null then raise exception '%', v_problem using errcode = '22023'; end if;
  -- The stored object stays (private; nothing signs a URL for an unlisted path).
  delete from public.answer_uploads where id = u.id;
  perform public.adm_written_sync_report(u.attempt_id);
  return public.student_list_answer_uploads(u.attempt_id);
end $$;

create or replace function public.student_list_answer_uploads(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := public.adm_student_uid();
  v_close timestamptz;
begin
  if not exists (select 1 from public.quiz_attempts a where a.id = p_attempt_id and a.student_id = v_uid) then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  v_close := public.adm_answer_upload_window(p_attempt_id);
  return jsonb_build_object(
    'window_closes_at', case when v_close in ('infinity'::timestamptz, '-infinity'::timestamptz) then null else v_close end,
    'can_upload', now() <= v_close
                  and not exists (select 1 from public.written_evaluations e where e.attempt_id = p_attempt_id and e.status = 'published'),
    'server_now', now(),
    'max_files', 5,
    'max_bytes', 10485760,
    'uploads', public.adm_answer_upload_json(p_attempt_id));
end $$;

-- ------------------------------------------------------------------ graders
-- The attempt's test series, after checking the caller may mark it (an admin,
-- or the verified educator of that series). Only finished attempts.
create or replace function public.adm_require_attempt_grader(p_attempt uuid) returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_series uuid; v_status text;
begin
  select q.series_id, a.status into v_series, v_status
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id where a.id = p_attempt;
  if v_series is null then raise exception 'Attempt not found.' using errcode = 'P0002'; end if;
  if not public.adm_can_manage_series(v_series) then
    raise exception 'You can''t evaluate this test.' using errcode = '42501';
  end if;
  if v_status not in ('submitted', 'timed_out') then
    raise exception 'This attempt hasn''t been submitted yet.' using errcode = '22023';
  end if;
  return v_series;
end $$;

-- Educators mark without seeing who wrote the answers (a stable candidate
-- code per student and test); admins also see the name and email.
create or replace function public.adm_grading_candidate(p_student uuid, p_quiz uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('candidate', 'Candidate ' || upper(left(md5(p_student::text || ':' || p_quiz::text), 6)))
         || case when public.adm_is_platform_admin() then
              (select jsonb_build_object('student_name', p.full_name, 'student_email', p.email)
                 from public.profiles p where p.id = p_student)
            else '{}'::jsonb end;
$$;

-- Edge Function answer-uploads (action "view"), with the caller's JWT.
create or replace function public.adm_answer_upload_access(p_upload_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  u        public.answer_uploads%rowtype;
  v_series uuid;
begin
  select * into u from public.answer_uploads where id = p_upload_id;
  if u.id is null then raise exception 'File not found.' using errcode = 'P0002'; end if;
  if u.student_id is distinct from auth.uid() then
    select q.series_id into v_series from public.quizzes q join public.quiz_attempts a on a.quiz_id = q.id where a.id = u.attempt_id;
    if not public.adm_can_manage_series(v_series) then
      raise exception 'File not found.' using errcode = 'P0002';
    end if;
  end if;
  return jsonb_build_object('path', u.path, 'file_name', u.file_name, 'content_type', u.content_type);
end $$;

-- p_status: 'pending' (default: not yet published), 'draft', 'published', 'all'.
create or replace function public.grading_list_attempts(
  p_status text default 'pending', p_search text default null, p_series_id uuid default null,
  p_page int default 1, p_size int default 20
) returns table (row_data jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_like text := public.adm_like(p_search);
  v_size int  := least(greatest(coalesce(p_size, 20), 1), 100);
  v_page int  := greatest(coalesce(p_page, 1), 1);
begin
  if not (public.adm_is_platform_admin() or public.adm_is_verified_educator()) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  return query
  with base as (
    select a.id, a.quiz_id, a.student_id, a.attempt_number, a.submitted_at, q.title as test_title, q.series_id,
           s.title as series_title, rp.report, e.status as eval_status, e.published_at,
           (select count(*) from jsonb_array_elements(rp.report -> 'questions') x
             where x ->> 'type' = 'short_answer' or public.adm_is_subjective_type(x ->> 'ui_type')) as written,
           (select count(*) from jsonb_array_elements(rp.report -> 'questions') x
             where (x ->> 'type' = 'short_answer' or public.adm_is_subjective_type(x ->> 'ui_type'))
               and x ->> 'status' = 'pending') as pending,
           (select count(*) from public.answer_uploads u where u.attempt_id = a.id) as uploads
      from public.quiz_attempts a
      join public.attempt_reports rp on rp.attempt_id = a.id
      join public.quizzes q on q.id = a.quiz_id
      left join public.test_series s on s.id = q.series_id
      left join public.written_evaluations e on e.attempt_id = a.id
     where a.status in ('submitted', 'timed_out')
       and (p_series_id is null or q.series_id = p_series_id)
       and public.adm_can_manage_series(q.series_id)
  )
  select jsonb_build_object(
           'attempt_id', b.id, 'test_id', b.quiz_id, 'test_title', b.test_title,
           'series_id', b.series_id, 'series_title', b.series_title,
           'attempt_number', b.attempt_number, 'submitted_at', b.submitted_at,
           'written_count', b.written, 'pending_count', b.pending, 'upload_count', b.uploads,
           'evaluation_status', coalesce(b.eval_status, 'pending'), 'published_at', b.published_at,
           'upload_window_closes_at', public.adm_answer_upload_window(b.id))
         || public.adm_grading_candidate(b.student_id, b.quiz_id),
         count(*) over ()
    from base b
   where b.written > 0
     and (coalesce(p_status, 'pending') = 'all'
          or (p_status = 'pending' and coalesce(b.eval_status, 'pending') <> 'published')
          or (p_status = 'draft' and b.eval_status = 'draft')
          or (p_status = 'published' and b.eval_status = 'published'))
     and (v_like is null or (coalesce(b.test_title, '') || ' ' || coalesce(b.series_title, '')) ilike v_like)
   order by (coalesce(b.eval_status, 'pending') = 'published'), b.submitted_at asc nulls last
   limit v_size offset (v_page - 1) * v_size;
end $$;

create or replace function public.grading_get_attempt(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_series uuid := public.adm_require_attempt_grader(p_attempt_id);
  a        record;
  v_report jsonb;
  e        public.written_evaluations%rowtype;
begin
  select x.*, q.title as test_title, s.title as series_title
    into a
    from public.quiz_attempts x join public.quizzes q on q.id = x.quiz_id
    left join public.test_series s on s.id = q.series_id
   where x.id = p_attempt_id;
  select report into v_report from public.attempt_reports where attempt_id = p_attempt_id;
  select * into e from public.written_evaluations where attempt_id = p_attempt_id;
  return jsonb_build_object(
    'attempt', jsonb_build_object('id', a.id, 'test_id', a.quiz_id, 'test_title', a.test_title, 'series_id', v_series,
                                  'series_title', a.series_title, 'attempt_number', a.attempt_number,
                                  'submitted_at', a.submitted_at, 'status', a.status,
                                  'score', a.score, 'max_score', a.max_score, 'percentage', a.percentage,
                                  'total_marks', v_report #> '{summary,total_marks}')
               || public.adm_grading_candidate(a.student_id, a.quiz_id),
    'evaluation', jsonb_build_object('status', coalesce(e.status, 'pending'), 'overall_feedback', e.overall_feedback,
                                     'published_at', e.published_at, 'updated_at', e.updated_at,
                                     'graded_by_name', (select p.full_name from public.profiles p where p.id = e.graded_by)),
    'upload_window_closes_at', public.adm_answer_upload_window(p_attempt_id),
    'can_publish', now() > public.adm_answer_upload_window(p_attempt_id),
    'server_now', now(),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'question_id', qq.id,
               'position', (r ->> 'position')::int,
               'text', qq.question_text,
               'image_path', qa.image_path,
               'image_alt', qa.image_alt,
               'type', coalesce(qa.admin_type, qq.question_type),
               'max_marks', qq.points,
               'status', r ->> 'status',
               'marking_guide', nullif(btrim(coalesce(qa.answer_instructions, '')), ''),
               'model_answer', (select string_agg(o.option_text, ' / ' order by o.sort_order, o.id)
                                  from public.quiz_question_options o
                                 where o.question_id = qq.id and o.is_correct
                                   and o.option_text <> 'Manual grading: see rubric'),
               'typed_answer', (select ans.answer_text from public.quiz_answers ans
                                 where ans.attempt_id = p_attempt_id and ans.question_id = qq.id
                                 order by ans.created_at desc limit 1),
               'uploads', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'file_name', u.file_name,
                                                                        'content_type', u.content_type, 'size_bytes', u.size_bytes,
                                                                        'created_at', u.created_at) order by u.created_at, u.id), '[]'::jsonb)
                             from public.answer_uploads u where u.attempt_id = p_attempt_id and u.question_id = qq.id),
               'grade', (select jsonb_build_object('marks', g.marks, 'feedback', g.feedback, 'graded_at', g.graded_at)
                           from public.written_answer_grades g where g.attempt_id = p_attempt_id and g.question_id = qq.id))
             order by (r ->> 'position')::int)
        from jsonb_array_elements(v_report -> 'questions') r
        join public.quiz_questions qq on qq.id = (r ->> 'question_id')::uuid
        left join public.quiz_question_admin qa on qa.question_id = qq.id
       where public.adm_question_is_subjective(qq.id)), '[]'::jsonb),
    'objective', jsonb_build_object(
      'count', (select count(*) from jsonb_array_elements(v_report -> 'questions') r
                 where not public.adm_question_is_subjective((r ->> 'question_id')::uuid)),
      'marks_earned', (select coalesce(sum((r ->> 'points_earned')::numeric), 0) from jsonb_array_elements(v_report -> 'questions') r
                        where not public.adm_question_is_subjective((r ->> 'question_id')::uuid)),
      'marks_possible', (select coalesce(sum((r ->> 'points')::numeric), 0) from jsonb_array_elements(v_report -> 'questions') r
                          where not public.adm_question_is_subjective((r ->> 'question_id')::uuid))));
end $$;

-- p_grades = [{question_id, marks, feedback}]. Saves a draft; with p_publish
-- the marks go to the attempt, the report and the student.
create or replace function public.grading_save(
  p_attempt_id uuid, p_grades jsonb, p_overall_feedback text default null, p_publish boolean default false
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_series   uuid := public.adm_require_attempt_grader(p_attempt_id);
  g          jsonb;
  v_qid      uuid;
  v_max      numeric;
  v_marks    numeric;
  v_feedback text;
  v_overall  text := nullif(left(btrim(coalesce(p_overall_feedback, '')), 3000), '');
  v_report   jsonb;
  v_rows     jsonb := '[]'::jsonb;
  r          jsonb;
  gr         public.written_answer_grades%rowtype;
  v_state    text;
  v_missing  int;
  v_att      record;
  v_was      text;
begin
  select report into v_report from public.attempt_reports where attempt_id = p_attempt_id for update;
  if v_report is null then raise exception 'No report for this attempt.' using errcode = 'P0002'; end if;
  if jsonb_typeof(coalesce(p_grades, '[]'::jsonb)) <> 'array' then
    raise exception 'Send the marks as a list.' using errcode = '22023';
  end if;

  for g in select x from jsonb_array_elements(coalesce(p_grades, '[]'::jsonb)) x loop
    v_qid := nullif(g ->> 'question_id', '')::uuid;
    if v_qid is null or not public.adm_written_question(p_attempt_id, v_qid) then
      raise exception 'Marks can be given only for this test''s written questions.' using errcode = '22023';
    end if;
    select points into v_max from public.quiz_questions where id = v_qid;
    if g -> 'marks' is null or jsonb_typeof(g -> 'marks') = 'null' or nullif(g ->> 'marks', '') is null then
      delete from public.written_answer_grades where attempt_id = p_attempt_id and question_id = v_qid;   -- cleared
      continue;
    end if;
    begin
      v_marks := round((g ->> 'marks')::numeric, 2);
    exception when others then
      raise exception 'Marks must be a number.' using errcode = '22023';
    end;
    if v_marks < 0 or v_marks > v_max then
      raise exception 'Marks for a question must be between 0 and %.', v_max using errcode = '22023';
    end if;
    v_feedback := nullif(left(btrim(coalesce(g ->> 'feedback', '')), 3000), '');
    insert into public.written_answer_grades (attempt_id, question_id, marks, feedback, graded_by, graded_at)
    values (p_attempt_id, v_qid, v_marks, v_feedback, auth.uid(), now())
    on conflict (attempt_id, question_id) do update
      set marks = excluded.marks, feedback = excluded.feedback, graded_by = excluded.graded_by, graded_at = now();
  end loop;

  select status into v_was from public.written_evaluations where attempt_id = p_attempt_id;
  insert into public.written_evaluations (attempt_id, status, overall_feedback, graded_by, updated_at)
  values (p_attempt_id, 'draft', v_overall, auth.uid(), now())
  on conflict (attempt_id) do update
    set overall_feedback = excluded.overall_feedback, graded_by = excluded.graded_by, updated_at = now();

  if not coalesce(p_publish, false) then
    perform public.adm_audit('grading.draft', 'quiz_attempt', p_attempt_id, null,
                             jsonb_build_object('grades', jsonb_array_length(coalesce(p_grades, '[]'::jsonb))), null);
    return public.grading_get_attempt(p_attempt_id);
  end if;

  -- publish
  if now() <= public.adm_answer_upload_window(p_attempt_id) then
    raise exception 'The student can still upload answer sheets until %. Publish after that.',
      to_char(public.adm_answer_upload_window(p_attempt_id) at time zone 'Asia/Kolkata', 'HH24:MI "IST"') using errcode = '22023';
  end if;
  select count(*) into v_missing
    from jsonb_array_elements(v_report -> 'questions') x
   where public.adm_question_is_subjective((x ->> 'question_id')::uuid)
     and x ->> 'status' = 'pending'
     and not exists (select 1 from public.written_answer_grades wg
                      where wg.attempt_id = p_attempt_id and wg.question_id = (x ->> 'question_id')::uuid);
  if v_missing > 0 then
    raise exception 'Give marks for every answered question first (% left).', v_missing using errcode = '22023';
  end if;

  for r in select x from jsonb_array_elements(v_report -> 'questions') x order by (x ->> 'position')::int loop
    v_qid := (r ->> 'question_id')::uuid;
    gr := null;
    if public.adm_question_is_subjective(v_qid) then
      select * into gr from public.written_answer_grades where attempt_id = p_attempt_id and question_id = v_qid;
    end if;
    if gr.attempt_id is not null then
      v_max   := coalesce((r ->> 'points')::numeric, 0);
      v_marks := least(gr.marks, v_max);
      v_state := case when v_marks >= v_max and v_max > 0 then 'correct' when v_marks <= 0 then 'incorrect' else 'partial' end;
      r := r || jsonb_build_object(
        'status', v_state,
        'points_earned', v_marks,
        'teacher_evaluation', jsonb_build_object('marks_awarded', v_marks, 'feedback', gr.feedback, 'evaluated_at', now()));
      update public.quiz_answers
         set points_earned = v_marks, is_correct = (v_marks >= v_max and v_max > 0)
       where attempt_id = p_attempt_id and question_id = v_qid;
      if not found then
        insert into public.quiz_answers (attempt_id, question_id, is_correct, points_earned)
        values (p_attempt_id, v_qid, (v_marks >= v_max and v_max > 0), v_marks);
      end if;
    end if;
    v_rows := v_rows || jsonb_build_array(r);
  end loop;

  v_report := public.adm_written_recompute(p_attempt_id, v_report, v_rows)
              || jsonb_build_object('teacher', jsonb_build_object('status', 'published', 'overall_feedback', v_overall,
                                                                  'evaluated_at', now()));
  update public.attempt_reports set report = v_report where attempt_id = p_attempt_id;
  update public.written_evaluations set status = 'published', published_at = now() where attempt_id = p_attempt_id;

  select a.student_id, q.title into v_att from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id where a.id = p_attempt_id;
  insert into public.notifications (user_id, category, title, body, action_url, reference_type, reference_id)
  values (v_att.student_id, 'assessment_result',
          case when v_was = 'published' then 'Your marks were updated' else 'Your answers have been evaluated' end,
          format('Your teacher has marked your written answers for "%s". Open the report to see your score and feedback.', v_att.title),
          '/student/report/' || p_attempt_id, 'attempt_report', p_attempt_id);
  perform public.adm_audit('grading.publish', 'quiz_attempt', p_attempt_id, null,
                           jsonb_build_object('score', v_report #> '{summary,score}', 'max_score', v_report #> '{summary,max_score}'), null);
  return public.grading_get_attempt(p_attempt_id);
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_series_content_problem(uuid) from public, anon, authenticated;
revoke all on function public.adm_answer_upload_grace() from public, anon, authenticated;
revoke all on function public.adm_answer_upload_window(uuid) from public, anon, authenticated;
revoke all on function public.adm_written_question(uuid, uuid) from public, anon, authenticated;
revoke all on function public.adm_answer_upload_problem(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.adm_written_recompute(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.adm_written_sync_rows(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.adm_written_sync_report(uuid) from public, anon, authenticated;
revoke all on function public.adm_written_report_trigger() from public, anon, authenticated;
revoke all on function public.adm_answer_upload_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_require_attempt_grader(uuid) from public, anon, authenticated;
revoke all on function public.adm_grading_candidate(uuid, uuid) from public, anon, authenticated;
revoke all on function public.adm_answer_upload_access(uuid) from public, anon;
revoke all on function public.student_answer_upload_slot(uuid, uuid, text, bigint) from public, anon;
revoke all on function public.student_register_answer_upload(uuid, uuid, text, text, text, bigint) from public, anon;
revoke all on function public.student_remove_answer_upload(uuid) from public, anon;
revoke all on function public.student_list_answer_uploads(uuid) from public, anon;
revoke all on function public.grading_list_attempts(text, text, uuid, int, int) from public, anon;
revoke all on function public.grading_get_attempt(uuid) from public, anon;
revoke all on function public.grading_save(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.adm_answer_upload_access(uuid) to authenticated;
grant execute on function public.student_answer_upload_slot(uuid, uuid, text, bigint) to authenticated;
grant execute on function public.student_register_answer_upload(uuid, uuid, text, text, text, bigint) to authenticated;
grant execute on function public.student_remove_answer_upload(uuid) to authenticated;
grant execute on function public.student_list_answer_uploads(uuid) to authenticated;
grant execute on function public.grading_list_attempts(text, text, uuid, int, int) to authenticated;
grant execute on function public.grading_get_attempt(uuid) to authenticated;
grant execute on function public.grading_save(uuid, jsonb, text, boolean) to authenticated;

rollback;
