import { useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { research } from "@/data/portfolio";
import type { OrdoContext } from "../OrdoLayout";
import Sculpture from "../components/Sculpture";
import { ResearchStudies } from "../components/OrdoExtras";
import { ResearchLabs } from "../components/ResearchLabs";
import { ResearchLog } from "../components/ResearchLog";
import { content } from "../content";
import { MaskTitle } from "../content/MaskTitle";
import "../content/content.css";

const EASE = [0.16, 1, 0.3, 1] as const;

/** The research proposal in full. Hypotheses to test, not results. */
export default function ResearchPage() {
  const { theme } = useOutletContext<OrdoContext>();
  const reduced = useReducedMotion();
  useEffect(() => {
    document.title = "Research | Varun Darji";
  }, []);

  // The layout settles the hero in; the studies and explainers rise as they are reached.
  const reveal = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.15 },
        transition: { duration: 0.7, ease: EASE },
      };

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
            <MaskTitle lines={content.research.title} delay={0.08} />
            <p className="project-lede">{content.researchPage.intro}</p>
            <span className="research-status">{research.status}</span>
            <div className="research-interests">
              <strong>{content.researchPage.interests.title}</strong>
              <ul>
                {content.researchPage.interests.items.map((item, index) => (
                  <motion.li
                    key={item}
                    initial={reduced ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.55 + index * 0.08, ease: EASE }}
                  >
                    {item}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
          <div className="page-hero-art">
            <Sculpture dark={theme === "dark"} autoCycle />
          </div>
        </div>
      </header>

      <ResearchLog />

      <section className="section-wrap research-page-body">
        <motion.div {...reveal}>
          <ResearchStudies detailed />
        </motion.div>
        <motion.div {...reveal}>
          <ResearchLabs />
        </motion.div>
        <p className="research-note">
          {research.costNote} {research.note}
        </p>
      </section>
    </article>
  );
}
