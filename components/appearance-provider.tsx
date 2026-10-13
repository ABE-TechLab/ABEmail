"use client";

import { persistUserPreferences } from "@/lib/supabase/preferences";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppearanceMode = "light" | "dark" | "system";

type AppearanceModeContextValue = {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
};

const AppearanceModeContext = createContext<AppearanceModeContextValue | undefined>(undefined);
const MODE_COOKIE = "appearance_mode";
const MODE_MAX_AGE = 31_536_000;

function isAppearanceMode(value: string | undefined): value is AppearanceMode {
  return value === "light" || value === "dark" || value === "system";
}

function applyAppearanceMode(mode: AppearanceMode) {
  const prefersDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.dataset.appearanceMode = mode;
  document.documentElement.classList.toggle("dark", prefersDark);
  document.documentElement.style.colorScheme = mode === "system" ? "light dark" : prefersDark ? "dark" : "light";
}

export function AppearanceProvider({
  children,
  initialMode,
}: {
  children: ReactNode;
  initialMode: AppearanceMode;
}) {
  const [mode, setModeState] = useState<AppearanceMode>(
    isAppearanceMode(initialMode) ? initialMode : "light",
  );

  const setMode = useCallback((nextMode: AppearanceMode) => {
    if (!isAppearanceMode(nextMode)) return;

    // Apply changes in the click handler so the page responds immediately,
    // rather than waiting for the effect below to run after React commits.
    setModeState(nextMode);
    if (typeof window !== "undefined") {
      applyAppearanceMode(nextMode);
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${MODE_COOKIE}=${nextMode}; Path=/; Max-Age=${MODE_MAX_AGE}; SameSite=Lax${secure}`;
    }
  }, []);

  useEffect(() => {
    const applyAndPersist = () => {
      applyAppearanceMode(mode);
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${MODE_COOKIE}=${mode}; Path=/; Max-Age=${MODE_MAX_AGE}; SameSite=Lax${secure}`;
    };

    applyAndPersist();
    void persistUserPreferences({ appearance_mode: mode }).catch(() => undefined);

    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateForDevicePreference = () => applyAppearanceMode("system");
    mediaQuery.addEventListener("change", updateForDevicePreference);
    return () => mediaQuery.removeEventListener("change", updateForDevicePreference);
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <AppearanceModeContext.Provider value={value}>
      {children}
    </AppearanceModeContext.Provider>
  );
}

export function useAppearanceMode() {
  const context = useContext(AppearanceModeContext);
  if (!context) {
    throw new Error("useAppearanceMode must be used within an AppearanceProvider");
  }
  return context;
}
