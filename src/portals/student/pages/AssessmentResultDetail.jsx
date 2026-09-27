import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { AlertTriangleIcon, AwardIcon, CheckCircleIcon, ClockIcon, DownloadIcon, TargetIcon, TrendingUpIcon, XCircleIcon } from "../../../components/ui/icons";
import SectionShapes from "../../../components/common/SectionShapes";
import { computeTopicAnalysis, getSavedAttempts } from "../data/assessmentCatalog";

// Deterministic string hash (no randomness across renders) so mock
// per-question insights below stay stable for a given attempt+question.
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// There is no backend event tracking of individual question interactions
// (per-question dwell time, answer changes, etc.), so this generates
// realistic-looking but simulated per-question insights, deterministically
// seeded from the attempt id + question id — the same attempt always
// renders the same numbers rather than randomizing on every view.
function mockQuestionInsight(attemptId, question, skipped) {
  const seed = hashSeed(attemptId + "::" + question.id);
  const timeSpentSeconds = skipped ? 5 + (seed % 15) : 18 + (seed % 95);
  const changes = skipped ? 0 : seed % 3;
  const difficulty = ["Easy", "Medium", "Hard"][seed % 3];
  return { timeSpentSeconds, changes, difficulty };
}

function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function AssessmentResultDetail() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const attempts = getSavedAttempts();
  const attempt = attempts.find((item) => item.id === attemptId);
  const reviewMode = window.location.pathname.endsWith("/review");
  if (!attempt) return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><h1 className="font-display text-2xl font-bold text-text">Result not found</h1><Link className="mt-4 inline-block text-sm font-semibold text-primary" to="/student/assessments/my-results">Back to My Results</Link></div>;

  const topicAnalysis = computeTopicAnalysis(attempt);
  const { strongTopics, weakTopics, strongestTopic, weakestTopic, topicBreakdown, passingScore } = topicAnalysis;
  const previous = attempts.filter((item) => item.assessmentId === attempt.assessmentId && new Date(item.submittedAt) < new Date(attempt.submittedAt)).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];
  const duration = `${Math.floor(attempt.timeTakenSeconds / 60)}m ${attempt.timeTakenSeconds % 60}s`;
  // Test-series attempts route back through the pre-test instructions screen
  // (marks per question, anti-cheating notice, duration) rather than jumping
  // straight into the test; quiz/skill attempts have no instructions screen,
  // so those keep going directly to the runner.
  const retakeUrl = attempt.source === "skill"
    ? `/student/assessments/take/${attempt.assessmentId}?retake=1&source=skill`
    : attempt.source === "quiz"
      ? `/student/assessments/take/${attempt.assessmentId}?retake=1&source=quiz`
      : `/student/assessments/test-series/${attempt.assessmentId}`;
  const continueUrl = weakestTopic?.learnTo || attempt.questions?.find((question) => question.topic === weakestTopic?.topic)?.learnTo || "/student/my-learning";

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
    <Link to="/student/assessments/my-results" className="text-xs font-semibold text-primary">← My Results</Link>
    {reviewMode ? <>
      {(() => {
        const insights = (attempt.questions || []).map((question, index) => {
          const selected = attempt.answers?.[question.id];
          const skipped = selected === undefined;
          const correct = !skipped && selected === question.answer;
          return { question, index, selected, skipped, correct, ...mockQuestionInsight(attempt.id, question, skipped) };
        });
        const totalTime = insights.reduce((sum, item) => sum + item.timeSpentSeconds, 0);
        const avgTime = insights.length ? Math.round(totalTime / insights.length) : 0;
        const slowest = insights.slice().sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)[0];
        return <>
          <header className="detailed-report-print mt-4 rounded-2xl border border-text/10 bg-white p-5 sm:p-7 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Detailed report · Attempt {attempt.attemptNumber}</p>
                <h1 className="mt-2 font-display text-2xl font-bold text-text sm:text-3xl">{attempt.assessmentTitle}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text/55">
                  <strong className="text-text">{attempt.percentage}%</strong>
                  <StatusBadge status={attempt.passed ? "success" : "warning"}>{attempt.passed ? "Passed" : "Needs practice"}</StatusBadge>
                  <span>{attempt.correct}/{attempt.total} correct</span>
                  <span>·</span>
                  <span>Benchmark score: {passingScore}%</span>
                </div>
              </div>
              <button type="button" onClick={() => window.print()} className="report-download-btn inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-primary/90">
                <DownloadIcon className="h-4 w-4" />Download Report
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-text/10 pt-4 sm:grid-cols-4">
              <div><strong className="block font-display text-lg text-text">{attempt.correct}/{attempt.total}</strong><span className="text-[11px] text-text/45">Correct</span></div>
              <div><strong className="block font-display text-lg text-text">{attempt.skipped}</strong><span className="text-[11px] text-text/45">Skipped</span></div>
              <div><strong className="block font-display text-lg text-text">{formatDuration(avgTime)}</strong><span className="text-[11px] text-text/45">Avg. time / question</span></div>
              <div><strong className="block font-display text-lg text-text">{slowest ? `Q${slowest.index + 1}` : "—"}</strong><span className="text-[11px] text-text/45">Most time spent{slowest ? ` (${formatDuration(slowest.timeSpentSeconds)})` : ""}</span></div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-text/40">Per-question time, difficulty and answer-change counts below are simulated for presentation — the backend doesn't track individual question interaction events yet.</p>
          </header>

          {/* Topic Performance & Mastery Diagnostic (Strong and Weak Topics) */}
          <section className="detailed-report-topics mt-5 rounded-2xl border border-text/10 bg-white p-5 sm:p-7 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-text/10 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Topic Diagnostic Analysis</p>
                <h2 className="mt-1 font-display text-xl font-bold text-text">Strong Topics & Areas for Improvement</h2>
                <p className="mt-1 text-xs text-text/50">Derived from your submitted answers across {topicBreakdown.length} evaluated topic{topicBreakdown.length === 1 ? "" : "s"} ({passingScore}% passing benchmark).</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f1ef] px-3 py-1 font-semibold text-[#28756f]">
                  <CheckCircleIcon className="h-3.5 w-3.5" />{strongTopics.length} Strong {strongTopics.length === 1 ? "Topic" : "Topics"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf3ef] px-3 py-1 font-semibold text-primary">
                  <AlertTriangleIcon className="h-3.5 w-3.5" />{weakTopics.length} Weak {weakTopics.length === 1 ? "Topic" : "Topics"}
                </span>
              </div>
            </div>

            {/* Quick summary strip of all topics */}
            <div className="mt-4 flex flex-wrap gap-2">
              {topicBreakdown.map((t) => (
                <span
                  key={t.topic}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    t.isStrong
                      ? "border-[#28756f]/30 bg-[#e7f1ef] text-[#236963]"
                      : "border-primary/20 bg-[#fdf3ef] text-primary"
                  }`}
                >
                  {t.isStrong ? <CheckCircleIcon className="h-3.5 w-3.5 text-[#28756f]" /> : <AlertTriangleIcon className="h-3.5 w-3.5 text-primary" />}
                  <span>{t.topic}</span>
                  <strong className="font-bold">({t.percentage}%)</strong>
                </span>
              ))}
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              {/* Strong Topics Column */}
              <div className="rounded-xl border border-[#28756f]/20 bg-[#f5faf8] p-5">
                <div className="flex items-center justify-between gap-2 border-b border-[#28756f]/15 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#28756f] text-white">
                      <CheckCircleIcon className="h-4 w-4" />
                    </span>
                    <h3 className="font-display text-base font-bold text-text">Strong Topics</h3>
                  </div>
                  <span className="rounded-full bg-[#28756f]/10 px-2.5 py-0.5 text-xs font-bold text-[#28756f]">
                    {strongTopics.length} Mastered
                  </span>
                </div>
                <p className="mt-2 text-xs text-text/60">Topics where your accuracy met or exceeded the {passingScore}% benchmark.</p>

                {strongTopics.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {strongTopics.map((topic) => (
                      <div key={topic.topic} className="rounded-xl border border-[#28756f]/20 bg-white p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-display text-sm font-bold text-text">{topic.topic}</h4>
                            <p className="mt-0.5 text-xs text-text/50">{topic.correct} of {topic.total} questions answered correctly</p>
                          </div>
                          <span className="rounded-md bg-[#e7f1ef] px-2 py-0.5 text-xs font-bold text-[#28756f]">
                            {topic.percentage}% Mastery
                          </span>
                        </div>
                        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-text/10">
                          <div className="h-full rounded-full bg-[#28756f]" style={{ width: `${topic.percentage}%` }} />
                        </div>
                        <p className="mt-2 text-[11px] font-medium text-[#28756f]">
                          ✓ Demonstrates solid command of key concepts in this domain.
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-text/15 bg-white p-5 text-center text-xs text-text/55">
                    No topics cleared the {passingScore}% benchmark in this attempt. Review the weak topics on the right to build baseline mastery.
                  </div>
                )}
              </div>

              {/* Weak Topics Column */}
              <div className="rounded-xl border border-primary/25 bg-[#fff8f5] p-5">
                <div className="flex items-center justify-between gap-2 border-b border-primary/15 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
                      <AlertTriangleIcon className="h-4 w-4" />
                    </span>
                    <h3 className="font-display text-base font-bold text-text">Weak Topics (Areas to Improve)</h3>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                    {weakTopics.length} Need Focus
                  </span>
                </div>
                <p className="mt-2 text-xs text-text/60">Topics below {passingScore}% with incorrect or skipped answers that need revision.</p>

                {weakTopics.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {weakTopics.map((topic) => (
                      <div key={topic.topic} className="rounded-xl border border-primary/20 bg-white p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-display text-sm font-bold text-text">{topic.topic}</h4>
                            <p className="mt-0.5 text-xs text-text/50">
                              {topic.correct} of {topic.total} correct · {topic.incorrect} incorrect{topic.skipped ? `, ${topic.skipped} skipped` : ""}
                            </p>
                          </div>
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                            {topic.percentage}% Score
                          </span>
                        </div>
                        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-text/10">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${topic.percentage}%` }} />
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] font-medium text-primary">
                            ⚠ Practice recommended to improve conceptual clarity.
                          </p>
                          <Link
                            to={topic.learnTo}
                            className="report-action-link inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                          >
                            Study this topic →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-[#28756f]/30 bg-white p-5 text-center text-xs text-[#28756f]">
                    🎉 Excellent mastery! No weak topics detected — all topics met or exceeded the {passingScore}% benchmark.
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="mt-5 space-y-4">{insights.map(({ question, index, selected, skipped, correct, timeSpentSeconds, changes, difficulty }) => (
            <article key={question.id} className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-text/40">Question {index + 1} · {question.topic}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-bg px-2.5 py-1 text-[10px] font-semibold text-text/50">{difficulty}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-[10px] font-semibold text-text/50"><ClockIcon className="h-3 w-3" />{formatDuration(timeSpentSeconds)}</span>
                  {changes > 0 && <span className="rounded-full bg-bg px-2.5 py-1 text-[10px] font-semibold text-text/50">{changes} answer change{changes === 1 ? "" : "s"}</span>}
                  <StatusBadge status={skipped ? "neutral" : correct ? "success" : "danger"}>{skipped ? <span className="inline-flex items-center gap-1"><XCircleIcon className="h-3.5 w-3.5" />Skipped</span> : correct ? <span className="inline-flex items-center gap-1"><CheckCircleIcon className="h-3.5 w-3.5" />Correct</span> : <span className="inline-flex items-center gap-1"><XCircleIcon className="h-3.5 w-3.5" />Incorrect</span>}</StatusBadge>
                </div>
              </div>
              <h2 className="mt-3 font-display text-lg font-bold leading-relaxed text-text">{question.prompt}</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => <div key={optionIndex} className={`rounded-xl border px-3 py-3 text-sm ${optionIndex === question.answer ? "border-[#28756f]/30 bg-[#e7f1ef] text-[#236963]" : optionIndex === selected ? "border-primary/30 bg-primary/5 text-primary" : "border-text/10 text-text/55"}`}><span className="mr-2 font-bold">{String.fromCharCode(65 + optionIndex)}.</span>{option}{optionIndex === selected && <span className="ml-2 text-xs font-semibold">Your answer</span>}{optionIndex === question.answer && <span className="ml-2 text-xs font-semibold">Correct answer</span>}</div>)}</div>
              <div className="mt-4 rounded-xl bg-[#f8f5f1] p-4"><p className="text-xs font-bold uppercase tracking-wider text-primary/70">Why?</p><p className="mt-1 text-sm leading-6 text-text/70">{question.explanation}</p><Link to={question.learnTo || continueUrl} className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">Learn this topic →</Link></div>
            </article>
          ))}</section>
        </>;
      })()}
      <Button className="mt-6 report-download-btn" variant="secondary" onClick={() => navigate(`/student/assessments/results/${attempt.id}`)}>Back to Result</Button>
      <style>{`@media print { body * { visibility: hidden !important; } .detailed-report-print, .detailed-report-print *, .detailed-report-topics, .detailed-report-topics *, section.mt-5, section.mt-5 * { visibility: visible !important; } .report-download-btn, .report-action-link { display: none !important; } }`}</style>
    </> : <>
      <header className="relative mt-4 overflow-hidden rounded-2xl border border-text/10 bg-white shadow-sm">
        <SectionShapes variant="hero" />
        <div className={`p-6 sm:p-9 ${attempt.passed ? "bg-[#e7f1ef]" : "bg-[#fbefe7]"}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Assessment complete · Attempt {attempt.attemptNumber}</p>
              <h1 className="mt-2 font-display text-2xl font-bold text-text sm:text-3xl">{attempt.assessmentTitle}</h1>
              <p className="mt-2 text-sm text-text/55">Submitted {new Date(attempt.submittedAt).toLocaleString()}</p>
            </div>
            <StatusBadge status={attempt.passed ? "success" : "warning"}>{attempt.passed ? "Assessment Passed" : "Keep Practicing"}</StatusBadge>
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex h-32 w-32 flex-col items-center justify-center rounded-full border-[9px] border-white bg-white shadow-sm">
              <strong className="font-display text-3xl text-primary">{attempt.percentage}%</strong>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text/45">Your score</span>
            </div>
            <div>
              <p className="font-display text-xl font-bold text-text">{attempt.passed ? "Strong work — you met the passing score." : `You’re ${Math.max(0, passingScore - attempt.percentage)} points away from passing.`}</p>
              <div className="mt-2 max-w-xl space-y-1 text-sm text-text/60">
                {strongTopics.length > 0 && (
                  <p>
                    <strong className="font-semibold text-[#28756f]">Strong topics: </strong>
                    {strongTopics.map((t) => `${t.topic} (${t.percentage}%)`).join(", ")}.
                  </p>
                )}
                {weakTopics.length > 0 ? (
                  <p>
                    <strong className="font-semibold text-primary">Topics needing focus: </strong>
                    {weakTopics.map((t) => `${t.topic} (${t.percentage}%)`).join(", ")}.
                  </p>
                ) : (
                  <p className="text-[#28756f]">All topics mastered!</p>
                )}
              </div>
              {previous && <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-[#28756f]"><TrendingUpIcon className="h-4 w-4"/>Previous attempt {previous.percentage}% → {attempt.percentage}%</p>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-text/10 sm:grid-cols-5 sm:divide-y-0">
          {[[`${attempt.correct}/${attempt.total}`, "Correct answers"], [attempt.incorrect, "Incorrect"], [attempt.skipped, "Skipped"], [duration, "Time taken"], [`${passingScore}%`, "Passing score"]].map(([value, label]) => (
            <div key={label} className="p-4"><strong className="font-display text-lg text-text">{value}</strong><span className="mt-1 block text-xs text-text/45">{label}</span></div>
          ))}
        </div>
      </header>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-text/10 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TargetIcon className="h-5 w-5 text-[#71549a]"/>
              <h2 className="font-display text-xl font-bold text-text">Performance by topic</h2>
            </div>
            <span className="text-xs text-text/50">{topicBreakdown.length} Topics</span>
          </div>

          <div className="mt-5 space-y-4">
            {topicBreakdown.map((topic) => (
              <div key={topic.topic} className="rounded-xl border border-text/10 p-3.5 transition hover:border-text/20">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text">{topic.topic}</span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      topic.isStrong ? "bg-[#e7f1ef] text-[#28756f]" : "bg-[#fdf3ef] text-primary"
                    }`}>
                      {topic.isStrong ? "Strong" : "Needs Focus"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-text/50">{topic.correct}/{topic.total} correct</span>
                    <strong className="text-sm font-bold text-text">{topic.percentage}%</strong>
                  </div>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-text/10">
                  <div
                    className={`h-full rounded-full transition-all ${
                      topic.percentage >= passingScore ? "bg-[#28756f]" : topic.percentage >= 50 ? "bg-[#c39542]" : "bg-primary"
                    }`}
                    style={{ width: `${topic.percentage}%` }}
                  />
                </div>
                {!topic.isStrong && (
                  <div className="mt-2 flex justify-end">
                    <Link to={topic.learnTo} className="text-xs font-semibold text-primary hover:underline">
                      Practice {topic.topic} →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-text/10 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5 text-primary"/>
            <h2 className="font-display text-xl font-bold text-text">Topic Learning Insights</h2>
          </div>

          <div className="mt-4 space-y-3.5">
            {/* Strong Topics summary block */}
            <div className="rounded-xl border border-[#28756f]/20 bg-[#e7f1ef]/60 p-4">
              <div className="flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-[#28756f]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#28756f]">
                  Strong Topics ({strongTopics.length})
                </h3>
              </div>
              {strongTopics.length > 0 ? (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {strongTopics.map((t) => (
                      <span key={t.topic} className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#28756f] shadow-xs">
                        {t.topic} ({t.percentage}%)
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#236963]">
                    Solid conceptual grasp. You answered {strongTopics.reduce((s, t) => s + t.correct, 0)} questions correctly across these topics.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-text/60">
                  None of the topics met the {passingScore}% benchmark. Focus on the areas below to establish strengths.
                </p>
              )}
            </div>

            {/* Weak Topics summary block */}
            <div className="rounded-xl border border-primary/20 bg-[#fdf3ef]/70 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Weak Topics / Priority Focus ({weakTopics.length})
                </h3>
              </div>
              {weakTopics.length > 0 ? (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {weakTopics.map((t) => (
                      <span key={t.topic} className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-primary shadow-xs">
                        {t.topic} ({t.percentage}%)
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-text/65">
                    Targeted practice in these areas will yield the greatest score gains on your next attempt.
                  </p>
                  <Link
                    to={weakestTopic?.learnTo || continueUrl}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    Start Reviewing {weakestTopic?.topic || "Weak Topics"} →
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-[#28756f]">
                  🎉 Zero weak topics! You mastered every tested domain in this assessment.
                </p>
              )}
            </div>

            {previous && (
              <div className="rounded-xl bg-[#fcfbfa] p-3 text-xs leading-5 text-text/60">
                You scored {attempt.percentage - previous.percentage >= 0 ? `${attempt.percentage - previous.percentage}% higher` : `${Math.abs(attempt.percentage - previous.percentage)}% lower`} than your previous attempt ({previous.percentage}%).
              </div>
            )}

            {attempt.certificateEligible && (
              <div className="flex gap-3 rounded-xl bg-[#e7f1ef] p-4">
                <AwardIcon className="h-5 w-5 shrink-0 text-[#28756f]"/>
                <div>
                  <p className="text-sm font-semibold text-text">
                    {attempt.passed ? "Certificate unlocked" : "Pass this assessment to earn your certificate"}
                  </p>
                  {attempt.passed && (
                    <Link to="/student/certificates" className="mt-1 inline-block text-xs font-semibold text-[#28756f] hover:underline">
                      View Certificate →
                    </Link>
                  )}
                </div>
              </div>
            )}

            <Button
              fullWidth
              variant="secondary"
              className="mt-2"
              onClick={() => navigate(`/student/assessments/results/${attempt.id}/review`)}
            >
              View Full Report & Diagnostics →
            </Button>
          </div>
        </section>
      </div>

      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-text/10 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-[#28756f]"/>
            <h2 className="font-display text-lg font-bold text-text">Continue your learning</h2>
          </div>
          <p className="mt-1 text-sm text-text/55">Review your detailed report, practice identified weak topics, or retake the assessment.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button fullWidth={false} variant="secondary" onClick={() => navigate(`/student/assessments/results/${attempt.id}/review`)}>Detailed Report & Review</Button>
          <Button fullWidth={false} variant="secondary" onClick={() => navigate(continueUrl)}>Practice Weak Topics</Button>
          <Button fullWidth={false} onClick={() => navigate(retakeUrl)}>Retake Test</Button>
        </div>
      </section>
    </>}
  </div>;
}

