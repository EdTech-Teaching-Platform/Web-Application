import { useCallback, useEffect, useState } from "react";
import { accountDeletionApi, hasPasswordSignIn, verifyPassword } from "../../services/accountDeletionApi";

// "Delete account" for the student Account page and the educator Profile page
// (QA #21). It sends a deletion request: an admin reviews it, approving blocks
// the account and the data is then deleted. The dialog explains that, asks for
// the password again (or "DELETE" for Google-only accounts) and an optional
// reason. A pending request can be withdrawn.
//   <DeleteAccountSection email={user.email} api={...optional} />
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export default function DeleteAccountSection({ email, api = accountDeletionApi, passwordCheck = hasPasswordSignIn, verify = verifyPassword, portalName = "Universal Learning" }) {
  const [request, setRequest] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(() => api.mine().then((r) => setRequest(r)).catch(() => setRequest(null)).finally(() => setLoaded(true)), [api]);
  useEffect(() => { load(); }, [load]);

  const withdraw = async () => {
    setMessage("");
    try {
      await api.cancel();
      setMessage("Your deletion request was withdrawn.");
      await load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const pending = request?.status === "pending";
  return (
    <section aria-labelledby="ul-del-title" className="rounded-[1.5rem] bg-white p-4 shadow-[0_24px_40px_-30px_rgb(15_17_21/0.4)] ring-1 ring-[#fda29b] sm:rounded-[2rem] sm:p-8">
      <h2 id="ul-del-title" className="text-lg font-bold text-[#b42318]">Delete account</h2>
      {!loaded ? (
        <p className="mt-2 text-sm text-[#475467]">Checking your account…</p>
      ) : pending ? (
        <div className="mt-2 space-y-3 text-sm text-[#344054]">
          <p role="status">
            You asked to delete your account on {fmt(request.createdAt)}. An administrator will review the request; you'll lose
            access once it's approved.
          </p>
          <button type="button" onClick={withdraw} className="rounded-full px-4 py-2 text-sm font-semibold text-[#344054] ring-1 ring-[#d0d5dd] hover:bg-[#f2f4f7]">
            Withdraw request
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-3 text-sm text-[#344054]">
          {request?.status === "rejected" && (
            <p className="rounded-xl bg-[#fef0c7] px-3 py-2 text-[#7a2e0e]">
              Your previous request was not approved{request.decisionNote ? `: ${request.decisionNote}` : "."} You can ask again.
            </p>
          )}
          <p>Permanently remove your {portalName} account and its data. An administrator reviews every request.</p>
          <button type="button" onClick={() => { setMessage(""); setOpen(true); }} className="rounded-full bg-[#b42318] px-5 py-2 text-sm font-bold text-white hover:bg-[#912018]">
            Delete account…
          </button>
        </div>
      )}
      {message && <p role="status" className="mt-3 text-sm text-[#344054]">{message}</p>}
      {open && (
        <DeleteDialog
          email={email} api={api} passwordCheck={passwordCheck} verify={verify}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); setMessage("Your deletion request was sent. An administrator will review it."); load(); }}
        />
      )}
    </section>
  );
}

function DeleteDialog({ email, api, passwordCheck, verify, onClose, onDone }) {
  const [needsPassword, setNeedsPassword] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { passwordCheck().then(setNeedsPassword).catch(() => setNeedsPassword(true)); }, [passwordCheck]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const ready = confirmText.trim().toUpperCase() === "DELETE" && (!needsPassword || password.length > 0);
  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      if (needsPassword) await verify(email, password);
      await api.request(reason);
      onDone();
    } catch (err) {
      setError(err.message || "We couldn't send the request. Please try again.");
      setBusy(false);
    }
  };

  const field = "mt-1 w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-sm text-[#101828] outline-none focus:border-[#b42318] focus:ring-2 focus:ring-[#b42318]/15";
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-[#101828]/45" onClick={() => !busy && onClose()} aria-hidden="true" />
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="ul-del-dialog-title"
        className="relative w-full max-w-md rounded-2xl bg-white p-6 text-[#344054] shadow-xl">
        <h3 id="ul-del-dialog-title" className="text-lg font-bold text-[#101828]">Delete your account?</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>An administrator reviews the request. Once approved you can no longer sign in.</li>
          <li>Your profile, enrolments, attempts and results are then deleted and can't be recovered.</li>
          <li>You can withdraw the request while it is pending.</li>
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
            {busy ? "Sending…" : "Request deletion"}
          </button>
        </div>
      </form>
    </div>
  );
}
