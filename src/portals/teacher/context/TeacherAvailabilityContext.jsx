import { createContext, useContext, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  DEFAULT_SESSION_TYPES,
  INITIAL_SLOTS,
  generateSlots,
  findConflict,
  resolveBookingTarget,
  createAdHocSlot,
  historyEntry,
  newId,
  addDays,
  isoDate,
} from "../data/teacherAvailability";
import {
  INITIAL_LIVE_CLASS_SCHEDULES,
  INITIAL_LIVE_CLASS_SLOTS,
  materializeSchedule,
  newScheduleId,
} from "../data/liveClassScheduleData";
import { useTeacherCourses } from "./TeacherCoursesContext";

// TeacherAvailabilityContext — the single list of availability slots (open,
// booked, cancelled and rescheduled) behind the Availability calendar, its
// agenda view, its Upcoming Sessions panel, Scheduled Call Booking and
// Reschedule/Cancel Booking, so all of them always read the same state
// instead of each keeping their own snapshot.
const TeacherAvailabilityContext = createContext(null);

export function TeacherAvailabilityProvider() {
  const [slots, setSlots] = useState([...INITIAL_SLOTS, ...INITIAL_LIVE_CLASS_SLOTS]);
  const [sessionTypes, setSessionTypes] = useState(DEFAULT_SESSION_TYPES);
  const [liveClassSchedules, setLiveClassSchedules] = useState(INITIAL_LIVE_CLASS_SCHEDULES);
  // Live Classes (Sec 5.6/5.7 rework) reads real course enrollment to
  // build/refresh each occurrence's attendee roster — the same
  // TeacherCoursesContext record My Courses/Course Management read, never
  // a second enrollment source. TeacherAvailabilityProvider is always
  // mounted inside TeacherCoursesProvider's route tree (see routes.jsx),
  // so this is always available.
  const { courses } = useTeacherCourses();

  // Creates a new block of slots from the create/edit panel or a
  // bulk-setup tool. Returns { ok:false, conflict } without touching state
  // if any generated slot overlaps an existing open/booked one, so the
  // caller can show an inline conflict error instead of silently
  // double-booking a time range.
  function addBlock(params) {
    const { blockId, slots: candidate } = generateSlots(params);
    if (candidate.length === 0) return { ok: false, reason: "empty" };
    const conflict = findConflict(slots, candidate);
    if (conflict) return { ok: false, conflict };
    setSlots((prev) => [...prev, ...candidate]);
    return { ok: true, count: candidate.length, blockId };
  }

  // Edits a single slot occurrence (time/type/capacity) — not the whole
  // recurring series, so changing one Monday never silently reshapes every
  // other Monday it was generated alongside.
  function updateSlot(slotId, patch) {
    const current = slots.find((s) => s.id === slotId);
    if (!current) return { ok: false };
    const next = { ...current, ...patch };
    const conflict = findConflict(
      slots.filter((s) => s.id !== slotId),
      [next]
    );
    if (conflict) return { ok: false, conflict };
    setSlots((prev) => prev.map((s) => (s.id === slotId ? next : s)));
    return { ok: true };
  }

  function deleteSlot(slotId) {
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  }

  function cancelSlot(slotId) {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: "cancelled" } : s)));
  }

  // Copies every open/booked slot in [weekStart, weekStart+6] one week
  // forward as fresh OPEN slots (bookings never carry over — a copied slot
  // is a new invitation to book, not a duplicate of someone's session).
  // Slots that would conflict with something already on the target week
  // are skipped, and the count is reported back so the UI can say exactly
  // what happened rather than a blind "done".
  function copyWeekForward(weekStart) {
    const start = isoDate(weekStart);
    const end = isoDate(addDays(weekStart, 6));
    const sourceSlots = slots.filter((s) => s.date >= start && s.date <= end && s.status !== "cancelled");
    const candidates = sourceSlots.map((s) => ({
      ...s,
      id: `${s.id}-copy-${Date.now()}`,
      date: isoDate(addDays(new Date(s.date), 7)),
      status: "open",
      bookings: [],
      history: [],
      supersededBySlotId: null,
      supersededFromSlotId: null,
    }));
    const toAdd = [];
    let skipped = 0;
    candidates.forEach((c) => {
      const conflict = findConflict([...slots, ...toAdd], [c]);
      if (conflict) skipped += 1;
      else toAdd.push(c);
    });
    setSlots((prev) => [...prev, ...toAdd]);
    return { added: toAdd.length, skipped };
  }

  function addSessionType(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSessionTypes((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }

  // -- Scheduled Call Booking (educator-initiated) ------------------------
  // Books a specific student into a time the educator picks. If that time
  // exactly matches one of the educator's own open slots, the booking
  // fills it in place (so it shows up on the calendar exactly like a
  // student self-booking would); otherwise, so long as it doesn't overlap
  // anything already active, a fresh ad-hoc slot is created for it and the
  // caller is told so it can show the "outside published availability"
  // notice rather than pretending this was always on the calendar.
  function scheduleCall({ studentName, courseId, courseTitle, sessionType, date, startTime, endTime, note, ...extra }) {
    const { exactOpenSlot, conflict } = resolveBookingTarget(slots, { date, start: startTime, end: endTime });
    if (conflict) return { ok: false, conflict };

    // `...extra` carries an optional context tag (e.g. { sessionTag:
    // "mentorship", mentorshipId }) straight onto the booking record, so a
    // caller like the Mentorship Hub can reuse this exact same scheduling
    // flow and still have the resulting session read as tagged wherever
    // bookings are listed, instead of forking a parallel booking system.
    const bookingEntry = { id: newId("bk"), studentName, courseId, courseTitle, note: note || "", createdBy: "educator", ...extra };
    const history = [historyEntry("created", { to: { date, start: startTime, end: endTime }, actor: "educator" })];

    if (exactOpenSlot) {
      const filled = { ...exactOpenSlot, sessionType, status: "booked", bookings: [bookingEntry], history };
      setSlots((prev) => prev.map((s) => (s.id === exactOpenSlot.id ? filled : s)));
      return { ok: true, slot: filled, isAdHoc: false };
    }

    const created = createAdHocSlot({ date, start: startTime, end: endTime, sessionType, bookingEntry, history });
    setSlots((prev) => [...prev, created]);
    return { ok: true, slot: created, isAdHoc: true };
  }

  // -- Reschedule (educator side) ------------------------------------------
  // Moves an existing booking to a new time. The original slot is never
  // deleted — it's marked "rescheduled" and kept (muted) in the agenda for
  // a transparent record, while the booking itself carries over untouched
  // (same bookingId/payment/entitlement) into either an existing open slot
  // at the new time or a brand-new ad-hoc one.
  function rescheduleBooking(slotId, { date, start, end, reasonTag, reason }) {
    const current = slots.find((s) => s.id === slotId);
    if (!current || current.status !== "booked") return { ok: false };
    const { exactOpenSlot, conflict } = resolveBookingTarget(slots, { date, start, end }, slotId);
    if (conflict) return { ok: false, conflict };

    const histEntry = historyEntry("rescheduled", {
      from: { date: current.date, start: current.start, end: current.end },
      to: { date, start, end },
      reasonTag,
      reason: reason || "",
      actor: "educator",
    });
    const sharedHistory = [...(current.history || []), histEntry];
    const updatedOld = { ...current, status: "rescheduled", history: sharedHistory };

    if (exactOpenSlot) {
      const merged = {
        ...exactOpenSlot,
        sessionType: current.sessionType,
        status: "booked",
        bookings: current.bookings,
        origin: "availability",
        history: sharedHistory,
        supersededFromSlotId: current.id,
        supersededBySlotId: null,
      };
      updatedOld.supersededBySlotId = merged.id;
      setSlots((prev) => prev.map((s) => (s.id === slotId ? updatedOld : s.id === exactOpenSlot.id ? merged : s)));
      return { ok: true, slot: merged };
    }

    const newSlot = {
      ...current,
      id: newId("slot"),
      blockId: newId("block"),
      date,
      start,
      end,
      status: "booked",
      origin: "adhoc",
      history: sharedHistory,
      supersededFromSlotId: current.id,
      supersededBySlotId: null,
      recurrence: null,
    };
    updatedOld.supersededBySlotId = newSlot.id;
    setSlots((prev) => [...prev.map((s) => (s.id === slotId ? updatedOld : s)), newSlot]);
    return { ok: true, slot: newSlot };
  }

  // -- Cancel (educator side) -----------------------------------------------
  // scope "single" cancels just this occurrence; scope "series" also
  // cancels every future booked occurrence in the same recurring block for
  // the same student. A slot that came from published availability gets a
  // fresh open sibling at the same time (the slot is still bookable — only
  // this booking was called off); an ad-hoc slot has no availability to
  // revert to, so nothing reopens there.
  function cancelBooking(slotId, { reasonTag, reason, scope = "single" }) {
    const current = slots.find((s) => s.id === slotId);
    if (!current || current.status !== "booked") return { ok: false };
    const studentKey = current.bookings?.[0]?.studentName;
    const targets =
      scope === "series"
        ? slots.filter(
            (s) =>
              s.id === slotId ||
              (s.blockId === current.blockId && s.date > current.date && s.status === "booked" && s.bookings?.[0]?.studentName === studentKey)
          )
        : [current];
    const targetIds = new Set(targets.map((t) => t.id));
    const extras = [];
    const updated = slots.map((s) => {
      if (!targetIds.has(s.id)) return s;
      const hist = [
        ...(s.history || []),
        historyEntry("cancelled", { reasonTag, reason: reason || "", actor: "educator", from: { date: s.date, start: s.start, end: s.end } }),
      ];
      if (s.origin === "availability") {
        extras.push({
          ...s,
          id: newId("slot"),
          status: "open",
          bookings: [],
          history: [],
          supersededBySlotId: null,
          supersededFromSlotId: null,
        });
      }
      return { ...s, status: "cancelled", history: hist };
    });
    setSlots([...updated, ...extras]);
    return { ok: true, count: targets.length };
  }

  // How many FUTURE booked occurrences (same recurring block, same
  // student) would also be cancelled by choosing "this and all future
  // sessions" — used to decide whether the Cancel modal even offers that
  // choice, and to show the educator exactly what they're about to affect.
  function getSeriesFutureCount(slotId) {
    const current = slots.find((s) => s.id === slotId);
    if (!current || !current.blockId) return 0;
    const studentKey = current.bookings?.[0]?.studentName;
    return slots.filter(
      (s) => s.blockId === current.blockId && s.date > current.date && s.status === "booked" && s.bookings?.[0]?.studentName === studentKey
    ).length;
  }

  // -- Live Class Schedules (per-course recurring/one-off) ------------------
  // These are the educator-authored RULE records behind the Live Classes
  // landing page's "Schedule Live Class"/"Manage Schedule" flows — see
  // liveClassScheduleData.js's architecture note for why creating/editing
  // one immediately materializes real occurrence slots into the exact same
  // `slots` array everything else here reads, rather than a second store.
  function courseStudents(courseId) {
    return courses.find((c) => c.id === courseId)?.students || [];
  }

  function createLiveClassSchedule(config) {
    const schedule = {
      id: newScheduleId(),
      status: "active",
      createdAt: new Date().toISOString(),
      ...config,
    };
    const { created, skipped } = materializeSchedule(schedule, courseStudents(schedule.courseId), slots);
    setLiveClassSchedules((prev) => [...prev, schedule]);
    setSlots((prev) => [...prev, ...created]);
    return { ok: true, schedule, occurrencesCreated: created.length, skipped };
  }

  // Edits the whole series: cancels every not-yet-happened occurrence this
  // schedule previously materialized, then re-materializes fresh upcoming
  // occurrences from the updated rule — "this and all future sessions",
  // the same scope Cancel Booking's series option already means elsewhere.
  // A single already-happened/cancelled occurrence is never touched.
  function updateLiveClassSchedule(scheduleId, patch) {
    const current = liveClassSchedules.find((s) => s.id === scheduleId);
    if (!current) return { ok: false };
    const updated = { ...current, ...patch };
    const todayIso = isoDate(TODAY_REF());
    setSlots((prev) => {
      const withoutFuture = prev.map((s) =>
        s.blockId === scheduleId && s.status === "booked" && s.date >= todayIso
          ? { ...s, status: "cancelled", history: [...(s.history || []), historyEntry("cancelled", { reasonTag: "Schedule updated", actor: "educator", from: { date: s.date, start: s.start, end: s.end } })] }
          : s
      );
      const { created } = materializeSchedule(updated, courseStudents(updated.courseId), withoutFuture);
      return [...withoutFuture, ...created];
    });
    setLiveClassSchedules((prev) => prev.map((s) => (s.id === scheduleId ? updated : s)));
    return { ok: true, schedule: updated };
  }

  function setLiveClassScheduleStatus(scheduleId, status) {
    setLiveClassSchedules((prev) => prev.map((s) => (s.id === scheduleId ? { ...s, status } : s)));
    // Ending the series (not just pausing it) also calls off every future
    // occurrence already on the calendar — pausing leaves what's already
    // materialized untouched, since those sessions were already promised.
    if (status === "ended") {
      const todayIso = isoDate(TODAY_REF());
      setSlots((prev) =>
        prev.map((s) =>
          s.blockId === scheduleId && s.status === "booked" && s.date >= todayIso
            ? { ...s, status: "cancelled", history: [...(s.history || []), historyEntry("cancelled", { reasonTag: "Recurring schedule ended", actor: "educator", from: { date: s.date, start: s.start, end: s.end } })] }
            : s
        )
      );
    }
  }

  // Edits just one occurrence's time/title without touching the series or
  // any other occurrence — mirrors Reschedule's single-occurrence scope.
  function updateLiveClassOccurrence(slotId, { date, start, end, title, meeting } = {}) {
    const current = slots.find((s) => s.id === slotId);
    if (!current) return { ok: false };
    const patch = {};
    if (date) patch.date = date;
    if (start) patch.start = start;
    if (end) patch.end = end;
    const next = { ...current, ...patch };
    if (title !== undefined && next.liveClass) next.liveClass = { ...next.liveClass, title };
    if (meeting !== undefined && next.liveClass) next.liveClass = { ...next.liveClass, meeting };
    if (date || start || end) {
      const conflict = findConflict(
        slots.filter((s) => s.id !== slotId),
        [next]
      );
      if (conflict) return { ok: false, conflict };
    }
    setSlots((prev) => prev.map((s) => (s.id === slotId ? next : s)));
    return { ok: true, slot: next };
  }

  function TODAY_REF() {
    return new Date();
  }

  // -- Scheduled Live Class -------------------------------------------------
  // Turns an existing confirmed booking into an actual joinable live
  // session — never a disconnected record. Attaches a `liveClass` object
  // to that same slot (single source of truth: the calendar, agenda and
  // Upcoming Sessions panel all read the booking they already show, now
  // with a "Live Class Scheduled" badge and a primed Join action), rather
  // than storing sessions in a separate list this booking could drift
  // out of sync with.
  function scheduleLiveClass(slotId, config) {
    const current = slots.find((s) => s.id === slotId);
    if (!current || current.status !== "booked") return { ok: false };
    const liveClass = {
      id: newId("live"),
      status: "scheduled", // scheduled -> live -> completed
      createdAt: new Date().toISOString(),
      ...config,
    };
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, liveClass } : s)));
    return { ok: true, liveClass };
  }

  const value = useMemo(
    () => ({
      slots,
      sessionTypes,
      addBlock,
      updateSlot,
      deleteSlot,
      cancelSlot,
      copyWeekForward,
      addSessionType,
      scheduleCall,
      rescheduleBooking,
      cancelBooking,
      getSeriesFutureCount,
      scheduleLiveClass,
      liveClassSchedules,
      createLiveClassSchedule,
      updateLiveClassSchedule,
      setLiveClassScheduleStatus,
      updateLiveClassOccurrence,
    }),
    [slots, sessionTypes, liveClassSchedules, courses]
  );

  return (
    <TeacherAvailabilityContext.Provider value={value}>
      <Outlet />
    </TeacherAvailabilityContext.Provider>
  );
}

export function useTeacherAvailability() {
  const ctx = useContext(TeacherAvailabilityContext);
  if (!ctx) throw new Error("useTeacherAvailability must be used within TeacherAvailabilityProvider");
  return ctx;
}
