import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, Moon, Sun, X } from "lucide-react";
import type { CaseStudy } from "@/data/portfolio";
import { CYAN_URL } from "@/lib/sites";
import { OrdoProjectDialog } from "./components/ProjectShowcase";
import { OrdoActivity } from "./components/OrdoActivity";
import { OrdoAbout, OrdoContact, OrdoExperience, OrdoHero } from "./components/OrdoBlocks";
import { OrdoWork, OrdoShowcase } from "./components/OrdoSections";
import { OrdoProcess } from "./components/OrdoProcess";
import {
  DotWordmark,
  OrdoCapabilities,
  OrdoConsole,
  OrdoResearch,
} from "./components/OrdoExtras";
import { content } from "./content";
import "./base.css";
import "./ordo.css";

/** The monochrome edition, led by the ORDO reference film. Deployed on its own. */
export default function OrdoPage() {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<CaseStudy | null>(null);
  const menuToggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.dataset.portfolioTheme = theme;
    document.documentElement.dataset.portfolioEdition = "ordo";
    document.title = "Varun Darji | AI Engineer";
    return () => {
      delete document.documentElement.dataset.portfolioTheme;
      delete document.documentElement.dataset.portfolioEdition;
    };
  }, [theme]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuToggle.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="portfolio ordo-edition" data-theme={theme}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="portfolio-header">
        <div className="header-inner">
          <Link to="/" className="wordmark">
            <span className="brand-mark" aria-hidden="true">
              v<span>.</span>
            </span>
            VARUN.DEV
          </Link>
          <nav className="desktop-links" aria-label="Main navigation">
            <a href="#work">Work</a>
            <a href="#research">Research</a>
            <a href="#experience">Experience</a>
            <a href="#about">About</a>
          </nav>
          <div className="header-actions">
            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <a className="header-contact" href="#contact">
              Contact me <ArrowUpRight size={15} />
            </a>
            <button
              ref={menuToggle}
              className="icon-button mobile-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            className="mobile-links"
            aria-label="Mobile navigation"
          >
            {["Work", "Research", "Experience", "About", "Contact"].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase()}`}
                onClick={() => setMenuOpen(false)}
              >
                {label}
                <ArrowUpRight size={18} />
              </a>
            ))}
          </nav>
        )}
      </header>

      <main id="main">
        <OrdoHero theme={theme} />
        <OrdoCapabilities />
        <OrdoWork onSelect={setSelected} />
        <OrdoActivity />
        <OrdoProcess />
        <OrdoShowcase />
        <OrdoResearch />
        <OrdoConsole />
        <OrdoExperience />
        <OrdoAbout />
        <OrdoContact />
      </main>
      <DotWordmark />

      <footer className="portfolio-footer section-wrap">
        <span>
          © {new Date().getFullYear()} Varun Darji · Updated {content.updated}
        </span>
        <div>
          <a href="#console">Terminal</a>
          <a href={CYAN_URL}>
            Cyan edition <span aria-hidden="true">↗</span>
          </a>
          <a href="#main">
            Back to top <span aria-hidden="true">↑</span>
          </a>
        </div>
      </footer>
      <aside className="edition-switch" aria-label="Portfolio design edition">
        <span>Design</span>
        <a href={CYAN_URL}>Cyan</a>
        <a href="/" aria-current="page">
          Monochrome
        </a>
      </aside>
      <OrdoProjectDialog project={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
