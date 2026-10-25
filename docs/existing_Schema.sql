-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['student'::text, 'educator'::text, 'head_teacher'::text, 'regional_head'::text, 'admin'::text, 'super_admin'::text, 'parent'::text])),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  location text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  avatar_url text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.student_profiles (
  user_id uuid NOT NULL,
  age text,
  gender text,
  school_name text,
  grade text,
  school_id_card_url text,
  father_name text,
  mother_name text,
  parent_email text,
  interests ARRAY NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT student_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT student_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.educator_profiles (
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  location text NOT NULL,
  verification_status text NOT NULL DEFAULT 'pending'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  bio text,
  photo_url text,
  qualifications text,
  experience_years integer,
  subjects ARRAY,
  languages ARRAY,
  digital_id_url text,
  rejected_reason text,
  verified_at timestamp with time zone,
  verified_by uuid,
  rating_avg numeric,
  total_students integer NOT NULL DEFAULT 0,
  total_courses integer NOT NULL DEFAULT 0,
  CONSTRAINT educator_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT educator_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT educator_profiles_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.institutions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['school'::text, 'coaching_center'::text, 'university'::text, 'regional_body'::text, 'other'::text])),
  description text,
  address text,
  city text,
  state text,
  country text NOT NULL DEFAULT 'India'::text,
  pincode text,
  phone text,
  email text,
  website text,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT institutions_pkey PRIMARY KEY (id),
  CONSTRAINT institutions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.org_units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  parent_unit_id uuid,
  name text NOT NULL,
  unit_type text NOT NULL CHECK (unit_type = ANY (ARRAY['region'::text, 'branch'::text, 'department'::text, 'class'::text, 'other'::text])),
  description text,
  city text,
  state text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT org_units_pkey PRIMARY KEY (id),
  CONSTRAINT org_units_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id),
  CONSTRAINT org_units_parent_unit_id_fkey FOREIGN KEY (parent_unit_id) REFERENCES public.org_units(id)
);
CREATE TABLE public.staff_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_unit_id uuid NOT NULL,
  educator_id uuid NOT NULL,
  assigned_by uuid,
  role_in_unit text NOT NULL DEFAULT 'teacher'::text CHECK (role_in_unit = ANY (ARRAY['teacher'::text, 'head_teacher'::text, 'coordinator'::text])),
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  removed_at timestamp with time zone,
  CONSTRAINT staff_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT staff_assignments_org_unit_id_fkey FOREIGN KEY (org_unit_id) REFERENCES public.org_units(id),
  CONSTRAINT staff_assignments_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id),
  CONSTRAINT staff_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.manager_scopes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  org_unit_id uuid NOT NULL,
  granted_by uuid,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT manager_scopes_pkey PRIMARY KEY (id),
  CONSTRAINT manager_scopes_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.profiles(id),
  CONSTRAINT manager_scopes_org_unit_id_fkey FOREIGN KEY (org_unit_id) REFERENCES public.org_units(id),
  CONSTRAINT manager_scopes_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  icon_url text,
  parent_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id)
);
CREATE TABLE public.courses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  educator_id uuid NOT NULL,
  org_unit_id uuid,
  category_id uuid,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  description text,
  thumbnail_url text,
  preview_video_url text,
  language text NOT NULL DEFAULT 'English'::text,
  level text CHECK (level = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'all_levels'::text])),
  target_grades ARRAY,
  subjects ARRAY,
  tags ARRAY,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR'::text,
  discount_price numeric,
  discount_expires_at timestamp with time zone,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'published'::text, 'archived'::text, 'rejected'::text])),
  rejection_reason text,
  completion_criteria jsonb NOT NULL DEFAULT '{"required_assessments": true, "min_lesson_completion": 100}'::jsonb,
  video_completion_threshold numeric NOT NULL DEFAULT 90.0,
  allow_resubmission boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  submitted_at timestamp with time zone,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  join_policy text NOT NULL DEFAULT 'approval'::text CHECK (join_policy = ANY (ARRAY['open'::text, 'approval'::text])),
  CONSTRAINT courses_pkey PRIMARY KEY (id),
  CONSTRAINT courses_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id),
  CONSTRAINT courses_org_unit_id_fkey FOREIGN KEY (org_unit_id) REFERENCES public.org_units(id),
  CONSTRAINT courses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT courses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.course_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_versions_pkey PRIMARY KEY (id),
  CONSTRAINT course_versions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.course_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_modules_pkey PRIMARY KEY (id),
  CONSTRAINT course_modules_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.lessons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL,
  course_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['video'::text, 'pdf'::text, 'text'::text, 'quiz'::text, 'assignment'::text, 'external_link'::text])),
  is_free_preview boolean NOT NULL DEFAULT false,
  is_required boolean NOT NULL DEFAULT true,
  duration_seconds integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lessons_pkey PRIMARY KEY (id),
  CONSTRAINT lessons_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.course_modules(id),
  CONSTRAINT lessons_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.lesson_materials (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL,
  material_type text NOT NULL CHECK (material_type = ANY (ARRAY['video'::text, 'pdf'::text, 'text'::text, 'image'::text, 'link'::text, 'subtitle'::text])),
  title text,
  file_url text,
  external_url text,
  text_content text,
  file_size_bytes bigint,
  mime_type text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lesson_materials_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_materials_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);
CREATE TABLE public.wishlists (
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT wishlists_pkey PRIMARY KEY (student_id, course_id),
  CONSTRAINT wishlists_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT wishlists_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  order_id uuid,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  expiry_date timestamp with time zone,
  CONSTRAINT enrollments_pkey PRIMARY KEY (id),
  CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.lesson_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  course_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'not_started'::text CHECK (status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text])),
  watch_percentage numeric DEFAULT 0,
  last_position_seconds integer DEFAULT 0,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lesson_progress_pkey PRIMARY KEY (id),
  CONSTRAINT lesson_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT lesson_progress_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT lesson_progress_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.student_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  lesson_id uuid,
  course_id uuid,
  session_id uuid,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_notes_pkey PRIMARY KEY (id),
  CONSTRAINT student_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT student_notes_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT student_notes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.course_reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT course_reviews_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_reviews_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.course_faqs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT course_faqs_pkey PRIMARY KEY (id),
  CONSTRAINT course_faqs_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.learning_pathways (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT learning_pathways_pkey PRIMARY KEY (id),
  CONSTRAINT learning_pathways_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.pathway_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL,
  course_id uuid,
  step_type text NOT NULL CHECK (step_type = ANY (ARRAY['course'::text, 'assessment'::text, 'certificate'::text, 'milestone'::text])),
  title text,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pathway_steps_pkey PRIMARY KEY (id),
  CONSTRAINT pathway_steps_pathway_id_fkey FOREIGN KEY (pathway_id) REFERENCES public.learning_pathways(id),
  CONSTRAINT pathway_steps_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.student_pathway_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  pathway_id uuid NOT NULL,
  current_step integer NOT NULL DEFAULT 0,
  completed_at timestamp with time zone,
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_pathway_progress_pkey PRIMARY KEY (id),
  CONSTRAINT student_pathway_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT student_pathway_progress_pathway_id_fkey FOREIGN KEY (pathway_id) REFERENCES public.learning_pathways(id)
);
CREATE TABLE public.availability_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  educator_id uuid NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_rule text,
  slot_type text NOT NULL DEFAULT 'one_on_one'::text CHECK (slot_type = ANY (ARRAY['one_on_one'::text, 'group_class'::text, 'consultation'::text])),
  max_students integer NOT NULL DEFAULT 1,
  price numeric,
  currency text NOT NULL DEFAULT 'INR'::text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT availability_slots_pkey PRIMARY KEY (id),
  CONSTRAINT availability_slots_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL,
  student_id uuid NOT NULL,
  educator_id uuid NOT NULL,
  order_id uuid,
  status text NOT NULL DEFAULT 'pending_payment'::text CHECK (status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'rescheduled'::text, 'cancelled_by_student'::text, 'cancelled_by_educator'::text, 'completed'::text, 'no_show'::text])),
  notes text,
  rescheduled_from_id uuid,
  cancel_reason text,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.availability_slots(id),
  CONSTRAINT bookings_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT bookings_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id),
  CONSTRAINT bookings_rescheduled_from_id_fkey FOREIGN KEY (rescheduled_from_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.teacher_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  from_educator_id uuid NOT NULL,
  to_educator_id uuid,
  course_id uuid,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'withdrawn'::text])),
  reviewed_by uuid,
  review_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teacher_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_change_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT teacher_change_requests_from_educator_id_fkey FOREIGN KEY (from_educator_id) REFERENCES public.profiles(id),
  CONSTRAINT teacher_change_requests_to_educator_id_fkey FOREIGN KEY (to_educator_id) REFERENCES public.profiles(id),
  CONSTRAINT teacher_change_requests_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT teacher_change_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.live_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid,
  educator_id uuid NOT NULL,
  course_id uuid,
  title text NOT NULL,
  description text,
  scheduled_start timestamp with time zone NOT NULL,
  scheduled_end timestamp with time zone NOT NULL,
  actual_start timestamp with time zone,
  actual_end timestamp with time zone,
  status text NOT NULL DEFAULT 'scheduled'::text CHECK (status = ANY (ARRAY['scheduled'::text, 'live'::text, 'ended'::text, 'cancelled'::text])),
  session_type text NOT NULL DEFAULT 'one_on_one'::text CHECK (session_type = ANY (ARRAY['one_on_one'::text, 'group_class'::text, 'webinar'::text])),
  max_participants integer NOT NULL DEFAULT 1,
  video_provider text NOT NULL DEFAULT 'agora'::text CHECK (video_provider = ANY (ARRAY['agora'::text, 'daily'::text, 'zoom'::text, 'jitsi'::text, 'custom'::text])),
  meeting_id text,
  recording_url text,
  recording_status text DEFAULT 'none'::text CHECK (recording_status = ANY (ARRAY['none'::text, 'processing'::text, 'available'::text, 'failed'::text])),
  is_recorded boolean NOT NULL DEFAULT true,
  whiteboard_enabled boolean NOT NULL DEFAULT true,
  chat_enabled boolean NOT NULL DEFAULT true,
  polls_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT live_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT live_sessions_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT live_sessions_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id),
  CONSTRAINT live_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.session_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_in_session text NOT NULL DEFAULT 'student'::text CHECK (role_in_session = ANY (ARRAY['host'::text, 'student'::text, 'observer'::text])),
  joined_at timestamp with time zone,
  left_at timestamp with time zone,
  duration_seconds integer DEFAULT 
CASE
    WHEN ((joined_at IS NOT NULL) AND (left_at IS NOT NULL)) THEN (EXTRACT(epoch FROM (left_at - joined_at)))::integer
    ELSE NULL::integer
END,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_participants_pkey PRIMARY KEY (id),
  CONSTRAINT session_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id),
  CONSTRAINT session_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.session_join_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_join_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT session_join_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id),
  CONSTRAINT session_join_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.session_polls (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  question text NOT NULL,
  options jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_polls_pkey PRIMARY KEY (id),
  CONSTRAINT session_polls_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id),
  CONSTRAINT session_polls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.session_poll_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL,
  user_id uuid NOT NULL,
  option_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_poll_responses_pkey PRIMARY KEY (id),
  CONSTRAINT session_poll_responses_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES public.session_polls(id),
  CONSTRAINT session_poll_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.session_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_ratings_pkey PRIMARY KEY (id),
  CONSTRAINT session_ratings_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id),
  CONSTRAINT session_ratings_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.hand_raise_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  raised_at timestamp with time zone NOT NULL DEFAULT now(),
  lowered_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT hand_raise_queue_pkey PRIMARY KEY (id),
  CONSTRAINT hand_raise_queue_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id),
  CONSTRAINT hand_raise_queue_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.quizzes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  lesson_id uuid,
  title text NOT NULL,
  description text,
  time_limit_mins integer,
  max_attempts integer NOT NULL DEFAULT 3,
  passing_score numeric NOT NULL DEFAULT 60.0,
  is_required boolean NOT NULL DEFAULT true,
  shuffle_questions boolean NOT NULL DEFAULT false,
  show_answers_after text NOT NULL DEFAULT 'submission'::text CHECK (show_answers_after = ANY (ARRAY['submission'::text, 'passing'::text, 'never'::text])),
  series_id uuid,
  is_proctored boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  series_sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT quizzes_pkey PRIMARY KEY (id),
  CONSTRAINT quizzes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT quizzes_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id),
  CONSTRAINT quizzes_series_fk FOREIGN KEY (series_id) REFERENCES public.test_series(id)
);
CREATE TABLE public.test_series (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  instructions text,
  is_published boolean NOT NULL DEFAULT false,
  available_from timestamp with time zone,
  available_until timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT test_series_pkey PRIMARY KEY (id),
  CONSTRAINT test_series_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.quiz_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'multiple_choice'::text CHECK (question_type = ANY (ARRAY['multiple_choice'::text, 'true_false'::text, 'fill_in_blank'::text, 'short_answer'::text])),
  points numeric NOT NULL DEFAULT 1,
  explanation text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quiz_questions_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id)
);
CREATE TABLE public.quiz_question_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL,
  option_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT quiz_question_options_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_question_options_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id)
);
CREATE TABLE public.quiz_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL,
  student_id uuid NOT NULL,
  attempt_number integer NOT NULL,
  score numeric,
  max_score numeric,
  percentage numeric,
  passed boolean,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  submitted_at timestamp with time zone,
  time_taken_secs integer,
  status text NOT NULL DEFAULT 'in_progress'::text CHECK (status = ANY (ARRAY['in_progress'::text, 'submitted'::text, 'timed_out'::text, 'abandoned'::text])),
  CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_attempts_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id),
  CONSTRAINT quiz_attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.quiz_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  answer_text text,
  selected_option_ids ARRAY,
  is_correct boolean,
  points_earned numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quiz_answers_pkey PRIMARY KEY (id),
  CONSTRAINT quiz_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES public.quiz_attempts(id),
  CONSTRAINT quiz_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.quiz_questions(id)
);
CREATE TABLE public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  lesson_id uuid,
  title text NOT NULL,
  description text,
  instructions text,
  due_date timestamp with time zone,
  max_score numeric NOT NULL DEFAULT 100,
  is_required boolean NOT NULL DEFAULT true,
  allow_resubmit boolean NOT NULL DEFAULT true,
  accept_late boolean NOT NULL DEFAULT true,
  rubric jsonb,
  plagiarism_check boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT assignments_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);
CREATE TABLE public.assignment_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL,
  student_id uuid NOT NULL,
  submission_number integer NOT NULL DEFAULT 1,
  file_url text,
  file_name text,
  text_answer text,
  submitted_at timestamp with time zone NOT NULL DEFAULT now(),
  is_late boolean NOT NULL DEFAULT false,
  score numeric,
  feedback text,
  graded_by uuid,
  graded_at timestamp with time zone,
  rubric_scores jsonb,
  plagiarism_score numeric,
  status text NOT NULL DEFAULT 'submitted'::text CHECK (status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'graded'::text, 'returned'::text])),
  CONSTRAINT assignment_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id),
  CONSTRAINT assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT assignment_submissions_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.homework_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  educator_id uuid NOT NULL,
  course_id uuid NOT NULL,
  lesson_id uuid,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT homework_uploads_pkey PRIMARY KEY (id),
  CONSTRAINT homework_uploads_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id),
  CONSTRAINT homework_uploads_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT homework_uploads_lesson_id_fkey FOREIGN KEY (lesson_id) REFERENCES public.lessons(id)
);
CREATE TABLE public.marksheet_uploads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  educator_id uuid NOT NULL,
  course_id uuid NOT NULL,
  student_id uuid,
  title text NOT NULL,
  file_url text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT marksheet_uploads_pkey PRIMARY KEY (id),
  CONSTRAINT marksheet_uploads_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id),
  CONSTRAINT marksheet_uploads_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT marksheet_uploads_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  course_id uuid NOT NULL,
  certificate_number text NOT NULL UNIQUE,
  issued_at timestamp with time zone NOT NULL DEFAULT now(),
  template_id text,
  metadata jsonb,
  CONSTRAINT certificates_pkey PRIMARY KEY (id),
  CONSTRAINT certificates_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT certificates_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  educator_id uuid NOT NULL,
  course_id uuid,
  last_message_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT conversations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT conversations_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text,
  attachment_url text,
  attachment_type text CHECK (attachment_type = ANY (ARRAY['image'::text, 'file'::text, 'link'::text])),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.session_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT session_chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.live_sessions(id),
  CONSTRAINT session_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  educator_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT announcements_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.broadcasts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  educator_id uuid NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT broadcasts_pkey PRIMARY KEY (id),
  CONSTRAINT broadcasts_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL CHECK (category = ANY (ARRAY['course_update'::text, 'assignment_reminder'::text, 'assessment_result'::text, 'booking_confirmation'::text, 'booking_reminder'::text, 'payment'::text, 'refund'::text, 'payout'::text, 'verification'::text, 'moderation'::text, 'announcement'::text, 'broadcast'::text, 'certificate'::text, 'parent_report'::text, 'system'::text, 'support_ticket'::text])),
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  reference_type text,
  reference_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL,
  category text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT true,
  sms boolean NOT NULL DEFAULT false,
  whatsapp boolean NOT NULL DEFAULT false,
  push boolean NOT NULL DEFAULT true,
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id, category),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.notification_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  title_tmpl text NOT NULL,
  body_tmpl text NOT NULL,
  channels ARRAY NOT NULL DEFAULT '{in_app}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_templates_pkey PRIMARY KEY (id),
  CONSTRAINT notification_templates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.parent_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  parent_user_id uuid,
  parent_name text NOT NULL,
  parent_email text,
  parent_phone text,
  relationship text NOT NULL DEFAULT 'parent'::text CHECK (relationship = ANY (ARRAY['parent'::text, 'guardian'::text, 'other'::text])),
  report_email boolean NOT NULL DEFAULT true,
  report_sms boolean NOT NULL DEFAULT false,
  report_whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parent_contacts_pkey PRIMARY KEY (id),
  CONSTRAINT parent_contacts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT parent_contacts_parent_user_id_fkey FOREIGN KEY (parent_user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.parent_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  parent_contact_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  report_data jsonb NOT NULL,
  sent_at timestamp with time zone,
  delivery_status text CHECK (delivery_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parent_reports_pkey PRIMARY KEY (id),
  CONSTRAINT parent_reports_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT parent_reports_parent_contact_id_fkey FOREIGN KEY (parent_contact_id) REFERENCES public.parent_contacts(id)
);
CREATE TABLE public.discussion_forums (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid,
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT discussion_forums_pkey PRIMARY KEY (id),
  CONSTRAINT discussion_forums_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id)
);
CREATE TABLE public.discussion_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  forum_id uuid NOT NULL,
  author_id uuid NOT NULL,
  parent_id uuid,
  title text,
  content text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  is_answered boolean NOT NULL DEFAULT false,
  is_removed boolean NOT NULL DEFAULT false,
  upvote_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT discussion_posts_pkey PRIMARY KEY (id),
  CONSTRAINT discussion_posts_forum_id_fkey FOREIGN KEY (forum_id) REFERENCES public.discussion_forums(id),
  CONSTRAINT discussion_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id),
  CONSTRAINT discussion_posts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.discussion_posts(id)
);
CREATE TABLE public.support_tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL,
  assigned_to uuid,
  category text NOT NULL CHECK (category = ANY (ARRAY['technical'::text, 'billing'::text, 'course_content'::text, 'verification'::text, 'account'::text, 'booking'::text, 'refund'::text, 'other'::text])),
  subject text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium'::text CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])),
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'waiting_on_user'::text, 'resolved'::text, 'closed'::text])),
  reference_type text,
  reference_id uuid,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_pkey PRIMARY KEY (id),
  CONSTRAINT support_tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id),
  CONSTRAINT support_tickets_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.support_ticket_replies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  attachment_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_ticket_replies_pkey PRIMARY KEY (id),
  CONSTRAINT support_ticket_replies_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id),
  CONSTRAINT support_ticket_replies_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.moderation_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reported_by uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type = ANY (ARRAY['course'::text, 'lesson'::text, 'review'::text, 'message'::text, 'discussion_post'::text, 'profile'::text, 'session'::text])),
  content_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'under_review'::text, 'resolved_no_action'::text, 'resolved_actioned'::text, 'dismissed'::text])),
  reviewed_by uuid,
  action_taken text,
  review_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_at timestamp with time zone,
  CONSTRAINT moderation_reports_pkey PRIMARY KEY (id),
  CONSTRAINT moderation_reports_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.profiles(id),
  CONSTRAINT moderation_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  before_state jsonb,
  after_state jsonb,
  reason text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.platform_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_pkey PRIMARY KEY (key),
  CONSTRAINT platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.cms_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  content jsonb NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cms_pages_pkey PRIMARY KEY (id),
  CONSTRAINT cms_pages_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.consent_records (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL CHECK (consent_type = ANY (ARRAY['terms_and_conditions'::text, 'privacy_policy'::text, 'marketing_emails'::text, 'data_processing'::text, 'cookies'::text])),
  version text NOT NULL,
  consented boolean NOT NULL,
  ip_address text,
  consented_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT consent_records_pkey PRIMARY KEY (id),
  CONSTRAINT consent_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.data_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type = ANY (ARRAY['export'::text, 'deletion'::text, 'correction'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'rejected'::text])),
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  notes text,
  reviewed_by uuid,
  CONSTRAINT data_requests_pkey PRIMARY KEY (id),
  CONSTRAINT data_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT data_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.callback_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  message text,
  source text,
  status text NOT NULL DEFAULT 'new'::text CHECK (status = ANY (ARRAY['new'::text, 'contacted'::text, 'closed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT callback_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.educator_verification_docs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  educator_id uuid NOT NULL,
  doc_type text NOT NULL CHECK (doc_type = ANY (ARRAY['government_id'::text, 'degree_certificate'::text, 'teaching_license'::text, 'experience_letter'::text, 'subject_certificate'::text, 'other'::text])),
  doc_url text NOT NULL,
  doc_name text,
  is_verified boolean,
  verified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT educator_verification_docs_pkey PRIMARY KEY (id),
  CONSTRAINT educator_verification_docs_educator_id_fkey FOREIGN KEY (educator_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.mfa_enforcement (
  user_id uuid NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  enrolled_at timestamp with time zone,
  last_verified_at timestamp with time zone,
  CONSTRAINT mfa_enforcement_pkey PRIMARY KEY (user_id),
  CONSTRAINT mfa_enforcement_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.course_join_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  student_id uuid NOT NULL,
  initiated_by text NOT NULL CHECK (initiated_by = ANY (ARRAY['student'::text, 'educator'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text])),
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone,
  CONSTRAINT course_join_requests_pkey PRIMARY KEY (id),
  CONSTRAINT course_join_requests_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id),
  CONSTRAINT course_join_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);