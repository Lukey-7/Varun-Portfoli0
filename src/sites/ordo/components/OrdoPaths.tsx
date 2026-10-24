import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { content } from "../content";

/**
 * Two ways in, straight after the hero: one box for a hiring team and one for a
 * research group, each with three links. Plain links, no animation.
 */
export function OrdoPaths() {
  const { label, items } = content.paths;

  return (
    <section id="paths" className="ordo-paths section-wrap" aria-labelledby="ordo-paths-label">
      <div className="ordo-section-label">
        <span id="ordo-paths-label">{label[0]}</span>
        <span>{label[1]}</span>
      </div>
      <div className="ordo-paths-grid">
        {items.map((path) => (
          <div key={path.id} className={`ordo-path is-${path.id}`}>
            <h2>
              {path.title[0]}
              <br />
              <span>{path.title[1]}</span>
            </h2>
            <ul>
              {path.links.map(([text, to]) => (
                <li key={to}>
                  <Link to={to}>
                    <span>{text}</span>
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
