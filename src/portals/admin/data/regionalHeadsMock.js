// Regional Head Management — data layer (Admin portal only).
//
// Extends Educator Management: a Regional Head is an existing educator
// (promoted) or a newly invited person who accepted an emailed invitation.
// Region assignment lives HERE and only here; the educator list, the
// Regional Heads page and the region overview all read the same store, so
// they can never disagree.
//
// Persistence: this app has no backend, and an invitee opens the invitation
// link in a different browser tab/session than the admin. So invitations and
// head assignments are persisted to localStorage and synced across tabs via
// the "storage" event — accepting in one tab updates the admin's tab (list,
// overview and the dashboard notification popup) without a refresh. It is
// still a MOCK: anyone with browser access could edit it, tokens are not
// verified server-side, and no real email is sent (see MOCK_EMAIL_NOTICE).
//
// Rules enforced here (the existing system has no multi-head-per-region
// concept, so we do not support it):
//   - at most ONE active Regional Head per region
//   - no duplicate active (pending, unexpired) invitation for the same
//     email + region
//   - an email that is already an active Regional Head cannot be invited
//   - removing a head never deletes the educator account or other data

import { useMemo, useSyncExternalStore } from "react";
import { addEducator, updateEducator, getEducatorsSnapshot, useEducators } from "./educatorsMock";
import { addNotification } from "./notificationsMock";

export const REGIONS = [
  "Delhi",
  "Bengaluru",
  "Kolkata",
  "Mumbai",
  "Nagpur",
  "Guwahati",
];

export const INVITE_TTL_DAYS = 7;
export const MOCK_EMAIL_NOTICE =
  "Mock email only — no real email is sent. Use the secure link to test acceptance.";

export const INVITE_STATUS_LABEL = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  revoked: "Revoked",
};
export const INVITE_STATUS_BADGE = {
  pending: "is-pending",
  accepted: "is-approved",
  rejected: "is-rejected",
  expired: "is-rejected",
  revoked: "is-rejected",
};

const STORAGE_KEY = "ul_admin_regional_heads_v1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- helpers ----------
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const nowIso = () => iso(Date.now());
const daysAgoIso = (n) => iso(Date.now() - n * DAY);
const daysAheadIso = (n) => iso(Date.now() + n * DAY);

let _seq = 0;
function nextId(prefix) {
  _seq += 1;
  return `${prefix}-${Date.now().toString(36)}${_seq}`;
}
function makeToken() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
const normEmail = (e) => String(e || "").trim().toLowerCase();

export function buildInviteLink(token) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/regional-head/${token}`;
}

export function invitationDisplayStatus(inv) {
  if (inv.status === "pending" && new Date(inv.expiresAt).getTime() < Date.now()) return "expired";
  return inv.status;
}

// ---------- state ----------
function seedState() {
  return {
    invitations: [
      {
        id: "INV-1001", token: "demo-pending-east-0001", name: "Rahul Sharma", email: "rahul.sharma@example.com",
        region: "Kolkata", status: "pending", createdAt: daysAgoIso(2), expiresAt: daysAheadIso(5),
        respondedAt: null, resentCount: 0, invitedBy: "Admin User", onboarding: null, notified: true,
      },
      {
        id: "INV-1002", token: "demo-expired-west-0002", name: "Neha Kulkarni", email: "neha.kulkarni@example.com",
        region: "Mumbai", status: "pending", createdAt: daysAgoIso(2), expiresAt: daysAheadIso(5),
        respondedAt: null, resentCount: 0, invitedBy: "Admin User", onboarding: null, notified: true,
      },
      {
        id: "INV-1003", token: "demo-rejected-central-0003", name: "Imran Qureshi", email: "imran.qureshi@example.com",
        region: "Nagpur", status: "rejected", createdAt: daysAgoIso(9), expiresAt: daysAgoIso(2),
        respondedAt: daysAgoIso(6), resentCount: 0, invitedBy: "Admin User", onboarding: null, notified: true,
      },
    ],
    heads: [
      {
        id: "RH-1001", name: "Alan Turing", email: "alan.turing@example.com", region: "Delhi",
        status: "active", source: "promoted", invitationId: null, assignedAt: daysAgoIso(40), removedAt: null,
        previousRegions: [], onboarding: null,
      },
      {
        id: "RH-1002", name: "Meredith Chan", email: "meredith.chan@example.com", region: "Bengaluru",
        status: "active", source: "promoted", invitationId: null, assignedAt: daysAgoIso(25), removedAt: null,
        previousRegions: [], onboarding: null,
      },
    ],
    emailLog: [],
  };
}

function loadState() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.invitations) && Array.isArray(parsed.heads)) {
        // one-time fix: the demo invite for Neha Kulkarni used to be seeded as expired
        parsed.invitations = parsed.invitations.map((i) =>
          i.id === "INV-1002" && i.status === "pending" && new Date(i.expiresAt).getTime() < Date.now()
            ? { ...i, createdAt: daysAgoIso(2), expiresAt: daysAheadIso(5) }
            : i
        );
        // one-time fix: regions are now cities instead of compass zones
        const CITY = { "North Region": "Delhi", "South Region": "Bengaluru", "East Region": "Kolkata", "West Region": "Mumbai", "Central Region": "Nagpur", "North-East Region": "Guwahati" };
        const fixRegion = (x) => (x && CITY[x.region] ? { ...x, region: CITY[x.region] } : x);
        parsed.invitations = parsed.invitations.map(fixRegion);
        parsed.heads = parsed.heads.map(fixRegion);
        return { ...parsed, emailLog: Array.isArray(parsed.emailLog) ? parsed.emailLog : [] };
      }
    }
  } catch (err) {
    /* storage unavailable or corrupt — fall back to seed */
  }
  return seedState();
}

let _state = loadState();
const _listeners = new Set();
function _emit() {
  _listeners.forEach((fn) => fn());
}
function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function persist() {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch (err) {
    /* ignore quota / private-mode errors — state still works in memory */
  }
}
function setState(next) {
  _state = next;
  persist();
  _emit();
}

export function useRegionalState() {
  return useSyncExternalStore(_subscribe, () => _state);
}
export function getRegionalState() {
  return _state;
}

// ---------- educator linkage ----------
// Heads are matched to educator records by email (educator ids are
// regenerated on reload for newly-created educators; emails are stable).
export function findEducatorForHead(head, educators = getEducatorsSnapshot()) {
  const email = normEmail(head.email);
  return educators.find((e) => normEmail(e.email) === email) || null;
}

function splitName(full) {
  const parts = String(full || "").trim().split(/\s+/);
  const first = parts.shift() || "Regional";
  return { first, last: parts.join(" ") || "Head" };
}

// Makes the educator-side records match the head store: creates the
// educator account for an accepted invitee that has none yet (the account
// of an existing educator is reused, never duplicated) and tags every
// active head with role "Regional Head". Idempotent.
export function syncEducators() {
  _state.heads.filter((h) => h.status === "active").forEach((h) => {
    let educator = findEducatorForHead(h);
    if (!educator && h.source === "invited") {
      const { first, last } = splitName(h.name);
      educator = addEducator({
        firstName: first,
        lastName: last,
        email: h.email,
        phone: (h.onboarding && h.onboarding.phone) || "",
        qualification: (h.onboarding && h.onboarding.qualification) || "Regional Head",
        years: (h.onboarding && h.onboarding.years) || 0,
        accountStatus: "active",
        verificationStatus: "pending",
      });
    }
    if (educator && educator.role !== "Regional Head") updateEducator(educator.id, { role: "Regional Head" });
  });
}

// ---------- admin-side effects (notifications) ----------
let _adminActive = false;
let _storageHandler = null;
let _pollTimer = null;

function processAcceptances() {
  if (!_adminActive) return;
  let changed = false;
  const invitations = _state.invitations.map((inv) => {
    if ((inv.status === "accepted" || inv.status === "rejected") && !inv.notified) {
      changed = true;
      if (inv.status === "accepted") {
        const when = new Date(inv.respondedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
        addNotification({
          type: "approval",
          title: "Regional Head invitation accepted",
          message: `${inv.name} has accepted the Regional Head invitation for the ${inv.region}. (${inv.email} · ${when})`,
          link: "/admin/regionalheads",
        });
      } else {
        addNotification({
          type: "approval",
          title: "Regional Head invitation declined",
          message: `${inv.name} has declined the Regional Head invitation for the ${inv.region}. (${inv.email})`,
          link: "/admin/regionalheads",
        });
      }
      return { ...inv, notified: true };
    }
    return inv;
  });
  if (changed) setState({ ..._state, invitations });
}

// Called once by the always-mounted admin chrome (AdminTopbar). Starts
// listening for acceptances made in another tab and applies any that
// happened while no admin tab was open.
export function startRegionalHeadSync() {
  _adminActive = true;
  syncEducators();
  processAcceptances();
  if (typeof window !== "undefined" && !_storageHandler) {
    // Re-read the shared store whenever another tab changed it. The "storage"
    // event covers the normal case; focus / visibility / a light poll are
    // fallbacks so a response made in another tab always shows up here.
    const reload = () => {
      let raw = null;
      try { raw = localStorage.getItem(STORAGE_KEY); } catch (err) { return; }
      if (!raw || raw === JSON.stringify(_state)) return;
      _state = loadState();
      _emit();
      syncEducators();
      processAcceptances();
    };
    _storageHandler = (e) => {
      if (e && e.key && e.key !== STORAGE_KEY) return;
      reload();
    };
    window.addEventListener("storage", _storageHandler);
    window.addEventListener("focus", _storageHandler);
    document.addEventListener("visibilitychange", _storageHandler);
    _pollTimer = setInterval(reload, 2000);
  }
  return () => {
    _adminActive = false;
    if (typeof window !== "undefined" && _storageHandler) {
      window.removeEventListener("storage", _storageHandler);
      window.removeEventListener("focus", _storageHandler);
      document.removeEventListener("visibilitychange", _storageHandler);
      clearInterval(_pollTimer);
      _storageHandler = null;
    }
  };
}

// ---------- queries ----------
export function activeHeadForRegion(region, state = _state) {
  return state.heads.find((h) => h.status === "active" && h.region === region) || null;
}
export function activeHeadByEmail(email, state = _state) {
  const e = normEmail(email);
  return state.heads.find((h) => h.status === "active" && normEmail(h.email) === e) || null;
}

// educatorId -> active head assignment. Used by the educator list so the
// badge/region always match the Regional Heads page.
export function useRegionalHeadMap() {
  const state = useRegionalState();
  const educators = useEducators();
  return useMemo(() => {
    const map = new Map();
    state.heads.filter((h) => h.status === "active").forEach((h) => {
      const e = findEducatorForHead(h, educators);
      if (e) map.set(e.id, h);
    });
    return map;
  }, [state, educators]);
}

export function getInvitationByToken(token) {
  return _state.invitations.find((i) => i.token === token) || null;
}

export function buildRegionOverview(state, educators) {
  return REGIONS.map((region) => {
    const head = activeHeadForRegion(region, state);
    const educator = head ? findEducatorForHead(head, educators) : null;
    const invites = state.invitations
      .filter((i) => i.region === region)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pendingInvite = invites.find((i) => invitationDisplayStatus(i) === "pending") || null;
    const lastInvite = invites[0] || null;
    let status = "Vacant";
    if (head) status = "Active";
    else if (pendingInvite) status = "Invitation pending";
    return { region, head, educator, pendingInvite, lastInvite, status };
  });
}

// ---------- mutations ----------
function logEmail(state, inv, kind) {
  const link = buildInviteLink(inv.token);
  const entry = {
    id: nextId("MAIL"),
    invitationId: inv.id,
    to: inv.email,
    subject: `${kind === "resend" ? "Reminder: " : ""}You're invited to be the Regional Head for ${inv.region}`,
    body: `Hi ${inv.name}, you've been invited to serve as Regional Head for the ${inv.region}. Open the secure link to accept or decline. The link expires on ${new Date(inv.expiresAt).toLocaleDateString("en-IN")}.`,
    link,
    sentAt: nowIso(),
    mock: true,
  };
  return { ...state, emailLog: [entry, ...state.emailLog].slice(0, 40) };
}

export function inviteRegionalHead({ name, email, region, invitedBy = "Admin User" }) {
  const cleanName = String(name || "").trim();
  const cleanEmail = normEmail(email);
  if (!cleanName) return { ok: false, error: "Name is required." };
  if (!cleanEmail) return { ok: false, error: "Email is required." };
  if (!EMAIL_RE.test(cleanEmail)) return { ok: false, error: "Enter a valid email address." };
  if (!REGIONS.includes(region)) return { ok: false, error: "Select a region." };
  if (activeHeadByEmail(cleanEmail)) return { ok: false, error: "This person is already an active Regional Head." };
  const regionHead = activeHeadForRegion(region);
  if (regionHead) return { ok: false, error: `${region} already has a Regional Head (${regionHead.name}). Remove or reassign them first.` };
  const dup = _state.invitations.find(
    (i) => normEmail(i.email) === cleanEmail && i.region === region && invitationDisplayStatus(i) === "pending"
  );
  if (dup) return { ok: false, error: "A pending invitation for this email and region already exists. Resend or revoke it instead." };

  const inv = {
    id: nextId("INV"),
    token: makeToken(),
    name: cleanName,
    email: cleanEmail,
    region,
    status: "pending",
    createdAt: nowIso(),
    expiresAt: daysAheadIso(INVITE_TTL_DAYS),
    respondedAt: null,
    resentCount: 0,
    invitedBy,
    onboarding: null,
    notified: true,
  };
  setState(logEmail({ ..._state, invitations: [inv, ..._state.invitations] }, inv, "invite"));
  return { ok: true, invitation: inv };
}

export function resendInvitation(id) {
  const inv = _state.invitations.find((i) => i.id === id);
  if (!inv) return { ok: false, error: "Invitation not found." };
  const status = invitationDisplayStatus(inv);
  if (status !== "pending" && status !== "expired") return { ok: false, error: `A ${INVITE_STATUS_LABEL[status].toLowerCase()} invitation can't be resent.` };
  if (activeHeadForRegion(inv.region)) return { ok: false, error: `${inv.region} already has a Regional Head.` };
  const refreshed = {
    ...inv,
    status: "pending",
    token: makeToken(), // the previous link stops working
    createdAt: nowIso(),
    expiresAt: daysAheadIso(INVITE_TTL_DAYS),
    resentCount: inv.resentCount + 1,
  };
  setState(
    logEmail({ ..._state, invitations: _state.invitations.map((i) => (i.id === id ? refreshed : i)) }, refreshed, "resend")
  );
  return { ok: true, invitation: refreshed };
}

// Move a pending/expired invitation to another region. The invitee gets a fresh
// secure link and a new 7-day window (the previous link stops working).
export function reassignInvitation(id, region) {
  const inv = _state.invitations.find((i) => i.id === id);
  if (!inv) return { ok: false, error: "Invitation not found." };
  const status = invitationDisplayStatus(inv);
  if (status !== "pending" && status !== "expired") return { ok: false, error: "Only pending invitations can be reassigned." };
  if (!REGIONS.includes(region)) return { ok: false, error: "Select a region." };
  if (inv.region === region) return { ok: false, error: "The invitation is already for that region." };
  const existing = activeHeadForRegion(region);
  if (existing) return { ok: false, error: `${region} already has a Regional Head (${existing.name}).` };
  const dup = _state.invitations.find(
    (i) => i.id !== id && normEmail(i.email) === normEmail(inv.email) && i.region === region && invitationDisplayStatus(i) === "pending"
  );
  if (dup) return { ok: false, error: "A pending invitation for this email and that region already exists." };
  const updated = { ...inv, region, status: "pending", token: makeToken(), createdAt: nowIso(), expiresAt: daysAheadIso(INVITE_TTL_DAYS), respondedAt: null };
  setState(logEmail({ ..._state, invitations: _state.invitations.map((i) => (i.id === id ? updated : i)) }, updated, "invite"));
  return { ok: true, invitation: updated };
}

export function revokeInvitation(id) {
  const inv = _state.invitations.find((i) => i.id === id);
  if (!inv) return { ok: false, error: "Invitation not found." };
  const status = invitationDisplayStatus(inv);
  if (status !== "pending" && status !== "expired") return { ok: false, error: "Only pending invitations can be revoked." };
  setState({
    ..._state,
    invitations: _state.invitations.map((i) => (i.id === id ? { ...i, status: "revoked", respondedAt: nowIso() } : i)),
  });
  return { ok: true };
}

// Invitee response (called from the standalone invitation page).
// Returns { ok } or { ok:false, reason } where reason is one of
// invalid | expired | used | revoked | region_taken | validation.
export function lookupInvitation(token) {
  const inv = getInvitationByToken(token);
  if (!inv) return { state: "invalid", invitation: null };
  const status = invitationDisplayStatus(inv);
  if (status === "pending") return { state: "pending", invitation: inv };
  if (status === "expired") return { state: "expired", invitation: inv };
  if (status === "revoked") return { state: "revoked", invitation: inv };
  return { state: "used", invitation: inv }; // accepted or rejected already
}

export function respondToInvitation(token, decision, onboarding) {
  const found = lookupInvitation(token);
  if (found.state !== "pending") return { ok: false, reason: found.state };
  const inv = found.invitation;

  if (decision === "reject") {
    setState({
      ..._state,
      invitations: _state.invitations.map((i) =>
        i.id === inv.id ? { ...i, status: "rejected", respondedAt: nowIso(), notified: false } : i
      ),
    });
    processAcceptances();
    return { ok: true, invitation: { ...inv, status: "rejected" } };
  }

  if (decision === "accept") {
    if (activeHeadForRegion(inv.region)) return { ok: false, reason: "region_taken" };
    const data = {
      phone: String((onboarding && onboarding.phone) || "").trim(),
      qualification: String((onboarding && onboarding.qualification) || "").trim(),
      years: Number(onboarding && onboarding.years) || 0,
    };
    if (!data.phone || !data.qualification) return { ok: false, reason: "validation" };
    const at = nowIso();
    const head = {
      id: nextId("RH"),
      name: inv.name,
      email: inv.email,
      region: inv.region,
      status: "active",
      source: "invited",
      invitationId: inv.id,
      assignedAt: at,
      removedAt: null,
      previousRegions: [],
      onboarding: data,
    };
    setState({
      ..._state,
      invitations: _state.invitations.map((i) =>
        i.id === inv.id ? { ...i, status: "accepted", respondedAt: at, onboarding: data, notified: false } : i
      ),
      heads: [head, ..._state.heads],
    });
    syncEducators();
    processAcceptances();
    return { ok: true, invitation: { ...inv, status: "accepted" } };
  }
  return { ok: false, reason: "validation" };
}

export function promoteEducator(educatorId, region) {
  const educator = getEducatorsSnapshot().find((e) => e.id === educatorId);
  if (!educator) return { ok: false, error: "Educator not found." };
  if (!REGIONS.includes(region)) return { ok: false, error: "Select a region." };
  if (activeHeadByEmail(educator.email)) return { ok: false, error: `${educator.name} is already a Regional Head.` };
  const existing = activeHeadForRegion(region);
  if (existing) return { ok: false, error: `${region} already has a Regional Head (${existing.name}). Remove or reassign them first.` };
  const head = {
    id: nextId("RH"),
    name: educator.name,
    email: educator.email,
    region,
    status: "active",
    source: "promoted",
    invitationId: null,
    assignedAt: nowIso(),
    removedAt: null,
    previousRegions: [],
    onboarding: null,
  };
  setState({ ..._state, heads: [head, ..._state.heads] });
  updateEducator(educatorId, { role: "Regional Head" });
  return { ok: true, head };
}

export function removeRegionalHead(headId) {
  const head = _state.heads.find((h) => h.id === headId && h.status === "active");
  if (!head) return { ok: false, error: "Regional Head not found." };
  setState({
    ..._state,
    heads: _state.heads.map((h) => (h.id === headId ? { ...h, status: "removed", removedAt: nowIso() } : h)),
  });
  // Only the role/assignment change — the educator account and all of
  // their courses, students and history are left exactly as they were.
  const educator = findEducatorForHead(head);
  if (educator) updateEducator(educator.id, { role: "Educator" });
  return { ok: true };
}

export function reassignRegionalHead(headId, region) {
  const head = _state.heads.find((h) => h.id === headId && h.status === "active");
  if (!head) return { ok: false, error: "Regional Head not found." };
  if (!REGIONS.includes(region)) return { ok: false, error: "Select a region." };
  if (head.region === region) return { ok: false, error: "That is already their region." };
  const existing = activeHeadForRegion(region);
  if (existing) return { ok: false, error: `${region} already has a Regional Head (${existing.name}).` };
  setState({
    ..._state,
    heads: _state.heads.map((h) =>
      h.id === headId ? { ...h, region, previousRegions: [...h.previousRegions, { region: h.region, until: nowIso() }] } : h
    ),
  });
  return { ok: true };
}

// Make sure role tags are right for the seeded heads on first load.
syncEducators();
