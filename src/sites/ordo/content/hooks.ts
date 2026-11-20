import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";

/** True when the visitor prefers less motion or has paused the page's animations. */
export function useStill() {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  return Boolean(reduced) || paused;
}

/**
 * The id of the section the reader is in: the last of `ids` whose top has
 * passed a line a little below the sticky header. Recomputed on scroll and
 * resize only, with one read per animation frame at most.
 */
export function useScrollSpy(ids: string[], offset = 140) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join("|");

  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (list.length === 0) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      let current: string | null = null;
      for (const id of list) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top - offset <= 0) current = id;
      }
      // At the very bottom the last section counts, however short it is.
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atEnd && current) current = list[list.length - 1];
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [key, offset]);

  return active;
}

/** The sticky header's current height, so bars and toolbars can sit just under it. */
export function useHeaderHeight(fallback = 64) {
  const [height, setHeight] = useState(fallback);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".portfolio-header");
    if (!header) return;
    const measure = () => setHeight(Math.round(header.getBoundingClientRect().height) || fallback);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, [fallback]);
  return height;
}

/** "The results" -> "the-results", for heading anchors. */
export const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
