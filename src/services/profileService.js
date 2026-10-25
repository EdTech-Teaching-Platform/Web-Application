import { supabase } from "./supabaseClient";

// The lead's database has NO signup trigger on auth.users, so the app creates
// the profiles + student_profiles rows after the first sign-in.
//
// Rules:
// - The role is always 'student'. Nothing the caller passes can change it
//   (educators and admins get their role from the lead / admin side).
// - Google users: name and avatar come from user_metadata.
// - Idempotent and race-safe: concurrent calls for the same user share one
//   request, and the insert ignores an existing row.

export const PROFILE_COLUMNS = "id, role, full_name, email, avatar_url";

const inFlight = new Map();

export class ProfileSetupError extends Error {
  constructor(cause) {
    super("We couldn't set up your profile. Please sign out and try again, or contact support if it keeps happening.");
    this.name = "ProfileSetupError";
    this.cause = cause;
  }
}

export function profileSeedFromUser(user) {
  const meta = user?.user_metadata ?? {};
  const email = user?.email ?? "";
  const fullName = String(meta.full_name || meta.name || (email ? email.split("@")[0] : "") || "Student").trim();
  return {
    id: user.id,
    role: "student",
    full_name: fullName.slice(0, 200),
    email,
    avatar_url: meta.avatar_url || meta.picture || null,
  };
}

async function readProfile(userId) {
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureStudentRow(userId) {
  // Insert-or-ignore; a failure here must not block sign-in (the Account page retries).
  await supabase.from("student_profiles").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
}

async function run(user) {
  let profile = await readProfile(user.id);
  if (!profile) {
    const { error } = await supabase
      .from("profiles")
      .upsert(profileSeedFromUser(user), { onConflict: "id", ignoreDuplicates: true });
    profile = await readProfile(user.id);
    if (!profile) throw new ProfileSetupError(error);
  }
  if (profile.role === "student") await ensureStudentRow(user.id);
  return profile;
}

/**
 * Returns the caller's profiles row, creating it (and student_profiles) on the
 * first sign-in.
 * @param {object} user Supabase auth user (session.user)
 * @returns {Promise<{id, role, full_name, email, avatar_url}|null>}
 */
export function ensureProfile(user) {
  if (!user?.id) return Promise.resolve(null);
  if (!inFlight.has(user.id)) {
    const pending = run(user).finally(() => inFlight.delete(user.id));
    inFlight.set(user.id, pending);
  }
  return inFlight.get(user.id);
}
