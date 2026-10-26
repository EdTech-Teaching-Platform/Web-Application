import { IconAlert, IconCheck } from "./icons";

const STATE_TEXT = { done: "done", active: "in progress", failed: "failed", pending: "waiting" };

// Progress of a wizard save: the steps, then the error with Retry.
export default function SaveProgress({ title, steps, active, failed, error, running, onRetry, onDismiss }) {
  const hasError = failed >= 0;
  const stateOf = (i) => {
    if (hasError) return i === failed ? "failed" : "pending";
    if (i < active) return "done";
    return i === active && running ? "active" : "pending";
  };
  return (
    <div className={`ul-tsw-progress${hasError ? " is-error" : ""}`} role={hasError ? "alert" : "status"} aria-live="polite">
      <div className="ul-tsw-progress__head">
        <strong>{hasError ? `${title} failed` : running ? `${title}…` : `${title}: done`}</strong>
        {running && <span>Saving, validating and publishing run as one request. Nothing is kept unless every step succeeds.</span>}
      </div>
      <ol className="ul-tsw-progress__steps">
        {steps.map((label, i) => {
          const state = stateOf(i);
          return (
            <li key={label} className={`is-${state}`} aria-current={state === "active" ? "step" : undefined}>
              <span className="ul-tsw-progress__icon" aria-hidden="true">
                {state === "done" && <IconCheck size={11} />}
                {state === "failed" && <IconAlert size={11} />}
                {state === "active" && <span className="ul-tsw-progress__spin" />}
              </span>
              {label}
              <span className="ul-tsw-sr"> ({STATE_TEXT[state]})</span>
            </li>
          );
        })}
      </ol>
      {hasError && (
        <div className="ul-tsw-progress__error">
          <p>{error}</p>
          <div>
            <button type="button" className="ul-btn ul-btn--primary" onClick={onRetry}>Retry</button>
            <button type="button" className="ul-btn ul-btn--ghost" onClick={onDismiss}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
