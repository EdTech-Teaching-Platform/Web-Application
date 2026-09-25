import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import BackButton from "../../../components/common/BackButton";
import Chip from "../../../components/ui/Chip";
import { CheckIcon, ClockIcon } from "../../../components/ui/icons";
import { AVAILABLE_SLOTS, SESSION, saveBooking } from "../data/sessionMock";

const calendarDays = [
  { day: "20", label: "Sun", status: "available" },
  { day: "21", label: "Mon", status: "available" },
  { day: "22", label: "Tue", status: "available" },
  { day: "23", label: "Wed", status: "booked" },
  { day: "24", label: "Thu", status: "unavailable" },
  { day: "25", label: "Fri", status: "past" },
];

export default function BookSession() {
  const navigate = useNavigate();
  const [view, setView] = useState("month");
  const [selected, setSelected] = useState(AVAILABLE_SLOTS[0]);
  const [step, setStep] = useState("availability");
  const [seconds, setSeconds] = useState(272);
  const [expired, setExpired] = useState(false);
  const [waitlisted, setWaitlisted] = useState(false);

  useEffect(() => {
    if (step !== "hold") return undefined;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          setExpired(true);
          setStep("availability");
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  const selectedDate = useMemo(() => selected?.date || SESSION.date, [selected]);
  const formattedTime = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  function beginPayment() {
    setSeconds(272);
    setExpired(false);
    setStep("hold");
  }

  function confirmPayment() {
    saveBooking({ ...SESSION, date: selectedDate, time: selected.time, status: "Confirmed" });
    setStep("confirmed");
  }

  function addToCalendar() {
    const start = new Date(`${selectedDate} ${selected.time.split(" – ")[0]}`);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const formatCalendarDate = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const event = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${SESSION.topic}\nDTSTART:${formatCalendarDate(start)}\nDTEND:${formatCalendarDate(end)}\nDESCRIPTION:Session with ${SESSION.educator}\nEND:VEVENT\nEND:VCALENDAR`;
    const link = document.createElement("a");
    link.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(event)}`;
    link.download = "universal-learning-session.ics";
    link.click();
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10">
      <BackButton fallback="/student/explore" className="mb-5" />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Live learning</p>
          <h1 className="font-display text-3xl font-bold text-text">Book a session</h1>
          <p className="mt-2 max-w-2xl text-sm text-text/60">Choose an educator's available slot. Availability is read-only and shown in your local timezone.</p>
        </div>
        <Button fullWidth={false} variant="secondary" onClick={() => navigate("/student/managebooking")}>My bookings</Button>
      </div>

      {expired && <div className="mb-5 rounded-2xl bg-warning/15 px-4 py-3 text-sm text-warning">Your payment hold expired, so the slot was released. Select another available slot to continue.</div>}
      {waitlisted && <div className="mb-5 rounded-2xl bg-success/15 px-4 py-3 text-sm text-success">You're #3 on the waitlist. We'll notify you when a slot becomes available.</div>}

      {step === "availability" && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <section className="rounded-2xl bg-white p-5 sm:p-7">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-text">{SESSION.educator}'s availability</h2>
                <p className="mt-1 text-sm text-text/55">Times shown in IST (UTC +5:30)</p>
              </div>
              <div className="flex gap-2">
                <Chip active={view === "month"} onClick={() => setView("month")}>Month</Chip>
                <Chip active={view === "week"} onClick={() => setView("week")}>Week</Chip>
              </div>
            </div>
            <div className="mb-5 flex flex-wrap gap-3 text-xs text-text/60">
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-success" />Available</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-text/25" />Booked</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-danger" />Unavailable</span>
              <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-text/10" />Past</span>
            </div>
            <div className="mb-5 flex items-center justify-between">
              <button type="button" className="rounded-full px-3 py-2 text-text/50 hover:bg-text/5" aria-label="Previous month">←</button>
              <h3 className="font-display font-semibold text-text">September 2026</h3>
              <button type="button" className="rounded-full px-3 py-2 text-text/50 hover:bg-text/5" aria-label="Next month">→</button>
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-text/45">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day} className="py-2">{day}</span>)}
              {[...Array(2)].map((_, index) => <span key={`empty-${index}`} />)}
              {calendarDays.map((day) => (
                <button
                  type="button"
                  key={day.day}
                  disabled={day.status !== "available"}
                  onClick={() => setSelected(AVAILABLE_SLOTS.find((slot) => slot.day === day.day))}
                  className={`min-h-20 rounded-2xl p-2 text-left transition-transform duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed ${
                    day.status === "available" ? "bg-success/10 text-success" : day.status === "booked" ? "bg-text/10 text-text/40" : day.status === "unavailable" ? "bg-danger/10 text-danger/60" : "bg-text/5 text-text/30"
                  } ${selected?.day === day.day ? "ring-2 ring-primary" : ""}`}
                >
                  <span className="font-semibold">{day.day}</span>
                  <span className="mt-2 block text-[11px]">{day.status === "available" ? "Available" : day.status === "booked" ? "Booked" : day.status === "past" ? "Past" : "Unavailable"}</span>
                </button>
              ))}
            </div>
          </section>
          <aside className="space-y-5">
            <div className="rounded-2xl bg-rotation-1 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/60">Available sessions</p>
              <h2 className="mt-3 font-display text-2xl font-bold text-text">{selected?.date || "Select a date"}</h2>
              <div className="mt-5 rounded-2xl bg-white/70 p-4">
                <p className="font-semibold text-text">{selected?.time || "No available slots"}</p>
                <p className="mt-1 text-sm text-text/65">{SESSION.topic}</p>
                <p className="mt-3 font-display text-xl font-bold text-text">₹{SESSION.price}</p>
                <Button fullWidth={false} className="mt-4" disabled={!selected} onClick={() => setStep("review")}>Select slot</Button>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Need another time?</p>
              <p className="mt-2 text-sm text-text/60">No available slots that work? Join the waitlist and we'll notify you when one opens.</p>
              <Button fullWidth={false} variant="secondary" className="mt-4" onClick={() => setWaitlisted(true)}>Join waitlist</Button>
            </div>
          </aside>
        </div>
      )}

      {step === "review" && (
        <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 sm:p-8">
          <button type="button" className="mb-6 text-sm font-medium text-primary" onClick={() => setStep("availability")}>← Back to availability</button>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Booking summary</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-text">{SESSION.topic}</h2>
          <div className="mt-6 divide-y divide-text/10">
            {[
              ["Educator", SESSION.educator],
              ["Date", selectedDate],
              ["Time", selected.time],
              ["Duration", SESSION.duration],
              ["Session type", SESSION.type],
            ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-sm"><span className="text-text/55">{label}</span><span className="text-right font-medium text-text">{value}</span></div>)}
          </div>
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-primary/5 p-4"><span className="font-medium text-text">Session fee</span><strong className="font-display text-2xl text-text">₹{SESSION.price}</strong></div>
          <p className="mt-5 text-sm text-text/60"><strong className="text-text">Cancellation policy:</strong> {SESSION.policy}</p>
          <Button className="mt-6" onClick={beginPayment}>Proceed to payment</Button>
        </div>
      )}

      {step === "hold" && (
        <div className="mx-auto max-w-xl rounded-2xl bg-primary p-8 text-center text-white sm:p-12">
          <ClockIcon className="mx-auto text-white/80" />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Payment in progress</p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white">Holding your slot</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/75">Your selected slot is temporarily reserved while payment is being completed. It is not confirmed yet.</p>
          <div className="my-8 font-display text-5xl font-bold text-white">{formattedTime} <span className="text-base font-normal text-white/65">remaining</span></div>
          <Button variant="inverse" onClick={confirmPayment}>Continue payment</Button>
          <button type="button" className="mt-4 text-sm text-white/70 hover:text-white" onClick={() => setStep("availability")}>Cancel payment</button>
        </div>
      )}

      {step === "confirmed" && (
        <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center sm:p-12">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success"><CheckIcon /></span>
          <h2 className="mt-5 font-display text-3xl font-bold text-text">Booking confirmed</h2>
          <p className="mt-2 text-text/60">{SESSION.topic}</p>
          <div className="my-7 space-y-2 text-sm text-text/70"><p className="font-semibold text-text">{SESSION.educator}</p><p>{selectedDate}</p><p>{selected.time}</p><p className="pt-3 font-display text-xl font-bold text-text">₹{SESSION.price} Paid</p></div>
          <div className="flex flex-col gap-3 sm:flex-row"><Button variant="secondary" onClick={addToCalendar}>Add to calendar</Button><Button variant="secondary" onClick={() => navigate("/student/managebooking")}>View booking</Button><Button onClick={() => navigate("/student/liveclassjoin?session=booked")}>Join session</Button></div>
        </div>
      )}

    </div>
  );
}
