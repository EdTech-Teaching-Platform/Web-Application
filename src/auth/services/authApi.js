import apiClient from "../../services/apiClient";

// Auth API layer, built on the shared apiClient — proposed per the build
// spec (Section 6, open question 3): the LMS doc is functional, not the
// Technical Design Doc, and no auth/services folder or endpoint paths
// exist yet anywhere in the repo. Confirm every path below with whoever
// owns the Technical Design Document before removing DEMO_MODE.
//
// DEMO_MODE lets the 5 auth screens be built, wired, and demoed end-to-end
// without a live backend. Flip it off once the endpoints above are real —
// no call sites need to change, only this flag.
const DEMO_MODE = true;

function demoDelay(ms = 900) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// payload: { fullName, role: "student" | "educator", identifier, password }
export async function register(payload) {
  if (DEMO_MODE) {
    await demoDelay();
    return { data: { ok: true } };
  }
  return apiClient.post("/auth/register", payload);
}

// payload: { identifier, password }
// Password is step one of a mandatory two-step login: every successful
// password check is now followed by a one-time code sent to the user's
// email/phone (see requestLoginOtp/verifyLoginOtp below) — dashboard access
// is only granted once that code is verified too. Returns the account's
// role so, once the OTP step passes, Login knows which portal to send the
// person to. DEMO_MODE has no real backend to ask, so it infers a demo role
// from the identifier itself ("admin@…" / "superadmin@…" → those roles,
// anything else → student) purely so this flow is exercisable without a
// live API — replace with the real role from the login response once the
// backend exists.
export async function login(payload) {
  if (DEMO_MODE) {
    await demoDelay();
    const id = payload.identifier.toLowerCase();
    const role = id.includes("superadmin") ? "super_admin" : id.includes("admin") ? "admin" : "student";
    return { data: { ok: true, role } };
  }
  return apiClient.post("/auth/login", payload);
}

// payload: { identifier } — sent right after password succeeds, for every
// role. Platform-generated and delivered to the user's email/phone (unlike
// an authenticator-app TOTP), so this pairs with a resend/cooldown on the
// Verify screen the same way account verification does.
export async function requestLoginOtp(payload) {
  if (DEMO_MODE) {
    await demoDelay();
    return { data: { ok: true } };
  }
  return apiClient.post("/auth/login/otp/request", payload);
}

// payload: { identifier, code } — completes the mandatory post-login OTP
// step for every role. Only once this succeeds does the user actually get
// into their dashboard.
export async function verifyLoginOtp(payload) {
  if (DEMO_MODE) {
    await demoDelay();
    if (payload.code?.length !== 6) throw new Error("invalid_code");
    return { data: { ok: true } };
  }
  return apiClient.post("/auth/login/otp/verify", payload);
}

// payload: { identifier, code }
export async function verifyAccountOtp(payload) {
  if (DEMO_MODE) {
    await demoDelay();
    if (payload.code?.length !== 6) throw new Error("invalid_code");
    return { data: { ok: true } };
  }
  return apiClient.post("/auth/verify", payload);
}

// payload: { identifier, purpose: "register" | "login-otp" }
export async function resendOtp(payload) {
  if (DEMO_MODE) {
    await demoDelay(500);
    return { data: { ok: true } };
  }
  return apiClient.post("/auth/otp/resend", payload);
}

// payload: { identifier }
export async function requestPasswordReset(payload) {
  if (DEMO_MODE) {
    await demoDelay();
    return { data: { ok: true } };
  }
  return apiClient.post("/auth/password/forgot", payload);
}

// payload: { token, password }
export async function resetPassword(payload) {
  if (DEMO_MODE) {
    await demoDelay();
    if (payload.token === "expired") throw new Error("invalid_token");
    return { data: { ok: true } };
  }
  return apiClient.post("/auth/password/reset", payload);
}
