import { useCallback, useEffect, useState } from "react";
import { useRpc } from "../hooks/useRpc";
import { transactionsApi } from "../services/transactionsApi";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./TransactionHistory.css";
export default function TransactionHistory() {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [sort, setSort] = useState("newest");
  // Stable requests on the debounced search: inline arrows re-ran both fetches
  // on every render (and on every keystroke, besides the debounced refetch).
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  const result = useRpc(useCallback(() => transactionsApi.list({ search: debouncedSearch, page, sort }), [debouncedSearch, page, sort]));
  const stats = useRpc(useCallback(() => transactionsApi.stats({ search: debouncedSearch }), [debouncedSearch]));
  const rows = result.data?.rows || [];
  return <div><div className="ul-edu-header"><div><h2 className="ul-edu-header__title">Transaction History</h2><p className="ul-edu-header__subtitle">Search the paid transaction ledger.</p></div></div><div className="ul-edu-toolbar"><input placeholder="Search transaction, student, educator or series…" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="amount_desc">Highest amount</option></select></div><div className="ul-stats"><div className="ul-stat-card">Revenue <strong>₹{stats.data?.total_revenue_inr ?? 0}</strong></div><div className="ul-stat-card">Transactions <strong>{stats.data?.total_transactions ?? 0}</strong></div><div className="ul-stat-card">Average <strong>₹{stats.data?.avg_value_inr ?? 0}</strong></div></div><div className="ul-card ul-edu-table-card">{result.loading ? <div className="ul-edu-empty">Loading transactions…</div> : result.error ? <div className="ul-edu-empty">Unable to load transactions. <button onClick={() => result.refetch()}>Retry</button></div> : !rows.length ? <div className="ul-edu-empty">No transactions found.</div> : <table className="ul-edu-table"><thead><tr><th>Transaction</th><th>Date</th><th>Student</th><th>Series</th><th>Educator</th><th>Amount</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.txn_code}</td><td>{r.paid_at ? new Date(r.paid_at).toLocaleDateString() : "—"}</td><td>{r.student_name}</td><td>{r.series_title}</td><td>{r.educator_name}</td><td>₹{r.amount_inr}</td></tr>)}</tbody></table>}</div><button className="ul-btn ul-btn--ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="ul-btn ul-btn--ghost" disabled={rows.length < 10} onClick={() => setPage(page + 1)}>Next</button></div>;
}
