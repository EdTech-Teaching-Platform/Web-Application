-- Development seed data. Paste this file into the Supabase SQL editor after
-- migrations have been applied. It is idempotent and uses Passw0rd!dev for
-- every seeded login. Never use these credentials outside development.
set search_path = public, extensions;

do $$
declare
  admin_id uuid := '00000000-0000-0000-0000-000000000001';
  educator_ids uuid[] := array[
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid,
    '00000000-0000-0000-0000-000000000004'::uuid
  ];
  student_ids uuid[] := array[
    '00000000-0000-0000-0000-000000000005'::uuid,
    '00000000-0000-0000-0000-000000000006'::uuid,
    '00000000-0000-0000-0000-000000000007'::uuid,
    '00000000-0000-0000-0000-000000000008'::uuid,
    '00000000-0000-0000-0000-000000000009'::uuid,
    '00000000-0000-0000-0000-000000000010'::uuid,
    '00000000-0000-0000-0000-000000000011'::uuid,
    '00000000-0000-0000-0000-000000000012'::uuid
  ];
  names text[] := array[
    'Dev Admin','Aarav Sharma','Diya Patel','Kabir Singh',
    'Ananya Rao','Ishaan Mehta','Meera Nair','Rohan Gupta',
    'Sara Khan','Vivaan Joshi','Nisha Das','Arjun Iyer'
  ];
  emails text[] := array[
    'dev-admin@example.test','educator1@example.test','educator2@example.test',
    'educator3@example.test','student1@example.test','student2@example.test',
    'student3@example.test','student4@example.test','student5@example.test',
    'student6@example.test','student7@example.test','student8@example.test'
  ];
  i int;
  uid uuid;
begin
  for i in 1..12 loop
    uid := case when i = 1 then admin_id
      when i between 2 and 4 then educator_ids[i - 1]
      else student_ids[i - 4] end;
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, created_at, updated_at
    ) values (
      uid, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', emails[i],
      crypt('Passw0rd!dev', gen_salt('bf')), now(),
      jsonb_build_object('full_name', names[i]), now(), now()
    ) on conflict (id) do nothing;
    insert into auth.identities (provider_id, user_id, identity_data, provider)
    values (uid::text, uid, jsonb_build_object('sub', uid::text, 'email', emails[i]), 'email')
    on conflict (provider_id, provider) do nothing;
  end loop;

  update profiles set role = 'admin' where id = admin_id;
  update profiles set role = 'educator', state = case when id = educator_ids[1] then 'MH' when id = educator_ids[2] then 'KA' else 'DL' end
  where id = any(educator_ids);
  update profiles p set role = 'student', state = (array['MH','KA','DL','TN','UP','WB','GJ','RJ'])[s.position]
  from (select id, row_number() over (order by id)::int as position from unnest(student_ids) id) s
  where p.id = s.id;

  update educators set verification_status = case when id = educator_ids[3] then 'pending' else 'verified' end,
    account_status = 'active', subjects = case when id = educator_ids[1] then '{Mathematics,Physics}' else '{Biology,English}' end
  where id = any(educator_ids);

  update students st set grade = ('Grade ' || (s.position % 5 + 8)),
    city = case when st.id = student_ids[1] then 'Pune' when st.id = student_ids[2] then 'Bengaluru'
      when st.id = student_ids[3] then 'Delhi' else 'Lucknow' end,
    registered_at = now() - ((s.position * 11) || ' days')::interval,
    status = 'active', account_status = 'active'
  from (select id, row_number() over (order by id)::int as position from unnest(student_ids) id) s
  where st.id = s.id;
end $$;

insert into subjects (id, name, icon_key, is_custom)
values
 ('10000000-0000-0000-0000-000000000001','Mathematics','math',false),
 ('10000000-0000-0000-0000-000000000002','Physics','physics',false),
 ('10000000-0000-0000-0000-000000000003','Biology','biology',false),
 ('10000000-0000-0000-0000-000000000004','English','english',false)
on conflict (id) do nothing;

insert into test_series (id, code, title, about, audience, pricing, price_inr, subject_id, status, created_by)
values
 ('20000000-0000-0000-0000-000000000001','TS-DEV-001','JEE Mathematics Mastery','Algebra and calculus practice','JEE aspirants','paid',1499,'10000000-0000-0000-0000-000000000001','published','00000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','TS-DEV-002','Physics Fundamentals','Mechanics and electricity','Grade 11 students','free',0,'10000000-0000-0000-0000-000000000002','published','00000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000003','TS-DEV-003','Biology NEET Sprint','High-yield biology revision','NEET aspirants','paid',999,'10000000-0000-0000-0000-000000000003','published','00000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000004','TS-DEV-004','English Skills Weekly','Grammar and comprehension','Grade 10 students','free',0,'10000000-0000-0000-0000-000000000004','draft','00000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000005','TS-DEV-005','Mixed Aptitude Challenge','Quantitative and verbal aptitude','Competitive exam learners','paid',799,'10000000-0000-0000-0000-000000000001','draft','00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into tests (id, series_id, position, title, instructions, duration_minutes, planned_questions, status)
select md5('dev-test-' || row_number() over (order by ts.code))::uuid,
  ts.id, 1,
  'Practice Test ' || s, 'Choose the best answer.', 60, 2,
  case when s <= 3 then 'published'::test_status else 'draft'::test_status end
from (select row_number() over (order by code) s, id, code from test_series where code like 'TS-DEV-%') ts
on conflict (id) do nothing;

insert into questions (id, test_id, position, body, marks, difficulty, subject)
select md5('dev-question-' || n)::uuid,
  md5('dev-test-' || ((n - 1) / 2 + 1))::uuid,
  ((n - 1) % 2) + 1, 'Which option is correct for practice question ' || n, 4, 'medium', 'Mathematics'
from generate_series(1,10) n
on conflict (id) do nothing;

insert into question_options (question_id, position, option_key, label, is_correct)
select q.id, o, chr(64 + o), 'Option ' || chr(64 + o), o = 1
from questions q cross join generate_series(1,4) o
where q.id in (select md5('dev-question-' || n)::uuid from generate_series(1,10) n)
on conflict (question_id, option_key) do nothing;

insert into series_enrollments (student_id, series_id, enrolled_at)
select s.id, ts.id, now() - ((row_number() over ())::int % 30 || ' days')::interval
from unnest(array[
  '00000000-0000-0000-0000-000000000005'::uuid,'00000000-0000-0000-0000-000000000006'::uuid,
  '00000000-0000-0000-0000-000000000007'::uuid,'00000000-0000-0000-0000-000000000008'::uuid,
  '00000000-0000-0000-0000-000000000009'::uuid,'00000000-0000-0000-0000-000000000010'::uuid
]) s(id) cross join lateral (select id from test_series order by id limit 1) ts
on conflict do nothing;

insert into discounts (id, name, coupon_code, offer_type, value, starts_at, status, created_by)
values
 ('50000000-0000-0000-0000-000000000001','Launch Offer','DEVLAUNCH','percentage',20,now(),'active','00000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000002','Student Saver','DEVSTUDENT','fixed',100,now(),'active','00000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000003','Exam Week','DEVEXAM','percentage',15,now(),'inactive','00000000-0000-0000-0000-000000000001'),
 ('50000000-0000-0000-0000-000000000004','Early Bird','DEVBIRD','percentage',10,now(),'active','00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into institutions (id, name, state_code, city)
values
 ('60000000-0000-0000-0000-000000000001','Pune Learning Centre','MH','Pune'),
 ('60000000-0000-0000-0000-000000000002','Bengaluru Academy','KA','Bengaluru')
on conflict (id) do nothing;

update profiles
set institution_id = case when id in (
  '00000000-0000-0000-0000-000000000005'::uuid,
  '00000000-0000-0000-0000-000000000006'::uuid,
  '00000000-0000-0000-0000-000000000007'::uuid
) then '60000000-0000-0000-0000-000000000001'::uuid
else '60000000-0000-0000-0000-000000000002'::uuid end
where id in (
  '00000000-0000-0000-0000-000000000005'::uuid,
  '00000000-0000-0000-0000-000000000006'::uuid,
  '00000000-0000-0000-0000-000000000007'::uuid,
  '00000000-0000-0000-0000-000000000008'::uuid,
  '00000000-0000-0000-0000-000000000009'::uuid,
  '00000000-0000-0000-0000-000000000010'::uuid,
  '00000000-0000-0000-0000-000000000011'::uuid,
  '00000000-0000-0000-0000-000000000012'::uuid
);

insert into test_attempts (id, test_id, series_id, student_id, attempt_no, status, score, max_score, started_at, submitted_at)
select md5('dev-attempt-' || row_number() over (order by st.id, t.id))::uuid,
  t.id, t.series_id, st.id, 1, 'submitted', 45 + (row_number() over (order by st.id, t.id) % 50), 100,
  now() - ((row_number() over (order by st.id, t.id) % 60) || ' days')::interval,
  now() - ((row_number() over (order by st.id, t.id) % 60) || ' days')::interval
from students st cross join tests t
where t.position = 1
on conflict (test_id, student_id, attempt_no) do nothing;

insert into attempt_answers (attempt_id, question_id, selected_option_ids, is_correct, marks_awarded)
select a.id, q.id, array[o.id], (q.position = 1), case when q.position = 1 then 4 else 0 end
from test_attempts a
join questions q on q.test_id = a.test_id
join lateral (select id from question_options where question_id = q.id order by position limit 1) o on true
where a.id::text in (
  select md5('dev-attempt-' || n)::text from generate_series(1, 40) n
)
on conflict (attempt_id, question_id) do nothing;

insert into payments (
  id, txn_code, user_id, series_id, educator_id, status, currency,
  list_price_inr, discount_amount_inr, amount_inr, method, gateway,
  platform_fee_inr, educator_earning_inr, paid_at, created_at
)
select md5('dev-payment-' || n)::uuid, 'PAY-DEV-' || lpad(n::text, 4, '0'),
  ('00000000-0000-0000-0000-00000000000' || ((n - 1) % 8 + 5))::uuid,
  ('20000000-0000-0000-0000-00000000000' || ((n - 1) % 5 + 1))::uuid,
  ('00000000-0000-0000-0000-00000000000' || ((n - 1) % 3 + 2))::uuid,
  case when n % 7 = 0 then 'failed'::payment_status
       when n % 11 = 0 then 'refunded'::payment_status else 'paid'::payment_status end,
  'INR', 1000 + n * 10, case when n % 4 = 0 then 100 else 0 end,
  1000 + n * 10 - case when n % 4 = 0 then 100 else 0 end,
  (array['upi','card','netbanking','wallet']::payment_method[])[n % 4 + 1],
  'dev-gateway', 90, 810,
  case when n % 7 = 0 then null else now() - ((n % 60) || ' days')::interval end,
  now() - ((n % 60) || ' days')::interval
from generate_series(1, 25) n
on conflict (id) do nothing;

insert into discount_redemptions (
  id, discount_id, coupon_code, discount_name, offer_type, offer_value,
  user_id, series_id, order_amount_inr, discount_amount_inr, final_amount_inr
)
select md5('dev-redemption-' || n)::uuid,
  ('50000000-0000-0000-0000-00000000000' || ((n - 1) % 4 + 1))::uuid,
  (array['DEVLAUNCH','DEVSTUDENT','DEVEXAM','DEVBIRD'])[n % 4 + 1],
  (array['Launch Offer','Student Saver','Exam Week','Early Bird'])[n % 4 + 1],
  case when n % 2 = 0 then 'percentage'::discount_offer_type else 'fixed'::discount_offer_type end,
  case when n % 2 = 0 then 20 else 100 end,
  ('00000000-0000-0000-0000-00000000000' || ((n - 1) % 8 + 5))::uuid,
  ('20000000-0000-0000-0000-00000000000' || ((n - 1) % 5 + 1))::uuid,
  1499, 100, 1399
from generate_series(1, 12) n
on conflict (id) do nothing;

insert into refund_requests (
  id, payment_id, student_id, educator_id, series_id, item_title,
  requested_by, amount_inr, reason_code, reason_text, status, decided_by,
  decided_at, decision_note
)
select md5('dev-refund-' || n)::uuid, md5('dev-payment-' || n)::uuid,
  ('00000000-0000-0000-0000-00000000000' || (n + 4))::uuid,
  ('00000000-0000-0000-0000-00000000000' || ((n - 1) % 3 + 2))::uuid,
  ('20000000-0000-0000-0000-00000000000' || ((n - 1) % 5 + 1))::uuid,
  'Development test series',
  ('00000000-0000-0000-0000-00000000000' || (n + 4))::uuid,
  100, 'other'::refund_reason, 'Development fixture',
  case when n = 1 then 'pending'::refund_status when n = 2 then 'approved'::refund_status else 'rejected'::refund_status end,
  case when n = 1 then null else '00000000-0000-0000-0000-000000000001'::uuid end,
  case when n = 1 then null else now() end,
  case when n = 3 then 'Not eligible in fixture' else null end
from generate_series(1, 3) n
on conflict (id) do nothing;

insert into payouts (id, educator_id, period_start, period_end, amount_inr, status, paid_at, created_by)
values
 ('70000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',current_date-30,current_date-1,12500,'paid',now(),'00000000-0000-0000-0000-000000000001'),
 ('70000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',current_date-30,current_date-1,9800,'pending',null,'00000000-0000-0000-0000-000000000001'),
 ('70000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004',current_date-30,current_date-1,7300,'processing',null,'00000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into callback_requests (id, name, phone, email, source, message)
select md5('dev-callback-' || n)::uuid, 'Development Contact ' || n,
  '+9198450122' || lpad(n::text, 2, '0'), 'callback' || n || '@example.test',
  'website_visitor'::callback_source, 'Development callback request ' || n
from generate_series(1, 6) n
on conflict (id) do nothing;

insert into notifications (id, title, body, category, audience_type, channels, status, created_by, published_at)
values
 ('80000000-0000-0000-0000-000000000001','Welcome to development','This is a draft notification.','announcement','all_users','{in_app}','draft','00000000-0000-0000-0000-000000000001',null),
 ('80000000-0000-0000-0000-000000000002','Exam week reminder','Complete your practice tests this week.','alert','learners','{in_app}','published','00000000-0000-0000-0000-000000000001',now()),
 ('80000000-0000-0000-0000-000000000003','Educator update','New educator resources are available.','system','educators','{in_app}','published','00000000-0000-0000-0000-000000000001',now()),
 ('80000000-0000-0000-0000-000000000004','Planned maintenance','Maintenance is scheduled for this weekend.','policy','all_users','{in_app}','draft','00000000-0000-0000-0000-000000000001',null)
on conflict (id) do nothing;
