import { BrandMark } from "../../../auth/components/AuthKit";
import { BLOCKED_MESSAGE } from "../../../services/accountBlock";

// Full-page screen for a blocked student (QA triage P2): no navigation and no
// portal content, only the message and Log out. The message is the generic
// one from student_get_account_status, never the admin's internal reason.
export default function AccountBlockedScreen({ message, onLogout, onRetry }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f6fd] px-4 py-12 font-body text-text">
      <section role="alert" aria-labelledby="blocked-title" className="w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-[0_24px_60px_-28px_rgba(15,17,21,0.35)] ring-1 ring-text/10">
        <BrandMark className="mx-auto h-12 w-12" />
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#b42318]">Access paused</p>
        <h1 id="blocked-title" className="mt-2 font-display text-2xl font-bold">Account blocked</h1>
        <p className="mt-3 text-sm leading-6 text-text/70">{message || BLOCKED_MESSAGE}</p>
        <p className="mt-2 text-sm leading-6 text-text/70">Contact the administrator if you think this is a mistake.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onLogout} className="rounded-full bg-[#101828] px-6 py-2.5 text-sm font-semibold text-white">Log out</button>
          {onRetry && <button type="button" onClick={onRetry} className="rounded-full px-6 py-2.5 text-sm font-semibold ring-1 ring-text/20">Check again</button>}
        </div>
      </section>
    </main>
  );
}
