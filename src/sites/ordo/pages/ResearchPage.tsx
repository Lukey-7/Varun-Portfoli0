import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowDown } from "lucide-react";
import { research } from "@/data/portfolio";
import type { OrdoContext } from "../OrdoLayout";
import Sculpture from "../components/Sculpture";
import { ResearchStudies } from "../components/OrdoExtras";
import { ResearchLabs } from "../components/ResearchLabs";
import { content } from "../content";

/** The research proposal in full. Hypotheses to test, not results. */
export default function ResearchPage() {
  const { theme } = useOutletContext<OrdoContext>();
  useEffect(() => {
    document.title = "Research | Varun Darji";
  }, []);

  return (
    <article className="research-page">
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>{content.researchPage.label[0]}</span>
          <span>{content.researchPage.label[1]}</span>
        </div>
        <div className="page-hero-grid">
          <div className="page-hero-copy">
            <span className="mono project-category">{content.researchPage.category}</span>
            <h1>
              {content.research.title[0]}
              <br />
              <span>{content.research.title[1]}</span>
            </h1>
            <p className="project-lede">{content.researchPage.intro}</p>
            <span className="research-status">{research.status}</span>
            <div className="research-looking">
              <strong>{content.researchPage.lookingFor.title}</strong>
              <p>{content.researchPage.lookingFor.text}</p>
              <a href="#contact" className="section-link">
                {content.researchPage.lookingFor.link} <ArrowDown size={14} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="page-hero-art">
            <Sculpture dark={theme === "dark"} autoCycle />
          </div>
        </div>
      </header>

      <section className="section-wrap research-page-body">
        <ResearchStudies detailed />
        <ResearchLabs />
        <p className="research-note">
          {research.costNote} {research.note}
        </p>
      </section>
    </article>
  );
}
