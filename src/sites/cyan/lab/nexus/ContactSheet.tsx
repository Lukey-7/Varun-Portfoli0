import { FRAMES, matches, type ArchiveEntry, type FilterKey } from "./data";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Every screenshot in the archive on one sheet, like a photographer's contact
 * print. Frames outside the current filter dim; any frame opens its project
 * at that screenshot.
 */
export function ContactSheet({
  filter,
  onOpen,
}: {
  filter: FilterKey;
  onOpen: (entry: ArchiveEntry, opener: HTMLElement, frame: number) => void;
}) {
  return (
    <ol className="nx-sheet">
      {FRAMES.map(({ entry, media, index, key }, i) => (
        <li key={key} data-dim={!matches(entry, filter)} data-shape={media.shape}>
          <button type="button" className="nx-sheet-frame" onClick={(event) => onOpen(entry, event.currentTarget, index)}>
            <span className="nx-sheet-image">
              <span className="nx-sheet-pic">
                <img src={media.src} width={media.width} height={media.height} alt={media.alt} loading="lazy" decoding="async" />
                <span className="nx-tint" aria-hidden="true" />
                <span className="nx-scanlines" aria-hidden="true" />
              </span>
            </span>
            <span className="nx-sheet-label mono">
              <b className="lab-readout">{pad(i + 1)}</b>
              <span>{entry.project.title}</span>
              <span className="nx-sheet-of">
                {index + 1}/{entry.media.length}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
