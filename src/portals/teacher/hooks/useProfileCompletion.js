import { useEffect, useState } from "react";
import { educatorApi } from "../services/educatorApi";
import { validateOnboarding } from "../utils/onboarding";

// QA (07 Nov): an approved educator whose profile is missing details had to
// find the Profile page alone. The educator portal now checks once per browser
// session (after the verification gate lets them in) and sends them to
// /teacher/profile?complete=1, which lists what is missing. "Complete" comes
// from the saved profile (educator_get_profile), so it persists; a complete
// profile is never prompted. A failed check never blocks the portal.

// The profile fields an educator can fill in on /teacher/profile, with labels.
export const EDUCATOR_PROFILE_FIELDS = [
  ["phone", "phone number"],
  ["location", "city / location"],
  ["qualifications", "qualifications"],
  ["experience_years", "years of experience"],
  ["subjects", "subjects"],
  ["languages", "teaching languages"],
  ["bio", "bio"],
];

// [{key, label}] of the editable profile fields that are missing or invalid.
export function missingEducatorDetails(profile) {
  if (!profile || typeof profile !== "object") return [];
  const errors = validateOnboarding({ ...profile, full_name: profile.full_name || "Name" }, 0);
  return EDUCATOR_PROFILE_FIELDS.filter(([key]) => key in errors).map(([key, label]) => ({ key, label }));
}

const promptedKey = (userId) => `ul.educator.profilePrompted.${userId}`;
function wasPrompted(userId) {
  try { return window.sessionStorage.getItem(promptedKey(userId)) === "1"; } catch { return false; }
}
function markPrompted(userId) {
  try { window.sessionStorage.setItem(promptedKey(userId), "1"); } catch { /* storage unavailable */ }
}

// { checking, redirectTo }: redirectTo = "/teacher/profile?complete=1" or null.
export function useProfileCompletion(userId, { enabled = true, api = educatorApi, pathname = "" } = {}) {
  const active = Boolean(enabled && userId && !wasPrompted(userId));
  const key = `${userId}:${enabled}`;
  const [state, setState] = useState(() => ({ key, checking: active, redirectTo: null }));
  // no re-render when nothing changes (the gate's own effects stay undisturbed)
  const settle = (next) => setState((s) => (s.key === next.key && s.checking === next.checking && s.redirectTo === next.redirectTo ? s : next));

  useEffect(() => {
    if (!enabled || !userId || wasPrompted(userId)) { settle({ key, checking: false, redirectTo: null }); return undefined; }
    let cancelled = false;
    settle({ key, checking: true, redirectTo: null });
    Promise.resolve()
      .then(() => api.getProfile())
      .then((profile) => {
        if (cancelled) return;
        markPrompted(userId);
        const missing = missingEducatorDetails(profile);
        setState({ key, checking: false, redirectTo: missing.length ? "/teacher/profile?complete=1" : null });
      })
      .catch(() => { if (!cancelled) setState({ key, checking: false, redirectTo: null }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (state.key !== key) return { checking: active, redirectTo: null };
  // already on the profile page: no redirect needed (it shows the banner)
  if (state.redirectTo && pathname.startsWith("/teacher/profile")) return { checking: false, redirectTo: null };
  return { checking: state.checking, redirectTo: state.redirectTo };
}
