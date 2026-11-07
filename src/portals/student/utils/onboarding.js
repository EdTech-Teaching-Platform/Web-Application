import { supabase } from "../../../services/supabaseClient";
import { profileApi } from "../services/profileApi";

// Student onboarding rules. Nothing here writes to the database: "complete"
// comes from the profile fields the wizard fills in (profiles +
// student_profiles), so the status persists across sessions and devices with
// no new column or migration.
//
// QA (07 Nov): every student with missing mandatory details is sent to the
// onboarding wizard after sign-in, not only brand-new Google accounts. The
// student layout checks once per browser session (StudentOnboardingGate);
// "Skip for now" lasts until the next sign-in.

// The details a student must have before using the portal (the wizard's
// required fields that live on the profile).
export const MANDATORY_STUDENT_FIELDS = [
  ["full_name", "your name"],
  ["grade", "your grade"],
  ["school_name", "your school"],
  ["location", "your city"],
  ["phone", "your phone number"],
];

const text = (v) => String(v ?? "").trim();

// [{key, label}] of the mandatory details that are still missing.
export function missingStudentDetails({ profile, student } = {}) {
  const values = {
    full_name: profile?.full_name, location: profile?.location, phone: profile?.phone,
    grade: student?.grade, school_name: student?.school_name,
  };
  return MANDATORY_STUDENT_FIELDS.filter(([key]) => text(values[key]) === "").map(([key, label]) => ({ key, label }));
}

export function isStudentProfileComplete(rows) {
  return missingStudentDetails(rows).length === 0;
}

// Kept for older callers: a student who has none of the onboarding details yet.
export function isProfileIncomplete({ profile, student }) {
  return !(student?.grade || student?.school_name || profile?.phone || profile?.location);
}

// ------------------------------------------------ per-session prompt / skip
const skipKey = (userId) => `ul.onboarding.skipped.${userId}`;
const promptedKey = (userId) => `ul.onboarding.prompted.${userId}`;

function sessionGet(key) {
  try { return window.sessionStorage.getItem(key) === "1"; } catch { return false; }
}
function sessionSet(key) {
  try { window.sessionStorage.setItem(key, "1"); } catch { /* storage unavailable: asked again next load */ }
}

// "Skip for now": not asked again in this browser session; asked again after
// the next sign-in (a new session) while details are still missing.
export function markOnboardingSkipped(userId) {
  sessionSet(skipKey(userId));
}
export function wasOnboardingSkipped(userId) {
  return sessionGet(skipKey(userId));
}
// The gate sends a student to the wizard at most once per session.
export function markOnboardingPrompted(userId) {
  sessionSet(promptedKey(userId));
}
export function wasOnboardingPrompted(userId) {
  return sessionGet(promptedKey(userId));
}

// Supabase stamps created_at when the account is created and last_sign_in_at on
// every sign-in, so on a brand-new account the two are (almost) the same moment.
const NEW_ACCOUNT_WINDOW_MS = 2 * 60 * 1000;
export function isNewAccount(authUser) {
  const created = Date.parse(authUser?.created_at ?? "");
  const lastSignIn = Date.parse(authUser?.last_sign_in_at ?? "");
  if (Number.isNaN(created) || Number.isNaN(lastSignIn)) return false;
  return Math.abs(lastSignIn - created) <= NEW_ACCOUNT_WINDOW_MS;
}

// Should this signed-in student be sent through onboarding now?
// Yes when a mandatory detail is missing and they haven't skipped in this
// session. Any failure answers false, so a sign-in is never blocked by it.
export async function needsStudentOnboarding(user, { api = profileApi } = {}) {
  try {
    if (!user || user.role !== "student" || wasOnboardingSkipped(user.id)) return false;
    return !isStudentProfileComplete(await api.get(user.id));
  } catch {
    return false;
  }
}

// AuthCallback (Google / email-link sign-in) uses this name; the rule is now
// the same for every student (see needsStudentOnboarding).
export async function needsGoogleOnboarding(user) {
  return needsStudentOnboarding(user);
}

// The signed-in Supabase auth user for the current session (or null).
export async function sessionUser() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user ?? null;
}
