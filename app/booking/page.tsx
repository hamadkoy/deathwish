"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SideNav from "@/app/components/SideNav";


type Run = {
  id: number;
  title: string;
  day: string;
  time: string;
  week?: number;
  notes?: string;
  run_date?: string;
  ilvl_required?: number;
};

function getCurrentWeek() {
  const start = new Date("2026-03-18T07:00:00");
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return Math.max(Math.floor(diffMs / weekMs) + 1, 1);
}

function getShortWeekRange(week: number) {
  const start = new Date("2026-03-18T07:00:00");
  const weekStart = new Date(start.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  return `${weekStart.getMonth() + 1}/${weekStart.getDate()} → ${
    weekEnd.getMonth() + 1
  }/${weekEnd.getDate()}`;
}

function formatRunDate(date?: string) {
  if (!date) return "-";
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

export default function BookingPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(getCurrentWeek());
  const [bookingRefresh, setBookingRefresh] = useState(0);
  const [raidFilter, setRaidFilter] = useState<"All" | "HC" | "Mythic">("All");
  const [siteRole, setSiteRole] = useState<string | null>(null);
const [roleLoading, setRoleLoading] = useState(true);

useEffect(() => {
  async function loadRole() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    setRoleLoading(false);
    return;
  }

  const { data } = await supabase
    .from("profiles")
    .select("site_role")
    .eq("user_id", user.id)
    .single();

  setSiteRole(data?.site_role || "viewer");
  setRoleLoading(false);
}
  async function loadRuns() {
    const { data, error } = await supabase
      .from("runs")
      .select("*")
      .order("week", { ascending: true })
      .order("run_date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRuns(data || []);
  }

  function refreshBookingData() {
    setBookingRefresh((x) => x + 1);
  }

loadRole();
loadRuns();

  window.addEventListener("bookingUpdated", refreshBookingData);
  window.addEventListener("storage", refreshBookingData);
  window.addEventListener("focus", refreshBookingData);

  return () => {
    window.removeEventListener("bookingUpdated", refreshBookingData);
    window.removeEventListener("storage", refreshBookingData);
    window.removeEventListener("focus", refreshBookingData);
  };
}, []);

  const openWeeks = useMemo(() => {
    const weeks = runs
      .map((r) => r.week)
      .filter((w): w is number => typeof w === "number");

    const maxWeek = Math.max(getCurrentWeek(), ...weeks);
    return Array.from({ length: maxWeek }, (_, i) => i + 1);
  }, [runs]);

  const filteredRuns = runs.filter((run) => {
    const title = run.title.toLowerCase();
    const weekMatch = run.week === selectedWeek;

    if (!weekMatch) return false;
    if (raidFilter === "All") return true;
    if (raidFilter === "HC") {
  return title.includes("hc") || title.includes("heroic");
}
    if (raidFilter === "Mythic") {
  return title.includes("mythic") || title.includes("/9m");
}

    return true;
  });

  const totalRuns = runs.length;
  const openedRuns = runs.filter((r) => r.week === selectedWeek).length;
function getBuyerCount(runId: number) {
  if (typeof window === "undefined") return 0;

  const saved = localStorage.getItem(`booking-buyers-${runId}`);
  if (!saved) return 0;

  const buyers = JSON.parse(saved);
  return buyers.filter((b: any) => !b.ignored).length;
}
function getBuyerSlots(runId: number) {
  if (typeof window === "undefined") return 4;

  const saved = localStorage.getItem(`booking-slots-${runId}`);
  return saved ? Number(saved) : 4;
}

function getRunLocked(runId: number) {
  if (typeof window === "undefined") return false;

  return localStorage.getItem(`booking-locked-${runId}`) === "true";
}
if (roleLoading) {
  return null;
}

if (siteRole !== "admin" && siteRole !== "officer") {
  return (
    <main style={page}>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontSize: 42,
          fontWeight: 900,
          textShadow: "0 0 20px rgba(239,68,68,.8)",
        }}
      >
        🔒 Officers & Admins Only
      </div>
    </main>
  );
}
  return (
    <main style={page}>
      <div style={fogOne} />
      <div style={fogTwo} />
      <div style={castleGlow} />

      <div style={layout}>
        <aside style={sidebar}>
<SideNav active="Booking" />
          <div style={summaryBox}>
            <div style={smallTitle}>BOOKING SUMMARY</div>
            <Summary label="Total Runs" value={String(totalRuns)} />
            <Summary label="Opened This Week" value={String(openedRuns)} />
            <Summary label="Max Buyers / Run" value="4" />
            <Summary label="Status" value="Live" />
          </div>
        </aside>

        <section style={content}>
          <div style={heroBox}>
            <div>
              <h1 style={title}>Booking</h1>
              <p style={subtitle}>
                Browse opened raids from the signup page and book your buyer.
              </p>
            </div>

            <div style={filterBox}>
              <FilterButton label="All" active={raidFilter === "All"} onClick={() => setRaidFilter("All")} />
              <FilterButton label="HC" active={raidFilter === "HC"} onClick={() => setRaidFilter("HC")} />
              <FilterButton label="Mythic" active={raidFilter === "Mythic"} onClick={() => setRaidFilter("Mythic")} />
            </div>
          </div>

          <div style={weekTabs}>
            {openWeeks.map((week) => (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                style={selectedWeek === week ? weekActive : weekBtn}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-3px) scale(1.04)";
                  e.currentTarget.style.boxShadow =
                    "0 0 28px rgba(168,85,247,.95), inset 0 0 18px rgba(168,85,247,.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow =
                    selectedWeek === week
                      ? "0 0 28px rgba(250,204,21,.85), inset 0 0 18px rgba(250,204,21,.25)"
                      : "0 0 12px rgba(168,85,247,.35)";
                }}
              >
                <b>{week === getCurrentWeek() ? `Current Week (${week})` : `Week ${week}`}</b>
                <span style={{ fontSize: 13, opacity: 0.85 }}>
                  {getShortWeekRange(week)}
                </span>
              </button>
            ))}
          </div>

          <div style={table}>
            <div style={tableHead}>
              <div>DATE</div>
              <div>TIME</div>
              <div>RUN</div>
              <div>DIFFICULTY</div>
              
              <div>BUYERS</div>
              <div>STATUS</div>
              <div>ACTION</div>
            </div>

            {filteredRuns.map((run) => {
              const lowerTitle = run.title.toLowerCase();

const isMythic =
  lowerTitle.includes("mythic") ||
  lowerTitle.includes("/9m");

              return (
                <div key={run.id} style={tableRow}>
                  <div>{formatRunDate(run.run_date)}</div>
                  <div>{run.time}</div>

                  <div>
                    <div style={{ fontWeight: 1000, fontSize: 18 }}>{run.title}</div>
                    <div style={miniText}>
                      {run.day} • Week {run.week}
                    </div>
                  </div>

                  <div
                    style={{
                      ...difficultyPill,
                      color: isMythic ? "#c084fc" : "#38dfff",
                      borderColor: isMythic
                        ? "rgba(192,132,252,.65)"
                        : "rgba(56,223,255,.65)",
                      boxShadow: isMythic
                        ? "0 0 16px rgba(192,132,252,.45)"
                        : "0 0 16px rgba(56,223,255,.45)",
                    }}
                  >
                    {isMythic ? "MYTHIC" : "HEROIC"}
                  </div>

                  
                  <div style={buyersText}>
 {getBuyerCount(run.id)} / {getBuyerSlots(run.id)}
</div>
                  <div style={getRunLocked(run.id) ? lockedText : activeText}>
  {getRunLocked(run.id) ? "● Locked" : "● Active"}
</div>

                  <Link
                    href={`/booking/${run.id}?week=${selectedWeek}`}
                    style={bookBtn}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px) scale(1.06)";
                      e.currentTarget.style.boxShadow =
                        "0 0 30px rgba(217,70,239,.95), inset 0 0 16px rgba(217,70,239,.35)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0) scale(1)";
                      e.currentTarget.style.boxShadow =
                        "0 0 14px rgba(168,85,247,.45)";
                    }}
                  >
                    View & Book
                  </Link>
                </div>
              );
            })}

            {filteredRuns.length === 0 && (
              <div style={emptyText}>No opened runs for this week yet.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div style={summaryRow}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={active ? filterActive : filterBtn}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px) scale(1.05)";
        e.currentTarget.style.boxShadow =
          "0 0 28px rgba(168,85,247,.9), inset 0 0 14px rgba(168,85,247,.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.boxShadow = active
          ? "0 0 22px rgba(250,204,21,.7)"
          : "0 0 12px rgba(168,85,247,.25)";
      }}
    >
      {label}
    </button>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  background:
    "linear-gradient(rgba(2,6,16,0.35), rgba(0,0,0,0.78)), url('/bg.png') center top / cover fixed",
  position: "relative",
  overflow: "hidden",
  paddingBottom: 80,
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "250px 1fr",
  gap: 26,
  padding: 22,
  position: "relative",
  zIndex: 2,
};

const content: React.CSSProperties = {
  minWidth: 0,
};

const sidebar: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(8,8,22,.92), rgba(3,5,12,.96))",
  border: "1px solid rgba(168,85,247,.25)",
  borderRadius: 18,
  padding: 20,
  height: "fit-content",
  boxShadow:
    "0 0 28px rgba(0,0,0,.65), inset 0 0 18px rgba(168,85,247,.08)",
};

const sidebarLogo: React.CSSProperties = {
  fontSize: 42,
  textAlign: "center",
  marginBottom: 14,
  textShadow: "0 0 18px rgba(168,85,247,.9)",
};

const smallTitle: React.CSSProperties = {
  color: "#d8b4fe",
  fontWeight: 1000,
  fontSize: 13,
  marginBottom: 14,
  letterSpacing: 1.4,
};

const sideItem: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  marginBottom: 7,
  color: "#e5e7eb",
  fontWeight: 800,
};

const sideActive: React.CSSProperties = {
  ...sideItem,
  background:
    "linear-gradient(90deg, rgba(126,34,206,.75), rgba(88,28,135,.55))",
  color: "white",
  boxShadow: "0 0 18px rgba(168,85,247,.35)",
};

const summaryBox: React.CSSProperties = {
  marginTop: 22,
  border: "1px solid rgba(168,85,247,.22)",
  borderRadius: 14,
  padding: 16,
  background: "rgba(0,0,0,0.32)",
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 11,
  color: "#d1d5db",
  fontWeight: 700,
};

const heroBox: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  marginBottom: 22,
};

const title: React.CSSProperties = {
  fontSize: 54,
  fontWeight: 1000,
  margin: "4px 0 6px",
  textShadow:
    "0 0 18px rgba(168,85,247,.75), 0 0 4px rgba(255,255,255,.7)",
};

const subtitle: React.CSSProperties = {
  color: "#d8d3e8",
  fontSize: 16,
  margin: 0,
};

const filterBox: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(168,85,247,.25)",
  background: "rgba(5,0,20,.62)",
  boxShadow: "0 0 20px rgba(168,85,247,.18)",
};

const filterBtn: React.CSSProperties = {
  padding: "11px 18px",
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,.45)",
  background: "rgba(12,4,28,.9)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  transition: "all .18s ease",
  boxShadow: "0 0 12px rgba(168,85,247,.25)",
};

const filterActive: React.CSSProperties = {
  ...filterBtn,
  border: "1px solid #facc15",
  background:
    "linear-gradient(180deg, rgba(95,60,8,.95), rgba(20,8,0,.98))",
  color: "#fff7cc",
  boxShadow: "0 0 22px rgba(250,204,21,.7)",
};

const weekTabs: React.CSSProperties = {
  display: "flex",
  gap: 14,
  marginBottom: 24,
  flexWrap: "wrap",
};

const weekBtn: React.CSSProperties = {
  width: 185,
  height: 78,
  borderRadius: 16,
  border: "1px solid rgba(168,85,247,.32)",
  background:
    "linear-gradient(180deg, rgba(10,3,25,.82), rgba(0,0,0,.72))",
  color: "#e9d5ff",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 6,
  cursor: "pointer",
  transition: "all .18s ease",
  boxShadow: "0 0 12px rgba(168,85,247,.25)",
};

const weekActive: React.CSSProperties = {
  ...weekBtn,
  border: "1px solid #facc15",
  background:
    "linear-gradient(135deg, rgba(126,34,206,.95), rgba(217,70,239,.85))",
  color: "white",
  boxShadow:
    "0 0 28px rgba(250,204,21,.85), inset 0 0 18px rgba(250,204,21,.25)",
};

const table: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(4,9,18,.95), rgba(3,4,10,.92))",
  border: "1px solid rgba(168,85,247,.18)",
  borderRadius: 18,
  overflow: "hidden",
  boxShadow:
    "0 0 35px rgba(0,0,0,.65), inset 0 0 22px rgba(168,85,247,.06)",
};

const tableHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 2.4fr 1fr 1fr 1fr 1.1fr",
  padding: "17px 20px",
  color: "#d8b4fe",
  fontSize: 12,
  fontWeight: 1000,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  letterSpacing: 1,
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 2.4fr 1fr 1fr 1fr 1.1fr",
  padding: "18px 20px",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  fontWeight: 800,
};

const miniText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#b8b8c7",
};

const difficultyPill: React.CSSProperties = {
  width: "fit-content",
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid",
  fontWeight: 1000,
  background: "rgba(0,0,0,.35)",
};

const buyersText: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 1000,
};


const activeText: React.CSSProperties = {
  color: "#22c55e",
  fontWeight: 1000,
  textShadow: "0 0 12px rgba(34,197,94,.45)",
};
const lockedText: React.CSSProperties = {
  color: "#ef4444",
  fontWeight: 1000,
  textShadow: "0 0 12px rgba(239,68,68,.55)",
};

const bookBtn: React.CSSProperties = {
  width: "fit-content",
  padding: "11px 18px",
  borderRadius: 12,
  border: "1px solid rgba(217,70,239,0.55)",
  background: "linear-gradient(90deg,#581c87,#a21caf)",
  color: "white",
  fontWeight: 1000,
  textDecoration: "none",
  boxShadow: "0 0 14px rgba(168,85,247,0.45)",
  transition: "all .18s ease",
};

const emptyText: React.CSSProperties = {
  padding: 34,
  color: "#c4b5fd",
  fontWeight: 900,
  textAlign: "center",
};

const fogOne: React.CSSProperties = {
  position: "fixed",
  top: "8%",
  left: "-8%",
  width: 620,
  height: 620,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(168,85,247,.28), transparent 70%)",
  filter: "blur(70px)",
  pointerEvents: "none",
  zIndex: 1,
};

const fogTwo: React.CSSProperties = {
  position: "fixed",
  bottom: "-12%",
  right: "-10%",
  width: 800,
  height: 800,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(14,165,233,.22), transparent 70%)",
  filter: "blur(80px)",
  pointerEvents: "none",
  zIndex: 1,
};

const castleGlow: React.CSSProperties = {
  position: "fixed",
  top: 40,
  right: 80,
  width: 520,
  height: 620,
  background:
    "radial-gradient(circle at 50% 18%, rgba(168,85,247,.45), rgba(168,85,247,.12), transparent 70%)",
  filter: "blur(34px)",
  mixBlendMode: "screen",
  pointerEvents: "none",
  zIndex: 1,
};