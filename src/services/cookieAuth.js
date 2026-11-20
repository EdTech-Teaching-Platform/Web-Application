// supabase.auth for cookie mode (VITE_AUTH_MODE=cookie): the same methods the
// app already calls, backed by our server (/api/auth/*, api/auth.js), which
// keeps the access and refresh tokens in HttpOnly cookies. JavaScript never
// sees a token, so an XSS bug can't steal a session (security audit SEC-16,
// admin audit "tokens in HttpOnly cookies").
//
// Sessions: getSession() asks the server (it refreshes the token when
// needed). Events (onAuthStateChange): INITIAL_SESSION, SIGNED_IN,
// SIGNED_OUT, USER_UPDATED, PASSWORD_RECOVERY. A session that ended elsewhere
// is noticed on focus, every few minutes, and when the data proxy answers
// "x-ul-session: expired" (notifySessionExpired).
export const CLIENT_HEADER = "x-ul-client";
export const SESSION_CHECK_MS = 4 * 60 * 1000;

function authError(payload, status) {
  const e = payload?.error || {};
  const err = new Error(e.message || "Something went wrong. Please try again.");
  err.name = "AuthApiError";
  err.status = e.status || status;
  err.code = e.code || undefined;
  return err;
}

export function createCookieAuth({ base = "/api/auth", fetchImpl = (...a) => fetch(...a), win = typeof window !== "undefined" ? window : null } = {}) {
  const listeners = new Set();
  let current = null;          // {user, expires_at} | null
  let loaded = false;
  let loading = null;
  let timer = null;

  const emit = (event, session) => {
    for (const fn of [...listeners]) {
      try { fn(event, session); } catch { /* a listener's error never breaks auth */ }
    }
  };
  const toSession = (s) => (s?.user ? { user: s.user, expires_at: s.expires_at ?? null, access_token: undefined, token_type: "cookie" } : null);

  async function call(path, { method = "GET", body } = {}) {
    let res;
    try {
      res = await fetchImpl(`${base}/${path}`, {
        method,
        credentials: "same-origin",
        headers: { [CLIENT_HEADER]: "web", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      const err = new Error("Failed to fetch");
      err.status = 0;
      throw err;
    }
    let payload = null;
    try { payload = await res.json(); } catch { payload = null; }
    if (!res.ok) throw authError(payload, res.status);
    return payload;
  }

  function setSession(next, event) {
    const before = current;
    current = toSession(next);
    if (event) emit(event, current);
    else if (before && !current) emit("SIGNED_OUT", null);
    else if (!before && current) emit("SIGNED_IN", current);
    return current;
  }

  async function refreshFromServer() {
    if (loading) return loading;
    loading = call("session")
      .then((s) => { const had = loaded; loaded = true; return had ? setSession(s) : (current = toSession(s)); })
      .catch((err) => { loaded = true; if (err.status === 401) setSession(null); return current; })
      .finally(() => { loading = null; });
    return loading;
  }

  function startWatching() {
    if (!win || timer) return;
    timer = win.setInterval(() => { if (current) refreshFromServer(); }, SESSION_CHECK_MS);
    win.addEventListener?.("focus", () => { if (current) refreshFromServer(); });
  }

  // PASSWORD_RECOVERY: api/auth/callback adds ?ul_recovery=1 after a reset link.
  function takeRecoveryFlag() {
    if (!win?.location) return false;
    const url = new URL(win.location.href);
    if (url.searchParams.get("ul_recovery") !== "1") return false;
    url.searchParams.delete("ul_recovery");
    try { win.history?.replaceState(win.history.state, "", `${url.pathname}${url.search}${url.hash}`); } catch { /* ignore */ }
    return true;
  }

  const auth = {
    async getSession() {
      if (!loaded) await refreshFromServer();
      return { data: { session: current }, error: null };
    },
    async getUser() {
      const s = await refreshFromServer();
      return { data: { user: s?.user ?? null }, error: null };
    },
    onAuthStateChange(callback) {
      listeners.add(callback);
      startWatching();
      // like supabase-js: INITIAL_SESSION once the stored session is known
      Promise.resolve(loaded ? current : refreshFromServer()).then(() => {
        if (!listeners.has(callback)) return;
        const recovery = takeRecoveryFlag();
        try { callback("INITIAL_SESSION", current); } catch { /* ignore */ }
        if (recovery && current) { try { callback("PASSWORD_RECOVERY", current); } catch { /* ignore */ } }
      });
      return { data: { subscription: { id: String(Math.random()), unsubscribe: () => listeners.delete(callback) } } };
    },
    async signInWithPassword({ email, password }) {
      try {
        const s = await call("login", { method: "POST", body: { email, password } });
        loaded = true;
        const session = setSession(s, "SIGNED_IN");
        return { data: { user: session?.user ?? null, session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error };
      }
    },
    async signUp({ email, password, options = {} }) {
      try {
        const next = pathOf(options.emailRedirectTo);
        const out = await call("signup", { method: "POST", body: { email, password, data: options.data || {}, next } });
        let session = null;
        if (out?.session) { loaded = true; session = setSession({ ...out.session, user: out.user }, "SIGNED_IN"); }
        return { data: { user: out?.user ?? null, session }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error };
      }
    },
    async signOut({ scope = "local" } = {}) {
      try {
        await call("logout", { method: "POST", body: { scope } });
        setSession(null, "SIGNED_OUT");
        return { error: null };
      } catch (error) {
        if (scope === "local") setSession(null, "SIGNED_OUT");
        return { error };
      }
    },
    // The server starts the provider redirect (PKCE verifier in an HttpOnly cookie).
    async signInWithOAuth({ provider, options = {} }) {
      const url = `${base}/oauth?provider=${encodeURIComponent(provider)}&next=${encodeURIComponent(pathOf(options.redirectTo) || "/auth/callback")}`;
      if (!options.skipBrowserRedirect && win?.location) win.location.assign(url);
      return { data: { provider, url }, error: null };
    },
    async resetPasswordForEmail(email, options = {}) {
      try {
        await call("recover", { method: "POST", body: { email, next: pathOf(options.redirectTo) || "/reset-password" } });
        return { data: {}, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async updateUser(attributes = {}) {
      try {
        const out = await call("user", { method: "POST", body: { password: attributes.password, data: attributes.data } });
        if (current) { current = { ...current, user: out.user }; emit("USER_UPDATED", current); }
        return { data: { user: out.user }, error: null };
      } catch (error) {
        return { data: { user: null }, error };
      }
    },
    // The data proxy said the session is gone (refresh refused).
    notifySessionExpired() {
      if (current) setSession(null, "SIGNED_OUT");
    },
  };
  return auth;
}

// "https://site/auth/callback?redirect=x" -> "/auth/callback?redirect=x" (same-site paths only).
export function pathOf(url) {
  if (!url) return "";
  try {
    const u = new URL(url, "http://local");
    return `${u.pathname}${u.search}`;
  } catch {
    return "";
  }
}

// fetch for the Supabase client in cookie mode: same-origin cookies, our
// client header, and the session-expired signal.
export function cookieFetch(auth, fetchImpl = (...a) => fetch(...a)) {
  return async (input, init = {}) => {
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set(CLIENT_HEADER, "web");
    headers.delete("authorization");   // the server adds the user's token from the cookie
    const res = await fetchImpl(input, { ...init, headers, credentials: "same-origin" });
    if (res.headers.get("x-ul-session") === "expired") auth.notifySessionExpired();
    return res;
  };
}
