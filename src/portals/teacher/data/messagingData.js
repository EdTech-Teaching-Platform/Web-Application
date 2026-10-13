// Mock data + pure helpers for the Announcements hub: one-to-many group
// messaging (Compose / Sent / Scheduled / Drafts / Templates / Groups)
// plus course-scoped Announcements and the Share Notes Link log. Students
// never reply in-app, so there are no conversations here -- every record is
// a broadcast with an audience, never a thread. Audiences resolve against
// the SAME student roster Student Management builds (studentDirectory's
// buildRoster over TeacherCoursesContext's courses), never a separate
// hardcoded list.
import { TODAY } from "./teacherCourses";
import { buildRoster } from "./studentDirectory";

export const EDUCATOR_NAME = "Ansh Mehra";

// Very large audiences need an explicit confirmation before sending.
export const LARGE_AUDIENCE = 100;
export const SUBJECT_MAX = 80;
export const BODY_MAX = 2000;
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt"];

function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function initials(name) {
  return (name || "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

export function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// -- Mock clock ----------------------------------------------------------
// TODAY is fixed (2026-09-20); this clock starts there and ticks forward
// with real time so countdowns and "Saved just now" behave naturally.
const CLOCK_START = Date.now();
export function nowMs() {
  return TODAY.getTime() + (Date.now() - CLOCK_START);
}
export function nowIso() {
  return new Date(nowMs()).toISOString();
}
function isoMinutesFromNow(n) {
  return new Date(nowMs() + n * 60000).toISOString();
}

export function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function relativeTime(iso) {
  const diff = nowMs() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return formatDateTime(iso);
}

export function countdownLabel(iso) {
  const diff = new Date(iso).getTime() - nowMs();
  if (diff <= 0) return "Sending now";
  const mins = Math.floor(diff / 60000);
  const days = Math.floor(mins / 1440);
  const hrs = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `in ${days}d ${hrs}h`;
  if (hrs > 0) return `in ${hrs}h ${m}m`;
  return `in ${Math.max(1, m)} min`;
}

export function timezoneLabel() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time";
  } catch {
    return "your local time";
  }
}

// -- Static option lists -------------------------------------------------
export const MESSAGE_TYPES = [
  { key: "announcement", label: "Announcement", tone: "blue" },
  { key: "reminder", label: "Reminder", tone: "orange" },
  { key: "assignment-due", label: "Assignment due", tone: "pink" },
  { key: "live-class", label: "Live class alert", tone: "lavender" },
  { key: "test-series", label: "Test series update", tone: "sage" },
  { key: "congrats", label: "Congratulations", tone: "maroon" },
  { key: "custom", label: "Custom", tone: "blue" },
];

export function typeMeta(key) {
  return MESSAGE_TYPES.find((t) => t.key === key) || MESSAGE_TYPES[MESSAGE_TYPES.length - 1];
}

export const MERGE_TAGS = [
  { key: "first_name", label: "First name" },
  { key: "course_name", label: "Course name" },
  { key: "next_class", label: "Next class" },
  { key: "due_date", label: "Due date" },
  { key: "progress_percent", label: "Progress %" },
  { key: "test_series_name", label: "Test series" },
];

export const CHANNELS = [
  { key: "inApp", label: "In-app", reach: 1, locked: true, hint: "Always on. Shown in every student's portal." },
  { key: "email", label: "Email", reach: 0.98, hint: "Sent to each student's account email." },
  { key: "push", label: "Push", reach: 0.82, hint: "Only students with the app installed." },
  { key: "sms", label: "SMS", reach: 0.64, hint: "Only students with a verified phone number." },
];

export const PRIORITIES = ["Normal", "Important"];

export const SEGMENTS = [
  { key: "at-risk", label: "At-risk", test: (s) => s.atRisk },
  { key: "top", label: "Top performers", test: (s) => s.progress >= 80 },
  { key: "inactive", label: "Inactive 7+ days", test: (s) => s.lastActiveDaysAgo >= 7 },
  { key: "new", label: "New this week", test: (s) => s.enrolledDaysAgo <= 7 },
  { key: "pending", label: "Pending submissions", test: (s) => s.pendingSubmission },
];

export const SMART_RULES = [
  { key: "progress-below-40", label: "Progress below 40%", test: (s) => s.progress < 40 },
  { key: "not-logged-in-7", label: "Not logged in 7 days", test: (s) => s.lastActiveDaysAgo >= 7 },
  { key: "progress-above-80", label: "Progress above 80%", test: (s) => s.progress >= 80 },
  { key: "pending-submission", label: "Has a pending submission", test: (s) => s.pendingSubmission },
  { key: "multi-course", label: "Enrolled in 2+ courses", test: (s) => s.courseIds.length >= 2 },
];

export const MENTORSHIP_AUDIENCES = [
  { key: "active", label: "Active mentees" },
  { key: "paused", label: "Paused mentees" },
  { key: "completed", label: "Completed mentees" },
];

export const GROUP_TONES = ["blue", "sage", "lavender", "orange", "pink", "maroon"];

// -- Student pool ----------------------------------------------------------
// One record per unique student, built from the shared roster.
export function buildStudentPool(courses) {
  const roster = buildRoster(courses);
  const pendingByName = new Set();
  (courses || []).forEach((c) => {
    (c.submissions || []).forEach((s) => {
      if (s.status === "pending") pendingByName.add((s.studentName || "").trim().toLowerCase());
    });
  });
  return roster.map((entry) => {
    const primary = entry.enrollments.reduce((best, e) => (e.lastActive > best.lastActive ? e : best), entry.enrollments[0]);
    return {
      id: entry.key,
      name: entry.name,
      firstName: entry.name.split(" ")[0],
      courseIds: entry.enrollments.map((e) => e.courseId),
      courseTitles: entry.enrollments.map((e) => e.courseTitle),
      primaryCourseTitle: primary.courseTitle,
      enrollmentIds: entry.enrollments.map((e) => e.studentId),
      enrollments: entry.enrollments,
      progress: entry.overallProgress,
      lastActiveDaysAgo: entry.lastActiveDaysAgo,
      enrolledDaysAgo: entry.enrolledDaysAgo,
      atRisk: entry.atRisk,
      pendingSubmission: pendingByName.has(entry.key),
    };
  });
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// Test series enrolment isn't tracked per student in this mock build, so
// each published series gets a stable, deterministic slice of the roster.
export function buildSeriesEnrolments(seriesList, pool) {
  const out = {};
  (seriesList || []).forEach((s) => {
    out[s.id] = pool.filter((p) => hashStr(`${s.id}:${p.id}`) % 3 !== 0).map((p) => p.id);
  });
  return out;
}

export function buildCohorts(pool, courses) {
  const map = new Map();
  pool.forEach((p) => {
    p.enrollments.forEach((e) => {
      const ym = (e.enrolledAt || "").slice(0, 7);
      if (!ym) return;
      const key = `${e.courseId}|${ym}`;
      if (!map.has(key)) {
        const course = (courses || []).find((c) => c.id === e.courseId);
        const label = `${course?.title || e.courseTitle} · ${new Date(`${ym}-01T12:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })} cohort`;
        map.set(key, { id: `cohort:${key}`, courseId: e.courseId, ym, label, studentIds: [] });
      }
      map.get(key).studentIds.push(p.id);
    });
  });
  return Array.from(map.values()).sort((a, b) => b.ym.localeCompare(a.ym));
}

export function groupMembers(group, pool) {
  if (!group) return [];
  if (group.kind === "smart") {
    const rule = SMART_RULES.find((r) => r.key === group.rule);
    return rule ? pool.filter(rule.test) : [];
  }
  const ids = new Set(group.memberIds || []);
  return pool.filter((p) => ids.has(p.id));
}

// -- Audience ----------------------------------------------------------
export function emptyAudience() {
  return {
    everyone: false,
    courseIds: [],
    cohortIds: [],
    seriesIds: [],
    mentorship: [],
    segments: [],
    groupIds: [],
    studentIds: [],
    studentSource: "",
    exclude: { segments: [], courseIds: [], groupIds: [] },
  };
}

export function audienceIsEmpty(a) {
  return !a.everyone && !a.courseIds.length && !a.cohortIds.length && !a.seriesIds.length && !a.mentorship.length && !a.segments.length && !a.groupIds.length && !a.studentIds.length;
}

function matchesStudentRef(p, ref) {
  const r = String(ref).trim().toLowerCase();
  return p.id === r || p.name.toLowerCase() === r || p.enrollmentIds.includes(ref);
}

// env: { pool, cohorts, seriesEnrol, mentorships, groups }
export function resolveAudience(audience, env) {
  const { pool, cohorts = [], seriesEnrol = {}, mentorships = [], groups = [] } = env;
  const a = audience || emptyAudience();
  const picked = new Set();
  const add = (list) => list.forEach((s) => picked.add(s.id));

  if (a.everyone) add(pool);
  if (a.courseIds.length) add(pool.filter((p) => p.courseIds.some((c) => a.courseIds.includes(c))));
  if (a.cohortIds.length) {
    const ids = new Set(cohorts.filter((c) => a.cohortIds.includes(c.id)).flatMap((c) => c.studentIds));
    add(pool.filter((p) => ids.has(p.id)));
  }
  if (a.seriesIds.length) {
    const ids = new Set(a.seriesIds.flatMap((sid) => seriesEnrol[sid] || []));
    add(pool.filter((p) => ids.has(p.id)));
  }
  if (a.mentorship.length) {
    const names = new Set(mentorships.filter((m) => a.mentorship.includes(m.status)).map((m) => (m.studentName || "").trim().toLowerCase()));
    add(pool.filter((p) => names.has(p.id)));
  }
  a.segments.forEach((key) => {
    const seg = SEGMENTS.find((s) => s.key === key);
    if (seg) add(pool.filter(seg.test));
  });
  a.groupIds.forEach((gid) => add(groupMembers(groups.find((g) => g.id === gid), pool)));
  if (a.studentIds.length) add(pool.filter((p) => a.studentIds.some((ref) => matchesStudentRef(p, ref))));

  const ex = a.exclude || { segments: [], courseIds: [], groupIds: [] };
  const excluded = new Set();
  ex.segments.forEach((key) => {
    const seg = SEGMENTS.find((s) => s.key === key);
    if (seg) pool.filter(seg.test).forEach((s) => excluded.add(s.id));
  });
  if (ex.courseIds.length) pool.filter((p) => p.courseIds.some((c) => ex.courseIds.includes(c))).forEach((s) => excluded.add(s.id));
  ex.groupIds.forEach((gid) => groupMembers(groups.find((g) => g.id === gid), pool).forEach((s) => excluded.add(s.id)));

  return pool.filter((p) => picked.has(p.id) && !excluded.has(p.id));
}

export function audienceLabels(audience, env) {
  const { courses = [], cohorts = [], seriesList = [], groups = [] } = env;
  const a = audience || emptyAudience();
  const labels = [];
  if (a.everyone) labels.push("All my students");
  a.courseIds.forEach((cid) => labels.push(courses.find((c) => c.id === cid)?.title || "Course"));
  a.cohortIds.forEach((cid) => labels.push(cohorts.find((c) => c.id === cid)?.label || "Cohort"));
  a.seriesIds.forEach((sid) => labels.push(seriesList.find((s) => s.id === sid)?.title || "Test series"));
  a.mentorship.forEach((m) => labels.push(MENTORSHIP_AUDIENCES.find((x) => x.key === m)?.label || "Mentees"));
  a.segments.forEach((k) => labels.push(SEGMENTS.find((s) => s.key === k)?.label || k));
  a.groupIds.forEach((gid) => labels.push(groups.find((g) => g.id === gid)?.name || "Group"));
  if (a.studentIds.length) labels.push(`${a.studentIds.length} selected student${a.studentIds.length === 1 ? "" : "s"}`);
  return labels;
}

export function excludeLabels(audience, env) {
  const { courses = [], groups = [] } = env;
  const ex = (audience || emptyAudience()).exclude;
  return [
    ...ex.segments.map((k) => SEGMENTS.find((s) => s.key === k)?.label || k),
    ...ex.courseIds.map((cid) => courses.find((c) => c.id === cid)?.title || "Course"),
    ...ex.groupIds.map((gid) => groups.find((g) => g.id === gid)?.name || "Group"),
  ];
}

// -- Merge tags --------------------------------------------------------
export function sampleValues(student, seriesName) {
  const s = student || { firstName: "Priya", primaryCourseTitle: "Advanced UI Principles & Color Theory", progress: 64 };
  return {
    first_name: s.firstName,
    course_name: s.primaryCourseTitle,
    next_class: "Thu, Sep 24 · 5:00 PM",
    due_date: "Fri, Sep 25",
    progress_percent: `${s.progress}%`,
    test_series_name: seriesName || "",
  };
}

export function renderMergeTags(text, values) {
  return (text || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key) => {
    const v = values[key.toLowerCase()];
    return v ? v : match;
  });
}

// Tags that are unknown, or known but have nothing to fill them with for
// this audience (e.g. {{test_series_name}} with no test series selected).
export function unresolvedTags(text, { hasSeries }) {
  const found = new Set();
  const re = /\{\{\s*([a-z_]+)\s*\}\}/gi;
  let m;
  while ((m = re.exec(text || ""))) found.add(m[1].toLowerCase());
  const known = MERGE_TAGS.map((t) => t.key);
  const out = [];
  found.forEach((k) => {
    if (!known.includes(k)) out.push({ tag: k, reason: "Not a recognised merge tag" });
    else if (k === "test_series_name" && !hasSeries) out.push({ tag: k, reason: "No test series in this audience to fill it" });
  });
  return out;
}

// -- Compose form ------------------------------------------------------
export function emptyCompose() {
  return {
    draftId: null,
    scheduledId: null,
    type: "announcement",
    audience: emptyAudience(),
    subject: "",
    bodyHtml: "",
    attachments: [],
    cta: { enabled: false, label: "", link: "" },
    channels: { inApp: true, email: true, push: false, sms: false },
    priority: "Normal",
    delivery: { mode: "now", date: "", time: "09:00", frequency: "weekly", until: "" },
    editorKey: 0,
  };
}

export function composeIsBlank(c) {
  return !c.subject.trim() && !stripHtml(c.bodyHtml) && audienceIsEmpty(c.audience);
}

// -- Simulated delivery ---------------------------------------------------
export function simulateRecipients(students, seed, hasCta) {
  return students.map((s) => {
    const h = hashStr(`${seed}:${s.id}`) % 100;
    const status = h < 5 ? "failed" : h < 38 ? "delivered" : "opened";
    return { studentId: s.id, name: s.name, status, clicked: Boolean(hasCta) && status === "opened" && h % 3 === 0 };
  });
}

export function broadcastStats(b) {
  const total = b.recipients.length;
  const delivered = b.recipients.filter((r) => r.status !== "failed").length;
  const opened = b.recipients.filter((r) => r.status === "opened").length;
  const clicked = b.recipients.filter((r) => r.clicked).length;
  const failed = total - delivered;
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  return {
    total,
    delivered,
    opened,
    clicked,
    failed,
    deliveredPct: pct(delivered, total),
    openedPct: pct(opened, delivered),
    clickedPct: pct(clicked, delivered),
    unopened: delivered - opened,
  };
}

export function estimateDelivery(count, channels) {
  return CHANNELS.filter((c) => c.locked || channels[c.key]).map((c) => ({ key: c.key, label: c.label, reached: Math.round(count * c.reach) }));
}

// -- Templates -----------------------------------------------------------
const T = (key, name, type, subject, body) => ({ id: `tpl-${key}`, name, type, subject, bodyHtml: body, builtIn: true, updatedAt: null });

export const BUILT_IN_TEMPLATES = [
  T("welcome", "Welcome", "announcement", "Welcome to {{course_name}}, {{first_name}}!", "<p>Hi {{first_name}},</p><p>Welcome aboard! I'm excited to have you in <strong>{{course_name}}</strong>. Start with the first module, and bring your questions to the next live class: <strong>{{next_class}}</strong>.</p><p>See you there!</p>"),
  T("class-reminder", "Class reminder", "live-class", "Live class reminder: {{next_class}}", "<p>Hi {{first_name}},</p><p>A quick reminder that our next live class for <strong>{{course_name}}</strong> is on <strong>{{next_class}}</strong>. Join a few minutes early so we can start on time.</p>"),
  T("assignment-due", "Assignment due", "assignment-due", "Your assignment is due {{due_date}}", "<p>Hi {{first_name}},</p><p>Your next assignment in <strong>{{course_name}}</strong> is due on <strong>{{due_date}}</strong>. You're at {{progress_percent}} of the course, so there's plenty of time to finish strong.</p>"),
  T("nudge", "Low-engagement nudge", "reminder", "We miss you in {{course_name}}", "<p>Hi {{first_name}},</p><p>It's been a little while since you logged in to <strong>{{course_name}}</strong>. You're at {{progress_percent}}, and even 15 minutes today gets you moving again. I'm here whenever you need a hand.</p>"),
  T("series-launch", "Test series launch", "test-series", "{{test_series_name}} is now open", "<p>Hi {{first_name}},</p><p>Good news: <strong>{{test_series_name}}</strong> is now open. Start with the skill tests to find your gaps, then move on to the full-length mocks.</p>"),
  T("deadline", "Deadline approaching", "reminder", "Deadline coming up: {{due_date}}", "<p>Hi {{first_name}},</p><p>Heads up: a deadline for <strong>{{course_name}}</strong> is coming up on <strong>{{due_date}}</strong>. Please submit before then so I can review it in time.</p>"),
  T("congrats", "Congratulations", "congrats", "Congratulations, {{first_name}}!", "<p>Hi {{first_name}},</p><p>Congratulations on reaching <strong>{{progress_percent}}</strong> in <strong>{{course_name}}</strong>. Your consistency is paying off. Keep it up!</p>"),
  T("course-update", "Course update", "announcement", "New update in {{course_name}}", "<p>Hi {{first_name}},</p><p>I've added fresh material to <strong>{{course_name}}</strong>. Take a look when you next log in, and let me know in the next live class ({{next_class}}) if anything is unclear.</p>"),
];

export function seedTemplates() {
  return [...BUILT_IN_TEMPLATES];
}

// -- Groups ----------------------------------------------------------------
export function seedGroups(pool) {
  const byProgressDesc = [...pool].sort((a, b) => b.progress - a.progress);
  const top = byProgressDesc.slice(0, 4).map((p) => p.id);
  const multi = pool.filter((p) => p.courseIds.length >= 2).slice(0, 5).map((p) => p.id);
  const mentorish = pool.slice(0, 3).map((p) => p.id);
  return [
    { id: "grp-nudge", name: "Needs a nudge", color: "orange", description: "Anyone below 40% progress, refreshed automatically.", kind: "smart", rule: "progress-below-40", memberIds: [], lastUsedAt: new Date(nowMs() - 3 * 86400000).toISOString() },
    { id: "grp-dormant", name: "Not logged in 7 days", color: "pink", description: "Students who haven't opened the portal this week.", kind: "smart", rule: "not-logged-in-7", memberIds: [], lastUsedAt: new Date(nowMs() - 9 * 86400000).toISOString() },
    { id: "grp-stars", name: "Star students", color: "sage", description: "Hand-picked high performers for shout-outs and early access.", kind: "manual", rule: "", memberIds: top, lastUsedAt: new Date(nowMs() - 12 * 86400000).toISOString() },
    { id: "grp-multi", name: "Multi-course learners", color: "lavender", description: "Students enrolled in more than one of my courses.", kind: "manual", rule: "", memberIds: multi, lastUsedAt: null },
    { id: "grp-mentor", name: "Portfolio review circle", color: "blue", description: "Small group preparing for portfolio reviews.", kind: "manual", rule: "", memberIds: mentorish, lastUsedAt: new Date(nowMs() - 20 * 86400000).toISOString() },
  ];
}

// -- Sent / scheduled / drafts seeds --------------------------------------
function sentRecord({ subject, type, bodyHtml, audience, channels, priority = "Normal", cta = null, attachments = [], minutesAgo, students }) {
  const recId = id("bc");
  return {
    id: recId,
    subject,
    type,
    bodyHtml,
    audience,
    channels,
    priority,
    cta,
    attachments,
    sentAt: new Date(nowMs() - minutesAgo * 60000).toISOString(),
    status: "sent",
    resends: 0,
    recipients: simulateRecipients(students, recId, Boolean(cta)),
  };
}

export function seedSent(courses, pool, groups) {
  const env = { pool, groups };
  const c1 = (courses || [])[0];
  const c2 = (courses || [])[1];
  const forAud = (aud) => resolveAudience({ ...emptyAudience(), ...aud }, env);
  const everyone = pool;
  const base = { inApp: true, email: false, push: false, sms: false };
  return [
    sentRecord({
      subject: "New office hours every Friday",
      type: "announcement",
      bodyHtml: "<p>Starting this week I'm holding an open office-hours block every Friday at 4pm. Drop in with questions, no need to book.</p>",
      audience: { ...emptyAudience(), everyone: true },
      channels: { ...base, email: true },
      minutesAgo: 60 * 24 * 2,
      students: everyone,
    }),
    sentRecord({
      subject: "Module 3 live critique moved to Thursday",
      type: "live-class",
      bodyHtml: "<p>This week's live critique moves to <strong>Thursday at 5pm</strong>. Same link, same format.</p>",
      audience: { ...emptyAudience(), courseIds: c1 ? [c1.id] : [] },
      channels: { ...base, email: true, push: true },
      priority: "Important",
      cta: { label: "Open live classes", link: "/teacher/liveclasses" },
      minutesAgo: 60 * 24 * 3,
      students: c1 ? forAud({ courseIds: [c1.id] }) : [],
    }),
    sentRecord({
      subject: "Checking in: are you stuck?",
      type: "reminder",
      bodyHtml: "<p>I noticed you haven't been active lately. If something's blocking you, reply in the next live class and we'll fix it together.</p>",
      audience: { ...emptyAudience(), segments: ["inactive"] },
      channels: { ...base, email: true, push: true },
      minutesAgo: 60 * 24 * 5,
      students: forAud({ segments: ["inactive"] }),
    }),
    sentRecord({
      subject: "Great work this month",
      type: "congrats",
      bodyHtml: "<p>Congratulations to everyone who crossed 80% progress. Your consistency is inspiring!</p>",
      audience: { ...emptyAudience(), segments: ["top"] },
      channels: { ...base, email: true },
      minutesAgo: 60 * 24 * 8,
      students: forAud({ segments: ["top"] }),
    }),
    sentRecord({
      subject: "Performance profiling assignment due Friday",
      type: "assignment-due",
      bodyHtml: "<p>A reminder that the profiling assignment is due this Friday. Submit early if you can.</p>",
      audience: { ...emptyAudience(), courseIds: c2 ? [c2.id] : [] },
      channels: { ...base, email: true, sms: true },
      cta: { label: "Go to course", link: c2 ? `/teacher/coursemanagement/${c2.id}` : "/teacher/mycourses" },
      minutesAgo: 60 * 24 * 11,
      students: c2 ? forAud({ courseIds: [c2.id] }) : [],
    }),
  ];
}

export function seedScheduled(courses, pool) {
  const c1 = (courses || [])[0];
  return [
    {
      id: id("sch"),
      subject: "Certificates going out next week",
      type: "announcement",
      bodyHtml: "<p>Hi {{first_name}}, certificates for <strong>{{course_name}}</strong> are issued automatically once you complete the final module. Expect them a few days after.</p>",
      audience: { ...emptyAudience(), courseIds: c1 ? [c1.id] : [] },
      channels: { inApp: true, email: true, push: false, sms: false },
      priority: "Normal",
      cta: null,
      attachments: [{ name: "certificate-faq.pdf", size: 120000 }],
      scheduledFor: isoMinutesFromNow(60 * 26),
      recurring: null,
    },
    {
      id: id("sch"),
      subject: "Weekly progress check-in",
      type: "reminder",
      bodyHtml: "<p>Hi {{first_name}}, you're at {{progress_percent}} in {{course_name}}. A little progress each day adds up.</p>",
      audience: { ...emptyAudience(), everyone: true },
      channels: { inApp: true, email: true, push: true, sms: false },
      priority: "Normal",
      cta: null,
      attachments: [],
      scheduledFor: isoMinutesFromNow(60 * 24 * 3 + 120),
      recurring: { frequency: "weekly", until: new Date(nowMs() + 60 * 86400000).toISOString().slice(0, 10) },
    },
    {
      id: id("sch"),
      subject: "Mock exam opens Monday",
      type: "test-series",
      bodyHtml: "<p>Hi {{first_name}}, the next full-length mock opens on Monday. Block out the time and good luck!</p>",
      audience: { ...emptyAudience(), segments: ["top", "pending"] },
      channels: { inApp: true, email: true, push: true, sms: false },
      priority: "Important",
      cta: { label: "View test series", link: "/teacher/testseries" },
      attachments: [],
      scheduledFor: isoMinutesFromNow(60 * 24 * 6),
      recurring: null,
    },
  ];
}

export function seedDrafts(courses) {
  const c1 = (courses || [])[0];
  const draft = (patch, minutesAgo) => ({ ...emptyCompose(), draftId: id("drf"), ...patch, updatedAt: new Date(nowMs() - minutesAgo * 60000).toISOString() });
  return [
    draft({ type: "reminder", subject: "Submit before the deadline", bodyHtml: "<p>Hi {{first_name}}, just a reminder to submit your work by {{due_date}}.</p>", audience: { ...emptyAudience(), segments: ["pending"] } }, 60 * 5),
    draft({ type: "announcement", subject: "Winter break schedule", bodyHtml: "<p>Classes pause for two weeks over the winter break. Here is what to expect…</p>", audience: { ...emptyAudience(), courseIds: c1 ? [c1.id] : [] } }, 60 * 30),
  ];
}

// -- Course-scoped announcements (Course Management tab) ----------------------
function isoDaysAgo(n) {
  return new Date(TODAY.getTime() - n * 86400000).toISOString();
}

export function courseMaterials(course) {
  const items = [];
  (course.homeworkItems || []).forEach((h) => {
    (h.files || []).forEach((f) => items.push({ id: f.id, name: f.name, source: h.title }));
  });
  (course.modules || []).forEach((m) => {
    (m.lessons || []).forEach((l) => {
      (l.files || []).forEach((f) => items.push({ id: f.id, name: f.name, source: `${m.title} · ${l.title}` }));
    });
  });
  return items;
}

export function seedAnnouncements(courses) {
  const c1 = (courses || []).find((c) => c.id === "c1");
  if (!c1) return {};
  return {
    [c1.id]: [
      {
        id: id("an"),
        kind: "link",
        title: "Shared: Color contrast reference sheet",
        bodyHtml: "",
        url: "https://universallearning.app/notes/wcag-contrast-cheatsheet",
        attachment: null,
        status: "sent",
        postedAt: isoDaysAgo(6).slice(0, 10),
        scheduledAt: null,
      },
      {
        id: id("an"),
        kind: "announcement",
        title: "Module 3 live critique moved to Thursday",
        bodyHtml: "<p>Quick heads up — this week's live critique session is moving from Wednesday to <strong>Thursday at 5pm</strong> so more of you can make it. Same link, same format.</p>",
        attachment: null,
        status: "sent",
        postedAt: isoDaysAgo(3).slice(0, 10),
        scheduledAt: null,
      },
      {
        id: id("an"),
        kind: "announcement",
        title: "Certificates going out next week",
        bodyHtml: "<p>For everyone finishing up the course — certificates will be issued automatically once you complete the final module. Expect them within a few days after.</p>",
        attachment: { name: "certificate-faq.pdf", size: 120_000 },
        status: "scheduled",
        postedAt: null,
        scheduledAt: isoDaysAgo(-4).slice(0, 10),
      },
    ],
  };
}

export function seedShareLinkLog() {
  return [
    { id: id("sl"), url: "https://universallearning.app/notes/wcag-contrast-cheatsheet", label: "WCAG contrast cheat sheet", recipient: "Course", target: "Advanced UI Principles & Color Theory", sharedAt: isoDaysAgo(6).slice(0, 10) },
    { id: id("sl"), url: "https://universallearning.app/notes/figma-token-starter", label: "Figma token starter file", recipient: "Course", target: "Advanced UI Principles & Color Theory", sharedAt: isoDaysAgo(2).slice(0, 10) },
  ];
}
