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

// Built once per server instance instead of on every request.
let sheetsClient: any = null;

async function getSheets() {
  if (sheetsClient) return sheetsClient;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  sheetsClient = google.sheets({
    version: "v4",
    auth: (await auth.getClient()) as any,
  });

  return sheetsClient;
}

export async function GET() {
  try {
    const sheets = await getSheets();

    // One batchGet for Total + all season tabs, instead of 13 sequential
    // requests. Results come back in the same order as `ranges`, so the
    // leaderboard logic below behaves exactly as before.
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [
        "'Total'!A2:D500",
        ...SEASONS.map((season) => `'${season}'!A1:ZZ1000`),
      ],
    });

    const valueRanges = res.data.valueRanges || [];

    const totalRows: any[][] = valueRanges[0]?.values || [];

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

    for (let s = 0; s < SEASONS.length; s++) {
      const season = SEASONS[s];
      const rows: any[][] = valueRanges[s + 1]?.values || [];
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
          // Same data for everyone. Browser reuses it for 60s (no request
          // at all), Vercel's CDN serves it for 5 min without running the
          // function, and refreshes in the background after that.
          "Cache-Control":
            "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}