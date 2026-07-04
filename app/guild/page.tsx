"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const raids = [
  { name: "Blackrock Foundry", img: "/Blackrock foundry.png", date: "May 2015" },
  { name: "Hellfire Citadel", img: "/Hellfire Citadel.png", date: "Nov 2015" },
  { name: "The Emerald Nightmare", img: "/The Emerald Nightmare.png", date: "Oct 2016" },
  { name: "The Nighthold", img: "/The Nighthold.png", date: "Mar 2017" },
  { name: "Trial of Valor", img: "/Trial of Valor.png", date: "Jan 2017" },
  { name: "Antorus, The Burning Throne", img: "/Antorus, The Burning Throne.png", date: "Jan 2018" },
  { name: "Ny'alotha, The Waking City", img: "/Nyalotha, The Waking City.png", date: "Apr 2020" },
  { name: "Sanctum of Domination", img: "/Sanctum of Domination.png", date: "Sep 2021" },
  { name: "Aberrus, The Shadowed Crucible", img: "/Aberus, The Shadow Crucible.png", date: "Jun 2023" },
  { name: "Amirdrassil, The Dream's Hope", img: "/Amidrassil, The Dream's Hope.png", date: "Jan 2024" },
  { name: "Nerub-ar Palace", img: "/Nerub-AR Palace.png", date: "Oct 2024" },
  { name: "Liberation of Undermine", img: "/Liberation of Undermine.png", date: "Mar 2025" },
  { name: "Manaforge Omega", img: "/Manaforge Omega.png", date: "Sep 2025" },
];

// Coverflow geometry
const N = raids.length;
const CARD_WIDTH = 560;
const CARD_HEIGHT = 340;
const SPACING = 400; // horizontal distance between neighboring cards
const MAX_ANGLE = 48; // degrees the side cards rotate
const VISIBLE_RANGE = 3.4; // how many cards deep either side stay rendered
const AUTO_SPEED = 0.14; // index-units per second — slow drift

export default function GuildPage() {
const [user, setUser] = useState<any>(null);
const [profile, setProfile] = useState<any>(null);
const [onlineCount, setOnlineCount] = useState(4);
const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
const [onlineOpen, setOnlineOpen] = useState(false);

// --- Coverflow state ---
const [pos, setPos] = useState(0); // continuous "center index", float
const [animated, setAnimated] = useState(false);
const [hoverPaused, setHoverPaused] = useState(false);
const [clickPaused, setClickPaused] = useState(false);
const paused = hoverPaused || clickPaused;

const rafRef = useRef<number | null>(null);
const lastTimeRef = useRef<number | null>(null);
const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  const tick = (time: number) => {
    if (lastTimeRef.current == null) lastTimeRef.current = time;
    const delta = time - lastTimeRef.current;
    lastTimeRef.current = time;

    if (!paused) {
      setPos((p) => {
        let next = p + (AUTO_SPEED * delta) / 1000;
        next = ((next % N) + N) % N;
        return next;
      });
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  rafRef.current = requestAnimationFrame(tick);
  return () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    lastTimeRef.current = null;
  };
}, [paused]);

const pauseThenResume = () => {
  setClickPaused(true);
  if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
  clickTimerRef.current = setTimeout(() => setClickPaused(false), 3800);
};

const jump = (dir: 1 | -1) => {
  setAnimated(true);
  if (animTimerRef.current) clearTimeout(animTimerRef.current);
  animTimerRef.current = setTimeout(() => setAnimated(false), 550);

  setPos((p) => {
    let next = p + dir;
    next = ((next % N) + N) % N;
    return next;
  });
  pauseThenResume();
};

const goLeft = () => jump(-1);
const goRight = () => jump(1);

const goTo = (index: number) => {
  setAnimated(true);
  if (animTimerRef.current) clearTimeout(animTimerRef.current);
  animTimerRef.current = setTimeout(() => setAnimated(false), 550);
  setPos(index);
  pauseThenResume();
};

useEffect(() => {
  const loadUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);

    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("discord_name, avatar_url")
        .eq("user_id", user.id)
        .single();

      setProfile(data);
    }

    const { data: online } = await supabase
      .from("profiles")
      .select("discord_name, avatar_url, site_role")
      .not("avatar_url", "is", null)
      .limit(5);

    setOnlineUsers(online || []);
    setOnlineCount(online?.length || 0);
  };

  loadUser();
}, []);
  return (
    <main className="page">
      <section className="hero">
        <h1>DEATH WISH</h1>
        <p>2-DAY CUTTING EDGE RAIDING GUILD</p>
      </section>

      <section id="raids" className="section">
        <h2>CUTTING EDGE ACHIEVEMENTS</h2>

        <div
          className="coverflowWrap"
          onMouseEnter={() => setHoverPaused(true)}
          onMouseLeave={() => setHoverPaused(false)}
        >
          <button
            className="carouselArrow carouselArrowLeft"
            onClick={goLeft}
            aria-label="Previous achievement"
          >
            ‹
          </button>

          <div className="coverflowStage">
            {raids.map((raid, i) => {
              let diff = i - pos;
              diff = ((diff % N) + N) % N;
              if (diff > N / 2) diff -= N;

              const absDiff = Math.abs(diff);
              if (absDiff > VISIBLE_RANGE) return null;

              const translateX = diff * SPACING;
              const rotateY = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, -diff * 32));
              const scale = Math.max(0.5, 1 - absDiff * 0.17);
              const translateZ = -absDiff * 110;
              const zIndex = Math.round(100 - absDiff * 10);
              const opacity = Math.max(0, 1 - absDiff * 0.3);
              const isCenter = absDiff < 0.5;

              return (
                <div
                  key={raid.name}
                  className={`coverCard${isCenter ? " coverCardActive" : ""}`}
                  style={{
                    backgroundImage: `url("${raid.img}")`,
                    transform: `translate(-50%, -50%) translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                    zIndex,
                    opacity,
                    transition: animated
                      ? "transform .55s cubic-bezier(.22,.9,.35,1), opacity .55s ease"
                      : "none",
                  }}
                  onClick={() => goTo(i)}
                >
                  <div className="achievementOverlay">
                    <div className="achievementTop">
                      <span className="achievementNumber">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="achievementBadge">CLEARED</span>
                    </div>

                    <div className="achievementText">
                      <p>CUTTING EDGE</p>
                      <h3>{raid.name}</h3>
                      <small>{raid.date}</small>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            className="carouselArrow carouselArrowRight"
            onClick={goRight}
            aria-label="Next achievement"
          >
            ›
          </button>
        </div>
      </section>

      <section className="infoGrid">
        <div id="about" className="infoCard aboutCard">
          <div className="aboutText">
            <h2>ABOUT DEATH WISH</h2>
            <p>Death Wish is a 2-day raiding guild established in 2013.</p>
            <p>
              We focus on Mythic progression, Cutting Edge achievements, and
              building a strong team of reliable players.
            </p>
            <p>
              Our goal is simple: clear Mythic content efficiently while keeping
              a stable and positive raiding environment.
            </p>
          </div>
        </div>

        <div className="infoCard raidTimeCard">
          <h2>RAID TIMES</h2>

<div className="timeRow">
  <span className="dayLabel">
    <img src="/calander.png" alt="" className="calendarIcon" />
    SUNDAY
  </span>
  <span>18:00 - 22:00</span>
</div>

<div className="timeRow">
  <span className="dayLabel">
    <img src="/calander.png" alt="" className="calendarIcon" />
    MONDAY
  </span>
  <span>18:00 - 22:00</span>
</div>

          <p className="muted">
            We may add extra days or hours during the first week of a new
            season.
          </p>
        </div>
      </section>

<section
  id="apply"
  style={{
    display: "flex",
    justifyContent: "center",
    marginTop: 35,
    marginBottom: 35,
  }}
>
<Link
  href="/apply"
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    width: "240px",
    height: "62px",

    borderRadius: "14px",
    border: "1px solid #d946ef",

    background: "linear-gradient(90deg,#6d28d9,#c026d3)",

    color: "#fff",
    textDecoration: "none",

    fontSize: "18px",
    fontWeight: 900,
    letterSpacing: "2px",

    boxShadow: "0 0 18px rgba(217,70,239,.45)",

    transition: "all .25s ease",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.08)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#9333ea,#e879f9)";
    e.currentTarget.style.boxShadow =
      "0 0 32px rgba(217,70,239,.85)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.background =
      "linear-gradient(90deg,#6d28d9,#c026d3)";
    e.currentTarget.style.boxShadow =
      "0 0 18px rgba(217,70,239,.45)";
  }}
>
  APPLY NOW
</Link>
</section>

      <footer>FIGHT TOGETHER. WIN TOGETHER.</footer>

      <style jsx>{`
.page {
  min-height: 100vh;
  color: #f5ead0;
  font-family: Georgia, serif;

  background:
    linear-gradient(
      rgba(0, 0, 0, 0.15),
      rgba(0, 0, 0, 0.45)
    ),
    url("/Guild.png");

  background-size: cover;
  background-position: center top;
  background-attachment: fixed;
}
        .guildNav {
          height: 46px;
          padding: 0 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(0, 0, 0, 0.96);
          border-bottom: 1px solid rgba(201, 170, 113, 0.35);
          position: sticky;
          top: 0;
          z-index: 50;
          overflow: visible;
        }

        .brand {
         color: #e879f9;
          font-weight: 900;
          font-size: 16px;
        }

.navLinks {
  display: flex;
  gap: 12px;
  align-items: center;
}

.navLinks a {
  padding: 12px 18px;
  border-radius: 12px;
  background: linear-gradient(180deg,#d946ef,#7e22ce);
  color: white;
  text-decoration: none;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0;
}

        .applyTop {
          border: 1px solid #c9aa71;
          padding: 7px 14px;
          border-radius: 4px;
        }

        .hero {
          height: 185px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

.hero h1 {
  font-size: 78px;
  margin: 0;
  color: #f5ead0;
  letter-spacing: 7px;
  font-weight: 900;
  line-height: 1;

  text-shadow:
    0 0 6px rgba(255,255,255,.2),
    0 0 18px rgba(255,255,255,.1),
    0 0 30px rgba(168,85,247,.2);
}

.hero p {
  color: #d9d9d9;
          font-size: 17px;
          letter-spacing: 6px;
          font-weight: 900;
          margin-top: 12px;
        }

        .section {
          max-width: 1780px;
          margin: -6px auto 0;
          padding: 0 20px 14px;
        }

        .section h2 {
          text-align: center;
          color: #d9d9d9;
          text-shadow: 0 0 10px rgba(255,255,255,.12);
          font-size: 25px;
          letter-spacing: 3px;
          margin: 0 0 18px;
        }

        .coverflowWrap {
          position: relative;
          max-width: 1500px;
          margin: 0 auto;
          padding: 0 70px;
        }

        .coverflowStage {
          position: relative;
          height: 500px;
          perspective: 2000px;
        }

        .carouselArrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 200;

          width: 48px;
          height: 48px;
          border-radius: 50%;

          display: flex;
          align-items: center;
          justify-content: center;

          background: rgba(0,0,0,.75);
          border: 1px solid rgba(217,70,239,.6);
          color: #f5ead0;
          font-size: 26px;
          font-weight: 900;
          line-height: 1;
          cursor: pointer;

          box-shadow: 0 0 16px rgba(217,70,239,.35);
          transition: all .2s ease;
        }

        .carouselArrow:hover {
          background: rgba(0,0,0,.92);
          border-color: #e879f9;
          box-shadow: 0 0 26px rgba(217,70,239,.75);
          transform: translateY(-50%) scale(1.1);
        }

        .carouselArrowLeft {
          left: 0;
        }

        .carouselArrowRight {
          right: 0;
        }

        .coverCard {
          position: absolute;
          top: 50%;
          left: 50%;
          width: ${CARD_WIDTH}px;
          height: ${CARD_HEIGHT}px;
          border-radius: 20px;
          background-size: cover;
          background-position: center;
          overflow: hidden;
          cursor: pointer;

          border: 1px solid rgba(168,85,247,.55);
          box-shadow:
            0 25px 50px rgba(0,0,0,.75),
            0 0 22px rgba(168,85,247,.3);

          transform-style: preserve-3d;
          backface-visibility: hidden;
        }

        .coverCard::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(0,0,0,.85), rgba(0,0,0,.22)),
            radial-gradient(circle at top right, rgba(217,70,239,.25), transparent 45%);
          z-index: 1;
        }

        .coverCardActive {
          border-color: #e879f9;
          box-shadow:
            0 30px 60px rgba(0,0,0,.85),
            0 0 40px rgba(217,70,239,.7),
            0 0 85px rgba(168,85,247,.4);
        }

        .achievementOverlay {
          position: absolute;
          inset: 0;
          z-index: 3;
          padding: 26px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .achievementTop {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .achievementNumber {
          color: rgba(255,255,255,.35);
          font-size: 44px;
          font-weight: 900;
          line-height: 1;
          text-shadow: 0 0 12px black;
        }

        .achievementBadge {
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(0,0,0,.72);
          border: 1px solid rgba(201,170,113,.8);
          color: #f5ead0;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .achievementText p {
          margin: 0 0 8px;
          color: #e879f9;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 2px;
          text-shadow: 0 2px 8px black;
        }

        .achievementText h3 {
          margin: 0;
          color: #fff3d0;
          font-size: 28px;
          line-height: 1;
          font-weight: 900;
          text-transform: uppercase;
          text-shadow:
            0 2px 8px black,
            0 0 12px rgba(245,234,208,.25);
        }

        .achievementText small {
          display: block;
          margin-top: 9px;
          color: #f5ead0;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
          text-shadow: 0 2px 8px black;
        }

.dayLabel {
  display: flex;
  align-items: center;
  gap: 10px;
}

.calendarIcon {
  width: 90px;
  height: 90px;
  object-fit: contain;

  filter:
    drop-shadow(0 0 2px rgba(201,170,113,.7))
    drop-shadow(0 0 4px rgba(201,170,113,.3));
}
        .infoGrid {
          max-width: 1850px;
          margin: 0 auto;
          padding: 0 20px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px;
        }

.infoCard {
  min-height: 330px;
  border-radius: 9px;

  border: 1px solid rgba(168,85,247,.45);

  box-shadow:
    0 0 20px rgba(168,85,247,.18),
    0 0 40px rgba(168,85,247,.08),
    0 0 18px rgba(0,0,0,.65);

  transition: all .25s ease;
}

.infoCard:hover {
  transform: scale(1.03);

  border-color: #d946ef;

  box-shadow:
    0 0 18px rgba(217,70,239,.45),
    0 0 40px rgba(168,85,247,.35),
    0 0 70px rgba(168,85,247,.15);
}

        .aboutCard {
          background:
            linear-gradient(90deg, rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.12)),
            url("/About guild.png") center / cover no-repeat;
          padding: 34px 42px;
        }

        .aboutText {
          max-width: 640px;
          line-height: 1.55;
          font-size: 16px;
          font-weight: 700;
        }

        .infoCard h2 {
          color: #f5ead0;
          font-size: 28px;
          letter-spacing: 3px;
          margin: 0 0 16px;
        }

 .raidTimeCard {
  padding: 30px 34px;

  background:
    linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.35)),
    url("/Raiding time.png") center center / 115% 115% no-repeat;

  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeRow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 60px;

  width: auto;

  margin-bottom: 26px;

  font-size: 20px;
  font-weight: 900;
}

        .timeRow span:last-child {
          color: #d9d9d9;
        }

.muted {
  color: #d3c39a;
  font-size: 14px;
  line-height: 1.5;
  text-align: center;
  max-width: 520px;
}

.applyNowBtn {
  display: flex;
  align-items: center;
  justify-content: center;

  width: 240px;
  height: 62px;

  border-radius: 8px;
  border: 1px solid rgba(255,220,150,.9);

  background:
    linear-gradient(
      180deg,
      #e4c87b 0%,
      #bf944c 55%,
      #7b5524 100%
    );

  color: #120b04;
  text-decoration: none;

  font-size: 18px;
  font-weight: 900;
  letter-spacing: 2px;

  box-shadow:
    0 0 20px rgba(201,170,113,.35),
    inset 0 1px 0 rgba(255,255,255,.35);

  transition: all .25s ease;
}

.applyNowBtn:hover {
  transform: scale(1.12);

  box-shadow:
    0 0 40px rgba(201,170,113,.9),
    0 0 80px rgba(201,170,113,.4),
    inset 0 1px 0 rgba(255,255,255,.45);
}
.navUser {
  display: flex;
  align-items: center;
  gap: 14px;
}
.navRight {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
  overflow: visible;
}
.onlineBadge {
  display: flex;
  align-items: center;
  gap: 8px;

  padding: 8px 14px;
  border-radius: 999px;

  background: rgba(20,12,4,.9);

  border: 1px solid rgba(201,170,113,.5);

  color: #f5ead0;
  font-weight: 900;

  box-shadow:
    0 0 10px rgba(201,170,113,.25);
}

.onlineDot {
  width: 8px;
  height: 8px;

  border-radius: 50%;

  background: #22c55e;

  box-shadow:
    0 0 10px #22c55e,
    0 0 20px #22c55e;
}

.navAvatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;

  border: 2px solid #c9aa71;

  box-shadow:
    0 0 10px rgba(201,170,113,.7),
    0 0 20px rgba(201,170,113,.35);
}

.navName {
  color: white;
  font-weight: 900;
}

.signOutBtn {
  height: 42px;
  padding: 0 18px;

  border-radius: 10px;

  border: 1px solid #c9aa71;

  background: rgba(20,12,4,.9);

  color: #f5ead0;

  font-weight: 900;
  cursor: pointer;

  transition: all .2s ease;
}
.signOutBtn:hover {
  transform: scale(1.05);

  box-shadow:
    0 0 15px rgba(201,170,113,.7),
    0 0 30px rgba(201,170,113,.35);
}
  .onlineWrap {
  position: relative;
}

.onlineDropdown {
  position: absolute;
  top: 45px;
  right: 0;
  width: 260px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(2, 18, 12, 0.96);
  border: 1px solid rgba(34,197,94,.45);
  box-shadow: 0 0 25px rgba(0,0,0,.8);
  z-index: 999;
}

.onlineDropdown h3 {
  margin: 0 0 12px;
  color: #dcfce7;
  font-size: 16px;
}

.onlineMember {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px;
  margin-bottom: 8px;
  border-radius: 10px;
  background: rgba(255,255,255,.06);
}

.onlineAvatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
}

.onlineMember strong {
  color: white;
  font-size: 14px;
}

.onlineMember p {
  margin: 2px 0 0;
  color: #86efac;
  font-size: 11px;
}
footer {
  text-align: center;
  margin-top: 12px;

  color: #f5ead0;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 4px;

  text-shadow:
    0 0 10px rgba(255,255,255,.15);

  padding-bottom: 60px;
}
      `}</style>
    </main>
  );
}
