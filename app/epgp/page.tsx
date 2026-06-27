"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import GuildAccessGuard from "@/app/components/GuildAccessGuard";

type EPGPRow = {
  rank: string;
  discordId: string;
  name: string;
  ap: string;
  sp: string;
  priority: string;
  avatar_url?: string | null;
};

const SHEET_ID = "1c_lPdMLgR8XRtQKh1yW7lzlr2myaVXgyQxpWVkXqj0Q";
const GID = "840624317";

const classColors: Record<string, string> = {
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

/* Put player class here */
const playerClasses: Record<string, string> = {
  Athangur: "Warrior",
  Matipala: "Paladin",
  Jdawee: "Shaman",
  Koy: "Death Knight",
  Silenda: "Druid",
  Yourchi: "Priest",
  Matalic: "Demon Hunter",
  Donqt: "Warlock",
  Soywer: "Hunter",
  Crimorre: "Rogue",
};

function parseCSV(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((row) =>
      row.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim())
    );
}

export default function EPGPPage() {
  const [rows, setRows] = useState<EPGPRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSheet() {
      try {
        const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID}`;
        const res = await fetch(url);
        const text = await res.text();
        const lines = parseCSV(text);

        const data: EPGPRow[] = [];

        for (const cols of lines) {
          for (let i = 8; i < cols.length; i++) {
            const rank = cols[i];
            const discordId = cols[i + 1];
            const name = cols[i + 2];
            const ap = cols[i + 3];
            const sp = cols[i + 4];
            const priority = cols[i + 5];

            const isRosterRow =
              /^\d+$/.test(rank) &&
              /^\d{10,}$/.test(discordId) &&
              name &&
              isNaN(Number(name)) &&
              /^\d+$/.test(ap) &&
              /^\d+$/.test(sp) &&
              /^\d+$/.test(priority);

            if (isRosterRow) {
              data.push({ rank, discordId, name, ap, sp, priority });
              break;
            }
          }
        }

        const discordIds = data.map((r) => r.discordId);

        const { data: profiles } = await supabase
          .from("profiles")
          .select("discord_id, avatar_url")
          .in("discord_id", discordIds);

        const avatarMap = new Map(
          (profiles || []).map((p) => [String(p.discord_id), p.avatar_url])
        );

        setRows(
          data.map((row) => ({
            ...row,
            avatar_url: avatarMap.get(row.discordId) || null,
          }))
        );
      } catch (error) {
        console.error("EPGP sheet error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSheet();
  }, []);

 return (
  <GuildAccessGuard>
    <main className="min-h-screen bg-[#07050d] text-white">
      <section
        className="bg-no-repeat bg-top px-6 pb-8 pt-2"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(7,5,13,0.05), rgba(7,5,13,0.25) 420px, #07050d 760px), url('/epgp.png')",
          backgroundSize: "100% auto",
          backgroundPosition: "top center",
        }}
      >
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-3 text-center">
            <h1 className="text-4xl font-black tracking-widest text-[#f6d98a] drop-shadow-[0_0_14px_rgba(168,85,247,0.7)]">
              EPGP LIST
            </h1>
            <p className="text-xl font-bold tracking-[0.25em] text-[#b15cff]">
              FOR SEASON 1
            </p>
          </div>

          <div className="rounded-xl border border-[#5b2e8a] bg-[#100c1d]/90 p-4 shadow-[0_0_35px_rgba(126,34,206,0.55)]">
            <div className="mx-auto mb-3 w-[360px] rounded-lg border border-[#5b2e8a] bg-[#1b1230]/95 py-2 text-center text-2xl font-bold tracking-widest text-[#ddd5ff]">
              ROSTER
            </div>

            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="bg-[#160f25] text-lg text-[#b15cff]">
                  <th className="border border-[#302044] px-3 py-2">#</th>
                  <th className="border border-[#302044] px-3 py-2 text-left">
                    NAME
                  </th>
                  <th className="border border-[#302044] px-3 py-2">AP</th>
                  <th className="border border-[#302044] px-3 py-2">SP</th>
                  <th className="border border-[#302044] px-3 py-2">
                    PRIORITY
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-2xl text-[#f6d98a]">
                      Loading...
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const wowClass = playerClasses[row.name];
                    const nameColor = wowClass
                      ? classColors[wowClass]
                      : "#ffffff";

                    return (
                      <tr
                        key={`${row.rank}-${row.name}`}
                        className="bg-[#11101d]/95 text-lg font-bold hover:bg-[#211636]"
                      >
                        <td className="border border-[#302044] px-3 py-2 text-white">
                          {row.rank}
                        </td>

                        <td className="border border-[#302044] px-3 py-2 text-left">
                          <div className="flex items-center gap-3">
                            <img
                              src={row.avatar_url || "/default-avatar.png"}
                              alt={row.name}
                              className="h-9 w-9 rounded-full border-2 border-[#8b5cf6] object-cover shadow-[0_0_12px_rgba(168,85,247,0.8)]"
                            />
                            <span style={{ color: nameColor }}>
                              {row.name}
                            </span>
                          </div>
                        </td>

                        <td className="border border-[#302044] px-3 py-2 text-[#ffd21f]">
                          {row.ap}
                        </td>
                        <td className="border border-[#302044] px-3 py-2 text-white">
                          {row.sp}
                        </td>
                        <td className="border border-[#302044] px-3 py-2 text-[#ffd21f]">
                          {row.priority}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  </GuildAccessGuard>
  );
}