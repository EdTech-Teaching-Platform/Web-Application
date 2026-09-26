// Payment success / failure
// Jira: Day 3 — Payment success / failure
// Doc reference: Sec 5.10 ("Payment Success / Failure States — clear
// feedback on the outcome of a payment attempt. Status is confirmed by
// the provider, not assumed from a redirect.")
//
// Route: /student/paymentresult — normally reached via router state from
// Checkout.jsx ({ status, orderId, amount, method, courseId, courseTitle,
// educator, timestamp }); also readable via ?status=success|failed|pending
// query params directly, so each of the four states can be opened/QA'd
// without re-running the whole checkout flow.
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import BackButton from "../../../components/common/BackButton";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import { getDemoOrder, getPaymentStatus } from "../services/checkoutApi";
import { DownloadIcon, RefreshIcon, MailIcon } from "../../../components/ui/icons";
import { useAuth } from "../../../hooks/useAuth";
import { getCourseById } from "../../../data/catalogMock";
import { formatClassStart, getLiveCourseSchedule } from "../data/liveCourseSchedule";
import { enrollStudentInCourse } from "../data/studentLocalState";

function buildInvoiceText(data) {
  return [
    "UNIVERSAL LEARNING — PAYMENT RECEIPT",
    "",
    `Order ID: ${data.orderId}`,
    `Course: ${data.courseTitle}`,
    `Educator: ${data.educator}`,
    `Amount Paid: ₹${data.amount}`,
    `Payment Method: ${data.method}`,
    `Date: ${new Date(data.timestamp ?? Date.now()).toLocaleString("en-IN")}`,
    "",
    "Thank you for learning with Universal Learning.",
  ].join("\n");
}

export default function PaymentResult() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const orderId = location.state?.orderId || searchParams.get("orderId");
  const data = (location.state?.orderId ? location.state : null) || getDemoOrder(orderId, user?.identifier || user?.id);
  const course = data ? getCourseById(data.courseId) : null;
  const isLiveCourse = course?.courseType === "Live";

  const [status, setStatus] = useState(data?.status || "missing");
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const liveSchedule = isLiveCourse ? getLiveCourseSchedule(course.id, now) : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (status === "success" && isLiveCourse && course) {
      enrollStudentInCourse(course.id, user);
    }
  }, [status, isLiveCourse, course, user]);

  async function handleCheckStatus() {
    setChecking(true);
    const res = await getPaymentStatus(data.orderId);
    setChecking(false);
    setStatus(res.data.status);
  }

  function handleDownloadInvoice() {
    const blob = new Blob([buildInvoiceText(data)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.orderId}-receipt.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
        <BackButton fallback="/student/orders" className="mb-6 self-start" />
        <ConfirmationCard
          state="warning"
          heading="No payment record found"
          message="Open this page from checkout or your order history to view a payment result. A status in the page address alone doesn't confirm a payment."
          primaryAction={<Button onClick={() => navigate("/student/orders")}>View Orders</Button>}
          secondaryAction={<Button variant="secondary" onClick={() => navigate("/student/explore")}>Explore Courses</Button>}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <BackButton fallback="/student/dashboard" className="mb-6 self-start" />
      {status === "processing" && (
        <ConfirmationCard
          state="pending"
          heading="Confirming your payment…"
          message="This usually takes just a few seconds. Please don't close this page."
        />
      )}

      {status === "pending" && (
        <ConfirmationCard
          state="warning"
          heading="We're confirming your payment"
          message={`Order ${data.orderId} is still being processed by your bank/UPI app. You'll get access to "${data.courseTitle}" automatically the moment it's confirmed — no need to pay again.`}
          primaryAction={
            <Button onClick={handleCheckStatus} disabled={checking}>
              <RefreshIcon className="h-4 w-4" /> {checking ? "Checking…" : "Check Status"}
            </Button>
          }
          secondaryAction={
            <Button variant="secondary" onClick={() => navigate("/student/dashboard")}>
              Go to Dashboard
            </Button>
          }
        />
      )}

      {status === "success" && isLiveCourse && liveSchedule && (
        <div className="space-y-4">
          <ConfirmationCard
            state="success"
            heading="Live class enrollment confirmed"
            message={`Your demo enrollment for "${data.courseTitle}" is ready. No real payment was processed. Order ${data.orderId} · ₹${data.amount}.`}
          />
          <section className="rounded-2xl border border-text/10 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Your class schedule</p>
            <h2 className="mt-2 font-display text-xl font-bold text-text">{liveSchedule.classTitle}</h2>
            <p className="mt-1 text-sm text-text/55">{liveSchedule.courseTitle} · {liveSchedule.educator}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-bg p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-text/45">Date</p><p className="mt-1 text-sm font-semibold text-text">{liveSchedule.date}</p></div>
              <div className="rounded-xl bg-bg p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-text/45">Time · duration</p><p className="mt-1 text-sm font-semibold text-text">{liveSchedule.time} · {liveSchedule.duration}</p></div>
            </div>
            <p className="mt-3 text-xs text-text/50">{liveSchedule.status === "live" ? "Your class has started. Join the live class now." : `Class starts ${formatClassStart(liveSchedule.startAt)}. The join button will appear when it begins.`}</p>
            <Button className="mt-4" onClick={() => navigate(liveSchedule.status === "live" ? `/student/liveclassjoin?session=${liveSchedule.id}&join=1` : `/student/live-course?course=${course.id}`)}>
              {liveSchedule.status === "live" ? "Join Live Class" : "View Class Schedule"}
            </Button>
            <div className="mt-3 flex gap-3">
              <Button fullWidth variant="secondary" onClick={() => navigate("/student/dashboard")}>Go to Dashboard</Button>
              <Button fullWidth variant="secondary" onClick={handleDownloadInvoice}><DownloadIcon className="h-4 w-4" /> Invoice</Button>
            </div>
          </section>
        </div>
      )}

      {status === "success" && !isLiveCourse && (
        <ConfirmationCard
          state="success"
          heading="Demo Payment Complete"
          message={`Your demo enrollment for "${data.courseTitle}" is ready in this browser. No real payment was processed. Order ${data.orderId} · ₹${data.amount} · ${new Date(data.timestamp).toLocaleDateString("en-IN")}.`}
          primaryAction={
            <Button onClick={() => navigate(`/student/courseplayer?course=${data.courseId}`)}>Start Learning</Button>
          }
          secondaryAction={
            <div className="flex gap-3">
              <Button variant="secondary" fullWidth onClick={() => navigate("/student/dashboard")}>
                Go to Dashboard
              </Button>
              <Button variant="secondary" fullWidth onClick={handleDownloadInvoice}>
                <DownloadIcon className="h-4 w-4" /> Invoice
              </Button>
            </div>
          }
        />
      )}

      {status === "failed" && (
        <ConfirmationCard
          state="failure"
          heading="Payment Failed"
          message={`We couldn't process your payment for "${data.courseTitle}". You have not been charged. Order reference: ${data.orderId}.`}
          primaryAction={
            <Button onClick={() => navigate("/student/checkout", { state: { courseId: data.courseId } })}>
              Retry Payment
            </Button>
          }
          secondaryAction={
            <div className="flex flex-col gap-3">
              <Button
                variant="secondary"
                onClick={() => navigate("/student/checkout", { state: { courseId: data.courseId } })}
              >
                Change Payment Method
              </Button>
              <a
                href="mailto:support@universallearning.app"
                className="flex items-center justify-center gap-2 rounded-full border border-primary bg-bg px-6 py-3 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary/5"
              >
                <MailIcon className="h-4 w-4" /> Contact Support
              </a>
            </div>
          }
        />
      )}
    </div>
  );
}
