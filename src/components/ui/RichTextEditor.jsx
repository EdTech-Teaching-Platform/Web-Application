import { useRef } from "react";
import { BoldIcon, ItalicIcon, ListBulletIcon, HeadingIcon, LinkIcon } from "./icons";

// RichTextEditor — a lightweight contentEditable editor with a fixed
// toolbar (bold/italic/heading/list/link). Not a portal-local piece: full
// course/lesson descriptions, announcements and messaging composers will
// all need the same "small rich-text field" shape, so it's built to spec
// here rather than forked per screen.
//
// Deliberately uncontrolled after mount (the DOM node owns the HTML once
// rendered) — a contentEditable that gets its innerHTML rewritten on every
// keystroke loses cursor position, so `value` only seeds the initial
// content and `onChange` streams the current HTML back out on input.
const TOOLS = [
  { command: "bold", Icon: BoldIcon, label: "Bold" },
  { command: "italic", Icon: ItalicIcon, label: "Italic" },
  { command: "formatBlock:h3", Icon: HeadingIcon, label: "Heading" },
  { command: "insertUnorderedList", Icon: ListBulletIcon, label: "Bulleted list" },
  { command: "createLink", Icon: LinkIcon, label: "Link" },
];

export default function RichTextEditor({ value, onChange, placeholder = "Start typing…", minHeight = 160, className = "" }) {
  const ref = useRef(null);
  const seeded = useRef(false);

  function run(command) {
    ref.current?.focus();
    if (command === "createLink") {
      const url = window.prompt("Link URL");
      if (!url) return;
      document.execCommand("createLink", false, url);
    } else if (command.startsWith("formatBlock:")) {
      document.execCommand("formatBlock", false, command.split(":")[1]);
    } else {
      document.execCommand(command, false);
    }
    onChange?.(ref.current?.innerHTML ?? "");
  }

  return (
    <div className={`overflow-hidden rounded-2xl border border-text/15 bg-bg ${className}`}>
      <div className="flex items-center gap-1 border-b border-text/10 bg-text/[0.03] px-2 py-1.5">
        {TOOLS.map(({ command, Icon, label }) => (
          <button
            key={command}
            type="button"
            aria-label={label}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(command)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text/55 transition-colors duration-150 hover:bg-white hover:text-primary"
          >
            <Icon />
          </button>
        ))}
      </div>
      <div
        ref={(node) => {
          ref.current = node;
          if (node && !seeded.current) {
            node.innerHTML = value || "";
            seeded.current = true;
          }
        }}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange?.(e.currentTarget.innerHTML)}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className="rich-text-editable px-4 py-3 text-sm leading-relaxed text-text outline-none [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline"
      />
    </div>
  );
}
