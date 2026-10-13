import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import { ICON_TONES } from "../../../components/ui/IconBadge";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { useMessaging } from "../context/MessagingContext";
import { useMentorship } from "../context/MentorshipContext";
import { useTestSeries } from "../../../context/TestSeriesContext";
import { BellIcon, SendIcon, MobileIcon, CaptionsIcon, XIcon } from "../../../components/ui/icons";
import { buildCohorts, buildSeriesEnrolments, buildStudentPool, initials, typeMeta } from "../data/messagingData";

export const CHANNEL_ICONS = { inApp: BellIcon, email: SendIcon, push: MobileIcon, sms: CaptionsIcon };

// Everything an audience needs to resolve against: the shared student
// roster, cohorts derived from enrolment dates, test-series enrolment,
// mentorship programs and the educator's named groups.
export function useAudienceEnv() {
  const { courses } = useTeacherCourses();
  const { groups } = useMessaging();
  const { mentorships } = useMentorship();
  const { series, currentTeacher } = useTestSeries();

  const pool = useMemo(() => buildStudentPool(courses), [courses]);
  const cohorts = useMemo(() => buildCohorts(pool, courses), [pool, courses]);
  const seriesList = useMemo(() => {
    const mine = series.filter((s) => s.status !== "archived" && (!currentTeacher || s.teacherId === currentTeacher.id));
    return mine.map((s) => ({ id: s.id, title: s.title }));
  }, [series, currentTeacher]);
  const seriesEnrol = useMemo(() => buildSeriesEnrolments(seriesList, pool), [seriesList, pool]);

  return useMemo(
    () => ({ courses, pool, cohorts, seriesList, seriesEnrol, mentorships, groups }),
    [courses, pool, cohorts, seriesList, seriesEnrol, mentorships, groups]
  );
}

export function Avatar({ name, size = "sm" }) {
  const dim = size === "xs" ? "h-6 w-6 text-[9px]" : size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-[11px]";
  return <span className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ${dim}`}>{initials(name)}</span>;
}

export function TypePill({ type }) {
  const meta = typeMeta(type);
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${ICON_TONES[meta.tone]}`}>{meta.label}</span>;
}

export function ChannelIcons({ channels, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {Object.keys(CHANNEL_ICONS)
        .filter((k) => channels[k])
        .map((k) => {
          const Icon = CHANNEL_ICONS[k];
          return (
            <span key={k} title={k === "inApp" ? "In-app" : k[0].toUpperCase() + k.slice(1)} className="flex h-6 w-6 items-center justify-center rounded-full bg-text/[0.06] text-muted">
              <Icon className="h-3 w-3" />
            </span>
          );
        })}
    </span>
  );
}

export function AudienceChips({ labels, max = 3 }) {
  if (!labels.length) return <span className="text-xs text-muted">No audience</span>;
  const shown = labels.slice(0, max);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {shown.map((l, i) => (
        <span key={`${l}-${i}`} className="max-w-[180px] truncate rounded-full bg-primary/[0.07] px-2.5 py-1 text-[11px] font-semibold text-primary">
          {l}
        </span>
      ))}
      {labels.length > max && <span className="text-[11px] font-semibold text-muted">+{labels.length - max} more</span>}
    </span>
  );
}

// Confirm dialog: Modal shell + the shared ConfirmationCard states.
export function ConfirmDialog({ open, heading, message, confirmLabel, cancelLabel = "Keep it", state = "warning", onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="" size="sm">
      <ConfirmationCard
        state={state}
        heading={heading}
        message={message}
        primaryAction={<Button onClick={onConfirm}>{confirmLabel}</Button>}
        secondaryAction={
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
        }
      />
    </Modal>
  );
}

// Right-edge drawer (same shell/motion as StudentProfileSheet).
export function SideDrawer({ open, onClose, title, subtitle, children, footer }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return undefined;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className={`absolute inset-0 bg-text/50 transition-opacity duration-200 ease-out ${entered ? "opacity-100" : "opacity-0"}`} />
      <div className={`relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-l-3xl bg-bg shadow-elevated transition-transform duration-200 ease-out ${entered ? "translate-x-0" : "translate-x-4 opacity-0"}`}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-text/[0.07] bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-text">{title}</p>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-text">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-text/[0.07] bg-white px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

export function SectionCard({ title, hint, children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-white p-5 shadow-soft sm:p-6 ${className}`}>
      {(title || hint) && (
        <div className="mb-3">
          {title && <div className="eyebrow mb-1">{title}</div>}
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
