import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";
import "./end-of-transmission.css";

/*
 * The footer's sign-off. When it scrolls into view a mono line types out
 * END OF TRANSMISSION, a short flat-line trace draws beside it, and then the
 * page's real load time types out after it. The load time is read from the
 * browser's own navigation timing, so it is a measurement and the only thing
 * drawn in amber; the rest is muted ink and the accent colour. It runs once.
 * Under reduced motion or the site-wide pause the whole sign-off simply appears,
 * and a visitor who pauses part-way sees it complete at once. Screen readers get
 * each line as plain text; the typed copy is hidden from them.
 *
 * DecodeText is not used here: it starts itself when it scrolls into view, so a
 * parent cannot start it, it cannot be told to wait for the line before it, and
 * it reads reduced motion and the pause only when it mounts.
 */

const LABEL = "END OF TRANSMISSION";
/** One character per tick, so the label takes about 0.6 s and the whole sign-off about 1.3 s. */
const TICK_MS = 30;
/** Ticks of silence between the label and the measurement. */
const BEAT = 5;

/** A signal that dies away into a flat line, in a 96 by 16 box. */
const TRACE = "M0 8L6 8L9 3L13 13L17 5L21 11L25 6.5L29 9.5L33 7.2L37 8.5L41 8L96 8";

/**
 * When the page finished parsing, in whole milliseconds since navigation began,
 * or null when the browser cannot say or says 0 (the page is still loading).
 */
// eslint-disable-next-line react-refresh/only-export-components -- the sign-off's measurement and its tests share this helper
export function pageReadyMs(): number | null {
  try {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const end = entry?.domContentLoadedEventEnd;
    if (typeof end !== "number" || !Number.isFinite(end)) return null;
    const ms = Math.round(end);
    return ms > 0 ? ms : null;
  } catch {
    return null;
  }
}

/** One line: the real text once for assistive technology, and a typed copy that keeps the line's full width. */
function Line({ className, text, shown }: { className: string; text: string; shown: number }) {
  // A negative count would make slice() count from the end, so a line that has not begun shows none.
  const typedCount = Math.max(0, shown);
  return (
    <span className={`eot-line ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        <span className="eot-typed">{text.slice(0, typedCount)}</span>
        <span className="eot-rest">{text.slice(typedCount)}</span>
      </span>
    </span>
  );
}

export function EndOfTransmission() {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  // Without IntersectionObserver there is nothing to start the typing, so draw the finished sign-off.
  const still = Boolean(reduced) || paused || typeof IntersectionObserver === "undefined";

  const ref = useRef<HTMLParagraphElement>(null);
  const [ms, setMs] = useState(pageReadyMs);
  const [started, setStarted] = useState(false);
  // True once the sign-off has been shown whole without typing; it stays true, so turning motion
  // back on does not replay it.
  const [shownWhole, setShownWhole] = useState(still);
  if (still && !shownWhole) setShownWhole(true);
  // Characters typed so far across both lines.
  const [typed, setTyped] = useState(0);

  const measure = ms === null ? null : `page ready in ${ms} ms`;
  const total = LABEL.length + (measure === null ? 0 : BEAT + measure.length);
  const count = shownWhole ? total : typed;
  const complete = count >= total;

  // The page is usually still parsing when this first renders, so DOMContentLoaded has not finished
  // and there is no figure yet. Ask again once it has. If the page finished loading between that
  // first render and this effect, no `load` event is coming, so read the figure now instead.
  useEffect(() => {
    if (ms !== null) return;
    if (document.readyState === "complete") {
      setMs(pageReadyMs());
      return;
    }
    const read = () => setMs(pageReadyMs());
    window.addEventListener("load", read, { once: true });
    return () => window.removeEventListener("load", read);
  }, [ms]);

  // Start once, the first time it is in view.
  useEffect(() => {
    const node = ref.current;
    if (!node || started || shownWhole) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        setStarted(true);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [started, shownWhole]);

  useEffect(() => {
    if (!started || still || complete) return;
    // Never past the end, so a tick that lands before this effect is cleaned up cannot overshoot,
    // and a measurement that turns up later still gets typed.
    const timer = setInterval(() => setTyped((typedSoFar) => Math.min(typedSoFar + 1, total)), TICK_MS);
    return () => clearInterval(timer);
  }, [started, still, complete, total]);

  return (
    <p
      ref={ref}
      className="eot"
      data-state={complete ? "done" : started ? "typing" : "idle"}
      data-still={still ? "" : undefined}
    >
      <Line className="eot-label" text={LABEL} shown={count} />
      <svg className="eot-svg" aria-hidden="true" focusable="false" viewBox="0 0 96 16" width="96" height="16">
        {/* pathLength makes the dash pattern one unit long, so offset 1 hides the trace and 0 shows it all. */}
        <path
          className="eot-trace"
          d={TRACE}
          pathLength={1}
          style={{ strokeDashoffset: started || complete ? 0 : 1 }}
        />
      </svg>
      {measure !== null && <Line className="eot-measure" text={measure} shown={count - LABEL.length - BEAT} />}
    </p>
  );
}
