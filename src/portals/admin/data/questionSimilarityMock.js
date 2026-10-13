// Repeated Questions Detection — local, deterministic text-similarity
// comparison across every question in every test in every Test Series
// (testSeriesMock.js). No AI/semantic service is configured in this
// app, so this uses plain token-overlap (Jaccard) similarity on
// normalized question text — reliable for exact and near-duplicate
// wording, not true semantic matching. If a real embeddings/AI
// similarity service is wired up later, swap the body of
// scoreSimilarity() for that call; everything else (the review-state
// store, match shape, UI) can stay the same.
//
// Nothing here ever mutates a question or test series — matches are
// purely informational until an Admin reviews them (see the
// ADMIN-driven review-state store below).

import { useSyncExternalStore } from "react";

export const MATCH_TYPE = {
  EXACT: "exact",
  HIGH: "high",
  POSSIBLE: "possible",
};
export const MATCH_TYPE_LABEL = {
  exact: "Exact Match",
  high: "High Similarity",
  possible: "Possible Duplicate",
};
export const MATCH_TYPE_BADGE_CLASS = {
  exact: "is-rejected",
  high: "is-pending",
  possible: "is-pending",
};

export const MATCH_REVIEW_STATUS = {
  UNREVIEWED: "unreviewed",
  REVIEWED: "reviewed",
  DISMISSED: "dismissed",
  CONFIRMED: "confirmed",
};
export const MATCH_REVIEW_STATUS_LABEL = {
  unreviewed: "Needs Review",
  reviewed: "Reviewed",
  dismissed: "Dismissed (false positive)",
  confirmed: "Confirmed Duplicate",
};
export const MATCH_REVIEW_STATUS_BADGE_CLASS = {
  unreviewed: "is-pending",
  reviewed: "is-approved",
  dismissed: "is-approved",
  confirmed: "is-rejected",
};

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "of", "in", "on", "to", "and", "or",
  "for", "with", "as", "by", "at", "be", "which", "what", "that", "this", "it", "its",
]);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text) {
  return new Set(normalize(text).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)));
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  a.forEach((w) => {
    if (b.has(w)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Flattens series -> tests -> questions into one list, each carrying
// enough context (series/test/subject/educator-ish attribution) for the
// Tracker UI to display and link back to the source.
export function flattenQuestions(seriesList) {
  const out = [];
  (seriesList || []).forEach((series) => {
    (series.tests || []).forEach((test) => {
      (test.questions || []).forEach((q) => {
        out.push({
          questionId: q.id,
          text: q.text || "",
          type: q.type,
          subject: q.subject || series.subject,
          seriesId: series.id,
          seriesName: series.name,
          testId: test.id,
          testName: test.name,
        });
      });
    });
  });
  return out;
}

function classify(score) {
  if (score >= 0.97) return MATCH_TYPE.EXACT;
  if (score >= 0.75) return MATCH_TYPE.HIGH;
  if (score >= 0.5) return MATCH_TYPE.POSSIBLE;
  return null;
}

export function pairId(aId, bId) {
  return [aId, bId].sort().join("::");
}

// Pure function — no caching, no mutation. The caller (a page component)
// should wrap this in useMemo keyed on the series list it was given.
export function computeRepeatedQuestionMatches(seriesList) {
  const questions = flattenQuestions(seriesList).filter((q) => normalize(q.text).length > 0);
  const matches = [];
  for (let i = 0; i < questions.length; i++) {
    const a = questions[i];
    const aTokens = tokenSet(a.text);
    const aNorm = normalize(a.text);
    for (let j = i + 1; j < questions.length; j++) {
      const b = questions[j];
      if (a.questionId === b.questionId) continue;
      const bNorm = normalize(b.text);
      const score = aNorm === bNorm && aNorm.length > 0 ? 1 : jaccard(aTokens, tokenSet(b.text));
      const matchType = classify(score);
      if (!matchType) continue;
      matches.push({
        id: pairId(a.questionId, b.questionId),
        matchType,
        similarityPercent: Math.round(score * 100),
        original: a,
        matching: b,
        sameSeries: a.seriesId === b.seriesId,
        sameTest: a.testId === b.testId,
      });
    }
  }
  return matches.sort((x, y) => y.similarityPercent - x.similarityPercent);
}

// ---------- review-state store (per matched pair, Admin-driven only) ----------
let _reviewState = new Map(); // pairId -> { status, reviewedAt, note }
const _listeners = new Set();
function _emit() {
  _listeners.forEach((fn) => fn());
}
function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
let _snapshotCache = {};
function _snapshot() {
  return _snapshotCache;
}
function _syncSnapshotCache() {
  _snapshotCache = Object.fromEntries(_reviewState);
}
_syncSnapshotCache();

export function useMatchReviewState() {
  return useSyncExternalStore(_subscribe, _snapshot);
}

function setReviewState(id, status, note) {
  _reviewState.set(id, { status, reviewedAt: new Date().toISOString(), note: note || "" });
  _syncSnapshotCache();
  _emit();
}

export function markMatchReviewed(id) {
  setReviewState(id, MATCH_REVIEW_STATUS.REVIEWED);
}
export function dismissMatch(id, note) {
  setReviewState(id, MATCH_REVIEW_STATUS.DISMISSED, note);
}
export function flagMatchConfirmed(id, note) {
  setReviewState(id, MATCH_REVIEW_STATUS.CONFIRMED, note);
}

// Merges the live review-state store into a list of computed matches.
export function withReviewStatus(matches, reviewState) {
  return matches.map((m) => ({
    ...m,
    reviewStatus: (reviewState[m.id] && reviewState[m.id].status) || MATCH_REVIEW_STATUS.UNREVIEWED,
    reviewNote: (reviewState[m.id] && reviewState[m.id].note) || "",
  }));
}
