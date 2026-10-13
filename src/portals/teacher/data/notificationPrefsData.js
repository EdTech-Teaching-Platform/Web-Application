// Mock data + defaults for the educator's own Notification Preferences
// screen. This controls what THIS educator receives — a separate concept
// from the student-facing "delivery respects each student's own channel
// preferences" note already shown in Announcements/Messaging, which is
// about the student's settings, not this one.

export const CHANNELS = [
  { key: "inApp", label: "In-App" },
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS/WhatsApp" },
  { key: "push", label: "Push" },
];

// `digest: true` on a category means it's eligible for the real-time vs
// digest choice; `critical: true` categories keep a soft warning when an
// educator tries to fully disable them (per the spec's "session starting
// soon" example) and are excluded from the digest choice, since a booking
// or live-class alert loses its purpose as a once-a-day summary.
export const CATEGORIES = [
  {
    key: "studentActivity",
    label: "Student Activity",
    description: "New enrollments, messages from students, and new reviews on your courses.",
    critical: false,
    digest: true,
    items: [
      { key: "newEnrollment", label: "New enrollment", defaults: { inApp: true, email: true, sms: false, push: false } },
      { key: "newMessage", label: "New message from a student", defaults: { inApp: true, email: true, sms: false, push: true } },
      { key: "newReview", label: "New course review", defaults: { inApp: true, email: false, sms: false, push: false } },
    ],
  },
  {
    key: "assessments",
    label: "Assessments & Grading",
    description: "Submissions ready to grade and resubmissions your students send back.",
    critical: false,
    digest: true,
    items: [
      { key: "newSubmission", label: "New submission ready to grade", defaults: { inApp: true, email: true, sms: false, push: false } },
      { key: "resubmission", label: "Resubmission received", defaults: { inApp: true, email: true, sms: false, push: false } },
    ],
  },
  {
    key: "bookings",
    label: "Bookings & Live Classes",
    description: "New bookings, reschedule/cancellation requests, and reminders before a session starts.",
    critical: true,
    digest: false,
    items: [
      { key: "newBooking", label: "New booking", defaults: { inApp: true, email: true, sms: false, push: true } },
      { key: "rescheduleCancel", label: "Reschedule or cancellation request", defaults: { inApp: true, email: true, sms: true, push: true } },
      { key: "sessionSoon", label: "Session starting soon", defaults: { inApp: true, email: false, sms: true, push: true } },
    ],
  },
  {
    key: "publishing",
    label: "Course & Publishing",
    description: "Course approvals, changes requested, and admin feedback on your courses.",
    critical: false,
    digest: true,
    items: [
      { key: "courseApproved", label: "Course approved", defaults: { inApp: true, email: true, sms: false, push: false } },
      { key: "changesRequested", label: "Changes requested", defaults: { inApp: true, email: true, sms: false, push: true } },
      { key: "adminFeedback", label: "Admin feedback on a course", defaults: { inApp: true, email: true, sms: false, push: false } },
    ],
  },
  {
    key: "earnings",
    label: "Earnings & Payouts",
    description: "Payout status changes and new earnings milestones you hit.",
    critical: false,
    digest: true,
    items: [
      { key: "payoutStatus", label: "Payout status changes", defaults: { inApp: true, email: true, sms: false, push: true } },
      { key: "earningsMilestone", label: "New earnings milestone", defaults: { inApp: true, email: false, sms: false, push: false } },
    ],
  },
  {
    key: "platform",
    label: "Platform Updates",
    description: "Announcements from Universal Learning itself, and policy changes.",
    critical: false,
    digest: true,
    items: [
      { key: "platformAnnouncement", label: "Platform announcements", defaults: { inApp: true, email: false, sms: false, push: false } },
      { key: "policyChange", label: "Policy changes", defaults: { inApp: true, email: true, sms: false, push: false } },
    ],
  },
];

export function buildRecommendedDefaults() {
  const prefs = {};
  CATEGORIES.forEach((cat) => {
    prefs[cat.key] = {};
    cat.items.forEach((item) => {
      prefs[cat.key][item.key] = { ...item.defaults };
    });
  });
  return prefs;
}

export function buildRecommendedDigest() {
  const digest = {};
  CATEGORIES.forEach((cat) => {
    if (cat.digest) digest[cat.key] = "realtime";
  });
  return digest;
}

export const RECOMMENDED_QUIET_HOURS = { enabled: true, start: "21:00", end: "07:00" };
