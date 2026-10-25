import { useCallback, useEffect, useRef } from "react";
import { PROCTOR_EVENTS } from "../services/attemptApi";

// Window-change restriction for the test runner. Every event is sent to the
// server (student_log_proctor_event), which counts violations, debounces the
// blur + visibilitychange pair of one tab switch, and auto-submits over the
// limit. Copy / cut / paste / right-click are also blocked in the page.

export function fullscreenElement(doc = document) {
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

export function fullscreenSupported(doc = document) {
  const el = doc.documentElement;
  return Boolean(el?.requestFullscreen || el?.webkitRequestFullscreen);
}

export async function enterFullscreen(doc = document) {
  const el = doc.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    return Boolean(fullscreenElement(doc));
  } catch {
    return false;   // refused (no user gesture, iframe, iOS): the test still runs
  }
}

// Attaches the listeners; returns a function that removes them.
// onEvent(type, meta) is called once per detected event.
export function attachProctorListeners({ win = window, doc = document, onEvent }) {
  let wasFullscreen = Boolean(fullscreenElement(doc));
  const onVisibility = () => {
    if (doc.visibilityState === "hidden") onEvent(PROCTOR_EVENTS.visibilityHidden, {});
  };
  const onBlur = () => onEvent(PROCTOR_EVENTS.windowBlur, {});
  const onFullscreen = () => {
    const now = Boolean(fullscreenElement(doc));
    if (wasFullscreen && !now) onEvent(PROCTOR_EVENTS.fullscreenExit, {});
    if (!wasFullscreen && now) onEvent(PROCTOR_EVENTS.fullscreenEnter, {});
    wasFullscreen = now;
  };
  const block = (type) => (e) => {
    e.preventDefault();
    onEvent(type, {});
  };
  const handlers = [
    [doc, "visibilitychange", onVisibility],
    [win, "blur", onBlur],
    [doc, "fullscreenchange", onFullscreen],
    [doc, "webkitfullscreenchange", onFullscreen],
    [doc, "copy", block(PROCTOR_EVENTS.copy)],
    [doc, "cut", block(PROCTOR_EVENTS.cut)],
    [doc, "paste", block(PROCTOR_EVENTS.paste)],
    [doc, "contextmenu", block(PROCTOR_EVENTS.contextMenu)],
  ];
  handlers.forEach(([target, type, fn]) => target.addEventListener(type, fn));
  return () => handlers.forEach(([target, type, fn]) => target.removeEventListener(type, fn));
}

// enabled: listen only while the attempt is running (not while loading or
// after submit). onEvent receives (type, meta).
export function useProctor({ enabled, onEvent }) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    return attachProctorListeners({ onEvent: (type, meta) => handler.current?.(type, meta) });
  }, [enabled]);

  return { enterFullscreen: useCallback(() => enterFullscreen(), []), supported: fullscreenSupported() };
}

export default useProctor;
