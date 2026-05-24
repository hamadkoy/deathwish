"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main style={page}>
      <style jsx global>{`
        @keyframes floatParticle {
          0% { transform: translateY(0) scale(1); opacity: 0.25; }
          50% { transform: translateY(-28px) scale(1.25); opacity: 0.85; }
          100% { transform: translateY(0) scale(1); opacity: 0.25; }
        }

        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 35px rgba(168,85,247,.28), inset 0 0 30px rgba(255,255,255,.04); }
          50% { box-shadow: 0 0 55px rgba(217,70,239,.55), inset 0 0 38px rgba(255,255,255,.08); }
        }
      `}</style>

      <video
        id="homeVideo"
        autoPlay
        muted
        loop
        playsInline
        style={videoBg}
      >
        <source src="/home-video.mp4" type="video/mp4" />
      </video>

      <div style={overlay} />

      <div style={particles}>
        {Array.from({ length: 22 }).map((_, i) => (
          <span
            key={i}
            style={{
              ...particle,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 5}s`,
              background:
                i % 3 === 0
                  ? "#facc15"
                  : i % 2 === 0
                  ? "#c084fc"
                  : "#a855f7",
            }}
          />
        ))}
      </div>

      <button
        id="soundButton"
        style={soundBtn}
        onClick={() => {
          const video = document.getElementById("homeVideo") as HTMLVideoElement;
          const button = document.getElementById("soundButton");

          video.muted = !video.muted;
          video.volume = 0.5;
          video.play();

          localStorage.setItem("videoMuted", video.muted ? "true" : "false");

          if (button) {
            button.innerText = video.muted
              ? "🔇 Unmute Sound"
              : "🔊 Mute Sound";
          }
        }}
      >
        🔇 Unmute Sound
      </button>

      <section style={hero}>
        <p style={smallTitle}>WORLD OF WARCRAFT</p>

        <h1 style={title}>DEATH WISH</h1>

        <div style={divider}>
          <div style={line} />
          <div style={diamond} />
          <div style={line} />
        </div>

        <div style={cards}>
          <HomeCard
            href="https://docs.google.com/forms/d/1NiBzQe2cC5Db5vL6UdR7zjOwPdD2WpfKnJM_pyNrw2I/edit"
            icon="/icons/guild-icon.png"
            title="2-DAYS RAIDING GUILD"
            buttonText="Guild Section"
            external
          />

          <HomeCard
            href="/profile"
            icon="/icons/boost-icon.png"
            title="BOOSTING TEAM"
            buttonText="Boost Sections"
          />
        </div>
      </section>
    </main>
  );
}

function HomeCard({
  href,
  icon,
  title,
  buttonText,
  external,
}: {
  href: string;
  icon: string;
  title: string;
  buttonText: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      style={card}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-10px) scale(1.035)";
        e.currentTarget.style.border = "2px solid rgba(250,204,21,0.9)";
        e.currentTarget.style.boxShadow =
          "0 0 70px rgba(217,70,239,0.75), inset 0 0 40px rgba(255,255,255,0.09)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.border = "2px solid rgba(168,85,247,0.62)";
        e.currentTarget.style.boxShadow =
          "0 0 35px rgba(168,85,247,0.28), inset 0 0 30px rgba(255,255,255,0.04)";
      }}
    >
      <div style={iconCircle}>
        <img src={icon} alt="" style={cardIcon} />
      </div>

      <h2 style={cardTitle}>{title}</h2>

      <div style={miniDivider} />

      <div style={button}>{buttonText}</div>
    </Link>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  color: "white",
  fontFamily: "Arial, sans-serif",
};

const videoBg: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
  zIndex: -3,
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background:
    "linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.58)), radial-gradient(circle at center, rgba(168,85,247,0.16), transparent 48%)",
  zIndex: -2,
};

const particles: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: -1,
};

const particle: React.CSSProperties = {
  position: "absolute",
  width: 5,
  height: 5,
  borderRadius: "50%",
  boxShadow: "0 0 18px currentColor",
  animationName: "floatParticle",
  animationIterationCount: "infinite",
  animationTimingFunction: "ease-in-out",
};

const hero: React.CSSProperties = {
  minHeight: "calc(100vh - 78px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  padding: "40px 20px",
  transform: "translateY(-20px)",
};

const smallTitle: React.CSSProperties = {
  color: "#d8b4fe",
  letterSpacing: 10,
  fontWeight: 900,
  marginBottom: 12,
  textShadow: "0 0 15px rgba(216,180,254,0.8)",
};

const title: React.CSSProperties = {
  fontSize: 120,
  fontWeight: 900,
  margin: 0,
  color: "#fff",
  letterSpacing: 8,
  textShadow:
    "0 0 15px rgba(255,255,255,0.7), 0 0 35px rgba(192,132,252,0.9)",
};

const divider: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  marginTop: 28,
  marginBottom: 44,
};

const line: React.CSSProperties = {
  width: 210,
  height: 2,
  background: "linear-gradient(to right, transparent, #c084fc, transparent)",
};

const diamond: React.CSSProperties = {
  width: 16,
  height: 16,
  background: "#c084fc",
  transform: "rotate(45deg)",
  boxShadow: "0 0 18px #c084fc",
};

const cards: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 520px)",
  gap: 34,
  justifyContent: "center",
};

const card: React.CSSProperties = {
  minHeight: 360,
  padding: "42px 46px",
  borderRadius: 18,
  textDecoration: "none",
  color: "white",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "space-between",
  background:
    "linear-gradient(180deg, rgba(18,10,18,0.92), rgba(5,3,5,0.96))",
  border: "2px solid rgba(168,85,247,0.62)",
  backdropFilter: "blur(10px)",
  transition: "all 0.28s ease",
  animation: "pulseGlow 4.5s ease-in-out infinite",
};

const iconCircle: React.CSSProperties = {
  width: 86,
  height: 86,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "radial-gradient(circle at top, rgba(255,255,255,0.16), rgba(80,30,120,0.96))",
  border: "2px solid rgba(255,215,120,0.55)",
  boxShadow:
    "0 0 28px rgba(255,215,120,0.35), inset 0 0 15px rgba(255,255,255,0.08)",
};

const cardIcon: React.CSSProperties = {
  width: 150,
  height: 150,
  objectFit: "contain",
};

const cardTitle: React.CSSProperties = {
  fontSize: 34,
  lineHeight: 1.2,
  margin: 0,
  color: "#fcd34d",
  fontWeight: 900,
  letterSpacing: 1.5,
  textTransform: "uppercase",
};

const miniDivider: React.CSSProperties = {
  width: 150,
  height: 2,
  background: "linear-gradient(to right, transparent, #fcd34d, transparent)",
};

const button: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 190,
  height: 56,
  borderRadius: 10,
  background: "linear-gradient(180deg, #d946ef, #7e22ce)",
  color: "white",
  fontWeight: 900,
  fontSize: 17,
  letterSpacing: 1,
  border: "1px solid rgba(255,255,255,0.22)",
  boxShadow:
    "0 0 28px rgba(192,38,211,0.65), inset 0 0 12px rgba(255,255,255,0.14)",
};

const soundBtn: React.CSSProperties = {
  position: "fixed",
  bottom: 24,
  right: 24,
  zIndex: 10,
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "linear-gradient(90deg,#6d28d9,#c026d3)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 18px rgba(168,85,247,0.55)",
};