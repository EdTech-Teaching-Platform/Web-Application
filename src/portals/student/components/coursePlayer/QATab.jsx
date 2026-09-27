import { useMemo, useState } from "react";
import Button from "../../../../components/ui/Button";
import StatusBadge from "../../../../components/ui/StatusBadge";
import { SearchIcon, BellIcon, CheckIcon } from "../../../../components/ui/icons";

function formatAskedAt(ts) {
  try {
    return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

// Course Q&A (spec Section 4) — course-scoped (a question can optionally
// reference the lesson it was asked from, but the list itself spans the
// whole course, since that's how the spec's own example reads: "COURSE
// Q&A" as a tab, not a per-lesson list). No instructor-messaging backend
// exists yet — `useCourseQA` is the localStorage seam; asking a question
// here stores it unanswered, same "real UI, mock data" approach as the
// rest of this build.
export default function QATab({ lesson, questions, onAsk, onToggleFollow }) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter((item) => item.text.toLowerCase().includes(q));
  }, [questions, query]);

  function submit() {
    if (!draft.trim()) return;
    onAsk(draft, lesson?.id);
    setDraft("");
    setAsking(false);
  }

  return (
    <div className="rounded-2xl bg-white p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text/45">Course Q&A</p>

      <div className="relative mb-4">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions..."
          className="w-full rounded-full border border-text/10 bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-text/35 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-text/45">No questions match your search.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((q) => (
            <li key={q.id} className="rounded-xl bg-bg p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-text">{q.text}</p>
                <button
                  type="button"
                  onClick={() => onToggleFollow(q.id)}
                  aria-label={q.following ? "Unfollow question" : "Follow question"}
                  aria-pressed={q.following}
                  className={`shrink-0 transition-colors duration-150 ${q.following ? "text-primary" : "text-text/30 hover:text-text/50"}`}
                >
                  <BellIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-text/40">
                <span>{q.askedBy}</span>
                <span>·</span>
                <span>{formatAskedAt(q.askedAt)}</span>
              </div>

              {q.answer ? (
                <div className="mt-3 rounded-lg bg-white p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-success">
                    <CheckIcon className="h-3.5 w-3.5" /> Instructor · Answered
                  </p>
                  <p className="text-sm text-text/70">{q.answer.text}</p>
                </div>
              ) : (
                <div className="mt-3">
                  <StatusBadge status="warning">Awaiting answer</StatusBadge>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-text/10 pt-4">
        {asking ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What would you like to ask about this course?"
              rows={3}
              autoFocus
              className="w-full resize-none rounded-xl border border-text/10 bg-bg px-3 py-2.5 text-sm text-text placeholder:text-text/35 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-2">
              <Button fullWidth={false} variant="secondary" onClick={() => { setAsking(false); setDraft(""); }}>
                Cancel
              </Button>
              <Button fullWidth={false} onClick={submit} disabled={!draft.trim()}>
                Submit Question
              </Button>
            </div>
          </div>
        ) : (
          <Button fullWidth={false} onClick={() => setAsking(true)}>
            Ask a Question
          </Button>
        )}
      </div>
    </div>
  );
}
