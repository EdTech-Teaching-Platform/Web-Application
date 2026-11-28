import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { gradingApi } from "../../services/gradingApi";
import { formatWhen } from "./gradingUtils";

// Written answers waiting for marks (20261120090000), for the teacher portal
// (/teacher/evaluate) and the admin portal (/admin/evaluations). The server
// returns only tests the caller may mark; educators see a candidate code,
// admins also the student's name.
//   <GradingQueue basePath="/teacher/evaluate" />
const TABS = [
  { key: "pending", label: "To mark" },
  { key: "draft", label: "Drafts" },
  { key: "published", label: "Marked" },
  { key: "all", label: "All" },
];
const PAGE_SIZE = 20;
const STATUS_TEXT = { pending: "Not started", draft: "Draft saved", published: "Marks published" };
const STATUS_TONE = {
  pending: "bg-amber-100 text-amber-800",
  draft: "bg-sky-100 text-sky-800",
  published: "bg-emerald-100 text-emerald-800",
};

export default function GradingQueue({ basePath, api = gradingApi, title = "Evaluate written answers" }) {
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ rows: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.list({ status, search: query, page, size: PAGE_SIZE }));
    } catch (err) {
      setError(err.message || "Couldn't load the answers to mark.");
    } finally {
      setLoading(false);
    }
  }, [api, status, query, page]);
  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE));
  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6" aria-labelledby="grading-title">
      <header>
        <h1 id="grading-title" className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Typed and uploaded (handwritten) answers from your test series. Students see their marks and feedback once you publish them.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={status === t.key}
              onClick={() => { setStatus(t.key); setPage(1); }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${status === t.key ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <form className="ml-auto flex gap-2" onSubmit={(e) => { e.preventDefault(); setQuery(search); setPage(1); }}>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search test or series"
            aria-label="Search test or series" className="w-56 rounded-full border border-slate-300 px-4 py-2 text-sm" />
          <button type="submit" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">Search</button>
        </form>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error} <button type="button" className="font-semibold underline" onClick={load}>Retry</button></p>}
      {loading && <p role="status" className="text-sm text-slate-500">Loading…</p>}
      {!loading && !error && data.rows.length === 0 && (
        <p className="rounded-2xl bg-white px-6 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          {status === "pending" ? "Nothing to mark right now." : "No attempts here."}
        </p>
      )}

      {data.rows.length > 0 && (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.rows.map((r) => {
            const st = r.evaluation_status || "pending";
            return (
              <li key={r.attempt_id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{r.test_title}</p>
                    <p className="truncate text-xs text-slate-500">{r.series_title}</p>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[st]}`}>{STATUS_TEXT[st]}</span>
                    {r.upload_window_closes_at && new Date(r.upload_window_closes_at).getTime() > Date.now() && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">Student uploading</span>
                    )}
                  </span>
                </div>
                <p className="text-sm text-slate-700">
                  <strong>{r.student_name || r.candidate}</strong>
                  {r.student_name && <span className="text-slate-500"> · {r.candidate}</span>}
                  <span className="text-slate-500"> · attempt {r.attempt_number}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Submitted {formatWhen(r.submitted_at)} · {r.written_count} written question{r.written_count === 1 ? "" : "s"}
                  {r.pending_count > 0 && ` · ${r.pending_count} to mark`}
                  {r.upload_count > 0 && ` · ${r.upload_count} uploaded file${r.upload_count === 1 ? "" : "s"}`}
                </p>
                <Link to={`${basePath}/${r.attempt_id}`}
                  className="mt-auto inline-flex w-fit rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                  {st === "published" ? "View / change marks" : "Evaluate"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-full px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">Previous</button>
          <span>Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-full px-3 py-1.5 ring-1 ring-slate-200 disabled:opacity-40">Next</button>
        </div>
      )}
    </section>
  );
}
