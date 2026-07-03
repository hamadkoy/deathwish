"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SideNav from "@/app/components/SideNav";

type GuildRole =
  | "Guild Master"
  | "Officer"
  | "Death Wish"
  | "Raider"
  | "Trial"
  | "Guest";

type RankTab =
  | "All"
  | "Guild Master"
  | "Officer"
  | "Death Wish"
  | "Raider"
  | "Trial"
  | "Revoked";

type Profile = {
  user_id: string;
  discord_name?: string;
  avatar_url?: string;
  guild_role?: string;
  main_character?: string;
  main_realm?: string;
  signup_approved?: boolean;
  accepted_application?: boolean;
  guild_joined_at?: string | null;
};

const guildRoleOrder: Record<GuildRole, number> = {
  "Guild Master": 0,
  Officer: 1,
  "Death Wish": 2,
  Raider: 3,
  Trial: 4,
  Guest: 5,
};

const rankTabs: RankTab[] = [
  "All",
  "Guild Master",
  "Officer",
  "Death Wish",
  "Raider",
  "Trial",
  "Revoked",
];

export default function GuildRanksPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [applicantUserIds, setApplicantUserIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<RankTab>("All");
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("discord_name", { ascending: true });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const { data: appData } = await supabase
      .from("applications")
      .select("user_id")
      .not("user_id", "is", null);

    setApplicantUserIds(new Set((appData || []).map((a) => String(a.user_id))));
    setUsers(data || []);
    setLoading(false);
  }

  const isApprovedGuildUser = (u: Profile) => {
    const rank = normalizeGuildRole(u.guild_role);
    return u.accepted_application === true && rank !== "Guest";
  };

  const isRevokedUser = (u: Profile) => {
    return applicantUserIds.has(u.user_id) && u.accepted_application === false;
  };

  async function updateGuildRank(userId: string, guildRole: GuildRole) {
    const updates =
      guildRole === "Guest"
        ? {
            guild_role: "Guest",
            accepted_application: false,
            signup_approved: false,
          }
        : {
            guild_role: guildRole,
            accepted_application: true,
            signup_approved: true,
          };

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadUsers();
  }

  async function updateJoinedDate(userId: string, date: string) {
    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === userId ? { ...u, guild_joined_at: date || null } : u
      )
    );

    const { error } = await supabase
      .from("profiles")
      .update({ guild_joined_at: date || null })
      .eq("user_id", userId);

    if (error) alert(error.message);
  }

  async function updateDiscordName(userId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ discord_name: editingName })
      .eq("user_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingNameId(null);
    setEditingName("");
    await loadUsers();
  }

  async function revokeAccess(userId: string) {
    if (!confirm("Revoke this user's guild access?")) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        guild_role: "Guest",
        accepted_application: false,
        signup_approved: false,
      })
      .eq("user_id", userId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadUsers();
  }
async function restoreFromApplication(userId: string) {
  const { data: app } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  await updateGuildRank(userId, "Trial");

  if (!app) {
    alert("No application found for this user.");
    return;
  }

  const { data: existing } = await supabase
    .from("guild_characters")
    .select("id")
    .eq("user_id", userId)
    .eq("name", app.character_name)
    .maybeSingle();

  if (!existing) {
    await supabase.from("guild_characters").insert({
      user_id: userId,
      name: app.character_name,
      realm: app.realm,
      class: app.class,
      spec: app.spec,
      ilvl: app.ilvl,
      progress: app.raid_progress,
      mythic_plus_score: app.raider_io_score,
      avatar_url: app.avatar_url,
      is_main: true,
    });
  }

  await supabase
    .from("profiles")
    .update({
      main_character: app.character_name,
      main_realm: app.realm,
    })
    .eq("user_id", userId);

  await loadUsers();
}
  const filteredUsers = useMemo(() => {
    return [...users]
      .filter((u) => {
        const rank = normalizeGuildRole(u.guild_role);
        const approved = isApprovedGuildUser(u);
        const revoked = isRevokedUser(u);

        if (activeTab === "Revoked") return revoked;
        if (activeTab === "All") return approved;

        return approved && rank === activeTab;
      })
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
  }, [users, search, activeTab, applicantUserIds]);

  const activeUsers = users.filter((u) => isApprovedGuildUser(u));
  const revokedUsers = users.filter((u) => isRevokedUser(u));

  const counts = {
    total: activeUsers.length,
    guildMaster: activeUsers.filter(
      (u) => normalizeGuildRole(u.guild_role) === "Guild Master"
    ).length,
    officer: activeUsers.filter(
      (u) => normalizeGuildRole(u.guild_role) === "Officer"
    ).length,
    deathWish: activeUsers.filter(
      (u) => normalizeGuildRole(u.guild_role) === "Death Wish"
    ).length,
    raider: activeUsers.filter(
      (u) => normalizeGuildRole(u.guild_role) === "Raider"
    ).length,
    trial: activeUsers.filter(
      (u) => normalizeGuildRole(u.guild_role) === "Trial"
    ).length,
    revoked: revokedUsers.length,
  };

  function getTabCount(tab: RankTab) {
    if (tab === "All") return counts.total;
    if (tab === "Guild Master") return counts.guildMaster;
    if (tab === "Officer") return counts.officer;
    if (tab === "Death Wish") return counts.deathWish;
    if (tab === "Raider") return counts.raider;
    if (tab === "Trial") return counts.trial;
    if (tab === "Revoked") return counts.revoked;
    return 0;
  }

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
            <Stat title="Revoked" value={counts.revoked} color="#f87171" />
          </div>

          <div style={panel}>
            <div style={tabsRow}>
              {rankTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={activeTab === tab ? activeTabBtn : tabBtn}
                >
                  {tab}
                  <span style={tabCount}>{getTabCount(tab)}</span>
                </button>
              ))}
            </div>

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
              <div>Joined</div>
              <div>Actions</div>
            </div>

            {loading ? (
              <div style={empty}>Loading guild members...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={empty}>No users found in this tab.</div>
            ) : (
              filteredUsers.map((user) => {
                const rank = normalizeGuildRole(user.guild_role);
                const isOwner =
                  (user.discord_name || "").toLowerCase() === "koyjin";
                const isRevoked = isRevokedUser(user);
                const isApproved = isApprovedGuildUser(user);

                return (
                  <div key={user.user_id} style={tableRow}>
                    <div style={userCell}>
                      <img
                        src={user.avatar_url || "/logo.png"}
                        style={{ ...avatar, cursor: "pointer" }}
                        alt=""
                        title="View Garrison"
                        onClick={() => {
                          window.location.href = `/guild-garrison?user=${user.user_id}`;
                        }}
                      />

                      <div>
                        {editingNameId === user.user_id ? (
                          <input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => updateDiscordName(user.user_id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") updateDiscordName(user.user_id);
                              if (e.key === "Escape") {
                                setEditingNameId(null);
                                setEditingName("");
                              }
                            }}
                            style={{ ...input, width: 220 }}
                          />
                        ) : (
                          <div
                            style={{
                              ...userName,
                              cursor: "pointer",
                              color: "#f5d0fe",
                            }}
                            title="Click to edit name"
                            onClick={() => {
                              setEditingNameId(user.user_id);
                              setEditingName(user.discord_name || "");
                            }}
                          >
                            {getGuildRoleIcon(rank)} {user.discord_name || "Unknown"}
                          </div>
                        )}

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
                      {isApproved ? (
                        <span style={approved}>✓ Approved</span>
                      ) : isRevoked ? (
                        <span style={revokedText}>✕ Revoked</span>
                      ) : (
                        <span style={muted}>Pending</span>
                      )}
                    </div>

                    <div>
                      <input
                        type="date"
                        value={user.guild_joined_at || ""}
                        onChange={(e) =>
                          updateJoinedDate(user.user_id, e.target.value)
                        }
                        style={dateInput}
                      />
                    </div>

                    <div style={actions}>
                      <select
                        value={rank}
                        onChange={(e) =>
                          updateGuildRank(user.user_id, e.target.value as GuildRole)
                        }
                        style={select}
                        disabled={isOwner}
                      >
                        <option value="Guild Master">Guild Master</option>
                        <option value="Officer">Officer</option>
                        <option value="Death Wish">Death Wish</option>
                        <option value="Raider">Raider</option>
                        <option value="Trial">Trial</option>
                        <option value="Guest">Guest</option>
                      </select>

                      {isOwner ? (
                        <button style={ownerBtn} disabled>
                          👑 Owner
                        </button>
                      ) : isRevoked ? (
                        <button
                          type="button"
                         onClick={() => restoreFromApplication(user.user_id)}
                          style={restoreBtn}
                        >
                          Restore Trial
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
  if (role === "Trial") return "Trial";
  return "Guest";
}

function getGuildRoleIcon(role: GuildRole) {
  if (role === "Guild Master") return "👑";
  if (role === "Officer") return "🛡️";
  if (role === "Death Wish") return "💀";
  if (role === "Raider") return "⚔️";
  if (role === "Trial") return "🧪";
  return "👤";
}

function getGuildRoleColor(role: GuildRole) {
  if (role === "Guild Master") return "#facc15";
  if (role === "Officer") return "#fb7185";
  if (role === "Death Wish") return "#a78bfa";
  if (role === "Raider") return "#38bdf8";
  if (role === "Trial") return "#94a3b8";
  return "#f87171";
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

const tabsRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: 16,
  borderBottom: "1px solid rgba(255,255,255,.06)",
  flexWrap: "wrap",
};

const tabBtn: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid rgba(168,85,247,.35)",
  background: "rgba(0,0,0,.35)",
  color: "#c4b5fd",
  fontWeight: 900,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const activeTabBtn: React.CSSProperties = {
  ...tabBtn,
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  color: "white",
  boxShadow: "0 0 18px rgba(168,85,247,.55)",
};

const tabCount: React.CSSProperties = {
  minWidth: 22,
  height: 22,
  padding: "0 7px",
  borderRadius: 999,
  background: "rgba(0,0,0,.35)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
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
  gridTemplateColumns: "1.3fr 1.1fr .8fr .8fr .9fr 1.4fr",
  padding: "16px 20px",
  background: "rgba(168,85,247,.08)",
  color: "#f0abfc",
  fontWeight: 900,
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr 1.1fr .8fr .8fr .9fr 1.4fr",
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

const revokedText: React.CSSProperties = {
  color: "#f87171",
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

const dateInput: React.CSSProperties = {
  width: 145,
  height: 38,
  borderRadius: 8,
  border: "1px solid rgba(168,85,247,.35)",
  background: "rgba(0,0,0,.4)",
  color: "white",
  padding: "0 10px",
  fontWeight: 800,
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

const restoreBtn: React.CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid rgba(34,197,94,.45)",
  background: "rgba(20,83,45,.45)",
  color: "#4ade80",
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