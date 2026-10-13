import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Switch from "../../../components/ui/Switch";
import FileDropzone from "../../../components/ui/FileDropzone";
import { BellIcon, SearchIcon, UsersIcon, CertificateIcon, CheckIcon } from "../../../components/ui/icons";
import { RESULT_TYPES } from "../data/teacherCourses";
import Select from "../../../components/ui/Select";

function newId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
function initials(name = "") {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// ResultsUploadPanel — a deliberately more formal, distinct flow from
// per-assignment grading: publishes one shared document to everyone
// enrolled, or one file per hand-picked student when results differ per
// student. The recipient search reuses the same look as the enrolled-
// student search in Scheduled Call Booking, extended to multi-select with
// checkable rows instead of picking one and being done.
export default function ResultsUploadPanel({ open, course, onClose, onPublish }) {
  const [title, setTitle] = useState("");
  const [resultType, setResultType] = useState(RESULT_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [scope, setScope] = useState("all"); // all | individual
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [perStudentFiles, setPerStudentFiles] = useState({});
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setResultType(RESULT_TYPES[0]);
    setCustomType("");
    setScope("all");
    setQuery("");
    setSelectedIds([]);
    setSharedFiles([]);
    setPerStudentFiles({});
    setNote("");
    setNotify(true);
  }, [open]);

  if (!course) return null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? course.students.filter((s) => s.name.toLowerCase().includes(q)) : course.students;
    return list.filter((s) => !selectedIds.includes(s.id));
  }, [course.students, query, selectedIds]);

  const selectedStudents = course.students.filter((s) => selectedIds.includes(s.id));
  const finalType = resultType === "Custom" ? customType.trim() : resultType;

  const canSubmit =
    title.trim() &&
    finalType &&
    (scope === "all" ? sharedFiles.length > 0 : selectedIds.length > 0 && selectedIds.every((id) => perStudentFiles[id]));

  function toggleStudent(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit() {
    const files =
      scope === "all"
        ? sharedFiles.map((f) => ({ id: newId("f"), name: f.name, size: f.size }))
        : selectedIds.map((id) => ({ id: newId("f"), name: perStudentFiles[id]?.name, size: perStudentFiles[id]?.size, studentId: id }));
    onPublish({
      id: newId("res"),
      title: title.trim(),
      resultType: finalType,
      scope,
      studentIds: scope === "individual" ? selectedIds : [],
      files,
      note: note.trim(),
      notify,
      publishedAt: new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload Marksheet / Results"
      size="lg"
      footer={
        <>
          <Button variant="primary" fullWidth={false} disabled={!canSubmit} className="px-6" onClick={submit}>
            Publish Results
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Title / label</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Mid-Term Results — October 2026"
            className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Result type</span>
          <Select
            wrapperClassName="block w-full"
            value={resultType}
            onChange={(e) => setResultType(e.target.value)}
            className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            {RESULT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          {resultType === "Custom" && (
            <input
              type="text"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="Name this result type…"
              className="mt-2.5 w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          )}
        </div>

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
            <UsersIcon className="h-3.5 w-3.5 text-muted" />
            Who is this for?
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                scope === "all" ? "border-primary bg-primary text-white" : "border-text/15 bg-surface text-muted hover:border-primary/40"
              } hover:-translate-y-0.5 hover:shadow-soft`}
            >
              All enrolled students
            </button>
            <button
              type="button"
              onClick={() => setScope("individual")}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                scope === "individual" ? "border-primary bg-primary text-white" : "border-text/15 bg-surface text-muted hover:border-primary/40"
              } hover:-translate-y-0.5 hover:shadow-soft`}
            >
              Specific students
            </button>
          </div>

          {scope === "individual" && (
            <div className="mt-3 flex flex-col gap-2.5">
              {selectedStudents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedStudents.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleStudent(s.id)}
                      className="flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-1 pr-2.5 text-xs font-semibold text-primary"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[9px]">{initials(s.name)}</span>
                      {s.name}
                      <CheckIcon className="h-3 w-3" />
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your enrolled students…"
                  className="w-full rounded-xl border border-text/15 bg-bg py-2.5 pl-10 pr-4 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <div className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-soft">
                {matches.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted">No more students match.</p>
                ) : (
                  matches.map((s) => (
                    <button key={s.id} type="button" onClick={() => toggleStudent(s.id)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-bg">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{initials(s.name)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{s.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">
            {scope === "all" ? "Result document" : "One file per selected student"}
          </span>
          {scope === "all" ? (
            <div className="flex flex-col gap-2.5">
              {sharedFiles.map((f, i) => (
                <FileDropzone
                  key={`${f.name}-${i}`}
                  label="Upload a file"
                  file={f}
                  onFileSelect={(file) => setSharedFiles((prev) => (file ? prev.map((x, idx) => (idx === i ? file : x)) : prev.filter((_, idx) => idx !== i)))}
                />
              ))}
              <FileDropzone label="Add a file" hint="or click to browse" file={null} onFileSelect={(file) => file && setSharedFiles((prev) => [...prev, file])} />
            </div>
          ) : selectedStudents.length === 0 ? (
            <p className="rounded-xl bg-bg px-4 py-3 text-xs text-muted">Select students above to attach a result file for each.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedStudents.map((s) => (
                <div key={s.id}>
                  <p className="mb-1 text-xs font-semibold text-muted">{s.name}</p>
                  <FileDropzone
                    label={`Upload ${s.name.split(" ")[0]}'s result`}
                    file={perStudentFiles[s.id] || null}
                    onFileSelect={(file) => setPerStudentFiles((prev) => ({ ...prev, [s.id]: file }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Note for students (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Great overall performance — see individual comments in the doc."
            className="w-full resize-none rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl bg-bg p-3.5">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-text">Notify recipients</span>
            <span className="mt-0.5 block text-xs text-muted">This becomes visible under each affected student's own dashboard</span>
          </span>
          <Switch checked={notify} onChange={setNotify} />
        </div>

        {notify && title.trim() && (
          <div className="rounded-2xl bg-bg p-4">
            <span className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <BellIcon className="h-3.5 w-3.5" />
              What recipients will see
            </span>
            <div className="flex items-start gap-2.5 rounded-2xl bg-white p-3.5 shadow-soft">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CertificateIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">New result published: {title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {scope === "all" ? "All enrolled students" : `${selectedIds.length} student${selectedIds.length === 1 ? "" : "s"}`} · {finalType || "Result"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
