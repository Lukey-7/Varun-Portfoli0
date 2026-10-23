import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import OrdoLayout from "./OrdoLayout";
import HomePage from "./pages/HomePage";
import ProjectPage from "./pages/ProjectPage";
import ResearchPage from "./pages/ResearchPage";
import AboutPage from "./pages/AboutPage";
import PlayPage from "./pages/PlayPage";
import NotFoundPage from "./pages/NotFoundPage";
import JourneyPage from "./pages/JourneyPage";
import WritingPage from "./pages/WritingPage";

/** The monochrome site's pages, all inside one shared layout. */
export function OrdoRoutes() {
  return (
    <Routes>
      <Route element={<OrdoLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/work/:slug" element={<ProjectPage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/journey" element={<JourneyPage />} />
        <Route path="/writing" element={<WritingPage />} />
        <Route path="/writing/:slug" element={<WritingPage />} />
        <Route path="/ordo" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <OrdoRoutes />
  </BrowserRouter>
);

export default App;
