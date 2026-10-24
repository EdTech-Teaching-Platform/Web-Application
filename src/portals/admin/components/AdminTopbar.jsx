import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { startRegionalHeadSync } from "../data/regionalHeadsMock";
import NotificationsPanel from "./NotificationsPanel";
import { dashboardApi } from "../services/adminApi";
import { notificationsApi } from "../services/notificationsApi";
import { IconSearch, IconBell, IconLock, IconMenu } from "./icons";
import "./AdminChrome.css";

// Persistent top bar for the Admin portal — search + notifications +
// security + gear. Design ported from the reference Admin implementation's
// Topbar.jsx (the page-specific "Welcome back, Admin." heading now lives
// in the dashboard page itself, since this bar is shared across every
// /admin/* route via AdminLayout, not re-rendered per page as it was in
// the reference build).
//
// The bell used to navigate straight to the full /admin/notifications
// page. It now opens the same NotificationsPanel inline as a compact
// dropdown (closes on an outside click) — the full page is still there
// at /admin/notifications for a persistent view, just rendered compact
// there too (see Notifications.jsx) instead of as full-width long cards.
//
// The profile-initials avatar that used to sit here was dropped (no real
// auth/session is wired up yet, so it never showed anything meaningful).
//
// `onMenuClick` opens AdminSidebar's mobile drawer — the hamburger button
// only renders below the 900px breakpoint (see AdminChrome.css).
export default function AdminTopbar({ onMenuClick }) {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const notifRef = useRef(null);

  // Regional Head invitations are answered on a separate page/tab; this
  // keeps the admin chrome listening so an accepted/declined invitation
  // shows up in the notification popup live, on any admin page.
  useEffect(() => startRegionalHeadSync(), []);
  useEffect(() => {
    notificationsApi.myUnreadCount().then(setUnreadCount).catch(() => setUnreadCount(0));
  }, [notifOpen]);

  useEffect(() => {
    if (search.trim().length < 2) {
      setSearchResults(null);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      dashboardApi.search(search.trim()).then(setSearchResults).catch(() => setSearchResults(null));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!notifOpen) return undefined;
    const onClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [notifOpen]);

  return (
    <div className="ul-topbar">
      <button
        type="button"
        className="ul-topbar__menu-btn"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <IconMenu size={19} />
      </button>

      <div className="ul-topbar__actions">
        <div className="ul-topbar__search">
          <IconSearch size={15} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search learners, educators, courses…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search learners, educators, courses"
          />
          {searchResults && (
            <div className="ul-topbar__search-results">
              {["students", "educators", "series"].flatMap((key) => searchResults[key] || []).map((result) => (
                <span key={`${result.id}-${result.label}`} className="ul-topbar__search-result">
                  <strong>{result.label}</strong>
                  <small>{result.sublabel}</small>
                </span>
              ))}
              {["students", "educators", "series"].every((key) => !(searchResults[key] || []).length) && (
                <span className="ul-topbar__search-result">No results found.</span>
              )}
            </div>
          )}
        </div>

        <div className="ul-notifpanel-anchor" ref={notifRef}>
          <button
            className="ul-topbar__icon-btn"
            type="button"
            aria-label="Notifications"
            data-tooltip="Notifications"
            aria-expanded={notifOpen}
            onClick={() => setNotifOpen((v) => !v)}
          >
            <IconBell size={16} color="var(--color-text-secondary)" />
            {unreadCount > 0 && <span className="ul-topbar__dot" />}
          </button>
          {notifOpen && <NotificationsPanel variant="dropdown" />}
        </div>

        <button
          className="ul-topbar__icon-btn"
          type="button"
          aria-label="Security"
          data-tooltip="Security"
          onClick={() => navigate("/admin/security")}
        >
          <IconLock size={16} color="var(--color-text-secondary)" />
        </button>

      </div>
    </div>
  );
}
