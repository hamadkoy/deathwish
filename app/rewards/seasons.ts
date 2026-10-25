/* ============================================================
   REWARDS DATA — edit this file to add or change seasons.
   Put it at: app/rewards/seasons.ts

   - Newest season goes FIRST in the list.
   - gold / reward numbers are plain numbers (no commas).
   - images: drop the screenshots in /public/rewards/ and list
     them here; leave the list empty if you don't have any.
============================================================ */

export type Winner = {
  name: string;
  generated: number; // gold this booster generated during the season
  prizeItem?: string; // e.g. "Deluxe Edition of Metal Gear Solid"
  prizeGold?: number; // gold reward
  note?: string; // shown in small text under the name
  disqualified?: boolean;
};

export type Season = {
  id: string;
  title: string; // "War Within — Season 3"
  subtitle?: string;
  status: "live" | "ended";
  weeks?: number;
  totalGenerated?: number;
  announcement?: string; // short line at the top of the season
  bonusNote?: string; // e.g. off-week bonus
  rewards: Winner[];
  hiddenRequirement?: string;
  hiddenRewards: Winner[];
  closingLine?: string;
  images?: { src: string; caption: string }[];
};

export const SEASONS: Season[] = [
  {
    id: "tww-s3",
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
    images: [
      // Save the two Discord screenshots into public/rewards/ with these names
      // (or change the names here). Missing images are simply hidden.
      { src: "/rewards/tww-s3-payment-history.png", caption: "Season 3 Payment History" },
      { src: "/rewards/tww-s3-rewards.png", caption: "War-Within Season 3 Rewards" },
    ],
  },
];
