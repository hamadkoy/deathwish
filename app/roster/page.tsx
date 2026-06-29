"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import GuildAccessGuard from "@/app/components/GuildAccessGuard";
import { useRouter } from "next/navigation";

type Character = {
  id: string;
  user_id: string;
  name: string;
  realm: string;
  ilvl: number;
  class: string;
  spec: string;
  mythic_plus_score?: number;
  avatar_url?: string;
  is_main?: boolean;
};

type Profile = {
  user_id: string;
  discord_name?: string;
  avatar_url?: string;
  site_role?: string;
  guild_role?: string;
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

function colorOf(className?: string) {
  return classColors[className || ""] || "#a855f7";
}

function roleOf(c?: Character) {
  if (!c) return "range";

  const key = `${c.spec} ${c.class}`;

  const tanks = [
    "Blood Death Knight",
    "Protection Paladin",
    "Protection Warrior",
    "Guardian Druid",
    "Brewmaster Monk",
    "Vengeance Demon Hunter",
  ];

  const healers = [
    "Restoration Druid",
    "Restoration Shaman",
    "Holy Paladin",
    "Holy Priest",
    "Discipline Priest",
    "Mistweaver Monk",
    "Preservation Evoker",
  ];

  const melee = [
    "Havoc Demon Hunter",
    "Feral Druid",
    "Windwalker Monk",
    "Retribution Paladin",
    "Enhancement Shaman",
    "Assassination Rogue",
    "Outlaw Rogue",
    "Subtlety Rogue",
    "Arms Warrior",
    "Fury Warrior",
    "Frost Death Knight",
    "Unholy Death Knight",
    "Survival Hunter",
  ];

  if (tanks.includes(key)) return "tank";
  if (healers.includes(key)) return "healer";
  if (melee.includes(key)) return "melee";
  return "range";
}

function UserCard({ user, compact = false }: { user: RosterUser; compact?: boolean }) {
  const router = useRouter();
  const main = user.main || user.characters[0];
  const color = colorOf(main?.class);
  const chars = user.characters.slice(0, 2);

  return (
    <div
      style={{
        textAlign: "center",
        width: compact ? 165 : 185,
        position: "relative",
      }}
    >
      <div
        onClick={() => router.push(`/guild-garrison?user=${user.user_id}`)}
        title="View Guild Garrison"
        style={{
          width: compact ? 82 : 100,
          height: compact ? 82 : 100,
          margin: "0 auto 7px",
          borderRadius: "50%",
          padding: 4,
          border: `2px solid ${color}`,
          boxShadow: `0 0 18px ${color}`,
          background: "#020006",
          position: "relative",
          cursor: "pointer",
          transition: "all .22s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.08)";
          e.currentTarget.style.boxShadow = `0 0 28px ${color}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = `0 0 18px ${color}`;
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
            right: 5,
            bottom: 7,
            width: 13,
            height: 13,
            borderRadius: "50%",
            background: "#22c55e",
            border: "2px solid #020006",
            boxShadow: "0 0 9px #22c55e",
          }}
        />
      </div>

      <div
        style={{
          color,
          fontSize: compact ? 14 : 16,
          fontWeight: 900,
          marginBottom: 8,
          textShadow: `0 0 10px ${color}`,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {user.profile?.discord_name || main?.name || "Unknown"} 👑
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 7,
        }}
      >
        {chars.map((c) => {
          const cColor = colorOf(c.class);
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
                background: "linear-gradient(180deg, rgba(10,7,18,.92), rgba(2,0,8,.96))",
                border: `1px solid ${cColor}88`,
                borderRadius: 8,
                padding: "8px 7px",
                boxShadow: `0 0 12px ${cColor}33`,
                transition: "all .2s ease",
                minWidth: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.12)";
                e.currentTarget.style.boxShadow = `0 0 22px ${cColor}`;
                e.currentTarget.style.zIndex = "20";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow = `0 0 12px ${cColor}33`;
                e.currentTarget.style.zIndex = "1";
              }}
            >
              <img
                src={c.avatar_url || "/default-avatar.png"}
                style={{
             width: compact ? 48 : 58,
height: compact ? 48 : 58,
                  borderRadius: "50%",
                  objectFit: "cover",
                  display: "block",
                  margin: "0 auto 4px",
                  border: `2px solid ${cColor}`,
                }}
              />

              <div
                style={{
                  color: cColor,
                  fontSize: compact ? 10 : 11,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c.name}
              </div>

              <div style={{ color: "#f5f3ff", fontSize: compact ? 10 : 11 }}>
                ilvl {c.ilvl || "-"}
              </div>

              <div style={{ color: "#f5f3ff", fontSize: compact ? 10 : 11 }}>
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
  bg,
  compact = false,
}: {
  title: string;
  icon: string;
  users: RosterUser[];
  limit?: number;
  color: string;
  bg: string;
  compact?: boolean;
}) {
  return (
    <section
      style={{
        border: `1px solid ${color}aa`,
        borderRadius: 10,
        padding: compact ? 16 : 18,
        minHeight: compact ? 245 : 500,
        backgroundImage: `
          linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.72)),
          url("${bg}")
        `,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: `inset 0 0 50px rgba(0,0,0,.9), 0 0 18px ${color}33`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          color,
          fontFamily: "Georgia, serif",
          fontSize: compact ? 18 : 24,
          fontWeight: 900,
          letterSpacing: 1.5,
          textShadow: `0 0 14px ${color}`,
          marginBottom: compact ? 18 : 28,
        }}
      >
        <span style={{ width: 80, height: 1, background: color, opacity: 0.75 }} />
        <span>{icon}</span>
        <span>
          {title} ({users.length}
          {limit ? `/${limit}` : ""})
        </span>
        <span style={{ width: 80, height: 1, background: color, opacity: 0.75 }} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact
            ? "repeat(auto-fit, minmax(165px, 1fr))"
            : "repeat(auto-fit, minmax(175px, 1fr))",
          gap: compact ? "24px 14px" : "30px 18px",
          justifyItems: "center",
          alignItems: "start",
        }}
      >
        {users.map((u) => (
          <UserCard key={u.user_id} user={u} compact={compact} />
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
        .select("user_id, discord_name, avatar_url, site_role, guild_role")
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

   const allowedRanks = [
  "Trial",
  "Raider",
  "Officer",
  "Death Wish",
  "Guild Master",
];

const filteredUsers = finalUsers.filter((u) => {
  const rank = u.profile?.guild_role?.trim();

  return rank && allowedRanks.includes(rank);
});

setUsers(filteredUsers);

setUsers(filteredUsers);
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
          padding: "50px 18px 35px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "linear-gradient(rgba(5,0,15,.15), rgba(0,0,0,.76))",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "min(1800px, 100%)",
            margin: "0 auto",
          }}
        >
          <header style={{ textAlign: "center", marginBottom: 18 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "Georgia, serif",
                fontSize: 44,
                letterSpacing: 12,
                textShadow: "0 0 28px #a855f7",
              }}
            >
              GUILD ROSTER
            </h1>

            <div
              style={{
                marginTop: 5,
                color: "#c4b5fd",
                fontWeight: 800,
                letterSpacing: 3,
                fontSize: 12,
              }}
            >
              THE SHADOWS RISE TOGETHER
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
                  gridTemplateColumns: "0.4fr 1fr",
                  gap: 14,
                  marginBottom: 16,
                }}
              >
                <Section
                  title="TANKS"
                  icon="🛡"
                  users={grouped.tanks}
                  limit={2}
                  color="#38bdf8"
                  bg="/Tank.png"
                  compact
                />

                <Section
                  title="HEALERS"
                  icon="🌿"
                  users={grouped.healers}
                  limit={5}
                  color="#22c55e"
                  bg="/Healer.png"
                  compact
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <Section
                  title="RANGE DPS"
                  icon="🏹"
                  users={grouped.range}
                  color="#f59e0b"
                  bg="/Range.png"
                />

                <Section
                  title="MELEE DPS"
                  icon="⚔"
                  users={grouped.melee}
                  color="#ef4444"
                  bg="/Melee.png"
                />
              </div>
            </>
          )}
        </div>
      </main>
    </GuildAccessGuard>
  );
}