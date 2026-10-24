# Production security TODO

Before production launch, complete and verify each item below. Checkboxes are
deliberately not marked complete until they have been demonstrated against the
linked Supabase project.

- [ ] Audit all public tables for RLS.
- [ ] Revoke anonymous execution on admin RPCs while preserving
  `submit_callback_request`.
- [ ] Add storage policies for educator documents, report exports, and avatars.
- [ ] Verify the anon key cannot read protected admin tables.
- [ ] Retest every admin page with RLS enabled.
- [ ] Rotate development keys and remove development users/seed data.
- [ ] Enable auth email confirmation.
- [ ] Rotate all local development keys and remove seeded development users.
- [ ] Deploy and configure Edge Functions with gateway/email secrets; keep
      service-role credentials out of browser bundles and logs.
- [ ] Add monitoring/alerting for failed RPCs, auth events, refunds, and
      function invocations.
- [ ] Run `supabase/tests/admin_rpcs.sql` and the browser test/build checks in
      CI against a disposable project.
