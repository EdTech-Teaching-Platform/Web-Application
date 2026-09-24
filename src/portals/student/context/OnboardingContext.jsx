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
// from an earlier pass and are back now. No email/password/confirm-password
// collection and no separate Terms step — those aren't in the doc's field
// list for this flow. Review's demo-mode register() call still uses the
// phone number as a stand-in identifier; before wiring a real backend,
// product needs to confirm where email/password actually get collected for
// student sign-up, since this flow doesn't show it.
const OnboardingContext = createContext(null);

const initialForm = {
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
};

export function OnboardingProvider({ children }) {
  const [form, setForm] = useState(initialForm);

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
