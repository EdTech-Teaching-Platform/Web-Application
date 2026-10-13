import { useState } from "react";
import { XIcon } from "../../../components/ui/icons";

// RepeatableEntryList — one generic engine that renders every "add as many
// as you like" section on Educator Profile Setup (Work Experience,
// Education, Certifications & Licenses, Volunteer & Community Involvement,
// Awards & Recognitions, Professional References). Screen-local: only this
// screen needs a config-driven repeatable-card-of-fields pattern, and
// building one engine instead of six near-identical hand-rolled sections
// is what keeps six sections maintainable.
//
// These sections are all OPTIONAL context on top of the required Basic
// Information / Grades & Subjects fields that actually gate the Save
// button — a first-time educator with no formal work history shouldn't be
// blocked from finishing setup. Each field still validates inline once an
// entry has *some* data in it (soft, per-entry — see `requiredKeys`),
// exactly like every other form in this product, it just never disables
// the page-level Save button.
//
// `fields` shape: { key, label, type: "text"|"month"|"number"|"textarea",
//   placeholder?, span?: "full"|"half" (default "half"),
//   disabledWhen?: (entry) => bool }
// `requiredKeys`: keys that must be filled once ANY field in that entry has
// a value — surfaces as inline errors under just those fields, never a
// separate summary block.
function hasAnyValue(entry, fields) {
  return fields.some((f) => f.type !== "checkbox" && String(entry[f.key] ?? "").trim() !== "");
}

function FieldControl({ field, entry, onFieldChange, error, onBlur }) {
  const disabled = field.disabledWhen?.(entry) ?? false;
  const value = disabled ? "" : entry[field.key] ?? "";

  if (field.type === "checkbox") {
    return (
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
          checked={Boolean(entry[field.key])}
          onChange={(e) => onFieldChange(field.key, e.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  const commonClass = `w-full rounded-xl border bg-bg px-3.5 py-2.5 text-sm text-text outline-none transition-colors duration-150 placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-40 focus:ring-2 ${
    error ? "border-danger focus:border-danger focus:ring-danger/15" : "border-text/15 focus:border-primary focus:ring-primary/15"
  }`;

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{field.label}</span>
      {field.type === "textarea" ? (
        <textarea
          rows={2}
          className={commonClass}
          placeholder={field.placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onFieldChange(field.key, e.target.value)}
          onBlur={onBlur}
        />
      ) : (
        <input
          type={field.type === "month" ? "month" : field.type === "number" ? "number" : "text"}
          className={commonClass}
          placeholder={field.placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onFieldChange(field.key, e.target.value)}
          onBlur={onBlur}
        />
      )}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </div>
  );
}

export default function RepeatableEntryList({
  items,
  fields,
  requiredKeys = [],
  entryLabel,
  addLabel,
  emptyLabel,
  onAdd,
  onRemove,
  onChange,
}) {
  // Field-level touched state lives inside this component (keyed by
  // `${entryId}.${fieldKey}`) since none of it gates the page-level Save
  // button — it's purely inline UX polish for these optional sections.
  const [touched, setTouched] = useState({});
  const markTouched = (entryId, key) => setTouched((t) => ({ ...t, [`${entryId}.${key}`]: true }));

  return (
    <div>
      {items.length === 0 && <p className="text-sm text-muted">{emptyLabel}</p>}

      <div className="space-y-4">
        {items.map((entry, index) => {
          const filled = hasAnyValue(entry, fields);
          return (
            <div key={entry.id} className="rounded-xl border border-text/10 bg-bg/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {entryLabel(entry, index)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(entry.id)}
                  aria-label="Remove entry"
                  className="text-muted transition-colors duration-150 hover:text-danger"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.key} className={field.span === "full" ? "sm:col-span-2" : ""}>
                    <FieldControl
                      field={field}
                      entry={entry}
                      onFieldChange={(key, value) => onChange(entry.id, { ...entry, [key]: value })}
                      onBlur={() => markTouched(entry.id, field.key)}
                      error={
                        filled &&
                        requiredKeys.includes(field.key) &&
                        touched[`${entry.id}.${field.key}`] &&
                        !String(entry[field.key] ?? "").trim()
                          ? "Required"
                          : ""
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={onAdd} className="mt-4 text-sm font-semibold text-primary hover:underline">
        + {addLabel}
      </button>
    </div>
  );
}
