// "Question preview" card in Review & Publish: every test's questions rendered
// the way a student will see them (stem, optional image, options with their
// optional images), read-only, with the keyed answer marked for the educator.
// Uses the same QuestionImage renderer as the student test runner, so an
// uploaded image is guaranteed to look identical here and there.
import { useMemo, useState } from "react";
import QuestionImage from "../../../components/testseries/QuestionImage";
import Select from "../../../components/ui/Select";
import EmptyState from "../../../components/ui/EmptyState";
import { CheckIcon, QuizIcon } from "../../../components/ui/icons";
import { isSubjective, questionTypeMeta, stripHtml } from "../data/testSeriesData";

const PAGE = 5;

function PreviewQuestion({ q, index }) {
  const meta = questionTypeMeta(q.type);
  const options = q.options || [];
  const subjective = isSubjective(q.type);
  return (
    <li className="rounded-2xl bg-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-text">Q{index + 1}</span>
        <span className="rounded-full bg-primary/[0.07] px-2.5 py-0.5 text-[11px] font-semibold text-primary">{meta.short}</span>
        {(q.image || options.some((o) => o.image)) && <span className="rounded-full bg-pastel-lavender px-2.5 py-0.5 text-[11px] font-semibold text-pastel-lavender-ink">Has image</span>}
        <span className="ml-auto text-xs font-semibold text-muted">{Number(q.points) || 0} mark{Number(q.points) === 1 ? "" : "s"}</span>
      </div>
      <div
        className="mt-2 text-sm leading-relaxed text-text [&_p]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5"
        dangerouslySetInnerHTML={{ __html: stripHtml(q.text) ? q.text : "<p><em>Question text not written yet.</em></p>" }}
      />
      {q.image && <QuestionImage image={q.image} className="mt-3" />}

      {options.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {options.map((o, i) => (
            <li key={o.id} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${o.correct ? "border-success/50 bg-success/[0.07]" : "border-text/[0.1] bg-surface"}`}>
              {q.type !== "true_false" && <span className="font-bold text-muted">{String.fromCharCode(65 + i)}.</span>}
              <span className="flex min-w-0 flex-1 flex-col gap-2 break-words text-text">
                {(o.text || !o.image) && <span>{o.text || <em className="text-muted">Option text not written yet</em>}</span>}
                {o.image && <QuestionImage image={o.image} variant="option" />}
              </span>
              {o.correct && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-success">
                  <CheckIcon className="h-3.5 w-3.5" />
                  Correct
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!options.length && !subjective && (
        <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs text-muted">Accepted answer: <span className="font-semibold text-text">{String(q.correctAnswer || "not set")}</span></p>
      )}
      {subjective && <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs text-muted">Students type a written answer{q.wordLimit ? ` (about ${q.wordLimit} words)` : ""}. You grade it with the rubric.</p>}
    </li>
  );
}

export default function TestSeriesQuestionPreview({ series }) {
  const tests = useMemo(() => series.sections.flatMap((s) => s.tests.map((t) => ({ ...t, sectionTitle: s.title }))).filter((t) => t.questions.length > 0), [series.sections]);
  const [testId, setTestId] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const current = tests.find((t) => t.id === testId) || tests[0];

  if (!current) {
    return <EmptyState icon={QuizIcon} heading="No questions to preview yet" message="Add questions in the Questions step and they will appear here exactly as students see them." />;
  }
  const withImages = current.questions.filter((q) => q.image || (q.options || []).some((o) => o.image)).length;
  const list = current.questions.slice(0, shown);
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-xs font-semibold text-muted">
          Test
          <Select
            aria-label="Preview test"
            value={current.id}
            onChange={(e) => { setTestId(e.target.value); setShown(PAGE); }}
            className="max-w-[16rem] rounded-full border border-text/12 bg-surface py-2 pl-3 pr-8 text-sm font-medium text-text"
          >
            {tests.map((t) => (
              <option key={t.id} value={t.id}>{t.title || "Untitled test"}</option>
            ))}
          </Select>
        </label>
        <p className="text-xs text-muted">
          {current.questions.length} question{current.questions.length === 1 ? "" : "s"}
          {withImages > 0 ? ` · ${withImages} with images` : ""} · {current.sectionTitle || "Untitled section"}
        </p>
      </div>
      <ol key={current.id} className="mt-4 flex flex-col gap-3 motion-safe:animate-[rise-in_0.3s_ease-out_both]">
        {list.map((q, i) => (
          <PreviewQuestion key={q.id} q={q} index={i} />
        ))}
      </ol>
      {current.questions.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="mt-4 rounded-full border border-primary/25 px-5 py-2 text-xs font-semibold text-text transition-colors hover:border-primary/60">
          Show more ({current.questions.length - shown} left)
        </button>
      )}
    </div>
  );
}
