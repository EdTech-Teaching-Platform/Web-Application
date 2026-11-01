import { useCallback, useEffect, useRef, useState } from "react";

// Opens educator verification documents through a signed URL.
//   images -> a lightbox; PDFs -> a new tab; anything else -> a link.
// `load(doc, download)` returns {signedUrl, contentType, fileName, external}
// (sign-educator-document). The PDF tab is opened inside the click itself,
// then pointed at the signed URL: opening it only after the request (as the
// old "View" did) is blocked as a popup by most browsers. If the browser
// still blocks it, the viewer shows a link instead.
export const isPdfPath = (value) => /\.pdf($|\?)/i.test(String(value || ""));

export function useDocumentViewer(load, { openWindow = (...args) => window.open(...args) } = {}) {
  const [state, setState] = useState(null);   // {doc, status, url, kind, error, downloading, downloadError}
  const current = useRef(0);

  const open = useCallback((doc) => {
    const ticket = ++current.current;
    const expectPdf = isPdfPath(doc.path || doc.fileName);
    const win = expectPdf ? openWindow("", "_blank") : null;
    if (win) { try { win.opener = null; win.document.title = "Opening document…"; } catch { /* cross-origin later */ } }
    setState({ doc, status: "loading" });
    Promise.resolve(load(doc, false))
      .then((res) => {
        if (ticket !== current.current) return;
        const pdf = res?.contentType === "application/pdf" || expectPdf;
        const image = /^image\//.test(res?.contentType || "") && !pdf;
        if (pdf && win) {
          win.location.href = res.signedUrl;
          setState(null);
          return;
        }
        setState({ doc, status: "ready", url: res.signedUrl, kind: image ? "image" : pdf ? "pdf" : "file", fileName: res.fileName });
      })
      .catch((error) => {
        if (win) { try { win.close(); } catch { /* already closed */ } }
        if (ticket !== current.current) return;
        setState({ doc, status: "error", error: error?.message || "The document could not be opened." });
      });
  }, [load, openWindow]);

  const download = useCallback(async (doc) => {
    const target = doc || state?.doc;
    if (!target) return null;
    setState((s) => (s ? { ...s, downloading: true, downloadError: "" } : s));
    try {
      const res = await load(target, true);
      const a = document.createElement("a");
      a.href = res.signedUrl;
      a.download = res.fileName || "";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setState((s) => (s ? { ...s, downloading: false } : s));
      return null;
    } catch (error) {
      const message = error?.message || "The download failed.";
      setState((s) => (s ? { ...s, downloading: false, downloadError: message } : s));
      return message;
    }
  }, [load, state]);

  const close = useCallback(() => { current.current += 1; setState(null); }, []);
  const viewer = state ? <DocumentViewerDialog state={state} onClose={close} onRetry={() => open(state.doc)} onDownload={() => download()} /> : null;
  return { open, download, close, viewer, state };
}

export function DocumentViewerDialog({ state, onClose, onRetry, onDownload }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const label = state.doc.label || state.doc.fileName || "Document";
  const button = { borderRadius: 999, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "1px solid #d0d5dd", background: "#fff" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,17,21,0.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, padding: 16, width: "min(920px, 100%)", maxHeight: "92vh", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <strong style={{ fontSize: 15 }}>{label}</strong>
          <div style={{ display: "flex", gap: 8 }}>
            {state.status === "ready" && (
              <button type="button" style={button} onClick={onDownload} disabled={state.downloading} aria-busy={state.downloading}>
                {state.downloading ? "Preparing…" : "Download"}
              </button>
            )}
            <button ref={closeRef} type="button" style={button} onClick={onClose} aria-label="Close">Close</button>
          </div>
        </div>
        <div style={{ overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 160 }}>
          {state.status === "loading" && <p role="status">Opening the document…</p>}
          {state.status === "error" && (
            <div role="alert" style={{ textAlign: "center" }}>
              <p style={{ color: "#b3261e", marginBottom: 12 }}>{state.error}</p>
              <button type="button" style={button} onClick={onRetry}>Try again</button>
            </div>
          )}
          {state.status === "ready" && state.kind === "image" && (
            <img src={state.url} alt={label} style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 8 }} />
          )}
          {state.status === "ready" && state.kind !== "image" && (
            <p style={{ textAlign: "center" }}>
              {state.kind === "pdf" ? "Your browser blocked the new tab. " : ""}
              <a href={state.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, textDecoration: "underline" }}>
                {state.kind === "pdf" ? "Open the PDF" : "Open the file"}
              </a>
            </p>
          )}
        </div>
        {state.downloadError && <p role="alert" style={{ color: "#b3261e", fontSize: 13 }}>{state.downloadError}</p>}
        <p style={{ fontSize: 11, color: "#667085" }}>The link expires in 10 minutes. Every access is recorded.</p>
      </div>
    </div>
  );
}
