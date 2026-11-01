import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { IconDashboard, IconUsers, IconChart, IconPhone, IconLogout, IconClose, IconPlus } from "../../admin/components/icons";
import ConfirmModal from "../../admin/components/ConfirmModal";
import brandLogo from "../../../assets/brand-logo.png";
import "../../admin/components/AdminChrome.css";
import "../../admin/adminTheme.css";

const NAV = [
  { to: "/regionalhead", label: "Dashboard", icon: IconDashboard, end: true },
  { to: "/regionalhead/onboarding", label: "Onboarding", icon: IconPlus },
  { to: "/regionalhead/students", label: "Manage People", icon: IconUsers },
  { to: "/regionalhead/progress", label: "Progress & Activity", icon: IconChart },
  { to: "/regionalhead/queries", label: "Query Resolution", icon: IconPhone },
];

export default function RHSidebar({ open, onClose, head, region, openCount }) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const initials = (head ? head.name : "RH").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <>
      <div className={`ul-sidebar__backdrop${open ? " is-visible" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`ul-sidebar ul-rhp-side${open ? " is-open" : ""}`}>
        <div className="ul-sidebar__brand">
          <div className="ul-sidebar__logo"><img src={brandLogo} alt="" className="ul-sidebar__logo-img" draggable={false} /></div>
          <div>
            <div className="ul-sidebar__brand-name">Universal Learning</div>
            <div className="ul-sidebar__brand-sub">REGIONAL HEAD · {String(region).toUpperCase()}</div>
          </div>
          <button type="button" className="ul-sidebar__close" onClick={onClose} aria-label="Close menu"><IconClose size={18} /></button>
        </div>
        <nav className="ul-sidebar__nav scrollbar-thin">
          <div className="ul-sidebar__section">
            <span className="ul-sidebar__heading">Region workspace</span>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={onClose}
                className={({ isActive }) => `ul-sidebar__item${isActive ? " ul-sidebar__item--active" : ""}`}>
                <item.icon size={17} />
                <span>{item.label}</span>
                {item.to.endsWith("/queries") && openCount > 0 && <span className="ul-rhp-navcount">{openCount}</span>}
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="ul-sidebar__profile">
          <div className="ul-sidebar__profile-trigger" style={{ cursor: "default" }}>
            <div className="ul-sidebar__profile-avatar">{initials}</div>
            <div className="ul-sidebar__profile-body">
              <p className="ul-sidebar__profile-name">{head ? head.name : "Regional Head"}</p>
              <p className="ul-sidebar__profile-role">Regional Head · {region}</p>
            </div>
          </div>
          <button type="button" className="ul-rhp-signout" onClick={() => setConfirm(true)}>
            <IconLogout size={15} /> Sign out
          </button>
        </div>
      </aside>
      <ConfirmModal open={confirm} title="Log out?" description="You will need to sign in again to reach your region's workspace."
        confirmLabel="Log out" tone="danger"
        onConfirm={() => { setConfirm(false); setUser(null); navigate("/regionalhead/login", { replace: true }); }}
        onCancel={() => setConfirm(false)} />
    </>
  );
}
