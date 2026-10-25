-- =====================================================================
-- 20261025100200_admin_lookups.sql
--
-- Purpose
--   Lookup tables owned by the admin port: regions (Indian states/UTs),
--   admin_nav_items (sidebar badges, routes from src/portals/admin/routes.jsx)
--   and report_types (Reports Builder catalogue). Seeds the dashboard quote in
--   the lead's platform_settings without overwriting an existing value.
--
-- Lead objects read / written
--   public.platform_settings: one insert ... on conflict (key) do nothing.
--
-- Assumptions
--   * platform_settings.key is its primary key (existing_Schema.sql).
--   * All access to these tables goes through SECURITY DEFINER RPCs, so RLS
--     is enabled with no policies (deny-by-default for browser roles).
--
-- ROLLBACK
--   delete from public.platform_settings where key = 'dashboard_quote' and updated_by is null
--     and value = to_jsonb('Empowering educators. Enabling learners. Building brighter futures.'::text);
--   drop table if exists public.report_types;
--   drop table if exists public.admin_nav_items;
--   drop table if exists public.regions;   -- only after 0300 (institutions.state_code) and user_geo are gone
-- =====================================================================
set search_path = public, extensions;

-- ------------------------------------------------------------------ regions
create table if not exists public.regions (
  code          text primary key,                  -- 'MH'
  name          text not null unique,              -- 'Maharashtra'
  primary_city  text,
  sort_order    int  not null default 0,
  is_active     boolean not null default true
);

insert into public.regions (code, name, primary_city) values
 ('AP','Andhra Pradesh','Visakhapatnam'),('AR','Arunachal Pradesh','Itanagar'),('AS','Assam','Guwahati'),
 ('BR','Bihar','Patna'),('CG','Chhattisgarh','Raipur'),('GA','Goa','Panaji'),('GJ','Gujarat','Ahmedabad'),
 ('HR','Haryana','Gurugram'),('HP','Himachal Pradesh','Shimla'),('JH','Jharkhand','Ranchi'),
 ('KA','Karnataka','Bengaluru'),('KL','Kerala','Kochi'),('MP','Madhya Pradesh','Bhopal'),
 ('MH','Maharashtra','Pune'),('MN','Manipur','Imphal'),('ML','Meghalaya','Shillong'),('MZ','Mizoram','Aizawl'),
 ('NL','Nagaland','Kohima'),('OD','Odisha','Bhubaneswar'),('PB','Punjab','Ludhiana'),('RJ','Rajasthan','Jaipur'),
 ('SK','Sikkim','Gangtok'),('TN','Tamil Nadu','Chennai'),('TG','Telangana','Hyderabad'),('TR','Tripura','Agartala'),
 ('UP','Uttar Pradesh','Lucknow'),('UK','Uttarakhand','Dehradun'),('WB','West Bengal','Kolkata'),
 ('AN','Andaman and Nicobar Islands','Port Blair'),('CH','Chandigarh','Chandigarh'),
 ('DN','Dadra and Nagar Haveli and Daman and Diu','Daman'),('DL','Delhi','Delhi'),
 ('JK','Jammu and Kashmir','Srinagar'),('LA','Ladakh','Leh'),('LD','Lakshadweep','Kavaratti'),
 ('PY','Puducherry','Puducherry')
on conflict (code) do nothing;

-- ---------------------------------------------------------- admin_nav_items
-- route values match src/portals/admin/routes.jsx (and AdminSidebar.jsx, which
-- looks badges up by route). badge_key names a count computed in get_admin_nav().
create table if not exists public.admin_nav_items (
  key        text primary key,
  section    text not null check (section in ('overview','test_series','management','finance','system')),
  label      text not null,
  route      text not null,
  icon       text,
  badge_key  text check (badge_key in ('educator_verifications','series_approvals','refunds','callbacks','moderation')),
  sort_order int  not null default 0,
  is_active  boolean not null default true
);

insert into public.admin_nav_items (key, section, label, route, icon, badge_key, sort_order) values
 ('dashboard',             'overview',    'Dashboard',                  '/admin/logindashboard',                    'layout-dashboard', null,                     10),
 ('create_test_series',    'test_series', 'Create Test Series',         '/admin/testseries',                        'file-plus',        null,                     20),
 ('assign_educators',      'test_series', 'Assign Educators',           '/admin/testseries/assign-educators',       'user-check',       'series_approvals',       30),
 ('test_series_tracker',   'test_series', 'Test Series Tracker',        '/admin/testseries/tracker',                'list-checks',      null,                     40),
 ('test_performance',      'test_series', 'Test Performance Analytics', '/admin/testseries/performance-analytics',  'bar-chart',        null,                     50),
 ('student_management',    'management',  'Student Management',         '/admin/usermanagement',                    'graduation-cap',   null,                     60),
 ('educator_management',   'management',  'Educator Management',        '/admin/educatorverification',              'users',            'educator_verifications', 70),
 ('discount_management',   'management',  'Discount Management',        '/admin/discounts',                         'percent',          null,                     80),
 ('transaction_history',   'finance',     'Transaction History',        '/admin/transactionhistory',                'credit-card',      null,                     90),
 ('refund_management',     'finance',     'Refund Management',          '/admin/paymentoversight',                  'rotate-ccw',       'refunds',               100),
 ('financial_analytics',   'finance',     'Financial Analytics',        '/admin/financialanalytics',                'line-chart',       null,                    110),
 ('regional_growth',       'finance',     'Regional Growth',            '/admin/regionalanalytics',                 'map',              null,                    120),
 ('reports_builder',       'finance',     'Reports Builder',            '/admin/reportsbuilder',                    'file-text',        null,                    130),
 ('content_moderation',    'system',      'Content Moderation',         '/admin/contentmoderation',                 'shield',           'moderation',            140),
 ('publish_notifications', 'system',      'Publish Notifications',      '/admin/notifications',                     'bell',             null,                    150),
 ('audit_logs',            'system',      'Audit Logs',                 '/admin/auditlogs',                         'history',          null,                    155),
 ('callback_request',      'system',      'Callback Request',           '/admin/supporttickets',                    'phone',            'callbacks',             160)
on conflict (key) do nothing;

-- ------------------------------------------------------------- report_types
-- Column keys are unchanged from the archived catalogue (the Reports Builder
-- renders them); filter options are rewritten to the values the lead's data
-- and this port actually store.
create table if not exists public.report_types (
  key          text primary key,
  label        text not null,
  description  text,
  date_label   text not null default 'Date',
  columns      jsonb not null,
  filters      jsonb not null default '[]'::jsonb,
  sort_order   int  not null default 0,
  is_active    boolean not null default true
);

insert into public.report_types (key, label, description, date_label, sort_order, columns, filters) values
('enrollment', 'Enrollment report', 'Who enrolled in which test series', 'Enrolled on', 1,
 '[{"key":"enrollment_id","label":"Enrollment ID"},{"key":"student","label":"Student"},{"key":"email","label":"Email"},
   {"key":"test_series","label":"Test series"},{"key":"educator","label":"Educator"},{"key":"enrolled_on","label":"Enrolled on"},
   {"key":"status","label":"Status"},{"key":"amount_paid_inr","label":"Amount paid (INR)"}]',
 '[{"key":"series_id","label":"Test series","type":"select","source":"series"},
   {"key":"educator_id","label":"Educator","type":"select","source":"educators"},
   {"key":"status","label":"Status","type":"select","options":["active","revoked"]}]'),
('test_series', 'Courses / test series report', 'Catalogue, enrollments and revenue per test series', 'Created on', 2,
 '[{"key":"title","label":"Test series"},{"key":"subject","label":"Subject"},{"key":"status","label":"Status"},
   {"key":"pricing","label":"Pricing"},{"key":"price_inr","label":"Price (INR)"},{"key":"educators","label":"Educators"},
   {"key":"created_on","label":"Created on"},{"key":"enrollments","label":"Enrollments"},{"key":"revenue_inr","label":"Revenue (INR)"}]',
 '[{"key":"subject_id","label":"Subject","type":"select","source":"subjects"},
   {"key":"status","label":"Status","type":"select","options":["draft","scheduled","published","archived"]},
   {"key":"pricing","label":"Pricing","type":"select","options":["free","paid"]},
   {"key":"educator_id","label":"Educator","type":"select","source":"educators"}]'),
('educators', 'Educator report', 'Educator status, load and earnings', 'Joined on', 3,
 '[{"key":"educator","label":"Educator"},{"key":"email","label":"Email"},{"key":"verification_status","label":"Verification"},
   {"key":"account_status","label":"Account"},{"key":"joined_on","label":"Joined on"},
   {"key":"series_assigned","label":"Test series assigned"},{"key":"sales","label":"Sales"},{"key":"earnings_inr","label":"Earnings (INR)"}]',
 '[{"key":"verification_status","label":"Verification","type":"select","options":["pending","verified","rejected"]},
   {"key":"account_status","label":"Account status","type":"select","options":["active","inactive","suspended"]}]'),
('students', 'Student report', 'Registrations, enrollments and spend', 'Registered on', 4,
 '[{"key":"student","label":"Student"},{"key":"email","label":"Email"},{"key":"grade","label":"Grade"},
   {"key":"account_status","label":"Account"},{"key":"registered_on","label":"Registered on"},
   {"key":"enrollments","label":"Enrollments"},{"key":"total_spent_inr","label":"Total spent (INR)"}]',
 '[{"key":"grade","label":"Grade","type":"select","source":"grades"},
   {"key":"account_status","label":"Account status","type":"select","options":["active","blocked"]},
   {"key":"has_enrollment","label":"Has enrollment","type":"select","options":["yes","no"]}]')
on conflict (key) do nothing;

-- ------------------------------------------------- platform_settings (lead)
insert into public.platform_settings (key, value, description)
values ('dashboard_quote',
        to_jsonb('Empowering educators. Enabling learners. Building brighter futures.'::text),
        'Admin dashboard welcome quote')
on conflict (key) do nothing;

-- -------------------------------------------------------------------- RLS
-- RPC-only tables: RLS on, no policies, no direct grants for browser roles.
alter table public.regions         enable row level security;
alter table public.admin_nav_items enable row level security;
alter table public.report_types    enable row level security;
revoke all on table public.regions, public.admin_nav_items, public.report_types from anon, authenticated;
