import { useCallback, useRef, useState } from "react";

// Lightweight toast queue for cross-cutting confirmations (design.md UX
// note: "toast notifications for lightweight actions") — e.g. "Removed
// from wishlist" with an Undo action, or "Coupon applied". Deliberately
// local per-page state (not a global provider mounted in App.jsx) since
// only a few Day 3 screens need it; pair with <ToastStack/> from
// src/components/ui/Toast.jsx.
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, { actionLabel, onAction, duration = 4500 } = {}) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, actionLabel, onAction }]);
      window.setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return { toasts, showToast, dismiss };
}
