// Create / edit a discount campaign. Validation and the preview both use the
// same functions as redemption (validateCampaignInput / computeDiscount).
import { useMemo, useState } from "react";
import { useStudents } from "../../data/studentsMock";
import {
  useDiscountState, DISCOUNT_TYPES, KINDS, SCOPES, SCOPE_OPTIONS, getCatalog, computeDiscount, validateCampaignInput,
  createCampaign, updateCampaign, generateCode, redeemedCount, inr, studentRegion,
} from "../../data/discountsMock";
import { PageHeader, DLink, useDiscountNavigate, useDiscountSearchParams, setFlash, useActor, useToast, toLocalInput } from "./DiscountsShared";

const blank = () => ({
  name: "", description: "", kind: "standard", codeMode: "shared", code: "", prefix: "UL", type: "percent", value: "",
  minPurchase: "", maxDiscount: "", minPrice: "", maxPrice: "", scope: "all_test_series", productIds: [], comboProducts: [],
  startAt: toLocalInput(new Date().toISOString()), endAt: toLocalInput(new Date(Date.now() + 30 * 86400000).toISOString()),
  totalLimit: "", perStudentLimit: "1", firstPurchaseOnly: false, stackable: false,
  audience: { mode: "public", studentIds: [], group: null }, eligibility: { regions: [], grades: [] },
});

const fromCampaign = (c) => ({
  ...c,
  value: c.value ?? "", minPurchase: c.minPurchase ?? "", maxDiscount: c.maxDiscount ?? "", minPrice: c.minPrice ?? "", maxPrice: c.maxPrice ?? "",
  totalLimit: c.totalLimit ?? "", perStudentLimit: String(c.perStudentLimit ?? 1), startAt: toLocalInput(c.startAt), endAt: toLocalInput(c.endAt),
});

function Field({ label, error, hint, children, show }) {
  return (
    <div className={`ul-dsc-field${error && show ? " has-error" : ""}`}>
      <label>{label}</label>
      {children}
      {error && show ? <p className="ul-dsc-err">{error}</p> : hint ? <p className="ul-dsc-hint">{hint}</p> : null}
    </div>
  );
}

export default function CreateDiscount() {
  const [params] = useDiscountSearchParams();
  const id = params.get("edit");
  const navigate = useDiscountNavigate();
  const actor = useActor();
  const st = useDiscountState();
  const students = useStudents();
  const [, setToast, toastEl] = useToast();
  const existing = id ? st.campaigns.find((c) => c.id === id) : null;
  const locked = existing ? redeemedCount(st, existing.id) > 0 : false;

  const [form, setForm] = useState(() => (existing ? fromCampaign(existing) : blank()));
  const [dirty, setDirty] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErr, setServerErr] = useState("");
  const [sample, setSample] = useState("");
  const [studentQ, setStudentQ] = useState("");

  const catalog = getCatalog();
  const courses = catalog.filter((x) => x.type === "course");
  const series = catalog.filter((x) => x.type === "test_series");
  const regions = useMemo(() => [...new Set(students.map(studentRegion).filter(Boolean))].sort(), [students]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setDirty((d) => ({ ...d, [k]: true })); setServerErr(""); };
  const toIso = (v) => (v ? new Date(v).toISOString() : "");
  const payload = { ...form, startAt: toIso(form.startAt), endAt: toIso(form.endAt) };
  const errors = validateCampaignInput(payload, { existingId: existing?.id, campaigns: st.campaigns });
  const show = (k) => submitted || dirty[k];

  if (id && !existing) {
    return (<div><PageHeader title="Discount not found" /><DLink to="/admin/discounts" className="ul-btn ul-btn--ghost">Back</DLink></div>);
  }
  if (!actor.can(existing ? "edit" : "create")) {
    return (<div><PageHeader title="Create discount" subtitle="Your role can view discounts but not change them." /></div>);
  }

  const togglePid = (pid) => set("productIds", form.productIds.includes(pid) ? form.productIds.filter((x) => x !== pid) : [...form.productIds, pid]);
  const toggleCombo = (item) => {
    const has = form.comboProducts.some((p) => p.type === item.type && p.id === item.id);
    set("comboProducts", has ? form.comboProducts.filter((p) => !(p.type === item.type && p.id === item.id)) : [...form.comboProducts, { type: item.type, id: item.id }]);
  };
  const toggleIn = (path, v) => {
    const arr = form.eligibility[path];
    set("eligibility", { ...form.eligibility, [path]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] });
  };

  // preview
  const probe = { ...form, value: Number(form.value) || 0, minPurchase: form.minPurchase === "" ? null : Number(form.minPurchase), maxDiscount: form.type === "percent" && form.maxDiscount !== "" ? Number(form.maxDiscount) : null, minPrice: form.minPrice === "" ? null : Number(form.minPrice), maxPrice: form.maxPrice === "" ? null : Number(form.maxPrice) };
  const sampleRows = [];
  if (form.kind === "combo") {
    const items = form.comboProducts.map((p) => catalog.find((x) => x.type === p.type && x.id === p.id)).filter(Boolean);
    if (items.length >= 2) { const r = computeDiscount(probe, items); sampleRows.push({ name: `Combo (${items.length} items)`, price: items.reduce((a, i) => a + i.price, 0), calc: r }); }
  } else {
    catalog.forEach((it) => { const r = computeDiscount(probe, [it]); if (r.ok || r.eligible?.length) sampleRows.push({ name: it.name, price: it.price, calc: r }); });
  }
  if (sample !== "" && Number(sample) > 0) {
    const r = computeDiscount({ ...probe, kind: "standard", scope: "all_test_series" }, [{ type: "test_series", id: "sample", name: "Sample price", price: Number(sample) }]);
    sampleRows.unshift({ name: "Your sample price", price: Number(sample), calc: r });
  }

  const submit = (asDraft) => {
    setSubmitted(true);
    const res = existing ? updateCampaign(existing.id, payload, actor) : createCampaign(payload, actor, { asDraft });
    if (!res.ok) { setServerErr(res.error || ""); return; }
    setToast(existing ? "Changes saved." : asDraft ? "Saved as draft." : "Discount created and activated.");
    setFlash(existing ? `${res.campaign.name} updated.` : `${res.campaign.name} ${asDraft ? "saved as a draft" : "created and activated"}.`);
    navigate("/admin/discounts");
  };

  const matches = studentQ.trim()
    ? students.filter((s) => `${s.name} ${s.email} ${s.id}`.toLowerCase().includes(studentQ.trim().toLowerCase())).slice(0, 6)
    : [];

  return (
    <div>
      <PageHeader title={existing ? `Edit ${existing.name}` : "Create discount"} subtitle="Configure the offer, who it's for and when it runs." />
      {locked && <div className="ul-dsc-result is-ok" style={{ marginBottom: 12 }}>This discount already has redemptions. Past purchases keep the terms they were bought under; your changes only apply from now on.</div>}

      <div className="ul-dsc-form">
        <div>
          <div className="ul-card ul-dsc-section">
            <h3>Basics</h3>
            <Field label="Discount name *" error={errors.name} show={show("name")}>
              <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Diwali Learning Sale" />
            </Field>
            <Field label="Description"><textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
            <div className="ul-dsc-row">
              <Field label="Offer type" hint={form.kind === "flash" ? "Flash sales must end within 7 days." : form.kind === "referral" ? "Each referring student gets their own code." : form.kind === "combo" ? "Applies when every combo item is in the cart." : undefined}>
                <select value={form.kind} disabled={!!existing} onChange={(e) => { const k = e.target.value; setForm((f) => ({ ...f, kind: k, codeMode: k === "referral" ? "unique" : f.codeMode })); }}>
                  {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Coupon codes" error={errors.codeMode} show hint={form.codeMode === "unique" ? "One-time codes: per student or in bulk." : "One shared code anyone eligible can use."}>
                <div className="ul-dsc-seg">
                  <button type="button" className={form.codeMode === "shared" ? "is-on" : ""} disabled={!!existing || form.kind === "referral"} onClick={() => set("codeMode", "shared")}>Shared code</button>
                  <button type="button" className={form.codeMode === "unique" ? "is-on" : ""} disabled={!!existing} onClick={() => set("codeMode", "unique")}>Unique codes</button>
                </div>
              </Field>
            </div>
            {form.codeMode === "shared" ? (
              <Field label="Coupon code *" error={errors.code} show={show("code")}>
                <div className="ul-dsc-inline">
                  <input type="text" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="e.g. DIWALI20" disabled={locked} />
                  {!locked && <button type="button" className="ul-btn ul-btn--ghost" onClick={() => set("code", generateCode("UL"))}>Generate</button>}
                </div>
              </Field>
            ) : (
              <Field label="Code prefix *" error={errors.prefix} show={show("prefix")} hint="Generated codes look like PREFIX-AB12CD. Create them from Student Targeting or Coupon Management.">
                <input type="text" value={form.prefix} onChange={(e) => set("prefix", e.target.value.toUpperCase())} />
              </Field>
            )}
          </div>

          <div className="ul-card ul-dsc-section">
            <h3>Discount</h3>
            <div className="ul-dsc-row is-3">
              <Field label="Discount type">
                <select value={form.type} onChange={(e) => set("type", e.target.value)}>
                  {Object.entries(DISCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label={form.type === "percent" ? "Percentage *" : "Amount (₹) *"} error={errors.value} show={show("value")}>
                <input type="number" min="0" value={form.value} onChange={(e) => set("value", e.target.value)} />
              </Field>
              {form.type === "percent" && (
                <Field label="Maximum discount cap (₹)" error={errors.maxDiscount} show={show("maxDiscount")} hint="Optional">
                  <input type="number" min="0" value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} />
                </Field>
              )}
            </div>
            <div className="ul-dsc-row is-3">
              <Field label="Minimum purchase (₹)" error={errors.minPurchase} show={show("minPurchase")}><input type="number" min="0" value={form.minPurchase} onChange={(e) => set("minPurchase", e.target.value)} /></Field>
              <Field label="Min eligible product price (₹)" error={errors.minPrice} show={show("minPrice")}><input type="number" min="0" value={form.minPrice} onChange={(e) => set("minPrice", e.target.value)} /></Field>
              <Field label="Max eligible product price (₹)" error={errors.maxPrice} show={show("maxPrice")}><input type="number" min="0" value={form.maxPrice} onChange={(e) => set("maxPrice", e.target.value)} /></Field>
            </div>
          </div>

          <div className="ul-card ul-dsc-section">
            <h3>Applies to</h3>
            {form.kind === "combo" ? (
              <Field label="Combo items * (at least two)" error={errors.comboProducts} show={show("comboProducts")}>
                <div className="ul-dsc-pick">
                  {catalog.length === 0 && <p className="ul-dsc-empty">No published paid test series yet.</p>}
                  {catalog.map((it) => (
                    <label key={it.type + it.id} className="ul-dsc-check"><input type="checkbox" checked={form.comboProducts.some((p) => p.type === it.type && p.id === it.id)} onChange={() => toggleCombo(it)} />{it.name} <span className="ul-dsc-sub">({it.type === "course" ? "Course" : "Test series"} · {inr(it.price)})</span></label>
                  ))}
                </div>
              </Field>
            ) : (
              <>
                <Field label="Products">
                  <select value={form.scope} onChange={(e) => { set("scope", e.target.value); set("productIds", []); }}>
                    {Object.entries(SCOPE_OPTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                {(form.scope === "selected_courses" || form.scope === "selected_test_series") && (
                  <Field label={form.scope === "selected_courses" ? "Select courses *" : "Select test series *"} error={errors.productIds} show={show("productIds") || show("scope")}>
                    <div className="ul-dsc-pick">
                      {(form.scope === "selected_courses" ? courses : series).length === 0 && <p className="ul-dsc-empty">Nothing priced and published to choose from yet.</p>}
                      {(form.scope === "selected_courses" ? courses : series).map((it) => (
                        <label key={it.id} className="ul-dsc-check"><input type="checkbox" checked={form.productIds.includes(it.id)} onChange={() => togglePid(it.id)} />{it.name} <span className="ul-dsc-sub">({inr(it.price)})</span></label>
                      ))}
                    </div>
                  </Field>
                )}
              </>
            )}
          </div>

          <div className="ul-card ul-dsc-section">
            <h3>Schedule &amp; limits</h3>
            <div className="ul-dsc-row">
              <Field label="Starts *" error={errors.startAt} show={show("startAt")}><input type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} /></Field>
              <Field label="Expires *" error={errors.endAt} show={show("endAt")}><input type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} /></Field>
            </div>
            <div className="ul-dsc-row">
              <Field label="Total redemption limit" error={errors.totalLimit} show={show("totalLimit")} hint="Leave blank for no limit"><input type="number" min="1" value={form.totalLimit} onChange={(e) => set("totalLimit", e.target.value)} /></Field>
              <Field label="Per-student limit *" error={errors.perStudentLimit} show={show("perStudentLimit")}><input type="number" min="1" value={form.perStudentLimit} onChange={(e) => set("perStudentLimit", e.target.value)} /></Field>
            </div>
            <p className="ul-dsc-hint">A future start date means the discount is "Scheduled" once activated and goes live (and expires) automatically.</p>
          </div>

          <div className="ul-card ul-dsc-section">
            <h3>Who can use it</h3>
            <Field label="Audience">
              <select value={form.audience.mode} onChange={(e) => set("audience", { mode: e.target.value, studentIds: [], group: form.audience.group })}>
                <option value="public">Public — anyone with the code</option>
                <option value="students">Exclusive — selected students only</option>
                <option value="group" disabled>Group (set up in Student Targeting)</option>
              </select>
            </Field>
            {form.audience.mode === "students" && (
              <Field label="Exclusive students *" error={errors.audience} show={show("audience") || submitted}>
                <input type="text" placeholder="Search by name, email or ID…" value={studentQ} onChange={(e) => setStudentQ(e.target.value)} />
                {matches.map((s) => (
                  <label key={s.id} className="ul-dsc-check"><input type="checkbox" checked={form.audience.studentIds.includes(s.id)} onChange={() => set("audience", { ...form.audience, studentIds: form.audience.studentIds.includes(s.id) ? form.audience.studentIds.filter((x) => x !== s.id) : [...form.audience.studentIds, s.id] })} />{s.name} <span className="ul-dsc-sub">{s.id} · {s.email}</span></label>
                ))}
                <p className="ul-dsc-hint">{form.audience.studentIds.length} selected</p>
              </Field>
            )}
            {form.audience.mode === "group" && <p className="ul-dsc-hint">Group rule: {Object.keys(form.audience.group || {}).length ? "saved from Student Targeting" : "none"}.</p>}
            <label className="ul-dsc-check"><input type="checkbox" checked={form.firstPurchaseOnly} onChange={(e) => set("firstPurchaseOnly", e.target.checked)} /><span><strong>First purchase only</strong> — students who already bought something can't use it.</span></label>
            <label className="ul-dsc-check"><input type="checkbox" checked={form.stackable} onChange={(e) => set("stackable", e.target.checked)} /><span><strong>Can be combined</strong> with other stackable coupons in the same purchase.</span></label>
            {regions.length > 0 && (
              <Field label="Restrict to regions (optional)">
                <div className="ul-dsc-pick">{regions.map((r) => <label key={r} className="ul-dsc-check"><input type="checkbox" checked={form.eligibility.regions.includes(r)} onChange={() => toggleIn("regions", r)} />{r}</label>)}</div>
              </Field>
            )}
          </div>

          {serverErr && <p className="ul-rh-error">{serverErr}</p>}
          <div className="ul-dsc-formbar">
            {!existing && <button type="button" className="ul-btn ul-btn--ghost" onClick={() => submit(true)}>Save as draft</button>}
            <button type="button" className="ul-btn ul-btn--primary" onClick={() => submit(false)}>{existing ? "Save changes" : "Create & activate"}</button>
          </div>
        </div>

        <aside className="ul-card ul-dsc-preview">
          <h3>Preview</h3>
          <p className="ul-dsc-hint">What students would pay, using the real discount rules.</p>
          <div className="ul-dsc-field" style={{ marginTop: 10 }}>
            <label>Try a sample price (₹)</label>
            <input type="number" min="0" value={sample} onChange={(e) => setSample(e.target.value)} placeholder="e.g. 1999" />
          </div>
          {sampleRows.length === 0 ? <p className="ul-dsc-empty">No catalog item is eligible with the current settings.</p> : (
            <table>
              <thead><tr><th>Item</th><th className="num">Price</th><th className="num">Pay</th></tr></thead>
              <tbody>
                {sampleRows.slice(0, 7).map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}{!r.calc.ok && <span className="ul-dsc-sub">{r.calc.reason}</span>}</td>
                    <td className="num">{inr(r.price)}</td>
                    <td className="num ul-dsc-final">{inr(r.calc.ok ? r.price - r.calc.discount : r.price)}{r.calc.ok && <span className="ul-dsc-sub">−{inr(r.calc.discount)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </aside>
      </div>
      {toastEl}
    </div>
  );
}
