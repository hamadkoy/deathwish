"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMobile } from "@/app/hooks/useMobile";
export default function SideNav({ active }: { active: string }) {
  const [pendingCount, setPendingCount] = useState(0);
const isMobile = useMobile();
useEffect(() => {
  loadPendingApplicants();

  const channel = supabase
    .channel("realtime-pending-applications")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "profiles",
      },
      () => {
        loadPendingApplicants();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);

async function loadPendingApplicants() {
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("signup_approved", false)
    .not("applied_at", "is", null);

  setPendingCount(count || 0);
}

  const items = [
    { name: "My Runs", href: "/my-signups" },
    { name: "Messages", href: "#" },
    { name: "Raid Logs", href: "/raid-logs" },
    { name: "Leaderboard", href: "#" },
    { name: "👑 Users", href: "/admin/users", badge: pendingCount },
    { name: "My Garrison", href: "/profile" },
    { name: "Bank", href: "/bank" },
  ];

 return (
  <div
    style={{
      ...navBox,

      width: isMobile ? 88 : undefined,
      padding: isMobile ? 6 : 14,
      borderRadius: isMobile ? 10 : 18,
    }}
  >
  <div
  style={{
    ...smallTitle,
    fontSize: isMobile ? 8 : 13,
    marginBottom: isMobile ? 8 : 16,
  }}
>
  NAVIGATION
</div>

      {items.map((item) => {
        const isActive = active === item.name || active === item.name.replace("👑 ", "");

        return (
          <Link key={item.name} href={item.href} style={{ textDecoration: "none" }}>
            <div
              style={{
  ...(isActive ? sideActive : sideItem),

  padding: isMobile ? "7px 5px" : "12px 14px",
  fontSize: isMobile ? 10 : 14,
  borderRadius: isMobile ? 8 : 12,
  marginBottom: isMobile ? 4 : 7,
}}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(139,92,246,0.22)";
                e.currentTarget.style.boxShadow =
                  "0 0 22px rgba(168,85,247,0.65), inset 0 0 14px rgba(168,85,247,0.18)";
                e.currentTarget.style.color = "white";
                e.currentTarget.style.transform = "translateX(6px) scale(1.03)";
                e.currentTarget.style.border = "1px solid rgba(216,180,254,.45)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.color = "#d7d7e6";
                  e.currentTarget.style.transform = "translateX(0) scale(1)";
                  e.currentTarget.style.border = "1px solid transparent";
                }
              }}
            >
              <span>{item.name}</span>

              {item.badge && item.badge > 0 ? (
                <span style={badge}>{item.badge}</span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

const navBox: React.CSSProperties = {
  position: "relative",
  padding: 14,
  borderRadius: 18,
  background:
    "linear-gradient(180deg, rgba(10,15,35,.92), rgba(4,7,18,.96))",
  border: "1px solid rgba(168,85,247,.22)",
  boxShadow:
    "0 0 24px rgba(168,85,247,.16), inset 0 0 22px rgba(168,85,247,.06)",
};

const smallTitle: React.CSSProperties = {
  color: "#a78bfa",
  fontWeight: 900,
  marginBottom: 16,
  fontSize: 13,
  letterSpacing: 1.2,
  textShadow: "0 0 12px rgba(168,85,247,.7)",
};

const sideItem: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  marginBottom: 7,
  color: "#d7d7e6",
  fontWeight: 800,
  transition: "all 0.22s ease",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  border: "1px solid transparent",
};

const sideActive: React.CSSProperties = {
  ...sideItem,
  background:
    "linear-gradient(90deg, rgba(88,28,135,.75), rgba(139,92,246,.45))",
  color: "white",
  border: "1px solid rgba(216,180,254,.45)",
  boxShadow:
    "0 0 22px rgba(168,85,247,.65), inset 0 0 16px rgba(168,85,247,.18)",
};

const badge: React.CSSProperties = {
  minWidth: 24,
  height: 22,
  padding: "0 7px",
  borderRadius: 999,
  background: "linear-gradient(90deg,#dc2626,#ef4444)",
  color: "white",
  fontSize: 12,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 0 16px rgba(239,68,68,.95)",
};