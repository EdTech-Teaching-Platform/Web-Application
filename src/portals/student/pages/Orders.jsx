import { useState } from "react";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import Modal from "../../../components/ui/Modal";
import { DownloadIcon, WalletIcon } from "../../../components/ui/icons";

const ORDERS = [
  { id: "UL-24091", item: "Complete Python Bootcamp", educator: "Priya Sharma", date: "September 12, 2026", amount: "₹1,499", status: "Paid", invoice: "INV-24091" },
  { id: "UL-24022", item: "Algebra Foundations", educator: "Rohan Mehta", date: "August 30, 2026", amount: "₹899", status: "Paid", invoice: "INV-24022" },
];

export default function Orders() {
  const [tab, setTab] = useState("Orders");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundSubmitted, setRefundSubmitted] = useState(false);
  const [refundCourseId, setRefundCourseId] = useState(ORDERS[0].id);
  const refundCourse = ORDERS.find((order) => order.id === refundCourseId) || ORDERS[0];
  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Account</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text">Orders & payments</h1>
      <p className="mt-2 text-sm text-text/60">Review purchases, wallet activity and refund status in one place.</p>
      <div className="mt-6 flex flex-wrap gap-2 border-b border-text/10 pb-3">{["Orders", "Wallet", "Refunds"].map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === item ? "border-primary text-primary" : "border-transparent text-text/50 hover:text-text"}`}>{item}</button>)}</div>
      {tab === "Orders" && <div className="mt-5 overflow-hidden rounded-xl border border-text/10 bg-white">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.7fr_0.8fr] gap-4 border-b border-text/10 bg-bg px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-text/45 md:grid"><span>Course</span><span>Order ID</span><span>Date</span><span>Amount</span><span>Status</span></div>
        {ORDERS.map((order) => <div key={order.id} className="grid gap-3 border-b border-text/10 px-5 py-5 last:border-0 md:grid-cols-[1.4fr_1fr_1fr_0.7fr_0.8fr] md:items-center md:gap-4"><div><p className="font-semibold text-text">{order.item}</p><p className="mt-1 text-xs text-text/50">{order.educator}</p></div><p className="text-sm text-text/60">{order.id}</p><p className="text-sm text-text/60">{order.date}</p><p className="font-semibold text-text">{order.amount}</p><div className="flex items-center justify-between gap-3"><StatusBadge status="success">{order.status}</StatusBadge><button type="button" onClick={() => window.print()} className="text-primary" aria-label={`Download invoice ${order.invoice}`}><DownloadIcon className="h-4 w-4" /></button></div></div>)}
      </div>}
      {tab === "Wallet" && <div className="mt-6 grid gap-5 md:grid-cols-[0.8fr_1.2fr]"><div className="rounded-2xl bg-primary p-6 text-white"><WalletIcon className="h-7 w-7" /><p className="mt-8 text-sm text-white/70">Available balance</p><p className="mt-1 font-display text-4xl font-bold">₹750</p><Button fullWidth={false} variant="inverse" className="mt-6">Add funds</Button></div><div className="rounded-2xl border border-text/10 bg-white p-6"><h2 className="font-display text-lg font-semibold">Wallet activity</h2><div className="mt-5 space-y-4 text-sm"><div className="flex justify-between border-b border-text/10 pb-3"><span>Course credit · Sep 12</span><strong className="text-danger">−₹500</strong></div><div className="flex justify-between border-b border-text/10 pb-3"><span>Promotional credit · Sep 1</span><strong className="text-success">+₹1,250</strong></div><p className="text-xs text-text/45">Wallet balance and deductions are confirmed by the payment service.</p></div></div></div>}
      {tab === "Refunds" && <div className="mt-6 rounded-2xl border border-text/10 bg-white p-6"><h2 className="font-display text-lg font-semibold">Refund requests</h2><div className="mt-5 rounded-2xl bg-bg p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Complete Python Bootcamp</p><p className="mt-1 text-sm text-text/55">Requested September 15, 2026 · ₹1,499</p></div><StatusBadge status="warning">Under review</StatusBadge></div><p className="mt-4 text-sm text-text/60">We’ll notify you when eligibility is confirmed. Refunds are returned to the original payment method.</p></div><Button fullWidth={false} variant="secondary" className="mt-5" onClick={() => { setRefundSubmitted(false); setRefundOpen(true); }}>Start a refund request</Button></div>}
      <Modal
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        title={refundSubmitted ? "Refund request submitted" : "Start a refund request"}
        footer={!refundSubmitted && (
          <>
            <Button onClick={() => setRefundSubmitted(true)}>Submit refund request</Button>
            <Button variant="secondary" onClick={() => setRefundOpen(false)}>Cancel</Button>
          </>
        )}
      >
        {refundSubmitted ? (
          <div className="text-center">
            <p className="font-semibold text-success">Your request is under review.</p>
            <p className="mt-2 text-sm leading-6 text-text/60">We’ll notify you when eligibility is confirmed and keep the status updated in Refunds.</p>
            <Button fullWidth={false} variant="secondary" className="mt-5" onClick={() => setRefundOpen(false)}>Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-text">
              Which course is this refund for?
              <select value={refundCourseId} onChange={(event) => setRefundCourseId(event.target.value)} className="mt-2 w-full rounded-2xl bg-text/5 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                {ORDERS.map((order) => <option key={order.id} value={order.id}>{order.item} · {order.amount}</option>)}
              </select>
            </label>
            <div className="rounded-2xl bg-primary/5 p-4 text-sm">
              <p className="font-semibold text-text">{refundCourse.item}</p>
              <p className="mt-1 text-xs text-text/55">{refundCourse.amount} · Purchased {refundCourse.date}</p>
            </div>
            <label className="block text-sm font-medium text-text">
              Reason for refund
              <select defaultValue="" className="mt-2 w-full rounded-2xl bg-text/5 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30">
                <option value="" disabled>Select a reason</option>
                <option>Course content did not meet expectations</option>
                <option>Accidental purchase</option>
                <option>Technical issue</option>
                <option>Duplicate payment</option>
                <option>Other</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-text">
              Additional details <span className="font-normal text-text/45">(optional)</span>
              <textarea className="mt-2 min-h-24 w-full rounded-2xl bg-text/5 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="Tell us more about your request" />
            </label>
            <p className="text-xs leading-5 text-text/50">Refund eligibility is reviewed according to our refund policy. Approved refunds are returned to the original payment method.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
