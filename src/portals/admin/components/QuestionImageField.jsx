// Optional figure for a question: upload (asset-upload-url -> test-assets),
// preview, replace, remove, alt text. `value` is the stored path; the
// question RPCs save it (and imageAlt).
import ImageUploadField from "../../../components/common/ImageUploadField";
import { ASSET_KIND } from "../../../services/assetsApi";

export default function QuestionImageField({ value, onChange, alt, onAltChange, upload }) {
  return (
    <ImageUploadField kind={ASSET_KIND.QUESTION} value={value} onChange={onChange}
      altValue={alt} onAltChange={onAltChange} upload={upload} />
  );
}
