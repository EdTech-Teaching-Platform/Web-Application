# Educator RPC contract

This is the database contract for the teacher portal (`/teacher`). Every RPC
works like this:

- It is a `SECURITY DEFINER` function, called with `supabase.rpc(name, params)`
  under the signed-in user's JWT.
- The user is always `auth.uid()`. No RPC takes a user id.
- It is granted to `authenticated` and revoked from `anon` / `public`.
- Errors carry a SQLSTATE. The message is safe to show as is.

| SQLSTATE | Meaning |
|---|---|
| `42501` | Not allowed: not signed in, not an educator, not verified, or the application is locked while under review |
| `22023` | Invalid input. Form RPCs put `{field: message}` JSON in `error.details` |
| `P0002` | Not found (a document, an uploaded file) |
| `23505` | Clash, e.g. "An account with this email already exists." |

> `EDUCATOR_PORTAL_PLAN.md` is not in the repository. The decisions below come
> from the implementation briefs (2026-10-28).

## Who can call what

| Group | RPCs | Guard |
|---|---|---|
| **Onboarding** (any educator, any status) | `educator_start_onboarding`, `educator_save_onboarding_step`, `educator_register_document`, `educator_remove_document`, `educator_submit_onboarding`, `educator_get_status`, `educator_get_onboarding` | `adm_require_educator()`: `profiles.role = 'educator'`. `educator_start_onboarding` needs only a signed-in user. |
| **Everything else** named `educator_*` | Later briefs | Must start with `perform public.adm_require_verified_educator();` |

`adm_require_verified_educator()` requires all four of (since `20261029090000`):

- the role is `educator`;
- `educator_admin_state.review_state = 'approved'` (our table; only `set_educator_verification` writes it);
- `educator_profiles.verification_status = 'verified'` (never enough alone: the lead's RLS lets educators edit their row);
- `educator_admin_state.account_status = 'active'` (the row is required).

`supabase/tests/educator_onboarding.sql` checks every `educator_*` function in
the database:

- a pending educator gets `42501` from each verified-only function;
- each verified-only function's body starts with that guard;
- a student gets `42501` from every `educator_*` function.

`adm_is_educator()` and `adm_is_verified_educator()` return booleans about the
caller and are granted to `authenticated`. Edge Functions call them with the
user's JWT, as `adm_is_platform_admin` is called.

## Status object

`educator_get_status()`, `educator_start_onboarding()` and
`educator_submit_onboarding()` return:

```json
{
  "status": "draft | pending | under_review | changes_requested | verified | rejected | suspended",
  "note": "admin's note for changes_requested / rejected, the reason for suspended, else null",
  "submitted_at": "2026-10-28T09:12:00Z | null",
  "can_edit": true,
  "profile_complete": false
}
```

| `status` | When | `can_edit` |
|---|---|---|
| `suspended` | `educator_admin_state.account_status` is `inactive`, `suspended` or `deleted` (checked first) | false |
| `verified` | `educator_profiles.verification_status = 'verified'` | false |
| `rejected` | `verification_status = 'rejected'`; `note` = `rejected_reason` | true (resubmit) |
| `changes_requested` | `review_state = 'changes_requested'`; `note` = `review_note` | true |
| `under_review` | `review_state = 'under_review'` | false |
| `draft` | not submitted yet (`review_state = 'draft'`) | true |
| `pending` | submitted, or invited by an admin | false |

`profile_complete` is true when every form field is valid and both ID pictures
(`government_id` front and back) are uploaded.

The lead's `verification_status` only ever holds `pending`, `verified` or
`rejected`. The finer state is `educator_admin_state.review_state`: `draft`,
`submitted`, `under_review`, `changes_requested`, `approved` or `rejected`.

## RPCs

### `educator_start_onboarding(p_full_name text, p_phone text default null) → status`

Call it right after sign-up (email / password or Google).

- **No profile:** creates `profiles` (role `educator`, email from
  `auth.users`), `educator_profiles` (`verification_status 'pending'`,
  `location 'Not provided'`), `educator_admin_state` (`review_state 'draft'`,
  `onboarded_via 'self'`) and the draft. The name must be 2 to 120 characters;
  a phone, if given, must be valid.
- **The profile has another role:** `42501` "This email is registered as
  student. Use a different email to register as an educator." The role is never
  changed.
- **An educator already:** idempotent; changes nothing and returns the status.
- **Another profile already uses the email:** `23505`.

### `educator_save_onboarding_step(p_step int, p_data jsonb) → onboarding`

Saves one step of the form as a draft. `educator_profiles` is not touched until
submit. The steps are:

| `p_step` | Fields in `p_data` | Rules |
|---|---|---|
| 1 Personal | `full_name`, `phone`, `location` | name 2–120 with a letter; phone `^\+?[0-9 ()-]{7,20}$` with 7–15 digits; location 2–120 |
| 2 Qualifications | `qualifications`, `experience_years` | 2–500 characters; whole number 0–60 (number or digit string) |
| 3 About | `subjects[]`, `languages[]`, `bio` | 1–20 subjects (≤ 60 each), 1–10 languages (≤ 40 each), bio 50–1000 |
| 4 Documents, 5 Review | — | nothing to save; advances `step` |

- **Stored values:** trimmed. Arrays are de-duplicated with their order kept.
  Keys not in the step are ignored.
- **Errors:**
  - an invalid field: `22023` "Check the highlighted fields.", with
    `details = {"phone": "Enter a valid phone number (7 to 15 digits).", …}`.
    Nothing is saved.
  - the application can't be edited (pending, under review or verified):
    `42501`.
- **`step`:** keeps the furthest step reached, so `max(step, p_step)`.

### `educator_register_document(p_doc_type text, p_path text, p_doc_name text) → document`

Call it after uploading through the `educator-upload-url` Edge Function.

| `p_doc_type` | `p_doc_name` |
|---|---|
| `government_id` | `front` or `back` (the ID pictures; case-insensitive) |
| `other` | `selfie`, or a label |
| `degree_certificate`, `teaching_license`, `experience_letter`, `subject_certificate` | a label: `^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,119}$` |

- **Path:**
  - `p_path` must be `<auth.uid()>/<file>` with a file name of
    `[A-Za-z0-9._-]{1,200}` and no `..`, else `42501`;
  - the object must exist in `storage.objects`, else `P0002` "The uploaded file
    was not found. Upload it again.";
  - it is stored as `doc_url`, the plain storage path that
    `sign-educator-document` signs in `EDUCATOR_DOCS_BUCKET`.
- **One row per `(doc_type, doc_name)`:** uploading again replaces that row's
  file, `created_at` and review (status back to `pending`). Older duplicates
  are deleted. The old storage file is not deleted.
- **The stored file** (`storage.objects.metadata`) must be at most 5 MB, and
  a JPEG, PNG or WebP image (a PDF only for the four certificate types),
  else `22023`. The signed upload URL can't enforce these.
- **Limits and locks:**
  - at most 20 documents per educator;
  - `42501` when the application can't be edited.

```json
{ "id": "uuid", "doc_type": "government_id", "doc_name": "front", "path": "<uid>/government_id-front-1730100000.jpg",
  "file_name": "government_id-front-1730100000.jpg", "status": "pending | approved | rejected", "note": null,
  "uploaded_at": "2026-10-28T09:00:00Z" }
```

### `educator_remove_document(p_document_id uuid) → onboarding`

- Deletes one of the caller's documents. The storage file stays.
- Only while the application can be edited; `P0002` if it isn't theirs.

### `educator_submit_onboarding() → status`

Allowed when `can_edit` is true: a draft, `changes_requested` or `rejected`
(resubmission).

- **Checks:** every field of steps 1–3 (from the draft, falling back to
  `educator_profiles`), and both ID pictures. On failure it raises `22023`
  "Complete every step before you submit." with `details` listing the fields,
  plus `documents` when an ID picture is missing. A selfie and certificates are
  optional.
- **Writes:**
  - `educator_profiles`: `full_name`, `phone`, `location`, `qualifications`,
    `experience_years`, `subjects`, `languages`, `bio`, and
    `verification_status = 'pending'`. No other verification field is touched.
  - `profiles`: `full_name`, `phone`, `location` of the caller's own row.
  - `review_state = 'submitted'` and `submitted_at = now()`.
  - an audit row, `educator.onboarding_submit`.

### `educator_get_status() → status`

Always callable by an educator, whatever the status. It powers the portal gate
and the pending screen.

### `educator_get_onboarding() → onboarding`

```json
{
  "step": 3,
  "data": { "full_name": "Asha Rao", "phone": "+91 98765 43210", "location": "Pune", "qualifications": "MSc Physics",
            "experience_years": 7, "subjects": ["Physics", "Maths"], "languages": ["English", "Hindi"], "bio": "…" },
  "documents": [ /* document objects, no signed URLs */ ],
  "status": { /* status object */ }
}
```

`data` is the draft over the saved profile. `location` is omitted while it is
the `Not provided` placeholder.

### Upload slots: `adm_claim_educator_upload_slot(p_doc_type text, p_limit int default 20) → {allowed, remaining, retry_after_seconds}`

- Used by the `educator-upload-url` Edge Function with the caller's JWT. See
  `docs/EDGE_FUNCTIONS.md` for the whole upload flow.
- Each call claims one slot for the caller, up to `p_limit` per rolling hour.
- `42501` "Educators only." for anyone without the educator role.

## Admin side

These are the existing RPCs; `20261028090200` adjusted them.

- **`list_educators(p_verification => …)`:**
  - `pending` lists submitted applications (`pending`, `under_review`,
    `changes_requested`);
  - drafts that were never submitted have `verification_status = 'draft'` and
    are listed only with `p_verification = 'draft'`;
  - `get_educator_stats.pending_verification` doesn't count drafts.
- **`get_educator_detail(p_id)`:** `educator` also has `review_state`,
  `submitted_at` and `onboarding_step`. `documents` lists the uploaded files:
  `file_path` is the storage path; sign it with `sign-educator-document`.
  `history` includes submissions.
- **`set_educator_verification(p_id, p_decision, p_note)`:**

  | Decision | Writes | Notifies |
  |---|---|---|
  | `verified` / `approved` | `verification_status 'verified'`, `verified_at`, `verified_by`, `rejected_reason` cleared, `review_state 'approved'` | yes |
  | `rejected` (note required) | `verification_status 'rejected'`, `rejected_reason`, `review_state 'rejected'` | yes |
  | `changes_requested` (note required) | lead `pending`, `review_state 'changes_requested'` | yes |
  | `under_review` | lead `pending`, `review_state 'under_review'` | no |
  | `pending` | lead `pending`, `review_state` null | no |

  **The notification** goes into `notifications`:
  - `category 'verification'`, `reference_type 'educator_verification'`,
    `reference_id` = the educator, `action_url '/teacher'`;
  - only when the status changes;
  - skipped, without failing the decision, when the educator turned off in-app
    `verification` notifications, or when the lead's CHECK / FK refuses the row.

## Objects

- **Tables (ours):**
  - `educator_onboarding (user_id pk → profiles ON DELETE CASCADE, step 0..5, data jsonb, updated_at)`;
    RLS on, no policies, no grants.
  - `educator_admin_state`: adds `submitted_at`; the `review_state` CHECK now
    allows `draft`, `submitted`, `under_review`, `changes_requested`,
    `approved` and `rejected`.
- **Internal helpers** (revoked from browser roles): `adm_require_educator`,
  `adm_require_verified_educator`, `adm_educator_validate`,
  `adm_educator_clean`, `adm_educator_form`, `adm_educator_documents_json`,
  `adm_educator_status_json`, `adm_notify_educator_verification`.
- **Migrations:** `20261028090000_educator_preflight.sql`,
  `20261028090100_educator_onboarding.sql`,
  `20261028090200_educator_admin_review.sql`.
- **Rollback:** `scripts/rollback_20261028_educator_onboarding.sql`.
- **Trial:** `docs/trial_run_20261028_educator.sql`.

---

# Test series for educators

The migrations are `20261028100000`–`100400`, rolled back by
`scripts/rollback_20261028_educator_series.sql`.

Educators use the **same** authoring RPCs as admins, with the same names,
parameters and result JSON (see `testSeriesApi.js`). Only the first line of each
function changed. It used to be `adm_require_admin()` and is now one of the
guards below, so there is a single implementation for both roles.

## Who can do what

| Guard | Passes for |
|---|---|
| `adm_require_author()` | an admin, or a verified educator |
| `adm_require_series_access(series, write)` | an admin; or a verified educator who **created** the series (`test_series_admin.created_by`) or holds an **active assignment** on it (a `test_assignments` row with status not `cancelled` / `rejected`). While the series is `pending_approval`, the educator can read it but not change it. |
| `adm_require_series_owner(series)` | an admin, or the educator who created it |

Anyone else gets `42501`, with "Admin access required." for non-educators, as
before.

| RPC | Guard |
|---|---|
| `list_test_series`, `get_test_series_stats` | author. An admin sees every series; an educator sees only their own and assigned series. An educator's list rows drop `course_educator_id` and `created_by`. |
| `get_test_series`, `duplicate_test_series` | access (read) |
| `series_name_exists`, `create_test_series` | author |
| `upsert_test_series_full`, `save_wizard_draft` | author for a new series (`id` null), else access (write) |
| `update_test_series` | access (write) |
| `delete_test_series`, `discard_wizard_draft` | owner |
| `create_test`, `update_test`, `delete_test`, `duplicate_test`, `set_test_status` | access (write) on the test's series |
| section, question and option create / update / delete | access (write) on the series |
| `adm_publish_test_series(p_id, p_publish)` | access (write), plus the publishing rule below |

- **Series origin:** a series created by an educator has
  `test_series_admin.origin = 'educator'` and `created_by` = the educator. It is
  on the hidden house course, like admin series.
- **Educator responses** never include per-student data, payments, other
  educators' assignments or admin notes.
- **Review fields:** `list_test_series` rows and the `get_test_series` object also
  carry `origin` (`admin` / `educator`), `rejection_reason`, `submitted_at` and
  `approved_at`, for every caller.
- **`adm_actor_kind()`** returns `admin`, `educator` or null for the caller
  (granted to `authenticated`).

## Publishing rule

| Series | Who publishes it |
|---|---|
| **Independent** (`origin 'educator'`, no active assignment) | Only `approve_educator_series`. `adm_publish_test_series(…, true)` and `upsert_test_series_full(…, true)` raise `42501` "This series was created by an educator: it is published when an admin approves it (Submit for approval)." for everyone. `set_test_status(…, 'published')` is refused for the educator until the series is approved. |
| **Assigned** (an admin series assigned to the educator) | The educator, directly with `adm_publish_test_series`. That also sets their open assignment on it to `completed`, with history row "Completed / Published by the educator." |

## Approval

The status flow is: `draft` / `rejected` → `pending_approval` → `published`
(or `scheduled`) on approval, or `rejected` with a reason.

### `educator_submit_series_for_approval(p_series_id uuid)` → `{series_id, status: "pending_approval", submitted_at}`

- **Who:** the owner. The series must be independent (an assigned series
  raises `22023` "publish it directly"), and its status `draft` or `rejected`.
- **Checks** (as publish, without publishing):
  - the closing time is after the opening time;
  - every test has questions;
  - every question has a correct answer;
  - there is at least one test;
  - no short / long / subjective question.

  The first problem is raised with `22023` and the publish message.
- **On success:** status `pending_approval`, `submitted_at`, and an audit row
  `test_series.submit_for_approval`.

### `list_pending_series_approvals(p_search, p_page = 1, p_size = 10)` (admin)

Returns `(row_data jsonb, total_count bigint)`. `row_data` looks like:

```json
{ "id": "uuid", "title": "…", "code": "TS-1042", "submitted_at": "…", "educator_id": "uuid", "educator_name": "…",
  "educator_email": "…", "subject_name": "…", "audience": "…", "pricing": "free", "price_inr": 0,
  "test_count": 3, "question_count": 75, "created_at": "…" }
```

The search covers title, code, educator name and email. Rows are oldest
submission first.

### `approve_educator_series(p_series_id uuid)` → `{series_id, is_published, tests, status}` (admin)

- Only from `pending_approval`.
- Sets `approved_by` / `approved_at`, then publishes through
  `adm_publish_series_core`, the body `adm_publish_test_series` uses. A future
  go-live gives `scheduled`.
- Notifies the educator (`notifications`: category `moderation`,
  `reference_type 'educator_series'`, `reference_id` = the series,
  `action_url '/teacher/test-series'`).

### `reject_educator_series(p_series_id uuid, p_reason text)` → `{series_id, status: "rejected", rejection_reason}` (admin)

- The reason is required (`22023`). Only from `pending_approval`.
- Notifies the educator. They can edit the series and submit it again.

## Editing published content (admins and educators alike)

- **Allowed in place** on a question students have answered:
  - question text, explanation, marks, negative marks;
  - option texts and which options are correct.

  `update_question` with options edits the existing options in order and keeps
  their ids. `update_question_option` may now change `is_correct`.
- **Still refused** (`22023` / `23503`):
  - adding or removing options (by `update_question` with a different number
    of options, `create_question_option`, `delete_question_option`);
  - deleting the question;
  - changing its type.
- **Re-scoring:** when the marks, negative marks or correct answer change, the
  quiz is re-scored by `adm_regrade_quiz(quiz)`:
  - `quiz_answers.is_correct` / `points_earned`;
  - `quiz_attempts.score` / `max_score` / `percentage` / `passed`;
  - the stored `attempt_reports` (same format, plus `regraded_at`), for every
    submitted / timed-out attempt that has a report from this port. Ranks and
    class averages are recomputed.

  Attempts finished by the lead's own app (no report) are not touched.
- **Result:** `update_question` and `update_question_option` return their
  usual JSON plus `"regraded_attempts": n`. For the UI warning "Changing a
  correct answer re-scores N submitted attempts", use the test's `attempts`
  (from `get_test_series`).
- **Audit:** every edit has before / after state (`question.update`,
  `question.option_update`), plus `test.regrade` with the count.

## Assignments (verified educators)

| RPC | Returns |
|---|---|
| `educator_list_assignments(p_status text default null)` | An array of the caller's assignments: the `adm_assignment_rows` keys (`id, code, series_id, series_name, subject, topics, test_name, question_count, question_type_mix, difficulty, total_marks, duration_minutes, instructions, assigned_date, deadline, status, display_status, progress, submitted_at, overall_feedback, decision, decision_at, decision_reason, cancel_reason, request_id, test_id, created_at`), plus `series_status` and `comment_count`. `p_status`: null / `all`, `open`, `overdue`, or a status. |
| `educator_get_assignment(p_assignment_id)` | `{assignment, series: {id, title, status, code}, test: <adm_test_json> or null, history: [{action, note, at, by_me}], comments: [{id, comment, question_id, question_ref, created_at, from: "me" or "admin"}]}`. `P0002` if it isn't theirs. |
| `educator_start_assignment(p_assignment_id)` | Moves `assigned` to `in_progress`, with history "Started". The first time, it creates the test with `create_test` (`test_name`, `instructions`, `duration_minutes`, `total_marks`, `question_count`, `topics`). Idempotent. Returns the assignment object. |
| `educator_add_assignment_comment(p_assignment_id, p_comment, p_question_id default null)` | `{id, comment, question_id, from: "me", created_at}`. The comment is 1–2000 characters; the question must belong to the series. |

The educator builds and publishes with the shared RPCs. Publishing completes
the assignment.

## Profile, stats, dashboard (verified educators)

- **`educator_get_profile()`** returns:
  - `{id, email, educator_code, full_name, phone, location, bio, photo_url, qualifications, experience_years, subjects, languages, verification_status, verified_at, rating_avg, joined_at}`;
  - `documents: [{doc_type, doc_name, status, uploaded_at}]`, with no files or
    paths.
- **`educator_update_profile(p_fields jsonb)`**:
  - accepts only `bio`, `qualifications`, `experience_years`, `subjects`,
    `languages`, `phone`, `location` and `photo_url`; any other key raises
    `42501`;
  - fields use the onboarding rules, and a failure is `22023` with `details`
    holding only the fields sent;
  - `photo_url` must be a path in the caller's folder (`<uid>/<file>`);
  - returns the profile and is audited (`educator.profile_update`);
  - never touches the role or verification fields.
- **`educator_get_stats()`** covers the educator's own and assigned series:

  ```json
  { "series": {"total": 4, "by_status": {"draft": 1, "published": 2, "pending_approval": 1}},
    "tests": 9, "questions": 210, "learners": 130, "attempts": 412, "average_score": 61.4, "pass_rate": 58.2,
    "per_series": [{"series_id": "uuid", "title": "…", "status": "published", "attempts": 300, "average_score": 63.1, "pass_rate": 60}],
    "trend": [{"week": "2026-08-10", "attempts": 12, "average_score": 55.0}],
    "assignments": {"open": 2, "due_soon": 1, "overdue": 0, "completed": 5},
    "ratings": {"count": 18, "average": 4.22, "distribution": {"1": 0, "2": 1, "3": 2, "4": 6, "5": 9}} }
  ```

  - `learners` counts the distinct students who attempted or are enrolled;
  - `trend` covers the last 12 weeks;
  - `ratings` come from `test_feedback` (kind `feedback`);
  - no student ids, names or emails, and no earnings (payments are on hold).
- **`educator_get_dashboard()`** returns:
  - `assigned`: the next 5 open assignments
    `{id, code, test_name, series_id, series_name, deadline, status, display_status, progress}`;
  - `drafts`: the last 5 `draft` / `rejected` own series
    `{id, title, status, rejection_reason, updated_at}`;
  - `pending_approval`: `[{id, title, submitted_at}]`;
  - `published_count`;
  - `recent_activity`: the caller's last 10 audit actions
    `{action, target_type, target_id, at}`;
  - `stats`: `{learners, attempts, average_score, pass_rate, series, assignments, rating}`.
