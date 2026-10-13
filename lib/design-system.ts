export const DESIGN_THEME_IDS = [
  "claude",
  "discord",
  "supabase",
  "vercel",
  "mono",
  "notebook",
  "light-green",
  "zen",
  "astro-vista",
  "whatsapp",
] as const;

export type DesignThemeId = (typeof DESIGN_THEME_IDS)[number];

// Keep the initial HTML data-theme value validated before the client provider hydrates.
export const DEFAULT_DESIGN_THEME: DesignThemeId = "supabase";

export function isDesignThemeId(value: string | undefined): value is DesignThemeId {
  return value !== undefined && DESIGN_THEME_IDS.some((theme) => theme === value);
}
