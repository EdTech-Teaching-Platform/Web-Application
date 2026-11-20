// /teacher/evaluate and /teacher/evaluate/:attemptId: marking students'
// written answers (typed or uploaded answer sheets) in this educator's test
// series (20261120090000). The shared screens live in components/grading.
import { useParams } from "react-router-dom";
import GradingQueue from "../../../components/grading/GradingQueue";
import GradingWorkspace from "../../../components/grading/GradingWorkspace";

export function EvaluateList() {
  return <GradingQueue basePath="/teacher/evaluate" />;
}

export function EvaluateAttempt() {
  const { attemptId } = useParams();
  return <GradingWorkspace key={attemptId} attemptId={attemptId} backTo="/teacher/evaluate" />;
}
