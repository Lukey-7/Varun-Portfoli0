import { useEffect, useRef } from "react";
import { X, ArrowUpRight } from "lucide-react";
import type { CaseStudy } from "@/data/portfolio";

export default function ProjectDetail({
  project,
  onClose,
}: {
  project: CaseStudy | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (project && dialog && !dialog.open) dialog.showModal();
    if (!project && dialog?.open) dialog.close();
    if (!project) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [project]);
  return (
    <dialog
      ref={ref}
      className="project-dialog"
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
          <div className="detail-facts">
            {project.facts.map(([value, label]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          {[
            ["The problem", project.problem],
            ["What I built", project.approach],
            ["How I checked it", project.evidence],
            ["My contribution", project.ownership],
          ]
            .filter(([, text]) => text)
            .map(([heading, text]) => (
            <section key={heading}>
              <h3>{heading}</h3>
              <p>{text}</p>
            </section>
          ))}
          {project.github && (
            <a
              className="primary-button"
              href={project.github}
              target="_blank"
              rel="noreferrer"
            >
              View source <ArrowUpRight size={17} />
            </a>
          )}
        </div>
      )}
    </dialog>
  );
}
