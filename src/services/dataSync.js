import { useEffect, useRef } from "react";

// Keeps every open view of the same data in step (QA triage P5 d: an educator
// unpublished a test and the admin portal still showed "Published").
//   notifyChanged("test-series")   after a successful write
//   useRefetchOnChange(refetch, "test-series")   in any page that shows it
// A change reaches: this tab (a window event), every other tab and portal of
// this browser (BroadcastChannel), and pages that come back into focus (a
// write made on another device shows as soon as the admin returns to the tab).
// Refetches are debounced, so a burst of writes refetches once.
const EVENT = "ul:data-changed";
const CHANNEL = "ul-data-sync";
let channel = null;

function getChannel() {
  if (channel || typeof BroadcastChannel === "undefined") return channel;
  try { channel = new BroadcastChannel(CHANNEL); } catch { channel = null; }
  return channel;
}

const invalidators = new Set();
// useRpc registers its cache here, so a change also drops cached copies.
export function registerInvalidator(fn) {
  invalidators.add(fn);
  return () => invalidators.delete(fn);
}

export function notifyChanged(topic, detail = {}) {
  invalidators.forEach((fn) => { try { fn(topic); } catch { /* ignore */ } });
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: { topic, ...detail } }));
  try { getChannel()?.postMessage({ topic, ...detail }); } catch { /* closed */ }
}

export function onChanged(topic, listener) {
  if (typeof window === "undefined") return () => {};
  const onEvent = (e) => { if (e.detail?.topic === topic) listener(e.detail); };
  const onMessage = (e) => {
    if (e.data?.topic !== topic) return;
    invalidators.forEach((fn) => { try { fn(topic); } catch { /* ignore */ } });
    listener(e.data);
  };
  window.addEventListener(EVENT, onEvent);
  const ch = getChannel();
  ch?.addEventListener("message", onMessage);
  return () => {
    window.removeEventListener(EVENT, onEvent);
    ch?.removeEventListener("message", onMessage);
  };
}

export function useRefetchOnChange(refetch, topic, { onFocus = true, delayMs = 250 } = {}) {
  const ref = useRef(refetch);
  useEffect(() => { ref.current = refetch; });
  useEffect(() => {
    let timer = null;
    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { Promise.resolve(ref.current?.()).catch(() => {}); }, delayMs);
    };
    const stop = onChanged(topic, run);
    if (onFocus) window.addEventListener("focus", run);
    return () => {
      clearTimeout(timer);
      stop();
      if (onFocus) window.removeEventListener("focus", run);
    };
  }, [topic, onFocus, delayMs]);
}
