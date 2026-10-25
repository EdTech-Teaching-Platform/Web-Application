-- =====================================================================
-- 20261025110600_admin_rpc_tests_questions.sql
--
-- Purpose
--   Test (quiz), section, question and option CRUD for testSeriesApi.js (D3/D4):
--     create_test(p_series_id, p) / update_test(p_id, p) / delete_test(p_id)
--     duplicate_test(p_id) / set_test_status(p_id, p_status)  (publish / unpublish)
--     create_test_section(p_test_id, p) / update_test_section(p_id, p) / delete_test_section(p_id)
--     create_question(p_test_id, p) / update_question(p_id, p) / delete_question(p_id)
--     create_question_option(p_question_id, p) / update_question_option(p_id, p) / delete_question_option(p_id)
--   Tests and questions return the JSON built by adm_test_json / adm_question_json.
--
-- Lead objects written
--   quizzes, quiz_questions, quiz_question_options (through these RPCs only).
-- Lead objects read
--   quiz_attempts, quiz_answers (to refuse destructive edits once students
--   have answered), test_series.
--
-- Assumptions
--   * Per-test status (draft / published) lives only in quiz_admin. The lead's
--     quizzes table has no status, so the lead's student app sees every quiz of
--     a published series regardless of this flag (reported as a gap).
--   * Questions with student answers cannot change type, be deleted, or have
--     their options replaced or their correct flags changed.
--   * Test fields are stored in the lead's quizzes columns (instructions ->
--     description, duration -> time_limit_mins, attemptLimit -> max_attempts,
--     passingPercent -> passing_score, shuffleQuestions -> shuffle_questions,
--     position -> series_sort_order, showAnswersAfter -> show_answers_after).
--   * Text-answer questions (short_answer, fill_in_blank, subjective,
--     long_answer) are saved with one correct option: the accepted answer,
--     else the model answer, else 'Manual grading: see rubric'.
--   * set_test_status('published') applies the lead's publish checks and
--     messages ('"<title>" has no questions.', '"<title>" has N question(s)
--     without a correct answer.').
--
-- ROLLBACK
--   drop function if exists public.delete_question_option(uuid), public.update_question_option(uuid, jsonb),
--     public.create_question_option(uuid, jsonb), public.delete_question(uuid), public.update_question(uuid, jsonb),
--     public.create_question(uuid, jsonb), public.delete_test_section(uuid), public.update_test_section(uuid, jsonb),
--     public.create_test_section(uuid, jsonb), public.set_test_status(uuid, text), public.duplicate_test(uuid),
--     public.delete_test(uuid), public.update_test(uuid, jsonb), public.create_test(uuid, jsonb);
-- =====================================================================
set search_path = public, extensions;

-- ---------------------------------------------------------------- status
create or replace function public.set_test_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_msg text;
  v_old text;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_id);
  if p_status not in ('draft', 'published') then
    raise exception 'Unknown test status: %', p_status using errcode = '22023';
  end if;
  if p_status = 'published' then
    v_msg := public.adm_validate_quiz_for_publish(p_id);
    if v_msg is not null then raise exception '%', v_msg using errcode = '22023'; end if;
  end if;
  insert into public.quiz_admin (quiz_id) values (p_id) on conflict (quiz_id) do nothing;
  select status into v_old from public.quiz_admin where quiz_id = p_id for update;
  update public.quiz_admin set status = p_status where quiz_id = p_id;
  if p_status = 'published' then
    perform public.adm_complete_assignments_for_quiz(p_id);
  end if;
  perform public.adm_audit('test.' || case when p_status = 'published' then 'publish' else 'unpublish' end,
                           'quiz', p_id, jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), null);
  return public.adm_test_json(p_id);
end $$;

-- ------------------------------------------------------------------ tests
-- p: {name, instructions, duration, totalMarks, passingMarks | passingPercent,
--     attemptLimit, scheduledAt, shuffleQuestions, shuffleOptions, window,
--     plannedQuestions, topics, showAnswersAfter, status, questions[]}
create or replace function public.create_test(p_series_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_course uuid;
  v_pos    int;
  v_quiz   uuid;
  q        jsonb;
  qpos     int := 0;
begin
  perform public.adm_require_admin();
  perform public.adm_require_series(p_series_id);
  if nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Test name is required.' using errcode = '22023';
  end if;
  select course_id into v_course from public.test_series where id = p_series_id;
  select coalesce(max(series_sort_order), 0) + 1 into v_pos from public.quizzes where series_id = p_series_id;

  insert into public.quizzes (course_id, series_id, series_sort_order, title)
  values (v_course, p_series_id, v_pos, left(btrim(p ->> 'name'), 200))
  returning id into v_quiz;
  perform public.adm_apply_test_fields(v_quiz, p - 'status' - 'questions');

  for q in select * from jsonb_array_elements(case when jsonb_typeof(p -> 'questions') = 'array' then p -> 'questions' else '[]'::jsonb end) loop
    if public.adm_insert_question(v_quiz, qpos + 1, q - 'id', null, 'manual') is not null then
      qpos := qpos + 1;
    end if;
  end loop;

  perform public.adm_audit('test.create', 'quiz', v_quiz, null, jsonb_build_object('series_id', p_series_id, 'title', p ->> 'name'), null);
  if p ->> 'status' = 'published' then
    return public.set_test_status(v_quiz, 'published');
  end if;
  return public.adm_test_json(v_quiz);
end $$;

-- Questions are not replaced here (edit them with the question RPCs).
create or replace function public.update_test(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_old text;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_id);
  perform public.adm_apply_test_fields(p_id, p - 'status' - 'questions');
  select coalesce(qa.status, 'draft') into v_old from public.quiz_admin qa where qa.quiz_id = p_id;
  perform public.adm_audit('test.update', 'quiz', p_id, null, p - 'questions', null);
  if p ->> 'status' in ('draft', 'published') and p ->> 'status' is distinct from v_old then
    return public.set_test_status(p_id, p ->> 'status');
  end if;
  return public.adm_test_json(p_id);
end $$;

create or replace function public.delete_test(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_series uuid;
begin
  perform public.adm_require_admin();
  v_series := public.adm_require_quiz(p_id);
  perform public.adm_delete_quiz(p_id);
  perform public.adm_audit('test.delete', 'quiz', p_id, jsonb_build_object('series_id', v_series), null, null);
end $$;

create or replace function public.duplicate_test(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_series uuid;
  v_pos    int;
  v_title  text;
  v_new    uuid;
begin
  perform public.adm_require_admin();
  v_series := public.adm_require_quiz(p_id);
  select coalesce(max(series_sort_order), 0) + 1 into v_pos from public.quizzes where series_id = v_series;
  select title || ' (Copy)' into v_title from public.quizzes where id = p_id;
  v_new := public.adm_copy_quiz(p_id, v_series, v_pos, v_title);
  perform public.adm_audit('test.duplicate', 'quiz', v_new, null, jsonb_build_object('source', p_id), null);
  return public.adm_test_json(v_new);
end $$;

-- --------------------------------------------------------------- sections
-- p accepts snake_case (table shape) or camelCase keys.
create or replace function public.create_test_section(p_test_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pos int;
  r     public.test_sections;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_test_id);
  if nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Section name is required.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(position), 0) + 1 from public.test_sections where quiz_id = p_test_id));
  insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
  values (p_test_id, v_pos, btrim(p ->> 'name'), nullif(p ->> 'instructions', ''),
          coalesce(nullif(p ->> 'planned_questions', ''), nullif(p ->> 'plannedQuestions', ''))::int,
          coalesce(nullif(p ->> 'planned_marks', ''), nullif(p ->> 'plannedMarks', ''))::numeric)
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.update_test_section(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.test_sections;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz((select quiz_id from public.test_sections where id = p_id));
  if p ? 'name' and nullif(btrim(coalesce(p ->> 'name', '')), '') is null then
    raise exception 'Section name is required.' using errcode = '22023';
  end if;
  update public.test_sections set
    name              = case when p ? 'name' then btrim(p ->> 'name') else name end,
    instructions      = case when p ? 'instructions' then nullif(p ->> 'instructions', '') else instructions end,
    position          = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, position) else position end,
    planned_questions = case when p ? 'planned_questions' then nullif(p ->> 'planned_questions', '')::int
                             when p ? 'plannedQuestions' then nullif(p ->> 'plannedQuestions', '')::int else planned_questions end,
    planned_marks     = case when p ? 'planned_marks' then nullif(p ->> 'planned_marks', '')::numeric
                             when p ? 'plannedMarks' then nullif(p ->> 'plannedMarks', '')::numeric else planned_marks end
  where id = p_id
  returning * into r;
  return to_jsonb(r);
end $$;

create or replace function public.delete_test_section(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz((select quiz_id from public.test_sections where id = p_id));
  delete from public.test_sections where id = p_id;   -- questions keep their rows; section_id becomes null
end $$;

-- -------------------------------------------------------------- questions
-- p: the editor shape {type, text, optionA..D, correctAnswer, marks, negativeMarks,
--    difficulty, subject, topic, explanation, answerInstructions, image, position, sectionId}
--    or the table shape {type, body, marks, negative_marks, ..., options[]}.
create or replace function public.create_question(p_test_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_pos     int;
  v_section uuid := coalesce(nullif(p ->> 'section_id', ''), nullif(p ->> 'sectionId', ''))::uuid;
  v_id      uuid;
begin
  perform public.adm_require_admin();
  perform public.adm_require_quiz(p_test_id);
  if v_section is not null and not exists (select 1 from public.test_sections where id = v_section and quiz_id = p_test_id) then
    raise exception 'Section does not belong to this test.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(sort_order), 0) + 1 from public.quiz_questions where quiz_id = p_test_id));
  v_id := public.adm_insert_question(p_test_id, v_pos, p, v_section, 'manual');
  if v_id is null then raise exception 'Question text is required.' using errcode = '22023'; end if;
  perform public.adm_audit('question.create', 'quiz_question', v_id, null, jsonb_build_object('test_id', p_test_id), null);
  return public.adm_question_json(v_id);
end $$;

create or replace function public.update_question(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_quiz        uuid;
  v_cur_lead    text;
  v_type        text;
  v_lead        text;
  v_answered    boolean;
  v_text        text;
  v_has_options boolean := jsonb_typeof(p -> 'options') = 'array' or p ? 'optionA' or p ? 'optionB';
  v_before      jsonb;
begin
  perform public.adm_require_admin();
  select quiz_id, question_type into v_quiz, v_cur_lead from public.quiz_questions where id = p_id for update;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  v_answered := exists (select 1 from public.quiz_answers where question_id = p_id);
  v_before := public.adm_question_json(p_id);

  if p ? 'type' then
    v_type := lower(btrim(coalesce(p ->> 'type', '')));
    v_lead := public.adm_map_question_type(v_type);
    if v_lead is null then raise exception 'Unsupported question type: %', v_type using errcode = '22023'; end if;
    if v_answered and v_lead <> v_cur_lead then
      raise exception 'Students have answered this question; its type cannot change.' using errcode = '22023';
    end if;
  end if;
  if p ? 'text' or p ? 'body' then
    v_text := nullif(btrim(coalesce(p ->> 'text', p ->> 'body', '')), '');
    if v_text is null then raise exception 'Question text is required.' using errcode = '22023'; end if;
  end if;

  update public.quiz_questions set
    question_text = coalesce(v_text, question_text),
    question_type = coalesce(v_lead, question_type),
    points        = case when p ? 'marks' then coalesce(nullif(p ->> 'marks', '')::numeric, points) else points end,
    explanation   = case when p ? 'explanation' then nullif(btrim(coalesce(p ->> 'explanation', '')), '') else explanation end,
    sort_order    = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, sort_order) else sort_order end
  where id = p_id;

  insert into public.quiz_question_admin (question_id, admin_type)
  values (p_id, public.adm_ui_question_type(v_cur_lead)) on conflict (question_id) do nothing;
  update public.quiz_question_admin set
    admin_type           = coalesce(v_type, admin_type),
    needs_manual_grading = case when v_type is not null then v_type in ('subjective', 'long_answer', 'descriptive') else needs_manual_grading end,
    negative_marks       = case when p ? 'negativeMarks' then greatest(coalesce(nullif(p ->> 'negativeMarks', '')::numeric, 0), 0)
                                when p ? 'negative_marks' then greatest(coalesce(nullif(p ->> 'negative_marks', '')::numeric, 0), 0)
                                else negative_marks end,
    difficulty           = case when lower(coalesce(p ->> 'difficulty', '')) in ('easy', 'medium', 'hard') then lower(p ->> 'difficulty') else difficulty end,
    subject              = case when p ? 'subject' then nullif(btrim(coalesce(p ->> 'subject', '')), '') else subject end,
    topic                = case when p ? 'topic' then nullif(btrim(coalesce(p ->> 'topic', '')), '') else topic end,
    image_path           = case when p ? 'image' then nullif(p ->> 'image', '')
                                when p ? 'image_path' then nullif(p ->> 'image_path', '') else image_path end,
    answer_instructions  = case when p ? 'answerInstructions' then nullif(p ->> 'answerInstructions', '')
                                when p ? 'rubric' then nullif(p ->> 'rubric', '')
                                when p ? 'answer_instructions' then nullif(p ->> 'answer_instructions', '') else answer_instructions end,
    section_id           = case when p ? 'section_id' then nullif(p ->> 'section_id', '')::uuid
                                when p ? 'sectionId' then nullif(p ->> 'sectionId', '')::uuid else section_id end
  where question_id = p_id;

  -- Options are replaced only when the payload carries option texts, when the
  -- question is (or became) a text-answer type, or when its accepted / model
  -- answer changed. Text-answer questions always get exactly one correct
  -- option (accepted answer, model answer or the manual-grading placeholder;
  -- see adm_insert_options), so they stay publishable under the lead's rule.
  if v_has_options or (v_lead is not null and v_lead not in ('multiple_choice', 'true_false'))
     or ((p ? 'correctAnswer' or p ? 'answer' or p ? 'modelAnswer' or p ? 'model_answer')
         and coalesce(v_lead, v_cur_lead) in ('fill_in_blank', 'short_answer')) then
    if v_answered then
      raise exception 'Students have answered this question; edit its options one by one instead.' using errcode = '22023';
    end if;
    delete from public.quiz_question_options where question_id = p_id;
    perform public.adm_insert_options(p_id, (select question_type from public.quiz_questions where id = p_id),
                                      p || jsonb_build_object('type', (select admin_type from public.quiz_question_admin
                                                                        where question_id = p_id)));
  end if;

  perform public.adm_audit('question.update', 'quiz_question', p_id, v_before, public.adm_question_json(p_id), null);
  return public.adm_question_json(p_id);
end $$;

create or replace function public.delete_question(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_quiz uuid;
begin
  perform public.adm_require_admin();
  select quiz_id into v_quiz from public.quiz_questions where id = p_id;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  if exists (select 1 from public.quiz_answers where question_id = p_id) then
    raise exception 'Students have answered this question; it cannot be deleted.' using errcode = '23503';
  end if;
  delete from public.quiz_question_options where question_id = p_id;
  delete from public.quiz_questions where id = p_id;
  perform public.adm_audit('question.delete', 'quiz_question', p_id, jsonb_build_object('test_id', v_quiz), null, null);
end $$;

-- ---------------------------------------------------------------- options
-- Returned shape: {id, question_id, option_key, label, is_correct, position}
create or replace function public.create_question_option(p_question_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_quiz  uuid;
  v_label text := nullif(btrim(coalesce(p ->> 'label', p ->> 'text', p ->> 'option_text', '')), '');
  v_pos   int;
  v_id    uuid;
begin
  perform public.adm_require_admin();
  select quiz_id into v_quiz from public.quiz_questions where id = p_question_id;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  if v_label is null then raise exception 'Option text is required.' using errcode = '22023'; end if;
  if exists (select 1 from public.quiz_answers where question_id = p_question_id) then
    raise exception 'Students have answered this question; options cannot be added.' using errcode = '22023';
  end if;
  v_pos := coalesce(nullif(p ->> 'position', '')::int,
                    (select coalesce(max(sort_order), 0) + 1 from public.quiz_question_options where question_id = p_question_id));
  insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
  values (p_question_id, v_label, coalesce((p ->> 'is_correct')::boolean, (p ->> 'isCorrect')::boolean, false), v_pos)
  returning id into v_id;
  return (select o.v from jsonb_array_elements(public.adm_question_json(p_question_id) -> 'options') as o(v)
           where o.v ->> 'id' = v_id::text);
end $$;

create or replace function public.update_question_option(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_question uuid;
  v_correct  boolean;
  v_new      boolean := coalesce((p ->> 'is_correct')::boolean, (p ->> 'isCorrect')::boolean);
begin
  perform public.adm_require_admin();
  select question_id, is_correct into v_question, v_correct from public.quiz_question_options where id = p_id for update;
  if v_question is null then raise exception 'Option not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz((select quiz_id from public.quiz_questions where id = v_question));
  if v_new is not null and v_new is distinct from v_correct
     and exists (select 1 from public.quiz_answers where question_id = v_question) then
    raise exception 'Students have answered this question; the correct answer cannot change.' using errcode = '22023';
  end if;
  if (p ? 'label' or p ? 'text') and nullif(btrim(coalesce(p ->> 'label', p ->> 'text', '')), '') is null then
    raise exception 'Option text is required.' using errcode = '22023';
  end if;
  if v_new is false and (select question_type from public.quiz_questions where id = v_question) in ('fill_in_blank', 'short_answer') then
    raise exception 'A text-answer question keeps its answer option marked correct; edit its text instead.' using errcode = '22023';
  end if;
  update public.quiz_question_options set
    option_text = coalesce(nullif(btrim(coalesce(p ->> 'label', p ->> 'text', '')), ''), option_text),
    is_correct  = coalesce(v_new, is_correct),
    sort_order  = case when p ? 'position' then coalesce(nullif(p ->> 'position', '')::int, sort_order) else sort_order end
  where id = p_id;
  return (select o.v from jsonb_array_elements(public.adm_question_json(v_question) -> 'options') as o(v)
           where o.v ->> 'id' = p_id::text);
end $$;

create or replace function public.delete_question_option(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_question uuid;
begin
  perform public.adm_require_admin();
  select question_id into v_question from public.quiz_question_options where id = p_id;
  if v_question is null then raise exception 'Option not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz((select quiz_id from public.quiz_questions where id = v_question));
  if exists (select 1 from public.quiz_answers where question_id = v_question) then
    raise exception 'Students have answered this question; options cannot be removed.' using errcode = '23503';
  end if;
  if (select question_type from public.quiz_questions where id = v_question) in ('fill_in_blank', 'short_answer')
     and (select count(*) from public.quiz_question_options where question_id = v_question and is_correct and id <> p_id) = 0 then
    raise exception 'A text-answer question needs its answer option; edit it instead of deleting it.' using errcode = '22023';
  end if;
  delete from public.quiz_question_options where id = p_id;
end $$;

-- ------------------------------------------------------------------ grants
revoke all on function public.set_test_status(uuid, text) from public, anon;
revoke all on function public.create_test(uuid, jsonb) from public, anon;
revoke all on function public.update_test(uuid, jsonb) from public, anon;
revoke all on function public.delete_test(uuid) from public, anon;
revoke all on function public.duplicate_test(uuid) from public, anon;
revoke all on function public.create_test_section(uuid, jsonb) from public, anon;
revoke all on function public.update_test_section(uuid, jsonb) from public, anon;
revoke all on function public.delete_test_section(uuid) from public, anon;
revoke all on function public.create_question(uuid, jsonb) from public, anon;
revoke all on function public.update_question(uuid, jsonb) from public, anon;
revoke all on function public.delete_question(uuid) from public, anon;
revoke all on function public.create_question_option(uuid, jsonb) from public, anon;
revoke all on function public.update_question_option(uuid, jsonb) from public, anon;
revoke all on function public.delete_question_option(uuid) from public, anon;

grant execute on function public.set_test_status(uuid, text) to authenticated;
grant execute on function public.create_test(uuid, jsonb) to authenticated;
grant execute on function public.update_test(uuid, jsonb) to authenticated;
grant execute on function public.delete_test(uuid) to authenticated;
grant execute on function public.duplicate_test(uuid) to authenticated;
grant execute on function public.create_test_section(uuid, jsonb) to authenticated;
grant execute on function public.update_test_section(uuid, jsonb) to authenticated;
grant execute on function public.delete_test_section(uuid) to authenticated;
grant execute on function public.create_question(uuid, jsonb) to authenticated;
grant execute on function public.update_question(uuid, jsonb) to authenticated;
grant execute on function public.delete_question(uuid) to authenticated;
grant execute on function public.create_question_option(uuid, jsonb) to authenticated;
grant execute on function public.update_question_option(uuid, jsonb) to authenticated;
grant execute on function public.delete_question_option(uuid) to authenticated;
