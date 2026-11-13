// Shared "take me to the problem" for forms in drawers and modals (QA, 13
// Nov: the validation summary appeared but the form stayed where it was).
// Fields mark themselves with aria-invalid="true" (inputs) or
// data-invalid="true" (a group, e.g. a checkbox list). The first one in
// document order inside `container` is scrolled into the middle of its
// scrolling parent and focused, so its message (next to it) is read out.
export function scrollToFirstInvalid(container) {
  if (!container) return null;
  const target = container.querySelector('[aria-invalid="true"], [data-invalid="true"]');
  if (!target) return null;
  try {
    target.scrollIntoView?.({ block: "center", behavior: "smooth" });
  } catch {
    target.scrollIntoView?.();
  }
  const focusable = target.matches("input, select, textarea, button, [tabindex]")
    ? target
    : target.querySelector("input, select, textarea, button, [tabindex]");
  try { focusable?.focus({ preventScroll: true }); } catch { focusable?.focus?.(); }
  return target;
}

export default scrollToFirstInvalid;
