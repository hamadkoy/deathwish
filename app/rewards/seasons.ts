/* ============================================================
   REWARDS DATA — edit this file to add or change seasons.
   Put it at: app/rewards/seasons.ts

   - Expansions are listed newest → oldest (current expansion first).
   - A season with `lost: true` shows as "Lost Data".
   - To fill in a season, remove `lost: true` and add `data`.
   - gold / reward numbers are plain numbers (no commas).
============================================================ */

export type Winner = {
  name: string;
  generated: number; // gold this booster generated during the season
  runs?: number; // runs boosted this season (shown next to the gold)
  prizeItem?: string; // e.g. "Deluxe Edition of Metal Gear Solid"
  prizeGold?: number; // gold reward
  note?: string; // shown in small text under the name
  disqualified?: boolean;
};

/** "Reach X gold this season → get Y" */
export type RewardTier = {
  threshold: number;
  prizeGold: number;
  prizeItem?: string;
};

export type Season = {
  title: string; // "The War Within — Season 3"
  subtitle?: string;
  status: "live" | "ended";
  weeks?: number;
  totalGenerated?: number;
  announcement?: string; // short line at the top of the season
  bonusNote?: string; // e.g. off-week bonus
  tiers?: RewardTier[]; // the reward ladder announced for the season
  tiersNote?: string;
  rules?: string[];
  rewards: Winner[];
  hiddenRequirement?: string;
  hiddenRewards: Winner[];
  closingLine?: string;
};

export type SeasonEntry = {
  id: string;
  label: string; // "Season 3"
  lost?: boolean; // records lost
  data?: Season;
};

export type Expansion = {
  id: string;
  name: string;
  years: string;
  icon: string;
  accent: string; // main colour
  accentRgb: string; // same colour as "r,g,b" for glows
  current?: boolean; // shows the "Current expansion" tag
  seasons: SeasonEntry[];
};

export const EXPANSIONS: Expansion[] = [
  {
    id: "midnight",
    name: "Midnight",
    current: true,
    years: "2026 –",
    icon: "🌙",
    accent: "#a855f7",
    accentRgb: "168,85,247",
    seasons: [
      { id: "mn-s1", label: "Season 1", lost: true },
      {
        id: "mn-s2",
        label: "Season 2",
        data: {
          title: "Midnight — Season 2",
          subtitle: "Hall of Fame",
          status: "ended",
          weeks: 10,
          totalGenerated: 366850246,
          bonusNote:
            "5,000g for every run to everyone who boosted 20+ runs this season. 22 boosters, 1,337 runs, 6,685,000g paid out.",
          rules: ["Minimum 20 runs to qualify.", "Reward is 5,000g per run."],
          rewards: [
            { name: "Jdawes", runs: 110, generated: 24162765, prizeGold: 550000 },
            { name: "Okashira", runs: 108, generated: 23731501, prizeGold: 540000 },
            { name: "Linkinlight", runs: 105, generated: 23052991, prizeGold: 525000 },
            { name: "Pyromonia", runs: 99, generated: 21862001, prizeGold: 495000 },
            { name: "Neorin", runs: 98, generated: 21486000, prizeGold: 490000 },
            { name: "Taykuma", runs: 96, generated: 21196001, prizeGold: 480000 },
            { name: "Munchmilow", runs: 87, generated: 19146007, prizeGold: 435000 },
            { name: "Cannibank", runs: 71, generated: 15530000, prizeGold: 355000 },
            { name: "Viciholy", runs: 63, generated: 13912000, prizeGold: 315000 },
            { name: "Heyaas", runs: 63, generated: 13859000, prizeGold: 315000 },
            { name: "Eminencé", runs: 57, generated: 12466000, prizeGold: 285000 },
            { name: "Athangur", runs: 54, generated: 11934997, prizeGold: 270000 },
            { name: "Goldtheone", runs: 45, generated: 9857000, prizeGold: 225000 },
            { name: "Merçedesax", runs: 43, generated: 9503000, prizeGold: 215000 },
            { name: "Kebabtimez", runs: 42, generated: 9291000, prizeGold: 210000 },
            { name: "Barburka", runs: 39, generated: 8558000, prizeGold: 195000 },
            { name: "Yóruichí", runs: 34, generated: 7535000, prizeGold: 170000 },
            { name: "Drkcookie", runs: 33, generated: 7253000, prizeGold: 165000 },
            { name: "Gigachadge", runs: 27, generated: 5987000, prizeGold: 135000 },
            { name: "Adriân", runs: 23, generated: 5169983, prizeGold: 115000 },
            { name: "Cheesedance", runs: 20, generated: 4398000, prizeGold: 100000 },
            { name: "Kigor", runs: 20, generated: 4360000, prizeGold: 100000 },
          ],
          hiddenRewards: [],
          closingLine: "Good job to all.",
        },
      },
    ],
  },
  {
    id: "the-war-within",
    name: "The War Within",
    years: "2024 – 2026",
    icon: "⚒️",
    accent: "#facc15",
    accentRgb: "250,204,21",
    seasons: [
      { id: "tww-s1", label: "Season 1", lost: true },
      { id: "tww-s2", label: "Season 2", lost: true },
      {
        id: "tww-s3",
        label: "Season 3",
        data: {
          title: "The War Within — Season 3",
          subtitle: "Hall of Fame",
          status: "ended",
          weeks: 16,
          totalGenerated: 1716487953,
          bonusNote:
            "3,000,000g added to everyone for the off week (week 7). If you still fell short, that's on you.",
          rewards: [
            {
              name: "Jdawee",
              generated: 62054500,
              prizeItem: "Deluxe Edition of Metal Gear Solid",
              prizeGold: 6000000,
              note: "Smoke performance",
            },
            {
              name: "NeoriN",
              generated: 59205500,
              prizeItem: "Metal Gear Solid",
              prizeGold: 3500000,
              note: "Great performance",
            },
            {
              name: "Merlin_Okashira",
              generated: 57671500,
              prizeItem: "Metal Gear Solid",
              prizeGold: 3500000,
              note: "Smoke performance",
            },
            {
              name: "Sylvanas",
              generated: 47924500,
              note: "Disqualified for giving me headaches",
              disqualified: true,
            },
          ],
          hiddenRequirement:
            "Boosted at least 4 runs across the 16 weeks and generated 30,000,000g or more.",
          hiddenRewards: [
            { name: "Deathkayro", generated: 46130000, prizeGold: 2000000 },
            { name: "Mercedesa", generated: 36831500, prizeGold: 1000000 },
            { name: "Metalic", generated: 34306500, prizeGold: 1000000 },
          ],
          closingLine: "Good job to all.",
        },
      },
    ],
  },
  {
    id: "dragonflight",
    name: "Dragonflight",
    years: "2022 – 2024",
    icon: "🐉",
    accent: "#f97316",
    accentRgb: "249,115,22",
    seasons: [
      { id: "df-s1", label: "Season 1", lost: true },
      { id: "df-s2", label: "Season 2", lost: true },
      { id: "df-s3", label: "Season 3", lost: true },
      { id: "df-s4", label: "Season 4", lost: true },
    ],
  },
  {
    id: "shadowlands",
    name: "Shadowlands",
    years: "2020 – 2022",
    icon: "💀",
    accent: "#94a3b8",
    accentRgb: "148,163,184",
    seasons: [
      { id: "sl-s1", label: "Season 1", lost: true },
      { id: "sl-s2", label: "Season 2", lost: true },
      { id: "sl-s3", label: "Season 3", lost: true },
      { id: "sl-s4", label: "Season 4", lost: true },
    ],
  },
];
