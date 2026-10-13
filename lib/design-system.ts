export const DESIGN_THEMES = [
  { name: "Claude", value: "claude" },
  { name: "Discord", value: "discord" },
  { name: "Supabase", value: "supabase" },
  { name: "Vercel", value: "vercel" },
  { name: "Mono", value: "mono" },
  { name: "Notebook", value: "notebook" },
  { name: "Light Green", value: "light-green" },
  { name: "Zen", value: "zen" },
  { name: "Astro Vista", value: "astro-vista" },
  { name: "WhatsApp", value: "whatsapp" },
] as const;

export const DESIGN_THEME_IDS = DESIGN_THEMES.map((theme) => theme.value);

export type DesignThemeId = (typeof DESIGN_THEMES)[number]["value"];

// Keep the initial HTML data-theme value validated before the client hydrates.
export const DEFAULT_DESIGN_THEME: DesignThemeId = "supabase";

export function isDesignThemeId(value: string | undefined): value is DesignThemeId {
  return value !== undefined && DESIGN_THEME_IDS.some((theme) => theme === value);
}
