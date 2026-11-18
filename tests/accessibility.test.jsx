/** @vitest-environment jsdom */
// Accessibility baseline: skip link, route titles, route announcements,
// focus management, labelled landmarks and the shared CSS rules.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";

import RouteA11y, { humanizePath, titleFromDocument } from "../src/components/common/RouteA11y";

afterEach(() => { cleanup(); document.title = ""; });

const root = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

function App({ start = "/" }) {
  return (
    <MemoryRouter initialEntries={[start]}>
      <RouteA11y />
      <nav aria-label="test"><Link to="/courses/web-dev">Go</Link></nav>
      <main>
        <Routes>
          <Route path="/" element={<h1>Welcome home</h1>} />
          <Route path="/courses/:slug" element={<h1>Web development</h1>} />
        </Routes>
      </main>
    </MemoryRouter>
  );
}

describe("RouteA11y", () => {
  it("renders a skip link that moves focus to the main landmark", () => {
    render(<App />);
    const skip = screen.getByRole("link", { name: /skip to main content/i });
    expect(skip).toHaveAttribute("href", "#main-content");
    fireEvent.click(skip);
    expect(screen.getByRole("main")).toHaveFocus();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("sets a page title from the h1 and updates it on navigation", async () => {
    render(<App />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(document.title).toBe("Welcome home | Universal Learning");
    await act(async () => { fireEvent.click(screen.getByText("Go")); });
    await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
    expect(document.title).toBe("Web development | Universal Learning");
  });

  it("announces the new page politely and focuses main after navigation", async () => {
    render(<App />);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    const link = screen.getByText("Go");
    link.focus();
    await act(async () => { fireEvent.click(link); });
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    const live = screen.getByTestId("route-announcer");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("Web development page loaded");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("falls back to the path when a page has no heading", () => {
    expect(humanizePath("/student/my-learning")).toBe("My learning");
    expect(humanizePath("/")).toBe("Home");
    const el = document.createElement("div");
    expect(titleFromDocument(el, "/admin/test-series")).toBe("Test series");
  });
});

describe("accessibility baseline in source", () => {
  it("every <nav> in src has an accessible name", () => {
    const missing = [];
    const walk = (dir) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, f.name);
        if (f.isDirectory()) walk(full);
        else if (f.name.endsWith(".jsx")) {
          const src = fs.readFileSync(full, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
          for (const m of src.matchAll(/<nav\b[^>]*>?/g)) {
            // include the following lines for multi-line tags
            const idx = m.index;
            const tag = src.slice(idx, src.indexOf(">", idx) + 1);
            if (!/aria-label(ledby)?=/.test(tag)) missing.push(path.relative(root, full));
          }
        }
      }
    };
    walk(path.join(root, "src"));
    expect(missing).toEqual([]);
  });

  it("global CSS ships focus, reduced-motion, forced-colors and skip-link rules", () => {
    const css = read("src/index.css");
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*scroll-behavior: auto/);
    expect(css).toMatch(/forced-colors: active/);
    expect(css).toMatch(/\.a11y-skip-link/);
  });

  it("the app shell mounts the route accessibility helper and the page declares a language", () => {
    expect(read("src/routes/AppRoutes.jsx")).toMatch(/<RouteA11y \/>/);
    expect(read("index.html")).toMatch(/<html lang="en">/);
  });
});
