import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { studentStorageKey } from "../data/studentLocalState";

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
      askedBy: "Aarav S.",
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
      askedBy: "Sneha K.",
      answer: null,
      following: true,
    },
  ];
}

function readAll(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(key, all) {
  try {
    localStorage.setItem(key, JSON.stringify(all));
  } catch {
    // best-effort
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useCourseQA(courseId) {
  const { user } = useAuth();
  const storeKey = studentStorageKey(KEY, user);
  const [all, setAll] = useState(() => readAll(storeKey));

  useEffect(() => {
    const handler = () => setAll(readAll(storeKey));
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [storeKey]);

  const questions = Array.isArray(all[courseId]) ? all[courseId] : [];

  useEffect(() => {
    if (Array.isArray(all[courseId])) return;
    const seeded = seedFor(courseId);
    const next = { ...readAll(storeKey), [courseId]: seeded };
    writeAll(storeKey, next);
    setAll(next);
  }, [all, courseId, storeKey]);

  const mutate = useCallback(
    (fn) => {
      const current = readAll(storeKey);
      const currentQuestions = Array.isArray(current[courseId]) ? current[courseId] : seedFor(courseId);
      const next = { ...current, [courseId]: fn(currentQuestions) };
      writeAll(storeKey, next);
      setAll(next);
    },
    [courseId, storeKey]
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
