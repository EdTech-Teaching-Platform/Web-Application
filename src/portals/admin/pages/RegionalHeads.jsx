// Regional Heads — part of Educator Management (Admin portal).
//
// Its own sidebar section, mounted at /admin/regionalheads. Three tabs share
// one store (../data/regionalHeadsMock.js), the same one the educator list
// reads for its Regional Head badge/region, so assignments can never
// disagree between screens:
//   - Regional Heads : active (and removed) heads, change region / remove
//   - Invitations    : invite by name+email+region, resend, revoke, copy link
//   - Region Overview: every region with its head / pending invite / vacancy
//
// Emails are MOCK: no real email is sent. Each invite is written to a mock
// email log and its secure link can be copied/opened to test acceptance.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useEducators } from "../data/educatorsMock";
import {
  REGIONS,
  INVITE_STATUS_LABEL,
  INVITE_STATUS_BADGE,
  useRegionalState,
  invitationDisplayStatus,
  findEducatorForHead,
  buildRegionOverview,
  buildInviteLink,
  inviteRegionalHead,
  resendInvitation,
  revokeInvitation,
  promoteEducator,
  removeRegionalHead,
  reassignRegionalHead,
  reassignInvitation,
} from "../data/regionalHeadsMock";
import ConfirmModal from "../components/ConfirmModal";
import RegionalHeadTeam from "./RegionalHeadTeam";
import RegionalHeadActivity from "./RegionalHeadActivity";
import { Tabs } from "./discounts/DiscountsShared";
import { useRegionalOnboarding } from "../data/regionalOnboardingMock";
import { IconSearch, IconClose, IconMore, IconPlus, IconChevronLeft } from "../components/icons";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./EducatorProfile.css";
import "./TestSeries.css";
import "./RegionalHeads.css";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function InviteBadge({ status }) {
  return <span className={`ul-status-badge ${INVITE_STATUS_BADGE[status]}`}>{INVITE_STATUS_LABEL[status]}</span>;
}

export default function RegionalHeads() {
  const state = useRegionalState();
  const educators = useEducators();
  const navigate = useNavigate();
  const location = useLocation();
  const { forHead } = useRegionalOnboarding();
  const [section, setSection] = useState("heads"); // heads | activity
  const [teamOf, setTeamOf] = useState(null); // head whose onboarded students/teachers are open

  const [tab, setTab] = useState("heads"); // heads | invitations | overview
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- shared kebab menu (same fixed-position pattern as the educator list) ----
  const [menu, setMenu] = useState(null); // { id, top, right, kind }
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => setMenu(null);
    const onDown = (e) => {
      if (e.target.closest && e.target.closest(".ul-edu-more-btn")) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);
  const openMenu = (id, kind, ev) => {
    if (menu && menu.id === id) {
      setMenu(null);
      return;
    }
    const rect = ev.currentTarget.getBoundingClientRect();
    setMenu({ id, kind, top: rect.top, right: window.innerWidth - rect.left + 6 });
  };

  // ---- modals ----
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", region: "" });
  const [inviteError, setInviteError] = useState("");

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteEducatorId, setPromoteEducatorId] = useState("");
  const [promoteRegion, setPromoteRegion] = useState("");
  const [promoteError, setPromoteError] = useState("");

  const [reassignTarget, setReassignTarget] = useState(null); // head
  const [reassignRegion, setReassignRegion] = useState("");
  const [reassignInv, setReassignInv] = useState(null); // invitation
  const [reassignInvRegion, setReassignInvRegion] = useState("");
  const [reassignInvError, setReassignInvError] = useState("");
  const [reassignError, setReassignError] = useState("");

  const [removeTarget, setRemoveTarget] = useState(null); // head
  const [revokeTarget, setRevokeTarget] = useState(null); // invitation
  const [emailView, setEmailView] = useState(null); // invitation

  const openInvite = (region = "") => {
    setInviteForm({ name: "", email: "", region });
    setInviteError("");
    setInviteOpen(true);
  };
  const openPromote = (region = "") => {
    setPromoteEducatorId("");
    setPromoteRegion(region);
    setPromoteError("");
    setPromoteOpen(true);
  };

  // Deep links from the Educator Management page / notification popup.
  useEffect(() => {
    const s = location.state || {};
    if (s.openInvite) openInvite();
    if (s.openPromote) openPromote();
    if (s.tab && s.tab !== "overview") setTab(s.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- derived data ----
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const headRows = state.heads.map((h) => ({
      key: h.id, kind: "head", name: h.name, email: h.email, region: h.region, status: h.status, head: h, sortAt: h.assignedAt,
      rank: h.status === "active" ? 0 : 3,
    }));
    const inviteRows = state.invitations
      .map((i) => ({ ...i, displayStatus: invitationDisplayStatus(i) }))
      .filter((i) => i.displayStatus !== "accepted") // an accepted invitation is shown as the Regional Head it created
      .map((i) => ({
        key: i.id, kind: "invite", name: i.name, email: i.email, region: i.region, status: i.displayStatus, invite: i, sortAt: i.createdAt,
        rank: i.displayStatus === "pending" ? 1 : i.displayStatus === "expired" ? 2 : 3,
      }));
    return [...headRows, ...inviteRows]
      .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
      .filter((r) => regionFilter === "all" || r.region === regionFilter)
      .filter((r) => !q || `${r.name} ${r.email} ${r.region}`.toLowerCase().includes(q))
      .sort((x, y) => x.rank - y.rank || y.sortAt.localeCompare(x.sortAt));
  }, [state.heads, state.invitations, search, regionFilter, statusFilter]);
  const pendingCount = state.invitations.filter((i) => invitationDisplayStatus(i) === "pending").length;

  const overviewFilter = "all";
  const overview = useMemo(() => buildRegionOverview(state, educators), [state, educators]);
  const overviewRows = overview.filter((r) =>
    overviewFilter === "all" ? true : overviewFilter === "assigned" ? !!r.head : !r.head
  );

  const eligibleEducators = useMemo(() => {
    const headEmails = new Set(state.heads.filter((h) => h.status === "active").map((h) => h.email.toLowerCase()));
    return educators.filter(
      (e) => e.accountStatus === "active" && e.verificationStatus === "verified" && !headEmails.has(e.email.toLowerCase())
    );
  }, [educators, state.heads]);

  // ---- actions ----
  const submitInvite = () => {
    const res = inviteRegionalHead(inviteForm);
    if (!res.ok) {
      setInviteError(res.error);
      return;
    }
    setInviteOpen(false);
    setSearch(""); setRegionFilter("all"); setStatusFilter("all");
    setToast(`Invitation sent to ${res.invitation.email} (mock email).`);
  };
  const submitPromote = () => {
    const res = promoteEducator(promoteEducatorId, promoteRegion);
    if (!res.ok) {
      setPromoteError(res.error);
      return;
    }
    setPromoteOpen(false);
    setToast(`${res.head.name} is now the Regional Head for the ${res.head.region}.`);
  };
  const submitReassign = () => {
    const res = reassignRegionalHead(reassignTarget.id, reassignRegion);
    if (!res.ok) {
      setReassignError(res.error);
      return;
    }
    setToast(`${reassignTarget.name} reassigned to the ${reassignRegion}.`);
    setReassignTarget(null);
  };
  const submitReassignInvite = () => {
    const res = reassignInvitation(reassignInv.id, reassignInvRegion);
    if (!res.ok) {
      setReassignInvError(res.error);
      return;
    }
    setToast(`Invitation for ${reassignInv.name} moved to ${reassignInvRegion}.`);
    setReassignInv(null);
  };
  const copyLink = async (inv) => {
    const link = buildInviteLink(inv.token);
    try {
      await navigator.clipboard.writeText(link);
      setToast("Secure invitation link copied.");
    } catch (err) {
      setToast("Couldn't copy automatically — open 'View email' to copy the link.");
    }
  };
  const doResend = (inv) => {
    const res = resendInvitation(inv.id);
    setToast(res.ok ? `Invitation resent to ${inv.email} (mock email). The previous link no longer works.` : res.error);
  };

  const menuHead = menu && menu.kind === "head" ? state.heads.find((h) => h.id === menu.id) : null;
  const menuInvite = menu && menu.kind === "invite" ? state.invitations.find((i) => i.id === menu.id) : null;
  const menuInviteStatus = menuInvite ? invitationDisplayStatus(menuInvite) : null;
  const emailEntry = emailView ? state.emailLog.find((m) => m.invitationId === emailView.id) : null;

  return (
    <div>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Manage Regional Heads</h2>
          <p className="ul-edu-header__subtitle">
            Invite Regional Heads, reassign their regions, and manage invitations — all in one place.
          </p>
        </div>
        <div className="ul-rh-header-actions">
          <button type="button" className="ul-btn ul-btn--primary ul-edu-add-btn" onClick={() => openInvite()}>
            <IconPlus size={13} />
            <span>Invite Regional Head</span>
          </button>
        </div>
      </div>

      <div className="ul-dsc-tabs" style={{ marginBottom: 14 }}>
        <Tabs value={section} onChange={setSection} tabs={[{ key: "heads", label: "Regional Heads" }, { key: "activity", label: "Activity Tracking" }]} />
      </div>

      {section === "activity" && <RegionalHeadActivity />}

      {section === "heads" && (
      <>
      <div className="ul-edu-toolbar">
        <label className="ul-edu-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input type="text" placeholder="Search by name, email or region…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button type="button" className="ul-edu-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>
        <select className="ul-edu-select" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
          <option value="all">Region: All</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="ul-edu-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Status: All</option>
          <option value="active">Active</option>
          <option value="pending">Pending{pendingCount ? ` (${pendingCount})` : ""}</option>
          <option value="expired">Expired</option>
          <option value="rejected">Rejected</option>
          <option value="revoked">Revoked</option>
          <option value="removed">Removed</option>
        </select>
      </div>

      <div className="ul-card ul-edu-table-card">
        {rows.length === 0 ? (
          <div className="ul-edu-empty">No Regional Heads or invitations match these filters.</div>
        ) : (
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table ul-rh-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Region</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Onboarded</th>
                  <th>Date</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const educator = r.kind === "head" ? findEducatorForHead(r.head, educators) : null;
                  const i = r.invite;
                  const open = r.kind === "invite" && r.status === "pending";
                  return (
                    <tr key={r.key} className={educator ? "ul-edu-row--clickable" : ""} onClick={() => educator && navigate(`/admin/educatorverification/${educator.id}`)}>
                      <td className="ul-rh-strong">{r.name}</td>
                      <td className="ul-rh-ellipsis">{r.email}</td>
                      <td><span className="ul-rh-region-chip">{r.region}</span></td>
                      <td>{r.kind === "head" ? (r.head.source === "invited" ? "Regional Head · invited" : "Regional Head · promoted") : "Invitation"}</td>
                      <td>
                        {r.kind === "head" ? (
                          <span className={`ul-status-badge ${r.status === "active" ? "is-approved" : "is-rejected"}`}>{r.status === "active" ? "Active" : "Removed"}</span>
                        ) : <InviteBadge status={r.status} />}
                      </td>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        {r.kind === "head" ? (() => {
                          const t = forHead(r.head.id);
                          return (
                            <button type="button" className="ul-rh-studentsbtn" onClick={() => setTeamOf(r.head)} title="View students and teachers">
                              <strong>{t.students.length}</strong> students · <strong>{t.teachers.length}</strong> teachers
                            </button>
                          );
                        })() : "—"}
                      </td>
                      <td>
                        {r.kind === "head" ? `Assigned ${fmtDate(r.head.assignedAt)}` : (
                          <>
                            Sent {fmtDate(i.createdAt)}
                            <small className="ul-rh-sub" style={{ display: "block" }}>
                              {(r.status === "pending" || r.status === "expired") ? `Expires ${fmtDate(i.expiresAt)}` : `Responded ${fmtDateTime(i.respondedAt)}`}
                            </small>
                          </>
                        )}
                      </td>
                      <td className="ul-edu-actions-cell" onClick={(ev) => ev.stopPropagation()}>
                        {((r.kind === "head" && r.status === "active") || open) && (
                          <div className="ul-edu-actions-inner">
                            <button type="button" className="ul-edu-more-btn" aria-label="More actions" aria-haspopup="menu" aria-expanded={!!menu && menu.id === r.key} onClick={(ev) => openMenu(r.key, r.kind, ev)}>
                              <IconMore size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      </>
      )}

      {teamOf && <RegionalHeadTeam head={teamOf} onClose={() => setTeamOf(null)} />}

      {/* ---------- kebab menu (portal so it is never clipped) ---------- */}
      {menu && (menuHead || menuInvite) &&
        createPortal(
          <div ref={menuRef} className="ul-edu-row-menu" role="menu" style={{ top: `${menu.top}px`, right: `${menu.right}px` }}>
            {menuHead && (
              <>
                <button type="button" onClick={() => { setReassignTarget(menuHead); setReassignRegion(""); setReassignError(""); setMenu(null); }}>
                  Reassign
                </button>
                <button type="button" className="is-danger" onClick={() => { setRemoveTarget(menuHead); setMenu(null); }}>
                  Remove
                </button>
              </>
            )}
            {menuInvite && menuInviteStatus === "pending" && (
              <button type="button" className="is-danger" onClick={() => { setRevokeTarget(menuInvite); setMenu(null); }}>
                Revoke
              </button>
            )}
          </div>,
          document.body
        )}

      {/* ---------- Invite ---------- */}
      <ConfirmModal
        open={inviteOpen}
        compact
        title="Invite a Regional Head"
        description="They'll receive a secure link to accept or decline. The link expires in 7 days."
        confirmLabel="Send Invitation"
        onConfirm={submitInvite}
        onCancel={() => setInviteOpen(false)}
        confirmDisabled={!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.region}
      >
        <div className="ul-rh-form">
          <div className="ul-ts-form-row">
            <label>Full name</label>
            <input value={inviteForm.name} onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Rahul Sharma" />
          </div>
          <div className="ul-ts-form-row">
            <label>Email address</label>
            <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
          </div>
          <div className="ul-ts-form-row">
            <label>Region</label>
            <select value={inviteForm.region} onChange={(e) => setInviteForm((f) => ({ ...f, region: e.target.value }))}>
              <option value="">Select a region…</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {inviteError && <p className="ul-rh-error">{inviteError}</p>}
        </div>
      </ConfirmModal>

      {/* ---------- Promote existing educator ---------- */}
      <ConfirmModal
        open={promoteOpen}
        compact
        title="Promote educator to Regional Head"
        description="Pick an active, verified educator and the region they will lead."
        confirmLabel="Make Regional Head"
        onConfirm={submitPromote}
        onCancel={() => setPromoteOpen(false)}
        confirmDisabled={!promoteEducatorId || !promoteRegion}
      >
        <div className="ul-rh-form">
          <div className="ul-ts-form-row">
            <label>Educator</label>
            <select value={promoteEducatorId} onChange={(e) => setPromoteEducatorId(e.target.value)}>
              <option value="">Select an educator…</option>
              {eligibleEducators.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.email}</option>)}
            </select>
          </div>
          <div className="ul-ts-form-row">
            <label>Region</label>
            <select value={promoteRegion} onChange={(e) => setPromoteRegion(e.target.value)}>
              <option value="">Select a region…</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {promoteError && <p className="ul-rh-error">{promoteError}</p>}
        </div>
      </ConfirmModal>

      {/* ---------- Reassign ---------- */}
      <ConfirmModal
        open={!!reassignTarget}
        compact
        title="Change region"
        description={reassignTarget ? `Move ${reassignTarget.name} from the ${reassignTarget.region} to another region.` : ""}
        confirmLabel="Reassign"
        onConfirm={submitReassign}
        onCancel={() => setReassignTarget(null)}
        confirmDisabled={!reassignRegion}
      >
        <div className="ul-rh-form">
          <div className="ul-ts-form-row">
            <label>New region</label>
            <select value={reassignRegion} onChange={(e) => setReassignRegion(e.target.value)}>
              <option value="">Select a region…</option>
              {REGIONS.filter((r) => !reassignTarget || r !== reassignTarget.region).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {reassignError && <p className="ul-rh-error">{reassignError}</p>}
        </div>
      </ConfirmModal>

      {/* ---------- Reassign invitation ---------- */}
      <ConfirmModal
        open={!!reassignInv}
        compact
        title="Reassign invitation"
        description={reassignInv ? `Move ${reassignInv.name}'s invitation from ${reassignInv.region} to another region. They get a fresh secure link.` : ""}
        confirmLabel="Reassign"
        onConfirm={submitReassignInvite}
        onCancel={() => setReassignInv(null)}
        confirmDisabled={!reassignInvRegion}
      >
        <div className="ul-rh-form">
          <div className="ul-ts-form-row">
            <label>New region</label>
            <select value={reassignInvRegion} onChange={(e) => { setReassignInvRegion(e.target.value); setReassignInvError(""); }}>
              <option value="">Select a region…</option>
              {REGIONS.filter((r) => !reassignInv || r !== reassignInv.region).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {reassignInvError && <p className="ul-rh-error">{reassignInvError}</p>}
        </div>
      </ConfirmModal>

      {/* ---------- Remove head ---------- */}
      <ConfirmModal
        open={!!removeTarget}
        compact
        tone="danger"
        title="Remove Regional Head?"
        description={removeTarget ? `${removeTarget.name} will no longer be Regional Head for the ${removeTarget.region}. Their educator account, courses and history are not affected.` : ""}
        confirmLabel="Remove"
        onConfirm={() => {
          const res = removeRegionalHead(removeTarget.id);
          setToast(res.ok ? `${removeTarget.name} is no longer a Regional Head.` : res.error);
          setRemoveTarget(null);
        }}
        onCancel={() => setRemoveTarget(null)}
      />

      {/* ---------- Revoke invitation ---------- */}
      <ConfirmModal
        open={!!revokeTarget}
        compact
        tone="danger"
        title="Revoke this invitation?"
        description={revokeTarget ? `The link sent to ${revokeTarget.email} will stop working.` : ""}
        confirmLabel="Revoke"
        onConfirm={() => {
          const res = revokeInvitation(revokeTarget.id);
          setToast(res.ok ? "Invitation revoked." : res.error);
          setRevokeTarget(null);
        }}
        onCancel={() => setRevokeTarget(null)}
      />

      {/* ---------- View mock email ---------- */}
      {emailView && (
        <div className="ul-confirm-backdrop" onClick={() => setEmailView(null)}>
          <div className="ul-confirm-modal ul-rh-email" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-confirm-modal__header">
              <strong>Invitation email (mock)</strong>
              <button type="button" className="ul-confirm-modal__close" onClick={() => setEmailView(null)} aria-label="Close">
                <IconClose size={15} />
              </button>
            </div>
            {emailEntry ? (
              <>
                <p className="ul-rh-email__meta"><b>To:</b> {emailEntry.to}</p>
                <p className="ul-rh-email__meta"><b>Subject:</b> {emailEntry.subject}</p>
                <p className="ul-confirm-modal__desc">{emailEntry.body}</p>
                {invitationDisplayStatus(emailView) === "pending" ? (
                  <input className="ul-rh-email__link" readOnly value={buildInviteLink(emailView.token)} onFocus={(e) => e.target.select()} />
                ) : (
                  <p className="ul-rh-sub">This invitation is {INVITE_STATUS_LABEL[invitationDisplayStatus(emailView)].toLowerCase()}, so its link no longer works.</p>
                )}
              </>
            ) : (
              <p className="ul-confirm-modal__desc">No email was logged for this invitation in this browser (it may predate the mock email log).</p>
            )}
          </div>
        </div>
      )}

      {toast && <div className="ul-usr-toast">{toast}</div>}
    </div>
  );
}
