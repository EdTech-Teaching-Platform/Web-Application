import { useMemo } from "react";
import Button from "../../../components/ui/Button";
import { WalletIcon, ClockIcon, ArrowDownLeftIcon, ArrowUpRightIcon, ChevronRightIcon } from "../../../components/ui/icons";
import { formatMoney, formatSigned, PENDING_WINDOW_DAYS } from "../data/earningsData";

function FlowStep({ label, value, icon: Icon, active }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${active ? "bg-primary text-white" : "bg-bg text-muted"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-sm font-semibold text-text">{value}</div>
        <div className="text-[11px] text-muted">{label}</div>
      </div>
    </div>
  );
}

// EarningsWalletTab — a simplified, balance-first view of the same wallet
// the Dashboard and Ledger already describe: how money moves from a
// pending sale to a withdrawable payout, plus a short recent-activity
// list. All figures come from the shared `balances`/`ledger`, never
// recomputed locally.
export default function EarningsWalletTab({ ledger, balances, currency = "INR", onRequestPayout }) {
  const recent = useMemo(() => ledger.slice(0, 6), [ledger]);

  return (
    <div className="flex flex-col gap-5">
      <section className="gradient-hero rounded-3xl bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Available balance</span>
            <div className="mt-1 gradient-text-hero bg-clip-text text-3xl font-bold tracking-tight text-transparent">{formatMoney(balances.availableBalance, currency)}</div>
          </div>
          <Button fullWidth={false} className="px-6" onClick={onRequestPayout}>
            Request Payout
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-text/[0.07] pt-5 text-center sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <FlowStep label={`Pending (${PENDING_WINDOW_DAYS}d hold)`} value={formatMoney(balances.pendingBalance, currency)} icon={ClockIcon} />
          <div className="hidden items-center justify-center text-text/25 sm:flex">
            <ChevronRightIcon className="h-5 w-5" />
          </div>
          <FlowStep label="Available now" value={formatMoney(balances.availableBalance, currency)} icon={WalletIcon} active />
          <div className="hidden items-center justify-center text-text/25 sm:flex">
            <ChevronRightIcon className="h-5 w-5" />
          </div>
          <FlowStep label="Withdrawn (lifetime)" value={formatMoney(balances.lifetimeWithdrawn, currency)} icon={ArrowDownLeftIcon} />
        </div>
        {balances.reserved > 0 && (
          <p className="mt-4 rounded-xl bg-bg px-4 py-2.5 text-xs text-muted">
            {formatMoney(balances.reserved, currency)} is currently held for a payout in progress and isn't counted in
            "Available now."
          </p>
        )}
      </section>

      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <h2 className="text-base font-bold text-text">Recent activity</h2>
        <div className="mt-3 flex flex-col divide-y divide-text/[0.06]">
          {recent.map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${e.amount < 0 ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                {e.amount < 0 ? <ArrowUpRightIcon className="h-4 w-4" /> : <ArrowDownLeftIcon className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text">{e.description}</div>
                <div className="text-xs text-muted">
                  {e.date} {e.status === "pending" ? "· Pending" : ""}
                </div>
              </div>
              <div className={`shrink-0 text-sm font-semibold ${e.amount < 0 ? "text-danger" : "text-success"}`}>{formatSigned(e.amount, e.currency || currency)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
