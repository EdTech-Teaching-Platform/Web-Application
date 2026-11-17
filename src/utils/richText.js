// Series descriptions are written in the wizard's rich-text box ("About this
// series"), so test_series.description holds HTML such as
// "<p>Full <strong>JEE</strong> physics…</p>". Older series (and the quick
// edit form) hold plain text. Shown as plain text, the HTML appeared as raw
// tags and "&nbsp;" to students choosing a series.
//   sanitizeRichHtml(html) -> safe HTML (allow-listed tags, no attributes)
//   richTextToPlain(text)  -> readable plain text (tags removed, entities decoded)
//   looksLikeHtml(text)    -> whether the text contains markup

// Security audit (2026-11-18, SEC-01): every place that renders stored HTML
// goes through sanitizeRichHtml. Formatting tags only; no attributes except a
// safe href (http / https / mailto) on links, which open in a new tab.
const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "S", "SUB", "SUP", "UL", "OL", "LI", "BR", "HR", "P", "DIV", "SPAN",
  "H2", "H3", "H4", "BLOCKQUOTE", "CODE", "PRE", "A"]);
const SAFE_HREF = /^(https?:|mailto:)/i;
const BLOCK = new Set(["P", "DIV", "LI", "BR", "H3", "H4", "UL", "OL"]);

export function looksLikeHtml(text) {
  return /<\/?[a-z][^>]*>|&[a-z]+;|&#\d+;/i.test(String(text || ""));
}

function parse(html) {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(`<div>${html}</div>`, "text/html").body.firstChild;
}

export function sanitizeRichHtml(html) {
  if (!html) return "";
  const root = parse(String(html));
  if (!root) return "";
  const walk = (node) => {
    Array.from(node.childNodes).forEach((ch) => {
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1 || ch.tagName === "SCRIPT" || ch.tagName === "STYLE") { node.removeChild(ch); return; }
      // a link without a safe address is unwrapped (its text stays)
      const unsafeLink = ch.tagName === "A" && !SAFE_HREF.test((ch.getAttribute("href") || "").trim());
      if (!ALLOWED.has(ch.tagName) || unsafeLink) {
        walk(ch);
        while (ch.firstChild) node.insertBefore(ch.firstChild, ch);
        node.removeChild(ch);
      } else {
        const href = ch.tagName === "A" ? (ch.getAttribute("href") || "").trim() : "";
        Array.from(ch.attributes).forEach((a) => ch.removeAttribute(a.name));
        if (ch.tagName === "A" && SAFE_HREF.test(href)) {
          ch.setAttribute("href", href);
          ch.setAttribute("target", "_blank");
          ch.setAttribute("rel", "noopener noreferrer nofollow");
        }
        walk(ch);
      }
    });
  };
  walk(root);
  // drop empty paragraphs left by the editor ("<p><br></p>", "<p>&nbsp;</p>")
  root.querySelectorAll("p, div").forEach((el) => { if (!el.textContent.replace(/ /g, " ").trim() && !el.querySelector("li")) el.remove(); });
  return root.innerHTML.trim();
}

export function richTextToPlain(text) {
  const value = String(text || "");
  if (!looksLikeHtml(value)) return value.replace(/\s+/g, " ").trim();
  const root = parse(value);
  if (!root) return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const parts = [];
  const walk = (node) => {
    node.childNodes.forEach((ch) => {
      if (ch.nodeType === 3) parts.push(ch.textContent);
      else if (ch.nodeType === 1 && ch.tagName !== "SCRIPT" && ch.tagName !== "STYLE") {
        walk(ch);
        if (BLOCK.has(ch.tagName)) parts.push(" ");
      }
    });
  };
  walk(root);
  return parts.join("").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}
