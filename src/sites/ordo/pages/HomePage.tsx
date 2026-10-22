import { useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { ArrowDown, ArrowUpRight, Download } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { OrdoContext } from "../OrdoLayout";
import Sculpture from "../components/Sculpture";
import {
  HeroTerminal,
  OrdoShowcase,
  OrdoWork,
  OrdoWorkflow,
} from "../components/OrdoSections";
import {
  OrdoCapabilities,
  OrdoConsole,
  OrdoResearch,
  PixelSwap,
} from "../components/OrdoExtras";

const tools = ["Python", "FastAPI", "React", "Kotlin", "PostgreSQL", "Docker"];

/** The landing page: every signature animation, in the order of the reference film. */
export default function HomePage() {
  const { theme } = useOutletContext<OrdoContext>();
  const reduced = useReducedMotion();
  useEffect(() => {
    document.title = "Varun Darji | AI Engineer";
  }, []);

  return (
    <>
      <section className="hero section-wrap">
        <motion.div
          className="hero-copy"
          initial={reduced ? false : { opacity: 0, y: 22 }}
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
            I build retrieval systems, agent workflows and client applications,
            with attention to evidence, reliability and the people using them.
          </p>
          <div className="hero-actions">
            <a href="#work" className="primary-button">
              Explore work <ArrowDown size={17} />
            </a>
            <a href="/Varun-Darji-Resume.pdf" download className="text-button">
              Resume <Download size={16} />
            </a>
          </div>
        </motion.div>
        <motion.div
          className="hero-art"
          initial={reduced ? false : { opacity: 0, scale: 0.94 }}
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
        <p>Everyday tools across these projects.</p>
        <div>
          {tools.map((tool) => (
            <span key={tool}>
              <PixelSwap>{tool}</PixelSwap>
            </span>
          ))}
        </div>
      </div>

      <OrdoCapabilities />
      <OrdoWork />
      <OrdoWorkflow />
      <OrdoShowcase />
      <OrdoResearch />
      <OrdoConsole />

      <section id="about" className="about-teaser section-wrap">
        <div className="ordo-section-label">
          <span>[ 07 / ABOUT ]</span>
          <span>MUMBAI · IST</span>
        </div>
        <div className="about-teaser-grid">
          <h2>
            Curious about the model.
            <br />
            <span>Responsible for the system.</span>
          </h2>
          <div>
            <p>
              I'm Varun, an AI engineer at LetsTute in Mumbai, with an M.Sc. in
              Computer Science. I enjoy the work between an interesting model
              and a useful application: retrieval, backend APIs, evaluation and
              the interface someone actually uses.
            </p>
            <Link to="/about" className="section-link">
              Experience, education and toolbox{" "}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
