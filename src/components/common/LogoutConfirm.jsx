import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The one logout confirmation (Cancel / Log out) for the admin, teacher,
// student and regional-head layouts.
//   const logout = useLogoutConfirm(signOut);   // signOut: useSignOut(...) or the layout's onLogout
//   <button onClick={logout.request}>Log out</button>
//   {logout.dialog}
// Escape or the backdrop cancels; Cancel has focus first, so Enter never logs
// out by accident.
export function LogoutConfirmDialog({ open, onCancel, onConfirm, busy = false, title = "Log out?", description = "You'll need to sign in again to continue." }) {
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return createPortal(
    <div className="ul-confirm-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <section className="ul-confirm" role="alertdialog" aria-modal="true" aria-labelledby="ul-logout-title" aria-describedby="ul-logout-text">
        <h2 id="ul-logout-title" className="ul-confirm__title">{title}</h2>
        <p id="ul-logout-text" className="ul-confirm__text">{description}</p>
        <div className="ul-confirm__actions">
          <button ref={cancelRef} type="button" className="ul-confirm__btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="ul-confirm__btn ul-confirm__btn--primary" onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
            {busy ? "Logging out…" : "Log out"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function useLogoutConfirm(signOut, { description } = {}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useCallback(() => setOpen(true), []);
  const cancel = useCallback(() => setOpen(false), []);
  const confirm = useCallback(async () => {
    setBusy(true);
    try { await signOut?.(); } finally { setBusy(false); setOpen(false); }
  }, [signOut]);
  return {
    request,
    dialog: <LogoutConfirmDialog open={open} busy={busy} onCancel={cancel} onConfirm={confirm} description={description} />,
  };
}
