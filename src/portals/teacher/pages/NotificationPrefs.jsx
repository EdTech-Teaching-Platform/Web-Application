// Notification Preferences — what THIS educator receives, and how.
// Deepens the "delivery respects each student's own channel preferences"
// concept already referenced in Announcements/Messaging into an actual
// settings screen, using the exact same Switch and AutoSaveIndicator
// components those screens (and Content Upload, Course Builder) already
// established, rather than a new settings-specific toggle.
import { useEffect, useMemo, useRef, useState } from "react";
import Switch from "../../../components/ui/Switch";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import AutoSaveIndicator from "../../../components/ui/AutoSaveIndicator";
import {
  BellIcon,
  UsersIcon,
  CertificateIcon,
  VideoIcon,
  BookIcon,
  WalletIcon,
  MegaphoneIcon,
  MoonIcon,
  AlertTriangleIcon,
  XIcon,
  ClockIcon,
} from "../../../components/ui/icons";
import { CHANNELS, CATEGORIES, buildRecommendedDefaults, buildRecommendedDigest, RECOMMENDED_QUIET_HOURS } from "../data/notificationPrefsData";
import { useNotificationPrefs } from "../data/notificationPrefsStore";
import Select from "../../../components/ui/Select";
import IconBadge from "../../../components/ui/IconBadge";

// Exported: the header notification bell uses the same icon + tone per category.
export const CATEGORY_ICON = {
  studentActivity: UsersIcon,
  assessments: CertificateIcon,
  bookings: VideoIcon,
  publishing: BookIcon,
  earnings: WalletIcon,
  platform: MegaphoneIcon,
};

// Per-category pastel tone for the IconBadge beside each section heading.
export const CATEGORY_TONE = {
  studentActivity: "blue",
  assessments: "lavender",
  bookings: "orange",
  publishing: "sage",
  earnings: "maroon",
  platform: "pink",
};

const DIGEST_OPTIONS = [
  { key: "realtime", label: "Real-time" },
  { key: "daily", label: "Daily digest" },
  { key: "weekly", label: "Weekly digest" },
];

function allValues(prefs) {
  const values = [];
  CATEGORIES.forEach((cat) => cat.items.forEach((item) => CHANNELS.forEach((ch) => values.push(prefs[cat.key][item.key][ch.key]))));
  return values;
}

export default function NotificationPrefs() {
  // Shared + persisted, so the header bell shows only what is switched on here.
  const [prefs, setPrefs] = useNotificationPrefs();
  const [digest, setDigest] = useState(buildRecommendedDigest);
  const [quietHours, setQuietHours] = useState(RECOMMENDED_QUIET_HOURS);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [criticalWarning, setCriticalWarning] = useState(null);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [savedAt, setSavedAt] = useState("just now");
  const saveTimer = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaveStatus("saved");
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [prefs, digest, quietHours]);

  const allOn = useMemo(() => allValues(prefs).every(Boolean), [prefs]);
  const allOff = useMemo(() => allValues(prefs).every((v) => !v), [prefs]);

  const channelMasterOn = useMemo(() => {
    const state = {};
    CHANNELS.forEach((ch) => {
      state[ch.key] = CATEGORIES.every((cat) => cat.items.every((item) => prefs[cat.key][item.key][ch.key]));
    });
    return state;
  }, [prefs]);

  function setAll(value) {
    setPrefs((prev) => {
      const next = {};
      CATEGORIES.forEach((cat) => {
        next[cat.key] = {};
        cat.items.forEach((item) => {
          next[cat.key][item.key] = {};
          CHANNELS.forEach((ch) => {
            next[cat.key][item.key][ch.key] = value;
          });
        });
      });
      return next;
    });
  }

  function toggleChannelMaster(channelKey, value) {
    setPrefs((prev) => {
      const next = { ...prev };
      CATEGORIES.forEach((cat) => {
        next[cat.key] = { ...next[cat.key] };
        cat.items.forEach((item) => {
          next[cat.key][item.key] = { ...next[cat.key][item.key], [channelKey]: value };
        });
      });
      return next;
    });
  }

  function toggleItem(categoryKey, itemKey, channelKey, value) {
    setPrefs((prev) => ({
      ...prev,
      [categoryKey]: {
        ...prev[categoryKey],
        [itemKey]: { ...prev[categoryKey][itemKey], [channelKey]: value },
      },
    }));
  }

  function toggleCategoryMaster(category, channelKey, value) {
    if (category.critical && !value) {
      setCriticalWarning({ category, channelKey });
      return;
    }
    applyCategoryMaster(category.key, channelKey, value);
  }

  function applyCategoryMaster(categoryKey, channelKey, value) {
    setPrefs((prev) => {
      const category = CATEGORIES.find((c) => c.key === categoryKey);
      const nextCat = { ...prev[categoryKey] };
      category.items.forEach((item) => {
        nextCat[item.key] = { ...nextCat[item.key], [channelKey]: value };
      });
      return { ...prev, [categoryKey]: nextCat };
    });
  }

  function categoryMasterState(category, channelKey) {
    return category.items.every((item) => prefs[category.key][item.key][channelKey]);
  }

  function resetToDefaults() {
    setPrefs(buildRecommendedDefaults());
    setDigest(buildRecommendedDigest());
    setQuietHours(RECOMMENDED_QUIET_HOURS);
    setResetOpen(false);
  }

  return (
    <div className="pb-16">
      <div className="flex flex-col gap-4 border-b border-text/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1.5">Settings</div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Notification Preferences</h1>
          <p className="mt-1.5 text-sm text-muted">Choose what you hear about, and how — this only controls notifications you receive.</p>
        </div>
        <AutoSaveIndicator status={saveStatus} timestamp={savedAt} />
      </div>

      {!bannerDismissed && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-primary/[0.06] p-4">
          <BellIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-sm text-primary">
            We've turned on a recommended set of defaults for you below — toggle anything on or off, it saves automatically as you go.
          </p>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-primary/50 hover:bg-primary/10 hover:text-primary"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 rounded-3xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" fullWidth={false} disabled={allOn} className="px-4 py-2 text-xs" onClick={() => setAll(true)}>
            Enable All
          </Button>
          <Button variant="secondary" fullWidth={false} disabled={allOff} className="px-4 py-2 text-xs" onClick={() => setAll(false)}>
            Disable All
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-4 py-2 text-xs" onClick={() => setResetOpen(true)}>
            Reset to Recommended Defaults
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-muted">
          <span className="hidden sm:inline">Master per channel:</span>
          {CHANNELS.map((ch) => (
            <label key={ch.key} className="flex items-center gap-1.5">
              <Switch checked={channelMasterOn[ch.key]} onChange={(v) => toggleChannelMaster(ch.key, v)} />
              {ch.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-5">
        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICON[cat.key] || BellIcon;
          return (
            <section key={cat.key} className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <IconBadge tone={CATEGORY_TONE[cat.key] || "maroon"} size="sm">
                    <Icon className="h-4 w-4" />
                  </IconBadge>
                  <div>
                    <h2 className="text-sm font-bold text-text">{cat.label}</h2>
                    <p className="mt-0.5 max-w-md text-xs text-muted">{cat.description}</p>
                  </div>
                </div>
                {cat.digest && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted">Delivery</span>
                    <Select
                      value={digest[cat.key]}
                      onChange={(e) => setDigest((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                      className="rounded-full border border-text/15 bg-bg px-3 py-1.5 pr-7 text-xs font-semibold text-text outline-none focus:border-primary"
                      chevronClassName="right-2.5 h-3.5 w-3.5"
                    >
                      {DIGEST_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              {cat.critical && (
                <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-warning/[0.08] px-3 py-2 text-xs text-warning">
                  <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  We recommend keeping {cat.label} notifications on so you don't miss a session.
                </p>
              )}

              {/* Desktop matrix */}
              <div className="mt-4 hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[520px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-text/[0.07] text-xs font-semibold uppercase tracking-wide text-muted">
                      <th className="py-2">Notification</th>
                      {CHANNELS.map((ch) => (
                        <th key={ch.key} className="py-2 text-center">
                          {ch.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-text/[0.06]">
                    <tr className="bg-bg/50">
                      <td className="py-2.5 text-xs font-semibold text-muted">All {cat.label.toLowerCase()}</td>
                      {CHANNELS.map((ch) => (
                        <td key={ch.key} className="py-2.5 text-center">
                          <span className="inline-flex">
                            <Switch checked={categoryMasterState(cat, ch.key)} onChange={(v) => toggleCategoryMaster(cat, ch.key, v)} />
                          </span>
                        </td>
                      ))}
                    </tr>
                    {cat.items.map((item) => (
                      <tr key={item.key}>
                        <td className="py-3 pr-4 text-sm text-text/75">{item.label}</td>
                        {CHANNELS.map((ch) => (
                          <td key={ch.key} className="py-3 text-center">
                            <span className="inline-flex">
                              <Switch checked={prefs[cat.key][item.key][ch.key]} onChange={(v) => toggleItem(cat.key, item.key, ch.key, v)} />
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked cards */}
              <div className="mt-4 flex flex-col gap-3 sm:hidden">
                {cat.items.map((item) => (
                  <div key={item.key} className="rounded-xl bg-bg p-3.5">
                    <p className="mb-2.5 text-sm font-medium text-text">{item.label}</p>
                    <div className="grid grid-cols-2 gap-y-2.5">
                      {CHANNELS.map((ch) => (
                        <Switch
                          key={ch.key}
                          checked={prefs[cat.key][item.key][ch.key]}
                          onChange={(v) => toggleItem(cat.key, item.key, ch.key, v)}
                          label={ch.label}
                          className="pr-2"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-5 rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MoonIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text">Quiet Hours</h2>
                <p className="mt-0.5 text-xs text-muted">Suppress non-urgent push and SMS notifications during this window.</p>
              </div>
              <Switch checked={quietHours.enabled} onChange={(v) => setQuietHours((q) => ({ ...q, enabled: v }))} />
            </div>
            {quietHours.enabled && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-muted">
                  From
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={(e) => setQuietHours((q) => ({ ...q, start: e.target.value }))}
                    className="rounded-xl border border-text/15 bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  To
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={(e) => setQuietHours((q) => ({ ...q, end: e.target.value }))}
                    className="rounded-xl border border-text/15 bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
                  />
                </label>
              </div>
            )}
            <p className="mt-3 flex items-start gap-1.5 text-xs text-muted">
              <ClockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Urgent items — like a session starting soon — still come through during quiet hours.
            </p>
          </div>
        </div>
      </section>

      <Modal
        open={Boolean(criticalWarning)}
        onClose={() => setCriticalWarning(null)}
        title="Turn this off anyway?"
        footer={
          <>
            <Button
              variant="primary"
              fullWidth={false}
              className="px-6"
              onClick={() => {
                applyCategoryMaster(criticalWarning.category.key, criticalWarning.channelKey, false);
                setCriticalWarning(null);
              }}
            >
              Turn Off
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setCriticalWarning(null)}>
              Keep It On
            </Button>
          </>
        }
      >
        {criticalWarning && (
          <p className="flex items-start gap-2.5 text-sm text-muted">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            We recommend keeping {criticalWarning.category.label} notifications on so you don't miss a session. You can still turn this off if you'd
            like.
          </p>
        )}
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset to recommended defaults?"
        footer={
          <>
            <Button variant="primary" fullWidth={false} className="px-6" onClick={resetToDefaults}>
              Reset
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">This replaces every toggle, digest choice and quiet-hours setting above with our recommended defaults. Any customizations you've made will be lost.</p>
      </Modal>
    </div>
  );
}
