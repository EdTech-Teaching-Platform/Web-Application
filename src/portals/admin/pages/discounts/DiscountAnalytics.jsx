import { useState } from "react";
import { useRpc } from "../../hooks/useRpc";
import { discountsApi } from "../../services/discountsApi";
export default function DiscountAnalytics() {
  const [days, setDays] = useState(30); const end = new Date().toISOString().slice(0, 10); const start = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  const result = useRpc(() => discountsApi.analytics(start, end));
  const data = result.data || {}; const k = data.kpis || {};
  return <section className="ul-card"><div className="ul-card__head"><h3>Discount analytics</h3><select value={days} onChange={(e) => setDays(Number(e.target.value))}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>{result.loading ? <div className="ul-edu-empty">Loading analytics…</div> : result.error ? <div className="ul-edu-empty">Unable to load analytics. <button onClick={() => result.refetch()}>Retry</button></div> : <div className="ul-stats"><div className="ul-stat-card">Redemptions <strong>{k.redemptions ?? 0}</strong></div><div className="ul-stat-card">Discount given <strong>₹{k.discount_given_inr ?? 0}</strong></div><div className="ul-stat-card">Revenue after discount <strong>₹{k.revenue_after_discount_inr ?? 0}</strong></div></div>}</section>;
}
