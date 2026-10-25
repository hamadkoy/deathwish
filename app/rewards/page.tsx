"use client";

import { useState } from "react";
import { SEASONS, type Season, type Winner } from "./seasons";

/* ============================================================
   REWARDS PAGE — app/rewards/page.tsx
   All the numbers live in ./seasons.ts
============================================================ */

const gold = (n?: number) => (n ?? 0).toLocaleString("en-US");

export default function RewardsPage() {
  const [seasonId, setSeasonId] = useState(SEASONS[0]?.id);
  const season = SEASONS.find((s) => s.id === seasonId) || SEASONS[0];

  return (
    <main className="rw-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="rw-hero">
        <div className="rw-hero-glow" />
        <div className="rw-trophy">🏆</div>
        <h1 className="rw-title">Season Rewards</h1>
        <div className="rw-ornament">
          <span />
          <b />
          <span />
        </div>
        <p className="rw-sub">The boosters who carried the guild — and what they took home.</p>
      </header>

      {SEASONS.length > 1 && (
        <nav className="rw-tabs">
          {SEASONS.map((s) => (
            <button
              key={s.id}
              className={`rw-tab${s.id === season?.id ? " is-active" : ""}`}
              onClick={() => setSeasonId(s.id)}
            >
              {s.status === "live" && <span className="rw-live-dot" />}
              {s.title}
            </button>
          ))}
        </nav>
      )}

      {season ? <SeasonView season={season} /> : <div className="rw-empty">No seasons yet.</div>}
    </main>
  );
}

function SeasonView({ season }: { season: Season }) {
  const podium = season.rewards.filter((w) => !w.disqualified).slice(0, 3);
  const others = season.rewards.filter((w) => !podium.includes(w));
  // 2nd · 1st · 3rd so the winner stands in the middle
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as Winner[];

  return (
    <section className="rw-season">
      <div className="rw-season-head">
        <div>
          <div className="rw-season-kicker">
            {season.status === "live" ? "● Live season" : season.subtitle || "Season ended"}
          </div>
          <h2 className="rw-season-title">{season.title}</h2>
          {season.weeks && <div className="rw-season-meta">{season.weeks} weeks</div>}
        </div>

        {season.totalGenerated !== undefined && (
          <div className="rw-total">
            <div className="rw-total-label">Total gold generated</div>
            <div className="rw-total-value">
              {gold(season.totalGenerated)}
              <span>g</span>
            </div>
          </div>
        )}
      </div>

      {season.announcement && <div className="rw-note">{season.announcement}</div>}

      {season.bonusNote && (
        <div className="rw-note rw-note-gold">
          <span className="rw-note-icon">💰</span>
          {season.bonusNote}
        </div>
      )}

      {/* ---------- Main rewards ---------- */}
      <h3 className="rw-section-title">
        <span>🔥</span> Rewards <span>🔥</span>
      </h3>

      <div className="rw-podium">
        {podiumOrder.map((w) => {
          const place = podium.indexOf(w) + 1;
          return <PodiumCard key={w.name} winner={w} place={place} />;
        })}
      </div>

      {others.length > 0 && (
        <div className="rw-list">
          {others.map((w) => (
            <div key={w.name} className={`rw-row${w.disqualified ? " is-dq" : ""}`}>
              <div className="rw-row-name">
                {w.name}
                {w.note && <small>{w.note}</small>}
              </div>
              <div className="rw-row-gen">
                Generated <b>{gold(w.generated)}g</b>
              </div>
              <div className="rw-row-prize">
                {w.disqualified ? (
                  <span className="rw-dq-stamp">DISQUALIFIED</span>
                ) : (
                  <>
                    {w.prizeItem && <span>🎁 {w.prizeItem}</span>}
                    {w.prizeGold ? <b>+{gold(w.prizeGold)}g</b> : null}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Hidden rewards ---------- */}
      {season.hiddenRewards.length > 0 && (
        <>
          <h3 className="rw-section-title rw-hidden-title">
            <span>💎</span> Hidden Rewards <span>💎</span>
          </h3>

          {season.hiddenRequirement && (
            <div className="rw-requirement">
              <b>Requirement to unlock:</b> {season.hiddenRequirement}
            </div>
          )}

          <div className="rw-hidden-grid">
            {season.hiddenRewards.map((w) => (
              <div key={w.name} className="rw-gem-card">
                <div className="rw-gem">💎</div>
                <div className="rw-gem-name">{w.name}</div>
                <div className="rw-gem-gen">Generated {gold(w.generated)}g</div>
                <div className="rw-gem-prize">+{gold(w.prizeGold)}g</div>
              </div>
            ))}
          </div>
        </>
      )}

      {season.closingLine && <div className="rw-closing">{season.closingLine}</div>}
    </section>
  );
}

function PodiumCard({ winner, place }: { winner: Winner; place: number }) {
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";

  return (
    <div className={`rw-podium-card place-${place}`}>
      {place === 1 && <div className="rw-crown">👑</div>}
      <div className="rw-medal">{medal}</div>
      <div className="rw-place">#{place}</div>
      <div className="rw-name">{winner.name}</div>
      {winner.note && <div className="rw-note-small">{winner.note}</div>}

      <div className="rw-gen">
        <span>Generated</span>
        <b>{gold(winner.generated)}g</b>
      </div>

      <div className="rw-prize">
        {winner.prizeItem && <div className="rw-prize-item">🎁 {winner.prizeItem}</div>}
        {winner.prizeGold ? <div className="rw-prize-gold">+{gold(winner.prizeGold)}g</div> : null}
      </div>

      <div className="rw-step">{place}</div>
    </div>
  );
}

/* ============================================================
   Styles
============================================================ */
const CSS = `
.rw-page {
  min-height: 100vh;
  padding: 40px 24px 80px;
  color: #fff;
  font-family: Arial, sans-serif;
  background:
    radial-gradient(circle at 50% 0%, rgba(250,204,21,.10), transparent 40%),
    linear-gradient(rgba(4,0,14,.72), rgba(0,0,0,.88)),
    url('/bg.png') center top / cover no-repeat fixed;
}

/* ---------- hero ---------- */
.rw-hero { position: relative; text-align: center; margin-bottom: 34px; }
.rw-hero-glow {
  position: absolute; left: 50%; top: -80px; transform: translateX(-50%);
  width: 520px; height: 360px; border-radius: 50%;
  background: radial-gradient(circle, rgba(250,204,21,.22), rgba(168,85,247,.12), transparent 70%);
  filter: blur(30px); pointer-events: none;
}
.rw-trophy { position: relative; font-size: 64px; filter: drop-shadow(0 0 22px rgba(250,204,21,.8)); }
.rw-title {
  position: relative; margin: 6px 0 0;
  font-family: Georgia, serif; font-size: 56px; font-weight: 900; letter-spacing: 1px;
  color: #fff7cc; text-shadow: 0 0 26px rgba(250,204,21,.55);
}
.rw-ornament { position: relative; display: flex; justify-content: center; align-items: center; gap: 12px; margin: 12px 0; }
.rw-ornament span { width: 140px; height: 1px; background: linear-gradient(to right, transparent, rgba(250,204,21,.9)); }
.rw-ornament span:last-child { background: linear-gradient(to left, transparent, rgba(250,204,21,.9)); }
.rw-ornament b { width: 9px; height: 9px; transform: rotate(45deg); background: #facc15; box-shadow: 0 0 14px rgba(250,204,21,.9); }
.rw-sub { position: relative; margin: 0; color: #d8c9a8; font-size: 17px; }

/* ---------- tabs ---------- */
.rw-tabs { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-bottom: 26px; }
.rw-tab {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 11px 22px; border-radius: 999px; cursor: pointer;
  border: 1px solid rgba(250,204,21,.4); background: rgba(20,10,0,.7);
  color: #fde68a; font-weight: 900; font-size: 15px; transition: all .18s ease;
}
.rw-tab:hover { transform: translateY(-2px); box-shadow: 0 0 18px rgba(250,204,21,.45); }
.rw-tab.is-active { background: linear-gradient(90deg,#a16207,#facc15); color: #1a1000; box-shadow: 0 0 22px rgba(250,204,21,.7); }
.rw-live-dot { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 10px #22c55e; }

/* ---------- season ---------- */
.rw-season {
  max-width: 1200px; margin: 0 auto; padding: 34px;
  border-radius: 26px; border: 1px solid rgba(250,204,21,.35);
  background:
    radial-gradient(circle at 50% 0%, rgba(250,204,21,.08), transparent 45%),
    linear-gradient(180deg, rgba(22,10,40,.94), rgba(6,2,16,.96));
  box-shadow: 0 0 60px rgba(250,204,21,.12), 0 0 40px rgba(168,85,247,.18);
}
.rw-season-head { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 20px; margin-bottom: 22px; }
.rw-season-kicker { color: #c4b5fd; font-weight: 900; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
.rw-season-title { margin: 6px 0 4px; font-family: Georgia, serif; font-size: 38px; color: #fff; }
.rw-season-meta { color: #a99cc6; font-weight: 700; }

.rw-total { text-align: right; }
.rw-total-label { color: #c4b5fd; font-weight: 900; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }
.rw-total-value {
  font-size: 44px; font-weight: 900; color: #facc15;
  text-shadow: 0 0 24px rgba(250,204,21,.55); font-variant-numeric: tabular-nums;
}
.rw-total-value span { font-size: 26px; margin-left: 4px; opacity: .8; }

.rw-note {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 18px; margin-bottom: 12px; border-radius: 14px;
  border: 1px solid rgba(168,85,247,.35); background: rgba(40,14,70,.45);
  color: #e9d5ff; font-weight: 700; font-size: 16px;
}
.rw-note-gold { border-color: rgba(250,204,21,.45); background: rgba(66,52,4,.35); color: #fde68a; }
.rw-note-icon { font-size: 24px; }

.rw-section-title {
  display: flex; justify-content: center; align-items: center; gap: 12px;
  margin: 34px 0 22px; font-family: Georgia, serif; font-size: 34px; color: #fff;
  text-shadow: 0 0 18px rgba(249,115,22,.55);
}
.rw-hidden-title { text-shadow: 0 0 18px rgba(56,189,248,.65); }

/* ---------- podium ---------- */
.rw-podium { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 20px; align-items: end; }
.rw-podium-card {
  position: relative; display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 26px 18px 0; border-radius: 22px 22px 14px 14px; overflow: hidden;
  border: 1px solid rgba(255,255,255,.12);
  background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(0,0,0,.35));
  transition: transform .2s ease, box-shadow .2s ease;
}
.rw-podium-card:hover { transform: translateY(-6px); }
.rw-podium-card.place-1 {
  padding-top: 52px; border-color: rgba(250,204,21,.7);
  background: linear-gradient(180deg, rgba(250,204,21,.18), rgba(40,25,0,.55));
  box-shadow: 0 0 40px rgba(250,204,21,.35);
}
.rw-podium-card.place-2 { border-color: rgba(203,213,225,.55); box-shadow: 0 0 26px rgba(203,213,225,.2); }
.rw-podium-card.place-3 { border-color: rgba(217,119,6,.6); box-shadow: 0 0 26px rgba(217,119,6,.25); }

.rw-crown { position: absolute; top: 4px; font-size: 30px; filter: drop-shadow(0 0 10px rgba(250,204,21,.9)); }
.rw-medal { font-size: 56px; line-height: 1; filter: drop-shadow(0 0 14px rgba(255,255,255,.35)); }
.place-1 .rw-medal { font-size: 72px; }
.rw-place { margin-top: 6px; color: #a99cc6; font-weight: 900; letter-spacing: 2px; }
.rw-name { margin-top: 4px; font-size: 26px; font-weight: 900; color: #fff; word-break: break-word; }
.place-1 .rw-name { font-size: 32px; color: #fff7cc; text-shadow: 0 0 16px rgba(250,204,21,.6); }
.rw-note-small { margin-top: 4px; color: #c4b5fd; font-size: 13px; font-weight: 700; font-style: italic; }

.rw-gen { margin-top: 14px; display: flex; flex-direction: column; gap: 2px; }
.rw-gen span { color: #a99cc6; font-size: 12px; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; }
.rw-gen b { color: #facc15; font-size: 22px; font-variant-numeric: tabular-nums; }

.rw-prize { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; align-items: center; }
.rw-prize-item {
  padding: 8px 14px; border-radius: 12px; font-weight: 800; font-size: 15px;
  border: 1px solid rgba(168,85,247,.5); background: rgba(88,28,135,.35); color: #f5d0fe;
}
.rw-prize-gold {
  padding: 8px 16px; border-radius: 999px; font-weight: 900; font-size: 20px;
  border: 1px solid rgba(34,197,94,.6); background: rgba(5,46,22,.55); color: #4ade80;
  text-shadow: 0 0 10px rgba(34,197,94,.6);
}

.rw-step {
  width: calc(100% + 36px); margin-top: 20px; padding: 10px 0;
  font-size: 36px; font-weight: 900; color: rgba(255,255,255,.25);
  background: rgba(0,0,0,.35); border-top: 1px solid rgba(255,255,255,.08);
}
.place-1 .rw-step { padding: 22px 0; color: rgba(250,204,21,.4); }
.place-2 .rw-step { padding: 14px 0; }

/* ---------- other main entries (incl. disqualified) ---------- */
.rw-list { display: grid; gap: 10px; margin-top: 18px; }
.rw-row {
  display: grid; grid-template-columns: minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.2fr);
  align-items: center; gap: 16px; padding: 16px 20px; border-radius: 14px;
  border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04);
}
.rw-row-name { font-weight: 900; font-size: 20px; display: flex; flex-direction: column; }
.rw-row-name small { margin-top: 3px; color: #fca5a5; font-weight: 700; font-size: 13px; font-style: italic; }
.rw-row-gen { color: #a99cc6; font-weight: 700; }
.rw-row-gen b { color: #facc15; }
.rw-row-prize { display: flex; justify-content: flex-end; align-items: center; gap: 10px; flex-wrap: wrap; }
.rw-row.is-dq { border-color: rgba(239,68,68,.45); background: rgba(69,10,10,.35); }
.rw-row.is-dq .rw-row-name { color: #fecaca; text-decoration: line-through; text-decoration-color: rgba(239,68,68,.7); }
.rw-dq-stamp {
  padding: 6px 14px; border: 2px solid #ef4444; border-radius: 8px; transform: rotate(-4deg);
  color: #ef4444; font-weight: 900; letter-spacing: 2px; font-size: 14px;
  box-shadow: 0 0 14px rgba(239,68,68,.35);
}

/* ---------- hidden rewards ---------- */
.rw-requirement {
  max-width: 820px; margin: 0 auto 20px; padding: 14px 18px; text-align: center;
  border-radius: 14px; border: 1px dashed rgba(56,189,248,.55); background: rgba(8,40,60,.35);
  color: #bae6fd; font-size: 16px; line-height: 1.5;
}
.rw-requirement b { color: #fff; }
.rw-hidden-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.rw-gem-card {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 22px 16px; border-radius: 18px;
  border: 1px solid rgba(56,189,248,.45);
  background: linear-gradient(180deg, rgba(14,60,90,.45), rgba(4,12,30,.7));
  box-shadow: 0 0 24px rgba(56,189,248,.18); transition: transform .2s ease, box-shadow .2s ease;
}
.rw-gem-card:hover { transform: translateY(-4px); box-shadow: 0 0 34px rgba(56,189,248,.4); }
.rw-gem { font-size: 40px; filter: drop-shadow(0 0 12px rgba(56,189,248,.8)); }
.rw-gem-name { margin-top: 8px; font-size: 22px; font-weight: 900; }
.rw-gem-gen { margin-top: 6px; color: #9fb7c8; font-weight: 700; font-size: 14px; }
.rw-gem-prize {
  margin-top: 12px; padding: 8px 16px; border-radius: 999px; font-weight: 900; font-size: 19px;
  border: 1px solid rgba(34,197,94,.6); background: rgba(5,46,22,.55); color: #4ade80;
}

.rw-closing { margin-top: 34px; text-align: center; font-family: Georgia, serif; font-size: 26px; color: #fff7cc; }
.rw-empty { text-align: center; color: #a99cc6; padding: 60px; }

/* ---------- small screens ---------- */
@media (max-width: 800px) {
  .rw-title { font-size: 40px; }
  .rw-season { padding: 20px; }
  .rw-podium { grid-template-columns: 1fr; }
  .rw-podium-card.place-1 { order: -1; }
  .rw-row { grid-template-columns: 1fr; }
  .rw-row-prize { justify-content: flex-start; }
  .rw-total { text-align: left; }
}
`;
