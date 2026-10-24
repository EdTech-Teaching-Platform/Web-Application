import { useEffect, useState } from "react";
import { IconChart, IconDownload, IconReport } from "../components/icons";
import { reportsApi } from "../services/reportsApi";
import { useRpc } from "../hooks/useRpc";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./ReportsBuilder.css";

const money = (v) => `₹${Math.round(Number(v) || 0).toLocaleString("en-IN")}`;
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export default function ReportsBuilder() {
  const [type, setType] = useState("");
  const [range, setRange] = useState("last_30_days");
  const [filters, setFilters] = useState({});
  const [run, setRun] = useState(null);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const options = useRpc(() => reportsApi.options());
  const filterOptions = useRpc(() => reportsApi.filters(type), { immediate: Boolean(type) });
  const runData = useRpc(() => reportsApi.run(run?.run_id, page, 50), { immediate: false });
  const types = options.data?.types || [];
  const ranges = options.data?.ranges || [];
  useEffect(() => { if (type) filterOptions.refetch().catch(() => {}); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (run?.run_id) runData.refetch().catch(() => {}); }, [run?.run_id, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const generate = async () => {
    try { const result = await reportsApi.generate(type, range, filters); setRun(result); setPage(1); } catch (e) { setToast(e.message); }
  };
  const exportCsv = async () => {
    try {
      const result = await reportsApi.exportCsv(run.run_id);
      const url = URL.createObjectURL(new Blob([result.csv || result.content || ""], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = `universal-learning-${type}-report.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setToast(e.message); }
  };
  const data = runData.data || run;
  const rows = data?.rows || [];
  const columns = data?.columns || [];
  const labels = { enrollment: ["student", "email", "test_series", "status", "amount_paid_inr"], test_series: ["title", "subject", "status", "revenue_inr"], educators: ["educator", "email", "verification_status", "earnings_inr"], students: ["student", "email", "grade", "account_status", "total_spent_inr"] };
  const shownColumns = (columns.length ? columns : (labels[type] || [])).map((c) => typeof c === "string" ? { key: c, label: c.replace(/_/g, " ") } : c);
  return <div className="ul-report-page">{toast && <div className="ul-report-toast">{toast}</div>}<div className="ul-dash-welcome ul-report-welcome"><div><h2 className="ul-dash-welcome__title">Reports & Analytics</h2><p className="ul-dash-welcome__subtitle">Build operational reports from platform data.</p></div></div>
    {options.error && <div className="ul-set-error">Unable to load report options. <button type="button" onClick={() => options.refetch()}>Retry</button></div>}
    <section className="ul-card ul-report-builder"><div className="ul-card__head"><span className="ul-card__eyebrow"><IconReport size={14} /> Custom report builder</span><h3>Configure your report</h3></div><div className="ul-report-controls"><label>Report type<select value={type} onChange={(e) => { setType(e.target.value); setRun(null); setFilters({}); }}><option value="">Select report type</option>{types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label><label>Date range<select value={range} onChange={(e) => setRange(e.target.value)}>{ranges.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></label>{(types.find((t) => t.key === type)?.filters || []).map((field) => { const key = field.key; const source = field.source || key; const values = field.options || (filterOptions.data?.[source] || []); return <label key={key}>{field.label}<select value={filters[key] || ""} onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value || null }))}><option value="">All</option>{values.map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}</select></label>; })}</div><div className="ul-report-builder-footer"><button type="button" className="ul-btn ul-btn--primary" disabled={!type || options.loading} onClick={generate}>Generate report</button></div></section>
    <section className="ul-card ul-report-preview"><div className="ul-card__head"><span className="ul-card__eyebrow"><IconChart size={14} /> Generated report</span><h3>{data?.label || "No report generated"}</h3><button type="button" className="ul-btn ul-btn--ghost" disabled={!run} onClick={exportCsv}><IconDownload size={14} /> CSV</button></div>{!run ? <div className="ul-edu-empty">Configure your report and click Generate report.</div> : runData.loading ? <div className="ul-edu-empty">Loading…</div> : rows.length === 0 ? <div className="ul-edu-empty">No records match the generated report filters.</div> : <div className="ul-edu-table-scroll"><table className="ul-edu-table"><thead><tr>{shownColumns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{shownColumns.map((c) => <td key={c.key}>{/inr|amount|revenue|earnings|spent/.test(c.key) ? money(row[c.key]) : String(row[c.key] ?? "—")}</td>)}</tr>)}</tbody></table></div>} {run && <div className="ul-report-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button type="button" disabled={rows.length < 50} onClick={() => setPage(page + 1)}>Next</button></div>}</section>
  </div>;
}
