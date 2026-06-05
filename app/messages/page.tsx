"use client";

import { useEffect, useRef, useState } from "react";
import SideNav from "../components/SideNav";
import { supabase } from "@/lib/supabase";

type Channel = "general" | "raid-planning" | "officer-room";
type ChatMode = "channel" | "dm";

type Message = {
  id: number;
  user_id: string;
  discord_name: string;
  avatar_url: string;
  site_role: string;
  message: string;
  channel: Channel;
  created_at: string;
};

type DMThread = {
  id: number;
  user_one: string;
  user_two: string;
  created_at: string;
};

type DM_Message = {
  id: number;
  thread_id: number;
  sender_id: string;
  sender_name: string;
  sender_avatar: string;
  message: string;
  created_at: string;
};

type Profile = {
  user_id: string;
  discord_name: string;
  avatar_url: string;
  site_role: string;
};
function formatMessageTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const diffDays = Math.floor(
    (today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;

  return `${date.toLocaleDateString("en-GB")} at ${time}`;
}
export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [dmThreads, setDmThreads] = useState<DMThread[]>([]);
  const [editBox, setEditBox] = useState<{
  id: number;
  type: "channel" | "dm";
  text: string;
} | null>(null);
 const [dmMessages, setDmMessages] = useState<DM_Message[]>([]);
 
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeChannel, setActiveChannel] = useState<Channel>("general");
  const [chatMode, setChatMode] = useState<ChatMode>("channel");
  const [activeDMThread, setActiveDMThread] = useState<DMThread | null>(null);
  const [channelUnread, setChannelUnread] = useState<Record<string, number>>({});
const [menu, setMenu] = useState<{
  x: number;
  y: number;
  id: number;
  type: "channel" | "dm";
  text: string;
} | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
useEffect(() => {
  localStorage.setItem("unreadMessages", "0");
}, []);
useEffect(() => {
  markMessagesAsRead();
}, []);
  useEffect(() => {
    loadProfile();
    loadMessages();
    loadProfiles();
    loadDMThreads();
    loadChannelUnread();
    const channel = supabase
      .channel("messages-page-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guild_messages" },
        () => loadMessages()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_threads" },
        () => loadDMThreads()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_messages" },
        () => loadDMMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, dmMessages, activeChannel, activeDMThread]);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setProfile(data);
    setLoading(false);
  }
  async function markMessagesAsRead() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

await supabase
  .from("guild_message_reads")
  .upsert({
    user_id: user.id,
    channel: activeChannel,
    last_read_at: new Date().toISOString(),
  });
}
async function deleteDMMessage(id: number) {
  const { error } = await supabase
    .from("dm_messages")
    .delete()
    .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  setDmMessages((prev) => prev.filter((m) => m.id !== id));

  if (activeDMThread) {
    await loadDMMessages(activeDMThread.id);
  }
}
  async function loadProfiles() {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, discord_name, avatar_url, site_role")
      .eq("signup_approved", true);

    setProfiles(data || []);
  }

  async function loadMessages() {
    const { data } = await supabase
      .from("guild_messages")
      .select("*")
      .order("created_at", { ascending: true });

    setMessages(data || []);
  }

  async function loadDMThreads() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("dm_threads")
      .select("*")
      .or(`user_one.eq.${user.id},user_two.eq.${user.id}`)
      .order("created_at", { ascending: true });

    setDmThreads(data || []);
  }

  async function loadDMMessages(threadId?: number) {
    const id = threadId || activeDMThread?.id;
    if (!id) return;

    const { data } = await supabase
      .from("dm_messages")
      .select("*")
      .eq("thread_id", id)
      .order("created_at", { ascending: true });

    setDmMessages(data || []);
  }
async function loadChannelUnread() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: reads } = await supabase
    .from("guild_message_reads")
    .select("*")
    .eq("user_id", user.id);

  const unreadMap: Record<string, number> = {};

  for (const channel of ["general", "raid-planning", "officer-room"]) {
    const lastRead =
      reads?.find((r) => r.channel === channel)?.last_read_at ||
      "1970-01-01";

const { count } = await supabase
  .from("guild_messages")
  .select("*", { count: "exact", head: true })
  .eq("channel", channel)
  .neq("user_id", user.id)
  .gt("created_at", lastRead);

    unreadMap[channel] = count || 0;
  }

  setChannelUnread(unreadMap);
}
async function sendMessage() {
  if (!message.trim() || !profile) return;

  if (chatMode === "channel") {
    const { error } = await supabase.from("guild_messages").insert({
      user_id: profile.user_id,
      discord_name: profile.discord_name,
      avatar_url: profile.avatar_url || "",
      site_role: profile.site_role,
      message: message.trim(),
      channel: activeChannel,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setMessage("");
    await loadMessages();
    return;
  }

  if (chatMode === "dm" && activeDMThread) {
    const { error } = await supabase.from("dm_messages").insert({
      thread_id: activeDMThread.id,
      sender_id: profile.user_id,
      sender_name: profile.discord_name,
      sender_avatar: profile.avatar_url || "",
      message: message.trim(),
    });

    if (error) {
      alert(error.message);
      return;
    }

    setMessage("");
    await loadDMMessages(activeDMThread.id);
  }
}

  async function deleteMessage(id: number) {
    await supabase.from("guild_messages").delete().eq("id", id);
    await loadMessages();
  }

  async function openDM(targetUserId: string) {
    if (!profile || targetUserId === profile.user_id) return;

    let thread = dmThreads.find(
      (t) =>
        (t.user_one === profile.user_id && t.user_two === targetUserId) ||
        (t.user_two === profile.user_id && t.user_one === targetUserId)
    );

    if (!thread) {
      const { data, error } = await supabase
        .from("dm_threads")
        .insert({
          user_one: profile.user_id,
          user_two: targetUserId,
        })
        .select("*")
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      thread = data;
      await loadDMThreads();
    }

if (!thread) return;

setActiveDMThread(thread);
setChatMode("dm");
await loadDMMessages(thread.id);
  }

async function openChannel(channel: Channel) {
  setActiveChannel(channel);
  setChatMode("channel");
  setActiveDMThread(null);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("guild_message_reads").upsert({
    user_id: user.id,
    channel,
    last_read_at: new Date().toISOString(),
  });

setChannelUnread((prev) => ({
  ...prev,
  [channel]: 0,
}));

await loadChannelUnread();
}

  function getOtherUser(thread: DMThread) {
    if (!profile) return null;

    const otherId =
      thread.user_one === profile.user_id ? thread.user_two : thread.user_one;

    return profiles.find((p) => p.user_id === otherId) || null;
  }

  const fixedRole = normalizeRole(profile?.site_role);
  const allowed = fixedRole !== "Lost_soul";

  const canUseOfficerRoom =
    fixedRole === "Dreadlord" ||
    fixedRole === "Nightblade" ||
    fixedRole === "Soulreaper";

  const visibleMessages = messages.filter(
    (m) => (m.channel || "general") === activeChannel
  );

  const channels: { id: Channel; label: string; locked?: boolean }[] = [
    { id: "general", label: "# general" },
    { id: "raid-planning", label: "# raid-planning" },
    { id: "officer-room", label: "# officer-room", locked: true },
  ];

  const activeTitle =
    chatMode === "dm"
      ? `DM: ${getOtherUser(activeDMThread as DMThread)?.discord_name || "User"}`
      : channels.find((c) => c.id === activeChannel)?.label;

  if (loading) {
    return (
      <main style={page}>
        <div style={layout}>
          <SideNav active="Messages" />
          <div style={accessBox}>Loading...</div>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main style={page}>
        <div style={layout}>
          <SideNav active="Messages" />
          <div style={accessBox}>
            <h1 style={accessTitle}>Access Denied</h1>
            <p style={accessText}>
              Messages can only be accessed by Reaper and above.
            </p>
          </div>
        </div>
      </main>
    );
  }

return (
  <main
    style={page}
    onClick={() => setMenu(null)}
  >
      <div style={layout}>
        <SideNav active="Messages" />

        <section style={panel}>
          <aside style={channelsBox}>
            <div style={boxTitle}>Channels</div>

            {channels.map((c) => {
              const locked = c.locked && !canUseOfficerRoom;

              return (
                <button
                  key={c.id}
onClick={async () => {
  if (!locked) await openChannel(c.id);
}}
                  style={{
                    ...channelBtn,
                    ...(chatMode === "channel" && activeChannel === c.id
                      ? channelBtnActive
                      : {}),
                    opacity: locked ? 0.45 : 1,
                    cursor: locked ? "not-allowed" : "pointer",
                  }}
                >
                  <div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  }}
>
  <span>
    {c.label} {locked ? "🔒" : ""}
  </span>

  {channelUnread[c.id] > 0 && (
    <span
      style={{
        minWidth: 20,
        height: 20,
        borderRadius: 999,
        background: "#ef4444",
        color: "white",
        fontSize: 11,
        fontWeight: 900,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 6px",
        boxShadow: "0 0 12px rgba(239,68,68,.9)",
      }}
    >
      {channelUnread[c.id]}
    </span>
  )}
</div>
                </button>
              );
            })}

            <div style={{ ...boxTitle, marginTop: 28 }}>Direct Messages</div>

            {dmThreads.length === 0 && (
              <div style={emptySmall}>No DMs yet. Click Message on a user.</div>
            )}

            {dmThreads.map((thread) => {
              const other = getOtherUser(thread);
              if (!other) return null;

              return (
<button
  key={thread.id}
  onClick={async () => {
    setActiveDMThread(thread);
    setChatMode("dm");
    await loadDMMessages(thread.id);
  }}
  style={{
    ...channelBtn,
    ...(chatMode === "dm" && activeDMThread?.id === thread.id
      ? channelBtnActive
      : {}),
    display: "flex",
    alignItems: "center",
    gap: 10,
  }}
>
  <img
    src={
      other.avatar_url ||
      "https://cdn.discordapp.com/embed/avatars/0.png"
    }
    style={{
      width: 26,
      height: 26,
      borderRadius: "50%",
      objectFit: "cover",
      border: "2px solid rgba(168,85,247,.45)",
      flexShrink: 0,
    }}
  />

  <span
    style={{
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    }}
  >
    {other.discord_name}
  </span>
</button>
              );
            })}
          </aside>

          <div style={chatArea}>
            <div style={chatHeader}>
              <div>
                <div style={channelTitle}>{activeTitle}</div>
                <div style={channelSub}>
                  {chatMode === "dm"
                    ? "Private message"
                    : "Death Wish guild chat"}
                </div>
              </div>
            </div>

            <div style={messagesBox}>
              {chatMode === "channel" &&
                visibleMessages.map((m) => {
                  const mine = profile?.user_id === m.user_id;
                  const canDelete = mine || fixedRole === "Dreadlord";

                  return (
                    <div
  key={m.id}
  style={messageRow}
  onContextMenu={(e) => {
    if (!canDelete) return;
    e.preventDefault();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      id: m.id,
      type: "channel",
      text: m.message,
    });
  }}
>
                      <img
                        src={
                          m.avatar_url ||
                          "https://cdn.discordapp.com/embed/avatars/0.png"
                        }
                        style={avatar}
                        alt=""
                      />

                      <div style={{ flex: 1 }}>
                        <div style={messageMeta}>
                          <span
                            style={{
                              ...name,
                              color: getRoleColor(m.site_role),
                              textShadow: `0 0 12px ${getRoleColor(
                                m.site_role
                              )}`,
                            }}
                          >
                            {m.discord_name || "Unknown"}
                          </span>

                          <span style={time}>
                            {formatMessageTime(m.created_at)}
                          </span>
                        </div>

                        <div style={messageText}>{m.message}</div>
                      </div>
                    </div>
                  );
                })}

              {chatMode === "dm" &&
                dmMessages.map((m) => {
                  const mine = profile?.user_id === m.sender_id;

                  return (
                   <div
  key={m.id}
  style={messageRow}
  onContextMenu={(e) => {
    const mine = m.sender_id === profile?.user_id;

    if (!mine && fixedRole !== "Dreadlord") return;

    e.preventDefault();

    setMenu({
      x: e.clientX,
      y: e.clientY,
      id: m.id,
      type: "dm",
      text: m.message,
    });
  }}
>
                      <img
                        src={
                          m.sender_avatar ||
                          "https://cdn.discordapp.com/embed/avatars/0.png"
                        }
                        style={avatar}
                        alt=""
                      />

                      <div style={{ flex: 1 }}>
                        <div style={messageMeta}>
                          <span
                            style={{
                              ...name,
                              color: mine ? "#c084fc" : "#60a5fa",
                              textShadow: mine
                                ? "0 0 12px #c084fc"
                                : "0 0 12px #60a5fa",
                            }}
                          >
                            {m.sender_name || "Unknown"}
                          </span>

                          <span style={time}>
                            {formatMessageTime(m.created_at)}
                          </span>
                        </div>

                        <div style={messageText}>{m.message}</div>
                      </div>
                    </div>
                  );
                })}

              <div ref={bottomRef} />
            </div>

            <div style={inputRow}>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder={
                  chatMode === "dm"
                    ? "Send private message"
                    : `Message ${channels.find((c) => c.id === activeChannel)?.label}`
                }
                style={input}
              />

              <button onClick={sendMessage} style={sendBtn}>
                Send
              </button>
            </div>
          </div>

          <aside style={onlineBox}>
            <div style={boxTitle}>Online / Team</div>

            {profiles
              .filter((p) => p.user_id !== profile?.user_id)
              .map((p) => (
                <div
  key={p.user_id}
  style={onlineUser}
  onClick={() => openDM(p.user_id)}
>
                  <div style={{ position: "relative" }}>
                    <img
                      src={
                        p.avatar_url ||
                        "https://cdn.discordapp.com/embed/avatars/0.png"
                      }
                      style={onlineAvatar}
                      alt=""
                    />
                    <span style={onlineDot} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={onlineName}>{p.discord_name}</div>
                    <div
                      style={{
                        ...onlineRole,
                        color: getRoleColor(p.site_role),
                      }}
                    >
                      {getRoleLabel(p.site_role)}
                    </div>
                  </div>
                </div>
              ))}
          </aside>
        </section>
      </div>
      {menu && (
  <div
    style={{
      position: "fixed",
      left: menu.x,
      top: menu.y,
      zIndex: 9999,
      background: "rgba(10,0,25,.98)",
      border: "1px solid rgba(168,85,247,.45)",
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 0 26px rgba(168,85,247,.65)",
padding: 6,
    }}
  >
<button
  onClick={() => {
    setEditBox({
      id: menu.id,
      type: menu.type,
      text: menu.text,
    });

    setMenu(null);
  }}
  style={contextBtn}
>
  ✏️ Edit Message
</button>

<button
  onClick={() => {
    menu.type === "channel"
      ? deleteMessage(menu.id)
      : deleteDMMessage(menu.id);

    setMenu(null);
  }}
  style={{ ...contextBtn, color: "#f87171" }}
>
  🗑 Delete Message
</button>
  </div>
)}
        {editBox && (
  <div
    onClick={() => setEditBox(null)}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.72)",
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 500,
        borderRadius: 18,
        padding: 24,
        background: "rgba(10,0,25,.98)",
        border: "1px solid rgba(168,85,247,.45)",
        boxShadow: "0 0 40px rgba(168,85,247,.45)",
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          marginBottom: 18,
          color: "#c084fc",
        }}
      >
        Edit Message
      </div>

      <textarea
        value={editBox.text}
        onChange={(e) =>
          setEditBox({
            ...editBox,
            text: e.target.value,
          })
        }
        style={{
          width: "100%",
          height: 140,
          borderRadius: 14,
          border: "1px solid rgba(168,85,247,.35)",
          background: "rgba(0,0,0,.45)",
          color: "white",
          padding: 16,
          resize: "none",
          outline: "none",
          fontSize: 15,
        }}
      />

      <div
        style={{
          marginTop: 18,
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
        }}
      >
        <button
          onClick={() => setEditBox(null)}
          style={{
            height: 42,
            padding: "0 18px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.15)",
            background: "rgba(255,255,255,.06)",
            color: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>

        <button
          onClick={async () => {
            if (!editBox.text.trim()) return;

            if (editBox.type === "channel") {
              await supabase
                .from("guild_messages")
                .update({
                  message: editBox.text.trim(),
                })
                .eq("id", editBox.id);

              await loadMessages();
            } else {
              await supabase
                .from("dm_messages")
                .update({
                  message: editBox.text.trim(),
                })
                .eq("id", editBox.id);

              await loadDMMessages();
            }

            setEditBox(null);
          }}
          style={{
            height: 42,
            padding: "0 18px",
            borderRadius: 12,
            border: "none",
            background:
              "linear-gradient(180deg,#c026d3,#7e22ce)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 0 18px rgba(168,85,247,.45)",
          }}
        >
          Save Changes
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  );
}

function normalizeRole(role?: string | null) {
  if (role === "Dreadlord" || role === "admin" || role === "Deathlord")
    return "Dreadlord";
  if (role === "Nightblade" || role === "officer" || role === "Deathbringer")
    return "Nightblade";
  if (role === "Soulreaper") return "Soulreaper";
  if (role === "Reaper" || role === "Booster" || role === "booster")
    return "Reaper";
  return "Lost_soul";
}

function getRoleLabel(role?: string | null) {
  const fixed = normalizeRole(role);
  if (fixed === "Lost_soul") return "Lost Soul";
  return fixed;
}

function getRoleColor(role?: string | null) {
  const fixed = normalizeRole(role);
  if (fixed === "Dreadlord") return "#facc15";
  if (fixed === "Nightblade") return "#60a5fa";
  if (fixed === "Soulreaper") return "#dc2626";
  if (fixed === "Reaper") return "#a855f7";
  return "#9ca3af";
}

const page: React.CSSProperties = {
  height: "calc(100vh - 82px)",
  overflow: "hidden",
  color: "white",
  background:
    "linear-gradient(rgba(0,0,0,.66), rgba(0,0,0,.88)), url('/bg.png') center/cover fixed",
  padding: 18,
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "230px 1fr",
  gap: 18,
  height: "100%",
};

const panel: React.CSSProperties = {
  height: "100%",
  borderRadius: 22,
  overflow: "hidden",
  background: "rgba(5,8,18,.88)",
  border: "1px solid rgba(168,85,247,.35)",
  boxShadow: "0 0 40px rgba(168,85,247,.25)",
  display: "grid",
  gridTemplateColumns: "260px 1fr 280px",
};

const channelsBox: React.CSSProperties = {
  borderRight: "1px solid rgba(255,255,255,.08)",
  background: "rgba(10,0,30,.35)",
  padding: 18,
};

const boxTitle: React.CSSProperties = {
  color: "#c084fc",
  fontWeight: 900,
  fontSize: 16,
  marginBottom: 16,
  textTransform: "uppercase",
};

const channelBtn: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,.25)",
  background: "rgba(0,0,0,.25)",
  color: "white",
  fontWeight: 900,
  textAlign: "left",
  padding: "0 14px",
  marginBottom: 10,
  cursor: "pointer",
};

const channelBtnActive: React.CSSProperties = {
  background:
    "linear-gradient(90deg, rgba(168,85,247,.55), rgba(124,58,237,.22))",
  boxShadow: "0 0 18px rgba(168,85,247,.45)",
};

const emptySmall: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 12,
};

const chatArea: React.CSSProperties = {
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

const chatHeader: React.CSSProperties = {
  padding: "18px 22px",
  borderBottom: "1px solid rgba(255,255,255,.08)",
  background: "rgba(10,0,30,.55)",
};

const channelTitle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
};

const channelSub: React.CSSProperties = {
  color: "#c084fc",
  fontWeight: 700,
};

const messagesBox: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 22,
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const messageRow: React.CSSProperties = {
  display: "flex",
  gap: 14,
};

const avatar: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(168,85,247,.45)",
};

const messageMeta: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const name: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 17,
};

const time: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: 11,
};

const messageText: React.CSSProperties = {
  marginTop: 5,
  color: "#f3f4f6",
  fontSize: 16,
};

const deleteBtn: React.CSSProperties = {
  border: "none",
  background: "rgba(239,68,68,.18)",
  color: "#f87171",
  borderRadius: 8,
  width: 24,
  height: 24,
  cursor: "pointer",
  fontWeight: 900,
};

const inputRow: React.CSSProperties = {
  padding: 16,
  display: "flex",
  gap: 12,
  borderTop: "1px solid rgba(255,255,255,.08)",
  background: "rgba(0,0,0,.35)",
};

const input: React.CSSProperties = {
  flex: 1,
  height: 50,
  borderRadius: 14,
  border: "1px solid rgba(168,85,247,.35)",
  background: "rgba(0,0,0,.45)",
  color: "white",
  padding: "0 16px",
  fontSize: 15,
  outline: "none",
};

const sendBtn: React.CSSProperties = {
  width: 110,
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(180deg,#c026d3,#7e22ce)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 22px rgba(168,85,247,.55)",
};

const onlineBox: React.CSSProperties = {
  borderLeft: "1px solid rgba(255,255,255,.08)",
  background: "rgba(10,0,30,.28)",
  padding: 18,
  overflowY: "auto",
};

const onlineUser: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  marginBottom: 16,
  cursor: "pointer",
};

const onlineAvatar: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(168,85,247,.45)",
};

const onlineDot: React.CSSProperties = {
  position: "absolute",
  right: 0,
  bottom: 0,
  width: 11,
  height: 11,
  borderRadius: "50%",
  background: "#22c55e",
  border: "2px solid #050816",
};

const onlineName: React.CSSProperties = {
  fontWeight: 900,
};

const onlineRole: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
};

const dmBtn: React.CSSProperties = {
  marginTop: 6,
  border: "none",
  background: "rgba(168,85,247,.18)",
  color: "#d8b4fe",
  borderRadius: 8,
  padding: "4px 10px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 12,
};

const accessBox: React.CSSProperties = {
  height: "100%",
  borderRadius: 24,
  background: "rgba(5,8,18,.88)",
  border: "1px solid rgba(168,85,247,.35)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

const accessTitle: React.CSSProperties = {
  fontSize: 52,
  fontWeight: 900,
  color: "#ef4444",
};

const accessText: React.CSSProperties = {
  color: "#e9d5ff",
  fontSize: 20,
  fontWeight: 800,
};
const contextBtn: React.CSSProperties = {
  width: 190,
  padding: "12px 14px",
  background: "transparent",
  border: "none",
  color: "white",
  textAlign: "left",
  fontWeight: 900,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 14,
  transition: "all .18s ease",
};