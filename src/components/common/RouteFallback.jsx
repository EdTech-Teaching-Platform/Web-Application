// Shown while a lazily-loaded page chunk is fetched. Deliberately light: a thin
// pulsing bar inside the layout (header / nav stay put) so navigation never
// flashes a blank screen. `fullscreen` is used outside any layout.
export default function RouteFallback({ fullscreen = false }) {
  return (
    <div
      className={`flex items-start justify-center px-6 ${fullscreen ? "min-h-screen items-center bg-[#f3f6fd]" : "min-h-[40vh] pt-24"}`}
      role="status"
      aria-label="Loading"
    >
      <span className="h-1.5 w-28 rounded-full bg-[#dfe6f7] motion-safe:animate-pulse" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
