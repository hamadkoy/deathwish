"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SideNav from "@/app/components/SideNav";

type GuildRole =
  | "Guild Master"
  | "Officer"
  | "Death Wish"
  | "Raider"
  | "Trial";

type Profile = {
  user_id: string;
  discord_name?: string;
  avatar_url?: string;
  guild_role?: string;
  main_character?: string;
  main_realm?: string;
  signup_approved?: boolean;
};

const guildRoleOrder: Record<GuildRole, number> = {
  "Guild Master": 0,
  Officer: 1,
  "Death Wish": 2,
  Raider: 3,
  Trial: 4,
};

export default function GuildRanksPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();

    const channel = supabase
      .channel("realtime-guild-ranks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => loadUsers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadUsers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("accepted_application", true)
      .order("discord_name", { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setUsers(data || []);
    setLoading(false);
  }

  async function updateGuildRank(userId: string, guildRole: GuildRole) {
    const { error } = await supabase
      .from("profiles")
      .update({ guild_role: guildRole })
      .eq("user_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadUsers();
  }

  async function revokeAccess(userId: string) {
    if (!confirm("Revoke this user's guild access?")) return;

    const { error } = await supabase
      .from("profiles")
.update({
  signup_approved: false,
  accepted_application: false,
  guild_role: "Trial",
})

      .eq("user_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadUsers();
  }

  const filteredUsers = useMemo(() => {
    return [...users]
      .filter((u) =>
        (u.discord_name || "").toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        const aRole = normalizeGuildRole(a.guild_role);
        const bRole = normalizeGuildRole(b.guild_role);

        const roleDiff = guildRoleOrder[aRole] - guildRoleOrder[bRole];
        if (roleDiff !== 0) return roleDiff;

        return (a.discord_name || "").localeCompare(b.discord_name || "");
      });
  }, [users, search]);

  const counts = {
    total: users.length,
    guildMaster: users.filter(
      (u) => normalizeGuildRole(u.guild_role) === "Guild Master"
    ).length,
    officer: users.filter(
      (u) => normalizeGuildRole(u.guild_role) === "Officer"
    ).length,
    deathWish: users.filter(
      (u) => normalizeGuildRole(u.guild_role) === "Death Wish"
    ).length,
    raider: users.filter(
      (u) => normalizeGuildRole(u.guild_role) === "Raider"
    ).length,
    trial: users.filter(
      (u) => normalizeGuildRole(u.guild_role) === "Trial"
    ).length,
  };

  return (
    <div style={page}>
      <div style={layout}>
        <aside style={sidebar}>
          <SideNav active="Guild Ranks" />
        </aside>

        <main>
          <h1 style={title}>Guild Ranks</h1>
          <p style={subtitle}>
            Manage guild-only ranks separately from website access roles.
          </p>

          <div style={statsGrid}>
            <Stat title="Total Members" value={counts.total} color="#c084fc" />
            <Stat title="Guild Master" value={counts.guildMaster} color="#facc15" />
            <Stat title="Officer" value={counts.officer} color="#fb7185" />
            <Stat title="Death Wish" value={counts.deathWish} color="#a78bfa" />
            <Stat title="Raider" value={counts.raider} color="#38bdf8" />
            <Stat title="Trial" value={counts.trial} color="#94a3b8" />
          </div>

          <div style={panel}>
            <div style={topRow}>
              <input
                placeholder="Search by Discord name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={input}
              />
            </div>

            <div style={tableHead}>
              <div>User</div>
              <div>Main Character</div>
              <div>Guild Rank</div>
              <div>Signup Access</div>
              <div>Actions</div>
            </div>

            {loading ? (
              <div style={empty}>Loading guild members...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={empty}>No approved guild members found.</div>
            ) : (
              filteredUsers.map((user) => {
                const rank = normalizeGuildRole(user.guild_role);
                const isOwner =
                  (user.discord_name || "").toLowerCase() === "koyjin";

                return (
                  <div key={user.user_id} style={tableRow}>
                    <div style={userCell}>
                      <img
                        src={user.avatar_url || "/logo.png"}
                        style={avatar}
                        alt=""
                      />

                      <div>
                        <div style={userName}>
                          {getGuildRoleIcon(rank)}{" "}
                          {user.discord_name || "Unknown"}
                        </div>
                        <div style={userId}>{user.user_id}</div>
                      </div>
                    </div>

                    <div>
                      {user.main_character ? (
                        <div style={mainChar}>
                          {user.main_character}
                          {user.main_realm ? ` - ${user.main_realm}` : ""}
                        </div>
                      ) : (
                        <span style={muted}>No main linked</span>
                      )}
                    </div>

                    <div>
                      <div
                        style={{
                          ...rankBadge,
                          borderColor: getGuildRoleColor(rank),
                          color: getGuildRoleColor(rank),
                          boxShadow: `0 0 14px ${getGuildRoleColor(rank)}55`,
                        }}
                      >
                        {getGuildRoleIcon(rank)} {rank}
                      </div>
                    </div>

                    <div>
                      <span style={approved}>✓ Approved</span>
                    </div>

                    <div style={actions}>
                      <select
                        value={rank}
                        onChange={(e) =>
                          updateGuildRank(
                            user.user_id,
                            e.target.value as GuildRole
                          )
                        }
                        style={select}
                        disabled={isOwner}
                      >
                        <option value="Guild Master">Guild Master</option>
                        <option value="Officer">Officer</option>
                        <option value="Death Wish">Death Wish</option>
                        <option value="Raider">Raider</option>
                        <option value="Trial">Trial</option>
                      </select>

                      {isOwner ? (
                        <button style={ownerBtn} disabled>
                          👑 Owner
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => revokeAccess(user.user_id)}
                          style={revokeBtn}
                        >
                          Revoke Access
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function normalizeGuildRole(role?: string | null): GuildRole {
  if (role === "Guild Master") return "Guild Master";
  if (role === "Officer") return "Officer";
  if (role === "Death Wish") return "Death Wish";
  if (role === "Raider") return "Raider";
  return "Trial";
}

function getGuildRoleIcon(role: GuildRole) {
  if (role === "Guild Master") return "👑";
  if (role === "Officer") return "🛡️";
  if (role === "Death Wish") return "💀";
  if (role === "Raider") return "⚔️";
  return "🧪";
}

function getGuildRoleColor(role: GuildRole) {
  if (role === "Guild Master") return "#facc15";
  if (role === "Officer") return "#fb7185";
  if (role === "Death Wish") return "#a78bfa";
  if (role === "Raider") return "#38bdf8";
  return "#94a3b8";
}

function Stat({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div style={statBox}>
      <div style={statTitle}>{title}</div>
      <div style={{ ...statValue, color }}>{value}</div>
    </div>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  background:
    "linear-gradient(rgba(2,6,16,0.68), rgba(0,0,0,0.82)), url('/bg.png') center top / cover no-repeat fixed",
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "230px 1fr",
  gap: 24,
  padding: 24,
};

const sidebar: React.CSSProperties = {
  background: "rgba(7,10,20,0.88)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 18,
  height: "fit-content",
};

const title: React.CSSProperties = {
  fontSize: 48,
  fontWeight: 900,
  marginBottom: 6,
};

const subtitle: React.CSSProperties = {
  color: "#c4c4d4",
  marginBottom: 26,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
  gap: 16,
  marginBottom: 18,
};

const statBox: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(35,12,65,.92), rgba(5,10,22,.96))",
  border: "1px solid rgba(168,85,247,.22)",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 0 30px rgba(168,85,247,.12)",
};

const statTitle: React.CSSProperties = {
  color: "#e9d5ff",
  fontWeight: 900,
  fontSize: 18,
};

const statValue: React.CSSProperties = {
  marginTop: 10,
  fontSize: 46,
  fontWeight: 900,
};

const panel: React.CSSProperties = {
  background: "rgba(3,10,22,.92)",
  border: "1px solid rgba(255,255,255,.06)",
  borderRadius: 18,
  overflow: "hidden",
};

const topRow: React.CSSProperties = {
  padding: 16,
  borderBottom: "1px solid rgba(255,255,255,.06)",
};

const input: React.CSSProperties = {
  width: 340,
  height: 44,
  borderRadius: 10,
  border: "1px solid rgba(168,85,247,.35)",
  background: "rgba(0,0,0,.4)",
  color: "white",
  padding: "0 14px",
  outline: "none",
};

const tableHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1.2fr .9fr .8fr 1.4fr",
  padding: "16px 20px",
  background: "rgba(168,85,247,.08)",
  color: "#f0abfc",
  fontWeight: 900,
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1.2fr .9fr .8fr 1.4fr",
  alignItems: "center",
  padding: "16px 20px",
  borderTop: "1px solid rgba(255,255,255,.06)",
};

const userCell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const avatar: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(168,85,247,.55)",
};

const userName: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
};

const userId: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  marginTop: 4,
};

const mainChar: React.CSSProperties = {
  color: "#f5d0fe",
  fontWeight: 900,
};

const muted: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
};

const approved: React.CSSProperties = {
  color: "#22c55e",
  fontWeight: 900,
  fontSize: 20,
};

const actions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const select: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  background: "rgba(0,0,0,.4)",
  color: "white",
  border: "1px solid rgba(168,85,247,.35)",
  padding: "0 10px",
  fontWeight: 900,
};

const rankBadge: React.CSSProperties = {
  width: "fit-content",
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid",
  background: "rgba(0,0,0,.42)",
  fontWeight: 900,
};

const revokeBtn: React.CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid rgba(239,68,68,.45)",
  background: "rgba(127,29,29,.45)",
  color: "#f87171",
  fontWeight: 900,
  cursor: "pointer",
};

const ownerBtn: React.CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid rgba(250,204,21,.45)",
  background: "rgba(120,90,10,.38)",
  color: "#facc15",
  fontWeight: 900,
  cursor: "not-allowed",
};

const empty: React.CSSProperties = {
  padding: 30,
  color: "#9ca3af",
};