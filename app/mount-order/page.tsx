"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type GuildProfile = {
  user_id: string;
  discord_id: string | null;
  discord_name: string | null;
  avatar_url: string | null;
  guild_role: string | null;
};

type PerformanceRank = "S" | "A" | "B" | "C" | "F";
type Tab = "standings" | "notes" | "received";

type Vote = { voter_id: string; target_id: string; rank: PerformanceRank };

type MountRow = {
  user_id: string;
  attendance: number;
  note: string;
  received: boolean;
  rankOverride: PerformanceRank | null;
  mountName: string;
  receivedAt: string | null;
  mountImage: string | null;
  profile: GuildProfile;
};

const allowedRanks = [
  "Trial",
  "Raider",
  "Death Wish",
  "Officer",
  "Guild Master",
];
const voterRanks = ["Raider", "Death Wish", "Officer", "Guild Master"];
const officerRanks = ["Officer", "Guild Master"];

/** Officer and Guild Master votes count as two. Raider and Death Wish count as one. */
const heavyRanks = ["Officer", "Guild Master"];
const heavyWeight = 2;

function weightOf(role: string | null | undefined) {
  return heavyRanks.includes(role ?? "") ? heavyWeight : 1;
}

/** Shown until an officer sets a real mount image. */
const fallbackMountArt = "/Flying bird.png";

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

/** Best to worst. Ties resolve upward. */
const rankOrder: PerformanceRank[] = ["S", "A", "B", "C", "F"];

const rankMeaning: Record<PerformanceRank, string> = {
  S: "Carried the raid",
  A: "Above the curve",
  B: "Solid, no issues",
  C: "Baseline",
  F: "Cost us pulls",
};

/**
 * Weighted plurality. Each vote contributes its caster's weight, so one
 * officer (3) outweighs two raiders (1 + 1). Tie goes to the better letter.
 * No votes at all -> C.
 */
function tallyRank(votes: Vote[], weight: (voterId: string) => number) {
  const weights: Record<PerformanceRank, number> = {
    S: 0,
    A: 0,
    B: 0,
    C: 0,
    F: 0,
  };
  for (const v of votes) weights[v.rank] += weight(v.voter_id);

  let winner: PerformanceRank = "C";
  let best = 0;

  for (const r of rankOrder) {
    if (weights[r] > best) {
      best = weights[r];
      winner = r;
    }
  }

  const totalWeight = rankOrder.reduce((sum, r) => sum + weights[r], 0);
  return {
    rank: best === 0 ? ("C" as PerformanceRank) : winner,
    weights,
    totalWeight,
  };
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

async function loadAttendanceFromSheet(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  try {
    const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));

    for (const row of parseCsv(await response.text())) {
      const discordId = String(row[10] || "").trim();
      if (!/^\d{16,20}$/.test(discordId)) continue;

      const attendance = Number(String(row[12] || "0").replace(/,/g, ""));
      result[discordId] = Number.isFinite(attendance) ? attendance : 0;
    }
  } catch {
    // Sheet unreachable: render on Supabase data alone rather than blanking.
  }

  return result;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MountOrderPage() {
  const [rows, setRows] = useState<MountRow[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<{ id: string; rank: string | null } | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("standings");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(
    null,
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canVote = me?.rank ? voterRanks.includes(me.rank) : false;
  const canEdit = me?.rank ? officerRanks.includes(me.rank) : false;
  const canWriteNote = me?.rank === "Guild Master";
  const myWeight = weightOf(me?.rank);

  const say = useCallback((text: string, bad = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, bad });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();

    const [attendanceMap, profilesResult, mountResult, votesResult, meResult] =
      await Promise.all([
        loadAttendanceFromSheet(),
        supabase
          .from("profiles")
          .select("user_id, discord_id, discord_name, avatar_url, guild_role")
          .eq("accepted_application", true),
     supabase
  .from("mount_order")
  .select("user_id, note, received, rank_override"),
        supabase.from("mount_votes").select("voter_id, target_id, rank"),
        auth.user
          ? supabase
              .from("profiles")
              .select("guild_role")
              .eq("user_id", auth.user.id)
              .single()
          : Promise.resolve({ data: null as any }),
      ]);

    if (auth.user)
      setMe({ id: auth.user.id, rank: meResult?.data?.guild_role ?? null });

    if (profilesResult.error) {
      say(profilesResult.error.message, true);
      setLoading(false);
      return;
    }

    // mount_name / received_at / mount_image are optional columns. If the
    // migration hasn't run, the select errors and we fall back to bare rows
    // rather than emptying the page.
    let mountData = mountResult.data;
if (mountResult.error) {
  console.error("Mount order load error:", mountResult.error);

  say(
    `Mount order error: ${mountResult.error.message}`,
    true,
  );

  setLoading(false);
  return;
}

    const mountByUser = new Map(
      (mountData ?? []).map((m: any) => [m.user_id as string, m]),
    );

    const merged: MountRow[] = (profilesResult.data ?? [])
      .filter((p) => allowedRanks.includes(p.guild_role || "Trial"))
      .map((profile) => {
        const mount = mountByUser.get(profile.user_id);
        return {
          user_id: profile.user_id,
          attendance: attendanceMap[String(profile.discord_id || "")] ?? 0,
          note: mount?.note ?? "",
received: mount?.received ?? false,
rankOverride:
  mount?.rank_override &&
  ["S", "A", "B", "C", "F"].includes(mount.rank_override)
    ? (mount.rank_override as PerformanceRank)
    : null,
mountName: "",
          receivedAt: null,
          mountImage: null,
          profile,
        };
      });

    setVotes((votesResult.data as Vote[]) ?? []);
    setRows(merged);
    setLoading(false);
  }, [say]);

  useEffect(() => {
    loadData();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [loadData]);

  const profileById = useMemo(() => {
    const map = new Map<string, GuildProfile>();
    for (const row of rows) map.set(row.user_id, row.profile);
    return map;
  }, [rows]);

  const weightById = useCallback(
    (voterId: string) => weightOf(profileById.get(voterId)?.guild_role),
    [profileById],
  );

  const votesByTarget = useMemo(() => {
    const map = new Map<string, Vote[]>();
    for (const v of votes) {
      const list = map.get(v.target_id);
      if (list) list.push(v);
      else map.set(v.target_id, [v]);
    }
    // Heavy voters first so the list reads in order of influence.
    for (const list of map.values())
      list.sort((a, b) => weightById(b.voter_id) - weightById(a.voter_id));
    return map;
  }, [votes, weightById]);

const scored = useMemo(
  () =>
    rows.map((row) => {
      const cast = votesByTarget.get(row.user_id) ?? [];

      const {
        rank: votedRank,
        weights,
        totalWeight,
      } = tallyRank(cast, weightById);

      const rank = row.rankOverride ?? votedRank;
      const performance = performancePoints[rank];

      return {
        ...row,
        cast,
        votedRank,
        rank,
        weights,
        totalWeight,
        performance,
        total: row.attendance + performance,
      };
    }),
  [rows, votesByTarget, weightById],
);

  type Scored = (typeof scored)[number];

  const active = useMemo(
    () => scored.filter((r) => !r.received).sort((a, b) => b.total - a.total),
    [scored],
  );

  const received = useMemo(
    () =>
      scored
        .filter((r) => r.received)
        .sort((a, b) => (b.receivedAt ?? "").localeCompare(a.receivedAt ?? "")),
    [scored],
  );

  const matches = useCallback(
    (row: Scored) =>
      (row.profile.discord_name ?? "")
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    [query],
  );

  const filtered = useMemo(() => active.filter(matches), [active, matches]);
  const notedRows = useMemo(() => scored.filter(matches), [scored, matches]);
  const receivedRows = useMemo(
    () => received.filter(matches),
    [received, matches],
  );

  const myVoteFor = useCallback(
    (targetId: string) =>
      me
        ? votes.find((v) => v.voter_id === me.id && v.target_id === targetId)
            ?.rank
        : undefined,
    [votes, me],
  );

  async function castVote(targetId: string, rank: PerformanceRank) {
    if (!me) return;

    const previous = votes;
    const next = votes.filter(
      (v) => !(v.voter_id === me.id && v.target_id === targetId),
    );
    next.push({ voter_id: me.id, target_id: targetId, rank });
    setVotes(next);

    const { error } = await supabase
      .from("mount_votes")
      .upsert(
        { voter_id: me.id, target_id: targetId, rank },
        { onConflict: "voter_id,target_id" },
      );

    if (error) {
      setVotes(previous);
      say(error.message, true);
      return;
    }

    say(
      `Voted ${rank} for ${profileById.get(targetId)?.discord_name ?? "player"}`,
    );
  }

  async function clearVote(targetId: string) {
    if (!me) return;

    const previous = votes;
    setVotes(
      votes.filter((v) => !(v.voter_id === me.id && v.target_id === targetId)),
    );

    const { error } = await supabase
      .from("mount_votes")
      .delete()
      .eq("voter_id", me.id)
      .eq("target_id", targetId);

    if (error) {
      setVotes(previous);
      say(error.message, true);
    }
  }

  async function persist(row: Scored, patch: Partial<MountRow>) {
    setBusyId(row.user_id);

    const next = { ...row, ...patch };

const finalRank = next.rankOverride ?? row.votedRank;
const finalPerformance = performancePoints[finalRank];

const payload: Record<string, unknown> = {
  user_id: row.user_id,
  attendance: row.attendance,
  performance: finalPerformance,
  note: next.note,
  received: next.received,
  rank_override: next.rankOverride,
};

    let { error } = await supabase
      .from("mount_order")
      .upsert(payload, { onConflict: "user_id" });

    // Retry without the optional columns if the migration hasn't run.
    if (error) {
      const bare = await supabase.from("mount_order").upsert(
        {
          user_id: row.user_id,
          attendance: row.attendance,
          performance: row.performance,
          note: next.note,
          received: next.received,
        },
        { onConflict: "user_id" },
      );
      error = bare.error;
    }

    setBusyId(null);

    if (error) {
      say(error.message, true);
      return false;
    }

    setRows((prev) =>
      prev.map((r) => (r.user_id === row.user_id ? { ...r, ...patch } : r)),
    );
    return true;
  }

  async function setReceived(row: Scored, value: boolean) {
    // Move the player immediately in the UI, then save to Supabase.
    const previous = rows;
    setRows((current) =>
      current.map((item) =>
        item.user_id === row.user_id ? { ...item, received: value } : item,
      ),
    );

    const saved = await persist(row, { received: value });
    if (!saved) {
      setRows(previous);
      return;
    }

    say(
      value
        ? `${row.profile.discord_name ?? "Player"} moved to Received`
        : `${row.profile.discord_name ?? "Player"} returned to the order`,
    );
  }

  async function saveNote(row: Scored, note: string) {
    if (await persist(row, { note })) say("Note saved");
  }

  if (loading) {
    return (
      <main className="moPage">
        <div className="moBackdrop" aria-hidden="true" />
        <div className="moBoot">
          <div className="moBootBird" aria-hidden="true">
            <img src={fallbackMountArt} alt="" />
          </div>
          <p>Reading the roster</p>
        </div>
        <style jsx>{css}</style>
      </main>
    );
  }
async function saveRankOverride(
  row: Scored,
  rankOverride: PerformanceRank | null,
) {
  const saved = await persist(row, { rankOverride });

  if (!saved) return;

  say(
    rankOverride
      ? `${row.profile.discord_name ?? "Player"} forced to rank ${rankOverride}`
      : `${row.profile.discord_name ?? "Player"} returned to community voting`,
  );
}
  return (
    <main className="moPage">
      <div className="moBackdrop" aria-hidden="true" />

      {/* ================= hero ================= */}
      <header className="moHero">
        <p className="moKicker">
          <span className="moRule" aria-hidden="true" />
          Death Wish
          <span className="moStar" aria-hidden="true" />
          Loot Council
          <span className="moRule" aria-hidden="true" />
        </p>

        <h1>
          <span className="moFlourish" aria-hidden="true" />
          Mount Order
          <span className="moFlourish" aria-hidden="true" />
        </h1>

        <p className="moBlurb">
          Attendance comes from the raid sheet. The guild votes on performance
          and officers write down why. Both add up to the total that decides the
          queue.
        </p>

        <div className="moLegend">
          {rankOrder.map((r) => (
            <span className="moLegendChip" key={r} title={rankMeaning[r]}>
              <span className={`moChip r${r}`}>{r}</span>
              <b className={`v${r}`}>
                {performancePoints[r] > 0
                  ? "+"
                  : performancePoints[r] === 0
                    ? "±"
                    : ""}
                {performancePoints[r] === 0
                  ? "0"
                  : performancePoints[r].toLocaleString()}
              </b>
            </span>
          ))}
        </div>
      </header>

      <div className="moShell">
        {/* ================= main panel ================= */}
        <section className="moFrame moMain">
          <span className="moCorner tl" aria-hidden="true" />
          <span className="moCorner tr" aria-hidden="true" />
          <span className="moCorner bl" aria-hidden="true" />
          <span className="moCorner br" aria-hidden="true" />

          <nav className="moTabs">
            {(
              [
                ["standings", "Standings", active.length],
                ["notes", "Notes", rows.filter((r) => r.note.trim()).length],
                ["received", "Received", received.length],
              ] as [Tab, string, number][]
            ).map(([key, label, count]) => (
              <button
                key={key}
                className={`moTab ${tab === key ? "on" : ""}`}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                <span className="moTabMark" aria-hidden="true" />
                {label}
                <em>{count}</em>
              </button>
            ))}

            <input
              className="moSearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a player..."
              aria-label="Find a player"
            />
          </nav>

          {/* ---------- standings ---------- */}
          {tab === "standings" && (
            <div className="moTable">
              <div className="moTableHead">
                <span>Rank</span>
                <span>Player</span>
                <span>Attendance</span>
                <span>Performance / Guild Master Note</span>
                <span>Total</span>
                <span className="moRight">Actions</span>
              </div>

              {filtered.length === 0 && (
                <p className="moEmpty">No raider by that name.</p>
              )}

              {filtered.map((row) => {
                const place = active.indexOf(row) + 1;
                const open = openId === row.user_id;
                const mine = myVoteFor(row.user_id);
                const isMe = me?.id === row.user_id;

                return (
                  <div
                    className={`moGroup ${open ? "open" : ""}`}
                    key={row.user_id}
                  >
                    <div
                      className={`moRow ${isMe ? "self" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? null : row.user_id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenId(open ? null : row.user_id);
                        }
                      }}
                    >
                      <div className={`moPlace p${place <= 3 ? place : 0}`}>
                        #{place}
                      </div>

                      <div className="moPlayer">
                        <img
                          src={row.profile.avatar_url ?? "/default-avatar.png"}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="moWho">
                          <strong>
                            {row.profile.discord_name ?? "Unknown"}
                            {isMe && <i className="moYou">you</i>}
                            {row.note.trim() && (
                              <i className="moNoteDot" title="Has a note" />
                            )}
                          </strong>
                          <small>{row.profile.guild_role ?? "Trial"}</small>
                        </div>
                      </div>

                      <div className="moAtt">
                        {row.attendance.toLocaleString()}
                      </div>

                      <div className="moPerfCell">
                        <div className="moPerfTop">
                          <span className={`moPerf r${row.rank}`}>
                            <b>{row.rank}</b>
                            <i>{rankMeaning[row.rank]}</i>
                          </span>

                          {row.note.trim() && (
                            <span className="moInlineNote" title={row.note}>
                              <strong>Guild Master note</strong>
                              <em>{row.note}</em>
                            </span>
                          )}
                        </div>

<small className={row.rankOverride ? "moOverrideLabel" : ""}>
  {row.rankOverride
    ? `Guild Master override · Community voted ${row.votedRank}`
    : row.cast.length === 0
      ? "No votes"
      : `${row.cast.length} ${
          row.cast.length === 1 ? "vote" : "votes"
        } · ${row.totalWeight} pts`}
</small>
                      </div>

                      <div className="moTot">{row.total.toLocaleString()}</div>

                      <div className="moActions">
                        <button
                          className={`moBtn ${mine ? "voted" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(open ? null : row.user_id);
                          }}
                        >
                          {mine ? `Voted ${mine}` : canVote ? "Vote" : "Votes"}
                        </button>

                        {canEdit && (
                          <button
                            className="moBtn green"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReceived(row, true);
                            }}
                            disabled={busyId === row.user_id}
                          >
                            Mount Received
                          </button>
                        )}

                        <span
                          className={`moCaret ${open ? "up" : ""}`}
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    {open && (
                      <div className="moPanel">
                        {/* ----- who voted ----- */}
                        <div className="moCol">
                          <h4>
                            Who voted
                            <span className="moWeightNote">
                              Officer and Guild Master count ×{heavyWeight}
                            </span>
                          </h4>

                          {row.cast.length === 0 && (
                            <p className="moQuiet">Nobody has voted yet.</p>
                          )}

                          <ul className="moVoteList">
                            {row.cast.map((v) => {
                              const voter = profileById.get(v.voter_id);
                              const w = weightOf(voter?.guild_role);
                              return (
                                <li key={v.voter_id}>
                                  <img
                                    src={
                                      voter?.avatar_url ?? "/default-avatar.png"
                                    }
                                    alt=""
                                    loading="lazy"
                                  />
                                  <span className="moVoteWho">
                                    <b>{voter?.discord_name ?? "Unknown"}</b>
                                    <i>{voter?.guild_role ?? "Trial"}</i>
                                  </span>
                                  {w > 1 && (
                                    <span className="moWeight">×{w}</span>
                                  )}
                                  <span className={`moChip mini r${v.rank}`}>
                                    {v.rank}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>

                          {row.totalWeight > 0 && (
                            <div className="moSpread">
                              {rankOrder.map((r) => (
                                <span className="moSpreadRow" key={r}>
                                  <span className={`moChip mini r${r}`}>
                                    {r}
                                  </span>
                                  <span className="moTrack">
                                    <span
                                      className={`moFill r${r}`}
                                      style={{
                                        transform: `scaleX(${row.weights[r] / row.totalWeight})`,
                                      }}
                                    />
                                  </span>
                                  <b>{row.weights[r]}</b>
                                </span>
                              ))}
                              <p className="moQuiet tiny">
                                {row.totalWeight} weighted points · verdict{" "}
                                {row.rank} · {rankMeaning[row.rank]}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* ----- your verdict ----- */}
                        <div className="moCol">
                          <h4>
                            Your verdict
                            {canVote && myWeight > 1 && (
                              <span className="moWeightNote">
                                Your vote counts ×{myWeight}
                              </span>
                            )}
                          </h4>

                          {canVote ? (
                            <>
                              <div className="moVoteBtns">
                                {rankOrder.map((r) => (
                                  <button
                                    key={r}
                                    className={`moVoteBtn r${r} ${mine === r ? "picked" : ""}`}
                                    onClick={() => castVote(row.user_id, r)}
                                    title={rankMeaning[r]}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>

                              <p className="moQuiet">
                                {mine
                                  ? `You voted ${mine} — ${rankMeaning[mine]}.`
                                  : "Pick a letter. The guild sees who voted what."}
                              </p>

                              {mine && (
                                <button
                                  className="moGhost sm mt"
                                  onClick={() => clearVote(row.user_id)}
                                >
                                  Remove my vote
                                </button>
                              )}
                            </>
                          ) : (
                            <p className="moQuiet">
                              Voting opens at Raider rank. You can still read
                              every vote here.
                            </p>
                          )}
{canWriteNote && (
  <>
    <h4 className="gap">Guild Master override</h4>

    <div className="moOverride">
      <button
        className={!row.rankOverride ? "selected auto" : "auto"}
        onClick={() => saveRankOverride(row, null)}
        disabled={busyId === row.user_id}
      >
        Auto
      </button>

      {rankOrder.map((rank) => (
        <button
          key={rank}
          className={`r${rank} ${
            row.rankOverride === rank ? "selected" : ""
          }`}
          onClick={() => saveRankOverride(row, rank)}
          disabled={busyId === row.user_id}
        >
          {rank}
        </button>
      ))}
    </div>

    <p className="moQuiet">
      {row.rankOverride
        ? `Guild Master forced this player to ${row.rankOverride}. Community vote was ${row.votedRank}.`
        : `Using community vote: ${row.votedRank}.`}
    </p>
  </>
)}
                          <h4 className="gap">Guild Master note</h4>
                          <NoteEditor
                            value={row.note}
                            readOnly={!canWriteNote}
                            saving={busyId === row.user_id}
                            onSave={(text) => saveNote(row, text)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ---------- notes ---------- */}
          {tab === "notes" && (
            <div className="moGrid">
              {notedRows.length === 0 && (
                <p className="moEmpty">Nobody to show here yet.</p>
              )}

              {notedRows.map((row) => (
                <article className="moCard" key={row.user_id}>
                  <div className="moPlayer">
                    <img
                      src={row.profile.avatar_url ?? "/default-avatar.png"}
                      alt=""
                      loading="lazy"
                    />
                    <div className="moWho">
                      <strong>{row.profile.discord_name ?? "Unknown"}</strong>
                      <small>
                        {row.profile.guild_role ?? "Trial"}
                        {row.received ? " · has the mount" : ""}
                      </small>
                    </div>
                    <span className={`moPerf small r${row.rank}`}>
                      {row.rank}
                    </span>
                  </div>

                  <NoteEditor
                    key={`${row.user_id}-${row.note}`}
                    value={row.note}
                    readOnly={!canWriteNote}
                    saving={busyId === row.user_id}
                    onSave={(text) => saveNote(row, text)}
                  />
                </article>
              ))}
            </div>
          )}

          {/* ---------- received ---------- */}
          {tab === "received" && (
            <div className="moGrid">
              {receivedRows.length === 0 && (
                <p className="moEmpty">
                  Nobody has the mount yet. The queue decides who's first.
                </p>
              )}

              {receivedRows.map((row) => (
                <article className="moCard" key={row.user_id}>
                  <div className="moPlayer">
                    <img
                      src={row.profile.avatar_url ?? "/default-avatar.png"}
                      alt=""
                      loading="lazy"
                    />
                    <div className="moWho">
                      <strong>{row.profile.discord_name ?? "Unknown"}</strong>
                      <small>{row.profile.guild_role ?? "Trial"}</small>
                    </div>
                    <span className="moReceivedMark">Mount received</span>
                  </div>

                  {canEdit && (
                    <div className="moCardBar">
                      <button
                        className="moGhost sm"
                        onClick={() => setReceived(row, false)}
                        disabled={busyId === row.user_id}
                      >
                        Put back
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ================= received rail ================= */}
        <aside className="moFrame moRail">
          <span className="moCorner tl" aria-hidden="true" />
          <span className="moCorner tr" aria-hidden="true" />
          <span className="moCorner bl" aria-hidden="true" />
          <span className="moCorner br" aria-hidden="true" />

          <h3>
            <span className="moGift" aria-hidden="true" />
            Received
            <em>{received.length}</em>
          </h3>

          {received.length === 0 && (
            <p className="moQuiet center pad">
              Nobody yet. Top of the order is next.
            </p>
          )}

          <ul className="moRailList">
            {received.slice(0, 5).map((row) => (
              <li key={row.user_id}>
                <img
                  src={row.profile.avatar_url ?? "/default-avatar.png"}
                  alt=""
                  loading="lazy"
                />
                <span className="moWho">
                  <strong>{row.profile.discord_name ?? "Unknown"}</strong>
                  <small>{row.profile.guild_role ?? "Trial"}</small>
                </span>
                <span className="moRailReceived">Received</span>
              </li>
            ))}
          </ul>

          {received.length > 0 && (
            <button className="moRailAll" onClick={() => setTab("received")}>
              View all received mounts <span aria-hidden="true">→</span>
            </button>
          )}
        </aside>
      </div>

      <footer className="moFooter">
        <span className="moFootRule" aria-hidden="true" />
        <span className="moCrest" aria-hidden="true" />
        <p>Raid together. Earn together. Loot together.</p>
        <span className="moFootRule flip" aria-hidden="true" />
      </footer>

      {toast && (
        <div className={`moToast ${toast.bad ? "bad" : ""}`}>{toast.text}</div>
      )}

      <style jsx>{css}</style>
    </main>
  );
}

function NoteEditor({
  value,
  readOnly,
  saving,
  onSave,
}: {
  value: string;
  readOnly: boolean;
  saving: boolean;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(value);

  if (readOnly) {
    return (
      <p className="moNoteRead">
        {value.trim() ||
          "No note yet. An officer will explain the letter here."}
        <style jsx>{`
          .moNoteRead {
            margin: 0;
            font-size: 11.5px;
            line-height: 1.6;
            color: #c4b5e8;
            border-left: 2px solid rgba(245, 215, 110, 0.5);
            padding-left: 9px;
          }
        `}</style>
      </p>
    );
  }

  return (
    <div className="moNoteEdit">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Why this letter? e.g. soaked every orb, never died to fire."
        rows={2}
        maxLength={500}
      />
      <button onClick={() => onSave(text)} disabled={text === value || saving}>
        {saving ? "Saving" : "Save note"}
      </button>
      <style jsx>{`
        .moNoteEdit {
          display: grid;
          gap: 7px;
          justify-items: start;
        }
        textarea {
          width: 100%;
          resize: vertical;
          padding: 9px 11px;
          border-radius: 10px;
          border: 1px solid rgba(168, 85, 247, 0.3);
          background: rgba(0, 0, 0, 0.4);
          color: #e8dcff;
          font: inherit;
          font-size: 11.5px;
          line-height: 1.5;
          outline: none;
        }
        textarea::placeholder {
          color: #6b5a94;
        }
        textarea:focus {
          border-color: rgba(245, 215, 110, 0.7);
        }
        button {
          border: 1px solid rgba(245, 215, 110, 0.45);
          border-radius: 9px;
          padding: 7px 13px;
          cursor: pointer;
          color: #f5d76e;
          font-weight: 800;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          background: rgba(245, 215, 110, 0.08);
        }
        button:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

const css = `
  /* ===================================================================
     Every class is mo-prefixed: globals.css defines .table, .row, .card
     and friends, and a global rule of equal specificity beats a
     styled-jsx one. Namespacing is the only reliable guard.
     =================================================================== */
  .moPage {
    --mo-violet: #a855f7;
    --mo-gold: #f5d76e;
    --mo-gold-dim: rgba(245, 215, 110, 0.24);
    --mo-text: #e8dcff;
    --mo-muted: #8b7bb8;
    --mo-faint: #6b5a94;
    --mo-display: "Cinzel", "Trajan Pro", Georgia, serif;

    position: relative;
    min-height: 100vh;
    color: var(--mo-text);
    padding: 34px 16px 20px;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }

  .moBackdrop {
    position: fixed;
    inset: 0;
    z-index: -1;
    background:
      radial-gradient(900px 480px at 50% 0%, rgba(109, 40, 217, 0.45), transparent 66%),
      linear-gradient(180deg, rgba(10, 2, 18, 0.82), rgba(4, 0, 9, 0.97)),
      url("/Roster.png") center / cover no-repeat fixed;
  }

  /* ===================== hero ===================== */
  .moHero {
    width: min(1660px, 98vw);
    margin: 0 auto 18px;
    text-align: center;
  }

  .moKicker {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 0;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.4em;
    text-transform: uppercase;
    color: #c9b6ff;
  }

  .moRule {
    width: 54px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.8));
  }

  .moKicker .moRule:last-child {
    background: linear-gradient(90deg, rgba(168, 85, 247, 0.8), transparent);
  }

  .moStar {
    width: 7px;
    height: 7px;
    transform: rotate(45deg);
    background: var(--mo-violet);
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.9);
  }

  h1 {
    display: inline-flex;
    align-items: center;
    gap: 18px;
    margin: 4px 0 0;
    font-family: var(--mo-display);
    font-size: clamp(38px, 6vw, 68px);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    background: linear-gradient(180deg, #ffffff 20%, #cbb6f2 60%, #8b6fd0);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0 30px rgba(168, 85, 247, 0.55));
  }

  .moFlourish {
    width: 16px;
    height: 16px;
    flex: none;
    transform: rotate(45deg);
    background: var(--mo-violet);
    box-shadow: 0 0 20px rgba(168, 85, 247, 1);
  }

  .moBlurb {
    max-width: 56ch;
    margin: 10px auto 0;
    font-size: 12px;
    line-height: 1.7;
    color: #a396c9;
  }

  .moLegend {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
  }

  .moLegendChip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 12px 5px 5px;
    border-radius: 999px;
    border: 1px solid rgba(168, 85, 247, 0.35);
    background: rgba(10, 2, 18, 0.8);
  }

  .moLegendChip b {
    font-size: 11px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .vS { color: #facc15; }
  .vA { color: #38bdf8; }
  .vB { color: #4ade80; }
  .vC { color: #9ca3af; }
  .vF { color: #ef4444; }

  /* ===================== layout ===================== */
  .moShell {
    width: min(1660px, 98vw);
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 12px;
    align-items: start;
  }

  .moFrame {
    position: relative;
    width: 100%;
    min-width: 0;
    border: 1px solid var(--mo-gold-dim);
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(21, 8, 41, 0.94), rgba(7, 1, 14, 0.96));
    padding: 12px;
  }



.tl { ... }
.tr { ... }
.bl { ... }
.br { ... }

  /* ===================== tabs ===================== */
  .moTabs {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 2px 12px;
    border-bottom: 1px solid rgba(245, 215, 110, 0.14);
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .moTab {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 9px;
    color: var(--mo-muted);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 8px 12px;
    cursor: pointer;
    transition: color 0.15s linear, border-color 0.15s linear;
  }

  .moTabMark {
    width: 6px;
    height: 6px;
    transform: rotate(45deg);
    background: currentColor;
    opacity: 0.7;
  }

  .moTab em {
    font-style: normal;
    font-size: 9px;
    padding: 2px 6px;
    border-radius: 999px;
    background: rgba(168, 85, 247, 0.28);
    color: #d9c9ff;
  }

  .moTab:hover { color: var(--mo-gold); }
  .moTab:focus-visible { outline: 1px solid var(--mo-gold); outline-offset: 2px; }

  .moTab.on {
    color: var(--mo-gold);
    border-color: rgba(245, 215, 110, 0.6);
    background: rgba(245, 215, 110, 0.08);
  }

  .moTab.on em { background: rgba(245, 215, 110, 0.22); color: var(--mo-gold); }

  .moSearch {
    margin-left: auto;
    width: 190px;
    height: 32px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid rgba(168, 85, 247, 0.35);
    background: rgba(0, 0, 0, 0.45);
    color: var(--mo-text);
    font-size: 11px;
    outline: none;
  }

  .moSearch::placeholder { color: var(--mo-faint); }
  .moSearch:focus { border-color: var(--mo-gold); }

  /* ===================== table ===================== */
  .moTable {
    border: 1px solid rgba(168, 85, 247, 0.5);
    border-radius: 14px;
    overflow: hidden;
    background: rgba(5, 0, 12, 0.6);
  }

  .moTableHead,
  .moRow {
    display: grid;
    grid-template-columns: 64px minmax(190px, 1.25fr) 150px minmax(360px, 1.9fr) 145px minmax(250px, auto);
    align-items: center;
    gap: 10px;
    padding: 9px 18px;
  }

  .moTableHead {
    background: rgba(168, 85, 247, 0.25);
    color: var(--mo-gold);
    font-weight: 900;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 1px;
  }

  .moRight { text-align: right; }

  .moGroup { border-top: 1px solid rgba(255, 255, 255, 0.08); }
  .moGroup.open { background: rgba(168, 85, 247, 0.07); }

  .moRow {
    min-height: 82px;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .moRow:hover { background: rgba(168, 85, 247, 0.12); }
  .moRow:focus-visible { outline: 1px solid var(--mo-gold); outline-offset: -2px; }
  .moRow.self { box-shadow: inset 3px 0 0 var(--mo-gold); }

  .moPlace {
    font-size: 21px;
    font-weight: 900;
    color: var(--mo-muted);
    font-variant-numeric: tabular-nums;
  }

  .p1 { color: var(--mo-gold); text-shadow: 0 0 16px rgba(245, 215, 110, 0.5); }
  .p2 { color: #e2e8f0; }
  .p3 { color: #e0a06a; }

  .moPlayer {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .moPlayer img {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--mo-violet);
    flex: none;
  }

  .moWho { min-width: 0; flex: 1; }

  .moWho strong {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    line-height: 1.2;
    color: #fff;
  }

  .moWho small {
    display: block;
    color: #c9b6ff;
    font-size: 10px;
  }

  .moYou {
    font-style: normal;
    font-size: 8px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--mo-violet);
    border: 1px solid rgba(168, 85, 247, 0.5);
    border-radius: 999px;
    padding: 1px 5px;
    flex: none;
  }

  .moNoteDot {
    width: 6px;
    height: 6px;
    background: var(--mo-gold);
    transform: rotate(45deg);
    flex: none;
  }

  .moAtt, .moTot {
    font-size: 21px;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .moAtt { color: #38bdf8; }
  .moTot { color: #22c55e; }

  /* ---------- performance ---------- */
  .moPerfCell { display: grid; gap: 5px; justify-items: stretch; min-width: 0; }

  .moPlayer { min-width: 190px; }

  .moActions { min-width: 245px; }

  .moPerfTop {
    display: grid;
    grid-template-columns: 148px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .moPerfCell > small {
    font-size: 9px;
    letter-spacing: 0.04em;
    color: var(--mo-faint);
  }

  .moPerf {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 148px;
    min-width: 148px;
    height: 44px;
    padding: 0 14px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 12px;
    color: #ffffff;
    overflow: hidden;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
  }

  .moPerf b {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 17px;
    line-height: 1;
    font-weight: 900;
    text-align: center;
    color: #ffffff;
  }

  .moPerf i {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 12px;
    font-style: normal;
    font-weight: 800;
    line-height: 1;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .moInlineNote {
    display: grid;
    gap: 3px;
    min-width: 0;
    flex: 1;
    min-height: 44px;
    padding: 7px 11px;
    border: 1px solid rgba(245, 215, 110, 0.24);
    border-left: 3px solid #f5d76e;
    border-radius: 8px;
    background: rgba(245, 215, 110, 0.055);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }

  .moInlineNote strong {
    color: #f5d76e;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .moInlineNote em {
    color: #f4efff;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 12px;
    font-weight: 600;
    font-style: normal;
    line-height: 1.25;
    white-space: normal;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .moPerf.small {
    display: inline-flex;
    width: 44px;
    min-width: 44px;
    height: 28px;
    padding: 0;
    font-size: 14px;
    margin-left: auto;
    justify-content: center;
  }

  .moPerf.rS {
    background: linear-gradient(135deg, #facc15, #a16207);
    box-shadow: 0 0 16px rgba(250, 204, 21, 0.55);
  }
  .moPerf.rA {
    background: linear-gradient(135deg, #38bdf8, #0284c7);
    box-shadow: 0 0 16px rgba(56, 189, 248, 0.45);
  }
  .moPerf.rB {
    background: linear-gradient(135deg, #22c55e, #15803d);
    box-shadow: 0 0 16px rgba(34, 197, 94, 0.45);
  }
  .moPerf.rC {
    background: linear-gradient(135deg, #9ca3af, #4b5563);
    box-shadow: 0 0 16px rgba(156, 163, 175, 0.25);
  }
  .moPerf.rF {
    background: linear-gradient(135deg, #ef4444, #7f1d1d);
    box-shadow: 0 0 16px rgba(239, 68, 68, 0.45);
    color: #1c0606;
  }

  /* ---------- actions ---------- */
  .moActions {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-end;
  }

  .moBtn {
    border: none;
    border-radius: 9px;
    padding: 9px 13px;
    cursor: pointer;
    color: #fff;
    font-weight: 900;
    font-size: 12px;
    white-space: nowrap;
    background: linear-gradient(135deg, #7e22ce, #a855f7);
    box-shadow: 0 0 12px rgba(168, 85, 247, 0.35);
    transition: transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease;
  }

  .moBtn:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.05);
    filter: brightness(1.15);
    box-shadow: 0 0 16px rgba(168, 85, 247, 0.95), 0 0 32px rgba(168, 85, 247, 0.55);
  }

  .moBtn:disabled { opacity: 0.55; cursor: not-allowed; }

  .moBtn.voted {
    background: linear-gradient(135deg, #d4a94a, #f7e39c);
    color: #150708;
    box-shadow: 0 0 12px rgba(245, 215, 110, 0.4);
  }

  .moBtn.voted:hover:not(:disabled) {
    box-shadow: 0 0 16px rgba(245, 215, 110, 0.9), 0 0 32px rgba(245, 215, 110, 0.5);
  }

  .moBtn.green {
    background: linear-gradient(135deg, #15803d, #22c55e);
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.35);
  }

  .moBtn.green:hover:not(:disabled) {
    box-shadow: 0 0 16px rgba(34, 197, 94, 0.95), 0 0 32px rgba(34, 197, 94, 0.55);
  }

  .moCaret {
    width: 6px;
    height: 6px;
    flex: none;
    border-right: 1.5px solid var(--mo-faint);
    border-bottom: 1.5px solid var(--mo-faint);
    transform: rotate(45deg);
    transition: transform 0.18s ease;
  }

  .moCaret.up { transform: rotate(-135deg); }

  /* ===================== chips ===================== */
  .moChip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 22px;
    border-radius: 999px;
    font-family: var(--mo-display);
    font-size: 11px;
    font-weight: 700;
    color: #0d0a02;
    flex: none;
  }

  .moChip.mini { width: 19px; height: 17px; font-size: 9px; border-radius: 5px; }

  /* Scoped on purpose. A bare .rS also matched the verdict pill and painted
     the whole thing solid. */
  .moChip.rS, .moFill.rS, .moVoteBtn.rS { background: linear-gradient(135deg, #facc15, #a16207); }
  .moChip.rA, .moFill.rA, .moVoteBtn.rA { background: linear-gradient(135deg, #38bdf8, #0284c7); }
  .moChip.rB, .moFill.rB, .moVoteBtn.rB { background: linear-gradient(135deg, #22c55e, #15803d); }
  .moChip.rC, .moFill.rC, .moVoteBtn.rC { background: linear-gradient(135deg, #9ca3af, #4b5563); }
  .moChip.rF, .moFill.rF, .moVoteBtn.rF { background: linear-gradient(135deg, #ef4444, #7f1d1d); }

  /* ===================== expand panel ===================== */
  .moPanel {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    padding: 16px 18px 20px 82px;
    background: rgba(0, 0, 0, 0.4);
    border-top: 1px solid rgba(245, 215, 110, 0.14);
    animation: moUnfold 0.2s ease-out;
  }

  .moCol { min-width: 0; }

  h4 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    margin: 0 0 9px;
    font-size: 8.5px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: var(--mo-violet);
  }

  h4.gap { margin-top: 16px; }

  .moWeightNote {
    letter-spacing: 0.06em;
    text-transform: none;
    font-size: 9px;
    color: var(--mo-gold);
  }

  .moQuiet { margin: 0; font-size: 11px; color: var(--mo-muted); line-height: 1.55; }
  .moQuiet.tiny { font-size: 9px; margin-top: 6px; }
  .center { text-align: center; }
  .pad { padding: 18px 0; }

  .moVoteList { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 5px; }

  .moVoteList li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 7px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
  }

  .moVoteList img { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; flex: none; }

  .moVoteWho { display: flex; flex: 1; flex-direction: column; min-width: 0; line-height: 1.2; }
  .moVoteWho b {
    font-size: 11px;
    color: #d5c6f5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .moVoteWho i {
    font-style: normal;
    font-size: 8px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--mo-faint);
  }

  .moWeight {
    flex: none;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid rgba(245, 215, 110, 0.6);
    background: rgba(245, 215, 110, 0.1);
    font-size: 9px;
    font-weight: 800;
    color: var(--mo-gold);
  }

  .moSpread { display: grid; gap: 4px; }

  .moSpreadRow {
    display: grid;
    grid-template-columns: 19px 1fr 18px;
    align-items: center;
    gap: 8px;
  }

  .moTrack {
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    overflow: hidden;
  }

  .moFill {
    display: block;
    height: 100%;
    width: 100%;
    transform-origin: left;
    transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .moSpreadRow b { font-size: 10px; color: var(--mo-muted); text-align: right; }

  .moVoteBtns { display: flex; gap: 6px; margin-bottom: 8px; }

  .moVoteBtn {
    width: 44px;
    height: 36px;
    border: none;
    border-radius: 10px;
    font-family: var(--mo-display);
    font-size: 14px;
    font-weight: 900;
    color: #0d0a02;
    cursor: pointer;
    opacity: 0.4;
    filter: saturate(0.35);
    transition: opacity 0.15s linear, transform 0.15s ease, filter 0.15s linear;
  }

  .moVoteBtn:hover { opacity: 0.92; filter: none; transform: translateY(-2px); }
  .moVoteBtn.picked { opacity: 1; filter: none; box-shadow: 0 0 0 2px var(--mo-gold); }

  /* ===================== grid tabs ===================== */
  .moGrid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 10px;
  }

  .moCard {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.35);
  }

  .moCard .moPlayer img { width: 34px; height: 34px; }

  .moCardBar { display: flex; align-items: center; gap: 6px; }

  /* ===================== received ===================== */
  .moGot { display: grid; gap: 2px; line-height: 1.25; }
  .moGot.rail { width: 100px; flex: none; text-align: right; }

  .moGotLabel {
    font-size: 7.5px;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--mo-faint);
  }

  .moGot b { font-size: 11.5px; font-weight: 700; color: var(--mo-text); }
  .moGot i { font-style: normal; font-size: 9px; color: var(--mo-muted); }

  /* ===================== rail ===================== */
  .moRail {
    position: sticky;
    top: 16px;
    display: grid;
    gap: 8px;
    align-content: start;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 4px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(245, 215, 110, 0.14);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #c9b6ff;
  }

  h3 em {
    font-style: normal;
    font-size: 9px;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(168, 85, 247, 0.28);
  }

  .moGift {
    width: 9px;
    height: 9px;
    transform: rotate(45deg);
    background: var(--mo-gold);
    box-shadow: 0 0 10px rgba(245, 215, 110, 0.8);
  }

  .moRailList { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; }

  .moRailList li {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 7px 8px;
    border-radius: 10px;
    border: 1px solid rgba(168, 85, 247, 0.24);
    background: rgba(255, 255, 255, 0.03);
  }

  .moRailList img {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(168, 85, 247, 0.7);
    flex: none;
  }

  .moRailAll {
    width: 100%;
    margin-top: 4px;
    padding: 10px;
    border: 1px solid rgba(168, 85, 247, 0.35);
    border-radius: 10px;
    background: rgba(168, 85, 247, 0.08);
    color: #c9b6ff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    cursor: pointer;
    transition: color 0.15s linear, border-color 0.15s linear;
  }

  .moRailAll:hover { color: var(--mo-gold); border-color: var(--mo-gold); }

  /* ===================== footer ===================== */
  .moFooter {
    width: min(1660px, 98vw);
    margin: 20px auto 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .moFootRule {
    flex: 1;
    max-width: 340px;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(190, 24, 93, 0.7), rgba(245, 215, 110, 0.5));
  }

  .moFootRule.flip {
    background: linear-gradient(90deg, rgba(245, 215, 110, 0.5), rgba(190, 24, 93, 0.7), transparent);
  }

  .moCrest {
    width: 9px;
    height: 9px;
    transform: rotate(45deg);
    background: var(--mo-gold);
    box-shadow: 0 0 12px rgba(245, 215, 110, 0.8);
  }

  .moFooter p {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: #c58bb0;
    white-space: nowrap;
  }

  /* ===================== boot ===================== */
  .moBoot { display: grid; place-items: center; gap: 14px; min-height: 60vh; }
  .moBoot p { color: var(--mo-faint); font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase; }
  .moBootBird { width: 96px; animation: moGlide 3s ease-in-out infinite; }
  .moBootBird img {
    display: block;
    width: 100%;
    transform-origin: 50% 42%;
    animation: moFlap 0.3s ease-in-out infinite alternate;
  }

  @keyframes moGlide {
    0%   { transform: translate3d(-10px, 6px, 0) rotate(-4deg); }
    50%  { transform: translate3d(10px, -10px, 0) rotate(4deg); }
    100% { transform: translate3d(-10px, 6px, 0) rotate(-4deg); }
  }

  @keyframes moFlap {
    from { transform: scale(1, 1) rotate(-2deg); }
    to   { transform: scale(0.9, 1.1) rotate(2deg); }
  }

  /* ===================== buttons ===================== */
  .moGhost {
    background: transparent;
    border: 1px solid rgba(245, 215, 110, 0.45);
    border-radius: 9px;
    color: var(--mo-gold);
    cursor: pointer;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transition: background 0.15s linear;
  }

  .moGhost:hover:not(:disabled) { background: rgba(245, 215, 110, 0.14); }
  .moGhost:disabled { opacity: 0.35; cursor: not-allowed; }

  .sm { padding: 6px 10px; font-size: 9px; flex: none; }
  .mt { margin-top: 8px; }

  .moEmpty { text-align: center; color: var(--mo-faint); font-size: 11px; padding: 26px 0; }

  /* ===================== toast ===================== */
  .moToast {
    position: fixed;
    left: 50%;
    bottom: 22px;
    z-index: 80;
    transform: translateX(-50%);
    padding: 9px 18px;
    border: 1px solid var(--mo-gold);
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #150708;
    background: linear-gradient(180deg, #f7e39c, #d4a94a);
    animation: moToastIn 0.22s ease-out;
  }

  .moToast.bad {
    color: #fff;
    border-color: #ef4444;
    background: linear-gradient(180deg, #ef4444, #7f1d1d);
  }

  @keyframes moUnfold {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: none; }
  }

  @keyframes moToastIn {
    from { opacity: 0; transform: translate(-50%, 10px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }


  /* Continuous table styling like the second reference image. */
  .moTable {
    border: 1px solid rgba(168, 85, 247, 0.55);
    border-radius: 15px;
    overflow: hidden;
    background: rgba(4, 0, 10, 0.94);
    box-shadow: 0 16px 42px rgba(0, 0, 0, 0.34);
  }

  .moTableHead {
    margin: 0;
    border: 0;
    border-radius: 0;
    min-height: 48px;
    background: linear-gradient(180deg, rgba(62, 29, 94, 0.98), rgba(42, 18, 68, 0.98));
    border-bottom: 1px solid rgba(168, 85, 247, 0.42);
  }

  .moGroup {
    margin: 0;
    border: 0;
    border-radius: 0;
    overflow: hidden;
    background: rgba(4, 0, 10, 0.9);
    box-shadow: none;
  }

  .moGroup + .moGroup {
    border-top: 1px solid rgba(255, 255, 255, 0.085);
  }
.moOverride {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 8px;
}

.moOverride button {
  width: 42px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 9px;
  cursor: pointer;
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
  opacity: 0.48;
  filter: saturate(0.45);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.moOverride button:hover:not(:disabled) {
  opacity: 1;
  filter: none;
  transform: translateY(-2px);
}

.moOverride button.selected {
  opacity: 1;
  filter: none;
  border-color: #f5d76e;
  box-shadow:
    0 0 0 2px rgba(245, 215, 110, 0.28),
    0 0 16px rgba(245, 215, 110, 0.35);
}

.moOverride button.auto {
  width: auto;
  padding: 0 13px;
  background: rgba(168, 85, 247, 0.18);
  color: #d8c6ff;
}

.moOverride button.auto.selected {
  color: #f5d76e;
  background: rgba(245, 215, 110, 0.12);
}

.moOverride button.rS {
  background: linear-gradient(135deg, #facc15, #a16207);
}

.moOverride button.rA {
  background: linear-gradient(135deg, #38bdf8, #0284c7);
}

.moOverride button.rB {
  background: linear-gradient(135deg, #22c55e, #15803d);
}

.moOverride button.rC {
  background: linear-gradient(135deg, #9ca3af, #4b5563);
}

.moOverride button.rF {
  background: linear-gradient(135deg, #ef4444, #7f1d1d);
}

.moOverride button:disabled {
  cursor: not-allowed;
  opacity: 0.3;
}

.moOverrideLabel {
  color: #f5d76e !important;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
  .moGroup:hover {
    border-color: transparent;
    box-shadow: none;
    background: rgba(20, 7, 34, 0.96);
  }

  .moRow {
    min-height: 82px;
    padding-top: 10px;
    padding-bottom: 10px;
    background: transparent;
  }

  .moRow:hover {
    background: linear-gradient(90deg, rgba(168, 85, 247, 0.09), rgba(168, 85, 247, 0.025));
  }

  .moRow.self {
    box-shadow: inset 4px 0 0 #f5d76e;
  }

  .moGroup.open .moRow {
    border-bottom: 1px solid rgba(168, 85, 247, 0.24);
  }

  .moReceivedMark, .moRailReceived {
    margin-left: auto;
    border: 1px solid rgba(34, 197, 94, 0.5);
    border-radius: 999px;
    padding: 6px 10px;
    color: #86efac;
    background: rgba(22, 163, 74, 0.12);
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .moRailReceived {
    padding: 4px 8px;
    font-size: 8px;
  }

  /* ==================================================================
     LIST CONTAINER STYLE — matches the user's table reference.
     Only the visual shell is changed; voting/data/content stay untouched.
     ================================================================== */
  .moMain {
    padding: 12px;
    border: 1px solid rgba(168, 85, 247, 0.34);
    border-radius: 18px;
    background: rgba(10, 2, 20, 0.78);
    box-shadow: 0 22px 70px rgba(0, 0, 0, 0.52);
  }

  .moTable {
    border: 1px solid rgba(168, 85, 247, 0.62);
    border-radius: 18px;
    overflow: hidden;
    background: rgba(3, 0, 8, 0.97);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.018) inset,
      0 18px 48px rgba(0, 0, 0, 0.42);
  }

  .moTableHead {
    min-height: 52px;
    margin: 0;
    padding-top: 12px;
    padding-bottom: 12px;
    border: 0;
    border-radius: 0;
    border-bottom: 1px solid rgba(168, 85, 247, 0.34);
    background: linear-gradient(180deg, #3b1b5b 0%, #2b1245 100%);
    color: #f7df61;
    box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.035) inset;
  }

  .moTableHead > span {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .moGroup {
    margin: 0;
    border: 0;
    border-radius: 0;
    overflow: visible;
    background: rgba(3, 0, 8, 0.96);
    box-shadow: none;
  }

  .moGroup + .moGroup {
    border-top: 1px solid rgba(255, 255, 255, 0.075);
  }

  .moGroup:hover {
    border: 0;
    background: rgba(14, 4, 26, 0.98);
    box-shadow: none;
  }

  .moRow {
    min-height: 78px;
    padding-top: 11px;
    padding-bottom: 11px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .moRow:hover {
    background: linear-gradient(90deg, rgba(168, 85, 247, 0.10), rgba(168, 85, 247, 0.025));
  }

  .moRow.self {
    box-shadow: inset 4px 0 0 #f5d76e;
  }

  .moGroup.open .moRow {
    border-bottom: 1px solid rgba(168, 85, 247, 0.24);
  }

  .moGroup:last-child,
  .moGroup:last-child .moRow {
    border-bottom-left-radius: 17px;
    border-bottom-right-radius: 17px;
  }

  .moPanel {
    border-radius: 0;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    background: rgba(13, 4, 24, 0.98);
  }

  .moPlace {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    font-weight: 950;
  }

  .moWho strong,
  .moWho small,
  .moAtt,
  .moTot,
  .moBtn,
  .moPerf,
  .moPerfMeaning,
  .moGmNote strong,
  .moGmNote span {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }

  .moPerf {
    font-style: normal;
    letter-spacing: 0;
  }

  .moGmNote {
    border-radius: 8px;
  }

  /* ===================== responsive ===================== */
  @media (max-width: 1450px) {
    .moShell { grid-template-columns: minmax(0, 1fr); }
    .moRail { position: static; }
    .moTableHead,
    .moRow { grid-template-columns: 52px minmax(170px, 1.2fr) 120px minmax(300px, 1.7fr) 120px minmax(230px, auto); padding: 10px 14px; }
    .moAtt, .moTot, .moPlace { font-size: 17px; }
  }

  @media (max-width: 860px) {
    .moTableHead { display: none; }
    .moRow {
      grid-template-columns: 44px minmax(0, 1fr) auto;
      row-gap: 10px;
      padding: 12px;
    }
    .moRow .moAtt { display: none; }
    .moPerfTop { grid-template-columns: 1fr; align-items: stretch; }
    .moPerf { width: 100%; min-width: 0; }
    .moInlineNote { width: 100%; }
    .moRow .moActions { grid-column: 1 / -1; justify-content: flex-start; flex-wrap: wrap; }
    .moPanel { grid-template-columns: 1fr; padding-left: 16px; }
    .moSearch { margin-left: 0; width: 100%; }
    .moGot.rail { display: none; }
    .moFootRule { display: none; }
    .moFooter p { white-space: normal; text-align: center; }
  }

  @media (prefers-reduced-motion: reduce) {
    .moBootBird, .moBootBird img { animation: none; }
    * { transition-duration: 0.01ms !important; }
  }
`;