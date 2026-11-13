# QA bug triage (26 reports -> 25 unique -> 9 work packages)

Saved from the triage plan shared in the session on 2026-11-03. Progress per
package is in `docs/PORT_PROGRESS.md`.

**Status:**

| Package | Status |
|---|---|
| P1 | Done (frontend) |
| P2 | Written (`20261102090000`, `set-user-ban`, frontend), not applied or deployed |
| P3, P4 (item 5), P5 (a, d, e), P7 | Written (`20261104090000`, frontend), not applied |
| P8 | Done (frontend); item 1: the freeze was ManageDiscounts' unstable request (2026-11-07) |
| QA 02-07 Nov (login copy, CSV alert, tracker creator, onboarding redirect, resolution notice) | Written (`20261107090000`, frontend), not applied |
| P2 | Applied and deployed; open-session poll and login check added (2026-11-11, frontend) |
| P4 (items 1-4, 6), P5 (b, c), P9 | Written (`20261111090000`, frontend), not applied |
| P5 (f), P6 | Not started |
| QA 13 Nov (marks on publish, assignment form scroll + allocation, badge, details close, CMS, notifications) | Written (`20261114090000`, frontend), not applied |

Bugs 15 and 16 are identical (blocked student). Many of the rest share one cause, so fix by package, not one by one.

## Map

| Package | Bugs | Root cause (likely) | DB change? |
|---|---|---|---|
| **P1 Shared UI** | #1 (blank popup), #9, #19, #7, #10, #12, plus all blank-white-screen crashes (#11, #24) | Toast styles are only loaded by an admin page's CSS, so in other portals the toast has white text on a white background (the "blank popup"). Row menus render inside a scrolling table and get clipped. No error boundary, so any render crash is a blank screen. Logout confirmation exists in one layout only. | no |
| **P2 Blocking** | #15/#16, #26 | Blocking is app-level only: login itself still succeeds and the student dashboard doesn't check the account status. | yes + function |
| **P3 Educator state UI** | #3, #4 | Account status and verification status shown independently, with actions not tied to the state. Activate after Deactivate likely rejected by the state writer. | maybe |
| **P4 Assignments and tracker** | #6, #20, #22, #23, #24, #25 | Several UI/RPC field mismatches (requirements not read back, status-based actions, sort key, creator not shown, marks target) | yes (RPCs) |
| **P5 Test edit, publish, sync** | #1, #8, #17, #18 | Edit form saves/publishes with the wrong buttons; edit not persisting; published state shown stale or blocked by a schedule rule | maybe |
| **P6 Login reliability and copy** | #5, #13 | Any failure in the login path (profile fetch, role check, stale session) is shown as "Incorrect email or password" | no |
| **P7 Admin student detail** | #14 | The enrolled-series list reads the wrong table or joins incorrectly | yes (RPC) |
| **P8 Freeze and CSV** | #2, #11 | Probably a render loop or a cache key clash in `useRpc`; the teacher "new series" route crashes in the shared wizard | no |
| **P9 Delete account** | #21 | Missing feature | yes (small) |

## Capture first

For these seven, reproduce once with DevTools open and keep the red Console error and the failing Network request (status plus response body):

| Bug | Capture |
|---|---|
| #2 freeze | Console ("Maximum update depth exceeded" or a flood of repeated requests in Network) when you go Test Series -> Report Builder |
| #4 Activate fails | Network response of the activate action |
| #5 intermittent login | Network response of the `token` request when it fails ("Incorrect email or password") |
| #11 blank `/teacher/test-series/new` | Console error |
| #14 wrong enrolled series | the response of the student detail RPC, and `select series_id, student_id from admin_series_enrollments where student_id = '<id>';` |
| #18 edit not saved | the request body and response of the save |
| #24 blank assignment details | Console error |

## Decisions (defaults in brackets)

1. **Blocked student:** block at login level (the student can't sign in at all) **[yes]**, using the Auth admin API ban. Existing tokens expire on their own, so every student RPC also refuses a blocked account, which makes it effective immediately.
2. **Assignment total marks:** the assignment's total marks is a **target**. The educator form shows "Required 15, added 3" and warns before submitting if they differ **[warn, don't block]**.
3. **Delete account:** a **request** flow (confirm plus password re-entry, the request goes to the admin) rather than instant deletion **[request flow]**.
4. **Rejected educators:** show only a "Review and reconsider" action and hide Deactivate and Suspend **[yes]**.
5. **Test-level "Submit for approval"** on a rejected series: remove it; only the series-level "Resubmit" exists **[yes]**.

## P1: shared UI

1. **Toast:** move the toast styles into a shared stylesheet imported once globally.
   - It needs accessible contrast (WCAG AA) for success, error, warning and info.
   - It must sit above modals and drawers, with an icon, auto-dismiss and a close button.
   - Every portal uses the same toast.
   - Audit toast calls with empty messages or error objects; always show a readable message.
2. **Row action menus:** one shared component, used in every table.
   - It renders in a portal with fixed positioning, flips to stay in the viewport, and closes on an outside click and Escape.
   - It is keyboard accessible and never clipped.
   - Menu items depend on the row state.
3. **Error boundary:** a shared ErrorBoundary around each portal's outlet and the lazy pages, with Reload and Go back.
4. **Logout confirmation:** one shared Cancel / Log out dialog in the admin, teacher and student layouts.
5. **Tests:** for the toast contrast, the menu positioning, the error boundary and the logout dialog.

## P2: blocking enforcement (critical)

Use new migrations (`supabase/migrations/20261102*_student_block_*.sql`) with preflight, rollback and a trial file; never run them against a database or deploy.

1. **SQL:**
   - Add an internal helper `adm_student_is_blocked(uuid)`.
   - Every student_* RPC raises a stable `account_blocked` error when the caller is blocked.
   - Add `student_get_account_status()` (never refused for a block), returning `{blocked, reason_public}` with a generic message only.
2. **Auth-level block:** a new admin-only Edge Function `set-user-ban` (`verify_jwt` true) that bans or unbans a user with the Auth admin API (`ban_duration`; `none` to lift).
   - The admin UI's block and unblock flows call it after the SQL action succeeds. If the function fails, the SQL action still stands and a warning with Retry is shown.
   - Update `revoke-user-sessions` to coexist.
   - Never ban an admin account, and refuse banning yourself.
3. **Frontend:**
   - The student layout calls `student_get_account_status` on load and focus.
   - A blocked student sees a full-page "Account blocked" screen with Log out; any RPC error `account_blocked` triggers the same screen.
   - The login page explains a banned user.
   - The admin student detail shows the block state (status, reason, date, who).
4. **Educators:** the same hardening; a suspended or blocked educator gets the same full-page message, through the educator gate.
5. **Tests:** a SQL smoke test (every student RPC refuses a blocked student, and unblocking restores access), frontend tests for the blocked screen and the error mapping, and validator tests for the function.

## P3: educator state UI (#3, #4)

1. **One action matrix,** keyed on the effective state, used by the UI and enforced by `adm_set_educator_state`:

   | State | Actions |
   |---|---|
   | draft / pending / under_review | Approve, Request changes, Reject |
   | changes_requested | Approve, Reject |
   | approved + active | Deactivate, Suspend, Delete |
   | approved + inactive | Activate, Delete |
   | suspended | Reactivate, Delete |
   | rejected | Reconsider (to under_review), Delete |

2. **Badges:** one primary status badge, plus a secondary "Account" badge only when the educator is approved. Never show Active next to Rejected.
3. **Activate after Deactivate:** find why it fails and fix it in a new migration.
   - Add the round trip approve -> deactivate -> activate -> suspend -> reactivate to `supabase/tests/educator_lifecycle_flow_editor.sql`.
   - Add a test that the writer refuses transitions outside the matrix.
4. **Feedback and data:** show a toast for every action and refetch the list and stats. Add an idempotent backfill: a rejected educator gets `account_status` inactive.
5. **Checks:** the trial file, parser check, build, tests and docs.

## P4: assignments and tracker

1. **#23:** Edit Requirements reads the saved values back.
2. **#22:** a cancelled or completed assignment offers only View details, enforced server-side too.
3. **#24:** View details no longer opens a blank screen.
4. **#25:** "Recently assigned" sorts by `created_at` descending.
5. **#6:** the tracker shows the creator of an independent series (with a "Creator" badge), and the status reads "Independent". Counts don't treat the creator as assigned.
6. **#20:** the assignment's total marks is a target; show "Required / Added so far" and warn before submitting.
7. **Tests and docs.**

## P5: test edit, publish and status sync

1. **a.** Readiness warnings apply only to unpublished tests; a published test never shows "not ready".
2. **b.** Editing an existing test has one "Save changes" button; Publish and Unpublish are separate actions.
3. **c.** Edits persist (payload mapping), tested by reopening the saved test.
4. **d.** After any status change, invalidate every cached list and detail in every portal.
5. **e.** A rejected series offers only the series-level "Resubmit for approval"; adding and editing questions works, with readable messages.
6. **f.** Validation errors come from the server in plain language and appear in the toast and next to the field.

## P6: login reliability and messages (#5, #13)

1. **Races:** fix the ones that turn non-credential failures into "Incorrect email or password":
   - sign out a stale session before `signInWithPassword`;
   - don't do profile work inside `onAuthStateChange`;
   - retry transient failures once.
2. **Error mapping:**
   - invalid credentials (without revealing whether the email exists);
   - unconfirmed email;
   - rate limited;
   - banned;
   - network error;
   - wrong portal;
   - unknown.
3. **Debugging and tests:** a debug logger for the login sequence (off by default), plus tests.

## P7: admin student detail (#14)

The Enrolled Test Series section shows series the student didn't enrol in. Find the cause and fix it in a new migration so the list shows only the student's real rows from `admin_series_enrollments` (title, enrolled date, progress, best score, attempts). Add a test that two students with different enrolments get different lists.

## P8: freeze and CSV import (#2, #11)

1. **Freeze:** reproduce it with tests that navigate between the routes; fix render loops and cache key clashes.
2. **`/teacher/test-series/new`:** find the crash and fix it, with a route-level test for an approved educator.
3. **CSV import (admin and teacher), end to end:**
   - a template download;
   - quoting-aware parsing;
   - a per-row preview of valid and invalid rows with reasons;
   - subjective types refused with "Coming soon";
   - importing adds the valid rows;
   - errors never blank the page;
   - tests with commas and quotes.

## P9: delete account (#21)

A deletion request flow (the student and teacher request it, an admin approves or rejects it, and approval blocks the account). The actual data deletion stays a manual step.

## Order and gate

1. **P1,** then check it in the browser.
2. **P2,** through the usual gate: the trial, a backup, `migration list`, `db push --dry-run`, `db push`, then the deploy with `approved:`.
3. **P3, P4, P5, P7,** one at a time.
4. **P6 and P8,** then **P9** if wanted.
