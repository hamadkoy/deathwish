"use client";

import { useEffect, useState } from "react";
import {
  EXPANSIONS,
  type Expansion,
  type Season,
  type SeasonEntry,
  type Winner,
} from "./seasons";

/* ============================================================
   REWARDS PAGE — app/rewards/page.tsx
   All the numbers live in ./seasons.ts
============================================================ */

const gold = (n?: number) => (n ?? 0).toLocaleString("en-US");
// 1,716,487,953 → "1.72B", 62,054,500 → "62.1M"
const short = (n: number) =>
  n >= 1_000_000_000
    ? `${(n / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}B`
    : n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`
    : gold(n);

type Open = { expansion: Expansion; entry: SeasonEntry } | null;

export default function RewardsPage() {
  const [open, setOpen] = useState<Open>(null);

  // Let the browser back button close a season
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ rw: open.entry.id }, "");
    const onPop = () => setOpen(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open?.entry.id]);

  function close() {
    if (window.history.state?.rw) window.history.back();
    else setOpen(null);
  }

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

      {open && open.entry.data ? (
        <>
          <div className="rw-back-row">
            <button className="rw-back" onClick={close}>
              ← All expansions
            </button>
            <span className="rw-crumb" style={{ color: open.expansion.accent }}>
              {open.expansion.icon} {open.expansion.name} · {open.entry.label}
            </span>
          </div>
          <SeasonView season={open.entry.data} />
        </>
      ) : (
        <div className="rw-timeline">
          {EXPANSIONS.map((x) => (
            <ExpansionBlock
              key={x.id}
              expansion={x}
              onOpen={(entry) => {
                setOpen({ expansion: x, entry });
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ExpansionBlock({
  expansion,
  onOpen,
}: {
  expansion: Expansion;
  onOpen: (entry: SeasonEntry) => void;
}) {
  const x = expansion;

  return (
    <section
      className="rw-xpac"
      style={
        {
          "--accent": x.accent,
          "--accent-soft": `rgba(${x.accentRgb},.45)`,
          "--accent-faint": `rgba(${x.accentRgb},.14)`,
        } as React.CSSProperties
      }
    >
      <div className="rw-xpac-head">
        <div className="rw-xpac-icon">{x.icon}</div>
        <div>
          <h2 className="rw-xpac-name">{x.name}</h2>
          <div className="rw-xpac-years">{x.years}</div>
        </div>
      </div>

      <div className="rw-season-grid">
        {x.seasons.map((entry) =>
          entry.lost || !entry.data ? (
            <div key={entry.id} className="rw-scard is-lost" title="Records from this season were lost">
              <div className="rw-scard-label">{entry.label}</div>
              <div className="rw-lost-icon">📜</div>
              <div className="rw-lost-title">Lost Data</div>
              <div className="rw-lost-sub">Records from this season were lost to time.</div>
            </div>
          ) : (
            <SeasonCard key={entry.id} entry={entry} onOpen={() => onOpen(entry)} />
          )
        )}
      </div>
    </section>
  );
}

function SeasonCard({ entry, onOpen }: { entry: SeasonEntry; onOpen: () => void }) {
  const d = entry.data!;
  const champ = d.rewards.find((w) => !w.disqualified);
  const live = d.status === "live";

  return (
    <button className={`rw-scard is-open${live ? " is-live" : ""}`} onClick={onOpen}>
      <div className="rw-scard-label">
        {entry.label}
        {live && (
          <span className="rw-live-pill">
            <span className="rw-live-dot" /> LIVE
          </span>
        )}
      </div>

      {champ ? (
        <>
          <div className="rw-scard-crown">👑</div>
          <div className="rw-scard-champ">{champ.name}</div>
          <div className="rw-scard-meta">Champion · {short(champ.generated)} gold</div>
        </>
      ) : (
        <>
          <div className="rw-scard-crown">⏳</div>
          <div className="rw-scard-champ">In progress</div>
          <div className="rw-scard-meta">Rewards when the season ends</div>
        </>
      )}

      {d.totalGenerated !== undefined && (
        <div className="rw-scard-total">{short(d.totalGenerated)} gold generated</div>
      )}

      <div className="rw-scard-cta">View season →</div>
    </button>
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

      {/* ---------- Reward ladder ---------- */}
      {season.tiers && season.tiers.length > 0 && (
        <>
          <h3 className="rw-section-title rw-tier-title">
            <span>🎁</span> Exclusive Reward Tiers <span>🎁</span>
          </h3>
          {season.tiersNote && <div className="rw-requirement rw-tier-note">{season.tiersNote}</div>}
          <div className="rw-tiers">
            {[...season.tiers]
              .sort((a, b) => b.threshold - a.threshold)
              .map((t, i) => (
                <div key={t.threshold} className={`rw-tier tier-${Math.min(i + 1, 5)}`}>
                  <div className="rw-tier-rank">Tier {i + 1}</div>
                  <div className="rw-tier-reach">
                    <span>Reach</span>
                    <b>{gold(t.threshold)}g</b>
                  </div>
                  <div className="rw-tier-arrow">▼</div>
                  <div className="rw-prize-gold">+{gold(t.prizeGold)}g</div>
                  {t.prizeItem && <div className="rw-prize-item">🎮 {t.prizeItem}</div>}
                </div>
              ))}
          </div>
        </>
      )}

      {season.rules && season.rules.length > 0 && (
        <div className="rw-rules">
          <div className="rw-rules-title">⚠️ Rules</div>
          <ul>
            {season.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- Main rewards ---------- */}
      {season.rewards.length > 0 && (
      <h3 className="rw-section-title">
        <span>🔥</span> Rewards <span>🔥</span>
      </h3>
      )}

      <div className="rw-podium" style={{ display: podium.length ? undefined : "none" }}>
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

/* ---------- expansion overview ---------- */
.rw-timeline { max-width: 1200px; margin: 0 auto; display: grid; gap: 28px; }
.rw-xpac {
  position: relative; padding: 26px 28px 28px; border-radius: 24px;
  border: 1px solid var(--accent-soft);
  background:
    radial-gradient(circle at 0% 0%, var(--accent-faint), transparent 45%),
    linear-gradient(180deg, rgba(18,8,32,.92), rgba(6,2,16,.95));
  box-shadow: 0 0 34px var(--accent-faint);
}
.rw-xpac-head { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.rw-xpac-icon {
  width: 62px; height: 62px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
  font-size: 32px; border: 1px solid var(--accent-soft); background: var(--accent-faint);
  box-shadow: 0 0 20px var(--accent-faint);
}
.rw-xpac-name {
  margin: 0; font-family: Georgia, serif; font-size: 34px; color: var(--accent);
  text-shadow: 0 0 18px var(--accent-soft);
}
.rw-xpac-years { margin-top: 2px; color: #a99cc6; font-weight: 800; letter-spacing: 1px; }

.rw-season-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }

.rw-scard {
  position: relative; display: flex; flex-direction: column; align-items: center; text-align: center;
  min-height: 210px; padding: 18px 14px; border-radius: 18px;
  font-family: inherit; color: #fff;
}
.rw-scard-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 14px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #c4b5fd;
}

.rw-scard.is-lost {
  border: 1px dashed rgba(148,163,184,.35);
  background:
    repeating-linear-gradient(135deg, rgba(255,255,255,.025) 0 10px, transparent 10px 20px),
    rgba(10,8,18,.75);
  filter: grayscale(1);
  opacity: .62;
}
.rw-lost-icon { margin-top: 18px; font-size: 38px; opacity: .7; }
.rw-lost-title {
  margin-top: 8px; font-family: Georgia, serif; font-size: 22px; font-weight: 900;
  color: #9ca3af; letter-spacing: 1px;
}
.rw-lost-sub { margin-top: 6px; color: #6b7280; font-size: 13px; font-weight: 700; font-style: italic; }

.rw-scard.is-open {
  cursor: pointer; border: 1px solid var(--accent-soft);
  background: linear-gradient(180deg, var(--accent-faint), rgba(0,0,0,.4));
  box-shadow: 0 0 22px var(--accent-faint);
  transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
}
.rw-scard.is-open:hover { transform: translateY(-5px); border-color: var(--accent); box-shadow: 0 0 34px var(--accent-soft); }
.rw-scard.is-live { animation: rwLivePulse 2.4s ease-in-out infinite; }
@keyframes rwLivePulse {
  0%, 100% { box-shadow: 0 0 18px var(--accent-faint); }
  50%      { box-shadow: 0 0 36px var(--accent-soft); }
}
.rw-scard-crown { margin-top: 14px; font-size: 38px; filter: drop-shadow(0 0 10px rgba(250,204,21,.7)); }
.rw-scard-champ { margin-top: 6px; font-size: 22px; font-weight: 900; word-break: break-word; }
.rw-scard-meta { margin-top: 4px; color: #d8c9a8; font-size: 14px; font-weight: 700; }
.rw-scard-total { margin-top: 8px; color: #facc15; font-weight: 900; font-size: 15px; }
.rw-scard-cta { margin-top: auto; padding-top: 14px; color: var(--accent); font-weight: 900; font-size: 14px; }

.rw-live-pill {
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 999px;
  border: 1px solid rgba(34,197,94,.6); background: rgba(5,46,22,.55); color: #4ade80; font-size: 11px;
}

/* ---------- season detail: back bar ---------- */
.rw-back-row { max-width: 1200px; margin: 0 auto 16px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.rw-back {
  padding: 11px 20px; border-radius: 12px; cursor: pointer; font-weight: 900; font-size: 15px;
  border: 1px solid rgba(250,204,21,.45); background: rgba(20,10,0,.75); color: #fde68a;
  transition: transform .18s ease, box-shadow .18s ease;
}
.rw-back:hover { transform: translateX(-3px); box-shadow: 0 0 18px rgba(250,204,21,.45); }
.rw-crumb { font-weight: 900; font-size: 16px; letter-spacing: .5px; }

/* ---------- reward tiers ---------- */
.rw-tier-title { text-shadow: 0 0 18px rgba(250,204,21,.6); }
.rw-tier-note { border-color: rgba(250,204,21,.45); background: rgba(66,52,4,.3); color: #fde68a; }
.rw-tiers { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
.rw-tier {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;
  padding: 18px 12px; border-radius: 18px;
  border: 1px solid rgba(250,204,21,.35); background: linear-gradient(180deg, rgba(250,204,21,.10), rgba(0,0,0,.4));
}
.rw-tier.tier-1 { border-color: rgba(250,204,21,.85); box-shadow: 0 0 26px rgba(250,204,21,.35); background: linear-gradient(180deg, rgba(250,204,21,.22), rgba(40,25,0,.55)); }
.rw-tier.tier-2 { border-color: rgba(250,204,21,.6); }
.rw-tier-rank { color: #c4b5fd; font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
.rw-tier-reach { display: flex; flex-direction: column; }
.rw-tier-reach span { color: #a99cc6; font-size: 12px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
.rw-tier-reach b { color: #facc15; font-size: 21px; text-shadow: 0 0 12px rgba(250,204,21,.5); }
.rw-tier-arrow { color: rgba(250,204,21,.6); font-size: 12px; }
.rw-tier .rw-prize-gold { font-size: 17px; }
.rw-tier .rw-prize-item { font-size: 13px; }

.rw-rules {
  margin-top: 18px; padding: 16px 20px; border-radius: 14px;
  border: 1px solid rgba(249,115,22,.45); background: rgba(60,20,0,.35);
}
.rw-rules-title { font-weight: 900; font-size: 18px; color: #fdba74; margin-bottom: 6px; }
.rw-rules ul { margin: 0; padding-left: 20px; color: #fed7aa; line-height: 1.6; font-weight: 600; }

@media (max-width: 1000px) {
  .rw-season-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .rw-tiers { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

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
