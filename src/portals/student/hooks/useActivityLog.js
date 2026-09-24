import { useCallback, useEffect, useState } from "react";

// Cross-course learning activity log — backs Learning History's history
// list (Sec 5), the Recent Activity Timeline (Sec 6), and the streak/
// stats calc in useLearningStats.js. Doc ref: Sec 12 (Progress Tracking).
//
// Deliberately module-level (not scoped to one course, unlike
// useCourseProgress) since Learning History spans every course the
// student has touched. `logActivity` is a plain function, not a hook, so
// useCourseProgress.js can call it directly at the moment something
// actually happens (a lesson completes, a video is watched, a note is
// added) without needing its own hook instance.
const KEY = "ul_activity_log_v1";
const EVENT = "ul-activity-log-changed";
const MAX_ENTRIES = 300;

// Seeded entries reflecting real course structure and the exact spec examples:
// "Today: Python Bootcamp - Loops & Functions (82% watched) [Continue]"
// "Yesterday: Python Bootcamp - Conditional Statements (✓ Completed)"
// "2 days ago: SQL Fundamentals - Joins (✓ Completed)"
function seed() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return [
    {
      id: "seed1",
      courseId: "c1",
      courseTitle: "Complete Python Bootcamp",
      lessonId: "l5",
      lessonTitle: "Loops & Functions",
      moduleId: "m2",
      moduleTitle: "Control Flow & Functions",
      activityType: "watched",
      lessonType: "video",
      percent: 82,
      createdAt: now - 1.5 * 60 * 60 * 1000, // 1.5 hours ago (Today)
    },
    {
      id: "seed2",
      courseId: "c1",
      courseTitle: "Complete Python Bootcamp",
      lessonId: "l4",
      lessonTitle: "Conditional Statements & Logic",
      moduleId: "m2",
      moduleTitle: "Control Flow & Functions",
      activityType: "completed",
      lessonType: "video",
      percent: 100,
      createdAt: now - 3.5 * 60 * 60 * 1000, // Today
    },
    {
      id: "seed3",
      courseId: "c1",
      courseTitle: "Complete Python Bootcamp",
      lessonId: "l3",
      lessonTitle: "Reference Cheat-Sheet & Syntax Guide",
      moduleId: "m1",
      moduleTitle: "Getting Started with Python",
      activityType: "note",
      lessonType: "resource",
      percent: 100,
      createdAt: now - 5 * 60 * 60 * 1000, // Today
    },
    {
      id: "seed4",
      courseId: "c1",
      courseTitle: "Complete Python Bootcamp",
      lessonId: "l2",
      lessonTitle: "Setting Up Your Environment",
      moduleId: "m1",
      moduleTitle: "Getting Started with Python",
      activityType: "completed",
      lessonType: "video",
      percent: 100,
      createdAt: now - day - 2 * 60 * 60 * 1000, // Yesterday
    },
    {
      id: "seed5",
      courseId: "c1",
      courseTitle: "Complete Python Bootcamp",
      lessonId: "l1",
      lessonTitle: "Course Overview & Learning Strategy",
      moduleId: "m1",
      moduleTitle: "Getting Started with Python",
      activityType: "completed",
      lessonType: "video",
      percent: 100,
      createdAt: now - day - 4 * 60 * 60 * 1000, // Yesterday
    },
    {
      id: "seed6",
      courseId: "c2",
      courseTitle: "Algebra Foundations",
      lessonId: "l4",
      lessonTitle: "Linear Equations & Graphing",
      moduleId: "m2",
      moduleTitle: "Core Concepts",
      activityType: "completed",
      lessonType: "video",
      percent: 100,
      createdAt: now - 2 * day - 3 * 60 * 60 * 1000, // 2 days ago
    },
    {
      id: "seed7",
      courseId: "c2",
      courseTitle: "Algebra Foundations",
      lessonId: "l3",
      lessonTitle: "Formula Reference Sheet",
      moduleId: "m1",
      moduleTitle: "Getting Started",
      activityType: "viewed",
      lessonType: "resource",
      percent: 100,
      createdAt: now - 2 * day - 5 * 60 * 60 * 1000, // 2 days ago
    },
    {
      id: "seed8",
      courseId: "c6",
      courseTitle: "UI Design Fundamentals",
      lessonId: "l7",
      lessonTitle: "Design Systems & Typography Rules",
      moduleId: "m2",
      moduleTitle: "Core Concepts",
      activityType: "read",
      lessonType: "article",
      percent: 100,
      createdAt: now - 4 * day - 2 * 60 * 60 * 1000, // 4 days ago
    },
  ];
}

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      const seeded = seed();
      localStorage.setItem(KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // best-effort
  }
  window.dispatchEvent(new Event(EVENT));
}

// activityType: "completed" | "watched" | "viewed" | "read" | "note"
export function logActivity({
  courseId,
  courseTitle,
  lessonId,
  lessonTitle,
  moduleId,
  moduleTitle,
  activityType,
  lessonType = "video",
  percent,
}) {
  const entries = readAll();
  const entry = {
    id: `a${Date.now()}${Math.round(Math.random() * 999)}`,
    courseId,
    courseTitle: courseTitle || (courseId === "c1" ? "Complete Python Bootcamp" : courseId === "c2" ? "Algebra Foundations" : "Course"),
    lessonId,
    lessonTitle: lessonTitle || "Lesson",
    moduleId: moduleId || "m1",
    moduleTitle: moduleTitle || "Module",
    activityType,
    lessonType,
    percent: percent ?? (activityType === "completed" ? 100 : undefined),
    createdAt: Date.now(),
  };
  writeAll([entry, ...entries]);
}

export function useActivityLog() {
  const [entries, setEntries] = useState(readAll);

  useEffect(() => {
    const handler = () => setEntries(readAll());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const forCourse = useCallback((courseId) => entries.filter((e) => e.courseId === courseId), [entries]);

  return { entries, forCourse };
}
