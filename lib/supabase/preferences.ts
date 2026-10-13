"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type UserPreferenceUpdate = {
  appearance_mode?: "light" | "dark" | "system";
  design_theme?:
    | "claude"
    | "discord"
    | "supabase"
    | "vercel"
    | "mono"
    | "notebook"
    | "light-green"
    | "zen"
    | "astro-vista"
    | "whatsapp";
};

export async function persistUserPreferences(
  preferences: UserPreferenceUpdate,
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // The current preview UI has no sign-in flow yet. Keep local preferences
  // working until an authenticated user is present.
  if (authError || !user) return;

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      { user_id: user.id, ...preferences, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) {
    // Preference persistence must not break the appearance controls.
    console.error("Unable to save user preferences to Supabase.", error.message);
  }
}
