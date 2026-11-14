-- =====================================================================
-- rollback_20261115090000_student_ai_evaluation.sql
-- Undoes supabase/migrations/20261115090000_student_ai_evaluation.sql: drops
-- the AI evaluation RPCs and table (grades already written to quiz_answers /
-- quiz_attempts / attempt_reports stay), and restores the five replaced
-- functions (subjective questions become "coming soon" again).
-- Run only with "approved:"; take a backup first.
-- =====================================================================
set search_path = public, extensions;
begin;

drop function if exists public.adm_ai_eval_fail(uuid, text);
drop function if exists public.adm_ai_eval_complete(uuid, jsonb, text, int, int);
drop function if exists public.adm_ai_eval_context(uuid);
drop function if exists public.student_ai_eval_status(uuid);
drop function if exists public.student_ai_eval_request(uuid);
drop function if exists public.adm_ai_pending_question_ids(jsonb);
drop table if exists public.ai_attempt_evaluations;

-- adm_assert_question_type_allowed: verbatim from 20261027090000_admin_block_subjective.sql
create or replace function public.adm_assert_question_type_allowed(p_type text) returns void
language plpgsql immutable set search_path = public, extensions as $$
begin
  if public.adm_is_subjective_type(p_type) then
    raise exception 'Short answer, long answer and subjective questions are coming soon and can''t be created yet (type "%"). Use MCQ, true / false or fill in the blank.', p_type
      using errcode = '22023';
  end if;
end $$;

-- adm_insert_questions_bulk: verbatim from 20261029110000_admin_test_assets.sql
create or replace function public.adm_insert_questions_bulk(p_quiz uuid, p_questions jsonb, p_source text default 'manual')
returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_bad record;
  v_n   int;
begin
  if jsonb_typeof(p_questions) is distinct from 'array' then return 0; end if;

  select x.v_type, public.adm_map_question_type(x.v_type) as v_lead into v_bad
    from (select e.ord, e.q,
                 lower(coalesce(nullif(btrim(coalesce(e.q ->> 'type', '')), ''), 'objective')) as v_type,
                 coalesce(nullif(btrim(coalesce(e.q ->> 'text', '')), ''), nullif(btrim(coalesce(e.q ->> 'body', '')), '')) as v_text
            from jsonb_array_elements(p_questions) with ordinality as e(q, ord)) x
   where x.v_text is not null
     and (public.adm_map_question_type(x.v_type) is null
          or public.adm_is_subjective_type(x.v_type)
          or (public.adm_map_question_type(x.v_type) = 'fill_in_blank' and public.adm_text_answer(x.q) = 'Manual grading: see rubric'))
   order by x.ord
   limit 1;
  if found then
    if v_bad.v_lead is null then
      raise exception 'Unsupported question type: %', v_bad.v_type using errcode = '22023';
    end if;
    perform public.adm_assert_question_type_allowed(v_bad.v_type);
    raise exception 'Fill-in-the-blank questions need an accepted answer.' using errcode = '22023';
  end if;

  with src as materialized (
    select gen_random_uuid() as id, x.q, x.v_text, x.v_type, public.adm_map_question_type(x.v_type) as v_lead,
           case when x.v_diff in ('easy', 'medium', 'hard') then x.v_diff else 'medium' end as v_diff,
           case when x.v_source in ('manual', 'ai', 'csv', 'duplicate', 'paste') then x.v_source else 'manual' end as v_source,
           ts.id as section_id,
           row_number() over (order by x.ord)::int as pos
      from (select e.ord, e.q,
                   coalesce(nullif(btrim(coalesce(e.q ->> 'text', '')), ''), nullif(btrim(coalesce(e.q ->> 'body', '')), '')) as v_text,
                   lower(coalesce(nullif(btrim(coalesce(e.q ->> 'type', '')), ''), 'objective')) as v_type,
                   lower(coalesce(nullif(btrim(coalesce(e.q ->> 'difficulty', '')), ''), 'medium')) as v_diff,
                   coalesce(nullif(e.q ->> 'source', ''), p_source, 'manual') as v_source
              from jsonb_array_elements(p_questions) with ordinality as e(q, ord)) x
      left join public.test_sections ts
        on ts.quiz_id = p_quiz and ts.position = nullif(x.q ->> 'sectionPosition', '')::int
     where x.v_text is not null
  ),
  ins_q as (
    insert into public.quiz_questions (id, quiz_id, question_text, question_type, points, explanation, sort_order)
    select src.id, p_quiz, src.v_text, src.v_lead, coalesce(nullif(src.q ->> 'marks', '')::numeric, 4),
           nullif(btrim(coalesce(src.q ->> 'explanation', '')), ''), src.pos
      from src
    returning 1
  ),
  ins_a as (
    insert into public.quiz_question_admin
      (question_id, admin_type, needs_manual_grading, section_id, negative_marks, difficulty, subject, topic,
       image_path, image_alt, answer_instructions, source, ai_job_id)
    select src.id, src.v_type, src.v_type in ('subjective', 'long_answer', 'descriptive'), src.section_id,
           greatest(coalesce(nullif(src.q ->> 'negativeMarks', '')::numeric, nullif(src.q ->> 'negative_marks', '')::numeric, 0), 0),
           src.v_diff, nullif(btrim(coalesce(src.q ->> 'subject', '')), ''), nullif(btrim(coalesce(src.q ->> 'topic', '')), ''),
           nullif(coalesce(src.q ->> 'image', src.q ->> 'image_path', ''), ''),   -- 20261029110000: checked by the caller
           left(nullif(btrim(coalesce(src.q ->> 'imageAlt', src.q ->> 'image_alt', '')), ''), 300),
           coalesce(nullif(src.q ->> 'answerInstructions', ''), nullif(src.q ->> 'rubric', ''), nullif(src.q ->> 'answer_instructions', '')),
           src.v_source, nullif(src.q ->> 'aiJobId', '')::uuid
      from src
  ),
  ins_o as (
    insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
    select src.id, o.option_text, o.is_correct, o.sort_order
      from src cross join lateral public.adm_question_options(src.v_lead, src.q) o
  )
  select count(*) into v_n from ins_q;
  return v_n;
end $$;

-- update_question: verbatim from 20261029110000_admin_test_assets.sql
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
  v_key         jsonb;      -- 20261028100200
  v_regraded    int := 0;   -- 20261028100200
begin
  perform public.adm_require_series_access(public.adm_quiz_series((select quiz_id from public.quiz_questions where id = p_id)), true);   -- 20261028100200: admin or the series' educator
  select quiz_id, question_type into v_quiz, v_cur_lead from public.quiz_questions where id = p_id for update;
  if v_quiz is null then raise exception 'Question not found.' using errcode = 'P0002'; end if;
  perform public.adm_require_quiz(v_quiz);
  v_answered := exists (select 1 from public.quiz_answers where question_id = p_id);
  -- 20261027090000: existing subjective questions are read-only.
  if public.adm_question_is_subjective(p_id) then
    raise exception 'Short answer, long answer and subjective questions are coming soon and can''t be edited yet. Existing ones stay as they are; you can delete them.'
      using errcode = '22023';
  end if;
  v_before := public.adm_question_json(p_id);
  v_key := public.adm_question_grading_key(p_id);   -- 20261028100200

  if p ? 'type' then
    v_type := lower(btrim(coalesce(p ->> 'type', '')));
    v_lead := public.adm_map_question_type(v_type);
    if v_lead is null then raise exception 'Unsupported question type: %', v_type using errcode = '22023'; end if;
    perform public.adm_assert_question_type_allowed(v_type);
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
    image_path           = case when p ? 'image' or p ? 'image_path'   -- 20261029110000: checked; the current path may stay
                                then public.adm_test_asset_path(coalesce(p ->> 'image', p ->> 'image_path'), 'question_image', array[image_path])
                                else image_path end,
    image_alt            = case when p ? 'imageAlt' or p ? 'image_alt' then left(nullif(btrim(coalesce(p ->> 'imageAlt', p ->> 'image_alt', '')), ''), 300) else image_alt end,
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
      -- 20261028100200: answered: the same options are edited in place (their ids are in
      -- students' answers); adding or removing options is refused.
      perform public.adm_update_options_in_place(p_id, (select question_type from public.quiz_questions where id = p_id),
                                                 p || jsonb_build_object('type', (select admin_type from public.quiz_question_admin
                                                                                   where question_id = p_id)));
    else
      delete from public.quiz_question_options where question_id = p_id;
      perform public.adm_insert_options(p_id, (select question_type from public.quiz_questions where id = p_id),
                                        p || jsonb_build_object('type', (select admin_type from public.quiz_question_admin
                                                                          where question_id = p_id)));
    end if;
  end if;

  -- 20261028100200: marks or the correct answer changed on an answered question: re-score.
  if v_answered and public.adm_question_grading_key(p_id) is distinct from v_key then
    v_regraded := public.adm_regrade_quiz(v_quiz);
  end if;
  perform public.adm_audit('question.update', 'quiz_question', p_id, v_before, public.adm_question_json(p_id), null);
  return public.adm_question_json(p_id) || jsonb_build_object('regraded_attempts', v_regraded);
end $$;

-- adm_copy_quiz: verbatim from 20261029110000_admin_test_assets.sql
create or replace function public.adm_copy_quiz(p_src uuid, p_series uuid, p_pos int, p_title text default null) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_new    uuid;
  v_course uuid;
  v_map    jsonb := '{}'::jsonb;
  v_ns     uuid;
  v_nq     uuid;
  sec      record;
  qq       record;
begin
  -- 20261027090000: copying would create new subjective questions.
  if exists (select 1 from public.quiz_questions x where x.quiz_id = p_src and public.adm_question_is_subjective(x.id)) then
    raise exception 'This test has short answer, long answer or subjective questions, which are coming soon. Delete them from the test before duplicating it.'
      using errcode = '22023';
  end if;
  select course_id into v_course from public.test_series where id = p_series;
  insert into public.quizzes (course_id, series_id, series_sort_order, title, description, time_limit_mins,
                              max_attempts, passing_score, shuffle_questions, is_required, show_answers_after, is_proctored)
  select v_course, p_series, p_pos, left(coalesce(p_title, q.title), 200), q.description, q.time_limit_mins,
         q.max_attempts, q.passing_score, q.shuffle_questions, q.is_required, q.show_answers_after, q.is_proctored
    from public.quizzes q where q.id = p_src
  returning id into v_new;
  if v_new is null then raise exception 'Test not found.' using errcode = 'P0002'; end if;

  insert into public.quiz_admin (quiz_id, status, total_marks_planned, passing_marks, shuffle_options, window_mode,
                                 open_at, close_at, scheduled_at, planned_questions, topics)
  select v_new, 'draft', total_marks_planned, passing_marks, shuffle_options, window_mode,
         open_at, close_at, scheduled_at, planned_questions, topics
    from public.quiz_admin where quiz_id = p_src;
  insert into public.quiz_admin (quiz_id) values (v_new) on conflict (quiz_id) do nothing;

  for sec in select * from public.test_sections where quiz_id = p_src order by position loop
    insert into public.test_sections (quiz_id, position, name, instructions, planned_questions, planned_marks)
    values (v_new, sec.position, sec.name, sec.instructions, sec.planned_questions, sec.planned_marks)
    returning id into v_ns;
    v_map := v_map || jsonb_build_object(sec.id::text, v_ns);
  end loop;

  for qq in
    select x.id, x.question_text, x.question_type, x.points, x.explanation, x.sort_order,
           qa.admin_type, qa.needs_manual_grading, qa.section_id, qa.negative_marks, qa.difficulty,
           qa.subject, qa.topic, qa.image_path, qa.image_alt, qa.answer_instructions   -- 20261029110000
      from public.quiz_questions x
      left join public.quiz_question_admin qa on qa.question_id = x.id
     where x.quiz_id = p_src
     order by x.sort_order, x.created_at
  loop
    insert into public.quiz_questions (quiz_id, question_text, question_type, points, explanation, sort_order)
    values (v_new, qq.question_text, qq.question_type, qq.points, qq.explanation, qq.sort_order)
    returning id into v_nq;
    insert into public.quiz_question_admin (question_id, admin_type, needs_manual_grading, section_id, negative_marks,
                                            difficulty, subject, topic, image_path, image_alt, answer_instructions, source)
    values (v_nq, coalesce(qq.admin_type, public.adm_ui_question_type(qq.question_type)),
            coalesce(qq.needs_manual_grading, false),
            case when qq.section_id is not null then nullif(v_map ->> qq.section_id::text, '')::uuid end,
            coalesce(qq.negative_marks, 0), coalesce(qq.difficulty, 'medium'), qq.subject, qq.topic,
            qq.image_path, qq.image_alt, qq.answer_instructions, 'duplicate');   -- 20261029110000: the copy keeps the figure
    insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
    select v_nq, o.option_text, o.is_correct, o.sort_order
      from public.quiz_question_options o where o.question_id = qq.id;
    -- A text-answer source without a correct option (e.g. one written by the
    -- lead's app) gets the placeholder, so the copy stays publishable.
    if qq.question_type in ('fill_in_blank', 'short_answer')
       and not exists (select 1 from public.quiz_question_options o where o.question_id = v_nq and o.is_correct) then
      insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
      values (v_nq, public.adm_text_answer('{}'::jsonb), true,
              coalesce((select max(o.sort_order) from public.quiz_question_options o where o.question_id = v_nq), 0) + 1);
    end if;
  end loop;
  return v_new;
end $$;

-- adm_report_bucket: verbatim from 20261026100300_student_rpc_exam.sql
create or replace function public.adm_report_bucket(p_rows jsonb) returns jsonb
language sql immutable set search_path = public, extensions as $$
  select jsonb_build_object(
           'total', count(*),
           'attempted', count(*) filter (where r ->> 'status' <> 'skipped'),
           'correct', count(*) filter (where r ->> 'status' = 'correct'),
           'incorrect', count(*) filter (where r ->> 'status' = 'incorrect'),
           'skipped', count(*) filter (where r ->> 'status' = 'skipped'),
           'pending', count(*) filter (where r ->> 'status' = 'pending'),
           'graded', count(*) filter (where r ->> 'status' in ('correct', 'incorrect')),
           'accuracy', coalesce(round(count(*) filter (where r ->> 'status' = 'correct') * 100.0
                                      / nullif(count(*) filter (where r ->> 'status' in ('correct', 'incorrect')), 0), 1), 0),
           'marks_earned', coalesce(sum((r ->> 'points_earned')::numeric), 0),
           'marks_possible', coalesce(sum((r ->> 'points')::numeric) filter (where r ->> 'status' <> 'pending'), 0))
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;
$$;

commit;
