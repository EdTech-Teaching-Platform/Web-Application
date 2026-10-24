import { useCallback, useEffect, useRef, useState } from "react";

export function useRpc(request, { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: immediate });
  const mounted = useRef(true);

  const refetch = useCallback(async (...args) => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await request(...args);
      if (mounted.current) setState({ data, error: null, loading: false });
      return data;
    } catch (error) {
      if (mounted.current) setState({ data: null, error, loading: false });
      throw error;
    }
  }, [request]);

  useEffect(() => {
    mounted.current = true;
    if (immediate) refetch().catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [immediate, refetch]);

  return { ...state, refetch };
}
