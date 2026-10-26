// Step 3 — Classification. Same fields as the admin "Classification" step:
// class / grade, subject, exam / goal, test type (read-only), difficulty, language.
import { useState } from "react";
import Input from "../../../components/ui/Input";
import Chip from "../../../components/ui/Chip";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import { PlusIcon } from "../../../components/ui/icons";
import { TS_GRADES, TS_SUBJECTS, TS_EXAMS, TS_DIFFICULTIES, TS_LANGUAGES, classificationErrors, derivedTestLabel } from "../data/testSeriesData";

function Single({ label, options, value, onChange, error }) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-text">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} active={value === o} onClick={() => onChange(o)} className="px-4 py-1.5 text-xs">{o}</Chip>
        ))}
      </div>
      {error && <span className="mt-1.5 block text-xs text-danger">{error}</span>}
    </div>
  );
}

export default function TestSeriesClassificationStep({ series, onChange, showErrors }) {
  const [newLang, setNewLang] = useState("");
  const errors = showErrors ? classificationErrors(series) : {};
  const languageOptions = Array.from(new Set([...TS_LANGUAGES, ...series.languages]));
  const langDup = languageOptions.some((l) => l.toLowerCase() === newLang.trim().toLowerCase());
  const toggleLang = (l) => onChange({ languages: series.languages.includes(l) ? series.languages.filter((x) => x !== l) : [...series.languages, l] });

  function addLanguage() {
    const v = newLang.trim();
    if (!v || langDup) return;
    onChange({ languages: [...series.languages, v] });
    setNewLang("");
  }

  return (
    <section className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
      <div className="mb-5">
        <span className="eyebrow">Classification</span>
        <h2 className="mt-1 text-lg font-bold text-text">Tags students can filter by</h2>
        <p className="mt-1 text-sm text-muted">Classification used to organise and find this series.</p>
      </div>
      <div className="flex flex-col gap-6">
        <Single label="Class / Grade" options={TS_GRADES} value={series.grades[0]} onChange={(v) => onChange({ grades: [v] })} error={errors.grades} />
        <Single label="Subject" options={TS_SUBJECTS} value={series.subjects[0]} onChange={(v) => onChange({ subjects: [v] })} error={errors.subjects} />
        <Single label="Exam / Goal" options={TS_EXAMS} value={series.exams[0]} onChange={(v) => onChange({ exams: [v] })} error={errors.exams} />

        <div>
          <span className="mb-2 block text-sm font-medium text-text">Test type</span>
          <span className="inline-block rounded-full bg-pastel-lavender px-3.5 py-1.5 text-xs font-semibold text-pastel-lavender-ink">{derivedTestLabel(series)}</span>
          <span className="mt-1.5 block text-xs text-muted">Read-only: taken from the structure you built.</span>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-text">Difficulty</span>
          <SegmentedControl options={TS_DIFFICULTIES} value={series.difficulty} onChange={(difficulty) => onChange({ difficulty })} className="max-w-full flex-wrap" />
          {errors.difficulty && <span className="mt-1.5 block text-xs text-danger">{errors.difficulty}</span>}
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-text">Language</span>
          <div className="flex flex-wrap gap-2">
            {languageOptions.map((l) => (
              <Chip key={l} active={series.languages.includes(l)} onClick={() => toggleLang(l)} className="px-4 py-1.5 text-xs">{l}</Chip>
            ))}
          </div>
          {errors.languages && <span className="mt-1.5 block text-xs text-danger">{errors.languages}</span>}
          <div className="mt-3 flex max-w-sm items-center gap-2">
            <Input
              aria-label="Add a language"
              containerClassName="flex-1"
              placeholder="Add another language…"
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLanguage(); } }}
              shape="rect"
              className="!py-2"
            />
            <button type="button" onClick={addLanguage} disabled={!newLang.trim() || langDup} className="inline-flex items-center gap-1 rounded-full border border-primary/25 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.05] disabled:cursor-not-allowed disabled:opacity-40">
              <PlusIcon className="h-3 w-3" />Add
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
