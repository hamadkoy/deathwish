"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ApplyCharacter = {
  name: string;
  realm: string;
  class: string;
  spec: string;
  ilvl: number;
  progress: string;
  score: number;
  avatar_url: string;
  warcraftlogs_url: string;
};

function getClassColor(className: string) {
  const colors: Record<string, string> = {
    "Death Knight": "#C41E3A",
    "Demon Hunter": "#A330C9",
    Druid: "#FF7C0A",
    Evoker: "#33937F",
    Hunter: "#AAD372",
    Mage: "#3FC7EB",
    Monk: "#00FF98",
    Paladin: "#F48CBA",
    Priest: "#FFFFFF",
    Rogue: "#FFF468",
    Shaman: "#0070DD",
    Warlock: "#8788EE",
    Warrior: "#C69B6D",
  };

  return colors[className] || "#d6a84f";
}

export default function ApplyPage() {
  const router = useRouter();
const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [name, setName] = useState("");
  const [realm, setRealm] = useState("Kazzak");
  const [character, setCharacter] = useState<ApplyCharacter | null>(null);
  const [loading, setLoading] = useState(false);

  const [altName, setAltName] = useState("");
  const [altRealm, setAltRealm] = useState("Kazzak");
  const [altCharacter, setAltCharacter] = useState<ApplyCharacter | null>(null);
  const [altLoading, setAltLoading] = useState(false);

  const [playerName, setPlayerName] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [experience, setExperience] = useState("");
  const [raidAvailability, setRaidAvailability] = useState("");
  const [previousGuilds, setPreviousGuilds] = useState("");
  const [whyLeftGuild, setWhyLeftGuild] = useState("");
  const [splitAltAnswer, setSplitAltAnswer] = useState("");
  const [thirdDayAnswer, setThirdDayAnswer] = useState("");
  const [extraInfo, setExtraInfo] = useState("");

  async function fetchCharacter(
    charName: string,
    charRealm: string,
    setChar: (char: ApplyCharacter) => void,
    setCharLoading: (loading: boolean) => void
  ) {
    if (!charName.trim() || !charRealm.trim()) {
      alert("Enter character name and server.");
      return;
    }

    setCharLoading(true);

    try {
      const res = await fetch(
        `https://raider.io/api/v1/characters/profile?region=eu&realm=${charRealm.trim()}&name=${charName.trim()}&fields=gear,raid_progression,mythic_plus_scores_by_season_current,mythic_plus_best_runs`
      );

      const data = await res.json();

      if (data.statusCode) {
        alert("Character not found on Raider.IO");
        return;
      }

      const raids = Object.values(data.raid_progression || {}) as any[];
      let bestMythic = 0;

      raids.forEach((raid: any) => {
        if (raid?.mythic_bosses_killed > bestMythic) {
          bestMythic = raid.mythic_bosses_killed;
        }
      });

      const rioScore = Math.floor(
        data.mythic_plus_scores_by_season_current?.scores?.all ||
          data.mythic_plus_scores_by_season_current?.all ||
          data.mythic_plus_scores_by_season_current?.segments?.all?.score ||
          data.mythic_plus_best_runs?.reduce(
            (total: number, run: any) => total + (run.score || 0),
            0
          ) ||
          0
      );

      setChar({
        name: data.name,
        realm: data.realm,
        class: data.class,
        spec: data.active_spec_name,
        ilvl: Math.floor(
          data.gear?.item_level_equipped || data.gear?.item_level || 0
        ),
        progress: `${bestMythic}/9M`,
        score: rioScore,
        avatar_url: data.thumbnail_url || "",
        warcraftlogs_url: `https://www.warcraftlogs.com/character/eu/${data.realm.toLowerCase()}/${data.name.toLowerCase()}`,
      });
    } catch {
      alert("Failed to fetch character.");
    } finally {
      setCharLoading(false);
    }
  }

  async function submitApplication(e: React.FormEvent) {
    e.preventDefault();

    if (!character) {
      alert("Please add your main character first.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .single();

    const { error } = await supabase.from("applications").insert({
      user_id: user.id,

      character_name: character.name,
      realm: character.realm,
      class: character.class,
      spec: character.spec,
      avatar_url: character.avatar_url,
      discord_avatar_url: profile?.avatar_url || null,
      ilvl: character.ilvl,
      raider_io_score: character.score,
      raid_progress: character.progress,
      raider_io: `https://raider.io/characters/eu/${character.realm}/${character.name}`,
      warcraft_logs: character.warcraftlogs_url,

      applicant_name: playerName,
      age,
      country,
      experience,
      raid_availability: raidAvailability,
      previous_guilds: previousGuilds,
      why_left_guild: whyLeftGuild,

      extra_info: `
REQUIREMENT
Alt Question: ${splitAltAnswer}
Alt Character: ${altCharacter ? `${altCharacter.name}-${altCharacter.realm}` : "Not added"}
Third Day First Two Weeks: ${thirdDayAnswer}

ABOUT YOU
${extraInfo}
`,

      status: "pending",
    });

if (error) {
  alert(error.message);
  return;
}

setShowSuccessPopup(true);
  }

  return (
    <main className="page">
      <div className="wrap">
        <section className="hero">
          <div className="heroText">
            <h2>APPLY TO</h2>
            <h1>DEATH WISH</h1>
            <p>2-DAY CUTTING EDGE RAIDING GUILD</p>
          </div>
        </section>

        <form onSubmit={submitApplication}>
          <section className="card">
            <h3>CHARACTER INFORMATION</h3>

            <div className="addGrid">
              <input
                placeholder="Character Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                placeholder="Character Server"
                value={realm}
                onChange={(e) => setRealm(e.target.value)}
              />

              <button
                type="button"
                className="addBtn"
                onClick={() =>
                  fetchCharacter(name, realm, setCharacter, setLoading)
                }
              >
                {loading ? "ADDING..." : "ADD CHARACTER +"}
              </button>
            </div>

            {character && (
              <div className="characterShowcase">
                <div className="charTop">
                  <img
                    src={character.avatar_url || "/websitelogo.png"}
                    alt={character.name}
                    onError={(e) => {
                      e.currentTarget.src = "/websitelogo.png";
                    }}
                  />

                  <div>
                    <h2 style={{ color: getClassColor(character.class) }}>
                      {character.name}
                    </h2>

                    <p style={{ color: getClassColor(character.class) }}>
                      {character.spec} {character.class} • {character.realm}
                    </p>
                  </div>

                  <strong>{character.ilvl}</strong>
                </div>

                <div className="stats">
                  <div>
                    <span>Item Level</span>
                    <b>{character.ilvl}</b>
                  </div>

                  <div>
                    <span>Raider.IO Score</span>
                    <b className="green">{character.score}</b>
                  </div>

                  <div>
                    <span>Raid Progress</span>
                    <b className="pink">{character.progress}</b>
                  </div>
                </div>

                <a
                  href={character.warcraftlogs_url}
                  target="_blank"
                  rel="noreferrer"
                  className="logsBtn"
                >
                  VIEW WARCRAFT LOGS
                </a>
              </div>
            )}
          </section>

          <section className="card">
            <h3>PERSONAL INFORMATION</h3>

            <div className="grid">
              <input
                placeholder="Name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />

              <input
                placeholder="Age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />

              <input
                placeholder="Country / Timezone"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />

              <select
                value={raidAvailability}
                onChange={(e) => setRaidAvailability(e.target.value)}
              >
                <option value="" disabled>
                  Can you raid Sunday + Monday 18:00 - 22:00?
                </option>
                <option value="yes">Yes, I can raid both days</option>
                <option value="no">No</option>
                <option value="sometimes">Sometimes / Need to explain</option>
              </select>
            </div>
          </section>

          <section className="card">
            <h3>RAIDING EXPERIENCE</h3>

            <div className="grid">
              <input
                placeholder="Previous Guilds"
                value={previousGuilds}
                onChange={(e) => setPreviousGuilds(e.target.value)}
              />

              <textarea
                placeholder="Why did you leave your previous guild?"
                value={whyLeftGuild}
                onChange={(e) => setWhyLeftGuild(e.target.value)}
              />

              <textarea
                className="wide"
                placeholder="Tell us about your raiding experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              />
            </div>
          </section>

          <section className="card">
            <h3>REQUIREMENT</h3>

            <div className="grid">
              <select
                value={splitAltAnswer}
                onChange={(e) => setSplitAltAnswer(e.target.value)}
              >
                <option value="" disabled>
                  We require an alt for our split run. Is this okay?
                </option>
                <option value="yes">Yes, I have an alt</option>
                <option value="working">I am working on an alt</option>
                <option value="no">No</option>
              </select>

              <select
                value={thirdDayAnswer}
                onChange={(e) => setThirdDayAnswer(e.target.value)}
              >
                <option value="" disabled>
                  We add 3rd day on first two weeks of season. Issue?
                </option>
                <option value="no_issue">No issue</option>
                <option value="maybe">Maybe / depends</option>
                <option value="issue">Yes, it will be an issue</option>
              </select>
            </div>

            <div className="addGrid requirementAdd">
              <input
                placeholder="Alt Character Name"
                value={altName}
                onChange={(e) => setAltName(e.target.value)}
              />

              <input
                placeholder="Alt Character Server"
                value={altRealm}
                onChange={(e) => setAltRealm(e.target.value)}
              />

              <button
                type="button"
                className="addBtn"
                onClick={() =>
                  fetchCharacter(
                    altName,
                    altRealm,
                    setAltCharacter,
                    setAltLoading
                  )
                }
              >
                {altLoading ? "ADDING..." : "ADD ALT +"}
              </button>
            </div>

            {altCharacter && (
              <div className="characterShowcase">
                <div className="charTop">
                  <img
                    src={altCharacter.avatar_url || "/websitelogo.png"}
                    alt={altCharacter.name}
                    onError={(e) => {
                      e.currentTarget.src = "/websitelogo.png";
                    }}
                  />

                  <div>
                    <h2 style={{ color: getClassColor(altCharacter.class) }}>
                      {altCharacter.name}
                    </h2>

                    <p style={{ color: getClassColor(altCharacter.class) }}>
                      {altCharacter.spec} {altCharacter.class} •{" "}
                      {altCharacter.realm}
                    </p>
                  </div>

                  <strong>{altCharacter.ilvl}</strong>
                </div>

                <div className="stats">
                  <div>
                    <span>Item Level</span>
                    <b>{altCharacter.ilvl}</b>
                  </div>

                  <div>
                    <span>Raider.IO Score</span>
                    <b className="green">{altCharacter.score}</b>
                  </div>

                  <div>
                    <span>Raid Progress</span>
                    <b className="pink">{altCharacter.progress}</b>
                  </div>
                </div>

                <a
                  href={altCharacter.warcraftlogs_url}
                  target="_blank"
                  rel="noreferrer"
                  className="logsBtn"
                >
                  VIEW WARCRAFT LOGS
                </a>
              </div>
            )}
          </section>

          <section className="card">
            <h3>ABOUT YOU</h3>

            <textarea
              placeholder="Anything else we should know?"
              value={extraInfo}
              onChange={(e) => setExtraInfo(e.target.value)}
            />
          </section>

          <div className="submitBox">
            <button type="submit" className="submitBtn">
              SUBMIT APPLICATION →
            </button>
            <p>We review every application carefully.</p>
          </div>
        </form>
      </div>
{showSuccessPopup && (
  <div className="successOverlay">
    <div className="successPopup">
      <div className="successIcon">✓</div>

      <h2>APPLICATION SUBMITTED!</h2>
      <div className="successLine" />

<p>
  Thank you for applying to <b>Death Wish</b>.
  <br />
  We will review your application carefully.
  <br />
  Make sure to check for any feedback in Application Forums.
</p>

<button
  type="button"
  className="successBtn"
  onClick={() => router.push("/application-forums")}
>
  GO TO APPLICATION FORUMS
</button>

<button
  type="button"
  className="closeBtn"
  onClick={() => setShowSuccessPopup(false)}
>
  CLOSE
</button>
    </div>
  </div>
)}
      <style jsx>{`
        .page {
          min-height: 100vh;
          color: #f5ead0;
          font-family: Georgia, "Times New Roman", serif;
          background:
            linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.88)),
            url("/apply.png");
          background-size: cover;
          background-position: center top;
          background-attachment: fixed;
        }

        .wrap {
          max-width: 1060px;
          margin: 0 auto;
          padding: 22px 16px 50px;
        }

        .hero {
          min-height: 230px;
          border: 1px solid rgba(214, 168, 79, 0.35);
          border-radius: 10px;
          background:
            linear-gradient(90deg, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.18)),
            url("/About guild.png") center / cover no-repeat;
          box-shadow:
            0 14px 35px rgba(0, 0, 0, 0.7),
            inset 0 0 35px rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          position: relative;
          overflow: hidden;
        }

        .heroText {
          position: relative;
          z-index: 2;
          text-shadow: 0 0 18px black;
        }

        .hero h2 {
          margin: 0;
          color: #d6a84f;
          font-size: 22px;
          letter-spacing: 6px;
        }

        .hero h1 {
          margin: 8px 0 12px;
          color: #fff4dc;
          font-size: 64px;
          line-height: 1;
          letter-spacing: 5px;
        }

        .hero p {
          margin: 0;
          color: #e5c982;
          font-weight: 900;
          letter-spacing: 2px;
        }
.successOverlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.successPopup {
  width: min(850px, 95vw);
  min-height: 500px;

  position: relative;
  padding: 90px 60px 50px;

  text-align: center;
  border-radius: 24px;

  background:
    radial-gradient(circle at top,
      rgba(128, 35, 190, 0.35),
      transparent 45%),
    linear-gradient(180deg, #11111a, #030308);

  border: 2px solid rgba(214, 168, 79, 0.9);

  box-shadow:
    0 0 80px rgba(168, 85, 247, 0.9),
    0 0 150px rgba(168, 85, 247, 0.4);

  display: flex;
  flex-direction: column;
  justify-content: center;
}


.successIcon {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);

  width: 120px;
  height: 120px;

  border-radius: 50%;
  border: 3px solid #d6a84f;

  background: #09090f;

  display: flex;
  align-items: center;
  justify-content: center;

  color: #4ade80;
  font-size: 70px;
  font-weight: 900;
}

.successPopup h2 {
  color: #f6b83f;
  font-size: 42px;
  margin-bottom: 20px;
}

.successLine {
  height: 1px;
  width: 75%;
  margin: 0 auto 26px;
  background: linear-gradient(90deg, transparent, #a855f7, #f6b83f, #a855f7, transparent);
}

.successPopup p {
  color: #eee;
  font-size: 22px;
  line-height: 1.8;
}
  .successBtn {
  margin-top: 30px;
  width: 100%;
  height: 65px;

  border-radius: 10px;
  border: 1px solid #d6a84f;

  background: linear-gradient(
    180deg,
    rgba(95, 29, 130, 0.95),
    rgba(35, 8, 50, 0.98)
  );

  color: white;
  font-size: 18px;
  font-weight: 900;
  cursor: pointer;
}

.closeBtn {
  margin-top: 12px;
  width: 100%;
  height: 55px;

  border-radius: 10px;
  border: 1px solid rgba(214, 168, 79, 0.35);

  background: rgba(255,255,255,0.03);

  color: #d6a84f;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.successBtn:hover,
.closeBtn:hover {
  opacity: 0.9;
}
        form {
          margin-top: 12px;
        }

.card {
  margin-top: 12px;
  padding: 18px;

  border: none;
  border-radius: 0;

  background: transparent;

  box-shadow: none;
}

        h3 {
          margin: 0 0 18px;
          color: #d6a84f;
          font-size: 20px;
          letter-spacing: 2px;
          text-shadow: 0 0 12px black;
        }

        .addGrid {
          display: grid;
          grid-template-columns: 1fr 1fr 220px;
          gap: 14px;
        }

        .requirementAdd {
          margin-top: 14px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        .wide {
          grid-column: span 2;
        }

        input,
        textarea,
        select {
          width: 100%;
          padding: 14px 16px;
          border-radius: 5px;
          border: 1px solid rgba(214, 168, 79, 0.35);
          background:
            linear-gradient(rgba(255, 255, 255, 0.03), transparent),
            rgba(0, 0, 0, 0.78);
          color: #f5ead0;
          font-size: 18px;
          font-weight: 600;
          line-height: 1.4;
          outline: none;
          font-family: Georgia, "Times New Roman", serif;
          box-shadow: inset 0 0 16px rgba(0, 0, 0, 0.7);
        }

        input::placeholder,
        textarea::placeholder {
          color: rgba(214, 168, 79, 0.55);
          font-size: 14px;
          font-weight: 400;
          font-style: italic;
        }

        select {
          color: rgba(214, 168, 79, 0.75);
          font-size: 14px;
          font-weight: 500;
        }

        input,
        textarea {
          text-shadow: 0 0 4px rgba(255, 255, 255, 0.15);
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: rgba(214, 168, 79, 0.85);
          background: rgba(0, 0, 0, 0.88);
        }

        textarea {
          min-height: 82px;
          resize: vertical;
        }

        .addBtn,
        .submitBtn {
          border-radius: 6px;
          border: 1px solid rgba(214, 168, 79, 0.75);
          background:
            linear-gradient(
              180deg,
              rgba(95, 29, 130, 0.95),
              rgba(35, 8, 50, 0.98)
            );
          color: #fff2d8;
          font-family: Georgia, "Times New Roman", serif;
          font-weight: 900;
          cursor: pointer;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.12),
            0 8px 18px rgba(0, 0, 0, 0.55);
          transition: 0.2s ease;
        }

        .addBtn:hover,
        .submitBtn:hover {
          transform: translateY(-1px);
          border-color: #d6a84f;
          background:
            linear-gradient(
              180deg,
              rgba(120, 38, 165, 0.98),
              rgba(42, 9, 62, 1)
            );
        }

        .characterShowcase {
          margin-top: 18px;
          padding: 18px;
          border-radius: 8px;
          border: 1px solid rgba(214, 168, 79, 0.34);
          background:
            linear-gradient(rgba(15, 10, 18, 0.82), rgba(0, 0, 0, 0.92)),
            url("/bg.png") center / cover;
        }

        .charTop {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .charTop img {
          width: 78px;
          height: 78px;
          border-radius: 10px;
          border: 1px solid rgba(214, 168, 79, 0.65);
          object-fit: cover;
        }

        .charTop h2 {
          margin: 0;
          font-size: 30px;
        }

        .charTop p {
          margin: 4px 0 0;
          font-weight: 900;
        }

        .charTop strong {
          margin-left: auto;
          color: #e879f9;
          font-size: 32px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .stats div {
          padding: 14px;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.62);
          border: 1px solid rgba(214, 168, 79, 0.25);
        }

        .stats span {
          display: block;
          color: #d6a84f;
          font-weight: 900;
          margin-bottom: 8px;
        }

        .stats b {
          font-size: 26px;
          color: #e879f9;
        }

        .green {
          color: #4ade80 !important;
        }

        .pink {
          color: #f0abfc !important;
        }

        .logsBtn {
          display: block;
          margin-top: 16px;
          padding: 14px;
          text-align: center;
          border-radius: 8px;
          border: 1px solid rgba(214, 168, 79, 0.7);
          background:
            linear-gradient(
              180deg,
              rgba(95, 29, 130, 0.95),
              rgba(35, 8, 50, 0.98)
            );
          color: #fff2d8;
          font-weight: 900;
          text-decoration: none;
          transition: 0.2s ease;
        }

        .logsBtn:hover {
          transform: translateY(-1px);
          border-color: #d6a84f;
        }

        .submitBox {
          text-align: center;
          margin-top: 16px;
        }

        .submitBtn {
          width: 320px;
          height: 54px;
          font-size: 16px;
        }

        .submitBox p {
          margin: 10px 0 0;
          color: rgba(245, 234, 208, 0.7);
          font-size: 13px;
        }

        @media (max-width: 850px) {
          .wrap {
            padding: 16px 12px 40px;
          }

          .hero h1 {
            font-size: 42px;
          }

          .addGrid,
          .grid,
          .stats {
            grid-template-columns: 1fr;
          }

          .wide {
            grid-column: span 1;
          }

          .submitBtn {
            width: 100%;
          }

          .charTop {
            align-items: flex-start;
          }

          .charTop strong {
            margin-left: 0;
          }
        }
      `}</style>
    </main>
  );
}