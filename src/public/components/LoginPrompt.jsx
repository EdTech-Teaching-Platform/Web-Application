// "Log in first" prompt for the public test series pages. Visitors can browse
// series and tests freely; enrolling or starting a test needs an account. The
// `redirect` is the signed-in version of the same page, so after logging in
// (or registering) the visitor lands right back on it.
import { Link } from "react-router-dom";
import Modal from "../../components/ui/Modal";

const BTN = "inline-flex h-11 flex-1 items-center justify-center rounded-full px-5 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5";

export default function LoginPrompt({ open, onClose, redirect, title = "Log in to continue" }) {
  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm leading-relaxed text-text/70">
        You can look through every test series without an account. To enrol and take tests, please log in first. You will
        come straight back to this page afterwards.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link to={`/login${query}`} className={`${BTN} bg-(--lp-ink) text-white`}>Log in</Link>
        <Link to={`/register${query}`} className={`${BTN} bg-(--lp-grey) text-(--lp-ink) ring-1 ring-(--lp-line)`}>Create account</Link>
      </div>
    </Modal>
  );
}
