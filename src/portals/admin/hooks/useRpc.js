import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../services/supabaseClient";

// Tiny stale-while-revalidate cache, opt-in per call via `cacheKey`. A page
// that has been visited (or a filter combination that has been loaded) shows
// its last result instantly while a fresh copy is fetched in the background.
// Entries expire after CACHE_TTL_MS and are wiped on any sign-in / sign-out
// so one admin's data is never shown to another.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const readCache = (key) => {
  if (!key) return undefined;
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
};
try {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "SIGNED_IN") cache.clear();
  });
} catch {
  /* cache just stays per-session-memory if auth events are unavailable */
}

export function useRpc(request, { immediate = true, cacheKey } = {}) {
  const [state, setState] = useState(() => {
    const cached = immediate ? readCache(cacheKey) : undefined;
    return { data: cached ?? null, error: null, loading: immediate && cached === undefined };
  });
  const mounted = useRef(true);
  const latestCall = useRef(0);

  const refetch = useCallback(async (...args) => {
    // Only the most recent call may update state, so a slow earlier response
    // can never overwrite a newer one (out-of-order results made lists jump).
    const callId = ++latestCall.current;
    const cached = readCache(cacheKey);
    setState((current) => ({
      data: cached !== undefined ? cached : current.data,
      error: null,
      loading: cached === undefined,
    }));
    try {
      const data = await request(...args);
      if (cacheKey) cache.set(cacheKey, { data, at: Date.now() });
      if (mounted.current && callId === latestCall.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (mounted.current && callId === latestCall.current) setState({ data: null, error, loading: false });
      throw error;
    }
  }, [request, cacheKey]);

  useEffect(() => {
    mounted.current = true;
    if (immediate) refetch().catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [immediate, refetch]);

  return { ...state, refetch };
}
