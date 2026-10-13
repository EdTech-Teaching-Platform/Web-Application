// Step 3 — Questions overview. Lists every test with its live question
// count / points / validity and opens the dedicated TestQuestionBuilder
// panel (also reachable from Structure) for the one you pick.
import { QuizIcon, CheckIcon, AlertTriangleIcon, LockIcon } from "../../../components/ui/icons";
import { questionErrors, quizPoints, topicsCovered, seriesQuestionCount, seriesPoints } from "../data/testSeriesData";

export default function TestSeriesQuestionsStep({ series, onOpenQuestions, onGoStep, readOnly = false }) {
  const tests = series.sections.flatMap((s) => s.tests.map((t) => ({ ...t, sectionTitle: s.title })));
  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-surface px-8 py-14 text-center shadow-soft">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
          <QuizIcon className="h-6 w-6" />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-text">No tests to fill yet</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted">Add at least one section with a test in Structure, then come back to write questions.</p>
        <button type="button" onClick={() => onGoStep(1)} className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-soft">
          Go to Structure
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl bg-surface px-5 py-4 shadow-soft ring-1 ring-text/[0.06]">
        <Stat label="Tests" value={tests.length} />
        <Stat label="Questions" value={seriesQuestionCount(series)} />
        <Stat label="Total points" value={seriesPoints(series)} />
        <Stat label="Topics" value={topicsCovered(series).length} />
      </div>
      <div className="overflow-hidden rounded-3xl bg-surface shadow-soft">
        <ul className="divide-y divide-line">
          {tests.map((t) => {
            const bad = t.questions.filter((q) => questionErrors(q).length).length;
            const empty = t.questions.length === 0;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${empty || bad ? "bg-pastel-orange text-pastel-orange-ink" : "bg-pastel-sage text-pastel-sage-ink"}`}>
                  {empty || bad ? <AlertTriangleIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-text">
                    {t.title || "Untitled test"}
                    {t.locked && <LockIcon className="h-3 w-3 text-muted" />}
                  </p>
                  <p className="text-xs text-muted">
                    {t.sectionTitle || "Untitled section"} · {t.type} · {t.questions.length} question{t.questions.length === 1 ? "" : "s"} · {quizPoints(t.questions)} pts
                    {empty && <span className="ml-1.5 font-semibold text-pastel-orange-ink">No questions yet</span>}
                    {!empty && bad > 0 && <span className="ml-1.5 font-semibold text-danger">{bad} need fixing</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenQuestions(t.id)}
                  className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:shadow-glow-primary"
                >
                  {readOnly ? "View questions" : empty ? "Add questions" : "Edit questions"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-lg font-bold text-text">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
