// Settings & Permissions + Certificate Management
// Jira: Day 13 — Settings & permissions + certificate mgmt
// Settings & Permissions: Configure platform-level access. Admin. How It
// Works: Grant/restrict module access per role. Expected Outcome:
// Controlled administrative access. Certificates are normally
// auto-issued on course completion and
// idempotent; Admin also gets a manual Issue action for edge cases and a
// Revoke action with a required reason (both audit-relevant).
//
// Four sections behind a shared tab bar:
//   1. Permissions & Roles — role/module access matrix (Admin edits)
//   2. Admin Users — Admin/Head Teacher account list + roster mgmt
//   3. Platform Settings — account card + platform-level toggles (Admin)
//   4. Certificate Management — search/filter/issue/revoke/view certificates
//
// Backed entirely by ../data/permissionsMock.js + ../data/certificatesMock.js
// (mock-only, no real API layer yet — see adminApi.js). Reuses ConfirmModal
// for destructive actions and the shared .ul-card / .ul-btn / .ul-status-badge
// / .ul-avatar-chip primitives from AdminDashboard.css / EducatorVerification.css
// so this screen matches the rest of the Admin Dashboard exactly.
//
// There's no real login/role session wired up yet (AuthContext.user is a
// placeholder), so this page includes a small demo "viewing as" role
// switcher — the same pattern any of these mock-data pages could reuse
// once a real session exists. It defaults to Admin so every control is
// visible on first load; switching to Head Teacher demonstrates how
// Admin-only controls lock down.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ROLE,
  ROLE_LABEL,
  ROLE_OPTIONS,
  MODULE_LABEL,
  MODULE_ORDER,
  PERMISSION_NOTE,
  useRoleMatrix,
  togglePermission,
  useCustomRoles,
  createCustomRole,
  updateCustomRole,
  usePermissionHistory,
  ADMIN_STATUS,
  ADMIN_STATUS_LABEL,
  ADMIN_STATUS_BADGE_CLASS,
  useAdminUsers,
  addAdminUser,
  deactivateAdminUser,
  reactivateAdminUser,
  updateAdminUserSecurity,
  resendAdminInvite,
  forceLogoutAdmin,
  useSettings,
  updateSettings,
} from "../data/permissionsMock";
import {
  CERT_STATUS,
  CERT_STATUS_LABEL,
  CERT_STATUS_BADGE_CLASS,
  useCertificates,
  issueCertificate,
  revokeCertificate,
} from "../data/certificatesMock";
import ConfirmModal from "../components/ConfirmModal";
import { IconSearch, IconClose, IconPlus, IconDownload, IconLock, IconAlert, IconHistory } from "../components/icons";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./UserManagement.css";
import "./SettingsPermissions.css";

const TABS = [
  { key: "permissions", label: "Permissions & Roles" },
  { key: "admins", label: "Admin Users" },
  { key: "settings", label: "Platform Settings" },
  { key: "certificates", label: "Certificate Management" },
];

const CERT_PAGE_SIZE = 8;
const ADMIN_PAGE_SIZE = 8;

function AdminStatusBadge({ status }) {
  return <span className={`ul-status-badge ${ADMIN_STATUS_BADGE_CLASS[status]}`}>{ADMIN_STATUS_LABEL[status]}</span>;
}

function CertStatusBadge({ status }) {
  return <span className={`ul-status-badge ${CERT_STATUS_BADGE_CLASS[status]}`}>{CERT_STATUS_LABEL[status]}</span>;
}

function initialsOf(name) {
  return (
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

export default function SettingsPermissions() {
  const [tab, setTab] = useState("permissions");
  const viewingAs = ROLE.ADMIN;
  const isAdmin = true;

  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const matrix = useRoleMatrix();
  const customRoles = useCustomRoles();
  const permissionHistory = usePermissionHistory();
  const adminUsers = useAdminUsers();
  const settings = useSettings();
  const certificates = useCertificates();

  const currentAccount = useMemo(
    () => adminUsers.find((u) => u.role === viewingAs) || adminUsers[0],
    [adminUsers, viewingAs]
  );

  return (
    <div>
      <div className="ul-set-header">
        <h2 className="ul-set-header__title">Settings &amp; Permissions</h2>
        <p className="ul-set-header__subtitle">
          Configure platform-level access, manage Admin accounts, adjust platform settings, and
          issue or revoke course completion certificates.
        </p>

      </div>

      <div className="ul-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`ul-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "permissions" && (
        <PermissionsTab matrix={matrix} customRoles={customRoles} permissionHistory={permissionHistory} isAdmin={isAdmin} onToast={setToast} />
      )}

      {tab === "admins" && (
        <AdminUsersTab
          adminUsers={adminUsers}
          roleOptions={[...ROLE_OPTIONS, ...customRoles.map((role) => role.id)]}
          isAdmin={isAdmin}
          onToast={setToast}
        />
      )}

      {tab === "settings" && (
        <PlatformSettingsTab
          account={currentAccount}
          viewingAs={viewingAs}
          settings={settings}
          isAdmin={isAdmin}
          onToast={setToast}
        />
      )}

      {tab === "certificates" && (
        <CertificatesTab
          certificates={certificates}
          currentAccountName={currentAccount?.name}
          onToast={setToast}
        />
      )}

      {toast && <div className="ul-set-toast">{toast}</div>}
    </div>
  );
}

/* ============================== Tab 1 ============================== */

function PermissionsTab({ matrix, customRoles, permissionHistory, isAdmin, onToast }) {
  const [permissionSearch, setPermissionSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: "", description: "" });
  const allRoles = [...ROLE_OPTIONS, ...customRoles.map((role) => role.id)];
  const visibleModules = MODULE_ORDER.filter((module) => {
    const q = permissionSearch.trim().toLowerCase();
    return !q || MODULE_LABEL[module].toLowerCase().includes(q) || ROLE_LABEL[roleFilter]?.toLowerCase().includes(q);
  });

  const handleToggle = (role, module) => {
    if (!isAdmin || role === ROLE.ADMIN) return;
    togglePermission(role, module);
    onToast(`${MODULE_LABEL[module]} access updated for ${ROLE_LABEL[role]}.`);
  };

  const saveRole = (event) => {
    event.preventDefault();
    if (!roleForm.name.trim() || !isAdmin) return;
    if (editingRole) {
      updateCustomRole(editingRole.id, { name: roleForm.name.trim(), description: roleForm.description.trim() });
      onToast(`${roleForm.name.trim()} updated.`);
    } else {
      createCustomRole({ name: roleForm.name.trim(), description: roleForm.description.trim() });
      onToast(`${roleForm.name.trim()} created.`);
    }
    setRoleForm({ name: "", description: "" });
    setEditingRole(null);
    setShowRoleForm(false);
  };

  return (
    <div className="ul-card">
      <p className="ul-set-section-title">Role &amp; Module Access Matrix</p>
      <p className="ul-set-section-desc">
        Grant or restrict module access per role. Admin always has full, unbounded access and can't be
        edited here — it's the fixed ceiling every other role is measured against.
      </p>

      {!isAdmin && (
        <span className="ul-set-locked-note">
          <IconLock size={12} color="var(--color-text-muted)" />
          Read-only — only Admin can grant role or permission changes.
        </span>
      )}

      <div className="ul-set-permission-toolbar">
        <label className="ul-set-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input value={permissionSearch} onChange={(e) => setPermissionSearch(e.target.value)} placeholder="Search permissions or roles..." />
          {permissionSearch && <button type="button" className="ul-usr-search__clear" onClick={() => setPermissionSearch("")} aria-label="Clear permission search"><IconClose size={12} /></button>}
        </label>
        <select className="ul-set-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">Role: All</option>
          {allRoles.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
        </select>
        {isAdmin && <button type="button" className="ul-btn ul-btn--primary" onClick={() => { setEditingRole(null); setRoleForm({ name: "", description: "" }); setShowRoleForm(true); }}><IconPlus size={13} color="#fff" /> Create Custom Role</button>}
      </div>

      {customRoles.length > 0 && <div className="ul-set-role-list">{customRoles.map((role) => <div className="ul-set-role-card" key={role.id}><div><strong>{role.name}</strong><span>{role.description}</span></div>{isAdmin && <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" onClick={() => { setEditingRole(role); setRoleForm({ name: role.name, description: role.description }); setShowRoleForm(true); }}>Edit</button>}</div>)}</div>}

      {showRoleForm && isAdmin && <form className="ul-set-inline-form" onSubmit={saveRole}><label>Role name<input value={roleForm.name} onChange={(e) => setRoleForm((form) => ({ ...form, name: e.target.value }))} placeholder="e.g. Finance Reviewer" /></label><label>Description<input value={roleForm.description} onChange={(e) => setRoleForm((form) => ({ ...form, description: e.target.value }))} placeholder="What can this role do?" /></label><button type="submit" className="ul-btn ul-btn--primary" disabled={!roleForm.name.trim()}>{editingRole ? "Save Role" : "Create Role"}</button><button type="button" className="ul-btn ul-btn--ghost" onClick={() => setShowRoleForm(false)}>Cancel</button></form>}

      <div className="ul-set-matrix-scroll">
        <table className="ul-set-matrix">
          <thead>
            <tr>
              <th>Role</th>
              {MODULE_ORDER.map((m) => (
                <th key={m}>{MODULE_LABEL[m]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_OPTIONS.filter((role) => roleFilter === "all" || role === roleFilter).map((role) => (
              <tr key={role}>
                <td>
                  <span className="ul-set-matrix-role">
                    {ROLE_LABEL[role]}
                    {role === ROLE.ADMIN && <span className="ul-set-matrix-role__sub">Full access · fixed</span>}
                  </span>
                </td>
                {visibleModules.map((module) => {
                  const on = !!matrix[role]?.[module];
                  const note = PERMISSION_NOTE[role]?.[module];
                  const locked = role === ROLE.ADMIN || !isAdmin;
                  return (
                    <td key={module}>
                      <div className="ul-set-toggle-cell">
                        <button
                          type="button"
                          className={`ul-set-switch${on ? " is-on" : ""}`}
                          disabled={locked}
                          aria-pressed={on}
                          aria-label={`${MODULE_LABEL[module]} access for ${ROLE_LABEL[role]}`}
                          onClick={() => handleToggle(role, module)}
                        />
                        {note && <span className="ul-set-toggle-note">{note}</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ul-set-card-stack">
        <div className="ul-card">
          <p className="ul-set-section-title"><IconHistory size={14} /> Permission Change History</p>
          <div className="ul-set-history-list">{permissionHistory.slice(0, 8).map((item) => <div key={item.id}><strong>{item.action}</strong><span>{item.role} · {MODULE_LABEL[item.module] || item.module}</span><small>{item.actor} · {item.timestamp}</small></div>)}</div>
        </div>
      </div>
    </div>
  );
}

/* ============================== Tab 2 ============================== */

function AdminUsersTab({ adminUsers, roleOptions, isAdmin, onToast }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: ROLE.ADMIN });

  useEffect(() => setPage(1), [search, roleFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return adminUsers.filter((u) => {
      if (q && !`${u.name} ${u.email} ${u.id}`.toLowerCase().includes(q)) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      return true;
    });
  }, [adminUsers, search, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * ADMIN_PAGE_SIZE, currentPage * ADMIN_PAGE_SIZE);

  const formValid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email.trim());

  const submitAdd = (e) => {
    e.preventDefault();
    if (!formValid) return;
    addAdminUser({ name: form.name.trim(), email: form.email.trim(), role: form.role });
    onToast(`"${form.name.trim()}" added as ${ROLE_LABEL[form.role]}.`);
    setForm({ name: "", email: "", role: ROLE.ADMIN });
    setShowAddForm(false);
  };

  const confirmDeactivate = () => {
    if (!deactivateTarget) return;
    deactivateAdminUser(deactivateTarget.id);
    onToast(`"${deactivateTarget.name}" has been suspended.`);
    setDeactivateTarget(null);
  };

  return (
    <div>
      {!isAdmin && (
        <span className="ul-set-locked-note">
          <IconLock size={12} color="var(--color-text-muted)" />
          Read-only — only Admin can add, edit or suspend Admin accounts.
        </span>
      )}

      <div className="ul-set-toolbar">
        <label className="ul-set-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by name, email or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="ul-usr-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <select className="ul-set-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">Role: All</option>
          {roleOptions.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>

        {isAdmin && (
          <button type="button" className="ul-btn ul-btn--primary" onClick={() => setShowAddForm((v) => !v)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <IconPlus size={13} color="#fff" /> Add Admin User
            </span>
          </button>
        )}
      </div>

      {isAdmin && showAddForm && (
        <form className="ul-card" onSubmit={submitAdd} style={{ marginBottom: 16 }}>
          <p className="ul-set-section-title">Add Admin User</p>
          <div className="ul-set-add-form">
            <label>
              Full name
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kiran Shetty"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@universallearning.com"
              />
            </label>
            <label>
              Role
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {roleOptions.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="ul-btn ul-btn--primary" disabled={!formValid}>
              Add User
            </button>
          </div>
        </form>
      )}

      <div className="ul-card ul-set-table-card">
        {pageItems.length === 0 ? (
          <div className="ul-set-empty">No admin accounts match these filters.</div>
        ) : (
          <div className="ul-set-table-scroll">
            <table className="ul-set-table ul-adm-users-table">
              <colgroup>
                <col style={{ width: "30%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "26%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="ul-set-name-cell">
                        <div className="ul-avatar-chip">{u.initials}</div>
                        <div className="ul-set-name-cell__body">
                          <span className="ul-set-name-cell__name">{u.name}</span>
                          <span className="ul-set-name-cell__sub">{u.id} · {u.lastLogin}</span>
                        </div>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <AdminStatusBadge status={u.status} />
                    </td>
                    <td>
                      <div className="ul-set-actions-cell">
                        {u.role === ROLE.ADMIN ? (
                          <div className="ul-set-account-actions"><button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" disabled={!isAdmin} onClick={() => { updateAdminUserSecurity(u.id, { mfaEnabled: !u.mfaEnabled }); onToast(`${u.name} MFA ${u.mfaEnabled ? "disabled" : "enabled"}.`); }}>MFA {u.mfaEnabled ? "On" : "Off"}</button>{u.activeSessions > 0 && <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" disabled={!isAdmin} onClick={() => { forceLogoutAdmin(u.id); onToast(`${u.name}'s sessions ended.`); }}>End Sessions</button>}</div>
                        ) : u.status === ADMIN_STATUS.ACTIVE ? (
                          <div className="ul-set-account-actions"><button type="button" className="ul-btn ul-btn--danger ul-set-btn-sm" disabled={!isAdmin} onClick={() => setDeactivateTarget(u)}>Suspend</button><button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" disabled={!isAdmin} onClick={() => { updateAdminUserSecurity(u.id, { mfaEnabled: !u.mfaEnabled }); onToast(`${u.name} MFA ${u.mfaEnabled ? "disabled" : "enabled"}.`); }}>MFA {u.mfaEnabled ? "On" : "Off"}</button>{u.activeSessions > 0 && <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" disabled={!isAdmin} onClick={() => { forceLogoutAdmin(u.id); onToast(`${u.name}'s sessions ended.`); }}>End Sessions</button>}</div>
                        ) : u.status === ADMIN_STATUS.INVITED ? (
                          <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" disabled={!isAdmin} onClick={() => { resendAdminInvite(u.id); onToast(`Invitation resent to ${u.email}.`); }}>Resend Invite</button>
                        ) : (
                          <div className="ul-set-account-actions"><button type="button" className="ul-btn ul-btn--primary ul-set-btn-sm" disabled={!isAdmin} onClick={() => { reactivateAdminUser(u.id); onToast(`"${u.name}" reactivated.`); }}>Reactivate</button><button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" disabled={!isAdmin} onClick={() => { resendAdminInvite(u.id); onToast(`Invitation resent to ${u.email}.`); }}>Resend Invite</button></div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="ul-usr-pagination">
            <span className="ul-usr-pagination__info">
              Showing {(currentPage - 1) * ADMIN_PAGE_SIZE + 1}–{Math.min(currentPage * ADMIN_PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="ul-usr-pagination__controls">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Prev</button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deactivateTarget}
        title="Suspend this admin account?"
        description={
          deactivateTarget
            ? `"${deactivateTarget.name}" will immediately lose access to the Admin Console until reactivated.`
            : ""
        }
        confirmLabel="Suspend Account"
        tone="danger"
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
}

/* ============================== Tab 3 ============================== */

function PlatformSettingsTab({ account, viewingAs, settings, isAdmin, onToast }) {
  const handleToggle = (key, label) => {
    if (!isAdmin) return;
    updateSettings({ [key]: !settings[key] });
    onToast(`${label} ${!settings[key] ? "enabled" : "disabled"}.`);
  };

  const [rateInput, setRateInput] = useState(settings.defaultCommissionRatePct);
  useEffect(() => setRateInput(settings.defaultCommissionRatePct), [settings.defaultCommissionRatePct]);

  const commitRate = () => {
    const n = Math.max(0, Math.min(100, Number(rateInput) || 0));
    setRateInput(n);
    if (n !== settings.defaultCommissionRatePct) {
      updateSettings({ defaultCommissionRatePct: n });
      onToast("Default commission rate updated.");
    }
  };

  return (
    <div className="ul-set-grid">
      <div className="ul-card">
        <p className="ul-set-section-title">Your Account</p>
        <p className="ul-set-section-desc">Signed in as ({ROLE_LABEL[viewingAs]}) for this demo session.</p>

        {account && (
          <div className="ul-set-profile">
            <div className="ul-avatar-chip" style={{ width: 42, height: 42, fontSize: 14 }}>
              {initialsOf(account.name)}
            </div>
            <div className="ul-set-profile__body">
              <p className="ul-set-profile__name">{account.name}</p>
              <p className="ul-set-profile__email">{account.email}</p>
            </div>
          </div>
        )}

        <div className="ul-set-kv">
          <div className="ul-set-kv__item">
            <p className="ul-set-kv__label">Role</p>
            <p className="ul-set-kv__value">{ROLE_LABEL[viewingAs]}</p>
          </div>
          <div className="ul-set-kv__item">
            <p className="ul-set-kv__label">Status</p>
            <p className="ul-set-kv__value">{account ? ADMIN_STATUS_LABEL[account.status] : "—"}</p>
          </div>
          <div className="ul-set-kv__item">
            <p className="ul-set-kv__label">Last login</p>
            <p className="ul-set-kv__value">{account?.lastLogin || "—"}</p>
          </div>
          <div className="ul-set-kv__item">
            <p className="ul-set-kv__label">Admin ID</p>
            <p className="ul-set-kv__value">{account?.id || "—"}</p>
          </div>
        </div>
        <p className="ul-set-toggle-note" style={{ marginTop: 12 }}>
          Profile fields are managed by Admin from the Admin Users tab. To change your own role, ask an
          Admin to update it there.
        </p>
      </div>

      <div className="ul-card">
        <p className="ul-set-section-title">Platform Configuration</p>
        <p className="ul-set-section-desc">Platform-level settings. Admin only.</p>

        {!isAdmin && (
          <span className="ul-set-locked-note">
            <IconLock size={12} color="var(--color-text-muted)" />
            Read-only — platform configuration is Admin only.
          </span>
        )}

        <div className="ul-set-switch-row">
          <div className="ul-set-switch-row__body">
            <p className="ul-set-switch-row__label">Maintenance mode</p>
            <p className="ul-set-switch-row__desc">Temporarily blocks learner/educator sign-in platform-wide for maintenance.</p>
          </div>
          <button
            type="button"
            className={`ul-set-switch${settings.maintenanceMode ? " is-on" : ""}`}
            disabled={!isAdmin}
            aria-pressed={settings.maintenanceMode}
            onClick={() => handleToggle("maintenanceMode", "Maintenance mode")}
          />
        </div>

        <div className="ul-set-switch-row">
          <div className="ul-set-switch-row__body">
            <p className="ul-set-switch-row__label">Require approval for new registrations</p>
            <p className="ul-set-switch-row__desc">New educator/institution sign-ups wait in a pending queue before activation.</p>
          </div>
          <button
            type="button"
            className={`ul-set-switch${settings.newRegistrationApprovalRequired ? " is-on" : ""}`}
            disabled={!isAdmin}
            aria-pressed={settings.newRegistrationApprovalRequired}
            onClick={() => handleToggle("newRegistrationApprovalRequired", "New-registration approval")}
          />
        </div>

        <div className="ul-set-switch-row">
          <div className="ul-set-switch-row__body">
            <p className="ul-set-switch-row__label">Auto-issue certificates</p>
            <p className="ul-set-switch-row__desc">Issue certificates automatically the moment completion criteria are met. Idempotent — never a duplicate per student per course.</p>
          </div>
          <button
            type="button"
            className={`ul-set-switch${settings.autoIssueCertificates ? " is-on" : ""}`}
            disabled={!isAdmin}
            aria-pressed={settings.autoIssueCertificates}
            onClick={() => handleToggle("autoIssueCertificates", "Auto-issue certificates")}
          />
        </div>

        <div className="ul-set-switch-row">
          <div className="ul-set-switch-row__body">
            <p className="ul-set-switch-row__label">Require MFA for Admins</p>
            <p className="ul-set-switch-row__desc">Require a second factor for every Admin sign-in and new device verification.</p>
          </div>
          <button type="button" className={`ul-set-switch${settings.requireMfaForAdmins ? " is-on" : ""}`} disabled={!isAdmin} aria-pressed={settings.requireMfaForAdmins} onClick={() => handleToggle("requireMfaForAdmins", "Admin MFA enforcement")} />
        </div>

        <div className="ul-set-field-row">
          <div className="ul-set-switch-row__body">
            <p className="ul-set-switch-row__label">Admin session timeout</p>
            <p className="ul-set-switch-row__desc">Automatically end inactive Admin sessions after this many minutes.</p>
          </div>
          <label className="ul-set-field-input"><input type="number" min="15" max="480" value={settings.sessionTimeoutMinutes} disabled={!isAdmin} onChange={(e) => updateSettings({ sessionTimeoutMinutes: Math.max(15, Number(e.target.value) || 15) })} /><span>min</span></label>
        </div>

        <div className="ul-set-switch-row">
          <div className="ul-set-switch-row__body">
            <p className="ul-set-switch-row__label">Allow concurrent sessions</p>
            <p className="ul-set-switch-row__desc">Allow an Admin to stay signed in on more than one trusted device.</p>
          </div>
          <button type="button" className={`ul-set-switch${settings.allowConcurrentSessions ? " is-on" : ""}`} disabled={!isAdmin} aria-pressed={settings.allowConcurrentSessions} onClick={() => handleToggle("allowConcurrentSessions", "Concurrent sessions")} />
        </div>

        <div className="ul-set-field-row">
          <div className="ul-set-switch-row__body">
            <p className="ul-set-switch-row__label">Default commission rate</p>
            <p className="ul-set-switch-row__desc">Applied to new course sales at the moment earnings accrue; later changes never apply retroactively.</p>
          </div>
          <label className="ul-set-field-input">
            <input
              type="number"
              min="0"
              max="100"
              value={rateInput}
              disabled={!isAdmin}
              onChange={(e) => setRateInput(e.target.value)}
              onBlur={commitRate}
            />
            <span>%</span>
          </label>
        </div>
      </div>
    </div>
  );
}

/* ============================== Tab 4 ============================== */

function CertificatesTab({ certificates, currentAccountName, onToast }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detailsCert, setDetailsCert] = useState(null);
  const [revokeMode, setRevokeMode] = useState(false);
  const [revokeReason, setRevokeReason] = useState("");
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueForm, setIssueForm] = useState({ studentName: "", courseName: "", educatorName: "" });

  useEffect(() => setPage(1), [search, statusFilter, courseFilter]);

  useEffect(() => {
    if (!detailsCert) return;
    const fresh = certificates.find((c) => c.certNumber === detailsCert.certNumber);
    if (fresh && fresh !== detailsCert) setDetailsCert(fresh);
  }, [certificates, detailsCert]);

  const courseOptions = useMemo(
    () => [...new Set(certificates.map((c) => c.courseName))].sort(),
    [certificates]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return certificates.filter((c) => {
      if (q && !`${c.studentName} ${c.courseName} ${c.certNumber}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (courseFilter !== "all" && c.courseName !== courseFilter) return false;
      return true;
    });
  }, [certificates, search, statusFilter, courseFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / CERT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * CERT_PAGE_SIZE, currentPage * CERT_PAGE_SIZE);

  const counts = useMemo(
    () => ({
      total: certificates.length,
      issued: certificates.filter((c) => c.status === CERT_STATUS.ISSUED).length,
      revoked: certificates.filter((c) => c.status === CERT_STATUS.REVOKED).length,
    }),
    [certificates]
  );

  const openDetails = (cert) => {
    setDetailsCert(cert);
    setRevokeMode(false);
    setRevokeReason("");
  };

  const closeDetails = () => {
    setDetailsCert(null);
    setRevokeMode(false);
    setRevokeReason("");
  };

  const confirmRevoke = () => {
    if (!detailsCert || !revokeReason.trim()) return;
    revokeCertificate(detailsCert.certNumber, revokeReason.trim(), currentAccountName || "Admin User");
    onToast(`Certificate ${detailsCert.certNumber} revoked. Logged to audit trail.`);
    closeDetails();
  };

  const issueFormValid = issueForm.studentName.trim() && issueForm.courseName.trim() && issueForm.educatorName.trim();

  const submitIssue = (e) => {
    e.preventDefault();
    if (!issueFormValid) return;
    const certNumber = issueCertificate({
      studentName: issueForm.studentName.trim(),
      courseName: issueForm.courseName.trim(),
      educatorName: issueForm.educatorName.trim(),
    });
    onToast(`Certificate ${certNumber} issued. Logged to audit trail.`);
    setIssueForm({ studentName: "", courseName: "", educatorName: "" });
    setShowIssueForm(false);
  };

  return (
    <div>
      <div className="ul-set-cert-summary">
        <div className="ul-set-cert-summary__card">
          <p className="ul-set-cert-summary__label">Total certificates</p>
          <p className="ul-set-cert-summary__value">{counts.total}</p>
        </div>
        <div className="ul-set-cert-summary__card">
          <p className="ul-set-cert-summary__label">Issued</p>
          <p className="ul-set-cert-summary__value">{counts.issued}</p>
        </div>
        <div className="ul-set-cert-summary__card">
          <p className="ul-set-cert-summary__label">Revoked</p>
          <p className="ul-set-cert-summary__value">{counts.revoked}</p>
        </div>
      </div>

      <div className="ul-set-filters">
        <label className="ul-set-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by student, course or certificate number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="ul-usr-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <select className="ul-set-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Status: All</option>
          <option value={CERT_STATUS.ISSUED}>Issued</option>
          <option value={CERT_STATUS.REVOKED}>Revoked</option>
        </select>

        <select className="ul-set-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="all">Course: All</option>
          {courseOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <button type="button" className="ul-btn ul-btn--primary" onClick={() => setShowIssueForm(true)}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconPlus size={13} color="#fff" /> Issue Certificate
          </span>
        </button>
      </div>

      <div className="ul-card ul-set-table-card">
        {pageItems.length === 0 ? (
          <div className="ul-set-empty">No certificates match these filters.</div>
        ) : (
          <div className="ul-set-table-scroll">
            <table className="ul-set-table">
              <colgroup>
                <col style={{ width: "16%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Certificate #</th>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Issue Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <tr key={c.certNumber}>
                    <td>
                      <button type="button" className="ul-set-cert-link" onClick={() => openDetails(c)}>
                        {c.certNumber}
                      </button>
                    </td>
                    <td>{c.studentName}</td>
                    <td>{c.courseName}</td>
                    <td>{c.issueDate}</td>
                    <td><CertStatusBadge status={c.status} /></td>
                    <td>
                      <div className="ul-set-actions-cell">
                        <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" onClick={() => openDetails(c)}>
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="ul-usr-pagination">
            <span className="ul-usr-pagination__info">
              Showing {(currentPage - 1) * CERT_PAGE_SIZE + 1}–{Math.min(currentPage * CERT_PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="ul-usr-pagination__controls">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Prev</button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- certificate details / preview / revoke drawer ---------- */}
      {detailsCert && (
        <div className="ul-set-drawer-backdrop" onClick={closeDetails}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">{detailsCert.certNumber}</h3>
                <p className="ul-set-drawer__sub">Issued to {detailsCert.studentName}</p>
              </div>
              <button type="button" className="ul-set-drawer__close" onClick={closeDetails} aria-label="Close">
                <IconClose size={15} />
              </button>
            </div>

            <div className="ul-set-drawer__body">
              <div className="ul-set-cert-preview">
                <p className="ul-set-cert-preview__eyebrow">Universal Learning · Certificate of Completion</p>
                <p className="ul-set-cert-preview__title">{detailsCert.courseName}</p>
                <p className="ul-set-cert-preview__name">{detailsCert.studentName}</p>
                <p className="ul-set-cert-preview__course">Instructed by {detailsCert.educatorName}</p>
                <div className="ul-set-cert-preview__foot">
                  <span>Certificate No.<strong>{detailsCert.certNumber}</strong></span>
                  <span>Issue Date<strong>{detailsCert.issueDate}</strong></span>
                  <span>Status<strong>{CERT_STATUS_LABEL[detailsCert.status]}</strong></span>
                </div>
              </div>

              {detailsCert.status === CERT_STATUS.REVOKED && (
                <div className="ul-set-revoke-box">
                  <strong>Revoked{detailsCert.revokedDate ? ` on ${detailsCert.revokedDate}` : ""}{detailsCert.revokedBy ? ` by ${detailsCert.revokedBy}` : ""}</strong>
                  {detailsCert.revokedReason}
                </div>
              )}

              {detailsCert.status === CERT_STATUS.ISSUED && revokeMode && (
                <div>
                  <p className="ul-set-section-title" style={{ fontSize: 13, marginTop: 8 }}>Revoke this certificate</p>
                  <p className="ul-set-section-desc">
                    A reason is required — revoking is an audit-relevant action and will be recorded in the
                    audit log along with your admin account and the current date.
                  </p>
                  <textarea
                    className="ul-set-reason"
                    placeholder="e.g. Course completion flagged as fraudulent…"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                  />
                </div>
              )}

              <p className="ul-set-audit-note">
                <IconAlert size={12} color="var(--color-text-muted)" />
                Issue and revoke actions are written to the platform audit log.
              </p>
            </div>

            <div className="ul-set-drawer__actions">
              {detailsCert.status === CERT_STATUS.ISSUED && !revokeMode && (
                <>
                  <button
                    type="button"
                    className="ul-btn ul-btn--ghost"
                    onClick={() => onToast(`Downloading ${detailsCert.certNumber} (mock).`)}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <IconDownload size={13} /> Download
                    </span>
                  </button>
                  <button type="button" className="ul-btn ul-btn--danger" onClick={() => setRevokeMode(true)}>
                    Revoke Certificate
                  </button>
                </>
              )}
              {detailsCert.status === CERT_STATUS.ISSUED && revokeMode && (
                <>
                  <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setRevokeMode(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ul-btn ul-btn--danger"
                    disabled={!revokeReason.trim()}
                    onClick={confirmRevoke}
                  >
                    Confirm Revoke
                  </button>
                </>
              )}
              {detailsCert.status === CERT_STATUS.REVOKED && (
                <button type="button" className="ul-btn ul-btn--ghost" onClick={closeDetails}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- manual issue-certificate drawer ---------- */}
      {showIssueForm && (
        <div className="ul-set-drawer-backdrop" onClick={() => setShowIssueForm(false)}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">Issue Certificate</h3>
                <p className="ul-set-drawer__sub">Manual issuance — for edge cases only</p>
              </div>
              <button type="button" className="ul-set-drawer__close" onClick={() => setShowIssueForm(false)} aria-label="Close">
                <IconClose size={15} />
              </button>
            </div>

            <form onSubmit={submitIssue}>
              <div className="ul-set-drawer__body">
                <p className="ul-set-section-desc">
                  Certificates are normally auto-issued the moment completion criteria are met, and issuance is
                  idempotent (one per student per course). Use this only when a completion was recorded outside
                  the normal flow.
                </p>
                <div className="ul-set-add-form" style={{ gridTemplateColumns: "1fr" }}>
                  <label>
                    Student name
                    <input
                      type="text"
                      value={issueForm.studentName}
                      onChange={(e) => setIssueForm((f) => ({ ...f, studentName: e.target.value }))}
                      placeholder="e.g. Naveen Kumar"
                    />
                  </label>
                  <label>
                    Course name
                    <input
                      type="text"
                      value={issueForm.courseName}
                      onChange={(e) => setIssueForm((f) => ({ ...f, courseName: e.target.value }))}
                      placeholder="e.g. Data Structures & Algorithms — Foundations"
                    />
                  </label>
                  <label>
                    Educator name
                    <input
                      type="text"
                      value={issueForm.educatorName}
                      onChange={(e) => setIssueForm((f) => ({ ...f, educatorName: e.target.value }))}
                      placeholder="e.g. Dr. Kavita Menon"
                    />
                  </label>
                </div>
              </div>
              <div className="ul-set-drawer__actions">
                <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setShowIssueForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="ul-btn ul-btn--primary" disabled={!issueFormValid}>
                  Issue Certificate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
