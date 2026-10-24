# Supabase Edge Functions

Phase 5 adds the following functions under `supabase/functions`:

| Function | Purpose | Invocation |
| --- | --- | --- |
| `create-educator-invites` | Creates pending invite rows, sends Supabase Auth invites, and registers educators | Authenticated admin |
| `revoke-user-sessions` | Revokes all sessions for a user | Authenticated admin |
| `send-notification-emails` | Drains queued notification email recipients (100 per call) | Scheduled/service call |
| `payment-webhook` | Verifies the payment gateway HMAC and records captured/refunded payments | Gateway webhook |
| `process-refund` | Sends an approved refund to the payment gateway and records the result | Authenticated admin |
| `ai-generate-test` | Creates an AI job and generates a JSON test using the configured model | Authenticated admin |

## Secrets

Set these in the Supabase project (never in the frontend or repository):

```sh
supabase secrets set PAYMENT_WEBHOOK_SECRET=...
supabase secrets set PAYMENT_PROVIDER_KEY=... PAYMENT_REFUND_URL=https://provider.example/refunds
supabase secrets set EMAIL_PROVIDER_KEY=... EMAIL_PROVIDER_URL=https://provider.example/send
supabase secrets set EMAIL_CRON_SECRET=...
supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=gpt-4o-mini
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the Edge Runtime. The email and payment provider payloads are intentionally generic; adapt the provider request and signature format before production use.

## Deploy

From the repository root, after linking the project:

```sh
supabase link --project-ref <project-ref>
supabase functions deploy create-educator-invites
supabase functions deploy revoke-user-sessions
supabase functions deploy send-notification-emails
supabase functions deploy payment-webhook --no-verify-jwt
supabase functions deploy process-refund
supabase functions deploy ai-generate-test
```

Configure the payment provider webhook URL as:
`https://<project-ref>.supabase.co/functions/v1/payment-webhook`.

## Cron / scheduling

The database migration already provides `dispatch_due_notifications()`, which should run every minute using `pg_cron`:

```sql
select cron.schedule(
  'dispatch-notifications',
  '* * * * *',
  $$select public.dispatch_due_notifications()$$
);
```

Schedule `send-notification-emails` with Supabase Cron or an external scheduler. It must include `x-cron-secret: <EMAIL_CRON_SECRET>` and the project URL, and should run frequently enough to drain the queue (for example every minute). Do not schedule the webhook or admin-only functions.

## Contract notes

The functions call the migration contracts `create_educator_invites`, `register_educator`, `revoke_user_sessions`, `mark_payment_paid`, `mark_payment_refunded`, `record_refund_gateway_result`, and the `ai_test_jobs` tables. Run all migrations before deploying. Gateway, email, and OpenAI credentials/providers are not included in this repository.
