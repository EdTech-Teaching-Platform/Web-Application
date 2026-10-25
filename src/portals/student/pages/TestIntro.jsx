// Test instructions (student_get_test_intro). The student must tick
// "I understand" before starting; the runner (/student/test/:testId/take)
// starts or resumes the attempt on the server.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Checkbox from "../../../components/ui/Checkbox";
import StatCard from "../../../components/ui/StatCard";
import { ErrorState, LoadingState, PAGE, PageHeader } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { attemptApi } from "../services/attemptApi";
import { isAuthError } from "../services/studentRpc";
import { formatDate, formatMinutes, formatPercent } from "../utils/format";

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

export default function TestIntro() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const { data: intro, error, loading, reload } = useStudentData(() => attemptApi.intro(testId), testId);

  if (loading) return <div className={PAGE}><LoadingState label="Loading test" /></div>;
  if (error) {
    return (
      <div className={PAGE}>
        <ErrorState
          error={error}
          onRetry={isAuthError(error) ? undefined : reload}
          title={isAuthError(error) ? "Enrol to take this test" : "Couldn't load this test"}
        />
        <Link to="/student/test-series" className="text-sm font-medium text-primary hover:underline">Browse test series</Link>
      </div>
    );
  }

  const resuming = Boolean(intro.in_progress_attempt_id);
  const instructions = [intro.series_instructions, intro.test_instructions, intro.instructions_extra].filter(Boolean);

  return (
    <div className={PAGE}>
      <Link to={`/student/test-series/${intro.series_id}`} className="text-sm font-medium text-primary hover:underline">
        ← {intro.series_title}
      </Link>
      <PageHeader eyebrow="Before you start" title={intro.test_title} />

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Test facts">
        <StatCard value={formatMinutes(intro.duration_mins)} label="Duration" />
        <StatCard value={intro.questions_count} label="Questions" />
        <StatCard value={intro.total_marks} label="Marks" />
        <StatCard value={formatPercent(intro.passing_percentage)} label="To pass" />
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-text/10">
        <h2 className="font-display text-lg font-semibold text-text">Marking</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text/70">
          <li>
            {intro.negative_marking
              ? `Wrong answers lose marks (up to ${intro.max_negative_marks} per question). Unanswered questions lose nothing.`
              : "No negative marking. Unanswered questions score 0."}
          </li>
          <li>Questions with several correct options score only when you pick all of them and nothing else.</li>
          <li>Written answers are reviewed by a teacher; they are marked “pending review” in your report until then.</li>
          <li>Attempts: {intro.attempts_used} used of {intro.attempts_allowed} ({intro.attempts_remaining} left).</li>
          {intro.closes_at && <li>Closes {formatDate(intro.closes_at, true)}.</li>}
        </ul>
        {(intro.sections?.length ?? 0) > 1 && (
          <p className="mt-3 text-sm text-text/60">
            Sections: {intro.sections.map((s) => `${s.name} (${s.questions})`).join(", ")}
          </p>
        )}
      </section>

      {instructions.length > 0 && (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-text/10">
          <h2 className="font-display text-lg font-semibold text-text">Instructions</h2>
          {instructions.map((text, i) => (
            <p key={i} className="mt-2 whitespace-pre-line text-sm text-text/70">{text}</p>
          ))}
        </section>
      )}

      <section className="rounded-2xl bg-warning/10 p-5">
        <h2 className="font-display text-lg font-semibold text-text">Rules while the test is open</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text/80">
          {windowRules(intro.violation_limit).map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </section>

      {intro.can_start ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Checkbox
            label="I understand the rules. Violations are recorded and can submit my test automatically."
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <Button fullWidth={false} disabled={!agreed} onClick={() => navigate(`/student/test/${testId}/take`)}>
            {resuming ? "Resume test" : "Start test"}
          </Button>
        </div>
      ) : (
        <p role="status" className="rounded-xl bg-text/5 px-4 py-3 text-sm text-text/70">
          {BLOCKED[intro.blocked_reason] ?? "You can't start this test right now."}
          {intro.blocked_reason === "not_open_yet" && intro.opens_at && <> It opens {formatDate(intro.opens_at, true)}.</>}
        </p>
      )}
    </div>
  );
}
