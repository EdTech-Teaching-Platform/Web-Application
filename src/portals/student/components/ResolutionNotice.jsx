import { useState } from "react";
import { BellIcon, XIcon } from "../../../components/ui/icons";
import { isResolutionNotice } from "../services/notificationsApi";

// The "your reported issue was resolved" popup (QA, 07 Nov). Shown on any
// student page for the newest UNREAD resolution in the inbox. "View" marks it
// read and opens the test series. Dismissing it (X or "All notifications")
// also marks it read (onDismiss), so it never comes back at the next login
// (QA, 13 Nov: it reappeared on every sign-in); it stays in Notifications.
// If marking read fails, it is hidden for this browser session instead.
const hiddenKey = "ul.student.resolution.hidden";

function readHidden() {
  try { return new Set(JSON.parse(window.sessionStorage.getItem(hiddenKey) || "[]")); } catch { return new Set(); }
}
function writeHidden(set) {
  try { window.sessionStorage.setItem(hiddenKey, JSON.stringify([...set])); } catch { /* storage unavailable */ }
}

export default function ResolutionNotice({ notifications, onView, onOpenInbox, onDismiss }) {
  const [hidden, setHidden] = useState(readHidden);
  const notice = (notifications || []).find((n) => isResolutionNotice(n) && !n.isRead && !hidden.has(n.id));
  if (!notice) return null;
  const more = (notifications || []).filter((n) => isResolutionNotice(n) && !n.isRead && n.id !== notice.id && !hidden.has(n.id)).length;

  const hide = () => {
    const next = new Set(hidden);
    next.add(notice.id);
    writeHidden(next);
    setHidden(next);
    Promise.resolve(onDismiss?.(notice)).catch(() => { /* stays hidden for the session */ });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-md rounded-2xl bg-white p-4 shadow-[0_18px_48px_-18px_rgba(15,17,21,0.45)] ring-1 ring-(--lp-line) md:inset-x-auto md:bottom-6 md:right-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--lp-blue-soft) text-(--lp-blue-deep)" aria-hidden="true">
          <BellIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-text">{notice.title}</p>
          {notice.body && <p className="mt-1 line-clamp-3 text-sm text-text/65">{notice.body}</p>}
          {more > 0 && <p className="mt-1 text-xs text-text/50">+{more} more in Notifications</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-full bg-(--lp-ink) px-4 py-2 text-xs font-semibold text-white" onClick={() => onView(notice)}>
              {notice.actionUrl ? "View test" : "View"}
            </button>
            <button type="button" className="rounded-full bg-(--lp-grey) px-4 py-2 text-xs font-semibold text-(--lp-ink)" onClick={() => { hide(); onOpenInbox?.(); }}>
              All notifications
            </button>
          </div>
        </div>
        <button type="button" aria-label="Dismiss" className="rounded-full p-1.5 text-text/45 hover:bg-(--lp-grey)" onClick={hide}>
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
