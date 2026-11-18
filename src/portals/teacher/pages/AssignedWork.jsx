// /teacher/assigned and /teacher/assigned/:assignmentId: test series an admin
// assigned to this educator (educator_list_assignments /
// educator_get_assignment). Start (educator_start_assignment) creates the test
// shell, then the educator builds it in the shared manage view and publishes
// the series directly (adm_publish_test_series), which completes the
// assignment. QA 18 Nov: an assignment can ask for several tests (the admin's
// "Number of tests"); the list and the detail show how many are required,
// created and still to go, and "Add test 2 of 2" creates the next one
// (educator_add_assignment_test, 20261118090000).
import { useCallback, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useRpc } from "../../admin/hooks/useRpc";
import { testSeriesApi } from "../../admin/services/testSeriesApi";
import { educatorApi } from "../services/educatorApi";
import { Empty, ErrorState, Loading, PageCard, StatusPill } from "../components/PageState";
import { formatDate } from "../utils/format";
import { assignmentTestProgress } from "../utils/assignmentProgress";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function TestsProgressBar({ progress }) {
  const pct = Math.min(100, Math.round((progress.created / progress.required) * 100));
  return (
    <div className="mt-2" aria-hidden="true">
      <div className="h-1.5 overflow-hidden rounded-full bg-(--lp-grey)">
        <div className="h-full rounded-full bg-(--lp-ink)" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

export function AssignmentList({ api = educatorApi }) {
  const [filter, setFilter] = useState("open");
  const request = useCallback(() => api.listAssignments(filter), [api, filter]);
  const { data, loading, error, refetch } = useRpc(request);
  const rows = data || [];

  return (
    <PageCard title="Assigned to you">
      <div role="tablist" aria-label="Filter assignments" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${filter === f.key ? "bg-(--lp-ink) text-white" : "bg-(--lp-grey) text-(--lp-ink)"}`}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      {loading && <Loading label="Loading assignments…" />}
      {error && <ErrorState error={error} onRetry={() => refetch().catch(() => {})} />}
      {!loading && !error && rows.length === 0 && <Empty>No assignments here.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((a) => (
          <article key={a.id} className="rounded-2xl border border-(--lp-line) p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{a.test_name}</h3>
                <p className="truncate text-xs text-(--lp-muted)">{a.code} · {a.series_name} · {a.subject}</p>
              </div>
              <StatusPill status={a.display_status} />
            </div>
            <p className="mt-3 text-sm">Due <strong>{formatDate(a.deadline)}</strong> · {a.question_count} questions · {a.duration_minutes} min</p>
            {(() => {
              const p = assignmentTestProgress(a);
              if (!p) return null;
              return (
                <div className="mt-2 text-sm">
                  <p><strong>{plural(p.required, "test")} to create</strong> · {p.created} created · {p.remaining} to go</p>
                  <TestsProgressBar progress={p} />
                </div>
              );
            })()}
            {a.comment_count > 0 && <p className="mt-1 text-xs text-(--lp-muted)">{a.comment_count} comment{a.comment_count === 1 ? "" : "s"}</p>}
            <Link to={`/teacher/assigned/${a.id}`} className="mt-3 inline-flex rounded-full bg-(--lp-ink) px-4 py-2 text-sm font-semibold text-white">Open</Link>
          </article>
        ))}
      </div>
    </PageCard>
  );
}

export function AssignmentDetail({ api = educatorApi, seriesApi = testSeriesApi }) {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const request = useCallback(() => api.getAssignment(assignmentId), [api, assignmentId]);
  const { data, loading, error, refetch } = useRpc(request);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [comment, setComment] = useState("");

  if (loading && !data) return <Loading label="Loading the assignment…" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch().catch(() => {})} />;
  const { assignment: a, series, test, history = [], comments = [] } = data;
  const closed = ["completed", "cancelled", "rejected"].includes(a.status);
  const progress = assignmentTestProgress(a);
  const canAddTest = progress && !closed && progress.remaining > 0 && progress.created > 0
    && ["in_progress", "revision_requested"].includes(a.status);

  const run = async (key, fn, done) => {
    if (busy) return;
    setBusy(key);
    setMessage("");
    try {
      await fn();
      setMessage(done);
      await refetch();
      return true;
    } catch (err) {
      setMessage(err.message || "That didn't work. Try again.");
      return false;
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/teacher/assigned" className="text-sm font-semibold text-(--lp-blue) underline">← All assignments</Link>
      {message && <p role="status" className="rounded-2xl bg-(--lp-blue-tint) p-3 text-sm">{message}</p>}

      <PageCard
        title={a.test_name}
        action={<StatusPill status={a.display_status} />}
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {[["Series", series?.title], ["Subject", a.subject], ["Deadline", formatDate(a.deadline)],
            ...(progress ? [["Tests to create", progress.required]] : []), ["Questions", progress && progress.required > 1 ? `${a.question_count} in total` : a.question_count],
            ["Question types", a.question_type_mix], ["Difficulty", a.difficulty], ["Total marks", a.total_marks],
            ["Duration", `${a.duration_minutes} min`], ["Topics", (a.topics || []).join(", ") || "—"]].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-(--lp-muted)">{k}</dt><dd className="font-medium">{v ?? "—"}</dd></div>
          ))}
        </dl>
        {a.instructions && <p className="mt-4 whitespace-pre-line rounded-2xl bg-(--lp-grey) p-3 text-sm">{a.instructions}</p>}
        {a.decision_reason && <p className="mt-3 text-sm"><strong>Admin feedback:</strong> {a.decision_reason}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          {!closed && a.status === "assigned" && (
            <button type="button" className="rounded-full bg-(--lp-ink) px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={!!busy}
              onClick={() => run("start", () => api.startAssignment(a.id), "Started. Your test is ready to build.")}>
              {busy === "start" ? "Starting…" : "Start"}
            </button>
          )}
          {test && !(progress && progress.tests.length > 1) && (
            <button type="button" className="rounded-full bg-(--lp-ink) px-5 py-2.5 text-sm font-semibold text-white"
              onClick={() => navigate(`/teacher/test-series/${a.series_id}/tests/${test.id}`)}>Open the builder</button>
          )}
          {!closed && test && series?.status !== "published" && (
            <button type="button" className="rounded-full border border-(--lp-ink) px-5 py-2.5 text-sm font-semibold disabled:opacity-50" disabled={!!busy}
              onClick={() => run("publish", () => seriesApi.publishSeries(a.series_id), "Published. The assignment is complete.")}>
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
          )}
        </div>
      </PageCard>

      {progress && (
        <PageCard title="Tests for this assignment" action={<span className="text-sm font-semibold">{progress.created} of {progress.required} created</span>}>
          <p className="text-sm">
            The admin asked for <strong>{plural(progress.required, "test")}</strong>.{" "}
            {progress.remaining > 0 ? `${plural(progress.remaining, "test")} still to create.` : "All of them are created."}
            {progress.created > 0 && ` ${progress.published} of ${progress.created} published.`}
          </p>
          <div role="progressbar" aria-label="Tests created" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={progress.created}>
            <TestsProgressBar progress={progress} />
          </div>
          {progress.tests.length > 0 && (
            <ul className="mt-4 divide-y divide-(--lp-line) rounded-2xl border border-(--lp-line)">
              {progress.tests.map((t, i) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold">Test {i + 1}: {t.title}</span>
                    <span className="block text-xs text-(--lp-muted)">{plural(Number(t.questions_count || 0), "question")} · {t.status === "published" ? "Published" : "Draft"}</span>
                  </span>
                  <Link to={`/teacher/test-series/${a.series_id}/tests/${t.id}`} className="rounded-full border border-(--lp-ink) px-4 py-1.5 text-xs font-semibold">Open the builder</Link>
                </li>
              ))}
            </ul>
          )}
          {progress.created === 0 && !closed && a.status === "assigned" && (
            <p className="mt-3 text-xs text-(--lp-muted)">Press Start to create the first test.</p>
          )}
          {canAddTest && (
            <button type="button" className="mt-4 rounded-full bg-(--lp-ink) px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={!!busy}
              onClick={() => run("add", () => api.addAssignmentTest(a.id), `Test ${progress.created + 1} of ${progress.required} created.`)}>
              {busy === "add" ? "Creating…" : `Add test ${progress.created + 1} of ${progress.required}`}
            </button>
          )}
        </PageCard>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <PageCard title="Comments">
          {comments.length === 0 ? <Empty>No comments yet.</Empty> : (
            <ul className="space-y-3 text-sm">
              {comments.map((c) => (
                <li key={c.id} className={`rounded-2xl p-3 ${c.from === "admin" ? "bg-(--lp-yellow)/25" : "bg-(--lp-grey)"}`}>
                  <p className="text-xs font-semibold">{c.from === "admin" ? "Admin" : "You"} · {formatDate(c.created_at, true)}{c.question_ref ? ` · ${c.question_ref}` : ""}</p>
                  <p className="mt-1 whitespace-pre-line">{c.comment}</p>
                </li>
              ))}
            </ul>
          )}
          {!closed && (
            <form className="mt-4" onSubmit={(e) => { e.preventDefault(); if (comment.trim()) run("comment", () => api.addAssignmentComment(a.id, comment.trim()), "Comment added.").then((ok) => ok && setComment("")); }}>
              <label htmlFor="asg-comment" className="mb-1 block text-sm font-medium">Add a comment</label>
              <textarea id="asg-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)}
                className="w-full rounded-2xl border border-(--lp-line) p-3 text-sm" />
              <button type="submit" className="mt-2 rounded-full bg-(--lp-ink) px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!comment.trim() || !!busy}>
                {busy === "comment" ? "Sending…" : "Send"}
              </button>
            </form>
          )}
        </PageCard>
        <PageCard title="History">
          {history.length === 0 ? <Empty>No history yet.</Empty> : (
            <ol className="space-y-2 text-sm">
              {history.map((h, i) => (
                <li key={`${h.at}-${i}`}><strong>{h.action}</strong> <span className="text-xs text-(--lp-muted)">{formatDate(h.at, true)}</span>{h.note ? <p className="text-xs text-(--lp-muted)">{h.note}</p> : null}</li>
              ))}
            </ol>
          )}
        </PageCard>
      </div>
    </div>
  );
}
