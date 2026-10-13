// Plain-language insights computed from a report. Each carries an action the
// UI turns into a button: announce (composePrefill), openQuestion, or scroll.
import { mean, round1 } from "./testSeriesPerformanceStats";

const names = (list) => list.map((s) => s.key);

export function buildInsights(report, series) {
  const out = [];
  const scored = report.scored;
  if (report.empty || !scored.length) return out;
  const pass = report.passPct;
  const asc = scored.slice().sort((a, b) => a.avgPct - b.avgPct);

  // 1. weakest section (or topic when there is only one section)
  const secs = report.sections.filter((s) => s.n > 0);
  if (secs.length >= 2) {
    const worst = secs.slice().sort((a, b) => a.avg - b.avg)[0];
    const overall = round1(mean(secs.map((s) => s.avg)));
    const gap = round1(overall - worst.avg);
    if (gap >= 4) {
      const under = scored.filter((s) => (s.sectionPct[worst.id] ?? 100) < worst.avg);
      out.push({ id: "section-gap", tone: "warning", text: `${worst.title} averages ${worst.avg}%, ${gap} points below the cohort average of ${overall}%.`, action: { kind: "announce", label: "Announce to students below average", keys: names(under), subject: `Extra practice for ${worst.title}` } });
    }
  }
  const weakTopic = report.topics.weakest[0];
  if (weakTopic && weakTopic.n >= 3 && weakTopic.acc < 55) {
    const hit = scored.filter((s) => s.weak.includes(weakTopic.topic));
    out.push({ id: "weak-topic", tone: "warning", text: `"${weakTopic.topic}" is the weakest topic at ${weakTopic.acc}% accuracy across ${weakTopic.n} responses.`, action: { kind: "announce", label: "Announce to these students", keys: names(hit.length ? hit : scored), subject: `Revision: ${weakTopic.topic}` } });
  }

  // 2. bottom 10%
  const k = Math.max(1, Math.ceil(scored.length * 0.1));
  const bottom = asc.slice(0, k);
  const below = scored.filter((s) => s.avgPct < pass);
  out.push({ id: "bottom", tone: "danger", text: `${below.length} of ${scored.length} students are below the ${pass}% pass mark. The bottom 10% average ${round1(mean(bottom.map((s) => s.avgPct)))}%.`, action: { kind: "announce", label: "Announce to the bottom 10%", keys: names(bottom), subject: "Let's get you back on track" } });

  // 3. not started / dropped off
  const idle = report.students.filter((s) => s.status === "Not started" || (s.status === "In progress" && s.finished < report.scope.tests.length));
  if (idle.length) {
    const f = report.engagement.funnel;
    const worstStep = f.length ? f.slice().sort((a, b) => (b.started - b.finished) - (a.started - a.finished))[0] : null;
    out.push({ id: "dropoff", tone: "warning", text: `${idle.length} students haven't finished every test${worstStep && worstStep.started - worstStep.finished > 0 ? `; ${worstStep.started - worstStep.finished} started "${worstStep.title}" but never submitted` : ""}.`, action: { kind: "announce", label: "Remind these students", keys: names(idle), subject: "Your test series is waiting for you" } });
  }

  // 4. suspicious question
  const sus = report.questions.find((q) => q.flags.length);
  if (sus) out.push({ id: "question", tone: "danger", text: `"${sus.label}" was flagged (${sus.flags.join(", ").toLowerCase()}). Only ${sus.correctPct}% answered it correctly.`, action: { kind: "question", label: "Review question", qid: sus.id } });

  // 5. integrity
  const fast = report.engagement.fast;
  if (fast.length) {
    const keys = Array.from(new Set(fast.map((x) => x.key)));
    out.push({ id: "fast", tone: "warning", text: `${fast.length} submissions were finished unusually fast (under 30% of the expected time) by ${keys.length} students.`, action: { kind: "scroll", label: "Review in integrity checks", target: "perf-engagement" } });
  }

  // 6. top performers / negative marking
  const topN = scored.slice().sort((a, b) => b.avgPct - a.avgPct).slice(0, k);
  if (report.negative.enabled && report.negative.lostMarks > 0) {
    const guessers = scored.slice().sort((a, b) => b.guessRate - a.guessRate).slice(0, Math.max(1, Math.ceil(scored.length * 0.2)));
    out.push({ id: "negative", tone: "info", text: `Negative marking (${report.negative.scheme || "enabled"}) cost the cohort ${report.negative.share}% of available marks; ${report.guessRate}% of attempted answers looked like guesses.`, action: { kind: "announce", label: "Share a guessing tip with likely guessers", keys: names(guessers), subject: "Tip: when to skip a question" } });
  } else {
    out.push({ id: "top", tone: "success", text: `The top 10% average ${round1(mean(topN.map((s) => s.avgPct)))}%. A quick shout-out keeps momentum up.`, action: { kind: "announce", label: "Congratulate the top 10%", keys: names(topN), subject: `Well done on ${series?.title || "the test series"}` } });
  }
  return out.slice(0, 6);
}
