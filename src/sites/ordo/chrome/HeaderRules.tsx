import { motion, useReducedMotion, useSpring, type MotionValue } from "framer-motion";

const EASE = [0.65, 0, 0.35, 1] as const;

/** An inked hairline over the header rule, as long as the share of the page read. */
export function ReadingProgress({ progress }: { progress: MotionValue<number> }) {
  const reduced = useReducedMotion();
  // The spring only steps while it is catching up; at rest it schedules nothing.
  const smooth = useSpring(progress, { stiffness: 320, damping: 42, restDelta: 0.0005 });
  return (
    <motion.span
      className="chrome-progress"
      aria-hidden="true"
      style={{ scaleX: reduced ? progress : smooth }}
    />
  );
}

/**
 * Drawn once across the header rule each time a new page arrives, then let go:
 * the page change reads as a single stroke of the pen. Keyed by the caller.
 */
export function RouteRule() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <motion.span
      className="chrome-route-rule"
      aria-hidden="true"
      initial={{ scaleX: 0, opacity: 1 }}
      animate={{ scaleX: [0, 1, 1], opacity: [1, 1, 0] }}
      transition={{ duration: 1.05, times: [0, 0.5, 1], ease: EASE }}
    />
  );
}
