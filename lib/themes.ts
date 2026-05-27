type Theme = {
  name?: string;
  video?: string;
  image?: string;
  primary: string;
  secondary: string;
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
},

  metalic: {
    image: "/Metalic.png",
    primary: "#a855f7",
    secondary: "#ec4899",
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
    image: "/Peaceful.png",
    primary: "#14b8a6",
    secondary: "#22c55e",
  },

  zugzug: {
    image: "/Zugzug.png",
    primary: "#dc2626",
    secondary: "#ea580c",
  },

 alliance: {
  image: "/alliance.png",
  primary: "#3b82f6",
  secondary: "#60a5fa",
},

  stars: {
    image: "/Stars.png",
    primary: "#8b5cf6",
    secondary: "#6366f1",
  },

  nightfall: {
    image: "/Nightfall.png",
    primary: "#1e3a8a",
    secondary: "#312e81",
  },

  stormwind: {
    image: "/Stormwind.png",
    primary: "#60a5fa",
    secondary: "#2563eb",
  },
};