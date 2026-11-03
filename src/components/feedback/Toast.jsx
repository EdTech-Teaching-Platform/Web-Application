import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TOAST_DURATION, normalizeToast } from "./toastModel";

// The one toast for every portal (styles: src/styles/feedback.css).
//   <PageToast message={toast} onDone={() => setToast("")} />
//     message: a string, an Error / Supabase error (an error toast with its
//     message), or {message, tone}; tone: success | error | warning | info.
//     Shows while `message` is set; auto-dismisses (errors stay longer) and
//     has a close button; both call onDone.
//   <ToastItem/>: the presentational toast (also used by ToastStack).
// Toasts render in one fixed viewport on <body>, above every modal and drawer.

let viewportEl = null;
function viewport() {
  if (typeof document === "undefined") return null;
  if (!viewportEl || !document.body.contains(viewportEl)) {
    viewportEl = document.createElement("div");
    viewportEl.className = "ul-toast-viewport";
    viewportEl.setAttribute("aria-label", "Notifications");
    document.body.appendChild(viewportEl);
  }
  return viewportEl;
}

// Built on render (not at import) so the module has no JSX evaluated at load.
const ICONS = {
  success: () => <path d="M5 10.5l3.2 3.2L15 7" />,
  error: () => <><path d="M10 6v5" /><path d="M10 14h.01" /></>,
  warning: () => <><path d="M10 7v4" /><path d="M10 14h.01" /></>,
  info: () => <><path d="M10 9v5" /><path d="M10 6h.01" /></>,
};

export function ToastItem({ message, tone = "info", onClose, actionLabel, onAction }) {
  const alert = tone === "error" || tone === "warning";
  return (
    <div className={`ul-toast ul-toast--${tone}`} role={alert ? "alert" : "status"} aria-live={alert ? "assertive" : "polite"} data-tone={tone}>
      <svg className="ul-toast__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="10" cy="10" r="8" />
        {(ICONS[tone] || ICONS.info)()}
      </svg>
      <span className="ul-toast__msg">{message}</span>
      {actionLabel && (
        <button type="button" className="ul-toast__action" onClick={() => { onAction?.(); onClose?.(); }}>{actionLabel}</button>
      )}
      {onClose && (
        <button type="button" className="ul-toast__close" onClick={onClose} aria-label="Dismiss notification">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function ToastPortal({ children }) {
  const el = viewport();
  return el ? createPortal(children, el) : children;
}

export default function PageToast({ message, tone, onDone, duration }) {
  const { message: text, tone: resolved } = normalizeToast(message, tone);
  // Without onDone the toast hides itself; a new message value shows again.
  const [dismissed, setDismissed] = useState(null);
  const hidden = dismissed !== null && dismissed === message;
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    if (!text) return undefined;
    const t = setTimeout(() => (done.current ? done.current() : setDismissed(message)), duration ?? TOAST_DURATION[resolved]);
    return () => clearTimeout(t);
  }, [text, resolved, duration, message]);

  if (!text || hidden) return null;
  return (
    <ToastPortal>
      <ToastItem message={text} tone={resolved} onClose={() => (done.current ? done.current() : setDismissed(message))} />
    </ToastPortal>
  );
}
