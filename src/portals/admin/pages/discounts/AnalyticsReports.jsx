// Analytics & Reports — the period summary first, then the filterable detailed reports.
import DiscountOverview from "./DiscountOverview";
import DiscountAnalytics from "./DiscountAnalytics";

export default function AnalyticsReports() {
  return (
    <div>
      <DiscountOverview />
      <DiscountAnalytics />
    </div>
  );
}
