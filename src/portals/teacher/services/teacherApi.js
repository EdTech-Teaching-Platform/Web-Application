import apiClient from "../../../services/apiClient";

// Teacher (Educator) portal API calls go here.
// Example:
// export const getDashboard = () => apiClient.get("/teacher/dashboard");

// Unified registration + Digital ID Card (Sec 5.1). Registration.jsx now
// submits the account, profile AND documents as ONE record (status "pending")
// through data/educatorAccountStore.js (localStorage demo). When the backend
// exists, POST that whole record to e.g. `/teacher/register` and have the
// server own `status` (pending/approved/changes_requested/rejected), the
// issued educatorId, and issue/expiry dates once an admin approves. The
// endpoints below keep working for the Digital ID Card screen.

// Fetch the educator's current profile (used to prefill Step 1 on
// revisit/edit, e.g. after clicking "Edit profile" from the ID card step).
export const getEducatorProfile = () => apiClient.get("/teacher/profile");

// Persist Step 1 of this screen. Expected response includes the issued
// credential fields the UI needs for the Digital ID Card: educatorId,
// issueDate, expiryDate (see DigitalIDCard.jsx / ProfileSetup.jsx).
export const saveEducatorProfile = (profile) => apiClient.put("/teacher/profile", profile);

// Returns a rendered PDF/PNG of the Digital ID Card. Deliberately a
// server-rendered asset rather than a client-side DOM screenshot, so the
// credential looks identical regardless of the viewer's browser/zoom.
export const downloadDigitalIdCard = (educatorId) =>
  apiClient.get(`/teacher/id-card/${educatorId}/download`, { responseType: "blob" });

// Returns the public, signed verification URL/QR payload for this
// educator's ID card (see QRCodePattern.jsx — the frontend currently
// renders a deterministic placeholder pattern pending this endpoint).
export const getIdCardVerificationLink = (educatorId) => apiClient.get(`/teacher/id-card/${educatorId}/verify-link`);
