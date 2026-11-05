// Account blocks (QA triage P2): detecting them and telling the layout.
//   * A student RPC refuses a blocked caller with SQLSTATE 'UL403', message
//     'account_blocked' (20261102090000).
//   * Supabase Auth refuses a banned user's sign-in with code 'user_banned'
//     ("User is banned"); set-user-ban bans a blocked account.
// notifyAccountBlocked() is called by the RPC wrappers; the student layout
// (and the educator gate) listen with onAccountBlocked() and switch to the
// full-page blocked screen without waiting for the next status check.
export const ACCOUNT_BLOCKED_CODE = "UL403";
export const ACCOUNT_BLOCKED_EVENT = "ul:account-blocked";
export const ACCESS_DENIED_EVENT = "ul:access-denied";
export const BLOCKED_MESSAGE = "Your account has been blocked. Contact the administrator to restore access.";

export function isAccountBlockedError(error) {
  if (!error) return false;
  const code = String(error.code ?? "");
  const text = `${error.message ?? ""} ${error.hint ?? ""} ${error.error_code ?? ""}`;
  return code === ACCOUNT_BLOCKED_CODE || code === "user_banned" || /\baccount_blocked\b|user is banned|user_banned/i.test(text);
}

function emit(name, detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export const notifyAccountBlocked = (detail) => emit(ACCOUNT_BLOCKED_EVENT, detail);
export const notifyAccessDenied = (detail) => emit(ACCESS_DENIED_EVENT, detail);

export function onAccountBlocked(listener, eventName = ACCOUNT_BLOCKED_EVENT) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
