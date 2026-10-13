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
import {
  DEFAULT_DESIGN_THEME,
  isDesignThemeId,
  type DesignThemeId,
} from "@/lib/design-system";

type DesignThemeContextValue = {
  theme: DesignThemeId;
  setTheme: (theme: DesignThemeId) => void;
};

const DesignThemeContext = createContext<DesignThemeContextValue | undefined>(undefined);
const THEME_COOKIE = "active_theme";
const THEME_MAX_AGE = 31_536_000;

export function DesignThemeProvider({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: DesignThemeId;
}) {
  const [theme, setThemeState] = useState<DesignThemeId>(
    isDesignThemeId(initialTheme) ? initialTheme : DEFAULT_DESIGN_THEME,
  );

  const setTheme = useCallback((nextTheme: DesignThemeId) => {
    if (isDesignThemeId(nextTheme)) setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_MAX_AGE}; SameSite=Lax${secure}`;
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return (
    <DesignThemeContext.Provider value={value}>
      {children}
    </DesignThemeContext.Provider>
  );
}

export function useDesignTheme() {
  const context = useContext(DesignThemeContext);
  if (!context) {
    throw new Error("useDesignTheme must be used within a DesignThemeProvider");
  }
  return context;
}
