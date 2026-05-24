"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";
import OnlineUsers from "./OnlineUsers";

type Profile = {
  discord_name?: string;
  avatar_url?: string;
};

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();
const hideNavbar =
  pathname === "/" || pathname === "/login";
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadUser();

    supabase.auth.onAuthStateChange(() => {
      loadUser();
    });
  }, []);

  async function loadUser() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    setUser(session?.user || null);

    if (session?.user) {
      const discordData = session.user.user_metadata;

      setProfile({
        discord_name:
          discordData?.full_name ||
          discordData?.name ||
          discordData?.preferred_username,
        avatar_url: discordData?.avatar_url,
      });
    }
  }

if (hideNavbar) return null;

return (
  <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 28px",
        background: "rgba(5,0,20,0.92)",
        borderBottom: "1px solid rgba(168,85,247,0.35)",
        backdropFilter: "blur(10px)",
      }}
    >
{/* LEFT SIDE */}
<a
  href="/"
  style={{
    display: "flex",
    alignItems: "center",
    gap: 14,
    textDecoration: "none",
    color: "white",
  }}
>
  <img
    src="/websitelogo.png"
    alt=""
style={{
  width: 120,
  height: 120,
  objectFit: "contain",
  marginTop: -18,
  marginBottom: -18,
}}
  />

  <div>
    <div
      style={{
        fontSize: 32,
        fontWeight: 900,
        fontFamily: "Georgia, serif",
        lineHeight: 1,
      }}
    >
      Death Wish
    </div>

<div
  style={{
    fontSize: 15,
    letterSpacing: 5,
    color: "#bca38c",
    marginTop: 4,
  }}
>
  Where Legends Fall
</div>

<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  }}
>
  <div
    style={{
      width: 70,
      height: 1,
      background:
        "linear-gradient(to right, transparent, rgba(192,132,252,.9))",
    }}
  />

  <div
    style={{
      width: 7,
      height: 7,
      transform: "rotate(45deg)",
      background: "#c084fc",
      boxShadow: "0 0 12px rgba(192,132,252,.9)",
    }}
  />

  <div
    style={{
      width: 70,
      height: 1,
      background:
        "linear-gradient(to left, transparent, rgba(192,132,252,.9))",
    }}
  />
</div>
  </div>
</a>

{/* RIGHT SIDE */}

<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 14,
  }}
>
        <a
  href="/"
  style={link}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.06)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#9333ea,#e879f9)";
    e.currentTarget.style.boxShadow =
      "0 0 22px rgba(217,70,239,0.9)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#6d28d9,#c026d3)";
    e.currentTarget.style.boxShadow =
      "0 0 14px rgba(168,85,247,0.45)";
  }}
>
          Home
        </a>
<a
  href="/runs"
  style={link}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.06)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#9333ea,#e879f9)";
    e.currentTarget.style.boxShadow =
      "0 0 22px rgba(217,70,239,0.9)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#6d28d9,#c026d3)";
    e.currentTarget.style.boxShadow =
      "0 0 14px rgba(168,85,247,0.45)";
  }}
>
 Sign for Runs
</a>
<a
  href="/runs?apply=true"
  style={link}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.06)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#9333ea,#e879f9)";
    e.currentTarget.style.boxShadow =
      "0 0 22px rgba(217,70,239,0.9)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#6d28d9,#c026d3)";
    e.currentTarget.style.boxShadow =
      "0 0 14px rgba(168,85,247,0.45)";
  }}
>
  Apply
</a>
<a
  href="/my-signups"
  style={link}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.06)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#9333ea,#e879f9)";
    e.currentTarget.style.boxShadow =
      "0 0 22px rgba(217,70,239,0.9)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#6d28d9,#c026d3)";
    e.currentTarget.style.boxShadow =
      "0 0 14px rgba(168,85,247,0.45)";
  }}
>
  My runs
</a>
<a
  href="/booking"
  style={link}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.06)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#9333ea,#e879f9)";
    e.currentTarget.style.boxShadow =
      "0 0 22px rgba(217,70,239,0.9)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#6d28d9,#c026d3)";
    e.currentTarget.style.boxShadow =
      "0 0 14px rgba(168,85,247,0.45)";
  }}
>
  Booking
</a>
<a
  href="/bank"
  style={link}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.06)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#9333ea,#e879f9)";
    e.currentTarget.style.boxShadow =
      "0 0 22px rgba(217,70,239,0.9)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#6d28d9,#c026d3)";
    e.currentTarget.style.boxShadow =
      "0 0 14px rgba(168,85,247,0.45)";
  }}
>
  Bank
</a>
<a

  href="/profile"
  style={link}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.06)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#9333ea,#e879f9)";
    e.currentTarget.style.boxShadow =
      "0 0 22px rgba(217,70,239,0.9)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#6d28d9,#c026d3)";
    e.currentTarget.style.boxShadow =
      "0 0 14px rgba(168,85,247,0.45)";
  }}
>
  My Garrison
</a>

<OnlineUsers />
        {user ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginLeft: 10,
            }}
          >
            <img
              src={profile?.avatar_url || "/logo.png"}
              alt=""
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                border: "2px solid #9333ea",
                boxShadow: "0 0 14px rgba(168,85,247,0.55)",
              }}
            />

            <span
              style={{
                color: "white",
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              {profile?.discord_name || "User"}
            </span>

            <button
           onClick={async () => {
  await supabase.auth.signOut();

  localStorage.clear();
  sessionStorage.clear();

  window.location.reload();
}}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid #9333ea",
                background: "rgba(147,51,234,0.16)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 0 12px rgba(168,85,247,0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "linear-gradient(90deg,#9333ea,#d946ef)";
                e.currentTarget.style.boxShadow =
                  "0 0 18px rgba(217,70,239,0.7)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  "rgba(147,51,234,0.16)";
                e.currentTarget.style.boxShadow =
                  "0 0 12px rgba(168,85,247,0.2)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <a href="/login" style={link}>
            Login
          </a>
        )}
      </div>

    </nav>
  );
}

const link: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 12,
  border: "1px solid rgba(217,70,239,0.45)",
  background: "linear-gradient(90deg,#6d28d9,#c026d3)",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 14,
  textDecoration: "none",
  transition: "all 0.22s ease",
  boxShadow: "0 0 14px rgba(168,85,247,0.45)",
};