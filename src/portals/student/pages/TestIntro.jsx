// Test instructions (student_get_test_intro). The student must tick
// "I understand" before starting; the runner (/student/test/:testId/take)
// starts or resumes the attempt on the server.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Checkbox from "../../../components/ui/Checkbox";
import StatCard from "../../../components/ui/StatCard";
import { AlertTriangleIcon, BookOpenIcon, ClockIcon, FileTextIcon, TargetIcon } from "../../../components/ui/icons";
import { ErrorState, LoadingState } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { attemptApi } from "../services/attemptApi";
import { isAuthError } from "../services/studentRpc";
import { formatDate, formatMinutes, formatPercent } from "../utils/format";
import { SeriesBanner } from "../components/TestImages";

const BLOCKED = {
  no_questions: "This test has no questions yet.",
  not_open_yet: "This test hasn't opened yet.",
  closed: "This test has closed.",
  attempts_exhausted: "You have used all your attempts for this test.",
};

export function windowRules(limit) {
  return [
    "The test opens in full screen. Stay on this tab until you submit.",
    "Leaving the tab or window, exiting full screen, copying, pasting or right-clicking is recorded as a violation.",
    `You can have up to ${limit} ${limit === 1 ? "violation" : "violations"}. One more and your test is submitted automatically.`,
    "The timer runs on our server. It keeps running if you close the page, and the test is submitted when time is up.",
    "Answers save automatically as you go. If you get disconnected, reopen the test to continue.",
  ];
}

const WIDE = "mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:px-8";
const SURFACE = "rounded-2xl bg-white ring-1 ring-(--lp-line) shadow-[0_1px_2px_rgb(15_17_21/0.04)]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue-deep)";

function FactCell({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3.5 bg-white p-4 sm:p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-(--lp-blue-tint) text-(--lp-blue-deep)" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <StatCard
        value={value}
        label={label}
        className="min-w-0 gap-0.5"
        valueClassName="font-display text-xl font-semibold leading-none tabular-nums tracking-tight text-(--lp-ink) sm:text-2xl"
        labelClassName="truncate text-xs font-medium text-(--lp-muted)"
      />
    </div>
  );
}

function Bullets({ children, className = "" }) {
  return <ul className={`mt-4 space-y-3 text-sm leading-relaxed ${className}`}>{children}</ul>;
}

function Bullet({ children, tone = "bg-(--lp-blue-deep)" }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export default function TestIntro() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const { data: intro, error, loading, reload } = useStudentData(() => attemptApi.intro(testId), testId);

  if (loading) return <div className={WIDE}><LoadingState label="Loading test" /></div>;
  if (error) {
    return (
      <div className={WIDE}>
        <ErrorState
          error={error}
          onRetry={isAuthError(error) ? undefined : reload}
          title={isAuthError(error) ? "Enrol to take this test" : "Couldn't load this test"}
        />
        <Link to="/student/test-series" className="text-sm font-semibold text-(--lp-blue-deep) hover:underline">Browse test series</Link>
      </div>
    );
  }

  const resuming = Boolean(intro.in_progress_attempt_id);
  const instructions = [intro.series_instructions, intro.test_instructions, intro.instructions_extra].filter(Boolean);

  return (
    <div className={`${WIDE} pb-12`}>
      <Link to={`/student/test-series/${intro.series_id}`} className={`inline-flex w-fit items-center gap-2 rounded-full py-1 text-sm font-semibold text-(--lp-muted) transition-colors duration-150 hover:text-(--lp-ink) ${FOCUS}`}>
        ← {intro.series_title}
      </Link>
      <SeriesBanner path={intro.series_cover_path} className="rounded-2xl" />

      <header className={`${SURFACE} p-5 sm:p-8`}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--lp-muted)">Before you start</p>
        <h1 className="mt-2 break-words font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-(--lp-ink) sm:text-[2.25rem]">{intro.test_title}</h1>
      </header>

      <section className={`${SURFACE} grid grid-cols-2 gap-px overflow-hidden bg-(--lp-line) sm:grid-cols-4`} aria-label="Test facts">
        <FactCell icon={ClockIcon} value={formatMinutes(intro.duration_mins)} label="Duration" />
        <FactCell icon={FileTextIcon} value={intro.questions_count} label="Questions" />
        <FactCell icon={BookOpenIcon} value={intro.total_marks} label="Marks" />
        <FactCell icon={TargetIcon} value={formatPercent(intro.passing_percentage)} label="To pass" />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-6">
          <section className={`${SURFACE} p-5 sm:p-6`}>
            <h2 className="font-display text-base font-semibold tracking-tight text-(--lp-ink) sm:text-lg">Marking</h2>
            <Bullets className="text-(--lp-muted)">
              <Bullet>
                {intro.negative_marking
                  ? `Wrong answers lose marks (up to ${intro.max_negative_marks} per question). Unanswered questions lose nothing.`
                  : "No negative marking. Unanswered questions score 0."}
              </Bullet>
              <Bullet>Questions with several correct options score only when you pick all of them and nothing else.</Bullet>
              <Bullet>Written answers are reviewed by a teacher; they are marked “pending review” in your report until then.</Bullet>
              <Bullet>Attempts: {intro.attempts_used} used of {intro.attempts_allowed} ({intro.attempts_remaining} left).</Bullet>
              {intro.closes_at && <Bullet>Closes {formatDate(intro.closes_at, true)}.</Bullet>}
            </Bullets>
            {(intro.sections?.length ?? 0) > 1 && (
              <p className="mt-4 border-t border-(--lp-line) pt-4 text-sm text-(--lp-muted)">
                Sections: {intro.sections.map((s) => `${s.name} (${s.questions})`).join(", ")}
              </p>
            )}
          </section>

          {instructions.length > 0 && (
            <section className={`${SURFACE} p-5 sm:p-6`}>
              <h2 className="font-display text-base font-semibold tracking-tight text-(--lp-ink) sm:text-lg">Instructions</h2>
              {instructions.map((text, i) => (
                <p key={i} className="mt-3 whitespace-pre-line text-sm leading-relaxed text-(--lp-muted)">{text}</p>
              ))}
            </section>
          )}

          <section className="rounded-2xl bg-warning/10 p-5 ring-1 ring-warning/25 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-warning ring-1 ring-warning/25" aria-hidden="true">
                <AlertTriangleIcon className="h-[18px] w-[18px]" />
              </span>
              <h2 className="font-display text-base font-semibold tracking-tight text-(--lp-ink) sm:text-lg">Rules while the test is open</h2>
            </div>
            <Bullets className="text-text/80">
              {windowRules(intro.violation_limit).map((rule) => <Bullet key={rule} tone="bg-warning">{rule}</Bullet>)}
            </Bullets>
          </section>
        </div>

        <aside className={`${SURFACE} p-5 sm:p-6 lg:sticky lg:top-24`} aria-label="Start this test">
          {intro.can_start ? (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight text-(--lp-ink) sm:text-lg">{resuming ? "Ready to continue?" : "Ready to begin?"}</h2>
                <p className="mt-1 text-sm text-(--lp-muted)">Read the rules, confirm below, then start when you're ready.</p>
              </div>
              <Checkbox
                label="I understand the rules. Violations are recorded and can submit my test automatically."
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <Button fullWidth disabled={!agreed} onClick={() => navigate(`/student/test/${testId}/take`)}>
                {resuming ? "Resume test" : "Start test"}
              </Button>
            </div>
          ) : (
            <p role="status" className="text-sm leading-relaxed text-(--lp-muted)">
              {BLOCKED[intro.blocked_reason] ?? "You can't start this test right now."}
              {intro.blocked_reason === "not_open_yet" && intro.opens_at && <> It opens {formatDate(intro.opens_at, true)}.</>}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
