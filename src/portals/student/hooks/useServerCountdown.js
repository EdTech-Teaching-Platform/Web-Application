import { useEffect, useMemo, useState } from "react";

// Milliseconds left until `closesAt` (ISO), on the SERVER's clock: the device
// clock is corrected by `serverNow` (the server's time when it answered).
// Re-renders every second; null when there's no deadline.
export function useServerCountdown(closesAt, serverNow) {
  const closes = closesAt ? new Date(closesAt).getTime() : null;
  const skew = useMemo(() => (serverNow ? new Date(serverNow).getTime() - Date.now() : 0), [serverNow]);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (closes == null) return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [closes]);
  return closes == null ? null : Math.max(0, closes - (Date.now() + skew));
}

export function formatCountdown(ms) {
  if (ms == null) return "";
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default useServerCountdown;
