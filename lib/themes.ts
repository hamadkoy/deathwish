type Theme = {
  name?: string;
  video?: string;
  image?: string;
  primary: string;
  secondary: string;
  position?: string;
  size?: string;
};

export const themes: Record<string, Theme> = {
  midnight: {
    video: "/home2.webm",
    image: "/bg.png",
    primary: "#a855f7",
    secondary: "#d946ef",
  },

  nerion: {
    image: "/Nerion.png",
    primary: "#f59e0b",
    secondary: "#facc15",
    position: "center top",
    size: "110%",
  },

  citygold: {
    image: "/citygold.png",
    primary: "#facc15",
    secondary: "#f59e0b",
  },

garrosh: {
  image: "/garrosh.png",
  primary: "#dc2626",
  secondary: "#f97316",
  position: "center top",
  size: "110%",
},

metalic: {
  image: "/Metalic.png",
  primary: "#a855f7",
  secondary: "#ec4899",
  position: "center 15%",
  size: "115%",
},

  illidan: {
    image: "/Illidan.png",
    primary: "#22c55e",
    secondary: "#16a34a",
  },

  thrall: {
    image: "/Thrall.png",
    primary: "#3b82f6",
    secondary: "#06b6d4",
  },

  sylvanas: {
    image: "/Sylvanas.png",
    primary: "#9333ea",
    secondary: "#c084fc",
  },

  sylvanasplanning: {
    image: "/sylvanasplanning.png",
    primary: "#a855f7",
    secondary: "#f472b6",
  },

  silvermoon: {
    image: "/Silvermoon.png",
    primary: "#f472b6",
    secondary: "#c084fc",
  },

  silvermoonwar: {
    image: "/silvermoonwar.png",
    primary: "#7c3aed",
    secondary: "#ec4899",
  },

  picnic: {
    image: "/picknick.png",
    primary: "#22c55e",
    secondary: "#84cc16",
  },

peaceful: {
  image: "/peaceful.png",
  primary: "#14b8a6",
  secondary: "#22c55e",
},

  zugzug: {
    image: "/zugzug.png",
    primary: "#dc2626",
    secondary: "#ea580c",
  },

  alliance: {
    image: "/alliance.png",
    primary: "#3b82f6",
    secondary: "#60a5fa",
  },

  stars: {
    image: "/stars.png",
    primary: "#8b5cf6",
    secondary: "#6366f1",
  },

  nightfall: {
    image: "/nightfall.png",
    primary: "#1e3a8a",
    secondary: "#312e81",
  },

 stormwind: {
  image: "/Stormwindd.png",
  primary: "#60a5fa",
  secondary: "#2563eb",
},

  hcBlue: {
    image: "/hc-bg.png",
    primary: "#0f172a",
    secondary: "#38bdf8",
  },

  mythicPurple: {
    image: "/mythic-purple-bg.png",
    primary: "#581c87",
    secondary: "#c084fc",
  },

  mythicRed: {
    image: "/mythic-red-bg.png",
    primary: "#450a0a",
    secondary: "#ef4444",
  },

  pantheon: {
    image: "/Pantheon.png",
    primary: "#1e3a8a",
    secondary: "#60a5fa",
  },

oldgods: {
  image: "/oldgods.png",
  primary: "#2e003e",
  secondary: "#a855f7",
},

orgrimmar: {
  image: "/orgimmar.png", // your file is orgimmar.png, not orgrimmar.png
  primary: "#7f1d1d",
  secondary: "#f97316",
},

argus: {
  image: "/argus.png",
  primary: "#4c1d95",
  secondary: "#c084fc",
},

  ironforge: {
    image: "/Ironforge.png",
    primary: "#431407",
    secondary: "#f59e0b",
  },

thunderbluff: {
  image: "/thunderbluff.png",
  primary: "#713f12",
  secondary: "#facc15",
},


archimonde: {
  image: "/archimonde.png",
  primary: "#14532d",
  secondary: "#22c55e",
  position: "center 18%",
},

  voljin: {
    image: "/Voljin.png",
    primary: "#7c2d12",
    secondary: "#fb923c",
  },

  guldanfel: {
    image: "/Guldanfel.png",
    primary: "#14532d",
    secondary: "#84cc16",
  },

  guldan: {
    image: "/Guldan.png",
    primary: "#581c87",
    secondary: "#a855f7",
  },

lichking: {
  image: "/Lichking.png",
  primary: "#082f49",
  secondary: "#38bdf8",
  position: "center top",
  size: "115%",
},

  deathwing: {
    image: "/Deathwing.png",
    primary: "#431407",
    secondary: "#f97316",
  },
};