import { useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import {
  selectedWork,
  otherWork,
  sprachwegCase,
  type CaseStudy,
} from "@/data/portfolio";
import { CYAN_URL } from "@/lib/sites";
import ProjectVisual from "@/components/portfolio/ProjectVisual";
import { tetrisCase } from "../projectShowcase";
import TetrisMini from "./TetrisMini";
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

export function OrdoWork({
  onSelect,
}: {
  onSelect: (project: CaseStudy) => void;
}) {
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
        {selectedWork.map((p, i) => (
          <motion.article
            key={p.id}
            id={`spot-${p.id}`}
            initial={reduced ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}
          >
            <button
              onClick={() => onSelect(p)}
              aria-labelledby={`card-${p.id}-title card-${p.id}-action`}
              className="ordo-project-button"
            >
              <div className="ordo-card-top">
                <span>/{String(i + 1).padStart(2, "0")}</span>
                <span>{p.stack[0]}</span>
              </div>
              <div className="ordo-card-art">
                <ProjectVisual kind={p.visual} />
              </div>
              <div className="ordo-card-copy">
                <h3 id={`card-${p.id}-title`}>{p.name}</h3>
                <p>{p.description}</p>
                <span className="ordo-card-action" id={`card-${p.id}-action`}>
                  View project <ArrowUpRight size={15} aria-hidden="true" />
                </span>
              </div>
            </button>
          </motion.article>
        ))}
        {otherWork.slice(0, 2).map((p, i) => {
          const body = (
            <>
              <div className="ordo-card-top">
                <span>/{String(selectedWork.length + i + 1).padStart(2, "0")}</span>
                <span>{p.category}</span>
              </div>
              <div className={`ordo-card-art ordo-personal-art ${p.kind}`}>
                {p.kind === "language" ? (
                  <div className="language-orbit">
                    <span>ß</span>
                    <i>lernen</i>
                    <i>verstehen</i>
                    <i>wiederholen</i>
                  </div>
                ) : (
                  <TetrisMini />
                )}
              </div>
              <div className="ordo-card-copy">
                <h3 id={`card-${p.kind}-title`}>{p.name}</h3>
                <p>{p.description}</p>
                <span className="ordo-card-action" id={`card-${p.kind}-action`}>
                  {p.kind === "language" ? "View project" : "View and play"}{" "}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </span>
              </div>
            </>
          );
          return (
            <motion.article
              key={p.name}
              id={`spot-${p.kind === "language" ? "sprachweg" : "arcade"}`}
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              {/* Both open their detail here: Sprachweg's source is private, and the arcade is playable. */}
              <button
                className="ordo-project-button"
                aria-labelledby={`card-${p.kind}-title card-${p.kind}-action`}
                onClick={() => onSelect(p.kind === "language" ? sprachwegCase : tetrisCase)}
              >
                {body}
              </button>
            </motion.article>
          );
        })}
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
