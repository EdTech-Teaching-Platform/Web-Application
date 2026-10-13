import { useRef, useState } from "react";
import { useOnClickOutside } from "../hooks/useOnClickOutside";
import { XIcon } from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";

// One "Grade -> Subjects taught" row, repeatable via "+ Add another grade"
// on ProfileSetup — mirrors the reference mockup's grade/subjects table.
// Screen-local: only Educator Profile Setup needs this exact
// grade-plus-multiselect-chips row shape.
export function GradeSelect({ value, onChange, options, error }) {
  return (
    <div className="min-w-[9rem] flex-1">
      <Select
        wrapperClassName="block w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border bg-bg px-4 py-3 pr-10 text-sm text-text outline-none transition-colors duration-150 focus:ring-2 ${
          error ? "border-danger focus:border-danger focus:ring-danger/15" : "border-text/15 focus:border-primary focus:ring-primary/15"
        }`}
      >
        <option value="">Grade</option>
        {options.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </Select>
    </div>
  );
}

// Multi-select "subjects" field: selected subjects render as removable
// pill tags inline; a chevron opens a checklist dropdown to add more.
export function SubjectMultiSelect({ value, onChange, options, error }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setOpen(false));

  const toggle = (subject) => {
    onChange(value.includes(subject) ? value.filter((s) => s !== subject) : [...value, subject]);
  };

  return (
    <div ref={ref} className="relative min-w-[14rem] flex-[2]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full flex-wrap items-center gap-1.5 rounded-xl border bg-bg px-3 py-2 text-left text-sm outline-none transition-colors duration-150 ${
          error ? "border-danger" : "border-text/15 focus-within:border-primary"
        }`}
      >
        {value.length === 0 && <span className="px-1 py-1 text-muted">Subjects</span>}
        {value.map((subject) => (
          <span
            key={subject}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
          >
            {subject}
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                toggle(subject);
              }}
              className="cursor-pointer text-primary/60 hover:text-primary"
              aria-label={`Remove ${subject}`}
            >
              <XIcon className="h-3 w-3" />
            </span>
          </span>
        ))}
        <svg
          viewBox="0 0 24 24"
          className={`ml-auto h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-10 mt-1.5 w-full max-h-56 overflow-y-auto rounded-xl border border-text/10 bg-bg p-1.5 shadow-sm">
          {options.map((subject) => (
            <label
              key={subject}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text hover:bg-primary/5"
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                checked={value.includes(subject)}
                onChange={() => toggle(subject)}
              />
              {subject}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SubjectGradeRow({ row, onChange, onRemove, gradeOptions, subjectOptions, error, removable }) {
  return (
    <div className="flex items-start gap-3">
      <GradeSelect
        value={row.grade}
        onChange={(grade) => onChange({ ...row, grade })}
        options={gradeOptions}
        error={error?.grade}
      />
      <SubjectMultiSelect
        value={row.subjects}
        onChange={(subjects) => onChange({ ...row, subjects })}
        options={subjectOptions}
        error={error?.subjects}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!removable}
        aria-label="Remove grade row"
        className="mt-2.5 shrink-0 text-muted transition-colors duration-150 hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
