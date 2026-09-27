import { useRef, useState } from "react";

/**
 * Six-digit OTP entry. Calls onComplete(code) once all six digits are filled.
 * Ported from the reference Admin implementation's OtpInput.jsx.
 */
export default function OtpInput({ length = 6, onComplete }) {
  const [values, setValues] = useState(Array(length).fill(""));
  const inputsRef = useRef([]);

  const focusInput = (index) => {
    const el = inputsRef.current[index];
    if (el) el.focus();
  };

  const handleChange = (index, raw) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...values];
    next[index] = digit;
    setValues(next);

    if (digit && index < length - 1) {
      focusInput(index + 1);
    }
    if (next.every((v) => v !== "")) {
      onComplete?.(next.join(""));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !values[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    e.preventDefault();
    const next = Array(length).fill("");
    for (let i = 0; i < text.length; i += 1) next[i] = text[i];
    setValues(next);
    focusInput(Math.min(text.length, length - 1));
    if (text.length === length) onComplete?.(text);
  };

  return (
    <div className="ul-otp" onPaste={handlePaste}>
      {values.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          className="ul-otp__cell"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
