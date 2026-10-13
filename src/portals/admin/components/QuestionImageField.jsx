// Optional picture for a question: choose a file, preview it, remove it.
// Stored on the question as a data URL (`image`) until a real upload API exists.
import { useRef, useState } from "react";

const MAX_BYTES = 2 * 1024 * 1024;
const OK_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export default function QuestionImageField({ value, onChange }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!OK_TYPES.includes(f.type)) { setError("Use a PNG, JPG, WEBP or GIF image."); return; }
    if (f.size > MAX_BYTES) { setError("Image must be 2 MB or smaller."); return; }
    setError("");
    const rd = new FileReader();
    rd.onload = () => onChange(String(rd.result || ""));
    rd.onerror = () => setError("Could not read that file.");
    rd.readAsDataURL(f);
  };

  return (
    <div className="ul-ts-form-row">
      <label>Question image (optional)</label>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onFile} style={{ display: "none" }} />
      {value ? (
        <div className="ul-qimg">
          <img src={value} alt="Question attachment preview" className="ul-qimg__img" />
          <div className="ul-qimg__actions">
            <button type="button" className="ul-btn ul-btn--ghost" onClick={() => inputRef.current && inputRef.current.click()}>Replace</button>
            <button type="button" className="ul-btn ul-btn--ghost" onClick={() => { setError(""); onChange(""); }}>Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" className="ul-qimg__drop" onClick={() => inputRef.current && inputRef.current.click()}>
          Upload a photo or diagram
          <small>PNG, JPG, WEBP or GIF · up to 2 MB</small>
        </button>
      )}
      {error && <span className="ul-tsw-hint" style={{ color: "#b3261e" }}>{error}</span>}
    </div>
  );
}
