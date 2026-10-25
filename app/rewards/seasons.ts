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
          subtitle: "Current season",
          status: "live",
          announcement:
            "The season is still running. Winners and rewards will be posted here when it ends.",
          rewards: [],
          hiddenRewards: [],
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
