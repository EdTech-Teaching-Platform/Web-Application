// Tiny shared store for the Admin portal's Light/Dark theme toggle.
//
// Same useSyncExternalStore pub/sub pattern already used elsewhere in this
// portal (see data/notificationsMock.js) instead of a React Context, so no
// provider needs to be threaded through AppRoutes.jsx — AdminLayout just
// reads/writes this store directly, and any component (e.g. the topbar
// toggle button) can subscribe to it.
//
// Persisted to localStorage so the choice survives navigation and page
// refreshes; applied by AdminLayout as a `data-theme` attribute on the
// portal's root `.ul-shell` element, which the dark-mode overrides in
// adminTheme.css / AdminChrome.css key off of.
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "ul-admin-theme";
const listeners = new Set();

function readInitial() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

let theme = readInitial();

function notify() {
  listeners.forEach((l) => l());
}

function setTheme(next) {
  theme = next === "dark" ? "dark" : "light";
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable (private mode etc.) — theme still applies
    // for the current session, it just won't persist across a refresh.
  }
  notify();
}

export function toggleAdminTheme() {
  setTheme(theme === "dark" ? "light" : "dark");
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return theme;
}

export function useAdminTheme() {
  return useSyncExternalStore(subscribe, getSnapshot, () => "light");
}
