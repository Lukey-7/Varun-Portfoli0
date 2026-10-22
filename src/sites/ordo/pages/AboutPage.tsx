import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ArrowUpRight, Download, Minus, Plus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { education, experience, profile } from "@/data/profile";
import { deliveryWork } from "@/data/portfolio";
import type { OrdoContext } from "../OrdoLayout";
import Sculpture from "../components/Sculpture";

/** Experience, education and toolbox: the CV-style detail, off the landing page. */
export default function AboutPage() {
  const { theme } = useOutletContext<OrdoContext>();
  const [openJob, setOpenJob] = useState<string | null>("letstute");
  const reduced = useReducedMotion();
  useEffect(() => {
    document.title = "About | Varun Darji";
  }, []);
  const reveal = {
    initial: reduced ? (false as const) : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.1 },
    transition: { duration: 0.55 },
  };

  return (
    <article className="about-page">
      <header className="page-hero section-wrap">
        <div className="ordo-section-label">
          <span>[ ABOUT / VARUN DARJI ]</span>
          <span>MUMBAI · IST</span>
        </div>
        <div className="page-hero-grid">
          <div className="page-hero-copy">
            <span className="mono project-category">A little about me</span>
            <h1>
              Curious about the model.
              <br />
              <span>Responsible for the system.</span>
            </h1>
            <p className="project-lede">
              I'm Varun, an AI engineer in Mumbai. I enjoy the work between an
              interesting model and a useful application: retrieval, backend
              APIs, evaluation and the interface someone actually uses.
            </p>
            <p className="project-lede">
              Outside client work, I build learning tools and an on-device
              finance app, and study how to reduce LLM inference costs.
            </p>
            <div className="project-actions">
              <a href="/Varun-Darji-Resume.pdf" download className="primary-button">
                Resume <Download size={16} aria-hidden="true" />
              </a>
              <a href={profile.github} target="_blank" rel="noreferrer" className="text-button">
                View my GitHub <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="page-hero-art is-calm" aria-hidden="true">
            <Sculpture dark={theme === "dark"} bare shape={1} />
          </div>
        </div>
      </header>

      <section id="experience" className="experience-section section-wrap">
        <motion.div {...reveal} className="section-heading">
          <h2>
            Real work.
            <br />
            <span>Shared responsibility.</span>
          </h2>
          <p>
            I work with teams, build new products and improve existing ones, and
            take ownership of the parts I deliver.
          </p>
        </motion.div>
        <div className="experience-list">
          {experience.map((job) => (
            <article className="experience-item" key={job.id}>
              <button
                aria-expanded={openJob === job.id}
                aria-controls={`job-${job.id}`}
                onClick={() => setOpenJob(openJob === job.id ? null : job.id)}
              >
                <span className="experience-period mono">
                  {job.period.replace(/[—–]/g, "-")}
                </span>
                <span className="experience-title">
                  <strong>{job.role}</strong>
                  <span>{job.company}</span>
                </span>
                {openJob === job.id ? <Minus size={20} /> : <Plus size={20} />}
              </button>
              <div id={`job-${job.id}`} hidden={openJob !== job.id}>
                {job.id === "letstute" ? (
                  <>
                    <div className="delivery-grid">
                      {deliveryWork.map((item) => (
                        <div key={item.title}>
                          <h3>{item.title}</h3>
                          <p>{item.text}</p>
                          <span className="mono">{item.tags}</span>
                        </div>
                      ))}
                    </div>
                    <p className="confidential-note">
                      Client systems are private. I can discuss architecture, my
                      contributions and engineering decisions without sharing
                      confidential access or data.
                    </p>
                  </>
                ) : (
                  <ul className="experience-details">
                    {job.highlights.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section section-wrap">
        <div className="about-details">
          <div className="toolbox">
            <h2>What I work with</h2>
            <div className="toolbox-group">
              <span>Build</span>
              <p>Python, FastAPI, TypeScript, React, Java, C++</p>
            </div>
            <div className="toolbox-group">
              <span>Reason</span>
              <p>RAG, LangGraph, LlamaIndex, hybrid retrieval, evaluation</p>
            </div>
            <div className="toolbox-group">
              <span>Deliver</span>
              <p>PostgreSQL, Docker, GitHub Actions, GCP, AWS</p>
            </div>
          </div>
          <div className="education-list">
            <h2>Education</h2>
            {education.map((item) => (
              <div key={item.id}>
                <span className="mono">{item.year}</span>
                <p>
                  <strong>{item.degree}</strong>
                  <span>{item.institution}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </article>
  );
}
