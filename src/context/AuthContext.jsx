import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { ensureProfile } from "../services/profileService";
import { logout as signOutRequest } from "../auth/services/authApi";
import { mapDbRole } from "../utils/roles";

export const AuthContext = createContext(null);

// Per-user caches cleared on logout (device preferences and the shared mock
// stores of the teacher / admin / regional-head portals are kept).
const USER_STORAGE_PREFIXES = [
  "ul_wishlist", "ul_assessment", "ul_test_series_purchases", "ul_activity_log", "ul_course_progress",
  "ul_course_qa", "ul_learning_time", "ul_student_", "ul_demo_orders", "ul.testSeries",
  "universal-learning-", "ul-pending-signup", "ul.educator.session",
];

export function clearUserStorage(storage = typeof window === "undefined" ? null : window.localStorage) {
  if (!storage) return;
  try {
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) keys.push(storage.key(i));
    keys.filter((k) => k && USER_STORAGE_PREFIXES.some((p) => k.startsWith(p))).forEach((k) => storage.removeItem(k));
  } catch {
    // Storage can be unavailable (private mode); nothing to clear then.
  }
}

export function toAppUser(authUser, profile) {
  if (!authUser || !profile) return null;
  return {
    id: authUser.id,
    email: profile.email || authUser.email || "",
    name: profile.full_name || authUser.user_metadata?.full_name || "",
    role: mapDbRole(profile.role) || profile.role,
    dbRole: profile.role,
    avatarUrl: profile.avatar_url || authUser.user_metadata?.avatar_url || null,
  };
}

// Session state for the whole app.
//   user     the signed-in user ({id, email, name, role, dbRole, avatarUrl}) or null
//   role     user.role ("student" | "teacher" | "admin" | "regionalhead")
//   loading  true until the persisted session (or the one in the URL after a
//            redirect) has been read and the profile loaded; guards wait for it
//   recovery true after a password-recovery link (PASSWORD_RECOVERY)
//   error    a message when the profile could not be loaded / created
//   logout   signs out, clears per-user storage
//   setUser  sets a local, NOT persisted user: only the mock teacher and
//            regional-head flows use it; it never grants server access
export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState("");
  const currentId = useRef(null);

  const loadProfile = useCallback(async (authUser) => {
    try {
      const profile = await ensureProfile(authUser);
      if (currentId.current !== authUser.id) return;   // signed out meanwhile
      setUserState(toAppUser(authUser, profile));
      setError("");
    } catch (err) {
      if (currentId.current !== authUser.id) return;
      setUserState(null);
      setError(err?.message || "We couldn't load your profile.");
    } finally {
      if (currentId.current === authUser.id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION first (the stored session, or the
    // one detected in the URL), so no separate getSession() is needed. Supabase
    // calls must not be awaited inside this callback (it can deadlock the auth
    // client), so profile work is deferred to the next tick.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      const authUser = session?.user ?? null;
      if (!authUser) {
        currentId.current = null;
        setUserState(null);
        setLoading(false);
        return;
      }
      const changedUser = currentId.current !== authUser.id;
      currentId.current = authUser.id;
      // TOKEN_REFRESHED / USER_UPDATED for the same user keep the loaded profile.
      if (changedUser || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (changedUser) setLoading(true);
        setTimeout(() => loadProfile(authUser), 0);
      }
    });
    return () => data?.subscription?.unsubscribe();
  }, [loadProfile]);

  const logout = useCallback(async (scope = "local") => {
    try {
      await signOutRequest(scope);
    } finally {
      currentId.current = null;
      setUserState(null);
      setRecovery(false);
      clearUserStorage();
    }
  }, []);

  const setUser = useCallback((nextUser) => setUserState(nextUser), []);
  const clearRecovery = useCallback(() => setRecovery(false), []);

  const value = useMemo(
    () => ({ user, role: user?.role ?? null, loading, recovery, error, logout, setUser, clearRecovery }),
    [user, loading, recovery, error, logout, setUser, clearRecovery]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
