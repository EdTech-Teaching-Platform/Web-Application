// Admin Notification Center
//
// Reached from the bell icon in AdminTopbar (which now also opens the
// same panel inline as a dropdown) and directly at /admin/notifications
// for a persistent view. Renders the shared NotificationsPanel as a
// compact, height-capped, scrollable card — the panel used to be a
// full-width page of long cards; all the actual list markup/behavior now
// lives in NotificationsPanel.jsx so the dropdown and this page can't
// drift out of sync. Data/state: ../data/notificationsMock.js.

import NotificationsPanel from "../components/NotificationsPanel";
import "./Notifications.css";

export default function Notifications() {
  return (
    <div className="ul-notif-page">
      <NotificationsPanel variant="page" />
    </div>
  );
}
