// Placeholder data for the Admin notification center. Replace with a real
// notifications feed once the backend endpoint exists; shape
// (id/type/title/message/time/read) should
// carry over as-is.
//
// Tiny pub/sub "store" (mirrors ../data/studentsMock.js) so the bell
// icon's unread dot in AdminTopbar, the dropdown panel, and the full
// Notifications page all read/write the same live state instead of each
// keeping its own local copy.

import { useSyncExternalStore } from "react";

const SEED_NOTIFICATIONS = [
  {
    id: "n1",
    type: "approval",
    title: "New educator verification submitted",
    message: "Dr. Sarah Jenkins submitted credentials for review.",
    time: "12 minutes ago",
    read: false,
  },
  {
    id: "n2",
    type: "course",
    title: "Course pending approval",
    hidden: true, // hidden for now — remove this line to show again
    message: '"Advanced Data Structures" by Prof. Alan Turing is waiting on your review.',
    time: "48 minutes ago",
    read: false,
  },
  {
    id: "n3",
    type: "payment",
    title: "Refund processed",
    message: "Refund of ₹58.00 issued for order #48213.",
    time: "2 hours ago",
    read: false,
  },
  {
    id: "n4",
    type: "security",
    title: "New admin sign-in",
    message: "A sign-in to the Admin Console was verified via MFA from a new device.",
    time: "3 hours ago",
    read: true,
  },
  {
    id: "n5",
    type: "system",
    title: "Weekly platform report ready",
    message: "Your Sep 8 – Sep 14 analytics summary has been generated.",
    time: "5 hours ago",
    read: true,
  },
  {
    id: "n6",
    type: "approval",
    title: "Institution onboarding complete",
    message: '"Riverdale Community College" finished onboarding and is now live.',
    time: "Yesterday",
    read: true,
  },
  {
    id: "n7",
    type: "course",
    title: "Course flagged for moderation",
    message: '"React Basics" received multiple content-quality reports.',
    time: "Yesterday",
    read: true,
  },
  {
    id: "n8",
    type: "system",
    title: "Scheduled maintenance completed",
    message: "Platform maintenance finished with no downtime reported.",
    time: "2 days ago",
    read: true,
  },
];

// ---------- tiny mock "store" ----------
let _notifications = SEED_NOTIFICATIONS.filter((n) => !n.hidden);
const _listeners = new Set();
function _notify() {
  _listeners.forEach((fn) => fn());
}
function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function useNotifications() {
  return useSyncExternalStore(_subscribe, () => _notifications);
}

export function useUnreadNotificationCount() {
  return useNotifications().filter((n) => !n.read).length;
}

// Push a new notification to the top of the shared list. Every subscriber
// (bell dot in the topbar, dropdown popup, Notifications page) re-renders
// immediately. `link` (optional) is an in-app route the popup can open.
let _notifSeq = 1000;
export function addNotification({ type = "system", title, message, link = null }) {
  _notifSeq += 1;
  const n = {
    id: `n${_notifSeq}`,
    type,
    title,
    message,
    link,
    time: "Just now",
    createdAt: new Date().toISOString(),
    read: false,
  };
  _notifications = [n, ..._notifications];
  _notify();
  return n;
}

export function markAllNotificationsRead() {
  _notifications = _notifications.map((n) => ({ ...n, read: true }));
  _notify();
}

export function toggleNotificationRead(id) {
  _notifications = _notifications.map((n) => (n.id === id ? { ...n, read: !n.read } : n));
  _notify();
}

export function removeNotification(id) {
  _notifications = _notifications.filter((n) => n.id !== id);
  _notify();
}

export function clearAllNotifications() {
  _notifications = [];
  _notify();
}
