"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const allowedGuildRoles = [
  "Trial",
  "Raider",
  "Officer",
  "Death Wish",
  "Guild Master",
];

export default function GuildAccessGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("guild_role, accepted_application, signup_approved")
        .eq("user_id", user.id)
        .single();

      if (error || !profile) {
        setAllowed(false);
        setChecking(false);
        return;
      }

      const hasGuildRank =
        profile.accepted_application === true &&
        profile.signup_approved === true &&
        allowedGuildRoles.includes(profile.guild_role);

      setAllowed(hasGuildRank);
      setChecking(false);
    }

    checkAccess();
  }, [router]);

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(rgba(0,0,0,.65), rgba(0,0,0,.75)), url('/bg.png') center/cover no-repeat",
          color: "#ff6b7a",
          fontSize: 42,
          fontWeight: 900,
          textShadow: "0 0 18px rgba(255,80,120,.8)",
        }}
      >
        Checking Access...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(rgba(0,0,0,.75), rgba(0,0,0,.85)), url('/bg.png') center/cover no-repeat",
          textAlign: "center",
          padding: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 72, marginBottom: 20 }}>🔒</div>

          <h1
            style={{
              color: "#ff4d6d",
              fontSize: 42,
              fontWeight: 900,
              marginBottom: 12,
              textShadow: "0 0 20px rgba(255,77,109,.8)",
            }}
          >
            Access Denied
          </h1>

          <p
            style={{
              color: "#d1d5db",
              fontSize: 20,
              maxWidth: 600,
              lineHeight: 1.6,
            }}
          >
            You do not meet the requirements to view this page.
            <br />
            Only Trial, Raider, Officer, Death Wish, and Guild Master members
            can access this section.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}