import { useEffect, useRef, useState } from "react";
import Button from "../../../../components/ui/Button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  MaximizeIcon,
  MinimizeIcon,
  DownloadIcon,
  CheckIcon,
  AlertTriangleIcon,
  RefreshIcon,
  FileTextIcon,
} from "../../../../components/ui/icons";
import { resourcePagesFor, resourceFileNameFor } from "./lessonContent";

const ZOOM_STEPS = [0.85, 1, 1.15, 1.3, 1.5];

// In-platform document viewer (spec Section 4) — page navigation, zoom,
// fullscreen, and a gated download, all without ever redirecting the
// student to an external PDF viewer. There's no real PDF asset/endpoint
// yet, so pages render as structured mock content (same "real UI, mock
// data source" approach as the rest of this build) — swap `resourcePagesFor`
// for actual page images/PDF.js once a resource-upload backend exists.
export default function ResourceLessonViewer({ lesson, moduleTitle, isCompleted, onMarkComplete, simulateError = false }) {
  const containerRef = useRef(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [errored, setErrored] = useState(simulateError);

  const pages = resourcePagesFor(lesson, moduleTitle);
  const fileName = resourceFileNameFor(lesson);
  const downloadable = lesson.downloadable !== false;

  useEffect(() => {
    setPageIndex(0);
    setErrored(simulateError);
  }, [lesson.id, simulateError]);

  useEffect(() => {
    function onFsChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function handleDownload() {
    const page = pages[pageIndex];
    const text = pages.map((p) => `${p.heading}\n\n${p.body}`).join("\n\n---\n\n");
    const blob = new Blob([`${lesson.title}\n\n${text}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.pdf$/, ".txt");
    a.click();
    URL.revokeObjectURL(url);
    void page;
  }

  if (errored) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-text/5 px-6 py-20 text-center">
        <AlertTriangleIcon className="h-8 w-8 text-danger" />
        <p className="font-display text-sm font-semibold text-text">Resource could not be loaded.</p>
        <button
          type="button"
          onClick={() => setErrored(false)}
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-primary/90"
        >
          <RefreshIcon className="h-4 w-4" /> Try Again
        </button>
      </div>
    );
  }

  const page = pages[pageIndex];

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 px-1">
        <FileTextIcon className="h-4 w-4 text-text/40" />
        <p className="truncate text-sm font-semibold text-text">{lesson.title}</p>
      </div>

      <div ref={containerRef} className="overflow-hidden rounded-2xl bg-text/5">
        <div className="flex min-h-[420px] items-center justify-center overflow-auto p-8">
          <div
            className="w-full max-w-lg rounded-xl bg-white p-8 shadow-sm transition-transform duration-150 ease-out"
            style={{ transform: `scale(${ZOOM_STEPS[zoomIndex]})` }}
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text/40">Page {page.page}</p>
            <h3 className="mb-3 font-display text-lg font-bold text-text">{page.heading}</h3>
            <p className="text-sm leading-relaxed text-text/70">{page.body}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-text/10 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
            disabled={pageIndex === 0}
            aria-label="Previous page"
            className="rounded-full p-1.5 text-text/60 transition-colors duration-150 hover:bg-text/5 disabled:opacity-30"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-text/60">
            Page {pageIndex + 1} of {pages.length}
          </span>
          <button
            type="button"
            onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
            disabled={pageIndex === pages.length - 1}
            aria-label="Next page"
            className="rounded-full p-1.5 text-text/60 transition-colors duration-150 hover:bg-text/5 disabled:opacity-30"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>

          <div className="mx-1 h-4 w-px bg-text/10" />

          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
            className="rounded-full p-1.5 text-text/60 transition-colors duration-150 hover:bg-text/5 disabled:opacity-30"
          >
            <ZoomOutIcon />
          </button>
          <span className="w-10 text-center text-xs text-text/50">{Math.round(ZOOM_STEPS[zoomIndex] * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            aria-label="Zoom in"
            className="rounded-full p-1.5 text-text/60 transition-colors duration-150 hover:bg-text/5 disabled:opacity-30"
          >
            <ZoomInIcon />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
            className="rounded-full p-1.5 text-text/60 transition-colors duration-150 hover:bg-text/5"
          >
            {fullscreen ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
          </button>

          {downloadable && (
            <button
              type="button"
              onClick={handleDownload}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary transition-colors duration-150 hover:bg-primary/5"
            >
              <DownloadIcon className="h-4 w-4" /> Download
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {isCompleted ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <CheckIcon className="h-4 w-4" /> Resource completed
          </p>
        ) : (
          <Button fullWidth={false} onClick={onMarkComplete}>
            Mark as Complete
          </Button>
        )}
      </div>
    </div>
  );
}
