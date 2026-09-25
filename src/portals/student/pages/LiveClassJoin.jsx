import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import { ArrowLeftIcon, CheckIcon, FileTextIcon } from "../../../components/ui/icons";
import BackButton from "../../../components/common/BackButton";
import { SESSION } from "../data/sessionMock";
import { useAuth } from "../../../hooks/useAuth";
import { studentStorageKey } from "../data/studentLocalState";

export default function LiveClassJoin() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const roomRef = useRef(null);
  const notesKey = studentStorageKey("ul_class_notes_v1", user);
  const [stage, setStage] = useState("lobby");
  const [chatOpen, setChatOpen] = useState(true);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveToCalendar, setLeaveToCalendar] = useState(false);
  const [notes, setNotes] = useState(() => localStorage.getItem(notesKey) || "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([{ author: "Priya Sharma", text: "Let's start with functions.", time: "5:02 PM" }, { author: "Aarav Singh", text: "Can you explain default parameters?", time: "5:04 PM" }]);

  function secureJoin() {
    setStage("connecting");
    window.setTimeout(() => setStage("live"), 900);
  }

  function openFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else roomRef.current?.requestFullscreen?.();
  }

  function saveNotes() {
    try { localStorage.setItem(notesKey, notes); } catch { /* keep notes available in the current view */ }
    setNotesSaved(true);
  }

  function sendMessage() {
    if (!message.trim()) return;
    setMessages([...messages, { author: "You", text: message.trim(), time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }]);
    setMessage("");
  }

  if (stage === "lobby") return (
    <div className="mx-auto max-w-[980px] px-4 py-10 sm:px-6">
      <BackButton fallback="/student/calendar" className="mb-4" />
      <div className="rounded-3xl bg-primary p-7 text-white sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Pre-class lobby</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">{SESSION.classTitle}</h1>
        <p className="mt-3 text-white/75">{SESSION.educator} · Classroom preview</p>
        <div className="mt-8 rounded-2xl bg-white/10 p-5"><p className="text-sm font-semibold text-white">Frontend preview</p><p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">This page previews the student classroom layout. Live educator video, device checks, class attendance, and shared resources are not connected in this prototype.</p></div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-white p-5 text-text"><p className="font-semibold">Available in this preview</p><p className="mt-2 text-sm leading-6 text-text/60">Review the classroom layout, try the local chat controls, save your notes, and use fullscreen.</p></div><div className="rounded-2xl bg-white/10 p-5 text-white"><p className="font-semibold">Attendance</p><p className="mt-2 text-sm text-white/70">Attendance is not recorded from this preview.</p></div></div>
        <Button variant="inverse" className="mt-8" onClick={secureJoin}>Open room preview</Button>
      </div>
    </div>
  );

  if (stage === "connecting") return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4"><div className="text-center"><div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-primary/20" /><h1 className="mt-5 font-display text-2xl font-bold text-text">Opening classroom preview...</h1><p className="mt-2 text-sm text-text/60">Preparing the local student interface.</p></div></div>;

  if (stage === "ended") return <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6"><div className="rounded-2xl bg-white p-8 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f8e8df] text-primary"><CheckIcon /></span><h1 className="mt-5 font-display text-3xl font-bold text-text">Preview ended</h1><p className="mt-2 text-text/60">{SESSION.classTitle}</p><p className="mt-4 text-sm text-text/55">No live class was joined and no attendance was recorded. Your notes are saved in this browser.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button variant="secondary" onClick={() => navigate("/student/notes")}>View notes</Button><Button onClick={() => navigate("/student/calendar")}>Back to Calendar</Button></div></div></div>;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-text/5 p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px]">
        <button type="button" onClick={() => { setLeaveToCalendar(true); setLeaveOpen(true); }} className="mb-3 inline-flex items-center gap-2 rounded-full border border-text/10 bg-white px-3.5 py-2 text-xs font-semibold text-text/65 shadow-sm transition-colors hover:border-primary/30 hover:text-primary"><ArrowLeftIcon className="h-4 w-4" />Back to calendar</button>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Classroom preview</p><h1 className="font-display text-2xl font-bold text-text">{SESSION.classTitle}</h1><p className="text-sm text-text/55">{SESSION.educator}</p></div><span className="rounded-full bg-[#f8e8df] px-3 py-1.5 text-xs font-semibold text-primary">Demo mode · not connected live</span></header>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="rounded-2xl bg-primary p-4 sm:p-6"><div ref={roomRef} className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-2xl bg-text/30"><div className="text-center text-white"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-rotation-1 text-2xl font-bold text-text">PS</div><p className="mt-4 font-display text-xl font-semibold text-white">{SESSION.educator}</p><p className="mt-1 text-sm text-white/60">Video feed unavailable in preview</p></div><span className="absolute bottom-4 left-4 rounded-full bg-text/50 px-3 py-1 text-xs text-white">Educator preview</span></div><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" onClick={openFullscreen} className="rounded-full bg-white/15 px-4 py-3 text-sm text-white hover:bg-white/25">Fullscreen</button><button type="button" className="rounded-full bg-danger px-5 py-3 text-sm font-semibold text-white" onClick={() => setLeaveOpen(true)}>Leave preview</button></div></section>
          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-display font-semibold text-text">Class chat</h2><button type="button" className="text-xs text-primary" onClick={() => setChatOpen(!chatOpen)}>{chatOpen ? "Collapse" : "Open"}</button></div><p className="mt-1 text-[11px] text-text/45">Sample messages · new messages stay in this preview.</p>{chatOpen && <><div className="mt-4 max-h-52 space-y-3 overflow-y-auto">{messages.map((item, index) => <div key={`${item.time}-${index}`} className="rounded-2xl bg-text/5 p-3 text-sm"><div className="flex justify-between text-xs font-semibold text-text/55"><span>{item.author}</span><span>{item.time}</span></div><p className="mt-1 text-text/80">{item.text}</p></div>)}</div><div className="mt-4 flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} className="min-w-0 flex-1 rounded-full bg-text/5 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Message class..." /><button type="button" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white" onClick={sendMessage}>Send</button></div></>}</div>
            <div className="rounded-2xl bg-white p-5"><h2 className="font-display font-semibold text-text">Participation</h2><p className="mt-2 flex items-start gap-2 text-sm leading-6 text-text/60"><CheckIcon className="mt-1 shrink-0" />Hand raising and attendance are unavailable in the classroom preview.</p></div>
            <div className="rounded-2xl bg-white p-5"><h2 className="font-display font-semibold text-text"><FileTextIcon className="mr-2 inline" />Class notes</h2><p className="mt-1 text-xs text-text/50">Loops & Functions · saved in this browser</p><textarea value={notes} onChange={(event) => { setNotes(event.target.value); setNotesSaved(false); }} className="mt-3 min-h-24 w-full rounded-2xl bg-text/5 p-3 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Write your notes here..." /><button type="button" className="mt-2 text-sm font-semibold text-primary" onClick={saveNotes}>{notesSaved ? "Notes saved ✓" : "Save notes"}</button></div>
            <div className="rounded-2xl bg-rotation-2 p-5"><h2 className="font-display font-semibold text-text">Resources</h2><p className="mt-2 text-sm leading-6 text-text/65">No downloadable class resources are attached to this preview.</p></div>
          </aside>
        </div>
      </div>
      <Modal open={leaveOpen} onClose={() => { setLeaveOpen(false); setLeaveToCalendar(false); }} title="Leave classroom preview?" footer={<><Button variant="secondary" onClick={() => { setLeaveOpen(false); setLeaveToCalendar(false); }}>Stay</Button><Button onClick={() => { setLeaveOpen(false); if (leaveToCalendar) navigate("/student/calendar"); else setStage("ended"); }}>{leaveToCalendar ? "Back to Calendar" : "Leave preview"}</Button></>}>
        <p className="text-sm text-text/60">This is a local classroom preview. No live session is running and attendance will not be recorded. Notes you saved remain in this browser.</p>
      </Modal>
    </div>
  );
}
