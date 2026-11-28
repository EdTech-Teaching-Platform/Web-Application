-- =====================================================================
-- 20261128090000_admin_answer_sheet_flow.sql
--
-- Answer sheets AFTER the test (QA 22 Nov, "Proposed Flow"; decisions: photos
-- or a PDF, typing stays, per-test window default 5 minutes, extra time,
-- none after a violation auto-submit). Needs 20261121090000.
--
--   During the test   no uploads (typed answers and MCQs as before)
--   Finish            the attempt is submitted as today (answers locked); if
--                     the test has written questions, the answer-sheet
--                     screen opens with a countdown of the test's
--                     answer_upload_minutes (default 5 now)
--   Answer sheet      one sheet for the whole attempt: a PDF or page photos,
--                     up to 10 files of 10 MB; files can be removed until the
--                     final Submit
--   Submit / time up  student_submit_answer_sheet closes the sheet for good;
--                     when the countdown ends the window closes by itself
--   Violations        a test auto-submitted for violations gets no window
--   Evaluator         grading_get_attempt.sheet: files with their times,
--                     removed files, submit time. Publishing is possible as
--                     soon as the sheet is submitted (or the window ends).
--
-- Also
--   * Report: an answer sheet counts for every written question (pending
--     instead of skipped when there's no typed text).
--   * Report: after the marks are published, a written question's model
--     answer and explanation are shown according to the test's "show answers"
--     setting using the FINAL pass / fail (they were fixed at submit time).
--   * Per-question uploads (20 Nov) are retired: adm_answer_upload_problem
--     refuses every request. Existing files stay readable for graders.
--   * quiz_admin.answer_upload_minutes: default 5; tests still on the old
--     default 15 are moved to 5.
--
-- New: answer_sheet_submissions (ours; RLS on, no grants),
--   adm_sheet_files_json, adm_sheet_problem, student_sheet_status,
--   student_sheet_upload_slot, student_register_sheet_upload,
--   student_remove_sheet_upload, student_submit_answer_sheet.
-- Replaced (copies marked "-- 20261128090000" or rewritten, see each):
--   adm_answer_upload_window, adm_answer_upload_problem, adm_written_sync_rows, adm_report_with_images, grading_get_attempt, grading_save.
-- Our tables changed: answer_uploads.question_id becomes nullable (sheet files),
-- quiz_admin.answer_upload_minutes default. No lead table, RLS or policy change.
-- The answer-uploads Edge Function must be redeployed (questionId optional).
--
-- ROLLBACK
--   scripts/rollback_20261128090000_admin_answer_sheet_flow.sql
-- =====================================================================
set search_path = public, extensions;

do $pre$
declare
  v_problems text[] := '{}';
  v_sig      text;
begin
  foreach v_sig in array array['public.adm_answer_upload_window(uuid)', 'public.adm_written_sync_report(uuid)',
                               'public.grading_get_attempt(uuid)', 'public.adm_report_with_images(jsonb,uuid)'] loop
    if to_regprocedure(v_sig) is null then v_problems := v_problems || format('missing %s', v_sig); end if;
  end loop;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'quiz_admin'
                  and column_name = 'answer_upload_minutes') then
    v_problems := v_problems || 'quiz_admin.answer_upload_minutes is missing (apply 20261121090000 first)'::text;
  end if;
  foreach v_sig in array array['adm_sheet_files_json', 'adm_sheet_problem', 'student_sheet_status', 'student_sheet_upload_slot',
                               'student_register_sheet_upload', 'student_remove_sheet_upload', 'student_submit_answer_sheet'] loop
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = v_sig) then
      v_problems := v_problems || format('function public.%s already exists', v_sig);
    end if;
  end loop;
  if to_regclass('public.answer_sheet_submissions') is not null then
    v_problems := v_problems || 'table public.answer_sheet_submissions already exists'::text;
  end if;
  if cardinality(v_problems) > 0 then raise exception 'Answer sheet flow preflight: %', array_to_string(v_problems, '; '); end if;
end $pre$;

alter table public.answer_uploads alter column question_id drop not null;
alter table public.quiz_admin alter column answer_upload_minutes set default 5;
update public.quiz_admin set answer_upload_minutes = 5 where answer_upload_minutes = 15;

-- ============================================================ new objects
create table public.answer_sheet_submissions (
  attempt_id    uuid primary key references public.quiz_attempts(id) on delete cascade,
  submitted_at  timestamptz not null default now(),
  file_count    int not null default 0
);
alter table public.answer_sheet_submissions enable row level security;   -- no policies: RPCs only
revoke all on table public.answer_sheet_submissions from public, anon, authenticated;

-- The attempt's sheet files (question_id null). p_removed: the removed ones (history).
create or replace function public.adm_sheet_files_json(p_attempt uuid, p_removed boolean) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'file_name', u.file_name, 'content_type', u.content_type,
                                               'size_bytes', u.size_bytes, 'created_at', u.created_at, 'removed_at', u.removed_at)
                            order by u.created_at, u.id), '[]'::jsonb)
    from public.answer_uploads u
   where u.attempt_id = p_attempt and u.question_id is null
     and (case when p_removed then u.removed_at is not null else u.removed_at is null end);
$$;

-- Why this student can't change the answer sheet now, or null.
create or replace function public.adm_sheet_problem(p_attempt uuid, p_student uuid) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare a record;
begin
  select x.id, x.student_id, x.status, x.quiz_id, rp.report #>> '{summary,auto_submit_reason}' as reason
    into a
    from public.quiz_attempts x left join public.attempt_reports rp on rp.attempt_id = x.id
   where x.id = p_attempt;
  if a.id is null or a.student_id is distinct from p_student then return 'Attempt not found.'; end if;
  if not exists (select 1 from public.quiz_questions qq where qq.quiz_id = a.quiz_id and public.adm_question_is_subjective(qq.id)) then
    return 'This test has no written questions.';
  end if;
  if a.status = 'in_progress' then return 'Finish the test first, then upload your answer sheet.'; end if;
  if a.reason = 'proctor_limit' then
    return 'This test was submitted automatically after too many violations, so an answer sheet can''t be added.';
  end if;
  if exists (select 1 from public.answer_sheet_submissions s where s.attempt_id = p_attempt) then
    return 'You''ve already submitted your answer sheet.';
  end if;
  if exists (select 1 from public.written_evaluations e where e.attempt_id = p_attempt and e.status = 'published') then
    return 'This test has already been evaluated.';
  end if;
  if now() > public.adm_answer_upload_window(p_attempt) then return 'The time to upload your answer sheet is over.'; end if;
  return null;
end $$;

-- Student: the answer-sheet screen.
create or replace function public.student_sheet_status(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid   uuid := public.adm_student_uid();
  a       record;
  v_close timestamptz;
  v_prob  text;
begin
  select x.id, x.status, x.quiz_id, x.submitted_at, rp.report #>> '{summary,auto_submit_reason}' as reason
    into a
    from public.quiz_attempts x left join public.attempt_reports rp on rp.attempt_id = x.id
   where x.id = p_attempt_id and x.student_id = v_uid;
  if a.id is null then raise exception 'Attempt not found.' using errcode = 'P0002'; end if;
  v_close := public.adm_answer_upload_window(p_attempt_id);
  v_prob := public.adm_sheet_problem(p_attempt_id, v_uid);
  return jsonb_build_object(
    'attempt_id', a.id,
    'test_id', a.quiz_id,
    'status', a.status,
    'has_written', exists (select 1 from public.quiz_questions qq where qq.quiz_id = a.quiz_id and public.adm_question_is_subjective(qq.id)),
    'grace_minutes', (select coalesce(qa.answer_upload_minutes, 5) from public.quiz_admin qa where qa.quiz_id = a.quiz_id),
    'submitted_at', a.submitted_at,
    'auto_submit_reason', a.reason,
    'window_closes_at', case when v_close in ('infinity'::timestamptz, '-infinity'::timestamptz) then null else v_close end,
    'server_now', now(),
    'can_upload', v_prob is null,
    'problem', v_prob,
    'sheet_submitted_at', (select s.submitted_at from public.answer_sheet_submissions s where s.attempt_id = p_attempt_id),
    'max_files', 10,
    'max_bytes', 10485760,
    'uploads', public.adm_sheet_files_json(p_attempt_id, false));
end $$;

-- Edge Function answer-uploads (action "upload", no questionId), with the student's JWT.
create or replace function public.student_sheet_upload_slot(p_attempt_id uuid, p_content_type text, p_size bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := public.adm_student_writer_uid();
  v_problem text := public.adm_sheet_problem(p_attempt_id, public.adm_student_writer_uid());
  v_recent  int;
begin
  if v_problem is not null then
    return jsonb_build_object('allowed', false, 'error', v_problem, 'status', case when v_problem = 'Attempt not found.' then 404 else 409 end);
  end if;
  if lower(coalesce(p_content_type, '')) not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    return jsonb_build_object('allowed', false, 'error', 'Upload a PDF or photos (JPG, PNG, WebP).', 'status', 400);
  end if;
  if coalesce(p_size, 0) <= 0 or p_size > 10485760 then
    return jsonb_build_object('allowed', false, 'error', 'Each file can be up to 10 MB.', 'status', 400);
  end if;
  if (select count(*) from public.answer_uploads u where u.attempt_id = p_attempt_id and u.question_id is null and u.removed_at is null) >= 10 then
    return jsonb_build_object('allowed', false, 'error', 'An answer sheet can have up to 10 files. Remove one first.', 'status', 409);
  end if;
  select count(*) into v_recent from public.answer_upload_requests where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= 60 then
    return jsonb_build_object('allowed', false, 'error', 'Too many uploads. Try again later.', 'status', 429, 'retry_after_seconds', 600);
  end if;
  insert into public.answer_upload_requests (user_id) values (v_uid);
  return jsonb_build_object('allowed', true, 'student_id', v_uid);
end $$;

-- After the PUT. Returns student_sheet_status.
create or replace function public.student_register_sheet_upload(
  p_attempt_id uuid, p_path text, p_file_name text, p_content_type text, p_size bigint
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := public.adm_student_writer_uid();
  v_problem text;
  v_size    bigint;
  v_ext     text;
begin
  v_problem := public.adm_sheet_problem(p_attempt_id, v_uid);
  if v_problem = 'Attempt not found.' then raise exception '%', v_problem using errcode = 'P0002'; end if;
  if v_problem is not null then raise exception '%', v_problem using errcode = '22023'; end if;
  v_ext := case lower(coalesce(p_content_type, '')) when 'image/jpeg' then 'jpg' when 'image/png' then 'png'
                when 'image/webp' then 'webp' when 'application/pdf' then 'pdf' end;
  if v_ext is null or coalesce(p_path, '') !~ ('^' || v_uid || '/' || p_attempt_id
                                                || '/sheet/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.' || v_ext || '$') then
    raise exception 'That upload doesn''t belong to this answer sheet.' using errcode = '22023';
  end if;
  select coalesce((o.metadata ->> 'size')::bigint, p_size) into v_size
    from storage.objects o where o.bucket_id = 'answer-uploads' and o.name = p_path;
  if not found then raise exception 'The file didn''t arrive. Please upload it again.' using errcode = '22023'; end if;
  if coalesce(v_size, 0) <= 0 or v_size > 10485760 then raise exception 'Each file can be up to 10 MB.' using errcode = '22023'; end if;
  if (select count(*) from public.answer_uploads u where u.attempt_id = p_attempt_id and u.question_id is null and u.removed_at is null) >= 10 then
    raise exception 'An answer sheet can have up to 10 files.' using errcode = '22023';
  end if;
  insert into public.answer_uploads (attempt_id, question_id, student_id, path, file_name, content_type, size_bytes)
  values (p_attempt_id, null, v_uid, p_path,
          coalesce(nullif(left(btrim(regexp_replace(coalesce(p_file_name, ''), '^.*[\\/]', '')), 120), ''), 'answer-sheet.' || v_ext),
          lower(p_content_type), v_size)
  on conflict (path) do nothing;
  perform public.adm_written_sync_report(p_attempt_id);
  return public.student_sheet_status(p_attempt_id);
end $$;

-- While the window is open and before the final Submit.
create or replace function public.student_remove_sheet_upload(p_upload_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := public.adm_student_writer_uid();
  u         public.answer_uploads%rowtype;
  v_problem text;
begin
  select * into u from public.answer_uploads where id = p_upload_id and student_id = v_uid and question_id is null and removed_at is null;
  if u.id is null then raise exception 'File not found.' using errcode = 'P0002'; end if;
  v_problem := public.adm_sheet_problem(u.attempt_id, v_uid);
  if v_problem is not null then raise exception '%', v_problem using errcode = '22023'; end if;
  update public.answer_uploads set removed_at = now() where id = u.id;   -- kept for the teacher's history
  perform public.adm_written_sync_report(u.attempt_id);
  return public.student_sheet_status(u.attempt_id);
end $$;

-- The final Submit: the sheet is closed for good (idempotent). Also called by
-- the answer-sheet screen when its countdown ends.
create or replace function public.student_submit_answer_sheet(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := public.adm_student_writer_uid();
  a     record;
begin
  select x.id, x.status into a from public.quiz_attempts x where x.id = p_attempt_id and x.student_id = v_uid;
  if a.id is null then raise exception 'Attempt not found.' using errcode = 'P0002'; end if;
  if a.status = 'in_progress' then raise exception 'Finish the test first.' using errcode = '22023'; end if;
  insert into public.answer_sheet_submissions (attempt_id, submitted_at, file_count)
  values (p_attempt_id, least(now(), public.adm_answer_upload_window(p_attempt_id)),
          (select count(*) from public.answer_uploads u where u.attempt_id = p_attempt_id and u.question_id is null and u.removed_at is null))
  on conflict (attempt_id) do nothing;
  perform public.adm_written_sync_report(p_attempt_id);
  return public.student_sheet_status(p_attempt_id);
end $$;

-- adm_answer_upload_window: REWRITTEN (replaces the version in 20261121090000_admin_written_answers_fixes.sql)
create or replace function public.adm_answer_upload_window(p_attempt uuid) returns timestamptz
language sql stable security definer set search_path = public, extensions as $$
  -- The answer-sheet window comes AFTER the test (QA 22 Nov proposed flow):
  -- none while the test is running; from the moment the attempt ends, the
  -- test's answer_upload_minutes (default 5); closed at once by the student's
  -- final Submit (answer_sheet_submissions), and never opened for a test
  -- auto-submitted for violations or one with no written questions.
  select case
           when a.status not in ('submitted', 'timed_out') then '-infinity'::timestamptz
           when coalesce(rp.report #>> '{summary,auto_submit_reason}', '') = 'proctor_limit'
                or not exists (select 1 from public.quiz_questions qq
                                where qq.quiz_id = a.quiz_id and public.adm_question_is_subjective(qq.id))
             then coalesce(a.submitted_at, a.started_at)
           else least(coalesce(a.submitted_at, a.started_at) + make_interval(mins => coalesce(qa.answer_upload_minutes, 5)),
                      coalesce(sub.submitted_at, 'infinity'::timestamptz))
         end
    from public.quiz_attempts a
    left join public.quiz_admin qa on qa.quiz_id = a.quiz_id
    left join public.attempt_reports rp on rp.attempt_id = a.id
    left join public.answer_sheet_submissions sub on sub.attempt_id = a.id
   where a.id = p_attempt;
$$;

-- adm_answer_upload_problem: REWRITTEN (replaces the version in 20261120090000_admin_written_answers.sql)
create or replace function public.adm_answer_upload_problem(p_attempt uuid, p_question uuid, p_student uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  -- 20261128090000: per-question uploads are retired. Answer sheets are uploaded
  -- once, after finishing the test (student_sheet_upload_slot).
  select 'Upload your answer sheet after you finish the test, on the answer-sheet screen.'::text;
$$;

-- adm_written_sync_rows: from 20261121090000_admin_written_answers_fixes.sql
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
      select count(*) into v_uploads from public.answer_uploads u
       where u.attempt_id = p_attempt and (u.question_id = v_qid or u.question_id is null)   /* 20261128090000: the attempt's answer sheet counts for every written question */
         and u.removed_at is null /* 20261121090000: removed files don't count */;
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

-- adm_report_with_images: from 20261121090000_admin_written_answers_fixes.sql
create or replace function public.adm_report_with_images(p_report jsonb, p_attempt uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select case when p_report is null or jsonb_typeof(p_report) <> 'object' then p_report else
    (case when jsonb_typeof(p_report -> 'questions') = 'array' then
       jsonb_set(p_report, '{questions}', coalesce((
         select jsonb_agg(case when jsonb_typeof(e.r) = 'object'
                               then e.r || jsonb_build_object('image_path', qa.image_path, 'image_alt', qa.image_alt)
                                    || case when hide.v and qa.question_id is not null and public.adm_question_is_subjective(qa.question_id)
                                                 and not (e.r ? 'teacher_evaluation') and not (e.r ? 'ai_evaluation')
                                            then jsonb_build_object('correct_answer', null, 'explanation', null, 'model_answer_pending', true)
                                            -- 20261128090000: after publishing, the model answer by the test's rule with the FINAL result
                                            when not hide.v and qa.question_id is not null and public.adm_question_is_subjective(qa.question_id)
                                            then case when rule.reveal
                                                      then jsonb_build_object('correct_answer', (select string_agg(o.option_text, ' / ' order by o.sort_order, o.id)
                                                                                                   from public.quiz_question_options o
                                                                                                  where o.question_id = qa.question_id and o.is_correct
                                                                                                    and o.option_text <> 'Manual grading: see rubric'),
                                                                              'explanation', (select qq.explanation from public.quiz_questions qq where qq.id = qa.question_id))
                                                      else jsonb_build_object('correct_answer', null, 'explanation', null) end
                                            else '{}'::jsonb end   -- 20261121090000: no model answer before the teacher's marks
                               else e.r end order by e.ord)
           from jsonb_array_elements(p_report -> 'questions') with ordinality as e(r, ord)
           left join public.quiz_question_admin qa
             on qa.question_id::text = case when jsonb_typeof(e.r) = 'object' then e.r ->> 'question_id' end
           cross join (select not exists (select 1 from public.written_evaluations we
                                           where we.attempt_id = p_attempt and we.status = 'published') as v) hide
           cross join (select coalesce((select case coalesce(q.show_answers_after, 'submission')
                                                 when 'never' then false when 'passing' then coalesce(a.passed, false) else true end
                                          from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                                         where a.id = p_attempt), true) as reveal) rule   -- 20261128090000
           ), '[]'::jsonb))   -- 20261121090000
     else p_report end)
    || jsonb_build_object('series_cover_path', (
         select sa.cover_path from public.quiz_attempts a
           join public.quizzes q on q.id = a.quiz_id
           join public.test_series_admin sa on sa.series_id = q.series_id
          where a.id = p_attempt))
  end;
$$;

-- grading_get_attempt: from 20261121090000_admin_written_answers_fixes.sql
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
    'can_publish', now() >= public.adm_answer_upload_window(p_attempt_id),   -- 20261128090000: closed from the moment the sheet is submitted
    'upload_window_minutes', (select coalesce(qa.answer_upload_minutes, 5) from public.quiz_admin qa where qa.quiz_id = a.quiz_id),   -- 20261121090000 20261128090000: default 5
    'sheet', jsonb_build_object(   -- 20261128090000: the attempt's answer sheet (photos / PDF), uploaded after the test
      'files', public.adm_sheet_files_json(p_attempt_id, false),
      'removed', public.adm_sheet_files_json(p_attempt_id, true),
      'submitted_at', (select s.submitted_at from public.answer_sheet_submissions s where s.attempt_id = p_attempt_id),
      'auto_submit_reason', v_report #>> '{summary,auto_submit_reason}'),
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
                                                                        'created_at', u.created_at,
                                                                        'after_submission', a.submitted_at is not null and u.created_at > a.submitted_at)   -- 20261121090000
                                                     order by u.created_at, u.id), '[]'::jsonb)
                             from public.answer_uploads u where u.attempt_id = p_attempt_id and u.question_id = qq.id and u.removed_at is null),
               'removed_uploads', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'file_name', u.file_name,
                                                                                'content_type', u.content_type, 'size_bytes', u.size_bytes,
                                                                                'created_at', u.created_at, 'removed_at', u.removed_at)
                                                             order by u.removed_at, u.id), '[]'::jsonb)
                                     from public.answer_uploads u
                                    where u.attempt_id = p_attempt_id and u.question_id = qq.id and u.removed_at is not null),   -- 20261121090000: history
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

-- grading_save: from 20261120090000_admin_written_answers.sql
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
  if now() < public.adm_answer_upload_window(p_attempt_id) then   -- 20261128090000: closed from the moment the sheet is submitted
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
revoke all on function public.adm_sheet_files_json(uuid, boolean) from public, anon, authenticated;
revoke all on function public.adm_sheet_problem(uuid, uuid) from public, anon, authenticated;
revoke all on function public.adm_answer_upload_window(uuid) from public, anon, authenticated;
revoke all on function public.adm_answer_upload_problem(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.adm_written_sync_rows(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.adm_report_with_images(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.grading_get_attempt(uuid) from public, anon;
revoke all on function public.grading_save(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.grading_save(uuid, jsonb, text, boolean) to authenticated;
revoke all on function public.student_sheet_status(uuid) from public, anon;
revoke all on function public.student_sheet_upload_slot(uuid, text, bigint) from public, anon;
revoke all on function public.student_register_sheet_upload(uuid, text, text, text, bigint) from public, anon;
revoke all on function public.student_remove_sheet_upload(uuid) from public, anon;
revoke all on function public.student_submit_answer_sheet(uuid) from public, anon;
grant execute on function public.grading_get_attempt(uuid) to authenticated;
grant execute on function public.student_sheet_status(uuid) to authenticated;
grant execute on function public.student_sheet_upload_slot(uuid, text, bigint) to authenticated;
grant execute on function public.student_register_sheet_upload(uuid, text, text, text, bigint) to authenticated;
grant execute on function public.student_remove_sheet_upload(uuid) to authenticated;
grant execute on function public.student_submit_answer_sheet(uuid) to authenticated;
