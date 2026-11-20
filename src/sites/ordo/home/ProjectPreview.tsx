import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useMotionPaused } from "@/lib/motion-pause";
import type { ShowcaseMedia } from "../projectShowcase";

const STEP = 2600;

/**
 * Real screenshots for a project card, shown while the card is hovered or
 * focused. Nothing is fetched until the first hover, and the artwork stays in
 * place until the first screenshot has decoded, so the reveal never shows an
 * empty frame. While it stays open it steps through the project's screens.
 */
export function ProjectPreview({ media, active }: { media: ShowcaseMedia[]; active: boolean }) {
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const [wanted, setWanted] = useState(false);
  const [loaded, setLoaded] = useState<boolean[]>(() => media.map(() => false));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (active) setWanted(true);
    else setIndex(0);
  }, [active]);

  // Step to the next screen only once it has loaded, and only while open.
  useEffect(() => {
    if (!active || reduced || paused || media.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % media.length;
        return loaded[next] ? next : current;
      });
    }, STEP);
    return () => clearInterval(timer);
  }, [active, reduced, paused, media.length, loaded]);

  if (!media.length) return null;
  const shown = active && loaded[index];
  // The first screen loads on first intent; the rest follow once it is in.
  const mounted = wanted ? (loaded[0] ? media : media.slice(0, 1)) : [];

  return (
    <div className="home-preview" data-state={shown ? "on" : "off"} aria-hidden={!shown}>
      {mounted.map((item, i) => (
        <img
          key={item.src}
          src={item.src}
          width={item.width}
          height={item.height}
          alt={item.alt}
          decoding="async"
          draggable={false}
          className={`${item.shape === "phone" ? "is-phone" : "is-wide"}${i === index ? " is-current" : ""}`}
          onLoad={() =>
            setLoaded((current) => (current[i] ? current : current.map((value, n) => value || n === i)))
          }
        />
      ))}
      <div className="home-preview-caption mono">
        <span>
          {String(index + 1).padStart(2, "0")} / {String(media.length).padStart(2, "0")}
        </span>
        <span>{media[index].caption}</span>
      </div>
      {media.length > 1 && (
        <div className="home-preview-steps">
          {media.map((item, i) => (
            <i key={item.src} className={i === index ? "is-current" : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}
