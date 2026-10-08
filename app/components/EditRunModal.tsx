"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// The current raid has 8 bosses, so all experience is out of 8.
export const RAID_BOSSES = 8;

export type EditableRun = {
  id: number;
  title: string;
  day: string;
  time: string;
  week?: number;
  notes?: string;
  run_date?: string;
  ilvl_required?: number;
  signup_open_at?: string;
  healer_limit?: number;
  dps_limit?: number;
  background_key?: string;
  exp_required?: string;
  time_changed_at?: string;
};

const DAYS = [
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
];

const BACKGROUNDS = [
  { key: "mythic-red", label: "Mythic Red", dot: "#ef4444" },
  { key: "mythic-purple", label: "Purple", dot: "#a855f7" },
  { key: "hc-gold", label: "HC Blue", dot: "#3b82f6" },
  { key: "void", label: "Void", dot: "#60a5fa" },
];

function bossRange() {
  return Array.from({ length: RAID_BOSSES }, (_, i) => i + 1);
}

function toDatetimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export default function EditRunModal({
  run,
  dateForDay,
  onClose,
  onSaved,
}: {
  run: EditableRun | null;
  dateForDay: (week: number, day: string) => string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("Wednesday");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [ilvl, setIlvl] = useState("");
  const [exp, setExp] = useState("");
  const [healers, setHealers] = useState(3);
  const [dps, setDps] = useState(10);
  const [signupMode, setSignupMode] = useState<"open" | "scheduled">("open");
  const [signupAt, setSignupAt] = useState("");
  const [background, setBackground] = useState("mythic-red");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!run) return;

    setTitle(run.title || "");
    setDay(run.day || "Wednesday");
    // input type="date" only accepts YYYY-MM-DD, a full timestamp shows as empty.
    setDate((run.run_date || "").slice(0, 10));
    setTime(run.time || "");
    setIlvl(run.ilvl_required ? String(run.ilvl_required) : "");
    setExp(run.exp_required || "");
    setHealers(run.healer_limit || 3);
    setDps(run.dps_limit || 10);
    setSignupMode(run.signup_open_at ? "scheduled" : "open");
    setSignupAt(toDatetimeLocal(run.signup_open_at));
    setBackground(run.background_key || "mythic-red");
    setNotes(run.notes || "");
    setError("");
    setSaving(false);
  }, [run]);

  useEffect(() => {
    if (!run) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, onClose]);

  if (!run) return null;

  const knownExp = ["M", "HC"].flatMap((d) =>
    bossRange().map((n) => `${n}/${RAID_BOSSES}${d}`)
  );
  // Keep an old value (e.g. "6/9M") visible instead of silently dropping it.
  const legacyExp = exp && !knownExp.includes(exp) ? exp : null;

  function changeDay(next: string) {
    setDay(next);
    if (run?.week !== null && run?.week !== undefined) {
      setDate(dateForDay(run.week, next));
    }
  }

  async function save() {
    if (!run) return;

    if (!title.trim()) {
      setError("The run needs a title.");
      return;
    }

    if (signupMode === "scheduled" && !signupAt) {
      setError("Pick when signups open, or choose Open immediately.");
      return;
    }

    setSaving(true);
    setError("");

    const moved =
      day !== run.day ||
      time.trim() !== (run.time || "") ||
      date !== (run.run_date || "").slice(0, 10);

    const { error: updateError } = await supabase
      .from("runs")
      .update({
        title: title.trim(),
        day,
        time: time.trim(),
        run_date: date || null,
        // Moving a run restarts everyone's grace window.
        ...(moved ? { time_changed_at: new Date().toISOString() } : {}),
        notes,
        background_key: background,
        ilvl_required: Number(ilvl) || null,
        exp_required: exp || null,
        healer_limit: healers,
        dps_limit: dps,
        signup_open_at:
          signupMode === "scheduled"
            ? new Date(signupAt).toISOString()
            : null,
      })
      .eq("id", run.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await onSaved();
  }

  return (
    <div style={overlay}>
      <div style={panel}>
        {/* Header */}
        <div style={header}>
          <div>
            <div style={headerTitle}>Edit run #{run.id}</div>
            <div style={headerSub}>{title || run.title}</div>
          </div>

          <button onClick={onClose} style={closeBtn} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={body}>
          {/* Run details */}
          <div>
            <div style={sectionTitle}>Run Details</div>

            <div style={fieldLabel}>Run Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={input}
            />

            <div style={twoCol}>
              <div>
                <div style={fieldLabel}>Run Day</div>
                <select
                  value={day}
                  onChange={(e) => changeDay(e.target.value)}
                  style={input}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div style={fieldLabel}>Run Date</div>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={input}
                />
              </div>
            </div>

            <div style={fieldLabel}>Run Time</div>
            <input
              value={time}
              placeholder="19:00 ST"
              onChange={(e) => setTime(e.target.value)}
              style={input}
            />
          </div>

          {/* Requirements */}
          <div>
            <div style={sectionTitle}>Requirements &amp; Spots</div>

            <div style={fieldLabel}>Boss Experience Needed</div>
            <select
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              style={input}
            >
              <option value="">No experience needed</option>

              <optgroup label="Mythic">
                {bossRange().map((n) => (
                  <option key={`m${n}`} value={`${n}/${RAID_BOSSES}M`}>
                    {n}/{RAID_BOSSES} Mythic
                  </option>
                ))}
              </optgroup>

              <optgroup label="Heroic">
                {bossRange().map((n) => (
                  <option key={`h${n}`} value={`${n}/${RAID_BOSSES}HC`}>
                    {n}/{RAID_BOSSES} Heroic
                  </option>
                ))}
              </optgroup>

              {legacyExp && (
                <option value={legacyExp}>{legacyExp} (old value)</option>
              )}
            </select>

            <div style={fieldLabel}>Required iLvl</div>
            <input
              type="number"
              min={0}
              value={ilvl}
              placeholder="Empty for none"
              onChange={(e) => setIlvl(e.target.value)}
              style={input}
            />

            <div style={twoCol}>
              <div>
                <div style={fieldLabel}>Healers</div>
                <Stepper value={healers} onChange={setHealers} />
              </div>

              <div>
                <div style={fieldLabel}>DPS</div>
                <Stepper value={dps} onChange={setDps} />
              </div>
            </div>
          </div>

          {/* Signups */}
          <div>
            <div style={sectionTitle}>Signups</div>

            <div style={fieldLabel}>Signup Countdown</div>
            <select
              value={signupMode}
              onChange={(e) =>
                setSignupMode(e.target.value as "open" | "scheduled")
              }
              style={input}
            >
              <option value="open">Open immediately</option>
              <option value="scheduled">Open at a set time</option>
            </select>

            {signupMode === "scheduled" && (
              <>
                <div style={fieldLabel}>Signups Open At</div>
                <input
                  type="datetime-local"
                  value={signupAt}
                  onChange={(e) => setSignupAt(e.target.value)}
                  style={input}
                />
                {signupAt && new Date(signupAt).getTime() <= Date.now() && (
                  <div style={hint}>This time has passed, so signups are open.</div>
                )}
              </>
            )}
          </div>

          {/* Theme */}
          <div>
            <div style={sectionTitle}>Theme &amp; Note</div>

            <div style={fieldLabel}>Card Background</div>
            <div style={bgGrid}>
              {BACKGROUNDS.map((b) => {
                const active = background === b.key;

                return (
                  <button
                    key={b.key}
                    onClick={() => setBackground(b.key)}
                    style={{ ...bgButton, ...(active ? bgButtonActive : {}) }}
                  >
                    <span style={{ ...dot, background: b.dot }} />
                    {b.label}
                  </button>
                );
              })}
            </div>

            <div style={fieldLabel}>Run Note</div>
            <textarea
              value={notes}
              placeholder="Shown on the run card"
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...input, height: 150, padding: "14px 16px", resize: "vertical" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={footer}>
          <div style={errorText}>{error}</div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={onClose} style={cancelBtn}>
              Cancel
            </button>

            <button
              onClick={save}
              disabled={saving}
              style={{ ...saveBtn, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button onClick={() => onChange(Math.max(0, value - 1))} style={stepBtn}>
        −
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        style={{ ...input, textAlign: "center", marginBottom: 0 }}
      />
      <button onClick={() => onChange(value + 1)} style={stepBtn}>
        +
      </button>
    </div>
  );
}

// ==============================
// Styles (matched to Create runs)
// ==============================
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.72)",
  backdropFilter: "blur(10px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999999,
};

const panel: React.CSSProperties = {
  width: "min(1900px, 97vw)",
  minHeight: "60vh",
  maxHeight: "94vh",
  display: "flex",
  flexDirection: "column",
  borderRadius: 18,
  background: "linear-gradient(180deg, rgba(14,4,30,.99), rgba(6,0,16,.99))",
  border: "1px solid rgba(168,85,247,.45)",
  boxShadow: "0 0 50px rgba(168,85,247,.3)",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  padding: "26px 36px",
  borderBottom: "1px solid rgba(168,85,247,.2)",
};

const headerTitle: React.CSSProperties = {
  color: "white",
  fontSize: 38,
  fontWeight: 900,
  fontFamily: "Georgia, serif",
};

const headerSub: React.CSSProperties = {
  color: "#c084fc",
  fontSize: 19,
  fontWeight: 800,
  marginTop: 6,
};

const closeBtn: React.CSSProperties = {
  width: 46,
  height: 46,
  fontSize: 18,
  borderRadius: 10,
  border: "1px solid rgba(239,68,68,.6)",
  background: "linear-gradient(180deg,#991b1b,#450a0a)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const body: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 40,
  padding: "32px 36px",
  overflowY: "auto",
};

const sectionTitle: React.CSSProperties = {
  color: "#c084fc",
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: 2,
  textTransform: "uppercase",
  marginBottom: 14,
};

const fieldLabel: React.CSSProperties = {
  color: "#a1a1aa",
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  margin: "20px 0 8px",
};

const input: React.CSSProperties = {
  width: "100%",
  height: 56,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid rgba(168,85,247,.35)",
  background: "rgba(15,0,35,.9)",
  color: "white",
  fontWeight: 700,
  fontSize: 18,
  outline: "none",
  boxSizing: "border-box",
};

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const stepBtn: React.CSSProperties = {
  width: 48,
  height: 48,
  flexShrink: 0,
  borderRadius: 10,
  border: "1px solid rgba(168,85,247,.35)",
  background: "rgba(20,10,35,.9)",
  color: "white",
  fontWeight: 900,
  fontSize: 22,
  cursor: "pointer",
};

const bgGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const bgButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  height: 54,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid rgba(168,85,247,.3)",
  background: "rgba(20,10,35,.9)",
  color: "white",
  fontWeight: 900,
  fontSize: 18,
  cursor: "pointer",
};

const bgButtonActive: React.CSSProperties = {
  border: "1px solid #c084fc",
  background: "linear-gradient(90deg,#7c3aed,#a855f7)",
  boxShadow: "0 0 14px rgba(168,85,247,.55)",
};

const dot: React.CSSProperties = {
  width: 13,
  height: 13,
  borderRadius: "50%",
  flexShrink: 0,
};

const hint: React.CSSProperties = {
  marginTop: 8,
  color: "#facc15",
  fontSize: 15,
  fontWeight: 800,
};

const footer: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "20px 36px",
  marginTop: "auto",
  borderTop: "1px solid rgba(168,85,247,.2)",
  background: "rgba(0,0,0,.35)",
};

const errorText: React.CSSProperties = {
  color: "#f87171",
  fontWeight: 800,
  fontSize: 17,
};

const cancelBtn: React.CSSProperties = {
  height: 56,
  padding: "0 32px",
  fontSize: 18,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.25)",
  background: "rgba(0,0,0,.5)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const saveBtn: React.CSSProperties = {
  height: 56,
  padding: "0 40px",
  borderRadius: 12,
  border: "1px solid rgba(250,204,21,.4)",
  background: "linear-gradient(180deg,#f5d27a,#a66a1f)",
  color: "#160b02",
  fontWeight: 900,
  fontSize: 19,
  cursor: "pointer",
};
