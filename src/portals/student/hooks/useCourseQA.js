import { useCallback, useEffect, useState } from "react";

// Course Q&A store (spec Section 4) — localStorage-keyed per course, same
// "real UI now, swap the data source later" approach as the rest of this
// pass. No Q&A/instructor-messaging backend exists yet. Questions are
// asked by the current student and optionally answered by the educator;
// seeded with a couple of answered/unanswered examples per course so the
// tab has real-looking content immediately.
const KEY = "ul_course_qa_v1";
const EVENT = "ul-course-qa-changed";

function seedFor(courseId) {
  const now = Date.now();
  return [
    {
      id: `${courseId}-q1`,
      text: "What's the difference between a list and a tuple here?",
      lessonId: null,
      askedAt: now - 26 * 60 * 60 * 1000,
      askedBy: "You",
      answer: {
        text: "Lists are mutable — you can change, add, or remove items after creating one. Tuples are immutable, so once created their contents can't change. Use a tuple when the data shouldn't be modified later.",
        answeredAt: now - 20 * 60 * 60 * 1000,
      },
      following: true,
    },
    {
      id: `${courseId}-q2`,
      text: "Is there a recommended way to practice outside the lesson exercises?",
      lessonId: null,
      askedAt: now - 3 * 60 * 60 * 1000,
      askedBy: "You",
      answer: null,
      following: true,
    },
  ];
}

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
    // best-effort
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useCourseQA(courseId) {
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

  const questions = Array.isArray(all[courseId]) ? all[courseId] : [];

  useEffect(() => {
    if (Array.isArray(all[courseId])) return;
    const seeded = seedFor(courseId);
    const next = { ...readAll(), [courseId]: seeded };
    writeAll(next);
    setAll(next);
  }, [all, courseId]);

  const mutate = useCallback(
    (fn) => {
      const current = readAll();
      const currentQuestions = Array.isArray(current[courseId]) ? current[courseId] : seedFor(courseId);
      const next = { ...current, [courseId]: fn(currentQuestions) };
      writeAll(next);
      setAll(next);
    },
    [courseId]
  );

  const askQuestion = useCallback(
    (text, lessonId) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      mutate((qs) => [
        { id: `q${Date.now()}`, text: trimmed, lessonId: lessonId ?? null, askedAt: Date.now(), askedBy: "You", answer: null, following: true },
        ...qs,
      ]);
    },
    [mutate]
  );

  const toggleFollow = useCallback(
    (questionId) => {
      mutate((qs) => qs.map((q) => (q.id === questionId ? { ...q, following: !q.following } : q)));
    },
    [mutate]
  );

  return { questions, askQuestion, toggleFollow };
}
