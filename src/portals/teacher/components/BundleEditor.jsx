import { useMemo, useState } from "react";
import Input from "../../../components/ui/Input";
import Switch from "../../../components/ui/Switch";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import ProgressRing from "../../../components/ui/ProgressRing";
import StatusBadge from "../../../components/ui/StatusBadge";
import { ICON_TONES, toneForKey } from "../../../components/ui/IconBadge";
import { formatMoney } from "../../../utils/formatMoney";
import {
  BUNDLE_ACCENTS,
  MAX_EXTRA_COURSES,
  MAX_NAME,
  MAX_DISCOUNT_PCT,
  PLATFORM_COMMISSION_RATE,
  PRICING_MODE_LABELS,
  TODAY_ISO,
  accentFor,
  bundlePricing,
  bundleWarnings,
  countdownInfo,
  splitEligible,
  validateBundle,
} from "../data/bundleData";
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  GripIcon,
  InfoIcon,
  LockIcon,
  PackageIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  UsersIcon,
  XIcon,
} from "../../../components/ui/icons";

function Section({ eyebrow, title, description, children }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-soft sm:p-6">
      <div className="mb-4">
        <span className="eyebrow">{eyebrow}</span>
        <h3 className="mt-1 text-base font-bold text-text">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return <span className="mt-1.5 block text-xs text-danger">{children}</span>;
}

function Thumb({ course, className = "h-14 w-14" }) {
  const tone = ICON_TONES[toneForKey(course?.category || "")];
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl text-sm font-bold ${tone} ${className}`}>
      {course?.thumbnail ? <img src={course.thumbnail} alt="" className="h-full w-full object-cover" /> : (course?.title || "?").slice(0, 1)}
    </span>
  );
}

function CourseMeta({ course }) {
  const students = course.students?.length ?? 0;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
      <span>{course.category} · {course.level}</span>
      <span className="font-semibold text-text">{course.pricingModel === "free" ? "Free" : formatMoney(course.price, course.currency)}</span>
      <span className="inline-flex items-center gap-1"><UsersIcon className="h-3 w-3" />{students.toLocaleString("en-IN")}</span>
      <span className="inline-flex items-center gap-1">
        <StarIcon className="h-3 w-3 text-secondary" />
        {course.ratingCount ? course.rating : "No ratings"}
      </span>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-primary/[0.07] hover:text-text disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function CoursePicker({ bundle, courses, onAdd, atLimit }) {
  const [query, setQuery] = useState("");
  const { eligible, hidden } = useMemo(() => splitEligible(courses, bundle), [courses, bundle]);
  const q = query.trim().toLowerCase();
  const shown = q ? eligible.filter((c) => `${c.title} ${c.category} ${c.level}`.toLowerCase().includes(q)) : eligible;

  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-text">Add courses</span>
        {hidden.length > 0 && (
          <span className="group relative inline-flex">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-muted"
              aria-label={`${hidden.length} courses hidden. Only published courses can be bundled.`}
            >
              <InfoIcon className="h-3.5 w-3.5" />
              {hidden.length} hidden
            </button>
            <span className="pointer-events-none absolute right-0 top-8 z-10 w-64 rounded-xl bg-text px-3 py-2 text-[11px] leading-relaxed text-white opacity-0 shadow-elevated transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
              Only published courses can be bundled, so drafts and courses under review are hidden:{" "}
              {hidden.map((c) => c.title).join(", ")}.
            </span>
          </span>
        )}
      </div>

      <div className="relative mt-3">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your published courses…"
          aria-label="Search courses to add"
          className="w-full rounded-full border border-text/12 bg-surface py-2.5 pl-10 pr-4 text-sm text-text outline-none transition-all duration-150 placeholder:text-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>

      {atLimit && <p className="mt-3 text-xs font-medium text-pastel-orange-ink">You've reached the limit of {MAX_EXTRA_COURSES} additional courses.</p>}

      <div className="mt-3 flex flex-col gap-2.5">
        {eligible.length === 0 && (
          <p className="rounded-2xl bg-bg px-4 py-5 text-center text-sm text-muted">
            No other published courses available to add yet. Publish another course to bundle it.
          </p>
        )}
        {eligible.length > 0 && shown.length === 0 && (
          <p className="rounded-2xl bg-bg px-4 py-5 text-center text-sm text-muted">No courses match "{query}".</p>
        )}
        {shown.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-bg/60 p-3 transition-colors duration-150 hover:border-primary/40">
            <Thumb course={c} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{c.title}</p>
              <CourseMeta course={c} />
            </div>
            <button
              type="button"
              disabled={atLimit}
              onClick={() => onAdd(c.id)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-surface px-3.5 py-2 text-xs font-semibold text-primary transition-all duration-150 hover:border-primary/60 hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlusIcon className="h-3.5 w-3.5" /> Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncludedCourses({ bundle, coursesById, courses, set }) {
  const [dragId, setDragId] = useState(null);
  const ids = bundle.courseIds;

  function move(from, to) {
    if (to < 1 || to >= ids.length || from < 1) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    set({ courseIds: next });
  }
  function remove(id) {
    set({ courseIds: ids.filter((x) => x !== id) });
  }
  function add(id) {
    if (ids.length - 1 >= MAX_EXTRA_COURSES) return;
    set({ courseIds: [...ids, id] });
  }

  return (
    <>
      <ul className="flex flex-col gap-2.5" aria-label="Courses in this bundle">
        {ids.map((id, i) => {
          const c = coursesById[id];
          const pinned = i === 0;
          const archived = c?.status === "archived";
          return (
            <li
              key={id}
              draggable={!pinned}
              onDragStart={() => !pinned && setDragId(id)}
              onDragOver={(e) => !pinned && dragId && e.preventDefault()}
              onDrop={() => {
                if (!pinned && dragId && dragId !== id) move(ids.indexOf(dragId), i);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              className={`flex items-center gap-3 rounded-2xl border p-3 transition-opacity duration-150 ${
                pinned ? "border-primary/25 bg-primary/[0.04]" : "border-line bg-surface"
              } ${dragId === id ? "opacity-50" : ""}`}
            >
              <span className="w-5 shrink-0 text-center text-xs font-bold text-muted">{i + 1}</span>
              {c ? <Thumb course={c} /> : <Thumb course={{ title: "?" }} />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-text">{c?.title || "Unavailable course"}</p>
                  {pinned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <LockIcon className="h-3 w-3" /> This course
                    </span>
                  )}
                  {archived && (
                    <StatusBadge status="warning" size="sm" icon={AlertTriangleIcon}>
                      Archived
                    </StatusBadge>
                  )}
                </div>
                {c && <CourseMeta course={c} />}
              </div>
              {pinned ? (
                <span className="shrink-0 text-xs text-muted">Pinned first</span>
              ) : (
                <div className="flex shrink-0 items-center">
                  <span className="hidden cursor-grab text-muted sm:block" aria-hidden="true"><GripIcon className="h-4 w-4" /></span>
                  <IconButton label={`Move ${c?.title || "course"} up`} disabled={i <= 1} onClick={() => move(i, i - 1)}>
                    <ChevronDownIcon className="h-4 w-4 rotate-180" />
                  </IconButton>
                  <IconButton label={`Move ${c?.title || "course"} down`} disabled={i === ids.length - 1} onClick={() => move(i, i + 1)}>
                    <ChevronDownIcon className="h-4 w-4" />
                  </IconButton>
                  <IconButton label={`Remove ${c?.title || "course"}`} onClick={() => remove(id)}>
                    <XIcon className="h-4 w-4" />
                  </IconButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <CoursePicker bundle={bundle} courses={courses} onAdd={add} atLimit={ids.length - 1 >= MAX_EXTRA_COURSES} />
    </>
  );
}

function OptionCard({ active, title, description, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex flex-1 items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors duration-150 ${
        active ? "border-primary bg-primary/[0.06]" : "border-text/15 bg-bg hover:border-primary/50"
      }`}
    >
      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-primary bg-primary text-white" : "border-text/25"}`}>
        {active && <CheckIcon className="h-2.5 w-2.5" />}
      </span>
      <span>
        <span className={`block text-sm font-semibold ${active ? "text-primary" : "text-text"}`}>{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
    </button>
  );
}

function PricingSummary({ pricing, bundle }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Pricing summary</span>
        <ProgressRing value={pricing.valid ? pricing.savingsPct : 0} size={56} stroke={6} tone="brand" label={`${pricing.savingsPct}% savings`} />
      </div>

      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {pricing.items.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate text-muted">{i.title}</span>
            <span className="shrink-0 font-medium text-text">{formatMoney(i.price)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between border-t border-dashed border-text/15 pt-3 text-sm">
        <span className="text-muted">Subtotal</span>
        <span className="font-medium text-text">{formatMoney(pricing.subtotal)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted">Discount</span>
        {pricing.valid ? (
          <span className="rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-bold text-secondary">
            −{formatMoney(pricing.savings)} · {pricing.savingsPct}% off
          </span>
        ) : (
          <span className="text-xs text-muted">Not set</span>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-bg p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Bundle price</div>
        <div className="mt-1 text-4xl font-bold tracking-tight text-text">{formatMoney(pricing.final)}</div>
        {pricing.valid ? (
          <p className="mt-1 text-sm font-semibold text-success">
            Students save {formatMoney(pricing.savings)} ({pricing.savingsPct}%)
          </p>
        ) : (
          <p className="mt-1 text-xs text-danger">{pricing.error}</p>
        )}
      </div>

      <dl className="mt-4 flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted">Platform fee ({Math.round(PLATFORM_COMMISSION_RATE * 100)}%)</dt>
          <dd className="font-medium text-danger">−{formatMoney(pricing.commission)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-semibold text-text">Your payout per sale</dt>
          <dd className="text-lg font-bold text-success">{formatMoney(pricing.earnings)}</dd>
        </div>
      </dl>
      {bundle.couponsEnabled && <p className="mt-3 text-[11px] text-muted">Coupons are allowed, so the final checkout price can be lower.</p>}
    </div>
  );
}

export function StudentViewCard({ bundle, pricing, coursesById }) {
  const accent = accentFor(bundle.accent);
  const countdown = countdownInfo(bundle);
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
      <div className={`relative flex h-24 items-end px-5 pb-3 ${accent.bg}`}>
        <PackageIcon className={`absolute right-5 top-4 h-6 w-6 ${accent.ink}`} />
        <div className="flex -space-x-2">
          {bundle.courseIds.slice(0, 5).map((id) => (
            <Thumb key={id} course={coursesById[id]} className="h-9 w-9 rounded-full ring-2 ring-white" />
          ))}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2">
          <span className="eyebrow-muted">Bundle · {bundle.courseIds.length} courses</span>
          {bundle.visibility === "unlisted" && <span className="rounded-full bg-text/[0.06] px-2 py-0.5 text-[10px] font-semibold text-muted">Link only</span>}
        </div>
        <h4 className="mt-1 text-lg font-bold leading-snug text-text">{bundle.name.trim() || "Your bundle name"}</h4>
        {bundle.tagline && <p className="mt-0.5 text-sm text-muted">{bundle.tagline}</p>}
        <ul className="mt-3 flex flex-col gap-1 text-xs text-muted">
          {bundle.courseIds.map((id) => (
            <li key={id} className="flex items-center gap-1.5">
              <CheckIcon className="h-3 w-3 shrink-0 text-success" />
              <span className="truncate">{coursesById[id]?.title || "Unavailable course"}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-2xl font-bold text-text">{formatMoney(pricing.final)}</span>
          {pricing.valid && pricing.savings > 0 && (
            <>
              <span className="text-sm text-muted line-through">{formatMoney(pricing.subtotal)}</span>
              <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[11px] font-bold text-secondary">Save {pricing.savingsPct}%</span>
            </>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {countdown && (
            <span className={`inline-flex items-center gap-1 font-semibold ${countdown.tone === "urgent" ? "text-danger" : countdown.tone === "ended" ? "text-muted" : "text-pastel-blue-ink"}`}>
              <CalendarIcon className="h-3 w-3" /> {countdown.label}
            </span>
          )}
          {bundle.seatCap !== "" && bundle.seatCap != null && <span>Only {Number(bundle.seatCap)} seats</span>}
          <span>{bundle.access === "drip" ? `New course every ${bundle.dripDays || "N"} days` : "All courses unlock immediately"}</span>
        </div>
        <div className="mt-4 rounded-full bg-primary px-5 py-2.5 text-center text-sm font-semibold text-white">Get the bundle</div>
      </div>
    </div>
  );
}

// BundleEditor — the full bundle form (details, courses, pricing, window,
// access, visibility) plus the live pricing summary and student-view
// preview. Fully controlled: parent owns `bundle` and gets whole-bundle
// updates through `onChange`. `layout="stacked"` is for use inside a Modal.
export default function BundleEditor({ bundle, onChange, courses, layout = "split", disabled = false }) {
  const coursesById = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c])), [courses]);
  const { errors, pricing } = useMemo(() => validateBundle(bundle, courses), [bundle, courses]);
  const warnings = bundleWarnings(bundle, coursesById);
  const [touched, setTouched] = useState({});
  const show = (k) => (touched[k] ? errors[k] : undefined);
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));
  const set = (patch) => onChange({ ...bundle, ...patch });
  const split = layout === "split";
  const countdown = countdownInfo(bundle);

  const modeLabel = PRICING_MODE_LABELS[bundle.pricingMode];
  const valueLabel =
    bundle.pricingMode === "percent" ? `Discount (%) — 1 to ${MAX_DISCOUNT_PCT}` : bundle.pricingMode === "flat" ? "Flat discount (₹)" : "Bundle price (₹)";

  return (
    <fieldset disabled={disabled} className={`min-w-0 border-0 p-0 ${split ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start" : "flex flex-col gap-6"}`}>
      <div className="flex min-w-0 flex-col gap-6">
        {warnings.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl bg-pastel-orange px-4 py-3 text-sm text-pastel-orange-ink">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {warnings.map((w) => w.title).join(", ")} {warnings.length === 1 ? "is" : "are"} archived. Remove{" "}
              {warnings.length === 1 ? "it" : "them"} or students will not be able to enroll through this bundle.
            </span>
          </div>
        )}

        <Section eyebrow="Details" title="Name your bundle">
          <div className="flex flex-col gap-4">
            <Input
              label="Bundle name"
              value={bundle.name}
              maxLength={MAX_NAME + 20}
              onChange={(e) => set({ name: e.target.value })}
              onBlur={() => touch("name")}
              error={show("name")}
              helperText={`${bundle.name.trim().length}/${MAX_NAME} characters`}
              placeholder="e.g. Design-to-Dev Bundle"
            />
            <Input
              label="Short tagline (optional)"
              value={bundle.tagline}
              maxLength={90}
              onChange={(e) => set({ tagline: e.target.value })}
              placeholder="One line that sells the combination"
            />
            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">Accent color</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Bundle accent color">
                {BUNDLE_ACCENTS.map((a) => {
                  const active = bundle.accent === a.key;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={active}
                      aria-label={a.label}
                      onClick={() => set({ accent: a.key })}
                      className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105 ${a.bg} ${a.ink} ${
                        active ? "ring-2 ring-primary ring-offset-2" : "ring-1 ring-text/10"
                      }`}
                    >
                      {active && <CheckIcon className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Courses"
          title="Choose what's included"
          description={`This course is pinned first. Add 1 to ${MAX_EXTRA_COURSES} more of your published courses (${bundle.courseIds.length - 1}/${MAX_EXTRA_COURSES} added).`}
        >
          <IncludedCourses bundle={bundle} coursesById={coursesById} courses={courses} set={set} />
          <FieldError>{errors.courses}</FieldError>
        </Section>

        <Section eyebrow="Pricing" title="Set the bundle price" description="Students always pay less than buying each course separately.">
          <SegmentedControl
            className="max-w-full flex-wrap"
            options={Object.values(PRICING_MODE_LABELS)}
            value={modeLabel}
            onChange={(label) => {
              const key = Object.keys(PRICING_MODE_LABELS).find((k) => PRICING_MODE_LABELS[k] === label);
              set({ pricingMode: key, discountValue: "" });
            }}
          />
          <div className="mt-4 max-w-xs">
            <Input
              label={valueLabel}
              type="number"
              min={0}
              step="1"
              shape="rect"
              value={bundle.discountValue}
              onChange={(e) => set({ discountValue: e.target.value === "" ? "" : Number(e.target.value) })}
              onBlur={() => touch("pricing")}
              error={show("pricing") || (pricing.error && bundle.discountValue !== "" ? pricing.error : undefined)}
              helperText={`Combined course price: ${formatMoney(pricing.subtotal)}`}
            />
          </div>
        </Section>

        <Section eyebrow="Availability" title="When is it on sale?">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Start date" type="date" shape="rect" value={bundle.startDate} onChange={(e) => set({ startDate: e.target.value })} onBlur={() => touch("startDate")} error={show("startDate")} />
            <div>
              <Input
                label="End date (optional)"
                type="date"
                shape="rect"
                min={bundle.startDate || TODAY_ISO}
                value={bundle.endDate}
                onChange={(e) => set({ endDate: e.target.value })}
                onBlur={() => touch("endDate")}
                error={show("endDate") || errors.endDate}
                helperText="Set one to run a limited-time offer."
              />
              {bundle.endDate && (
                <button type="button" onClick={() => set({ endDate: "" })} className="mt-1 text-xs font-semibold text-primary hover:underline">
                  Clear end date
                </button>
              )}
            </div>
            <Input
              label="Seat cap (optional)"
              type="number"
              min={1}
              step="1"
              shape="rect"
              value={bundle.seatCap}
              onChange={(e) => set({ seatCap: e.target.value === "" ? "" : Number(e.target.value) })}
              onBlur={() => touch("seatCap")}
              error={show("seatCap")}
              helperText="Leave empty for unlimited seats."
              placeholder="Unlimited"
            />
            {countdown && (
              <div className="flex items-center gap-2 self-end rounded-2xl bg-bg px-4 py-3 text-sm">
                <CalendarIcon className="h-4 w-4 text-muted" />
                <span className="font-semibold text-text">{countdown.label}</span>
                <span className="text-xs text-muted">(from {TODAY_ISO})</span>
              </div>
            )}
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <Switch checked={bundle.couponsEnabled} onChange={(v) => set({ couponsEnabled: v })} label="Allow coupons on this bundle" description="Students can apply a platform coupon on top of the bundle price" />
          </div>
        </Section>

        <Section eyebrow="Access" title="How do students unlock the courses?">
          <div className="flex flex-col gap-3 sm:flex-row">
            <OptionCard active={bundle.access === "immediate"} title="Unlock all courses immediately" description="Every course opens the moment they buy." onClick={() => set({ access: "immediate" })} />
            <OptionCard active={bundle.access === "drip"} title="Drip: one course every N days" description="Keeps students focused on one course at a time." onClick={() => set({ access: "drip" })} />
          </div>
          {bundle.access === "drip" && (
            <div className="mt-4 max-w-xs">
              <Input label="Unlock a new course every (days)" type="number" min={1} max={90} step="1" shape="rect" value={bundle.dripDays} onChange={(e) => set({ dripDays: e.target.value === "" ? "" : Number(e.target.value) })} onBlur={() => touch("dripDays")} error={show("dripDays")} />
            </div>
          )}
        </Section>

        <Section eyebrow="Visibility" title="Who can find it?">
          <SegmentedControl options={["Public", "Unlisted"]} value={bundle.visibility === "public" ? "Public" : "Unlisted"} onChange={(v) => set({ visibility: v === "Public" ? "public" : "unlisted" })} />
          <p className="mt-2 text-xs text-muted">
            {bundle.visibility === "public" ? "Shown in the catalog and on each included course page." : "Hidden from the catalog. Only people with the link can buy it."}
          </p>
        </Section>
      </div>

      <div className={`flex min-w-0 flex-col gap-6 ${split ? "lg:sticky lg:top-6" : "sm:grid sm:grid-cols-2 sm:items-start"}`}>
        <PricingSummary pricing={pricing} bundle={bundle} />
        <div>
          <span className="eyebrow mb-2 block">Student view</span>
          <StudentViewCard bundle={bundle} pricing={pricing} coursesById={coursesById} />
        </div>
      </div>
    </fieldset>
  );
}
