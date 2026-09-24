import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import { CheckIcon, FileTextIcon } from "../../../components/ui/icons";
import BackButton from "../../../components/common/BackButton";
import { SESSION } from "../data/sessionMock";

export default function LiveClassJoin() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("lobby");
  const [chatOpen, setChatOpen] = useState(true);
  const [hand, setHand] = useState("lowered");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([{ author: "Priya", text: "Let's start with functions.", time: "5:02 PM" }, { author: "You", text: "Can you explain default parameters?", time: "5:04 PM" }]);
  const [seconds, setSeconds] = useState(253);

  useEffect(() => {
    if (stage !== "live") return undefined;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  function secureJoin() {
    setStage("connecting");
    window.setTimeout(() => setStage("live"), 900);
  }

  function sendMessage() {
    if (!message.trim()) return;
    setMessages([...messages, { author: "You", text: message.trim(), time: "Now" }]);
    setMessage("");
  }

  if (stage === "lobby") return (
    <div className="mx-auto max-w-[980px] px-4 py-10 sm:px-6">
      <BackButton fallback="/student/calendar" className="mb-4" />
      <div className="rounded-3xl bg-primary p-7 text-white sm:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/65">Pre-class lobby</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">{SESSION.classTitle}</h1>
        <p className="mt-3 text-white/75">{SESSION.educator} · Today · 5:00 PM</p>
        <div className="mt-8 rounded-2xl bg-white/10 p-5"><p className="text-sm text-white/70">Class starts in</p><p className="mt-1 font-display text-4xl font-bold text-white">04:32</p></div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-white p-5 text-text"><p className="font-semibold">Device check</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm text-success">{["Camera", "Microphone", "Speaker", "Internet connection"].map((item) => <span key={item}><CheckIcon className="mr-1 inline" />{item}</span>)}</div></div><div className="rounded-2xl bg-white/10 p-5 text-white"><p className="font-semibold">Secure classroom</p><p className="mt-2 text-sm text-white/70">Your single-use class link is protected. Permanent meeting credentials are never displayed.</p></div></div>
        <Button variant="inverse" className="mt-8" onClick={secureJoin}>Join class</Button>
      </div>
    </div>
  );

  if (stage === "connecting") return <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4"><div className="text-center"><div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-primary/20" /><h1 className="mt-5 font-display text-2xl font-bold text-text">Joining secure classroom...</h1><p className="mt-2 text-sm text-text/60">Authenticating your booking and connecting you safely.</p></div></div>;

  if (stage === "ended") return <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6"><div className="rounded-2xl bg-white p-8 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success"><CheckIcon /></span><h1 className="mt-5 font-display text-3xl font-bold text-text">Class completed</h1><p className="mt-2 text-text/60">{SESSION.classTitle}</p><div className="my-7 grid gap-3 text-sm text-text/70 sm:grid-cols-2"><div className="rounded-2xl bg-text/5 p-4">Duration<strong className="mt-1 block text-text">58 minutes</strong></div><div className="rounded-2xl bg-text/5 p-4">Attendance<strong className="mt-1 block text-success">Recorded</strong></div></div><div className="flex flex-col gap-3 sm:flex-row"><Button variant="secondary" onClick={() => navigate("/student/liveclassrating?session=l1")}>Rate class</Button><Button variant="secondary" onClick={() => navigate("/student/notes")}>View notes</Button><Button onClick={() => navigate("/student/recordings")}>View resources</Button></div></div></div>;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-text/5 p-4 sm:p-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Secure classroom</p><h1 className="font-display text-2xl font-bold text-text">{SESSION.classTitle}</h1><p className="text-sm text-text/55">{SESSION.educator}</p></div><div className="flex items-center gap-4"><span className="rounded-full bg-success/15 px-3 py-1.5 text-xs font-semibold text-success">● Excellent connection</span><span className="font-display text-sm font-semibold text-text">LIVE · {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, "0")}</span></div></header>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="rounded-2xl bg-primary p-4 sm:p-6"><div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-2xl bg-text/30"><div className="text-center text-white"><div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-rotation-1 text-2xl font-bold text-text">PS</div><p className="mt-4 font-display text-xl font-semibold text-white">{SESSION.educator}</p><p className="mt-1 text-sm text-white/60">Educator video</p></div><span className="absolute bottom-4 left-4 rounded-full bg-text/50 px-3 py-1 text-xs text-white">Priya Sharma</span><span className="absolute bottom-4 right-4 rounded-2xl bg-text/50 px-3 py-2 text-xs text-white">You · camera off</span></div><div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" className="rounded-full bg-white/15 px-4 py-3 text-sm text-white hover:bg-white/25">Mic</button><button type="button" className="rounded-full bg-white/15 px-4 py-3 text-sm text-white hover:bg-white/25">Camera</button><button type="button" className="rounded-full bg-white/15 px-4 py-3 text-sm text-white hover:bg-white/25">Screen</button><button type="button" className="rounded-full bg-white/15 px-4 py-3 text-sm text-white hover:bg-white/25">Fullscreen</button><button type="button" className="rounded-full bg-danger px-5 py-3 text-sm font-semibold text-white" onClick={() => setLeaveOpen(true)}>Leave</button></div></section>
          <aside className="space-y-4">
            <div className="rounded-2xl bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-display font-semibold text-text">Class chat</h2><button type="button" className="text-xs text-primary" onClick={() => setChatOpen(!chatOpen)}>{chatOpen ? "Collapse" : "Open"}</button></div>{chatOpen && <><div className="mt-4 max-h-52 space-y-3 overflow-y-auto">{messages.map((item, index) => <div key={`${item.time}-${index}`} className="rounded-2xl bg-text/5 p-3 text-sm"><div className="flex justify-between text-xs font-semibold text-text/55"><span>{item.author}</span><span>{item.time}</span></div><p className="mt-1 text-text/80">{item.text}</p></div>)}</div><div className="mt-4 flex gap-2"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} className="min-w-0 flex-1 rounded-full bg-text/5 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Message class..." /><button type="button" className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white" onClick={sendMessage}>Send</button></div></>}</div>
            <div className="rounded-2xl bg-white p-5"><div className="flex items-center justify-between"><h2 className="font-display font-semibold text-text">Participation</h2><button type="button" className={`rounded-full px-3 py-2 text-xs font-semibold ${hand === "raised" ? "bg-success/15 text-success" : "bg-primary text-white"}`} onClick={() => setHand(hand === "raised" ? "lowered" : "raised")}>{hand === "raised" ? "Lower hand" : "Raise hand"}</button></div>{hand === "raised" && <p className="mt-3 text-sm text-success">Hand raised ✓ · Position in queue: #3</p>}<div className="mt-4 flex items-center gap-2 text-sm text-success"><CheckIcon />Attendance recorded</div></div>
            <div className="rounded-2xl bg-white p-5"><h2 className="font-display font-semibold text-text"><FileTextIcon className="mr-2 inline" />Class notes</h2><p className="mt-1 text-xs text-text/50">Loops & Functions</p><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-3 min-h-24 w-full rounded-2xl bg-text/5 p-3 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Write your notes here..." /><button type="button" className="mt-2 text-sm font-semibold text-primary" onClick={() => window.sessionStorage.setItem("class-notes", notes)}>Save notes</button></div>
            <div className="rounded-2xl bg-rotation-2 p-5"><h2 className="font-display font-semibold text-text">Resources</h2><div className="mt-3 space-y-2 text-sm text-text/75"><p>📄 Lecture PDF <button type="button" className="float-right font-semibold text-primary">Open</button></p><p>📎 Exercise Sheet <button type="button" className="float-right font-semibold text-primary">Download</button></p><p>💻 Source Code <button type="button" className="float-right font-semibold text-primary">Open</button></p></div></div>
          </aside>
        </div>
      </div>
      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Leave this class?" footer={<><Button variant="secondary" onClick={() => setLeaveOpen(false)}>Stay</Button><Button onClick={() => { setLeaveOpen(false); setStage("ended"); }}>Leave</Button></>}>
        <p className="text-sm text-text/60">You can rejoin while the session is active. Your attendance and notes will be preserved.</p>
      </Modal>
    </div>
  );
}
