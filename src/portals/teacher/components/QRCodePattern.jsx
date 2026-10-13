// Deterministic pseudo-QR pattern for the Digital ID Card.
//
// ⚠ Placeholder, not a scannable QR code: there is no backend endpoint yet
// for a real "verify this educator" URL/token, and the project intentionally
// avoids pulling in a QR-generation dependency (or hitting a third-party QR
// image API over the network) for a single visual element. This renders a
// realistic-looking, module-grid pattern — same fixed finder squares any
// real QR code has in three corners, remaining modules derived from a seeded
// hash of the educator ID so the SAME educator always renders the SAME
// pattern (stable across re-renders/reloads, not random noise).
//
// Swap this out for a real generator (e.g. the `qrcode` package, rendering
// SVG from a signed verification URL from the backend) once that endpoint
// exists — the `seed` prop is already the natural input for that.
const GRID = 21; // matches a real QR "Version 1" module count, for scale/realism

function seededBit(seed, x, y) {
  // Simple deterministic hash — not cryptographic, just needs to be stable
  // per (seed, x, y) and look sufficiently "random" visually.
  let h = 0;
  const str = `${seed}:${x}:${y}`;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return (h & 1) === 0;
}

function isFinderZone(x, y) {
  const zones = [
    [0, 0],
    [GRID - 7, 0],
    [0, GRID - 7],
  ];
  return zones.some(([zx, zy]) => x >= zx && x < zx + 7 && y >= zy && y < zy + 7);
}

function FinderSquare({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width={7} height={7} fill="currentColor" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="white" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </g>
  );
}

export default function QRCodePattern({ seed = "UL-EDU", className = "" }) {
  const cells = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (isFinderZone(x, y)) continue;
      if (seededBit(seed, x, y)) {
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />);
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${GRID} ${GRID}`}
      className={className}
      role="img"
      aria-label={`QR verification code for ${seed}`}
    >
      <rect x={0} y={0} width={GRID} height={GRID} fill="white" />
      <g className="text-text">
        {cells}
        <FinderSquare x={0} y={0} />
        <FinderSquare x={GRID - 7} y={0} />
        <FinderSquare x={0} y={GRID - 7} />
      </g>
    </svg>
  );
}
