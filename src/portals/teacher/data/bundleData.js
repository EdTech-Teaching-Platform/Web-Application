// Course bundles — pure data + pricing/validation helpers shared by the
// Course Builder (Pricing step, "Bundling"), My Courses > Bundles, the
// course details page, Publish Review, Earnings and Analytics.
//
// A bundle is owned by its first course (courseIds[0], the "primary"),
// which is the course whose builder it is edited from. Bundle SALES are not
// new money: they are existing course sales in the earnings seed that are
// tagged as having come through a bundle (see bundleSaleTag, consumed by
// seedEarnings), so Earnings / Analytics totals stay exactly reconciled.
import { TODAY } from "./teacherCourses";
import { computeEducatorEarnings, PLATFORM_COMMISSION_RATE } from "../components/contentData";

export { PLATFORM_COMMISSION_RATE };

export const MIN_NAME = 3;
export const MAX_NAME = 60;
export const MAX_EXTRA_COURSES = 8;
export const MAX_DISCOUNT_PCT = 70;

export const PRICING_MODE_LABELS = {
  percent: "Percentage discount",
  flat: "Flat discount (₹)",
  fixed: "Fixed bundle price (₹)",
};

// Static class strings (Tailwind needs full literals) for each pastel accent.
export const BUNDLE_ACCENTS = [
  { key: "blue", label: "Blue", bg: "bg-pastel-blue", ink: "text-pastel-blue-ink" },
  { key: "sage", label: "Sage", bg: "bg-pastel-sage", ink: "text-pastel-sage-ink" },
  { key: "lavender", label: "Lavender", bg: "bg-pastel-lavender", ink: "text-pastel-lavender-ink" },
  { key: "orange", label: "Orange", bg: "bg-pastel-orange", ink: "text-pastel-orange-ink" },
  { key: "pink", label: "Pink", bg: "bg-pastel-pink", ink: "text-pastel-pink-ink" },
];

export function accentFor(key) {
  return BUNDLE_ACCENTS.find((a) => a.key === key) || BUNDLE_ACCENTS[0];
}

export const TODAY_ISO = TODAY.toISOString().slice(0, 10);

export function daysBetween(fromIso, toIso) {
  return Math.round((new Date(`${toIso}T12:00:00`) - new Date(`${fromIso}T12:00:00`)) / 86400000);
}

export function emptyBundle(course) {
  const name = `${course.title || "New"} Bundle`.slice(0, MAX_NAME);
  return {
    id: `b-${Date.now()}`,
    enabled: true,
    status: "active",
    name,
    tagline: "",
    accent: "blue",
    courseIds: [course.id],
    pricingMode: "percent",
    discountValue: 15,
    startDate: TODAY_ISO,
    endDate: "",
    seatCap: "",
    couponsEnabled: true,
    access: "immediate",
    dripDays: 7,
    visibility: "public",
    sales: 0,
  };
}

export function isPublished(course) {
  return course?.status === "published";
}

// Courses an educator may ADD to a bundle: published only, never the owner.
export function splitEligible(courses, bundle) {
  const primaryId = bundle.courseIds[0];
  const others = courses.filter((c) => c.id !== primaryId && !bundle.courseIds.includes(c.id));
  return {
    eligible: others.filter(isPublished),
    hidden: others.filter((c) => !isPublished(c)),
  };
}

const num = (v) => (v === "" || v == null ? NaN : Number(v));

export function bundlePricing(bundle, coursesById) {
  const items = bundle.courseIds.map((id) => {
    const c = coursesById[id];
    return { id, title: c?.title || "Unavailable course", price: c && c.pricingModel !== "free" ? Number(c.price) || 0 : 0, course: c };
  });
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const v = num(bundle.discountValue);
  let final = subtotal;
  let error = null;

  if (Number.isNaN(v)) {
    error = "Enter a value to price this bundle.";
  } else if (bundle.pricingMode === "percent") {
    if (v < 1 || v > MAX_DISCOUNT_PCT) error = `Discount must be between 1% and ${MAX_DISCOUNT_PCT}%.`;
    else final = Math.round(subtotal * (1 - v / 100));
  } else if (bundle.pricingMode === "flat") {
    if (v <= 0) error = "Flat discount must be greater than 0.";
    else if (v >= subtotal) error = "Flat discount must be less than the combined course price.";
    else final = Math.round(subtotal - v);
  } else {
    if (v <= 0) error = "Bundle price must be greater than 0.";
    else if (v >= subtotal) error = `Bundle price must be below the combined course price (${subtotal.toLocaleString("en-IN")}).`;
    else final = Math.round(v);
  }

  if (!error && bundle.pricingMode === "percent" && final >= subtotal) error = "Discount is too small to change the price.";
  if (!error && final <= 0) error = "Bundle price must be above 0.";
  if (!error && subtotal <= 0) error = "Included courses have no price to discount.";

  const valid = !error;
  const shownFinal = valid ? final : subtotal;
  const savings = Math.max(0, subtotal - shownFinal);
  const savingsPct = subtotal > 0 ? Math.round((savings / subtotal) * 100) : 0;
  const { commission, earnings } = computeEducatorEarnings(shownFinal);
  return { items, subtotal, final: shownFinal, savings, savingsPct, commission, earnings, error, valid };
}

export function validateBundle(bundle, courses) {
  const coursesById = Object.fromEntries(courses.map((c) => [c.id, c]));
  const errors = {};
  const name = (bundle.name || "").trim();
  if (name.length < MIN_NAME) errors.name = `Bundle name must be at least ${MIN_NAME} characters.`;
  else if (name.length > MAX_NAME) errors.name = `Bundle name must be ${MAX_NAME} characters or fewer.`;

  const extra = bundle.courseIds.length - 1;
  if (extra < 1) errors.courses = "Add at least one more course to make a bundle.";
  else if (extra > MAX_EXTRA_COURSES) errors.courses = `A bundle can include at most ${MAX_EXTRA_COURSES} additional courses.`;

  const pricing = bundlePricing(bundle, coursesById);
  if (pricing.error) errors.pricing = pricing.error;

  if (!bundle.startDate) errors.startDate = "Choose a start date.";
  if (bundle.endDate && bundle.startDate && bundle.endDate <= bundle.startDate) errors.endDate = "End date must be after the start date.";
  if (bundle.seatCap !== "" && bundle.seatCap != null) {
    const n = Number(bundle.seatCap);
    if (!Number.isInteger(n) || n < 1) errors.seatCap = "Seat cap must be a whole number of 1 or more.";
  }
  if (bundle.access === "drip") {
    const d = Number(bundle.dripDays);
    if (!Number.isInteger(d) || d < 1 || d > 90) errors.dripDays = "Drip interval must be 1 to 90 days.";
  }
  return { errors, valid: Object.keys(errors).length === 0, pricing };
}

// Courses in the bundle that are no longer sellable (archived, or otherwise
// not published) — surfaced as a warning badge, never silently dropped.
export function bundleWarnings(bundle, coursesById) {
  return bundle.courseIds
    .map((id) => coursesById[id])
    .filter((c) => c && c.status === "archived")
    .map((c) => ({ id: c.id, title: c.title, reason: "archived" }));
}

export function countdownInfo(bundle) {
  if (bundle.startDate && bundle.startDate > TODAY_ISO) {
    return { tone: "info", label: `Starts in ${daysBetween(TODAY_ISO, bundle.startDate)} days` };
  }
  if (!bundle.endDate) return null;
  const left = daysBetween(TODAY_ISO, bundle.endDate);
  if (left < 0) return { tone: "ended", label: "Offer ended" };
  if (left === 0) return { tone: "urgent", label: "Ends today" };
  return { tone: left <= 7 ? "urgent" : "info", label: `Ends in ${left} day${left === 1 ? "" : "s"}` };
}

export function bundleDisplayStatus(bundle, coursesById) {
  if (bundle.status === "paused") return { status: "warning", label: "Paused" };
  if (!isPublished(coursesById[bundle.courseIds[0]])) return { status: "neutral", label: "Draft" };
  if (bundle.endDate && bundle.endDate < TODAY_ISO) return { status: "neutral", label: "Ended" };
  if (bundle.startDate && bundle.startDate > TODAY_ISO) return { status: "neutral", label: "Scheduled" };
  return { status: "success", label: "Live" };
}

// -- Seeds: three bundles built from the real seeded courses (c1/c2 are
// published, c6 is archived). `sales` is how many bundle purchases the
// seeded earnings ledger attributes to each; see bundleSaleTag.
export const BUNDLE_SEEDS = [
  {
    id: "b1", enabled: true, status: "active",
    name: "Design-to-Dev Bundle", tagline: "Systems thinking meets production-grade React.",
    accent: "blue", courseIds: ["c1", "c2"],
    pricingMode: "percent", discountValue: 20,
    startDate: "2026-08-15", endDate: "", seatCap: "", couponsEnabled: true,
    access: "immediate", dripDays: 7, visibility: "public", sales: 18,
  },
  {
    id: "b2", enabled: true, status: "paused",
    name: "Designer's Starter Pack", tagline: "Start with the basics, then level up your color craft.",
    accent: "orange", courseIds: ["c1", "c6"],
    pricingMode: "flat", discountValue: 500,
    startDate: "2026-07-01", endDate: "2026-12-31", seatCap: 200, couponsEnabled: false,
    access: "immediate", dripDays: 7, visibility: "public", sales: 6,
  },
  {
    id: "b3", enabled: true, status: "active",
    name: "Frontend + Systems Library", tagline: "Three courses, unlocked one week at a time.",
    accent: "sage", courseIds: ["c2", "c6", "c1"],
    pricingMode: "fixed", discountValue: 6499,
    startDate: "2026-09-01", endDate: "2026-10-10", seatCap: 50, couponsEnabled: true,
    access: "drip", dripDays: 7, visibility: "unlisted", sales: 9,
  },
];

// Slot map: course `courseId`'s Nth recent individual sale belongs to a
// bundle purchase, consumed sequentially so no sale is tagged twice.
const SLOT_MAP = (() => {
  const used = {};
  const map = {};
  BUNDLE_SEEDS.forEach((b) =>
    b.courseIds.forEach((cid) => {
      const start = used[cid] || 0;
      for (let k = 0; k < b.sales; k += 1) map[`${cid}:${start + k}`] = b;
      used[cid] = start + b.sales;
    })
  );
  return map;
})();

export function bundleSaleTag(courseId, saleIndex) {
  const b = SLOT_MAP[`${courseId}:${saleIndex}`];
  return b ? { bundleId: b.id, bundleName: b.name } : null;
}

// Revenue is read straight off the tagged ledger entries (net educator
// amounts), so it can only ever be a subset of the ledger's own total.
export function bundleLedgerRevenue(ledger, bundleId) {
  const rows = ledger.filter((e) => e.bundleId === bundleId && (e.type === "sale" || e.type === "clawback"));
  return Math.round(rows.reduce((s, e) => s + e.amount, 0) * 100) / 100;
}
