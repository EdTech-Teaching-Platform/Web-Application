-- Trial for supabase/migrations/20261121090000_admin_written_answers_fixes.sql ONLY (needs 20261120090000 applied).
-- Paste all of it into the SQL editor and run: expect "Success. No rows returned".
-- Everything is rolled back (the last line of this file is "rollback;").
begin;

-- =====================================================================
-- 20261121090000_admin_written_answers_fixes.sql
--
-- QA reports of 21 Nov on written answers (needs 20261120090000).
--
-- 1. Model answer shown before the teacher's marks
--    adm_report_with_images (every student report goes through it) hides
--    correct_answer and explanation of written questions until the attempt's
--    marks are published (written_evaluations.status = 'published'), and sets
--    model_answer_pending. After publishing, the test's own "show answers"
--    setting applies, as before. Graders still see the model answer.
-- 3. Answer sheets removed or swapped after submitting, with no history
--    * Removing works only while the test is open (not after submitting, not
--      after the deadline). After submitting, pages can only be ADDED within
--      the upload window.
--    * answer_uploads.removed_at: a removed file is kept and marked, not
--      deleted. It no longer counts and the student no longer sees it, but the
--      teacher sees it in grading_get_attempt.removed_uploads (time uploaded,
--      time removed), and each current file says whether it came after
--      submitting (after_submission).
-- 4. The upload window wasn't configurable
--    * quiz_admin.answer_upload_minutes (ours; default 15, 0..120): set per
--      test (answerUploadMinutes in create_test / update_test / the wizard,
--      through adm_apply_test_fields), returned by adm_test_json.
--    * The rule, the same for every student: uploads close N minutes after
--      that student submits (or after the deadline while the attempt is still
--      open). 0 = only during the test. Student and teacher screens read the
--      same adm_answer_upload_window, so they show the same time.
--    * student_list_answer_uploads adds grace_minutes, can_remove,
--      submitted_at; grading_get_attempt adds upload_window_minutes.
-- (2. "View" opening a new tab during the test is a frontend fix.)
--
-- Replaced (each edit marked "-- 20261121090000", the rest verbatim from the file named
-- above it): adm_report_with_images, adm_answer_upload_window, adm_written_sync_rows, student_answer_upload_slot, adm_answer_upload_json, student_register_answer_upload, student_remove_answer_upload, student_list_answer_uploads, adm_answer_upload_access, grading_list_attempts, grading_get_attempt, adm_apply_test_fields, adm_test_json.
--
-- Lead objects: none changed. Our tables: quiz_admin (new column),
-- answer_uploads (new column).
--
-- ROLLBACK
--   scripts/rollback_20261121090000_admin_written_answers_fixes.sql
-- =====================================================================
set search_path = public, extensions;

-- --------------------------------------------------------------- preflight
do $pre$
declare
  v_problems text[] := '{}';
  v_sig      text;
begin
  foreach v_sig in array array[
    'public.adm_answer_upload_window(uuid)', 'public.grading_get_attempt(uuid)', 'public.adm_report_with_images(jsonb,uuid)',
    'public.adm_apply_test_fields(uuid,jsonb)', 'public.adm_test_json(uuid)', 'public.adm_question_is_subjective(uuid)']
  loop
    if to_regprocedure(v_sig) is null then
      v_problems := v_problems || format('missing %s (apply 20261120090000 first)', v_sig);
    end if;
  end loop;
  if to_regclass('public.answer_uploads') is null or to_regclass('public.written_evaluations') is null then
    v_problems := v_problems || 'missing the 20261120090000 tables'::text;
  end if;
  if cardinality(v_problems) > 0 then
    raise exception 'Written answers fixes preflight: %', array_to_string(v_problems, '; ');
  end if;
end $pre$;

-- ------------------------------------------------------------- columns
alter table public.quiz_admin add column if not exists answer_upload_minutes int not null default 15
  check (answer_upload_minutes between 0 and 120);
alter table public.answer_uploads add column if not exists removed_at timestamptz;

-- adm_report_with_images: from 20261029110000_admin_test_assets.sql
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
                                            else '{}'::jsonb end   -- 20261121090000: no model answer before the teacher's marks
                               else e.r end order by e.ord)
           from jsonb_array_elements(p_report -> 'questions') with ordinality as e(r, ord)
           left join public.quiz_question_admin qa
             on qa.question_id::text = case when jsonb_typeof(e.r) = 'object' then e.r ->> 'question_id' end
           cross join (select not exists (select 1 from public.written_evaluations we
                                           where we.attempt_id = p_attempt and we.status = 'published') as v) hide), '[]'::jsonb))   -- 20261121090000
     else p_report end)
    || jsonb_build_object('series_cover_path', (
         select sa.cover_path from public.quiz_attempts a
           join public.quizzes q on q.id = a.quiz_id
           join public.test_series_admin sa on sa.series_id = q.series_id
          where a.id = p_attempt))
  end;
$$;

-- adm_answer_upload_window: from 20261120090000_admin_written_answers.sql
-- Uploads close N minutes (the test's answer_upload_minutes, default 15) after the deadline while open, after submitting otherwise.
create or replace function public.adm_answer_upload_window(p_attempt uuid) returns timestamptz
language sql stable security definer set search_path = public, extensions as $$
  select case
           when a.status = 'in_progress' then
             coalesce(public.adm_attempt_deadline(a.started_at, q.time_limit_mins) + make_interval(mins => coalesce(qa.answer_upload_minutes, 15)), 'infinity'::timestamptz)   -- 20261121090000
           when a.status in ('submitted', 'timed_out') then
             coalesce(a.submitted_at, a.started_at) + make_interval(mins => coalesce(qa.answer_upload_minutes, 15))   -- 20261121090000: the test's setting
           else '-infinity'::timestamptz end
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
    left join public.quiz_admin qa on qa.quiz_id = q.id   -- 20261121090000
   where a.id = p_attempt;
$$;

-- adm_written_sync_rows: from 20261120090000_admin_written_answers.sql
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
      select count(*) into v_uploads from public.answer_uploads u where u.attempt_id = p_attempt and u.question_id = v_qid
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

-- student_answer_upload_slot: from 20261120090000_admin_written_answers.sql
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
  if (select count(*) from public.answer_uploads u where u.attempt_id = p_attempt_id and u.question_id = p_question_id
        and u.removed_at is null /* 20261121090000: removed files don't count */) >= 5 then
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

-- adm_answer_upload_json: from 20261120090000_admin_written_answers.sql
create or replace function public.adm_answer_upload_json(p_attempt uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'question_id', u.question_id, 'file_name', u.file_name,
                                               'content_type', u.content_type, 'size_bytes', u.size_bytes,
                                               'created_at', u.created_at) order by u.created_at, u.id), '[]'::jsonb)
    from public.answer_uploads u where u.attempt_id = p_attempt and u.removed_at is null /* 20261121090000: removed files don't count */;
$$;

-- student_register_answer_upload: from 20261120090000_admin_written_answers.sql
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
  if (select count(*) from public.answer_uploads u where u.attempt_id = p_attempt_id and u.question_id = p_question_id
        and u.removed_at is null /* 20261121090000: removed files don't count */) >= 5 then
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

-- student_remove_answer_upload: from 20261120090000_admin_written_answers.sql
create or replace function public.student_remove_answer_upload(p_upload_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid     uuid := public.adm_student_writer_uid();
  u         public.answer_uploads%rowtype;
  v_problem text;
begin
  select * into u from public.answer_uploads where id = p_upload_id and student_id = v_uid and removed_at is null;   -- 20261121090000
  if u.id is null then raise exception 'File not found.' using errcode = 'P0002'; end if;
  v_problem := public.adm_answer_upload_problem(u.attempt_id, u.question_id, v_uid);
  if v_problem is not null then raise exception '%', v_problem using errcode = '22023'; end if;
  -- 20261121090000: only while the test is still open. After submitting, pages can be
  -- added (within the window) but never removed or swapped.
  if not exists (select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                  where a.id = u.attempt_id and a.status = 'in_progress'
                    and coalesce(public.adm_attempt_deadline(a.started_at, q.time_limit_mins), 'infinity'::timestamptz) > now()) then
    raise exception 'After submitting, answer sheets can''t be removed. You can still add pages until the upload time ends.' using errcode = '22023';
  end if;
  -- 20261121090000: kept as removed (the teacher sees the history); the stored object stays private.
  update public.answer_uploads set removed_at = now() where id = u.id;
  perform public.adm_written_sync_report(u.attempt_id);
  return public.student_list_answer_uploads(u.attempt_id);
end $$;

-- student_list_answer_uploads: from 20261120090000_admin_written_answers.sql
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
    'grace_minutes', (select coalesce(qa.answer_upload_minutes, 15) from public.quiz_attempts a
                        left join public.quiz_admin qa on qa.quiz_id = a.quiz_id where a.id = p_attempt_id),   -- 20261121090000
    'can_remove', exists (select 1 from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                           where a.id = p_attempt_id and a.status = 'in_progress'
                             and coalesce(public.adm_attempt_deadline(a.started_at, q.time_limit_mins), 'infinity'::timestamptz) > now()),   -- 20261121090000
    'submitted_at', (select a.submitted_at from public.quiz_attempts a where a.id = p_attempt_id),   -- 20261121090000
    'max_bytes', 10485760,
    'uploads', public.adm_answer_upload_json(p_attempt_id));
end $$;

-- adm_answer_upload_access: from 20261120090000_admin_written_answers.sql
create or replace function public.adm_answer_upload_access(p_upload_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  u        public.answer_uploads%rowtype;
  v_series uuid;
begin
  select * into u from public.answer_uploads where id = p_upload_id;
  if u.id is null then raise exception 'File not found.' using errcode = 'P0002'; end if;
  if u.student_id = auth.uid() and u.removed_at is not null then   -- 20261121090000: the student only sees current files
    raise exception 'File not found.' using errcode = 'P0002';
  end if;
  if u.student_id is distinct from auth.uid() then
    select q.series_id into v_series from public.quizzes q join public.quiz_attempts a on a.quiz_id = q.id where a.id = u.attempt_id;
    if not public.adm_can_manage_series(v_series) then
      raise exception 'File not found.' using errcode = 'P0002';
    end if;
  end if;
  return jsonb_build_object('path', u.path, 'file_name', u.file_name, 'content_type', u.content_type);
end $$;

-- grading_list_attempts: from 20261120090000_admin_written_answers.sql
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
           (select count(*) from public.answer_uploads u where u.attempt_id = a.id and u.removed_at is null) as uploads   -- 20261121090000
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

-- grading_get_attempt: from 20261120090000_admin_written_answers.sql
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
    'upload_window_minutes', (select coalesce(qa.answer_upload_minutes, 15) from public.quiz_admin qa where qa.quiz_id = a.quiz_id),   -- 20261121090000
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

-- adm_apply_test_fields: from 20261025110400_admin_b2_authoring_helpers.sql
create or replace function public.adm_apply_test_fields(p_quiz uuid, p jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_total      numeric := case when p ? 'totalMarks' then nullif(p ->> 'totalMarks', '')::numeric end;
  v_pass_marks numeric := case when p ? 'passingMarks' then nullif(p ->> 'passingMarks', '')::numeric end;
  v_pass_pct   numeric;
  v_win        jsonb := case when jsonb_typeof(p -> 'window') = 'object' then p -> 'window' end;
  v_show       text  := nullif(btrim(coalesce(p ->> 'showAnswersAfter', '')), '');
begin
  if p ? 'name' and nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Test name is required.' using errcode = '22023';
  end if;
  if v_show is not null and v_show not in ('submission', 'passing', 'never') then
    raise exception 'Unknown show-answers setting: %', v_show using errcode = '22023';
  end if;
  v_pass_pct := case
    when nullif(p ->> 'passingPercent', '') is not null then (p ->> 'passingPercent')::numeric
    when v_pass_marks is not null and coalesce(v_total, 0) > 0 then round(v_pass_marks / v_total * 100, 2)
  end;

  update public.quizzes set
    title             = case when p ? 'name' then left(btrim(p ->> 'name'), 200) else title end,
    description       = case when p ? 'instructions' then nullif(p ->> 'instructions', '') else description end,
    time_limit_mins   = case when p ? 'duration' then nullif(round(nullif(p ->> 'duration', '')::numeric)::int, 0) else time_limit_mins end,
    max_attempts      = case when p ? 'attemptLimit' then greatest(coalesce(round(nullif(p ->> 'attemptLimit', '')::numeric)::int, 1), 1) else max_attempts end,
    passing_score     = coalesce(least(greatest(v_pass_pct, 0), 100), passing_score),
    shuffle_questions = case when p ? 'shuffleQuestions' then coalesce((p ->> 'shuffleQuestions')::boolean, false) else shuffle_questions end,
    series_sort_order = case when nullif(p ->> 'position', '') is not null then round((p ->> 'position')::numeric)::int else series_sort_order end,
    show_answers_after = coalesce(v_show, show_answers_after),
    updated_at        = now()
  where id = p_quiz;

  insert into public.quiz_admin (quiz_id) values (p_quiz) on conflict (quiz_id) do nothing;
  update public.quiz_admin set
    total_marks_planned = case when p ? 'totalMarks' then v_total else total_marks_planned end,
    passing_marks       = case when p ? 'passingMarks' then v_pass_marks else passing_marks end,
    shuffle_options     = case when p ? 'shuffleOptions' then coalesce((p ->> 'shuffleOptions')::boolean, false) else shuffle_options end,
    scheduled_at        = case when p ? 'scheduledAt' then nullif(p ->> 'scheduledAt', '')::timestamptz else scheduled_at end,
    window_mode         = case when v_win is not null then coalesce(nullif(v_win ->> 'mode', ''), 'inherit') else window_mode end,
    open_at             = case when v_win is not null then case when v_win ->> 'mode' = 'custom' then nullif(v_win ->> 'openAt', '')::timestamptz end else open_at end,
    close_at            = case when v_win is not null then case when v_win ->> 'mode' = 'custom' then nullif(v_win ->> 'closeAt', '')::timestamptz end else close_at end,
    planned_questions   = case when p ? 'plannedQuestions' then coalesce(round(nullif(p ->> 'plannedQuestions', '')::numeric)::int, 0) else planned_questions end,
    answer_upload_minutes = case when p ? 'answerUploadMinutes'   -- 20261121090000: 0..120, default 15
                                 then least(greatest(coalesce(round(nullif(p ->> 'answerUploadMinutes', '')::numeric)::int, 15), 0), 120)
                                 else answer_upload_minutes end,
    topics              = case when jsonb_typeof(p -> 'topics') = 'array'
                               then coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(p -> 'topics') x where btrim(x) <> ''), '{}')
                               else topics end
  where quiz_id = p_quiz;
end $$;

-- adm_test_json: from 20261111090000_admin_qa_nov11.sql
create or replace function public.adm_test_json(p_quiz uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', q.id, 'series_id', q.series_id, 'position', q.series_sort_order, 'title', q.title,
           'instructions', q.description, 'duration_minutes', coalesce(q.time_limit_mins, 60),
           'total_marks', coalesce(nullif(m.marks_sum, 0), qa.total_marks_planned, 0),
           'total_marks_planned', qa.total_marks_planned, 'marks_sum', m.marks_sum,   -- 20261111090000
           'passing_percent', q.passing_score, 'passing_marks', qa.passing_marks,
           'attempt_limit', q.max_attempts, 'scheduled_at', qa.scheduled_at,
           'answer_upload_minutes', coalesce(qa.answer_upload_minutes, 15),   -- 20261121090000
           'shuffle_questions', q.shuffle_questions, 'shuffle_options', coalesce(qa.shuffle_options, false),
           'show_answers_after', q.show_answers_after,
           'window_mode', coalesce(qa.window_mode, 'inherit'), 'open_at', qa.open_at, 'close_at', qa.close_at,
           'planned_questions', coalesce(qa.planned_questions, 0), 'topics', to_jsonb(coalesce(qa.topics, '{}'::text[])),
           'status', coalesce(qa.status, case when s.is_published then 'published' else 'draft' end),
           'question_count', m.n,
           'attempts', (select count(*) from public.quiz_attempts a where a.quiz_id = q.id),
           'created_at', q.created_at,
           'sections', coalesce((select jsonb_agg(to_jsonb(ts) order by ts.position)
                                   from public.test_sections ts where ts.quiz_id = q.id), '[]'::jsonb),
           'questions', coalesce((select jsonb_agg(public.adm_question_json(qq.id) order by qq.sort_order, qq.created_at)
                                    from public.quiz_questions qq where qq.quiz_id = q.id), '[]'::jsonb))
    from public.quizzes q
    left join public.quiz_admin qa on qa.quiz_id = q.id
    left join public.test_series s on s.id = q.series_id
    cross join lateral (select count(*) as n, coalesce(sum(x.points), 0) as marks_sum
                          from public.quiz_questions x where x.quiz_id = q.id) m
   where q.id = p_quiz;
$$;

-- ------------------------------------------------------------------ grants
-- create or replace keeps grants; restated for the browser-callable ones.
revoke all on function public.adm_report_with_images(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.adm_answer_upload_window(uuid) from public, anon, authenticated;
revoke all on function public.adm_written_sync_rows(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.adm_answer_upload_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_apply_test_fields(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.adm_test_json(uuid) from public, anon, authenticated;
revoke all on function public.student_answer_upload_slot(uuid, uuid, text, bigint) from public, anon;
revoke all on function public.student_register_answer_upload(uuid, uuid, text, text, text, bigint) from public, anon;
revoke all on function public.student_remove_answer_upload(uuid) from public, anon;
revoke all on function public.student_list_answer_uploads(uuid) from public, anon;
revoke all on function public.adm_answer_upload_access(uuid) from public, anon;
revoke all on function public.grading_list_attempts(text, text, uuid, int, int) from public, anon;
revoke all on function public.grading_get_attempt(uuid) from public, anon;
grant execute on function public.student_answer_upload_slot(uuid, uuid, text, bigint) to authenticated;
grant execute on function public.student_register_answer_upload(uuid, uuid, text, text, text, bigint) to authenticated;
grant execute on function public.student_remove_answer_upload(uuid) to authenticated;
grant execute on function public.student_list_answer_uploads(uuid) to authenticated;
grant execute on function public.adm_answer_upload_access(uuid) to authenticated;
grant execute on function public.grading_list_attempts(text, text, uuid, int, int) to authenticated;
grant execute on function public.grading_get_attempt(uuid) to authenticated;

rollback;
