import StatusBadge from "../../../components/ui/StatusBadge";

const STATUS_STYLES = {
  "Pending Payment": "warning",
  Confirmed: "success",
  Rescheduled: "success",
  Cancelled: "danger",
  Completed: "neutral",
  "Refund Processing": "warning",
};

export default function BookingStatus({ children }) {
  return <StatusBadge status={STATUS_STYLES[children] || "neutral"}>{children}</StatusBadge>;
}
