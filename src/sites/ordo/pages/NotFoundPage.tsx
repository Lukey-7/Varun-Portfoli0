import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function NotFoundPage() {
  useEffect(() => {
    document.title = "Not found | Varun Darji";
  }, []);
  return (
    <section className="page-hero section-wrap not-found">
      <div className="ordo-section-label">
        <span>[ 404 / NOT FOUND ]</span>
        <span>NOTHING AT THIS ADDRESS</span>
      </div>
      <h1>
        Nothing here.
        <br />
        <span>Try the work instead.</span>
      </h1>
      <Link to="/#work" className="primary-button">
        <span aria-hidden="true">←</span> Back to the projects
      </Link>
    </section>
  );
}
