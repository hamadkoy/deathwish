"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ==============================
   Season settings (keep in sync with runs page)
============================== */
const SEASON_START = new Date("2026-08-19T07:00:00");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/* ==============================
   Options — edit these lists freely
============================== */
const RAIDS = [
  "Venomous Abyss",
  "Venomous Abyss + Tidebound Legion",
  "Manaforge Omega",
  "Liberation of Undermine",
  "Nerub-ar Palace",
];

const DIFFICULTIES = ["Normal", "Heroic", "Mythic"] as const;
const LOOT_TYPES = ["VIP", "Saved", "Solo", "Mythic Mount", "Lootshare"] as const;
const BOSS_COUNTS = ["1/9", "2/9", "3/9", "4/9", "5/9", "6/9", "7/9", "8/9", "9/9"];

const THEMES = [
  { key: "mythic-red", label: "Mythic Red", dot: "#ef4444" },
  { key: "mythic-purple", label: "Mythic Purple", dot: "#a855f7" },
  { key: "hc-gold", label: "HC Blue", dot: "#3b82f6" },
  { key: "void", label: "Void", dot: "#60a5fa" },
];

// Signup countdown: how long before the run signups unlock
const COUNTDOWNS = [
  { label: "No countdown", hours: 0 },
  { label: "1 hour before", hours: 1 },
  { label: "6 hours before", hours: 6 },
  { label: "12 hours before", hours: 12 },
  { label: "24 hours before", hours: 24 },
  { label: "48 hours before", hours: 48 },
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/* ==============================
   Date helpers (local-time safe)
============================== */
function toKey(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getWeekForDate(d: Date) {
  const diff = d.getTime() - SEASON_START.getTime();
  if (diff < 0) return 1;
  return Math.floor(diff / WEEK_MS) + 1;
}

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return { date, inMonth: date.getMonth() === month };
  });
}

function buildTimeSlots(stepMinutes: number) {
  const slots: string[] = [];
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const min = String(m % 60).padStart(2, "0");
    slots.push(`${h}:${min}`);
  }
  return slots;
}

/* ==============================
   Draft type — one row per run
============================== */
type Draft = {
  key: string;
  title: string;
  day: string;
  time: string;
  run_date: string;
  week: number;
  notes: string;
  background_key: string;
  ilvl_required: number | null;
  healer_limit: number;
  dps_limit: number;
  signup_open_at: string | null;
};

export default function CreateRunModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void | Promise<void>;
}) {
  /* ---------- run details ---------- */
  const [raid, setRaid] = useState(RAIDS[0]);
  const [customRaid, setCustomRaid] = useState("");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]>("Mythic");
  const [lootType, setLootType] =
    useState<(typeof LOOT_TYPES)[number]>("VIP");
  const [bossCount, setBossCount] = useState("8/9");
  const [ilvl, setIlvl] = useState("");
  const [healers, setHealers] = useState(3);
  const [dps, setDps] = useState(10);
  const [theme, setTheme] = useState("mythic-red");
  const [countdownHours, setCountdownHours] = useState(0);
  const [notes, setNotes] = useState("");

  /* ---------- schedule ---------- */
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [dates, setDates] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [step, setStep] = useState(30);

  /* ---------- summary ---------- */
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const grid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const slots = useMemo(() => buildTimeSlots(step), [step]);

  const pendingCount = dates.length * times.length;

  const runTitle = () => {
    const name = customRaid.trim() || raid;
    const diffTag =
      difficulty === "Mythic" ? "M" : difficulty === "Heroic" ? "HC" : "NM";
    return `${name} ${bossCount}${diffTag} ${lootType}`.trim();
  };

  function toggle(list: string[], value: string) {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  /* ==============================
     Build one draft per date × time
  ============================== */
  function addToSummary() {
    setError("");

    if (dates.length === 0 || times.length === 0) {
      setError("Pick at least one date and one time.");
      return;
    }

    const title = runTitle();
    const next: Draft[] = [];

    dates
      .slice()
      .sort()
      .forEach((dateKey) => {
        times
          .slice()
          .sort()
          .forEach((time) => {
            const dateObj = fromKey(dateKey);
            const [h, m] = time.split(":").map(Number);

            const runMoment = new Date(dateObj);
            runMoment.setHours(h, m, 0, 0);

            next.push({
              key: `${dateKey}-${time}`,
              title,
              day: WEEKDAYS[dateObj.getDay()],
              time: `${time} ST`,
              run_date: dateKey,
              week: getWeekForDate(dateObj),
              notes,
              background_key: theme,
              ilvl_required: Number(ilvl) || null,
              healer_limit: Number(healers) || 3,
              dps_limit: Number(dps) || 10,
              signup_open_at:
                countdownHours > 0
                  ? new Date(
                      runMoment.getTime() - countdownHours * 60 * 60 * 1000
                    ).toISOString()
                  : null,
            });
          });
      });

    setDrafts((prev) => {
      const seen = new Set(prev.map((d) => d.key + d.title));
      return [...prev, ...next.filter((d) => !seen.has(d.key + d.title))];
    });

    setDates([]);
    setTimes([]);
  }

  async function createAll() {
    if (drafts.length === 0) return;

    setSaving(true);
    setError("");

    const rows = drafts.map(({ key, ...row }) => row);

    const { error: insertError } = await supabase.from("runs").insert(rows);

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setDrafts([]);
    await onCreated?.();
    onClose();
  }

  if (!open) return null;

  /* ==============================
     Render
  ============================== */
  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div style={header}>
          <div>
            <div style={headerTitle}>Create runs</div>
            <div style={headerSub}>{runTitle()}</div>
          </div>

          <button onClick={onClose} style={closeBtn} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={body}>
          {/* ---------- top: 4 columns ---------- */}
          <div style={topGrid}>
            <div>
              <div style={sectionLabel}>Run details</div>

              <div style={fieldLabel}>Raid</div>
              <select
                value={raid}
                onChange={(e) => setRaid(e.target.value)}
                style={input}
              >
                {RAIDS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <div style={fieldLabel}>Custom title (optional)</div>
              <input
                placeholder="Overrides the raid name"
                value={customRaid}
                onChange={(e) => setCustomRaid(e.target.value)}
                style={input}
              />

              <div style={fieldLabel}>Boss count</div>
              <select
                value={bossCount}
                onChange={(e) => setBossCount(e.target.value)}
                style={input}
              >
                {BOSS_COUNTS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={sectionLabel}>Difficulty &amp; loot</div>

              <div style={fieldLabel}>Difficulty</div>
              <div style={chipRow}>
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    style={chip(difficulty === d)}
                  >
                    {d}
                  </button>
                ))}
              </div>

              <div style={fieldLabel}>Loot type</div>
              <div style={chipRow}>
                {LOOT_TYPES.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLootType(l)}
                    style={chip(lootType === l)}
                  >
                    {l}
                  </button>
                ))}
              </div>

              <div style={fieldLabel}>Required ilvl</div>
              <input
                placeholder="e.g. 700"
                value={ilvl}
                onChange={(e) => setIlvl(e.target.value)}
                style={input}
              />
            </div>

            <div>
              <div style={sectionLabel}>Spots</div>

              <div style={fieldLabel}>Healers</div>
              <Stepper value={healers} onChange={setHealers} />

              <div style={fieldLabel}>DPS</div>
              <Stepper value={dps} onChange={setDps} />

              <div style={fieldLabel}>Signup countdown</div>
              <select
                value={countdownHours}
                onChange={(e) => setCountdownHours(Number(e.target.value))}
                style={input}
              >
                {COUNTDOWNS.map((c) => (
                  <option key={c.hours} value={c.hours}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={sectionLabel}>Theme &amp; note</div>

              <div style={fieldLabel}>Card background</div>
              <div style={{ display: "grid", gap: 8 }}>
                {THEMES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    style={{
                      ...chip(theme === t.key),
                      justifyContent: "flex-start",
                      gap: 10,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: t.dot,
                        boxShadow: `0 0 10px ${t.dot}`,
                      }}
                    />
                    {t.label}
                  </button>
                ))}
              </div>

              <div style={fieldLabel}>Run note</div>
              <textarea
                placeholder="Shown on every run in this batch"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ ...input, height: 84, paddingTop: 10, resize: "vertical" }}
              />
            </div>
          </div>

          {/* ---------- schedule ---------- */}
          <div style={sectionLabel}>Schedule</div>

          <div style={scheduleGrid}>
            {/* calendar */}
            <div style={card}>
              <div style={cardHead}>
                <span>
                  Select dates{" "}
                  <b style={{ color: ACCENT }}>({dates.length} selected)</b>
                </span>

                {dates.length > 0 && (
                  <button onClick={() => setDates([])} style={clearBtn}>
                    Clear
                  </button>
                )}
              </div>

              <div style={monthRow}>
                <button onClick={() => shiftMonth(-1)} style={navBtn}>
                  ‹
                </button>

                <b>
                  {new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
                </b>

                <button onClick={() => shiftMonth(1)} style={navBtn}>
                  ›
                </button>
              </div>

              <div style={dayHeadRow}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <div key={d} style={dayHead}>
                    {d}
                  </div>
                ))}
              </div>

              <div style={calGrid}>
                {grid.map(({ date, inMonth }) => {
                  const key = toKey(date);
                  const active = dates.includes(key);
                  const isToday = key === toKey(new Date());

                  return (
                    <button
                      key={key}
                      onClick={() => setDates((p) => toggle(p, key))}
                      style={{
                        ...dayCell,
                        opacity: inMonth ? 1 : 0.28,
                        background: active
                          ? "linear-gradient(180deg,#9333ea,#6b21a8)"
                          : "transparent",
                        color: active ? "#fff" : "#e6e0f5",
                        border: active
                          ? "1px solid #d8b4fe"
                          : isToday
                          ? "1px solid rgba(168,85,247,.55)"
                          : "1px solid transparent",
                        boxShadow: active
                          ? "0 0 16px rgba(168,85,247,.6)"
                          : "none",
                      }}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* times */}
            <div style={card}>
              <div style={cardHead}>
                <span>
                  Select times{" "}
                  <b style={{ color: ACCENT }}>({times.length} selected)</b>
                </span>

                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {[5, 15, 30, 60].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setStep(s);
                        setTimes([]);
                      }}
                      style={{
                        ...clearBtn,
                        color: step === s ? "#fff7cc" : "#c4b5fd",
                        borderColor:
                          step === s ? "#facc15" : "rgba(168,85,247,.35)",
                      }}
                    >
                      {s}m
                    </button>
                  ))}

                  {times.length > 0 && (
                    <button onClick={() => setTimes([])} style={clearBtn}>
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div style={timeGrid}>
                {slots.map((t) => {
                  const active = times.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => setTimes((p) => toggle(p, t))}
                      style={{
                        ...timeCell,
                        background: active
                          ? "linear-gradient(180deg,#9333ea,#6b21a8)"
                          : "rgba(255,255,255,.05)",
                        border: active
                          ? "1px solid #d8b4fe"
                          : "1px solid rgba(168,85,247,.18)",
                        boxShadow: active
                          ? "0 0 14px rgba(168,85,247,.55)"
                          : "none",
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              <div style={timezoneNote}>
                Times are server time (EU / CET-CEST) and saved as “HH:MM ST”.
              </div>
            </div>
          </div>

          <button
            onClick={addToSummary}
            disabled={pendingCount === 0}
            style={{
              ...primaryBtn,
              opacity: pendingCount === 0 ? 0.45 : 1,
              cursor: pendingCount === 0 ? "not-allowed" : "pointer",
            }}
          >
            + Add run{pendingCount === 1 ? "" : "s"} to summary
            <span style={countPill}>
              {pendingCount} run{pendingCount === 1 ? "" : "s"}
            </span>
          </button>

          {/* ---------- summary ---------- */}
          {drafts.length > 0 && (
            <>
              <div style={{ ...sectionLabel, marginTop: 26 }}>
                Summary — {drafts.length} run{drafts.length === 1 ? "" : "s"}
              </div>

              <div style={summaryBox}>
                {drafts.map((d, i) => (
                  <div key={d.key + i} style={summaryRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={summaryTitle}>{d.title}</div>
                      <div style={summaryMeta}>
                        Week {d.week} • {d.day} •{" "}
                        {fromKey(d.run_date).toLocaleDateString("en-GB")} •{" "}
                        {d.time}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        setDrafts((p) => p.filter((_, idx) => idx !== i))
                      }
                      style={rowRemove}
                      aria-label="Remove run"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && <div style={errorBox}>{error}</div>}
        </div>

        {/* footer */}
        <div style={footer}>
          <button onClick={onClose} style={ghostBtn}>
            Cancel
          </button>

          <button
            onClick={createAll}
            disabled={drafts.length === 0 || saving}
            style={{
              ...confirmBtn,
              opacity: drafts.length === 0 || saving ? 0.45 : 1,
              cursor:
                drafts.length === 0 || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving
              ? "Creating…"
              : `Create ${drafts.length} run${drafts.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==============================
   Small parts
============================== */
function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        style={stepBtn}
        aria-label="Decrease"
      >
        −
      </button>

      <input
        value={value}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
        style={{ ...input, marginBottom: 0, textAlign: "center", width: 70 }}
      />

      <button
        onClick={() => onChange(value + 1)}
        style={stepBtn}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

/* ==============================
   Styles
============================== */
const ACCENT = "#c084fc";

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.75)",
  backdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  zIndex: 999999,
};

const panel: React.CSSProperties = {
  width: "min(1360px, 100%)",
  maxHeight: "92vh",
  display: "flex",
  flexDirection: "column",
  borderRadius: 22,
  border: "1px solid rgba(168,85,247,.45)",
  background: "linear-gradient(180deg, rgba(12,6,24,.99), rgba(4,0,12,.99))",
  boxShadow: "0 0 60px rgba(168,85,247,.35)",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "20px 26px",
  borderBottom: "1px solid rgba(168,85,247,.22)",
};

const headerTitle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#fff",
  fontFamily: "Georgia, serif",
  letterSpacing: 1,
};

const headerSub: React.CSSProperties = {
  marginTop: 4,
  color: ACCENT,
  fontSize: 14,
  fontWeight: 800,
};

const closeBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 12,
  border: "1px solid rgba(239,68,68,.45)",
  background: "linear-gradient(180deg,#7f1d1d,#450a0a)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const body: React.CSSProperties = {
  padding: 24,
  overflowY: "auto",
  flex: 1,
};

const topGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 24,
  marginBottom: 26,
};

const scheduleGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 18,
  marginBottom: 18,
};

const sectionLabel: React.CSSProperties = {
  color: ACCENT,
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 2,
  textTransform: "uppercase",
  marginBottom: 12,
};

const fieldLabel: React.CSSProperties = {
  color: "#9d8ec2",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: "uppercase",
  margin: "12px 0 6px",
};

const input: React.CSSProperties = {
  width: "100%",
  marginBottom: 4,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(168,85,247,.3)",
  background: "rgba(15,4,32,.9)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  outline: "none",
};

const chipRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const chip = (active: boolean): React.CSSProperties => ({
  padding: "9px 14px",
  borderRadius: 10,
  border: active ? "1px solid #d8b4fe" : "1px solid rgba(168,85,247,.28)",
  background: active
    ? "linear-gradient(180deg,#9333ea,#6b21a8)"
    : "rgba(255,255,255,.05)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: active ? "0 0 16px rgba(168,85,247,.5)" : "none",
});

const card: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px solid rgba(168,85,247,.25)",
  background: "rgba(255,255,255,.03)",
};

const cardHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  color: "#cbbde6",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 1,
  textTransform: "uppercase",
  marginBottom: 12,
};

const clearBtn: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 8,
  border: "1px solid rgba(168,85,247,.35)",
  background: "transparent",
  color: "#c4b5fd",
  fontSize: 11,
  fontWeight: 800,
  cursor: "pointer",
};

const monthRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  color: "#fff",
  fontSize: 16,
  marginBottom: 10,
};

const navBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 10,
  border: "1px solid rgba(168,85,247,.3)",
  background: "rgba(255,255,255,.05)",
  color: "#fff",
  fontSize: 18,
  cursor: "pointer",
};

const dayHeadRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  marginBottom: 4,
};

const dayHead: React.CSSProperties = {
  textAlign: "center",
  color: "#8b7bb0",
  fontSize: 11,
  fontWeight: 800,
  padding: "4px 0",
};

const calGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 4,
};

const dayCell: React.CSSProperties = {
  height: 38,
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const timeGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(62px, 1fr))",
  gap: 6,
  maxHeight: 300,
  overflowY: "auto",
  paddingRight: 4,
};

const timeCell: React.CSSProperties = {
  padding: "8px 0",
  borderRadius: 8,
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const timezoneNote: React.CSSProperties = {
  marginTop: 12,
  color: "#8b7bb0",
  fontSize: 12,
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "15px",
  borderRadius: 14,
  border: "1px solid rgba(216,180,254,.5)",
  background: "linear-gradient(90deg,#9333ea,#d946ef)",
  color: "#fff",
  fontWeight: 900,
  fontSize: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  boxShadow: "0 0 24px rgba(217,70,239,.45)",
};

const countPill: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: 999,
  background: "rgba(0,0,0,.35)",
  fontSize: 13,
};

const summaryBox: React.CSSProperties = {
  display: "grid",
  gap: 8,
  maxHeight: 260,
  overflowY: "auto",
  paddingRight: 4,
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  borderRadius: 12,
  background: "rgba(255,255,255,.04)",
  border: "1px solid rgba(168,85,247,.2)",
};

const summaryTitle: React.CSSProperties = {
  color: "#fff",
  fontWeight: 800,
  fontSize: 14,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const summaryMeta: React.CSSProperties = {
  marginTop: 3,
  color: "#a99cc6",
  fontSize: 12,
};

const rowRemove: React.CSSProperties = {
  width: 28,
  height: 28,
  flexShrink: 0,
  borderRadius: 8,
  border: "1px solid rgba(239,68,68,.4)",
  background: "rgba(70,0,0,.5)",
  color: "#fecaca",
  cursor: "pointer",
  fontWeight: 900,
};

const errorBox: React.CSSProperties = {
  marginTop: 14,
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(239,68,68,.45)",
  background: "rgba(70,0,0,.35)",
  color: "#fecaca",
  fontWeight: 700,
  fontSize: 14,
};

const footer: React.CSSProperties = {
  display: "flex",
  gap: 12,
  justifyContent: "flex-end",
  padding: "16px 26px",
  borderTop: "1px solid rgba(168,85,247,.22)",
  background: "rgba(0,0,0,.35)",
};

const ghostBtn: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.2)",
  background: "rgba(255,255,255,.06)",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const confirmBtn: React.CSSProperties = {
  padding: "12px 30px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(90deg,#facc15,#a66a1f)",
  color: "#160b02",
  fontWeight: 900,
  fontSize: 15,
  boxShadow: "0 0 22px rgba(250,204,21,.45)",
};

const stepBtn: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 10,
  border: "1px solid rgba(168,85,247,.3)",
  background: "rgba(255,255,255,.05)",
  color: "#fff",
  fontSize: 18,
  fontWeight: 900,
  cursor: "pointer",
};
