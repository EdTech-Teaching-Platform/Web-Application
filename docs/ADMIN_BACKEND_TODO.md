# Admin backend follow-up

The following screens remain mock-backed because the supplied schema has no
complete contract for them:

- Course approval
- Regional heads
- Escalations
- Content moderation
- Settings and permissions
- Audit logs (except auth-event data where available)
- Institution management
- Region/branch hierarchy
- Management dashboards
- AI test builder

The Supabase client, session-backed authentication, admin RPC normalization,
dashboard service surface, and the auth-user trigger are implemented. Remaining
schema-backed page wiring should use the RPC service conventions in
`src/portals/admin/services/adminApi.js` and `src/portals/admin/hooks/useRpc.js`.
