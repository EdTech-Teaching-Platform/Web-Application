/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("../src/services/supabaseClient", () => ({ supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() } } }));

import {
  ASSET_KIND, AssetUploadError, assetUrl, fitWithin, isUnsavedImage, prepareImage, storedAssetPath, uploadImage,
} from "../src/services/assetsApi";
import {
  AssetValidationError, MAX_ASSET_BYTES, buildAssetPath, publicAssetUrl, validateAssetRequest,
} from "../supabase/functions/asset-upload-url/validate.ts";
import AssetImage from "../src/components/common/AssetImage";
import ImageUploadField from "../src/components/common/ImageUploadField";
import SeriesBannerEditor from "../src/portals/admin/components/SeriesBannerEditor";
import { mapQuestion } from "../src/portals/admin/services/testSeriesApi";
import { questionPayload } from "../src/portals/admin/data/questionTypes";
import { cloneQuestion, emptyQuestion, emptyTest, initialWizardState, wizardRpcPayload } from "../src/portals/admin/data/testSeriesWizard";

const UID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const BANNER = `${UID}/banner/${ID}.webp`;
const FIGURE = `${UID}/question_image/${ID}.webp`;
const BASE = "https://proj.supabase.co";

afterEach(() => cleanup());

const file = (type = "image/png", size = 500_000, name = "diagram.png") => {
  const f = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};
// Fake browser pipeline: decode reports the picture size; encode returns a blob of a chosen size.
const pipeline = (width, height, outBytes = 120_000, outType = "image/webp") => ({
  decode: vi.fn(async () => ({ source: {}, width, height, close: vi.fn() })),
  encode: vi.fn(async () => {
    return new Blob([new Uint8Array(outBytes)], { type: outType });
  }),
});

// -----------------------------------------------------------------------------
describe("asset-upload-url validators", () => {
  it("accepts banners and question images (jpeg / png / webp) within their limits", () => {
    expect(validateAssetRequest({ kind: "banner", fileName: "c:\\pics\\cover.webp", contentType: "IMAGE/WEBP", size: 1000 }))
      .toEqual({ kind: "banner", fileName: "cover.webp", contentType: "image/webp", size: 1000 });
    expect(validateAssetRequest({ kind: "question_image", contentType: "image/jpeg", size: MAX_ASSET_BYTES.question_image }).kind).toBe("question_image");
  });

  it("refuses unknown kinds, other types, empty and oversized files", () => {
    const field = (body) => { try { validateAssetRequest(body); return null; } catch (e) { expect(e).toBeInstanceOf(AssetValidationError); return e.field; } };
    expect(field(null)).toBe("body");
    expect(field({ kind: "avatar", contentType: "image/png", size: 1 })).toBe("kind");
    expect(field({ kind: "banner", contentType: "image/gif", size: 1 })).toBe("contentType");
    expect(field({ kind: "banner", contentType: "image/svg+xml", size: 1 })).toBe("contentType");
    expect(field({ kind: "banner", contentType: "image/png", size: 0 })).toBe("size");
    expect(field({ kind: "banner", contentType: "image/png", size: 2 * 1024 * 1024 + 1 })).toBe("size");          // banner: 2 MB
    expect(field({ kind: "question_image", contentType: "image/png", size: 2 * 1024 * 1024 + 1 })).toBeNull();   // question: 3 MB
    expect(field({ kind: "question_image", contentType: "image/png", size: 3 * 1024 * 1024 + 1 })).toBe("size");
  });

  it("builds '<uid>/<kind>/<uuid>.<ext>' from the JWT user and the validated type", () => {
    const req = validateAssetRequest({ kind: "question_image", fileName: "../../evil.php", contentType: "image/png", size: 10 });
    expect(buildAssetPath(UID.toUpperCase(), req, ID)).toBe(`${UID}/question_image/${ID}.png`);
    expect(() => buildAssetPath("not-a-uuid", req, ID)).toThrow("Authentication required");
    expect(() => buildAssetPath(UID, req, "../x")).toThrow();
    expect(publicAssetUrl(`${BASE}/`, BANNER)).toBe(`${BASE}/storage/v1/object/public/test-assets/${BANNER}`);
  });
});

// -----------------------------------------------------------------------------
describe("assetUrl: the one place a stored path becomes a URL", () => {
  it("public URL for a stored path (with or without the bucket prefix)", () => {
    expect(assetUrl(BANNER, BASE)).toBe(`${BASE}/storage/v1/object/public/test-assets/${BANNER}`);
    expect(assetUrl(`test-assets/${BANNER}`, BASE)).toBe(`${BASE}/storage/v1/object/public/test-assets/${BANNER}`);
    expect(assetUrl(`/${FIGURE}`, BASE)).toBe(`${BASE}/storage/v1/object/public/test-assets/${FIGURE}`);
  });

  it("nothing for empty or unsafe values; full URLs and previews pass through", () => {
    expect(assetUrl(null, BASE)).toBeNull();
    expect(assetUrl("", BASE)).toBeNull();
    expect(assetUrl(`${UID}/../x.png`, BASE)).toBeNull();
    expect(assetUrl(BANNER, "")).toBeNull();
    expect(assetUrl("https://cdn.example.com/a.png", BASE)).toBe("https://cdn.example.com/a.png");
    expect(assetUrl("data:image/png;base64,AAAA", BASE)).toBe("data:image/png;base64,AAAA");
  });

  it("stored paths vs the old never-uploaded data URLs", () => {
    expect(storedAssetPath(`test-assets/${BANNER}`)).toBe(BANNER);
    expect(storedAssetPath("data:image/png;base64,AAAA")).toBeNull();
    expect(storedAssetPath(`${UID}/banner/${ID}.gif`)).toBeNull();
    expect(isUnsavedImage("data:image/png;base64,AAAA")).toBe(true);
    expect(isUnsavedImage("blob:http://x/1")).toBe(true);
    expect(isUnsavedImage(BANNER)).toBe(false);
  });
});

// -----------------------------------------------------------------------------
describe("upload helper", () => {
  it("fits within the max width, never upscales", () => {
    expect(fitWithin(4000, 2000, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(0, 10, 1200)).toEqual({ width: 0, height: 0 });
  });

  it("resizes banners to 1600 px and question images to 1200 px, ~0.85 quality WebP", async () => {
    const p = pipeline(4000, 3000);
    const banner = await prepareImage(ASSET_KIND.BANNER, file("image/jpeg", 6_000_000, "cover.jpg"), p);
    expect(p.encode).toHaveBeenCalledWith(expect.anything(), 1600, 1200, { keepAlpha: false });
    expect(banner).toMatchObject({ width: 1600, height: 1200 });
    expect(banner.file.name).toBe("cover.webp");
    expect(banner.file.type).toBe("image/webp");

    const q = pipeline(3000, 1500);
    await prepareImage(ASSET_KIND.QUESTION, file("image/png"), q);
    expect(q.encode).toHaveBeenCalledWith(expect.anything(), 1200, 600, { keepAlpha: true });
  });

  it("validation errors before anything is sent", async () => {
    const p = pipeline(100, 100);
    await expect(prepareImage(ASSET_KIND.BANNER, file("image/gif"), p)).rejects.toMatchObject({ stage: "check", message: "Use a JPG, PNG or WebP image." });
    await expect(prepareImage(ASSET_KIND.BANNER, file("image/png", 0), p)).rejects.toMatchObject({ stage: "check" });
    await expect(prepareImage(ASSET_KIND.BANNER, file("image/png", 25 * 1024 * 1024), p)).rejects.toThrow("larger than 20 MB");
    await expect(prepareImage(ASSET_KIND.BANNER, file(), pipeline(2000, 1000, 2.5 * 1024 * 1024))).rejects.toThrow("still larger than 2 MB");
    const broken = { decode: vi.fn().mockRejectedValue(new Error("bad")), encode: vi.fn() };
    await expect(prepareImage(ASSET_KIND.QUESTION, file(), broken)).rejects.toMatchObject({ stage: "resize" });
    expect(p.encode).not.toHaveBeenCalled();
  });

  it("success: asks asset-upload-url, PUTs the resized file with progress, returns the path", async () => {
    const invoke = vi.fn().mockResolvedValue({ path: FIGURE, signedUrl: "https://s/upload?token=t", token: "t", publicUrl: "https://s/public" });
    const put = vi.fn(async (_url, _file, { onProgress }) => { onProgress(50); onProgress(100); });
    const onProgress = vi.fn();
    const result = await uploadImage(ASSET_KIND.QUESTION, file(), { onProgress }, { ...pipeline(2400, 1200), invoke, put });
    expect(invoke).toHaveBeenCalledWith("asset-upload-url", { kind: "question_image", fileName: "diagram.webp", contentType: "image/webp", size: 120_000 });
    expect(put).toHaveBeenCalledWith("https://s/upload?token=t", expect.any(File), expect.objectContaining({ onProgress }));
    expect(onProgress).toHaveBeenLastCalledWith(100);
    expect(result).toMatchObject({ path: FIGURE, publicUrl: "https://s/public", width: 1200, height: 600 });
  });

  it("errors carry the stage and a readable message", async () => {
    const deps = pipeline(100, 100);
    const limited = vi.fn().mockRejectedValue(Object.assign(new Error("Too many uploads."), { status: 429 }));
    await expect(uploadImage(ASSET_KIND.BANNER, file(), {}, { ...deps, invoke: limited })).rejects.toMatchObject({ stage: "url", message: expect.stringMatching(/last hour/) });
    const refused = vi.fn().mockRejectedValue(Object.assign(new Error("x"), { status: 403 }));
    await expect(uploadImage(ASSET_KIND.BANNER, file(), {}, { ...deps, invoke: refused })).rejects.toThrow("verified educators");
    const badTicket = vi.fn().mockResolvedValue({ path: "../etc/passwd", signedUrl: "https://s" });
    await expect(uploadImage(ASSET_KIND.BANNER, file(), {}, { ...deps, invoke: badTicket })).rejects.toMatchObject({ stage: "url" });
    const ok = vi.fn().mockResolvedValue({ path: BANNER, signedUrl: "https://s/u" });
    const failingPut = vi.fn().mockRejectedValue(new Error("The upload failed. Check your connection and try again."));
    const err = await uploadImage(ASSET_KIND.BANNER, file(), {}, { ...deps, invoke: ok, put: failingPut }).catch((e) => e);
    expect(err).toBeInstanceOf(AssetUploadError);
    expect(err).toMatchObject({ stage: "upload", message: "The upload failed. Check your connection and try again." });
  });
});

// -----------------------------------------------------------------------------
describe("image field and display", () => {
  it("uploads, shows progress, then hands back the path; remove clears path and alt text", async () => {
    let finish;
    const upload = vi.fn((_kind, _file, { onProgress }) => new Promise((resolve) => { onProgress(40); finish = () => resolve({ path: FIGURE }); }));
    const onChange = vi.fn();
    const onAltChange = vi.fn();
    const { container, rerender } = render(<ImageUploadField kind={ASSET_KIND.QUESTION} value="" onChange={onChange} onAltChange={onAltChange} upload={upload} />);
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file()] } });
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "40");
    await act(async () => { finish(); });
    expect(upload).toHaveBeenCalledWith("question_image", expect.any(File), expect.any(Object));
    expect(onChange).toHaveBeenCalledWith(FIGURE);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    rerender(<ImageUploadField kind={ASSET_KIND.QUESTION} value={FIGURE} onChange={onChange} altValue="Triangle" onAltChange={onAltChange} upload={upload} />);
    expect(screen.getByRole("img", { name: "Triangle" })).toHaveAttribute("src", expect.stringContaining(`/storage/v1/object/public/test-assets/${FIGURE}`));
    fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: "Right triangle" } });
    expect(onAltChange).toHaveBeenCalledWith("Right triangle");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(onAltChange).toHaveBeenLastCalledWith("");
  });

  it("shows the upload error; warns about an old never-uploaded image", async () => {
    const upload = vi.fn().mockRejectedValue(new AssetUploadError("check", "Use a JPG, PNG or WebP image."));
    const { container, rerender } = render(<ImageUploadField kind={ASSET_KIND.BANNER} value="" onChange={vi.fn()} upload={upload} />);
    await act(async () => { fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file("image/gif")] } }); });
    expect(screen.getByRole("alert")).toHaveTextContent("Use a JPG, PNG or WebP image.");
    rerender(<ImageUploadField kind={ASSET_KIND.QUESTION} value="data:image/png;base64,AAAA" onChange={vi.fn()} upload={upload} />);
    expect(screen.getByRole("status")).toHaveTextContent("never uploaded");
  });

  it("a missing or broken image becomes a neutral fallback, never a broken icon", () => {
    const { rerender } = render(<AssetImage path="" alt="x" />);
    expect(screen.getByTestId("asset-fallback")).toBeInTheDocument();
    rerender(<AssetImage path={BANNER} alt="Banner" />);
    const img = screen.getByRole("img", { name: "Banner" });
    fireEvent.error(img);
    expect(screen.queryByRole("img", { name: "Banner" })).not.toBeInTheDocument();
    expect(screen.getByTestId("asset-fallback")).toBeInTheDocument();
    rerender(<AssetImage path={`${UID}/../x.png`} alt="x" fallback={<span>none</span>} />);
    expect(screen.getByText("none")).toBeInTheDocument();
  });

  it("series settings: a new banner and a removal are saved through update_test_series", async () => {
    const update = vi.fn().mockResolvedValue({});
    const onSaved = vi.fn();
    const upload = vi.fn().mockResolvedValue({ path: BANNER });
    const { container } = render(<SeriesBannerEditorHarness update={update} onSaved={onSaved} upload={upload} />);
    await act(async () => { fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file()] } }); });
    expect(update).toHaveBeenCalledWith("s1", { coverPath: BANNER });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Remove" })); });
    expect(update).toHaveBeenLastCalledWith("s1", { coverPath: "" });
    expect(onSaved).toHaveBeenCalledTimes(2);
  });
});

function SeriesBannerEditorHarness({ update, onSaved, upload }) {
  const [path, setPath] = React.useState("");
  return <SeriesBannerEditor series={{ id: "s1", cover_path: path }} update={async (id, p) => { await update(id, p); setPath(p.coverPath); }} onSaved={onSaved} upload={upload} />;
}

// -----------------------------------------------------------------------------
describe("payloads carry the paths", () => {
  it("question payload: stored path + alt text; an old data URL is dropped", () => {
    expect(questionPayload({ ...emptyQuestion(), text: "Q", image: FIGURE, imageAlt: "  Fig 1 " })).toMatchObject({ image: FIGURE, imageAlt: "Fig 1" });
    expect(questionPayload({ ...emptyQuestion(), text: "Q", image: "data:image/png;base64,AAAA", imageAlt: "x" })).toMatchObject({ image: "", imageAlt: "" });
    expect(questionPayload({ ...emptyQuestion(), text: "Q" })).toMatchObject({ image: "", imageAlt: "" });
  });

  it("question RPC rows map back to the editor fields", () => {
    expect(mapQuestion({ id: "q", type: "mcq_single", body: "Q", image_path: FIGURE, image_alt: "Fig", options: [] }))
      .toMatchObject({ image: FIGURE, imageAlt: "Fig" });
    expect(mapQuestion({ id: "q", type: "mcq_single", body: "Q", options: [] })).toMatchObject({ image: "", imageAlt: "" });
  });

  it("wizard save payload: coverPath and each question's image / imageAlt", () => {
    const st = {
      ...initialWizardState(), name: "Geometry", coverPath: BANNER, startMethod: "scratch",
      tests: [{ ...emptyTest("Unit 1"), questions: [
        { ...emptyQuestion(), text: "Largest angle?", optionA: "A", optionB: "B", correctAnswer: "B", correctAnswers: ["B"], image: FIGURE, imageAlt: "Triangle" },
        { ...emptyQuestion(), text: "No figure", optionA: "A", optionB: "B", correctAnswer: "A", correctAnswers: ["A"] },
      ] }],
    };
    const p = wizardRpcPayload(st, { existingSeries: [], nameTaken: false }, false);
    expect(p.coverPath).toBe(BANNER);
    expect(p.tests[0].questions[0]).toMatchObject({ image: FIGURE, imageAlt: "Triangle", position: 1 });
    expect(p.tests[0].questions[1]).toMatchObject({ image: "", imageAlt: "" });
    expect(p.wizardState.coverPath).toBe(BANNER);
    expect(wizardRpcPayload({ ...st, coverPath: "" }, {}, false).coverPath).toBe("");                         // removed
    expect(wizardRpcPayload({ ...st, coverPath: "data:image/png;base64,AA" }, {}, false).coverPath).toBe("");  // never uploaded
  });

  it("duplicating questions in the wizard keeps the figure and alt text", () => {
    const copy = cloneQuestion({ id: "q1", type: "mcq_single", text: "Q", image: FIGURE, imageAlt: "Fig", optionA: "a", optionB: "b", correctAnswer: "A" });
    expect(copy).toMatchObject({ image: FIGURE, imageAlt: "Fig" });
    expect(copy.id).toBeUndefined();
  });
});
