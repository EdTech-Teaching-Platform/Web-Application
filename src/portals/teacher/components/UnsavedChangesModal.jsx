import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";

// Shown by useUnsavedGuard when the educator tries to leave with changes that
// haven't been saved yet (autosave pending or failed).
// With no onSaveAndLeave (e.g. the start flow, where nothing is saved until the
// series is created) it becomes a plain "discard your selections?" prompt.
export default function UnsavedChangesModal({ open, saveFailed, onSaveAndLeave, onLeave, onStay }) {
  return (
    <Modal
      open={open}
      onClose={onStay}
      title={onSaveAndLeave ? "Leave with unsaved changes?" : "Discard your setup?"}
      footer={
        <>
          {onSaveAndLeave && (
            <Button fullWidth={false} className="px-6" onClick={onSaveAndLeave}>
              Save &amp; leave
            </Button>
          )}
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onStay}>
            Stay here
          </Button>
          <Button variant="tertiary" fullWidth={false} className="px-6 text-danger" onClick={onLeave}>
            {onSaveAndLeave ? "Leave without saving" : "Discard and leave"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">
        {!onSaveAndLeave
          ? "You've set things up here but haven't started building yet. Leaving now discards that."
          : saveFailed
            ? "Your latest edits couldn't be saved. Retry now, or stay and keep working."
            : "Your latest edits are still being saved. Save them now so nothing is lost."}
      </p>
    </Modal>
  );
}
