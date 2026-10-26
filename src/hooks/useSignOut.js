import { useCallback } from "react";
import { useAuth } from "./useAuth";

// Signs the user out (Supabase session + per-user storage) and then does a full
// load of the target page (default "/"), so a protected page's guard never
// flashes /login on the way out and no in-memory state survives. Use for every
// "Sign out" control.
export function useSignOut(redirectTo = "/") {
  const { logout } = useAuth();
  return useCallback(async () => {
    try {
      await logout();
    } finally {
      window.location.replace(redirectTo);
    }
  }, [logout, redirectTo]);
}
