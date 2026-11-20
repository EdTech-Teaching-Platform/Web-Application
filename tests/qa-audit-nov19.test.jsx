/** @vitest-environment jsdom */
// Independent tester's audit (19 Nov 2026): website and admin portal reports.
//   index.html first paint, SEO and link-preview tags; robots / noindex for the
//   portals; admin login validation, generic errors, double-submit guard,
//   lockout after 5 failures, session-expired notice, Back after login;
//   student / educator login shows inline errors on an empty submit; no dead
//   footer icons.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const signInWithPassword = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    auth: {
      signInWithPassword: (...a) => signInWithPassword(...a),
      signOut: (...a) => signOut(...a),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({ data: { session: null } }),
    },
  },
}));
const auth = { user: null, loading: false, sessionEnded: null };
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => auth }));

const root = path.resolve(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const wait = (ms = 20) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(() => {
  signInWithPassword.mockReset(); signOut.mockClear(); rpc.mockClear();
  auth.user = null; auth.sessionEnded = null;
  sessionStorage.clear();
  window.scrollTo = () => {};
});
afterEach(() => cleanup());

describe("index.html, robots and headers (WEB-01, WEB-02, BUG-01, BUG-02)", () => {
  const html = read("index.html");
  it("has a loader inside #root and a noscript message", () => {
    expect(html).toMatch(/<div id="root"><!--app-html-->\s*<div class="ul-boot"/);
    expect(html).toMatch(/<noscript>[\s\S]*enable JavaScript[\s\S]*<\/noscript>/);
  });
  it("has a real title, description, Open Graph and Twitter tags", () => {
    expect(html).toMatch(/<title>Universal Learning[^<]+<\/title>/);
    for (const tag of ['name="description"', 'property="og:title"', 'property="og:description"', 'property="og:image"',
      'property="og:url"', 'name="twitter:card"', 'name="twitter:image"']) {
      expect(html).toContain(tag);
    }
    expect(html).toMatch(/og:image" content="https:\/\//);
  });
  it("robots.txt keeps the portals out of search", () => {
    const robots = read("public/robots.txt");
    for (const p of ["/admin", "/teacher", "/student"]) expect(robots).toContain(`Disallow: ${p}`);
  });
  it("vercel.json sends X-Robots-Tag noindex for the portals and keeps the SPA rewrite", () => {
    const cfg = JSON.parse(read("vercel.json"));
    const rule = cfg.headers.find((h) => h.source.includes("admin") && h.headers.some((x) => x.key === "X-Robots-Tag"));
    expect(rule.headers[0].value).toBe("noindex, nofollow");
    const re = new RegExp(`^${rule.source.replace(/\(\/\.\*\)\?/, "(/.*)?")}$`);
    for (const p of ["/admin", "/admin/login", "/teacher/dashboard", "/student/test-series"]) expect(re.test(p)).toBe(true);
    expect(re.test("/test-series")).toBe(false);
    expect(cfg.rewrites.at(-1)).toEqual({ source: "/((?!api/).*)", destination: "/app.html" });
    expect(cfg.headers.find((h) => h.source === "/api/(.*)").headers[0]).toEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  });
});

describe("admin login (Admin report section 3 and 4)", () => {
  async function renderLogin(state) {
    const { default: AdminLogin } = await import("../src/portals/admin/pages/AdminLogin");
    render(
      <MemoryRouter initialEntries={[{ pathname: "/admin/login", state }]}>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/logindashboard" element={<p>Dashboard</p>} />
          <Route path="/admin/students" element={<p>Students page</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }
  const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const submit = () => fireEvent.click(screen.getByRole("button", { name: /Sign In/ }));

  it("an empty submit shows inline errors and sends nothing; the page is noindex", async () => {
    await renderLogin();
    submit();
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address")).toHaveAttribute("aria-invalid", "true");
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    expect(document.title).toBe("Admin sign in | Universal Learning");
  });

  it("an invalid email format is caught; spaces are trimmed", async () => {
    await renderLogin();
    type("Email Address", "admin@test");
    type("Password", "x");
    submit();
    expect(screen.getByText(/Enter a valid email address/)).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    type("Email Address", "  admin@test.com  ");
    submit();
    await wait();
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "admin@test.com", password: "x" });
  });

  it("wrong password and a non-admin account get the same generic message", async () => {
    await renderLogin();
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    type("Email Address", "a@x.in"); type("Password", "bad");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    signInWithPassword.mockResolvedValue({ data: {}, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: null });   // get_admin_me: not an admin
    type("Password", "student-pass");
    submit();
    await wait();
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(signOut).toHaveBeenCalled();
  });

  it("a network failure shows a readable error instead of crashing", async () => {
    await renderLogin();
    signInWithPassword.mockRejectedValue(new Error("Failed to fetch"));
    type("Email Address", "a@x.in"); type("Password", "pw");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
  });

  it("a double click sends one request", async () => {
    await renderLogin();
    let resolve;
    signInWithPassword.mockImplementation(() => new Promise((r) => { resolve = r; }));
    type("Email Address", "a@x.in"); type("Password", "pw");
    const form = screen.getByLabelText("Email Address").closest("form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Signing you in…")).toBeInTheDocument();
    await act(async () => resolve({ error: { message: "Invalid login credentials" } }));
  });

  it("5 failed attempts pause the form for 30 seconds", async () => {
    await renderLogin();
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    type("Email Address", "a@x.in");
    for (let i = 0; i < 5; i += 1) {
      type("Password", `bad${i}`);
      submit();
      await wait();
    }
    expect(screen.getByRole("alert")).toHaveTextContent(/Too many failed attempts. Try again in 30 seconds/);
    expect(screen.getByRole("button", { name: /Sign In/ })).toBeDisabled();
    submit();
    expect(signInWithPassword).toHaveBeenCalledTimes(5);
  });

  it("an expired session says so, and the admin returns to the page they were on", async () => {
    await renderLogin({ reason: "expired", from: "/admin/students" });
    expect(screen.getByRole("status")).toHaveTextContent("Your session has expired");
    cleanup();
    auth.user = { id: "a1", role: "admin" };
    await renderLogin({ from: "/admin/students" });
    expect(await screen.findByText("Students page")).toBeInTheDocument();
  });

  it("Back to the login page while signed in goes to the dashboard; outside paths are ignored", async () => {
    auth.user = { id: "a1", role: "admin" };
    await renderLogin({ from: "https://evil.example/x" });
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });
});

describe("admin route guard", () => {
  it("signed out: no admin page renders; an expired session carries the notice and the return path", async () => {
    auth.user = null; auth.sessionEnded = "expired";
    const { default: AdminLayout } = await import("../src/layouts/AdminLayout");
    let seen = null;
    function LoginProbe() {
      seen = useLocation().state;
      return <p>Login page</p>;
    }
    render(
      <MemoryRouter initialEntries={["/admin/students?page=2"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}><Route path="students" element={<p>Secret students</p>} /></Route>
          <Route path="/admin/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(screen.queryByText("Secret students")).toBeNull();
    expect(seen).toEqual({ from: "/admin/students?page=2", reason: "expired" });
  });
});

describe("student / educator login (Website report, forms)", () => {
  it("an empty submit shows the inline errors (the button isn't silently disabled)", async () => {
    const { default: Login } = await import("../src/auth/pages/Login");
    render(<MemoryRouter initialEntries={["/login?expired=1"]}><Login /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("Your session has expired");
    const button = screen.getByRole("button", { name: "Log In" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("footer (Website report, dead buttons)", () => {
  it("social icons without a real URL are not shown", async () => {
    const { default: SiteFooter } = await import("../src/public/components/SiteFooter");
    render(<MemoryRouter><SiteFooter /></MemoryRouter>);
    expect(screen.queryByLabelText("LinkedIn")).toBeNull();
    expect(screen.queryByLabelText("Instagram")).toBeNull();
    expect(screen.getByLabelText("Email")).toHaveAttribute("href", expect.stringMatching(/^mailto:/));
    expect(document.querySelector('[aria-disabled="true"]')).toBeNull();
  });
});
