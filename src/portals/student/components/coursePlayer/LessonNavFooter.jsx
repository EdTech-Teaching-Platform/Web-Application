import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import { ChevronLeftIcon, ChevronRightIcon, AwardIcon } from "../../../../components/ui/icons";

// Previous/Next lesson controls (spec Section 6). No backend currently
// enforces a "must complete before advancing" rule (there's no such gate
// anywhere else in this mock data layer, e.g. Checkout/Quiz), so Next is
// never disabled — per the explicit instruction "do not create fake
// restrictions if the backend does not currently enforce them." Instead,
// once the CURRENT lesson is completed, Next becomes the visually
// prominent (primary, wider) action so completing naturally leads forward;
// beforehand it's present but styled as a plain secondary action, with a
// short hint rather than a block.
export default function LessonNavFooter({ prevLesson, nextLesson, isCurrentCompleted, isCourseComplete, onNavigate }) {
  const navigate = useNavigate();

  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-text/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <Button
        fullWidth={false}
        variant="secondary"
        disabled={!prevLesson}
        onClick={() => prevLesson && onNavigate(prevLesson.id)}
        className="order-2 sm:order-1"
      >
        <ChevronLeftIcon className="h-4 w-4" /> Previous Lesson
      </Button>

      {isCourseComplete ? (
        <Button fullWidth={false} onClick={() => navigate("/student/certificates")} className="order-1 sm:order-2">
          <AwardIcon className="h-4 w-4" /> View Certificate
        </Button>
      ) : (
        <div className="order-1 flex flex-col items-end gap-1 sm:order-2">
          <Button
            fullWidth={false}
            variant={isCurrentCompleted ? "primary" : "secondary"}
            disabled={!nextLesson}
            onClick={() => nextLesson && onNavigate(nextLesson.id)}
          >
            Next Lesson <ChevronRightIcon className="h-4 w-4" />
          </Button>
          {!isCurrentCompleted && nextLesson && (
            <p className="text-xs text-text/40">Complete this lesson to track it as finished.</p>
          )}
        </div>
      )}
    </div>
  );
}
