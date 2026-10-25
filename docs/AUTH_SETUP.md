# Auth setup (Supabase Auth)

The app uses Supabase Auth directly. The demo login, the fake OTP and Apple
sign-in are gone.

This page covers:
- what the project owner must configure in the Supabase dashboard;
- how each flow behaves;
- how to test it locally.

> **Status (2026-10-26):** the dashboard isn't configured yet: no Google
> provider, no redirect URLs, no SMTP. Email confirmation is **off** for
> development.
>
> | Flow | Status |
> |---|---|
> | Email + password sign-up and login | Testable now |
> | Google sign-in | **UNTESTED** |
> | Forgot / reset password | **UNTESTED** |
>
> Until it's configured, the app shows a clear message instead of failing
> (see "When something isn't configured").

## 1. Dashboard settings

Everything below is in Supabase Dashboard → Authentication.

### URL Configuration
- **Site URL:** the production app origin, e.g. `https://app.example.com`.
- **Redirect URLs.** Add each origin you use with both paths:
  - `https://app.example.com/auth/callback`
  - `https://app.example.com/reset-password`
  - `http://localhost:5173/auth/callback`
  - `http://localhost:5173/reset-password`
  - the same two paths for any preview / staging origin.

  `/auth/callback` receives email confirmation and Google sign-in.
  `/reset-password` receives the recovery link. Supabase only redirects to URLs
  on this list; anything else falls back to the Site URL.

### Providers
- **Email:** enabled.
  - "Confirm email" is **off** for development; turn it **on** for production.
  - Minimum password length is 8. The app also requires a letter and a number.
- **Google: UNTESTED.** Enable it and paste the Google OAuth client ID and
  secret. In Google Cloud Console → Credentials → OAuth client:
  - **Authorised JavaScript origins:** the app origins.
  - **Authorised redirect URI:** `https://<project-ref>.supabase.co/auth/v1/callback`.
- **Apple:** leave it **off**. The app has no Apple button.

### SMTP: UNTESTED
Project Settings → Authentication → SMTP: set a custom SMTP sender (host, port,
user, password, from address). The built-in sender is rate-limited and only for
testing, so production needs this for confirmation and password-reset emails.

### Email templates (optional)
"Confirm signup" and "Reset password" can keep the default templates. They use
`{{ .ConfirmationURL }}`, which already carries the redirect the app passes.

### Database: profiles (lead's decision)
The lead's database has **no signup trigger**. The app creates the rows itself
after the first sign-in (`src/services/profileService.js`):
- `profiles`: `{id, role: 'student', full_name, email, avatar_url}`;
- `student_profiles`: `{user_id}`.

The lead's RLS must allow an authenticated user to insert and update **their
own** row in both tables, and to read it. If it doesn't, sign-up shows "We
couldn't set up your profile…". The fix is an RLS policy or a signup trigger,
which is the lead's call.

The client never chooses the role. Educators and admins get theirs from the
admin side, and an admin also needs a row in `adm_admin_users`.

## 2. How each flow works

| Flow | What happens |
|---|---|
| **Sign up** (`/register`) | `supabase.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: <origin>/auth/callback } })`. With confirmation off, the user is signed in immediately and lands on `/student/dashboard`. With it on, they see "Check your inbox", then the link opens `/auth/callback`. |
| **Log in** (`/login`, `/teacher/login`) | `signInWithPassword`, then `ensureProfile`, then a redirect by role: student → `/student/dashboard`, admin / super_admin → `/admin/logindashboard`, educator → `/teacher/dashboard`. A same-site `?redirect=` wins. |
| **Google: UNTESTED** | The app first reads `GET /auth/v1/settings`. If Google is off, it shows a message and doesn't redirect. Otherwise it calls `signInWithOAuth({ provider: 'google', options: { redirectTo: <origin>/auth/callback } })`. The callback waits for the session and redirects by role. The name and avatar come from Google's metadata. |
| **Forgot password: UNTESTED** (`/forgot-password`) | `resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })`. The confirmation reads the same whether or not the email has an account. Resend is available after 60 seconds. |
| **Reset password: UNTESTED** (`/reset-password`) | The recovery link signs the user in with a recovery session. States: loading → form (strength rule + confirm) → `updateUser({ password })` → success. An expired or used link (`error_code=otp_expired` in the URL), or no session, shows "This link has expired". |
| **Logout** | Calls `record_logout` (best effort), then `signOut()`, and clears per-user local storage. "Go to homepage" in the navbar signs out too. |
| **Reload** | The session is restored from storage (`INITIAL_SESSION`). Protected routes show a skeleton until it's ready, so a signed-in user is never bounced to `/login`. |

## 3. When something isn't configured

| Missing | What the user sees |
|---|---|
| Google provider off | "Google sign-in isn't set up for this site yet. Please use your email and password." Shown on the login / sign-up page, with no redirect. |
| Redirect URL not on the allow-list | Supabase sends the user to the Site URL instead; `/auth/callback` is never reached. Add the URL (section 1). |
| SMTP / email sending fails | "We couldn't send the email right now. Email delivery may not be set up yet; please contact support." |
| Too many requests (rate limit) | "Too many attempts. Please wait a minute and try again." |
| Profile row can't be created (RLS) | "We couldn't set up your profile. Please sign out and try again, or contact support if it keeps happening." |
| Expired / used email link | `/auth/callback` shows "Sign-in didn't complete"; `/reset-password` shows "This link has expired" with a "Request a new link" button. |

## 4. Testing locally

1. **Configure the app.** Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   in `.env`, then run `npm run dev` (http://localhost:5173).
2. **Sign up.** Open `/register` and enter a name, a new email and a password
   like `secret12`.
   - With confirmation off, you land on `/student/dashboard`.
   - In the Supabase table editor, `profiles` should have your row with role
     `student`, and `student_profiles` a row with your id.
3. **Reload** `/student/dashboard`. You stay signed in.
4. **Log out** from the navbar, then log in at `/login` with the same details.
5. **Wrong password:** you see "Incorrect email or password."
6. **Existing email on `/register`:** you see "An account with this email
   already exists. Log in instead."
7. **Admin login.** Use an account with role admin / super_admin **and** an
   `adm_admin_users` row. `/login` or `/admin/login` should send you to
   `/admin/logindashboard`.
8. **Google: UNTESTED.** After section 1 is done, click "Continue with Google"
   and expect `/auth/callback`, then the dashboard. Before then, expect the
   "isn't set up" message.
9. **Forgot / reset: UNTESTED.** After SMTP and the redirect URLs are set:
   1. Request a link at `/forgot-password` and open it.
   2. Set a new password.
   3. Log in with it.
   4. Open the same link again: you should see "This link has expired".
10. **Unit tests:** `npm test` covers the validators, `ensureProfile` (inserts
    once, role is always student, no `.catch` on query builders), the reset
    page states and the callback redirects (`tests/auth-flow.test.jsx`).

## 5. What breaks outside the student and admin portals

The teacher and Regional Head portals still run on their old mock stores:
- the teacher portal uses `src/portals/teacher/data/educatorAccountStore.js`
  (localStorage);
- the Regional Head portal uses `regionalHeadsMock.js` / `regionalPortalMock.js`.

What that means:
- **Teacher registration** (`/teacher/registration`) still creates a localStorage
  account and a local `setUser` session. It isn't a Supabase account, so the
  session disappears on reload, and that email can't log in at `/teacher/login`.
- **`/teacher/login`** now uses real Supabase Auth. Only a real `profiles` row
  with role `educator` can sign in. `TeacherLayout` still reads the localStorage
  educator record, so a real educator without one may land in the
  pending / locked state.
- **The Regional Head login** (`/regionalhead/login`) is a local mock session:
  no Supabase account, and lost on reload.
- **The old student onboarding wizard** (`/student/onboarding/*`) created demo
  accounts. It now redirects to `/register`, or to `/student/account` when
  signed in.
