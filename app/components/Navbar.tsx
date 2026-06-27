"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";
import OnlineUsers from "./OnlineUsers";
import { useMobile } from "../hooks/useMobile";

type Profile = {
  discord_name?: string;
  avatar_url?: string;
  site_role?: string;
  signup_approved?: boolean;
};

export default function Navbar() {
  const isMobile = useMobile();
  const pathname = usePathname();

  const hideNavbar = pathname === "/" || pathname === "/login";

const isGuildSection =
  pathname.startsWith("/guild") ||
  pathname.startsWith("/guild-ranks") ||
  pathname.startsWith("/guild-garrison") ||
  pathname.startsWith("/apply") ||
  pathname.startsWith("/application-forums") ||
  pathname.startsWith("/roster") ||
  pathname.startsWith("/epgp") ||
  pathname.startsWith("/mount-order");

  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const navLink: React.CSSProperties = {
    ...link,
    padding: isMobile ? "3px 5px" : "10px 18px",
    fontSize: isMobile ? 6.5 : 14,
    borderRadius: isMobile ? 10 : 14,
  };

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

      const { data: profileData } = await supabase
        .from("profiles")
        .select("discord_name, avatar_url, site_role, signup_approved")
        .eq("user_id", session.user.id)
        .single();

      setProfile({
        discord_name:
          profileData?.discord_name ||
          discordData?.full_name ||
          discordData?.name ||
          discordData?.preferred_username,

        avatar_url: profileData?.avatar_url || discordData?.avatar_url,

        site_role: profileData?.site_role || "viewer",

        signup_approved: profileData?.signup_approved || false,
      });
    }
  }

  if (hideNavbar) return null;

  return (
    <nav className="navbar">
      <a href="/" className="brand">
        <img src="/websitelogo.png" alt="" />

        <div className="brandText">
          <div className="brandName">Death Wish</div>
          <div className="brandSub">Where Legends Fall</div>

          <div className="brandLine">
            <span />
            <b />
            <span />
          </div>
        </div>
      </a>

      <div className="rightSide">
        {isGuildSection ? (
          <>
            <NavButton href="/" style={navLink}>
              Home
            </NavButton>

            <NavButton href="/guild" style={navLink}>
              Guild Page
            </NavButton>

<NavButton href="/application-forums" style={navLink}>
  Application Forums
</NavButton>

            <NavButton href="/mount-order" style={navLink}>
              Mount Order
            </NavButton>

            <NavButton href="/epgp" style={navLink}>
              EPGP
            </NavButton>

            <NavButton href="/roster" style={navLink}>
              Roster
            </NavButton>

<NavButton href="/guild-ranks" style={navLink}>
  Guild Ranks
</NavButton>

<NavButton href="/guild-garrison" style={navLink}>
  Guild Garrison
</NavButton>

            {!pathname.startsWith("/apply") && (
              <NavButton href="/apply" style={navLink}>
                Apply
              </NavButton>
            )}
          </>
        ) : (
          <>
            <NavButton href="/" style={navLink}>
              Home
            </NavButton>

            <NavButton href="/runs" style={navLink}>
              Sign for Runs
            </NavButton>

            {!profile?.signup_approved && (
              <NavButton href="/runs?apply=true" style={navLink}>
                Apply
              </NavButton>
            )}

            <NavButton href="/my-signups" style={navLink}>
              My runs
            </NavButton>

            {["Nightblade", "Dreadlord"].includes(profile?.site_role || "") && (
              <NavButton href="/booking" style={navLink}>
                Booking
              </NavButton>
            )}

            <NavButton href="/bank" style={navLink}>
              Bank
            </NavButton>

            <NavButton href="/garrisons" style={navLink}>
              Garrisons
            </NavButton>

            <NavButton href="/profile" style={navLink}>
              My Garrison
            </NavButton>
          </>
        )}

        <OnlineUsers />

        {user ? (
          <div className="userBox">
            <img src={profile?.avatar_url || "/logo.png"} alt="" />

            <span>{profile?.discord_name || "User"}</span>

            <button
              onClick={async () => {
                await supabase.auth.signOut();
                localStorage.clear();
                sessionStorage.clear();
                window.location.reload();
              }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <NavButton href="/login" style={navLink}>
            Login
          </NavButton>
        )}
      </div>

      <style jsx>{`
        .navbar {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: ${isMobile ? "10px 8px" : "16px 28px"};
          overflow-x: ${isMobile ? "auto" : "visible"};
          gap: ${isMobile ? "10px" : "0"};
          flex-wrap: nowrap;
          transform: ${isMobile ? "scale(0.64)" : "scale(1)"};
          transform-origin: top left;
          width: ${isMobile ? "156%" : "100%"};
          background: rgba(5, 0, 20, 0.92);
          border-bottom: 1px solid rgba(168, 85, 247, 0.35);
          backdrop-filter: blur(10px);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
          text-decoration: none;
          color: white;
          flex-shrink: 0;
        }

        .brand img {
          width: ${isMobile ? "70px" : "95px"};
          height: ${isMobile ? "70px" : "95px"};
          object-fit: contain;
          margin-top: -18px;
          margin-bottom: -18px;
        }

        .brandText {
          display: ${isMobile ? "none" : "block"};
        }

        .brandName {
          font-size: 32px;
          font-weight: 900;
          font-family: Georgia, serif;
          line-height: 1;
        }

        .brandSub {
          font-size: 15px;
          letter-spacing: 5px;
          color: #bca38c;
          margin-top: 4px;
        }

        .brandLine {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 8px;
        }

        .brandLine span {
          width: 70px;
          height: 1px;
          background: linear-gradient(
            to right,
            transparent,
            rgba(192, 132, 252, 0.9)
          );
        }

        .brandLine span:last-child {
          background: linear-gradient(
            to left,
            transparent,
            rgba(192, 132, 252, 0.9)
          );
        }

        .brandLine b {
          width: 7px;
          height: 7px;
          transform: rotate(45deg);
          background: #c084fc;
          box-shadow: 0 0 12px rgba(192, 132, 252, 0.9);
        }

        .rightSide {
          display: flex;
          align-items: center;
          gap: ${isMobile ? "1px" : "14px"};
          flex-wrap: nowrap;
          justify-content: flex-end;
          flex-shrink: 0;
        }

        .userBox {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-left: 10px;
        }

        .userBox img {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 2px solid #9333ea;
          box-shadow: 0 0 14px rgba(168, 85, 247, 0.55);
        }

        .userBox span {
          color: white;
          font-weight: 900;
          font-size: 14px;
        }

        .userBox button {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid #9333ea;
          background: rgba(147, 51, 234, 0.16);
          color: white;
          font-weight: 900;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.2);
        }

        .userBox button:hover {
          background: linear-gradient(90deg, #9333ea, #d946ef);
          box-shadow: 0 0 18px rgba(217, 70, 239, 0.7);
          transform: scale(1.05);
        }
      `}</style>
    </nav>
  );
}

function NavButton({
  href,
  children,
  style,
}: {
  href: string;
  children: React.ReactNode;
  style: React.CSSProperties;
}) {
  return (
    <a
      href={href}
      style={style}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.06)";
        e.currentTarget.style.background =
          "linear-gradient(90deg,#9333ea,#e879f9)";
        e.currentTarget.style.boxShadow = "0 0 22px rgba(217,70,239,0.9)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.background =
          "linear-gradient(90deg,#6d28d9,#c026d3)";
        e.currentTarget.style.boxShadow = "0 0 14px rgba(168,85,247,0.45)";
      }}
    >
      {children}
    </a>
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
  whiteSpace: "nowrap",
  flexShrink: 0,
};