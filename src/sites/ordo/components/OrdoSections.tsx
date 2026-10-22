import { useEffect, useRef, useState } from "react";
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
import Sculpture from "./Sculpture";
import ParticleField from "./ParticleField";

export function HeroTerminal() {
  return (
    <div className="hero-terminal" role="group" aria-label="Portfolio project index">
      <div className="terminal-chrome">
        <span>~/varun/projects</span>
        <span>readme</span>
      </div>
      <code>
        <span className="terminal-command">$ cat engineering.txt</span>
        <br />
        retrieval + agents + applications
        <br />
        <span className="terminal-dim">source → context → answer</span>
        <br />
        <br />
        <span className="terminal-check">✓</span> StudyForge / learning systems
        <br />
        <span className="terminal-check">✓</span> FinTrack / local-first finance
        <br />
        <span className="terminal-check">✓</span> MARA / quote-checked research
        <span className="terminal-caret" aria-hidden="true" />
      </code>
      <a href="#console">
        Open interactive terminal <ArrowUpRight size={12} />
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
        <span>[ 02 / SELECTED PROJECTS ]</span>
        <span>INDEPENDENT ENGINEERING</span>
      </div>
      <h2>
        Built to solve specific problems.
        <br />
        <span>Designed to be understood.</span>
      </h2>
      <p className="ordo-section-intro">
        Retrieval, mobile applications and systems research.
        <br />A closer look at the decisions behind the code.
      </p>
      <div className="ordo-project-grid">
        {ordoProjects.map((project, i) => (
          <motion.article
            key={project.slug}
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
          Experimental: DND AI Game <ArrowUpRight size={13} aria-hidden="true" />
        </a>
        <a href={`${CYAN_URL}/nexus`}>
          Browse the full archive <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

const stages = [
  {
    name: "Configure",
    heading: "Define the contract.",
    description:
      "Turn a requirement into typed inputs, outputs and tools before writing the pipeline.",
    file: "backend/app/config.py",
    status: "CONFIGURING",
    code: [
      "# configure: what goes in and out",
      "→ sources      pdf, word, notes, photos, audio",
      "→ outputs      cited book sections",
      "→ study tools  16, schema-validated",
      "→ retriever    dense + bm25",
      "✓ contract ready",
    ],
    metric: "16",
    unit: "STUDY TOOLS",
    caption: "Each one validated against a schema",
    nodes: ["INPUT", "QUERY"],
    form: 1,
  },
  {
    name: "Build",
    heading: "Connect the pieces.",
    description:
      "Build the interface, retrieval pipeline and API against that contract.",
    file: "backend/app/retrieval/retriever.py",
    status: "BUILDING",
    code: [
      "# build: the retrieval pipeline",
      "→ documents → chunks → index",
      "→ dense + bm25 → rank fusion",
      "→ diversity selection (mmr)",
      "→ llm rerank",
      "✓ source-linked context",
    ],
    metric: "185",
    unit: "TESTS",
    caption: "155 backend and 30 frontend tests",
    nodes: ["DENSE", "BM25", "RERANK"],
    form: 0,
  },
  {
    name: "Evaluate",
    heading: "Make quality observable.",
    description:
      "Compare retrieval changes on labelled queries and inspect failures before calling a result an improvement.",
    file: "backend/eval/run_eval.py",
    status: "SCORING",
    code: [
      "$ python eval/run_eval.py",
      "→ dense                recall@1  0.82",
      "→ hybrid+mmr+rerank    recall@1  1.00",
      "→ mrr@10               0.89 → 1.00",
      "→ scope                this evaluation set",
      "✓ 33 labelled queries",
    ],
    metric: "1.00",
    unit: "RECALL@1",
    caption: "Up from 0.82 on 33 labelled queries",
    nodes: ["ANSWER", "EVAL"],
    form: 2,
  },
  {
    name: "Deploy",
    heading: "Ship it, then improve it.",
    description:
      "Package the application, run the backend tests and a container health check on every push, then fix what fails.",
    file: ".github/workflows/ci.yml",
    status: "VERIFYING",
    code: [
      "$ git push",
      "→ ci        github actions",
      "→ tests     155 backend (pytest)",
      "→ image     docker build",
      "→ health    /health check",
      "✓ Docker + CI",
    ],
    metric: "CI",
    unit: "DOCKER",
    caption: "Docker build and health check on every push",
    nodes: ["ANSWER", "OUTPUT"],
    form: 0,
  },
];

const GRAPH: { id: string; x: number; y: number }[] = [
  { id: "INPUT", x: 8, y: 60 },
  { id: "QUERY", x: 62, y: 60 },
  { id: "DENSE", x: 122, y: 24 },
  { id: "BM25", x: 122, y: 96 },
  { id: "RERANK", x: 182, y: 60 },
  { id: "ANSWER", x: 238, y: 60 },
  { id: "EVAL", x: 238, y: 104 },
  { id: "OUTPUT", x: 292, y: 60 },
];
const EDGES = [
  ["INPUT", "QUERY"],
  ["QUERY", "DENSE"],
  ["QUERY", "BM25"],
  ["DENSE", "RERANK"],
  ["BM25", "RERANK"],
  ["RERANK", "ANSWER"],
  ["ANSWER", "EVAL"],
  ["ANSWER", "OUTPUT"],
];

function PromptGraph({ active }: { active: readonly string[] }) {
  const at = (id: string) => GRAPH.find((node) => node.id === id)!;
  return (
    <svg viewBox="0 0 346 124" className="prompt-graph" aria-hidden="true">
      {EDGES.map(([from, to]) => {
        const a = at(from),
          b = at(to);
        const lit = active.includes(from) || active.includes(to);
        return (
          <path
            key={from + to}
            d={`M${a.x + 44} ${a.y}H${(a.x + 44 + b.x - 6) / 2}V${b.y}H${b.x - 6}`}
            className={lit ? "is-lit" : ""}
          />
        );
      })}
      {GRAPH.map((node) => (
        <g key={node.id} className={active.includes(node.id) ? "is-lit" : ""}>
          <rect x={node.x - 6} y={node.y - 8} width="50" height="16" />
          <text x={node.x + 19} y={node.y + 3}>
            {node.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function OrdoWorkflow() {
  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const item = stages[active];
  const last = stages.length - 1;

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries[0].isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Choosing a stage stops the automatic tour.
  const choose = (index: number) => {
    setManual(true);
    setActive(index);
  };

  return (
    <section
      ref={sectionRef}
      className={`ordo-flow${manual ? " is-manual" : ""}${inView ? "" : " is-idle"}`}
    >
      <div className="section-wrap">
        <div className="ordo-section-label">
          <span>[ 03 / PROCESS ]</span>
          <span>IDEA → IMPLEMENTATION</span>
        </div>
        <div className="ordo-flow-heading">
          <h2>
            From idea to application.
            <br />
            <span>One connected workflow.</span>
          </h2>
          <p>
            Configure, build, evaluate and deploy. Each step feeds the next,
            shown here with StudyForge, my retrieval project.
          </p>
        </div>
        <div className="ordo-flow-grid">
          <div
            role="tablist"
            aria-label="Development workflow"
            aria-orientation="vertical"
          >
            {stages.map((s, i) => (
              <button
                role="tab"
                id={`ordo-stage-${i}`}
                key={s.name}
                aria-selected={active === i}
                aria-controls="ordo-flow-panel"
                tabIndex={active === i ? 0 : -1}
                onClick={() => choose(i)}
                onKeyDown={(event) => {
                  if (
                    ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
                  ) {
                    event.preventDefault();
                    const next =
                      event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? last
                          : (i + (event.key === "ArrowDown" ? 1 : last)) %
                            stages.length;
                    choose(next);
                    document.getElementById(`ordo-stage-${next}`)?.focus();
                  }
                }}
              >
                <span aria-hidden="true">0{i + 1}</span>
                {s.name}
                {active === i && (
                  <i
                    className="flow-progress"
                    aria-hidden="true"
                    onAnimationEnd={() =>
                      setActive((value) => (value + 1) % stages.length)
                    }
                  />
                )}
              </button>
            ))}
            <p aria-hidden="true">SELECT A STAGE TO STOP THE TOUR</p>
          </div>
          <div
            id="ordo-flow-panel"
            role="tabpanel"
            aria-labelledby={`ordo-stage-${active}`}
            className="ordo-flow-canvas"
            tabIndex={0}
          >
            <div className="flow-canvas-label">
              <span>
                STAGE 0{active + 1} / {item.name.toUpperCase()}
              </span>
              <span className="flow-canvas-project">STUDYFORGE</span>
              <span>
                STATUS <strong>{item.status}</strong>
              </span>
            </div>
            <svg
              className="flow-wires"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M49 30H52.5V33H56 M76 47V51H33V56 M49 70H55V68H62" />
            </svg>
            <div className="flow-code" key={`code-${active}`}>
              <div className="flow-code-top">
                <span>{item.file}</span>
                <span>{item.file.endsWith(".py") ? "PY" : "YML"}</span>
              </div>
              <code>
                {item.code.map((line, index) => (
                  <span
                    key={line}
                    style={{ animationDelay: `${index * 0.28}s` }}
                    className={line.startsWith("✓") ? "is-done" : undefined}
                  >
                    {line}
                  </span>
                ))}
              </code>
            </div>
            <div className="flow-graph">
              <div className="flow-card-top">
                <span>RETRIEVAL GRAPH</span>
                <span>{GRAPH.length} NODES</span>
              </div>
              <PromptGraph active={item.nodes} />
            </div>
            <div className="flow-output" key={`out-${active}`}>
              <div className="flow-card-top">
                <span>{item.name.toUpperCase()}</span>
                <i aria-hidden="true" />
              </div>
              <strong>
                {item.metric} <small>{item.unit}</small>
              </strong>
              <p>{item.caption}</p>
              <div className="output-cells" aria-hidden="true">
                {Array.from({ length: 22 }, (_, n) => (
                  <i key={n} style={{ animationDelay: `${n * 0.04}s` }} />
                ))}
              </div>
            </div>
            <div className="flow-form">
              <div className="flow-card-top">
                <span>FORM</span>
                <span>MODE 0{item.form + 1}</span>
              </div>
              <Sculpture bare shape={item.form} detail={56} />
            </div>
            <div className="flow-note" aria-live={manual ? "polite" : "off"}>
              <strong>{item.heading}</strong>
              <p>{item.description}</p>
            </div>
          </div>
        </div>
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
            <span>[ 04 / SYSTEM ]</span>
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
