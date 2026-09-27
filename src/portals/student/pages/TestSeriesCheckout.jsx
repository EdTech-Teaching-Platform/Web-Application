import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BackButton from "../../../components/common/BackButton";
import Button from "../../../components/ui/Button";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import { useAuth } from "../../../hooks/useAuth";
import { getSeriesById, isSeriesPurchased, purchaseSeries } from "../data/testSeriesCatalog";
import { getSeriesStartPath } from "../data/testSeriesCatalog";

const METHODS = ["Card", "UPI", "Net Banking", "Wallet"];

export default function TestSeriesCheckout() {
  const { seriesId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const pkg = getSeriesById(seriesId);
  const [method, setMethod] = useState("UPI");
  const [agreed, setAgreed] = useState(false);
  const [processing, setProcessing] = useState(false);

  if (!pkg) {
    return <div className="mx-auto max-w-xl px-4 py-12"><BackButton fallback="/student/test-series" className="mb-5" /><ConfirmationCard state="warning" heading="Test series not found" message="This checkout link is no longer available." primaryAction={<Button onClick={() => navigate("/student/test-series")}>Browse Test Series</Button>} /></div>;
  }

  if (isSeriesPurchased(pkg.id, user)) {
    return <div className="mx-auto max-w-xl px-4 py-12"><BackButton fallback={`/student/test-series/${pkg.id}`} className="mb-5" /><ConfirmationCard state="success" heading="You already have access" message={`You already own ${pkg.title}.`} primaryAction={<Button onClick={() => navigate(getSeriesStartPath(pkg))}>Start Test Series</Button>} /></div>;
  }

  function completeDemoPayment(event) {
    event.preventDefault();
    if (!agreed) return;
    setProcessing(true);
    window.setTimeout(() => {
      purchaseSeries(pkg.id, user);
      navigate(`/student/test-series/${pkg.id}`, { replace: true, state: { purchaseComplete: true } });
    }, 450);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <BackButton fallback={`/student/test-series/${pkg.id}`} className="mb-5" />
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Secure checkout</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-text">Complete your purchase</h1>
        <p className="mt-2 text-sm text-text/55">Get on-demand access to every available test in this series.</p>
      </header>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form id="series-checkout-form" onSubmit={completeDemoPayment} className="space-y-5">
          <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="font-display text-lg font-bold text-text">Payment method</h2>
            <p className="mt-1 text-sm text-text/50">Choose how you would like to pay.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {METHODS.map((item) => <button key={item} type="button" aria-pressed={method === item} onClick={() => setMethod(item)} className={`rounded-xl border px-3 py-4 text-sm font-semibold transition ${method === item ? "border-primary bg-primary text-white" : "border-text/10 bg-bg text-text/70 hover:border-primary/30"}`}>{item}</button>)}
            </div>
            {method === "Card" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-text/60 sm:col-span-2">Card number<input required inputMode="numeric" placeholder="1234 5678 9012 3456" className="mt-1.5 w-full rounded-xl border border-text/10 bg-bg px-4 py-3 text-sm outline-none focus:border-primary" /></label><label className="text-xs font-semibold text-text/60">Expiry date<input required placeholder="MM / YY" className="mt-1.5 w-full rounded-xl border border-text/10 bg-bg px-4 py-3 text-sm outline-none focus:border-primary" /></label><label className="text-xs font-semibold text-text/60">Security code<input required inputMode="numeric" placeholder="CVV" className="mt-1.5 w-full rounded-xl border border-text/10 bg-bg px-4 py-3 text-sm outline-none focus:border-primary" /></label></div>}
            {method === "UPI" && <label className="mt-4 block text-xs font-semibold text-text/60">UPI ID<input required placeholder="name@bank" className="mt-1.5 w-full rounded-xl border border-text/10 bg-bg px-4 py-3 text-sm outline-none focus:border-primary" /></label>}
            {method === "Net Banking" && <label className="mt-4 block text-xs font-semibold text-text/60">Select your bank<select className="mt-1.5 w-full rounded-xl border border-text/10 bg-bg px-4 py-3 text-sm outline-none focus:border-primary"><option>Choose a bank</option><option>State Bank of India</option><option>HDFC Bank</option><option>ICICI Bank</option><option>Axis Bank</option></select></label>}
            {method === "Wallet" && <p className="mt-4 rounded-xl bg-[#e7f1ef] p-3 text-sm text-[#28756f]">Wallet payment will be simulated in this frontend prototype.</p>}
          </section>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-text/10 bg-white p-4 text-sm text-text/65"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 accent-primary" /><span>I agree to the <a href="/terms" className="font-semibold text-primary">Terms of Service</a> and <a href="/refund-policy" className="font-semibold text-primary">Refund Policy</a>.</span></label>
          <p className="text-xs leading-5 text-text/45">Demo checkout only. No real payment is processed; selecting Pay records access in this browser for this student account.</p>
        </form>

        <aside className="h-fit rounded-2xl border border-text/10 bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold text-text">Order summary</h2>
          <div className="mt-4 rounded-xl bg-bg p-4"><p className="text-xs font-semibold uppercase tracking-wide text-text/45">Test series</p><p className="mt-1 font-semibold text-text">{pkg.title}</p><p className="mt-2 text-xs text-text/50">{pkg.numberOfTests} tests · {pkg.totalQuestions}+ questions · on-demand access</p></div>
          <div className="mt-4 space-y-2 border-b border-text/10 pb-4 text-sm"><div className="flex justify-between text-text/55"><span>Series price</span><span>₹{pkg.price.toLocaleString("en-IN")}</span></div><div className="flex justify-between text-text/55"><span>Discount</span><span>₹0</span></div></div>
          <div className="mt-4 flex justify-between font-display text-lg font-bold text-text"><span>Total</span><span>₹{pkg.price.toLocaleString("en-IN")}</span></div>
          <Button fullWidth className="mt-5" type="submit" form="series-checkout-form" disabled={!agreed || processing}>{processing ? "Processing…" : `Pay ₹${pkg.price.toLocaleString("en-IN")}`}</Button>
          <p className="mt-3 text-center text-[11px] text-text/40">Protected checkout · Demo payment flow</p>
        </aside>
      </div>
    </div>
  );
}
