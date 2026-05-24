"use client";

import SideNav from "@/app/components/SideNav";

const players = [
  {
    name: "Koyjin",
    role: "Paladin",
    balance: 210532124,
    runs: 1462,
    logs: 137,
    highest: 70103500,
    active: "Online",
    avatar: "/renders/paladin.png",
  },
  {
    name: "Jdawee",
    role: "Shaman",
    balance: 128945002,
    runs: 982,
    logs: 0,
    highest: 62054500,
    active: "5m ago",
    avatar: "/renders/shaman.png",
  },
  {
    name: "Sylvanas",
    role: "Paladin",
    balance: 105228991,
    runs: 874,
    logs: 0,
    highest: 59205500,
    active: "18m ago",
    avatar: "/renders/paladin.png",
  },
];

export default function LeaderboardPage() {
  return (
    <div style={page}>
      <div style={layout}>
        <aside style={sidebar}>
          <SideNav active="Leaderboard" />

          <div style={infoBox}>
            <div style={infoTitle}>LEADERBOARD INFO</div>
            <p style={infoText}>
              This leaderboard shows total gold earned by each booster.
            </p>
          </div>
        </aside>

        <main style={main}>
          <h1 style={title}>Death Wish Lifetime Leaderboard</h1>
          <p style={subtitle}>
            Top 10 boosters ranked by total gold earned.
          </p>

          <div style={tabs}>
            <button style={tabActive}>All Time</button>
            <button style={tab}>War Within Season 1</button>
            <button style={tab}>War Within Season 2</button>
            <button style={tab}>Dragonflight Season 4</button>
          </div>

          <div style={table}>
            <div style={head}>
              <div>RANK</div>
              <div>PLAYER</div>
              <div>ROLE / CLASS</div>
              <div>TOTAL EARNED</div>
              <div>TOTAL RUNS</div>
              <div>LOGS</div>
              <div>HIGHEST SEASON</div>
              <div>LAST ACTIVE</div>
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

                <div style={playerCell}>
                  <img src={p.avatar} style={avatar} />
                  <b style={playerName}>{p.name}</b>
                </div>

                <div style={role}>{p.role}</div>

                <div style={gold}>
                  {p.balance.toLocaleString()} 🟡
                </div>

                <div>{p.runs.toLocaleString()}</div>

                <div>{p.logs || "—"}</div>

                <div style={gold}>
                  {p.highest.toLocaleString()} 🟡
                </div>

                <div
                  style={{
                    color: p.active === "Online" ? "#22c55e" : "#b9b4c9",
                    fontWeight: 800,
                  }}
                >
                  {p.active}
                </div>
              </div>
            ))}

            <div style={note}>
              Rewards are given for uploaded Warcraft Logs.{" "}
              <b style={{ color: "#facc15" }}>10,000g</b> per valid link.
            </div>
          </div>

          <div style={cards}>
            <Stat title="🏴 Most Active Booster" value="Koyjin" text="1,462 runs completed" />
            <Stat title="📊 Highest Single Week" value="Koyjin" text="8,111,000g" />
            <Stat title="👥 Most Logs Uploaded" value="deadlyshark" text="478 logs uploaded" />
            <Stat title="🏆 Top Mythic Booster" value="Koyjin" text="57,377,346g" />
          </div>
        </main>
      </div>
    </div>
  );
}

function Stat({ title, value, text }: any) {
  return (
    <div style={statCard}>
      <div style={statTitle}>{title}</div>
      <div style={statValue}>{value}</div>
      <div style={statText}>{text}</div>
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
  fontSize: 36,
  margin: 0,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  color: "#c4b5fd",
  marginBottom: 18,
};

const tabs: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 18,
};

const tab: React.CSSProperties = {
  padding: "12px 22px",
  borderRadius: 8,
  background: "rgba(0,0,0,0.45)",
  border: "1px solid rgba(168,85,247,0.18)",
  color: "#c4b5fd",
  fontWeight: 800,
};

const tabActive: React.CSSProperties = {
  ...tab,
  background: "rgba(124,58,237,0.35)",
  color: "white",
  boxShadow: "0 0 20px rgba(168,85,247,0.35)",
};

const table: React.CSSProperties = {
  border: "1px solid rgba(168,85,247,0.35)",
  borderRadius: 14,
  overflow: "hidden",
  background: "rgba(3,7,18,0.92)",
  boxShadow: "0 0 35px rgba(168,85,247,0.18)",
};

const head: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "80px 1.4fr 1fr 1.3fr 1fr .8fr 1.3fr 1fr",
  padding: "16px",
  color: "#c4b5fd",
  fontSize: 12,
  fontWeight: 900,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const row: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "80px 1.4fr 1fr 1.3fr 1fr .8fr 1.3fr 1fr",
  padding: "14px 16px",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

const topRow: React.CSSProperties = {
  ...row,
  background:
    "linear-gradient(90deg, rgba(250,204,21,0.18), rgba(0,0,0,0.2))",
  boxShadow: "inset 0 0 22px rgba(250,204,21,0.25)",
};

const rank: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
};

const playerCell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const avatar: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: "50%",
  objectFit: "cover",
  border: "1px solid rgba(255,255,255,0.25)",
};

const playerName: React.CSSProperties = {
  color: "#f472b6",
  fontSize: 17,
};

const role: React.CSSProperties = {
  color: "#38bdf8",
  fontWeight: 800,
};

const gold: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 900,
};

const note: React.CSSProperties = {
  padding: 14,
  textAlign: "center",
  color: "#c4b5fd",
};

const cards: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 14,
  marginTop: 18,
};

const statCard: React.CSSProperties = {
  background: "rgba(7,10,20,0.9)",
  border: "1px solid rgba(168,85,247,0.22)",
  borderRadius: 14,
  padding: 18,
};

const statTitle: React.CSSProperties = {
  color: "#c084fc",
  fontWeight: 900,
  marginBottom: 12,
};

const statValue: React.CSSProperties = {
  color: "#f472b6",
  fontSize: 20,
  fontWeight: 900,
};

const statText: React.CSSProperties = {
  color: "#b9b4c9",
  marginTop: 6,
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