// UNUSED -- no longer imported anywhere. The "Build from Course" / "Question Bank" / Duplicate / CSV / AI start paths
// were removed: test series are now built manually from scratch. Safe to delete this file.
// Build-method helpers for the "How do you want to build this?" flow:
// course -> series suggestions, the mock AI outline generator and
// duplicate-from-series cloning. Pure functions only.
import { TS_SUBJECTS, TS_LANGUAGES, makeId, newSection, newTest } from "./testSeriesData";

export const BUILD_METHODS = [
  { key: "scratch", title: "Build from scratch", desc: "Start with an empty series and add sections, tests and questions yourself." },
  { key: "duplicate", title: "Duplicate an existing series", desc: "Copy the structure and questions of a series you already made." },
  { key: "import", title: "Import questions", desc: "Upload a CSV with your questions and review a row-by-row validation report." },
  { key: "bank", title: "Pick from question bank", desc: "Filter the shared bank by subject, topic and difficulty, then add what you need." },
  { key: "ai", title: "AI-assisted outline", desc: "Get an editable suggested outline from a topic and difficulty. You stay in control." },
];

const CATEGORY_TO_SUBJECT = { Development: "Computer Science", Design: "Other", Career: "Other", Business: "Other" };
const LEVEL_TO_DIFFICULTY = { Beginner: "Beginner", Intermediate: "Intermediate", Advanced: "Advanced" };

// Suggest tags + a starter structure from one of the educator's courses.
export function suggestFromCourse(course) {
  const modules = course.modules || [];
  return {
    title: `${course.title} — Test Series`,
    shortDescription: `Checkpoint tests aligned to ${course.title}.`,
    subjects: [TS_SUBJECTS.includes(course.category) ? course.category : CATEGORY_TO_SUBJECT[course.category] || "Other"],
    difficulty: LEVEL_TO_DIFFICULTY[course.level] || "Intermediate",
    languages: [TS_LANGUAGES.includes(course.language) ? course.language : "English"],
    exams: ["Skill Tests"],
    grades: ["Other"],
    topics: modules.map((m) => m.title).filter(Boolean),
    modules: modules.map((m) => ({ id: m.id, title: m.title })),
    enrolled: (course.students || []).length,
  };
}
// Starter structure: one section ("Course Tests") with a chapter test per module.
export function structureFromCourse(course) {
  const sec = newSection("Course Tests");
  sec.tests = (course.modules || []).filter((m) => m.title).map((m) => ({ ...newTest(), title: `Checkpoint: ${m.title}`, type: "Chapter", duration: 20, locked: false }));
  return sec.tests.length ? [sec] : [];
}

// Mock "AI" outline: deterministic, runs entirely locally. Clearly an editable
// suggestion in the UI. { topic, difficulty, sections, testsPerSection }
export function generateOutline({ topic, difficulty = "Intermediate", sections = 2, testsPerSection = 2 }) {
  const t = topic.trim();
  const sectionPlans = [
    { title: "Skill Tests", type: "Topic", base: 15, label: (i) => `${t} — Skill Check ${i}` },
    { title: "Practice Tests", type: "Chapter", base: 30, label: (i) => `${t} — Practice Set ${i}` },
    { title: "Mock Exams", type: "Full-Length", base: 60, label: (i) => `${t} — Full Mock ${i}` },
    { title: "Sectional Tests", type: "Sectional", base: 40, label: (i) => `${t} — Sectional ${i}` },
  ];
  const mult = difficulty === "Advanced" ? 1.5 : difficulty === "Beginner" ? 0.75 : 1;
  const secs = sectionPlans.slice(0, Math.max(1, Math.min(4, sections))).map((p) => ({
    id: makeId("s"),
    title: p.title,
    tests: Array.from({ length: Math.max(1, Math.min(5, testsPerSection)) }, (_, i) => ({
      id: makeId("t"),
      title: p.label(i + 1),
      type: p.type,
      duration: Math.round((p.base * mult) / 5) * 5 || 15,
      questions: Math.round((p.base * mult) / 3),
    })),
  }));
  const topicTags = [`${t} fundamentals`, `${t} applications`, `${t} problem solving`, `${t} common mistakes`];
  return { sections: secs, topicTags, difficulty };
}
// Turn an (edited) outline into real builder sections with empty tests.
export function outlineToSections(outline) {
  return outline.sections.map((s) => ({
    id: makeId("s"),
    title: s.title,
    tests: s.tests.map((t) => ({ ...newTest(), title: t.title, type: t.type, duration: Number(t.duration) || 30, locked: false, questions: [] })),
  }));
}

// Deep-clone sections (new ids everywhere) for "Duplicate an existing series".
export function cloneSections(sections) {
  return JSON.parse(JSON.stringify(sections)).map((s) => ({
    ...s,
    id: makeId("s"),
    tests: s.tests.map((t) => ({
      ...t,
      id: makeId("t"),
      questions: t.questions.map((q) => ({
        ...q,
        id: makeId("q"),
        options: q.options ? q.options.map((o) => ({ ...o, id: makeId("o") })) : undefined,
        rubric: q.rubric ? q.rubric.map((r) => ({ ...r, id: makeId("r") })) : undefined,
      })),
    })),
  }));
}
