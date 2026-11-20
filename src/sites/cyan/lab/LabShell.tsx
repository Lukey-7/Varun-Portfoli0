import { Suspense, createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { ArrowUpRight, Github, Linkedin, Mail, Menu, Moon, Pause, Play, Sun, X } from "lucide-react";
import { profile } from "@/data/profile";
import { ARCADE_URL, ORDO_URL } from "@/lib/sites";
import { setMotionPaused, useMotionPaused } from "@/lib/motion-pause";
import { readTheme, saveTheme, type LabTheme } from "./theme";
import { LAB_PAGES } from "./kit";
import "../cyan.css";
import "./lab.css";

const ThemeContext = createContext<LabTheme>("dark");
/** The lab's current theme, for canvas and SVG work that cannot read CSS variables. */
// eslint-disable-next-line react-refresh/only-export-components -- a hook that belongs with its provider
export const useLabTheme = () => useContext(ThemeContext);

/**
 * The chrome around every lab page: the cyan header, the pointer-lit
 * graticule, the theme and motion controls, the footer and the design switch.
 * It matches the home page so moving between them feels like one site.
 */
export default function LabShell() {
  const [theme, setTheme] = useState<LabTheme>(readTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const motionPaused = useMotionPaused();
  const { pathname } = useLocation();
  const page = LAB_PAGES.find((item) => item.to === pathname);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.title = page ? `${page.title} | Varun Darji` : "Varun Darji | AI Engineer";
  }, [page]);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.portfolioTheme = theme;
    html.dataset.portfolioEdition = "cyan";
    return () => {
      delete html.dataset.portfolioTheme;
      delete html.dataset.portfolioEdition;
    };
  }, [theme]);

  // The graticule brightens around the pointer, as it does on the home page.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0,
      x = -999,
      y = -999;
    const apply = () => {
      frame = 0;
      root.style.setProperty("--cx", `${x}px`);
      root.style.setProperty("--cy", `${y}px`);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const leave = () => {
      x = y = -999;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuToggleRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    saveTheme(next);
  };

  return (
    <ThemeContext.Provider value={theme}>
      <div ref={rootRef} className="portfolio cyan-edition lab" data-theme={theme}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="portfolio-header lab-header">
          <div className="header-inner">
            <Link to="/" className="wordmark">
              <span className="brand-mark" aria-hidden="true">
                v<span>.</span>
              </span>
              VARUN.DEV
            </Link>
            <nav className="desktop-links lab-links" aria-label="Lab pages">
              <Link to="/">Home</Link>
              {LAB_PAGES.map((item) => (
                <NavLink key={item.to} to={item.to}>
                  <span className="lab-code mono" aria-hidden="true">
                    {item.code}
                  </span>
                  {item.label}
                </NavLink>
              ))}
              <a href={ARCADE_URL}>Arcade</a>
            </nav>
            <div className="header-actions">
              <button
                className="icon-button motion-toggle"
                aria-label={motionPaused ? "Play all animations" : "Pause all animations"}
                title={motionPaused ? "Play all animations" : "Pause all animations"}
                disabled={reducedMotion ?? false}
                onClick={() => setMotionPaused(!motionPaused)}
              >
                {motionPaused || reducedMotion ? <Play size={16} /> : <Pause size={16} />}
              </button>
              <button
                className="icon-button theme-toggle"
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                onClick={toggleTheme}
              >
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              {/* A full load, so the home page lands on the section. */}
              <a className="header-contact" href="/#contact">
                Contact me <ArrowUpRight size={15} />
              </a>
              <button
                ref={menuToggleRef}
                className="icon-button mobile-menu-toggle"
                aria-expanded={menuOpen}
                aria-controls="lab-mobile-navigation"
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                {menuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
          {menuOpen && (
            <nav id="lab-mobile-navigation" className="mobile-links" aria-label="Mobile navigation">
              <Link to="/">
                Home <ArrowUpRight size={18} />
              </Link>
              {LAB_PAGES.map((item) => (
                <NavLink key={item.to} to={item.to}>
                  {item.title} <ArrowUpRight size={18} />
                </NavLink>
              ))}
              <a href={ARCADE_URL}>
                Arcade <ArrowUpRight size={18} />
              </a>
            </nav>
          )}
        </header>

        <main id="main" className="lab-main">
          <Suspense fallback={<LabLoading />}>
            <Outlet />
          </Suspense>
        </main>

        <footer className="lab-footer">
          <div className="lab-footer-inner">
            <p className="mono">
              VARUN.DEV / LAB <span aria-hidden="true">·</span> built by {profile.name.split(" ")[0]} in{" "}
              {profile.location.split(",")[0]}
            </p>
            <nav aria-label="Elsewhere" className="lab-footer-links">
              <a href={profile.github} target="_blank" rel="noreferrer" aria-label="GitHub">
                <Github size={16} />
              </a>
              <a href={profile.linkedin} target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <Linkedin size={16} />
              </a>
              <a href={`mailto:${profile.email}`} aria-label="Email">
                <Mail size={16} />
              </a>
            </nav>
          </div>
        </footer>

        <aside className="edition-switch" aria-label="Portfolio design edition">
          <span>Design</span>
          <a href="/" aria-current="page">
            Cyan
          </a>
          <a href={ORDO_URL}>Monochrome</a>
        </aside>
      </div>
    </ThemeContext.Provider>
  );
}

function LabLoading() {
  return (
    <div className="lab-loading" role="status">
      <span className="mono">Tuning in</span>
      <span className="lab-loading-bar" aria-hidden="true" />
    </div>
  );
}
