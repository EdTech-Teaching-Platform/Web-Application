# Admin port progress

Port of the admin backend onto the lead's live database. It follows
`docs/ADMIN_ON_EXISTING_DB.md` and the verified facts and decisions from the
port brief (F1–F9, D1–D13).

**Status: the 29 migrations are applied to the lead's project (2026-10-25).**
`supabase migration list` shows every version from `20261025100000` to
`20261025120800` as both local and remote. The batch sections below are the
review history. Where they say "awaiting review" or "nothing applied", the
"Live status" section below supersedes them.

## Live status (2026-10-25)

### What is live

- **Database:** all 29 `20261025*_admin_*` migrations: tables, helpers, 237
  function names, the house course, the 2 `question-images` storage policies,
  and the 5 `adm_` cron jobs. Applied migrations are never edited; fixes go in
  new timestamped files.
- **Lead indexes:** `scripts/admin_indexes_concurrently.sql` is run by hand.
  Check with `select indexrelid::regclass from pg_index where not indisvalid`.
- **Smoke test B(1), anonymous caller: ✅ 21/21 rejected.** It used the anon key
  through PostgREST and called only STABLE, read-only RPCs. Every call returned
  HTTP 401 / `42501 permission denied for function …`, so the grants stop anon
  before the admin check is even reached. Covered: `get_admin_me`,
  `get_admin_dashboard`, `get_admin_nav`, `get_dashboard_stats`, the student /
  educator / test-series / support-ticket / callback / notification lists and
  stats, `global_search`, `get_tpa_summary`, `list_auth_events`,
  `get_my_unread_notification_count` and `adm_is_platform_admin`.
- **Smoke tests still pending:**
  - **B(2), lead functions unchanged:** needs catalog access, either through the
    `scripts/admin_snapshot_lead_editor.sql` diff or an approved `db query`.
  - **B(3), signed-in admin:** needs an admin token for `get_admin_me` /
    `get_admin_dashboard`.
- **Frontend:**
  - The admin pages listed in `docs/ADMIN_BACKEND_TODO.md` call the live RPCs.
  - `super_admin` is treated as admin.
  - The Regional Head portal is mounted at `/regionalhead/*`, with
    `/regionalhead/login` and `/invite/regional-head/:token`. It is still on
    mock data.
- **Edge Functions:** not deployed yet (`supabase functions list` was empty on
  2026-10-25). Deploys happen one at a time, each with its own approval:
  `create-educator-invites`, `revoke-user-sessions`, `send-notification-emails`,
  `sign-educator-document`, then the placeholders.

### What is stubbed: money (F4)

The lead's database has no orders, payments, refunds or payouts. Every money RPC
is marked `STUB: needs payments model (F4)` (D1):
- **Discounts, transactions, refunds:** reads return zeros or empty lists;
  writes raise SQLSTATE `0A000` "not available yet".
- **Financial analytics, and revenue in the dashboard, regional and report
  screens:** revenue is 0.
- **Series pricing** is stored, but `amount_paid_inr` / `revenue_inr` /
  `total_spent_inr` are 0.
- **Edge placeholders:**
  - `payment-webhook` would call the stubbed `mark_payment_paid` /
    `mark_payment_refunded`.
  - `process-refund` reads `refund_requests`, which doesn't exist.
  - `ai-generate-test` needs `OPENAI_API_KEY`.

  Deploying them is safe, since they fail closed, but they do nothing useful
  yet.

### What remains

1. **Payments model (F4 / D1).** Orders, payments, refunds and payouts tables,
   owned by the lead or agreed with them. Then replace the D1 stubs with real
   RPCs in new migrations and wire `payment-webhook` / `process-refund`.
2. **Student-side access to admin series.** Admin-created series live on the
   hidden `draft` house course (B2-A1), so the lead's student app can't see
   them. `admin_series_enrollments` exists, but nothing enrols students until
   payments exist. Needs one of:
   - a lead decision to publish the house course;
   - moving series onto real courses;
   - an enrolment path in the lead's app.
3. **Manual grading in the lead's scorer.** The lead's grading code isn't in this
   repo (`existing_Schema.sql` has no functions). Subjective questions are stored
   as `short_answer` with a model answer, or the placeholder `Manual grading: see
   rubric`, as the correct option. `needs_manual_grading` is set only in our
   `quiz_question_admin`. Unless the lead's scorer knows to skip these, it will
   auto-mark students against that text. Ask the lead how `short_answer` /
   `fill_in_blank` are scored. It may need a manual-review state on
   `quiz_answers` (their table, their change).
   - **Related:** `multiple_choice` with several correct options, and
     `numerical` without tolerance (D3 table, Batch 2).
4. **`quizzes` has no draft status.**
   - Per-test draft / published lives only in our `quiz_admin`. The lead's
     student app sees every quiz on a published series, including drafts.
   - A real fix needs a lead-owned `quizzes.status` / `is_published` column. We
     may not add CHECK / NOT NULL constraints to lead tables.
5. **Smaller items:**
   - **Revoking another user's tokens:** Admin API `signOut` needs that user's
     own JWT.
   - **`EDUCATOR_DOCS_BUCKET`:** must name the lead's verification-docs bucket.
   - **Support tickets:** replies and status changes don't notify the submitter.
   - **Remaining mock screens:** listed in `docs/ADMIN_BACKEND_TODO.md`.
   - **`src/components/ui/icons copy.jsx`:** kept, because `icons.jsx`
     re-exports it. Merge the two before deleting it.

## 2026-10-28: teacher portal on the educator RPCs (frontend; needs 20261028* applied and educator-upload-url deployed)

### Auth and onboarding

- **`/teacher/register`** (`src/auth/pages/EducatorRegister.jsx`): email + password or Google.
  - Before sign-up starts, it sets the educator intent: `sessionStorage`
    `ul_educator_signup` and `user_metadata.signup_role = "educator"`.
  - **`profileService.ensureProfile`:** with that intent and no profile, it
    calls `educator_start_onboarding`, never the student insert.
  - **`AuthCallback`:** if the intent lands on an account with another role,
    it shows "This email is registered as a … account" and never changes the
    role.
  - **`/teacher/login`:** the same Supabase sign-in as everyone. A Google
    sign-in started there also sets the intent.
- **`/teacher/onboarding`** (`EducatorOnboarding.jsx`), full page, five steps:
  - **saving:** each step is saved with `educator_save_onboarding_step`, and a
    refresh resumes after the last saved step;
  - **validation:** client checks mirror the server (`utils/onboarding.js`),
    and server field errors (`error.details`) are shown on the fields;
  - **ID step:** front, back and selfie, plus optional certificates, with
    preview, upload progress, replace and remove. Uploads go
    `educator-upload-url` → signed upload (XHR, for progress) →
    `educator_register_document`;
  - **review and submit:** `educator_submit_onboarding`.
- **`educatorAccountStore`** (the localStorage accounts, with passwords) is no
  longer used by any mounted code. Logout clears its `ul.educator.*` keys.

### Gate (`src/layouts/TeacherLayout.jsx`)

- **Who gets in:**
  - not signed in → `/teacher/login`;
  - not an educator → their own home;
  - otherwise `educator_get_status`, on load, on window focus, and every 60 s
    while pending.
- **What each status shows:**
  - `draft` → onboarding;
  - pending / under review, changes requested (with the note and "Edit and
    resubmit"), rejected (with the reason and "Update and resubmit"), and
    suspended → a full-page screen with logout and no navigation, so a typed
    feature URL lands there too;
  - verified → the portal.

### Verified portal

The nav is Dashboard, Assigned, Test Series, Create Test Series, Stats and
Profile.

| Route | Page | Data |
|---|---|---|
| `/teacher/dashboard` | `EducatorDashboard` | `educator_get_dashboard` |
| `/teacher/assigned`, `/teacher/assigned/:id` | `AssignedWork` | `educator_list_assignments`, `_get_assignment`, `_start_assignment`, `_add_assignment_comment`; Publish = `adm_publish_test_series` |
| `/teacher/test-series` | `EducatorTestSeries` (tabs: Published, Drafts, Pending approval, Rejected with the reason) | `list_test_series` (role-aware) |
| `/teacher/test-series/new`, `/:seriesId`, `/:seriesId/tests/:testId` | the **admin** `TestSeriesWizard`, `TestSeriesDetail`, `TestDetail` | shared RPCs |
| `/teacher/stats` | `EducatorStats` (`TrendChart` and `DonutChart` reused) | `educator_get_stats` |
| `/teacher/profile` | `EducatorProfilePage` | `educator_get_profile` / `educator_update_profile` |

**Shared authoring code:** `src/portals/admin/context/authoringPortal.js`.
TeacherLayout provides `EDUCATOR_AUTHORING`; the admin portal uses the default.

- **What it parameterizes:** paths, back labels, and the publish action.
  - On an educator's own series, the publish action is **"Submit for
    approval"**. The wizard saves (`p_publish = false`), then calls
    `educator_submit_series_for_approval`, keeping the new id so a retry
    updates the same series.
  - Per-test publish is hidden until the series is approved.
- **`SeriesReviewBanner`:** "waiting for approval" (read-only), the rejection
  reason, and Submit / Resubmit.
- **`TestDetail`:**
  - a re-score notice ("Changing a correct answer or the marks re-scores N
    submitted attempts");
  - after saving, a toast with the number of attempts re-scored.
- **Unchanged:** the AI and subjective "Coming soon" flags, the progress steps,
  Retry and the double-submit guard.

### Admin additions

- **Test Series → Approvals tab** (`SeriesApprovals.jsx`):
  - `list_pending_series_approvals` with search and paging;
  - Review / Approve / Reject, where Reject requires a reason.
- **Pending badges:** on the tab and on the sidebar's Test Series item
  (`usePendingApprovals`, refreshed every minute and on focus).
- **Educator verification:**
  - document names read "Government ID (front)", "Selfie", …;
  - teaching languages and the application date are shown;
  - `statusMaps` labels `draft` as "Not submitted";
  - documents still open through `sign-educator-document`.
- **`testSeriesMock.js`** status labels add "Pending approval" and "Rejected".

### Unmounted (files kept, no route, no nav, not bundled)

- **`src/portals/teacher/pages/`:** `Analytics`, `AssignedSeries`,
  `BookingManage`, `ContentUpload`, `CourseBuilder`, `CourseManagement`,
  `CoursePreview`, `Dashboard`, `Earnings`, `EditProfile`, `Grading`,
  `LiveClasses`, `MentorshipHub`, `Messaging`, `MyCourses`,
  `NotificationPrefs`, `ProfileSetup`, `PublishFlow`, `Registration`,
  `Reviews`, `ReviewsAvailability`, `SessionRequests`, `StudentManagement`,
  `TestSeries`, `TestSeriesBuilder`, `TestSeriesDetail`, `TestSeriesEarnings`,
  `TestSeriesManage`, `TestSeriesStudentPreview`, and every component used
  only by them.
- **Providers:**
  - `TestSeriesProvider`, removed from `App.jsx` (`src/context/TestSeriesContext.jsx` kept);
  - `SessionRequestsProvider`, removed from `AppRoutes.jsx`;
  - the teacher course, mentorship, messaging and availability providers.
- **Data:** `src/portals/teacher/data/educatorAccountStore.js` and the other
  teacher mock data modules.
- **Removed files:** none.
- **Old URLs:**
  - `/teacher/testseries/*` → `/teacher/test-series`;
  - `/teacher/profilesetup` and `/teacher/editprofile` → `/teacher/profile`;
  - `/teacher/registration` → `/teacher/register`;
  - anything else → `/teacher/dashboard`.

### Checks

- `npm run build` ✅. `npm test` ✅ 111/111, including:
  - **`tests/educator-portal.test.jsx` (20):**
    - each gate status renders the right screen and blocks feature routes;
    - polling and focus re-check, and non-educators redirected;
    - onboarding validation, resume, server field errors and upload errors;
    - upload error stages;
    - the series tabs mapping;
    - role-based labels, including the wizard submitting for approval and
      never publishing.
  - **`tests/educator-upload-url.test.js` (8).**
- **Lint:** the new files have the codebase's usual `set-state-in-effect`
  (data loading) and `only-export-components` (route files) warnings; no
  others.

## 2026-10-28: educator document uploads (written, nothing deployed or applied)

- **`supabase/functions/educator-upload-url/`:**
  - `index.ts` (`verify_jwt` true) and `validate.ts` (pure validators: allow-list, content types, 5 MB, file-name sanitizing, path builder);
  - returns `{path, signedUrl, token, bucket, expiresIn}`;
  - the user id comes only from the JWT.
- **`20261028110000_educator_upload_limit.sql`:**
  - `educator_upload_requests` (ours, RLS on, FK CASCADE, indexed);
  - `adm_claim_educator_upload_slot`: 20 per hour; refuses non-educators; granted to `authenticated` and allow-listed in verify.
- **`20261028090100` (not applied yet, so edited in place):** `educator_register_document` also checks the stored object's size (≤ 5 MB) and MIME type.
- **`sign-educator-document`:**
  - path handling moved to `paths.ts`;
  - `<educator id>/…` paths must be in the document owner's folder; `..` segments are refused;
  - optional `download: true`;
  - older forms unchanged.
- **`_shared/auth.ts`:** "Educators only" is a 403.
- **`supabase/config.toml`:** `[functions.educator-upload-url] verify_jwt = true`.
- **`docs/EDGE_FUNCTIONS.md`:** the function, the secret `EDUCATOR_UPLOAD_LIMIT_PER_HOUR` and the deploy line.
- **Checks:**
  - `tests/educator-upload-url.test.js`: 8 tests (validators and the sign paths);
  - `educator_onboarding.sql`: + size, type and rate-limit checks.
  - Not type-checked with Deno, because there is no Deno in this environment; the pure modules are compiled and tested by Vitest.

## 2026-10-28: educators on the shared test series authoring (written, nothing applied)

The contract is in `docs/EDUCATOR_RPC_CONTRACT.md` → "Test series for
educators".

| File | What |
|---|---|
| `20261028100000_educator_series_preflight.sql` | Collects every clash: prerequisites, the 27 functions replaced, our columns, the status CHECK name, free new names. |
| `20261028100100_educator_series_access.sql` | **`test_series_admin` (our table):** + `origin`, `rejection_reason`, `submitted_at`, `approved_by` (FK SET NULL, indexed), `approved_at`; the status CHECK adds `pending_approval` / `rejected`. **Guards:** `adm_actor_kind`, `adm_can_create_series`, `adm_can_manage_series`, `adm_require_author`, `adm_require_series_access`, `_access_or_new`, `_owner`, `adm_educator_series_ids`, `adm_series_is_independent_educator`. **Regrade:** `adm_regrade_quiz` (set-based: answers, attempts, reports), `adm_rebuild_attempt_report`, `adm_attempt_latest_answers`, `adm_question_grading_key`, `adm_update_options_in_place`. |
| `20261028100200_educator_series_guards.sql` | **Generated.** The latest body of 26 shared RPCs, each with its `adm_require_admin()` line swapped for a guard, plus the marked edits (educator list filter, rejected drafts, per-test publish rule, in-place option edits and regrade in `update_question` / `update_question_option`, origin in `adm_new_house_series`). Also `adm_publish_test_series` → `adm_publish_series_core`, plus a role-aware wrapper. |
| `20261028100300_educator_series_approval.sql` | `educator_submit_series_for_approval`, `list_pending_series_approvals`, `approve_educator_series`, `reject_educator_series`, `adm_series_content_problem`, `adm_notify_series_decision`. |
| `20261028100400_educator_series_portal.sql` | `educator_list_assignments`, `_get_assignment`, `_start_assignment`, `_add_assignment_comment`, `educator_get_profile`, `_update_profile`, `_get_stats`, `_get_dashboard`. |
| `scripts/rollback_20261028_educator_series.sql` | **Generated.** Restores the 27 previous bodies verbatim and drops the rest. |
| `docs/trial_run_20261028_educator_series.sql` | All five files in `begin; … rollback;`. |
| `supabase/tests/educator_series.sql` | 35 checks and 29 expected errors, local only. |

**Generators** (scratchpad, kept for re-runs): `gen_educator_series.cjs` and
`gen_educator_series_rollback.cjs`. Each replacement asserts exactly one match,
so a changed source body fails loudly instead of being patched wrongly.

**Decisions and assumptions:**
- An **active assignment** is any status except `cancelled` / `rejected`. An
  assignee can manage the series (not delete it) even after completion.
- An **independent educator series** can't be published by
  `adm_publish_test_series`, for admins too; only `approve_educator_series`
  publishes it. After approval, the owner may edit it in place (brief 6) and
  unpublish it; publishing again needs another approval.
- **Regrade** covers only attempts with an `attempt_reports` row (graded by
  this port). Attempts graded by the lead's own app keep their scores.
- **Notifications:** series decisions use category `moderation`, which the
  lead's CHECK allows.

**Checks (PGlite, nothing applied):**
- all files apply, and the trial succeeds;
- `educator_series.sql` all passing (including regrade: the rebuilt report equals a
  fresh grading of the same answers), `educator_onboarding.sql` (its
  enforcement scan now covers the 9 verified-only RPCs and refuses a student on
  all 16 `educator_*`), and `admin_fast_publish`, `admin_block_subjective`,
  `feedback_rpcs` and `student_rpcs`, unchanged;
- **admin behaviour:** the 14-step admin wizard scenario is identical to the
  original, apart from the new columns;
- **rollback:** after it, the scenario is identical and the old tests pass;
- parser 0 errors, hardening 373 definitions with 0 problems, verify 35 tables
  and 330 functions all PASS. `adm_actor_kind` is granted to `authenticated` on
  purpose and allow-listed.

## 2026-10-28: educator self-registration and onboarding (written, nothing applied)

The contract is in `docs/EDUCATOR_RPC_CONTRACT.md`. `EDUCATOR_PORTAL_PLAN.md`
is not in the repository; the decisions come from the briefs.

| File | What |
|---|---|
| `20261028090000_educator_preflight.sql` | Collects every clash: lead columns, `storage.objects`, the `doc_type` CHECK values, our Batch 1 objects and the CHECK name, and free new names. |
| `20261028090100_educator_onboarding.sql` | **Guards:** `adm_is_educator`, `adm_is_verified_educator`, `adm_require_*`. **Table:** `educator_onboarding`. **`educator_admin_state`:** + `submitted_at`, and a wider `review_state` CHECK (our table). **RPCs:** `educator_start_onboarding`, `_save_onboarding_step`, `_register_document`, `_remove_document`, `_submit_onboarding`, `_get_status`, `_get_onboarding`. |
| `20261028090200_educator_admin_review.sql` | Replaces `adm_educator_verification_key` (draft key), `set_educator_verification` (review_state `approved` / `rejected`, notifications) and `get_educator_detail` (+ `review_state`, `submitted_at`, `onboarding_step`). |
| `scripts/rollback_20261028_educator_onboarding.sql` | Generated. Restores the three functions verbatim, then drops everything 090100 created. |
| `docs/trial_run_20261028_educator.sql` | The three files in `begin; … rollback;` (the last line is `rollback;`). |
| `supabase/tests/educator_onboarding.sql` | 39 checks, local only. |

**Mismatches found in the existing admin side (fixed in 090200):**

1. `review_state` allowed only `under_review` / `changes_requested`, so the
   onboarding states couldn't be stored. The CHECK is widened; existing values
   stay valid.
2. A self-registered educator who hadn't submitted yet would have read as
   `pending` and appeared in the verification queue.
   `adm_educator_verification_key` now returns `draft` for them. Drafts are
   left out of the `pending` filter and the pending count, and are listed with
   `p_verification = 'draft'`.
3. `set_educator_verification` cleared `review_state` on approve and reject,
   and notified nobody. It now writes `approved` / `rejected` and inserts the
   `verification` notification.
4. `get_educator_detail` had no submission date or review state. Both are
   added, and `history` includes submissions.
5. **Frontend (fixed in the frontend brief):** `statusMaps.js` has no label for
   `draft`.

**Unchanged:** `list_educators`, `get_educator_stats`,
`list_educator_documents` and `review_educator_document` already handled
self-registered rows. Documents are stored as `<uid>/<file>` storage paths,
which `sign-educator-document` already signs in `EDUCATOR_DOCS_BUCKET`.

**Assumptions:**
- An invited educator (`register_educator`, `review_state` null) reads as
  `pending` and can't edit, as before.
- `inactive` accounts count as suspended for the teacher portal.
- A selfie and certificates are optional; the front and back of the ID are
  required.

**Checks (PGlite, nothing applied):**
- all migrations apply, and the trial succeeds;
- the rollback restores the original CHECK and functions;
- `educator_onboarding.sql`, `admin_fast_publish`, `admin_block_subjective`,
  `feedback_rpcs` and `student_rpcs` all pass;
- the parser reports 0 errors, and hardening 315 definitions with 0 problems;
- the verify script passes (35 tables, 299 function names). The
  `adm_is_educator` / `adm_is_verified_educator` grants to `authenticated` are
  intentional and allow-listed.

## 2026-10-27: fast "Publish now" / "Save as draft" (written, nothing applied)

### Network calls (before → after)

- **Opening the wizard:**
  - **Before:** `list_test_series` (100 rows, with enrolment and attempt counts
    over every series), only for the hidden "Duplicate" start and a name
    warning.
  - **After:** loaded only when the Duplicate start is picked. The name warning
    uses `series_name_exists`, which was already being called (300 ms
    debounce).
- **Editing a draft:** `get_test_series` (full tree) is unchanged. A lighter
  read is an open item.
- **Publish now / Schedule go-live:** already one RPC,
  `upsert_test_series_full(p, true)`. It saves, validates and publishes in one
  transaction, and stays that way. Then the app goes to the list page, which
  loads its own page (`list_test_series` page 1, `get_test_series_stats`).
  Nothing reloads the list twice.
- **Save as draft:**
  - a saved series: one `save_wizard_draft` (stores the wizard state only);
  - a new series: one `upsert_test_series_full(p, false)`.

### Server: `20261027110000_admin_fast_publish.sql`

Same rows, same errors, set-based. No similarity or repeated-question scan runs
on save or publish: `detect_repeated_questions` runs only from the cron job and
the tracker's button.

| Was (per row) | Now |
|---|---|
| Duplicate-name check through `adm_series_rows()` (every series + courses + categories; a SECURITY DEFINER table function, so never inlined) | `adm_series_name_taken()`: one lookup on `test_series` / `test_series_admin`. Also behind `series_name_exists`. |
| `adm_ensure_series_admin` through `adm_series_rows()` (twice per publish) | Reads only that series |
| `adm_delete_quiz` per test | `adm_delete_series_quizzes`: three deletes for the whole series |
| Per question: section subquery, `adm_insert_question`, `adm_insert_options` option-by-option loop | `adm_insert_questions_bulk`: per test, one statement writes questions, admin rows and options (`adm_question_options` gives the same options as rows). The `20261027090000` guards are kept, with the same messages. |
| Section insert loop | One `insert … select` per test |
| `adm_validate_quiz_for_publish` per test (a `not exists` per question) | `adm_series_publish_problem`: one query; same first failing test, same message |
| `adm_complete_assignments_for_quiz` per test | `adm_complete_assignments_for_series` |

- **Double submits on the server:**
  - an existing series: `select … for update` on its `test_series` row;
  - a new series: `pg_advisory_xact_lock` on the lower-cased name.

  Before, two concurrent saves of one series could both insert their tests,
  doubling them.
- **Replaced (ours, same signatures and grants):**
  - `adm_ensure_series_admin`
  - `series_name_exists`
  - `adm_publish_test_series`
  - `upsert_test_series_full`
- **New internal helpers** (revoked from `anon` / `authenticated`):
  - `adm_series_name_taken`
  - `adm_question_options`
  - `adm_insert_questions_bulk`
  - `adm_delete_series_quizzes`
  - `adm_series_publish_problem`
  - `adm_complete_assignments_for_series`
- **Behaviour difference:** when a payload has several problems, the first one
  reported can differ, because each test's questions are checked before any
  are written. Still all-or-nothing.
- **Index (not a migration):** `scripts/admin_indexes_concurrently.sql` now
  also has `adm_quiz_question_options_question_idx` on
  `quiz_question_options (question_id)`, for the lead's approval.
  - Without it, every deleted question makes the FK check scan the whole
    options table, and so does every "has a correct option" check.
  - Check `pg_indexes` first, in case the lead already has one.
- **Rollback:** `scripts/rollback_20261027110000_admin_fast_publish.sql` (one
  transaction). It restores the four functions verbatim from the 20261025 files
  and drops the six helpers.
- **Trial:** `docs/trial_run_20261027110000.sql`.
- **Test:** `supabase/tests/admin_fast_publish.sql` (33 checks and 14 expected errors), local only.

### Frontend

- **`TestSeriesWizard.jsx`** (Publish now / Schedule go-live and Save as draft):
  - a ref blocks a second click before React re-renders;
  - both buttons, Back, the step pills and "← Test Series" are disabled while
    saving;
  - `beforeunload` warns before closing the tab;
  - the button reads "Publishing…" / "Scheduling…" / "Saving…" (`aria-busy`).
- **`components/SaveProgress.jsx`**, in the sticky footer:
  - **steps:** "Saving questions" → "Validating" → "Publishing" (or
    "Scheduling go-live"), "Saving questions" for a new draft, "Saving draft"
    for a saved one;
  - while the single request runs, the first step shows as in progress. On
    success the app goes to the list with the toast, as before;
  - **on error:** the failed step (publish-rule messages map to "Validating"),
    the server's message plus "Nothing was saved.", and Retry and Dismiss;
  - **without a server answer** (a dropped connection), it says the series may
    have been saved and to check the list before retrying.
- **`utils/saveProgress.js`:** steps, the failed step, and the messages.
- **Debug timing (`utils/debugTiming.js`):** off by default.
  - `callRpc` wraps every admin RPC in `console.time("rpc <name> #n")`.
  - The wizard also times the whole save, labelled with the number of tests and
    questions.
  - Turn it on with `localStorage.setItem("ul_debug_rpc_timing", "1")`, or
    `VITE_DEBUG_RPC_TIMING=true` at build time.
- **`data/testSeriesWizard.js`:** the review's "Another series already uses
  this name" warning also uses `ctx.nameTaken`.

### Checks run (nothing applied)

- **PGlite** (in memory):
  - all 42 migration files apply;
  - `admin_fast_publish.sql` passes;
  - `admin_block_subjective`, `feedback_rpcs` and `student_rpcs` still pass;
  - the trial succeeds.
  - **Old vs new:** the same 14-step scenario (draft, failed publish, publish
    with a window and limits, schedule, 6 error payloads, name check,
    unpublish) gives **identical** rows, audit entries and messages.
  - After the rollback script, the output is identical to the old one again.
- **PGlite timings** (10 tests × 100 questions × 4 options; WASM, so only
  relative):

  | | Old | New |
  |---|---|---|
  | Create draft | 451 ms | 300 ms |
  | Replace and publish | 1,121 ms | 374 ms |
  | Publish only | 420 ms | 5 ms |

- **Static checks:**
  - the Postgres 17 parser: 0 errors;
  - hardening: 295 definitions, 0 problems;
  - `scripts/admin_verify_push_editor.sql` regenerated: all PASS (34 tables,
    282 function names).
- **`npm run build`:** ✅. **`npm test`:** ✅ 83/83, including
  `tests/admin-fast-publish.test.jsx` (steps, messages, the timing flag, and
  the wizard: no list on open, the double-click lock, error and retry, and the
  draft error with dismiss).
- **Lint:** no new warnings in the changed files.

### Open items

1. **Push:** after `20261027090000` and the feedback files. Run
   `docs/trial_run_20261027110000.sql` first.
2. **The options index:** with the lead's approval, one statement at a time.
3. **Time on the real database:** see "SQL to time" in the hand-off.
4. **Lighter edit load:** the wizard only needs `wizard_state`, but
   `get_test_series` builds the whole tree. A small `adm_` read RPC would fix it.

## 2026-10-27: AI and subjective "coming soon", test feedback and moderation (written, nothing applied)

### 1. AI-assisted building: coming soon

- **Flag:** `src/portals/admin/utils/featureFlags.js` has `AI_ENABLED = false`.
- **AI Test Builder button** (`TestSeries.jsx`): disabled, with a "Coming soon"
  badge.
- **AI Test Builder page** (`/admin/testseries/ai-builder`; route and file
  kept):
  - a "Coming soon" badge and notice;
  - every control inside a disabled `<fieldset>`;
  - `handleGenerate`, `startManual`, `openSave` and `handleSaveConfirm` return
    early.
- **Wizard "AI-assisted outline" start:** a disabled card with the badge.
  `chooseMethod` refuses it, the outline panel is never rendered, and a saved
  draft with `startMethod: "ai"` restarts at the method step.
- **No code path starts an AI job:**
  - nothing in `src/` invokes the `ai-generate-test` Edge Function, which isn't
    deployed either;
  - the AI Test Builder's generator is the local template mock, now unreachable.

### 2. Subjective questions: coming soon (frontend)

- **`src/portals/admin/data/questionTypes.js`:** the question types.
  - Available: `mcq_single`, `mcq_multi`, `true_false`, `fill_blank`.
  - Coming soon: `short_answer`, `long_answer`, `subjective`.
  - Shared helpers: normalizing legacy names, `validateQuestionDraft`,
    `questionPayload`, `rejectBlockedQuestions`.
- **`components/QuestionTypePicker.jsx`:** cards or pills. The coming-soon types
  are disabled, carry the badge, and can't be selected. `QuestionAnswerFields`
  holds the per-type answer fields.
- **Question editor (`TestDetail.jsx`):**
  - uses the picker;
  - MCQ (multiple) has multi-select correct answers;
  - true / false has its own choice;
  - fill in the blank takes an accepted answer;
  - **the model-answer field is gone**;
  - existing subjective questions open read-only, and can still be deleted.
- **Wizard:** `TestSeriesWizardParts.jsx` (question editor) and
  `TestSeriesWizard.jsx`:
  - same picker;
  - legacy drafts are normalized (`objective` → `mcq_single`);
  - saving is blocked while a subjective question remains, with a "Remove the N
    … question(s)" message;
  - the payload comes from `questionPayload`.
- **Imports:**
  - **CSV** (`testSeriesWizard.js`): `mcq`, `mcq_multi` (`A|C`), `true_false`
    (True / False) and `fill_blank` (accepted answer in the `correct` column).
    `short_answer` / `long_answer` / `subjective` rows are **invalid** with the
    message "… is not supported yet. Short answer, long answer and subjective
    questions are coming soon …". The template is updated.
  - **AI and paste** (`aiTestBuilderMock.js`): the type options no longer
    include short / long answer. `generateTest` and `parseQuestionPaper` run
    `stripBlockedQuestions`, which removes those questions and adds a warning
    saying how many were rejected.
- **`services/testSeriesApi.js` `mapQuestion`:**
  - returns the real `type`: a stored `mcq` with several correct options is
    `mcq_multi`;
  - adds `kind`, `correctAnswers` and `acceptedAnswer`; `modelAnswer` is gone;
  - this also fixes a latent bug: fill-in-the-blank questions used to come back
    as "subjective", so re-saving them in the wizard turned them into
    manually graded short answers.
- **Student side:** unchanged. Existing subjective questions still show
  "pending review" in the runner and the report, and no new content can contain
  them.

### 3. Server guard: `20261027090000_admin_block_subjective.sql`

- **Preflight** (in the file): the replaced functions exist; the new helper
  names don't.
- **Helpers** (internal, revoked from every browser role):
  - `adm_is_subjective_type(text)`;
  - `adm_question_is_subjective(uuid)`: lead `short_answer`, a subjective
    `admin_type`, or `needs_manual_grading`;
  - `adm_assert_question_type_allowed(text)`.
- **Replaced (ours only).** The 20261025 bodies are copied verbatim, plus
  marked lines:
  - `adm_insert_question` (`create_question`, `create_test`,
    `upsert_test_series_full`): refuses subjective types. It also refuses a
    fill-in-the-blank question **without an accepted answer**, which used to get
    "Manual grading: see rubric" as its accepted answer.
  - `adm_copy_quiz` (`duplicate_test`, `duplicate_test_series`): refuses a
    source test that contains a subjective question.
  - `update_question`, `create_question_option`, `update_question_option`:
    refuse to edit an existing subjective question, or to change a question to
    a subjective type.
  - Errors are SQLSTATE `22023`. Existing rows stay readable, and
    `delete_question` is unchanged, so they can still be deleted.
- **Rollback:** `scripts/rollback_20261027090000_admin_block_subjective.sql`,
  generated from the original files. It restores the five functions and drops
  the helpers. **Checked:** after running it, the helpers are gone, all 5
  functions exist, and the guard is absent.
- **Trial:** `docs/trial_run_20261027090000.sql`.
- **Tests:** `supabase/tests/admin_block_subjective.sql` (10 checks), local
  only.

### 4. Demo series with subjective questions

- **`supabase/seed_dev.sql`:** written for the old standalone schema; 10
  single-answer MCQs, **no subjective questions**.
- **Frontend mock store `src/portals/admin/data/testSeriesMock.js`:** two demo
  series contain a subjective question.
  - "JEE Main Physics Test Series 2026": "Physics Full Mock Test 1 — Mechanics &
    Waves" ("Derive the expression for the time period of a simple pendulum.").
  - "Banking & SSC Reasoning Practice Series": "Practice Set 12 — Puzzles &
    Seating Arrangement" ("Explain the approach you would use to solve a
    circular seating arrangement puzzle.").

  Only the disabled AI Test Builder reads that store.
- **The live database:** I can't read it without approval. Run
  **`scripts/admin_list_subjective_questions_editor.sql`** in the SQL editor
  (read-only). It lists every series / test with short / long / subjective
  questions, and whether students have answered them. No rows means none.

### 5. Test feedback and moderation: `20261027100000`–`100300`

| File | What |
|---|---|
| `20261027100000_feedback_preflight.sql` | Columns, helpers, clashes (`test_feedback` + 8 function names). A NOTICE if `notifications.category` doesn't allow `support_ticket`. |
| `20261027100100_feedback_tables.sql` | `test_feedback` (columns as in the brief, plus `updated_at`). CHECKs on kind / rating / category / message length / status, and rating required for `feedback`. FKs: student → profiles CASCADE; series → test_series CASCADE; test, attempt and question SET NULL; reviewed_by SET NULL. All indexed. RLS on, no policies, no grants. |
| `20261027100200_feedback_rpc_student.sql` | `student_submit_feedback`, `student_my_feedback` (rules in `docs/STUDENT_RPC_CONTRACT.md`). |
| `20261027100300_feedback_rpc_admin.sql` | `list_moderation_items` (row_data, total_count), `get_moderation_stats`, `get_moderation_item`, `set_moderation_status`, `get_moderation_filter_options`, plus internal `adm_feedback_row`. |
| `docs/trial_run_20261027_feedback.sql` | The 4 files in `begin; … rollback;`. |
| `supabase/tests/feedback_rpcs.sql` | 19 checks, local only. |

- **Admin rules:**
  - every RPC calls `adm_require_admin()` first;
  - status values are `in_review` / `resolved` / `dismissed` (never back to
    `new`);
  - resolve and dismiss need a note;
  - every change writes `audit_logs` through `adm_audit` (`actor_id`,
    `actor_role`, `action` = `moderation.status`, `target_type` =
    `test_feedback`, `target_id`, `before_state`, `after_state`, `reason` = the
    note).
- **Notification:** a resolved item notifies the student (`notifications`,
  category `support_ticket`, `reference_type` `test_feedback`). If the lead's
  CHECK refused that category, only the notification would be skipped.
- **List filters:** `p_status` also accepts `open` (new + in review) and
  `closed` (resolved + dismissed).

**Frontend:**
- **Student:**
  - `services/feedbackApi.js`;
  - `components/FeedbackForm.jsx` (form and "Your feedback" list);
  - `utils/feedback.js` (options and validation);
  - `TestReport.jsx`: a "Give feedback or report an issue" strip after the
    summary;
  - `SeriesDetail.jsx`: "Your feedback" with status and reply, for enrolled
    students.
- **Admin:**
  - `services/moderationApi.js`;
  - `pages/ContentModeration.jsx`: rewritten on the RPCs, same layout and CSS.
    Stat cards (new / in review / resolved / dismissed / average rating), tabs
    (needs attention / closed), filters (search, kind, status, series),
    server-side pagination, and a detail modal (message, question, attempt,
    history, note, actions). No mock data; the old Regional Head content-issue
    mock is no longer shown there.

### Checks run (nothing applied)

- **Postgres 17 parser:** every new SQL file; 0 errors.
- **Hardening:** 285 function definitions; `search_path` pinned, and every
  non-`adm_` function is SECURITY DEFINER.
- **Executed in PGlite** (in-memory, scratchpad):
  - all migrations apply, 41 files in total;
  - `admin_block_subjective.sql` passes 10/10, `feedback_rpcs.sql` 19/19, and
    `student_rpcs.sql` still passes 34/34;
  - the rollback script restores cleanly;
  - `scripts/admin_verify_push_editor.sql` is all PASS (34 tables, 276 function
    names);
  - both trial files succeed against the state they will be applied on.
- **`npm run build`:** ✅ passes. **`npm test`:** ✅ 76/76, across:
  - `tests/admin-question-types.test.jsx` (picker, rules, CSV / AI / paste
    rejection, wizard drafts, mapping);
  - `tests/feedback-moderation.test.jsx` (form validation and states, list
    mapping, detail actions).
- **Lint:** no new warnings in the changed files.

### Open items

1. **Push order:** `20261027090000` (block subjective), then
   `20261027100000`–`100300` (feedback), after the student files
   `20261026100*`. Run each trial file first.
2. **Function names:** the new RPC names (`student_submit_feedback`,
   `list_moderation_items`, …) aren't in `docs/ADMIN_ON_EXISTING_DB.md` §4. The
   feedback preflight checks they don't clash.
3. **Re-enabling subjective questions:** needs a grading workflow, then
   `SUBJECTIVE_ENABLED = true` and the rollback script (or a new migration).
4. **Re-enabling AI:** needs `ai-generate-test` deployed with a provider key,
   then `AI_ENABLED = true`.

---

## Student test series, auth and student portal (written, nothing applied)

This covers three phases, all files only. None of the five `20261026100*_student_*`
migrations is applied.

**Assumption:** the five files were never applied. They were untracked and
uncommitted, so they were fixed in place. If `npx supabase migration list` shows
them as remote, the fixes must move to new files instead.

### A. Database: `20261026100000`–`100400` (student RPCs)

| File | What |
|---|---|
| `20261026100000_student_preflight.sql` | Read-only preflight. It collects every problem in one error: ~100 lead / admin columns; `quiz_answers.selected_option_ids` is an array; Batch 1–2 helpers exist; `quiz_attempts.status` allows in_progress / submitted / timed_out; clashes for both tables, all 26 function names (any overload) and the two `quiz_admin` columns. |
| `20261026100100_student_tables.sql` | `attempt_proctor_events` (FK to `quiz_attempts`, CASCADE, indexed `(attempt_id, occurred_at)`), `attempt_reports` (pk = FK, CASCADE). RLS on, no policies, no grants. `quiz_admin.max_violations int default 3`, `quiz_admin.instructions_extra text` (our table). |
| `20261026100200_student_rpc_series.sql` | Helpers `adm_student_uid`, `adm_student_writer_uid`, `adm_student_series`, `adm_student_is_enrolled`, `adm_live_series`, `adm_series_card`; RPCs `public_list_series`, `public_get_series`, `student_list_series`, `student_get_series`, `student_enroll`, `student_my_series`. |
| `20261026100300_student_rpc_exam.sql` | Helpers `adm_attempt_deadline`, `adm_test_window`, `adm_attempt_question_order`, `adm_report_bucket`, `adm_finalize_attempt`; RPCs `student_get_test_intro`, `student_start_attempt`, `student_save_answer`, `student_log_proctor_event`, `student_submit_attempt`, `student_get_report`. |
| `20261026100400_student_rpc_dashboard.sql` | `student_my_history`, `student_get_stats`, `student_dashboard`. |
| `supabase/tests/student_rpcs.sql` | 34 checks with fixtures, rolled back. **Local / disposable database only** (it inserts into `auth.users`). |
| `docs/trial_run.sql` | The five student files only, inside `begin; … rollback;`. The 29 admin files are applied, and their preflights would now fail on clashes. |
| `docs/STUDENT_RPC_CONTRACT.md` | Every RPC, its parameters, the returned JSON (captured from a real run), error codes, scoring and report rules. |
| `scripts/admin_indexes_concurrently.sql` | Adds 3 student indexes on lead tables: `quiz_attempts (student_id, quiz_id, started_at desc)`, `quiz_answers (attempt_id, question_id)`, `enrollments (student_id, course_id) where is_active`. |
| `scripts/admin_verify_push*.sql` | Regenerated from every `2026…_admin_*` and `2026…_student_*` file: 33 tables, 265 function names. Anon may call `submit_callback_request`, `public_list_series` and `public_get_series`. |

**Rules.**
- **Caller:** the student is always `auth.uid()`.
- **Grants:** every `student_*` RPC is revoked from public / anon and granted to
  authenticated. Every `adm_*` helper is revoked from all browser roles. The
  `public_*` pair is granted to anon.
- **What students can see:** live series only (published, active, admin status
  published or no admin row, not deleted, not past `available_until`), and
  published tests only.
- **Access:** a direct enrolment (not revoked, not expired) or a lead course
  enrolment (never the hidden house course). Admin-created series on the house
  course now reach students through these RPCs (this answers open item 2 of
  "Live status" for the student side).
- **Paid series:** `0A000`, STUB: needs payments model (F4).
- **Scoring and report rules:** in `docs/STUDENT_RPC_CONTRACT.md`.

**Bugs fixed in the earlier draft:**
- **Answer leak:** `student_start_attempt` returned the options of fill-in-blank
  and short-answer questions. Those options *are* the accepted / model answers,
  so the answer key went to the student.
- **Report submitted the test:** `student_get_report` was STABLE but called the
  submit function, which writes. It would fail at runtime, and if it had worked,
  merely opening a report would have submitted a running attempt.
- **Rolled-back timeout:** `student_save_answer` set `timed_out` and then raised
  an error, which rolled the update back.
- **Ungraded timeout:** `student_start_attempt` marked expired attempts
  `timed_out` without grading them.
- **Wrong order:** question and option order compared `sort_order` as text
  (10 before 2), and so did test order in `public_get_series`.
- **Multi-choice comparison:** sorted-array equality of option ids, which depends
  on collation. It's now a set comparison.
- **Short answers:** auto-marked by text match, including against the
  placeholder "Manual grading: see rubric". They're now always pending review.
- **Missing checks:** no check that the series was still published, of its
  availability window or the custom quiz window, of blocked accounts or of
  expired enrolments. Concurrent starts could exceed the attempt limit (now
  serialized with an advisory lock).
- **Revocations:** a revoked enrolment could be re-activated by the student.
- **Duplicate series:** `student_my_series` / `student_dashboard` listed a series
  twice for students with both kinds of access.
- **Search:** `%` and `_` acted as wildcards.
- **Stats:** accuracy counted pending answers as wrong; rank tie-break was
  arbitrary.
- **Answer visibility:** the lead's `quizzes.show_answers_after` was ignored. It
  now decides whether correct answers and explanations appear.
- **Double violations:** one tab switch (blur + visibilitychange) counted as two.
  There's now a 3-second debounce, and informational events aren't counted.
- **Unknown column type:** `quiz_answers.selected_option_ids` is shown only as
  `ARRAY` in the dump. Writes now use `::uuid[]`, which works for both `uuid[]`
  and `text[]` columns.

**Checks run (no real database).**
- **Postgres 17 parser:** 5 files plus the trial; 54 function / DO bodies,
  0 errors.
- **Hardening:** 269 function definitions; `search_path` pinned everywhere, and
  every non-`adm_` function is SECURITY DEFINER.
- **Executed in PGlite**, an in-memory WASM Postgres in the scratchpad that
  touches no real database:
  - lead schema from `existing_Schema.sql`, plus stand-ins for Supabase's roles,
    default grants, `auth.uid()`, storage and pg_cron;
  - **all 35 migrations apply** in order (29 admin + allowlist + 5 student);
  - `supabase/tests/student_rpcs.sql` passes all 34 checks, with
    `selected_option_ids` as `text[]` **and** as `uuid[]`;
  - `scripts/admin_verify_push_editor.sql` gives 14/14 PASS;
  - `docs/trial_run.sql` succeeds on a database at the live state (admin +
    allowlist applied).

  PGlite is not Supabase: the lead's RLS policies, real auth and pg_cron weren't
  exercised.

### B. Auth (frontend, Supabase Auth)

- **Files:**
  - `src/auth/services/authApi.js`: signUp (emailRedirectTo `/auth/callback`),
    signInWithPassword, Google (checks `/auth/v1/settings` first and shows a
    message if the provider is off), resetPasswordForEmail (to
    `/reset-password`), updateUser, logout; `authErrorMessage` maps errors.
  - `src/auth/pages/AuthCallback.jsx`: new, `/auth/callback`; routes by role.
  - `Login.jsx` (email only, Google), `Register.jsx` (password checklist),
    `ForgotPassword.jsx`, `ResetPassword.jsx` (states: loading / expired /
    form / success).
  - `src/auth/utils/validators.js`, `src/auth/routes.jsx`.
- **`src/services/profileService.js`:** `ensureProfile`. Insert-or-ignore,
  concurrent calls share one request, role is always `student`, Google name and
  avatar come from metadata.
- **`src/context/AuthContext.jsx`:** one `onAuthStateChange` source
  (INITIAL_SESSION covers reload). Profile work is deferred out of the callback
  (Supabase can deadlock if it's awaited there). It exposes `user`, `role`,
  `loading`, `recovery`, `error` and `logout` (signs out and clears per-user
  storage). `setUser` remains only for the mock teacher / regional-head flows.
- **Routing:**
  - `ProtectedRoute` waits for `loading` and redirects by role.
  - `utils/roles.homePathForUser`: student → `/student/dashboard`, admin /
    super_admin → `/admin/logindashboard` (`/admin` has no index route).
  - `Navbar`: "go to homepage" now really signs out.
- **Removed:** the OTP flow (`OtpVerification.jsx`, `auth/components/OtpInput.jsx`,
  `components/ui/OtpInput.jsx`, already deleted by the earlier attempt) and
  DEMO_MODE in auth. The Apple sign-in button is gone; the "App Store, coming
  soon" badges on the landing page and footer stay, since they aren't sign-in.
- **Docs:** `docs/AUTH_SETUP.md`. Google sign-in and forgot / reset password are
  marked **UNTESTED** until the dashboard is configured.

### C. Student portal (frontend)

- **Services:** `services/studentRpc.js` (admin-style error normalization, the
  builder is awaited), `studentSeriesApi.js`, `attemptApi.js`, `profileApi.js`
  (own `profiles` / `student_profiles` rows).
- **Hooks:** `useStudentData`, `useAttemptRunner` (state machine: server
  deadline + clock offset, debounced autosave, resume, auto-submit at zero,
  flushes pending saves before submit), `useProctor` (fullscreen,
  visibilitychange, blur, fullscreen exit, copy / cut / paste, contextmenu, each
  sent to `student_log_proctor_event`).
- **Pages:** `Dashboard`, `SeriesList` and `SeriesDetail` (student and public
  modes), `TestIntro` (the "I understand" checkbox gates Start), `TestRunner`
  (palette, mark for review, timer, blocking violation warning, submit
  confirmation), `TestReport`, `History`, `MyTests`, `Account`, `ComingSoon`.
- **Components:** `PageState`, `SeriesCard` (on `ColorBlockCard`).
- **Landing:** `FeaturedSeries` (`public_list_series`).
- **Routes:** `src/portals/student/routes.jsx`, `src/public/routes.jsx`. Old
  discovery URLs redirect to the series list and keep `?q=`.
- **Nav:** `StudentLayout` shows Dashboard, Test Series (Browse / My Tests /
  History) and Account.
- **Tests:** `tests/student-tests.test.jsx` (runner state machine, timer, resume,
  auto-submit, proctor handlers → API, report pending / skipped states) and
  `tests/auth-flow.test.jsx`. `npm test`: 49/49. `npm run build`: passes.

### Assumptions

1. **Streaks** use calendar days in Asia/Kolkata.
2. **Rank and percentile** cover every finished attempt of the test, including
   other attempts by the same student. They're a snapshot at submission.
3. **Unanswered subjective questions** count 0 toward `max_score`; answered ones
   are pending and left out.
4. **`multi_select`** in the start response reveals that a question has more than
   one correct option (for checkboxes), not which ones.
5. **Grace periods:** saves get 10 seconds past the deadline; a submit more than
   15 seconds after it is `timed_out`.

### Open items (need the lead)

1. **The lead's RLS on `quiz_question_options`, `quiz_attempts` and
   `quiz_answers`.** If students can select `quiz_question_options.is_correct`,
   or insert / update their own attempts and answers through PostgREST, they can
   bypass these RPCs: read answers or forge scores. Check the lead's policies.
   We may not change them.
2. **The profile insert depends on lead RLS.** The app inserts its own `profiles`
   row (role `student`) and `student_profiles` row. If the lead's RLS refuses
   that, sign-up fails with a clear message, and the lead needs an insert policy
   or a signup trigger (their decision).
3. **Manual grading:** pending answers stay pending. No educator / admin grading
   RPC exists yet.
4. **Payments (F4):** paid series can't be enrolled in.
5. **Per-question time** isn't tracked (`time_spent_secs` is always `null`).
6. **Indexes:** run the 3 new statements in `scripts/admin_indexes_concurrently.sql`
   after the push.
7. **Course quizzes** (`quizzes.series_id` null) aren't covered by the student
   RPCs.

---

## Admin allowlist (`20261026090000`, written, not applied)

### The problem

`adm_is_platform_admin()` trusted `profiles.role` alone, and the lead's RLS lets
users update their own `profiles` row, `role` included. Anyone could set their
own role to `admin` and pass every admin RPC.

### The fix

The fix changes only our own objects. A user is an admin only when **both** of
these hold:
1. they have a row in `public.adm_admin_users`;
2. their `profiles.role` is still `admin` or `super_admin`.

Removing either one revokes access.

### Files

| File | What |
|---|---|
| `supabase/migrations/20261026090000_admin_allowlist.sql` | See "Objects" below. |
| `docs/trial_run_20261026090000.sql` | This migration only, inside `begin; … rollback;`. |
| `supabase/functions/_shared/auth.ts` | `requireAdmin()` calls the `adm_is_platform_admin` RPC with the caller's JWT. It no longer reads `profiles.role`. |
| `supabase/functions/_shared/roles.ts` | Comment only: role values for display, not for authorization. No longer re-exported from `auth.ts`. |
| `src/layouts/AdminLayout.jsx` | Still routes on the role, then confirms with `adm_is_platform_admin()` before rendering. It renders nothing while checking, and redirects to `/` if the check is false or fails. |
| `tests/admin-roles.test.jsx` | Adds a test: a self-promoted user (role `admin`, server says no) is redirected. |
| `scripts/admin_verify_push*.sql` | Regenerated from every `2026…_admin_*` file: 31 tables, 239 function names. `adm_list_admins` is allowed for authenticated in check 6. |

### Objects in the migration

- **Preflight (read-only).** It aborts, listing every problem at once, if:
  - a function it replaces or calls is missing;
  - `auth.users`, one of our tables, or a `profiles` column it reads is
    missing;
  - `adm_admin_users`, `adm_is_admin_user` or `adm_list_admins` already exists;
  - no admin profile exists to backfill.
- **`adm_admin_users`:**
  - columns: `user_id` (pk, references `auth.users`, on delete cascade),
    `created_at`, and `created_by` (a plain uuid, audit only);
  - RLS is on, with no policies;
  - anon and authenticated have no table privileges;
  - backfilled from `profiles where role in ('admin', 'super_admin')`.
- **`adm_is_admin_user(uuid)`:** the single check (allowlist row and admin
  role). It's internal and revoked from every role.
- **`adm_is_platform_admin()`:** replaced. It now returns
  `adm_is_admin_user(auth.uid())`, with the same signature, SECURITY DEFINER,
  `search_path` and grants as before.
- **Updated automatically,** because they call `adm_require_admin()` /
  `adm_is_platform_admin()`:
  - every admin RPC, including `get_admin_me`, `record_login` and
    `touch_session`;
  - the two `question-images` storage policies.
- **Replaced, because they read `profiles.role` directly:**
  - `record_logout(text)`: admin auth events only for real admins;
  - `adm_resolve_audience(...)`: the `admins` audience uses the allowlist;
  - `assign_support_ticket(uuid, uuid)`: the assignee must pass the check.
- **`adm_list_admins()`:** a new read-only RPC, admin only. It returns
  `{admins: [...], role_without_allowlist: [...]}`:
  - `admins[].active = false` means the user is allowlisted but their role is no
    longer admin;
  - `role_without_allowlist` lists profiles that claim an admin role but aren't
    admins. Review it now and then.
- **Not changed:** the one-off house-course owner pick (`20261025110200`,
  already applied), and the preflights. Neither is an authorization check.

### How to add an admin

Both steps are needed, in the SQL editor, with the lead's approval. Order
doesn't matter, and the user has no admin access until both are done.

```sql
-- 1. the allowlist row (created_by = your own user id, for the audit trail)
insert into public.adm_admin_users (user_id, created_by)
values ('<new admin user uuid>', '<your user uuid>')
on conflict (user_id) do nothing;

-- 2. the profile role (a lead table)
update public.profiles set role = 'admin' where id = '<new admin user uuid>';  -- or 'super_admin'
```

The user must already exist in `auth.users` (they have signed up, or been
invited), because of the foreign key.

**To remove an admin:**
`delete from public.adm_admin_users where user_id = '<uuid>';`. That takes
effect on their next request. Changing their profile role back is optional,
because either step alone revokes access.

### Before applying

1. **Review the backfill.** Anyone who has already set their own role to admin
   would be allowlisted:
   `select id, email, full_name, role, created_at from public.profiles where role in ('admin', 'super_admin') order by created_at;`
2. **Run `docs/trial_run_20261026090000.sql`.** Expect "Success. No rows
   returned".
3. **Push.** With approval, `npx supabase db push` applies only this new
   version.
4. **Verify.** `scripts/admin_verify_push_editor.sql` should show every row
   PASS (31 tables, 239 function names). Then sign in to `/admin`, and check
   that `adm_list_admins()` returns the expected admins and an empty
   `role_without_allowlist`.

### Checks run (nothing applied)

- **SQL parser (Postgres 17, offline):** the migration has 23 statements and the
  trial file 25; 14 function / DO bodies across both, 0 errors.
- **Hardening:** 243 function definitions across all `2026…` files, 0 problems.
- **`npm run build`:** ✅ passes.
- **`npm test`:** ✅ 12/12.
- **`oxlint` on the changed files:** one warning, on the route-change effect
  that was already in `AdminLayout.jsx`, not on the new code.

### Rollback

Rollback SQL is in the migration header. It restores the four 20261025
definitions exactly, then drops `adm_list_admins`, `adm_is_admin_user` and the
table.

---

## Batch 1: foundation and people (written, awaiting review)

### Facts checked before writing

| Fact | Source | Result |
|---|---|---|
| F1 `profiles.role` values | `constraints.csv` line 2 | ✅ matches. The preflight re-checks it byte-for-byte. |
| F2 no CHECK on `educator_profiles.verification_status` | `constraints.csv` (no such row) | ✅ no CHECK. The "single 'verified' row" claim is data and isn't in any export; taken as given. |
| F3 no trigger on `auth.users` / `profiles` | — | ⚠️ No trigger export in `docs/db_inspection/`; taken as given. |
| F4 no orders/payments/refunds/payouts | `existing_Schema.sql` | ✅ none in the dump. Other schemas aren't exported; taken as given. |
| F5 quiz CHECKs | `constraints.csv` lines 25–27 | ✅ matches. Re-checked by the preflight. |
| F6 `notifications.category` | `constraints.csv` line 30 | ✅ matches. Re-checked by the preflight. |
| F7 callback / courses / doc_type / support statuses | `constraints.csv` lines 8, 35, 41, 42 | ✅ matches. Re-checked by the preflight. |
| F8 NOT NULLs | `existing_Schema.sql` (the CSV holds CHECK constraints only) | ✅ `test_series.course_id`, `educator_profiles.full_name/phone/location/verification_status` are NOT NULL. |
| F9 admin read-only RLS on authoring tables | — | ⚠️ No policy export; taken as given. Batch 1 doesn't touch those tables. |

Exports that are missing: functions, policies, triggers, storage buckets,
PK/FK/UNIQUE/NOT NULL constraints. `constraints.csv` contains CHECK
constraints only.

### Files written

| File | Contents |
|---|---|
| `supabase/migrations/20261025100000_admin_preflight.sql` | Read-only `do $$` assertions. Aborts if: any of ~110 lead columns are missing; 9 CHECK definitions differ from F1/F5/F6/F7; no `admin`/`super_admin` profile exists; any table, sequence, function or added column this batch creates already exists. |
| `20261025100100_admin_helpers.sql` | Sequences, `adm_*` helpers (access checks, audit, formatting, date ranges). |
| `20261025100200_admin_lookups.sql` | `regions` (+36 rows), `admin_nav_items` (+17 rows, routes from `routes.jsx`), `report_types` (+4 rows), `platform_settings.dashboard_quote` (`on conflict do nothing`). |
| `20261025100300_admin_extend_lead_tables.sql` | Nullable ADD COLUMNs on `callback_requests` (11), `institutions` (1), `educator_verification_docs` (2), plus the code/state backfills. |
| `20261025100400_admin_people_tables.sql` | 8 people tables, their triggers and indexes, 5 helpers that need them, RLS. |
| `20261025100500_admin_people_backfill.sql` | One-time `students` / `educator_admin_state` rows from `profiles`. |
| `20261025100600_admin_rpc_shell_dashboard.sql` | Login/session, sidebar, search, notepad, dashboard RPCs. |
| `20261025100700_admin_rpc_students.sql` | Student Management RPCs. |
| `20261025100800_admin_rpc_educators.sql` | Educator Management, documents and invite RPCs. |
| `20261025100900_admin_rpc_security.sql` | Sessions, revocation, auth-event log. |
| `scripts/admin_indexes_concurrently.sql` | 5 indexes on lead tables. Manual, outside a transaction, needs the lead's approval. |
| `src/portals/admin/services/studentsApi.js` | All direct table access replaced with RPCs. |
| `src/portals/admin/services/educatorsApi.js` | `updateDocument` now uses an RPC. The detail mapper supplies safe defaults for the profile tabs. |
| `src/portals/admin/services/securityApi.js` | `sessions` now uses an RPC (the table is RPC-only now). |

No page components changed.

### Objects created

- **Tables (11):** `regions`, `admin_nav_items`, `report_types`, `students`,
  `student_block_history`, `educator_admin_state`, `educator_invites`,
  `user_geo`, `admin_auth_events`, `user_sessions`, `admin_notes`.
  - All have RLS enabled with **no policies** and all privileges revoked from
    `anon` / `authenticated`. They are reachable only through SECURITY DEFINER
    RPCs.
- **Sequences (3):** `adm_student_code_seq`, `adm_educator_code_seq`,
  `adm_callback_code_seq`.
- **Internal helpers (21, not callable from the browser):**
  `adm_require_admin`, `adm_is_service_role`, `adm_actor_role`, `adm_audit`,
  `adm_touch_updated_at`, `adm_educator_verification_key`, `adm_initials`,
  `adm_like`, `adm_current_session_id`, `adm_normalize_phone`,
  `adm_phone_display`, `adm_resolve_date_range`, `adm_ensure_student`,
  `adm_ensure_educator_state`, `adm_is_account_blocked`,
  `adm_end_user_sessions`, `adm_open_assignment_count`,
  `adm_cumulative_counts`, `adm_stat_card`, `adm_grade_matches`,
  `adm_educator_base`.
  - Plus `adm_is_platform_admin`, which is granted to `authenticated` so it
    can be used in future policies on this port's own tables.
- **Browser-callable RPCs (38):** all SECURITY DEFINER, with
  `set search_path = public, extensions` and an admin check first.
  - Shell: `get_admin_me`, `record_login`, `record_logout` (any signed-in
    role), `touch_session`, `get_admin_nav`, `global_search`.
  - Notepad: `list_my_notes`, `add_admin_note`, `toggle_admin_note`,
    `update_admin_note`, `delete_admin_note`, `clear_done_notes`.
  - Dashboard: `get_admin_dashboard`, `get_dashboard_header`,
    `get_dashboard_stats`, `get_dashboard_revenue` (D1 stub),
    `get_pending_educator_verifications`, `get_series_approvals`,
    `get_top_series`, `get_students_by_region`.
  - Students: `get_student_stats`, `list_students`, `get_student_detail`,
    `block_student`, `unblock_student`.
  - Educators: `list_educators`, `get_educator_stats`, `get_educator_detail`,
    `set_educator_verification`, `set_educator_account_status`,
    `delete_educator` (soft), `create_educator_invites`,
    `list_educator_documents`, `review_educator_document`.
  - Security: `list_active_sessions`, `revoke_user_sessions`,
    `sign_out_other_devices`, `list_auth_events`.
- **Service-role only (1):** `register_educator`.

### Lead objects read

`profiles`, `student_profiles`, `educator_profiles`,
`educator_verification_docs`, `institutions`, `callback_requests`,
`moderation_reports`, `platform_settings`, `audit_logs`, `courses`,
`enrollments`, `lessons`, `lesson_progress`, `course_reviews`, `test_series`,
`quizzes`, `quiz_attempts`. The preflight also reads the catalogue:
`information_schema.columns`, `pg_constraint`, `pg_proc`.

### Lead objects touched

**By migrations:**
- `callback_requests`: +11 nullable columns (`code`, `organization`,
  `assigned_to`, `contacted_at`, `contacted_by`, `closed_at`, `closed_by`,
  `submitted_from`, `ip_hash`, `user_agent`, `updated_at`). `code` is
  backfilled as `CB-1001…` in `created_at` order.
- `institutions`: +`state_code`, backfilled where `state` matches a region
  name or code.
- `educator_verification_docs`: +`review_note`, +`verified_by`.
- `platform_settings`: one row `dashboard_quote` (`on conflict do nothing`).
- No constraints, defaults, FKs, indexes, triggers, RLS changes or grants on
  any lead table.

**At runtime, through RPCs:**
- `educator_profiles.verification_status`, `verified_at`, `verified_by`,
  `rejected_reason` (`set_educator_verification`; values limited to
  pending / verified / rejected).
- `educator_verification_docs.is_verified`, `verified_at`, `verified_by`,
  `review_note` (`review_educator_document`).
- `profiles` + `educator_profiles` inserts (`register_educator`, service role,
  D8).
- `audit_logs` inserts (`adm_audit`).

### Decisions applied and defects fixed

- **D5:** `adm_is_platform_admin()` (`admin`, `super_admin`) everywhere. The
  lead's `is_admin()` is never called or replaced.
- **D6:** block and suspend are app-level only. Sessions are ended in
  `user_sessions`; no SQL touches `auth`.
- **D7:** only pending / verified / rejected are written to
  `educator_profiles`. `under_review` / `changes_requested` live in
  `educator_admin_state.review_state`. Output keys match `statusMaps.js` and
  `EducatorVerification.jsx`, so the lead's existing 'verified' row reads as
  verified.
- **D8:** backfill plus lazy upserts (`adm_ensure_*`); list RPCs LEFT JOIN and
  treat a missing row as active. No triggers.
- **D9:** login/logout events go to `admin_auth_events`; business actions go to
  `audit_logs` (actor_id, actor_role, action, target_type, target_id,
  before_state, after_state, reason).
- **Appendix fixes:**
  - The callbacks badge counts `status = 'new'`.
  - The moderation badge reads `moderation_reports`.
  - Approvals use `deadline`, not `due_date`.
  - No `series_enrollments.user_id`.
  - `mark_notification_read` is not defined in this batch (it comes once, in
    Batch 3).
  - `get_educator_stats` now returns an object. The archived version returned a
    one-row table that `EducatorVerification.jsx` couldn't read.
- **`record_logout`** never fails for students or educators. It only records
  events for admins.

### Checks run

- `npm run build`: ✅ passes (only the existing chunk-size warning).
- `npm test`: ✅ 7/7 pass.
- `npx oxlint src/portals/admin/services`: ✅ no findings.
- **SQL parse check (no database):**
  - `@libpg-query/parser` (the real Postgres 17 parser, installed in the
    scratchpad only) parsed all 11 SQL files and **66 function/DO bodies**
    (PL/pgSQL, SQL, and the `$q$` dynamic-SQL strings) with 0 errors.
  - The checker was confirmed to catch planted syntax errors.
  - **This is syntax only.** Column names, types and privileges are first
    checked for real by `npx supabase db push --dry-run` / a disposable
    project.

### Assumptions (please confirm)

1. **A1. Definer RPCs bypass the lead's RLS.** SECURITY DEFINER RPCs run as the
   migration role (`postgres`), which owns or bypasses RLS on the lead's
   tables. If any lead table has `FORCE ROW LEVEL SECURITY`, these RPCs would
   be filtered by the lead's policies. Check with
   `select relname from pg_class where relforcerowsecurity;`.
2. **A2. Array element types.** `educator_profiles.subjects` / `languages` are
   text-compatible arrays (the dump only says `ARRAY`).
3. **A3. JWT session id.** Supabase JWTs carry a `session_id` claim (supabase-js
   v2). If one doesn't, session tracking is skipped silently; nothing fails.
4. **A4. Default function grants.** Supabase default privileges grant EXECUTE
   on new functions to `anon`/`authenticated`; every file revokes them
   explicitly per signature.
5. **A5. CHECK formatting.** The preflight compares CHECK text exactly. A
   different Postgres version could format them differently and make the
   preflight abort. That is a safe failure; the fix is to update the strings.
6. **A6. Registration date.** `profiles.created_at` is used as the
   registration / joined date.
7. **A7. Late callback rows.** Callback rows the lead's own code inserts after
   this migration have `code = NULL`. Batch 3's callback RPCs must assign a
   code on first admin action and display a fallback until then.

### Contracts later batches must honour

These are needed because `create or replace` is only allowed on names the
preflight proves new, so Batch 1 functions can't be rewritten later.

- **`test_assignments` (Batch 2)** must have `id`, `series_id`, `educator_id`,
  `test_name`, `deadline date`, and `status text` with the values `assigned`,
  `in_progress`, `submitted`, `under_review`, `revision_requested`,
  `approved`, `rejected`, `completed`, `cancelled`. `get_admin_nav`,
  `get_series_approvals` and `adm_open_assignment_count` read it dynamically.
- **`admin_series_enrollments` (Batch 2)** must have `series_id`, `student_id`
  and `enrolled_at`. `get_student_detail` reads it dynamically.
- **Series soft delete (Batch 2)** must also set `test_series.is_active =
  false`. `global_search`, the dashboard stats and `get_top_series` filter on
  `is_active`.
- **Batch 2 and Batch 3** each start with their own preflight file for the
  names they create.

### Unsupported or stubbed after Batch 1

- **Dashboard revenue:** zero buckets (D1).
- **Students by Region:** empty until `user_geo` rows exist. There is no UI to
  set them yet, and the lead's data has no student→state link.
- **Educator profile tabs:** Students, Performance, Payments and Communication
  are empty or zero.
- **Document "View/Download":** still calls storage directly; the
  signed-URL Edge Function comes in Batch 4.
- **Refresh-token revocation:** `revoke_user_sessions` and
  `sign_out_other_devices` only end sessions in the app's table. The real
  revocation goes in the Edge Function in Batch 4.
- **Bulk/individual educator invites:** the DB part is done; the Edge Function
  update is Batch 4.
- **Test-series parts:** approvals, the series badge and open-assignment counts
  read 0 until Batch 2.
- **Still calling `supabase.from(...)`:** `testSeriesApi.js` and
  `assignmentsApi.js`, which are Batch 2 scope.
- **Dead code:** `adminApi.js` still exports unused `studentsApi` /
  `educatorsApi` objects. Left untouched.

### Review checklist for Batch 1

- [ ] The preflight's column list matches what you expect the lead's database
      to have.
- [ ] The preflight's CHECK strings are identical to `constraints.csv`.
- [ ] You agree that no FK/default/constraint is added to lead tables (the
      `callback_requests.assigned_to` etc. integrity is enforced in RPCs).
- [ ] You agree the `callback_requests.code` backfill (`CB-1001…`) is
      acceptable on live rows.
- [ ] The `institutions.state_code` backfill rule (match by state name or
      2-letter code) is acceptable.
- [ ] RPC-only tables (RLS on, no policies) are acceptable for all 11 new
      tables.
- [ ] `register_educator` should be service-role only.
- [ ] Soft delete for educators (`account_status = 'deleted'`) is acceptable.
- [ ] `set_educator_verification` leaves `verified_at` / `verified_by` alone on
      rejection.
- [ ] Admin `record_logout` events are recorded for admins only.
- [ ] Run the A1 check: `select relname from pg_class where relforcerowsecurity;`.
- [ ] Before anything is applied: `npx supabase db push --dry-run` against the
      lead's project, with the lead's approval.

---

## Batch 2: test authoring (written, awaiting review)

### Files written

| File | Contents |
|---|---|
| `supabase/migrations/20261025110000_admin_b2_preflight.sql` | Read-only checks. Aborts if Batch 1 isn't applied, ~70 lead authoring/course columns are missing, or no admin profile exists. Then collects **every** clash (each overload of a taken function name with its signature, tables/sequences, house-course slug or setting, `question-images` bucket or policies) and raises one error listing them all. |
| `20261025110100_admin_b2_authoring_tables.sql` | `test_series_admin`, `quiz_admin`, `test_sections`, `ai_test_jobs`, `ai_generated_questions`, `quiz_question_admin`, `question_similarity_matches`, `admin_series_enrollments`, `adm_series_code_seq`; the `question-images` bucket with 2 policies for that bucket only. |
| `20261025110200_admin_b2_house_course.sql` | D2: one `courses` row plus the `platform_settings.admin_house_course_id` row. |
| `20261025110300_admin_b2_assignment_tables.sql` | `series_requests`, `test_assignments` (merged final shape), `assignment_status_progress` (+9 rows), `assignment_comments`, `assignment_history`, `assignment_notifications`, 2 sequences. |
| `20261025110400_admin_b2_authoring_helpers.sql` | 28 internal helpers: read models, type mapping, question/option writers, copy/delete, series→lead flag sync, availability writer. |
| `20261025110500_admin_rpc_test_series.sql` | 12 series RPCs. |
| `20261025110600_admin_rpc_tests_questions.sql` | 14 test/section/question/option RPCs. |
| `20261025110700_admin_rpc_assignments.sql` | 14 assignment RPCs. |
| `20261025110800_admin_rpc_tracker.sql` | 9 tracker/similarity RPCs + 2 helpers. |
| `20261025110900_admin_rpc_performance.sql` | 8 analytics RPCs + 2 helpers. |
| `scripts/admin_indexes_concurrently.sql` | +6 indexes on `quizzes`, `quiz_questions`, `quiz_attempts`, `quiz_answers`, `test_series`. |
| `src/portals/admin/services/testSeriesApi.js` | All direct table access replaced with RPCs. Mappers read the new JSON shape (`options` instead of `question_options`). Adds `duplicateTest`. |
| `src/portals/admin/services/assignmentsApi.js` | `requests`, `eligibleEducators` and `series` now use RPCs. |

`trackerApi.js` and `performanceApi.js` needed no change. **No admin service
file calls `supabase.from(...)` any more** (checked with grep). No page
components changed.

### RPCs (57 browser-callable, all SECURITY DEFINER with the admin check first)

- **Series:** `get_test_series_stats`, `list_test_series`, `get_test_series`
  (series + tests + sections + questions + options in one call),
  `create_test_series`, `update_test_series`, `delete_test_series` (soft),
  `adm_publish_test_series` (renamed, see Batch 2 revision 1),
  `duplicate_test_series`, `save_wizard_draft`,
  `discard_wizard_draft`, `series_name_exists`, `upsert_test_series_full`.
- **Tests:** `create_test`, `update_test`, `delete_test`, `duplicate_test`,
  `set_test_status` (publish / unpublish).
- **Sections:** `create_test_section`, `update_test_section`,
  `delete_test_section`.
- **Questions:** `create_question`, `update_question`, `delete_question`.
- **Options:** `create_question_option`, `update_question_option`,
  `delete_question_option`.
- **Assignments:** `list_assignments`, `get_assignment_detail`,
  `list_series_requests`, `list_eligible_educators`, `list_series_options`,
  `create_assignments`, `update_assignment_requirements`, `reassign_educator`,
  `extend_deadline`, `cancel_assignment`, `start_review`, `review_submission`,
  `assign_request`, `reject_request`.
- **Tracker:** `get_tracker_stats`, `list_series_tracker`,
  `get_series_tracker_detail`, `detect_repeated_questions`,
  `list_repeated_matches`, `get_match_counts`, `mark_match_reviewed`,
  `dismiss_match`, `flag_match_confirmed`.
- **Analytics:** `get_tpa_filter_options`, `get_tpa_summary`,
  `get_tpa_subject_scores`, `get_tpa_series_engagement`,
  `get_tpa_test_comparison`, `get_tpa_leaderboard`, `export_tpa_rows`,
  `log_export`.

**Changed against the archived contract.** The JSON callers still get the
same key names; these are the deliberate differences:

- `get_test_series_stats`, `get_tracker_stats` and `get_tpa_summary` return
  **objects**. The archived versions returned one-row tables, and the pages
  (`TestSeries.jsx`, `TestSeriesTracker.jsx`, `TestPerformanceAnalytics.jsx`)
  read objects, so those cards always showed 0.
- **The `p_educator` filter** in the analytics RPCs is now `text` and accepts
  an educator id *or* name, because the page sends names. Tracker rows carry an
  extra `seriesId` key, because the page looks rows up by `g.seriesId`.
- **New RPCs replace direct reads/writes** (D4): `list_series_requests`,
  `list_eligible_educators`, `list_series_options`, and all of the
  series/test/section/question/option CRUD functions.

### Lead objects touched

**By migrations:**
- `courses`: one row (slug `platform-test-series-house`, `status 'draft'`, all
  NOT NULL columns filled explicitly, `educator_id` = the oldest
  admin/super_admin). Guarded by `WHERE NOT EXISTS`.
- `platform_settings`: one row `admin_house_course_id` (`ON CONFLICT DO
  NOTHING`).
- `storage.buckets`: one row `question-images`, and two policies on
  `storage.objects` limited to that bucket.
- No DDL on any lead table.

**At runtime, through the RPCs only:**
- `test_series`: insert on the house course; update of `title`,
  `description`, `instructions`, `is_published`, `is_active`,
  `available_from`, `available_until`, `updated_at`.
- `quizzes`: insert / update / delete. Admin series only get deletes, and only
  when no attempts exist.
- `quiz_questions` and `quiz_question_options`: insert / update / delete.
  Refused once `quiz_answers` exist.
- `audit_logs`: insert.

### Lead objects read

`test_series`, `quizzes`, `quiz_questions`, `quiz_question_options`,
`quiz_attempts`, `quiz_answers`, `courses`, `categories`, `enrollments`,
`profiles`, `educator_profiles`, `platform_settings`, plus `storage.buckets`
and `pg_policies` in the preflight.

### Question-type mapping (D3)

The original type is kept in `quiz_question_admin.admin_type` and returned to
the UI unchanged.

| UI / archived type | Lead `question_type` | Lossy? |
|---|---|---|
| `objective`, `mcq`, `mcq_single`, `single` | `multiple_choice` (one correct) | no |
| `mcq_multi`, `multi_select` | `multiple_choice` with several `is_correct` options | **yes**: the lead's scorer may treat `multiple_choice` as single-answer |
| `true_false` | `true_false` (True/False options created if none are given) | no |
| `numerical`, `numeric`, `fill_blank` | `fill_in_blank` + one correct option (accepted answer, else model answer, else `Manual grading: see rubric`) | **yes** for `numerical`: no numeric tolerance or units |
| `short_answer` | `short_answer` + one correct option (same fallback) | no, unless the placeholder is used |
| `subjective`, `long_answer`, `descriptive` | `short_answer` + one correct option (model answer, else `Manual grading: see rubric`) + `needs_manual_grading = true` (our table only) | **yes**: the lead's app doesn't know it needs manual grading, and an auto-grader would compare against the model answer or placeholder |

**Other lossy points.** These live only in the extension tables and are
invisible to the lead's student app:
- Per-test `draft` / `published` status. **The lead's `quizzes` table has no
  status, so the student app shows every quiz of a published series, drafts
  included.**
- Negative marks.
- Sections.
- Question and option images.
- Difficulty, subject and topic per question.
- Shuffle options.
- Per-test open/close windows and `scheduled_at`.
- Monthly limits, access days and late-submission grace.

**Option letters** are derived from position, so skipped blank options shift
the letters. The text and correct flags are preserved.

**Passing marks** are stored as a percentage in `quizzes.passing_score`,
rounded to 2 decimals.

### Assumptions (please confirm)

1. **B2-A1. The house course stays hidden.** It is `draft` and owned by the
   oldest admin, so admin-created series on it are invisible in the lead's
   catalogue. Students have no lead-side path to these series yet;
   `admin_series_enrollments` waits for the payments port (D1).
2. **B2-A2. Editing the lead's own series.** Series on a real course are
   editable test by test. The wizard's "replace everything" mode is refused for
   them. An admin row is created lazily from their current state. Dates,
   description and instructions are written to the lead's own columns only
   when the admin changes them.
3. **B2-A3. Scheduled go-live needs cron** (revision 2). A series with a
   future `go_live_at` is `scheduled` with `is_published = false`.
   `release_scheduled_series()` publishes it once `go_live_at` has passed.
   **Batch 3's cron file must schedule it every 5 minutes.**
4. **B2-A4. Publish rule = the lead's rule** (revision 1). Same checks and
   messages as the lead's `publish_test_series(uuid, boolean)`. The archived
   extra requirements (audience, grade, exam, level, language, two options per
   objective question) are dropped.
5. **B2-A5. What counts as an attempt.** Analytics count `quiz_attempts` with
   status `submitted` or `timed_out` and a non-null `percentage`. Minutes come
   from `time_taken_secs`.
6. **B2-A6. Repeated-question detection** needs `pg_trgm`. It raises a clear
   error if the extension is missing, and only scans questions of series
   quizzes.
7. **B2-A7. `scheduledAt` strings** from `datetime-local` inputs carry no time
   zone, so they are read in the database session's time zone (UTC on
   Supabase).
8. **B2-A8. Index dependency.** `scripts/admin_indexes_concurrently.sql`
   creates an index on `quiz_questions` that uses `adm_norm_text()`. Drop that
   index before dropping the function.

### Unsupported / not wired after Batch 2

- **The test question editor is still on mock data.** `TestDetail.jsx` reads
  `testSeriesMock` and never calls the API. The RPCs and the
  `testSeriesApi.*Question` / `*Option` functions exist, but wiring them needs a
  page change, which is out of scope under D4.
- **The AI Test Builder is still on mock data.** `AITestBuilder.jsx` is
  mock-backed. The `ai_test_jobs` / `ai_generated_questions` tables exist; no
  save-to-series RPC was written because nothing calls one.
- **Educator-side assignment actions** (start, submit) belong to the teacher
  portal. Assignments can't reach `submitted` from the admin side alone.
- **Pre-existing page bug, not fixed (pages are off-limits).**
  `TestPerformanceAnalytics.jsx` line 217 reads `lbSeries` in a dependency
  array before `const [lbSeries, …] = useState(…)` on line 234. That throws a
  ReferenceError on every render, so the analytics page can't load whatever the
  backend does. The fix is moving line 234 above line 217. **Please approve
  that one-line page change.**
- **Batch 2 money parts:** series pricing is stored, but enrolments, revenue and
  amount-paid are zero until payments exist (D1).

### Checks run

- `npm run build`: ✅ passes.
- `npm test`: ✅ 7/7 pass.
- `npx oxlint src/portals/admin/services`: ✅ no findings.
- **SQL parse (Postgres 17 parser, no database):** all 20 migration files plus
  the index script; **159 function/DO bodies, 0 errors**.
  - It caught one real error: `position` used as a `RETURNS TABLE` column name
    is a syntax error. Renamed to `test_position`.
  - Column names, types and privileges still need
    `npx supabase db push --dry-run` / a disposable project.

### Review checklist for Batch 2

- [ ] The house course: draft, owned by the oldest admin, title
      "Platform test series (internal)".
- [ ] Per-test draft status not being visible to the lead's student app:
      accept, or ask the lead for a `quizzes` status column.
- [ ] The lossy type mappings above.
- [ ] The publish rule (B2-A4) and the revision 1 items below.
- [ ] Refusing deletes and option replacement once attempts or answers exist.
- [ ] Two storage policies on `storage.objects` for `question-images` only:
      admins write, any signed-in user reads.
- [ ] Approve the one-line fix in `TestPerformanceAnalytics.jsx`, and decide
      whether `TestDetail.jsx` should be wired to the question RPCs (page
      change).

### Batch 2 revision 1: the lead's `publish_test_series` clash

The Batch 2 preflight found `publish_test_series(uuid, boolean)` already in the
lead's database. That function is the lead's and is never created or
replaced. Nothing has been applied, so the Batch 2 files were edited in place.

**1. Rename to `adm_publish_test_series(p_id uuid, p_publish boolean default true)`.**
Every occurrence changed:

| File | Occurrence |
|---|---|
| `supabase/migrations/20261025110500_admin_rpc_test_series.sql` | header RPC list; ROLLBACK `drop function … adm_publish_test_series(uuid, boolean)`; the definition; the internal `perform public.adm_publish_test_series(sid, true)` in `upsert_test_series_full`; the `revoke` and the `grant` (now `(uuid, boolean)`); the `create_test_series` comment |
| `supabase/migrations/20261025110000_admin_b2_preflight.sql` | the name list (`publish_test_series` → `adm_publish_test_series`) |
| `src/portals/admin/services/testSeriesApi.js` | `publishSeries` calls `adm_publish_test_series` with `{ p_id, p_publish: true }` |
| `supabase/tests/admin_rpcs.sql` | the required-signature list and the missing-series guard (3 lines) |
| `docs/ADMIN_ON_EXISTING_DB.md` | the RPC support row |
| `docs/PORT_PROGRESS.md` | the Batch 2 RPC list (this file) |
| `docs/trial_run.sql` | regenerated from the migrations (it is their concatenation inside `begin … rollback`) |
| `supabase/functions/*` | **no occurrences**, nothing changed |

Bare `publish_test_series` now appears only in comments that name the lead's function.

**2. Same validation as the lead, both flags set.** Checks, in the lead's order
and with its messages: `Test series not found.`; `The closing time must be
after the opening time.`; `"<title>" has no questions.`; `"<title>" has N
question(s) without a correct answer.`; `Add at least one test before
publishing.`. It sets `test_series.is_published = p_publish` **and**
`test_series_admin.status` (`published` / `scheduled`, or `draft` when
`p_publish = false`). It inserts no notifications. It returns the lead's shape
`{series_id, is_published, tests}` plus `status`. `set_test_status('published')`
uses the same per-test messages, through `adm_validate_quiz_for_publish`.

Consequences:
- **Every question needs a correct option, as in the lead's rule.** As of
  revision 2, every text-answer question gets one automatically, so these
  questions no longer block publishing.
- The archived "at least two options" rule is gone. The lead doesn't have it.

**3. Lead columns are the source of truth.** All target columns exist in
`docs/existing_Schema.sql`; **none are missing**.

| Wizard / form field | Lead column |
|---|---|
| series description / about | `test_series.description` |
| series instructions | `test_series.instructions` (new optional `instructions` key; the wizard UI has no such field today) |
| availability start / end | `test_series.available_from` / `available_until` (Asia/Kolkata days, close day inclusive) |
| active / archived / soft-deleted | `test_series.is_active` (soft delete → `false`) |
| published | `test_series.is_published` (`scheduled` keeps it `false` until release, revision 2) |
| test instructions | `quizzes.description` (`quizzes` has no `instructions` column) |
| duration | `quizzes.time_limit_mins` |
| attempt limit | `quizzes.max_attempts` |
| pass percent | `quizzes.passing_score` |
| shuffle questions | `quizzes.shuffle_questions` |
| order | `quizzes.series_sort_order` (`position` key) |
| show answers | `quizzes.show_answers_after` (new `showAnswersAfter` key, checked against `submission` / `passing` / `never`; returned as `show_answers_after`) |

`test_series_admin` **lost** `availability_mode`, `start_date`, `end_date` and
the `test_series_admin_window` CHECK. The mode is derived (`window` when
`available_until` is set). `start_date` / `end_date` in the read model are the
lead columns' dates. It **keeps** only columns the lead's `test_series` has no
equivalent for: `code`, `status`, `pricing`, `price_inr`, `level`, `exam`,
`languages`, `build_deadline`, `wizard_state`, `go_live_mode` / `go_live_at`,
`deleted_at`, `subject_category_id`. Also kept, because the lead has no
column for them either: `subject_label`, `grade`, `who_for`, `audience`,
`syllabus`, `start_method`, `monthly_limit`, `access_days`, `late_allowed`,
`late_grace_minutes`, `cover_path`, `published_at`, `created_by`. Say if any of
these should go.

New helper `adm_set_series_availability(uuid, date, date)` writes the window.
`adm_sync_series_to_lead(uuid)` now syncs only `is_published` / `is_active`
(its date argument is gone).

*(Superseded by revision 2: go-live is no longer written into
`available_from`.)*

**4. Preflight collects every clash.** Both preflights
(`20261025100000`, `20261025110000`) now list every overload of every
taken function name as `name(args)` from `pg_proc` joined to `pg_namespace`.
They use no `to_regproc` / `to_regprocedure` (the Batch 1 presence check
moved to `pg_proc` too). The Batch 2 preflight reports function, table /
sequence, house-course, bucket and policy clashes in **one** error.

Offline coverage check (scratchpad `coverage.mjs`): every
`create function | table | sequence | view public.X` in all 18 non-preflight
`20261025*` files appears in its batch's preflight list. 181 names, 0 missing,
0 defined in two files. A live clash can only be found by the preflight
itself, because no inventory of the lead's functions is on disk
(`existing_Schema.sql` has tables only).

**Divergence to note:** the lead's version notifies a course's active
enrolments when a series is first published. Ours doesn't, as instructed.
For series on a **real** (lead) course, publishing from the admin portal
therefore sends no `course_update` notification.

**Checks:** `npm run build` ✅; `npm test` ✅ 7/7; SQL parse: 20 files, 158
function/DO bodies, 0 errors (one preflight DO block fewer, one helper more).
Nothing was applied to any database.

### Batch 2 revision 2: text answers always publishable; go-live kept out of `available_from`

Files edited in place, since nothing has been applied:
`20261025110000_admin_b2_preflight.sql`, `20261025110400_admin_b2_authoring_helpers.sql`,
`20261025110500_admin_rpc_test_series.sql`, `20261025110600_admin_rpc_tests_questions.sql`,
and the regenerated `docs/trial_run.sql`.

**1. Text-answer questions are always publishable.**
- **New helper `adm_text_answer(jsonb)`.** It picks the single correct option
  in this order:
  1. the accepted answer (`correctAnswer` / `answer` / `correctAnswers[0]`);
  2. the model answer (`modelAnswer` / `model_answer`);
  3. the literal `Manual grading: see rubric`.
- **It never returns null.** Every `fill_in_blank` / `short_answer` question,
  including those mapped from `subjective` / `long_answer` / `descriptive`, gets
  exactly one correct option. `needs_manual_grading` stays in
  `quiz_question_admin`.
- **Where it applies:**
  - `adm_insert_options`, used by `create_question`, `create_test` (with
    questions) and `upsert_test_series_full`. That covers wizard saves and
    CSV / AI / paste imports, which all go through the wizard RPC.
  - `update_question`, which rewrites the option when the type is (or becomes) a
    text type, or when `correctAnswer` / `answer` / `modelAnswer` /
    `model_answer` changes.
  - `adm_copy_quiz`, used by `duplicate_test` and `duplicate_test_series`. A
    copied text question with no correct option (for example, one written by the
    lead's app) gets the placeholder.
- **Guards:** `update_question_option` refuses to un-mark that option, and
  `delete_question_option` refuses to delete the last correct option of a text
  question. Without these, a later edit could make the question unpublishable
  again.
- **No model-answer field in the admin UI today.** `modelAnswer` is
  accepted, but the editor never sends it, so subjective questions currently
  get the placeholder.

**2. Go-live is separate from the access window.**
- **The access window only.** `available_from` / `available_until` hold just the
  access window. `adm_set_series_availability` no longer pushes
  `available_from` to `go_live_at`.
- **Go-live** lives only in `test_series_admin.go_live_at`.
- **`adm_publish_test_series`:**
  - A future go-live sets `status = 'scheduled'` and keeps
    `test_series.is_published = false`. Otherwise it sets `published` /
    `is_published = true`.
  - It returns the real `is_published`.
  - Assignment completion and `published_at` wait until the series is actually
    live.
- **`adm_sync_series_to_lead`** publishes only `status = 'published'`. Before,
  it also published `scheduled`.
- **The read model** reports `sa.status` as stored, so a series stays
  `scheduled` until it is released. The old "go_live_at passed → reads as
  published" shortcut is gone. Lead-owned rows without an admin row are no
  longer shown as `scheduled` because of a future `available_from`; that is now
  only the `upcoming` timeline.
- **`adm_ensure_series_admin`** seeds `go_live_mode = 'now'`, because the lead
  has no go-live concept.
- **New `release_scheduled_series() returns int`.** It is SECURITY DEFINER with
  no admin check, revoked from public / anon / authenticated, and granted to
  `postgres`, `service_role` only. For `scheduled`, non-deleted series with
  `go_live_at <= now()`, it:
  - sets `status = 'published'` and fills `published_at`;
  - sets `test_series.is_published = true`;
  - completes approved assignments for their quizzes;
  - returns how many series it released.
- **Batch 3's cron file must schedule `select public.release_scheduled_series();`
  every 5 minutes.** Until it exists, scheduled series stay unpublished, so
  go-live can lag by up to 5 minutes.
- **Preflight** now also checks `adm_text_answer` and `release_scheduled_series`.

**3. Checks**
- `docs/trial_run.sql` was regenerated: `begin;`, then all 20 `20261025*` files
  in order, then `rollback;`. Its last line is `rollback;` (verified).
- SQL parse: 20 migration files and the regenerated `trial_run.sql`, **160
  function/DO bodies, 0 errors**.
- Name coverage: 183 names, 0 missing from the preflights.
- `npm run build` ✅; `npm test` ✅ 7/7.
- Nothing was applied to any database.

---

## Batch 3: commerce stubs, reports, notifications, callbacks, support tickets, cron (written, awaiting review)

### Files written

| File | Contents |
|---|---|
| `supabase/migrations/20261025120000_admin_b3_preflight.sql` | Read-only checks. Aborts if: Batches 1–2 are missing; ~60 lead columns are missing (`notifications`, `support_tickets`, `support_ticket_replies`, `callback_requests` incl. Batch 1 ADDs, `enrollments`, `student_profiles`, `categories`, `profiles`); the `support_tickets` priority / category CHECKs differ from `constraints.csv`; or **pg_cron is not enabled**. Then it collects **every** clash: each overload of all 84 function names, plus the 5 table names, in one error. |
| `20261025120100_admin_b3_tables.sql` | `report_runs`, `notification_campaigns`, `notification_recipients` (delivery and email state, `campaign_id`), `notification_campaign_events`, `callback_activity`. RLS on, no policies, no table grants for anon / authenticated. |
| `20261025120200_admin_rpc_commerce_stubs.sql` | 32 D1 stubs plus 2 helpers (`adm_payments_stub`, `adm_range_options`). |
| `20261025120300_admin_rpc_reports.sql` | Reports Builder: 5 RPCs, 4 per-type helpers, and `purge_expired_report_results` (cron). |
| `20261025120400_admin_rpc_notifications.sql` | Campaigns (D10): 13 RPCs, 5 helpers, plus `dispatch_due_notifications` (cron) and `record_email_results` (service role). |
| `20261025120500_admin_rpc_callbacks.sql` | 7 admin callback RPCs, 3 helpers, and `submit_callback_request` (anon). |
| `20261025120600_admin_rpc_support_tickets.sql` | D11: 7 RPCs and 1 helper over the lead's `support_tickets` / `support_ticket_replies`. |
| `20261025120700_admin_maintenance.sql` | `purge_old_admin_auth_events()`: admin_auth_events older than 180 days, ended user_sessions older than 90 days. |
| `20261025120800_admin_cron.sql` | 5 pg_cron jobs, safe to run twice (see below). |
| `scripts/admin_indexes_concurrently.sql` | +4 lead-table indexes: `notifications` campaign rows (×2), `support_tickets`, `support_ticket_replies`. |
| `src/portals/admin/services/supportTicketsApi.js` | **New** service for the ticket RPCs. |
| `docs/ADMIN_BACKEND_TODO.md` | Batch 3 follow-ups, including the D11 tickets tab. |
| `docs/trial_run.sql` | Regenerated: `begin;`, all 29 files, then `rollback;` (last line verified). |

**Edits to earlier batches** (nothing has been applied):
- **Batch 2 tracker (`20261025110800`).** The detection body moved into
  `adm_detect_repeated_questions()`, which has no admin check and is executable
  by postgres / service_role only, so cron can run it.
  `detect_repeated_questions()` (the admin button) now checks admin, then calls
  it. The Batch 2 preflight lists the new name, and the ROLLBACK is updated.
- **Batch 1 dashboard (`20261025100600`).** The revenue stub and the nav
  `refunds` badge now carry the `STUB: needs payments model (F4)` comment. No
  logic changed.

**Frontend:** service files only. `supportTicketsApi.js` is new. No other
service needed changes; every Batch 3 RPC keeps the archived name and
parameter names. **No page components changed**, and no fields were renamed.

### D1 commerce stubs (each marked `STUB: needs payments model (F4)`)

All of them check admin first and read no tables otherwise. Reads return the
archived keys and columns with zeros, nulls or empty arrays. Writes raise
SQLSTATE `0A000` "… is not available yet: the platform has no payments model
(F4)". Archived enum parameters become `text`.

| Service | Reads (zero / empty, same shape) | Writes (raise 0A000) |
|---|---|---|
| `discountsApi.js` | `list_discounts` (table), `get_discount_stats` {total, active, scheduled, expired, inactive, archived, total_redemptions, total_discount_given_inr}, `get_discount` (null), `get_discount_analytics` {kpis{…5}, active_discounts, daily[], top_discounts[], by_series[], by_offer_type[]}, `list_discount_history` (table), `export_discount_redemptions` (10 columns) | `create_discount`, `update_discount`, `set_discount_status` |
| `transactionsApi.js` | `list_transactions`, `get_transaction_stats` {total_revenue_inr, total_transactions, avg_value_inr}, `get_transaction_filter_options` {educators[], series[], methods[], min/max_amount_inr, first/last_date}, `get_transaction` (null), `export_transactions` (12 columns) | `mark_payment_paid`, `mark_payment_refunded` |
| `refundsApi.js` | `list_pending_refunds`, `list_refund_history`, `get_refund_stats` {pending_count, pending_amount_inr, approved_count, approved_amount_inr, rejected_count, gateway_failed}, `export_refunds` (15 columns) | `request_refund`, `approve_refund`, `reject_refund` (`process` stays the Edge Function placeholder) |
| `financialApi.js` | `get_financial_summary` {range, gross_revenue_inr, transactions, refunds_inr, payouts_paid_inr, net_revenue_inr, platform_fees_inr, pending_payouts_inr, payment_performance{…}}, `get_revenue_trend` (zero buckets), `get_financial_analytics` (summary + trend), `get_financial_range_options` (static) | — |
| `regionalApi.js` | `get_regional_summary` {range, regions_tracked 0, institutions 0, total_revenue_inr 0, top_region null, avg_growth_pct null}, `get_regional_trend` (zero buckets), `get_revenue_by_region` (empty), `list_region_comparison` (empty), `get_regional_filter_options` (All India + ranges) | — |
| dashboard (Batch 1) | `get_dashboard_revenue` (zero buckets), nav `refunds` badge 0 | — |

### Reports (real data; revenue columns = 0)

| Report | Source | Revenue columns |
|---|---|---|
| enrollment | `admin_series_enrollments` plus the lead's `enrollments` for series on a real course (same access model as `adm_series_students`); educators from `adm_series_educators` | `amount_paid_inr` = 0 |
| test_series | `adm_series_rows` (`test_series`, `test_series_admin`, `courses`, `categories`); enrolments from `adm_series_students` | `revenue_inr` = 0 |
| educators | `adm_educator_base` (verification under_review / changes_requested reported as `pending`) plus `test_assignments` | `sales`, `earnings_inr` = 0 |
| students | `profiles`, `student_profiles.grade`, `students.account_status`; enrolments = lead `enrollments` + `admin_series_enrollments` | `total_spent_inr` = 0 |

- **Filter options:** series (`adm_series_rows`), educators, subjects (active
  `categories`) and grades (distinct `student_profiles.grade`).
- **Behaviour:** snapshots expire after 7 days, CSV export goes through
  `log_export`, and blank or `all` filters mean "All".

### Notification campaigns (D10)

- **Tables:** campaigns live in `notification_campaigns`. Publishing fans out
  one row per recipient into the **lead's `notifications`** (`user_id`, mapped
  `category`, `title`, `body`, `action_url`,
  `reference_type = 'notification_campaign'`, `reference_id = campaign id`), plus
  one delivery row in `notification_recipients`.
- **Category map:** announcement → announcement; system, policy, alert → system.
- **Audiences:**
  - learners: students not blocked;
  - educators: admin `account_status` active;
  - admins: admin + super_admin;
  - series_enrolled: `adm_series_students`;
  - selected_users: existing profiles.
- **Opened:** the lead's `is_read`.
- **The bell** (`NotificationsPanel.jsx`, `AdminTopbar.jsx`):
  - `list_notifications` rows add the caller's own `read_at` and `opened_count`.
  - `mark_notification_read(p_id = campaign id)` and
    `mark_all_notifications_read` touch only the caller's campaign rows.
  - `get_my_unread_notification_count` counts unread rows of published
    campaigns.
- **Scheduled campaigns** go out through `dispatch_due_notifications()` (cron,
  every minute). A failure (for example, an empty audience) puts the campaign
  back to draft and logs a `dispatch_failed` event.
- **`record_email_results(p_notification_id, p_results)`** is service-role only,
  for the email Edge Function (Batch 4 updates its embed to
  `notification_campaigns` / `campaign_id`).

### Callbacks (lead `callback_requests`, F7 statuses)

- **Codes (Batch 1 contract):** the public form assigns `CB-<n>` immediately.
  Rows the lead's own site inserts show the fallback `CB-NEW-xxxx` until the
  first admin action (status change or note) assigns a real code.
- **Sources:** the lead's `source` is free text. The four archived keys are
  recognised and anything else reads as `other`.
- **Phone:** search compares digits; display formatting applies to +91 numbers
  only.
- **`submit_callback_request`** is the only anon-callable RPC in this batch. It
  has a honeypot, phone / email / length validation, merges a repeat submission
  from the same phone within 7 days, and throttles to 3 per phone per 24h.
- **Every status change** is written to `callback_activity` and `audit_logs`.

### Support tickets (D11, F7 statuses)

- **RPCs:** stats, list (search / status / category / priority / assignee /
  sort), detail with the full thread (internal notes included), status
  (`resolved_at` set on resolved / closed and cleared on reopen; an optional
  note becomes an internal reply), priority, assign (admins only; null
  unassigns), and reply (public or internal).
- **Audit:** every write is audited.
- **No UI tab.** It needs a page change, so it is listed in
  `docs/ADMIN_BACKEND_TODO.md`.

### Cron (`20261025120800`)

| Job (all `adm_`-prefixed) | Schedule | Command |
|---|---|---|
| `adm_release_scheduled_series` (**required**) | `*/5 * * * *` | `select public.release_scheduled_series()` |
| `adm_dispatch_due_notifications` | `* * * * *` | `select public.dispatch_due_notifications()` |
| `adm_detect_repeated_questions` | `0 2 * * *` | `select public.adm_detect_repeated_questions()` |
| `adm_purge_expired_report_results` | `30 2 * * *` | `select public.purge_expired_report_results()` |
| `adm_purge_old_admin_auth_events` | `0 3 * * *` | `select public.purge_old_admin_auth_events()` |

- **Safe to run twice:** each job is removed with
  `cron.unschedule(jobid) from cron.job where jobname = <ours>`, then scheduled
  again.
- **No lead job is touched:** only these five names are read or changed.
- **No extension is created:** without pg_cron, the preflight (and the cron file
  itself) abort with a clear message.
- **Times are in pg_cron's time zone** (GMT by default): 02:00 GMT = 07:30 IST.
- **The cron-called functions** have no admin check and are executable only by
  `postgres` / `service_role`.

### Lead objects

**Touched by migrations:** none. There is no DDL on lead tables. The cron file
writes `cron.job` rows only for the five `adm_` jobs.

**Written at runtime, through the RPCs only:**
- `notifications`: fan-out inserts, and `is_read` / `read_at` on the caller's
  own campaign rows.
- `callback_requests`: public-form inserts, plus status / contact / close /
  `code` / `updated_at` updates.
- `support_tickets`: status, priority, `assigned_to`, `resolved_at`,
  `updated_at`.
- `support_ticket_replies`: inserts.
- `audit_logs`: inserts.

**Read:** `profiles`, `student_profiles`, `enrollments`, `courses`,
`categories`, `test_series`, `quizzes` (through the read models),
`educator_profiles`, `notifications`, `callback_requests`, `support_tickets`,
`support_ticket_replies`. The preflight also reads `pg_constraint` and
`pg_extension`.

### Assumptions (please confirm)

1. **B3-A1. pg_cron must be enabled before Batch 3.** It is required by Batch 2's
   scheduled go-live. If it isn't, the preflight stops the batch before anything
   is created.
2. **B3-A2. Notification preferences: resolved** in the final pass (section B
   below).
3. **B3-A3. The admin bell lists campaigns**, not every lead notification an
   admin has. This matches the archived contract.
4. **B3-A4. Archiving hides a campaign from the admin list and bell**, but
   recipients' inbox rows stay in the lead's table.
5. **B3-A5. Enrollment report rows.** A course enrolment gives one row per
   series on that course, so `enrollment_id` repeats.
6. **B3-A6. Foreign keys to lead tables.** Our tables have FKs to `profiles`,
   `callback_requests`, `test_series`, `quizzes` and others. This applies to
   Batches 1–3. Postgres implements an FK with *internal* referential-integrity
   triggers on the referenced table (`pg_trigger.tgisinternal = true`), so the
   lead will see them on `profiles` and `callback_requests`. They aren't user
   triggers (F3 / D8 are about user triggers), but confirm with the lead. The
   alternative is to drop the FKs and enforce references in the RPCs. The final
   pass audited every one of them (section A below).
7. **B3-A7. No views.** "Views over lead tables" were written as internal
   SECURITY DEFINER read-model functions (`adm_callback_rows`,
   `adm_ticket_rows`, …). Views in `public` would be exposed through PostgREST.

### Unsupported / not wired after Batch 3

- **Commerce:** every money screen shows zeros, and its actions raise
  `0A000` (D1).
- **Notifications:** no campaign create/edit form. `Notifications.jsx` renders the
  RPC-backed `NotificationsPanel`; the earlier "mock-backed" note was wrong (only
  its header comment is stale).
- **Support tickets:** the tab was added in the final pass (section D).
- **Unused export:** `adminApi.js` still exports an unused `educatorsApi` whose
  parameter names (`p_educator_id`, `p_status`) don't match the Batch 1 RPCs.
  Nothing imports it; `services/educatorsApi.js` is the one in use. It is left
  untouched.

### Checks run

- **SQL parse** (Postgres 17 parser, no database): 29 migration files and the
  regenerated `trial_run.sql`; **248 function/DO bodies, 0 errors**.
- **Name coverage:** 273 names, every one listed in its batch's preflight, none
  defined in two files.
- `npm run build` ✅; `npm test` ✅ 7/7; `npx oxlint src/portals/admin/services` ✅
  no findings.
- No admin service calls `supabase.from(...)`.
- **Not checked:** column names, types and privileges against a real database.
  They still need `npx supabase db push --dry-run` against the lead's project,
  with the lead's approval.
- Nothing was applied to any database.

### Review checklist for Batch 3

- [ ] Enable pg_cron (B3-A1), or accept that the preflight will stop Batch 3.
- [ ] The category mapping (policy / alert → system) and the audience
      definitions.
- [ ] The notification-preferences question (B3-A2).
- [ ] The internal FK triggers on lead tables (B3-A6).
- [ ] The cron times (GMT).
- [ ] Commerce write actions raising `0A000` rather than failing silently.
- [x] Tickets tab on `/admin/supporttickets` (added in the final pass).

---

## Final pass: FK audit, preferences, Batch 4, approved UI work (nothing applied)

The trial run of `docs/trial_run.sql` (`begin … rollback`) succeeded against the
lead's database. Since then, only the unapplied files below were changed.

**Missing inputs:**
- `CLAUDE.md` is empty (0 bytes), so it lists no forbidden commands. The rules
  from the port brief were followed: no `db push`, no `db reset`, no SQL against
  any database, no deploy.
- `COPILOT_PORT_TO_EXISTING_DB.md` doesn't exist in the repository.
- `docs/db_inspection/` has only `constraints.csv` (no `buckets.csv`).

### A. Foreign-key audit

- **Scope:** every FK from our tables to a lead table, 42 in total, checked by a
  scratchpad script (`fkcheck.mjs`).
- **ON DELETE:** each is now CASCADE, or SET NULL on a nullable column.
- **Indexes:** each referencing column is indexed in our own migration, either as
  the primary key, the leading column of a unique constraint or index, or a
  dedicated index.

**Changed ON DELETE (1):**
- `test_assignments.educator_id → profiles`: NO ACTION → **CASCADE**. It's
  NOT NULL, and assignments are our own rows. (`20261025110300`)

**New indexes on lead-FK columns (24):**

| File | Indexes |
|---|---|
| `20261025100400` | `students.blocked_by`, `student_block_history.by_admin`, `educator_invites.user_id`, `educator_invites.invited_by`, `user_geo.institution_id`, `user_sessions.user_id` (full; the existing index was partial on open sessions) |
| `20261025110100` | `test_series_admin.subject_category_id`, `.created_by`, `ai_test_jobs.subject_id`, `.series_id`, `.test_id`, `question_similarity_matches.question_a_id`, `.question_b_id`, `.reviewed_by` |
| `20261025110300` | `series_requests.series_id`, `test_assignments.created_by`, `assignment_comments.question_id`, `.author_id`, `assignment_history.by_user` |
| `20261025120100` | `notification_campaigns.created_by`, `.updated_by`, `notification_recipients.user_id`, `notification_campaign_events.actor_id`, `callback_activity.actor_id` |

Plus two on columns that reference our own tables, for the same reason:
`quiz_question_admin.ai_job_id` and `test_assignments.request_id`. The indexes
on nullable columns are partial (`where col is not null`); equality lookups
during FK actions can still use them.

**Already compliant:** the remaining FKs were already CASCADE / SET NULL with a
PK, unique or leading-column index. `notification_recipients.inbox_notification_id`
deliberately has no FK. Our-to-our FKs `user_geo.state_code → regions` and
`report_runs.report_type → report_types` keep NO ACTION, because lookup rows
must not disappear.

### B. Notification preferences

- **Where:** `adm_publish_campaign` (`20261025120400`) reads the lead's
  `notification_preferences(user_id, category, in_app, email)`.
- **In-app:**
  - `announcement` campaigns skip recipients whose row has `in_app = false`;
  - `system` notices (campaign category system / policy / alert) are always
    delivered.
- **Email:** follows `email` for the mapped category, for both kinds.
- **No preference row:** the column defaults apply (true).
- **No channel left:** a user gets no recipient row. If nobody remains, publishing
  fails with "No recipients … after notification preferences".
- **Counts:** `delivered_count` and `email_queued` are real counts.
- **Preflight:** checks the four preference columns.
- **At send time:** `send-notification-emails` re-checks `email`.

### C. Batch 4: frontend roles and Edge Functions (nothing deployed)

**Roles (D13):**
- `src/utils/roles.js` maps `super_admin → admin` and adds `ADMIN_DB_ROLES`,
  `isAdminDbRole` and `canUseAdminPortal`.
- `AuthContext` keeps `dbRole`.
- `AdminLayout` uses `canUseAdminPortal`.
- The Edge Functions' `_shared/auth.ts` `requireAdmin` accepts admin and
  super_admin through the new dependency-free `_shared/roles.ts`. `auth.ts` also
  gains `requireServiceRole`.
- **Tests:** `tests/admin-roles.test.jsx` adds 4 (mapping, portal check, Edge
  role check, `AdminLayout` rendering for a super_admin).

**Edge Functions:**

| Function | Change |
|---|---|
| `create-educator-invites` | Rewritten. `create_educator_invites` de-duplicates (existing profile or open invite → `skipped`). Then `inviteUserByEmail` (an existing auth user → `failed: An account with this email already exists in Auth.`). Then the service-role `register_educator`, which inserts `profiles` (role educator), `educator_profiles` (phone or `''`, `Not provided`, `pending`, 0 / 0) and `educator_admin_state`. If registration fails, the auth user is deleted again. Returns `{created, skipped, failed, results[]}`. It never writes `under_review`. |
| `revoke-user-sessions` | Uses the `revoke_user_sessions` RPC, plus Admin API `signOut` for the caller's own token (`scope` global / others). **Gap:** `signOut` needs the target user's access token, so another user's refresh tokens can't be revoked with it. The response says `tokens_revoked: false`. No SQL touches the auth schema. |
| `send-notification-emails` | Resend through `fetch` (`RESEND_API_KEY`, `EMAIL_FROM`). Reads `notification_campaigns` / `campaign_id`, re-checks the email preference (opted-out rows become `not_requested`), and records results with `record_email_results`. Auth: service-role bearer, or `x-cron-secret`. |
| `sign-educator-document` (new) | Admin check, then a service-role signed URL for `educator_verification_docs.doc_url` (by `documentId` or `path`; only paths in that table). The bucket comes from **`EDUCATOR_DOCS_BUCKET`** (no `buckets.csv`), unless `doc_url` is a full storage URL. A non-storage URL is returned unchanged. |
| `payment-webhook`, `process-refund`, `ai-generate-test` | Unchanged placeholders. `payment-webhook` would hit the D1 stubs (`0A000`); `process-refund` reads `refund_requests`, which doesn't exist. |
| `supabase/config.toml` | Entries for all 7 functions. `verify_jwt = false` only for `payment-webhook` (`send-notification-emails` changed to true). |

**Frontend service changes:**
- `educatorsApi.createInvites` throws the per-row reasons when nothing was
  created, so duplicates reach the existing toast.
- `educatorsApi.signedDocumentUrl` calls `sign-educator-document` instead of
  `storage.from("educator-documents")`, a bucket name that was never verified.
- `docs/EDGE_FUNCTIONS.md` is rewritten (secrets, deploy, scheduling).

### D. Approved admin UI work

- **`TestPerformanceAnalytics.jsx`:** the `lbSeries` bug was **not** fixed
  before. It is fixed now: the `useState` moved above its first use. No other
  change.
- **`TestDetail.jsx`:** it was still on mock data and is now wired.
  - It loads with `testSeriesApi.get`, and saves through `createQuestion`,
    `updateQuestion`, `deleteQuestion`, `setTestStatus` and `publishSeries`.
  - The mock module is now imported only for constants and the pure readiness
    checks. The series check gets `availability.mode`, so always-open series
    aren't flagged for missing dates.
  - A **Model Answer** field is added to the Subjective form, which the API maps
    to short_answer / fill_blank / long_answer. It is sent as `modelAnswer` and
    becomes the single correct option; blank means the manual-grading
    placeholder. Edits keep the stored type (no `type` key).
  - `testSeriesApi.mapQuestion` now returns `storedType` and `modelAnswer`.
  - The layout is unchanged apart from that one form row, a loading state and
    the save button disabling while saving.
- **`SupportTickets.jsx`:** tabs "Callback Requests" (the existing UI, unchanged,
  moved into `CallbacksTab`) and "Support Tickets" (`TicketsTab`). The tickets
  tab has stats, search, status / priority / category filters, pagination and a
  detail modal: the thread with internal notes, reply or internal note, status,
  priority, and assign to me. It reuses the same classes (`ul-tabs`, `ul-stats`,
  `ul-set-*`, `ul-audit-modal`).

**Pages importing `../data/*Mock`:**

| Kind | Pages |
|---|---|
| Intentionally mock (as agreed) | `CourseApproval`, `RegionalHeads`, `RegionalHeadActivity`, `RegionalHeadInvite`, `RegionalHeadTeam`, `Escalations`, `ContentModeration`, `SettingsPermissions`, `InstitutionManagement`, `RegionBranchHierarchy`, `ManagementDashboards`, `AITestBuilder` |
| RPC-backed, mock import is constants / pure helpers only | `AssignEducators`, `EducatorVerification` (`SUBJECT_OPTIONS`), `TestSeries`, `TestSeriesDetail`, `TestSeriesTracker`, `TestSeriesWizard`, `TestSeriesWizardParts`, `TestDetail`, `discounts/DiscountsShared` (labels, `can`) |
| **Still reading / writing mock data (not in the agreed list)** | `UserManagement` (`useOnboardedBy`: "onboarded by" column), `discounts/DiscountOverview` and `discounts/DiscountHistory` (`useDiscountState`; commerce is a D1 stub anyway), `components/BulkImportTeachers` (`addEducator`: bulk import writes to the mock), `components/AdminTopbar` (`startRegionalHeadSync`) |

### E. Checks

- `docs/trial_run.sql` was regenerated: `begin;`, all 29
  `20261025*_admin_*.sql` files in order, `rollback;`. The last line was
  verified to be `rollback;`.
- **SQL parse** (Postgres 17 parser, offline): migrations and `trial_run.sql`,
  **248 function/DO bodies, 0 errors**.
- **Name coverage:** 273 / 273.
- **FK audit:** 42 / 42.
- `npm run build` ✅; `npm test` ✅ **11/11** (7 existing + 4 new).
- `oxlint` on changed files: no errors; the warnings are in unchanged code.
- **Re-run needed:** the trial run must be repeated, because files changed
  after the successful one (see `docs/PUSH_RUNBOOK.md`).

### F. Push runbook

`docs/PUSH_RUNBOOK.md` has:
- **The commands to run:** link, before-snapshot, trial re-run, migration list,
  dry run, push, the index script, verification, after-snapshot diff, and the
  cron health check.
- **The rollback order:** 16 steps, newest file first, then
  `migration repair --status reverted`, only with the lead.

New read-only scripts:
- **`scripts/admin_verify_push.sql`**, generated from the migrations (30 tables,
  6 sequences, 237 function names). It checks:
  - every object exists;
  - RLS is on for every one of our tables;
  - no anon / authenticated table privileges;
  - no anon execute except `submit_callback_request`;
  - no internal or server-only function is callable by authenticated;
  - `search_path` is pinned and RPCs are SECURITY DEFINER;
  - the lead's `publish_test_series(uuid, boolean)` md5 is unchanged;
  - the 5 cron jobs and the house course exist.
- **`scripts/admin_snapshot_lead.sql`**, a before / after fingerprint of public
  functions, columns, constraints, RLS flags, policies, user triggers, grants and
  `cron.job`. Rule: `diff … | grep '^<'` must print nothing.

Both scripts parse offline. The things `admin_verify_push.sql` checks against
the database were also checked statically against the source:
- every `adm_*` helper and server-only function is revoked from authenticated;
- all 237 function definitions pin `search_path`;
- every non-`adm_` function is SECURITY DEFINER.

SQL editor versions (the runbook now uses these; the psql originals are kept):
- **`scripts/admin_verify_push_editor.sql`**, generated from the same name lists.
  It is one statement with no psql meta-commands, returning 14 rows of
  `check_name`, `status` (`PASS` / `FAIL`) and `detail`.
- **`scripts/admin_snapshot_lead_editor.sql`** is one statement returning one row
  per object (`kind`, `name`, `hash`), sorted, for CSV export and diffing. It
  adds a `lead_function_def` row with the `publish_test_series(uuid, boolean)`
  md5 that verify check 9 prints.
- **`scripts/admin_indexes_concurrently.sql`**: the header now says to run each
  statement separately (the editor wraps a multi-statement run in one
  transaction). The trigram index already uses `extensions.gin_trgm_ops`.

All three parse offline as 1, 1 and 15 statements, and no line starts with a
backslash.

**GATE: ready for the human trial run and push.**

## Student onboarding after Google sign-in (2026-10-26)
- New: `src/portals/student/pages/StudentOnboarding.jsx` (3 steps: Basics, Details, Interests; skippable), `src/portals/student/utils/onboarding.js`.
- `/student/onboarding/*` now renders the wizard for signed-in students (was a redirect to /student/account). Signed-out still goes to /register.
- `AuthCallback` sends a student whose Google account was just created (first sign-in) and who has no profile details (no grade, school, phone or city) and no prior skip to onboarding, then to `?redirect=` or the dashboard.
- Saves through the existing `profileApi.save` (profiles + student_profiles, own row, existing RLS). No migrations, no new columns. "Skipped" is a localStorage flag (`ul.onboarding.skipped.<userId>`).
- Not collected (no column): parent phone, learning goal, ID upload.
