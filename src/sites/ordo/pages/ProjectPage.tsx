import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Github } from "lucide-react";
import { findProject, ordoProjects } from "../projects";
import { projectShowcase } from "../projectShowcase";
import { ProjectGallery } from "../components/ProjectShowcase";
import { hasDemo, ProjectDemo } from "../demos/ProjectDemo";
import { posts } from "../writing";
import CountUp from "../work/CountUp";
import HeroFigure from "../work/HeroFigure";
import NextProject from "../work/NextProject";
import SectionRail, { type RailSection } from "../work/SectionRail";
import { pad } from "../work/hooks";
import "../work/work.css";
import NotFoundPage from "./NotFoundPage";

/** One project's case study: animated icon, gallery, verified detail, next and previous. */
export default function ProjectPage() {
  const { slug } = useParams();
  const project = findProject(slug);

  useEffect(() => {
    if (project) document.title = `${project.study.name} | Varun Darji`;
  }, [project]);

  if (!project) return <NotFoundPage />;

  const { study, art } = project;
  const showcase = projectShowcase[project.showcaseId];
  const index = ordoProjects.indexOf(project);
  const previous = ordoProjects[(index - 1 + ordoProjects.length) % ordoProjects.length];
  const nextIndex = (index + 1) % ordoProjects.length;
  const next = ordoProjects[nextIndex];
  const idea = [
    ["The problem", study.problem],
    ["What I built", study.approach ?? showcase?.idea],
  ].filter(([, text]) => text) as [string, string][];
  const proof = [
    ["How I checked it", study.evidence],
    ["My part", study.ownership],
  ].filter(([, text]) => text) as [string, string][];
  const facts = showcase?.facts ?? study.facts;
  const writeUp = posts.find((post) => post.project === project.slug);
  const links =
    showcase?.links ?? (study.github ? [{ label: "View on GitHub", href: study.github }] : []);
  const repo = links.find((link) => link.href.includes("github.com"));
  const demo = hasDemo(project.showcaseId);
  const media = showcase?.media ?? [];

  const sections: RailSection[] = [
    media.length ? { id: "screens", label: "Screens" } : null,
    idea.length ? { id: "idea", label: "Idea" } : null,
    demo ? { id: "try-it", label: "Demo" } : null,
    { id: "details", label: "Details" },
  ].filter((section): section is RailSection => section !== null);
  const step = (id: string) => pad(sections.findIndex((section) => section.id === id) + 1);

  return (
    <article className="project-page work-page">
      <header className="project-hero section-wrap">
        <div className="ordo-section-label">
          <span>[ WORK / {study.name.toUpperCase()} ]</span>
          <span>
            PROJECT {pad(index + 1)} / {pad(ordoProjects.length)}
          </span>
        </div>
        <div className="project-hero-grid">
          <div className="project-hero-copy">
            <span className="mono project-category">{study.category}</span>
            <h1>{study.name}</h1>
            <p className="project-lede">{showcase?.pitch ?? study.description}</p>
            {facts.length > 0 && (
              <div className="project-facts">
                {facts.map(([value, label]) => (
                  <div key={label}>
                    <strong>
                      <CountUp value={value} />
                    </strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="project-actions">
              {demo && (
                <a href="#try-it" className="primary-button">
                  {showcase?.play ? "Play it here" : "Try the demo"} <ArrowDown size={16} aria-hidden="true" />
                </a>
              )}
              {links.map((link) => {
                const isRepo = link === repo;
                return (
                  <a
                    key={link.href}
                    className={demo ? (isRepo ? "work-repo-button" : "text-button") : "primary-button"}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {isRepo && <Github size={16} aria-hidden="true" />}
                    {link.label} <ArrowUpRight size={16} aria-hidden="true" />
                  </a>
                );
              })}
              {writeUp && (
                <Link to={`/writing/${writeUp.slug}`} className="text-button">
                  Read the write-up <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
          <HeroFigure art={art} name={study.name} number={index + 1} />
        </div>
      </header>

      <SectionRail name={study.name} sections={sections} repo={repo} />

      {media.length ? (
        <section id="screens" tabIndex={-1} className="project-gallery work-section section-wrap" aria-label="Screenshots">
          <div className="work-section-head">
            <span className="mono project-step">{step("screens")} / Screens</span>
            <span className="mono project-step">
              {pad(media.length)} {media.length === 1 ? "image" : "images"}
            </span>
          </div>
          <ProjectGallery name={study.name} media={media} note={showcase?.note} />
        </section>
      ) : null}

      {idea.length > 0 && (
        <section id="idea" tabIndex={-1} className="project-idea work-section section-wrap">
          <span className="mono project-step">{step("idea")} / The idea</span>
          {idea.map(([heading, text]) => (
            <div key={heading}>
              <h2>{heading}</h2>
              <p>{text}</p>
            </div>
          ))}
        </section>
      )}

      {demo && (
        <section id="try-it" tabIndex={-1} className="project-demo work-section section-wrap">
          <span className="mono project-step">{step("try-it")} / Try it</span>
          <ProjectDemo id={project.showcaseId} />
          {showcase?.play && (
            <Link to="/play" className="section-link">
              Open the arcade page <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )}
        </section>
      )}

      <section id="details" tabIndex={-1} className="project-body work-section section-wrap">
        <span className="mono project-step work-body-step">{step("details")} / Details</span>
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
          {proof.map(([heading, text]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <p>{text}</p>
            </section>
          ))}
          {!media.length && showcase?.note && <p className="showcase-note mono">{showcase.note}</p>}
          {repo && (
            <a className="work-source" href={repo.href} target="_blank" rel="noreferrer">
              <span className="mono">Source code</span>
              <strong>
                <Github size={18} aria-hidden="true" />
                {repo.href.replace(/^https:\/\/(www\.)?/, "")}
              </strong>
              <span className="work-source-cta">
                {repo.label} <ArrowUpRight size={15} aria-hidden="true" />
              </span>
            </a>
          )}
        </div>
      </section>

      <NextProject previous={previous} next={next} nextNumber={nextIndex + 1} total={ordoProjects.length} />
    </article>
  );
}
