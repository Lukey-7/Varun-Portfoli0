import { useEffect, useLayoutEffect, type RefObject } from "react";
import { isMotionPaused } from "@/lib/motion-pause";

/*
 * The home page's choreography, applied once to the rendered sections so the
 * shared components stay unchanged on other pages:
 *  - section labels decode from glyph noise and draw their rule,
 *  - headings resolve out of a soft blur, their second line just after,
 *  - lists and grids rise in a short stagger,
 *  - the hero buttons lean towards the pointer and press in.
 * Everything runs once per element, only for elements still below the fold,
 * and nothing runs under reduced motion. State lives in data attributes,
 * which React never rewrites, and is removed once each entrance has played.
 */

/** Children that rise in turn when they come into view. */
const STAGGER = [
  ".ordo-paths-grid > .ordo-path",
  ".ordo-path li",
  ".activity-stats > div",
  ".activity-bottom > div",
  ".research-grid > article",
  ".console-copy li",
  ".journey-teaser-list > li",
  ".about-teaser-grid > div > *",
  ".ordo-archive-row > a",
];

/** Elements framer-motion already animates, or that sit in the hero. */
const SKIP = ".hero, .capability-card, .ordo-project-grid";

const GLYPHS = "#%&*+=-<>/\\01";

const reducedMotion = () =>
  typeof window === "undefined" ||
  !window.matchMedia ||
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Swap a label's characters for glyph noise that settles left to right. */
function decode(node: HTMLElement) {
  const text = node.firstChild;
  if (node.childNodes.length !== 1 || !text || text.nodeType !== Node.TEXT_NODE) return;
  const original = text.nodeValue ?? "";
  const began = performance.now();
  const duration = 520;
  const step = (now: number) => {
    // React owns this text; if it was replaced meanwhile, leave it alone.
    if (!node.isConnected || node.firstChild !== text) return;
    const t = Math.min(1, (now - began) / duration);
    if (t >= 1) {
      text.nodeValue = original;
      return;
    }
    const settled = Math.floor(original.length * t);
    let next = original.slice(0, settled);
    for (let i = settled; i < original.length; i++) {
      const ch = original[i];
      next += /[\s[\]/·|]/.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    text.nodeValue = next;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function useHomeMotion(root: RefObject<HTMLElement>) {
  // Before first paint, so nothing flashes in and then hides.
  useLayoutEffect(() => {
    const host = root.current;
    if (!host || typeof IntersectionObserver === "undefined" || reducedMotion()) return;
    const skip = (el: Element) => el.closest(SKIP) !== null;
    const below = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.92;

    const targets: HTMLElement[] = [];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const mark = (el: HTMLElement, kind: string, index = 0) => {
      el.setAttribute("data-reveal", kind);
      el.removeAttribute("data-revealed");
      if (index) el.style.setProperty("--reveal-i", String(Math.min(index, 6)));
      targets.push(el);
    };
    // Back to the element's own styles, so its hover transitions apply again.
    const release = (el: HTMLElement) => {
      el.removeAttribute("data-reveal");
      el.removeAttribute("data-revealed");
      el.style.removeProperty("--reveal-i");
    };

    host.querySelectorAll<HTMLElement>(".ordo-section-label").forEach((label) => {
      if (!skip(label) && below(label)) mark(label, "rule");
    });
    host.querySelectorAll<HTMLElement>("h2").forEach((heading) => {
      if (!skip(heading) && below(heading)) mark(heading, "heading");
    });
    STAGGER.forEach((selector) => {
      Array.from(host.querySelectorAll<HTMLElement>(selector))
        .filter((item) => !skip(item) && below(item))
        .forEach((item, index) => mark(item, "rise", index));
    });
    if (!targets.length) return;
    host.setAttribute("data-choreo", "");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          el.setAttribute("data-revealed", "");
          if (el.dataset.reveal === "rule") {
            // The rule keeps its own transition; only the label text decodes.
            const first = el.firstElementChild;
            if (first instanceof HTMLElement && !isMotionPaused()) decode(first);
          } else {
            timers.push(setTimeout(() => release(el), 1800));
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
      targets.forEach(release);
      host.removeAttribute("data-choreo");
    };
  }, [root]);

  // Magnetic pull on the hero's actions, for a precise pointer only.
  useEffect(() => {
    const host = root.current;
    if (!host || reducedMotion()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const buttons = Array.from(host.querySelectorAll<HTMLElement>(".hero-actions > a"));
    const cleanups = buttons.map((button) => {
      const move = (event: PointerEvent) => {
        if (isMotionPaused()) return;
        const box = button.getBoundingClientRect();
        const x = (event.clientX - (box.left + box.width / 2)) / box.width;
        const y = (event.clientY - (box.top + box.height / 2)) / box.height;
        button.style.setProperty("--mx", `${(x * 8).toFixed(2)}px`);
        button.style.setProperty("--my", `${(y * 6).toFixed(2)}px`);
      };
      const leave = () => {
        button.style.removeProperty("--mx");
        button.style.removeProperty("--my");
      };
      button.setAttribute("data-magnetic", "");
      button.addEventListener("pointermove", move);
      button.addEventListener("pointerleave", leave);
      return () => {
        leave();
        button.removeAttribute("data-magnetic");
        button.removeEventListener("pointermove", move);
        button.removeEventListener("pointerleave", leave);
      };
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [root]);
}
