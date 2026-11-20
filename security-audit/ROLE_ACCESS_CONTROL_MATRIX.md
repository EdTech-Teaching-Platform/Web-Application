# Role Access Control Matrix

**How roles are decided (server-side, never from the frontend):**
- **Admin:** a row in `adm_admin_users` **and** `profiles.role` in (`admin`, `super_admin`), via `adm_is_platform_admin()`.
- **Teacher (educator):** `profiles.role = 'educator'`, a verified educator profile, our review state approved, and the account active, via `adm_is_verified_educator()`. Before approval only the onboarding RPCs work.
- **Student:** any signed-in user who isn't blocked, via `adm_student_uid()`.
- **Anon:** not signed in.

✅ allowed · 🔒 own rows only · ❌ refused (tested) · — not applicable

## Frontend routes (UI guards; the server enforces regardless)

| Route | Anon | Student | Teacher | Admin |
|---|---|---|---|---|
| Public pages, `/test-series` catalogue | ✅ | ✅ | ✅ | ✅ |
| `/student/*` | → login | ✅ (blocked → blocked screen) | → own home | → own home |
| `/teacher/*` | → login | → own home | ✅ (pending → status screen) | → own home |
| `/admin/*` | → admin login | ❌ | ❌ | ✅ |

## Database RPCs

| Capability | Anon | Student | Teacher (verified) | Admin | Verified by |
|---|---|---|---|---|---|
| Public catalogue (`public_list_series`, `public_get_series`) | ✅ | ✅ | ✅ | ✅ | sweep |
| Enrol, start, save, submit, report (`student_*`) | ❌ | 🔒 (published series only) | 🔒 (own) | 🔒 (own) | sweep, `student_rpcs.sql`, `security_idor.sql` |
| Another user's attempt or report | ❌ | ❌ | ❌ | read via admin reports | `security_idor.sql` |
| Feedback on an attempt | ❌ | 🔒 | 🔒 | resolve via moderation | `feedback_rpcs.sql`, IDOR |
| Notifications | ❌ | 🔒 | 🔒 (assignment messages) | own + send | `student_notifications.sql`, `qa_nov14.sql` |
| AI evaluation request and status | ❌ | 🔒 | — | — | `student_ai_evaluation.sql` |
| AI context and grade saving (`adm_ai_eval_*`) | ❌ | ❌ | ❌ | ❌ (service role only) | `student_ai_evaluation.sql` |
| Delete-account request | ❌ | 🔒 | 🔒 | decide | `qa_nov11.sql` |
| Upload answer sheets (`student_*_answer_upload*`) | ❌ | 🔒 own attempt, written questions, window open | — | — | `written_answers.sql` |
| Mark written answers (`grading_*`) | ❌ | ❌ | 🔒 own series (candidate code, no name) | ✅ all (with name) | `written_answers.sql` |
| Delete own account (`adm_account_delete_self`) | ❌ | ❌ direct (service role only, via delete-account) | ❌ direct | ❌ | `qa_nov18.sql` |
| Educator onboarding (`educator_start/save/submit_onboarding`) | ❌ | — | ✅ (any educator) | — | `educator_onboarding.sql` |
| Create, edit and delete series, tests, questions | ❌ | ❌ | 🔒 own series (not while pending approval) | ✅ all | `educator_series.sql`, IDOR |
| Assignments (`educator_list/get/start_assignment`, comments) | ❌ | ❌ | 🔒 own | ✅ create, manage, review | `educator_series.sql`, IDOR |
| Educator documents (signed URL) | ❌ | ❌ | 🔒 own | ✅ (audited) | `educator_document_access.sql` |
| Upload URLs (images, documents) | ❌ | ❌ (images) | ✅ (rate-limited, own folder) | ✅ | `admin_test_assets.sql` |
| Student management (detail, block / unblock) | ❌ | ❌ | ❌ | ✅ | sweep, IDOR, `student_block.sql` |
| Educator management (verify, suspend, …) | ❌ | ❌ | ❌ | ✅ (action matrix) | sweep, `admin_qa_fixes.sql` |
| Moderation, help desk, reports, audit logs, settings | ❌ | ❌ | ❌ | ✅ | sweep |
| Change own role / become admin | ❌ | ❌ (our RPCs) · ⚠️ lead RLS unverified | ❌ (our RPCs) · ⚠️ | — | sweep; **SEC-03 pending** |

## Edge Functions

| Function | Anon | Student | Teacher | Admin | Other |
|---|---|---|---|---|---|
| evaluate-subjective | ❌ | 🔒 own attempt | — | — | — |
| answer-uploads (20 Nov) | ❌ | 🔒 upload / view own answer sheets (test time + 15 min) | 🔒 view sheets of own series | ✅ view | — |
| delete-account (QA 18 Nov) | ❌ | 🔒 own account, password re-checked | 🔒 own account, password re-checked | ❌ (refused in SQL) | — |
| educator-upload-url | ❌ | ❌ | ✅ | — | — |
| asset-upload-url | ❌ | ❌ | ✅ (verified) | ✅ | — |
| sign-educator-document | ❌ | ❌ | 🔒 own | ✅ | — |
| create-educator-invites, revoke-user-sessions, set-user-ban, process-refund, ai-generate-test | ❌ | ❌ | ❌ | ✅ | — |
| send-notification-emails | ❌ | ❌ | ❌ | ❌ | service role / cron secret |
| payment-webhook | — | — | — | — | HMAC signature (placeholder) |

## Direct table access from the browser

| Table | Operation | Who | Protected by |
|---|---|---|---|
| `profiles` (lead) | select / update own row | every signed-in user | **lead RLS: unverified (SEC-03)** |
| `student_profiles` (lead) | select / upsert own row | students | **lead RLS: unverified (SEC-03)** |
| All tables we created | none | nobody | RLS on, no grants (verified) |
