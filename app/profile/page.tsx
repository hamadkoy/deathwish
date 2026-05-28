"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import SideNav from "@/app/components/SideNav";
import { themes } from "@/lib/themes";
import { useMobile } from "../hooks/useMobile";

type Character = {
  id: number;
  user_id?: string;
  name: string;
  realm: string;
  ilvl: number;
  class: string;
  spec: string;
  progress?: string;
  mythic_bosses?: string[];
  mythic_plus_score?: number;
  mythic_plus_color?: string;
  avatar_url?: string;
  is_main?: boolean;
  gear?: any;
};

type Profile = {
  user_id?: string;
  discord_name?: string;
  avatar_url?: string;
};

export default function ProfilePage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [time, setTime] = useState(new Date());
  const [name, setName] = useState("");
  const [realm, setRealm] = useState("Kazzak");
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [cinematicMode, setCinematicMode] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
const [newComment, setNewComment] = useState("");
const [viewedProfile, setViewedProfile] = useState<any>(null);
const [visitorCount, setVisitorCount] = useState(0);
const isMobile = useMobile();
const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [balance, setBalance] = useState(0);
  useEffect(() => {
  getLoggedUser();
}, []);
const [savedStatus, setSavedStatus] = useState<
  Record<number, { hc: boolean; mythic: boolean }>
>({});
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [discordId, setDiscordId] = useState("");
  const [popup, setPopup] = useState<{
  title: string;
  message: string;
  type?: "info" | "danger";
  confirmText?: string;
  onConfirm?: () => void;
} | null>(null);
const [updatingId, setUpdatingId] = useState<number | null>(null);
const [updatingAll, setUpdatingAll] = useState(false);
const [viewMode, setViewMode] = useState<"table" | "showcase">("table");
const [selectedCharacterIndex, setSelectedCharacterIndex] = useState(0);
const [hoveredItem, setHoveredItem] = useState<any>(null);
const [specPopup, setSpecPopup] = useState<Character | null>(null);
const [addCharacterOpen, setAddCharacterOpen] = useState(false);
const [selectedSpec, setSelectedSpec] = useState("");
const [muted, setMuted] = useState(() => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("charactersVideoMuted") === "true";
  }

  return true;
});


const [selectedTheme, setSelectedTheme] =
  useState(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("profileTheme") ||
        "midnight"
      );
    }

    return "midnight";
  });

const currentTheme = themes[selectedTheme] || themes.midnight;
const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
useEffect(() => {
  loadUserAndProfile();
  loadCharacters();
  getLoggedUser();
}, []);

useEffect(() => {
  if (viewedProfile?.user_id || profile?.user_id) {
    loadComments();
  }
}, [viewedProfile?.user_id, profile?.user_id]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
useEffect(() => {
  localStorage.setItem("charactersVideoMuted", String(muted));
}, [muted]);
useEffect(() => {
  localStorage.setItem(
    "profileTheme",
    selectedTheme
  );
}, [selectedTheme]);
  async function loadUserAndProfile() {
    const { data } = await supabase.auth.getUser();
console.log(data.user);
    if (!data.user) {
      setUser(null);
      setProfile(null);
      return;
    }

    setUser(data.user);
const discordIdentity = data.user.identities?.find(
  (i: any) => i.provider === "discord"
);

const userDiscordId =
  discordIdentity?.identity_data?.provider_id ||
  discordIdentity?.identity_data?.sub ||
  data.user.user_metadata?.provider_id ||
  data.user.user_metadata?.sub;

await supabase
  .from("profiles")
  .upsert({
    user_id: data.user.id,
    discord_id: userDiscordId,
    discord_name:
      data.user.user_metadata?.full_name ||
      data.user.user_metadata?.name ||
      data.user.user_metadata?.preferred_username ||
      "Unknown",
    avatar_url:
      data.user.user_metadata?.avatar_url || "",
  });
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", data.user.id)
      .single();

    if (profileData) setProfile(profileData);
  }
async function loadCharacters() {
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    setCharacters([]);
    setSavedStatus({});
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const targetDiscordId = params.get("discordId");
const targetCharacterId = params.get("characterId");

  let targetUserId = authData.user.id;
  setIsOwnProfile(true);

  // If viewing someone else's garrison
  if (targetCharacterId) {
  const { data: targetChar } = await supabase
    .from("characters")
    .select("user_id")
    .eq("id", Number(targetCharacterId))
    .single();

  if (targetChar?.user_id) {
    targetUserId = targetChar.user_id;
  }
}
  if (targetDiscordId) {
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("discord_id", targetDiscordId)
      .single();

    if (targetProfile?.user_id) {
      targetUserId = targetProfile.user_id;
    }
  }
setIsOwnProfile(targetUserId === authData.user.id);

const { data: viewedProfileData } = await supabase
  .from("profiles")
  .select("*")
  .eq("user_id", targetUserId)
  .single();

if (viewedProfileData) {
  setViewedProfile(viewedProfileData);

  if (viewedProfileData.profile_theme) {
    setSelectedTheme(viewedProfileData.profile_theme);
  }
}
if (targetUserId !== authData.user.id) {
  await supabase.from("garrison_visits").insert({
    profile_user_id: targetUserId,
    visitor_user_id: authData.user.id,
    visitor_name:
      authData.user.user_metadata?.full_name ||
      authData.user.user_metadata?.name ||
      "Unknown",
    visitor_avatar: authData.user.user_metadata?.avatar_url || "",
  });
}

const { count } = await supabase
  .from("garrison_visits")
  .select("*", { count: "exact", head: true })
  .eq("profile_user_id", targetUserId);

setVisitorCount(count || 0);
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("user_id", targetUserId)
    .order("class", { ascending: true });

  if (error) {
    alert(error.message);
    return;
  }

  const chars = data || [];

  setCharacters(chars);
  await loadSavedStatus(chars);
}

  async function loadSavedStatus(characterList: Character[]) {
  if (characterList.length === 0) {
    setSavedStatus({});
    return;
  }

  const characterIds = characterList.map((c) => c.id);

  const { data, error } = await supabase
    .from("signups")
.select(`
  character_id,
  role,
  attendance,
  runs (
    title,
    finished
  )
`)
    .in("character_id", characterIds);

  if (error) {
    console.error(error);
    return;
  }

  const status: Record<number, { hc: boolean; mythic: boolean }> = {};

  characterList.forEach((char) => {
    status[char.id] = { hc: false, mythic: false };
  });

  (data || []).forEach((signup: any) => {
    const run = Array.isArray(signup.runs)
      ? signup.runs[0]
      : signup.runs;

    if (
  !run?.finished ||
  !signup.character_id ||
  signup.attendance !== "present"
) {
  return;
}

    const title = (run.title || "").toLowerCase();

    if (title.includes("hc") || title.includes("heroic")) {
      status[signup.character_id].hc = true;
    }

    if (title.includes("mythic")) {
      status[signup.character_id].mythic = true;
    }
  });

  setSavedStatus(status);
}
async function loadComments() {
  const commentProfileId = viewedProfile?.user_id || profile?.user_id;
  if (!commentProfileId) return;

  const { data } = await supabase
    .from("profile_comments")
    .select("*")
    .eq("profile_user_id", commentProfileId)
    .order("created_at", { ascending: false });

  setComments(data || []);
}

async function submitComment() {
 const commentProfileId = viewedProfile?.user_id || profile?.user_id;
if (!newComment.trim() || !user || !commentProfileId) return;

  await supabase.from("profile_comments").insert({
    profile_user_id: commentProfileId,
    commenter_user_id: user.id,
commenter_name:
  profile?.discord_name ||
  user.user_metadata?.full_name ||
  user.user_metadata?.name ||
  "Unknown",

commenter_avatar:
  profile?.avatar_url ||
  user.user_metadata?.avatar_url ||
  "",
    comment: newComment,
  });

  setNewComment("");
  loadComments();
}
async function getLoggedUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const discordIdentity = user.identities?.find(
    (i: any) => i.provider === "discord"
  );

  const loggedDiscordId =
    discordIdentity?.identity_data?.provider_id ||
    discordIdentity?.identity_data?.sub ||
    user.user_metadata?.provider_id ||
    user.user_metadata?.sub;

  console.log("LOGGED USER DISCORD ID:", loggedDiscordId);

  setDiscordId(loggedDiscordId || "");

  if (loggedDiscordId) {
    loadBalance(loggedDiscordId);
  }
}
async function loadBalance(discordId: string) {
  try {
    const res = await fetch(`/api/bank?discordId=${discordId}`);
    const data = await res.json();

    console.log("BALANCE DATA:", data);

    setBalance(Number(data.balance || 0));
  } catch (err) {
    console.error(err);
    setBalance(0);
  }
}
  function getRaidProgress(data: any) {
    const raids = data.raid_progression || {};
    const raidValues = Object.values(raids) as any[];

    let bestMythic = 0;
    let bestHeroic = 0;

    for (const raid of raidValues) {
      if (raid?.mythic_bosses_killed > bestMythic) {
        bestMythic = raid.mythic_bosses_killed;
      }

      if (raid?.heroic_bosses_killed > bestHeroic) {
        bestHeroic = raid.heroic_bosses_killed;
      }
    }

    if (bestMythic > 0) return `${bestMythic}/9M`;
    if (bestHeroic > 0) return `${bestHeroic}/9HC`;

    return "0/9";
  }

async function addCharacter() {
  if (!name.trim()) {
    setPopup({
      title: "Missing Information",
      message: "Character name is required.",
    });

    return;
  }

  const { data: authData } = await supabase.auth.getUser();

    if (!authData.user) {
      alert("Please login first.");
      return;
    }

    try {
      const response = await fetch(
        `https://raider.io/api/v1/characters/profile?region=eu&realm=${realm.trim()}&name=${name.trim()}&fields=gear,raid_progression,mythic_plus_best_runs,mythic_plus_scores_by_season_current`
      );

      const data = await response.json();
      const existingCharacter = characters.find(
  (char) =>
    char.name.toLowerCase() === data.name.toLowerCase() &&
    char.realm.toLowerCase() === data.realm.toLowerCase()
);

if (existingCharacter) {
  setPopup({
    title: "Character Already Exists",
    message: `${data.name} already exists in your character list.`,
    type: "info",
  });
  return;
}
const mythicBosses: string[] = [];

const raids = Object.values(data.raid_progression || {}) as any[];

raids.forEach((raid: any) => {
const bosses = raid.bosses || [];

bosses.forEach((boss: any) => {
  if (
    boss.mythic?.first_kill ||
    boss.mythic?.count > 0 ||
    boss.mythic?.rank
  ) {
    mythicBosses.push(boss.name);
  }
});
});
      if (data.statusCode) {
        alert("Character not found on Raider.IO");
        return;
      }

      const ilvl = Math.floor(
        data.gear?.item_level_equipped ||
          data.gear?.item_level ||
          0
      );

      const progress = getRaidProgress(data);

      const mythicPlusScore = Math.floor(
        data.mythic_plus_scores_by_season_current?.scores?.all ||
          data.mythic_plus_scores_by_season_current?.all ||
          data.mythic_plus_best_runs?.reduce(
            (total: number, run: any) => total + (run.score || 0),
            0
          ) ||
          0
      );

      let mythicPlusColor = "#ffffff";

      if (mythicPlusScore >= 3300) {
        mythicPlusColor = "#ff66ff";
      } else if (mythicPlusScore >= 3000) {
        mythicPlusColor = "#a335ee";
      } else if (mythicPlusScore >= 2500) {
        mythicPlusColor = "#3d7ebf";
      } else if (mythicPlusScore >= 2000) {
        mythicPlusColor = "#4cee34";
      } else if (mythicPlusScore >= 1500) {
        mythicPlusColor = "#78ed5f";
      }

      const { error } = await supabase.from("characters").insert([
        {
          user_id: authData.user.id,
          name: data.name,
          realm: data.realm,
          ilvl,
          class: data.class,
          spec: data.active_spec_name,
          progress,
          mythic_plus_score: mythicPlusScore,
          mythic_plus_color: mythicPlusColor,
          mythic_bosses: mythicBosses,
          avatar_url: data.thumbnail_url || "",
          gear: data.gear || null,
        },
      ]);

      if (error) {
        alert(error.message);
        return;
      }

  setName("");
setAddCharacterOpen(false);
await loadCharacters();
    } catch (err) {
      console.error(err);
      alert("Failed to fetch Raider.IO");
    }
  }
async function updateCharacter(char: Character) {
  try {
    setUpdatingId(char.id);

    const response = await fetch(
      `https://raider.io/api/v1/characters/profile?region=eu&realm=${char.realm}&name=${char.name}&fields=gear,raid_progression,mythic_plus_best_runs,mythic_plus_scores_by_season_current`
    );

    const data = await response.json();
    console.log("RAIDER DATA:", data.raid_progression);
const mythicBosses: string[] = [];

const raids = Object.values(data.raid_progression || {}) as any[];

raids.forEach((raid: any) => {
const bosses = raid.bosses || [];

bosses.forEach((boss: any) => {
  if (
    boss.mythic?.first_kill ||
    boss.mythic?.count > 0 ||
    boss.mythic?.rank
  ) {
    mythicBosses.push(boss.name);
  }
});
});
    if (data.statusCode) {
      alert("Character not found on Raider.IO");
      return;
    }

    const ilvl = Math.floor(
      data.gear?.item_level_equipped ||
        data.gear?.item_level ||
        char.ilvl ||
        0
    );

    const progress = getRaidProgress(data);

    const mythicPlusScore = Math.floor(
      data.mythic_plus_scores_by_season_current?.scores?.all ||
        data.mythic_plus_scores_by_season_current?.all ||
        data.mythic_plus_best_runs?.reduce(
          (total: number, run: any) => total + (run.score || 0),
          0
        ) ||
        0
    );

    let mythicPlusColor = "#ffffff";

    if (mythicPlusScore >= 3300) mythicPlusColor = "#ff66ff";
    else if (mythicPlusScore >= 3000) mythicPlusColor = "#a335ee";
    else if (mythicPlusScore >= 2500) mythicPlusColor = "#3d7ebf";
    else if (mythicPlusScore >= 2000) mythicPlusColor = "#4cee34";
    else if (mythicPlusScore >= 1500) mythicPlusColor = "#78ed5f";

    const { error } = await supabase
      .from("characters")
      .update({
        ilvl,
        class: data.class,
        spec: data.active_spec_name,
        progress,
        mythic_plus_score: mythicPlusScore,
        mythic_plus_color: mythicPlusColor,
        mythic_bosses: mythicBosses,
        avatar_url: data.thumbnail_url || char.avatar_url || "",
        gear: data.gear || null,
      })
      .eq("id", char.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadCharacters();
  } catch (err) {
    console.error(err);
    alert("Failed to update character.");
  } finally {
    setUpdatingId(null);
  }
}
async function updateAllCharacters() {
  if (characters.length === 0) return;

  setUpdatingAll(true);

  try {
    for (const char of characters) {
      await updateCharacter(char);

      // small delay so Raider.IO does not get spammed too fast
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    await loadCharacters();
  } catch (err) {
    console.error(err);
    alert("Failed to update all characters.");
  } finally {
    setUpdatingAll(false);
    setUpdatingId(null);
  }
}
async function setMainCharacter(id: number) {
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) return;

  await supabase
    .from("characters")
    .update({ is_main: false })
    .eq("user_id", authData.user.id);

  await supabase
    .from("characters")
    .update({ is_main: true })
    .eq("id", id);

  loadCharacters();
}
async function updateCharacterSpec() {
  if (!specPopup || !selectedSpec) return;

  const newPlayerName = `${specPopup.name} - ${selectedSpec} ${specPopup.class}`;

  const { error: charError } = await supabase
    .from("characters")
    .update({
      spec: selectedSpec,
    })
    .eq("id", specPopup.id);

  if (charError) {
    alert(charError.message);
    return;
  }

  const { error: signupError } = await supabase
    .from("signups")
    .update({
      player: newPlayerName,
    })
    .eq("character_id", specPopup.id);

  if (signupError) {
    alert(signupError.message);
    return;
  }

  setSpecPopup(null);
  setSelectedSpec("");

  await loadCharacters();
}
  async function deleteCharacter(id: number) {
    const { error } = await supabase.from("characters").delete().eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadCharacters();
  }

const groupedCharacters = useMemo(() => {
  return [...characters].sort((a, b) => {
    if (a.is_main) return -1;
    if (b.is_main) return 1;
    return b.ilvl - a.ilvl;
  });
}, [characters]);
const selectedCharacter =
  groupedCharacters[selectedCharacterIndex] || groupedCharacters[0];
const highestRioScore = useMemo(() => {
  return Math.max(
    0,
    ...characters.map((char) => Number(char.mythic_plus_score || 0))
  );
}, [characters]);
const totalExperience = useMemo(() => {
  const uniqueBosses = new Set<string>();

  characters.forEach((char) => {
    (char.mythic_bosses || []).forEach((boss) => {
      uniqueBosses.add(boss.toLowerCase().trim());
    });
  });

  if (uniqueBosses.size > 0) {
    return `${uniqueBosses.size}/9M`;
  }

  const bestMythicProgress = Math.max(
    0,
    ...characters.map((char) => {
      const progress = (char.progress || "0/9").toLowerCase();

      if (progress.includes("hc")) return 0;
      if (!progress.includes("m")) return 0;

      return Number(progress.split("/")[0]) || 0;
    })
  );

  return `${bestMythicProgress}/9M`;
}, [characters]);

return (
  <div style={{ position: "relative", minHeight: "100vh", overflowX: "hidden" }}>

{currentTheme.video ? (
  <video
    autoPlay
    muted={muted}
    loop
    playsInline
    key={selectedTheme}
    style={{
      position: "fixed",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      zIndex: -2,
      filter: "brightness(.8)",
    }}
  >
    <source
      src={currentTheme.video}
      type="video/webm"
    />
  </video>
) : (
  <div
    style={{
      position: "fixed",
      inset: 0,
      backgroundImage: `url(${currentTheme.image})`,
backgroundSize: isMobile ? "cover" : "95%",
backgroundPosition: "center top",
backgroundRepeat: "no-repeat",
      zIndex: -2,
      filter: "brightness(.8)",
    }}
  />
)}

    {/* DARK OVERLAY */}
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
  "linear-gradient(rgba(5,5,15,.35), rgba(0,0,0,.45))",
        zIndex: -1,
      }}
    />

    <div style={page}>
{cinematicMode && (
  <button
    onClick={() => setCinematicMode(false)}
    style={{
   position: "absolute",
top: 0,
left: 110,
      zIndex: 999999,
      height: 56,
      padding: "0 28px",
      borderRadius: 16,
      border: `1px solid ${currentTheme.secondary}88`,
      background: "rgba(0,0,0,.75)",
      color: "white",
      fontWeight: 900,
      fontSize: 16,
      cursor: "pointer",
      boxShadow: `0 0 25px ${currentTheme.secondary}88`,
    }}
  >
    ✕ EXIT CINEMATIC
  </button>
)}

{!cinematicMode && (
  <>
      <div
  style={{
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 999,
  }}
>
  <button
    onClick={() => setMuted(!muted)}
    style={{
      padding: "12px 18px",
      borderRadius: 14,
      border: "1px solid rgba(168,85,247,.45)",
      background:
        "linear-gradient(180deg,#c026d3,#7e22ce)",
      color: "white",
      fontWeight: 900,
      cursor: "pointer",
      boxShadow:
        "0 0 22px rgba(168,85,247,.55)",
      fontSize: 14,
    }}
  >
    {muted ? "🔇 Unmute Sound" : "🔊 Mute Sound"}
  </button>
</div>
{isOwnProfile && (
<div style={{ marginBottom: 20, padding: "0 18px" }}> 
  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
    
    <button
      onClick={() => setThemePickerOpen(true)}
      style={{
        ...normalViewBtn,
        height: 56,
        padding: "0 34px",
        borderRadius: 16,
        fontSize: 18,
        fontWeight: 900,
        minWidth: 180,
        boxShadow: "0 0 18px rgba(168,85,247,.35)",
        transition: "all .22s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.06)";
        e.currentTarget.style.boxShadow =
          "0 0 28px rgba(168,85,247,.75)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow =
          "0 0 18px rgba(168,85,247,.35)";
      }}
    >
      🎨 THEMES
    </button>

    <button
      onClick={() => setCinematicMode(true)}
      style={{
        ...normalViewBtn,
        height: 56,
        padding: "0 34px",
        borderRadius: 16,
        fontSize: 18,
        fontWeight: 900,
        minWidth: 220,
        boxShadow: "0 0 18px rgba(236,72,153,.35)",
        transition: "all .22s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.06)";
        e.currentTarget.style.boxShadow =
          "0 0 30px rgba(236,72,153,.75)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow =
          "0 0 18px rgba(236,72,153,.35)";
      }}
    >
      🎬 CINEMATIC MODE
    </button>
</div>
</div>
)}
{themePickerOpen && (
  <div style={popupOverlay}>
    <div
      style={{
        width: 1300,
        maxHeight: "80vh",
        overflowY: "auto",
        borderRadius: 24,
        padding: 24,
        background: "rgba(8,8,20,.96)",
        border: `1px solid ${currentTheme.secondary}66`,
        boxShadow: `0 0 40px ${currentTheme.secondary}55`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 900,
          }}
        >
          Choose Theme
        </h2>

        <button
          onClick={() => setThemePickerOpen(false)}
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.12)",
            background: "rgba(255,255,255,.05)",
            color: "white",
            fontSize: 18,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))",
          gap: 18,
        }}
      >
        {Object.keys(themes).map((theme) => (
          <button
            key={theme}
            onClick={() => {
              setSelectedTheme(theme);
              setThemePickerOpen(false);
            }}
            style={{
              height: 200,
              borderRadius: 20,
              border:
                selectedTheme === theme
                  ? `2px solid ${
                      themes[
                        theme as keyof typeof themes
                      ].secondary
                    }`
                  : "1px solid rgba(255,255,255,.08)",

              backgroundImage: `url(${
                themes[
                  theme as keyof typeof themes
                ].image
              })`,

              backgroundSize: "cover",
              backgroundPosition: "center",
              position: "relative",
              overflow: "hidden",
              cursor: "pointer",
              transition: "all .25s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.03)";
              e.currentTarget.style.boxShadow =
                `0 0 30px ${
                  themes[
                    theme as keyof typeof themes
                  ].secondary
                }88`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(rgba(0,0,0,.2), rgba(0,0,0,.7))",
              }}
            />

            <div
              style={{
                position: "absolute",
                bottom: 14,
                left: 14,
                fontSize: 20,
                fontWeight: 900,
                color: "white",
                textTransform: "uppercase",
              }}
            >
              {theme}
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
)}
<div
  style={{
    ...layout,
gridTemplateColumns: isMobile
  ? "1fr"
  : isOwnProfile
  ? "220px minmax(0,1fr) 260px"
  : "minmax(0,1fr)",

paddingLeft: isMobile ? 10 : 20,
paddingRight: isMobile ? 10 : 20,
  }}
>
{isOwnProfile && (
  <aside
  
    style={{
      ...sidebar,
      display: isMobile ? "none" : "block",
      background: `${currentTheme.primary}22`,
      backdropFilter: "blur(10px)",
      border: `1px solid ${currentTheme.secondary}55`,
    }}
  >

<SideNav active="My Characters" />

<div style={balanceBox}>
  <div style={balanceTitle}>BALANCE OVERVIEW</div>

  <div style={balanceLabel}>Total Balance</div>

  <div style={balanceAmount}>
    {Number(balance || 0).toLocaleString()} 🟡
  </div>

  <button style={paymentBtn}>
    💰 Request Early Payment
  </button>
</div>

<div style={discordBox}>
  <b>Join our Discord</b>

  <p style={mutedSmall}>
    Stay updated with raid announcements and guild activity.
  </p>

  <button style={discordBtn}>
    JOIN DISCORD
  </button>
</div>
        </aside>
)}
        <main style={main}>
          <div style={headerRow}>
            <div>
              <h1 style={title}>My Characters</h1>
              <p style={subtitle}>View all your characters and their raid availability.</p>
              {characters.find((c) => c.is_main) && (
<div
  style={mainCharacterBadge}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.04)";
    e.currentTarget.style.boxShadow =
      "0 0 35px rgba(250,204,21,.55), 0 0 24px rgba(168,85,247,.35)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow =
      "0 0 18px rgba(250,204,21,.35)";
  }}
>
  <img
    src={
      characters.find((c) => c.is_main)?.avatar_url ||
      getClassIcon(
        characters.find((c) => c.is_main)?.class || "",
        characters.find((c) => c.is_main)?.spec
      )
    }
    style={mainCharacterAvatar}
  />

  <div style={mainInfoBlock}>
    <div style={mainCharacterLabel}>⭐ MAIN CHARACTER</div>
    <div
  style={{
    ...mainCharacterName,
    color: getClassColor(
      characters.find((c) => c.is_main)?.class || ""
    ),
    textShadow: `0 0 18px ${
      getClassColor(
        characters.find((c) => c.is_main)?.class || ""
      )
    }88`,
  }}
>
  {characters.find((c) => c.is_main)?.name}
</div>
  </div>

  <div style={statDivider} />

  <div style={miniStat}>
    <span style={miniStatLabel}>Raid EXP</span>
    <b style={experienceValue}>{totalExperience}</b>
  </div>

  <div style={miniStat}>
    <span style={miniStatLabel}>Raider.IO</span>
    <b style={rioValue}>{highestRioScore}</b>
  </div>
</div>

)}
            </div>
          </div>


{addCharacterOpen && (
<div style={popupOverlay}>
<div
  style={{
    width: 620,
    borderRadius: 22,
    padding: 24,
    background: `${currentTheme.primary}22`,
    backdropFilter: "blur(14px)",
    border: `1px solid ${currentTheme.secondary}88`,
    boxShadow: `0 0 35px ${currentTheme.secondary}66`,
  }}
>
  <div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: 12,
  }}
>
  <button
    onClick={() => setAddCharacterOpen(false)}
    style={{
      width: 38,
      height: 38,
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,.12)",
      background: "rgba(255,255,255,.05)",
      color: "white",
      cursor: "pointer",
      fontSize: 18,
      fontWeight: 900,
    }}
  >
    ✕
  </button>
</div>
<h2 style={{ margin: "0 0 18px", fontSize: 26, fontWeight: 900 }}>
  Add Character
</h2>

<div style={{ display: "grid", gap: 14 }}>
  <input
    placeholder="Character name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    style={{ ...input, width: "100%", boxSizing: "border-box" }}
  />

  <input
    placeholder="Realm"
    value={realm}
    onChange={(e) => setRealm(e.target.value)}
    style={{ ...input, width: "100%", boxSizing: "border-box" }}
  />

  <button
    onClick={addCharacter}
    style={{
      ...addBtn,
      height: 46,
      width: "100%",
      background: `linear-gradient(90deg, ${currentTheme.primary}, ${currentTheme.secondary})`,
      boxShadow: `0 0 18px ${currentTheme.secondary}88`,
    }}
  >
    Add Character
  </button>
</div>
          </div>
</div>

)}
<div
  style={{
    display: "flex",
    gap: 12,
    marginBottom: 28,
    alignItems: "center",
    flexWrap: "wrap",
  }}
>
  <button onClick={() => setViewMode("table")} style={viewMode === "table" ? activeViewBtn : normalViewBtn}>
    🛡 TABLE VIEW
  </button>

  <button onClick={() => setViewMode("showcase")} style={viewMode === "showcase" ? activeViewBtn : normalViewBtn}>
    ⚔ CHARACTER VIEW
  </button>

  {isOwnProfile && (
  <>
    <button
      onClick={updateAllCharacters}
      disabled={updatingAll || characters.length === 0}
      style={normalViewBtn}
    >
      {updatingAll ? "Refreshing..." : "↻ REFRESH ALL"}
    </button>

    <button
      onClick={() => setAddCharacterOpen(true)}
      style={normalViewBtn}
    >
      ✦ NEW CHARACTER
    </button>
  </>
)}
</div>


          {viewMode === "table" && (
<div
  style={{
    ...table,
    overflowX: "auto",
    width: "100%",
    minWidth: 0,
  }}
>
  <div
    style={{
      ...tableHead,
      minWidth: isMobile ? 1100 : "unset",
    }}
  >
    <div>CHARACTER</div>
    <div>MAIN</div>
    <div>ILVL</div>
    <div>PROGRESS</div>
    <div>HC STATUS</div>
    <div>MYTHIC STATUS</div>
    <div>ACTIONS</div>
  </div>


            {groupedCharacters.map((char) => (
              
<div
  key={char.id}
  style={{
    ...tableRow,
minWidth: isMobile ? 1100 : "unset",
    border: char.is_main
      ? "1px solid rgba(250,204,21,.75)"
      : "1px solid rgba(255,255,255,0.05)",

    boxShadow: char.is_main
      ? "0 0 24px rgba(250,204,21,.35)"
      : "none",

    background: char.is_main
      ? "linear-gradient(90deg, rgba(120,90,0,0.18), rgba(8,8,12,0.95))"
      : tableRow.background,
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.018)";
    e.currentTarget.style.boxShadow =
      "0 0 28px rgba(168,85,247,0.65)";
    e.currentTarget.style.border =
      "1px solid rgba(168,85,247,0.75)";
    e.currentTarget.style.background =
      "linear-gradient(90deg, rgba(88,28,135,0.35), rgba(4,9,18,0.95))";
    e.currentTarget.style.zIndex = "5";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.border =
      "1px solid rgba(255,255,255,0.05)";
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.zIndex = "1";
  }}
>
                <div style={characterCell}>
                  <img
                    src={char.avatar_url || getClassIcon(char.class, char.spec)}
                    style={charIcon}
                    alt={char.name}
                  />
                  <div>
                    <div style={{ ...charName, color: getClassColor(char.class) }}>
                      {char.name}
                    </div>
                    <div style={realmText}>(EU) {char.realm}</div>
                  </div>
                </div>
 <button
  onClick={() => setMainCharacter(char.id)}
  style={{
    width: 70,
    height: 36,
    borderRadius: 9,
    border: char.is_main
      ? "1px solid rgba(250,204,21,.9)"
      : "1px solid rgba(168,85,247,.45)",
    background: char.is_main
      ? "linear-gradient(90deg,#facc15,#ca8a04)"
      : "rgba(147,51,234,0.22)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: char.is_main
      ? "0 0 18px rgba(250,204,21,.55)"
      : "0 0 12px rgba(168,85,247,.25)",
  }}
>
  {char.is_main ? "MAIN" : "Set Main"}
</button>
                <div style={{ ...ilvlText, color: getIlvlColor(char.ilvl) }}>
                  {char.ilvl}
                </div>

                <div style={progressCell}>
                  <img
  src={getClassIcon(char.class, char.spec)}
  style={{
    ...roleIcon,
    cursor: "pointer",
    transition: ".2s",
  }}
  onClick={() => {
    setSpecPopup(char);
    setSelectedSpec(char.spec);
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.12)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
  }}
/>
                  <div>
                    <div style={progressText}>{char.progress || "0/9"}</div>
                    <div
                      style={{
                        ...scoreText,
                        color: char.mythic_plus_color || "#ffffff",
                        fontWeight: 900,
                      }}
                    >
                      M+ Score: {char.mythic_plus_score || 0}
                    </div>
                  </div>
                </div>

<StatusCard saved={savedStatus[char.id]?.hc || false} />
<StatusCard saved={savedStatus[char.id]?.mythic || false} />

<div style={actionCell}>

  <button
    onClick={() => updateCharacter(char)}
    disabled={updatingId === char.id}
    style={{
      ...actionBtn,
      opacity: updatingId === char.id ? 0.6 : 1,
    }}
    title="Update character"
  >
    {updatingId === char.id ? "⟳" : "↻"}
  </button>

<button
  onClick={() => {
    setPopup({
      title: "Delete Character",
      message: `${char.name} will be permanently deleted. This cannot be undone.`,
      type: "danger",
      confirmText: "Delete",
      onConfirm: () => deleteCharacter(char.id),
    });
  }}
  style={trashBtn}
  title="Delete character"
>
  🗑
</button>
</div>
 
              </div>
            ))}

<div style={note}>
  ⓘ All times are in ST. Weekly reset: Wednesday 5:00 AM ST.
</div>
</div>
)}
{viewMode === "showcase" && selectedCharacter && (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: isMobile
  ? "1fr"
  : "240px minmax(0,1fr) 300px",
  overflow: "hidden",
width: "100%",
      gap: 20,
      marginTop: 20,
      minHeight: 780,
    }}
  >
    {/* LEFT CHARACTER LIST */}
    <div
      style={{
        background: "rgba(8,8,20,.92)",
        border: "1px solid rgba(168,85,247,.22)",
        borderRadius: 20,
        padding: 16,
        overflowY: "auto",
      }}
    >
      {groupedCharacters.map((char, index) => (
        <div
          key={char.id}
          onClick={() => setSelectedCharacterIndex(index)}
          onMouseEnter={(e) => {
  e.currentTarget.style.transform = "scale(1.03)";
  e.currentTarget.style.boxShadow =
    `0 0 30px ${getClassColor(char.class)}66`;
}}

onMouseLeave={(e) => {
  e.currentTarget.style.transform = "scale(1)";

  e.currentTarget.style.boxShadow =
    index === selectedCharacterIndex
      ? "0 0 22px rgba(250,204,21,.35)"
      : "none";
}}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 12,
            marginBottom: 12,
            borderRadius: 14,
            cursor: "pointer",
            transition: "all .25s ease",
            border:
              index === selectedCharacterIndex
                ? "1px solid rgba(250,204,21,.7)"
                : "1px solid rgba(255,255,255,.06)",

            background:
            
              index === selectedCharacterIndex
                ? "rgba(250,204,21,.08)"
                : "rgba(255,255,255,.02)",
                
          }}
        >
          <img
            src={
              char.avatar_url ||
              getClassIcon(char.class, char.spec)
            }
            style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              objectFit: "cover",
            }}
          />

          <div>
            <div
              style={{
                color: getClassColor(char.class),
textShadow: `0 0 10px ${getClassColor(char.class)}55`,
                fontWeight: 900,
                fontSize: 17,
              }}
            >
              {char.name}
              <div
  style={{
    color: "#e879f9",
    fontSize: 12,
    fontWeight: 900,
    marginTop: 2,
    textShadow:
      "0 0 8px rgba(232,121,249,.8)",
  }}
>
  {char.ilvl}
</div>
            </div>

            <div
              style={{
                color: "#a855f7",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {char.progress || "0/9M"}
            </div>
          </div>
        </div>
      ))}
    </div>

{/* CENTER CHARACTER */}
<div
  style={{
    position: "relative",
    borderRadius: 24,
    overflow: "hidden",
    minHeight: 780,
    border: "1px solid rgba(168,85,247,.3)",
    background:
      "linear-gradient(rgba(5,5,15,.72), rgba(0,0,0,.88)), url('/bg.png') center / cover",
  }}
>
  <div style={{ textAlign: "center", paddingTop: 24 }}>
    <div style={{ fontSize: 42, fontWeight: 900 }}>
      {selectedCharacter.name}
    </div>
    <div style={{ color: getClassColor(selectedCharacter.class), fontWeight: 900 }}>
      {selectedCharacter.spec} {selectedCharacter.class}
    </div>
    <div
  style={{
    color: "#e879f9",
    fontSize: 28,
    fontWeight: 900,
    marginTop: 6,
    textShadow:
      "0 0 10px rgba(232,121,249,.8)",
  }}
>
  {selectedCharacter.ilvl}
</div>
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "160px 1fr 160px",
      gap: 24,
      padding: 32,
      alignItems: "center",
    }}
  >
    <div>
{
[
  selectedCharacter.gear?.items?.head,
  selectedCharacter.gear?.items?.neck,
  selectedCharacter.gear?.items?.shoulder,
  selectedCharacter.gear?.items?.back,
  selectedCharacter.gear?.items?.chest,
  selectedCharacter.gear?.items?.wrist,
  selectedCharacter.gear?.items?.hands,
]
.filter(Boolean)
.map((item: any) => (
  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
<img


  src={`https://wow.zamimg.com/images/wow/icons/large/${item.icon}.jpg`}
  style={{
  ...gearSlot,
  border: `2px solid ${getItemBorder(item)}`,
  boxShadow: `0 0 18px ${getItemBorder(item)}88`,
}}
 onMouseEnter={(e) => {
  setHoveredItem(item);
  setTooltipPos({ x: e.clientX + 18, y: e.clientY - 20 });

  e.currentTarget.style.transform = "scale(1.12)";
    e.currentTarget.style.boxShadow =
      "0 0 26px rgba(217,70,239,.95)";
  }}
onMouseLeave={(e) => {
  setHoveredItem(null);

  e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow =
      "0 0 18px rgba(217,70,239,.45)";
  }}
/>
<div
style={{
  color: "#e879f9",
  fontSize: 22,
  fontWeight: 900,
  marginLeft: -4,
  letterSpacing: 0.5,
  fontFamily: "Arial Black",
  textShadow:
    "0 0 6px #000, 0 0 12px rgba(217,70,239,.95)",
}}
>
  {item.item_level}
  <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  }}
>
{item.enchant && (
  <div
    style={{
      color: "#1eff00",
      fontSize: 11,
      fontWeight: 800,
      textShadow: "0 0 8px #1eff00",
      marginTop: 2,
      lineHeight: 1,
      whiteSpace: "nowrap",
    }}
  >
    Enc
  </div>
)}

{item.gems?.length > 0 && (
  <div
    style={{
      color: "#38bdf8",
      fontSize: 11,
      fontWeight: 800,
      textShadow: "0 0 8px #38bdf8",
      lineHeight: 1,
    }}
  >
    Gem
  </div>
)}
</div>
</div>
  </div>
))}
    </div>

<div
  style={{
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  }}
>
  {/* Purple glow behind character */}
  <div
    style={{
      position: "absolute",
      width: 420,
      height: 420,
      borderRadius: "50%",
      background:
        "radial-gradient(circle, rgba(168,85,247,.45) 0%, rgba(168,85,247,0) 70%)",
      filter: "blur(40px)",
      zIndex: 1,
    }}
  />

  {/* Character */}
  <div
  style={{
    position: "absolute",
    inset: 0,
    background:
   "radial-gradient(circle, rgba(217,70,239,.55) 0%, rgba(168,85,247,.22) 45%, transparent 75%)",
    filter: "blur(40px)",
    animation: "pulseFog 4s ease-in-out infinite",
    pointerEvents: "none",
    zIndex: 1,
  }}
/>
  <img
    src={`/renders/${selectedCharacter.class.toLowerCase()}.png`}
    style={{
      position: "relative",
      zIndex: 2,
      width: 620,
      height: 760,
      objectFit: "contain",
      filter:
        "drop-shadow(0 0 40px rgba(168,85,247,.75))",
      animation: "float 4s ease-in-out infinite",
      transition: "all .35s ease",
    }}
  />

  {/* Floor shadow */}
  <div
    style={{
      position: "absolute",
      bottom: 30,
      width: 280,
      height: 40,
      borderRadius: "50%",
      background: "rgba(0,0,0,.65)",
      filter: "blur(20px)",
      zIndex: 0,
    }}
  />
  <div
  style={{
    position: "absolute",
    bottom: 30,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: 18,
    zIndex: 5,
  }}
>
{selectedCharacter.gear?.items?.mainhand && (
  <div style={{ textAlign: "center" }}>
    <img
      src={`https://wow.zamimg.com/images/wow/icons/large/${selectedCharacter.gear.items.mainhand.icon}.jpg`}
      style={{
        ...gearSlot,
        width: 86,
        height: 86,
        border: "2px solid #ffcc00",
        boxShadow: "0 0 24px rgba(255,204,0,.65)",
      }}

      onMouseEnter={(e) => {
        setHoveredItem(selectedCharacter.gear.items.mainhand);

        setTooltipPos({
          x: e.clientX + 18,
          y: e.clientY - 20,
        });

        e.currentTarget.style.transform = "scale(1.12)";
        e.currentTarget.style.boxShadow =
          "0 0 30px rgba(255,204,0,.95)";
      }}

      onMouseLeave={(e) => {
        setHoveredItem(null);

        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow =
          "0 0 24px rgba(255,204,0,.65)";
      }}
    />

    <div
      style={{
        color: "#e879f9",
        fontSize: 22,
        fontWeight: 900,
      }}
    >
      {selectedCharacter.gear.items.mainhand.item_level}
      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
  {selectedCharacter.gear.items.mainhand.enchant && (
    <div style={{ color: "#1eff00", fontSize: 11, fontWeight: 900 }}>
      Enc
    </div>
  )}

  {selectedCharacter.gear.items.mainhand.gems?.length > 0 && (
    <div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 900 }}>
      Gem
    </div>
  )}
</div>
    </div>
  </div>
)}
{selectedCharacter.gear?.items?.offhand && (
  <div style={{ textAlign: "center" }}>
    <img
      src={`https://wow.zamimg.com/images/wow/icons/large/${selectedCharacter.gear.items.offhand.icon}.jpg`}

      style={{
        ...gearSlot,
        width: 86,
        height: 86,
        border: "2px solid #38bdf8",
        boxShadow: "0 0 24px rgba(56,189,248,.55)",
      }}

      onMouseEnter={(e) => {
        setHoveredItem(selectedCharacter.gear.items.offhand);

        setTooltipPos({
          x: e.clientX + 18,
          y: e.clientY - 20,
        });

        e.currentTarget.style.transform = "scale(1.12)";
        e.currentTarget.style.boxShadow =
          "0 0 30px rgba(56,189,248,.95)";
      }}

      onMouseLeave={(e) => {
        setHoveredItem(null);

        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow =
          "0 0 24px rgba(56,189,248,.55)";
      }}
    />

    <div
      style={{
        color: "#e879f9",
        fontSize: 22,
        fontWeight: 900,
        marginTop: 4,
        textShadow:
          "0 0 6px #000, 0 0 12px rgba(217,70,239,.95)",
      }}
    >
      {selectedCharacter.gear.items.offhand.item_level}
      <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
  {selectedCharacter.gear.items.offhand.enchant && (
    <div style={{ color: "#1eff00", fontSize: 11, fontWeight: 900 }}>
      Enc
    </div>
  )}

  {selectedCharacter.gear.items.offhand.gems?.length > 0 && (
    <div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 900 }}>
      Gem
    </div>
  )}
</div>
    </div>
  </div>
)}

</div>
</div>

    <div>
{
[
  selectedCharacter.gear?.items?.waist,
  selectedCharacter.gear?.items?.legs,
  selectedCharacter.gear?.items?.feet,
  selectedCharacter.gear?.items?.finger1,
  selectedCharacter.gear?.items?.finger2,
  selectedCharacter.gear?.items?.trinket1,
  selectedCharacter.gear?.items?.trinket2,
]
.filter(Boolean)
.map((item: any) => (
  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
<div
  style={{
    color: "#e879f9",
    fontSize: 22,
    fontWeight: 900,
    width: 42,
    textAlign: "right",
    letterSpacing: 0.5,
    fontFamily: "Arial Black",
    textShadow:
      "0 0 6px #000, 0 0 12px rgba(217,70,239,.95)",
  }}
>
  {item.item_level}
<div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
  {item.enchant && (
    <div style={{ color: "#1eff00", fontSize: 11, fontWeight: 900 }}>
      Enc
    </div>
  )}

  {item.gems?.length > 0 && (
    <div style={{ color: "#38bdf8", fontSize: 11, fontWeight: 900 }}>
      Gem
    </div>
  )}
</div>
</div>

<img

  src={`https://wow.zamimg.com/images/wow/icons/large/${item.icon}.jpg`}
  style={{
  ...gearSlot,
  border: `2px solid ${getItemBorder(item)}`,
  boxShadow: `0 0 18px ${getItemBorder(item)}88`,
}}
  onMouseEnter={(e) => {
      setHoveredItem(item);
  setTooltipPos({ x: e.clientX + 18, y: e.clientY - 20 });
    e.currentTarget.style.transform = "scale(1.12)";
    e.currentTarget.style.boxShadow =
      "0 0 26px rgba(217,70,239,.95)";
  }}
  onMouseLeave={(e) => {
  setHoveredItem(null);

  e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow =
      "0 0 18px rgba(217,70,239,.45)";
  }}
/>
  </div>
))}
    </div>
  </div>
</div>

    {/* RIGHT INFO */}
    <div
      style={{
        background: "rgba(8,8,20,.94)",
        borderRadius: 20,
        padding: 24,
        border: "1px solid rgba(168,85,247,.22)",
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 900,
          color: "white",
          marginBottom: 24,
        }}
      >
        Character Stats
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ color: "#a855f7", fontWeight: 800 }}>
          Item Level
        </div>

        <div
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: getIlvlColor(selectedCharacter.ilvl),
          }}
        >
          {selectedCharacter.ilvl}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ color: "#38bdf8", fontWeight: 800 }}>
          Raider.IO Score
        </div>

        <div
          style={{
            fontSize: 38,
            fontWeight: 900,
            color:
              selectedCharacter.mythic_plus_color ||
              "#38bdf8",
          }}
        >
          {selectedCharacter.mythic_plus_score || 0}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ color: "#f0abfc", fontWeight: 800 }}>
          Raid Progress
        </div>

        <div
          style={{
            fontSize: 38,
            fontWeight: 900,
            color: "#f0abfc",
          }}
        >
          {selectedCharacter.progress || "0/9"}
        </div>
      </div>
    </div>
  </div>
)}
        </main>

 {isOwnProfile && (
  <aside
    style={{
      ...rightbar,
      display: isMobile ? "none" : "block",
    }}
  >
          <InfoCard title="HOW IT WORKS">
            <Legend color="#22c55e" title="Available" text="You can sign up for HC and Mythic runs." />
            <Legend color="#eab308" title="Saved" text="You've completed a finished run this week." />
            <Legend color="#ef4444" title="Finished" text="Character is locked until reset." />
          </InfoCard>

          <InfoCard title="SERVER CLOCK">
            <div style={resetTime}>
  {time.toLocaleTimeString("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })}
</div>
            <p style={mutedText}>Server Time</p>
            <div style={{ marginTop: 12, color: "#d946ef", fontWeight: 900 }}>
              Reset: Wednesday 5:00 AM ST
            </div>
          </InfoCard>

          <InfoCard title="CHARACTER SUMMARY">
            <Summary label="Total Characters" value={characters.length} />
         <Summary
  label="Available"
  value={
    characters.filter(
      (char) =>
        !savedStatus[char.id]?.hc &&
        !savedStatus[char.id]?.mythic
    ).length
  }
  color="#22c55e"
/>
<Summary
  label="Saved (HC)"
  value={Object.values(savedStatus).filter((s) => s.hc).length}
  color="#ef4444"
/>

<Summary
  label="Saved (Mythic)"
  value={Object.values(savedStatus).filter((s) => s.mythic).length}
  color="#ef4444"
/>
            <Summary
              label="Total Item Level"
              
              value={characters.reduce((a, b) => a + b.ilvl, 0)}
              color="#d946ef"
            />
          </InfoCard>
        </aside>
        )}
</div>

<div
  style={{
    maxWidth: 1480,
margin: "30px auto 40px auto",
    marginTop: 30,
    marginBottom: 40,
    background: `${currentTheme.primary}33`,
    backdropFilter: "blur(12px)",
    border: `1px solid ${currentTheme.secondary}66`,
    boxShadow: `0 0 30px ${currentTheme.secondary}33`,
    borderRadius: 20,
    padding: 24,
  }}
>
  <div
  style={{
    display: "flex",
    justifyContent: "center",
    marginBottom: 18,
  }}
>
  <div
    style={{
      padding: "10px 22px",
      borderRadius: 14,
      background: `${currentTheme.primary}55`,
      border: `1px solid ${currentTheme.secondary}66`,
      boxShadow: `0 0 20px ${currentTheme.secondary}33`,
      color: "white",
      fontWeight: 900,
      fontSize: 18,
      backdropFilter: "blur(10px)",
    }}
  >
    👁 {visitorCount} Visitors
  </div>
</div>
  <h2
    style={{
      textAlign: "center",
      fontSize: 30,
      fontWeight: 900,
      marginBottom: 22,
      color: "white",
      textShadow: `0 0 18px ${currentTheme.secondary}`,
    }}
  >
    Profile Comments
  </h2>

  <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
    <input
      value={newComment}
      onChange={(e) => setNewComment(e.target.value)}
      placeholder="Write a comment..."
      style={{
        flex: 1,
        height: 52,
        borderRadius: 14,
        border: `1px solid ${currentTheme.secondary}55`,
        background: "rgba(0,0,0,.45)",
        color: "white",
        padding: "0 18px",
      }}
    />

    <button onClick={submitComment} style={normalViewBtn}>
      Post
    </button>
  </div>

  <div style={{ display: "grid", gap: 16 }}>
    {comments.map((comment) => (
      <div
        key={comment.id}
        style={{
          padding: 18,
          borderRadius: 16,
          background: "rgba(255,255,255,.03)",
          border: `1px solid ${currentTheme.secondary}33`,
        }}
      >
        <b>{comment.commenter_name}</b>
        <div style={{ marginTop: 8 }}>{comment.comment}</div>
      </div>
    ))}
  </div>
</div>
{hoveredItem && (
  <div
    style={{
      position: "fixed",
left: tooltipPos.x,
top: tooltipPos.y,
      zIndex: 9999,
      width: 300,
      padding: 16,
      borderRadius: 12,
      background: "rgba(5,5,12,.96)",
      border: `1px solid ${getItemBorder(hoveredItem)}`,
      boxShadow: `0 0 28px ${getItemBorder(hoveredItem)}88`,
      pointerEvents: "none",
    }}
  >
    <div
      style={{
        color: getItemBorder(hoveredItem),
        fontSize: 18,
        fontWeight: 900,
        marginBottom: 8,
      }}
    >
      {hoveredItem.name}
    </div>

    <div style={{ color: "#facc15", fontWeight: 900 }}>
      Item Level {hoveredItem.item_level}
    </div>
{/* ENCHANT */}
{hoveredItem.enchant && (
  <div
    style={{
      color: "#1eff00",
      fontWeight: 800,
      marginTop: 10,
      fontSize: 14,
    }}
  >
    ✨ Enchanted
  </div>
)}

{/* GEMS */}
{hoveredItem.gems?.length > 0 && (
  <div
    style={{
      color: "#38bdf8",
      fontWeight: 800,
      marginTop: 8,
      fontSize: 14,
    }}
  >
    💎 {hoveredItem.gems.length} Gem Socket
  </div>
)}
  </div>
)}
{specPopup && (
  <div style={popupOverlay}>
    <div
      style={{
        width: 500,
        background: "rgba(10,10,20,.98)",
        border: "1px solid rgba(168,85,247,.4)",
        borderRadius: 20,
        padding: 24,
      }}
    >
      <h2
        style={{
          fontSize: 28,
          fontWeight: 900,
          marginBottom: 20,
        }}
      >
        Change Spec
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {getSpecsByClass(specPopup.class).map((spec) => (
          <button
            key={spec}
            onClick={() => setSelectedSpec(spec)}
            style={{
              padding: 18,
              borderRadius: 14,
              border:
                selectedSpec === spec
                  ? "2px solid #d946ef"
                  : "1px solid rgba(255,255,255,.1)",

              background:
                selectedSpec === spec
                  ? "rgba(168,85,247,.25)"
                  : "rgba(255,255,255,.03)",

              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {spec}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 12,
        }}
      >
        <button
          onClick={() => setSpecPopup(null)}
          style={popupCancelBtn}
        >
          Cancel
        </button>

        <button
          onClick={updateCharacterSpec}
          style={popupOkBtn}
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
)}
      {popup && (
        <div style={popupOverlay}>
          <div style={popupBox}>
            <div style={popupIcon}>☠</div>

            <h2 style={popupTitle}>{popup.title}</h2>

            <p style={popupText}>{popup.message}</p>

            <div style={popupActions}>
              {popup.onConfirm && (
                <button
                  style={popupCancelBtn}
                  onClick={() => setPopup(null)}
                >
                  Cancel
                </button>
              )}

              <button
                style={
                  popup.type === "danger"
                    ? popupDangerBtn
                    : popupOkBtn
                }
                onClick={() => {
                  popup.onConfirm?.();
                  setPopup(null);
                }}
              >
                {popup.confirmText || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
)}
    </div>
  </div>
  );
}

function SmallTitle({ children }: { children: React.ReactNode }) {
  return <div style={smallTitle}>{children}</div>;
}
function getItemBorder(item: any) {
  const quality = item?.item_quality?.toLowerCase?.() || "";

  if (quality.includes("legendary")) return "#ff8000";
  if (quality.includes("epic")) return "#a335ee";
  if (quality.includes("rare")) return "#0070dd";
  if (quality.includes("uncommon")) return "#1eff00";

  return "rgba(217,70,239,.85)";
}
function StatusCard({ saved }: { saved: boolean }) {
  return (
    <div style={saved ? savedBox : availableBox}>
      <div style={{ fontWeight: 900, color: saved ? "#ff6b6b" : "#4ade80" }}>
        {saved ? "Saved" : "Available"}
      </div>
      <div style={statusText}>
        {saved ? "Finished\nReturns Wednesday" : "Can sign up"}
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={infoCard}>
      <h3 style={infoTitle}>{title}</h3>
      {children}
    </div>
  );
}

function Legend({ color, title, text }: { color: string; title: string; text: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ color, fontSize: 20, fontWeight: 900 }}>• {title}</div>
      <p style={mutedText}>{text}</p>
    </div>
  );
}

function Summary({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={summaryRow}>
      <span>{label}</span>
      <b style={{ color: color || "white" }}>{value}</b>
    </div>
  );
}

function getClassColor(className: string) {
  const colors: Record<string, string> = {
    "Death Knight": "#C41E3A",
    "Demon Hunter": "#A330C9",
    Druid: "#FF7C0A",
    Evoker: "#33937F",
    Hunter: "#AAD372",
    Mage: "#3FC7EB",
    Monk: "#00FF98",
    Paladin: "#F58CBA",
    Priest: "#FFFFFF",
    Rogue: "#FFF468",
    Shaman: "#0070DD",
    Warlock: "#8788EE",
    Warrior: "#C69B6D",
  };

  return colors[className] || "#ffffff";
}

function getIlvlColor(ilvl: number) {
  if (ilvl >= 280) return "#c026d3";
  if (ilvl >= 275) return "#0ea5e9";
  return "#9ca3af";
}
function getSpecsByClass(className: string) {
  const specs: Record<string, string[]> = {
    "Death Knight": ["Blood", "Frost", "Unholy"],
    "Demon Hunter": ["Havoc", "Vengeance", "devourer"],
    "Druid": ["Balance", "Feral", "Guardian", "Restoration"],
    "Evoker": ["Devastation", "Preservation", "Augmentation"],
    "Hunter": ["Beast Mastery", "Marksmanship", "Survival"],
    "Mage": ["Arcane", "Fire", "Frost"],
    "Monk": ["Brewmaster", "Mistweaver", "Windwalker"],
    "Paladin": ["Holy", "Protection", "Retribution"],
    "Priest": ["Discipline", "Holy", "Shadow"],
    "Rogue": ["Assassination", "Outlaw", "Subtlety"],
    "Shaman": ["Elemental", "Enhancement", "Restoration"],
    "Warlock": ["Affliction", "Demonology", "Destruction"],
    "Warrior": ["Arms", "Fury", "Protection"],
  };

  return specs[className] || [];
}
function getClassIcon(className: string, spec?: string) {
  const key = `${spec || ""} ${className}`.toLowerCase().trim();

  const icons: Record<string, string> = {
    "blood death knight": "/icons/deathknight-blood.png",
    "frost death knight": "/icons/deathknight-frost.png",
    "unholy death knight": "/icons/deathknight-unholy.png",
    "havoc demon hunter": "/icons/demonhunter-havoc.png",
    "vengeance demon hunter": "/icons/demonhunter-vengeance.png",
    "devourer demon hunter": "/icons/demonhunter-devourer.png",
    "balance druid": "/icons/druid-balance.png",
    "feral druid": "/icons/druid-feral.png",
    "guardian druid": "/icons/druid-guardian.png",
    "restoration druid": "/icons/druid-restoration.png",
    "devastation evoker": "/icons/evoker-devastation.png",
    "preservation evoker": "/icons/evoker-preservation.png",
    "augmentation evoker": "/icons/evoker-augmentation.png",
    "beast mastery hunter": "/icons/hunter-beastmastery.png",
    "marksmanship hunter": "/icons/hunter-marksmanship.png",
    "survival hunter": "/icons/hunter-survival.png",
    "arcane mage": "/icons/mage-arcane.png",
    "fire mage": "/icons/mage-fire.png",
    "frost mage": "/icons/mage-frost.png",
    "brewmaster monk": "/icons/monk-brewmaster.png",
    "mistweaver monk": "/icons/monk-mistweaver.png",
    "windwalker monk": "/icons/monk-windwalker.png",
    "holy paladin": "/icons/paladin-holy.png",
    "protection paladin": "/icons/paladin-protection.png",
    "retribution paladin": "/icons/paladin-retribution.png",
    "discipline priest": "/icons/priest-discipline.png",
    "holy priest": "/icons/priest-holy.png",
    "shadow priest": "/icons/priest-shadow.png",
    "assassination rogue": "/icons/rogue-assassination.png",
    "outlaw rogue": "/icons/rogue-outlaw.png",
    "subtlety rogue": "/icons/rogue-subtlety.png",
    "elemental shaman": "/icons/shaman-elemental.png",
    "enhancement shaman": "/icons/shaman-enhancement.png",
    "restoration shaman": "/icons/shaman-restoration.png",
    "affliction warlock": "/icons/warlock-affliction.png",
    "demonology warlock": "/icons/warlock-demonology.png",
    "destruction warlock": "/icons/warlock-destruction.png",
    "arms warrior": "/icons/warrior-arms.png",
    "fury warrior": "/icons/warrior-fury.png",
    "protection warrior": "/icons/warrior-protection.png",
  };

  const classIcons: Record<string, string> = {
    "Death Knight": "/icons/deathknight-blood.png",
    "Demon Hunter": "/icons/demonhunter-havoc.png",
    Druid: "/icons/druid-balance.png",
    Evoker: "/icons/evoker-devastation.png",
    Hunter: "/icons/hunter-beastmastery.png",
    Mage: "/icons/mage-frost.png",
    Monk: "/icons/monk-brewmaster.png",
    Paladin: "/icons/paladin-protection.png",
    Priest: "/icons/priest-holy.png",
    Rogue: "/icons/rogue-assassination.png",
    Shaman: "/icons/shaman-elemental.png",
    Warlock: "/icons/warlock-destruction.png",
    Warrior: "/icons/warrior-protection.png",
  };

  return icons[key] || classIcons[className] || "/icons/warrior-protection.png";
}

const page: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  fontFamily: "Arial, sans-serif",
  background: "transparent",
  position: "relative",
  zIndex: 1,
};

const topbar: React.CSSProperties = {
  height: 96,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 24px",
  background: "rgba(5,5,12,0.35)",
backdropFilter: "blur(6px)",
  borderBottom: "1px solid rgba(168,85,247,0.28)",
  position: "sticky",
  top: 0,
  zIndex: 50,
};

const logoWrap: React.CSSProperties = { display: "flex", alignItems: "center" };

const logo: React.CSSProperties = {
  width: 230,
  height: 130,
  objectFit: "contain",
};

const nav: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const navLink: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,0.45)",
 background: "linear-gradient(90deg,#7c3aed,#d946ef)",
  color: "#f3e8ff",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 14,
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 42,
  boxSizing: "border-box",
  transition: "all 0.2s ease",
  cursor: "pointer",
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 1fr 260px",
  gap: 18,
  padding: 18,
};

const sidebar: React.CSSProperties = {
  background: "rgba(7,10,20,0.88)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 18,
  height: "fit-content",
};

const main: React.CSSProperties = {};

const rightbar: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const smallTitle: React.CSSProperties = {
  color: "#8b5cf6",
  fontWeight: 900,
  marginBottom: 14,
  fontSize: 13,
  letterSpacing: 1,
};

const sideItem: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  marginBottom: 6,
  color: "#c7c7d1",
  fontWeight: 700,
};

const sideActive: React.CSSProperties = {
  ...sideItem,
  background: "rgba(139,92,246,0.24)",
  color: "white",
};

const discordBox: React.CSSProperties = {
  marginTop: 28,
  background: "rgba(139,92,246,0.12)",
  border: "1px solid rgba(139,92,246,0.4)",
  borderRadius: 14,
  padding: 18,
};

const mutedSmall: React.CSSProperties = {
  color: "#bcbccc",
  fontSize: 13,
  lineHeight: 1.5,
};

const discordBtn: React.CSSProperties = {
  width: "100%",
  marginTop: 16,
  height: 42,
  border: 0,
  borderRadius: 10,
  background: "linear-gradient(90deg,#7c3aed,#c026d3)",
  color: "white",
  fontWeight: 900,
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 18,
  alignItems: "center",
};

const title: React.CSSProperties = {
  fontSize: 38,
  margin: 0,
  fontWeight: 900,
};

const subtitle: React.CSSProperties = {
  color: "#b9b4c9",
  marginTop: 6,
};

const newCharacterBtn: React.CSSProperties = {
  height: 46,
  padding: "0 24px",
  borderRadius: 12,
  border: "1px solid #9333ea",
  background: "rgba(147,51,234,0.16)",
  color: "#d8b4fe",
  fontWeight: 900,
};

const addBox: React.CSSProperties = {
  background: "rgba(7,10,20,0.84)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 14,
  padding: 16,
  marginBottom: 14,
  display: "flex",
  gap: 12,
};

const input: React.CSSProperties = {
  height: 46,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.55)",
  padding: "0 14px",
  color: "white",
  outline: "none",
};

const addBtn: React.CSSProperties = {
  borderRadius: 10,
  border: 0,
  background: "linear-gradient(90deg,#9333ea,#d946ef)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 12px rgba(217,70,239,0.35)",
  transition: "all 0.2s ease",
};

const tabs: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 14,
};

const tabActive: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "12px 28px",
  background: "#5b21b6",
  color: "white",
  fontWeight: 900,
};

const tab: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 8,
  padding: "12px 28px",
  background: "rgba(0,0,0,0.4)",
  color: "#aaa",
  fontWeight: 800,
};

const table: React.CSSProperties = {
  background: "rgba(4,9,18,0.94)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 16,
  overflow: "hidden",
};

const tableHead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 120px 80px 1fr 1fr 1fr 80px",
  padding: "14px 16px",
  fontSize: 11,
  color: "#d6bfff",
  fontWeight: 900,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 120px 80px 1fr 1fr 1fr 80px",
  alignItems: "center",
  padding: "12px 16px",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  transition: "all 0.22s ease",
position: "relative",
border: "1px solid rgba(255,255,255,0.05)",
borderRadius: 12,
};

const characterCell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const charIcon: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 10,
  objectFit: "cover",
};

const charName: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
};

const realmText: React.CSSProperties = {
  color: "#bcbcbc",
  marginTop: 4,
  fontWeight: 700,
};

const ilvlText: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 900,
};

const progressCell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const progressText: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
  color: "#a335ee",
};

const scoreText: React.CSSProperties = {
  color: "#bcbcbc",
  marginTop: 3,
};

const roleIcon: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  objectFit: "cover",
};

const availableBox: React.CSSProperties = {
  background: "rgba(0,120,60,0.22)",
  border: "1px solid rgba(0,255,120,0.18)",
  borderRadius: 10,
  padding: "9px 12px",
  width: "calc(100% - 12px)",
  boxSizing: "border-box",
};

const savedBox: React.CSSProperties = {
  background: "rgba(120,0,0,0.35)",
  border: "1px solid rgba(255,80,80,0.3)",
  borderRadius: 10,
  padding: "9px 12px",
  width: "calc(100% - 12px)",
  boxSizing: "border-box",
};

const statusText: React.CSSProperties = {
  color: "#d0d0d0",
  fontSize: 13,
  lineHeight: 1.4,
  whiteSpace: "pre-line",
};

const deleteBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: 0,
  background: "transparent",
  color: "#999",
  cursor: "pointer",
  fontSize: 22,
};

const note: React.CSSProperties = {
  padding: 14,
  color: "#a6a6a6",
  fontSize: 12,
};

const infoCard: React.CSSProperties = {
  background: "rgba(7,10,20,0.88)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 16,
  padding: 20,
};

const infoTitle: React.CSSProperties = {
  margin: "0 0 18px",
};

const mutedText: React.CSSProperties = {
  marginTop: 8,
  color: "#bcbcbc",
  lineHeight: 1.5,
};

const resetTime: React.CSSProperties = {
  fontSize: 34,
  color: "#d946ef",
  fontWeight: 900,
};

const profileNav: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 14,
  height: 34,
};

const profileAvatar: React.CSSProperties = {
  width: 80,
  height: 80,
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid #9333ea",
  boxShadow: "0 0 16px rgba(168,85,247,0.75)",
};

const summaryRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 14,
  color: "#d1d1d1",
  fontWeight: 700,
};
const balanceBox: React.CSSProperties = {
  marginTop: 18,
  background: "linear-gradient(180deg, rgba(12,22,36,0.95), rgba(6,12,22,0.95))",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 14,
  padding: 18,
  boxShadow: "inset 0 0 20px rgba(255,255,255,0.03)",
};

const balanceTitle: React.CSSProperties = {
  color: "#9ca3af",
  fontWeight: 900,
  fontSize: 14,
  marginBottom: 18,
};

const balanceLabel: React.CSSProperties = {
  color: "#e5e7eb",
  fontSize: 16,
  marginBottom: 10,
};

const balanceAmount: React.CSSProperties = {
  color: "#facc15",
  fontSize: 24,
  fontWeight: 900,
  marginBottom: 18,
  textShadow: "0 0 12px rgba(250,204,21,0.35)",
  whiteSpace: "nowrap",
};

const paymentBtn: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: "1px solid rgba(139,92,246,0.35)",
  borderRadius: 10,
  background: "linear-gradient(90deg,#3b0764,#6d28d9)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 14px rgba(124,58,237,0.35)",
};
const actionCell: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};
const actionBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 9,
  border: "1px solid rgba(217,70,239,0.75)",
  background: "rgba(147,51,234,0.22)",
  color: "#f5d0fe",
  cursor: "pointer",
  fontSize: 20,
  fontWeight: 900,
  boxShadow: "0 0 14px rgba(217,70,239,0.45)",
};



const trashBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 9,
  border: "1px solid rgba(239,68,68,0.45)",
  background: "rgba(127,29,29,0.35)",
  color: "#f87171",
  cursor: "pointer",
  fontSize: 16,
};
const popupOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  background: "rgba(0,0,0,0.76)",
  backdropFilter: "blur(7px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const popupBox: React.CSSProperties = {
  width: 760,
  maxWidth: "90vw",
  padding: "52px 46px",
  borderRadius: 22,
  textAlign: "center",
  background:
    "linear-gradient(180deg, rgba(16,10,35,0.98), rgba(5,8,18,0.98))",
  border: "1px solid rgba(168,85,247,0.75)",
  boxShadow: "0 0 70px rgba(168,85,247,0.45)",
};

const popupIcon: React.CSSProperties = {
  fontSize: 52,
  color: "#c084fc",
  marginBottom: 18,
  textShadow: "0 0 24px rgba(168,85,247,0.9)",
};

const popupTitle: React.CSSProperties = {
  fontSize: 42,
  fontWeight: 900,
  margin: "0 0 18px",
};

const popupText: React.CSSProperties = {
  color: "#d1d5db",
  fontSize: 18,
  lineHeight: 1.6,
  marginBottom: 30,
};

const popupActions: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 18,
};

const popupOkBtn: React.CSSProperties = {
  width: 220,
  height: 54,
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,0.8)",
  background: "rgba(0,0,0,0.4)",
  color: "white",
  fontWeight: 900,
  fontSize: 18,
  cursor: "pointer",
  boxShadow: "0 0 18px rgba(168,85,247,0.35)",
};

const popupCancelBtn: React.CSSProperties = {
  ...popupOkBtn,
  width: 180,
};

const popupDangerBtn: React.CSSProperties = {
  ...popupOkBtn,
  background: "linear-gradient(90deg,#9f1239,#e11d48)",
  border: "1px solid rgba(244,63,94,0.9)",
  boxShadow: "0 0 24px rgba(244,63,94,0.45)",
};
const mainCharacterBadge: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  alignItems: "center",
  gap: 24,

  padding: "22px 34px",

  borderRadius: 24,

  border: "2px solid rgba(250,204,21,.75)",

  background:
    "linear-gradient(135deg, rgba(50,35,0,.88), rgba(18,10,35,.96))",

  boxShadow:
    "0 0 35px rgba(250,204,21,.38), 0 0 24px rgba(168,85,247,.18)",

  width: "fit-content",

  transition: "all .22s ease",
  cursor: "default",
};

const mainCharacterAvatar: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 18,
  objectFit: "cover",
  border: "2px solid rgba(250,204,21,.75)",
  boxShadow: "0 0 18px rgba(250,204,21,.45)",
};

const mainCharacterLabel: React.CSSProperties = {
  fontSize: 10,
  color: "#facc15",
  fontWeight: 900,
};

const mainCharacterName: React.CSSProperties = {
  fontSize: 38,
  color: "#fff",
  fontWeight: 900,
  lineHeight: 1,
  textShadow: "0 0 14px rgba(255,255,255,.18)",
};
const experienceBadge: React.CSSProperties = {
  marginLeft: 14,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "8px 14px",
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,.7)",
  background: "rgba(88,28,135,.25)",
  boxShadow: "0 0 16px rgba(168,85,247,.3)",
};

const experienceLabel: React.CSSProperties = {
  fontSize: 10,
  color: "#c084fc",
  fontWeight: 900,
};

const experienceValue: React.CSSProperties = {
  fontSize: 42,
  color: "#f0abfc",
  fontWeight: 900,
  lineHeight: 1,
  textShadow: "0 0 18px rgba(217,70,239,.45)",
};
const rioBadge: React.CSSProperties = {
  marginLeft: 12,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: "8px 14px",
  borderRadius: 12,
  border: "1px solid rgba(59,130,246,.7)",
  background: "rgba(30,64,175,.22)",
  boxShadow: "0 0 16px rgba(59,130,246,.35)",
};

const rioValue: React.CSSProperties = {
  fontSize: 42,
  color: "#38bdf8",
  fontWeight: 900,
  lineHeight: 1,
  textShadow: "0 0 18px rgba(56,189,248,.45)",
};
const mainInfoBlock: React.CSSProperties = {
  minWidth: 95,
};

const statDivider: React.CSSProperties = {
  width: 1,
  height: 72,
  background: "rgba(255,255,255,.14)",
};

const miniStat: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const miniStatLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#c4b5fd",
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 1,
};
const showcaseStatBox: React.CSSProperties = {
  padding: 24,
  borderRadius: 20,
  background: "rgba(8,8,20,.75)",
  border: "1px solid rgba(168,85,247,.25)",
  boxShadow: "inset 0 0 24px rgba(168,85,247,.08)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
  color: "#c084fc",
  fontWeight: 800,
  fontSize: 18,
};
if (typeof window !== "undefined") {
  const style = document.createElement("style");
style.innerHTML = `
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
    100% { transform: translateY(0px); }
  }

  @keyframes pulseFog {
    0% {
      opacity: 0.45;
      transform: scale(0.96);
    }

    50% {
      opacity: 0.9;
      transform: scale(1.05);
    }

    100% {
      opacity: 0.45;
      transform: scale(0.96);
    }
  }
`;

  document.head.appendChild(style);
}
const gearSlot: React.CSSProperties = {
  width: 72,
  height: 72,
  borderRadius: 12,
  border: "2px solid rgba(217,70,239,.85)",
  background: "rgba(0,0,0,.72)",
  boxShadow:
    "0 0 18px rgba(217,70,239,.45), inset 0 0 12px rgba(255,255,255,.08)",
  objectFit: "cover",
  transition: "all .18s ease",
  cursor: "pointer",
};
const activeViewBtn: React.CSSProperties = {
  padding: "14px 34px",
  borderRadius: 18,
  border: "1px solid #facc15",
  background: "linear-gradient(180deg,#6d28d9,#2e1065)",
  color: "white",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
  minWidth: 210,
};

const normalViewBtn: React.CSSProperties = {
  padding: "14px 34px",
  borderRadius: 18,
  border: "1px solid rgba(168,85,247,.35)",
  background: "rgba(8,5,20,.82)",
  color: "#d8b4fe",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
  minWidth: 210,
};