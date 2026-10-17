"use client";

import { useSyncExternalStore } from "react";
import { useAppearanceMode } from "@/components/appearance-provider";

function subscribeToAppearance(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getDarkModeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerDarkModeSnapshot() {
  return false;
}

export default function AppearanceToggle() {
  const { setMode } = useAppearanceMode();
  const isDark = useSyncExternalStore(
    subscribeToAppearance,
    getDarkModeSnapshot,
    getServerDarkModeSnapshot,
  );

  function toggleAppearance() {
    const nextIsDark = !document.documentElement.classList.contains("dark");
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
