"use client";

import { useState } from "react";

export default function SignOutButton({
  className,
  label = "Sign out",
}: {
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Sign out failed. Please try again.");
      window.location.replace("/auth/sign-in");
    } catch {
      setError("Sign out failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <span className={className}>
      <button type="button" onClick={() => void signOut()} disabled={busy}>
        {busy ? "Signing out…" : label}
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
