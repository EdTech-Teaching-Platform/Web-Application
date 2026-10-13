import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";

// Rounded/pill inputs per design.md Section 4 (Forms): --color-primary focus
// ring, inline error text under the field (never a separate error summary).
// `helperText` renders in that same slot when there's no error — one line
// of guidance under the field (e.g. Course Builder's "Great titles are
// 40-60 characters…"), never a tooltip-only affordance.
export default function Input({
  label,
  error,
  helperText,
  type = "text",
  shape = "pill",
  className = "",
  containerClassName = "",
  ...props
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;
  const radius = shape === "rect" ? "rounded-2xl" : "rounded-full";

  return (
    <label className={`block ${containerClassName}`}>
      {label && <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>}
      <span className="relative block">
        <input
          type={inputType}
          className={`w-full ${radius} border bg-surface px-4 py-3 text-sm text-text outline-none transition-all duration-150 placeholder:text-muted/80 ${
            error
              ? "border-danger focus:border-danger focus:shadow-soft focus:ring-2 focus:ring-danger/15"
              : "border-text/12 focus:border-primary focus:shadow-soft focus:ring-2 focus:ring-primary/15"
          } ${isPassword ? "pr-11" : ""} ${className}`}
          aria-invalid={Boolean(error)}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-4 flex items-center text-text/40 hover:text-text/70"
            tabIndex={-1}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </span>
      {error && <span className="mt-1.5 block text-xs text-danger">{error}</span>}
      {!error && helperText && <span className="mt-1.5 block text-xs text-muted">{helperText}</span>}
    </label>
  );
}
