import { NextResponse } from "next/server";
import { google } from "googleapis";

const SPREADSHEET_ID = "1rXKtKuuEJj8ORkQ_LclEJGc0v1ccbuguj5u8v46yeuU";

function normalize(v: any) {
  return (v || "").toString().trim().toLowerCase();
}

function parseNumber(v: any) {
  if (!v) return 0;
  const cleaned = v.toString().replace(/,/g, "").replace(/g/gi, "").trim();
  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function isSeasonTab(name: string) {
  const n = normalize(name);

  if (n === "total") return false;
  if (n.includes("template")) return false;
  if (n.includes("sheet")) return false;

  return n.includes("season");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const discordId = searchParams.get("discordId");

  if (!discordId) {
    return NextResponse.json({ error: "Missing discordId" }, { status: 400 });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({
    version: "v4",
    auth: (await auth.getClient()) as any,
  });

  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const tabs =
    meta.data.sheets
      ?.map((s) => s.properties?.title || "")
      .filter((name) => name && isSeasonTab(name)) || [];

  const seasons: any[] = [];

  for (const tab of tabs) {
    try {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${tab}'!A1:AZ1000`,
      });

      const rows = res.data.values || [];

      const headerRowIndex = rows.findIndex((row) => {
        const text = row.map(normalize);
        return (
          text.includes("player") &&
          text.includes("user id") &&
          text.includes("total")
        );
      });

      if (headerRowIndex === -1) {
        seasons.push({ name: tab, total: 0, runs: 0, rows: [] });
        continue;
      }

      const headers = rows[headerRowIndex];

      const userIdIndex = headers.findIndex((h) => normalize(h) === "user id");
      const playerIndex = headers.findIndex((h) => normalize(h) === "player");
      const totalIndex = headers.findIndex((h) => normalize(h) === "total");
      const runsIndex = headers.findIndex((h) => normalize(h) === "runs");

      const playerRow = rows
        .slice(headerRowIndex + 1)
        .find((row) => row[userIdIndex]?.toString().trim() === discordId);

      if (!playerRow) {
        seasons.push({ name: tab, total: 0, runs: 0, rows: [] });
        continue;
      }

      const total = parseNumber(playerRow[totalIndex]);
      const runs = parseNumber(playerRow[runsIndex]);

      const weekRows: any[] = [];

      headers.forEach((header, index) => {
        const h = normalize(header);

        if (!h.startsWith("week")) return;

        const amount = parseNumber(playerRow[index]);

        if (amount > 0) {
          weekRows.push({
            week: header,
            type: "MYTHIC",
            character: playerRow[playerIndex] || "Unknown",
            cut: amount,
            status: "Paid",
            source: "Google Sheet",
            notes: "-",
          });
        }
      });

      const rowsForTable =
        weekRows.length > 0
          ? weekRows
          : total > 0
          ? [
              {
                week: "Season Total",
                type: "ALL RUNS",
                character: playerRow[playerIndex] || "Unknown",
                cut: total,
                status: "Paid",
                source: "Google Sheet",
                notes: `${runs.toLocaleString()} runs`,
              },
            ]
          : [];

const isBreak = normalize(tab) === "dragonflight season 1";

seasons.push({
  name: tab,
  total: isBreak ? 0 : total,
  runs: isBreak ? 0 : runs,
  isBreak,
  rows: isBreak
    ? [
        {
          type: "BREAK",
          character: "-",
          cut: 0,
          status: "Paid",
          source: "Season Break",
          runs: 0,
        },
      ]
    : rowsForTable.map((r) => ({
        ...r,
        runs,
      })),
});
    } catch {
      seasons.push({ name: tab, total: 0, runs: 0, rows: [] });
    }
  }

const countedSeasons = seasons.filter((s) => !s.isBreak);

const totalGoldMade = countedSeasons.reduce((sum, s) => sum + s.total, 0);
const numberOfRuns = countedSeasons.reduce((sum, s) => sum + s.runs, 0);

  const highestSeasonGain = seasons.reduce(
    (best, s) => (s.total > best.total ? s : best),
    { name: "-", total: 0 }
  );

  const highestWeekGain = seasons
    .flatMap((s) => s.rows.map((r: any) => ({ ...r, season: s.name })))
    .reduce((best, r) => (r.cut > best.cut ? r : best), {
      week: "-",
      season: "-",
      cut: 0,
    });

  return NextResponse.json({
    totalGoldMade,
    highestSeasonGain,
    highestWeekGain,
    numberOfRuns,
    seasons,
  });
}