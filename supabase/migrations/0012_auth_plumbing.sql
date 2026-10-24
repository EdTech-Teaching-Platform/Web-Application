-- Auth plumbing. This migration runs after 0011_dashboard.sql, once all core
-- tables and dashboard functions exist.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Learner'
  );

  insert into public.profiles (id, full_name, email, role)
  values (new.id, profile_name, new.email, 'student')
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);

  insert into public.students (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

update public.admin_nav_items
set route = case key
  when 'dashboard' then '/admin/logindashboard'
  when 'create_test_series' then '/admin/testseries'
  when 'assign_educators' then '/admin/testseries/assign-educators'
  when 'test_series_tracker' then '/admin/testseries/tracker'
  when 'test_performance' then '/admin/testseries/performance-analytics'
  when 'student_management' then '/admin/usermanagement'
  when 'educator_management' then '/admin/educatorverification'
  when 'discount_management' then '/admin/discounts'
  when 'transaction_history' then '/admin/transactionhistory'
  when 'refund_management' then '/admin/paymentoversight'
  when 'financial_analytics' then '/admin/financialanalytics'
  when 'regional_growth' then '/admin/regionalanalytics'
  when 'reports_builder' then '/admin/reportsbuilder'
  when 'content_moderation' then '/admin/contentmoderation'
  when 'publish_notifications' then '/admin/notifications'
  when 'callback_request' then '/admin/supporttickets'
  else route
end
where key in (
  'dashboard', 'create_test_series', 'assign_educators', 'test_series_tracker',
  'test_performance', 'student_management', 'educator_management',
  'discount_management', 'transaction_history', 'refund_management',
  'financial_analytics', 'regional_growth', 'reports_builder',
  'content_moderation', 'publish_notifications', 'callback_request'
);

revoke all on function public.handle_new_user() from public, anon, authenticated;
