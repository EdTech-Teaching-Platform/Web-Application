import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";

// Rounded/pill inputs per design.md Section 4 (Forms): --color-primary focus
// ring, inline error text under the field (never a separate error summary).
export default function Input({
  label,
  error,
  type = "text",
  className = "",
  containerClassName = "",
  ...props
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;

  return (
    <label className={`block ${containerClassName}`}>
      {label && <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>}
      <span className="relative block">
        <input
          type={inputType}
          className={`w-full rounded-full border bg-bg px-4 py-3 text-sm text-text outline-none transition-colors duration-150 placeholder:text-text/40 ${
            error
              ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/15"
              : "border-text/15 focus:border-primary focus:ring-2 focus:ring-primary/15"
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
    </label>
  );
}
