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
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { profile, education } from "@/data/profile";
import type { CaseStudy } from "@/data/portfolio";
import { resetPointer, trackPointer } from "@/lib/pointer";
import { ARCADE_URL, ORDO_URL } from "@/lib/sites";
import { isMotionPaused, setMotionPaused, useMotionPaused } from "@/lib/motion-pause";
import ProjectVisual from "@/components/portfolio/ProjectVisual";
import ProjectDetail from "@/components/portfolio/ProjectDetail";
import { cyanWork } from "./copy";
import { CommandPalette, CyanResearch } from "./components/CyanSections";
import { ExperienceSection } from "./components/ExperienceSection";
import { OtherWork } from "./components/OtherWork";
import { ShortcutsDialog, logConsoleNote, useShortcuts } from "./components/Shortcuts";
import { PcbSignalMap } from "./motion/PcbSignalMap";
import { CyanResultsInstrument } from "./motion/EvalMeters";
import HeroField from "./motion/HeroField";
import { DecodeText } from "./motion/DecodeText";
import { LocalClock } from "./motion/LocalClock";
import { DitherField } from "./motion/DitherField";
import { PipelineFlow } from "./motion/PipelineFlow";
import { ScopeDivider } from "./motion/ScopeDivider";
import { EndOfTransmission } from "./motion/EndOfTransmission";
import "./cyan.css";

const workflow = [
  {
    name: "Find the evidence",
    description:
      "Dense search and BM25 each pull candidates, then a reranker sorts them. With the reranker on, the right passage came first on all 33 labelled questions over three short StudyForge documents, up from 27 with dense search.",
    chips: ["Documents", "Dense + BM25", "Rerank", "Context"],
    note: "I score retrieval on its own, before the model writes a word.",
  },
  {
    name: "Check the answer",
    description:
      "StudyForge's study tools have to pass their schemas. Retrieval changes run on labelled queries before I keep them.",
    chips: ["Context", "Generate", "Verify quotes", "Citations"],
    note: "In MARA, a note whose quote isn't in the source gets thrown out.",
  },
  {
    name: "Ship and learn",
    description:
      "I wire the API to the interface, then test how it fails. Given MARA's one deliberately unanswerable question, every model replied that no evidence was found. When FinTrack misreads a bank's wording, the report becomes a new row in its parser corpus.",
    chips: ["API", "Tests", "Deploy", "Feedback"],
    note: "On StudyForge, every push runs the backend tests, a Docker build and a health check.",
  },
];

const THEME_KEY = "cyan-theme";

/** Dark unless the visitor has chosen light. */
function readTheme(): "dark" | "light" {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** The cyan edition: the original identity, refined. Deployed on its own. */
export default function CyanPage() {
  const [theme, setTheme] = useState<"dark" | "light">(readTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<CaseStudy | null>(null);
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
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
    };
  }, [theme]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

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
      if (event.key !== "Escape") return;
      // The menu is about to unmount; focus inside it would fall back to the page.
      const inside = document.activeElement?.closest("#mobile-navigation");
      setMenuOpen(false);
      if (inside) menuToggleRef.current?.focus();
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
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    // Only an explicit choice is stored, so first-time visitors still get dark.
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage is blocked; the choice lasts for this visit */
    }
  };
  // Shared by the g shortcuts and the palette's "Go to" items. Scrolling alone leaves the keyboard
  // where it was, so the next Tab would fly back to the header; the section takes focus as well.
  const go = (target: string) => {
    if (!target.startsWith("#")) return navigate(target);
    const section = document.querySelector<HTMLElement>(target);
    if (!section) return;
    section.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    // The scroll is already under way; focusing must not start another.
    section.focus({ preventScroll: true });
  };
  // The header button is disabled under reduced motion, so the shortcut leaves it alone too.
  const toggleMotion = () => {
    if (!reducedMotion) setMotionPaused(!isMotionPaused());
  };
  const showShortcuts = () => setHelpOpen(true);
  useShortcuts({ toggleTheme, toggleMotion, showHelp: showShortcuts, go });
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
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <a className="header-contact" href="#contact">
              Contact me <ArrowUpRight size={15} />
            </a>
            <button
              ref={menuToggleRef}
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
            <Link to="/nexus" onClick={() => setMenuOpen(false)}>
              Project archive <ArrowUpRight size={18} />
            </Link>
            <Link to="/terminal" onClick={() => setMenuOpen(false)}>
              Terminal <ArrowUpRight size={18} />
            </Link>
            <a href={ARCADE_URL}>
              Play Tetris-89 <ArrowUpRight size={18} />
            </a>
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
              At LetsTute I work on agent workflows for our lead-generation
              platform and on bill OCR and LLM field extraction for a client
              ERP. On my own projects, no retrieval change stays until I've
              scored it against a baseline.
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

        <section id="work" tabIndex={-1} className="work-section section-wrap">
          <motion.div {...reveal} className="section-heading">
            <h2>
              Selected work<span className="heading-period">.</span>
            </h2>
            <p>
              Four projects I built alone, all with public source. Each one
              opens to show the mechanism and the check I ran on it.
            </p>
          </motion.div>
          <div className="work-grid">
            {cyanWork.map((project, index) => (
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

        <OtherWork />

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

        <section id="experience" tabIndex={-1} className="experience-section section-wrap">
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
          <ExperienceSection />
        </section>

        <section id="about" tabIndex={-1} className="about-section section-wrap">
          <motion.div {...reveal} className="about-statement">
            <span className="mono about-label">
              <DecodeText text="A little about me" />
            </span>
            <h2>
              I like the models.
              <br />
              <span>I also mark their homework.</span>
            </h2>
            <p>
              I'm Varun, an AI engineer in Mumbai. My work is the plumbing around
              an interesting model, meaning retrieval, backend APIs, evaluation
              and the interface someone has to use.
            </p>
            <p>
              Outside client work I've built a study tool that cites your own
              notes and an Android ledger that counts a refund as a refund.
              I've also written a research proposal on making LLM assistants
              cheaper to run.
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

        <section id="contact" tabIndex={-1} className="contact-section section-wrap">
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
        <EndOfTransmission />
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
