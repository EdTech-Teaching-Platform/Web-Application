import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Checkbox from "../../../components/ui/Checkbox";
import Select from "../../../components/ui/Select";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import { AlertTriangleIcon } from "../../../components/ui/icons";
import {
  EXPORT_COLUMNS,
  buildCourseGroups,
  buildFlatTable,
  buildGroupedTables,
  groupedSheetsToCsvRows,
} from "../data/studentCourseGroups";
import { buildXlsx, toCsv, downloadBlob } from "../data/spreadsheetExport";

const FORMAT_LABELS = { xlsx: "Excel (.xlsx)", csv: "CSV (.csv)" };
const DEFAULT_COLUMNS = EXPORT_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key);

function todayStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function slug(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

// Export options panel. Row sources come straight from the page: the same
// roster / by-course groups the screen renders, so "Current filtered view"
// is exactly what the educator is looking at (search, status chip, course
// filter and sort included).
export default function StudentExportPanel({
  open,
  onClose,
  roster,
  courses,
  filteredEntries,
  filteredGroups,
  byCourseView,
  initialCourseId,
  initialScope,
  selectionEntries,
  onSuccess,
}) {
  const [scope, setScope] = useState("all");
  const [courseId, setCourseId] = useState("");
  const [format, setFormat] = useState("xlsx");
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const allGroups = useMemo(() => buildCourseGroups(roster, courses), [roster, courses]);

  useEffect(() => {
    if (!open) return;
    const firstWithStudents = allGroups.find((g) => g.total > 0) || allGroups[0];
    setScope(initialCourseId ? "course" : initialScope === "selection" && selectionEntries?.length ? "selection" : "all");
    setCourseId(initialCourseId || firstWithStudents?.course.id || "");
    setFormat("xlsx");
    setColumns(DEFAULT_COLUMNS);
    setError("");
    setGenerating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCourseId, initialScope]);

  const grouped = scope === "course" || (byCourseView && scope !== "selection");

  // The concrete source for the chosen scope.
  const source = useMemo(() => {
    if (scope === "course") return { groups: allGroups.filter((g) => g.course.id === courseId) };
    if (scope === "selection") return { entries: selectionEntries || [] };
    if (scope === "filtered") return grouped ? { groups: filteredGroups } : { entries: filteredEntries };
    return grouped ? { groups: allGroups } : { entries: roster };
  }, [scope, courseId, grouped, allGroups, filteredGroups, filteredEntries, roster, selectionEntries]);

  const rowCount = source.groups ? source.groups.reduce((n, g) => n + g.items.length, 0) : source.entries.length;
  const allCount = grouped ? allGroups.reduce((n, g) => n + g.total, 0) : roster.length;
  const filteredCount = byCourseView ? filteredGroups.reduce((n, g) => n + g.items.length, 0) : filteredEntries.length;
  const courseTotal = allGroups.find((g) => g.course.id === courseId)?.total ?? 0;

  const effectiveColumns = columns.filter((k) => !(grouped && k === "courses"));
  const noColumns = effectiveColumns.length === 0;
  const canExport = !noColumns && rowCount > 0 && !generating && !(scope === "course" && !courseId);

  function toggleColumn(key) {
    setColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function build() {
    const keys = columns;
    if (source.groups) {
      const { headers, sheets } = buildGroupedTables(source.groups, keys);
      if (format === "csv") return { blob: toCsv(groupedSheetsToCsvRows(sheets), headers), ext: "csv" };
      return { blob: buildXlsx(sheets.length ? sheets : [{ name: "Students", headers, rows: [] }]), ext: "xlsx" };
    }
    const { headers, rows } = buildFlatTable(source.entries, keys);
    if (format === "csv") return { blob: toCsv(rows, headers), ext: "csv" };
    return { blob: buildXlsx([{ name: "Students", headers, rows }]), ext: "xlsx" };
  }

  async function handleExport() {
    if (!canExport) return;
    setError("");
    setGenerating(true);
    try {
      // Brief pause so the generating state is visible; the build itself is synchronous.
      await new Promise((resolve) => window.setTimeout(resolve, 750));
      const { blob, ext } = build();
      const courseTitle = scope === "course" ? allGroups.find((g) => g.course.id === courseId)?.course.title : "";
      const filename = `student-roster${courseTitle ? `-${slug(courseTitle)}` : ""}-${todayStamp()}.${ext}`;
      downloadBlob(blob, filename);
      if (!mounted.current) return;
      onSuccess?.(filename);
      onClose();
    } catch (err) {
      if (mounted.current) setError(err?.message ? `Couldn't generate the file: ${err.message}` : "Couldn't generate the file.");
    } finally {
      if (mounted.current) setGenerating(false);
    }
  }

  const scopes = [
    ...(selectionEntries?.length ? [{ key: "selection", title: "Selected students", hint: `${selectionEntries.length} student${selectionEntries.length === 1 ? "" : "s"} you ticked in the roster` }] : []),
    { key: "all", title: "All students", hint: `${allCount} ${grouped ? "enrollment" : "student"}${allCount === 1 ? "" : "s"}` },
    { key: "filtered", title: "Current filtered view", hint: `${filteredCount} matching your search, filters and sort` },
    { key: "course", title: "This course only", hint: courseId ? `${courseTotal} student${courseTotal === 1 ? "" : "s"} in the selected course` : "Pick a course" },
  ];

  const layoutNote = grouped
    ? format === "xlsx"
      ? "One worksheet per course; each row is one student's enrollment in that course."
      : "One row per enrollment, with a Course column, grouped by course."
    : "One row per student, combined across all of their courses.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export students"
      size="lg"
      mobileFullScreen
      footer={
        <>
          <Button fullWidth={false} className="px-6" disabled={!canExport} onClick={handleExport} aria-busy={generating}>
            {generating ? <span className="motion-safe:animate-pulse">Generating…</span> : error ? "Retry" : `Export ${FORMAT_LABELS[format].split(" ")[0]}`}
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        <fieldset>
          <legend className="eyebrow mb-2">What to export</legend>
          <div role="radiogroup" className="flex flex-col gap-2">
            {scopes.map((s) => {
              const active = scope === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setScope(s.key)}
                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${active ? "border-primary bg-primary/[0.06]" : "border-text/10 bg-white hover:border-primary/30"}`}
                >
                  <span className="block text-sm font-semibold text-text">{s.title}</span>
                  <span className="block text-xs text-muted">{s.hint}</span>
                </button>
              );
            })}
          </div>
          {scope === "course" && (
            <Select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              aria-label="Course to export"
              wrapperClassName="mt-3 block w-full"
              className="w-full rounded-full border border-text/15 bg-white px-4 py-2.5 pr-9 text-sm font-medium text-text focus:border-primary/40"
            >
              {allGroups.map((g) => (
                <option key={g.course.id} value={g.course.id}>
                  {g.course.title} ({g.total})
                </option>
              ))}
            </Select>
          )}
        </fieldset>

        <div>
          <div className="eyebrow mb-2">File format</div>
          <SegmentedControl
            options={["xlsx", "csv"].map((f) => FORMAT_LABELS[f])}
            value={FORMAT_LABELS[format]}
            onChange={(label) => setFormat(label === FORMAT_LABELS.csv ? "csv" : "xlsx")}
          />
          <p className="mt-2 text-xs text-muted">{layoutNote}</p>
        </div>

        <fieldset>
          <div className="mb-2 flex items-center justify-between gap-3">
            <legend className="eyebrow">Columns</legend>
            <div className="flex items-center gap-1 text-xs font-semibold text-primary">
              <button type="button" onClick={() => setColumns(EXPORT_COLUMNS.map((c) => c.key))} className="rounded-full px-2.5 py-1 hover:bg-primary/[0.07]">
                Select all
              </button>
              <button type="button" onClick={() => setColumns([])} className="rounded-full px-2.5 py-1 hover:bg-primary/[0.07]">
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
            {EXPORT_COLUMNS.map((c) =>
              grouped && c.key === "courses" ? (
                <Checkbox key={c.key} label="Course (always included)" checked disabled readOnly />
              ) : (
                <Checkbox key={c.key} label={c.label} checked={columns.includes(c.key)} onChange={() => toggleColumn(c.key)} />
              )
            )}
          </div>
          <p className="mt-2 text-xs text-muted">Email isn't available — student records don't store an email address.</p>
          {noColumns && (
            <p role="alert" className="mt-2 text-xs font-semibold text-danger">
              Select at least one column to export.
            </p>
          )}
        </fieldset>

        {rowCount === 0 && !noColumns && <p className="rounded-2xl bg-bg px-4 py-3 text-sm text-muted">There are no students in this selection to export.</p>}

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-2xl bg-danger/[0.07] px-4 py-3 text-sm text-danger">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{error}</p>
              <button type="button" onClick={handleExport} disabled={generating} className="mt-1 text-xs font-bold underline underline-offset-2">
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
