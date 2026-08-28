"use client";

/* ============================================================
   EARLY ACCESS — one file.
   Put this at: app/components/EarlyAccess.tsx

   A player can unlock signups 24h early, but it's a bet:
   sign at least MIN_RUNS runs that week, or every signup they
   made gets wiped an hour before signups open for everyone else.

   Requires REQUIRED_CHARACTERS characters in their garrison
   before they're even allowed to take the bet.
============================================================ */

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";

/* ============================================================
   1. SETTINGS — the only numbers you should need to change.
============================================================ */

/** Runs they must be signed to, or everything is cleared. */
export const MIN_RUNS = 10;

/** Characters they must have before they can take the bet. */
export const REQUIRED_CHARACTERS = 10;

/** How long before signups open that the check runs. */
export const CLEAR_BEFORE_HOURS = 1;

/* ============================================================
   2. Types and helpers
============================================================ */
export type EarlyAccessRow = {
  id: number;
  player_key: string;
  discord_id?: string | null;
  player?: string | null;
  week: number;
  unlocked_at: string;
  cleared: boolean;
  cleared_at?: string | null;
};

export function accessKey(input: {
  discord_id?: string | null;
  player?: string | null;
}) {
  if (input.discord_id) return input.discord_id;
  return (input.player || "").split(" - ")[0].trim().toLowerCase();
}

/**
 * The moment the bet is settled: one hour before the earliest
 * signup opens that week. Returns 0 when no run has a time set.
 */
export function deadlineForWeek(
  runs: { week?: number | null; signup_open_at?: string | null }[],
  week: number
) {
  const opens = runs
    .filter((r) => Number(r.week) === Number(week) && r.signup_open_at)
    .map((r) => new Date(r.signup_open_at as string).getTime())
    .filter((t) => !Number.isNaN(t));

  if (opens.length === 0) return 0;

  return Math.min(...opens) - CLEAR_BEFORE_HOURS * 60 * 60 * 1000;
}

/* ============================================================
   3. THE HOOK
============================================================ */
export function useEarlyAccess(discordId?: string | null) {
  const [rows, setRows] = useState<EarlyAccessRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from("early_access").select("*");

    if (error) console.error("early_access load failed:", error.message);
    else setRows((data || []) as EarlyAccessRow[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    reload();

    const channel = supabase
      .channel("early-access-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "early_access" },
        () => reload()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  const myKey = discordId || "";

  /** Has this player unlocked early access for the given week? */
  function hasUnlocked(week?: number | null, key = myKey) {
    if (!key || week === null || week === undefined) return false;

    return rows.some(
      (r) => r.player_key === key && Number(r.week) === Number(week)
    );
  }

  /** Everyone who unlocked a given week. */
  function unlockedFor(week: number) {
    return rows.filter((r) => Number(r.week) === Number(week));
  }

  /** Take the bet. */
  async function unlock(input: {
    week: number;
    player?: string | null;
    discordId?: string | null;
  }) {
    const key = accessKey({
      discord_id: input.discordId,
      player: input.player,
    });

    if (!key) return { ok: false as const, message: "No player id." };

    const { error } = await supabase.from("early_access").insert({
      player_key: key,
      discord_id: input.discordId || null,
      player: (input.player || "").split(" - ")[0] || null,
      week: input.week,
    });

    if (error) return { ok: false as const, message: error.message };

    await reload();
    return { ok: true as const };
  }

  /**
   * Settle the bet. Anyone who unlocked this week, is past the
   * deadline, and is short of MIN_RUNS loses every signup they made.
   * Safe to call repeatedly — the cleared flag stops repeats.
   */
  async function enforce(input: {
    week: number;
    deadlineMs: number;
    /** How many runs this player is signed to that week. */
    countSignups: (key: string) => number;
    /** Delete every signup this player has that week. */
    clearSignups: (key: string) => Promise<void>;
  }) {
    if (!input.deadlineMs || Date.now() < input.deadlineMs) return;

    const due = rows.filter(
      (r) => Number(r.week) === Number(input.week) && !r.cleared
    );

    if (due.length === 0) return;

    let changed = false;

    for (const row of due) {
      const signed = input.countSignups(row.player_key);

      if (signed >= MIN_RUNS) {
        // Kept their end of it. Mark settled so we stop checking.
        await supabase
          .from("early_access")
          .update({ cleared: true, cleared_at: new Date().toISOString() })
          .eq("id", row.id);

        changed = true;
        continue;
      }

      await input.clearSignups(row.player_key);

      await supabase
        .from("early_access")
        .update({ cleared: true, cleared_at: new Date().toISOString() })
        .eq("id", row.id);

      changed = true;
    }

    if (changed) await reload();
  }

  return {
    loading,
    rows,
    hasUnlocked,
    unlockedFor,
    unlock,
    enforce,
    reload,
    myUnlocked: (week?: number | null) => hasUnlocked(week),
  };
}

/* ============================================================
   4. THE BUTTON
============================================================ */
function EarlyStyles() {
  return (
    <style>{`
      @keyframes eaPulse {
        0%, 100% { box-shadow: 0 0 14px rgba(250,204,21,.55),
                               inset 0 0 10px rgba(250,204,21,.20); }
        50%      { box-shadow: 0 0 26px rgba(250,204,21,.95),
                               inset 0 0 16px rgba(250,204,21,.35); }
      }
      @keyframes eaShake {
        0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
        12%  { transform: translate(-6px,0) rotate(-3deg); }
        24%  { transform: translate(6px,0) rotate(3deg); }
        36%  { transform: translate(-7px,0) rotate(-4deg); }
        48%  { transform: translate(7px,0) rotate(4deg); }
        60%  { transform: translate(-5px,0) rotate(-3deg); }
        72%  { transform: translate(5px,0) rotate(2deg); opacity: 1; }
        100% { transform: translate(0,-14px) scale(.6); opacity: 0; }
      }
      .ea-btn { animation: eaPulse 2.4s ease-in-out infinite; }
      .ea-btn.going { animation: eaShake .85s ease-in-out forwards; }
    `}</style>
  );
}

export function EarlyAccessButton({
  week,
  discordId,
  playerName,
  characterCount,
  alreadyUnlocked,
  onUnlock,
}: {
  week: number;
  discordId?: string | null;
  playerName?: string | null;
  characterCount: number;
  alreadyUnlocked: boolean;
  onUnlock: (input: {
    week: number;
    discordId?: string | null;
    player?: string | null;
  }) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [going, setGoing] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const eligible = characterCount >= REQUIRED_CHARACTERS;

  async function confirm() {
    if (!eligible || busy) return;

    setBusy(true);
    setError("");

    const result = await onUnlock({ week, discordId, player: playerName });

    setBusy(false);

    if (!result.ok) {
      setError(result.message || "Could not unlock.");
      return;
    }

    // Close the popup, shake the button, then drop it.
    setConfirming(false);
    setGoing(true);
    setTimeout(() => setHidden(true), 850);
  }

  if (alreadyUnlocked || hidden) return null;

  return (
    <>
      <EarlyStyles />

      <button
        className={`ea-btn${going ? " going" : ""}`}
        onClick={() => !going && setConfirming(true)}
        style={ea.button}
      >
        🔓 Unlock Early Access
      </button>

      <ConfirmPopup
        open={confirming}
        week={week}
        eligible={eligible}
        characterCount={characterCount}
        busy={busy}
        error={error}
        onCancel={() => setConfirming(false)}
        onConfirm={confirm}
      />
    </>
  );
}

/** Kept at module level so it isn't rebuilt on every render. */
function ConfirmPopup({
  open,
  week,
  eligible,
  characterCount,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  week: number;
  eligible: boolean;
  characterCount: number;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  return createPortal(
    <div style={ea.overlay} onClick={onCancel}>
      <div style={ea.box} onClick={(e) => e.stopPropagation()}>
        <div style={ea.icon}>{eligible ? "🔓" : "⛔"}</div>

        <div style={ea.title}>
          {eligible ? "Unlock early access?" : "Not enough characters"}
        </div>

        {eligible ? (
          <>
            <div style={ea.text}>
              You get signups <b style={{ color: "#facc15" }}>24 hours early</b>{" "}
              for Week {week}.
            </div>

            <div style={ea.warning}>
              You must be signed to at least <b>{MIN_RUNS} runs</b> before the
              countdown ends.
              <br />
              <br />
              If you are short by then, <b>every signup you made is deleted</b>{" "}
              — one hour before signups open for everyone else.
            </div>

            <div style={ea.meta}>
              Garrison: {characterCount} / {REQUIRED_CHARACTERS} characters ✔
            </div>
          </>
        ) : (
          <>
            <div style={ea.text}>
              Early access needs{" "}
              <b style={{ color: "#facc15" }}>
                {REQUIRED_CHARACTERS} characters
              </b>{" "}
              in your garrison.
            </div>

            <div style={ea.warningRed}>
              You have <b>{characterCount}</b>. Add{" "}
              <b>{Math.max(0, REQUIRED_CHARACTERS - characterCount)}</b> more to
              your garrison, then come back.
            </div>
          </>
        )}

        {error && <div style={ea.error}>{error}</div>}

        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <button onClick={onCancel} style={ea.cancel}>
            Cancel
          </button>

          <button
            onClick={onConfirm}
            disabled={!eligible || busy}
            title={
              eligible ? "Take the bet" : `Needs ${REQUIRED_CHARACTERS} characters`
            }
            style={{
              ...(eligible ? ea.confirm : ea.confirmBlocked),
              opacity: busy ? 0.6 : 1,
              cursor: eligible && !busy ? "pointer" : "not-allowed",
            }}
          >
            {busy ? "Unlocking…" : eligible ? "Confirm" : "Locked"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ============================================================
   5. Styles
============================================================ */
const ea: Record<string, React.CSSProperties> = {
  button: {
    padding: "12px 18px",
    borderRadius: 40,
    border: "1px solid #facc15",
    background:
      "linear-gradient(180deg, rgba(95,60,8,.95), rgba(20,8,0,.98))",
    color: "#fff7cc",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
    whiteSpace: "nowrap",
    position: "relative",
    zIndex: 5,
  },

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
    width: 500,
    maxWidth: "94vw",
    padding: "30px 30px 26px",
    borderRadius: 20,
    border: "1px solid rgba(250,204,21,.5)",
    background:
      "linear-gradient(180deg, rgba(24,16,2,.98), rgba(6,3,0,.98))",
    boxShadow:
      "0 0 45px rgba(0,0,0,.9), 0 0 28px rgba(250,204,21,.28)",
    textAlign: "center",
  },
  icon: {
    fontSize: 46,
    lineHeight: 1,
    marginBottom: 14,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: 900,
    marginBottom: 14,
    fontFamily: "Georgia, serif",
    letterSpacing: 1,
  },
  text: {
    color: "#e8ddc4",
    fontSize: 15,
    lineHeight: 1.6,
    marginBottom: 16,
  },
  warning: {
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,.5)",
    background: "rgba(60,0,0,.4)",
    color: "#fecaca",
    fontSize: 14,
    lineHeight: 1.6,
    textAlign: "left",
  },
  warningRed: {
    padding: "14px 16px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,.65)",
    background: "rgba(70,0,0,.5)",
    color: "#fecaca",
    fontSize: 15,
    lineHeight: 1.6,
  },
  meta: {
    marginTop: 12,
    color: "#86efac",
    fontSize: 13,
    fontWeight: 800,
  },
  error: {
    marginTop: 12,
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
  confirm: {
    flex: 1.4,
    height: 50,
    borderRadius: 12,
    border: "none",
    background: "linear-gradient(90deg,#facc15,#a66a1f)",
    color: "#160b02",
    fontWeight: 900,
    fontSize: 15,
    boxShadow: "0 0 22px rgba(250,204,21,.45)",
  },
  // Red and dead when they don't have the characters.
  confirmBlocked: {
    flex: 1.4,
    height: 50,
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,.7)",
    background: "linear-gradient(90deg,#7f1d1d,#ef4444)",
    color: "#ffe4e6",
    fontWeight: 900,
    fontSize: 15,
    boxShadow: "0 0 22px rgba(239,68,68,.5)",
  },
};
