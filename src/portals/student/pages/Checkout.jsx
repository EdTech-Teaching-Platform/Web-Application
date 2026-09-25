// Checkout & payment UI
// Jira: Day 3 — Checkout & payment UI
// Doc reference: Sec 5.10 ("Checkout & Payment Gateway — hosted checkout
// with a provider, price computed server-side. Payment Success/Failure —
// status confirmed by the provider, not assumed from a redirect. Wallet —
// balance-based, tied to the student. Coupons — code-based, validated
// server-side.")
//
// Route: /student/checkout, expects either router state
// { courseId, couponCode? } (set by CourseDetails.jsx's Enroll/Wishlist
// Buy Now flows) or a ?course= query param (direct link / demo).
//
// Everything priced on this screen comes from checkoutApi.getCheckoutSummary
// — never computed here — per the doc's explicit rule that the payable
// amount is server-authoritative.
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import BackButton from "../../../components/common/BackButton";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import PaymentMethodSelector from "../components/PaymentMethodSelector";
import { getCourseById } from "../../../data/catalogMock";
import {
  getCheckoutSummary,
  initiatePayment,
} from "../services/checkoutApi";
import {
  ShieldCheckIcon,
  TagIcon,
  WalletIcon,
  XCircleIcon,
  CheckIcon,
} from "../../../components/ui/icons";

function SummaryRow({ label, value, muted = false, strong = false }) {
  return (
    <div className={`flex items-center justify-between text-sm ${strong ? "font-semibold text-text" : muted ? "text-text/50" : "text-text/70"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-4 w-full animate-pulse rounded-full bg-text/10" />
      ))}
    </div>
  );
}

export default function Checkout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const courseId = location.state?.courseId ?? searchParams.get("course") ?? "c1";
  const course = getCourseById(courseId);

  const [couponCode, setCouponCode] = useState(location.state?.couponCode ?? "");
  const [couponInput, setCouponInput] = useState(location.state?.couponCode ?? "");
  const [useWallet, setUseWallet] = useState(false);
  const [method, setMethod] = useState("card");
  const [agreed, setAgreed] = useState(false);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [couponApplying, setCouponApplying] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!course) return;
    let cancelled = false;
    setSummaryLoading(true);
    getCheckoutSummary(course.id, { couponCode, useWallet }).then((res) => {
      if (cancelled) return;
      setSummary(res.data);
      setSummaryLoading(false);
      setCouponApplying(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.id, couponCode, useWallet]);

  if (!course) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-display text-xl font-semibold text-text">Nothing to check out</h1>
        <p className="mt-2 text-sm text-text/60">We couldn't find that course. Head back to Explore to pick one.</p>
        <Button fullWidth={false} className="mt-6" onClick={() => navigate("/explore")}>
          Back to Explore
        </Button>
      </div>
    );
  }

  if (course.status === "archived") {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <ConfirmationCard
          state="warning"
          heading="This course isn't available for purchase"
          message={`"${course.title}" has been archived and is no longer accepting new enrollments.`}
          primaryAction={<Button onClick={() => navigate("/explore")}>Browse similar courses</Button>}
        />
      </div>
    );
  }

  if (course.enrolled) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <ConfirmationCard
          state="success"
          heading="You're already enrolled"
          message={`You already have access to "${course.title}".`}
          primaryAction={
            <Button onClick={() => navigate(`/student/courseplayer?course=${course.id}`)}>Go to Course</Button>
          }
        />
      </div>
    );
  }

  function handleApplyCoupon() {
    if (!couponInput.trim()) return;
    setCouponApplying(true);
    setCouponCode(couponInput.trim());
  }

  function handleRemoveCoupon() {
    setCouponCode("");
    setCouponInput("");
  }

  async function handlePay() {
    setProcessing(true);
    const res = await initiatePayment(course.id, { couponCode, useWallet, method: summary?.payable === 0 ? "wallet" : method });
    setProcessing(false);
    navigate("/student/paymentresult", {
      state: {
        status: res.data.status,
        orderId: res.data.orderId,
        amount: res.data.amount,
        method: res.data.method,
        courseId: course.id,
        courseTitle: course.title,
        educator: course.subtitle,
        timestamp: res.data.timestamp,
      },
    });
  }

  if (processing) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <ConfirmationCard state="pending" heading="Confirming your payment…" message="Please don't close or refresh this page." />
      </div>
    );
  }

  const fullyCoveredByWallet = summary && summary.payable === 0;
  const canPay = agreed && !summaryLoading && (fullyCoveredByWallet || Boolean(method));

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-8">
      <BackButton fallback={course ? `/course/${course.id}` : "/student/my-learning"} label="Back" className="mb-5" />
      <h1 className="font-display text-2xl font-bold text-text">Checkout</h1>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-text/60">
        <ShieldCheckIcon className="h-4 w-4 text-success" /> Payments are securely processed by our payment partner.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          <div className="flex items-center gap-4 rounded-3xl bg-white p-5">
            <img src={course.image} alt={course.title} className="h-16 w-24 shrink-0 rounded-xl object-cover" />
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-text">{course.title}</p>
              <p className="text-sm text-text/60">{course.subtitle}</p>
            </div>
          </div>

          {/* Wallet */}
          <div className="rounded-3xl bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-text">
              <WalletIcon className="h-4 w-4" /> Wallet
            </h2>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span className="text-sm text-text/70">
                Available balance: <span className="font-semibold text-text">₹{summary?.walletBalance ?? "—"}</span>
              </span>
              <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(e) => setUseWallet(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-text/15 transition-colors duration-150 peer-checked:bg-primary" />
                <span className="absolute left-1 h-4 w-4 rounded-full bg-white transition-transform duration-150 peer-checked:translate-x-5" />
              </span>
            </label>
            {useWallet && summary && (
              <p className="mt-2 text-xs text-text/50">
                ₹{summary.walletApplied} will be deducted from your wallet
                {summary.walletApplied < summary.walletBalance ? "" : " (covers full balance used)"}.
              </p>
            )}
          </div>

          {/* Payment method */}
          {!fullyCoveredByWallet && (
            <div className="rounded-3xl bg-white p-5">
              <h2 className="mb-3 font-display text-base font-semibold text-text">Payment Method</h2>
              <PaymentMethodSelector value={method} onChange={setMethod} disabled={processing} />
            </div>
          )}

          <label className="flex items-center gap-3 rounded-3xl bg-white p-5 text-sm leading-5 text-text/70">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-text/30 text-primary focus:ring-primary/30"
            />
            <span className="min-w-0">
              I agree to the{" "}
              <a href="/terms" className="font-semibold text-primary hover:underline">Terms of Service</a>
              {" "}and{" "}
              <a href="/refund-policy" className="font-semibold text-primary hover:underline">Refund Policy</a>.
            </span>
          </label>
        </div>

        {/* Sticky order summary */}
        <aside className="space-y-4 lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-3xl bg-white p-6">
            <h2 className="mb-4 font-display text-base font-semibold text-text">Order Summary</h2>
            {summaryLoading || !summary ? (
              <SummarySkeleton />
            ) : (
              <div className="space-y-2.5">
                <SummaryRow label="Original price" value={`₹${summary.originalPrice}`} muted />
                {summary.listDiscount > 0 && <SummaryRow label="Course discount" value={`− ₹${summary.listDiscount}`} muted />}
                {summary.coupon?.ok && <SummaryRow label={`Coupon (${summary.coupon.code})`} value={`− ₹${summary.couponDiscount}`} />}
                {summary.walletApplied > 0 && <SummaryRow label="Wallet applied" value={`− ₹${summary.walletApplied}`} />}
                <div className="my-2 border-t border-text/10" />
                <SummaryRow label="Payable amount" value={summary.payable === 0 ? "₹0" : `₹${summary.payable}`} strong />
                <p className="pt-1 text-[11px] text-text/40">
                  Final amount is calculated securely by our payment system at the time of payment.
                </p>
              </div>
            )}

            <Button
              className="mt-6"
              disabled={!canPay}
              onClick={handlePay}
            >
              {fullyCoveredByWallet ? "Complete Enrollment" : summary ? `Pay ₹${summary.payable}` : "Pay"}
            </Button>
          </div>

          <div className="rounded-3xl bg-white p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-text">
              <TagIcon className="h-4 w-4" /> Coupon
            </h2>
            {summary?.coupon?.ok ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-success/10 px-4 py-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium text-success">
                  <CheckIcon className="h-4 w-4 shrink-0" /> <span>{summary.coupon.label} applied — saved ₹{summary.coupon.amount}</span>
                </span>
                <button type="button" onClick={handleRemoveCoupon} className="shrink-0 text-xs font-semibold text-text/50 hover:text-text">Remove</button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter coupon code"
                    aria-label="Coupon code"
                    className="w-full min-w-0 rounded-full border border-text/15 bg-bg px-4 py-2.5 text-sm text-text outline-none focus:border-primary"
                  />
                  <Button fullWidth={false} variant="secondary" onClick={handleApplyCoupon} disabled={couponApplying || !couponInput.trim()}>
                    {couponApplying ? "Checking…" : "Apply"}
                  </Button>
                </div>
                {summary?.coupon && !summary.coupon.ok && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
                    <XCircleIcon className="h-3.5 w-3.5 shrink-0" />
                    {summary.coupon.reason === "invalid" && "That coupon code isn't valid."}
                    {summary.coupon.reason === "expired" && "That coupon has expired."}
                    {summary.coupon.reason === "not_applicable" && `This coupon needs a minimum order of ₹${summary.coupon.minAmount}.`}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[#d9e9e5] bg-[#eef7f4] p-4">
            <p className="text-xs font-semibold text-[#28756f]">Need help checking out?</p>
            <p className="mt-1 text-xs leading-5 text-text/55">Our support team can help with payment or enrollment questions.</p>
            <button type="button" onClick={() => navigate("/student/help-complaints")} className="mt-2 text-xs font-semibold text-[#28756f] hover:underline">Contact support →</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
