// Discount Management — one page, seven internal sections.
// The active section lives in the URL (?tab=…) so it survives a refresh and
// notification links can open a specific section; nothing here is a sidebar route.
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { IconPlus } from "../../components/icons";
import { DISCOUNT_TABS, DiscountNavProvider, parseDiscountPath, useActor, Tabs } from "./DiscountsShared";
import ManageDiscounts from "./ManageDiscounts";
import CreateDiscount from "./CreateDiscount";
import AnalyticsReports from "./AnalyticsReports";
import DiscountHistory from "./DiscountHistory";

const SECTIONS = {
  manage: ManageDiscounts, create: CreateDiscount,
  analytics: AnalyticsReports, history: DiscountHistory,
};

export default function DiscountManagement() {
  const [params, setParams] = useSearchParams();
  const actor = useActor();
  const requested = params.get("tab");
  const tab = SECTIONS[requested] ? requested : "manage";

  const navigate = useCallback((path) => {
    const { tab: t, params: extra } = parseDiscountPath(path);
    setParams(new URLSearchParams({ tab: t, ...extra }));
    window.scrollTo?.({ top: 0 });
  }, [setParams]);
  const ctx = useMemo(() => ({ navigate, params, setParams }), [navigate, params, setParams]);

  const Section = SECTIONS[tab];
  // remount a section when its identity changes (e.g. editing a different coupon)
  const sectionKey = `${tab}:${params.get("edit") || ""}:${params.get("status") || ""}`;

  return (
    <DiscountNavProvider value={ctx}>
      <div>
        {tab === "create" ? (
          <div className="ul-edu-header">
            <div>
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => navigate("/admin/discounts")}>← Back to Discount Management</button>
            </div>
          </div>
        ) : (
          <>
            <div className="ul-edu-header">
              <div>
                <h2 className="ul-edu-header__title">Discount Management</h2>
                <p className="ul-edu-header__subtitle">Create offers, hand out coupons, and see what they earn.</p>
              </div>
              <div className="ul-rh-header-actions">
                {actor.can("create") && (
                  <button type="button" className="ul-btn ul-btn--primary ul-edu-add-btn" onClick={() => navigate("/admin/discounts/create")}>
                    <IconPlus size={13} /><span>Create discount</span>
                  </button>
                )}
              </div>
            </div>

            <div className="ul-dsc-tabs">
              <Tabs value={tab} onChange={(k) => navigate(k === "manage" ? "/admin/discounts" : `/admin/discounts/${k}`)} tabs={DISCOUNT_TABS.filter((t) => t.key !== "create")} />
            </div>
          </>
        )}

        <Section key={sectionKey} />
      </div>
    </DiscountNavProvider>
  );
}
