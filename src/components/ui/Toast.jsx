// ToastStack: renders whatever a page's useToast() hook is holding, with the
// shared toast (src/components/feedback/Toast.jsx): the same look, layer and
// close button in every portal; an optional inline action (e.g. "Undo").
import { ToastItem, ToastPortal } from "../feedback/Toast";
import { normalizeToast } from "../feedback/toastModel";

export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts?.length) return null;
  return (
    <ToastPortal>
      {toasts.map((t) => {
        const { message, tone } = normalizeToast(t.message, t.tone);
        if (!message) return null;
        return (
          <ToastItem key={t.id} message={message} tone={tone} actionLabel={t.actionLabel} onAction={t.onAction}
            onClose={() => onDismiss?.(t.id)} />
        );
      })}
    </ToastPortal>
  );
}
