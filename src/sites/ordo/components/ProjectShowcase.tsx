import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Gamepad2, X } from "lucide-react";
import type { CaseStudy } from "@/data/portfolio";
import { projectShowcase, type ShowcaseMedia } from "../projectShowcase";

function Stage({
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
      <figcaption>
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

/** The monochrome site's case-study dialog: gallery, verified detail, live demo. */
export function OrdoProjectDialog({
  project,
  onClose,
}: {
  project: CaseStudy | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const showcase = project ? projectShowcase[project.id] : undefined;

  useEffect(() => {
    const dialog = ref.current;
    setIndex(0);
    setPlaying(false);
    if (project && dialog && !dialog.open) dialog.showModal();
    if (!project && dialog?.open) dialog.close();
    if (!project) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [project]);

  const sections = project
    ? ([
        ["The problem", project.problem],
        ["What I built", project.approach],
        ["How I checked it", project.evidence],
        ["My contribution", project.ownership],
      ].filter(([, text]) => text) as [string, string][])
    : [];

  return (
    <dialog
      ref={ref}
      className="project-dialog ordo-project-dialog"
      aria-labelledby="project-detail-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {project && (
        <div className="dialog-body">
          <button
            autoFocus
            className="icon-button dialog-close"
            onClick={onClose}
            aria-label="Close case study"
          >
            <X size={22} />
          </button>
          <span className="mono detail-category">{project.category}</span>
          <h2 id="project-detail-title">{project.name}</h2>
          <p className="dialog-intro">{project.description}</p>

          {showcase?.play && (
            <div className="play-bar">
              <button
                className="primary-button"
                onClick={() => setPlaying((value) => !value)}
                aria-expanded={playing}
              >
                <Gamepad2 size={16} />
                {playing ? "Back to screenshots" : showcase.play.label}
              </button>
              {playing && (
                <a href={showcase.play.src} target="_blank" rel="noreferrer">
                  Open full screen <ArrowUpRight size={14} />
                </a>
              )}
            </div>
          )}

          {playing && showcase?.play ? (
            <div className="play-frame">
              <iframe src={showcase.play.src} title={showcase.play.title} />
              <p className="mono">Click the game to give it the keyboard. Sound starts only when you press play.</p>
            </div>
          ) : (
            showcase?.media.length ? (
              <Stage media={showcase.media} index={index} onIndex={setIndex} />
            ) : null
          )}

          {project.facts.length > 0 && (
            <div className="detail-facts">
              {project.facts.map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}

          {showcase?.highlights.length ? (
            <section>
              <h3>In numbers and decisions</h3>
              <ul className="showcase-highlights">
                {showcase.highlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {sections.map(([heading, text]) => (
            <section key={heading}>
              <h3>{heading}</h3>
              <p>{text}</p>
            </section>
          ))}

          {showcase?.note && <p className="showcase-note mono">{showcase.note}</p>}

          <div className="dialog-links">
            {(showcase?.links ?? (project.github ? [{ label: "View source", href: project.github }] : [])).map(
              (link) => (
                <a
                  key={link.href}
                  className="primary-button"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label} <ArrowUpRight size={17} />
                </a>
              ),
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
