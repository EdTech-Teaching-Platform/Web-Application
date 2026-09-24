// Compact notification panel — the actual list UI, shared by two call
// sites: AdminTopbar renders it as a `variant="dropdown"` popover under
// the bell icon, and Notifications.jsx renders it as a `variant="page"`
// standalone card (compact width, capped/scrollable height) instead of
// the old full-width long-card list. Same data, same interactions
// (mark all read / toggle one read↔unread / remove one / clear all)
// either way, backed by the shared store in ../data/notificationsMock.js
// so the topbar's unread dot always matches what's actually been read.

import {
  useNotifications,
  markAllNotificationsRead,
  toggleNotificationRead,
  removeNotification,
  clearAllNotifications,
} from "../data/notificationsMock";
import { IconTeach, IconCourse, IconWallet, IconLock, IconGear, IconBell, IconClose } from "./icons";
import "./NotificationsPanel.css";

const TYPE_META = {
  approval: { icon: IconTeach, bg: "var(--color-soft-pink)", color: "var(--color-primary)" },
  course: { icon: IconCourse, bg: "#FDEBD3", color: "var(--color-warning-accent)" },
  payment: { icon: IconWallet, bg: "#DCF3FA", color: "var(--color-financial-cyan)" },
  security: { icon: IconLock, bg: "#F1E0F9", color: "var(--color-regional-purple)" },
  system: { icon: IconGear, bg: "var(--color-bg-secondary)", color: "var(--color-text-secondary)" },
};

export default function NotificationsPanel({ variant = "page" }) {
  const items = useNotifications();
  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className={`ul-notifpanel ul-notifpanel--${variant}`} role={variant === "dropdown" ? "dialog" : undefined}>
      <div className="ul-notifpanel__head">
        <div>
          <p className="ul-notifpanel__title">Notifications</p>
          <p className="ul-notifpanel__subtitle">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        <div className="ul-notifpanel__head-actions">
          <button
            type="button"
            className="ul-notifpanel__mark-all"
            onClick={markAllNotificationsRead}
            disabled={unreadCount === 0}
          >
            Mark all read
          </button>
          <button
            type="button"
            className="ul-notifpanel__clear-all"
            onClick={clearAllNotifications}
            disabled={items.length === 0}
          >
            Clear all
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="ul-notifpanel__empty">
          <IconBell size={20} color="var(--color-text-muted)" />
          <p style={{ marginTop: 8 }}>No notifications yet.</p>
        </div>
      ) : (
        <div className="ul-notifpanel__list scrollbar-thin">
          {items.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.system;
            const Icon = meta.icon;
            return (
              <div key={n.id} className={`ul-notifpanel__item${!n.read ? " is-unread" : ""}`}>
                <button
                  type="button"
                  className="ul-notifpanel__item-main"
                  onClick={() => toggleNotificationRead(n.id)}
                  title={n.read ? "Mark as unread" : "Mark as read"}
                >
                  <span className="ul-notifpanel__icon" style={{ background: meta.bg }}>
                    <Icon size={15} color={meta.color} />
                  </span>
                  <span className="ul-notifpanel__body">
                    <span className="ul-notifpanel__top">
                      <span className="ul-notifpanel__item-title">{n.title}</span>
                      {!n.read && <span className="ul-notifpanel__dot" />}
                    </span>
                    <p className="ul-notifpanel__message">{n.message}</p>
                    <p className="ul-notifpanel__time">{n.time}</p>
                  </span>
                </button>
                <button
                  type="button"
                  className="ul-notifpanel__remove"
                  onClick={() => removeNotification(n.id)}
                  aria-label="Remove notification"
                  title="Remove notification"
                >
                  <IconClose size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
