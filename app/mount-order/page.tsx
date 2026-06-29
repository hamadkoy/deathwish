"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type GuildProfile = {
  user_id: string;
  discord_name: string | null;
  avatar_url: string | null;
  guild_role: string | null;
  discord_id: string | null;
};

type PerformanceRank = "S" | "A" | "B" | "C" | "F";

type MountRow = {
  id: string;
  user_id: string;
  attendance: number;
  performance: number;
  performanceRank: PerformanceRank;
  received: boolean;
  profile: GuildProfile;
};

const allowedRanks = ["Trial", "Raider", "Death Wish", "Officer", "Guild Master"];
const officerRanks = ["Officer", "Guild Master"];

const SHEET_ID = "1c_lPdMLgR8XRtQKh1yW7lzlr2myaVXgyQxpWVkXqj0Q";
const SHEET_GID = "840624317";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

const performancePoints: Record<PerformanceRank, number> = {
  S: 75000,
  A: 50000,
  B: 35000,
  C: 0,
  F: -20000,
};

function performanceFromPoints(points: number): PerformanceRank {
  if (points === 75000) return "S";
  if (points === 50000) return "A";
  if (points === 35000) return "B";
  if (points === -20000) return "F";
  return "C";
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (value || row.length) {
        row.push(value);
        rows.push(row);
        row = [];
        value = "";
      }
    } else {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

async function loadAttendanceFromSheet() {
  const response = await fetch(SHEET_CSV_URL);
  const csv = await response.text();
  const rows = parseCsv(csv);

  const result: Record<string, number> = {};

  // Find the first roster row (where the User ID begins)
  const startRow = rows.findIndex((row) => {
    const id = String(row[10] || "").trim(); // Column K
    return /^\d{16,20}$/.test(id);
  });

  if (startRow === -1) {
    console.log("Roster not found.");
    return result;
  }

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];

    const userId = String(row[10] || "").trim();       // K
    const attendance = Number(
      String(row[12] || "0").replace(/,/g, "")         // M
    );

    if (!userId) continue;

    result[userId] = Number.isFinite(attendance)
      ? attendance
      : 0;
  }

  console.log(result);

  return result;
}

export default function MountOrderPage() {
  const [rows, setRows] = useState<MountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const canEdit = myRank ? officerRanks.includes(myRank) : false;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();

    if (auth.user) {
      const { data: me } = await supabase
        .from("profiles")
        .select("guild_role")
        .eq("user_id", auth.user.id)
        .single();

      setMyRank(me?.guild_role ?? null);
    }

    const attendanceMap = await loadAttendanceFromSheet();

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("user_id, discord_id, discord_name, avatar_url, guild_role")
      .eq("accepted_application", true);

    if (error) {
      alert(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const validProfiles = (profiles || []).filter((p) =>
      allowedRanks.includes(p.guild_role || "Trial")
    );

    const { data: mountRows } = await supabase
      .from("mount_order")
      .select("id, user_id, performance, received");

    const mergedRows: MountRow[] = validProfiles.map((profile) => {
      const mount = mountRows?.find((m) => m.user_id === profile.user_id);
      const performance = mount?.performance ?? 0;

      return {
        id: mount?.id ?? profile.user_id,
        user_id: profile.user_id,
        attendance: attendanceMap[String(profile.discord_id || "")] ?? 0,
        performance,
        performanceRank: mount?.performance
          ? performanceFromPoints(performance)
          : "C",
        received: mount?.received ?? false,
        profile,
      };
    });

    setRows(mergedRows);
    setLoading(false);
  }

  const activeRows = useMemo(() => {
    return rows
      .filter((row) => !row.received)
      .sort(
        (a, b) =>
          b.attendance + b.performance - (a.attendance + a.performance)
      );
  }, [rows]);

  const completedRows = useMemo(() => {
    return rows.filter((row) => row.received);
  }, [rows]);

  function updatePerformanceRank(id: string, rank: PerformanceRank) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              performanceRank: rank,
              performance: performancePoints[rank],
            }
          : row
      )
    );
  }

  async function saveRow(row: MountRow) {
    setSavingId(row.id);

    const { data: existing } = await supabase
      .from("mount_order")
      .select("id")
      .eq("user_id", row.user_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("mount_order")
        .update({
          attendance: row.attendance,
          performance: row.performance,
          received: row.received,
        })
        .eq("user_id", row.user_id);

      if (error) {
        alert(error.message);
        setSavingId(null);
        return;
      }
    } else {
      const { error } = await supabase.from("mount_order").insert({
        user_id: row.user_id,
        attendance: row.attendance,
        performance: row.performance,
        received: row.received,
      });

      if (error) {
        alert(error.message);
        setSavingId(null);
        return;
      }
    }

    await loadData();
    setSavingId(null);
  }

  async function markReceived(row: MountRow) {
    setSavingId(row.id);

    const { data: existing } = await supabase
      .from("mount_order")
      .select("id")
      .eq("user_id", row.user_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("mount_order")
        .update({
          attendance: row.attendance,
          performance: row.performance,
          received: true,
        })
        .eq("user_id", row.user_id);
    } else {
      await supabase.from("mount_order").insert({
        user_id: row.user_id,
        attendance: row.attendance,
        performance: row.performance,
        received: true,
      });
    }

    await loadData();
    setSavingId(null);
  }

  async function undoReceived(row: MountRow) {
    setSavingId(row.id);

    await supabase
      .from("mount_order")
      .update({ received: false })
      .eq("user_id", row.user_id);

    await loadData();
    setSavingId(null);
  }

  if (loading) {
    return <main className="mountPage">Loading mount order...</main>;
  }

  return (
    <main className="mountPage">
      <section className="mountWrap">
        <div className="mountHeader">
          <h1>Mount Order</h1>
          <p>Attendance from Google Sheet + Performance Rank = Total Score</p>
        </div>

        <div className="mountTableWrap">
          <img src="/Flying bird.png" alt="" className="tableBird tableBirdLeft" />
          <img src="/Ground bird.png" alt="" className="tableBird tableBirdRight" />

          <div className="mountTable">
            <div className={`tableHead ${!canEdit ? "noActions" : ""}`}>
              <span>Rank</span>
              <span>Player</span>
              <span>Attendance</span>
              <span>Performance</span>
              <span>Total</span>
              {canEdit && <span>Actions</span>}
            </div>

            {activeRows.map((row, index) => {
              const total = row.attendance + row.performance;
              const name = row.profile.discord_name ?? "Unknown";
              const avatar = row.profile.avatar_url ?? "/default-avatar.png";
              const rank = row.profile.guild_role ?? "Trial";

              return (
                <div className={`tableRow ${!canEdit ? "noActions" : ""}`} key={row.user_id}>
                  <div className="rankBox">#{index + 1}</div>

                  <div className="playerBox">
                    <img src={avatar} alt={name} />
                    <div>
                      <strong>{name}</strong>
                      <small>{rank}</small>
                    </div>
                  </div>

                  <div className="attendanceBox">
                    {row.attendance.toLocaleString()}
                  </div>

                  <div className="scoreBox">
                    {canEdit ? (
                      <select
                        value={row.performanceRank}
                        onChange={(e) =>
                          updatePerformanceRank(
                            row.id,
                            e.target.value as PerformanceRank
                          )
                        }
                        className={`rankSelect rank${row.performanceRank}`}
                      >
                        <option value="S">S</option>
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="F">F</option>
                      </select>
                    ) : (
                      <span className={`perfBadge rank${row.performanceRank}`}>
                        {row.performanceRank}
                      </span>
                    )}
                  </div>

                  <div className="totalBox">{total.toLocaleString()}</div>

                  {canEdit && (
                    <div className="actionBox">
                      <button
                        onClick={() => saveRow(row)}
                        disabled={savingId === row.id}
                      >
                        Save
                      </button>

                      <button
                        className="receivedBtn"
                        onClick={() => markReceived(row)}
                        disabled={savingId === row.id}
                      >
                        Mount Received
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="completedBox">
          <h2>Mount Received</h2>

          {completedRows.length === 0 && <p>No one received the mount yet.</p>}

          {completedRows.map((row) => (
            <div className="completedRow" key={row.user_id}>
              <span>{row.profile.discord_name ?? "Unknown"}</span>
              {canEdit && <button onClick={() => undoReceived(row)}>Put Back</button>}
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .mountPage {
          min-height: 100vh;
          background:
            linear-gradient(rgba(5, 0, 12, 0.65), rgba(5, 0, 12, 0.95)),
            url("/Roster.png") center / cover fixed;
          color: white;
          padding: 120px 40px 60px;
        }

        .mountWrap {
          max-width: 1450px;
          margin: 0 auto;
        }

        .mountHeader {
          text-align: center;
          margin-bottom: 35px;
        }

        .mountHeader h1 {
          font-size: 46px;
          margin: 0;
          color: #f5d76e;
        }

        .mountHeader p {
          color: #d8c9ff;
          margin-top: 10px;
        }

        .mountTableWrap {
          position: relative;
        }

        .tableBird {
          position: absolute;
          z-index: 30;
          pointer-events: none;
          filter:
            drop-shadow(0 0 16px rgba(255, 215, 0, 0.9))
            drop-shadow(0 0 28px rgba(59, 130, 246, 0.75));
        }

        .tableBirdLeft {
          width: 170px;
          top: -95px;
          left: -65px;
          animation: birdFloatLeft 5s ease-in-out infinite;
        }

        .tableBirdRight {
          width: 170px;
          top: -95px;
          right: -65px;
          transform: scaleX(-1);
          animation: birdFloatRight 6s ease-in-out infinite;
        }

        @keyframes birdFloatLeft {
          0%, 100% {
            transform: translateY(0) rotate(-4deg);
          }

          50% {
            transform: translateY(-18px) rotate(4deg);
          }
        }

        @keyframes birdFloatRight {
          0%, 100% {
            transform: scaleX(-1) translateY(0) rotate(4deg);
          }

          50% {
            transform: scaleX(-1) translateY(-18px) rotate(-4deg);
          }
        }

        .mountTable {
          border: 1px solid rgba(168, 85, 247, 0.55);
          border-radius: 18px;
          overflow: hidden;
          background: rgba(5, 0, 12, 0.82);
        }

        .tableHead,
        .tableRow {
          display: grid;
          grid-template-columns: 90px 2fr 230px 230px 160px 320px;
          align-items: center;
          gap: 18px;
          padding: 18px 28px;
        }

        .tableHead.noActions,
        .tableRow.noActions {
          grid-template-columns: 90px 2fr 230px 230px 160px;
        }

        .tableHead {
          background: rgba(168, 85, 247, 0.25);
          color: #f5d76e;
          font-weight: 900;
          text-transform: uppercase;
          font-size: 13px;
          letter-spacing: 1px;
        }

        .tableRow {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .playerBox {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .playerBox img {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #a855f7;
        }

        .playerBox strong {
          display: block;
          font-size: 17px;
        }

        .playerBox small {
          color: #c9b6ff;
        }

        .rankBox,
        .attendanceBox,
        .totalBox {
          font-size: 26px;
          font-weight: 900;
          color: #f5d76e;
        }

        .attendanceBox {
          color: #38bdf8;
        }

        .totalBox {
          color: #22c55e;
        }

        .rankSelect {
          width: 110px;
          height: 52px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          text-align: center;
          font-size: 22px;
          font-weight: 900;
          padding: 0 14px;
          cursor: pointer;
          transition: all 0.22s ease;
        }

        .rankSelect:hover {
          transform: scale(1.08);
          filter: brightness(1.18);
        }

        .perfBadge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 90px;
          height: 46px;
          border-radius: 12px;
          font-size: 22px;
          font-weight: 900;
        }

        .rankS {
          background: linear-gradient(135deg, #facc15, #a16207);
          box-shadow: 0 0 18px rgba(250, 204, 21, 0.55);
        }

        .rankA {
          background: linear-gradient(135deg, #0284c7, #38bdf8);
          box-shadow: 0 0 18px rgba(56, 189, 248, 0.45);
        }

        .rankB {
          background: linear-gradient(135deg, #15803d, #22c55e);
          box-shadow: 0 0 18px rgba(34, 197, 94, 0.45);
        }

        .rankC {
          background: linear-gradient(135deg, #4b5563, #9ca3af);
          box-shadow: 0 0 18px rgba(156, 163, 175, 0.25);
        }

        .rankF {
          background: linear-gradient(135deg, #7f1d1d, #ef4444);
          box-shadow: 0 0 18px rgba(239, 68, 68, 0.45);
        }

        .actionBox {
          display: flex;
          gap: 10px;
        }

        button {
          border: none;
          border-radius: 10px;
          padding: 12px 18px;
          cursor: pointer;
          color: white;
          font-weight: 900;
          background: linear-gradient(135deg, #7e22ce, #a855f7);
          transition: all 0.22s ease;
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.35);
        }

        button:hover:not(:disabled) {
          transform: translateY(-2px) scale(1.05);
          box-shadow:
            0 0 16px rgba(168, 85, 247, 0.95),
            0 0 32px rgba(168, 85, 247, 0.55);
          filter: brightness(1.15);
        }

        button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .receivedBtn {
          background: linear-gradient(135deg, #15803d, #22c55e);
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.35);
        }

        .receivedBtn:hover:not(:disabled) {
          box-shadow:
            0 0 16px rgba(34, 197, 94, 0.95),
            0 0 32px rgba(34, 197, 94, 0.55);
        }

        .completedBox {
          margin-top: 35px;
          background: rgba(5, 0, 12, 0.78);
          border: 1px solid rgba(34, 197, 94, 0.45);
          border-radius: 18px;
          padding: 22px;
        }

        .completedBox h2 {
          color: #22c55e;
          margin-top: 0;
        }

        .completedRow {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </main>
  );
}