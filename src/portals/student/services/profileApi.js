import { supabase } from "../../../services/supabaseClient";
import { normalizeRpcError } from "./studentRpc";

// The caller's own profiles + student_profiles rows (lead tables, written
// directly under the lead's RLS: a user may read / update their own row).
// role and email are never written here: role is set by the admin side,
// email belongs to Supabase Auth.
export const PROFILE_FIELDS = ["full_name", "phone", "location"];
export const STUDENT_FIELDS = ["grade", "school_name", "age", "gender", "father_name", "mother_name", "parent_email", "interests"];

function pick(source, keys) {
  return Object.fromEntries(keys.filter((k) => k in source).map((k) => [k, source[k]]));
}

async function unwrap(builder) {
  const { data, error } = await builder;
  if (error) throw normalizeRpcError(error);
  return data;
}

export const profileApi = {
  async get(userId) {
    const [profile, student] = await Promise.all([
      unwrap(supabase.from("profiles").select("id, full_name, email, phone, location, avatar_url").eq("id", userId).maybeSingle()),
      unwrap(supabase.from("student_profiles").select(STUDENT_FIELDS.join(", ")).eq("user_id", userId).maybeSingle()),
    ]);
    return { profile: profile ?? null, student: student ?? {} };
  },

  async save(userId, values) {
    const profile = pick(values, PROFILE_FIELDS);
    const student = pick(values, STUDENT_FIELDS);
    if (Object.keys(profile).length) {
      await unwrap(supabase.from("profiles").update(profile).eq("id", userId));
    }
    if (Object.keys(student).length) {
      await unwrap(supabase.from("student_profiles").upsert({ user_id: userId, ...student }, { onConflict: "user_id" }));
    }
  },
};

export default profileApi;
