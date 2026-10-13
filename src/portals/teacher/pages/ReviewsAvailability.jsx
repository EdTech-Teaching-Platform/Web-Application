// Educator Availability Calendar
// Jira: Day 8 — Reviews (read) + availability calendar
// Doc reference: Sec 5.4, 5.6
//
// This screen used to combine Reviews + Availability as two tabs. Reviews
// now lives on its own (see pages/Reviews.jsx), reached from the Average
// Rating stat card on the Dashboard, so this page is just the scheduling
// workspace for open 1:1/group session slots.
import AvailabilityCalendarSection from "../components/AvailabilityCalendarSection";

export default function ReviewsAvailability() {
  return (
    <div className="pb-16">
      <div className="mb-1">
        <div className="eyebrow mb-1.5">Scheduling</div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Availability</h1>
        <p className="mt-1 text-sm text-muted">Manage the time slots students can book with you.</p>
      </div>

      <div className="mt-6">
        <AvailabilityCalendarSection />
      </div>
    </div>
  );
}
