import { supabase } from "@/lib/supabase";

/**
 * Copies the current Discord avatar, username and Discord ID from the
 * Supabase session into the profiles table.
 *
 * Discord avatar URLs contain a hash that changes whenever the user
 * updates their picture, so a value stored at signup goes stale and
 * eventually 404s. Calling this on every login keeps it current.
 */
export async function syncDiscordProfile() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const meta: any = user.user_metadata || {};

    const avatarUrl = meta.avatar_url || meta.picture || null;
    const discordName =
      meta.user_name || meta.preferred_username || meta.full_name || meta.name;
    const discordId = meta.provider_id || meta.sub || null;

    if (!avatarUrl && !discordName) return;

    const updates: Record<string, any> = {};

    if (avatarUrl) updates.avatar_url = avatarUrl;
    if (discordName) updates.discord_name = discordName;

    // Try with discord_id first; if that column doesn't exist yet the
    // update is retried without it.
    const withId = { ...updates, discord_id: discordId };

    const { error } = await supabase
      .from("profiles")
      .update(discordId ? withId : updates)
      .eq("user_id", user.id);

    if (error && discordId) {
      await supabase.from("profiles").update(updates).eq("user_id", user.id);
    }
  } catch (err) {
    console.error("syncDiscordProfile failed:", err);
  }
}