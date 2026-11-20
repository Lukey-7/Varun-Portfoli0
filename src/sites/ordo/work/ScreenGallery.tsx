import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Maximize2 } from "lucide-react";
import type { ShowcaseMedia } from "../projectShowcase";
import Lightbox from "./Lightbox";
import { galleryKey, pad, useSwipe } from "./hooks";

/**
 * The stage keeps one shape for the whole set, so flipping between a wide
 * screenshot and a phone one never moves the page. Phone-only sets slide
 * along a strip with their neighbours in view; mixed and wide sets cross-fade.
 */
function stageShape(media: ShowcaseMedia[]) {
  const phones = media.every((item) => item.shape === "phone");
  const wides = media.filter((item) => item.shape === "wide");
  const ratio = phones ? 16 / 10 : Math.max(...wides.map((item) => item.width / item.height));
  const small = phones ? 4 / 5 : wides.length < media.length ? 4 / 3 : ratio;
  const phone = media.find((item) => item.shape === "phone");
  return {
    mode: phones ? "phones" : "frames",
    style: {
      "--stage-ratio": ratio.toFixed(4),
      "--stage-ratio-sm": small.toFixed(4),
      "--phone-ratio": phone ? (phone.width / phone.height).toFixed(4) : "0.4615",
    } as CSSProperties,
  };
}

/** A project's screenshots: a large stage, captioned thumbnails and a full-screen view. */
export default function ScreenGallery({
  name,
  media,
  note,
}: {
  name: string;
  media: ShowcaseMedia[];
  note?: string;
}) {
  const [index, setIndex] = useState(0);
  const [viewing, setViewing] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const many = media.length > 1;
  const item = media[index];
  const { mode, style } = stageShape(media);

  const show = useCallback((next: number) => setIndex(next), []);
  const step = useCallback(
    (by: 1 | -1) => setIndex((current) => (current + by + media.length) % media.length),
    [media.length],
  );
  const swipe = useSwipe(step);
  const currentSlide = useCallback(
    () => stage.current?.querySelector<HTMLElement>('[data-state="current"]') ?? null,
    [],
  );

  // Keyboard focus follows the screenshot, so it is never left on a hidden one.
  useEffect(() => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.classList.contains("work-slide") && stage.current?.contains(focused)) {
      currentSlide()?.focus({ preventScroll: true });
    }
  }, [index, currentSlide]);

  // ←/→ also work while the stage is in view and nothing else has focus, so a
  // visitor can flip screenshots without first tabbing to the gallery.
  useEffect(() => {
    const node = stage.current;
    if (!node || !many || typeof IntersectionObserver === "undefined") return;
    let inView = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.intersectionRatio >= 0.5;
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(node);
    const onKey = (event: KeyboardEvent) => {
      if (!inView || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const active = document.activeElement;
      if (active && active !== document.body && active.id !== "main") return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      step(event.key === "ArrowRight" ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
    };
  }, [many, step]);

  const open = () => {
    if (!swipe.consumed()) setViewing(true);
  };

  return (
    <figure
      className="work-gallery"
      data-mode={mode}
      style={style}
      onKeyDown={(event) => {
        if (!many || viewing || event.altKey || event.ctrlKey || event.metaKey) return;
        const next = galleryKey(event.key, index, media.length);
        if (next === null) return;
        event.preventDefault();
        show(next);
      }}
    >
      <div className="work-stage-wrap">
        <div
          ref={stage}
          className="work-stage"
          role="region"
          aria-roledescription="carousel"
          aria-label={`${name} screenshots`}
          {...swipe.handlers}
        >
          <div className="work-track" style={{ "--i": index } as CSSProperties}>
            {media.map((shot, i) => {
              const current = i === index;
              return (
                <button
                  key={shot.src}
                  type="button"
                  className={`work-slide ${shot.shape}`}
                  data-state={current ? "current" : i < index ? "before" : "after"}
                  aria-hidden={current ? undefined : true}
                  tabIndex={current ? 0 : -1}
                  aria-label={current ? `Enlarge screenshot: ${shot.caption}` : undefined}
                  onClick={() => (current ? open() : !swipe.consumed() && show(i))}
                >
                  <img
                    src={shot.src}
                    alt={current ? shot.alt : ""}
                    width={shot.width}
                    height={shot.height}
                    decoding="async"
                    draggable={false}
                  />
                </button>
              );
            })}
          </div>
          <span className="work-stage-count mono" aria-hidden="true">
            {pad(index + 1)} / {pad(media.length)}
          </span>
          <button
            type="button"
            className="work-stage-expand"
            onClick={() => setViewing(true)}
            aria-label="View screenshots full screen"
          >
            <Maximize2 size={15} aria-hidden="true" />
          </button>
          {many && (
            <>
              <button type="button" className="work-stage-nav prev" onClick={() => step(-1)} aria-label="Previous screenshot">
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
              <button type="button" className="work-stage-nav next" onClick={() => step(1)} aria-label="Next screenshot">
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="work-gallery-aside">
        <figcaption className="work-caption" aria-live="polite">
          <span className="mono">
            {pad(index + 1)} / {pad(media.length)}
          </span>
          {item.caption}
        </figcaption>
        {many && (
          <ol className="work-thumbs" aria-label="Screenshots">
            {media.map((shot, i) => (
              <li key={shot.src}>
                <button
                  type="button"
                  className={shot.shape}
                  aria-pressed={i === index}
                  aria-label={`Show screenshot ${i + 1}: ${shot.caption}`}
                  onClick={() => show(i)}
                >
                  <span className="work-thumb-img">
                    <img src={shot.src} alt="" width={shot.width} height={shot.height} decoding="async" />
                  </span>
                  <span className="work-thumb-text" aria-hidden="true">
                    <i className="mono">{pad(i + 1)}</i>
                    {shot.caption}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
        <p className="work-hint mono" aria-hidden="true">
          <span className="work-hint-fine">{many ? "← → to browse · " : ""}Click to enlarge</span>
          <span className="work-hint-touch">{many ? "Swipe to browse · " : ""}Tap to enlarge</span>
        </p>
        {note && <p className="showcase-note mono">{note}</p>}
      </div>

      <Lightbox
        name={name}
        media={media}
        index={index}
        open={viewing}
        onIndex={show}
        onClose={() => setViewing(false)}
        fallbackFocus={currentSlide}
      />
    </figure>
  );
}
