"use client";

/* ============================================================
   HEARTS SYSTEM — everything in one file.
   Put this at: app/components/HeartsSystem.tsx

   Gives you:
   - 5 hearts per player per month
   - unsign cards that grow on hover, show the day, and have an X
   - a warning popup before losing a heart
   - a 14 day signup lock when all 5 hearts are gone
   - a player popup with Garrison / Discord DM / Change class
============================================================ */

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import CharacterInfoCard from "./CharacterInfoCard";
/* ============================================================
   1. SETTINGS — change these numbers, nothing else.
============================================================ */
export const MAX_HEARTS = 5;
export const BAN_DAYS = 14;
export const FREE_ROLES = ["Bench", "Loot Body"]; // unsigning these costs nothing

/**
 * Grace window. Someone who signs up and changes their mind within this
 * many hours leaves for free — no warning, no heart, no card on the run.
 * Set to 0 to charge from the moment they sign.
 */
export const GRACE_HOURS = 12;
export const RESTORE_HEART_ON_RESIGN = true;      // signing back returns the heart
export const LIFT_BAN_WHEN_HEART_RESTORED = true; // X on a card can unlock a player

// Keep this in sync with runs/page.tsx.
export const SEASON_START = new Date("2026-08-19T07:00:00");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Has this week actually begun?
 * Unsigning from a future week is free — no heart, no card on the run.
 * The moment the week starts, leaving costs a heart like normal.
 */
export function hasWeekStarted(week?: number | null) {
  if (week === null || week === undefined) return true;

  const startsAt = SEASON_START.getTime() + (Number(week) - 1) * WEEK_MS;

  return Date.now() >= startsAt;
}

/** When week N begins, in milliseconds. */
export function weekStartMs(week?: number | null) {
  if (week === null || week === undefined) return 0;
  return SEASON_START.getTime() + (Number(week) - 1) * WEEK_MS;
}

/**
 * The moment the grace clock starts for a signup. It is the latest of:
 *   - when they signed up
 *   - when the week began (signing early doesn't burn the window)
 *   - when the raid time was last changed (a moved run resets it)
 */
export function graceStartsAt(input: {
  createdAt?: string | null;
  week?: number | null;
  timeChangedAt?: string | null;
}) {
  const times = [weekStartMs(input.week)];

  if (input.createdAt) {
    const t = new Date(input.createdAt).getTime();
    if (!Number.isNaN(t)) times.push(t);
  }

  if (input.timeChangedAt) {
    const t = new Date(input.timeChangedAt).getTime();
    if (!Number.isNaN(t)) times.push(t);
  }

  return Math.max(...times);
}

/**
 * Free walk-away. Only covers weeks that haven't begun — the 12h window
 * is no longer decided here. The heart is taken, then claimed back from
 * the unsign card while the timer is still green.
 */
export function isFreeToUnsign(input: { week?: number | null }) {
  return !hasWeekStarted(input.week);
}

/**
 * When the claim window shuts. Measured from the moment they SIGNED.
 * Falls back to the unsign time if signed_at was never recorded, so old
 * rows still get a usable window instead of an instantly dead button.
 */
export function claimWindowEndsAt(log: BanishLog) {
  const signed = log.signed_at ? new Date(log.signed_at).getTime() : NaN;
  const base = Number.isNaN(signed) ? new Date(log.unsigned_at).getTime() : signed;

  return base + GRACE_HOURS * 60 * 60 * 1000;
}

export function claimMsLeft(log: BanishLog, now = Date.now()) {
  return Math.max(0, claimWindowEndsAt(log) - now);
}

export function formatLeft(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);

  return `${h}h ${String(m).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`;
}

/* ============================================================
   2. Small helpers
============================================================ */
export type BanishLog = {
  id: number;
  player: string;
  discord_id?: string | null;
  run_id: number;
  run_title?: string | null;
  week?: number | null;
  unsigned_at: string;
  signed_at?: string | null;
  claimed?: boolean;
  weight?: number;
  kind?: string; // 'unsign' | 'no_show'
};

export type SignupBan = {
  id: number;
  discord_id?: string | null;
  player_key: string;
  player?: string | null;
  month_key: string;
  banned_at: string;
  banned_until: string;
  lifted: boolean;
  reason?: string | null;
};

/** '2026-09' — hearts reset when this changes. */
function monthKey(date: Date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** One stable id per player: discord id, or the character name. */
export function playerKey(input: {
  discord_id?: string | null;
  player?: string | null;
}) {
  if (input.discord_id) return input.discord_id;
  return (input.player || "").split(" - ")[0].trim().toLowerCase();
}

function daysUntil(dateString: string) {
  const diff = new Date(dateString).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-GB");
}

/**
 * Hearts spent this month. A claimed card still shows on the run but
 * costs nothing, and a no-show is worth double.
 */
function heartsLostFor(key: string, logs: BanishLog[]) {
  const month = monthKey();

  return logs
    .filter(
      (log) =>
        playerKey(log) === key &&
        !log.claimed &&
        monthKey(new Date(log.unsigned_at)) === month
    )
    .reduce((sum, log) => sum + (Number(log.weight) || 1), 0);
}

/** No-shows are a penalty, not a change of mind — nothing to claim. */
export function isClaimable(log: BanishLog) {
  return log.kind !== "no_show" && !log.claimed;
}

function heartsFor(key: string, logs: BanishLog[]) {
  return Math.max(0, MAX_HEARTS - heartsLostFor(key, logs));
}

function activeBanFor(key: string, bans: SignupBan[]) {
  const now = Date.now();
  return (
    bans.find(
      (b) =>
        b.player_key === key &&
        !b.lifted &&
        new Date(b.banned_until).getTime() > now
    ) || null
  );
}

/* ============================================================
   3. THE HOOK — call this once in runs/page.tsx
============================================================ */
export function useHearts(discordId?: string | null) {
  const [logs, setLogs] = useState<BanishLog[]>([]);
  const [bans, setBans] = useState<SignupBan[]>([]);

  const reload = useCallback(async () => {
    const [logRes, banRes] = await Promise.all([
      supabase.from("banish_logs").select("*").order("unsigned_at", { ascending: false }),
      supabase.from("signup_bans").select("*"),
    ]);

    if (logRes.error) console.error(logRes.error.message);
    else setLogs((logRes.data || []) as BanishLog[]);

    if (banRes.error) console.error(banRes.error.message);
    else setBans((banRes.data || []) as SignupBan[]);
  }, []);

  useEffect(() => {
    reload();

    const channel = supabase
      .channel("hearts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "banish_logs" },
        () => reload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "signup_bans" },
        () => reload()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  /** Unsign cards belonging to one run card. */
  function logsForRun(runId: number, week?: number | null) {
    return logs.filter(
      (log) =>
        log.run_id === runId &&
        (week === undefined || week === null || Number(log.week) === Number(week))
    );
  }

  /** Hearts for any signup or unsign row. */
  function heartsOfPlayer(input: {
    discord_id?: string | null;
    player?: string | null;
  }) {
    return heartsFor(playerKey(input), logs);
  }

  function banOf(key: string) {
    return activeBanFor(key, bans);
  }

  /** Everyone who lost a heart this month, worst first. */
  function roster() {
    const month = monthKey();
    const map = new Map<
      string,
      { key: string; name: string; hearts: number; ban: SignupBan | null }
    >();

    logs.forEach((log) => {
      if (monthKey(new Date(log.unsigned_at)) !== month) return;

      const key = playerKey(log);

      const entry =
        map.get(key) || {
          key,
          name: (log.player || "").split(" - ")[0],
          hearts: MAX_HEARTS,
          ban: null,
        };

      entry.hearts = heartsFor(key, logs);
      entry.ban = activeBanFor(key, bans);

      map.set(key, entry);
    });

    return Array.from(map.values()).sort((a, b) => a.hearts - b.hearts);
  }

  /** Player left a run: log it, take the heart, ban if that was the last. */
  async function takeHeart(input: {
    player: string;
    discordId?: string | null;
    runId: number;
    runTitle?: string | null;
    week?: number | null;
    signedAt?: string | null;
    weight?: number;
    kind?: string;
  }) {
    const key = playerKey({ discord_id: input.discordId, player: input.player });
    const now = new Date();
    const weight = input.weight ?? 1;

    const { error } = await supabase.from("banish_logs").insert({
      player: input.player,
      discord_id: input.discordId || null,
      run_id: input.runId,
      run_title: input.runTitle || null,
      week: input.week ?? null,
      signed_at: input.signedAt || null,
      unsigned_at: now.toISOString(),
      weight,
      kind: input.kind || "unsign",
    });

    if (error) return { ok: false as const, message: error.message };

    const heartsLeft = Math.max(0, MAX_HEARTS - (heartsLostFor(key, logs) + weight));

    let ban = activeBanFor(key, bans);

    if (heartsLeft === 0 && !ban) {
      const until = new Date(now.getTime() + BAN_DAYS * 86400000);

      const { data, error: banError } = await supabase
        .from("signup_bans")
        .insert({
          discord_id: input.discordId || null,
          player_key: key,
          player: input.player.split(" - ")[0],
          month_key: monthKey(),
          banned_at: now.toISOString(),
          banned_until: until.toISOString(),
          reason: `Lost all ${MAX_HEARTS} hearts in ${monthKey()}`,
        })
        .select()
        .single();

      if (banError) console.error(banError.message);
      else ban = data as SignupBan;
    }

    await reload();
    return { ok: true as const, heartsLeft, ban };
  }

  /** The X on an unsign card: delete the record, heart comes back. */
  async function giveHeartBack(log: BanishLog) {
    const { error } = await supabase.from("banish_logs").delete().eq("id", log.id);

    if (error) return { ok: false as const, message: error.message };

    if (LIFT_BAN_WHEN_HEART_RESTORED) {
      const key = playerKey(log);
      const left = heartsFor(key, logs.filter((l) => l.id !== log.id));
      const ban = activeBanFor(key, bans);

      if (left > 0 && ban) {
        await supabase.from("signup_bans").update({ lifted: true }).eq("id", ban.id);
      }
    }

    await reload();
    return { ok: true as const };
  }

  /**
   * The green button on an unsign card. Marks the row claimed so the heart
   * comes back, but leaves the card standing — the record of who left only
   * goes away when they sign into the run again.
   */
  async function claimHeart(log: BanishLog) {
    if (log.claimed || log.kind === "no_show") return { ok: false as const };
    const { data, error } = await supabase
      .from("banish_logs")
      .update({ claimed: true })
      .eq("id", log.id)
      .select();

    if (error) {
      console.error("claimHeart failed:", error.message);
      return { ok: false as const, message: error.message };
    }

    // RLS blocks return zero rows with no error — catch that here.
    if (!data || data.length === 0) {
      console.error("claimHeart updated 0 rows — check RLS update policy on banish_logs");
      return { ok: false as const, message: "Could not claim — no permission to update this record." };
    }

    if (LIFT_BAN_WHEN_HEART_RESTORED) {
      const key = playerKey(log);

      const left = heartsFor(
        key,
        logs.map((l) => (l.id === log.id ? { ...l, claimed: true } : l))
      );

      const ban = activeBanFor(key, bans);

      if (left > 0 && ban) {
        await supabase.from("signup_bans").update({ lifted: true }).eq("id", ban.id);
      }
    }

    await reload();
    return { ok: true as const };
  }

  /** Marked missing on the night: double penalty, no claim. */
  async function markNoShow(input: {
    player: string;
    discordId?: string | null;
    runId: number;
    runTitle?: string | null;
    week?: number | null;
  }) {
    const already = logs.find(
      (l) =>
        l.run_id === input.runId &&
        l.kind === "no_show" &&
        playerKey(l) ===
          playerKey({ discord_id: input.discordId, player: input.player })
    );

    if (already) return;

    return takeHeart({ ...input, weight: 2, kind: "no_show" });
  }

  /** Attendance flipped back off — drop the penalty row. */
  async function clearNoShow(input: {
    runId: number;
    discordId?: string | null;
    player?: string | null;
  }) {
    const key = playerKey({ discord_id: input.discordId, player: input.player });

    const ids = logs
      .filter(
        (l) => l.run_id === input.runId && l.kind === "no_show" && playerKey(l) === key
      )
      .map((l) => l.id);

    if (ids.length === 0) return;

    await supabase.from("banish_logs").delete().in("id", ids);
    await reload();
  }

  /** Player signed back into a run — clear their card for it. */
  async function clearRunUnsign(input: {
    runId: number;
    discordId?: string | null;
    characterName?: string | null;
  }) {
    if (!RESTORE_HEART_ON_RESIGN) return;

     // No-show penalties are not undone by signing back in.
    let query = supabase
      .from("banish_logs")
      .delete()
      .eq("run_id", input.runId)
      .neq("kind", "no_show");

    if (input.discordId) query = query.eq("discord_id", input.discordId);
    else if (input.characterName)
      query = query.ilike("player", `${input.characterName}%`);
    else return;

    const { error } = await query;
    if (error) console.error(error.message);

    await reload();
  }

  async function liftBan(banId: number) {
    await supabase.from("signup_bans").update({ lifted: true }).eq("id", banId);
    await reload();
  }

  /** Admin: hand one heart back by deleting that player's newest unsign. */
  async function giveHeartTo(key: string) {
    const month = monthKey();

    const mine = logs
      .filter(
        (l) =>
          playerKey(l) === key &&
          monthKey(new Date(l.unsigned_at)) === month
      )
      .sort(
        (a, b) =>
          new Date(b.unsigned_at).getTime() - new Date(a.unsigned_at).getTime()
      );

    if (mine.length === 0) return;

    await supabase.from("banish_logs").delete().eq("id", mine[0].id);

    const ban = activeBanFor(key, bans);
    if (ban) {
      await supabase.from("signup_bans").update({ lifted: true }).eq("id", ban.id);
    }

    await reload();
  }

  /** Admin: wipe a player off the list — all hearts back, ban lifted. */
  async function clearPlayer(key: string) {
    const month = monthKey();

    const ids = logs
      .filter(
        (l) =>
          playerKey(l) === key &&
          monthKey(new Date(l.unsigned_at)) === month
      )
      .map((l) => l.id);

    if (ids.length > 0) {
      await supabase.from("banish_logs").delete().in("id", ids);
    }

    const ban = activeBanFor(key, bans);
    if (ban) {
      await supabase.from("signup_bans").update({ lifted: true }).eq("id", ban.id);
    }

    await reload();
  }

  const myKey = discordId || "";

  return {
    logs,
    bans,
    myHearts: myKey ? heartsFor(myKey, logs) : MAX_HEARTS,
    myBan: myKey ? activeBanFor(myKey, bans) : null,
    logsForRun,
    heartsOfPlayer,
    banOf,
    roster,
    takeHeart,
    claimHeart,
    markNoShow,
    clearNoShow,
    giveHeartBack,
    clearRunUnsign,
    liftBan,
    giveHeartTo,
    clearPlayer,
    reload,
  };
}

/* ============================================================
   4. HEARTS BAR — floats directly above the chat button
============================================================ */

/** Keyframes can't live in inline styles, so they're injected once. */
function HeartStyles() {
  return (
    <style>{`
      @keyframes heartBeat {
        0%, 100% { transform: scale(1); }
        18%      { transform: scale(1.18); }
        36%      { transform: scale(1); }
      }
      @keyframes heartBreak {
        0%   { transform: scale(1) rotate(0deg);    opacity: 1; }
        25%  { transform: scale(1.5) rotate(-12deg); opacity: 1; }
        60%  { transform: scale(.7) rotate(14deg);   opacity: .5; }
        100% { transform: scale(1) rotate(0deg);    opacity: 1; }
      }
      /* Outer span owns hover, inner owns the idle beat. Two elements,
         so the two transforms multiply instead of fighting each other. */
      .dw-heart {
        display: inline-block;
        transition: transform .18s ease, filter .18s ease;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        caret-color: transparent;
      }
      .dw-heart:hover {
        transform: scale(1.5);
        filter: brightness(1.45)
                drop-shadow(0 0 16px rgba(255,59,107,1))
                drop-shadow(0 0 34px rgba(255,59,107,.85));
      }
      .dw-heart-inner {
        display: inline-block;
      }
      .dw-heart.filled .dw-heart-inner {
        animation: heartBeat 2.6s ease-in-out infinite;
      }
      .dw-heart.dim { filter: grayscale(100%) brightness(.7); }
      .dw-heart.breaking .dw-heart-inner {
        animation: heartBreak .75s ease-in-out 1;
      }
    `}</style>
  );
}

/**
 * Full-screen heartbreak. Drive it from the page:
 *   <HeartBreak open={breakOpen} onDone={() => setBreakOpen(false)} />
 * Set open to true right after a heart is taken.
 */
export function HeartBreak({
  open,
  onDone,
}: {
  open: boolean;
  onDone?: () => void;
}) {
  // Bumped every time it opens, so the animation restarts on repeats
  // instead of showing once and never again.
  const runs = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    const t = setTimeout(() => onDone?.(), 850);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !mounted) return null;

  runs.current += 1;

  // Rendered straight into <body> so run cards can't stack over it.
  return createPortal(
    <>
      <HeartStyles />
      <HeartBreakArt key={runs.current} />
    </>,
    document.body
  );
}

function HeartBreakArt() {
  return (
    <div style={brk.overlay}>
      <span style={brk.bigHeart}>💔</span>
    </div>
  );
}

export function HeartsBar({
  hearts,
  ban,
}: {
  hearts: number;
  ban?: SignupBan | null;
}) {
  const banned = !!ban;

  // Watches for the count dropping so the loss can be shown.
  // prev lives in a ref: if it were state, updating it would re-run this
  // effect, the cleanup would kill the timer, and the broken heart would
  // stay on screen forever.
  const prev = useRef(hearts);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    if (hearts < prev.current) {
      prev.current = hearts;
      setLost(true);

      const t = setTimeout(() => setLost(false), 900);
      return () => clearTimeout(t);
    }

    prev.current = hearts;
  }, [hearts]);

  // Hearts empty from the TOP down, so the filled ones sit at the bottom.
  const firstFilled = MAX_HEARTS - hearts;

  return (
    <div style={hb.wrap}>
      <HeartStyles />

      <div style={hb.stack}>
        {Array.from({ length: MAX_HEARTS }, (_, i) => (
          <Heart
            key={i}
            filled={i >= firstFilled}
            breaking={lost && i === firstFilled - 1}
          />
        ))}
      </div>

      <div
        style={{
          ...hb.count,
          color: hearts === 0 ? "#ef4444" : hearts <= 2 ? "#facc15" : "#ff8fb0",
        }}
      >
        {hearts} / {MAX_HEARTS}
      </div>

      <div style={hb.label}>
        {new Date().toLocaleDateString("en-GB", { month: "long" })}
        <br />
        hearts
      </div>

      {banned && (
        <div style={hb.locked}>
          Locked {daysUntil(ban!.banned_until)}d
        </div>
      )}
    </div>
  );
}

/* ============================================================
   5. ROSTER BUTTON — round icon + panel.
   Everyone can look. Only admins get the + and ✕ buttons.
============================================================ */
export function HeartsRosterButton({
  roster = [],
  isAdmin = false,
  onGiveHeart,
  onClearPlayer,
}: {
  roster?: { key: string; name: string; hearts: number; ban: SignupBan | null }[];
  isAdmin?: boolean;
  onGiveHeart?: (key: string) => void;
  onClearPlayer?: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <HeartStyles />

      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Monthly hearts"
          style={hb.roundBtn}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          ♥
        </button>
      )}

      {open && (
        <div style={hb.rosterBox}>
          <button onClick={() => setOpen(false)} style={hb.rosterClose}>
            ×
          </button>

          <div style={hb.rosterTitle}>♥ HEARTS</div>

          <div style={hb.rosterSub}>
            {new Date().toLocaleDateString("en-GB", { month: "long" })} •{" "}
            {roster.length} player{roster.length === 1 ? "" : "s"}
          </div>

          <div style={hb.rosterScroll}>
            {roster.length === 0 && (
              <div style={hb.empty}>Nobody has lost a heart this month.</div>
            )}

            {roster.map((row) => (
              <div
                key={row.key}
                style={{
                  ...hb.rosterRow,
                  gridTemplateColumns: isAdmin
                    ? "1fr auto 46px auto"
                    : "1fr auto 46px",
                }}
              >
                <b style={hb.rosterName} title={row.name}>
                  {row.name}
                </b>

                <div style={{ display: "flex", gap: 3 }}>
                  {Array.from({ length: MAX_HEARTS }, (_, i) => (
                    <Heart
                      key={i}
                      filled={i >= MAX_HEARTS - row.hearts}
                      size={15}
                    />
                  ))}
                </div>

                {row.ban ? (
                  <span
                    style={hb.lockedTag}
                    title={`Locked until ${formatDate(row.ban.banned_until)}`}
                  >
                    {daysUntil(row.ban.banned_until)}d
                  </span>
                ) : (
                  <span style={hb.ok}>ok</span>
                )}

                {isAdmin && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => onGiveHeart?.(row.key)}
                      title="Give one heart back"
                      style={hb.giveBtn}
                      disabled={row.hearts >= MAX_HEARTS}
                    >
                      +
                    </button>

                    <button
                      onClick={() => onClearPlayer?.(row.key)}
                      title="Remove from the list — all hearts back"
                      style={hb.dropBtn}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Heart({
  filled,
  size = 54,
  breaking = false,
}: {
  filled: boolean;
  size?: number;
  breaking?: boolean;
}) {
  return (
    <span
      className={`dw-heart${filled ? " filled" : ""}${
        breaking ? " breaking" : ""
      }`}
      style={{
        fontSize: size,
        lineHeight: 1,
        color: filled ? "#ff3b6b" : "#3a2b4a",
        textShadow: filled
          ? "0 0 14px rgba(255,59,107,.9), 0 0 26px rgba(255,59,107,.45)"
          : "0 0 8px rgba(0,0,0,.8)",
        opacity: filled || breaking ? 1 : 0.55,
      }}
    >
      <span className="dw-heart-inner">
        {breaking ? "💔" : filled ? "♥" : "♡"}
      </span>
    </span>
  );
}

/* ============================================================
   6. UNSIGNED PANEL — the red list beside a run card
============================================================ */
export function UnsignedPanel({
  logs,
  isLeftCard,
  canRemove = false,
  onRemove,
  renderIcon,
  canClaim,
  onClaim,
}: {
  logs: BanishLog[];
  isLeftCard: boolean;
  canRemove?: boolean;
  onRemove?: (log: BanishLog) => void;
  renderIcon?: (player: string) => ReactNode;
  canClaim?: (log: BanishLog) => boolean;
  onClaim?: (log: BanishLog) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  // Ticks the countdown on every card once a second.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (logs.length === 0) return null;
  return (
    <div
      style={{
        ...up.panel,
        left: isLeftCard ? -285 : "auto",
        right: isLeftCard ? "auto" : -285,
      }}
    >
      <div style={up.title}>UNSIGNED ({logs.length})</div>

      {logs.map((log) => {
        const d = new Date(log.unsigned_at);
        const open = hovered === log.id;

        const name = (log.player || "").split(" - ")[0];
        const spec = (log.player || "").split(" - ")[1] || "";

        return (
          <div
            key={log.id}
            onMouseEnter={() => setHovered(log.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              ...up.item,
              transform: open
                ? `scale(1.08) translateX(${isLeftCard ? -6 : 6}px)`
                : "scale(1)",
              borderColor: open ? "rgba(239,68,68,1)" : "rgba(239,68,68,.65)",
              boxShadow: open
                ? "0 0 34px rgba(239,68,68,.85)"
                : "0 0 20px rgba(239,68,68,.45)",
              background: open ? "rgba(24,0,0,.96)" : "rgba(10,0,0,.88)",
              zIndex: open ? 90 : 1,
            }}
          >
            <div
              style={{
                ...up.connector,
                left: isLeftCard ? "auto" : -24,
                right: isLeftCard ? -24 : "auto",
              }}
            />

            <div style={up.iconBox}>{renderIcon ? renderIcon(log.player) : null}</div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={up.name} title={name}>
                {name}
              </div>

              {spec && <div style={up.spec}>{spec}</div>}

              <div style={up.day}>
                {d.toLocaleDateString("en-GB", { weekday: "long" })}
              </div>

              <div style={up.time}>
                {d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })} •{" "}
                {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </div>

              {open && log.run_title && (
                <div style={up.run}>
                  {log.run_title} — #{log.run_id}
                </div>
              )}

              {open && <div style={up.heartNote}>♥ −1 heart</div>}

              {canClaim?.(log) && (() => {
                const total = GRACE_HOURS * 60 * 60 * 1000;
                const left = claimMsLeft(log, now);
                const live = left > 0 && !log.claimed;
                const pct = Math.max(0, Math.min(1, left / total));

                const done = !!log.claimed;

                // Green while claimable, muted green once taken, dark red when dead.
                const stroke = done ? "#4ade80" : live ? "#22c55e" : "#7f1d1d";
                const fill = done ? "#065f46" : live ? "#16a34a" : "#1a0505";
                const glow = done || live ? "rgba(34,197,94,.55)" : "none";

                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (live) onClaim?.(log);
                    }}
                    disabled={!live}
                    title={
                      done
                        ? "Heart already reclaimed"
                        : live
                        ? "Take your heart back"
                        : "The claim window has closed"
                    }
                    style={{
                      ...up.claimHeart,
                      cursor: live ? "pointer" : "default",
                      filter: glow === "none" ? "none" : `drop-shadow(0 0 10px ${glow})`,
                    }}
                    onMouseEnter={(e) => {
                      if (live) e.currentTarget.style.transform = "scale(1.09)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <svg viewBox="0 0 100 92" width="92" height="85">
                      <defs>
                        <clipPath id={`fillclip-${log.id}`}>
                          {/* Drains from the top as the window runs out. */}
                          <rect x="0" y={92 - 92 * (done ? 1 : pct)} width="100" height="92" />
                        </clipPath>
                      </defs>

                      <path
                        d="M50 88 L12 50 C-6 32 4 6 26 6 C38 6 46 13 50 20 C54 13 62 6 74 6 C96 6 106 32 88 50 Z"
                        fill="#0b0b0b"
                        stroke={stroke}
                        strokeWidth="4"
                      />

                      <path
                        d="M50 88 L12 50 C-6 32 4 6 26 6 C38 6 46 13 50 20 C54 13 62 6 74 6 C96 6 106 32 88 50 Z"
                        fill={fill}
                        clipPath={`url(#fillclip-${log.id})`}
                        opacity={done ? 0.75 : 0.9}
                      />

                      <text
                        x="50"
                        y="42"
                        textAnchor="middle"
                        fill={live || done ? "#eafff1" : "#7f1d1d"}
                        fontSize="13"
                        fontWeight="900"
                        letterSpacing="0.5"
                      >
                        {done ? "TAKEN" : live ? "CLAIM" : "CLOSED"}
                      </text>

                      {!done && (
                        <text
                          x="50"
                          y="60"
                          textAnchor="middle"
                          fill={live ? "#bbf7d0" : "#5b1414"}
                          fontSize="11"
                          fontWeight="800"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {live ? formatLeft(left) : "0h 00m"}
                        </text>
                      )}
                    </svg>
                  </button>
                );
              })()}
            </div>

            {canRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove?.(log);
                }}
                title="Remove this record and give the heart back"
                style={{ ...up.remove, opacity: open ? 1 : 0.55 }}
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   7. WARNING POPUP — shown before anything is deleted
============================================================ */
export function UnsignWarningPopup({
  open,
  playerName,
  runTitle,
  hearts,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  playerName: string;
  runTitle?: string;
  hearts: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const after = Math.max(0, hearts - 1);
  const lastOne = after === 0;

  return (
    <div style={pop.overlay} onClick={onCancel}>
      <div style={{ ...pop.box, ...pop.boxBig }} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...pop.icon, ...pop.iconBig }}>♥</div>

        <div style={{ ...pop.title, fontSize: 34 }}>
          {lastOne ? "This is your last heart" : "You will lose a heart"}
        </div>

        {/* Big current-total readout */}
        <div style={pop.totalBox}>
          <div style={pop.totalLabel}>
            {new Date().toLocaleDateString("en-GB", { month: "long" })} hearts
          </div>

          <div
            style={{
              ...pop.totalValue,
              color: hearts === 0 ? "#ef4444" : hearts <= 2 ? "#facc15" : "#ff3b6b",
            }}
          >
            {hearts} <span style={{ fontSize: 30, opacity: .55 }}>/ {MAX_HEARTS}</span>
          </div>
        </div>

        <div style={{ ...pop.text, fontSize: 17 }}>
          Leaving <b style={{ color: "#fff" }}>{runTitle || "this run"}</b> costs{" "}
          <b style={{ color: "#ff8fb0" }}>{playerName}</b> one heart this month.
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 16 }}>
          {Array.from({ length: MAX_HEARTS }, (_, i) => (
            <span
              key={i}
              style={{
                fontSize: 46,
                lineHeight: 1,
                color: i < after ? "#ff3b6b" : "#3a2b4a",
                textShadow: i < after ? "0 0 18px rgba(255,59,107,.85)" : "none",
                opacity: i < hearts ? 1 : 0.4,
              }}
            >
              {i < after ? "♥" : "♡"}
            </span>
          ))}
        </div>

        <div
          style={{
            color: lastOne ? "#ef4444" : "#facc15",
            fontWeight: 900,
            fontSize: 20,
            marginBottom: 16,
          }}
        >
          {hearts} → {after} hearts left
        </div>

        <div style={{ ...pop.claimHint }}>
          Change your mind? You can claim this heart back from the unsigned card
          for up to {GRACE_HOURS}h after you signed.
        </div>

        {lastOne && (
          <div style={{ ...pop.banWarning, fontSize: 16 }}>
            Unsign now and signups lock for {BAN_DAYS} days.
          </div>
        )}

        <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
          <button onClick={onCancel} style={{ ...pop.stay, height: 60, fontSize: 17 }}>
            Stay signed
          </button>

          <button onClick={onConfirm} style={{ ...pop.leave, height: 60, fontSize: 17 }}>
            Unsign anyway
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown when a locked-out player tries to sign. */
export function BannedPopup({
  open,
  bannedUntil,
  onClose,
}: {
  open: boolean;
  bannedUntil?: string | null;
  onClose: () => void;
}) {
  if (!open || !bannedUntil) return null;

  return (
    <div style={pop.overlay} onClick={onClose}>
      <div
        style={{ ...pop.box, border: "1px solid rgba(239,68,68,.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ ...pop.icon, color: "#ef4444", borderColor: "#ef4444" }}>⛔</div>

        <div style={pop.title}>Signups locked</div>

        <div style={pop.text}>
          You used all {MAX_HEARTS} hearts this month. You can sign up again on{" "}
          <b style={{ color: "#fff" }}>{formatDate(bannedUntil)}</b> —{" "}
          {daysUntil(bannedUntil)} days from now.
        </div>

        <button onClick={onClose} style={{ ...pop.stay, width: "100%" }}>
          OK
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   8. PLAYER POPUP — Garrison / Discord DM / Change class
============================================================ */
export type PopupSignup = {
  id: number;
  player: string;
  role: string;
  run_id: number;
  character_id?: number | null;
  avatar_url?: string;
  discord_id?: string;
};

export const CLASS_SPECS: Record<string, string[]> = {
  "Death Knight": ["Blood", "Frost", "Unholy"],
  "Demon Hunter": ["Havoc", "Vengeance"],
  Druid: ["Balance", "Feral", "Guardian", "Restoration"],
  Evoker: ["Devastation", "Preservation", "Augmentation"],
  Hunter: ["Beast Mastery", "Marksmanship", "Survival"],
  Mage: ["Arcane", "Fire", "Frost"],
  Monk: ["Brewmaster", "Mistweaver", "Windwalker"],
  Paladin: ["Holy", "Protection", "Retribution"],
  Priest: ["Discipline", "Holy", "Shadow"],
  Rogue: ["Assassination", "Outlaw", "Subtlety"],
  Shaman: ["Elemental", "Enhancement", "Restoration"],
  Warlock: ["Affliction", "Demonology", "Destruction"],
  Warrior: ["Arms", "Fury", "Protection"],
};

const CLASS_COLORS: Record<string, string> = {
  Druid: "#ff7c0a",
  "Death Knight": "#c41e3a",
  "Demon Hunter": "#a330c9",
  Evoker: "#33937f",
  Hunter: "#aad372",
  Mage: "#3fc7eb",
  Monk: "#00ff98",
  Paladin: "#f48cba",
  Priest: "#ffffff",
  Rogue: "#fff468",
  Shaman: "#0070dd",
  Warlock: "#8788ee",
  Warrior: "#c69b6d",
};

/** 'Xkoy - Arms Warrior' -> { name, spec, className } */
function parsePlayer(player: string) {
  const [name, rest = ""] = player.split(" - ");

  for (const className of Object.keys(CLASS_SPECS)) {
    if (rest.toLowerCase().endsWith(className.toLowerCase())) {
      return {
        name,
        spec: rest.slice(0, rest.length - className.length).trim(),
        className,
      };
    }
  }

  const words = rest.trim().split(" ");

  return {
    name,
    spec: words.slice(0, -1).join(" "),
    className: words[words.length - 1] || "",
  };
}

export function PlayerPopup({
  signup,
  canEditClass = false,
  canChangeCharacter = false,
  onChangeCharacter,
  onClose,
  onChanged,
}: {
  signup: PopupSignup | null;
  canEditClass?: boolean;
  canChangeCharacter?: boolean;
  onChangeCharacter?: (signup: PopupSignup) => void;
  onClose: () => void;
  onChanged?: () => void | Promise<void>;
}) {
  const parsed = signup ? parsePlayer(signup.player) : null;

  const [editing, setEditing] = useState(false);
  const [className, setClassName] = useState("Warrior");
  const [spec, setSpec] = useState("Arms");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEditing(false);
    setError("");
  }, [signup?.id]);

  if (!signup || !parsed) return null;

  function openEditor() {
    const p = parsePlayer(signup!.player);
    const cls = CLASS_SPECS[p.className] ? p.className : "Warrior";

    setClassName(cls);
    setSpec(CLASS_SPECS[cls].includes(p.spec) ? p.spec : CLASS_SPECS[cls][0]);
    setError("");
    setEditing(true);
  }

  async function saveClass() {
    if (!signup) return;

    setSaving(true);
    setError("");

    const nextPlayer = `${parsed!.name} - ${spec} ${className}`;

    const { error: signupError } = await supabase
      .from("signups")
      .update({ player: nextPlayer })
      .eq("id", signup.id);

    if (signupError) {
      setSaving(false);
      setError(signupError.message);
      return;
    }

    if (signup.character_id) {
      await supabase
        .from("characters")
        .update({ class: className, spec })
        .eq("id", signup.character_id);
    }

    setSaving(false);
    setEditing(false);
    await onChanged?.();
    onClose();
  }

  const accent = CLASS_COLORS[editing ? className : parsed.className] || "#c084fc";

  return (
    <div style={pp.overlay} onClick={onClose}>
      <div style={pp.panel} onClick={(e) => e.stopPropagation()}>
        <div style={pp.top}>
          <button onClick={onClose} style={pp.close} aria-label="Close">
            ✕
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img
              src={
                signup.avatar_url ||
                "https://cdn.discordapp.com/embed/avatars/0.png"
              }
              alt=""
              style={pp.avatar}
            />

            <div>
              <div style={pp.name}>{parsed.name}</div>
              <div style={{ ...pp.sub, color: accent }}>
                {parsed.spec} {parsed.className || "—"}
              </div>
            </div>
          </div>
        </div>

        {!editing ? (
          <div style={pp.actions}>
            <CharacterInfoCard signup={signup} />

            <ActionButton
              icon="🏰"
              from="#c084fc"
              to="#7c3aed"
              glow="rgba(168,85,247,"
              title="View Garrison"
              subtitle="Characters, mains and progress."
              onClick={() =>
                window.open(`/profile?characterId=${signup.character_id}`, "_blank")
              }
            />

            <ActionButton
              icon="💬"
              from="#60a5fa"
              to="#2563eb"
              glow="rgba(96,165,250,"
              title="Open Discord DM"
              subtitle="Message this booster directly."
              onClick={() =>
                window.open(`discord://-/users/${signup.discord_id}`, "_blank")
              }
            />

            {canChangeCharacter && (
              <ActionButton
                icon="🔄"
                from="#34d399"
                to="#047857"
                glow="rgba(52,211,153,"
                title="Change character"
                subtitle="Swap which of your characters is signed."
                onClick={() => {
                  onChangeCharacter?.(signup);
                  onClose();
                }}
              />
            )}

            {canChangeCharacter && (
              <ActionButton
                icon="🔄"
                from="#34d399"
                to="#047857"
                glow="rgba(52,211,153,"
                title="Change character"
                subtitle="Swap which of your characters is signed."
                onClick={() => {
                  onChangeCharacter?.(signup);
                  onClose();
                }}
              />
            )}

            {canEditClass && (
              <ActionButton
                icon="⚔"
                from="#fbbf24"
                to="#b45309"
                glow="rgba(250,204,21,"
                title="Change class"
                subtitle="Swap the class and spec on this signup."
                onClick={openEditor}
              />
            )}
          </div>
        ) : (
          <div style={pp.actions}>
            <div style={pp.fieldLabel}>Class</div>
            <select
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                setSpec(CLASS_SPECS[e.target.value][0]);
              }}
              style={{ ...pp.input, color: accent }}
            >
              {Object.keys(CLASS_SPECS).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div style={pp.fieldLabel}>Spec</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CLASS_SPECS[className].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpec(s)}
                  style={{
                    ...pp.chip,
                    borderColor: spec === s ? accent : "rgba(168,85,247,.3)",
                    background:
                      spec === s
                        ? "linear-gradient(180deg,#9333ea,#6b21a8)"
                        : "rgba(255,255,255,.05)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div style={pp.preview}>
              {parsed.name} —{" "}
              <b style={{ color: accent }}>
                {spec} {className}
              </b>
            </div>

            {error && <div style={pp.error}>{error}</div>}

            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <button onClick={() => setEditing(false)} style={pp.cancel}>
                Cancel
              </button>

              <button
                onClick={saveClass}
                disabled={saving}
                style={{ ...pp.save, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "Saving…" : "Save class"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  from,
  to,
  glow,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  from: string;
  to: string;
  glow: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-3px) scale(1.03)";
        e.currentTarget.style.boxShadow = `0 0 28px ${glow}.55)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.boxShadow = `0 0 12px ${glow}.25)`;
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: 18,
        borderRadius: 18,
        border: `1px solid ${glow}.4)`,
        background: `linear-gradient(90deg, ${glow}.22), ${glow}.06))`,
        cursor: "pointer",
        transition: "transform .22s ease, box-shadow .22s ease",
        boxShadow: `0 0 12px ${glow}.25)`,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          flexShrink: 0,
          background: `linear-gradient(180deg,${from},${to})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          color: "white",
          boxShadow: `0 0 18px ${glow}.45)`,
        }}
      >
        {icon}
      </div>

      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "white" }}>{title}</div>
        <div style={{ marginTop: 4, color: "#d8b4fe", fontSize: 13 }}>{subtitle}</div>
      </div>
    </button>
  );
}

/* ============================================================
   9. Styles
============================================================ */
const hb: Record<string, React.CSSProperties> = {
  // Sits directly above the chat button. Same 62px width, no panel.
  wrap: {
    position: "fixed",
    right: 18,
    width: 96,
    bottom: 195,
    zIndex: 999,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
  },
  label: {
    color: "#ff8fb0",
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 1.3,
    textShadow: "0 0 10px rgba(0,0,0,.9), 0 0 16px rgba(255,59,107,.5)",
  },
  count: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: 1,
    textAlign: "center",
    textShadow: "0 0 10px rgba(0,0,0,.9)",
  },
  locked: {
    color: "#fca5a5",
    fontSize: 10,
    fontWeight: 900,
    textShadow: "0 0 10px rgba(0,0,0,.9)",
  },

  // Round button that replaces the old banish icon.
  roundBtn: {
    position: "fixed",
    left: 24,
    bottom: 105,
    width: 62,
    height: 62,
    borderRadius: "50%",
    border: "1px solid rgba(255,59,107,.7)",
    background: "linear-gradient(135deg,#7f1d3a,#ff3b6b)",
    color: "white",
    fontSize: 28,
    lineHeight: 1,
    cursor: "pointer",
    zIndex: 999,
    boxShadow: "0 0 24px rgba(255,59,107,.75)",
    transition: "transform .18s ease",
  },

  rosterBox: {
    position: "fixed",
    left: 20,
    top: 120,
    width: 400,
    maxHeight: "72vh",
    display: "flex",
    flexDirection: "column",
    padding: 18,
    borderRadius: 18,
    background: "rgba(14,0,10,.94)",
    border: "1px solid rgba(255,59,107,.45)",
    boxShadow: "0 0 30px rgba(255,59,107,.35)",
    backdropFilter: "blur(12px)",
    zIndex: 999,
  },
  rosterClose: {
    position: "absolute",
    top: 10,
    right: 12,
    background: "transparent",
    border: "none",
    color: "white",
    fontSize: 22,
    cursor: "pointer",
  },
  rosterTitle: {
    color: "#ff8fb0",
    fontWeight: 900,
    fontSize: 22,
    textAlign: "center",
    marginBottom: 4,
    letterSpacing: 2,
    textShadow: "0 0 14px rgba(255,59,107,.7)",
  },
  rosterSub: {
    color: "#9ca3af",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 14,
  },
  rosterScroll: {
    overflowY: "auto",
    minHeight: 0,
  },
  rosterRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 46px",
    alignItems: "center",
    gap: 10,
    padding: "9px 10px",
    marginBottom: 6,
    borderRadius: 10,
    background: "rgba(0,0,0,.4)",
    border: "1px solid rgba(255,59,107,.18)",
  },
  rosterName: {
    color: "#fff",
    fontSize: 14,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ok: {
    textAlign: "center",
    color: "#22c55e",
    fontSize: 12,
    fontWeight: 900,
  },
  lockedTag: {
    textAlign: "center",
    color: "#ef4444",
    fontSize: 12,
    fontWeight: 900,
  },
  empty: {
    color: "#9ca3af",
    textAlign: "center",
    padding: 14,
    fontSize: 14,
  },
  giveBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    border: "1px solid rgba(34,197,94,.6)",
    background: "rgba(4,40,20,.8)",
    color: "#86efac",
    fontWeight: 900,
    fontSize: 15,
    lineHeight: 1,
    cursor: "pointer",
  },
  dropBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    border: "1px solid rgba(239,68,68,.6)",
    background: "rgba(50,0,0,.8)",
    color: "#fecaca",
    fontWeight: 900,
    fontSize: 13,
    lineHeight: 1,
    cursor: "pointer",
  },
};

/* Full-screen heartbreak */
const brk: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000001,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    caretColor: "transparent",
  },
  // Same wobble as the small hearts, just much larger.
  bigHeart: {
    fontSize: 300,
    lineHeight: 1,
    animation: "heartBreak .75s ease-in-out 1",
  },
};

const up: Record<string, React.CSSProperties> = {
  panel: { position: "absolute", top: 58, width: 245, zIndex: 80, pointerEvents: "auto" },
  title: {
    color: "#ff4040",
    fontSize: 16,
    fontWeight: 900,
    marginBottom: 12,
    letterSpacing: 1,
    textShadow: "0 0 12px rgba(239,68,68,.9)",
  },
  item: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,.65)",
    backdropFilter: "blur(8px)",
    transition: "transform .2s ease, box-shadow .2s ease, background .2s ease",
    cursor: "default",
  },
  connector: {
    position: "absolute",
    top: "50%",
    width: 24,
    height: 3,
    borderRadius: 999,
    background: "#ef4444",
    transform: "translateY(-50%)",
    boxShadow: "0 0 12px rgba(239,68,68,.9)",
  },
  iconBox: {
    width: 46,
    height: 46,
    minWidth: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transform: "scale(1.35)",
  },
  name: {
    color: "#fff",
    fontWeight: 900,
    fontSize: 16,
    lineHeight: 1.1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  spec: { color: "#c084fc", fontWeight: 800, fontSize: 12, marginTop: 4 },
  day: {
    marginTop: 5,
    color: "#fca5a5",
    fontWeight: 900,
    fontSize: 13,
    textShadow: "0 0 10px rgba(239,68,68,.6)",
  },
  time: { color: "#9ca3af", fontSize: 11, marginTop: 2 },
  run: {
    marginTop: 6,
    color: "#d8b4fe",
    fontSize: 11,
    fontWeight: 700,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  heartNote: {
    marginTop: 6,
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: 999,
    background: "rgba(255,59,107,.16)",
    border: "1px solid rgba(255,59,107,.55)",
    color: "#ff8fb0",
    fontSize: 11,
    fontWeight: 900,
  },
  claimHeart: {
    marginTop: 8,
    padding: 0,
    border: "none",
    background: "transparent",
    lineHeight: 0,
    display: "block",
    transition: "transform .18s ease, filter .18s ease",
  },
  claimOn: {
    border: "1px solid rgba(34,197,94,.9)",
    background: "linear-gradient(180deg, rgba(6,60,32,.95), rgba(2,20,10,.98))",
    color: "#4ade80",
    textShadow: "0 0 12px rgba(34,197,94,.9)",
    boxShadow: "0 0 18px rgba(34,197,94,.5), inset 0 0 14px rgba(34,197,94,.2)",
  },
  claimOff: {
    border: "1px solid rgba(239,68,68,.5)",
    background: "linear-gradient(180deg, rgba(30,0,0,.95), #070707)",
    color: "#7f1d1d",
    textShadow: "none",
    boxShadow: "none",
    cursor: "not-allowed",
  },
  claimDone: {
    border: "1px solid rgba(34,197,94,.35)",
    background: "rgba(4,30,16,.7)",
    color: "#86efac",
    cursor: "default",
  },
  remove: {
    width: 28,
    height: 28,
    flexShrink: 0,
    alignSelf: "flex-start",
    borderRadius: 8,
    border: "1px solid rgba(239,68,68,.6)",
    background: "rgba(70,0,0,.7)",
    color: "#fecaca",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    transition: "all .18s ease",
  },
};

const pop: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.72)",
    backdropFilter: "blur(6px)",
    zIndex: 1000000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  box: {
    width: 460,
    maxWidth: "94vw",
    padding: "30px 30px 26px",
    borderRadius: 20,
    border: "1px solid rgba(255,59,107,.55)",
    background: "linear-gradient(180deg, rgba(26,4,16,.98), rgba(6,0,14,.98))",
    boxShadow: "0 0 45px rgba(0,0,0,.9), 0 0 28px rgba(255,59,107,.35)",
    textAlign: "center",
  },
  icon: {
    width: 62,
    height: 62,
    margin: "0 auto 18px",
    borderRadius: "50%",
    border: "3px solid #ff3b6b",
    color: "#ff3b6b",
    fontSize: 32,
    lineHeight: "56px",
    fontWeight: 900,
    textShadow: "0 0 18px rgba(255,59,107,.9)",
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: 900,
    marginBottom: 12,
    fontFamily: "Georgia, serif",
    letterSpacing: 1,
  },
  text: { color: "#e5d9f5", fontSize: 15, lineHeight: 1.6, marginBottom: 18 },
  boxBig: {
    width: 620,
    padding: "40px 44px 34px",
  },
  iconBig: {
    width: 84,
    height: 84,
    fontSize: 44,
    lineHeight: "76px",
    marginBottom: 20,
  },
  totalBox: {
    margin: "0 auto 20px",
    padding: "12px 26px",
    display: "inline-block",
    borderRadius: 16,
    background: "rgba(255,59,107,.10)",
    border: "1px solid rgba(255,59,107,.4)",
  },
  totalLabel: {
    color: "#d8b4fe",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  totalValue: {
    marginTop: 2,
    fontSize: 52,
    fontWeight: 900,
    lineHeight: 1.1,
    textShadow: "0 0 20px rgba(255,59,107,.5)",
  },
  claimHint: {
    margin: "0 0 16px",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(34,197,94,.45)",
    background: "rgba(4,40,20,.45)",
    color: "#bbf7d0",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  banWarning: {
    margin: "0 0 18px",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,.55)",
    background: "rgba(70,0,0,.4)",
    color: "#fecaca",
    fontWeight: 800,
    fontSize: 14,
  },
  stay: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    border: "1px solid rgba(168,85,247,.5)",
    background: "rgba(20,10,35,.9)",
    color: "#e9d5ff",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  },
  leave: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg,#dc2626,#ef4444)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 0 20px rgba(239,68,68,.5)",
  },
};

const pp: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.65)",
    zIndex: 999999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  panel: {
    width: 520,
    maxWidth: "95vw",
    maxHeight: "92vh",
    overflowY: "auto",
    borderRadius: 26,
    position: "relative",
    background: "linear-gradient(180deg, rgba(10,10,25,.98), rgba(5,5,15,.98))",
    border: "1px solid rgba(168,85,247,.45)",
    boxShadow: "0 0 60px rgba(168,85,247,.35)",
    backdropFilter: "blur(18px)",
  },
  top: {
    position: "relative",
    padding: "34px 28px 24px",
    borderBottom: "1px solid rgba(168,85,247,.22)",
    background: "linear-gradient(180deg, rgba(168,85,247,.16), rgba(0,0,0,0))",
  },
  close: {
    position: "absolute",
    right: 18,
    top: 18,
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,.45)",
    background: "linear-gradient(180deg,#7f1d1d,#450a0a)",
    color: "white",
    fontSize: 16,
    fontWeight: 900,
    cursor: "pointer",
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid rgba(168,85,247,.75)",
    boxShadow: "0 0 30px rgba(168,85,247,.55)",
    background: "#111",
  },
  name: {
    fontSize: 36,
    fontWeight: 900,
    color: "white",
    textShadow: "0 0 18px rgba(168,85,247,.6)",
  },
  sub: { marginTop: 6, fontSize: 15, fontWeight: 800, letterSpacing: 1 },
  actions: { padding: 24, display: "flex", flexDirection: "column", gap: 14 },
  fieldLabel: {
    color: "#c084fc",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid rgba(168,85,247,.35)",
    background: "rgba(15,4,32,.9)",
    color: "white",
    fontWeight: 800,
    fontSize: 16,
    outline: "none",
  },
  chip: {
    padding: "10px 15px",
    borderRadius: 10,
    border: "1px solid rgba(168,85,247,.3)",
    color: "white",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },
  preview: {
    marginTop: 8,
    padding: "10px 14px",
    borderRadius: 10,
    background: "rgba(255,255,255,.04)",
    border: "1px solid rgba(168,85,247,.2)",
    color: "#e5d9f5",
    fontSize: 15,
  },
  error: {
    marginTop: 10,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(239,68,68,.45)",
    background: "rgba(70,0,0,.35)",
    color: "#fecaca",
    fontWeight: 700,
    fontSize: 14,
  },
  cancel: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.2)",
    background: "rgba(255,255,255,.06)",
    color: "white",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  },
  save: {
    flex: 1.4,
    height: 50,
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg,#facc15,#a66a1f)",
    color: "#160b02",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 0 22px rgba(250,204,21,.45)",
  },
};
