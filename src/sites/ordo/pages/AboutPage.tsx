import { useEffect } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { ArrowUpRight, Download } from "lucide-react";
import { profile } from "@/data/profile";
import type { OrdoContext } from "../OrdoLayout";
import { content } from "../content";
import { spotlight } from "../spotlight";
import Sculpture from "../components/Sculpture";
import { AboutDetails, OrdoExperience } from "../components/OrdoBlocks";

/** Experience, education and toolbox: the CV-style detail, off the landing page. */
export default function AboutPage() {
  const { theme } = useOutletContext<OrdoContext>();
  const { hash } = useLocation();
  useEffect(() => {
    document.title = "About | Varun Darji";
  }, []);
  // Arriving from a capability card (/about#spot-letstute) outlines that role.
  useEffect(() => {
    if (!hash.startsWith("#spot-")) return;
    const timer = window.setTimeout(() => spotlight(hash.slice(6), "From AI capabilities"), 350);
    return () => window.clearTimeout(timer);
  }, [hash]);

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
            <h1>
              {content.about.title[0]}
              <br />
              <span>{content.about.title[1]}</span>
            </h1>
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
            <Sculpture dark={theme === "dark"} bare shape={1} />
          </div>
        </div>
      </header>

      <OrdoExperience />

      <section className="about-section section-wrap">
        <AboutDetails />
      </section>
    </article>
  );
}
