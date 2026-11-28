// Which camera "Take a photo" uses, and readable camera errors (QA 22 Nov).
export function pickCameraMode(win = typeof window !== "undefined" ? window : null) {
  const coarse = Boolean(win?.matchMedia?.("(pointer: coarse)").matches);
  const media = Boolean(win?.navigator?.mediaDevices?.getUserMedia);
  if (coarse) return "native";          // phone / tablet: the OS camera via <input capture>
  if (media) return "inpage";           // computer with a webcam API: this component
  return "files";                       // neither: plain file picker
}

export function cameraErrorMessage(error) {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was blocked. Allow the camera in your browser's address bar, or use \"Choose PDF or photos\".";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device. Use \"Choose PDF or photos\".";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return "The camera couldn't start. Use \"Choose PDF or photos\" instead.";
}
