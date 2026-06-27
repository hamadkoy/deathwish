// app/warcraft-logs/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type LogRow = {
  id: string;
  user_id: string;
  log_date: string;
  log_url: string;
  note: string | null;
  created_at: string;
};

type ProfileRow = {
  user_id: string;
  discord_name: string | null;
  avatar_url: string | null;
};

const allowedRanks = ["Trial", "Raider", "Death Wish", "Officer", "Guild Master"];

export default function WarcraftLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [selectedDate, setSelectedDate] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
const [canViewLogs, setCanViewLogs] = useState(false);
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  useEffect(() => {
  loadLogs();
  loadUserRole();
}, []);
async function loadUserRole() {
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    setCanViewLogs(false);
    return;
  }

  const { data } = await supabase
    .from("profiles")
    .select("guild_role")
    .eq("user_id", authData.user.id)
    .single();

  const allowedRanks = [
    "Trial",
    "Raider",
    "Death Wish",
    "Officer",
    "Guild Master",
  ];

  setCanViewLogs(
    allowedRanks.includes(data?.guild_role || "")
  );
}
  async function loadLogs() {
    const { data: logsData } = await supabase
      .from("warcraft_logs_calendar")
      .select("*")
      .order("log_date", { ascending: false });

    const loadedLogs = logsData || [];
    setLogs(loadedLogs);

    const userIds = [...new Set(loadedLogs.map((log) => log.user_id))];

    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, discord_name, avatar_url")
        .in("user_id", userIds);

      const map: Record<string, ProfileRow> = {};
      (profileData || []).forEach((profile) => {
        map[profile.user_id] = profile;
      });

      setProfiles(map);
    }
  }

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [month, year]);

  const logsChampion = useMemo(() => {
    const count: Record<string, number> = {};

    logs.forEach((log) => {
      count[log.user_id] = (count[log.user_id] || 0) + 1;
    });

    return Object.entries(count)
      .map(([user_id, total]) => ({ user_id, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [logs]);

  function changeMonth(direction: "prev" | "next") {
    if (direction === "prev") {
      if (month === 0) {
        setMonth(11);
        setYear(year - 1);
      } else {
        setMonth(month - 1);
      }
    }

    if (direction === "next") {
      if (month === 11) {
        setMonth(0);
        setYear(year + 1);
      } else {
        setMonth(month + 1);
      }
    }
  }

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`;
  }

  function logsForDay(day: number) {
    return logs.filter((log) => log.log_date === dateKey(day));
  }

  async function uploadLog() {
    if (!selectedDate || !url) {
      alert("Choose a day and paste WarcraftLogs link.");
      return;
    }

    if (!url.includes("warcraftlogs.com")) {
      alert("Please paste a valid WarcraftLogs link.");
      return;
    }

    setSaving(true);

    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      alert("You must be logged in.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("warcraft_logs_calendar").insert({
      user_id: authData.user.id,
      log_date: selectedDate,
      log_url: url,
      note: "WarcraftLogs",
    });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setUrl("");
    await loadLogs();
    setSaving(false);
  }
  return (
    <main className="page">
      <div className="wrap">
        <div className="titleBox">
          <h1>WARCRAFT LOGS</h1>
          <p>Click a day, upload logs, then open logs from the calendar.</p>
        </div>

        <div className="monthRow">
          <button onClick={() => changeMonth("prev")}>←</button>

          <h2>
            {new Date(year, month).toLocaleString("en", { month: "long" })}{" "}
            {year}
          </h2>

          <button onClick={() => changeMonth("next")}>→</button>
        </div>

        <div className="calendarFrame">
          <div className="calendar">
            {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
              <div key={d} className="dayName">
                {d}
              </div>
            ))}

            {days.map((day, i) =>
              day ? (
                <button
                  key={i}
                  onClick={() => setSelectedDate(dateKey(day))}
                  className={`day ${
                    selectedDate === dateKey(day) ? "active" : ""
                  } ${logsForDay(day).length > 0 ? "hasLog" : ""}`}
                >
                  <b>{day}</b>

                  {logsForDay(day).length > 0 && <span className="dot" />}

                  {logsForDay(day).map((log) => (
canViewLogs ? (
  <a
    key={log.id}
    href={log.log_url}
    target="_blank"
    rel="noreferrer"
    onClick={(e) => e.stopPropagation()}
    className="logLink"
  >
    View Logs
  </a>
) : (
  <div
    key={log.id}
    className="logLocked"
    onClick={(e) => e.stopPropagation()}
  >
    🔒 Locked
  </div>
)
                  ))}
                </button>
              ) : (
                <div key={i} className="emptyDay" />
              )
            )}
          </div>

          <div className="legend">
            <span>
              <i className="blueDot" /> Log uploaded
            </span>
            <span>
              <i className="goldDot" /> Multiple logs
            </span>
            <span>
              <i className="emptyDot" /> No logs
            </span>
          </div>
        </div>

        <div className="logsChampion">
          <h3>🏆 Logs Champion</h3>

          {logsChampion.length === 0 ? (
            <p>No logs uploaded yet.</p>
          ) : (
            logsChampion.map((u, i) => {
              const profile = profiles[u.user_id];

              return (
                <div key={u.user_id} className="championRow">
                  <span>#{i + 1}</span>

                  <img
                    src={profile?.avatar_url || "/websitelogo.png"}
                    alt=""
                    className="championAvatar"
                  />

                  <b>{profile?.discord_name || "Unknown User"}</b>

                  <em>{u.total} logs</em>
                </div>
              );
            })
          )}
        </div>

        {selectedDate && (
          <div className="uploadBox">
            <button
              className="closeUpload"
              onClick={() => {
                setSelectedDate("");
                setUrl("");
              }}
            >
              ✕
            </button>

            <h3>Upload log for {selectedDate}</h3>

            <div className="formRow">
              <div className="inputs">
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.warcraftlogs.com/reports/..."
                />
              </div>

              <button onClick={uploadLog} disabled={saving}>
                {saving ? "Uploading..." : "Upload Log"}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 55px 24px 60px;
          color: white;
          background:
            linear-gradient(rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.55)),
            url("/warcraftlogs.png") center/cover fixed;
        }

        .wrap {
          max-width: 1180px;
          margin: auto;
        }

        .titleBox {
          text-align: center;
          margin-bottom: 18px;
        }

        h1 {
          color: #f7d47a;
          font-family: Georgia, serif;
          font-size: 68px;
          font-weight: 900;
          letter-spacing: 3px;
          text-shadow:
            0 3px 0 #3b2108,
            0 0 24px rgba(255, 190, 70, 0.9),
            0 0 45px rgba(0, 153, 255, 0.35);
        }

        .titleBox p {
          margin-top: 4px;
          color: #f4eee2;
          font-size: 15px;
          text-shadow: 0 0 10px black;
        }

        .monthRow {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 28px;
          margin-bottom: 18px;
        }

        .monthRow h2 {
          min-width: 310px;
          padding: 10px 26px;
          text-align: center;
          color: #f7d47a;
          font-family: Georgia, serif;
          font-size: 30px;
          font-weight: 900;
          border: 1px solid rgba(201, 137, 55, 0.85);
          background: linear-gradient(180deg, #111b27, #05070b);
        }

.monthRow button {
  width: 58px;
  height: 58px;
  border-radius: 12px;

  border: 1px solid rgba(201, 137, 55, 0.9);

  background: linear-gradient(180deg, #17456b, #06111d);

  color: #f7d47a;
  font-size: 30px;
  font-weight: 900;

  cursor: pointer;

  transition: all 0.25s ease;

  box-shadow:
    0 0 12px rgba(0, 153, 255, 0.35),
    inset 0 0 10px rgba(255,255,255,.05);
}

.monthRow button:hover {
  transform: scale(1.18) rotate(8deg);

  box-shadow:
    0 0 15px rgba(0,153,255,.7),
    0 0 30px rgba(0,153,255,.5),
    0 0 50px rgba(0,153,255,.3);

  border-color: #58c4ff;
}

.monthRow button:active {
  transform: scale(1.08);
}
        .calendarFrame {
          padding: 28px;
          border: 1px solid rgba(201, 137, 55, 0.85);
          background: rgba(1, 7, 12, 0.84);
          box-shadow:
            0 0 30px rgba(0, 0, 0, 0.9),
            inset 0 0 35px rgba(0, 0, 0, 0.9);
        }

        .calendar {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }

        .dayName {
          text-align: center;
          color: #f7d47a;
          font-family: Georgia, serif;
          font-size: 15px;
          font-weight: 900;
          padding-bottom: 12px;
        }

        .emptyDay,
        .day {
          min-height: 90px;
        }

        .day {
          position: relative;
          padding: 12px;
          border: 1px solid rgba(151, 98, 43, 0.8);
          background:
            linear-gradient(rgba(3, 10, 16, 0.55), rgba(0, 0, 0, 0.82)),
            url("/warcraftlogs.png") center/cover;
          color: white;
          cursor: pointer;
          transition: 0.2s ease;
          text-align: center;
          overflow: hidden;
          box-shadow: inset 0 0 28px rgba(0, 0, 0, 0.85);
        }

        .day::before {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(0, 15, 28, 0.68);
          z-index: 0;
        }

        .day b,
        .dot,
        .logLink {
          position: relative;
          z-index: 2;
        }

        .day b {
          display: block;
          color: #f4efe6;
          font-family: Georgia, serif;
          font-size: 28px;
          line-height: 1;
          margin-top: 6px;
          text-shadow: 0 0 10px black;
        }

        .day:hover,
        .day.active {
          border-color: #4bb3ff;
          transform: translateY(-2px);
          box-shadow:
            0 0 22px rgba(0, 153, 255, 0.9),
            inset 0 0 24px rgba(70, 170, 255, 0.45);
        }

        .day.hasLog {
          border-color: #2fa8ff;
          background:
            linear-gradient(180deg, rgba(7, 82, 145, 0.95), rgba(3, 35, 75, 0.98)) !important;
          box-shadow:
            inset 0 0 35px rgba(0, 0, 0, 0.8),
            inset 0 0 18px rgba(75, 180, 255, 0.45);
        }

        .day.hasLog::before {
          background:
            radial-gradient(circle at top, rgba(80, 175, 255, 0.35), transparent 45%),
            rgba(0, 20, 45, 0.35) !important;
        }

        .day.hasLog b {
          color: #f7d47a;
          font-size: 34px;
          text-shadow:
            0 0 8px black,
            0 0 16px rgba(255, 205, 70, 0.95);
        }

        .dot {
          display: block;
          width: 11px;
          height: 11px;
          margin: 9px auto 0;
          border-radius: 50%;
          background: #28a8ff;
          box-shadow: 0 0 12px #28a8ff;
        }

        .logLink {
          display: block;
          max-width: 105px;
          margin: 8px auto 0;
          padding: 7px 10px;
          border-radius: 6px;
          background: linear-gradient(180deg, #1d8ee8, #07518a);
          color: white;
          font-size: 11px;
          font-weight: 900;
          text-decoration: none;
          border: 1px solid #7dd3fc;
        }

        .legend {
          display: flex;
          justify-content: center;
          gap: 36px;
          margin-top: 18px;
          color: #ddd6c7;
          font-size: 14px;
        }

        .legend span {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .blueDot,
        .goldDot,
        .emptyDot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: inline-block;
        }

        .blueDot {
          background: #28a8ff;
          box-shadow: 0 0 10px #28a8ff;
        }

        .goldDot {
          background: #f2a92c;
          box-shadow: 0 0 10px #f2a92c;
        }

        .emptyDot {
          border: 1px solid #c78937;
        }

.logsChampion {
  position: fixed;
  right: 30px;
  top: 160px;

  width: 380px;
  padding: 24px;

  border: none;
  border-radius: 20px;

  background: rgba(5, 10, 20, 0.78);
  backdrop-filter: blur(8px);

  box-shadow:
    0 12px 35px rgba(0,0,0,.55),
    0 0 25px rgba(59,130,246,.15);

  color: white;
  overflow: hidden;
}

.logsChampion h3 {
  color: #f7d47a;
  font-family: Georgia, serif;
  font-size: 28px;
  margin-bottom: 20px;
  text-align: center;
}

        .logsChampion p {
          color: #cbd5e1;
          text-align: center;
          font-size: 13px;
        }

.championRow {
  display: grid;
  grid-template-columns: 50px 55px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(255,255,255,.08);
}

        .championRow span {
          color: #38bdf8;
          font-weight: 900;
        }

.championAvatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;

  border: 2px solid #38bdf8;

  box-shadow:
    0 0 12px rgba(56,189,248,.6);
}
    .logLocked {
  display: block;
  max-width: 105px;
  margin: 8px auto 0;
  padding: 7px 10px;
  border-radius: 6px;

  background: rgba(80,80,80,.6);

  color: #cbd5e1;
  font-size: 11px;
  font-weight: 900;

  border: 1px solid rgba(255,255,255,.15);

  cursor: not-allowed;
}

        .championRow b {
          color: #f8fafc;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .championRow em {
          color: #f7d47a;
          font-style: normal;
          font-size: 12px;
          font-weight: 900;
        }

        .uploadBox {
          position: relative;
          margin-top: 20px;
          padding: 24px;
          border: 1px solid rgba(201, 137, 55, 0.85);
          background: rgba(1, 7, 12, 0.86);
          box-shadow:
            0 0 24px rgba(0, 0, 0, 0.85),
            inset 0 0 30px rgba(0, 0, 0, 0.9);
        }

        .closeUpload {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 22px;
          height: 22px;
          padding: 0;
          border-radius: 50%;
          border: 1px solid #ef4444;
          background: rgba(0, 0, 0, 0.85);
          color: #ef4444;
          font-size: 13px;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .closeUpload:hover {
          background: #ef4444;
          color: white;
        }

        .uploadBox h3 {
          color: #f7d47a;
          font-family: Georgia, serif;
          font-size: 19px;
          margin-bottom: 16px;
          text-transform: uppercase;
        }

        .formRow {
          display: grid;
          grid-template-columns: 1fr 290px;
          gap: 26px;
          align-items: center;
        }

        .inputs input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 5px;
          border: 1px solid rgba(201, 137, 55, 0.75);
          background: rgba(0, 0, 0, 0.72);
          color: white;
          outline: none;
        }

        .uploadBox > .formRow button {
          height: 66px;
          border: 1px solid rgba(201, 137, 55, 0.95);
          background: linear-gradient(180deg, #1768a5, #08233d);
          color: #f7d47a;
          font-family: Georgia, serif;
          font-size: 22px;
          font-weight: 900;
          cursor: pointer;
          text-transform: uppercase;
          box-shadow:
            inset 0 0 20px rgba(0, 0, 0, 0.75),
            0 0 22px rgba(0, 153, 255, 0.45);
        }

        @media (max-width: 1300px) {
          .logsChampion {
            position: static;
            width: 100%;
            margin-top: 20px;
          }
        }

        @media (max-width: 900px) {
          h1 {
            font-size: 42px;
          }

          .calendarFrame {
            overflow-x: auto;
          }

          .calendar {
            min-width: 850px;
          }

          .formRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}