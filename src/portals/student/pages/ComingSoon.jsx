// Guard for student screens that have no backend yet (messages, bookings,
// certificates, notifications, …). Shows an honest "coming soon" instead of
// the old mock data. The list lives in docs/ADMIN_BACKEND_TODO.md.
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import { ClockIcon } from "../../../components/ui/icons";
import { PAGE } from "../components/PageState";

export default function ComingSoon({ title = "This page" }) {
  const navigate = useNavigate();
  return (
    <div className={PAGE}>
      <EmptyState
        icon={ClockIcon}
        heading={`${title} is coming soon`}
        message="We're still building this part of Universal Learning. Test series, reports and your history are ready now."
        action={<Button fullWidth={false} onClick={() => navigate("/student/dashboard")}>Go to dashboard</Button>}
      />
    </div>
  );
}
