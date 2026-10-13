"use client";

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

  document.documentElement.classList.toggle("dark", prefersDark);
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
    if (isAppearanceMode(nextMode)) setModeState(nextMode);
  }, []);

  useEffect(() => {
    const applyAndPersist = () => {
      applyAppearanceMode(mode);
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${MODE_COOKIE}=${mode}; Path=/; Max-Age=${MODE_MAX_AGE}; SameSite=Lax${secure}`;
    };

    applyAndPersist();

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
