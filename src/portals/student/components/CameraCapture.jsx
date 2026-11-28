import { useEffect, useRef, useState } from "react";
import { cameraErrorMessage } from "../utils/camera";

// In-page camera for "Take a photo" on computers (QA 22 Nov: on desktop
// browsers the file input's `capture` hint is ignored, so nothing looked like
// a camera). Phones keep their native camera through the file input.
// Takes one page at a time: Capture -> "Use this photo" / "Retake".
//   <CameraCapture onCapture={(file) => ...} onClose={...} />
export default function CameraCapture({ onCapture, onClose, mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : null }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");
  const [shot, setShot] = useState(null);   // {blob, url}
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const stream = await mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false });
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play?.().catch(() => {});
        }
        setReady(true);
      } catch (err) {
        if (alive) setError(cameraErrorMessage(err));
      }
    })();
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mediaDevices]);

  useEffect(() => () => { if (shot?.url) URL.revokeObjectURL(shot.url); }, [shot]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setError("Couldn't take the photo. Try again."); return; }
      setShot({ blob, url: URL.createObjectURL(blob) });
    }, "image/jpeg", 0.9);
  };
  const use = () => {
    const file = new File([shot.blob], `page-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-text/60" aria-hidden="true" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Take a photo of your answer sheet"
        className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-text/10 px-4 py-2.5">
          <p className="text-sm font-semibold text-text">Take a photo of one page</p>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-text/15 hover:bg-text/5">Close</button>
        </div>
        <div className="flex aspect-[4/3] items-center justify-center bg-black">
          {error ? <p role="alert" className="px-6 text-center text-sm text-white">{error}</p>
            : shot ? <img src={shot.url} alt="The photo you took" className="max-h-full max-w-full object-contain" />
            : <video ref={videoRef} autoPlay playsInline muted aria-label="Camera preview" className="max-h-full max-w-full" />}
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-4 py-3">
          {!error && !shot && (
            <button type="button" onClick={capture} disabled={!ready} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
              {ready ? "Capture" : "Starting camera…"}
            </button>
          )}
          {shot && (
            <>
              <button type="button" onClick={() => setShot(null)} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-text/15">Retake</button>
              <button type="button" onClick={use} className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-white">Use this photo</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
