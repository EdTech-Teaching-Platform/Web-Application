import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { BankIcon, CreditCardIcon, WalletIcon, AlertTriangleIcon } from "../../../components/ui/icons";
import { PAYOUT_STATUS_META, formatMoney } from "../data/earningsData";

const METHOD_ICON = { bank: BankIcon, paypal: WalletIcon, card: CreditCardIcon };

// EarningsPayoutTab — Payout History with the full lifecycle
// (Requested -> Approved -> Processing -> Paid/Failed), reading the same
// `payouts` array the Dashboard/Wallet "Request Payout" button appends to.
// A Failed payout shows its reason and never touched the ledger, per the
// spec -- so it's visually distinct rather than looking like a completed
// withdrawal that simply says "Failed".
export default function EarningsPayoutTab({ payouts, balances, currency = "INR", onRequestPayout }) {
  const sorted = [...payouts].sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Available to withdraw</span>
          <div className="mt-1 text-2xl font-bold tracking-tight text-text">{formatMoney(balances.availableBalance, currency)}</div>
        </div>
        <Button fullWidth={false} className="px-6" onClick={onRequestPayout}>
          Request Payout
        </Button>
      </section>

      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <h2 className="text-base font-bold text-text">Payout History</h2>
        <div className="mt-3 flex flex-col divide-y divide-text/[0.06]">
          {sorted.length === 0 && <p className="py-8 text-center text-sm text-muted">No payouts requested yet.</p>}
          {sorted.map((p) => {
            const Icon = METHOD_ICON[p.method.type] || BankIcon;
            const meta = PAYOUT_STATUS_META[p.status];
            return (
              <div key={p.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-text">{formatMoney(p.amount, p.currency)}</div>
                    <div className="text-xs text-muted">
                      {p.method.label} · Requested {p.requestedAt}
                      {p.completedAt ? ` · ${p.status === "Paid" ? "Paid" : "Resolved"} ${p.completedAt}` : ""}
                    </div>
                    {p.status === "Failed" && p.failureReason && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-danger">
                        <AlertTriangleIcon className="h-3.5 w-3.5" />
                        {p.failureReason}
                      </div>
                    )}
                  </div>
                </div>
                <StatusBadge status={meta.tone} showIcon={false}>
                  {meta.label}
                </StatusBadge>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
