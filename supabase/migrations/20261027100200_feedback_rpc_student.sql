-- =====================================================================
-- 20261027100200_feedback_rpc_student.sql
--
-- Purpose
--   Student side of test feedback:
--     student_submit_feedback(uuid, text, int, text, uuid, text) -> uuid (new id)
--     student_my_feedback(uuid default null) -> jsonb array (caller's own items)
--
-- Rules (student_submit_feedback)
--   * The student is auth.uid() (adm_student_writer_uid: signed in, has a
--     profile, not blocked). The attempt must be the caller's and finished
--     (submitted / timed_out); the series and test come from the attempt.
--   * kind: feedback | query | issue. rating 1..5 is required for feedback and
--     ignored for the others. category (optional): wrong_answer,
--     unclear_question, technical_problem, other. question_id (optional) must
--     belong to the attempt's test. message: trimmed, 5..2000 characters.
--   * At most 5 submissions per student per series per calendar day
--     (Asia/Kolkata), serialized per student + series.
--   Errors: 42501 not signed in / blocked, P0002 attempt not found (or not
--   yours), P0001 attempt not finished / daily limit, 22023 bad input.
--
-- ROLLBACK
--   drop function if exists public.student_my_feedback(uuid);
--   drop function if exists public.student_submit_feedback(uuid, text, int, text, uuid, text);
-- =====================================================================
set search_path = public, extensions;

create or replace function public.student_submit_feedback(
  p_attempt_id  uuid,
  p_kind        text,
  p_rating      int default null,
  p_category    text default null,
  p_question_id uuid default null,
  p_message     text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid      uuid := public.adm_student_writer_uid();
  v_kind     text := lower(btrim(coalesce(p_kind, '')));
  v_category text := nullif(lower(btrim(coalesce(p_category, ''))), '');
  v_message  text := btrim(coalesce(p_message, ''));
  v_att      record;
  v_day      timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  v_count    int;
  v_id       uuid;
begin
  select a.id, a.student_id, a.status, a.quiz_id, q.series_id
    into v_att
    from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
   where a.id = p_attempt_id;
  if v_att.id is null or v_att.student_id <> v_uid or v_att.series_id is null then
    raise exception 'Attempt not found.' using errcode = 'P0002';
  end if;
  if v_att.status not in ('submitted', 'timed_out') then
    raise exception 'Submit the test before sending feedback.' using errcode = 'P0001';
  end if;

  if v_kind not in ('feedback', 'query', 'issue') then
    raise exception 'Choose feedback, a query or an issue.' using errcode = '22023';
  end if;
  if v_kind = 'feedback' and (p_rating is null or p_rating not between 1 and 5) then
    raise exception 'Give a rating from 1 to 5 stars.' using errcode = '22023';
  end if;
  if v_category is not null and v_category not in ('wrong_answer', 'unclear_question', 'technical_problem', 'other') then
    raise exception 'Unknown category: %', left(p_category, 40) using errcode = '22023';
  end if;
  if p_question_id is not null
     and not exists (select 1 from public.quiz_questions where id = p_question_id and quiz_id = v_att.quiz_id) then
    raise exception 'That question is not part of this test.' using errcode = '22023';
  end if;
  if char_length(v_message) < 5 then
    raise exception 'Write at least 5 characters.' using errcode = '22023';
  end if;
  if char_length(v_message) > 2000 then
    raise exception 'Keep the message under 2000 characters.' using errcode = '22023';
  end if;

  -- 5 per student per series per day; concurrent submits wait for each other.
  perform pg_advisory_xact_lock(hashtextextended('test_feedback:' || v_uid::text || ':' || v_att.series_id::text, 0));
  select count(*) into v_count
    from public.test_feedback
   where student_id = v_uid and series_id = v_att.series_id and created_at >= v_day;
  if v_count >= 5 then
    raise exception 'You can send up to 5 messages per test series each day. Try again tomorrow.' using errcode = 'P0001';
  end if;

  insert into public.test_feedback (student_id, series_id, test_id, attempt_id, kind, rating, category, question_id, message)
  values (v_uid, v_att.series_id, v_att.quiz_id, v_att.id, v_kind,
          case when v_kind = 'feedback' then p_rating end, v_category, p_question_id, v_message)
  returning id into v_id;
  return v_id;
end $$;

-- The caller's own items, newest first (at most 100). p_series_id null = all series.
create or replace function public.student_my_feedback(p_series_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := public.adm_student_uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', f.id, 'kind', f.kind, 'rating', f.rating, 'category', f.category,
             'message', f.message, 'status', f.status, 'admin_note', f.admin_note,
             'series_id', f.series_id, 'series_title', s.title,
             'test_id', f.test_id, 'test_title', q.title, 'attempt_id', f.attempt_id,
             'question_id', f.question_id,
             'question_position', (select o.n from (select qq.id, row_number() over (order by qq.sort_order, qq.created_at, qq.id) as n
                                                      from public.quiz_questions qq where qq.quiz_id = f.test_id) o
                                    where o.id = f.question_id),
             'created_at', f.created_at, 'reviewed_at', f.reviewed_at)
           order by f.created_at desc, f.id)
      from (select * from public.test_feedback
             where student_id = v_uid and (p_series_id is null or series_id = p_series_id)
             order by created_at desc, id limit 100) f
      left join public.test_series s on s.id = f.series_id
      left join public.quizzes q on q.id = f.test_id), '[]'::jsonb);
end $$;

revoke all on function public.student_submit_feedback(uuid, text, int, text, uuid, text) from public, anon;
grant execute on function public.student_submit_feedback(uuid, text, int, text, uuid, text) to authenticated;
revoke all on function public.student_my_feedback(uuid) from public, anon;
grant execute on function public.student_my_feedback(uuid) to authenticated;
