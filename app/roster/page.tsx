"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import GuildAccessGuard from "@/app/components/GuildAccessGuard";
type Character = {
  id: string;
  user_id: string;
  name: string;
  realm: string;
  ilvl: number;
  class: string;
  spec: string;
  progress?: string;
  mythic_plus_score?: number;
  mythic_plus_color?: string;
  avatar_url?: string;
  is_main?: boolean;
};

type Profile = {
  user_id: string;
  discord_name?: string;
  avatar_url?: string;
  site_role?: string;
};

type RosterUser = {
  user_id: string;
  profile?: Profile;
  characters: Character[];
  main?: Character;
};

const classColors: Record<string, string> = {
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

const tankSpecs = ["Blood", "Protection", "Guardian", "Brewmaster", "Vengeance"];
const healerSpecs = ["Restoration", "Holy", "Discipline", "Mistweaver", "Preservation"];

const meleeSpecs = [
  "Havoc",
  "Feral",
  "Windwalker",
  "Retribution",
  "Enhancement",
  "Assassination",
  "Outlaw",
  "Subtlety",
  "Arms",
  "Fury",
  "Frost",
  "Unholy",
  "Survival",
];

function roleOf(c?: Character) {
  if (!c) return "range";
  if (tankSpecs.includes(c.spec)) return "tank";
  if (healerSpecs.includes(c.spec)) return "healer";
  if (meleeSpecs.includes(c.spec)) return "melee";
  return "range";
}

function colorOf(className?: string) {
  return classColors[className || ""] || "#a855f7";
}
function UserCard({ user }: { user: RosterUser }) {
  const main = user.main || user.characters[0];
  const color = colorOf(main?.class);
  const chars = user.characters.slice(0, 2);

  return (
    <div style={{ textAlign: "center", width: 220 }}>
      <div
        style={{
          width: 145,
          height: 145,
          margin: "0 auto 10px",
          borderRadius: "50%",
          padding: 5,
          border: `3px solid ${color}`,
          boxShadow: `0 0 28px ${color}`,
          position: "relative",
          background: "#020006",
          transition: "all .25s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <img
          src={user.profile?.avatar_url || main?.avatar_url || "/default-avatar.png"}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />

        <span
          style={{
            position: "absolute",
            right: 10,
            bottom: 12,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#22c55e",
            border: "2px solid #020006",
            boxShadow: "0 0 10px #22c55e",
          }}
        />
      </div>

      <div
        style={{
          color,
          fontSize: 20,
          fontWeight: 900,
          marginBottom: 12,
          textShadow: `0 0 12px ${color}`,
        }}
      >
        {user.profile?.discord_name || main?.name || "Unknown"} {main?.is_main ? "👑" : ""}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}
      >
        {chars.map((c) => {
          const rioUrl = `https://raider.io/characters/eu/${encodeURIComponent(
            c.realm
          )}/${encodeURIComponent(c.name)}`;

          return (
            <a
              key={c.id}
              href={rioUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: "none",
          background: "rgba(5,0,18,.92)",
border: `1px solid ${colorOf(c.class)}55`,
                borderRadius: 10,
                padding: 8,
                boxShadow: `0 0 12px ${colorOf(c.class)}33`,
                transition: "all .22s ease",
                display: "block",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.16)";
                e.currentTarget.style.boxShadow = `0 0 24px ${colorOf(c.class)}aa`;
                e.currentTarget.style.border = `1px solid ${colorOf(c.class)}`;
                e.currentTarget.style.zIndex = "20";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = "0 0 14px rgba(0,0,0,.75)";
                e.currentTarget.style.border = "1px solid rgba(255,255,255,.14)";
                e.currentTarget.style.zIndex = "1";
              }}
            >
<img
  src={c.avatar_url || "/default-avatar.png"}
  style={{
    width: 62,
    height: 62,
    borderRadius: "50%",
    objectFit: "cover",
    objectPosition: "center center",
    display: "block",
    margin: "0 auto 6px",
    border: `2px solid ${colorOf(c.class)}`,
    boxShadow: `0 0 12px ${colorOf(c.class)}`,
  }}
/>

              <div
                style={{
                  color: colorOf(c.class),
                  fontSize: 13,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c.name}
              </div>

              <div style={{ color: "#ddd6fe", fontSize: 12, lineHeight: 1.35 }}>
                ilvl {c.ilvl || "-"}
              </div>

              <div style={{ color: "#ddd6fe", fontSize: 12, lineHeight: 1.35 }}>
                {c.mythic_plus_score || 0}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}


function Section({
  title,
  icon,
  users,
  limit,
  color,
}: {
  title: string;
  icon: string;
  users: RosterUser[];
  limit?: number;
  color: string;
}) {
  return (
    <section
      style={{
        border: `1px solid ${color}88`,
        borderRadius: 12,
        padding: 18,
        marginBottom: 16,
        background: "rgba(3,0,12,.78)",
        boxShadow: "inset 0 0 35px rgba(0,0,0,.85), 0 0 25px rgba(168,85,247,.18)",
        minHeight: 260,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          marginBottom: 24,
          color,
          fontFamily: "Georgia, serif",
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: 2,
          textShadow: "0 0 12px currentColor",
        }}
      >
        <span style={{ width: 110, height: 1, background: color, opacity: 0.6 }} />
        <span>{icon}</span>
        <span>
          {title} ({users.length}
          {limit ? `/${limit}` : ""})
        </span>
        <span style={{ width: 110, height: 1, background: color, opacity: 0.6 }} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          gap: "26px 18px",
          justifyItems: "center",
        }}
      >
        {users.map((u) => (
          <UserCard key={u.user_id} user={u} />
        ))}
      </div>
    </section>
  );
}

export default function RosterPage() {
  const [users, setUsers] = useState<RosterUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoster();
  }, []);

  async function loadRoster() {
    setLoading(true);

    const { data: chars, error } = await supabase
      .from("guild_characters")
      .select("*")
      .order("is_main", { ascending: false });

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((chars || []).map((c) => c.user_id))];

    let profiles: Profile[] = [];

    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id, discord_name, avatar_url, site_role")
        .in("user_id", userIds);

      profiles = profileData || [];
    }

    const profileMap = new Map<string, Profile>();
    profiles.forEach((p) => profileMap.set(p.user_id, p));

    const grouped = new Map<string, RosterUser>();

    (chars || []).forEach((c) => {
      if (!grouped.has(c.user_id)) {
        grouped.set(c.user_id, {
          user_id: c.user_id,
          profile: profileMap.get(c.user_id),
          characters: [],
        });
      }

      grouped.get(c.user_id)!.characters.push(c);
    });

    const finalUsers = Array.from(grouped.values()).map((u) => ({
      ...u,
      main: u.characters.find((c) => c.is_main) || u.characters[0],
      characters: [...u.characters].sort((a, b) => {
        if (a.is_main) return -1;
        if (b.is_main) return 1;
        return (b.ilvl || 0) - (a.ilvl || 0);
      }),
    }));

    setUsers(finalUsers);
    setLoading(false);
  }

  const grouped = useMemo(() => {
    const tanks: RosterUser[] = [];
    const healers: RosterUser[] = [];
    const range: RosterUser[] = [];
    const melee: RosterUser[] = [];

    users.forEach((u) => {
      const role = roleOf(u.main);

      if (role === "tank") tanks.push(u);
      else if (role === "healer") healers.push(u);
      else if (role === "melee") melee.push(u);
      else range.push(u);
    });

    return { tanks, healers, range, melee };
  }, [users]);

return (
  <GuildAccessGuard>
    <main
      style={{
        minHeight: "100vh",
        backgroundImage: `url("/Roster.png")`,
        backgroundSize: "cover",
        backgroundPosition: "top center",
        backgroundAttachment: "fixed",
        color: "white",
        padding: "70px 20px 40px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "linear-gradient(rgba(5,0,15,.18), rgba(0,0,0,.82))",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1500, margin: "0 auto" }}>
        <header style={{ textAlign: "center", marginBottom: 30 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "Georgia, serif",
              fontSize: 54,
              letterSpacing: 14,
              textShadow: "0 0 28px #a855f7",
            }}
          >
            GUILD ROSTER
          </h1>

          <div style={{ marginTop: 8, color: "#c4b5fd", fontWeight: 800 }}>
            {users.length} Members <span style={{ margin: "0 12px" }}>•</span>
            <span style={{ color: "#22c55e" }}>Online</span>
          </div>
        </header>

        {loading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              border: "1px solid rgba(168,85,247,.5)",
              borderRadius: 14,
              background: "rgba(0,0,0,.65)",
            }}
          >
            Loading roster...
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.4fr",
                gap: 16,
              }}
            >
              <Section title="TANKS" icon="🛡" users={grouped.tanks} limit={2} color="#3b82f6" />
              <Section title="HEALERS" icon="✚" users={grouped.healers} limit={5} color="#22c55e" />
            </div>

            <Section title="RANGE DPS" icon="🏹" users={grouped.range} color="#f97316" />
            <Section title="MELEE DPS" icon="⚔" users={grouped.melee} color="#ef4444" />
          </>
        )}
      </div>
    </main>
  </GuildAccessGuard>
  );
}