import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Github,
  Linkedin,
  Minus,
  Plus,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { experience, profile } from "@/data/profile";
import { deliveryWork } from "@/data/portfolio";
import { content } from "../content";
import { SPOTLIGHT_EVENT, type SpotlightDetail } from "../spotlight";
import Sculpture from "./Sculpture";
import { EducationTimeline } from "./EducationTimeline";
import { HeroTerminal } from "./OrdoSections";
import { PixelSwap } from "./OrdoExtras";

/*
 * Page-level blocks shared by the single-page site and the multi-page site,
 * so both read the same words from ../content and stay in step.
 */

function useReveal() {
  const reduced = useReducedMotion();
  return {
    initial: reduced ? (false as const) : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.1 },
    transition: { duration: 0.55 },
  };
}

/** Hero copy, the interactive shape with the "now" terminal, and the tools strip. */
export function OrdoHero({ theme }: { theme: "dark" | "light" }) {
  const reduced = useReducedMotion();
  const { hero, stack } = content;
  return (
    <>
      <section className="hero section-wrap">
        <motion.div
          className="hero-copy"
          initial={reduced ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <p className="hero-eyebrow mono">{hero.eyebrow}</p>
          <h1>
            {hero.title[0]}
            <br />
            <span>{hero.title[1]}</span>
          </h1>
          <p className="hero-description">{hero.intro}</p>
          <div className="hero-actions">
            <a href="#work" className="primary-button">
              {hero.primary} <ArrowDown size={17} />
            </a>
            <a href="/Varun-Darji-Resume.pdf" download className="text-button">
              {hero.secondary} <Download size={16} />
            </a>
          </div>
          <a className="hero-now mono" href={hero.now.href}>
            <span>{hero.now.label}</span>
            <span>
              {hero.now.text} <ArrowDown size={13} aria-hidden="true" />
            </span>
          </a>
        </motion.div>
        <motion.div
          className="hero-art"
          initial={reduced ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
        >
          <div className="hero-coordinate mono">
            <span>{hero.artLabel[0]}</span>
            <span>{hero.artLabel[1]}</span>
          </div>
          <Sculpture dark={theme === "dark"} autoCycle />
          <HeroTerminal />
        </motion.div>
      </section>
      <div className="ordo-stack-strip section-wrap">
        <p>{stack.intro}</p>
        <div>
          {stack.tools.map((tool) => (
            <span key={tool}>
              <PixelSwap>{tool}</PixelSwap>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

/** Roles as disclosures; LetsTute opens by default and shows its three areas. */
export function OrdoExperience() {
  const [openJob, setOpenJob] = useState<string | null>("letstute");
  const reveal = useReveal();

  // A capability card that points at a role opens it before scrolling there.
  useEffect(() => {
    const onSpotlight = (event: Event) => {
      const { id } = (event as CustomEvent<SpotlightDetail>).detail;
      if (experience.some((job) => job.id === id)) setOpenJob(id);
    };
    window.addEventListener(SPOTLIGHT_EVENT, onSpotlight);
    return () => window.removeEventListener(SPOTLIGHT_EVENT, onSpotlight);
  }, []);

  return (
    <section id="experience" className="experience-section section-wrap">
      <motion.div {...reveal} className="section-heading">
        <h2>
          {content.experience.title[0]}
          <br />
          <span>{content.experience.title[1]}</span>
        </h2>
        <p>{content.experience.intro}</p>
      </motion.div>
      <div className="experience-list">
        {experience.map((job) => (
          <article className="experience-item" key={job.id} id={`spot-${job.id}`}>
            <button
              aria-expanded={openJob === job.id}
              aria-controls={`job-${job.id}`}
              onClick={() => setOpenJob(openJob === job.id ? null : job.id)}
            >
              <span className="experience-period mono">{job.period.replace(/[—–]/g, "-")}</span>
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
                  <p className="confidential-note">{content.experience.confidential}</p>
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
  );
}

/** Toolbox and the education timeline. */
export function AboutDetails() {
  return (
    <div className="about-details">
      <div className="toolbox">
        <h3>What I work with</h3>
        {content.about.toolbox.map(([group, tools]) => (
          <div className="toolbox-group" key={group}>
            <span>{group}</span>
            <p>{tools}</p>
          </div>
        ))}
      </div>
      <EducationTimeline />
    </div>
  );
}

/** The single page's about section: the short statement beside the details. */
export function OrdoAbout() {
  const reveal = useReveal();
  return (
    <section id="about" className="about-section section-wrap">
      <motion.div {...reveal} className="about-statement">
        <span className="mono about-label">{content.about.label}</span>
        <h2>
          {content.about.title[0]}
          <br />
          <span>{content.about.title[1]}</span>
        </h2>
        {content.about.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <a href={profile.github} target="_blank" rel="noreferrer" className="text-button">
          View my GitHub <ArrowUpRight size={17} aria-hidden="true" />
        </a>
      </motion.div>
      <AboutDetails />
    </section>
  );
}

/** Email with copy-to-clipboard, plus GitHub and LinkedIn. */
export function OrdoContact() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(copyTimer.current), []);

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

  return (
    <section id="contact" className="contact-section section-wrap">
      <div className="contact-top">
        <h2>
          {content.contact.title[0]}
          <br />
          <span>{content.contact.title[1]}</span>
        </h2>
        <a className="contact-arrow" href={`mailto:${profile.email}`} aria-label="Contact Varun by email">
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
            {copied ? "Copied" : copyError ? "Select the address to copy it." : ""}
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
  );
}
