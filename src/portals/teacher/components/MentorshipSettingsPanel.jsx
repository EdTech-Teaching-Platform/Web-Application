import { useState } from "react";
import Button from "../../../components/ui/Button";
import ChipInput from "../../../components/ui/ChipInput";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import Switch from "../../../components/ui/Switch";
import { PlusIcon, TrashIcon, UsersIcon, ClockIcon } from "../../../components/ui/icons";

function newId() {
  return `q-${Math.random().toString(36).slice(2, 9)}`;
}

// MentorshipSettingsPanel — Program Settings (Part 4). Every field writes
// straight through to MentorshipContext's `settings` via updateSettings,
// with a live applicant-facing preview card rendered from that same state
// (the same "preview mirrors current draft" idea Course Builder/Course
// Management use for their own preview cards).
export default function MentorshipSettingsPanel({ settings, activeCount, onUpdate }) {
  const [customQuestion, setCustomQuestion] = useState("");

  function toggleQuestion(id) {
    onUpdate({ questions: settings.questions.map((q) => (q.id === id ? { ...q, enabled: !q.enabled } : q)) });
  }
  function addCustomQuestion() {
    const label = customQuestion.trim();
    if (!label) return;
    onUpdate({ questions: [...settings.questions, { id: newId(), label, enabled: true, custom: true }] });
    setCustomQuestion("");
  }
  function removeQuestion(id) {
    onUpdate({ questions: settings.questions.filter((q) => q.id !== id) });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <p className="mb-3 text-sm font-semibold text-text">Program pitch</p>
          <RichTextEditor value={settings.pitch} onChange={(html) => onUpdate({ pitch: html })} minHeight={140} />
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <p className="mb-3 text-sm font-semibold text-text">Focus areas you mentor in</p>
          <ChipInput values={settings.focusAreas} onChange={(v) => onUpdate({ focusAreas: v })} placeholder="Add a focus area and press Enter…" />
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <p className="mb-1 text-sm font-semibold text-text">Application questions</p>
          <p className="mb-3 text-xs text-muted">Toggle which questions applicants answer, or add your own.</p>
          <div className="flex flex-col gap-2">
            {settings.questions.map((q) => (
              <div key={q.id} className="flex items-center justify-between gap-3 rounded-xl bg-bg px-3.5 py-2.5">
                <span className={`min-w-0 flex-1 truncate text-sm ${q.enabled ? "text-text" : "text-muted"}`}>{q.label}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {q.custom && (
                    <button type="button" onClick={() => removeQuestion(q.id)} aria-label="Remove question" className="rounded-full p-1 text-muted hover:bg-danger/10 hover:text-danger">
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Switch checked={q.enabled} onChange={() => toggleQuestion(q.id)} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomQuestion()}
              placeholder="Add a custom question…"
              className="flex-1 rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <Button fullWidth={false} className="flex items-center gap-1.5 px-4" onClick={addCustomQuestion}>
              <PlusIcon className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <p className="mb-3 text-sm font-semibold text-text">Capacity</p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              value={settings.capacity}
              onChange={(e) => onUpdate({ capacity: Math.max(1, Number(e.target.value) || 1) })}
              className="w-24 rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <span className="text-xs text-muted">
              {activeCount}/{settings.capacity} active mentees currently
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-bg p-3.5">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text">{settings.waitlistWhenFull ? "Waitlist applicants when full" : "Hide applications when full"}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {settings.waitlistWhenFull ? "New applications still come in, marked as waitlisted." : "Applications close automatically once you're at capacity."}
              </span>
            </span>
            <Switch checked={settings.waitlistWhenFull} onChange={(v) => onUpdate({ waitlistWhenFull: v })} />
          </div>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <p className="mb-3 text-sm font-semibold text-text">Defaults for new programs</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">Default cadence</span>
              <input
                type="text"
                value={settings.defaultCadence}
                onChange={(e) => onUpdate({ defaultCadence: e.target.value })}
                className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">Default duration</span>
              <input
                type="text"
                value={settings.defaultDuration}
                onChange={(e) => onUpdate({ defaultDuration: e.target.value })}
                className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Live applicant-facing preview */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">What applicants will see</p>
        <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
          <div className="bg-primary px-5 py-6 text-white">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/70">
              <UsersIcon className="h-3.5 w-3.5" />
              Mentorship Program
            </p>
            <p className="mt-2 font-display text-lg">Apply for 1:1 Mentorship</p>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <div className="prose prose-sm max-w-none text-sm text-text" dangerouslySetInnerHTML={{ __html: settings.pitch }} />
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Focus areas</p>
              <div className="flex flex-wrap gap-1.5">
                {settings.focusAreas.map((f) => (
                  <span key={f} className="rounded-full bg-primary/[0.08] px-2.5 py-1 text-[11px] font-semibold text-primary">
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <ClockIcon className="h-3.5 w-3.5" />
              Typically {settings.defaultCadence.toLowerCase()} · {settings.defaultDuration}
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Application questions</p>
              <div className="flex flex-col gap-1.5">
                {settings.questions.filter((q) => q.enabled).map((q) => (
                  <div key={q.id} className="rounded-lg bg-bg px-3 py-2 text-xs text-muted">{q.label}</div>
                ))}
              </div>
            </div>
            {activeCount >= settings.capacity && (
              <div className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                {settings.waitlistWhenFull ? "Currently full — new applicants will be waitlisted." : "Currently full — applications are closed."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
