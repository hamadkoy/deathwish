"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Application = {
  id: string;
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

export default function ApplicationForumsPage() {
  const [tab, setTab] = useState<"pending" | "accepted" | "declined">("pending");
  const [applications, setApplications] = useState<Application[]>([]);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAdmin();
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
      .select("site_role")
      .eq("user_id", user.id)
      .single();

    setIsAdmin(
  ["👑 Dreadlord", "☠️ Nightblade", "Dreadlord", "Nightblade"].includes(
    data?.site_role || ""
  )
);
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
async function deleteApplication(id: string) {
  if (!confirm("Delete this application?")) return;

  const { error, count } = await supabase
    .from("applications")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) {
    alert("Delete failed: " + error.message);
    return;
  }

  if (!count) {
    alert("Delete did not remove anything. Check Supabase RLS delete policy.");
    return;
  }

  setApplications((old) => old.filter((app) => app.id !== id));
  alert("Application deleted");
}

async function updateApplicationStatus(
  id: string,
  newStatus: "accepted" | "declined"
) {
  const { error, count } = await supabase
    .from("applications")
    .update({ status: newStatus }, { count: "exact" })
    .eq("id", id);

  if (error) {
    alert("Update failed: " + error.message);
    return;
  }

  if (!count) {
    alert("Update blocked by Supabase RLS policy.");
    return;
  }

  setApplications((old) => old.filter((app) => app.id !== id));
}
  const filteredApps = applications.filter((app) => {
    const q = search.toLowerCase();

    return (
      app.character_name?.toLowerCase().includes(q) ||
      app.class?.toLowerCase().includes(q) ||
      app.spec?.toLowerCase().includes(q) ||
      app.realm?.toLowerCase().includes(q)
    );
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
                    className={`px-8 py-4 font-bold uppercase ${
                      tab === t
                        ? "bg-[#1b1206] text-[#f5c451]"
                        : "text-[#a28d68]"
                    }`}
                  >
                    {t === "pending" ? "Pending Applications" : t}
                  </button>
                ))}
              </div>

              <div className="p-6">
                <div className="mb-6 flex gap-4">
                  <select className="forumInput">
                    <option>All Classes</option>
                  </select>

                  <select className="forumInput">
                    <option>All Roles</option>
                  </select>

                  <select className="forumInput">
                    <option>Sort by: Newest</option>
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
                      app.discord_avatar_url || app.avatar_url || "/websitelogo.png";

                    return (
                      <div
                        key={app.id}
                       className="relative h-[550px] overflow-hidden rounded-sm border bg-black transition hover:-translate-y-1"
                        style={{
                          borderColor: color,
                          boxShadow: `0 0 16px ${color}44`,
                        }}
                      >
{true && (
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteApplication(app.id);
    }}
    className="absolute right-3 top-3 z-[999] flex h-8 w-8 items-center justify-center rounded-full border border-red-500 bg-black/90 font-black text-red-400 hover:bg-red-900"
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
  className="absolute left-1/2 top-[170px] h-[78px] w-[78px] -translate-x-1/2 rounded-full border-2 bg-black object-cover z-20"
  style={{
    borderColor: color,
    boxShadow: `0 0 14px ${color}88`,
  }}
/>

<div className="absolute bottom-0 left-0 right-0 px-5 pb-3 text-center">

    <h2 className="mt-8 text-3xl font-black drop-shadow-[0_2px_8px_black]"
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
                              <div className="text-xs text-[#a8997a]">PROGRESS</div>
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
  onClick={() => router.push(`/application-forums/${app.id}`)}
  className="relative z-20 mt-5 w-full border border-[#6b4b1f] bg-black/70 py-3 font-black uppercase text-[#f5c451] hover:bg-[#1d1306]"
>
  View Application
</button>
                         {tab === "pending" && (
                            <div className="relative z-20 mt-3 grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() =>
                                  updateApplicationStatus(app.id, "accepted")
                                }
                                className="rounded border border-green-500/60 bg-green-900/50 py-2 font-black text-green-300 hover:bg-green-700/60"
                              >
                                Accept
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateApplicationStatus(app.id, "declined")
                                }
                                className="rounded border border-red-500/60 bg-red-900/50 py-2 font-black text-red-300 hover:bg-red-700/60"
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

      <style jsx global>{`
        .forumInput {
          height: 46px;
          padding: 0 14px;
          border-radius: 6px;
          border: 1px solid #6b4b1f;
          background: rgba(0, 0, 0, 0.8);
          color: #f5e7c8;
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

  background:
    radial-gradient(
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