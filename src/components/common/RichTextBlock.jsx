import { looksLikeHtml, sanitizeRichHtml } from "../../utils/richText";

// Shows text written in a rich-text box (HTML) or typed as plain text, safely:
// HTML is reduced to an allow-list (bold, italics, lists, paragraphs) with no
// attributes; plain text keeps its line breaks.
export default function RichTextBlock({ text, className = "" }) {
  if (!text) return null;
  if (!looksLikeHtml(text)) return <p className={`whitespace-pre-line ${className}`}>{String(text).trim()}</p>;
  const html = sanitizeRichHtml(text);
  if (!html) return null;
  return (
    <div
      className={`ul-richtext [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold [&_strong]:text-(--lp-ink) [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-(--lp-ink) ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
