import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Github,
  Linkedin,
  Menu,
  Moon,
  Sun,
  X,
  Plus,
  Minus,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { profile, experience, education } from "@/data/profile";
import { deliveryWork, type CaseStudy } from "@/data/portfolio";
import { CYAN_URL } from "@/lib/sites";
import { OrdoProjectDialog } from "./components/ProjectShowcase";
import Sculpture from "./components/Sculpture";
import {
  HeroTerminal,
  OrdoWork,
  OrdoWorkflow,
  OrdoShowcase,
} from "./components/OrdoSections";
import {
  DotWordmark,
  OrdoCapabilities,
  OrdoConsole,
  OrdoResearch,
  PixelSwap,
} from "./components/OrdoExtras";
import "./base.css";
import "./ordo.css";

const tools = ["Python", "FastAPI", "React", "Kotlin", "PostgreSQL", "Docker"];

/** The monochrome edition, led by the ORDO reference film. Deployed on its own. */
export default function OrdoPage() {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<CaseStudy | null>(null);
  const [openJob, setOpenJob] = useState<string | null>("letstute");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    document.documentElement.dataset.portfolioTheme = theme;
    document.documentElement.dataset.portfolioEdition = "ordo";
    document.title = "Varun Darji | AI Engineer";
    return () => {
      delete document.documentElement.dataset.portfolioTheme;
      delete document.documentElement.dataset.portfolioEdition;
      clearTimeout(copyTimer.current);
    };
  }, [theme]);

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
  const reveal = {
    initial: reducedMotion ? (false as const) : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.1 },
    transition: { duration: 0.55 },
  };

  return (
    <div className="portfolio ordo-edition" data-theme={theme}>
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
              Varun Darji / AI engineer / prospective researcher
            </p>
            <h1>
              Build intelligent
              <br />
              systems.
              <br />
              <span>Make them useful.</span>
            </h1>
            <p className="hero-description">
              I build retrieval systems, agent workflows and client
              applications, with attention to evidence, reliability and the
              people using them.
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
            initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
          >
            <div className="hero-coordinate mono">
              <span>VARUN / SYSTEMS STUDY</span>
              <span>INTERACTIVE GEOMETRY</span>
            </div>
            <Sculpture dark={theme === "dark"} autoCycle />
            <HeroTerminal />
          </motion.div>
        </section>
        <div className="ordo-stack-strip section-wrap">
          <p>Built with tools that get the work done.</p>
          <div>
            {tools.map((tool) => (
              <span key={tool}>
                <PixelSwap>{tool}</PixelSwap>
              </span>
            ))}
          </div>
        </div>

        <OrdoCapabilities />
        <OrdoWork onSelect={setSelected} />
        <OrdoWorkflow />
        <OrdoShowcase />
        <OrdoResearch />
        <OrdoConsole />

        <section id="experience" className="experience-section section-wrap">
          <motion.div {...reveal} className="section-heading">
            <h2>
              Real work.
              <br />
              <span>Shared responsibility.</span>
            </h2>
            <p>
              Building with teams, extending existing products, and taking
              ownership of the parts I deliver.
            </p>
          </motion.div>
          <div className="experience-list">
            {experience.map((job) => (
              <article className="experience-item" key={job.id}>
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
                        Client systems are private. I can discuss architecture,
                        my contributions and engineering decisions without
                        sharing confidential access or data.
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
              Outside client work, I build learning tools, explore on-device
              finance applications, and investigate how to reduce LLM token
              costs.
            </p>
            <a
              href={profile.github}
              target="_blank"
              rel="noreferrer"
              className="text-button"
            >
              Explore my GitHub <ArrowUpRight size={17} />
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
          <div className="contact-top">
            <h2>
              Have something
              <br />
              <span>worth building?</span>
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
      <DotWordmark />

      <footer className="portfolio-footer section-wrap">
        <span>© {new Date().getFullYear()} Varun Darji</span>
        <div>
          <a href="#console">Console</a>
          <a href={CYAN_URL}>Cyan edition ↗</a>
          <a href="#main">Back to top ↑</a>
        </div>
      </footer>
      <aside className="edition-switch" aria-label="Portfolio design edition">
        <span>Design</span>
        <a href={CYAN_URL}>Cyan</a>
        <a href="/" aria-current="page">
          Monochrome
        </a>
      </aside>
      <OrdoProjectDialog project={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
