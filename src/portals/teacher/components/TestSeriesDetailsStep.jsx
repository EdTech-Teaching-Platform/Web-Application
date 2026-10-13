// Step 1 — Series Details & Classification.
// All option lists come from testSeriesData.js (single source for builder,
// preview and filters). Test Type is NOT chosen here: it's derived from the
// tests built in Step 2 and shown read-only.
import { useState } from "react";
import Input from "../../../components/ui/Input";
import Chip from "../../../components/ui/Chip";
import Switch from "../../../components/ui/Switch";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import Select from "../../../components/ui/Select";
import { PlusIcon, InfoIcon, LockIcon, UsersIcon, FlagIcon } from "../../../components/ui/icons";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import TestSeriesDeadlinesCard from "./TestSeriesDeadlinesCard";
import { AdminAvatar } from "./TestSeriesStatus";
import { PLATFORM_COMMISSION_RATE, computeEducatorEarnings } from "./contentData";
import { formatMoney } from "../../../utils/formatMoney";
import { TS_GRADES, TS_SUBJECTS, TS_EXAMS, TS_DIFFICULTIES, TS_LANGUAGES, TS_BADGES, TS_SCOPE_LABEL, detailsErrors, derivedTestTypes, formatDate, isStructureLocked } from "../data/testSeriesData";

function Card({ eyebrow, title, description, children }) {
  return (
    <section className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
      <div className="mb-5">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 className="mt-1 text-lg font-bold text-text">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function PillSelect({ label, options, values, onChange, error, helperText, onTouch }) {
  function toggle(opt) {
    onTouch?.();
    onChange(values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt]);
  }
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-text">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} active={values.includes(o)} onClick={() => toggle(o)} className="px-4 py-1.5 text-xs">
            {o}
          </Chip>
        ))}
      </div>
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : helperText && <span className="mt-1.5 block text-xs text-muted">{helperText}</span>}
    </div>
  );
}

function TextArea({ label, error, helperText, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>
      <textarea
        rows={3}
        className={`w-full rounded-2xl border bg-surface px-4 py-3 text-sm text-text outline-none transition-all duration-150 placeholder:text-muted/80 ${
          error ? "border-danger focus:ring-2 focus:ring-danger/15" : "border-text/12 focus:border-primary focus:ring-2 focus:ring-primary/15"
        }`}
        {...props}
      />
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : helperText && <span className="mt-1.5 block text-xs text-muted">{helperText}</span>}
    </label>
  );
}

export default function TestSeriesDetailsStep({ series, onChange, showErrors, onRequestExtension }) {
  const { courses } = useTeacherCourses();
  const [touched, setTouched] = useState({});
  const [newLang, setNewLang] = useState("");
  const errors = detailsErrors(series);
  const touch = (k) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const err = (k) => (showErrors || touched[k] ? errors[k] : undefined);
  const types = derivedTestTypes(series);
  const price = Number(series.pricing.price) || 0;
  const { commission, earnings } = computeEducatorEarnings(price);
  const linkedCourse = series.courseId ? courses.find((c) => c.id === series.courseId) : null;
  const languageOptions = Array.from(new Set([...TS_LANGUAGES, ...series.languages]));
  const langDup = languageOptions.some((l) => l.toLowerCase() === newLang.trim().toLowerCase());

  function addLanguage() {
    const v = newLang.trim();
    if (!v || langDup) return;
    onChange({ languages: [...series.languages, v] });
    setNewLang("");
  }

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

      <section id="ts-scope" className="scroll-mt-24 rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
        <span className="eyebrow">Series type</span>
        <h2 className="mt-1 text-lg font-bold text-text">{TS_SCOPE_LABEL[series.scope]} test series</h2>
        {series.scope === "course" ? (
          <div className="mt-4 flex flex-col gap-4">
            <label className="block max-w-xl">
              <span className="mb-1.5 block text-sm font-medium text-text">Linked course</span>
              <Select
                wrapperClassName="block w-full"
                value={series.courseId || ""}
                disabled={series.origin === "assigned" || isStructureLocked(series)}
                onChange={(e) => onChange({ courseId: e.target.value || null })}
                className="w-full rounded-2xl border border-text/12 bg-surface px-4 py-3 pr-10 text-sm text-text"
              >
                <option value="">Select a course…</option>
                {courses.filter((c) => c.status !== "archived" || c.id === series.courseId).map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </Select>
              {!series.courseId && <span className="mt-1.5 block text-xs text-danger">Pick the course this series belongs to.</span>}
              {series.origin === "assigned" && <span className="mt-1.5 block text-xs text-muted">The admin linked this course; it can't be changed.</span>}
            </label>
            {linkedCourse && (
              <p className="flex items-center gap-2 rounded-2xl bg-pastel-blue/60 px-4 py-3 text-sm text-pastel-blue-ink">
                <UsersIcon className="h-4 w-4 shrink-0" />
                {(linkedCourse.students || []).length} enrolled student{(linkedCourse.students || []).length === 1 ? "" : "s"} get access by default. This series also shows up on the course page.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">A standalone series, with its own pricing and audience set below.</p>
        )}
      </section>

      <Card eyebrow="Basics" title="Series details" description="This is what students see on the series card and detail page.">
        <Input
          label="Title"
          placeholder="e.g. JEE Main Physics Mastery — Full Syllabus"
          value={series.title}
          onChange={(e) => onChange({ title: e.target.value })}
          onBlur={() => touch("title")}
          error={err("title")}
          shape="rect"
          maxLength={90}
        />
        <Input
          label="Short description"
          placeholder="One line shown on the series card"
          value={series.shortDescription}
          onChange={(e) => onChange({ shortDescription: e.target.value })}
          onBlur={() => touch("shortDescription")}
          error={err("shortDescription")}
          helperText={`${series.shortDescription.length}/140`}
          shape="rect"
          maxLength={140}
        />
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">About this test series</span>
          <RichTextEditor value={series.about} onChange={(html) => onChange({ about: html })} placeholder="Describe what's inside, how it's structured and what students will gain…" minHeight={160} />
        </div>
        <TextArea
          label="Who it's for"
          placeholder="e.g. Class 12 students preparing for JEE Main who want exam-pattern practice."
          value={series.whoFor}
          onChange={(e) => onChange({ whoFor: e.target.value })}
        />
      </Card>

      <Card eyebrow="Classification" title="Tags students can filter by" description="These match the facets on the public Test Series browse page.">
        <PillSelect label="Class / Grade" options={TS_GRADES} values={series.grades} onChange={(grades) => onChange({ grades })} onTouch={() => touch("grades")} error={err("grades")} />
        <PillSelect label="Subject" options={TS_SUBJECTS} values={series.subjects} onChange={(subjects) => onChange({ subjects })} onTouch={() => touch("subjects")} error={err("subjects")} />
        <PillSelect label="Exam / Goal" options={TS_EXAMS} values={series.exams} onChange={(exams) => onChange({ exams })} onTouch={() => touch("exams")} error={err("exams")} />

        <div>
          <span className="mb-2 block text-sm font-medium text-text">Test type</span>
          <div className="flex flex-wrap items-center gap-2">
            {types.length === 0 ? (
              <span className="rounded-2xl bg-bg px-4 py-2.5 text-xs text-muted">Derived automatically from the tests you add in the next step.</span>
            ) : (
              types.map((t) => (
                <span key={t} className="rounded-full bg-pastel-lavender px-3.5 py-1.5 text-xs font-semibold text-pastel-lavender-ink">
                  {t}
                </span>
              ))
            )}
          </div>
          <span className="mt-1.5 block text-xs text-muted">Read-only: each test's type is chosen in Structure.</span>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-text">Difficulty</span>
          <SegmentedControl options={TS_DIFFICULTIES} value={series.difficulty} onChange={(difficulty) => onChange({ difficulty })} className="max-w-full flex-wrap" />
        </div>

        <div>
          <PillSelect label="Language" options={languageOptions} values={series.languages} onChange={(languages) => onChange({ languages })} onTouch={() => touch("languages")} error={err("languages")} />
          <div className="mt-3 flex max-w-sm items-center gap-2">
            <Input
              aria-label="Add a language"
              containerClassName="flex-1"
              placeholder="Add another language…"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLanguage();
                }
              }}
              shape="rect"
              className="!py-2"
            />
            <button
              type="button"
              onClick={addLanguage}
              disabled={!newLang.trim() || langDup}
              className="inline-flex items-center gap-1 rounded-full border border-primary/25 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.05] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlusIcon className="h-3 w-3" />
              Add
            </button>
          </div>
        </div>

        <PillSelect label="Card badges" options={TS_BADGES} values={series.badges} onChange={(badges) => onChange({ badges })} helperText="Optional labels shown on the series card." />
      </Card>

      <Card eyebrow="Pricing & scoring" title="Price and marking scheme">
        {series.scope === "course" && (
          <div>
            <Switch
              checked={series.pricing.model === "paid"}
              onChange={(v) => onChange({ pricing: { ...series.pricing, model: v ? "paid" : "free" } })}
              label="Also sell to students who aren't enrolled in the course"
              description="Enrolled students always get access for free. Turn this on to sell it separately."
            />
            {series.pricing.model === "paid" && (
              <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
                <Input
                  label="Price (₹ INR)"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="499"
                  value={series.pricing.price}
                  onChange={(e) => onChange({ pricing: { ...series.pricing, price: e.target.value } })}
                  onBlur={() => touch("price")}
                  error={err("price")}
                  shape="rect"
                />
                <div className="rounded-2xl bg-bg px-4 py-3 text-xs text-muted">
                  <div className="flex items-center gap-1.5 font-semibold text-text"><InfoIcon className="h-3.5 w-3.5" />Your earnings</div>
                  <p className="mt-1">{formatMoney(earnings)} per sale after the {Math.round(PLATFORM_COMMISSION_RATE * 100)}% platform fee ({formatMoney(commission)}).</p>
                </div>
              </div>
            )}
          </div>
        )}
        {series.scope !== "course" && (
          <div>
            <span className="mb-2 block text-sm font-medium text-text">Pricing</span>
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
            {series.pricing.model === "paid" && (
              <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
                <Input
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
                <div className="rounded-2xl bg-bg px-4 py-3 text-xs text-muted">
                  <div className="flex items-center gap-1.5 font-semibold text-text">
                    <InfoIcon className="h-3.5 w-3.5" />
                    Your earnings
                  </div>
                  <p className="mt-1">
                    {formatMoney(earnings)} per sale after the {Math.round(PLATFORM_COMMISSION_RATE * 100)}% platform fee ({formatMoney(commission)}).
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {series.scope !== "course" && (
          <div>
            <span className="mb-2 block text-sm font-medium text-text">Audience</span>
            <SegmentedControl options={["Public", "Invite only"]} value={series.audience.visibility === "invite" ? "Invite only" : "Public"} onChange={(v) => onChange({ audience: { ...series.audience, visibility: v === "Public" ? "public" : "invite" } })} />
            <p className="mt-2 text-xs text-muted">{series.audience.visibility === "invite" ? "Only students you invite can enroll." : "Anyone can find and enroll in this series."}</p>
            <Input
              containerClassName="mt-3 block max-w-[14rem]"
              label="Seat limit (optional)"
              type="number"
              min={1}
              placeholder="Unlimited"
              value={series.audience.seatLimit}
              onChange={(e) => onChange({ audience: { ...series.audience, seatLimit: e.target.value === "" ? "" : Number(e.target.value) } })}
              shape="rect"
            />
          </div>
        )}

        <div inert={isStructureLocked(series)} className={isStructureLocked(series) ? "opacity-60" : undefined}>
          <Switch
            checked={series.negativeMarking.enabled}
            onChange={(v) => onChange({ negativeMarking: { ...series.negativeMarking, enabled: v } })}
            label="Negative marking"
            description="Deduct marks for wrong objective answers"
          />
          {series.negativeMarking.enabled ? (
            <Input
              containerClassName="mt-3 block"
              label="Marking scheme"
              placeholder="e.g. -0.25 per wrong answer"
              value={series.negativeMarking.scheme}
              onChange={(e) => onChange({ negativeMarking: { ...series.negativeMarking, scheme: e.target.value } })}
              onBlur={() => touch("negativeScheme")}
              error={err("negativeScheme")}
              shape="rect"
            />
          ) : (
            <p className="mt-2 rounded-2xl bg-bg px-4 py-2.5 text-xs text-muted">No negative marking on this test series.</p>
          )}
        </div>
      </Card>

      <TestSeriesDeadlinesCard series={series} onChange={onChange} onRequestExtension={onRequestExtension} />
    </div>
  );
}
