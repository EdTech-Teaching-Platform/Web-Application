import { callRpc, normalizeRpcError } from "./studentRpc";

// The public series list is anon-readable and small, so it is kept in memory
// for a minute and can be prefetched (the landing page does this), which makes
// /test-series open instantly. A request that hangs (slow network, stuck auth
// lock) is cut off after 15s so the page shows "Try again" instead of an
// endless skeleton. Failed or timed-out requests are never cached.
const PUBLIC_LIST_TTL_MS = 60000;
const PUBLIC_LIST_TIMEOUT_MS = 15000;
let publicListCache = { limit: null, at: 0, promise: null };

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      const err = new Error("This is taking longer than expected. Please try again.");
      err.code = "timeout";
      reject(err);
    }, ms);
    promise.then(
      (value) => { clearTimeout(id); resolve(value); },
      (error) => { clearTimeout(id); reject(error); },
    );
  });
}

// The catalogue is public, so it is fetched straight from the REST endpoint
// with the anon key. That skips the Supabase auth client, which first has to
// restore/refresh any saved session (and can wait on a stuck auth lock) before
// it sends anything: that wait was the "very late" load. If the direct call
// fails for any reason, the regular client call is tried once as a fallback.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function directRpc(name, params, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const headers = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" };
    // Legacy anon keys are JWTs and may be sent as a bearer token; newer
    // publishable keys must not be.
    if (String(SUPABASE_ANON_KEY).startsWith("eyJ")) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    if (res.ok) return await res.json();
    let body = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    // The database answered with a real error (e.g. P0002 "not found"): that is
    // the answer, so report it straight away instead of trying another route.
    if (body && typeof body === "object" && body.code && !String(body.code).startsWith("PGRST")) {
      const err = normalizeRpcError(body);
      err.definitive = true;
      throw err;
    }
    throw new Error(`${name} ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

// Last good list, kept in the browser so a repeat visit shows the series
// instantly while a fresh copy loads behind it (see peekPublicList).
const SNAPSHOT_KEY = "ul.publicSeries.v1";
const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function saveSnapshot(items) {
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ at: Date.now(), items }));
  } catch {
    // storage unavailable (private mode / full): the snapshot is optional
  }
}

export function peekPublicList() {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const { at, items } = JSON.parse(raw);
    if (!Array.isArray(items) || Date.now() - at > SNAPSHOT_MAX_AGE_MS) return null;
    return items;
  } catch {
    return null;
  }
}

async function loadPublicList(limit) {
  let items;
  try {
    items = await directRpc("public_list_series", { p_limit: limit }, 8000);
    if (!Array.isArray(items)) throw new Error("unexpected response");
  } catch (error) {
    if (error?.definitive) throw error;
    items = await withTimeout(callRpc("public_list_series", { p_limit: limit }), PUBLIC_LIST_TIMEOUT_MS);
  }
  saveSnapshot(items);
  return items;
}

function publicListCached(limit = 50) {
  const fresh = publicListCache.promise && publicListCache.limit === limit && Date.now() - publicListCache.at < PUBLIC_LIST_TTL_MS;
  if (fresh) return publicListCache.promise;
  const promise = loadPublicList(limit);
  publicListCache = { limit, at: Date.now(), promise };
  promise.catch(() => {
    if (publicListCache.promise === promise) publicListCache = { limit: null, at: 0, promise: null };
  });
  return promise;
}

// One series (public detail page): same direct route, kept for a minute so
// going back and forth between the list and a series is instant. A "not found"
// answer comes straight from the database and is never cached.
const publicGetCache = new Map();

function publicGetCached(seriesId) {
  const hit = publicGetCache.get(seriesId);
  if (hit && Date.now() - hit.at < PUBLIC_LIST_TTL_MS) return hit.promise;
  const promise = directRpc("public_get_series", { p_series_id: seriesId }, 8000).catch((error) => {
    if (error?.definitive) {
      // a malformed id (22P02) is simply "not found" to the visitor
      if (error.code === "22P02") error.code = "P0002";
      throw error;
    }
    return withTimeout(callRpc("public_get_series", { p_series_id: seriesId }), PUBLIC_LIST_TIMEOUT_MS);
  });
  const entry = { at: Date.now(), promise };
  publicGetCache.set(seriesId, entry);
  promise.catch(() => {
    if (publicGetCache.get(seriesId) === entry) publicGetCache.delete(seriesId);
  });
  return promise;
}

// Fire-and-forget warm-up; errors are ignored here and surface on the real call.
export function prefetchPublicList(limit = 50) {
  publicListCached(limit).catch(() => {});
}

// Test series RPCs (docs/STUDENT_RPC_CONTRACT.md). publicList / publicGet are
// the only ones anon may call (landing page, public series pages).
export const studentSeriesApi = {
  publicList: (limit = 6) => callRpc("public_list_series", { p_limit: limit }),
  publicListCached,
  publicGet: publicGetCached,
  list: ({ search = null, category = null, page = 1, size = 12 } = {}) =>
    callRpc("student_list_series", {
      p_search: search || null,
      p_category: category || null,
      p_page: page,
      p_size: size,
    }),
  get: (seriesId) => callRpc("student_get_series", { p_series_id: seriesId }),
  enroll: (seriesId) => callRpc("student_enroll", { p_series_id: seriesId }),
  mySeries: () => callRpc("student_my_series"),
  history: ({ page = 1, size = 20 } = {}) => callRpc("student_my_history", { p_page: page, p_size: size }),
  stats: () => callRpc("student_get_stats"),
  dashboard: () => callRpc("student_dashboard"),
};

export default studentSeriesApi;
