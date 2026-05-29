"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import SideNav from "../components/SideNav";
import { useRouter } from "next/navigation";

type Profile = {
  user_id: string;
  discord_name: string;
  avatar_url: string;
  site_role?: string;
};

export default function GarrisonsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, discord_name, avatar_url, site_role")
      .not("discord_name", "is", null)
      .order("discord_name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setProfiles(data || []);
  }

  return (
    <main style={page}>
      <div style={layout}>
        <SideNav active="Garrisons" />

        <section style={content}>
          <h1 style={title}>Garrisons</h1>
          <p style={subtitle}>Death Wish boosters and their profiles</p>

          <div style={grid}>
            {profiles.map((p) => (
              <div
                key={p.user_id}
                style={card}
                onClick={() => router.push(`/profile?userId=${p.user_id}`)}
              >
                <img
                  src={p.avatar_url || "https://cdn.discordapp.com/embed/avatars/0.png"}
                  style={avatar}
                />

                <div style={name}>{p.discord_name}</div>

                <div style={role}>
                  {(p.site_role || "viewer").toUpperCase()}
                </div>

                <button style={button}>View Garrison</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top, rgba(88,28,135,.45), #050012 55%)",
  color: "white",
  padding: 24,
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px 1fr",
  gap: 28,
};

const content: React.CSSProperties = {
  padding: "20px 10px",
};

const title: React.CSSProperties = {
  fontSize: 54,
  fontWeight: 900,
  textAlign: "center",
  textShadow: "0 0 25px rgba(168,85,247,.8)",
};

const subtitle: React.CSSProperties = {
  textAlign: "center",
  color: "#c084fc",
  fontWeight: 700,
  marginBottom: 34,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 22,
};

const card: React.CSSProperties = {
  padding: 24,
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(30,0,65,.92), rgba(8,0,24,.94))",
  border: "1px solid rgba(168,85,247,.45)",
  boxShadow: "0 0 28px rgba(168,85,247,.28)",
  textAlign: "center",
  cursor: "pointer",
  transition: "all .2s ease",
};

const avatar: React.CSSProperties = {
  width: 92,
  height: 92,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid rgba(168,85,247,.8)",
  boxShadow: "0 0 25px rgba(168,85,247,.6)",
};

const name: React.CSSProperties = {
  marginTop: 16,
  fontSize: 26,
  fontWeight: 900,
};

const role: React.CSSProperties = {
  marginTop: 6,
  color: "#c084fc",
  fontSize: 13,
  fontWeight: 900,
  letterSpacing: 1,
};

const button: React.CSSProperties = {
  marginTop: 18,
  width: "100%",
  height: 46,
  borderRadius: 14,
  border: "1px solid rgba(168,85,247,.45)",
  background:
    "linear-gradient(90deg, rgba(124,58,237,.7), rgba(168,85,247,.45))",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};