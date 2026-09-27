import { useMemo, useState } from "react";
import { IconChart, IconDownload, IconReport } from "../components/icons";
import {
  REPORT_CATEGORY_OPTIONS,
  REPORT_COURSE_OPTIONS,
  REPORT_EDUCATOR_OPTIONS,
  REPORT_FIELD_OPTIONS,
  REPORT_REGION_OPTIONS,
  REPORT_STATUS_OPTIONS,
  REPORT_STUDENT_OPTIONS,
  REPORT_TEST_SERIES_OPTIONS,
  REPORT_TYPE_COLUMNS,
  REPORT_TYPE_FIELDS,
  REPORT_TYPE_OPTIONS,
  getReportRows,
  getReportTableRows,
  getReportSummary,
} from "../data/reportsMock";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./ReportsBuilder.css";

const RANGE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];
const PAGE_SIZE = 10;
const money = (value) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
const statusLabel = (value) => (value === "none" ? "None" : value === "all" ? "All statuses" : value[0].toUpperCase() + value.slice(1));
const optionLabel = (value, fallback) => (value === "none" ? "None" : value === "all" ? fallback : value);

// Data-driven definition of every dependent filter field — which options it
// offers and how to label them. Report Type decides which of these are
// actually shown (see REPORT_TYPE_FIELDS in reportsMock.js), so this list
// stays in one place instead of being duplicated per-field in the JSX.
const FIELD_DEFS = [
  { key: "status", label: "Status", options: REPORT_STATUS_OPTIONS, labelFor: (v) => statusLabel(v) },
  { key: "category", label: "Category / Subject", options: REPORT_CATEGORY_OPTIONS, labelFor: (v) => optionLabel(v, "All categories") },
  { key: "course", label: "Course", options: REPORT_COURSE_OPTIONS, labelFor: (v) => optionLabel(v, "All courses") },
  { key: "testSeries", label: "Test series", options: REPORT_TEST_SERIES_OPTIONS, labelFor: (v) => optionLabel(v, "All test series") },
  { key: "educator", label: "Educator", options: REPORT_EDUCATOR_OPTIONS, labelFor: (v) => optionLabel(v, "All educators") },
  { key: "region", label: "Region / Branch", options: REPORT_REGION_OPTIONS, labelFor: (v) => optionLabel(v, "All regions") },
  { key: "student", label: "Student / Learner", options: REPORT_STUDENT_OPTIONS, labelFor: (v) => optionLabel(v, "All students") },
];
const ALL_FIELD_KEYS = FIELD_DEFS.map((f) => f.key);

function fieldValue(row, key) {
  if (key === "amount") return money(row.amount);
  if (key === "revenue") return money(row.revenue);
  if (key === "status") return statusLabel(row.status);
  if (key === "course") return row.course ?? row.courseTitle;
  if (key === "educator") return row.educator ?? row.educatorName;
  if (key === "student") return row.student ?? row.studentName;
  if (key === "testSeries") return row.testSeries ?? row.testSeriesName ?? "—";
  if (key === "category") return row.category ?? "—";
  const value = row[key];
  return value === undefined || value === null ? "—" : value;
}

export default function ReportsBuilder() {
  const [range, setRange] = useState("none");
  const [reportType, setReportType] = useState("none");
  // Every dependent field defaults to "none" (unselected) until a Report
  // Type is picked; fields the chosen type doesn't use are auto-set to
  // "all" (irrelevant to that report, never blocks Generate).
  const [fieldValues, setFieldValues] = useState(() => Object.fromEntries(ALL_FIELD_KEYS.map((key) => [key, "none"])));
  const [page, setPage] = useState(1);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [generatedAt, setGeneratedAt] = useState("Not generated yet");
  const [toast, setToast] = useState("");

  const visibleFieldKeys = REPORT_TYPE_FIELDS[reportType] || [];

  const handleReportTypeChange = (value) => {
    setReportType(value);
    const nextVisible = REPORT_TYPE_FIELDS[value] || [];
    setFieldValues(Object.fromEntries(ALL_FIELD_KEYS.map((key) => [key, nextVisible.includes(key) ? "none" : "all"])));
  };
  const handleFieldChange = (key, value) => setFieldValues((prev) => ({ ...prev, [key]: value }));

  const filters = { range, reportType, ...fieldValues };
  const canGenerate = reportType !== "none" && range !== "none" && visibleFieldKeys.every((key) => fieldValues[key] !== "none");
  const draftRows = useMemo(() => (canGenerate ? getReportRows(filters) : []), [range, reportType, fieldValues, canGenerate]);

  const columns = REPORT_TYPE_COLUMNS[generatedConfig?.reportType] || [];
  const filteredRows = useMemo(() => (generatedConfig ? getReportRows(generatedConfig) : []), [generatedConfig]);
  const rows = useMemo(() => (generatedConfig ? getReportTableRows(generatedConfig.reportType, filteredRows) : []), [generatedConfig, filteredRows]);
  const summary = useMemo(() => (generatedConfig ? getReportSummary(generatedConfig.reportType, rows, filteredRows) : []), [generatedConfig, rows, filteredRows]);
  const reportTitle = REPORT_TYPE_OPTIONS.find((option) => option.value === generatedConfig?.reportType)?.label || "No report generated";
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = generatedConfig ? Math.min(page, totalPages) : 1;
  const pageRows = useMemo(() => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [rows, currentPage]);

  const generateReport = () => {
    if (!canGenerate) return;
    setGeneratedConfig({ ...filters });
    setGeneratedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setPage(1);
  };

  const exportCSV = () => {
    if (!generatedConfig) return;
    const exportColumns = REPORT_TYPE_COLUMNS[generatedConfig.reportType] || [];
    const headers = exportColumns.map((key) => REPORT_FIELD_OPTIONS.find((field) => field.key === key)?.label || key);
    const csvCell = (value) => { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
    const csv = [headers, ...rows.map((row) => exportColumns.map((key) => fieldValue(row, key)))].map((line) => line.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `universal-learning-${generatedConfig.reportType}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast(`Exported ${rows.length} report rows as CSV.`);
  };

  return (
    <div className="ul-report-page">
      {toast && <div className="ul-report-toast">{toast}</div>}
      <div className="ul-dash-welcome ul-report-welcome"><div><h2 className="ul-dash-welcome__title">Reports & Analytics</h2><p className="ul-dash-welcome__subtitle">Build operational reports from platform enrollment, courses, educators and students.</p></div></div>

      <section className="ul-card ul-report-builder"><div className="ul-card__head"><span className="ul-card__eyebrow"><IconReport size={14} /> Custom report builder</span><h3>Configure your report</h3></div>
        <div className="ul-report-controls">
          <label>Report type<select value={reportType} onChange={(event) => handleReportTypeChange(event.target.value)}>{REPORT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Date range<select value={range} onChange={(event) => setRange(event.target.value)}>{RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {FIELD_DEFS.filter((field) => visibleFieldKeys.includes(field.key)).map((field) => (
            <label key={field.key}>
              {field.label}
              <select value={fieldValues[field.key]} onChange={(event) => handleFieldChange(field.key, event.target.value)}>
                {field.options.map((option) => <option key={option} value={option}>{field.labelFor(option)}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="ul-report-builder-footer"><span>{reportType === "none" ? "Select a report type to see its filters" : canGenerate ? `${draftRows.length} matching records` : "Select every field above (not None) to enable Generate report"}</span><button type="button" className="ul-btn ul-btn--primary ul-report-generate-btn" onClick={generateReport} disabled={!canGenerate}>Generate report</button><span className="ul-report-generated">{generatedAt}</span></div>
      </section>

      {generatedConfig && (
        <section className="ul-card ul-report-summary">
          <div className="ul-card__head"><span className="ul-card__eyebrow">Summary</span><h3>Key totals</h3></div>
          <div className="ul-report-summary-grid">
            {summary.map((item) => (
              <div className="ul-report-summary-item" key={item.label}><span>{item.label}</span><strong>{item.money ? money(item.value) : item.value}</strong></div>
            ))}
          </div>
        </section>
      )}

      <section className="ul-card ul-report-preview">
        <div className="ul-card__head"><span className="ul-card__eyebrow"><IconChart size={14} /> Generated report</span><h3>{reportTitle}</h3><div className="ul-report-export-group"><button type="button" className="ul-btn ul-btn--ghost ul-report-csv-btn" onClick={exportCSV} disabled={!generatedConfig}><IconDownload size={14} /> CSV</button></div></div>
        <div className="ul-edu-table-scroll"><table className="ul-edu-table"><thead><tr>{columns.map((key) => <th key={key}>{REPORT_FIELD_OPTIONS.find((field) => field.key === key)?.label}</th>)}</tr></thead><tbody>{generatedConfig ? pageRows.map((row) => <tr key={row.id}>{columns.map((key) => <td key={key}>{fieldValue(row, key)}</td>)}</tr>) : <tr><td colSpan="1" className="ul-edu-empty">Configure your report and click Generate report.</td></tr>}{generatedConfig && rows.length === 0 && <tr><td colSpan={Math.max(1, columns.length)} className="ul-edu-empty">No records match the generated report filters.</td></tr>}</tbody></table></div>
        <p className="ul-report-preview-note">{generatedConfig ? `Showing ${Math.min(rows.length, (currentPage - 1) * PAGE_SIZE + pageRows.length)} of ${rows.length} matching records.` : "The preview will appear after you generate the report."}</p>
        {generatedConfig && rows.length > PAGE_SIZE && <div className="ul-report-pagination"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>Previous</button><span>Page {currentPage} of {totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>Next</button></div>}
      </section>
    </div>
  );
}
