import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DropdownPanel from "../../../components/ui/DropdownPanel";
import StatusBadge from "../../../components/ui/StatusBadge";
import NotificationsPanel from "./NotificationsPanel";
import {
  BellIcon,
  SettingsIcon,
  UsersIcon,
  CertificateIcon,
  CalendarIcon,
  WalletIcon,
  LogoutIcon,
  PencilIcon,
  ChevronRightIcon,
} from "../../../components/ui/icons";
import { useSessionRequests } from "../context/SessionRequestsContext";
import { useTestSeries } from "../../../context/TestSeriesContext";
import { useNotificationPrefs } from "../data/notificationPrefsStore";
import { buildNotifications, useNotificationReadState } from "../data/educatorNotifications";
import { isPortalPathAvailable } from "../data/portalVisibility";
import { endEducatorSession, EDUCATOR_STATUS, EDUCATOR_STATUS_META } from "../data/educatorAccountStore";

// The three icons in the educator header: Notifications bell, Settings gear
// and Profile avatar. One component owns "which dropdown is open" so opening
// one closes the others; all three render through the shared DropdownPanel
// (anchoring, click-outside, Escape, animation, mobile sheet).
const iconButton =
  "relative rounded-full p-2.5 text-muted transition-colors hover:bg-bg hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

function MenuLink({ to, icon: Icon, label, hint, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-150 hover:bg-bg focus-visible:bg-bg focus-visible:outline-none"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/[0.07] text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text">{label}</span>
        {hint && <span className="block truncate text-xs text-muted">{hint}</span>}
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function HeaderActions({ account, initials }) {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null); // null | "bell" | "gear" | "avatar"
  const bellRef = useRef(null);
  const gearRef = useRef(null);
  const avatarRef = useRef(null);

  const toggle = (name) => setOpenMenu((cur) => (cur === name ? null : name));
  const close = useCallback(() => setOpenMenu(null), []);

  // ---- Notifications: real app state -> feed, filtered by saved preferences
  const { requests } = useSessionRequests();
  const { series, submissions, currentTeacher } = useTestSeries();
  const [prefs] = useNotificationPrefs();
  const { readIds, markRead, markAllRead } = useNotificationReadState(account.id);

  const items = useMemo(
    () =>
      buildNotifications({
        requests,
        series,
        submissions,
        currentTeacherId: currentTeacher?.id,
        account,
      }).filter((n) => prefs[n.category]?.[n.itemKey]?.inApp !== false),
    [requests, series, submissions, currentTeacher, account, prefs]
  );
  const unreadIds = useMemo(
    () => new Set(items.filter((n) => !n.seenByDefault && !readIds.includes(n.id)).map((n) => n.id)),
    [items, readIds]
  );

  const openNotification = (n) => {
    markRead(n.id);
    if (n.to && isPortalPathAvailable(n.to)) {
      close();
      navigate(n.to);
    }
  };

  // ---- Settings gear: only screens that exist AND are currently reachable
  const settingsItems = [
    { to: "/teacher/notificationprefs", icon: BellIcon, label: "Notification preferences", hint: "Choose what you hear about, and how" },
    { to: "/teacher/profilesetup#profile", icon: UsersIcon, label: "Educator profile & account", hint: "Your details as submitted" },
    { to: "/teacher/profilesetup", icon: CertificateIcon, label: "Digital ID Card", hint: "Your educator credential" },
    { to: "/teacher/reviewsavailability", icon: CalendarIcon, label: "Availability & bookings", hint: "Weekly hours and session slots" },
    { to: "/teacher/earnings", icon: WalletIcon, label: "Payout methods", hint: "Bank, UPI and card details" },
  ].filter((i) => isPortalPathAvailable(i.to));

  // ---- Profile avatar
  const meta = EDUCATOR_STATUS_META[account.status];
  const canResubmit = account.status === EDUCATOR_STATUS.CHANGES_REQUESTED || account.status === EDUCATOR_STATUS.REJECTED;
  const name = account.profile?.fullName || "Educator";

  const logOut = () => {
    close();
    endEducatorSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
      {/* Notifications */}
      <div ref={bellRef} className="relative">
        <button
          type="button"
          aria-label={unreadIds.size > 0 ? `Notifications, ${unreadIds.size} unread` : "Notifications"}
          aria-haspopup="dialog"
          aria-expanded={openMenu === "bell"}
          onClick={() => toggle("bell")}
          className={`${iconButton} ${openMenu === "bell" ? "bg-bg text-text" : ""}`}
        >
          <BellIcon />
          {unreadIds.size > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
              {unreadIds.size > 9 ? "9+" : unreadIds.size}
            </span>
          )}
        </button>
        <DropdownPanel open={openMenu === "bell"} onClose={close} anchorRef={bellRef} label="Notifications" widthClass="sm:w-[26rem]">
          <NotificationsPanel
            items={items}
            unreadIds={unreadIds}
            onOpenItem={openNotification}
            onMarkAllRead={() => markAllRead(items.map((n) => n.id))}
            onClose={close}
          />
        </DropdownPanel>
      </div>

      {/* Settings */}
      <div ref={gearRef} className="relative">
        <button
          type="button"
          aria-label="Settings"
          aria-haspopup="dialog"
          aria-expanded={openMenu === "gear"}
          onClick={() => toggle("gear")}
          className={`${iconButton} ${openMenu === "gear" ? "bg-bg text-text" : ""}`}
        >
          <SettingsIcon />
        </button>
        <DropdownPanel open={openMenu === "gear"} onClose={close} anchorRef={gearRef} label="Settings" widthClass="sm:w-72">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-bold text-text">Settings</h2>
          </div>
          <nav className="flex flex-col gap-0.5 p-2">
            {settingsItems.map((item) => (
              <MenuLink key={item.to} {...item} onClick={close} />
            ))}
          </nav>
        </DropdownPanel>
      </div>

      {/* Profile */}
      <div ref={avatarRef} className="relative">
        <button
          type="button"
          aria-label="Account menu"
          aria-haspopup="dialog"
          aria-expanded={openMenu === "avatar"}
          onClick={() => toggle("avatar")}
          className="ml-1 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/15 transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {account.photoUrl ? <img src={account.photoUrl} alt="" className="h-full w-full object-cover" /> : initials || "ED"}
        </button>
        <DropdownPanel open={openMenu === "avatar"} onClose={close} anchorRef={avatarRef} label="Account menu" widthClass="sm:w-72">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/15">
              {account.photoUrl ? <img src={account.photoUrl} alt="" className="h-full w-full object-cover" /> : initials || "ED"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text">{name}</p>
              <p className="truncate text-xs text-muted">{account.email}</p>
              <StatusBadge status={meta.badgeStatus} size="sm" className="mt-1.5">
                {meta.label}
              </StatusBadge>
            </div>
          </div>
          <nav className="flex flex-col gap-0.5 p-2">
            <MenuLink to="/teacher/profilesetup#profile" icon={UsersIcon} label="View profile" hint="Your submitted details" onClick={close} />
            {canResubmit && (
              <MenuLink to="/teacher/registration?resubmit=1" icon={PencilIcon} label="Edit profile" hint="Update & resubmit for review" onClick={close} />
            )}
            <MenuLink to="/teacher/profilesetup" icon={CertificateIcon} label="Digital ID Card" hint={account.status === EDUCATOR_STATUS.APPROVED ? "Verified credential" : "Provisional until verified"} onClick={close} />
          </nav>
          <div className="border-t border-line p-2">
            <button
              type="button"
              onClick={logOut}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-danger transition-colors duration-150 hover:bg-danger/10 focus-visible:bg-danger/10 focus-visible:outline-none"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10">
                <LogoutIcon className="h-4 w-4" />
              </span>
              Log out
            </button>
          </div>
        </DropdownPanel>
      </div>
    </div>
  );
}
