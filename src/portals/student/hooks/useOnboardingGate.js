import { useEffect, useRef, useState } from "react";
import { needsStudentOnboarding, markOnboardingPrompted, wasOnboardingPrompted } from "../utils/onboarding";

// QA (07 Nov): after sign-in a student with missing mandatory profile details
// is sent to the onboarding wizard automatically (email, Google or any other
// way in). Checked once per browser session, so a student who chose "Skip for
// now" or finished is not bounced around; a complete profile is never asked
// again (the status comes from the saved profile, so it persists).
// Returns { checking, redirectTo }: redirectTo is the wizard URL or null.
export function useOnboardingGate(user, { check = needsStudentOnboarding, path = "" } = {}) {
  const userId = user?.id ?? null;
  const isStudent = user?.role === "student";
  const [state, setState] = useState(() => ({
    userId,
    checking: Boolean(userId && isStudent && !wasOnboardingPrompted(userId)),
    redirectTo: null,
  }));
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    if (!userId || !isStudent || wasOnboardingPrompted(userId)) {
      setState({ userId, checking: false, redirectTo: null });
      return undefined;
    }
    let cancelled = false;
    setState({ userId, checking: true, redirectTo: null });
    Promise.resolve(check(user)).then((needs) => {
      if (cancelled) return;
      markOnboardingPrompted(userId);
      const back = pathRef.current && pathRef.current !== "/student/dashboard" ? `?redirect=${encodeURIComponent(pathRef.current)}` : "";
      setState({ userId, checking: false, redirectTo: needs ? `/student/onboarding${back}` : null });
    }).catch(() => { if (!cancelled) setState({ userId, checking: false, redirectTo: null }); });
    return () => { cancelled = true; };
    // the check runs per signed-in user, not per render of `user`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isStudent]);

  // a different user signed in: still checking until the effect above runs
  if (state.userId !== userId) return { checking: Boolean(userId && isStudent), redirectTo: null };
  return { checking: state.checking, redirectTo: state.redirectTo };
}
