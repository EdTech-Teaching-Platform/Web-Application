import { useState } from "react";
import Switch from "../../../components/ui/Switch";
import LockedSection from "../../../components/ui/LockedSection";
import {
  CURRENCIES,
  PLATFORM_COMMISSION_RATE,
  computeEducatorEarnings,
  discountPercent,
  isPricingValid,
} from "./contentData";
import { InfoIcon, TagIcon, StarIcon, ChartIcon } from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";
import { formatMoney } from "../../../utils/formatMoney";
import BundlingStep from "./BundlingStep";

function SectionCard({ eyebrow, title, description, children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-white p-6 sm:p-7 ${className} shadow-soft`}>
      <div className="mb-6">
        {eyebrow && <span className="text-xs font-semibold uppercase tracking-wide text-primary/70">{eyebrow}</span>}
        <h2 className="mt-1 text-lg font-bold text-text">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ModelCard({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-start gap-1.5 rounded-2xl border px-5 py-4 text-left transition-colors duration-150 ${
        active ? "border-primary bg-primary/[0.06]" : "border-text/15 bg-bg hover:border-primary/50"
      }`}
    >
      <span className={`text-sm font-semibold ${active ? "text-primary" : "text-text"}`}>{title}</span>
      <span className="text-xs text-muted">{description}</span>
    </button>
  );
}

function PricePreviewCard({ course }) {
  const pct = discountPercent(course.price, course.compareAtPrice);

  return (
    <div className="overflow-hidden rounded-2xl bg-bg ring-1 ring-text/[0.06]">
      <div className="flex h-24 items-center justify-center bg-gradient-to-br from-rotation-1/40 to-rotation-2/30 text-xs font-semibold text-muted">
        {course.thumbnail ? (
          <img src={course.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          "Course thumbnail"
        )}
      </div>
      <div className="p-4">
        <p className="truncate text-sm font-semibold text-text">{course.title || "Your course title"}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{course.instructor?.name}</p>
        <div className="mt-2.5 flex items-center gap-2">
          {course.pricingModel === "free" ? (
            <span className="text-lg font-bold text-success">Free</span>
          ) : (
            <>
              <span className="text-lg font-bold text-text">
                {formatMoney(course.price || 0, course.currency)}
              </span>
              {pct > 0 && (
                <>
                  <span className="text-sm text-muted line-through">
                    {formatMoney(course.compareAtPrice, course.currency)}
                  </span>
                  <span className="rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">
                    {pct}% off
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted">
          <StarIcon className="h-3.5 w-3.5 text-warning" />
          {course.ratingCount ? course.rating : "No ratings yet"}
        </div>
      </div>
    </div>
  );
}

function RevenueBreakdown({ course }) {
  const { commission, earnings } = computeEducatorEarnings(course.price);
  const price = Number(course.price) || 0;

  return (
    <div className="rounded-2xl border border-dashed border-text/15 bg-bg p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <ChartIcon className="h-3.5 w-3.5" />
          Revenue breakdown, per sale
        </span>
        <span className="group relative">
          <InfoIcon className="h-3.5 w-3.5 cursor-help text-muted" />
          <span className="pointer-events-none absolute right-0 top-6 z-10 w-56 rounded-xl bg-text px-3 py-2 text-[11px] leading-relaxed text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
            Commission is captured at the moment of each sale — a later rate change never applies retroactively to
            past sales.
          </span>
        </span>
      </div>

      <dl className="flex flex-col gap-2.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">List price</dt>
          <dd className="font-medium text-text">
            {formatMoney(price, course.currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted">Platform commission ({Math.round(PLATFORM_COMMISSION_RATE * 100)}%)</dt>
          <dd className="font-medium text-danger">
            −{formatMoney(commission, course.currency)}
          </dd>
        </div>
        <div className="my-1 border-t border-dashed border-text/15" />
        <div className="flex items-center justify-between">
          <dt className="font-semibold text-text">Your estimated earnings</dt>
          <dd className="text-lg font-bold text-success">
            {formatMoney(earnings, course.currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

// PricingForm — Course Builder Part 4, Pricing step. Reads/writes the
// shared course draft via useCourseBuilder-supplied props so the live
// preview card and readiness checklist downstream see the exact same
// numbers, not a separately hardcoded example.
export default function PricingForm({ course, onChange, locked, forceShowError = false }) {
  const [priceTouched, setPriceTouched] = useState(false);
  const touched = priceTouched || forceShowError;
  const valid = isPricingValid(course);
  const showError = course.pricingModel === "paid" && touched && !valid;

  function set(patch) {
    onChange({ ...course, ...patch });
  }

  return (
    <div className="flex flex-col gap-6">
      <LockedSection locked={locked} reason="Pricing can't be edited while this course is under review.">
        <div className="flex flex-col gap-6">
          <SectionCard eyebrow="Step 1" title="Pricing model" description="How students pay to access this course.">
            <div className="grid gap-3 sm:grid-cols-2">
              <ModelCard
                active={course.pricingModel === "free"}
                title="Free"
                description="Open to every enrolled student, no charge."
                onClick={() => set({ pricingModel: "free" })}
              />
              <ModelCard
                active={course.pricingModel === "paid"}
                title="One-Time Paid"
                description="A single purchase unlocks the full course."
                onClick={() => set({ pricingModel: "paid" })}
              />
            </div>
          </SectionCard>

          <div
            className={`grid gap-6 overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${
              course.pricingModel === "paid" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0">
              <SectionCard eyebrow="Step 2" title="Price details" description="The price is a key decision — make it prominent and clear.">
                <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                  <div className="flex flex-col gap-5">
                    <div>
                      <span className="mb-1.5 block text-sm font-medium text-text">Price</span>
                      <div className="flex items-center gap-2">
                        <Select
                          wrapperClassName="block shrink-0"
                          value={course.currency}
                          onChange={(e) => set({ currency: e.target.value })}
                          className="rounded-full border border-text/15 bg-bg px-3.5 py-3.5 pr-9 text-sm font-semibold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.symbol} {c.code}
                            </option>
                          ))}
                        </Select>
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={course.price}
                          onBlur={() => setPriceTouched(true)}
                          onChange={(e) => set({ price: e.target.value === "" ? "" : Number(e.target.value) })}
                          placeholder="1999"
                          aria-invalid={showError}
                          className={`w-full rounded-2xl border bg-bg px-4 py-3.5 text-2xl font-bold text-text outline-none transition-colors duration-150 placeholder:text-muted ${
                            showError
                              ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/15"
                              : "border-text/15 focus:border-primary focus:ring-2 focus:ring-primary/15"
                          }`}
                        />
                      </div>
                      {showError && <span className="mt-1.5 block text-xs text-danger">Enter a price greater than 0 to continue.</span>}
                    </div>

                    <div>
                      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
                        Compare-at price <span className="font-normal text-muted">(optional)</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min={0}
                          step="1"
                          value={course.compareAtPrice ?? ""}
                          onChange={(e) => set({ compareAtPrice: e.target.value === "" ? null : Number(e.target.value) })}
                          placeholder="Original price, e.g. 2999"
                          className="w-full rounded-xl border border-text/15 bg-bg px-4 py-2.5 text-sm text-text outline-none transition-colors duration-150 placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                        {discountPercent(course.price, course.compareAtPrice) > 0 && (
                          <span className="shrink-0 rounded-full bg-success/12 px-3 py-1.5 text-xs font-semibold text-success">
                            {discountPercent(course.price, course.compareAtPrice)}% off
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-muted">Shown as a strikethrough discount on the public course card.</p>
                    </div>

                    <RevenueBreakdown course={course} />
                  </div>

                  <div>
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
                      Public card preview
                    </span>
                    <PricePreviewCard course={course} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard eyebrow="Step 3" title="Discounts & coupons" className="mt-6">
                <Switch
                  checked={Boolean(course.couponsEnabled)}
                  onChange={(v) => set({ couponsEnabled: v })}
                  label={
                    <span className="flex items-center gap-1.5">
                      <TagIcon className="h-4 w-4" /> Allow coupons on this course
                    </span>
                  }
                  description="Students can redeem a platform coupon code at checkout"
                />
                <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-text/[0.05] px-4 py-3 text-xs text-muted">
                  <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Coupon codes themselves are created and managed by the platform team, not per course — this toggle
                  only controls whether this course can accept them.
                </div>
              </SectionCard>
            </div>
          </div>

          <BundlingStep course={course} locked={locked} />
        </div>
      </LockedSection>
    </div>
  );
}

export function pricingHasError(course, touched) {
  return course.pricingModel === "paid" && touched && !isPricingValid(course);
}
