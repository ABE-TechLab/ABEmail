"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./pilot-setup-button.module.css";

type PilotSetupResponse = {
  ok?: boolean;
  organizationId?: string;
  error?: string;
  note?: string;
};

export default function PilotSetupButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function startSetup() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/pilot/ottawa-snow-match/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json() as PilotSetupResponse;
      if (!response.ok || !result.ok || !result.organizationId) {
        setMessage(result.error || "Pilot setup could not be completed.");
        return;
      }
      setMessage(result.note || "Pilot workspace configured. Opening its inbox.");
      router.push("/dashboard/" + result.organizationId + "/mail");
      router.refresh();
    } catch {
      setMessage("The setup request failed. Check the environment configuration and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className="mail-primary-action" onClick={startSetup} disabled={busy}>
        {busy ? "Checking Resend…" : "Set up Ottawa pilot"}
      </button>
      {message && <p className={styles.message} role="status">{message}</p>}
    </div>
  );
}
