import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { isMotionPaused } from "@/lib/motion-pause";

const HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

const ease = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * A number that counts up from zero once, the first time it scrolls into view.
 * Numbers already on screen at load, reduced motion and the page-wide pause
 * all show the value straight away. Assistive technology always reads the
 * final value, never the intermediate ones.
 */
export function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const target = useRef(value);
  target.current = value;
  const [shown, setShown] = useState(value);
  const [counting, setCounting] = useState(false);
  const phase = useRef<"idle" | "armed" | "done">("idle");

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || isMotionPaused()) return;
    // Only numbers still below the fold count; anything visible stays put.
    if (node.getBoundingClientRect().top < window.innerHeight) return;
    phase.current = "armed";
    setShown(0);
    setCounting(true);
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const began = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - began) / duration);
          setShown(Math.round(target.current * ease(t)));
          if (t < 1) frame = requestAnimationFrame(step);
          else {
            phase.current = "done";
            setCounting(false);
          }
        };
        frame = requestAnimationFrame(step);
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [duration]);

  // Live data can replace the snapshot; follow it once the count has finished.
  useEffect(() => {
    if (phase.current !== "armed") setShown(value);
  }, [value]);

  return (
    <span ref={ref} className="home-count">
      <span aria-hidden={counting || undefined}>{shown}</span>
      {counting && <span style={HIDDEN}>{value}</span>}
    </span>
  );
}
