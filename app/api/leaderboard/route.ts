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
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(
          /\\n/g,
          "\n"
        ),
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
      ],
    });

    const authClient = await auth.getClient();

    const sheets = google.sheets({
      version: "v4",
      auth: authClient as any,
    });

    const playerMap = new Map();

    for (const season of SEASONS) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${season}'!A1:ZZ1000`,
      });

      const rows = res.data.values || [];

      if (rows.length < 3) continue;

      const headers = rows[1] || [];

      const totalIndex = headers.findIndex((h: any) =>
        h?.toString().toLowerCase().includes("total")
      );

      if (totalIndex === -1) continue;

      const players = rows.slice(2);

      for (const row of players) {
        const name = row[0]?.toString().trim();
        const discordId = row[1]?.toString().trim();

        if (!name || !discordId) continue;

        const totalGold = parseNumber(row[totalIndex]);

        if (totalGold <= 0) continue;

        if (!playerMap.has(discordId)) {
          playerMap.set(discordId, {
            name,
            discordId,
            totalGold: 0,
          });
        }

        const player = playerMap.get(discordId);

        player.totalGold += totalGold;
      }
    }

    const leaderboard = Array.from(
      playerMap.values()
    )
      .sort(
        (a: any, b: any) =>
          b.totalGold - a.totalGold
      )
      .slice(0, 10);

    return NextResponse.json(leaderboard);
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
    });
  }
}