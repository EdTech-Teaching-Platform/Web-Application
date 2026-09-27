// Admin FAQs / Internal Knowledge Base
// Its own section — split out from Support Request / Help Desk so it has
// a dedicated place in the nav rather than living behind a tab there.
//
// An internal admin knowledge base, not a customer-facing help page —
// SOP-style guidance for handling tickets, refunds, approvals and
// compliance, grounded in this platform's actual governance rules and
// the other Admin screens already built. Search + category-chip filter
// over a grouped, collapsible accordion. Reached from AdminSidebar's
// "FAQs" link and AdminTopbar's FAQs shortcut.
//
// Reuses .ul-card/.ul-card__head/.ul-card__eyebrow from AdminDashboard.css
// and .ul-set-search/.ul-usr-search__clear/.ul-set-role-chip/.ul-set-empty
// from SettingsPermissions.css/UserManagement.css — page-specific layout
// only lives in FaqKnowledgeBase.css (.ul-faq-*).

import { useMemo, useState } from "react";
import { FAQ_CATEGORIES, FAQS } from "../data/faqMock";
import { IconHelp, IconSearch, IconClose, IconChevronDown } from "../components/icons";
import "./AdminDashboard.css";
import "./SettingsPermissions.css";
import "./UserManagement.css";
import "./FaqKnowledgeBase.css";

function FaqAccordionItem({ faq, open, onToggle }) {
  return (
    <div className={`ul-faq-item${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="ul-faq-question"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{faq.question}</span>
        <span className="ul-faq-chevron">
          <IconChevronDown size={15} color="var(--color-text-muted)" />
        </span>
      </button>
      {open && <p className="ul-faq-answer">{faq.answer}</p>}
    </div>
  );
}

export default function FaqKnowledgeBase() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState(FAQS[0]?.id || null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (q && !`${f.question} ${f.answer}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, category]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((f) => {
      if (!map.has(f.category)) map.set(f.category, []);
      map.get(f.category).push(f);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="ul-faq-page">
      <section className="ul-card ul-faq-hero">
        <span className="ul-card__eyebrow"><IconHelp size={13} /> Admin Knowledge Base</span>
        <h3 className="ul-faq-hero__title">Frequently Asked Questions</h3>
        <p className="ul-faq-hero__subtitle">
          Internal SOP guidance for handling tickets, refunds, approvals and compliance — not the public-facing
          Help Center. Use this to check your own limits and next step before you act on a ticket.
        </p>

        <label className="ul-set-search ul-faq-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search FAQs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="ul-usr-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <div className="ul-faq-chips">
          <button
            type="button"
            className={`ul-set-role-chip${category === "all" ? " is-active" : ""}`}
            onClick={() => setCategory("all")}
          >
            All topics
          </button>
          {FAQ_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`ul-set-role-chip${category === c ? " is-active" : ""}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {grouped.length === 0 ? (
        <div className="ul-card"><div className="ul-set-empty">No FAQs match your search.</div></div>
      ) : (
        grouped.map(([groupCategory, items]) => (
          <section className="ul-card ul-faq-group" key={groupCategory}>
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">{items.length} {items.length === 1 ? "question" : "questions"}</span>
              <h3>{groupCategory}</h3>
            </div>
            <div className="ul-faq-list">
              {items.map((faq) => (
                <FaqAccordionItem
                  key={faq.id}
                  faq={faq}
                  open={openId === faq.id}
                  onToggle={() => setOpenId(openId === faq.id ? null : faq.id)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
