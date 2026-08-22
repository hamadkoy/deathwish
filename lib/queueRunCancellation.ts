import { supabase } from "@/lib/supabase";

/**
 * Records who was signed up for a run so the Discord bot can DM them
 * that it was cancelled.
 *
 * Must be called BEFORE the signups are deleted, otherwise the roster
 * is already gone.
 */
export async function queueRunCancellation(
  run: any,
  cancelledBy?: string
) {
  try {
    console.log("QUEUE START", run?.id);

    if (!run?.id) return;

    const { data: runSignups, error: signupError } = await supabase
      .from("signups")
      .select("discord_id, player, role")
      .eq("run_id", run.id);

    console.log("QUEUE SIGNUPS", runSignups, signupError);

    // Loot Body signups are alts, so skip them to avoid double DMs.
    const notify = (runSignups || []).filter(
      (s: any) => s.discord_id && s.role !== "Loot Body"
    );

    const discordIds = Array.from(
      new Set(notify.map((s: any) => s.discord_id as string))
    );

    console.log("QUEUE IDS", discordIds);

    if (discordIds.length === 0) return;

    const { error } = await supabase.from("run_cancellations").insert({
      run_id: run.id,
      run_title: run.title || "",
      run_day: run.day || "",
      run_time: run.time || "",
      run_date: run.run_date || "",
      week: run.week ?? null,
      discord_ids: discordIds,
      player_names: notify.map((s: any) => s.player),
      cancelled_by: cancelledBy || "An officer",
    });

    console.log("QUEUE INSERT DONE", error);

    if (error) {
      console.error("queueRunCancellation failed:", error.message);
    }
  } catch (err) {
    console.error("queueRunCancellation error:", err);
  }
}