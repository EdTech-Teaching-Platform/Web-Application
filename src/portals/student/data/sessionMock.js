export const SESSION = {
  educator: "Priya Sharma",
  topic: "Python Mentoring",
  classTitle: "Python — Loops & Functions",
  date: "September 20, 2026",
  shortDate: "Sep 20",
  time: "5:00 PM – 6:00 PM",
  duration: "60 minutes",
  price: 500,
  type: "1:1 live video session",
  policy: "Free cancellation up to 24 hours before the session. Late cancellations may be partially refundable.",
};

export const AVAILABLE_SLOTS = [
  { id: "sep-20-5", date: "September 20, 2026", day: "20", label: "Sun", time: "5:00 PM – 6:00 PM", status: "available" },
  { id: "sep-21-6", date: "September 21, 2026", day: "21", label: "Mon", time: "6:00 PM – 7:00 PM", status: "available" },
  { id: "sep-22-5", date: "September 22, 2026", day: "22", label: "Tue", time: "5:00 PM – 6:00 PM", status: "available" },
  { id: "sep-23-4", date: "September 23, 2026", day: "23", label: "Wed", time: "4:00 PM – 5:00 PM", status: "booked" },
  { id: "sep-24-5", date: "September 24, 2026", day: "24", label: "Thu", time: "5:00 PM – 6:00 PM", status: "unavailable" },
  { id: "sep-25-6", date: "September 25, 2026", day: "25", label: "Fri", time: "6:00 PM – 7:00 PM", status: "past" },
];

export const BOOKING_KEY = "universal-learning-booking";
export const RATING_KEY = "universal-learning-session-ratings";

export const ATTENDANCE_SESSIONS = [
  {
    id: "att-1",
    courseId: "c1",
    sessionId: "l1",
    topic: "Python — Loops & Functions",
    educator: "Priya Sharma",
    date: "September 12, 2026",
    duration: "58 minutes",
    attended: true,
    percentage: 100,
    recordingId: "rec-1",
  },
  {
    id: "att-2",
    courseId: "c1",
    sessionId: "l2",
    topic: "Python — Debugging Clinic",
    educator: "Priya Sharma",
    date: "September 6, 2026",
    duration: "0 minutes",
    attended: false,
    percentage: 0,
    recordingId: null,
  },
  {
    id: "att-3",
    courseId: "c2",
    sessionId: "m2",
    topic: "Algebra — Quadratics",
    educator: "Rohan Mehta",
    date: "August 28, 2026",
    duration: "44 minutes",
    attended: true,
    percentage: 82,
    recordingId: "rec-2",
  },
];

export const RECORDINGS = [
  {
    id: "rec-1",
    courseId: "c1",
    lessonId: "l10",
    sessionId: "l1",
    title: "Python — Loops & Functions",
    educator: "Priya Sharma",
    date: "September 12, 2026",
    duration: "58 minutes",
    status: "Available",
    access: "authorized",
  },
  {
    id: "rec-2",
    courseId: "c2",
    lessonId: "l10",
    sessionId: "m2",
    title: "Algebra — Quadratics",
    educator: "Rohan Mehta",
    date: "August 28, 2026",
    duration: "44 minutes",
    status: "Processing",
    access: "authorized",
  },
  {
    id: "rec-3",
    courseId: "c1",
    lessonId: "l10",
    sessionId: "old-1",
    title: "Python — Getting Started Q&A",
    educator: "Priya Sharma",
    date: "January 12, 2025",
    duration: "51 minutes",
    status: "Expired",
    access: "expired",
  },
  {
    id: "rec-4",
    courseId: "c3",
    lessonId: "l10",
    sessionId: "other-1",
    title: "IELTS Speaking Practice",
    educator: "Anaya Kapoor",
    date: "September 10, 2026",
    duration: "36 minutes",
    status: "Available",
    access: "unauthorized",
  },
];

export function getStoredBooking() {
  try {
    return JSON.parse(window.sessionStorage.getItem(BOOKING_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveBooking(booking) {
  window.sessionStorage.setItem(BOOKING_KEY, JSON.stringify(booking));
}

export function getStoredRatings() {
  try {
    return JSON.parse(window.localStorage.getItem(RATING_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveRating(rating) {
  const ratings = getStoredRatings();
  window.localStorage.setItem(RATING_KEY, JSON.stringify({ ...ratings, [rating.sessionId]: rating }));
}
