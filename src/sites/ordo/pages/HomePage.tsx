import { useEffect } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import type { OrdoContext } from "../OrdoLayout";
import { content } from "../content";
import { OrdoHero } from "../components/OrdoBlocks";
import { OrdoActivity } from "../components/OrdoActivity";
import { OrdoShowcase, OrdoWork, OrdoWorkflow } from "../components/OrdoSections";
import { OrdoCapabilities, OrdoConsole, OrdoResearch } from "../components/OrdoExtras";

/** The landing page: every signature animation, in the order of the reference film. */
export default function HomePage() {
  const { theme } = useOutletContext<OrdoContext>();
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Varun Darji | AI Engineer";
  }, []);

  return (
    <>
      <OrdoHero theme={theme} />
      {/* Client roles live on the About page, so those cards go there. */}
      <OrdoCapabilities onMissingTarget={(id) => navigate(`/about#spot-${id}`)} />
      <OrdoWork />
      <OrdoActivity />
      <OrdoWorkflow />
      <OrdoShowcase />
      <OrdoResearch />
      <OrdoConsole />

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
    </>
  );
}
