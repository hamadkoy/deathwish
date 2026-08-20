import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

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

// Handles plain numbers, comma separators, and k / m suffixes.
// "800,000" -> 800000   "3000k" -> 3000000   "1.5m" -> 1500000
function parseNumber(value: any) {
  if (!value) return 0;

  const cleaned = value
    .toString()
    .replace(/,/g, "")
    .replace(/g\b/gi, "")
    .trim()
    .toLowerCase();

  if (!cleaned) return 0;

  const match = cleaned.match(/^(-?\d*\.?\d+)\s*([km])?$/);

  if (!match) return 0;

  const base = Number(match[1]);

  if (Number.isNaN(base)) return 0;

  if (match[2] === "k") return base * 1_000;
  if (match[2] === "m") return base * 1_000_000;

  return base;
}

// A player row is any row whose first cell looks like a Discord ID.
function isPlayerRow(row: any[]) {
  return /^\d{5,}$/.test((row?.[0] || "").toString().trim());
}

// The communities we track. Matched by name, not by row position,
// so inserting or moving rows in the sheet doesn't break anything.
const COMMUNITIES = ["dawn", "oblivion", "sylvanas"];

function displayName(key: string) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// Returns the community key for a row, or null. Looks at the first few
// columns and ignores the word "pot" so "DAWN" and "Dawn Pot" both match.
function getCommunityKey(row: any[]) {
  if (isPlayerRow(row)) return null;

  for (let i = 0; i < 4; i++) {
    const text = normalize(row?.[i]).replace(/\bpot\b/g, "").trim();
    if (!text) continue;

    const hit = COMMUNITIES.find((c) => text === c);
    if (hit) return hit;
  }

  return null;
}

// Roles come from Supabase (profiles.site_role), same as the admin page.
// Lower number = higher rank.
const ROLE_ORDER: Record<string, number> = {
  Dreadlord: 0,
  Nightblade: 1,
  Soulreaper: 2,
  Reaper: 3,
  Wandering_soul: 4,
  Lost_soul: 5,
};

const MIN_ROLE_TO_SEE_CUTS = ROLE_ORDER["Soulreaper"];

function normalizeRole(role?: string | null) {
  if (role === "Dreadlord" || role === "admin" || role === "Deathlord")
    return "Dreadlord";
  if (role === "Nightblade" || role === "officer" || role === "Deathbringer")
    return "Nightblade";
  if (role === "Soulreaper") return "Soulreaper";
  if (role === "Reaper" || role === "Booster" || role === "booster")
    return "Reaper";
  if (role === "Wandering_soul" || role === "Wandering Soul")
    return "Wandering_soul";
  return "Lost_soul";
}

// Verifies the caller's Supabase token, then reads their role.
// Done server-side so a spoofed header can't unlock other people's cuts.
async function getViewerRole(req: Request) {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();

  if (!token) return { role: "Lost_soul", canSeeAllCuts: false };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) return { role: "Lost_soul", canSeeAllCuts: false };

    const { data } = await supabase
      .from("profiles")
      .select("site_role")
      .eq("user_id", user.id)
      .single();

    const role = normalizeRole(data?.site_role);

    return {
      role,
      canSeeAllCuts: ROLE_ORDER[role] <= MIN_ROLE_TO_SEE_CUTS,
    };
  } catch {
    return { role: "Lost_soul", canSeeAllCuts: false };
  }
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
  const headers = rows[1] || []; // Thursday 15:00, Payout Character, Balance
  const dataRows = rows.slice(2); // players + pot rows + note rows

  const playerRows = dataRows.filter(isPlayerRow);

  const potRows = dataRows
    .map((row) => ({ key: getCommunityKey(row), row }))
    .filter((entry) => entry.key !== null) as {
    key: string;
    row: any[];
  }[];

  if (process.env.NODE_ENV !== "production") {
    console.log("[bank] player rows:", playerRows.length);
    console.log(
      "[bank] pot rows:",
      potRows.map((p) => p.key)
    );
  }

  const player = playerRows.find(
    (row) => row[0]?.toString().trim() === discordId
  );

  const hasWeeklyPlayer = !!player;

  const viewer = await getViewerRole(req);
  const canSeeAllCuts = viewer.canSeeAllCuts;

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

  const cuts = hasWeeklyPlayer
    ? headers
        .map((header, index) => {
          const raw = player?.[index] || "";
          const amount = parseNumber(raw);

          const runText = typeHeaders[index]?.toString() || "";
          const dayText = headers[index]?.toString() || "";

          // Everyone with a cut in this column was in the run.
          const boosterRows = playerRows.filter(
            (row) => parseNumber(row[index]) > 0
          );

          const boosters = boosterRows.length;

          const pot = boosterRows.reduce(
            (sum, row) => sum + parseNumber(row[index]),
            0
          );

          // Per-community pots for this run column.
          const pots = potRows
            .map((entry) => ({
              name: displayName(entry.key),
              amount: parseNumber(entry.row[index]),
            }))
            .filter((p) => p.amount > 0);

          const potTotal = pots.reduce((sum, p) => sum + p.amount, 0);

          // Everyone in this run. Amounts are stripped unless the viewer
          // is Soulreaper or above.
          const roster = boosterRows
            .map((row) => {
              const name =
                (row[1] || "").toString().trim() ||
                (row[0] || "").toString().trim() ||
                "Unknown";

              const isSelf = row[0]?.toString().trim() === discordId;

              return {
                name,
                isSelf,
                hidden: !canSeeAllCuts && !isSelf,
                cut:
                  canSeeAllCuts || isSelf ? parseNumber(row[index]) : null,
              };
            })
            .sort((a, b) => (b.cut || 0) - (a.cut || 0));

          return {
            id: index,
            date: dayText,
            run: runText,
            character: player?.[payoutCharacterIndex] || "Not set",
            cut: amount,
            status:
              normalize(player?.[statusIndex]).includes("mailed") ||
              normalize(player?.[statusIndex]).includes("paid")
                ? "Paid"
                : "Pending",
            source: "Bot (!cuts)",
            note: "",
            boosters,
            pot,
            pots,
            potTotal,
            roster,
          };
        })
        .filter((cut) => !ignored.has(cut.id) && cut.cut > 0)
    : [];

  // HISTORY SHEET

  const historyHeaders =
    historyRows.find((row) =>
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

      if (header.toLowerCase().startsWith("week") && amount > 0) {
        history.push({
          week: header,
          amount,
        });
      }
    }
  }

  // FAST TOTAL BALANCE FROM TOTAL TAB
  let combinedTotalBalance = 0;

  const totalRes = await sheets.spreadsheets.values.get({
    spreadsheetId: TOTAL_SPREADSHEET_ID,
    range: "'Total'!A1:C1000",
  });

  const totalRows = totalRes.data.values || [];
  const totalHeaders = totalRows[0] || [];

  const userIdIndex = totalHeaders.findIndex((h) => normalize(h) === "user id");

  const totalIndex = totalHeaders.findIndex((h) => normalize(h) === "total");

  if (userIdIndex !== -1 && totalIndex !== -1) {
    const totalUserRow = totalRows.find(
      (row) => row[userIdIndex]?.toString().trim() === discordId
    );

    if (totalUserRow) {
      combinedTotalBalance = parseNumber(totalUserRow[totalIndex]);
    }
  }

  return NextResponse.json({
    rank: viewer.role.replace("_", " "),
    canSeeAllCuts,
    minRankToSeeCuts: "Soulreaper",
    balance: combinedTotalBalance,
    status: player?.[statusIndex] || "Unknown",
    payoutCharacter: player?.[payoutCharacterIndex] || "Not set",
    payoutType: player?.[payoutTypeIndex] || "Not set",
    cuts,
    history,
  });
}
