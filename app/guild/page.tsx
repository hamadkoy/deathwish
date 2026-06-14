"use client";

import Link from "next/link";

const raids = [
  { name: "Blackrock Foundry", img: "/Blackrock foundry.png" },
  { name: "Hellfire Citadel", img: "/Hellfire Citadel.png" },
  { name: "The Emerald Nightmare", img: "/The Emerald Nightmare.png" },
  { name: "The Nighthold", img: "/nightblade.png" },
  { name: "Trial of Valor", img: "/Trial of Valor.png" },
  { name: "Antorus, The Burning Throne", img: "/Antorus, The Burning Throne.png" },
  { name: "Ny'alotha, The Waking City", img: "/Nyalotha, The Waking City.png" },
  { name: "Sanctum of Domination", img: "/Sanctum of Domination.png" },
  { name: "Aberrus, The Shadowed Crucible", img: "/Aberus, The Shadow Crucible.png" },
  { name: "Amirdrassil, The Dream's Hope", img: "/Amirdrassil, The Dream's Hope.png" },
  { name: "Nerub-ar Palace", img: "/Nerub-AR Palace.png" },
  { name: "Liberation of Undermine", img: "/Liberation of Undermine.png" },
  { name: "Manaforge Omega", img: "/Manaforge Omega.png" },
];

export default function GuildPage() {
  return (
    <main style={page}>
      <nav style={guildNav}>
        <div style={brand}>☠ DEATH WISH</div>

        <div style={navLinks}>
          <Link href="/" style={navLink}>HOME</Link>
          <a href="#about" style={navLink}>ABOUT</a>
          <a href="#raids" style={navLink}>RAIDS</a>
          <a href="#recruitment" style={navLink}>RECRUITMENT</a>
          <Link href="/login" style={applyTop}>APPLY NOW</Link>
        </div>
      </nav>

      <section style={hero}>
        <h1 style={title}>DEATH WISH</h1>
        <p style={subtitle}>2-DAY CUTTING EDGE RAIDING GUILD</p>
      </section>

      <section id="raids" style={section}>
        <h2 style={sectionTitle}>CUTTING EDGE ACHIEVEMENTS</h2>

        <div style={raidGrid}>
          {raids.map((raid, i) => (
            <div key={raid.name} style={raidCard}>
              <div style={{ ...raidImage, backgroundImage: `url("${raid.img}")` }}>
                <span style={raidNumber}>{i + 1}</span>
              </div>
              <div style={raidName}>{raid.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="about" style={aboutCard}>
        <div style={aboutText}>
          <h2 style={goldTitle}>ABOUT DEATH WISH</h2>
          <p>Death Wish is a 2-day raiding guild established in 2013.</p>
          <p>
            We focus on Mythic progression, Cutting Edge achievements, and
            building a strong team of reliable players.
          </p>
          <p>
            Our goal is simple: clear Mythic content efficiently while keeping a
            stable and positive raiding environment.
          </p>
        </div>
      </section>

      <section id="recruitment" style={bottomGrid}>
        <div style={infoCard}>
          <h2 style={goldTitle}>RAIDING TIME</h2>
          <p>📅 Sunday — 18:00 - 22:00 Server Time</p>
          <p>📅 Monday — 18:00 - 22:00 Server Time</p>
          <p style={muted}>
            We may add extra days or hours during the first week of a new season.
          </p>
        </div>

        <div style={infoCard}>
          <h2 style={goldTitle}>RECRUITING</h2>
          <p>
            We are looking for skilled players with Mythic raiding experience,
            a positive attitude, and strong attendance.
          </p>
          <p style={highlight}>Mainly interested in ranged DPS.</p>

          <Link href="/login" style={applyBtn}>
            Apply to Death Wish
          </Link>
        </div>
      </section>

      <footer style={footer}>FIGHT TOGETHER. WIN TOGETHER.</footer>
    </main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  background: "#030303",
  color: "#f5ead0",
  fontFamily: "Georgia, serif",
};

const guildNav: React.CSSProperties = {
  height: 70,
  padding: "0 36px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "rgba(0,0,0,.92)",
  borderBottom: "1px solid rgba(201,170,113,.35)",
  position: "sticky",
  top: 0,
  zIndex: 50,
};

const brand: React.CSSProperties = {
  color: "#c9aa71",
  fontWeight: 900,
  fontSize: 24,
};

const navLinks: React.CSSProperties = {
  display: "flex",
  gap: 32,
  alignItems: "center",
};

const navLink: React.CSSProperties = {
  color: "#d6c18f",
  textDecoration: "none",
  fontSize: 13,
  letterSpacing: 2,
  fontWeight: 900,
};

const applyTop: React.CSSProperties = {
  ...navLink,
  border: "1px solid #c9aa71",
  padding: "10px 18px",
  borderRadius: 6,
};

const hero: React.CSSProperties = {
  height: 520,
  background:
    "linear-gradient(rgba(0,0,0,.05), rgba(0,0,0,.72)), url('/Guild.png') center / cover no-repeat",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  borderBottom: "1px solid rgba(201,170,113,.35)",
};

const title: React.CSSProperties = {
  fontSize: 120,
  margin: 0,
  color: "#c9aa71",
  letterSpacing: 8,
  fontWeight: 900,
  textShadow: "0 4px 0 #2a1b0b, 0 0 25px rgba(201,170,113,.35)",
};

const subtitle: React.CSSProperties = {
  color: "#e7d6aa",
  fontSize: 24,
  letterSpacing: 6,
  fontWeight: 900,
};

const section: React.CSSProperties = {
  maxWidth: 1320,
  margin: "0 auto",
  padding: "36px 24px",
};

const sectionTitle: React.CSSProperties = {
  textAlign: "center",
  color: "#c9aa71",
  fontSize: 28,
  letterSpacing: 3,
  marginBottom: 30,
};

const raidGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 16,
};

const raidCard: React.CSSProperties = {
  border: "1px solid rgba(201,170,113,.45)",
  borderRadius: 7,
  overflow: "hidden",
  background: "#090705",
};

const raidImage: React.CSSProperties = {
  height: 150,
  backgroundSize: "cover",
  backgroundPosition: "center",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  paddingBottom: 10,
};

const raidNumber: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "2px solid #c9aa71",
  background: "rgba(0,0,0,.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const raidName: React.CSSProperties = {
  minHeight: 60,
  padding: 10,
  textAlign: "center",
  color: "#f1e2bb",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const aboutCard: React.CSSProperties = {
  maxWidth: 1260,
  margin: "0 auto 24px",
  minHeight: 230,
  border: "1px solid rgba(201,170,113,.35)",
  borderRadius: 8,
  background:
    "linear-gradient(90deg, rgba(0,0,0,.92), rgba(0,0,0,.25)), url('/Guild.png') center / cover no-repeat",
  padding: 44,
};

const aboutText: React.CSSProperties = {
  maxWidth: 540,
  lineHeight: 1.8,
};

const bottomGrid: React.CSSProperties = {
  maxWidth: 1260,
  margin: "0 auto",
  padding: "0 24px",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 20,
};

const infoCard: React.CSSProperties = {
  minHeight: 210,
  padding: 34,
  borderRadius: 8,
  border: "1px solid rgba(201,170,113,.35)",
  background: "linear-gradient(135deg, rgba(0,0,0,.92), rgba(18,12,8,.95))",
};

const goldTitle: React.CSSProperties = {
  color: "#c9aa71",
  fontSize: 28,
  letterSpacing: 2,
  marginTop: 0,
};

const muted: React.CSSProperties = {
  color: "#b8a985",
};

const highlight: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 900,
};

const applyBtn: React.CSSProperties = {
  display: "inline-flex",
  padding: "12px 22px",
  borderRadius: 6,
  background: "linear-gradient(180deg,#c9aa71,#7a5525)",
  color: "#120b04",
  fontWeight: 900,
  textDecoration: "none",
};

const footer: React.CSSProperties = {
  textAlign: "center",
  padding: "28px 20px 42px",
  color: "#c9aa71",
  letterSpacing: 4,
  fontWeight: 900,
};