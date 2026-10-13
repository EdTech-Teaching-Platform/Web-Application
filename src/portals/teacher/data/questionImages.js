// Question images for the Test Series question builder.
//
// A question (and, optionally, each answer option) carries its image INSIDE the
// question record itself:
//
//   question.image            = { src, name, size, width, height, alt } | undefined
//   question.options[i].image = same shape, optional (objective types only)
//
// There is no backend, so `src` is a data: URL. Uploads are validated, then
// down-scaled in the browser (canvas) before they are stored, so a question
// image costs ~30-150 KB of the localStorage-backed series store instead of
// the multi-MB original. Everything is optional: a question without an image
// simply has no `image` key.
//
// This file also holds the small SVG diagrams used by the seeded demo series
// (a few physics figures), generated as data URLs so they travel with the
// question exactly like an uploaded image would.

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // size of the file the educator picks
export const QUESTION_MAX_DIM = 1280; // longest edge kept for a question image
export const OPTION_MAX_DIM = 480; // longest edge kept for an option image

export function formatBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Returns an error message, or "" when the file can be used.
export function validateImageFile(file) {
  if (!file) return "Choose an image to upload.";
  if (!IMAGE_TYPES.includes(file.type)) return "Use a PNG, JPG, WebP or GIF image.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_IMAGE_BYTES) return `That image is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_IMAGE_BYTES)}.`;
  return "";
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(file);
  });
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That file isn't a readable image."));
    el.src = src;
  });
}

// Validate -> read -> down-scale -> { src, name, size, width, height, alt }.
// Rejects with an Error whose message is safe to show to the educator.
export async function processImageFile(file, { maxDim = QUESTION_MAX_DIM } = {}) {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const original = await readAsDataUrl(file);
  const el = await loadImage(original);
  const scale = Math.min(1, maxDim / Math.max(el.naturalWidth, el.naturalHeight));
  const width = Math.max(1, Math.round(el.naturalWidth * scale));
  const height = Math.max(1, Math.round(el.naturalHeight * scale));
  let src = original;
  // Re-encode only when it actually saves space (large file or large dimensions).
  if (scale < 1 || file.size > 400 * 1024) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process that image.");
    if (file.type !== "image/png") {
      ctx.fillStyle = "#ffffff"; // JPEG/WebP have no alpha; avoid black backgrounds
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(el, 0, 0, width, height);
    const out = file.type === "image/png" && file.size <= 1024 * 1024 ? "image/png" : "image/webp";
    const encoded = canvas.toDataURL(out, 0.84);
    if (encoded.startsWith("data:image/") && (scale < 1 || encoded.length < original.length)) src = encoded;
  }
  return { src, name: file.name, size: Math.round((src.length * 3) / 4), width, height, alt: "" };
}

// ---- seeded diagrams -------------------------------------------------------
const INK = "#2f2b3a";
const MUTED = "#8a869a";
const ACCENT = "#6d4aff";
const WARM = "#f59e0b";
const BG = "#f7f5fc";

function svgData(w, h, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="Arial, Helvetica, sans-serif" font-size="13"><rect width="${w}" height="${h}" rx="14" fill="${BG}"/>${body}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function seedImage(src, name, alt, w, h) {
  return { src, name, size: Math.round(src.length * 0.75), width: w, height: h, alt };
}

const axes = (w, h, xl, yl) =>
  `<path d="M44 ${h - 38} H${w - 20} M44 ${h - 38} V22" stroke="${INK}" stroke-width="1.6" fill="none"/>` +
  `<text x="${w - 24}" y="${h - 20}" fill="${MUTED}" text-anchor="end">${xl}</text><text x="14" y="28" fill="${MUTED}">${yl}</text>`;

// v-t graph used as a question stem: velocity rises 0 -> 10 m/s in 4 s, then holds until 6 s.
export function velocityTimeStem() {
  const w = 360, h = 220;
  const body = axes(w, h, "t (s)", "v (m/s)") +
    `<path d="M44 182 L164 62 L284 62" stroke="${ACCENT}" stroke-width="3" fill="none" stroke-linejoin="round"/>` +
    `<path d="M164 62 V182 M284 62 V182" stroke="${MUTED}" stroke-width="1" stroke-dasharray="4 4"/>` +
    `<text x="164" y="200" fill="${INK}" text-anchor="middle">4</text><text x="284" y="200" fill="${INK}" text-anchor="middle">6</text>` +
    `<text x="36" y="66" fill="${INK}" text-anchor="end">10</text>`;
  return seedImage(svgData(w, h, body), "velocity-time-graph.svg", "Velocity–time graph: velocity rises uniformly from 0 to 10 m/s over 4 s, then stays constant until 6 s.", w, h);
}

// Block on a smooth incline of 30 degrees.
export function inclineStem() {
  const w = 360, h = 220;
  const body =
    `<path d="M30 190 L330 190 L330 60 Z" fill="${WARM}" fill-opacity="0.14" stroke="${INK}" stroke-width="2"/>` +
    `<g transform="rotate(-23.4 190 126)"><rect x="160" y="96" width="56" height="34" rx="4" fill="${ACCENT}" fill-opacity="0.85" stroke="${INK}" stroke-width="1.5"/><text x="188" y="118" fill="#fff" text-anchor="middle" font-weight="bold">m</text></g>` +
    `<path d="M92 190 A62 62 0 0 1 86 163" stroke="${INK}" fill="none"/><text x="104" y="180" fill="${INK}">30°</text>` +
    `<text x="212" y="212" fill="${MUTED}" text-anchor="middle">frictionless surface</text>`;
  return seedImage(svgData(w, h, body), "block-on-incline.svg", "A block of mass m resting on a frictionless incline that makes a 30 degree angle with the horizontal.", w, h);
}

// Series circuit: 12 V cell, 4 ohm and 2 ohm resistors.
export function circuitStem() {
  const w = 360, h = 220;
  const res = (x, y, label) =>
    `<path d="M${x} ${y} h8 l6 -12 l12 24 l12 -24 l12 24 l6 -12 h8" stroke="${INK}" stroke-width="2" fill="none" stroke-linejoin="round"/><text x="${x + 32}" y="${y - 22}" fill="${INK}" text-anchor="middle" font-weight="bold">${label}</text>`;
  const body =
    `<path d="M60 70 H100" stroke="${INK}" stroke-width="2"/>${res(100, 70, "4 Ω")}<path d="M180 70 H210" stroke="${INK}" stroke-width="2"/>${res(210, 70, "2 Ω")}<path d="M290 70 H320 V170 H60 V128" stroke="${INK}" stroke-width="2" fill="none"/>` +
    `<path d="M60 70 V104" stroke="${INK}" stroke-width="2"/><path d="M44 104 H76" stroke="${INK}" stroke-width="3"/><path d="M52 118 H68" stroke="${INK}" stroke-width="3"/><path d="M60 118 V128" stroke="${INK}" stroke-width="2"/>` +
    `<text x="92" y="116" fill="${ACCENT}" font-weight="bold">12 V</text><text x="190" y="200" fill="${MUTED}" text-anchor="middle">Resistors in series</text>`;
  return seedImage(svgData(w, h, body), "series-circuit.svg", "Circuit diagram: a 12 volt cell connected in series with a 4 ohm resistor and a 2 ohm resistor.", w, h);
}

// Projectile trajectory with launch angle.
export function projectileStem() {
  const w = 380, h = 220;
  const body = axes(w, h, "x", "y") +
    `<path d="M60 182 Q190 -30 320 182" stroke="${ACCENT}" stroke-width="3" fill="none" stroke-dasharray="7 5"/>` +
    `<path d="M60 182 L112 134" stroke="${INK}" stroke-width="2.4"/><path d="M114 132 l-12 2 l8 7 z" fill="${INK}"/>` +
    `<text x="118" y="132" fill="${INK}" font-weight="bold">u</text><path d="M92 182 A32 32 0 0 0 83 160" stroke="${INK}" fill="none"/><text x="100" y="172" fill="${INK}">θ</text>` +
    `<text x="190" y="210" fill="${MUTED}" text-anchor="middle">level ground</text><circle cx="320" cy="182" r="4" fill="${WARM}"/>`;
  return seedImage(svgData(w, h, body), "projectile-trajectory.svg", "A projectile launched with speed u at angle θ above level ground follows a parabolic path and lands on the same level.", w, h);
}

// Skater with arms out vs. arms in.
export function skaterStem() {
  const w = 380, h = 200;
  const skater = (cx, arm, label, spin) =>
    `<circle cx="${cx}" cy="58" r="12" fill="${ACCENT}" fill-opacity="0.85"/><path d="M${cx} 70 V122 M${cx} 122 l-14 36 M${cx} 122 l14 36" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<path d="M${cx - arm} 92 H${cx + arm}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M${cx - 44} 164 q44 14 88 0" stroke="${WARM}" stroke-width="2" fill="none"/><text x="${cx}" y="190" fill="${INK}" text-anchor="middle">${label}</text>` +
    `<text x="${cx}" y="26" fill="${MUTED}" text-anchor="middle">${spin}</text>`;
  const body = skater(100, 46, "Arms outstretched", "slow spin") + skater(280, 14, "Arms pulled in", "fast spin") + `<path d="M170 100 H206" stroke="${MUTED}" stroke-width="2"/><path d="M212 100 l-9 -6 v12 z" fill="${MUTED}"/>`;
  return seedImage(svgData(w, h, body), "skater-angular-momentum.svg", "A figure skater spinning slowly with arms outstretched, then spinning faster with arms pulled in.", w, h);
}

// Four small v-t graph options (A-D): which one shows constant negative acceleration?
export function velocityGraphOptions() {
  const w = 220, h = 150;
  const mk = (label, path, alt) => {
    const body =
      `<path d="M30 ${h - 28} H${w - 14} M30 ${h - 28} V16" stroke="${INK}" stroke-width="1.6" fill="none"/>` +
      `<text x="${w - 16}" y="${h - 10}" fill="${MUTED}" text-anchor="end" font-size="11">t</text><text x="10" y="22" fill="${MUTED}" font-size="11">v</text>` +
      `<path d="${path}" stroke="${ACCENT}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    return seedImage(svgData(w, h, body), `option-${label}.svg`, alt, w, h);
  };
  return [
    mk("A", `M30 ${h - 28} L${w - 20} 30`, "Straight line sloping upward from the origin"),
    mk("B", "M30 60 H190", "Horizontal line at constant positive velocity"),
    mk("C", `M30 34 L190 ${h - 40}`, "Straight line sloping downward at a constant rate"),
    mk("D", `M30 ${h - 30} Q110 ${h - 30} 190 24`, "Curve that bends upward with increasing slope"),
  ];
}
