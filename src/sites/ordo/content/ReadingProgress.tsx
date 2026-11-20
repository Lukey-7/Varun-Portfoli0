import type { RefObject } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { useHeaderHeight, useStill } from "./hooks";

/**
 * A hairline under the sticky header that fills as the reader moves through
 * the article. It only draws on scroll (framer's scroll listener), so an idle
 * page does no work.
 */
export function ReadingProgress({ target }: { target: RefObject<HTMLElement> }) {
  const still = useStill();
  const top = useHeaderHeight();
  const { scrollYProgress } = useScroll({ target, offset: ["start 120px", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 220, damping: 34, restDelta: 0.001 });

  return (
    <div className="ct-progress" style={{ top }} aria-hidden="true">
      <motion.span style={{ scaleX: still ? scrollYProgress : smooth }} />
    </div>
  );
}
