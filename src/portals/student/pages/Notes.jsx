import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { COURSES, getCourseById } from "../../../data/catalogMock";
import { getAllNotes, deleteNoteGlobal, updateNoteGlobal, useCourseProgress } from "../hooks/useCourseProgress";
import Button from "../../../components/ui/Button";
import BackButton from "../../../components/common/BackButton";
import {
  SearchIcon,
  PlusIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
  FileTextIcon,
  BookOpenIcon,
  PlayIcon,
} from "../../../components/ui/icons";
import { formatSeconds } from "../components/coursePlayer/lessonContent";

function formatNoteDate(ts) {
  try {
    return new Date(ts).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function Notes() {
  const navigate = useNavigate();
  const [allNotes, setAllNotes] = useState(getAllNotes);
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNoteCourseId, setNewNoteCourseId] = useState(COURSES[0]?.id || "c1");
  const [newNoteText, setNewNoteText] = useState("");
  const [loading] = useState(false);

  // Re-read notes on store updates
  useEffect(() => {
    function refresh() {
      setAllNotes(getAllNotes());
    }
    window.addEventListener("ul-course-progress-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("ul-course-progress-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const enrolledCourses = useMemo(() => {
    return COURSES.filter((c) => c.enrolled === true);
  }, []);

  // Filtered notes list
  const filteredNotes = useMemo(() => {
    let list = allNotes;
    if (selectedCourse !== "all") {
      list = list.filter((n) => n.courseId === selectedCourse);
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
  }, [allNotes, selectedCourse, query]);

  function handleDelete(id) {
    if (window.confirm("Are you sure you want to delete this note?")) {
      deleteNoteGlobal(id);
      setAllNotes(getAllNotes());
    }
  }

  function handleSaveEdit(id) {
    if (!editText.trim()) return;
    updateNoteGlobal(id, editText);
    setEditingId(null);
    setAllNotes(getAllNotes());
  }

  // Hook instance to add note if needed
  const activeCourseProgress = useCourseProgress(newNoteCourseId);

  function handleCreateNote(e) {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const courseObj = getCourseById(newNoteCourseId);
    const firstLesson = courseObj?.curriculum?.[0]?.lessons?.[0] || {
      id: "l1",
      title: "Course Overview",
      moduleId: "m1",
      moduleTitle: "Module 1",
    };
    activeCourseProgress.addNote(firstLesson, newNoteText);
    setNewNoteText("");
    setShowAddModal(false);
    setAllNotes(getAllNotes());
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10">
      <BackButton fallback="/student/dashboard" className="mb-4" />
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
            My Learning Notes
          </h1>
          <p className="mt-1 text-sm text-text/60">
            Search, review, and jump directly back to the moment you took each note.
          </p>
        </div>
        <Button
          fullWidth={false}
          onClick={() => setShowAddModal(true)}
          className="self-start sm:self-auto"
        >
          <PlusIcon className="mr-1.5 h-4 w-4" /> Add Note
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all notes, concepts, topics..."
            className="w-full rounded-full border border-text/10 bg-white py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text/35 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Course Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCourse("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150 ${
              selectedCourse === "all"
                ? "bg-primary text-white shadow-xs"
                : "border border-primary/20 bg-white text-primary hover:bg-primary/5"
            }`}
          >
            All Courses
          </button>
          {enrolledCourses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCourse(c.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-150 ${
                selectedCourse === c.id
                  ? "bg-primary text-white shadow-xs"
                  : "border border-primary/20 bg-white text-primary hover:bg-primary/5"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Content Grid / List */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-36 animate-pulse rounded-2xl bg-text/5" />
          <div className="h-36 animate-pulse rounded-2xl bg-text/5" />
          <div className="h-36 animate-pulse rounded-2xl bg-text/5" />
        </div>
      ) : filteredNotes.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-text/15 bg-white px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileTextIcon className="h-7 w-7" />
          </div>
          <h3 className="font-display text-lg font-bold text-text">
            {allNotes.length === 0
              ? "You haven't added any notes yet."
              : "No notes match your filter."}
          </h3>
          <p className="mt-1.5 max-w-sm text-sm text-text/60">
            {allNotes.length === 0
              ? "Take timestamped notes in the Course Player to highlight important concepts and return to them anytime."
              : "Try adjusting your search keywords or switching course filters."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {allNotes.length === 0 ? (
              <Button fullWidth={false} onClick={() => navigate("/student/dashboard")}>
                <BookOpenIcon className="mr-1.5 h-4 w-4" /> Open Course Player
              </Button>
            ) : (
              <Button
                variant="secondary"
                fullWidth={false}
                onClick={() => {
                  setQuery("");
                  setSelectedCourse("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => {
            const courseInfo = getCourseById(note.courseId);
            const isEditing = editingId === note.id;

            return (
              <div
                key={note.id}
                className="group flex flex-col justify-between rounded-2xl border border-text/10 bg-white p-5 shadow-xs transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div>
                  {/* Top Bar: Course Title & Actions */}
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {courseInfo?.title || "Course"}
                    </span>
                    <div className="flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                      {!isEditing && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(note.id);
                              setEditText(note.text);
                            }}
                            title="Edit Note"
                            className="rounded-lg p-1.5 text-text/40 hover:bg-text/5 hover:text-primary"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            title="Delete Note"
                            className="rounded-lg p-1.5 text-text/40 hover:bg-danger/10 hover:text-danger"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Note Body */}
                  {isEditing ? (
                    <div className="my-2 space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full resize-none rounded-xl border border-text/10 bg-bg p-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          fullWidth={false}
                          variant="secondary"
                          onClick={() => setEditingId(null)}
                          className="!py-1 !px-3 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          fullWidth={false}
                          onClick={() => handleSaveEdit(note.id)}
                          className="!py-1 !px-3.5 text-xs"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="font-sans text-sm font-medium leading-relaxed text-text">
                      &ldquo;{note.text}&rdquo;
                    </p>
                  )}
                </div>

                {/* Footer: Lesson breadcrumb, timestamp badge & jump link */}
                <div className="mt-4 border-t border-text/5 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-text/60">
                      <span className="truncate max-w-[180px]">
                        {note.moduleTitle || "Module"}
                      </span>
                      <ChevronRightIcon className="h-3 w-3 text-text/30" />
                      <span className="font-semibold text-text truncate max-w-[140px]">
                        {note.lessonTitle || "Lesson"}
                      </span>
                    </div>

                    {note.timestampSec != null ? (
                      <Link
                        to={`/student/courseplayer?course=${note.courseId}&lesson=${note.lessonId}&seek=${note.timestampSec}`}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-mono text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors"
                        title="Jump to timestamp in video"
                      >
                        <PlayIcon className="h-3 w-3" />
                        {formatSeconds(note.timestampSec)}
                      </Link>
                    ) : (
                      <Link
                        to={`/student/courseplayer?course=${note.courseId}&lesson=${note.lessonId}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        Open Lesson <ChevronRightIcon className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                  <div className="mt-1 text-right text-[11px] text-text/35">
                    {formatNoteDate(note.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Note Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold text-text">Add a Learning Note</h3>
            <p className="mt-1 text-xs text-text/60">
              Save key concepts, formulas, or reminders for your enrolled courses.
            </p>

            <form onSubmit={handleCreateNote} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-text">Course</label>
                <select
                  value={newNoteCourseId}
                  onChange={(e) => setNewNoteCourseId(e.target.value)}
                  className="w-full rounded-xl border border-text/10 bg-bg px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {enrolledCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-text">Note Text</label>
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="e.g. Important difference between list and tuple..."
                  rows={4}
                  required
                  autoFocus
                  className="w-full resize-none rounded-xl border border-text/10 bg-bg p-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth={false}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" fullWidth={false} disabled={!newNoteText.trim()}>
                  Save Note
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
