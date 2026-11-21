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

// Leaving the window or full screen while the camera / file picker is open
// to upload an answer sheet (20261120090000) isn't a violation. Copy, paste
// and right-click stay blocked.
export const PAUSABLE_EVENTS = [PROCTOR_EVENTS.visibilityHidden, PROCTOR_EVENTS.windowBlur, PROCTOR_EVENTS.fullscreenExit];
export const PICKER_PAUSE_MS = 3 * 60 * 1000;   // at most; resume() ends it sooner
export const RESUME_GRACE_MS = 1500;            // the focus / fullscreen events right after returning

// enabled: listen only while the attempt is running (not while loading or
// after submit). onEvent receives (type, meta).
//   pause(ms)  ignore window changes for up to ms (the upload picker is open)
//   resume()   back to normal after a short grace
const systemNow = () => Date.now();
export function useProctor({ enabled, onEvent, now = systemNow }) {
  const handler = useRef(onEvent);
  const pausedUntil = useRef(0);
  const pausedTypes = useRef(PAUSABLE_EVENTS);
  useEffect(() => {
    handler.current = onEvent;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    return attachProctorListeners({
      onEvent: (type, meta) => {
        if (pausedTypes.current.includes(type) && now() < pausedUntil.current) return;
        handler.current?.(type, meta);
      },
    });
  }, [enabled]);   // eslint-disable-line react-hooks/exhaustive-deps

  // types: which window changes to ignore (default all three). Previewing an
  // answer sheet in the page ignores only window_blur (clicking into a PDF
  // frame blurs the window); switching tabs or leaving full screen still counts.
  const pause = useCallback((ms = PICKER_PAUSE_MS, types = PAUSABLE_EVENTS) => {
    pausedTypes.current = types.filter((t) => PAUSABLE_EVENTS.includes(t));
    pausedUntil.current = now() + ms;
  }, [now]);
  const resume = useCallback(() => { pausedUntil.current = Math.min(pausedUntil.current, now() + RESUME_GRACE_MS); }, [now]);
  return { enterFullscreen: useCallback(() => enterFullscreen(), []), supported: fullscreenSupported(), pause, resume };
}

export default useProctor;
