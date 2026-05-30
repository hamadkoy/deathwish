"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { themes } from "@/lib/themes";

type SiteRole =
  | "Lost_soul"
  | "Reaper"
  | "Soulreaper"
  | "Nightblade"
  | "Dreadlord";

type Profile = {
  user_id: string;
  discord_name: string;
  avatar_url: string;
  site_role?: string;
  character_count?: number;
};

const allowedRoles: SiteRole[] = ["Dreadlord", "Nightblade", "Soulreaper"];

const roleOrder: Record<SiteRole, number> = {
  Dreadlord: 1,
  Nightblade: 2,
  Soulreaper: 3,
  Reaper: 4,
  Lost_soul: 5,
};

export default function GarrisonsPage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentRole, setCurrentRole] = useState<SiteRole>("Lost_soul");
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [selectedTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("profileTheme") || "midnight";
    }
    return "midnight";
  });

  const currentTheme = themes[selectedTheme] || themes.midnight;

  const [muted, setMuted] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("garrisonVideoMuted") !== "false";
    }
    return true;
  });

  useEffect(() => {
    checkAccess();
    loadProfiles();
  }, []);

  useEffect(() => {
    localStorage.setItem("garrisonVideoMuted", String(muted));
  }, [muted]);

  async function checkAccess() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCurrentRole("Lost_soul");
      setCheckingAccess(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("site_role")
      .eq("user_id", user.id)
      .single();

    setCurrentRole(normalizeRole(data?.site_role));
    setCheckingAccess(false);
  }

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, discord_name, avatar_url, site_role")
      .not("discord_name", "is", null);

    if (error) {
      alert(error.message);
      return;
    }

    const sorted = (data || []).sort((a: Profile, b: Profile) => {
      const roleA = roleOrder[normalizeRole(a.site_role)] || 99;
      const roleB = roleOrder[normalizeRole(b.site_role)] || 99;

      if (roleA !== roleB) return roleA - roleB;

      return (a.discord_name || "").localeCompare(b.discord_name || "");
    });

    const profilesWithCounts = await Promise.all(
      sorted.map(async (p: Profile) => {
        const { count } = await supabase
          .from("characters")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("user_id", p.user_id);

        return {
          ...p,
          character_count: count || 0,
        };
      })
    );

    setProfiles(profilesWithCounts);
  }

  function renderBackground() {
    return (
      <>
        {currentTheme.video ? (
          <video
            autoPlay
            loop
            playsInline
            muted={muted}
            key={selectedTheme}
            style={videoBg}
          >
            <source src={currentTheme.video} type="video/webm" />
          </video>
        ) : (
          <div
            style={{
              ...imageBg,
              backgroundImage: `url(${currentTheme.image})`,
              backgroundPosition: currentTheme.position || "center",
            }}
          />
        )}

        <div style={darkOverlay} />
        <div style={bgGlow1} />
        <div style={bgGlow2} />
        <div style={bgFog} />

        {currentTheme.video && (
          <button onClick={() => setMuted(!muted)} style={muteBtn}>
            {muted ? "🔇 Unmute Sound" : "🔊 Mute Sound"}
          </button>
        )}
      </>
    );
  }

  if (checkingAccess) {
    return (
      <main style={page}>
        {renderBackground()}
        <div style={accessBox}>
          <h1 style={accessTitle}>Checking Access...</h1>
        </div>
      </main>
    );
  }

  if (!allowedRoles.includes(currentRole)) {
    return (
      <main style={page}>
        {renderBackground()}

        <div style={accessBox}>
          <h1 style={accessTitle}>Access Denied</h1>
          <p style={accessText}>
            This channel can be accessed only by:
          </p>
          <p style={accessRoles}>
            👑 Dreadlord / ☠️ Nightblade / 💀 Soulreaper
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={page}>
      {renderBackground()}

      <div style={header}>
        <div style={line} />
        <h1 style={title}>GARRISONS</h1>
        <div style={line} />
      </div>

      <div style={subtitle}>Death Wish</div>

      <div style={grid}>
        {profiles.map((p) => {
          const role = normalizeRole(p.site_role);
          const color = getRoleColor(role);

          return (
            <div
              key={p.user_id}
              style={card}
              onClick={() => router.push(`/profile?userId=${p.user_id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform =
                  "translateY(-8px) scale(1.05)";
                e.currentTarget.style.boxShadow = `0 0 34px ${color}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow =
                  "0 0 18px rgba(168,85,247,.22)";
              }}
            >
              <div
                style={{
                  ...avatarBorder,
                  border: `2px solid ${color}`,
                  boxShadow: `0 0 24px ${color}`,
                }}
              >
                <img
                  src={
                    p.avatar_url ||
                    "https://cdn.discordapp.com/embed/avatars/0.png"
                  }
                  style={avatar}
                  alt=""
                />
              </div>

              <div style={name}>{p.discord_name}</div>

              <div style={{ ...roleText, color }}>
                {getRoleIcon(role)} {getRoleLabel(role)}
              </div>

              <div style={charCount}>⚔️ {p.character_count} Characters</div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

function normalizeRole(role?: string | null): SiteRole {
  if (role === "Dreadlord" || role === "admin" || role === "Deathlord") {
    return "Dreadlord";
  }

  if (role === "Nightblade" || role === "officer" || role === "Deathbringer") {
    return "Nightblade";
  }

  if (role === "Soulreaper") {
    return "Soulreaper";
  }

  if (role === "Reaper" || role === "Booster" || role === "booster") {
    return "Reaper";
  }

  return "Lost_soul";
}

function getRoleIcon(role: SiteRole) {
  if (role === "Dreadlord") return "👑";
  if (role === "Nightblade") return "☠️";
  if (role === "Soulreaper") return "💀";
  if (role === "Reaper") return "⚔️";
  return "👻";
}

function getRoleLabel(role: SiteRole) {
  if (role === "Lost_soul") return "Lost Soul";
  return role;
}

function getRoleColor(role: SiteRole) {
  if (role === "Dreadlord") return "#facc15";
  if (role === "Nightblade") return "#60a5fa";
  if (role === "Soulreaper") return "#dc2626";
  if (role === "Reaper") return "#c084fc";
  return "#22c55e";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  padding: "60px 50px",
  position: "relative",
  overflow: "hidden",
  color: "white",
  background: "transparent",
};

const videoBg: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  zIndex: -2,
  filter: "brightness(.55)",
};

const imageBg: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  zIndex: -2,
  filter: "brightness(.45)",
};

const darkOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.78))",
  zIndex: -1,
  pointerEvents: "none",
};

const muteBtn: React.CSSProperties = {
  position: "fixed",
  right: 24,
  bottom: 24,
  zIndex: 20,
  padding: "12px 18px",
  borderRadius: 14,
  border: "1px solid rgba(168,85,247,.45)",
  background: "linear-gradient(180deg,#c026d3,#7e22ce)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 22px rgba(168,85,247,.55)",
  fontSize: 14,
};

const bgGlow1: React.CSSProperties = {
  position: "absolute",
  top: -200,
  left: -200,
  width: 500,
  height: 500,
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(168,85,247,.32), transparent 70%)",
  filter: "blur(80px)",
  pointerEvents: "none",
  zIndex: 2,
};

const bgGlow2: React.CSSProperties = {
  position: "absolute",
  bottom: -250,
  right: -250,
  width: 600,
  height: 600,
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(59,130,246,.22), transparent 70%)",
  filter: "blur(90px)",
  pointerEvents: "none",
  zIndex: 2,
};

const bgFog: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backdropFilter: "blur(1px)",
  pointerEvents: "none",
  zIndex: 2,
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 28,
  marginBottom: 12,
  position: "relative",
  zIndex: 3,
};

const line: React.CSSProperties = {
  width: 180,
  height: 2,
  background:
    "linear-gradient(to right, transparent, rgba(192,132,252,.95), transparent)",
};

const title: React.CSSProperties = {
  fontSize: 72,
  fontWeight: 900,
  margin: 0,
  letterSpacing: 3,
  textShadow: "0 0 30px rgba(192,132,252,.95)",
};

const subtitle: React.CSSProperties = {
  textAlign: "center",
  color: "#d8b4fe",
  fontSize: 18,
  marginBottom: 50,
  fontWeight: 700,
  position: "relative",
  zIndex: 3,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 240px)",
  justifyContent: "center",
  gap: "40px 70px",
  position: "relative",
  zIndex: 3,
  paddingBottom: 80,
};

const card: React.CSSProperties = {
  width: 250,
  height: 300,
  borderRadius: "45%",
  background:
    "radial-gradient(circle at top, rgba(88,28,135,.82), rgba(10,0,25,.92))",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(168,85,247,.38)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all .22s ease",
  boxShadow: "0 0 22px rgba(168,85,247,.25)",
  position: "relative",
  paddingBottom: 24,
};

const avatarBorder: React.CSSProperties = {
  width: 128,
  height: 128,
  borderRadius: "50%",
  padding: 4,
  background: "rgba(0,0,0,.45)",
};

const avatar: React.CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
  display: "block",
};

const name: React.CSSProperties = {
  marginTop: 18,
  fontSize: 22,
  fontWeight: 900,
  maxWidth: 180,
  textAlign: "center",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const roleText: React.CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: 1,
};

const charCount: React.CSSProperties = {
  marginTop: 10,
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 16,
  fontWeight: 900,
  color: "white",
  background: "rgba(0,0,0,.35)",
  border: "1px solid rgba(216,180,254,.45)",
  boxShadow: "0 0 14px rgba(168,85,247,.45)",
  textShadow: "0 0 10px rgba(192,132,252,.9)",
};

const accessBox: React.CSSProperties = {
  position: "relative",
  zIndex: 5,
  minHeight: "70vh",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  textAlign: "center",
};

const accessTitle: React.CSSProperties = {
  fontSize: 58,
  fontWeight: 900,
  color: "#f87171",
  textShadow: "0 0 25px rgba(248,113,113,.75)",
};

const accessText: React.CSSProperties = {
  fontSize: 22,
  color: "#e9d5ff",
  fontWeight: 800,
};

const accessRoles: React.CSSProperties = {
  fontSize: 24,
  color: "#c084fc",
  fontWeight: 900,
};