// Debug timing for admin service calls: console.time / console.timeEnd around
// every RPC (callRpc) and around the wizard's save. Off by default. Turn it on
//  - for a build: VITE_DEBUG_RPC_TIMING=true in .env.local, or
//  - in the browser console: localStorage.setItem("ul_debug_rpc_timing", "1")
//    (localStorage.removeItem("ul_debug_rpc_timing") turns it off).
// Read on every call, so no reload is needed.
export const RPC_TIMING_STORAGE_KEY = "ul_debug_rpc_timing";

export function rpcTimingEnabled() {
  if (import.meta.env?.VITE_DEBUG_RPC_TIMING === "true") return true;
  try {
    return globalThis.localStorage?.getItem(RPC_TIMING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let seq = 0;

// Starts a timer and returns the function that stops it. Labels get a
// sequence number so overlapping calls of the same RPC don't collide.
export function startTimer(label) {
  if (!rpcTimingEnabled()) return () => {};
  const name = `${label} #${++seq}`;
  console.time(name);
  return () => console.timeEnd(name);
}
