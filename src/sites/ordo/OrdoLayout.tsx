import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigationType, useOutlet } from "react-router-dom";
import {
  ArrowUpRight,
  Menu,
  Moon,
  Pause,
  Play,
  Sun,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CYAN_URL } from "@/lib/sites";
import { setMotionPaused, useMotionPaused } from "@/lib/motion-pause";
import { DotWordmark } from "./components/OrdoExtras";
import { OrdoContact } from "./components/OrdoBlocks";
import { content } from "./content";
import { NavRail } from "./chrome/NavRail";
import { ReadingProgress, RouteRule } from "./chrome/HeaderRules";
import { BackToTop } from "./chrome/BackToTop";
import { PointerField } from "./chrome/PointerField";
import { useScrollChrome } from "./chrome/useScrollChrome";
import { withThemeWipe } from "./chrome/themeWipe";
import "./base.css";
import "./ordo.css";
import "./chrome/chrome.css";

export interface OrdoContext {
  theme: "dark" | "light";
}

const NAV = [
  { label: "Work", to: "/#work" },
  { label: "Research", to: "/research" },
  { label: "Journey", to: "/journey" },
  { label: "About", to: "/about" },
  { label: "Play", to: "/play" },
];

const THEME_KEY = "ordo-theme";

/** Light unless the visitor has explicitly chosen dark; the OS preference is not read. */
function readTheme(): "dark" | "light" {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/**
 * Scroll to the top on a new page, back to the visitor's place on browser
 * Back and Forward, or to the #section a link points at. A move to a new page
 * also moves keyboard focus to it, because the link just used has gone.
 */
function useScrollOnNavigate() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const saved = useRef(new Map<string, number>());
  const previousPath = useRef(pathname);

  useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);

  // A layout effect, so this entry's listener is gone before a shorter new
  // page clamps the scroll position and overwrites the place worth keeping.
  useLayoutEffect(() => {
    const remember = () => saved.current.set(key, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [key]);

  useEffect(() => {
    const cameFrom = previousPath.current;
    previousPath.current = pathname;
    if (!hash) {
      const top = navigationType === "POP" ? (saved.current.get(key) ?? 0) : 0;
      window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
      if (navigationType !== "POP" && cameFrom !== pathname) {
        document.getElementById("main")?.focus({ preventScroll: true });
      }
      return;
    }
    // Wait a moment for the new page to render its section.
    let tries = 0;
    const timer = setInterval(() => {
      const target = document.getElementById(hash.slice(1));
      if (target || ++tries > 30) {
        clearInterval(timer);
        // Instant: a smooth scroll down a long page feels slow after a page change.
        target?.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
      }
    }, 50);
    return () => clearInterval(timer);
  }, [pathname, hash, key, navigationType]);
}

/** Everything the monochrome site's pages share: header, contact, wordmark, footer. */
export default function OrdoLayout() {
  const [theme, setTheme] = useState<"dark" | "light">(readTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const paused = useMotionPaused();
  const location = useLocation();
  const outlet = useOutlet({ theme } satisfies OrdoContext);
  const { condensed, farDown, scrollYProgress } = useScrollChrome();
  const onWork = location.pathname.startsWith("/work/");
  useScrollOnNavigate();

  useEffect(() => {
    document.documentElement.dataset.portfolioTheme = theme;
    document.documentElement.dataset.portfolioEdition = "ordo";
    return () => {
      delete document.documentElement.dataset.portfolioTheme;
      delete document.documentElement.dataset.portfolioEdition;
    };
  }, [theme]);
  useEffect(() => setMenuOpen(false), [location.pathname]);

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
      <PointerField />
      <header className={condensed ? "portfolio-header is-condensed" : "portfolio-header"}>
        <div className="header-inner">
          <Link to="/" className="wordmark">
            <span className="brand-mark" aria-hidden="true">
              v<span>.</span>
            </span>
            VARUN.DEV
          </Link>
          <NavRail items={NAV} pathname={location.pathname} />
          <div className="header-actions">
            <button
              className="icon-button motion-toggle"
              aria-label={paused ? "Play all animations" : "Pause all animations"}
              title={paused ? "Play all animations" : "Pause all animations"}
              disabled={reduced ?? false}
              onClick={() => setMotionPaused(!paused)}
            >
              {paused || reduced ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              onClick={() => {
                const next = theme === "dark" ? "light" : "dark";
                withThemeWipe(() => setTheme(next), reduced ?? false);
                try {
                  window.localStorage.setItem(THEME_KEY, next);
                } catch {
                  // Storage can be blocked; the choice then lasts for this visit.
                }
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  className="chrome-theme-icon"
                  initial={reduced ? false : { opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.16 }}
                >
                  {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                </motion.span>
              </AnimatePresence>
            </button>
            <a className="header-contact" href="#contact">
              Contact me <ArrowUpRight size={15} aria-hidden="true" />
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
          <nav id="mobile-navigation" className="mobile-links" aria-label="Mobile navigation">
            {[...NAV, { label: "Contact", to: "#contact" }].map((item, index) => {
              const inner = (
                <>
                  <span className="mobile-index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mobile-label">{item.label}</span>
                  <ArrowUpRight size={18} aria-hidden="true" />
                </>
              );
              if (item.to === "#contact") {
                return (
                  <a key={item.label} href="#contact" onClick={() => setMenuOpen(false)}>
                    {inner}
                  </a>
                );
              }
              if (item.to.startsWith("/#")) {
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={onWork ? "active" : undefined}
                    aria-current={onWork ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <NavLink key={item.label} to={item.to} onClick={() => setMenuOpen(false)}>
                  {inner}
                </NavLink>
              );
            })}
          </nav>
        )}
        <ReadingProgress progress={scrollYProgress} />
        <RouteRule key={location.pathname} />
      </header>

      {/* Each page settles in on arrival, its sections a beat apart (CSS, in
          chrome/chrome.css), while a stroke draws across the header rule. There
          is no exit animation to wait for, so a page change never stalls. */}
      <main id="main" tabIndex={-1} key={location.pathname}>
        {outlet}
      </main>

      <OrdoContact />
      <DotWordmark />

      <footer className="portfolio-footer section-wrap">
        <span>
          © {new Date().getFullYear()} Varun Darji · Updated {content.updated}
        </span>
        <div>
          <Link to="/#console">Terminal</Link>
          <Link to="/journey">Journey</Link>
          <Link to="/writing">Writing</Link>
          <Link to="/play">Play</Link>
          <a href={CYAN_URL}>
            Cyan edition <span aria-hidden="true">↗</span>
          </a>
          <a href="#main">
            Back to top <span aria-hidden="true">↑</span>
          </a>
        </div>
      </footer>
      <BackToTop shown={farDown} progress={scrollYProgress} />
      <aside className="edition-switch" aria-label="Portfolio design edition">
        <span>Design</span>
        <a href={CYAN_URL}>Cyan</a>
        <Link to="/" aria-current="page">
          Monochrome
        </Link>
      </aside>
    </div>
  );
}
