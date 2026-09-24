import { useRef } from "react";

// Shared 6-digit code input for both OTP verification contexts (account
// verification and admin/super-admin 2FA) — was referenced by
// OtpVerification.jsx but never actually built, so it's added here now.
// Each digit is its own box; typing auto-advances focus, Backspace on an
// empty box moves focus back, and pasting a full code fills every box at
// once (covers the common "paste from Messages/authenticator" case).
export default function OtpInput({ length = 6, value, onChange, error = false, disabled = false }) {
  const inputsRef = useRef([]);
  const digits = value.padEnd(length, " ").split("").slice(0, length);

  const setDigitAt = (index, char) => {
    const next = value.split("");
    next[index] = char;
    onChange(next.join("").slice(0, length).replace(/\s/g, ""));
  };

  const handleChange = (index) => (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setDigitAt(index, "");
      return;
    }
    // Only the last typed character matters per box; a multi-char paste
    // into a single box is handled by handlePaste instead.
    const char = raw.slice(-1);
    setDigitAt(index, char);
    if (index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index) => (e) => {
    if (e.key === "Backspace" && !digits[index]?.trim() && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted.padEnd(value.length > pasted.length ? value.length : 0, "").slice(0, length) || pasted);
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  return (
    <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          disabled={disabled}
          className={`h-12 w-10 rounded-xl border text-center font-display text-lg text-text focus:outline-none focus:ring-2 focus:ring-primary/40 sm:h-14 sm:w-12 ${
            error ? "border-danger" : "border-text/15"
          } ${disabled ? "opacity-60" : ""}`}
        />
      ))}
    </div>
  );
}
