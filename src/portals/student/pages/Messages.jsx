import { useMemo, useState } from "react";
import Button from "../../../components/ui/Button";

const conversations = [
  {
    id: "c1",
    educator: "Priya Sharma",
    course: "Complete Python Bootcamp",
    members: 248,
    preview: "How should I structure the API calls in my final project?",
    unread: 2,
    posts: [
      { id: "p1", author: "Aarav Singh", role: "Student", initials: "AS", text: "How should I structure the API calls in my final project?", time: "10:42 AM", replies: 3 },
      { id: "p2", author: "Priya Sharma", role: "Educator", initials: "PS", text: "Keep the API layer separate from your UI components. Start with one service file per resource, then handle loading and error states in the component.", time: "10:58 AM", replies: 1, educator: true },
      { id: "p3", author: "Meera Iyer", role: "Student", initials: "MI", text: "I used the same approach and it made testing each endpoint much easier.", time: "11:06 AM", replies: 0 },
    ],
  },
  {
    id: "c2",
    educator: "Rohan Mehta",
    course: "Algebra Foundations",
    members: 184,
    preview: "Can someone explain the second step in this equation?",
    unread: 0,
    posts: [
      { id: "p4", author: "Rohan Mehta", role: "Educator", initials: "RM", text: "Welcome to this week's algebra discussion. Share the question you are working through and show your steps.", time: "Yesterday", replies: 2, educator: true },
      { id: "p5", author: "Kabir Shah", role: "Student", initials: "KS", text: "Can someone explain the second step in this equation?", time: "Yesterday", replies: 4 },
    ],
  },
];

export default function Messages() {
  const [selected, setSelected] = useState(conversations[0]);
  const [draft, setDraft] = useState("");
  const [postsByCourse, setPostsByCourse] = useState(() =>
    Object.fromEntries(conversations.map((conversation) => [conversation.id, conversation.posts]))
  );
  const [query, setQuery] = useState("");

  const filteredConversations = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return conversations;
    return conversations.filter((conversation) =>
      `${conversation.educator} ${conversation.course} ${conversation.preview}`.toLowerCase().includes(value)
    );
  }, [query]);

  function sendMessage(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    setPostsByCourse((current) => ({
      ...current,
      [selected.id]: [
        ...(current[selected.id] || []),
        {
          id: `post-${Date.now()}`,
          author: "You",
          role: "Student",
          initials: "YO",
          text: draft.trim(),
          time: "Just now",
          replies: 0,
        },
      ],
    }));
    setDraft("");
  }

  return (
    <div className="px-4 py-7 sm:px-6">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-[#4a0e0e] px-6 py-7 text-white shadow-[0_16px_40px_rgba(74,14,14,0.16)] sm:px-8">
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full border-[24px] border-white/10" />
        <div className="absolute bottom-[-70px] right-28 h-40 w-40 rounded-full bg-[#efb6a2]/20" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f7c8b8]">Connect & grow</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Your learning community</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">Ask better questions, share your progress, and learn alongside educators and fellow students.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            {["Ask a question", "Share a win", "Find study partners"].map((prompt) => <span key={prompt} className="rounded-full border border-white/20 bg-white/10 px-3 py-2">{prompt}</span>)}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {[["12", "Community posts"], ["8", "Helpful replies"], ["3", "Active courses"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-text/10 bg-white px-4 py-4 shadow-sm"><strong className="block font-display text-xl text-text">{value}</strong><span className="text-xs text-text/50">{label}</span></div>)}
      </div>

      <div className="mt-6 grid min-h-[650px] overflow-hidden rounded-[1.5rem] border border-text/10 bg-white shadow-[0_12px_35px_rgba(23,50,77,0.08)] md:grid-cols-[330px_1fr]">
        <aside className="border-b border-text/10 bg-[#fffaf7] md:border-b-0 md:border-r">
          <div className="border-b border-text/10 p-5">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary/70">My spaces</p><h2 className="mt-1 font-display text-lg font-bold text-text">Discussions</h2></div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{conversations.length} courses</span>
            </div>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search discussions..." aria-label="Search discussions" className="mt-4 w-full rounded-xl border border-text/10 bg-white px-3 py-2.5 text-xs outline-none transition focus:border-primary" />
          </div>
          <div>
            {filteredConversations.map((conversation) => (
              <button key={conversation.id} type="button" onClick={() => setSelected(conversation)} className={`relative w-full border-b border-text/10 p-4 text-left transition ${selected.id === conversation.id ? "bg-white shadow-[inset_4px_0_0_#4a0e0e]" : "hover:bg-white/70"}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1d9d0] text-xs font-bold text-primary">{conversation.educator.split(" ").map((part) => part[0]).join("")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-text">{conversation.educator}</span>{conversation.unread > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">{conversation.unread}</span>}</span>
                    <span className="mt-1 block truncate text-xs text-text/45">{conversation.course} · {conversation.members} learners</span>
                    <span className="mt-2 block line-clamp-1 text-xs text-text/60">{conversation.preview}</span>
                  </span>
                </div>
              </button>
            ))}
            {filteredConversations.length === 0 && <p className="p-5 text-sm text-text/50">No discussions match your search.</p>}
          </div>
          <div className="m-4 rounded-2xl bg-[#f7e8e2] p-4"><p className="text-xs font-semibold text-primary">Community tip</p><p className="mt-1 text-xs leading-5 text-text/60">Add context and what you have tried so others can help faster.</p></div>
        </aside>
        <section className="flex min-h-[650px] flex-col">
          <header className="flex items-center justify-between border-b border-text/10 bg-white px-5 py-4 sm:px-7">
            <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e7f1ef] text-sm font-bold text-[#28756f]">#</span><div><h2 className="font-display text-lg font-bold text-text">{selected.course}</h2><p className="mt-1 text-xs text-text/50">{selected.members} learners · Questions, answers, and peer support</p></div></div>
            <span className="hidden rounded-full bg-[#e7f1ef] px-3 py-1.5 text-[10px] font-bold text-[#28756f] sm:inline-flex">● {selected.members} members</span>
          </header>
          <div className="flex-1 space-y-5 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_#f7eee9,_transparent_35%),#fcfbfa] px-5 py-7 sm:px-8">
            <p className="mx-auto w-fit rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text/40 shadow-sm">Today</p>
            {(postsByCourse[selected.id] || []).map((post) => (
              <article key={post.id} className={`flex max-w-3xl gap-3 ${post.author === "You" ? "ml-auto flex-row-reverse" : ""}`}>
                <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold ${post.educator ? "bg-[#e7f1ef] text-[#28756f]" : "bg-[#f1d9d0] text-primary"}`}>{post.initials}</span>
                <div className={`min-w-0 rounded-2xl p-4 shadow-[0_5px_18px_rgba(23,50,77,0.05)] ${post.author === "You" ? "rounded-tr-sm bg-primary text-white" : "rounded-tl-sm border border-text/5 bg-white text-text/75"}`}>
                  <div className={`flex flex-wrap items-center gap-2 text-xs font-semibold ${post.author === "You" ? "text-white/80" : post.educator ? "text-[#28756f]" : "text-primary"}`}><span>{post.author}</span><span className="font-normal opacity-60">· {post.role}</span><span className="font-normal opacity-50">· {post.time}</span></div>
                  <p className="mt-2 text-sm leading-6">{post.text}</p>
                  <div className={`mt-3 flex items-center gap-3 text-[11px] ${post.author === "You" ? "text-white/70" : "text-text/45"}`}><button type="button" className="font-semibold hover:text-primary">Reply</button><span>{post.replies} {post.replies === 1 ? "reply" : "replies"}</span></div>
                </div>
              </article>
            ))}
          </div>
          <div className="border-t border-text/10 bg-white p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap gap-2">{["Can you explain this?", "I have a question", "Share a resource"].map((suggestion) => <button key={suggestion} type="button" onClick={() => setDraft(suggestion)} className="rounded-full border border-text/10 px-3 py-1.5 text-[11px] text-text/60 transition hover:border-primary hover:text-primary">{suggestion}</button>)}</div>
            <form onSubmit={sendMessage} className="flex gap-3">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Ask ${selected.course} community...`} aria-label="Write a course discussion post" className="min-w-0 flex-1 rounded-2xl border border-text/15 bg-[#fffaf7] px-5 py-4 text-sm outline-none focus:border-primary" />
              <Button fullWidth={false} type="submit" className="rounded-2xl px-6">Post question</Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
