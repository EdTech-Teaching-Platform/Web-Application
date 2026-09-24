// Placeholder photography — fills course/instructor/certificate cards and
// the hero collage with real images instead of empty/illustrated blocks,
// per request, until the actual course/educator photo library exists.
//
// Two sources, both license-safe for placeholder use (no fabricated real
// people/brands presented as genuine):
// - images.unsplash.com: fixed, hand-picked photo IDs, one per category,
//   so a course card's image is topically related to its subject
//   (Unsplash License — free to use, no attribution required).
// - i.pravatar.cc: generic placeholder headshots for the fictional mock
//   people already used in testimonials/instructor data (Ananya, Karan,
//   etc.) — a standard placeholder-avatar service, not real named
//   individuals' photos presented as themselves.
//
// Swap every URL here for real photography/avatars once that library
// exists — nothing about the component API changes when that happens,
// since ColorBlockCard/CertificateCard/Marquee all just take an image URL.
function unsplash(id, w = 480, h = 360) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=60`;
}

// Hand-picked Unsplash photo IDs are a single point of failure — one typo'd
// or since-removed id 404s with no visible fallback (which is exactly what
// happened on one hero tile). Every <img> using a URL from this file wires
// onError={(e) => imgFallback(e, seed, w, h)} so a failed load swaps to a
// Picsum photo instead of a broken-image icon. Picsum doesn't do topical
// search, so it's a "not empty" fallback rather than a "still relevant"
// one — acceptable since this only fires when the primary photo id is
// unavailable, not in the normal case.
export function fallbackImage(seed, w = 480, h = 360) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

export function imgFallback(event, seed, w, h) {
  const img = event.target;
  if (img.dataset.fallbackApplied) return; // only swap once, never loop
  img.dataset.fallbackApplied = "1";
  img.src = fallbackImage(seed, w, h);
}

const CATEGORY_PHOTO_IDS = {
  Programming: "1517694712202-14dd9538aa97", // laptop with code on screen
  Math: "1509228468518-180dd4864904", // chalkboard full of equations
  Science: "1532187863486-abf9dbad1b69", // lab equipment
  Languages: "1456513080510-7bf3a84b82f8", // stack of open books
  Music: "1493225457124-a3eb161ffa5f", // acoustic guitar close-up
  Design: "1561070791-2526d30994b5", // design desk with color swatches
  Business: "1454165804606-c3d57bc86b40", // meeting/whiteboard
  Other: "1523240795612-9a054b0db644", // graduation cap
};

export function imageForCategory(category, size) {
  const id = CATEGORY_PHOTO_IDS[category] ?? CATEGORY_PHOTO_IDS.Other;
  return unsplash(id, size?.w, size?.h);
}

// Hero photo collage — four generic learning/study photos (not category-
// specific, since the hero doesn't represent one subject).
export const HERO_COLLAGE_PHOTOS = [
  unsplash("1522202176988-66273c2fd55f", 400, 400), // students studying together
  unsplash("1499750310107-5fef28a66643", 400, 400), // person typing on a laptop
  unsplash("1571260899304-425eee4c7efc", 400, 400), // online class on a screen
  unsplash("1509062522246-3755977927d7", 400, 400), // notebook + coffee, desk
];

function seedNumber(seed, mod) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % mod;
}

// Deterministic placeholder avatar per person name — same name always
// gets the same avatar within a session, without needing real headshots.
// Small (150x150), meant for the Marquee's avatar circles.
export function avatarFor(seed) {
  const imgId = seedNumber(seed, 70) + 1; // pravatar serves ids 1-70
  return `https://i.pravatar.cc/150?img=${imgId}`;
}

// Larger portrait photos for instructor ColorBlockCards — pravatar's
// 150x150 avatars read as blurry/low-res stretched across a full card, so
// this uses proper portrait photography instead, cycled deterministically
// by name.
const PORTRAIT_PHOTO_IDS = [
  "1580489944761-15a19d654956", // portrait, woman smiling
  "1507003211169-0a1dd7228f2d", // portrait, man smiling
  "1573496359142-b8d87734a5a2", // portrait, woman outdoors
  "1519085360753-af0119f7cbe7", // portrait, man outdoors
];

export function imageForPerson(seed, size) {
  const id = PORTRAIT_PHOTO_IDS[seedNumber(seed, PORTRAIT_PHOTO_IDS.length)];
  return unsplash(id, size?.w, size?.h);
}

// Certificates aren't category-specific — cycle a small set of generic
// diploma/award-adjacent photos by index instead.
const CERTIFICATE_PHOTO_IDS = [
  "1607013251379-e6eecfffe234", // diploma/certificate on a desk
  "1523240795612-9a054b0db644", // graduation cap
];

export function imageForCertificate(index) {
  const id = CERTIFICATE_PHOTO_IDS[index % CERTIFICATE_PHOTO_IDS.length];
  return unsplash(id, 300, 225);
}
