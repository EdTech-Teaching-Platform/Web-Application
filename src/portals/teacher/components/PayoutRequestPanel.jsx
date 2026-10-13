import { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import { BankIcon, CreditCardIcon, WalletIcon, CheckIcon } from "../../../components/ui/icons";
import { PAYOUT_METHODS, formatMoney } from "../data/earningsData";

const METHOD_ICON = { bank: BankIcon, paypal: WalletIcon, card: CreditCardIcon };
const MIN_PAYOUT = 500; // ₹500 minimum withdrawal

// PayoutRequestPanel — the withdrawal modal, opened from the Revenue
// Dashboard, Wallet & Transactions and the Payout History view alike, so
// there's exactly one request flow instead of three forked ones. Submitting
// adds a "Processing" entry to the shared payouts list (see Earnings.jsx),
// which computeBalances() immediately reflects everywhere as a held amount
// -- the same mechanism a completed payout uses to reduce Available for
// real, just without a ledger debit until it's actually Paid.
export default function PayoutRequestPanel({ open, onClose, availableBalance, currency = "INR", onSubmit }) {
  const [methodId, setMethodId] = useState(PAYOUT_METHODS[0].id);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState("form"); // form | confirm | success

  useEffect(() => {
    if (open) {
      setMethodId(PAYOUT_METHODS[0].id);
      setAmount("");
      setStep("form");
    }
  }, [open]);

  const numeric = Number(amount) || 0;
  const method = PAYOUT_METHODS.find((m) => m.id === methodId) || PAYOUT_METHODS[0];
  const overAvailable = numeric > availableBalance;
  const underMin = amount !== "" && numeric < MIN_PAYOUT;
  const valid = numeric > 0 && !overAvailable && !underMin;

  function handleConfirm() {
    onSubmit?.(numeric, method);
    setStep("success");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === "success" ? "Payout requested" : "Request a payout"}
      size="md"
      footer={
        step === "form" ? (
          <div className="flex w-full items-center gap-2">
            <Button variant="secondary" fullWidth={false} className="px-5" onClick={onClose}>
              Cancel
            </Button>
            <Button fullWidth={false} className="ml-auto px-6" disabled={!valid} onClick={() => setStep("confirm")}>
              Continue
            </Button>
          </div>
        ) : step === "confirm" ? (
          <div className="flex w-full items-center gap-2">
            <Button variant="secondary" fullWidth={false} className="px-5" onClick={() => setStep("form")}>
              Back
            </Button>
            <Button fullWidth={false} className="ml-auto px-6" onClick={handleConfirm}>
              Confirm withdrawal
            </Button>
          </div>
        ) : (
          <Button fullWidth={false} className="ml-auto px-6" onClick={onClose}>
            Done
          </Button>
        )
      }
    >
      {step === "form" && (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            Available to withdraw: <span className="font-semibold text-text">{formatMoney(availableBalance, currency)}</span>
          </p>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Payout method</label>
            <div className="flex flex-col gap-2">
              {PAYOUT_METHODS.map((m) => {
                const Icon = METHOD_ICON[m.type] || BankIcon;
                const active = methodId === m.id;
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setMethodId(m.id)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ${
                      active ? "border-primary bg-primary/[0.06]" : "border-text/10 hover:bg-text/[0.03]"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? "bg-primary text-white" : "bg-text/[0.06] text-muted"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <div className="truncate text-sm font-semibold text-text">{m.label}</div>
                      <div className="text-xs text-muted">{m.detail}</div>
                    </span>
                    {active && <CheckIcon className="ml-auto h-4 w-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">Amount</label>
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => setAmount(String(availableBalance))}
              >
                Withdraw all available
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-text/15 bg-white px-4 py-3">
              <span className="text-sm font-semibold text-muted">₹</span>
              <input
                type="number"
                min="0"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent text-sm font-semibold text-text outline-none"
              />
            </div>
            {overAvailable && <p className="mt-1.5 text-xs font-medium text-danger">Amount exceeds your available balance.</p>}
            {underMin && !overAvailable && <p className="mt-1.5 text-xs font-medium text-danger">Minimum payout is {formatMoney(MIN_PAYOUT, currency)}.</p>}
          </div>
        </div>
      )}

      {step === "confirm" && (
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted">Amount</dt>
            <dd className="text-lg font-bold text-text">{formatMoney(numeric, currency)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Payout method</dt>
            <dd className="font-medium text-text">{method.label}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Estimated arrival</dt>
            <dd className="font-medium text-text">{method.detail.split("· ")[1] || method.detail}</dd>
          </div>
          <div className="mt-1 rounded-xl bg-bg p-3 text-xs text-muted">
            Funds are held as "Processing" until the transfer completes, and are removed from your available balance
            immediately so you can't accidentally request them twice.
          </div>
        </dl>
      )}

      {step === "success" && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/12 text-success motion-safe:animate-[celebrate-pop_0.5s_ease-out]">
            <CheckIcon className="h-7 w-7" />
          </span>
          <p className="text-sm text-muted">
            {formatMoney(numeric, currency)} is on its way to <span className="font-semibold text-text">{method.label}</span>.
            You can track it under Payout History.
          </p>
        </div>
      )}
    </Modal>
  );
}
