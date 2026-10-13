import {
  VideoIcon,
  ArticleIcon,
  QuizIcon,
  AssignmentIcon,
  DownloadFileIcon,
  LiveSessionIcon,
  GripIcon,
  PencilIcon,
  DuplicateIcon,
  TrashIcon,
  EyeIcon,
  CheckIcon,
} from "../../../components/ui/icons";
import IconBadge from "../../../components/ui/IconBadge";

export const LESSON_TYPE_META = {
  video: { label: "Video", Icon: VideoIcon, tone: "blue" },
  article: { label: "Article", Icon: ArticleIcon, tone: "sage" },
  quiz: { label: "Quiz", Icon: QuizIcon, tone: "lavender" },
  assignment: { label: "Assignment", Icon: AssignmentIcon, tone: "orange" },
  resource: { label: "Resource", Icon: DownloadFileIcon, tone: "pink" },
  live: { label: "Live Session", Icon: LiveSessionIcon, tone: "maroon" },
};

// LessonRow — one row inside a module's lesson list. Drag handle + native
// HTML5 drag events are wired by the parent ModuleCard (which owns lesson
// order), this component only renders the row and its own quick actions so
// the drag/drop bookkeeping stays in one place.
export default function LessonRow({
  lesson,
  active,
  dragging,
  dragOver,
  onSelect,
  onDuplicate,
  onDelete,
  dragHandleProps,
}) {
  const meta = LESSON_TYPE_META[lesson.type];

  return (
    <div
      {...dragHandleProps}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150 ${
        active ? "bg-primary/[0.07] ring-1 ring-primary/25" : "hover:bg-bg"
      } ${dragging ? "opacity-40" : ""} ${dragOver ? "border-t-2 border-primary" : "border-t-2 border-transparent"}`}
    >
      <span className="cursor-grab text-text/25 transition-colors active:cursor-grabbing group-hover:text-text/45">
        <GripIcon />
      </span>

      <IconBadge tone={meta.tone} size="sm">
        <meta.Icon className="h-4 w-4" />
      </IconBadge>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-text">{lesson.title || "Untitled lesson"}</span>
          {lesson.preview && (
            <span className="shrink-0 rounded-full bg-rotation-3/20 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
              Preview
            </span>
          )}
        </div>
        <span className="text-xs text-muted">
          {meta.label}
          {lesson.duration ? ` · ${lesson.duration}` : ""}
        </span>
      </div>

      <span
        className={`hidden h-5 w-5 shrink-0 items-center justify-center rounded-full sm:flex ${
          lesson.hasContent ? "bg-success/15 text-success" : "bg-text/[0.06] text-text/25"
        }`}
        title={lesson.hasContent ? "Content added" : "No content yet"}
      >
        <CheckIcon className="h-3 w-3" />
      </span>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          aria-label="Preview lesson"
          className="rounded-full p-1.5 text-muted hover:bg-white hover:text-primary"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          aria-label="Edit lesson"
          className="rounded-full p-1.5 text-muted hover:bg-white hover:text-primary"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          aria-label="Duplicate lesson"
          className="rounded-full p-1.5 text-muted hover:bg-white hover:text-primary"
        >
          <DuplicateIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="Delete lesson"
          className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
