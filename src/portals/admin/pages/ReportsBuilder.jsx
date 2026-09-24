import { Fragment, useMemo, useState } from "react";
import { IconChart, IconDownload, IconReport } from "../components/icons";
import {
  REPORT_EDUCATOR_OPTIONS,
  REPORT_FIELD_OPTIONS,
  REPORT_FORMAT_OPTIONS,
  REPORT_METHOD_OPTIONS,
  REPORT_STATUS_OPTIONS,
  REPORT_TYPE_OPTIONS,
  getReportRows,
  getReportSummary,
  getReportTrend,
} from "../data/reportsMock";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./ReportsBuilder.css";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];
const SORT_OPTIONS = [
  { value: "date-desc", label: "Date (newest first)" },
  { value: "date-asc", label: "Date (oldest first)" },
  { value: "amount-desc", label: "Amount (highest first)" },
  { value: "amount-asc", label: "Amount (lowest first)" },
  { value: "status", label: "Status" },
  { value: "educator", label: "Educator" },
];
const GROUP_OPTIONS = [
  { value: "none", label: "No grouping" },
  { value: "status", label: "Group by status" },
  { value: "educator", label: "Group by educator" },
  { value: "method", label: "Group by payment method" },
];
const PAGE_SIZE = 10;
const money = (value) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
const statusLabel = (value) => value === "all" ? "All statuses" : value[0].toUpperCase() + value.slice(1);

function fieldValue(row, key) {
  const values = { date: row.date, transaction: row.id, educator: row.educatorName, course: row.courseTitle, amount: money(row.amount), commission: money(row.commission), payout: money(row.net), status: statusLabel(row.status), method: row.method };
  return values[key];
}

function sortRows(rows, sortBy) {
  const sorted = [...rows];
  switch (sortBy) {
    case "date-asc":
      return sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
    case "amount-desc":
      return sorted.sort((a, b) => b.amount - a.amount);
    case "amount-asc":
      return sorted.sort((a, b) => a.amount - b.amount);
    case "status":
      return sorted.sort((a, b) => a.status.localeCompare(b.status) || a.date.localeCompare(b.date));
    case "educator":
      return sorted.sort((a, b) => a.educatorName.localeCompare(b.educatorName) || b.amount - a.amount);
    case "date-desc":
    default:
      return sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

function groupRows(rows, groupBy) {
  if (groupBy === "none") return [{ key: "all", label: "All results", rows }];
  const grouped = new Map();
  rows.forEach((row) => {
    const key = groupBy === "status" ? row.status : groupBy === "educator" ? row.educatorName : row.method;
    const label = groupBy === "status" ? statusLabel(row.status) : key;
    if (!grouped.has(key)) grouped.set(key, { key, label, rows: [] });
    grouped.get(key).rows.push(row);
  });
  return Array.from(grouped.values());
}

function BarChart({ points }) {
  const max = Math.max(1, ...points.map((point) => point.amount));
  return <div className="ul-report-bars" aria-label="Report amount by month">{points.map((point) => <div className="ul-report-bar-group" key={point.key}><div className="ul-report-bar-value">{money(point.amount)}</div><div className="ul-report-bar-track"><div className="ul-report-bar" style={{ height: `${Math.max(8, (point.amount / max) * 100)}%` }} /></div><span>{point.label}</span></div>)}</div>;
}

export default function ReportsBuilder() {
  const [range, setRange] = useState("30");
  const [reportType, setReportType] = useState("revenue");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [educator, setEducator] = useState("all");
  const [format, setFormat] = useState("table");
  const [sortBy, setSortBy] = useState("date-desc");
  const [groupBy, setGroupBy] = useState("none");
  const [page, setPage] = useState(1);
  const [selectedFields, setSelectedFields] = useState(REPORT_FIELD_OPTIONS.map((field) => field.key));
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [generatedAt, setGeneratedAt] = useState("Not generated yet");
  const [toast, setToast] = useState("");

  const draftRows = useMemo(() => getReportRows({ range, reportType, status, method, educator }), [range, reportType, status, method, educator]);
  const rows = useMemo(() => {
    if (!generatedConfig) return [];
    const baseRows = getReportRows(generatedConfig);
    return sortRows(baseRows, generatedConfig.sortBy);
  }, [generatedConfig]);
  const summary = useMemo(() => getReportSummary(rows), [rows]);
  const trend = useMemo(() => getReportTrend(rows), [rows]);
  const reportTitle = REPORT_TYPE_OPTIONS.find((option) => option.value === generatedConfig?.reportType)?.label || "No report generated";
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = generatedConfig ? Math.min(page, totalPages) : 1;
  const pageRows = useMemo(() => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [rows, currentPage]);
  const groupedRows = useMemo(() => groupRows(pageRows, generatedConfig?.groupBy || groupBy), [pageRows, generatedConfig, groupBy]);

  const toggleField = (key) => setSelectedFields((fields) => fields.includes(key) ? fields.filter((field) => field !== key) : [...fields, key]);
  const generateReport = () => {
    setGeneratedConfig({ range, reportType, status, method, educator, fields: selectedFields, format, sortBy, groupBy });
    setGeneratedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setPage(1);
  };
  const exportReport = () => {
    if (!generatedConfig) return;
    const exportRows = sortRows(getReportRows(generatedConfig), generatedConfig.sortBy);
    const headers = generatedConfig.fields.map((key) => REPORT_FIELD_OPTIONS.find((field) => field.key === key)?.label || key);
    const csvCell = (value) => { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
    const csv = [headers, ...exportRows.map((row) => generatedConfig.fields.map((key) => fieldValue(row, key)))].map((line) => line.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `universal-learning-${generatedConfig.reportType}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setToast(`Exported ${exportRows.length} report rows.`);
  };

  return (
    <div className="ul-report-page">
      {toast && <div className="ul-report-toast">{toast}</div>}
      <div className="ul-dash-welcome ul-report-welcome"><div><h2 className="ul-dash-welcome__title">Reports & Analytics</h2><p className="ul-dash-welcome__subtitle">Build operational reports from platform revenue, transactions, payouts and refunds.</p></div><button type="button" className="ul-btn ul-btn--ghost ul-report-export" onClick={exportReport} disabled={!generatedConfig}><IconDownload size={14} /> Export CSV</button></div>

      <section className="ul-card ul-report-builder"><div className="ul-card__head"><span className="ul-card__eyebrow"><IconReport size={14} /> Custom report builder</span><h3>Configure your report</h3></div>
        <div className="ul-report-controls">
          <label>Report type<select value={reportType} onChange={(event) => setReportType(event.target.value)}>{REPORT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Date range<select value={range} onChange={(event) => setRange(event.target.value)}>{RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{REPORT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{statusLabel(option)}</option>)}</select></label>
          <label>Payment method<select value={method} onChange={(event) => setMethod(event.target.value)}>{REPORT_METHOD_OPTIONS.map((option) => <option key={option} value={option}>{option === "all" ? "All methods" : option}</option>)}</select></label>
          <label>Educator<select value={educator} onChange={(event) => setEducator(event.target.value)}>{REPORT_EDUCATOR_OPTIONS.map((option) => <option key={option} value={option}>{option === "all" ? "All educators" : option}</option>)}</select></label>
          <label>Display format<select value={format} onChange={(event) => setFormat(event.target.value)}>{REPORT_FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Sort by<select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Group by<select value={groupBy} onChange={(event) => setGroupBy(event.target.value)}>{GROUP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
        <div className="ul-report-fields"><span className="ul-report-fields-title">Report fields</span>{REPORT_FIELD_OPTIONS.map((field) => <label key={field.key}><input type="checkbox" checked={selectedFields.includes(field.key)} onChange={() => toggleField(field.key)} />{field.label}</label>)}</div>
        <div className="ul-report-builder-footer"><span>{selectedFields.length} fields selected · {draftRows.length} draft matches</span><button type="button" className="ul-btn ul-btn--primary" onClick={generateReport}>Generate report</button><span className="ul-report-generated">{generatedAt}</span></div>
      </section>

      {generatedConfig && (
        <section className="ul-card ul-report-summary">
          <div className="ul-card__head"><span className="ul-card__eyebrow">Summary</span><h3>Key totals</h3></div>
          <div className="ul-report-summary-grid">
            <div className="ul-report-summary-item"><span>Total revenue</span><strong>{money(summary.revenue)}</strong></div>
            <div className="ul-report-summary-item"><span>Total commission</span><strong>{money(summary.commission)}</strong></div>
            <div className="ul-report-summary-item"><span>Educator payout</span><strong>{money(summary.payout)}</strong></div>
            <div className="ul-report-summary-item"><span>Refunds</span><strong>{money(summary.refunds)}</strong></div>
            <div className="ul-report-summary-item"><span>Matching rows</span><strong>{summary.transactions}</strong></div>
          </div>
        </section>
      )}

      <section className="ul-card ul-report-preview"><div className="ul-card__head"><span className="ul-card__eyebrow"><IconChart size={14} /> Generated report</span><h3>{reportTitle}</h3></div>{generatedConfig?.format === "chart" ? <BarChart points={trend} /> : <div className="ul-edu-table-scroll"><table className="ul-edu-table"><thead><tr>{(generatedConfig?.fields || []).map((key) => <th key={key}>{REPORT_FIELD_OPTIONS.find((field) => field.key === key)?.label}</th>)}</tr></thead><tbody>{generatedConfig ? groupedRows.map((group) => <Fragment key={group.key}>{group.key !== "all" && <tr className="ul-report-group-row"><td colSpan={generatedConfig.fields.length}>{group.label}</td></tr>}{group.rows.map((row) => <tr key={row.id}>{generatedConfig.fields.map((key) => <td key={key}>{fieldValue(row, key)}</td>)}</tr>)}</Fragment>) : <tr><td colSpan="1" className="ul-edu-empty">Configure your report and click Generate report.</td></tr>}{generatedConfig && rows.length === 0 && <tr><td colSpan={Math.max(1, generatedConfig.fields.length)} className="ul-edu-empty">No records match the generated report filters.</td></tr>}</tbody></table></div>}<p className="ul-report-preview-note">{generatedConfig ? `Showing ${Math.min(rows.length, (currentPage - 1) * PAGE_SIZE + pageRows.length)} of ${rows.length} matching records.` : "The preview will appear after you generate the report."}</p>{generatedConfig && rows.length > PAGE_SIZE && <div className="ul-report-pagination"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1}>Previous</button><span>Page {currentPage} of {totalPages}</span><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage === totalPages}>Next</button></div>}</section>
    </div>
  );
}
