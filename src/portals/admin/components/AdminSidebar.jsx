import { useRef, useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useSignOut } from "../../../hooks/useSignOut";
import { dashboardApi } from "../services/adminApi";
import { useRpc } from "../hooks/useRpc";
import { usePendingApprovals } from "../hooks/usePendingApprovals";
import sidebarBooksImg from "../../../assets/illustrations/sidebar-books.png";
import {
  IconDashboard,
  IconUsers,
  IconTeach,
  IconCourse,
  IconWallet,
  IconChart,
  IconGlobe,
  IconReport,
  IconShield,
  IconHistory,
  IconPhone,
  IconLogout,
  IconClose,
  IconGraduationCap,
  IconBook,
  IconLayers,
  IconPercent,
} from "./icons";
import ConfirmModal from "./ConfirmModal";
import "./AdminChrome.css";
import "../adminTheme.css";

// Nav sections reuse the routes already defined in ../routes.jsx — this
// file only adds labels/icons/grouping, it never invents new routes.
// Design ported from the reference Admin implementation's Sidebar.jsx.
const NAV_SECTIONS = [
  {
    heading: "Overview",
    items: [{ to: "/admin/logindashboard", label: "Dashboard", icon: IconDashboard, end: true }],
  },
  {
    heading: "Test Series",
    items: [
      { to: "/admin/testseries", label: "Create Test Series", icon: IconBook, end: true },
      { to: "/admin/testseries/assign-educators", label: "Assign Educators", icon: IconTeach },
      { to: "/admin/testseries/tracker", label: "Test Series Tracker", icon: IconLayers },
      { to: "/admin/testseries/performance-analytics", label: "Test Performance Analytics", icon: IconChart },
    ],
  },
  {
    heading: "Management",
    items: [
      { to: "/admin/usermanagement", label: "Student Management", icon: IconUsers },
      { to: "/admin/educatorverification", label: "Educator Management", icon: IconTeach },
      { to: "/admin/regionalheads", label: "Manage Regional Heads", icon: IconGlobe, hidden: true },
      { to: "/admin/courseapproval", label: "Course Management", icon: IconCourse, hidden: true },
      { to: "/admin/discounts", label: "Discount Management", icon: IconPercent },
    ],
  },
  {
    heading: "Finance & Analytics",
    items: [
      { to: "/admin/transactionhistory", label: "Transaction History", icon: IconLayers },
      { to: "/admin/paymentoversight", label: "Refund Management", icon: IconWallet },
      { to: "/admin/financialanalytics", label: "Financial Analytics", icon: IconChart },
      { to: "/admin/regionalanalytics", label: "Regional Growth", icon: IconGlobe },
      { to: "/admin/reportsbuilder", label: "Reports Builder", icon: IconReport },
    ],
  },
  {
    heading: "System",
    items: [
      { to: "/admin/contentmoderation", label: "Content Moderation", icon: IconShield },
      { to: "/admin/auditlogs", label: "Publish Notifications", icon: IconHistory },
      { to: "/admin/supporttickets", label: "Callback Request", icon: IconPhone },
    ],
  },
];

// `open` / `onClose` only matter below the 900px breakpoint (see
// AdminChrome.css) where the sidebar becomes an off-canvas drawer opened
// from AdminTopbar's hamburger button. On desktop it just renders in place.
export default function AdminSidebar({ open = false, onClose = () => {} }) {
  const { user } = useAuth();
  // Real sign-out: ends the Supabase session, clears per-user storage, reloads at /login.
  const signOut = useSignOut("/login");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const navigation = useRpc(dashboardApi.getNavigation);
  const approvals = usePendingApprovals();   // educator series waiting for review

  const handleLogout = () => {
    setMenuOpen(false);
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    setLogoutConfirmOpen(false);
    signOut();
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AK";

  return (
    <>
      {/* backdrop — mobile drawer only */}
      <div
        className={`ul-sidebar__backdrop${open ? " is-visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`ul-sidebar${open ? " is-open" : ""}`}>
        <div className="ul-sidebar__brand">
          <div className="ul-sidebar__logo">
            <IconGraduationCap size={19} />
          </div>
          <div>
            <div className="ul-sidebar__brand-name">Universal Learning</div>
            <div className="ul-sidebar__brand-sub">ADMIN CONSOLE</div>
          </div>
          <button
            type="button"
            className="ul-sidebar__close"
            onClick={onClose}
            aria-label="Close menu"
          >
            <IconClose size={18} />
          </button>
        </div>

        <nav className="ul-sidebar__nav scrollbar-thin">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading} className="ul-sidebar__section">
              <span className="ul-sidebar__heading">{section.heading}</span>
              {section.items.filter((item) => !item.hidden).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `ul-sidebar__item${isActive ? " ul-sidebar__item--active" : ""}`
                  }
                >
                  <item.icon size={17} />
                  <span>{item.label}</span>
                  {navigation.data?.find((navItem) => navItem.route === item.to)?.badge > 0 && (
                    <span className="ul-sidebar__badge">{navigation.data.find((navItem) => navItem.route === item.to).badge}</span>
                  )}
                  {item.to === "/admin/testseries" && approvals.count > 0 && (
                    <span className="ul-sidebar__badge" title="Educator series waiting for approval (Test Series → Approvals)"
                      aria-label={`${approvals.count} series waiting for approval`}>{approvals.count}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="ul-sidebar__footer" aria-hidden="true">
          <img className="ul-sidebar__footer-art" src={sidebarBooksImg} alt="" aria-hidden="true" />
          <p className="ul-sidebar__footer-caption">LEARN &middot; GROW &middot; SUCCEED</p>
        </div>

        {/* admin user profile — click to reveal the logout menu */}
        <div className="ul-sidebar__profile" ref={menuRef}>
          {menuOpen && (
            <div className="ul-sidebar__profile-menu">
              <div className="ul-sidebar__profile-menu-header">
                <p className="ul-sidebar__profile-menu-name">{user?.name || "Admin User"}</p>
                <p className="ul-sidebar__profile-menu-email">{user?.email || "admin@universallearning.com"}</p>
              </div>
              <button type="button" className="ul-sidebar__logout" onClick={handleLogout}>
                <IconLogout size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}

          <button
            type="button"
            className="ul-sidebar__profile-trigger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <div className="ul-sidebar__profile-avatar">{initials}</div>
            <div className="ul-sidebar__profile-body">
              <p className="ul-sidebar__profile-name">{user?.name || "Admin User"}</p>
              <p className="ul-sidebar__profile-role">Admin</p>
            </div>
          </button>
        </div>
      </aside>

      <ConfirmModal
        open={logoutConfirmOpen}
        title="Log out?"
        description="Are you sure you want to exit? You'll need to sign in again to access the admin console."
        confirmLabel="Log out"
        tone="danger"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </>
  );
}
