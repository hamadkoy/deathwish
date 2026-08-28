"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Character = {
  id: number;
  user_id?: string;
  name: string;
  realm: string;
  class: string;
  spec: string;
  ilvl?: number;
  progress?: string;
  mythic_bosses?: string[];
  mythic_plus_score?: number;
  mythic_plus_color?: string;
  avatar_url?: string;
  is_main?: boolean;
};

type SignupLike = {
  player: string;
  character_id?: number | null;
  discord_id?: string | null;
} | null;

export default function CharacterInfoCard({ signup }: { signup: SignupLike }) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [roster, setRoster] = useState<Character[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!signup) {
        setCharacter(null);
        setRoster([]);
        return;
      }

      setLoading(true);
      setCharacter(null);
      setRoster([]);

      let found: Character | null = null;

      // 1. Normal signup: we have the character id
      if (signup.character_id) {
        const { data } = await supabase
          .from("characters")
          .select("*")
          .eq("id", signup.character_id)
          .maybeSingle();

        found = (data as Character) || null;
      }

      // 2. Admin-added signup: fall back to matching the name
      if (!found) {
        const name = (signup.player || "").split(" - ")[0].trim();

        if (name) {
          const { data } = await supabase
            .from("characters")
            .select("*")
            .ilike("name", name)
            .limit(1);

          found = (data?.[0] as Character) || null;
        }
      }

      if (cancelled) return;

      setCharacter(found);

      // 3. Whole garrison, for total experience + best M+ score
      if (found?.user_id) {
        const { data } = await supabase
          .from("characters")
          .select("*")
          .eq("user_id", found.user_id);

        if (!cancelled) setRoster((data as Character[]) || []);
      }

      if (!cancelled) setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [signup?.character_id, signup?.player]);

  if (!signup) return null;

  if (loading) {
    return <div style={emptyBox}>Loading character…</div>;
  }

  if (!character) {
    return (
      <div style={emptyBox}>
        No linked character found for this signup.
      </div>
    );
  }

  const list = roster.length > 0 ? roster : [character];

  const totalExperience = getTotalExperience(list);
  const bestRio = Math.max(
    0,
    ...list.map((c) => Number(c.mythic_plus_score || 0))
  );

  const raiderIoUrl = `https://raider.io/characters/eu/${encodeURIComponent(
    character.realm
  )}/${encodeURIComponent(character.name)}`;

  return (
    <div style={wrap}>
      <div style={headerRow}>
        <img
          src={character.avatar_url || "/icons/warrior-protection.png"}
          alt=""
          style={avatar}
        />

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              ...charName,
              color: getClassColor(character.class),
              textShadow: `0 0 14px ${getClassColor(character.class)}66`,
            }}
          >
            {character.name}
          </div>

          <div style={realmLine}>
            {character.spec} {character.class} • (EU) {character.realm}
          </div>
        </div>

        {character.is_main && <div style={mainTag}>⭐ MAIN</div>}
      </div>

      <div style={statGrid}>
        <Stat
          label="Item level"
          value={String(character.ilvl || 0)}
          color={getIlvlColor(character.ilvl)}
        />

        <Stat
          label="This char"
          value={character.progress || "0/9"}
          color="#f0abfc"
        />

        <Stat label="Raid EXP" value={totalExperience} color="#f0abfc" />

        <Stat
          label="Raider.IO"
          value={String(bestRio)}
          color={character.mythic_plus_color || "#38bdf8"}
        />
      </div>

      {roster.length > 1 && (
        <div style={rosterNote}>
          Garrison totals from {roster.length} characters
        </div>
      )}

      <a href={raiderIoUrl} target="_blank" rel="noreferrer" style={rioButton}>
        Open on Raider.IO
      </a>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div style={statBox}>
      <div style={statLabel}>{label}</div>
      <div style={{ ...statValue, color, textShadow: `0 0 14px ${color}55` }}>
        {value}
      </div>
    </div>
  );
}

// Same rule as the garrison page: unique mythic boss kills across every character.
function getTotalExperience(characters: Character[]) {
  const uniqueBosses = new Set<string>();

  characters.forEach((char) => {
    (char.mythic_bosses || []).forEach((boss) => {
      uniqueBosses.add(boss.toLowerCase().trim());
    });
  });

  if (uniqueBosses.size > 0) return `${uniqueBosses.size}/9M`;

  const bestMythic = Math.max(
    0,
    ...characters.map((char) => {
      const progress = (char.progress || "0/9").toLowerCase();

      if (progress.includes("hc")) return 0;
      if (!progress.includes("m")) return 0;

      return Number(progress.split("/")[0]) || 0;
    })
  );

  return `${bestMythic}/9M`;
}

function getClassColor(className?: string) {
  const colors: Record<string, string> = {
    "Death Knight": "#C41E3A",
    "Demon Hunter": "#A330C9",
    Druid: "#FF7C0A",
    Evoker: "#33937F",
    Hunter: "#AAD372",
    Mage: "#3FC7EB",
    Monk: "#00FF98",
    Paladin: "#F58CBA",
    Priest: "#FFFFFF",
    Rogue: "#FFF468",
    Shaman: "#0070DD",
    Warlock: "#8788EE",
    Warrior: "#C69B6D",
  };

  return colors[className || ""] || "#ffffff";
}

function getIlvlColor(ilvl?: number) {
  if (!ilvl) return "#9ca3af";
  if (ilvl >= 285) return "#ff66ff";
  if (ilvl >= 280) return "#c026d3";
  if (ilvl >= 275) return "#0ea5e9";
  if (ilvl >= 270) return "#22c55e";
  return "#9ca3af";
}

const wrap: React.CSSProperties = {
  margin: "14px 0 4px",
  padding: 16,
  borderRadius: 16,
  background: "rgba(8,4,20,.72)",
  border: "1px solid rgba(168,85,247,.35)",
  boxShadow: "inset 0 0 22px rgba(168,85,247,.10)",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 14,
};

const avatar: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: 12,
  objectFit: "cover",
  border: "1px solid rgba(168,85,247,.5)",
  flexShrink: 0,
};

const charName: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const realmLine: React.CSSProperties = {
  marginTop: 4,
  color: "#c4b5fd",
  fontSize: 12,
  fontWeight: 800,
};

const mainTag: React.CSSProperties = {
  marginLeft: "auto",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  color: "#facc15",
  border: "1px solid rgba(250,204,21,.55)",
  background: "rgba(250,204,21,.10)",
  whiteSpace: "nowrap",
};

const statGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0,1fr))",
  gap: 8,
};

const statBox: React.CSSProperties = {
  padding: "10px 8px",
  borderRadius: 12,
  textAlign: "center",
  background: "rgba(0,0,0,.42)",
  border: "1px solid rgba(168,85,247,.20)",
  minWidth: 0,
};

const statLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 1,
  textTransform: "uppercase",
  color: "#a78bfa",
};

const statValue: React.CSSProperties = {
  marginTop: 4,
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.1,
  whiteSpace: "nowrap",
};

const rosterNote: React.CSSProperties = {
  marginTop: 10,
  fontSize: 11,
  fontWeight: 800,
  color: "#9ca3af",
  textAlign: "center",
};

const rioButton: React.CSSProperties = {
  display: "block",
  marginTop: 14,
  padding: "12px 16px",
  borderRadius: 12,
  textAlign: "center",
  textDecoration: "none",
  color: "white",
  fontWeight: 900,
  fontSize: 14,
  background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  border: "1px solid rgba(255,255,255,.18)",
  boxShadow: "0 0 18px rgba(217,70,239,.45)",
};

const emptyBox: React.CSSProperties = {
  ...wrap,
  color: "#9ca3af",
  fontSize: 13,
  fontWeight: 800,
  textAlign: "center",
};
