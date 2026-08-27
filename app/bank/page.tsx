"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins, CalendarDays, Hourglass, BadgeCheck } from "lucide-react";
import SideNav from "@/app/components/SideNav";
import { supabase } from "@/lib/supabase";

type PotEntry = {
  name: string;
  amount: number;
};

type Mark = "helper" | "strike" | "reward";

type Bonus = {
  type: Mark | "base";
  amount: number;
  label: string;
};

type RosterEntry = {
  name: string;
  discordId?: string;
  isSelf: boolean;
  isPug?: boolean;
  mark?: Mark | null;
  bonus?: Bonus | null;
  hidden: boolean;
  cut: number | null;
};

type ProfileLite = {
  discord_name?: string;
  discord_id?: string;
  avatar_url?: string;
};

type Cut = {
  id: number;
  date: string;
  run: string;
  character: string;
  cut: number;
  baseCut: number;
  bonus: Bonus | null;
  status: "Paid" | "Pending";
  source: string;
  note: string;
  boosters: number;
  clients: number;
  helpers: number;
  strikes: number;
  rewards: number;
  pot: number;
  pots: PotEntry[];
  potTotal: number;
  roster: RosterEntry[];
};

// Week 1 started on 19 Aug and each week runs 7 days from there,
// matching the week system on the runs page.
const WEEK_ANCHOR = new Date(2026, 7, 19); // month is 0-indexed: 7 = August
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function currentWeekRange(now: Date = new Date()) {
  const weekIndex = Math.floor(
    (now.getTime() - WEEK_ANCHOR.getTime()) / WEEK_MS
  );

  const start = new Date(WEEK_ANCHOR.getTime() + weekIndex * WEEK_MS);
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return {
    weekNumber: weekIndex + 1,
    label: `${fmt(start)} – ${fmt(end)}`,
  };
}

export default function BankPage() {
  const [balance, setBalance] = useState(0);
  const [cuts, setCuts] = useState<Cut[]>([]);
const [muted, setMuted] = useState(() => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("bankVideoMuted");

    // first visit = muted
    if (saved === null) return true;

    return saved === "true";
  }

  return true;
});
useEffect(() => {
  localStorage.setItem("bankVideoMuted", muted.toString());
}, [muted]);
 const [activeTab, setActiveTab] = useState("This Week");
const [history, setHistory] = useState<any[]>([]);
const [seasons, setSeasons] = useState<any[]>([]);
const [detailsFor, setDetailsFor] = useState<Cut | null>(null);
const [rank, setRank] = useState("Unknown");
const [canSeeAllCuts, setCanSeeAllCuts] = useState(false);
const [profiles, setProfiles] = useState<ProfileLite[]>([]);
const [notes, setNotes] = useState<Record<string, string>>({});
const [noteFor, setNoteFor] = useState<
  { entry: RosterEntry; runKey: string; runLabel: string } | null
>(null);
const [noteDraft, setNoteDraft] = useState("");
const [savingNote, setSavingNote] = useState(false);

const isLeader = rank === "Dreadlord";

// Notes are per person AND per run, so the key combines both.
function noteKey(runKey: string, discordId?: string) {
  return `${runKey}::${discordId || ""}`;
}

async function loadNotes() {
  try {
    const { data } = await supabase.from("booster_notes").select("*");

    const map: Record<string, string> = {};

    (data || []).forEach((n: any) => {
      if (n.discord_id && n.run_key && n.note) {
        map[noteKey(n.run_key, n.discord_id)] = n.note;
      }
    });

    setNotes(map);
  } catch (err) {
    console.error(err);
  }
}

async function saveNote() {
  if (!noteFor?.entry.discordId) return;

  const { entry, runKey } = noteFor;

  setSavingNote(true);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const meta: any = user?.user_metadata || {};

    const { error } = await supabase.from("booster_notes").upsert(
      {
        discord_id: entry.discordId,
        run_key: runKey,
        note: noteDraft.trim(),
        updated_by: user?.id || null,
        updated_by_name: meta.user_name || meta.full_name || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "discord_id,run_key" }
    );

    if (error) {
      alert(error.message);
      return;
    }

    setNotes((prev) => {
      const next = { ...prev };
      const k = noteKey(runKey, entry.discordId);

      if (noteDraft.trim()) next[k] = noteDraft.trim();
      else delete next[k];

      return next;
    });

    setNoteFor(null);
  } finally {
    setSavingNote(false);
  }
}
const [payoutCharacter, setPayoutCharacter] = useState("Not set");
const [payoutType, setPayoutType] = useState("Not set");
const [showRequest, setShowRequest] = useState(false);
const [reqKind, setReqKind] = useState<"character" | "method" | "both">(
  "character"
);
const [reqCharacter, setReqCharacter] = useState("");
const [reqMethod, setReqMethod] = useState("");
const [reqNote, setReqNote] = useState("");
const [sending, setSending] = useState(false);
const [requestSent, setRequestSent] = useState(false);

async function sendPaymentRequest() {
  const wantsCharacter = reqKind === "character" || reqKind === "both";
  const wantsMethod = reqKind === "method" || reqKind === "both";

  if (wantsCharacter && !reqCharacter.trim()) {
    alert("Enter the new payout character.");
    return;
  }

  if (wantsMethod && !reqMethod.trim()) {
    alert("Enter the new payment method.");
    return;
  }

  setSending(true);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You need to be signed in.");
      return;
    }

    const meta: any = user.user_metadata || {};

    const { error } = await supabase.from("payment_requests").insert({
      user_id: user.id,
      discord_name: meta.user_name || meta.full_name || meta.name || null,
      discord_id: meta.provider_id || null,
      current_character: payoutCharacter,
      current_method: payoutType,
      requested_character: wantsCharacter ? reqCharacter.trim() : null,
      requested_method: wantsMethod ? reqMethod.trim() : null,
      note: reqNote.trim() || null,
      status: "pending",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setRequestSent(true);
    setReqCharacter("");
    setReqMethod("");
    setReqNote("");
  } catch (err: any) {
    alert(err?.message || "Could not send the request.");
  } finally {
    setSending(false);
  }
}

// Matches a roster entry to a Discord profile: by Discord ID when the
// profiles table has one, otherwise by the name before the realm suffix.
function findProfile(entry: RosterEntry): ProfileLite | undefined {
  // Pugs aren't guild members, so there's no profile to match.
  if (entry.isPug) return undefined;

  if (entry.discordId) {
    const byId = profiles.find(
      (p) => p.discord_id && p.discord_id === entry.discordId
    );
    if (byId) return byId;
  }

  const short = (entry.name || "")
    .split("-")[0]
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

  if (!short) return undefined;

  return profiles.find(
    (p) =>
      (p.discord_name || "").replace(/[^a-z0-9]/gi, "").toLowerCase() === short
  );
}

const filteredCuts = useMemo(
  () => (activeTab === "This Week" ? cuts : []),
  [cuts, activeTab]
);

// Only the seasons listed here get a tab. Add a lowercase sheet-tab name
// to show another one; nothing appears automatically.
const SHOWN_SEASONS = ["midnight season 2"];

const seasonTabs = useMemo(
  () =>
    seasons.filter((s) =>
      SHOWN_SEASONS.includes(s.name?.trim().toLowerCase())
    ),
  [seasons]
);

const activeSeason = useMemo(
  () => seasonTabs.find((s) => `${s.name} History` === activeTab),
  [seasonTabs, activeTab]
);

// Season history has no per-run data, so Bonus, Boosters and Pot
// are dropped from those tabs.
const isHistoryTab =
  !!activeSeason || activeTab === "Midnight Season 1 History";

useEffect(() => {
  loadProfiles();
  loadNotes();
}, []);

async function loadProfiles() {
  try {
    const { data } = await supabase.from("profiles").select("*").limit(1000);
    setProfiles(data || []);
  } catch (err) {
    console.error(err);
  }
}

useEffect(() => {
  loadBalance();

  const interval = setInterval(() => {
    loadBalance();
  }, 60000);

  return () => clearInterval(interval);
}, []);

async function loadBalance() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const discordId = user?.user_metadata?.provider_id;

    if (!discordId) {
      console.error("No Discord ID found");
      return;
    }

    const controller = new AbortController();

const timeout = setTimeout(() => {
  controller.abort();
}, 15000);

// Sent so the API can verify the caller's rank server-side.
const {
  data: { session },
} = await supabase.auth.getSession();

const authHeaders = session?.access_token
  ? { Authorization: `Bearer ${session.access_token}` }
  : undefined;

// One request now — the API returns cuts, both seasons and the
// total balance together.
const res = await fetch(`/api/bank?discordId=${discordId}`, {
  signal: controller.signal,
  headers: authHeaders,
});

clearTimeout(timeout);

    const data = await res.json();

    console.log("BANK DATA:", data);

    setRank(data.rank || "Unknown");
    setCanSeeAllCuts(!!data.canSeeAllCuts);
    setBalance(data.balance || 0);
    setPayoutCharacter(data.payoutCharacter || "Not set");
    setPayoutType(data.payoutType || "Not set");
    setCuts(data.cuts || []);
    setHistory(data.history || []);
    setSeasons(data.seasons || []);
  } catch (err) {
    console.error(err);
    setRank("Unknown");
    setCanSeeAllCuts(false);
    setBalance(0);
    setCuts([]);
    setHistory([]);
    setSeasons([]);
  }
}

  const totalCuts = useMemo(
    () => cuts.reduce((sum, cut) => sum + cut.cut, 0),
    [cuts]
  );

  const pending = useMemo(
    () =>
      cuts
        .filter((c) => c.status === "Pending")
        .reduce((sum, cut) => sum + cut.cut, 0),
    [cuts]
  );
function formatRunType(run: string) {
  const text = (run || "").trim();

  if (!text) return "-";

  const n = text.toLowerCase();

  // Whole words only — "Normal" contains an m but isn't mythic.
  if (n.includes("hc") || n.includes("heroic")) return "HEROIC";
  if (n.includes("mythic")) return "MYTHIC";
  if (n.includes("vip")) return "VIP";
  if (n.includes("saved")) return "SAVED";

  return text.toUpperCase();
}

// Colour by how full the run was. Green = full, red = short-handed.
function boosterColor(n: number) {
  if (!n) return "#6b7280";
  if (n >= 16) return "#4ade80";
  if (n >= 15) return "#38bdf8";
  if (n >= 13) return "#facc15";
  if (n >= 11) return "#fb923c";
  return "#f87171";
}

// More clients per run is better.
function clientColor(n: number) {
  if (!n) return "#6b7280";
  if (n >= 4) return "#4ade80";
  if (n === 3) return "#facc15";
  if (n === 2) return "#fb923c";
  return "#f87171";
}

// Community icons live in /public. Filenames are mapped explicitly
// because they don't follow one naming pattern (Sylvanas1.png).
// Discord's placeholder avatars (users who never set a picture) and
// broken URLs both fall back to the guild logo.
function avatarFor(url?: string) {
  if (!url) return "/logo.png";
  if (url.includes("/embed/avatars/")) return "/logo.png";
  return url;
}

function potIcon(name: string) {
  const n = (name || "").toLowerCase();

  if (n.includes("dawn")) return "/Dawn.png";
  if (n.includes("oblivion")) return "/Oblivion.png";
  if (n.includes("sylvanas")) return "/Sylvanas1.png";

  return null;
}
  const paid = useMemo(
    () =>
      cuts
        .filter((c) => c.status === "Paid")
        .reduce((sum, cut) => sum + cut.cut, 0),
    [cuts]
  );
    return (
  <div
    style={{
      position: "relative",
      minHeight: "100vh",
      overflow: "hidden",
    }}
  >
<video
  autoPlay
  muted={muted}
  loop
      playsInline
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        zIndex: -2,
        filter: "brightness(.65)",
      }}
    >
      <source src="/Bankpage.webm" type="video/webm" />
    </video>

    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "linear-gradient(rgba(2,6,16,.45), rgba(0,0,0,.72))",
        zIndex: -1,
      }}
    />
<div
  style={{
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 9999,
  }}
>
  <button
    onClick={() => setMuted(!muted)}
    style={{
      padding: "12px 18px",
      borderRadius: 14,
      border: "1px solid rgba(168,85,247,.45)",
      background:
        "linear-gradient(180deg,#c026d3,#7e22ce)",
      color: "white",
      fontWeight: 900,
      cursor: "pointer",
      boxShadow:
        "0 0 22px rgba(168,85,247,.55)",
      fontSize: 14,
    }}
  >
    {muted ? "🔇 Unmute Sound" : "🔊 Mute Sound"}
  </button>
</div>
    {noteFor && (
      <div
        style={{ ...modalOverlay, zIndex: 10001 }}
        onClick={() => setNoteFor(null)}
      >
        <div
          style={{ ...modalBox, maxWidth: 480 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={modalHeader}>
            <div>
              <div style={modalTitle}>{noteFor.entry.name}</div>
              <div style={modalSubtitle}>
                Leader note · {noteFor.runLabel}
              </div>
            </div>

            <button
              style={modalClose}
              onClick={() => setNoteFor(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {isLeader ? (
            <div style={{ display: "grid", gap: 14 }}>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                style={{ ...reqInput, height: 150, resize: "none" }}
              />

              <button
                style={{ ...sendBtn, opacity: savingNote ? 0.6 : 1 }}
                onClick={saveNote}
                disabled={savingNote}
              >
                {savingNote ? "Saving..." : "Save Note"}
              </button>

              <div style={noteHint}>
                Leave it empty and save to remove the note.
              </div>
            </div>
          ) : notes[noteKey(noteFor.runKey, noteFor.entry.discordId)] ? (
            <div style={noteReadBox}>
              {notes[noteKey(noteFor.runKey, noteFor.entry.discordId)]}
            </div>
          ) : (
            <div style={modalEmpty}>No note for this player.</div>
          )}
        </div>
      </div>
    )}

    {showRequest && (
      <div style={modalOverlay} onClick={() => setShowRequest(false)}>
        <div
          style={{ ...modalBox, maxWidth: 720, padding: 34 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={reqHeader}>
            <div style={reqHeaderLeft}>
              <img
                src="/DeathWish%20Icon.png"
                alt=""
                style={reqCrest}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />

              <div>
                <div style={reqTitle}>Request Payment Change</div>
                <div style={modalSubtitle}>
                  Sent to the officers for approval
                </div>
              </div>
            </div>

            <button
              style={modalClose}
              onClick={() => setShowRequest(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {requestSent ? (
            <div style={{ display: "grid", gap: 18 }}>
              <div style={sentBox}>
                ✅ Request sent. An officer will review it shortly.
              </div>

              <button style={sendBtn} onClick={() => setShowRequest(false)}>
                Close
              </button>
            </div>
          ) : (
            <>
              <div style={currentGrid}>
                <div style={currentCard}>
                  <div style={currentLabel}>Current Payout Character</div>
                  <div style={currentValueChar}>{payoutCharacter}</div>
                </div>

                <div style={currentCard}>
                  <div style={currentLabel}>Current Payment Method</div>
                  <div style={currentValueMethod}>{payoutType}</div>
                </div>
              </div>

              <div style={modalSectionTitle}>WHAT DO YOU WANT TO CHANGE?</div>

              <div style={choiceRow}>
                {[
                  { key: "character", label: "Payout Character" },
                  { key: "method", label: "Payment Method" },
                  { key: "both", label: "Both" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setReqKind(opt.key as any)}
                    style={reqKind === opt.key ? choiceActive : choice}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {(reqKind === "character" || reqKind === "both") && (
                  <div>
                    <div style={fieldLabel}>New payout character</div>
                    <input
                      value={reqCharacter}
                      onChange={(e) => setReqCharacter(e.target.value)}
                      style={reqInput}
                    />
                  </div>
                )}

                {(reqKind === "method" || reqKind === "both") && (
                  <div>
                    <div style={fieldLabel}>New payment method</div>
                    <input
                      value={reqMethod}
                      onChange={(e) => setReqMethod(e.target.value)}
                      style={reqInput}
                    />
                  </div>
                )}

                <div>
                  <div style={fieldLabel}>Note (optional)</div>
                  <textarea
                    value={reqNote}
                    onChange={(e) => setReqNote(e.target.value)}
                    style={{ ...reqInput, height: 110, resize: "none" }}
                  />
                </div>

                <button
                  style={{ ...sendBtn, opacity: sending ? 0.6 : 1 }}
                  onClick={sendPaymentRequest}
                  disabled={sending}
                >
                  {sending ? "Sending..." : "Send Request"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {detailsFor && (
      <div
        style={modalOverlay}
        onClick={() => setDetailsFor(null)}
      >
        <div
          style={{ ...modalBox, maxWidth: 1180, padding: 36 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={modalHeader}>
            <div>
              <div style={modalTitle}>{detailsFor.date}</div>
              <div style={modalSubtitle}>
                {detailsFor.run || "Run details"}
              </div>
            </div>

            <button
              style={modalClose}
              onClick={() => setDetailsFor(null)}
              aria-label="Close details"
            >
              ✕
            </button>
          </div>

          <div style={modalStats}>
            <ModalStat
              label="Boosters in run"
              value={`${detailsFor.boosters}`}
              color={boosterColor(detailsFor.boosters)}
            />
            <ModalStat
              label="Clients"
              value={`${detailsFor.clients || "-"}`}
              color={clientColor(detailsFor.clients)}
            />
            <ModalStat
              label="Total pot"
              value={`${Number(detailsFor.pot || 0).toLocaleString()}g`}
              color="#facc15"
            />
            <ModalStat
              label="Your cut"
              value={`${Number(detailsFor.cut || 0).toLocaleString()}g`}
              color="#d946ef"
            />
          </div>

          {detailsFor.baseCut > 0 && (
            <div style={baseCutNotice}>
              Base cut for this run:{" "}
              <b>{Number(detailsFor.baseCut).toLocaleString()}g</b>
              {detailsFor.bonus && (
                <>
                  {" "}· your bonus:{" "}
                  <b style={{ color: bonusColor(detailsFor.bonus.type) }}>
                    {detailsFor.bonus.label}
                  </b>
                </>
              )}
            </div>
          )}

          <div style={modalSectionTitle}>GOLD BY COMMUNITY</div>

          {detailsFor.pots?.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {detailsFor.pots.map((p, i) => {
                const icon = potIcon(p.name);

                return (
                  <div key={i} style={potRow}>
                    <span style={potNameWrap}>
                      {icon ? (
                        <img src={icon} alt="" style={potIconStyle} />
                      ) : (
                        <span style={potIconFallback}>?</span>
                      )}
                      <span style={{ fontWeight: 900 }}>{p.name}</span>
                    </span>

                    <span style={goldText}>
                      {p.amount.toLocaleString()}g
                    </span>
                  </div>
                );
              })}

              <div style={potTotalRow}>
                <span style={potNameWrap}>
                  <img
                    src="/DeathWish%20Icon.png"
                    alt=""
                    style={potIconStyle}
                  />
                  <span style={{ fontWeight: 900 }}>Collected total</span>
                </span>

                <span style={goldText}>
                  {Number(detailsFor.potTotal || 0).toLocaleString()}g
                </span>
              </div>
            </div>
          ) : (
            <div style={modalEmpty}>
              No community pot recorded for this run.
            </div>
          )}

          {detailsFor.roster?.length > 0 && (
            <>
              <div style={modalSectionTitle}>
                BOOSTERS IN THIS RUN ({detailsFor.roster.length})
                {detailsFor.helpers > 0 && (
                  <span style={countHelper}>
                    {" "}· {detailsFor.helpers} helper
                    {detailsFor.helpers > 1 ? "s" : ""}
                  </span>
                )}
                {detailsFor.strikes > 0 && (
                  <span style={countStrike}>
                    {" "}· {detailsFor.strikes} strike
                    {detailsFor.strikes > 1 ? "s" : ""}
                  </span>
                )}
                {detailsFor.rewards > 0 && (
                  <span style={countReward}>
                    {" "}· {detailsFor.rewards} reward
                    {detailsFor.rewards > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {!canSeeAllCuts && (
                <div style={lockNotice}>
                  🔒 Cuts are hidden. Soulreaper rank or above is required to
                  see everyone&apos;s cut. Your rank: <b>{rank}</b>.
                </div>
              )}

              <div style={rosterGrid}>
                {detailsFor.roster.map((r, i) => {
                  const profile = findProfile(r);

                  // Unique per week + run column, so each run has its own note.
                  const runKey = `w${currentWeekRange().weekNumber}|${
                    detailsFor.id
                  }|${detailsFor.date}`;

                  const hasNote = !!notes[noteKey(runKey, r.discordId)];

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (!r.discordId) return;
                        // Only leaders can open an empty card to write one.
                        if (!isLeader && !hasNote) return;
                        setNoteDraft(notes[noteKey(runKey, r.discordId)] || "");
                        setNoteFor({
                          entry: r,
                          runKey,
                          runLabel: detailsFor.date,
                        });
                      }}
                      title={
                        r.discordId
                          ? isLeader
                            ? "Click to add or edit a leader note"
                            : notes[r.discordId]
                            ? "Click to read the leader note"
                            : ""
                          : ""
                      }
                      style={{
                        cursor:
                          r.discordId && (isLeader || hasNote)
                            ? "pointer"
                            : "default",
                        ...(r.isSelf
                          ? rosterCardSelf
                          : r.isPug
                          ? rosterCardPug
                          : r.mark === "helper"
                          ? rosterCardHelper
                          : r.mark === "strike"
                          ? rosterCardStrike
                          : r.mark === "reward"
                          ? rosterCardReward
                          : rosterCard),
                      }}
                    >
                      {r.mark && (
                        <img
                          src={markIcon(r.mark)}
                          alt={r.mark}
                          title={
                            r.mark === "strike"
                              ? "Strike"
                              : r.mark === "reward"
                              ? "Reward"
                              : "Helper"
                          }
                          style={
                            r.mark === "strike"
                              ? markStrike
                              : r.mark === "reward"
                              ? markReward
                              : markHelper
                          }
                        />
                      )}

                      <img
                        src={avatarFor(profile?.avatar_url)}
                        alt=""
                        style={rosterAvatar}
                        onError={(e) => {
                          // Stale or dead avatar URL — swap in the logo.
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/logo.png";
                        }}
                      />

                      <div style={rosterName} title={r.name}>
                        {profile?.discord_name || r.name}
                      </div>

                      {r.hidden ? (
                        <div style={hiddenCut}>🔒</div>
                      ) : (
                        <div style={rosterCut}>
                          {Number(r.cut || 0).toLocaleString()}g
                        </div>
                      )}

                      {!r.hidden && r.bonus && (
                        <div
                          style={{
                            ...rosterBonus,
                            color: bonusColor(r.bonus.type),
                          }}
                        >
                          {r.bonus.label}
                        </div>
                      )}

                      {r.isSelf && <div style={youTag}>YOU</div>}
                      {r.isPug && <div style={pugTag}>PUG</div>}

                      {hasNote && <div style={noteTag}>📝 LEADER NOTE</div>}
                    </div>
                  );
                })}
              </div>
            </>
          )}

        </div>
      </div>
    )}

    <div style={page}>
      <div style={layout}>
        <aside style={sidebar}>
<SideNav active="Bank" />
<div style={balanceBox}>
  <div style={balanceTitle}>BALANCE OVERVIEW</div>

  <div style={balanceLabel}>Total Balance</div>

  <div
    style={{
      color: "#facc15",
      fontSize: 19,
      fontWeight: 1000,
      lineHeight: 1,
      whiteSpace: "nowrap",
      textAlign: "center",
      textShadow: "0 0 14px rgba(250,204,21,.45)",
      marginTop: 10,
    }}
  >
    {Number(balance || 0).toLocaleString()} 🟡
  </div>
</div>

<div style={discordBox}>
  <b>Join our Discord</b>

  <p style={mutedSmall}>
    Stay updated with raid announcements and guild activity.
  </p>

  <a
    href="https://discord.gg/SrfFKm2Xkw"
    target="_blank"
    rel="noopener noreferrer"
    style={{
      ...discordBtn,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textDecoration: "none",
      boxSizing: "border-box",
    }}
  >
    JOIN DISCORD
  </a>
</div>
        </aside>

        <main>
          <div style={headerRow}>
            <div>
              <h1 style={title}>Bank</h1>
              <p style={subtitle}>
                Track your gold, cuts, payments, and Discord bot rewards.
              </p>
            </div>

<button
  onClick={() => {
    setRequestSent(false);
    setShowRequest(true);
  }}
  style={syncBtn}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-3px) scale(1.04)";
    e.currentTarget.style.boxShadow =
  "0 0 48px rgba(56,189,248,0.85), inset 0 0 28px rgba(255,255,255,0.14)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0) scale(1)";
   e.currentTarget.style.boxShadow =
  "0 0 35px rgba(56,189,248,0.4), inset 0 0 20px rgba(255,255,255,0.08)";
  }}
>
  <span
    style={{
      fontSize: 18,
      filter: "drop-shadow(0 0 6px rgba(255,255,255,0.6))",
    }}
  >
    ✉
  </span>

  <span>Request Payment Change</span>
</button>
          </div>

          <div style={cards}>
            <StatCard title="Total Balance" value={balance} color="#facc15" />
            <StatCard title="This Week" value={totalCuts} color="#d946ef" />
            <PayoutCharacterCard character={payoutCharacter} />
            <PaymentMethodCard method={payoutType} />
            <PaymentStatusCard cuts={cuts} />
          </div>
<div style={tabs}>
 {[
  "This Week",
  "Midnight Season 1 History",
  ...seasonTabs.map((s) => `${s.name} History`),
  "All Seasons History",
].map((tabName) => (
    <button
      key={tabName}
      onClick={() => setActiveTab(tabName)}
      style={activeTab === tabName ? tabActive : tab}
      onMouseEnter={(e) => {
        if (activeTab !== tabName) {
          e.currentTarget.style.background = "rgba(124,58,237,0.22)";
          e.currentTarget.style.boxShadow =
            "0 0 18px rgba(168,85,247,0.45)";
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.color = "white";
        }
      }}
      onMouseLeave={(e) => {
        if (activeTab !== tabName) {
          e.currentTarget.style.background = "rgba(0,0,0,0.45)";
          e.currentTarget.style.boxShadow =
            "0 0 8px rgba(168,85,247,0.12)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.color = "#c4b5fd";
        }
      }}
    >
      {tabName}
    </button>
  ))}
</div>


          <div style={table}>
            {isHistoryTab ? (
              <div style={historyHead}>
                <div>RUN Day</div>
                <div>TYPE OF RUN</div>
                <div>CHARACTER</div>
                <div style={rightCell}>CUT</div>
                <div style={centerCell}>STATUS</div>
                <div style={centerCell}>CLIENTS</div>
                <div style={centerCell}>DETAILS</div>
              </div>
            ) : (
              <div style={tableHead}>
                <div>RUN Day</div>
                <div>TYPE OF RUN</div>
                <div>CHARACTER</div>
                <div style={rightCell}>CUT</div>
                <div style={centerCell}>BONUS</div>
                <div style={centerCell}>STATUS</div>
                <div style={centerCell}>BOOSTERS</div>
                <div style={centerCell}>CLIENTS</div>
                <div style={rightCell}>POT</div>
                <div style={centerCell}>DETAILS</div>
              </div>
            )}

{activeSeason ? (
  <div
    style={{
      padding: 24,
      display: "grid",
      gap: 14,
    }}
  >
    {activeSeason.rows.map((row: any, index: number) => (
      <div key={index} style={historyRow}>
        <div>{row.week || "-"}</div>

        <div>
          <span style={runBadge(formatRunType(row.type))}>
            {formatRunType(row.type)}
          </span>
        </div>

        <div style={charText}>{row.character || "Unknown"}</div>

        <div style={{ ...goldText, ...rightCell }}>
          {Number(row.cut || 0).toLocaleString()}g
        </div>

        <div style={centerCell}>
          <span style={row.status === "Paid" ? paidBadge : pendingBadge}>
            {row.status}
          </span>
        </div>

        <div style={{ ...dimText, ...centerCell }}>-</div>

        <div style={{ ...dimText, ...centerCell }}>-</div>
      </div>
    ))}
  </div>
) : activeTab === "Midnight Season 1 History" ? (
  <div
    style={{
      padding: 24,
      display: "grid",
      gap: 14,
    }}
  >
{history.map((week: any, index: number) => (
  <div key={index} style={historyRow}>
    <div>{week.week}</div>

    <div>
      <span style={runBadge("MYTHIC")}>
        MYTHIC
      </span>
    </div>

    <div style={charText}>Koyjin-kazzak</div>

    <div style={{ ...goldText, ...rightCell }}>
      {Number(week.amount || 0).toLocaleString()}g
    </div>

<div style={centerCell}>
  <span
    style={
      index === history.length - 1
        ? pendingBadge
        : paidBadge
    }
  >
    {index === history.length - 1 ? "Pending" : "Paid"}
  </span>
</div>

    <div style={{ ...dimText, ...centerCell }}>-</div>

    <div style={{ ...dimText, ...centerCell }}>-</div>
  </div>
))}
  </div>
  ) : activeTab === "All Seasons History" ? (
<div style={allSeasonsBox}>
<button
  style={showHistoryBtn}
  onClick={() => {
    window.location.href = "/history";
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.08)";
    e.currentTarget.style.boxShadow =
      "0 0 38px rgba(217,70,239,.75), 0 0 90px rgba(168,85,247,.45)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow =
      "0 0 22px rgba(217,70,239,.45), 0 0 55px rgba(168,85,247,.28)";
  }}
>
    Show me my history
  </button>
</div>
) : (
  filteredCuts.map((cut) => (
              <div key={cut.id} style={tableRow}>
                <div>{cut.date}</div>
<div>
  <span style={runBadge(formatRunType(cut.run))}>
    {formatRunType(cut.run)}
  </span>
</div>
                <div style={charText}>{cut.character}</div>
                <div style={{ ...goldText, ...rightCell }}>
                  {cut.cut.toLocaleString()}g
                </div>
                <div style={centerCell}>
                  {cut.bonus ? (
                    <span
                      style={bonusBadge(cut.bonus.type)}
                      title={
                        cut.baseCut
                          ? `Base cut ${cut.baseCut.toLocaleString()}g`
                          : "No base cut recorded for this run"
                      }
                    >
                      {cut.bonus.label}
                    </span>
                  ) : (
                    <span style={dimText}>—</span>
                  )}
                </div>
                <div style={centerCell}>
                  <span style={cut.status === "Paid" ? paidBadge : pendingBadge}>
                    {cut.status}
                  </span>
                </div>
                <div
                  style={{ ...countCell, color: boosterColor(cut.boosters) }}
                >
                  {cut.boosters || "-"}
                </div>
                <div style={{ ...countCell, color: clientColor(cut.clients) }}>
                  {cut.clients || "-"}
                </div>
                <div style={{ ...goldText, ...rightCell }}>
                  {Number(cut.pot || 0).toLocaleString()}g
                </div>
                <div style={centerCell}>
                  <button
                    style={detailsBtn}
                    onClick={() => setDetailsFor(cut)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(124,58,237,0.35)";
                      e.currentTarget.style.boxShadow =
                        "0 0 16px rgba(168,85,247,0.55)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(124,58,237,0.16)";
                      e.currentTarget.style.boxShadow =
                        "0 0 8px rgba(168,85,247,0.18)";
                    }}
                  >
                    More details
                  </button>
                </div>
              </div>
       ))
)}

            <div style={note}>
              Showing{" "}
              {activeSeason
                ? activeSeason.rows.length
                : activeTab === "Midnight Season 1 History"
                ? history.length
                : filteredCuts.length}{" "}
              cuts from bot.
            </div>
          </div>
        </main>

        <aside style={rightbar}>
          <InfoCard title="BANK INFO">
            <Legend color="#22c55e" title="Paid" text="Gold already paid out." />
            <Legend color="#f59e0b" title="Pending" text="Gold waiting for payout." />
            <Legend color="#38bdf8" title="Source" text="Imported from your Discord bot." />
          </InfoCard>

          <InfoCard title="BONUS LEGEND">
            <Legend
              color="#7dd3fc"
              title="+ Reward"
              text="Paid above the run's base cut."
            />
            <Legend
              color="#fca5a5"
              title="- Strike"
              text="Paid below the run's base cut."
            />
            <Legend
              color="#fcd34d"
              title="Base Cut"
              text="Paid exactly the run's base cut."
            />
          </InfoCard>

          <InfoCard title="THIS WEEK SUMMARY">
            <Summary label="Runs" value={cuts.length} />
            <Summary label="Total Earned" value={totalCuts} color="#facc15" />
            <Summary label="Pending" value={pending} color="#fb923c" />
            <Summary label="Paid" value={paid} color="#22c55e" />
          </InfoCard>
        </aside>
      </div>
    </div>
    </div>
);
}
function ModalStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div style={modalStatBox}>
      <div style={modalStatLabel}>{label}</div>
      <div style={{ ...modalStatValue, color }}>{value}</div>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  const week = currentWeekRange();

  const subtitle =
    title === "Total Balance"
      ? "All time balance"
      : title === "This Week"
      ? `Week ${week.weekNumber} · ${week.label}`
      : title === "Pending Gold"
      ? "Waiting for payout"
      : "Successfully paid";

  return (
    <div style={statCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              title === "Total Balance"
                ? "rgba(250,204,21,0.12)"
                : title === "This Week"
                ? "rgba(217,70,239,0.12)"
                : title === "Pending Gold"
                ? "rgba(249,115,22,0.12)"
                : "rgba(34,197,94,0.12)",
            border:
              title === "Total Balance"
                ? "1px solid rgba(250,204,21,0.35)"
                : title === "This Week"
                ? "1px solid rgba(217,70,239,0.35)"
                : title === "Pending Gold"
                ? "1px solid rgba(249,115,22,0.35)"
                : "1px solid rgba(34,197,94,0.35)",
            boxShadow:
              title === "Total Balance"
                ? "0 0 22px rgba(250,204,21,0.28)"
                : title === "This Week"
                ? "0 0 22px rgba(217,70,239,0.28)"
                : title === "Pending Gold"
                ? "0 0 22px rgba(249,115,22,0.28)"
                : "0 0 22px rgba(34,197,94,0.28)",
          }}
        >
          {title === "Total Balance" ? (
            <Coins size={34} color="#facc15" />
          ) : title === "This Week" ? (
            <CalendarDays size={34} color="#d946ef" />
          ) : title === "Pending Gold" ? (
            <Hourglass size={34} color="#f97316" />
          ) : (
            <BadgeCheck size={34} color="#22c55e" />
          )}
        </div>

        <div>
          <div style={statTitle}>{title}</div>
          <div style={{ ...statValue, color }}>{value.toLocaleString()}g</div>
          <div style={statSubtitle}>{subtitle}</div>
        </div>
      </div>
    </div>
  );
}
function PayoutCharacterCard({ character }: { character: string }) {
  return (
    <div style={statCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(249,115,22,0.12)",
            border: "1px solid rgba(249,115,22,0.35)",
            boxShadow: "0 0 22px rgba(249,115,22,0.28)",
            fontSize: 32,
          }}
        >
          📬
        </div>

        <div>
          <div style={statTitle}>Payout Character</div>
          <div style={{ ...statValue, color: "#fb923c", fontSize: 24 }}>
            {character}
          </div>
          <div style={statSubtitle}>Gold mailed to this character</div>
        </div>
      </div>
    </div>
  );
}
function PaymentMethodCard({ method }: { method: string }) {
  return (
    <div style={statCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(56,189,248,0.12)",
            border: "1px solid rgba(56,189,248,0.35)",
            boxShadow: "0 0 22px rgba(56,189,248,0.28)",
            fontSize: 30,
          }}
        >
          💳
        </div>

        <div>
          <div style={statTitle}>Payment Method</div>
          <div style={{ ...statValue, color: "#38bdf8", fontSize: 22 }}>
            {method}
          </div>
          <div style={statSubtitle}>How your gold is delivered</div>
        </div>
      </div>
    </div>
  );
}

function PaymentStatusCard({ cuts }: { cuts: Cut[] }) {
  const hasPending = cuts.some((c) => c.status === "Pending");

  const title = hasPending ? "Pending Gold" : "Paid Gold";

  const value = hasPending
    ? cuts
        .filter((c) => c.status === "Pending")
        .reduce((sum, c) => sum + c.cut, 0)
    : cuts
        .filter((c) => c.status === "Paid")
        .reduce((sum, c) => sum + c.cut, 0);

  const color = hasPending ? "#ef4444" : "#22c55e";

  const bg = hasPending
    ? "rgba(239,68,68,0.12)"
    : "rgba(34,197,94,0.12)";

  const border = hasPending
    ? "1px solid rgba(239,68,68,0.35)"
    : "1px solid rgba(34,197,94,0.35)";

  const glow = hasPending
    ? "0 0 22px rgba(239,68,68,0.28)"
    : "0 0 22px rgba(34,197,94,0.28)";

  return (
    <div style={statCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: bg,
            border,
            boxShadow: glow,
            fontSize: 32,
          }}
        >
          {hasPending ? "✖" : "✔"}
        </div>

        <div>
          <div style={statTitle}>{title}</div>

          <div
            style={{
              ...statValue,
              color,
            }}
          >
            {value.toLocaleString()}g
          </div>

          <div style={statSubtitle}>
            {hasPending
              ? "Waiting for payout"
              : "Successfully paid"}
          </div>
        </div>
      </div>
    </div>
  );
}
function SmallTitle({ children }: { children: React.ReactNode }) {
  return <div style={smallTitle}>{children}</div>;
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={infoCard}>
      <h3 style={infoTitle}>{title}</h3>
      {children}
    </div>
  );
}

function Legend({ color, title, text }: { color: string; title: string; text: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color, fontSize: 20, fontWeight: 900 }}>• {title}</div>
      <p style={muted}>{text}</p>
    </div>
  );
}

function Summary({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={summaryRow}>
      <span>{label}</span>
      <b style={{ color: color || "white" }}>
        {value > 1000 ? `${value.toLocaleString()}g` : value}
      </b>
    </div>
  );
}

// Badge art in /public, used on the roster cards only.
// Blue cut on the sheet = Reward.
function markIcon(mark: string) {
  if (mark === "strike") return "/Strike.png";
  if (mark === "reward") return "/Reward.png";
  return "/Helper.png";
}

function bonusColor(type: string) {
  if (type === "strike") return "#fca5a5";
  if (type === "reward") return "#7dd3fc";
  if (type === "base") return "#fcd34d";
  return "#86efac";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  fontFamily: "Arial, sans-serif",
  background: "transparent",
  position: "relative",
  zIndex: 1,
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 1fr 260px",
  gap: 18,
  padding: 18,
};

const sidebar: React.CSSProperties = {
  background: "rgba(7,10,20,0.88)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 18,
  height: "fit-content",
};

const rightbar: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 22,
};

const title: React.CSSProperties = {
  fontSize: 42,
  margin: 0,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  color: "#b9b4c9",
};

const syncBtn: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  height: 58,
  padding: "0 34px",
  borderRadius: 16,
  border: "1px solid rgba(56,189,248,0.75)",
  background:
    "linear-gradient(135deg, rgba(8,47,73,1), rgba(14,116,144,1))",
  color: "#e0f2fe",
  fontSize: 15,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  cursor: "pointer",
  overflow: "hidden",
  boxShadow:
    "0 0 35px rgba(56,189,248,0.4), inset 0 0 20px rgba(255,255,255,0.08)",
  transition: "all 0.22s ease",
};

const cards: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 16,
  marginBottom: 24,
};

const statCard: React.CSSProperties = {
  background: "rgba(7,10,20,0.88)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  padding: 22,
  minHeight: 150,
  boxSizing: "border-box",
};

const statTitle: React.CSSProperties = {
  color: "#d8b4fe",
  fontWeight: 900,
  marginBottom: 12,
};

const statValue: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
};

const statSubtitle: React.CSSProperties = {
  marginTop: 8,
  color: "#9ca3af",
  fontSize: 14,
};

const tabs: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 14,
  flexWrap: "wrap",
};

const tabActive: React.CSSProperties = {
  border: "1px solid rgba(217,70,239,0.85)",
  borderRadius: 10,
  padding: "13px 30px",
  background: "linear-gradient(90deg,#6d28d9,#c026d3)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 18px rgba(217,70,239,0.55)",
  transition: "all 0.2s ease",
};

const tab: React.CSSProperties = {
  border: "1px solid rgba(168,85,247,0.22)",
  borderRadius: 10,
  padding: "13px 30px",
  background: "rgba(0,0,0,0.45)",
  color: "#c4b5fd",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 8px rgba(168,85,247,0.12)",
  transition: "all 0.2s ease",
};

const table: React.CSSProperties = {
  background: "rgba(4,9,18,0.94)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  overflow: "hidden",
};

// Ten columns — BONUS sits between CUT and STATUS. CUT and POT are given
// the same width so their right-aligned digits line up with each other.
const GRID_COLUMNS = "1.1fr 1.1fr 1.1fr 1fr 1.2fr 1fr .7fr .7fr 1fr 1.1fr";

// Season history has no Bonus, Boosters or Pot, so it uses seven columns.
const HISTORY_GRID_COLUMNS = "1.3fr 1.2fr 1.3fr 1.1fr 1fr .8fr 1.2fr";

const tableHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: GRID_COLUMNS,
  padding: "14px 16px",
  fontSize: 12,
  color: "#d6bfff",
  fontWeight: 900,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: GRID_COLUMNS,
  padding: "18px 16px",
  alignItems: "center",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

const historyHead: React.CSSProperties = {
  ...tableHead,
  gridTemplateColumns: HISTORY_GRID_COLUMNS,
};

const historyRow: React.CSSProperties = {
  ...tableRow,
  gridTemplateColumns: HISTORY_GRID_COLUMNS,
};

const charText: React.CSSProperties = {
  color: "#d946ef",
  fontWeight: 900,
};

const goldText: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 900,
};

const paidBadge: React.CSSProperties = {
  background: "rgba(34,197,94,0.18)",
  border: "1px solid rgba(34,197,94,0.35)",
  color: "#4ade80",
  padding: "7px 14px",
  borderRadius: 999,
  fontWeight: 900,
};

const pendingBadge: React.CSSProperties = {
  background: "rgba(245,158,11,0.16)",
  border: "1px solid rgba(245,158,11,0.35)",
  color: "#fbbf24",
  padding: "7px 14px",
  borderRadius: 999,
  fontWeight: 900,
};

// Text only — blue for reward, red for strike, yellow when the cut
// landed exactly on the base.
const bonusBadge = (type: string): React.CSSProperties => {
  const palette: Record<string, [string, string]> = {
    reward: ["#7dd3fc", "56,189,248"],
    strike: ["#fca5a5", "239,68,68"],
    helper: ["#86efac", "74,222,128"],
    base: ["#fcd34d", "250,204,21"],
  };

  const [color, rgb] = palette[type] || ["#cbd5e1", "148,163,184"];

  return {
    display: "inline-block",
    minWidth: 118,
    textAlign: "center",
    padding: "7px 16px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    color,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    background: `rgba(${rgb},0.12)`,
    border: `1px solid rgba(${rgb},0.6)`,
    boxShadow: `0 0 14px rgba(${rgb},0.35)`,
  };
};

const baseCutNotice: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 12,
  background: "rgba(148,163,184,0.08)",
  border: "1px solid rgba(148,163,184,0.25)",
  color: "#cbd5e1",
  fontSize: 13,
  marginBottom: 4,
};

const note: React.CSSProperties = {
  padding: 16,
  color: "#9ca3af",
  fontSize: 13,
};

const smallTitle: React.CSSProperties = {
  color: "#8b5cf6",
  fontWeight: 900,
  marginBottom: 14,
  fontSize: 13,
  letterSpacing: 1,
};

const sideItem: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  marginBottom: 6,
  color: "#c7c7d1",
  fontWeight: 700,
};

const sideActive: React.CSSProperties = {
  ...sideItem,
  background: "rgba(139,92,246,0.24)",
  color: "white",
};

const balanceBox: React.CSSProperties = {
  marginTop: 18,
  background: "linear-gradient(180deg, rgba(12,22,36,0.95), rgba(6,12,22,0.95))",
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
  marginBottom: 10,
};

const balanceAmount: React.CSSProperties = {
  color: "#facc15",
  fontSize: 24,
  fontWeight: 900,
  marginBottom: 18,
};


const discordBox: React.CSSProperties = {
  marginTop: 28,
  background: "rgba(139,92,246,0.12)",
  border: "1px solid rgba(139,92,246,0.4)",
  borderRadius: 14,
  padding: 18,
};

const mutedSmall: React.CSSProperties = {
  color: "#bcbccc",
  fontSize: 13,
  lineHeight: 1.5,
};

const discordBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 16,
  height: 42,
  border: 0,
  borderRadius: 10,
  background: "linear-gradient(90deg,#7c3aed,#c026d3)",
  color: "white",
  fontWeight: 900,
};

const infoCard: React.CSSProperties = {
  background: "rgba(7,10,20,0.88)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 20,
};

const infoTitle: React.CSSProperties = {
  margin: "0 0 18px",
};

const muted: React.CSSProperties = {
  color: "#bcbcbc",
  lineHeight: 1.5,
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 14,
  color: "#d1d1d1",
  fontWeight: 700,
};
const historyEmpty: React.CSSProperties = {
  padding: 40,
  textAlign: "center",
  color: "#d8b4fe",
  fontSize: 22,
  fontWeight: 900,
};
const runBadge = (type: string): React.CSSProperties => {
  const palette: Record<string, [string, string]> = {
    HEROIC: ["#22d3ee", "34,211,238"],
    MYTHIC: ["#d8b4fe", "168,85,247"],
    VIP: ["#fbbf24", "245,158,11"],
    SAVED: ["#f87171", "239,68,68"],
    NORMAL: ["#a5b4fc", "129,140,248"],
  };

  const [color, rgb] = palette[type] || ["#cbd5e1", "148,163,184"];

  return {
    display: "inline-block",
    minWidth: 96,
    textAlign: "center",
    padding: "9px 18px",
    borderRadius: 999,
    fontSize: 15,
    fontWeight: 900,
    color,
    background: `rgba(${rgb},0.12)`,
    border: `1px solid rgba(${rgb},0.75)`,
    boxShadow: `0 0 18px rgba(${rgb},0.55)`,
  };
};
const allSeasonsBox: React.CSSProperties = {
  minHeight: 420,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const showHistoryBtn: React.CSSProperties = {
  padding: "24px 54px",
  borderRadius: 20,
  border: "1px solid rgba(217,70,239,.9)",
  background: "linear-gradient(135deg,#7c3aed,#d946ef)",
  color: "white",
  fontSize: 26,
  fontWeight: 1000,
  cursor: "pointer",
  transition: "all .22s ease",
  boxShadow:
    "0 0 22px rgba(217,70,239,.45), 0 0 55px rgba(168,85,247,.28)",
};

const dimText: React.CSSProperties = {
  color: "#6b7280",
};

const boosterText: React.CSSProperties = {
  color: "#38bdf8",
  fontWeight: 900,
};

const detailsBtn: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid rgba(168,85,247,0.55)",
  background: "rgba(124,58,237,0.16)",
  color: "#d8b4fe",
  fontWeight: 900,
  fontSize: 13,
  cursor: "pointer",
  boxShadow: "0 0 8px rgba(168,85,247,0.18)",
  transition: "all 0.2s ease",
  whiteSpace: "nowrap",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,16,0.78)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
  padding: 24,
};

const modalBox: React.CSSProperties = {
  width: "100%",
  maxWidth: 940,
  maxHeight: "84vh",
  overflowY: "auto",
  background: "linear-gradient(180deg, rgba(12,10,28,0.98), rgba(4,9,18,0.98))",
  border: "1px solid rgba(168,85,247,0.45)",
  borderRadius: 20,
  padding: 28,
  boxShadow: "0 0 60px rgba(168,85,247,0.35)",
  color: "white",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 24,
};

const modalTitle: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
};

const modalSubtitle: React.CSSProperties = {
  color: "#c4b5fd",
  marginTop: 6,
  fontWeight: 700,
};

const modalClose: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.06)",
  color: "#e5e7eb",
  borderRadius: 10,
  width: 36,
  height: 36,
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const modalStats: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 12,
  marginBottom: 26,
};

const modalStatBox: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 14,
  padding: 16,
};

const modalStatLabel: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 8,
};

const modalStatValue: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
};

const modalSectionTitle: React.CSSProperties = {
  color: "#8b5cf6",
  fontWeight: 900,
  fontSize: 12,
  letterSpacing: 1,
  margin: "22px 0 14px",
};

const potRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 18px",
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
};

const potTotalRow: React.CSSProperties = {
  ...potRow,
  background: "rgba(168,85,247,0.12)",
  border: "1px solid rgba(168,85,247,0.4)",
};

const modalEmpty: React.CSSProperties = {
  color: "#9ca3af",
  padding: "16px 0",
};

const potNameWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const potIconStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 12,
  // contain, so logos with transparency aren't cropped
  objectFit: "contain",
  background: "rgba(0,0,0,0.35)",
  padding: 3,
  border: "1px solid rgba(255,255,255,0.14)",
  flexShrink: 0,
};

const potIconFallback: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#9ca3af",
  fontWeight: 900,
  flexShrink: 0,
};

const potTotalIcon: React.CSSProperties = {
  ...potIconFallback,
  background: "rgba(168,85,247,0.18)",
  border: "1px solid rgba(168,85,247,0.45)",
  color: "#d8b4fe",
};

const rosterGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 14,
};

const rosterCard: React.CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: "24px 10px 16px",
  overflow: "visible",
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
  textAlign: "center",
};

const rosterCardSelf: React.CSSProperties = {
  ...rosterCard,
  background: "rgba(217,70,239,0.12)",
  border: "1px solid rgba(217,70,239,0.45)",
};

const rosterAvatar: React.CSSProperties = {
  width: 60,
  height: 60,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(168,85,247,0.5)",
};

const rosterName: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 13,
  width: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rosterCut: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 900,
  fontSize: 15,
};

const rosterBonus: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 11,
  letterSpacing: 0.3,
  whiteSpace: "nowrap",
  fontVariantNumeric: "tabular-nums",
};

const youTag: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(217,70,239,0.25)",
  border: "1px solid rgba(217,70,239,0.5)",
  color: "#f5d0fe",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 1,
};

const hiddenCut: React.CSSProperties = {
  color: "#6b7280",
  fontWeight: 900,
  fontSize: 15,
};

const lockNotice: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  background: "rgba(245,158,11,0.10)",
  border: "1px solid rgba(245,158,11,0.35)",
  color: "#fcd34d",
  fontSize: 13,
  lineHeight: 1.5,
  marginBottom: 12,
};

const rosterCardPug: React.CSSProperties = {
  ...rosterCard,
  background: "rgba(56,189,248,0.10)",
  border: "1px dashed rgba(56,189,248,0.45)",
};

const pugTag: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "rgba(56,189,248,0.22)",
  border: "1px solid rgba(56,189,248,0.5)",
  color: "#bae6fd",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 1,
};

const reqInput: React.CSSProperties = {
  width: "100%",
  padding: "16px 18px",
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,0.35)",
  background: "rgba(0,0,0,0.45)",
  color: "white",
  fontSize: 16,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const sendBtn: React.CSSProperties = {
  width: "100%",
  padding: "18px 20px",
  borderRadius: 12,
  border: "1px solid rgba(217,70,239,0.8)",
  background: "linear-gradient(90deg,#6d28d9,#c026d3)",
  color: "white",
  fontWeight: 900,
  fontSize: 17,
  cursor: "pointer",
  boxShadow: "0 0 18px rgba(217,70,239,0.45)",
};

const sentBox: React.CSSProperties = {
  padding: "18px 16px",
  borderRadius: 12,
  background: "rgba(34,197,94,0.12)",
  border: "1px solid rgba(34,197,94,0.4)",
  color: "#4ade80",
  fontWeight: 800,
  textAlign: "center",
};

const reqHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
  paddingBottom: 20,
  marginBottom: 22,
  borderBottom: "1px solid rgba(168,85,247,0.25)",
};

const reqHeaderLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const reqCrest: React.CSSProperties = {
  width: 78,
  height: 78,
  borderRadius: 18,
  objectFit: "cover",
  border: "1px solid rgba(168,85,247,0.5)",
  boxShadow: "0 0 20px rgba(168,85,247,0.4)",
  flexShrink: 0,
};

const currentGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const currentCard: React.CSSProperties = {
  padding: "18px 20px",
  borderRadius: 14,
  background: "rgba(255,255,255,0.035)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const currentLabel: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.6,
  marginBottom: 8,
  textTransform: "uppercase",
};

const currentValueChar: React.CSSProperties = {
  color: "#d946ef",
  fontWeight: 900,
  fontSize: 20,
};

const currentValueMethod: React.CSSProperties = {
  color: "#fb923c",
  fontWeight: 900,
  fontSize: 20,
};

const choiceRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
};

const choice: React.CSSProperties = {
  padding: "16px 10px",
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,0.25)",
  background: "rgba(0,0,0,0.4)",
  color: "#c4b5fd",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  transition: "all 0.18s ease",
};

const choiceActive: React.CSSProperties = {
  ...choice,
  background: "linear-gradient(90deg,#6d28d9,#c026d3)",
  border: "1px solid rgba(217,70,239,0.85)",
  color: "white",
  boxShadow: "0 0 16px rgba(217,70,239,0.5)",
};

const fieldLabel: React.CSSProperties = {
  color: "#c4b5fd",
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 7,
};

const reqTitle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#38bdf8",
  textShadow: "0 0 18px rgba(56,189,248,0.45)",
};

const clientText: React.CSSProperties = {
  color: "#4ade80",
  fontWeight: 900,
};

const markBase: React.CSSProperties = {
  position: "absolute",
  top: -6,
  left: -6,
  width: 75,
  height: 75,
  objectFit: "contain",
  zIndex: 2,
  pointerEvents: "none",
};

const markStrike: React.CSSProperties = {
  ...markBase,
  filter: "drop-shadow(0 0 8px rgba(239,68,68,0.95))",
};

const markHelper: React.CSSProperties = {
  ...markBase,
  filter: "drop-shadow(0 0 8px rgba(74,222,128,0.95))",
};

const markReward: React.CSSProperties = {
  ...markBase,
  filter: "drop-shadow(0 0 8px rgba(56,189,248,0.95))",
};

const rosterCardHelper: React.CSSProperties = {
  ...rosterCard,
  background: "rgba(74,222,128,0.09)",
  border: "1px solid rgba(74,222,128,0.45)",
};

const rosterCardStrike: React.CSSProperties = {
  ...rosterCard,
  background: "rgba(239,68,68,0.09)",
  border: "1px solid rgba(239,68,68,0.45)",
};

const rosterCardReward: React.CSSProperties = {
  ...rosterCard,
  background: "rgba(56,189,248,0.10)",
  border: "1px solid rgba(56,189,248,0.5)",
};

const countHelper: React.CSSProperties = {
  color: "#4ade80",
};

const countStrike: React.CSSProperties = {
  color: "#f87171",
};

const countReward: React.CSSProperties = {
  color: "#38bdf8",
};

const noteTag: React.CSSProperties = {
  padding: "3px 9px",
  borderRadius: 999,
  background: "rgba(250,204,21,0.18)",
  border: "1px solid rgba(250,204,21,0.5)",
  color: "#fde68a",
  fontSize: 9,
  fontWeight: 900,
  letterSpacing: 0.5,
  whiteSpace: "nowrap",
};

const noteReadBox: React.CSSProperties = {
  padding: "18px 20px",
  borderRadius: 14,
  background: "rgba(250,204,21,0.08)",
  border: "1px solid rgba(250,204,21,0.35)",
  color: "#fde68a",
  fontSize: 15,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
};

const noteHint: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  textAlign: "center",
};

const centerCell: React.CSSProperties = {
  textAlign: "center",
};

// Right-aligned money columns. tabular-nums gives every digit the same
// width, so "1g" and "800,000g" line up on the same right edge.
const rightCell: React.CSSProperties = {
  textAlign: "right",
  paddingRight: 28,
  fontVariantNumeric: "tabular-nums",
};

const countCell: React.CSSProperties = {
  textAlign: "center",
  fontWeight: 900,
  fontSize: 16,
};
