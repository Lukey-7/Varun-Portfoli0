import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { isMotionPaused, useMotionPaused } from "@/lib/motion-pause";

/** True when nothing should move: the visitor's reduced-motion setting or the site-wide pause. */
export function useStill() {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  return Boolean(reduced) || paused;
}

/**
 * Counts up to a whole number once, like a meter settling. Under reduced motion
 * or the pause it shows the value at once, and pausing mid-count finishes it.
 */
export function useCountUp(target: number, duration = 900, delay = 0) {
  const still = useStill();
  const [value, setValue] = useState(still ? target : 0);

  useEffect(() => {
    if (still) {
      setValue(target);
      return;
    }
    let frame = 0;
    let started = 0;
    const tick = (now: number) => {
      if (!started) started = now;
      const elapsed = now - started - delay;
      const progress = Math.min(1, Math.max(0, elapsed / duration));
      if (isMotionPaused() || progress >= 1) {
        setValue(target);
        return;
      }
      // The site's ease-out: fast, then settling onto the value.
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 4))));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, delay, still]);

  return value;
}
