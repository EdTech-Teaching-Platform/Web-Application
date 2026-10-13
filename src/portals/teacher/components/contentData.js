// Shared mock data + status logic for the Content Upload workspace and
// Course Preview. Both pages are separate routes (no global store yet —
// this repo's course-builder screens each carry their own draft state, per
// CourseBuilder.jsx/PublishFlow.jsx's existing pattern) so this file is the
// one place both agree on what "the course" and "the curriculum" look like,
// passed between them via router state and falling back to this mock when
// a page is opened directly.
//
// Continues the same sample course used in CourseBuilder.jsx ("Advanced UI
// Principles & Color Theory") so screenshots/demos read as one course
// moving through the builder, not four unrelated ones.

// Canonical course record — the single shape Details, Pricing, Content
// Upload and Course Preview all read/write (via CourseBuilderContext).
// Merges what used to be two separate mocks (CourseBuilder.jsx's richer
// Details-step fields + this file's pricing/instructor/rating fields) into
// one, now that all four builder screens share one context instead of each
// carrying its own draft state.
export const COURSE = {
  title: "Advanced UI Principles & Color Theory",
  subtitle: "Build a designer's eye for color, hierarchy and systems that scale.",
  thumbnail: null,
  // Upload-only (Content Upload Part 7) — mirrors a lesson video's shape
  // (a File object once selected + a processing status), never a URL.
  promoVideoFile: null,
  promoVideoProcessing: "ready",
  category: "Design",
  subCategory: "UI/UX Design",
  level: "Intermediate",
  language: "English",
  tags: ["design-systems", "figma", "accessibility"],
  description:
    "<h3>What this course covers</h3><p>A practical, project-based path from color theory fundamentals to shipping a production-ready design system.</p>",
  outcomes: [
    "Build a full color system with accessible contrast ratios",
    "Establish a typographic and spacing scale for a real product",
    "Ship a documented, reusable component library in Figma",
  ],
  requirements: ["A free Figma account", "Basic familiarity with UI design concepts"],
  audience: ["Junior designers moving into product work", "Developers who want a sharper design eye"],
  durationOverride: "6h 40m",
  certificate: true,
  rating: 4.8,
  ratingCount: 0,
  instructor: {
    name: "Ansh Mehra",
    headline: "Product Designer · 8 years teaching design systems",
    photoUrl: null,
  },

  // -- Pricing (Course Builder Part 4 / Day 6) --------------------------
  pricingModel: "paid", // "free" | "paid"
  price: 3999,
  compareAtPrice: 4999,
  currency: "INR",
  couponsEnabled: true,

  // -- Lifecycle (Course Builder Part 4 / Day 6) ------------------------
  // draft -> pending_review -> published (or archived), with a
  // changes_requested branch off pending_review back to draft-like editing.
  status: "draft",
  adminFeedback: "",
  submittedAt: null,
};

// The Course Builder's 5-step flow spans four separate route files
// (CourseBuilder.jsx: Details/Curriculum, ContentUpload.jsx: Content,
// PublishFlow.jsx: Pricing/Review) that each render the same
// <ProgressSteps> indicator -- defined once here so the step labels can
// never drift out of sync between files.
export const COURSE_BUILDER_STEPS = ["Details", "Curriculum", "Content", "Pricing", "Review"];

export const CURRENCIES = [
  { code: "INR", symbol: "₹" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
];

// Commission captured at the moment of each sale (doc rule: a later rate
// change never applies retroactively to past sales) — fixed here since this
// is a frontend-only prototype, but modeled as its own constant rather than
// inlined so a future "confirm commission at sale time" note has one place
// to point to.
export const PLATFORM_COMMISSION_RATE = 0.2;

export function computeEducatorEarnings(price, rate = PLATFORM_COMMISSION_RATE) {
  const p = Number(price) || 0;
  const commission = Math.round(p * rate * 100) / 100;
  return { commission, earnings: Math.round((p - commission) * 100) / 100 };
}

export function discountPercent(price, compareAt) {
  const p = Number(price) || 0;
  const c = Number(compareAt) || 0;
  if (!c || c <= p) return 0;
  return Math.round(((c - p) / c) * 100);
}

// -- Lifecycle (pure data — icons are chosen in CourseStatusBadge.jsx so
// this file stays JSX-free, matching the rest of contentData.js) ---------
export const LIFECYCLE_META = {
  draft: { label: "Draft", badgeStatus: "neutral" },
  pending_review: { label: "Pending Review", badgeStatus: "warning" },
  published: { label: "Published", badgeStatus: "success" },
  changes_requested: { label: "Changes Requested", badgeStatus: "danger" },
  archived: { label: "Archived", badgeStatus: "neutral" },
};

// Whether each builder section accepts edits in a given lifecycle status.
// "curriculum" covers both the Curriculum Structure and Content Upload
// steps (the doc's "curriculum is locked" note in Published covers both —
// a lesson's content is as much "curriculum" as its slot in the outline).
export function editableSections(status) {
  switch (status) {
    case "pending_review":
      return { details: false, pricing: false, curriculum: false };
    case "published":
      return { details: true, pricing: true, curriculum: false };
    case "archived":
      return { details: false, pricing: false, curriculum: false };
    case "draft":
    case "changes_requested":
    default:
      return { details: true, pricing: true, curriculum: true };
  }
}

// Readiness checklist — Publish Flow's Part 1. Reads real cross-step state
// (course + modules) instead of separately hardcoded flags, per the spec's
// wiring requirement. `to` is the step route each item deep-links back to.
export function computeReadinessChecklist(course, modules) {
  const flat = allLessons(modules);
  const totalLessons = flat.length;
  const lessonsWithContent = flat.filter((l) => lessonStatus(l, false) !== "empty").length;
  const hasAnyModuleWithLessons = modules.some((m) => m.lessons.length > 0);
  const hasFreePreview = flat.some((l) => l.preview);
  const priceOk = course.pricingModel === "free" || (Number(course.price) > 0 && !Number.isNaN(Number(course.price)));

  return [
    {
      id: "title",
      label: "Course title & description",
      complete: Boolean(course.title?.trim()) && Boolean((course.description || "").replace(/<[^>]*>/g, "").trim()),
      blocking: true,
      to: "/teacher/coursebuilder",
    },
    {
      id: "thumbnail",
      label: "Thumbnail uploaded",
      complete: Boolean(course.thumbnail),
      blocking: true,
      to: "/teacher/coursebuilder",
    },
    {
      id: "modules",
      label: "At least one module with lessons",
      complete: hasAnyModuleWithLessons,
      blocking: true,
      to: "/teacher/coursebuilder",
    },
    {
      id: "content",
      label: "All lessons have content",
      complete: totalLessons > 0 && lessonsWithContent === totalLessons,
      blocking: true,
      to: "/teacher/contentupload",
      detail: totalLessons > 0 ? `${lessonsWithContent}/${totalLessons} lessons` : null,
    },
    {
      id: "price",
      label: "Price set",
      complete: priceOk,
      blocking: true,
      to: "/teacher/publishflow",
    },
    {
      id: "preview-lesson",
      label: "At least one free preview lesson",
      complete: hasFreePreview,
      blocking: false,
      to: "/teacher/contentupload",
    },
  ];
}

function id() {
  return crypto.randomUUID();
}

export const INITIAL_MODULES = [
  {
    id: "m1",
    title: "Foundations of Color Theory",
    lessons: [
      {
        id: "l1",
        type: "video",
        title: "Why color systems beat color palettes",
        description: "A quick case for systems thinking before we touch a single hue.",
        required: true,
        preview: true,
        processing: "ready",
        videoFile: { name: "01-why-systems.mp4", size: 84_000_000 },
        embedUrl: "",
        duration: "8:24",
        transcriptFile: { name: "01-why-systems.vtt", size: 12_000 },
        hasContent: true,
      },
      {
        id: "l2",
        type: "video",
        title: "Hue, saturation and perceptual lightness",
        description: "The three dials every color decision actually turns.",
        required: true,
        preview: false,
        processing: "ready",
        videoFile: { name: "02-hsl.mp4", size: 112_000_000 },
        embedUrl: "",
        duration: "11:05",
        transcriptFile: null,
        hasContent: true,
      },
      {
        id: "l3",
        type: "article",
        title: "Contrast, accessibility and WCAG basics",
        description: "Reading reference for contrast ratios you'll use throughout the course.",
        required: true,
        preview: false,
        content:
          "<h2>Why contrast ratios matter</h2><p>WCAG 2.1 AA requires a <strong>4.5:1</strong> contrast ratio for normal text and <strong>3:1</strong> for large text. Below that, readers with low vision — and plenty of readers in bright sunlight — lose the content entirely.</p><ul><li>Check every text/background pairing, not just your primary palette</li><li>Status colors need their own contrast check against both light and dark surfaces</li><li>Don't rely on color alone to carry meaning</li></ul>",
        hasContent: true,
      },
      {
        id: "l4",
        type: "quiz",
        title: "Knowledge check: color fundamentals",
        description: "5 minutes, covers everything from this module.",
        required: true,
        preview: false,
        questions: [
          {
            id: id(),
            text: "Which value in HSL controls how close a color is to white or black?",
            type: "single",
            points: 2,
            options: [
              { id: id(), text: "Hue", correct: false },
              { id: id(), text: "Saturation", correct: false },
              { id: id(), text: "Lightness", correct: true },
            ],
          },
          {
            id: id(),
            text: "WCAG AA requires at least a 4.5:1 contrast ratio for normal body text.",
            type: "truefalse",
            points: 1,
            options: [
              { id: id(), text: "True", correct: true },
              { id: id(), text: "False", correct: false },
            ],
          },
          {
            id: id(),
            text: "Name one reason a color system beats a fixed color palette.",
            type: "short",
            points: 2,
            options: [],
          },
        ],
        maxAttempts: 2,
        passThreshold: 70,
        shuffle: true,
        timeLimitEnabled: false,
        timeLimitMinutes: 10,
        hasContent: true,
      },
    ],
  },
  {
    id: "m2",
    title: "Building a Design System",
    lessons: [
      {
        id: "l5",
        type: "video",
        title: "Structuring color tokens",
        description: "Naming, tiering and versioning a token set that survives a redesign.",
        required: true,
        preview: false,
        processing: "processing",
        videoFile: { name: "05-tokens.mp4", size: 96_000_000 },
        embedUrl: "",
        duration: "",
        transcriptFile: null,
        hasContent: true,
      },
      {
        id: "l6",
        type: "assignment",
        title: "Build your own token set",
        description: "Apply what you learned to a real (or fictional) product.",
        required: true,
        preview: false,
        instructions:
          "<p>Using Figma variables, build a token set covering <strong>color, spacing and typography</strong> for a product of your choosing. Submit a link to your published Figma file.</p>",
        dueDate: "2026-10-05",
        noDueDate: false,
        maxScore: 100,
        submissionType: "link",
        allowResubmission: true,
        lateHandling: true,
        rubric: [
          { id: id(), label: "Token naming is consistent and documented", points: 30 },
          { id: id(), label: "Covers color, spacing and type scales", points: 40 },
          { id: id(), label: "Applied to at least one real component", points: 30 },
        ],
        hasContent: true,
      },
      {
        id: "l7",
        type: "resource",
        title: "Starter Figma file",
        description: "Duplicate this before you start the assignment.",
        required: false,
        preview: false,
        files: [
          { id: id(), name: "color-tokens-starter.fig", size: 2_400_000 },
          { id: id(), name: "assignment-brief.pdf", size: 180_000 },
        ],
        hasContent: true,
      },
    ],
  },
  {
    id: "m3",
    title: "Live Studio & Critique",
    lessons: [
      {
        id: "l8",
        type: "live",
        title: "Group critique — bring your system",
        description: "Bring your token set, we'll critique three live.",
        required: false,
        preview: false,
        scheduledAt: "2026-10-12T17:00",
        meetingLink: "https://meet.universallearning.com/color-critique",
        preSessionFiles: [{ id: id(), name: "critique-format.pdf", size: 90_000 }],
        recordingUrl: "",
        hasContent: true,
      },
      {
        id: "l9",
        type: "article",
        title: "Wrap-up & certificate requirements",
        description: "",
        required: true,
        preview: false,
        content: "",
        hasContent: false,
      },
    ],
  },
  {
    id: "m4",
    title: "Bonus: Portfolio Presentation",
    lessons: [
      {
        id: "l10",
        type: "video",
        title: "Presenting your design system in a portfolio",
        description: "",
        required: false,
        preview: false,
        processing: "ready",
        videoFile: null,
        embedUrl: "",
        duration: "",
        transcriptFile: null,
        hasContent: false,
      },
    ],
  },
];

export function emptyLessonContent(type) {
  switch (type) {
    case "video":
      return { videoFile: null, embedUrl: "", duration: "", transcriptFile: null, preview: false, processing: "ready" };
    case "article":
      return { content: "", preview: false };
    case "quiz":
      return { questions: [], maxAttempts: 1, passThreshold: 70, shuffle: false, timeLimitEnabled: false, timeLimitMinutes: 15 };
    case "assignment":
      return {
        instructions: "",
        dueDate: "",
        noDueDate: false,
        maxScore: 100,
        submissionType: "file",
        allowResubmission: false,
        lateHandling: false,
        rubric: [],
      };
    case "resource":
      return { files: [], description: "" };
    case "live":
      return { scheduledAt: "", meetingLink: "", preSessionFiles: [], recordingUrl: "" };
    default:
      return {};
  }
}

// hasContent per type — the single source of truth the nav tree, summary
// strip and Submit-for-Review gating all read from, instead of trusting a
// stale flag after an edit.
export function computeHasContent(lesson) {
  switch (lesson.type) {
    case "video":
      return Boolean(lesson.videoFile || lesson.embedUrl);
    case "article":
      return Boolean(lesson.content && lesson.content.replace(/<[^>]*>/g, "").trim().length > 0);
    case "quiz":
      return (lesson.questions || []).length > 0;
    case "assignment":
      return Boolean(lesson.instructions && lesson.instructions.replace(/<[^>]*>/g, "").trim().length > 0);
    case "resource":
      return (lesson.files || []).length > 0;
    case "live":
      return Boolean(lesson.scheduledAt);
    default:
      return false;
  }
}

// Four visually distinct states (per the spec's empty/in-progress/added/
// ready), kept inside design.md's success/warning/neutral-only palette for
// status indicators — "added" and "ready" share the success hue and are
// told apart by icon (outline vs filled check) rather than a fourth color.
export function lessonStatus(lesson, isActive) {
  const hasContent = computeHasContent(lesson);
  if (isActive) return "in-progress";
  if (!hasContent) return "empty";
  if (lesson.type === "video" && lesson.processing === "processing") return "in-progress";

  const polished = {
    video: Boolean(lesson.duration) && Boolean(lesson.transcriptFile),
    article: (lesson.content || "").replace(/<[^>]*>/g, "").trim().split(/\s+/).length >= 40,
    quiz: (lesson.questions || []).length >= 3,
    assignment: (lesson.rubric || []).length > 0,
    resource: (lesson.files || []).length > 0,
    live: (lesson.preSessionFiles || []).length > 0,
  }[lesson.type];

  return polished ? "ready" : "added";
}

export function allLessons(modules) {
  return modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id, moduleTitle: m.title })));
}

export function readingTime(html) {
  const words = (html || "").replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function quizTotalPoints(questions = []) {
  return questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isPricingValid(course) {
  if (course.pricingModel === "free") return true;
  const price = Number(course.price);
  return Boolean(course.price !== "" && course.price != null) && !Number.isNaN(price) && price > 0;
}

// builderPath — every Course Builder screen (Details/Curriculum, Content
// Upload, Pricing/Review, Preview) needs its internal Back/Continue
// navigation to keep pointing at whichever course is actually being
// edited, now that CourseBuilderContext is keyed by :courseId instead of
// carrying one hardcoded draft. "c1" (the original flagship sample course)
// keeps the plain, id-less URLs it always had; any other course appends
// its id so the wizard stays on the right course end to end.
export function builderPath(base, courseId) {
  return courseId && courseId !== "c1" ? `${base}/${courseId}` : base;
}
