import { useEffect } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import OrdoPage from "./OrdoPage";

function OrdoNotFound() {
  useEffect(() => {
    document.title = "Not found | Varun Darji";
  }, []);
  return (
    <main className="ordo-not-found">
      <span>[ 404 / NOT FOUND ]</span>
      <h1>Nothing here.</h1>
      <Link to="/"><span aria-hidden="true">← </span>Back to the portfolio</Link>
    </main>
  );
}

/** The monochrome site is a single page; anything else is a 404. */
const App = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/" element={<OrdoPage />} />
      <Route path="/ordo" element={<Navigate to="/" replace />} />
      <Route path="*" element={<OrdoNotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
