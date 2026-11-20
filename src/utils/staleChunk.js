// A deploy replaces the hashed files under /assets. A tab that was opened
// before the deploy still points at the old file names, so the next lazy page
// (e.g. /admin) fails with "Unable to preload CSS …" or "Failed to fetch
// dynamically imported module". Reloading fetches the new index.html and fixes
// it, so we do that once automatically; the guard stops a reload loop if the
// problem is something else (the error panel then shows as before).
const KEY = "ul.stale-chunk-reload-at";
const WINDOW_MS = 30000;

export const isStaleChunkError = (message) =>
  /Unable to preload|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
    String(message || ""),
  );

export function reloadOnceForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // no sessionStorage: don't risk a reload loop
  }
  window.location.reload();
  return true;
}
