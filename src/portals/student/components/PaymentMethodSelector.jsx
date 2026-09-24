import { CreditCardIcon, QrIcon, WalletIcon, BankIcon } from "../../../components/ui/icons";

// PaymentMethodSelector — portal-local (single consumer: Checkout.jsx).
// Segmented cards, same active/inactive visual language as Chip/FilterPill
// per design.md, just laid out as a grid of larger tap targets since each
// option needs an icon + label. This only collects the student's *choice*
// of method — no card/UPI details are entered here, that happens on the
// payment provider's own hosted page (Sec 5.10: "hosted checkout with a
// provider... price computed server-side").
const METHODS = [
  { id: "card", label: "Card", Icon: CreditCardIcon },
  { id: "upi", label: "UPI", Icon: QrIcon },
  { id: "netbanking", label: "Net Banking", Icon: BankIcon },
  { id: "wallet", label: "Wallet", Icon: WalletIcon },
];

export default function PaymentMethodSelector({ value, onChange, disabled = false }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {METHODS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={`flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
              active
                ? "border-primary bg-primary text-white"
                : "border-text/15 bg-bg text-text hover:border-primary/40"
            }`}
          >
            <Icon />
            {label}
          </button>
        );
      })}
    </div>
  );
}
