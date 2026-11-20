import { useState } from "react";
import { useMotionValueEvent, useScroll } from "framer-motion";

/** Scrolled far enough that the header condenses. */
const CONDENSE_AT = 48;
/** Scrolled far enough that a way back up earns its place. */
const RETURN_AT = 900;

/**
 * The header's two scroll states, from one passive listener. State only
 * changes when a threshold is crossed, so scrolling does not re-render.
 */
export function useScrollChrome() {
  const { scrollY, scrollYProgress } = useScroll();
  const [condensed, setCondensed] = useState(false);
  const [farDown, setFarDown] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => {
    setCondensed(y > CONDENSE_AT);
    setFarDown(y > RETURN_AT);
  });
  return { condensed, farDown, scrollYProgress };
}
