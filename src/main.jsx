import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/feedback.css";   // toasts, row menus, logout dialog, error panel (all portals)
import App from "./App.jsx";
import { reloadOnceForNewVersion } from "./utils/staleChunk";

// Vite fires this when a lazy chunk/CSS from an older deploy is gone.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault();
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
