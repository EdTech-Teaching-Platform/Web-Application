import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  PlayIcon,
  PauseIcon,
  VolumeIcon,
  VolumeMuteIcon,
  MaximizeIcon,
  MinimizeIcon,
  CheckIcon,
  AlertTriangleIcon,
  RefreshIcon,
} from "../../../../components/ui/icons";
import { formatSeconds, videoSrcFor, VIDEO_SOURCE_COUNT } from "./lessonContent";
import { VIDEO_COMPLETION_THRESHOLD } from "../../hooks/useCourseProgress";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

// In-platform video player (spec Section 3). Custom control bar over a
// plain <video> — no player library — so play/pause, seek, volume,
// speed, and fullscreen all read from real media state rather than being
// faked. Resumes from `state.positionSec`; reports watched% up to the
// caller on every timeupdate so useCourseProgress can grow
// maxWatchedPercent and flip the lesson to "completed" once it crosses
// VIDEO_COMPLETION_THRESHOLD — this component never decides completion
// itself, it just reports the playhead.
//
// Exposes `seekTo(seconds)` via ref so a Notes-tab timestamp or a
// Transcript-tab segment (siblings, not children, of this component) can
// jump playback without owning the <video> element themselves. Also
// reports live current/duration up via `onTimeUpdate` (separate from the
// throttled `onProgress`, which is for persistence) so the Transcript tab
// can highlight/auto-scroll the current segment.
const VideoLessonPlayer = forwardRef(function VideoLessonPlayer(
  { lesson, state, onProgress, onTimeUpdate, simulateError = false },
  ref
) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [errored, setErrored] = useState(simulateError);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const resumedRef = useRef(false);
  const lastReportRef = useRef(0);
  const lastTickRef = useRef(0);

  const isCompleted = state.status === "completed";
  const watchedPercent = Math.round(state.maxWatchedPercent);

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(0, Math.min(seconds, v.duration || seconds));
      if (v.paused) v.play();
    },
  }));

  useEffect(() => {
    setErrored(simulateError);
    setLoading(!simulateError);
    setSourceAttempt(0);
    resumedRef.current = false;
    lastTickRef.current = 0;
  }, [lesson.id, retryKey, simulateError]);

  useEffect(() => {
    function onFsChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function handleLoadedMetadata(e) {
    setDuration(e.target.duration || 0);
    setLoading(false);
    // Resume from the stored position, but clamp to the real asset's
    // duration since the mock clips are much shorter than the fictional
    // lesson-duration label shown in the nav list.
    if (!resumedRef.current) {
      resumedRef.current = true;
      const resumeAt = Math.min(state.positionSec || 0, Math.max(e.target.duration - 0.5, 0));
      if (resumeAt > 0) e.target.currentTime = resumeAt;
    }
  }

  function handleTimeUpdate(e) {
    const t = e.target.currentTime;
    const d = e.target.duration || duration;
    setCurrent(t);
    onTimeUpdate?.(t, d);

    if (d > 0) {
      // Throttle persisted-progress writes to ~1/sec (playback fires
      // timeupdate several times a second) — the UI still reads `current`
      // every tick for a smooth scrubber/transcript sync, only the
      // localStorage write and completion check are throttled.
      const now = performance.now();
      const elapsedMs = now - lastReportRef.current;
      if (elapsedMs < 900) return;
      // Real elapsed watch time since the last tick (not since the last
      // report), capped so a seek/jump can't inflate the learning-time stat.
      const deltaSeconds = lastTickRef.current ? Math.min((now - lastTickRef.current) / 1000, 2) : 0;
      lastTickRef.current = now;
      lastReportRef.current = now;
      const percent = Math.min(100, (t / d) * 100);
      onProgress({ positionSec: t, percent, deltaSeconds: playing ? deltaSeconds : 0 });
    }
  }

  function reportNow(e) {
    const t = e.target.currentTime;
    const d = e.target.duration || duration;
    if (d > 0) {
      lastReportRef.current = performance.now();
      onProgress({ positionSec: t, percent: Math.min(100, (t / d) * 100), deltaSeconds: 0 });
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }

  function seek(e) {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    v.currentTime = ratio * duration;
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function changeVolume(e) {
    const v = videoRef.current;
    const val = Number(e.target.value);
    setVolume(val);
    if (v) {
      v.volume = val;
      v.muted = val === 0;
      setMuted(val === 0);
    }
  }

  function changeSpeed(rate) {
    const v = videoRef.current;
    setSpeed(rate);
    if (v) v.playbackRate = rate;
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  function retry() {
    setErrored(false);
    setLoading(true);
    setSourceAttempt(0);
    setRetryKey((k) => k + 1);
  }

  if (errored) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-text px-6 text-center">
        <AlertTriangleIcon className="h-8 w-8 text-warning" />
        <p className="font-display text-sm font-semibold text-white">Video unavailable</p>
        <p className="max-w-xs text-xs text-white/60">We couldn't load this video. Check your connection and try again.</p>
        <button
          type="button"
          onClick={retry}
          className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-text transition-colors duration-150 hover:bg-white/90"
        >
          <RefreshIcon className="h-4 w-4" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-text">
      <div ref={containerRef} className="group relative aspect-video w-full bg-black">
        {loading && <div className="absolute inset-0 z-10 animate-pulse bg-text/70" aria-hidden="true" />}
        <video
          key={`${lesson.id}-${retryKey}-${sourceAttempt}`}
          ref={videoRef}
          src={videoSrcFor(lesson, sourceAttempt)}
          className="h-full w-full"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => {
            setPlaying(true);
            lastTickRef.current = performance.now();
          }}
          onPause={(e) => {
            setPlaying(false);
            reportNow(e);
          }}
          onEnded={(e) => reportNow(e)}
          onError={() => {
            setLoading(false);
            if (sourceAttempt + 1 < VIDEO_SOURCE_COUNT) {
              setSourceAttempt((attempt) => attempt + 1);
              setLoading(true);
            } else {
              setErrored(true);
            }
          }}
          onClick={togglePlay}
        />
        {!loading && !playing && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play"
            className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-150"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-text">
              <PlayIcon className="ml-1 h-7 w-7" />
            </span>
          </button>
        )}

        {/* Control bar */}
        <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
          <div onClick={seek} className="h-1.5 w-full cursor-pointer rounded-full bg-white/25">
            <div
              className="relative h-full rounded-full bg-primary"
              style={{ width: duration ? `${(current / duration) * 100}%` : "0%" }}
            >
              <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-white" />
            </div>
          </div>
          <div className="flex items-center gap-3 text-white">
            <button type="button" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
              {muted || volume === 0 ? <VolumeMuteIcon /> : <VolumeIcon />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={changeVolume}
              className="h-1 w-16 accent-white"
              aria-label="Volume"
            />
            <span className="text-xs tabular-nums text-white/80">
              {formatSeconds(current)} / {formatSeconds(duration)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <select
                value={speed}
                onChange={(e) => changeSpeed(Number(e.target.value))}
                aria-label="Playback speed"
                className="rounded-md bg-white/10 px-1.5 py-1 text-xs text-white outline-none"
              >
                {SPEEDS.map((s) => (
                  <option key={s} value={s} className="text-text">
                    {s}x
                  </option>
                ))}
              </select>
              <button type="button" onClick={toggleFullscreen} aria-label="Fullscreen">
                {fullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Watched% / completion threshold messaging — spec Section 3 */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {isCompleted ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <CheckIcon className="h-4 w-4" /> Lesson completed
          </p>
        ) : (
          <p className="text-xs text-white/60">
            Watched {watchedPercent}% <span className="text-white/35">·</span> Completion requirement: {VIDEO_COMPLETION_THRESHOLD}%
          </p>
        )}
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/15">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ease-out ${isCompleted ? "bg-success" : "bg-primary"}`}
            style={{ width: `${Math.min(watchedPercent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
});

export default VideoLessonPlayer;
