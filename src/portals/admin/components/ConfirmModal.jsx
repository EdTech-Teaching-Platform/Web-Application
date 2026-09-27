import { IconAlert } from "./icons";
import "./ConfirmModal.css";

// Small reusable confirmation dialog for destructive/sensitive admin
// actions (Suspend, Deactivate, Delete, Reject, Reset Password, Force
// Logout, ...). Shared between the Educator List and Educator Profile so
// every such action gets the same explain-before-you-click treatment.
//
// props:
//   open        boolean
//   title       string
//   description string — what the action does
//   confirmLabel string (default "Confirm")
//   tone        "default" | "danger" (danger = red confirm button)
//   onConfirm() onCancel()
//   children    optional extra content (e.g. a reason textarea) rendered
//               between the description and the action buttons
export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "default",
  onConfirm,
  onCancel,
  children,
  confirmDisabled = false,
}) {
  if (!open) return null;

  return (
    <div className="ul-confirm-backdrop" onClick={onCancel}>
      <div className="ul-confirm-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="ul-confirm-modal__header">
          <span className={`ul-confirm-modal__icon${tone === "danger" ? " is-danger" : ""}`}>
            <IconAlert size={16} color={tone === "danger" ? "#b3261e" : "var(--color-warning-accent)"} />
          </span>
        </div>
        <h3 className="ul-confirm-modal__title">{title}</h3>
        {description && <p className="ul-confirm-modal__desc">{description}</p>}
        {children}
        <div className="ul-confirm-modal__actions">
          <button type="button" className="ul-btn ul-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`ul-btn ${tone === "danger" ? "ul-btn--danger" : "ul-btn--primary"}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
