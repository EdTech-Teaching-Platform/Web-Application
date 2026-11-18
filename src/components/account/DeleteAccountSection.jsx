import { useEffect, useState } from "react";
import { accountDeletionApi, hasPasswordSignIn } from "../../services/accountDeletionApi";

// "Delete account" for the student Account page and the educator Profile page.
// Since QA 18 Nov the user deletes the account themselves, with no admin
// approval: the dialog asks for the password again (or only "DELETE" for
// Google-only accounts) and an optional reason, then the delete-account Edge
// Function checks the password, closes the account and removes the sign-in.
// A confirmation is shown, then the user is signed out and sent home.
//   <DeleteAccountSection email={user.email} api={...optional} />
export default function DeleteAccountSection({
  email, api = accountDeletionApi, passwordCheck = hasPasswordSignIn, portalName = "Universal Learning",
  onSignedOut = () => window.location.replace("/"),
}) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="ul-del-title" className="rounded-[1.5rem] bg-white p-4 shadow-[0_24px_40px_-30px_rgb(15_17_21/0.4)] ring-1 ring-[#fda29b] sm:rounded-[2rem] sm:p-8">
      <h2 id="ul-del-title" className="text-lg font-bold text-[#b42318]">Delete account</h2>
      <div className="mt-2 space-y-3 text-sm text-[#344054]">
        <p>Permanently delete your {portalName} account{email ? ` (${email})` : ""}. This happens straight away and can't be undone.</p>
        <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-[#b42318] px-5 py-2 text-sm font-bold text-white hover:bg-[#912018]">
          Delete account…
        </button>
      </div>
      {open && <DeleteDialog api={api} passwordCheck={passwordCheck} onClose={() => setOpen(false)} onSignedOut={onSignedOut} />}
    </section>
  );
}

function DeleteDialog({ api, passwordCheck, onClose, onSignedOut }) {
  const [needsPassword, setNeedsPassword] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { passwordCheck().then(setNeedsPassword).catch(() => setNeedsPassword(true)); }, [passwordCheck]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && !done && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, done, onClose]);

  const ready = confirmText.trim().toUpperCase() === "DELETE" && (!needsPassword || password.length > 0);
  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteAccount({ password: needsPassword ? password : "", reason });
      setDone(true);
    } catch (err) {
      setError(err.message || "We couldn't delete your account. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const finish = async () => {
    setBusy(true);
    await api.signOut();
    onSignedOut();
  };

  const field = "mt-1 w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-sm text-[#101828] outline-none focus:border-[#b42318] focus:ring-2 focus:ring-[#b42318]/15";
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[#101828]/45" onClick={() => !busy && !done && onClose()} aria-hidden="true" />
      {done ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby="ul-del-done-title" aria-describedby="ul-del-done-body"
          className="relative w-full max-w-md rounded-2xl bg-white p-6 text-[#344054] shadow-xl">
          <h3 id="ul-del-done-title" className="text-lg font-bold text-[#101828]">Your account has been deleted</h3>
          <p id="ul-del-done-body" className="mt-3 text-sm">
            You've been signed out and can no longer sign in with this account. Thank you for learning with us.
          </p>
          <div className="mt-5 flex justify-end">
            <button type="button" autoFocus onClick={finish} disabled={busy} className="rounded-full bg-[#101828] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
              {busy ? "Signing out…" : "OK"}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="ul-del-dialog-title"
          className="relative w-full max-w-md rounded-2xl bg-white p-6 text-[#344054] shadow-xl">
          <h3 id="ul-del-dialog-title" className="text-lg font-bold text-[#101828]">Delete your account?</h3>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            <li>Your account is deleted immediately. No approval is needed.</li>
            <li>You'll be signed out and can't sign in with this account again.</li>
            <li>Your profile, enrolments, attempts and results are removed under our data-retention policy and can't be recovered.</li>
          </ul>
          {needsPassword && (
            <label className="mt-4 block text-sm font-semibold text-[#101828]">
              Your password
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            </label>
          )}
          <label className="mt-4 block text-sm font-semibold text-[#101828]">
            Reason <span className="font-normal text-[#475467]">(optional)</span>
            <textarea value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} rows={2} className={field} />
          </label>
          <label className="mt-4 block text-sm font-semibold text-[#101828]">
            Type DELETE to confirm
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className={field} />
          </label>
          {error && <p role="alert" className="mt-3 rounded-xl bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-[#d0d5dd] hover:bg-[#f2f4f7] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={!ready || busy} className="rounded-full bg-[#b42318] px-5 py-2 text-sm font-bold text-white hover:bg-[#912018] disabled:opacity-50">
              {busy ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
