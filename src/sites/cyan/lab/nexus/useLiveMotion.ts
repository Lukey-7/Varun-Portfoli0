import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";

/** True when the archive may animate: no reduced-motion preference and the site-wide pause is off. */
export function useLiveMotion() {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  return !reduced && !paused;
}
