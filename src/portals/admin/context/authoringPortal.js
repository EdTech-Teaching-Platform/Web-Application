import { createContext, useContext } from "react";

// Which portal is hosting the shared test series authoring screens
// (TestSeriesWizard, TestSeriesDetail, TestDetail). The admin portal uses the
// default; the teacher portal wraps its routes in
// <AuthoringPortalContext.Provider value={EDUCATOR_AUTHORING}>. Same screens,
// same RPCs (the server decides what each role may do); only paths and a few
// labels differ.
export const ADMIN_AUTHORING = Object.freeze({
  kind: "admin",
  basePath: "/admin/testseries",
  backLabel: "Back to Test Series",
});

export const EDUCATOR_AUTHORING = Object.freeze({
  kind: "educator",
  basePath: "/teacher/test-series",
  backLabel: "Back to my test series",
});

export const AuthoringPortalContext = createContext(ADMIN_AUTHORING);

export function useAuthoringPortal() {
  return useContext(AuthoringPortalContext);
}

export const seriesPath = (portal, seriesId) => `${portal.basePath}/${seriesId}`;
export const testPath = (portal, seriesId, testId) => `${portal.basePath}/${seriesId}/tests/${testId}`;

// An educator's own series ("origin" educator) is published by an admin's
// approval; everything else (admin series, series assigned to the educator)
// is published directly.
export function needsApproval(portal, series) {
  return portal.kind === "educator" && (series?.origin ?? "educator") === "educator";
}

// The label of the main publish action.
export function publishActionLabel(portal, series, scheduled = false) {
  if (needsApproval(portal, series)) return "Submit for approval";
  return scheduled ? "Schedule go-live" : "Publish now";
}

// While an admin reviews it, an educator's series is read-only for them.
export function isLockedForReview(portal, series) {
  return portal.kind === "educator" && series?.status === "pending_approval";
}
