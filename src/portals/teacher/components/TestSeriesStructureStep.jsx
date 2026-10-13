// Step 2 — Structure: named, collapsible sections containing tests.
// Drag-reorder uses the same native HTML5 pattern as CurriculumBuilder /
// ModuleCard (draggable + onDragStart/onDragOver(preventDefault)/onDrop with
// an array splice), with visible drop feedback. Question count per test is
// auto-calculated from its questions; Locked/Unlocked is a Switch per test.
import { useState } from "react";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import Switch from "../../../components/ui/Switch";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import { GripIcon, ChevronDownIcon, PlusIcon, TrashIcon, LockIcon, SparkleIcon, QuizIcon } from "../../../components/ui/icons";
import { TS_TEST_TYPES, TS_SECTION_SUGGESTIONS, newSection, newTest, quizPoints } from "../data/testSeriesData";

function reorder(list, from, to) {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function TestRow({ test, dragging, dragOver, dragProps, onChange, onDelete, onOpenQuestions }) {
  const qCount = test.questions.length;
  const titleEmpty = !test.title.trim();
  return (
    <div
      {...dragProps}
      className={`rounded-2xl bg-bg p-3 transition-all duration-150 ${dragging ? "opacity-40" : ""} ${dragOver ? "ring-2 ring-primary/40" : "ring-1 ring-text/[0.05]"}`}
    >
      <div className="flex items-start gap-2">
        <span className="mt-2.5 cursor-grab text-text/25 hover:text-text/50 active:cursor-grabbing" aria-hidden="true">
          <GripIcon />
        </span>
        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[1fr_9rem_6rem]">
          <Input
            aria-label="Test title"
            placeholder="Test title, e.g. Kinematics Skill Check"
            value={test.title}
            onChange={(e) => onChange({ title: e.target.value })}
            error={titleEmpty ? "Give this test a title." : undefined}
            shape="rect"
            className="!py-2"
          />
          <label className="block">
            <span className="sr-only">Test type</span>
            <Select
              wrapperClassName="block w-full"
              value={test.type}
              onChange={(e) => onChange({ type: e.target.value })}
              className="w-full rounded-2xl border border-text/12 bg-surface px-3 py-2 pr-9 text-sm text-text"
            >
              {TS_TEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </label>
          <Input
            aria-label="Duration in minutes"
            type="number"
            min={1}
            value={test.duration}
            onChange={(e) => onChange({ duration: e.target.value === "" ? "" : Number(e.target.value) })}
            error={!(Number(test.duration) > 0) ? "Minutes" : undefined}
            placeholder="min"
            shape="rect"
            className="!py-2"
          />
        </div>
        <button type="button" onClick={onDelete} aria-label="Delete test" className="mt-1.5 rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 pl-7">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${qCount ? "bg-primary/10 text-primary" : "bg-pastel-orange text-pastel-orange-ink"}`}>
          {qCount} question{qCount === 1 ? "" : "s"}
          {qCount > 0 && ` · ${quizPoints(test.questions)} pts`}
        </span>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <LockIcon className={`h-3.5 w-3.5 ${test.locked ? "text-primary" : "text-success"}`} />
          <span className="w-16">{test.locked ? "Locked" : "Unlocked"}</span>
          <Switch checked={test.locked} onChange={(v) => onChange({ locked: v })} />
        </div>
        <button
          type="button"
          onClick={onOpenQuestions}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:shadow-glow-primary"
        >
          <QuizIcon className="h-3.5 w-3.5" />
          Questions
        </button>
      </div>
      {!test.locked && <p className="mt-2 pl-7 text-[11px] text-muted">Unlocked tests are free for any student to try.</p>}
    </div>
  );
}

function SectionCard({ section, index, open, onToggle, onChange, onDelete, onDeleteTest, onOpenQuestions, dragState, sectionDragProps }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.title);
  const [dragTest, setDragTest] = useState(null);
  const [overTest, setOverTest] = useState(null);

  function commitTitle() {
    setEditing(false);
    onChange({ title: draft.trim() || section.title || `Section ${index + 1}` });
  }
  function updateTest(tid, patch) {
    onChange({ tests: section.tests.map((t) => (t.id === tid ? { ...t, ...patch } : t)) });
  }
  function dropTest() {
    if (dragTest !== null && overTest !== null && dragTest !== overTest) onChange({ tests: reorder(section.tests, dragTest, overTest) });
    setDragTest(null);
    setOverTest(null);
  }
  const qTotal = section.tests.reduce((s, t) => s + t.questions.length, 0);

  return (
    <div
      {...sectionDragProps}
      className={`rounded-3xl bg-surface shadow-soft ring-1 transition-all duration-200 ${dragState.dragging ? "opacity-40" : "ring-text/[0.06]"} ${dragState.over ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span
          onMouseDown={dragState.arm}
          onMouseUp={dragState.disarm}
          className="cursor-grab text-text/25 transition-colors hover:text-text/50 active:cursor-grabbing"
          aria-label="Drag to reorder section"
          title="Drag to reorder"
        >
          <GripIcon />
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === "Enter" && commitTitle()}
              className="w-full rounded-lg border border-primary/40 bg-bg px-2 py-1 text-sm font-semibold text-text outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(section.title);
                setEditing(true);
              }}
              className="truncate text-left text-sm font-semibold text-text hover:text-primary"
              title="Click to rename"
            >
              {section.title || "Untitled section"}
            </button>
          )}
          <p className="mt-0.5 text-xs text-muted">
            {section.tests.length} test{section.tests.length === 1 ? "" : "s"} · {qTotal} question{qTotal === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" onClick={onDelete} aria-label="Delete section" className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
          <TrashIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={onToggle} aria-label={open ? "Collapse section" : "Expand section"} aria-expanded={open} className="rounded-full p-1.5 text-muted hover:bg-bg">
          <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Smooth expand/collapse: animate grid row height 0fr -> 1fr */}
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-text/[0.06] px-3 pb-3.5 pt-3">
            {section.tests.length === 0 && (
              <p className="rounded-2xl border border-dashed border-text/20 bg-bg px-4 py-5 text-center text-sm text-muted">This section has no tests yet. Add your first one below.</p>
            )}
            <div className="flex flex-col gap-2.5">
              {section.tests.map((t, i) => (
                <TestRow
                  key={t.id}
                  test={t}
                  dragging={dragTest === i}
                  dragOver={overTest === i && dragTest !== null && dragTest !== i}
                  dragProps={{
                    draggable: true,
                    onDragStart: (e) => {
                      e.stopPropagation();
                      setDragTest(i);
                    },
                    onDragOver: (e) => {
                      if (dragTest === null) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setOverTest(i);
                    },
                    onDrop: (e) => {
                      if (dragTest === null) return;
                      e.stopPropagation();
                      dropTest();
                    },
                    onDragEnd: () => {
                      setDragTest(null);
                      setOverTest(null);
                    },
                  }}
                  onChange={(patch) => updateTest(t.id, patch)}
                  onDelete={() => onDeleteTest(t)}
                  onOpenQuestions={() => onOpenQuestions(t.id)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => onChange({ tests: [...section.tests, newTest()] })}
              className="mt-3 flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary/[0.06]"
            >
              <PlusIcon className="h-4 w-4" />
              Add test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TestSeriesStructureStep({ series, onChange, onOpenQuestions }) {
  const sections = series.sections;
  const [openIds, setOpenIds] = useState(() => new Set(sections.map((s) => s.id)));
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [armedIdx, setArmedIdx] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: "section"|"test", section, test? }
  const [customName, setCustomName] = useState("");

  function updateSection(id, patch) {
    onChange({ sections: sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }
  function addSection(title) {
    const s = newSection(title);
    onChange({ sections: [...sections, s] });
    setOpenIds((prev) => new Set(prev).add(s.id));
  }
  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function dropSection() {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) onChange({ sections: reorder(sections, dragIdx, overIdx) });
    setDragIdx(null);
    setOverIdx(null);
    setArmedIdx(null);
  }
  function doConfirm() {
    if (!confirm) return;
    if (confirm.kind === "section") onChange({ sections: sections.filter((s) => s.id !== confirm.section.id) });
    else updateSection(confirm.section.id, { tests: confirm.section.tests.filter((t) => t.id !== confirm.test.id) });
    setConfirm(null);
  }

  const unusedSuggestions = TS_SECTION_SUGGESTIONS.filter((n) => !sections.some((s) => s.title.trim().toLowerCase() === n.toLowerCase()));
  const customValid = customName.trim().length > 0 && !sections.some((s) => s.title.trim().toLowerCase() === customName.trim().toLowerCase());

  const addPanel = (
    <div className="rounded-3xl bg-surface p-5 shadow-soft sm:p-6">
      <h3 className="text-sm font-bold text-text">Add a section</h3>
      <p className="mt-0.5 text-xs text-muted">Sections group related tests, e.g. free skill tests vs. locked mock exams.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {unusedSuggestions.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => addSection(n)}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-surface px-4 py-1.5 text-xs font-semibold text-primary transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary/[0.05] hover:shadow-soft"
          >
            <PlusIcon className="h-3 w-3" />
            {n}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!customValid) return;
          addSection(customName.trim());
          setCustomName("");
        }}
      >
        <Input
          aria-label="Custom section name"
          containerClassName="flex-1"
          placeholder="Custom section name…"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          shape="rect"
          className="!py-2.5"
        />
        <Button type="submit" fullWidth={false} className="px-6" disabled={!customValid}>
          Add Section
        </Button>
      </form>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl bg-surface px-5 py-4 shadow-soft ring-1 ring-text/[0.06]">
        <Stat label="Sections" value={sections.length} />
        <Stat label="Tests" value={sections.reduce((s, x) => s + x.tests.length, 0)} />
        <Stat label="Questions" value={sections.reduce((s, x) => s + x.tests.reduce((n, t) => n + t.questions.length, 0), 0)} />
      </div>

      {sections.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl bg-surface px-8 py-14 text-center shadow-soft">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
            <SparkleIcon />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-text">Structure your series</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted">Start with a section below, then add tests inside it. Questions come next.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sections.map((s, i) => (
            <SectionCard
              key={s.id}
              section={s}
              index={i}
              open={openIds.has(s.id)}
              onToggle={() => toggle(s.id)}
              onChange={(patch) => updateSection(s.id, patch)}
              onDelete={() => setConfirm({ kind: "section", section: s })}
              onDeleteTest={(t) => setConfirm({ kind: "test", section: s, test: t })}
              onOpenQuestions={onOpenQuestions}
              dragState={{
                dragging: dragIdx === i,
                over: overIdx === i && dragIdx !== null && dragIdx !== i,
                arm: () => setArmedIdx(i),
                disarm: () => setArmedIdx(null),
              }}
              sectionDragProps={{
                draggable: armedIdx === i,
                onDragStart: () => setDragIdx(i),
                onDragOver: (e) => {
                  if (dragIdx === null) return;
                  e.preventDefault();
                  setOverIdx(i);
                },
                onDrop: dropSection,
                onDragEnd: () => {
                  setDragIdx(null);
                  setOverIdx(null);
                  setArmedIdx(null);
                },
              }}
            />
          ))}
        </div>
      )}

      {addPanel}

      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "section" ? "Delete section?" : "Delete test?"}
        footer={
          <>
            <Button fullWidth={false} className="!bg-danger px-6" onClick={doConfirm}>
              Delete
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {confirm?.kind === "section"
            ? `"${confirm.section.title || "Untitled section"}" and its ${confirm.section.tests.length} test(s), including every question inside them, will be removed.`
            : `"${confirm?.test?.title || "Untitled test"}" and its ${confirm?.test?.questions.length ?? 0} question(s) will be removed.`}
        </p>
      </Modal>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-lg font-bold text-text">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
