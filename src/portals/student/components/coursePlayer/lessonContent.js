// Course Player content helpers (Day 4). Doc ref: Sec 5.5, 10.1.
//
// catalogMock.js's curriculum only carries the lesson metadata Course
// Details needs (id/title/type/duration/preview) — there are no real
// content/asset endpoints yet. Rather than bloating the shared catalog
// file with player-only fields, this derives deterministic mock content
// (video src, reading text, resource pages) from that same lesson
// metadata, purely on the client, exactly the same "build the real UI now,
// swap the data source later" pattern checkoutApi.js/authApi.js already
// use elsewhere in this project.
import { VideoIcon, FileTextIcon, HelpCircleIcon, DownloadIcon } from "../../../../components/ui/icons";

// Same type->icon mapping CourseDetails.jsx already uses for curriculum
// rows — kept identical rather than forked so a lesson's icon never
// differs between Course Details and the Course Player.
export const LESSON_TYPE_ICON = {
  video: VideoIcon,
  article: FileTextIcon,
  quiz: HelpCircleIcon,
  assignment: FileTextIcon,
  resource: DownloadIcon,
  live: VideoIcon,
};

export const LESSON_TYPE_LABEL = {
  video: "Video",
  article: "Text",
  quiz: "Quiz",
  assignment: "Assignment",
  resource: "Resource",
  live: "Live recording",
};

// A handful of small, real, CORS-friendly sample clips so the video player
// exercises an actual <video> element (real buffering/duration/seek)
// instead of a fake progress bar. Cycled by lesson index — not meant to
// match the lesson's fictional "18 min" duration label, which is display
// copy for the nav list.
const SAMPLE_VIDEOS = [
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/coffee.mp4",
];

function hashIndex(id, mod) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return h % mod;
}

// Flattens a course's curriculum into a single ordered lesson list, each
// entry carrying its module — this is what "Next" moving into the
// following module's first lesson, and course/module progress math, both
// walk over.
export function flattenCurriculum(curriculum) {
  const flat = [];
  curriculum.forEach((module, moduleIndex) => {
    module.lessons.forEach((lesson, lessonIndex) => {
      flat.push({ ...lesson, moduleId: module.id, moduleTitle: module.title, moduleIndex, lessonIndex });
    });
  });
  return flat;
}

export function videoSrcFor(lesson) {
  return SAMPLE_VIDEOS[hashIndex(lesson.id, SAMPLE_VIDEOS.length)];
}

// Mock reading content for "article" (Text Lesson Reader) lessons.
export function textBodyFor(lesson, moduleTitle) {
  const topic = lesson.title.replace(/[:—-].*$/, "").trim();
  return [
    `This lesson is part of "${moduleTitle}." By the end of it you should be able to explain ${topic.toLowerCase()} in your own words and recognize it in a real example, not just recite a definition.`,
    `Start by noticing the pattern before naming it. Most learners who struggle with this topic try to memorize the rule first — it goes much faster the other way around: look at two or three concrete examples, find what they have in common, and only then attach the formal name to what you already noticed.`,
    `A common mistake here is assuming the simplest case always generalizes. It usually gets you most of the way, but the edge cases are exactly where this topic tends to show up in real projects and in assessments — so pay close attention to any example below that looks like an exception.`,
    `Try pausing here and predicting the next example before reading it. Prediction, even a wrong one, builds a much stronger mental model than passively reading through — you'll retain this section noticeably longer if you do.`,
    `Once this clicks, it connects directly to the next lesson in this module, so take the extra minute now rather than rushing ahead — it pays for itself almost immediately.`,
    `Quick recap: the core idea, why it matters in practice, and the one exception worth remembering. If any of the three feels shaky, scroll back up before marking this lesson complete.`,
  ];
}

// Mock paginated content for "resource" (PDF/Resource Viewer) lessons.
export function resourcePagesFor(lesson, moduleTitle) {
  const pageCount = 4 + (hashIndex(lesson.id, 3));
  return Array.from({ length: pageCount }, (_, i) => ({
    page: i + 1,
    heading: i === 0 ? lesson.title : `${lesson.title} — page ${i + 1}`,
    body:
      i === 0
        ? `Reference material for "${moduleTitle}." Use the page controls below to move through this document without leaving the course.`
        : `Supporting detail, page ${i + 1} of ${pageCount}. This placeholder stands in for the actual uploaded PDF page image once the resource-upload backend is wired up.`,
  }));
}

export function resourceFileNameFor(lesson) {
  return `${lesson.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
}

// Transcript segments for video lessons (spec Section 3 — Transcript tab).
// Not every video lesson has one — roughly 1 in 4 come back `null` here so
// the "Transcript unavailable for this lesson." empty state (spec's
// explicit "do not fake it if unavailable") is a real, reachable path, not
// just written copy nobody sees. Segment `startPercent` is a fraction of
// the lesson's actual playback duration (known only once the <video>
// element loads) — the Transcript tab converts it to seconds itself.
const TRANSCRIPT_LINES = [
  "Let's pick up from where we left off.",
  "The key idea here is simpler than it looks once you see it once.",
  "Notice how this step follows directly from the last one.",
  "This is the part most people get stuck on, so let's slow down.",
  "Here's a quick example to make this concrete.",
  "That's the core mechanism — everything else is a variation on this.",
  "A common mistake is skipping this check before moving on.",
  "Let's connect this back to what you already know.",
  "One more detail worth calling out before we wrap up.",
  "To recap: this is the pattern to remember going forward.",
];

export function transcriptFor(lesson) {
  if (lesson.type !== "video") return null;
  if (hashIndex(lesson.id, 4) === 0) return null; // deliberately unavailable for ~1/4 of videos

  const segmentCount = 6 + hashIndex(lesson.id, 4);
  return Array.from({ length: segmentCount }, (_, i) => ({
    id: `${lesson.id}-t${i}`,
    startPercent: (i / segmentCount) * 100,
    text: TRANSCRIPT_LINES[(hashIndex(lesson.id, 997) + i) % TRANSCRIPT_LINES.length],
  }));
}

export function formatSeconds(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
