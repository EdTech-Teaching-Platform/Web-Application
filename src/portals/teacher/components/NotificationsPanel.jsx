import { Link } from "react-router-dom";
import IconBadge from "../../../components/ui/IconBadge";
import { BellIcon, CheckCheckIcon, SettingsIcon } from "../../../components/ui/icons";
import { CATEGORIES } from "../data/notificationPrefsData";
import { CATEGORY_ICON, CATEGORY_TONE } from "../pages/NotificationPrefs";
import { notificationTime } from "../data/educatorNotifications";
import { isPortalPathAvailable } from "../data/portalVisibility";

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.label]));

// The panel body for the header bell. Pure presentation: HeaderActions owns
// the data (derived from real app state), read-state and navigation.
export default function NotificationsPanel({ items, unreadIds, onOpenItem, onMarkAllRead, onClose }) {
  const unread = items.filter((n) => unreadIds.has(n.id)).length;

  return (
    <div className="flex max-h-[min(34rem,calc(100vh-6rem))] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-text">Notifications</h2>
          {unread > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{unread} new</span>
          )}
        </div>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={unread === 0}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
        >
          <CheckCheckIcon className="h-3.5 w-3.5" />
          Mark all as read
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-8 py-12 text-center">
          <IconBadge tone="lavender" size="lg" className="mb-3">
            <BellIcon className="h-6 w-6" />
          </IconBadge>
          <p className="text-sm font-bold text-text">No notifications yet</p>
          <p className="max-w-[16rem] text-xs text-muted">
            New enrolments, reviews, requests and payout updates will show up here as they happen.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain">
          {items.map((n) => {
            const isUnread = unreadIds.has(n.id);
            const Icon = CATEGORY_ICON[n.category] ?? BellIcon;
            const available = isPortalPathAvailable(n.to);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onOpenItem(n)}
                  className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-bg/70 focus-visible:bg-bg/70 focus-visible:outline-none ${
                    isUnread ? "bg-primary/[0.03]" : ""
                  }`}
                >
                  <IconBadge icon={Icon} tone={CATEGORY_TONE[n.category] ?? "lavender"} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm leading-snug ${isUnread ? "font-bold text-text" : "font-medium text-text/75"}`}>
                      {n.title}
                    </span>
                    {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>}
                    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
                      <span>{notificationTime(n.at)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{CATEGORY_LABEL[n.category]}</span>
                      {n.to && !available && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="italic">Section temporarily unavailable</span>
                        </>
                      )}
                    </span>
                  </span>
                  {isUnread && (
                    <>
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      <span className="sr-only">Unread</span>
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-line bg-bg/40 px-5 py-3">
        <Link
          to="/teacher/notificationprefs"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <SettingsIcon className="h-3.5 w-3.5" />
          Manage notification preferences
        </Link>
      </div>
    </div>
  );
}
