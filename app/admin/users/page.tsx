"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SideNav from "@/app/components/SideNav";

type SiteRole =
  | "Lost_soul"
  | "Wandering_soul"
  | "Reaper"
  | "Soulreaper"
  | "Nightblade"
  | "Dreadlord";

type Profile = {
  id?: number;
  user_id: string;
  discord_name?: string;
  avatar_url?: string;
  site_role?: string;
  signup_approved?: boolean;
  main_character?: string;
  main_realm?: string;
  raider_io?: string;
  application_note?: string;
  applied_at?: string | null;
};

type PromotionRequest = {
  id: number;
  user_id: string;
  discord_name?: string;
  discord_id?: string;
  current_balance?: number;
  requested_role: SiteRole;
  status: string;
  created_at?: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [promotionRequests, setPromotionRequests] = useState<PromotionRequest[]>([]);
  const [activeTab, setActiveTab] =
    useState<"team" | "applicants" | "promotions">("team");

  const [currentUserRole, setCurrentUserRole] =
    useState<SiteRole>("Lost_soul");

  useEffect(() => {
    loadCurrentUser();
    loadUsers();
    loadPromotionRequests();

    const profilesChannel = supabase
      .channel("realtime-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => loadUsers()
      )
      .subscribe();

    const promotionsChannel = supabase
      .channel("realtime-promotion-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "promotion_requests" },
        () => loadPromotionRequests()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(promotionsChannel);
    };
  }, []);

  async function loadCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("site_role")
      .eq("user_id", user.id)
      .single();

    setCurrentUserRole(normalizeRole(data?.site_role));
  }

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

    setUsers(data || []);
    setLoading(false);
  }

  async function loadPromotionRequests() {
    const { data, error } = await supabase
      .from("promotion_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setPromotionRequests(data || []);
  }

  async function updateUser(userId: string, updates: Partial<Profile>) {
    if (currentUserRole !== "Dreadlord") {
      alert("Only Dreadlords can manage user access.");
      return;
    }

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

  async function approvePromotion(req: PromotionRequest) {
    if (!isAdmin) return;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ site_role: req.requested_role })
      .eq("user_id", req.user_id);

    if (profileError) {
      alert(profileError.message);
      return;
    }

    const { error: requestError } = await supabase
      .from("promotion_requests")
      .update({ status: "approved" })
      .eq("id", req.id);

    if (requestError) {
      alert(requestError.message);
      return;
    }

    await loadUsers();
    await loadPromotionRequests();
  }

  async function rejectPromotion(req: PromotionRequest) {
    if (!isAdmin) return;

    const { error } = await supabase
      .from("promotion_requests")
      .update({ status: "rejected" })
      .eq("id", req.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadPromotionRequests();
  }

  const filteredUsers = useMemo(() => {
    let list = [...users];

    if (activeTab === "team") {
      list = list.filter((u) => u.signup_approved);

const roleOrder: Record<SiteRole, number> = {
  Dreadlord: 0,
  Nightblade: 1,
  Soulreaper: 2,
  Reaper: 3,
  Wandering_soul: 4,
  Lost_soul: 5,
};

      list.sort((a, b) => {
        const roleA = roleOrder[normalizeRole(a.site_role)];
        const roleB = roleOrder[normalizeRole(b.site_role)];

        if (roleA !== roleB) return roleA - roleB;

        return (a.discord_name || "").localeCompare(b.discord_name || "");
      });
    }

    if (activeTab === "applicants") {
      list = list.filter((u) => u.applied_at && !u.signup_approved);
    }

    return list.filter((u) =>
      (u.discord_name || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search, activeTab]);

  const totalUsers = users.length;
  const approvedUsers = users.filter((u) => u.signup_approved).length;
  const applicants = users.filter(
    (u) => u.applied_at && !u.signup_approved
  ).length;

  const dreadlords = users.filter(
    (u) => normalizeRole(u.site_role) === "Dreadlord"
  ).length;
  const wanderingSouls = users.filter(
  (u) => normalizeRole(u.site_role) === "Wandering_soul"
).length;
  const nightblades = users.filter(
    (u) => normalizeRole(u.site_role) === "Nightblade"
  ).length;
  const soulreapers = users.filter(
    (u) => normalizeRole(u.site_role) === "Soulreaper"
  ).length;
  const reapers = users.filter(
    (u) => normalizeRole(u.site_role) === "Reaper"
  ).length;

  const isAdmin = currentUserRole === "Dreadlord";
  const canSeeApplicants =
    currentUserRole === "Dreadlord" || currentUserRole === "Nightblade";

  return (
    <div style={page}>
      <div style={layout}>
        <aside style={sidebar}>
          <SideNav active="Admin Users" />
        </aside>

        <main>
          <h1 style={title}>User Management</h1>
          <p style={subtitle}>
            Approve new applicants and manage the Death Wish team.
          </p>

          <div style={statsGrid}>
            <Stat title="Total Users" value={totalUsers} color="#c084fc" />
            <Stat title="Approved" value={approvedUsers} color="#22c55e" />
            <Stat title="Applicants" value={applicants} color="#f97316" />
            <Stat title="Promotions" value={promotionRequests.length} color="#a855f7" />
            <Stat title="Dreadlords" value={dreadlords} color="#fb7185" />
            <Stat title="Nightblades" value={nightblades} color="#facc15" />
            <Stat title="Soulreapers" value={soulreapers} color="#a78bfa" />
            <Stat title="Reapers" value={reapers} color="#38bdf8" />
            <Stat title="Wandering Souls" value={wanderingSouls} color="#c4b5fd" />
          </div>

          <div style={panel}>
            <div style={tabs}>
              <button
                onClick={() => setActiveTab("team")}
                style={activeTab === "team" ? tabActive : tab}
              >
                Team
              </button>

              {canSeeApplicants && (
                <button
                  onClick={() => setActiveTab("applicants")}
                  style={activeTab === "applicants" ? tabActive : tab}
                >
                  New Applicants
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() => setActiveTab("promotions")}
                  style={activeTab === "promotions" ? tabActive : tab}
                >
                  Promotions ({promotionRequests.length})
                </button>
              )}
            </div>

            {activeTab !== "promotions" && (
              <div style={topRow}>
                <input
                  placeholder="Search by Discord name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={input}
                />
              </div>
            )}

            {activeTab === "promotions" ? (
              <div>
                <div style={promotionHead}>
                  <div>User</div>
                  <div>Balance</div>
                  <div>Requested Rank</div>
                  <div>Date</div>
                  <div>Actions</div>
                </div>

                {promotionRequests.length === 0 ? (
                  <div style={empty}>No promotion requests.</div>
                ) : (
                  promotionRequests.map((req) => (
                    <div key={req.id} style={promotionRow}>
                      <div>
                        <div style={userName}>{req.discord_name || "Unknown"}</div>
                        <div style={userId}>{req.discord_id || req.user_id}</div>
                      </div>

                      <div style={{ color: "#facc15", fontWeight: 900 }}>
                        {Number(req.current_balance || 0).toLocaleString()} gold
                      </div>

                      <div style={{ fontWeight: 900 }}>
                        {getRoleIcon(req.requested_role)} {req.requested_role}
                      </div>

                      <div style={muted}>
                        {req.created_at
                          ? new Date(req.created_at).toLocaleString()
                          : "-"}
                      </div>

                      <div style={actions}>
                        <button
                          style={approveBtn}
                          onClick={() => approvePromotion(req)}
                        >
                          Approve
                        </button>

                        <button
                          style={revokeBtn}
                          onClick={() => rejectPromotion(req)}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <>
                <div style={tableHead}>
                  <div>User</div>
                  <div>Main / Raider.IO</div>
                  <div>Role</div>
                  <div>Signup Access</div>
                  <div>Actions</div>
                </div>

                {loading ? (
                  <div style={empty}>Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                  <div style={empty}>No users found.</div>
                ) : (
                  filteredUsers.map((user) => (
                    <div key={user.user_id} style={tableRow}>
                      <div style={userCell}>
                        <img
                          src={user.avatar_url || "/logo.png"}
                          style={avatar}
                          alt=""
                        />

                        <div>
                          <div style={userName}>
                            {getRoleIcon(user.site_role)}{" "}
                            {user.discord_name || "Unknown"}
                          </div>
                          <div style={userId}>{user.user_id}</div>
                        </div>
                      </div>

                      <div style={mainInfo}>
                        <div style={mainChar}>
                          {user.main_character ? (
                            <>
                              {user.main_character}
                              {user.main_realm ? ` - ${user.main_realm}` : ""}
                            </>
                          ) : (
                            <span style={muted}>No main linked</span>
                          )}
                        </div>

                        {user.raider_io ? (
                          <a
                            href={user.raider_io}
                            target="_blank"
                            rel="noreferrer"
                            style={rioLink}
                          >
                            Raider.IO ↗
                          </a>
                        ) : (
                          <div style={muted}>No Raider.IO</div>
                        )}

                        {!user.signup_approved && user.application_note && (
                          <div style={note}>“{user.application_note}”</div>
                        )}

                        {!user.signup_approved && user.applied_at && (
                          <div style={appliedAt}>
                            Applied: {new Date(user.applied_at).toLocaleString()}
                          </div>
                        )}
                      </div>

                      <div>
<select
  value={normalizeRole(user.site_role)}
  onChange={(e) =>
    updateUser(user.user_id, {
      site_role: e.target.value as SiteRole,
    })
  }
  style={select}
  disabled={!isAdmin || isOwner(user)}
>
  <option value="Dreadlord">Dreadlord</option>
  <option value="Nightblade">Nightblade</option>
  <option value="Soulreaper">Soulreaper</option>
  <option value="Reaper">Reaper</option>
  <option value="Wandering_soul">Wandering Soul</option>
  <option value="Lost_soul">Lost Soul</option>
</select>
                      </div>

                      <div>
                        {user.signup_approved ? (
                          <span style={approved}>✓ Approved</span>
                        ) : (
                          <span style={notApproved}>✕ Pending</span>
                        )}
                      </div>

                      <div style={actions}>
                        {!isAdmin ? (
                          <span style={muted}>Dreadlord only</span>
                        ) : isOwner(user) ? (
                          <button style={ownerBtn} disabled>
                            👑 Owner
                          </button>
                        ) : user.signup_approved ? (
                          <button
                            onClick={() =>
                              updateUser(user.user_id, {
                                signup_approved: false,
                                site_role:
                                  normalizeRole(user.site_role) === "Dreadlord" ||
                                  normalizeRole(user.site_role) === "Nightblade"
                                    ? normalizeRole(user.site_role)
                                    : "Lost_soul",
                              })
                            }
                            style={revokeBtn}
                          >
                            Revoke Access
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() =>
                                updateUser(user.user_id, {
                                  signup_approved: true,
                                  site_role: "Wandering_soul",
                                  application_note: "",
                                  applied_at: null,
                                })
                              }
                              style={approveBtn}
                            >
                              Approve Signup
                            </button>

                            <button
                              onClick={() =>
                                updateUser(user.user_id, {
                                  signup_approved: false,
                                  applied_at: null,
                                  application_note: "",
                                  site_role: "Lost_soul",
                                })
                              }
                              style={revokeBtn}
                            >
                              Decline
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function normalizeRole(role?: string | null): SiteRole {
  if (role === "Dreadlord" || role === "admin" || role === "Deathlord") {
    return "Dreadlord";
  }

  if (role === "Nightblade" || role === "officer" || role === "Deathbringer") {
    return "Nightblade";
  }

  if (role === "Soulreaper") {
    return "Soulreaper";
  }

  if (role === "Reaper" || role === "Booster" || role === "booster") {
    return "Reaper";
  }

  if (role === "Wandering_soul" || role === "Wandering Soul") {
    return "Wandering_soul";
  }

  return "Lost_soul";
}

function isOwner(user: Profile) {
  return (user.discord_name || "").toLowerCase() === "koyjin";
}

function getRoleIcon(role?: string | null) {
  const fixedRole = normalizeRole(role);

  if (fixedRole === "Dreadlord") return "👑";
  if (fixedRole === "Nightblade") return "☠️";
  if (fixedRole === "Soulreaper") return "💀";
  if (fixedRole === "Reaper") return "⚔️";
  if (fixedRole === "Wandering_soul") return "👻";

  return "👻";
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

const tabs: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "16px 16px 0",
};

const tab: React.CSSProperties = {
  height: 42,
  padding: "0 22px",
  borderRadius: 10,
  border: "1px solid rgba(168,85,247,.35)",
  background: "rgba(0,0,0,.35)",
  color: "#d8b4fe",
  fontWeight: 900,
  cursor: "pointer",
};

const tabActive: React.CSSProperties = {
  ...tab,
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  color: "white",
  boxShadow: "0 0 18px rgba(217,70,239,.45)",
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
  gridTemplateColumns: "1.5fr 1.7fr .8fr 1fr 1fr",
  padding: "16px 20px",
  background: "rgba(168,85,247,.08)",
  color: "#f0abfc",
  fontWeight: 900,
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1.7fr .8fr 1fr 1fr",
  alignItems: "center",
  padding: "16px 20px",
  borderTop: "1px solid rgba(255,255,255,.06)",
};

const promotionHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1fr",
  padding: "16px 20px",
  background: "rgba(168,85,247,.08)",
  color: "#f0abfc",
  fontWeight: 900,
  marginTop: 16,
};

const promotionRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr 1fr",
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

const mainInfo: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const mainChar: React.CSSProperties = {
  color: "#f5d0fe",
  fontWeight: 900,
};

const rioLink: React.CSSProperties = {
  color: "#38bdf8",
  fontWeight: 900,
  textDecoration: "none",
};

const note: React.CSSProperties = {
  color: "#d1d5db",
  fontSize: 12,
  marginTop: 4,
};

const appliedAt: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 11,
};

const muted: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
};

const select: React.CSSProperties = {
  height: 38,
  borderRadius: 10,
  background: "rgba(0,0,0,.4)",
  color: "white",
  border: "1px solid rgba(168,85,247,.35)",
  padding: "0 10px",
};

const approved: React.CSSProperties = {
  color: "#22c55e",
  fontWeight: 900,
  fontSize: 20,
};

const notApproved: React.CSSProperties = {
  color: "#ef4444",
  fontWeight: 900,
  fontSize: 20,
};

const actions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const approveBtn: React.CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid rgba(34,197,94,.35)",
  background:
    "linear-gradient(180deg, rgba(22,101,52,.4), rgba(8,40,20,.55))",
  color: "#4ade80",
  fontWeight: 900,
  cursor: "pointer",
};

const revokeBtn: React.CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid rgba(239,68,68,.35)",
  background:
    "linear-gradient(180deg, rgba(127,29,29,.4), rgba(50,10,10,.55))",
  color: "#f87171",
  fontWeight: 900,
  cursor: "pointer",
};

const ownerBtn: React.CSSProperties = {
  height: 40,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid rgba(250,204,21,.45)",
  background:
    "linear-gradient(180deg, rgba(120,90,10,.38), rgba(60,40,0,.45))",
  color: "#facc15",
  fontWeight: 900,
  cursor: "not-allowed",
  boxShadow: "0 0 18px rgba(250,204,21,.18)",
};

const empty: React.CSSProperties = {
  padding: 30,
  color: "#9ca3af",
};