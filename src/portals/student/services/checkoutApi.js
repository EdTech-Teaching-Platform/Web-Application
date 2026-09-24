import apiClient from "../../../services/apiClient";
import { getCourseById } from "../../../data/catalogMock";

// Checkout & Payment API layer — Doc ref: Sec 5.10 (Commerce & Payments).
// No payment-gateway/backend endpoints are confirmed yet (the doc itself
// only says "e.g. a Razorpay-class gateway"), so this stays in DEMO_MODE,
// same pattern as src/auth/services/authApi.js — flip the flag once real
// endpoints exist, no call site changes needed.
//
// The one rule every function here exists to enforce: price and payment
// status are NEVER computed/trusted on the client. Every summary and every
// payment outcome comes back from this layer as if it were a server
// response — Checkout.jsx only ever renders what these functions return,
// it never does its own math on discounts/coupons/wallet/total.
const DEMO_MODE = true;

function demoDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Demo coupon table — stands in for server-side coupon validation.
const COUPONS = {
  WELCOME20: { discountType: "percent", value: 20, label: "WELCOME20 — 20% off" },
  FLAT150: { discountType: "flat", value: 150, label: "FLAT150 — ₹150 off" },
  EXPIRED10: { expired: true },
  BIGSPENDER: { discountType: "percent", value: 15, label: "BIGSPENDER — 15% off", minAmount: 1500 },
};

const WALLET_BALANCE = 350;

function computeSummary(course, { couponCode, useWallet } = {}) {
  const originalPrice = course.originalPrice ?? course.price;
  const listPrice = course.price;
  const listDiscount = Math.max(originalPrice - listPrice, 0);

  let couponDiscount = 0;
  let couponResult = null;
  if (couponCode) {
    const code = couponCode.trim().toUpperCase();
    const coupon = COUPONS[code];
    if (!coupon) {
      couponResult = { ok: false, code, reason: "invalid" };
    } else if (coupon.expired) {
      couponResult = { ok: false, code, reason: "expired" };
    } else if (coupon.minAmount && listPrice < coupon.minAmount) {
      couponResult = { ok: false, code, reason: "not_applicable", minAmount: coupon.minAmount };
    } else {
      couponDiscount =
        coupon.discountType === "percent" ? Math.round((listPrice * coupon.value) / 100) : coupon.value;
      couponResult = { ok: true, code, label: coupon.label, amount: couponDiscount };
    }
  }

  const afterCoupon = Math.max(listPrice - couponDiscount, 0);
  const walletApplied = useWallet ? Math.min(WALLET_BALANCE, afterCoupon) : 0;
  const payable = Math.max(afterCoupon - walletApplied, 0);

  return {
    course: { id: course.id, title: course.title, educator: course.subtitle, image: course.image },
    originalPrice,
    listPrice,
    listDiscount,
    coupon: couponResult,
    couponDiscount,
    walletBalance: WALLET_BALANCE,
    walletApplied,
    payable,
    currency: "INR",
  };
}

export async function getCheckoutSummary(courseId, opts = {}) {
  if (DEMO_MODE) {
    await demoDelay(500);
    const course = getCourseById(courseId);
    if (!course) return { data: null };
    return { data: computeSummary(course, opts) };
  }
  return apiClient.get("/checkout/summary", { params: { courseId, ...opts } });
}

export async function getWallet() {
  if (DEMO_MODE) {
    await demoDelay(250);
    return { data: { balance: WALLET_BALANCE } };
  }
  return apiClient.get("/wallet");
}

// Simulates the hosted-checkout provider's own confirmation, arriving as a
// webhook would (never assumed from a client redirect) — see Checkout.jsx.
// method: "card" | "upi" | "netbanking" | "wallet"
export async function initiatePayment(courseId, opts = {}) {
  if (DEMO_MODE) {
    await demoDelay(1400);
    const course = getCourseById(courseId);
    const summary = computeSummary(course ?? {}, opts);
    const codeUpper = (opts.couponCode || "").toUpperCase();
    let status = "success";
    if (codeUpper === "FAILTEST") status = "failed";
    else if (codeUpper === "PENDINGTEST") status = "pending";
    else {
      const roll = Math.random();
      status = roll < 0.72 ? "success" : roll < 0.9 ? "failed" : "pending";
    }
    return {
      data: {
        orderId: `ORD${Date.now().toString().slice(-8)}`,
        status,
        amount: summary.payable,
        method: opts.method ?? "card",
        courseTitle: course?.title,
        educator: course?.subtitle,
        timestamp: new Date().toISOString(),
      },
    };
  }
  return apiClient.post("/checkout/pay", { courseId, ...opts });
}

// Used by the "Payment Pending" state's Check Status action — polls for a
// provider-confirmed outcome rather than ever inferring one client-side.
export async function getPaymentStatus(orderId) {
  if (DEMO_MODE) {
    await demoDelay(900);
    const status = Math.random() < 0.6 ? "success" : "pending";
    return { data: { orderId, status } };
  }
  return apiClient.get(`/checkout/status/${orderId}`);
}
