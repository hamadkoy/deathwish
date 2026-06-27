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

const allowedRanks = ["Trial", "Raider", "Death Wish", "Officer", "Guild Master"];

export default function WarcraftLogsPage() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [noAccess, setNoAccess] = useState(false);

  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      setNoAccess(true);
      setCheckingAccess(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("site_role")
      .eq("user_id", user.id)
      .single();

    const role = data?.site_role || "";

    if (!allowedRanks.includes(role)) {
      setNoAccess(true);
      setCheckingAccess(false);
      return;
    }

    setCheckingAccess(false);
    loadLogs();
  }

  async function loadLogs() {
    const { data } = await supabase
      .from("warcraft_logs_calendar")
      .select("*")
      .order("log_date", { ascending: false });

    setLogs(data || []);
  }

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return [
      ...Array(firstDay).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [month, year]);

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
      note: note || "WarcraftLogs",
    });

    if (error) {
      alert(error.message);
      setSaving(false);
      return;
    }

    setUrl("");
    setNote("");
    await loadLogs();
    setSaving(false);
  }

  if (checkingAccess || noAccess) {
    return (
      <main className="accessPage">
        <div className={noAccess ? "deniedText" : "checkingText"}>
          {noAccess
            ? "You do not have access to view this page"
            : "Checking Access..."}
        </div>

        <style jsx>{`
          .accessPage {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background:
              linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.65)),
              url("/Roster.png") center/cover fixed;
          }

          .checkingText {
            color: #fb7185;
            font-size: 44px;
            font-weight: 900;
            text-align: center;
            text-shadow: 0 0 18px rgba(251, 113, 133, 0.9);
          }

          .deniedText {
            color: #ef4444;
            font-size: 38px;
            font-weight: 900;
            text-align: center;
            text-shadow: 0 0 18px rgba(239, 68, 68, 0.9);
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="wrap">
        <h1>WarcraftLogs</h1>

        <p className="sub">
          Click a day, upload logs, then open logs from the calendar.
        </p>

        <div className="top">
          <button onClick={() => changeMonth("prev")}>◀</button>

          <h2>
            {new Date(year, month).toLocaleString("en", { month: "long" })}{" "}
            {year}
          </h2>

          <button onClick={() => changeMonth("next")}>▶</button>
        </div>

        <div className="calendar">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
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
                }`}
              >
                <b>{day}</b>

                {logsForDay(day).map((log) => (
                  <a
                    key={log.id}
                    href={log.log_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="logLink"
                  >
                    {log.note || "Open Log"}
                  </a>
                ))}
              </button>
            ) : (
              <div key={i} />
            )
          )}
        </div>

        {selectedDate && (
          <div className="uploadBox">
            <h3>Upload log for {selectedDate}</h3>

            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.warcraftlogs.com/reports/..."
            />

            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note: Mythic / Heroic / Boss"
            />

            <button onClick={uploadLog} disabled={saving}>
              {saving ? "Uploading..." : "Upload Log"}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          padding: 95px 24px 60px;
          color: white;
          background:
            radial-gradient(circle at top, rgba(147, 51, 234, 0.22), transparent 35%),
            linear-gradient(rgba(2, 0, 10, 0.45), rgba(2, 0, 10, 0.9)),
            url("/Roster.png") center/cover fixed;
        }

        .wrap {
          max-width: 1050px;
          margin: auto;
        }

        h1 {
          text-align: center;
          color: #fde047;
          font-size: 56px;
          font-weight: 900;
          text-shadow: 0 0 18px rgba(250, 204, 21, 0.9);
        }

        .sub {
          text-align: center;
          color: #d8b4fe;
          margin-bottom: 28px;
          font-size: 15px;
        }

        .top {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 28px;
          margin-bottom: 24px;
        }

        .top h2 {
          min-width: 260px;
          text-align: center;
          color: #facc15;
          font-size: 30px;
          font-weight: 900;
        }

        .top button {
          width: 50px;
          height: 44px;
          border-radius: 14px;
          border: 1px solid #c084fc;
          background: linear-gradient(180deg, #a855f7, #6d28d9);
          color: white;
          font-size: 20px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 0 18px rgba(168, 85, 247, 0.7);
        }

        .calendar {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 12px;
          padding: 22px;
          border-radius: 24px;
          border: 1px solid rgba(192, 132, 252, 0.7);
          background: rgba(3, 0, 12, 0.84);
          box-shadow:
            0 0 35px rgba(168, 85, 247, 0.35),
            inset 0 0 35px rgba(88, 28, 135, 0.35);
        }

        .dayName {
          text-align: center;
          color: #fde047;
          font-size: 14px;
          font-weight: 900;
          padding-bottom: 8px;
        }

        .day {
          min-height: 112px;
          padding: 12px;
          border-radius: 15px;
          border: 1px solid rgba(168, 85, 247, 0.42);
          background:
            linear-gradient(180deg, rgba(22, 0, 40, 0.95), rgba(3, 0, 12, 0.95));
          color: white;
          cursor: pointer;
          transition: 0.2s ease;
          text-align: left;
        }

        .day:hover,
        .day.active {
          border-color: #fde047;
          transform: translateY(-3px);
          box-shadow:
            0 0 22px rgba(250, 204, 21, 0.45),
            inset 0 0 18px rgba(250, 204, 21, 0.08);
        }

        .day b {
          display: block;
          color: #fde047;
          font-size: 17px;
          margin-bottom: 8px;
        }

        .logLink {
          display: block;
          margin-top: 7px;
          padding: 7px 9px;
          border-radius: 8px;
          background: linear-gradient(90deg, #ea580c, #f97316);
          color: white;
          font-size: 11px;
          font-weight: 900;
          text-decoration: none;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          box-shadow: 0 0 10px rgba(249, 115, 22, 0.55);
        }

        .uploadBox {
          margin-top: 24px;
          padding: 24px;
          border-radius: 20px;
          border: 1px solid rgba(192, 132, 252, 0.65);
          background: rgba(3, 0, 12, 0.86);
          box-shadow: 0 0 28px rgba(168, 85, 247, 0.25);
        }

        .uploadBox h3 {
          color: #fde047;
          font-size: 18px;
          margin-bottom: 16px;
        }

        .uploadBox input {
          width: 100%;
          margin-bottom: 13px;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #9333ea;
          background: rgba(0, 0, 0, 0.72);
          color: white;
          outline: none;
        }

        .uploadBox button {
          padding: 13px 22px;
          border-radius: 12px;
          border: 1px solid #c084fc;
          background: linear-gradient(90deg, #7e22ce, #d946ef);
          color: white;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 0 18px rgba(217, 70, 239, 0.65);
        }
      `}</style>
    </main>
  );
}