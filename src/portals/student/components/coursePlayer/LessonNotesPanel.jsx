import { useMemo, useState } from "react";
import Button from "../../../../components/ui/Button";
import { SearchIcon, PlusIcon, ChevronRightIcon, PencilIcon, TrashIcon, ClockIcon } from "../../../../components/ui/icons";
import { formatSeconds } from "./lessonContent";

const SCOPES = [
  { id: "lesson", label: "This Lesson" },
  { id: "module", label: "This Module" },
  { id: "course", label: "Entire Course" },
];

function formatNoteDate(ts) {
  try {
    return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

// Notes tab (spec Sections 1–2) — add/edit/delete/search/filter, and
// timestamped notes for video lessons.
// Scoped to the current COURSE, with a scope filter for "This Lesson / This Module / Entire Course".
// Clicking a timestamp seeks the video to approximately that point.
export default function LessonNotesPanel({
  currentLesson,
  notes = [],
  canTimestamp,
  currentVideoTime = 0,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onJumpToNote,
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("lesson");
  const [draft, setDraft] = useState("");
  const [attachTimestamp, setAttachTimestamp] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const filtered = useMemo(() => {
    let list = Array.isArray(notes) ? notes : [];
    if (scope === "lesson" && currentLesson) {
      list = list.filter((n) => n.lessonId === currentLesson.id);
    } else if (scope === "module" && currentLesson) {
      list = list.filter((n) => n.moduleId === currentLesson.moduleId);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          (n.text && n.text.toLowerCase().includes(q)) ||
          (n.lessonTitle && n.lessonTitle.toLowerCase().includes(q)) ||
          (n.moduleTitle && n.moduleTitle.toLowerCase().includes(q))
      );
    }
    return list;
  }, [notes, scope, query, currentLesson]);

  function submitNote() {
    if (!draft.trim()) return;
    const timeToTag = canTimestamp && attachTimestamp ? currentVideoTime : undefined;
    onAddNote(draft, timeToTag);
    setDraft("");
    setIsAdding(false);
  }

  function startEdit(note) {
    setEditingId(note.id);
    setEditDraft(note.text);
  }

  function saveEdit(noteId) {
    if (!editDraft.trim()) return;
    onUpdateNote(noteId, editDraft);
    setEditingId(null);
  }

  return (
    <div className="rounded-2xl border border-text/10 bg-white p-5 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-bold tracking-tight text-text">MY NOTES</h3>
          <p className="text-xs text-text/50">Private notes for your learning and revision</p>
        </div>
        {!isAdding && (
          <Button
            variant="secondary"
            fullWidth={false}
            onClick={() => setIsAdding(true)}
            className="!py-1.5 !px-3 text-xs"
          >
            <PlusIcon className="h-3.5 w-3.5 mr-1" /> Add Note
          </Button>
        )}
      </div>

      {/* Search notes */}
      <div className="relative mb-3">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes..."
          className="w-full rounded-full border border-text/10 bg-bg py-2 pl-9 pr-3 text-sm text-text placeholder:text-text/35 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Filter pills: This Lesson / This Module / Entire Course */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScope(s.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ${
              scope === s.id
                ? "bg-primary text-white"
                : "border border-primary/20 bg-bg text-primary hover:bg-primary/5"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-text/40">
          {filtered.length} {filtered.length === 1 ? "note" : "notes"}
        </span>
      </div>

      {/* Add note drawer/inline form */}
      {isAdding && (
        <div className="mb-4 rounded-xl border border-primary/20 bg-bg p-3.5 transition-all">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text/60">
            New Note for {currentLesson?.title || "Current Lesson"}
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Jot down a thought, question, or key takeaway..."
            rows={3}
            autoFocus
            className="w-full resize-none rounded-lg border border-text/10 bg-white p-2.5 text-sm text-text placeholder:text-text/35 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
            {canTimestamp ? (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-text/60">
                <input
                  type="checkbox"
                  checked={attachTimestamp}
                  onChange={(e) => setAttachTimestamp(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {formatSeconds(currentVideoTime || 0)}
                </span>
              </label>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                fullWidth={false}
                onClick={() => {
                  setIsAdding(false);
                  setDraft("");
                }}
                className="!py-1.5 !px-3 text-xs"
              >
                Cancel
              </Button>
              <Button
                fullWidth={false}
                onClick={submitNote}
                disabled={!draft.trim()}
                className="!py-1.5 !px-3.5 text-xs"
              >
                Save Note
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notes list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-text/15 bg-bg/50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-text/60">
            {notes.length === 0
              ? "You haven't added any notes yet."
              : "No notes match your search."}
          </p>
          <p className="mt-1 text-xs text-text/40">
            Take timestamped notes while watching lessons to quickly review later.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((n) => (
            <li
              key={n.id}
              className="group rounded-xl border border-text/5 bg-bg p-3.5 transition-colors hover:border-primary/20 hover:bg-white"
            >
              {editingId === n.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={2}
                    autoFocus
                    className="w-full resize-none rounded-lg border border-text/10 bg-white p-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      fullWidth={false}
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                      className="!py-1 !px-2.5 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      fullWidth={false}
                      onClick={() => saveEdit(n.id)}
                      disabled={!editDraft.trim()}
                      className="!py-1 !px-3 text-xs"
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {n.timestampSec != null && (
                        <button
                          type="button"
                          onClick={() => onJumpToNote?.(n)}
                          title="Click to jump to this point in the video"
                          className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold tabular-nums text-primary transition-colors hover:bg-primary hover:text-white"
                        >
                          <ClockIcon className="h-3 w-3" />
                          {formatSeconds(n.timestampSec)}
                        </button>
                      )}
                      <p className="text-sm font-medium leading-relaxed text-text">
                        &ldquo;{n.text}&rdquo;
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-80 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => startEdit(n)}
                        aria-label="Edit note"
                        title="Edit note"
                        className="rounded-md p-1 text-text/40 hover:bg-text/5 hover:text-primary"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote?.(n.id)}
                        aria-label="Delete note"
                        title="Delete note"
                        className="rounded-md p-1 text-text/40 hover:bg-danger/10 hover:text-danger"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Module -> Lesson breadcrumb */}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-text/5 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onJumpToNote?.(n)}
                      className="flex items-center gap-1 text-text/45 hover:text-primary"
                    >
                      <span>{n.moduleTitle || "Module"}</span>
                      <ChevronRightIcon className="h-3 w-3 text-text/30" />
                      <span className="font-medium text-text/70">{n.lessonTitle || "Lesson"}</span>
                    </button>
                    <span className="text-text/35">{formatNoteDate(n.createdAt)}</span>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
