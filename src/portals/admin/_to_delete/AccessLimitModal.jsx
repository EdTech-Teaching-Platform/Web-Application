// Monthly access limit: how many test series one student can access per calendar month.
import { useState } from "react";
import { Modal } from "./discounts/DiscountsShared";
import { useAccessPolicy, setAccessPolicy } from "../data/testSeriesMock";

function LimitBox({ title, hint, value, onChange }) {
  const unlimited = value === null;
  return (
    <div className="ul-limit-box">
      <h4>{title}</h4>
      <small>{hint}</small>
      <label className="ul-limit-check">
        <input type="checkbox" checked={unlimited} onChange={(e) => onChange(e.target.checked ? null : 3)} /> Unlimited
      </label>
      {!unlimited && (
        <div className="ul-ts-form-row">
          <label>Series per student per month</label>
          <input type="number" min="1" step="1" value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
      )}
    </div>
  );
}

export default function AccessLimitModal({ onClose, onSaved }) {
  const policy = useAccessPolicy();
  const [free, setFree] = useState(policy.freePerMonth);
  const [paid, setPaid] = useState(policy.paidPerMonth);
  const bad = (v) => v !== null && !(Number(v) >= 1);
  const invalid = bad(free) || bad(paid);
  const save = () => { setAccessPolicy({ freePerMonth: free, paidPerMonth: paid }); onSaved("Monthly access limit saved."); onClose(); };
  return (
    <Modal
      title="Monthly access limit"
      subtitle="Test Series"
      onClose={onClose}
      footer={<>
        {invalid && <span className="ul-tsw-hint">Enter a limit of 1 or more.</span>}
        <button type="button" className="ul-btn ul-btn--ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="ul-btn ul-btn--primary" disabled={invalid} onClick={save}>Save limit</button>
      </>}
    >
      <p style={{ marginTop: 0 }}>Set how many different test series a student can start or unlock in one calendar month. The count resets on the 1st of every month. Series a student already unlocked stay available.</p>
      <div className="ul-limit-grid">
        <LimitBox title="Free series" hint="Applies to free test series." value={free} onChange={setFree} />
        <LimitBox title="Paid series" hint="Applies to purchased test series." value={paid} onChange={setPaid} />
      </div>
    </Modal>
  );
}
