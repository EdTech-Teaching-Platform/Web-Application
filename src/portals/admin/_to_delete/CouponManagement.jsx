// Coupon Management — one row per campaign/coupon with lifecycle actions.
// Deleting or archiving never touches redemption or audit records.
import { useEffect, useMemo, useState } from "react";
import { IconSearch } from "../../components/icons";
import ConfirmModal from "../../components/ConfirmModal";
import {
  useDiscountState, effectiveStatus, redeemedCount, STATUS_LABEL, KINDS, SCOPES, refreshExpiry, inr,
  setCampaignState, duplicateCampaign, deleteCampaign, generateBulkCodes, getCatalog,
} from "../../data/discountsMock";
import { PageHeader, DLink, useDiscountNavigate, useDiscountSearchParams, takeFlash, StatusBadge, RowMenu, Pager, pageSlice, Modal, fmtDateTime, useActor, useToast, exportCsv } from "./DiscountsShared";

const SIZE = 8;
const valueLabel = (c) => (c.type === "percent" ? `${c.value}%${c.maxDiscount ? ` (max ${inr(c.maxDiscount)})` : ""}` : inr(c.value));

function appliesTo(c) {
  if (c.kind === "combo") return `Combo · ${c.comboProducts.length} items`;
  if (c.scope === "selected_courses" || c.scope === "selected_test_series") {
    const cat = getCatalog();
    const names = c.productIds.map((id) => cat.find((x) => x.id === id)?.name).filter(Boolean);
    return names.length ? names.join(", ") : SCOPES[c.scope];
  }
  return SCOPES[c.scope];
}

export default function CouponManagement() {
  const st = useDiscountState();
  const actor = useActor();
  const navigate = useDiscountNavigate();
  const [params] = useDiscountSearchParams();
  const [, setToast, toastEl] = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(params.get("status") || "all");
  const [kind, setKind] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState(null); // {kind, campaign}
  const [bulk, setBulk] = useState(null);
  const [bulkN, setBulkN] = useState("25");
  const [bulkErr, setBulkErr] = useState("");

  useEffect(() => { refreshExpiry(); }, []);
  useEffect(() => { const m = takeFlash(); if (m) setToast(m); }, []); // eslint-disable-line
  useEffect(() => { setPage(1); }, [q, status, kind, type]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return st.campaigns
      .map((c) => ({ c, eff: effectiveStatus(c, st), used: redeemedCount(st, c.id) }))
      .filter(({ c, eff }) => {
        if (status === "expired" ? !(eff === "expired" || eff === "exhausted") : status !== "all" && eff !== status) return false;
        if (kind !== "all" && c.kind !== kind) return false;
        if (type !== "all" && c.type !== type) return false;
        if (s && !`${c.name} ${c.code} ${c.prefix} ${c.id}`.toLowerCase().includes(s)) return false;
        return true;
      })
      .sort((a, b) => b.c.createdAt.localeCompare(a.c.createdAt));
  }, [st, q, status, kind, type]);
  const hideArchived = status === "all" ? rows.filter((r) => r.eff !== "archived") : rows;

  const run = (fn, ok) => { const r = fn(); setToast(r.ok ? ok : r.error); setConfirm(null); return r; };
  const act = (c, action, ok) => run(() => setCampaignState(c.id, action, actor), ok);

  const menuFor = ({ c, eff, used }) => {
    const items = [];
    if (actor.can("edit") && eff !== "archived") items.push({ label: "Edit details", onClick: () => navigate(`/admin/discounts/edit/${c.id}`) });
    if (actor.can("approve")) {
      if (c.state === "draft" || c.state === "inactive") items.push({ label: "Activate", onClick: () => act(c, "activate", `${c.name} activated.`) });
      if (c.state === "active") items.push({ label: "Pause", onClick: () => act(c, "pause", `${c.name} paused.`) });
      if (c.state === "paused") items.push({ label: "Resume", onClick: () => act(c, "resume", `${c.name} resumed.`) });
      if (c.state === "active" || c.state === "paused") items.push({ label: "Deactivate", onClick: () => setConfirm({ kind: "deactivate", c }) });
      if (c.state === "archived") items.push({ label: "Restore", onClick: () => act(c, "restore", `${c.name} restored (inactive).`) });
      else if (["draft", "inactive", "paused"].includes(c.state) || eff === "expired" || eff === "exhausted") items.push({ label: "Archive", onClick: () => setConfirm({ kind: "archive", c }) });
    }
    if (actor.can("create")) {
      items.push({ label: "Duplicate", onClick: () => { const r = duplicateCampaign(c.id, actor); setToast(r.ok ? `Duplicated as draft "${r.campaign.name}".` : r.error); } });
      if (c.codeMode === "unique" && c.state !== "archived") items.push({ label: "Generate bulk codes", onClick: () => { setBulk(c); setBulkErr(""); } });
    }
    if (c.codeMode === "unique") items.push({ label: "Export codes (CSV)", onClick: () => exportCodes(c) });
    if (actor.can("delete") && c.state === "draft" && used === 0) items.push({ label: "Delete draft", danger: true, onClick: () => setConfirm({ kind: "delete", c }) });
    return items;
  };

  const exportCodes = (c) => {
    const list = st.coupons.filter((x) => x.campaignId === c.id);
    if (!list.length) { setToast("No codes generated for this campaign yet."); return; }
    exportCsv(`${c.name.replace(/\W+/g, "-")}-codes.csv`, [["Code", "Assigned to", "Status", "Redeemed at"], ...list.map((x) => [x.code, x.studentId || "Unassigned", x.status, x.redeemedAt || ""])]);
  };

  const copy = { 
    deactivate: (c) => ({ title: "Deactivate this coupon?", desc: `"${c.name}" stops working immediately. Past redemptions are kept and you can activate it again later.`, label: "Deactivate", tone: "danger", fn: () => act(c, "deactivate", `${c.name} deactivated.`) }),
    archive: (c) => ({ title: "Archive this campaign?", desc: `"${c.name}" moves to Archived. Its redemption, transaction and audit records are preserved, and you can restore it later.`, label: "Archive", tone: "danger", fn: () => act(c, "archive", `${c.name} archived.`) }),
    delete: (c) => ({ title: "Delete this draft?", desc: `"${c.name}" has never been used, so it will be permanently removed. The audit trail keeps a record that it existed.`, label: "Delete", tone: "danger", fn: () => run(() => deleteCampaign(c.id, actor), `${c.name} deleted.`) }),
  };
  const cf = confirm ? copy[confirm.kind](confirm.c) : null;

  return (
    <div>
      <PageHeader title="Coupon Management" subtitle="Create, schedule, pause and retire coupons. Redemption history is never lost." />

      <div className="ul-edu-toolbar ul-dsc-filters">
        <label className="ul-edu-search"><IconSearch size={14} color="var(--color-text-muted)" />
          <input type="text" placeholder="Search by name, code or ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="ul-edu-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Status: All</option>
          {["active", "scheduled", "draft", "paused", "inactive", "expired", "archived"].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className="ul-edu-select" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">Campaign: All</option>
          {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="ul-edu-select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">Discount: All</option>
          <option value="percent">Percentage</option>
          <option value="fixed">Fixed amount</option>
        </select>
      </div>

      <div className="ul-card ul-edu-table-card">
        {hideArchived.length === 0 ? <div className="ul-edu-empty">{st.campaigns.length === 0 ? "No coupons yet. Create your first discount." : "No coupons match these filters."}</div> : (
          <div className="ul-edu-table-scroll ul-dsc-scroll">
            <table className="ul-edu-table ul-dsc-table">
              <thead><tr>
                <th>Coupon code</th><th>Discount</th><th>Type &amp; value</th><th>Applies to</th><th>Min. purchase</th>
                <th>Used / left</th><th>Starts</th><th>Expires</th><th>Status</th><th aria-label="Actions" />
              </tr></thead>
              <tbody>
                {pageSlice(hideArchived, page, SIZE).map((r) => {
                  const { c, eff, used } = r;
                  const left = c.totalLimit == null ? "Unlimited" : Math.max(0, c.totalLimit - used);
                  return (
                    <tr key={c.id} className="ul-edu-row--clickable" onClick={() => navigate(`/admin/discounts/tracking?campaign=${c.id}`)}>
                      <td>{c.codeMode === "shared" ? <span className="ul-dsc-code">{c.code}</span> : <><span className="ul-dsc-code">{c.prefix}-…</span><span className="ul-dsc-sub">{st.coupons.filter((x) => x.campaignId === c.id).length} unique codes</span></>}</td>
                      <td><span className="ul-rh-strong">{c.name}</span>{c.kind !== "standard" && <span className="ul-dsc-kind">{KINDS[c.kind]}</span>}<span className="ul-dsc-sub">{c.id}</span></td>
                      <td>{c.type === "percent" ? "Percentage" : "Fixed"} · {valueLabel(c)}</td>
                      <td><span className="ul-cmi-clip" title={appliesTo(c)} style={{ maxWidth: 200 }}>{appliesTo(c)}</span></td>
                      <td>{c.minPurchase ? inr(c.minPurchase) : "—"}</td>
                      <td>{used}{c.totalLimit != null ? ` / ${c.totalLimit}` : ""}<span className="ul-dsc-sub">{left === "Unlimited" ? "Unlimited" : `${left} left`}</span></td>
                      <td>{fmtDateTime(c.startAt)}</td>
                      <td>{fmtDateTime(c.endAt)}</td>
                      <td><StatusBadge status={eff} /></td>
                      <td className="ul-edu-actions-cell" onClick={(e) => e.stopPropagation()}><RowMenu items={menuFor(r)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} setPage={setPage} total={hideArchived.length} size={SIZE} />
      </div>
      {status === "all" && st.campaigns.some((c) => c.state === "archived") && <p className="ul-dsc-note">Archived campaigns are hidden here — filter by Status: Archived to restore them.</p>}

      <ConfirmModal open={!!cf} compact tone={cf?.tone} title={cf?.title} description={cf?.desc} confirmLabel={cf?.label} onConfirm={() => cf.fn()} onCancel={() => setConfirm(null)} />

      {bulk && (
        <Modal title="Generate bulk codes" subtitle={bulk.name} onClose={() => setBulk(null)}
          footer={<><button type="button" className="ul-btn ul-btn--ghost" onClick={() => setBulk(null)}>Cancel</button>
            <button type="button" className="ul-btn ul-btn--primary" onClick={() => {
              const r = generateBulkCodes(bulk.id, bulkN, actor);
              if (!r.ok) { setBulkErr(r.error); return; }
              exportCsv(`${bulk.name.replace(/\W+/g, "-")}-bulk-codes.csv`, [["Code"], ...r.codes.map((x) => [x.code])]);
              setToast(`${r.codes.length} codes generated and downloaded as CSV.`); setBulk(null);
            }}>Generate &amp; download</button></>}>
          <p className="ul-dsc-hint">Creates unique, single-use codes (any eligible student can use each once). They're added to this campaign and downloaded as a CSV.</p>
          <div className="ul-dsc-field" style={{ marginTop: 10 }}><label>How many codes? (1–1000)</label><input type="number" min="1" max="1000" value={bulkN} onChange={(e) => { setBulkN(e.target.value); setBulkErr(""); }} /></div>
          {bulkErr && <p className="ul-dsc-err">{bulkErr}</p>}
        </Modal>
      )}
      {toastEl}
    </div>
  );
}
