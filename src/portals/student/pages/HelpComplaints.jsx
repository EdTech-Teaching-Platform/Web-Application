import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { HelpCircleIcon, SearchIcon, UploadIcon, CheckCircleIcon, ArrowLeftIcon } from "../../../components/ui/icons";
import { COURSES, EDUCATORS } from "../../../data/catalogMock";
import { useAuth } from "../../../hooks/useAuth";

const STORAGE_KEY = "ul_student_complaints_v1";
const CATEGORIES = [
  { id: "course", title: "Course Issue", description: "Report problems with course content, lessons, assignments, videos, PDFs, quizzes, or course quality.", tint: "bg-[#f8e8df]", icon: "01" },
  { id: "educator", title: "Teacher / Educator", description: "Report concerns about an educator, live class, teaching experience, or inappropriate behaviour.", tint: "bg-[#e7f1ef]", icon: "02" },
  { id: "technical", title: "Technical Problem", description: "Report bugs, broken pages, login problems, video issues, payment errors, or other technical problems.", tint: "bg-[#eeeaf6]", icon: "03" },
  { id: "other", title: "Other Complaint", description: "Something else? Tell us what happened and our support team will review it.", tint: "bg-[#f8efda]", icon: "04" },
];
const TYPES = ["Course issue", "Educator / Teacher", "Live class", "Technical / Website bug", "Payment / Refund", "Account issue", "Inappropriate content / behaviour", "Certificate issue", "Other"];
const WHERE_OPTIONS = ["Course page", "Course player", "Live class", "Assessment", "Payment / Checkout", "Profile / Account", "Other"];
const HELP = [
  ["Video not playing", "Check your connection, refresh the lesson, and try another browser. If playback still fails, report the course, lesson, and any error message."],
  ["Course content issue", "Use the report form to tell us which course, chapter, and lesson contains the issue. Add a screenshot or file if it helps explain the problem."],
  ["Payment failed", "Check your order history for the latest payment status. If you were charged but access did not unlock, choose Payment / Refund and include your order ID."],
  ["Certificate not appearing", "Certificates appear after all course completion requirements are met. If your course shows complete and there is still no certificate, report a Certificate issue."],
  ["Can't access a course", "Confirm you are signed into the account used for purchase and check My Learning. If access is still missing, report an Account or Payment issue."],
  ["Live class problem", "Check the class time and your device connection. For a class that ended or a repeated technical issue, include the class name and date/time in your report."],
  ["Login/account problem", "Try signing out and back in, and check that you are using the right email. Never include your password in a support report."],
];

function readTickets(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function persistTickets(storageKey, tickets) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(tickets));
  } catch {
    // Keep the current page usable when browser storage is unavailable.
  }
}

function newForm(categoryId, courseId = "") {
  const typesByCategory = { course: "Course issue", educator: "Educator / Teacher", technical: "Technical / Website bug", other: "Other" };
  const course = COURSES.find((item) => item.id === courseId);
  return { categoryId, complaintType: typesByCategory[categoryId] || "Other", relatedCourseId: courseId, educatorId: course?.educatorId || "", where: "", subject: "", description: "", device: "", browser: "", errorMessage: "", pageUrl: "", chapter: "", lesson: "", timestamp: "", className: "", classDate: "" };
}

function dateLabel(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function statusVariant(status) {
  if (status === "Resolved") return "success";
  if (status === "Closed") return "neutral";
  if (status === "Waiting for Information") return "warning";
  if (status === "In Progress") return "warning";
  return "neutral";
}

function Field({ label, required, children, className = "" }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-semibold text-text/70">{label}{required && <span className="text-primary"> *</span>}</span>{children}</label>;
}

function inputClass(extra = "") {
  return `w-full rounded-xl border border-text/10 bg-white px-3.5 py-3 text-sm text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 ${extra}`;
}

export default function HelpComplaints() {
  const navigate = useNavigate();
  const { ticketId } = useParams();
  const { user } = useAuth();
  const storageKey = `${STORAGE_KEY}:${encodeURIComponent(user?.identifier || user?.id || user?.name || "guest")}`;
  const formRef = useRef(null);
  const [tickets, setTickets] = useState(() => readTickets(storageKey));
  const [selectedCategory, setSelectedCategory] = useState("");
  const [form, setForm] = useState(() => newForm(""));
  const [files, setFiles] = useState([]);
  const [faqQuery, setFaqQuery] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [submittedId, setSubmittedId] = useState("");
  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState([]);

  const ticket = tickets.find((item) => item.id === ticketId);
  const filteredHelp = useMemo(() => HELP.filter(([title, answer]) => `${title} ${answer}`.toLowerCase().includes(faqQuery.trim().toLowerCase())), [faqQuery]);
  const filteredTickets = useMemo(() => tickets.filter((item) => `${item.id} ${item.subject} ${item.category} ${item.relatedName || ""}`.toLowerCase().includes(ticketSearch.trim().toLowerCase())), [tickets, ticketSearch]);
  const selectedCourse = COURSES.find((course) => course.id === form.relatedCourseId);
  const isTechnical = form.complaintType === "Technical / Website bug";
  const isLiveClass = form.complaintType === "Live class";
  const isCourseIssue = form.categoryId === "course" || form.complaintType === "Course issue";
  const isEducatorConcern = form.categoryId === "educator" || form.complaintType === "Educator / Teacher" || form.complaintType === "Inappropriate content / behaviour";

  function chooseCategory(categoryId, complaintType) {
    setSelectedCategory(categoryId);
    setForm({ ...newForm(categoryId), ...(complaintType ? { complaintType } : {}) });
    setFiles([]);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function updateForm(name, value) {
    setForm((current) => {
      if (name === "relatedCourseId") {
        const course = COURSES.find((item) => item.id === value);
        return { ...current, relatedCourseId: value, educatorId: course?.educatorId || current.educatorId };
      }
      return { ...current, [name]: value };
    });
  }

  function submitComplaint(event) {
    event.preventDefault();
    const id = `UL-${String(Math.floor(10000 + Math.random() * 90000))}`;
    const createdAt = new Date().toISOString();
    const category = CATEGORIES.find((item) => item.id === selectedCategory)?.title || "Other Complaint";
    const course = COURSES.find((item) => item.id === form.relatedCourseId);
    const next = {
      id, category, subject: form.subject.trim(), complaintType: form.complaintType,
      description: form.description.trim(), relatedCourseId: form.relatedCourseId,
      relatedCourse: course?.title || "", relatedEducator: EDUCATORS.find((item) => item.id === form.educatorId)?.name || "",
      relatedName: course?.title || EDUCATORS.find((item) => item.id === form.educatorId)?.name || "",
      where: form.where, createdAt, updatedAt: createdAt, status: "Submitted",
      details: { ...form }, attachments: files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
      messages: [],
    };
    const updated = [next, ...tickets];
    setTickets(updated);
    persistTickets(storageKey, updated);
    setSubmittedId(id);
    setSelectedCategory("");
  }

  function sendReply(event) {
    event.preventDefault();
    if (!reply.trim() && !replyFiles.length) return;
    const updated = tickets.map((item) => item.id === ticket.id ? {
      ...item,
      updatedAt: new Date().toISOString(),
      messages: [...(item.messages || []), { id: `m-${Date.now()}`, text: reply.trim(), createdAt: new Date().toISOString(), attachments: replyFiles.map((file) => file.name) }],
    } : item);
    setTickets(updated);
    persistTickets(storageKey, updated);
    setReply("");
    setReplyFiles([]);
  }

  if (ticketId) {
    if (!ticket) return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6"><p className="text-xs font-bold uppercase tracking-widest text-primary">Help & Complaints</p><h1 className="mt-2 font-display text-2xl font-bold text-text">We couldn’t find that complaint</h1><Link className="mt-4 inline-block text-sm font-semibold text-primary" to="/student/help-complaints">Back to Help Center</Link></div>;
    const steps = ["Complaint submitted", "Complaint received", "Under review", "Resolution"];
    const activeStep = ticket.status === "Submitted" ? 1 : ticket.status === "Under Review" || ticket.status === "Waiting for Information" ? 2 : ticket.status === "Resolved" || ticket.status === "Closed" ? 4 : 3;
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
        <button type="button" onClick={() => navigate("/student/help-complaints")} className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeftIcon className="h-4 w-4" />My Complaints</button>
        <div className="mt-5 rounded-3xl border border-text/10 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-text/10 pb-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Complaint #{ticket.id}</p><h1 className="mt-2 font-display text-2xl font-bold text-text">{ticket.subject}</h1><p className="mt-2 text-sm text-text/55">{ticket.category} · Submitted {dateLabel(ticket.createdAt)}</p></div>
            <StatusBadge status={statusVariant(ticket.status)}>{ticket.status}</StatusBadge>
          </div>
          <div className="grid gap-6 py-6 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wider text-text/40">Related course</p><p className="mt-1 text-sm text-text">{ticket.relatedCourse || "Not specified"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-text/40">Related educator</p><p className="mt-1 text-sm text-text">{ticket.relatedEducator || "Not specified"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-text/40">Where it happened</p><p className="mt-1 text-sm text-text">{ticket.where || "Not specified"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wider text-text/40">Last updated</p><p className="mt-1 text-sm text-text">{dateLabel(ticket.updatedAt)}</p></div></div>
              <div className="rounded-2xl bg-bg p-4"><p className="text-xs font-semibold uppercase tracking-wider text-text/45">Description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text/75">{ticket.description}</p></div>
              <div><h2 className="font-display text-lg font-semibold text-text">Attachments</h2>{ticket.attachments?.length ? <ul className="mt-3 flex flex-wrap gap-2">{ticket.attachments.map((file, i) => <li key={`${file.name}-${i}`} className="rounded-lg border border-text/10 bg-white px-3 py-2 text-xs text-text/65">{file.name}</li>)}</ul> : <p className="mt-2 text-sm text-text/45">No attachments</p>}</div>
            </div>
            <aside className="rounded-2xl border border-text/10 bg-[#fffaf7] p-4"><h2 className="font-display font-semibold text-text">Support timeline</h2><ol className="mt-4 space-y-4">{steps.map((step, index) => <li key={step} className="flex gap-3"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${index < activeStep ? "bg-success/15 text-success" : index === activeStep - 1 ? "bg-primary text-white" : "bg-text/5 text-text/35"}`}>{index < activeStep ? <CheckCircleIcon className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span><span className={`text-sm ${index < activeStep ? "font-medium text-text" : "text-text/45"}`}>{step}</span></li>)}</ol></aside>
          </div>
          <section className="border-t border-text/10 pt-6"><h2 className="font-display text-lg font-semibold text-text">Messages</h2><p className="mt-1 text-sm text-text/50">Keep any follow-up information for this report here.</p>
            {ticket.messages?.length > 0 && <div className="mt-4 space-y-3">{ticket.messages.map((message) => <article key={message.id} className="rounded-xl border border-text/10 bg-[#fcfbfa] p-4"><p className="text-sm leading-6 text-text/75">{message.text}</p>{message.attachments?.length > 0 && <p className="mt-2 text-xs text-text/45">Files: {message.attachments.join(", ")}</p>}<p className="mt-2 text-[11px] text-text/40">You · {dateLabel(message.createdAt)}</p></article>)}</div>}
            <form onSubmit={sendReply} className="mt-4 rounded-2xl bg-bg p-4"><label htmlFor="ticket-reply" className="text-xs font-semibold text-text/65">Add more information</label><textarea id="ticket-reply" value={reply} onChange={(event) => setReply(event.target.value)} rows={3} className={`${inputClass("mt-2 resize-y")} `} placeholder="Share additional details that may help us resolve this report." /><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-text/55"><UploadIcon className="h-4 w-4" />Attach a file<input type="file" multiple className="sr-only" onChange={(event) => setReplyFiles(Array.from(event.target.files || []))} /></label><Button fullWidth={false} type="submit">Send</Button></div>{replyFiles.length > 0 && <p className="mt-2 text-xs text-text/50">{replyFiles.map((file) => file.name).join(", ")}</p>}</form>
          </section>
        </div>
      </div>
    );
  }

  if (submittedId) return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e7f1ef] text-[#28756f]"><CheckCircleIcon className="h-9 w-9" /></span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Help & Complaints</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-text">Complaint submitted successfully</h1>
      <p className="mt-3 text-sm leading-6 text-text/60">Your complaint ID is <strong className="text-text">#{submittedId}</strong>. Your report has been received by the Universal Learning support team.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3"><Button fullWidth={false} onClick={() => navigate(`/student/help-complaints/${submittedId}`)}>View Complaint Status</Button><Button fullWidth={false} variant="secondary" onClick={() => setSubmittedId("")}>Back to Help Center</Button></div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <header className="rounded-3xl bg-[#4a0e0e] px-6 py-7 text-white shadow-[0_16px_40px_rgba(74,14,14,0.14)] sm:px-9 sm:py-9"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f0c2b2]">Student support center</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Help & Complaints</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Have an issue? Tell us what happened and we’ll help you get it resolved.</p></header>

      <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-text">How can we help?</h2><p className="mt-1 text-sm text-text/55">Choose the kind of support you need.</p></div><span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-text/50">We’ll keep your report private</span></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{CATEGORIES.map((category) => <button type="button" key={category.id} onClick={() => chooseCategory(category.id)} className={`group rounded-2xl border border-text/10 ${category.tint} p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md`}><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 font-display text-sm font-bold text-primary">{category.icon}</span><h3 className="mt-4 font-display text-base font-bold text-text">{category.title}</h3><p className="mt-2 text-xs leading-5 text-text/60">{category.description}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">Report an issue <span aria-hidden="true">→</span></span></button>)}</div>
      </section>

      <section className="mt-7 rounded-2xl border border-text/10 bg-white p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7f1ef] text-[#28756f]"><HelpCircleIcon className="h-5 w-5" /></span><div><h2 className="font-display text-lg font-bold text-text">Choose the right path</h2><p className="text-xs text-text/50">Questions and complaints go to different places.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/student/messages" className="rounded-xl border border-text/10 p-4 transition hover:border-primary/25 hover:bg-[#fffaf7]"><span className="text-xs font-bold uppercase tracking-wider text-[#28756f]">Ask a question</span><p className="mt-1 text-sm font-semibold text-text">Normal course questions</p><p className="mt-1 text-xs leading-5 text-text/50">Discuss course topics with educators and other learners.</p></Link>
          <button type="button" onClick={() => chooseCategory("course")} className="rounded-xl border border-text/10 p-4 text-left transition hover:border-primary/25 hover:bg-[#fffaf7]"><span className="text-xs font-bold uppercase tracking-wider text-primary">Report an issue</span><p className="mt-1 text-sm font-semibold text-text">Something isn’t working</p><p className="mt-1 text-xs leading-5 text-text/50">Flag bugs, incorrect content, or missing resources.</p></button>
          <button type="button" onClick={() => chooseCategory("educator", "Inappropriate content / behaviour")} className="rounded-xl border border-text/10 p-4 text-left transition hover:border-primary/25 hover:bg-[#fffaf7]"><span className="text-xs font-bold uppercase tracking-wider text-[#8b5e9c]">Report a concern</span><p className="mt-1 text-sm font-semibold text-text">Behaviour or safety concern</p><p className="mt-1 text-xs leading-5 text-text/50">Raise concerns about educator conduct or inappropriate content.</p></button>
          <button type="button" onClick={() => chooseCategory("technical")} className="rounded-xl border border-text/10 p-4 text-left transition hover:border-primary/25 hover:bg-[#fffaf7]"><span className="text-xs font-bold uppercase tracking-wider text-[#8a6a2a]">Contact support</span><p className="mt-1 text-sm font-semibold text-text">Account, payment, or platform help</p><p className="mt-1 text-xs leading-5 text-text/50">Send a ticket to the Universal Learning support team.</p></button>
        </div></section>

      <section className="mt-8 rounded-2xl border border-text/10 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Quick help</p><h2 className="mt-1 font-display text-xl font-bold text-text">Before you submit a complaint</h2><p className="mt-1 text-sm text-text/55">Search these quick answers for common issues.</p></div><label className="relative block w-full sm:w-72"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/35" /><input value={faqQuery} onChange={(event) => setFaqQuery(event.target.value)} placeholder="Search quick help" aria-label="Search quick help" className={inputClass("pl-9")} /></label></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filteredHelp.map(([title, answer]) => <details key={title} className="group rounded-xl border border-text/10 bg-[#fcfbfa] p-4"><summary className="cursor-pointer list-none text-sm font-semibold text-text">{title}<span className="float-right text-primary group-open:rotate-45">+</span></summary><p className="mt-3 text-xs leading-5 text-text/60">{answer}</p></details>)}{!filteredHelp.length && <p className="text-sm text-text/50">No quick answers found. Try a different search or submit a complaint.</p>}</div></section>

      {selectedCategory && <section ref={formRef} className="mt-8 scroll-mt-24 rounded-2xl border border-primary/15 bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Report an issue</p><h2 className="mt-1 font-display text-xl font-bold text-text">Tell us what happened</h2><p className="mt-1 text-sm text-text/55">The details help our team understand and resolve your report.</p></div><button type="button" onClick={() => setSelectedCategory("")} className="text-sm font-semibold text-text/45 hover:text-primary">Close</button></div>
        <form className="mt-6 space-y-5" onSubmit={submitComplaint}>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Complaint Type" required><select required value={form.complaintType} onChange={(event) => updateForm("complaintType", event.target.value)} className={inputClass()}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></Field><Field label="Where did this happen?"><select value={form.where} onChange={(event) => updateForm("where", event.target.value)} className={inputClass()}><option value="">Choose a page or area</option>{WHERE_OPTIONS.map((place) => <option key={place}>{place}</option>)}</select></Field>
            <Field label="Related Course"><select value={form.relatedCourseId} onChange={(event) => updateForm("relatedCourseId", event.target.value)} className={inputClass()}><option value="">No course / not applicable</option>{COURSES.filter((course) => course.enrolled).map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></Field><Field label="Related Educator"><select value={form.educatorId} onChange={(event) => updateForm("educatorId", event.target.value)} className={inputClass()}><option value="">Choose an educator</option>{EDUCATORS.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select>{selectedCourse && <span className="mt-1 block text-[11px] text-text/40">Filled from the selected course; you can change it.</span>}</Field>
            <Field label="Subject" required className="sm:col-span-2"><input required maxLength={120} value={form.subject} onChange={(event) => updateForm("subject", event.target.value)} className={inputClass()} placeholder="A short title for your complaint" /></Field><Field label="Description" required className="sm:col-span-2"><textarea required minLength={10} rows={5} value={form.description} onChange={(event) => updateForm("description", event.target.value)} className={inputClass("resize-y")} placeholder="Please describe the issue clearly. Include what happened, what you expected, and what went wrong." /></Field>
          </div>
          {isTechnical && <div className="rounded-xl bg-[#f4f0f8] p-4"><h3 className="text-sm font-bold text-text">Technical details</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><Field label="Device"><input value={form.device} onChange={(event) => updateForm("device", event.target.value)} className={inputClass()} placeholder="e.g. Windows laptop" /></Field><Field label="Browser"><input value={form.browser} onChange={(event) => updateForm("browser", event.target.value)} className={inputClass()} placeholder="e.g. Chrome" /></Field><Field label="Page / URL"><input value={form.pageUrl} onChange={(event) => updateForm("pageUrl", event.target.value)} className={inputClass()} placeholder="Where did this happen?" /></Field><Field label="Optional error message"><input value={form.errorMessage} onChange={(event) => updateForm("errorMessage", event.target.value)} className={inputClass()} placeholder="Paste any message shown" /></Field></div></div>}
          {isCourseIssue && <div className="rounded-xl bg-[#fffaf7] p-4"><h3 className="text-sm font-bold text-text">Course details</h3><div className="mt-3 grid gap-4 sm:grid-cols-3"><Field label="Chapter"><input value={form.chapter} onChange={(event) => updateForm("chapter", event.target.value)} className={inputClass()} placeholder="Chapter or module" /></Field><Field label="Lesson / video"><input value={form.lesson} onChange={(event) => updateForm("lesson", event.target.value)} className={inputClass()} placeholder="Lesson name" /></Field><Field label="Optional timestamp"><input value={form.timestamp} onChange={(event) => updateForm("timestamp", event.target.value)} className={inputClass()} placeholder="e.g. 04:32" /></Field></div></div>}
          {(isLiveClass || isEducatorConcern) && <div className="rounded-xl bg-[#eef7f4] p-4"><h3 className="text-sm font-bold text-text">Class / educator details</h3><div className="mt-3 grid gap-4 sm:grid-cols-3"><Field label="Class name"><input value={form.className} onChange={(event) => updateForm("className", event.target.value)} className={inputClass()} placeholder="Live class or course" /></Field><Field label="Date / time"><input type="datetime-local" value={form.classDate} onChange={(event) => updateForm("classDate", event.target.value)} className={inputClass()} /></Field><Field label="Optional timestamp"><input value={form.timestamp} onChange={(event) => updateForm("timestamp", event.target.value)} className={inputClass()} placeholder="e.g. 04:32" /></Field></div></div>}
          <Field label="Attachments (screenshots, images, or files)"><div className="rounded-xl border border-dashed border-text/20 bg-[#fcfbfa] p-4"><label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary"><UploadIcon className="h-4 w-4" />Choose files<input type="file" multiple accept="image/*,.pdf,.doc,.docx,.txt" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files || []))} /></label><span className="ml-3 text-xs text-text/40">Optional</span>{files.length > 0 && <ul className="mt-3 space-y-1">{files.map((file) => <li key={`${file.name}-${file.lastModified}`} className="text-xs text-text/60">{file.name} · {(file.size / 1024).toFixed(0)} KB</li>)}</ul>}</div></Field>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-text/10 pt-5"><p className="max-w-xl text-xs leading-5 text-text/45">Reports about behaviour or inappropriate content are handled discreetly. Please don’t include passwords or payment card details.</p><Button fullWidth={false} type="submit">Submit Complaint</Button></div>
        </form>
      </section>}

      <section className="mt-8 rounded-2xl border border-text/10 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Your support history</p><h2 className="mt-1 font-display text-xl font-bold text-text">My Complaints</h2><p className="mt-1 text-sm text-text/55">Review updates or add information to an existing ticket.</p></div>{tickets.length > 0 && <label className="relative block w-full sm:w-64"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/35" /><input value={ticketSearch} onChange={(event) => setTicketSearch(event.target.value)} placeholder="Search my complaints" className={inputClass("pl-9")} /></label>}</div>
        {filteredTickets.length ? <div className="mt-4 divide-y divide-text/10">{filteredTickets.map((item) => <article key={item.id} className="flex flex-col gap-3 py-4 first:pt-2 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-text/50">{item.id}</span><StatusBadge status={statusVariant(item.status)}>{item.status}</StatusBadge></div><h3 className="mt-1 font-semibold text-text">{item.subject}</h3><p className="mt-1 text-xs text-text/50">{item.category}{item.relatedName ? ` · ${item.relatedName}` : ""} · Submitted {dateLabel(item.createdAt)}</p><p className="mt-1 text-[11px] text-text/40">Last updated {dateLabel(item.updatedAt)}</p></div><Button fullWidth={false} variant="secondary" onClick={() => navigate(`/student/help-complaints/${item.id}`)}>View Details</Button></article>)}</div> : <div className="mt-4 rounded-xl border border-dashed border-text/15 bg-[#fcfbfa] px-5 py-8 text-center"><p className="font-semibold text-text">No complaints yet</p><p className="mt-1 text-sm text-text/50">Your submitted reports and their updates will appear here.</p></div>}
      </section>
    </div>
  );
}
