import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import QRCodePattern from "./QRCodePattern";
import { CheckIcon } from "../../../components/ui/icons";

// "Share ID Card" — Modal shell per design.md (same header/close + CTA
// footer pattern used everywhere else), specialized here with a large QR
// code and a copyable verification link. Screen-local: only Profile Setup
// currently needs to share a Digital ID Card.
export default function IDCardShareModal({ open, onClose, profile }) {
  const [copied, setCopied] = useState(false);

  // TODO: replace with the real backend-issued public verification URL
  // once that endpoint exists (see QRCodePattern.jsx note).
  const verifyUrl = `https://universallearning.example/verify/${profile.educatorId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (older browsers, insecure
      // context) — fail silently rather than throwing in the UI.
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share Digital ID Card" size="sm">
      <div className="flex flex-col items-center text-center">
        <div className="rounded-xl bg-white p-3 ring-1 ring-text/10">
          <QRCodePattern seed={profile.educatorId} className="h-40 w-40 text-text" />
        </div>
        <p className="mt-4 text-sm text-muted">
          Anyone with this link can verify {profile.fullName}'s educator credential on Universal Learning.
        </p>

        <div className="mt-4 flex w-full items-center gap-2 rounded-xl border border-text/15 bg-white px-4 py-2.5">
          <span className="min-w-0 flex-1 truncate text-left text-xs text-muted">{verifyUrl}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            {copied ? (
              <span className="flex items-center gap-1 text-success">
                <CheckIcon className="h-3.5 w-3.5" /> Copied
              </span>
            ) : (
              "Copy link"
            )}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <Button shape="rect" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
