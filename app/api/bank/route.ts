import { NextResponse } from "next/server";
import { google } from "googleapis";

const MAIN_SPREADSHEET_ID = "1B8xawLZIGElNneqfOpUW6MZAURIb_F9n36NSZJL5sz8";
const MAIN_RANGE = "Sheet1!A3:AZ1000";

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

  const rows = res.data.values || [];
  const headers = rows[0] || [];
  const players = rows.slice(1);

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

      return {
        id: index,
        date: header,
        run: header,
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

  return NextResponse.json({
    balance: parseNumber(player[balanceIndex]),
    status: player[statusIndex] || "Unknown",
    payoutCharacter: player[payoutCharacterIndex] || "Not set",
    payoutType: player[payoutTypeIndex] || "Not set",
    cuts,
  });
}