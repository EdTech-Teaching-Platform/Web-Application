// After `vite build`: dist/index.html becomes dist/app.html (the SPA shell).
// Vercel serves a static index.html for "/" before any rewrite, so without
// this "/" could never reach the server-rendered page (api/page.js, QA audit
// WEB-03). vercel.json sends every other app route to /app.html.
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve(process.cwd(), "dist");
const from = path.join(dist, "index.html");
const to = path.join(dist, "app.html");
if (!fs.existsSync(from)) {
  console.error("postbuild-shell: dist/index.html not found");
  process.exit(1);
}
const html = fs.readFileSync(from, "utf8");
if (!html.includes("<!--app-html-->") || !html.includes("<!--/app-html-->")) {
  console.error("postbuild-shell: the app-html markers are missing from index.html");
  process.exit(1);
}
fs.renameSync(from, to);
console.log("postbuild-shell: dist/index.html -> dist/app.html");
