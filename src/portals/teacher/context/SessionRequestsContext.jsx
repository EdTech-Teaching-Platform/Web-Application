import { createContext, useContext, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { INITIAL_SESSION_REQUESTS } from "../data/sessionRequestsData";

// SessionRequestsContext — kept as its OWN context rather than folded into
// TeacherAvailabilityContext (a judgment call, documented): a request is a
// distinct entity with its own lifecycle (pending -> accepted /
// needs_new_time -> resolved / declined) that is NOT itself a calendar
// slot, and the pending-count nav badge (Part 5) needs to read from every
// /teacher/* page, including ones outside TeacherAvailabilityProvider's
// route subtree (Dashboard, Earnings, Analytics, Messaging). So this
// provider is mounted higher up, wrapping TeacherLayout itself in
// AppRoutes.jsx, instead of nested inside TeacherAvailabilityProvider the
// way MentorshipProvider is.
//
// Because of that placement, this context does NOT call
// useTeacherAvailability() itself (that context isn't mounted yet at this
// point in the tree). Conflict-checking and actually creating a booking on
// Accept/Resolve happen in the Requests page instead — nested deeper,
// where both contexts are available — which calls back into
// `resolveRequest(id, { status, ...patch })` here once it already has the
// result of TeacherAvailabilityContext.scheduleCall(...).
const SessionRequestsContext = createContext(null);

export function SessionRequestsProvider() {
  const [requests, setRequests] = useState(INITIAL_SESSION_REQUESTS);

  const pendingCount = useMemo(() => requests.filter((r) => r.status === "pending").length, [requests]);

  function updateRequest(id, patch) {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function acceptRequest(id, { resolvedBookingSlotId, resolutionMessage } = {}) {
    updateRequest(id, {
      status: "accepted",
      resolvedBookingSlotId: resolvedBookingSlotId ?? null,
      resolutionMessage: resolutionMessage || "Accepted — you're confirmed for this session.",
    });
  }

  function declineRequest(id, { reasonTag, resolutionMessage }) {
    updateRequest(id, { status: "declined", reasonTag, resolutionMessage });
  }

  function offerNewTime(id, { offeredSlots, reasonTag, resolutionMessage }) {
    updateRequest(id, { status: "needs_new_time", offeredSlots, reasonTag, resolutionMessage });
  }

  // The "student responds to Needs New Time" step, simulated as a manual
  // action the educator can trigger from the request's detail panel (see
  // file-level note in SessionRequestsInbox.jsx for why this was chosen
  // over an automatic timer) — resolves the request into a confirmed
  // booking the same way Accept does.
  function resolveNeedsNewTime(id, { resolvedBookingSlotId, resolutionMessage }) {
    updateRequest(id, {
      status: "accepted",
      resolvedBookingSlotId: resolvedBookingSlotId ?? null,
      resolutionMessage: resolutionMessage || "Resolved — the new time is confirmed.",
    });
  }

  const value = useMemo(
    () => ({ requests, pendingCount, acceptRequest, declineRequest, offerNewTime, resolveNeedsNewTime, updateRequest }),
    [requests, pendingCount]
  );

  return <SessionRequestsContext.Provider value={value}>
    <Outlet />
  </SessionRequestsContext.Provider>;
}

export function useSessionRequests() {
  const ctx = useContext(SessionRequestsContext);
  if (!ctx) throw new Error("useSessionRequests must be used within SessionRequestsProvider");
  return ctx;
}
