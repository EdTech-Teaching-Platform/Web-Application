set search_path = public, extensions;
set check_function_bodies = off;
-- ----------------------------------------------------------- TEST SERIES
create table if not exists test_series (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique,                           -- TS-1001 (search by ID)
  title              text not null check (char_length(btrim(title)) between 3 and 150),
  about              text,                                  -- rich text
  who_for            text,
  audience           text,                                  -- "JEE Aspirants"
  syllabus           text,                                  -- rich text
  series_type        text not null default 'own' check (series_type = 'own'),
  start_method       start_method,
  pricing            pricing_type not null default 'free',
  price_inr          numeric(10,2) not null default 0 check (price_inr >= 0),
  is_free            boolean generated always as (price_inr = 0) stored,
  grade              text,
  subject_id         uuid references subjects(id),
  exam               text,
  level              text check (level in ('Beginner','Intermediate','Advanced')),
  languages          text[] not null default '{}',
  go_live_mode       text not null default 'now' check (go_live_mode in ('now','schedule')),
  go_live_at         timestamptz,
  availability_mode  text not null default 'always' check (availability_mode in ('always','window')),
  start_date         date,                                  -- list page "Date Range"
  end_date           date,
  monthly_limit      int check (monthly_limit is null or monthly_limit >= 1),   -- null = unlimited
  access_days        int check (access_days   is null or access_days   >= 1),   -- null = lifetime
  late_allowed       boolean not null default false,
  late_grace_minutes int check (late_grace_minutes is null or late_grace_minutes > 0),
  build_deadline     date,
  status             series_status not null default 'draft',
  published_at       timestamptz,
  cover_path         text,
  wizard_state       jsonb,                                 -- draft autosave
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,                           -- soft delete (three dots > Delete)
  constraint chk_paid_price check (pricing = 'free' or price_inr > 0),
  constraint chk_window     check (availability_mode <> 'window' or (start_date is not null and end_date is not null and end_date >= start_date)),
  constraint chk_golive     check (go_live_mode <> 'schedule' or go_live_at is not null),
  constraint chk_late       check (not late_allowed or late_grace_minutes is not null)
);
create trigger trg_series_updated before update on test_series for each row execute function set_updated_at();
create sequence if not exists test_series_code_seq start 1001;
create or replace function gen_series_code() returns trigger language plpgsql as
$$ begin if new.code is null then new.code := 'TS-' || nextval('test_series_code_seq'); end if; return new; end $$;
create trigger trg_series_code before insert on test_series for each row execute function gen_series_code();
-- ----------------------------------------------------------------- TESTS
create table if not exists tests (
  id                uuid primary key default gen_random_uuid(),
  series_id         uuid not null references test_series(id) on delete cascade,
  position          int  not null default 1,
  title             text not null,
  instructions      text,
  duration_minutes  int  not null default 60 check (duration_minutes > 0),
  total_marks       numeric(8,2) not null default 0,
  passing_percent   numeric(5,2) default 40 check (passing_percent between 0 and 100),
  passing_marks     numeric(8,2),
  attempt_limit     int  not null default 1 check (attempt_limit >= 1),
  window_mode       text not null default 'inherit' check (window_mode in ('inherit','custom')),
  open_at           timestamptz,
  close_at          timestamptz,
  scheduled_at      timestamptz,
  shuffle_questions boolean not null default false,
  shuffle_options   boolean not null default false,
  planned_questions int not null default 0,
  topics            text[] not null default '{}',
  status            test_status not null default 'draft',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint chk_test_window check (window_mode <> 'custom' or (open_at is not null and close_at is not null and open_at < close_at)),
  unique (series_id, position) deferrable initially deferred
);
create trigger trg_tests_updated before update on tests for each row execute function set_updated_at();
create table if not exists test_sections (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references tests(id) on delete cascade,
  position     int  not null,
  name         text not null,
  instructions text,
  planned_questions int,
  planned_marks     numeric(8,2),
  unique (test_id, position)
);
-- ------------------------------------------------------------- QUESTIONS
create table if not exists ai_test_jobs (
  id                      uuid primary key default gen_random_uuid(),
  requested_by            uuid not null references profiles(id),
  input_source            ai_input_source not null default 'form',
  pasted_text             text,
  test_name               text not null,
  subject_id              uuid references subjects(id),
  custom_subject          text,
  topics                  text[] default '{}',
  exam_type               text,
  difficulty              text check (difficulty in ('Easy','Medium','Hard','Mixed')),
  total_marks             int,
  duration_minutes        int,
  num_questions           int check (num_questions between 1 and 300),
  num_sections            int check (num_sections between 1 and 10),
  question_types          text[] default '{mcq}',
  negative_marking        boolean default false,
  negative_mark_value     numeric(4,2) default 1,
  language                text default 'English',
  additional_instructions text,
  generation_mode         ai_gen_mode not null default 'full',
  status                  ai_job_status not null default 'queued',
  structure               jsonb,
  model                   text,
  prompt                  text,
  input_tokens            int default 0,
  output_tokens           int default 0,
  cost_usd                numeric(10,4) default 0,
  attempts                int default 0,
  error                   text,
  series_id               uuid references test_series(id),
  test_id                 uuid references tests(id),
  created_at              timestamptz default now(),
  started_at              timestamptz,
  completed_at            timestamptz
);
create table if not exists questions (
  id                  uuid primary key default gen_random_uuid(),
  test_id             uuid not null references tests(id) on delete cascade,
  section_id          uuid references test_sections(id) on delete set null,
  position            int  not null default 1,
  type                question_type not null default 'mcq',
  is_objective        boolean generated always as (type in ('mcq','multi_select','true_false')) stored,
  body                text not null,
  image_path          text,
  marks               numeric(6,2) not null default 4 check (marks >= 0),
  negative_marks      numeric(6,2) not null default 0 check (negative_marks >= 0),
  difficulty          difficulty_lvl not null default 'medium',
  subject             text,
  topic               text,
  explanation         text,
  answer_instructions text,
  source              text not null default 'manual' check (source in ('manual','ai','csv','duplicate','paste')),
  ai_job_id           uuid references ai_test_jobs(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (test_id, position) deferrable initially deferred
);
create trigger trg_questions_updated before update on questions for each row execute function set_updated_at();
create table if not exists question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  position    int  not null,
  option_key  text not null check (option_key in ('A','B','C','D','E','F')),
  label       text not null,
  image_path  text,
  is_correct  boolean not null default false,
  unique (question_id, position),
  unique (question_id, option_key)
);
create or replace function sync_test_marks() returns trigger language plpgsql as
$$ declare t uuid := coalesce(new.test_id, old.test_id);
begin
  update tests set total_marks = coalesce((select sum(marks) from questions where test_id = t), 0) where id = t;
  return null;
end $$;
create trigger trg_sync_marks after insert or update or delete on questions for each row execute function sync_test_marks();
-- --------------------------------------------------- AI GENERATED QUESTIONS
create table if not exists ai_generated_questions (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references ai_test_jobs(id) on delete cascade,
  section_position    int,
  position            int not null,
  type                question_type not null default 'mcq',
  body                text not null,
  options             jsonb,                         -- [{key:'A', text:'...'}]
  correct_keys        text[] default '{}',
  marks               numeric(6,2) default 4,
  negative_marks      numeric(6,2) default 0,
  difficulty          difficulty_lvl default 'medium',
  subject             text,
  topic               text,
  explanation         text,
  answer_instructions text,
  issues              text[] default '{}',
  review_state        text not null default 'pending' check (review_state in ('pending','accepted','edited','rejected')),
  unique (job_id, position)
);
-- ------------------------------------------- ENROLMENTS, ATTEMPTS, ANSWERS
create table if not exists series_enrollments (
  id          uuid primary key default gen_random_uuid(),
  series_id   uuid not null references test_series(id) on delete cascade,
  student_id  uuid not null references profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  expires_at  timestamptz,
  amount_paid numeric(10,2) default 0,
  unique (series_id, student_id)
);
create table if not exists test_attempts (
  id           uuid primary key default gen_random_uuid(),
  test_id      uuid not null references tests(id) on delete cascade,
  series_id    uuid not null references test_series(id) on delete cascade,
  student_id   uuid not null references profiles(id) on delete cascade,
  attempt_no   int  not null default 1,
  status       attempt_status not null default 'in_progress',
  is_late      boolean default false,
  score        numeric(8,2),
  max_score    numeric(8,2),
  percentage   numeric(5,2) generated always as (case when max_score > 0 then round(score / max_score * 100, 2) end) stored,
  started_at   timestamptz not null default now(),
  submitted_at timestamptz,
  unique (test_id, student_id, attempt_no)
);
create table if not exists attempt_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references test_attempts(id) on delete cascade,
  question_id         uuid not null references questions(id) on delete cascade,
  selected_option_ids uuid[],
  text_answer         text,
  is_correct          boolean,
  marks_awarded       numeric(6,2),
  graded_by           uuid references profiles(id),
  feedback            text,
  unique (attempt_id, question_id)
);
create or replace function enforce_attempt_limit() returns trigger language plpgsql as
$$ declare lim int; used int; sid uuid;
begin
  select attempt_limit, series_id into lim, sid from tests where id = new.test_id;
  select count(*) into used from test_attempts where test_id = new.test_id and student_id = new.student_id;
  if used >= lim then raise exception 'Attempt limit (%) reached for this test', lim; end if;
  new.series_id := sid; new.attempt_no := used + 1;
  return new;
end $$;
create trigger trg_attempt_limit before insert on test_attempts for each row execute function enforce_attempt_limit();
-- per-test custom window must sit inside the series window
create or replace function check_test_window() returns trigger language plpgsql as
$$ declare s test_series;
begin
  if new.window_mode = 'custom' then
    select * into s from test_series where id = new.series_id;
    if s.availability_mode = 'window' and (new.open_at::date < s.start_date or new.close_at::date > s.end_date) then
      raise exception 'Test window must fall inside the series window (% to %)', s.start_date, s.end_date;
    end if;
  end if;
  return new;
end $$;
create trigger trg_test_window before insert or update on tests for each row execute function check_test_window();
-- ---------------------------------------------------------------- INDEXES
create index if not exists idx_series_status   on test_series(status)    where deleted_at is null;
create index if not exists idx_series_price    on test_series(price_inr) where deleted_at is null;
create index if not exists idx_series_dates    on test_series(start_date, end_date) where deleted_at is null;
create index if not exists idx_series_subject  on test_series(subject_id);
create index if not exists idx_series_created  on test_series(created_at desc);
create index if not exists idx_series_golive   on test_series(go_live_at) where status = 'scheduled';
create index if not exists idx_series_title_lc on test_series(lower(title)) where deleted_at is null;
create index if not exists idx_series_search   on test_series using gin ((title || ' ' || coalesce(audience,'') || ' ' || coalesce(code,'')) gin_trgm_ops);
create index if not exists idx_tests_series    on tests(series_id, position);
create index if not exists idx_sections_test   on test_sections(test_id, position);
create index if not exists idx_questions_test  on questions(test_id, position);
create index if not exists idx_questions_sect  on questions(section_id);
create index if not exists idx_options_q       on question_options(question_id);
create index if not exists idx_ai_jobs_user    on ai_test_jobs(requested_by, created_at desc);
create index if not exists idx_ai_gen_job      on ai_generated_questions(job_id, position);
create table if not exists test_assignments (
  id          uuid primary key default gen_random_uuid(),
  series_id   uuid not null references test_series(id) on delete cascade,
  educator_id uuid not null references profiles(id),
  test_name   text,
  deadline    date,
  status      assignment_status not null default 'assigned',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_assign_series   on test_assignments(series_id);
create index if not exists idx_assign_edu      on test_assignments(educator_id, status);
create index if not exists idx_enroll_series   on series_enrollments(series_id);
create index if not exists idx_enroll_student  on series_enrollments(student_id);
create index if not exists idx_attempts_series on test_attempts(series_id) where status = 'submitted';
create index if not exists idx_attempts_test   on test_attempts(test_id);
create index if not exists idx_attempts_student on test_attempts(student_id);
create index if not exists idx_answers_attempt on attempt_answers(attempt_id);
-- ====================================================================
-- VIEWS + READ FUNCTIONS (summary cards, search, filters, pagination)
-- ====================================================================
create or replace view v_test_series_list with (security_invoker = true) as
select
  s.id, s.code, s.title, s.status, s.pricing, s.price_inr, s.is_free,
  s.start_date, s.end_date, s.availability_mode, s.audience, s.created_at,
  sub.name as subject_name, sub.icon_key,
  coalesce(t.test_count, 0)  as test_count,
  coalesce(e.enrollments, 0) as enrollments,
  coalesce(a.attempts, 0)    as attempts,
  coalesce(a.avg_score, 0)   as avg_score,
  case
    when s.status = 'draft'             then 'unscheduled'
    when s.availability_mode = 'always' then 'ongoing'
    when current_date < s.start_date    then 'upcoming'
    when current_date > s.end_date      then 'ended'
    else 'ongoing'
  end as timeline
from test_series s
left join subjects sub on sub.id = s.subject_id
left join (select series_id, count(*) test_count from tests group by 1) t on t.series_id = s.id
left join (select series_id, count(*) enrollments from series_enrollments group by 1) e on e.series_id = s.id
left join (select series_id, count(*) attempts, round(avg(percentage)) avg_score
           from test_attempts where status = 'submitted' group by 1) a on a.series_id = s.id
where s.deleted_at is null;
create or replace view v_test_structure with (security_invoker = true) as
select t.id as test_id, t.series_id, s.title as series_title, t.title as test_title,
       t.position, t.duration_minutes, t.total_marks, t.status, count(q.id) as question_count
from tests t
join test_series s on s.id = t.series_id and s.deleted_at is null
left join questions q on q.test_id = t.id
group by t.id, s.title;
create or replace function get_test_series_stats()
returns table (total_series bigint, total_enrolled bigint, total_attempts bigint, avg_performance numeric)
language sql stable security invoker as $$
  select count(*), coalesce(sum(enrollments),0), coalesce(sum(attempts),0),
         coalesce(round(avg(avg_score) filter (where attempts > 0)),0)
  from v_test_series_list;
$$;
create or replace function list_test_series(
  p_search text default null, p_status text default null, p_pricing text default null,
  p_timeline text default null, p_page int default 1, p_size int default 10
) returns table (row_data jsonb, total_count bigint)
language sql stable security invoker as $$
  with f as (
    select * from v_test_series_list v
    where (p_search is null or (v.title || ' ' || coalesce(v.subject_name,'') || ' ' || coalesce(v.audience,'') || ' ' || coalesce(v.code,'')) ilike '%' || p_search || '%')
      and (p_status   is null or v.status::text = p_status)
      and (p_pricing  is null or (p_pricing = 'free' and v.is_free) or (p_pricing = 'paid' and not v.is_free))
      and (p_timeline is null or v.timeline = p_timeline)
  )
  select to_jsonb(f), count(*) over () from f order by created_at desc
  limit p_size offset (greatest(p_page,1) - 1) * p_size;
$$;
-- ====================================================================
-- WRITE FUNCTIONS (Create / Edit / Publish / Duplicate / AI save / autosave)
-- ====================================================================
create or replace function _insert_question(p_test uuid, p_pos int, q jsonb, p_section uuid default null)
returns uuid language plpgsql as $$
declare qid uuid; ty question_type; keys text[]; o jsonb; i int := 0;
begin
  ty := (case q->>'type' when 'objective' then 'mcq' when 'subjective' then 'long_answer' else coalesce(q->>'type','mcq') end)::question_type;
  select coalesce(array_agg(x), '{}') into keys from jsonb_array_elements_text(
    case when q ? 'correctAnswers' then q->'correctAnswers'
         when nullif(q->>'correctAnswer','') is not null then jsonb_build_array(q->>'correctAnswer')
         else '[]'::jsonb end) x;
  insert into questions (test_id, section_id, position, type, body, image_path, marks, negative_marks,
                         difficulty, subject, topic, explanation, answer_instructions, source)
  values (p_test, p_section, p_pos, ty, q->>'text', nullif(q->>'image',''),
          coalesce(nullif(q->>'marks','')::numeric, 4), coalesce(nullif(q->>'negativeMarks','')::numeric, 0),
          coalesce(nullif(q->>'difficulty','')::difficulty_lvl, 'medium'),
          nullif(q->>'subject',''), nullif(q->>'topic',''), nullif(q->>'explanation',''),
          coalesce(nullif(q->>'answerInstructions',''), nullif(q->>'rubric','')),
          coalesce(nullif(q->>'source',''), 'manual'))
  returning id into qid;
  if ty in ('mcq','multi_select','true_false') then
    for o in select * from jsonb_array_elements(coalesce(q->'options','[]'::jsonb)) loop
      i := i + 1;
      continue when coalesce(btrim(o->>'text'),'') = '';
      insert into question_options (question_id, position, option_key, label, is_correct)
      values (qid, i, upper(o->>'key'), o->>'text', upper(o->>'key') = any (keys));
    end loop;
  end if;
  return qid;
end $$;
-- Create Test Series wizard: "Save as draft" (publish=false) and "Publish now / Schedule" (publish=true)
create or replace function upsert_test_series_full(p jsonb, p_publish boolean default false)
returns uuid language plpgsql security invoker as $$
declare
  sid uuid := nullif(p->>'id','')::uuid;
  c jsonb := coalesce(p->'classification','{}'::jsonb);
  a jsonb := coalesce(p->'availability','{}'::jsonb);
  l jsonb := coalesce(p->'lateSubmissions','{}'::jsonb);
  subj uuid; langs text[];
  t jsonb; s jsonb; q jsonb; tid uuid; sec uuid; tpos int := 0; qpos int; spos int;
begin
  if nullif(c->>'subject','') is not null then
    insert into subjects (name, is_custom, created_by) values (c->>'subject', true, auth.uid())
    on conflict (lower(name)) do nothing;
    select id into subj from subjects where lower(name) = lower(c->>'subject');
  end if;
  select coalesce(array_agg(x), '{}') into langs from jsonb_array_elements_text(coalesce(c->'languages','[]'::jsonb)) x;
  if sid is null then
    insert into test_series (title, about, who_for, audience, syllabus, start_method, pricing, price_inr,
        grade, subject_id, exam, level, languages, go_live_mode, go_live_at, availability_mode, start_date, end_date,
        monthly_limit, access_days, late_allowed, late_grace_minutes, build_deadline, wizard_state, created_by)
    values (p->>'name', p->>'about', p->>'whoFor', p->>'audience', p->>'syllabus',
        nullif(p->>'startMethod','')::start_method, coalesce(nullif(p->>'pricing','')::pricing_type,'free'),
        case when p->>'pricing' = 'paid' then coalesce(nullif(p->>'price','')::numeric,0) else 0 end,
        nullif(c->>'grade',''), subj, nullif(c->>'exam',''), nullif(c->>'difficulty',''), langs,
        coalesce(a->>'goLive','now'), nullif(a->>'goLiveAt','')::timestamptz, coalesce(a->>'mode','always'),
        case when a->>'mode' = 'window' then nullif(a->>'openAt','')::date
             else coalesce(nullif(a->>'goLiveAt','')::timestamptz::date, current_date) end,
        case when a->>'mode' = 'window' then nullif(a->>'closeAt','')::date end,
        case when (a->>'monthlyLimited')::boolean then (a->>'monthlyLimit')::int end,
        case when (a->>'accessLimited')::boolean  then (a->>'accessDays')::int  end,
        coalesce((l->>'allowed')::boolean,false),
        case when (l->>'allowed')::boolean then (l->>'graceMinutes')::int end,
        nullif(p->>'buildDeadline','')::date, p->'wizardState', auth.uid())
    returning id into sid;
  else
    if exists (select 1 from test_attempts where series_id = sid) then
      raise exception 'This series already has attempts; edit tests and questions individually instead of replacing them.';
    end if;
    update test_series set
      title = p->>'name', about = p->>'about', who_for = p->>'whoFor', audience = p->>'audience', syllabus = p->>'syllabus',
      pricing = coalesce(nullif(p->>'pricing','')::pricing_type,'free'),
      price_inr = case when p->>'pricing' = 'paid' then coalesce(nullif(p->>'price','')::numeric,0) else 0 end,
      grade = nullif(c->>'grade',''), subject_id = subj, exam = nullif(c->>'exam',''), level = nullif(c->>'difficulty',''), languages = langs,
      go_live_mode = coalesce(a->>'goLive','now'), go_live_at = nullif(a->>'goLiveAt','')::timestamptz,
      availability_mode = coalesce(a->>'mode','always'),
      start_date = case when a->>'mode' = 'window' then nullif(a->>'openAt','')::date
                        else coalesce(nullif(a->>'goLiveAt','')::timestamptz::date, current_date) end,
      end_date   = case when a->>'mode' = 'window' then nullif(a->>'closeAt','')::date end,
      monthly_limit = case when (a->>'monthlyLimited')::boolean then (a->>'monthlyLimit')::int end,
      access_days   = case when (a->>'accessLimited')::boolean  then (a->>'accessDays')::int  end,
      late_allowed = coalesce((l->>'allowed')::boolean,false),
      late_grace_minutes = case when (l->>'allowed')::boolean then (l->>'graceMinutes')::int end,
      build_deadline = nullif(p->>'buildDeadline','')::date, wizard_state = p->'wizardState'
    where id = sid;
    delete from tests where series_id = sid;
  end if;
  for t in select * from jsonb_array_elements(coalesce(p->'tests','[]'::jsonb)) loop
    tpos := tpos + 1;
    insert into tests (series_id, position, title, instructions, duration_minutes, passing_percent, attempt_limit,
                       window_mode, open_at, close_at, planned_questions, topics)
    values (sid, tpos, t->>'name', t->>'instructions', coalesce(nullif(t->>'duration','')::int, 60),
            coalesce(nullif(t->>'passingPercent','')::numeric, 40), coalesce(nullif(t->>'attemptLimit','')::int, 1),
            coalesce(t->'window'->>'mode','inherit'),
            case when t->'window'->>'mode' = 'custom' then nullif(t->'window'->>'openAt','')::timestamptz end,
            case when t->'window'->>'mode' = 'custom' then nullif(t->'window'->>'closeAt','')::timestamptz end,
            coalesce(nullif(t->>'plannedQuestions','')::int, 0),
            coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(t->'topics','[]'::jsonb)) x), '{}'))
    returning id into tid;
    spos := 0;
    for s in select * from jsonb_array_elements(coalesce(t->'sections','[]'::jsonb)) loop
      spos := spos + 1;
      insert into test_sections (test_id, position, name, instructions, planned_questions, planned_marks)
      values (tid, spos, s->>'name', s->>'instructions', nullif(s->>'questionCount','')::int, nullif(s->>'marks','')::numeric);
    end loop;
    qpos := 0;
    for q in select * from jsonb_array_elements(coalesce(t->'questions','[]'::jsonb)) loop
      qpos := qpos + 1;
      sec := (select id from test_sections where test_id = tid and position = nullif(q->>'sectionPosition','')::int);
      perform _insert_question(tid, qpos, q, sec);
    end loop;
  end loop;
  if p_publish then perform publish_test_series(sid); end if;
  return sid;
end $$;
-- Publish now / Schedule go-live (also three dots > Publish)
create or replace function publish_test_series(p_id uuid) returns series_status
language plpgsql security invoker as $$
declare s test_series; new_status series_status; bad int;
begin
  select * into s from test_series where id = p_id and deleted_at is null;
  if not found then raise exception 'Series not found'; end if;
  if s.title is null or btrim(s.title) = '' or s.audience is null then raise exception 'Name and audience are required'; end if;
  if s.grade is null or s.subject_id is null or s.exam is null or s.level is null or coalesce(array_length(s.languages,1),0) = 0 then
    raise exception 'Classification is incomplete (grade, subject, exam, level, language)'; end if;
  if not exists (select 1 from tests where series_id = p_id) then raise exception 'Add at least one test'; end if;
  if exists (select 1 from tests t where t.series_id = p_id and not exists (select 1 from questions q where q.test_id = t.id)) then
    raise exception 'Every test needs at least one question'; end if;
  select count(*) into bad from questions q join tests t on t.id = q.test_id
   where t.series_id = p_id and q.is_objective
     and ( (select count(*) from question_options o where o.question_id = q.id) < 2
           or not exists (select 1 from question_options o where o.question_id = q.id and o.is_correct) );
  if bad > 0 then raise exception '% objective question(s) are missing options or a correct answer', bad; end if;
  new_status := case when s.go_live_mode = 'schedule' and s.go_live_at > now() then 'scheduled' else 'published' end;
  update test_series set status = new_status, published_at = coalesce(published_at, now()) where id = p_id;
  update tests set status = 'published' where series_id = p_id;
  return new_status;
end $$;
-- run from pg_cron every 5 minutes: select cron.schedule('release-series','*/5 * * * *','select release_scheduled_series()');
create or replace function release_scheduled_series() returns int language plpgsql security definer set search_path = public as
$$ declare n int; begin
  update test_series set status = 'published' where status = 'scheduled' and go_live_at <= now();
  get diagnostics n = row_count; return n;
end $$;
-- Wizard autosave and Discard & leave
create or replace function save_wizard_draft(p_id uuid, p_state jsonb) returns uuid
language plpgsql security invoker as $$
declare sid uuid := p_id; nm text := nullif(btrim(p_state->>'name'), '');
begin
  if sid is null then
    insert into test_series (title, status, start_method, wizard_state, created_by)
    values (coalesce(nm, 'Untitled series'), 'draft', nullif(p_state->>'startMethod','')::start_method, p_state, auth.uid())
    returning id into sid;
  else
    update test_series set wizard_state = p_state, title = coalesce(nm, title),
           start_method = coalesce(nullif(p_state->>'startMethod','')::start_method, start_method)
    where id = sid and status = 'draft' and deleted_at is null;
  end if;
  return sid;
end $$;
create or replace function discard_wizard_draft(p_id uuid) returns void language sql security invoker as $$
  update test_series set deleted_at = now() where id = p_id and status = 'draft' and deleted_at is null;
$$;
create or replace function series_name_exists(p_name text, p_exclude uuid default null) returns boolean
language sql stable security invoker as $$
  select exists (select 1 from test_series where lower(btrim(title)) = lower(btrim(p_name))
                 and deleted_at is null and (p_exclude is null or id <> p_exclude));
$$;
-- AI Test Builder: save reviewed questions as a test (new series or existing)
create or replace function save_ai_job_to_series(p_job uuid, p_target text, p_series uuid, p_new jsonb, p_meta jsonb)
returns uuid language plpgsql security invoker as $$
declare j ai_test_jobs; sid uuid; tid uuid; pos int; g record; subj uuid; sec uuid; spos int := 0; s jsonb; qn int := 0;
begin
  select * into j from ai_test_jobs where id = p_job;
  if not found or j.status not in ('completed','saved') then raise exception 'Job is not ready to save'; end if;
  if p_target = 'new' then
    subj := coalesce(j.subject_id, (select id from subjects where lower(name) = lower(p_new->>'subject')));
    insert into test_series (title, subject_id, audience, pricing, price_inr, status, start_method, created_by)
    values (p_new->>'name', subj, p_new->>'audience', coalesce(nullif(p_new->>'pricing','')::pricing_type,'free'),
            case when p_new->>'pricing' = 'paid' then coalesce(nullif(p_new->>'price','')::numeric,0) else 0 end,
            'draft', 'ai', auth.uid())
    returning id into sid;
  else sid := p_series; end if;
  select coalesce(max(position),0) + 1 into pos from tests where series_id = sid;
  insert into tests (series_id, position, title, duration_minutes, passing_marks, attempt_limit, scheduled_at,
                     shuffle_questions, shuffle_options, status)
  values (sid, pos, j.test_name, coalesce(nullif(p_meta->>'duration','')::int, j.duration_minutes, 60),
          nullif(p_meta->>'passingMarks','')::numeric, coalesce(nullif(p_meta->>'attemptLimit','')::int, 1),
          nullif(p_meta->>'scheduledAt','')::timestamptz,
          coalesce((p_meta->>'shuffleQuestions')::boolean,false), coalesce((p_meta->>'shuffleOptions')::boolean,false), 'draft')
  returning id into tid;
  for s in select * from jsonb_array_elements(coalesce(j.structure->'sections','[]'::jsonb)) loop
    spos := spos + 1;
    insert into test_sections (test_id, position, name, instructions, planned_questions, planned_marks)
    values (tid, spos, coalesce(s->>'name','Section ' || spos), s->>'instructions',
            nullif(s->>'questionCount','')::int, nullif(s->>'marks','')::numeric);
  end loop;
  for g in select * from ai_generated_questions where job_id = p_job and review_state <> 'rejected' order by position loop
    qn := qn + 1;
    sec := (select id from test_sections where test_id = tid and position = g.section_position);
    perform _insert_question(tid, qn, jsonb_build_object(
      'type', g.type, 'text', g.body, 'options', coalesce(g.options,'[]'::jsonb),
      'correctAnswers', to_jsonb(g.correct_keys), 'marks', g.marks, 'negativeMarks', g.negative_marks,
      'difficulty', g.difficulty, 'subject', g.subject, 'topic', g.topic, 'explanation', g.explanation,
      'answerInstructions', g.answer_instructions, 'source', 'ai'), sec);
  end loop;
  update questions set ai_job_id = p_job where test_id = tid;
  update ai_test_jobs set status = 'saved', series_id = sid, test_id = tid where id = p_job;
  return tid;
end $$;
-- Three dots > Duplicate (hidden in the UI for now)
create or replace function duplicate_test_series(p_id uuid) returns uuid
language plpgsql security invoker as $$
declare new_id uuid; r record; nt uuid; q record; nq uuid; sm jsonb; sc record; ns uuid;
begin
  insert into test_series (title, about, who_for, audience, syllabus, start_method, pricing, price_inr, grade, subject_id, exam, level,
      languages, availability_mode, start_date, end_date, monthly_limit, access_days, late_allowed, late_grace_minutes, status, created_by)
  select title || ' (Copy)', about, who_for, audience, syllabus, 'duplicate', pricing, price_inr, grade, subject_id, exam, level,
      languages, availability_mode, start_date, end_date, monthly_limit, access_days, late_allowed, late_grace_minutes, 'draft', auth.uid()
  from test_series where id = p_id returning id into new_id;
  for r in select * from tests where series_id = p_id order by position loop
    insert into tests (series_id, position, title, instructions, duration_minutes, passing_percent, passing_marks, attempt_limit,
                       window_mode, open_at, close_at, shuffle_questions, shuffle_options, planned_questions, topics)
    values (new_id, r.position, r.title, r.instructions, r.duration_minutes, r.passing_percent, r.passing_marks, r.attempt_limit,
            r.window_mode, r.open_at, r.close_at, r.shuffle_questions, r.shuffle_options, r.planned_questions, r.topics)
    returning id into nt;
    sm := '{}'::jsonb;
    for sc in select * from test_sections where test_id = r.id loop
      insert into test_sections (test_id, position, name, instructions, planned_questions, planned_marks)
      values (nt, sc.position, sc.name, sc.instructions, sc.planned_questions, sc.planned_marks) returning id into ns;
      sm := sm || jsonb_build_object(sc.id::text, ns);
    end loop;
    for q in select * from questions where test_id = r.id order by position loop
      insert into questions (test_id, section_id, position, type, body, image_path, marks, negative_marks, difficulty, subject, topic,
                             explanation, answer_instructions, source)
      values (nt, nullif(sm->>(q.section_id::text),'')::uuid, q.position, q.type, q.body, q.image_path, q.marks, q.negative_marks,
              q.difficulty, q.subject, q.topic, q.explanation, q.answer_instructions, 'duplicate')
      returning id into nq;
      insert into question_options (question_id, position, option_key, label, image_path, is_correct)
      select nq, position, option_key, label, image_path, is_correct from question_options where question_id = q.id;
    end loop;
  end loop;
  return new_id;
end $$;
create or replace function is_assigned_educator(p_series uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from test_assignments where series_id = p_series and educator_id = auth.uid()
                    and status in ('assigned','in_progress','revision_requested')) $$;
create or replace function is_enrolled(p_series uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from series_enrollments where series_id = p_series and student_id = auth.uid()) $$;
-- Students read options through this view only (hides is_correct)
create or replace view v_student_options as
select o.id, o.question_id, o.position, o.option_key, o.label, o.image_path
from question_options o
join questions q on q.id = o.question_id
join tests t on t.id = q.test_id
where t.status = 'published' and is_enrolled(t.series_id);
-- ====================================================================
-- ROW LEVEL SECURITY
-- ====================================================================
alter table profiles               enable row level security;
alter table subjects               enable row level security;
alter table test_series            enable row level security;
alter table tests                  enable row level security;
alter table test_sections          enable row level security;
alter table questions              enable row level security;
alter table question_options       enable row level security;
alter table ai_test_jobs           enable row level security;
alter table ai_generated_questions enable row level security;
alter table test_assignments       enable row level security;
alter table series_enrollments     enable row level security;
alter table test_attempts          enable row level security;
alter table attempt_answers        enable row level security;
create policy profiles_read  on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_admin on profiles for all using (is_admin()) with check (is_admin());
create policy subjects_read  on subjects for select using (auth.uid() is not null);
create policy subjects_admin on subjects for all using (is_admin()) with check (is_admin());
create policy series_admin    on test_series for all using (is_admin()) with check (is_admin());
create policy series_student  on test_series for select using (status = 'published' and deleted_at is null);
create policy series_educator on test_series for select using (is_assigned_educator(id));
create policy tests_admin    on tests for all using (is_admin()) with check (is_admin());
create policy tests_student  on tests for select using (status = 'published' and is_enrolled(series_id));
create policy tests_educator on tests for all using (is_assigned_educator(series_id)) with check (is_assigned_educator(series_id));
create policy sections_admin   on test_sections for all using (is_admin()) with check (is_admin());
create policy sections_student on test_sections for select
  using (exists (select 1 from tests t where t.id = test_id and t.status = 'published' and is_enrolled(t.series_id)));
create policy questions_admin   on questions for all using (is_admin()) with check (is_admin());
create policy questions_edu     on questions for all
  using (exists (select 1 from tests t where t.id = test_id and is_assigned_educator(t.series_id)))
  with check (exists (select 1 from tests t where t.id = test_id and is_assigned_educator(t.series_id)));
create policy questions_student on questions for select
  using (exists (select 1 from tests t where t.id = test_id and t.status = 'published' and is_enrolled(t.series_id)));
create policy options_admin on question_options for all using (is_admin()) with check (is_admin());
create policy options_edu   on question_options for all
  using (exists (select 1 from questions q join tests t on t.id = q.test_id where q.id = question_id and is_assigned_educator(t.series_id)))
  with check (exists (select 1 from questions q join tests t on t.id = q.test_id where q.id = question_id and is_assigned_educator(t.series_id)));
grant select on v_student_options to authenticated;   -- students get no policy on the table itself
create policy ai_jobs_admin on ai_test_jobs for all using (is_admin()) with check (is_admin());
create policy ai_gen_admin  on ai_generated_questions for all using (is_admin()) with check (is_admin());
create policy assign_admin  on test_assignments for all using (is_admin()) with check (is_admin());
create policy assign_edu_r  on test_assignments for select using (educator_id = auth.uid());
create policy enroll_admin   on series_enrollments for all using (is_admin()) with check (is_admin());
create policy enroll_own     on series_enrollments for select using (student_id = auth.uid());
create policy attempts_admin on test_attempts for select using (is_admin());
create policy attempts_own   on test_attempts for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy answers_admin  on attempt_answers for select using (is_admin());
create policy answers_own    on attempt_answers for all
  using (exists (select 1 from test_attempts a where a.id = attempt_id and a.student_id = auth.uid()))
  with check (exists (select 1 from test_attempts a where a.id = attempt_id and a.student_id = auth.uid()));
-- ---------------------------------------------------------------- STORAGE
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', false, 2097152, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy qimg_admin_write on storage.objects for all
  using (bucket_id = 'question-images' and is_admin()) with check (bucket_id = 'question-images' and is_admin());
create policy qimg_read on storage.objects for select
 using (bucket_id = 'question-images' and auth.uid() is not null);
-- =====================================================================
-- UNIVERSAL LEARNING - ASSIGN EDUCATORS PAGE (Admin) - Supabase SQL



