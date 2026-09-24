import { useEffect, useRef, useState } from "react";
import { IconClose } from "./icons";
import "./NotepadPanel.css";

const STORAGE_KEY = "ul-admin-notepad";

// Small floating scratchpad toggled from AdminSidebar's "Notepad" switch.
// Plain textarea, autosaved to this browser's localStorage (per-device,
// same pattern any other admin-only client-side convenience would use —
// there's no backend note-taking endpoint to call). Renders globally
// (mounted by the sidebar, which is shared across every /admin/* route),
// so a note started on one screen is still there after navigating away.
export default function NotepadPanel({ onClose }) {
  const [text, setText] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setText(stored);
    } catch {
      // localStorage unavailable (private browsing, blocked storage, etc.)
      // — the notepad still works for this session, it just won't persist.
    }
  }, []);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const handleChange = (event) => {
    const value = event.target.value;
    setText(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
        setSavedAt(new Date());
      } catch {
        // ignore — best-effort persistence only
      }
    }, 400);
  };

  return (
    <div className="ul-notepad" role="dialog" aria-label="Notepad">
      <div className="ul-notepad__head">
        <span className="ul-notepad__title">Notepad</span>
        <button type="button" className="ul-notepad__close" onClick={onClose} aria-label="Close notepad">
          <IconClose size={13} />
        </button>
      </div>
      <textarea
        className="ul-notepad__area"
        placeholder="Jot a quick note — it stays saved on this device."
        value={text}
        onChange={handleChange}
        autoFocus
      />
      <div className="ul-notepad__foot">
        {savedAt
          ? `Saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Autosaves as you type"}
      </div>
    </div>
  );
}
