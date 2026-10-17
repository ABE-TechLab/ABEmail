"use client";

import { useEffect, useState } from "react";
import { useAppearanceMode } from "@/components/appearance-provider";

export default function AppearanceToggle() {
  const { mode, setMode } = useAppearanceMode();
  const [isDark, setIsDark] = useState(mode === "dark");

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, [mode]);

  function toggleAppearance() {
    const nextIsDark = !document.documentElement.classList.contains("dark");
    setIsDark(nextIsDark);
    setMode(nextIsDark ? "dark" : "light");
  }

  return (
    <button
      className="mail-appearance-toggle"
      type="button"
      onClick={toggleAppearance}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span aria-hidden="true">{isDark ? "☼" : "☾"}</span>
    </button>
  );
}
