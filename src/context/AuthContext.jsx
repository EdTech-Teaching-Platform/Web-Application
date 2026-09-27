import { createContext, useMemo, useState } from "react";

export const AuthContext = createContext(null);

const STORAGE_KEY = "universal-learning-session";

function readStoredUser() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(readStoredUser);

  const setUser = (nextUser) => {
    setUserState(nextUser);
    if (nextUser) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const logout = () => setUser(null);

  const value = useMemo(() => ({ user, setUser, logout, loading: false }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
