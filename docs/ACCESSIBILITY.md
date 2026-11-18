# Accessibility statement and engineering notes

Target: **WCAG 2.1 Level AA**. This is a design and engineering target backed by the
controls below and by automated tests (`tests/accessibility.test.jsx`). It is **not** a
certified conformance claim: a third-party audit with real assistive technology
(NVDA, JAWS, VoiceOver, TalkBack) is still recommended before any formal VPAT/ACR.

## 1. What was already in the app (found by code audit, 2026-11-19)

| Area | Evidence in `src/` | WCAG |
|---|---|---|
| Screen-reader names on controls | ~515 `aria-label` uses; icon-only buttons are labelled | 1.1.1, 4.1.2 |
| Decorative graphics hidden | ~317 `aria-hidden`; decorative `<img alt="">` | 1.1.1 |
| Meaningful images have alt text | course, educator and question images use real `alt` | 1.1.1 |
| Dialogs / modals | `role="dialog"` + `aria-modal` (44), Escape to close (39 handlers) | 2.1.2, 4.1.2 |
| Live feedback | `role="alert"` (74), `role="status"` (53), `aria-live` (15), `aria-busy` (16); toasts meet 4.5:1 (unit-tested) | 4.1.3, 1.4.3 |
| Forms | `<label htmlFor>`, `aria-invalid` (23), `aria-describedby` (11), `autoComplete` (38), native `required` (124), scroll/focus to first invalid field (`scrollToFirstInvalid`) | 1.3.1, 3.3.1–3.3.3, 1.3.5 |
| Keyboard operation | key handlers (59), `aria-expanded` (24), `aria-pressed` (36), `aria-selected` + `role="tab"`, `aria-current` (11) | 2.1.1, 4.1.2 |
| Focus indicators | `focus-visible` styles on ~48 components | 2.4.7 |
| Landmarks | `<main>` in every layout, `<header>`, `<aside>`, `<nav>` | 1.3.1, 2.4.1 |
| Reduced motion | `prefers-reduced-motion` handled for hero, ambient and toast animations | 2.3.3 |
| Language, zoom | `<html lang="en">`; viewport does not block pinch-zoom | 3.1.1, 1.4.4 |
| Video | Custom player with keyboard-operable controls and a **Transcript tab** | 1.2.1 |
| Error handling | `ErrorBoundary` shows a readable panel instead of a blank screen | 3.3.1 |

## 2. What this change added (additive; no existing component logic changed)

| Gap | Addition | WCAG | How it helps |
|---|---|---|---|
| No way to bypass the header/sidebar | **Skip to main content** link (`RouteA11y`), first tab stop, visible on focus | 2.4.1 | Keyboard and switch users reach content in one key press instead of tabbing through every nav item on every page |
| Every page had the title "educative-learning" | **Per-route `document.title`** taken from the page `<h1>` ("Orders \| Universal Learning") | 2.4.2 | Screen-reader users hear where they are; tabs, history and bookmarks become distinguishable |
| SPA route changes were silent | **Polite live-region announcement** ("Orders page loaded") and focus moved to `<main>` after navigation, only when focus was lost or outside main | 4.1.3, 2.4.3 | Blind users get the page-change feedback sighted users get visually; keyboard users do not restart from the top of a stale nav |
| Some controls had no visible focus | Zero-specificity global `:focus-visible` ring; restores a ring on `outline-none` controls that declare no replacement; component styles still win | 2.4.7 | Keyboard users can always see where they are |
| Motion only partly respected | Global `prefers-reduced-motion` backstop (animations, transitions, smooth scroll; loading spinners keep spinning) | 2.3.3 | Protects users with vestibular disorders and migraine |
| Windows High Contrast / more contrast | `forced-colors` and `prefers-contrast: more` focus rules | 1.4.11, 2.4.7 | Focus remains visible in high-contrast modes |
| Several unlabelled `<nav>` landmarks | `aria-label` added to 9 navs (Primary, Account, Admin, Regional head, Educator, Student mobile, On this page, Legal) | 1.3.1, 2.4.1 | Landmark lists are distinguishable (not eight anonymous "navigation" entries) |
| Video had no caption hook | `VideoLessonPlayer` renders `<track kind="captions">` when a lesson supplies `captionsUrl` (+ optional `captionsLang`, `captionsLabel`) | 1.2.2 | Deaf and hard-of-hearing learners get synchronised captions once WebVTT files are provided |
| Text-size shrinking on mobile | `text-size-adjust: 100%` | 1.4.4 | Respects the user's chosen text size |

Files: `src/components/common/RouteA11y.jsx` (new), `src/routes/AppRoutes.jsx` (one line),
`src/index.css` (appended block), nine one-attribute `aria-label` additions,
`VideoLessonPlayer.jsx` (optional `<track>`), `tests/accessibility.test.jsx` (new).

## 3. Known gaps (honest list for stakeholders)

1. **Colour tokens**: as small text on white, `--color-success` #5c8a68 = 3.97:1,
   `--color-warning` #c99a4a = 2.56:1 and `--color-accent-lilac` #8c78b8 = 3.82:1 fail 4.5:1.
   They are fine for large text, icons and fills with dark text on top. Tokens were not changed
   because design.md marks success/warning as placeholders; the design owner should pick
   compliant hexes (suggested: success ≤ #3f7350, warning ≤ #8a6212).
2. **Captions content**: the hook exists, but WebVTT files must be authored/generated per lesson
   (the Transcript tab remains the text alternative today).
3. **~67 `<div>`/`<span>` elements with `onClick`**: should be reviewed and converted to
   `<button>` or given `role="button"` + `tabIndex` + key handlers where they are not already.
4. **Live proctored tests** (webcam / timers): time-limited tests need an extension/accommodation
   process (WCAG 2.2.1); this is a product/policy decision.
5. **Manual testing** with NVDA/VoiceOver, 200%/400% zoom and keyboard-only passes of the
   critical journeys (register, pay, take a test, watch a lesson) is still to be done.

## 4. How to verify

- `npm test` (includes `tests/accessibility.test.jsx`), `npm run build`.
- Keyboard: press Tab once on any page, the skip link appears; Enter jumps to content.
- Chrome DevTools > Lighthouse > Accessibility, or the axe DevTools extension, on /, /login,
  /student, /admin.
- OS settings: enable "Reduce motion" and "Increase contrast" and confirm calmer motion and stronger focus rings.
