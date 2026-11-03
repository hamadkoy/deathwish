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

   Overview: each expansion is a hall with a rod; every season
   hangs a banner. Recorded seasons get a full banner with the
   champion and the gold paid; lost seasons hang torn and faded.
   Season view: top 3 as banners, then the full payout ledger.
============================================================ */

const gold = (n?: number) => (n ?? 0).toLocaleString("en-US");

/** Gold actually handed out in a season (main + hidden rewards, no DQs). */
function seasonStats(d: Season) {
  const paidOut = [...d.rewards, ...d.hiddenRewards].filter(
    (w) => !w.disqualified && w.prizeGold
  );
  return {
    paid: paidOut.reduce((s, w) => s + (w.prizeGold ?? 0), 0),
    rewarded: paidOut.length,
  };
}

const TOTAL_PAID = EXPANSIONS.reduce(
  (sum, x) =>
    sum + x.seasons.reduce((s, e) => s + (e.data ? seasonStats(e.data).paid : 0), 0),
  0
);

type Open = { expansion: Expansion; entry: SeasonEntry; n: number } | null;

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

  let bannerIndex = 0;

  return (
    <main className="rw">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="rw-wrap">
        {open && open.entry.data ? (
          <SeasonView
            expansion={open.expansion}
            n={open.n}
            season={open.entry.data}
            onBack={close}
          />
        ) : (
          <>
            <header className="rw-hero">
              <h1>Season Rewards</h1>
              <p>
                {TOTAL_PAID > 0 ? (
                  <>
                    <b>{gold(TOTAL_PAID)} gold</b> paid to the boosters who carried
                    Death Wish, season by season.
                  </>
                ) : (
                  "Every season's champions and what they took home."
                )}
              </p>
            </header>

            {EXPANSIONS.map((x) => {
              const start = bannerIndex;
              bannerIndex += x.seasons.length;
              return (
                <Hall
                  key={x.id}
                  expansion={x}
                  startIndex={start}
                  onOpen={(entry, n) => {
                    setOpen({ expansion: x, entry, n });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}

/* ---------------- overview ---------------- */

function Hall({
  expansion: x,
  startIndex,
  onOpen,
}: {
  expansion: Expansion;
  startIndex: number;
  onOpen: (entry: SeasonEntry, n: number) => void;
}) {
  const archive = !x.seasons.some((s) => !s.lost && s.data);

  return (
    <section
      className={`rw-hall${archive ? " is-archive" : ""}`}
      style={{ "--ac": x.accent, "--ac-rgb": x.accentRgb } as React.CSSProperties}
    >
      <div className="rw-hall-head">
        <h2>{x.name}</h2>
        <span className="rw-hall-years">{x.years.trim().replace(/[\u2013\u2014-]$/, "– now")}</span>
        {x.current && <span className="rw-now">Current expansion</span>}
      </div>

      <div className="rw-hall-scroll">
        <div className="rw-track">
          <div className="rw-rod" aria-hidden />
          {x.seasons.map((entry, i) => (
            <Banner
              key={entry.id}
              entry={entry}
              n={i + 1}
              order={startIndex + i}
              expansionName={x.name}
              onOpen={() => onOpen(entry, i + 1)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Crown({ size = 52 }: { size?: number }) {
  return (
    <svg
      className="rw-crown"
      viewBox="0 0 64 42"
      width={size}
      height={(size * 42) / 64}
      aria-hidden
    >
      <path
        d="M5 33 L9 9 L22 22 L32 4 L42 22 L55 9 L59 33 Z"
        fill="#e9c25b"
        stroke="#6b4c12"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <rect x="5" y="33" width="54" height="6" rx="1.5" fill="#b8862c" stroke="#6b4c12" strokeWidth="2" />
      <circle cx="32" cy="23" r="3.2" fill="#b91c1c" />
      <circle cx="18" cy="27" r="2.2" fill="#1d4ed8" />
      <circle cx="46" cy="27" r="2.2" fill="#1d4ed8" />
    </svg>
  );
}

function Banner({
  entry,
  n,
  order,
  expansionName,
  onOpen,
}: {
  entry: SeasonEntry;
  n: number;
  order: number;
  expansionName: string;
  onOpen: () => void;
}) {
  const d = entry.data;
  const style = { "--i": order } as React.CSSProperties;

  if (entry.lost || !d) {
    return (
      <div className="rw-banner is-lost" style={style}>
        <div className="rw-cloth">
          <span className="rw-bn-season">Season {n}</span>
          <span className="rw-bn-lost">Records lost</span>
        </div>
      </div>
    );
  }

  const champ = d.rewards.find((w) => !w.disqualified);
  const st = seasonStats(d);
  const live = d.status === "live";

  return (
    <button
      className={`rw-banner is-set${live ? " is-live" : ""}`}
      style={style}
      onClick={onOpen}
      aria-label={`Open ${expansionName} season ${n} rewards`}
    >
      <div className="rw-cloth">
        <span className="rw-bn-season">Season {n}</span>
        <Crown />

        {champ ? (
          <>
            <span className="rw-bn-champ">{champ.name}</span>
            <span className="rw-bn-caption">Season champion</span>
            <span className="rw-bn-rule" />
            <span className="rw-bn-paid">
              {gold(st.paid)}
              <small> gold</small>
            </span>
            <span className="rw-bn-caption">
              in rewards to {st.rewarded} booster{st.rewarded === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <>
            <span className="rw-bn-champ">In progress</span>
            <span className="rw-bn-caption">
              Rewards are posted here when the season ends.
            </span>
          </>
        )}

        <span className="rw-bn-open">See rewards</span>
      </div>
    </button>
  );
}

/* ---------------- season view ---------------- */

const PLACE = ["Champion", "Second place", "Third place"];

function SeasonView({
  expansion,
  n,
  season,
  onBack,
}: {
  expansion: Expansion;
  n: number;
  season: Season;
  onBack: () => void;
}) {
  const st = seasonStats(season);
  const podium = season.rewards.filter((w) => !w.disqualified).slice(0, 3);
  // 2nd, 1st, 3rd so the champion hangs in the middle
  const podiumOrder = [podium[1], podium[0], podium[2]]
    .map((w) => (w ? { w, place: podium.indexOf(w) } : null))
    .filter(Boolean) as { w: Winner; place: number }[];

  const summary: string[] = [];
  if (st.paid > 0)
    summary.push(`${gold(st.paid)} gold paid to ${st.rewarded} booster${st.rewarded === 1 ? "" : "s"}.`);
  if (season.totalGenerated !== undefined)
    summary.push(
      `${gold(season.totalGenerated)} gold generated${season.weeks ? ` over ${season.weeks} weeks` : ""}.`
    );
  if (season.status === "live") summary.push("This season is still running.");

  return (
    <article
      className="rw-season"
      style={{ "--ac": expansion.accent, "--ac-rgb": expansion.accentRgb } as React.CSSProperties}
    >
      <button className="rw-back" onClick={onBack}>
        ← All seasons
      </button>

      <header className="rw-s-head">
        <h1>{season.title}</h1>
        {summary.length > 0 && <p className="rw-s-summary">{summary.join(" ")}</p>}
      </header>

      {(season.announcement || season.bonusNote || (season.rules && season.rules.length > 0)) && (
        <div className="rw-s-notes">
          {season.announcement && <p>{season.announcement}</p>}
          {season.bonusNote && <p>{season.bonusNote}</p>}
          {season.rules && season.rules.length > 0 && (
            <ul>
              {season.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {season.tiers && season.tiers.length > 0 && (
        <section className="rw-s-block">
          <h2>Reward tiers</h2>
          {season.tiersNote && <p className="rw-s-sub">{season.tiersNote}</p>}
          <table className="rw-ledger">
            <thead>
              <tr>
                <th>Gold generated</th>
                <th className="num">Reward</th>
              </tr>
            </thead>
            <tbody>
              {[...season.tiers]
                .sort((a, b) => b.threshold - a.threshold)
                .map((t) => (
                  <tr key={t.threshold}>
                    <td>{gold(t.threshold)}+</td>
                    <td className="num">
                      <span className="rw-l-reward">{gold(t.prizeGold)} gold</span>
                      {t.prizeItem && <span className="rw-l-item">{t.prizeItem}</span>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      {podiumOrder.length > 0 && (
        <div className="rw-podium">
          <div className="rw-rod" aria-hidden />
          {podiumOrder.map(({ w, place }) => (
            <div
              key={w.name}
              className={`rw-banner is-podium place-${place + 1}`}
              style={{ "--i": place } as React.CSSProperties}
            >
              <div className="rw-cloth">
                <span className="rw-bn-season">{PLACE[place]}</span>
                {place === 0 ? <Crown size={64} /> : <span className="rw-bn-rank">{place + 1}</span>}
                <span className="rw-bn-champ">{w.name}</span>
                {w.note && <span className="rw-bn-caption">{w.note}</span>}
                <span className="rw-bn-rule" />
                {w.prizeGold ? (
                  <span className="rw-bn-paid">
                    {gold(w.prizeGold)}
                    <small> gold</small>
                  </span>
                ) : null}
                {w.prizeItem && <span className="rw-bn-item">{w.prizeItem}</span>}
                <span className="rw-bn-caption">
                  {w.runs !== undefined ? `${w.runs} runs, ` : ""}
                  {gold(w.generated)} generated
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {season.rewards.length > 0 && (
        <section className="rw-s-block">
          <h2>Every payout</h2>
          <Ledger rows={season.rewards} />
        </section>
      )}

      {season.hiddenRewards.length > 0 && (
        <section className="rw-s-block">
          <h2>Hidden rewards</h2>
          {season.hiddenRequirement && (
            <p className="rw-s-sub">Unlocked by: {season.hiddenRequirement}</p>
          )}
          <Ledger rows={season.hiddenRewards} />
        </section>
      )}

      {season.closingLine && <p className="rw-closing">{season.closingLine}</p>}
    </article>
  );
}

function Ledger({ rows }: { rows: Winner[] }) {
  const showRuns = rows.some((r) => r.runs !== undefined);
  let rank = 0;

  return (
    <table className="rw-ledger">
      <thead>
        <tr>
          <th className="rank">#</th>
          <th>Booster</th>
          {showRuns && <th className="num hide-sm">Runs</th>}
          <th className="num hide-sm">Generated</th>
          <th className="num">Reward</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((w) => {
          if (!w.disqualified) rank += 1;
          return (
            <tr key={w.name} className={w.disqualified ? "is-dq" : ""}>
              <td className="rank">{w.disqualified ? "–" : rank}</td>
              <td>
                <span className="rw-l-name">{w.name}</span>
                {w.note && <span className="rw-l-note">{w.note}</span>}
                <span className="rw-l-sub show-sm">
                  {w.runs !== undefined ? `${w.runs} runs, ` : ""}
                  {gold(w.generated)} generated
                </span>
              </td>
              {showRuns && <td className="num hide-sm">{w.runs ?? ""}</td>}
              <td className="num hide-sm">{gold(w.generated)}</td>
              <td className="num">
                {w.disqualified ? (
                  <span className="rw-l-dq">Disqualified</span>
                ) : (
                  <>
                    {w.prizeGold ? <span className="rw-l-reward">{gold(w.prizeGold)} gold</span> : null}
                    {w.prizeItem && <span className="rw-l-item">{w.prizeItem}</span>}
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ============================================================
   Styles
   Palette: parchment #efe2c2, old gold #e9c25b, brass #b8862c,
            iron #5b5466, ink rgba(12,7,20), plus the expansion accent
   Type:    Cinzel (names, headings), Alegreya Sans (everything else)
============================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Alegreya+Sans:wght@400;500;700;800&display=swap');

.rw {
  --parch: #efe2c2;
  --parch-dim: #b9ab8c;
  --gold: #e9c25b;
  --brass: #b8862c;
  --iron: #5b5466;
  min-height: 100vh; overflow-x: hidden;
  padding: 56px 24px 96px;
  color: var(--parch);
  font-family: "Alegreya Sans", system-ui, sans-serif;
  font-size: 18px; line-height: 1.5;
  background:
    radial-gradient(ellipse at 50% -10%, rgba(233,194,91,.10), transparent 50%),
    linear-gradient(rgba(6,3,14,.70), rgba(4,2,10,.90)),
    url('/bg.png') center top / cover no-repeat fixed;
}
.rw-wrap { max-width: 1080px; margin: 0 auto; }
.rw h1, .rw h2 { font-family: "Cinzel", Georgia, serif; font-weight: 700; margin: 0; }

/* ---------- hero ---------- */
.rw-hero { margin-bottom: 64px; }
.rw-hero h1 {
  font-size: clamp(44px, 7vw, 76px); line-height: 1.02; letter-spacing: .01em;
  color: var(--parch);
  text-shadow: 0 1px 0 #fff6, 0 -1px 0 #0009, 0 0 40px rgba(233,194,91,.25);
}
.rw-hero p { margin: 14px 0 0; max-width: 34em; font-size: 21px; color: var(--parch-dim); }
.rw-hero p b { color: var(--gold); font-weight: 800; font-variant-numeric: tabular-nums; }

/* ---------- hall ---------- */
.rw-hall { margin-bottom: 56px; }
.rw-hall-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 16px; margin-bottom: 18px; }
.rw-hall-head h2 {
  font-size: 34px; color: var(--ac);
  text-shadow: 0 0 24px rgba(var(--ac-rgb), .45);
}
.rw-hall-years { color: var(--parch-dim); font-size: 16px; font-variant-numeric: lining-nums; }
.rw-now {
  font-size: 14px; font-weight: 700; color: var(--parch);
  padding: 1px 10px; border-radius: 999px;
  border: 1px solid rgba(var(--ac-rgb), .7); background: rgba(var(--ac-rgb), .18);
}

.rw-hall-scroll { overflow-x: auto; padding: 0 2px 26px; margin: 0 -2px; scrollbar-width: thin; }
.rw-track { position: relative; display: flex; gap: 26px; width: max-content; padding: 0 22px; box-sizing: border-box; }

/* the brass rod banners hang from */
.rw-rod {
  position: absolute; left: 0; right: 0; top: 6px; height: 9px; border-radius: 5px;
  background: linear-gradient(#e4c27a, #a77a2c 55%, #5e4316);
  box-shadow: 0 4px 8px rgba(0,0,0,.6);
}
.rw-rod::before, .rw-rod::after {
  content: ""; position: absolute; top: -6px; width: 21px; height: 21px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fbe7a6, #b8862c 55%, #5e4316);
  box-shadow: 0 3px 6px rgba(0,0,0,.6);
}
.rw-rod::before { left: -6px; }
.rw-rod::after { right: -6px; }

/* ---------- banner ---------- */
.rw-banner {
  position: relative; flex: 0 0 auto; width: 214px; padding: 12px 0 0;
  border: 0; background: none; color: inherit; font: inherit; text-align: center;
  filter: drop-shadow(0 16px 22px rgba(0,0,0,.6));
  transform-origin: top center;
}
/* the two loops wrapped round the rod */
.rw-banner::before, .rw-banner::after {
  content: ""; position: absolute; top: 2px; width: 16px; height: 22px; border-radius: 4px;
  background: linear-gradient(90deg, rgba(0,0,0,.4), rgba(var(--ac-rgb), .55), rgba(0,0,0,.4)), #1a1224;
  z-index: 1;
}
.rw-banner::before { left: 22%; }
.rw-banner::after { right: 22%; }

.rw-cloth {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  min-height: 340px; padding: 24px 18px 62px; box-sizing: border-box;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 40px), 0 100%);
  background:
    linear-gradient(90deg, rgba(0,0,0,.42), transparent 16%, transparent 84%, rgba(0,0,0,.42)),
    repeating-linear-gradient(90deg, rgba(255,255,255,.025) 0 2px, transparent 2px 5px),
    linear-gradient(180deg, rgba(var(--ac-rgb), .50), rgba(var(--ac-rgb), .20) 62%, rgba(var(--ac-rgb), .30)),
    #150d20;
  box-shadow:
    inset 3px 0 0 var(--brass), inset -3px 0 0 var(--brass), inset 0 3px 0 var(--brass),
    inset 8px 0 0 rgba(0,0,0,.35), inset -8px 0 0 rgba(0,0,0,.35);
  animation: rwUnfurl .8s cubic-bezier(.2,.75,.25,1) both;
  animation-delay: calc(var(--i, 0) * 70ms);
  transform-origin: top center;
}
@keyframes rwUnfurl {
  from { transform: scaleY(.04); opacity: 0; }
  60%  { opacity: 1; }
  to   { transform: scaleY(1); opacity: 1; }
}

.rw-bn-season { font-family: "Cinzel", serif; font-weight: 700; font-size: 15px; color: rgba(239,226,194,.8); letter-spacing: .06em; }
.rw-crown { margin: 14px 0 6px; filter: drop-shadow(0 0 12px rgba(233,194,91,.55)); }
.rw-bn-champ {
  font-family: "Cinzel", serif; font-weight: 800; font-size: 23px; line-height: 1.15;
  color: #fff3cf; word-break: break-word; text-shadow: 0 2px 0 rgba(0,0,0,.55);
}
.rw-bn-caption { font-size: 15px; line-height: 1.35; color: rgba(239,226,194,.72); }
.rw-bn-rule { width: 56%; height: 1px; margin: 12px 0 10px; background: linear-gradient(90deg, transparent, var(--gold), transparent); }
.rw-bn-paid {
  font-weight: 800; font-size: 27px; line-height: 1.1; color: var(--gold);
  font-variant-numeric: tabular-nums lining-nums; text-shadow: 0 2px 0 rgba(0,0,0,.5);
}
.rw-bn-paid small { font-size: 16px; font-weight: 700; color: rgba(233,194,91,.8); }
.rw-bn-item { margin: 4px 0 2px; font-weight: 700; font-size: 15px; color: #fff3cf; }
.rw-bn-open {
  margin-top: auto; padding: 5px 16px; border-radius: 4px;
  border: 1px solid rgba(233,194,91,.65); background: rgba(10,6,16,.45);
  font-weight: 700; font-size: 15px; color: var(--parch);
}

.rw-banner.is-set { cursor: pointer; transition: transform .25s ease, filter .25s ease; }
.rw-banner.is-set:hover { transform: translateY(5px); filter: drop-shadow(0 20px 26px rgba(0,0,0,.65)) brightness(1.12); }
.rw-banner.is-set:hover .rw-bn-open { background: rgba(233,194,91,.2); }
.rw-banner.is-set:focus-visible { outline: 2px solid var(--gold); outline-offset: 6px; border-radius: 4px; }

/* lost seasons: short, torn, faded */
.rw-banner.is-lost { opacity: .62; filter: drop-shadow(0 10px 14px rgba(0,0,0,.5)) saturate(.35); }
.rw-banner.is-lost .rw-cloth {
  min-height: 170px; padding: 24px 16px 40px; justify-content: flex-start; gap: 8px;
  clip-path: polygon(0 0,100% 0,100% 80%,93% 88%,85% 82%,76% 95%,66% 85%,55% 100%,45% 87%,34% 96%,24% 84%,14% 92%,6% 83%,0 90%);
  background:
    linear-gradient(90deg, rgba(0,0,0,.45), transparent 18%, transparent 82%, rgba(0,0,0,.45)),
    linear-gradient(180deg, rgba(var(--ac-rgb), .22), rgba(30,26,38,.85)),
    #17131d;
  box-shadow: inset 3px 0 0 var(--iron), inset -3px 0 0 var(--iron), inset 0 3px 0 var(--iron);
}
.rw-bn-lost { font-size: 15px; color: rgba(239,226,194,.7); }

/* archive halls (nothing recorded) are smaller */
.rw-hall.is-archive { margin-bottom: 40px; }
.rw-hall.is-archive .rw-hall-head h2 { font-size: 26px; }
.rw-hall.is-archive .rw-banner { width: 168px; }
.rw-hall.is-archive .rw-cloth { min-height: 128px; }

/* ---------- season view ---------- */
.rw-back {
  padding: 8px 16px; border-radius: 4px; cursor: pointer;
  border: 1px solid rgba(233,194,91,.5); background: rgba(10,6,16,.6);
  color: var(--parch); font: 700 16px "Alegreya Sans", sans-serif;
}
.rw-back:hover { background: rgba(233,194,91,.15); }
.rw-back:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }

.rw-s-head { margin: 34px 0 26px; }
.rw-s-head h1 { font-size: clamp(34px, 5.4vw, 56px); line-height: 1.08; color: var(--parch); text-shadow: 0 0 30px rgba(233,194,91,.2); }
.rw-s-summary { margin: 14px 0 0; max-width: 40em; font-size: 21px; color: var(--parch-dim); font-variant-numeric: tabular-nums; }

.rw-s-notes {
  max-width: 46em; margin-bottom: 40px; padding: 4px 0 4px 20px;
  border-left: 3px solid var(--brass); color: var(--parch);
}
.rw-s-notes p { margin: 8px 0; }
.rw-s-notes ul { margin: 8px 0; padding-left: 20px; }
.rw-s-notes li { margin: 2px 0; }

.rw-podium {
  position: relative; display: flex; justify-content: center; align-items: flex-start; gap: 30px;
  width: fit-content; max-width: 100%; box-sizing: border-box;
  padding: 0 22px; margin: 10px auto 64px;
}
.rw-banner.is-podium { width: 250px; }
.rw-banner.is-podium .rw-cloth { min-height: 330px; }
.rw-banner.is-podium.place-1 { width: 290px; }
.rw-banner.is-podium.place-1 .rw-cloth { min-height: 400px; }
.rw-banner.is-podium.place-1 .rw-bn-champ { font-size: 30px; }
.rw-banner.is-podium.place-1 .rw-bn-paid { font-size: 32px; }
.rw-banner.is-podium.place-2 { --ac-rgb: 170,176,190; }
.rw-banner.is-podium.place-3 { --ac-rgb: 176,108,52; }
.rw-bn-rank {
  margin: 12px 0 8px; width: 46px; height: 46px; border-radius: 50%;
  display: grid; place-items: center;
  font: 800 24px "Cinzel", serif; color: #fff3cf;
  border: 2px solid var(--brass); background: rgba(0,0,0,.35);
}

.rw-s-block { margin-bottom: 52px; }
.rw-s-block h2 { font-size: 28px; color: var(--parch); margin-bottom: 6px; }
.rw-s-sub { margin: 0 0 14px; color: var(--parch-dim); max-width: 46em; }

/* ---------- ledger ---------- */
.rw-ledger {
  width: 100%; border-collapse: collapse; margin-top: 14px;
  background: rgba(10,6,18,.72); border: 1px solid rgba(184,134,44,.35);
  color: var(--parch); font-family: inherit; font-size: inherit;
  font-variant-numeric: tabular-nums lining-nums;
}
.rw-ledger th {
  padding: 12px 16px; text-align: left; font-weight: 700; font-size: 15px; color: var(--parch-dim);
  border-bottom: 1px solid rgba(184,134,44,.5); background: rgba(184,134,44,.08);
}
.rw-ledger td { padding: 12px 16px; border-bottom: 1px solid rgba(239,226,194,.08); vertical-align: top; }
.rw-ledger tbody tr:last-child td { border-bottom: 0; }
.rw-ledger tbody tr:nth-child(-n+3):not(.is-dq) .rw-l-name { color: #fff3cf; }
.rw-ledger tbody tr:hover td { background: rgba(233,194,91,.05); }
.rw-ledger .num { text-align: right; white-space: nowrap; }
.rw-ledger .rank { width: 44px; color: var(--parch-dim); }
.rw-l-name { display: block; font-weight: 700; font-size: 18px; }
.rw-l-note { display: block; font-size: 15px; color: var(--parch-dim); font-style: italic; }
.rw-l-reward { display: block; font-weight: 800; color: var(--gold); }
.rw-l-item { display: block; font-size: 15px; color: var(--parch); white-space: normal; }
.rw-l-sub { font-size: 14px; color: var(--parch-dim); }
.rw-l-dq { font-weight: 800; color: #f87171; }
.rw-ledger tr.is-dq .rw-l-name { text-decoration: line-through; text-decoration-color: rgba(248,113,113,.8); color: var(--parch-dim); }
.show-sm { display: none !important; }

.rw-closing { margin: 10px 0 0; font: 700 26px "Cinzel", serif; color: var(--parch); }

/* ---------- small screens ---------- */
@media (max-width: 760px) {
  .rw { padding: 36px 16px 72px; font-size: 17px; }
  .rw-hero { margin-bottom: 44px; }
  .rw-hero p, .rw-s-summary { font-size: 18px; }
  .rw-hall-head h2 { font-size: 28px; }
  /* newest season first, so the champion is on screen */
  .rw-track { gap: 16px; padding: 0 14px; flex-direction: row-reverse; }
  .rw-banner { width: 176px; }
  .rw-cloth { min-height: 310px; padding: 22px 12px 58px; }
  .rw-bn-champ { font-size: 20px; }
  .rw-bn-paid { font-size: 23px; }
  .rw-hall.is-archive .rw-banner { width: 140px; }

  .rw-podium { flex-direction: column; align-items: center; gap: 22px; padding: 0; }
  .rw-podium .rw-rod { display: none; }
  .rw-banner.is-podium, .rw-banner.is-podium.place-1 { width: min(300px, 100%); }
  .rw-banner.is-podium.place-1 { order: -1; }
  .rw-banner.is-podium .rw-cloth, .rw-banner.is-podium.place-1 .rw-cloth { min-height: 0; padding-bottom: 64px; }

  .hide-sm { display: none; }
  .show-sm { display: block !important; }
  .rw-ledger th, .rw-ledger td { padding: 10px 10px; }
  .rw-ledger .rank { width: 30px; }
}

@media (prefers-reduced-motion: reduce) {
  .rw-cloth { animation: none; }
  .rw-banner.is-set { transition: none; }
}
`;
