// Mentorship Hub — mock data + pure helpers. A structured, longer-term
// program layered on top of the platform's existing 1:1 booking
// (TeacherAvailabilityContext): applications
// and mentee data are seeded from the exact same real course/student
// records everything else reads from (never a separately hardcoded
// roster), and "sessions" are the exact same booking slots
// TeacherAvailabilityContext already holds, just tagged
// sessionTag:"mentorship" (see teacherAvailability.js's seeded
// jonasMentorshipSlot/sofiaMentorshipSlot* and the retagged Priya/Mei Lin
// bookings) rather than a parallel session log.
import { TODAY, daysAgo } from "./teacherCourses";
import { addDays, isoDate } from "./teacherAvailability";
import { buildRoster } from "./studentDirectory";

function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function isoToday() {
  return TODAY.toISOString().slice(0, 10);
}

function daysFromNow(n) {
  return isoDate(addDays(TODAY, n));
}

export const EDUCATOR_NAME = "Ansh Mehra";

// -- Program-level settings (Part 4) -------------------------------------
export const DEFAULT_APPLICATION_QUESTIONS = [
  { id: "q-goals", label: "What are your goals for this mentorship?", enabled: true, custom: false },
  { id: "q-focus", label: "Which areas would you like to focus on?", enabled: true, custom: false },
  { id: "q-cadence", label: "What cadence/commitment works for you?", enabled: true, custom: false },
  { id: "q-background", label: "Tell me a bit about your background", enabled: true, custom: false },
  { id: "q-timeline", label: "Do you have a target timeline or deadline?", enabled: false, custom: false },
];

export function defaultSettings() {
  return {
    pitch:
      "<p>I offer structured, 1:1 mentorship for students who want to go beyond the course material — a focused plan with real milestones, regular check-ins, and honest feedback along the way. Best suited for anyone preparing for a portfolio review, interview, or a specific skill leap.</p>",
    focusAreas: ["Design Systems", "Portfolio Development", "Interview Prep", "Color Theory", "Career Strategy"],
    questions: DEFAULT_APPLICATION_QUESTIONS,
    capacity: 6,
    waitlistWhenFull: true,
    defaultCadence: "Weekly",
    defaultDuration: "8 weeks",
  };
}

// -- Applications (Part 1) ------------------------------------------------
// A mix of a real enrolled student (Carlos Ibarra, c1) and a prospective
// applicant with no existing enrollment, so the Application Detail view's
// "existing relationship context" both fires and gracefully doesn't.
export function seedApplications(courses) {
  const c1 = (courses || []).find((c) => c.id === "c1");
  const carlos = c1?.students?.find((s) => s.name === "Carlos Ibarra");

  const applications = [];

  if (carlos) {
    applications.push({
      id: id("app"),
      studentId: carlos.id,
      studentName: carlos.name,
      courseId: c1.id,
      courseTitle: c1.title,
      status: "new",
      appliedAt: daysFromNow(-2),
      goals:
        "<p>I want to tighten up my design-system thinking before I start applying for senior roles — specifically getting faster at defending token and component decisions in a portfolio review. I've got about 6 weeks before I start interviewing seriously.</p>",
      focusAreas: ["Design Systems", "Portfolio Development"],
      cadence: "Weekly",
      proposedDuration: "6 weeks",
    });
  }

  applications.push({
    id: id("app"),
    studentId: null,
    studentName: "Zara Ahmed",
    courseId: null,
    courseTitle: null,
    status: "under_review",
    appliedAt: daysFromNow(-5),
    goals:
      "<p>I want to improve my problem-solving speed and build a small case-study portfolio around color and accessibility work over the next couple of months — I'm switching careers into product design and need something to show for it.</p>",
    focusAreas: ["Color Theory", "Portfolio Development"],
    cadence: "Bi-weekly",
    proposedDuration: "8 weeks",
  });

  return applications;
}

// -- Mentorships (Parts 2 & 3) --------------------------------------------
// Ids are stable strings (not randomized) so they line up with the
// sessionTag:"mentorship" bookings already seeded in teacherAvailability.js
// (ment-priya, ment-mei-lin, ment-jonas, ment-sofia) -- real slots, not a
// separate mocked session log.
export function seedMentorships(courses) {
  const c1 = (courses || []).find((c) => c.id === "c1");
  const c2 = (courses || []).find((c) => c.id === "c2");
  const byName = (course, name) => course?.students?.find((s) => s.name === name);

  const mentorships = [];

  const mei = byName(c1, "Mei Lin");
  if (mei) {
    mentorships.push({
      id: "ment-mei-lin",
      studentId: mei.id,
      studentName: mei.name,
      courseId: c1.id,
      courseTitle: c1.title,
      focusArea: "UI/UX Interview Prep",
      status: "active",
      cadence: "Weekly",
      duration: "8 weeks",
      startDate: daysFromNow(-49),
      goalsAtApplication:
        "<p>I'd like structured help preparing for design interviews — mock rounds, portfolio storytelling, and negotiation once an offer comes in. I'm aiming to start interviewing in about two months.</p>",
      milestones: [
        {
          id: id("ms"),
          title: "Portfolio audit & gap analysis",
          targetDate: daysFromNow(-47),
          description: "Walk through the full portfolio together and flag the 2-3 weakest case studies to rebuild first.",
          completedAt: daysFromNow(-46),
          reflection: "Mei's portfolio was strong on visuals but thin on process — we agreed to rebuild the case study narratives first.",
        },
        {
          id: id("ms"),
          title: "Mock interview #1 — behavioral",
          targetDate: daysFromNow(-35),
          description: "Practice framing past project decisions using a clear situation → action → impact structure.",
          completedAt: daysFromNow(-34),
          reflection: "Much more concise the second time through — worth one more behavioral pass before real interviews.",
        },
        {
          id: id("ms"),
          title: "Case study deep-dive: redesign a real product flow",
          targetDate: daysFromNow(-21),
          description: "Pick one real flow, redesign it end-to-end, and be ready to defend every major decision.",
          completedAt: daysFromNow(-19),
          reflection: "Chose a checkout flow redesign — the accessibility reasoning behind her contrast choices was genuinely interview-ready.",
        },
        {
          id: id("ms"),
          title: "Mock interview #2 — technical whiteboard",
          targetDate: daysFromNow(-7),
          description: "A live whiteboard exercise designing a feature from an ambiguous prompt, with think-aloud practice.",
          completedAt: daysFromNow(-6),
          reflection: "Handled the ambiguity well — next step is just polish and confidence going into the real thing.",
        },
        {
          id: id("ms"),
          title: "Salary negotiation & offer strategy",
          targetDate: daysFromNow(2),
          description: "Cover how to research a fair range, anchor first, and negotiate beyond base salary.",
          completedAt: null,
          reflection: "",
          current: true,
        },
        {
          id: id("ms"),
          title: "Final mock interview & wrap-up",
          targetDate: daysFromNow(9),
          description: "One last full-loop mock covering portfolio, behavioral, and a short technical round.",
          completedAt: null,
          reflection: "",
        },
      ],
      resources: [
        { id: id("res"), title: "Contrast & accessibility cheat sheet", description: "Reference sheet for the WCAG contrast reasoning we covered.", files: [{ id: id("f"), name: "wcag-contrast-cheatsheet.pdf", size: 210_000 }], sharedAt: daysFromNow(-33) },
      ],
      reflections: [
        { id: id("ref"), at: daysFromNow(-19), html: "<p>Really strong session — Mei's case study narrative finally has a clear through-line. She's ready to start scheduling real interviews soon.</p>" },
      ],
      menteeReflections: [
        { id: id("mref"), at: daysFromNow(-33), html: "<p>The behavioral mock helped a lot — I used to ramble and now I can get to the point in under two minutes. Feeling a lot more confident.</p>" },
      ],
      pausedReason: null,
      pausedAt: null,
      endedNote: null,
      completedAt: null,
      completionSummary: null,
      certificateIssued: false,
    });
  }

  const priya = byName(c1, "Priya Sharma");
  if (priya) {
    mentorships.push({
      id: "ment-priya",
      studentId: priya.id,
      studentName: priya.name,
      courseId: c1.id,
      courseTitle: c1.title,
      focusArea: "Portfolio Rebuild Sprint",
      status: "active",
      cadence: "Weekly",
      duration: "6 weeks",
      startDate: daysFromNow(-10),
      goalsAtApplication:
        "<p>My current portfolio doesn't reflect what I can actually do anymore. I want to rebuild it properly before I start applying anywhere — even if it means starting from a blank page.</p>",
      milestones: [
        {
          id: id("ms"),
          title: "Define target roles & audit existing portfolio",
          targetDate: daysFromNow(-3),
          description: "Settle on 1-2 target role types and get honest about what the current portfolio is missing for them.",
          completedAt: null,
          reflection: "",
        },
        {
          id: id("ms"),
          title: "Rebuild 2 case studies with process detail",
          targetDate: daysFromNow(11),
          description: "Rebuild the two strongest projects with real process — problem framing, iterations, and outcomes.",
          completedAt: null,
          reflection: "",
        },
        {
          id: id("ms"),
          title: "Get 3 rounds of peer feedback",
          targetDate: daysFromNow(25),
          description: "Share the rebuilt case studies with peers or a community for structured feedback before finalizing.",
          completedAt: null,
          reflection: "",
        },
        {
          id: id("ms"),
          title: "Final polish & launch new portfolio site",
          targetDate: daysFromNow(39),
          description: "Final visual polish, proofread, and publish the live site.",
          completedAt: null,
          reflection: "",
        },
      ],
      resources: [],
      reflections: [],
      menteeReflections: [],
      pausedReason: null,
      pausedAt: null,
      endedNote: null,
      completedAt: null,
      completionSummary: null,
      certificateIssued: false,
    });
  }

  const jonas = byName(c1, "Jonas Weber");
  if (jonas) {
    mentorships.push({
      id: "ment-jonas",
      studentId: jonas.id,
      studentName: jonas.name,
      courseId: c1.id,
      courseTitle: c1.title,
      focusArea: "Color Theory Mastery Track",
      status: "paused",
      cadence: "Bi-weekly",
      duration: "10 weeks",
      startDate: daysFromNow(-25),
      goalsAtApplication:
        "<p>Color is the part of design I understand the least intuitively. I'd like a structured track to actually build confidence with palette decisions instead of guessing.</p>",
      milestones: [
        {
          id: id("ms"),
          title: "Foundations refresher",
          targetDate: daysFromNow(-22),
          description: "Revisit hue/saturation/perceptual lightness fundamentals with applied exercises.",
          completedAt: daysFromNow(-21),
          reflection: "Solid grasp of the fundamentals already — moved faster through this than expected.",
        },
        {
          id: id("ms"),
          title: "Applied palette critique sessions",
          targetDate: daysFromNow(12),
          description: "Build and critique three real palettes across different product contexts.",
          completedAt: null,
          reflection: "",
          current: true,
        },
        {
          id: id("ms"),
          title: "Capstone: build a themeable color system",
          targetDate: daysFromNow(45),
          description: "Design a full light/dark themeable token system and document the reasoning behind it.",
          completedAt: null,
          reflection: "",
        },
      ],
      resources: [],
      reflections: [
        { id: id("ref"), at: daysFromNow(-18), html: "<p>Paused at Jonas's request — end of term coursework picked up. Palette critique work was going well before the pause; pick back up there when he's ready.</p>" },
      ],
      menteeReflections: [],
      pausedReason: "Requested a pause to focus on end-of-term coursework — plans to resume in a few weeks.",
      pausedAt: daysFromNow(-18),
      endedNote: null,
      completedAt: null,
      completionSummary: null,
      certificateIssued: false,
    });
  }

  const sofia = byName(c1, "Sofia Rossi") || byName(c2, "Sofia Rossi");
  const sofiaCourse = byName(c1, "Sofia Rossi") ? c1 : c2;
  if (sofia) {
    mentorships.push({
      id: "ment-sofia",
      studentId: sofia.id,
      studentName: sofia.name,
      courseId: sofiaCourse.id,
      courseTitle: sofiaCourse.title,
      focusArea: "Design Systems Career Track",
      status: "completed",
      cadence: "Weekly",
      duration: "8 weeks",
      startDate: daysFromNow(-58),
      goalsAtApplication:
        "<p>I can execute a design system when I'm handed one, but I've never had to architect one from scratch or defend those calls in an interview. I want that muscle before I start looking for a senior role.</p>",
      milestones: [
        {
          id: id("ms"),
          title: "Audit current design system knowledge",
          targetDate: daysFromNow(-55),
          description: "Map what Sofia already knows against what a senior-level interview would actually probe.",
          completedAt: daysFromNow(-54),
          reflection: "Strong execution skills already — the gap was entirely in articulating the 'why' behind decisions.",
        },
        {
          id: id("ms"),
          title: "Build a mini token-based component library",
          targetDate: daysFromNow(-40),
          description: "Design and document a small but real token-based component library from scratch.",
          completedAt: daysFromNow(-38),
          reflection: "Genuinely excellent documentation — better than a lot of production systems I've reviewed.",
        },
        {
          id: id("ms"),
          title: "Mock portfolio review with senior designer framing",
          targetDate: daysFromNow(-26),
          description: "Present the system as if to a senior hiring panel and defend every structural decision.",
          completedAt: daysFromNow(-25),
          reflection: "Much more confident defending trade-offs this round — no more hedging on the harder questions.",
        },
        {
          id: id("ms"),
          title: "Capstone presentation & career plan",
          targetDate: daysFromNow(-12),
          description: "Final capstone presentation plus a concrete plan for the next 3 months of job searching.",
          completedAt: daysFromNow(-12),
          reflection: "A genuinely portfolio-ready capstone. Wrapped with a clear target-role list and application timeline.",
        },
      ],
      resources: [
        { id: id("res"), title: "Design system architecture checklist", description: "The checklist we used to structure the capstone system.", files: [{ id: id("f"), name: "design-system-architecture-checklist.pdf", size: 260_000 }], sharedAt: daysFromNow(-40) },
      ],
      reflections: [
        { id: id("ref"), at: daysFromNow(-12), html: "<p>Sofia went from someone who could execute a design system to someone who can architect and defend one in an interview. The capstone presentation was genuinely portfolio-ready — proud of how far this came in eight weeks.</p>" },
      ],
      menteeReflections: [
        { id: id("mref"), at: daysFromNow(-13), html: "<p>This program completely changed how I think about design systems — I used to just follow the rules, now I understand why they exist. Feeling ready to talk about this confidently in interviews.</p>" },
      ],
      pausedReason: null,
      pausedAt: null,
      endedNote: null,
      completedAt: daysFromNow(-12),
      completionSummary:
        "Sofia went from someone who could execute a design system to someone who could architect and defend one in an interview. Her capstone presentation was genuinely portfolio-ready, and she left with a clear 3-month job search plan.",
      certificateIssued: true,
    });
  }

  return mentorships;
}

// -- Derived helpers --------------------------------------------------------
export function milestoneStatus(m) {
  if (m.completedAt) return "completed";
  if (m.targetDate < isoToday()) return "overdue";
  if (m.current) return "in_progress";
  return "upcoming";
}

export function currentMilestone(mentorship) {
  const inProgress = mentorship.milestones.find((m) => milestoneStatus(m) === "in_progress");
  if (inProgress) return inProgress;
  return mentorship.milestones.find((m) => milestoneStatus(m) === "overdue") || null;
}

export function mentorshipProgress(mentorship) {
  if (!mentorship.milestones.length) return 0;
  const done = mentorship.milestones.filter((m) => m.completedAt).length;
  return Math.round((done / mentorship.milestones.length) * 100);
}

export function nextCheckInLabel(mentorship, slots) {
  const upcoming = (slots || [])
    .filter((s) => s.bookings?.[0]?.mentorshipId === mentorship.id && s.status === "booked" && s.date >= isoToday())
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return upcoming[0] || null;
}

export function mentorshipSessions(mentorship, slots) {
  return (slots || [])
    .filter((s) => s.bookings?.[0]?.mentorshipId === mentorship.id)
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
}

export function mentorshipStats(mentorships) {
  const active = mentorships.filter((m) => m.status === "active");
  const paused = mentorships.filter((m) => m.status === "paused");
  const completed = mentorships.filter((m) => m.status === "completed");
  const forAverage = [...active, ...completed];
  const avgCompletion = forAverage.length
    ? Math.round(forAverage.reduce((sum, m) => sum + mentorshipProgress(m), 0) / forAverage.length)
    : 0;
  const milestonesDueThisWeek = active.reduce((count, m) => {
    return (
      count +
      m.milestones.filter((ms) => !ms.completedAt && ms.targetDate >= isoToday() && daysAgo(ms.targetDate) <= 0 && ms.targetDate <= daysFromNow(7)).length
    );
  }, 0);
  return {
    active: active.length,
    paused: paused.length,
    completed: completed.length,
    avgCompletion,
    milestonesDueThisWeek,
  };
}

// Upcoming milestones + check-ins across every active mentee, sorted
// chronologically -- the Dashboard's "what's coming up" panel.
export function upcomingItems(mentorships, slots) {
  const items = [];
  mentorships
    .filter((m) => m.status === "active")
    .forEach((m) => {
      m.milestones
        .filter((ms) => !ms.completedAt && ms.targetDate <= daysFromNow(14))
        .forEach((ms) => {
          items.push({ kind: "milestone", date: ms.targetDate, mentorshipId: m.id, studentName: m.studentName, title: ms.title, overdue: milestoneStatus(ms) === "overdue" });
        });
      mentorshipSessions(m, slots)
        .filter((s) => s.status === "booked" && s.date >= isoToday() && s.date <= daysFromNow(14))
        .forEach((s) => {
          items.push({ kind: "checkin", date: s.date, time: s.start, mentorshipId: m.id, studentName: m.studentName, title: s.sessionType });
        });
    });
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

// The same cross-course roster entry Student Management already builds,
// for an applicant/mentee who is a genuinely enrolled student -- course
// chips, progress and messaging all route to this one real record instead
// of a separately hardcoded summary.
export function relatedRosterEntry(studentName, courses) {
  if (!studentName) return null;
  const roster = buildRoster(courses);
  const key = studentName.trim().toLowerCase();
  return roster.find((r) => r.key === key) || null;
}

export const MENTORSHIP_DECLINE_REASONS = [
  "At capacity right now",
  "Not a fit for my focus areas",
  "Timeline doesn't work",
  "Needs more course progress first",
  "Other",
];

export const MENTORSHIP_INFO_REASONS = [
  "Clarify goals",
  "Share portfolio or work samples",
  "Confirm availability and cadence",
  "Explain timeline or deadline",
  "Other",
];
