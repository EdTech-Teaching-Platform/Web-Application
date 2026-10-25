# Supabase Edge Functions (admin port on the lead's database)

Nothing here is deployed by the port. Deploy only with the lead's approval.

| Function | Purpose | Caller | `verify_jwt` |
| --- | --- | --- | --- |
| `create-educator-invites` | `create_educator_invites` (de-duplicates and queues), then `auth.admin.inviteUserByEmail`, then `register_educator` (service role). That inserts `profiles` (role `educator`), `educator_profiles` (phone or `''`, location `Not provided`, `verification_status 'pending'`, totals 0) and `educator_admin_state`. If registration fails, the auth user is deleted again. Returns per-row `results` (`sent` / `skipped` / `failed`). | Admin or super_admin | true |
| `revoke-user-sessions` | `revoke_user_sessions` RPC (app-level sessions), plus Admin API `signOut` for the caller's own token (`scope` `global` / `others`). It cannot revoke another user's refresh tokens; see the note below. | Admin or super_admin | true |
| `send-notification-emails` | Sends queued campaign emails through Resend (`fetch`). It re-checks `notification_preferences.email`, then `record_email_results`. | Service-role bearer token (cron), or `x-cron-secret` | true |
| `sign-educator-document` | Admin check, then a service-role signed URL for an `educator_verification_docs.doc_url` (looked up by `documentId` or `path`). | Admin or super_admin | true |
| `payment-webhook` | Placeholder (D1). Calls the `mark_payment_*` stubs, which raise `0A000`. | Gateway (HMAC) | **false** |
| `process-refund` | Placeholder (D1). Reads `refund_requests`, which doesn't exist in the lead's database. | Admin | true |
| `ai-generate-test` | Placeholder (unchanged). | Admin | true |

The admin check (`_shared/auth.ts` → `_shared/roles.ts`) accepts `profiles.role` of
`admin` or `super_admin`.

## Secrets

```sh
supabase secrets set RESEND_API_KEY=... EMAIL_FROM="Universal Learning <noreply@your-domain>"
supabase secrets set EDUCATOR_DOCS_BUCKET=<the lead's verification-docs bucket>   # required: there is no docs/db_inspection/buckets.csv
supabase secrets set EDUCATOR_INVITE_REDIRECT_URL=https://<site>/teacher/login     # optional
supabase secrets set EMAIL_CRON_SECRET=...                                         # optional alternative to the service-role bearer
# optional: EMAIL_BATCH_SIZE (default 100), EDUCATOR_DOCS_URL_TTL (seconds, default 300)
# placeholders only: PAYMENT_WEBHOOK_SECRET, PAYMENT_PROVIDER_KEY, PAYMENT_REFUND_URL, OPENAI_API_KEY, OPENAI_MODEL
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the
Edge Runtime.

**Signing a document:** `sign-educator-document` signs only paths that appear in
`educator_verification_docs.doc_url`. A full Supabase storage URL in `doc_url` is
signed in the bucket named in that URL, and a non-storage URL is returned
unchanged (`external: true`).

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
