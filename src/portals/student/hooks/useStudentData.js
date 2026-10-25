import { useCallback, useEffect, useRef, useState } from "react";

// Loads one request and tracks {data, error, loading}. `key` re-runs it when
// it changes (e.g. a series id or a page number); reload() runs it again.
// A response for an older key is ignored, and `loading` is derived from
// whether the data belongs to the current key.
export function useStudentData(request, key) {
  const [state, setState] = useState({ key: undefined, data: null, error: null, pending: false });
  const requestRef = useRef(request);
  const keyRef = useRef(key);
  useEffect(() => {
    requestRef.current = request;
    keyRef.current = key;
  });

  useEffect(() => {
    let alive = true;
    Promise.resolve()
      .then(() => requestRef.current())
      .then(
        (data) => alive && setState({ key, data, error: null, pending: false }),
        (error) => alive && setState({ key, data: null, error, pending: false }),
      );
    return () => {
      alive = false;
    };
  }, [key]);

  const reload = useCallback(async () => {
    const forKey = keyRef.current;
    setState((s) => ({ ...s, pending: true }));
    try {
      const data = await requestRef.current();
      if (forKey === keyRef.current) setState({ key: forKey, data, error: null, pending: false });
      return data;
    } catch (error) {
      if (forKey === keyRef.current) setState({ key: forKey, data: null, error, pending: false });
      return null;
    }
  }, []);

  const setData = useCallback((data) => setState((s) => ({ ...s, data })), []);
  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !current || (state.pending && state.data === null),
    reload,
    setData,
  };
}

export default useStudentData;
