"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import SideNav from "../components/SideNav";
const DAYS = [
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
];

export default function MySignupsPage() {
  const [signups, setSignups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState("All");
  const [now, setNow] = useState(new Date());
const [selectedWeek, setSelectedWeek] = useState<number | "All">("All");
const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);
  useEffect(() => {
    loadSignups();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadSignups() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSignups([]);
      setLoading(false);
      return;
    }

    const { data: myCharacters } = await supabase
      .from("characters")
      .select("*")
      .eq("user_id", user.id);

    if (!myCharacters || myCharacters.length === 0) {
      setSignups([]);
      setLoading(false);
      return;
    }

    const characterIds = myCharacters.map((c) => c.id);

    const { data: signupData } = await supabase
      .from("signups")
      .select("*")
      .in("character_id", characterIds);

    if (!signupData || signupData.length === 0) {
      setSignups([]);
      setLoading(false);
      return;
    }

    const runIds = signupData.map((s) => s.run_id);

    const { data: runs } = await supabase
      .from("runs")
      .select("*")
      .in("id", runIds);

    const merged = signupData.map((signup) => ({
      ...signup,
      run: runs?.find((r) => r.id === signup.run_id),
      character: myCharacters.find((c) => c.id === signup.character_id),
    }));

const weeks = Array.from(
  new Set(
    merged
      .map((s) => s.run?.week)
      .filter(Boolean)
  )
).sort((a, b) => a - b);

setAvailableWeeks(weeks);
setSignups(merged);
setLoading(false);
  }

  function serverNow() {
    return new Date(
      now.toLocaleString("en-US", { timeZone: "Europe/Paris" })
    );
  }

  function getCurrentDay() {
    const d = serverNow().getDay();
    return [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][d];
  }

function getRunDate(run?: any) {
  if (!run?.day || !run?.time || !run?.week) return null;

  const start = new Date("2026-03-18T07:00:00");

  const dayOffset: Record<string, number> = {
    Wednesday: 0,
    Thursday: 1,
    Friday: 2,
    Saturday: 3,
    Sunday: 4,
    Monday: 5,
    Tuesday: 6,
  };

  const cleanTime = run.time.replace("ST", "").trim();
  const [hour, minute] = cleanTime.split(":").map(Number);

  const runDate = new Date(
    start.getTime() +
      (run.week - 1) * 7 * 24 * 60 * 60 * 1000 +
      (dayOffset[run.day] || 0) * 24 * 60 * 60 * 1000
  );

  runDate.setHours(hour || 0, minute || 0, 0, 0);

  return runDate;
}

  function isRunPast(signup: any) {
    const runDate = getRunDate(signup.run);
    if (!runDate) return false;
    return runDate.getTime() < serverNow().getTime();
  }

  const currentDay = getCurrentDay();

const filteredSignups = useMemo(() => {
  const dayOrder: Record<string, number> = {
    Wednesday: 0,
    Thursday: 1,
    Friday: 2,
    Saturday: 3,
    Sunday: 4,
    Monday: 5,
    Tuesday: 6,
  };

  return [...signups]
    .filter((signup) => {
      const matchesWeek =
        selectedWeek === "All" || signup.run?.week === selectedWeek;

      const matchesDay =
        selectedDay === "All" || signup.run?.day === selectedDay;

      return matchesWeek && matchesDay;
    })
    .sort((a, b) => {
      const aPast = isRunPast(a);
      const bPast = isRunPast(b);

      // Active runs first
      if (aPast !== bPast) {
        return aPast ? 1 : -1;
      }

      // Week order
      const weekDiff =
        (a.run?.week || 0) - (b.run?.week || 0);

      if (weekDiff !== 0) return weekDiff;

      // Day order
      const dayDiff =
        (dayOrder[a.run?.day] || 0) -
        (dayOrder[b.run?.day] || 0);

      if (dayDiff !== 0) return dayDiff;

      // Time order
      const aDate = getRunDate(a)?.getTime() || 0;
      const bDate = getRunDate(b)?.getTime() || 0;

      return aDate - bDate;
    });
}, [signups, selectedDay, selectedWeek, now]);

return (
  <div style={page}>
    <div style={overlay} />

<div style={layout}>
  <aside style={sidebar}>
    <SideNav active="My Runs" />

    <div style={balanceBox}>
      <div style={balanceTitle}>BALANCE OVERVIEW</div>
      <div style={balanceLabel}>Total Balance</div>
      <div style={balanceAmount}>0 🟡</div>
      <button style={paymentBtn}>💰 Request Early Payment</button>
    </div>

    <div style={discordBox}>
      <b>Join our Discord</b>
      <p style={mutedSmall}>
        Stay updated with raid announcements and guild activity.
      </p>
      <button style={discordBtn}>JOIN DISCORD</button>
    </div>
  </aside>

  <main style={main}>
        <section style={heroPanel}>
          <div>
            <div style={miniTitle}>DEATH WISH RAID TRACKER</div>

            <h1 style={title}>My Signed Runs</h1>

            <p style={subtitle}>
              Current week only — Current Day:{" "}
              <span style={currentDayText}>{currentDay}</span>
            </p>
          </div>

          <div style={heroRight}>
            <div style={clockBox}>
              <div style={clockLabel}>SERVER CLOCK</div>
              <div style={clockTime}>
                {now.toLocaleTimeString("en-GB", {
                  timeZone: "Europe/Paris",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
              <div style={clockSmall}>ST / Europe Time</div>
            </div>

            <button
              onClick={loadSignups}
              style={refreshBtn}
              onMouseEnter={(e) => glow(e)}
              onMouseLeave={(e) =>
                unGlow(e, refreshBtn.boxShadow as string)
              }
            >
              ↻ Refresh
            </button>
          </div>
        </section>
<section style={dayPanel}>
  <button
    style={selectedWeek === "All" ? dayBtnActive : dayBtn}
    onClick={() => setSelectedWeek("All")}
  >
    All Weeks
  </button>

  {availableWeeks.map((week) => (
    <button
      key={week}
      style={selectedWeek === week ? dayBtnActive : dayBtn}
      onClick={() => setSelectedWeek(week)}
    >
      Week {week}
    </button>
  ))}
</section>
        <section style={dayPanel}>
          <button
            style={selectedDay === "All" ? dayBtnActive : dayBtn}
            onClick={() => setSelectedDay("All")}
            onMouseEnter={(e) => glow(e)}
            onMouseLeave={(e) =>
              unGlow(
                e,
                (selectedDay === "All"
                  ? dayBtnActive.boxShadow
                  : dayBtn.boxShadow) as string
              )
            }
          >
            All
          </button>

          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              style={
                selectedDay === day
                  ? dayBtnActive
                  : currentDay === day
                  ? currentDayBtn
                  : dayBtn
              }
              onMouseEnter={(e) => glow(e)}
              onMouseLeave={(e) =>
                unGlow(
                  e,
                  (selectedDay === day
                    ? dayBtnActive.boxShadow
                    : currentDay === day
                    ? currentDayBtn.boxShadow
                    : dayBtn.boxShadow) as string
                )
              }
            >
              {currentDay === day ? `Current ${day}` : day}
            </button>
          ))}
        </section>

        <section style={tableCard}>
          <div style={tableHeader}>
            <div>RUN</div>
            <div>TIME</div>
            <div>ROLE</div>
            <div>CLASS</div>
            <div>CHARACTER</div>
            <div>STATUS</div>
            <div>ACTIONS</div>
          </div>

          {loading ? (
            <div style={emptyBox}>Loading signups...</div>
          ) : filteredSignups.length === 0 ? (
            <div style={emptyBox}>No signed runs found for this filter.</div>
          ) : (
            filteredSignups.map((signup) => {
              const past = isRunPast(signup);

              return (
                <div key={signup.id} style={past ? pastRow : tableRow}>
                  <div>
                    <div style={past ? pastRunTitle : runTitle}>
                      {signup.run?.title || "Unknown Run"}
                    </div>
                    <div style={runDay}>{signup.run?.day || "-"}</div>
                  </div>

                  <div style={timeText}>◷ {signup.run?.time || "-"}</div>

                  <div style={roleText}>{signup.role || "-"}</div>

                  <div
                    style={{
                      ...classText(signup.character?.class),
                      fontWeight: 900,
                    }}
                  >
                    {signup.character?.class || "-"}
                  </div>

                  <div style={characterText}>
                    {signup.character?.name || signup.player || "-"}
                  </div>

                  <div>
                    <span style={past ? pastBadge : statusBadge}>
                      {past ? "FINISHED" : "SIGNED"}
                    </span>
                  </div>

                  <div>
                    <Link href={`/runs/${signup.run?.id}`}>
                      <button
                        style={past ? pastViewBtn : viewRunBtn}
                        onMouseEnter={(e) => glow(e)}
                        onMouseLeave={(e) =>
                          unGlow(
                            e,
                            (past
                              ? pastViewBtn.boxShadow
                              : viewRunBtn.boxShadow) as string
                          )
                        }
                      >
                        View Run
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  </div>
);
}

function glow(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.transform = "translateY(-3px) scale(1.08)";
  e.currentTarget.style.boxShadow =
    "0 0 28px rgba(217,70,239,0.9), 0 0 55px rgba(168,85,247,0.35)";
  e.currentTarget.style.filter = "brightness(1.18)";
}

function unGlow(e: React.MouseEvent<HTMLButtonElement>, shadow: string) {
  e.currentTarget.style.transform = "translateY(0) scale(1)";
  e.currentTarget.style.boxShadow = shadow;
  e.currentTarget.style.filter = "brightness(1)";
}

function classText(className?: string): React.CSSProperties {
  const colors: Record<string, string> = {
    "Death Knight": "#C41E3A",
    "Demon Hunter": "#A330C9",
    Druid: "#FF7C0A",
    Evoker: "#33937F",
    Hunter: "#AAD372",
    Mage: "#3FC7EB",
    Monk: "#00FF98",
    Paladin: "#F58CBA",
    Priest: "#FFFFFF",
    Rogue: "#FFF468",
    Shaman: "#0070DD",
    Warlock: "#8788EE",
    Warrior: "#C69B6D",
  };

  const color = colors[className || ""] || "#facc15";

  return {
    color,
    textShadow: `0 0 12px ${color}`,
  };
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  fontFamily: "Arial, sans-serif",
  background: "url('/bg.png') center top / cover no-repeat fixed",
  position: "relative",
  zIndex: 1,
  overflow: "hidden",
};
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background:
    "linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.55)), radial-gradient(circle at top right, rgba(168,85,247,0.12), transparent 42%)",
  backdropFilter: "blur(1px)",
  zIndex: -1,
};

const container: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  maxWidth: 1550,
  margin: "0 auto",
};

const heroPanel: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 22,
  marginBottom: 18,
  padding: "28px 32px",
  borderRadius: 24,
  background:
    "linear-gradient(90deg, rgba(8,5,22,0.86), rgba(20,8,38,0.72), rgba(8,5,22,0.86))",
  border: "1px solid rgba(168,85,247,0.35)",
  boxShadow: "0 0 38px rgba(168,85,247,0.18)",
};

const miniTitle: React.CSSProperties = {
  color: "#d8b4fe",
  fontSize: 12,
  letterSpacing: 3,
  fontWeight: 900,
  marginBottom: 8,
};

const title: React.CSSProperties = {
  fontSize: 60,
  lineHeight: 1,
  margin: 0,
  fontWeight: 900,
  color: "#c084fc",
  textShadow: "0 0 24px rgba(192,132,252,0.62)",
};

const subtitle: React.CSSProperties = {
  marginTop: 12,
  color: "#d1d5db",
  fontSize: 17,
};

const currentDayText: React.CSSProperties = {
  color: "#22c55e",
  fontWeight: 900,
  textShadow: "0 0 12px rgba(34,197,94,0.55)",
};

const heroRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
};

const clockBox: React.CSSProperties = {
  minWidth: 220,
  padding: "14px 20px",
  borderRadius: 18,
  background: "rgba(5,5,15,0.82)",
  border: "1px solid rgba(168,85,247,0.42)",
  boxShadow: "0 0 24px rgba(168,85,247,0.25)",
  textAlign: "center",
};

const clockLabel: React.CSSProperties = {
  color: "#d8b4fe",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 1.4,
};

const clockTime: React.CSSProperties = {
  color: "#d946ef",
  fontSize: 32,
  fontWeight: 900,
  marginTop: 6,
  textShadow: "0 0 18px rgba(217,70,239,0.8)",
};

const clockSmall: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  marginTop: 4,
};

const refreshBtn: React.CSSProperties = {
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  border: "1px solid rgba(255,255,255,0.35)",
  color: "white",
  padding: "15px 32px",
  borderRadius: 16,
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 17,
  transition: "all 0.2s ease",
  boxShadow: "0 0 22px rgba(168,85,247,0.55)",
};

const dayPanel: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 18,
  padding: "14px",
  borderRadius: 20,
  background: "rgba(4,4,12,0.62)",
  border: "1px solid rgba(168,85,247,0.22)",
};

const dayBtn: React.CSSProperties = {
  padding: "13px 20px",
  borderRadius: 14,
  border: "1px solid rgba(168,85,247,0.45)",
  background:
    "linear-gradient(180deg, rgba(20,12,42,0.92), rgba(8,8,20,0.92))",
  color: "#d8b4fe",
  fontWeight: 900,
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 0 12px rgba(168,85,247,0.18)",
};

const dayBtnActive: React.CSSProperties = {
  ...dayBtn,
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  color: "white",
  border: "1px solid rgba(255,255,255,0.35)",
  boxShadow: "0 0 24px rgba(217,70,239,0.65)",
};

const currentDayBtn: React.CSSProperties = {
  ...dayBtn,
  border: "1px solid rgba(34,197,94,0.75)",
  color: "#4ade80",
  boxShadow: "0 0 18px rgba(34,197,94,0.35)",
};

const tableCard: React.CSSProperties = {
  border: "1px solid rgba(168,85,247,0.34)",
  borderRadius: 24,
  overflow: "hidden",
  background:
    "linear-gradient(180deg, rgba(4,4,12,0.9), rgba(3,6,14,0.86))",
  backdropFilter: "blur(12px)",
  boxShadow:
    "0 0 48px rgba(168,85,247,0.2), inset 0 0 40px rgba(255,255,255,0.03)",
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr 1fr 1fr",
  padding: "20px 26px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  color: "#d8b4fe",
  fontWeight: 900,
  fontSize: 13,
  letterSpacing: 1,
  background: "rgba(2,6,23,0.72)",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr 1fr 1fr",
  padding: "24px 26px",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

const pastRow: React.CSSProperties = {
  ...tableRow,
  opacity: 0.62,
  filter: "grayscale(0.55)",
  background: "rgba(148,163,184,0.045)",
};

const emptyBox: React.CSSProperties = {
  padding: 60,
  textAlign: "center",
  color: "#aaa",
  fontSize: 18,
};

const runTitle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#c084fc",
  textShadow: "0 0 18px rgba(192,132,252,0.45)",
};

const pastRunTitle: React.CSSProperties = {
  ...runTitle,
  color: "#a1a1aa",
  textShadow: "none",
};

const runDay: React.CSSProperties = {
  marginTop: 8,
  color: "#9ca3af",
  fontSize: 16,
};

const timeText: React.CSSProperties = {
  color: "#f3f4f6",
  fontWeight: 700,
  fontSize: 16,
};

const roleText: React.CSSProperties = {
  color: "#f9fafb",
  fontWeight: 800,
  fontSize: 16,
};

const characterText: React.CSSProperties = {
  color: "#f8fafc",
  fontWeight: 800,
  fontSize: 16,
};

const statusBadge: React.CSSProperties = {
  background: "rgba(34,197,94,0.18)",
  color: "#22c55e",
  padding: "10px 18px",
  borderRadius: 12,
  fontWeight: 900,
  fontSize: 13,
  boxShadow: "0 0 18px rgba(34,197,94,0.22)",
};

const pastBadge: React.CSSProperties = {
  ...statusBadge,
  background: "rgba(148,163,184,0.16)",
  color: "#cbd5e1",
  boxShadow: "none",
};

const viewRunBtn: React.CSSProperties = {
  background: "linear-gradient(90deg,#6d28d9,#c026d3)",
  border: "1px solid rgba(216,180,254,0.8)",
  color: "white",
  padding: "13px 26px",
  borderRadius: 14,
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 15,
  transition: "all 0.2s ease",
  boxShadow: "0 0 18px rgba(168,85,247,0.42)",
};

const pastViewBtn: React.CSSProperties = {
  ...viewRunBtn,
  background: "rgba(75,85,99,0.5)",
  border: "1px solid rgba(148,163,184,0.35)",
  boxShadow: "none",
};
const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 1fr 260px",
  gap: 18,
  padding: 18,
};

const sidebar: React.CSSProperties = {
  background: "rgba(7,10,20,0.88)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 18,
  height: "fit-content",
};

const main: React.CSSProperties = {
  minWidth: 0,
};

const rightbar: React.CSSProperties = {
  position: "sticky",
  top: 24,
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const balanceBox: React.CSSProperties = {
  marginTop: 18,
  padding: 18,
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(10,15,35,.92), rgba(4,7,18,.96))",
  border: "1px solid rgba(168,85,247,.22)",
  boxShadow:
    "0 0 24px rgba(168,85,247,.16), inset 0 0 22px rgba(168,85,247,.06)",
};

const balanceTitle: React.CSSProperties = {
  color: "#a78bfa",
  fontWeight: 900,
  fontSize: 12,
  marginBottom: 10,
};

const balanceLabel: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 13,
};

const balanceAmount: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 900,
  fontSize: 28,
  marginTop: 8,
};

const paymentBtn: React.CSSProperties = {
  marginTop: 16,
  width: "100%",
  padding: "12px",
  borderRadius: 14,
  border: "1px solid rgba(217,70,239,.45)",
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const discordBox: React.CSSProperties = {
  marginTop: 18,
  padding: 18,
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(10,15,35,.92), rgba(4,7,18,.96))",
  border: "1px solid rgba(168,85,247,.22)",
};

const mutedSmall: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 13,
  lineHeight: 1.5,
  marginTop: 8,
};

const discordBtn: React.CSSProperties = {
  marginTop: 14,
  width: "100%",
  padding: "12px",
  borderRadius: 14,
  border: "1px solid rgba(168,85,247,.35)",
  background: "linear-gradient(90deg,#6d28d9,#c026d3)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const infoCard: React.CSSProperties = {
  padding: 18,
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(10,15,35,.92), rgba(4,7,18,.96))",
  border: "1px solid rgba(168,85,247,.22)",
};

const infoTitle: React.CSSProperties = {
  color: "#fff",
  fontWeight: 900,
  marginBottom: 14,
};

const mutedText: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 13,
  lineHeight: 1.5,
};