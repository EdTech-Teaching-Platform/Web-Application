import { useRef } from "react";

// 6-box numeric code input — not named in design.md, proposed here per the
// build spec (Section 7: new, src/components/ui/OtpInput.jsx). Auto-advances
// focus per digit, supports paste, and reports `error` visually only —
// the caller owns the actual error copy shown beneath it.
export default function OtpInput({ length = 6, value, onChange, error, disabled }) {
  const refs = useRef([]);

  const setDigit = (index, digit) => {
    const chars = value.padEnd(length, " ").split("");
    chars[index] = digit || " ";
    onChange(chars.join("").trimEnd());
  };

  const handleChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setDigit(index, "");
      return;
    }
    const digit = raw[raw.length - 1];
    setDigit(index, digit);
    if (index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div className="flex justify-center gap-2.5" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`h-12 w-11 rounded-xl border bg-bg text-center text-lg font-semibold text-text outline-none transition-colors duration-150 disabled:opacity-50 ${
            error
              ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/15"
              : "border-text/15 focus:border-primary focus:ring-2 focus:ring-primary/15"
          }`}
        />
      ))}
    </div>
  );
}
