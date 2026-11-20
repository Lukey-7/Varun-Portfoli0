import { useRef, useState } from "react";
import { ArrowUpRight, Github } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { Link } from "react-router-dom";
import { otherWork } from "@/data/portfolio";
import { CYAN_URL } from "@/lib/sites";
import { ordoProjects, type OrdoProject } from "../projects";
import { projectShowcase } from "../projectShowcase";
import { ProjectPreview } from "../home/ProjectPreview";
import ProjectArt from "./ProjectArt";
import ParticleField from "./ParticleField";
import { content } from "../content";

export function HeroTerminal() {
  const t = content.heroTerminal;
  return (
    <div className="hero-terminal" role="group" aria-label="What Varun is working on">
      <div className="terminal-chrome">
        <span>{t.path}</span>
        <span>{t.file}</span>
      </div>
      <code>
        <span className="terminal-command">$ cat {t.file}</span>
        <br />
        <span className="terminal-dim"># updated {t.updated}</span>
        <br />
        {t.rows.map(([key, value]) => (
          <span key={key} className="terminal-row">
            <span className="terminal-dim">{key.padEnd(6, "\u00a0")}</span> {value}
            <br />
          </span>
        ))}
        <br />
        {t.projects.map(([name, line], index) => (
          <span key={name}>
            <span className="terminal-check">✓</span> {name} / {line}
            {index < t.projects.length - 1 ? <br /> : <span className="terminal-caret" aria-hidden="true" />}
          </span>
        ))}
      </code>
      <a href="#console">
        {t.link} <ArrowUpRight size={12} />
      </a>
    </div>
  );
}

/** One project card: artwork that gives way to real screens on hover or focus. */
function ProjectCard({ project, index }: { project: OrdoProject; index: number }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(false);
  const showcase = projectShowcase[project.showcaseId];
  const media = showcase?.media ?? [];
  const repo =
    showcase?.links?.find((link) => link.href.includes("github.com"))?.href ?? project.study.github;
  const id = `card-${project.slug}`;
  return (
    <motion.article
      id={`spot-${project.slug}`}
      className={active ? "is-previewing" : undefined}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.06 }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setActive(true);
      }}
      onPointerLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setActive(false);
      }}
    >
      <Link
        to={`/work/${project.slug}`}
        className="ordo-project-button"
        aria-labelledby={`${id}-title ${id}-action`}
      >
        <div className="ordo-card-top">
          <span>/{String(index + 1).padStart(2, "0")}</span>
          <span>{project.tag}</span>
        </div>
        <div className={`ordo-card-art${project.art.type === "visual" ? "" : " ordo-personal-art"}`}>
          <ProjectArt art={project.art} />
          <ProjectPreview media={media} active={active} />
        </div>
        <div className="ordo-card-copy">
          <h3 id={`${id}-title`}>{project.study.name}</h3>
          <p>{project.study.description}</p>
          <span className="ordo-card-action" id={`${id}-action`}>
            {project.action} <ArrowUpRight size={15} aria-hidden="true" />
          </span>
        </div>
      </Link>
      {(media.length > 0 || repo) && (
        <div className="ordo-card-foot mono">
          <span>{media.length > 0 && `${String(media.length).padStart(2, "0")} screens`}</span>
          {repo && (
            <a href={repo} target="_blank" rel="noreferrer" aria-label={`${project.study.name} source on GitHub`}>
              <Github size={13} aria-hidden="true" /> Source <ArrowUpRight size={12} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </motion.article>
  );
}

/** The project grid. Each card links to the project's own page and its source. */
export function OrdoWork() {
  return (
    <section id="work" className="ordo-work section-wrap">
      <div className="ordo-section-label">
        <span>{content.work.label[0]}</span>
        <span>{content.work.label[1]}</span>
      </div>
      <h2>
        {content.work.title[0]}
        <br />
        <span>{content.work.title[1]}</span>
      </h2>
      <p className="ordo-section-intro">{content.work.intro}</p>
      <div className="ordo-project-grid">
        {ordoProjects.map((project, i) => (
          <ProjectCard key={project.slug} project={project} index={i} />
        ))}
      </div>
      <div className="ordo-archive-row">
        <a href={otherWork[2].href} target="_blank" rel="noreferrer">
          {content.work.archive.experimental} <ArrowUpRight size={13} aria-hidden="true" />
        </a>
        <a href={`${CYAN_URL}/nexus`}>
          {content.work.archive.all} <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

const PHASES = ["SCATTER", "ASSEMBLE", "FORMED", "RELEASE"];

export function OrdoShowcase() {
  const ref = useRef<HTMLElement>(null);
  const [count] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 700 ? 82 * 36 : 130 * 36,
  );
  const [phase, setPhase] = useState(0);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = value < 0.12 ? 0 : value < 0.45 ? 1 : value < 0.72 ? 2 : 3;
    setPhase((current) => (current === next ? current : next));
  });
  return (
    <section ref={ref} className="ordo-showcase">
      <div className="showcase-sticky">
        <div className="section-wrap showcase-inner">
          <div className="ordo-section-label">
            <span>[ 05 / SYSTEM ]</span>
            <span className="showcase-phase">
              <span className="phase-ticks" aria-hidden="true">
                {PHASES.map((name, i) => (
                  <i key={name} className={i <= phase ? "is-on" : undefined} />
                ))}
              </span>
              PHASE 0{phase + 1} / {PHASES[phase]}
            </span>
          </div>
          <ParticleField progress={scrollYProgress} count={count} />
          <span className="particle-tag tag-system">
            <i /> SYSTEM / ACTIVE
          </span>
          <span className="particle-tag tag-nodes">
            <i /> PARTICLES / <strong>{count.toLocaleString("en-IN")}</strong>
          </span>
          <span className="particle-tag tag-input">
            <i /> INPUT → EVIDENCE
          </span>
          <span className="particle-tag tag-status">
            <i className="is-live" /> CONTEXT → ANSWER
          </span>
          <div className="showcase-bottom">
            <h2>
              Intelligence needs
              <br />a reliable foundation.
            </h2>
            <p>
              Retrieval. Evaluation. Interfaces.
              <br />
              What turns a model into a useful product.
            </p>
          </div>
          <div className="showcase-progress" aria-hidden="true">
            <span>00</span>
            <div>
              <motion.i style={{ scaleX: scrollYProgress }} />
            </div>
            <span>100</span>
          </div>
        </div>
      </div>
    </section>
  );
}
