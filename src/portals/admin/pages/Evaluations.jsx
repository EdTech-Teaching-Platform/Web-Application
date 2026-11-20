// /admin/evaluations and /admin/evaluations/:attemptId: admins can mark the
// written answers of any test series (20261120090000). Same screens as the
// teacher portal (components/grading); admins also see the student's name.
import { useParams } from "react-router-dom";
import GradingQueue from "../../../components/grading/GradingQueue";
import GradingWorkspace from "../../../components/grading/GradingWorkspace";

export function EvaluationList() {
  return <GradingQueue basePath="/admin/evaluations" title="Evaluate written answers" />;
}

export function EvaluationAttempt() {
  const { attemptId } = useParams();
  return <GradingWorkspace key={attemptId} attemptId={attemptId} backTo="/admin/evaluations" />;
}
