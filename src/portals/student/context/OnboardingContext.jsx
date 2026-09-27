import { createContext, useContext, useMemo, useState } from "react";

// Onboarding-flow-local state — deliberately NOT src/context/AuthContext.jsx
// (that's global auth/session state) and not promoted to a shared location.
// Per the repo README's rule, a piece of state stays inside the portal that
// needs it until a second portal needs the same thing.
//
// 4-step flow (Basics → Details → Interests → Review), fields per LMS doc
// Sec 5.1 Student Onboarding: "grade/class (1st–12th), interests and
// learning goals, name/age/city/school, phone and a parent contact number,
// optional ID upload." Age and the full 1st–12th grade range were missing
// from an earlier pass and are back now. This wizard itself still doesn't
// collect email/password — those now live on the standalone Sign Up page
// (src/auth/pages/Register.jsx), which runs BEFORE onboarding and stashes
// {fullName, email, password} in sessionStorage under
// PENDING_SIGNUP_STORAGE_KEY. The provider below reads that once on mount
// so the final onboarding step (Interests) can create the account with the
// real credentials the user just entered on Sign Up, instead of onboarding
// re-collecting or re-deriving them.
const OnboardingContext = createContext(null);

export const PENDING_SIGNUP_STORAGE_KEY = "ul-pending-signup";

const baseForm = {
  // Basics (Step 01)
  fullName: "",
  age: "",
  grade: "",
  city: "",
  school: "",
  // Details (Step 02)
  phone: "",
  parentPhone: "",
  idFile: null,
  // Interests (Step 03) — interests is multi-select (array), goal is
  // single-select (string); see build-spec flag on cardinality.
  interests: [],
  goal: "",
  // Carried over from the Sign Up page (not edited in this wizard) — see
  // comment above.
  email: "",
  password: "",
};

function readPendingSignup() {
  try {
    const raw = sessionStorage.getItem(PENDING_SIGNUP_STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return {
      fullName: data.fullName || "",
      email: data.email || "",
      password: data.password || "",
    };
  } catch {
    return {};
  }
}

export function OnboardingProvider({ children }) {
  const [form, setForm] = useState(() => ({ ...baseForm, ...readPendingSignup() }));

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const toggleInterest = (subject) =>
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(subject)
        ? f.interests.filter((s) => s !== subject)
        : [...f.interests, subject],
    }));

  const value = useMemo(() => ({ form, set, setForm, toggleInterest }), [form]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within an OnboardingProvider");
  return ctx;
}
