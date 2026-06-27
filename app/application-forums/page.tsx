"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Application = {
  id: string;
  user_id: string | null;
  character_name: string | null;
  realm: string | null;
  class: string | null;
  spec: string | null;
  avatar_url: string | null;
  discord_avatar_url: string | null;
  ilvl: number | null;
  raider_io_score: number | null;
  raid_progress: string | null;
  raider_io: string | null;
  warcraft_logs: string | null;
  status: string | null;
  created_at: string;
  application_note: string | null;
  note: string | null;
  accepted_by_name?: string | null;
  declined_by_name?: string | null;
};

const classColors: Record<string, string> = {
  "Death Knight": "#C41E3A",
  "Demon Hunter": "#A330C9",
  Druid: "#FF7C0A",
  Evoker: "#33937F",
  Hunter: "#AAD372",
  Mage: "#3FC7EB",
  Monk: "#00FF98",
  Paladin: "#F48CBA",
  Priest: "#FFFFFF",
  Rogue: "#FFF468",
  Shaman: "#0070DD",
  Warlock: "#8788EE",
  Warrior: "#C69B6D",
};

const classes = [
  "All Classes",
  "Death Knight",
  "Demon Hunter",
  "Druid",
  "Evoker",
  "Hunter",
  "Mage",
  "Monk",
  "Paladin",
  "Priest",
  "Rogue",
  "Shaman",
  "Warlock",
  "Warrior",
];

const roles = ["All Roles", "Tank", "Healer", "Melee DPS", "Ranged DPS"];

const tankSpecs = ["Protection", "Blood", "Guardian", "Brewmaster", "Vengeance"];
const healerSpecs = ["Holy", "Discipline", "Restoration", "Mistweaver", "Preservation"];
const meleeSpecs = [
  "Arms",
  "Fury",
  "Retribution",
  "Enhancement",
  "Feral",
  "Windwalker",
  "Havoc",
  "Frost",
  "Unholy",
  "Assassination",
  "Outlaw",
  "Subtlety",
  "Survival",
];

function getRole(app: Application) {
  const spec = app.spec || "";

  if (tankSpecs.includes(spec)) return "Tank";
  if (healerSpecs.includes(spec)) return "Healer";
  if (meleeSpecs.includes(spec)) return "Melee DPS";

  return "Ranged DPS";
}

export default function ApplicationForumsPage() {
  const router = useRouter();

  const [tab, setTab] = useState<"pending" | "accepted" | "declined">("pending");
  const [applications, setApplications] = useState<Application[]>([]);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("All Classes");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [sortBy, setSortBy] = useState("newest");

  const [isOfficer, setIsOfficer] = useState(false);
  const [isGuildMaster, setIsGuildMaster] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkAdmin();
    loadPendingCount();
  }, []);

  useEffect(() => {
    loadApplications();
  }, [tab]);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("guild_role")
      .eq("user_id", user.id)
      .single();

    const role = data?.guild_role || "";

    setIsGuildMaster(role === "Guild Master");
    setIsOfficer(role === "Guild Master" || role === "Officer");
  }

  async function loadPendingCount() {
    const { count, error } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (!error) setPendingCount(count || 0);
  }

  async function loadApplications() {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setApplications(data || []);
  }

  async function deleteApplication() {
    if (!deleteTarget) return;

    setDeleting(true);

    const { error, count } = await supabase
      .from("applications")
      .delete({ count: "exact" })
      .eq("id", deleteTarget.id);

    setDeleting(false);

    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }

    if (!count) {
      alert("Delete did not remove anything. Check Supabase RLS delete policy.");
      return;
    }

    setApplications((old) => old.filter((app) => app.id !== deleteTarget.id));
    setDeleteTarget(null);
    loadPendingCount();
  }

  async function updateApplicationStatus(
    id: string,
    newStatus: "accepted" | "declined"
  ) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You must be logged in.");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("discord_name")
      .eq("user_id", user.id)
      .single();

    const updateData =
      newStatus === "accepted"
        ? {
            status: "accepted",
            accepted_by: user.id,
            accepted_by_name: profile?.discord_name || "Unknown",
            accepted_at: new Date().toISOString(),
          }
        : {
            status: "declined",
            declined_by: user.id,
            declined_by_name: profile?.discord_name || "Unknown",
            declined_at: new Date().toISOString(),
          };

    const { error, count } = await supabase
      .from("applications")
      .update(updateData, { count: "exact" })
      .eq("id", id)
      .eq("status", "pending");

    if (error) {
      alert("Update failed: " + error.message);
      return;
    }

    if (!count) {
      alert("This application was already changed or blocked by RLS.");
      loadApplications();
      loadPendingCount();
      return;
    }

    if (newStatus === "accepted") {
      const app = applications.find((a) => a.id === id);

      if (app?.user_id) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            guild_role: "Trial",
            signup_approved: true,
            accepted_application: true,
          })
          .eq("user_id", app.user_id);

        if (profileError) {
          alert(
            "Application accepted, but profile update failed: " +
              profileError.message
          );
        }
      }
    }

    setApplications((old) => old.filter((app) => app.id !== id));
    loadPendingCount();
  }

  const filteredApps = applications
    .filter((app) => {
      const q = search.toLowerCase();

      const matchesSearch =
        app.character_name?.toLowerCase().includes(q) ||
        app.class?.toLowerCase().includes(q) ||
        app.spec?.toLowerCase().includes(q) ||
        app.realm?.toLowerCase().includes(q);

      const matchesClass =
        classFilter === "All Classes" || app.class === classFilter;

      const matchesRole = roleFilter === "All Roles" || getRole(app) === roleFilter;

      return matchesSearch && matchesClass && matchesRole;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      if (sortBy === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      if (sortBy === "highest_ilvl") return (b.ilvl || 0) - (a.ilvl || 0);
      if (sortBy === "lowest_ilvl") return (a.ilvl || 0) - (b.ilvl || 0);
      if (sortBy === "highest_score") {
        return (b.raider_io_score || 0) - (a.raider_io_score || 0);
      }

      if (sortBy === "lowest_score") {
        return (a.raider_io_score || 0) - (b.raider_io_score || 0);
      }

      return 0;
    });

  return (
    <main className="min-h-screen text-[#f5e7c8] forumPage">
      <div className="min-h-screen forumOverlay">
        <div className="min-h-screen p-8">
          <div className="mx-auto max-w-[1600px]">
            <div className="mb-10 text-center">
              <h1
                className="text-6xl font-black"
                style={{
                  color: "#f5d37a",
                  textShadow: "0 0 25px rgba(245,211,122,.35)",
                }}
              >
                APPLICATION FORUMS
              </h1>

              <p className="mt-3 text-[#bca38c]">
                Review and manage applications from potential new raiders.
              </p>
            </div>

            <div className="forumPanel overflow-hidden rounded-2xl border border-[#7c3aed]/60 bg-black/75">
              <div className="flex border-b border-[#6b4b1f]">
                {(["pending", "accepted", "declined"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`forumTab px-8 py-4 font-bold uppercase ${
                      tab === t
                        ? "activeForumTab bg-[#1b1206] text-[#f5c451]"
                        : "text-[#a28d68]"
                    }`}
                  >
                    {t === "pending" ? (
                      <span className="flex items-center gap-2">
                        Pending Applications
                        <span className="pendingBadge">{pendingCount}</span>
                      </span>
                    ) : (
                      t
                    )}
                  </button>
                ))}
              </div>

              <div className="p-6">
                <div className="mb-6 flex gap-4">
                  <select
                    className="forumInput"
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                  >
                    {classes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    className="forumInput"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>

                  <select
                    className="forumInput"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="newest">Sort by: Newest</option>
                    <option value="oldest">Sort by: Oldest</option>
                    <option value="highest_ilvl">Highest ILVL</option>
                    <option value="lowest_ilvl">Lowest ILVL</option>
                    <option value="highest_score">Highest Raider.IO</option>
                    <option value="lowest_score">Lowest Raider.IO</option>
                  </select>

                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="forumInput ml-auto w-[330px]"
                    placeholder="Search applications..."
                  />
                </div>

                <div className="grid grid-cols-1 gap-7 md:grid-cols-2 xl:grid-cols-4">
                  {filteredApps.map((app) => {
                    const color = classColors[app.class || ""] || "#d6a84f";
                    const discordBg =
                      app.discord_avatar_url ||
                      app.avatar_url ||
                      "/websitelogo.png";

                    return (
                      <div
                        key={app.id}
                        className="relative h-[550px] overflow-hidden rounded-sm border bg-black transition-all duration-300 hover:-translate-y-3 hover:scale-[1.03]"
                        style={{
                          borderColor: color,
                          boxShadow: `0 0 16px ${color}44`,
                        }}
                      >
                        {isGuildMaster && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteTarget(app);
                            }}
                            className="absolute right-3 top-3 z-[999] flex h-8 w-8 items-center justify-center rounded-full border border-red-500 bg-black/90 font-black text-red-400 transition-all duration-300 hover:scale-125 hover:bg-red-900 hover:shadow-[0_0_20px_rgba(239,68,68,0.9)]"
                            title="Delete Application"
                          >
                            ×
                          </button>
                        )}

                        <div
                          className="absolute left-0 right-0 top-0 h-[220px] bg-cover bg-center"
                          style={{
                            backgroundImage: `
                              linear-gradient(
                                to bottom,
                                rgba(0,0,0,0),
                                rgba(0,0,0,0.6),
                                rgba(0,0,0,1)
                              ),
                              url('${discordBg}')
                            `,
                          }}
                        />

                        <div className="absolute left-4 top-4 text-xs font-black uppercase tracking-wide text-[#f5d37a]">
                          {formatDate(app.created_at)}
                        </div>

                        <img
                          src={app.avatar_url || "/websitelogo.png"}
                          alt=""
                          className="absolute left-1/2 top-[170px] z-20 h-[78px] w-[78px] -translate-x-1/2 rounded-full border-2 bg-black object-cover"
                          style={{
                            borderColor: color,
                            boxShadow: `0 0 14px ${color}88`,
                          }}
                        />

                        <div className="absolute bottom-0 left-0 right-0 px-5 pb-3 text-center">
                          <h2
                            className="mt-8 text-3xl font-black drop-shadow-[0_2px_8px_black]"
                            style={{ color }}
                          >
                            {app.character_name || "Unknown"}
                          </h2>

                          <p
                            className="text-sm font-bold drop-shadow-[0_2px_8px_black]"
                            style={{ color }}
                          >
                            {app.spec || "-"} {app.class || ""}
                          </p>

                          <div className="mt-5 grid grid-cols-2 text-center">
                            <div>
                              <div className="text-2xl font-black text-[#f5d37a]">
                                {app.raid_progress || "-"}
                              </div>
                              <div className="text-xs text-[#a8997a]">
                                PROGRESS
                              </div>
                            </div>

                            <div className="border-l border-[#2b2418]">
                              <div className="text-2xl font-black text-[#f5d37a]">
                                {app.ilvl || "-"}
                              </div>
                              <div className="text-xs text-[#a8997a]">ILVL</div>
                            </div>
                          </div>

                          <div className="mt-5 flex justify-between text-sm font-bold">
                            <a
                              href={
                                app.raider_io ||
                                `https://raider.io/characters/eu/${app.realm}/${app.character_name}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="relative z-20 text-sky-400 hover:text-sky-300"
                            >
                              Raider.IO ↗
                            </a>

                            <a
                              href={
                                app.warcraft_logs ||
                                `https://www.warcraftlogs.com/character/eu/${app.realm}/${app.character_name}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="relative z-20 text-sky-400 hover:text-sky-300"
                            >
                              Warcraft Logs ↗
                            </a>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/application-forums/${app.id}`)
                            }
                            className="relative z-20 mt-5 w-full border border-[#d6a84f] bg-black/70 py-3 font-black uppercase text-[#f5c451] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(245,211,122,0.9)] hover:text-white"
                          >
                            View Application
                          </button>

                          {tab === "accepted" && app.accepted_by_name && (
                            <div className="mt-3 text-center text-sm font-bold text-green-400">
                              ✓ Accepted by {app.accepted_by_name}
                            </div>
                          )}

                          {tab === "declined" && app.declined_by_name && (
                            <div className="mt-3 text-center text-sm font-bold text-red-400">
                              ✕ Declined by {app.declined_by_name}
                            </div>
                          )}

                          {tab === "pending" && isOfficer && (
                            <div className="relative z-20 mt-3 grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  updateApplicationStatus(app.id, "accepted")
                                }
                                className="rounded-lg border border-green-400 bg-green-900/50 py-2 font-black text-green-300 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_25px_rgba(34,197,94,0.9)] hover:text-white"
                              >
                                Accept
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateApplicationStatus(app.id, "declined")
                                }
                                className="rounded-lg border border-red-400 bg-red-900/50 py-2 font-black text-red-300 transition-all duration-300 hover:scale-110 hover:shadow-[0_0_25px_rgba(239,68,68,0.9)] hover:text-white"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredApps.length === 0 && (
                  <div className="py-16 text-center text-[#a28d68]">
                    No applications found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="deleteOverlay">
          <div className="deletePopup">
            <div className="deleteIcon">!</div>

            <h2>DELETE APPLICATION?</h2>

            <p>
              Are you sure you want to delete{" "}
              <b>{deleteTarget.character_name || "this application"}</b>?
            </p>

            <div className="deleteActions">
              <button
                type="button"
                className="cancelDeleteBtn"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="confirmDeleteBtn"
                onClick={deleteApplication}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .forumInput {
          height: 46px;
          padding: 0 14px;
          border-radius: 6px;
          border: 1px solid #6b4b1f;
          background: rgba(0, 0, 0, 0.8);
          color: #f5e7c8;
          font-weight: 800;
          transition: 0.25s ease;
        }

        .forumInput:hover,
        .forumInput:focus {
          border-color: #f5d37a;
          box-shadow: 0 0 18px rgba(245, 211, 122, 0.45);
          outline: none;
        }

.forumInput option {
  background: #07020d;
}

.forumInput option[value="Death Knight"] { color: #C41E3A; }
.forumInput option[value="Demon Hunter"] { color: #A330C9; }
.forumInput option[value="Druid"] { color: #FF7C0A; }
.forumInput option[value="Evoker"] { color: #33937F; }
.forumInput option[value="Hunter"] { color: #AAD372; }
.forumInput option[value="Mage"] { color: #3FC7EB; }
.forumInput option[value="Monk"] { color: #00FF98; }
.forumInput option[value="Paladin"] { color: #F48CBA; }
.forumInput option[value="Priest"] { color: #FFFFFF; }
.forumInput option[value="Rogue"] { color: #FFF468; }
.forumInput option[value="Shaman"] { color: #0070DD; }
.forumInput option[value="Warlock"] { color: #8788EE; }
.forumInput option[value="Warrior"] { color: #C69B6D; }

        .forumTab {
          position: relative;
          transition: 0.25s ease;
        }

        .forumTab:hover {
          transform: scale(1.08);
          color: #fff2c7;
          text-shadow: 0 0 14px rgba(245, 211, 122, 0.95);
          box-shadow: inset 0 0 18px rgba(245, 211, 122, 0.12);
        }

        .activeForumTab {
          box-shadow:
            inset 0 0 25px rgba(245, 196, 81, 0.12),
            0 0 18px rgba(245, 196, 81, 0.18);
        }

        .forumPage {
          background-image: url("/applyg.png");
          background-size: cover;
          background-position: center top;
          background-repeat: no-repeat;
          background-attachment: fixed;
        }

        .forumOverlay {
          min-height: 100vh;
          background: radial-gradient(
            circle at top,
            rgba(168, 85, 247, 0.12),
            transparent 35%
          );
        }

        .forumPanel {
          box-shadow:
            0 0 45px rgba(168, 85, 247, 0.35),
            inset 0 0 35px rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
        }

        .pendingBadge {
          min-width: 26px;
          height: 26px;
          padding: 0 8px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #d6a84f;
          background: linear-gradient(180deg, #7e22ce, #3b0764);
          color: #fff2d8;
          font-size: 13px;
          font-weight: 900;
          box-shadow: 0 0 14px rgba(168, 85, 247, 0.65);
        }

        .deleteOverlay {
          position: fixed;
          inset: 0;
          z-index: 99999;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .deletePopup {
          width: min(540px, 92vw);
          padding: 54px 38px 34px;
          border-radius: 22px;
          text-align: center;
          border: 1px solid rgba(214, 168, 79, 0.8);
          background:
            radial-gradient(circle at top, rgba(220, 38, 38, 0.25), transparent 45%),
            linear-gradient(180deg, #11111a, #030308);
          box-shadow:
            0 0 55px rgba(220, 38, 38, 0.45),
            0 0 90px rgba(168, 85, 247, 0.25);
        }

        .deleteIcon {
          width: 78px;
          height: 78px;
          margin: -96px auto 20px;
          border-radius: 50%;
          border: 3px solid #ef4444;
          background: #09090f;
          color: #ef4444;
          font-size: 50px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 25px rgba(239, 68, 68, 0.55);
        }

        .deletePopup h2 {
          color: #f6b83f;
          font-size: 32px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .deletePopup p {
          margin-top: 16px;
          color: #eee;
          font-size: 18px;
          line-height: 1.6;
        }

        .deleteActions {
          margin-top: 30px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .cancelDeleteBtn,
        .confirmDeleteBtn {
          height: 54px;
          border-radius: 10px;
          font-weight: 900;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .cancelDeleteBtn {
          border: 1px solid rgba(214, 168, 79, 0.4);
          background: rgba(255, 255, 255, 0.04);
          color: #d6a84f;
        }

        .confirmDeleteBtn {
          border: 1px solid #ef4444;
          background: linear-gradient(180deg, #7f1d1d, #450a0a);
          color: white;
        }

        .cancelDeleteBtn:hover,
        .confirmDeleteBtn:hover {
          transform: translateY(-1px);
          opacity: 0.9;
        }
      `}</style>
    </main>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}