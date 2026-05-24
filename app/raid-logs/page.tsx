"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import SideNav from "@/app/components/SideNav";

type Run = {
  id: number;
  title?: string;
  day?: string;
  time?: string;
  week?: string | number;
  run_date?: string;
};

type RaidLog = {
  id: number;
  run_id: number;
  user_id: string;
  uploader_name?: string;
  uploader_avatar?: string;
  log_url: string;
  created_at?: string;
};

export default function RaidLogsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [logs, setLogs] = useState<RaidLog[]>([]);
  const [balance, setBalance] = useState(0);
  const [uploadingRunId, setUploadingRunId] = useState<number | null>(null);
  const [logUrl, setLogUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState("All");
  const [isAdmin, setIsAdmin] = useState(false);
  const [popup, setPopup] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
    loadLogs();
    getLoggedUser();
  }, []);

  async function loadRuns() {
    const { data, error } = await supabase
      .from("runs")
      .select("*")
      .order("run_date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setRuns(data || []);
  }

  async function loadLogs() {
    const { data, error } = await supabase.from("raid_logs").select("*");

    if (error) {
      alert(error.message);
      return;
    }

    setLogs(data || []);
  }

  async function getLoggedUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    setCurrentUserId(user.id);

const discordIdentity = user.identities?.find(
  (i: any) => i.provider === "discord"
);

const discordId =
  discordIdentity?.identity_data?.provider_id ||
  discordIdentity?.identity_data?.sub ||
  user.user_metadata?.provider_id ||
  user.user_metadata?.sub;

const adminDiscordIds = ["207929624888344576"];

setIsAdmin(adminDiscordIds.includes(discordId));

if (discordId) loadBalance(discordId);
  }

  async function loadBalance(discordId: string) {
    try {
      const res = await fetch(`/api/bank?discordId=${discordId}`);
      const data = await res.json();
      setBalance(Number(data.balance || 0));
    } catch {
      setBalance(0);
    }
  }

  async function uploadLog(runId: number) {
    if (!logUrl.trim()) {
      setPopup("Please paste a Warcraft Logs URL.");
      return;
    }

    if (!logUrl.includes("warcraftlogs.com")) {
      setPopup("Please use a valid Warcraft Logs URL.");
      return;
    }

    setSaving(true);

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        alert("Please login first.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", auth.user.id)
        .single();

      const { error } = await supabase.from("raid_logs").insert([
        {
          run_id: runId,
          user_id: auth.user.id,
          uploader_name:
            profile?.discord_name ||
            auth.user.user_metadata?.full_name ||
            "Unknown",
          uploader_avatar:
            profile?.avatar_url ||
            auth.user.user_metadata?.avatar_url ||
            "",
          log_url: logUrl.trim(),
        },
      ]);

      if (error) {
        alert(error.message);
        return;
      }

      setLogUrl("");
      setUploadingRunId(null);
      await loadLogs();
    } finally {
      setSaving(false);
    }
  }

  async function deleteLog(logId: number) {
    const confirmDelete = confirm("Delete this Warcraft Log?");
    if (!confirmDelete) return;

    const { error } = await supabase
      .from("raid_logs")
      .delete()
      .eq("id", logId);

    if (error) {
      alert("You can only delete your own logs within 2 hours.");
      return;
    }

    await loadLogs();
  }

  const weeks = useMemo(() => {
    const list = Array.from(
      new Set(runs.map((r) => String(r.week || "").trim()).filter(Boolean))
    );

    list.sort((a, b) => Number(a) - Number(b));

    return ["All", ...list];
  }, [runs]);

  const filteredRuns = useMemo(() => {
    return [...runs]
      .filter(
        (run) => selectedWeek === "All" || String(run.week) === selectedWeek
      )
      .sort((a, b) => {
        const da = new Date(a.run_date || "").getTime();
        const db = new Date(b.run_date || "").getTime();
        return da - db;
      });
  }, [runs, selectedWeek]);
const validRunIds = useMemo(() => {
  return new Set(runs.map((r) => r.id));
}, [runs]);

const validLogs = useMemo(() => {
  return logs.filter((log) => validRunIds.has(log.run_id));
}, [logs, validRunIds]);
  const uploaderRewards = useMemo(() => {
    const map: Record<
      string,
      { name: string; avatar?: string; count: number; reward: number }
    > = {};

    validLogs.forEach((log) => {
      const key = log.user_id;

      if (!map[key]) {
        map[key] = {
          name: log.uploader_name || "Unknown",
          avatar: log.uploader_avatar,
          count: 0,
          reward: 0,
        };
      }

      map[key].count += 1;
      map[key].reward += 10000;
    });

    return Object.values(map).sort((a, b) => b.reward - a.reward);
 }, [validLogs]);

  const totalUploaded = validLogs.length;
  const totalReward = totalUploaded * 10000;

  return (
    <div style={page}>
      <div style={layout}>
        <aside style={sidebar}>
          <SideNav active="Raid Logs" />

          <div style={balanceBox}>
            <div style={balanceTitle}>BALANCE OVERVIEW</div>
            <div style={balanceLabel}>Total Balance</div>
            <div style={balanceAmount}>
              {Number(balance || 0).toLocaleString()} 🟡
            </div>
            <button style={paymentBtn}>💰 Request Early Payment</button>
          </div>

          <div style={rewardBox}>
            <div style={balanceTitle}>LOGS REWARDS</div>
            <p style={rewardText}>
              Earn <b>10,000 🟡</b> for each uploaded Warcraft Logs link.
            </p>
            <p style={rewardText}>Logs can be deleted only within 2 hours.</p>
          </div>
        </aside>

        <main style={mainGrid}>
          <section>
            <h1 style={title}>Logs</h1>
            <p style={subtitle}>
              Upload or link your Warcraft Logs for each opened run.
            </p>

            <div style={weekBox}>
              {weeks.map((week) => (
<button
  key={week}
  onClick={() => setSelectedWeek(week)}
  style={selectedWeek === week ? weekActive : weekBtn}
  onMouseEnter={(e) => {
    if (selectedWeek !== week) {
      e.currentTarget.style.transform = "translateY(-2px) scale(1.04)";
      e.currentTarget.style.boxShadow =
        "0 0 20px rgba(217,70,239,0.55)";
      e.currentTarget.style.border =
        "1px solid rgba(217,70,239,0.9)";
    }
  }}
  onMouseLeave={(e) => {
    if (selectedWeek !== week) {
      e.currentTarget.style.transform = "translateY(0) scale(1)";
      e.currentTarget.style.boxShadow = "none";
      e.currentTarget.style.border =
        "1px solid rgba(168,85,247,0.75)";
    }
  }}
>
                  {week === "All" ? "All" : `Week ${week}`}
                </button>
              ))}
            </div>

            <div style={banner}>
              🎁 Earn <b>10,000 🟡</b> for each uploaded Warcraft Logs link.
            </div>

            <div style={table}>
              <div style={tableHead}>
                <div>RUN</div>
                <div>DATE & TIME</div>
                <div>LOG LINK / UPLOADER</div>
                <div>STATUS</div>
                <div>REWARD</div>
              </div>

              {filteredRuns.map((run, index) => {
                const log = validLogs.find((l) => l.run_id === run.id);

                return (
                  <div key={run.id} style={tableRow}>
                    <div>
                      <div style={runTitle}>
                        {String(index + 1).padStart(2, "0")}.{" "}
                        <span style={purpleText}>
                          {run.day || run.title || "Run"}
                        </span>
                      </div>
                      <div style={muted}>Run ID: #{run.id}</div>
                    </div>

                    <div>
                      <div style={dateText}>{formatDate(run.run_date)}</div>
                      <div style={muted}>{run.time || "No time"} ST</div>
                    </div>

                    <div>
                      {log ? (
                        <div style={uploadedBox}>
                          <div style={uploaderRow}>
                            {log.uploader_avatar && (
                              <img src={log.uploader_avatar} style={avatar} alt="" />
                            )}

                            <span>
                              Uploaded by{" "}
                              <b style={uploaderName}>
                                {log.uploader_name || "Unknown"}
                              </b>
                            </span>
                          </div>

                          <a
                            href={log.log_url}
                            target="_blank"
                            rel="noreferrer"
                            style={logLink}
                          >
                            {log.log_url} ↗
                          </a>

                          {canDeleteLog(log, currentUserId, isAdmin) ? (
                            <button
                              onClick={() => deleteLog(log.id)}
                              style={deleteBtn}
                            >
                              🗑 Delete Log
                            </button>
                          ) : (
                            <div style={lockedText}>
                              {log.user_id === currentUserId
                                ? "Locked after 2 hours"
                                : "Only uploader can delete"}
                            </div>
                          )}
                        </div>
                      ) : uploadingRunId === run.id ? (
                        <div style={uploadBox}>
                          <input
                            value={logUrl}
                            onChange={(e) => setLogUrl(e.target.value)}
                            placeholder="Paste Warcraft Logs URL..."
                            style={input}
                          />

                          <button
                            onClick={() => uploadLog(run.id)}
                            disabled={saving}
                            style={saveBtn}
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>

                          <button                          
                            onClick={() => {
                              setUploadingRunId(null);
                              setLogUrl("");
                            }}
                            style={cancelBtn}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
<button
  style={
    canUploadLog(run)
      ? uploadBtn
      : {
          ...uploadBtn,
          border: "1px solid rgba(255,60,60,.7)",
          background: "rgba(80,0,0,.45)",
          color: "#ff9b9b",
          boxShadow: "0 0 14px rgba(255,0,0,.25)",
        }
  }
onClick={() => {
  if (!canUploadLog(run)) {
    setPopup("Logs can be uploaded 15 minutes after the run starts.");
    return;
  }

  setUploadingRunId(run.id);
}}
onMouseEnter={(e) => {
  e.currentTarget.style.transform =
    "translateY(-2px) scale(1.03)";

  if (canUploadLog(run)) {
    e.currentTarget.style.boxShadow =
      "0 0 22px rgba(217,70,239,0.6)";
    e.currentTarget.style.background =
      "rgba(168,85,247,0.3)";
  } else {
    e.currentTarget.style.boxShadow =
      "0 0 20px rgba(255,0,0,.45)";
    e.currentTarget.style.background =
      "rgba(120,0,0,.5)";
  }
}}
onMouseLeave={(e) => {
  e.currentTarget.style.transform =
    "translateY(0) scale(1)";

  if (canUploadLog(run)) {
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.background =
      "rgba(88,28,135,.25)";
  } else {
    e.currentTarget.style.boxShadow =
      "0 0 14px rgba(255,0,0,.25)";
    e.currentTarget.style.background =
      "rgba(80,0,0,.45)";
  }
}}
>
{isRunFinished(run)
  ? "✅ Finished Run"
  : canUploadLog(run)
  ? "☁ Upload Logs or Add Link"
  : "🔒 Opens 15 min after the run start"}
                        </button>
                      )}
                    </div>

                    <div>
                      {log ? (
                        <span style={uploadedStatus}>Uploaded</span>
                      ) : (
                        <span style={missingStatus}>Missing</span>
                      )}
                    </div>

                    <div>
                      {log ? (
                        <span style={reward}>+ 10,000 🟡</span>
                      ) : (
                        <span style={muted}>-</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={summaryBox}>
              <div>
                Uploaded Logs: <b>{totalUploaded}</b>
              </div>
              <div>
                Total Reward:{" "}
                <b style={goldText}>{totalReward.toLocaleString()} 🟡</b>
              </div>
            </div>
          </section>

          <aside style={rightPanel}>
            <div style={uploaderSection}>
              <div style={rewardGlow}>✦</div>
              <h2 style={sectionTitle}>🏆 Logs Champions</h2>
              <p style={rightSub}>All-time Warcraft Logs rewards</p>

              {uploaderRewards.length === 0 ? (
                <div style={muted}>No logs uploaded yet.</div>
              ) : (
                uploaderRewards.map((uploader, index) => (
                  <div
  key={uploader.name}
  style={uploaderCard}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform =
      "translateY(-3px) scale(1.02)";
    e.currentTarget.style.boxShadow =
      "0 0 30px rgba(217,70,239,0.35)";
    e.currentTarget.style.border =
      "1px solid rgba(217,70,239,0.45)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform =
      "translateY(0) scale(1)";
    e.currentTarget.style.boxShadow =
      "inset 0 0 18px rgba(255,255,255,0.025)";
    e.currentTarget.style.border =
      "1px solid rgba(255,255,255,0.08)";
  }}
>
                    <div style={rankBadge}>#{index + 1}</div>

                    <div style={uploaderLeft}>
                      {uploader.avatar && (
                        <img src={uploader.avatar} style={bigAvatar} alt="" />
                      )}

                      <div>
                        <div style={uploaderBigName}>{uploader.name}</div>
                        <div style={muted}>Uploaded: {uploader.count}</div>
                      </div>
                    </div>

                    <div style={uploaderGold}>
                      {uploader.reward.toLocaleString()} 🟡
                    </div>
                  </div>
                ))
              )}

              <div style={rightFooter}>
                Total Paid:{" "}
                <b style={goldText}>{totalReward.toLocaleString()} 🟡</b>
              </div>
            </div>
          </aside>
</main>
</div>

{popup && (
  <div style={popupOverlay}>
    <div style={popupBox}>
      <div style={popupTitle}>🔒 Logs Locked</div>
      <div style={popupText}>{popup}</div>

      <button
        onClick={() => setPopup(null)}
        style={popupBtn}
      >
        OK
      </button>
    </div>
  </div>
)}

</div>
);
}

function canDeleteLog(
  log: RaidLog,
  currentUserId: string | null,
  isAdmin: boolean
) {
  if (!currentUserId) return false;

  if (isAdmin) return true;

  if (log.user_id !== currentUserId) return false;
  if (!log.created_at) return false;

  const created = new Date(log.created_at).getTime();
  const now = Date.now();
  const twoHours = 2 * 60 * 60 * 1000;

  return now - created < twoHours;
}

function formatDate(date?: string) {
  if (!date) return "No date";

  return new Date(date).toLocaleDateString("en-GB", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}
function canUploadLog(run: Run) {
  if (!run.run_date || !run.time) return false;

  const cleanTime = run.time.replace("ST", "").trim();

  const datePart = run.run_date.includes("T")
    ? run.run_date.split("T")[0]
    : run.run_date;

  let runStart = new Date(`${datePart}T${cleanTime}:00`);

  if (isNaN(runStart.getTime())) {
    runStart = new Date(`${datePart} ${cleanTime}`);
  }

  if (isNaN(runStart.getTime())) return false;

  const unlockTime =
    runStart.getTime() + 15 * 60 * 1000;

  const lockTime =
    runStart.getTime() + 3 * 60 * 60 * 1000;

  const now = Date.now();

  return now >= unlockTime && now <= lockTime;
}
function isRunFinished(run: Run) {
  if (!run.run_date || !run.time) return false;

  const cleanTime = run.time.replace("ST", "").trim();
  const datePart = run.run_date.includes("T")
    ? run.run_date.split("T")[0]
    : run.run_date;

  let runStart = new Date(`${datePart}T${cleanTime}:00`);

  if (isNaN(runStart.getTime())) {
    runStart = new Date(`${datePart} ${cleanTime}`);
  }

  if (isNaN(runStart.getTime())) return false;

  return Date.now() > runStart.getTime() + 3 * 60 * 60 * 1000;
}
const page: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  fontFamily: "Arial, sans-serif",
  background:
    "linear-gradient(rgba(2,6,16,0.65), rgba(0,0,0,0.78)), url('/bg.png') center top / cover no-repeat fixed",
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px 1fr",
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

const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 360px",
  gap: 18,
  paddingRight: 18,
};

const rightPanel: React.CSSProperties = {
  position: "sticky",
  top: 90,
  height: "fit-content",
  marginTop: 118,
};

const title: React.CSSProperties = {
  fontSize: 42,
  margin: 0,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  color: "#c4c4d4",
  fontSize: 18,
  marginTop: 10,
  marginBottom: 18,
};

const weekBox: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 18,
};

const weekBtn: React.CSSProperties = {
  height: 48,
  padding: "0 24px",
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,0.75)",
  background: "rgba(0,0,0,0.35)",
  color: "#f0abfc",
  fontWeight: 900,
  cursor: "pointer",
  transition: "all 0.22s ease",
};

const weekActive: React.CSSProperties = {
  ...weekBtn,
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  color: "white",
  boxShadow: "0 0 18px rgba(217,70,239,0.55)",
};

const banner: React.CSSProperties = {
  background:
    "linear-gradient(90deg, rgba(88,28,135,.55), rgba(30,27,75,.6))",
  border: "1px solid rgba(168,85,247,.25)",
  borderRadius: 10,
  padding: "18px 22px",
  marginBottom: 18,
  fontSize: 18,
};

const table: React.CSSProperties = {
  background: "rgba(4,12,24,0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  overflow: "hidden",
};

const tableHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.1fr 1.1fr 2.5fr .8fr .8fr",
  padding: "18px 22px",
  color: "#c9c9d6",
  fontWeight: 900,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.1fr 1.1fr 2.5fr .8fr .8fr",
  alignItems: "center",
  padding: "16px 22px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  minHeight: 72,
};

const runTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
};

const purpleText: React.CSSProperties = {
  color: "#d8b4fe",
};

const muted: React.CSSProperties = {
  color: "#b8b8c8",
  marginTop: 5,
};

const dateText: React.CSSProperties = {
  fontWeight: 800,
  color: "#e5e7eb",
};

const uploadedBox: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const uploaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#d1d5db",
};

const avatar: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: "50%",
  objectFit: "cover",
  border: "1px solid rgba(168,85,247,.7)",
};

const bigAvatar: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(168,85,247,.8)",
  boxShadow: "0 0 16px rgba(168,85,247,.45)",
};

const uploaderName: React.CSSProperties = {
  color: "#f5d0fe",
};

const uploaderBigName: React.CSSProperties = {
  color: "#f5d0fe",
  fontSize: 17,
  fontWeight: 900,
};

const logLink: React.CSSProperties = {
  color: "#0ea5e9",
  textDecoration: "none",
  fontWeight: 800,
  wordBreak: "break-all",
};

const uploadBtn: React.CSSProperties = {
  height: 46,
  padding: "0 24px",
  borderRadius: 8,
  border: "1px solid rgba(168,85,247,.7)",
  background: "rgba(88,28,135,.25)",
  color: "#f0abfc",
  fontWeight: 900,
  cursor: "pointer",
  transition: "all 0.22s ease",
};

const uploadBox: React.CSSProperties = {
  display: "flex",
  gap: 8,
};

const input: React.CSSProperties = {
  height: 42,
  flex: 1,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,.16)",
  background: "rgba(0,0,0,.55)",
  color: "white",
  padding: "0 12px",
  outline: "none",
};

const saveBtn: React.CSSProperties = {
  height: 42,
  padding: "0 18px",
  borderRadius: 8,
  border: 0,
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const cancelBtn: React.CSSProperties = {
  height: 42,
  padding: "0 14px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(0,0,0,.35)",
  color: "#ddd",
  fontWeight: 800,
  cursor: "pointer",
};

const deleteBtn: React.CSSProperties = {
  width: "fit-content",
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid rgba(239,68,68,.45)",
  background: "rgba(127,29,29,.35)",
  color: "#f87171",
  fontWeight: 800,
  cursor: "pointer",
};

const lockedText: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  fontWeight: 800,
  marginTop: 4,
};

const uploadedStatus: React.CSSProperties = {
  color: "#22c55e",
  fontWeight: 900,
};

const missingStatus: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 900,
};

const reward: React.CSSProperties = {
  color: "#f5f5f5",
  fontWeight: 900,
};

const summaryBox: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "space-between",
  background: "rgba(7,10,20,.86)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 12,
  padding: 18,
  fontWeight: 800,
};

const goldText: React.CSSProperties = {
  color: "#facc15",
};

const uploaderSection: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(circle at top right, rgba(217,70,239,0.26), transparent 38%), linear-gradient(180deg, rgba(30,12,55,0.96), rgba(5,10,22,0.96))",
  border: "1px solid rgba(168,85,247,0.45)",
  borderRadius: 18,
  padding: 20,
  boxShadow:
    "0 0 35px rgba(168,85,247,0.22), inset 0 0 25px rgba(168,85,247,0.08)",
};

const rewardGlow: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 18,
  color: "#f0abfc",
  fontSize: 32,
  opacity: 0.55,
  textShadow: "0 0 20px rgba(217,70,239,0.9)",
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 4px",
  fontSize: 26,
  fontWeight: 900,
};

const rightSub: React.CSSProperties = {
  color: "#c4b5fd",
  marginTop: 0,
  marginBottom: 16,
  fontWeight: 800,
};

const uploaderCard: React.CSSProperties = {
  position: "relative",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "16px",
  borderRadius: 14,
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.055), rgba(168,85,247,0.06))",
  border: "1px solid rgba(255,255,255,0.08)",
  marginBottom: 12,
  boxShadow: "inset 0 0 18px rgba(255,255,255,0.025)",
  transition: "all 0.22s ease",
cursor: "pointer",
};

const rankBadge: React.CSSProperties = {
  position: "absolute",
  top: -8,
  left: -8,
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  color: "white",
  borderRadius: 999,
  padding: "4px 8px",
  fontSize: 11,
  fontWeight: 900,
  boxShadow: "0 0 12px rgba(217,70,239,0.5)",
};

const uploaderLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const uploaderGold: React.CSSProperties = {
  color: "#facc15",
  fontSize: 18,
  fontWeight: 900,
  whiteSpace: "nowrap",
  textShadow: "0 0 12px rgba(250,204,21,0.35)",
};

const rightFooter: React.CSSProperties = {
  marginTop: 14,
  paddingTop: 14,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "space-between",
  fontWeight: 900,
  color: "#e5e7eb",
};

const balanceBox: React.CSSProperties = {
  marginTop: 18,
  background:
    "linear-gradient(180deg, rgba(12,22,36,0.95), rgba(6,12,22,0.95))",
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
  fontSize: 16,
  marginBottom: 10,
};

const balanceAmount: React.CSSProperties = {
  color: "#facc15",
  fontSize: 28,
  fontWeight: 900,
  marginBottom: 18,
  textShadow: "0 0 12px rgba(250,204,21,0.35)",
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

const rewardBox: React.CSSProperties = {
  marginTop: 18,
  background: "rgba(12,22,36,0.9)",
  border: "1px solid rgba(148,163,184,0.14)",
  borderRadius: 14,
  padding: 18,
};

const rewardText: React.CSSProperties = {
  color: "#d1d5db",
  lineHeight: 1.6,
};
const popupOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const popupBox: React.CSSProperties = {
  width: 420,
  padding: 28,
  borderRadius: 18,
  background: "linear-gradient(180deg,#12001f,#05010d)",
  border: "1px solid rgba(168,85,247,.6)",
  boxShadow: "0 0 35px rgba(168,85,247,.55)",
  textAlign: "center",
};

const popupTitle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
  color: "#facc15",
  marginBottom: 12,
};

const popupText: React.CSSProperties = {
  color: "#e5e7eb",
  fontSize: 16,
  lineHeight: 1.5,
};

const popupBtn: React.CSSProperties = {
  marginTop: 22,
  height: 44,
  padding: "0 34px",
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};