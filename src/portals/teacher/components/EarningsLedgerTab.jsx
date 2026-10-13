import { useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import { SearchIcon, ChevronDownIcon, ArrowUpRightIcon, ArrowDownLeftIcon } from "../../../components/ui/icons";
import StatusBadge from "../../../components/ui/StatusBadge";
import { LEDGER_TYPE_META, SOURCE_LABELS, entrySource, formatMoney, formatSigned } from "../data/earningsData";
import Select from "../../../components/ui/Select";

const TYPE_FILTERS = ["All", "sale", "clawback", "payout"];
const SORTS = ["Newest", "Oldest", "Amount: high to low", "Amount: low to high"];

function TypeChip({ type }) {
  const meta = LEDGER_TYPE_META[type] || LEDGER_TYPE_META.sale;
  const tone = meta.tone === "success" ? "bg-success/12 text-success" : meta.tone === "danger" ? "bg-danger/12 text-danger" : "bg-text/[0.07] text-muted";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{meta.label}</span>;
}

// EarningsLedgerTab — the append-only, immutable transaction history. Every
// row here is one entry from the shared `ledger` array (see Earnings.jsx);
// nothing is computed locally, so a filter/sort never changes what a total
// means, only which rows are shown. Clawback rows get a distinct danger
// tint so a refund never reads as an ordinary debit.
export default function EarningsLedgerTab({ ledger, courses, currency = "INR" }) {
  const [type, setType] = useState("All");
  const [courseId, setCourseId] = useState("All");
  const [source, setSource] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Newest");
  const [detail, setDetail] = useState(null);

  const courseOptions = useMemo(() => {
    const seen = new Map();
    ledger.forEach((e) => e.courseId && seen.set(e.courseId, e.courseTitle));
    return Array.from(seen.entries());
  }, [ledger]);

  const rows = useMemo(() => {
    let list = ledger.filter((e) => (type === "All" ? true : e.type === type));
    if (courseId !== "All") list = list.filter((e) => e.courseId === courseId);
    if (source !== "All") list = list.filter((e) => entrySource(e) === source);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((e) => `${e.description} ${e.buyer || ""} ${e.courseTitle || ""}`.toLowerCase().includes(q));
    }
    list = [...list];
    if (sort === "Newest") list.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (sort === "Oldest") list.sort((a, b) => (a.date > b.date ? 1 : -1));
    if (sort === "Amount: high to low") list.sort((a, b) => b.amount - a.amount);
    if (sort === "Amount: low to high") list.sort((a, b) => a.amount - b.amount);
    return list;
  }, [ledger, type, courseId, source, query, sort]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-white p-3 shadow-soft">
        <div className="flex items-center gap-2 rounded-full bg-bg px-3 py-2">
          <SearchIcon className="h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions"
            className="w-44 bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </div>

        <Select value={type} onChange={(e) => setType(e.target.value)} className="rounded-full bg-bg px-3 py-2 pr-8 text-sm font-medium text-text outline-none">
          {TYPE_FILTERS.map((t) => (
            <option key={t} value={t}>
              {t === "All" ? "All types" : LEDGER_TYPE_META[t].label}
            </option>
          ))}
        </Select>

        <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="rounded-full bg-bg px-3 py-2 pr-8 text-sm font-medium text-text outline-none">
          <option value="All">All courses</option>
          {courseOptions.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </Select>

        <Select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Filter by source" className="rounded-full bg-bg px-3 py-2 pr-8 text-sm font-medium text-text outline-none">
          <option value="All">All sources</option>
          {Object.entries(SOURCE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>

        <div className="ml-auto flex items-center gap-2 rounded-full bg-bg px-3 py-2 text-sm font-medium text-text">
          <span className="text-muted">Sort</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="bg-transparent pr-6" chevronClassName="right-0">
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-3xl bg-white sm:block shadow-soft">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-text/[0.07] bg-bg/60">
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Transaction</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Type</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Date</th>
              <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted">Status</th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-text/[0.06]">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                  No transactions match these filters.
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr
                key={e.id}
                onClick={() => setDetail(e)}
                className={`cursor-pointer transition-colors duration-150 hover:bg-primary/[0.03] ${e.type === "clawback" ? "bg-danger/[0.04]" : ""}`}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${e.amount < 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                      {e.amount < 0 ? <ArrowUpRightIcon className="h-4 w-4" /> : <ArrowDownLeftIcon className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text">{e.description}</div>
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        {e.buyer}
                        {e.source === "bundle" && <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">Bundle</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <TypeChip type={e.type} />
                </td>
                <td className="px-5 py-3.5 text-sm text-muted">{e.date}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={e.status === "pending" ? "warning" : "success"} size="sm" showIcon={false}>
                    {e.status === "pending" ? "Pending" : "Cleared"}
                  </StatusBadge>
                </td>
                <td className={`px-5 py-3.5 text-right text-sm font-semibold ${e.amount < 0 ? "text-danger" : "text-success"}`}>
                  {formatSigned(e.amount, e.currency || currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="flex flex-col gap-3 sm:hidden">
        {rows.length === 0 && (
          <div className="rounded-3xl bg-white px-5 py-10 text-center text-sm text-muted shadow-soft">
            No transactions match these filters.
          </div>
        )}
        {rows.map((e) => (
          <button
            type="button"
            key={e.id}
            onClick={() => setDetail(e)}
            className={`flex flex-col gap-2 rounded-3xl bg-white p-4 text-left ${e.type === "clawback" ? "bg-danger/[0.04]" : ""} shadow-soft`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${e.amount < 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                {e.amount < 0 ? <ArrowUpRightIcon className="h-4 w-4" /> : <ArrowDownLeftIcon className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text">{e.description}</div>
                <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                  {e.buyer}
                  {e.source === "bundle" && <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">Bundle</span>}
                </div>
              </div>
              <div className={`shrink-0 text-sm font-semibold ${e.amount < 0 ? "text-danger" : "text-success"}`}>
                {formatSigned(e.amount, e.currency || currency)}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-text/[0.06] pt-2.5">
              <div className="flex items-center gap-2">
                <TypeChip type={e.type} />
                <StatusBadge status={e.status === "pending" ? "warning" : "success"} size="sm" showIcon={false}>
                  {e.status === "pending" ? "Pending" : "Cleared"}
                </StatusBadge>
              </div>
              <span className="text-xs text-muted">{e.date}</span>
            </div>
          </button>
        ))}
      </div>

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="Transaction detail"
        footer={
          <Button variant="secondary" fullWidth={false} className="ml-auto px-5" onClick={() => setDetail(null)}>
            Close
          </Button>
        }
      >
        {detail && (
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Description</dt>
              <dd className="max-w-[60%] text-right font-medium text-text">{detail.description}</dd>
            </div>
            {detail.buyer && (
              <div className="flex items-center justify-between">
                <dt className="text-muted">Buyer</dt>
                <dd className="font-medium text-text">{detail.buyer}</dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-muted">Type</dt>
              <dd>
                <TypeChip type={detail.type} />
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Date</dt>
              <dd className="font-medium text-text">{detail.date}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Status</dt>
              <dd className="font-medium text-text">{detail.status === "pending" ? "Pending" : "Cleared"}</dd>
            </div>
            {detail.grossAmount != null && (
              <div className="flex items-center justify-between">
                <dt className="text-muted">Gross amount</dt>
                <dd className="font-medium text-text">{formatMoney(detail.grossAmount, detail.currency)}</dd>
              </div>
            )}
            {detail.commission != null && (
              <div className="flex items-center justify-between">
                <dt className="text-muted">Platform commission</dt>
                <dd className="font-medium text-danger">−{formatMoney(Math.abs(detail.commission), detail.currency)}</dd>
              </div>
            )}
            {detail.relatedEntryId && (
              <div className="flex items-center justify-between">
                <dt className="text-muted">Reverses transaction</dt>
                <dd className="font-mono text-xs text-muted">{detail.relatedEntryId}</dd>
              </div>
            )}
            <div className="my-1 border-t border-dashed border-text/15" />
            <div className="flex items-center justify-between">
              <dt className="font-semibold text-text">Net amount</dt>
              <dd className={`text-lg font-bold ${detail.amount < 0 ? "text-danger" : "text-success"}`}>
                {formatSigned(detail.amount, detail.currency || currency)}
              </dd>
            </div>
          </dl>
        )}
      </Modal>
    </div>
  );
}
