// Series settings: the banner (preview, replace, remove), saved at once
// through update_test_series({coverPath}). Shared by the admin and teacher
// portals (TestSeriesDetail); the RPC checks who may edit the series.
import { useState } from "react";
import ImageUploadField from "../../../components/common/ImageUploadField";
import { ASSET_KIND } from "../../../services/assetsApi";
import { testSeriesApi } from "../services/testSeriesApi";

export default function SeriesBannerEditor({ series, onSaved, setToast, update = testSeriesApi.updateSeries, upload }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (coverPath) => {
    setSaving(true);
    setError("");
    try {
      await update(series.id, { coverPath });
      setToast?.(coverPath ? "Banner saved." : "Banner removed.");
      onSaved?.();
    } catch (err) {
      setError(err?.message || "The banner could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="ul-ts-form" style={{ marginBottom: 16 }}>
      <ImageUploadField kind={ASSET_KIND.BANNER} label="Banner image" value={series.cover_path || ""} onChange={save} disabled={saving}
        {...(upload ? { upload } : {})} />
      {error && <span className="ul-tsw-hint" role="alert" style={{ color: "#b3261e" }}>{error}</span>}
    </div>
  );
}
