import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSignOut } from "../../../hooks/useSignOut";
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
  "relative rounded-full p-2.5 text-(--lp-muted) transition-colors hover:bg-(--lp-blue-tint) hover:text-(--lp-ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--lp-blue)/40";

function MenuLink({ to, icon: Icon, label, hint, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors duration-150 hover:bg-(--lp-blue-tint) focus-visible:bg-(--lp-blue-tint) focus-visible:outline-none"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-(--lp-blue-tint) text-(--lp-blue-deep)">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-(--lp-ink)">{label}</span>
        {hint && <span className="block truncate text-xs text-(--lp-muted)">{hint}</span>}
      </span>
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function HeaderActions({ account, initials }) {
  const navigate = useNavigate();
  const signOut = useSignOut("/login");
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
    signOut();
  };

  return (
    <div className="ml-auto flex items-center gap-2 sm:gap-3">
      <span className="hidden items-center gap-1.5 rounded-full bg-(--lp-grey) px-3 py-1.5 text-[11px] font-semibold text-(--lp-muted) md:inline-flex">
        <CalendarIcon className="h-3.5 w-3.5" />
        {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
      </span>
      <span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold sm:inline-flex ${account.status === EDUCATOR_STATUS.APPROVED ? "bg-(--lp-blue-soft) text-(--lp-blue-deep)" : "bg-(--lp-yellow-soft) text-(--lp-ink)"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${account.status === EDUCATOR_STATUS.APPROVED ? "bg-(--lp-blue)" : "bg-(--lp-yellow)"}`} />
        {meta.label}
      </span>
      {/* Profile */}
      <div ref={avatarRef} className="relative">
        <button
          type="button"
          aria-label="Account menu"
          aria-haspopup="dialog"
          aria-expanded={openMenu === "avatar"}
          onClick={() => toggle("avatar")}
          className={`flex items-center gap-2.5 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-(--lp-blue-tint) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--lp-blue)/40 sm:pr-3 ${openMenu === "avatar" ? "bg-(--lp-blue-tint)" : ""}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--lp-ink) text-xs font-bold text-white ring-2 ring-white">
            {account.photoUrl ? <img src={account.photoUrl} alt="" className="h-full w-full object-cover" /> : initials || "ED"}
          </span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block max-w-[9rem] truncate text-[13px] font-bold leading-tight text-(--lp-ink)">{name}</span>
            <span className="block text-[11px] leading-tight text-(--lp-muted)">Educator</span>
          </span>
          <ChevronRightIcon className={`hidden h-4 w-4 text-(--lp-muted) transition-transform sm:block ${openMenu === "avatar" ? "-rotate-90" : "rotate-90"}`} />
        </button>
        <DropdownPanel open={openMenu === "avatar"} onClose={close} anchorRef={avatarRef} label="Account menu" widthClass="sm:w-72">
          <div className="flex items-center gap-3 border-b border-(--lp-line) px-5 py-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--lp-ink) text-sm font-bold text-white ring-2 ring-white">
              {account.photoUrl ? <img src={account.photoUrl} alt="" className="h-full w-full object-cover" /> : initials || "ED"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-(--lp-ink)">{name}</p>
              <p className="truncate text-xs text-(--lp-muted)">{account.email}</p>
              <StatusBadge status={meta.badgeStatus} size="sm" className="mt-1.5">
                {meta.label}
              </StatusBadge>
            </div>
          </div>
          <div className="border-t border-(--lp-line) p-2">
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
