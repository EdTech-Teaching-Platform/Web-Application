import { useState } from "react";
import { ChevronDownIcon } from "./icons";

// Accordion — design.md Section 4: used for FAQ, Course Builder curriculum
// (Sections/Chapters/Lessons), and the Course Details Curriculum tab.
// Chevron rotates 180° on open (200ms ease-out); content expands via
// height + opacity (250ms).
//
// Items open independently (not single-expand) — FAQ reads fine with one
// open at a time, but Course Builder's curriculum needs multiple
// sections open simultaneously, and design.md doesn't call for forking a
// separate component for that case, so this defaults to "any number open"
// rather than assuming FAQ's narrower behavior for every consumer.
//
// `items`: [{ id, question, answer }] — `question`/`answer` names read
// naturally for FAQ; a curriculum consumer can pass the same shape with a
// section title as `question` and its lesson list as `answer`.
// Optional class props restyle it as separate cards (used by the redesigned
// Landing FAQ); defaults unchanged.
export default function Accordion({
  items,
  className = "divide-y divide-text/10",
  itemClassName = "",
  buttonClassName = "py-5",
  questionClassName = "font-display text-base font-semibold text-text",
  iconClassName = "text-text/50",
  answerClassName = "text-sm text-text/60",
}) {
  const [openIds, setOpenIds] = useState(() => new Set());

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={className}>
      {items.map((item) => {
        const open = openIds.has(item.id);
        return (
          <div key={item.id} className={itemClassName}>
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={open}
              className={`flex w-full items-center justify-between gap-4 text-left ${buttonClassName}`}
            >
              <span className={questionClassName}>
                {item.question}
              </span>
              <ChevronDownIcon
                className={`shrink-0 ${iconClassName} transition-transform duration-200 ease-out ${
                  open ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className="overflow-hidden transition-[max-height,opacity] duration-250 ease-out"
              style={{ maxHeight: open ? "480px" : "0px", opacity: open ? 1 : 0 }}
            >
              <p className={`pb-5 ${answerClassName}`}>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
