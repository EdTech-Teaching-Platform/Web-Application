# Security Test Results

Every database test ran against a **local, disposable** Postgres (PGlite). That's the lead's schema from `docs/existing_Schema.sql` plus all 60 migrations, rolled back after each run. Nothing ran against the live project.

## Executed

| Test / tool | What it checks | Result |
|---|---|---|
| `supabase/tests/security_rbac_sweep.sql` (new) | Calls **all 372** project functions with NULL arguments as **anon** and as a **student**; RLS and grants on our tables; `search_path` on SECURITY DEFINER functions | ✅ Pass. Anon could run only the catalogue (plus 2 stand-ins for the lead's functions; SEC-04). A student could run only student / self-scoped functions. 0 findings for our tables and functions. |
| `supabase/tests/security_idor.sql` (new) | 25 cross-user checks with real IDs | ✅ 25/25 |
| Existing SQL suites (16 files) | Student, educator, admin, blocking, notifications, AI evaluation, documents, assets, QA fixes | ✅ All pass; editor lifecycle flow 41/41 |
| `admin_rpcs.sql` | Older contract test | ❌ Was already failing before the audit: it expects discount RPCs that were never ported. Not security-related. |
| `tests/security.test.jsx` (new, vitest) | XSS payloads, unsafe-render guard, open redirects, secrets in `src/`, `.env` ignored, headers config, constant-time compare, CORS | ✅ 21/21 |
| Full frontend suite (vitest) | Regression | ✅ 25 files, 327 tests |
| `npm run build` | Regression | ✅ |
| `npm audit` | Dependency advisories | Before: 9 (2 critical, 6 high, 1 moderate). After the fixes: the remaining ones are dev / build-only (SEC-09, SEC-10). |
| Git history secret scan (custom patterns: JWT, `sk-`, `sb_secret_`, service-role, Postgres URLs, AWS, Resend, Razorpay) over 107 commits | Leaked secrets | One `.env` with an old project's **anon** key (public); one documentation placeholder. No secret keys (SEC-11). |
| SQL static checks (parser, search_path hardening) | Function bodies | ✅ 497 bodies parse; 467 functions pinned |
| `oxlint` on the changed files | Lint | No errors; only older warnings (unused imports and similar) |

## Not executed (and why)

| Test | Why not | What to do |
|---|---|---|
| Live RLS / policy checks on the lead's tables | Project rule: no SQL against the live database without approval; the schema dump has no policies | Run the read-only queries in `PENDING_ISSUES.md` (SEC-03) |
| OWASP ZAP (dynamic scan) | No running staging URL in this session | Run a ZAP baseline scan against a **preview / staging** deployment |
| Semgrep, Gitleaks | Not installed in this environment | Covered partly by the custom secret scan and code review; run both in CI |
| Supabase Auth brute-force / rate-limit tests | Platform-side; can't test without a live project | Check the dashboard settings (SEC-05) |
| Served HTTP headers | Needs a deployment | `curl -I https://<preview-url>` after deploy |
| Live OpenAI call through `evaluate-subjective` | Needs the deployed function and its secret | Test once on staging |
| Load / DoS testing | Out of scope | — |
| Lead's own database functions | Not in the repository | SEC-04 query |

## Failed tests

None among the security tests. The only failing suite is `admin_rpcs.sql`, which was already failing for reasons unrelated to security.
