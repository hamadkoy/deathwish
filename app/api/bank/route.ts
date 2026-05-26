import { NextResponse } from "next/server";
import { google } from "googleapis";
const TOTAL_SPREADSHEET_ID =
  "1rXKtKuuEJj8ORkQ_LclEJGc0v1ccbuguj5u8v46yeuU";
const MAIN_SPREADSHEET_ID = "1B8xawLZIGElNneqfOpUW6MZAURIb_F9n36NSZJL5sz8";
const MAIN_RANGE = "Sheet1!A3:AZ1000";

const HISTORY_SPREADSHEET_ID =
  "1FzmX_mZWl2Ho7TfRJDn-UYSo9rehTwuB6Au5Zu32Juc";

const HISTORY_RANGE = "Extern!A1:Z500";

function normalize(text: any) {
  return (text || "").toString().trim().toLowerCase();
}

function parseNumber(value: any) {
  if (!value) return 0;
  const cleaned = value.toString().replace(/,/g, "").trim();
  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : num;
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

const authClient = await auth.getClient();

const sheets = google.sheets({
  version: "v4",
  auth: authClient as any,
});

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: MAIN_SPREADSHEET_ID,
    range: MAIN_RANGE,
  });
const historyRes = await sheets.spreadsheets.values.get({
  spreadsheetId: HISTORY_SPREADSHEET_ID,
  range: HISTORY_RANGE,
});
const rows = res.data.values || [];
const historyRows = historyRes.data.values || [];
const typeHeaders = rows[0] || []; // 4/9M, 9/9HC
const headers = rows[1] || [];     // Thursday 15:00, Payout Character, Balance
const players = rows.slice(2);     // actual player rows
  const player = players.find((row) => row[0]?.toString().trim() === discordId);

  if (!player) {
    return NextResponse.json({
      balance: 0,
      status: "Not found",
      payoutCharacter: "Not set",
      payoutType: "Not set",
      cuts: [],
    });
  }

  const balanceIndex = headers.findIndex((h) =>
    normalize(h).includes("balance")
  );

  const statusIndex = headers.findIndex(
    (h) => normalize(h).includes("mailed") || normalize(h).includes("status")
  );

  const payoutCharacterIndex = headers.findIndex(
    (h) => normalize(h) === "payout character"
  );

  const payoutTypeIndex = headers.findIndex(
    (h) => normalize(h) === "payout type"
  );

  const ignored = new Set([
    0,
    balanceIndex,
    statusIndex,
    payoutCharacterIndex,
    payoutTypeIndex,
  ]);

const cuts = headers
  .map((header, index) => {
    const raw = player[index] || "";
    const amount = parseNumber(raw);

const runText = typeHeaders[index]?.toString() || "";
const dayText = headers[index]?.toString() || "";

    return {
      id: index,
      date: dayText,
      run: runText,
        character: player[payoutCharacterIndex] || "Not set",
        cut: amount,
        status:
          normalize(player[statusIndex]).includes("mailed") ||
          normalize(player[statusIndex]).includes("paid")
            ? "Paid"
            : "Pending",
        source: "Bot (!cuts)",
        note: "",
      };
    })
    .filter((cut) => !ignored.has(cut.id) && cut.cut > 0);
// HISTORY SHEET

const historyHeaders = historyRows.find((row) =>
  row.some((cell) => normalize(cell).includes("week 1"))
) || [];

const historyPlayer = historyRows.find(
  (row) => row[0]?.toString().trim() === discordId
);

const history: { week: string; amount: number }[] = [];

if (historyPlayer) {
  for (let i = 0; i < historyHeaders.length; i++) {
    const header = historyHeaders[i]?.toString().trim() || "";
    const amount = parseNumber(historyPlayer[i]);

    if (
      header.toLowerCase().startsWith("week") &&
      amount > 0
    ) {
      history.push({
        week: header,
        amount,
      });
    }
  }
}
// TOTAL BALANCE FROM ALL TABS
let combinedTotalBalance = 0;

const totalMeta = await sheets.spreadsheets.get({
  spreadsheetId: TOTAL_SPREADSHEET_ID,
});

const totalSheetNames =
  totalMeta.data.sheets
    ?.map((s) => s.properties?.title)
    .filter(Boolean) || [];

const allSheetsData = await Promise.all(
  totalSheetNames.map(async (sheetName) => {
    try {
      const totalRes = await sheets.spreadsheets.values.get({
        spreadsheetId: TOTAL_SPREADSHEET_ID,
        range: `'${sheetName}'!A1:AZ1000`,
      });

      return {
        name: sheetName,
        rows: totalRes.data.values || [],
      };
    } catch {
      return {
        name: sheetName,
        rows: [],
      };
    }
  })
);

for (const sheet of allSheetsData) {
  const totalRows = sheet.rows;

  const headerRow = totalRows.find((row) =>
    row.some((cell) => normalize(cell) === "total")
  );

  if (!headerRow) continue;

  const totalIndex = headerRow.findIndex(
    (h) => normalize(h) === "total"
  );

  const userRow = totalRows.find((row) =>
    row.some((cell) => cell?.toString().trim() === discordId)
  );

  if (!userRow) continue;

  combinedTotalBalance += parseNumber(userRow[totalIndex]);

}
  return NextResponse.json({
    balance: combinedTotalBalance,
    status: player[statusIndex] || "Unknown",
    payoutCharacter: player[payoutCharacterIndex] || "Not set",
    payoutType: player[payoutTypeIndex] || "Not set",
    cuts,
    history,
  });
}