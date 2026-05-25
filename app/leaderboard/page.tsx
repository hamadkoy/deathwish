"use client";

import { useEffect, useState } from "react";
import SideNav from "@/app/components/SideNav";

type Player = {
  name: string;
  totalGold: number;
};

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();

        setPlayers(data || []);
      } catch (err) {
        console.error(err);
      }
    }

    loadLeaderboard();
  }, []);

  return (
    <div style={page}>
      <div style={layout}>
        <aside style={sidebar}>
          <SideNav active="Leaderboard" />

          <div style={infoBox}>
            <div style={infoTitle}>LEADERBOARD INFO</div>

            <p style={infoText}>
              This leaderboard shows the highest earning boosters
              from Death Wish.
            </p>
          </div>
        </aside>

        <main style={main}>
          <h1 style={title}>
            Death Wish Lifetime Leaderboard
          </h1>

          <p style={subtitle}>
            Top boosters ranked by total earned gold.
          </p>

          <div style={table}>
            <div style={head}>
              <div>RANK</div>
              <div>PLAYER</div>
              <div>TOTAL EARNED</div>
            </div>

            {players.map((p, index) => (
              <div
                key={p.name}
                style={index === 0 ? topRow : row}
              >
                <div style={rank}>
                  {index === 0
                    ? "👑"
                    : index === 1
                    ? "🥈"
                    : index === 2
                    ? "🥉"
                    : index + 1}
                </div>

                <div style={playerName}>
                  {p.name}
                </div>

                <div style={gold}>
                  {p.totalGold.toLocaleString()} 🟡
                </div>
              </div>
            ))}

            <div style={note}>
              Live leaderboard synced from Google Sheets.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  background:
    "linear-gradient(rgba(2,6,16,0.65), rgba(0,0,0,0.85)), url('/bg.png') center top / cover no-repeat fixed",
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  gap: 18,
  padding: 18,
};

const sidebar: React.CSSProperties = {
  background: "rgba(7,10,20,0.9)",
  border: "1px solid rgba(168,85,247,0.25)",
  borderRadius: 16,
  padding: 18,
  height: "fit-content",
};

const main: React.CSSProperties = {
  minWidth: 0,
};

const title: React.CSSProperties = {
  fontSize: 38,
  fontWeight: 900,
  marginBottom: 10,
};

const subtitle: React.CSSProperties = {
  color: "#c4b5fd",
  marginBottom: 22,
};

const table: React.CSSProperties = {
  border: "1px solid rgba(168,85,247,0.35)",
  borderRadius: 16,
  overflow: "hidden",
  background: "rgba(3,7,18,0.92)",
  boxShadow: "0 0 35px rgba(168,85,247,0.18)",
};

const head: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr 1fr",
  padding: "18px",
  color: "#c4b5fd",
  fontSize: 13,
  fontWeight: 900,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr 1fr",
  padding: "18px",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

const topRow: React.CSSProperties = {
  ...row,
  background:
    "linear-gradient(90deg, rgba(250,204,21,0.18), rgba(0,0,0,0.2))",
  boxShadow:
    "inset 0 0 22px rgba(250,204,21,0.25)",
};

const rank: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
};

const playerName: React.CSSProperties = {
  color: "#f472b6",
  fontWeight: 900,
  fontSize: 18,
};

const gold: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 900,
  fontSize: 18,
};

const note: React.CSSProperties = {
  padding: 18,
  textAlign: "center",
  color: "#c4b5fd",
};

const infoBox: React.CSSProperties = {
  marginTop: 18,
  background: "rgba(15,23,42,0.75)",
  border: "1px solid rgba(168,85,247,0.2)",
  borderRadius: 12,
  padding: 16,
};

const infoTitle: React.CSSProperties = {
  color: "#c4b5fd",
  fontWeight: 900,
  marginBottom: 10,
};

const infoText: React.CSSProperties = {
  color: "#d1d5db",
  lineHeight: 1.5,
};