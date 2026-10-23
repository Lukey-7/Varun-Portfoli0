import { useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { Link } from "react-router-dom";
import { otherWork } from "@/data/portfolio";
import { CYAN_URL } from "@/lib/sites";
import { ordoProjects } from "../projects";
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

/** The project grid. Each card links to the project's own page. */
export function OrdoWork() {
  const reduced = useReducedMotion();
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
          <motion.article
            key={project.slug}
            id={`spot-${project.slug}`}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}
          >
            <Link
              to={`/work/${project.slug}`}
              className="ordo-project-button"
              aria-labelledby={`card-${project.slug}-title card-${project.slug}-action`}
            >
              <div className="ordo-card-top">
                <span>/{String(i + 1).padStart(2, "0")}</span>
                <span>{project.tag}</span>
              </div>
              <div
                className={`ordo-card-art${project.art.type === "visual" ? "" : " ordo-personal-art"}`}
              >
                <ProjectArt art={project.art} />
              </div>
              <div className="ordo-card-copy">
                <h3 id={`card-${project.slug}-title`}>{project.study.name}</h3>
                <p>{project.study.description}</p>
                <span className="ordo-card-action" id={`card-${project.slug}-action`}>
                  {project.action} <ArrowUpRight size={15} aria-hidden="true" />
                </span>
              </div>
            </Link>
          </motion.article>
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
            <span>
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
