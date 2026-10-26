// Step 4 — Deadlines & availability. Same seven sections as the admin
// "Availability" step. Stored in series.deadlines.
import { useState } from "react";
import Input from "../../../components/ui/Input";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import { LockIcon, ChevronDownIcon } from "../../../components/ui/icons";
import { allTests } from "../data/testSeriesData";
import { deadlineIssues, effectiveBuildDeadline, defaultDeadlines } from "../data/testSeriesDeadlines";

function Section({ n, title, hint, children }) {
  return (
    <section className="rounded-2xl bg-bg p-5">
      <h3 className="text-sm font-bold text-text">{n}. {title}</h3>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

export default function TestSeriesAvailabilityStep({ series, onChange, onRequestExtension }) {
  const [showWindows, setShowWindows] = useState(false);
  const d = { ...defaultDeadlines(), ...(series.deadlines || {}), late: { ...defaultDeadlines().late, ...(series.deadlines?.late || {}) } };
  const set = (patch) => onChange({ deadlines: { ...d, ...patch } });
  const tests = allTests(series);
  const build = effectiveBuildDeadline(series);
  const assigned = series.origin === "assigned";
  const issues = deadlineIssues(series).filter((i) => i.level === "error");
  const msg = (field) => issues.find((i) => i.field === field)?.msg;
  const Err = ({ field }) => (msg(field) ? <span className="block text-xs text-danger">{msg(field)}</span> : null);
  const customCount = tests.filter((t) => d.testWindows?.[t.id]?.mode === "custom").length;
  const setTW = (id, patch) => set({ testWindows: { ...d.testWindows, [id]: { mode: "inherit", open: "", close: "", ...(d.testWindows?.[id] || {}), ...patch } } });

  return (
    <section className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
      <div className="mb-5">
        <span className="eyebrow">Availability</span>
        <h2 className="mt-1 text-lg font-bold text-text">Deadlines and availability</h2>
        <p className="mt-1 text-sm text-muted">When you need to finish building, when students can start and when they have to stop.</p>
      </div>
      <div className="flex flex-col gap-4">
        <Section n={1} title="Build deadline" hint={assigned ? "Set by the admin when this series was assigned." : "Optional. A target date to finish building this series."}>
          {assigned ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-2xl bg-surface px-4 py-2.5 text-sm font-semibold text-text"><LockIcon className="h-3.5 w-3.5 text-muted" />{build || "—"}</span>
              {onRequestExtension && <button type="button" onClick={onRequestExtension} className="text-xs font-bold text-primary underline">Request extension</button>}
            </div>
          ) : (
            <Input aria-label="Build deadline" type="date" value={d.buildDeadline} onChange={(e) => set({ buildDeadline: e.target.value })} shape="rect" containerClassName="max-w-xs" />
          )}
          <Err field="buildDeadline" />
        </Section>

        <Section n={2} title="Publishing" hint="Publishing makes the series visible. Scheduling holds it back until the go-live time.">
          <SegmentedControl options={["Publish now", "Schedule go-live"]} value={d.publishMode === "scheduled" ? "Schedule go-live" : "Publish now"} onChange={(v) => set({ publishMode: v === "Publish now" ? "now" : "scheduled" })} />
          {d.publishMode === "scheduled" && <Input aria-label="Go-live" type="datetime-local" value={d.goLiveAt} onChange={(e) => set({ goLiveAt: e.target.value })} shape="rect" containerClassName="max-w-xs" />}
          <Err field="goLiveAt" />
        </Section>

        <Section n={3} title="Student availability window" hint="When students can take the tests.">
          <SegmentedControl options={["Always open", "Open & close dates"]} value={d.windowMode === "window" ? "Open & close dates" : "Always open"} onChange={(v) => set({ windowMode: v === "Always open" ? "always" : "window" })} />
          {d.windowMode === "window" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Opens" type="date" value={d.windowOpen} onChange={(e) => set({ windowOpen: e.target.value })} shape="rect" />
              <Input label="Closes" type="date" value={d.windowClose} onChange={(e) => set({ windowClose: e.target.value })} shape="rect" />
            </div>
          )}
          <Err field="windowOpen" /><Err field="windowClose" />
        </Section>

        <Section n={4} title="Monthly access limit" hint="How many tests from this series one student can access in a calendar month. Resets on the 1st of every month.">
          <SegmentedControl options={["Unlimited", "Set a limit"]} value={d.monthlyLimited ? "Set a limit" : "Unlimited"} onChange={(v) => set({ monthlyLimited: v === "Set a limit" })} />
          {d.monthlyLimited && <Input label="Tests per student per month" type="number" min={1} step={1} value={d.monthlyLimit} onChange={(e) => set({ monthlyLimit: e.target.value === "" ? "" : Number(e.target.value) })} shape="rect" containerClassName="max-w-[14rem]" />}
          <Err field="monthlyLimit" />
        </Section>

        <Section n={5} title="Days of access" hint="How long a student keeps access to this series after joining or buying it.">
          <SegmentedControl options={["Lifetime", "Limited days"]} value={d.accessLimited ? "Limited days" : "Lifetime"} onChange={(v) => set({ accessLimited: v === "Limited days" })} />
          {d.accessLimited && (
            <div className="flex flex-wrap items-end gap-2">
              <Input label="Days of access" type="number" min={1} step={1} value={d.accessDays} onChange={(e) => set({ accessDays: e.target.value === "" ? "" : Number(e.target.value) })} shape="rect" containerClassName="w-32" />
              {[30, 90, 180, 365].map((n) => (
                <button key={n} type="button" onClick={() => set({ accessDays: n })} className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${Number(d.accessDays) === n ? "border-primary bg-primary/[0.06] text-primary" : "border-text/15 text-muted hover:border-primary/50"}`}>{n} days</button>
              ))}
            </div>
          )}
          <Err field="accessDays" />
        </Section>

        <Section n={6} title="Per-test windows" hint="Each test inherits the series window unless you give it its own.">
          <button type="button" onClick={() => setShowWindows((v) => !v)} aria-expanded={showWindows} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/25 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/[0.05]">
            Customize per-test windows ({customCount} custom)
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showWindows ? "rotate-180" : ""}`} />
          </button>
          {showWindows && (
            <div className="flex flex-col gap-3">
              {tests.length === 0 && <p className="text-xs text-muted">Add tests first.</p>}
              {tests.map((t) => {
                const w = d.testWindows?.[t.id] || { mode: "inherit", open: "", close: "" };
                return (
                  <div key={t.id} className="rounded-2xl bg-surface p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <strong className="text-sm text-text">{t.title || "Untitled test"}</strong>
                      <SegmentedControl options={["Inherit", "Custom"]} value={w.mode === "custom" ? "Custom" : "Inherit"} onChange={(v) => setTW(t.id, { mode: v === "Custom" ? "custom" : "inherit" })} />
                    </div>
                    {w.mode === "custom" && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Input label="Opens" type="datetime-local" value={w.open} onChange={(e) => setTW(t.id, { open: e.target.value })} shape="rect" />
                        <Input label="Closes" type="datetime-local" value={w.close} onChange={(e) => setTW(t.id, { close: e.target.value })} shape="rect" />
                      </div>
                    )}
                    <Err field={`tw-${t.id}`} />
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section n={7} title="Late submissions" hint="What happens when a student's time runs out.">
          <SegmentedControl options={["Not allowed", "Grace period"]} value={d.late.policy === "none" ? "Not allowed" : "Grace period"} onChange={(v) => set({ late: { ...d.late, policy: v === "Not allowed" ? "none" : "grace" } })} />
          {d.late.policy !== "none" && <Input label="Grace period (minutes)" type="number" min={1} step={1} value={d.late.graceMinutes} onChange={(e) => set({ late: { ...d.late, graceMinutes: e.target.value === "" ? "" : Number(e.target.value) } })} shape="rect" containerClassName="max-w-[14rem]" />}
          <Err field="lateGrace" />
        </Section>
      </div>
    </section>
  );
}
