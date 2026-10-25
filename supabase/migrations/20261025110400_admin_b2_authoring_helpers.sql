-- =====================================================================
-- 20261025110400_admin_b2_authoring_helpers.sql
--
-- Purpose
--   Internal adm_* helpers for test authoring (D3): read models that merge the
--   lead's rows with this port's extension rows, the question-type mapping,
--   question / option writers, copy / delete helpers and the series->lead sync.
--   None of these are callable from the browser.
--
-- Lead objects read
--   test_series, quizzes, quiz_questions, quiz_question_options, quiz_attempts,
--   courses, categories, enrollments, profiles, educator_profiles, platform_settings.
-- Lead objects written (only when an RPC calls these helpers)
--   test_series (title, description, is_published, is_active, available_from,
--   available_until, updated_at), quizzes, quiz_questions, quiz_question_options.
--
-- Question type mapping (D3; the UI / archived type is kept in
-- quiz_question_admin.admin_type and returned to the UI unchanged):
--   objective, mcq, mcq_single, single  -> multiple_choice  (one correct option)
--   mcq_multi, multi_select              -> multiple_choice  (several correct options)  LOSSY
--   true_false                           -> true_false
--   numerical, numeric, fill_blank       -> fill_in_blank                                LOSSY (numerical)
--   short_answer                         -> short_answer
--   subjective, long_answer, descriptive -> short_answer + needs_manual_grading          LOSSY
--
-- Assumptions
--   * Series data the lead has a column for is written to that column, never
--     copied into test_series_admin: about -> description, instructions,
--     availability -> available_from / available_until, status -> is_published,
--     archived / soft-deleted -> is_active = false. Test fields map to quizzes:
--     instructions -> description, duration -> time_limit_mins, attempt limit ->
--     max_attempts, pass percent -> passing_score, shuffle -> shuffle_questions,
--     order -> series_sort_order, show answers -> show_answers_after.
--   * available_from / available_until hold only the access window. Go-live is
--     test_series_admin.go_live_at: a series with a future go-live is
--     'scheduled' with is_published = false until release_scheduled_series()
--     (cron, every 5 minutes, Batch 3) publishes it.
--   * Every text-answer question (fill_in_blank / short_answer, including the
--     manually graded types) carries exactly one correct option, so the lead's
--     publish rule always passes for it (adm_text_answer).
--   * Publish validation uses the lead's publish_test_series messages
--     (adm_validate_quiz_for_publish), so both apps accept the same series.
--
-- ROLLBACK
--   drop function if exists public.adm_assignment_rows(), public.adm_eligible_educators(),
--     public.adm_asg_notify(uuid, text, text, text), public.adm_asg_log(uuid, text, text),
--     public.adm_complete_assignments_for_quiz(uuid), public.adm_validate_quiz_for_publish(uuid),
--     public.adm_copy_quiz(uuid, uuid, int, text), public.adm_delete_quiz(uuid),
--     public.adm_apply_test_fields(uuid, jsonb), public.adm_insert_question(uuid, int, jsonb, uuid, text),
--     public.adm_insert_options(uuid, text, jsonb), public.adm_text_answer(jsonb), public.adm_series_json(uuid), public.adm_test_json(uuid),
--     public.adm_question_json(uuid), public.adm_new_house_series(text, text, text),
--     public.adm_set_series_availability(uuid, date, date),
--     public.adm_sync_series_to_lead(uuid), public.adm_ensure_series_admin(uuid),
--     public.adm_require_quiz(uuid), public.adm_require_series(uuid), public.adm_series_educators(),
--     public.adm_series_students(), public.adm_series_rows(), public.adm_subject_category(text),
--     public.adm_ui_question_type(text), public.adm_map_question_type(text), public.adm_norm_text(text),
--     public.adm_house_course_id();
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------------------ small helpers
create or replace function public.adm_house_course_id() returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select nullif(value #>> '{}', '')::uuid from public.platform_settings where key = 'admin_house_course_id';
$$;

create or replace function public.adm_norm_text(t text) returns text
language sql immutable set search_path = public, extensions as $$
  select lower(btrim(regexp_replace(coalesce(t, ''), '[^a-zA-Z0-9]+', ' ', 'g')));
$$;

-- UI / archived type -> lead quiz_questions.question_type (F5). Null = unsupported.
create or replace function public.adm_map_question_type(p_type text) returns text
language sql immutable set search_path = public, extensions as $$
  select case lower(btrim(coalesce(p_type, '')))
    when 'objective' then 'multiple_choice' when 'mcq' then 'multiple_choice'
    when 'mcq_single' then 'multiple_choice' when 'single' then 'multiple_choice'
    when 'mcq_multi' then 'multiple_choice' when 'multi_select' then 'multiple_choice'
    when 'multiple_choice' then 'multiple_choice'
    when 'true_false' then 'true_false' when 'truefalse' then 'true_false'
    when 'numerical' then 'fill_in_blank' when 'numeric' then 'fill_in_blank'
    when 'fill_blank' then 'fill_in_blank' when 'fill_in_blank' then 'fill_in_blank'
    when 'short_answer' then 'short_answer'
    when 'subjective' then 'short_answer' when 'long_answer' then 'short_answer' when 'descriptive' then 'short_answer'
    else null end;
$$;

-- Lead type -> UI type, for questions written by the lead's own app (no admin row).
create or replace function public.adm_ui_question_type(p_lead text) returns text
language sql immutable set search_path = public, extensions as $$
  select case p_lead
    when 'multiple_choice' then 'mcq' when 'true_false' then 'true_false'
    when 'fill_in_blank' then 'fill_blank' when 'short_answer' then 'short_answer'
    else coalesce(p_lead, 'mcq') end;
$$;

-- D9: subjects are the lead's categories, matched by name, read-only.
create or replace function public.adm_subject_category(p_name text) returns uuid
language sql stable security definer set search_path = public, extensions as $$
  select c.id from public.categories c
   where nullif(btrim(coalesce(p_name, '')), '') is not null and lower(c.name) = lower(btrim(p_name))
   order by c.is_active desc, c.created_at
   limit 1;
$$;

-- ------------------------------------------------------------ read models
-- One row per non-deleted test series (lead row + optional admin row).
-- The availability window is read from the lead's columns; start_date /
-- end_date are their dates in Asia/Kolkata.
create or replace function public.adm_series_rows()
returns table (
  id uuid, code text, title text, about text, instructions text, who_for text, audience text, syllabus text,
  status text, pricing text, price_inr numeric, is_free boolean,
  subject_category_id uuid, subject_name text, grade text, exam text, level text, languages text[],
  availability_mode text, start_date date, end_date date, go_live_mode text, go_live_at timestamptz,
  monthly_limit int, access_days int, late_allowed boolean, late_grace_minutes int, build_deadline date,
  start_method text, cover_path text, wizard_state jsonb,
  course_id uuid, course_title text, course_educator_id uuid, is_house_course boolean, has_admin_row boolean,
  published_at timestamptz, created_by uuid, created_at timestamptz, updated_at timestamptz, timeline text
)
language sql stable security definer set search_path = public, extensions as $$
  with h as (select public.adm_house_course_id() as house_id)
  select s.id, sa.code, s.title, s.description, s.instructions, sa.who_for, sa.audience, sa.syllabus,
         st.status, pr.pricing, pr.price_inr, pr.price_inr = 0,
         coalesce(sa.subject_category_id, c.category_id), coalesce(cat.name, sa.subject_label),
         sa.grade, sa.exam, coalesce(sa.level, initcap(nullif(c.level, 'all_levels'))),
         case when coalesce(cardinality(sa.languages), 0) > 0 then sa.languages
              when c.language is not null then array[c.language] else '{}'::text[] end,
         case when s.available_until is not null then 'window' else 'always' end,
         (s.available_from at time zone 'Asia/Kolkata')::date, (s.available_until at time zone 'Asia/Kolkata')::date,
         coalesce(sa.go_live_mode, 'now'), sa.go_live_at,
         sa.monthly_limit, sa.access_days, coalesce(sa.late_allowed, false), sa.late_grace_minutes, sa.build_deadline,
         sa.start_method, sa.cover_path, sa.wizard_state,
         s.course_id, c.title, c.educator_id, coalesce(s.course_id = h.house_id, false), sa.series_id is not null,
         sa.published_at, sa.created_by, s.created_at, greatest(s.updated_at, sa.updated_at),
         case when st.status in ('draft', 'archived') then 'unscheduled'
              when s.available_from is not null and now() < s.available_from then 'upcoming'
              when s.available_until is not null and now() > s.available_until then 'ended'
              else 'ongoing' end
    from public.test_series s
    cross join h
    left join public.test_series_admin sa on sa.series_id = s.id
    left join public.courses c on c.id = s.course_id
    left join public.categories cat on cat.id = coalesce(sa.subject_category_id, c.category_id)
    cross join lateral (select case
        when sa.series_id is not null then sa.status   -- 'scheduled' until release_scheduled_series() runs
        when not s.is_active then 'archived'
        when s.is_published then 'published'
        else 'draft' end as status) st
    cross join lateral (select
        coalesce(sa.pricing,
                 case when s.course_id is distinct from h.house_id and coalesce(c.price, 0) > 0 then 'paid' else 'free' end) as pricing,
        coalesce(sa.price_inr,
                 case when s.course_id is distinct from h.house_id then coalesce(c.price, 0) else 0 end)::numeric as price_inr) pr
   where sa.deleted_at is null;
$$;

-- Students with access to a series: admin-sold enrolments plus, for series on a
-- real (non-house) course, active course enrolments (the lead's access model).
create or replace function public.adm_series_students()
returns table (series_id uuid, student_id uuid, enrolled_at timestamptz, source text)
language sql stable security definer set search_path = public, extensions as $$
  select ase.series_id, ase.student_id, ase.enrolled_at, 'admin'::text
    from public.admin_series_enrollments ase where ase.revoked_at is null
  union all
  select s.id, e.student_id, e.enrolled_at, 'course'::text
    from public.test_series s
    join public.enrollments e on e.course_id = s.course_id and e.is_active
   where s.course_id is distinct from public.adm_house_course_id();
$$;

-- Educators attached to a series: active assignments, plus the course educator
-- for series on a real course.
create or replace function public.adm_series_educators()
returns table (series_id uuid, educator_id uuid, educator_name text)
language sql stable security definer set search_path = public, extensions as $$
  select distinct x.series_id, x.educator_id, p.full_name
    from (select a.series_id, a.educator_id from public.test_assignments a
           where a.status not in ('cancelled', 'rejected')
          union
          select s.id, c.educator_id from public.test_series s join public.courses c on c.id = s.course_id
           where s.course_id is distinct from public.adm_house_course_id()) x
    join public.profiles p on p.id = x.educator_id;
$$;

-- ----------------------------------------------------------- JSON builders
create or replace function public.adm_question_json(p_question uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', qq.id, 'test_id', qq.quiz_id, 'position', qq.sort_order,
           'type', coalesce(qa.admin_type, public.adm_ui_question_type(qq.question_type)),
           'lead_type', qq.question_type, 'body', qq.question_text, 'marks', qq.points,
           'negative_marks', coalesce(qa.negative_marks, 0), 'difficulty', coalesce(qa.difficulty, 'medium'),
           'subject', qa.subject, 'topic', qa.topic, 'explanation', qq.explanation,
           'answer_instructions', qa.answer_instructions, 'image_path', qa.image_path,
           'source', coalesce(qa.source, 'manual'), 'section_id', qa.section_id,
           'needs_manual_grading', coalesce(qa.needs_manual_grading, false),
           'options', coalesce((
             select jsonb_agg(jsonb_build_object('id', o.id, 'option_key', chr(64 + o.rn::int), 'label', o.option_text,
                                                 'is_correct', o.is_correct, 'position', o.sort_order) order by o.rn)
               from (select x.*, row_number() over (order by x.sort_order, x.id) as rn
                       from public.quiz_question_options x where x.question_id = qq.id) o), '[]'::jsonb))
    from public.quiz_questions qq
    left join public.quiz_question_admin qa on qa.question_id = qq.id
   where qq.id = p_question;
$$;

create or replace function public.adm_test_json(p_quiz uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
           'id', q.id, 'series_id', q.series_id, 'position', q.series_sort_order, 'title', q.title,
           'instructions', q.description, 'duration_minutes', coalesce(q.time_limit_mins, 60),
           'total_marks', coalesce(nullif(m.marks_sum, 0), qa.total_marks_planned, 0),
           'passing_percent', q.passing_score, 'passing_marks', qa.passing_marks,
           'attempt_limit', q.max_attempts, 'scheduled_at', qa.scheduled_at,
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

-- One series row with the list counters (same keys as the archived v_test_series_list).
create or replace function public.adm_series_json(p_series uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select to_jsonb(r) || jsonb_build_object(
           'icon_key', null::text,
           'test_count', (select count(*) from public.quizzes q where q.series_id = r.id),
           'enrollments', (select count(distinct st.student_id) from public.adm_series_students() st where st.series_id = r.id),
           'attempts', (select count(*) from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                         where q.series_id = r.id and a.status in ('submitted', 'timed_out')),
           'avg_score', coalesce((select round(avg(a.percentage)) from public.quiz_attempts a join public.quizzes q on q.id = a.quiz_id
                                   where q.series_id = r.id and a.status in ('submitted', 'timed_out')), 0))
    from public.adm_series_rows() r where r.id = p_series;
$$;

-- ---------------------------------------------------------------- guards
create or replace function public.adm_require_series(p_id uuid) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_id is null or not exists (select 1 from public.test_series s
                                   left join public.test_series_admin sa on sa.series_id = s.id
                                  where s.id = p_id and sa.deleted_at is null) then
    raise exception 'Test series not found.' using errcode = 'P0002';
  end if;
end $$;

-- Returns the quiz's series id; raises when the quiz or its series is gone.
create or replace function public.adm_require_quiz(p_id uuid) returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_series uuid;
begin
  select q.series_id into v_series
    from public.quizzes q
    left join public.test_series_admin sa on sa.series_id = q.series_id
   where q.id = p_id and q.series_id is not null and sa.deleted_at is null;
  if v_series is null then
    raise exception 'Test not found.' using errcode = 'P0002';
  end if;
  return v_series;
end $$;

-- ------------------------------------------------------ series admin rows
-- Lazily creates the admin row for a series the lead's app created, seeded
-- from its current state so nothing visible changes.
create or replace function public.adm_ensure_series_admin(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.test_series_admin
    (series_id, status, pricing, price_inr, go_live_mode, go_live_at, start_method)
  select r.id, r.status, r.pricing, r.price_inr, 'now', null::timestamptz, 'manual'
    from public.adm_series_rows() r
   where r.id = p_id
  on conflict (series_id) do nothing;
$$;

-- Pushes the admin status to the lead's flags (D3): only 'published' ->
-- is_published (a 'scheduled' series stays unpublished until
-- release_scheduled_series() flips it); archived or soft-deleted ->
-- is_active = false.
create or replace function public.adm_sync_series_to_lead(p_id uuid) returns void
language sql security definer set search_path = public, extensions as $$
  update public.test_series s
     set is_published = sa.status = 'published' and sa.deleted_at is null,
         is_active    = sa.deleted_at is null and sa.status <> 'archived',
         updated_at   = now()
    from public.test_series_admin sa
   where sa.series_id = s.id and s.id = p_id;
$$;

-- Writes the access window to the lead's available_from / available_until
-- (dates are Asia/Kolkata days; the close day is inclusive). These columns
-- hold only the access window; go-live lives in test_series_admin.go_live_at.
create or replace function public.adm_set_series_availability(p_id uuid, p_open date, p_close date) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_from  timestamptz := p_open::timestamp at time zone 'Asia/Kolkata';
  v_until timestamptz := ((p_close + 1)::timestamp at time zone 'Asia/Kolkata') - interval '1 second';
begin
  if v_from is not null and v_until is not null and v_until <= v_from then
    raise exception 'The closing time must be after the opening time.' using errcode = '22023';
  end if;
  update public.test_series
     set available_from = v_from, available_until = v_until, updated_at = now()
   where id = p_id;
end $$;

-- New series on the house course (D2) with its admin row.
create or replace function public.adm_new_house_series(p_title text, p_about text, p_start_method text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_house uuid := public.adm_house_course_id();
  v_id    uuid;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if v_house is null then
    raise exception 'The admin house course is not configured (platform_settings admin_house_course_id).' using errcode = 'P0001';
  end if;
  if v_title is null then
    raise exception 'Series name is required.' using errcode = '22023';
  end if;
  insert into public.test_series (course_id, title, description, is_active, is_published)
  values (v_house, left(v_title, 150), nullif(p_about, ''), true, false)
  returning id into v_id;
  insert into public.test_series_admin (series_id, status, start_method, created_by)
  values (v_id, 'draft',
          case when p_start_method in ('scratch', 'duplicate', 'csv', 'ai', 'manual') then p_start_method end,
          auth.uid());
  return v_id;
end $$;

-- ------------------------------------------------- question / option writers
-- The single correct option of a text-answer question: accepted answer
-- (correctAnswer / answer / correctAnswers[0]), else the model answer
-- (modelAnswer / model_answer), else a placeholder. Never null.
create or replace function public.adm_text_answer(q jsonb) returns text
language sql immutable set search_path = public, extensions as $$
  select coalesce(nullif(btrim(coalesce(q ->> 'correctAnswer', '')), ''),
                  nullif(btrim(coalesce(q ->> 'answer', '')), ''),
                  nullif(btrim(coalesce(q -> 'correctAnswers' ->> 0, '')), ''),
                  nullif(btrim(coalesce(q ->> 'modelAnswer', '')), ''),
                  nullif(btrim(coalesce(q ->> 'model_answer', '')), ''),
                  'Manual grading: see rubric');
$$;

-- q accepts the wizard shape {options:[{key,text}], correctAnswers:[...]}, the
-- editor shape {optionA..optionF, correctAnswer} or {options:[{label,is_correct}]}.
create or replace function public.adm_insert_options(p_question uuid, p_lead text, q jsonb) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_opts jsonb;
  v_keys text[];
  o      jsonb;
  i      int := 0;
  v_key  text;
  v_text text;
begin
  -- Text answers: the lead's publish rule needs a correct option on every
  -- question, so every fill_in_blank / short_answer question (including the
  -- manually graded subjective / long_answer / descriptive ones) gets exactly
  -- one correct option: the accepted answer, else the model answer, else the
  -- placeholder 'Manual grading: see rubric'. needs_manual_grading stays in
  -- quiz_question_admin.
  if p_lead in ('fill_in_blank', 'short_answer') then
    v_text := public.adm_text_answer(q);
    insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
    values (p_question, v_text, true, 1);
    return 1;
  end if;
  if p_lead not in ('multiple_choice', 'true_false') then return 0; end if;

  if jsonb_typeof(q -> 'options') = 'array' then
    v_opts := q -> 'options';
  else
    select coalesce(jsonb_agg(jsonb_build_object('key', k, 'text', q ->> ('option' || k)) order by k), '[]'::jsonb)
      into v_opts
      from unnest(array['A', 'B', 'C', 'D', 'E', 'F']) as k
     where q ? ('option' || k);
  end if;

  select coalesce(array_agg(upper(btrim(x))), '{}') into v_keys
    from jsonb_array_elements_text(
           case when jsonb_typeof(q -> 'correctAnswers') = 'array' then q -> 'correctAnswers'
                when nullif(btrim(coalesce(q ->> 'correctAnswer', '')), '') is not null then jsonb_build_array(q ->> 'correctAnswer')
                else '[]'::jsonb end) x;

  if p_lead = 'true_false' and jsonb_array_length(v_opts) = 0 then
    v_opts := '[{"key":"A","text":"True"},{"key":"B","text":"False"}]'::jsonb;
  end if;

  for o in select * from jsonb_array_elements(v_opts) loop
    v_text := nullif(btrim(coalesce(o ->> 'text', o ->> 'label', '')), '');
    continue when v_text is null;
    i := i + 1;
    v_key := upper(coalesce(nullif(o ->> 'key', ''), nullif(o ->> 'option_key', ''), chr(64 + i)));
    insert into public.quiz_question_options (question_id, option_text, is_correct, sort_order)
    values (p_question, v_text,
            v_key = any (v_keys) or upper(v_text) = any (v_keys)
              or coalesce((o ->> 'is_correct')::boolean, (o ->> 'isCorrect')::boolean, false),
            i);
  end loop;
  return i;
end $$;

-- Returns null (and writes nothing) when the question text is blank.
create or replace function public.adm_insert_question(
  p_quiz uuid, p_pos int, q jsonb, p_section uuid default null, p_source text default 'manual'
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_text   text := coalesce(nullif(btrim(coalesce(q ->> 'text', '')), ''), nullif(btrim(coalesce(q ->> 'body', '')), ''));
  v_type   text := lower(coalesce(nullif(btrim(coalesce(q ->> 'type', '')), ''), 'objective'));
  v_diff   text := lower(coalesce(nullif(btrim(coalesce(q ->> 'difficulty', '')), ''), 'medium'));
  v_source text := coalesce(nullif(q ->> 'source', ''), p_source, 'manual');
  v_lead   text;
  v_qid    uuid;
begin
  if v_text is null then return null; end if;
  v_lead := public.adm_map_question_type(v_type);
  if v_lead is null then
    raise exception 'Unsupported question type: %', v_type using errcode = '22023';
  end if;
  if v_diff not in ('easy', 'medium', 'hard') then v_diff := 'medium'; end if;
  if v_source not in ('manual', 'ai', 'csv', 'duplicate', 'paste') then v_source := 'manual'; end if;

  insert into public.quiz_questions (quiz_id, question_text, question_type, points, explanation, sort_order)
  values (p_quiz, v_text, v_lead, coalesce(nullif(q ->> 'marks', '')::numeric, 4),
          nullif(btrim(coalesce(q ->> 'explanation', '')), ''), coalesce(p_pos, 0))
  returning id into v_qid;

  insert into public.quiz_question_admin
    (question_id, admin_type, needs_manual_grading, section_id, negative_marks, difficulty, subject, topic,
     image_path, answer_instructions, source, ai_job_id)
  values
    (v_qid, v_type, v_type in ('subjective', 'long_answer', 'descriptive'), p_section,
     greatest(coalesce(nullif(q ->> 'negativeMarks', '')::numeric, nullif(q ->> 'negative_marks', '')::numeric, 0), 0),
     v_diff, nullif(btrim(coalesce(q ->> 'subject', '')), ''), nullif(btrim(coalesce(q ->> 'topic', '')), ''),
     nullif(coalesce(q ->> 'image', q ->> 'image_path', ''), ''),
     coalesce(nullif(q ->> 'answerInstructions', ''), nullif(q ->> 'rubric', ''), nullif(q ->> 'answer_instructions', '')),
     v_source, nullif(q ->> 'aiJobId', '')::uuid);

  perform public.adm_insert_options(v_qid, v_lead, q);
  return v_qid;
end $$;

-- Applies the test form fields present in p (create and update share this).
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
    topics              = case when jsonb_typeof(p -> 'topics') = 'array'
                               then coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(p -> 'topics') x where btrim(x) <> ''), '{}')
                               else topics end
  where quiz_id = p_quiz;
end $$;

-- ------------------------------------------------------ delete / copy quiz
-- Lead FKs do not cascade: options -> questions -> quiz, in that order.
create or replace function public.adm_delete_quiz(p_quiz uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from public.quiz_attempts where quiz_id = p_quiz) then
    raise exception 'This test already has student attempts and cannot be deleted or replaced.' using errcode = '23503';
  end if;
  delete from public.quiz_question_options o using public.quiz_questions qq
   where o.question_id = qq.id and qq.quiz_id = p_quiz;
  delete from public.quiz_questions where quiz_id = p_quiz;
  delete from public.quizzes where id = p_quiz;
end $$;

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
           qa.subject, qa.topic, qa.image_path, qa.answer_instructions
      from public.quiz_questions x
      left join public.quiz_question_admin qa on qa.question_id = x.id
     where x.quiz_id = p_src
     order by x.sort_order, x.created_at
  loop
    insert into public.quiz_questions (quiz_id, question_text, question_type, points, explanation, sort_order)
    values (v_new, qq.question_text, qq.question_type, qq.points, qq.explanation, qq.sort_order)
    returning id into v_nq;
    insert into public.quiz_question_admin (question_id, admin_type, needs_manual_grading, section_id, negative_marks,
                                            difficulty, subject, topic, image_path, answer_instructions, source)
    values (v_nq, coalesce(qq.admin_type, public.adm_ui_question_type(qq.question_type)),
            coalesce(qq.needs_manual_grading, false),
            case when qq.section_id is not null then nullif(v_map ->> qq.section_id::text, '')::uuid end,
            coalesce(qq.negative_marks, 0), coalesce(qq.difficulty, 'medium'), qq.subject, qq.topic,
            qq.image_path, qq.answer_instructions, 'duplicate');
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

-- ------------------------------------------------------- publish helpers
-- Same rule and messages as the lead's publish_test_series(uuid, boolean):
-- every quiz needs a question, and every question a correct option.
create or replace function public.adm_validate_quiz_for_publish(p_quiz uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case
    when m.total = 0 then format('"%s" has no questions.', q.title)
    when m.no_correct > 0 then format('"%s" has %s question(s) without a correct answer.', q.title, m.no_correct)
    else null end
    from public.quizzes q
    cross join lateral (
      select count(*) as total,
             count(*) filter (where not exists (select 1 from public.quiz_question_options o
                                                  where o.question_id = qq.id and o.is_correct)) as no_correct
        from public.quiz_questions qq where qq.quiz_id = q.id) m
   where q.id = p_quiz;
$$;

-- An approved assignment whose test is published becomes completed.
create or replace function public.adm_complete_assignments_for_quiz(p_quiz uuid) returns void
language sql security definer set search_path = public, extensions as $$
  with u as (
    update public.test_assignments set status = 'completed'
     where test_id = p_quiz and status = 'approved'
    returning id
  )
  insert into public.assignment_history (assignment_id, action, by_user, note)
  select id, 'Completed', auth.uid(), 'Linked test was published.' from u;
$$;

-- -------------------------------------------------------- assignments
create or replace function public.adm_asg_log(p_id uuid, p_action text, p_note text) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.assignment_history (assignment_id, action, by_user, note) values (p_id, p_action, auth.uid(), p_note);
$$;

create or replace function public.adm_asg_notify(p_id uuid, p_type text, p_title text, p_msg text) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.assignment_notifications (assignment_id, educator_id, type, title, message)
  select id, educator_id, p_type, p_title, p_msg from public.test_assignments where id = p_id;
$$;

-- Verified (lead value) and active (admin state) educators.
create or replace function public.adm_eligible_educators()
returns table (id uuid, name text, subjects text[])
language sql stable security definer set search_path = public, extensions as $$
  select p.id, coalesce(ep.full_name, p.full_name), coalesce(ep.subjects::text[], '{}'::text[])
    from public.profiles p
    join public.educator_profiles ep on ep.user_id = p.id
    left join public.educator_admin_state st on st.user_id = p.id
   where p.role = 'educator' and ep.verification_status = 'verified'
     and coalesce(st.account_status, 'active') = 'active';
$$;

-- Same columns as the archived v_assignments_list.
create or replace function public.adm_assignment_rows()
returns table (
  id uuid, code text, series_id uuid, series_name text, subject text, topics text[],
  educator_id uuid, educator_name text, test_name text, question_count int, question_type_mix text,
  difficulty text, total_marks numeric, duration_minutes int, instructions text, assigned_date date,
  deadline date, status text, display_status text, progress int, submitted_at timestamptz,
  overall_feedback text, decision text, decision_at timestamptz, decision_reason text, cancel_reason text,
  request_id uuid, test_id uuid, created_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select a.id, a.code, a.series_id, s.title, a.subject, a.topics, a.educator_id, p.full_name, a.test_name,
         a.question_count, a.question_type_mix, a.difficulty, a.total_marks, a.duration_minutes, a.instructions,
         a.assigned_date, a.deadline, a.status,
         case when a.status not in ('approved', 'completed', 'cancelled', 'rejected')
               and a.deadline is not null and a.deadline < current_date then 'overdue' else a.status end,
         coalesce(pr.progress, 0), a.submitted_at, a.overall_feedback, a.decision, a.decision_at,
         a.decision_reason, a.cancel_reason, a.request_id, a.test_id, a.created_at
    from public.test_assignments a
    join public.test_series s on s.id = a.series_id
    left join public.test_series_admin sa on sa.series_id = s.id
    left join public.profiles p on p.id = a.educator_id
    left join public.assignment_status_progress pr on pr.status = a.status
   where sa.deleted_at is null;
$$;

-- ------------------------------------------------------------------ grants
revoke all on function public.adm_house_course_id() from public, anon, authenticated;
revoke all on function public.adm_norm_text(text) from public, anon, authenticated;
revoke all on function public.adm_map_question_type(text) from public, anon, authenticated;
revoke all on function public.adm_ui_question_type(text) from public, anon, authenticated;
revoke all on function public.adm_subject_category(text) from public, anon, authenticated;
revoke all on function public.adm_series_rows() from public, anon, authenticated;
revoke all on function public.adm_series_students() from public, anon, authenticated;
revoke all on function public.adm_series_educators() from public, anon, authenticated;
revoke all on function public.adm_question_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_test_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_series_json(uuid) from public, anon, authenticated;
revoke all on function public.adm_require_series(uuid) from public, anon, authenticated;
revoke all on function public.adm_require_quiz(uuid) from public, anon, authenticated;
revoke all on function public.adm_ensure_series_admin(uuid) from public, anon, authenticated;
revoke all on function public.adm_sync_series_to_lead(uuid) from public, anon, authenticated;
revoke all on function public.adm_set_series_availability(uuid, date, date) from public, anon, authenticated;
revoke all on function public.adm_new_house_series(text, text, text) from public, anon, authenticated;
revoke all on function public.adm_text_answer(jsonb) from public, anon, authenticated;
revoke all on function public.adm_insert_options(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.adm_insert_question(uuid, int, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.adm_apply_test_fields(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.adm_delete_quiz(uuid) from public, anon, authenticated;
revoke all on function public.adm_copy_quiz(uuid, uuid, int, text) from public, anon, authenticated;
revoke all on function public.adm_validate_quiz_for_publish(uuid) from public, anon, authenticated;
revoke all on function public.adm_complete_assignments_for_quiz(uuid) from public, anon, authenticated;
revoke all on function public.adm_asg_log(uuid, text, text) from public, anon, authenticated;
revoke all on function public.adm_asg_notify(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.adm_eligible_educators() from public, anon, authenticated;
revoke all on function public.adm_assignment_rows() from public, anon, authenticated;
