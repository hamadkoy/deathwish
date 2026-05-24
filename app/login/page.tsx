"use client";

import Navbar from "@/app/components/Navbar";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #3b0764 0%, #050014 45%, #000 100%)",
        color: "white",
      }}
    >
      <Navbar />

      <div
        style={{
          maxWidth: 420,
          margin: "120px auto",
          padding: 36,
          border: "1px solid #7e22ce",
          borderRadius: 24,
          background: "rgba(10,0,25,0.85)",
          textAlign: "center",
          boxShadow: "0 0 40px rgba(168,85,247,0.25)",
        }}
      >
        <p style={{ color: "#c084fc", letterSpacing: 6 }}>DEATH WISH</p>

        <h1 style={{ fontSize: 48, margin: "20px 0" }}>LOGIN</h1>

        <p style={{ color: "#a78bfa" }}>
          Login with Discord to access raid signups.
        </p>

        <button
          onClick={async () => {
            await supabase.auth.signInWithOAuth({
              provider: "discord",
              options: {
                redirectTo: "http://localhost:3001/runs",
              },
            });
          }}
          style={{
            marginTop: 30,
            width: "100%",
            padding: 16,
            borderRadius: 14,
            border: "none",
            background: "#5865F2",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Login with Discord
        </button>
      </div>
    </main>
  );
}