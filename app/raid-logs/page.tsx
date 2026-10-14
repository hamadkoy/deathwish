"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getCurrentWeek } from "@/lib/season";
import SideNav from "@/app/components/SideNav";

// ==============================
// Types
// ==============================
type Run = {
  id: number;
  title?: string;
  day?: string;
  time?: string;
  week?: string | number;
  run_date?: string;
  finished?: boolean;
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

type Popup = {
  title: string;
  message: string;
  tone?: "error" | "info" | "success";
  confirmText?: string;
  onConfirm?: () => void | Promise<void>;
};

// ==============================
// Settings
// ==============================
const ADMIN_DISCORD_IDS = ["207929624888344576"];
const ADMIN_ROLES = ["Dreadlord", "admin", "Deathlord"];

const REWARD_PER_LOG = 10000;

const SERVER_TZ = "Europe/Paris";
const UPLOAD_OPENS_AFTER_MS = 15 * 60 * 1000;
const UPLOAD_CLOSES_AFTER_MS = 3 * 60 * 60 * 1000; // raise (e.g. 24h) to allow late uploads

// Week 1 starts Wednesday 19 Aug 2026 (same as the runs page)
const SEASON_START_UTC = Date.UTC(2026, 7, 19);
const DAY_MS = 24 * 60 * 60 * 1000;

const DAYS = [
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
] as const;

const DAY_THEME: Record<string, { accent: string; rgb: string; bg: string }> = {
  Wednesday: { accent: "#a855f7", rgb: "168,85,247", bg: "/mythic-purple-bg.png" },
  Thursday: { accent: "#3b82f6", rgb: "59,130,246", bg: "/nightfall.png" },
  Friday: { accent: "#ec4899", rgb: "236,72,153", bg: "/mythic-red-bg.png" },
  Saturday: { accent: "#22d3ee", rgb: "34,211,238", bg: "/hc-bg.png" },
  Sunday: { accent: "#22c55e", rgb: "34,197,94", bg: "/nightfall.png" },
  Monday: { accent: "#60a5fa", rgb: "96,165,250", bg: "/hc-bg.png" },
  Tuesday: { accent: "#f43f5e", rgb: "244,63,94", bg: "/mythic-red-bg.png" },
};

// ==============================
// Page
// ==============================
export default function RaidLogsPage() {
  const currentWeek = String(getCurrentWeek());

  const [runs, setRuns] = useState<Run[]>([]);
  const [logs, setLogs] = useState<RaidLog[]>([]);
  const [balance, setBalance] = useState(0);
  const [uploadingRunId, setUploadingRunId] = useState<number | null>(null);
  const [logUrl, setLogUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string>(currentWeek);
  const [isAdmin, setIsAdmin] = useState(false);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadRuns();
    loadLogs();
    getLoggedUser();

    // Keeps "Opens 15 min…" / "Missing" / "Finished" up to date
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  async function loadRuns() {
    const { data, error } = await supabase
      .from("runs")
      .select("*")
      .order("run_date", { ascending: true })
      .order("time", { ascending: true });

    if (error) {
      setPopup({ title: "Error", message: error.message, tone: "error" });
      return;
    }

    setRuns(data || []);
  }

  async function loadLogs() {
    const { data, error } = await supabase.from("raid_logs").select("*");

    if (error) {
      setPopup({ title: "Error", message: error.message, tone: "error" });
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("site_role")
      .eq("user_id", user.id)
      .single();

    setIsAdmin(
      ADMIN_DISCORD_IDS.includes(discordId) ||
        ADMIN_ROLES.includes(profile?.site_role || "")
    );

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

  // ==============================
  // Derived data
  // ==============================
  const validRunIds = useMemo(() => new Set(runs.map((r) => r.id)), [runs]);

  const validLogs = useMemo(
    () => logs.filter((log) => validRunIds.has(log.run_id)),
    [logs, validRunIds]
  );

  const logByRun = useMemo(() => {
    const map = new Map<number, RaidLog>();
    validLogs.forEach((log) => {
      if (!map.has(log.run_id)) map.set(log.run_id, log);
    });
    return map;
  }, [validLogs]);

  const weeks = useMemo(() => {
    const set = new Set(
      runs.map((r) => String(r.week ?? "").trim()).filter(Boolean)
    );
    set.add(currentWeek);

    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [runs, currentWeek]);

  const uploaderRewards = useMemo(() => {
    const map: Record<
      string,
      { key: string; name: string; avatar?: string; count: number; reward: number }
    > = {};

    validLogs.forEach((log) => {
      const key = log.user_id;

      if (!map[key]) {
        map[key] = {
          key,
          name: log.uploader_name || "Unknown",
          avatar: log.uploader_avatar,
          count: 0,
          reward: 0,
        };
      }

      map[key].count += 1;
      map[key].reward += REWARD_PER_LOG;
    });

    return Object.values(map).sort((a, b) => b.reward - a.reward);
  }, [validLogs]);

  const weekLogCount = useMemo(() => {
    if (selectedWeek === "All") return validLogs.length;

    const weekRunIds = new Set(
      runs.filter((r) => String(r.week ?? "").trim() === selectedWeek).map((r) => r.id)
    );

    return validLogs.filter((l) => weekRunIds.has(l.run_id)).length;
  }, [validLogs, runs, selectedWeek]);

  const totalUploaded = validLogs.length;
  const totalReward = totalUploaded * REWARD_PER_LOG;
  const todayYmd = serverTodayYmd(now);

  // ==============================
  // Actions
  // ==============================
  function openUpload(run: Run) {
    if (!isAdmin && !canUploadLog(run, Date.now())) {
      setPopup({
        title: "🔒 Logs Locked",
        message: isUploadClosed(run, Date.now())
          ? "The upload window for this run has closed (3 hours after the start)."
          : "Logs can be uploaded 15 minutes after the run starts (server time).",
        tone: "error",
      });
      return;
    }

    setLogUrl("");
    setUploadingRunId(run.id);
  }

  async function uploadLog(run: Run) {
    const url = logUrl.trim();

    if (!url) {
      setPopup({ title: "Missing Link", message: "Paste a Warcraft Logs URL first.", tone: "error" });
      return;
    }

    if (!/^https?:\/\/([a-z0-9-]+\.)*warcraftlogs\.com\//i.test(url)) {
      setPopup({
        title: "Invalid Link",
        message: "Please use a valid Warcraft Logs URL (warcraftlogs.com).",
        tone: "error",
      });
      return;
    }

    if (!isAdmin && !canUploadLog(run, Date.now())) {
      setPopup({ title: "🔒 Logs Locked", message: "The upload window for this run is closed.", tone: "error" });
      return;
    }

    if (logByRun.has(run.id)) {
      setPopup({ title: "Already Uploaded", message: "This run already has a log.", tone: "error" });
      return;
    }

    setSaving(true);

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        setPopup({ title: "Login Required", message: "Please login first.", tone: "error" });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("discord_name, avatar_url")
        .eq("user_id", auth.user.id)
        .single();

      const { error } = await supabase.from("raid_logs").insert([
        {
          run_id: run.id,
          user_id: auth.user.id,
          uploader_name:
            profile?.discord_name || auth.user.user_metadata?.full_name || "Unknown",
          uploader_avatar:
            profile?.avatar_url || auth.user.user_metadata?.avatar_url || "",
          log_url: url,
        },
      ]);

      if (error) {
        setPopup({ title: "Upload Failed", message: error.message, tone: "error" });
        return;
      }

      setLogUrl("");
      setUploadingRunId(null);
      await loadLogs();
    } finally {
      setSaving(false);
    }
  }

  function askDeleteLog(log: RaidLog) {
    setPopup({
      title: "Delete Log",
      message: `Delete the Warcraft Log for Run #${log.run_id}?`,
      tone: "error",
      confirmText: "DELETE",
      onConfirm: async () => {
        // .select() returns the deleted rows, so a delete silently blocked
        // by the database (0 rows) is caught instead of looking successful.
        const { data, error } = await supabase
          .from("raid_logs")
          .delete()
          .eq("id", log.id)
          .select("id");

        if (error || !data || data.length === 0) {
          setPopup({
            title: "Delete Blocked",
            message: isAdmin
              ? "The database refused the delete. The admin delete permission on raid_logs is missing."
              : "You can only delete your own logs within 2 hours of uploading.",
            tone: "error",
          });
          return;
        }

        await loadLogs();
      },
    });
  }

  // ==============================
  // Render helpers
  // ==============================
  function renderRun(run: Run) {
    const log = logByRun.get(run.id);
    const open = canUploadLog(run, now);
    const closed = isUploadClosed(run, now);
    const locked = !log && !open && !closed;
    const uploading = uploadingRunId === run.id;
    const start = getRunStart(run);

    const info = (
      <div style={{ minWidth: 0 }}>
        <div className="wl-run-id">Run #{run.id}</div>
        <div className="wl-run-when">
          {formatYmd(run.run_date)}, {formatTime(run.time)}
        </div>
        {run.title && (
          <div className="wl-run-title" title={run.title}>
            {run.title}
          </div>
        )}
      </div>
    );

    const lockBox = (
      <div
        className="wl-lock"
        title={start ? `Opens at ${formatServerTime(start + UPLOAD_OPENS_AFTER_MS)} ST` : undefined}
      >
        <span className="wl-lock-icon">🔒</span>
        <span>
          Opens 15 min
          <br />
          after the run start
        </span>
      </div>
    );

    const uploadButton = (
      <button className="wl-btn primary" onClick={() => (uploading ? setUploadingRunId(null) : openUpload(run))}>
        {uploading ? "Cancel" : "Upload Logs"}
      </button>
    );

    return (
      <div key={run.id} className="wl-run">
        {locked && !isAdmin ? (
          <div className="wl-run-main is-locked">
            {info}
            {lockBox}
          </div>
        ) : (
          <div className="wl-run-main">
            {info}

            {log ? (
              <span className="wl-pill ok">
                <span className="wl-dot">✓</span> Uploaded
              </span>
            ) : open ? (
              <span className="wl-pill warn">
                <span className="wl-dot">!</span> Missing
              </span>
            ) : closed ? (
              <span className="wl-pill ok">
                <span className="wl-dot">✓</span> Finished Run
              </span>
            ) : (
              lockBox
            )}

            {log ? (
              <span className="wl-reward">
                <span className="wl-coin">🟡</span> +{REWARD_PER_LOG.toLocaleString()}
              </span>
            ) : open || isAdmin ? (
              uploadButton
            ) : (
              <button
                className="wl-btn ghost"
                onClick={() => openUpload(run)}
                title="Upload window closed"
              >
                Closed
              </button>
            )}
          </div>
        )}

        {log && (
          <>
            <div className="wl-log-line">
              <a className="wl-log-link" href={log.log_url} target="_blank" rel="noreferrer">
                <img src="/Logs2.png" alt="" />
                <span>{log.log_url}</span>
              </a>

              {canDeleteLog(log, currentUserId, isAdmin, now) ? (
                <button className="wl-btn danger small" onClick={() => askDeleteLog(log)}>
                  🗑 Delete Log
                </button>
              ) : (
                <span className="wl-note">
                  {log.user_id === currentUserId ? "Locked after 2h" : "Uploader only"}
                </span>
              )}
            </div>

            <div className="wl-uploader">
              {log.uploader_avatar && <img src={log.uploader_avatar} alt="" />}
              Uploaded by <b>{log.uploader_name || "Unknown"}</b>
            </div>
          </>
        )}

        {uploading && !log && (
          <div className="wl-upload">
            <input
              autoFocus
              value={logUrl}
              onChange={(e) => setLogUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") uploadLog(run);
                if (e.key === "Escape") setUploadingRunId(null);
              }}
              placeholder="Paste Warcraft Logs URL..."
              className="wl-input"
            />
            <button className="wl-btn primary" disabled={saving} onClick={() => uploadLog(run)}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderWeek(week: string) {
    const weekNum = Number(week);
    const weekRuns = runs.filter((r) => String(r.week ?? "").trim() === week);

    return (
      <div key={week}>
        {selectedWeek === "All" && (
          <div className="wl-week-label">
            Week {week}
            {week === currentWeek && <span className="wl-now">NOW</span>}
          </div>
        )}

        <div className="wl-grid">
          {DAYS.map((day, idx) => {
            const ymd = Number.isFinite(weekNum) ? dayYmd(weekNum, idx) : "";
            const theme = DAY_THEME[day];
            const isToday = ymd === todayYmd;

            const dayRuns = weekRuns
              .filter((r) => runDay(r) === day)
              .sort((a, b) => (getRunStart(a) ?? 0) - (getRunStart(b) ?? 0));

            return (
              <div
                key={day}
                className={`wl-day${isToday ? " is-today" : ""}`}
                style={
                  {
                    "--accent": theme.accent,
                    "--accent-soft": `rgba(${theme.rgb},.55)`,
                    "--accent-faint": `rgba(${theme.rgb},.22)`,
                  } as React.CSSProperties
                }
              >
                <div
                  className="wl-day-head"
                  style={{
                    background: `linear-gradient(90deg, rgba(6,4,18,.96) 0%, rgba(6,4,18,.72) 45%, rgba(${theme.rgb},.22) 100%), url(${theme.bg}) center/cover`,
                  }}
                >
                  <DayEmblem color={theme.accent} />
                  <div>
                    <div className="wl-day-name">
                      {day.toUpperCase()}
                      {isToday && <span className="wl-today">TODAY</span>}
                    </div>
                    <div className="wl-day-meta">
                      {ymd ? formatYmd(ymd) : ""} •{" "}
                      {dayRuns.length === 0
                        ? "No runs opened"
                        : `${dayRuns.length} run${dayRuns.length === 1 ? "" : "s"} opened`}
                    </div>
                  </div>
                </div>

                <div className="wl-day-body">
                  {dayRuns.length === 0 ? (
                    <div className="wl-empty">
                      <span className="wl-empty-icon">📅</span>
                      <b>No opened runs yet</b>
                      Check back later for this week&apos;s schedule.
                    </div>
                  ) : (
                    dayRuns.map(renderRun)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const weeksToShow = selectedWeek === "All" ? weeks : [selectedWeek];

  // ==============================
  // Page
  // ==============================
  return (
    <div className="wl-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="wl-layout">
        <aside className="wl-side">
          <SideNav active="Raid Logs" />

          <div className="wl-box">
            <div className="wl-box-title">BALANCE OVERVIEW</div>
            <div style={{ color: "#e5e7eb" }}>Total Balance</div>
            <div className="wl-balance">{Number(balance || 0).toLocaleString()} 🟡</div>
            <button className="wl-pay">💰 Request Early Payment</button>
          </div>

          <div className="wl-box">
            <div className="wl-box-title">LOGS REWARDS</div>
            <p>
              Earn <b>{REWARD_PER_LOG.toLocaleString()} 🟡</b> for each uploaded Warcraft Logs link.
            </p>
            <p>Logs can be deleted only within 2 hours.</p>
            <div className="wl-stat">
              <span>{selectedWeek === "All" ? "All weeks" : `Week ${selectedWeek}`}</span>
              <b>{weekLogCount} logs</b>
            </div>
            <div className="wl-stat">
              <span>All time</span>
              <b>{totalUploaded} logs</b>
            </div>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          <header className="wl-header">
            <img src="/Logs2.png" alt="" className="wl-header-icon" />
            <div>
              <h1 className="wl-title">Warcraft Logs Uploads</h1>
              <p className="wl-sub">
                Upload or link your Warcraft Logs for each opened run. Help the guild track
                progress and earn rewards!
              </p>
            </div>
          </header>

          <div className="wl-weeks">
            <button
              className={`wl-week${selectedWeek === "All" ? " is-selected" : ""}`}
              onClick={() => setSelectedWeek("All")}
            >
              All
            </button>

            {weeks.map((week) => (
              <button
                key={week}
                onClick={() => setSelectedWeek(week)}
                className={`wl-week${selectedWeek === week ? " is-selected" : ""}${
                  week === currentWeek ? " is-current" : ""
                }`}
              >
                Week {week}
                {week === currentWeek && <span className="wl-now">NOW</span>}
              </button>
            ))}
          </div>

          <div className="wl-banner">
            <div className="wl-banner-main">
              <span className="wl-banner-coins">💰</span>
              <span>
                <b>Earn {REWARD_PER_LOG.toLocaleString()}</b> 🟡 for each uploaded Warcraft Logs link.
              </span>
            </div>
            <div className="wl-banner-side">
              Help the guild grow. Upload your logs and earn rewards!
              <span className="wl-banner-coins">🪙</span>
            </div>
          </div>

          {weeksToShow.map(renderWeek)}

          <section className="wl-champs">
            <div className="wl-champs-head">
              <div>
                <h2>🏆 Logs Champions</h2>
                <p>All-time Warcraft Logs rewards</p>
              </div>
              <div className="wl-champs-total">
                Total Paid <b>{totalReward.toLocaleString()} 🟡</b>
              </div>
            </div>

            {uploaderRewards.length === 0 ? (
              <div className="wl-empty">
                <b>No logs uploaded yet.</b>
              </div>
            ) : (
              <div className="wl-champs-grid">
                {uploaderRewards.map((u, index) => (
                  <div key={u.key} className={`wl-champ${index < 3 ? ` top${index + 1}` : ""}`}>
                    <div className="wl-rank">#{index + 1}</div>
                    <div className="wl-champ-left">
                      {u.avatar ? (
                        <img src={u.avatar} alt="" />
                      ) : (
                        <img src="https://cdn.discordapp.com/embed/avatars/0.png" alt="" />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div className="wl-champ-name">{u.name}</div>
                        <div className="wl-champ-count">Uploaded: {u.count}</div>
                      </div>
                    </div>
                    <div className="wl-champ-gold">{u.reward.toLocaleString()} 🟡</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {popup && (
        <div className="wl-overlay" onClick={() => setPopup(null)}>
          <div className={`wl-modal ${popup.tone || "info"}`} onClick={(e) => e.stopPropagation()}>
            <div className="wl-modal-title">{popup.title}</div>
            <div className="wl-modal-text">{popup.message}</div>

            <div className="wl-modal-actions">
              {popup.onConfirm && (
                <button
                  className="wl-btn danger"
                  onClick={async () => {
                    const fn = popup.onConfirm;
                    setPopup(null);
                    await fn?.();
                  }}
                >
                  {popup.confirmText || "CONFIRM"}
                </button>
              )}

              <button className="wl-btn primary" onClick={() => setPopup(null)}>
                {popup.onConfirm ? "CANCEL" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==============================
// Day emblem
// ==============================
function DayEmblem({ color }: { color: string }) {
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 48 48"
      aria-hidden
      style={{ flexShrink: 0, filter: `drop-shadow(0 0 8px ${color})` }}
    >
      <circle cx="24" cy="24" r="21" fill="none" stroke={color} strokeWidth="1.5" opacity=".75" />
      <circle cx="24" cy="24" r="14" fill="none" stroke={color} strokeWidth="1" opacity=".5" />
      <path d="M24 2 L27 21 L46 24 L27 27 L24 46 L21 27 L2 24 L21 21 Z" fill={color} opacity=".9" />
      <path d="M24 10 L25.5 22.5 L38 24 L25.5 25.5 L24 38 L22.5 25.5 L10 24 L22.5 22.5 Z" fill="#fff" opacity=".55" />
      <circle cx="24" cy="24" r="3.5" fill="#fff" />
    </svg>
  );
}

// ==============================
// Time helpers (all run times are server time = Europe/Paris)
// ==============================

/** Offset (ms) of a timezone from UTC at a given instant. */
function tzOffsetMs(utcMs: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);

  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );

  return asUtc - utcMs;
}

/** Run start as a real timestamp. Accepts "19:00", "9:00", "19:00 ST", "7:00 PM", "7pm". */
function getRunStart(run: Run): number | null {
  if (!run.run_date || !run.time) return null;

  const [y, mo, d] = run.run_date.slice(0, 10).split("-").map(Number);
  if (!y || !mo || !d) return null;

  const m = run.time.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;

  let hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  const ampm = m[3]?.toLowerCase();

  if (ampm === "pm" && hour < 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  // Paris wall-clock -> UTC (second pass handles the DST changeover)
  const guess = Date.UTC(y, mo - 1, d, hour, minute);
  let utc = guess - tzOffsetMs(guess, SERVER_TZ);
  utc = guess - tzOffsetMs(utc, SERVER_TZ);

  return utc;
}

function canUploadLog(run: Run, now: number) {
  const start = getRunStart(run);
  if (start === null) return false;

  return now >= start + UPLOAD_OPENS_AFTER_MS && now <= start + UPLOAD_CLOSES_AFTER_MS;
}

function isUploadClosed(run: Run, now: number) {
  const start = getRunStart(run);
  if (start === null) return !!run.finished;

  return now > start + UPLOAD_CLOSES_AFTER_MS;
}

function canDeleteLog(
  log: RaidLog,
  currentUserId: string | null,
  isAdmin: boolean,
  now: number
) {
  if (!currentUserId) return false;
  if (isAdmin) return true;
  if (log.user_id !== currentUserId) return false;
  if (!log.created_at) return false;

  return now - new Date(log.created_at).getTime() < 2 * 60 * 60 * 1000;
}

/** "2026-10-14" for the current date in server time. */
function serverTodayYmd(now: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SERVER_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

/** Date of a given weekday slot (0 = Wednesday) in a season week. */
function dayYmd(week: number, dayIndex: number) {
  return new Date(SEASON_START_UTC + ((week - 1) * 7 + dayIndex) * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Which day column a run belongs in. */
function runDay(run: Run): string {
  if (run.run_date) {
    const [y, m, d] = run.run_date.slice(0, 10).split("-").map(Number);

    if (y && m && d) {
      const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      return names[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    }
  }

  return run.day || "";
}

/** "2026-10-14" -> "14 Oct 2026" without timezone shifting the day. */
function formatYmd(ymd?: string) {
  if (!ymd) return "No date";

  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "No date";

  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(time?: string) {
  if (!time) return "No time";
  return `${time.replace(/\s*ST\s*$/i, "").trim()} ST`;
}

function formatServerTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-GB", {
    timeZone: SERVER_TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ==============================
// Styles
// ==============================
const CSS = `
.wl-page {
  min-height: 100vh;
  color: #fff;
  font-family: Arial, sans-serif;
  background:
    linear-gradient(rgba(2,4,14,.55), rgba(0,0,0,.82)),
    url('/bg.png') center top / cover no-repeat fixed;
}

.wl-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 24px;
  padding: 24px;
}

@media (max-width: 900px) {
  .wl-layout { grid-template-columns: 1fr; }
}

/* ---------- Sidebar ---------- */
.wl-side {
  background: rgba(7,10,20,.88);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 16px;
  padding: 18px;
  height: fit-content;
}

.wl-box {
  margin-top: 18px;
  background: linear-gradient(180deg, rgba(12,22,36,.95), rgba(6,12,22,.95));
  border: 1px solid rgba(148,163,184,.18);
  border-radius: 14px;
  padding: 18px;
}

.wl-box p { color: #d1d5db; line-height: 1.6; margin: 0 0 10px; font-size: 14px; }

.wl-box-title {
  color: #9ca3af;
  font-weight: 900;
  font-size: 13px;
  letter-spacing: 1px;
  margin-bottom: 14px;
}

.wl-balance {
  color: #facc15;
  font-size: 28px;
  font-weight: 900;
  margin: 8px 0 16px;
  text-shadow: 0 0 12px rgba(250,204,21,.35);
}

.wl-pay {
  width: 100%;
  min-height: 44px;
  border: 1px solid rgba(139,92,246,.35);
  border-radius: 10px;
  background: linear-gradient(90deg,#3b0764,#6d28d9);
  color: #fff;
  font-weight: 900;
  cursor: pointer;
}

.wl-stat {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-top: 1px solid rgba(255,255,255,.07);
  color: #cbd5e1;
  font-size: 14px;
}
.wl-stat b { color: #facc15; }

/* ---------- Header ---------- */
.wl-header { display: flex; align-items: center; gap: 18px; margin-bottom: 22px; }

.wl-header-icon {
  width: 84px;
  height: 84px;
  object-fit: contain;
  filter: drop-shadow(0 0 18px rgba(168,85,247,.85));
}

.wl-title {
  margin: 0;
  font-family: Georgia, serif;
  font-size: 42px;
  font-weight: 900;
  letter-spacing: .5px;
  text-shadow: 0 0 18px rgba(168,85,247,.6);
}

.wl-sub { margin: 6px 0 0; color: #d4d4e4; font-size: 16px; }

/* ---------- Week tabs ---------- */
.wl-weeks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.wl-week {
  position: relative;
  height: 40px;
  padding: 0 22px;
  border-radius: 10px;
  border: 1px solid rgba(168,85,247,.45);
  background: rgba(8,4,20,.78);
  color: #e9d5ff;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}

.wl-week:hover {
  transform: translateY(-2px);
  border-color: rgba(217,70,239,.9);
  box-shadow: 0 0 18px rgba(217,70,239,.5);
}

.wl-week.is-selected {
  background: linear-gradient(90deg,#7c3aed,#d946ef);
  border-color: #e879f9;
  color: #fff;
  box-shadow: 0 0 18px rgba(217,70,239,.6);
}

.wl-week.is-current {
  height: 52px;
  padding: 0 30px;
  font-size: 18px;
  font-weight: 900;
  border: 2px solid #facc15;
  color: #fff7cc;
  animation: wlPulse 2.2s ease-in-out infinite;
}

.wl-week.is-current.is-selected {
  background: linear-gradient(90deg,#7c3aed,#d946ef);
  color: #fff;
}

@keyframes wlPulse {
  0%, 100% { box-shadow: 0 0 14px rgba(250,204,21,.45), inset 0 0 10px rgba(250,204,21,.15); }
  50%      { box-shadow: 0 0 32px rgba(250,204,21,.95), 0 0 54px rgba(217,70,239,.45), inset 0 0 14px rgba(250,204,21,.3); }
}

.wl-now {
  position: absolute;
  top: -9px;
  right: -8px;
  padding: 2px 7px;
  border-radius: 999px;
  background: #facc15;
  color: #1a1000;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
  box-shadow: 0 0 10px rgba(250,204,21,.8);
}

.wl-week-label .wl-now { position: static; margin-left: 10px; vertical-align: middle; }

/* ---------- Banner ---------- */
.wl-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 24px;
  margin-bottom: 22px;
  border-radius: 14px;
  border: 1px solid rgba(250,204,21,.75);
  background: linear-gradient(90deg, rgba(60,30,4,.85), rgba(20,8,40,.9) 45%, rgba(48,24,4,.85));
  box-shadow: 0 0 24px rgba(250,204,21,.25), inset 0 0 22px rgba(250,204,21,.08);
}

.wl-banner-main { display: flex; align-items: center; gap: 14px; font-size: 18px; color: #f3f4f6; }
.wl-banner-main b { font-size: 24px; color: #fff; }
.wl-banner-side { display: flex; align-items: center; gap: 10px; color: #e5e7eb; font-size: 14px; }
.wl-banner-coins { font-size: 34px; filter: drop-shadow(0 0 10px rgba(250,204,21,.7)); }

/* ---------- Day cards ---------- */
.wl-week-label {
  font-family: Georgia, serif;
  font-size: 24px;
  font-weight: 900;
  color: #e9d5ff;
  margin: 28px 0 12px;
  text-shadow: 0 0 12px rgba(168,85,247,.6);
}

.wl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 18px;
  align-items: start;
}

.wl-day {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--accent-soft);
  background: rgba(6,6,18,.9);
  box-shadow: 0 0 22px var(--accent-faint);
  transition: transform .2s ease, box-shadow .2s ease;
}

.wl-day:hover { transform: translateY(-3px); box-shadow: 0 0 34px var(--accent-soft); }

.wl-day.is-today { border: 2px solid var(--accent); box-shadow: 0 0 32px var(--accent-soft); }

.wl-day-head {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 80px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--accent-faint);
}

.wl-day-name {
  font-family: Georgia, serif;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 1px;
  text-shadow: 0 0 12px var(--accent-soft);
}

.wl-today {
  margin-left: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--accent);
  color: #fff;
  font-family: Arial, sans-serif;
  font-size: 10px;
  letter-spacing: 1px;
  vertical-align: middle;
  box-shadow: 0 0 10px var(--accent-soft);
}

.wl-day-meta { margin-top: 4px; color: #d1d5db; font-size: 14px; }

.wl-day-body { display: flex; flex-direction: column; gap: 8px; padding: 10px; }

/* ---------- Run rows ---------- */
.wl-run {
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(14,12,30,.88);
  border: 1px solid rgba(255,255,255,.07);
}

.wl-run-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
}

.wl-run-main.is-locked { grid-template-columns: minmax(0, 1fr) auto; }

.wl-run-id { font-weight: 900; font-size: 16px; }
.wl-run-when { margin-top: 3px; color: #cbd5e1; font-size: 13px; }

.wl-run-title {
  margin-top: 3px;
  color: #c4b5fd;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wl-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: 8px;
  font-weight: 800;
  font-size: 14px;
  white-space: nowrap;
}

.wl-pill.ok   { color: #4ade80; border: 1px solid rgba(34,197,94,.7);  background: rgba(5,46,22,.55); }
.wl-pill.warn { color: #facc15; border: 1px solid rgba(250,204,21,.7); background: rgba(66,52,4,.45); }

.wl-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 900;
}
.wl-pill.ok .wl-dot   { background: #22c55e; color: #04150a; }
.wl-pill.warn .wl-dot { background: #facc15; color: #2a1d00; }

.wl-lock {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid rgba(239,68,68,.75);
  background: rgba(60,6,6,.55);
  color: #fecaca;
  font-weight: 800;
  font-size: 13px;
  line-height: 1.3;
  white-space: nowrap;
  box-shadow: 0 0 12px rgba(239,68,68,.2);
}
.wl-lock-icon { font-size: 18px; }

.wl-reward { color: #fff; font-weight: 900; white-space: nowrap; }
.wl-coin { font-size: 13px; }

.wl-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: transform .18s ease, box-shadow .18s ease;
}
.wl-btn:hover:not(:disabled) { transform: translateY(-2px); }
.wl-btn:disabled { opacity: .55; cursor: not-allowed; }
.wl-btn.small { height: 32px; padding: 0 12px; font-size: 13px; }

.wl-btn.primary {
  border: 1px solid #c084fc;
  color: #fff;
  background: linear-gradient(180deg,#7c3aed,#5b21b6);
  box-shadow: 0 0 12px rgba(168,85,247,.45);
}
.wl-btn.primary:hover:not(:disabled) { box-shadow: 0 0 22px rgba(217,70,239,.8); }

.wl-btn.danger {
  border: 1px solid rgba(239,68,68,.7);
  color: #fca5a5;
  background: rgba(69,10,10,.6);
}
.wl-btn.danger:hover { box-shadow: 0 0 18px rgba(239,68,68,.55); }

.wl-btn.ghost {
  border: 1px solid rgba(255,255,255,.15);
  color: #9ca3af;
  background: rgba(0,0,0,.35);
}

.wl-log-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}

.wl-log-link {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: #38bdf8;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
}
.wl-log-link:hover { text-decoration: underline; }
.wl-log-link img { width: 22px; height: 22px; object-fit: contain; flex-shrink: 0; }
.wl-log-link span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.wl-note { color: #9ca3af; font-size: 11px; font-weight: 800; white-space: nowrap; }

.wl-uploader {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  color: #9ca3af;
  font-size: 12px;
}
.wl-uploader img { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }
.wl-uploader b { color: #f5d0fe; }

.wl-upload { display: flex; gap: 8px; margin-top: 10px; }

.wl-input {
  flex: 1;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid rgba(168,85,247,.45);
  background: rgba(0,0,0,.55);
  color: #fff;
  outline: none;
}
.wl-input:focus { border-color: #d946ef; box-shadow: 0 0 12px rgba(217,70,239,.4); }

.wl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 22px 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.wl-empty b { color: #fff; font-size: 15px; }
.wl-empty-icon { font-size: 26px; opacity: .85; }

/* ---------- Champions ---------- */
.wl-champs {
  margin-top: 28px;
  padding: 20px;
  border-radius: 18px;
  border: 1px solid rgba(168,85,247,.45);
  background:
    radial-gradient(circle at top right, rgba(217,70,239,.22), transparent 40%),
    linear-gradient(180deg, rgba(30,12,55,.96), rgba(5,10,22,.96));
  box-shadow: 0 0 35px rgba(168,85,247,.22), inset 0 0 25px rgba(168,85,247,.08);
}

.wl-champs-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.wl-champs-head h2 { margin: 0 0 4px; font-size: 26px; font-weight: 900; }
.wl-champs-head p { margin: 0; color: #c4b5fd; font-weight: 800; }
.wl-champs-total { color: #e5e7eb; font-weight: 900; }
.wl-champs-total b { color: #facc15; margin-left: 6px; }

.wl-champs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.wl-champ {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(90deg, rgba(255,255,255,.055), rgba(168,85,247,.06));
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.wl-champ:hover {
  transform: translateY(-3px);
  border-color: rgba(217,70,239,.45);
  box-shadow: 0 0 26px rgba(217,70,239,.35);
}
.wl-champ.top1 { border-color: rgba(250,204,21,.6); box-shadow: 0 0 18px rgba(250,204,21,.25); }

.wl-rank {
  position: absolute;
  top: -8px;
  left: -8px;
  padding: 4px 8px;
  border-radius: 999px;
  background: linear-gradient(90deg,#7c3aed,#d946ef);
  font-size: 11px;
  font-weight: 900;
  box-shadow: 0 0 12px rgba(217,70,239,.5);
}
.wl-champ.top1 .wl-rank { background: linear-gradient(90deg,#ca8a04,#facc15); color: #1a1000; }

.wl-champ-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.wl-champ-left img {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(168,85,247,.8);
  box-shadow: 0 0 14px rgba(168,85,247,.45);
  flex-shrink: 0;
}
.wl-champ-name {
  color: #f5d0fe;
  font-size: 16px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wl-champ-count { color: #b8b8c8; font-size: 13px; margin-top: 4px; }
.wl-champ-gold {
  color: #facc15;
  font-size: 17px;
  font-weight: 900;
  white-space: nowrap;
  text-shadow: 0 0 12px rgba(250,204,21,.35);
}

/* ---------- Popup ---------- */
.wl-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,.65);
  backdrop-filter: blur(4px);
}

.wl-modal {
  width: 420px;
  max-width: calc(100vw - 32px);
  padding: 28px;
  border-radius: 18px;
  text-align: center;
  background: linear-gradient(180deg,#12001f,#05010d);
  border: 1px solid rgba(168,85,247,.6);
  box-shadow: 0 0 35px rgba(168,85,247,.55);
}
.wl-modal.error { border-color: rgba(239,68,68,.6); box-shadow: 0 0 35px rgba(239,68,68,.35); }

.wl-modal-title { font-size: 24px; font-weight: 900; color: #facc15; margin-bottom: 12px; }
.wl-modal-text { color: #e5e7eb; font-size: 16px; line-height: 1.5; white-space: pre-line; }
.wl-modal-actions { display: flex; justify-content: center; gap: 12px; margin-top: 22px; }
`;
