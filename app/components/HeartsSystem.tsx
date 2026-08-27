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

import { ReactNode, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ============================================================
   1. SETTINGS — change these numbers, nothing else.
============================================================ */
export const MAX_HEARTS = 5;
export const BAN_DAYS = 14;
export const FREE_ROLES = ["Bench", "Loot Body"]; // unsigning these costs nothing
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

function heartsLostFor(key: string, logs: BanishLog[]) {
  const month = monthKey();
  return logs.filter(
    (log) =>
      playerKey(log) === key && monthKey(new Date(log.unsigned_at)) === month
  ).length;
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

      entry.hearts = Math.max(0, entry.hearts - 1);
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
  }) {
    const key = playerKey({ discord_id: input.discordId, player: input.player });
    const now = new Date();

    const { error } = await supabase.from("banish_logs").insert({
      player: input.player,
      discord_id: input.discordId || null,
      run_id: input.runId,
      run_title: input.runTitle || null,
      week: input.week ?? null,
      unsigned_at: now.toISOString(),
    });

    if (error) return { ok: false as const, message: error.message };

    const heartsLeft = Math.max(0, MAX_HEARTS - (heartsLostFor(key, logs) + 1));

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

  /** Player signed back into a run — clear their card for it. */
  async function clearRunUnsign(input: {
    runId: number;
    discordId?: string | null;
    characterName?: string | null;
  }) {
    if (!RESTORE_HEART_ON_RESIGN) return;

    let query = supabase.from("banish_logs").delete().eq("run_id", input.runId);

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
    giveHeartBack,
    clearRunUnsign,
    liftBan,
    reload,
  };
}

/* ============================================================
   4. HEARTS BAR — floats directly above the chat button
============================================================ */
export function HeartsBar({
  hearts,
  ban,
}: {
  hearts: number;
  ban?: SignupBan | null;
}) {
  const banned = !!ban;

  return (
    <div style={hb.wrap}>
      {/* hearts stack on top */}
      <div style={hb.stack}>
        {Array.from({ length: MAX_HEARTS }, (_, i) => (
          <Heart key={i} filled={i < hearts} />
        ))}
      </div>

      {/* count under the hearts */}
      <div
        style={{
          ...hb.count,
          color: hearts === 0 ? "#ef4444" : hearts <= 2 ? "#facc15" : "#ff8fb0",
        }}
      >
        {hearts} / {MAX_HEARTS}
      </div>

      {/* month label at the bottom */}
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
   5. ROSTER BUTTON — round icon + panel, visible to everyone.
   Read only: nobody can change hearts or lift bans from here.
============================================================ */
export function HeartsRosterButton({
  roster = [],
}: {
  roster?: { key: string; name: string; hearts: number; ban: SignupBan | null }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
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
              <div key={row.key} style={hb.rosterRow}>
                <b style={hb.rosterName} title={row.name}>
                  {row.name}
                </b>

                <div style={{ display: "flex", gap: 3 }}>
                  {Array.from({ length: MAX_HEARTS }, (_, i) => (
                    <Heart key={i} filled={i < row.hearts} size={15} />
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
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Heart({ filled, size = 26 }: { filled: boolean; size?: number }) {
  return (
    <span
      style={{
        fontSize: size,
        lineHeight: 1,
        color: filled ? "#ff3b6b" : "#3a2b4a",
        textShadow: filled ? "0 0 14px rgba(255,59,107,.9)" : "none",
        opacity: filled ? 1 : 0.55,
      }}
    >
      {filled ? "♥" : "♡"}
    </span>
  );
}

/* ============================================================
   5. UNSIGNED PANEL — the red list beside a run card
============================================================ */
export function UnsignedPanel({
  logs,
  isLeftCard,
  canRemove = false,
  onRemove,
  renderIcon,
}: {
  logs: BanishLog[];
  isLeftCard: boolean;
  canRemove?: boolean;
  onRemove?: (log: BanishLog) => void;
  renderIcon?: (player: string) => ReactNode;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

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
   6. WARNING POPUP — shown before anything is deleted
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
      <div style={pop.box} onClick={(e) => e.stopPropagation()}>
        <div style={pop.icon}>♥</div>

        <div style={pop.title}>
          {lastOne ? "This is your last heart" : "You will lose a heart"}
        </div>

        <div style={pop.text}>
          Leaving <b style={{ color: "#fff" }}>{runTitle || "this run"}</b> costs{" "}
          <b style={{ color: "#ff8fb0" }}>{playerName}</b> one heart this month.
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 12 }}>
          {Array.from({ length: MAX_HEARTS }, (_, i) => (
            <span
              key={i}
              style={{
                fontSize: 30,
                lineHeight: 1,
                color: i < after ? "#ff3b6b" : "#3a2b4a",
                textShadow: i < after ? "0 0 14px rgba(255,59,107,.85)" : "none",
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
            fontSize: 15,
            marginBottom: 12,
          }}
        >
          {hearts} → {after} hearts left
        </div>

        {lastOne && (
          <div style={pop.banWarning}>
            Unsign now and signups lock for {BAN_DAYS} days.
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <button onClick={onCancel} style={pop.stay}>
            Stay signed
          </button>

          <button onClick={onConfirm} style={pop.leave}>
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
   7. PLAYER POPUP — Garrison / Discord DM / Change class
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
  onClose,
  onChanged,
}: {
  signup: PopupSignup | null;
  canEditClass?: boolean;
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
   8. Styles
============================================================ */
const hb: Record<string, React.CSSProperties> = {
  // Sits directly above the chat button. Same 62px width, no panel.
  wrap: {
    position: "fixed",
    right: 24,
    width: 62,
    bottom: 180,
    zIndex: 999,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    pointerEvents: "none",
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  },
  label: {
    color: "#ff8fb0",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 1.3,
    textShadow: "0 0 10px rgba(0,0,0,.9), 0 0 16px rgba(255,59,107,.5)",
  },
  count: {
    fontSize: 16,
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
