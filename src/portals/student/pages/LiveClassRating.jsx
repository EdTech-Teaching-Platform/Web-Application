import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { CheckIcon, StarIcon } from "../../../components/ui/icons";
import { ATTENDANCE_SESSIONS, getStoredRatings, saveRating } from "../data/sessionMock";

export default function LiveClassRating() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") || "l1";
  const session = ATTENDANCE_SESSIONS.find((item) => item.sessionId === sessionId) || ATTENDANCE_SESSIONS[0];
  const existing = getStoredRatings()[session.sessionId];
  const [rating, setRating] = useState(existing?.rating || 0);
  const [feedback, setFeedback] = useState(existing?.feedback || "");
  const [submitted, setSubmitted] = useState(Boolean(existing));

  function submitRating() {
    if (!rating) return;
    saveRating({ sessionId: session.sessionId, rating, feedback: feedback.trim() });
    setSubmitted(true);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <div className="rounded-3xl bg-white p-7 text-center sm:p-10">
        {submitted ? (
          <>
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success"><CheckIcon /></span>
            <h1 className="mt-5 font-display text-2xl font-bold text-text">Thank you for your feedback</h1>
            <p className="mt-2 text-sm text-text/60">Your rating for {session.topic} has been saved.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button variant="secondary" onClick={() => navigate("/student/recordings")}>View recordings</Button><Button onClick={() => navigate("/student/dashboard")}>Back to dashboard</Button></div>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Session completed</p>
            <h1 className="mt-3 font-display text-2xl font-bold text-text">How was your class?</h1>
            <p className="mt-2 text-sm text-text/60">{session.topic} · {session.educator}</p>
            <div className="mt-7 flex justify-center gap-2" aria-label="Choose a rating">
              {[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} aria-label={`${value} stars`} onClick={() => setRating(value)} className={`rounded-full p-2 transition-transform hover:scale-110 ${value <= rating ? "text-primary" : "text-text/20"}`}><StarIcon className="h-9 w-9 fill-current" /></button>)}
            </div>
            <p className="mt-2 text-sm text-text/55">{rating ? `${rating} out of 5 stars` : "Select a rating"}</p>
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} className="mt-7 min-h-32 w-full rounded-2xl bg-text/5 p-4 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Optional feedback about this session" />
            <Button className="mt-5" disabled={!rating} onClick={submitRating}>Submit feedback</Button>
            <button type="button" onClick={() => navigate("/student/dashboard")} className="mt-4 text-sm text-text/50 hover:text-text">Skip for now</button>
          </>
        )}
      </div>
    </div>
  );
}
