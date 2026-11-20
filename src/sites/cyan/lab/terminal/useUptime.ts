import { useEffect, useState } from "react";

/**
 * Whole seconds since the component mounted. The one-second tick stops while
 * `paused` is true (the reading holds still), and catches up when it resumes,
 * because it always measures from the same start.
 */
export function useUptime(paused: boolean) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    if (paused) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [paused]);
  return Math.max(0, Math.floor((now - start) / 1000));
}

/** 75 → "01:15"; an hour or more → "1:01:15". */
export function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
