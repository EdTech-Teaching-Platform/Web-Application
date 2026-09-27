import { useRef, useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
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
    heading: "Management",
    items: [
      { to: "/admin/testseries", label: "Test Series", icon: IconBook },
      { to: "/admin/usermanagement", label: "Student Management", icon: IconUsers },
      { to: "/admin/educatorverification", label: "Educator Management", icon: IconTeach },
      { to: "/admin/courseapproval", label: "Course Management", icon: IconCourse },
    ],
  },
  {
    heading: "Finance & Analytics",
    items: [
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
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
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

  const handleLogout = () => {
    setMenuOpen(false);
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = () => {
    setLogoutConfirmOpen(false);
    setUser(null);
    navigate("/login", { replace: true });
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
              {section.items.map((item) => (
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
