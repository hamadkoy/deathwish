"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useRouter, useSearchParams } from "next/navigation";
type Run = {
  id: number;
  title: string;
  day: string;
  time: string;
  week?: number;
  notes?: string;
  run_date?: string;
  ilvl_required?: number;
  finished?: boolean;
  signup_open_at?: string;
  healer_limit?: number;
dps_limit?: number;
};

type Signup = {
  id: number;
  player: string;
  role: string;
  run_id: number;
  character_id?: number;
  avatar_url?: string;
  created_at?: string;
  discord_id?: string;
  attendance?: "pending" | "present" | "missing";
};

type Profile = {
  user_id: string;
  discord_name: string;
  avatar_url: string;
  site_role?: "viewer" | "booster" | "officer" | "admin";
};

type Character = {
  id: number;
  user_id?: string;
  name: string;
  realm: string;
  class: string;
  spec: string;
  ilvl?: number;
  progress?: string;
};

function getCurrentWeek() {
  const start = new Date("2026-03-18T07:00:00");
  const now = new Date();

  const diffMs = now.getTime() - start.getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const week = Math.floor(diffMs / weekMs) + 1;

  return Math.max(week, 1);
}

function getShortWeekRange(week: number) {
  const start = new Date("2026-03-18T07:00:00");
  const weekStart = new Date(
    start.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000
  );
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  return `${weekStart.getMonth() + 1}/${weekStart.getDate()} → ${
    weekEnd.getMonth() + 1
  }/${weekEnd.getDate()}`;
}

function formatRunDate(date: string) {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
function getRunDateFromWeekAndDay(week: number, day: string) {
  const start = new Date("2026-03-18T07:00:00");

  const dayOffset: Record<string, number> = {
    Wednesday: 0,
    Thursday: 1,
    Friday: 2,
    Saturday: 3,
    Sunday: 4,
    Monday: 5,
    Tuesday: 6,
  };

  const date = new Date(
    start.getTime() +
      (week - 1) * 7 * 24 * 60 * 60 * 1000 +
      (dayOffset[day] || 0) * 24 * 60 * 60 * 1000
  );

  return date.toISOString().split("T")[0];
}
function formatCountdown(targetDate: string) {
  const target = new Date(targetDate).getTime();
  const diff = Math.max(target - Date.now(), 0);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  return `${hours}h ${minutes}m ${seconds}s`;
}
function formatChatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(
    diffMs / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 1) {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (diffDays < 7) {
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
    });
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function formatChatDayLabel(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";

  if (diffDays === 1) return "Yesterday";

  if (diffDays < 7) {
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
    });
  }

  return date.toLocaleDateString("en-GB");
}
export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
const [chatInput, setChatInput] = useState("");
const [chatOpen, setChatOpen] = useState(false);
const chatBottomRef = useRef<HTMLDivElement | null>(null);
const [showAccessPopup, setShowAccessPopup] = useState(false);

const [mainCharacterInput, setMainCharacterInput] = useState("");
const [mainRealmInput, setMainRealmInput] = useState("Kazzak");
const [raiderIoInput, setRaiderIoInput] = useState("");
const [applicationNote, setApplicationNote] = useState("");

const [signupApproved, setSignupApproved] = useState(false);
  const [selectedCharacter, setSelectedCharacter] =
    useState<Character | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number>(getCurrentWeek());
  const selectedWeekRef = useRef(selectedWeek);

useEffect(() => {
  selectedWeekRef.current = selectedWeek;
}, [selectedWeek]);
const [weeks, setWeeks] = useState<number[]>([]);

useEffect(() => {
  async function loadWeeks() {
    const { data, error } = await supabase
      .from("runs")
      .select("week");

    if (error) return;

    const uniqueWeeks = Array.from(
      new Set(
        (data || [])
          .map((r) => r.week)
          .filter(Boolean)
      )
    ).sort((a, b) => a - b);

    if (uniqueWeeks.length > 0) {
      setWeeks(uniqueWeeks);
    } else {
      setWeeks([1]);
    }
  }

  loadWeeks();
}, []);
  const [europeTime, setEuropeTime] = useState("");
  const [europeDay, setEuropeDay] = useState("");
  const [showCreateRun, setShowCreateRun] = useState(false);

const [popup, setPopup] = useState<{
  title: string;
  message: string;
  type?: "error" | "success";
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
} | null>(null);

  const [raidFilter, setRaidFilter] =
    useState<"All" | "HC" | "Mythic">("All");
const [dayFilter, setDayFilter] = useState<string>("All");
  const [newRunIlvl, setNewRunIlvl] = useState("");
  const [newRunTitle, setNewRunTitle] = useState("");
  const [newRunDay, setNewRunDay] = useState("Thursday");
  const [newRunTime, setNewRunTime] = useState("19:00 ST");
  const [newRunSignupOpenAt, setNewRunSignupOpenAt] = useState("");
  const [newRunNotes, setNewRunNotes] = useState("");
  const [adminAddOpen, setAdminAddOpen] = useState(false);
const [adminAddRunId, setAdminAddRunId] = useState<number | null>(null);
const [adminAddRole, setAdminAddRole] = useState("");
const [adminAddName, setAdminAddName] = useState("");
const [nowTick, setNowTick] = useState(Date.now());
const [newRunHealers, setNewRunHealers] = useState("3");
const [newRunDps, setNewRunDps] = useState("10");
const [adminAddClass, setAdminAddClass] = useState("Druid");
const [adminAddSpec, setAdminAddSpec] = useState("Guardian");
  const router = useRouter();
  const searchParams = useSearchParams();
  const ADMIN_IDS = ["207929624888344576"];

  const discordId =
    user?.user_metadata?.provider_id || user?.user_metadata?.sub;

 const isAdmin =
  ADMIN_IDS.includes(discordId) ||
  profile?.site_role === "admin";
const isOfficer = profile?.site_role === "officer";

const canFinishRun = isAdmin || isOfficer;
const canUseRunCards =
  signupApproved &&
  ["booster", "officer", "admin"].includes(profile?.site_role || "");
  const [editingRun, setEditingRun] = useState<Run | null>(null);
  const [editRunTitle, setEditRunTitle] = useState("");
  const [editRunDay, setEditRunDay] = useState("");
  const [editRunTime, setEditRunTime] = useState("");
  const [editRunDate, setEditRunDate] = useState("");

  const [editRunNotes, setEditRunNotes] = useState("");
  const [editRunIlvl, setEditRunIlvl] = useState("");
const [editRunHealers, setEditRunHealers] = useState("3");
const [editRunDps, setEditRunDps] = useState("10");
const [editRunSignupOpenAt, setEditRunSignupOpenAt] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

async function loadRuns(weekToLoad = selectedWeek) {
  const { data, error } = await supabase
    .from("runs")
    .select("*")
    .eq("week", weekToLoad)
    .order("run_date", { ascending: true })
    .order("time", { ascending: true });

  if (error) return alert(error.message);

  setRuns(data || []);
}

  async function loadSignups() {
    const { data, error } = await supabase.from("signups").select("*");
    if (error) return alert(error.message);
    setSignups(data || []);
  }

  async function loadCharacters(userId: string) {
    const { data, error } = await supabase
      .from("characters")
      .select("*")
      .eq("user_id", userId)
      .order("id");

    if (error) return alert(error.message);

    setCharacters(data || []);
    setSelectedCharacter(data?.[0] || null);
  }

  async function loadUserAndProfile() {
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      setUser(null);
      setProfile(null);
      setCharacters([]);
      setSelectedCharacter(null);
      return;
    }

    setUser(data.user);
await supabase.from("profiles").upsert({
  user_id: data.user.id,
  discord_name:
    data.user.user_metadata?.full_name ||
    data.user.user_metadata?.name ||
    data.user.user_metadata?.preferred_username ||
    "Unknown",
  avatar_url: data.user.user_metadata?.avatar_url || "",
});
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", data.user.id)
      .single();

    if (profileData) {
  setProfile(profileData);

  setSignupApproved(
    profileData.signup_approved === true
  );

  setMainCharacterInput(
    profileData.main_character || ""
  );

  setMainRealmInput(
    profileData.main_realm || "Kazzak"
  );

  setRaiderIoInput(
    profileData.raider_io || ""
  );
}

    await loadCharacters(data.user.id);
  }

  useEffect(() => {
    loadRuns();
    loadSignups();
    loadUserAndProfile();

const channel = supabase
  .channel("realtime-runs-and-signups")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "signups" },
    () => loadSignups()
  )
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "runs" },
() => {
  loadRuns(selectedWeekRef.current);
  loadSignups();
}
  )
  .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function updateClock() {
      const time = new Date().toLocaleTimeString("en-GB", {
        timeZone: "Europe/Paris",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

      setEuropeTime(time);
      const day = new Date().toLocaleDateString("en-GB", {
  timeZone: "Europe/Paris",
  weekday: "long",
});

setEuropeDay(day);
    }

    updateClock();

    const timer = setInterval(updateClock, 1000);

    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
  const timer = setInterval(() => {
    setNowTick(Date.now());
  }, 1000);

  return () => clearInterval(timer);
}, []);
useEffect(() => {
  chatBottomRef.current?.scrollIntoView({
    behavior: "smooth",
  });
}, [chatMessages, chatOpen]);
useEffect(() => {
  async function loadChat() {
    const { data } = await supabase
      .from("run_chat")
      .select("*")
      .order("created_at", { ascending: true });

    if (data) setChatMessages(data);
  }

  loadChat();

  const channel = supabase
    .channel("run-chat")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "run_chat",
      },
      (payload) => {
        setChatMessages((prev) => [
          ...prev,
          payload.new,
        ]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
useEffect(() => {
  loadRuns(selectedWeek);
  loadSignups();
}, [selectedWeek]);
useEffect(() => {
  if (searchParams.get("apply") === "true") {
    setShowAccessPopup(true);
  }
}, [searchParams]);
  function getSignupName() {
    if (!selectedCharacter) return null;
    return `${selectedCharacter.name} - ${selectedCharacter.spec} ${selectedCharacter.class}`;
  }

function getRequiredBossExp(title: string) {
  const match = title.match(/(\d+)\s*\/\s*9\s*(m|mythic|hc|heroic)/i);

  if (!match) return null;

  return {
    bosses: Number(match[1]),
    difficulty: match[2].toLowerCase().includes("h") ? "HC" : "M",
  };
}

function getCharacterBossExp(progress?: string) {
  const match = (progress || "0/9").match(/(\d+)\s*\/\s*9\s*(m|hc)?/i);

  return {
    bosses: Number(match?.[1] || 0),
    difficulty: (match?.[2] || "M").toUpperCase(),
  };
}
function getLimits(run: Run) {
  const isHC = run.title.toLowerCase().includes("hc");

  return {
    tank: 2,
    healer: run.healer_limit || (isHC ? 3 : 4),
    dps: run.dps_limit || (isHC ? 10 : 13),
    bench: 8,
    lootBody: 5,
  };
}

 async function addSignup(runId: number, role: string) {
  if (!user) {
    router.push("/login");
    return;
  }
const run = runs.find((r) => r.id === runId);

if (run?.finished) {
  setPopup({
    title: "Run Locked",
    message: "This run is finished, so signups are locked.",
    type: "error",
  });
  return;
}
  if (!canUseRunCards) {
    setShowAccessPopup(true);
    return;
  }

  if (!selectedCharacter) {
    alert("Select a character first.");
    return;
  }
if (
  role !== "Loot Body" &&
  run?.ilvl_required &&
  (selectedCharacter.ilvl || 0) < run.ilvl_required
) {
  setPopup({
    title: "Item Level Too Low",
    message: `This run requires ${run.ilvl_required}+ ilvl. Your selected character is ${selectedCharacter.ilvl || 0}.`,
    type: "error",
  });
  return;
}

if (role !== "Loot Body" && run) {
  const requiredExp = getRequiredBossExp(run.title);
  const characterExp = getCharacterBossExp(selectedCharacter.progress);

  if (
    requiredExp &&
    (characterExp.difficulty !== requiredExp.difficulty ||
      characterExp.bosses < requiredExp.bosses)
  ) {
    setPopup({
      title: "Boss Experience Too Low",
      message: `This run requires ${requiredExp.bosses}/9${requiredExp.difficulty} experience. ${selectedCharacter.name} has ${selectedCharacter.progress || "0/9"}.`,
      type: "error",
    });
    return;
  }
}
  const signupName = `${selectedCharacter.name} - ${selectedCharacter.spec} ${selectedCharacter.class}`;
  if (role !== "Loot Body" && run) {
  const requiredExp = getRequiredBossExp(run.title);
  const characterExp = getCharacterBossExp(selectedCharacter.progress);

  if (
    requiredExp &&
    (
      characterExp.difficulty !== requiredExp.difficulty ||
      characterExp.bosses < requiredExp.bosses
    )
  ) {
    setPopup({
      title: "Boss Experience Too Low",
      message: `This run requires ${requiredExp.bosses}/9${requiredExp.difficulty} experience. ${selectedCharacter.name} has ${selectedCharacter.progress || "0/9"}.`,
      type: "error",
    });

    return;
  }
}
if (role !== "Loot Body") {
  const alreadyInRun = signups.find(
    (s) =>
      s.run_id === runId &&
      s.role !== "Loot Body" &&
      s.discord_id === discordId
  );

  if (alreadyInRun) {
    setPopup({
      title: "Already Signed",
      message:
        "You already have a character signed for this run. Only Loot Body can use extra characters.",
      type: "error",
    });
    return;
  }
}
  const alreadySigned = signups.find(
    (s) =>
      s.run_id === runId &&
      s.character_id === selectedCharacter.id
  );

if (alreadySigned) {
  setPopup({
    title: "Already Signed",
    message: "This character is already signed for this run.",
    type: "error",
  });
  return;
}



  const { error } = await supabase
    .from("signups")
    .insert({
      player: signupName,
      role,
      run_id: runId,
      character_id: selectedCharacter.id,
      avatar_url: profile?.avatar_url || "",
      discord_id: discordId,
    });

  if (error) {
    alert(error.message);
    return;
  }

  await loadSignups();
} 


async function sendAccessApplication() {
  if (
    !mainCharacterInput.trim() ||
    !raiderIoInput.trim()
  ) {
    alert("Please fill required fields.");
    return;
  }
const { data: existingApplication } = await supabase
  .from("profiles")
  .select("applied_at")
  .eq("user_id", user.id)
  .single();

if (existingApplication?.applied_at) {
  const lastApplied = new Date(existingApplication.applied_at);
  const now = new Date();

  const diffDays =
    (now.getTime() - lastApplied.getTime()) /
    (1000 * 60 * 60 * 24);

  if (diffDays < 30) {
setPopup({
  title: "Application Cooldown",
  message:
    "You can only send 1 application every 30 days.",
  type: "error",
});

    return;
  }
}
  const { error } = await supabase
    .from("profiles")
    .update({
      main_character: mainCharacterInput,
      main_realm: mainRealmInput,
      raider_io: raiderIoInput,
      application_note: applicationNote,
      signup_approved: false,
      applied_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    alert(error.message);
    return;
  }

  setShowAccessPopup(false);

  setPopup({
    title: "Application Sent",
    message:
      "Your signup access request was sent to admins.",
  });
}
async function adminAddSignup(runId: number, role: string, playerName: string) {
  if (!isAdmin) return;

  if (!playerName.trim()) return;

  const { error } = await supabase.from("signups").insert({
    player: playerName.trim(),
    role,
    run_id: runId,
    character_id: null,
    avatar_url: "",
  });

  if (error) {
    alert(error.message);
    return;
  }

  await loadSignups();
}
  async function deleteRun(runId: number) {
setPopup({
  title: "Delete Run",
  message:
    "Are you sure you want to delete this run?\nThis will also delete all signups.",
  type: "error",
  confirmText: "DELETE",
  cancelText: "CANCEL",
  onConfirm: async () => {
    await supabase
      .from("signups")
      .delete()
      .eq("run_id", runId);

    const { error } = await supabase
      .from("runs")
      .delete()
      .eq("id", runId);

    if (error) {
      alert(error.message);
      return;
    }

await loadRuns(selectedWeekRef.current);
await loadSignups();
  },
});

return;


  }
async function finishRun(run: Run) {
  if (!canFinishRun) return;

  const { error } = await supabase
    .from("runs")
    .update({ finished: !run.finished })
    .eq("id", run.id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadRuns(selectedWeekRef.current);
}
  function openEditRun(run: Run) {
    setEditingRun(run);
    setEditRunTitle(run.title || "");
    setEditRunDay(run.day || "");
    setEditRunTime(run.time || "");
    setEditRunDate(run.run_date || "");
    setEditRunNotes(run.notes || "");
  }

  async function saveEditRun() {
    if (!editingRun) return;

    const { error } = await supabase
      .from("runs")
      .update({
        title: editRunTitle,
        day: editRunDay,
        time: editRunTime,
        run_date: editRunDate || null,
        notes: editRunNotes,
        ilvl_required: Number(editRunIlvl) || null,
healer_limit: Number(editRunHealers) || 3,
dps_limit: Number(editRunDps) || 10,
signup_open_at: editRunSignupOpenAt
  ? new Date(editRunSignupOpenAt).toISOString()
  : null,
      })
      .eq("id", editingRun.id);

    if (error) {
      alert(error.message);
      return;
    }

   setEditingRun(null);
await loadRuns(selectedWeekRef.current);
await loadSignups();
  }

  async function createRun() {
    if (!newRunTitle.trim()) {
      alert("Enter run title");
      return;
    }

    const { error } = await supabase.from("runs").insert([
      {
        title: newRunTitle,
        day: newRunDay,
        time: newRunTime,
        week: selectedWeek,
        notes: newRunNotes,
        run_date: getRunDateFromWeekAndDay(selectedWeek, newRunDay),
        ilvl_required: Number(newRunIlvl) || null,
        healer_limit: Number(newRunHealers) || 3,
        dps_limit: Number(newRunDps) || 10,
        signup_open_at: newRunSignupOpenAt
  ? new Date(newRunSignupOpenAt).toISOString()
  : null,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    setShowCreateRun(false);
    setNewRunTitle("");
    setNewRunDay("Thursday");
    setNewRunTime("19:00 ST");
    setNewRunNotes("");
    setNewRunIlvl("");
    setNewRunSignupOpenAt("");
    setNewRunHealers("3");
    setNewRunDps("10");
    await loadRuns(selectedWeekRef.current);
  }
async function sendChatMessage() {
  if (!chatInput.trim()) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    alert("Please login first.");
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase.from("run_chat").insert({
    user_id: user.id,
    discord_name:
      profile?.discord_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      "Unknown",
    avatar_url: profile?.avatar_url || "",
    message: chatInput.trim(),
  });

  if (error) {
    alert(error.message);
    return;
  }

  setChatInput("");
}
const [banishLogs, setBanishLogs] = useState<any[]>([]);
const [banishActive, setBanishActive] = useState(false);
const [banishOpen, setBanishOpen] = useState(false);
useEffect(() => {
  const saved = localStorage.getItem("banishLogs");

  if (saved) {
    setBanishLogs(JSON.parse(saved));
  }
}, []);

useEffect(() => {
  localStorage.setItem(
    "banishLogs",
    JSON.stringify(banishLogs)
  );
}, [banishLogs]);

async function removeSignup(signupId: number) {
  const signup = signups.find((s) => s.id === signupId);
  const run = runs.find((r) => r.id === signup?.run_id);
if (run?.finished) {
  setPopup({
    title: "Run Locked",
    message: "This run is finished, so players cannot unsign.",
    type: "error",
  });
  return;
}
  const now = new Date();

  const signedAt = signup?.created_at
    ? new Date(signup.created_at)
    : null;

  const signedForMs = signedAt
    ? now.getTime() - signedAt.getTime()
    : 0;

  const signedForMoreThanOneHour = signedForMs >= 60 * 60 * 1000;

  if (banishActive && signup && run && signedForMoreThanOneHour) {
    const newLog = {
      id: Date.now(),
      player: signup.player,
      runId: run.id,
      runTitle: run.title,
      unsignedAt: now.toLocaleString("en-GB"),
    };

    setBanishLogs((prev) => [newLog, ...prev]);
  }

  const { error } = await supabase
    .from("signups")
    .delete()
    .eq("id", signupId);

  if (error) return alert(error.message);

  await loadSignups();
}
async function markAttendance(signupId: number, status: "present" | "missing") {
  if (!isAdmin) return;

  const { error } = await supabase
    .from("signups")
    .update({ attendance: status })
    .eq("id", signupId);

  if (error) {
    alert(error.message);
    return;
  }

  await loadSignups();
}
  async function moveSignup(signupId: number, newRunId: number, newRole: string) {
    const { error } = await supabase
      .from("signups")
      .update({
        run_id: newRunId,
        role: newRole,
      })
      .eq("id", signupId);

    if (error) {
      console.error(error);
      return;
    }

    await loadSignups();
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const signupId = Number(String(active.id).replace("signup-", ""));
    const dropId = String(over.id);

    if (!dropId.startsWith("drop-")) return;

    const parts = dropId.replace("drop-", "").split("-");
    const newRunId = Number(parts[0]);
    const newRole = parts.slice(1).join("-");

    moveSignup(signupId, newRunId, newRole);
  }

const filteredRuns = runs.filter((run) => {
  const title = run.title.toLowerCase();

  const matchesRaid =
    raidFilter === "All" ||
    (raidFilter === "HC" && title.includes("hc")) ||
    (raidFilter === "Mythic" && title.includes("mythic"));

  const matchesDay =
    dayFilter === "All" || run.day === dayFilter;

  return matchesRaid && matchesDay;
});
async function deleteSelectedWeek() {
  setPopup({
    title: "Delete Week",
    message: `Are you sure you want to delete Week ${selectedWeek}?\nThis will delete all runs and signups.`,
    confirmText: "DELETE",
    cancelText: "CANCEL",
    onConfirm: async () => {
      const runIds = runs.map((r) => r.id);

      if (runIds.length > 0) {
        await supabase.from("signups").delete().in("run_id", runIds);
        await supabase.from("runs").delete().in("id", runIds);
      }

      const nextWeeks = weeks.filter((w) => w !== selectedWeek);
      setWeeks(nextWeeks);

if (nextWeeks.length > 0) {
  localStorage.setItem(
    "weeks",
    JSON.stringify(nextWeeks)
  );
} else {
  localStorage.removeItem("weeks");
}

if (nextWeeks.length > 0) {
  setSelectedWeek(nextWeeks[nextWeeks.length - 1]);
} else {
  setSelectedWeek(1);
}

      await loadRuns();
      await loadSignups();
    },
  });
}
  return (
    <main style={page}>
      <div style={magicFog} />
      <div style={magicFog2} />
      <div style={castlePurpleGlow} />
      <div style={castleLightBeam} />
<div
  style={{
    position: "fixed",
    top: 35,
    right: "17.5%",
    width: 180,
    height: 240,
    background:
      "radial-gradient(circle, rgba(192,132,252,.26), rgba(168,85,247,.12), transparent 70%)",
    filter: "blur(28px)",
    pointerEvents: "none",
    zIndex: 1,
    mixBlendMode: "screen",
    opacity: 0.75,
  }}
/>{showAccessPopup && (
  <div style={popupOverlay}>
    <div
      style={{
        width: 520,
        borderRadius: 24,
        padding: 30,
        background:
          "linear-gradient(180deg, rgba(15,0,35,.98), rgba(5,0,20,.98))",
        border: "1px solid rgba(168,85,247,.45)",
        boxShadow:
          "0 0 45px rgba(168,85,247,.45)",
      }}
    >
      <div
        style={{
          fontSize: 36,
          fontWeight: 900,
          color: "#fff",
          marginBottom: 10,
          textAlign: "center",
        }}
      >
        Signup Access Request
      </div>

      <div
        style={{
          color: "#c084fc",
          textAlign: "center",
          marginBottom: 24,
          fontSize: 15,
        }}
      >
        Link your Raider.IO main character to apply.
      </div>

      <input
        placeholder="Main Character"
        value={mainCharacterInput}
        onChange={(e) =>
          setMainCharacterInput(e.target.value)
        }
        style={createInput}
      />

      <input
        placeholder="Realm"
        value={mainRealmInput}
        onChange={(e) =>
          setMainRealmInput(e.target.value)
        }
        style={createInput}
      />

      <input
        placeholder="Raider.IO Link"
        value={raiderIoInput}
        onChange={(e) =>
          setRaiderIoInput(e.target.value)
        }
        style={createInput}
      />

      <textarea
        placeholder="Application Note (optional)"
        value={applicationNote}
        onChange={(e) =>
          setApplicationNote(e.target.value)
        }
        style={{
          ...createInput,
          minHeight: 110,
          resize: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 18,
        }}
      >
        <button
          onClick={sendAccessApplication}
          style={{
            flex: 1,
            height: 54,
            border: "none",
            borderRadius: 14,
            background:
              "linear-gradient(90deg,#16a34a,#22c55e)",
            color: "white",
            fontWeight: 900,
            fontSize: 16,
            cursor: "pointer",
            boxShadow:
              "0 0 20px rgba(34,197,94,.45)",
          }}
        >
          Send Application
        </button>

        <button
          onClick={() =>
            setShowAccessPopup(false)
          }
          style={{
            flex: 1,
            height: 54,
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 14,
            background: "rgba(255,255,255,.06)",
            color: "white",
            fontWeight: 900,
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
      {popup && (
        <div style={popupOverlay}>
          <div style={popupBox}>
<div
  style={{
    ...popupIcon,
    border:
      popup?.type === "error"
        ? "4px solid #ef4444"
        : "4px solid #22c55e",

    color:
      popup?.type === "error"
        ? "#ef4444"
        : "#22c55e",
  }}
>
  {popup?.type === "error" ? "✕" : "✓"}
</div>

            <div style={popupTitle}>{popup.title}</div>

            <div style={{ ...popupText, whiteSpace: "pre-line" }}>
              {popup.message}
            </div>

<div
  style={{
    display: "flex",
    gap: 12,
    marginTop: 18,
    justifyContent: "center",
  }}
>
  {popup.onConfirm && (
    <button
      onClick={() => {
        popup.onConfirm?.();
        setPopup(null);
      }}
      style={{
        ...popupButton,
        background:
          "linear-gradient(90deg,#dc2626,#ef4444)",
      }}
    >
      {popup.confirmText || "CONFIRM"}
    </button>
  )}

  <button
    onClick={() => setPopup(null)}
    style={popupButton}
  >
    {popup.cancelText || "OK"}
  </button>
</div>
          </div>
        </div>
      )}

      <section style={hero}>
        <div
          style={{
            position: "absolute",
            top: -120,
            left: "50%",
            transform: "translateX(-50%)",
            width: 520,
            height: 520,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(168,85,247,.30), rgba(168,85,247,.10), transparent 100%)",
            filter: "blur(40px)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

<h1 style={{ ...heroTitle, position: "relative", zIndex: 2 }}>
          Sign up Page
        </h1>
        
  <div style={epicTitleOrnament}>
  <div style={epicLineLeft} />
  <div style={epicCenterDiamond} />
  <div style={epicLineRight} />
</div>
<div style={topControlRow}>
  {isAdmin && (
    <div style={{ width: 170, display: "flex", justifyContent: "center" }}>
<button
  onClick={() => {
  const nextWeek =
  weeks.length > 0
    ? Math.max(...weeks) + 1
    : 1;
 setSelectedWeek(nextWeek);
}}
  style={addWeekButton}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "translateY(-2px) scale(1.05)";
    e.currentTarget.style.boxShadow =
      "0 0 28px rgba(250,204,21,.95), inset 0 0 18px rgba(250,204,21,.35)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "translateY(0) scale(1)";
    e.currentTarget.style.boxShadow =
      "0 0 18px rgba(250,204,21,.65), inset 0 0 12px rgba(250,204,21,.18)";
  }}
>
        + Add Week
      </button>
    </div>
  )}

  <div
  style={controlPanel}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform =
      "translateY(-4px) scale(1.015)";

    e.currentTarget.style.boxShadow =
      "0 0 50px rgba(168,85,247,.65), inset 0 0 30px rgba(168,85,247,.22)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform =
      "translateY(0) scale(1)";

    e.currentTarget.style.boxShadow =
      "0 0 32px rgba(168,85,247,.38), inset 0 0 28px rgba(168,85,247,.14)";
  }}
>

  <div style={controlBox}>
    <div style={controlLabel}>Server Time</div>
    <div style={{ ...controlValue, color: "#facc15", fontSize: 26 }}>
      {europeTime}
    </div>
 <div
  style={{
    ...controlSub,
    fontSize: 15,
    fontWeight: 800,
    marginTop: 4,
    color: "#ffffff",
    textShadow: "0 0 10px rgba(255,255,255,.35)",
  }}
>
  {europeDay}
</div>
  </div>

  <div style={{ ...controlBox, borderLeft: "1px solid rgba(168,85,247,.25)" }}>
    <div style={controlLabel}>Current Week</div>
    <div style={controlValue}>Week {selectedWeek}</div>
    <div style={controlSub}>{getShortWeekRange(selectedWeek)}</div>
  </div>

  <div style={{ ...controlBox, borderLeft: "1px solid rgba(168,85,247,.25)" }}>
    <div style={controlLabel}>Active Character</div>
    <div
      style={{
        ...controlValue,
        color: selectedCharacter
          ? getClassColor(selectedCharacter.class)
          : "#ffffff",
        fontSize: 30,
      }}
    >
      {selectedCharacter?.name || "No Character"}
    </div>

<div
  style={{
    marginTop: 4,
    display: "flex",
    alignItems: "center",
    gap: 10,
justifyContent: "center",
    fontWeight: 800,
    fontSize: 16,
    flexWrap: "wrap",
  }}
>
  <span
    style={{
      color: getIlvlColor(selectedCharacter?.ilvl),
      textShadow: `0 0 12px ${getIlvlColor(selectedCharacter?.ilvl)}`,
    }}
  >
    ILVL {selectedCharacter?.ilvl || "0"}
  </span>
  <span
    style={{
      color: "#c084fc",
      textShadow: "0 0 10px #c084fc",
    }}
  >
    {selectedCharacter?.progress || "0/9"}
  </span>

<span
  style={{
    color: "#d8b4fe",
    fontSize: 13,
    opacity: 0.9,
  }}
>
  {selectedCharacter?.spec} {selectedCharacter?.class}
</span>
</div>
  </div>

  <div style={{ ...controlBox, borderLeft: "1px solid rgba(168,85,247,.25)" }}>
    <div style={controlLabel}>Raid Difficulty Filter</div>

<div
  style={{
    display: "flex",
    gap: 12,
    marginTop: 12,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingLeft: 26,
  }}
>
      <FilterButton label="All" active={raidFilter === "All"} onClick={() => setRaidFilter("All")} />
      <FilterButton label="HC" active={raidFilter === "HC"} onClick={() => setRaidFilter("HC")} />
      <FilterButton label="Mythic" active={raidFilter === "Mythic"} onClick={() => setRaidFilter("Mythic")} />
    </div>
  </div>
</div>

{isAdmin && (
  <button
onClick={deleteSelectedWeek}
    style={removeWeekButton}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform =
        "translateY(-2px) scale(1.05)";

      e.currentTarget.style.boxShadow =
        "0 0 28px rgba(239,68,68,.95), inset 0 0 18px rgba(239,68,68,.35)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform =
        "translateY(0) scale(1)";

      e.currentTarget.style.boxShadow =
        "0 0 18px rgba(239,68,68,.55), inset 0 0 12px rgba(239,68,68,.18)";
    }}
  >
    − Delete Week
  </button>
)}
</div>

<div style={weekButtons}>

      
{weeks.map((week) => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              style={{
                ...weekButton,
                ...(selectedWeek === week ? weekButtonActive : {}),
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform =
                  "translateY(-2px) scale(1.04)";
                e.currentTarget.style.boxShadow =
                  "0 0 22px rgba(168,85,247,.95), inset 0 0 16px rgba(168,85,247,.35)";
                e.currentTarget.style.border = "2px solid #c084fc";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow =
                  selectedWeek === week
                    ? "0 0 22px rgba(250,204,21,.9), inset 0 0 14px rgba(250,204,21,.35)"
                    : "0 0 10px rgba(168,85,247,.35), inset 0 0 10px rgba(168,85,247,.25)";
                e.currentTarget.style.border =
                  selectedWeek === week
                    ? "2px solid #facc15"
                    : "1px solid #7e22ce";
              }}
            >
              <div>
                <div>
                 Week {week}
                </div>

                <div style={weekDateText}>{getShortWeekRange(week)}</div>
              </div>
            </button>
          ))}
        </div>

  

        {characters.length > 0 && (
          <div style={characterBar}>
            {characters.map((char) => {
              const active = selectedCharacter?.id === char.id;

const characterUsed = signups.some((s) => {
  if (s.character_id !== char.id) return false;

  const run = runs.find((r) => r.id === s.run_id);

  return run?.week === selectedWeek;
});
              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharacter(char)}
onMouseEnter={(e) => {
  e.currentTarget.style.transform =
    "translateY(-2px) scale(1.05)";
  e.currentTarget.style.boxShadow = active
    ? "0 0 20px rgba(250,204,21,.9)"
    : characterUsed
    ? "none"
    : "0 0 18px rgba(168,85,247,.65)";
}}

onMouseLeave={(e) => {
  e.currentTarget.style.transform =
    "translateY(0) scale(1)";

  e.currentTarget.style.boxShadow = active
    ? "0 0 14px rgba(250,204,21,.7)"
    : characterUsed
    ? "none"
    : "0 0 10px rgba(168,85,247,.25)";
}}

style={{
  ...characterButton,
  opacity: characterUsed ? 0.35 : 1,
  filter: characterUsed ? "grayscale(100%)" : "none",

  border: active
    ? "2px solid #facc15"
    : characterUsed
    ? "1px solid rgba(120,120,120,.45)"
    : "1px solid #7e22ce",

  boxShadow: active
    ? "0 0 14px rgba(250,204,21,.7)"
    : characterUsed
    ? "none"
    : "0 0 10px rgba(168,85,247,.25)",

  transition: "all .18s ease",
}}

 
                >
                  <SpecIcon
                    player={`${char.name} - ${char.spec} ${char.class}`}
                  />
                  <b>{char.name}</b>
                </button>
              );
            })}
          </div>
        )}
        <div style={dayButtons}>
  {["All", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday"].map((day) => (
<button
  key={day}
  onClick={() => setDayFilter(day)}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform =
      "translateY(-3px) scale(1.07)";

    e.currentTarget.style.boxShadow =
      "0 0 28px rgba(168,85,247,.95)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform =
      "translateY(0) scale(1)";

    e.currentTarget.style.boxShadow =
      dayFilter === day
        ? "0 0 20px rgba(250,204,21,.75)"
        : "0 0 12px rgba(168,85,247,.3)";
  }}
  style={{
    ...dayButton,
    ...(dayFilter === day ? dayButtonActive : {}),
  }}
>
      {day}
    </button>
  ))}
</div>
      </section>
{isAdmin && !banishOpen && (
  <button
    onClick={() => setBanishOpen(true)}
    style={{
      position: "fixed",
      left: 24,
      bottom: 105,
      width: 62,
      height: 62,
      borderRadius: "50%",
      border: "1px solid rgba(239,68,68,.7)",
      background: "linear-gradient(135deg,#7f1d1d,#ef4444)",
      color: "white",
      fontSize: 26,
      cursor: "pointer",
      zIndex: 999,
      boxShadow: "0 0 24px rgba(239,68,68,.75)",
    }}
  >
    ☠
  </button>
)}

{isAdmin && banishOpen && (
  <div
    style={{
      position: "fixed",
      left: 20,
      top: 120,
      width: 430,
      padding: 18,
      borderRadius: 18,
      background: "rgba(8,0,20,.92)",
      border: "1px solid rgba(239,68,68,.45)",
      boxShadow: "0 0 28px rgba(239,68,68,.35)",
      zIndex: 999,
    }}
  >
    <button
      onClick={() => setBanishOpen(false)}
      style={{
        position: "absolute",
        top: 10,
        right: 12,
        background: "transparent",
        border: "none",
        color: "white",
        fontSize: 22,
        cursor: "pointer",
      }}
    >
      ×
    </button>

    <div
      style={{
        color: "#ef4444",
        fontWeight: 900,
        fontSize: 24,
        textAlign: "center",
        marginBottom: 14,
      }}
    >
      ☠ BANISH
    </div>

    <div
      style={{
        display: "flex",
        gap: 18,
        justifyContent: "center",
        marginBottom: 16,
        alignItems: "center",
      }}
    >
      <button
        onClick={() => setBanishActive((prev) => !prev)}
        style={{
          width: 180,
          height: 70,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 0,
          whiteSpace: "nowrap",
          borderRadius: 20,
          border: banishActive
            ? "1px solid rgba(34,197,94,.8)"
            : "1px solid rgba(239,68,68,.8)",
          background: banishActive
            ? "linear-gradient(90deg,#14532d,#22c55e)"
            : "linear-gradient(90deg,#b91c1c,#ef4444)",
          color: "white",
          fontWeight: 900,
          fontSize: 22,
          cursor: "pointer",
          boxShadow: banishActive
            ? "0 0 25px rgba(34,197,94,.55)"
            : "0 0 25px rgba(239,68,68,.45)",
        }}
      >
        {banishActive ? "ACTIVATED" : "STOP"}
      </button>

      <button
        onClick={() => {
          setBanishLogs([]);
          localStorage.removeItem("banishLogs");
        }}
        style={{
          width: 180,
          height: 70,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 0,
          whiteSpace: "nowrap",
          borderRadius: 20,
          border: "1px solid rgba(250,204,21,.7)",
          background: "linear-gradient(90deg,#a16207,#facc15)",
          color: "#fff",
          fontWeight: 900,
          fontSize: 22,
          cursor: "pointer",
          boxShadow: "0 0 25px rgba(250,204,21,.45)",
        }}
      >
        RESET
      </button>
    </div>

    {banishLogs.slice(0, 5).map((log) => {
      const count = banishLogs.filter((x) => x.player === log.player).length;

      return (
        <div
          key={log.id}
          style={{
            padding: 10,
            marginBottom: 10,
            borderRadius: 10,
            background: "rgba(0,0,0,.35)",
          }}
        >
          <div style={{ color: "#fff", fontWeight: 800 }}>
            {log.player.split(" - ")[0]}
          </div>

          <div style={{ color: "#facc15", fontSize: 13, marginTop: 4 }}>
            Unsigns: {count}
          </div>

          <div style={{ color: "#c084fc", fontSize: 12 }}>
            Run ID #{log.runId}
          </div>

          <div style={{ color: "#9ca3af", fontSize: 11 }}>
            Unsigned: {log.unsignedAt}
          </div>
        </div>
      );
    })}
  </div>
)}
{isAdmin && (
  <div style={createArea}>
    <button
      onClick={() => setShowCreateRun(true)}
      style={createRunButton}
    >
      + Create Run
    </button>
  </div>
)}
{showCreateRun && (
  <div style={modalOverlay}>
    <div style={createRunPanel}>
      <div style={createRunTitle}>Create Run</div>

      <input
        placeholder="Run title"
        value={newRunTitle}
        onChange={(e) => setNewRunTitle(e.target.value)}
        style={createInput}
      />

      <input
        placeholder="Required ilvl"
        value={newRunIlvl}
        onChange={(e) => setNewRunIlvl(e.target.value)}
        style={createInput}
      />
<input
  placeholder="Healer spots"
  value={newRunHealers}
  onChange={(e) => setNewRunHealers(e.target.value)}
  style={createInput}
/>

<input
  placeholder="DPS spots"
  value={newRunDps}
  onChange={(e) => setNewRunDps(e.target.value)}
  style={createInput}
/>
      <input
        placeholder="Day"
        value={newRunDay}
        onChange={(e) => setNewRunDay(e.target.value)}
        style={createInput}
      />

<input
  placeholder="Time"
  value={newRunTime}
  onChange={(e) => setNewRunTime(e.target.value)}
  style={createInput}
/>

<input
  type="datetime-local"
  value={newRunSignupOpenAt}
  onChange={(e) => setNewRunSignupOpenAt(e.target.value)}
  style={createInput}
/>

      <input
        placeholder="Notes"
        value={newRunNotes}
        onChange={(e) => setNewRunNotes(e.target.value)}
        style={createInput}
      />

      <button
        onClick={createRun}
        style={createRunConfirm}
      >
        Create Run
      </button>

      <button
        onClick={() => setShowCreateRun(false)}
        style={cancelEditButton}
      >
        Cancel
      </button>
    </div>
  </div>
)}

    {editingRun && (
  <div style={modalOverlay}>
          <div style={createRunPanel}>
            <div style={createRunTitle}>
              Edit Run #{editingRun.id}
            </div>
<div style={fieldLabel}>Run Title</div>
            <input
              value={editRunTitle}
              onChange={(e) => setEditRunTitle(e.target.value)}
              style={createInput}
            />
            <div style={fieldLabel}>Required iLvl</div>
<input
  placeholder="Required ilvl"
  value={editRunIlvl}
  onChange={(e) => setEditRunIlvl(e.target.value)}
  style={createInput}
/>
<div style={fieldLabel}>Healer Spots</div>
<input
  placeholder="Healer spots"
  value={editRunHealers}
  onChange={(e) => setEditRunHealers(e.target.value)}
  style={createInput}
/>
<div style={fieldLabel}>DPS Spots</div>
<input
  placeholder="DPS spots"
  value={editRunDps}
  onChange={(e) => setEditRunDps(e.target.value)}
  style={createInput}
/>
<div style={fieldLabel}>Signup Opens</div>
<input
  type="datetime-local"
  value={editRunSignupOpenAt}
  onChange={(e) => setEditRunSignupOpenAt(e.target.value)}
  style={createInput}
/>
<div style={fieldLabel}>Run Day</div>
            <input
              value={editRunDay}
              onChange={(e) => setEditRunDay(e.target.value)}
              style={createInput}
            />
<div style={fieldLabel}>Run Date</div>
            <input
              type="date"
              value={editRunDate}
              onChange={(e) => setEditRunDate(e.target.value)}
              style={createInput}
            />
<div style={fieldLabel}>Run Time</div>
            <input
              value={editRunTime}
              onChange={(e) => setEditRunTime(e.target.value)}
              style={createInput}
            />
<div style={fieldLabel}>Notes</div>
            <input
              value={editRunNotes}
              onChange={(e) => setEditRunNotes(e.target.value)}
              style={createInput}
            />

            <button
              onClick={saveEditRun}
              style={createRunConfirm}
            >
              Save Changes
            </button>

            <button
              onClick={() => setEditingRun(null)}
              style={cancelEditButton}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragEnd={handleDragEnd}
      >
        <section style={runsGrid}>
          {filteredRuns.map((run, index) => {
            const theme = getRunTheme(run, index);
            const limits = getLimits(run);
const signupLocked =
  run.signup_open_at &&
  new Date(run.signup_open_at).getTime() > nowTick;
  const countdownText =
  signupLocked && run.signup_open_at
    ? formatCountdown(run.signup_open_at)
    : null;
                  return (
                  <div
                  key={run.id}
style={{
  ...runCard,
  minHeight: signupLocked ? 340 : 560,
                  background: `linear-gradient(rgba(0,0,0,.18), rgba(0,0,0,.28)), url(${theme.bg}) center/cover`,
                  boxShadow: run.finished
  ? "0 0 26px rgba(255,255,255,.18), inset 0 0 20px rgba(255,255,255,.10)"
  : `0 0 34px ${theme.glow}, inset 0 0 18px ${theme.glow}`,
                  transition: "all .22s ease",
                  cursor: "pointer",
             opacity: 1,
position: "relative",
overflow: "hidden",

                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform =
                    "translateY(-6px) scale(1.01)";
                  e.currentTarget.style.boxShadow = run.finished
  ? "0 0 30px rgba(255,255,255,.22), inset 0 0 22px rgba(255,255,255,.12)"
  : `0 0 50px ${theme.glow}, inset 0 0 24px ${theme.glow}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform =
                    "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow = run.finished
  ? "0 0 26px rgba(255,255,255,.18), inset 0 0 20px rgba(255,255,255,.10)"
  : `0 0 34px ${theme.glow}, inset 0 0 18px ${theme.glow}`;
                }}
                >
                {run.finished && (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: "rgba(0,0,0,.58)",
      backdropFilter: "grayscale(100%) brightness(65%)",
      zIndex: 1,
      pointerEvents: "none",
    }}
  />
)}
             
                <div
                  style={{
                    ...runBanner,
                    background:
                      "linear-gradient(90deg, rgba(0,0,0,.25), rgba(0,0,0,.05), rgba(0,0,0,.35))",
                  }}
                >
                  <div style={{ paddingLeft: 28 }}>
                    <h2 style={{ ...runTitle, color: theme.title }}>
                      {run.title}
                    </h2>

                    <div style={runTime}>
                      Run ID #{run.id} • {run.day} • {run.time}
                      {run.run_date ? ` • ${formatRunDate(run.run_date)}` : ""}
                    </div>

                    {run.notes && <div style={runNotes}>{run.notes}</div>}

                    {run.ilvl_required && (
                      <div
                        style={{
                          color: "#facc15",
                          fontWeight: 900,
                          marginTop: 6,
                          textShadow: "0 0 10px rgba(250,204,21,.7)",
                        }}
                      >
                        Required ilvl: {run.ilvl_required}+
                      </div>
                    )}
                  </div>
<img
  src={theme.emblem}
  style={{
    ...cornerFlag,
    pointerEvents: "none",
  }}
/>

<div
  style={{
    position: "absolute",
    top: 96,
right: 18,
    display: "flex",
    gap: 8,
    alignItems: "center",
    zIndex: 9999,
  }}
>
  {canFinishRun && (
<button
  onMouseEnter={(e) => {
    e.currentTarget.style.transform =
      "translateY(-3px) scale(1.12)";

    e.currentTarget.style.boxShadow =
      "0 0 30px rgba(34,197,94,.95)";
  }}

  onMouseLeave={(e) => {
    e.currentTarget.style.transform =
      "translateY(0) scale(1)";

    e.currentTarget.style.boxShadow =
      "0 0 22px rgba(34,197,94,.75)";
  }}

  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    finishRun(run);
  }}
      style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        transition: "all .18s ease",
        border: "1px solid rgba(34,197,94,.75)",
        background: run.finished
          ? "linear-gradient(90deg,#16a34a,#22c55e)"
          : "linear-gradient(90deg,#065f46,#22c55e)",
        color: "white",
        fontSize: 18,
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: "0 0 22px rgba(34,197,94,.75)",
      }}
    >
      {run.finished ? "↩" : "⚑"}
    </button>
  )}

  {isAdmin && (
    <>
<button
  onMouseEnter={(e) => {
    e.currentTarget.style.transform =
      "translateY(-3px) scale(1.12)";

    e.currentTarget.style.boxShadow =
      "0 0 26px rgba(168,85,247,.95)";
  }}

  onMouseLeave={(e) => {
    e.currentTarget.style.transform =
      "translateY(0) scale(1)";

    e.currentTarget.style.boxShadow =
      "0 0 14px rgba(168,85,247,.55)";
  }}

  onClick={(e) => {
    e.stopPropagation();
    openEditRun(run);
    setEditRunIlvl(String(run.ilvl_required || ""));
setEditRunHealers(String(run.healer_limit || 3));
setEditRunDps(String(run.dps_limit || 10));
setEditRunSignupOpenAt(run.signup_open_at ? run.signup_open_at.slice(0, 16) : "");
  }}
        style={editRunButton}
      >
        ✏️
      </button>

<button
  onMouseEnter={(e) => {
    e.currentTarget.style.transform =
      "translateY(-3px) scale(1.12)";

    e.currentTarget.style.boxShadow =
      "0 0 26px rgba(239,68,68,.95)";
  }}

  onMouseLeave={(e) => {
    e.currentTarget.style.transform =
      "translateY(0) scale(1)";

    e.currentTarget.style.boxShadow =
      "0 0 14px rgba(239,68,68,.55)";
  }}

  onClick={(e) => {
    e.stopPropagation();
    deleteRun(run.id);
  }}
        style={deleteRunButton}
      >
        🗑
      </button>
    </>
  )}
</div>
                </div>

{!canUseRunCards ? (
  <div
    style={{
      padding: 22,
      textAlign: "center",
      borderTop: "1px solid rgba(168,85,247,.25)",
      background: "rgba(0,0,0,.55)",
      minHeight: 180,
      pointerEvents: "none",
    }}
  >
    <div
      style={{
        color: "#facc15",
        fontSize: 26,
        fontWeight: 900,
        textShadow: "0 0 18px rgba(250,204,21,.8)",
      }}
    >
      🔒 RUN LOCKED
    </div>

    <div
      style={{
        marginTop: 10,
        color: "#ffffff",
        fontSize: 24,
        fontWeight: 900,
      }}
    >
      Apply for access to sign-up
    </div>
  </div>
) : signupLocked ? (
  <div
    style={{
      padding: 22,
      textAlign: "center",
      borderTop: "1px solid rgba(168,85,247,.25)",
      background: "rgba(0,0,0,.38)",
      minHeight: 180,
    }}
  >
    <div
      style={{
        color: "#facc15",
        fontSize: 26,
        fontWeight: 900,
        textShadow: "0 0 18px rgba(250,204,21,.8)",
      }}
    >
      🔒 SIGNUPS OPEN IN
    </div>

    <div
      style={{
        marginTop: 10,
        color: "#ffffff",
        fontSize: 34,
        fontWeight: 900,
        letterSpacing: 1,
      }}
    >
      {countdownText}
    </div>
  </div>
) : (
  <div style={roleGrid}>
                  <RoleBox
                    runId={run.id}
                    role="Tank"
                    color="#1d8cff"
                    buttonText="SIGN TANK"
                    signups={signups}
                    addSignup={addSignup}
                    removeSignup={removeSignup}
                    limit={limits.tank}
                    user={user}
                    selectedCharacter={selectedCharacter}
                    adminAddSignup={adminAddSignup}
                    markAttendance={markAttendance}
setAdminAddOpen={setAdminAddOpen}
setAdminAddRunId={setAdminAddRunId}
setAdminAddRole={setAdminAddRole}
setAdminAddName={setAdminAddName}
setAdminAddClass={setAdminAddClass}
setAdminAddSpec={setAdminAddSpec}
                  />

                  <RoleBox
                    runId={run.id}
                    role="Healer"
                    color="#22c55e"
                    buttonText="SIGN HEALER"
                    signups={signups}
                    addSignup={addSignup}
                    removeSignup={removeSignup}
                    limit={limits.healer}
                    user={user}
                    selectedCharacter={selectedCharacter}
                    adminAddSignup={adminAddSignup}
                    markAttendance={markAttendance}
setAdminAddOpen={setAdminAddOpen}
setAdminAddRunId={setAdminAddRunId}
setAdminAddRole={setAdminAddRole}
setAdminAddName={setAdminAddName}
setAdminAddClass={setAdminAddClass}
setAdminAddSpec={setAdminAddSpec}
                  />

                  <RoleBox
                    runId={run.id}
                    role="DPS"
                    color="#ef4444"
                    buttonText="SIGN DPS"
                    signups={signups}
                    addSignup={addSignup}
                    removeSignup={removeSignup}
                    limit={limits.dps}
                    user={user}
                    selectedCharacter={selectedCharacter}
                    adminAddSignup={adminAddSignup}
                    markAttendance={markAttendance}
                    setAdminAddOpen={setAdminAddOpen}
setAdminAddRunId={setAdminAddRunId}
setAdminAddRole={setAdminAddRole}
setAdminAddName={setAdminAddName}
setAdminAddClass={setAdminAddClass}
setAdminAddSpec={setAdminAddSpec}
                  />

                  <RoleBox
                    runId={run.id}
                    role="Bench"
                    color="#a855f7"
                    buttonText="JOIN BENCH"
                    signups={signups}
                    addSignup={addSignup}
                    removeSignup={removeSignup}
                    limit={limits.bench}
                    user={user}
                    selectedCharacter={selectedCharacter}
                    adminAddSignup={adminAddSignup}
                    markAttendance={markAttendance}
                    setAdminAddOpen={setAdminAddOpen}
setAdminAddRunId={setAdminAddRunId}
setAdminAddRole={setAdminAddRole}
setAdminAddName={setAdminAddName}
setAdminAddClass={setAdminAddClass}
setAdminAddSpec={setAdminAddSpec}
                  />

                  <RoleBox
                    runId={run.id}
                    role="Loot Body"
                    color="#f97316"
                    buttonText="LB"
                    signups={signups}
                    addSignup={addSignup}
                    removeSignup={removeSignup}
                    limit={limits.lootBody}
                    user={user}
                    selectedCharacter={selectedCharacter}
                    adminAddSignup={adminAddSignup}
                    markAttendance={markAttendance}
                    setAdminAddOpen={setAdminAddOpen}
setAdminAddRunId={setAdminAddRunId}
setAdminAddRole={setAdminAddRole}
setAdminAddName={setAdminAddName}
setAdminAddClass={setAdminAddClass}
setAdminAddSpec={setAdminAddSpec}
                  />
               </div>
)}
              </div>
            );
          })}
        </section>
      </DndContext>

      <footer style={footer}>
        <div style={footerLeft}>
          <img src="/mythic-emblem.png" style={footerLogo} />
          <div>
            <div style={{ fontWeight: 900 }}>Death Wish</div>
            <div style={{ color: "#bca38c" }}>We push. We kill. We loot.</div>
          </div>
        </div>

        <div style={footerMiddle}>
          <span>🛡 Tank</span>
          <span>➕ Healer</span>
          <span>🗡 DPS</span>
          <span>👥 Bench</span>
          <span>💰 Loot Body</span>
        </div>

        <div style={footerRight}>
          <div>All times are ST</div>
          <div style={{ color: "#bca38c" }}>
            Show up. Gear up. Shut up. Pull.
          </div>
        </div>
      </footer>
   {!chatOpen && (
  <button
    onClick={() => setChatOpen(true)}
    style={{
      position: "fixed",
      right: 24,
      bottom: 105,
      width: 62,
      height: 62,
      borderRadius: "50%",
      border: "1px solid rgba(168,85,247,.7)",
      background: "linear-gradient(135deg,#581c87,#c026d3)",
      color: "white",
      fontSize: 28,
      cursor: "pointer",
      zIndex: 999,
      boxShadow: "0 0 24px rgba(168,85,247,.75)",
    }}
  >
    💬
  </button>
)}

{chatOpen && (
  <div
    style={{
      position: "fixed",
      right: 20,
      top: 120,
      width: 320,
      height: "72vh",
      background: "rgba(5,5,20,.92)",
      border: "1px solid rgba(168,85,247,.45)",
      borderRadius: 18,
      backdropFilter: "blur(12px)",
      display: "flex",
      flexDirection: "column",
      zIndex: 999,
      overflow: "hidden",
      boxShadow: "0 0 30px rgba(168,85,247,.25)",
    }}
  >
    <div
      style={{
        padding: 16,
        borderBottom: "1px solid rgba(168,85,247,.2)",
        fontWeight: 800,
        color: "#c084fc",
        fontSize: 18,
        display: "flex",
        justifyContent: "space-between",
      }}
    >
      <span>Raid Chat</span>

      <button
        onClick={() => setChatOpen(false)}
        style={{
          background: "transparent",
          border: "none",
          color: "white",
          fontSize: 20,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>

    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
{chatMessages.map((msg, index) => {
  const mine = msg.user_id === user?.id;

  const currentDate = new Date(msg.created_at);

  const previousDate =
    index > 0
      ? new Date(chatMessages[index - 1].created_at)
      : null;

  const showDateLabel =
    !previousDate ||
    currentDate.toDateString() !==
      previousDate.toDateString();

  return (
    <div key={msg.id}>
      {showDateLabel && (
        <div
          style={{
            textAlign: "center",
            color: "#c084fc",
            fontSize: 12,
            fontWeight: 900,
            margin: "14px 0 8px",
            opacity: 0.9,
          }}
        >
          {formatChatDayLabel(msg.created_at)}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: mine
            ? "flex-end"
            : "flex-start",
        }}
      >
        <div
          style={{
            maxWidth: "78%",
            background: mine
              ? "linear-gradient(135deg,#9333ea,#c026d3)"
              : "rgba(255,255,255,.08)",

            border: mine
              ? "1px solid rgba(255,255,255,.12)"
              : "1px solid rgba(168,85,247,.18)",

            borderRadius: 18,
            padding: "10px 12px",
          }}
        >
          {!mine && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <img
                src={msg.avatar_url || "/logo.png"}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />

              <div
                style={{
                  fontWeight: 800,
                  color: "#c084fc",
                  fontSize: 13,
                }}
              >
                {msg.discord_name}
              </div>
            </div>
          )}

          <div
            style={{
              color: "white",
              fontSize: 14,
              lineHeight: 1.45,
              wordBreak: "break-word",
            }}
          >
            {msg.message}
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 10,
              opacity: 0.7,
              textAlign: "right",
              color: "#d1d5db",
            }}
          >
            {formatChatTime(msg.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
})}
      <div ref={chatBottomRef} />
    </div>

    <div
      style={{
        padding: 12,
        borderTop: "1px solid rgba(168,85,247,.2)",
        display: "flex",
        gap: 8,
      }}
    >
      <input
        value={chatInput}
        onChange={(e) =>
          setChatInput(e.target.value)
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") sendChatMessage();
        }}
        placeholder="Type message..."
        style={{
          flex: 1,
          background: "rgba(255,255,255,.06)",
          border: "1px solid rgba(168,85,247,.3)",
          borderRadius: 10,
          padding: "10px 12px",
          color: "white",
        }}
      />

      <button
        onClick={sendChatMessage}
        style={{
          background:
            "linear-gradient(135deg,#9333ea,#c026d3)",
          border: "none",
          borderRadius: 10,
          color: "white",
          padding: "10px 14px",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        Send
      </button>
    </div>
  </div>
)}
{adminAddOpen && (
  <div style={popupOverlay}>
    <div style={createRunPanel}>
      <div style={createRunTitle}>Admin Add</div>

      <input
        placeholder="Character name"
        value={adminAddName}
        onChange={(e) => setAdminAddName(e.target.value)}
        style={createInput}
      />

      <select
        value={adminAddClass}
        onChange={(e) => setAdminAddClass(e.target.value)}
        style={createInput}
      >
        {["Druid", "Death Knight", "Demon Hunter", "Hunter", "Mage", "Monk", "Paladin", "Priest", "Rogue", "Shaman", "Warlock", "Warrior"].map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>

      <input
        placeholder="Spec"
        value={adminAddSpec}
        onChange={(e) => setAdminAddSpec(e.target.value)}
        style={createInput}
      />

      <button
        style={createRunConfirm}
        onClick={() => {
          if (!adminAddRunId || !adminAddName.trim()) return;

          adminAddSignup(
            adminAddRunId,
            adminAddRole,
            `${adminAddName.trim()} - ${adminAddSpec} ${adminAddClass}`
          );

          setAdminAddOpen(false);
        }}
      >
        Add Player
      </button>

      <button
        style={cancelEditButton}
        onClick={() => setAdminAddOpen(false)}
      >
        Cancel
      </button>
    </div>
  </div>
)}
</main>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px) scale(1.05)";
        e.currentTarget.style.boxShadow =
          "0 0 30px rgba(168,85,247,.95)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.boxShadow = active
          ? "0 0 18px rgba(250,204,21,.7)"
          : "0 0 12px rgba(168,85,247,.25)";
      }}
      style={smallFilter(active)}
    >
      {label}
    </button>
  );
}

function RoleBox({
  runId,
  role,
  color,
  buttonText,
  signups,
  addSignup,
  adminAddSignup,
  removeSignup,
  markAttendance,
  limit,
  selectedCharacter,
  user,
  setAdminAddOpen,
setAdminAddRunId,
setAdminAddRole,
setAdminAddName,
setAdminAddClass,
setAdminAddSpec,
}: {
  runId: number;
  role: string;
  color: string;
  buttonText: string;
  signups: Signup[];
  setAdminAddOpen: (v: boolean) => void;
setAdminAddRunId: (v: number | null) => void;
setAdminAddRole: (v: string) => void;
setAdminAddName: (v: string) => void;
setAdminAddClass: (v: string) => void;
setAdminAddSpec: (v: string) => void;
addSignup: (runId: number, role: string) => void;
adminAddSignup: (
  runId: number,
  role: string,
  playerName: string
) => void;
removeSignup: (signupId: number) => void;
markAttendance: (
  signupId: number,
  status: "present" | "missing"
) => void;
  limit: number;
  selectedCharacter: Character | null;
  user: any;
}) {
  const roleSignups = signups.filter(
    (s) => s.run_id === runId && s.role === role
  );
  

  const full = roleSignups.length >= limit;
  const oneLeft = limit - roleSignups.length === 1;

  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${runId}-${role}`,
  });

  const ADMIN_IDS = ["207929624888344576"];

  const discordId =
    user?.user_metadata?.provider_id || user?.user_metadata?.sub;

const isAdmin =
  ADMIN_IDS.includes(discordId) ||
  user?.site_role === "admin";

const isOfficer =
  user?.site_role === "officer";

  const displayColor = full ? "#ef4444" : oneLeft ? "#facc15" : color;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...roleBox,
        borderColor: isOver ? "#facc15" : `${displayColor}55`,
        boxShadow: isOver
          ? "inset 0 0 18px rgba(250,204,21,.65)"
          : full
          ? "inset 0 0 18px rgba(239,68,68,.35)"
          : oneLeft
          ? "inset 0 0 18px rgba(250,204,21,.25)"
          : "none",
      }}
    >
      <div
        style={{
          ...roleTitle,
          color: displayColor,

          fontSize:
            role === "Loot Body"
              ? 22
              : role === "Healer"
              ? 20
              : 22,

          textShadow: full
            ? "0 0 18px rgba(239,68,68,.95)"
            : oneLeft
            ? "0 0 18px rgba(250,204,21,.95)"
            : `0 0 18px ${color}`,

          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: role === "Loot Body" ? 18 : 19 }}>
          {getRoleIcon(role)}
        </span>{" "}
        {getRoleLabel(role)}{" "}
        <span style={{ fontSize: 14 }}>
          {roleSignups.length}/{limit}
        </span>
      </div>

      <div style={signupList}>
        {roleSignups.map((signup) => {
          const parsed = parseSignup(signup.player);

        const discordId =
  user?.user_metadata?.provider_id ||
  user?.user_metadata?.sub;

const canDelete =
  signup.discord_id === discordId ||
  signup.character_id === selectedCharacter?.id ||
  isAdmin;

          return (
            <DraggableSignup
              key={signup.id}
              signup={signup}
              parsedName={parsed.character}
              color={color}
              canDelete={canDelete}
              canDrag={isAdmin || isOfficer}
              removeSignup={removeSignup}
              markAttendance={markAttendance}
            />
          );
        })}
      </div>

      <button
       disabled={full}
        onClick={() => addSignup(runId, role)}
        onMouseEnter={(e) => {
  if (full) return;
  e.currentTarget.style.transform = "translateY(-3px) scale(1.06)";
  e.currentTarget.style.boxShadow = `0 0 26px ${color}`;
}}

onMouseLeave={(e) => {
  e.currentTarget.style.transform = "translateY(0) scale(1)";
  e.currentTarget.style.boxShadow = full ? "none" : `0 0 12px ${color}`;
}}
        style={{
          ...roleButton,
          background: full
            ? "#4b5563"
            : `linear-gradient(${color}, ${darkenColor(color)})`,
          boxShadow: full ? "none" : `0 0 12px ${color}`,
          transition: "all .18s ease",
        }}
      >
{full ? "FULL" : buttonText}
      </button>
      {isAdmin && (
  <button
onClick={() => {
  setAdminAddRunId(runId);
  setAdminAddRole(role);
  setAdminAddName("");
  setAdminAddClass("Druid");
  setAdminAddSpec("Guardian");
  setAdminAddOpen(true);
}}
    onMouseEnter={(e) => {
  e.currentTarget.style.transform =
    "translateY(-3px) scale(1.06)";

  e.currentTarget.style.boxShadow =
    "0 0 26px rgba(217,70,239,.95)";
}}

onMouseLeave={(e) => {
  e.currentTarget.style.transform =
    "translateY(0) scale(1)";

  e.currentTarget.style.boxShadow =
    "0 0 12px rgba(217,70,239,.55)";
}}
    style={{
      ...roleButton,
      marginTop: 6,
      background: "linear-gradient(90deg,#7c3aed,#d946ef)",
      boxShadow: "0 0 12px rgba(217,70,239,.55)",
      transition: "all .18s ease",
    }}
  >
    ADMIN ADD
  </button>
)}
    </div>
  );
}

function DraggableSignup({
  signup,
  parsedName,
  color,
  canDelete,
  canDrag,
  removeSignup,
  markAttendance,
}: {
  signup: Signup;
  parsedName: string;
  color: string;
  canDelete: boolean;
  canDrag: boolean;
  removeSignup: (signupId: number) => void;
  markAttendance: (
  signupId: number,
  status: "present" | "missing"
) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `signup-${signup.id}`,
      disabled: !canDrag,
    });

  return (
    <div
      ref={setNodeRef}
      onClick={() => {
  if (signup.discord_id) {
    window.open(`discord://-/users/${signup.discord_id}`, "_blank");
  }
}}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
      style={{
        ...signupPill,
        borderColor: `${color}55`,
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
        cursor: canDrag ? "grab" : "default",
        zIndex: isDragging ? 9999 : 1,
      }}
    >
<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
    minWidth: 0,
    flex: 1,
  }}
>
        <SpecIcon player={signup.player} />
  <b
  title={parsedName}
  style={{
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
  }}
>
  {parsedName}
</b>
      </div>

      {canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeSignup(signup.id);
          }}
          style={removeButton}
        >
          ×
        </button>
      )}
      {canDrag && (
  <div
    style={{
      display: "flex",
      gap: 4,
      marginLeft: 6,
    }}
  >
    <button
      onClick={(e) => {
        e.stopPropagation();
        markAttendance(signup.id, "present");
      }}
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        border: "none",
        background:
          signup.attendance === "present"
            ? "#22c55e"
            : "rgba(255,255,255,.08)",
        color: "white",
        cursor: "pointer",
        fontWeight: 900,
        filter: "none",
isolation: "isolate",
mixBlendMode: "normal",
position: "relative",
zIndex: 20,

      }}
    >
      ✓
    </button>

    <button
      onClick={(e) => {
        e.stopPropagation();
        markAttendance(signup.id, "missing");
      }}
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        border: "none",
        background:
          signup.attendance === "missing"
            ? "#ef4444"
            : "rgba(255,255,255,.08)",
        color: "white",
        cursor: "pointer",
        fontWeight: 900,
        filter: "none",
isolation: "isolate",
mixBlendMode: "normal",
position: "relative",
zIndex: 20,

      }}
    >
      ✕
    </button>
  </div>
)}
    </div>
  );
}

function parseSignup(player: string) {
  const parts = player.split(" - ");
  return {
    character: parts[0] || player,
  };
}

function SpecIcon({ player }: { player: string }) {
  const iconPath = getSpecIconPath(player);
  if (!iconPath) return null;
  return <img src={iconPath} style={specIcon} />;
}

function getSpecIconPath(player: string) {
  const parts = player.split(" - ");
  if (parts.length < 2) return null;

  let specClass = parts[1].toLowerCase().trim();

  specClass = specClass
    .replace("demonhunter", "demon hunter")
    .replace("dh", "demon hunter")
    .replace(/\s+/g, " ");

  const fixes: Record<string, string> = {
    "guardian druid": "druid-guardian",
    "balance druid": "druid-balance",
    "restoration druid": "druid-restoration",
    "feral druid": "druid-feral",

    "vengeance demon hunter": "demonhunter-vengeance",
    "havoc demon hunter": "demonhunter-havoc",
    "devourer demon hunter": "demonhunter-devourer",

    "blood death knight": "deathknight-blood",
    "frost death knight": "deathknight-frost",
    "unholy death knight": "deathknight-unholy",

    "elemental shaman": "shaman-elemental",
    "enhancement shaman": "shaman-enhancement",
    "restoration shaman": "shaman-restoration",

    "holy paladin": "paladin-holy",
    "protection paladin": "paladin-protection",
    "retribution paladin": "paladin-retribution",

    "holy priest": "priest-holy",
    "discipline priest": "priest-discipline",
    "shadow priest": "priest-shadow",

    "frost mage": "mage-frost",
    "fire mage": "mage-fire",
    "arcane mage": "mage-arcane",

    "mistweaver monk": "monk-mistweaver",
    "windwalker monk": "monk-windwalker",
    "brewmaster monk": "monk-brewmaster",

    "arms warrior": "warrior-arms",
    "fury warrior": "warrior-fury",
    "protection warrior": "warrior-protection",

    "affliction warlock": "warlock-affliction",
    "demonology warlock": "warlock-demonology",
    "destruction warlock": "warlock-destruction",

    "assassination rogue": "rogue-assassination",
    "outlaw rogue": "rogue-outlaw",
    "subtlety rogue": "rogue-subtlety",

    "beast mastery hunter": "hunter-beastmastery",
    "marksman hunter": "hunter-marksmanship",
    "marksmanship hunter": "hunter-marksmanship",
    "survival hunter": "hunter-survival",
  };

  const fileName = fixes[specClass];
  if (!fileName) return null;

  return `/icons/${fileName}.png`;
}
function getRunTheme(run: Run, index: number) {
  const title = run.title.toLowerCase();

  const isHC = title.includes("hc");

  const bossMatch = title.match(/(\d+)\/9/i);
  const bossCount = bossMatch ? Number(bossMatch[1]) : 0;

  if (isHC) {
    return {
      bg: "/hc-bg.png",
      glow: "rgba(14,165,233,.95)",
      title: "#38dfff",
      emblem: "/hc-emblem.png",
    };
  }

  if (bossCount <= 5) {
    return {
      bg: "/mythic-purple-bg.png",
      glow: "rgba(239,68,68,.9)",
      title: "#e9d5ff",
      emblem: "/mythic-red-emblem.png",
    };
  }

  return {
    bg: "/mythic-red-bg.png",
    glow: "rgba(250,204,21,.75)",
    title: "#ffffff",
    emblem: "/mythic-emblem.png",
  };
}

function getClassColor(className?: string) {
  const colors: Record<string, string> = {
    Druid: "#ff7c0a",
    "Death Knight": "#c41e3a",
    "Demon Hunter": "#a330c9",
    Hunter: "#aad372",
    Mage: "#3fc7eb",
    Monk: "#00ff98",
    Paladin: "#f48cba",
    Priest: "#ffffff",
    Rogue: "#fff468",
    Shaman: "#0070dd",
    Warlock: "#8788ee",
    Warrior: "#c69b6d",
  };

  return colors[className || ""] || "#ffffff";
}

function getIlvlColor(ilvl?: number) {
  if (!ilvl) return "#9ca3af";

  if (ilvl >= 285) return "#ff66ff";
  if (ilvl >= 280) return "#c026d3";
  if (ilvl >= 275) return "#0ea5e9";
  if (ilvl >= 270) return "#22c55e";

  return "#9ca3af";
}

function getRoleIcon(role: string) {
  if (role === "Tank") return "♢";
  if (role === "Healer") return "✚";
  if (role === "DPS") return "⚔";
  if (role === "Bench") return "♣";
  if (role === "Loot Body") return "💰";
  return "";
}

function getRoleLabel(role: string) {
  if (role === "Loot Body") return "LB";
  return role.toUpperCase();
}

function darkenColor(color: string) {
  if (color === "#1d8cff") return "#0f3f91";
  if (color === "#22c55e") return "#166534";
  if (color === "#ef4444") return "#7f1d1d";
  if (color === "#a855f7") return "#581c87";
  if (color === "#f97316") return "#9a3412";
  return "#374151";
}

const controlPanel: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 2.2fr 1.2fr",
  alignItems: "center",
  gap: 0,

  width: "100%",
  maxWidth: 1050,
  margin: "0",
  padding: "22px 28px",
transition: "all .22s ease",
cursor: "pointer",
  borderRadius: 22,
  background:
    "linear-gradient(180deg, rgba(14,0,32,.82), rgba(5,0,15,.92))",
  border: "1px solid rgba(168,85,247,.55)",

  boxShadow:
    "0 0 32px rgba(168,85,247,.38), inset 0 0 28px rgba(168,85,247,.14)",

  backdropFilter: "blur(14px)",
  position: "relative",
  zIndex: 2,
};

const controlBox: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 4,
};

const controlLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#b68cff",
  letterSpacing: 1,
  textTransform: "uppercase",
};

const controlValue: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 800,
  color: "#fff",
  textShadow: "0 0 16px rgba(255,255,255,.35)",
};

const controlSub: React.CSSProperties = {
  fontSize: 13,
  color: "#b8b8c7",
};

const page: React.CSSProperties = {
  position: "relative",
  overflow: "hidden",
  minHeight: "100vh",
  background: `
  linear-gradient(rgba(0,0,0,.22), rgba(0,0,0,.68)),
  url('/bg.png') center top / cover fixed
`,
  color: "white",
  fontFamily: "Arial, sans-serif",
  paddingBottom: 120,
};

const hero: React.CSSProperties = {
  zIndex: 2,
  textAlign: "center",
  position: "relative",
  overflow: "hidden",
  paddingTop: 30,
};

const heroTitle: React.CSSProperties = {
    fontSize: 64,
  fontFamily: "Georgia, serif",
  margin: 0,
  marginBottom: -6,
letterSpacing: 1,
  color: "#f3e8ff",
  textShadow: "0 0 18px #a855f7",
};

const weekButtons: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",

  width: "100%",
  maxWidth: 1380,

  margin: "0 auto 4px",
};

const weekButton: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 40,
  border: "1px solid #7e22ce",
  background:
    "linear-gradient(180deg, rgba(35,8,65,.95), rgba(8,0,20,.98))",
  color: "#ffffff",
  fontWeight: 1500,
  fontSize: 25,
  minWidth: 100,
  cursor: "pointer",
  textShadow: "0 0 8px rgba(255,255,255,.7)",
  boxShadow:
    "0 0 10px rgba(168,85,247,.35), inset 0 0 10px rgba(168,85,247,.25)",
  transition: "all .18s ease",
};

const weekButtonActive: React.CSSProperties = {
  border: "2px solid #facc15",
  background:
    "linear-gradient(180deg, rgba(95,60,8,.98), rgba(20,8,0,.98))",
  color: "#fff7cc",
  boxShadow:
    "0 0 22px rgba(250,204,21,.9), inset 0 0 14px rgba(250,204,21,.35)",
};

const weekDateText: React.CSSProperties = {
  marginTop: 2,
  fontSize: 15,
  color: "#d8b4fe",
  fontWeight: 900,
};

const characterBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 8,
  flexWrap: "wrap",

  marginTop: "2px",
  marginBottom: 18,
};

const characterButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: "rgba(10,0,25,.85)",
  color: "white",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
};

const runsGrid = {
  width: "100%",
  maxWidth: "2400px",
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(760px, 1fr))",
  gap: 30,
  alignItems: "start",
  justifyContent: "center",
  padding: "0 8px 40px",
};

const runCard: React.CSSProperties = {
  overflow: "visible",
  border: "none",
  borderRadius: 14,
  background: "rgba(0,0,0,.72)",
  minHeight: 560,
  width: "100%",
  display: "flex",
  flexDirection: "column",
  transition: "all .25s ease",
  cursor: "pointer",
  margin: "0 auto",
  
};

const runBanner: React.CSSProperties = {
  position: "relative",
  height: 180,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundSize: "cover",
  backgroundPosition: "center",
};

const cornerFlag: React.CSSProperties = {
  position: "absolute",
  top: -14,
  right: 45,
  width: 80,
  height: 120,
  objectFit: "contain",
  zIndex: 5,
  filter: "none",
};

const runTitle: React.CSSProperties = {
  fontSize: 40,
  fontFamily: "Georgia, serif",
  fontWeight: 900,
  margin: 0,
  textShadow: "0 0 14px rgba(255,255,255,.22)",
};

const runTime: React.CSSProperties = {
  marginTop: 8,
  color: "#c8b8a0",
  fontSize: 16,
};

const runNotes: React.CSSProperties = {
  marginTop: 8,
  color: "#d8b4fe",
  fontSize: 14,
  fontWeight: 800,
  textShadow: "0 0 8px rgba(168,85,247,.65)",
};

const roleGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  flex: 1,
};

const roleBox: React.CSSProperties = {
  padding: 10,
  background: "rgba(0,0,0,.28)",
  border: "1px solid rgba(255,255,255,.10)",
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
overflow: "hidden",
};

const roleTitle: React.CSSProperties = {
  textAlign: "center",
  fontWeight: 900,
  marginBottom: 0,
  textShadow: "0 0 18px currentColor",
  letterSpacing: 1,
  paddingTop: 6,
};

const signupList: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 5,
  overflow: "visible",
};

const signupPill: React.CSSProperties = {
  border: "1px solid",
  background: "rgba(20,16,10,.92)",
  borderRadius: 4,
  padding: "5px 8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 15,
  maxWidth: "100%",
  overflow: "hidden",
  minWidth: 0,
};

const removeButton: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#ff5555",
  cursor: "pointer",
  fontWeight: 900,
};

const roleButton: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.25)",
  color: "white",
  fontWeight: 900,
  height: 42,
  cursor: "pointer",
  borderRadius: 4,
  textShadow: "0 1px 2px black",
  marginTop: "auto",
};

const specIcon: React.CSSProperties = {
  width: 23,
  height: 23,
  borderRadius: 4,
  flexShrink: 0,
};

const footer: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  height: 82,
  background: "rgba(5,7,12,.92)",
  borderTop: "1px solid rgba(255,255,255,.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 42px",
  zIndex: 50,
};

const footerLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const footerLogo: React.CSSProperties = {
  width: 52,
  height: 52,
};

const footerMiddle: React.CSSProperties = {
  display: "flex",
  gap: 24,
  color: "#bca38c",
  fontWeight: 700,
};

const footerRight: React.CSSProperties = {
  textAlign: "right",
};

const createArea: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: "calc(100vw - 120px)",
  maxWidth: 1800,
  margin: "0 auto 24px",
};

const createRunButton: React.CSSProperties = {
  padding: "14px 22px",
  borderRadius: 14,
  border: "1px solid #9333ea",
  background: "rgba(20,0,40,.95)",
  color: "white",
  fontWeight: 900,
  fontSize: 18,
  cursor: "pointer",
  boxShadow: "0 0 16px rgba(168,85,247,.75)",
};

const createRunPanel: React.CSSProperties = {
  position: "relative",
  zIndex: 1000000,
  width: 320,
  padding: 24,
  borderRadius: 18,
  border: "1px solid rgba(168,85,247,.45)",
  background: "rgba(5,0,20,.95)",
  boxShadow: "0 0 24px rgba(168,85,247,.35)",
  marginTop: 16,
};

const createRunTitle: React.CSSProperties = {
  color: "white",
  fontSize: 28,
  fontWeight: 900,
  marginBottom: 18,
};

const createInput: React.CSSProperties = {
  width: "100%",
  marginBottom: 14,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid rgba(168,85,247,.35)",
  background: "rgba(15,0,35,.9)",
  color: "white",
  fontWeight: 700,
  fontSize: 15,
};

const createRunConfirm: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(90deg,#9333ea,#d946ef)",
  color: "white",
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
  boxShadow: "0 0 18px rgba(217,70,239,.55)",
};

const deleteRunButton: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 10,
  border: "1px solid rgba(239,68,68,.75)",
  background: "rgba(70,0,0,.75)",
  color: "#fecaca",
  fontSize: 18,
  cursor: "pointer",
  transition: "all .18s ease",
transform: "scale(1)",
  boxShadow: "0 0 14px rgba(239,68,68,.65)",
};

const editRunButton: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,.75)",
  background: "rgba(20,0,50,.75)",
  color: "#e9d5ff",
  fontSize: 18,
  cursor: "pointer",
  transition: "all .18s ease",
transform: "scale(1)",
  boxShadow: "0 0 14px rgba(168,85,247,.65)",
};

const cancelEditButton: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  marginTop: 10,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.25)",
  background: "rgba(255,255,255,.08)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const addWeekButton: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 40,
  border: "1px solid #facc15",
  background:
    "linear-gradient(180deg, rgba(95,60,8,.95), rgba(20,8,0,.98))",
  color: "#fff7cc",
  fontWeight: 900,
  fontSize: 18,
  cursor: "pointer",

  boxShadow:
    "0 0 18px rgba(250,204,21,.65), inset 0 0 12px rgba(250,204,21,.18)",

  transition: "all .18s ease",

  position: "relative",
  zIndex: 5,
  overflow: "visible",
};

const removeWeekButton: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: 40,
  border: "1px solid rgba(239,68,68,.75)",
  background:
    "linear-gradient(180deg, rgba(70,0,0,.95), rgba(20,0,0,.98))",

  color: "#fecaca",
  fontWeight: 900,
  fontSize: 18,
  cursor: "pointer",

  boxShadow:
    "0 0 18px rgba(239,68,68,.55), inset 0 0 12px rgba(239,68,68,.18)",

  transition: "all .18s ease",

  position: "relative",
  zIndex: 5,
  overflow: "visible",
};

const popupOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.65)",
  zIndex: 99999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const popupBox: React.CSSProperties = {
  width: 430,
  padding: "34px 34px 28px",
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,.25)",
  background:
    "linear-gradient(180deg, rgba(13,17,23,.98), rgba(5,8,13,.98))",
  boxShadow:
    "0 0 35px rgba(0,0,0,.9), 0 0 22px rgba(168,85,247,.35)",
  textAlign: "center",
};

const popupIcon: React.CSSProperties = {
  width: 54,
  height: 54,
  borderRadius: "50%",
  border: "4px solid #ef4444",
  color: "#ef4444",
  fontSize: 42,
  lineHeight: "45px",
  fontWeight: 900,
  margin: "0 auto 22px",
};

const popupTitle: React.CSSProperties = {
  color: "white",
  fontSize: 28,
  fontWeight: 900,
  marginBottom: 16,
};

const popupText: React.CSSProperties = {
  color: "#f3f4f6",
  fontSize: 16,
  lineHeight: 1.6,
  marginBottom: 24,
};

const popupButton: React.CSSProperties = {
  width: 130,
  height: 44,
  borderRadius: 10,
  border: "none",
  background: "linear-gradient(180deg,#d946ef,#7e22ce)",
  color: "white",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 0 18px rgba(168,85,247,.75)",
};

const magicFog: React.CSSProperties = {
  position: "fixed",
  top: "10%",
  left: "-10%",
  width: 700,
  height: 700,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(168,85,247,.35), transparent 90%)",
  filter: "blur(65px)",
  pointerEvents: "none",
  zIndex: 1,
  animation: "fogFloat1 12s ease-in-out infinite",
};

const magicFog2: React.CSSProperties = {
  position: "fixed",
  bottom: "-10%",
  right: "-10%",
  width: 900,
  height: 900,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(14,165,233,.28), transparent 90%)",
  filter: "blur(75px)",
  pointerEvents: "none",
  zIndex: 0,
  animation: "fogFloat2 16s ease-in-out infinite",
};

const castlePurpleGlow: React.CSSProperties = {
  position: "fixed",
  top: 45,
  right: 120,
  width: 520,
  height: 820,
  background:
    "radial-gradient(circle at 50% 18%, rgba(168,85,247,.75), rgba(168,85,247,.22) 24%, rgba(124,58,237,.12) 42%, transparent 100%)",
  filter: "blur(34px)",
  mixBlendMode: "screen",
  pointerEvents: "none",
  zIndex: 1,
  opacity: 1,
  
};

const castleLightBeam: React.CSSProperties = {
  position: "fixed",
  top: 20,
  right: 335,
  width: 18,
  height: 660,
  background:
    "linear-gradient(to bottom, rgba(216,180,254,.85), rgba(168,85,247,.45), rgba(168,85,247,.08), transparent)",
  filter: "blur(10px)",
  mixBlendMode: "screen",
  pointerEvents: "none",
  zIndex: 1,
  opacity: 0.75,
};

const smallFilter = (active: boolean): React.CSSProperties => ({
  padding: "10px 18px",
  borderRadius: 12,
  border: active ? "1px solid #facc15" : "1px solid rgba(168,85,247,.5)",
  background: active
    ? "linear-gradient(180deg, rgba(95,60,8,.95), rgba(20,8,0,.98))"
    : "rgba(20,10,35,.9)",
  color: active ? "#fff7cc" : "#fff",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: active
    ? "0 0 18px rgba(250,204,21,.7)"
    : "0 0 12px rgba(168,85,247,.25)",
  transition: "all .18s ease",
});
const epicTitleOrnament: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: "100%",
  maxWidth: 1650,
  height: 42,
  margin: "-8px auto 38px",
};

const epicLineLeft: React.CSSProperties = {
  position: "absolute",
  top: 24,
  right: "50%",
  width: "48%",
  height: 3,

  background:
    "linear-gradient(to left, rgba(236,72,153,.0), rgba(192,132,252,.95), rgba(168,85,247,.45), transparent)",

  boxShadow:
    "0 0 8px rgba(192,132,252,.95), 0 0 18px rgba(168,85,247,.85)",

  opacity: 0.95,
};

const epicLineRight: React.CSSProperties = {
  position: "absolute",
  top: 24,
  left: "50%",
  width: "48%",
  height: 3,

  background:
    "linear-gradient(to right, rgba(236,72,153,.0), rgba(192,132,252,.95), rgba(168,85,247,.45), transparent)",

  boxShadow:
    "0 0 8px rgba(192,132,252,.95), 0 0 18px rgba(168,85,247,.85)",

  opacity: 0.95,
};

const epicCenterDiamond: React.CSSProperties = {
  position: "absolute",
  left: "50%",
top: 18,
width: 10,
height: 10,
  transform: "translateX(-50%) rotate(45deg)",

  border: "2px solid #d8b4fe",

  background:
    "linear-gradient(135deg, rgba(255,255,255,.95), rgba(192,132,252,.55))",

  boxShadow:
    "0 0 10px rgba(255,255,255,.95), 0 0 12px rgba(192,132,252,.75)",
};
const topControlRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 28,
  width: "100%",
  maxWidth: 1700,
  margin: "0 auto 12px",
};
const chatMessageBox: React.CSSProperties = {
  background: "rgba(255,255,255,.04)",
  padding: 10,
  borderRadius: 12,
  border: "1px solid rgba(168,85,247,.16)",
};
const chatMessageTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
};

const chatAvatar: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: "50%",
  objectFit: "cover",
  border: "1px solid rgba(168,85,247,.4)",
};

const chatName: React.CSSProperties = {
  fontWeight: 800,
  color: "#ffffff",
  fontSize: 14,
};

const chatTime: React.CSSProperties = {
  fontSize: 11,
  color: "#9ca3af",
  marginTop: 2,
};

const chatText: React.CSSProperties = {
  color: "#f3f4f6",
  fontSize: 14,
  lineHeight: 1.4,
  wordBreak: "break-word",
};
const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.72)",
  backdropFilter: "blur(10px)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999999,
};
const dayButtons: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 10,
  marginBottom: 22,
};

const dayButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 14,
  border: "1px solid #7e22ce",
  background: "rgba(10,0,25,.85)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 0 12px rgba(168,85,247,.3)",
  transition: "all .18s ease",
};

const dayButtonActive: React.CSSProperties = {
  border: "1px solid #facc15",
  background: "linear-gradient(90deg,#6b21a8,#d946ef)",
  boxShadow: "0 0 20px rgba(250,204,21,.75)",
};
const fieldLabel: React.CSSProperties = {
  color: "#c084fc",
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 6,
  marginTop: 10,
  textTransform: "uppercase",
  letterSpacing: 1,
};