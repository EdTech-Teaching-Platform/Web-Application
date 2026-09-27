// Settings & Permissions — admin users + role/permission matrix + platform
// settings mock data.
// Jira: Day 13 — Settings & permissions + certificate mgmt
// Settings & Permissions — configure platform-level access. Admin.
// How It Works: Grant/restrict module access per role. Expected Outcome:
// Controlled administrative access. There's a single Admin role with
// full, unrestricted access to every module and platform setting, and it
// can grant role/permission changes for everyone else. Head Teacher /
// Regional Head accounts are scoped to their own institution/region.
//
// UI-only placeholder data; replace with real calls through
// ../services/adminApi.js once the settings/permissions endpoints exist.
// Follows the same tiny pub/sub "store" pattern already used by
// data/studentsMock.js / data/educatorsMock.js so SettingsPermissions.jsx
// stays in sync across re-renders without a real API layer.

import { useSyncExternalStore } from "react";

export const ROLE = {
  ADMIN: "admin",
  HEAD_TEACHER: "head-teacher",
  SUPER_ADMIN: "super-admin",
};

export const ROLE_LABEL = {
  [ROLE.ADMIN]: "Admin",
  [ROLE.HEAD_TEACHER]: "Head Teacher / Regional Head",
  [ROLE.SUPER_ADMIN]: "Super Admin",
};

export const ROLE_OPTIONS = [ROLE.ADMIN, ROLE.HEAD_TEACHER];

export const PERMISSION_ACTIONS = ["view", "create", "edit", "manage"];
export const PERMISSION_ACTION_LABEL = { view: "View", create: "Create", edit: "Edit", manage: "Manage" };

export const MODULE = {
  USER_MANAGEMENT: "userManagement",
  COURSE_APPROVAL: "courseApproval",
  TEST_SERIES: "testSeries",
  PAYMENTS: "payments",
  CONTENT_MODERATION: "contentModeration",
  REPORTS: "reports",
  SETTINGS: "settings",
};

export const MODULE_LABEL = {
  [MODULE.USER_MANAGEMENT]: "Student Management",
  [MODULE.COURSE_APPROVAL]: "Course Approval",
  [MODULE.TEST_SERIES]: "Test Series",
  [MODULE.PAYMENTS]: "Payments & Refunds",
  [MODULE.CONTENT_MODERATION]: "Content Moderation",
  [MODULE.REPORTS]: "Reports & Analytics",
  [MODULE.SETTINGS]: "Settings & Permissions",
};

export const MODULE_ORDER = [
  MODULE.USER_MANAGEMENT,
  MODULE.COURSE_APPROVAL,
  MODULE.TEST_SERIES,
  MODULE.PAYMENTS,
  MODULE.CONTENT_MODERATION,
  MODULE.REPORTS,
  MODULE.SETTINGS,
];

// Per-role, per-module notes shown under a toggle when access is scoped
// rather than a plain on/off (Head Teacher/Regional Head is
// org/region-scoped everywhere; Admin has full, unbounded access to
// every module, so it has no notes of its own).
export const PERMISSION_NOTE = {
  [ROLE.HEAD_TEACHER]: {
    [MODULE.USER_MANAGEMENT]: "Scoped to students within their assigned region/branch only.",
    [MODULE.COURSE_APPROVAL]: "Scoped to courses submitted within their assigned region/branch only.",
    [MODULE.TEST_SERIES]: "Scoped to Test Series within their assigned region/branch only.",
    [MODULE.PAYMENTS]: "View-only — no refund/commission approval.",
    [MODULE.CONTENT_MODERATION]: "Scoped to their assigned region/branch only.",
    [MODULE.REPORTS]: "Scoped to their assigned region/branch only.",
    [MODULE.SETTINGS]: "No access — platform configuration is Admin only.",
  },
};

// Admin always has full, unbounded access to every module and is not
// editable (only Admin can grant role/permission changes, so Admin's
// own row is the fixed ceiling, not a togglable row).
const SEED_MATRIX = {
  [ROLE.ADMIN]: {
    [MODULE.USER_MANAGEMENT]: true,
    [MODULE.COURSE_APPROVAL]: true,
    [MODULE.TEST_SERIES]: true,
    [MODULE.PAYMENTS]: true,
    [MODULE.CONTENT_MODERATION]: true,
    [MODULE.REPORTS]: true,
    [MODULE.SETTINGS]: true,
  },
  [ROLE.HEAD_TEACHER]: {
    [MODULE.USER_MANAGEMENT]: true,
    [MODULE.COURSE_APPROVAL]: true,
    [MODULE.TEST_SERIES]: true,
    [MODULE.PAYMENTS]: false,
    [MODULE.CONTENT_MODERATION]: true,
    [MODULE.REPORTS]: true,
    [MODULE.SETTINGS]: false,
  },
};

export const ADMIN_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  INVITED: "invited",
};

export const ADMIN_STATUS_LABEL = {
  [ADMIN_STATUS.ACTIVE]: "Active",
  [ADMIN_STATUS.SUSPENDED]: "Suspended",
  [ADMIN_STATUS.INVITED]: "Invitation pending",
};

export const ADMIN_STATUS_BADGE_CLASS = {
  [ADMIN_STATUS.ACTIVE]: "is-account-active",
  [ADMIN_STATUS.SUSPENDED]: "is-account-suspended",
  [ADMIN_STATUS.INVITED]: "is-pending",
};

const SEED_ADMIN_USERS = [
  {
    id: "ADM-001",
    name: "Radhika Krishnan",
    initials: "RK",
    email: "radhika.krishnan@universallearning.com",
    role: ROLE.ADMIN,
    status: ADMIN_STATUS.ACTIVE,
    lastLogin: "Today, 9:14 AM",
    mfaEnabled: true,
    activeSessions: 2,
  },
  {
    id: "ADM-002",
    name: "Arjun Kapoor",
    initials: "AK",
    email: "arjun.kapoor@universallearning.com",
    role: ROLE.ADMIN,
    status: ADMIN_STATUS.ACTIVE,
    lastLogin: "Today, 8:02 AM",
    mfaEnabled: true,
    activeSessions: 1,
  },
  {
    id: "ADM-003",
    name: "Priya Menon",
    initials: "PM",
    email: "priya.menon@universallearning.com",
    role: ROLE.ADMIN,
    status: ADMIN_STATUS.ACTIVE,
    lastLogin: "Yesterday, 6:47 PM",
    mfaEnabled: false,
    activeSessions: 1,
  },
  {
    id: "ADM-004",
    name: "Vikram Desai",
    initials: "VD",
    email: "vikram.desai@universallearning.com",
    role: ROLE.HEAD_TEACHER,
    status: ADMIN_STATUS.ACTIVE,
    lastLogin: "2 days ago",
    mfaEnabled: true,
    activeSessions: 1,
  },
  {
    id: "ADM-005",
    name: "Sunita Rao",
    initials: "SR",
    email: "sunita.rao@universallearning.com",
    role: ROLE.HEAD_TEACHER,
    status: ADMIN_STATUS.ACTIVE,
    lastLogin: "5 days ago",
    mfaEnabled: true,
    activeSessions: 0,
  },
  {
    id: "ADM-006",
    name: "Farhan Ali",
    initials: "FA",
    email: "farhan.ali@universallearning.com",
    role: ROLE.ADMIN,
    status: ADMIN_STATUS.SUSPENDED,
    lastLogin: "3 weeks ago",
    mfaEnabled: false,
    activeSessions: 0,
  },
  {
    id: "ADM-007",
    name: "Neha Bhatt",
    initials: "NB",
    email: "neha.bhatt@universallearning.com",
    role: ROLE.HEAD_TEACHER,
    status: ADMIN_STATUS.ACTIVE,
    lastLogin: "1 week ago",
    mfaEnabled: true,
    activeSessions: 1,
  },
];

const SEED_SETTINGS = {
  maintenanceMode: false,
  newRegistrationApprovalRequired: true,
  defaultCommissionRatePct: 15,
  autoIssueCertificates: true,
  requireMfaForAdmins: true,
  sessionTimeoutMinutes: 60,
  allowConcurrentSessions: true,
};

const SEED_CUSTOM_ROLES = [
  { id: "content-manager", name: "Content Manager", description: "Create and maintain learning content without access to payments." },
  { id: "support-lead", name: "Support Lead", description: "Manage support operations, reports, and requester communication." },
];

function defaultGranularPermissions(role) {
  return Object.fromEntries(MODULE_ORDER.map((module) => [module, Object.fromEntries(PERMISSION_ACTIONS.map((action) => [action, role === ROLE.ADMIN || (role === ROLE.HEAD_TEACHER && action === "view")]))]));
}

const SEED_GRANULAR = {
  [ROLE.ADMIN]: defaultGranularPermissions(ROLE.ADMIN),
  [ROLE.HEAD_TEACHER]: Object.fromEntries(MODULE_ORDER.map((module) => [module, {
    view: !!SEED_MATRIX[ROLE.HEAD_TEACHER][module],
    create: module !== MODULE.PAYMENTS && !!SEED_MATRIX[ROLE.HEAD_TEACHER][module],
    edit: module !== MODULE.PAYMENTS && !!SEED_MATRIX[ROLE.HEAD_TEACHER][module],
    manage: false,
  }])),
};

// ---------- tiny mock "store" (mirrors ../data/studentsMock.js) ----------
let _matrix = structuredClone(SEED_MATRIX);
let _customRoles = [...SEED_CUSTOM_ROLES];
let _granular = structuredClone(SEED_GRANULAR);
let _adminUsers = [...SEED_ADMIN_USERS];
let _settings = { ...SEED_SETTINGS };
let _permissionHistory = [
  { id: "PH-1004", actor: "Aisha Khan", action: "Granted report export access", role: "Content Manager", module: MODULE.REPORTS, timestamp: "Sep 18, 2026 · 16:40" },
  { id: "PH-1003", actor: "Radhika Krishnan", action: "Created custom role", role: "Support Lead", module: MODULE.SETTINGS, timestamp: "Sep 17, 2026 · 11:15" },
  { id: "PH-1002", actor: "Marcus Lee", action: "Restricted payment management", role: ROLE_LABEL[ROLE.HEAD_TEACHER], module: MODULE.PAYMENTS, timestamp: "Sep 16, 2026 · 09:20" },
];
const _listeners = new Set();
function _notify() {
  _listeners.forEach((fn) => fn());
}
function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function useRoleMatrix() {
  return useSyncExternalStore(_subscribe, () => _matrix);
}

// Admin's own row is fixed — never toggled from the UI.
export function togglePermission(role, module) {
  if (role === ROLE.ADMIN) return;
  _matrix = { ...(_matrix), [role]: { ..._matrix[role], [module]: !_matrix[role][module] } };
  _permissionHistory = [{ id: `PH-${Date.now()}`, actor: "Admin User", action: `${_matrix[role][module] ? "Granted" : "Restricted"} module access`, role: ROLE_LABEL[role], module, timestamp: new Date().toLocaleString("en-US") }, ..._permissionHistory];
  _notify();
}

// Generic audit-event writer shared by other Admin modules (e.g. Test
// Series) so Super Admin-only actions land in this same Permission
// Change History list — the existing audit trail — rather than a new one.
export function recordAuditEvent({ actor, action, role, module }) {
  _permissionHistory = [{ id: `PH-${Date.now()}`, actor, action, role, module, timestamp: new Date().toLocaleString("en-US") }, ..._permissionHistory];
  _notify();
}

export function useCustomRoles() {
  return useSyncExternalStore(_subscribe, () => _customRoles);
}

export function createCustomRole({ name, description }) {
  const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
  const role = { id, name, description };
  _customRoles = [..._customRoles, role];
  ROLE_LABEL[id] = name;
  _matrix = { ..._matrix, [id]: Object.fromEntries(MODULE_ORDER.map((module) => [module, false])) };
  _granular = { ..._granular, [id]: Object.fromEntries(MODULE_ORDER.map((module) => [module, Object.fromEntries(PERMISSION_ACTIONS.map((action) => [action, false]))])) };
  _permissionHistory = [{ id: `PH-${Date.now()}`, actor: "Admin User", action: "Created custom role", role: name, module: MODULE.SETTINGS, timestamp: new Date().toLocaleString("en-US") }, ..._permissionHistory];
  _notify();
  return id;
}

export function updateCustomRole(id, patch) {
  _customRoles = _customRoles.map((role) => role.id === id ? { ...role, ...patch } : role);
  if (patch.name) ROLE_LABEL[id] = patch.name;
  _permissionHistory = [{ id: `PH-${Date.now()}`, actor: "Admin User", action: "Edited custom role", role: ROLE_LABEL[id], module: MODULE.SETTINGS, timestamp: new Date().toLocaleString("en-US") }, ..._permissionHistory];
  _notify();
}

export function useGranularPermissions() {
  return useSyncExternalStore(_subscribe, () => _granular);
}

export function toggleGranularPermission(role, module, action) {
  if (role === ROLE.ADMIN) return;
  const next = !_granular[role]?.[module]?.[action];
  _granular = { ..._granular, [role]: { ..._granular[role], [module]: { ..._granular[role][module], [action]: next } } };
  if (next) _matrix = { ..._matrix, [role]: { ..._matrix[role], [module]: true } };
  _permissionHistory = [{ id: `PH-${Date.now()}`, actor: "Admin User", action: `${next ? "Granted" : "Restricted"} ${PERMISSION_ACTION_LABEL[action]} permission`, role: ROLE_LABEL[role], module, timestamp: new Date().toLocaleString("en-US") }, ..._permissionHistory];
  _notify();
}

export function usePermissionHistory() {
  return useSyncExternalStore(_subscribe, () => _permissionHistory);
}

export function useAdminUsers() {
  return useSyncExternalStore(_subscribe, () => _adminUsers);
}

export function addAdminUser({ name, email, role }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const nextId = `ADM-${String(_adminUsers.length + 1).padStart(3, "0")}`;
  _adminUsers = [
    ..._adminUsers,
    { id: nextId, name, initials, email, role, status: ADMIN_STATUS.INVITED, lastLogin: "Never", mfaEnabled: false, activeSessions: 0, invitationSentAt: "Just now" },
  ];
  _notify();
}

export function deactivateAdminUser(id) {
  _adminUsers = _adminUsers.map((u) => (u.id === id ? { ...u, status: ADMIN_STATUS.SUSPENDED } : u));
  _notify();
}

export function reactivateAdminUser(id) {
  _adminUsers = _adminUsers.map((u) => (u.id === id ? { ...u, status: ADMIN_STATUS.ACTIVE } : u));
  _notify();
}

export function updateAdminUserRole(id, role) {
  _adminUsers = _adminUsers.map((u) => (u.id === id ? { ...u, role } : u));
  _notify();
}

export function updateAdminUserSecurity(id, patch) {
  _adminUsers = _adminUsers.map((u) => (u.id === id ? { ...u, ...patch } : u));
  _notify();
}

export function resendAdminInvite(id) {
  _adminUsers = _adminUsers.map((u) => (u.id === id ? { ...u, status: ADMIN_STATUS.INVITED, invitationSentAt: "Just now" } : u));
  _notify();
}

export function forceLogoutAdmin(id) {
  _adminUsers = _adminUsers.map((u) => (u.id === id ? { ...u, activeSessions: 0 } : u));
  _notify();
}

export function useSettings() {
  return useSyncExternalStore(_subscribe, () => _settings);
}

export function updateSettings(patch) {
  _settings = { ..._settings, ...patch };
  _notify();
}
