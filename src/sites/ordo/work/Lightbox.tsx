import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { ShowcaseMedia } from "../projectShowcase";
import { galleryKey, pad, useSwipe } from "./hooks";

/**
 * Full-screen screenshot viewer on a native modal <dialog>: the browser traps
 * focus and Escape closes it; focus then returns to whatever opened it, and
 * the page behind does not scroll while it is open.
 */
export default function Lightbox({
  name,
  media,
  index,
  open,
  onIndex,
  onClose,
  fallbackFocus,
}: {
  name: string;
  media: ShowcaseMedia[];
  index: number;
  open: boolean;
  onIndex: (index: number) => void;
  onClose: () => void;
  /** Where focus goes if the element that opened the view can no longer take it. */
  fallbackFocus: () => HTMLElement | null;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const item = media[index];
  const many = media.length > 1;
  const swipe = useSwipe((step) => onIndex((index + step + media.length) % media.length));

  useEffect(() => {
    const node = dialog.current;
    if (!node || !open) return;
    opener.current = document.activeElement as HTMLElement | null;
    if (!node.open) node.showModal();

    const root = document.documentElement;
    const before = { overflow: root.style.overflow, gutter: root.style.scrollbarGutter };
    const hadScrollbar = window.innerWidth > root.clientWidth;
    root.style.overflow = "hidden";
    if (hadScrollbar) root.style.scrollbarGutter = "stable";

    return () => {
      root.style.overflow = before.overflow;
      root.style.scrollbarGutter = before.gutter;
      if (node.open) node.close();
      // The screenshot that opened the view may have been flipped out of
      // sight meanwhile; then focus goes to the one now showing.
      const back = opener.current;
      const usable = back?.isConnected && !back.closest("[aria-hidden='true']");
      if (back && usable) back.focus({ preventScroll: true });
      if (!usable || document.activeElement !== back) fallbackFocus()?.focus({ preventScroll: true });
    };
  }, [open, fallbackFocus]);

  return (
    <dialog
      ref={dialog}
      className="work-lightbox"
      aria-label={`${name} screenshots, full screen`}
      onClose={onClose}
      onCancel={(event) => {
        // Escape: let React state close it so focus is restored in one place.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (!many || event.altKey || event.ctrlKey || event.metaKey) return;
        const next = galleryKey(event.key, index, media.length);
        if (next === null) return;
        event.preventDefault();
        onIndex(next);
      }}
    >
      {open && (
        <div className="work-lightbox-inner">
          <header className="work-lightbox-bar mono">
            <span>
              {name.toUpperCase()} / {pad(index + 1)} OF {pad(media.length)}
            </span>
            <button
              type="button"
              className="work-lightbox-close"
              onClick={onClose}
              aria-label="Close full-screen view"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div
            className="work-lightbox-stage"
            onClick={(event) => {
              if (event.target === event.currentTarget && !swipe.consumed()) onClose();
            }}
            {...swipe.handlers}
          >
            <img
              key={item.src}
              className={`work-lightbox-img ${item.shape}`}
              src={item.src}
              alt={item.alt}
              width={item.width}
              height={item.height}
              decoding="async"
            />
            {many && (
              <>
                <button
                  type="button"
                  className="work-lightbox-nav prev"
                  onClick={() => onIndex((index - 1 + media.length) % media.length)}
                  aria-label="Previous screenshot"
                >
                  <ArrowLeft size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="work-lightbox-nav next"
                  onClick={() => onIndex((index + 1) % media.length)}
                  aria-label="Next screenshot"
                >
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <p className="work-lightbox-caption" aria-live="polite">
            <span className="mono">{pad(index + 1)}</span>
            {item.caption}
          </p>
        </div>
      )}
    </dialog>
  );
}
