import { supabase } from "../../../services/supabaseClient";
import { profileApi } from "../services/profileApi";

// Post-Google-sign-in onboarding helpers. Nothing here writes to the
// database: "new account" comes from the auth user's own timestamps and
// "complete" from the profile fields the wizard fills in, so no new column
// or migration is needed.

const skipKey = (userId) => `ul.onboarding.skipped.${userId}`;

export function markOnboardingSkipped(userId) {
  try {
    window.localStorage.setItem(skipKey(userId), "1");
  } catch {
    // storage can be unavailable; the wizard then simply shows again next sign-in
  }
}

function wasSkipped(userId) {
  try {
    return window.localStorage.getItem(skipKey(userId)) === "1";
  } catch {
    return false;
  }
}

// The signed-in Supabase auth user for the current session (or null).
async function sessionUser() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user ?? null;
}

function isGoogleUser(authUser) {
  if (authUser?.app_metadata?.provider === "google") return true;
  return Array.isArray(authUser?.identities) && authUser.identities.some((i) => i.provider === "google");
}

// Supabase stamps created_at when the account is created and last_sign_in_at on
// every sign-in, so on a brand-new account the two are (almost) the same moment.
// Anyone signing in again later has a last_sign_in_at well after created_at.
const NEW_ACCOUNT_WINDOW_MS = 2 * 60 * 1000;
export function isNewAccount(authUser) {
  const created = Date.parse(authUser?.created_at ?? "");
  const lastSignIn = Date.parse(authUser?.last_sign_in_at ?? "");
  if (Number.isNaN(created) || Number.isNaN(lastSignIn)) return false;
  return Math.abs(lastSignIn - created) <= NEW_ACCOUNT_WINDOW_MS;
}

// A student who has none of the onboarding details yet.
export function isProfileIncomplete({ profile, student }) {
  return !(student?.grade || student?.school_name || profile?.phone || profile?.location);
}

// Should this signed-in student be sent through onboarding first?
// Only when their account was JUST created through Google (first sign-in),
// they have no profile details and haven't skipped. Returning users, whether
// or not they finished onboarding, go straight to their dashboard.
// Any failure answers false, so a sign-in is never blocked by this check.
export async function needsGoogleOnboarding(user) {
  try {
    if (!user || user.role !== "student" || wasSkipped(user.id)) return false;
    const authUser = await sessionUser();
    if (!authUser || !isGoogleUser(authUser) || !isNewAccount(authUser)) return false;
    return isProfileIncomplete(await profileApi.get(user.id));
  } catch {
    return false;
  }
}
