import { useCallback, useEffect, useState } from "react";
import { discountsApi } from "../../services/discountsApi";
import { useRpc } from "../../hooks/useRpc";
import { PageHeader, useDiscountNavigate } from "./DiscountsShared";

export default function ManageDiscounts() {
  const navigate = useDiscountNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, status]);
  // QA triage P8 item 1 (#2, the admin freeze): this was an inline arrow, so
  // every render made a new request, useRpc refetched, the response rendered
  // again, and the page sent requests without end. Leaving the page then
  // queued the next page behind them and the portal looked frozen. Stable now:
  // useRpc refetches by itself only when the search, status or page changes.
  const request = useCallback(() => discountsApi.list({ search: debouncedSearch, status, page, size: 8 }), [debouncedSearch, status, page]);
  const result = useRpc(request);
  const stats = useRpc(discountsApi.stats);
  const rows = result.data?.rows || [];
  return <div><PageHeader title="Manage Discounts" subtitle="Create, activate and monitor platform offers." />
    <div className="ul-edu-toolbar ul-dsc-filters"><input placeholder="Search by name or code…" value={search} onChange={(e) => setSearch(e.target.value)} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option>{["active","scheduled","expired","inactive","archived"].map((x) => <option key={x}>{x}</option>)}</select></div>
    <div className="ul-stats"><div className="ul-stat-card">Total <strong>{stats.data?.total ?? "—"}</strong></div><div className="ul-stat-card">Active <strong>{stats.data?.active ?? "—"}</strong></div><div className="ul-stat-card">Redemptions <strong>{stats.data?.total_redemptions ?? "—"}</strong></div></div>
    <div className="ul-card ul-edu-table-card">{result.loading ? <div className="ul-edu-empty">Loading discounts…</div> : result.error ? <div className="ul-edu-empty">Unable to load discounts. <button onClick={() => result.refetch()}>Retry</button></div> : !rows.length ? <div className="ul-edu-empty">No discounts match these filters.</div> : <div className="ul-edu-table-scroll"><table className="ul-edu-table"><thead><tr><th>Name</th><th>Code</th><th>Offer</th><th>Status</th><th>Used</th><th /></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.coupon_code || r.code}</td><td>{r.offer_type} {r.value}</td><td>{r.display_status}</td><td>{r.used_count ?? 0}</td><td><button className="ul-btn ul-btn--ghost" onClick={() => navigate(`/admin/discounts/edit/${r.id}`)}>Edit</button></td></tr>)}</tbody></table></div>}</div>
    {result.data?.total > 8 && <button className="ul-btn ul-btn--ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>}
    {result.data?.total > page * 8 && <button className="ul-btn ul-btn--ghost" onClick={() => setPage(page + 1)}>Next</button>}
  </div>;
}
