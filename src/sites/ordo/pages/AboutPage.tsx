import { useEffect } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { ArrowUpRight, Download } from "lucide-react";
import { useReducedMotion, useScroll, useTransform } from "framer-motion";
import { profile } from "@/data/profile";
import type { OrdoContext } from "../OrdoLayout";
import { content } from "../content";
import { spotlight } from "../spotlight";
import Sculpture from "../components/Sculpture";
import { OrdoExperience } from "../components/OrdoBlocks";
import { EducationTimeline } from "../components/EducationTimeline";
import { CareerRail } from "../content/CareerRail";
import { MaskTitle } from "../content/MaskTitle";
import { ToolboxExplorer } from "../content/ToolboxExplorer";
import "../content/content.css";

/** Experience, education and toolbox: the CV-style detail, off the landing page. */
export default function AboutPage() {
  const { theme } = useOutletContext<OrdoContext>();
  const { hash } = useLocation();
  const reduced = useReducedMotion();
  // The sphere drifts down and settles back a touch as the hero scrolls away.
  const { scrollY } = useScroll();
  const drift = useTransform(scrollY, [0, 700], [0, 70]);
  const fade = useTransform(scrollY, [0, 700], [1, 0.55]);
  useEffect(() => {
    document.title = "About | Varun Darji";
  }, []);
  // Arriving from a capability card (/about#spot-letstute) outlines that role.
  useEffect(() => {
    if (!hash.startsWith("#spot-")) return;
    const timer = window.setTimeout(() => spotlight(hash.slice(6), "From AI capabilities"), 350);
    return () => window.clearTimeout(timer);
  }, [hash]);

  // The layout settles the hero in on arrival; only the title's lines get their own reveal.
  return (
    <article className="about-page">
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>[ ABOUT / VARUN DARJI ]</span>
          <span>MUMBAI / IST</span>
        </div>
        <div className="page-hero-grid">
          <div className="page-hero-copy">
            <span className="mono project-category">{content.about.label}</span>
            <MaskTitle lines={content.about.title} delay={0.08} />
            {content.about.body.map((paragraph) => (
              <p className="project-lede" key={paragraph}>
                {paragraph}
              </p>
            ))}
            <div className="project-actions">
              <a href="/Varun-Darji-Resume.pdf" download className="primary-button">
                Resume <Download size={16} aria-hidden="true" />
              </a>
              <a href={profile.github} target="_blank" rel="noreferrer" className="text-button">
                View my GitHub <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="page-hero-art is-calm" aria-hidden="true">
            <Sculpture
              dark={theme === "dark"}
              bare
              shape={1}
              scrollSpin={1.1}
              canvasStyle={reduced ? undefined : { y: drift, opacity: fade }}
            />
          </div>
        </div>
      </header>

      <CareerRail />

      <OrdoExperience />

      <section className="about-section section-wrap">
        <div className="about-details">
          <ToolboxExplorer />
          <EducationTimeline />
        </div>
      </section>
    </article>
  );
}
