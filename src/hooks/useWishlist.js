import { useCallback, useEffect, useState } from "react";

// Client-side wishlist store, shared across every screen that shows a
// heart toggle (ColorBlockCard grids on Explore/Dashboard, Course Details,
// the Wishlist page itself). Doc ref: Sec 5.3 "Wishlist — Expected
// Outcome: saved list visible from the student dashboard."
//
// No wishlist endpoints exist yet (discoveryApi.js's getWishlist/
// addToWishlist/removeFromWishlist are DEMO_MODE stubs) — this hook keeps
// entries in localStorage instead of plain component state so the saved
// list actually persists across pages/reloads for a real demo, and a
// same-tab custom event (not the cross-tab-only `storage` event) keeps
// every mounted instance of this hook in sync the moment one of them
// toggles something. Swap the localStorage read/write for the real API
// calls once the backend exists — the hook's return shape doesn't need to
// change for call sites.
//
// Each entry stores `priceAtSave` (not just the course id) so the Wishlist
// page can show a "price changed since you saved it" indicator without
// needing its own separate tracking.
const KEY = "ul_wishlist_v1";
const EVENT = "ul-wishlist-changed";

const DEFAULT_SEED = [
  { id: "c3", addedAt: Date.now() - 1000 * 60 * 60 * 26, priceAtSave: 1599 },
  { id: "c6", addedAt: Date.now() - 1000 * 60 * 60 * 3, priceAtSave: 1099 },
  { id: "c7", addedAt: Date.now() - 1000 * 60 * 60 * 50, priceAtSave: 499 },
];

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      // First-ever load: seed a couple of entries so the Wishlist page and
      // the price-changed/archived states are demoable without requiring
      // manual clicks first. Any later state (including an emptied list)
      // is respected as-is.
      localStorage.setItem(KEY, JSON.stringify(DEFAULT_SEED));
      return DEFAULT_SEED;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries) {
  localStorage.setItem(KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(EVENT));
}

export function useWishlist() {
  const [entries, setEntries] = useState(read);

  useEffect(() => {
    const handler = () => setEntries(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const isWishlisted = useCallback(
    (id) => entries.some((e) => e.id === id),
    [entries]
  );

  const add = useCallback((course) => {
    const current = read();
    if (current.some((e) => e.id === course.id)) return;
    write([...current, { id: course.id, addedAt: Date.now(), priceAtSave: course.price }]);
  }, []);

  const remove = useCallback((id) => {
    write(read().filter((e) => e.id !== id));
  }, []);

  const toggle = useCallback(
    (course) => {
      if (isWishlisted(course.id)) remove(course.id);
      else add(course);
    },
    [isWishlisted, add, remove]
  );

  return { entries, ids: entries.map((e) => e.id), isWishlisted, add, remove, toggle };
}
