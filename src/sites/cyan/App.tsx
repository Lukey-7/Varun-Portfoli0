import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { useEffect, lazy, Suspense } from "react";
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

/** Every route change should land at the top of the new page. */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);
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
    <ScrollToTop />
    <LegacyChrome />
    <AnimatedRoutes />
  </BrowserRouter>
);

export default App;
