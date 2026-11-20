import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { MaskTitle } from "../content/MaskTitle";
import { useStill } from "../content/hooks";
import "../content/content.css";

// 5 × 7 dot-matrix glyphs, the same grid as the site's dotted wordmark.
const GLYPHS: Record<string, string[]> = {
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
};
const CODE = "404";
const COLS = CODE.length * 5 + (CODE.length - 1);

/** Every cell of the "404" matrix, lit or not, with a scattered but repeatable delay. */
const CELLS = Array.from({ length: 7 * COLS }, (_, index) => {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  const glyph = Math.floor(col / 6);
  const inGlyph = col % 6;
  const lit = inGlyph < 5 && GLYPHS[CODE[glyph]][row][inGlyph] === "#";
  return { lit, delay: ((index * 37) % 29) / 29 };
});

export default function NotFoundPage() {
  const { pathname } = useLocation();
  const still = useStill();
  useEffect(() => {
    document.title = "Not found | Varun Darji";
  }, []);

  return (
    <section className="page-hero section-wrap not-found">
      <div className="ordo-section-label">
        <span>[ 404 / NOT FOUND ]</span>
        <span>NOTHING AT THIS ADDRESS</span>
      </div>
      <div className="ct-404">
        <div className="ct-404-copy">
          <MaskTitle lines={["Nothing here.", "Try the work instead."]} />
          <p className="ct-404-path mono">
            <span aria-hidden="true">GET </span>
            <span className="ct-404-url">{pathname}</span>
            <span aria-hidden="true"> → 404</span>
            <i className="ct-404-caret" aria-hidden="true" />
          </p>
          <div className="ct-404-actions">
            <Link to="/#work" className="primary-button">
              <span aria-hidden="true">←</span> Back to the projects
            </Link>
            <Link to="/" className="text-button">
              Home <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div
          className={`ct-404-matrix${still ? " is-still" : ""}`}
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
          aria-hidden="true"
        >
          {CELLS.map((cell, index) => (
            <i
              key={index}
              className={cell.lit ? "is-lit" : undefined}
              style={{ animationDelay: `${0.2 + cell.delay * 0.7}s` }}
            />
          ))}
          <span className="ct-404-scan" />
        </div>
      </div>
    </section>
  );
}
