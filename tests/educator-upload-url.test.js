import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES, UploadValidationError, buildUploadPath, sanitizeFileName, validateUploadRequest,
} from "../supabase/functions/educator-upload-url/validate.ts";
import { downloadName, resolveDocLocation } from "../supabase/functions/sign-educator-document/paths.ts";

const USER = "0f8fad5b-d9cb-469f-a165-70867728950e";
const OTHER = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ok = { docType: "government_id", docName: "front", fileName: "id.jpg", contentType: "image/jpeg", size: 1024 };

function fieldOf(body) {
  try {
    validateUploadRequest(body);
  } catch (error) {
    expect(error).toBeInstanceOf(UploadValidationError);
    return error.field;
  }
  return null;
}

describe("educator-upload-url validators", () => {
  it("accepts the ID pictures, the selfie and certificates", () => {
    expect(validateUploadRequest(ok)).toEqual({ ...ok });
    expect(validateUploadRequest({ ...ok, docName: "BACK", contentType: "IMAGE/PNG" })).toMatchObject({ docName: "back", contentType: "image/png" });
    expect(validateUploadRequest({ ...ok, docType: "other", docName: "selfie", contentType: "image/webp" })).toMatchObject({ docType: "other" });
    expect(validateUploadRequest({ ...ok, docType: "degree_certificate", docName: "bsc-physics", contentType: "application/pdf" }))
      .toMatchObject({ docType: "degree_certificate", docName: "bsc-physics" });
  });

  it("refuses types and names outside the allow-list", () => {
    expect(fieldOf({ ...ok, docType: "passport" })).toBe("docType");
    expect(fieldOf({ ...ok, docName: "side" })).toBe("docName");
    expect(fieldOf({ ...ok, docType: "other", docName: "photo" })).toBe("docName");
    expect(fieldOf({ ...ok, docType: "teaching_license", docName: "../../etc" })).toBe("docName");
    expect(fieldOf({ ...ok, docType: "teaching_license", docName: "x".repeat(41) })).toBe("docName");
    expect(fieldOf(null)).toBe("body");
  });

  it("allows PDFs for certificates only, and images up to 5 MB", () => {
    expect(fieldOf({ ...ok, contentType: "application/pdf" })).toBe("contentType");
    expect(fieldOf({ ...ok, contentType: "image/gif" })).toBe("contentType");
    expect(fieldOf({ ...ok, contentType: "text/html" })).toBe("contentType");
    expect(fieldOf({ ...ok, size: MAX_UPLOAD_BYTES + 1 })).toBe("size");
    expect(fieldOf({ ...ok, size: 0 })).toBe("size");
    expect(fieldOf({ ...ok, size: "lots" })).toBe("size");
    expect(validateUploadRequest({ ...ok, size: MAX_UPLOAD_BYTES }).size).toBe(MAX_UPLOAD_BYTES);
  });

  it("sanitizes file names", () => {
    expect(sanitizeFileName("My ID (front).JPG")).toBe("My-ID-front.JPG");
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\me\\scan_01.png")).toBe("scan-01.png");
    expect(sanitizeFileName(".hidden")).toBe("hidden");
    expect(sanitizeFileName("<script>")).toBe("script");
    expect(sanitizeFileName("")).toBe("file");
    expect(sanitizeFileName("a".repeat(300))).toHaveLength(100);
  });

  it("builds the path from the JWT user id and the validated content type", () => {
    const req = validateUploadRequest({ ...ok, fileName: "evil.php", userId: OTHER });
    expect(buildUploadPath(USER, req, 1730100000123)).toBe(`${USER}/government_id-front-1730100000123.jpg`);
    const pdf = validateUploadRequest({ ...ok, docType: "experience_letter", docName: "school-2020", contentType: "application/pdf" });
    expect(buildUploadPath(USER, pdf, 1)).toBe(`${USER}/experience_letter-school-2020-1.pdf`);
    expect(() => buildUploadPath("not-a-user", req, 1)).toThrow("Authentication required");
    // the path matches what educator_register_document accepts
    expect(buildUploadPath(USER, req, 1)).toMatch(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,200}$/);
  });
});

describe("sign-educator-document paths", () => {
  it("signs the new '<user>/<file>' paths only in the owner's folder", () => {
    expect(resolveDocLocation(`${USER}/government_id-front-1.jpg`, USER, "educator-verification-docs"))
      .toEqual({ kind: "storage", bucket: "educator-verification-docs", path: `${USER}/government_id-front-1.jpg` });
    expect(resolveDocLocation(`educator-verification-docs/${USER}/x.pdf`, USER, "educator-verification-docs").path).toBe(`${USER}/x.pdf`);
    expect(() => resolveDocLocation(`${OTHER}/government_id-front-1.jpg`, USER, "educator-verification-docs")).toThrow("Document not found");
    expect(() => resolveDocLocation(`${USER}/../${OTHER}/x.jpg`, USER, "b")).toThrow("Document not found");
  });

  it("keeps the older forms working", () => {
    expect(resolveDocLocation("legacy/scan.pdf", USER, "docs")).toEqual({ kind: "storage", bucket: "docs", path: "legacy/scan.pdf" });
    expect(resolveDocLocation("https://x.supabase.co/storage/v1/object/public/other-bucket/a%20b.pdf", USER, "docs"))
      .toEqual({ kind: "storage", bucket: "other-bucket", path: "a b.pdf" });
    expect(resolveDocLocation("https://drive.example.com/file", USER, "docs")).toEqual({ kind: "external", url: "https://drive.example.com/file" });
    expect(() => resolveDocLocation("legacy/scan.pdf", USER, undefined)).toThrow("EDUCATOR_DOCS_BUCKET");
  });

  it("names downloads after the document", () => {
    expect(downloadName("government_id", "front", `${USER}/government_id-front-1.JPG`)).toBe("government_id-front.jpg");
    expect(downloadName("degree_certificate", "BSc degree", "x/y.pdf")).toBe("degree_certificate-BSc-degree.pdf");
  });
});
