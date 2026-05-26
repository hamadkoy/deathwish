"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, CalendarDays, Hourglass, BadgeCheck } from "lucide-react";
import SideNav from "@/app/components/SideNav";
import { supabase } from "@/lib/supabase";

type Cut = {
  id: number;
  date: string;
  run: string;
  character: string;
  cut: number;
  status: "Paid" | "Pending";
  source: string;
  note: string;
};

export default function BankPage() {
  const [balance, setBalance] = useState(0);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [muted, setMuted] = useState(() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("bankVideoMuted") === "true";
  }

  return true;
});
useEffect(() => {
  localStorage.setItem("bankVideoMuted", muted.toString());
}, [muted]);
 const [activeTab, setActiveTab] = useState("This Week");
const [history, setHistory] = useState<any[]>([]);
 const filteredCuts = useMemo(() => {
  if (activeTab === "Midnight Season 1 History") return [];
  return cuts;
}, [cuts, activeTab]);

  useEffect(() => {
    loadBalance();
  }, []);

async function loadBalance() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const discordId = user?.user_metadata?.provider_id;

    if (!discordId) {
      console.error("No Discord ID found");
      return;
    }

    const res = await fetch(`/api/bank?discordId=${discordId}`);
    const data = await res.json();

    console.log("BANK DATA:", data);

    setBalance(data.balance || 0);
    setCuts(data.cuts || []);
    setHistory(data.history || []);
  } catch (err) {
    console.error(err);
    setBalance(0);
    setCuts([]);
    setHistory([]);
  }
}

  const totalCuts = useMemo(
    () => cuts.reduce((sum, cut) => sum + cut.cut, 0),
    [cuts]
  );

  const pending = useMemo(
    () =>
      cuts
        .filter((c) => c.status === "Pending")
        .reduce((sum, cut) => sum + cut.cut, 0),
    [cuts]
  );
function formatRunType(run: string) {
  const text = (run || "").toUpperCase();

  if (text.includes("HC")) return "HEROIC";
  if (text.includes("M")) return "MYTHIC";

  return run || "-";
}
  const paid = useMemo(
    () =>
      cuts
        .filter((c) => c.status === "Paid")
        .reduce((sum, cut) => sum + cut.cut, 0),
    [cuts]
  );
    return (
  <div
    style={{
      position: "relative",
      minHeight: "100vh",
      overflow: "hidden",
    }}
  >
<video
  autoPlay
  muted={muted}
  loop
      playsInline
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        zIndex: -2,
        filter: "brightness(.65)",
      }}
    >
      <source src="/Bankpage.webm" type="video/webm" />
    </video>

    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "linear-gradient(rgba(2,6,16,.45), rgba(0,0,0,.72))",
        zIndex: -1,
      }}
    />
<div
  style={{
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 9999,
  }}
>
  <button
    onClick={() => setMuted(!muted)}
    style={{
      padding: "12px 18px",
      borderRadius: 14,
      border: "1px solid rgba(168,85,247,.45)",
      background:
        "linear-gradient(180deg,#c026d3,#7e22ce)",
      color: "white",
      fontWeight: 900,
      cursor: "pointer",
      boxShadow:
        "0 0 22px rgba(168,85,247,.55)",
      fontSize: 14,
    }}
  >
    {muted ? "🔇 Unmute Sound" : "🔊 Mute Sound"}
  </button>
</div>
    <div style={page}>
      <div style={layout}>
        <aside style={sidebar}>
<SideNav active="Bank" />
          <div style={balanceBox}>
            <div style={balanceTitle}>BALANCE OVERVIEW</div>
            <div style={balanceLabel}>Total Balance</div>
            <div style={balanceAmount}>
              {Number(balance || 0).toLocaleString()} 🟡
            </div>
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

        <main>
          <div style={headerRow}>
            <div>
              <h1 style={title}>Bank</h1>
              <p style={subtitle}>
                Track your gold, cuts, payments, and Discord bot rewards.
              </p>
            </div>

<button
  onClick={loadBalance}
  style={syncBtn}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-3px) scale(1.04)";
    e.currentTarget.style.boxShadow =
  "0 0 48px rgba(56,189,248,0.85), inset 0 0 28px rgba(255,255,255,0.14)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0) scale(1)";
   e.currentTarget.style.boxShadow =
  "0 0 35px rgba(56,189,248,0.4), inset 0 0 20px rgba(255,255,255,0.08)";
  }}
>
  <span
    style={{
      fontSize: 18,
      filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))",
    }}
  >
    ⟳
  </span>

  <span>Sync From Bot</span>
</button>
          </div>

          <div style={cards}>
            <StatCard title="Total Balance" value={balance} color="#facc15" />
            <StatCard title="This Week" value={totalCuts} color="#d946ef" />
            <PayoutCharacterCard character={cuts[0]?.character || "No character"} />
            <PaymentStatusCard cuts={cuts} />
          </div>
<div style={tabs}>
 {["This Week", "Midnight Season 1 History"].map((tabName) => (
    <button
      key={tabName}
      onClick={() => setActiveTab(tabName)}
      style={activeTab === tabName ? tabActive : tab}
      onMouseEnter={(e) => {
        if (activeTab !== tabName) {
          e.currentTarget.style.background = "rgba(124,58,237,0.22)";
          e.currentTarget.style.boxShadow =
            "0 0 18px rgba(168,85,247,0.45)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.color = "white";
        }
      }}
      onMouseLeave={(e) => {
        if (activeTab !== tabName) {
          e.currentTarget.style.background = "rgba(0,0,0,0.45)";
          e.currentTarget.style.boxShadow =
            "0 0 8px rgba(168,85,247,0.12)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.color = "#c4b5fd";
        }
      }}
    >
      {tabName}
    </button>
  ))}
</div>


          <div style={table}>
            <div style={tableHead}>
              <div>RUN Day</div>
              <div>TYPE OF RUN</div>
              <div>CHARACTER</div>
              <div>CUT</div>
              <div>STATUS</div>
              <div>SOURCE</div>
              <div>NOTES</div>
            </div>

{activeTab === "Midnight Season 1 History" ? (
  <div
    style={{
      padding: 24,
      display: "grid",
      gap: 14,
    }}
  >


    {history.map((week: any, index: number) => (
      <div
        key={index}
style={{
  background:
    "linear-gradient(90deg, rgba(88,28,135,.28), rgba(5,10,20,.92))",
  border: "1px solid rgba(168,85,247,.32)",
  borderRadius: 18,
  padding: "22px 28px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  boxShadow: "0 0 22px rgba(168,85,247,.16)",
  transition: "all .2s ease",
  backdropFilter: "blur(6px)",
}}
      >
        <div
          style={{
            fontWeight: 900,
            color: "#d8b4fe",
            fontSize: 24,
letterSpacing: .5,
          }}
        >
          {week.week}
        </div>

        <div
          style={{
            color: "#facc15",
            fontWeight: 900,
            fontSize: 28,
textShadow: "0 0 14px rgba(250,204,21,.35)",
          }}
        >
          {Number(week.amount || 0).toLocaleString()}g
        </div>
      </div>
    ))}
  </div>
) : (
  filteredCuts.map((cut) => (
              <div key={cut.id} style={tableRow}>
                <div>{cut.date}</div>
<div>
  <span style={runBadge(formatRunType(cut.run))}>
    {formatRunType(cut.run)}
  </span>
</div>
                <div style={charText}>{cut.character}</div>
                <div style={goldText}>{cut.cut.toLocaleString()}g</div>
                <div>
                  <span style={cut.status === "Paid" ? paidBadge : pendingBadge}>
                    {cut.status}
                  </span>
                </div>
                <div>{cut.source}</div>
                <div>{cut.note || "-"}</div>
              </div>
       ))
)}

            <div style={note}>Showing {filteredCuts.length} cuts from bot.</div>
          </div>
        </main>

        <aside style={rightbar}>
          <InfoCard title="BANK INFO">
            <Legend color="#22c55e" title="Paid" text="Gold already paid out." />
            <Legend color="#f59e0b" title="Pending" text="Gold waiting for payout." />
            <Legend color="#38bdf8" title="Source" text="Imported from your Discord bot." />
          </InfoCard>

          <InfoCard title="THIS WEEK SUMMARY">
            <Summary label="Runs" value={cuts.length} />
            <Summary label="Total Earned" value={totalCuts} color="#facc15" />
            <Summary label="Pending" value={pending} color="#fb923c" />
            <Summary label="Paid" value={paid} color="#22c55e" />
          </InfoCard>
        </aside>
      </div>
    </div>
    </div>
);
}
function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  const subtitle =
    title === "Total Balance"
      ? "All time balance"
      : title === "This Week"
      ? "From 19 May – 25 May"
      : title === "Pending Gold"
      ? "Waiting for payout"
      : "Successfully paid";

  return (
    <div style={statCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              title === "Total Balance"
                ? "rgba(250,204,21,0.12)"
                : title === "This Week"
                ? "rgba(217,70,239,0.12)"
                : title === "Pending Gold"
                ? "rgba(249,115,22,0.12)"
                : "rgba(34,197,94,0.12)",
            border:
              title === "Total Balance"
                ? "1px solid rgba(250,204,21,0.35)"
                : title === "This Week"
                ? "1px solid rgba(217,70,239,0.35)"
                : title === "Pending Gold"
                ? "1px solid rgba(249,115,22,0.35)"
                : "1px solid rgba(34,197,94,0.35)",
            boxShadow:
              title === "Total Balance"
                ? "0 0 22px rgba(250,204,21,0.28)"
                : title === "This Week"
                ? "0 0 22px rgba(217,70,239,0.28)"
                : title === "Pending Gold"
                ? "0 0 22px rgba(249,115,22,0.28)"
                : "0 0 22px rgba(34,197,94,0.28)",
          }}
        >
          {title === "Total Balance" ? (
            <Coins size={34} color="#facc15" />
          ) : title === "This Week" ? (
            <CalendarDays size={34} color="#d946ef" />
          ) : title === "Pending Gold" ? (
            <Hourglass size={34} color="#f97316" />
          ) : (
            <BadgeCheck size={34} color="#22c55e" />
          )}
        </div>

        <div>
          <div style={statTitle}>{title}</div>
          <div style={{ ...statValue, color }}>{value.toLocaleString()}g</div>
          <div style={statSubtitle}>{subtitle}</div>
        </div>
      </div>
    </div>
  );
}
function PayoutCharacterCard({ character }: { character: string }) {
  return (
    <div style={statCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(249,115,22,0.12)",
            border: "1px solid rgba(249,115,22,0.35)",
            boxShadow: "0 0 22px rgba(249,115,22,0.28)",
            fontSize: 32,
          }}
        >
          📬
        </div>

        <div>
          <div style={statTitle}>Payout Character</div>
          <div style={{ ...statValue, color: "#fb923c", fontSize: 24 }}>
            {character}
          </div>
          <div style={statSubtitle}>Gold mailed to this character</div>
        </div>
      </div>
    </div>
  );
}
function PaymentStatusCard({ cuts }: { cuts: Cut[] }) {
  const hasPending = cuts.some((c) => c.status === "Pending");

  const title = hasPending ? "Pending Gold" : "Paid Gold";

  const value = hasPending
    ? cuts
        .filter((c) => c.status === "Pending")
        .reduce((sum, c) => sum + c.cut, 0)
    : cuts
        .filter((c) => c.status === "Paid")
        .reduce((sum, c) => sum + c.cut, 0);

  const color = hasPending ? "#ef4444" : "#22c55e";

  const bg = hasPending
    ? "rgba(239,68,68,0.12)"
    : "rgba(34,197,94,0.12)";

  const border = hasPending
    ? "1px solid rgba(239,68,68,0.35)"
    : "1px solid rgba(34,197,94,0.35)";

  const glow = hasPending
    ? "0 0 22px rgba(239,68,68,0.28)"
    : "0 0 22px rgba(34,197,94,0.28)";

  return (
    <div style={statCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: bg,
            border,
            boxShadow: glow,
            fontSize: 32,
          }}
        >
          {hasPending ? "✖" : "✔"}
        </div>

        <div>
          <div style={statTitle}>{title}</div>

          <div
            style={{
              ...statValue,
              color,
            }}
          >
            {value.toLocaleString()}g
          </div>

          <div style={statSubtitle}>
            {hasPending
              ? "Waiting for payout"
              : "Successfully paid"}
          </div>
        </div>
      </div>
    </div>
  );
}
function SmallTitle({ children }: { children: React.ReactNode }) {
  return <div style={smallTitle}>{children}</div>;
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={infoCard}>
      <h3 style={infoTitle}>{title}</h3>
      {children}
    </div>
  );
}

function Legend({ color, title, text }: { color: string; title: string; text: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color, fontSize: 20, fontWeight: 900 }}>• {title}</div>
      <p style={muted}>{text}</p>
    </div>
  );
}

function Summary({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={summaryRow}>
      <span>{label}</span>
      <b style={{ color: color || "white" }}>
        {value > 1000 ? `${value.toLocaleString()}g` : value}
      </b>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  fontFamily: "Arial, sans-serif",
  background: "transparent",
  position: "relative",
  zIndex: 1,
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

const rightbar: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 22,
};

const title: React.CSSProperties = {
  fontSize: 42,
  margin: 0,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  color: "#b9b4c9",
};

const syncBtn: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  height: 58,
  padding: "0 34px",
  borderRadius: 16,
  border: "1px solid rgba(56,189,248,0.75)",
  background:
    "linear-gradient(135deg, rgba(8,47,73,1), rgba(14,116,144,1))",
  color: "#e0f2fe",
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  cursor: "pointer",
  overflow: "hidden",
  boxShadow:
    "0 0 35px rgba(56,189,248,0.4), inset 0 0 20px rgba(255,255,255,0.08)",
  transition: "all 0.22s ease",
};

const cards: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 16,
  marginBottom: 24,
};

const statCard: React.CSSProperties = {
  background: "rgba(7,10,20,0.88)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  padding: 28,
  minHeight: 150,
  boxSizing: "border-box",
};

const statTitle: React.CSSProperties = {
  color: "#d8b4fe",
  fontWeight: 900,
  marginBottom: 12,
};

const statValue: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
};

const statSubtitle: React.CSSProperties = {
  marginTop: 8,
  color: "#9ca3af",
  fontSize: 14,
};

const tabs: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 14,
};

const tabActive: React.CSSProperties = {
  border: "1px solid rgba(217,70,239,0.85)",
  borderRadius: 10,
  padding: "13px 30px",
  background: "linear-gradient(90deg,#6d28d9,#c026d3)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 18px rgba(217,70,239,0.55)",
  transition: "all 0.2s ease",
};

const tab: React.CSSProperties = {
  border: "1px solid rgba(168,85,247,0.22)",
  borderRadius: 10,
  padding: "13px 30px",
  background: "rgba(0,0,0,0.45)",
  color: "#c4b5fd",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 8px rgba(168,85,247,0.12)",
  transition: "all 0.2s ease",
};

const table: React.CSSProperties = {
  background: "rgba(4,9,18,0.94)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  overflow: "hidden",
};

const tableHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.6fr 1fr 1fr 1fr 1fr 1fr",
  padding: "14px 16px",
  fontSize: 12,
  color: "#d6bfff",
  fontWeight: 900,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.6fr 1fr 1fr 1fr 1fr 1fr",
  padding: "18px 16px",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
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

const note: React.CSSProperties = {
  padding: 16,
  color: "#9ca3af",
  fontSize: 13,
};

const smallTitle: React.CSSProperties = {
  color: "#8b5cf6",
  fontWeight: 900,
  marginBottom: 14,
  fontSize: 13,
  letterSpacing: 1,
};

const sideItem: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  marginBottom: 6,
  color: "#c7c7d1",
  fontWeight: 700,
};

const sideActive: React.CSSProperties = {
  ...sideItem,
  background: "rgba(139,92,246,0.24)",
  color: "white",
};

const balanceBox: React.CSSProperties = {
  marginTop: 18,
  background: "linear-gradient(180deg, rgba(12,22,36,0.95), rgba(6,12,22,0.95))",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 14,
  padding: 18,
};

const balanceTitle: React.CSSProperties = {
  color: "#9ca3af",
  fontWeight: 900,
  fontSize: 14,
  marginBottom: 18,
};

const balanceLabel: React.CSSProperties = {
  color: "#e5e7eb",
  marginBottom: 10,
};

const balanceAmount: React.CSSProperties = {
  color: "#facc15",
  fontSize: 24,
  fontWeight: 900,
  marginBottom: 18,
};

const paymentBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: "1px solid rgba(139,92,246,0.35)",
  borderRadius: 10,
  background: "linear-gradient(90deg,#3b0764,#6d28d9)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const discordBox: React.CSSProperties = {
  marginTop: 28,
  background: "rgba(139,92,246,0.12)",
  border: "1px solid rgba(139,92,246,0.4)",
  borderRadius: 14,
  padding: 18,
};

const mutedSmall: React.CSSProperties = {
  color: "#bcbccc",
  fontSize: 13,
  lineHeight: 1.5,
};

const discordBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 16,
  height: 42,
  border: 0,
  borderRadius: 10,
  background: "linear-gradient(90deg,#7c3aed,#c026d3)",
  color: "white",
  fontWeight: 900,
};

const infoCard: React.CSSProperties = {
  background: "rgba(7,10,20,0.88)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 20,
};

const infoTitle: React.CSSProperties = {
  margin: "0 0 18px",
};

const muted: React.CSSProperties = {
  color: "#bcbcbc",
  lineHeight: 1.5,
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 14,
  color: "#d1d1d1",
  fontWeight: 700,
};
const historyEmpty: React.CSSProperties = {
  padding: 40,
  textAlign: "center",
  color: "#d8b4fe",
  fontSize: 22,
  fontWeight: 900,
};
const runBadge = (type: string): React.CSSProperties => {
  const isHeroic = type === "HEROIC";

  return {
    display: "inline-block",
    minWidth: 96,
    textAlign: "center",
    padding: "9px 18px",
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 900,
    color: isHeroic ? "#22d3ee" : "#d8b4fe",
    background: isHeroic
      ? "rgba(8,145,178,0.12)"
      : "rgba(126,34,206,0.16)",
    border: isHeroic
      ? "1px solid rgba(34,211,238,0.8)"
      : "1px solid rgba(216,180,254,0.75)",
    boxShadow: isHeroic
      ? "0 0 18px rgba(34,211,238,0.65)"
      : "0 0 18px rgba(168,85,247,0.65)",
  };
};