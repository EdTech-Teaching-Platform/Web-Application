// Earnings — Revenue Dashboard, Earnings Ledger, Wallet & Transactions and
// Payout Request, as four tabs of one page (same TABS pattern as
// CourseManagement.jsx). The ledger + payouts live here as local state,
// seeded once from the real course data in TeacherCoursesContext, and are
// passed down as props so every tab (and the Dashboard's summary card)
// reads the exact same numbers through computeBalances().
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import EarningsDashboardTab from "../components/EarningsDashboardTab";
import EarningsLedgerTab from "../components/EarningsLedgerTab";
import EarningsWalletTab from "../components/EarningsWalletTab";
import EarningsPayoutTab from "../components/EarningsPayoutTab";
import PayoutRequestPanel from "../components/PayoutRequestPanel";
import { seedEarnings, computeBalances, formatMoney } from "../data/earningsData";
import DecorAccents from "../../../components/ui/Decor";

const TABS = [
  { key: "dashboard", label: "Revenue Dashboard" },
  { key: "ledger", label: "Earnings Ledger" },
  { key: "wallet", label: "Wallet & Transactions" },
  { key: "payouts", label: "Payout Request" },
];

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">{message}</div>
  );
}

export default function Earnings() {
  const { courses } = useTeacherCourses();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = TABS.some((t) => t.key === searchParams.get("tab")) ? searchParams.get("tab") : "dashboard";
  const [tab, setTab] = useState(initialTab);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [toast, setToast] = useState("");

  const seed = useMemo(() => seedEarnings(courses), [courses]);
  const [ledger, setLedger] = useState(seed.ledger);
  const [payouts, setPayouts] = useState(seed.payouts);

  const balances = useMemo(() => computeBalances(ledger, payouts), [ledger, payouts]);

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function changeTab(key) {
    setTab(key);
    setSearchParams(key === "dashboard" ? {} : { tab: key }, { replace: true });
  }

  function handleRequestPayout(amount, method) {
    const id = `po-${Date.now()}`;
    setPayouts((prev) => [
      ...prev,
      {
        id,
        amount,
        currency: "INR",
        method,
        status: "Processing",
        requestedAt: new Date().toISOString().slice(0, 10),
        completedAt: null,
        failureReason: null,
        ledgerEntryId: null,
      },
    ]);
    flash(`Payout of ${formatMoney(amount, "INR")} requested — now processing.`);
  }

  const shared = { ledger, courses, balances, currency: "INR", onRequestPayout: () => setPayoutOpen(true) };

  return (
    <div className="pb-16">
      <div className="relative mb-5 flex flex-col gap-4 overflow-hidden rounded-3xl bg-white p-5 sm:p-7 shadow-soft [&>:not([data-decor])]:relative">
        <DecorAccents />
        <div>
          <div className="eyebrow mb-1.5">Revenue dashboard</div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Earnings</h1>
          <p className="mt-1 text-sm text-muted">
            A transparent record of everything you've earned across every course, and a reliable way to withdraw it.
          </p>
        </div>

        <div className="-mx-1 flex gap-1 overflow-x-auto border-t border-text/[0.07] px-1 pt-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => changeTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                tab === t.key ? "bg-primary text-white" : "text-muted hover:bg-primary/[0.06] hover:text-text"
              } hover:-translate-y-0.5 hover:shadow-soft`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "dashboard" && <EarningsDashboardTab {...shared} />}
      {tab === "ledger" && <EarningsLedgerTab {...shared} />}
      {tab === "wallet" && <EarningsWalletTab {...shared} />}
      {tab === "payouts" && <EarningsPayoutTab payouts={payouts} balances={balances} currency="INR" onRequestPayout={() => setPayoutOpen(true)} />}

      <PayoutRequestPanel
        open={payoutOpen}
        onClose={() => setPayoutOpen(false)}
        availableBalance={balances.availableBalance}
        currency="INR"
        onSubmit={handleRequestPayout}
      />

      <Toast message={toast} />
    </div>
  );
}
