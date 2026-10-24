import { useState } from "react";
import { useRpc } from "../../hooks/useRpc";
import { discountsApi } from "../../services/discountsApi";
import { PageHeader, useDiscountNavigate, useDiscountSearchParams } from "./DiscountsShared";

export default function CreateDiscount() {
  const [params] = useDiscountSearchParams(); const id = params.get("edit"); const navigate = useDiscountNavigate();
  const detail = useRpc(() => discountsApi.get(id), { immediate: !!id });
  const [form, setForm] = useState({ name: "", couponCode: "", offerType: "percentage", value: "", description: "", scope: "all_test_series", startsAt: "", expiresAt: "", usageLimit: "", perUserLimit: 1 });
  const [error, setError] = useState("");
  const save = async (activate) => { setError(""); try { if (id) await discountsApi.update(id, { name: form.name, coupon_code: form.couponCode, offer_type: form.offerType, value: Number(form.value), description: form.description, scope: form.scope, starts_at: form.startsAt || null, expires_at: form.expiresAt || null, usage_limit: form.usageLimit ? Number(form.usageLimit) : null, per_user_limit: Number(form.perUserLimit) }); else await discountsApi.create({ ...form, value: Number(form.value), activate }); navigate("/admin/discounts"); } catch (e) { setError(e.message); } };
  if (id && detail.loading) return <div className="ul-edu-empty">Loading discount…</div>;
  return <div><PageHeader title={id ? "Edit discount" : "Create discount"} subtitle="Only fields supported by the discount RPC are submitted." />
    <div className="ul-card ul-dsc-form"><label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Coupon code<input value={form.couponCode} onChange={(e) => setForm({ ...form, couponCode: e.target.value })} /></label><label>Offer type<select value={form.offerType} onChange={(e) => setForm({ ...form, offerType: e.target.value })}><option value="percentage">Percentage</option><option value="fixed">Fixed</option></select></label><label>Value<input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></label><label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>{error && <p className="ul-dsc-err">{error}</p>}<button className="ul-btn ul-btn--primary" onClick={() => save(true)}>Save</button><button className="ul-btn ul-btn--ghost" onClick={() => save(false)}>Save as inactive</button></div>
  </div>;
}
