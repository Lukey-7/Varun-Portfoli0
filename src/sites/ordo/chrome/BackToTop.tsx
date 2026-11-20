import { useEffect, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion, type MotionValue } from "framer-motion";
import { ArrowUp } from "lucide-react";

/**
 * A square return control that appears once a page has been read a fair way.
 * Its outline inks in as the reader goes, so it doubles as a quiet progress
 * gauge. Activated from the keyboard, focus lands on the site name at the top.
 */
export function BackToTop({ shown, progress }: { shown: boolean; progress: MotionValue<number> }) {
  const reduced = useReducedMotion();
  // The footer carries its own "Back to top" link; step aside once it shows.
  const [footerInView, setFooterInView] = useState(false);
  useEffect(() => {
    const footer = document.querySelector(".ordo-edition .portfolio-footer");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setFooterInView(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  const toTop = (event: MouseEvent<HTMLButtonElement>) => {
    const fromKeyboard = event.detail === 0;
    window.scrollTo({ top: 0, behavior: reduced ? ("instant" as ScrollBehavior) : "smooth" });
    if (fromKeyboard) {
      document.querySelector<HTMLElement>(".portfolio-header .wordmark")?.focus({ preventScroll: true });
    } else {
      event.currentTarget.blur();
    }
  };
  return (
    <AnimatePresence>
      {shown && !footerInView && (
        <motion.button
          key="back-to-top"
          type="button"
          className="chrome-top"
          aria-label="Back to top"
          title="Back to top"
          onClick={toTop}
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 8 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <motion.rect
              x="0.5"
              y="0.5"
              width="39"
              height="39"
              fill="none"
              strokeWidth="1"
              style={{ pathLength: progress }}
            />
          </svg>
          <ArrowUp size={15} strokeWidth={1.6} aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
