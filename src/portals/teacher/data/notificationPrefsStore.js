// Shared, persisted copy of the educator's Notification Preferences matrix.
// The Notification Preferences page edits it; the header notification bell
// reads it so the feed only shows what the educator has switched on for the
// "In-App" channel (same category/item keys as notificationPrefsData.js).
import { useCallback, useSyncExternalStore } from "react";
import { buildRecommendedDefaults } from "./notificationPrefsData";

const KEY = "ul.educator.notifPrefs.v1";

function load() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (raw && typeof raw === "object") {
      // Merge over defaults so newly added items still get a value.
      const base = buildRecommendedDefaults();
      Object.keys(base).forEach((c) => {
        Object.keys(base[c]).forEach((i) => {
          base[c][i] = { ...base[c][i], ...(raw[c]?.[i] ?? {}) };
        });
      });
      return base;
    }
  } catch {
    /* fall through to defaults */
  }
  return buildRecommendedDefaults();
}

let prefs = load();
const listeners = new Set();

function subscribe(l) {
  listeners.add(l);
  const onStorage = (e) => {
    if (e.key === KEY || e.key === null) {
      prefs = load();
      listeners.forEach((fn) => fn());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

function setPrefsValue(next) {
  prefs = typeof next === "function" ? next(prefs) : next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* in-memory only */
  }
  listeners.forEach((fn) => fn());
}

// Same [value, setter] shape as useState (functional updates supported), so the
// Preferences page swaps it in with a one-line change.
export function useNotificationPrefs() {
  const value = useSyncExternalStore(subscribe, () => prefs, () => prefs);
  const set = useCallback((next) => setPrefsValue(next), []);
  return [value, set];
}
