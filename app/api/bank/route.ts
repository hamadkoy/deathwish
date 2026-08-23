import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

// Midnight Season 1, Midnight Season 2 and Total are all tabs inside
// this one spreadsheet, so they're read together in a single batchGet.
const TOTAL_SPREADSHEET_ID = "1rXKtKuuEJj8ORkQ_LclEJGc0v1ccbuguj5u8v46yeuU";

const SEASON_1_RANGE = "'Midnight Season 1'!A1:AZ200";
const SEASON_2_RANGE = "'Midnight Season 2'!A1:AZ200";
const TOTAL_RANGE = "'Total'!A1:D1000";

const MAIN_SPREADSHEET_ID = "1B8xawLZIGElNneqfOpUW6MZAURIb_F9n36NSZJL5sz8";
// Starts at row 2 so the "No.Clients" row is included.
const MAIN_RANGE = "Sheet1!A2:AZ1000";

function normalize(text: any) {
  return (text || "").toString().trim().toLowerCase();
}

// Handles plain numbers, comma separators, and k / m suffixes.
// "800,000" -> 800000   "3000k" -> 3000000   "1.5m" -> 1500000
// Repeated suffixes are tolerated so a typo like "255kk" still reads
// as 255,000 instead of silently returning 0.
function parseNumber(value: any) {
  if (!value) return 0;

  const cleaned = value
    .toString()
    .replace(/,/g, "")
    .replace(/g\b/gi, "")
    .trim()
    .toLowerCase();

  if (!cleaned) return 0;

  const match = cleaned.match(/^(-?\d*\.?\d+)\s*(k+|m+)?$/);

  if (!match) return 0;

  const base = Number(match[1]);

  if (Number.isNaN(base)) return 0;

  const suffix = match[2]?.[0];

  if (suffix === "k") return base * 1_000;
  if (suffix === "m") return base * 1_000_000;

  return base;
}

// Sheet values are identical for every user, so cache briefly.
const CACHE_TTL_MS = 60_000;
const sheetCache = new Map<string, { at: number; values: any }>();

function fromCache(key: string) {
  const hit = sheetCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.values;
  return null;
}

function toCache(key: string, values: any) {
  sheetCache.set(key, { at: Date.now(), values });
  return values;
}

async function getValues(
  sheets: any,
  spreadsheetId: string,
  range: string
): Promise<any[][]> {
  const key = `${spreadsheetId}::${range}`;
  const hit = fromCache(key);
  if (hit) return hit;

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });

  return toCache(key, res.data.values || []);
}

// One request for many ranges in the same spreadsheet.
async function batchGet(
  sheets: any,
  spreadsheetId: string,
  ranges: string[]
): Promise<any[][][]> {
  const key = `${spreadsheetId}::batch::${ranges.join("|")}`;
  const hit = fromCache(key);
  if (hit) return hit;

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });

  const out = (res.data.valueRanges || []).map((r: any) => r.values || []);

  return toCache(key, out);
}

// Background colours for the same range. values.get only returns text,
// so formatting needs a separate grid-data request (fields-filtered so
// we only pay for the colours, not the whole grid).
async function getColors(
  sheets: any,
  spreadsheetId: string,
  range: string
): Promise<any[][]> {
  const key = `${spreadsheetId}::colors::${range}`;
  const hit = fromCache(key);
  if (hit) return hit;

  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [range],
      includeGridData: true,
      fields:
        "sheets(data(rowData(values(effectiveFormat(backgroundColor)))))",
    });

    const rowData = res.data.sheets?.[0]?.data?.[0]?.rowData || [];

    const grid = rowData.map((r: any) =>
      (r.values || []).map(
        (c: any) => c?.effectiveFormat?.backgroundColor || null
      )
    );

    return toCache(key, grid);
  } catch {
    return toCache(key, []);
  }
}

type Mark = "helper" | "strike" | "reward" | null;

// Green cut = helper, red cut = strike, blue cut = reward.
// Thresholds are wide enough to ignore the sheet's tan default fill,
// which is reddish but muted.
function markFromColor(color: any): Mark {
  if (!color) return null;

  const r = color.red ?? 0;
  const g = color.green ?? 0;
  const b = color.blue ?? 0;

  if (b > 0.45 && b - r > 0.2 && b - g > 0.15) return "reward";
  if (g > 0.55 && g - r > 0.2 && g - b > 0.2) return "helper";
  if (r > 0.55 && r - g > 0.3 && r - b > 0.3) return "strike";

  return null;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Bonus = how far this cut sits from the run's base cut.
// Helpers are paid a flat amount, so they show that instead of a delta.
function buildBonus(amount: number, baseCut: number, mark: Mark) {
  if (!amount) return null;

  if (mark === "helper") {
    return {
      type: "helper",
      amount,
      label: `Helper ${amount.toLocaleString()}g`,
    };
  }

  // No Base Cut cell for this run — show the flag without a number
  // rather than inventing a delta.
  if (!baseCut) {
    return mark ? { type: mark, amount: 0, label: capitalize(mark) } : null;
  }

  const delta = amount - baseCut;

  const type: Mark = mark || (delta > 0 ? "reward" : delta < 0 ? "strike" : null);

  if (!type) return null;

  const label =
    delta === 0
      ? capitalize(type)
      : `${capitalize(type)} ${delta > 0 ? "+" : "-"}${Math.abs(
          delta
        ).toLocaleString()}g`;

  return { type, amount: delta, label };
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

// The Pug row holds cuts for helpers from outside the guild who have no
// Discord ID. Its value is the combined cut, so dividing by the standard
// per-booster cut gives how many pugs were in the run.
function isPugRow(row: any[]) {
  if (isPlayerRow(row)) return false;

  for (let i = 0; i < 4; i++) {
    if (normalize(row?.[i]) === "pug") return true;
  }

  return false;
}

// The "Base Cut" row holds the baseline every cut is measured against,
// column-aligned with the run columns just like the player rows.
function isBaseCutRow(row: any[]) {
  if (isPlayerRow(row)) return false;

  for (let i = 0; i < 4; i++) {
    if (normalize(row?.[i]) === "base cut") return true;
  }

  return false;
}

// The cut a single booster received in this column — the most common
// non-zero amount, which is what nearly everyone gets.
function standardCut(amounts: number[]) {
  if (!amounts.length) return 0;

  const counts = new Map<number, number>();

  for (const a of amounts) counts.set(a, (counts.get(a) || 0) + 1);

  let best = amounts[0];
  let bestCount = 0;

  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value > best)) {
      best = value;
      bestCount = count;
    }
  }

  return best;
}

// Reads one season tab (Player / User ID / Total / Week N columns)
// and pulls out this player's weekly amounts.
function readSeasonTab(rows: any[][], discordId: string) {
  const headerRowIndex = rows.findIndex((row: any[]) => {
    const text = row.map(normalize);
    return (
      text.includes("player") &&
      text.includes("user id") &&
      text.includes("total")
    );
  });

  if (headerRowIndex === -1) return { total: 0, runs: 0, weeks: [] as any[] };

  const headers = rows[headerRowIndex];

  const userIdIndex = headers.findIndex((h: any) => normalize(h) === "user id");
  const playerIndex = headers.findIndex((h: any) => normalize(h) === "player");
  const totalIndex = headers.findIndex((h: any) => normalize(h) === "total");
  const runsIndex = headers.findIndex((h: any) => normalize(h) === "runs");

  const playerRow = rows
    .slice(headerRowIndex + 1)
    .find((row: any[]) => row[userIdIndex]?.toString().trim() === discordId);

  if (!playerRow) return { total: 0, runs: 0, weeks: [] as any[] };

  const weeks: any[] = [];

  headers.forEach((header: any, index: number) => {
    if (!normalize(header).startsWith("week")) return;

    const amount = parseNumber(playerRow[index]);

    if (amount > 0) {
      weeks.push({
        week: header,
        amount,
        character: playerRow[playerIndex] || "Unknown",
      });
    }
  });

  return {
    total: parseNumber(playerRow[totalIndex]),
    runs: parseNumber(playerRow[runsIndex]),
    weeks,
  };
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

// The Google client is expensive to build, so it's created once and
// reused across requests instead of on every page load.
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const discordId = searchParams.get("discordId");

  if (!discordId) {
    return NextResponse.json({ error: "Missing discordId" }, { status: 400 });
  }

  const sheets = await getSheets();

  // Two network calls total: the weekly sheet, and one batch covering
  // both season tabs plus Total. Both run at the same time.
  const [rows, colors, seasonBatch, viewer] = await Promise.all([
    getValues(sheets, MAIN_SPREADSHEET_ID, MAIN_RANGE),
    getColors(sheets, MAIN_SPREADSHEET_ID, MAIN_RANGE),
    batchGet(sheets, TOTAL_SPREADSHEET_ID, [
      SEASON_1_RANGE,
      SEASON_2_RANGE,
      TOTAL_RANGE,
    ]),
    getViewerRole(req),
  ]);

  const season1Rows = seasonBatch[0] || [];
  const season2Rows = seasonBatch[1] || [];
  const totalRows = seasonBatch[2] || [];

  const canSeeAllCuts = viewer.canSeeAllCuts;

  const clientHeaders = rows[0] || []; // No.Clients: 4, 3, 3 ...
  const typeHeaders = rows[1] || []; // Type of Boost: Normal, HC ...
  const headers = rows[2] || []; // Thursday 15:00, Payout Character, Balance
  const dataRows = rows.slice(3); // players + pot rows

  // Absolute index kept so the colour grid can be looked up per cell.
  const playerEntries = dataRows
    .map((row, i) => ({ row, r: i + 3 }))
    .filter((e) => isPlayerRow(e.row));

  const playerRows = playerEntries.map((e) => e.row);

  const pugRow = dataRows.find(isPugRow);

  // Baseline per run column. Everything in the Bonus column is measured
  // against this row.
  const baseCutRow = dataRows.find(isBaseCutRow);

  const potRows = dataRows
    .map((row) => ({ key: getCommunityKey(row), row }))
    .filter((entry) => entry.key !== null) as {
    key: string;
    row: any[];
  }[];

  const player = playerRows.find(
    (row) => row[0]?.toString().trim() === discordId
  );

  const hasWeeklyPlayer = !!player;

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
          const clients = parseNumber(clientHeaders[index]);
          const dayText = headers[index]?.toString() || "";

          // The Base Cut cell sitting in this same run column.
          const baseCut = baseCutRow ? parseNumber(baseCutRow[index]) : 0;

          // Everyone with a cut in this column was in the run.
          const boosterEntries = playerEntries.filter(
            (e) => parseNumber(e.row[index]) > 0
          );

          const boosterRows = boosterEntries.map((e) => e.row);

          const amounts = boosterRows.map((row) => parseNumber(row[index]));

          // Unregistered helpers, tracked as a single combined figure.
          const pugAmount = pugRow ? parseNumber(pugRow[index]) : 0;
          const perBooster = standardCut(amounts);

          const pugCount =
            pugAmount > 0
              ? perBooster > 0
                ? Math.max(1, Math.round(pugAmount / perBooster))
                : 1
              : 0;

          const boosters = boosterRows.length + pugCount;

          const pot =
            amounts.reduce((sum, a) => sum + a, 0) + pugAmount;

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
          const roster: {
            name: string;
            discordId: string;
            isSelf: boolean;
            isPug: boolean;
            mark: Mark;
            bonus: ReturnType<typeof buildBonus>;
            hidden: boolean;
            cut: number | null;
          }[] = boosterEntries
            .map(({ row, r }) => {
              const name =
                (row[1] || "").toString().trim() ||
                (row[0] || "").toString().trim() ||
                "Unknown";

              const isSelf = row[0]?.toString().trim() === discordId;

              const mark = markFromColor(colors?.[r]?.[index]);
              const rowCut = parseNumber(row[index]);

              const visible = canSeeAllCuts || isSelf;

              return {
                name,
                discordId: (row[0] || "").toString().trim(),
                isSelf,
                isPug: false,
                mark,
                bonus: visible ? buildBonus(rowCut, baseCut, mark) : null,
                hidden: !visible,
                cut: visible ? rowCut : null,
              };
            })
            .sort((a, b) => (b.cut || 0) - (a.cut || 0));

          // One card per pug, each showing an equal share of the row.
          for (let i = 0; i < pugCount; i++) {
            roster.push({
              name: pugCount > 1 ? `Pug ${i + 1}` : "Pug",
              discordId: "",
              isSelf: false,
              isPug: true,
              mark: null,
              bonus: null,
              hidden: !canSeeAllCuts,
              cut: canSeeAllCuts ? Math.round(pugAmount / pugCount) : null,
            });
          }

          const selfMark = roster.find((x) => x.isSelf)?.mark ?? null;

          return {
            id: index,
            date: dayText,
            run: runText,
            character: player?.[payoutCharacterIndex] || "Not set",
            cut: amount,
            baseCut,
            bonus: buildBonus(amount, baseCut, selfMark),
            status:
              normalize(player?.[statusIndex]).includes("mailed") ||
              normalize(player?.[statusIndex]).includes("paid")
                ? "Paid"
                : "Pending",
            source: "Bot (!cuts)",
            note: "",
            boosters,
            clients,
            helpers: roster.filter((x) => x.mark === "helper").length,
            strikes: roster.filter((x) => x.mark === "strike").length,
            rewards: roster.filter((x) => x.mark === "reward").length,
            pot,
            pots,
            potTotal,
            roster,
          };
        })
        .filter((cut) => !ignored.has(cut.id) && cut.cut > 0)
    : [];

  // SEASON 1 — read straight from its tab in the same spreadsheet.
  const season1 = readSeasonTab(season1Rows, discordId);

  const history = season1.weeks.map((w) => ({
    week: w.week,
    amount: w.amount,
  }));

  // SEASON 2 — same shape the page already renders.
  const season2 = readSeasonTab(season2Rows, discordId);

  const seasons = [
    {
      name: "Midnight Season 2",
      total: season2.total,
      runs: season2.runs,
      isBreak: false,
      rows: season2.weeks.map((w) => ({
        week: w.week,
        type: "MYTHIC",
        character: w.character,
        cut: w.amount,
        status: "Paid",
        runs: season2.runs,
      })),
    },
  ];

  // TOTAL BALANCE
  let combinedTotalBalance = 0;

  const totalHeaders = totalRows[0] || [];

  const userIdIndex = totalHeaders.findIndex(
    (h: any) => normalize(h) === "user id"
  );

  const totalIndex = totalHeaders.findIndex(
    (h: any) => normalize(h) === "total"
  );

  if (userIdIndex !== -1 && totalIndex !== -1) {
    const totalUserRow = totalRows.find(
      (row: any[]) => row[userIdIndex]?.toString().trim() === discordId
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
    seasons,
  });
}