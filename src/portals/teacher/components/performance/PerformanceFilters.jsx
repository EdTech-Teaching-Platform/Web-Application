import { useState } from "react";
import Select from "../../../../components/ui/Select";
import Input from "../../../../components/ui/Input";
import Button from "../../../../components/ui/Button";
import SegmentedControl from "../../../../components/ui/SegmentedControl";
import Modal from "../../../../components/ui/Modal";
import { DownloadIcon } from "../../../../components/ui/icons";
import { ATTEMPT_MODES, BATCHES, addDays } from "../../data/testSeriesPerformanceData";

const selectCls = "w-full rounded-full border border-text/12 bg-surface py-2.5 pl-4 pr-9 text-sm font-medium text-text";
const RANGES = [
  { key: "all", label: "All time" },
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "custom", label: "Custom range" },
];
const MODE_HINT = { First: "each student's first attempt", Best: "each student's best attempt", Latest: "each student's latest attempt" };

function Field({ label, children, className = "" }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="eyebrow-muted">{label}</span>
      {children}
    </label>
  );
}

export function filterSummary(filters, tests, courseOptions) {
  const t = filters.testId === "all" ? "All tests" : tests.find((x) => x.id === filters.testId)?.title || "One test";
  const c = filters.cohort === "all" ? "All students" : filters.cohort.startsWith("group:") ? filters.cohort.slice(6) : courseOptions.find((o) => `course:${o.id}` === filters.cohort)?.title || "Course";
  const d = filters.from || filters.to ? `${filters.from || "start"} to ${filters.to || "today"}` : "All dates";
  return [t, c, d, `${filters.mode} attempt`];
}

export default function PerformanceFilters({ filters, onChange, tests, today, seriesOptions, seriesId, onSeries, courseOptions, onExport, disabled }) {
  const [range, setRange] = useState(filters.from || filters.to ? "custom" : "all");
  const set = (patch) => onChange({ ...filters, ...patch });

  function pickRange(key) {
    setRange(key);
    if (key === "all") set({ from: "", to: "" });
    else if (key === "custom") set({ from: filters.from || addDays(today, -30), to: filters.to || today });
    else set({ from: addDays(today, -Number(key)), to: today });
  }

  return (
    <section aria-label="Performance filters" className="rounded-3xl bg-surface p-5 shadow-soft sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Field label="Test series">
          <Select wrapperClassName="block" className={selectCls} value={seriesId} onChange={(e) => onSeries(e.target.value)} aria-label="Test series">
            {seriesOptions.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </Select>
        </Field>
        <Field label="Test">
          <Select wrapperClassName="block" className={selectCls} value={filters.testId} onChange={(e) => set({ testId: e.target.value })} aria-label="Test" disabled={disabled}>
            <option value="all">All tests</option>
            {tests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </Select>
        </Field>
        <Field label="Date range">
          <Select wrapperClassName="block" className={selectCls} value={range} onChange={(e) => pickRange(e.target.value)} aria-label="Date range" disabled={disabled}>
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
        </Field>
        <Field label="Cohort">
          <Select wrapperClassName="block" className={selectCls} value={filters.cohort} onChange={(e) => set({ cohort: e.target.value })} aria-label="Cohort" disabled={disabled}>
            <option value="all">All students</option>
            {courseOptions.length > 0 && (
              <optgroup label="By course">
                {courseOptions.map((c) => <option key={c.id} value={`course:${c.id}`}>{c.title}</option>)}
              </optgroup>
            )}
            <optgroup label="By group">
              {BATCHES.map((b) => <option key={b} value={`group:${b}`}>{b}</option>)}
            </optgroup>
          </Select>
        </Field>
        <Field label="Attempt counted">
          <SegmentedControl options={ATTEMPT_MODES} value={filters.mode} onChange={(mode) => set({ mode })} className="w-full justify-between [&>button]:flex-1 [&>button]:px-2" />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          {range === "custom" && (
            <>
              <Input type="date" label="From" value={filters.from} max={filters.to || today} onChange={(e) => set({ from: e.target.value })} containerClassName="w-40" />
              <Input type="date" label="To" value={filters.to} min={filters.from} max={today} onChange={(e) => set({ to: e.target.value })} containerClassName="w-40" />
            </>
          )}
          <p className="max-w-md pb-2 text-xs text-muted">Scores use {MODE_HINT[filters.mode]} on each test. Retakes still count toward the attempts column.</p>
        </div>
        <Button fullWidth={false} className="px-5 py-2.5 text-xs" onClick={onExport} disabled={disabled}>
          <DownloadIcon className="h-3.5 w-3.5" />
          Export report
        </Button>
      </div>
    </section>
  );
}

export function ExportModal({ open, onClose, summary, rowCount, onExport, busy, error }) {
  const [format, setFormat] = useState("Excel (.xlsx)");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export performance report"
      size="lg"
      footer={
        <>
          <Button fullWidth={false} className="px-6" disabled={busy || rowCount === 0} aria-busy={busy} onClick={() => onExport(format.startsWith("CSV") ? "csv" : "xlsx")}>
            {busy ? <span className="motion-safe:animate-pulse">Generating…</span> : error ? "Retry" : `Export ${format.split(" ")[0]}`}
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>Cancel</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 pb-4">
        <div>
          <div className="eyebrow mb-2">Scope: current filters</div>
          <ul className="flex flex-wrap gap-2">
            {summary.map((s) => <li key={s} className="rounded-full bg-primary/[0.07] px-3 py-1 text-xs font-semibold text-text">{s}</li>)}
          </ul>
          <p className="mt-2 text-sm text-muted">{rowCount} student{rowCount === 1 ? "" : "s"} in this view.</p>
        </div>
        <div>
          <div className="eyebrow mb-2">Format</div>
          <SegmentedControl options={["Excel (.xlsx)", "CSV (.csv)"]} value={format} onChange={setFormat} />
          <p className="mt-2 text-xs text-muted">
            {format.startsWith("CSV") ? "One row per student with per-test scores, accuracy, time, attempts and topic chips." : "Four sheets: Summary, Students, Questions and Topics."}
          </p>
        </div>
        {error && <p role="alert" className="rounded-2xl bg-danger/[0.07] px-4 py-3 text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
