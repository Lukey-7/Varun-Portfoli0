import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { content } from "../content";
import { ArcadeCabinet } from "../demos/ArcadeDemo";

/** Lukey Arcade: both games in a cabinet sized to each one, not squeezed into a page. */
export default function PlayPage() {
  const { playPage } = content;
  useEffect(() => {
    document.title = "Play | Varun Darji";
  }, []);

  return (
    <article className="play-page">
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>{playPage.label[0]}</span>
          <span>{playPage.label[1]}</span>
        </div>
        <div className="play-head">
          <h1>
            {playPage.title[0]}
            <br />
            <span>{playPage.title[1]}</span>
          </h1>
          <div>
            <p className="project-lede">{playPage.intro}</p>
            <Link to="/work/arcade" className="section-link">
              {playPage.link} <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>
      <section className="section-wrap play-stage" aria-label="Arcade">
        <ArcadeCabinet size="full" />
      </section>
    </article>
  );
}
