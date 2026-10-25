-- =====================================================================
-- 20261025110200_admin_b2_house_course.sql
--
-- Purpose
--   D2: one hidden "house course" that every admin-created test series is
--   attached to, because test_series.course_id is NOT NULL (F8) and is not
--   altered. Its id is stored in platform_settings 'admin_house_course_id'.
--
-- Lead objects written
--   public.courses           one row (slug 'platform-test-series-house', status 'draft'),
--                            guarded by WHERE NOT EXISTS.
--   public.platform_settings one row (key 'admin_house_course_id'), ON CONFLICT DO NOTHING.
--
-- Assumptions
--   * Every NOT NULL column of courses is filled explicitly (values equal to the
--     lead's DDL defaults): educator_id, title, slug, language, price, currency,
--     status, completion_criteria, video_completion_threshold, allow_resubmission,
--     is_featured, join_policy, created_at, updated_at.
--   * educator_id = the oldest admin / super_admin profile. That account will see
--     this draft course if it ever opens the teacher portal.
--   * status 'draft' keeps the course (and its series) out of the lead's
--     student catalogue, as far as the lead's app filters on status.
--
-- ROLLBACK (only after every series on the house course has been removed)
--   delete from public.platform_settings where key = 'admin_house_course_id';
--   delete from public.courses where slug = 'platform-test-series-house'
--     and not exists (select 1 from public.test_series where course_id = courses.id);
-- =====================================================================
set search_path = public, extensions;

do $$
declare
  v_owner  uuid;
  v_course uuid;
begin
  select p.id into v_owner
    from public.profiles p
   where p.role in ('admin', 'super_admin')
   order by p.created_at, p.id
   limit 1;
  if v_owner is null then
    raise exception 'House course: no admin or super_admin profile exists.' using errcode = 'P0001';
  end if;

  insert into public.courses
    (educator_id, org_unit_id, category_id, title, slug, short_description, description,
     language, level, price, currency, status, completion_criteria, video_completion_threshold,
     allow_resubmission, is_featured, join_policy, created_at, updated_at)
  select v_owner, null, null,
         'Platform test series (internal)', 'platform-test-series-house',
         'Internal container for admin-created test series. Do not publish.',
         'Created by the admin portal. Every standalone test series created by platform admins is attached here because test_series.course_id is required.',
         'English', 'all_levels', 0, 'INR', 'draft',
         '{"required_assessments": true, "min_lesson_completion": 100}'::jsonb, 90.0,
         true, false, 'approval', now(), now()
   where not exists (select 1 from public.courses where slug = 'platform-test-series-house');

  select id into v_course from public.courses where slug = 'platform-test-series-house';

  insert into public.platform_settings (key, value, description)
  values ('admin_house_course_id', to_jsonb(v_course::text),
          'courses.id that admin-created test series are attached to (admin portal, D2)')
  on conflict (key) do nothing;
end $$;
