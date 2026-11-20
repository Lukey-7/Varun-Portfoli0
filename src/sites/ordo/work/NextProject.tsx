import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { OrdoProject } from "../projects";
import { projectShowcase } from "../projectShowcase";
import { pad } from "./hooks";

/** The foot of a project page: the next project, previewed by its first screenshot, and the previous one. */
export default function NextProject({
  previous,
  next,
  nextNumber,
  total,
}: {
  previous: OrdoProject;
  next: OrdoProject;
  nextNumber: number;
  total: number;
}) {
  const showcase = projectShowcase[next.showcaseId];
  const shot = showcase?.media[0];
  return (
    <nav className="work-more section-wrap" aria-label="More projects">
      <div className="ordo-section-label">
        <span>[ MORE WORK ]</span>
        <Link to="/#work" className="work-more-all">
          All projects
        </Link>
      </div>
      <div className="work-more-grid">
        <Link
          to={`/work/${previous.slug}`}
          className="work-prev-card"
          aria-label={`Previous project: ${previous.study.name}`}
        >
          <span className="mono work-more-kicker">
            <ArrowLeft size={13} aria-hidden="true" /> Previous project
          </span>
          <strong>{previous.study.name}</strong>
          <span className="work-more-category mono">{previous.study.category}</span>
        </Link>
        <Link to={`/work/${next.slug}`} className="work-next-card" aria-label={`Next project: ${next.study.name}`}>
          <span className="work-next-copy">
            <span className="mono work-more-kicker">
              Next project / {pad(nextNumber)} of {pad(total)} <ArrowRight size={13} aria-hidden="true" />
            </span>
            <strong>{next.study.name}</strong>
            <span className="work-next-pitch">{showcase?.pitch ?? next.study.description}</span>
          </span>
          {shot && (
            <span className={`work-next-shot ${shot.shape}`}>
              <img src={shot.src} alt="" width={shot.width} height={shot.height} loading="lazy" decoding="async" />
            </span>
          )}
        </Link>
      </div>
    </nav>
  );
}
