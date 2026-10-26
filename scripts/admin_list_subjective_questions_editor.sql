-- =====================================================================
-- scripts/admin_list_subjective_questions_editor.sql
--
-- Read-only. Lists every test series that contains a short answer, long
-- answer or subjective question (lead short_answer, our admin_type
-- short_answer / long_answer / subjective / descriptive, or
-- needs_manual_grading). One statement, for the Supabase SQL editor.
-- No rows = no such series. Uses no function from 20261027090000, so it works
-- before and after that migration.
-- =====================================================================
select s.id as series_id,
       s.title as series_title,
       coalesce(sa.status, case when s.is_published then 'published' else 'draft' end) as series_status,
       q.id as test_id,
       q.title as test_title,
       count(*) as subjective_questions,
       string_agg(left(qq.question_text, 80), ' | ' order by qq.sort_order) as sample_text,
       bool_or(exists (select 1 from public.quiz_answers a where a.question_id = qq.id)) as has_student_answers
  from public.quiz_questions qq
  join public.quizzes q on q.id = qq.quiz_id
  join public.test_series s on s.id = q.series_id
  left join public.test_series_admin sa on sa.series_id = s.id
  left join public.quiz_question_admin qa on qa.question_id = qq.id
 where qq.question_type = 'short_answer'
    or lower(coalesce(qa.admin_type, '')) in ('short_answer', 'long_answer', 'subjective', 'descriptive')
    or coalesce(qa.needs_manual_grading, false)
 group by s.id, s.title, sa.status, s.is_published, q.id, q.title, q.series_sort_order
 order by s.title, q.series_sort_order, q.title;
