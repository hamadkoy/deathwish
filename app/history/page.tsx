"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SideNav from "@/app/components/SideNav";

type Row = {
  type: string;
  week: string;
  character: string;
  cut: number;
  status: "Paid" | "Pending";
  source: string;
  runs?: number;
};

type Season = {
  name: string;
  total: number;
  runs: number;
  rows: Row[];
};

export default function HistoryPage() {
    const router = useRouter();
  const [activeSeason, setActiveSeason] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [totalGoldMade, setTotalGoldMade] = useState(0);
  const [highestSeasonGain, setHighestSeasonGain] = useState<any>(null);
  const [highestWeekGain, setHighestWeekGain] = useState<any>(null);
  const [numberOfRuns, setNumberOfRuns] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const discordIdentity = session?.user?.identities?.find(
      (i: any) => i.provider === "discord"
    );

    const discordId =
      discordIdentity?.identity_data?.provider_id ||
      discordIdentity?.identity_data?.sub ||
      session?.user?.user_metadata?.provider_id ||
      session?.user?.user_metadata?.sub;

    if (!discordId) {
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/bank-history?discordId=${discordId}`, {
      cache: "no-store",
    });

    const data = await res.json();

    setSeasons(data.seasons || []);
    setTotalGoldMade(data.totalGoldMade || 0);
    setHighestSeasonGain(data.highestSeasonGain || null);
    setHighestWeekGain(data.highestWeekGain || null);
    setNumberOfRuns(data.numberOfRuns || 0);

    if (data.seasons?.length > 0) {
      const firstWithGold = data.seasons?.find((s: any) => s.total > 0);
setActiveSeason(firstWithGold?.name || data.seasons?.[0]?.name || "");
    }

    setLoading(false);
  }

  const season = seasons.find((s) => s.name === activeSeason) || null;

  if (loading) {
    return <div style={centerPage}>Loading history...</div>;
  }

  if (!season) {
    return <div style={centerPage}>No season history found.</div>;
  }

  return (
    <div style={page}>
      <div style={overlay} />

      <div style={layout}>
        <aside>
          <SideNav active="Bank" />
        </aside>

        <main style={main}>
            <button
  onClick={() => router.back()}
  style={backButton}
>
  ← Return
</button>
          <h1 style={title}>All Seasons History</h1>

          <p style={subtitle}>
            Full lifetime boosting history by season, week, runs, and gold.
          </p>

          <div style={topCards}>
            <div style={statCard}>
              <div style={statLabel}>Total Gold Made</div>
              <div style={statGold}>{totalGoldMade.toLocaleString()}g</div>
            </div>

            <div style={statCard}>
              <div style={statLabel}>Highest Season Gain</div>
              <div style={statGold}>
                {(highestSeasonGain?.total || 0).toLocaleString()}g
              </div>
              <div style={statSmall}>{highestSeasonGain?.name || "-"}</div>
            </div>

            <div style={statCard}>
              <div style={statLabel}>Highest Week Gain</div>
              <div style={statGold}>
                {(highestWeekGain?.cut || 0).toLocaleString()}g
              </div>
              <div style={statSmall}>
                {highestWeekGain?.week || "-"} · {highestWeekGain?.season || "-"}
              </div>
            </div>

            <div style={statCard}>
              <div style={statLabel}>Number of Runs</div>
              <div style={statGold}>{numberOfRuns.toLocaleString()}</div>
            </div>
          </div>

          <div style={tabs}>
            {seasons.map((s) => (
              <button
                key={s.name}
                onClick={() => setActiveSeason(s.name)}
                style={activeSeason === s.name ? tabActive : tab}
              >
                {s.name}
              </button>
            ))}
          </div>

          <div style={seasonSummary}>
            <div>
              <div style={seasonName}>{season.name}</div>
              <div style={seasonRuns}>
                {season.runs.toLocaleString()} runs completed
              </div>
            </div>

            <div style={seasonGold}>{season.total.toLocaleString()}g</div>
          </div>

          <section style={table}>
<div style={tableHead}>
  <div>WEEK</div>
  <div>TYPE OF RUN</div>
  <div>CHARACTER</div>
  <div>CUT</div>
  <div>STATUS</div>
  <div>SOURCE</div>
  <div>NUMBER OF RUNS</div>
</div>

            {season.rows.length === 0 ? (
              <div style={emptyBox}>No history added for this season yet.</div>
            ) : (
              season.rows.map((row, index) => (
<div key={index} style={tableRow}>
  <div style={weekText}>{row.week}</div>

  <div>
    <span style={runBadge(row.type)}>{row.type}</span>
  </div>

  <div style={charText}>{row.character}</div>

  <div style={goldText}>{row.cut.toLocaleString()}g</div>

  <div>
    <span style={row.status === "Paid" ? paidBadge : pendingBadge}>
      {row.status}
    </span>
  </div>

  <div>{row.source}</div>

  <div style={runsText}>{row.runs?.toLocaleString() || 0}</div>
</div>
              ))
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

const centerPage: React.CSSProperties = {
  minHeight: "100vh",
  background: "black",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  fontWeight: 900,
  textAlign: "center",
};

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "url('/bg.png') center/cover fixed",
  color: "white",
  position: "relative",
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "linear-gradient(rgba(2,6,23,.72), rgba(0,0,0,.94))",
};

const layout: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  gap: 24,
  padding: 24,
};

const main: React.CSSProperties = {
  minWidth: 0,
};

const title: React.CSSProperties = {
  fontSize: 56,
  fontWeight: 1000,
  margin: 0,
  textShadow: "0 0 24px rgba(168,85,247,.7)",
};

const subtitle: React.CSSProperties = {
  color: "#d8b4fe",
  fontWeight: 800,
};

const topCards: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(260px, 1fr))",
  gap: 20,
  margin: "28px 0",
};

const statCard: React.CSSProperties = {
  background: "rgba(4,9,18,.96)",
  border: "1px solid rgba(168,85,247,.35)",
  borderRadius: 20,
  padding: "30px 34px",
  minHeight: 120,
  boxShadow: "0 0 24px rgba(168,85,247,.18)",
};

const statLabel: React.CSSProperties = {
  color: "#e9d5ff",
  fontWeight: 1000,
  fontSize: 17,
  letterSpacing: ".3px",
};
const statGold: React.CSSProperties = {
  color: "#facc15",
  fontSize: 38,
  fontWeight: 1000,
  marginTop: 12,
  lineHeight: 1,
  textShadow: "0 0 14px rgba(250,204,21,.35)",
};

const statSmall: React.CSSProperties = {
  color: "#d8b4fe",
  fontWeight: 900,
  marginTop: 12,
  fontSize: 15,
};

const tabs: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  margin: "24px 0",
};

const tab: React.CSSProperties = {
  padding: "13px 22px",
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,.25)",
  background: "rgba(0,0,0,.45)",
  color: "#c4b5fd",
  fontWeight: 900,
  cursor: "pointer",
};

const tabActive: React.CSSProperties = {
  ...tab,
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  color: "white",
  boxShadow: "0 0 24px rgba(217,70,239,.55)",
};

const seasonSummary: React.CSSProperties = {
  background: "rgba(4,9,18,.92)",
  border: "1px solid rgba(168,85,247,.35)",
  borderRadius: 18,
  padding: "22px 26px",
  marginBottom: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const seasonName: React.CSSProperties = {
  color: "#f9a8d4",
  fontSize: 28,
  fontWeight: 1000,
};

const seasonRuns: React.CSSProperties = {
  color: "#d8b4fe",
  marginTop: 6,
  fontWeight: 800,
};

const seasonGold: React.CSSProperties = {
  color: "#facc15",
  fontSize: 34,
  fontWeight: 1000,
  textShadow: "0 0 18px rgba(250,204,21,.35)",
};

const table: React.CSSProperties = {
  background: "rgba(4,9,18,.94)",
  border: "1px solid rgba(255,255,255,.09)",
  borderRadius: 16,
  overflow: "hidden",
};

const tableHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.2fr 1.5fr 1.2fr 1fr 1.3fr 1.2fr",
  padding: "18px 22px",
  fontSize: 14,
  color: "#d6bfff",
  fontWeight: 1000,
  borderBottom: "1px solid rgba(255,255,255,.08)",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.2fr 1.5fr 1.2fr 1fr 1.3fr 1.2fr",
  padding: "30px 22px",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,.05)",
  fontSize: 18,
  fontWeight: 800,
};

const emptyBox: React.CSSProperties = {
  padding: 50,
  textAlign: "center",
  color: "#d8b4fe",
  fontSize: 22,
  fontWeight: 900,
};

const charText: React.CSSProperties = {
  color: "#d946ef",
  fontWeight: 900,
};

const goldText: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 900,
};

const paidBadge: React.CSSProperties = {
  background: "rgba(34,197,94,0.18)",
  border: "1px solid rgba(34,197,94,0.35)",
  color: "#4ade80",
  padding: "7px 14px",
  borderRadius: 999,
  fontWeight: 900,
};

const pendingBadge: React.CSSProperties = {
  background: "rgba(245,158,11,0.16)",
  border: "1px solid rgba(245,158,11,0.35)",
  color: "#fbbf24",
  padding: "7px 14px",
  borderRadius: 999,
  fontWeight: 900,
};

const runBadge = (type: string): React.CSSProperties => ({
  display: "inline-block",
  minWidth: 96,
  textAlign: "center",
  padding: "9px 18px",
  borderRadius: 999,
  fontSize: 15,
  fontWeight: 900,
  color: "#d8b4fe",
  background: "rgba(126,34,206,0.16)",
  border: "1px solid rgba(216,180,254,0.75)",
  boxShadow: "0 0 18px rgba(168,85,247,0.65)",
});
const weekText: React.CSSProperties = {
  color: "white",
  fontWeight: 900,
};
const runsText: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 1000,
};
const backButton: React.CSSProperties = {
  padding: "12px 22px",
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,.35)",
  background: "rgba(10,10,20,.85)",
  color: "#f5d0fe",
  fontWeight: 1000,
  fontSize: 15,
  cursor: "pointer",
  marginBottom: 18,
  boxShadow: "0 0 18px rgba(168,85,247,.25)",
};