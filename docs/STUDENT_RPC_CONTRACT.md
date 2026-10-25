# Student RPC contract

The student portal reaches test series, attempts and reports **only** through
these RPCs. They are defined in `supabase/migrations/20261026100200`–`100400`
(preflight `100000`, tables `100100`).

How to call them:
- Call them with `supabase.rpc(name, params)`.
- Every function returns **one `jsonb` value**.
- Keys are stable; new keys may be added, but existing keys won't be renamed.

The shapes below were captured from a real run of the migrations: PGlite, an
in-memory Postgres, with the fixtures in `supabase/tests/student_rpcs.sql`.

## Rules every RPC follows

- **Who the caller is:** the student is always `auth.uid()`. No RPC takes a
  student id.
- **Who can call:** only `public_list_series` and `public_get_series` are open
  to anon. Everything else is for signed-in users only; anon gets `42501`
  (permission denied).
- **What is never returned:**
  - correct answers or explanations before submission;
  - options for fill-in-the-blank or short-answer questions, because for those
    types the options are the accepted answers;
  - any other student's identity.
- **Which series are visible.** A series is *live* when:
  - `test_series.is_published` and `is_active` are true;
  - its admin status is `published` (or it has no admin row);
  - it isn't deleted, and `available_until` hasn't passed.

  A test is visible when its `quiz_admin.status` is `published` (or it has no
  admin row).
- **What enrolment means.** A student has *access* to a series when either:
  - they have a direct enrolment (`admin_series_enrollments`, not revoked, not
    expired); or
  - they are enrolled in the series' course (`enrollments.is_active`, not
    expired). The hidden house course never counts.
- **Server clock:** deadlines use the server clock. Responses carry
  `server_now`, so the client can correct for its own clock being off.

### Errors

The browser receives `error.code` (the SQLSTATE) and `error.message` (a
human-readable sentence you can show the user).

| SQLSTATE | Meaning | Examples |
|---|---|---|
| `42501` | Not signed in, not allowed, or not enrolled | "Sign in to continue.", "Enrol in this test series to take its tests.", "Your account is blocked. Contact support.", "Your access to this series was revoked. Contact support." |
| `P0002` | Not found, or not yours (same error on purpose) | "Test series not found.", "Test not found.", "Attempt not found.", "No detailed report is available for this attempt." |
| `P0001` | A rule blocks the action | "You have used all 2 attempts for this test.", "Time is up for this attempt.", "This attempt has already been submitted.", "This attempt has not been submitted yet.", "This test opens at …", "This test has closed.", "This test has no questions yet.", "Your profile is not set up yet…" |
| `22023` | Bad input | "Question is not part of this test.", "Unknown option for this question.", "Unknown proctor event: …" |
| `0A000` | Not available yet | "Paid test series cannot be bought yet." (STUB: needs payments model, F4) |

## Shared shapes

### Series card

Returned by `public_list_series`, `student_list_series` items, and
`recommended_series`, and used as the base of `public_get_series`,
`student_get_series` and `student_my_series` items.

```json
{
  "id": "uuid", "title": "text", "description": "text|null",
  "subject": "text|null", "category_id": "uuid|null", "level": "text|null", "exam": "text|null",
  "pricing": "free|paid", "price_inr": 0, "is_free": true,
  "cover_path": "text|null", "available_from": "timestamptz|null", "available_until": "timestamptz|null",
  "access_days": "int|null",
  "tests_count": 2, "questions_count": 5, "total_duration_mins": 40
}
```

Signed-in callers also get `"is_enrolled": bool` and `"attempts_count": int`.
All counts cover published tests only.

---

## Anon catalogue

### `public_list_series(p_limit int = 10)` → `card[]`
- **Who:** anon and signed-in users.
- **What:** the newest live series. `p_limit` is clamped to 1–50.
- **Keys:** the public card only, with no enrolment keys.

### `public_get_series(p_series_id uuid)` → `card + {instructions, tests[]}`
- **Who:** anon and signed-in users.
- **Error:** `P0002` if the series isn't live.

```json
"tests": [{ "id": "uuid", "title": "text", "description": "text|null", "position": 1,
            "time_limit_mins": 30, "questions_count": 4, "total_marks": 9,
            "max_attempts": 2, "passing_percentage": 50 }]
```

## Series (signed in)

### `student_list_series(p_search text = null, p_category uuid = null, p_page int = 1, p_size int = 12)`
- **Search:** `p_search` matches the title, description, subject, exam or
  category. `%` and `_` are taken literally.
- **Filter:** `p_category` is a `categories.id`.
- **Paging:** `p_size` is clamped to 1–50.

```json
{ "items": ["card + is_enrolled + attempts_count"], "total": 1, "page": 1, "size": 12, "total_pages": 1,
  "categories": [{ "id": "uuid", "name": "text" }] }
```

`categories` lists the categories of every live series, for the filter
dropdown.

### `student_get_series(p_series_id uuid)`
- **Visibility:** the series is visible when it's live, or when the caller is
  enrolled (so access continues after it ends).
- **Error:** `P0002` otherwise.

```json
{ "...card", "is_enrolled": true, "attempts_count": 0, "instructions": "text|null",
  "enrollment": { "enrolled_at": "…", "expires_at": "…|null", "source": "direct|course" } ,
  "tests": [{
    "id": "uuid", "title": "text", "description": "text|null", "position": 1,
    "time_limit_mins": 30, "is_proctored": false, "questions_count": 4, "total_marks": 9,
    "passing_percentage": 50, "opens_at": "…|null", "closes_at": "…|null",
    "attempts_used": 0, "attempts_allowed": 2, "attempts_remaining": 2,
    "best_score": null, "best_percentage": null, "passed": false,
    "latest_attempt_id": null, "latest_status": "in_progress|submitted|timed_out|abandoned|null",
    "in_progress_attempt_id": null }] }
```

`enrollment` is `null` when the caller isn't enrolled.

### `student_enroll(p_series_id uuid)`
- **Idempotent.**
- **Free series:** creates a direct enrolment. It expires `access_days` after
  enrolling, when the series sets `access_days`.
- **Expired enrolment:** renewed.
- **Revoked enrolment:** refused with `42501`.
- **Paid series:** `0A000` (STUB: needs payments model, F4).

```json
{ "series_id": "uuid", "enrolled": true, "already_enrolled": false, "enrolled_at": "…", "expires_at": "…|null" }
```

### `student_my_series()` → `item[]`
Returns the series the caller currently has access to, newest enrolment first.
Each item is the card plus:

```json
{ "enrolled_at": "…", "expires_at": "…|null", "source": "direct|course",
  "tests_attempted": 1, "progress_percentage": 50.0,
  "best_score": 1, "best_percentage": 11.11, "latest_score": 1, "latest_percentage": 11.11,
  "latest_attempt_at": "…" }
```

`progress_percentage` = distinct tests with a finished attempt ÷ published
tests.

## Taking a test

### `student_get_test_intro(p_test_id uuid)`
- **Requires:** access to the test's series (`42501` without it).
- **Error:** `P0002` for a draft test, or a test whose series isn't live.
- **Never returns questions.**

```json
{ "test_id": "uuid", "test_title": "text", "series_id": "uuid", "series_title": "text",
  "series_instructions": "text|null", "test_instructions": "text|null", "instructions_extra": "text|null",
  "duration_mins": 30, "questions_count": 4, "total_marks": 9,
  "negative_marking": true, "max_negative_marks": 0.25, "passing_percentage": 50,
  "attempts_used": 0, "attempts_allowed": 2, "attempts_remaining": 2,
  "violation_limit": 2, "is_proctored": false, "show_answers_after": "submission|passing|never",
  "opens_at": "…|null", "closes_at": "…|null",
  "in_progress_attempt_id": "uuid|null", "can_start": true,
  "blocked_reason": "no_questions|not_open_yet|closed|attempts_exhausted|null",
  "server_now": "…",
  "sections": [{ "name": "General", "questions": 4 }] }
```

- **`can_start`** is true whenever there's an unexpired in-progress attempt to
  resume.
- **`test_instructions`** comes from `quizzes.description`.

### `student_start_attempt(p_test_id uuid)`
- **Requires:** access to the series, an account that isn't blocked, and a
  `profiles` row.
- **Resume:** an unexpired `in_progress` attempt is resumed (`resumed: true`).
- **Expired attempt:** an expired one is graded first (`timed_out`), then a new
  attempt starts if any are left.
- **Checks before a new attempt:** the window (`opens_at` / `closes_at`), that
  the test has questions, and `max_attempts`.
- **Concurrency:** starts are serialized per student and test.

```json
{ "attempt_id": "uuid", "test_id": "uuid", "test_title": "text", "series_id": "uuid",
  "attempt_number": 1, "resumed": false, "started_at": "…", "deadline": "…|null", "server_now": "…",
  "duration_mins": 30, "is_proctored": false, "violation_limit": 2, "violations_count": 0,
  "questions": [{
    "id": "uuid", "position": 1, "text": "text",
    "type": "multiple_choice|true_false|fill_in_blank|short_answer",
    "ui_type": "mcq_single|mcq_multi|true_false|fill_blank|numerical|subjective|…",
    "multi_select": false, "points": 1, "negative_marks": 0.25,
    "section": "General", "section_position": 0, "topic": "text|null", "difficulty": "easy|medium|hard|null",
    "image_path": "text|null", "answer_instructions": "text|null",
    "options": [{ "id": "uuid", "text": "text" }] }],
  "saved_answers": [{ "question_id": "uuid", "answer_text": "text|null", "selected_option_ids": ["uuid"] }] }
```

- **Question order:** `questions` comes in the attempt's order. If
  `quizzes.shuffle_questions` is set, the order is shuffled, but always the
  same way for a given attempt, so a resume shows the same order.
- **Option order:** options follow `quiz_admin.shuffle_options` in the same
  way.
- **`options`:** empty for `fill_in_blank` and `short_answer`.
- **`multi_select`:** true when a `multiple_choice` question has more than one
  correct option, so the UI can show checkboxes. This tells the student
  "select all that apply"; it doesn't reveal which options are correct.
- **`deadline`:** `started_at + time_limit_mins`, or `null` for an untimed test.

### `student_save_answer(p_attempt_id uuid, p_question_id uuid, p_answer jsonb)`
- **Autosave:** call it on every change; debouncing on the client is fine.
- **`p_answer` shape:**
  - `{"selected_option_ids": ["uuid", …]}` for `multiple_choice` /
    `true_false`;
  - `{"answer_text": "…"}` otherwise (trimmed, at most 20,000 characters);
  - `null`, `{}` or an empty value clears the answer.
- **Option ids** must belong to that question (`22023`).
- **Refused with `P0002`** if it isn't the caller's attempt.
- **Refused with `P0001`** if the attempt is finished, or more than **10
  seconds** past the deadline.

```json
{ "saved": true, "cleared": false, "question_id": "uuid", "saved_at": "…", "server_now": "…", "deadline": "…|null" }
```

### `student_log_proctor_event(p_attempt_id uuid, p_event_type text, p_meta jsonb = '{}')`
Records an event and returns the violation status.

- **Violation types:** `visibility_hidden`, `window_blur`, `fullscreen_exit`,
  `copy`, `cut`, `paste`, `contextmenu`, `print`, `devtools`.
- **Informational types,** recorded but never counted: `fullscreen_enter`,
  `attempt_resumed`, `warning_acknowledged`.
- **Anything else** gets `22023`.
- **Debounce:** a violation within 3 seconds of the previous counted one is
  recorded with `counted: false`. One tab switch fires both blur and
  visibilitychange.
- **`p_meta`:** stored with the event, and truncated if it's over 4 KB.
- **Limit:** when the counted violations go **over** `violation_limit`
  (`quiz_admin.max_violations`, default 3), the attempt is submitted
  automatically: `auto_submitted: true`, `auto_submit_reason: "proctor_limit"`.
  That's also noted in the report.
- **Past the deadline:** an event logged more than 10 seconds past the deadline
  grades the attempt (`auto_submit_reason: "time_up"`).

```json
{ "attempt_id": "uuid", "recorded": true, "counted": true, "violations_count": 1, "violation_limit": 2,
  "remaining": 1, "auto_submitted": false, "auto_submit_reason": "proctor_limit|time_up|null",
  "status": "in_progress|submitted|timed_out" }
```

`remaining` = how many more violations are allowed before the next one
auto-submits.

### `student_submit_attempt(p_attempt_id uuid)` → report
- **Idempotent:** a second call returns the stored report.
- **Late submission:** a submit more than 15 seconds after the deadline is
  recorded as `timed_out`.
- **Error:** `P0002` if it isn't the caller's attempt.

### `student_get_report(p_attempt_id uuid)` → report
- **Returns:** the stored report for the caller's own attempt.
- **Expired attempts:** an `in_progress` attempt past its deadline is graded
  first.
- **Running attempts:** refused with `P0001`.
- **Attempts finished outside this port** (for example by the lead's app) have
  no report: `P0002`.

## Scoring

Scoring is server-side only.

| Question | Rule |
|---|---|
| any, unanswered | `skipped`: 0 points, no penalty; still counts toward `max_score` |
| `multiple_choice`, `true_false` | the selected set must equal the correct set (multi-correct is all-or-nothing) |
| `fill_in_blank` | trimmed, case-insensitive match against any `is_correct` option (the accepted answers) |
| `short_answer` (incl. long answer / subjective), or `needs_manual_grading` | `pending`: not scored, and left out of `score` / `max_score` / `percentage` until graded |

- **Points:** a correct answer earns `quiz_questions.points`. A wrong answer
  loses `quiz_question_admin.negative_marks` (default 0).
- **Percentage:** `score / max_score × 100`, never below 0.
- **Pass:** `passed` = percentage ≥ `quizzes.passing_score`. When anything is
  pending, `provisional` is true.
- **What gets written:** each question gets a `quiz_answers` row
  (`is_correct`: true / false / null for pending; `points_earned`; skipped rows
  record false / 0). The attempt row gets `score`, `max_score`, `percentage`,
  `passed`, `submitted_at`, `time_taken_secs` and `status`.

## Report

The report is a snapshot stored in `attempt_reports`. Rank and comparisons are
as of submission time.

```json
{ "version": 1, "attempt_id": "uuid", "test_id": "uuid", "test_title": "text",
  "series_id": "uuid", "series_title": "text",
  "summary": {
    "status": "submitted|timed_out", "attempt_number": 1, "started_at": "…", "submitted_at": "…",
    "time_taken_secs": 0, "time_limit_mins": 30,
    "score": 1, "max_score": 9, "total_marks": 9, "percentage": 11.11, "passing_percentage": 50,
    "passed": false, "provisional": false,
    "correct_count": 1, "incorrect_count": 0, "skipped_count": 3, "pending_count": 0, "pending_marks": 0,
    "rank": 1, "total_attempts": 1, "percentile": 100, "class_average": 11.11, "topper_percentage": 11.11,
    "violations_count": 1, "violation_limit": 2,
    "auto_submitted": false, "auto_submit_reason": "proctor_limit|time_up|null",
    "answers_hidden": false },
  "questions": [{
    "position": 1, "question_id": "uuid", "text": "text", "type": "multiple_choice", "ui_type": "mcq_single",
    "section": "General", "section_position": 0, "topic": "Algebra", "difficulty": "easy|medium|hard|unrated",
    "status": "correct|incorrect|skipped|pending",
    "student_answer": "text|null", "selected_option_ids": ["uuid"],
    "correct_answer": "text|null", "explanation": "text|null",
    "options": [{ "id": "uuid", "text": "Right", "selected": true, "is_correct": true }],
    "points": 1, "negative_marks": 0.25, "points_earned": "number|null", "time_spent_secs": null }],
  "breakdowns": {
    "by_section":    [{ "name": "General", "position": 0, "...bucket" }],
    "by_topic":      [{ "name": "Algebra", "...bucket" }],
    "by_difficulty": [{ "name": "easy", "...bucket" }] },
  "strengths":  [{ "topic": "Algebra", "accuracy": 100.0 }],
  "weaknesses": [{ "topic": "…", "accuracy": 40.0 }],
  "comparison": { "your_percentage": 11.11, "average_percentage": 11.11, "topper_percentage": 11.11,
                  "your_score": 1, "average_score": 1.00, "topper_score": 1,
                  "difference_from_average": 0.00, "difference_from_topper": 0.00 } }
```

Each breakdown bucket has these keys:

```json
{ "total": 2, "attempted": 1, "correct": 1, "incorrect": 0, "skipped": 1, "pending": 0, "graded": 1,
  "accuracy": 100.0, "marks_earned": 1, "marks_possible": 3 }
```

Notes on the report:
- **Accuracy:** `accuracy` = correct ÷ graded (correct + incorrect).
- **Strengths and weaknesses:** at most 3 topics each, from topics with at
  least one graded answer. Strengths have accuracy ≥ 60, weaknesses below 60.
- **Hidden answers:** answers follow the lead's `quizzes.show_answers_after`:
  `submission` = shown, `passing` = only when passed, `never` = hidden. When
  they're hidden, `answers_hidden` is true, `correct_answer` and `explanation`
  are null, and `options[].is_correct` is left out.
- **Placeholder:** the manual-grading placeholder (`Manual grading: see
  rubric`) is never shown as a correct answer.
- **Rank and percentile:**
  - they cover every finished attempt of the test, including other attempts by
    the same student;
  - tied scores share a rank;
  - `percentile` = the share of other attempts with a lower percentage.
- **Per-question time:** not tracked yet, so `time_spent_secs` is always
  `null`.

## History, stats, dashboard

### `student_my_history(p_page int = 1, p_size int = 20)`
Returns every attempt by the caller, newest first. `p_size` is clamped to
1–100.

```json
{ "total": 3, "page": 1, "size": 20, "total_pages": 1,
  "items": [{ "attempt_id": "uuid", "test_id": "uuid", "test_title": "text", "series_id": "uuid", "series_title": "text",
              "attempt_number": 1, "status": "in_progress|submitted|timed_out|abandoned",
              "is_expired": false, "deadline": "…|null",
              "score": 1, "max_score": 9, "percentage": 11.11, "passed": false,
              "started_at": "…", "submitted_at": "…|null", "time_taken_secs": 0, "time_limit_mins": 30,
              "has_report": true }] }
```

`is_expired` means the attempt is `in_progress` but past its deadline. Calling
`student_get_report` on it grades it.

### `student_get_stats()`
Totals for the Account page.

```json
{ "tests_taken": 1, "attempts_taken": 1, "tests_passed": 0, "series_enrolled": 1,
  "average_percentage": 11.1, "best_percentage": 11.11, "total_time_secs": 0,
  "current_streak": 1, "accuracy_percentage": 100.0 }
```

Definitions:
- **Tests taken / passed:** distinct tests with a finished / passed attempt.
- **Accuracy:** correct ÷ graded answers.
- **Streak:** consecutive days in the Asia/Kolkata time zone with a finished
  attempt, counted back from today, or from yesterday if today has none yet.

### `student_dashboard()`

```json
{ "continue_learning": [{ "attempt_id": "uuid", "test_id": "uuid", "test_title": "text", "series_id": "uuid",
                          "series_title": "text", "attempt_number": 1, "started_at": "…", "deadline": "…|null",
                          "answered": 2, "questions_count": 4 }],
  "enrolled_series":    ["student_my_series item (newest 6)"],
  "recent_history":     [{ "attempt_id": "uuid", "test_id": "uuid", "test_title": "text", "series_id": "uuid",
                           "series_title": "text", "attempt_number": 1, "status": "submitted", "score": 1, "max_score": 9,
                           "percentage": 11.11, "passed": false, "submitted_at": "…", "time_taken_secs": 0,
                           "has_report": true }],
  "stats": { "tests_taken": 1, "tests_passed": 0, "average_percentage": 11.1, "current_streak": 1, "series_enrolled": 1 },
  "recommended_series": ["card + is_enrolled + attempts_count (live, not enrolled, same subject first, 6)"] }
```

- **`continue_learning`:** unexpired in-progress attempts, at most 5.
- **`recent_history`:** finished attempts, at most 5.

## Not covered (by design, for now)

- **Lesson quizzes outside a test series** (`quizzes.series_id` is null).
- **Paid enrolment** (F4).
- **Manual grading by an educator or admin.** Pending answers stay pending.
- **Per-question time tracking.**
