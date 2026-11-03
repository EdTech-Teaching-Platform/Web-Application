// Where a fixed-position menu goes next to its trigger, staying inside the
// viewport. Below the trigger if it fits, else above, else on the side with
// more room (clamped); right edges aligned (menu grows to the left) if it
// fits, else left edges aligned, else clamped to the viewport.
//   anchor: {top, bottom, left, right} (getBoundingClientRect of the trigger)
//   menu: {width, height}; viewport: {width, height}
// Returns {top, left, placement: 'bottom'|'top', align: 'end'|'start'}.
export function computeMenuPosition(anchor, menu, viewport, { gap = 4, margin = 8 } = {}) {
  const w = Math.min(menu.width, viewport.width - margin * 2);
  const h = Math.min(menu.height, viewport.height - margin * 2);

  const below = anchor.bottom + gap;
  const above = anchor.top - gap - h;
  let placement;
  let top;
  if (below + h <= viewport.height - margin) { placement = "bottom"; top = below; }
  else if (above >= margin) { placement = "top"; top = above; }
  else {
    const roomBelow = viewport.height - anchor.bottom;
    placement = roomBelow >= anchor.top ? "bottom" : "top";
    top = placement === "bottom" ? below : above;
  }
  top = Math.max(margin, Math.min(top, viewport.height - margin - h));

  let align;
  let left;
  if (anchor.right - w >= margin) { align = "end"; left = anchor.right - w; }
  else if (anchor.left + w <= viewport.width - margin) { align = "start"; left = anchor.left; }
  else { align = "start"; left = margin; }
  left = Math.max(margin, Math.min(left, viewport.width - margin - w));

  return { top: Math.round(top), left: Math.round(left), placement, align };
}
