// DecorAccents — purely decorative corner accents for hero/header areas:
// soft translucent circles, a thin diagonal dash mark and a small "+".
// Render inside a `relative overflow-hidden` parent; everything is
// aria-hidden, pointer-events-none and sits behind content (-z-0 + the
// parent's content should be `relative`). Never place over real content.
//
// `corner`: "right" (default) or "left" picks which edge the circles hug.
export default function DecorAccents({ corner = "right", className = "" }) {
  const right = corner !== "left";
  return (
    <div aria-hidden="true" data-decor className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <span
        className={`decor-circle h-56 w-56 -top-24 ${right ? "-right-16" : "-left-16"}`}
      />
      <span
        className={`decor-circle decor-circle-blush h-28 w-28 -bottom-10 ${right ? "right-24" : "left-24"}`}
      />
      <span className={`decor-circle decor-circle-sand h-16 w-16 top-10 ${right ? "right-44" : "left-44"}`} />
      <span className={`decor-dash bottom-6 ${right ? "right-10" : "left-10"}`} />
      <span className={`decor-plus top-8 ${right ? "right-72" : "left-72"} hidden sm:block`} />
    </div>
  );
}
