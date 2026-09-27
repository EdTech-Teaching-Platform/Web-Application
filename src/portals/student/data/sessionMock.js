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

// Student-facing scheduled classroom records. The route carries one of these
// IDs so the classroom page can show the class the learner selected.
export const LIVE_CLASS_SESSIONS = [
  {
    id: "l1",
    courseId: "c1",
    courseTitle: "Complete Python Bootcamp",
    educator: "Priya Sharma",
    classTitle: "Python — Loops & Functions",
    date: "September 20, 2026",
    time: "5:00 PM – 6:00 PM",
    duration: "60 minutes",
  },
  {
    id: "l3",
    courseId: "c3",
    courseTitle: "IELTS Speaking Mastery",
    educator: "Anaya Kapoor",
    classTitle: "IELTS — Speaking Practice",
    date: "September 22, 2026",
    time: "4:00 PM – 5:00 PM",
    duration: "60 minutes",
  },
  {
    id: "functions-practice-2026-09-26",
    courseId: "c1",
    courseTitle: "Complete Python Bootcamp",
    educator: "Priya Sharma",
    classTitle: "Python — Functions in practice",
    date: "September 26, 2026",
    time: "6:00 PM – 7:00 PM",
    duration: "60 minutes",
  },
];

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
    recordingId: "rec-5",
  },
  {
    id: "att-4",
    courseId: "c1",
    sessionId: "old-1",
    topic: "Python — Getting Started Q&A",
    educator: "Priya Sharma",
    date: "January 12, 2025",
    duration: "0 minutes",
    attended: false,
    percentage: 0,
    recordingId: "rec-3",
  },
];

export const RECORDINGS = [
  {
    id: "rec-1",
    courseId: "c1",
    sessionId: "l1",
    title: "Python — Loops & Functions",
    educator: "Priya Sharma",
    date: "September 12, 2026",
    duration: "58 minutes",
    status: "Available",
    access: "authorized",
  },
  {
    id: "rec-3",
    courseId: "c1",
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
    sessionId: "other-1",
    title: "IELTS Speaking Practice",
    educator: "Anaya Kapoor",
    date: "September 10, 2026",
    duration: "36 minutes",
    status: "Available",
    access: "unauthorized",
  },
  {
    id: "rec-5",
    courseId: "c1",
    sessionId: "l2",
    title: "Python — Debugging Clinic",
    educator: "Priya Sharma",
    date: "September 6, 2026",
    duration: "46 minutes",
    status: "Available",
    access: "authorized",
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
