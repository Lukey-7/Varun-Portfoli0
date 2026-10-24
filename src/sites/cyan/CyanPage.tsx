import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Github,
  Linkedin,
  Menu,
  Moon,
  Pause,
  Play,
  Sun,
  X,
  Code2,
  Gamepad2,
  Plus,
  Minus,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { profile, experience, education } from "@/data/profile";
import {
  selectedWork,
  otherWork,
  deliveryWork,
  type CaseStudy,
} from "@/data/portfolio";
import { resetPointer, trackPointer } from "@/lib/pointer";
import { ORDO_URL } from "@/lib/sites";
import { isMotionPaused, setMotionPaused, useMotionPaused } from "@/lib/motion-pause";
import ProjectVisual from "@/components/portfolio/ProjectVisual";
import ProjectDetail from "@/components/portfolio/ProjectDetail";
import { CommandPalette, CyanResearch } from "./components/CyanSections";
import { ShortcutsDialog, logConsoleNote, useShortcuts } from "./components/Shortcuts";
import { PcbSignalMap } from "./motion/PcbSignalMap";
import { CyanResultsInstrument } from "./motion/EvalMeters";
import HeroField from "./motion/HeroField";
import { DecodeText } from "./motion/DecodeText";
import { LocalClock } from "./motion/LocalClock";
import { DitherField } from "./motion/DitherField";
import { PipelineFlow } from "./motion/PipelineFlow";
import { ScopeDivider } from "./motion/ScopeDivider";
import { Lissajous } from "./motion/Lissajous";
import { ExperienceTimeline } from "./motion/ExperienceTimeline";
import "./cyan.css";

const workflow = [
  {
    name: "Find the evidence",
    description:
      "Combine semantic and keyword search, then rerank, so the passage that answers the question comes first.",
    chips: ["Documents", "Dense + BM25", "Rerank", "Context"],
    note: "Retrieval is scored on its own, before any text is generated.",
  },
  {
    name: "Check the answer",
    description:
      "Validate the output structure, keep quotes word for word, and test each change on labelled queries.",
    chips: ["Context", "Generate", "Verify quotes", "Citations"],
    note: "An answer keeps only the claims its sources support.",
  },
  {
    name: "Ship and learn",
    description:
      "Connect the API and interface, test what happens when things fail, and let what users hit decide the next change.",
    chips: ["API", "Tests", "Deploy", "Feedback"],
    note: "Tests and a container build run on every push.",
  },
];

/** The cyan edition: the original identity, refined. Deployed on its own. */
export default function CyanPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<CaseStudy | null>(null);
  const [step, setStep] = useState(0);
  const [openJob, setOpenJob] = useState<string | null>("letstute");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // The "Also built" card being hovered or focused, by project name.
  const [signalled, setSignalled] = useState<string | null>(null);
  // The job being hovered or focused, by id, in the experience timeline or its list.
  const [active, setActive] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const motionPaused = useMotionPaused();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.portfolioTheme = theme;
    document.documentElement.dataset.portfolioEdition = "cyan";
    document.title = "Varun Darji | AI Engineer";
    return () => {
      delete document.documentElement.dataset.portfolioTheme;
      delete document.documentElement.dataset.portfolioEdition;
      clearTimeout(copyTimer.current);
    };
  }, [theme]);

  // The page's graticule brightens around the pointer (see cyan.css).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0,
      x = -999,
      y = -999;
    const apply = () => {
      frame = 0;
      root.style.setProperty("--cx", `${x}px`);
      root.style.setProperty("--cy", `${y}px`);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const leave = () => {
      x = y = -999;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  // One plain line for anyone who opens the console.
  useEffect(() => {
    logConsoleNote();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      setCopyError(false);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopyError(true);
    }
  };
  const toggleTheme = () => setTheme((value) => (value === "dark" ? "light" : "dark"));
  const go = (target: string) =>
    target.startsWith("#")
      ? document.querySelector(target)?.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
        })
      : navigate(target);
  // The header button is disabled under reduced motion, so the shortcut leaves it alone too.
  const toggleMotion = () => {
    if (!reducedMotion) setMotionPaused(!isMotionPaused());
  };
  const showShortcuts = () => setHelpOpen(true);
  useShortcuts({ toggleTheme, toggleMotion, showHelp: showShortcuts, go });
  const signal = (name: string) => setSignalled(name);
  // Leaving one card must not clear the card that has since taken over.
  const release = (name: string) =>
    setSignalled((current) => (current === name ? null : current));
  // Leaving one job row must not clear the job that has since taken over.
  const releaseJob = (id: string) =>
    setActive((current) => (current === id ? null : current));
  const reveal = {
    initial: reducedMotion ? (false as const) : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.1 },
    transition: { duration: 0.55 },
  };

  return (
    <div ref={rootRef} className="portfolio cyan-edition" data-theme={theme}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="portfolio-header">
        <div className="header-inner">
          <Link to="/" className="wordmark">
            <span className="brand-mark" aria-hidden="true">
              v<span>.</span>
            </span>
            VARUN.DEV
          </Link>
          <nav className="desktop-links" aria-label="Main navigation">
            <a href="#work">Work</a>
            <a href="#research">Research</a>
            <a href="#experience">Experience</a>
            <a href="#about">About</a>
          </nav>
          <div className="header-actions">
            <CommandPalette
              actions={{
                openProject: setSelected,
                copyEmail,
                toggleTheme,
                showShortcuts,
                toggleMotion,
                go,
              }}
            />
            <button
              className="icon-button motion-toggle"
              aria-label={motionPaused ? "Play all animations" : "Pause all animations"}
              title={motionPaused ? "Play all animations" : "Pause all animations"}
              disabled={reducedMotion ?? false}
              onClick={() => setMotionPaused(!motionPaused)}
            >
              {motionPaused || reducedMotion ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <a className="header-contact" href="#contact">
              Contact me <ArrowUpRight size={15} />
            </a>
            <button
              className="icon-button mobile-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            className="mobile-links"
            aria-label="Mobile navigation"
          >
            {["Work", "Research", "Experience", "About", "Contact"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase()}`}
                onClick={() => setMenuOpen(false)}
              >
                {label}
                <ArrowUpRight size={18} />
              </a>
            ))}
          </nav>
        )}
      </header>

      <main id="main">
        <section className="hero section-wrap">
          <motion.div
            className="hero-copy"
            initial={reducedMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <p className="hero-eyebrow mono">
              <DecodeText text="Varun Darji / AI engineer at LetsTute / Mumbai" duration={650} />
            </p>
            <h1>
              Retrieval and agents,
              <br />
              <span>measured before they ship.</span>
            </h1>
            <p className="hero-description">
              I build document extraction, retrieval and agent workflows for
              client systems. In my own projects, every retrieval change is
              scored against a baseline before I keep it.
            </p>
            <div className="hero-actions">
              <a href="#work" className="primary-button">
                Explore work <ArrowDown size={17} />
              </a>
              <a
                href="/Varun-Darji-Resume.pdf"
                download
                className="text-button"
              >
                Resume <Download size={16} />
              </a>
            </div>
          </motion.div>
          <motion.div
            className="hero-art"
            onPointerMove={trackPointer}
            onPointerLeave={resetPointer}
            initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
          >
            <div className="art-halo" />
            <HeroField />
          </motion.div>
        </section>
        <div className="intro-band section-wrap">
          <p>
            <span className="band-label">Currently</span>
            <strong>AI Engineer at LetsTute</strong>
          </p>
          <p>
            <span className="band-label">Background</span>
            <strong>M.Sc. Computer Science</strong>
          </p>
          <p>
            <span className="band-label">Based in</span>
            <strong>
              Mumbai, India <LocalClock className="band-clock mono" />
            </strong>
          </p>
        </div>

        <div className="section-wrap scope-slot">
          <ScopeDivider />
        </div>

        <section id="work" className="work-section section-wrap">
          <motion.div {...reveal} className="section-heading">
            <h2>
              Selected work<span className="heading-period">.</span>
            </h2>
            <p>
              Four projects I built on my own. Open one for the problem, what
              I built and how I checked it.
            </p>
          </motion.div>
          <div className="work-grid">
            {selectedWork.map((project, index) => (
              <motion.article
                {...reveal}
                transition={{ duration: 0.45, delay: (index % 2) * 0.08 }}
                key={project.id}
                className={`work-card work-${project.id}`}
              >
                <button
                  className="project-open"
                  onPointerMove={trackPointer}
                  aria-label={`Read ${project.name} case study`}
                  onClick={() => setSelected(project)}
                >
                  <div className="project-illustration">
                    <ProjectVisual kind={project.visual} />
                    {/* Hovering a card is a probe: a sweep, then one real fact. */}
                    <span className="probe-scan" aria-hidden="true" />
                    <span className="probe-readout mono" aria-hidden="true">
                      <span>[PROBE]</span> <b>{project.facts[0][0]}</b> {project.facts[0][1]}
                    </span>
                    <span className="project-open-arrow" aria-hidden="true">
                      <ArrowUpRight size={22} />
                    </span>
                  </div>
                  <div className="project-copy">
                    <div className="project-name-row">
                      <h3>{project.name}</h3>
                      <span className="mono">{project.category}</span>
                    </div>
                    <p>{project.description}</p>
                    <div className="project-tech mono">
                      {project.stack.join(" / ")}
                    </div>
                  </div>
                </button>
              </motion.article>
            ))}
          </div>
          <div className="archive-link">
            <Link to="/nexus">
              Open the full project archive <ArrowRight size={17} />
            </Link>
          </div>
        </section>

        <CyanResultsInstrument />

        <section className="other-section section-wrap">
          <h2>Also built.</h2>
          <div className="other-grid">
            {otherWork.map((project) => (
              <a
                className={`other-project ${project.kind}`}
                href={project.href}
                target={project.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                key={project.name}
                onMouseEnter={() => signal(project.name)}
                onMouseLeave={() => release(project.name)}
                onFocus={() => signal(project.name)}
                onBlur={() => release(project.name)}
              >
                <div className="other-symbol">
                  {project.kind === "language" ? (
                    <span lang="de">ß</span>
                  ) : project.kind === "tetris" ? (
                    <div className="tetromino" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </div>
                  ) : (
                    <Gamepad2 size={38} strokeWidth={1.1} />
                  )}
                </div>
                <div>
                  <div className="other-name">
                    <h3>{project.name}</h3>
                    <ArrowUpRight size={18} />
                  </div>
                  <p>{project.description}</p>
                  <span className="mono">{project.tech}</span>
                  <Lissajous seed={project.name} active={signalled === project.name} />
                </div>
              </a>
            ))}
          </div>
        </section>

        <PcbSignalMap />

        <section className="approach-section">
          <div className="section-wrap approach-inner">
            <motion.div {...reveal} className="approach-copy">
              <h2>
                How I work,
                <br />
                <span>from evidence to shipping.</span>
              </h2>
              <div
                className="workflow-tabs"
                role="tablist"
                aria-orientation="vertical"
                aria-label="Engineering approach"
              >
                {workflow.map((item, index) => (
                  <button
                    id={`step-${index}`}
                    role="tab"
                    aria-selected={step === index}
                    aria-controls="workflow-panel"
                    tabIndex={step === index ? 0 : -1}
                    key={item.name}
                    onClick={() => setStep(index)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        const next =
                          (step + (event.key === "ArrowDown" ? 1 : 2)) % 3;
                        setStep(next);
                        document.getElementById(`step-${next}`)?.focus();
                      }
                    }}
                  >
                    {item.name}
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </div>
            </motion.div>
            <div
              className="workflow-panel"
              id="workflow-panel"
              role="tabpanel"
              aria-labelledby={`step-${step}`}
              tabIndex={0}
            >
              <PipelineFlow chips={workflow[step].chips} step={step} />
              <div className="workflow-text" aria-live="polite">
                <h3>{workflow[step].note}</h3>
                <p>{workflow[step].description}</p>
              </div>
            </div>
          </div>
        </section>

        <CyanResearch />

        <section id="experience" className="experience-section section-wrap">
          <motion.div {...reveal} className="section-heading">
            <h2>
              Experience,
              <br />
              <span>newest first.</span>
            </h2>
            <p>
              I joined LetsTute as an AI engineer in August 2026. Before that I
              was a Java backend intern on a fintech platform and a student
              intern at my university.
            </p>
          </motion.div>
          <ExperienceTimeline jobs={experience} active={active} onActive={setActive} />
          <div className="experience-list">
            {experience.map((job) => (
              <article
                className="experience-item"
                key={job.id}
                data-active={active === job.id ? "" : undefined}
                onMouseEnter={() => setActive(job.id)}
                onMouseLeave={() => releaseJob(job.id)}
                onFocus={() => setActive(job.id)}
                onBlur={() => releaseJob(job.id)}
              >
                <button
                  aria-expanded={openJob === job.id}
                  aria-controls={`job-${job.id}`}
                  onClick={() => setOpenJob(openJob === job.id ? null : job.id)}
                >
                  <span className="experience-period mono">
                    {job.period.replace(/[—–]/g, "-")}
                  </span>
                  <span className="experience-title">
                    <strong>{job.role}</strong>
                    <span>{job.company}</span>
                  </span>
                  {openJob === job.id ? <Minus size={20} /> : <Plus size={20} />}
                </button>
                <div id={`job-${job.id}`} hidden={openJob !== job.id}>
                  {job.id === "letstute" ? (
                    <>
                      <div className="delivery-grid">
                        {deliveryWork.map((item) => (
                          <div key={item.title}>
                            <h3>{item.title}</h3>
                            <p>{item.text}</p>
                            <span className="mono">{item.tags}</span>
                          </div>
                        ))}
                      </div>
                      <p className="confidential-note">
                        Client systems are private. I can talk through the
                        architecture, my part and the engineering decisions
                        without sharing confidential access or data.
                      </p>
                    </>
                  ) : (
                    <ul className="experience-details">
                      {job.highlights.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="about-section section-wrap">
          <motion.div {...reveal} className="about-statement">
            <span className="mono about-label">A little about me</span>
            <h2>
              Curious about the model.
              <br />
              <span>Responsible for the system.</span>
            </h2>
            <p>
              I'm Varun, an AI engineer in Mumbai. I enjoy the work between an
              interesting model and a useful application: retrieval, backend
              APIs, evaluation and the interface someone actually uses.
            </p>
            <p>
              Outside client work, I build learning tools and an on-device
              finance app, and I have written a research proposal on cutting
              the cost of running LLM assistants.
            </p>
            <a
              href={profile.github}
              target="_blank"
              rel="noreferrer"
              className="text-button"
            >
              View my GitHub <ArrowUpRight size={17} />
            </a>
          </motion.div>
          <div className="about-details">
            <div className="toolbox">
              <h3>What I work with</h3>
              <div className="toolbox-group">
                <span>Build</span>
                <p>Python, FastAPI, TypeScript, React, Java, C++</p>
              </div>
              <div className="toolbox-group">
                <span>Reason</span>
                <p>RAG, LangGraph, LlamaIndex, hybrid retrieval, evaluation</p>
              </div>
              <div className="toolbox-group">
                <span>Deliver</span>
                <p>PostgreSQL, Docker, GitHub Actions, GCP, AWS</p>
              </div>
            </div>
            <div className="education-list">
              <h3>Education</h3>
              {education.map((item) => (
                <div key={item.id}>
                  <span className="mono">{item.year}</span>
                  <p>
                    <strong>{item.degree}</strong>
                    <span>{item.institution}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="contact-section section-wrap">
          <DitherField side="right" />
          <div className="contact-top">
            <h2>
              Write to me about a role,
              <br />
              <span>research or a project.</span>
            </h2>
            <a
              className="contact-arrow"
              href={`mailto:${profile.email}`}
              aria-label="Contact Varun by email"
            >
              <ArrowUpRight strokeWidth={1} />
            </a>
          </div>
          <div className="contact-bottom">
            <div className="email-group">
              <a href={`mailto:${profile.email}`} className="email-link">
                {profile.email}
              </a>
              <button
                className="icon-button"
                onClick={copyEmail}
                aria-label={copied ? "Email copied" : "Copy email address"}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
              <span className="copy-status" role="status">
                {copied
                  ? "Copied"
                  : copyError
                    ? "Select the address to copy it."
                    : ""}
              </span>
            </div>
            <div className="social-links">
              <a href={profile.github} target="_blank" rel="noreferrer">
                <Github size={16} /> GitHub
              </a>
              <a href={profile.linkedin} target="_blank" rel="noreferrer">
                <Linkedin size={16} /> LinkedIn
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="portfolio-footer section-wrap">
        <span>© {new Date().getFullYear()} Varun Darji</span>
        <div>
          <button type="button" className="shortcut-hint mono" onClick={showShortcuts}>
            Press ? for shortcuts
          </button>
          <Link to="/vault">Skill map</Link>
          <Link to="/terminal">
            Interactive terminal <Code2 size={14} />
          </Link>
          <a href="#main">Back to top ↑</a>
        </div>
      </footer>
      <aside className="edition-switch" aria-label="Portfolio design edition">
        <span>Design</span>
        <a href="/" aria-current="page">
          Cyan
        </a>
        <a href={ORDO_URL}>Monochrome</a>
      </aside>
      <ProjectDetail project={selected} onClose={() => setSelected(null)} />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
