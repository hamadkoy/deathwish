"use client";

import Navbar from "@/app/components/Navbar";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  return (
    <main className="loginPage">
      <div className="bgImage" />
      <div className="bgFog" />
      <div className="bgGlow" />

      <Navbar />

      <section className="loginWrap">
        <div className="loginCard">
          <img src="/logo.png" className="loginLogo" alt="Death Wish" />

          <p className="guildText">DEATH WISH</p>
          <h1>ENTER THE GUILD</h1>

          <p className="subText">
            Sign in with Discord to access raid signups, bookings, bank,
            logs and your garrison.
          </p>

          <button
            className="discordBtn"
            onClick={async () => {
localStorage.setItem("redirectAfterLogin", "/runs");

              await supabase.auth.signInWithOAuth({
                provider: "discord",
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                },
              });
            }}
          >
            Login with Discord
          </button>

          <p className="quote">Where Legends Fall</p>
        </div>
      </section>

      <style jsx>{`
        .loginPage {
          min-height: 100vh;
          position: relative;
          overflow: hidden;
          color: white;
          background: #020006;
        }

        .bgImage {
          position: absolute;
          inset: 0;
          background-image: url("/login-bg.png");
          background-size: cover;
          background-position: center;
          opacity: 0.45;
          filter: saturate(1.2) contrast(1.15);
        }

        .bgFog {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to bottom, rgba(0,0,0,0.2), #020006 95%),
            radial-gradient(circle at center, rgba(147,51,234,0.25), transparent 45%),
            radial-gradient(circle at bottom left, rgba(88,28,135,0.5), transparent 40%);
        }

        .bgGlow {
          position: absolute;
          width: 700px;
          height: 700px;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          background: rgba(168,85,247,0.18);
          filter: blur(100px);
          border-radius: 999px;
        }

        .loginWrap {
          position: relative;
          z-index: 2;
          min-height: calc(100vh - 90px);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 30px;
        }

        .loginCard {
          width: 100%;
          max-width: 520px;
          padding: 48px;
          text-align: center;
          border-radius: 30px;
          background: rgba(8, 0, 18, 0.75);
          border: 1px solid rgba(192,132,252,0.45);
          box-shadow:
            0 0 90px rgba(168,85,247,0.35),
            inset 0 0 35px rgba(168,85,247,0.12);
          backdrop-filter: blur(16px);
        }

        .loginLogo {
          width: 95px;
          margin-bottom: 18px;
          filter: drop-shadow(0 0 18px #a855f7);
        }

        .guildText {
          color: #d8b4fe;
          letter-spacing: 8px;
          font-size: 12px;
          font-weight: 900;
        }

        h1 {
          margin: 14px 0;
          font-size: 54px;
          font-weight: 1000;
          background: linear-gradient(to bottom, #fff, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .subText {
          color: #ddd6fe;
          line-height: 1.7;
          margin-bottom: 32px;
        }

        .discordBtn {
          width: 100%;
          padding: 18px;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,0.2);
          background: linear-gradient(135deg, #5865f2, #9333ea);
          color: white;
          font-weight: 1000;
          cursor: pointer;
          box-shadow: 0 0 35px rgba(147,51,234,0.55);
          transition: 0.25s;
        }

        .discordBtn:hover {
          transform: scale(1.04);
          box-shadow: 0 0 55px rgba(192,132,252,0.8);
        }

        .quote {
          margin-top: 28px;
          color: #a855f7;
          font-size: 13px;
        }
      `}</style>
    </main>
  );
}