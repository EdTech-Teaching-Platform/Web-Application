import { useCallback, useEffect, useState } from "react";
import { logActivity } from "./useActivityLog";
import { recordWatchedSeconds } from "./useLearningStats";

// Client-side lesson/course progress store — Day 4 Course Player + Notes/
// History/Progress pass. Doc ref: Sec 5.5 ("per-lesson progress, never
// regresses"), Sec 12 (Progress Tracking). No progress-tracking endpoints
// exist yet, same situation useWishlist.js/checkoutApi.js were in — kept
// in localStorage so the player is actually resumable/persistent across
// reloads for a real demo, keyed per course. Swap the read/write for real
// API calls once the backend exists; call sites don't need to change
// shape. "Do not rely only on frontend state if backend progress data
// already exists" (spec Sec 9) — noted here for whoever wires the API in:
// this whole module is the seam to swap, not something to layer a second
// source of truth on top of.
//
// Shape per course:
// {
//   lastLessonId,
//   lessons: { [lessonId]: { status, maxWatchedPercent, positionSec, startedAt, completedAt, updatedAt } },
//   notes: [{ id, lessonId, moduleId, moduleTitle, lessonTitle, text, timestampSec, createdAt, updatedAt }],
// }
const KEY = "ul_course_progress_v1";
const EVENT = "ul-course-progress-changed";

// Video is considered "complete" once watched percentage reaches this —
// spec: "Do not visually mark a video as completed before the completion
// threshold is reached."
export const VIDEO_COMPLETION_THRESHOLD = 90;

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // best-effort only — a full/blocked localStorage shouldn't break the player
  }
  window.dispatchEvent(new Event(EVENT));
}

// Raw cross-course read — used by useLearningStats.js and the Learning
// History / Progress Tracking / Notes pages.
export function getAllCourseProgress() {
  return readAll();
}

// Helper to fetch all notes across every course for the standalone Notes page
export function getAllNotes() {
  const all = readAll();
  const notes = [];
  Object.entries(all).forEach(([courseId, courseData]) => {
    if (Array.isArray(courseData?.notes)) {
      courseData.notes.forEach((note) => {
        notes.push({ ...note, courseId });
      });
    }
  });
  return notes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function deleteNoteGlobal(noteId) {
  const all = readAll();
  let changed = false;
  Object.entries(all).forEach(([cId, cData]) => {
    if (Array.isArray(cData?.notes)) {
      const filtered = cData.notes.filter((n) => n.id !== noteId);
      if (filtered.length !== cData.notes.length) {
        all[cId].notes = filtered;
        changed = true;
      }
    }
  });
  if (changed) {
    writeAll(all);
  }
}

export function updateNoteGlobal(noteId, newText) {
  const trimmed = newText.trim();
  if (!trimmed) return;
  const all = readAll();
  let changed = false;
  Object.entries(all).forEach(([cId, cData]) => {
    if (Array.isArray(cData?.notes)) {
      all[cId].notes = cData.notes.map((n) => {
        if (n.id === noteId) {
          changed = true;
          return { ...n, text: trimmed, updatedAt: Date.now() };
        }
        return n;
      });
    }
  });
  if (changed) {
    writeAll(all);
  }
}

function emptyCourse() {
  return { lastLessonId: null, lessons: {}, notes: [] };
}

function emptyLesson() {
  return {
    status: "not-started", // "not-started" | "in-progress" | "completed"
    maxWatchedPercent: 0,
    positionSec: 0,
    startedAt: null,
    completedAt: null,
    updatedAt: null,
  };
}

export function useCourseProgress(courseId) {
  const [all, setAll] = useState(readAll);

  useEffect(() => {
    const handler = () => setAll(readAll());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const storedCourse = all[courseId];
  const course = {
    ...emptyCourse(),
    ...(storedCourse && typeof storedCourse === "object" ? storedCourse : {}),
    lessons:
      storedCourse?.lessons && typeof storedCourse.lessons === "object"
        ? storedCourse.lessons
        : {},
    notes: Array.isArray(storedCourse?.notes) ? storedCourse.notes : [],
  };

  const mutate = useCallback(
    (fn) => {
      const current = readAll();
      const stored = current[courseId];
      const currentCourse = {
        ...emptyCourse(),
        ...(stored && typeof stored === "object" ? stored : {}),
        lessons: stored?.lessons && typeof stored.lessons === "object" ? stored.lessons : {},
        notes: Array.isArray(stored?.notes) ? stored.notes : [],
      };
      const nextCourse = fn(currentCourse);
      const next = { ...current, [courseId]: nextCourse };
      writeAll(next);
      setAll(next);
    },
    [courseId]
  );

  const getLessonState = useCallback(
    (lessonId) => {
      const storedLesson = course.lessons?.[lessonId];
      return storedLesson && typeof storedLesson === "object"
        ? { ...emptyLesson(), ...storedLesson }
        : emptyLesson();
    },
    [course]
  );

  // Helper to extract lesson object details even if called with an ID string
  const resolveLesson = useCallback((lessonOrId) => {
    if (!lessonOrId) return { id: "unknown", type: "video" };
    if (typeof lessonOrId === "object") return lessonOrId;
    return { id: String(lessonOrId), type: "video" };
  }, []);

  // Marks a lesson "in progress" the moment the student opens it (if it
  // isn't already completed) and records it as the resume point. Logs
  // a "watched" activity the first time a video lesson is opened.
  const openLesson = useCallback(
    (lessonOrId) => {
      const lesson = resolveLesson(lessonOrId);
      mutate((c) => {
        const existing = c.lessons[lesson.id] ?? emptyLesson();
        const now = Date.now();
        const wasNotStarted = existing.status === "not-started";
        const updated = wasNotStarted
          ? { ...existing, status: "in-progress", startedAt: existing.startedAt ?? now, updatedAt: now }
          : existing;
        if (wasNotStarted && lesson.type === "video") {
          logActivity({
            courseId,
            lessonId: lesson.id,
            moduleId: lesson.moduleId,
            lessonTitle: lesson.title,
            moduleTitle: lesson.moduleTitle,
            activityType: "watched",
            lessonType: lesson.type || "video",
          });
        }
        return { ...c, lastLessonId: lesson.id, lessons: { ...c.lessons, [lesson.id]: updated } };
      });
    },
    [mutate, courseId, resolveLesson]
  );

  // Video progress: percent is the CURRENT playhead position; we only ever
  // grow maxWatchedPercent (so scrubbing backward never lowers "watched"),
  // and crossing the completion threshold marks the lesson complete —
  // once complete, a lesson never regresses to an earlier state.
  // `deltaSeconds` feeds the separate learning-time stat.
  const updateVideoProgress = useCallback(
    (lessonOrId, { positionSec, percent, deltaSeconds }) => {
      const lesson = resolveLesson(lessonOrId);
      if (deltaSeconds) recordWatchedSeconds(Math.min(deltaSeconds, 3));

      mutate((c) => {
        const existing = c.lessons[lesson.id] ?? emptyLesson();
        if (existing.status === "completed") {
          // still track playhead position for resume, never touch status/percent
          return { ...c, lessons: { ...c.lessons, [lesson.id]: { ...existing, positionSec, updatedAt: Date.now() } } };
        }
        const maxWatchedPercent = Math.max(existing.maxWatchedPercent || 0, percent || 0);
        const reachedThreshold = maxWatchedPercent >= VIDEO_COMPLETION_THRESHOLD;
        const now = Date.now();
        if (reachedThreshold && existing.status !== "completed") {
          logActivity({
            courseId,
            lessonId: lesson.id,
            moduleId: lesson.moduleId,
            lessonTitle: lesson.title,
            moduleTitle: lesson.moduleTitle,
            activityType: "completed",
            lessonType: "video",
            percent: 100,
          });
        }
        return {
          ...c,
          lessons: {
            ...c.lessons,
            [lesson.id]: {
              ...existing,
              positionSec: positionSec ?? existing.positionSec,
              maxWatchedPercent,
              status: reachedThreshold ? "completed" : "in-progress",
              completedAt: reachedThreshold ? existing.completedAt ?? now : existing.completedAt,
              startedAt: existing.startedAt ?? now,
              updatedAt: now,
            },
          },
        };
      });
    },
    [mutate, courseId, resolveLesson]
  );

  // Manual completion (Resource / Text "Mark as Complete") — never regresses.
  const markComplete = useCallback(
    (lessonOrId) => {
      const lesson = resolveLesson(lessonOrId);
      mutate((c) => {
        const existing = c.lessons[lesson.id] ?? emptyLesson();
        if (existing.status === "completed") return c;
        const now = Date.now();
        logActivity({
          courseId,
          lessonId: lesson.id,
          moduleId: lesson.moduleId,
          lessonTitle: lesson.title,
          moduleTitle: lesson.moduleTitle,
          activityType: "completed",
          lessonType: lesson.type || "resource",
          percent: 100,
        });
        return {
          ...c,
          lessons: {
            ...c.lessons,
            [lesson.id]: { ...existing, status: "completed", maxWatchedPercent: 100, completedAt: now, updatedAt: now },
          },
        };
      });
    },
    [mutate, courseId, resolveLesson]
  );

  const getNotes = useCallback(
    (lessonId) => {
      const allNotes = course.notes ?? [];
      if (lessonId) {
        return allNotes.filter((n) => n.lessonId === lessonId);
      }
      return allNotes;
    },
    [course]
  );

  // `timestampSec` is set only for a note added on a video lesson at a
  // specific playhead position (spec Section 1 — timestamped notes);
  // null/undefined for resource/text lessons.
  const addNote = useCallback(
    (lessonOrId, text, timestampSec) => {
      const lesson = resolveLesson(lessonOrId);
      const trimmed = text.trim();
      if (!trimmed) return;
      mutate((c) => {
        const note = {
          id: `n${Date.now()}`,
          lessonId: lesson.id,
          moduleId: lesson.moduleId ?? null,
          moduleTitle: lesson.moduleTitle ?? "Course Material",
          lessonTitle: lesson.title ?? "Lesson",
          text: trimmed,
          timestampSec: typeof timestampSec === "number" ? timestampSec : null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        return { ...c, notes: [note, ...(c.notes ?? [])] };
      });
      logActivity({
        courseId,
        lessonId: lesson.id,
        moduleId: lesson.moduleId,
        lessonTitle: lesson.title,
        moduleTitle: lesson.moduleTitle,
        activityType: "note",
        lessonType: lesson.type || "video",
      });
    },
    [mutate, courseId, resolveLesson]
  );

  const updateNote = useCallback(
    (noteId, text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      mutate((c) => ({
        ...c,
        notes: (c.notes ?? []).map((n) => (n.id === noteId ? { ...n, text: trimmed, updatedAt: Date.now() } : n)),
      }));
    },
    [mutate]
  );

  const deleteNote = useCallback(
    (noteId) => {
      mutate((c) => ({ ...c, notes: (c.notes ?? []).filter((n) => n.id !== noteId) }));
    },
    [mutate]
  );

  return {
    lastLessonId: course.lastLessonId,
    getLessonState,
    openLesson,
    updateVideoProgress,
    markComplete,
    getNotes,
    addNote,
    updateNote,
    deleteNote,
  };
}
