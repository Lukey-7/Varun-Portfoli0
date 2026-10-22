import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, Gamepad2 } from "lucide-react";
import { findProject, ordoProjects } from "../projects";
import { projectShowcase } from "../projectShowcase";
import ProjectArt from "../components/ProjectArt";
import { ProjectGallery } from "../components/ProjectShowcase";
import NotFoundPage from "./NotFoundPage";

/** One project's case study: animated icon, gallery, verified detail, next and previous. */
export default function ProjectPage() {
  const { slug } = useParams();
  const project = findProject(slug);
  const [shot, setShot] = useState(0);

  useEffect(() => {
    setShot(0);
    if (project) document.title = `${project.study.name} | Varun Darji`;
  }, [project]);

  if (!project) return <NotFoundPage />;

  const { study, art } = project;
  const showcase = projectShowcase[project.showcaseId];
  const index = ordoProjects.indexOf(project);
  const previous = ordoProjects[(index - 1 + ordoProjects.length) % ordoProjects.length];
  const next = ordoProjects[(index + 1) % ordoProjects.length];
  const sections = [
    ["The problem", study.problem],
    ["What I built", study.approach],
    ["How I checked it", study.evidence],
    ["My contribution", study.ownership],
  ].filter(([, text]) => text) as [string, string][];
  const links =
    showcase?.links ?? (study.github ? [{ label: "View on GitHub", href: study.github }] : []);

  return (
    <article className="project-page">
      <header className="project-hero section-wrap">
        <div className="ordo-section-label">
          <span>[ WORK / {study.name.toUpperCase()} ]</span>
          <span>
            PROJECT {String(index + 1).padStart(2, "0")} /{" "}
            {String(ordoProjects.length).padStart(2, "0")}
          </span>
        </div>
        <div className="project-hero-grid">
          <div className="project-hero-copy">
            <span className="mono project-category">{study.category}</span>
            <h1>{study.name}</h1>
            <p className="project-lede">{study.description}</p>
            {study.facts.length > 0 && (
              <div className="project-facts">
                {study.facts.map(([value, label]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="project-actions">
              {showcase?.play && (
                <Link to="/play" className="primary-button">
                  <Gamepad2 size={16} aria-hidden="true" /> Play it here
                </Link>
              )}
              {links.map((link) => (
                <a
                  key={link.href}
                  className={showcase?.play ? "text-button" : "primary-button"}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label} <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
          <div
            className={`project-hero-art ordo-card-art${art.type === "visual" ? "" : " ordo-personal-art"}`}
            aria-hidden="true"
          >
            <ProjectArt art={art} />
          </div>
        </div>
      </header>

      {showcase?.media.length ? (
        <section className="project-gallery section-wrap" aria-label="Screenshots">
          <ProjectGallery media={showcase.media} index={shot} onIndex={setShot} />
          {showcase.note && <p className="showcase-note mono">{showcase.note}</p>}
        </section>
      ) : null}

      <section className="project-body section-wrap">
        {showcase?.highlights.length ? (
          <div className="project-highlights">
            <h2>In numbers and decisions</h2>
            <ul className="showcase-highlights">
              {showcase.highlights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="project-story">
          {sections.map(([heading, text]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <p>{text}</p>
            </section>
          ))}
          {!showcase?.media.length && showcase?.note && (
            <p className="showcase-note mono">{showcase.note}</p>
          )}
        </div>
      </section>

      <nav className="project-pager section-wrap" aria-label="More projects">
        <Link to={`/work/${previous.slug}`} className="pager-link">
          <span className="mono">
            <ArrowLeft size={13} aria-hidden="true" /> Previous project
          </span>
          <strong>{previous.study.name}</strong>
        </Link>
        <Link to="/#work" className="pager-all mono">
          All projects
        </Link>
        <Link to={`/work/${next.slug}`} className="pager-link is-next">
          <span className="mono">
            Next project <ArrowRight size={13} aria-hidden="true" />
          </span>
          <strong>{next.study.name}</strong>
        </Link>
      </nav>
    </article>
  );
}
