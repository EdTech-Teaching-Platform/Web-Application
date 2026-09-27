// ToastStack — renders whatever a page's useToast() hook is holding.
// Fixed to the bottom of the viewport, stacked, auto-dismissing (handled
// by the hook); an optional inline action (e.g. "Undo").
export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts?.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-4 rounded-2xl bg-text px-4 py-3 text-sm text-white shadow-lg [animation:toastIn_200ms_ease-out]"
        >
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.actionLabel && (
            <button
              type="button"
              onClick={() => {
                t.onAction?.();
                onDismiss?.(t.id);
              }}
              className="shrink-0 font-semibold text-rotation-1 hover:underline"
            >
              {t.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
