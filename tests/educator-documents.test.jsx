/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("../src/services/supabaseClient", () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));

import { contentTypeFor, decideAccess, resolveDocLocation, signedUrlTtl } from "../supabase/functions/sign-educator-document/paths.ts";
import { invokeFunction } from "../src/services/edgeFunctions";
import { useDocumentViewer, isPdfPath } from "../src/components/common/DocumentViewer";

const OWNER = "0f8fad5b-d9cb-469f-a165-70867728950e";
const OTHER = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const BUCKET = "educator-verification-docs";

afterEach(() => cleanup());

// -----------------------------------------------------------------------------
describe("doc_url normalizer (old and new formats)", () => {
  it("new uploads: '<educator>/<file>' in EDUCATOR_DOCS_BUCKET", () => {
    expect(resolveDocLocation(`${OWNER}/government_id-front-1730000000.jpg`, OWNER, BUCKET))
      .toEqual({ kind: "storage", bucket: BUCKET, path: `${OWNER}/government_id-front-1730000000.jpg` });
  });

  it("older paths: bucket prefix, leading slash, encoded characters, backslashes", () => {
    expect(resolveDocLocation(`${BUCKET}/${OWNER}/x.pdf`, OWNER, BUCKET).path).toBe(`${OWNER}/x.pdf`);
    expect(resolveDocLocation("/legacy/scan.pdf", OWNER, BUCKET)).toEqual({ kind: "storage", bucket: BUCKET, path: "legacy/scan.pdf" });
    expect(resolveDocLocation("legacy/my%20scan.pdf", OWNER, BUCKET).path).toBe("legacy/my scan.pdf");
    expect(resolveDocLocation("legacy\\scan.pdf", OWNER, BUCKET).path).toBe("legacy/scan.pdf");
  });

  it("full storage URLs (public / sign / authenticated / no segment, with a token) use their own bucket", () => {
    for (const seg of ["public/", "sign/", "authenticated/", ""]) {
      expect(resolveDocLocation(`https://p.supabase.co/storage/v1/object/${seg}old-bucket/${OWNER}/id.png?token=abc`, OWNER, BUCKET))
        .toEqual({ kind: "storage", bucket: "old-bucket", path: `${OWNER}/id.png` });
    }
  });

  it("other URLs are external; bad paths are refused", () => {
    expect(resolveDocLocation("https://drive.example.com/file/1", OWNER, BUCKET)).toEqual({ kind: "external", url: "https://drive.example.com/file/1" });
    expect(() => resolveDocLocation(`${OWNER}/../${OTHER}/x.jpg`, OWNER, BUCKET)).toThrow("Document not found");
    expect(() => resolveDocLocation(`${OTHER}/x.jpg`, OWNER, BUCKET)).toThrow("Document not found");   // row points into another folder
    expect(() => resolveDocLocation("", OWNER, BUCKET)).toThrow("Document not found");
    expect(() => resolveDocLocation("legacy/x.pdf", OWNER, undefined)).toThrow("EDUCATOR_DOCS_BUCKET");
  });

  it("the folder check is about the document's educator, never the caller", () => {
    // an admin opening OWNER's file: the check compares the path with the row's educator (OWNER)
    expect(resolveDocLocation(`${OWNER}/id.jpg`, OWNER, BUCKET).kind).toBe("storage");
  });

  it("content type, TTL", () => {
    expect(contentTypeFor("a/b.JPG")).toBe("image/jpeg");
    expect(contentTypeFor("a/b.pdf")).toBe("application/pdf");
    expect(contentTypeFor("a/b")).toBe("application/octet-stream");
    expect(signedUrlTtl(undefined)).toBe(600);
    expect(signedUrlTtl("5")).toBe(60);
    expect(signedUrlTtl("99999")).toBe(3600);
    expect(signedUrlTtl("abc")).toBe(600);
    expect(isPdfPath(`${OWNER}/x.pdf`)).toBe(true);
  });
});

describe("access decision", () => {
  it("admin: any document; owner: own only; nobody else", () => {
    expect(decideAccess({ isAdmin: true, callerId: OTHER, educatorId: OWNER })).toBe("admin");
    expect(decideAccess({ isAdmin: false, callerId: OWNER, educatorId: OWNER })).toBe("owner");
    expect(decideAccess({ isAdmin: false, callerId: OWNER.toUpperCase(), educatorId: OWNER })).toBe("owner");
    expect(decideAccess({ isAdmin: false, callerId: OTHER, educatorId: OWNER })).toBeNull();
    expect(decideAccess({ isAdmin: false, callerId: null, educatorId: OWNER })).toBeNull();
    expect(decideAccess({ isAdmin: false, callerId: OWNER, educatorId: null })).toBeNull();
  });
});

// -----------------------------------------------------------------------------
describe("function errors reach the UI", () => {
  const client = (error) => ({ functions: { invoke: vi.fn().mockResolvedValue({ data: null, error }) } });

  it("uses the function's own message and status", async () => {
    const error = { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code",
      context: { status: 403, json: async () => ({ error: "You can't open this document." }) } };
    await expect(invokeFunction("sign-educator-document", {}, client(error))).rejects.toMatchObject({ message: "You can't open this document.", status: 403 });
  });

  it("says when the function isn't deployed, and when the network is down", async () => {
    const missing = { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context: { status: 404, json: async () => { throw new Error("not json"); } } };
    await expect(invokeFunction("sign-educator-document", {}, client(missing))).rejects.toThrow(/isn't available \(not deployed\?\)/);
    await expect(invokeFunction("x", {}, client({ name: "FunctionsFetchError", message: "Failed to send a request" }))).rejects.toThrow(/Can't reach the server/);
  });
});

// -----------------------------------------------------------------------------
function Harness({ load, openWindow, doc }) {
  const viewer = useDocumentViewer(load, { openWindow });
  return (
    <div>
      <button type="button" onClick={() => viewer.open(doc)}>View</button>
      <button type="button" onClick={() => viewer.download(doc)}>Download now</button>
      {viewer.viewer}
    </div>
  );
}

describe("document viewer", () => {
  it("images open in a lightbox with a download option", async () => {
    const load = vi.fn().mockResolvedValue({ signedUrl: "https://s/img.jpg?t=1", contentType: "image/jpeg", fileName: "government_id-front.jpg" });
    render(<Harness load={load} openWindow={vi.fn()} doc={{ id: "d1", path: `${OWNER}/a.jpg`, label: "Government ID (front)" }} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "View" })); });
    expect(screen.getByRole("dialog", { name: "Government ID (front)" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Government ID (front)" })).toHaveAttribute("src", "https://s/img.jpg?t=1");
    expect(load).toHaveBeenCalledWith(expect.objectContaining({ id: "d1" }), false);

    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    load.mockResolvedValueOnce({ signedUrl: "https://s/img.jpg?download", fileName: "government_id-front.jpg" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Download" })); });
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ id: "d1" }), true);
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it("PDFs: the tab is opened inside the click, then pointed at the signed URL", async () => {
    let resolve;
    const load = vi.fn(() => new Promise((r) => { resolve = r; }));
    const win = { document: {}, location: {}, close: vi.fn() };
    const openWindow = vi.fn(() => win);
    render(<Harness load={load} openWindow={openWindow} doc={{ id: "d2", path: `${OWNER}/cert.pdf`, label: "Degree" }} />);
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(openWindow).toHaveBeenCalledWith("", "_blank");             // synchronously, before the request finishes
    expect(screen.getByRole("status")).toHaveTextContent("Opening the document");
    await act(async () => { resolve({ signedUrl: "https://s/cert.pdf?t=1", contentType: "application/pdf" }); });
    expect(win.location.href).toBe("https://s/cert.pdf?t=1");
    expect(win.opener).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a blocked tab falls back to a link", async () => {
    const load = vi.fn().mockResolvedValue({ signedUrl: "https://s/cert.pdf?t=1", contentType: "application/pdf" });
    render(<Harness load={load} openWindow={() => null} doc={{ id: "d2", path: `${OWNER}/cert.pdf`, label: "Degree" }} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "View" })); });
    expect(screen.getByRole("link", { name: "Open the PDF" })).toHaveAttribute("href", "https://s/cert.pdf?t=1");
  });

  it("shows the error and retries", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("You can't open this document."))
      .mockResolvedValue({ signedUrl: "https://s/a.png", contentType: "image/png" });
    const win = { document: {}, location: {}, close: vi.fn() };
    render(<Harness load={load} openWindow={() => win} doc={{ id: "d3", path: `${OWNER}/a.png`, label: "Selfie" }} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "View" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("You can't open this document.");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try again" })); });
    expect(screen.getByRole("img", { name: "Selfie" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
