# Supabase Edge Functions (admin port on the lead's database)

Nothing here is deployed by the port. Deploy only with the lead's approval.

| Function | Purpose | Caller | `verify_jwt` |
| --- | --- | --- | --- |
| `create-educator-invites` | `create_educator_invites` (de-duplicates and queues), then `auth.admin.inviteUserByEmail`, then `register_educator` (service role). That inserts `profiles` (role `educator`), `educator_profiles` (phone or `''`, location `Not provided`, `verification_status 'pending'`, totals 0) and `educator_admin_state`. If registration fails, the auth user is deleted again. Returns per-row `results` (`sent` / `skipped` / `failed`). | Admin or super_admin | true |
| `revoke-user-sessions` | `revoke_user_sessions` RPC (app-level sessions), plus Admin API `signOut` for the caller's own token (`scope` `global` / `others`). It cannot revoke another user's refresh tokens; see the note below. | Admin or super_admin | true |
| `send-notification-emails` | Sends queued campaign emails through Resend (`fetch`). It re-checks `notification_preferences.email`, then `record_email_results`. | Service-role bearer token (cron), or `x-cron-secret` | true |
| `sign-educator-document` | Signed URL (10 min) for an `educator_verification_docs` row, by `documentId` (or `path`, the older UI). `adm_authorize_document_access` (20261101090000) decides with the caller's JWT: an admin for any document, the owning educator for their own, nobody else; it also writes `audit_logs` (`educator.document_access`: who, which document, view or download). It accepts the old and new `doc_url` forms (`paths.ts`). Optional `download: true`. Errors are `{error}` with 401 / 403 / 404 / 400. | Admin, or the owning educator | true |
| `educator-upload-url` | Validates `{docType, docName, fileName, contentType, size}`. It claims a rate-limit slot through `adm_claim_educator_upload_slot` (this also refuses non-educators), then returns a service-role **signed upload URL** for `<user id>/<docType>-<docName>-<timestamp>.<ext>`. | Any educator (any verification status) | true |
| `asset-upload-url` | Validates `{kind: 'banner' | 'question_image', fileName, contentType, size}` (JPEG, PNG or WebP; banner up to 2 MB, question image up to 3 MB). It claims a slot through `adm_claim_asset_upload_slot` (20261029110000; this also refuses anyone who isn't an admin or a verified educator, via `adm_actor_kind`), then returns `{path, signedUrl, token, publicUrl, bucket, expiresIn}`: a service-role **signed upload URL** for `<user id>/<kind>/<uuid>.<ext>` in the public bucket `test-assets`. | Admin or verified educator | true |
| `set-user-ban` | Auth-level ban that follows a student block (QA triage P2). Validates `{userId, ban: true / false, reason?}`, checks the target with `adm_user_ban_check`, then calls `auth.admin.updateUserById(userId, {ban_duration})`: `876000h` to ban, `none` to lift. It bans only an account already blocked in SQL, lifts the ban only after the SQL unblock, never bans an admin and refuses banning yourself. Every call is audited (`adm_record_user_ban`: `user.auth_ban` / `user.auth_unban`). Errors are `{error, field?}` with 400 / 403 / 404 / 409. | Admin or super_admin | true |
| `payment-webhook` | Placeholder (D1). Calls the `mark_payment_*` stubs, which raise `0A000`. | Gateway (HMAC) | **false** |
| `process-refund` | Placeholder (D1). Reads `refund_requests`, which doesn't exist in the lead's database. | Admin | true |
| `ai-generate-test` | Placeholder (unchanged). | Admin | true |
| `evaluate-subjective` | AI evaluation of a student's written answers (20261115090000). `POST {attemptId}` from the report page.<br>• `student_ai_eval_request` (as the student) checks ownership and claims the job: one at a time, at most 3 tries.<br>• Not claimed: it returns the status. Claimed: it answers 202 and continues in the background (`EdgeRuntime.waitUntil`).<br>• `adm_ai_eval_context` (service role) gives the question, marks, model answer, marking guide and student answer; no name or email.<br>• OpenAI `chat.completions` with a strict JSON schema; `normalizeEvaluation` clamps marks to 0..max in 0.5 steps.<br>• `adm_ai_eval_complete` (service role) writes the grades, the score and the report's AI section. Any error goes to `adm_ai_eval_fail`.<br>• Errors are `{error}` with 400 / 403 / 404. | The student who owns the attempt | true |

The admin check (`_shared/auth.ts` → `_shared/roles.ts`) accepts `profiles.role` of
`admin` or `super_admin`.

## Secrets

```sh
supabase secrets set RESEND_API_KEY=... EMAIL_FROM="Universal Learning <noreply@your-domain>"
supabase secrets set EDUCATOR_DOCS_BUCKET=<the lead's verification-docs bucket>   # required: there is no docs/db_inspection/buckets.csv
supabase secrets set EDUCATOR_UPLOAD_LIMIT_PER_HOUR=20                           # optional (default 20)
supabase secrets set ASSET_UPLOAD_LIMIT_PER_HOUR=60                              # optional (default 60; asset-upload-url)
supabase secrets set EDUCATOR_INVITE_REDIRECT_URL=https://<site>/teacher/login     # optional
supabase secrets set EMAIL_CRON_SECRET=...                                         # optional alternative to the service-role bearer
# optional: EMAIL_BATCH_SIZE (default 100), EDUCATOR_DOCS_URL_TTL (seconds, default 600, 60..3600)
supabase secrets set OPENAI_API_KEY=sk-...                                        # required by evaluate-subjective (never commit it)
supabase secrets set OPENAI_MODEL=gpt-4o-mini                                      # optional (default gpt-4o-mini)
# placeholders only: PAYMENT_WEBHOOK_SECRET, PAYMENT_PROVIDER_KEY, PAYMENT_REFUND_URL
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the
Edge Runtime.

**Signing a document:** `sign-educator-document` signs only paths that appear in
`educator_verification_docs.doc_url`. A full Supabase storage URL in `doc_url` is
signed in the bucket named in that URL, and a non-storage URL is returned
unchanged (`external: true`).

**Educator uploads (`educator-upload-url`):**

1. The teacher portal calls the function with the user's JWT:
   `supabase.functions.invoke("educator-upload-url", { body: {docType, docName, fileName, contentType, size} })`.
2. It uploads the file with `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`.
3. It calls `educator_register_document(docType, path, docName)`.

- **Allowed documents:**

  | `docType` | `docName` | Files |
  |---|---|---|
  | `government_id` | `front` / `back` | JPEG, PNG or WebP |
  | `other` | `selfie` | JPEG, PNG or WebP |
  | `degree_certificate`, `teaching_license`, `experience_letter`, `subject_certificate` | a lowercase-dash label (up to 40) | JPEG, PNG, WebP or PDF |

  The size limit is 5 MB.
- **Path:** the user id comes only from the JWT. The extension comes from the
  validated content type; the client's file name is only sanitized.
- **Unchecked by the signed URL:** it can't enforce the size or type, so
  `educator_register_document` checks the stored object's `metadata.size` and
  `metadata.mimetype` before accepting it.
- **Rate limit:** 20 uploads per rolling hour per user (table
  `educator_upload_requests`). The 21st returns HTTP 429 with
  `retryAfterSeconds`.
- **Errors:**
  - a validation error is HTTP 400 `{error, field}`;
  - a non-educator gets 403 "Educators only".
- **Storage:** no storage policy is created or changed; the bucket stays
  private.

**Test images (`asset-upload-url`):** series banners and question figures.

1. The browser resizes the picture (banners to 1600 px wide, question images to
   1200 px) and re-encodes it as WebP at ~0.85 quality (JPEG, or PNG for
   transparent pictures, when the browser has no WebP encoder):
   `src/services/assetsApi.js` → `uploadImage(kind, file)`.
2. It calls the function with the user's JWT, then PUTs the file to
   `signedUrl` (with progress).
3. The returned `path` is saved by the normal RPCs: `coverPath` on
   `upsert_test_series_full` / `create_test_series` / `update_test_series`;
   `image` + `imageAlt` on the question RPCs and the wizard's questions. The RPCs
   check it with `adm_test_asset_path`: the first folder must be the caller,
   unless the caller is an admin or the path is already on that row or series.

- **Reads:** the bucket is public, so the stored path becomes
  `<SUPABASE_URL>/storage/v1/object/public/test-assets/<path>`, in one place:
  `assetUrl(path)`.
- **Rate limit:** 60 uploads per rolling hour per user (table
  `test_asset_upload_requests`), then HTTP 429 with `retryAfterSeconds`.
- **Errors:** a validation error is HTTP 400 `{error, field}`; a student or
  an unverified educator gets 403.
- **Storage:** no policy on `storage.objects` is created; the service role
  signs uploads. Replacing or removing an image clears the path only; the old
  file stays (see `docs/ADMIN_BACKEND_TODO.md`, "Test images: orphaned files").

**Revoking sessions:** `auth.admin.signOut(jwt, scope)` needs the user's own access
token, so revoking *another* user's tokens isn't possible with signOut. The function
ends their app-level sessions and returns `tokens_revoked: false`.

**JWT verification:** `send-notification-emails` uses `verify_jwt = true`, which
requires a JWT bearer token. If the project uses the new non-JWT secret keys
(`sb_secret_…`), either call it with a legacy service-role JWT, or set
`verify_jwt = false` for it and rely on `x-cron-secret` (needs the lead's decision).

## Deploy (only after the migrations are pushed, with the lead's approval)

```sh
supabase functions deploy create-educator-invites
supabase functions deploy revoke-user-sessions
supabase functions deploy send-notification-emails
supabase functions deploy sign-educator-document
supabase functions deploy educator-upload-url        # after 20261028090100 and 20261028110000
supabase functions deploy asset-upload-url           # after 20261029110000
supabase functions deploy set-user-ban               # after 20261102090000
supabase functions deploy evaluate-subjective        # after 20261115090000, with OPENAI_API_KEY set
# placeholders: leave undeployed until the payments model exists
```

## Scheduling

The database cron jobs are created by migration `20261025120800_admin_cron.sql`:
- `adm_release_scheduled_series`, every 5 minutes;
- `adm_dispatch_due_notifications`, every minute;
- `adm_detect_repeated_questions`, `adm_purge_expired_report_results` and
  `adm_purge_old_admin_auth_events`, daily.

`send-notification-emails` is an HTTP function. Schedule it with Supabase Cron
(HTTP request) or an external scheduler, with `Authorization: Bearer
<service-role key>`, for example every minute.
