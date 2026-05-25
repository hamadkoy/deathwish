"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type OnlineUser = {
  id: string;
  name: string;
  avatar: string;
  page: string;
  discordId?: string;
};

export default function OnlineUsers() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let channel: any;

    async function setupPresence() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("discord_name, avatar_url")
        .eq("user_id", user.id)
        .single();

      channel = supabase.channel("online-users", {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      channel.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();

const users = Object.values(state)
  .flat()
  .map((p: any) => p.user);

const uniqueUsers = Array.from(
  new Map(users.map((u: any) => [u.id, u])).values()
);

setOnlineUsers(uniqueUsers as OnlineUser[]);
      });

      await channel.subscribe(async (status: string) => {
        if (status !== "SUBSCRIBED") return;

        await channel.track({
          user: {
            id: user.id,
            name:
              profile?.discord_name ||
              user.user_metadata?.full_name ||
              "Unknown",
            avatar:
              profile?.avatar_url ||
              user.user_metadata?.avatar_url ||
              "",
            page: window.location.pathname,
discordId:
  user.identities?.find(
    (i: any) => i.provider === "discord"
  )?.id || "",
          },
        });
      });
    }

    setupPresence();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div style={wrap}>
      <button
        style={onlineBtn}
        onClick={() => setOpen(!open)}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = "0 0 18px rgba(34,197,94,.65)";
          e.currentTarget.style.transform = "scale(1.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = "0 0 10px rgba(34,197,94,.25)";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <span style={dot}></span>
        {onlineUsers.length} Online
      </button>

      {open && (
        <div style={dropdown}>
          <div style={dropdownTitle}>Online Now</div>

          {onlineUsers.length === 0 ? (
            <div style={empty}>No one online</div>
          ) : (
            onlineUsers.map((u) => (
              <div
  key={u.id}
  style={{
    ...userRow,
    cursor: "pointer",
  }}
  onClick={() => {
    if (u.discordId) {
window.location.href =
  `discord://-/users/${u.discordId}`;
    }
  }}
>
                <div style={{ position: "relative" }}>
                  <img src={u.avatar || "/logo.png"} style={avatar} alt="" />
                  <span style={miniDot}></span>
                </div>

                <div>
                  <div style={name}>{u.name}</div>
                  <div style={pageText}>{formatPage(u.page)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function formatPage(page: string) {
  if (page === "/") return "Home";
  if (page.includes("raid-logs")) return "Viewing Logs";
  if (page.includes("profile")) return "My Characters";
  if (page.includes("my-signups")) return "My Runs";
  if (page.includes("booking")) return "Booking";
  if (page.includes("bank")) return "Bank";
  return "Online";
}

const wrap: React.CSSProperties = {
  position: "relative",
};

const onlineBtn: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(34,197,94,.45)",
  background: "rgba(5,46,22,.55)",
  color: "#bbf7d0",
  fontWeight: 900,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 8,
  transition: "all .22s ease",
};

const dot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: "50%",
  background: "#22c55e",
  boxShadow: "0 0 12px #22c55e",
};

const dropdown: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: 44,
  width: 260,
  background:
    "linear-gradient(180deg, rgba(10,25,18,.98), rgba(5,10,20,.98))",
  border: "1px solid rgba(34,197,94,.35)",
  borderRadius: 16,
  padding: 14,
  zIndex: 9999,
  boxShadow: "0 0 35px rgba(34,197,94,.25)",
};

const dropdownTitle: React.CSSProperties = {
  fontWeight: 1000,
  marginBottom: 12,
  color: "#dcfce7",
};

const userRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px",
  borderRadius: 12,
  background: "rgba(255,255,255,.04)",
  marginBottom: 8,
};

const avatar: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  objectFit: "cover",
};

const miniDot: React.CSSProperties = {
  position: "absolute",
  right: 0,
  bottom: 0,
  width: 11,
  height: 11,
  borderRadius: "50%",
  background: "#22c55e",
  border: "2px solid #06100a",
};

const name: React.CSSProperties = {
  color: "white",
  fontWeight: 900,
};

const pageText: React.CSSProperties = {
  color: "#86efac",
  fontSize: 12,
  marginTop: 2,
};

const empty: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 13,
};