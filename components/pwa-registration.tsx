"use client";

import { useEffect, useState } from "react";

export default function PwaRegistration() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const updateConnection = () => setOffline(!navigator.onLine);
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let cancelled = false;
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (!cancelled) void registration.update().catch(() => undefined);
      })
      .catch((error: unknown) => {
        console.warn("ABEmail service worker registration failed.", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return offline ? (
    <div className="pwa-offline-notice" role="status" aria-live="polite">
      <span><strong>You are offline.</strong> ABEmail needs an internet connection to load mailbox data or send messages. Private workspace data is not stored for offline use.</span>
      <button type="button" onClick={() => window.location.reload()}>Try again</button>
    </div>
  ) : null;
}
