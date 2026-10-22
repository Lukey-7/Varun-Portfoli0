import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ShowcaseMedia } from "../projectShowcase";

/** A project's screenshot gallery: one large frame, arrows, captions and thumbnails. */
export function ProjectGallery({
  media,
  index,
  onIndex,
}: {
  media: ShowcaseMedia[];
  index: number;
  onIndex: (i: number) => void;
}) {
  const item = media[index];
  const go = (step: number) => onIndex((index + step + media.length) % media.length);
  return (
    <figure className="showcase-stage">
      <div className={`stage-frame ${item.shape}`}>
        <img src={item.src} alt={item.alt} decoding="async" />
        {media.length > 1 && (
          <>
            <button className="stage-nav prev" onClick={() => go(-1)} aria-label="Previous screenshot">
              <ArrowLeft size={16} />
            </button>
            <button className="stage-nav next" onClick={() => go(1)} aria-label="Next screenshot">
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
      <figcaption aria-live="polite">
        <span>
          {String(index + 1).padStart(2, "0")} / {String(media.length).padStart(2, "0")}
        </span>
        {item.caption}
      </figcaption>
      {media.length > 1 && (
        <div className="stage-thumbs" role="group" aria-label="Screenshots">
          {media.map((m, i) => (
            <button
              key={m.src}
              aria-label={`Show screenshot ${i + 1}: ${m.caption}`}
              aria-pressed={i === index}
              onClick={() => onIndex(i)}
            >
              <img src={m.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
