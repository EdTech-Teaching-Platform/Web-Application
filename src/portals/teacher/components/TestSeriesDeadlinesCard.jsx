// Part 6D deadlines editor (lives in the Details step, id="ts-deadlines"):
// build deadline, publish now / schedule, availability window, per-test
// windows, late-submission policy, attempt expiry and reminder toggles, all
// validated against each other with the timeline underneath.
import { useState } from "react";
import Input from "../../../components/ui/Input";
import Switch from "../../../components/ui/Switch";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import { LockIcon, ChevronDownIcon, AlertTriangleIcon, ClockIcon } from "../../../components/ui/icons";
import DeadlineTimeline from "./DeadlineTimeline";
import { formatDate, allTests } from "../data/testSeriesData";
import { deadlineIssues, effectiveBuildDeadline, daysUntil, countdownLabel } from "../data/testSeriesDeadlines";

function Row({ title, hint, children }) {
  return (
    <div className="flex flex-col gap-2.5 border-t border-text/[0.06] pt-5 first:border-t-0 first:pt-0">
      <div>
        <span className="block text-sm font-semibold text-text">{title}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export default function TestSeriesDeadlinesCard({ series, onChange, onRequestExtension }) {
  const d = series.deadlines;
  const [testsOpen, setTestsOpen] = useState(false);
  const issues = deadlineIssues(series);
  const issueFor = (field) => issues.find((i) => i.field === field && i.level === "error")?.msg;
  const set = (patch) => onChange({ deadlines: { ...d, ...patch } });
  const assigned = series.origin === "assigned";
  const build = effectiveBuildDeadline(series);
  const standalone = series.scope === "standalone";
  const ext = series.extensionRequest;
  const tests = allTests(series);
  const setTestWindow = (tid, patch) => set({ testWindows: { ...d.testWindows, [tid]: { mode: "inherit", open: "", close: "", ...(d.testWindows[tid] || {}), ...patch } } });
  const warnings = issues.filter((i) => i.level === "warning");

  return (
    <section id="ts-deadlines" className="scroll-mt-24 rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
      <div className="mb-5">
        <span className="eyebrow">Deadlines</span>
        <h2 className="mt-1 text-lg font-bold text-text">Deadlines and availability</h2>
        <p className="mt-1 text-sm text-muted">When you need to finish building, when students can start and when they have to stop.</p>
      </div>

      <div className="flex flex-col gap-5">
        <Row title="1. Build deadline" hint={assigned ? "Set by the admin. You can ask for more time, but not change it yourself." : "Optional. A target date to finish building this series."}>
          {assigned ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-bg px-4 py-3">
              <LockIcon className="h-4 w-4 text-muted" />
              <span className="text-sm font-semibold text-text">{formatDate(build)}</span>
              <span className="text-xs text-muted">{countdownLabel(daysUntil(build))}</span>
              {ext?.status === "pending" ? (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-pastel-orange px-3 py-1 text-xs font-semibold text-pastel-orange-ink"><ClockIcon className="h-3 w-3" />Extension to {formatDate(ext.newDate)} pending</span>
              ) : (
                <button type="button" onClick={onRequestExtension} className="ml-auto text-xs font-bold text-primary underline">Request extension</button>
              )}
            </div>
          ) : (
            <div className="flex max-w-xs items-end gap-3">
              <Input aria-label="Build deadline" type="date" value={d.buildDeadline} onChange={(e) => set({ buildDeadline: e.target.value })} shape="rect" containerClassName="flex-1" />
              {d.buildDeadline && <button type="button" onClick={() => set({ buildDeadline: "" })} className="pb-3 text-xs font-semibold text-muted underline">Clear</button>}
            </div>
          )}
        </Row>

        <Row title="2. Publishing" hint="Publish makes the series visible and enrollable. Scheduling holds it back until the go-live date.">
          <SegmentedControl options={["Publish now", "Schedule go-live"]} value={d.publishMode === "scheduled" ? "Schedule go-live" : "Publish now"} onChange={(v) => set({ publishMode: v === "Publish now" ? "now" : "scheduled" })} />
          {d.publishMode === "scheduled" && <Input aria-label="Go-live date" label="Go-live date" type="date" value={d.goLiveAt} onChange={(e) => set({ goLiveAt: e.target.value })} error={issueFor("goLiveAt")} shape="rect" containerClassName="max-w-xs" />}
        </Row>

        <Row title="3. Student availability window" hint="When students can take the tests.">
          <SegmentedControl options={["Always open", "Open & close dates"]} value={d.windowMode === "window" ? "Open & close dates" : "Always open"} onChange={(v) => set({ windowMode: v === "Always open" ? "always" : "window" })} />
          {d.windowMode === "window" && (
            <div className="grid max-w-xl gap-3 sm:grid-cols-2">
              <Input label="Opens" type="date" value={d.windowOpen} onChange={(e) => set({ windowOpen: e.target.value })} error={issueFor("windowOpen")} shape="rect" />
              <Input label="Closes" type="date" value={d.windowClose} onChange={(e) => set({ windowClose: e.target.value })} error={issueFor("windowClose")} shape="rect" />
            </div>
          )}
        </Row>

        <Row title="4. Per-test windows" hint="Each test inherits the series window unless you give it its own.">
          <button type="button" onClick={() => setTestsOpen((v) => !v)} aria-expanded={testsOpen} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/25 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/[0.05]">
            {testsOpen ? "Hide" : "Customize"} per-test windows ({Object.values(d.testWindows).filter((w) => w?.mode === "custom").length} custom)
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${testsOpen ? "rotate-180" : ""}`} />
          </button>
          {testsOpen && (tests.length === 0 ? (
            <p className="rounded-2xl bg-bg px-4 py-3 text-sm text-muted">Add tests in the Structure step first.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {tests.map((t) => {
                const w = d.testWindows[t.id] || { mode: "inherit", open: "", close: "" };
                return (
                  <li key={t.id} className="rounded-2xl bg-bg p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-text">{t.title || "Untitled test"}</span>
                      <SegmentedControl options={["Inherit", "Custom"]} value={w.mode === "custom" ? "Custom" : "Inherit"} onChange={(v) => setTestWindow(t.id, { mode: v === "Custom" ? "custom" : "inherit" })} />
                    </div>
                    {w.mode === "custom" && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Input aria-label={`${t.title} opens`} label="Opens" type="date" value={w.open} onChange={(e) => setTestWindow(t.id, { open: e.target.value })} shape="rect" />
                        <Input aria-label={`${t.title} closes`} label="Closes" type="date" value={w.close} onChange={(e) => setTestWindow(t.id, { close: e.target.value })} shape="rect" />
                        {issueFor(`tw-${t.id}`) && <p className="text-xs text-danger sm:col-span-2" role="alert">{issueFor(`tw-${t.id}`)}</p>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
        </Row>

        <Row title="5. Late submissions" hint="What happens when a student submits after the window closes.">
          <SegmentedControl options={["Not allowed", "Allowed with penalty"]} value={d.late.policy === "penalty" ? "Allowed with penalty" : "Not allowed"} onChange={(v) => set({ late: { ...d.late, policy: v === "Not allowed" ? "none" : "penalty" } })} />
          {d.late.policy === "penalty" && (
            <div className="grid max-w-xl gap-3 sm:grid-cols-2">
              <Input label="Penalty (% of marks)" type="number" min={1} max={100} value={d.late.penaltyPct} onChange={(e) => set({ late: { ...d.late, penaltyPct: e.target.value === "" ? "" : Number(e.target.value) } })} error={issueFor("latePct")} shape="rect" />
              <Input label="Accepted for (hours after close)" type="number" min={1} max={720} value={d.late.graceHours} onChange={(e) => set({ late: { ...d.late, graceHours: e.target.value === "" ? "" : Number(e.target.value) } })} error={issueFor("lateHours")} shape="rect" />
            </div>
          )}
        </Row>

        {standalone && (
          <Row title="6. Attempt expiry" hint="Standalone series only. Each attempt expires this many days after the student starts it. Leave blank for no expiry.">
            <Input aria-label="Attempt expiry in days" type="number" min={1} max={365} placeholder="e.g. 30" value={d.attemptExpiryDays} onChange={(e) => set({ attemptExpiryDays: e.target.value === "" ? "" : Number(e.target.value) })} error={issueFor("attemptExpiry")} shape="rect" containerClassName="max-w-[11rem]" helperText="days" />
          </Row>
        )}

        <Row title={standalone ? "7. Reminders" : "6. Reminders"} hint="We'll notify you and your students at these points.">
          <div className="flex flex-col gap-3">
            {[["edu7", "7 days before the build deadline"], ["edu3", "3 days before the build deadline"], ["edu1", "1 day before the build deadline"]].map(([key, label]) => (
              <Switch key={key} checked={Boolean(d.reminders[key])} onChange={(v) => set({ reminders: { ...d.reminders, [key]: v } })} label={`Remind me ${label}`} description={build ? undefined : "Needs a build deadline"} disabled={!build} />
            ))}
            <Switch checked={Boolean(d.reminders.students)} onChange={(v) => set({ reminders: { ...d.reminders, students: v } })} label="Remind students before the window closes" description={d.windowMode === "window" ? "Sent 3 days and 1 day before it closes" : "Only applies when you set a close date"} disabled={d.windowMode !== "window"} />
          </div>
        </Row>
      </div>

      <div className="mt-7 border-t border-text/[0.06] pt-5">
        <span className="mb-3 block text-sm font-semibold text-text">Timeline</span>
        <DeadlineTimeline series={series} />
        {warnings.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-pastel-orange px-4 py-3 text-xs font-semibold text-pastel-orange-ink">
            {warnings.map((w) => <li key={w.id} className="flex items-start gap-1.5"><AlertTriangleIcon className="mt-0.5 h-3 w-3 shrink-0" />{w.msg}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
