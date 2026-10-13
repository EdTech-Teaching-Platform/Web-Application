import { useMemo, useState } from "react";
import { useSessionRequests } from "../context/SessionRequestsContext";
import { useTeacherAvailability } from "../context/TeacherAvailabilityContext";
import Chip from "../../../components/ui/Chip";
import Select from "../../../components/ui/Select";
import SessionRequestCard from "../components/SessionRequestCard";
import SessionRequestDetail from "../components/SessionRequestDetail";
import { REQUEST_FILTERS, REQUEST_SORTS } from "../data/sessionRequestsData";
import { CalendarIcon } from "../../../components/ui/icons";

const FILTER_TO_STATUS = {
  All: null,
  Pending: "pending",
  Accepted: "accepted",
  "Needs New Time": "needs_new_time",
  Declined: "declined",
};

// SessionRequests — the Requests inbox (Part 5): the general-purpose
// scheduling flow now runs through here instead of an educator-initiated
// "Schedule a Call" button. Every Accept/Resolve writes a real booking
// through useTeacherAvailability().scheduleCall — the exact same function
// Mentorship Check-In and the old Scheduled Call Booking flow used — so an
// accepted request shows up on the Availability calendar immediately, no
// separate booking list.
export default function SessionRequests() {
  const { requests, acceptRequest, declineRequest, offerNewTime, resolveNeedsNewTime } = useSessionRequests();
  const { slots, scheduleCall } = useTeacherAvailability();

  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("newest");
  const [openRequestId, setOpenRequestId] = useState(null);

  const filtered = useMemo(() => {
    const status = FILTER_TO_STATUS[filter];
    let list = status ? requests.filter((r) => r.status === status) : requests;
    list = [...list].sort((a, b) =>
      sort === "soonest"
        ? (a.requestedDate + a.requestedStart).localeCompare(b.requestedDate + b.requestedStart)
        : new Date(b.submittedAt) - new Date(a.submittedAt)
    );
    return list;
  }, [requests, filter, sort]);

  const openRequest = requests.find((r) => r.id === openRequestId) || null;

  function handleAccept(request) {
    const result = scheduleCall({
      studentName: request.studentName,
      courseId: request.courseId,
      courseTitle: request.courseTitle,
      sessionType: request.sessionType,
      date: request.requestedDate,
      startTime: request.requestedStart,
      endTime: request.requestedEnd,
      note: request.note,
    });
    if (!result.ok) return result; // a conflict slipped in since the panel opened — banner will show it
    acceptRequest(request.id, {
      resolvedBookingSlotId: result.slot.id,
      resolutionMessage: `Accepted — confirmed for ${request.requestedDate} at ${request.requestedStart}. ${request.studentName.split(" ")[0]} will see the update on their request.`,
    });
    return result;
  }

  function handleDecline(id, patch) {
    declineRequest(id, patch);
  }

  function handleOfferNewTime(request, { offeredSlots, reasonTag, resolutionMessage }) {
    offerNewTime(request.id, { offeredSlots, reasonTag, resolutionMessage });
  }

  // The "student responds to Needs New Time" step is simulated here: the
  // educator picks one of the offered chips on the student's behalf (see
  // SessionRequestDetail.jsx's file comment for why — there's no live
  // backend for a student's actual reply in this demo build) and it
  // resolves into a real booking the same way Accept does.
  function handleResolveNeedsNewTime(request, offered) {
    const result = scheduleCall({
      studentName: request.studentName,
      courseId: request.courseId,
      courseTitle: request.courseTitle,
      sessionType: request.sessionType,
      date: offered.date,
      startTime: offered.start,
      endTime: offered.end,
      note: request.note,
    });
    if (!result.ok) return;
    resolveNeedsNewTime(request.id, {
      resolvedBookingSlotId: result.slot.id,
      resolutionMessage: `Resolved — confirmed for ${offered.date} at ${offered.start}.`,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="eyebrow mb-1.5">Requests</div>
        <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">Session Requests</h1>
        <p className="mt-1 text-sm text-muted">
          Students request time with you here instead of you scheduling ad hoc — review, accept, or negotiate a new
          time.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {REQUEST_FILTERS.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)} className="px-4 py-1.5 text-xs">
              {f}
            </Chip>
          ))}
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-full border border-text/15 bg-white px-4 py-2 pr-9 text-xs font-medium text-text outline-none focus:border-primary/40">
          {REQUEST_SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              Sort: {s.label}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
            <CalendarIcon className="h-6 w-6" />
          </span>
          <p className="text-sm font-semibold text-text">No session requests right now</p>
          <p className="max-w-sm text-xs text-muted">Students can request time with you from your profile.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <SessionRequestCard key={r.id} request={r} onOpen={(req) => setOpenRequestId(req.id)} />
          ))}
        </div>
      )}

      <SessionRequestDetail
        request={openRequest}
        slots={slots}
        onClose={() => setOpenRequestId(null)}
        onAccept={handleAccept}
        onDecline={handleDecline}
        onOfferNewTime={handleOfferNewTime}
        onResolveNeedsNewTime={handleResolveNeedsNewTime}
      />
    </div>
  );
}
