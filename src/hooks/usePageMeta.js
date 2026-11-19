import { useEffect } from "react";

// Sets the document title and, for private pages, a robots "noindex, nofollow"
// meta tag while the page is mounted (QA audit BUG-02). Crawlers that don't run
// JavaScript get the same rule from the X-Robots-Tag header in vercel.json.
//   usePageMeta({ title: "Admin sign in", noindex: true })
export default function usePageMeta({ title, noindex = false } = {}) {
  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = `${title} | Universal Learning`;
    let meta = null;
    if (noindex) {
      meta = document.createElement("meta");
      meta.name = "robots";
      meta.content = "noindex, nofollow";
      meta.dataset.pageMeta = "true";
      document.head.appendChild(meta);
    }
    return () => {
      document.title = previousTitle;
      meta?.remove();
    };
  }, [title, noindex]);
}
