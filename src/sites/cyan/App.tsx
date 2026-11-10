import { BrowserRouter, Navigate, Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { AnimatePresence, MotionConfig } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState, lazy, Suspense } from "react";
import Navigation from "@/components/Navigation";
import NebulaBackground from "@/components/NebulaBackground";
import { ORDO_URL } from "@/lib/sites";
import CyanPage from "./CyanPage";

// The original pages belong to the cyan site and load on demand.
const Index = lazy(() => import("@/pages/Index"));
const Logs = lazy(() => import("@/pages/Logs"));
const Nexus = lazy(() => import("@/pages/Nexus"));
const Vault = lazy(() => import("@/pages/Vault"));
const Terminal = lazy(() => import("@/pages/Terminal"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const SCROLL_KEY = "cyan-scroll";

function readSavedScroll(): Map<string, number> {
  try {
    return new Map(JSON.parse(window.sessionStorage.getItem(SCROLL_KEY) ?? "[]") as [string, number][]);
  } catch {
    return new Map();
  }
}

/** True for a link or typed URL, false for a reload or a return to this page. */
function isFreshDocument() {
  const entry = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  return !entry || entry.type === "navigate";
}

/**
 * A new route lands at the top of its page. Back, Forward and reload return
 * to where the visitor was, which has to be done here because the browser
 * would restore against the outgoing, shorter route. A fresh load with a hash
 * goes to that section, and in-page anchors (same path) keep their smooth
 * scroll.
 */
const ScrollToTop = () => {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const seen = useRef<string | null>(null);
  const [saved] = useState(readSavedScroll);

  useEffect(() => {
    window.history.scrollRestoration = "manual";
    const persist = () => {
      try {
        window.sessionStorage.setItem(SCROLL_KEY, JSON.stringify([...saved]));
      } catch {
        /* storage blocked: positions last for this page load only */
      }
    };
    window.addEventListener("pagehide", persist);
    return () => window.removeEventListener("pagehide", persist);
  }, [saved]);

  // A layout effect, so the old listener is gone before a shorter page clamps the position.
  useLayoutEffect(() => {
    const record = () => saved.set(key, window.scrollY);
    window.addEventListener("scroll", record, { passive: true });
    return () => window.removeEventListener("scroll", record);
  }, [key, saved]);

  useEffect(() => {
    const firstLoad = seen.current === null;
    if (!firstLoad && seen.current === pathname && navigationType !== "POP") return;
    seen.current = pathname;
    if (navigationType !== "POP") {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    const top = firstLoad && isFreshDocument() ? undefined : saved.get(key);
    if (top !== undefined) {
      window.scrollTo({ top, behavior: "instant" });
      return;
    }
    if (firstLoad && hash) {
      try {
        document.querySelector<HTMLElement>(hash)?.scrollIntoView({ behavior: "instant" });
      } catch {
        /* not a valid selector */
      }
    }
  }, [pathname, hash, key, navigationType, saved]);
  return null;
};

/** Old /ordo links now belong to the separate monochrome site. */
const ToOrdo = () => {
  useEffect(() => {
    window.location.replace(ORDO_URL);
  }, []);
  return null;
};

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<p className="p-12 text-center">Loading portfolio...</p>}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<CyanPage />} />
          <Route path="/cyan" element={<Navigate to="/" replace />} />
          <Route path="/ordo" element={<ToOrdo />} />
          <Route path="/classic" element={<Index />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/nexus" element={<Nexus />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
};

const LegacyChrome = () => {
  const { pathname } = useLocation();
  if (["/", "/cyan", "/ordo"].includes(pathname)) return null;
  return (
    <>
      <NebulaBackground />
      <Navigation />
    </>
  );
};

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <MotionConfig reducedMotion="user">
      <ScrollToTop />
      <LegacyChrome />
      <AnimatedRoutes />
    </MotionConfig>
  </BrowserRouter>
);

export default App;
