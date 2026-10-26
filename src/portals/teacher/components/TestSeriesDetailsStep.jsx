// Step 1 — Details. Mirrors the admin "Details" step exactly: name, about,
// who it's for, target audience, syllabus (optional) and free / paid pricing.
import { useState } from "react";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import { LockIcon, FlagIcon } from "../../../components/ui/icons";
import { AdminAvatar } from "./TestSeriesStatus";
import { TS_AUDIENCES, detailsErrors, formatDate } from "../data/testSeriesData";

function TextArea({ label, error, helperText, rows = 3, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>
      <textarea
        rows={rows}
        className={`w-full rounded-2xl border bg-surface px-4 py-3 text-sm text-text outline-none transition-all duration-150 placeholder:text-muted/80 ${
          error ? "border-danger focus:ring-2 focus:ring-danger/15" : "border-text/12 focus:border-primary focus:ring-2 focus:ring-primary/15"
        }`}
        {...props}
      />
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : helperText && <span className="mt-1.5 block text-xs text-muted">{helperText}</span>}
    </label>
  );
}

export default function TestSeriesDetailsStep({ series, onChange, showErrors }) {
  const [touched, setTouched] = useState({});
  const errors = detailsErrors(series);
  const touch = (k) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const err = (k) => (showErrors || touched[k] ? errors[k] : undefined);
  const paid = series.pricing.model === "paid";

  return (
    <div className="flex flex-col gap-6">
      {series.origin === "assigned" && series.assignment && (
        <section className="rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-secondary/40 sm:p-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 text-[11px] font-bold text-pastel-orange-ink"><FlagIcon className="h-3 w-3" />Assigned by admin</span>
            <span className="inline-flex items-center gap-2 text-sm text-text"><AdminAvatar name={series.assignment.assignedBy.name} size="h-7 w-7" />{series.assignment.assignedBy.name}</span>
            <span className="text-xs text-muted">assigned {formatDate(series.assignment.assignedOn)}</span>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm text-muted">{series.assignment.adminBrief}</p>
          {series.assignment.adminNotes && (
            <div className="mt-3 rounded-2xl bg-bg px-4 py-3 text-sm text-muted">
              <span className="eyebrow mb-1 inline-flex items-center gap-1"><LockIcon className="h-3 w-3" />Admin notes (read-only)</span>
              <p>{series.assignment.adminNotes}</p>
            </div>
          )}
        </section>
      )}

      <section className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
        <div className="mb-5">
          <span className="eyebrow">Details</span>
          <h2 className="mt-1 text-lg font-bold text-text">Test series details</h2>
        </div>
        <div className="flex flex-col gap-6">
          <Input
            label="Test series name"
            placeholder="e.g. JEE Main Physics Mastery"
            value={series.title}
            onChange={(e) => onChange({ title: e.target.value })}
            onBlur={() => touch("title")}
            error={err("title")}
            shape="rect"
            maxLength={90}
          />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">About this test series</span>
            <RichTextEditor value={series.about} onChange={(html) => onChange({ about: html })} placeholder="Describe what's inside and what students will gain…" minHeight={160} />
          </div>
          <TextArea
            label="Who it's for"
            placeholder="e.g. Class 12 students preparing for JEE Main."
            value={series.whoFor}
            onChange={(e) => onChange({ whoFor: e.target.value })}
          />
          <label className="block max-w-xl">
            <span className="mb-1.5 block text-sm font-medium text-text">Target audience</span>
            <Select
              wrapperClassName="block w-full"
              value={series.audienceLevel || ""}
              onChange={(e) => onChange({ audienceLevel: e.target.value })}
              onBlur={() => touch("audienceLevel")}
              className={`w-full rounded-2xl border bg-surface px-4 py-3 pr-10 text-sm text-text ${err("audienceLevel") ? "border-danger" : "border-text/12"}`}
            >
              <option value="">Select audience…</option>
              {TS_AUDIENCES.map((a) => {
                const v = typeof a === "string" ? a : a.value ?? a.label;
                const l = typeof a === "string" ? a : a.label ?? a.value;
                return <option key={v} value={v}>{l}</option>;
              })}
            </Select>
            {err("audienceLevel") && <span className="mt-1.5 block text-xs text-danger">{err("audienceLevel")}</span>}
          </label>
          <TextArea
            label="Syllabus (optional)"
            rows={4}
            placeholder="Topics covered, one per line"
            value={series.syllabus || ""}
            onChange={(e) => onChange({ syllabus: e.target.value })}
          />
        </div>
      </section>

      <section className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
        <div className="mb-5">
          <span className="eyebrow">Pricing</span>
          <h2 className="mt-1 text-lg font-bold text-text">Free or paid</h2>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {[
            { key: "free", title: "Free", desc: "Open to every student" },
            { key: "paid", title: "Paid", desc: "One-time purchase" },
          ].map((m) => {
            const active = series.pricing.model === m.key;
            return (
              <button
                key={m.key}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ pricing: { ...series.pricing, model: m.key } })}
                className={`flex flex-1 flex-col items-start gap-1 rounded-2xl border px-5 py-4 text-left transition-colors duration-150 ${active ? "border-primary bg-primary/[0.06]" : "border-text/15 bg-bg hover:border-primary/50"}`}
              >
                <span className={`text-sm font-semibold ${active ? "text-primary" : "text-text"}`}>{m.title}</span>
                <span className="text-xs text-muted">{m.desc}</span>
              </button>
            );
          })}
        </div>
        {paid && (
          <Input
            containerClassName="mt-4 block max-w-[16rem]"
            label="Price (₹ INR)"
            type="number"
            min={0}
            step="1"
            placeholder="799"
            value={series.pricing.price}
            onChange={(e) => onChange({ pricing: { ...series.pricing, price: e.target.value } })}
            onBlur={() => touch("price")}
            error={err("price")}
            shape="rect"
          />
        )}
      </section>
    </div>
  );
}
