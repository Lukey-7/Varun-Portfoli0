import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { research } from "@/data/portfolio";
import type { OrdoContext } from "../OrdoLayout";
import Sculpture from "../components/Sculpture";
import { ResearchStudies } from "../components/OrdoExtras";

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
          <span>[ RESEARCH / PROPOSAL ]</span>
          <span>TWO PROPOSED STUDIES</span>
        </div>
        <div className="page-hero-grid">
          <div className="page-hero-copy">
            <span className="mono project-category">Prospective researcher</span>
            <h1>
              Lower inference cost.
              <br />
              <span>Same task quality?</span>
            </h1>
            <p className="project-lede">
              My proposal, <em>{research.title.toLowerCase()}</em>, sets out two
              experimental studies on the cost of LLM assistants. Each is framed
              as a hypothesis to test against simpler baselines.
            </p>
            <span className="research-status">{research.status}</span>
          </div>
          <div className="page-hero-art">
            <Sculpture dark={theme === "dark"} autoCycle />
          </div>
        </div>
      </header>

      <section className="section-wrap research-page-body">
        <ResearchStudies detailed />
        <p className="research-note">
          {research.costNote} {research.note}
        </p>
      </section>
    </article>
  );
}
