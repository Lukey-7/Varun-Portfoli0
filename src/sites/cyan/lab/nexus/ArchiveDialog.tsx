import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Github, Play, Search, X } from "lucide-react";
import { ARCHIVE, type ArchiveEntry } from "./data";
import { D20Figure } from "./D20Figure";
import { useLiveMotion } from "./useLiveMotion";

const pad = (n: number) => String(n).padStart(2, "0");
const ZOOM = 2.6;
const LENS = 176;

type Lens = { x: number; y: number; bgX: number; bgY: number; bgW: number; bgH: number } | null;

/**
 * The screenshot gallery: a stage that holds its size whatever the frame, a
 * wipe between frames, a loupe for reading small type, thumbnails, swipe on
 * touch and the arrow keys (handled by the dialog).
 */
function Gallery({ entry, frame, onFrame }: { entry: ArchiveEntry; frame: number; onFrame: (n: number) => void }) {
  const live = useLiveMotion();
  const media = entry.media;
  const stageRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const direction = useRef(1);
  const previous = useRef(frame);
  const [loupe, setLoupe] = useState(false);
  const [lens, setLens] = useState<Lens>(null);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    setCanHover(window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false);
  }, []);

  if (frame !== previous.current) {
    direction.current = frame > previous.current ? 1 : -1;
    previous.current = frame;
  }

  if (!media.length)
    return (
      <div className="nx-gallery">
        <div className="nx-stage nx-stage-figure">
          <D20Figure />
          <span className="nx-stage-code mono" aria-hidden="true">
            FIG. 01
          </span>
        </div>
        <div className="nx-stage-meta">
          <span className="lab-readout">FIG 01/01</span>
          <p>No screenshots are published for this project. The figure is generated, not a capture.</p>
        </div>
      </div>
    );

  const current = media[frame] ?? media[0];
  const step = (by: number) => onFrame((frame + by + media.length) % media.length);

  const moveLens = (event: PointerEvent<HTMLDivElement>) => {
    if (!loupe || event.pointerType !== "mouse") return;
    const stage = stageRef.current;
    const img = stage?.querySelector<HTMLImageElement>('[data-current="true"] img');
    if (!stage || !img) return;
    const box = img.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    if (x < 0 || y < 0 || x > box.width || y > box.height) {
      setLens(null);
      return;
    }
    const stageBox = stage.getBoundingClientRect();
    setLens({
      x: event.clientX - stageBox.left,
      y: event.clientY - stageBox.top,
      bgW: box.width * ZOOM,
      bgH: box.height * ZOOM,
      bgX: LENS / 2 - x * ZOOM,
      bgY: LENS / 2 - y * ZOOM,
    });
  };

  const variants = {
    enter: (dir: number) => ({
      clipPath: dir > 0 ? "inset(0% 0% 0% 100%)" : "inset(0% 100% 0% 0%)",
    }),
    center: { clipPath: "inset(0% 0% 0% 0%)" },
    exit: { opacity: 0 },
  };

  return (
    <div className="nx-gallery">
      <div
        ref={stageRef}
        className="nx-stage"
        data-loupe={loupe && lens ? "on" : "off"}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") swipe.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start || media.length < 2) return;
          const dx = event.clientX - start.x;
          if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(event.clientY - start.y)) step(dx < 0 ? 1 : -1);
        }}
        onPointerMove={moveLens}
        onPointerLeave={() => setLens(null)}
      >
        <AnimatePresence initial={false} custom={direction.current}>
          <motion.figure
            key={`${entry.id}-${frame}`}
            className={`nx-frame shape-${current.shape}`}
            data-current="true"
            custom={direction.current}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={live ? { duration: 0.55, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
            style={{ "--ar": `${current.width} / ${current.height}` } as CSSProperties}
          >
            <span className="nx-frame-device">
              <img src={current.src} width={current.width} height={current.height} alt={current.alt} decoding="async" />
            </span>
          </motion.figure>
        </AnimatePresence>
        {live && <span key={`scan-${frame}`} className="nx-stage-scan" data-dir={direction.current} aria-hidden="true" />}
        <span className="nx-stage-code mono" aria-hidden="true">
          FR {pad(frame + 1)}/{pad(media.length)}
        </span>
        {lens && (
          <span
            className="nx-lens"
            aria-hidden="true"
            style={{
              left: lens.x - LENS / 2,
              top: lens.y - LENS / 2,
              width: LENS,
              height: LENS,
              backgroundImage: `url("${current.src}")`,
              backgroundSize: `${lens.bgW}px ${lens.bgH}px`,
              backgroundPosition: `${lens.bgX}px ${lens.bgY}px`,
            }}
          >
            <span className="mono">×{ZOOM}</span>
          </span>
        )}
        {media.length > 1 && (
          <>
            <button type="button" className="nx-nav nx-nav-prev" aria-label="Previous screenshot" onClick={() => step(-1)}>
              <ChevronLeft size={22} />
            </button>
            <button type="button" className="nx-nav nx-nav-next" aria-label="Next screenshot" onClick={() => step(1)}>
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      <div className="nx-stage-meta" aria-live="polite">
        <span className="lab-readout">
          FR {pad(frame + 1)}/{pad(media.length)}
        </span>
        <p>{current.caption}</p>
        <span className="lab-readout nx-stage-size">
          {current.width}×{current.height}
          <span className="sr-only"> pixels</span>
        </span>
      </div>

      <div className="nx-gallery-foot">
        {media.length > 1 && (
          <ol className="nx-thumbs" aria-label="Screenshots">
            {media.map((item, i) => (
              <li key={item.src}>
                <button
                  type="button"
                  className="nx-thumb-button"
                  data-shape={item.shape}
                  aria-current={i === frame ? "true" : undefined}
                  aria-label={`Screenshot ${i + 1} of ${media.length}: ${item.caption}`}
                  onClick={() => onFrame(i)}
                >
                  <img src={item.src} width={item.width} height={item.height} alt="" loading="lazy" decoding="async" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className="nx-gallery-tools">
          {canHover && (
            <button
              type="button"
              className="lab-chip"
              aria-pressed={loupe}
              onClick={() => {
                setLoupe(!loupe);
                setLens(null);
              }}
            >
              <Search size={13} aria-hidden="true" /> Loupe
            </button>
          )}
          <a className="lab-chip" href={current.src} target="_blank" rel="noreferrer">
            Full size <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </div>
      </div>
      {media.length > 1 && <p className="nx-gallery-hint mono">← → to flip · swipe on touch</p>}
    </div>
  );
}

/**
 * The project detail: a native modal dialog with the gallery on one side and
 * the dossier (pitch, links, facts, write-up, highlights, stack) on the other.
 */
export function ArchiveDialog({
  entry,
  frame,
  onFrame,
  onStep,
  onClose,
}: {
  entry: ArchiveEntry | null;
  frame: number;
  onFrame: (n: number) => void;
  onStep: (by: 1 | -1) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const dossierRef = useRef<HTMLDivElement>(null);
  const isOpen = Boolean(entry);

  useEffect(() => {
    const dialog = ref.current;
    if (isOpen && dialog && !dialog.open) {
      dialog.showModal?.();
      // React's autoFocus does not reach the DOM attribute showModal looks for.
      dialog.querySelector<HTMLElement>(".nx-dialog-close")?.focus();
    }
    if (!isOpen && dialog?.open) dialog.close();
    if (!isOpen) return;
    const html = document.documentElement;
    const previous = [document.body.style.overflow, html.style.overflow];
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous[0];
      html.style.overflow = previous[1];
    };
  }, [isOpen]);

  useEffect(() => {
    dossierRef.current?.scrollTo?.({ top: 0 });
    ref.current?.scrollTo?.({ top: 0 });
  }, [entry?.id]);

  const position = entry ? ARCHIVE.indexOf(entry) : -1;
  const before = ARCHIVE[(position - 1 + ARCHIVE.length) % ARCHIVE.length];
  const after = ARCHIVE[(position + 1) % ARCHIVE.length];
  const pitch = entry ? (entry.showcase?.pitch ?? entry.project.description) : "";
  // The write-up, less any paragraph that only repeats the pitch.
  const writeUp = (entry?.project.longDescription ?? "")
    .split("\n")
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && paragraph !== pitch);

  return (
    <dialog
      ref={ref}
      className="nx-dialog"
      aria-labelledby="nx-dialog-title"
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (!entry || entry.media.length < 2) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        if (event.altKey || event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        const by = event.key === "ArrowRight" ? 1 : -1;
        onFrame((frame + by + entry.media.length) % entry.media.length);
      }}
    >
      {entry && (
        <div className="nx-dialog-frame">
          <header className="nx-dialog-bar">
            <p className="mono">
              <span>Archive</span> / CH.{entry.code} <span className="nx-dialog-of">· {position + 1} of {ARCHIVE.length}</span>
            </p>
            <div className="nx-dialog-controls">
              <button
                type="button"
                className="icon-button"
                onClick={() => onStep(-1)}
                aria-label={`Previous project: ${before.project.title}`}
                title={`Previous: ${before.project.title}`}
              >
                <ArrowLeft size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => onStep(1)}
                aria-label={`Next project: ${after.project.title}`}
                title={`Next: ${after.project.title}`}
              >
                <ArrowRight size={17} />
              </button>
              <button autoFocus type="button" className="icon-button nx-dialog-close" onClick={onClose} aria-label="Close project">
                <X size={19} />
              </button>
            </div>
          </header>

          <div className="nx-dialog-grid">
            <Gallery key={entry.id} entry={entry} frame={Math.min(frame, Math.max(0, entry.media.length - 1))} onFrame={onFrame} />

            <div ref={dossierRef} className="nx-dossier">
              <p className="nx-dossier-cat mono">{entry.project.subtitle}</p>
              <h2 id="nx-dialog-title">{entry.project.title}</h2>
              <p className="nx-pitch">{pitch}</p>

              <div className="nx-actions">
                {entry.github && (
                  <a className="lab-button nx-github" href={entry.github} target="_blank" rel="noreferrer">
                    <Github size={18} aria-hidden="true" /> View on GitHub <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                )}
                {entry.playUrl && (
                  <a className="lab-button ghost" href={entry.playUrl}>
                    <Play size={16} aria-hidden="true" /> Play it here
                  </a>
                )}
                {entry.demoUrl && (
                  <a className="lab-button ghost" href={entry.demoUrl} target="_blank" rel="noreferrer">
                    Try the live demo <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
              {entry.github && (
                <p className="nx-repo mono">
                  <span aria-hidden="true">↳</span> {entry.github.replace("https://", "")}
                </p>
              )}

              <dl className="nx-dossier-facts">
                {entry.project.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd className="lab-readout">{fact.value}</dd>
                  </div>
                ))}
              </dl>

              {entry.showcase?.idea && (
                <section>
                  <h3 className="mono">The idea</h3>
                  <p>{entry.showcase.idea}</p>
                </section>
              )}

              {writeUp.length > 0 && (
                <section>
                  <h3 className="mono">Write-up</h3>
                  {writeUp.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </section>
              )}

              {entry.showcase?.highlights.length ? (
                <section>
                  <h3 className="mono">Highlights</h3>
                  <ol className="nx-highlights">
                    {entry.showcase.highlights.map((item, i) => (
                      <li key={i}>
                        <span className="lab-readout mono" aria-hidden="true">
                          {pad(i + 1)}
                        </span>
                        <p>{item}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              <section>
                <h3 className="mono">Stack</h3>
                <ul className="nx-stack">
                  {entry.project.technologies.map((tech) => (
                    <li key={tech} className="lab-chip">
                      {tech}
                    </li>
                  ))}
                </ul>
              </section>

              {entry.showcase?.note && <p className="nx-note mono">{entry.showcase.note}</p>}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
