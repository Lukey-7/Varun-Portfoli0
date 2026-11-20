import { useEffect, useRef } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { OrdoContext } from "../OrdoLayout";
import { content } from "../content";
import { OrdoHero } from "../components/OrdoBlocks";
import { OrdoPaths } from "../components/OrdoPaths";
import { OrdoActivity } from "../components/OrdoActivity";
import { OrdoShowcase, OrdoWork } from "../components/OrdoSections";
import { OrdoProcess } from "../components/OrdoProcess";
import { OrdoCapabilities, OrdoConsole, OrdoResearch } from "../components/OrdoExtras";
import { useHomeMotion } from "../home/useHomeMotion";
import { JourneyTeaser } from "./JourneyPage";
import "../home/home.css";

/** The landing page: every signature animation, in the order of the reference film. */
export default function HomePage() {
  const { theme } = useOutletContext<OrdoContext>();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  useHomeMotion(rootRef);
  useEffect(() => {
    document.title = "Varun Darji | AI Engineer";
  }, []);

  return (
    // Home-only styles and entrances are scoped to this wrapper.
    <div className="ordo-home" ref={rootRef}>
      <OrdoHero theme={theme} />
      <OrdoPaths />
      {/* Client roles live on the About page, so those cards go there. */}
      <OrdoCapabilities onMissingTarget={(id) => navigate(`/about#spot-${id}`)} />
      <OrdoWork />
      <OrdoActivity />
      <OrdoProcess />
      <OrdoShowcase />
      <OrdoResearch />
      <OrdoConsole />
      <JourneyTeaser />

      <section id="about" className="about-teaser section-wrap">
        <div className="ordo-section-label">
          <span>{content.aboutTeaser.label[0]}</span>
          <span>{content.aboutTeaser.label[1]}</span>
        </div>
        <div className="about-teaser-grid">
          <h2>
            {content.about.title[0]}
            <br />
            <span>{content.about.title[1]}</span>
          </h2>
          <div>
            <p>{content.aboutTeaser.text}</p>
            <Link to="/about" className="section-link">
              {content.aboutTeaser.link} <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
