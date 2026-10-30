import { useEffect, useRef, useState } from "react";
import { isMotionPaused } from "@/lib/motion-pause";

const GLYPHS = "01ABCDEF#%&*+=<>/\\|_-:";

/** One frame of the decode: characters left of the sweep are real, the rest are noise. */
// eslint-disable-next-line react-refresh/only-export-components -- the decode step is exported so its tests can drive it
export function decodeFrame(text: string, progress: number, random: () => number = Math.random) {
  const revealed = Math.floor(progress * text.length);
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    out += i < revealed || char === " " ? char : GLYPHS[Math.floor(random() * GLYPHS.length)];
  }
  return out;
}

/**
 * Monospace text that decodes from random glyphs into place the first time it
 * scrolls into view. Screen readers get the real text at once; under reduced
 * motion or the site-wide pause it simply appears. Use it on monospace labels
 * only, where every glyph has the same width and nothing reflows.
 */
export function DecodeText({
  text,
  className,
  delay = 0,
  duration = 700,
}: {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(text);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || isMotionPaused()) return;
    let frame = 0;
    let started = 0;
    setShown(decodeFrame(text, 0));
    const tick = (now: number) => {
      if (!started) started = now;
      const progress = Math.min(1, Math.max(0, (now - started - delay) / duration));
      setShown(progress >= 1 ? text : decodeFrame(text, progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        frame = requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [text, delay, duration]);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
