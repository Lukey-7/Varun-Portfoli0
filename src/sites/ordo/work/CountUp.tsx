import { useLayoutEffect, useRef } from "react";
import { useMotionAllowed } from "./hooks";

/** Standalone numbers only, so "A0 → B2" and "1e-8" are left as written. */
const NUMBER = /(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g;

function parts(value: string) {
  const out: (string | { n: number; decimals: number })[] = [];
  let last = 0;
  for (const match of value.matchAll(NUMBER)) {
    out.push(value.slice(last, match.index));
    out.push({ n: Number(match[0]), decimals: match[0].split(".")[1]?.length ?? 0 });
    last = (match.index ?? 0) + match[0].length;
  }
  out.push(value.slice(last));
  return out;
}

/**
 * A fact whose numbers count up once, the first time it comes into view.
 * The final text holds the space (no layout shift) and is what screen
 * readers hear; the counting copy is decorative.
 */
export default function CountUp({ value }: { value: string }) {
  const live = useRef<HTMLSpanElement>(null);
  const allowed = useMotionAllowed();
  const done = useRef(false);

  useLayoutEffect(() => {
    const node = live.current;
    if (!node) return;
    node.textContent = value;
    const pieces = parts(value);
    const numbers = pieces.filter((piece) => typeof piece !== "string");
    if (done.current || !allowed || numbers.length === 0 || typeof IntersectionObserver === "undefined") return;

    const draw = (t: number) => {
      node.textContent = pieces
        .map((piece) => (typeof piece === "string" ? piece : (piece.n * t).toFixed(piece.decimals)))
        .join("");
    };
    draw(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        let start = 0;
        const tick = (now: number) => {
          start ||= now;
          const t = Math.min(1, (now - start) / 1100);
          draw(1 - (1 - t) ** 3);
          frame = t < 1 ? requestAnimationFrame(tick) : 0;
          if (t === 1) done.current = true;
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      node.textContent = value;
    };
  }, [value, allowed]);

  return (
    <span className="work-count">
      <span className="work-count-ghost" aria-hidden="true">
        {value}
      </span>
      <span ref={live} className="work-count-live" aria-hidden="true" />
      <span className="work-sr">{value}</span>
    </span>
  );
}
