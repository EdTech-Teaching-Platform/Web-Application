import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabaseClient";
import { mapDbRole } from "../utils/roles";

export const AuthContext = createContext(null);

function toAppUser(session, profile) {
  if (!session?.user || !profile) return null;
  const role = mapDbRole(profile.role);
  if (!role) return null;
  return {
    id: session.user.id,
    email: profile.email ?? session.user.email,
    name: profile.full_name ?? "",
    role,
  };
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (session) => {
    if (!session?.user) {
      setUserState(null);
      return;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", session.user.id)
      .single();

    if (error) throw error;
    setUserState(toAppUser(session, profile));
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        if (active) setUserState(null);
      } else if (active) {
        try {
          await loadUser(session);
        } catch {
          if (active) setUserState(null);
        }
      }
      if (active) setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      try {
        await loadUser(session);
      } catch {
        if (active) setUserState(null);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadUser]);

  const setUser = useCallback((nextUser) => setUserState(nextUser), []);

  const logout = useCallback(async (scope = "local") => {
    const { error: rpcError } = await supabase.rpc("record_logout", { p_scope: scope });
    if (rpcError) throw rpcError;
    const { error } = await supabase.auth.signOut({ scope });
    if (error) throw error;
    setUserState(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, logout, loading }), [user, setUser, logout, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
