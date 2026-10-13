// Who is signed in as a Regional Head, and which region they may see.
// The region always comes from the LIVE head record (not the stored session),
// so reassigning or removing a head in Admin takes effect immediately.
import { useAuth } from "../../../hooks/useAuth";
import { useRegionalState } from "../../admin/data/regionalHeadsMock";
import { useRegionData } from "../../admin/data/regionalPortalMock";

export function useRegionHead() {
  const { user } = useAuth();
  const regional = useRegionalState();
  const head = user && user.role === "regionalhead"
    ? regional.heads.find((h) => h.id === user.headId && h.status === "active") || null
    : null;
  const region = head ? head.region : "";
  const data = useRegionData(region);
  return { user, head, region, data, authorized: !!head };
}
