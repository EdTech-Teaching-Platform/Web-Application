import { useRef, useState } from "react";
import Input from "../../../components/ui/Input";
import Checkbox from "../../../components/ui/Checkbox";
import ChipInput from "../../../components/ui/ChipInput";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import Select from "../../../components/ui/Select";
import FileDropzone from "../../../components/ui/FileDropzone";
import {
  CheckIcon,
  ClockIcon,
  XIcon,
  UploadIcon,
  VideoIcon,
  CertificateIcon,
  PencilIcon,
} from "../../../components/ui/icons";

const CATEGORIES = {
  Design: ["UI/UX Design", "Graphic Design", "Product Design"],
  Development: ["Web Development", "Mobile Development", "Data Science"],
  Business: ["Marketing", "Product Management", "Entrepreneurship"],
};
const LANGUAGES = ["English", "Hindi", "Spanish", "French", "Mandarin"];

function titleGuidance(len) {
  if (len === 0) return { tone: "idle", message: "Great titles are 40–60 characters and lead with the outcome." };
  if (len < 20) return { tone: "warning", message: "A little short — consider naming the concrete skill or outcome." };
  if (len <= 60) return { tone: "success", message: "Good length." };
  return { tone: "warning", message: "Getting long — titles over ~60 characters get cut off in course cards." };
}

const TONE_STYLES = {
  success: { color: "text-success", Icon: CheckIcon },
  warning: { color: "text-warning", Icon: ClockIcon },
  error: { color: "text-danger", Icon: XIcon },
  idle: null,
};

function FieldHint({ tone, message }) {
  const style = TONE_STYLES[tone];
  return (
    <span className={`mt-1.5 flex items-center gap-1.5 text-xs ${style ? style.color : "text-muted"}`}>
      {style?.Icon && <style.Icon className="h-3.5 w-3.5 shrink-0" />}
      {message}
    </span>
  );
}

function SectionCard({ eyebrow, title, description, children }) {
  return (
    <section className="rounded-3xl bg-white p-6 sm:p-7 shadow-soft">
      <div className="mb-6">
        {eyebrow && <span className="text-xs font-semibold uppercase tracking-wide text-primary/70">{eyebrow}</span>}
        <h2 className="mt-1 text-lg font-bold text-text">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default function CourseDetailsForm({ course, onChange }) {
  const thumbInputRef = useRef(null);
  const [thumbPreview, setThumbPreview] = useState(null);
  const guidance = titleGuidance(course.title.length);

  function set(patch) {
    onChange({ ...course, ...patch });
  }

  function handleThumbSelect(file) {
    set({ thumbnail: file });
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setThumbPreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setThumbPreview(null);
    }
  }

  const subCategories = CATEGORIES[course.category] || [];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Course Identity */}
      <SectionCard eyebrow="Step 1" title="Course Identity" description="The title and cover are what students see first — in search, in cards, everywhere.">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-medium text-text">Course title</span>
                <span className={`text-xs font-medium ${guidance.tone === "warning" ? "text-warning" : "text-muted"}`}>
                  {course.title.length}/80
                </span>
              </div>
              <input
                value={course.title}
                maxLength={80}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="e.g. Advanced UI Principles & Color Theory"
                className="w-full rounded-2xl border border-text/15 bg-bg px-4 py-3.5 text-lg font-semibold text-text outline-none transition-colors duration-150 placeholder:font-normal placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <FieldHint tone={guidance.tone} message={guidance.message} />
            </div>

            <Input
              label="Subtitle / tagline"
              value={course.subtitle}
              onChange={(e) => set({ subtitle: e.target.value })}
              placeholder="A one-line hook — what makes this course worth it"
              shape="rect"
            />

            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">Promo video (optional)</span>
              <FileDropzone
                label="Upload a promo video"
                hint="MP4 or MOV, up to 2GB"
                file={course.promoVideoFile}
                onFileSelect={(file) =>
                  set({
                    promoVideoFile: file,
                    promoVideoProcessing: file ? "processing" : "ready",
                  })
                }
              />
              {course.promoVideoFile && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-bg px-3.5 py-2.5">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <VideoIcon className="h-3.5 w-3.5 text-muted" />
                    {course.promoVideoFile.name}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      course.promoVideoProcessing === "processing" ? "bg-warning/12 text-warning" : "bg-success/12 text-success"
                    }`}
                  >
                    {course.promoVideoProcessing === "processing" ? "Processing…" : "Ready"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Live preview + thumbnail */}
          <div className="flex flex-col gap-4">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">Cover image</span>
              {thumbPreview ? (
                <div className="group relative overflow-hidden rounded-2xl ring-1 ring-text/[0.08]">
                  <img src={thumbPreview} alt="Course cover preview" className="h-36 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleThumbSelect(null)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-text/60 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    aria-label="Remove cover image"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-text/25 bg-gradient-to-br from-rotation-1/15 via-rotation-2/10 to-rotation-3/15 text-muted transition-colors duration-150 hover:border-primary hover:text-primary"
                >
                  <UploadIcon />
                  <span className="text-xs font-medium">Drag &amp; drop or click to upload</span>
                  <span className="text-[11px] text-muted">Recommended 1280×720px (16:9)</span>
                </button>
              )}
              <input
                ref={thumbInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleThumbSelect(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Live card preview */}
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Card preview</span>
              <div className="overflow-hidden rounded-2xl bg-bg ring-1 ring-text/[0.06]">
                <div className="h-20 bg-gradient-to-br from-rotation-1/35 to-rotation-2/25" />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-text">
                    {course.title || "Your course title will appear here"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">{course.subtitle || "Subtitle preview"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 2. Classification */}
      <SectionCard eyebrow="Step 2" title="Classification" description="Helps students find this course through search and browse.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Category</span>
            <Select
              wrapperClassName="block w-full"
              value={course.category}
              onChange={(e) => set({ category: e.target.value, subCategory: "" })}
              className="w-full rounded-full border border-text/15 bg-bg px-4 py-3 pr-10 text-sm text-text outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Select a category</option>
              {Object.keys(CATEGORIES).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Sub-category</span>
            <Select
              wrapperClassName="block w-full"
              value={course.subCategory}
              disabled={!course.category}
              onChange={(e) => set({ subCategory: e.target.value })}
              className="w-full rounded-full border border-text/15 bg-bg px-4 py-3 pr-10 text-sm text-text outline-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">{course.category ? "Select a sub-category" : "Pick a category first"}</option>
              {subCategories.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Difficulty level</span>
            <SegmentedControl
              options={["Beginner", "Intermediate", "Advanced"]}
              value={course.level}
              onChange={(v) => set({ level: v })}
            />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Language of instruction</span>
            <Select
              wrapperClassName="block w-full"
              value={course.language}
              onChange={(e) => set({ language: e.target.value })}
              className="w-full rounded-full border border-text/15 bg-bg px-4 py-3 pr-10 text-sm text-text outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <ChipInput
              label="Tags / keywords"
              helperText="Add up to 10 — think of what a student would type into search."
              values={course.tags}
              onChange={(tags) => set({ tags })}
              placeholder="e.g. figma, design-systems, color-theory"
              max={10}
            />
          </div>
        </div>
      </SectionCard>

      {/* 3. Description */}
      <SectionCard eyebrow="Step 3" title="Description" description="Sell the transformation, not just the topic list.">
        <div className="flex flex-col gap-6">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Full description</span>
            <RichTextEditor value={course.description} onChange={(html) => set({ description: html })} />
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <span className="mb-2 block text-sm font-medium text-text">What you'll learn</span>
              <OutcomeList
                items={course.outcomes}
                onAdd={() => set({ outcomes: [...course.outcomes, ""] })}
                onRemove={(i) => set({ outcomes: course.outcomes.filter((_, idx) => idx !== i) })}
                onChange={(i, text) => set({ outcomes: course.outcomes.map((o, idx) => (idx === i ? text : o)) })}
                placeholder="e.g. Build a full color system from scratch"
                addLabel="Add outcome"
              />
            </div>
            <div>
              <span className="mb-2 block text-sm font-medium text-text">Requirements</span>
              <OutcomeList
                items={course.requirements}
                onAdd={() => set({ requirements: [...course.requirements, ""] })}
                onRemove={(i) => set({ requirements: course.requirements.filter((_, idx) => idx !== i) })}
                onChange={(i, text) => set({ requirements: course.requirements.map((o, idx) => (idx === i ? text : o)) })}
                placeholder="e.g. A free Figma account"
                addLabel="Add requirement"
              />
            </div>
            <div>
              <span className="mb-2 block text-sm font-medium text-text">Who this course is for</span>
              <OutcomeList
                items={course.audience}
                onAdd={() => set({ audience: [...course.audience, ""] })}
                onRemove={(i) => set({ audience: course.audience.filter((_, idx) => idx !== i) })}
                onChange={(i, text) => set({ audience: course.audience.map((o, idx) => (idx === i ? text : o)) })}
                placeholder="e.g. Junior designers moving into product"
                addLabel="Add audience"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 4. Instructor & Trust Signals */}
      <SectionCard eyebrow="Step 4" title="Instructor & Trust Signals">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-2xl bg-bg p-4 ring-1 ring-text/[0.06]">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {(course.instructor?.name || "")
                .split(" ")
                .map((p2) => p2[0])
                .join("")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{course.instructor?.name}</p>
              <p className="truncate text-xs text-muted">{course.instructor?.headline}</p>
            </div>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Edit profile
            </button>
          </div>

          <div className="flex flex-col justify-center gap-4">
            <Input
              label="Estimated total duration"
              value={course.durationOverride}
              onChange={(e) => set({ durationOverride: e.target.value })}
              placeholder="Auto-calculated once curriculum is built"
              shape="rect"
              helperText="You can override this once your curriculum is set."
            />

            <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-text/10 bg-bg px-4 py-3.5">
              <span className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 ${
                    course.certificate ? "bg-primary text-white scale-105" : "bg-text/10 text-muted"
                  }`}
                >
                  <CertificateIcon className="h-4.5 w-4.5" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-text">Certificate of completion</span>
                  <span className="block text-xs text-muted">Issued automatically when a student finishes</span>
                </span>
              </span>
              <Checkbox checked={course.certificate} onChange={(e) => set({ certificate: e.target.checked })} />
            </label>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function OutcomeList({ items, onAdd, onRemove, onChange, placeholder, addLabel }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
          <input
            value={item}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={i === 0 ? placeholder : ""}
            className="w-full rounded-xl border border-text/15 bg-bg px-3 py-2 text-sm text-text outline-none transition-colors duration-150 placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove"
            className="shrink-0 text-muted transition-colors duration-150 hover:text-danger"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={onAdd} className="mt-1 self-start text-xs font-semibold text-primary hover:underline">
        + {addLabel}
      </button>
    </div>
  );
}
