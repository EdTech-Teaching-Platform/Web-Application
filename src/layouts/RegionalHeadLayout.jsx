import { useEffect, useRef, useState } from "react";
import { Suspense } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import RouteFallback from "../components/common/RouteFallback";
import { useRegionHead } from "../portals/regionalhead/hooks/useRegionHead";
import RHSidebar from "../portals/regionalhead/components/RHSidebar";
import { IconBell, IconMenu } from "../portals/admin/components/icons";
import { markHeadNotificationsRead, timeAgo } from "../portals/admin/data/regionalPortalMock";
import "../portals/admin/adminTheme.css";
import "../portals/admin/components/AdminChrome.css";
import "../portals/regionalhead/regionalhead.css";

// Guards every /regionalhead/* route: only a signed-in, still-active Regional
// Head gets in, and everything inside is scoped to that head's region.
export default function RegionalHeadLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, head, region, data, authorized } = useRegionHead();
  const [navOpen, setNavOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef(null);

  useEffect(() => { setNavOpen(false); setBellOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    if (!bellOpen) return undefined;
    const onDown = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [bellOpen]);

  if (!user || user.role !== "regionalhead" || !authorized) {
    return <Navigate to="/regionalhead/login" replace state={{ denied: !!user && user.role === "regionalhead" }} />;
  }

  const unread = data.notifications.filter((n) => !n.read).length;
  const openCount = data.queries.filter((q) => q.status === "open").length;

  return (
    <div className="ul-shell">
      <RHSidebar open={navOpen} onClose={() => setNavOpen(false)} head={head} region={region} openCount={openCount} />
      <div className="ul-main-wrap">
        <main className="ul-main ul-rhp-scope">
          <div className="ul-rhp-bar">
            <button type="button" className="ul-topbar__menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu"><IconMenu size={19} /></button>
            <span className="ul-rhp-region">Region: <strong>{region}</strong></span>
            <div className="ul-rhp-bell" ref={bellRef}>
              <button type="button" className="ul-rhp-bellbtn" onClick={() => setBellOpen((v) => !v)} aria-label="Notifications">
                <IconBell size={18} />{unread > 0 && <span className="ul-rhp-dot">{unread}</span>}
              </button>
              {bellOpen && (
                <div className="ul-rhp-pop">
                  <div className="ul-rhp-pop__head">
                    <strong>Notifications</strong>
                    {unread > 0 && <button type="button" onClick={() => markHeadNotificationsRead(region)}>Mark all read</button>}
                  </div>
                  {data.notifications.length === 0 && <p className="ul-rhp-pop__empty">Nothing yet. Admin replies to your escalations appear here.</p>}
                  {data.notifications.slice(0, 8).map((n) => (
                    <button key={n.id} type="button" className={`ul-rhp-pop__item${n.read ? "" : " is-unread"}`} onClick={() => { setBellOpen(false); navigate("/regionalhead/queries?tab=escalations"); }}>
                      <strong>{n.title}</strong><span>{n.message}</span><small>{timeAgo(n.at)}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="ul-main__page" key={location.pathname}><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></div>
        </main>
      </div>
    </div>
  );
}
