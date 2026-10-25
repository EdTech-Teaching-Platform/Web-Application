# Admin portal on the existing production database

Sources compared:

- `docs/existing_Schema.sql` — the lead's production schema (67 tables).
- `supabase/migrations_archive/0001`–`0013` — the admin schema written for a blank
  project. **These will not be applied.**
- `src/portals/admin/services/*.js`, `src/portals/admin/pages/AdminLogin.jsx`,
  `src/context/AuthContext.jsx`, `supabase/functions/*` — the callers whose
  contract must not change.

No code or migration was changed while producing this document.

---

## 0. Summary

**What the dump contains, and what it leaves out.** `existing_Schema.sql` has
`CREATE TABLE` statements only. It has **no functions, RLS policies, enum types,
views, triggers, indexes or storage buckets**. That means `is_admin`,
`owns_course`, `is_enrolled` and `manages_org_unit` are not in it. Sections 3
and 6 therefore say what is known and give the exact queries the lead needs to
run. Nothing in this document guesses at a function body.

**The structural mismatches that drive everything else:**

1. **The lead sells courses; the archive sells test series.** In the lead's
   schema, `test_series.course_id` is `NOT NULL`. A series is part of a course.
   Tests are `quizzes.series_id`, and access comes through course
   `enrollments`. The archive treats a series as a standalone product with its
   own price, enrolments, payments, discounts and refunds.
2. **The lead's schema has no payments, orders, refunds or payouts tables.**
   `enrollments.order_id` and `bookings.order_id` are bare `uuid` columns with
   no FK, so they point at a table that is either missing from the dump or not
   built yet. Every money page depends on this (Q1).
3. **The lead uses `text` + `CHECK` everywhere; the archive uses enums.** RPC
   parameters sent from the browser are JSON strings, so new objects can switch
   enum parameters to `text` without the React code noticing.
4. **Five archived tables have the same names as lead tables but different
   shapes:** `profiles`, `test_series`, `institutions`, `notifications`,
   `callback_requests`.
5. **Some React code writes to tables directly, not through RPCs.** Table and
   column names are part of the contract too, not just RPC names (§4.1). The
   main case is `testSeriesApi.js`, which writes to `test_series`, `tests`,
   `questions`, `question_options` and `test_sections`. A zero-React-change
   plan is not possible here without adding ~20 columns and a sync trigger to
   the lead's `test_series` (Q2).
6. **Two archived migrations would damage production if applied:**
   - `0013` enables RLS on *every* public table that has no policy and gives it
     an admin-only policy. That would lock students and educators out of the
     lead's tables.
   - `0012` replaces the `auth.users` signup trigger.

   Neither may be ported.

**Counts:** 52 archived tables. 31 are NEW, 16 are MAPS_TO and 5 are CONFLICT
(§1). Of roughly 130 RPCs, views and direct-table calls used by the frontend
(the split below is a rough estimate from the §4 tables):
- about 45% are supportable with new objects only;
- about 25% need a lead decision;
- about 30% are blocked on the missing payments/orders model (§4).

---

## 1. Classification of every archived object

Legend:

- **NEW**: no clash; add as is (after the conventions in §7: `text` + `CHECK`,
  `adm_`-prefixed helpers).
- **MAPS_TO**: the lead already has a table for this purpose with different
  columns. Column mapping is in §2.
- **CONFLICT**: same name, different shape. The resolution is in §2.

### 1.1 Tables (52)

| Archived table | Mig. | Class | Lead object / resolution |
|---|---|---|---|
| `profiles` | 0001 | **CONFLICT** | Lead's `profiles` wins. Drop the archived DDL entirely; do not rename. §2.1 |
| `test_series` | 0002 | **CONFLICT** | Lead's `test_series` wins (same concept, and `quizzes.series_id` references it). Put admin-only fields in a 1:1 extension table `test_series_admin`. §2.2 |
| `institutions` | 0007 | **CONFLICT** | Lead's wins. Extend in place: add `state_code`. §2.3 |
| `notifications` | 0008 | **CONFLICT** | Different concept (campaign vs per-user inbox row). **Rename the archived one to `notification_campaigns`.** §2.4 |
| `callback_requests` | 0009 | **CONFLICT** | Same purpose, and the status values are identical. Extend in place; do not rename. §2.5 |
| `subjects` | 0001 | MAPS_TO | `categories` (reached through `courses.category_id`), pending Q11. §2.6 |
| `tests` | 0002 | MAPS_TO | `quizzes` (`series_id`, `series_sort_order`). §2.7 |
| `questions` | 0002 | MAPS_TO | `quiz_questions`. §2.8 |
| `question_options` | 0002 | MAPS_TO | `quiz_question_options`. §2.9 |
| `test_attempts` | 0002 | MAPS_TO | `quiz_attempts`. §2.10 |
| `attempt_answers` | 0002 | MAPS_TO | `quiz_answers`. §2.11 |
| `series_enrollments` | 0002 | MAPS_TO | `enrollments`, joined through `test_series.course_id`. §2.12 |
| `students` | 0004 | MAPS_TO | `student_profiles` + `profiles`, plus a NEW side table for admin-only state (it can keep the name `students`; §2.13). |
| `educators` | 0004 | MAPS_TO | `educator_profiles` + `profiles`, plus a NEW side table `educator_admin_state`. §2.14 |
| `educator_documents` | 0004 | MAPS_TO | `educator_verification_docs`. §2.15 |
| `educator_ratings` | 0004 | MAPS_TO | `educator_profiles.rating_avg` and `course_reviews` via `courses.educator_id`. §2.16 |
| `educator_status_history` | 0004 | MAPS_TO | `audit_logs`. §2.17 |
| `notification_recipients` | 0008 | MAPS_TO | Inbox rows go to the lead's `notifications`. Email delivery tracking stays in a NEW table. §2.4 |
| `auth_events` | 0010 | MAPS_TO | `audit_logs` (pending Q14). §2.17 |
| `export_log` | 0007 | MAPS_TO | `audit_logs` (`action = 'export'`). §2.17 |
| `app_settings` | 0011 | MAPS_TO | `platform_settings` (same key/jsonb shape). §2.18 |
| `test_sections` | 0002 | NEW | The lead has no section concept. FK to `quizzes(id)`. |
| `ai_test_jobs` | 0002 | NEW | FKs re-pointed to `test_series` / `quizzes`; `subject_id` follows Q11. |
| `ai_generated_questions` | 0002 | NEW | |
| `test_assignments` | 0002/0003 | NEW | Defined twice in the archive (0002 and 0003); merge into one. Not to be confused with the lead's `assignments` (course homework). |
| `series_requests` | 0003 | NEW | |
| `assignment_status_progress` | 0003 | NEW | Lookup. Consider prefixing `test_assignment_*`, since the lead has `assignments` / `assignment_submissions`. |
| `assignment_comments` | 0003 | NEW | Same naming note. `question_id` → `quiz_questions(id)`. |
| `assignment_history` | 0003 | NEW | Same naming note. |
| `assignment_notifications` | 0003 | NEW | Could also fan out into the lead's `notifications`; keeping it separate preserves the `get_assignment_detail` shape. |
| `student_block_history` | 0004 | NEW | Must keep this name: `studentsApi.js` inserts into it directly. Optionally mirror to `audit_logs`. |
| `educator_invites` | 0004 | NEW | |
| `discounts` | 0005 | NEW | Scope is test series only; the lead sells courses (Q15). Unrelated to `courses.discount_price`. |
| `discount_series` | 0005 | NEW | |
| `discount_redemptions` | 0005 | NEW | `payment_id` FK blocked on Q1. |
| `discount_events` | 0005 | NEW | |
| `payments` | 0005 | NEW, **blocked Q1** | Must not be created until the lead confirms whether an orders/payments table exists. |
| `payment_events` | 0005 | NEW, blocked Q1 | |
| `educator_txn_counters` | 0005 | NEW, blocked Q1 | |
| `refund_settings` | 0006 | NEW, blocked Q1 | Could instead be a `platform_settings` key (`refund_window_days`). |
| `refund_requests` | 0006 | NEW, blocked Q1 | `item_type` already allows `'course'`, which fits the lead's model. |
| `refund_events` | 0006 | NEW, blocked Q1 | |
| `payouts` | 0007 | NEW, blocked Q1 | The lead's `notifications.category` includes `'payout'`, so payouts may be planned. Ask. |
| `question_similarity_matches` | 0007 | NEW | FKs to `quiz_questions(id)`. |
| `regions` | 0007 | NEW | Indian states/UTs lookup. Not the same thing as `org_units.unit_type = 'region'` (Q16). |
| `report_types` | 0007 | NEW | Seed data needs column/filter keys rewritten to lead columns. |
| `report_runs` | 0007 | NEW | |
| `notification_events` | 0008 | NEW | Rename to `notification_campaign_events`. |
| `callback_activity` | 0009 | NEW | |
| `user_sessions` | 0010 | NEW | Must keep this name: `securityApi.js` selects from it directly. |
| `admin_notes` | 0011 | NEW | |
| `admin_nav_items` | 0011 | NEW | Seed with the final routes from 0012, not the 0011 ones. |

### 1.2 Views (archived)

All views are NEW names with no clash. Every one has to be rewritten over lead
tables. The ones marked ★ are read **directly** by React, so their names and
columns are contract.

`v_test_series_list`, `v_test_structure`, `v_student_options`,
`v_assignments_list`, `v_series_requests`★, `v_series_approvals`,
`v_series_educators`, `v_students_list`★, `v_educators_list`,
`v_educator_subject_options`, `v_pending_educators`, `v_eligible_educators`★,
`v_discounts_list`, `v_discount_history`, `v_transactions`, `v_refund_requests`,
`v_series_tracker`, `v_tracker_educators`, `v_repeated_matches`, `v_tpa_tests`,
`v_tpa_series_options`, `v_notifications_list`, `v_callback_requests`.

Plus two **compatibility views** the plan adds so direct-table React calls keep
working: `series_enrollments` (over `enrollments`, §2.12) and
`educator_documents` (over `educator_verification_docs`, §2.15).

### 1.3 Enums (archived, 33)

None of these appear in the dump (the dump shows no types at all). They are
classified NEW, but the recommendation is **not to create them**. The new
tables should use `text` + `CHECK`, matching the lead's convention.
Specifically:

- `user_role`: **must not be created or used.** `profiles.role` is `text` with
  a 7-value CHECK.
- `educator_verification`: must not be used. `educator_profiles.verification_status`
  is `text` (Q8).
- `question_type`, `difficulty_lvl`, `attempt_status`, `test_status`,
  `series_status`: only meaningful if parallel tables were built. Under MAPS_TO
  they become mapping functions instead (§2.7–2.10).
- All others (`assignment_status`, `question_mix`, `request_status`,
  `student_status`, `educator_account`, `doc_status`, `discount_*`,
  `redemption_status`, `payment_status`, `payment_method`, `refund_*`,
  `match_type`, `match_review`, `payout_status`, `report_run_status`,
  `notification_*`, `email_delivery_status`, `recipient_delivery_status`,
  `callback_*`, `auth_event_type`, `session_end_reason`, `start_method`,
  `pricing_type`, `ai_*`) become `text` + `CHECK` columns on the new tables.
  RPC parameters typed as these enums become `text`. The browser sends strings
  either way.

### 1.4 Sequences, triggers, storage, extensions

| Object | Class | Note |
|---|---|---|
| Sequences `test_series_code_seq`, `assignment_code_seq`, `request_code_seq`, `student_code_seq`, `educator_code_seq`, `educator_no_seq`, `discount_code_seq`, `refund_code_seq`, `callback_code_seq` | NEW | Used for human IDs (`TS-1001`, `CB-1001`, …). |
| Trigger `on_auth_user_created` on `auth.users` + `handle_new_user()` (0012) | **CONFLICT — do not port** | The lead's database already creates `profiles` rows somehow (`role`/`full_name` are NOT NULL), very likely through this same Supabase-template name. Replacing it would break student/educator signup (Q9). |
| Triggers on lead tables: `trg_series_updated`, `trg_series_code` (`test_series`), `trg_sync_marks` (`questions`), `trg_assign_complete` (`tests`), `trg_payment_institution`, `trg_institutions_updated` | **Do not port onto lead tables** | Use the `adm_` versions only on new tables; derive values at read time instead. |
| Triggers on new tables (`trg_assign_code`, `trg_discounts_no_delete`, `trg_redemptions_count`, `trg_refund_no_delete`, `trg_nrec_*`, `trg_cb_updated`, `trg_edu_auth_ban`, `trg_*_block_revoke`, `trg_sync_student_block_status`, …) | NEW | Point them at `adm_touch_updated_at()`, not `set_updated_at()` (§3.3). `trg_edu_auth_ban` writes `auth.users.banned_until`; that write moves to an Edge Function (Q10). |
| Storage bucket `question-images` + policies (0002) | NEW | Check the lead's existing buckets first. The `educator-documents` bucket is referenced in `educatorsApi.js` but never created by the archive (Q17). |
| Extensions `pgcrypto`, `pg_trgm` | Probably present | `gen_random_uuid()` is used by the lead. Check `pg_trgm` with `select * from pg_extension`. `pg_cron` is referenced in comments only. |
| Policies created on lead-named tables (`profiles_read`, `profiles_admin` on `profiles` in 0002; `series_*` on `test_series`; `institutions_*`; `notif_*` on `notifications`; `cb_*` on `callback_requests`) | **Do not port** | Permissive policies are OR-ed together, so adding `profiles_admin for all using (is_admin())` *widens* access to the lead's tables. |

---

## 2. Column mappings for MAPS_TO and CONFLICT

Notation: **ADD** means `alter table … add column if not exists`. Where a 1:1
extension table is recommended instead (§7, rule E), it is marked
**EXT → `<table>`**.

### 2.1 `profiles` (CONFLICT, resolved by using the lead's table unchanged)

| Archived column | Lead column | Difference / action |
|---|---|---|
| `id uuid pk → auth.users on delete cascade` | `id uuid pk → auth.users` (no cascade) | Keep the lead's version. |
| `full_name text not null` | `full_name text not null` | Same. |
| `email text unique not null` | `email text not null` (no UNIQUE in the dump) | `register_educator` / `create_educator_invites` already look up by `lower(email)`, so no constraint is needed. |
| `role user_role not null default 'student'` | `role text not null CHECK (7 values)`, no default | **Type differs.** Compare as text. Never cast to an enum, never add a default, never touch the CHECK. |
| `state text` | `location text` | Free text in both. The archive reads `profiles.state` in `v_students_list`; map it to `location`. |
| `created_at timestamptz default now()` | `created_at not null default now()` | Same. |
| `institution_id uuid` (0007 ADD) | — | **Do not add.** EXT → `user_geo(user_id pk, state_code, institution_id)` (Q12). |
| `avatar_url text` (0011 ADD) | `avatar_url text` | Already exists. |
| `state_code text → regions` (0011 ADD) | — | EXT → `user_geo`. |
| — | `phone` | Used for student/educator phone (the archive kept phone on `students`/`educators`). |

Role values in the lead's schema: `student`, `educator`, `head_teacher`,
`regional_head`, `admin`, `super_admin`, `parent`. The archive knew only
`admin`, `educator`, `student` and `regional_head`.

### 2.2 `test_series` (CONFLICT)

| Archived column | Lead column | Difference / action |
|---|---|---|
| `id` | `id` | Same. |
| — | `course_id uuid NOT NULL → courses` | **Blocker.** Every archived insert path omits it: wizard, `save_wizard_draft`, `create_assignments` (`seriesMode:'new'`), `assign_request`, `save_ai_job_to_series`, `duplicate_test_series`, and React `createSeries` (Q2). |
| `title` (CHECK 3–150 chars) | `title not null` | Same; don't add the CHECK. |
| `about` | `description` | Rename in mapping. |
| — | `instructions` | Series-level instructions (the archive had them per test only). |
| `status series_status` (draft/scheduled/published/archived) | `is_published bool`, `is_active bool` | **Shape differs.** Reads derive it: `archived` = `not is_active`; `draft` = `not is_published`; `scheduled` = `is_published and available_from > now()`; otherwise `published`. Writes set the booleans. React `createSeries`/`updateSeries` write `status` directly (Q6). |
| `start_date date`, `end_date date` | `available_from timestamptz`, `available_until timestamptz` | Type differs (date vs timestamptz). Map with `::date` / `at time zone 'Asia/Kolkata'`. |
| `availability_mode` | — | Derive: `window` if `available_until` is not null, else `always`. |
| `go_live_mode`, `go_live_at` | `available_from` | `go_live_at` ≈ `available_from` when publishing on a schedule. |
| `published_at` | — | EXT. |
| `subject_id → subjects` | — (through `course_id → courses.category_id`) | Derive the subject from the course's category (Q11). React `createSeries` writes `subject_id` directly (Q6). |
| `level` (Beginner/Intermediate/Advanced) | — (`courses.level` beginner/intermediate/advanced/all_levels) | Read from the course; case differs. |
| `languages text[]` | — (`courses.language text`) | Read from the course or EXT. |
| `grade` | — (`courses.target_grades[]`) | Read from the course or EXT. |
| `pricing`, `price_inr`, `is_free` (generated) | — (`courses.price`, `courses.currency`) | Is a series priced separately from its course? (Q2). EXT if yes. |
| `code` (`TS-1001`), `who_for`, `audience`, `syllabus`, `series_type`, `start_method`, `exam`, `monthly_limit`, `access_days`, `late_allowed`, `late_grace_minutes`, `build_deadline`, `cover_path`, `wizard_state`, `created_by`, `deleted_at` | — | No lead equivalent. **EXT → `test_series_admin(series_id pk → test_series.id, …)`**. If Option A (Q6) is chosen, these become ADDs on `test_series` instead. |
| `created_at`, `updated_at` | `created_at`, `updated_at` | Same. The lead's DB presumably maintains `updated_at` itself; don't add a trigger. |

Constraints that differ: the lead requires `course_id`. The archive had
`chk_paid_price`, `chk_window`, `chk_golive` and `chk_late`, which move to
`test_series_admin` or into RPC validation.

### 2.3 `institutions` (CONFLICT, extended in place)

| Archived column | Lead column | Action |
|---|---|---|
| `id`, `name`, `is_active`, `created_at`, `updated_at` | same | Same. |
| `state_code text not null → regions(code)` | `state text` (state *name*, nullable) | **ADD `state_code text references regions(code)`** (nullable). Backfill: `update institutions i set state_code = r.code from regions r where lower(r.name) = lower(btrim(i.state)) and i.state_code is null`. Unmatched rows stay null and are excluded from regional analytics. |
| `city text not null` | `city text` (nullable) | Don't add NOT NULL. |
| — | `type` (NOT NULL CHECK), `description`, `address`, `country`, `pincode`, `phone`, `email`, `website`, `logo_url`, `created_by` | Available for an Institution Management page (§5). |

### 2.4 `notifications` (CONFLICT) and `notification_recipients` (MAPS_TO)

The archived `notifications` table is an admin **campaign**. The lead's
`notifications` table is one **inbox row per user**. The plan below renames the
archived objects and fans each campaign out into the lead's inbox.

| Archived object | Becomes |
|---|---|
| `notifications` (campaign) | **NEW `notification_campaigns`** (all archived columns, enums → `text` + `CHECK`). |
| `notification_events` | NEW `notification_campaign_events`. |
| `notification_recipients` | Split: the **inbox part → the lead's `notifications`**; the **delivery part → NEW `notification_recipients`**. That name is free in the lead's DB, but its FK now targets `notification_campaigns`. |

Inbox fan-out (one lead `notifications` row per recipient, written by
`_publish_notification` → `adm_publish_campaign`):

| Lead `notifications` column | Value |
|---|---|
| `user_id` | recipient |
| `category` (16-value CHECK) | Archived `system`→`system`, `announcement`→`announcement`. `policy` and `alert` have no lead value; proposed `system` (Q13). |
| `title`, `body`, `action_url` | from the campaign |
| `reference_type` / `reference_id` | `'notification_campaign'` / campaign id |
| `is_read`, `read_at` | defaults; this is now the "Opened" source |
| `created_at` | = archived `delivered_at` |

Archived `notification_recipients` columns:
- `notification_id`, `user_id`, `email_status`, `email_sent_at`, `email_error`,
  `delivery_status` and `delivered_at` stay in the new delivery table.
- `in_app` and `read_at` are dropped; the lead's `is_read` / `read_at` replace
  them.
- `opened_count` is computed in `v_notifications_list` as a count over the
  lead's `notifications`, not a trigger on the lead's table.

Contract detail: `NotificationsPanel.jsx` calls `mark_notification_read(id)`
with the **campaign** id taken from `list_notifications`. The new body must be
`update notifications set is_read = true, read_at = now() where user_id = auth.uid() and reference_type = 'notification_campaign' and reference_id = p_id`.

### 2.5 `callback_requests` (CONFLICT, extended in place)

| Archived column | Lead column | Action |
|---|---|---|
| `id`, `name not null`, `email`, `created_at` | same | Same. |
| `status callback_status` (new/contacted/closed) | `status text CHECK (new, contacted, closed)` | **Same values**; the type differs only. Keep `text`. |
| `source callback_source` (4 values) | `source text` (free) | Keep `text`. The view maps unknown values to the label "Other". |
| `phone text NOT NULL CHECK E.164` | `phone text` (nullable, unchecked) | Don't add NOT NULL/CHECK. `submit_callback_request` still normalises on insert. |
| `message text NOT NULL CHECK 3–1000` | `message text` (nullable) | Don't add the constraint. |
| `phone_digits` (generated stored) | — | **Do not add** (a stored generated column rewrites the table). Compute in `v_callback_requests`. |
| `code` (`CB-1001`) | — | **ADD `code text`** nullable; backfill `'CB-' \|\| nextval(...)` ordered by `created_at`; then `set default`, then a unique index. |
| `organization`, `assigned_to → profiles`, `contacted_at`, `contacted_by → profiles`, `closed_at`, `closed_by → profiles`, `submitted_from`, `ip_hash`, `user_agent`, `updated_at` | — | **ADD** each, nullable (`updated_at` with `default now()`). |

Note: the lead's site may already insert into `callback_requests` directly.
Both paths can coexist; the new columns are all nullable.

### 2.6 `subjects` → `categories` (MAPS_TO, pending Q11)

| Archived | Lead | Note |
|---|---|---|
| `id`, `name` (unique on `lower(name)`) | `id`, `name` (unique) | |
| — | `slug NOT NULL unique` | `upsert_test_series_full` / `create_assignments` insert new subjects, so the RPC must generate a slug. |
| `icon_key` | `icon_url` | Different meaning (key vs URL). |
| `is_custom`, `created_by` | — | EXT or drop. |
| — | `parent_id`, `sort_order`, `is_active` | |

React `testSeriesApi.get` embeds `subjects(name)` and `createSeries` reads
`from("subjects")`. A view `subjects` over `categories` keeps those calls
working, but `test_series` has no `subject_id` FK for PostgREST to embed
through (Q6).

### 2.7 `tests` → `quizzes`

| Archived | Lead | Note |
|---|---|---|
| `id` | `id` | |
| `series_id → test_series` | `series_id → test_series` (nullable) | |
| — | `course_id NOT NULL` | Fill from `test_series.course_id`. |
| `position` | `series_sort_order` | |
| `title` | `title` | |
| `instructions` | `description` | |
| `duration_minutes` (default 60) | `time_limit_mins` (nullable) | |
| `attempt_limit` (default 1) | `max_attempts` (default 3) | Defaults differ. |
| `passing_percent` (default 40) | `passing_score` (default 60.0) | Presumably a percentage; confirm (Q3). |
| `shuffle_questions` | `shuffle_questions` | |
| `total_marks` (maintained by trigger) | — | Compute as `sum(quiz_questions.points)`. |
| `passing_marks`, `shuffle_options`, `window_mode`, `open_at`, `close_at`, `scheduled_at`, `planned_questions`, `topics` | — | EXT → `quiz_admin(quiz_id pk)`. |
| `status test_status` (draft/published) | — | No per-quiz status in the lead's schema. EXT, or derive from the series' `is_published` (Q3). |
| — | `lesson_id`, `is_required`, `show_answers_after`, `is_proctored` | Lead-only; leave at defaults. |

### 2.8 `questions` → `quiz_questions`

| Archived | Lead | Note |
|---|---|---|
| `id`, `explanation` | same | |
| `test_id` | `quiz_id` | |
| `position` | `sort_order` | |
| `body` | `question_text` | |
| `marks` (default 4) | `points` (default 1) | |
| `type question_type` (mcq, multi_select, true_false, short_answer, long_answer) | `question_type text CHECK` (multiple_choice, true_false, fill_in_blank, short_answer) | **Values differ.** `mcq`→`multiple_choice`; `true_false`, `short_answer` same. `multi_select`→`multiple_choice` + >1 correct option (only if the lead's scorer supports that). `long_answer` and `fill_in_blank` have no counterpart (Q3). |
| `is_objective` (generated) | — | Compute. |
| `section_id`, `image_path`, `negative_marks`, `difficulty`, `subject`, `topic`, `answer_instructions`, `source`, `ai_job_id`, `updated_at` | — | EXT → `quiz_question_admin(question_id pk)`. |

### 2.9 `question_options` → `quiz_question_options`

| Archived | Lead | Note |
|---|---|---|
| `id`, `question_id`, `is_correct` | same | |
| `position` | `sort_order` | |
| `label` | `option_text` | |
| `option_key` (A–F) | — | Derive as `chr(64 + sort_order)` when `sort_order` is 1-based (Q3). |
| `image_path` | — | EXT or drop. |

### 2.10 `test_attempts` → `quiz_attempts`

| Archived | Lead | Note |
|---|---|---|
| `id`, `student_id`, `score`, `max_score`, `started_at`, `submitted_at` | same | |
| `test_id` | `quiz_id` | |
| `series_id` | — | Join `quizzes.series_id`. |
| `attempt_no` | `attempt_number` | |
| `percentage` (generated) | `percentage` (plain column) | The lead writes it. |
| `status` (in_progress, submitted, expired) | `status` (in_progress, submitted, timed_out, abandoned) | `expired` ≈ `timed_out`. Analytics count `submitted` (decide on `timed_out`). |
| `is_late` | — | Drop. |
| — | `passed`, `time_taken_secs` | Use `time_taken_secs/60` for "avg time" instead of `submitted_at - started_at`. |

### 2.11 `attempt_answers` → `quiz_answers`

| Archived | Lead | Note |
|---|---|---|
| `attempt_id`, `question_id`, `is_correct` | same | |
| `selected_option_ids uuid[]` | `selected_option_ids ARRAY` | Element type not shown in the dump. |
| `text_answer` | `answer_text` | |
| `marks_awarded` | `points_earned` | |
| `graded_by`, `feedback` | — | Only needed for manual grading of subjective answers. EXT if the admin portal grades. |

### 2.12 `series_enrollments` → `enrollments` (through the course)

The archive has an explicit series enrolment. In the lead's model, a student
enrolled in course C can presumably take every series with `course_id = C`
(Q3). Proposed compatibility **view** `series_enrollments`:

| View column | Source |
|---|---|
| `id` | `enrollments.id` (one row per enrollment × series of that course) |
| `series_id` | `test_series.id` (join on `course_id`) |
| `student_id` | `enrollments.student_id` |
| `user_id` | `enrollments.student_id`, **alias**. `studentsApi.detail` filters `.eq("user_id", id)`, and the archived reports/audience/refund SQL also use `user_id`. That column never existed in the archived table, so these calls were already broken. |
| `enrolled_at` / `created_at` | `enrollments.enrolled_at` (`created_at` is an alias, for the same reason) |
| `expires_at` | `enrollments.expiry_date` |
| `revoked_at` | `case when not is_active then …` (no timestamp in the lead's schema; Q3) |
| `amount_paid` | Blocked on Q1 (`order_id` → ?) |

Columns the archive ADDs to `series_enrollments` (`revoked_at`,
`revoke_reason`) are not added. A refund deactivates the course enrollment
instead (`is_active = false`), if the lead agrees.

### 2.13 `students` → `student_profiles` + `profiles` + NEW `students` side table

`studentsApi.js` reads and updates a table literally named `students`
(`count`, `.eq("status", …)`, `.update({status, blocked_reason})`). The name is
free in the lead's DB, so a **NEW** table `students` holds admin-only state and
React does not change.

| Archived column | Lead source | Action |
|---|---|---|
| `id → profiles` | `student_profiles.user_id` / `profiles.id` | NEW `students.id pk → profiles(id)`. |
| `grade` (CHECK 'Grade 6'…'Grade 12') | `student_profiles.grade` (free text) | Read from the lead's table. Don't add the CHECK. The UI grade filter values may not match the lead's data (Q12). |
| `phone` | `profiles.phone` | Read. |
| `city` | `profiles.location` | Read. |
| `registered_at` | `profiles.created_at` | Read. |
| `student_code`, `last_active_at`, `status` (active/blocked), `blocked_reason`, `blocked_at`, `blocked_by`, `onboarded_via`, `acquisition_id` | — | Columns of NEW `students`. |
| `account_status` (duplicate of `status`, synced by the 0013 trigger) | — | **Drop.** Rewrite the RPCs that read `account_status` (`_resolve_audience`, `_report_students`, `_is_account_blocked`) to read `status`. |

Rows must exist for every `profiles.role = 'student'`. Backfill once; new
signups need either a trigger on the lead's `profiles`/`student_profiles` or
lazy creation (Q9).

### 2.14 `educators` → `educator_profiles` + `profiles` + NEW `educator_admin_state`

React never touches `educators` directly, so the side table can take a clear
name.

| Archived column | Lead source | Action |
|---|---|---|
| `id` | `educator_profiles.user_id` | |
| `phone` | `educator_profiles.phone` (NOT NULL) | |
| `qualification` | `educator_profiles.qualifications` | |
| `years_experience` | `educator_profiles.experience_years` | |
| `subjects text[]` | `educator_profiles.subjects ARRAY` | |
| `verification_status` enum (pending, under_review, verified, rejected) | `educator_profiles.verification_status text default 'pending'`, **no CHECK** | Write here; agree on the values (Q8). Also set `verified_at`, `verified_by`, and `rejected_reason` on rejection. |
| `status_reason` | `educator_profiles.rejected_reason` (verification only) | Account-status reasons go to the side table. |
| `joined_at`, `submitted_at` | `educator_profiles.created_at` | |
| — | `full_name`, `location` (NOT NULL), `bio`, `photo_url`, `languages`, `digital_id_url`, `rating_avg`, `total_students`, `total_courses` | `register_educator` must supply `phone` and `location` (NOT NULL); bulk-invite rows often lack location (Q9). |
| `educator_code`, `educator_no`, `gender`, `dob`, `account_status` (active/inactive/suspended), `suspended_at`, `last_active_at`, `onboarded_via` | — | NEW `educator_admin_state(user_id pk → profiles)`. |

### 2.15 `educator_documents` → `educator_verification_docs`

`educatorsApi.updateDocument` writes `educator_documents` directly:
`update({status, note, reviewed_by, reviewed_at}).eq("id").eq("educator_id")`.
The proposal is a compatibility **view** `educator_documents` with an
`INSTEAD OF UPDATE` trigger.

| Archived | Lead | Action |
|---|---|---|
| `id`, `educator_id`, `doc_type` | same | The lead's `doc_type` has a 6-value CHECK; the archive's was free text. |
| `file_path` | `doc_url` | Storage path vs URL (Q17). |
| `status` (pending, approved, rejected) | `is_verified bool` (null/true/false) | Map null↔pending, true↔approved, false↔rejected. |
| `reviewed_at` | `verified_at` | |
| `note` | — | **ADD `review_note text`.** |
| `reviewed_by` | — | **ADD `verified_by uuid references profiles(id)`.** |
| `uploaded_at` | `created_at` | |
| — | `doc_name` | Use as `fileName` (the archive derived it from the path). |

### 2.16 `educator_ratings` → `educator_profiles.rating_avg` / `course_reviews`

No table is needed. `rating` = `educator_profiles.rating_avg`.
`ratings_count` = `count(course_reviews r join courses c on c.id = r.course_id where c.educator_id = e.user_id and r.is_visible)`.
`students_count` = `educator_profiles.total_students`. That last one replaces
the archive's count over series enrolments.

### 2.17 `educator_status_history`, `auth_events`, `export_log` → `audit_logs`

The lead's `audit_logs` has: `id`, `actor_id NOT NULL`, `actor_role NOT NULL`,
`action`, `target_type`, `target_id uuid`, `before_state`, `after_state`,
`reason`, `ip_address`, `user_agent`, `created_at`.

| Archived | Mapping |
|---|---|
| `educator_status_history.kind` (account/verification) | `action = 'educator.account_status'` / `'educator.verification'`; `target_type = 'educator'` |
| `.from_value` / `.to_value` | `before_state = {"value": …}` / `after_state = {"value": …}` |
| `.reason`, `.by_admin`, `.at` | `reason`, `actor_id` (+ `actor_role` from `profiles`), `created_at` |
| `auth_events.user_id`, `.role` | `actor_id`, `actor_role` (both available from `auth.uid()`, so NOT NULL is satisfied) |
| `.event_type` | `action = 'auth.' \|\| event_type` |
| `.session_id`, `.meta` | `target_type = 'auth_session'`, `target_id = session_id`, `after_state = meta` |
| `.ip_hash`, `.user_agent` | `ip_address` (holds a hash, not an IP), `user_agent` |
| `session_revoked` | Better semantics than the archive: actor = the admin, `target_type = 'user'`, `target_id` = the revoked user. |
| `export_log.admin_id`, `.page`, `.filters`, `.row_count` | `actor_id`, `action = 'export'`, `target_type = page`, `after_state = {filters, row_count}` |

Contract: `get_educator_detail().history[]` must still return
`{kind, from_value, to_value, reason, by_admin, at}`, because `educatorsApi.js`
reads `entry.kind` and `entry.to_value`. `list_auth_events` must still return
`event_type` without the `auth.` prefix.

### 2.18 `app_settings` → `platform_settings`

| Archived | Lead | Note |
|---|---|---|
| `key`, `value jsonb`, `updated_at` | same | |
| — | `description`, `updated_by` | |

Seed with `insert … ('dashboard_quote', …) on conflict (key) do nothing`. The
lead keeps their value if they already have one.

---

## 3. Helper functions

### 3.1 What the dump shows

`existing_Schema.sql` contains **no function definitions**. `is_admin`,
`owns_course`, `is_enrolled` and `manages_org_unit` exist according to the
lead, but their bodies, signatures, `SECURITY DEFINER`/`INVOKER` mode and
accepted roles **cannot be read from this file**. Before any migration is
written, the lead needs to run these (read-only) and send the output:

```sql
-- every public function, with signature and body
select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
order by 1, 2;

-- every policy and the RLS switch per table
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by 1, 2;
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;

-- triggers (incl. the signup trigger on auth.users)
select tgrelid::regclass, tgname, pg_get_triggerdef(oid)
from pg_trigger where not tgisinternal
  and (tgrelid::regclass::text like 'public.%' or tgrelid = 'auth.users'::regclass);

-- enum types, views, storage buckets, extensions, migration history
select typname from pg_type t join pg_namespace n on n.oid = t.typnamespace
 where n.nspname = 'public' and t.typtype = 'e';
select table_name from information_schema.views where table_schema = 'public';
select id, public from storage.buckets;
select extname from pg_extension;
select version, name from supabase_migrations.schema_migrations order by version;
```

### 3.2 Which roles admin RPCs should accept

| Role (lead's CHECK) | Archived `is_admin()` | Proposed for admin RPCs | Note |
|---|---|---|---|
| `admin` | ✅ | ✅ | |
| `super_admin` | ❌ (`role = 'admin'` only) | ✅ | Unless the lead says otherwise. |
| `regional_head` | ❌ | ❌ (RH portal only, scoped through `manages_org_unit` / `manager_scopes`) | |
| `head_teacher`, `educator`, `student`, `parent` | ❌ | ❌ | |

Archived definitions (both would be `create or replace`, i.e. they would
**overwrite** the lead's):

```sql
-- 0001
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;
-- 0011 (same, with role::text)
$$ select exists (select 1 from profiles where id = auth.uid() and role::text = 'admin') $$;
```

Proposed rule:
- If the lead's `is_admin()` returns true for both `admin` and `super_admin`,
  call it directly in every admin RPC.
- If it doesn't, create a **new** function
  `adm_is_platform_admin()` (`role in ('admin','super_admin')`) and use that
  instead.
- Never `create or replace is_admin`.

**Frontend gap (not fixable in SQL):** `src/utils/roles.js` maps only `admin`,
`educator`, `student` and `regional_head`. For a `super_admin`, `mapDbRole`
returns `null`, so `AuthContext` sets `user = null` and `AdminLayout` redirects
to `/admin/login`. `AdminLayout` also requires `user.role === "admin"`, and the
Edge Function `requireAdmin` checks `role !== "admin"`. So a super_admin cannot
use the admin portal even if every RPC accepts them (Q7).

### 3.3 Archived functions that clash, or are likely to, by name

| Archived function | Clash | Risk if ported as written |
|---|---|---|
| `is_admin()` (0001, 0011) | **Known to exist** (lead) | Replaces the lead's body. If the lead's accepts super_admin, super_admins lose access to everything the lead's RLS gates with it. |
| `is_enrolled(p_series uuid)` (0002) | **Known to exist** (lead) | If the lead's is `is_enrolled(uuid)` (likely for a course id), `create or replace` with the same argument types **silently replaces course-enrolment semantics with series semantics** for every lead policy that calls it. If the signature differs, it creates an ambiguous overload. Rename to `adm_is_series_enrolled`. |
| `handle_new_user()` + trigger `on_auth_user_created` (0012) | Very likely (Supabase template names) | Replaces the lead's signup logic, and inserts into `students`. |
| `set_updated_at()` (0001) | Likely (generic name) | Replaces the lead's trigger function used by their `updated_at` columns. Use `adm_touch_updated_at()`. |
| `mark_notification_read(uuid)` | Defined **twice in the archive** (0003 for `assignment_notifications`, 0008 for recipients; the later one wins) | Keep only the 0008 contract (§2.4). Rename the 0003 one `adm_mark_assignment_notification_read`. |
| `owns_course`, `manages_org_unit` | Not defined in the archive | No clash. Reuse later for the RH portal. |
| Generic internals: `norm_text`, `_initials`, `resolve_date_range`, `is_account_active`, `is_assigned_educator`, `gen_series_code`, `gen_assignment_code`, `sync_test_marks`, `enforce_attempt_limit`, `check_test_window`, `_count_if_exists`, `_normalize_phone`, `_phone_display`, `_current_session_id`, `_is_account_blocked`, `_revoke_sessions`, `trg_revoke_on_block`, `sync_educator_auth_ban`, `sync_student_block_status`, `prevent_*_delete`, `sync_discount_used_count`, `nrec_after_*`, `set_payment_institution`, `complete_assignment_on_publish` | Unknown until the §3.1 query is run | React never calls these by name. **Rename all of them with an `adm_` prefix.** That removes the risk entirely. |

**No existing function is redefined anywhere in this plan.** Admin RPCs whose
names React calls (§4) are created only after the `0100` preflight proves the
name is absent.

---

## 4. Every admin RPC, view and table used by the frontend

Status legend:
- ✅ supported by lead tables alone;
- ➕ supported once the NEW objects in §7 exist (no lead decision needed);
- ⚠️ needs a lead decision (Q#);
- ⛔ no backing data in the lead's DB (blocked).

When a source is blocked, the RPC must still exist and return the same JSON
keys with `0` / `null` / `[]`, so the pages render.

Lead tables are in **bold**.

### 4.1 Direct table and view access from React (names are contract)

| Caller | Object · operation | Status | Plan |
|---|---|---|---|
| `testSeriesApi.get` | `test_series` select `*, subjects(name), tests(*, questions(*, question_options(*)), test_sections(*))`, `.is("deleted_at", null)` | ⚠️ Q6 | Needs `deleted_at` + `subject_id` FK on **test_series**, plus PostgREST-embeddable relations named `tests` / `questions` / `question_options`. |
| `testSeriesApi.createSeries` / `updateSeries` / `deleteSeries` | `test_series` insert/update (`title, about, subject_id, audience, pricing, price_inr, start_date, end_date, status, deleted_at`) | ⚠️ Q2, Q6 | Inserts fail on `course_id NOT NULL` and on missing columns. |
| `testSeriesApi.*Test` / `*Section` / `*Question` / `*Option` | `tests`, `test_sections`, `questions`, `question_options` insert/update/delete | ⚠️ Q6 | Option A: views of those names over **quizzes / quiz_questions / quiz_question_options** with `INSTEAD OF` triggers (writing EXT tables too). Option B: move these calls behind RPCs (service file only). |
| `testSeriesApi.createSeries` | `subjects` select by name | ⚠️ Q11 | View `subjects` over **categories**, or NEW table. |
| `assignmentsApi.series` | `test_series` select `id, title`, `.is("deleted_at", null)` | ⚠️ Q6 | Needs `deleted_at` on **test_series**, or an RPC. |
| `assignmentsApi.requests` | `v_series_requests` | ➕ | |
| `assignmentsApi.eligibleEducators` | `v_eligible_educators` (`id, name, subjects`) | ➕ | Over **educator_profiles** + `educator_admin_state`. |
| `studentsApi.stats` / `list` / `setStatus` | `students` count/update; `v_students_list`; `student_block_history` insert | ➕ | NEW `students` + view over **profiles**, **student_profiles**. |
| `studentsApi.detail` | `series_enrollments` select `series_id, enrolled_at` `.eq("user_id")`; `test_series` select `id, title` | ➕ | Compatibility view §2.12 (this fixes an existing bug). |
| `educatorsApi.updateDocument` | `educator_documents` update | ➕ | View §2.15 + 2 ADDs on **educator_verification_docs**. |
| `educatorsApi.signedDocumentUrl` | storage `educator-documents` | ⚠️ Q17 | |
| `securityApi.sessions` | `user_sessions` select | ➕ | NEW table, same name. |
| `AuthContext` | **profiles** select `id, full_name, email, role` | ✅ | Depends on the lead's RLS allowing self-read (§6). |

### 4.2 RPCs by page

**Login / session / shell** (`AdminLogin.jsx`, `AuthContext.jsx`, `adminApi.js`)

| RPC | Tables | Status |
|---|---|---|
| `get_admin_me` | **profiles** | ✅ (role per §3.2) |
| `record_login` | **profiles**, `user_sessions`, **audit_logs**, `students`, `educator_admin_state` | ➕ |
| `record_logout` (also called by students/educators through `AuthContext.logout`) | `user_sessions`, **audit_logs** | ➕ Must work for *every* role; today `logout()` throws if this RPC errors. |
| `touch_session` | `user_sessions` | ➕ |
| `get_admin_nav` | `admin_nav_items`, **educator_profiles**, `test_assignments`, `refund_requests`, **callback_requests**, **moderation_reports** | ➕ Fix archived bugs: callbacks counted `status='pending'` (the value is `new`), and moderation used the non-existent `content_reports`. Refund count is 0 until Q1. |
| `global_search` | **profiles**, **test_series** | ✅ |
| `list_my_notes`, `add_admin_note`, `toggle_admin_note`, `update_admin_note`, `delete_admin_note`, `clear_done_notes` | `admin_notes` | ➕ |

**Dashboard** (`get_admin_dashboard` composes these)

| RPC | Tables | Status |
|---|---|---|
| `get_dashboard_header` | **profiles**, **platform_settings** | ✅ |
| `get_dashboard_stats` | **profiles** (role), **test_series** (`is_published`) | ✅ |
| `get_dashboard_revenue` | `payments` | ⛔ Q1 |
| `get_pending_educator_verifications` | **educator_profiles**, **profiles** | ✅ (Q8 values) |
| `get_series_approvals` | `test_assignments`, **test_series**, **profiles** | ➕ Fix archived bug: it reads `a.due_date`, but the column is `deadline`. |
| `get_top_series` | **test_series**, **quizzes**, **quiz_attempts** | ✅ |
| `get_students_by_region` | **profiles**, `user_geo`, `regions`, **institutions** | ⚠️ Q12 (no student→state link exists) |

**Test series** (`testSeriesApi.js`)

| RPC | Tables | Status |
|---|---|---|
| `get_test_series_stats`, `list_test_series` | **test_series**, `test_series_admin`, **courses**, **categories**, **quizzes**, **enrollments**, **quiz_attempts** | ⚠️ Q2/Q3 (pricing, audience, code and timeline come from EXT or course) |
| `upsert_test_series_full`, `save_wizard_draft`, `discard_wizard_draft`, `duplicate_test_series` | the above + `test_sections`, `quiz_admin`, **quiz_questions**, `quiz_question_admin`, **quiz_question_options** | ⚠️ Q2 (`course_id`), Q3 (type mapping) |
| `adm_publish_test_series` (renamed: the lead already owns `publish_test_series(uuid, boolean)`) | **test_series** (`is_published`), **quizzes**, **quiz_questions**, **quiz_question_options** | ⚠️ Q2. Uses the lead's publish checks and messages; returns `{series_id, is_published, tests, status}`. |
| `series_name_exists` | **test_series** | ✅ |

**Assign educators** (`assignmentsApi.js`)

| RPC | Tables | Status |
|---|---|---|
| `list_assignments`, `get_assignment_detail` | `test_assignments`, `assignment_*`, **test_series**, **profiles** | ➕ |
| `create_assignments` | + **test_series** insert when `seriesMode = 'new'`; **categories** | ⚠️ Q2 for the "new series" branch only |
| `update_assignment_requirements`, `reassign_educator`, `extend_deadline`, `cancel_assignment`, `start_review`, `review_submission` | `test_assignments`, `assignment_*`, **educator_profiles** | ➕ |
| `assign_request`, `reject_request` | `series_requests`, `test_assignments` (+ **test_series** insert) | ➕ / ⚠️ Q2 |

**Tracker** (`trackerApi.js`)

| RPC | Tables | Status |
|---|---|---|
| `get_tracker_stats`, `list_series_tracker`, `get_series_tracker_detail` | `test_assignments`, **test_series**, **categories**, **profiles** | ➕ |
| `list_repeated_matches`, `get_match_counts`, `mark_match_reviewed`, `dismiss_match`, `flag_match_confirmed` | `question_similarity_matches`, **quiz_questions**, **quizzes**, **test_series** | ➕ |
| `detect_repeated_questions` | + trigram index on **quiz_questions** | ➕ (index built concurrently, §7) |

**Test performance analytics** (`performanceApi.js`)

| RPC | Tables | Status |
|---|---|---|
| `get_tpa_filter_options`, `get_tpa_summary`, `get_tpa_subject_scores`, `get_tpa_series_engagement`, `get_tpa_test_comparison`, `get_tpa_leaderboard`, `export_tpa_rows` | **test_series**, **quizzes**, **quiz_attempts**, **profiles**, **categories**, `test_assignments` | ➕ "Published tests" = quizzes of `is_published` series (no per-quiz status, Q3). |
| `log_export` | **audit_logs** | ✅ (insert through a definer RPC) |

**Students** (`studentsApi.js`): direct access only, see §4.1. ➕

**Educators** (`educatorsApi.js`, Edge `create-educator-invites`)

| RPC | Tables | Status |
|---|---|---|
| `list_educators`, `get_educator_stats`, `get_educator_detail` | **educator_profiles**, **profiles**, `educator_admin_state`, **educator_verification_docs**, **course_reviews**, **courses**, **audit_logs** | ➕ |
| `set_educator_verification(p_id, p_decision, p_note)` | **educator_profiles** (+ `verified_at`/`verified_by`/`rejected_reason`), **audit_logs** | ⚠️ Q8 (value set). `p_decision` becomes `text`. |
| `set_educator_account_status(p_id, p_status, p_reason)` → `int` | `educator_admin_state`, **audit_logs**, `test_assignments` | ➕ (the auth ban moves to an Edge Function, Q10) |
| `delete_educator(p_id)` | archived: `delete from profiles` | ⚠️ **Must not hard-delete** a lead `profiles` row (FKs from courses, enrollments, etc.). Proposed: soft-delete (`account_status = 'inactive'`). The return stays `void`. |
| `create_educator_invites(p_rows)`, `register_educator(p_user_id, p)` (Edge only) | `educator_invites`, **profiles** insert, **educator_profiles** insert | ⚠️ Q9: the lead's signup trigger may already insert `profiles`; `educator_profiles.phone`/`location` are NOT NULL. |

**Discounts** (`discountsApi.js`)

| RPC | Tables | Status |
|---|---|---|
| `list_discounts`, `get_discount_stats`, `get_discount`, `create_discount`, `update_discount`, `set_discount_status`, `list_discount_history` | `discounts`, `discount_series`, `discount_events`, `discount_redemptions`, **test_series**, **profiles** | ➕ (Q15 scope) |
| `get_discount_analytics`, `export_discount_redemptions` | `discount_redemptions` | ➕ (empty until Q1) |

**Transactions** (`transactionsApi.js`, Edge `payment-webhook`)

| RPC | Tables | Status |
|---|---|---|
| `list_transactions`, `get_transaction_stats`, `get_transaction_filter_options`, `get_transaction`, `export_transactions`, `mark_payment_paid`, `mark_payment_refunded` | `payments`, `payment_events`, `educator_txn_counters`, `discount_redemptions`, **profiles**, **test_series** | ⛔ Q1. Also: `payment-webhook` passes `p_method: "online"`, which is not in the archived `payment_method` set. |

**Refunds / payment oversight** (`refundsApi.js`, Edge `process-refund`)

| RPC | Tables | Status |
|---|---|---|
| `list_pending_refunds`, `list_refund_history`, `get_refund_stats`, `export_refunds`, `request_refund`, `approve_refund`, `reject_refund`, `record_refund_gateway_result` | `refund_*`, `payments`, **enrollments** (deactivate) | ⛔ Q1. Archived `approve_refund` updates `series_enrollments.user_id` / `revoked_at`, which don't exist; rewrite against **enrollments**. |

**Financial analytics** (`financialApi.js`)

| RPC | Tables | Status |
|---|---|---|
| `get_financial_summary`, `get_revenue_trend`, `get_financial_analytics` | `payments`, `refund_requests`, `payouts` | ⛔ Q1 |
| `get_financial_range_options` | — | ✅ |

**Regional analytics** (`regionalApi.js`)

| RPC | Tables | Status |
|---|---|---|
| `get_regional_summary`, `get_regional_trend`, `get_revenue_by_region`, `list_region_comparison` | `payments`, **institutions** (`state_code`), `regions`, `user_geo` | ⛔ Q1, ⚠️ Q12 |
| `get_regional_filter_options` | `regions`, **institutions** | ➕ |

**Reports builder** (`reportsApi.js`)

| RPC | Tables | Status |
|---|---|---|
| `get_report_builder_options` | `report_types` | ➕ |
| `get_report_filter_options` | **test_series**, **educator_profiles**, **profiles**, **categories**, **student_profiles** | ✅ |
| `generate_report`, `get_report_run`, `export_report_csv` | `report_runs` + the four `_report_*` builders over **enrollments**, **test_series**, **courses**, **educator_profiles**, `educator_admin_state`, `students`, **student_profiles**, **profiles**, `test_assignments`, `payments` | ➕ Revenue/amount/earnings columns are 0 until Q1. The archived builders read `series_enrollments.user_id` / `created_at`, which never existed; rewrite. |

**Publish notifications + admin bell** (`notificationsApi.js`, `NotificationsPanel.jsx`, `AdminTopbar.jsx`, Edge `send-notification-emails`)

| RPC | Tables | Status |
|---|---|---|
| `get_notification_stats`, `get_notification_filter_options`, `list_notifications`, `get_notification`, `preview_notification`, `estimate_audience` | `notification_campaigns`, `notification_recipients`, **notifications** (opened count), **profiles**, **enrollments** | ➕ |
| `create_notification`, `publish_notification`, `archive_notification`, `delete_draft_notification` | + inserts into **notifications** (fan-out) | ➕ (Q13 category map) |
| `mark_notification_read(p_id = campaign id)`, `mark_all_notifications_read`, `get_my_unread_notification_count` | **notifications** where `reference_type = 'notification_campaign'` | ➕ (§2.4) |
| Edge `send-notification-emails` | `notification_recipients` embed `notifications(title, body)` | ➕ **The Edge Function must change**: the embed target becomes `notification_campaigns`. Server code only, not React. |

**Callback requests** (`callbacksApi.js`; page `/admin/supporttickets`)

| RPC | Tables | Status |
|---|---|---|
| `get_callback_stats`, `get_callback_filter_options`, `list_callback_requests`, `get_callback_request`, `set_callback_status`, `add_callback_note`, `export_callback_report` | **callback_requests** (+ADDs), `callback_activity`, **profiles** | ✅/➕ |
| `submit_callback_request` (public form, anon) | **callback_requests** | ➕ (if the lead's site doesn't already insert directly) |

**Security center / audit logs** (`securityApi.js`, Edge `revoke-user-sessions`)

| RPC | Tables | Status |
|---|---|---|
| `list_auth_events` | **audit_logs** | ✅ (Q14) |
| `sign_out_other_devices`, `revoke_user_sessions` | `user_sessions`, **auth.sessions** (delete), **audit_logs** | ⚠️ Q10: deleting from `auth.sessions` in SQL is the archive's approach; the lead must agree. |

**Not called by React** (keep internal or drop): `get_regional_growth`,
`list_report_runs`, `save_ai_job_to_series` (the AI builder page is still on
mock data), `validate_coupon` / `redeem_coupon` / `reverse_redemption` (student
checkout plus Edge), `cancel_refund_request`, `retry_refund_gateway`,
`list_my_notifications`, `dispatch_due_notifications`, `record_email_results`,
`purge_*`, `release_scheduled_series`, `educator_*_assignment`,
`touch_educator_last_active`, `assign_callback`, `get_new_callback_count`.

Dead code to note: `adminApi.js` also exports `studentsApi` and `educatorsApi`.
Nothing imports them, and their parameter names (`p_educator_id`, `p_status`)
don't match the SQL. The real callers live in `educatorsApi.js` /
`studentsApi.js`.

---

## 5. Existing tables that back pages previously marked unsupported

| Lead table(s) | UI it can back | Page today | Notes |
|---|---|---|---|
| `audit_logs` | **Audit Logs** (`/admin/auditlogs`): a real, filterable admin action trail (actor, action, target, before/after diff, reason, IP, UA). Also educator status history and export log (§2.17). | `AuditLogs.jsx` currently shows auth events only, through `list_auth_events`. | The existing RPC contract is enough to show auth events. A full audit view needs a new RPC (e.g. `list_audit_logs`) and a UI change. |
| `support_tickets`, `support_ticket_replies` | **Support Tickets**: queue (category, priority, status, assignee), thread with internal notes (`is_internal`), attachments, `reference_type/id` link, resolve/close. | `/admin/supporttickets` (`SupportTickets.jsx`) currently renders **callback requests**. The nav item `callback_request` points there. | Decide whether this route shows tickets, callbacks, or two tabs. Needs new RPCs + UI. |
| `moderation_reports` | **Content Moderation**: report queue by `content_type` (course, lesson, review, message, discussion_post, profile, session), status workflow, `action_taken`, `review_note`. Actions can hide `course_reviews.is_visible` and `discussion_posts.is_removed`. | `ContentModeration.jsx` on `contentIssuesMock`. | Also feeds the `moderation` badge in `get_admin_nav`. |
| `courses` (`status` pending_review, `submitted_at`, `approved_by`, `approved_at`, `rejection_reason`) + `course_versions` | **Course Approval** (`/admin/courseapproval`): approve/return with feedback, version snapshot diff. | `CourseApproval.jsx` on `coursesMock`. | Not in your list, but it is fully supported by existing columns. |
| `platform_settings` | **Settings & Permissions**: platform switches, refund window, dashboard quote. | `SettingsPermissions.jsx` on `permissionsMock` / `certificatesMock`. | Per-admin *permissions* have no table; that part stays unsupported (or becomes role-based on `profiles.role`). |
| `cms_pages` | CMS editor for public pages (landing sections, `/terms`, `/privacy`): slug, jsonb content, publish. | No admin page yet. | `src/auth/pages/legal/*` are static today. |
| `org_units`, `institutions` | **Region / Branch Hierarchy** (tree of region → branch → department → class per institution) and **Institution Management** (CRUD over the full `institutions` row). | `RegionBranchHierarchy.jsx`, `InstitutionManagement.jsx` on `institutionsMock`. | `org_units.unit_type = 'region'` is the org hierarchy, separate from the `regions` (states) lookup used for revenue (Q16). |
| `staff_assignments` | Staff allocation / teacher workload inside the hierarchy page; **Management Dashboards** (headcount per unit, courses per unit through `courses.org_unit_id`). | `RegionBranchHierarchy.jsx`, `ManagementDashboards.jsx` on `staffAssignmentsMock`. | |
| `manager_scopes` | **Regional Heads**: which org units each `regional_head` manages (grant/revoke), plus the RH portal's own data scoping through `manages_org_unit`. | `RegionalHeads.jsx`, `RegionalHeadTeam/Activity/Invite.jsx` and the whole `/regionalhead` portal on mocks. | The ADMIN_BACKEND_TODO note "no regional_heads table" is answered here: RH = `profiles.role = 'regional_head'` + `manager_scopes`. |
| `educator_verification_docs` | **Educator Verification → Documents tab**: per-document approve/reject (§2.15). | `EducatorVerification.jsx` / `EducatorProfile.jsx` (mixed mock + `educatorsApi`). | Needs the two ADDs and the compatibility view. |
| `mfa_enforcement` | **Security Center**: require MFA per user (`is_required`), show enrolled/last verified; feeds the admin login MFA step. | `SecurityCenter.jsx` (sessions/events only). | Enforcement itself is Supabase Auth MFA (`aal2`); this table only records policy/state. |
| `teacher_change_requests` | Escalations-style queue (student asks to change educator; approve/reject). | `Escalations.jsx` on `regionalPortalMock`. | Possible match; confirm intent. |
| `data_requests`, `consent_records` | Privacy requests queue (export/deletion/correction) and consent audit. | No page. | Optional. |

---

## 6. Would the existing RLS block admin access from the browser?

**The dump does not include RLS state or policies**, so this cannot be answered
per table until the §3.1 queries are run. What *can* be stated is which admin
paths depend on the lead's RLS at all.

- **`SECURITY DEFINER` RPCs** (owner `postgres`) **bypass RLS**. For those, the
  lead's policies are irrelevant; only the `is_admin()` check inside the
  function matters. This covers almost every RPC in §4.2.
- **Direct PostgREST access and `security_invoker` views** **are subject to the
  lead's RLS** for the calling user. That's §4.1 plus the archived `v_*` views,
  which are all `security_invoker = true`.
- If a lead table has **RLS disabled**, admin access works, but so does access
  with the anon key. That is a security finding for the lead, not a blocker.
- If a lead table has **RLS enabled and no policy that admits admins**, every
  admin read or write through an invoker path returns empty rows or a 42501
  error.

| Lead table | Admin path(s) | Depends on lead RLS? | Needed if it does |
|---|---|---|---|
| `profiles` | `AuthContext` self-select; invoker views `v_students_list`, `v_eligible_educators`, `v_series_requests` | **Yes** | Self-read for every role (needed by the whole app). Admin read of all rows *or* make these views owner-rights with an `is_admin()` predicate (rule V, §7). |
| `student_profiles` | `v_students_list` | Yes (if invoker) | Same choice as above. |
| `educator_profiles` | `v_eligible_educators` | Yes (if invoker) | Same. |
| `educator_verification_docs` | `educator_documents` view + `INSTEAD OF UPDATE` | Yes | The trigger function can be `SECURITY DEFINER` with an `is_admin()` check, so no lead policy is needed. |
| `test_series` | `testSeriesApi` / `assignmentsApi` direct select/insert/update | **Yes** | Admin `select/insert/update` policy **on a lead table**: the lead must add it. Option B (RPCs) removes the need. |
| `quizzes`, `quiz_questions`, `quiz_question_options` | Option A views with `INSTEAD OF` triggers | Yes for selects | As above, or Option B. |
| `enrollments` | `series_enrollments` view (`studentsApi.detail`) | Yes (if invoker) | Rule V. |
| `categories` | `subjects` view | Probably public-read already | Check. |
| `courses`, `course_reviews`, `quiz_attempts`, `quiz_answers`, `institutions`, `org_units`, `audit_logs`, `platform_settings`, `notifications`, `callback_requests`, `support_tickets`, `moderation_reports` | Definer RPCs only | No | — |
| `notifications` | Students/educators reading their inbox (fan-out rows) | Yes, for **their** app | The lead's existing "own rows" policy (if any) already covers the new rows. |
| `audit_logs` | Inserts from definer RPCs | No | — |

**Must never be ported:** 0013's loop (enable RLS + admin-only policy on every
public table lacking a policy), and 0013's loop that revokes `anon`/`public`
execute on every function whose body mentions `auth.uid(`. On this database
the first would lock students and educators out of every lead table that
currently relies on RLS being off. The second would revoke execute on the
lead's own functions.

---

## 7. Migration plan

### 7.1 Conventions (apply to every file)

- **A. Additive only.** `create … if not exists`, `add column if not exists`
  (nullable, no table rewrite), `create or replace` **only** for names created
  by these files (proven absent by `0100`). No `drop`, `alter type`, `alter
  column`, `rename`, CHECK/NOT NULL changes or `revoke` on lead objects.
- **E. Extension tables over columns on hot lead tables.** Admin-only fields
  for `test_series`, `quizzes`, `quiz_questions`, `profiles`,
  `student_profiles` and `educator_profiles` go in 1:1 tables keyed by the lead
  PK (`test_series_admin`, `quiz_admin`, `quiz_question_admin`, `user_geo`,
  `students`, `educator_admin_state`). Direct `ADD`s are limited to three
  low-traffic tables: `callback_requests`, `institutions`,
  `educator_verification_docs`.
- **N. Names.** Every helper/trigger function React doesn't call is
  `adm_`-prefixed. RPC names React calls are unchanged. New columns use `text`
  + `CHECK`, not enums.
- **V. Views over lead tables** that React reads directly are owner-rights
  views whose `where` clause includes the admin check
  (`is_admin()` / `adm_is_platform_admin()`), with `select` granted to
  `authenticated` only. This avoids needing new policies on lead tables.
- **R. RLS** is enabled, with policies, **only on tables these files create**,
  listed explicitly. No loops over `pg_class` / `pg_proc`.
- **I. Indexes on lead tables** are not in transactional migrations. They go in
  a separate script using `create index concurrently if not exists`, because
  `supabase db push` wraps files in a transaction and a plain `create index`
  blocks writes on a live table.
- **M. Version numbers.** Supabase sorts migrations by version string. If the
  lead's history uses timestamps (`2024…`), files named `0100_…` sort *before*
  theirs and `db push` treats them as out of order. Agree the numbering with
  the lead first (Q18). Names below use `0100+` as asked.

### 7.2 Files

| # | File | Contents | Rollback |
|---|---|---|---|
| 0100 | `0100_admin_preflight.sql` | Read-only `do $$` assertions that `raise exception` and abort if: a lead table or column relied on (§2) is missing; `is_admin()` is absent or has a different signature; **any** name about to be created (tables, views, functions, sequences in 0101–0118) already exists; `profiles.role` CHECK lacks `admin`. | None needed (no DDL). |
| 0101 | `0101_admin_helpers.sql` | `adm_touch_updated_at()`, `adm_is_platform_admin()` (only if Q4 says the lead's `is_admin` excludes `super_admin`), `adm_norm_text`, `adm_initials`, `adm_resolve_date_range`, `adm_normalize_phone`, `adm_phone_display`, `adm_current_session_id`, `adm_series_status(test_series)` (derives draft/scheduled/published/archived), `adm_map_question_type_in/out`. Sequences (`*_code_seq`). | `drop function if exists adm_…(…)` for each; `drop sequence if exists …`. |
| 0102 | `0102_admin_lookups.sql` | `regions` (+ seed), `admin_nav_items` (seed with 0012 routes), `report_types` (seed rewritten to lead columns), `assignment_status_progress` (seed). `insert into platform_settings ('dashboard_quote', …) on conflict (key) do nothing`. | Drop the four tables; `delete from platform_settings where key = 'dashboard_quote' and updated_by is null`. |
| 0103 | `0103_admin_extend_lead_tables.sql` | ADDs only: `callback_requests` (+11 columns, §2.5; then backfill `code`, set default, unique index), `institutions.state_code` (+ backfill from `regions`), `educator_verification_docs.review_note`, `.verified_by`. | `alter table … drop column if exists …` (safe only before real data is written; take a backup first). |
| 0104 | `0104_admin_people.sql` | `students`, `student_block_history`, `educator_admin_state`, `educator_invites`, `user_geo` (if Q12 says yes), `user_sessions`, `admin_notes`. One-time backfill of `students` / `educator_admin_state` rows for existing `profiles.role` = student / educator. | Drop the tables. |
| 0105 | `0105_admin_test_authoring.sql` (**gated on Q2, Q3, Q6**) | `test_series_admin`, `quiz_admin`, `quiz_question_admin`, `test_sections` (FK `quizzes`), `ai_test_jobs`, `ai_generated_questions`, `question_similarity_matches`; storage bucket `question-images` (`on conflict do nothing`) + its policies. Under Option A also: compatibility views `tests`, `questions`, `question_options`, `subjects` with `INSTEAD OF` triggers. | Drop views, then tables; `delete from storage.buckets where id = 'question-images'` only if empty. |
| 0106 | `0106_admin_assignments.sql` | `test_assignments` (merged 0002 + 0003 shape), `series_requests`, `assignment_comments`, `assignment_history`, `assignment_notifications`. | Drop the tables. |
| 0107 | `0107_admin_commerce.sql` (**gated on Q1**) | `discounts`, `discount_series`, `discount_events`, `discount_redemptions`; then `payments`, `payment_events`, `educator_txn_counters`, `refund_settings` (or a `platform_settings` key), `refund_requests`, `refund_events`, `payouts`. If the lead already has an orders table, `payments` becomes a view or extension of it instead. | Drop the `prevent_*_delete` triggers first, then the tables in reverse FK order. |
| 0108 | `0108_admin_notification_campaigns.sql` | `notification_campaigns`, `notification_recipients` (delivery), `notification_campaign_events`. | Drop the tables; `delete from notifications where reference_type = 'notification_campaign'`. |
| 0109 | `0109_admin_misc_tables.sql` | `callback_activity`, `report_runs`. | Drop the tables. |
| 0110 | `0110_admin_views.sql` | All `v_*` views (§1.2) rewritten over lead tables; compatibility views `series_enrollments`, `educator_documents` (+ `INSTEAD OF UPDATE` trigger function `adm_educator_documents_update`, `SECURITY DEFINER`, admin-checked). | `drop view if exists …` (reverse dependency order); drop the trigger function. |
| 0111 | `0111_admin_rpc_shell.sql` | `get_admin_me`, `record_login`, `record_logout`, `touch_session`, `get_admin_nav`, `global_search`, notes RPCs, dashboard RPCs (`get_admin_dashboard` + parts). | `drop function if exists` with the full signature list in the file header. |
| 0112 | `0112_admin_rpc_people.sql` | Educator RPCs (incl. `register_educator`, `create_educator_invites`, soft `delete_educator`), `revoke_user_sessions`, `sign_out_other_devices`, `list_auth_events`. | Same. |
| 0113 | `0113_admin_rpc_test_series.sql` (gated as 0105) | Test series, assignment, tracker, TPA, `log_export` RPCs. | Same. |
| 0114 | `0114_admin_rpc_commerce.sql` (gated on Q1) | Discount, transaction, refund, financial, regional RPCs. Until Q1 lands, ship **stub versions** returning the same keys with zeros/empty arrays so the pages render. | Same. |
| 0115 | `0115_admin_rpc_reports_notifications_callbacks.sql` | Report builder, notification campaign + bell RPCs, callback RPCs incl. `submit_callback_request`. | Same. |
| 0116 | `0116_admin_rls.sql` | `enable row level security` + policies on the tables created in 0102–0109, listed by name. Own tables only. | `drop policy if exists … on <own table>`; `alter table <own table> disable row level security`. |
| 0117 | `0117_admin_grants.sql` | Explicit `revoke all … from public, anon` / `grant execute … to authenticated` for each new function signature. `submit_callback_request` and `record_logout` keep `anon`/`authenticated` as needed. Service-role-only grants for webhook/email/gateway RPCs. | Reverse grants (only on the new functions). |
| 0118 | `0118_admin_cron.sql` (optional, needs `pg_cron`) | Schedules for `dispatch_due_notifications`, `purge_expired_report_results`, `purge_old_auth_events` (if not in `audit_logs`), `detect_repeated_questions`. | `select cron.unschedule('<name>')`. |
| — | `scripts/admin_indexes_concurrently.sql` (manual, outside a transaction) | Trigram/partial indexes on lead tables: `quiz_questions (adm_norm_text(question_text))`, `profiles (full_name, email)`, `test_series (title)`, `audit_logs (action, created_at)`, `notifications (reference_type, reference_id)`. | `drop index concurrently if exists …`. |

### 7.3 Must NOT be touched

- `profiles.role`: its type, CHECK, default and grants. No `revoke update (role)`
  (the archive's 0011 does this).
- Any existing function: `is_admin`, `owns_course`, `is_enrolled`,
  `manages_org_unit`, and anything §3.1 returns (`set_updated_at`,
  `handle_new_user`, …).
- Triggers on `auth.users` (0012), and any existing trigger on lead tables.
- RLS enabled/disabled state and policies on any lead table. No blanket loops
  (0013).
- Existing CHECK constraints and NOT NULLs. In particular
  `test_series.course_id`, `notifications.category`,
  `educator_verification_docs.doc_type`, `callback_requests.status`.
- Existing rows: no `delete from profiles` (archived `delete_educator`), no
  updates to lead data except the documented backfills (`institutions.state_code`,
  `callback_requests.code`), and no seeds. **`supabase/seed_dev.sql` must never
  run against production.**
- The `auth` schema from SQL (`auth.users.banned_until`, `delete from
  auth.sessions`) unless the lead approves (Q10). Prefer Edge Functions with
  the Admin API.
- `storage.buckets` / `storage.objects` policies for buckets that already exist.

---

## 8. Open questions for the lead (most blocking first)

1. **Payments/orders.** `enrollments.order_id` and `bookings.order_id` have no
   FK target in the dump. Is there an orders/payments table (in another schema,
   or planned)? If so, send its DDL. *Blocks:* transactions, refunds, financial
   analytics, regional analytics, dashboard revenue, discount redemption, and
   the revenue columns in reports (~30% of the admin RPCs).
2. **Can an admin create a test series without a course?** `test_series.course_id`
   is NOT NULL. Options:
   - (a) make it nullable (lead change);
   - (b) a platform-owned "house course" per subject/exam;
   - (c) the admin must pick an existing course in the wizard (UI change).

   Also: are series priced on their own, or always through the course price?
   *Blocks:* the wizard, drafts, duplicate, AI save, and "new series" in Assign
   Educators.
3. **Is `quizzes.series_id` the "test" of a series, with `quiz_questions` /
   `quiz_question_options` as its questions?**
   - Is access to a series granted by enrolment in its course?
   - Is `passing_score` a percentage?
   - Does the scorer support multi-select (`multiple_choice` with several
     correct options)?
   - Are `long_answer` / `fill_in_blank` needed?
   - Is extension-table metadata (sections, negative marks, difficulty,
     images) acceptable?

   *Blocks:* all authoring and analytics mapping.
4. **Helper functions.** Please run §3.1 and send the output. In particular:
   the exact signatures and bodies of `is_admin`, `owns_course`, `is_enrolled`
   and `manages_org_unit`; whether `is_admin()` returns true for `super_admin`;
   and whether they are `SECURITY DEFINER`. *Blocks:* safe deployment of every
   RPC.
5. **RLS state and policies** for each table (§3.1 queries), especially
   `profiles`, `student_profiles`, `educator_profiles`, `test_series`,
   `quizzes`, `enrollments`, `notifications`. *Blocks:* direct-table paths and
   views (§6).
6. **Direct table writes from React.** For `test_series`, `tests`,
   `questions`, `question_options` and `test_sections`, which option?
   - **Option A:** add ~20 columns, `status` and `deleted_at` to the lead's
     `test_series`, with a `status`↔`is_published` sync trigger, plus
     `INSTEAD OF` views. No React change.
   - **Option B:** move those calls in `testSeriesApi.js` and
     `assignmentsApi.series` behind RPCs. One service file changes, no pages
     change, and the lead's tables get no DDL.

   Recommendation: **B**, but it overrides the "React unchanged" rule for one
   file, so you need to agree.
7. **`super_admin` and other roles in the admin portal.** `roles.js` /
   `AdminLayout.jsx` / Edge `requireAdmin` accept only `admin`. Is changing
   them OK? Should `head_teacher` see anything?
8. **`educator_profiles.verification_status` values.** There is no CHECK in
   the dump. Is it `pending` / `verified` / `rejected`? Is `under_review` used?
9. **Signup.** What creates `profiles` (and `student_profiles` /
   `educator_profiles`) today? May we add an `AFTER INSERT` trigger on
   `profiles` to create `students` / `educator_admin_state` rows, or should we
   backfill plus create lazily? When an admin invites an educator through
   `auth.admin.inviteUserByEmail`, will the lead's trigger already insert the
   `profiles` row, and with which role? `educator_profiles.phone` and
   `location` are NOT NULL; what goes there for bulk invites?
10. **Blocking users.** Is there an existing ban/suspend mechanism? May admin
    actions set `auth.users.banned_until` and delete `auth.sessions` (Edge
    Function with the service role), or should blocking stay app-level only?
11. **Subjects.** Are `categories` the subjects (a series' subject = its
    course's category)? Or is `courses.subjects[]` / `educator_profiles.subjects[]`
    the source? May the admin portal create categories (slug required)?
12. **Student location.** `profiles.location` is free text and
    `student_profiles.school_name` is not linked to `institutions`. May we add
    `user_geo(user_id, state_code, institution_id)`? Is `institutions.state` a
    full state name we can match to the `regions` list? What values does
    `student_profiles.grade` hold (the UI filters by 'Grade 6'…'Grade 12')?
13. **Admin announcements into `notifications`.** Is fanning out into the
    lead's `notifications` (`reference_type = 'notification_campaign'`) OK? How
    should the archived categories `policy` / `alert` map: to `system`, or
    should the lead add values? Should the admin bell count only campaign rows,
    or all of the admin's notifications?
14. **Login/logout events.** Into `audit_logs` (`action = 'auth.*'`), or a
    separate `user_auth_events` table to keep `audit_logs` for business
    actions?
15. **Discounts.** Should they apply to courses (`courses.price`) as well as or
    instead of test series? How do they relate to `courses.discount_price`?
16. **Regions.** Is the Regional Head scope the `org_units` hierarchy
    (`manager_scopes`)? Is the revenue-by-state view (`regions` lookup)
    still wanted, or should regional analytics group by `org_units` with
    `unit_type = 'region'`?
17. **Storage.** Which bucket and path format does
    `educator_verification_docs.doc_url` use (full URL or object path)? Which
    buckets exist?
18. **Migration history.** What is the latest version in
    `supabase_migrations.schema_migrations`, and does the lead use timestamp
    versions? This decides whether files can be named `0100_…` or need
    `YYYYMMDDHHMMSS_…` to run after theirs. Who runs `db push` against
    production?
19. **Support tickets vs callbacks.** `/admin/supporttickets` currently shows
    callback requests. Should it show `support_tickets` instead, or both?

---

## Appendix: archived defects to fix while porting

These don't need decisions, but the contract can't be copied blindly. Some
return shapes were never produced correctly.

- `series_enrollments.user_id` and `.created_at` are referenced by
  `_report_enrollment`, `_report_students`, `_resolve_audience`,
  `approve_refund` and React `studentsApi.detail`. The archived table only had
  `student_id` / `enrolled_at`.
- `get_series_approvals` reads `test_assignments.due_date`; the column is
  `deadline`.
- `get_admin_nav` counts callbacks with `status = 'pending'` (the values are
  `new`/`contacted`/`closed`) and moderation from `content_reports`, a table
  that never existed.
- `is_admin()` and `mark_notification_read(uuid)` are each defined twice;
  `test_assignments` is created twice.
- `payment-webhook` sends `p_method: "online"`, which is outside the archived
  `payment_method` values.
- `adminApi.js` exports unused `studentsApi` / `educatorsApi` objects whose RPC
  parameter names don't match the SQL.
