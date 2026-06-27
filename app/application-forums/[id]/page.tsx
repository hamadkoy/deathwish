"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ApplicationDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [app, setApp] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [myProfile, setMyProfile] = useState<any>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  useEffect(() => {
    loadPage();
  }, [id]);

  async function loadPage() {
    const { data: appData, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setApp(appData);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_id, discord_name, avatar_url, site_role")
        .eq("user_id", user.id)
        .single();

      setMyProfile(profile);
    }

    const { data: msgs } = await supabase
      .from("application_messages")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: true });

    setMessages(msgs || []);
  }

  async function sendMessage() {
    if (!message.trim() || !app) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("application_messages").insert({
      application_id: id,
      user_id: user?.id || null,
      author: myProfile?.discord_name || app.applicant_name || app.character_name,
      avatar_url:
        myProfile?.avatar_url ||
        app.discord_avatar_url ||
        app.avatar_url ||
        "/websitelogo.png",
      message,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setMessage("");
    loadPage();
  }

  async function deleteMessage(messageId: string) {
    if (!confirm("Delete this message?")) return;

    const { error } = await supabase
      .from("application_messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      alert(error.message);
      return;
    }

    loadPage();
  }

  async function saveEdit(messageId: string) {
    if (!editingText.trim()) return;

    const { error } = await supabase
      .from("application_messages")
      .update({ message: editingText })
      .eq("id", messageId);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingId(null);
    setEditingText("");
    loadPage();
  }

  async function updateApplicationStatus(newStatus: "accepted" | "declined") {
    if (!app) return;

    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", app.id);

    if (error) {
      alert(error.message);
      return;
    }

    router.push("/application-forums");
  }

  if (!app) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-white">
        Loading...
      </main>
    );
  }

  const answers = [
    ["👤", "Name", app.applicant_name],
    ["📅", "Age", app.age],
    ["🌍", "Country / Timezone", app.country],
    ["⏰", "Raid Availability", app.raid_availability],
    ["🛡️", "Previous Guilds", app.previous_guilds],
    ["⚔️", "Best Mythic Progress", app.best_mythic_progress],
    ["🏆", "Raiding Experience", app.experience],
    ["🚪", "Why Left Previous Guild", app.why_left_guild],
    ["⭐", "Why Join", app.why_join],
    ["💪", "Strengths", app.strengths],
    ["🎯", "Goals", app.goals],
    ["📜", "Extra Info", app.extra_info],
  ];

  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed p-8 text-[#f5e7c8]"
      style={{ backgroundImage: "url('/forums.png')" }}
    >
<button
  onClick={() => router.push("/application-forums")}
  className="
    mb-6
    rounded
    border
    border-[#6b4b1f]
    bg-black/70
    px-5
    py-3
    text-[#f5c451]
    font-bold
    transition-all
    duration-300
    hover:scale-105
    hover:bg-[#1d1306]
    hover:shadow-[0_0_20px_rgba(245,196,81,0.8)]
  "
>
  ← Back
</button>

      <div className="mx-auto max-w-6xl rounded-2xl border border-[#6b4b1f] bg-black/75 p-8 shadow-[0_0_60px_rgba(214,168,79,0.25)] backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <img
            src={app.avatar_url || "/websitelogo.png"}
            className="h-28 w-28 rounded-full border-2 border-[#d6a84f] object-cover"
          />

          <div>
            <h1 className="text-5xl font-black text-[#f5c451]">
              {app.character_name}
            </h1>
            <p className="text-xl font-bold text-sky-400">
              {app.spec} {app.class} • {app.realm}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <Stat title="PROGRESS" value={app.raid_progress || "-"} />
          <Stat title="ILVL" value={app.ilvl || "-"} />
          <Stat title="RAIDER.IO" value={app.raider_io_score || "-"} green />
        </div>

        <div className="mt-6 rounded-xl border border-[#6b4b1f] bg-black/50 p-5 backdrop-blur-sm">
          <p className="mb-2">
            <span className="font-bold text-[#f5c451]">Status:</span>{" "}
            {app.status}
          </p>

          <p className="mb-2">
            <span className="font-bold text-[#f5c451]">Raider.IO:</span>{" "}
            <a href={app.raider_io} target="_blank" className="text-sky-400">
              {app.raider_io || "-"}
            </a>
          </p>

          <p>
            <span className="font-bold text-[#f5c451]">Warcraft Logs:</span>{" "}
            <a href={app.warcraft_logs} target="_blank" className="text-sky-400">
              {app.warcraft_logs || "-"}
            </a>
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-[#6b4b1f] bg-black/50 p-6 backdrop-blur-sm">
          <h2 className="mb-8 text-center text-4xl font-black text-[#f5c451]">
            APPLICATION ANSWERS
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {answers.map(([icon, title, value]) => (
              <div
                key={title}
                className="flex gap-4 rounded-xl border border-[#3f2c13] bg-black/60 p-4"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#6b4b1f] text-2xl">
                  {icon}
                </div>

                <div>
                  <div className="text-lg font-black text-[#f5c451]">
                    {title}
                  </div>
                  <div className="whitespace-pre-wrap text-[#f5e7c8]">
                    {value || "-"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-[#6b4b1f] bg-black/60 p-6 backdrop-blur-sm">
          <h2 className="mb-6 text-center text-3xl font-black text-[#f5c451]">
            APPLICATION DISCUSSION
          </h2>

          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="rounded-xl border border-[#3f2c13] bg-black/50 p-6 text-center text-[#a8997a]">
                No messages yet. Start the conversation with the applicant.
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className="flex gap-4 rounded-xl border border-[#3f2c13] bg-black/60 p-4"
              >
                <img
                  src={msg.avatar_url || "/websitelogo.png"}
                  className="h-12 w-12 rounded-full border border-[#6b4b1f] object-cover"
                />

                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black text-[#f5c451]">
                      {msg.author || "Unknown"}
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(msg.id);
                          setEditingText(msg.message);
                        }}
                        className="text-xs font-black text-sky-400 hover:text-sky-300"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteMessage(msg.id)}
                        className="text-xs font-black text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {editingId === msg.id ? (
                    <div className="mt-3 flex gap-2">
                      <input
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="flex-1 rounded border border-[#6b4b1f] bg-black px-3 py-2 text-white outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => saveEdit(msg.id)}
                        className="rounded bg-[#f5c451] px-3 py-2 font-black text-black"
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditingText("");
                        }}
                        className="rounded border border-[#6b4b1f] px-3 py-2 text-[#f5c451]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1 whitespace-pre-wrap text-[#f5e7c8]">
                      {msg.message}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-500">
                    {new Date(msg.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <img
              src={
                myProfile?.avatar_url ||
                app.discord_avatar_url ||
                app.avatar_url ||
                "/websitelogo.png"
              }
              className="h-12 w-12 rounded-full border border-[#6b4b1f] object-cover"
            />

            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask the applicant a question..."
              className="flex-1 rounded-lg border border-[#6b4b1f] bg-black/80 px-4 py-3 text-white outline-none"
            />

            <button
              type="button"
              onClick={sendMessage}
              className="rounded-lg border border-[#f5c451] bg-[#f5c451] px-8 py-3 font-black text-black transition-all duration-300 hover:scale-105 hover:shadow-[0_0_25px_rgba(245,196,81,0.9)]"
            >
              SEND MESSAGE
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 overflow-visible">
            <button
              type="button"
              onClick={() => updateApplicationStatus("accepted")}
              className="rounded-lg border border-green-500 bg-green-900/40 py-5 font-black text-green-400 transition-all duration-300 hover:scale-105 hover:bg-green-700/60 hover:text-white hover:shadow-[0_0_25px_rgba(34,197,94,0.8)]"
            >
              ✓ ACCEPT APPLICANT
            </button>

            <button
              type="button"
              className="rounded-lg border border-yellow-500 bg-yellow-900/40 py-5 font-black text-yellow-400 transition-all duration-300 hover:scale-105 hover:bg-yellow-700/60 hover:text-white hover:shadow-[0_0_25px_rgba(245,196,81,0.8)]"
            >
              ? REQUEST MORE INFO
            </button>

            <button
              type="button"
              onClick={() => updateApplicationStatus("declined")}
              className="rounded-lg border border-red-500 bg-red-900/40 py-5 font-black text-red-400 transition-all duration-300 hover:scale-105 hover:bg-red-700/60 hover:text-white hover:shadow-[0_0_25px_rgba(239,68,68,0.8)]"
            >
              ✕ DECLINE APPLICANT
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({
  title,
  value,
  green,
}: {
  title: string;
  value: any;
  green?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#6b4b1f] bg-black/40 p-6 text-center backdrop-blur-sm">
      <div
        className={`text-5xl font-black ${
          green ? "text-green-400" : "text-[#f5d37a]"
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-sm tracking-widest text-[#a8997a]">
        {title}
      </div>
    </div>
  );
}