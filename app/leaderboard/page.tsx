"use client";

import { useEffect, useMemo, useState } from "react";
import SideNav from "@/app/components/SideNav";
import { supabase } from "@/lib/supabase";

type Player = {
  name: string;
  discordId: string;
  totalGold: number;
  runs: number;
  highestWeek?: any;
  avatar_url?: string;
  site_role?: string;
  profile_user_id?: string;
};

type SiteRole =
  | "Lost_soul"
  | "Reaper"
  | "Soulreaper"
  | "Nightblade"
  | "Dreadlord";

function normalizeRole(role?: string | null): SiteRole {
  if (role === "Dreadlord" || role === "admin" || role === "Deathlord")
    return "Dreadlord";

  if (role === "Nightblade" || role === "officer" || role === "Deathbringer")
    return "Nightblade";

  if (role === "Soulreaper") return "Soulreaper";

  if (role === "Reaper" || role === "Booster" || role === "booster")
    return "Reaper";

  return "Lost_soul";
}

function roleLabel(role?: string | null) {
  const r = normalizeRole(role);
  return r === "Lost_soul" ? "Lost Soul" : r;
}

function roleIcon(role?: string | null) {
  const r = normalizeRole(role);

  if (r === "Dreadlord") return "👑";
  if (r === "Nightblade") return "☠️";
  if (r === "Soulreaper") return "💀";
  if (r === "Reaper") return "⚔️";

  return "👻";
}

function rolePill(role?: string | null): React.CSSProperties {
  const r = normalizeRole(role);

  const colors: Record<SiteRole, any> = {
    Dreadlord: {
      color: "#facc15",
      border: "rgba(250,204,21,.55)",
      bg: "rgba(250,204,21,.12)",
    },
    Nightblade: {
      color: "#fb7185",
      border: "rgba(251,113,133,.55)",
      bg: "rgba(251,113,133,.12)",
    },
    Soulreaper: {
      color: "#c084fc",
      border: "rgba(192,132,252,.55)",
      bg: "rgba(192,132,252,.12)",
    },
    Reaper: {
      color: "#38bdf8",
      border: "rgba(56,189,248,.55)",
      bg: "rgba(56,189,248,.12)",
    },
    Lost_soul: {
      color: "#d1d5db",
      border: "rgba(156,163,175,.45)",
      bg: "rgba(156,163,175,.10)",
    },
  };

  const c = colors[r];

  return {
    minWidth: 112,
    justifyContent: "center",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "7px 12px",
    borderRadius: 999,
    color: c.color,
    background: c.bg,
    border: `1px solid ${c.border}`,
    fontWeight: 900,
    fontSize: 14,
    boxShadow: `0 0 14px ${c.bg}`,
  };
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [onlineDiscordIds, setOnlineDiscordIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    loadData();
    const cleanup = setupPresence();

    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, []);

  async function setupPresence() {
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    const myDiscordId =
      user?.user_metadata?.provider_id ||
      user?.user_metadata?.sub ||
      user?.user_metadata?.discord_id;

    const channel = supabase
      .channel("online-users")
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const presences = Object.values(state).flat() as any[];

        setOnlineUserIds(
          new Set(
            presences
              .map((p) => p.user_id || p.userId || p.id)
              .filter(Boolean)
              .map(String)
          )
        );

        setOnlineDiscordIds(
          new Set(
            presences
              .map((p) => p.discord_id || p.discordId)
              .filter(Boolean)
              .map(String)
          )
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && user) {
          await channel.track({
            user_id: user.id,
            discord_id: myDiscordId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => supabase.removeChannel(channel);
  }

  async function loadData() {
    const res = await fetch("/api/leaderboard", { cache: "no-store" });
    const data = await res.json();

    const leaderboard = data.leaderboard || [];

    const statPlayers = [
      data.stats?.topBooster,
      data.stats?.topRuns,
      data.stats?.highestWeek,
    ].filter(Boolean);

    const discordIds = [
      ...leaderboard.map((p: any) => String(p.discordId || "")),
      ...statPlayers.map((p: any) => String(p.discordId || "")),
    ].filter(Boolean);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, discord_id, discord_name, avatar_url, site_role")
      .in("discord_id", discordIds);

    const enrichPlayer = (p: any) => {
      if (!p) return p;

      const profile = profiles?.find(
        (x: any) =>
          String(x.discord_id || "").trim() ===
          String(p.discordId || "").trim()
      );

      return {
        ...p,
        name: profile?.discord_name || p.name,
        avatar_url:
          profile?.avatar_url?.trim() ||
          `https://cdn.discordapp.com/embed/avatars/${
            Number(p.discordId || 0) % 5
          }.png`,
        site_role: normalizeRole(profile?.site_role),
        profile_user_id: profile?.user_id,
      };
    };

    const enrichedLeaderboard = leaderboard.map(enrichPlayer);

    const highestWeekPlayer =
      enrichedLeaderboard.find(
        (p: any) =>
          String(p.discordId || "") ===
          String(data.stats?.highestWeek?.discordId || "")
      ) ||
      enrichedLeaderboard.find(
        (p: any) =>
          String(p.name || "").toLowerCase() ===
          String(data.stats?.highestWeek?.name || "").toLowerCase()
      ) ||
      enrichPlayer(data.stats?.highestWeek);

    setPlayers(enrichedLeaderboard);

    setStats({
      ...data.stats,
      topBooster: enrichPlayer(data.stats?.topBooster),
      topRuns: enrichPlayer(data.stats?.topRuns),
      highestWeekPlayer,
    });
  }

  function isOnline(p: Player) {
    return (
      onlineDiscordIds.has(String(p.discordId)) ||
      (!!p.profile_user_id && onlineUserIds.has(String(p.profile_user_id)))
    );
  }

  const topRows = useMemo(() => players.slice(0, 10), [players]);

  return (
    <div style={page}>
      <div style={overlay} />

      <div style={layout}>
        <aside>
          <SideNav active="Leaderboard" />
        </aside>

        <main style={main}>
          <div style={hero}>
            <div>
              <div style={kicker}>DEATH WISH RANKINGS</div>

              <h1 style={title}>Lifetime Leaderboard</h1>

              <p style={subtitle}>
Loading this page takes time as it pull data and calculate pots to determine ranking.
              </p>
            </div>

            <div style={liveBox}>● Live Synced</div>
          </div>

          <section style={table}>
            <div style={tableHead}>
              <div style={headCenter}>Rank</div>
              <div>Player</div>
              <div style={headCenter}>Role</div>
              <div style={headCenter}>Total Gold</div>
              <div style={headCenter}>Runs</div>
              <div style={headCenter}>Highest Week</div>
              <div style={headCenter}>Status</div>
            </div>

            {topRows.map((player, index) => (
              <div
                key={player.discordId || player.name}
                style={index === 0 ? firstRow : tableRow}
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
                  <img
                    src={player.avatar_url || "/logo.png"}
                    style={avatar}
                    alt=""
                  />

                  <div style={playerName}>{player.name}</div>
                </div>

                <div style={cellCenter}>
                  <div style={rolePill(player.site_role)}>
                    <span>{roleIcon(player.site_role)}</span>
                    {roleLabel(player.site_role)}
                  </div>
                </div>

                <div style={{ ...gold, textAlign: "center" }}>
                  {player.totalGold?.toLocaleString()} 🟡
                </div>

                <div style={{ ...runs, textAlign: "center" }}>
                  {player.runs?.toLocaleString() || "—"}
                </div>

                <div style={{ ...weekText, textAlign: "center" }}>
                  {player.highestWeek
                    ? `${player.highestWeek.amount.toLocaleString()}g`
                    : "—"}

                  {player.highestWeek && (
                    <div style={weekSub}>
                      {player.highestWeek.season} • {player.highestWeek.week}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    ...(isOnline(player) ? online : offline),
                    textAlign: "center",
                  }}
                >
                  ● {isOnline(player) ? "Online" : "Offline"}
                </div>
              </div>
            ))}
          </section>

          {stats && (
            <section style={statsGrid}>
              <StatCard
                title="👑 Top Booster"
                player={stats.topBooster}
                text={`${stats.topBooster?.totalGold?.toLocaleString()} gold earned`}
              />

              <StatCard
                title="⚡ Highest Week"
                player={stats.highestWeekPlayer}
                text={`${stats.highestWeek?.amount?.toLocaleString()}g`}
                sub={`${stats.highestWeek?.season} • ${stats.highestWeek?.week}`}
                big
              />

              <StatCard
                title="🏃 Most Runs"
                player={stats.topRuns}
                text={`${stats.topRuns?.runs?.toLocaleString()} runs completed`}
              />

              <StatCard
                title="💰 Total Gold"
                player={{
                  name: "Death Wish",
                  avatar_url: "/Death Wish Logo.png",
                }}
                text={`${stats.totalAllGold?.toLocaleString()}g combined`}
                guild
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({
  title,
  player,
  text,
  sub,
  big,
  guild,
}: {
  title: string;
  player?: any;
  text?: string;
  sub?: string;
  big?: boolean;
  guild?: boolean;
}) {
  return (
    <div style={big ? bigCard : card}>
      <div style={cardTitle}>{title}</div>

      <div style={cardContent}>
        <img
          src={player?.avatar_url || "/logo.png"}
          style={guild ? guildLogo : big ? bigCardAvatar : cardAvatar}
          alt=""
        />

        <div>
          <div style={cardName}>{player?.name || "—"}</div>

          <div style={big ? bigCardText : cardText}>{text || "—"}</div>

          {sub && <div style={cardSub}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "url('/bg.png') center/cover fixed",
  position: "relative",
  color: "white",
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background:
    "radial-gradient(circle at 55% 0%, rgba(168,85,247,.35), transparent 34%), radial-gradient(circle at 85% 20%, rgba(236,72,153,.13), transparent 30%), linear-gradient(rgba(2,6,23,.72), rgba(0,0,0,.95))",
};

const layout: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  gap: 26,
  padding: "22px",
};

const main: React.CSSProperties = {
  minWidth: 0,
  width: "100%",
  maxWidth: 1760,
  margin: "0 auto",
};

const hero: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
  padding: "10px 2px",
};

const kicker: React.CSSProperties = {
  color: "#c084fc",
  fontSize: 13,
  fontWeight: 1000,
  letterSpacing: "2px",
  marginBottom: 6,
};

const title: React.CSSProperties = {
  fontSize: 58,
  fontWeight: 1000,
  margin: 0,
  letterSpacing: ".5px",
  textShadow: "0 0 18px rgba(255,255,255,.45), 0 0 35px rgba(168,85,247,.95)",
};

const subtitle: React.CSSProperties = {
  color: "#ddd6fe",
  fontWeight: 800,
  marginTop: 8,
  fontSize: 16,
};

const liveBox: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(34,197,94,.25), rgba(5,150,105,.12))",
  color: "#86efac",
  border: "1px solid rgba(34,197,94,.55)",
  borderRadius: 999,
  padding: "12px 20px",
  fontWeight: 1000,
  boxShadow: "0 0 24px rgba(34,197,94,.2)",
};

const columns = "90px 390px 190px 280px 130px 360px 150px";

const table: React.CSSProperties = {
  width: "100%",
  background: "rgba(2,6,23,.86)",
  border: "1px solid rgba(168,85,247,.45)",
  borderRadius: 24,
  overflow: "hidden",
  backdropFilter: "blur(14px)",
  WebkitFontSmoothing: "antialiased",
};

const tableHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: columns,
  padding: "14px 22px",
  background: "linear-gradient(90deg, rgba(45,12,76,.98), rgba(15,23,42,.95))",
  color: "#d8b4fe",
  fontWeight: 1000,
  fontSize: 12,
  textTransform: "uppercase",
  alignItems: "center",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: columns,
  padding: "18px 22px",
  alignItems: "center",
  minHeight: 84,
  borderTop: "1px solid rgba(255,255,255,.06)",
  background: "linear-gradient(90deg, rgba(15,23,42,.38), rgba(2,6,23,.22))",
};

const firstRow: React.CSSProperties = {
  ...tableRow,
  background:
    "linear-gradient(90deg, rgba(250,204,21,.20), rgba(168,85,247,.08), rgba(2,6,23,.18))",
  boxShadow: "inset 0 0 34px rgba(250,204,21,.13)",
};

const headCenter: React.CSSProperties = {
  textAlign: "center",
};

const cellCenter: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const rank: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 1000,
  textAlign: "center",
};

const playerCell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const avatar: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(168,85,247,.75)",
  boxShadow: "0 0 20px rgba(168,85,247,.3)",
};

const playerName: React.CSSProperties = {
  fontSize: 23,
  fontWeight: 1000,
  color: "#f472b6",
  lineHeight: 1,
};

const gold: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 1000,
  fontSize: 22,
  textShadow: "0 0 13px rgba(250,204,21,.25)",
};

const runs: React.CSSProperties = {
  color: "#f8fafc",
  fontWeight: 1000,
  fontSize: 17,
};

const weekText: React.CSSProperties = {
  color: "#ffd43b",
  fontWeight: 900,
  fontSize: 20,
  letterSpacing: ".2px",
  lineHeight: 1.15,
  textShadow: "none",
  WebkitFontSmoothing: "antialiased",
};

const weekSub: React.CSSProperties = {
  color: "#d8b4fe",
  fontSize: 13,
  marginTop: 5,
  fontWeight: 700,
  letterSpacing: ".2px",
  lineHeight: 1.2,
  opacity: 0.95,
  textShadow: "none",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
};

const online: React.CSSProperties = {
  color: "#22c55e",
  fontWeight: 1000,
};

const offline: React.CSSProperties = {
  color: "#9ca3af",
  fontWeight: 1000,
};

const statsGrid: React.CSSProperties = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0,1fr))",
  gap: 16,
};

const card: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(15,23,42,.92), rgba(3,7,18,.94))",
  border: "1px solid rgba(168,85,247,.38)",
  borderRadius: 22,
  padding: 18,
  minHeight: 112,
  boxShadow: "0 0 30px rgba(168,85,247,.14)",
};

const bigCard: React.CSSProperties = {
  ...card,
  background: "linear-gradient(135deg, rgba(76,29,149,.55), rgba(3,7,18,.96))",
  border: "1px solid rgba(250,204,21,.42)",
  boxShadow: "0 0 36px rgba(250,204,21,.13), 0 0 30px rgba(168,85,247,.18)",
};

const cardTitle: React.CSSProperties = {
  color: "#c084fc",
  fontWeight: 1000,
  marginBottom: 12,
  textTransform: "uppercase",
};

const cardContent: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const cardAvatar: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(168,85,247,.55)",
};

const bigCardAvatar: React.CSSProperties = {
  ...cardAvatar,
  width: 62,
  height: 62,
  border: "2px solid rgba(250,204,21,.7)",
  boxShadow: "0 0 18px rgba(250,204,21,.2)",
};

const guildLogo: React.CSSProperties = {
  width: 72,
  height: 72,
  objectFit: "contain",
  padding: 6,
  borderRadius: "50%",
  background: "rgba(5,7,20,.92)",
  border: "2px solid rgba(250,204,21,.7)",
  boxShadow:
    "0 0 24px rgba(250,204,21,.18), inset 0 0 20px rgba(250,204,21,.08)",
};

const cardName: React.CSSProperties = {
  fontSize: 23,
  fontWeight: 1000,
  color: "#f9a8d4",
};

const cardText: React.CSSProperties = {
  color: "#f3f4f6",
  marginTop: 5,
  fontWeight: 900,
};

const bigCardText: React.CSSProperties = {
  color: "#facc15",
  marginTop: 5,
  fontWeight: 1000,
  fontSize: 19,
  textShadow: "0 0 12px rgba(250,204,21,.25)",
};

const cardSub: React.CSSProperties = {
  color: "#a78bfa",
  marginTop: 4,
  fontSize: 12,
  fontWeight: 800,
};