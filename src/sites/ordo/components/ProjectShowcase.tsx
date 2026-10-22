import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, X } from "lucide-react";
import type { CaseStudy } from "@/data/portfolio";
import { projectShowcase, type ShowcaseMedia } from "../projectShowcase";
import { hasDemo, ProjectDemo } from "../demos/ProjectDemo";

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

/**
 * The monochrome site's case-study dialog. It reads top to bottom the way a
 * visitor asks: what does it look like, what is the idea, can I try it, and
 * how do I know it works.
 */
export function OrdoProjectDialog({
  project,
  onClose,
}: {
  project: CaseStudy | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const showcase = project ? projectShowcase[project.id] : undefined;

  useEffect(() => {
    const dialog = ref.current;
    setIndex(0);
    if (project && dialog && !dialog.open) dialog.showModal();
    if (!project && dialog?.open) dialog.close();
    if (!project) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [project]);

  const idea = project
    ? ([
        ["The problem", project.problem],
        ["What I built", project.approach ?? showcase?.idea],
      ].filter(([, text]) => text) as [string, string][])
    : [];
  const proof = project
    ? ([
        ["How I checked it", project.evidence],
        ["My part", project.ownership],
      ].filter(([, text]) => text) as [string, string][])
    : [];
  const facts = showcase?.facts ?? project?.facts ?? [];
  const links = showcase?.links ?? (project?.github ? [{ label: "View on GitHub", href: project.github }] : []);

  return (
    <dialog
      ref={ref}
      className="project-dialog ordo-project-dialog"
      aria-labelledby="project-detail-title"
      onCancel={onClose}
      onClick={(event) => {
        // Close only on the backdrop; the dialog's own scrollbar is part of the dialog.
        const box = event.currentTarget.getBoundingClientRect();
        const outside =
          event.clientX < box.left || event.clientX > box.right ||
          event.clientY < box.top || event.clientY > box.bottom;
        if (event.target === event.currentTarget && outside) onClose();
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
          <p className="dialog-intro">{showcase?.pitch ?? project.description}</p>

          {showcase?.media.length ? (
            <Stage media={showcase.media} index={index} onIndex={setIndex} />
          ) : null}

          {facts.length > 0 && (
            <div className="detail-facts">
              {facts.map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}

          {idea.length > 0 && (
            <section className="dialog-idea">
              <span className="mono dialog-step">01 / The idea</span>
              {idea.map(([heading, text]) => (
                <div key={heading}>
                  <h3>{heading}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </section>
          )}

          {hasDemo(project.id) && (
            <section className="dialog-demo">
              <span className="mono dialog-step">02 / Try it</span>
              <ProjectDemo id={project.id} />
            </section>
          )}

          {showcase?.highlights.length ? (
            <section>
              <span className="mono dialog-step">03 / The details</span>
              <h3>In numbers and decisions</h3>
              <ul className="showcase-highlights">
                {showcase.highlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {proof.map(([heading, text]) => (
            <section key={heading}>
              <h3>{heading}</h3>
              <p>{text}</p>
            </section>
          ))}

          {showcase?.note && <p className="showcase-note mono">{showcase.note}</p>}

          {links.length > 0 && (
            <div className="dialog-links">
              {links.map((link) => (
                <a
                  key={link.href}
                  className="primary-button"
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label} <ArrowUpRight size={17} />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
