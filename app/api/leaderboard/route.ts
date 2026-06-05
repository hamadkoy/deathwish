import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID =
  "1rXKtKuuEJj8ORkQ_LclEJGc0v1ccbuguj5u8v46yeuU";

const SEASONS = [
  "Shadowland Season 1",
  "Shadowland Season 2",
  "Shadowland Season 3",
  "Shadowland Season 4",
  "Dragonflight Season 1",
  "Dragonflight Season 2",
  "Dragonflight Season 3",
  "Dragonflight Season 4",
  "War Within Season 1",
  "War Within Season 2",
  "War Within Season 3",
  "Midnight Season 1",
];

function parseNumber(value: any) {
  if (!value) return 0;

  const cleaned = value
    .toString()
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient as any });

    const totalRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Total'!A2:D500",
    });

    const totalRows = totalRes.data.values || [];

    const allPlayers = totalRows
      .map((row) => ({
        name: row[0]?.toString().trim(),
        discordId: row[1]?.toString().trim(),
        totalGold: parseNumber(row[2]),
        runs: parseNumber(row[3]),
      }))
      .filter((p) => p.name && p.totalGold > 0);

    const validPlayers = allPlayers.filter(
      (p) =>
        p.name &&
        p.name.toLowerCase() !== "unknown" &&
        p.discordId
    );

    let highestWeek = {
      name: "",
      season: "",
      week: "",
      amount: 0,
    };

    const highestWeekByPlayer: Record<string, any> = {};

    for (const season of SEASONS) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${season}'!A1:ZZ1000`,
      });

      const rows = res.data.values || [];
      if (!rows.length) continue;

      const headerIndex = rows.findIndex((row) =>
        row.some((cell: any) =>
          cell?.toString().toLowerCase().includes("week")
        )
      );

      if (headerIndex === -1) continue;

      const headers = rows[headerIndex];
      const playerRows = rows.slice(headerIndex + 1);

      headers.forEach((header: any, index: number) => {
        const h = header?.toString() || "";
        if (!h.toLowerCase().includes("week")) return;

        for (const row of playerRows) {
          const name = row[0]?.toString().trim();
          const amount = parseNumber(row[index]);

          if (name && amount > highestWeek.amount) {
            highestWeek = { name, season, week: h, amount };
          }

          if (
            name &&
            (!highestWeekByPlayer[name] ||
              amount > highestWeekByPlayer[name].amount)
          ) {
            highestWeekByPlayer[name] = {
              name,
              season,
              week: h,
              amount,
            };
          }
        }
      });
    }

    const leaderboard = validPlayers
      .slice()
      .sort((a, b) => b.totalGold - a.totalGold)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        highestWeek: highestWeekByPlayer[p.name] || null,
      }));

    const totalAllGold = allPlayers.reduce(
      (sum, p) => sum + p.totalGold,
      0
    );

    const topBooster = validPlayers
      .slice()
      .sort((a, b) => b.totalGold - a.totalGold)[0];

    const topRuns = validPlayers
      .slice()
      .sort((a, b) => b.runs - a.runs)[0];

    return NextResponse.json(
      {
        leaderboard,
        stats: {
          topBooster,
          topRuns,
          totalAllGold,
          highestWeek,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}