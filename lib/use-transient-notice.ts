"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_NOTICE_DURATION_MS = 15_000;

/**
 * A short-lived workspace notice. Showing another message resets the timer;
 * passing an empty string or unmounting clears it immediately.
 */
export function useTransientNotice(durationMs = DEFAULT_NOTICE_DURATION_MS): [string, (message: string) => void] {
  const [notice, setNotice] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = useCallback((message: string) => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setNotice(message);
    if (!message) return;

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setNotice("");
    }, durationMs);
  }, [durationMs]);

  useEffect(() => () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return [notice, showNotice];
}
