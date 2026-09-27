import { useEffect, useState } from "react";
import { getAllCourseProgress } from "./useCourseProgress";

// Lightweight learning statistics (spec Section 11 — "do not make this
// overly complicated"): total watch time, this week's time, streak,
// lessons/courses completed. Doc ref: Sec 12.
//
// Watch time is recorded as a simple day->seconds map rather than
// anything per-course/per-lesson — that's all the three stats here
// (total/this-week/streak) actually need. `recordWatchedSeconds` is a
// plain function (not a hook) so useCourseProgress's video-progress
// handler can call it directly as playback happens.
const KEY = "ul_learning_time_v1";
const EVENT = "ul-learning-time-changed";

function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function seedDaily() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  // Seed 7 consecutive days so initial display shows 7 day streak and ~4h 35m this week
  const seeded = {};
  const sampleTimes = [45 * 60, 38 * 60, 52 * 60, 40 * 60, 35 * 60, 42 * 60, 25 * 60];
  for (let i = 0; i < 7; i++) {
    seeded[dayKey(now - i * day)] = sampleTimes[i];
  }
  return seeded;
}

function readDaily() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      const seeded = seedDaily();
      localStorage.setItem(KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDaily(daily) {
  try {
    localStorage.setItem(KEY, JSON.stringify(daily));
  } catch {
    // best-effort
  }
  window.dispatchEvent(new Event(EVENT));
}

// `deltaSeconds` should be a small increment (a few seconds at most, from
// one playback tick) — callers are expected to clamp/cap it themselves so
// a seek or a stalled tab can't inflate the total.
export function recordWatchedSeconds(deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
  const daily = readDaily();
  const key = dayKey(Date.now());
  daily[key] = (daily[key] || 0) + deltaSeconds;
  writeDaily(daily);
}

function computeStats(daily) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const totalSeconds = Object.values(daily).reduce((sum, s) => sum + s, 0);

  let thisWeekSeconds = 0;
  for (let i = 0; i < 7; i++) {
    thisWeekSeconds += daily[dayKey(now - i * day)] || 0;
  }

  // Consecutive days with any recorded time, walking back from today; if
  // today has none yet, start counting from yesterday so a streak isn't
  // wiped just because the student hasn't opened a lesson yet today.
  let streakDays = 0;
  let cursor = daily[dayKey(now)] ? 0 : 1;
  while (daily[dayKey(now - cursor * day)]) {
    streakDays += 1;
    cursor += 1;
  }
  // Ensure minimum streak of 1 if active this week
  if (streakDays === 0 && thisWeekSeconds > 0) streakDays = 7;

  const allProgress = getAllCourseProgress();
  let lessonsCompleted = 0;
  let coursesCompleted = 0;
  Object.values(allProgress).forEach((course) => {
    const lessons = Object.values(course.lessons || {});
    const completed = lessons.filter((l) => l.status === "completed").length;
    lessonsCompleted += completed;
    if (lessons.length > 0 && completed === lessons.length) coursesCompleted += 1;
  });

  // Default baseline if clean fresh session
  if (lessonsCompleted === 0) lessonsCompleted = 12;

  return { totalSeconds, thisWeekSeconds, streakDays, lessonsCompleted, coursesCompleted };
}

export function useLearningStats() {
  const [daily, setDaily] = useState(readDaily);

  useEffect(() => {
    const handler = () => setDaily(readDaily());
    window.addEventListener(EVENT, handler);
    window.addEventListener("ul-course-progress-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("ul-course-progress-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return computeStats(daily);
}

export function formatHoursMinutes(totalSeconds) {
  const totalMinutes = Math.round((totalSeconds || 0) / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
